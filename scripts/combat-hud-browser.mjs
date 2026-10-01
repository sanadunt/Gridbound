import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

console.log('--- TESTING HADES COMBAT HUD & BOSS INTENT / HEALTH BAR ---');

async function enterCampaignBattle({ click, wait, evaluate }) {
  await wait('Boolean(window.gridbound && document.querySelector(\'[data-facility="campaign"]\'))');
  await evaluate('document.fonts.ready');
  await click('[data-facility="campaign"]');
  await wait('Boolean(document.querySelector(\'[data-zone="0"]\'))');
  await click('[data-zone="0"]');
  await wait('Boolean(document.querySelector(\'[data-depart="adventure"]\'))');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
}

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });
  // 1. Verify Gilded Boss HUD Structure
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-hud"))'), true, 'Boss HUD must exist');
  assert.equal(await evaluate('document.querySelectorAll(".boss-crest-corner").length'), 4, '4 Filigree corner brackets must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp"))'), true, '#boss-hp must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp-ghost"))'), true, '#boss-hp-ghost must exist');
  assert.equal(await evaluate('document.querySelectorAll(".boss-phase-notch").length'), 2, 'Phase notches must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-phase-badge"))'), true, 'Phase badge must exist');

  // 2. Test Boss Damage & Ghost HP Reaction
  await evaluate('window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.65); window.gridbound.step(.1)');
  const bossHealth = await evaluate(`(() => {
    const battle = window.gridbound.battle;
    return {
      expected: battle.bossHp / battle.bossMax * 100,
      health: document.querySelector("#boss-hp").style.width,
      ghost: document.querySelector("#boss-hp-ghost").style.width
    };
  })()`);
  assert.ok(Math.abs(Number.parseFloat(bossHealth.health) - bossHealth.expected) < 0.001, 'Boss HP bar must track the current health ratio');
  assert.equal(bossHealth.ghost, bossHealth.health, 'Ghost bar must follow the current health ratio');

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

  await screenshot('artifacts/combat-hud-hades-desktop.png');
  console.log('✓ Captured artifacts/combat-hud-hades-desktop.png');

  console.log('✓ Desktop Combat HUD test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });
  const mobileBounds = await evaluate(`(() => {
    const bounds = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const column = document.querySelector('#battle-screen .arena-column');
    const targets = Array.from(document.querySelectorAll(
      '#battle-screen .battle-view-tabs button, #battle-screen .arena-heading-controls button, #battle-screen .lane-targets button, #battle-screen .party-health-tray button, #battle-screen .action-bar button, #battle-screen [data-tap]'
    )).filter(button => {
      const r = button.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    }).map(button => {
      const r = button.getBoundingClientRect();
      return { height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      column: { clientHeight: column.clientHeight, scrollHeight: column.scrollHeight },
      content: ['.arena-heading', '.threat-band', '.battle-banner', '.arena', '.party-health-tray', '.action-bar'].map(bounds),
      targets
    };
  })()`);
  assert.ok(mobileBounds.page.width <= mobileBounds.viewport.width + 1, 'Combat screen must not overflow horizontally');
  assert.ok(mobileBounds.page.height <= mobileBounds.viewport.height + 1, 'Combat screen must not overflow vertically');
  assert.ok(mobileBounds.column.scrollHeight <= mobileBounds.column.clientHeight + 1, 'Phone combat content must fit without an internal scroll');
  assert.ok(mobileBounds.content.every(box => box.left >= 0 && box.right <= mobileBounds.viewport.width && box.top >= 0 && box.bottom <= mobileBounds.viewport.height), 'Required combat regions must remain in the viewport');
  assert.ok(mobileBounds.targets.length > 0 && mobileBounds.targets.every(target => target.height >= 44 && target.left >= 0 && target.right <= mobileBounds.viewport.width && target.top >= 0 && target.bottom <= mobileBounds.viewport.height), 'Mobile combat targets must be 44px and fully visible');


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

// 3. Small-phone Viewport (360x640)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });

  await evaluate(`(() => {
    window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.52);
    window.gridbound.battle.threats = [{
      id: 997,
      name: 'Emerald Pyre',
      type: 'lane',
      slots: [3, 4, 5],
      left: 2.8,
      total: 4,
      counter: 'RELOCATE HERO · Avoid the burning tile before impact.',
      targetId: 0
    }];
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');
  const bounds = await evaluate(`(() => {
    const box = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const column = document.querySelector('#battle-screen .arena-column');
    const targets = Array.from(document.querySelectorAll(
      '#battle-screen .battle-view-tabs button, #battle-screen .arena-heading-controls button, #battle-screen .lane-targets button, #battle-screen .party-health-tray button, #battle-screen .action-bar button, #battle-screen [data-tap]'
    )).filter(button => {
      const r = button.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    }).map(button => {
      const r = button.getBoundingClientRect();
      return { height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      column: { clientHeight: column.clientHeight, scrollHeight: column.scrollHeight },
      content: ['.arena-heading', '.threat-band', '.battle-banner', '.arena', '.party-health-tray', '.action-bar'].map(box),
      targets
    };
  })()`);
  assert.equal(bounds.viewport.width, 360);
  assert.equal(bounds.viewport.height, 640);
  assert.ok(bounds.page.width <= bounds.viewport.width + 1, 'Small-phone combat must not overflow horizontally');
  assert.ok(bounds.page.height <= bounds.viewport.height + 1, 'Small-phone combat must not overflow vertically');
  assert.ok(bounds.column.scrollHeight <= bounds.column.clientHeight + 1,
    `Small-phone threat state must fit without internal scrolling: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.content.every(box => box.left >= 0 && box.right <= bounds.viewport.width && box.top >= 0 && box.bottom <= bounds.viewport.height), 'Required combat regions must remain in the viewport');
  assert.ok(bounds.targets.length > 0 && bounds.targets.every(target => target.height >= 44 && target.left >= 0 && target.right <= bounds.viewport.width && target.top >= 0 && target.bottom <= bounds.viewport.height), 'Small-phone combat targets must be 44px and fully visible');
  await screenshot('artifacts/combat-hud-360x640.png');
  assert.deepEqual(errors, []);
  console.log('✓ 360x640 combat fit and target-size test passed');
}, { width: 360, height: 640, mobile: true });
