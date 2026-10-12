import type { TownTab } from './town';
import { backRoute } from './route-stack';

/**
 * The Back step (navigation contract §7): one decision for every Back input — the HUD Back button, Escape, Backspace, the
 * browser/phone Back (popstate), the ready window's Back and the MENU button on the MENU. DOM-free: main.ts builds the snapshot
 * from its state and performs the action.
 */
export type BackSource = 'button' | 'escape' | 'backspace' | 'history';
export type BattleView = 'arena' | 'hero' | 'log';
export type NavSnapshot = {
  /** The boot step has not settled, or a town navigation / battle transition is still in flight. */
  busy?: boolean;
  /** The title screen covers the town (it is the front door: Back there leaves the page). */
  title?: boolean;
  /** A story scene is playing (chapter intro, join scene, story choice, finale, Journal replay). */
  scene?: boolean;
  modal?: { blocking?: boolean; parent?: boolean } | null;
  /** The skill picker is open, or move mode waits for a tile. */
  picker?: boolean;
  result?: { details?: boolean; locked?: boolean } | null;
  battle?: { status: 'ready' | 'fighting' | 'paused' | 'victory' | 'defeat'; view: BattleView } | null;
  /** The town route on screen and the route stack (ui/route-stack). */
  route?: TownTab;
  stack?: readonly TownTab[];
};
export type BackAction =
  | { kind: 'none'; focus?: boolean }
  | { kind: 'skip-scene' } | { kind: 'modal-parent' } | { kind: 'close-modal' } | { kind: 'close-picker' }
  | { kind: 'close-details' } | { kind: 'result-return' } | { kind: 'arena' } | { kind: 'ready-back' } | { kind: 'pause' } | { kind: 'show-result' }
  | { kind: 'route'; to: TownTab } | { kind: 'title' } | { kind: 'leave' };

/** What one Back step does, top-most layer first (contract §7, rows 0–13). Backspace only ever walks a town route back. */
export function backAction(s: NavSnapshot, source: BackSource): BackAction {
  const action = step(s, source);
  return source === 'backspace' && action.kind !== 'route' ? { kind: 'none' } : action;
}
function step(s: NavSnapshot, source: BackSource): BackAction {
  if (s.modal?.blocking) return { kind: 'none', focus: true };
  if (s.busy || s.result?.locked) return { kind: 'none' };
  if (s.scene) return { kind: 'skip-scene' };
  if (s.modal) return { kind: s.modal.parent ? 'modal-parent' : 'close-modal' };
  if (s.picker) return { kind: 'close-picker' };
  if (s.result) return { kind: s.result.details ? 'close-details' : 'result-return' };
  if (s.battle) {
    if (s.battle.view !== 'arena') return { kind: 'arena' };
    if (s.battle.status === 'ready') return { kind: 'ready-back' };
    if (s.battle.status === 'fighting' || s.battle.status === 'paused') return { kind: 'pause' };
    return { kind: 'show-result' };
  }
  if (s.title) return source === 'history' ? { kind: 'leave' } : { kind: 'none' };
  if (s.route && s.route !== 'camp') return { kind: 'route', to: backRoute(s.stack ?? ['camp', s.route]) };
  return { kind: 'title' };
}

/**
 * The history guard (contract §8) as a pure step: session history is [… previous page, game (base), game (guard)]. The guard is pushed
 * only when it is missing, wanted (anything but the bare title screen) and the page has had a user activation (browsers skip entries a
 * page pushed without one). Popping the guard runs the Back step; a handled step re-arms, a 'leave' (bare title) goes back once more.
 */
export type GuardEvent =
  | { type: 'sync'; want: boolean; activated: boolean }
  | { type: 'pop'; to: 'guard' | 'base' }
  | { type: 'handled'; result: 'handled' | 'leave'; want: boolean; activated: boolean };
export type GuardEffect = 'push' | 'back' | 'onBack' | 'none';
export function guardStep(armed: boolean, event: GuardEvent): { armed: boolean; effect: GuardEffect } {
  if (event.type === 'pop') return event.to === 'guard' ? { armed: true, effect: 'none' } : { armed: false, effect: 'onBack' };
  if (event.type === 'handled' && event.result === 'leave') return { armed: false, effect: 'back' };
  return !armed && event.want && event.activated ? { armed: true, effect: 'push' } : { armed, effect: 'none' };
}
