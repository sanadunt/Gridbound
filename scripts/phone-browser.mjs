// Phone contract test (docs/production/PHONE-CONTRACT.md §10): plays the real player flow (navigator.webdriver spoofed: the title screen, chapter intros,
// camp scenes, the unlock card and the coach all show) with real touches on emulated phones (mobile metrics, touch, an Android Chrome
// or iPhone Safari user agent, safe-area insets), walks the screen tour and checks every screen against the contract's rules.
// Each check carries its owner package and a mode: `gate` fails the run, `report` only lists (a package flips its own checks to gate).
//
//   node scripts/phone-browser.mjs                 # the default matrix (needs a dev server: GRIDBOUND_URL, default 127.0.0.1:5180)
//   PHONE_ONLY=a360 node scripts/phone-browser.mjs  # a regex over the combo tag (profile-variant-save-lang) or the screen ids
//   PHONE_FULL=1 node scripts/phone-browser.mjs     # every profile × both variants × fresh/mid/late × EN/ID
// Env: CHROME_PATH, GRIDBOUND_URL, PHONE_SHOTS (default artifacts/phone), PHONE_TINT=0 (no red inset bands in the screenshots).
// Writes artifacts/phone/report.json and screenshots <shots>/<profile>-<save>-<lang>/<screen>-<variant>.png.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withBrowser } from './browser-harness.mjs';
import { MID, LATE } from './phone-saves.mjs';

const URL_ = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const SHOTS = process.env.PHONE_SHOTS || 'artifacts/phone';
const TINT = process.env.PHONE_TINT !== '0';
const ONLY = process.env.PHONE_ONLY ? new RegExp(process.env.PHONE_ONLY) : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const J = JSON.stringify;
const T0 = Date.now();
const log = (tag, ...rest) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s ${tag}]`, ...rest);

/** The contract's §1 profiles. full = the whole screen (itch's overlay, an installed app); bars = the browser's bars shown (the normal web
 *  build: Android keeps its gesture bar band, Chrome 135+ draws a viewport-fit=cover page under it). Insets in CSS px. */
export const PROFILES = {
  a360: { width: 360, height: 740, bars: 640, dpr: 3, ua: 'android', insets: { full: { bottom: 24 }, bars: { bottom: 24 } } },
  se: { width: 375, height: 667, bars: 553, dpr: 2, ua: 'iphone', insets: { full: {}, bars: {} } },
  i15: { width: 393, height: 852, bars: 659, dpr: 3, ua: 'iphone', insets: { full: { top: 59, bottom: 34 }, bars: {} } },
  p7: { width: 412, height: 915, bars: 835, dpr: 2.625, ua: 'android', insets: { full: { bottom: 24 }, bars: { bottom: 24 } } },
  land: { width: 852, height: 393, bars: 343, dpr: 3, ua: 'iphone', landscape: true, insets: { full: { left: 59, right: 59, bottom: 21 }, bars: { left: 59, right: 59, bottom: 21 } } },
};
const SAVES = { fresh: null, mid: MID, late: LATE };
/** The default matrix (contract §10), else every profile × variant × save × language. */
const MATRIX = process.env.PHONE_FULL === '1'
  ? Object.keys(PROFILES).flatMap(profile => ['fresh', 'mid', 'late'].flatMap(save => ['en', 'id'].map(lang => ({ profile, variants: ['full', 'bars'], save, lang }))))
  : [{ profile: 'a360', variants: ['bars'], save: 'mid', lang: 'en' }, { profile: 'a360', variants: ['bars'], save: 'mid', lang: 'id' }, { profile: 'se', variants: ['bars'], save: 'mid', lang: 'en' }, { profile: 'i15', variants: ['full'], save: 'fresh', lang: 'en' }, { profile: 'land', variants: ['full'], save: 'mid', lang: 'en' }];

/** Every check: the contract rule, its owner package and its mode. */
const CHECKS = {
  errors: { rule: 'no console errors or exceptions', owner: 'SHELL', mode: 'gate' },
  tour: { rule: 'every screen of the tour is reached', owner: 'SHELL', mode: 'gate' },
  L3: { rule: 'no enabled control, nor HUD/battle-bar/sticky-footer text, in a safe-area inset band', owner: 'SHELL', mode: 'gate' },
  L5: { rule: 'no horizontal page scroll, nothing crosses the viewport\'s sides outside a horizontal scroller', owner: 'SHELL', mode: 'gate' },
  G1: { rule: 'html touch-action manipulation, #arena none', owner: 'SHELL', mode: 'gate' },
  G2: { rule: '#app user-select none, fields text; a finger never lands on an image (coarse)', owner: 'SHELL', mode: 'gate' },
  G3: { rule: 'html overscroll-behavior-y none', owner: 'SHELL', mode: 'gate' },
  'T1-form': { rule: 'select / text input / textarea at least 16px (coarse)', owner: 'SHELL', mode: 'gate' },
  'T1-town': { rule: 'text floors outside battle (pixel 10px, text 12px)', owner: 'TOWN', mode: 'report' },
  'T1-battle': { rule: 'text floors in battle (pixel 10px, text 12px)', owner: 'BATTLE', mode: 'gate' },
  'K1-town': { rule: 'hit boxes at least 44×44 outside battle', owner: 'TOWN', mode: 'report' },
  'K1-battle': { rule: 'hit boxes at least 44×44 in battle (the grid is K2)', owner: 'BATTLE', mode: 'gate' },
  'K3-town': { rule: 'controls at least 8px apart outside battle', owner: 'TOWN', mode: 'report' },
  'K3-battle': { rule: 'controls at least 8px apart in battle', owner: 'BATTLE', mode: 'gate' },
  K2: { rule: 'hero cards at least 70×56 (64×50 landscape); the hero zone ≥ 60% of the card and ≥ 32px tall; the chip zone inside its card, ≥ 24px tall; nothing else on a card', owner: 'BATTLE', mode: 'gate' },
  L7: { rule: 'no nested vertical scroller under 40% of the viewport height', owner: 'TOWN', mode: 'report' },
  'L8-town': { rule: 'the primary action is on screen on arrival (town, dialogs)', owner: 'TOWN', mode: 'report' },
  'L8-battle': { rule: 'the primary action is on screen on arrival (battle, results)', owner: 'BATTLE', mode: 'gate' },
  L10: { rule: 'nothing covers a hero card before FIGHT!', owner: 'BATTLE', mode: 'gate' },
  G7: { rule: 'a quick double tap never presses what the first tap opened (Ⅱ Menu → Leave battle…)', owner: 'SAFE', mode: 'gate' },
  K6: { rule: 'the leave dialog puts the danger last, never where its opener was, and keeps the focus on the safe option', owner: 'SAFE', mode: 'gate' },
  C2: { rule: 'a blur that leaves the page (notification shade, Control Center) pauses a live fight behind its menu', owner: 'SAFE', mode: 'gate' },
};
const BATTLE_SCREENS = /^(battle|result|raid-(ready|fight|result)|undercroft-(fight|result)|trials)/;

// ───────────────────────────── in-page library ─────────────────────────────
// Serialized with Function.prototype.toString and installed before the game's scripts, so it must be self-contained.
function pageLib(cfg) {
  if (location.protocol === 'data:' || location.href === 'about:blank' || location.pathname.endsWith('favicon.svg')) return;
  try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch {}
  try {
    if (sessionStorage.getItem('phone.gen') !== cfg.gen) {
      sessionStorage.setItem('phone.gen', cfg.gen);
      // The backup reminder (SAFE, checked in safe-browser) is marked as just shown, so it never stands between the tour and a screen.
      if (!cfg.restored) { localStorage.clear(); localStorage.setItem('gridbound.lang', cfg.lang); localStorage.setItem('gridbound.ui.backupReminderAt', String(Date.now())); if (cfg.save) localStorage.setItem('gridbound.v3', cfg.save); }
    }
  } catch {}
  const Q = window.__phoneQA = { last: performance.now(), lastStyle: performance.now(), clicks: 0 };
  addEventListener('click', () => Q.clicks++, true);
  new MutationObserver(list => { const real = list.filter(m => m.attributeName !== 'style').length; if (real) Q.last = performance.now(); if (real < list.length) Q.lastStyle = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const cs = el => getComputedStyle(el);
  const visible = el => {
    if (!el || !el.isConnected) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hasAttribute('hidden') && e.tagName !== 'DIALOG') return false;
      const s = cs(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      if (e.tagName === 'DIALOG' && !e.open) return false;
    }
    return true;
  };
  const short = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const describe = el => {
    if (!el || el.nodeType !== 1) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    if (cls.length) s += '.' + cls.join('.');
    const data = [...el.attributes].filter(a => a.name.startsWith('data-') && !/^data-(badge|state|long|step)$/.test(a.name)).slice(0, 2);
    if (data.length) s += data.map(a => `[${a.name}${a.value && a.value.length < 24 ? '="' + a.value + '"' : ''}]`).join('');
    return (el.parentElement ? short(el.parentElement) + ' > ' : '') + s;
  };
  const resultScreen = () => { const r = document.getElementById('result-screen'); return r && !r.hidden && visible(r) ? r : null; };
  const topLayer = () => {
    const dialog = [...document.querySelectorAll('dialog[open]')].pop();
    if (dialog) return { kind: 'modal', root: dialog };
    const scene = document.querySelector('.dialogue-scene:not(.closing)');
    if (scene) return { kind: 'scene', root: scene };
    const title = document.getElementById('title-screen');
    if (title && !title.hidden && visible(title)) return { kind: 'title', root: title };
    const result = resultScreen();
    if (result) return { kind: 'result', root: result };
    return { kind: 'page', root: document.body };
  };
  /** The part of a box the player can see: cut by every clipping ancestor (a scroller lets it scroll into view; a fixed element or a
   *  modal dialog escapes its ancestors), not by the viewport. `scrolled`: it sits in a scroller's hidden part. */
  const visibleBox = (rect, el) => {
    let box = { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom }, scrolledX = false, scrolledY = false, escaped = false;
    for (let a = el.parentElement; a && a.nodeType === 1 && a !== document.documentElement && a !== document.body; a = a.parentElement) {
      if (escaped) break;
      const s = cs(a);
      if (!(s.overflowX === 'visible' && s.overflowY === 'visible')) {
        const ar = a.getBoundingClientRect(), cl = ar.left + a.clientLeft, ct = ar.top + a.clientTop, cr = cl + (a.clientWidth || ar.width), cb = ct + (a.clientHeight || ar.height);
        if (box.t < ct || box.b > cb) { if (/auto|scroll/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 1) scrolledY = true; }
        if (box.l < cl || box.r > cr) { if (/auto|scroll/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) scrolledX = true; }
        if (s.overflowY !== 'visible') { box.t = Math.max(box.t, ct); box.b = Math.min(box.b, cb); }
        if (s.overflowX !== 'visible') { box.l = Math.max(box.l, cl); box.r = Math.min(box.r, cr); }
        if (box.r - box.l <= 0.5 || box.b - box.t <= 0.5) return { empty: true, scrolledX, scrolledY };
      }
      if (s.position === 'fixed' || (a.tagName === 'DIALOG' && a.open && a.matches(':modal'))) escaped = true;
    }
    return { ...box, empty: false, scrolledX, scrolledY };
  };
  const CONTROL = 'button, a[href], [role=button], [role=tab], [role=menuitem], [role=link], [role=checkbox], [role=radio], [role=switch], [role=option], input:not([type=hidden]), select, textarea, summary';
  const isTarget = el => {
    if (el.closest('[inert]')) return false;
    if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    if (cs(el).pointerEvents === 'none') return false;
    const d = el.closest('details'); if (d && !d.open && el.tagName !== 'SUMMARY' && !el.closest('summary')) return false;
    return visible(el);
  };
  const hits = (el, h) => Boolean(h && (h === el || el.contains(h) || (h.tagName === 'LABEL' && h.control === el) || (el.tagName === 'LABEL' && el.control && h === el.control)));
  const inView = (x, y) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
  const at = (el, x, y) => inView(x, y) && hits(el, document.elementFromPoint(x, y));
  const run = (el, x, y, dx, dy, max) => { let n = 0; for (let i = 2; i <= max; i += 2) { if (!at(el, x + dx * i, y + dy * i)) break; n = i; } if (n < max && at(el, x + dx * (n + 1), y + dy * (n + 1))) n += 1; return n; };
  /** The effective hit box through the element's centre (hit-tested, so ::before extensions count). */
  const effective = (el, r) => {
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const top = document.elementFromPoint(x, y);
    if (!hits(el, top)) return null;
    const maxX = Math.ceil(r.width / 2) + 40, maxY = Math.ceil(r.height / 2) + 40;
    return [run(el, x, y, -1, 0, maxX) + run(el, x, y, 1, 0, maxX) + 1, run(el, x, y, 0, -1, maxY) + run(el, x, y, 0, 1, maxY) + 1];
  };
  const layerOf = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = cs(e).position; if (p === 'fixed' || p === 'sticky') return short(e) + ':' + p; } return ''; };
  const textOf = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 40);
  const round = r => [r.left ?? r.l, r.top ?? r.t, (r.right ?? r.r) - (r.left ?? r.l), (r.bottom ?? r.b) - (r.top ?? r.t)].map(Math.round);

  window.__phone = {
    visible,
    state() {
      const g = window.gridbound, { kind } = topLayer();
      const title = document.getElementById('title-screen');
      return { layer: kind, route: document.querySelector('.town-game-shell')?.dataset.townRoute ?? '', title: Boolean(title && !title.hidden && visible(title)), press: Boolean(title?.classList.contains('press-phase')),
        inTown: g ? g.inTown : null, battle: g?.battle && !g.inTown ? { mode: g.battle.mode, status: g.battle.status } : null, scene: Boolean(document.querySelector('.dialogue-scene:not(.closing)')), result: Boolean(resultScreen()),
        modal: [...document.querySelectorAll('dialog[open]')].length > 0 };
    },
    /** Scroll an element into view and return its centre for a touch. */
    point(sel) {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: Math.min(innerWidth - 2, Math.max(1, r.left + r.width / 2)), y: Math.min(innerHeight - 2, Math.max(1, r.top + r.height / 2)) };
    },
    // ready also means past its tap hold (G7): a control that just appeared or moved under the finger ignores taps for a moment.
    ready(sel) { const el = document.querySelector(sel), held = el?.closest('[data-input-until]'); return Boolean(el && visible(el) && !el.disabled && !el.closest('[inert]') && !(held && performance.now() < Number(held.dataset.inputUntil))); },
    /** Red translucent bands over the safe-area insets, for the screenshots only. */
    tint(bands) {
      document.querySelectorAll('.qa-band').forEach(e => e.remove());
      const add = css => { const d = document.createElement('div'); d.className = 'qa-band'; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:rgba(255,0,0,.3);' + css; document.documentElement.append(d); };
      if (bands.top) add(`left:0;right:0;top:0;height:${bands.top}px`); if (bands.bottom) add(`left:0;right:0;bottom:0;height:${bands.bottom}px`);
      if (bands.left) add(`left:0;top:0;bottom:0;width:${bands.left}px`); if (bands.right) add(`right:0;top:0;bottom:0;width:${bands.right}px`);
    },
    untint() { document.querySelectorAll('.qa-band').forEach(e => e.remove()); },
    /** Every rule of the contract this test checks, on the screen as it is. */
    measure({ bands = {}, coarse, landscape, primary = [], battle }) {
      const W = innerWidth, H = innerHeight, { kind, root } = topLayer();
      const scrollers0 = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => [e, e.scrollTop, e.scrollLeft]);
      const restore = () => scrollers0.forEach(([e, t, l]) => { if (e.scrollTop !== t) e.scrollTop = t; if (e.scrollLeft !== l) e.scrollLeft = l; });
      // ── text nodes of the top layer
      const texts = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const txt = norm(n.nodeValue);
        if (!txt || !/[\p{L}\p{N}]/u.test(txt)) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,noscript,[inert],.sr-only,svg,template,option,.qa-band') || (kind === 'page' && el.closest('dialog:not([open])'))) continue;
        if (!visible(el)) continue;
        const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        const rs = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
        if (!rs.length) continue;
        const rect = { left: Math.min(...rs.map(x => x.left)), top: Math.min(...rs.map(x => x.top)), right: Math.max(...rs.map(x => x.right)), bottom: Math.max(...rs.map(x => x.bottom)) };
        const s = cs(el);
        // A transform's scale (offsetWidth is rounded to whole pixels: a ratio within 2% of 1 is that rounding, not a scale).
        // Measured on the first box at least 40px wide, where that rounding stays under 2.5%.
        let scale = 1; for (let e = el; e; e = e.parentElement) { if (e.offsetWidth >= 40) { scale = e.getBoundingClientRect().width / e.offsetWidth || 1; if (Math.abs(scale - 1) < .02) scale = 1; break; } }
        const vis = visibleBox(rect, el);
        texts.push({ t: txt.slice(0, 40), el, eff: Math.round(parseFloat(s.fontSize) * scale * 10) / 10, pixel: /press start/i.test(s.fontFamily), rect, vis });
      }
      // ── controls of the top layer (and the battle grid's cards)
      const controls = [...root.querySelectorAll(CONTROL + ', .unit-card, label')].filter(el => (el.tagName !== 'LABEL' || el.control) && isTarget(el));
      const bandList = [];
      if (bands.top) bandList.push(['top', 0, 0, W, bands.top]);
      if (bands.bottom) bandList.push(['bottom', 0, H - bands.bottom, W, H]);
      if (bands.left) bandList.push(['left', 0, 0, bands.left, H]);
      if (bands.right) bandList.push(['right', W - bands.right, 0, W, H]);
      const inBands = box => bandList.map(([name, x0, y0, x1, y1]) => { const ox = Math.min(box.r, x1) - Math.max(box.l, x0), oy = Math.min(box.b, y1) - Math.max(box.t, y0); return ox > 0.5 && oy > 0.5 ? { name, px: Math.round(Math.min(ox, oy)), cx: (Math.max(box.l, x0) + Math.min(box.r, x1)) / 2, cy: (Math.max(box.t, y0) + Math.min(box.b, y1)) / 2 } : null; }).filter(Boolean);
      // L3: a control the player can press inside a band (the band part hit-tests to it), or chrome text inside one.
      const L3 = [];
      for (const el of controls) {
        const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
        const vis = visibleBox(r, el); if (vis.empty) continue;
        for (const band of inBands(vis)) if (at(el, Math.min(W - 1, band.cx), Math.min(H - 1, band.cy))) L3.push({ band: band.name, px: band.px, sel: describe(el), text: textOf(el) });
      }
      const CHROME = '.site-header, .battle-top, .action-bar, .deploy-bar, .ceremony-actions, .boon-modal-footer, .modal-exit, .modal-actions, .dialogue-skip';
      for (const x of texts) if (!x.vis.empty && x.el.closest(CHROME)) for (const band of inBands(x.vis)) L3.push({ band: band.name, px: band.px, sel: describe(x.el), text: x.t });
      // L5: horizontal page scroll; a control or text crossing the viewport's sides (not inside a horizontal scroller).
      const de = document.documentElement, L5 = [];
      if (de.scrollWidth > W + 1) L5.push({ sel: 'html', text: `scrollWidth ${de.scrollWidth} > ${W}` });
      for (const [el, rect] of [...controls.map(el => [el, el.getBoundingClientRect()]), ...texts.map(x => [x.el, x.rect])]) {
        const vis = visibleBox(rect, el);
        if (vis.empty || vis.scrolledX) continue;
        if (vis.l < -1 || vis.r > W + 1) L5.push({ sel: describe(el), text: textOf(el), rect: round(vis) });
      }
      // G1–G3: the touch CSS.
      const html = cs(de), app = document.getElementById('app'), arena = document.getElementById('arena');
      const G1 = [], G2 = [], G3 = [];
      if (html.touchAction !== 'manipulation') G1.push({ sel: 'html', text: `touch-action ${html.touchAction}` });
      if (arena && cs(arena).touchAction !== 'none') G1.push({ sel: '#arena', text: `touch-action ${cs(arena).touchAction}` });
      const userSelect = el => cs(el).userSelect || cs(el).webkitUserSelect;
      if (app && userSelect(app) !== 'none') G2.push({ sel: '#app', text: `user-select ${userSelect(app)}` });
      for (const el of root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea, [contenteditable]')) if (visible(el) && userSelect(el) !== 'text') G2.push({ sel: describe(el), text: `user-select ${userSelect(el)}` });
      if (coarse) for (let i = 0; i < 12; i++) for (let j = 0; j < 20; j++) { const h = document.elementFromPoint((i + 0.5) * W / 12, (j + 0.5) * H / 20); if (h?.tagName === 'IMG' && !h.closest('.qa-band')) { G2.push({ sel: describe(h), text: 'a finger lands on an image' }); i = 12; break; } }
      if (html.overscrollBehaviorY !== 'none') G3.push({ sel: 'html', text: `overscroll-behavior-y ${html.overscrollBehaviorY}` });
      // T1-form: iOS zooms on a field under 16px.
      const form = coarse ? [...root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]), select, textarea')].filter(visible).map(el => ({ sel: describe(el), fs: parseFloat(cs(el).fontSize) })).filter(x => x.fs < 16) : [];
      // T1: text floors (report).
      const T1 = texts.filter(x => !x.vis.empty && (x.pixel ? x.eff < 10 : x.eff < 12)).map(x => ({ sel: describe(x.el), text: x.t, px: x.eff, pixel: x.pixel }));
      // K1 / K3: hit boxes and spacing (report); the battle grid is K2.
      const grid = el => el.closest('#unit-layer');
      const targets = [];
      for (const el of controls) {
        if (el.tagName === 'LABEL' || el.classList.contains('unit-card') || grid(el)) continue;
        const r0 = el.getBoundingClientRect(); if (r0.width < 1 || r0.height < 1) continue;
        const vis = visibleBox(r0, el); if (vis.empty && !vis.scrolledY && !vis.scrolledX) continue;
        const onScreen = r0.top >= -1 && r0.bottom <= H + 1 && r0.left >= -1 && r0.right <= W + 1 && !vis.scrolledY && !vis.scrolledX;
        let r = r0;
        if (!onScreen) { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); r = el.getBoundingClientRect(); }
        targets.push({ el, eff: effective(el, r), rect: r0, onScreen, layer: layerOf(el) });
        if (!onScreen) restore();
      }
      restore();
      const K1 = targets.filter(x => x.eff && (x.eff[0] < 44 || x.eff[1] < 44)).map(x => ({ sel: describe(x.el), text: textOf(x.el), eff: x.eff }));
      const K3 = [], land = targets.filter(x => x.onScreen && x.eff);
      for (let i = 0; i < land.length; i++) for (let j = i + 1; j < land.length; j++) {
        const a = land[i], b = land[j];
        if (a.el.contains(b.el) || b.el.contains(a.el) || a.layer !== b.layer || a.el.closest('[role=group], .tabs, .lang-switch, .title-lang, .battle-view-tabs') && a.el.parentElement === b.el.parentElement) continue;
        const gx = Math.max(0, b.rect.left - a.rect.right, a.rect.left - b.rect.right), gy = Math.max(0, b.rect.top - a.rect.bottom, a.rect.top - b.rect.bottom);
        const gap = gx > 0 && gy > 0 ? Math.hypot(gx, gy) : Math.max(gx, gy);
        if (gap < 8) K3.push({ sel: textOf(a.el) || describe(a.el), text: textOf(b.el) || describe(b.el), gap: Math.round(gap * 10) / 10 });
      }
      // L7: nested vertical scrollers shorter than 40% of the viewport while their content is taller (report).
      const L7 = [...root.querySelectorAll('*')].filter(e => /auto|scroll/.test(cs(e).overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 0 && e.clientHeight < H * 0.4 && visible(e) && !e.closest('#unit-layer, .start-overlay')).map(e => ({ sel: describe(e), text: `${e.clientHeight}px of ${e.scrollHeight}px` }));
      // L8: the screen's primary actions, fully on screen and hit at their centre (report).
      const L8 = [];
      for (const { sel, all, optional } of primary) {
        const els = [...document.querySelectorAll(sel)].filter(el => visible(el) && !el.closest('[inert]') && (kind === 'page' || kind === 'result' ? true : root.contains(el)));
        if (!els.length) { if (!optional) L8.push({ sel, text: 'missing' }); continue; }
        for (const el of all ? els : els.slice(0, 1)) {
          const r = el.getBoundingClientRect(), vis = visibleBox(r, el);
          const full = !vis.empty && Math.abs(vis.t - r.top) < 1 && Math.abs(vis.b - r.bottom) < 1 && r.top >= -0.5 && r.bottom <= H + 0.5 && r.left >= -0.5 && r.right <= W + 0.5;
          const hit = full && at(el, r.left + r.width / 2, r.top + r.height / 2);
          if (!full || !hit) L8.push({ sel: describe(el), text: textOf(el) || sel, why: !full ? `not fully on screen (${round(r).join(',')})` : `covered by ${describe(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))}` });
        }
      }
      // K2 / L10: the battle grid (report).
      const K2 = [], L10 = [];
      if (battle) for (const card of document.querySelectorAll('#unit-layer .unit-card')) {
        if (!visible(card)) continue;
        const r = card.getBoundingClientRect(), [mw, mh] = landscape ? [64, 50] : [70, 56];
        if (r.width < mw || r.height < mh) K2.push({ sel: describe(card), text: textOf(card.querySelector('.unit-name') ?? card), size: [Math.round(r.width), Math.round(r.height)] });
        // The card's zones in a fight (no picker open): a 7×28 grid of points hit-tested; the hero zone is its own .unit-tap, the chip zone
        // its own enabled chip; anything else on the card (another card's chip, a lane button) fails. The chip's own reach: up to the HP
        // bar, at most 2px below the card.
        if (battle === 'fight' && !card.classList.contains('downed') && document.getElementById('skill-picker')?.hidden !== false) {
          const tap = card.querySelector('.unit-tap'), chip = card.querySelector('.unit-skill:not(:disabled)'), hp = card.querySelector('.unit-hp')?.getBoundingClientRect();
          let hero = 0, own = 0, total = 0; const foreign = new Set(), heroRows = new Set(), chipRows = new Set();
          for (let i = 0; i < 7; i++) for (let j = 0; j < 28; j++) {
            const x = r.left + (i + .5) * r.width / 7, y = r.top + (j + .5) * r.height / 28; if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const e = document.elementFromPoint(x, y); total++;
            if (tap?.contains(e)) { hero++; if (i === 3) heroRows.add(j); } else if (chip?.contains(e)) { own++; if (i === 3) chipRows.add(j); }
            else if (e?.closest('button, [role=button]')) foreign.add(describe(e.closest('button, [role=button]')));
          }
          const heroH = heroRows.size * r.height / 28, chipH = chipRows.size * r.height / 28;
          if (total && hero / total < .6) K2.push({ sel: describe(card), text: `hero zone ${Math.round(hero / total * 100)}% of the card` });
          if (heroH < 32) K2.push({ sel: describe(card), text: `hero zone ${Math.round(heroH)}px tall` });
          if (chip && chipH < 24 - r.height / 28) K2.push({ sel: describe(card), text: `chip zone ${Math.round(chipH)}px tall` });
          if (foreign.size) K2.push({ sel: describe(card), text: `other controls on the card: ${[...foreign].join(', ')}` });
          if (chip) { const c = chip.getBoundingClientRect(), before = getComputedStyle(chip, '::before'), top = c.top + parseFloat(before.top), bottom = c.bottom - parseFloat(before.bottom);
            if (hp && top < hp.top - 1) K2.push({ sel: describe(chip), text: `chip zone starts ${Math.round(hp.top - top)}px above the HP bar` });
            if (bottom > r.bottom + 2.5) K2.push({ sel: describe(chip), text: `chip zone ends ${Math.round(bottom - r.bottom)}px below its card` }); }
        }
        if (battle === 'ready' && !at(card, r.left + r.width / 2, r.top + r.height / 2)) L10.push({ sel: describe(card), text: `covered by ${describe(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))}` });
      }
      return { layer: kind, viewport: [W, H], results: { L3, L5, G1, G2, G3, 'T1-form': form, T1, K1, K3, K2, L7, L8, L10 } };
    },
  };
}

// ───────────────────────────── storage snapshot (late save: a suspended raid, restored on every reset) ─────────────────────────────
const SNAPSHOT_JS = `(async () => {
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = { local: { ...localStorage }, dbs: [] };
  for (const { name } of await indexedDB.databases()) {
    if (!name || !name.startsWith('gridbound')) continue;
    const db = await req(indexedDB.open(name)), stores = [];
    for (const storeName of db.objectStoreNames) {
      const st = db.transaction(storeName, 'readonly').objectStore(storeName);
      const indexes = [...st.indexNames].map(n => { const i = st.index(n); return { name: n, keyPath: i.keyPath, unique: i.unique, multiEntry: i.multiEntry }; });
      const keys = await req(st.getAllKeys()), values = await req(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
      stores.push({ name: storeName, keyPath: st.keyPath, autoIncrement: st.autoIncrement, indexes, keys, values });
    }
    out.dbs.push({ name, version: db.version, stores });
    db.close();
  }
  return out;
})()`;
const restoreJs = snap => `(async (snap) => {
  localStorage.clear(); for (const [k, v] of Object.entries(snap.local)) localStorage.setItem(k, v);
  for (const d of snap.dbs) await new Promise((res, rej) => {
    const r = indexedDB.open(d.name, d.version);
    r.onupgradeneeded = () => { const db = r.result; for (const s of d.stores) { const os = db.createObjectStore(s.name, s.keyPath == null ? { autoIncrement: s.autoIncrement } : { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const i of s.indexes) os.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }); } };
    r.onsuccess = () => { const db = r.result; if (!d.stores.length) { db.close(); res(); return; } const tx = db.transaction(d.stores.map(s => s.name), 'readwrite'); for (const s of d.stores) { const os = tx.objectStore(s.name); s.values.forEach((v, i) => s.keyPath == null ? os.put(v, s.keys[i]) : os.put(v)); } tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
    r.onerror = () => rej(r.error);
  });
  return true;
})(${J(snap)})`;

/** One emulated phone (a browser from withBrowser) on one save and language. */
class Phone {
  constructor(h, combo) { Object.assign(this, h); this.combo = combo; this.prof = PROFILES[combo.profile]; this.gen = 0; this.variant = combo.variants[0]; this.notes = []; this.checks = {}; }
  /** A failure of a check the screen's `go` made itself (G7, K6, C2): reported with the screen like the measured ones. */
  fail(id, text) { (this.checks[id] ??= []).push({ text }); }
  get tag() { return `${this.combo.profile}-${this.combo.save}-${this.combo.lang}`; }
  async eval(expression) { return this.evaluate(expression); }
  async waitFor(expression, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { try { if (await this.evaluate(expression)) return true; } catch {} await sleep(80); }
    throw new Error(`timeout: ${expression.slice(0, 120)}`);
  }
  async emulate(variant) {
    this.variant = variant;
    await this.setPhone({ height: variant === 'bars' ? this.prof.bars : this.prof.height, insets: this.prof.insets[variant] ?? {} });
  }
  async navigate(url) { await this.send('Page.navigate', { url }); await this.waitFor(`document.readyState === 'complete' && location.href.startsWith(${J(url.slice(0, 30))})`, 20000).catch(() => {}); }
  /** A fresh page on the combo's save (cleared storage, the init script for this generation), waiting for the boot. */
  async reset() {
    await this.emulate(this.combo.variants[0]);
    await this.navigate('data:text/html,previous-page');
    await this.send('Storage.clearDataForOrigin', { origin: new URL(URL_).origin, storageTypes: 'indexeddb,local_storage,cookies,service_workers,cache_storage' }).catch(() => {});
    if (this.scriptId) await this.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.scriptId }).catch(() => {});
    this.gen++;
    const save = SAVES[this.combo.save];
    const cfg = { gen: `${process.pid}-${this.tag}-${this.gen}`, lang: this.combo.lang, save: save ? J(save) : null, restored: Boolean(this.snapshot) };
    this.scriptId = (await this.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${pageLib.toString()})(${J(cfg)})` })).identifier;
    if (this.snapshot) {
      await this.navigate(new URL('favicon.svg', URL_).href);
      await this.evaluate(restoreJs(this.snapshot));
      await this.evaluate(`location.replace(${J(URL_)}), true`);
      await sleep(300);
    } else await this.navigate(URL_);
    await this.waitFor(`Boolean(window.__phone && window.gridbound && (document.querySelector('.town-game-shell') || document.getElementById('title-screen')))`, 40000);
    await this.settle({ min: 400, quiet: 500, max: 5000 });
  }
  async touchAt(x, y, hold = 50) { await this.touch.tap({ x, y }, hold); }
  /** A real touch on the element's centre (scrolled into view first), then wait for the UI to settle. */
  async tap(sel, { timeout = 8000, settle = true, optional = false } = {}) {
    try { await this.waitFor(`window.__phone.ready(${J(sel)})`, timeout); } catch { if (optional) return false; throw new Error(`tap: not ready ${sel}`); }
    const pt = await this.evaluate(`window.__phone.point(${J(sel)})`);
    if (!pt) { if (optional) return false; throw new Error(`tap: missing ${sel}`); }
    const clicks = await this.evaluate('window.__phoneQA.clicks');
    await this.touchAt(pt.x, pt.y);
    // a touch that produced no click (the page was busy) is sent once more
    for (let i = 0; i < 10; i++) { if (await this.evaluate('window.__phoneQA.clicks').catch(() => clicks + 1) !== clicks) break; await sleep(50); }
    if (await this.evaluate('window.__phoneQA.clicks').catch(() => clicks + 1) === clicks) await this.touchAt(pt.x, pt.y);
    if (settle) await this.settle();
    return true;
  }
  async press(key) {
    const codes = { Escape: 27, Enter: 13 };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: codes[key] || 0, nativeVirtualKeyCode: codes[key] || 0 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: codes[key] || 0, nativeVirtualKeyCode: codes[key] || 0 });
    await this.settle();
  }
  async settle({ min = 250, quiet = 350, max = 3000 } = {}) {
    const start = Date.now(); await sleep(min);
    while (Date.now() - start < max) {
      let s; try { s = await this.evaluate(`(() => { const q = window.__phoneQA; if (!q) return { away: true }; const g = window.gridbound, b = g && g.battle; return { idle: performance.now() - q.last, styleIdle: performance.now() - q.lastStyle, fighting: Boolean(g && !g.inTown && b && b.status === 'fighting' && !document.querySelector('dialog[open]')) }; })()`); } catch { await sleep(150); continue; }
      if (s.away) return;
      if (s.fighting) { if (Date.now() - start > 700) return; await sleep(100); continue; }
      if (s.idle >= quiet && (s.styleIdle >= quiet || Date.now() - start > 1500)) return;
      await sleep(90);
    }
  }
  state() { return this.evaluate('window.__phone.state()'); }
}

// ───────────────────────────── the tour ─────────────────────────────
// Every screen: `go(p)` reaches it from the state the previous screen left (true = measure, 'skip' = not on this save, false = not reached);
// `after` cleans up ('camp' default, 'none', 'escape', 'reset'); `reset` starts from a fresh page; `needs` are earlier screens whose `go`
// runs (unmeasured) when PHONE_ONLY skipped them; `primary` lists the L8 primary actions.
async function toCamp(p) {
  for (let i = 0; i < 12; i++) {
    const s = await p.state();
    if (s.layer === 'page' && s.route === 'camp' && s.inTown && !s.title) return true;
    if (s.layer === 'scene') { if (!await p.tap('.dialogue-scene .dialogue-skip', { optional: true, timeout: 1500 })) await p.press('Escape'); continue; }
    if (s.layer === 'title') { if (s.press) { await p.touchAt(Math.round(p.prof.width / 2), Math.round(p.prof.height * 0.4)); await p.settle(); } await p.tap('#title-enter', { optional: true }); await sleep(800); continue; }
    if (s.layer === 'modal') { await p.press('Escape'); continue; }
    if (!s.inTown) throw new Error('in battle: reset needed');
    if (await p.evaluate(`window.__phone.ready('#home')`)) { await p.tap('#home'); continue; }
    await p.press('Escape');
  }
  const s = await p.state();
  return s.layer === 'page' && s.route === 'camp';
}
async function menuTo(p, facility) {
  if ((await p.state()).layer !== 'page') await toCamp(p);
  if ((await p.state()).route !== 'more') await p.tap('#menu-button');
  await p.waitFor(`Boolean(document.querySelector('.more-scene'))`);
  await p.tap(`.more-scene [data-facility="${facility}"]`);
  await p.waitFor(`document.querySelector('.town-game-shell')?.dataset.townRoute === ${J(facility)}`);
  await p.settle();
}
async function gateTo(p, facility) {
  // already behind the Gate: switch tabs directly; else from the camp
  if (await p.evaluate(`window.__phone.ready('.expedition-mode-nav [data-facility="${facility}"]')`)) { await p.tap(`.expedition-mode-nav [data-facility="${facility}"]`); await p.settle(); return; }
  const s = await p.state();
  if (s.route !== 'camp' || s.layer !== 'page') await toCamp(p);
  await p.tap('.town-spot[data-facility="campaign"]');
  await p.waitFor(`Boolean(document.querySelector('.expedition-mode-nav'))`);
  if (facility !== 'campaign') await p.tap(`.expedition-mode-nav [data-facility="${facility}"]`);
  await p.settle();
}
/** FIGHT!: a tap that did not start the fight (seen now and then under a loaded machine) is noted and sent again. */
async function fightStart(p) {
  await p.waitFor(`window.gridbound.battle && !window.gridbound.inTown && window.gridbound.battle.status === 'ready' && window.__phone.ready('#start')`, 15000);
  for (let attempt = 1; ; attempt++) {
    await p.tap('#start');
    try { await p.waitFor(`window.gridbound.battle.status === 'fighting'`, 5000); break; }
    catch (error) { if (attempt >= 3 || !await p.evaluate(`window.gridbound.battle.status === 'ready' && window.__phone.ready('#start')`)) throw error; p.notes.push(`FIGHT! tap ${attempt} did not start the fight`); }
  }
  await sleep(600);
}
const DEV_WIN = `(async () => { const g = window.gridbound, b = g.battle; b.bossHp = 0; g.step(0.05); return true; })()`;
const DEV_LOSE = `(async () => { const g = window.gridbound, b = g.battle; for (let i = 0; i < 80 && b.status === 'fighting'; i++) { b.heroes.forEach(h => { h.hp = Math.min(h.hp, 1); h.shield = 0; }); g.step(0.5); } return b.status; })()`;
async function waitResult(p) { await p.waitFor(`(() => { const r = document.getElementById('result-screen'); return r && !r.hidden && !r.querySelector('.ceremony-actions button:disabled') && window.__phone.visible(r); })()`, 20000); await sleep(1200); await p.settle({ max: 4000 }); }
async function departStory(p) {
  await gateTo(p, 'campaign');
  await p.tap('.map-selected [data-mission]', { optional: true, timeout: 3000 }) || await p.tap('[data-mission]');
  await p.waitFor(`window.__phone.ready('[data-depart="adventure"]')`);
  await p.tap('[data-depart="adventure"]');
  await sleep(500);
  // a departure with free slots asks first (Depart anyway)
  if (await p.evaluate(`Boolean(document.querySelector('dialog[open] #empty-go'))`)) await p.tap('dialog[open] #empty-go');
}
async function skipScene(p) { if ((await p.state()).layer === 'scene') { await p.tap('.dialogue-scene .dialogue-skip'); await sleep(800); } }

const DIALOG = [{ sel: 'dialog[open] .btn.primary', optional: true }, { sel: 'dialog[open] [data-nav-exit]' }];
const DEPART = [{ sel: '.deploy-bar .btn' }];
const RESULT = [{ sel: '.ceremony-actions' }];
const TOUR = [
  { id: 'title-press', go: async p => { const s = await p.state(); return s.title && s.press ? true : 'skip'; }, after: 'none' },
  { id: 'title-menu', go: async p => { const s = await p.state(); if (!s.title) return 'skip'; if (s.press) { await p.touchAt(Math.round(p.prof.width / 2), Math.round(p.prof.height * 0.4)); await p.settle({ min: 600 }); } return (await p.state()).title; }, after: 'none', primary: [{ sel: '#title-enter' }] },
  { id: 'camp', go: async p => toCamp(p), primary: [{ sel: '[data-continue-story], [data-resume-story], .guide-go' }] },
  { id: 'menu', go: async p => { await p.tap('#menu-button'); return (await p.state()).route === 'more'; } },
  { id: 'config', go: async p => { await p.tap('#settings'); return (await p.state()).layer === 'modal'; }, primary: DIALOG },
  { id: 'save-files', go: async p => { await p.tap('#menu-button'); await p.tap('.more-scene [data-open-action="profiles"]'); return (await p.state()).layer === 'modal'; }, primary: DIALOG },
  { id: 'journal', go: async p => { await p.tap('#menu-button'); await p.tap('.more-scene [data-open-action="journal"]'); return (await p.state()).layer === 'modal'; }, primary: DIALOG },
  { id: 'party', go: async p => { await menuTo(p, 'party'); return true; }, after: 'none', primary: DEPART },
  ...['formation', 'skills', 'gear'].map(tab => ({ id: `party-${tab}`, go: async p => { if ((await p.state()).route !== 'party') await menuTo(p, 'party'); return await p.tap(`[data-training-tab="${tab}"]`, { optional: true, timeout: 1500 }) || 'skip'; }, after: 'none', primary: DEPART })),
  { id: 'party-list-open', go: async p => { if ((await p.state()).route !== 'party') await menuTo(p, 'party'); await p.tap('[data-training-tab="formation"]', { optional: true, timeout: 1500 }); const open = await p.evaluate(`document.querySelector('.party-scene details')?.open ?? null`); if (open === null) return 'skip'; if (!open) await p.tap('.party-scene details > summary'); return true; }, after: 'none', primary: DEPART },
  ...['overview', 'jobs', 'talents'].map(tab => ({ id: `progression-${tab}`, go: async p => { if ((await p.state()).route !== 'party-advanced') await menuTo(p, 'party-advanced'); return await p.tap(`[data-training-tab="${tab}"]`, { optional: true, timeout: 1500 }) || 'skip'; }, after: 'none', primary: DEPART })),
  { id: 'progression-talent-inspector', go: async p => { if ((await p.state()).route !== 'party-advanced') await menuTo(p, 'party-advanced'); if (!await p.tap('[data-training-tab="talents"]', { optional: true, timeout: 1500 })) return 'skip'; return await p.tap('[data-talent]', { optional: true, timeout: 1500 }) || 'skip'; }, after: 'none' },
  { id: 'progression-job-inspector', go: async p => { if ((await p.state()).route !== 'party-advanced') await menuTo(p, 'party-advanced'); if (!await p.tap('[data-training-tab="jobs"]', { optional: true, timeout: 1500 })) return 'skip'; return await p.tap('[data-promote]', { optional: true, timeout: 1500 }) || 'skip'; }, after: 'none', primary: [{ sel: '[data-confirm-job]', optional: true }] },
  { id: 'respec-modal', go: async p => { if ((await p.state()).route !== 'party-advanced') await menuTo(p, 'party-advanced'); if (!await p.tap('[data-training-tab="jobs"]', { optional: true, timeout: 1500 })) return 'skip'; if (!await p.tap('[data-respec]', { optional: true, timeout: 1500 })) return 'skip'; return (await p.state()).layer === 'modal' || 'skip'; }, after: 'escape', primary: DIALOG },
  { id: 'party-gear-inspector', go: async p => { if ((await p.state()).route !== 'party') await menuTo(p, 'party'); if (!await p.tap('[data-training-tab="gear"]', { optional: true, timeout: 1500 })) return 'skip'; return await p.tap('[data-gear-item]:not(.equipped)', { optional: true, timeout: 1500 }) || 'skip'; }, primary: [{ sel: '[data-confirm-gear]', optional: true }] },
  { id: 'quests', go: async p => { await menuTo(p, 'quests'); return true; }, primary: [{ sel: '[data-claim-all]', optional: true }] },
  { id: 'bestiary', go: async p => { await menuTo(p, 'bestiary'); return true; }, after: 'none' },
  { id: 'bestiary-detail', needs: ['bestiary'], go: async p => { if ((await p.state()).route !== 'bestiary') await menuTo(p, 'bestiary'); return await p.tap('.bestiary-cell:not(.unseen):not(.chosen)', { optional: true, timeout: 1500 }) || 'skip'; } },
  { id: 'crystal-exchange', go: async p => { await menuTo(p, 'challenge-shop'); return true; } },
  { id: 'recruit-scene', saves: ['mid', 'late'], go: async p => { await p.evaluate(`(window.gridbound.recruitScene(1), true)`); await sleep(900); await p.settle(); return (await p.state()).layer === 'scene' || 'skip'; }, primary: [{ sel: '.dialogue-skip' }] },
  { id: 'unlock-card', saves: ['mid'], go: async p => { await p.evaluate(`(window.gridbound.unlockIntro(true), true)`); await sleep(700); await p.settle(); return (await p.state()).layer === 'modal' || 'skip'; }, primary: DIALOG },
  { id: 'gate-map', go: async p => { await gateTo(p, 'campaign'); return true; }, after: 'none' },
  { id: 'dossier', go: async p => { if (!['campaign', 'mission'].includes((await p.state()).route)) await gateTo(p, 'campaign'); return await p.tap('.map-selected [data-mission]', { optional: true, timeout: 2000 }) || await p.tap('[data-mission]', { optional: true, timeout: 2000 }) || 'skip'; }, primary: [{ sel: '[data-depart]' }] },
  { id: 'undercroft', saves: ['mid', 'late'], go: async p => { await gateTo(p, 'dungeon'); return true; }, after: 'none', primary: [{ sel: '[data-dungeon-pick]:not(:disabled), .room.open', optional: true }] },
  { id: 'depth-dossier', saves: ['mid', 'late'], go: async p => { if ((await p.state()).route !== 'dungeon') await gateTo(p, 'dungeon'); return await p.tap('[data-dungeon-pick]', { optional: true, timeout: 1500 }) || 'skip'; }, primary: [{ sel: '[data-dungeon-start]' }, { sel: 'dialog[open] [data-nav-exit]' }] },
  { id: 'raid-setup', saves: ['mid', 'late'], go: async p => { await gateTo(p, 'raid'); return (await p.state()).route === 'raid' || 'skip'; }, primary: [{ sel: '[data-depart="raid"]' }] },
  { id: 'endless-setup', saves: ['mid', 'late'], go: async p => { await gateTo(p, 'endless'); return (await p.state()).route === 'endless' || 'skip'; }, primary: [{ sel: '[data-depart="endless"]' }] },
  // ── battles (each chain from a fresh page)
  { id: 'story-intro', reset: true, go: async p => { await toCamp(p); await departStory(p); return (await p.state()).layer === 'scene' || 'skip'; }, after: 'none', primary: [{ sel: '.dialogue-skip' }] },
  { id: 'battle-ready', needs: ['story-intro'], go: async p => {
    await skipScene(p);
    if ((await p.state()).inTown) { await toCamp(p); await departStory(p); await skipScene(p); }
    await p.waitFor(`window.gridbound.battle.status === 'ready' && window.__phone.ready('#start')`, 15000); await sleep(800); await p.settle(); return true; }, after: 'none', battle: 'ready', primary: [{ sel: '#start' }, { sel: '#ready-back' }] },
  { id: 'battle-fight', needs: ['story-intro', 'battle-ready'], go: async p => { await fightStart(p); await sleep(1500); return true; }, after: 'none', battle: 'fight', primary: [{ sel: '#guard' }, { sel: '#potion' }, { sel: '#ultimate' }, { sel: '#pause' }] },
  // C2: the pause menu is reached the way a pulled-down notification shade reaches it (a blur that leaves the page unfocused).
  { id: 'battle-pause', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => {
    // The fight pauses at once; its menu waits for the return (the window's focus), so it never pulls the focus from where the player went.
    await p.evaluate("Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true, writable: true }); window.dispatchEvent(new Event('blur')); true");
    try { await p.waitFor(`window.gridbound.battle.status === 'paused'`, 3000); } catch { p.fail('C2', `a blur away left the fight ${await p.evaluate('window.gridbound.battle.status')}`); }
    await p.evaluate("document.hasFocus = () => true; window.dispatchEvent(new Event('focus')); true");
    try { await p.waitFor(`window.gridbound.battle.status === 'paused' && Boolean(document.querySelector('dialog[open] #pause-retreat'))`, 3000); } catch { p.fail('C2', 'coming back did not show the pause menu'); }
    if ((await p.state()).layer !== 'modal') await p.tap('#pause');
    await p.settle();
    return (await p.state()).layer === 'modal'; }, after: 'none', primary: DIALOG },
  { id: 'battle-help', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => { if ((await p.state()).layer !== 'modal') await p.tap('#pause'); return await p.tap('#pause-help', { optional: true, timeout: 1500 }) || 'skip'; }, after: 'none', primary: DIALOG },
  // G7/K6: a quick double tap on 'Leave battle…' (queued like a fast finger) opens the leave dialog and nothing else; its danger is last.
  { id: 'battle-leave-dialog', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => {
    if ((await p.state()).layer === 'modal' && !await p.evaluate(`window.__phone.ready('#pause-retreat')`)) await p.press('Escape');
    if ((await p.state()).layer !== 'modal') await p.tap('#pause');
    await p.waitFor(`window.__phone.ready('#pause-retreat')`);
    const opener = await p.evaluate(`(() => { const r = document.querySelector('dialog[open] #pause-retreat').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()`);
    await p.touch.rapidDoubleTap('#pause-retreat', 130);
    await p.waitFor(`Boolean(document.querySelector('dialog[open] #abandon-run, dialog[open] #dungeon-flee')) || window.gridbound.inTown`, 8000).catch(() => {});
    await p.settle();
    // K6 also means placement: the danger is never where 'Leave battle…' was (a deliberate second tap there after the hold), and the held
    // tap's press left the focus on the safe option.
    const s = await p.evaluate(`(() => { const o = ${J(opener)}, xs = [o.left + 2, (o.left + o.right) / 2, o.right - 2], ys = [o.top + 2, (o.top + o.bottom) / 2, o.bottom - 2];
      const buttons = [...document.querySelectorAll('dialog[open] .leave-actions button')], id = b => b?.id || b?.dataset.navExit || null;
      return { inTown: window.gridbound.inTown, status: window.gridbound.battle.status, order: buttons.map(id), focus: id(document.activeElement),
        onDanger: xs.flatMap(x => ys.map(y => document.elementFromPoint(x, y)?.closest('.btn.danger') ? [Math.round(x), Math.round(y)] : null)).filter(Boolean) }; })()`);
    if (s.inTown || !s.order.length) p.fail('G7', `the double tap left the battle or closed its dialog: ${J(s)}`);
    else {
      if (!/^(abandon-run|dungeon-flee)$/.test(s.order.at(-1))) p.fail('K6', `the danger is not last: ${s.order.join(', ')}`);
      if (s.onDanger.length) p.fail('K6', `the danger sits where 'Leave battle…' was: ${J(s.onDanger)}`);
      if (s.focus !== s.order[0]) p.fail('K6', `the focus left the safe option after the double tap: ${s.focus}`);
    }
    return (await p.state()).layer === 'modal' || 'skip'; }, after: 'escape', primary: DIALOG },
  { id: 'battle-status', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => { while ((await p.state()).layer === 'modal') await p.press('Escape'); await p.tap('.battle-view-tabs [data-battle-view="hero"]'); return true; }, after: 'none', battle: 'fight' },
  { id: 'battle-log', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => { await p.tap('.battle-view-tabs [data-battle-view="log"]'); return true; }, after: 'none', battle: 'fight' },
  { id: 'result-wave', needs: ['story-intro', 'battle-ready', 'battle-fight'], go: async p => { await p.tap('.battle-view-tabs [data-battle-view="arena"]'); await p.evaluate(DEV_WIN); await waitResult(p); return true; }, after: 'none', name: async p => (await p.evaluate(`Boolean(document.getElementById('next-wave'))`)) ? 'result-wave' : 'result-victory', primary: RESULT },
  { id: 'result-details', needs: ['story-intro', 'battle-ready', 'battle-fight', 'result-wave'], go: async p => await p.tap('#result-details-toggle', { optional: true, timeout: 1500 }) || 'skip', after: 'reset' },
  { id: 'result-defeat', reset: true, go: async p => { await toCamp(p); await departStory(p); await skipScene(p); await fightStart(p); await p.evaluate(DEV_LOSE); await waitResult(p); return true; }, after: 'reset', primary: RESULT },
  { id: 'raid-ready', saves: ['mid', 'late'], reset: true, go: async p => { await toCamp(p); await gateTo(p, 'raid'); if ((await p.state()).route !== 'raid') return 'skip'; await p.tap('[data-depart="raid"]'); await sleep(800); await p.waitFor(`!window.gridbound.inTown && window.gridbound.battle.status === 'ready'`, 15000).catch(() => {}); return !(await p.state()).inTown || 'skip'; }, after: 'none', battle: 'ready', primary: [{ sel: '#start' }] },
  { id: 'raid-fight', saves: ['mid', 'late'], needs: ['raid-ready'], go: async p => { if ((await p.state()).inTown) return 'skip'; await fightStart(p); await sleep(1200); return true; }, after: 'none', battle: 'fight' },
  { id: 'raid-result', saves: ['mid', 'late'], needs: ['raid-ready', 'raid-fight'], go: async p => { if ((await p.state()).inTown) return 'skip'; await p.evaluate(DEV_WIN); await waitResult(p); return true; }, after: 'reset', primary: RESULT },
  { id: 'undercroft-run', saves: ['mid'], reset: true, go: async p => { await toCamp(p); await gateTo(p, 'dungeon'); if (!await p.tap('[data-dungeon-pick]', { optional: true, timeout: 2000 })) return 'skip'; await sleep(700); await p.tap('[data-dungeon-start]'); await sleep(800); return await p.evaluate(`Boolean(document.querySelector('.dungeon-map'))`) || 'skip'; }, after: 'none', primary: [{ sel: '.room.open', all: true }] },
  { id: 'undercroft-room', saves: ['mid', 'late'], needs: ['undercroft-run'], go: async p => { if (p.combo.save === 'late') { await toCamp(p); await gateTo(p, 'dungeon'); } return await p.tap('[data-dungeon-node]:not(:disabled)', { optional: true, timeout: 2000 }) || 'skip'; }, after: 'none' },
  { id: 'undercroft-fight', saves: ['mid', 'late'], needs: ['undercroft-run', 'undercroft-room'], go: async p => { if (!await p.tap('[data-dungeon-fight]', { optional: true, timeout: 2000 })) return 'skip'; await p.waitFor(`!window.gridbound.inTown`, 10000); await fightStart(p); await sleep(1000); return true; }, after: 'none', battle: 'fight' },
  { id: 'undercroft-result', saves: ['mid', 'late'], needs: ['undercroft-run', 'undercroft-room', 'undercroft-fight'], go: async p => { if ((await p.state()).inTown) return 'skip'; await p.evaluate(DEV_WIN); await waitResult(p); return true; }, after: 'reset', primary: RESULT },
  { id: 'trials-ready', saves: ['mid', 'late'], reset: true, go: async p => { await toCamp(p); await gateTo(p, 'endless'); if ((await p.state()).route !== 'endless') return 'skip'; await p.tap('[data-depart="endless"]'); await sleep(800); await p.waitFor(`!window.gridbound.inTown && window.gridbound.battle.status === 'ready'`, 15000).catch(() => {}); return !(await p.state()).inTown || 'skip'; }, after: 'none', battle: 'ready', primary: [{ sel: '#start' }] },
  { id: 'trials-draft', saves: ['mid', 'late'], needs: ['trials-ready'], go: async p => { if ((await p.state()).inTown) return 'skip'; await fightStart(p); await p.evaluate(DEV_WIN); await waitResult(p); return true; }, after: 'reset', primary: [{ sel: '[data-boon]' }] },
];

// ───────────────────────────── run ─────────────────────────────
async function measureHere(p, screen, rec, combo) {
  const dir = join(SHOTS, p.tag);
  await mkdir(dir, { recursive: true });
  rec.variants = [];
  for (const variant of combo.variants) {
    if (variant !== p.variant) { await p.emulate(variant); await sleep(450); await p.settle({ min: 100, quiet: 300, max: 1500 }); }
    const bands = p.prof.insets[variant] ?? {};
    const opts = { bands, coarse: true, landscape: Boolean(p.prof.landscape), primary: screen.primary ?? [], battle: screen.battle };
    let m;
    try { m = await p.evaluate(`window.__phone.measure(${J(opts)})`); } catch (error) { m = { error: String(error.message).slice(0, 300), results: {} }; }
    const shot = join(dir, `${rec.id}-${variant}.png`);
    try {
      if (TINT && Object.keys(bands).length) await p.evaluate(`window.__phone.tint(${J(bands)})`);
      const height = variant === 'bars' ? p.prof.bars : p.prof.height;
      const { data } = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: p.prof.width, height, scale: 1 / p.prof.dpr * Math.min(2, p.prof.dpr) } });
      await writeFile(shot, Buffer.from(data, 'base64'));
    } catch {} finally { await p.evaluate('window.__phone.untint()').catch(() => {}); }
    rec.variants.push({ variant, shot, layer: m.layer, error: m.error, results: m.results });
  }
  if (p.variant !== combo.variants[0]) { await p.emulate(combo.variants[0]); await sleep(350); await p.settle({ min: 100, quiet: 300, max: 1500 }); }
}

/** The check id a raw result belongs to on this screen (T1/K1/K3/L8 are split between TOWN and BATTLE). BATTLE owns the battle screen
 *  itself (its text in dialogs too) and the arrival of results; result screens, the Bell Trials boon draft (its arrival too), and dialog controls
 *  (the ×, menu rows: base.css), belong to TOWN. */
const checkId = (raw, screenId, layer) => {
  if (!['T1', 'K1', 'K3', 'L8'].includes(raw)) return raw;
  const battle = BATTLE_SCREENS.test(screenId) && screenId !== 'trials-draft' && (raw === 'L8' || (layer !== 'result' && !(layer === 'modal' && raw !== 'T1')));
  return `${raw}-${battle ? 'battle' : 'town'}`;
};

async function runCombo(combo) {
  const tag = `${combo.profile}-${combo.variants.join('+')}-${combo.save}-${combo.lang}`;
  const comboSelected = !ONLY || ONLY.test(tag);
  const selected = id => comboSelected || ONLY.test(id);
  const out = { tag, ...combo, screens: [], fatal: null };
  const prof = PROFILES[combo.profile];
  await withBrowser(async h => {
    const p = new Phone(h, combo);
    h.on(message => { if (message.method === 'Page.javascriptDialogOpening') h.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
    try {
      await p.reset();
      out.insetsOverride = h.phone.insetsOverride;
      if (combo.save === 'late') {
        // Leave a raid suspended (dev boot → FIGHT! → Ⅱ Menu → Leave → Save & suspend), then snapshot the storage for every reset.
        await p.evaluate(`(async () => { const g = window.gridbound; if (!document.getElementById('title-screen').hidden) g.hideTitle(); await new Promise(r => setTimeout(r, 400)); g.boot('raid', 1); return true; })()`);
        await p.waitFor(`window.gridbound.battle.status === 'ready' && !document.getElementById('start').hidden`, 15000);
        await p.evaluate(`document.getElementById('start').click(), true`);
        await p.waitFor(`window.gridbound.battle.status === 'fighting'`, 10000);
        await sleep(500);
        await p.evaluate(`document.getElementById('pause').click(), true`); await p.waitFor(`Boolean(document.getElementById('pause-retreat'))`);
        await p.evaluate(`document.getElementById('pause-retreat').click(), true`); await p.waitFor(`Boolean(document.getElementById('suspend-run'))`);
        await p.evaluate(`document.getElementById('suspend-run').click(), true`); await p.waitFor(`window.gridbound.inTown`, 10000);
        await sleep(800);
        p.snapshot = await p.evaluate(SNAPSHOT_JS);
        await p.reset();
      }
      let needReset = false;
      const tour = TOUR.filter(s => !s.saves || s.saves.includes(combo.save));
      const wanted = new Set(tour.filter(s => selected(s.id)).flatMap(s => [s.id, ...(s.needs ?? [])]));
      for (const screen of tour) {
        if (!wanted.has(screen.id)) { if (screen.reset || screen.after === 'reset') needReset = true; continue; }
        const measure = selected(screen.id);
        const rec = { id: screen.id };
        const errorsBefore = h.errors.length;
        p.notes.length = 0; p.checks = {};
        try {
          if (screen.reset || needReset) { await p.reset(); needReset = false; if (!/^title/.test(screen.id)) await toCamp(p); }
          const ok = await screen.go(p);
          if (ok === 'skip' || ok === false) { rec.skipped = ok === false ? 'not reached' : 'n/a on this save'; if (measure) { out.screens.push(rec); printScreen(tag, rec); } if (screen.after === 'reset') needReset = true; continue; }
          if (!measure) { if (screen.after === 'reset') needReset = true; continue; }
          await p.settle({ min: 200 });
          if (screen.name) rec.id = await screen.name(p);
          rec.state = await p.state();
          await measureHere(p, screen, rec, combo);
        } catch (error) {
          rec.error = String(error.message || error).slice(0, 300);
          needReset = true;
        }
        if (p.notes.length) rec.notes = [...p.notes];
        if (Object.keys(p.checks).length) rec.checks = p.checks;
        rec.errors = h.errors.slice(errorsBefore).map(e => String(e.text ?? e.exception?.description ?? e.args?.map(a => a.value ?? a.description).join(' ') ?? JSON.stringify(e)).slice(0, 200));
        if (measure) { out.screens.push(rec); printScreen(tag, rec); }
        try {
          if (needReset) continue;
          const after = screen.after || 'camp';
          if (after === 'reset') needReset = true;
          else if (after === 'escape') await p.press('Escape');
          else if (after === 'camp' && !await toCamp(p)) needReset = true;
        } catch { needReset = true; }
      }
    } catch (error) { out.fatal = String(error.stack || error).slice(0, 500); log(tag, 'FATAL', error.message); }
  }, { phone: { width: prof.width, height: combo.variants[0] === 'bars' ? prof.bars : prof.height, dpr: prof.dpr, ua: prof.ua, landscape: Boolean(prof.landscape), insets: prof.insets[combo.variants[0]] ?? {} } });
  return out;
}

/** Per screen: the failures of every check (gate and report), per variant. */
function verdicts(rec) {
  const rows = {};
  const add = (id, items) => { if (!items?.length) return; (rows[id] ??= []).push(...items); };
  if (rec.error) add('tour', [{ text: rec.error }]);
  if (rec.skipped === 'not reached') add('tour', [{ text: 'not reached' }]);
  add('errors', (rec.errors ?? []).map(text => ({ text })));
  for (const [id, items] of Object.entries(rec.checks ?? {})) add(id, items);
  for (const v of rec.variants ?? []) {
    if (v.error) add('tour', [{ text: `measure: ${v.error}` }]);
    for (const [raw, items] of Object.entries(v.results ?? {})) add(checkId(raw, rec.id, v.layer), items.map(item => ({ variant: v.variant, ...item })));
  }
  return rows;
}
function printScreen(tag, rec) {
  if (rec.skipped && rec.skipped !== 'not reached') { log(tag, `${rec.id}: skipped (${rec.skipped})`); return; }
  const rows = verdicts(rec), gate = [], report = [];
  for (const [id, items] of Object.entries(rows)) (CHECKS[id]?.mode === 'gate' ? gate : report).push(`${id} ${items.length}`);
  log(tag, `${rec.id}: ${gate.length ? 'FAIL ' + gate.join(', ') : 'gate ok'}${report.length ? ' | report: ' + report.join(', ') : ''}${rec.notes ? ' | note: ' + rec.notes.join('; ') : ''}`);
  for (const [id, items] of Object.entries(rows)) if (CHECKS[id]?.mode === 'gate') for (const item of items.slice(0, 4)) console.log(`      ${id}: ${J(item).slice(0, 220)}`);
}

const combos = MATRIX.filter(combo => !ONLY || ONLY.test(`${combo.profile}-${combo.variants.join('+')}-${combo.save}-${combo.lang}`) || TOUR.some(s => ONLY.test(s.id)));
if (!combos.length) throw Error(`PHONE_ONLY=${process.env.PHONE_ONLY} matches no combo or screen`);
const report = { started: new Date().toISOString(), url: URL_, checks: CHECKS, combos: [] };
for (const combo of combos) report.combos.push(await runCombo(combo));
// Summary: failures per check across every combo and screen.
const summary = {};
let gateFailures = 0;
for (const combo of report.combos) {
  if (combo.fatal) { (summary.tour ??= { failures: 0, where: [] }).failures++; summary.tour.where.push(`${combo.tag}: ${combo.fatal.split('\n')[0]}`); gateFailures++; }
  if (combo.insetsOverride !== true && Object.values(PROFILES[combo.profile].insets).some(b => Object.keys(b).length)) console.warn(`[${combo.tag}] Emulation.setSafeAreaInsetsOverride unavailable (${combo.insetsOverride}): L3 checks the layout without insets`);
  for (const rec of combo.screens) for (const [id, items] of Object.entries(verdicts(rec))) {
    const s = summary[id] ??= { failures: 0, where: [] };
    s.failures += items.length; s.where.push(`${combo.tag} ${rec.id}`);
    if (CHECKS[id]?.mode === 'gate') gateFailures += items.length;
  }
}
report.summary = summary;
report.elapsedS = Math.round((Date.now() - T0) / 1000);
await mkdir(SHOTS, { recursive: true });
await writeFile(join(SHOTS, 'report.json'), JSON.stringify(report, null, 1));
console.log('\nCheck                 mode    owner   failures  screens');
for (const [id, check] of Object.entries(CHECKS)) { const s = summary[id]; console.log(`${id.padEnd(21)} ${check.mode.padEnd(7)} ${check.owner.padEnd(7)} ${String(s?.failures ?? 0).padStart(8)}  ${s ? new Set(s.where).size : 0}`); }
console.log(`report: ${join(SHOTS, 'report.json')}, screenshots in ${SHOTS}/ (${report.elapsedS}s)`);
if (gateFailures) { console.error(`FAIL phone contract: ${gateFailures} gate failure(s)`); process.exit(1); }
console.log(`PASS phone contract (${combos.length} combo(s)): ${Object.entries(CHECKS).filter(([, c]) => c.mode === 'gate').map(([id]) => id).join(', ')}`);
