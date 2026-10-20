/**
 * The score: a look-ahead scheduler that plays `tracks.ts` on the AudioContext `Sound` shares (`Sound.context()`), with tiny synth voices.
 * A setTimeout every TICK_MS schedules the notes of the next LOOKAHEAD_S on the audio clock, so timing never depends on the main thread.
 * A new track crossfades over CROSSFADE_S; a track of the same family (hub → map, a battle's ready window → FIGHT! → phase 2 → 3) changes
 * layers and tempo in place, so the music never restarts on a route change. `duck` (a paused fight, a dialog over it) drops it to DUCK_LEVEL
 * and low-passes it; `punch()` (a big cue) dips it for PUNCH_S. The scheduler stops while the page is hidden or the context is not running
 * (Sound suspends it), and playing music keeps Sound's idle suspend away (`keepAlive`). Off (`enabled = false`) it schedules nothing and
 * never asks for a context; with Sound effects off too, `Sound` never creates one (P11).
 */
import type { Sound } from './sound';
import { TRACKS, SILENT, layerOn, type Layer, type MusicCue, type Note, type Track, type TrackId, type Voice } from './tracks';

export const MUSIC_VOLUME = 0.35, CROSSFADE_S = 0.6, DUCK_LEVEL = 0.25, LOOKAHEAD_S = 0.25, TICK_MS = 100, PUNCH_S = 0.3;
/** Loudness of one note at velocity 1 per voice, before the layer gain and MUSIC_VOLUME (the cues peak around 0.02–0.05). */
const VOICE_LEVEL: Record<Voice, number> = { lute: .09, pad: .05, bass: .11, kick: .2, brush: .07, bell: .07, horn: .05, lead: .05, crackle: .06, drip: .06 };
const DUCK_HZ = 700, MUFFLE_HZ = 1100, OPEN_HZ = 18000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const sameCue = (a: MusicCue, b: MusicCue) => a.track === b.track && a.fight === b.fight && a.phase === b.phase && a.bpm === b.bpm && a.duck === b.duck && a.muffle === b.muffle;

/** A layer's notes indexed by step, built once per layer (a tick looks up its steps instead of scanning every note). */
const stepIndex = new WeakMap<Layer, Note[][]>();
function byStep(l: Layer) {
  let index = stepIndex.get(l);
  if (!index) { index = []; for (const note of l.notes) (index[note[0]] ??= []).push(note); stepIndex.set(l, index); }
  return index;
}

/** A layer's gain, and where its notes go in: the voice's filter, shared by the whole layer (a filter per note made the scheduler 4× dearer). */
interface LayerOut { gain: GainNode; input: AudioNode }
/** The tone filter each voice plays through (once per layer). */
const VOICE_FILTER: Partial<Record<Voice, [BiquadFilterType, number]>> = { pad: ['lowpass', 900], bass: ['lowpass', 380], horn: ['lowpass', 1300], lead: ['lowpass', 2400], brush: ['bandpass', 3200], crackle: ['highpass', 2400] };
interface Playing { track: Track; bus: GainNode; layers: Map<string, LayerOut>; step: number; next: number; done: boolean; gain: number }

export class Music {
  private on = true;
  private cue: MusicCue = SILENT;
  /** The track the cue asked for (a one-shot keeps it after handing over, so the same cue never plays it again). */
  private requested: TrackId | null = null;
  private ctx?: AudioContext;
  private out?: { punch: GainNode; duck: GainNode; filter: BiquadFilterNode };
  private playing?: Playing;
  private fading: { bus: GainNode; until: number }[] = [];
  private handover?: { at: number; track: TrackId; gain: number };
  private timer?: ReturnType<typeof setTimeout>;
  private hidden = typeof document !== 'undefined' && document.hidden;
  private watched = new WeakSet<AudioContext>();
  /** Main-thread time spent scheduling (ms), for the perf check of the scheduler's cost. */
  private busy = 0;

  constructor(private readonly sound: Sound) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.visibility(document.hidden));
  }

  get enabled() { return this.on; }
  /** Music on or off: off fades out and stops scheduling (the context is Sound's to suspend). */
  set enabled(value: boolean) {
    if (this.on === value) return;
    this.on = value;
    if (!value) this.stop(); else { this.requested = null; this.set(this.cue); }
  }
  /** What is playing (QA and tests): the cue's track and the one actually sounding (after a hand-over), and whether the scheduler runs. */
  state() { return { requested: this.requested, playing: this.playing && !this.playing.done ? this.playing.track.id : null, fight: this.cue.fight, phase: this.cue.phase, duck: this.cue.duck, muffle: this.cue.muffle, scheduling: this.timer !== undefined, context: this.ctx?.state ?? null, busyMs: Math.round(this.busy * 100) / 100 }; }

  /** Play what the screen asks for (main.ts: syncMusic → musicFor). Cheap when nothing changed. */
  set(cue: MusicCue) {
    const same = sameCue(cue, this.cue);
    this.cue = cue;
    if (!this.on || this.hidden) return;
    if (!cue.track) { if (this.requested || this.playing || this.handover) this.stop(); return; }
    const c = this.context();
    if (!c) return;
    if (c.state !== 'running') { this.sound.keepAlive(); return; }
    if (same && this.requested === cue.track && this.timer !== undefined) return;
    if (this.requested !== cue.track) this.switchTo(cue.track);
    this.applyLayers(); this.applyOut();
    this.arm();
  }

  /** A big cue (the ultimate, a kill): the music dips for PUNCH_S. */
  punch() {
    const c = this.ctx, out = this.out;
    if (!c || !out || !this.playing || c.state !== 'running') return;
    const g = out.punch.gain, now = c.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(.4, now + .04); g.setValueAtTime(.4, now + PUNCH_S - .1); g.linearRampToValueAtTime(1, now + PUNCH_S + .2);
  }

  /** Hidden: the scheduler stops (Sound suspends the context). Shown: it goes on where it was, from the audio clock. */
  visibility(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) { this.halt(); return; }
    this.set(this.cue);
  }

  private context() {
    const c = this.sound.context();
    if (!c) return undefined;
    if (c !== this.ctx) { this.ctx = c; this.out = undefined; this.playing = undefined; this.fading = []; this.handover = undefined; this.requested = null; }
    if (!this.watched.has(c)) { this.watched.add(c); c.addEventListener?.('statechange', () => { if (c.state === 'running' && this.on && !this.hidden && this.cue.track) this.set(this.cue); }); }
    if (!this.out) {
      const punch = c.createGain(), duck = c.createGain(), filter = c.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = OPEN_HZ; filter.Q.value = .5;
      duck.gain.value = MUSIC_VOLUME;
      punch.connect(duck); duck.connect(filter); filter.connect(c.destination);
      this.out = { punch, duck, filter };
    }
    return c;
  }

  private switchTo(id: TrackId) {
    const c = this.ctx!, track = TRACKS[id], now = c.currentTime, p = this.playing;
    this.requested = id;
    this.handover = undefined;
    if (p && !p.done && p.track.family === track.family) {
      // Same family: new layers fade in, the old ones stop, the tempo follows; no restart.
      p.track = track; p.gain = 1; this.ramp(p.bus.gain, 1, now);
      return;
    }
    if (p) this.fadeOut(p);
    this.start(track, 1);
  }
  private start(track: Track, gain: number) {
    const c = this.ctx!, now = c.currentTime, bus = c.createGain();
    bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(gain, now + CROSSFADE_S);
    bus.connect(this.out!.punch);
    this.playing = { track, bus, layers: new Map(), step: 0, next: now + .05, done: false, gain };
    this.applyLayers();
  }
  private fadeOut(p: Playing) {
    const c = this.ctx!, now = c.currentTime;
    p.bus.gain.cancelScheduledValues(now); p.bus.gain.setValueAtTime(p.bus.gain.value, now); p.bus.gain.linearRampToValueAtTime(0, now + CROSSFADE_S);
    this.fading.push({ bus: p.bus, until: now + CROSSFADE_S + LOOKAHEAD_S + .1 });
    if (this.playing === p) this.playing = undefined;
  }
  /** Each layer has its own gain: a layer that comes in (FIGHT!, a phase, the march) fades in over a few hundred ms. */
  private applyLayers() {
    const c = this.ctx, p = this.playing;
    if (!c || !p) return;
    for (const l of p.track.layers) {
      let out = p.layers.get(l.name);
      const on = layerOn(l, this.cue);
      if (!out) {
        const gain = c.createGain(), filter = VOICE_FILTER[l.voice];
        gain.gain.value = 0; gain.connect(p.bus);
        let input: AudioNode = gain;
        if (filter) { const f = c.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = .8; f.connect(gain); input = f; }
        p.layers.set(l.name, out = { gain, input });
      }
      this.ramp(out.gain.gain, on ? l.gain : 0, c.currentTime, .12);
    }
    for (const [name, out] of p.layers) if (!p.track.layers.some(l => l.name === name)) this.ramp(out.gain.gain, 0, c.currentTime, .12);
  }
  private applyOut() {
    const c = this.ctx!, out = this.out!, now = c.currentTime;
    this.ramp(out.duck.gain, MUSIC_VOLUME * (this.cue.duck ? DUCK_LEVEL : 1), now, .08);
    this.ramp(out.filter.frequency, this.cue.duck ? DUCK_HZ : this.cue.muffle ? MUFFLE_HZ : OPEN_HZ, now, .1);
  }
  private ramp(param: AudioParam, value: number, now: number, tau = CROSSFADE_S / 3) {
    if (Math.abs(param.value - value) < 1e-4) { param.cancelScheduledValues(now); param.setValueAtTime(value, now); return; }
    param.cancelScheduledValues(now); param.setTargetAtTime(value, now, tau);
  }

  /** Fade out what plays and stop scheduling once the fade has ended. */
  private stop() {
    this.requested = null; this.handover = undefined;
    if (this.playing && this.ctx) this.fadeOut(this.playing);
    if (this.fading.length) this.arm(); else this.halt();
  }
  private halt() { if (this.timer !== undefined) { clearTimeout(this.timer); this.timer = undefined; } }
  private arm() {
    if (this.timer !== undefined || this.hidden) return;
    this.timer = setTimeout(() => this.tick(), 0);
  }

  private tick() {
    const t0 = performance.now();
    this.schedule();
    this.busy += performance.now() - t0;
  }
  private schedule() {
    this.timer = undefined;
    const c = this.ctx;
    if (!c || this.hidden || c.state !== 'running') return;
    const now = c.currentTime, horizon = now + LOOKAHEAD_S;
    this.fading = this.fading.filter(f => { if (f.until > now) return true; f.bus.disconnect(); return false; });
    if (this.handover && this.on && now >= this.handover.at - LOOKAHEAD_S) { const h = this.handover; this.handover = undefined; if (this.playing) this.fadeOut(this.playing); this.start(TRACKS[h.track], h.gain); }
    const p = this.playing;
    if (p && !p.done && this.on) {
      this.sound.keepAlive();
      // Back from a stall (a busy main thread, a context that ran while nothing scheduled): never play a burst of late notes.
      if (p.next < now - .1) p.next = now + .02;
      const stepS = 60 / (this.cue.bpm && this.requested === p.track.id ? this.cue.bpm : p.track.bpm) / 4;
      while (p.next < horizon) {
        if (!p.track.loop && p.step >= p.track.steps) {
          p.done = true;
          const next = p.track.next;
          if (next) this.handover = { at: p.next + next.gap, track: next.track, gain: next.gain };
          break;
        }
        for (const l of p.track.layers) if (layerOn(l, this.cue)) this.playStep(l, p, p.step % l.steps, p.next, stepS);
        p.next += stepS; p.step++;
        if (p.track.loop && p.step >= p.track.steps) p.step = 0;
      }
    }
    if ((p && !p.done && this.on) || this.handover || this.fading.length) this.timer = setTimeout(() => this.tick(), TICK_MS);
  }

  private playStep(l: Layer, p: Playing, step: number, at: number, stepS: number) {
    const notes = byStep(l)[step], dest = p.layers.get(l.name)?.input;
    if (!notes || !dest) return;
    for (const [, midi, len, vel] of notes) this.voice(l.voice, midi, at, len * stepS, vel * VOICE_LEVEL[l.voice], dest);
  }

  /** The instruments: a few oscillators, a filter and an envelope each, started and stopped on the audio clock. */
  private voice(v: Voice, midi: number, t: number, d: number, level: number, dest: AudioNode) {
    const c = this.ctx!;
    const env = (attack: number, hold: number, release: number) => { const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); if (hold > 0) g.gain.setValueAtTime(level, t + attack + hold); g.gain.exponentialRampToValueAtTime(.0001, t + attack + hold + release); g.connect(dest); return { g, end: t + attack + hold + release + .02 }; };
    const osc = (type: OscillatorType, f: number, to: AudioNode, end: number, detune = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune; o.connect(to); o.start(t); o.stop(end); return o; };
    const noise = (to: AudioNode, length: number) => { const buffer = this.sound.noiseBuffer(c), src = c.createBufferSource(); src.buffer = buffer; src.connect(to); src.start(t, (t * 7.31 + midi * .0137) % (buffer.duration - length), length); };
    const f = hz(midi);
    switch (v) {
      case 'lute': { const e = env(.004, 0, Math.max(.35, d * 1.4)); osc('triangle', f, e.g, e.end); break; }
      case 'pad': { const e = env(Math.min(.4, d * .3), Math.max(0, d * .7 - .1), .5); osc('sawtooth', f, e.g, e.end, -7); osc('sawtooth', f, e.g, e.end, 7); break; }
      case 'bass': { const e = env(.006, Math.max(0, d * .5), Math.max(.12, d * .5)); osc('sawtooth', f, e.g, e.end); break; }
      case 'kick': { const e = env(.002, 0, .28), o = osc('sine', f * 3, e.g, e.end); o.frequency.exponentialRampToValueAtTime(Math.max(30, f), t + .12); break; }
      case 'brush': { const e = env(.002, 0, Math.min(.2, .05 + d * .5)); noise(e.g, Math.min(.25, .06 + d)); break; }
      case 'crackle': { const e = env(.001, 0, .03); noise(e.g, .04); break; }
      case 'drip': { const e = env(.002, 0, .16), o = osc('sine', f, e.g, e.end); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + .06); break; }
      case 'bell': {
        // FM: an inharmonic modulator (×1.4) whose depth decays, plus a quiet 2.76 partial — the Bell over Emberhollow.
        const e = env(.003, 0, Math.max(1.6, d * 1.5)), carrier = osc('sine', f, e.g, e.end), mod = c.createOscillator(), depth = c.createGain();
        mod.frequency.setValueAtTime(f * 1.4, t); depth.gain.setValueAtTime(f * 1.8, t); depth.gain.exponentialRampToValueAtTime(f * .05, t + 1.2);
        mod.connect(depth); depth.connect(carrier.frequency); mod.start(t); mod.stop(e.end);
        const p = c.createGain(); p.gain.value = .25; p.connect(e.g); osc('sine', f * 2.76, p, Math.min(e.end, t + .8));
        break;
      }
      case 'horn': { const e = env(.06, Math.max(0, d - .1), .18); osc('square', f, e.g, e.end, -5); osc('sawtooth', f, e.g, e.end, 5); break; }
      case 'lead': { const e = env(.02, Math.max(0, d * .7), Math.max(.1, d * .3)); osc('square', f, e.g, e.end); break; }
    }
  }
}
