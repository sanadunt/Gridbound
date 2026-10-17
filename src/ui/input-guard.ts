/** G7 (phone contract §5): content that appears or moves under a finger ignores pointer activations for a moment, so the second tap of a
 *  double tap never presses what the first tap opened or moved there (a dialog, its new content, a town re-render, an inspector). The hold
 *  is a timestamp on the element (`data-input-until`, in performance.now() ms), so browser tests can wait it out like a player would.
 *  Keyboard and assistive-tech activations (click detail 0) are never held. */
export const INPUT_DELAY_MS = 450;
/** Controls that spend, abandon or destroy: held as long as a story choice (CHOICE_INPUT_DELAY_MS). */
export const DANGER_CONTROLS = '.btn.danger, #abandon-run, #dungeon-flee, #respec-confirm, #delete-confirm, [data-dungeon-start]';
/** Town controls that a re-render can put under the finger, and those of them that spend or change a build. */
export const TOWN_HELD = '[data-equip-skill], [data-confirm-gear], [data-confirm-job], [data-gear-item], [data-bank-buy], [data-confirm-bank], [data-promote]';
export const TOWN_SPEND = '[data-equip-skill], [data-confirm-gear], [data-confirm-job], [data-confirm-bank]';
export function holdInput(elements: ArrayLike<HTMLElement>, ms: number, now = performance.now()) { for (let i = 0; i < elements.length; i++) elements[i].dataset.inputUntil = String(now + ms); }
/** The event is a pointer activation (a tap or a click) on something still held. It is timed by when the finger landed (the event's
 *  timeStamp: a busy page may deliver a quick second tap long after it happened), or by now where a browser gives no usable stamp. */
export function inputHeld(event: Event) {
  if (typeof MouseEvent === 'undefined' || !(event instanceof MouseEvent) || event.detail === 0) return false;
  return pressHeld(event);
}
/** The press (pointerdown/mousedown, never a keyboard's) of a held control: cancelled too, so the dropped tap does not move the focus off the
 *  confirmation's safe option onto what it landed on. */
export function pressHeld(event: Event) {
  if (typeof MouseEvent === 'undefined' || !(event instanceof MouseEvent)) return false;
  const held = (event.target as Element | null)?.closest?.<HTMLElement>('[data-input-until]');
  if (!held) return false;
  const now = performance.now(), at = event.timeStamp > 0 && event.timeStamp <= now ? event.timeStamp : now;
  return at < Number(held.dataset.inputUntil);
}
/** K6: a destructive option never appears where the control that opened its dialog was (or within 8px of it), so a second deliberate tap on
 *  the same spot, after the G7 hold, lands on a safe option or on nothing. The dialog is centred: a danger that would sit there gets a margin
 *  that moves it below the opener, or above it when below would leave the screen. `opener` is the pressed control's rectangle. */
export function keepDangerOff(dialog: HTMLElement, opener: DOMRect | undefined, selector = DANGER_CONTROLS, gap = 8) {
  if (!opener || !opener.width || !opener.height) return;
  const near = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > opener.top - gap && r.top < opener.bottom + gap && r.right > opener.left - gap && r.left < opener.right + gap;
  const scrolls = () => dialog.scrollHeight > dialog.clientHeight + 1, scrolled = scrolls();
  const fits = (r: DOMRect) => r.top >= 0 && r.bottom <= (window.visualViewport?.height ?? window.innerHeight) && (scrolled || !scrolls());
  dialog.querySelectorAll<HTMLElement>(selector).forEach(danger => {
    if (!near(danger.getBoundingClientRect())) return;
    const tryMove = (prop: 'marginTop' | 'marginBottom') => {
      // A margin m moves the danger by m/2 in a centred dialog and by m in one at its full height (it scrolls): step by what is missing.
      for (let i = 0; i < 10; i++) {
        const r = danger.getBoundingClientRect();
        if (!near(r)) return fits(r);
        const need = prop === 'marginTop' ? opener.bottom + gap - r.top : r.bottom - (opener.top - gap);
        danger.style[prop] = `${(parseFloat(danger.style[prop]) || 0) + Math.ceil(Math.max(need, 0)) + 1}px`;
      }
      const r = danger.getBoundingClientRect();
      return !near(r) && fits(r);
    };
    if (tryMove('marginTop')) return;
    danger.style.marginTop = '';
    if (tryMove('marginBottom')) return;
    // Neither way fits on screen: below the opener, where the dialog scrolls to it.
    danger.style.marginBottom = '';
    tryMove('marginTop');
  });
}
