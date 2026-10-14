import { ROSTER, type Mode } from './content';
import { normalizedXP } from './levels';
import type { Profile } from './profile';
import type { BattleOptions } from './simulation';

/** The largest story party: one of the nine tiles always stays free, so a ground telegraph can still be dodged with a full party. */
export const STORY_PARTY_MAX = 8;
export function storyPartyCap(cleared: readonly number[]): number {
  let chapters = 0;
  while (cleared.includes(chapters)) chapters++;
  // The grid fills up as the story grows: 6 after Act I, then 7 and 8 (saves with nine deployed bench the ninth).
  return chapters >= 9 ? STORY_PARTY_MAX : chapters >= 6 ? 7 : chapters >= 4 ? 6 : chapters >= 3 ? 5 : chapters >= 2 ? 4 : 3;
}

export function normalizeStoryParty(value: unknown, roster: readonly number[], cleared: readonly number[]): number[] {
  const cap = storyPartyCap(cleared);
  const ids = Array.isArray(value) ? [...new Set(value)].filter((id): id is number => Number.isInteger(id) && Boolean(ROSTER[id]) && roster.includes(id)).slice(0, cap) : [];
  return ids.length ? ids : roster.slice(0, cap);
}

/** Tile order for a hero who needs a tile: warriors and monks hold the front row, everyone else starts at the back, then the middle. */
export function roleTiles(classId: string): number[] { return classId === 'warrior' || classId === 'monk' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [6, 7, 8, 3, 4, 5, 0, 1, 2]; }
const validTile = (slot: unknown): slot is number => typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot <= 8;
/** Deployed heroes get unique tiles: earlier heroes keep theirs; a hero whose tile is missing or taken gets its role's first tile that no other deployed hero holds. Benched heroes may share a preferred tile. */
export function placeParty(loadouts: Profile['loadouts'], ids: readonly number[]): void {
  const used = new Set<number>();
  for (const id of ids) {
    const l = loadouts[id], order = roleTiles(ROSTER[id].classId);
    if (!validTile(l.slot) || used.has(l.slot)) l.slot = order.find(i => !used.has(i) && !ids.some(other => other !== id && loadouts[other].slot === i)) ?? order.find(i => !used.has(i)) ?? l.slot;
    used.add(l.slot);
  }
}

/** True while an Undercroft run is under way: its party is locked until the run ends. */
export const storyPartyLocked = (p: Profile) => p.journey?.run?.status === 'active';

export function setStoryParty(p: Profile, ids: number[]): boolean {
  if (storyPartyLocked(p) || !Array.isArray(ids) || !ids.length || ids.length > storyPartyCap(p.cleared) || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || !p.roster.includes(id) || !p.loadouts[id])) return false;
  // Heroes who were already deployed keep their tiles; newly deployed heroes take what is left.
  const before = p.storyActive;
  p.storyActive = [...ids];
  placeParty(p.loadouts, [...ids.filter(id => before.includes(id)), ...ids.filter(id => !before.includes(id))]);
  return true;
}

export function storyBattleOptions(p: Profile): BattleOptions {
  return {
    roster: normalizeStoryParty(p.storyActive, p.roster, p.cleared),
    loadouts: structuredClone(p.loadouts),
    storyCleared: [...p.cleared],
    storyRecruited: [...p.roster],
  };
}

/** Share of a Story victory's EXP every benched hero receives; a hero who trails the party's median gets up to as much again (catch-up), never more than the full EXP. */
export const BENCH_XP = .5;
export function benchExperience(mode: Mode, victoryXP: number, currentXP: number, activeMedianXP: number) {
  if (mode !== 'adventure') return null;
  const base = Number.isFinite(victoryXP) ? Math.max(0, Math.floor(victoryXP * BENCH_XP)) : 0;
  const bonus = Math.min(base, Math.max(0, normalizedXP(activeMedianXP) - normalizedXP(currentXP) - base));
  return { base, bonus, total: base + bonus };
}
