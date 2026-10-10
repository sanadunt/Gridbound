// Commander saves keep every Story field and challenge runs never rewrite Story: the journey (stars, star
// chests, Heroic clears, Undercroft depth and run) and story choices survive reloads, a claimed star chest
// stays claimed, a Raid run leaves the manual Story slot, the Story ledger and gold alone while its XP reaches
// the live Story party, the HUD wallet shows Story gold and bank Crystal in every mode, and the deepest
// Roguelike floor completes the Story descent quests.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const readDoc = id => `(async () => {
  const { openCommanderRepository } = await import('/src/game/commander.ts');
  const repository = await openCommanderRepository();
  const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(id)});
  repository.close();
  return document;
})()`;
const hud = () => `({ gold: document.querySelector('#wallet .currency-amount span')?.textContent, crystal: document.querySelector('#bank-wallet .currency-amount span')?.textContent })`;

await withBrowser(async ({ send, wait, evaluate, click, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
  const id = await evaluate(`(async () => {
    const { createProfile, normalizeProfile } = await import('/src/game/profile.ts');
    const { createCommanderDocument, openCommanderRepository } = await import('/src/game/commander.ts');
    const { startRun } = await import('/src/game/dungeon.ts');
    const raw = createProfile();
    Object.assign(raw, { cleared: [0, 1, 2], gold: 3000, sound: false, motion: false, wins: 3, settlementReceipts: ['seed-r1'], narrative: { school: 'memorial' } });
    raw.economy.gold = 3000;
    raw.ledger = { raids: 0, victories: 3, enemies: { wolf: 3 } };
    raw.journey = { stars: { 0: 3, 1: 3, 2: 2 }, chests: 0, heroic: [0], depth: 1, run: startRun(2, 7, [0, 4, 3]) };
    const document = createCommanderDocument(normalizeProfile(JSON.parse(JSON.stringify(raw))), 'Persistence');
    document.story.slots[0] = { slotId: 'manual-1', state: structuredClone(document.story.slots[3].state), savedAt: Date.now(), status: 'valid' };
    document.shared.bankCrystal = 57;
    document.rogue.slots[3].state.bestFloor = 3;
    const repository = await openCommanderRepository();
    await repository.commit(document);
    repository.close();
    return document.commanderId;
  })()`);
  const seeded = await evaluate(readDoc(id));
  const reload = async () => {
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector(".camp-scene")', 30000);
    await wait('document.querySelector("#storage-status")?.textContent.startsWith("Saved")', 30000);
    await evaluate('window.gridbound.hideTitle()');
    await wait('document.querySelector("#title-screen").hidden');
  };
  const journey = () => evaluate('(() => { const p = window.gridbound.profile(); return { stars: p.journey.stars, chests: p.journey.chests, heroic: p.journey.heroic, depth: p.journey.depth, run: p.journey.run?.depth, narrative: p.narrative }; })()');

  // A reload goes through CommanderRepository.list() → normalizeCommanderDocument.
  await reload();
  assert.deepEqual(await journey(), { stars: { 0: 3, 1: 3, 2: 2 }, chests: 0, heroic: [0], depth: 1, run: 2, narrative: { school: 'memorial' } }, 'the journey and story choices survive a reload');
  assert.deepEqual(await evaluate(hud()), { gold: '3,000', crystal: '57' }, 'camp shows Story gold and the bank Crystal');

  // Claim the star chest, then reload: it stays claimed and cannot be opened again.
  await click.nav('campaign');
  await wait('Boolean(document.querySelector("[data-star-chest]"))');
  await click('[data-star-chest]');
  await wait('window.gridbound.profile().journey.chests === 1');
  assert.ok(await evaluate('window.gridbound.profile().gold') > 3000, 'the chest pays gold');
  await wait(`${readDoc(id)}.then(doc => doc?.story.slots[3].state?.journey?.chests === 1)`);
  await reload();
  assert.deepEqual(await journey(), { stars: { 0: 3, 1: 3, 2: 2 }, chests: 1, heroic: [0], depth: 1, run: 2, narrative: { school: 'memorial' } }, 'the claimed chest and Heroic clear survive a reload');
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".star-bar"))');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-star-chest]"))'), false, 'the star chest cannot be claimed twice');

  // Earn stars (first clear of chapter 4) and a Heroic clear (chapter 2) through the real UI, then reload.
  const winChapter = async (zone, heroic) => {
    await click.nav('campaign');
    await click(`.map-act-tab[data-act="${Math.floor(zone / 4)}"]`);
    await wait(`Boolean(document.querySelector('.map-node-pin[data-zone="${zone}"]'))`);
    await click(`.map-node-pin[data-zone="${zone}"]`);
    await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
    if (heroic) { await click('[data-heroic="1"]'); await wait('Boolean(document.querySelector(".heroic-depart"))'); }
    await click('[data-depart=adventure]');
    await wait('window.gridbound.battle.mode === "adventure" && window.gridbound.battle.status === "ready"');
    assert.equal(await evaluate('window.gridbound.battle.heroic === true'), heroic);
    const count = await evaluate('window.gridbound.battle.stageCount');
    for (let stage = 0; stage < count; stage++) {
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
      await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
      await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")', 15000);
      if (stage < count - 1) { await click('#next-wave'); await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden'); }
    }
    await click('#result-town');
    await wait('Boolean(document.querySelector(".camp-scene"))');
  };
  await winChapter(3, false);
  await winChapter(1, true);
  const earned = await journey();
  assert.ok(earned.stars[3] >= 1, 'the chapter 4 clear earns stars');
  assert.deepEqual(earned.heroic, [0, 1], 'the chapter 2 Heroic clear is recorded');
  const goldBeforeReload = await evaluate('window.gridbound.profile().gold');
  await wait(`${readDoc(id)}.then(doc => JSON.stringify(doc?.story.slots[3].state?.journey?.heroic) === '[0,1]')`);
  await reload();
  assert.deepEqual(await journey(), earned, 'earned stars and the Heroic clear survive a reload');
  await winChapter(1, true);
  assert.equal(await evaluate('window.gridbound.profile().journey.heroic.length'), 2);
  assert.equal(await evaluate('window.gridbound.profile().gold'), goldBeforeReload + await evaluate('window.gridbound.battle.gold'), 'a repeated Heroic clear pays battle gold only, no first-clear reward');
  const storyGold = await evaluate('window.gridbound.profile().gold');

  // Descent quests read the account-wide Roguelike depth from Story.
  await click.nav('quests');
  const descent = await evaluate(`(async () => { const { QUESTS, questProgress } = await import('/src/game/quests.ts'); const p = window.gridbound.profile(); return { bestFloor: p.bestFloor, ready: questProgress(p, QUESTS.find(q => q.id === 'descent-3')).ready }; })()`);
  assert.deepEqual(descent, { bestFloor: 3, ready: true }, 'Roguelike floor 3 completes Below the First Bell');

  // Raid: the wallet keeps showing Story gold, and the run touches neither the manual slot nor the Story ledger.
  await click.nav('raid');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]"))');
  assert.deepEqual(await evaluate(hud()), { gold: storyGold.toLocaleString('en-US'), crystal: '57' }, 'Raid shows Story gold, not the zeroed Raid profile gold');
  await screenshot('artifacts/commander-persistence-raid-hud.png');
  await click('.secondary-scene [data-depart=raid]');
  await wait('window.gridbound.battle.mode === "raid" && window.gridbound.battle.status === "ready"');
  await wait(`${readDoc(id)}.then(doc => Boolean(doc?.raid.activeRun))`);
  assert.deepEqual((await evaluate(readDoc(id))).story.slots[0], seeded.story.slots[0], 'starting a Raid leaves the manual Story slot untouched');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
  await wait('Boolean(document.querySelector("#result-town")) && !document.querySelector("#result-town").disabled', 15000);
  const afterRaid = await evaluate(readDoc(id));
  assert.deepEqual(afterRaid.story.slots[0], seeded.story.slots[0], 'a Raid win leaves the manual Story slot untouched');
  const auto = afterRaid.story.slots[3].state;
  assert.equal(auto.gold, storyGold, 'Story gold is unchanged by the Raid');
  assert.equal(auto.journey.chests, 1);
  assert.equal(auto.ledger.enemies.wolf, 3, 'Story kill counts survive the Raid checkpoint');
  assert.ok(auto.receipts.includes('seed-r1'), 'Story receipts survive the Raid checkpoint');
  assert.equal(afterRaid.shared.ledger.raids, 1, 'the Raid is counted in the account ledger');
  assert.equal(afterRaid.shared.ledger.enemies.wolf, 3, 'the account ledger keeps the Story kills');
  const raidHeroes = await evaluate('window.gridbound.battle.heroes.map(h => h.id)');
  for (const hero of raidHeroes) assert.ok((auto.loadouts[hero].xp ?? 0) > (seeded.story.slots[3].state.loadouts[hero].xp ?? 0), `Raid XP reaches Story hero ${hero}`);
  const bank = afterRaid.shared.bankCrystal;
  assert.ok(bank > 57, 'the Raid pays Crystal into the bank');

  // Back to camp: Story mode again, both currencies shown.
  await click('#result-town');
  await wait('Boolean(document.querySelector(".camp-scene"))');
  await wait('window.gridbound.profile().gold === ' + storyGold);
  assert.deepEqual(await evaluate(hud()), { gold: storyGold.toLocaleString('en-US'), crystal: bank.toLocaleString('en-US') }, 'camp after a Raid shows Story gold and the bank Crystal');
  await wait(`${readDoc(id)}.then(doc => doc?.activeMode === 'story')`);
  const final = await evaluate(readDoc(id));
  assert.equal(final.story.slots[3].state.gold, storyGold, 'returning to camp does not write the Raid profile into Story');
  assert.equal(final.shared.bankCrystal, bank, 'returning to camp does not write Story Crystal into the bank');
  await screenshot('artifacts/commander-persistence-camp-hud.png');

  // Home from the Raid gate flushes the Raid save, then lands on a Story camp without writing Raid values into Story.
  await click.nav('raid');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]"))');
  await wait(`${readDoc(id)}.then(doc => doc?.activeMode === 'raid')`);
  await click('#home');
  await wait('Boolean(document.querySelector(".camp-scene"))');
  await wait(`${readDoc(id)}.then(doc => doc?.activeMode === 'story')`);
  assert.equal(await evaluate('window.gridbound.profile().gold'), storyGold, 'Home from the Raid gate restores the Story profile');
  assert.deepEqual(await evaluate(hud()), { gold: storyGold.toLocaleString('en-US'), crystal: bank.toLocaleString('en-US') });
  const home = await evaluate(readDoc(id));
  assert.equal(home.story.slots[3].state.gold, storyGold); assert.equal(home.shared.bankCrystal, bank);
  assert.deepEqual(home.story.slots[0], seeded.story.slots[0]);
  assert.deepEqual(errors, []);
  console.log('PASS Commander journey/narrative persistence, frozen manual slots, account ledger, descent depth and HUD wallet');
}, { width: 1280, height: 900 });
