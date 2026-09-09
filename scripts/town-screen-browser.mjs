import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING TOWN SCREEN (EMBERHOLLOW) ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');
  
  // Show Title Screen and trigger GSAP Enter transition into town
  await evaluate('window.gridbound.showTitle()');
  await wait('!document.querySelector("#title-screen").hidden');
  await click('#title-enter');
  await wait('document.querySelector("#title-screen").hidden && !document.querySelector("#town-screen").hidden', 5000);
  await wait('window.getComputedStyle(document.querySelector(".facility-panel-wrap")).opacity === "1"');
  
  // Verify Town Panorama & Embers
  assert.equal(await evaluate('Boolean(document.querySelector(".town-panorama"))'), true, 'Panorama must exist');
  assert.equal(await evaluate('document.querySelectorAll(".town-ember").length >= 6'), true, 'Embers must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#town-title"))'), true, 'Town title must exist');
  assert.equal(await evaluate('document.querySelector("#town-title").textContent'), 'Emberhollow');
  
  // Capture Town Desktop
  await screenshot('artifacts/town-hades-desktop.png');
  console.log('✓ Captured artifacts/town-hades-desktop.png');

  // Verify Facility Tabs Navigation
  const facilities = ['campaign', 'party', 'quests', 'bestiary', 'challenge-shop'];
  for (const fac of facilities) {
    await click(`[data-facility="${fac}"]`);
    await wait(`document.querySelector('[data-facility="${fac}"].active')`);
    await wait('window.getComputedStyle(document.querySelector(".facility-panel-wrap")).opacity === "1"');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-facility="${fac}"].active'))`), true, `Facility ${fac} must be active`);
    if (fac === 'party') {
      await screenshot('artifacts/town-facility-training.png');
      console.log('✓ Captured artifacts/town-facility-training.png');
    } else if (fac === 'quests') {
      await screenshot('artifacts/town-facility-quests.png');
      console.log('✓ Captured artifacts/town-facility-quests.png');
    }
  }

  // Verify Hero Selection in Roster
  await click('[data-town-hero="4"]');
  await wait('Boolean(document.querySelector(\'[data-town-hero="4"].chosen\'))');
  assert.equal(await evaluate('Boolean(document.querySelector(\'[data-town-hero="4"].chosen\'))'), true, 'Hero 4 must be chosen');

  // Return to Campaign / War Table
  await click('[data-facility="campaign"]');
  await wait('Boolean(document.querySelector("[data-depart=\'adventure\']"))');
  await wait('window.getComputedStyle(document.querySelector(".facility-panel-wrap")).opacity === "1"');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-depart=\'adventure\']"))'), true, 'Depart button must exist');

  console.log('✓ Desktop Town tests passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewports (390x844 and 360x780)
for (const [w, h] of [[390, 844], [360, 780]]) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("#town-screen")');
    
    // Show Title Screen and enter Emberhollow
    await evaluate('window.gridbound.showTitle()');
    await wait('!document.querySelector("#title-screen").hidden');
    await click('#title-enter');
    await wait('document.querySelector("#title-screen").hidden && !document.querySelector("#town-screen").hidden', 5000);
    await wait('window.getComputedStyle(document.querySelector(".facility-panel-wrap")).opacity === "1"');

    // Verify zero horizontal overflow
    const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
    assert.equal(fits, true, `No horizontal overflow at ${w}x${h}`);

    // Verify touch targets
    const tabHeight = await evaluate('document.querySelector(".facility-tabs button").getBoundingClientRect().height');
    assert.ok(tabHeight >= 32, `Tab touch target height ${tabHeight} >= 32px`);

    await screenshot(`artifacts/town-hades-mobile-${w}.png`);
    console.log(`✓ Captured artifacts/town-hades-mobile-${w}.png`);
  }, { width: w, height: h, mobile: true });
}

console.log('ALL TOWN SCREEN TESTS PASSED!');
