import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING HADES 3-CARD BOON DRAFT ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Go to endless / The Sunken Bell
  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');

  // Clear Floor 1
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('document.querySelector("[data-boon]") && !document.querySelector("[data-boon]").disabled', 15000);

  // Assertions for 3-card Hades draft structure
  assert.equal(await evaluate('Boolean(document.querySelector(".boon-draft-modal"))'), true, 'Modal container must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".boon-draft-grid"))'), true, '3-Card grid must exist');
  assert.equal(await evaluate('document.querySelectorAll("[data-boon]").length'), 3, 'Must present exactly 3 boon cards');
  assert.equal(await evaluate('document.querySelectorAll(".boon-card").length'), 3, 'Cards must use .boon-card class');
  assert.equal(await evaluate('document.querySelectorAll(".boon-patron-badge").length'), 3, 'Each card must have a patron badge');
  assert.equal(await evaluate('document.querySelectorAll(".boon-rarity-pill").length'), 3, 'Each card must have a rarity pill');
  assert.equal(await evaluate('document.querySelectorAll(".boon-cta").length'), 3, 'Each card must have an Accept Blessing CTA');

  // Wait for GSAP card deal animation to settle
  await wait('window.getComputedStyle(document.querySelector(".boon-card")).opacity === "1"');

  // Capture Desktop Screenshot
  await screenshot('artifacts/boon-draft-hades-desktop.png');
  console.log('✓ Captured artifacts/boon-draft-hades-desktop.png');

  // Read first card ID and click it
  const boonId = await evaluate('document.querySelector("[data-boon]").dataset.boon');
  await click('[data-boon]');

  // Verify transition to Floor 2
  assert.equal(await evaluate('window.gridbound.battle.floor'), 2, 'Floor must be 2 after drafting boon');
  const boons = await evaluate('window.gridbound.battle.boons');
  assert.ok(boons.includes(boonId), `Drafted boon ${boonId} must be active in run`);

  console.log('✓ Desktop 3-Card Draft test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Go to endless
  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');

  // Clear Floor 1
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('document.querySelector("[data-boon]") && !document.querySelector("[data-boon]").disabled', 15000);

  // Check no horizontal overflow
  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.equal(fits, true, 'Mobile layout must have no horizontal overflow');

  // Wait for GSAP card deal animation to settle
  await wait('window.getComputedStyle(document.querySelector(".boon-card")).opacity === "1"');

  // Capture Mobile Screenshot
  await screenshot('artifacts/boon-draft-hades-mobile-390.png');
  console.log('✓ Captured artifacts/boon-draft-hades-mobile-390.png');

  // Select a card
  await click('[data-boon]');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 2, 'Floor must be 2 after drafting boon on mobile');

  console.log('✓ Mobile 3-Card Draft test passed');
}, { width: 390, height: 844 });
