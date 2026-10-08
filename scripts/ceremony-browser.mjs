import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

console.log('--- TESTING FULL-SCREEN VICTORY, DEFEAT & INTERMISSION RESULTS ---');

// 1. Victory Ceremony (Desktop 1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, key }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Start Chapter 1 Adventure
  await click.nav('campaign');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  const count = await evaluate('window.gridbound.battle.stageCount');
  for (let stage = 0; stage < count; stage += 1) {
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
    await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")');
    if (stage < count - 1) {
      await click('#next-wave');
      await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden');
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
    }
  }

  // Verify full-screen victory scene
  assert.equal(await evaluate('Boolean(document.querySelector("#result-screen .result-ceremony-modal.victory"))'), true, 'Victory result scene must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.victory .result-banner"))'), true, 'Victory banner must exist');
  assert.equal(await evaluate('document.querySelectorAll(".result-ceremony-modal .win").length >= 2'), true, 'Result uses JRPG windows');
  assert.ok((await evaluate('document.querySelector("#result-title").textContent')).includes('The bell remembers'), 'Victory title must match');

  // Check XP Cards Grid and Selectors
  assert.equal(await evaluate('document.querySelector("#result-details").hidden'), true, 'Secondary breakdowns stay closed in the summary');
  await click('#result-details-toggle');
  assert.equal(await evaluate('!document.querySelector("#result-details").hidden && document.querySelector("#result-screen").dataset.detailsOpen === "true"'), true, 'Details opens as a separate result state');
  await key('Escape');
  assert.equal(await evaluate('document.querySelector("#result-details").hidden && document.querySelector("#result-screen").dataset.detailsOpen !== "true"'), true, 'Escape returns to the result summary');
  assert.equal(await evaluate('document.querySelector("#battle-screen").inert && Number(getComputedStyle(document.querySelector("#result-screen")).zIndex) > Number(getComputedStyle(document.querySelector("#battle-screen")).zIndex)'), true, 'Result screen must cover inert combat');
  assert.equal(await evaluate('Boolean(document.querySelector(".recruit-notice"))'), true, 'Recruit notice for Sable must appear');

  assert.equal(await evaluate('document.querySelectorAll(".stat-plaque").length'), 3, 'Summary and details retain survivors, rewards, and elapsed time');
  assert.equal(await evaluate('Boolean(document.querySelector("#result-town"))'), true, '#result-town CTA must exist');

  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/victory-hades-desktop.png');
  console.log('✓ Captured artifacts/victory-hades-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const mobileBounds = JSON.parse(await evaluate('JSON.stringify([...document.querySelectorAll("#result-screen .ceremony-actions button, #result-details-toggle")].map(button => { const box = button.getBoundingClientRect(); return {top:box.top,bottom:box.bottom,height:box.height}; }))'));
  const mobileHeight = await evaluate('innerHeight');
  assert.ok(mobileBounds.length >= 3 && mobileBounds.every(box => box.top >= 0 && box.bottom <= mobileHeight && box.height >= 44), 'Victory actions and Details must fit 360×640 with 44px targets');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1'), 'Mobile victory result must not scroll the document');
  await click('#result-details-toggle');
  await wait('!document.querySelector("#result-details").hidden');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= innerHeight + 1'), 'Opening mobile result Details must not scroll the document');
  await key('Escape');
  await wait('document.querySelector("#result-details").hidden');
  assert.equal(await evaluate('document.querySelector("#result-screen").scrollTop'), 0, 'Returning from Details restores the result scene to its summary position');
  assert.ok(await evaluate('document.querySelector(".result-banner").getBoundingClientRect().top >= 0'), 'Mobile victory crest must remain in view after Details closes');
  await screenshot('artifacts/victory-hades-mobile-360x640.png');
  console.log('✓ Captured artifacts/victory-hades-mobile-360x640.png');

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

  await click.nav('campaign');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Clear Wave 1
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
  await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")');

  // Verify the intermission result remains a full-screen state.
  assert.equal(await evaluate('Boolean(document.querySelector("#result-screen .result-ceremony-modal.wave-clear"))'), true, 'Wave clear result must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.wave-clear .result-banner"))'), true, 'Wave clear banner must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#next-wave"))'), true, '#next-wave CTA must exist');
  const mobileBounds = await evaluate('JSON.stringify([...document.querySelectorAll("#result-screen .ceremony-actions button, #result-details-toggle")].map(button => { const box = button.getBoundingClientRect(); return {top:box.top,bottom:box.bottom,height:box.height}; }))');
  const controls = JSON.parse(mobileBounds);
  const viewportHeight = await evaluate('innerHeight');
  assert.ok(controls.length >= 3 && controls.every(box => box.top >= 0 && box.bottom <= viewportHeight && box.height >= 44), 'Intermission actions and Details must remain visible 44px targets');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1'), 'Result screen must not create document scrolling');
  await click('#result-town');
  await wait('document.querySelector("#modal").open');
  assert.ok(await evaluate('document.querySelector("#modal").textContent.includes("Abandon ends")'), 'Leaving an incomplete encounter must present a confirmation');
  await click('#modal button[data-close]:not(.modal-close)');
  await wait('!document.querySelector("#modal").open && window.gridbound.battle.status === "victory" && !document.querySelector("#result-screen").hidden');


  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/wave-clear-hades-mobile-390.png');
  console.log('✓ Captured artifacts/wave-clear-hades-mobile-390.png');

  await click('#next-wave');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden');
  console.log('✓ Wave clear ceremony flow passed');
}, { width: 390, height: 844, mobile: true });

// 3. Defeat Ceremony (Desktop 1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  await click.nav('campaign');
  await click.nav('endless');
  await click('[data-depart="endless"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');

  // Trigger party wipeout
  await evaluate('window.gridbound.battle.heroes.forEach(h => h.hp = 0); window.gridbound.step(.1)');
  await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")');

  // Verify the full-screen defeat scene
  assert.equal(await evaluate('Boolean(document.querySelector("#result-screen .result-ceremony-modal.defeat"))'), true, 'Defeat result scene must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".result-ceremony-modal.defeat .result-banner"))'), true, 'Defeat banner must exist');
  assert.ok((await evaluate('document.querySelector("#result-title").textContent')).includes('Rally, adapt, return'), 'Defeat title must match');
  assert.equal(await evaluate('Boolean(document.querySelector("#retry"))'), true, '#retry CTA must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#result-town"))'), true, '#result-town CTA must exist');

  await new Promise(resolve => setTimeout(resolve, 400));
  await screenshot('artifacts/defeat-hades-desktop.png');
  console.log('✓ Captured artifacts/defeat-hades-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  const defeatBounds = JSON.parse(await evaluate('JSON.stringify([...document.querySelectorAll("#result-screen .ceremony-actions button, #result-details-toggle")].map(button => { const box = button.getBoundingClientRect(); return {top:box.top,bottom:box.bottom,height:box.height}; }))'));
  const defeatHeight = await evaluate('innerHeight');
  assert.ok(defeatBounds.length >= 3 && defeatBounds.every(box => box.top >= 0 && box.bottom <= defeatHeight && box.height >= 44), 'Defeat actions and Details must fit 360×640 with 44px targets');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1'), 'Mobile defeat result must not scroll the document');
  await screenshot('artifacts/defeat-hades-mobile-360x640.png');

  await click('#retry');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 1, 'Retry restarts at floor 1');
  console.log('✓ Defeat ceremony flow passed');
}, { width: 1440, height: 900 });

console.log('ALL CEREMONY BROWSER TESTS PASSED!');
