import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING HADES COMBAT HUD & BOSS INTENT / HEALTH BAR ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Depart into Endless combat
  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // 1. Verify Gilded Boss HUD Structure
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-hud"))'), true, 'Boss HUD must exist');
  assert.equal(await evaluate('document.querySelectorAll(".boss-crest-corner").length'), 4, '4 Filigree corner brackets must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp"))'), true, '#boss-hp must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp-ghost"))'), true, '#boss-hp-ghost must exist');
  assert.equal(await evaluate('document.querySelectorAll(".boss-phase-notch").length'), 2, 'Phase notches must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-phase-badge"))'), true, 'Phase badge must exist');

  // 2. Test Boss Damage & Ghost HP Reaction
  await evaluate('window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.65); window.gridbound.step(.1)');
  await wait('document.querySelector("#boss-hp").style.width === "65%"');
  assert.equal(await evaluate('document.querySelector("#boss-hp").style.width'), '65%');
  assert.equal(await evaluate('document.querySelector("#boss-hp-ghost").style.width'), '65%');

  // 3. Test Threat / Intent Danger Mode
  await evaluate(`(() => {
    window.gridbound.battle.threats = [{
      id: 999,
      name: 'Sunken Cataclysm',
      type: 'all',
      slots: [0, 1, 2],
      left: 3.5,
      total: 5,
      counter: '⚡ GUARD RITUAL · Cooldown party aman.',
      targetId: 0
    }];
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#intent.danger"))'), true, 'Intent must have .danger class');
  const intentText = await evaluate('document.querySelector("#intent b").textContent');
  assert.ok(intentText.includes('Sunken Cataclysm'), 'Intent title must display threat name');

  // 4. Test Ninefold Dawn God Gauge (100% Resolve)
  await evaluate('window.gridbound.battle.resolve = 100; window.gridbound.step(0)');
  await wait('Boolean(document.querySelector("#ultimate.ready"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#ultimate.ready"))'), true, 'Ultimate button must have .ready class');
  assert.equal(await evaluate('document.querySelector("#ultimate").disabled'), false, 'Ultimate button must be enabled at 100%');

  // 5. Test Party Guard Active Aura
  await evaluate('window.gridbound.battle.guardLeft = 2.1; window.gridbound.step(0)');
  await wait('Boolean(document.querySelector("#guard.guarding"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#guard.guarding"))'), true, 'Guard must have .guarding class when active');

  // Frame the combat column nicely
  await evaluate('document.querySelector(".action-bar").scrollIntoView({ block: "nearest", behavior: "instant" })');
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/combat-hud-hades-desktop.png');
  console.log('✓ Captured artifacts/combat-hud-hades-desktop.png');

  console.log('✓ Desktop Combat HUD test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Depart into Endless combat
  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Verify zero horizontal overflow
  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.equal(fits, true, 'Combat screen must have no horizontal overflow on mobile');

  // Verify tap & stance touch targets conform to strict heights
  const sizes = await evaluate(`(() => {
    const a = document.querySelector('[data-tap="0"]').getBoundingClientRect();
    const s = document.querySelector('[data-stance="0"]').getBoundingClientRect();
    return { tap: { w: a.width, h: a.height }, skill: { w: s.width, h: s.height } };
  })()`);
  assert.ok(sizes.skill.h <= 28 && sizes.skill.h >= 24, 'Stance button height must be 24-28px');
  assert.ok(sizes.tap.h > sizes.skill.h, 'Tap target must be larger than stance');

  // Trigger damage, threat, and ultimate on mobile
  await evaluate(`(() => {
    window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.52);
    window.gridbound.battle.threats = [{
      id: 998,
      name: 'Emerald Pyre',
      type: 'lane',
      slots: [3, 4, 5],
      left: 2.8,
      total: 4,
      counter: '🏃 RELOCATE HERO · Hindari tile terbakar.',
      targetId: 0
    }];
    window.gridbound.battle.resolve = 100;
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');

  // Capture Mobile Combat HUD
  await screenshot('artifacts/combat-hud-hades-mobile-390.png');
  console.log('✓ Captured artifacts/combat-hud-hades-mobile-390.png');

  console.log('✓ Mobile Combat HUD test passed');
}, { width: 390, height: 844, mobile: true });
