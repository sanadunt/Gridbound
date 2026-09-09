import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING HADES VICTORY, DEFEAT & EXPEDITION CEREMONY SCREENS ---');

// 1. Victory Ceremony (Desktop 1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Start Chapter 1 Adventure
  await click('[data-facility="campaign"]');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  const count = await evaluate('window.gridbound.battle.stageCount');
  for (let stage = 0; stage < count; stage += 1) {
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
    await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")');
    if (stage < count - 1) {
      await click('#next-wave');
      await wait('window.gridbound.battle.status === "ready" && !document.querySelector("#modal").open');
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
    }
  }

  // Verify Victory Ceremony Modal
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.victory"))'), true, 'Victory modal class must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".ceremony-crest.victory"))'), true, 'Victory laurel crest must exist');
  assert.equal(await evaluate('document.querySelectorAll(".ceremony-corner").length'), 4, '4 Corner brackets must exist');
  assert.ok((await evaluate('document.querySelector("#modal-title").textContent')).includes('Bring the fire home'), 'Victory title must match');

  // Check XP Cards Grid and Selectors
  assert.equal(await evaluate('Boolean(document.querySelector(".xp-results"))'), true, '.xp-results must exist');
  assert.equal(await evaluate('document.querySelectorAll("[data-xp-kind=active]").length'), 3, '3 active starting heroes');
  assert.equal(await evaluate('Boolean(document.querySelector(".recruit-notice"))'), true, 'Recruit notice for Sable must appear');

  // Check Stat Plaques
  assert.equal(await evaluate('document.querySelectorAll(".stat-plaque").length'), 3, '3 stat plaques must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#result-town"))'), true, '#result-town CTA must exist');

  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/victory-hades-desktop.png');
  console.log('✓ Captured artifacts/victory-hades-desktop.png');

  // Click #result-town and verify safe return to Emberhollow
  await click('#result-town');
  await wait('document.querySelector("#town-screen:not([hidden])")');
  console.log('✓ Victory ceremony flow passed');
}, { width: 1440, height: 900 });

// 2. Wave Clear Screen (Mobile 390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  await click('[data-facility="campaign"]');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Clear Wave 1
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
  await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")');

  // Verify Wave Clear Modal
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.wave-clear"))'), true, 'Wave clear modal class must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".ceremony-crest.wave-clear"))'), true, 'Wave clear crest must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#next-wave"))'), true, '#next-wave CTA must exist');

  // Verify responsive fit (no horizontal scroll)
  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.equal(fits, true, 'Wave clear modal must fit within 390px viewport');

  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/wave-clear-hades-mobile-390.png');
  console.log('✓ Captured artifacts/wave-clear-hades-mobile-390.png');

  await click('#next-wave');
  await wait('window.gridbound.battle.status === "ready" && !document.querySelector("#modal").open');
  console.log('✓ Wave clear ceremony flow passed');
}, { width: 390, height: 844, mobile: true });

// 3. Defeat Ceremony (Desktop 1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  await click('[data-view="endless"]');
  await click('[data-depart="endless"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Trigger party wipeout
  await evaluate('window.gridbound.battle.heroes.forEach(h => h.hp = 0); window.gridbound.step(.1)');
  await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")');

  // Verify Defeat Ceremony Modal
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.defeat"))'), true, 'Defeat modal class must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".ceremony-crest.defeat"))'), true, 'Defeat skull crest must exist');
  assert.ok((await evaluate('document.querySelector("#modal-title").textContent')).includes('Rally. Adapt. Return'), 'Defeat title must match');
  assert.equal(await evaluate('Boolean(document.querySelector("#retry"))'), true, '#retry CTA must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#result-town"))'), true, '#result-town CTA must exist');

  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/defeat-hades-desktop.png');
  console.log('✓ Captured artifacts/defeat-hades-desktop.png');

  await click('#retry');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 1, 'Retry restarts at floor 1');
  console.log('✓ Defeat ceremony flow passed');
}, { width: 1440, height: 900 });

console.log('ALL CEREMONY BROWSER TESTS PASSED!');
