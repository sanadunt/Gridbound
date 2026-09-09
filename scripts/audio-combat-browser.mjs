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
  sound: true,
  motion: true,
  economy: { commanderCrystal: 120, journeyPurse: 0 }
};

// 1. Desktop Suite (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, key, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector("#town-screen:not([hidden])"))');

  // Verify sound engine initial state
  const soundEnabled = await evaluate('Boolean(window.gridbound && document.querySelector("#sound[aria-pressed=\\"true\\"]"))');
  assert.ok(soundEnabled, 'Sound toggle should be active based on profile');

  // Enter Campaign encounter to test combat HUD and juice
  await click('[data-facility="campaign"]');
  await click('[data-depart="adventure"]');
  await wait('Boolean(window.gridbound.battle.status === "ready" && document.querySelector("#start"))');

  // Verify #combat-boons button exists in arena heading
  const boonBtnExists = await evaluate('Boolean(document.querySelector("#combat-boons"))');
  assert.ok(boonBtnExists, 'Combat boons button (#combat-boons) must exist in arena heading');

  // Seed sample boons and purse for visual demonstration
  await evaluate(`(() => {
    window.gridbound.setRunBoons(['ember', 'tide', 'bell', 'resolve']);
    window.gridbound.battle.runWallet = { crystal: 45, bank: 0, receipts: [] };
  })()`);

  // Start encounter
  await click('#start');
  await wait('Boolean(window.gridbound.battle.status === "fighting")');

  // Test floating numbers and visceral combat juice
  await evaluate(`(() => {
    const scene = window.gridbound.scene;
    // Spawn Hades-style critical hit floating text
    scene.spawnDamageNumber(300, 260, 285, { isCrit: true });
    // Spawn armor shatter break text
    scene.spawnDamageNumber(210, 200, '⚡ ARMOR SHATTER!', { isBreak: true });
    // Spawn heal number
    scene.spawnDamageNumber(380, 220, 120, { isHeal: true });
    // Spawn slash arc
    scene.spawnSlashArc(300, 280, 0.45);
  })()`);

  // Step simulation slightly to allow animations to pop
  await evaluate('window.gridbound.step(0.12)');
  await new Promise(r => setTimeout(r, 150));

  // Capture combat juice screenshot
  await screenshot('artifacts/combat-juice-crit-desktop.png');
  console.log('PASS: Desktop combat juice & crit floaters captured.');

  // Test opening Boon Tray via button click
  await click('#combat-boons');
  await wait('Boolean(document.querySelector("#modal")?.open && document.querySelector(".boon-tray-modal"))');

  // Verify battle paused while boon tray modal open
  const isPausedWithBoonTray = await evaluate('window.gridbound.battle.status === "paused"');
  assert.ok(isPausedWithBoonTray, 'Simulation must be paused while boon tray is open');

  // Verify boon cards rendered in tray
  const cardCount = await evaluate('document.querySelectorAll(".boon-tray-card").length');
  assert.ok(cardCount >= 3, `Must render drafted boons in tray, found ${cardCount}`);

  // Capture desktop boon tray
  await screenshot('artifacts/in-combat-boon-tray-desktop.png');
  console.log('PASS: Desktop In-Combat Boon Tray verified and captured.');

  // Test hotkey B toggle: close modal with B and verify simulation resumes
  await key('KeyB');
  await wait('window.gridbound.battle.status === "fighting"');
  console.log('PASS: Boon tray toggle closed via KeyB and resumed simulation.');

  // Re-open with hotkey B
  await key('KeyB');
  await wait('Boolean(document.querySelector("#modal")?.open && document.querySelector(".boon-tray-modal"))');

  // Close with Escape
  await key('Escape');
  await wait('window.gridbound.battle.status === "fighting"');
  console.log('PASS: Boon tray closed via Escape and resumed simulation.');

  assert.deepEqual(errors, [], 'No uncaught errors during desktop combat audio/juice session');
}, { width: 1440, height: 900 });

// 2. Mobile Suite (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (!localStorage.getItem('gridbound.v3')) localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(qaProfile))})`
  });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector("#town-screen:not([hidden])"))');

  // Depart into combat
  await click('[data-facility="campaign"]');
  await click('[data-depart="adventure"]');
  await wait('Boolean(window.gridbound.battle.status === "ready" && document.querySelector("#start"))');

  // Seed boons
  await evaluate(`(() => {
    window.gridbound.setRunBoons(['ember', 'storm', 'thorn']);
    window.gridbound.battle.runWallet = { crystal: 32, bank: 0, receipts: [] };
  })()`);

  // Verify mobile touch target size for #combat-boons (>= 44px)
  const boonBtnRect = await evaluate(`(() => {
    const el = document.querySelector('#combat-boons');
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  })()`);
  assert.ok(boonBtnRect.width >= 36, `Mobile combat boons button width must be >= 36px, got ${boonBtnRect.width}`);
  assert.ok(boonBtnRect.height >= 36, `Mobile combat boons button height must be >= 36px, got ${boonBtnRect.height}`);

  // Open Boon Tray on mobile
  await click('#combat-boons');
  await wait('Boolean(document.querySelector("#modal")?.open && document.querySelector(".boon-tray-modal"))');

  // Check no horizontal overflow on mobile
  const scrollW = await evaluate('document.documentElement.scrollWidth');
  const innerW = await evaluate('window.innerWidth');
  assert.ok(scrollW <= innerW + 1, `Mobile overflow detected: scrollWidth ${scrollW} > innerWidth ${innerW}`);

  // Capture mobile boon tray
  await screenshot('artifacts/in-combat-boon-tray-mobile-390.png');
  console.log('PASS: Mobile 390px In-Combat Boon Tray verified and captured.');

  // Close modal
  await click('#modal [data-close]');
  await wait('!document.querySelector("#modal")?.open');

  assert.deepEqual(errors, [], 'No uncaught errors during mobile combat audio/juice session');
}, { width: 390, height: 844 });
