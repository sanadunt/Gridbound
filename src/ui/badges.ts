import { ROSTER } from '../game/content';
import { GEAR, JOBS, gearStats } from '../game/jobs';
import { TALENTS, gearReason, talentReason, type Profile } from '../game/profile';
import { QUESTS, questProgress } from '../game/quests';
import { claimableChests } from '../game/journey';
import { DEPTHS, unlockedDepth } from '../game/dungeon';
import { normalizeStoryParty } from '../game/story-party';

const score = (s: ReturnType<typeof gearStats>) => s.power + s.hp + s.tempo;
/** What a hero could do in the Training Hall right now: learn a talent, take a job, or equip a better piece it can afford (or owns). */
export function heroNeeds(p: Profile, id: number): ('talent' | 'job' | 'gear')[] {
  const h = p.loadouts[id], cls = ROSTER[id]?.classId;
  if (!h || !cls) return [];
  const out: ('talent' | 'job' | 'gear')[] = [];
  if (TALENTS.some(talent => (!talent.classId || talent.classId === cls) && !talentReason(p, id, talent))) out.push('talent');
  if (Object.values(JOBS).some(j => j.base === cls && (j.tier === 2 ? !h.job : h.job === j.parent) && p.cleared.length + 1 >= j.level && p.gold >= j.cost)) out.push('job');
  const better = (['weapon', 'armor', 'charm'] as const).some(slot => {
    const now = score(gearStats(h.gear?.[slot] ? { [slot]: h.gear[slot] } : {}, h.refine));
    return GEAR.some(g => g.slot === slot && h.gear?.[slot] !== g.id && !gearReason(p, id, g.id) && score(gearStats({ [slot]: g.id }, h.inventory?.includes(g.id) ? h.refine : {})) > now + 1e-9);
  });
  if (better) out.push('gear');
  return out;
}
/** Deployed heroes with something to do in the Training Hall (the camp badge). */
export const trainingBadge = (p: Profile) => normalizeStoryParty(p.storyActive, p.roster, p.cleared).filter(id => heroNeeds(p, id).length).length;
/** The Undercroft badge: a run waits, or a depth deeper than the best one is open. */
export const dungeonBadge = (p: Profile) => p.journey.run?.status === 'active' || (unlockedDepth(p.cleared, p.journey.depth) > p.journey.depth && p.journey.depth < DEPTHS.length);
/** The MENU badge: quest rewards and star chests waiting to be claimed. */
export const menuBadge = (p: Profile) => QUESTS.filter(q => questProgress(p, q).ready).length + claimableChests(p.journey);
