import { getRaidContractForEnemy, normalizeRaidSandbox, normalizeRaidModifiers, type RaidContract, type RaidSandbox } from '../economy/challenge';
import { createProfile, normalizeProfile, type Loadout, type Profile } from './profile';
import { createRaidBuild, normalizeRaidBuild, validRaidBuild, type RaidBuild } from './raid-build';
import { createRogueBuild, normalizeRogueBuild, validRogueBuild, type RogueBuild } from './roguelike-build';

import type { Battle } from './simulation';
export const COMMANDER_SCHEMA = 4;
export const COMMANDER_RULESET = 'r1-d6-minimal';
export const COMMANDER_DB_NAME = 'gridbound.commanders.r1';
export const COMMANDER_DB_VERSION = 1;
export const MAX_COMMANDERS = 3;
export const SLOT_IDS = Object.freeze(['manual-1', 'manual-2', 'manual-3', 'auto'] as const);
export type SlotId = typeof SLOT_IDS[number];
export type CommanderMode = 'story' | 'roguelike' | 'raid';
export type ChallengeMode = Exclude<CommanderMode, 'story'>;
export type SlotStatus = 'empty' | 'valid' | 'active-checkpoint' | 'terminal-replay' | 'dirty-unsaved';
export type RunStatus = 'active' | 'suspended' | 'finished' | 'defeat' | 'abandoned';

export type StoredStoryState = {
  encounter?: NonNullable<CommanderDocument['encounters']>['story'];
  ledger: Profile['ledger'];
  wins: number;
  receipts: string[];
  gold: number;
  materials: Record<string, number>;
  roster: number[];
  storyActive: number[];
  cleared: number[];
  narrative?: Record<string,string>;
  claimedQuests: string[];
  trackedQuest?: string;
  loadouts: Record<number, Loadout>;
  sound: boolean;
  motion: boolean;
};

export type RunCheckpoint = {
  runId: string;
  mode: ChallengeMode;
  status: RunStatus;
  rewardEligible: boolean;
  floor: number;
  stage: number;
  seed: number;
  purse: number;
  boons: string[];
  checkpointSeq: number;
  encounterStart: true;
  startedAt: number;
  savedAt: number;
  rogueBuild?: RogueBuild;
  raidBuild?: RaidBuild;
  raidContract?: RaidContract;
  raidSandbox?: RaidSandbox;
};

export type StoredRogueState = {
  build: RogueBuild;
  bestFloor: number;
  runBookmark?: RunCheckpoint;
};

export type StoredRaidState = {
  build?: RaidBuild;
  contract?: RaidContract;
  sandbox?: RaidSandbox;
  runBookmark?: RunCheckpoint;
};

export type SlotRecord<T> = {
  slotId: SlotId;
  state?: T;
  savedAt: number;
  status: SlotStatus;
};

export type SharedCommanderState = {
  bankCrystal: number;
  challengeUnlocks: string[];
  settlementReceipts: string[];
  ledger: Profile['ledger'];
  wins: number;
};

export type StoryModeState = {
  activeSlot: SlotId;
  slots: SlotRecord<StoredStoryState>[];
};

export type RogueModeState = {
  activeSlot: SlotId;
  slots: SlotRecord<StoredRogueState>[];
  activeRun?: RunCheckpoint;
  lastRun?: RunCheckpoint;
};

export type RaidModeState = {
  activeSlot: SlotId;
  slots: SlotRecord<StoredRaidState>[];
  activeRun?: RunCheckpoint;
  lastRun?: RunCheckpoint;
};

export type CommanderDocument = {
  schema: typeof COMMANDER_SCHEMA;
  rulesetId: typeof COMMANDER_RULESET;
  contentVersion: string;
  commanderId: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastPlayed: number;
  activeMode: CommanderMode;
  revision: number;
  shared: SharedCommanderState;
  encounters?: Partial<Record<CommanderMode, { runId: string; seq: number; battle: ReturnType<Battle['checkpoint']>; purse: number; boons: string[]; seed: number; settled: boolean }>>;
  legacySource?: string;
  story: StoryModeState;
  rogue: RogueModeState;
  raid: RaidModeState;
};

export type RuntimeCommanderContext = {
  mode: CommanderMode;
  slotId: SlotId;
  profile: Profile;
  rogueBuild?: RogueBuild;
  raidBuild?: RaidBuild;
  raidContract?: RaidContract;
  raidSandbox?: RaidSandbox;
  runState?: {
    activeRun?: RunCheckpoint;
    lastRun?: RunCheckpoint;
  };
};

export class StaleCommanderError extends Error {
  constructor(message = 'Commander save is stale; refresh before writing.') {
    super(message);
    this.name = 'StaleCommanderError';
  }
}

export class IncompatibleCommanderError extends Error {
  constructor(message = 'Commander save format is not compatible with this build.') {
    super(message);
    this.name = 'IncompatibleCommanderError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const safeInt = (value: unknown, fallback: number, max: number) => typeof value === 'number' && Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : fallback;
const safeFiniteInt = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isSafeInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
const clone = <T>(value: T): T => structuredClone(value);
const now = () => Date.now();
const modeState = (document: CommanderDocument, mode: CommanderMode): StoryModeState | RogueModeState | RaidModeState => mode === 'story' ? document.story : mode === 'roguelike' ? document.rogue : document.raid;
const emptySlot = <T>(slotId: SlotId): SlotRecord<T> => ({ slotId, savedAt: 0, status: 'empty' });
const blankSlots = <T>() => SLOT_IDS.map(slotId => emptySlot<T>(slotId));
const slotRecord = <T>(slots: SlotRecord<T>[], slotId: SlotId) => slots.find(slot => slot.slotId === slotId);
const slotHasState = <T>(slot: SlotRecord<T> | undefined): slot is SlotRecord<T> & { state: T } => Boolean(slot?.state);

function safeName(value: unknown, fallback = 'Commander'): string {
  if (typeof value !== 'string') return fallback;
  const name = value.trim().slice(0, 32);
  return name || fallback;
}

function commanderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `commander-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMaterials(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [id, amount] of Object.entries(value)) {
    if (/^[a-z0-9-]{1,64}$/.test(id) && typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0) result[id] = Math.min(1_000_000, amount);
  }
  return result;
}

export function storyStateFromProfile(profile: Profile): StoredStoryState {
  return {
    ledger: clone(profile.ledger), wins: profile.wins, receipts: [...profile.settlementReceipts],
    gold: Math.max(0, Math.min(1_000_000, Math.floor(profile.gold))),
    materials: normalizeMaterials(profile.economy.materials),
    roster: [...profile.roster],
    storyActive: [...profile.storyActive],
    cleared: [...profile.cleared],
    narrative: clone(profile.narrative ?? {}),
    claimedQuests: [...profile.claimedQuests],
    ...(profile.trackedQuest ? { trackedQuest: profile.trackedQuest } : {}),
    loadouts: clone(profile.loadouts),
    sound: profile.sound,
    motion: profile.motion,
  };
}

function profileFromStoryState(raw: StoredStoryState | undefined): Profile {
  const fallback = createProfile();
  if (!raw) return fallback;
  const normalized = normalizeProfile({
    ...fallback,
    version: 3,
    gold: raw.gold,
    economy: { gold: raw.gold, commanderCrystal: 0, materials: raw.materials },
    roster: raw.roster,
    storyActive: raw.storyActive,
    cleared: raw.cleared,
    narrative: raw.narrative,
    claimedQuests: raw.claimedQuests,
    trackedQuest: raw.trackedQuest,
    loadouts: raw.loadouts,
    sound: raw.sound,
    motion: raw.motion,
    bestFloor: 0,
    wins: raw.wins ?? 0,
    settlementReceipts: raw.receipts ?? [],
    challengeUnlocks: [],
    ledger: raw.ledger ?? { raids: 0, victories: 0, enemies: {} },
  });
  return normalized;
}

function sharedFromProfile(profile: Profile): SharedCommanderState {
  return {
    bankCrystal: Math.max(0, Math.min(1_000_000_000, Math.floor(profile.economy.commanderCrystal))),
    challengeUnlocks: [...new Set(profile.challengeUnlocks)],
    settlementReceipts: [...new Set(profile.settlementReceipts)],
    ledger: clone(profile.ledger),
    wins: Math.max(0, Math.min(1_000_000, Math.floor(profile.wins))),
  };
}

function applyShared(profile: Profile, shared: SharedCommanderState): void {
  profile.economy.commanderCrystal = shared.bankCrystal;
  profile.challengeUnlocks = [...shared.challengeUnlocks];
  profile.settlementReceipts = [...shared.settlementReceipts];
  profile.ledger = clone(shared.ledger);
  profile.wins = shared.wins;
}

function defaultRaidBuild(profile: Profile): RaidBuild | undefined {
  if (profile.roster.length < 1) return undefined;
  try {
    return createRaidBuild(profile.roster, Math.min(3, profile.roster.length, 6));
  } catch {
    return undefined;
  }
}

export function createCommanderDocument(profile = createProfile(), name = 'Commander 1'): CommanderDocument {
  const timestamp = now();
  const story = storyStateFromProfile(profile);
  const rogueAuto: StoredRogueState = { build: createRogueBuild(), bestFloor: profile.bestFloor };
  const raidBuild = defaultRaidBuild(profile);
  const raidAuto: StoredRaidState = raidBuild ? { build: raidBuild } : {};
  const storySlots = blankSlots<StoredStoryState>();
  const rogueSlots = blankSlots<StoredRogueState>();
  const raidSlots = blankSlots<StoredRaidState>();
  storySlots[3] = { slotId: 'auto', state: story, savedAt: timestamp, status: 'valid' };
  rogueSlots[3] = { slotId: 'auto', state: rogueAuto, savedAt: timestamp, status: 'valid' };
  raidSlots[3] = { slotId: 'auto', state: raidAuto, savedAt: timestamp, status: 'valid' };
  return {
    schema: COMMANDER_SCHEMA,
    rulesetId: COMMANDER_RULESET,
    contentVersion: '0.4.0',
    commanderId: commanderId(),
    name: safeName(name, 'Commander 1'),
    avatar: 'bellkeeper',
    createdAt: timestamp,
    lastPlayed: timestamp,
    activeMode: 'story',
    revision: 0,
    shared: sharedFromProfile(profile),
    story: { activeSlot: 'auto', slots: storySlots },
    rogue: { activeSlot: 'auto', slots: rogueSlots },
    raid: { activeSlot: 'auto', slots: raidSlots },
  };
}

function normalizeStoryState(raw: unknown): StoredStoryState | undefined {
  if (!isRecord(raw)) return undefined;
  const source = {
    ledger: raw.ledger, wins: raw.wins, receipts: raw.receipts,
    gold: raw.gold,
    materials: normalizeMaterials(raw.materials),
    roster: Array.isArray(raw.roster) ? raw.roster : [],
    storyActive: Array.isArray(raw.storyActive) ? raw.storyActive : [],
    cleared: Array.isArray(raw.cleared) ? raw.cleared : [],
    claimedQuests: Array.isArray(raw.claimedQuests) ? raw.claimedQuests : [],
    trackedQuest: raw.trackedQuest,
    loadouts: isRecord(raw.loadouts) ? raw.loadouts : {},
    sound: raw.sound,
    motion: raw.motion,
  };
  const normalized = profileFromStoryState(source as StoredStoryState);
  return { ...storyStateFromProfile(normalized), ...(isRecord(raw.encounter) ? { encounter: clone(raw.encounter) as StoredStoryState['encounter'] } : {}) };
}

function normalizeRun(raw: unknown): RunCheckpoint | undefined {
  if (!isRecord(raw) || typeof raw.runId !== 'string' || raw.runId.length < 1 || raw.runId.length > 160) return undefined;
  if (raw.mode !== 'roguelike' && raw.mode !== 'raid') return undefined;
  const status = raw.status;
  if (status !== 'active' && status !== 'suspended' && status !== 'finished' && status !== 'defeat' && status !== 'abandoned') return undefined;
  if (raw.encounterStart !== true) return undefined;
  const floor = safeFiniteInt(raw.floor, 1, 1, 100);
  const stage = safeFiniteInt(raw.stage, 0, 0, 100);
  const seed = safeFiniteInt(raw.seed, 271828, 0, Number.MAX_SAFE_INTEGER);
  const purse = safeInt(raw.purse, 0, 1_000_000);
  const boons = Array.isArray(raw.boons) ? [...new Set(raw.boons.filter((id): id is string => typeof id === 'string' && id.length <= 80))] : [];
  const checkpointSeq = safeFiniteInt(raw.checkpointSeq, 0, 0, 1_000_000);
  const startedAt = safeInt(raw.startedAt, now(), Number.MAX_SAFE_INTEGER);
  const savedAt = safeInt(raw.savedAt, startedAt, Number.MAX_SAFE_INTEGER);
  const result: RunCheckpoint = {
    runId: raw.runId,
    mode: raw.mode,
    status,
    rewardEligible: raw.rewardEligible === true && (status === 'active' || status === 'suspended'),
    floor,
    stage,
    seed,
    purse,
    boons,
    checkpointSeq,
    encounterStart: true,
    startedAt,
    savedAt,
  };
  if (raw.mode === 'roguelike') {
    if (raw.rogueBuild !== undefined && !validRogueBuild(raw.rogueBuild)) return undefined;
    if (raw.rogueBuild !== undefined) result.rogueBuild = normalizeRogueBuild(raw.rogueBuild);
  } else {
    if (raw.raidBuild !== undefined && !validRaidBuild(raw.raidBuild)) return undefined;
    if (raw.raidBuild !== undefined) result.raidBuild = normalizeRaidBuild(raw.raidBuild);
    if (raw.raidContract !== undefined && !isRecord(raw.raidContract)) return undefined;
    if (raw.raidContract !== undefined) {
      const bossId = typeof raw.raidContract.bossId === 'string' ? raw.raidContract.bossId : 'dragon';
      const tier = raw.raidContract.tier === 'silver' || raw.raidContract.tier === 'gold' ? raw.raidContract.tier : 'bronze';
      const modifiers = normalizeRaidModifiers(raw.raidContract.modifiers);
      result.raidContract = getRaidContractForEnemy(bossId, tier, modifiers) ?? undefined;
    }
    if (raw.raidSandbox !== undefined) result.raidSandbox = normalizeRaidSandbox(raw.raidSandbox);
  }
  return result;
}

function normalizeShared(raw: unknown): SharedCommanderState {
  const data = isRecord(raw) ? raw : {};
  const ledgerData = isRecord(data.ledger) ? data.ledger : {};
  const enemyData = isRecord(ledgerData.enemies) ? ledgerData.enemies : {};
  const enemies: Record<string, number> = {};
  for (const [id, amount] of Object.entries(enemyData)) if (typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0) enemies[id] = Math.min(1_000_000, amount);
  return {
    bankCrystal: safeInt(data.bankCrystal, 0, 1_000_000_000),
    challengeUnlocks: Array.isArray(data.challengeUnlocks) ? [...new Set(data.challengeUnlocks.filter((id): id is string => typeof id === 'string' && id.length <= 100))] : [],
    settlementReceipts: Array.isArray(data.settlementReceipts) ? [...new Set(data.settlementReceipts.filter((id): id is string => typeof id === 'string' && id.length <= 200))] : [],
    ledger: {
      raids: safeInt(ledgerData.raids, 0, 1_000_000),
      victories: safeInt(ledgerData.victories, 0, 1_000_000),
      enemies,
    },
    wins: safeInt(data.wins, 0, 1_000_000),
  };
}

function normalizeStorySlots(raw: unknown): StoryModeState {
  const data = isRecord(raw) ? raw : {};
  const slots = blankSlots<StoredStoryState>();
  if (Array.isArray(data.slots)) {
    for (const candidate of data.slots) {
      if (!isRecord(candidate) || !SLOT_IDS.includes(candidate.slotId as SlotId)) continue;
      const state = normalizeStoryState(candidate.state);
      const index = SLOT_IDS.indexOf(candidate.slotId as SlotId);
      slots[index] = {
        slotId: candidate.slotId as SlotId,
        ...(state ? { state } : {}),
        savedAt: safeInt(candidate.savedAt, 0, Number.MAX_SAFE_INTEGER),
        status: state ? 'valid' : 'empty',
      };
    }
  }
  const activeSlot = SLOT_IDS.includes(data.activeSlot as SlotId) ? data.activeSlot as SlotId : 'auto';
  return { activeSlot, slots };
}

function normalizeRogueSlots(raw: unknown): RogueModeState {
  const data = isRecord(raw) ? raw : {};
  const slots = blankSlots<StoredRogueState>();
  if (Array.isArray(data.slots)) {
    for (const candidate of data.slots) {
      if (!isRecord(candidate) || !SLOT_IDS.includes(candidate.slotId as SlotId)) continue;
      const stateData = isRecord(candidate.state) ? candidate.state : undefined;
      const build = stateData?.build && validRogueBuild(stateData.build) ? normalizeRogueBuild(stateData.build) : undefined;
      const state = build ? { build, bestFloor: safeInt(stateData?.bestFloor, 0, 100), ...(normalizeRun(stateData?.runBookmark) ? { runBookmark: normalizeRun(stateData?.runBookmark) } : {}) } : undefined;
      const index = SLOT_IDS.indexOf(candidate.slotId as SlotId);
      slots[index] = { slotId: candidate.slotId as SlotId, ...(state ? { state } : {}), savedAt: safeInt(candidate.savedAt, 0, Number.MAX_SAFE_INTEGER), status: state ? 'valid' : 'empty' };
    }
  }
  return {
    activeSlot: SLOT_IDS.includes(data.activeSlot as SlotId) ? data.activeSlot as SlotId : 'auto',
    slots,
    ...(normalizeRun(data.activeRun)?.mode === 'roguelike' ? { activeRun: normalizeRun(data.activeRun) } : {}),
    ...(normalizeRun(data.lastRun)?.mode === 'roguelike' ? { lastRun: normalizeRun(data.lastRun) } : {}),
  };
}

function normalizeRaidSlots(raw: unknown): RaidModeState {
  const data = isRecord(raw) ? raw : {};
  const slots = blankSlots<StoredRaidState>();
  if (Array.isArray(data.slots)) {
    for (const candidate of data.slots) {
      if (!isRecord(candidate) || !SLOT_IDS.includes(candidate.slotId as SlotId)) continue;
      const stateData = isRecord(candidate.state) ? candidate.state : undefined;
      const build = stateData?.build && validRaidBuild(stateData.build) ? normalizeRaidBuild(stateData.build) : undefined;
      const contract = stateData?.contract && isRecord(stateData.contract) ? getRaidContractForEnemy(typeof stateData.contract.bossId === 'string' ? stateData.contract.bossId : 'dragon', stateData.contract.tier === 'silver' || stateData.contract.tier === 'gold' ? stateData.contract.tier : 'bronze', stateData.contract.modifiers) : undefined;
      const state = build || contract || stateData?.sandbox ? { ...(build ? { build } : {}), ...(contract ? { contract } : {}), ...(stateData?.sandbox ? { sandbox: normalizeRaidSandbox(stateData.sandbox) } : {}), ...(normalizeRun(stateData?.runBookmark) ? { runBookmark: normalizeRun(stateData?.runBookmark) } : {}) } : undefined;
      const index = SLOT_IDS.indexOf(candidate.slotId as SlotId);
      slots[index] = { slotId: candidate.slotId as SlotId, ...(state ? { state } : {}), savedAt: safeInt(candidate.savedAt, 0, Number.MAX_SAFE_INTEGER), status: state ? 'valid' : 'empty' };
    }
  }
  return {
    activeSlot: SLOT_IDS.includes(data.activeSlot as SlotId) ? data.activeSlot as SlotId : 'auto',
    slots,
    ...(normalizeRun(data.activeRun)?.mode === 'raid' ? { activeRun: normalizeRun(data.activeRun) } : {}),
    ...(normalizeRun(data.lastRun)?.mode === 'raid' ? { lastRun: normalizeRun(data.lastRun) } : {}),
  };
}

export function normalizeCommanderDocument(raw: unknown): CommanderDocument | undefined {
  if (!isRecord(raw) || raw.schema !== COMMANDER_SCHEMA || raw.rulesetId !== COMMANDER_RULESET || typeof raw.commanderId !== 'string' || raw.commanderId.length < 1 || raw.commanderId.length > 100) return undefined;
  if (!isRecord(raw.shared) || !isRecord(raw.story) || !isRecord(raw.rogue) || !isRecord(raw.raid)) return undefined;
  if (JSON.stringify(raw).length > 10 * 1024 * 1024) return undefined;
  const allowed = new Set(['schema','rulesetId','contentVersion','commanderId','name','avatar','createdAt','lastPlayed','activeMode','revision','shared','story','rogue','raid','encounters','legacySource']);
  if (Object.keys(raw).some(key => !allowed.has(key))) return undefined;
  for (const mode of [raw.story,raw.rogue,raw.raid]) {
    if (!Array.isArray(mode.slots) || mode.slots.length !== 4 || new Set(mode.slots.map(slot => isRecord(slot) ? slot.slotId : '')).size !== 4) return undefined;
    if (mode.slots.some(slot => !isRecord(slot) || !SLOT_IDS.includes(slot.slotId as SlotId))) return undefined;
  }
  if (raw.encounters !== undefined) {
    if (!isRecord(raw.encounters)) return undefined;
    for (const [mode, checkpoint] of Object.entries(raw.encounters)) {
      if (!['story','raid','roguelike'].includes(mode) || !isRecord(checkpoint) || !isRecord(checkpoint.battle)) return undefined;
      const battle = checkpoint.battle;
      if (!['ready','victory','defeat'].includes(String(battle.status)) || !Array.isArray(battle.heroes) || battle.heroes.length < 1 || battle.heroes.length > 9) return undefined;
      if (battle.mode !== (mode === 'story' ? 'adventure' : mode === 'roguelike' ? 'endless' : 'raid') || typeof checkpoint.runId !== 'string' || typeof checkpoint.settled !== 'boolean') return undefined;
      if (Object.keys(battle).some(key => ['__proto__','constructor','prototype','tick','restoreCheckpoint','checkpoint'].includes(key))) return undefined;
    }
  }
  if (raw.activeMode !== 'story' && raw.activeMode !== 'roguelike' && raw.activeMode !== 'raid') return undefined;
  const story = normalizeStorySlots(raw.story);
  const rogue = normalizeRogueSlots(raw.rogue);
  const raid = normalizeRaidSlots(raw.raid);
  return {
    schema: COMMANDER_SCHEMA,
    rulesetId: COMMANDER_RULESET,
    contentVersion: typeof raw.contentVersion === 'string' ? raw.contentVersion.slice(0, 40) : '0.4.0',
    commanderId: raw.commanderId,
    name: safeName(raw.name),
    avatar: typeof raw.avatar === 'string' ? raw.avatar.slice(0, 40) : 'bellkeeper',
    createdAt: safeInt(raw.createdAt, now(), Number.MAX_SAFE_INTEGER),
    lastPlayed: safeInt(raw.lastPlayed, now(), Number.MAX_SAFE_INTEGER),
    activeMode: raw.activeMode,
    revision: safeInt(raw.revision, 0, 1_000_000_000),
    shared: normalizeShared(raw.shared),
    ...(isRecord(raw.encounters) ? { encounters: clone(raw.encounters) as CommanderDocument['encounters'] } : {}),
    ...(typeof raw.legacySource === 'string' ? { legacySource: raw.legacySource } : {}),
    story,
    rogue,
    raid,
  };
}

function normalizeSlotStatus<T>(slot: SlotRecord<T>, active: boolean, terminal: boolean): SlotStatus {
  if (!slot.state) return 'empty';
  if (active) return 'active-checkpoint';
  if (terminal) return 'terminal-replay';
  return 'valid';
}

function writeSlot<T>(slots: SlotRecord<T>[], slotId: SlotId, state: T, savedAt: number, active: boolean, terminal: boolean): void {
  const index = SLOT_IDS.indexOf(slotId);
  slots[index] = { slotId, state: clone(state), savedAt, status: normalizeSlotStatus({ slotId, state, savedAt, status: 'valid' }, active, terminal) };
}

export function activeRunFor(document: CommanderDocument, mode: ChallengeMode): RunCheckpoint | undefined {
  const state = mode === 'roguelike' ? document.rogue : document.raid;
  return state.activeRun ? clone(state.activeRun) : undefined;
}

export function lastRunFor(document: CommanderDocument, mode: ChallengeMode): RunCheckpoint | undefined {
  const state = mode === 'roguelike' ? document.rogue : document.raid;
  return state.lastRun ? clone(state.lastRun) : undefined;
}

export function materializeProfile(document: CommanderDocument, mode: CommanderMode, slotId?: SlotId): Profile {
  const selectedSlot = slotId ?? (mode === 'story' ? document.story.activeSlot : mode === 'roguelike' ? document.rogue.activeSlot : document.raid.activeSlot);
  const storySlot = slotRecord(document.story.slots, mode === 'story' ? selectedSlot : document.story.activeSlot);
  const story = slotHasState(storySlot) ? storySlot.state : slotHasState(slotRecord(document.story.slots, 'auto')) ? slotRecord(document.story.slots, 'auto')!.state : undefined;
  const profile = profileFromStoryState(story);
  if (mode === 'story') return profile;
  applyShared(profile, document.shared);
  profile.narrative = {};
  profile.gold = 0;
  profile.economy.gold = 0;
  if (mode === 'roguelike') {
    const slot = slotRecord(document.rogue.slots, selectedSlot);
    const state = slotHasState(slot) ? slot.state : slotHasState(slotRecord(document.rogue.slots, 'auto')) ? slotRecord(document.rogue.slots, 'auto')!.state : undefined;
    profile.bestFloor = state?.bestFloor ?? 0;
  }
  return profile;
}

export function storedStateFor(document: CommanderDocument, mode: CommanderMode, slotId?: SlotId) {
  const slots = mode === 'story' ? document.story.slots : mode === 'roguelike' ? document.rogue.slots : document.raid.slots;
  const activeSlot = mode === 'story' ? document.story.activeSlot : mode === 'roguelike' ? document.rogue.activeSlot : document.raid.activeSlot;
  const slot = slots.find(candidate => candidate.slotId === (slotId ?? activeSlot));
  return slot?.state ? clone(slot.state) : undefined;
}

export function applyRuntimeToDocument(document: CommanderDocument, context: RuntimeCommanderContext, timestamp = now()): void {
  document.activeMode = context.mode;
  document.lastPlayed = timestamp;
  if (context.mode !== 'story') document.shared = sharedFromProfile(context.profile);
  if (context.mode === 'story') {
    const state = storyStateFromProfile(context.profile);
    if (document.encounters?.story) state.encounter = clone(document.encounters.story);
    writeSlot(document.story.slots, 'auto', state, timestamp, false, false);
    writeSlot(document.story.slots, context.slotId, state, timestamp, false, false);
    document.story.activeSlot = context.slotId;
    return;
  }
  if (context.mode === 'roguelike') {
    const state: StoredRogueState = {
      build: context.rogueBuild && validRogueBuild(context.rogueBuild) ? normalizeRogueBuild(context.rogueBuild) : createRogueBuild(),
      bestFloor: Math.max(0, Math.min(100, Math.floor(context.profile.bestFloor))),
      ...((context.runState?.activeRun ?? document.rogue.activeRun ?? document.rogue.lastRun) ? { runBookmark: clone((context.runState?.activeRun ?? document.rogue.activeRun ?? document.rogue.lastRun)!) } : {}),
    };
    writeSlot(document.rogue.slots, 'auto', state, timestamp, Boolean(context.runState?.activeRun), Boolean(context.runState?.lastRun));
    writeSlot(document.rogue.slots, context.slotId, state, timestamp, Boolean(context.runState?.activeRun), Boolean(context.runState?.lastRun));
    document.rogue.activeSlot = context.slotId;
    if (context.runState) {
      document.rogue.activeRun = context.runState.activeRun ? clone(context.runState.activeRun) : undefined;
      document.rogue.lastRun = context.runState.lastRun ? clone(context.runState.lastRun) : document.rogue.lastRun;
    }
    return;
  }
  const state: StoredRaidState = {
    ...(context.raidBuild && validRaidBuild(context.raidBuild) ? { build: normalizeRaidBuild(context.raidBuild) } : {}),
    ...(context.raidContract ? { contract: clone(context.raidContract) } : {}),
    ...(context.raidSandbox ? { sandbox: normalizeRaidSandbox(context.raidSandbox) } : {}),
    ...((context.runState?.activeRun ?? document.raid.activeRun ?? document.raid.lastRun) ? { runBookmark: clone((context.runState?.activeRun ?? document.raid.activeRun ?? document.raid.lastRun)!) } : {}),
  };
  writeSlot(document.raid.slots, 'auto', state, timestamp, Boolean(context.runState?.activeRun), Boolean(context.runState?.lastRun));
  writeSlot(document.raid.slots, context.slotId, state, timestamp, Boolean(context.runState?.activeRun), Boolean(context.runState?.lastRun));
  document.raid.activeSlot = context.slotId;
  if (context.runState) {
    document.raid.activeRun = context.runState.activeRun ? clone(context.runState.activeRun) : undefined;
    document.raid.lastRun = context.runState.lastRun ? clone(context.runState.lastRun) : document.raid.lastRun;
  }
}

export function createRunCheckpoint(mode: ChallengeMode, input: Partial<RunCheckpoint> & Pick<RunCheckpoint, 'runId' | 'floor' | 'seed'>): RunCheckpoint {
  const timestamp = now();
  const base: RunCheckpoint = {
    runId: input.runId,
    mode,
    status: 'active',
    rewardEligible: true,
    floor: Math.max(1, Math.min(100, Math.floor(input.floor))),
    stage: Math.max(0, Math.min(100, Math.floor(input.stage ?? 0))),
    seed: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(input.seed))),
    purse: Math.max(0, Math.min(1_000_000, Math.floor(input.purse ?? 0))),
    boons: [...new Set(input.boons ?? [])].filter(id => typeof id === 'string').slice(0, 100),
    checkpointSeq: Math.max(0, Math.min(1_000_000, Math.floor(input.checkpointSeq ?? 0))),
    encounterStart: true,
    startedAt: input.startedAt ?? timestamp,
    savedAt: timestamp,
  };
  if (mode === 'roguelike' && input.rogueBuild && validRogueBuild(input.rogueBuild)) base.rogueBuild = normalizeRogueBuild(input.rogueBuild);
  if (mode === 'raid') {
    if (input.raidBuild && validRaidBuild(input.raidBuild)) base.raidBuild = normalizeRaidBuild(input.raidBuild);
    if (input.raidContract) base.raidContract = clone(input.raidContract);
    if (input.raidSandbox) base.raidSandbox = normalizeRaidSandbox(input.raidSandbox);
  }
  return base;
}

export function suspendRun(run: RunCheckpoint, purse: number, boons: readonly string[], floor = run.floor, stage = run.stage): RunCheckpoint {
  return { ...clone(run), status: 'suspended', rewardEligible: run.rewardEligible, floor, stage, purse: Math.max(0, Math.min(1_000_000, Math.floor(purse))), boons: [...new Set(boons)].slice(0, 100), checkpointSeq: run.checkpointSeq + 1, encounterStart: true, savedAt: now() };
}

export function terminalRun(run: RunCheckpoint, status: Extract<RunStatus, 'finished' | 'defeat' | 'abandoned'>): RunCheckpoint {
  return { ...clone(run), status, rewardEligible: false, checkpointSeq: run.checkpointSeq + 1, encounterStart: true, savedAt: now() };
}

export type CommanderRepositoryListener = (event: { commanderId: string; revision: number }) => void;

export class CommanderRepository {
  readonly persistent: boolean;
  readonly warning: string;
  private readonly database?: IDBDatabase;
  private readonly memory = new Map<string, CommanderDocument>();
  private readonly listeners = new Set<CommanderRepositoryListener>();
  private readonly channel?: BroadcastChannel;

  constructor(database?: IDBDatabase, warning = '') {
    this.database = database;
    this.persistent = Boolean(database);
    this.warning = warning;
    if (database && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('gridbound.commanders.r1');
      this.channel.addEventListener('message', event => {
        const data = isRecord(event.data) ? event.data : {};
        if (typeof data.commanderId === 'string' && typeof data.revision === 'number') for (const listener of this.listeners) listener({ commanderId: data.commanderId, revision: data.revision });
      });
    }
  }

  subscribe(listener: CommanderRepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async list(): Promise<CommanderDocument[]> {
    const raw = this.database ? await this.readAll() : [...this.memory.values()].map(clone);
    const documents: CommanderDocument[] = [];
    for (const value of raw) {
      const document = normalizeCommanderDocument(value);
      if (!document) throw new IncompatibleCommanderError();
      documents.push(document);
    }
    return documents.slice(0, MAX_COMMANDERS);
  }

  async commit(document: CommanderDocument, expectedRevision?: number): Promise<CommanderDocument> {
    const proposed = clone(document);
    if (!normalizeCommanderDocument(proposed)) throw new IncompatibleCommanderError();
    if (this.database) {
      const committed = await this.commitIndexedDb(proposed, expectedRevision);
      this.broadcast(committed);
      return committed;
    }
    const existing = this.memory.get(proposed.commanderId);
    if (!existing && this.memory.size >= MAX_COMMANDERS) throw new Error('All three Commander profiles are occupied.');
    if (existing && expectedRevision !== existing.revision) throw new StaleCommanderError();
    if (!existing && expectedRevision !== undefined) throw new StaleCommanderError();
    const committed = { ...proposed, revision: (existing?.revision ?? 0) + 1 };
    const normalized = normalizeCommanderDocument(committed);
    if (!normalized) throw new IncompatibleCommanderError();
    this.memory.set(normalized.commanderId, clone(normalized));
    this.broadcast(normalized);
    return clone(normalized);
  }

  async remove(commanderId: string, expectedRevision: number): Promise<void> {
    if (this.database) {
      await this.removeIndexedDb(commanderId, expectedRevision);
    } else {
      const existing = this.memory.get(commanderId);
      if (!existing || existing.revision !== expectedRevision) throw new StaleCommanderError();
      this.memory.delete(commanderId);
    }
    this.broadcast({ commanderId, revision: expectedRevision + 1 });
  }

  close(): void {
    this.channel?.close();
    this.database?.close();
  }

  private broadcast(document: Pick<CommanderDocument, 'commanderId' | 'revision'>): void {
    try { this.channel?.postMessage({ commanderId: document.commanderId, revision: document.revision }); } catch { /* The transaction is already committed; revision checks remain authoritative. */ }
  }

  private readAll(): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction('documents', 'readonly');
      const request = transaction.objectStore('documents').getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error ?? new Error('Unable to read Commander saves.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to read Commander saves.'));
    });
  }

  private commitIndexedDb(document: CommanderDocument, expectedRevision?: number): Promise<CommanderDocument> {
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      let committed: CommanderDocument | undefined;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction.abort(); } catch { /* transaction may already be complete */ }
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const request = store.get(document.commanderId);
      request.onsuccess = () => {
        const existingRaw = request.result as unknown;
        const existing = existingRaw === undefined ? undefined : normalizeCommanderDocument(existingRaw);
        if (existingRaw !== undefined && !existing) return fail(new IncompatibleCommanderError());
        if (existing && expectedRevision !== existing.revision) return fail(new StaleCommanderError());
        if (!existing && expectedRevision !== undefined) return fail(new StaleCommanderError());
        committed = { ...document, revision: (existing?.revision ?? 0) + 1 };
        const count = store.count();
        count.onsuccess = () => {
          if (!existing && count.result >= MAX_COMMANDERS) return fail(new Error('All three Commander profiles are occupied.'));
          try { store.put(committed!); } catch (error) { fail(error); }
        };
      };
      request.onerror = () => fail(request.error ?? new Error('Unable to read Commander revision.'));
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(clone(committed!));
      };
      transaction.onerror = () => fail(transaction.error ?? new Error('Commander transaction failed.'));
      transaction.onabort = () => { if (!settled) fail(transaction.error ?? new Error('Commander transaction aborted.')); };
    });
  }

  private removeIndexedDb(commanderId: string, expectedRevision: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction.abort(); } catch { /* transaction may already be complete */ }
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const request = store.get(commanderId);
      request.onsuccess = () => {
        const existing = normalizeCommanderDocument(request.result);
        if (!existing || existing.revision !== expectedRevision) return fail(new StaleCommanderError());
        store.delete(commanderId);
      };
      request.onerror = () => fail(request.error ?? new Error('Unable to read Commander revision.'));
      transaction.oncomplete = () => { if (!settled) { settled = true; resolve(); } };
      transaction.onerror = () => fail(transaction.error ?? new Error('Commander delete failed.'));
      transaction.onabort = () => { if (!settled) fail(transaction.error ?? new Error('Commander delete aborted.')); };
    });
  }
}

export async function openCommanderRepository(): Promise<CommanderRepository> {
  if (typeof indexedDB === 'undefined') return new CommanderRepository(undefined, 'IndexedDB tidak tersedia. Mode session-only aktif; progress tidak bertahan setelah tab ditutup.');
  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(COMMANDER_DB_NAME, COMMANDER_DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('documents')) request.result.createObjectStore('documents', { keyPath: 'commanderId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
    });
    return new CommanderRepository(database);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'storage error';
    return new CommanderRepository(undefined, `Penyimpanan Commander gagal (${detail}). Mode session-only aktif; jangan anggap autosave permanen.`);
  }
}

export function modeLabel(mode: CommanderMode): string {
  return mode === 'story' ? 'Story' : mode === 'roguelike' ? 'Roguelike' : 'Raid';
}

export function modeRun(document: CommanderDocument, mode: ChallengeMode): RunCheckpoint | undefined {
  return activeRunFor(document, mode);
}

export function slotForMode(document: CommanderDocument, mode: CommanderMode, slotId: SlotId): SlotRecord<StoredStoryState | StoredRogueState | StoredRaidState> | undefined {
  return (modeState(document, mode).slots as unknown as SlotRecord<StoredStoryState | StoredRogueState | StoredRaidState>[]).find(slot => slot.slotId === slotId);
}

export function copyLegacyToCommander(source: Profile, name: string): CommanderDocument {
  const copy = createCommanderDocument(source, name);
  copy.shared = sharedFromProfile(createProfile());
  return copy;
}
