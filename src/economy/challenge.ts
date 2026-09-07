import { ENEMIES } from '../game/world';
import { creditCurrency, debitCurrency, type CurrencyState } from './currency';

export type RunWallet = { crystal: number };
export type ChallengeShopItem = { id: string; name: string; cost: number; description: string };
export type RaidTier = 'bronze' | 'silver' | 'gold';
export type RaidModifierId = 'RM01' | 'RM02' | 'RM03' | 'RM04' | 'RM05' | 'RM06' | 'RM07' | 'RM08';
export type RaidModifier = Readonly<{
  id: RaidModifierId;
  name: string;
  description: string;
  riskPoints: number;
}>;
export type RaidSandbox = Readonly<{
  hpScale: number;
  damageScale: number;
  intervalScale: number;
}>;
export type RaidContract = Readonly<{
  id: string;
  tier: RaidTier;
  bossId: string;
  riskPoints: number;
  modifiers: readonly RaidModifierId[];
  modifierBonus: number;
  validated: boolean;
  sandbox: boolean;
}>;
export type RaidContractRequest = Partial<Omit<RaidContract, 'modifiers'>> & {
  enemyId?: string;
  modifiers?: unknown;
};

export const CHALLENGE_SHOP: readonly ChallengeShopItem[] = Object.freeze([
  { id: 'run-heal', name: 'Mending Shard', cost: 8, description: 'Restore the party between rooms.' },
  { id: 'run-reroll', name: 'Fate Reroll', cost: 12, description: 'Reroll the next upgrade choices.' },
  { id: 'run-upgrade', name: 'Ember Upgrade', cost: 18, description: 'Increase the current run power.' },
]);
export const BANK_SHOP: readonly ChallengeShopItem[] = Object.freeze([
  { id: 'bank-relic-ward', name: 'Ward Relic', cost: 24, description: 'Unlock a certified Roguelike challenge relic.' },
  { id: 'bank-relic-fate', name: 'Fate Relic', cost: 36, description: 'Unlock a second certified Roguelike relic.' },
]);
export const challengeShopItem = (itemId: string) => CHALLENGE_SHOP.find(item => item.id === itemId) ?? null;
export const bankShopItem = (itemId: string) => BANK_SHOP.find(item => item.id === itemId) ?? null;
export const RAID_TIER_BASE: Record<RaidTier, number> = { bronze: 12, silver: 18, gold: 26 };

const RAID_MODIFIER_ENTRIES: RaidModifier[] = [
  { id: 'RM01', name: 'Fractured Armor', description: 'Barrier efektif −25%.', riskPoints: 1 },
  { id: 'RM02', name: 'Long Night', description: 'Potion limit −1; solo tetap mendapat minimum 1.', riskPoints: 1 },
  { id: 'RM03', name: 'Echo Pulse', description: 'Aftershock telegraphed menyusul ritual.', riskPoints: 2 },
  { id: 'RM04', name: 'Hunting Choir', description: 'Weakest mark menyusul breath.', riskPoints: 2 },
  { id: 'RM05', name: 'Restless Brood', description: 'Extra minion wave pada phase transition.', riskPoints: 1 },
  { id: 'RM06', name: 'Narrow Paths', description: 'Satu tile temporary blocked bergilir.', riskPoints: 1 },
  { id: 'RM07', name: 'Patient Colossus', description: 'Boss HP +20%, windup +10%.', riskPoints: 0 },
  { id: 'RM08', name: 'Last Lantern', description: 'Optional lantern objective mengurangi bonus bila gagal.', riskPoints: 2 },
];
export const RAID_MODIFIERS: readonly RaidModifier[] = Object.freeze(RAID_MODIFIER_ENTRIES.map(modifier => Object.freeze(modifier)));
const modifierById = new Map<RaidModifierId, RaidModifier>(RAID_MODIFIERS.map(modifier => [modifier.id, modifier]));

// Only combinations exercised by the current calibration slice can be rewarded.
// Other authored modifiers remain selectable in Sandbox until their interaction
// has a deterministic counter and a balance review.
const CALIBRATED_MODIFIER_COMBOS: readonly (readonly RaidModifierId[])[] = Object.freeze([
  [], ['RM01'], ['RM02'], ['RM03'], ['RM05'], ['RM06'], ['RM01', 'RM02'],
].map(combo => Object.freeze([...combo] as RaidModifierId[])));
const comboKey = (ids: readonly RaidModifierId[]) => [...ids].sort().join('+');
const calibratedKeys = new Set(CALIBRATED_MODIFIER_COMBOS.map(comboKey));

const own = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isRaidBoss = (id: string) => Boolean(ENEMIES[id]?.archetype === id);
const authoredBossIds = Object.values(ENEMIES).filter(enemy => enemy.archetype === enemy.id && (enemy.tier ?? 1) === 1).map(enemy => enemy.id);
const modifierInput = (value: unknown): { ids: RaidModifierId[]; valid: boolean } => {
  if (!Array.isArray(value) || value.length > 3) return { ids: [], valid: false };
  const ids = value.filter((id): id is RaidModifierId => typeof id === 'string' && modifierById.has(id as RaidModifierId));
  const valid = ids.length === value.length && new Set(ids).size === ids.length;
  return { ids: [...new Set(ids)].sort((a, b) => RAID_MODIFIERS.findIndex(m => m.id === a) - RAID_MODIFIERS.findIndex(m => m.id === b)), valid };
};
const safeTier = (value: unknown): RaidTier => value === 'silver' || value === 'gold' ? value : 'bronze';
const safeRisk = (value: unknown): number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 30 ? value as number : 0;
const copyContract = (contract: RaidContract): RaidContract => Object.freeze({ ...contract, modifiers: Object.freeze([...contract.modifiers]) });

function authoredContractId(bossId: string, tier: RaidTier, modifiers: readonly RaidModifierId[]) {
  return `${bossId}-${tier}${modifiers.length ? `-${modifiers.map(id => id.toLowerCase()).join('-')}` : ''}`;
}
function contractRecordsForBoss(bossId: string): RaidContract[] {
  return (['bronze', 'silver', 'gold'] as const).flatMap(tier => CALIBRATED_MODIFIER_COMBOS.map(modifiers => {
    const modifierRisk = modifiers.reduce((sum, id) => sum + (modifierById.get(id)?.riskPoints ?? 0), 0);
    return Object.freeze({
      id: authoredContractId(bossId, tier, modifiers),
      tier,
      bossId,
      riskPoints: (tier === 'bronze' ? 0 : tier === 'silver' ? 3 : 6) + modifierRisk,
      modifiers: Object.freeze([...modifiers]),
      modifierBonus: modifiers.length * 3,
      validated: true,
      sandbox: false,
    });
  }));
}

/**
 * The rewarded Raid catalogue is authored at build time. UI and save data may
 * select one of these ids, but neither may author a new reward record.
 */
export const RAID_CONTRACTS: readonly RaidContract[] = Object.freeze(authoredBossIds.flatMap(contractRecordsForBoss));
export const AUTHORED_RAID_CONTRACTS = RAID_CONTRACTS;
const authoredById = new Map(RAID_CONTRACTS.map(contract => [contract.id, contract]));

export function getRaidContract(id: string): RaidContract | undefined {
  const record = authoredById.get(id);
  return record ? copyContract(record) : undefined;
}
export const authoredRaidContract = getRaidContract;
export const isAllowlistedRaidBoss = isRaidBoss;
export function isCalibratedRaidModifiers(modifiers: unknown): modifiers is RaidModifierId[] {
  const parsed = modifierInput(modifiers);
  return parsed.valid && calibratedKeys.has(comboKey(parsed.ids));
}
export function normalizeRaidModifiers(modifiers: unknown): RaidModifierId[] {
  return modifierInput(modifiers).ids;
}

/** Resolve the canonical contract for a base boss or one of its authored variants. */
export function getRaidContractForEnemy(enemyId: string, tier: RaidTier = 'bronze', modifiers: unknown = []): RaidContract | undefined {
  const enemy = ENEMIES[enemyId];
  const bossId = enemy?.archetype;
  const parsed = modifierInput(modifiers);
  if (!bossId || !isRaidBoss(bossId) || !parsed.valid || !calibratedKeys.has(comboKey(parsed.ids))) return undefined;
  return getRaidContract(authoredContractId(bossId, tier, parsed.ids));
}

/**
 * Normalize an untrusted request at the mode boundary. An authored id is a
 * capability only when every supplied authored field agrees with the immutable
 * catalogue record. Everything else is practice/sandbox.
 */
export function validateRaidContract(input: RaidContractRequest | unknown): RaidContract {
  const data = own(input);
  const id = typeof data.id === 'string' ? data.id : '';
  const authored = authoredById.get(id);
  const suppliedModifiers = Object.prototype.hasOwnProperty.call(data, 'modifiers') ? modifierInput(data.modifiers) : undefined;
  const modifiersMatch = suppliedModifiers === undefined || (suppliedModifiers.valid && comboKey(suppliedModifiers.ids) === comboKey(authored?.modifiers ?? []));
  if (authored && modifiersMatch && (!Object.prototype.hasOwnProperty.call(data, 'tier') || data.tier === authored.tier) && (!Object.prototype.hasOwnProperty.call(data, 'bossId') || data.bossId === authored.bossId) && (!Object.prototype.hasOwnProperty.call(data, 'riskPoints') || data.riskPoints === authored.riskPoints) && (!Object.prototype.hasOwnProperty.call(data, 'modifierBonus') || data.modifierBonus === authored.modifierBonus) && (!Object.prototype.hasOwnProperty.call(data, 'validated') || data.validated === true) && (!Object.prototype.hasOwnProperty.call(data, 'sandbox') || data.sandbox === false)) {
    return copyContract(authored);
  }

  const requestedBossId = typeof data.bossId === 'string' ? data.bossId : typeof data.enemyId === 'string' ? data.enemyId : 'dragon';
  const requestedEnemy = ENEMIES[requestedBossId];
  const requestedBoss = requestedEnemy?.archetype && isRaidBoss(requestedEnemy.archetype) ? requestedEnemy.archetype : 'dragon';
  const parsed = suppliedModifiers ?? modifierInput(data.modifiers);
  return Object.freeze({
    id: id || 'practice',
    tier: safeTier(data.tier),
    bossId: requestedBoss,
    riskPoints: safeRisk(data.riskPoints),
    modifiers: Object.freeze(parsed.ids),
    modifierBonus: 0,
    validated: false,
    sandbox: true,
  });
}

/** Force a contract into practice mode when raw sliders or an edited import is present. */
export function sandboxRaidContract(input: RaidContract | unknown): RaidContract {
  const contract = validateRaidContract(input);
  return Object.freeze({ ...contract, validated: false, sandbox: true, modifierBonus: 0, modifiers: Object.freeze([...contract.modifiers]) });
}

export function normalizeRaidSandbox(input: unknown): RaidSandbox {
  const data = own(input);
  const scale = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(.5, Math.min(3, value)) : 1;
  return Object.freeze({ hpScale: scale(data.hpScale), damageScale: scale(data.damageScale), intervalScale: scale(data.intervalScale) });
}

/**
 * Re-check the immutable authored record. Do not trust validated, sandbox,
 * reward-like fields, or a boss selected elsewhere in the client.
 */
export function raidReward(contract: RaidContract | unknown, enemyId?: string): number {
  const data = own(contract);
  const authored = typeof data.id === 'string' ? authoredById.get(data.id) : undefined;
  const suppliedModifiers = Object.prototype.hasOwnProperty.call(data, 'modifiers') ? modifierInput(data.modifiers) : { ids: [] as RaidModifierId[], valid: true };
  if (!authored || !suppliedModifiers.valid || comboKey(suppliedModifiers.ids) !== comboKey(authored.modifiers) || data.tier !== authored.tier || data.bossId !== authored.bossId || data.riskPoints !== authored.riskPoints || data.modifierBonus !== authored.modifierBonus || data.validated !== true || data.sandbox !== false) return 0;
  if (enemyId !== undefined && ENEMIES[enemyId]?.archetype !== authored.bossId) return 0;
  const tierBonus = Math.min(.6, .1 * authored.riskPoints);
  return Math.floor(RAID_TIER_BASE[authored.tier] * (1 + tierBonus) + authored.modifierBonus + .5);
}

export function createRunWallet(start = 0): RunWallet {
  return { crystal: Number.isSafeInteger(start) && start >= 0 ? start : 0 };
}
export function creditRun(wallet: RunWallet, amount: number): boolean {
  if (!wallet || !Number.isSafeInteger(wallet.crystal) || wallet.crystal < 0 || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(wallet.crystal + amount)) return false;
  wallet.crystal += amount;
  return true;
}
export const RUN_ROOM_REWARD = 3;
export function creditRunRoom(wallet: RunWallet, amount = RUN_ROOM_REWARD): boolean {
  return creditRun(wallet, amount);
}
export function resetRunWallet(wallet: RunWallet): void {
  if (wallet) wallet.crystal = 0;
}
export const abandonRun = resetRunWallet;
export const defeatRun = resetRunWallet;
export const clearRun = resetRunWallet;

export function buyRunItem(wallet: RunWallet, itemId: string): ChallengeShopItem | null {
  const item = CHALLENGE_SHOP.find(x => x.id === itemId);
  if (!item || !wallet || !Number.isSafeInteger(wallet.crystal) || wallet.crystal < item.cost) return null;
  wallet.crystal -= item.cost;
  return item;
}
export function runShopItems(): readonly ChallengeShopItem[] { return CHALLENGE_SHOP; }
export const runShopAction = buyRunItem;

/** Spend bank Crystal and record the unlock in the same domain operation. */
export function buyBankItem(state: CurrencyState, itemId: string, owned: string[] = []): ChallengeShopItem | null {
  const item = BANK_SHOP.find(x => x.id === itemId);
  if (!item || !Array.isArray(owned) || owned.includes(item.id) || !debitCurrency(state, 'raid', 'crystal', item.cost)) return null;
  owned.push(item.id);
  return item;
}
export const purchaseBankUnlock = buyBankItem;
export function normalizeChallengeUnlocks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(BANK_SHOP.map(item => item.id));
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && ids.has(id)))];
}
export function bankRaidReward(state: CurrencyState, amount: number): boolean {
  return creditCurrency(state, 'raid', 'crystal', amount);
}

export function roguelikeBankReward(act: 1 | 2 | 3, finalClear = false): number {
  const base = act === 1 ? 6 : act === 2 ? 8 : act === 3 ? 12 : 0;
  return base + (base > 0 && finalClear ? 10 : 0);
}
export function bankRoguelikeReward(state: CurrencyState, act: 1 | 2 | 3, finalClear = false): number {
  const amount = roguelikeBankReward(act, finalClear);
  return amount > 0 && creditCurrency(state, 'roguelike', 'crystal', amount) ? amount : 0;
}

/**
 * The current prototype presents one floor per victory. Three floors form the
 * authored three-act run so bank receipts are issued once at floors 3, 6, and
 * 9; later floors remain repeatable practice floors without new act receipts.
 */
export const ROGUELIKE_ACT_CLEAR_FLOORS = [3, 6, 9] as const;
export function roguelikeMilestoneForFloor(floor: number): { act: 1 | 2 | 3; actClear: boolean; finalClear: boolean } {
  const normalized = Number.isSafeInteger(floor) && floor > 0 ? floor : 1;
  const index = ROGUELIKE_ACT_CLEAR_FLOORS.indexOf(normalized as typeof ROGUELIKE_ACT_CLEAR_FLOORS[number]);
  const act = (index >= 0 ? index + 1 : Math.min(3, Math.floor((normalized - 1) / 3) + 1)) as 1 | 2 | 3;
  return { act, actClear: index >= 0, finalClear: index === ROGUELIKE_ACT_CLEAR_FLOORS.length - 1 };
}
