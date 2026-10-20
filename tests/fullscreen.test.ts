import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FULLSCREEN_KEY, fullscreenEscape, fullscreenWanted, installFullscreen, standaloneApp, toggleFullscreen } from '../src/ui/embed';

// Phone contract I1: Config → Fullscreen on every host that allows it, a portrait lock on a phone, the choice remembered and asked for
// again on the next real tap, 'off' remembered when the system leaves it, and the Escape that leaves it is no game Back step.
type Listener = { type: string; fn: (event: unknown) => void; capture?: boolean };
function fakePage({ coarse = true, webdriver = false, media = {} as Record<string, boolean>, stored = {} as Record<string, string> } = {}) {
  const docListeners: Listener[] = [], winListeners: Listener[] = [], calls: string[] = [], timers: (() => void)[] = [], store = new Map(Object.entries(stored));
  const doc = {
    fullscreenEnabled: true, fullscreenElement: null as unknown, visibilityState: 'visible',
    documentElement: { requestFullscreen: async (options: unknown) => { calls.push(`request ${JSON.stringify(options)}`); doc.fullscreenElement = doc.documentElement; fire(docListeners, 'fullscreenchange', {}); } },
    exitFullscreen: async () => { calls.push('exit'); doc.fullscreenElement = null; fire(docListeners, 'fullscreenchange', {}); },
    addEventListener: (type: string, fn: Listener['fn']) => docListeners.push({ type, fn }),
  };
  const fire = (list: Listener[], type: string, event: unknown) => { for (const l of [...list]) if (l.type === type) l.fn(event); };
  const define = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('document', doc);
  define('window', { addEventListener: (type: string, fn: Listener['fn'], capture?: boolean) => winListeners.push({ type, fn, capture }), removeEventListener: (type: string, fn: Listener['fn']) => { const i = winListeners.findIndex(l => l.type === type && l.fn === fn); if (i >= 0) winListeners.splice(i, 1); }, setTimeout: (fn: () => void) => { timers.push(fn); return timers.length; } });
  define('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' ? coarse : Boolean(media[query]) }));
  define('screen', { orientation: { lock: async (o: string) => { calls.push(`lock ${o}`); }, unlock: () => { calls.push('unlock'); } } });
  define('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
  define('navigator', { webdriver });
  return { doc, calls, store, winListeners, timers, fireWin: (type: string, event: unknown) => fire(winListeners, type, event), fireDoc: (type: string, event: unknown) => fire(docListeners, type, event), flush: () => { while (timers.length) timers.shift()!(); } };
}
const tick = () => new Promise(done => setImmediate(done));

test('Config → Fullscreen: on a phone it locks portrait, the choice is remembered, and leaving drops the lock', async () => {
  const page = fakePage();
  installFullscreen();
  assert.equal(await toggleFullscreen(), true);
  assert.deepEqual(page.calls, ['request {"navigationUI":"hide"}', 'lock portrait']);
  assert.equal(page.store.get(FULLSCREEN_KEY), '1');
  assert.equal(fullscreenWanted(), true);
  assert.equal(await toggleFullscreen(), false);
  assert.deepEqual(page.calls.slice(2), ['exit', 'unlock']);
  assert.equal(page.store.get(FULLSCREEN_KEY), '0');
  const desk = fakePage({ coarse: false });
  await toggleFullscreen();
  assert.deepEqual(desk.calls, ['request {"navigationUI":"hide"}'], 'a mouse never asks for an orientation lock');
});

test('a remembered choice is asked for again on the next real tap (once), never under automation, in an installed app or when declined', async () => {
  const page = fakePage({ stored: { [FULLSCREEN_KEY]: '1' } });
  installFullscreen();
  page.fireWin('keydown', { type: 'keydown', code: 'Escape' });
  assert.deepEqual(page.calls, [], 'Escape grants no activation');
  page.fireWin('pointerup', { type: 'pointerup' });
  await tick();
  assert.deepEqual(page.calls, ['request {"navigationUI":"hide"}', 'lock portrait']);
  assert.ok(!page.winListeners.some(l => l.type === 'pointerup' || l.type === 'keydown'), 'one tap only');
  // The system leaves it (the phone's Back): 'off' is remembered, so the next session never fights the player.
  await page.doc.exitFullscreen();
  assert.equal(page.store.get(FULLSCREEN_KEY), '0');
  for (const setup of [{ webdriver: true }, { media: { '(display-mode: standalone)': true } }, { stored: { [FULLSCREEN_KEY]: '0' } }]) {
    const other = fakePage({ stored: { [FULLSCREEN_KEY]: '1' }, ...setup });
    installFullscreen();
    assert.ok(!other.winListeners.some(l => l.type === 'pointerup'), JSON.stringify(setup));
  }
  // A reload in fullscreen leaves it while the page unloads: the choice stays 'on'.
  const reload = fakePage({ stored: { [FULLSCREEN_KEY]: '1' } });
  installFullscreen();
  reload.fireWin('pointerup', { type: 'pointerup' });
  await tick();
  reload.fireWin('pagehide', {});
  await reload.doc.exitFullscreen();
  assert.equal(reload.store.get(FULLSCREEN_KEY), '1');
  reload.fireWin('pageshow', {});
});

test('fullscreen dropped while the page hides (switching apps, the shade) keeps the choice and comes back on the next tap', async () => {
  const page = fakePage();
  installFullscreen();
  await toggleFullscreen();
  page.doc.visibilityState = 'hidden'; page.fireDoc('visibilitychange', {});
  await page.doc.exitFullscreen();
  assert.equal(page.store.get(FULLSCREEN_KEY), '1', 'not the player\'s choice');
  page.doc.visibilityState = 'visible'; page.fireDoc('visibilitychange', {});
  page.calls.length = 0;
  page.fireWin('pointerup', { type: 'pointerup' });
  await tick();
  assert.deepEqual(page.calls, ['request {"navigationUI":"hide"}', 'lock portrait']);
});

test('the Escape that leaves fullscreen is the browser\'s: no game Back step, whether the keydown comes before or after the change', async () => {
  await new Promise(done => setTimeout(done, 260)); // past the previous test's exit
  const page = fakePage({ coarse: false });
  installFullscreen();
  let backs = 0;
  assert.equal(fullscreenEscape(() => backs++), false, 'not in fullscreen: a normal Back step');
  await toggleFullscreen();
  assert.equal(fullscreenEscape(() => backs++), true, 'held while the browser acts');
  await page.doc.exitFullscreen();
  page.flush();
  assert.equal(backs, 0, 'the browser left fullscreen: nothing else happens');
  assert.equal(fullscreenEscape(() => backs++), true, 'a keydown right after the change belongs to it');
  await toggleFullscreen();
  await new Promise(done => setTimeout(done, 260));
  assert.equal(fullscreenEscape(() => backs++), true);
  page.flush();
  assert.equal(backs, 1, 'a browser that keeps fullscreen (Escape not consumed): the Back step runs');
});

test('standalone: a Home Screen app (display-mode standalone, iOS navigator.standalone) or an app opened full screen', () => {
  fakePage();
  assert.equal(standaloneApp(), false);
  fakePage({ media: { '(display-mode: standalone)': true } });
  assert.equal(standaloneApp(), true);
  fakePage({ media: { '(display-mode: fullscreen)': true } });
  assert.equal(standaloneApp(), true);
  fakePage();
  Object.defineProperty(globalThis, 'navigator', { value: { standalone: true }, configurable: true, writable: true });
  assert.equal(standaloneApp(), true);
});
