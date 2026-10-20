import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACKS, TRACK_IDS, VOICES, MARCH_ROUTES, SILENT, TRIAL_BPM, TRIAL_BPM_CAP, musicFor, trialBpm, layerOn, type MusicState } from '../src/audio/tracks';
import { Sound } from '../src/audio/sound';
import { Music, MUSIC_VOLUME, DUCK_LEVEL } from '../src/audio/music';

const fight = (mode: 'adventure' | 'raid' | 'endless' | 'dungeon', chapter: number, extra: Partial<NonNullable<MusicState['battle']>> = {}): MusicState => ({ battle: { mode, chapter, floor: chapter, status: 'fighting', phase: 1, ...extra } });

test('musicFor: title, scenes, town routes, the map march and the Undercroft', () => {
  assert.equal(musicFor({ title: true }).track, 'title');
  assert.deepEqual(musicFor({ scene: 'intro', title: true }), { ...SILENT, track: 'title' }, 'a chapter intro plays the title theme, over the title too');
  assert.deepEqual(musicFor({ scene: 'story', route: 'camp' }), { ...SILENT, track: 'hub', duck: true }, 'other scenes duck the hub');
  for (const route of ['camp', 'party', 'party-advanced', 'more', 'quests', 'bestiary', 'raid', 'endless', 'challenge-shop']) assert.equal(musicFor({ route }).track, 'hub', route);
  for (const route of MARCH_ROUTES) assert.equal(musicFor({ route }).track, 'map', route);
  assert.equal(musicFor({ route: 'dungeon' }).track, 'crypt');
  assert.equal(musicFor({ route: 'dungeon' }).fight, false, 'the Undercroft route plays no percussion');
  assert.deepEqual(musicFor({}), SILENT);
});

test('musicFor: one battle track per act, the raid hunt, the crypt and the quickening Bell Trials', () => {
  for (let chapter = 1; chapter <= 16; chapter++) assert.equal(musicFor(fight('adventure', chapter)).track, `battle-act${Math.ceil(chapter / 4)}`, `chapter ${chapter}`);
  assert.equal(musicFor(fight('raid', 3)).track, 'hunt');
  assert.equal(musicFor(fight('dungeon', 2)).track, 'crypt');
  assert.equal(musicFor(fight('dungeon', 2)).fight, true);
  assert.equal(musicFor(fight('endless', 1)).track, 'trial');
  assert.deepEqual([1, 2, 3, 4, 6, 7, 10, 30, 100].map(floor => musicFor(fight('endless', floor)).bpm), [120, 120, 120, 124, 124, 128, 132, TRIAL_BPM + TRIAL_BPM_CAP, TRIAL_BPM + TRIAL_BPM_CAP]);
  assert.equal(trialBpm(4) - trialBpm(1), 4, '+4 bpm every three floors');
  assert.equal(musicFor(fight('adventure', 1)).bpm, undefined, 'only the Bell Trials override the tempo');
});

test('musicFor: ready window muffled, phases add layers, pause and dialogs duck, results play their stings', () => {
  const ready = musicFor(fight('adventure', 5, { status: 'ready', phase: 1 }));
  assert.deepEqual(ready, { ...SILENT, track: 'battle-act2', muffle: true }, 'the ready window: no fight layers, low-passed');
  assert.deepEqual(musicFor(fight('adventure', 5, { phase: 2 })), { ...SILENT, track: 'battle-act2', fight: true, phase: 2 });
  assert.equal(musicFor(fight('adventure', 5, { phase: 9 })).phase, 3, 'phase clamps to 3');
  assert.equal(musicFor(fight('adventure', 5, { status: 'paused' })).duck, true);
  assert.equal(musicFor(fight('adventure', 5, { dimmed: true })).duck, true, 'a dialog or the Status view over a fight');
  assert.equal(musicFor({ ...fight('adventure', 5, { status: 'victory' }) }).duck, false, 'a dying boss keeps the battle track');
  assert.equal(musicFor({ result: 'victory', ...fight('adventure', 5, { status: 'victory' }) }).track, 'sting-win');
  assert.equal(musicFor({ result: 'defeat', ...fight('raid', 5, { status: 'defeat' }) }).track, 'bell-toll');
  const wave = musicFor({ result: 'wave', ...fight('adventure', 5, { status: 'victory', phase: 3 }) });
  assert.deepEqual([wave.track, wave.duck, wave.fight], ['battle-act2', true, true], 'a won wave keeps its battle under the card, ducked');
  // Pure: the same state gives the same cue.
  assert.deepEqual(musicFor(fight('endless', 7, { phase: 2 })), musicFor(fight('endless', 7, { phase: 2 })));
});

test('tracks are well-formed data', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), [...TRACK_IDS].sort());
  for (const id of TRACK_IDS) {
    const track = TRACKS[id];
    assert.equal(track.id, id);
    assert.ok(track.bpm >= 40 && track.bpm <= 200, `${id} bpm`);
    assert.ok(track.steps > 0 && track.steps % 16 === 0, `${id} whole bars`);
    assert.equal(new Set(track.layers.map(l => l.name)).size, track.layers.length, `${id} layer names are unique`);
    if (track.next) assert.ok(TRACKS[track.next.track] && !track.loop && track.next.gap >= 0 && track.next.gain > 0 && track.next.gain <= 1, `${id} hands over`);
    for (const layer of track.layers) {
      assert.ok(VOICES.includes(layer.voice), `${id}/${layer.name} voice`);
      assert.ok(layer.steps > 0 && track.steps % layer.steps === 0, `${id}/${layer.name} loops inside the track`);
      assert.ok(layer.gain > 0 && layer.gain <= 1, `${id}/${layer.name} gain`);
      assert.ok(layer.notes.length > 0, `${id}/${layer.name} has notes`);
      const noise = layer.voice === 'brush' || layer.voice === 'crackle';
      for (const [step, midi, len, vel] of layer.notes) {
        assert.ok(Number.isInteger(step) && step >= 0 && step < layer.steps, `${id}/${layer.name} step ${step}`);
        assert.ok(noise ? midi >= 0 && midi <= 127 : midi >= 24 && midi <= 108, `${id}/${layer.name} midi ${midi}`);
        assert.ok(len > 0 && vel > 0 && vel <= 1, `${id}/${layer.name} len/vel`);
      }
    }
  }
  // The map is the hub plus its march: one family, so the hub never restarts between routes.
  assert.equal(TRACKS.map.family, TRACKS.hub.family);
  assert.equal(TRACKS.map.bpm, TRACKS.hub.bpm);
  for (const l of TRACKS.hub.layers) assert.ok(TRACKS.map.layers.includes(l), `map keeps the hub's ${l.name}`);
  assert.ok(TRACKS.map.layers.some(l => l.name === 'march'));
  // Every fight track: something before FIGHT!, percussion after it, more in phase 2, the lead in phase 3.
  for (const id of ['battle-act1', 'battle-act2', 'battle-act3', 'battle-act4', 'crypt', 'trial', 'hunt'] as const) {
    const layers = TRACKS[id].layers, count = (c: { fight: boolean; phase: number }) => layers.filter(l => layerOn(l, c)).length;
    assert.ok(count({ fight: false, phase: 1 }) > 0 && count({ fight: true, phase: 1 }) > count({ fight: false, phase: 1 }) && count({ fight: true, phase: 2 }) > count({ fight: true, phase: 1 }) && count({ fight: true, phase: 3 }) > count({ fight: true, phase: 2 }), `${id} grows by phase`);
  }
  assert.equal(TRACKS['sting-win'].loop, false);
  assert.equal(TRACKS['sting-win'].steps, 32, 'the victory sting is two bars');
  assert.equal(TRACKS['bell-toll'].next?.track, 'hub');
  assert.equal(TRACKS['bell-toll'].next?.gap, 2, 'two seconds of silence, then the hub softly');
});

test('tracks and musicFor are deterministic: no randomness or clock in the data', () => {
  const source = readFileSync(new URL('../src/audio/tracks.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.|performance\.now/);
  assert.equal(JSON.stringify(TRACKS), JSON.stringify(TRACKS), 'stable serialisation');
});

// ── A stub Web Audio: counts contexts and started oscillators, keeps an audio clock on real time. ──
class Param { value = 0; setValueAtTime(v: number) { this.value = v; return this; } linearRampToValueAtTime(v: number) { this.value = v; return this; } exponentialRampToValueAtTime(v: number) { this.value = v; return this; } setTargetAtTime(v: number) { this.value = v; return this; } cancelScheduledValues() { return this; } }
class Node { connect() {} disconnect() {} }
const audio = { made: 0, osc: 0 };
class StubContext {
  state: 'running' | 'suspended' = 'running'; sampleRate = 8000; destination = new Node(); private t0 = performance.now();
  constructor() { audio.made++; }
  get currentTime() { return this.state === 'running' ? (performance.now() - this.t0) / 1000 : 0; }
  createGain() { return Object.assign(new Node(), { gain: new Param() }); }
  createBiquadFilter() { return Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param() }); }
  createOscillator() { return Object.assign(new Node(), { type: 'sine', frequency: new Param(), detune: new Param(), start: () => { audio.osc++; }, stop() {} }); }
  createBufferSource() { return Object.assign(new Node(), { buffer: null, start() {} }); }
  createBuffer(_c: number, length: number, sampleRate: number) { const data = new Float32Array(length); return { sampleRate, duration: length / sampleRate, getChannelData: () => data }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  addEventListener() {}
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test('no AudioContext while Sound effects and Music are both off; music plays on the shared one and stops when hidden', async () => {
  (globalThis as unknown as { window: unknown }).window = { AudioContext: StubContext };
  audio.made = audio.osc = 0;
  const sound = new Sound();
  sound.enabled = false; sound.music = false;
  const music = new Music(sound);
  music.enabled = false;
  sound.unlock();
  music.set(musicFor({ route: 'camp' }));
  sound.play('tap');
  await sleep(30);
  assert.equal(audio.made, 0, 'a muted start never creates a context (P11)');
  assert.equal(sound.context(), undefined);
  // Music on, Sound effects still off: the first activation creates the one shared context and the hub plays on it.
  sound.music = true; music.enabled = true;
  sound.unlock();
  assert.equal(audio.made, 1);
  music.set(musicFor({ route: 'camp' }));
  await sleep(250);
  assert.ok(audio.osc > 0, 'the hub schedules notes');
  assert.equal(music.state().playing, 'hub');
  assert.equal(music.state().scheduling, true);
  // The map keeps the hub going (same family): in place, no restart.
  music.set(musicFor({ route: 'campaign' }));
  assert.equal(music.state().playing, 'map');
  // A cue with Sound effects off plays nothing and makes no second context.
  const before = audio.osc; sound.play('tap'); assert.equal(audio.osc, before, 'no cue while Sound effects are off'); assert.equal(audio.made, 1);
  // Hidden: the scheduler stops; shown again it goes on.
  music.visibility(true);
  assert.equal(music.state().scheduling, false);
  music.visibility(false);
  assert.equal(music.state().scheduling, true);
  // A paused fight ducks to 25%.
  music.set(musicFor(fight('adventure', 1, { status: 'paused' })));
  assert.equal(music.state().duck, true);
  assert.equal(MUSIC_VOLUME * DUCK_LEVEL < MUSIC_VOLUME, true);
  // Both off again: the context is suspended and no new one is made.
  music.enabled = false; sound.music = false;
  await sleep(20);
  assert.equal(sound.context(), undefined);
  sound.unlock();
  assert.equal(audio.made, 1);
  music.visibility(true);
});
