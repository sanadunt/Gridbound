import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';
const qaProfile = {
  version: 3,
  gold: 1500,
  economy: { gold: 1500, commanderCrystal: 200, materials: {} },
  challengeUnlocks: [],
  claimedQuests: [],
  ledger: { raids: 0, victories: 0, enemies: {} },
  roster: [0, 4, 3, 2, 7, 1, 5, 6, 8],
  cleared: [0, 1, 2, 3, 4], // Act I complete (0,1,2,3), Ch 5 complete (4)
  storyActive: [0, 4, 3, 2],
  loadouts: {
    0: { skills: [0, 1], talents: [], xp: 400, slot: 1 },
    4: { skills: [0, 1], talents: [], xp: 400, slot: 7 },
    3: { skills: [0, 1], talents: [], xp: 400, slot: 6 },
    2: { skills: [0, 1], talents: [], xp: 400, slot: 2 },
    7: { skills: [0, 1], talents: [], xp: 400, slot: 3 },
    1: { skills: [0, 1], talents: [], xp: 400, slot: 0 },
    5: { skills: [0, 1], talents: [], xp: 400, slot: 4 },
    6: { skills: [0, 1], talents: [], xp: 400, slot: 5 },
    8: { skills: [0, 1], talents: [], xp: 400, slot: 8 }
  },
  bestFloor: 3,
  wins: 1,
  sound: true,
  motion: true
};

console.log('--- Testing World Map System (Desktop 1440x900) ---');
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("canvas")');
  
  await evaluate(`localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(qaProfile)}))`);
  await send('Page.reload');
  await wait('window.gridbound && document.querySelector("canvas")');
  await wait('Boolean(document.querySelector("#town-screen:not([hidden])"))');

  const cleared = await evaluate('window.gridbound.profile().cleared');
  console.log('Profile cleared:', JSON.stringify(cleared));
  assert.ok(cleared.length >= 5, 'Profile must have cleared zones loaded');

  // Verify World Map presence
  assert.equal(await evaluate('Boolean(document.querySelector(".world-map-wrapper"))'), true, 'World map container must be rendered');
  assert.equal(await evaluate('Boolean(document.querySelector(".world-map-svg"))'), true, 'SVG cartography canvas must be rendered');

  // Check 4 Act selector tabs
  const actTabsCount = await evaluate('document.querySelectorAll(".map-act-tab").length');
  assert.equal(actTabsCount, 4, 'Must render 4 Act selector tabs');

  // Because cleared.length === 5, the active Act should automatically be Act II (The Ashlands)
  const initialActTitle = await evaluate('document.querySelector(".map-title-block h2").textContent');
  assert.match(initialActTitle, /Ashlands/, 'Should initialize on Act II for progressing player');
  await screenshot('artifacts/world-map-desktop-act2.png');

  // Switch back to Act I via Act I Tab
  await click('.map-act-tab:nth-child(1)');
  await wait('document.querySelector(".biome-act-1")');
  await screenshot('artifacts/world-map-desktop-act1.png');

  // Click on Chapter 4 (Emerald Gate, Act I boss)
  await click('[data-zone="3"]');
  const bossTitle = await evaluate('document.querySelector(".mission-brief h3").textContent');
  assert.match(bossTitle, /Emerald Gate/, 'Dossier must display The Emerald Gate');
  const bossAdversary = await evaluate('document.querySelector(".boss-intel h4").textContent');
  assert.match(bossAdversary, /Vharok/, 'Boss adversary must be Vharok');

  // Navigate back to Act II
  await click('.map-act-tab:nth-child(2)');
  await wait('document.querySelector(".biome-act-2")');

  // In Act II, Ch 5 (zone 4) is cleared, Ch 6 (zone 5) is active
  const ch6TitleAttr = await evaluate('document.querySelector("[data-zone=\\"5\\"]").title');
  assert.match(ch6TitleAttr, /Glass Ferry/, 'Chapter 6 must be Glass Ferry');

  // Click on Chapter 6
  await click('[data-zone="5"]');
  const ch6Title = await evaluate('document.querySelector(".mission-brief h3").textContent');
  assert.match(ch6Title, /Glass Ferry/);

  // Test chapter stepper buttons
  await click('[data-campaign-page="-1"]');
  const prevTitle = await evaluate('document.querySelector(".mission-brief h3").textContent');
  assert.match(prevTitle, /Empty Census/, 'Stepper must move back to Empty Census');

  await click('[data-campaign-page="1"]');
  const nextTitle = await evaluate('document.querySelector(".mission-brief h3").textContent');
  assert.match(nextTitle, /Glass Ferry/, 'Stepper must move forward to Glass Ferry');

  // Check zero document scroll
  const scrollH = await evaluate('document.documentElement.scrollHeight');
  const innerH = await evaluate('window.innerHeight');
  assert.ok(scrollH <= innerH + 1, `Desktop scrollHeight (${scrollH}) must fit innerHeight (${innerH})`);

  // Verify departure from world map works
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  console.log('PASS: Successfully entered expedition from World Map selection');

  assert.deepEqual(errors, []);
  console.log('PASS Desktop World Map');
}, { width: 1440, height: 900 });

console.log('--- Testing World Map System (Mobile 390x844) ---');
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("canvas")');
  
  await evaluate(`localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(qaProfile)}))`);
  await send('Page.reload');
  await wait('window.gridbound && document.querySelector("canvas")');
  await wait('Boolean(document.querySelector("#town-screen:not([hidden])"))');

  // Assert mobile fit
  const scrollW = await evaluate('document.documentElement.scrollWidth');
  const innerW = await evaluate('window.innerWidth');
  assert.ok(scrollW <= innerW + 1, `Mobile scrollWidth (${scrollW}) must fit innerWidth (${innerW})`);

  const scrollH = await evaluate('document.documentElement.scrollHeight');
  const innerH = await evaluate('window.innerHeight');
  assert.ok(scrollH <= innerH + 1, `Mobile scrollHeight (${scrollH}) must fit innerHeight (${innerH})`);

  await screenshot('artifacts/world-map-mobile-390.png');

  // Switch acts on mobile
  await click('.map-act-tab:nth-child(1)');
  await wait('document.querySelector(".biome-act-1")');

  assert.deepEqual(errors, []);
  console.log('PASS Mobile World Map');
}, { width: 390, height: 844, mobile: true });

console.log('ALL WORLD MAP BROWSER TESTS PASSED!');
