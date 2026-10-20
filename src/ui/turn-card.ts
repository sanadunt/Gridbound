// The Turn card (contract L6, portrait only): a phone held sideways gets one full-screen card asking to turn it upright instead of a
// sideways layout. It covers everything (the CSS shows it under the same media query, so it is there from the first paint), pauses a live
// fight, makes the game behind it inert and gives the focus back when it hides. It is no navigation layer: Back keys and the phone's Back
// reach the screen beneath (backAction is unchanged), so the history guard and every exit work as before.
import { t } from '../i18n';
import { turnPhoneURL } from '../art/turn-phone';

/** The shape that shows the card: a finger-first screen held sideways and short (a phone; a tablet sideways keeps the portrait column). */
export const TURN_QUERY = '(pointer: coarse) and (orientation: landscape) and (max-height: 500px)';
export type TurnHooks = {
  /** Pause a live fight without opening its menu (the menu would sit hidden under the card). */
  pause(): void;
  /** The card is gone: open the menu the paused fight waits behind (nothing resumes by itself). */
  restored(): void;
  /** A battle is on screen, fighting or paused: the card says it waits. */
  fight(): boolean;
  /** Play upright is possible here (fullscreen + an orientation lock, not an installed app). */
  canUpright(): boolean;
  /** Fullscreen and the portrait lock (needs the tap's activation). */
  upright(): Promise<{ locked: boolean }>;
  /** Android's Back (or Escape) asked the card, the topmost dialog, to close: one Back step for the screen beneath. */
  back(): void;
};
/** Keys that pass the card: the Back steps (main.ts decides what they do on the screen beneath). Tab, Enter and Space only work the card's
 *  own button (Space on the card itself would reach the battle's pause toggle, Enter a ready window's FIGHT!). */
const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack']), BUTTON_KEYS = new Set(['Tab', 'Enter', 'Space', 'NumpadEnter']);

export function installTurnCard(hooks: TurnHooks) {
  const media = typeof matchMedia === 'function' ? matchMedia(TURN_QUERY) : undefined;
  // A <dialog> shown modal: the game's own dialog (#modal, also modal) would otherwise make everything outside it inert, the card included.
  // Shown last, the card is the topmost modal dialog; it is raised again whenever another dialog opens or fullscreen changes the top layer.
  const card = document.createElement('dialog');
  card.id = 'turn-card';
  card.className = 'turn-card';
  card.setAttribute('aria-labelledby', 'turn-title');
  card.setAttribute('aria-describedby', 'turn-body');
  card.tabIndex = -1;
  card.innerHTML = `<div class="turn-inner"><div class="turn-art" aria-hidden="true"><i></i></div><div class="turn-copy"><h2 id="turn-title">${t('turn.title')}</h2><p id="turn-body"><span>${t('turn.body')}</span> <span class="turn-fight" hidden>${t('turn.body.fight')}</span></p><p id="turn-locked" class="turn-locked" role="status"></p><button id="turn-upright" class="btn primary turn-upright" type="button" hidden>${t('turn.upright')}</button></div></div>`;
  document.body.append(card);
  const fightLine = card.querySelector<HTMLElement>('.turn-fight')!, locked = card.querySelector<HTMLElement>('#turn-locked')!, upright = card.querySelector<HTMLButtonElement>('#turn-upright')!;
  let shown = false, opener: HTMLElement | null = null, made: HTMLElement[] = [];
  upright.addEventListener('click', async () => {
    upright.disabled = true;
    const result = await hooks.upright().catch(() => ({ locked: false }));
    upright.disabled = false;
    if (!result.locked && shown) { locked.textContent = t('turn.locked'); upright.hidden = true; }
  });
  // Nothing but a Back step or the card's own button reaches the game while it shows (Enter on a ready window would start the fight).
  window.addEventListener('keydown', event => {
    if (!shown || BACK_KEYS.has(event.code) || BACK_KEYS.has(event.key)) return;
    if (BUTTON_KEYS.has(event.code) && event.target instanceof Element && card.contains(event.target)) { if (event.target !== upright) event.preventDefault(); event.stopImmediatePropagation(); return; }
    event.stopImmediatePropagation();
  }, true);
  /** Put the card on top of the top layer (a reopened #modal, a fullscreen document root would sit above it) and give it the focus. */
  const raise = () => {
    if (!shown) return;
    if (card.open) card.close();
    try { card.showModal(); } catch { card.setAttribute('open', ''); }
    card.focus({ preventScroll: true });
  };
  // Back reaches the screen beneath; a browser that closes the card anyway (repeated requests without a tap) gets it back at once.
  card.addEventListener('cancel', event => { event.preventDefault(); hooks.back(); });
  card.addEventListener('close', () => { if (shown && !card.open) raise(); });
  new MutationObserver(records => { if (shown && records.some(r => r.target !== card && r.target instanceof HTMLDialogElement && r.target.open)) raise(); })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  document.addEventListener('fullscreenchange', () => { if (shown) raise(); });
  const show = () => {
    shown = true;
    hooks.pause();
    fightLine.hidden = !hooks.fight();
    locked.textContent = '';
    upright.hidden = !hooks.canUpright();
    card.querySelector<HTMLElement>('.turn-art > i')!.style.backgroundImage = `url(${turnPhoneURL()})`;
    const active = document.activeElement;
    opener = active instanceof HTMLElement && active !== document.body && !card.contains(active) ? active : null;
    // Everything else on the page goes inert (the game, an open dialog inside it, the coach bubble); only what the card made inert is restored.
    made = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== card && !el.inert && el.tagName !== 'SCRIPT');
    made.forEach(el => { el.inert = true; });
    document.body.classList.add('turn-up');
    raise();
  };
  const hide = () => {
    shown = false;
    if (card.open) card.close();
    made.forEach(el => { el.inert = false; });
    made = [];
    document.body.classList.remove('turn-up');
    const back = opener; opener = null;
    if (back?.isConnected && !back.closest('[hidden],[inert]') && (document.activeElement === document.body || document.activeElement === card || card.contains(document.activeElement))) back.focus({ preventScroll: true });
    hooks.restored();
  };
  const sync = () => { const want = Boolean(media?.matches); if (want !== shown) (want ? show : hide)(); };
  media?.addEventListener('change', sync);
  sync();
  return { shown: () => shown, sync };
}
