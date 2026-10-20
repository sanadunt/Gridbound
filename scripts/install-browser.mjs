// Install and fullscreen on the web build (phone contract I1, I2, I6; package INSTALL), on emulated phones with real touches:
//  1. Android (Pixel 7), dev server: Config → Fullscreen on a top-level page with the touch sub-line; on it locks portrait and is
//     remembered; an open Config is shown again on top; the Escape that leaves fullscreen takes no game Back step; after a reload the
//     first real tap (webdriver spoofed) asks for fullscreen again.
//  2. iPhone (15, insets 59/34): no Fullscreen row (no element fullscreen there), the 7-day line plus the Home Screen advice in Config and
//     Save files (EN and ID); standalone (display-mode emulated, or navigator.standalone): 'Saves are kept by the Home Screen app', no
//     advice; the bare title's Back with nothing before it is harmless.
//  3. The production web build (dist/ through server.js; skipped without a web build): the manifest is linked, served as
//     application/manifest+json and parsed by Chrome without errors; a beforeinstallprompt gives Config an Install row whose tap calls
//     prompt(); appinstalled removes it.
// Needs a dev server (GRIDBOUND_URL, default http://127.0.0.1:5180/) and CHROME_PATH. INSTALL_ONLY=android|iphone|web runs one part.
// Screenshots: artifacts/phone-wp-install/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { withBrowser, seedSave, ACT_TWO_SAVE, REMINDER_SEEN } from './browser-harness.mjs';

const URL = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const ONLY = process.env.INSTALL_ONLY || '';
const SHOTS = 'artifacts/phone-wp-install';
await mkdir(SHOTS, { recursive: true });
const sleep = ms => new Promise(done => setTimeout(done, ms));
const SPOOF = "try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch {}";
// Records orientation locks (headless Chrome refuses them outside a real phone).
const LOCK_SPY = "window.__locks = []; try { const o = screen.orientation; o.lock = p => { window.__locks.push(p); return Promise.resolve(); }; o.unlock = () => { window.__locks.push('unlock'); }; } catch {}";
const P7 = { width: 412, height: 915, dpr: 2.625, ua: 'android', insets: { bottom: 24 } };
const I15 = { width: 393, height: 852, dpr: 3, ua: 'iphone', insets: { top: 59, bottom: 34 } };
const results = [];
const pass = name => { results.push(name); console.log(`PASS ${name}`); };
const booted = 'Boolean(document.querySelector(".town-spot") || (document.querySelector("#title-screen") && !document.querySelector("#title-screen").hidden))';
const configOpen = 'Boolean(document.querySelector("dialog#modal[open] #export-text"))';
/** Pass the title as a player does: the press phase, then Enter Emberhollow. */
async function enter({ evaluate, wait, touch }) {
  const titleUp = 'Boolean(document.querySelector("#title-screen:not([hidden])"))';
  for (let i = 0; i < 8 && await evaluate(titleUp); i++) {
    if (await evaluate('document.querySelector("#title-screen")?.classList.contains("press-phase")')) await touch.tap({ x: 200, y: 360 });
    else if (await evaluate('Boolean(document.querySelector("#title-screen:not([hidden]) #title-enter"))')) await touch.tap('#title-enter');
    await sleep(700);
  }
  await wait(`!${titleUp} && Boolean(document.querySelector(".town-spot"))`, 15000);
}

if (!ONLY || ONLY === 'android') await withBrowser(async t => {
  const { send, evaluate, wait, touch, screenshot, errors, key } = t;
  await seedSave(send);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: LOCK_SPY });
  await send('Page.navigate', { url: URL });
  await wait(booted, 20000);
  await wait('Boolean(document.querySelector(".town-spot"))', 15000);
  // 1. The row on a top-level page, with the touch sub-line.
  assert.equal(await evaluate('document.fullscreenEnabled && window.self === window.top'), true, 'a top-level page that may go fullscreen');
  await touch.tap('#settings');
  await wait(configOpen);
  assert.equal(await evaluate('Boolean(document.querySelector("#setting-fullscreen"))'), true, 'Config offers Fullscreen on the Android web build');
  assert.match(await evaluate('document.querySelector("#setting-fullscreen").closest(".setting-row").textContent'), /Your phone's Back gesture leaves it/);
  assert.equal(await evaluate('Boolean(document.querySelector("#install-row"))'), false, 'no Install row without the browser\'s offer');
  await screenshot(`${SHOTS}/p7-config.png`);
  pass('android: Config → Fullscreen on the web build, touch sub-line');
  // 2. On: fullscreen, portrait lock, remembered; Config stays on top with the focus.
  await touch.tap('#setting-fullscreen');
  await wait('document.fullscreenElement === document.documentElement && document.querySelector("#setting-fullscreen").checked', 5000);
  assert.deepEqual(await evaluate('window.__locks'), ['portrait'], 'a phone asks for portrait');
  assert.equal(await evaluate('localStorage.getItem("gridbound.ui.fullscreen")'), '1');
  await sleep(300);
  assert.equal(await evaluate('(() => { const m = document.querySelector("dialog#modal"); if (!m.open || !m.matches(":modal")) return false; const r = m.getBoundingClientRect(); return m.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()'), true, 'Config is shown again on top of the fullscreen page');
  await screenshot(`${SHOTS}/p7-config-fullscreen.png`);
  pass('android: fullscreen on, portrait lock asked, choice remembered, the open dialog stays on top');
  // 3. The Escape that leaves fullscreen is the browser's: Chrome consumes it (the page never sees the keydown), so no game Back step.
  const nav = () => evaluate('JSON.stringify((({ layer, route, modal, stack }) => ({ layer, route, modal, stack }))(window.gridbound.navState()))');
  const before = await nav();
  await key('Escape');
  await wait('!document.fullscreenElement', 3000);
  await sleep(500);
  assert.equal(await nav(), before, 'no game Back step: Config is still open, same route');
  assert.equal(await evaluate('localStorage.getItem("gridbound.ui.fullscreen")'), '0', 'leaving through the system remembers off');
  assert.equal(await evaluate('document.querySelector("#setting-fullscreen").checked'), false, 'the toggle follows');
  assert.deepEqual(await evaluate('window.__locks'), ['portrait', 'unlock']);
  // A browser that passes the keydown on while it leaves fullscreen: the game holds it until the browser has acted, then ignores it.
  await touch.tap('#setting-fullscreen');
  await wait('Boolean(document.fullscreenElement)', 5000);
  await sleep(400);
  await evaluate('document.exitFullscreen(); document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true })); true');
  await sleep(600);
  assert.equal(await evaluate('Boolean(document.fullscreenElement)'), false);
  assert.equal(await nav(), before, 'still no Back step');
  // Out of fullscreen, Escape is one Back step again (Config closes).
  await key('Escape');
  await wait('!document.querySelector("dialog#modal").open', 3000);
  pass('android: the Escape that leaves fullscreen takes no Back step (consumed, or passed on); afterwards Escape is a Back step');
  // 4. The Back of a phone in fullscreen is the browser's (manual check); on and off through the toggle works.
  await touch.tap('#settings');
  await wait(configOpen);
  await touch.tap('#setting-fullscreen');
  await wait('Boolean(document.fullscreenElement) && document.querySelector("#setting-fullscreen").checked', 5000);
  await sleep(400);
  await touch.tap('#setting-fullscreen');
  await wait('!document.fullscreenElement && !document.querySelector("#setting-fullscreen").checked', 5000);
  assert.equal(await evaluate('localStorage.getItem("gridbound.ui.fullscreen")'), '0');
  assert.deepEqual(errors, [], 'no console errors');
}, { phone: P7 });

// After a reload with the choice remembered, the first real tap asks again (a player: webdriver spoofed, the title screen shown).
if (!ONLY || ONLY === 'android') await withBrowser(async t => {
  const { send, evaluate, wait, touch, screenshot, errors } = t;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `${SPOOF} if (location.protocol.startsWith('http') && !sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.clear(); ${REMINDER_SEEN} localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(ACT_TWO_SAVE))}); localStorage.setItem('gridbound.ui.fullscreen', '1'); }` });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: LOCK_SPY });
  await send('Page.navigate', { url: URL });
  await wait('Boolean(document.querySelector("#title-screen:not([hidden])"))', 20000);
  assert.equal(await evaluate('Boolean(document.fullscreenElement)'), false, 'nothing without a tap');
  await touch.tap({ x: 206, y: 400 });
  await wait('document.fullscreenElement === document.documentElement', 5000);
  assert.deepEqual(await evaluate('window.__locks'), ['portrait']);
  await enter(t);
  await screenshot(`${SHOTS}/p7-camp-fullscreen.png`);
  pass('android: a remembered Fullscreen comes back on the first tap after a reload');
  assert.deepEqual(errors, [], 'no console errors');
}, { phone: P7 });

/** Config's and Save files' storage lines on an iPhone. */
async function iphoneLines(t, lang, tag) {
  const { evaluate, wait, touch, click, screenshot } = t;
  await touch.tap('#settings');
  await wait(configOpen);
  const config = await evaluate('({ fs: Boolean(document.querySelector("#setting-fullscreen")), note: document.querySelector("#storage-note")?.textContent, install: document.querySelector(".storage-install")?.textContent ?? null, installRow: Boolean(document.querySelector("#install-row")) })');
  await screenshot(`${SHOTS}/i15-${tag}-${lang}-config.png`);
  // The advice sits right under the storage line, above the backup buttons.
  if (config.install) await evaluate('document.querySelector(".storage-install").scrollIntoView({ block: "center" })'), await screenshot(`${SHOTS}/i15-${tag}-${lang}-config-advice.png`);
  await click('dialog#modal [data-close]');
  await wait('!document.querySelector("dialog#modal").open');
  if (!await evaluate('Boolean(document.querySelector(".more-scene"))')) await touch.tap('#menu-button'); // MENU toggles
  await wait('Boolean(document.querySelector(".more-scene"))');
  await touch.tap('.more-scene [data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog#modal[open] #import-text-button"))');
  const files = await evaluate('({ note: document.querySelector("#storage-note")?.textContent, install: document.querySelector(".storage-install")?.textContent ?? null })');
  await screenshot(`${SHOTS}/i15-${tag}-${lang}-savefiles.png`);
  await click('dialog#modal [data-close]');
  await wait('!document.querySelector("dialog#modal").open');
  return { config, files };
}

if (!ONLY || ONLY === 'iphone') for (const lang of ['en', 'id']) await withBrowser(async t => {
  const { send, evaluate, wait, errors } = t;
  await seedSave(send, ACT_TWO_SAVE, lang);
  // iPhone Safari has no element fullscreen (headless Chrome reports one).
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });" });
  await send('Page.navigate', { url: URL });
  await wait('Boolean(document.querySelector(".town-spot"))', 20000);
  const tab = await iphoneLines(t, lang, 'safari');
  assert.equal(tab.config.fs, false, 'no Fullscreen row on iPhone');
  const words = lang === 'en' ? { ios: /deletes the saves of sites you haven't opened for 7 days/, install: /tap Share, then 'Add to Home Screen'.*Copy backup as text.*Save files → Paste backup/ } : { ios: /selama 7 hari/, install: /ketuk Bagikan, lalu 'Tambah ke Layar Utama'.*Salin cadangan sebagai teks.*File save → Tempel cadangan/ };
  for (const where of [tab.config, tab.files]) { assert.match(where.note, words.ios); assert.match(where.install ?? '', words.install); }
  pass(`iphone ${lang}: Safari tab — no Fullscreen row, the 7-day line and the Home Screen advice in Config and Save files`);
  // Standalone: the Home Screen app (display-mode emulated; else iOS's own navigator.standalone).
  let emulated = true;
  try { await send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] }); } catch { emulated = false; }
  if (!emulated || !await evaluate('matchMedia("(display-mode: standalone)").matches')) { emulated = false; await evaluate("Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true }); true"); }
  const app = await iphoneLines(t, lang, 'standalone');
  for (const where of [app.config, app.files]) { assert.match(where.note, lang === 'en' ? /Saves are kept by the Home Screen app\./ : /Save disimpan oleh aplikasi di Layar Utama\./); assert.equal(where.install, null, 'no install advice inside the app'); }
  assert.equal(app.config.installRow, false);
  pass(`iphone ${lang}: standalone (${emulated ? 'display-mode emulated' : 'navigator.standalone'}) — 'kept by the Home Screen app', no advice`);
  assert.deepEqual(errors, [], 'no console errors');
}, { phone: I15 });

// The bare title's Back in an installed app with nothing before it: no loop, no error, still the title (Android then closes the app).
if (!ONLY || ONLY === 'iphone') await withBrowser(async t => {
  const { send, evaluate, wait, touch, errors } = t;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `${SPOOF} if (location.protocol.startsWith('http') && !sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.clear(); ${REMINDER_SEEN} localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(ACT_TWO_SAVE))}); }` });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] }).catch(() => {});
  await send('Page.navigate', { url: URL });
  await wait('Boolean(document.querySelector("#title-screen:not([hidden])"))', 20000);
  await send('Page.resetNavigationHistory');
  assert.equal(await evaluate('history.length'), 1, 'an app opened from its icon: no page before it');
  await enter(t);
  // A player's camp: the unlock card (and any scene) first; Escape closes each.
  for (let i = 0; i < 6; i++) { await sleep(800); if (!await evaluate('document.querySelector("dialog#modal").open || Boolean(document.querySelector(".dialogue-scene"))')) break; await t.key('Escape'); }
  await touch.tap('#menu-button');
  await wait('Boolean(document.querySelector(".more-scene"))');
  await touch.tap('.more-scene [data-open-action="title"]');
  await wait('Boolean(document.querySelector("#title-screen:not([hidden])"))', 10000);
  await sleep(500);
  const { currentIndex, entries } = await send('Page.getNavigationHistory');
  assert.ok(currentIndex >= 1, `the guard entry is on top (${currentIndex}/${entries.length})`);
  await send('Page.navigateToHistoryEntry', { entryId: entries[currentIndex - 1].id });
  await sleep(1500);
  const after = await send('Page.getNavigationHistory');
  assert.equal(after.currentIndex, 0, 'the first entry: the browser has nowhere further back (an installed app closes)');
  assert.equal(after.entries.length, entries.length, 'no entries pushed in a loop');
  assert.equal(await evaluate('Boolean(document.querySelector("#title-screen:not([hidden])")) && location.href'), URL, 'still the game, same URL');
  assert.deepEqual(errors, [], 'no console errors');
  pass('standalone: the bare title\'s Back with nothing before it is harmless');
}, { phone: I15 });

// The production web build: manifest, MIME, Chrome's own parse, and the Install row.
const webBuild = existsSync('dist/index.html') && readFileSync('dist/index.html', 'utf8').includes('rel="manifest"');
if ((!ONLY || ONLY === 'web') && !webBuild) console.log('SKIP web: no web build in dist/ (npm run build)');
if ((!ONLY || ONLY === 'web') && webBuild) {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: process.env.INSTALL_PORT || '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const port = await new Promise((done, fail) => { let out = ''; server.stdout.on('data', c => { out += c; const m = out.match(/listening on port (\d+)/); if (m) done(Number(m[1])); }); server.once('exit', code => fail(new Error(`server.js exited ${code}`))); });
    const origin = `http://127.0.0.1:${port}/`;
    await withBrowser(async t => {
      const { send, evaluate, wait, touch, screenshot, errors } = t;
      await seedSave(send);
      await send('Page.navigate', { url: origin });
      await wait('Boolean(document.querySelector(".town-spot"))', 30000);
      const link = await evaluate('document.querySelector(\'link[rel="manifest"]\')?.href');
      assert.equal(link, `${origin}assets/manifest.webmanifest`);
      const head = await evaluate(`fetch(${JSON.stringify(link)}).then(async r => ({ type: r.headers.get('content-type'), json: await r.json() }))`);
      assert.equal(head.type, 'application/manifest+json');
      assert.equal(head.json.short_name, 'Gridbound');
      const tags = await evaluate('[...document.querySelectorAll(\'meta[name^="apple-mobile-web-app"], meta[name="mobile-web-app-capable"], link[rel="apple-touch-icon"]\')].map(el => el.getAttribute("name") ?? el.getAttribute("rel"))');
      assert.deepEqual(tags.sort(), ['apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title', 'apple-touch-icon', 'mobile-web-app-capable']);
      const parsed = await send('Page.getAppManifest');
      assert.deepEqual(parsed.errors, [], `Chrome parses the manifest without errors (${JSON.stringify(parsed.errors)})`);
      assert.equal(parsed.url, link);
      const resolved = parsed.parsed ?? {};
      if (resolved.startUrl) assert.equal(resolved.startUrl, origin, 'start_url resolves to the game folder');
      let installability = 'n/a';
      try { installability = JSON.stringify((await send('Page.getInstallabilityErrors')).installabilityErrors); } catch (error) { installability = `unavailable: ${error.message.slice(0, 80)}`; }
      console.log(`  installability errors: ${installability}`);
      for (const icon of head.json.icons) assert.equal(await evaluate(`fetch(new URL(${JSON.stringify(icon.src)}, ${JSON.stringify(link)})).then(r => r.headers.get('content-type'))`), 'image/png', icon.src);
      pass('web build: manifest linked, served as application/manifest+json, parsed by Chrome; icons and Home Screen tags');
      // The browser's install offer → Config's Install row; its tap calls prompt() once; appinstalled removes the row.
      await evaluate('window.__offer = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: () => { window.__prompted = (window.__prompted ?? 0) + 1; return Promise.resolve({ outcome: "accepted" }); } }); dispatchEvent(window.__offer); true');
      assert.equal(await evaluate('window.__offer.defaultPrevented'), true, 'the browser\'s own mini-infobar is held back');
      await touch.tap('#settings');
      await wait('Boolean(document.querySelector("dialog#modal[open] #install-app"))');
      assert.match(await evaluate('document.querySelector("#install-row").textContent'), /Install the game.*Your saves stay\..*Install/);
      const box = await evaluate('(() => { const r = document.querySelector("#install-app").getBoundingClientRect(); return { w: r.width, h: r.height }; })()');
      assert.ok(box.w >= 44 && box.h >= 44, `Install is a thumb-sized button (${box.w}×${box.h})`);
      await evaluate('document.querySelector("#install-row").scrollIntoView({ block: "center" })');
      await screenshot(`${SHOTS}/p7-web-install-row.png`);
      await touch.tap('#install-app');
      await wait('window.__prompted === 1 && !document.querySelector("#install-row")', 3000);
      pass('web build: the install offer gives Config an Install row; its tap calls prompt() and drops the offer');
      await evaluate('dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: () => Promise.resolve() })); true');
      await evaluate('document.querySelector("dialog#modal [data-close]").click(); true');
      await wait('!document.querySelector("dialog#modal").open');
      await touch.tap('#settings');
      await wait('Boolean(document.querySelector("dialog#modal[open] #install-row"))');
      await evaluate('document.querySelector("#install-app").focus(); dispatchEvent(new Event("appinstalled")); true');
      await wait('!document.querySelector("#install-row")', 2000);
      assert.equal(await evaluate('document.activeElement?.id'), 'export-save', 'the keyboard stays in Config when the focused row goes');
      assert.equal(await evaluate('Boolean(window.gridbound)'), false, 'production: no dev hook');
      assert.deepEqual(errors, [], 'no console errors');
      pass('web build: appinstalled removes the Install row');
    }, { phone: P7 });
  } finally { server.kill('SIGTERM'); }
}
console.log(`install-browser: ${results.length} checks passed`);
