// Accessibility and battery health (WP11): the hidden canvas, spoken hotspot badges, the sleeping engine loop in town, quiet live regions with one
// throttled battle announcer, modal / skill picker / story scene focus, and prefers-reduced-motion with a Commander loaded.
import assert from 'node:assert/strict';
import { withBrowser, seedSave } from './browser-harness.mjs';
const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const booted = 'window.gridbound?.scene?.textures?.exists("dragon-0") && Boolean(document.querySelector(".town-spot"))';

await withBrowser(async ({ send, evaluate, wait, click, key, screenshot, errors }) => {
  await seedSave(send);
  await send('Page.navigate', { url });
  await wait(booted, 30000);

  // The DOM unit layer carries the controls; the canvas is decoration for assistive tech.
  assert.equal(await evaluate('document.querySelector("#game-canvas").getAttribute("aria-hidden")'), 'true', 'the Phaser canvas is hidden from assistive tech');
  // Every badge drawn on a building is also in its label.
  const spots = await evaluate(`[...document.querySelectorAll('.town-spot')].filter(s => s.querySelector('.spot-flag')).map(s => ({ id: s.dataset.spot, label: s.getAttribute('aria-label') }))`);
  assert.ok(spots.length > 0, 'the seeded camp shows at least one badge');
  for (const spot of spots) assert.equal(spot.label.split(' · ').length, 3, `badge state is spoken: ${JSON.stringify(spot)}`);
  assert.equal(spots.find(spot => spot.id === 'gate')?.label, 'Gate · Story · the next chapter waits');

  // In town the engine loop sleeps (no redraws of the hidden arena); a battle wakes it and leaving puts it back to sleep.
  await wait('window.gridbound.scene.game?.loop?.started && !window.gridbound.scene.game.loop.running', 10000);
  const townFrame = await evaluate('window.gridbound.scene.game.loop.frame');
  await sleep(400);
  assert.equal(await evaluate('window.gridbound.scene.game.loop.frame'), townFrame, 'no frames run while the loop sleeps in town');
  await evaluate('window.gridbound.boot("adventure", 1)');
  await wait('window.gridbound.scene.game.loop.running && document.querySelector("#battle-screen").hidden === false');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  // A sturdy party, so the threats this test raises never end the fight early.
  await evaluate('window.gridbound.battle.heroes.forEach(h => { h.maxHp *= 50; h.hp = h.maxHp; })');
  const battleFrame = await evaluate('window.gridbound.scene.game.loop.frame');
  // Headless SwiftShader can skip frames for several hundred ms right after a battle starts, so wait for the loop instead of sampling a fixed window.
  await wait(`window.gridbound.scene.game.loop.frame > ${battleFrame}`, 5000); // the woken loop renders the battle
  assert.ok(await evaluate('window.gridbound.scene.textures.exists(window.gridbound.battle.enemyId + "-7")'), 'the boss art is registered on first use (all frames)');
  await screenshot('artifacts/a11y-arena.png');

  // Live regions: the threat panel and banners are not live; quiet frames write nothing (the old HUD rewrote them ~16 times a second).
  assert.deepEqual(await evaluate('["role", "aria-live"].map(a => document.querySelector("#intent").getAttribute(a))'), [null, null], 'the threat countdown is not a live region');
  assert.equal(await evaluate('document.querySelector("#banner").getAttribute("aria-live")'), null, 'banners are not a live region');
  await evaluate('window.gridbound.battle.pause()');
  await sleep(300); // let the pause itself (and the sturdier HP) reach the HUD once
  await evaluate(`(() => { window.__mutations = [];
    const mo = new MutationObserver(list => window.__mutations.push(...list.map(m => m.type + ':' + (m.attributeName ?? m.target.parentElement?.id ?? m.target.id))));
    mo.observe(document.querySelector('#intent'), { subtree: true, childList: true, characterData: true });
    document.querySelectorAll('.party-health-card, .unit-skill').forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['aria-label', 'aria-pressed'] }));
    window.__mo = mo; })()`);
  await sleep(1500);
  assert.deepEqual(await evaluate('(window.__mo.disconnect(), window.__mutations)'), [], 'unchanged intent text and hero labels are not rewritten every frame');
  await evaluate('window.gridbound.battle.pause()');
  await wait('window.gridbound.battle.status === "fighting"');

  // One announcer speaks new threats (target and seconds), at most one message per 1.5 s.
  await evaluate(`(() => { window.__said = []; const el = document.querySelector('#battle-announcer');
    new MutationObserver(() => { if (el.textContent) window.__said.push({ text: el.textContent, at: performance.now() }); }).observe(el, { subtree: true, childList: true, characterData: true });
    const b = window.gridbound.battle; b.telegraph(); b.telegraph(); b.telegraph(); })()`);
  await wait('window.__said.length >= 2', 8000);
  await sleep(1700);
  const said = await evaluate('window.__said');
  assert.match(said[0].text, /in \d+ seconds/, `a threat is announced with its seconds: ${said[0].text}`);
  for (let i = 1; i < said.length; i++) assert.ok(said[i].at - said[i - 1].at >= 1400, `announcements are throttled: ${JSON.stringify(said)}`);
  assert.equal(await evaluate('document.querySelector("#battle-announcer").getAttribute("role")'), 'status');

  // Pause → Settings swaps the open modal's content: the focus moves to the new title instead of falling to <body>; closing returns it to Pause.
  await click('#pause');
  await wait('document.querySelector("#modal").open && Boolean(document.querySelector("#pause-settings"))');
  await click('#pause-settings');
  await wait('Boolean(document.querySelector("#setting-motion"))');
  assert.equal(await evaluate('document.activeElement.id'), 'modal-title', 'focus follows swapped modal content');
  // Escape in a pause sub-view returns to the pause menu (still paused, Resume focused); Escape there resumes.
  await key('Escape');
  await wait('document.querySelector("#modal-title")?.textContent === "PAUSE" && window.gridbound.battle.status === "paused"');
  assert.equal(await evaluate('document.activeElement.textContent'), 'Resume', 'back on the pause menu, Resume has the focus');
  await key('Escape');
  await wait('!document.querySelector("#modal").open && window.gridbound.battle.status === "fighting"');
  assert.equal(await evaluate('document.activeElement.id'), 'pause', 'closing the modal returns the focus to the control that opened it');

  // The skill picker hands the focus back to its chip.
  await evaluate('window.gridbound.battle.hero(0).skills.push(2); window.gridbound.step(0)');
  await sleep(350);
  await click('[data-skill-switch="0"]');
  await wait('!document.querySelector("#skill-picker").hidden && document.querySelector("#skill-picker").contains(document.activeElement)');
  await key('Escape');
  await wait('document.querySelector("#skill-picker").hidden');
  assert.equal(await evaluate('document.activeElement.dataset.skillSwitch'), '0', 'closing the picker returns the focus to the chip');
  await evaluate('window.gridbound.battle.hero(0).skills.pop(); window.gridbound.battle.stance(0, window.gridbound.battle.hero(0).skills[0])');

  // Victory is announced (urgent: it skips queued threat messages).
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('/Victory/.test(document.querySelector("#battle-announcer").textContent)', 5000);
  await wait('document.querySelector("#result-screen:not([hidden]) #result-town") && !document.querySelector("#result-town").disabled', 15000);
  await click('#result-town');
  await wait('Boolean(document.querySelector("#abandon-run"))');
  await click('#abandon-run');
  await wait('document.querySelector("#town-screen:not([hidden])") && !window.gridbound.scene.game.loop.running', 10000);
  assert.equal(await evaluate('document.querySelector("#battle-announcer").textContent'), '', 'the announcer is cleared in town');

  // A story scene makes the page behind it inert, speaks each page once (whole) and gives the page back afterwards.
  await click.nav('camp');
  await evaluate('document.querySelector(".town-spot").focus(); void window.gridbound.chapterIntro(0)');
  await wait('Boolean(document.querySelector(".dialogue-scene .dialogue-live")?.textContent)');
  assert.ok(await evaluate('[...document.querySelector("#app").children].filter(el => !el.classList.contains("dialogue-scene") && el.getAttribute("role") !== "status").every(el => el.inert)'), 'everything behind the scene is inert');
  assert.ok(await evaluate('[...document.querySelectorAll("#storage-status, #battle-announcer")].every(el => !el.inert)'), 'status regions stay live behind the scene');
  assert.equal(await evaluate('document.querySelector(".dialogue-text").getAttribute("aria-hidden")'), 'true', 'the typewriter text is hidden from assistive tech');
  for (let i = 0; i < 3; i++) await key('Tab');
  assert.ok(await evaluate('document.activeElement === document.body || Boolean(document.activeElement.closest(".dialogue-scene"))'), 'Tab never reaches the town behind the scene');
  await wait('!document.querySelector(".dialogue-box").hidden', 5000);
  const page = await evaluate('({ live: document.querySelector(".dialogue-live").textContent, typed: document.querySelector(".dialogue-text").textContent })');
  assert.ok(page.live.length >= page.typed.length && page.live.length > 20, `the live region holds the whole page while it types: ${JSON.stringify(page)}`);
  await key('Escape');
  await wait('!document.querySelector(".dialogue-scene")');
  assert.ok(await evaluate('[...document.querySelector("#app").children].every(el => !el.inert && !el.dataset.dialogueInert)'), 'the page is interactive again after the scene');
  assert.ok(await evaluate('document.activeElement.classList.contains("town-spot")'), 'the focus returns to the control that had it before the scene');

  // prefers-reduced-motion wins over the saved Motion setting (which is never overwritten), live and after a reload with a Commander.
  const motion = () => evaluate('({ saved: window.gridbound.profile().motion, body: document.body.classList.contains("reduced-motion"), scene: window.gridbound.scene.reducedMotion })');
  assert.deepEqual(await motion(), { saved: true, body: false, scene: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait('document.body.classList.contains("reduced-motion")');
  assert.deepEqual(await motion(), { saved: true, body: true, scene: true }, 'the media query change applies at once');
  await send('Page.reload');
  await wait(booted, 30000); // the dev hook appears once the Commander is active
  assert.deepEqual(await motion(), { saved: true, body: true, scene: true }, 'a loaded Commander keeps reduced motion on');
  await click('#settings');
  await wait('Boolean(document.querySelector("#setting-motion"))');
  assert.match(await evaluate('document.querySelector("#setting-motion").closest("label").textContent'), /Your device asks for reduced motion/);
  await key('Escape');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await wait('!document.body.classList.contains("reduced-motion")');
  assert.deepEqual(await motion(), { saved: true, body: false, scene: false }, 'motion returns when the device preference is lifted');
  assert.deepEqual(errors, []);
  console.log('PASS a11y: hidden canvas, spoken badges, sleeping loop, quiet live regions + throttled announcer, modal/picker/scene focus, reduced motion');
});
