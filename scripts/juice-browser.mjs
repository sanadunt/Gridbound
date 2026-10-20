// P2 battle juice on the iPhone 15 profile (real touches): a tap draws the charge ring and a cast lunges (a TAP-STRIKE when the tap
// empties the gauge), clean taps count a combo that a fatigued tap breaks, a Guard raised 0.3 s before an all-grid hit is PERFECT and
// slows the arena (and only then: a Guard 2 s early is BLOCKED), the boss's title card heads the ready window, Ninefold Dawn plays its
// cut-in, the last hit plays the kill cam, and reduced motion keeps the numbers and sounds but drops the shake and the slow motion.
// Reads the dev-only window.gridbound.scene.juiceLog. Screenshots in artifacts/juice/.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const OUT = 'artifacts/juice';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PHONE = { width: 393, height: 852, dpr: 3, ua: 'iphone', insets: { top: 59, bottom: 34 } };
const frames = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))';
const log = type => `(window.gridbound.scene.juiceLog || []).filter(e => e.type === ${JSON.stringify(type)})`;

for (const lang of ['en', 'id']) await withBrowser(async ({ send, wait, evaluate, screenshot, touch, errors }) => {
  await seedSave(send, ACT_TWO_SAVE, lang);
  await send('Page.navigate', { url });
  await wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 30000);
  await evaluate('document.fonts.ready');
  // J5: Chapter 1's ready window opens on the boss's title card: its name (not 'X appears!'), its epithet and the red rule.
  await evaluate("window.gridbound.boot('adventure', 1)");
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready" && !document.querySelector("#start-overlay").hidden');
  await evaluate(frames); await sleep(500);
  const card = await evaluate(`(() => { const b = window.gridbound.battle, title = document.querySelector('#ready-title'), rule = document.querySelector('#start-overlay .boss-plate-rule').getBoundingClientRect();
    return { card: document.querySelector('#start-overlay').classList.contains('boss-card'), title: title.textContent, name: b.enemyName, size: parseFloat(getComputedStyle(title).fontSize), epithet: document.querySelector('#ready-epithet').textContent, rule: rule.width,
      front: Math.min(...[...document.querySelectorAll('#unit-layer .unit-card')].map(c => c.getBoundingClientRect().top)), sheet: document.querySelector('#start-overlay .start-window').getBoundingClientRect().bottom }; })()`);
  assert.ok(card.card && card.title === card.name && card.size >= 16 && card.rule > 40, `the ready window is the boss's title card: ${JSON.stringify(card)}`);
  assert.ok(card.sheet <= card.front + 1, `the title card still ends above the front row (L10): ${JSON.stringify(card)}`);
  await screenshot(`${OUT}/ready-title-card-${lang}.png`);
  if (lang === 'id') { assert.deepEqual(errors, []); console.log('✓ id: the boss title card'); return; }

  await evaluate('document.querySelector("#start").click()');
  await wait('window.gridbound.battle.status === "fighting"');
  // The battle clock runs, but the boss is held off: no telegraphs, no claw, the heroes at full HP.
  const calm = `(() => { const b = window.gridbound.battle; b.threats = []; b.attackIn = 99; b.clawIn = 99; b.summonIn = 99; b.heroes.forEach(h => { h.hp = h.maxHp; h.fatigue = 0; h.lastTap = -99; h.moveLock = 0; }); })()`;
  await evaluate(calm);
  const hero = await evaluate('window.gridbound.battle.heroes.find(h => h.hp > 0 && h.slot < 3)?.id ?? window.gridbound.battle.heroes[0].id');
  const cardOf = id => `#unit-layer [data-hero="${id}"] .unit-tap`;

  // J2: a tap draws the ring (logged with the gauge's fill) on that hero, within a frame.
  await evaluate('window.gridbound.scene.juiceLog.length = 0');
  await evaluate(`window.gridbound.battle.hero(${hero}).remaining = window.gridbound.battle.hero(${hero}).total * .8`);
  await touch.tap(cardOf(hero)); await sleep(120);
  const ring = await evaluate(`${log('ring')}.filter(e => e.source === ${hero})`);
  assert.ok(ring.length === 1 && ring[0].value > 0 && ring[0].value < 1, `a tap draws the charge ring: ${JSON.stringify(ring)}`);
  // J1: a tap that empties the gauge casts in the same frame: a TAP-STRIKE lunge (1.5×).
  await evaluate(calm);
  await evaluate(`(() => { const h = window.gridbound.battle.hero(${hero}); h.remaining = .3; })()`);
  await touch.tap(cardOf(hero)); await sleep(200);
  const lunge = await evaluate(`${log('lunge')}.filter(e => e.source === ${hero})`), strike = await evaluate(`${log('strike')}.filter(e => e.source === ${hero}).length`);
  assert.ok(lunge.length >= 1 && lunge[0].value === 1.5 && strike >= 1, `the tap that empties the gauge is a TAP-STRIKE lunge: ${JSON.stringify(lunge)}`);
  // Every cast lunges, tapped or not.
  await evaluate(calm);
  const other = await evaluate(`window.gridbound.battle.heroes.find(h => h.id !== ${hero} && h.hp > 0).id`);
  await evaluate(`window.gridbound.battle.hero(${other}).remaining = .05`); await sleep(300);
  assert.ok(await evaluate(`${log('lunge')}.some(e => e.source === ${other} && e.value === 1)`), 'a cast without a tap lunges too');

  // J3: clean taps count a combo (×n on the arena); mashing tires the hero, and the fatigued tap breaks it (TIRED, the counter goes).
  await evaluate(calm); await evaluate(`window.gridbound.battle.hero(${hero}).remaining = 999`); await evaluate('window.gridbound.scene.juiceLog.length = 0');
  let shown = 0;
  for (let i = 0; i < 12; i++) {
    await touch.tap(cardOf(hero), 30); await sleep(140);
    const now = await evaluate('document.querySelector("#combo").hidden ? 0 : Number(document.querySelector("#combo b").textContent.replace("×", ""))');
    shown = Math.max(shown, now);
    if (shown === 5) await screenshot(`${OUT}/combo-${lang}.png`);
    if (await evaluate(`${log('tired')}.length`)) break;
  }
  const tired = await evaluate(`${log('tired')}`), best = Math.max(...await evaluate(`${log('combo')}.map(e => e.value)`));
  assert.ok(shown >= 5 && best >= 5, `clean taps count a combo on screen: shown ×${shown}, best ×${best}`);
  assert.ok(tired.length >= 1, 'mashing one hero tires it: the fatigued tap breaks the combo');
  await wait('document.querySelector("#combo").hidden');

  // J4: a Guard 0.3 s before an all-grid hit is PERFECT: the arena slows (speed < 1) and comes back to full speed.
  const ritual = left => `(() => { const b = window.gridbound.battle; b.guardCooldown = 0; b.guardLeft = 0; b.threats = [{ id: 990 + Math.round(${left} * 10), name: 'WORLDLESS RITUAL', type: 'all', slots: [0,1,2,3,4,5,6,7,8], left: ${left}, total: 4.2, damage: 10 }]; })()`;
  await evaluate(calm); await evaluate('window.gridbound.scene.juiceLog.length = 0');
  await evaluate(ritual(.3)); await evaluate('window.gridbound.battle.guard()');
  await wait(`${log('perfect')}.length === 1`, 4000);
  const dip = await evaluate('window.gridbound.scene.speed');
  await screenshot(`${OUT}/perfect-${lang}.png`);
  assert.ok(dip < 1, `PERFECT slows the arena: speed ${dip}`);
  await wait('window.gridbound.scene.speed === 1', 3000);
  assert.ok((await evaluate(`${log('perfect')}`))[0].value <= .6, 'PERFECT only within 0.6 s of the impact');
  // A Guard 2 s before the hit is only BLOCKED: no slow motion.
  await evaluate(calm); await evaluate('window.gridbound.scene.juiceLog.length = 0');
  await evaluate(ritual(2)); await evaluate('window.gridbound.battle.guard()');
  await wait(`${log('blocked')}.length === 1`, 6000);
  assert.deepEqual(await evaluate(`[${log('perfect')}.length, ${log('slowmo')}.length]`), [0, 0], 'a Guard 2 s early is BLOCKED, never PERFECT');

  // J8: a telegraph lights the danger edge on its side (the boss's: top) and pulses steadily in its last second.
  await evaluate(calm);
  await evaluate("(() => { const b = window.gridbound.battle; b.threats = [{ id: 980, name: 'FALLING SHARDS', type: 'meteor', slots: [4], left: 2.5, total: 3.2, damage: 1 }]; })()");
  await wait('document.querySelector("#danger-edge").classList.contains("edge-top")');
  await wait('document.querySelector("#danger-edge").classList.contains("hot")', 4000);
  await evaluate(calm); await wait('!document.querySelector("#danger-edge").classList.contains("on")');

  // J10: Ninefold Dawn plays its cut-in band with the lead hero's portrait.
  await evaluate('window.gridbound.battle.resolve = 100'); await sleep(250);
  await touch.tap('#ultimate'); await sleep(150);
  const cutin = await evaluate('({ shown: !document.querySelector("#cutin").hidden, text: document.querySelector("#cutin b").textContent, img: Boolean(document.querySelector("#cutin img").getAttribute("src")) })');
  assert.ok(cutin.shown && cutin.text === 'NINEFOLD DAWN' && cutin.img, `Ninefold Dawn's cut-in: ${JSON.stringify(cutin)}`);
  await screenshot(`${OUT}/cutin-${lang}.png`);
  await wait('document.querySelector("#cutin").hidden', 2000);

  // J6: the ghost bar holds where the HP was, then drains to it.
  await evaluate(calm);
  await sleep(800); await evaluate('(() => { const b = window.gridbound.battle; b.bossHp = Math.round(b.bossHp * .5); })()'); await sleep(150);
  const ghost = () => evaluate('[document.querySelector("#boss-hp"), document.querySelector("#boss-hp-ghost")].map(el => parseFloat(el.style.transform.replace("scaleX(", "")))');
  const [hp0, ghost0] = await ghost();
  assert.ok(ghost0 > hp0 + .05, `the ghost bar holds the HP taken: ${hp0} / ${ghost0}`);
  await sleep(700);
  const [hp1, ghost1] = await ghost();
  assert.ok(Math.abs(ghost1 - hp1) < .01, `then drains to the HP: ${hp1} / ${ghost1}`);

  // J9: the last hit plays the kill cam (0.2 speed, the arena's DOM layers aside), then the death animation and the result.
  await evaluate('window.gridbound.scene.juiceLog.length = 0');
  await evaluate('(() => { const b = window.gridbound.battle; b.bossHp = 1; b.hitBoss(50, -1, "slash"); })()');
  await wait(`${log('killcam')}.length === 1`, 3000);
  const kill = await evaluate('({ speed: window.gridbound.scene.speed, clear: document.querySelector("#arena").classList.contains("kill-cam") })');
  assert.ok(kill.speed <= .25 && kill.clear, `the kill cam slows the arena and clears its layers: ${JSON.stringify(kill)}`);
  await screenshot(`${OUT}/killcam-${lang}.png`);
  await wait('window.gridbound.scene.speed === 1 && !document.querySelector("#arena").classList.contains("kill-cam")', 3000);
  await wait('Boolean(document.querySelector("#result-screen:not([hidden]) [data-nav-exit=return]"))', 10000);
  assert.deepEqual(errors, []);
  console.log('✓ en: ring, TAP-STRIKE lunge, combo and TIRED, PERFECT vs BLOCKED, danger edge, cut-in, ghost bar, kill cam');
}, { phone: PHONE });

// Reduced motion: the numbers, PERFECT and its sound stay; the shake, the slow motion and the kill cam do not.
await withBrowser(async ({ send, wait, evaluate, errors }) => {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await seedSave(send, ACT_TWO_SAVE, 'en');
  await send('Page.navigate', { url });
  await wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 30000);
  await evaluate("window.gridbound.boot('adventure', 1)");
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
  await evaluate('document.querySelector("#start").click()');
  await wait('window.gridbound.battle.status === "fighting" && window.gridbound.scene.reducedMotion === true');
  await evaluate('(() => { const b = window.gridbound.battle; b.attackIn = 99; b.clawIn = 99; b.summonIn = 99; b.guardCooldown = 0; b.threats = [{ id: 970, name: "WORLDLESS RITUAL", type: "all", slots: [0,1,2,3,4,5,6,7,8], left: .3, total: 4.2, damage: 10 }]; b.guard(); window.gridbound.scene.juiceLog.length = 0; })()');
  await wait(`${log('perfect')}.length === 1`, 4000);
  const calm = await evaluate(`({ slowmo: ${log('slowmo')}.length, speed: window.gridbound.scene.speed, scroll: [window.gridbound.scene.cameras.main.scrollX, window.gridbound.scene.cameras.main.scrollY] })`);
  assert.deepEqual(calm, { slowmo: 0, speed: 1, scroll: [0, 0] }, 'reduced motion: PERFECT without slow motion or shake');
  // An unguarded all-grid hit shakes nothing either.
  await evaluate('(() => { const b = window.gridbound.battle; b.guardLeft = 0; b.threats = [{ id: 971, name: "WORLDLESS RITUAL", type: "all", slots: [0,1,2,3,4,5,6,7,8], left: .1, total: 4.2, damage: 5 }]; })()');
  for (let i = 0; i < 8; i++) { await sleep(40); assert.deepEqual(await evaluate('[window.gridbound.scene.cameras.main.scrollX, window.gridbound.scene.cameras.main.scrollY]'), [0, 0], 'reduced motion: no shake'); }
  await evaluate('(() => { const b = window.gridbound.battle; b.bossHp = 1; b.hitBoss(50, -1, "slash"); })()');
  await wait('window.gridbound.battle.status === "victory"'); await sleep(200);
  assert.deepEqual(await evaluate(`[${log('killcam')}.length, window.gridbound.scene.speed, window.gridbound.scene.cameras.main.zoom]`), [0, 1, 1], 'reduced motion: no kill cam');
  assert.deepEqual(errors, []);
  console.log('✓ reduced motion: PERFECT and numbers stay; no shake, slow motion or kill cam');
}, { phone: PHONE });
