export const MAX_HERO_LEVEL = 40;
export const LEVEL_THRESHOLDS = [0];
for (let level = 1; level < MAX_HERO_LEVEL; level++) {
  LEVEL_THRESHOLDS.push(LEVEL_THRESHOLDS[level - 1] + 120 + (level - 1) * 40 + (level - 1) ** 2 * 2);
}
export function normalizedXP(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(LEVEL_THRESHOLDS.at(-1)!, Math.floor(value))) : 0;
}
export function heroProgress(xp: unknown = 0) {
  const total = normalizedXP(xp);
  let level = 1;
  while (level < MAX_HERO_LEVEL && total >= LEVEL_THRESHOLDS[level]) level++;
  const current = total - LEVEL_THRESHOLDS[level - 1];
  const needed = level === MAX_HERO_LEVEL ? 0 : LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level - 1];
  return { level, total, current, needed, ratio: needed ? current / needed : 1 };
}
export function xpForLevel(level: number) {
  return LEVEL_THRESHOLDS[Math.max(0, Math.min(MAX_HERO_LEVEL - 1, Math.floor(level) - 1))] ?? 0;
}
export function levelStats(xp: unknown) {
  const n = heroProgress(xp).level - 1;
  return { power: 1 + n * .015, hp: 1 + n * .02 };
}
