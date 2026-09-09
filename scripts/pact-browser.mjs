import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';
const qaProfile = {
  version: 3,
  gold: 1500,
  claimedQuests: [],
  ledger: { raids: 2, victories: 5, enemies: { golem: 1, moth: 1 } },
  roster: [0, 1, 2, 3, 4],
  storyActive: [0, 4, 3],
  cleared: [0, 1, 2, 3],
  loadouts: {
    0: { skills: [0, 1], talents: [], xp: 400, slot: 1, job: 'warrior' },
    1: { skills: [0, 1], talents: [], xp: 300, slot: 2, job: 'rogue' },
    2: { skills: [0, 1], talents: [], xp: 200, slot: 4, job: 'archer' },
    3: { skills: [0, 1], talents: [], xp: 300, slot: 6, job: 'healer' },
    4: { skills: [0, 1], talents: [], xp: 400, slot: 7, job: 'wizard' }
  },
  bestFloor: 4,
  wins: 5,
  sound: false,
  motion: true,
  economy: { commanderCrystal: 120, journeyPurse: 0 }
};

// 1. Desktop Suite (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector("#town-screen:not([hidden])"))');

  // Navigate to Raid Hunts (Pact of Punishment)
  await click('[data-view="raid"]');
  await wait('document.querySelectorAll("[data-raid]").length === 12');

  const bossCount = await evaluate('document.querySelectorAll("[data-raid]").length');
  assert.equal(bossCount, 12, 'Must render all 12 authored boss archetypes');

  // Select Moth quarry
  await click('[data-raid="moth"]');
  await wait('Boolean(document.querySelector(\'[data-raid="moth"]\')?.classList.contains("chosen"))');
  const isMothChosen = await evaluate('document.querySelector(\'[data-raid="moth"]\').classList.contains("chosen")');
  assert.ok(isMothChosen, 'Moth boss card must be chosen');

  // Toggle modifier
  await click('[data-raid-modifier="RM01"]');
  await wait('Boolean(document.querySelector(\'[data-raid-modifier="RM01"]\')?.checked)');
  const isRm01Checked = await evaluate('document.querySelector(\'[data-raid-modifier="RM01"]\').checked');
  assert.ok(isRm01Checked, 'RM01 modifier must be checked');

  // Check echo unit party slots
  const partySlots = await evaluate('document.querySelectorAll("[data-raid-job]").length');
  assert.ok(partySlots >= 3, 'Raid party slots must be configured');

  // Check mission brief
  const briefBoss = await evaluate('document.querySelector(".mission-brief h3").textContent');
  assert.match(briefBoss, /Lantern Eater/i, 'Mission brief must display selected boss name');

  await screenshot('artifacts/pact-raid-hades-desktop.png');
  console.log('PASS: Desktop Raid Hunts (Pact of Punishment) verified and captured.');

  // Navigate to The Sunken Bell (Roguelike Descent)
  await click('[data-view="endless"]');
  await wait('Boolean(document.querySelector(".endless-rules"))');

  const ruleCount = await evaluate('document.querySelectorAll(".endless-rules p").length');
  assert.equal(ruleCount, 4, 'Must display the 4 pillars of the descent');

  const recruitCount = await evaluate('document.querySelectorAll("[data-rogue-slot]").length');
  assert.equal(recruitCount, 3, 'Must display 3 custom recruit plinths');

  const departButton = await evaluate('Boolean(document.querySelector(\'[data-depart="endless"]\'))');
  assert.ok(departButton, 'Descend CTA button must be present');

  await screenshot('artifacts/sunken-bell-hades-desktop.png');
  console.log('PASS: Desktop The Sunken Bell (Descent) verified and captured.');

  // Open Story Journal Modal
  await click('#story-journal');
  await wait('Boolean(document.querySelector("#modal")?.open)');
  const journalTitle = await evaluate('document.querySelector("#modal h2#modal-title").textContent');
  assert.match(journalTitle, /Story journal/i, 'Modal title must indicate Story Journal');

  await screenshot('artifacts/modal-journal-hades-desktop.png');
  console.log('PASS: Desktop Story Journal Modal verified and captured.');

  // Close Modal
  await click('#modal [data-close]');
  await wait('!document.querySelector("#modal")?.open');

  // Open Commander Profiles Modal
  await click('#profiles');
  await wait('Boolean(document.querySelector("#modal")?.open && document.querySelector("#commander-name"))');
  const profilesTitle = await evaluate('document.querySelector("#modal h2#modal-title").textContent');
  assert.match(profilesTitle, /Commander profiles/i, 'Modal title must indicate Commander profiles');

  await screenshot('artifacts/modal-profiles-hades-desktop.png');
  console.log('PASS: Desktop Commander Profiles Modal verified and captured.');

  // Close Modal
  await click('#modal [data-close]');
  await wait('!document.querySelector("#modal")?.open');

  assert.deepEqual(errors, [], 'No uncaught errors on desktop');
}, { width: 1440, height: 900 });

// 2. Mobile Suite (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector("#town-screen:not([hidden])"))');

  const fits = async (label) => {
    const scrollW = await evaluate('document.documentElement.scrollWidth');
    const innerW = await evaluate('window.innerWidth');
    assert.ok(scrollW <= innerW + 1, `${label}: horizontal overflow detected: scrollWidth ${scrollW} > innerWidth ${innerW}`);
  };

  // Test Raid Hunts on mobile
  await click('[data-view="raid"]');
  await wait('document.querySelectorAll("[data-raid]").length === 12');
  await fits('Mobile Raid Hunts');

  // Verify touch target heights >= 44px
  const raidDepartHeight = await evaluate('document.querySelector(\'[data-depart="raid"]\').getBoundingClientRect().height');
  assert.ok(raidDepartHeight >= 44, `Raid depart button height must be >= 44px, got ${raidDepartHeight}`);

  const raidModHeight = await evaluate('document.querySelector(\'.raid-modifier\').getBoundingClientRect().height');
  assert.ok(raidModHeight >= 44, `Raid modifier item height must be >= 44px, got ${raidModHeight}`);

  await screenshot('artifacts/pact-raid-hades-mobile-390.png');
  console.log('PASS: Mobile Raid Hunts verified and captured.');

  // Test Sunken Bell on mobile
  await click('[data-view="endless"]');
  await wait('Boolean(document.querySelector(".endless-rules"))');
  await fits('Mobile Sunken Bell');

  const endlessDepartHeight = await evaluate('document.querySelector(\'[data-depart="endless"]\').getBoundingClientRect().height');
  assert.ok(endlessDepartHeight >= 44, `Endless depart button height must be >= 44px, got ${endlessDepartHeight}`);

  const rogueSlotHeight = await evaluate('document.querySelector(\'[data-rogue-slot="0"]\').getBoundingClientRect().height');
  assert.ok(rogueSlotHeight >= 44, `Rogue slot select height must be >= 44px, got ${rogueSlotHeight}`);

  await screenshot('artifacts/sunken-bell-hades-mobile-390.png');
  console.log('PASS: Mobile The Sunken Bell verified and captured.');

  assert.deepEqual(errors, [], 'No uncaught errors on mobile');
}, { width: 390, height: 844, mobile: true });

console.log('ALL PRIORITY 7 PACT & DESCENT AUTOMATION TESTS PASSED!');
