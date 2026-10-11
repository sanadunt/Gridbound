import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING UNDERWORLD ARCHIVES & FATED PROPHECIES ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  const fresh = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // A. Field Bestiary: a grid of every enemy family with a detail sheet; a fresh save has met nobody, so every entry is a '???' silhouette.
  await click.nav('bestiary');
  await wait('Boolean(document.querySelector(".bestiary-list"))');
  assert.equal(await evaluate('document.querySelectorAll(".bestiary-grid .bestiary-cell").length'), 18, 'one cell per enemy family');
  assert.equal(await evaluate('document.querySelectorAll(".bestiary-cell.unseen").length'), 18, 'a fresh save shows only silhouettes');
  assert.equal(await evaluate('document.querySelector(".bestiary-detail h3").textContent'), '???', 'the unseen detail names nobody');
  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list .counter-note"))'), false, 'no counter (or Act IV spoiler) before the enemy is met');
  assert.equal(await evaluate('document.querySelector(".bestiary-list").textContent.includes("Hollow Choir")'), false, 'late bosses stay hidden');
  assert.equal(await evaluate('Boolean(document.querySelector(".page-controls"))'), false, 'no pager');

  // Meet two families (the ledger records kills per family), then the entries fill in.
  await evaluate(`(() => { indexedDB.deleteDatabase('gridbound.commanders.r1'); const p = { version: 3, gold: 60, claimedQuests: [], ledger: { raids: 0, victories: 2, enemies: { wolf: 1, goblin: 2 } }, roster: [0, 4, 3], cleared: [0], loadouts: { 0: { skills: [0, 1], talents: [], xp: 0, slot: 1 }, 4: { skills: [0, 1], talents: [], xp: 0, slot: 7 }, 3: { skills: [0, 1], talents: [], xp: 0, slot: 6 } }, bestFloor: 0, wins: 2, sound: false, motion: true }; localStorage.setItem('gridbound.v3', JSON.stringify(p)); })()`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fresh.identifier });
  await send('Page.reload');
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
  await wait('window.gridbound.profile().ledger.enemies.wolf === 1');
  await click.nav('bestiary');
  await wait('Boolean(document.querySelector(".bestiary-detail:not(.unseen)"))');
  assert.equal(await evaluate('document.querySelectorAll(".bestiary-cell:not(.unseen)").length'), 2, 'met families show their portrait and name');
  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list article img"))'), true, 'Monster reliquary image must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list .counter-note"))'), true, 'Tactical counter note must exist');
  const initialMonster = await evaluate('document.querySelector(".bestiary-list article h3").textContent');
  await click('.bestiary-cell[data-bestiary-pick="goblin"]');
  await wait(`document.querySelector(".bestiary-list article h3").textContent !== ${JSON.stringify(initialMonster)}`);
  await click('.bestiary-variants [data-bestiary-pick="goblin-ash"]');
  await wait('document.querySelector(".bestiary-detail").dataset.bestiaryEntry === "goblin-ash"');
  await click('.bestiary-cell.unseen');
  await wait('Boolean(document.querySelector(".bestiary-detail.unseen"))');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/bestiary-hades-desktop.png');
  console.log('✓ Captured artifacts/bestiary-hades-desktop.png');

  // B. Quest Ledger (The Fated List of Minor Prophecies)
  await click.nav('quests');
  await wait('Boolean(document.querySelector(".quest-board"))');

  assert.equal(await evaluate('Boolean(document.querySelector("[data-quest-filter]"))'), true, 'Quest filter must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-quest-recipient]"))'), true, 'Quest recipient select must exist');
  assert.ok((await evaluate('document.querySelectorAll(".quest-entry").length')) >= 1, 'At least 1 quest entry must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".quest-entry progress"))'), true, 'Quest progress bar must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".quest-entry footer p"))'), true, 'Quest reward strip must exist');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/quests-hades-desktop.png');
  console.log('✓ Captured artifacts/quests-hades-desktop.png');

  // C. Challenge Shop (Charon\'s Sunken Archive)
  await click.nav('challenge-shop');
  await wait('Boolean(document.querySelector(".challenge-shop-grid"))');

  assert.ok((await evaluate('document.querySelectorAll(".challenge-shop-grid .shop-item").length')) >= 1, 'Shop items must exist');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/shop-hades-desktop.png');
  console.log('✓ Captured artifacts/shop-hades-desktop.png');

  console.log('✓ Desktop Archives & Prophecies test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Bestiary on Mobile
  await click.nav('bestiary');
  await wait('Boolean(document.querySelector(".bestiary-list"))');

  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Bestiary must have zero horizontal overflow on mobile');
  const cells = await evaluate(`[...document.querySelectorAll('.bestiary-cell')].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; })`);
  assert.ok(cells.length === 18 && cells.every(([w, h]) => w >= 44 && h >= 44), `Bestiary cells keep 44px touch targets: ${JSON.stringify(cells.slice(0, 3))}`);

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/bestiary-hades-mobile-390.png');
  console.log('✓ Captured artifacts/bestiary-hades-mobile-390.png');

  // Quest Ledger on Mobile
  await click.nav('quests');
  await wait('Boolean(document.querySelector(".quest-board"))');

  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Quest Ledger must have zero horizontal overflow on mobile');
  const questBtnHeights = await evaluate(`[...document.querySelectorAll('.quest-actions button:not(:disabled)')].map(b => b.getBoundingClientRect().height)`);
  assert.ok(questBtnHeights.every(h => h >= 40), 'Quest action buttons must have accessible touch heights');

  const selectHeights = await evaluate(`[...document.querySelectorAll('.quest-recipient select')].map(s => s.getBoundingClientRect().height)`);
  assert.ok(selectHeights.every(h => h >= 40), 'Quest select controls must have accessible touch heights');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/quests-hades-mobile-390.png');
  console.log('✓ Captured artifacts/quests-hades-mobile-390.png');

  console.log('✓ Mobile Archives & Prophecies test passed');
}, { width: 390, height: 844, mobile: true });

console.log('ALL UNDERWORLD ARCHIVES & FATED PROPHECIES TESTS PASSED!');
