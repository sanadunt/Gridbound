import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const qaProfile = { version: 3, gold: 500, claimedQuests: [], ledger: { raids: 0, victories: 0, enemies: {} }, roster: [0, 4, 3], cleared: [], loadouts: { 0: { skills: [0, 1], talents: [], xp: 0, slot: 1 }, 4: { skills: [0, 1], talents: [], xp: 0, slot: 7 }, 3: { skills: [0, 1], talents: [], xp: 0, slot: 6 } }, bestFloor: 0, wins: 0, sound: false, motion: true };

await withBrowser(async ({ send, wait, evaluate, screenshot, click, key, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})` });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("canvas")');
  assert.equal(await evaluate('Boolean(document.querySelector("#town-screen:not([hidden])"))'), true, 'Fresh game must open the town');
  assert.deepEqual(await evaluate('window.gridbound.profile().roster'), [0, 4, 3]);
  await screenshot('artifacts/town-desktop.png');

  await click('[data-facility="party"]');
  await click('[data-training-tab="talents"]');
  await screenshot('artifacts/training-desktop.png');
  await click('[data-inspect-talent="active-2"]');await click('[data-talent="active-2"]');
  assert.ok((await evaluate('window.gridbound.profile().loadouts[0].talents')).includes('active-2'));
  await click('[data-training-tab="skills"]');
  await evaluate(`(() => { const select = document.querySelector('[data-equip-slot="1"]'); select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.deepEqual(await evaluate('window.gridbound.profile().loadouts[0].skills'), [0, 2]);

  await click('[data-training-tab="gear"]');
  const goldBeforePreview = await evaluate('window.gridbound.profile().gold');
  await evaluate(`(() => { const select = document.querySelector('[data-gear-slot="charm"]'); select.value = 'ember-charm'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-gear-preview=ember-charm]"))'), true);
  assert.equal(await evaluate('window.gridbound.profile().gold'), goldBeforePreview, 'equipment inspection must not spend gold');
  await click('[data-confirm-gear]');
  assert.ok(await evaluate('window.gridbound.profile().loadouts[0].inventory.includes("ember-charm")'));

  await click('[data-facility="campaign"]');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  await screenshot('artifacts/battle-ready-desktop.png');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  const before = await evaluate('window.gridbound.battle.taps');
  await click('[data-tap="3"]');
  assert.equal(await evaluate('window.gridbound.battle.taps'), before + 1);
  await screenshot('artifacts/battle-desktop.png');

  await click('#pause');
  await wait('window.gridbound.battle.status === "paused"');
  const time = await evaluate('window.gridbound.battle.time');
  await evaluate('window.gridbound.step(5)');
  assert.equal(await evaluate('window.gridbound.battle.time'), time);
  await key('Escape');
  await wait('window.gridbound.battle.status === "fighting"');

  const gold = await evaluate('window.gridbound.profile().gold');
  for (let stage = 0; stage < 4; stage += 1) {
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
    await wait('window.gridbound.battle.status === "victory"');
    await wait('document.querySelector("#modal").open', 15000);
    await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")', 15000);
    if (stage < 3) {
      assert.equal(await evaluate('window.gridbound.profile().gold'), gold, 'Intermission must not bank expedition gold');
      await click('#next-wave');
      await wait('window.gridbound.battle.status === "ready" && !document.querySelector("#modal").open');
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
      assert.equal(await evaluate('window.gridbound.battle.stage'), stage + 1);
    }
  }
  await screenshot('artifacts/campaign-victory.png');
  assert.ok((await evaluate('window.gridbound.profile().roster')).includes(2), 'First clear recruits Sable');
  const banked = await evaluate('window.gridbound.profile().gold');
  assert.ok(banked > gold);
  await click('#start');
  await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")');
  await click('#result-town');
  await wait('document.querySelector("#town-screen:not([hidden])")');
  await wait('window.gridbound.profile().gold === ' + banked);
  await click('[data-campaign-page="1"]');await click('[data-zone="1"]');
  assert.match(await evaluate('document.querySelector(".mission-brief h3").textContent'), /Sunken/);
  await send('Page.reload');
  await wait('window.gridbound && document.querySelector("[data-zone]")');
  assert.equal(await evaluate('window.gridbound.profile().gold'), banked);
  assert.deepEqual(await evaluate('window.gridbound.profile().loadouts[0].skills'), [0, 2]);

  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('document.querySelector("[data-boon]") && !document.querySelector("[data-boon]").disabled', 15000);
  assert.equal(await evaluate('document.querySelectorAll("[data-boon]").length'), 3);
  await screenshot('artifacts/boon-choice.png');
  const boon = await evaluate('document.querySelector("[data-boon]").dataset.boon');
  await click('[data-boon]');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 2);
  assert.ok((await evaluate('window.gridbound.battle.boons')).includes(boon));
  await screenshot('artifacts/endless-floor2.png');
  await click('#start');
  await evaluate('window.gridbound.battle.heroes.forEach(hero => hero.hp = 0); window.gridbound.step(.1)');
  await wait('document.querySelector("#retry") && !document.querySelector("#retry").disabled', 15000);
  await click('#retry');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 1);
  assert.deepEqual(await evaluate('window.gridbound.battle.boons'), []);
  assert.deepEqual(errors, []);
  const network = await evaluate(`performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin) && !resource.name.startsWith('data:') && !resource.name.startsWith('blob:')).map(resource => resource.name)`);
  assert.deepEqual(network, []);
  console.log('PASS desktop: town, training tabs, talent arrows, preview-only equipment, confirmed purchase, combat, death readiness, result gate, campaign waves, recruitment, persistence, boons, defeat/retry, local-only network, zero runtime exceptions');
});
