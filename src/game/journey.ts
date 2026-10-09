// Story-mode progress markers that make the next goal visible: chapter stars and their chests,
// Heroic clears, and the Undercroft (deepest depth beaten plus the run in progress).
import { CAMPAIGN } from './world';
import { normalizeRun, type DungeonRun, type Pouch } from './dungeon';

export type Journey = { stars: Record<number, number>; chests: number; heroic: number[]; depth: number; run?: DungeonRun };

/** Boss-stage time for the third star. */
export const STAR_PAR_SECONDS = 80;
export const STARS_PER_CHEST = 8;
export const MAX_STARS = CAMPAIGN.length * 3;

export function createJourney(): Journey { return { stars: {}, chests: 0, heroic: [], depth: 0 }; }

/** One star for the clear, one for finishing with everyone standing, one for a boss under par. */
export function chapterStars(allStanding: boolean, bossSeconds: number): number {
  return 1 + (allStanding ? 1 : 0) + (bossSeconds <= STAR_PAR_SECONDS ? 1 : 0);
}
export function recordStars(j: Journey, chapter: number, stars: number): boolean {
  const best = j.stars[chapter] ?? 0, value = Math.max(1, Math.min(3, Math.floor(stars)));
  if (value <= best) return false;
  j.stars[chapter] = value;
  return true;
}
export function totalStars(j: Journey): number { return Object.values(j.stars).reduce((sum, n) => sum + n, 0); }
export function claimableChests(j: Journey): number { return Math.max(0, Math.floor(totalStars(j) / STARS_PER_CHEST) - j.chests); }

/** Rewards for the k-th star chest (1-based): gold plus a material that matches the gear tier of that point. */
export function chestReward(k: number): Pouch {
  const material = k <= 2 ? 'ember-shard' : k <= 4 ? 'bell-bronze' : 'frost-glass';
  return { gold: 120 * k, materials: { [material]: 2 } };
}

/** Heroic first-clear reward for chapter index `chapter` (0-based). */
export function heroicReward(chapter: number): Pouch {
  const material = chapter < 4 ? 'ember-shard' : chapter < 10 ? 'bell-bronze' : 'frost-glass';
  return { gold: 150 + chapter * 35, materials: { [material]: 3 } };
}

export function normalizeJourney(raw: unknown, cleared: readonly number[]): Journey {
  const j = createJourney();
  if (!raw || typeof raw !== 'object') return j;
  const r = raw as Partial<Journey>;
  for (const [key, value] of Object.entries(r.stars ?? {})) {
    const chapter = Number(key);
    if (Number.isInteger(chapter) && cleared.includes(chapter) && Number.isInteger(value)) j.stars[chapter] = Math.max(1, Math.min(3, value as number));
  }
  j.chests = Math.max(0, Math.min(Math.floor(totalStars(j) / STARS_PER_CHEST), Number.isInteger(r.chests) ? r.chests! : 0));
  j.heroic = Array.isArray(r.heroic) ? [...new Set(r.heroic.filter(c => Number.isInteger(c) && cleared.includes(c)))].sort((a, b) => a - b) : [];
  j.depth = Number.isInteger(r.depth) ? Math.max(0, Math.min(8, r.depth!)) : 0;
  const run = normalizeRun(r.run);
  if (run) j.run = run;
  return j;
}
