// Phone contract SAFE (docs/production/PHONE-CONTRACT.md §6 C1–C8, G7, G10, K6, I4–I6, P11): nothing is lost on a phone. Emulated phones
// with real touches (Input.dispatchTouchEvent) on a private dev server:
// - leave: a quick double tap on Ⅱ Menu → 'Leave battle…' never leaves (Story CH 6 at 360×740 EN and ID, iPhone SE, Pixel 7; the Undercroft's
//   'Flee the room…' and a Bell Trials 'Leave battle…'): the dialog that opened under the finger ignores the second tap, its safe option
//   comes first and focused and the danger last (K6); a keyboard activation is never held;
// - lifecycle: a blur that leaves the page (notification shade, Control Center, a tap on the itch page), visibilitychange → hidden,
//   pagehide and freeze pause a live fight behind its menu, a blur inside the page does not, nothing resumes on return (C1–C3), and a won
//   battle whose result waited on the boss's death animation settles as soon as the page is hidden;
// - wake: the screen wake lock is held while a battle is on screen (ready, fighting, paused), asked again on return, released on results
//   and in town; a refused request logs nothing (C6);
// - persist: the web build asks navigator.storage to persist when Save files or Config opens and after a first chapter clear, and the
//   storage line says what that means on Android, on an iPhone Safari tab and when granted (I4, I6);
// - reminder: the backup reminder shows in the camp after an act clear (webdriver spoofed: the real player flow), once (I6);
// - detour: a lost Story battle 4 left through a defeat fix stays resumable as 'Resume CH 1 · battle 4', with the talent bought on the way (C8);
// - keys: Save files' name field renames with the keyboard's Enter, and 'delete' in any case enables Delete forever (touch-10);
// - turn: the iPhone 15 held sideways (L6, portrait only): the Turn card pauses a live fight without a menu, hiding/showing/focus/a tap
//   resume nothing under it, upright again the fight waits behind its menu; a pause menu open as the phone turns stays open under the card;
// - sound: no AudioContext while Sound is off, and a swipe that starts on a button plays no cue (G10, P11).
//   SAFE_ONLY=leave|lifecycle|turn|wake|persist|reminder|detour|keys|sound runs some parts. Screenshots: artifacts/phone-wp-safe/.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { withBrowser, seedSave } from './browser-harness.mjs';
import { MID } from './phone-saves.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const only = process.env.SAFE_ONLY;
const runs = part => !only || only.split(',').includes(part);
const out = 'artifacts/phone-wp-safe';
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const J = JSON.stringify;
const PHONES = {
  a360: { width: 360, height: 740, dpr: 3, ua: 'android' },
  se: { width: 375, height: 667, dpr: 2, ua: 'iphone' },
  p7: { width: 412, height: 915, dpr: 2.625, ua: 'android' },
  i15: { width: 393, height: 852, dpr: 3, ua: 'iphone', insets: { top: 59, bottom: 34 } },
};
/** The iPhone 15 turned sideways (portrait only, L6: the Turn card covers the game). */
const SIDEWAYS = { width: 852, height: 393, landscape: true, insets: { left: 59, right: 59, bottom: 21 } }, UPRIGHT = { width: 393, height: 852, landscape: false, insets: { top: 59, bottom: 34 } };
const route = 'document.querySelector(".town-game-shell")?.dataset.townRoute';
const SPOOF = "Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })";
const boot = async (h, save, lang = 'en', scripts = []) => {
  for (const source of scripts) await h.send('Page.addScriptToEvaluateOnNewDocument', { source });
  await seedSave(h.send, save, lang);
  await h.send('Page.navigate', { url });
  await h.wait('Boolean(window.gridbound?.navState)', 30000);
};
/** FIGHT! with a real tap (a tap the busy page did not turn into a start is sent again). */
const fight = async h => {
  await h.wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready" && Boolean(document.querySelector("#start:not([hidden])"))', 15000);
  for (let attempt = 0; attempt < 3; attempt++) {
    await h.touch.tap('#start');
    try { await h.wait('window.gridbound.battle.status === "fighting"', 5000); return; } catch (error) { if (attempt === 2) throw error; }
  }
};
const departStory = async h => {
  await h.click.nav('campaign');
  await h.click('.map-selected [data-mission]').catch(() => h.click('[data-mission]'));
  await h.wait('Boolean(document.querySelector("[data-depart=adventure]"))');
  await h.click('[data-depart="adventure"]');
  await h.wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 15000);
};
const DEV_WIN = '(() => { const g = window.gridbound; g.battle.bossHp = 0; g.step(.05); return true; })()';
const DEV_LOSE = '(() => { const g = window.gridbound, b = g.battle; for (let i = 0; i < 80 && b.status === "fighting"; i++) { b.heroes.forEach(h => { h.hp = Math.min(h.hp, 1); h.shield = 0; }); g.step(.5); } return b.status; })()';
const resultUp = '(() => { const r = document.getElementById("result-screen"); return r && !r.hidden && Boolean(r.querySelector(".ceremony-actions button")) && !r.querySelector(".ceremony-actions button:disabled"); })()';
const leaveState = h => h.evaluate(`({ inTown: window.gridbound.inTown, status: window.gridbound.battle.status, open: document.querySelector('#modal').open, order: [...document.querySelectorAll('dialog[open] .leave-actions button')].map(b => b.id || b.dataset.navExit), focus: document.activeElement?.id || document.activeElement?.dataset.navExit || null })`);
/** Ⅱ Menu, then a quick double tap on its exit: the leave (or flee) dialog opens under the finger and ignores the second tap. */
const doubleTapLeave = async (h, label, danger) => {
  await h.touch.tap('#pause');
  await h.wait('Boolean(document.querySelector("dialog[open] #pause-retreat"))');
  const opener = await h.evaluate('(() => { const r = document.querySelector("dialog[open] #pause-retreat").getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()');
  await h.touch.rapidDoubleTap('#pause-retreat', 130);
  await h.wait(`Boolean(document.querySelector("dialog[open] #${danger}")) || window.gridbound.inTown`, 8000);
  await sleep(900);
  const state = await leaveState(h);
  assert.equal(state.inTown, false, `${label}: a double tap on the exit never leaves the battle`);
  assert.ok(['paused', 'fighting'].includes(state.status), `${label}: the battle goes on (${state.status})`);
  assert.ok(state.open && state.order.includes(danger), `${label}: the dialog is still open (${J(state)})`);
  assert.equal(state.order.at(-1), danger, `${label}: the destructive option is last (K6)`);
  // The held second tap's press moved no focus: the safe option still has it.
  assert.equal(state.focus, state.order[0], `${label}: the safe option keeps the focus after the double tap (${J(state)})`);
  // K6: a deliberate second tap on the same spot after the hold never lands on the danger (the opener's centre, corners and 8px around).
  const hits = await h.evaluate(`(() => { const o = ${J(opener)}, xs = [o.left + 2, (o.left + o.right) / 2, o.right - 2], ys = [o.top + 2, (o.top + o.bottom) / 2, o.bottom - 2];
    const d = document.querySelector('dialog[open] #${danger}').getBoundingClientRect();
    return { onDanger: xs.flatMap(x => ys.map(y => document.elementFromPoint(x, y)?.closest('.btn.danger, #${danger}') ? [x, y] : null)).filter(Boolean),
      gap: Math.max(o.top - d.bottom, d.top - o.bottom, o.left - d.right, d.left - o.right) }; })()`);
  assert.deepEqual(hits.onDanger, [], `${label}: the danger sits where 'Leave battle…' was (K6): ${J(hits)}`);
  assert.ok(hits.gap >= 8, `${label}: the danger keeps 8px from where the opener was (${hits.gap})`);
  return state;
};

if (runs('leave')) {
  for (const [phone, lang] of [['a360', 'id'], ['a360', 'en'], ['se', 'en'], ['p7', 'en'], ['p7', 'id'], ['i15', 'en']]) await withBrowser(async h => {
    await boot(h, MID, lang);
    await departStory(h); await fight(h); await sleep(600);
    const state = await doubleTapLeave(h, `${phone} ${lang} Story`, 'abandon-run');
    assert.deepEqual(state.order, ['suspend-run', 'close', 'abandon-run'], 'Save & suspend, Cancel, then Leave the chapter');
    await h.screenshot(`${out}/leave-double-${phone}-${lang}.png`);
    if (phone === 'a360' && lang === 'id') {
      // The same moment without touch timing: a pointer click on Leave the chapter as the dialog appears is dropped; a keyboard one passes.
      await h.key('Escape'); await h.wait('window.gridbound.battle.status === "fighting" && !document.querySelector("#modal").open');
      const probe = await h.evaluate(`(async () => {
        document.getElementById('pause').click();
        document.getElementById('pause-retreat').click();
        for (let i = 0; i < 100 && !document.querySelector('dialog[open] #abandon-run'); i++) await new Promise(r => setTimeout(r, 5));
        const focus = document.activeElement?.id;
        document.getElementById('abandon-run').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        await new Promise(r => setTimeout(r, 80));
        const held = { inTown: window.gridbound.inTown, open: Boolean(document.querySelector('dialog[open] #abandon-run')) };
        document.querySelector('dialog[open] .leave-actions [data-close]').click();
        const closed = !document.querySelector('#modal').open;
        // Past the hold a deliberate tap acts: a pointer click (detail 1) on the pause menu's Resume 700 ms after it appeared closes it.
        await new Promise(r => setTimeout(r, 100)); // the dialog's close (which resumes the fight) is a queued event
        document.getElementById('pause').click();
        await new Promise(r => setTimeout(r, 700));
        document.querySelector('dialog[open] .menu-list [data-close]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        return { focus, held, closed, later: !document.querySelector('#modal').open };
      })()`);
      await h.wait('window.gridbound.battle.status === "fighting"', 5000).catch(() => {});
      probe.status = await h.evaluate('window.gridbound.battle.status');
      assert.equal(probe.focus, 'suspend-run', 'Save & suspend is focused');
      assert.deepEqual(probe.held, { inTown: false, open: true }, 'a pointer click on Leave the chapter as it appears is dropped');
      assert.equal(probe.closed, true, 'a keyboard activation (Cancel) is never held');
      assert.equal(probe.later, true, 'a pointer tap after the hold acts (Resume)');
      assert.equal(probe.status, 'fighting', 'Cancel resumes the fight');
    }
    assert.deepEqual(h.errors, [], 'no console errors');
  }, { phone: PHONES[phone] });
  // The Undercroft's 'Flee the room…' (half the pouch) and a Bell Trials 'Leave battle…' (the run) take the same care.
  for (const [phone, lang] of [['a360', 'id'], ['i15', 'en']]) await withBrowser(async h => {
    await boot(h, MID, lang);
    await h.click.nav('dungeon');
    await h.click('[data-dungeon-pick="1"]'); await h.wait('Boolean(document.querySelector("#modal [data-dungeon-start]"))');
    await h.click('[data-dungeon-start="1"]'); await h.wait('Boolean(document.querySelector(".dungeon-map .room.open"))');
    for (let step = 0; step < 10 && !await h.evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))'); step++) {
      if (await h.evaluate('Boolean(document.querySelector(".dungeon-map .room.open"))')) { await h.click('.dungeon-map .room.open'); await sleep(300); }
      for (const sel of ['[data-dungeon-choice]:not(:disabled)', '[data-dungeon-open]', '[data-dungeon-camp="rest"]']) if (await h.evaluate(`Boolean(document.querySelector(${J(sel)}))`)) { await h.click(sel); await sleep(300); break; }
    }
    await h.touch.tap('[data-dungeon-fight]');
    await fight(h); await sleep(500);
    const state = await doubleTapLeave(h, `${phone} ${lang} Undercroft`, 'dungeon-flee');
    assert.deepEqual(state.order, ['close', 'dungeon-flee'], 'Cancel, then Flee the room');
    await h.screenshot(`${out}/flee-double-${phone}-${lang}.png`);
    assert.deepEqual(h.errors, [], 'no console errors');
  }, { phone: PHONES[phone] });
  for (const [phone, lang] of [['a360', 'en'], ['a360', 'id'], ['i15', 'en']]) await withBrowser(async h => {
    await boot(h, MID, lang);
    await h.click.nav('endless');
    await h.click('[data-depart="endless"]');
    await fight(h); await sleep(500);
    const state = await doubleTapLeave(h, `${phone} ${lang} Bell Trials`, 'abandon-run');
    assert.deepEqual(state.order, ['suspend-run', 'close', 'abandon-run']);
    await h.screenshot(`${out}/trials-leave-${phone}-${lang}.png`);
    assert.deepEqual(h.errors, [], 'no console errors');
  }, { phone: PHONES[phone] });
  console.log('PASS leave: a double tap on Leave battle… / Flee the room… never leaves; safe option first and focused, danger last');
}

if (runs('lifecycle')) await withBrowser(async h => {
  await boot(h, MID, 'en');
  await departStory(h); await fight(h); await sleep(400);
  const status = () => h.evaluate('window.gridbound.battle.status');
  const pauseMenu = 'window.gridbound.battle.status === "paused" && Boolean(document.querySelector("dialog[open] #pause-retreat"))';
  const resume = async () => { await h.touch.tap('dialog[open] .menu-list [data-close]'); await h.wait('window.gridbound.battle.status === "fighting"'); };
  // A blur whose focus stays in the page (a field, the arena) is no pause.
  await h.evaluate("Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true, writable: true }); window.dispatchEvent(new Event('blur')); true");
  await sleep(300);
  assert.equal(await status(), 'fighting', 'a blur inside the page keeps the fight going');
  // C2: the notification shade (a blur that leaves the document unfocused) pauses the fight; the clock stops. The menu waits for the return
  // (a dialog opened now would pull the focus back from what the player turned to); coming back shows it and resumes nothing (C3).
  await h.evaluate("document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); true");
  await h.wait('window.gridbound.battle.status === "paused"');
  assert.equal(await h.evaluate('document.querySelector("#modal").open'), false, 'no dialog takes the focus while the player is away');
  const t0 = await h.evaluate('window.gridbound.battle.time');
  await sleep(1200);
  assert.equal(await h.evaluate('window.gridbound.battle.time'), t0, 'the battle clock stops');
  await h.evaluate("document.hasFocus = () => true; window.dispatchEvent(new Event('focus')); true");
  await h.wait(pauseMenu);
  await sleep(300);
  assert.equal(await status(), 'paused', 'coming back resumes nothing (C3)');
  await h.screenshot(`${out}/blur-pause-a360.png`);
  await resume();
  // C1: hidden, pagehide and freeze.
  const setHidden = hidden => h.evaluate(`Object.defineProperty(document, 'hidden', { get: () => ${hidden}, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => ${hidden ? "'hidden'" : "'visible'"}, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); true`);
  await setHidden(true); await h.wait(pauseMenu);
  await setHidden(false); await sleep(300);
  assert.equal(await status(), 'paused', 'visible again: still paused');
  await resume();
  await h.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); true"); await h.wait(pauseMenu); await resume();
  await h.evaluate("document.dispatchEvent(new Event('freeze')); true"); await h.wait(pauseMenu); await resume();
  // A won battle whose result waits on the boss's death animation (animation frames stop in the background) settles once the page hides.
  await h.evaluate('window.gridbound.scene.waitForEnemyDeathAnimation = () => new Promise(() => {}); true');
  await h.evaluate(DEV_WIN);
  await sleep(600);
  assert.equal(await h.evaluate('document.getElementById("result-screen").hidden'), true, 'the result waits for the death animation');
  await setHidden(true);
  await h.wait('!document.getElementById("result-screen").hidden', 5000);
  assert.ok(await h.evaluate('Boolean(document.getElementById("next-wave"))'), 'the won wave is settled while hidden');
  await setHidden(false);
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS lifecycle: blur away, hidden, pagehide and freeze pause; a blur inside does not; nothing resumes on return; a hidden page settles a won battle');
}, { phone: PHONES.a360 });

// L6 + C1–C3 with the phone held sideways: the Turn card pauses a live fight without a menu (it would sit hidden under the card), hiding the
// page and coming back while sideways resumes nothing and opens nothing, and turned upright the fight waits behind its pause menu. A pause
// menu open when the phone turns stays open under the card (and comes back as it was); Escape there closes it but the fight stays paused.
if (runs('turn')) await withBrowser(async h => {
  await boot(h, MID, 'en');
  await departStory(h); await fight(h); await sleep(400);
  const state = () => h.evaluate(`({ status: window.gridbound.battle.status, menu: Boolean(document.querySelector('dialog[open] #pause-retreat')), open: document.querySelector('#modal').open, card: getComputedStyle(document.getElementById('turn-card')).display !== 'none', fight: document.querySelector('#turn-card .turn-fight').getBoundingClientRect().width > 0, inert: document.getElementById('app').inert })`);
  await h.setPhone(SIDEWAYS);
  await h.wait('window.gridbound.battle.status === "paused"');
  await sleep(300);
  assert.deepEqual(await state(), { status: 'paused', menu: false, open: false, card: true, fight: true, inert: true }, 'sideways: paused under the card, no menu, the card says the battle waits');
  await h.screenshot(`${out}/turn-fight-sideways.png`);
  const t0 = await h.evaluate('window.gridbound.battle.time');
  // Hidden and shown again while sideways, the window's focus back: nothing resumes and no menu opens under the card.
  const setHidden = hidden => h.evaluate(`Object.defineProperty(document, 'hidden', { get: () => ${hidden}, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => ${hidden ? "'hidden'" : "'visible'"}, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); true`);
  await setHidden(true); await sleep(300); await setHidden(false);
  await h.evaluate("window.dispatchEvent(new Event('focus')); true");
  await h.touch.tap({ x: 426, y: 300 }); await sleep(800);
  assert.deepEqual(await state(), { status: 'paused', menu: false, open: false, card: true, fight: true, inert: true }, 'hidden, shown and tapped sideways: still paused, no menu');
  assert.equal(await h.evaluate('window.gridbound.battle.time'), t0, 'the battle clock stands still under the card');
  // Upright: the menu the fight waits behind (C2), nothing resumed.
  await h.setPhone(UPRIGHT);
  await h.wait('Boolean(document.querySelector("dialog[open] #pause-retreat"))', 5000);
  await sleep(300);
  assert.deepEqual(await state(), { status: 'paused', menu: true, open: true, card: false, fight: false, inert: false }, 'upright: the pause menu, still paused');
  // A pause menu open as the phone turns stays open under the card; Escape sideways (Back passes through) closes it, the fight stays paused,
  // and upright again the menu waits once more.
  await h.setPhone(SIDEWAYS); await h.wait(`getComputedStyle(document.getElementById('turn-card')).display !== 'none'`); await sleep(300);
  assert.deepEqual(await state(), { status: 'paused', menu: true, open: true, card: true, fight: true, inert: true }, 'sideways over the pause menu: it stays open under the card');
  await h.key('Escape'); await sleep(400);
  assert.deepEqual(await state(), { status: 'paused', menu: false, open: false, card: true, fight: true, inert: true }, 'Escape under the card closes the menu, the fight stays paused');
  await h.setPhone(UPRIGHT);
  await h.wait('Boolean(document.querySelector("dialog[open] #pause-retreat"))', 5000);
  await h.touch.tap('dialog[open] .menu-list [data-close]');
  await h.wait('window.gridbound.battle.status === "fighting"');
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS turn: sideways the Turn card pauses a fight without a menu; hide/show/focus resume nothing; upright the fight waits behind its menu');
}, { phone: PHONES.i15 });

/** navigator.wakeLock stand-in: counts requests and the sentinels held; `reject` refuses every request like the itch frame or battery saver. */
const wakeStub = reject => `(() => { const log = window.__wake = { requests: 0, held: 0, last: null }; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => { log.requests++; if (${reject}) throw new DOMException('Wake Lock permission request denied', 'NotAllowedError'); const listeners = []; const s = { type, released: false, addEventListener: (name, f) => { if (name === 'release') listeners.push(f); }, release: async () => { if (s.released) return; s.released = true; log.held--; listeners.forEach(f => f()); } }; log.held++; log.last = s; return s; } } }); })()`;
if (runs('wake')) {
  await withBrowser(async h => {
    await boot(h, MID, 'en', [wakeStub(false)]);
    const wake = () => h.evaluate('({ requests: window.__wake.requests, held: window.__wake.held })');
    assert.equal((await wake()).held, 0, 'nothing held in town');
    await departStory(h);
    await h.wait('window.__wake.held === 1');
    await fight(h); await sleep(300);
    assert.equal((await wake()).held, 1, 'held while fighting');
    // The browser drops the lock when the page hides; coming back to a battle asks again.
    await h.evaluate("window.__wake.last.release(); Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); true");
    await sleep(200);
    await h.evaluate("Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); true");
    await h.wait('window.__wake.held === 1 && window.__wake.requests === 2');
    await h.touch.tap('dialog[open] .menu-list [data-close]'); await h.wait('window.gridbound.battle.status === "fighting"');
    await h.evaluate(DEV_WIN); await h.wait(resultUp, 15000);
    await h.wait('window.__wake.held === 0');
    await h.click('#next-wave'); await h.wait('window.__wake.held === 1');
    await h.click.leave();
    await h.wait('window.__wake.held === 0');
    assert.deepEqual(h.errors, [], 'no console errors');
  }, { phone: PHONES.a360 });
  await withBrowser(async h => {
    await boot(h, MID, 'en', [wakeStub(true)]);
    await departStory(h); await fight(h); await sleep(500);
    assert.ok(await h.evaluate('window.__wake.requests') >= 1, 'asked');
    assert.deepEqual(h.errors, [], 'a refused wake lock logs nothing');
  }, { phone: PHONES.a360 });
  console.log('PASS wake: held through ready, fight and pause, asked again on return, released on results and in town; a refusal is silent');
}

/** navigator.storage stand-in: counts persisted()/persist() calls and answers `granted`. */
const persistStub = granted => `(() => { const log = window.__persist = { persisted: 0, persist: 0 }; const storage = navigator.storage; if (!storage) return; storage.persisted = async () => { log.persisted++; return ${granted}; }; storage.persist = async () => { log.persist++; return ${granted}; }; })()`;
if (runs('persist')) {
  await withBrowser(async h => {
    await boot(h, MID, 'en', [persistStub(false)]);
    assert.deepEqual(await h.evaluate('window.__persist'), { persisted: 0, persist: 0 }, 'nothing is asked at boot');
    await h.click('#menu-button'); await h.wait('Boolean(document.querySelector(".more-scene"))');
    await h.touch.tap('.more-scene [data-open-action="profiles"]');
    await h.wait('Boolean(document.querySelector("dialog[open] #storage-note"))');
    await h.wait('window.__persist.persist >= 1');
    assert.equal(await h.evaluate('document.querySelector("#storage-note").textContent'), 'The browser may clear saves when the phone runs low on space. Keep a backup.');
    await h.screenshot(`${out}/save-files-storage-a360.png`);
    await h.key('Escape'); await h.wait('!document.querySelector("#modal").open');
    await h.touch.tap('#settings'); await h.wait('Boolean(document.querySelector("dialog[open] #storage-note"))');
    assert.ok(await h.evaluate('Boolean(document.querySelector("dialog[open] #export-text"))'), 'Config offers Copy backup as text');
    await h.key('Escape'); await h.wait('!document.querySelector("#modal").open');
    // A first chapter clear (CH 6) asks again.
    const asked = await h.evaluate('window.__persist.persist');
    await departStory(h);
    for (let wave = 0; wave < 8; wave++) {
      await fight(h); await h.evaluate(DEV_WIN); await h.wait(resultUp, 20000);
      if (!await h.evaluate('Boolean(document.getElementById("next-wave"))')) break;
      await h.click('#next-wave');
    }
    await h.wait(`window.__persist.persist > ${asked}`, 10000);
    assert.equal(await h.evaluate('window.gridbound.profile().cleared.includes(5)'), true, 'CH 6 cleared');
    assert.deepEqual(h.errors, [], 'no console errors');
  }, { phone: PHONES.a360 });
  await withBrowser(async h => {
    await boot(h, MID, 'id', [persistStub(false)]);
    await h.touch.tap('#settings'); await h.wait('Boolean(document.querySelector("dialog[open] #storage-note"))'); await sleep(300);
    assert.equal(await h.evaluate('document.querySelector("#storage-note").textContent'), 'Di iPhone dan iPad, browser menghapus save situs yang tidak kamu buka selama 7 hari. Simpan cadangan.', 'an iPhone Safari tab hears about the 7-day rule');
    await h.screenshot(`${out}/config-storage-se-id.png`);
  }, { phone: PHONES.se });
  await withBrowser(async h => {
    await boot(h, MID, 'en', [persistStub(true)]);
    await h.touch.tap('#settings'); await h.wait('Boolean(document.querySelector("dialog[open] #storage-note"))');
    await h.wait('document.querySelector("#storage-note").textContent === "Saves are protected on this device."');
  }, { phone: PHONES.p7 });
  console.log('PASS persist: asked in Save files, Config and after a first clear (never at boot); the storage line fits Android, iPhone Safari and a granted grant');
}

if (runs('reminder')) await withBrowser(async h => {
  // The real player flow (webdriver spoofed): Act I cleared, no backup yet. The camp first shows the unlock card; the reminder waits for the
  // next visit to the camp, then never again that day.
  const save = { ...MID, cleared: [0, 1, 2, 3] };
  await seedSave(h.send, save, 'id');
  // seedSave marks the reminder as just shown (other tests never meet it): this one starts without the flag.
  await boot(h, save, 'id', [SPOOF, "if (!sessionStorage.getItem('qa.reminder')) { sessionStorage.setItem('qa.reminder', '1'); localStorage.removeItem('gridbound.ui.backupReminderAt'); }"]);
  for (let i = 0; i < 20 && await h.evaluate('document.getElementById("title-screen")?.hidden === false'); i++) {
    if (await h.evaluate('document.getElementById("title-screen").classList.contains("press-phase")')) await h.touch.tap({ x: 180, y: 300 });
    else await h.touch.tap('#title-enter');
    await sleep(700);
  }
  await h.wait(`${route} === "camp" && !document.querySelector(".dialogue-scene")`, 15000);
  // Act I opened the Undercroft, Raids and the Bell Trials: their card comes first, on the camp's next showing.
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "more"`);
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "camp"`);
  await h.wait('Boolean(document.querySelector("dialog[open] .unlock-card"))', 10000);
  await h.touch.tap('dialog[open] .unlock-card ~ [data-close]'); await h.wait('!document.querySelector("#modal").open');
  await sleep(800);
  assert.equal(await h.evaluate('document.querySelector("#modal").open'), false, 'no reminder right after the unlock card');
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "more"`);
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "camp"`);
  await h.wait('Boolean(document.querySelector("dialog[open] #reminder-copy"))', 8000).catch(async error => { await h.screenshot(`${out}/reminder-failure.png`); console.error(J(await h.evaluate('({ route: document.querySelector(".town-game-shell")?.dataset.townRoute, modal: document.querySelector("#modal").open && document.querySelector("#modal-title")?.textContent, title: document.getElementById("title-screen").hidden, store: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith("gridbound.ui")).map(k => [k, localStorage.getItem(k)])), cleared: window.gridbound.profile().cleared })'))); throw error; });
  assert.equal(await h.evaluate('document.querySelector("#modal-title").textContent'), 'Simpan salinan progresmu');
  assert.ok(await h.evaluate('Boolean(document.querySelector("dialog[open] .backup-reminder-act"))'), 'it names the act clear');
  assert.equal(await h.evaluate('document.activeElement?.textContent'), 'Nanti saja', "'Not now' is focused");
  await h.screenshot(`${out}/reminder-a360-id.png`);
  await h.touch.tap('dialog[open] .leave-actions [data-close]'); await h.wait('!document.querySelector("#modal").open');
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "more"`);
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "camp"`);
  await sleep(1200);
  assert.equal(await h.evaluate('Boolean(document.querySelector("dialog[open] #reminder-copy"))'), false, 'once a day');
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS reminder: after an act clear, on the next camp visit, once a day, Not now focused');
}, { phone: PHONES.a360 });

if (runs('detour')) await withBrowser(async h => {
  // CH 1 not cleared yet: lose battle 4 (the boss), take the talents fix, learn a talent, press the phone's Back.
  const fresh = { version: 3, gold: 2000, claimedQuests: [], ledger: { raids: 0, victories: 0, enemies: {} }, roster: [0, 4, 3], cleared: [], storyActive: [0, 4, 3], loadouts: { 0: { skills: [0, 1], talents: [], xp: 600, slot: 1 }, 4: { skills: [0, 1], talents: [], xp: 600, slot: 7 }, 3: { skills: [0, 1], talents: [], xp: 600, slot: 6 } }, bestFloor: 0, wins: 0, sound: false, motion: false };
  await boot(h, fresh, 'id');
  await h.click('[data-continue-story]'); await h.wait('Boolean(document.querySelector("[data-depart=adventure]"))');
  await h.click('[data-depart="adventure"]');
  for (let wave = 0; wave < 3; wave++) { await fight(h); await h.evaluate(DEV_WIN); await h.wait(resultUp, 20000); await h.click('#next-wave'); }
  await fight(h);
  // Battle 4 starts below full HP: its checkpoint carries the shares the resume must keep.
  const start = await h.evaluate('window.gridbound.battle.heroes.map(x => ({ id: x.id, ratio: x.hp / x.maxHp }))');
  assert.equal(await h.evaluate(DEV_LOSE), 'defeat');
  await h.wait(resultUp, 20000);
  assert.ok(await h.evaluate('Boolean(document.getElementById("retry-battle"))'), 'Retry this battle is offered');
  assert.match(await h.evaluate('document.querySelector("[data-retry-kept]").textContent'), /CH 1 · pertarungan 4/, 'the result says leaving keeps the battle');
  await h.screenshot(`${out}/detour-defeat-a360-id.png`);
  const fix = await h.evaluate('document.querySelector(\'[data-defeat-fix="jobs"]\') ? "jobs" : null');
  assert.equal(fix, 'jobs', 'the talents fix is offered');
  const hero = Number(await h.evaluate('document.querySelector(\'[data-defeat-fix="jobs"]\').dataset.fixHero'));
  // Centred first: scrolled only to the nearest edge, the fix would sit under the sticky result actions.
  await h.evaluate('document.querySelector(\'[data-defeat-fix="jobs"]\').scrollIntoView({ block: "center" }), true'); await sleep(300);
  await h.touch.tap(await h.evaluate('(() => { const r = document.querySelector(\'[data-defeat-fix="jobs"]\').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()'));
  await h.wait(`window.gridbound.inTown && ${route} === "party-advanced"`).catch(async error => { await h.screenshot(`${out}/detour-failure.png`); throw error; });
  const before = await h.evaluate(`window.gridbound.profile().loadouts[${hero}].talents.length`);
  for (const id of await h.evaluate('[...document.querySelectorAll("[data-inspect-talent]")].map(b => b.dataset.inspectTalent)')) {
    await h.click(`[data-inspect-talent="${id}"]`); await sleep(250);
    if (await h.evaluate('Boolean(document.querySelector("[data-talent]:not([disabled])"))')) { await h.touch.tap('[data-talent]:not([disabled])'); break; }
  }
  await h.wait(`window.gridbound.profile().loadouts[${hero}].talents.length > ${before}`);
  const talents = await h.evaluate(`window.gridbound.profile().loadouts[${hero}].talents`);
  await h.evaluate('history.back(), true');
  await h.wait(`${route} === "mission"`);
  assert.match(await h.evaluate('document.querySelector("[data-resume-run]")?.textContent ?? ""'), /4\/4/, 'the dossier resumes battle 4');
  await h.click.nav('camp');
  assert.match(await h.evaluate('document.querySelector("[data-resume-story]")?.textContent ?? ""'), /CH 1 · pertarungan 4/, "the camp guide offers 'Resume CH 1 · battle 4'");
  await h.screenshot(`${out}/detour-camp-a360-id.png`);
  await h.touch.tap('[data-resume-story]');
  await h.wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 15000);
  assert.equal(await h.evaluate('window.gridbound.battle.stage'), 3, 'battle 4 again, not battle 1');
  const resumed = await h.evaluate('window.gridbound.battle.heroes.map(x => ({ id: x.id, ratio: x.hp / x.maxHp, talents: x.talents }))');
  assert.deepEqual(resumed.find(x => x.id === hero).talents, talents, 'the talent bought on the way counts');
  for (const s of start) assert.ok(Math.abs(resumed.find(x => x.id === s.id).ratio - s.ratio) < 1e-6, `hero ${s.id} resumes at the HP share battle 4 began with`);
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS detour: a lost battle 4 left through a defeat fix resumes as battle 4, with the new talent and the same HP shares');
}, { phone: PHONES.a360 });

// The deploy fix of a kept battle restarts the chapter (the paused battle would resume without the new hero), and a weak start (a hero
// down) is not kept at all: the result advises Restart chapter, so Return leaves no 'Resume' behind.
if (runs('detour')) for (const weak of [false, true]) await withBrowser(async h => {
  await boot(h, { ...MID, storyActive: [0, 4, 3, 2] }, 'id');
  await departStory(h); await fight(h); await sleep(400);
  if (weak) await h.evaluate('(() => { const b = window.gridbound.battle; b.heroes[0].hp = 0; b.heroes[1].hp = 0; return true; })()');
  await h.evaluate(DEV_WIN); await h.wait(resultUp, 20000);
  await h.click('#next-wave'); await fight(h);
  assert.equal(await h.evaluate(DEV_LOSE), 'defeat');
  await h.wait(resultUp, 20000); await sleep(500);
  const r = await h.evaluate(`({ kept: Boolean(document.querySelector('[data-retry-kept]')), weak: Boolean(document.querySelector('[data-weak-checkpoint]')), deploy: document.querySelector('[data-defeat-fix="deploy"]')?.textContent ?? null, restart: Boolean(document.querySelector('[data-defeat-fix="deploy"][data-fix-restart]')) })`);
  await h.screenshot(`${out}/detour-${weak ? 'weak' : 'deploy'}-a360-id.png`);
  if (weak) {
    assert.deepEqual([r.kept, r.weak], [false, true], `a weak start is not kept: ${J(r)}`);
    await h.click('#result-town'); await h.wait('window.gridbound.inTown'); await h.click.nav('camp');
    assert.equal(await h.evaluate('Boolean(document.querySelector("[data-resume-story]"))'), false, 'no Resume after a weak start');
    assert.deepEqual(h.errors, [], 'no console errors');
    return;
  }
  assert.ok(r.kept && r.restart && /ulang CH \d+/.test(r.deploy), `the deploy fix of a kept battle says it restarts the chapter: ${J(r)}`);
  await h.evaluate('document.querySelector(\'[data-defeat-fix="deploy"]\').scrollIntoView({ block: "center" }), true'); await sleep(300);
  await h.click('[data-defeat-fix="deploy"]');
  await h.wait(`window.gridbound.inTown && ${route} === "party"`);
  const benched = await h.evaluate(`[...document.querySelectorAll('[data-story-toggle]')].find(b => b.getAttribute('aria-pressed') === 'false' && !b.disabled)?.dataset.storyToggle ?? null`);
  assert.ok(benched !== null, 'a benched hero can be deployed (no paused battle holds the party)');
  await h.click(`[data-story-toggle="${benched}"]`);
  await h.wait(`window.gridbound.profile().storyActive.includes(${benched})`);
  await h.click.nav('camp');
  assert.equal(await h.evaluate('Boolean(document.querySelector("[data-resume-story]"))'), false, 'the chapter restarts: nothing to resume');
  await departStory(h);
  assert.equal(await h.evaluate('window.gridbound.battle.stage'), 0, 'battle 1');
  assert.ok(await h.evaluate(`window.gridbound.battle.heroes.some(x => x.id === ${benched})`), 'the deployed hero fights');
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS detour: the deploy fix of a kept battle restarts the chapter with the new hero; a weak start is not kept');
}, { phone: PHONES.a360 });

if (runs('keys')) await withBrowser(async h => {
  await boot(h, MID, 'en');
  await h.click('#menu-button'); await h.wait('Boolean(document.querySelector(".more-scene"))');
  await h.touch.tap('.more-scene [data-open-action="profiles"]'); await h.wait('Boolean(document.querySelector("dialog[open] #commander-name"))');
  await h.touch.tap('#commander-name');
  await h.evaluate('document.querySelector("#commander-name").select(), true');
  await h.send('Input.insertText', { text: 'Bellkeeper Phone' });
  assert.equal(await h.evaluate('document.querySelector("#commander-name").getAttribute("enterkeyhint")'), 'done');
  await h.key('Enter');
  await h.wait('document.querySelector(".profiles-notice")?.textContent === "Renamed to Bellkeeper Phone."', 8000);
  await h.touch.tap('#delete-commander'); await h.wait('Boolean(document.querySelector("dialog[open] #delete-word"))');
  const order = await h.evaluate('[...document.querySelectorAll("#delete-actions button")].map(b => b.id || b.dataset.navExit)');
  assert.deepEqual(order, ['back', 'delete-confirm'], 'Cancel first, Delete forever last');
  assert.equal(await h.evaluate('document.activeElement?.dataset.navExit'), 'back', 'Cancel is focused, not the field (no keyboard on open)');
  const attrs = await h.evaluate('Object.fromEntries(["autocapitalize", "autocomplete", "autocorrect", "spellcheck", "enterkeyhint"].map(a => [a, document.querySelector("#delete-word").getAttribute(a)]))');
  assert.deepEqual(attrs, { autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  await h.touch.tap('#delete-word');
  await h.send('Input.insertText', { text: 'delete' });
  await h.wait('!document.querySelector("#delete-confirm").disabled');
  await sleep(300);
  const box = await h.evaluate('(() => { const r = document.querySelector("#delete-actions").getBoundingClientRect(); return { bottom: r.bottom, vh: (window.visualViewport?.height ?? innerHeight) + (window.visualViewport?.offsetTop ?? 0) }; })()');
  assert.ok(box.bottom <= box.vh + 1, `the buttons are above the keyboard line (${J(box)})`);
  await h.screenshot(`${out}/delete-keys-se.png`);
  await h.touch.tap('#delete-actions [data-nav-parent]');
  await h.wait('Boolean(document.querySelector("dialog[open] #commander-name"))');
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log("PASS keys: Enter renames; 'delete' in any case enables Delete forever; Cancel first and focused");
}, { phone: PHONES.se });

/** AudioContext spy: contexts made and oscillators started (every cue makes at least one). */
const AUDIO_SPY = "(() => { const A = window.AudioContext; if (!A) return; const spy = window.__audio = { made: 0, osc: 0 }; window.AudioContext = class extends A { constructor(...args) { super(...args); spy.made++; } createOscillator() { spy.osc++; return super.createOscillator(); } }; })()";
if (runs('sound')) await withBrowser(async h => {
  await boot(h, MID, 'en', [AUDIO_SPY]);
  await h.touch.tap('#menu-button'); await h.wait(`${route} === "more"`);
  await h.touch.tap('.more-scene [data-facility="quests"]'); await h.wait(`${route} === "quests"`);
  assert.equal(await h.evaluate('window.__audio.made'), 0, 'no AudioContext while Sound is off (P11)');
  // Sound on (Config: the ♫ button is hidden on a narrow phone): the first activation creates the context.
  await h.touch.tap('#settings'); await h.wait('Boolean(document.querySelector("dialog[open] #setting-sound"))');
  await h.touch.tap('#setting-sound');
  await h.wait('window.__audio.made === 1');
  await h.touch.tap('dialog[open] .btn.primary[data-close]'); await h.wait('!document.querySelector("#modal").open');
  await sleep(400);
  const quiet = await h.evaluate('window.__audio.osc');
  const button = await h.evaluate('(() => { const b = [...document.querySelectorAll(".secondary-content button")].find(b => { const r = b.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 120; }); if (!b) return null; b.id ||= "qa-swipe-start"; return "#" + b.id; })()');
  assert.ok(button, 'a button in the Quest Board list');
  await h.touch.swipe(button, -160);
  await sleep(500);
  assert.equal(await h.evaluate('window.__audio.osc'), quiet, 'a swipe that starts on a button plays no cue (G10)');
  await h.touch.tap('#menu-button');
  await h.wait(`window.__audio.osc > ${quiet}`);
  assert.deepEqual(h.errors, [], 'no console errors');
  console.log('PASS sound: no AudioContext while Sound is off; a swipe from a button is silent, a tap is heard');
}, { phone: PHONES.a360 });
