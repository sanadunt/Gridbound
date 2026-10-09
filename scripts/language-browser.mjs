import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

await withBrowser(async ({ send, wait, evaluate, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!sessionStorage.getItem('lang-test')) { sessionStorage.setItem('lang-test', '1'); localStorage.setItem('gridbound.lang', 'en'); }` });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
  const read = () => evaluate(`({ lang: document.documentElement.lang, spot: document.querySelector('.town-spot[data-facility="campaign"]').getAttribute('aria-label'),
    enemy: (window.gridbound.boot('adventure', 1), document.querySelector('#boss-title').textContent) })`);
  const english = await read();
  assert.deepEqual(english, { lang: 'en', spot: 'Gate', enemy: 'CINDER WOLF' });
  await send('Page.reload');
  await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');

  for (const [code, expected] of [['id', { lang: 'id', spot: 'Gerbang', enemy: 'SERIGALA BARA' }], ['en', english]]) {
    await click('#settings');
    await wait(`Boolean(document.querySelector('#modal [data-lang="${code}"]'))`);
    await evaluate('window.__beforeSwitch = true');
    await click(`#modal [data-lang="${code}"]`);
    await wait('!window.__beforeSwitch && Boolean(window.gridbound && document.querySelector(".camp-scene"))', 15000);
    assert.equal(await evaluate('localStorage.getItem("gridbound.lang")'), code);
    assert.deepEqual(await read(), expected, `UI and content switch to ${code}`);
    await send('Page.reload');
    await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
  }
  assert.deepEqual(errors, []);
  console.log('PASS language switch EN → ID → EN (UI strings, town buildings, enemy content)');
}, { width: 390, height: 844, mobile: true });
