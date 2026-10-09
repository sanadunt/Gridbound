import { ROSTER, type Mode } from './content';
import { normalizedXP } from './levels';
import type { Profile } from './profile';
import type { BattleOptions } from './simulation';

export function storyPartyCap(cleared: readonly number[]): number {
  let chapters = 0;
  while (cleared.includes(chapters)) chapters++;
  // The grid fills up as the story grows: 6 after Act I, then 7, 8 and finally all 9 tiles.
  return chapters >= 12 ? 9 : chapters >= 9 ? 8 : chapters >= 6 ? 7 : chapters >= 4 ? 6 : chapters >= 3 ? 5 : chapters >= 2 ? 4 : 3;
}

export function normalizeStoryParty(value: unknown, roster: readonly number[], cleared: readonly number[]): number[] {
  const cap = storyPartyCap(cleared);
  const ids = Array.isArray(value) ? [...new Set(value)].filter((id): id is number => Number.isInteger(id) && Boolean(ROSTER[id]) && roster.includes(id)).slice(0, cap) : [];
  return ids.length ? ids : roster.slice(0, cap);
}

export function setStoryParty(p: Profile, ids: number[]): boolean {
  if (!Array.isArray(ids) || !ids.length || ids.length > storyPartyCap(p.cleared) || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || !p.roster.includes(id) || !p.loadouts[id])) return false;
  p.storyActive = [...ids];
  // Benched heroes may share a preferred tile; give a newly deployed hero the first free one.
  const used = new Set<number>();
  for (const id of ids) { const l = p.loadouts[id]; if (used.has(l.slot)) l.slot = Array.from({ length: 9 }, (_, i) => i).find(i => !used.has(i) && !ids.some(other => other !== id && p.loadouts[other].slot === i)) ?? l.slot; used.add(l.slot); }
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

export function benchExperience(mode: Mode, victoryXP: number, currentXP: number, activeMedianXP: number) {
  if (mode !== 'adventure') return null;
  const base = Number.isFinite(victoryXP) ? Math.max(0, Math.floor(victoryXP * .5)) : 0;
  const bonus = Math.min(base, Math.max(0, normalizedXP(activeMedianXP) - normalizedXP(currentXP) - base));
  return { base, bonus, total: base + bonus };
}
