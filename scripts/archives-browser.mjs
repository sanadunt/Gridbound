import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING UNDERWORLD ARCHIVES & FATED PROPHECIES ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // A. Field Bestiary (Codex of the Underworld)
  await click('[data-facility="bestiary"]');
  await wait('Boolean(document.querySelector(".bestiary-list"))');

  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list article img"))'), true, 'Monster reliquary image must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list article h3"))'), true, 'Monster name must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".bestiary-list .counter-note"))'), true, 'Tactical counter note must exist');

  // Test pagination forward
  const initialMonster = await evaluate('document.querySelector(".bestiary-list article h3").textContent');
  await click('[data-bestiary-page="1"]');
  await wait('Boolean(document.querySelector(".bestiary-list article h3"))');
  const nextMonster = await evaluate('document.querySelector(".bestiary-list article h3").textContent');
  assert.notEqual(initialMonster, nextMonster, 'Pagination must load next monster record');

  // Page back
  await click('[data-bestiary-page="-1"]');
  await wait('Boolean(document.querySelector(".bestiary-list article h3"))');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/bestiary-hades-desktop.png');
  console.log('✓ Captured artifacts/bestiary-hades-desktop.png');

  // B. Quest Ledger (The Fated List of Minor Prophecies)
  await click('[data-facility="quests"]');
  await wait('Boolean(document.querySelector(".quest-pages"))');

  assert.equal(await evaluate('Boolean(document.querySelector("[data-quest-filter]"))'), true, 'Quest filter must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-quest-recipient]"))'), true, 'Quest recipient select must exist');
  assert.ok((await evaluate('document.querySelectorAll(".quest-entry").length')) >= 1, 'At least 1 quest entry must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".quest-entry progress"))'), true, 'Quest progress bar must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".quest-entry footer p"))'), true, 'Quest reward strip must exist');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/quests-hades-desktop.png');
  console.log('✓ Captured artifacts/quests-hades-desktop.png');

  // C. Challenge Shop (Charon\'s Sunken Archive)
  await click('[data-facility="challenge-shop"]');
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
  await click('[data-facility="bestiary"]');
  await wait('Boolean(document.querySelector(".bestiary-list"))');

  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Bestiary must have zero horizontal overflow on mobile');
  const bestiaryBtnHeights = await evaluate(`[...document.querySelectorAll('.bestiary-list .page-controls button:not(:disabled)')].map(b => b.getBoundingClientRect().height)`);
  assert.ok(bestiaryBtnHeights.every(h => h >= 40), 'Bestiary pager buttons must have accessible touch heights');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/bestiary-hades-mobile-390.png');
  console.log('✓ Captured artifacts/bestiary-hades-mobile-390.png');

  // Quest Ledger on Mobile
  await click('[data-facility="quests"]');
  await wait('Boolean(document.querySelector(".quest-pages"))');

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
