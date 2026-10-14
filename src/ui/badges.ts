import { ROSTER } from '../game/content';
import { GEAR, JOBS, gearStats } from '../game/jobs';
import { TALENTS, gearReason, jobReason, talentReason, type Profile } from '../game/profile';
import { QUESTS, questProgress } from '../game/quests';
import { claimableChests } from '../game/journey';
import { DEPTHS, unlockedDepth } from '../game/dungeon';
import { normalizeStoryParty, storyPartyCap } from '../game/story-party';

/** Free story party slots that a benched hero could fill (0 when the party is full or nobody is benched): the camp guide, the
 *  departure prompt and the defeat screen's Deploy fix. */
export function emptySlots(p: Profile) {
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  return Math.min(storyPartyCap(p.cleared) - party.length, p.roster.filter(id => !party.includes(id)).length);
}
const score = (s: ReturnType<typeof gearStats>) => s.power + s.hp + s.tempo;
/** The best piece a hero can equip right now (owned, or affordable) that beats what the slot holds, and its slot: the gear fix opens on it. */
export function affordableUpgrade(p: Profile, id: number): { slot: 'weapon' | 'armor' | 'charm'; gearId: string } | undefined {
  const h = p.loadouts[id];
  if (!h || !ROSTER[id]) return undefined;
  let best: { slot: 'weapon' | 'armor' | 'charm'; gearId: string; gain: number } | undefined;
  for (const slot of ['weapon', 'armor', 'charm'] as const) {
    const now = score(gearStats(h.gear?.[slot] ? { [slot]: h.gear[slot] } : {}, h.refine));
    for (const g of GEAR) {
      if (g.slot !== slot || h.gear?.[slot] === g.id || gearReason(p, id, g.id)) continue;
      const gain = score(gearStats({ [slot]: g.id }, h.inventory?.includes(g.id) ? h.refine : {})) - now;
      if (gain > 1e-9 && (!best || gain > best.gain)) best = { slot, gearId: g.id, gain };
    }
  }
  return best && { slot: best.slot, gearId: best.gearId };
}
/** What a hero could do in the Training Hall right now: learn a talent, take a job, or equip a better piece it can afford (or owns). */
export function heroNeeds(p: Profile, id: number): ('talent' | 'job' | 'gear')[] {
  const h = p.loadouts[id], cls = ROSTER[id]?.classId;
  if (!h || !cls) return [];
  const out: ('talent' | 'job' | 'gear')[] = [];
  if (TALENTS.some(talent => (!talent.classId || talent.classId === cls) && !talentReason(p, id, talent))) out.push('talent');
  // The same rule as the Jobs inspector's Promote button (jobReason), so the dot never promises a job the screen refuses.
  if (Object.values(JOBS).some(j => j.base === cls && !jobReason(p, id, j.id))) out.push('job');
  if (affordableUpgrade(p, id)) out.push('gear');
  return out;
}
/** Deployed heroes with something to do in the Training Hall (the camp badge). */
export const trainingBadge = (p: Profile) => normalizeStoryParty(p.storyActive, p.roster, p.cleared).filter(id => heroNeeds(p, id).length).length;
/** The Undercroft badge: a run waits, or a depth deeper than the best one is open. */
export const dungeonBadge = (p: Profile) => p.journey.run?.status === 'active' || (unlockedDepth(p.cleared, p.journey.depth) > p.journey.depth && p.journey.depth < DEPTHS.length);
/** The MENU badge: quest rewards and star chests waiting to be claimed. */
export const menuBadge = (p: Profile) => QUESTS.filter(q => questProgress(p, q).ready).length + claimableChests(p.journey);
