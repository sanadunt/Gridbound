import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Sound, SOUND_IDLE_MS } from '../src/audio/sound';

/** A minimal Web Audio stand-in: counts the buffers and sources a cue creates and records suspend/resume. */
function fakeContext(state: AudioContextState = 'running') {
  const log = { buffers: 0, starts: [] as number[][], suspend: 0, resume: 0 };
  const node = () => ({ connect() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '', start() {}, stop() {} });
  const ctx = {
    state, sampleRate: 8000, currentTime: 0, destination: {},
    createBuffer: (_channels: number, length: number, sampleRate: number) => { log.buffers++; const data = new Float32Array(length); return { sampleRate, duration: length / sampleRate, getChannelData: () => data }; },
    createBufferSource: () => ({ ...node(), buffer: null, start: (...args: number[]) => log.starts.push(args) }),
    createBiquadFilter: node, createGain: node, createOscillator: node,
    suspend: async () => { log.suspend++; ctx.state = 'suspended'; }, resume: async () => { log.resume++; await null; ctx.state = 'running'; },
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

test('P11/plat-07: iOS\'s interrupted context comes back on the next tap and on return; Sound off never creates a context', async () => {
  const tapped = fakeContext('interrupted' as AudioContextState), sound = withContext(new Sound(), tapped.ctx);
  sound.unlock(); await Promise.resolve();
  assert.equal(tapped.log.resume, 1, 'a tap resumes an interrupted context');
  const back = fakeContext('interrupted' as AudioContextState), returning = withContext(new Sound(), back.ctx);
  returning.visibility(false); assert.equal(back.log.resume, 1, 'coming back to the page resumes it too');
  const g = globalThis as unknown as { window?: unknown }, saved = g.window;
  let made = 0;
  g.window = { AudioContext: class { state = 'running'; constructor() { made++; } resume() { return Promise.resolve(); } } };
  try {
    const off = new Sound(); off.enabled = false; off.unlock(); off.play('cursor');
    assert.equal(made, 0, 'no AudioContext while Sound is off');
    const on = new Sound(); on.unlock(); assert.equal(made, 1, 'Sound on creates one at the first activation');
  } finally { g.window = saved; }
  // Turning Sound off suspends a running context at once.
  const running = fakeContext(), muted = withContext(new Sound(), running.ctx);
  muted.enabled = false; assert.equal(running.log.suspend, 1);
});

test('P11: a context is suspended after SOUND_IDLE_MS of silence, and the next cue resumes it and plays', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { ctx, log } = fakeContext(), sound = withContext(new Sound(), ctx);
  sound.play('move');
  const played = log.starts.length;
  t.mock.timers.tick(SOUND_IDLE_MS - 1); assert.equal(log.suspend, 0, 'not before the idle time');
  sound.play('move'); t.mock.timers.tick(SOUND_IDLE_MS - 1); assert.equal(log.suspend, 0, 'a cue starts the idle time again');
  t.mock.timers.tick(1); assert.equal(log.suspend, 1, 'silence suspends the context');
  sound.play('move'); sound.play('move');
  assert.equal(log.starts.length, played + 1, 'the cue that wakes it waits for the resume; the one meanwhile is dropped');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(log.resume, 1); assert.equal(log.starts.length, played + 2, 'the waking cue plays once the context runs');
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

/** T2: selectors allowed under the 12px text floor, each with its reason. A rule passes only when every selector of its list is allowed. */
const SMALL_TYPE: [selector: string, floor: number, why: string][] = [
  ['.menu-button[data-badge]', 10, 'the MENU count badge: digits in a dot (contract §3 badge floor)'],
  ['.spot-flag', 10, 'camp sign badges (a count, ! or NEW in a pill; a dot on a narrow map)'],
  ['.tab-new', 10, 'the NEW tag on a gate tab'],
  ['.boon-count-badge', 10, 'the boon tray count badge in battle'],
  ['.intent-chip small', 10, 'the counter family tag inside a threat chip'],
  ['.menu-badge', 10, 'the MENU entries\' count badge'],
  ['.town-sign', 11, 'camp signs: the map scales them with its width (cqw); 11px is their floor (TOWN goal 2), with a whole word per line'],
  ['.menu-item::before', 0, 'the ▶ cursor glyph'],
  ['details > summary::before', 0, 'the ▶ disclosure glyph'],
  ['.dungeon-rules summary::before', 0, 'the ▸ disclosure glyph'],
];
test('T1/T2: every stylesheet keeps text at 12px or more, the pixel font at 10px or more (badges and glyphs on the allowlist)', () => {
  const failures: string[] = [];
  for (const file of STYLES) for (const rule of cssRules(file)) {
    const size = rule.body.match(/font(?:-size)?:[^;]*?(?:clamp\(|max\()?(\d+(?:\.\d+)?)px/);
    if (!size) continue;
    const px = Number(size[1]), pixel = rule.body.includes('var(--pixel)');
    const allowed = rule.selector.split(',').map(s => s.trim()).map(s => SMALL_TYPE.find(([sel]) => s.includes(sel)));
    const floor = Math.min(pixel ? 10 : 12, allowed.every(Boolean) ? Math.max(...allowed.map(a => a![1])) : 12);
    if (px < floor) failures.push(`${file}: ${rule.selector.slice(0, 70)} is ${px}px${pixel ? ' in the pixel font' : ''} (floor ${floor}px)`);
  }
  assert.deepEqual(failures, []);
  for (const [selector, , why] of SMALL_TYPE) assert.ok(why && STYLES.some(file => readFileSync(file, 'utf8').includes(selector.split(' ')[0].replace(/::before|\[.*$/, ''))), `allowlist entry ${selector} still names a rule`);
});
test('T3: names wrap at word boundaries outside battle (no mid-word breaks on talent names or gate tabs; battle.css is BATTLE\'s, whose chip test is below)', () => {
  for (const file of STYLES.filter(f => !f.endsWith('battle.css'))) for (const rule of cssRules(file)) assert.doesNotMatch(rule.body, /overflow-wrap:\s*anywhere|word-break:\s*break-all/, `${file}: ${rule.selector.slice(0, 70)} breaks names mid-word`);
});

test('T1/T2 in battle: the chip and name tag keep whole labels', () => {
  const chip = cssRules('src/styles/battle.css').find(r => r.selector === '.unit-skill-name')!.body;
  assert.match(chip, /text-overflow:\s*clip/, 'T3: a skill chip never ends in an ellipsis (main.ts fitChip picks a label that fits)');
});

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

test('L6 portrait only: no landscape layout anywhere, one 600px column; the Turn card is the only landscape rule and matches ui/turn-card.ts', () => {
  const failures: string[] = [];
  for (const file of STYLES) {
    for (const rule of cssRules(file).filter(r => r.within.some(at => /orientation:\s*landscape/.test(at))))
      if (!rule.selector.split(',').every(s => s.includes('#turn-card') || s.includes('body.turn-up'))) failures.push(`${file}: ${rule.selector.slice(0, 70)}`);
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /--app-max|max-width:\s*min\(100vw,\s*1180px\)/, `${file}: the column never widens (one portrait column on every window)`);
    assert.doesNotMatch(css, /rotate-hint/, `${file}: the rotate hint is gone (the Turn card replaced it)`);
  }
  assert.deepEqual(failures, [], 'only the Turn card lives under (orientation: landscape)');
  const turn = cssRules('src/styles/base.css').filter(r => r.selector.includes('#turn-card') && r.within.length);
  const query = readFileSync('src/ui/turn-card.ts', 'utf8').match(/TURN_QUERY = '([^']+)'/)![1];
  assert.ok(turn.length && turn.every(r => r.within.some(at => at.includes(query))), 'the CSS shows the card under the same query that pauses the fight');
  assert.match(cssRules('src/styles/base.css').find(r => r.selector === ':root')!.body, /--col:\s*600px/, 'the column is 600px');
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

test('C7: no unload handler anywhere (the back/forward cache stays usable); the page-hide path is pagehide/visibilitychange/freeze', () => {
  const files = readdirSync('src', { recursive: true }).map(String).filter(f => f.endsWith('.ts')).map(f => readFileSync(`src/${f}`, 'utf8'));
  for (const source of files) assert.doesNotMatch(source, /addEventListener\(\s*['"]unload['"]|\bonunload\s*=/, 'an unload handler makes the page ineligible for bfcache');
  const main = readFileSync('src/main.ts', 'utf8');
  for (const event of ['pagehide', 'freeze', 'visibilitychange']) assert.match(main, new RegExp(`addEventListener\\('${event}', pageHidden|'${event}'.*pageHidden|pageHidden\\(\\); else pageShown`), event);
});
