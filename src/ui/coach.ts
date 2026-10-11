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

/** The tip bubble: a short line with an arrow at the control it is about, and a Skip button. It never blocks drags or taps. */
export class Coach {
  readonly el: HTMLElement;
  step?: CoachStep;
  private target?: () => Element | null;
  private text: HTMLElement;
  constructor(host: HTMLElement, onSkip: () => void) {
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
    this.place();
  }
  hide() { this.step = undefined; this.target = undefined; this.el.hidden = true; }
  /** Sit above the target (below it when there is no room) with the arrow pointing at its centre. */
  place() {
    const target = this.target?.();
    if (this.el.hidden || !target) return;
    const host = this.el.offsetParent?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight), box = target.getBoundingClientRect();
    const width = Math.min(280, host.width - 16), cx = box.left + box.width / 2 - host.left;
    const left = Math.max(8, Math.min(host.width - width - 8, cx - width / 2));
    this.el.style.width = `${width}px`;
    this.el.style.left = `${Math.round(left)}px`;
    const above = box.top - host.top - this.el.offsetHeight - 14;
    const below = above < 4;
    this.el.classList.toggle('below', below);
    this.el.style.top = `${Math.round(below ? box.bottom - host.top + 14 : above)}px`;
    this.el.style.setProperty('--arrow-x', `${Math.round(Math.max(14, Math.min(width - 14, cx - left)))}px`);
  }
}
