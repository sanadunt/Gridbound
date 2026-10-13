/** Suspended runs (Story, Raid, Bell Trials): which saved encounter Depart resumes, and when a Story departure asks first. No DOM. */

export type RunMode = 'story' | 'raid' | 'roguelike';
/** The fields of a Commander document's `encounters[mode]` that these rules read. */
export type SavedEncounter = { runId: string; settled: boolean; played?: boolean; battle: { mode: string; status: string; floor: number; stage: number; stageCount: number; heroic?: boolean; runFinalClear?: boolean; gold?: number } };
export type RunDoc<E extends SavedEncounter = SavedEncounter> = { encounters?: Partial<Record<RunMode, E>>; rogue?: { activeRun?: { runId: string } } };

/** A Bell Trials floor clear whose boon draft is still open: the floor is settled (its rewards are banked) while the run goes on
 *  (its active run is this one, active or suspended). A final clear or a defeat ends the run, and another run's clear is not this one. */
export const draftPending = (doc: RunDoc | undefined, e: SavedEncounter | undefined) =>
  Boolean(e?.settled && e.battle.mode === 'endless' && e.battle.status === 'victory' && !e.battle.runFinalClear && doc?.rogue?.activeRun?.runId === e.runId);

/** A Story departure's start checkpoint that was never fought (a reload or a closed tab at battle 1's ready window, before FIGHT!): nothing was
 *  played or carried (full HP and potions, no gold), so it pins no party and is no paused chapter; Depart builds a fresh battle with the current
 *  party over it. FIGHT! marks the checkpoint `played` (a save from before that flag only loses that unplayed start). */
export const unplayedStart = (e: SavedEncounter) => !e.settled && !e.played && e.battle.stage === 0 && e.battle.status === 'ready';
/** What Depart resumes in `mode`: an unsettled encounter (in Story one that was played), or a Bell Trials floor clear still waiting at its boon draft. */
export function resumableEncounter<E extends SavedEncounter>(doc: RunDoc<E> | undefined, mode: RunMode): E | undefined {
  const e = doc?.encounters?.[mode];
  return e && (mode === 'story' ? !e.settled && !unplayedStart(e) : !e.settled || (mode === 'roguelike' && draftPending(doc, e))) ? e : undefined;
}

/** A Story chapter left mid-way with Save & suspend: `battle` is where it resumes (the next one after a won wave). */
export type PausedStory = { chapter: number; battle: number; total: number; heroic: boolean; won: boolean; gold: number };
/** The paused Story chapter, if any: every played, unsettled Story encounter (Save & suspend, a reload or a closed tab mid-chapter). It resumes with the
 *  party, HP and potions it started with, so the UI names it everywhere a departure could otherwise silently replace it. */
export function pausedStory(doc: RunDoc | undefined): PausedStory | undefined {
  const b = resumableEncounter(doc, 'story')?.battle;
  if (!b || b.mode !== 'adventure') return undefined;
  const won = b.status === 'victory';
  return { chapter: b.floor - 1, battle: b.stage + (won ? 2 : 1), total: b.stageCount, heroic: b.heroic === true, won, gold: b.gold ?? 0 };
}
/** Depart resumes the paused chapter only when it is that chapter at the same difficulty; any other choice asks first. */
export const resumesPaused = (paused: PausedStory, zone: number, heroic: boolean) => paused.chapter === zone && paused.heroic === heroic;
