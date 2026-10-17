import { t } from '../i18n';

/** The first-battle coach's tips, each shown once: tap a hero, drag off a ground telegraph, Guard an all-grid hit, fire the ultimate. */
export type CoachStep = 'tap' | 'drag' | 'guard' | 'ult';
export const COACH_STEPS: readonly CoachStep[] = ['tap', 'drag', 'guard', 'ult'];
const KEY = 'gridbound.coach';
type CoachFlags = { off?: boolean; done?: CoachStep[] };
let memory: CoachFlags | undefined;
function flags(): CoachFlags {
  if (memory) return memory;
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as CoachFlags; memory = { off: raw.off === true, done: Array.isArray(raw.done) ? raw.done.filter(step => COACH_STEPS.includes(step)) : [] }; } catch { memory = { done: [] }; }
  return memory;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(flags())); } catch { /* storage blocked: the tips are remembered for this page only */ } }
/** Config → Battle tips. */
export const coachEnabled = () => !flags().off;
/** Turning tips back on replays them from the start. */
export function setCoachEnabled(on: boolean) { const f = flags(); f.off = !on; if (on) f.done = []; save(); }
export const coachDone = (step: CoachStep) => Boolean(flags().done?.includes(step));
export const coachFinished = () => COACH_STEPS.every(coachDone);
export function markCoach(step: CoachStep) { const f = flags(); if (!f.done!.includes(step)) { f.done!.push(step); save(); } }
export function skipCoach() { flags().done = [...COACH_STEPS]; save(); }
/** QA: forget which tips were shown. */
export function resetCoach() { flags().done = []; save(); }

/** Where the bubble may go: candidate regions (in order), rectangles it must never cover (hero cards, the boss HP bar), and in landscape
 *  the column beside the arena (`side`). Viewport coordinates. */
export type CoachLayout = { regions: DOMRect[]; avoid: DOMRect[]; side?: DOMRect; maxWidth: number };
const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

/** The tip bubble: a short line (two lines at most) with an arrow at the control it is about, and a Skip button. It never blocks drags
 *  or taps (only Skip takes input) and never covers a hero card, the boss HP bar or its own target. */
export class Coach {
  readonly el: HTMLElement;
  step?: CoachStep;
  private target?: () => Element | null;
  private text: HTMLElement;
  constructor(host: HTMLElement, onSkip: () => void, private layout?: () => CoachLayout) {
    this.el = document.createElement('div');
    this.el.id = 'coach';
    this.el.className = 'coach-bubble';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.hidden = true;
    this.el.innerHTML = `<small>${t('coach.label')}</small><b class="coach-text"></b><button type="button" class="coach-skip">${t('coach.skip')}</button><i class="coach-arrow" aria-hidden="true"></i>`;
    this.text = this.el.querySelector('.coach-text')!;
    this.el.querySelector('.coach-skip')!.addEventListener('click', event => { event.stopPropagation(); onSkip(); });
    host.append(this.el);
  }
  show(step: CoachStep, text: string, target: () => Element | null) {
    this.step = step; this.target = target;
    if (this.text.textContent !== text) this.text.textContent = text;
    this.el.dataset.step = step;
    this.el.hidden = false;
    document.body.classList.add('coaching');
    this.place();
  }
  hide() { this.step = undefined; this.target = undefined; this.el.hidden = true; document.body.classList.remove('coaching'); }
  /** Place the bubble (G1 of the battle package): in the first candidate region where it fits without covering a hero card, the boss HP
   *  bar or its target (the band between the threat panel and the front row, the focus bar's place, the column beside the arena in
   *  landscape: the nearest that fits; beside a card on the arena's side in landscape); else above the target (below it when there is no room). The arrow points at the target: a stem reaches it when the bubble is away.
   *  Everything stays inside the game's safe rectangle (#app's content box: the viewport less the notch, the home indicator and a
   *  landscape phone's sides). */
  place() {
    const target = this.target?.();
    if (this.el.hidden || !target) return;
    const host = this.el.offsetParent?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight), box = target.getBoundingClientRect();
    const app = document.getElementById('app'), frame = app?.getBoundingClientRect() ?? host, pad = app ? getComputedStyle(app) : undefined, px = (v?: string) => parseFloat(v ?? '') || 0;
    const minX = Math.max(0, frame.left + px(pad?.paddingLeft) - host.left), maxX = Math.min(host.width, frame.right - px(pad?.paddingRight) - host.left), minY = Math.max(0, frame.top + px(pad?.paddingTop) - host.top);
    const cx = box.left + box.width / 2 - host.left, cy = box.top + box.height / 2 - host.top, layout = this.layout?.();
    const put = (left: number, top: number, width: number, mode: 'above' | 'below' | 'side', len: number) => {
      this.el.classList.toggle('below', mode === 'below');
      this.el.classList.toggle('side', mode === 'side');
      this.el.style.width = `${Math.round(width)}px`;
      this.el.style.left = `${Math.round(left)}px`;
      this.el.style.top = `${Math.round(top)}px`;
      this.el.style.setProperty('--arrow-len', `${Math.max(0, Math.round(len))}px`);
      this.el.style.setProperty('--arrow-x', `${Math.round(Math.max(14, Math.min(width - 14, cx - left)))}px`);
      this.el.style.setProperty('--arrow-y', `${Math.round(Math.max(14, Math.min(this.el.offsetHeight - 14, cy - top)))}px`);
    };
    const sized = (width: number) => { this.el.style.width = `${Math.round(width)}px`; return this.el.offsetHeight; };
    if (layout) {
      const free = (r: DOMRect) => !layout.avoid.some(a => overlaps(r, a)) && !overlaps(r, box);
      // Landscape: the column beside the arena, level with a target on the arena side (a hero card).
      const side = layout.side;
      if (side && box.right <= side.left) {
        const width = Math.min(layout.maxWidth, side.width - 16), h = sized(width), left = side.left - host.left + 8;
        const top = Math.max(side.top - host.top, Math.min(side.bottom - host.top - h, cy - h / 2));
        if (h <= side.height) { put(left, top, width, 'side', left - (box.right - host.left) - 9); return; }
      }
      // The fitting region nearest the target wins (ties keep the given order): a tray tip sits over the focus bar, a card tip in the band.
      const gap = (r: DOMRect) => Math.max(0, r.top - box.bottom, box.top - r.bottom) + Math.max(0, r.left - box.right, box.left - r.right);
      const regions = [...layout.regions, ...(side ? [side] : [])].map((r, i) => ({ r, i, d: gap(r) })).sort((a, b) => a.d - b.d || a.i - b.i).map(x => x.r);
      for (const r of regions) {
        const width = Math.min(layout.maxWidth, r.width - 8, maxX - minX - 16);
        if (width < 120) continue;
        const h = sized(width);
        if (h > r.height) continue;
        const below = box.top >= r.bottom - 1, left = Math.max(r.left - host.left + 4, Math.max(minX + 8, Math.min(Math.min(r.right - host.left, maxX) - width - 4, cx - width / 2)));
        const top = below ? r.bottom - host.top - h - 2 : r.top - host.top + 2;
        if (!free(new DOMRect(left + host.left, top + host.top, width, h))) continue;
        put(left, top, width, below ? 'above' : 'below', below ? box.top - host.top - (top + h) - 9 : top - (box.bottom - host.top) - 9);
        return;
      }
    }
    const width = Math.min(layout?.maxWidth ?? 280, 280, maxX - minX - 16);
    const left = Math.max(minX + 8, Math.min(maxX - width - 8, cx - width / 2));
    const h = sized(width), above = box.top - host.top - h - 14;
    const below = above < minY + 4;
    put(left, below ? box.bottom - host.top + 14 : above, width, below ? 'below' : 'above', 5);
  }
}
