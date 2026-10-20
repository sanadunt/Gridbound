/**
 * Embedded play (itch.io serves HTML games in an <iframe> on another origin): the game keeps the keyboard after a click on it,
 * keeps the host page still, and offers fullscreen when the page allows it. Outside an iframe only the fullscreen part matters (Config → Fullscreen
 * on Android's web build too, phone contract I1).
 */
type Axis = 'x' | 'y';
/** Keys whose default action scrolls, with the direction they scroll in (Shift+Space scrolls up). */
const SCROLL_KEYS: Record<string, [Axis, number]> = { ArrowDown: ['y', 1], ArrowUp: ['y', -1], PageDown: ['y', 1], PageUp: ['y', -1], End: ['y', 1], Home: ['y', -1], Space: ['y', 1], ArrowRight: ['x', 1], ArrowLeft: ['x', -1] };
/** True inside any frame; a cross-origin parent throws on access, which also means framed. */
export function framed() { try { return window.self !== window.top; } catch { return true; } }
/** Can `from` or one of its ancestors still scroll along `axis` (sign > 0: down/right)? The page itself never scrolls (html/body hide overflow). */
export function scrollsWithin(from: Element | null, axis: Axis, sign: number) {
  for (let el = from; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el), overflow = axis === 'y' ? style.overflowY : style.overflowX;
    if (!/auto|scroll|overlay/.test(overflow)) continue;
    const at = axis === 'y' ? el.scrollTop : el.scrollLeft, max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    if (max > 1 && (sign > 0 ? at < max - 1 : at > 0)) return true;
  }
  return false;
}
/** In a frame, a wheel, key or one-finger swipe that nothing in the game takes chains to the host page (it jumps away mid-battle, or a
 *  phone pulls it to refresh), and a first click whose default is prevented (the arena canvas) leaves the keyboard on the host page.
 *  The wheel and swipes are held only while the whole frame is on screen: a frame that the host page's window cuts off (an embed taller
 *  than a laptop window, or a page scrolled half past it) still lets them scroll the page, so the player can bring the game into view.
 *  Returns whether the guards were installed. */
export function installEmbedGuards() {
  if (!framed()) return false;
  document.documentElement.classList.add('embedded');
  // Inside a cross-origin frame an IntersectionObserver measures against the top-level window. Without one the frame counts as shown.
  let wholeFrameShown = true;
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => { for (const entry of entries) wholeFrameShown = entry.intersectionRatio >= 0.99; }, { threshold: [0, 0.99, 1] }).observe(document.documentElement);
  // Keyboard scrolling with the focus on <body> follows the last clicked element, as the browser does.
  let lastPointer: Element | null = null;
  window.addEventListener('pointerdown', event => { lastPointer = event.target instanceof Element ? event.target : null; if (!document.hasFocus()) window.focus(); }, true);
  window.addEventListener('wheel', event => {
    if (event.ctrlKey || !wholeFrameShown) return; // pinch / Ctrl+wheel zoom stays the browser's; a cut-off frame lets the page scroll
    const axis: Axis = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? 'y' : 'x', delta = axis === 'y' ? event.deltaY : event.deltaX;
    if (delta && !scrollsWithin(event.target instanceof Element ? event.target : null, axis, Math.sign(delta))) event.preventDefault();
  }, { passive: false });
  // The same for a finger: a one-finger swipe that nothing in the game can scroll would scroll the itch page (mid-fight the game slides
  // away) or, at its top, pull it to refresh (the game reloads). It is cancelled on its first cancelable move, which decides the whole
  // swipe (once the browser starts a scroll, later moves cannot be cancelled). A pinch, a cut-off frame and text fields keep the browser's way.
  let swipe: { x: number; y: number; target: Element | null; hold?: boolean } | null = null;
  window.addEventListener('touchstart', event => {
    const touch = event.touches.length === 1 ? event.touches[0] : undefined;
    swipe = touch ? { x: touch.clientX, y: touch.clientY, target: event.target instanceof Element ? event.target : null } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchmove', event => {
    if (!swipe || event.touches.length !== 1 || event.defaultPrevented || !event.cancelable || !wholeFrameShown) return;
    if (swipe.hold === undefined) {
      if (swipe.target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) { swipe.hold = false; return; }
      const touch = event.touches[0], dx = touch.clientX - swipe.x, dy = touch.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) return;
      const axis: Axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x', delta = axis === 'y' ? dy : dx;
      swipe.hold = !scrollsWithin(swipe.target, axis, -Math.sign(delta)); // a finger moving up asks to scroll the content down
    }
    if (swipe.hold) event.preventDefault();
  }, { capture: true, passive: false });
  window.addEventListener('keydown', event => {
    const key = SCROLL_KEYS[event.code];
    if (!key || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.code === 'Space' && target.closest('button, a[href], summary, label, [role="button"]')) return; // Space presses the control
    const from = target === document.body || target === document.documentElement ? lastPointer ?? document.body : target;
    if (!scrollsWithin(from, key[0], event.code === 'Space' && event.shiftKey ? -1 : key[1])) event.preventDefault();
  });
  return true;
}
/** Fullscreen is offered only where the page may use it (an iframe needs allow="fullscreen"; iPhone Safari has no element fullscreen). */
export const fullscreenAvailable = () => typeof document !== 'undefined' && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function';
export const fullscreenOn = () => Boolean(document.fullscreenElement);
/** Installed to the Home Screen (iOS `navigator.standalone`) or opened from an installed app's icon: no browser bars to hide. */
export const standaloneApp = () => (typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement)) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
/** I1: the player's choice, per viewer (gridbound. prefix: itch's origin is shared). */
export const FULLSCREEN_KEY = 'gridbound.ui.fullscreen';
function rememberFullscreen(on: boolean) { try { localStorage.setItem(FULLSCREEN_KEY, on ? '1' : '0'); } catch { /* storage blocked: not remembered */ } }
export function fullscreenWanted() { try { return localStorage.getItem(FULLSCREEN_KEY) === '1'; } catch { return false; } }
const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void>; unlock?: () => void };
/** Lock the screen upright: resolves to whether the browser agreed (a desktop, iPhone, a frame without the right or a browser that holds
 *  the screen sideways itself refuses), never throws. */
async function lockPortrait(orientation = 'portrait') {
  const lock = (screen.orientation as LockableOrientation | undefined)?.lock;
  if (typeof lock !== 'function') return false;
  try { await lock.call(screen.orientation, orientation); return true; } catch { return false; }
}
/** Enter fullscreen and, on a phone, ask for portrait. Resolves to `{ locked }`: whether the portrait lock held (false on a desktop, which
 *  is never asked, and wherever the browser refuses). */
async function enterFullscreen() {
  await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  return { locked: coarse() ? await lockPortrait() : false };
}
/** A lock is possible here: fullscreen is available, the browser has an orientation lock and the page is not an installed app (which the
 *  manifest already holds upright). The Turn card offers Play upright only then. */
export const uprightAvailable = () => fullscreenAvailable() && typeof (screen.orientation as LockableOrientation | undefined)?.lock === 'function' && !standaloneApp();
/** Play upright (the Turn card, needs a user gesture): fullscreen on this document — also nested inside a host's fullscreen (itch's
 *  frame has allow="fullscreen") — then the portrait lock. When the lock is refused, a fullscreen this call entered is left again (it
 *  would only hide the browser's controls on a sideways screen). Resolves to `{ locked }`, never throws. */
export async function playUpright() {
  const entered = !document.fullscreenElement;
  try { if (entered) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); }
  catch (error) { console.warn('Fullscreen:', error); return { locked: false }; }
  const locked = await lockPortrait('portrait-primary');
  if (!locked && entered && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  else if (locked) rememberFullscreen(true);
  return { locked };
}
/** Toggle fullscreen on the whole page (needs a user gesture); resolves to the resulting state and remembers it, never throws. */
export async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await enterFullscreen(); }
  catch (error) { console.warn('Fullscreen:', error); }
  rememberFullscreen(fullscreenOn());
  return fullscreenOn();
}
let fullscreenLeftAt = -Infinity, unloading = false, visibilityAt = -Infinity, armed = false;
/** Fullscreen bookkeeping on every host: leaving it by the system (the phone's Back, Esc, the browser's own control) remembers 'off', so the
 *  game never fights the player, and drops the portrait lock. A page being unloaded (a reload in fullscreen) keeps the choice, and so does
 *  one that leaves it while hidden or within a second of hiding or showing again (a phone may drop fullscreen when the player switches apps
 *  or pulls down the shade). A choice remembered as 'on' is asked for again on the next real tap or key (a request needs a user activation),
 *  after a reload and after the page is shown again, except under automation, in an installed app (already without bars) or where
 *  fullscreen is unavailable. */
export function installFullscreen() {
  if (typeof document === 'undefined' || !fullscreenAvailable()) return;
  armed = false; visibilityAt = -Infinity;
  window.addEventListener('pagehide', () => { unloading = true; });
  window.addEventListener('pageshow', () => { unloading = false; armFullscreen(); });
  document.addEventListener('visibilitychange', () => { visibilityAt = performance.now(); if (document.visibilityState !== 'hidden') armFullscreen(); });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) return;
    fullscreenLeftAt = performance.now();
    try { (screen.orientation as LockableOrientation | undefined)?.unlock?.(); } catch { /* not locked */ }
    if (!unloading && document.visibilityState !== 'hidden' && fullscreenLeftAt - visibilityAt > 1000) rememberFullscreen(false);
  });
  armFullscreen();
}
function armFullscreen() {
  if (armed || document.fullscreenElement || !fullscreenWanted() || navigator.webdriver || standaloneApp()) return;
  armed = true;
  const again = (event: Event) => {
    if (event.type === 'keydown' && (event as KeyboardEvent).code === 'Escape') return; // Escape grants no activation
    armed = false;
    window.removeEventListener('pointerup', again, true); window.removeEventListener('keydown', again, true);
    if (!document.fullscreenElement) enterFullscreen().catch(error => console.warn('Fullscreen:', error));
  };
  window.addEventListener('pointerup', again, true); window.addEventListener('keydown', again, true);
}
/** An Escape that leaves fullscreen is the browser's, not a game Back step (I1). Chrome on a desktop consumes it; a browser that still
 *  passes the keydown on either sends it after leaving (within a moment) or before: then `later` decides once the browser has acted. */
export function fullscreenEscape(later: () => void) {
  if (performance.now() - fullscreenLeftAt < 250) return true;
  if (!document.fullscreenElement) return false;
  window.setTimeout(() => { if (document.fullscreenElement && performance.now() - fullscreenLeftAt >= 250) later(); }, 150);
  return true;
}
