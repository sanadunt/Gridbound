/**
 * Gridbound's score as pure data (no Web Audio here): tracks of looping layers of notes, and `musicFor(state)`, the one mapping from
 * what is on screen to what plays. `music.ts` schedules these with synth voices; tests read them without audio.
 *
 * A step is a sixteenth note. A note is [step, midi, length in steps, velocity 0..1]. A layer loops over its own `steps`; a track's loop
 * is `steps` long (every layer's length divides it). A layer's `when` says when it plays: `fight` only after FIGHT! (the ready window
 * plays the rest, low-passed), `minPhase` only from that boss phase on. Tracks of one `family` share their layers: switching between
 * them (the hub and the map's march, a battle's phases) changes layers in place and never restarts the music.
 */

export type Voice = 'lute' | 'pad' | 'bass' | 'kick' | 'brush' | 'bell' | 'horn' | 'lead' | 'crackle' | 'drip';
export const VOICES: readonly Voice[] = ['lute', 'pad', 'bass', 'kick', 'brush', 'bell', 'horn', 'lead', 'crackle', 'drip'];
export type Note = readonly [step: number, midi: number, len: number, vel: number];
export interface Layer { name: string; voice: Voice; steps: number; gain: number; notes: readonly Note[]; when?: { fight?: boolean; minPhase?: number } }
export const TRACK_IDS = ['title', 'hub', 'map', 'battle-act1', 'battle-act2', 'battle-act3', 'battle-act4', 'crypt', 'trial', 'hunt', 'sting-win', 'bell-toll'] as const;
export type TrackId = (typeof TRACK_IDS)[number];
export interface Track {
  id: TrackId; family: string; bpm: number; loop: boolean; steps: number; layers: readonly Layer[];
  /** A one-shot that hands over to another track after `gap` seconds of silence, at `gain` (the defeat toll, then the hub softly). */
  next?: { track: TrackId; gap: number; gain: number };
}

/** The Bell Trials quicken by TRIAL_BPM_STEP every TRIAL_BPM_FLOORS floors, at most TRIAL_BPM_CAP over the base tempo. */
export const TRIAL_BPM = 120, TRIAL_BPM_STEP = 4, TRIAL_BPM_FLOORS = 3, TRIAL_BPM_CAP = 24;
export const trialBpm = (floor: number) => TRIAL_BPM + Math.min(TRIAL_BPM_CAP, TRIAL_BPM_STEP * Math.floor(Math.max(0, floor - 1) / TRIAL_BPM_FLOORS));

const BAR = 16;
/** A deterministic pseudo-random sequence (fire crackle, water drips): the same notes on every build. */
function lcg(seed: number) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; }
const layer = (name: string, voice: Voice, steps: number, gain: number, notes: Note[], when?: Layer['when']): Layer => ({ name, voice, steps, gain, notes, ...(when ? { when } : {}) });
/** Chord tones walked by `order` (indices into the chord, +12 per wrap), one note every `every` steps, one chord per bar. */
function arp(chords: number[][], order: number[], every: number, len: number, vel: number, shift = 0): Note[] {
  const out: Note[] = [];
  chords.forEach((chord, bar) => { for (let i = 0; i * every < BAR; i++) { const k = order[i % order.length]; out.push([bar * BAR + i * every, chord[k % chord.length] + 12 * Math.floor(k / chord.length) + shift, len, i === 0 ? Math.min(1, vel + .15) : vel]); } });
  return out;
}
/** Each chord held for its bar (a pad). */
const hold = (chords: number[][], vel: number, shift = 0): Note[] => chords.flatMap((chord, bar) => chord.map(m => [bar * BAR, m + shift, BAR, vel] as Note));
/** One pitch on the given steps of every bar (drums, a pulse). */
const hits = (bars: number, steps: number[], midi: number, len: number, vel: number | number[]): Note[] =>
  Array.from({ length: bars }, (_, bar) => steps.map((s, i) => [bar * BAR + s, midi, len, Array.isArray(vel) ? vel[i % vel.length] : vel] as Note)).flat();
/** A melody: [step, midi, len] in one go, all at `vel`. */
const line = (notes: [number, number, number][], vel: number): Note[] => notes.map(([s, m, l]) => [s, m, l, vel]);

// ── Emberhollow's theme: D dorian (Dm7 · G · C · Am), a lute arpeggio over a pad, the bell every four bars. ──
const THEME = [[50, 53, 57, 60], [55, 59, 62], [50, 53, 57, 60], [48, 52, 55], [50, 53, 57, 60], [55, 59, 62], [48, 52, 55], [45, 48, 52]];
const roots = (chords: number[][], shift: number, every = BAR, vel = .7): Note[] => chords.flatMap((c, bar) => Array.from({ length: BAR / every }, (_, i) => [bar * BAR + i * every, c[0] + shift, every, i ? vel * .8 : vel] as Note));

const title: Track = { id: 'title', family: 'title', bpm: 76, loop: true, steps: 8 * BAR, layers: [
  layer('lute', 'lute', 8 * BAR, .55, arp(THEME, [0, 1, 2, 3, 4, 3, 2, 1], 2, 3, .55, 12)),
  layer('pad', 'pad', 8 * BAR, .35, hold(THEME, .5)),
  layer('bass', 'bass', 8 * BAR, .4, roots(THEME, -12, 8)),
  layer('bell', 'bell', 8 * BAR, .45, [[0, 74, 16, .8], [4 * BAR, 69, 16, .7]]),
] };

const crackle = (() => { const r = lcg(7); const out: Note[] = []; for (let s = 0; s < 4 * BAR; s++) if (r() < .32) out.push([s, 90 + Math.floor(r() * 12), 1, .25 + r() * .5]); return out; })();
const hubLayers: Layer[] = [
  layer('lute', 'lute', 8 * BAR, .5, arp(THEME, [0, 2, 1, 3, 2, 1], 4, 5, .5, 12)),
  layer('pad', 'pad', 8 * BAR, .4, hold(THEME, .5, -12)),
  layer('bass', 'bass', 8 * BAR, .35, roots(THEME, -12)),
  layer('fire', 'crackle', 4 * BAR, .5, crackle),
  layer('bell', 'bell', 8 * BAR, .3, [[0, 62, 16, .6]]),
];
const hub: Track = { id: 'hub', family: 'hub', bpm: 70, loop: true, steps: 8 * BAR, layers: hubLayers };
/** The map and the chapter dossier: the hub with a march on the snare. */
const map: Track = { id: 'map', family: 'hub', bpm: 70, loop: true, steps: 8 * BAR, layers: [...hubLayers,
  layer('march', 'brush', BAR, .55, hits(1, [0, 6, 8, 12, 14, 15], 0, 1, [.8, .45, .7, .6, .4, .5])),
  layer('march-kick', 'kick', BAR, .4, hits(1, [0, 8], 36, 2, .7)),
] };

// ── Battles: one per act, a bass ostinato over i · VI · VII · i, percussion after FIGHT!, more drums from phase 2, the lead in phase 3. ──
type Act = { id: TrackId; bpm: number; root: number; minor: number[]; ostinato: number[]; lead: [number, number, number][]; voice: Voice };
/** Scale degrees (semitones over the root) of the four bars: i, VI, VII, i. */
const PROGRESSION = [0, 8, 10, 0];
function battle({ id, bpm, root, minor, ostinato, lead, voice }: Act): Track {
  const bars = 4, steps = bars * BAR;
  const chords = PROGRESSION.map(p => minor.map(m => root + 12 + p + m));
  const bass: Note[] = PROGRESSION.flatMap((p, bar) => ostinato.map((o, i) => [bar * BAR + i * (BAR / ostinato.length), root + p + o, BAR / ostinato.length, i % 4 === 0 ? .9 : .6] as Note));
  return { id, family: id, bpm, loop: true, steps, layers: [
    layer('bass', 'bass', steps, .55, bass),
    layer('pad', 'pad', steps, .3, hold(chords, .45)),
    layer('pluck', voice, steps, .35, arp(chords, [0, 1, 2, 1], 4, 2, .5, 12)),
    layer('hat', 'brush', BAR, .45, hits(1, [2, 6, 10, 14], 0, 1, [.5, .7]), { fight: true }),
    layer('kick', 'kick', BAR, .6, hits(1, [0, 8], 36, 2, .9), { fight: true }),
    layer('drums', 'kick', BAR, .45, hits(1, [3, 10, 11], 33, 2, [.6, .7, .5]), { fight: true, minPhase: 2 }),
    layer('snare', 'brush', BAR, .55, hits(1, [4, 12], 0, 3, .9), { fight: true, minPhase: 2 }),
    layer('lead', 'lead', steps, .4, line(lead.map(([s, m, l]) => [s, root + 24 + m, l]), .7), { fight: true, minPhase: 3 }),
  ] };
}
const AEOLIAN = [0, 3, 7], PHRYGIAN = [0, 1, 7], HARMONIC = [0, 3, 7, 11];
const acts: Track[] = [
  battle({ id: 'battle-act1', bpm: 112, root: 40, minor: AEOLIAN, voice: 'lute', ostinato: [0, 0, 7, 0, 12, 0, 7, 10],
    lead: [[0, 7, 4], [4, 10, 2], [6, 12, 6], [16, 8, 6], [24, 7, 8], [32, 10, 4], [36, 12, 4], [40, 15, 8], [48, 12, 6], [56, 7, 8]] }),
  battle({ id: 'battle-act2', bpm: 116, root: 38, minor: PHRYGIAN, voice: 'horn', ostinato: [0, 1, 0, 7, 0, 1, 12, 7],
    lead: [[0, 12, 6], [6, 13, 2], [8, 12, 8], [16, 8, 8], [24, 7, 8], [32, 13, 6], [38, 12, 2], [40, 10, 8], [48, 7, 16]] }),
  battle({ id: 'battle-act3', bpm: 120, root: 47, minor: AEOLIAN, voice: 'bell', ostinato: [0, 7, 12, 7, 0, 7, 15, 7],
    lead: [[0, 15, 4], [4, 14, 4], [8, 12, 8], [16, 10, 4], [20, 8, 4], [24, 7, 8], [32, 15, 4], [36, 17, 4], [40, 19, 8], [48, 12, 16]] }),
  battle({ id: 'battle-act4', bpm: 128, root: 36, minor: HARMONIC, voice: 'horn', ostinato: [0, 12, 0, 11, 0, 12, 7, 12],
    lead: [[0, 12, 4], [4, 11, 4], [8, 12, 4], [12, 15, 4], [16, 20, 8], [24, 19, 8], [32, 15, 4], [36, 14, 4], [40, 12, 8], [48, 11, 8], [56, 12, 8]] }),
];

// ── The Undercroft: a drone, water drips and a low bell; percussion only in a fight. ──
const drips = (() => { const r = lcg(31); const out: Note[] = []; for (let s = 0; s < 8 * BAR; s++) if (r() < .09) out.push([s, 84 + Math.floor(r() * 12), 1, .4 + r() * .5]); return out; })();
const crypt: Track = { id: 'crypt', family: 'crypt', bpm: 64, loop: true, steps: 8 * BAR, layers: [
  layer('drone', 'pad', 8 * BAR, .5, [[0, 33, 4 * BAR, .7], [0, 40, 4 * BAR, .5], [4 * BAR, 34, 4 * BAR, .7], [4 * BAR, 41, 4 * BAR, .5]]),
  layer('drips', 'drip', 8 * BAR, .45, drips),
  layer('bell', 'bell', 8 * BAR, .35, [[0, 57, 16, .6], [3 * BAR, 58, 16, .5], [6 * BAR, 52, 16, .55]]),
  layer('pulse', 'bass', 2 * BAR, .45, hits(2, [0, 6], 33, 4, [.8, .5]), { fight: true }),
  layer('kick', 'kick', BAR, .5, hits(1, [0, 10], 33, 2, .8), { fight: true }),
  layer('hat', 'brush', BAR, .35, hits(1, [4, 12, 14], 0, 1, [.6, .4, .3]), { fight: true, minPhase: 2 }),
  layer('lead', 'lead', 8 * BAR, .35, line([[0, 69, 8], [8, 70, 8], [16, 69, 16], [32, 65, 8], [40, 64, 8], [48, 57, 16], [64, 69, 8], [72, 72, 8], [80, 70, 16], [96, 69, 32]], .6), { fight: true, minPhase: 3 }),
] };

// ── The Bell Trials: the theme in D minor (Dm · B♭ · C · Dm), quicker every three floors. ──
const TRIAL_CHORDS = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [50, 53, 57]];
const trial: Track = { id: 'trial', family: 'trial', bpm: TRIAL_BPM, loop: true, steps: 4 * BAR, layers: [
  layer('lute', 'lute', 4 * BAR, .45, arp(TRIAL_CHORDS, [0, 1, 2, 3, 2, 1, 0, 1], 2, 2, .5, 12)),
  layer('bass', 'bass', 4 * BAR, .5, roots(TRIAL_CHORDS, -12, 4, .85)),
  layer('pad', 'pad', 4 * BAR, .3, hold(TRIAL_CHORDS, .45)),
  layer('kick', 'kick', BAR, .55, hits(1, [0, 8, 11], 36, 2, [.9, .8, .5]), { fight: true }),
  layer('hat', 'brush', BAR, .4, hits(1, [2, 6, 10, 14], 0, 1, [.5, .7]), { fight: true }),
  layer('snare', 'brush', BAR, .5, hits(1, [4, 12], 0, 3, .9), { fight: true, minPhase: 2 }),
  layer('bell', 'bell', 4 * BAR, .4, [[0, 74, 8, .7], [2 * BAR, 72, 8, .6]], { fight: true, minPhase: 2 }),
  layer('lead', 'lead', 4 * BAR, .4, line([[0, 74, 4], [4, 77, 4], [8, 76, 8], [16, 74, 4], [20, 70, 4], [24, 72, 8], [32, 69, 4], [36, 72, 4], [40, 76, 8], [48, 74, 16]], .7), { fight: true, minPhase: 3 }),
] };

// ── Raids: the hunt, horns over a galloping bass. ──
const HUNT_CHORDS = [[43, 46, 50], [39, 43, 46], [41, 45, 48], [43, 46, 50]];
const hunt: Track = { id: 'hunt', family: 'hunt', bpm: 108, loop: true, steps: 4 * BAR, layers: [
  layer('horns', 'horn', 4 * BAR, .45, HUNT_CHORDS.flatMap((c, bar) => [[bar * BAR, c[0] + 12, 6, .8], [bar * BAR + 6, c[1] + 12, 2, .6], [bar * BAR + 8, c[2] + 12, 8, .7]] as Note[])),
  layer('bass', 'bass', BAR, .5, hits(1, [0, 3, 4, 8, 11, 12], 43, 1, [.9, .5, .7, .9, .5, .7])),
  layer('pad', 'pad', 4 * BAR, .25, hold(HUNT_CHORDS, .4)),
  layer('kick', 'kick', BAR, .55, hits(1, [0, 4, 8, 12], 36, 2, [.9, .6]), { fight: true }),
  layer('hat', 'brush', BAR, .4, hits(1, [2, 6, 10, 14], 0, 1, .6), { fight: true }),
  layer('drums', 'kick', BAR, .45, hits(1, [6, 7, 14, 15], 31, 1, [.6, .8]), { fight: true, minPhase: 2 }),
  layer('call', 'horn', 4 * BAR, .45, line([[0, 67, 4], [4, 70, 4], [8, 74, 8], [16, 72, 4], [20, 70, 4], [24, 67, 8], [32, 70, 4], [36, 74, 4], [40, 79, 8], [48, 74, 16]], .7), { fight: true, minPhase: 3 }),
] };

// ── Stings: a two-bar victory flourish; the defeat toll, then the hub softly. ──
const sting: Track = { id: 'sting-win', family: 'sting-win', bpm: 120, loop: false, steps: 2 * BAR, layers: [
  layer('lute', 'lute', 2 * BAR, .6, line([[0, 62, 2], [2, 66, 2], [4, 69, 2], [6, 74, 4], [10, 73, 2], [12, 74, 4], [16, 78, 16]], .8)),
  layer('bass', 'bass', 2 * BAR, .5, [[0, 38, 8, .9], [8, 45, 8, .7], [16, 38, 16, .9]]),
  layer('pad', 'pad', 2 * BAR, .35, [[0, 50, 16, .5], [0, 54, 16, .5], [0, 57, 16, .5], [16, 50, 16, .5], [16, 54, 16, .5], [16, 57, 16, .5]]),
  layer('bell', 'bell', 2 * BAR, .5, [[16, 86, 16, .8]]),
] };
const toll: Track = { id: 'bell-toll', family: 'bell-toll', bpm: 72, loop: false, steps: 2 * BAR, next: { track: 'hub', gap: 2, gain: .5 }, layers: [
  layer('bell', 'bell', 2 * BAR, .7, [[0, 50, 16, 1], [10, 50, 16, .8], [20, 45, 12, .9]]),
  layer('pad', 'pad', 2 * BAR, .25, [[0, 38, 32, .6], [0, 45, 32, .4]]),
] };

export const TRACKS: Record<TrackId, Track> = Object.fromEntries([title, hub, map, ...acts, crypt, trial, hunt, sting, toll].map(track => [track.id, track])) as Record<TrackId, Track>;

/** What plays: a track (or silence), whether its fight layers play, the boss phase, a tempo override (the Bell Trials), `duck` (a paused fight
 *  or a dialog over it: 25% and low-passed) and `muffle` (the ready window: low-passed). */
export interface MusicCue { track: TrackId | null; fight: boolean; phase: number; bpm?: number; duck: boolean; muffle: boolean }
export type MusicMode = 'adventure' | 'raid' | 'endless' | 'dungeon';
export type MusicStatus = 'ready' | 'fighting' | 'paused' | 'victory' | 'defeat';
/** The screen as music sees it (main.ts builds it): a story scene over everything, then the title, a result, a battle, the town route. */
export interface MusicState {
  scene?: 'intro' | 'story';
  title?: boolean;
  result?: 'victory' | 'defeat' | 'wave';
  battle?: { mode: MusicMode; chapter: number; floor: number; status: MusicStatus; phase: number; dimmed?: boolean };
  route?: string;
}
export const SILENT: MusicCue = { track: null, fight: false, phase: 1, duck: false, muffle: false };
const cue = (track: TrackId, extra: Partial<MusicCue> = {}): MusicCue => ({ ...SILENT, track, ...extra });
/** Routes that play the map's march: the world map and a chapter dossier. */
export const MARCH_ROUTES: readonly string[] = ['campaign', 'mission'];
export const actTrack = (chapter: number): TrackId => `battle-act${Math.min(4, Math.max(1, Math.ceil(chapter / 4)))}` as TrackId;
export function battleTrack(mode: MusicMode, chapter: number): TrackId { return mode === 'raid' ? 'hunt' : mode === 'endless' ? 'trial' : mode === 'dungeon' ? 'crypt' : actTrack(chapter); }

export function musicFor(state: MusicState): MusicCue {
  if (state.scene === 'intro') return cue('title');
  if (state.scene === 'story') return cue('hub', { duck: true });
  if (state.title) return cue('title');
  const b = state.battle;
  if (state.result === 'victory') return cue('sting-win');
  if (state.result === 'defeat') return cue('bell-toll');
  if (b) {
    const track = battleTrack(b.mode, b.chapter), fight = b.status !== 'ready', bpm = b.mode === 'endless' ? trialBpm(b.floor) : undefined;
    // A won wave's card keeps the battle under it, ducked like a pause; the next wave goes on in place.
    const duck = state.result === 'wave' || b.status === 'paused' || Boolean(b.dimmed);
    return cue(track, { fight, phase: fight ? Math.max(1, Math.min(3, b.phase)) : 1, ...(bpm ? { bpm } : {}), duck, muffle: !fight });
  }
  if (state.route === 'dungeon') return cue('crypt');
  if (state.route && MARCH_ROUTES.includes(state.route)) return cue('map');
  return state.route ? cue('hub') : SILENT;
}
/** A layer plays under a cue: fight layers only after FIGHT!, phase layers from their phase on. */
export const layerOn = (l: Layer, c: Pick<MusicCue, 'fight' | 'phase'>) => (!l.when?.fight || c.fight) && (l.when?.minPhase ?? 1) <= (c.fight ? c.phase : 1);
