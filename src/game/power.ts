// Party power: one number that sums up levels, gear, talents and jobs, compared against the
// power the balance harness's casual player has when starting each chapter.
import { KITS } from './content';
import { Battle, type Hero } from './simulation';
import type { Profile } from './profile';
import { normalizeStoryParty } from './story-party';

// Party power of the casual scripted player at the start of each chapter (scripts/power-curve.ts prints it).
export const RECOMMENDED_POWER: number[] = [300, 450, 650, 850, 1080, 1200, 1490, 1620, 1870, 2210, 2470, 2690, 3360, 3480, 3590, 3790];

/** A hero's power: 100 for a fresh level-1 hero, growing with offense, toughness and tempo. */
export function heroPower(h: Hero): number {
  const kit = KITS[h.classId];
  const offense = h.gearPower * (h.talents.includes('mastery') ? 1.18 : 1) * (h.talents.includes('mastery-2') ? 1.2 : 1) * (h.job ? 1.12 : 1);
  const defense = h.maxHp / kit.hp * (1 + Math.min(.45, h.perks.reduction + (h.equipment.reduction ?? 0)));
  const tempo = kit.skills[h.stance].cooldown / h.total;
  return Math.round(100 * Math.sqrt(offense * tempo * defense));
}

/** Power of each deployed story hero, in deployment order. */
export function partyPowers(p: Profile): { id: number; power: number }[] {
  const roster = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const b = new Battle('raid', 1, undefined, { roster, loadouts: p.loadouts });
  return b.heroes.map(h => ({ id: h.id, power: heroPower(h) }));
}

export function partyPower(p: Profile): number {
  return partyPowers(p).reduce((sum, h) => sum + h.power, 0);
}

export function recommendedPower(chapter: number): number {
  return RECOMMENDED_POWER[Math.max(0, Math.min(RECOMMENDED_POWER.length - 1, chapter))];
}

/** 'ready' at or above the recommendation, 'close' within 15% below it, otherwise 'under'. */
export function powerVerdict(power: number, recommended: number): 'ready' | 'close' | 'under' {
  return power >= recommended * .97 ? 'ready' : power >= recommended * .85 ? 'close' : 'under';
}
