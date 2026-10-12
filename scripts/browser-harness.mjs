import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

/** A save that reached Act II: the Undercroft, Raids and the Bell Trials (opened by Chapters 1, 2 and 4) are open. */
export const ACT_TWO_SAVE = { version: 3, gold: 500, claimedQuests: [], ledger: { raids: 0, victories: 4, enemies: { wolf: 1 } }, roster: [0, 4, 3], cleared: [0, 1, 2, 3], storyActive: [0, 4, 3], loadouts: { 0: { skills: [0, 1], talents: [], xp: 0, slot: 1 }, 4: { skills: [0, 1], talents: [], xp: 0, slot: 7 }, 3: { skills: [0, 1], talents: [], xp: 0, slot: 6 } }, bestFloor: 0, wins: 4, sound: false, motion: true };
/** Start the tab on a seeded legacy save (migrated into a new Commander on the first boot; reloads keep that Commander). Call before Page.navigate
 *  (a data: page opened first, as the page a player came from, is left alone).
 *  `profile: null` starts a fresh save; `lang` ('en' | 'id') picks the language after the storage is cleared. */
export const seedSave = (send, profile = ACT_TWO_SAVE, lang) => send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.protocol.startsWith('http') && !sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.clear();${lang ? ` localStorage.setItem('gridbound.lang', ${JSON.stringify(lang)});` : ''}${profile ? ` localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(profile))});` : ''} }` });

export async function withBrowser(run, { width = 1440, height = 1000, mobile = false } = {}) {
  let child, socket, profile;
  const pending = new Map();
  const errors = [];
  const listeners = new Set();
  let counter = 0;
  try {
    profile = await mkdtemp(join(tmpdir(), 'gridbound-qa-'));
    const executable = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    child = spawn(executable, ['--headless=new', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
    let launchError;
    child.on('error', error => { launchError = error; });
    const deadline = Date.now() + 15000;
    let port;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Chrome exited ${child.exitCode}`);
      try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!port) throw new Error('Chrome readiness timeout');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await Promise.race([once(socket, 'open'), new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout')), 10000).unref())]);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
      if (message.method) for (const listener of listeners) listener(message);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
    });
    // `sessionId`: a flattened target session (Target.setAutoAttach with flatten:true), e.g. a cross-origin iframe.
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++counter;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    /** Every CDP event (`{method, params, sessionId?}`), from the page and from attached sessions; returns an unsubscribe function. */
    const on = listener => { listeners.add(listener); return () => listeners.delete(listener); };
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (expression, timeout = 10000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      throw new Error(`Wait timeout: ${expression}`);
    };
    const click = async selector => {
      const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); if (!r.width || !r.height || el.disabled) throw Error('Inactive control: '+${JSON.stringify(selector)}); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    };
    // Navigate the way a player does: town buildings, the MENU screen, and the gate's mode tabs.
    click.nav = async facility => {
      const route = () => evaluate('document.querySelector(".town-game-shell")?.dataset.townRoute ?? ""');
      // Back walks one route at a time (MENU → Quests → Back is MENU), so a deep stack needs a few presses; on the camp #home is hidden.
      const toCamp = async () => {
        for (let attempt = 0; attempt < 8 && await route() !== 'camp'; attempt++) {
          if (!await evaluate('Boolean(document.querySelector("#home:not([hidden])"))')) { await new Promise(resolve => setTimeout(resolve, 100)); continue; }
          await click('#home');
          try { await wait('Boolean(document.querySelector(".town-spot"))', 2000); } catch { /* a click landing mid-transition is retried */ }
        }
        await wait('Boolean(document.querySelector(".town-spot"))');
      };
      if (facility === 'camp') return toCamp();
      // MENU toggles: on the MENU route a second press closes it, so it is pressed only from elsewhere.
      if (facility === 'more') { if (await route() !== 'more') await click('#menu-button'); return wait('Boolean(document.querySelector(".more-scene"))'); }
      if (['party', 'party-advanced', 'quests', 'bestiary', 'challenge-shop'].includes(facility)) {
        if (await route() !== 'more') await click('#menu-button');
        await wait('Boolean(document.querySelector(".more-scene"))');
        await click(`.more-scene [data-facility="${facility}"]`);
        return wait(`document.querySelector(".town-game-shell")?.dataset.townRoute === ${JSON.stringify(facility)}`);
      }
      await toCamp();
      await click('.town-spot[data-facility="campaign"]');
      await wait('Boolean(document.querySelector(".expedition-mode-nav"))');
      if (facility !== 'campaign') await click(`.expedition-mode-nav [data-facility="${facility}"]`);
      await wait(`document.querySelector(".town-game-shell")?.dataset.townRoute === ${JSON.stringify(facility)}`);
    };
    // Leave a battle the way a player does: Ⅱ Menu → its exit entry (◀ Back before FIGHT! on a fresh departure, else Leave battle… and its dialog).
    click.retreat = async () => {
      await click('#pause');
      await wait('Boolean(document.querySelector("#pause-retreat"))');
      await click('#pause-retreat');
    };
    // Leave a battle for good: Ⅱ Menu → its exit entry; a fresh departure's ready window just goes back (nothing to abandon), otherwise the dialog's `choice`.
    click.leave = async (choice = '#abandon-run') => {
      await click.retreat();
      await wait(`window.gridbound.inTown || Boolean(document.querySelector("dialog[open] ${choice}"))`, 10000);
      if (!await evaluate('window.gridbound.inTown')) await click(choice);
      await wait('window.gridbound.inTown', 10000);
    };
    const key = async (key, code = key) => {
      const virtual = ({Escape:27,Enter:13,' ':32,Tab:9,ArrowLeft:37,ArrowRight:39})[key] || (key.length===1 ? key.toUpperCase().charCodeAt(0) : 0);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined, windowsVirtualKeyCode:virtual, nativeVirtualKeyCode:virtual });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode:virtual, nativeVirtualKeyCode:virtual });
    };
    const screenshot = async path => {
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await mkdir('artifacts', { recursive: true });
      await writeFile(path, Buffer.from(result.data, 'base64'));
    };
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await run({ send, evaluate, wait, click, key, screenshot, errors, on });
  } finally {
    for (const request of pending.values()) clearTimeout(request.timer);
    socket?.close();
    if (child && child.exitCode === null && child.pid) {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
    }
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
}
