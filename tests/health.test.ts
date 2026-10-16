import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

/** Every style rule of a stylesheet with the at-rule blocks around it (comments stripped; a brace-depth scan, no CSS parser). */
function cssRules(file: string) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: { selector: string; body: string; within: string[] }[] = [], stack: string[] = [];
  let prelude = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const head = prelude.trim(); prelude = '';
      if (head.startsWith('@')) { stack.push(head); continue; }
      const end = css.indexOf('}', i);
      rules.push({ selector: head, body: css.slice(i + 1, end), within: [...stack] });
      i = end;
    } else if (c === '}') { stack.pop(); prelude = ''; }
    else if (c === ';' && !stack.length) prelude = '';
    else prelude += c;
  }
  return rules;
}
const STYLES = readdirSync('src/styles').filter(name => name.endsWith('.css')).map(name => `src/styles/${name}`);

test('phone shell: the root (not body) stops overscroll, sizes never use vh, hover lives inside (hover: hover)', () => {
  assert.ok(STYLES.length >= 7 && STYLES.includes('src/styles/base.css'), 'every stylesheet is checked');
  const base = cssRules('src/styles/base.css');
  assert.ok(base.some(r => r.selector.split(',').map(s => s.trim()).includes('html') && /overscroll-behavior:\s*none/.test(r.body) && !r.within.length), 'html { overscroll-behavior: none } (Android pull-to-refresh follows the root)');
  assert.ok(base.some(r => r.selector.trim() === 'html' && /touch-action:\s*manipulation/.test(r.body) && /text-size-adjust:\s*100%/.test(r.body)), 'html { touch-action: manipulation; text-size-adjust: 100% }');
  for (const file of STYLES) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /\b\d+(\.\d+)?vh\b/, `${file}: vh is the large viewport on phones; use dvh, svh, % or container units`);
    for (const rule of cssRules(file).filter(r => r.selector.includes(':hover'))) assert.ok(rule.within.some(at => /^@media[^{]*\(hover:\s*hover\)/.test(at)), `${file}: ${rule.selector.slice(0, 80)} sticks after a tap unless it is inside @media (hover: hover)`);
  }
});

test('phone shell: safe-area insets pad the game, form controls are 16px on a coarse pointer, the viewport stays zoomable', () => {
  const base = cssRules('src/styles/base.css');
  const root = base.find(r => r.selector === ':root')!.body;
  for (const side of ['top', 'right', 'bottom', 'left']) assert.match(root, new RegExp(`--safe-${side[0]}:\\s*env\\(safe-area-inset-${side},\\s*0px\\)`), `:root --safe-${side[0]}`);
  assert.ok(base.some(r => r.selector === '#app' && /padding:\s*var\(--safe-t\)\s+var\(--inset-r\)\s+var\(--safe-b\)\s+var\(--inset-l\)/.test(r.body)), '#app is padded by the insets');
  const coarse = base.filter(r => r.within.some(at => /\(pointer:\s*coarse\)/.test(at)) && /font-size:\s*16px/.test(r.body)).map(r => r.selector);
  for (const control of ['select', 'textarea', '.backup-text', 'input:not(']) assert.ok(coarse.some(selector => selector.includes(control)), `(pointer: coarse) ${control} is 16px (iOS Safari zooms on a smaller field)`);
  assert.ok(base.some(r => r.selector.includes('#app input') && /user-select:\s*text/.test(r.body)), 'text fields stay selectable under #app { user-select: none }');
  const viewport = readFileSync('index.html', 'utf8').match(/name="viewport" content="([^"]+)"/)![1];
  assert.equal(viewport, 'width=device-width,initial-scale=1,viewport-fit=cover', 'L1: no maximum-scale or user-scalable=no (pinch-zoom stays possible)');
});
