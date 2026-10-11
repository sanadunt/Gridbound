import assert from 'node:assert/strict';
import { withBrowser, seedSave } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING HADES 3-CARD BOON DRAFT ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await seedSave(send); // the Bell Trials open with Chapter 4
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Go to endless / The Sunken Bell
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="endless"]');
  await wait('Boolean(document.querySelector("[data-depart=endless]"))');
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
  assert.equal(await evaluate('document.querySelectorAll(".boon-cta").length'), 3, 'Each card must have an Accept Blessing CTA');

  // Wait for GSAP card deal animation to settle
  await wait('window.getComputedStyle(document.querySelector(".boon-card")).opacity === "1"');

  // Capture Desktop Screenshot
  await screenshot('artifacts/boon-draft-hades-desktop.png');
  console.log('✓ Captured artifacts/boon-draft-hades-desktop.png');

  // A cleared room grants a promotion point: promote the first recruit into an advanced job.
  assert.equal(await evaluate('document.querySelector("#rogue-promote")?.hidden'), false, 'promotion panel shows with a point');
  await click('[data-rogue-promote="0"]');
  await wait('window.gridbound.battle.rogueBuild.points === 0 && Boolean(window.gridbound.battle.rogueBuild.recruits[0].job)');
  assert.equal(await evaluate('document.querySelector("#rogue-promote").hidden'), true, 'panel hides once points are spent');

  // Read first card ID and click it
  const boonId = await evaluate('document.querySelector("[data-boon]").dataset.boon');
  await click('[data-boon]');

  // Verify transition to Floor 2
  assert.equal(await evaluate('window.gridbound.battle.floor'), 2, 'Floor must be 2 after drafting boon');
  assert.ok(await evaluate('Boolean(window.gridbound.battle.hero(0).job)'), 'promotion carries into the next floor');
  const boons = await evaluate('window.gridbound.battle.boons');
  assert.ok(boons.includes(boonId), `Drafted boon ${boonId} must be active in run`);

  // Floors 1-2 are plain rooms (no bank line); clearing floor 3 completes Act I and the draft shows the bank Crystal it credited.
  assert.equal(await evaluate('Boolean(document.querySelector(".boon-bank-gain"))'), false, 'no bank line before an act clear');
  for (const floor of [2, 3]) {
    await wait(`window.gridbound.battle.floor === ${floor} && window.gridbound.battle.status === "ready" && !document.querySelector("#start-overlay").hidden`);
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    const crystal = await evaluate('window.gridbound.profile().economy.commanderCrystal');
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
    await wait('document.querySelector("[data-boon]") && !document.querySelector("[data-boon]").disabled', 15000);
    if (floor === 3) {
      const gained = await evaluate('window.gridbound.profile().economy.commanderCrystal') - crystal;
      assert.equal(gained, 6, 'Act I clear banks 6 Crystal');
      assert.equal(await evaluate('document.querySelector(".boon-bank-gain")?.textContent'), `Act clear: +${gained} ◆ banked`, 'the draft names the banked Crystal');
      await screenshot('artifacts/boon-draft-act-clear.png');
    } else {
      assert.equal(await evaluate('Boolean(document.querySelector(".boon-bank-gain"))'), false, `floor ${floor} banks nothing`);
      await click('[data-boon]');
    }
  }

  console.log('✓ Desktop 3-Card Draft test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await seedSave(send); // the Bell Trials open with Chapter 4
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Go to endless
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="endless"]');
  await wait('Boolean(document.querySelector("[data-depart=endless]"))');
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
