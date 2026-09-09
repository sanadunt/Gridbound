import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';
const qaProfile = {
  version: 3,
  gold: 500,
  claimedQuests: [],
  ledger: { raids: 0, victories: 0, enemies: {} },
  roster: [0, 4, 3],
  cleared: [],
  loadouts: {
    0: { skills: [0, 1], talents: [], xp: 0, slot: 1 },
    4: { skills: [0, 1], talents: [], xp: 0, slot: 7 },
    3: { skills: [0, 1], talents: [], xp: 0, slot: 6 }
  },
  bestFloor: 2,
  wins: 0,
  sound: false,
  motion: true
};

console.log('--- Testing Desktop 1440x900 Single-Screen Viewport ---');
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("canvas")');
  await wait('Boolean(document.querySelector("#town-screen:not([hidden])"))');

  // Assert zero document scroll on Desktop Town
  const townScrollH = await evaluate('document.documentElement.scrollHeight');
  const townInnerH = await evaluate('window.innerHeight');
  console.log(`Desktop Town: scrollHeight=${townScrollH}, innerHeight=${townInnerH}`);
  assert.ok(townScrollH <= townInnerH + 1, `Desktop Town scrollHeight (${townScrollH}) must fit innerHeight (${townInnerH})`);

  // Verify internal scroll container exists and works
  const panelWrapOverflow = await evaluate('getComputedStyle(document.querySelector(".facility-panel-wrap")).overflowY');
  assert.ok(['auto', 'scroll'].includes(panelWrapOverflow), `facility-panel-wrap must have overflow-y auto or scroll, got ${panelWrapOverflow}`);

  // Switch tabs and verify no page scrolling
  for (const tab of ['party', 'quests', 'bestiary', 'challenge-shop']) {
    await click(`[data-facility="${tab}"]`);
    const tabScrollH = await evaluate('document.documentElement.scrollHeight');
    assert.ok(tabScrollH <= townInnerH + 1, `Desktop Tab ${tab} scrollHeight (${tabScrollH}) must fit innerHeight (${townInnerH})`);
  }

  // Switch back to campaign
  await click('[data-facility="campaign"]');
  await screenshot('artifacts/town-viewport-desktop.png');

  // Enter Combat
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Assert zero document scroll on Desktop Combat
  const combatScrollH = await evaluate('document.documentElement.scrollHeight');
  const combatInnerH = await evaluate('window.innerHeight');
  console.log(`Desktop Combat: scrollHeight=${combatScrollH}, innerHeight=${combatInnerH}`);
  assert.ok(combatScrollH <= combatInnerH + 1, `Desktop Combat scrollHeight (${combatScrollH}) must fit innerHeight (${combatInnerH})`);

  // Assert action bar and intent are visible in viewport without scrolling down
  const actionBottom = await evaluate('Math.round(document.querySelector("#battle-screen .action-bar").getBoundingClientRect().bottom)');
  console.log(`Action bar bottom=${actionBottom}, innerHeight=${combatInnerH}`);
  assert.ok(actionBottom <= combatInnerH + 1, `Action bar bottom (${actionBottom}) must be <= innerHeight (${combatInnerH})`);

  await screenshot('artifacts/combat-viewport-desktop.png');
  assert.deepEqual(errors, []);
  console.log('PASS Desktop Viewport Lock');
}, { width: 1440, height: 900 });

console.log('--- Testing Mobile 390x844 Single-Screen Viewport ---');
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("canvas")');
  await wait('Boolean(document.querySelector("#town-screen:not([hidden])"))');

  // Assert zero document scroll on Mobile Town
  const townScrollH = await evaluate('document.documentElement.scrollHeight');
  const townInnerH = await evaluate('window.innerHeight');
  const townScrollW = await evaluate('document.documentElement.scrollWidth');
  const townInnerW = await evaluate('window.innerWidth');
  console.log(`Mobile Town: scrollHeight=${townScrollH}, innerHeight=${townInnerH}, scrollWidth=${townScrollW}, innerWidth=${townInnerW}`);
  assert.ok(townScrollH <= townInnerH + 1, `Mobile Town scrollHeight (${townScrollH}) must fit innerHeight (${townInnerH})`);
  assert.ok(townScrollW <= townInnerW + 1, `Mobile Town scrollWidth (${townScrollW}) must fit innerWidth (${townInnerW})`);

  await screenshot('artifacts/town-viewport-mobile-390.png');

  // Enter Combat on mobile
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Assert zero document scroll on Mobile Combat
  const combatScrollH = await evaluate('document.documentElement.scrollHeight');
  const combatInnerH = await evaluate('window.innerHeight');
  const combatScrollW = await evaluate('document.documentElement.scrollWidth');
  const combatInnerW = await evaluate('window.innerWidth');
  console.log(`Mobile Combat: scrollHeight=${combatScrollH}, innerHeight=${combatInnerH}, scrollWidth=${combatScrollW}, innerWidth=${combatInnerW}`);
  assert.ok(combatScrollH <= combatInnerH + 1, `Mobile Combat scrollHeight (${combatScrollH}) must fit innerHeight (${combatInnerH})`);
  assert.ok(combatScrollW <= combatInnerW + 1, `Mobile Combat scrollWidth (${combatScrollW}) must fit innerWidth (${combatInnerW})`);

  await screenshot('artifacts/combat-viewport-mobile-390.png');
  assert.deepEqual(errors, []);
  console.log('PASS Mobile Viewport Lock');
}, { width: 390, height: 844, mobile: true });

console.log('ALL VIEWPORT TESTS PASSED SUCCESSFULLY!');
