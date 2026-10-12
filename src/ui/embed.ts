/**
 * Embedded play (itch.io serves HTML games in an <iframe> on another origin): the game keeps the keyboard after a click on it,
 * keeps the host page still, and offers fullscreen when the page allows it. Outside an iframe only `fullscreen*` matters.
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
/** In a frame, a wheel or key scroll that nothing in the game takes chains to the host page (it jumps away mid-battle), and a first
 *  click whose default is prevented (the arena canvas) leaves the keyboard on the host page. The wheel is held only while the whole
 *  frame is on screen: a frame that the host page's window cuts off (an embed taller than a laptop window, or a page scrolled half
 *  past it) still lets the wheel scroll the page, so the player can bring the game into view. Returns whether the guards were installed. */
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
/** Toggle fullscreen on the whole page (needs a user gesture); resolves to the resulting state, never throws. */
export async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); }
  catch (error) { console.warn('Fullscreen:', error); }
  return fullscreenOn();
}
