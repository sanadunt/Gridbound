import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

// Test 1: Desktop Title Screen
await withBrowser(async ({ send, wait, evaluate, screenshot, click, key, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#title-screen")');

  // Explicitly invoke showTitleScreen to simulate human player loading or navigating home
  await evaluate('window.gridbound.showTitle()');
  await wait('!document.querySelector("#title-screen").hidden');

  // Verify elements exist and are visible
  assert.equal(await evaluate('Boolean(document.querySelector("#title-screen:not([hidden])"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("#title-enter"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("#title-profiles"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("#title-journal"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("#title-settings"))'), true);

  // Take desktop title screen screenshot
  await screenshot('artifacts/title-screen-desktop.png');
  console.log('Captured artifacts/title-screen-desktop.png');

  // Test "ENTER EMBERHOLLOW" button
  await click('#title-enter');
  await wait('Boolean(document.querySelector("#title-screen").hidden)');
  assert.equal(await evaluate('Boolean(document.querySelector("#town-screen:not([hidden])"))'), true);
  console.log('PASS: Enter Emberhollow dismissed title screen into town');

  // Test clicking #home from town re-opens Title Screen
  await click('#home');
  await wait('!document.querySelector("#title-screen").hidden');
  assert.equal(await evaluate('Boolean(document.querySelector("#title-screen:not([hidden])"))'), true);
  console.log('PASS: Brand button (#home) returns to Title Screen');

  // Test clicking "COMMANDER PROFILES" opens profile modal
  console.log('STEP: clicking #title-profiles');
  await click('#title-profiles');
  console.log('STEP: waiting for modal[open]');
  await wait('Boolean(document.querySelector("#modal[open]"))');
  console.log('STEP: waiting 300ms');
  await new Promise(r => setTimeout(r, 300));
  console.log('STEP: taking screenshot title-profiles-dialog.png');
  await screenshot('artifacts/title-profiles-dialog.png');
  console.log('STEP: clicking [data-close]');
  await click('[data-close]');
  console.log('STEP: waiting for modal to close');
  await wait('!document.querySelector("#modal[open]")');
  console.log('PASS: Commander profiles opened and closed from Title Screen');

  // Test clicking "STORY JOURNAL" opens journal modal
  await click('#title-journal');
  await wait('Boolean(document.querySelector("#modal[open]"))');
  await new Promise(r => setTimeout(r, 300));
  await screenshot('artifacts/title-journal-dialog.png');
  await click('[data-close]');
  await wait('!document.querySelector("#modal[open]")');
  console.log('PASS: Story Journal opened and closed from Title Screen');

  // Test clicking "CAMP SETTINGS" opens settings modal
  await click('#title-settings');
  await wait('Boolean(document.querySelector("#modal[open]"))');
  await new Promise(r => setTimeout(r, 300));
  await screenshot('artifacts/title-settings-dialog.png');
  await click('[data-close]');
  await wait('!document.querySelector("#modal[open]")');
  console.log('PASS: Settings opened and closed from Title Screen');

  // Test keyboard Enter key to enter Emberhollow
  await evaluate('document.querySelector("#title-enter")?.focus()');
  await key('Enter');
  await wait('Boolean(document.querySelector("#title-screen").hidden)');
  console.log('PASS: Keyboard Enter dismisses title screen into town');

  assert.deepEqual(errors, []);
}, { width: 1440, height: 900 });

// Test 2: Mobile 390px Title Screen
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#title-screen")');
  await evaluate('window.gridbound.showTitle()');
  await wait('!document.querySelector("#title-screen").hidden');

  // Check no horizontal scroll overflow
  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.ok(fits, 'Mobile title screen must not have horizontal scroll overflow');

  // Check touch target heights >= 48px
  const heights = await evaluate(`(() => {
    return [
      document.querySelector('#title-enter').getBoundingClientRect().height,
      document.querySelector('#title-profiles').getBoundingClientRect().height,
      document.querySelector('#title-journal').getBoundingClientRect().height,
      document.querySelector('#title-settings').getBoundingClientRect().height
    ];
  })()`);
  assert.ok(heights.every(h => h >= 48), `Touch targets must be >= 48px, got: ${JSON.stringify(heights)}`);

  await screenshot('artifacts/title-screen-mobile-390.png');
  console.log('Captured artifacts/title-screen-mobile-390.png');

  assert.deepEqual(errors, []);
}, { width: 390, height: 844, mobile: true });

// Test 3: Mobile 360px Title Screen
await withBrowser(async ({ send, wait, evaluate, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#title-screen")');
  await evaluate('window.gridbound.showTitle()');
  await wait('!document.querySelector("#title-screen").hidden');

  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.ok(fits, 'Mobile 360 title screen must not have horizontal scroll overflow');

  await screenshot('artifacts/title-screen-mobile-360.png');
  console.log('Captured artifacts/title-screen-mobile-360.png');

  assert.deepEqual(errors, []);
}, { width: 360, height: 780, mobile: true });

console.log('ALL TITLE SCREEN TESTS PASSED!');
