import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, TAP_CUT } from '../src/game/simulation';
import { COMBO_WINDOW, PERFECT_WINDOW, MERGE_WINDOW, KILL_CAM, LUNGE, cleanTap, newCombo, comboStep, comboAlive, comboTier, isPerfectGuard, mergeNumber, slowmoScale, lungeShare, lungeDone, dangerSide } from '../src/render/juice';

test('clean taps count a combo within the window; a later tap starts over', () => {
  let c = newCombo();
  for (let i = 0; i < 5; i++) c = comboStep(c, { at: i * (COMBO_WINDOW - .1), amount: TAP_CUT }).combo;
  assert.equal(c.count, 5); assert.equal(c.best, 5);
  const late = comboStep(c, { at: c.at + COMBO_WINDOW + .05, amount: TAP_CUT });
  assert.equal(late.combo.count, 1); assert.equal(late.combo.best, 5); assert.equal(late.event, 'up');
  assert.equal(comboAlive(c, c.at + COMBO_WINDOW), true); assert.equal(comboAlive(c, c.at + COMBO_WINDOW + .01), false);
});
test('a fatigued tap breaks the combo (TIRED) and keeps the best', () => {
  let c = newCombo();
  for (let i = 0; i < 4; i++) c = comboStep(c, { at: i * .3, amount: TAP_CUT + .2 }).combo;
  const tired = comboStep(c, { at: 1.3, amount: TAP_CUT * .5 });
  assert.equal(tired.event, 'tired'); assert.equal(tired.broke, true); assert.equal(tired.combo.count, 0); assert.equal(tired.combo.best, 4);
  assert.equal(comboStep(newCombo(), { at: 0, amount: TAP_CUT * .14 }).broke, false, 'nothing to break on a first tired tap');
  assert.equal(cleanTap(TAP_CUT), true); assert.equal(cleanTap(TAP_CUT * .94), false);
});
test('combo tiers at 10/25/50 announce themselves once', () => {
  assert.deepEqual([1, 9, 10, 24, 25, 49, 50, 99].map(comboTier), [0, 0, 1, 1, 2, 2, 3, 3]);
  let c = newCombo(); const events: string[] = [];
  for (let i = 0; i < 50; i++) { const s = comboStep(c, { at: i * .2, amount: TAP_CUT }); c = s.combo; events.push(s.event); }
  assert.deepEqual(events.map((e, i) => e === 'tier' ? i + 1 : 0).filter(Boolean), [10, 25, 50]);
});
test('the combo reads the simulation: real taps on a fresh hero are clean, a mashed hero tires and breaks it', () => {
  const b = new Battle('adventure', 1); b.start(); const id = b.living()[0].id; let c = newCombo(), tired = 0, best = 0;
  for (let i = 0; i < 60; i++) { b.tap(id); for (const e of b.drain()) if (e.type === 'tap') { const s = comboStep(c, { at: b.time, amount: e.amount! }); c = s.combo; if (s.event === 'tired') tired++; best = c.best; } b.tick(.12); }
  assert.ok(best >= 5, `a few clean taps first: ${best}`); assert.ok(tired > 0, 'mashing one hero tires it');
});
test('PERFECT guard: raised at most 0.6 s before the all-grid impact, never after it', () => {
  assert.equal(isPerfectGuard(10, 10.3), true); assert.equal(isPerfectGuard(10, 10 + PERFECT_WINDOW), true);
  assert.equal(isPerfectGuard(10, 10.61), false); assert.equal(isPerfectGuard(10.2, 10), false); assert.equal(isPerfectGuard(undefined, 10), false);
});
test('slow-mo starts at its scale and eases back to 1', () => {
  assert.equal(slowmoScale(0, .35, .25), .25); assert.equal(slowmoScale(.35, .35, .25), 1); assert.equal(slowmoScale(1, 0, .25), 1);
  let last = 0; for (let t = 0; t <= .35; t += .05) { const s = slowmoScale(t, .35, .25); assert.ok(s >= last && s <= 1); last = s; }
  assert.ok(KILL_CAM.seconds === .8 && KILL_CAM.scale === .2 && KILL_CAM.zoom === 1.15);
});
test('numbers from the same source within 0.5 s merge into one rising total', () => {
  const a = mergeNumber(undefined, { source: 1, at: 0, amount: 40 }); assert.equal(a.merged, false);
  const b = mergeNumber(a.number, { source: 1, at: .4, amount: 60 }); assert.equal(b.merged, true); assert.equal(b.number.total, 100);
  const c = mergeNumber(b.number, { source: 1, at: .4 + MERGE_WINDOW, amount: 5 }); assert.equal(c.merged, true, 'the window runs from the latest hit');
  assert.equal(mergeNumber(c.number, { source: 2, at: 1, amount: 5 }).merged, false, 'another source starts its own number');
  assert.equal(mergeNumber(c.number, { source: 1, at: 2, amount: 5 }).number.total, 5);
});
test('the lunge goes out with an overshoot and comes back within 230 ms', () => {
  assert.equal(lungeShare(0), 0); assert.ok(Math.abs(lungeShare(LUNGE.out) - 1) < 1e-9);
  assert.ok(Math.max(...[.03, .05, .07].map(lungeShare)) > 1, 'Back.easeOut overshoots'); assert.equal(lungeShare(LUNGE.out + LUNGE.back), 0);
  assert.equal(lungeDone(.229), false); assert.equal(lungeDone(.23), true); assert.ok(LUNGE.distance === 14 && LUNGE.strike === 1.5);
});
test('danger edges: the boss side for ground and all-grid hits, the marked hero\'s side for a mark', () => {
  assert.equal(dangerSide({ type: 'all' }), 'top'); assert.equal(dangerSide({ type: 'meteor', targetSlot: 3 }), 'top');
  assert.deepEqual([0, 4, 8].map(targetSlot => dangerSide({ type: 'target', targetSlot })), ['left', 'bottom', 'right']);
});
