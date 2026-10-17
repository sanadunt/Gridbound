// itch.io smoke: the production ZIP from scripts/package-itch.py, extracted and served the way itch.io serves an HTML upload
// (its own origin, under a per-upload path /html/<id>/), inside an itch-like game page on ANOTHER site (an <iframe> with itch's
// allow list), at the recommended embed size and full-screen at phone size. The cross-origin frame is an out-of-process iframe:
// it is driven through its own CDP session (Target.setAutoAttach, flatten), clicks and keys go through the host page like a
// player's. Checks: boot without console errors or requests to any other origin, a battle runs, the first click on the arena
// gives the game the keyboard, keys and the wheel never scroll the host page (the wheel does while the window cuts the frame
// off), progress survives a reload of the host page, the language switch reloads inside the frame, the save backup downloads and
// is also shown as text (the fallback when a browser blocks downloads from a frame; Back returns to Config), Paste backup imports
// it, fullscreen toggles (and is hidden when the frame may not use it), and the browser's Back (top-level history, as a phone's Back
// gesture) performs one in-game Back step from a route, a dialog, a story scene (whose keys never scroll the host), the ready window
// and a fight without leaving the itch page, while Back on the bare title screen leaves it. On a phone (itch's full-screen overlay and an
// inline frame on a long page), one-finger swipes that nothing in the game scrolls (camp map, HUD, the intent panel, Guard, a skill
// chip, the ends of the Quests list) never scroll or pull the host page, from its top and scrolled down, while the list itself scrolls.
//
//   node scripts/itch-smoke.mjs                 # npm run package:itch (build + ZIP), then the smoke
//   node scripts/itch-smoke.mjs --skip-build    # use artifacts/Gridbound-itch-<version>.zip (packaged from dist/ when missing)
// Env: CHROME_PATH, ITCH_ZIP (another ZIP), ITCH_EMBED=540x900 (embed size), ITCH_GAME_PORT/ITCH_HOST_PORT (default: free ports),
//      ITCH_SHOTS (screenshot folder, default artifacts/itch).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

/** The recommended itch.io embed size (Edit game → Embed options → viewport dimensions): one portrait column, see CLAUDE.md. */
const EMBED = { width: 540, height: 900 };
const ITCH_ALLOW = 'autoplay; fullscreen *; geolocation; microphone; camera; midi; monetization; xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share';
const PREFIX = '/html/1234567/';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const [embedW, embedH] = (process.env.ITCH_EMBED || `${EMBED.width}x${EMBED.height}`).split('x').map(Number);
const shots = process.env.ITCH_SHOTS || 'artifacts/itch';
mkdirSync(shots, { recursive: true });
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const zip = resolve(process.env.ITCH_ZIP || `artifacts/Gridbound-itch-${version}.zip`);
if (!process.argv.includes('--skip-build')) execFileSync('npm', ['run', 'package:itch'], { stdio: 'inherit' });
else if (!process.env.ITCH_ZIP && !existsSync(zip)) execFileSync('python3', ['scripts/package-itch.py'], { stdio: 'inherit' });
const root = mkdtempSync(join(tmpdir(), 'gridbound-itch-'));
execFileSync('python3', ['-I', '-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, root]);
assert.ok(existsSync(join(root, 'index.html')), 'index.html is at the ZIP root');
assert.ok(!readdirSync(root).some(name => name.startsWith('.')), 'no dotfiles in the ZIP');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };
const gameLog = [], hostLog = [];
const game = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  gameLog.push(path);
  try {
    if (!path.startsWith(PREFIX)) throw Error('outside the upload path');
    const file = resolve(root, path.slice(PREFIX.length) || 'index.html');
    if (!file.startsWith(root + sep)) throw Error('path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
/** An itch-like game page: a header, the game frame (itch's iframe attributes), then a long description, so a scroll leak shows. */
const hostPage = query => {
  const mobile = query.get('mobile') === '1', w = Number(query.get('w')) || embedW, h = Number(query.get('h')) || embedH, noFullscreen = query.get('fs') === '0', allow = noFullscreen ? ITCH_ALLOW.replace('fullscreen *; ', '') : ITCH_ALLOW;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gridbound by QA</title>
<style>body{margin:0;background:#3a3a3a;color:#ddd;font:15px sans-serif}header{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px;background:#111}
.game_frame{width:${w}px;height:${h}px;margin:24px auto;background:#000}.game_frame iframe{display:block;width:100%;height:100%}.description{max-width:960px;margin:0 auto;padding:16px;min-height:2400px}
body.mobile .game_frame{position:fixed;inset:0;width:100vw;height:100dvh;margin:0;z-index:9}</style></head>
<body class="${mobile ? 'mobile' : ''}"><header><b>itch-like host</b><input id="host-search" placeholder="Search"></header>
<div class="game_frame"><iframe id="game_drop" src="${gameOrigin}${PREFIX}index.html" allowtransparency="true" frameborder="0"${noFullscreen ? '' : ' allowfullscreen="true"'} scrolling="no" allow="${allow}"></iframe></div>
<section class="description"><h1>Gridbound: Ashes of the Bell</h1><p>The page below the game is long, so any scroll that leaks out of the game frame moves it.</p></section></body></html>`;
};
const PERSIST_SPY = `(() => { window.__persistCalls = 0; const s = navigator.storage; if (!s) return; for (const name of ['persist', 'persisted']) { const own = s[name] && s[name].bind(s); if (own) s[name] = () => { window.__persistCalls++; return own(); }; } })();`;
const host = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  hostLog.push(url.pathname);
  if (url.pathname === '/game.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(hostPage(url.searchParams)); return; }
  res.writeHead(url.pathname === '/favicon.ico' ? 204 : 404); res.end();
});
await new Promise(done => game.listen(Number(process.env.ITCH_GAME_PORT || 0), '127.0.0.1', done));
await new Promise(done => host.listen(Number(process.env.ITCH_HOST_PORT || 0), '127.0.0.1', done));
// Different sites, as itch.io's page and its HTML CDN are: 127.0.0.1 for the game, localhost for the page.
const gameOrigin = `http://127.0.0.1:${game.address().port}`, hostOrigin = `http://localhost:${host.address().port}`;

/** One browser, one itch-like page; `frame` is the game's out-of-process iframe (re-attached after every reload). */
async function session({ name, width, height, mobile = false, query = '', previous = false }, run) {
  await withBrowser(async ({ send, evaluate, wait, screenshot, errors, on }) => {
    let frame;
    const requests = [];
    on(message => {
      if (message.method === 'Target.attachedToTarget') {
        const { sessionId, targetInfo } = message.params;
        // A phone: the out-of-process frame gets its own touch emulation (the page's does not reach it).
        // The frame also counts calls to navigator.storage.persist()/persisted(): a frame's storage is partitioned, so the game never asks (I4).
        const setup = targetInfo.type === 'iframe' ? Promise.all([...['Runtime.enable', 'Network.enable', 'Log.enable', 'Page.enable'].map(method => send(method, {}, sessionId)), send('Page.addScriptToEvaluateOnNewDocument', { source: PERSIST_SPY }, sessionId), ...(mobile ? [send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)] : [])]) : Promise.resolve();
        void setup.then(() => send('Runtime.runIfWaitingForDebugger', {}, sessionId)).then(() => { if (targetInfo.type === 'iframe') frame = sessionId; }).catch(() => {});
      }
      if (message.method === 'Target.detachedFromTarget' && message.params.sessionId === frame) frame = undefined;
      if (message.method === 'Network.requestWillBeSent') requests.push({ url: message.params.request.url, frame: Boolean(message.sessionId) });
    });
    // Size the real window like the emulated viewport: Chrome hit-tests input for an out-of-process frame against the window, so a
    // click outside the default 800×600 window would land on the host page instead of the game.
    const { windowId } = await send('Browser.getWindowForTarget');
    const fitWindow = async () => { await send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } }); await send('Browser.setWindowBounds', { windowId, bounds: { width, height: height + 100 } }); };
    await fitWindow();
    // A phone at device scale 1: with a scaled emulated device, headless Chrome maps input into an out-of-process frame at 1/scale.
    if (mobile) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await send('Network.enable');
    await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const downloads = mkdtempSync(join(tmpdir(), 'gridbound-itch-dl-'));
    const allowDownloads = allow => send('Browser.setDownloadBehavior', { behavior: allow ? 'allow' : 'deny', downloadPath: downloads });
    const inFrame = async expression => {
      if (!frame) throw Error('no game frame');
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, frame);
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFrame = async (expression, timeout = 15000) => {
      const end = Date.now() + timeout;
      let last;
      while (Date.now() < end) { try { if (await inFrame(expression)) return; } catch (error) { last = error; } await sleep(80); }
      throw Error(`Wait timeout (game frame): ${expression}${last ? ` (${last.message.split('\n')[0]})` : ''}`);
    };
    /** A real click: the element's centre inside the frame, offset by the frame's box on the host page, dispatched to the page. */
    //  `still`: no scrollIntoView (which also scrolls the host page), for the swipe checks that start from a given host scroll.
    const point = async (selector, still = false) => {
      const inner = await inFrame(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: ' + ${JSON.stringify(selector)}); ${still ? '' : "el.scrollIntoView({ block: 'nearest' });"} const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.disabled) throw Error('Inactive control: ' + ${JSON.stringify(selector)}); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      const outer = await evaluate('(() => { const r = document.querySelector("#game_drop").getBoundingClientRect(); return { x: r.x, y: r.y }; })()');
      return { x: outer.x + inner.x, y: outer.y + inner.y };
    };
    /** A wheel turn where the pointer is (a real mouse moves there first; Chrome routes a wheel to a frame by the pointer's position).
     *  Resolves to whether the game cancelled each wheel event it got. */
    //  Headless Chrome sometimes routes a synthetic wheel to the host page instead of the frame under the pointer (it never reaches the
    //  game): such a turn is undone and sent again, so the check is about what the game does with a wheel it gets.
    const wheel = async ({ x, y }, deltaY) => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const seen = await inFrame('window.__itchWheels.length'), before = await hostScroll();
        for (const dx of [-2, 0]) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + dx, y }); await sleep(120); }
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
        await sleep(450);
        const got = await inFrame(`window.__itchWheels.slice(${seen})`);
        if (got.length) return got;
        await evaluate(`scrollTo(0, ${before})`);
      }
      throw Error('the wheel never reached the game frame');
    };
    //  Headless Chrome now and then hit-tests a synthetic click against stale frame geometry (after a reload or fullscreen) and hands it to
    //  the host page: a click the game never saw (no pointerdown in the frame) is sent again.
    const clickAt = async ({ x, y }) => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const downs = await inFrame('window.__itchDowns').catch(() => -1);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(60);
        for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, button: 'left', clickCount: 1, x, y });
        if (downs < 0) return;
        for (let i = 0; i < 10; i++) { const now = await inFrame('window.__itchDowns').catch(() => -1); if (now !== downs) return; await sleep(50); }
      }
      throw Error(`a click at ${Math.round(x)},${Math.round(y)} never reached the game frame`);
    };
    // A control that just appeared or moved under the pointer ignores presses for a moment (phone contract G7): wait that out first.
    const click = async selector => {
      const held = await inFrame(`(() => { const held = document.querySelector(${JSON.stringify(selector)})?.closest('[data-input-until]'); return held ? Math.max(0, Number(held.dataset.inputUntil) - performance.now()) : 0; })()`).catch(() => 0);
      if (held > 0) await sleep(held + 40);
      return clickAt(await point(selector));
    };
    /** A one-finger swipe at a point of the host page over the frame (dy < 0: the finger moves up), as a phone sends it, dispatched
     *  through the game frame's own session: headless Chrome routes a synthetic touch on an out-of-process frame by stale geometry once
     *  the frame changed a lot (a battle starting) and hands it to the host page instead. The frame's own gesture still bubbles a scroll
     *  it does not consume to the host page (a build without the swipe guard scrolls it). Resolves to the host page's scrollY after it. */
    const swipeAt = async ({ x, y }, dy) => {
      const seen = await inFrame('window.__itchTouches');
      const outer = await evaluate('(() => { const r = document.querySelector("#game_drop").getBoundingClientRect(); return { x: r.x, y: r.y }; })()');
      const finger = fy => ({ x: x - outer.x, y: fy - outer.y, id: 1, radiusX: 4, radiusY: 4, force: 1 });
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger(y)] }, frame);
      for (let i = 1; i <= 12; i++) { await sleep(16); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [finger(y + dy * i / 12)] }, frame); }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, frame);
      await sleep(450);
      assert.notEqual(await inFrame('window.__itchTouches'), seen, 'the swipe reached the game');
      return hostScroll();
    };
    const press = async (code, key = code, extra = {}) => {
      const vk = { Space: 32, ArrowDown: 40, ArrowUp: 38, PageDown: 34, End: 35, Escape: 27, KeyG: 71 }[code] ?? 0;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(key === ' ' ? { text: ' ' } : {}), ...extra });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...extra });
    };
    const hostScroll = () => evaluate('scrollY');
    const booted = 'document.querySelector("canvas") && document.querySelector("#town-screen:not([hidden]) .town-spot, #title-screen:not([hidden])") && document.querySelector("#storage-status")?.dataset.level === "ok" && document.querySelector("#storage-status")?.dataset.revision';
    /** Boot (or reboot after a reload) and wait for the camp with a saved Commander; the title screen only shows outside automation. */
    const boot = async () => {
      await waitFrame(`!window.__itchSeen && ${booted}`, 30000);
      await inFrame("window.__itchSeen = true; window.__itchDowns = 0; addEventListener('pointerdown', () => window.__itchDowns++, true); window.__itchTouches = 0; addEventListener('touchstart', () => window.__itchTouches++, { capture: true, passive: true }); window.__itchWheels = []; addEventListener('wheel', event => setTimeout(() => window.__itchWheels.push(event.defaultPrevented)), { passive: true })");
      if (await inFrame('Boolean(document.querySelector("#title-screen:not([hidden])"))')) { await click('#title-enter'); await waitFrame('Boolean(document.querySelector("#town-screen:not([hidden]) .town-spot"))'); }
    };
    const shot = async file => { await sleep(250); await screenshot(join(shots, `${name}-${file}.png`)); };
    try {
      await allowDownloads(true);
      // `previous`: a page the player came from, so a Back that leaves the game has somewhere to land.
      if (previous) { await send('Page.navigate', { url: 'data:text/html,previous-page' }); await sleep(300); }
      await send('Page.navigate', { url: `${hostOrigin}/game.html${query}` });
      await boot();
      try { await run({ send, evaluate, wait, inFrame, waitFrame, click, clickAt, point, wheel, swipeAt, press, hostScroll, boot, shot, allowDownloads, downloads, errors, requests, fitWindow }); }
      catch (error) { await screenshot(join(shots, `${name}-failure.png`)).catch(() => {}); console.error('FAILURE EVIDENCE', JSON.stringify(await inFrame('({ dialog: document.querySelector("dialog[open]")?.innerText.slice(0, 400), route: document.querySelector(".town-game-shell")?.dataset.townRoute, battle: !document.querySelector("#battle-screen").hidden, status: document.querySelector("#storage-status").textContent })').catch(e => e.message))); throw error; }
      // Nothing but the game's own files (and the host page) was requested, by the browser or by the game.
      const foreign = requests.filter(r => !/^(data|blob):/.test(r.url) && !r.url.startsWith(gameOrigin + PREFIX) && !(r.url.startsWith(hostOrigin) && !r.frame));
      assert.deepEqual(foreign, [], 'requests outside the game origin');
      assert.ok(requests.some(r => r.frame && r.url.includes('/assets/') && r.url.endsWith('.js')), 'the frame session saw the game scripts load');
      assert.deepEqual(errors.map(error => error.text ?? error.args?.map(arg => arg.value ?? arg.description).join(' ') ?? error.exception?.description), [], 'console errors or exceptions in the host page or the game frame');
    } finally { rmSync(downloads, { recursive: true, force: true }); }
  }, { width, height, mobile });
}
/** Click until `ready` holds: a click landing while the town re-renders after a battle or a save is retried, as a player would. */
const clickUntil = async ({ click, waitFrame }, selector, ready, tries = 3) => { for (let i = 1; ; i++) { await click(selector); try { return await waitFrame(ready, 4000); } catch (error) { if (i >= tries) throw error; } } };
const saveMenu = async t => { const { click, waitFrame } = t; await clickUntil(t, '#menu-button', 'Boolean(document.querySelector(".more-scene"))'); await click('.more-scene [data-open-action="profiles"]'); await waitFrame('Boolean(document.querySelector("dialog[open] #import-text-button"))'); };
const config = t => clickUntil(t, '#settings', 'Boolean(document.querySelector("dialog[open] #setting-motion"))');
/** Escape until no dialog is open: a sub-view (the backup text over Config) first goes back to its parent dialog. */
const closeModal = async ({ press, waitFrame, inFrame }) => { for (let i = 0; i < 3 && await inFrame('Boolean(document.querySelector("dialog[open]"))'); i++) { await press('Escape'); await sleep(250); } await waitFrame('!document.querySelector("dialog[open]")'); };
/** Chapter 1 from the camp: the gate, the chapter dossier, Depart, Begin, two taps; the boss bar must move. */
async function battle(t) {
  const { click, waitFrame, inFrame } = t;
  await click('.town-spot[data-facility="campaign"]');
  await waitFrame('Boolean(document.querySelector("[data-zone=\\"0\\"]"))');
  await click('[data-zone="0"]');
  await waitFrame('Boolean(document.querySelector("[data-depart=adventure]")) && document.querySelector("#storage-status").dataset.level === "ok"');
  await click('[data-depart="adventure"]');
  await waitFrame('document.querySelector("#battle-screen").hidden === false && Boolean(document.querySelector("#start"))');
  await click('#start');
  const before = await inFrame('document.querySelector("#boss-hp").style.transform');
  await click('[data-tap="0"]'); await click('[data-tap="3"]');
  await waitFrame(`document.querySelector("#boss-hp").style.transform !== ${JSON.stringify(before)}`, 15000);
}
/** Swipes up and down on `selector` (its centre, on the host page) leave the host page's scrollY where it was (`from`). */
async function swipesKeep({ point, swipeAt, evaluate }, selector, from) {
  await evaluate(`scrollTo(0, ${from})`); await sleep(300);
  assert.equal(await evaluate('scrollY'), from, 'the host page can scroll');
  const at = await point(selector, true);
  for (const dy of [-220, 220]) assert.equal(await swipeAt(at, dy), from, `a swipe ${dy < 0 ? 'up' : 'down'} on ${selector} (host page at ${from}) does not scroll the host page`);
}
/** MENU → Quests: a swipe inside the list scrolls the list; at its ends a swipe never reaches the host page. */
async function questSwipes(t) {
  const { click, waitFrame, inFrame, point, swipeAt, evaluate } = t;
  await clickUntil(t, '#menu-button', 'Boolean(document.querySelector(".more-scene"))');
  await click('.more-scene [data-facility="quests"]');
  await waitFrame('document.querySelector(".town-game-shell")?.dataset.townRoute === "quests"');
  // On a phone the whole Quests route scrolls as one page (contract L7); a wider frame scrolls its content panel.
  const list = await inFrame(`getComputedStyle(document.querySelector('.town-scene > .secondary-scene')).overflowY === 'auto' ? '.town-scene > .secondary-scene' : '.secondary-scene > .secondary-content'`);
  assert.ok(await inFrame(`(() => { const l = document.querySelector(${JSON.stringify(list)}); return l.scrollHeight > l.clientHeight + 40; })()`), 'the Quests list is longer than the screen');
  await evaluate('scrollTo(0, 0)'); await sleep(250);
  const at = await point(list, true);
  await inFrame(`document.querySelector(${JSON.stringify(list)}).scrollTop = 0`);
  assert.equal(await swipeAt(at, 220), 0, 'a swipe down at the top of the Quests list does not pull the host page');
  assert.equal(await swipeAt(at, -220), 0, 'a swipe up in the Quests list does not scroll the host page');
  assert.ok(await inFrame(`document.querySelector(${JSON.stringify(list)}).scrollTop`) > 20, 'the swipe scrolled the Quests list itself');
  await inFrame(`(() => { const l = document.querySelector(${JSON.stringify(list)}); l.scrollTop = l.scrollHeight; })()`); await sleep(200);
  for (const from of [0, 300]) { await evaluate(`scrollTo(0, ${from})`); await sleep(250); assert.equal(await swipeAt(at, -220), from, `a swipe up at the end of the Quests list (host page at ${from}) does not scroll the host page`); }
  await evaluate('scrollTo(0, 0)');
  await clickUntil(t, '#home', 'document.querySelector(".town-game-shell")?.dataset.townRoute !== "quests"');
}
const FIGHTING = '!document.querySelector("#battle-screen").hidden && document.querySelector("#result-screen").hidden && document.querySelector("#start-overlay").hidden && !document.querySelector("dialog[open]")';
/** Keep a fight on screen for the next swipes: a battle the party won meanwhile (it fights by itself) moves on to the next one. */
async function inFight(t) {
  if (await t.inFrame(FIGHTING)) return;
  await t.waitFrame('Boolean(document.querySelector("#result-screen:not([hidden]) #next-wave:not(:disabled)"))', 15000); // the result's buttons wake after a moment
  await clickUntil(t, '#next-wave', 'document.querySelector("#result-screen").hidden && !document.querySelector("#start-overlay").hidden', 5);
  await t.click('#start');
  await t.waitFrame(FIGHTING, 10000);
}
/** Leave the fight for the chapter's dossier: Ⅱ Menu → Leave battle…, or the won wave's 'Leave for now…' when the battle ended meanwhile. */
async function leaveFight(t) {
  const result = 'Boolean(document.querySelector("#result-screen:not([hidden]) #result-town:not(:disabled)"))'; // the result's buttons wake after a moment
  await t.waitFrame(`(${FIGHTING}) || ${result}`, 15000);
  if (!await t.inFrame(result)) return retreat(t);
  await clickUntil(t, '#result-town', 'Boolean(document.querySelector("dialog[open] #abandon-run"))', 5);
  await t.click('#abandon-run');
  await t.waitFrame('document.querySelector("#town-screen:not([hidden]) .town-game-shell")?.dataset.townRoute === "mission"', 15000);
}
/** Ⅱ Menu → Leave battle… → Leave the chapter: back on the dossier the chapter departed from. */
// The pause menu may already be up (a swipe on the host page blurred the frame: the fight paused and its menu waits for the return) and the
// fight may end meanwhile (its result then offers the way out): Ⅱ Menu is pressed only while neither shows, and again if a press was lost.
const retreat = async t => {
  const { click, waitFrame, inFrame } = t, menu = 'Boolean(document.querySelector("dialog[open] #pause-retreat"))', result = 'Boolean(document.querySelector("#result-screen:not([hidden]) #result-town:not(:disabled)"))';
  for (let i = 0; !await inFrame(menu); i++) {
    if (await inFrame(result)) return leaveFight(t);
    if (i >= 3) { console.error('RETREAT STATE', await inFrame('JSON.stringify({ status: window.gridbound?.battle.status, modal: document.querySelector("#modal").open, content: document.querySelector("#modal").textContent.slice(0, 120), result: !document.querySelector("#result-screen").hidden })')); throw new Error('Ⅱ Menu never showed the pause menu'); }
    await click('#pause');
    await waitFrame(`${menu} || ${result}`, 3000).catch(() => {});
  }
  await click('#pause-retreat'); await waitFrame('Boolean(document.querySelector("dialog[open] #abandon-run"))'); await click('#abandon-run'); await waitFrame('document.querySelector("#town-screen:not([hidden]) .town-game-shell")?.dataset.townRoute === "mission"', 15000);
};

try {
  // The recommended embed on a desktop page: everything the frame changes.
  await session({ name: `embed-${embedW}x${embedH}`, width: 1280, height: Math.max(1000, embedH + 120) }, async t => {
    const { inFrame, waitFrame, click, clickAt, point, wheel, press, hostScroll, evaluate, shot, boot, allowDownloads, downloads, send } = t;
    assert.equal(await inFrame('typeof window.gridbound'), 'undefined', 'production build: no dev QA hook');
    assert.equal(await inFrame('document.documentElement.classList.contains("embedded")'), true, 'the game knows it is framed');
    assert.equal(await inFrame('location.pathname'), `${PREFIX}index.html`, 'served from the nested upload path');
    assert.equal(await inFrame('document.documentElement.scrollWidth <= innerWidth && document.querySelector("#app").getBoundingClientRect().width <= innerWidth'), true, 'no horizontal overflow at the embed size');
    await shot('camp');

    // The wheel over the camp map and keys after a click in the game never scroll the host page.
    await evaluate('scrollTo(0, 0)');
    const map = await point('.town-map');
    assert.deepEqual(await wheel(map, 600), [true], 'the game cancels a wheel that nothing in it scrolls');
    assert.equal(await hostScroll(), 0, 'the wheel over the game does not scroll the host page');
    // A frame that the window cuts off (the page scrolled half past it, or an embed taller than a laptop window) lets the wheel scroll
    // the page, so the player can bring the whole game into view; on screen again, the game holds the wheel.
    await evaluate('scrollTo(0, 240)');
    await sleep(300);
    assert.deepEqual(await wheel({ x: map.x, y: map.y - 240 }, 200), [false], 'a cut-off frame lets the wheel through');
    assert.ok(await hostScroll() > 240, 'the wheel scrolled the page towards the rest of the game');
    await evaluate('scrollTo(0, 0)');
    await sleep(300);
    assert.deepEqual(await wheel(map, 600), [true], 'fully on screen again: the wheel is held');
    assert.equal(await hostScroll(), 0);

    // Battle: the first click on the arena canvas (whose pointerdown the engine prevents) still gives the game the keyboard.
    await battle(t);
    await shot('battle');
    await evaluate('document.querySelector("#host-search").focus(); scrollTo(0, 0)');
    assert.equal(await inFrame('document.hasFocus()'), false, 'the host page holds the focus');
    const arena = await point('#game-canvas'), canvasHit = { x: arena.x, y: arena.y - 120 };
    const outer = await evaluate('(() => { const r = document.querySelector("#game_drop").getBoundingClientRect(); return { x: r.x, y: r.y }; })()');
    assert.equal(await inFrame(`document.elementFromPoint(${canvasHit.x - outer.x}, ${canvasHit.y - outer.y})?.tagName`), 'CANVAS', 'the click lands on the engine canvas');
    await clickAt(canvasHit);
    await waitFrame('document.hasFocus()', 3000);
    // The host page took the focus mid-fight, so the fight paused (phone contract C2) without a menu that would have pulled the focus back;
    // the player's return shows it, and nothing goes on until Resume (here Escape).
    await waitFrame('Boolean(document.querySelector("dialog[open] #pause-retreat"))', 3000);
    await press('Escape');
    await waitFrame('!document.querySelector("dialog[open]")');
    for (const [code, key] of [['ArrowDown', 'ArrowDown'], ['PageDown', 'PageDown'], ['End', 'End']]) { await press(code, key); await sleep(250); assert.equal(await hostScroll(), 0, `${code} in the game does not scroll the host page`); }
    // Headless Chrome routes a synthetic wheel over the animated arena to the host page unreliably, so the arena's guard is checked
    // with a WheelEvent in the frame: nothing in the arena scrolls, so the game cancels it (the camp and the dialog get real wheels).
    assert.equal(await inFrame(`(() => { const r = document.querySelector('#game-canvas').getBoundingClientRect(); const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const event = new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true }); target.dispatchEvent(event); return event.defaultPrevented; })()`), true, 'a wheel over the arena is kept from the host page');
    await press('Space', ' ');
    await waitFrame('Boolean(document.querySelector("dialog[open] #pause-retreat"))', 3000);
    assert.equal(await hostScroll(), 0, 'Space pauses the game, not scrolls the host');
    await press('Escape');
    await waitFrame('!document.querySelector("dialog[open]")');
    await retreat(t);

    // A list that can scroll takes the wheel; at its end the host page still does not move.
    await saveMenu(t);
    const dialog = await point('dialog[open] .save-files');
    const room = await inFrame('(() => { const d = document.querySelector("dialog[open]"); return d.scrollHeight - d.clientHeight; })()'), turns = [];
    for (let i = 0; i < 4; i++) turns.push(...await wheel(dialog, 500));
    if (room > 1) assert.equal(turns[0], false, 'the Save dialog scrolls itself');
    assert.equal(turns.at(-1), true, 'at its end the game cancels the wheel');
    assert.equal(await hostScroll(), 0, 'the wheel over the Save dialog does not scroll the host page');

    // Progress persists across a reload of the whole page (IndexedDB in the partitioned frame): a renamed file and a setting.
    // Rename is offered once the field holds another name (an input event), and says what it did.
    await inFrame('(() => { const field = document.querySelector("#commander-name"); field.value = "itch smoke"; field.dispatchEvent(new Event("input", { bubbles: true })); })()');
    await click('#rename-commander');
    await waitFrame('document.querySelector("dialog[open] .save-file.current b")?.textContent === "itch smoke" && document.querySelector("#storage-status").dataset.level === "ok" && document.querySelector("#profiles-notice")?.textContent.includes("itch smoke")');
    await closeModal(t);
    await config(t);
    assert.equal(await inFrame('document.querySelector("#setting-motion").checked'), true);
    await click('#setting-motion');
    await waitFrame('document.querySelector("#storage-status").dataset.level === "ok" && !document.querySelector("#setting-motion").checked');
    await sleep(300);
    await closeModal(t);
    await send('Page.reload');
    await boot();
    await saveMenu(t);
    assert.equal(await inFrame('document.querySelector("dialog[open] .save-file.current b")?.textContent'), 'itch smoke', 'the Commander file survived the reload');
    await closeModal(t);
    await config(t);
    assert.equal(await inFrame('document.querySelector("#setting-motion").checked'), false, 'the Motion setting survived the reload');

    // Fullscreen is offered (the frame allows it) and toggles the whole game.
    assert.equal(await inFrame('Boolean(document.querySelector("#setting-fullscreen"))'), true, 'Config offers Fullscreen in an itch frame');
    await click('#setting-fullscreen');
    await waitFrame('document.fullscreenElement === document.documentElement && document.querySelector("#setting-fullscreen").checked', 5000);
    await shot('fullscreen');
    // Config stays on top of the fullscreen page with the focus on the toggle; Space turns it off (headless Chrome hit-tests clicks
    // against its 800×600 screen while fullscreen, so the keyboard is the reliable way back here).
    assert.equal(await inFrame('document.activeElement?.id'), 'setting-fullscreen', 'the toggle keeps the focus in fullscreen');
    await press('Space', ' ');
    await waitFrame('!document.fullscreenElement && !document.querySelector("#setting-fullscreen").checked', 5000);
    await t.fitWindow();

    // The backup downloads where the browser allows it and is also shown as text; with downloads blocked the text is the backup.
    await click('#export-save');
    await waitFrame('Boolean(document.querySelector("dialog[open] #backup-text"))');
    const shown = JSON.parse(await inFrame('document.querySelector("#backup-text").value'));
    assert.equal(typeof shown.commanderId, 'string', 'the text is the Commander document');
    assert.equal(shown.name, 'itch smoke');
    const end = Date.now() + 5000;
    while (Date.now() < end && !readdirSync(downloads).some(file => file.endsWith('.json'))) await sleep(100);
    const saved = readdirSync(downloads).find(file => file.endsWith('.json'));
    assert.ok(saved, 'the backup file downloaded from the frame');
    assert.deepEqual(JSON.parse(readFileSync(join(downloads, saved), 'utf8')), shown, 'the file and the text are the same backup');
    await click('#backup-copy');
    await waitFrame('document.querySelector("#backup-note").textContent.length > 0');
    assert.equal(await inFrame('(() => { const a = document.querySelector("#backup-text"); return a.selectionStart === 0 && a.selectionEnd === a.value.length; })()'), true, 'the text stays selected for a manual copy');
    await shot('backup-text');
    await closeModal(t);
    await allowDownloads(false);
    await config(t);
    await click('#export-save');
    await waitFrame('Boolean(document.querySelector("dialog[open] #backup-text"))');
    const blocked = await inFrame('document.querySelector("#backup-text").value');
    assert.equal(JSON.parse(blocked).commanderId, shown.commanderId, 'with downloads blocked the backup text is still offered');
    // Back returns to Config as it was (its controls still work), with the focus on the button that opened the backup.
    await click('#backup-back');
    await waitFrame('Boolean(document.querySelector("dialog[open] #setting-motion")) && document.activeElement?.id === "export-save"');
    assert.equal(await inFrame('document.querySelector("#setting-motion").checked'), false, 'Back puts Config back as it was');
    await closeModal(t);
    await allowDownloads(true);

    // Paste backup imports that text as a new Commander file.
    await saveMenu(t);
    await click('#import-text-button');
    await waitFrame('Boolean(document.querySelector("dialog[open] #import-text"))');
    await click('#import-text');
    await send('Input.insertText', { text: blocked });
    await waitFrame('!document.querySelector("#import-text-confirm").disabled');
    await click('#import-text-confirm');
    await waitFrame('Boolean(document.querySelector("dialog[open] [data-import-note]"))', 15000);
    await closeModal(t);
    await saveMenu(t);
    assert.deepEqual(await inFrame('[...document.querySelectorAll("dialog[open] [data-commander]")].map(button => button.closest(".save-file").querySelector("b").textContent).sort()'), ['itch smoke', 'itch smoke (imported)'], 'the pasted backup became a second file (the open one)');
    assert.match(await inFrame('document.querySelector("#storage-note")?.textContent ?? ""'), /itch\.io/, 'Save files says the saves live in the browser\'s storage for itch.io');
    assert.equal(await inFrame('window.__persistCalls'), 0, 'the frame never asks for persistent storage (I4)');
    await closeModal(t);

    // The language switch reloads inside the frame and keeps the save.
    await config(t);
    await click('dialog[open] [data-lang="id"]');
    await boot();
    assert.equal(await inFrame('document.documentElement.lang'), 'id', 'the frame reloaded in Indonesian');
    assert.equal(await inFrame('document.querySelector("#storage-status").textContent'), 'Tersimpan');
    await saveMenu(t);
    assert.match(await inFrame('document.querySelector("dialog[open] .save-file.current b").textContent'), /^itch smoke/, 'the save survived the language reload');
    await shot('id-save');
    await closeModal(t);
    console.log(`PASS itch embed ${embedW}x${embedH}: nested path on another origin, no foreign requests or console errors, battle, keyboard focus, no host scroll (the wheel passes only while the frame is cut off), reload persistence, fullscreen, backup download + text fallback, paste import, language reload`);
  });

  // A page whose frame may not go fullscreen: the setting is not offered.
  await session({ name: 'no-fullscreen', width: 1280, height: 1000, query: '?fs=0' }, async t => {
    await config(t);
    assert.equal(await t.inFrame('Boolean(document.querySelector("#setting-fullscreen"))'), false, 'no Fullscreen setting without allow="fullscreen"');
    console.log('PASS itch frame without fullscreen permission: the Fullscreen setting is hidden');
  });

  // The browser's Back (a phone's Back gesture) on the itch page: one Back step in the game, never off the page, except at the bare title.
  await session({ name: 'back', width: 1280, height: 1000, previous: true }, async t => {
    const { inFrame, waitFrame, wait, click, press, hostScroll, evaluate, send, shot } = t;
    const route = 'document.querySelector("#town-screen:not([hidden]) .town-game-shell")?.dataset.townRoute';
    const history = async () => { const { entries, currentIndex } = await send('Page.getNavigationHistory'); return { length: entries.length, at: currentIndex, back: entries[currentIndex - 1]?.id }; };
    const back = async () => { await send('Page.navigateToHistoryEntry', { entryId: (await history()).back }); await sleep(700); };
    const onPage = async what => assert.equal(await evaluate('location.href'), `${hostOrigin}/game.html`, `${what}: Back kept the itch page`);
    const start = await history();
    // The first real click arms the game's one history entry (a guard): Back then stays in the game.
    await click('.town-spot[data-facility="party"]');
    await waitFrame(`${route} === "party"`);
    await sleep(300);
    assert.equal((await history()).length, start.length + 1, 'one history entry for the game, after the first click');
    await back(); await onPage('Party');
    await waitFrame(`${route} === "camp"`, 4000);
    await config(t);
    await back(); await onPage('Config');
    await waitFrame('!document.querySelector("dialog[open]")', 4000);
    // A story scene keeps the keys (no host scroll) and Back skips it, onto a ready window whose Back is free: twice Back is the dossier.
    await inFrame("Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })");
    await click('.town-spot[data-facility="campaign"]');
    await waitFrame('Boolean(document.querySelector("[data-zone=\\"0\\"]"))');
    await click('[data-zone="0"]');
    await waitFrame('Boolean(document.querySelector("[data-depart=adventure]")) && document.querySelector("#storage-status").dataset.level === "ok"');
    await evaluate('scrollTo(0, 0)');
    await click('[data-depart="adventure"]');
    await waitFrame('Boolean(document.querySelector(".dialogue-scene"))', 5000);
    for (const [code, key] of [['PageDown', 'PageDown'], ['ArrowDown', 'ArrowDown'], ['End', 'End']]) { await press(code, key); await sleep(250); assert.equal(await hostScroll(), 0, `${code} during a story scene does not scroll the host page`); }
    await shot('scene');
    await back(); await onPage('story scene');
    await waitFrame('!document.querySelector(".dialogue-scene") && !document.querySelector("#battle-screen").hidden && !document.querySelector("#ready-back").hidden', 5000);
    await inFrame('delete navigator.webdriver');
    await shot('ready');
    await back(); await onPage('ready window');
    await waitFrame(`${route} === "mission"`, 5000);
    // Mid-fight, Back opens the pause menu (it never leaves the battle or the page).
    await click('[data-depart="adventure"]');
    await waitFrame('document.querySelector("#battle-screen").hidden === false && !document.querySelector("#start").hidden', 5000);
    await click('#start');
    await waitFrame('Boolean(document.querySelector("#pause"))');
    await sleep(300);
    await back(); await onPage('battle');
    await waitFrame('Boolean(document.querySelector("dialog[open] #pause-retreat"))', 4000);
    await press('Escape'); await waitFrame('!document.querySelector("dialog[open]")');
    await retreat(t);
    assert.equal((await history()).length, start.length + 1, 'Backs in the game never grew the history');
    // The bare title screen is the front door: Back there leaves the itch page for the page the player came from.
    await clickUntil(t, '#menu-button', 'Boolean(document.querySelector(".more-scene"))');
    await click('.more-scene [data-open-action="title"]');
    await waitFrame('Boolean(document.querySelector("#title-screen:not([hidden])"))');
    await sleep(400);
    await back();
    await wait('location.protocol === "data:"', 5000).catch(() => { throw Error('Back on the bare title did not leave the itch page'); });
    console.log('PASS itch Back: Party, Config, a story scene (keys keep the host still), the free ready Back and a fight stay on the page; the bare title leaves');
  });

  // Phone: itch's mobile view runs the game over the whole screen (Mobile friendly, portrait).
  await session({ name: 'phone-390x844', width: 390, height: 844, mobile: true, query: '?mobile=1' }, async t => {
    const { inFrame, waitFrame, click, shot, send, boot, evaluate } = t;
    assert.equal(await inFrame('innerWidth'), 390);
    assert.equal(await inFrame('document.documentElement.scrollWidth <= innerWidth'), true, 'no horizontal overflow on a phone');
    await shot('camp');
    // Swipes on the game never move itch's page under the overlay (or pull it to refresh), from its top and scrolled down.
    const still = (what, from) => swipesKeep(t, what, from);
    for (const from of [0, 300]) { await still('.town-map', from); await still('.site-header', from); }
    await battle(t);
    await shot('battle');
    for (const what of ['.unit-skill:not(:disabled)', '#guard', '#intent']) for (const from of [0, 300]) { await inFight(t); await still(what, from); }
    await leaveFight(t);
    await questSwipes(t);
    // An inline frame on a long page (no full-screen overlay): fully on screen, a swipe keeps the page still; scrolled so far that the
    // window cuts the frame off, a swipe moves the page, so the player can bring the game back into view (as the wheel does).
    await send('Page.navigate', { url: `${hostOrigin}/game.html?w=390&h=700` });
    await boot();
    await evaluate('scrollTo(0, 0)'); await sleep(300);
    await still('.town-map', 0); await still('.site-header', 0);
    await evaluate('scrollTo(0, 300)'); await sleep(400);
    const map = await t.point('.town-map', true), scrolled = await t.hostScroll();
    assert.ok(scrolled > 100, 'the inline frame is cut off by the window');
    assert.ok(await t.swipeAt(map, 200) < scrolled - 20, 'a cut-off inline frame lets a swipe scroll the page towards the game');
    await send('Page.navigate', { url: `${hostOrigin}/game.html?mobile=1` });
    await boot();
    await config(t);
    await click('#setting-motion');
    await waitFrame('document.querySelector("#storage-status").dataset.level === "ok" && !document.querySelector("#setting-motion").checked');
    await sleep(300);
    await click('#export-save');
    await waitFrame('Boolean(document.querySelector("dialog[open] #backup-text"))');
    await shot('backup-text');
    await closeModal(t);
    await send('Page.reload');
    await boot();
    await config(t);
    assert.equal(await inFrame('document.querySelector("#setting-motion").checked'), false, 'the setting survived the reload on a phone');
    console.log('PASS itch phone 390x844: boot, swipes never scroll the host page (overlay from 0 and 300, inline frame; the Quests list still scrolls), battle, backup text, reload persistence');
  });
  const strays = gameLog.filter(path => !path.startsWith(PREFIX));
  assert.deepEqual(strays, [], 'the game requested files outside its upload path');
  console.log(`PASS itch smoke (${zip.split(sep).pop()}), screenshots in ${shots}/`);
} finally {
  game.close(); host.close();
  rmSync(root, { recursive: true, force: true });
}
