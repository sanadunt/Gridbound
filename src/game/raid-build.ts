import { KITS, ROSTER, CLASS_IDS, type ClassId } from './content';
import { CAMPAIGN, ENEMIES } from './world';
import { QUESTS } from './quests';

export const RAID_BASIC_JOBS: readonly ClassId[] = Object.freeze([...CLASS_IDS]);
export type RaidSlot = { heroId: number; classId: ClassId; slot?: number };
export type RaidBuild = { slots: RaidSlot[] };

const isBasicJob = (value: unknown): value is ClassId => RAID_BASIC_JOBS.includes(value as ClassId);
const validHeroId = (value: unknown, roster: readonly number[]) => Number.isInteger(value) && roster.includes(value as number) && Boolean(ROSTER[value as number]);
const validSlot = (value: unknown) => value === undefined || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 8);

/** Give every slot without a tile its hero's home tile (ROSTER slot) when free, else the first free tile 0-8; set tiles are kept. */
function placeRaidSlots(slots: readonly { heroId: number; classId: ClassId; slot?: number }[]): RaidSlot[] {
  const used = new Set(slots.flatMap(slot => slot.slot === undefined ? [] : [slot.slot]));
  return slots.map(slot => {
    if (slot.slot !== undefined) return { ...slot };
    const home = ROSTER[slot.heroId].slot, tile = used.has(home) ? [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !used.has(i))! : home;
    used.add(tile);
    return { ...slot, slot: tile };
  });
}

export function createRaidBuild(roster: readonly number[] = [0, 4, 3], partySize = 3): RaidBuild {
  const ids = [...new Set(roster)].filter(id => validHeroId(id, roster));
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 6 || ids.length < partySize) throw new Error('Raid party size must be 1-6 and fit the recruited roster');
  return { slots: placeRaidSlots(ids.slice(0, partySize).map(heroId => ({ heroId, classId: ROSTER[heroId].classId }))) };
}
/** The raid party a Commander starts with: up to three heroes, the Story party first, then the rest of the roster in recruit order. */
export function defaultRaidBuild(p: { roster: readonly number[]; storyActive?: readonly number[] }, partySize = 3): RaidBuild {
  const order = [...new Set([...(p.storyActive ?? []).filter(id => p.roster.includes(id)), ...p.roster])];
  return createRaidBuild(order, Math.max(1, Math.min(partySize, order.length, 6)));
}

export function validRaidBuild(raw: unknown, roster: readonly number[] = ROSTER.map((_, id) => id)): raw is RaidBuild {
  if (!raw || typeof raw !== 'object') return false;
  const build = raw as RaidBuild;
  if (!Array.isArray(build.slots) || build.slots.length < 1 || build.slots.length > 6) return false;
  const ids = new Set<number>();
  const slots = new Set<number>();
  return build.slots.every(slot => {
    if (!slot || typeof slot !== 'object' || !validHeroId(slot.heroId, roster) || ids.has(slot.heroId) || !isBasicJob(slot.classId) || !validSlot(slot.slot)) return false;
    if (slot.slot !== undefined && slots.has(slot.slot)) return false;
    ids.add(slot.heroId);
    if (slot.slot !== undefined) slots.add(slot.slot);
    return true;
  });
}

export function normalizeRaidBuild(raw: unknown, roster: readonly number[] = ROSTER.map((_, id) => id)): RaidBuild | undefined {
  if (!validRaidBuild(raw, roster)) return undefined;
  return { slots: raw.slots.map(slot => ({ heroId: slot.heroId, classId: slot.classId, slot: slot.slot ?? ROSTER[slot.heroId].slot })) };
}

/** Resize the party: the first `partySize` picks stay as they are (hero, class, tile); new slots take unpicked heroes in roster order on a free tile. */
export function setRaidPartySize(build: RaidBuild, partySize: number, roster: readonly number[]): boolean {
  if (!validRaidBuild(build, roster) || !Number.isInteger(partySize) || partySize < 1 || partySize > 6) return false;
  const kept = build.slots.slice(0, partySize);
  const added = [...new Set(roster)].filter(id => validHeroId(id, roster) && !kept.some(slot => slot.heroId === id)).slice(0, partySize - kept.length).map(heroId => ({ heroId, classId: ROSTER[heroId].classId }));
  const next = { slots: placeRaidSlots([...kept, ...added]) };
  if (next.slots.length !== partySize || !validRaidBuild(next, roster)) return false;
  build.slots = next.slots;
  return true;
}

export function setRaidJob(build: RaidBuild, index: number, classId: unknown): boolean {
  if (!validRaidBuild(build) || !Number.isInteger(index) || index < 0 || index >= build.slots.length || !isBasicJob(classId)) return false;
  build.slots[index].classId = classId;
  return true;
}

/** Put another recruited hero into raid slot `index`: the hero must not already be in the build and takes its own class. */
export function setRaidHero(build: RaidBuild, index: number, heroId: unknown, roster: readonly number[]): boolean {
  if (!validRaidBuild(build, roster) || !Number.isInteger(index) || index < 0 || index >= build.slots.length || !validHeroId(heroId, roster)) return false;
  const id = heroId as number;
  if (build.slots.some((slot, i) => i !== index && slot.heroId === id)) return false;
  if (build.slots[index].heroId === id) return true;
  build.slots[index] = { heroId: id, classId: ROSTER[id].classId, slot: build.slots[index].slot };
  return true;
}

export const RAID_QUARRIES: readonly string[] = Object.freeze(Object.values(ENEMIES).filter(enemy => enemy.archetype === enemy.id).map(enemy => enemy.id));
export type RaidProgress = { cleared: readonly number[]; ledger: { enemies: Record<string, number> } };
const firstChapter = (base: string) => CAMPAIGN.findIndex(zone => zone.stages.some(stage => ENEMIES[stage.enemy]?.archetype === base));
const huntChapters = (base: string) => QUESTS.filter(q => q.kind === 'hunt' && q.enemy === base).map(q => q.chapter);
/** Chapters cleared before a quarry opens: its first campaign chapter, or earlier when a hunt quest for it opens first. */
export function raidQuarryUnlockAt(enemyId: string): number {
  const base = ENEMIES[enemyId]?.archetype ?? enemyId, chapter = firstChapter(base);
  return Math.min(chapter < 0 ? CAMPAIGN.length : chapter + 1, ...huntChapters(base));
}
/** A raid quarry is open once beaten anywhere (ledger), its first chapter is cleared, or a hunt quest for it is open. */
export function raidQuarryUnlocked(p: RaidProgress, enemyId: string): boolean {
  const base = ENEMIES[enemyId]?.archetype;
  if (!base || !RAID_QUARRIES.includes(base)) return false;
  return (p.ledger.enemies[base] ?? 0) > 0 || p.cleared.includes(firstChapter(base)) || huntChapters(base).some(chapter => p.cleared.length >= chapter);
}
/** The quarry to show: the preferred one when open, else the first open archetype (undefined on a save with none). */
export function openRaidQuarry(p: RaidProgress, preferred: string): string | undefined {
  return raidQuarryUnlocked(p, preferred) ? preferred : RAID_QUARRIES.find(id => raidQuarryUnlocked(p, id));
}

export function raidJobName(classId: ClassId): string {
  return KITS[classId].name;
}
