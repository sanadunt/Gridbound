import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Sound } from '../src/audio/sound';

/** A minimal Web Audio stand-in: counts the buffers and sources a cue creates and records suspend/resume. */
function fakeContext(state: AudioContextState = 'running') {
  const log = { buffers: 0, starts: [] as number[][], suspend: 0, resume: 0 };
  const node = () => ({ connect() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '', start() {}, stop() {} });
  const ctx = {
    state, sampleRate: 8000, currentTime: 0, destination: {},
    createBuffer: (_channels: number, length: number, sampleRate: number) => { log.buffers++; const data = new Float32Array(length); return { sampleRate, duration: length / sampleRate, getChannelData: () => data }; },
    createBufferSource: () => ({ ...node(), buffer: null, start: (...args: number[]) => log.starts.push(args) }),
    createBiquadFilter: node, createGain: node, createOscillator: node,
    suspend: async () => { log.suspend++; ctx.state = 'suspended'; }, resume: async () => { log.resume++; ctx.state = 'running'; },
  };
  return { ctx, log };
}
const withContext = (sound: Sound, ctx: unknown) => { (sound as unknown as { ctx: unknown }).ctx = ctx; return sound; };

test('noise bursts share one cached buffer and play a slice of it', () => {
  const { ctx, log } = fakeContext(), sound = withContext(new Sound(), ctx);
  for (let i = 0; i < 5; i++) sound.play('move');
  sound.play('hurt');
  assert.equal(log.buffers, 1, 'one noise buffer per context, not one per burst');
  assert.equal(log.starts.length, 6);
  for (const [, offset, length] of log.starts) assert.ok(offset >= 0 && length > 0 && offset + length <= 1 + 1e-9, 'each burst plays a slice inside the buffer');
});

test('a hidden page suspends a running AudioContext and coming back resumes only what it suspended', async () => {
  const { ctx, log } = fakeContext(), sound = withContext(new Sound(), ctx);
  sound.visibility(true);
  assert.equal(log.suspend, 1);
  sound.visibility(false);
  assert.equal(log.resume, 1);
  // A context that was never running (muted, never unlocked) is left alone on both edges.
  const idle = fakeContext('suspended'), quiet = withContext(new Sound(), idle.ctx);
  quiet.visibility(true); quiet.visibility(false);
  assert.deepEqual([idle.log.suspend, idle.log.resume], [0, 0]);
});

test('pixel-font readouts in result and Undercroft screens are at least 10px', () => {
  for (const file of ['src/styles/result.css', 'src/styles/dungeon.css']) {
    for (const rule of readFileSync(file, 'utf8').split('\n').filter(line => line.includes('var(--pixel)'))) {
      const size = rule.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
      if (size) assert.ok(Number(size[1]) >= 10, `${file}: ${rule.trim().slice(0, 80)}`);
    }
  }
});
