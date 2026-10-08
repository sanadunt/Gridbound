import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

for (const [width, height] of [[390, 844], [1440, 900]]) {
  await withBrowser(async ({ send, wait, evaluate, click, key, screenshot, errors }) => {
    await send('Page.navigate', { url });
    await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
    await evaluate('void window.gridbound.chapterIntro(4)');
    await wait('Boolean(document.querySelector(".dialogue-scene .dialogue-card h2"))');
    assert.equal(await evaluate('document.querySelector(".dialogue-card h2").textContent'), 'The Empty Census');
    await click('.dialogue-scene');
    await wait('!document.querySelector(".dialogue-box").hidden');
    assert.equal(await evaluate('document.querySelector(".dialogue-speaker b").textContent'), 'MIRA', 'Speaker comes from the chapter data');
    await click('.dialogue-box');
    await wait('document.querySelector(".dialogue-box").classList.contains("ready")');
    const page = await evaluate('document.querySelector(".dialogue-text").textContent');
    assert.ok(page.length > 20 && page.length <= 230, `Pages fit the message box: ${page.length}`);
    assert.match(await evaluate('document.querySelector(".dialogue-count").textContent'), /^1\/\d+$/);
    await screenshot(`artifacts/story-scene-${width}.png`);
    await key('Enter');
    await wait('document.querySelector(".dialogue-count").textContent.startsWith("2/")');
    await key('Escape');
    await wait('!document.querySelector(".dialogue-scene")');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-scene"))'), true, 'Skipping returns to the town untouched');
    assert.deepEqual(errors, []);
    console.log(`PASS story scene ${width}×${height}: title card, speaker, pagination, keyboard advance and skip`);
  }, { width, height, mobile: width < 500 });
}
