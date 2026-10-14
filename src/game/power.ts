// Party power: one number that sums up levels, gear, talents, jobs and the skill each hero fights with, compared against
// the power the balance harness's casual player has when starting each chapter.
import { KITS, type Skill } from './content';
import { JOBS } from './jobs';
import { Battle, type Hero } from './simulation';
import type { Profile } from './profile';
import { normalizeStoryParty } from './story-party';

// Party power of the casual scripted player at the start of each chapter (scripts/power-curve.ts prints it).
export const RECOMMENDED_POWER: number[] = [305, 473, 716, 1317, 1724, 1909, 2348, 2348, 2536, 3299, 3772, 3933, 4073, 4190, 4322, 4725];

/** Damage a basic skill deals per second at base tempo: the unit that buffs, hastes and delays are converted into. */
const BASE_DPS = 15;
/** What one cast is worth in damage, for a party of `n`: damage kinds by their damage, support kinds by what they give the party. */
export function castValue(s: Skill, n: number, maxHp = 300): number {
  switch (s.kind) {
    case 'curse': case 'turret': return s.power * 6;
    case 'combo': return s.power * 1.25;
    case 'drain': return s.power * 1.5;
    case 'flurry': return s.power * 1.15;
    case 'mark': return s.power + .2 * 4 * BASE_DPS * n;
    case 'weaken': return s.power + 10 * n;
    case 'heal': return s.power + 20 * n;
    case 'regen': return s.power * 6 * n * .7;
    case 'shield': return s.power * Math.max(1, n / 3);
    case 'partyshield': return s.power * n * .8;
    case 'buff': return .5 * 7 * BASE_DPS * n;
    case 'haste': return s.power * BASE_DPS * Math.max(1, n - 1);
    case 'delay': case 'stun': return s.power * 6 * n;
    case 'resolve': return s.power * (3 + .6 * n);
    case 'selfheal': return s.power * maxHp;
    case 'repair': return 40;
    case 'counter': return s.power + 30;
    default: return s.power;
  }
}
const OFFENSIVE = ['attack', 'aoe', 'interrupt', 'mark', 'weaken', 'curse', 'drain', 'sacrifice', 'combo', 'flurry', 'turret', 'steal'];
/** Average gain of a job's effect and perk on a skill (rage and execute only work part of the fight). */
function jobFactor(job: string | undefined, s: Skill): number {
  const j = JOBS[job ?? ''], offensive = OFFENSIVE.includes(s.kind);
  if (!j) return 1;
  let f = 1;
  if (j.effect === 'sanctuary' && (s.kind === 'shield' || s.kind === 'partyshield')) f *= 1.35;
  if (j.effect === 'rage') f *= 1.12;
  if (j.effect === 'execute') f *= 1.14;
  if (j.effect === 'precision' && offensive) f *= 1.2;
  if (j.effect === 'mercy' && (s.kind === 'heal' || s.kind === 'regen')) f *= 1.3;
  if (j.effect === 'elements' && s.kind === 'aoe') f *= 1.3;
  if (j.effect === 'hymn' && s.kind === 'buff') f *= 10 / 7;
  if (j.effect === 'hunter' || (j.effect === 'leech' && offensive)) f *= 1.08;
  if (j.perk?.echo && offensive) f *= 1 + j.perk.echo / 5;
  if (j.perk?.overhealBarrier) f *= 1.1;
  return f;
}

/** Party size the class's first skill is measured at, so a hero's power never falls when the party grows. */
export const REF_PARTY = 3;
/** A hero's power: 100 for a fresh level-1 hero on its first skill in a party of REF_PARTY. Offense is the stance skill's value
 *  per second (job effects included, utility valued for a party of `partySize`) against the class's first skill in a party of
 *  REF_PARTY; defense is effective HP. */
export function heroPower(h: Hero, partySize = REF_PARTY): number {
  const kit = KITS[h.classId], s = kit.skills[h.stance], n = Math.max(1, partySize);
  const offense = castValue(s, n, h.maxHp) * jobFactor(h.job, s) / h.total / (castValue(kit.skills[0], REF_PARTY, kit.hp) / kit.skills[0].cooldown)
    * h.gearPower * (h.talents.includes('mastery') ? 1.18 : 1) * (h.talents.includes('mastery-2') ? 1.2 : 1);
  const defense = h.maxHp / kit.hp / (1 - Math.min(.45, h.perks.reduction + (h.equipment.reduction ?? 0))) / (h.talents.includes('fortitude') ? .9 : 1) * (1 + h.shield / h.maxHp * .5);
  return Math.round(100 * Math.sqrt(offense * defense));
}

/** Power of each deployed story hero, in deployment order. */
export function partyPowers(p: Profile): { id: number; power: number }[] {
  const roster = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const b = new Battle('raid', 1, undefined, { roster, loadouts: p.loadouts });
  return b.heroes.map(h => ({ id: h.id, power: heroPower(h, b.heroes.length) }));
}

export function partyPower(p: Profile): number {
  return partyPowers(p).reduce((sum, h) => sum + h.power, 0);
}

export function recommendedPower(chapter: number): number {
  return RECOMMENDED_POWER[Math.max(0, Math.min(RECOMMENDED_POWER.length - 1, chapter))];
}

/** Heroic replays (heroicScale, one potion) need about this much more power than the Normal chapter's recommendation: the
 *  median, over the chapters, of the power the casual player needed to win half its Heroic attempts (scripts/power-curve.ts). */
export const HEROIC_POWER_FACTOR = 1.25;
export function recommendedHeroicPower(chapter: number): number {
  return Math.round(recommendedPower(chapter) * HEROIC_POWER_FACTOR / 10) * 10;
}

/** 'ready' at or above the recommendation, 'close' within 15% below it, otherwise 'under'. */
export function powerVerdict(power: number, recommended: number): 'ready' | 'close' | 'under' {
  return power >= recommended * .97 ? 'ready' : power >= recommended * .85 ? 'close' : 'under';
}
