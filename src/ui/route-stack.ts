import type { TownTab } from './town';

/** Routes that replace each other on the stack instead of piling up: the gate's mode tabs (and the chapter dossier) and the two Party screens. */
const GROUP: Partial<Record<TownTab, string>> = { campaign: 'gate', mission: 'gate', dungeon: 'gate', raid: 'gate', endless: 'gate', party: 'party', 'party-advanced': 'party' };
const DEPTH = 8;
/** The stack after opening `tab`: the camp is the root, the MENU is a hub one step above it (Back never replays routes from before the MENU),
 *  a route already on the stack pops back to it, siblings swap, others push. */
export function pushRoute(stack: readonly TownTab[], tab: TownTab): TownTab[] {
  if (tab === 'camp') return ['camp'];
  if (tab === 'more') return ['camp', 'more'];
  const base: TownTab[] = stack[0] === 'camp' ? [...stack] : ['camp', ...stack];
  const at = base.lastIndexOf(tab);
  if (at >= 0) return base.slice(0, at + 1);
  const top = base[base.length - 1];
  // The dossier opened from the map is a step deeper (◀ returns to the map); between gate tabs the newest one replaces them all
  // (map → dossier → Raids leaves just Raids, so ◀ goes where the gate was entered from).
  const deeper = top === 'campaign' && tab === 'mission', group = GROUP[tab];
  const keep = [...base];
  while (!deeper && group !== undefined && keep.length > 1 && GROUP[keep[keep.length - 1]] === group) keep.pop();
  const next = [...keep, tab];
  return next.length > DEPTH ? ['camp', ...next.slice(-(DEPTH - 1))] : next;
}
/** Where the HUD Back leads: the route before the current one (the camp at the bottom). */
export const backRoute = (stack: readonly TownTab[]): TownTab => stack.length > 1 ? stack[stack.length - 2] : 'camp';
