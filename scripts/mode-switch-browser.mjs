import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

await withBrowser(async ({ send, wait, evaluate, click, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
  const commanderId = await evaluate(`(async () => {
    const { createProfile, buyTalent, equipSkill } = await import('/src/game/profile.ts');
    const { createCommanderDocument, openCommanderRepository } = await import('/src/game/commander.ts');
    const profile = createProfile();
    profile.cleared = [0, 1, 2];
    profile.gold = 2400;
    profile.economy.gold = 2400;
    profile.economy.commanderCrystal = 0;
    profile.motion = false;
    profile.ledger.enemies.wolf = 1;
    if (!buyTalent(profile, 0, 'active-2')) throw new Error('Respec fixture talent could not be purchased');
    if (!equipSkill(profile, 0, 1, 2)) throw new Error('Respec fixture skill could not be equipped');
    const document = createCommanderDocument(profile, 'Mode Transition');
    document.shared.bankCrystal = 57;
    document.shared.challengeUnlocks = ['fixture-unlock'];
    document.rogue.slots[3].state.bestFloor = 9;
    const repository = await openCommanderRepository();
    await repository.commit(document);
    repository.close();
    return document.commanderId;
  })()`);

  await send('Page.reload');
  await wait('window.gridbound && document.querySelector(".camp-scene")');
  await wait('document.querySelector("#storage-status")?.textContent.includes("local IndexedDB")');
  await evaluate('window.gridbound.hideTitle()');
  await wait('document.querySelector("#title-screen").hidden');
  await click('.game-nav [data-facility="party"]');
  await wait('document.querySelector(".party-scene [data-respec]")');
  await click('.party-scene [data-respec]');
  await wait('window.gridbound.profile().gold === 2400 && window.gridbound.profile().loadouts[0].talents.length === 0');
  const respec = await evaluate(`(() => {
    const profile = window.gridbound.profile();
    return { gold: profile.gold, skills: profile.loadouts[0].skills, talents: profile.loadouts[0].talents,
      xp: profile.loadouts[0].xp, level: profile.loadouts[0].xp === 0 ? 1 : undefined };
  })()`);
  assert.deepEqual(respec, { gold: 2400, skills: [0, 1], talents: [], xp: 0, level: 1 },
    'Respec refunds the talent cost, clears talents, and restores the two base skills');
  await wait(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    const state = document?.story.slots[3].state;
    return state?.gold === 2400 && state.loadouts[0].talents.length === 0
      && JSON.stringify(state.loadouts[0].skills) === '[0,1]';
  })()`);
  await click('.party-advanced-link');
  await wait('document.querySelector(".party-scene h1")?.textContent.trim() === "Prepare the party"');
  const alternateHero = await evaluate('Number([...document.querySelectorAll(".party-roster button")].find(button => !button.classList.contains("active")).dataset.townHero)');
  await click(`[data-town-hero="${alternateHero}"]`);
  await wait(`Number(document.querySelector(".party-roster .active")?.dataset.townHero) === ${alternateHero}`);
  await click('.party-advanced-link');
  await wait('document.querySelector(".party-scene h1")?.textContent.trim() === "Progression"');
  assert.equal(await evaluate('Number(document.querySelector(".party-roster .active")?.dataset.townHero)'), alternateHero,
    'Opening Jobs & talents preserves the selected hero');
  await click('.party-advanced-link');
  await wait('document.querySelector(".party-scene h1")?.textContent.trim() === "Prepare the party"');
  assert.equal(await evaluate('Number(document.querySelector(".party-roster .active")?.dataset.townHero)'), alternateHero,
    'Returning to preparation preserves the selected hero');
  await click('.game-nav [data-facility="campaign"]');
  await wait('Boolean(document.querySelector(".world-map-wrapper.map-view"))');
  await click('.map-node-pin[data-zone="2"]');
  await wait('Boolean(document.querySelector(".world-map-wrapper.mission-view"))');
  await click('.mission-map-return');
  await wait("document.querySelector('.world-map-wrapper.map-view .map-node-pin.chosen')?.dataset.zone === '2'");
  assert.equal(await evaluate("document.querySelector('.world-map-wrapper.map-view .map-node-pin.chosen')?.dataset.zone"), "2",
    'Returning to the route map preserves the selected chapter');

  await send('Page.reload');
  await wait('window.gridbound && document.querySelector(".camp-scene")');
  await wait('document.querySelector("#storage-status")?.textContent.includes("local IndexedDB")');
  await evaluate('window.gridbound.hideTitle()');
  await wait('document.querySelector("#title-screen").hidden');
  await click('.game-nav [data-facility="campaign"]');
  await wait('Boolean(document.querySelector(".world-map-wrapper.map-view"))');
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="raid"]');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]"))');
  await wait(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return document?.activeMode === 'raid' && document.revision > 0;
  })()`);

  const raidProfile = await evaluate('window.gridbound.profile()');
  const afterRaid = await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return { bankCrystal: document.shared.bankCrystal, challengeUnlocks: document.shared.challengeUnlocks,
      storyGold: document.story.slots[3].state.gold };
  })()`);

  await send('Page.reload');
  await wait('window.gridbound && document.querySelector(".secondary-scene .expedition-mode-nav [data-facility=campaign]")');
  await wait('window.gridbound.profile().gold === 0');
  await evaluate('window.gridbound.hideTitle()');
  await wait('document.querySelector("#title-screen").hidden');
  await click('.secondary-scene .expedition-mode-nav [data-facility="campaign"]');
  await wait('Boolean(document.querySelector(".world-map-wrapper.map-view"))');
  await wait(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return document?.activeMode === 'story' && document.revision > 0;
  })()`);

  const storyProfile = await evaluate('window.gridbound.profile()');
  const afterCampaign = await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return { bankCrystal: document.shared.bankCrystal, challengeUnlocks: document.shared.challengeUnlocks,
      storyGold: document.story.slots[3].state.gold };
  })()`);
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="raid"]');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]"))');
  await click('.game-nav [data-facility="more"]');
  await wait('Boolean(document.querySelector(".more-scene"))');
  await click('.more-card[data-facility="quests"]');
  await wait(`Boolean(document.querySelector('.secondary-scene [data-claim-quest="hunt-wolf"]:not(:disabled)'))`);
  await wait('window.gridbound.profile().gold === 2400');
  await click('.secondary-scene [data-claim-quest="hunt-wolf"]');
  await wait(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    const state = document?.story.slots[3].state;
    return document?.activeMode === 'story' && state?.gold === 2465 && state.claimedQuests.includes('hunt-wolf');
  })()`);
  const afterQuest = await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return { mode: document.activeMode, storyGold: document.story.slots[3].state.gold,
      claimedQuests: document.story.slots[3].state.claimedQuests };
  })()`);

  await click('.game-nav [data-facility="more"]');
  await wait('Boolean(document.querySelector(".more-scene"))');
  await click('.more-card[data-facility="challenge-shop"]');
  await wait('window.gridbound.profile().economy.commanderCrystal === 57');
  const shopButton = await evaluate(`(() => {
    const button = document.querySelector('.secondary-scene [data-bank-buy="bank-relic-ward"]');
    return { disabled: button.disabled, label: button.textContent.trim() };
  })()`);
  assert.deepEqual(shopButton, { disabled: false, label: '24 CRYSTAL' },
    'Challenge shop opened from Story uses the shared bank');
  await click('.secondary-scene [data-bank-buy="bank-relic-ward"]');
  await wait(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return document?.activeMode === 'raid' && document.shared.bankCrystal === 33
      && document.shared.challengeUnlocks.includes('bank-relic-ward');
  })()`);
  const afterShop = await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(commanderId)});
    repository.close();
    return { mode: document.activeMode, bankCrystal: document.shared.bankCrystal,
      challengeUnlocks: document.shared.challengeUnlocks, storyGold: document.story.slots[3].state.gold,
      claimedQuests: document.story.slots[3].state.claimedQuests };
  })()`);

  assert.deepEqual(afterQuest, { mode: 'story', storyGold: 2465, claimedQuests: ['hunt-wolf'] },
    'Quest rewards claimed from Raid are persisted in the Story projection');
  assert.deepEqual(afterShop, {
    mode: 'raid', bankCrystal: 33, challengeUnlocks: ['fixture-unlock', 'bank-relic-ward'],
    storyGold: 2465, claimedQuests: ['hunt-wolf']
  }, 'Challenge purchases persist shared unlocks without losing Story progress');

  assert.equal(raidProfile.gold, 0, 'Raid route materializes its mode profile');
  assert.equal(raidProfile.economy.commanderCrystal, 57, 'Raid route loads shared bank Crystal');
  assert.deepEqual(afterRaid, { bankCrystal: 57, challengeUnlocks: ['fixture-unlock'], storyGold: 2400 });
  assert.equal(storyProfile.gold, 2400, 'Campaign route materializes the saved Story profile');
  assert.deepEqual(afterCampaign, { bankCrystal: 57, challengeUnlocks: ['fixture-unlock'], storyGold: 2400 });
  assert.deepEqual(errors, []);
  console.log('PASS respec, Commander mode switching, quest persistence, and shared challenge purchases');

}, { width: 1440, height: 900 });
