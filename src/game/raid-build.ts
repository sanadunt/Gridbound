import { KITS, ROSTER, type ClassId } from './content';

export const RAID_BASIC_JOBS: readonly ClassId[] = Object.freeze(['warrior', 'rogue', 'archer', 'healer', 'wizard']);
export type RaidSlot = { heroId: number; classId: ClassId; slot?: number };
export type RaidBuild = { slots: RaidSlot[] };

const isBasicJob = (value: unknown): value is ClassId => RAID_BASIC_JOBS.includes(value as ClassId);
const validHeroId = (value: unknown, roster: readonly number[]) => Number.isInteger(value) && roster.includes(value as number) && Boolean(ROSTER[value as number]);
const validSlot = (value: unknown) => value === undefined || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 8);

export function createRaidBuild(roster: readonly number[] = [0, 4, 3], partySize = 3): RaidBuild {
  const ids = [...new Set(roster)].filter(id => validHeroId(id, roster));
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 6 || ids.length < partySize) throw new Error('Raid party size must be 1-6 and fit the recruited roster');
  return { slots: ids.slice(0, partySize).map(heroId => ({ heroId, classId: ROSTER[heroId].classId, slot: ROSTER[heroId].slot })) };
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

export function setRaidPartySize(build: RaidBuild, partySize: number, roster: readonly number[]): boolean {
  if (!validRaidBuild(build, roster) || !Number.isInteger(partySize) || partySize < 1 || partySize > 6 || roster.length < partySize) return false;
  const available = [...new Set(roster)].filter(id => validHeroId(id, roster));
  if (available.length < partySize) return false;
  const next = available.slice(0, partySize).map(heroId => build.slots.find(slot => slot.heroId === heroId) ?? ({ heroId, classId: ROSTER[heroId].classId, slot: ROSTER[heroId].slot }));
  build.slots = next;
  return true;
}

export function setRaidJob(build: RaidBuild, index: number, classId: unknown): boolean {
  if (!validRaidBuild(build) || !Number.isInteger(index) || index < 0 || index >= build.slots.length || !isBasicJob(classId)) return false;
  build.slots[index].classId = classId;
  return true;
}

export function raidJobName(classId: ClassId): string {
  return KITS[classId].name;
}
