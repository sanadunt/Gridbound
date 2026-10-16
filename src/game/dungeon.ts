// The Undercroft: an optional story dungeon beneath Emberhollow's bell tower. Each run is a seeded
// map of rooms (battles, elites, events, treasure, a camp row, a guardian). The story party keeps its
// HP between rooms; gold and materials go into a pouch that is only kept by extracting or by beating
// the guardian. Pure logic only: text lives in the i18n tables under `dungeon.*`.
import { CAMPAIGN, ENEMIES } from './world';
import { storyBattleOptions, STORY_PARTY_MAX } from './story-party';
import type { Profile } from './profile';
import type { BattleOptions } from './simulation';

export type DungeonNodeKind = 'battle' | 'elite' | 'event' | 'treasure' | 'camp' | 'guardian';
export type DungeonNode = { id: number; row: number; col: number; kind: DungeonNodeKind; next: number[]; enemy?: string; event?: string; done?: boolean };
export type Pouch = { gold: number; materials: Record<string, number> };
export type DungeonRun = {
  depth: number; seed: number; rng: number; nodes: DungeonNode[]; at: number; visited: number[];
  party: number[]; hp: Record<number, number>; potions: number; pouch: Pouch;
  blessing: { power: number; vitality: number };
  status: 'active' | 'cleared' | 'extracted' | 'wiped';
  /** Map generator version the run was drawn with (older saves keep their layout after an update). */
  layout: number;
  /** `started`: the fight began and has no result yet; a reload resolves it as a flee (`interruptFight`). `seen`: the
   *  fight's last saved state (HP ratios, potions left), so a reload never costs less than fleeing at that moment.
   *  `hiddenAt`: when the page went to the background during the fight (a wall-clock ms stamp the UI writes, never read by a Battle);
   *  a later load that finds it old enough treats the cut as the OS closing the game, not a flee (`interruptFight(run, true)`). */
  pendingFight?: { kind: 'battle' | 'elite' | 'guardian'; enemy: string; started?: boolean; seen?: FightState; hiddenAt?: number };
};
export type FightState = { hp: Record<number, number>; potions: number };
export type DepthDef = { id: number; unlock: number; enemies: string[]; elite: string[]; guardian: string; material: string };

export const MATERIALS = ['ember-shard', 'bell-bronze', 'frost-glass'] as const;
export type MaterialId = typeof MATERIALS[number];
// Depth N opens once chapter `unlock` is cleared and fights at that chapter's difficulty. Elites come from the
// depth's biome and its neighbours; the first one is the only elite of layout-1 maps.
export const DEPTHS: DepthDef[] = [
  { id: 1, unlock: 1, enemies: ['wolf', 'goblin', 'spider'], elite: ['shaman', 'golem'], guardian: 'treant', material: 'ember-shard' },
  { id: 2, unlock: 3, enemies: ['shaman', 'moth', 'goblin'], elite: ['golem', 'treant', 'wolf-ash'], guardian: 'wraith', material: 'ember-shard' },
  { id: 3, unlock: 5, enemies: ['basilisk', 'harpy', 'spider-ash'], elite: ['revenant', 'golem-ash', 'wraith'], guardian: 'hydra', material: 'bell-bronze' },
  { id: 4, unlock: 7, enemies: ['revenant', 'goblin-ash', 'moth-ash'], elite: ['lich', 'wolf-ash', 'spider-ash'], guardian: 'knight', material: 'bell-bronze' },
  { id: 5, unlock: 9, enemies: ['wolf-frost', 'harpy-frost', 'basilisk-frost'], elite: ['knight-frost', 'golem-ash', 'hydra-frost'], guardian: 'colossus', material: 'frost-glass' },
  { id: 6, unlock: 11, enemies: ['treant-frost', 'moth-frost', 'crab-frost'], elite: ['lich-frost', 'revenant-frost', 'colossus-frost'], guardian: 'hydra-frost', material: 'frost-glass' },
  { id: 7, unlock: 13, enemies: ['choir', 'knight-auric', 'harpy-auric'], elite: ['lich-auric', 'golem-auric', 'colossus-frost'], guardian: 'choir-auric', material: 'frost-glass' },
  { id: 8, unlock: 15, enemies: ['basilisk-auric', 'revenant-auric', 'colossus-auric'], elite: ['hydra-auric', 'wraith-auric', 'choir-frost'], guardian: 'dragon-auric', material: 'frost-glass' },
];
/** Current map generator: layout 2 has more events in rows 2-4, several elites per depth and no repeat foe on adjacent rows. */
export const MAP_VERSION = 2;
export const DUNGEON_ROWS = 7;
export const CAMP_ROW = 5;
/** HP a 'leave' choice restores; the party's share of a flee; the wound an interrupted (reloaded) fight leaves. */
export const LEAVE_HEAL = .05, FLEE_KEEP = .5, INTERRUPT_WOUND = .25;
/** The camp's rest heals this share of max HP and wakes the fallen at CAMP_REVIVE: a little short of a full recovery, so the HP
 *  a party brings to the guardian still depends on the rooms before it. */
export const CAMP_REST = .25, CAMP_REVIVE = .25;

/** Event ids and the choices each offers; outcomes are resolved by `chooseEvent`. */
export const DUNGEON_EVENTS: Record<string, string[]> = {
  shrine: ['pray', 'offering', 'leave'],
  archive: ['search', 'leave'],
  lantern: ['guide', 'keep'],
  merchant: ['buy', 'leave'],
  bell: ['ring', 'muffle'],
  well: ['drink', 'coin'],
  letters: ['read', 'burn'],
  forge: ['temper', 'leave'],
  echo: ['answer', 'silence'],
  cradle: ['rock', 'leave'],
};
/** Gold an event choice takes from the pouch. An unaffordable choice is refused and leaves the room open. */
export const EVENT_COST: Record<string, number> = { 'merchant:buy': 60, 'well:coin': 20 };
/** The fixed effects of event choices (shares of max HP / run blessings). chooseEvent applies them and the choice texts
 *  show them as {heal}/{hurt}/{power}/{vitality} (plus {gold} from EVENT_COST), so a text never claims a stale number. */
export const EVENT_EFFECTS: Record<string, { heal?: number; hurt?: number; power?: number; vitality?: number }> = {
  'shrine:pray': { heal: .3 }, 'shrine:offering': { hurt: .12 }, 'lantern:keep': { power: .08 }, 'bell:ring': { vitality: .08, hurt: .08 }, 'bell:muffle': { heal: .12 },
  'well:drink': { heal: .35, hurt: .1 }, 'well:coin': { power: .05 }, 'letters:read': { heal: .1 }, 'forge:temper': { hurt: .1 }, 'echo:silence': { heal: .15 }, 'cradle:rock': { vitality: .05, hurt: .05 },
};
/** Letters from the cast found by lore choices: a seeded pick from the depth's pool (text: `dungeon.letter.<id>`). */
export const DUNGEON_LETTERS: string[][] = DEPTHS.map(d => ['a', 'b', 'c'].map(x => `${d.id}${x}`));

function next(run: { rng: number }) { run.rng = (Math.imul(1664525, run.rng) + 1013904223) >>> 0; return run.rng / 4294967296; }
const pick = <T>(run: { rng: number }, list: readonly T[]) => list[Math.floor(next(run) * list.length)];

export function depthDef(depth: number): DepthDef { return DEPTHS[Math.max(0, Math.min(DEPTHS.length - 1, depth - 1))]; }
/** Deepest depth the player may enter: depth N needs chapter `unlock` cleared and depth N-1 beaten (depth 1 only needs the chapter). */
export function unlockedDepth(cleared: readonly number[], best: number): number {
  let depth = 0;
  for (const d of DEPTHS) if (cleared.includes(d.unlock - 1) && d.id <= best + 1) depth = d.id;
  return depth;
}

export function generateMap(depth: number, seed: number, layout = MAP_VERSION): DungeonNode[] {
  const def = depthDef(depth), run = { rng: (seed ^ (depth * 2654435761)) >>> 0 }, nodes: DungeonNode[] = [], legacy = layout < 2;
  for (let row = 0; row < DUNGEON_ROWS; row++) {
    const width = row === DUNGEON_ROWS - 1 ? 1 : row === 0 ? 3 : row === CAMP_ROW ? 2 : next(run) < .5 ? 3 : 4;
    const treasureAt = row === 3 ? Math.floor(next(run) * width) : -1;
    for (let col = 0; col < width; col++) {
      let kind: DungeonNodeKind;
      if (row === DUNGEON_ROWS - 1) kind = 'guardian';
      else if (row === CAMP_ROW) kind = 'camp';
      else if (row === 0) kind = 'battle';
      else if (col === treasureAt) kind = 'treasure';
      else { const r = next(run), [battle, event] = !legacy && row >= 2 && row <= 4 ? [.4, .72] : [.46, .74]; kind = r < battle ? 'battle' : r < event ? 'event' : r < .9 ? 'elite' : 'treasure'; }
      const node: DungeonNode = { id: nodes.length, row, col, kind, next: [] };
      if (kind === 'battle') node.enemy = pick(run, def.enemies);
      if (kind === 'elite') node.enemy = pick(run, legacy ? def.elite.slice(0, 1) : def.elite);
      if (kind === 'guardian') node.enemy = def.guardian;
      if (kind === 'event') node.event = pick(run, Object.keys(DUNGEON_EVENTS));
      nodes.push(node);
    }
  }
  // Link each room to the nearest one or two rooms in the next row; every room stays reachable.
  const rowOf = (row: number) => nodes.filter(n => n.row === row);
  const x = (n: DungeonNode) => (n.col + .5) / rowOf(n.row).length;
  for (let row = 0; row < DUNGEON_ROWS - 1; row++) {
    const below = rowOf(row + 1);
    for (const n of rowOf(row)) {
      const sorted = [...below].sort((a, b) => Math.abs(x(a) - x(n)) - Math.abs(x(b) - x(n)));
      n.next.push(sorted[0].id);
      if (sorted[1] && next(run) < .55) n.next.push(sorted[1].id);
    }
    for (const b of below) if (!rowOf(row).some(n => n.next.includes(b.id))) {
      const nearest = [...rowOf(row)].sort((a, c) => Math.abs(x(a) - x(b)) - Math.abs(x(c) - x(b)))[0];
      nearest.next.push(b.id);
    }
    for (const n of rowOf(row)) n.next.sort((a, b) => a - b);
  }
  // A room never repeats the foe of a room it is reached from: take the next one in the depth's list (no extra draws).
  if (!legacy) for (const n of nodes) if (n.enemy && (n.kind === 'battle' || n.kind === 'elite')) {
    const pool = n.kind === 'battle' ? def.enemies : def.elite, taken = new Set(nodes.filter(m => m.kind === n.kind && m.next.includes(n.id)).map(m => m.enemy));
    if (taken.has(n.enemy)) n.enemy = Array.from({ length: pool.length }, (_, k) => pool[(pool.indexOf(n.enemy!) + k) % pool.length]).find(id => !taken.has(id)) ?? n.enemy;
  }
  return nodes;
}

export function startRun(depth: number, seed: number, party: number[]): DungeonRun {
  const nodes = generateMap(depth, seed);
  return { depth, seed, rng: (seed * 31 + depth) >>> 0, nodes, at: -1, visited: [], party: [...party], hp: Object.fromEntries(party.map(id => [id, 1])), potions: 2, pouch: { gold: 0, materials: {} }, blessing: { power: 1, vitality: 1 }, status: 'active', layout: MAP_VERSION };
}

export function reachable(run: DungeonRun): number[] {
  if (run.status !== 'active' || run.pendingFight) return [];
  if (run.at < 0) return run.nodes.filter(n => n.row === 0).map(n => n.id);
  return roomSettled(run) ? run.nodes[run.at]?.next ?? [] : [];
}

/** Move into a room. Battles, elites and the guardian set `pendingFight`; other rooms wait for a choice. */
export function enterNode(run: DungeonRun, id: number): DungeonNode | undefined {
  if (!reachable(run).includes(id)) return undefined;
  const node = run.nodes[id];
  run.at = id; run.visited.push(id);
  if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'guardian') run.pendingFight = { kind: node.kind, enemy: node.enemy! };
  return node;
}

/** Enemy HP and damage multipliers for a dungeon fight at this depth. */
// Rooms carry the unlock chapter's HP curve times DUNGEON_HP (HP carries over, so attrition is the challenge); their damage is
// the depth's own DEPTH_DMG (in CHAPTER_DMG units) times the kind of fight's FIGHT_DMG.
export const DUNGEON_HP = 1.45;
// Enemy damage of each depth, never falling with depth: fitted with `DUNGEON=1 npm run calibrate` so the balance harness's casual
// player (right after the depth's unlock chapter, careful and greedy routes) wipes in about one run in five, most often at the
// guardian. Depth 8 alone wants less than depth 7, so the pair shares the value that keeps depth 8 near a quarter (depth 7 ~10%).
export const DEPTH_DMG = [4.1, 8.4, 8.7, 8.7, 10.5, 10.5, 11.7, 11.7];
/** The guardian's HP as a share of its chapter boss's stage HP. */
export const GUARDIAN_HP = 1.1;
/** Damage factor of each kind of fight. */
export const FIGHT_DMG: Record<'battle' | 'elite' | 'guardian', number> = { battle: 1.1, elite: 1.3, guardian: 1.2 };

export function fightScale(run: DungeonRun, kind: 'battle' | 'elite' | 'guardian') {
  const chapter = depthDef(run.depth).unlock, stages = CAMPAIGN[chapter - 1].stages;
  const base = kind === 'guardian' ? stages.at(-1)!.hp * GUARDIAN_HP : kind === 'elite' ? stages.at(-2)!.hp : stages[1].hp;
  return { chapter, hp: base * DUNGEON_HP, damage: DEPTH_DMG[run.depth - 1] * FIGHT_DMG[kind] };
}

export function dungeonXP(run: DungeonRun, kind: 'battle' | 'elite' | 'guardian') {
  const chapter = depthDef(run.depth).unlock;
  return Math.round((60 + 25 * chapter) * (kind === 'elite' ? 1.5 : kind === 'guardian' ? 2.5 : 1));
}

/** Battle options for the pending fight: the run's own party (recruited heroes only, whatever the story party is now)
 *  with its carried HP, potions and blessings. */
export function dungeonBattleOptions(p: Profile, run: DungeonRun): BattleOptions | undefined {
  const fight = run.pendingFight;
  if (!fight || run.status !== 'active') return undefined;
  const scale = fightScale(run, fight.kind);
  return { ...storyBattleOptions(p), roster: run.party.filter(id => p.roster.includes(id)), enemyId: fight.enemy, dungeon: { chapter: scale.chapter, hp: scale.hp, damage: scale.damage, xp: dungeonXP(run, fight.kind), startHp: { ...run.hp }, potions: run.potions, power: run.blessing.power, vitality: run.blessing.vitality } };
}

const addMaterial = (pouch: Pouch, id: string, amount: number) => { if (amount > 0) pouch.materials[id] = (pouch.materials[id] ?? 0) + amount; };
// Only heroes who fought (a finite ratio in `hp`) are updated: a missing id keeps its carried HP instead of falling.
const carryHp = (run: DungeonRun, hp: Record<number, number>, potions: number) => {
  for (const id of run.party) if (typeof hp[id] === 'number' && Number.isFinite(hp[id])) run.hp[id] = Math.max(0, Math.min(1, hp[id]));
  run.potions = Math.max(0, Math.min(3, Number.isFinite(potions) ? Math.floor(potions) : run.potions));
};

/** Record the result of the pending fight. `hp` is each party hero's HP ratio after the battle. */
export function resolveFight(run: DungeonRun, won: boolean, hp: Record<number, number>, potions: number): { gold: number; materials: Record<string, number> } | undefined {
  const fight = run.pendingFight;
  if (!fight || run.status !== 'active') return undefined;
  delete run.pendingFight;
  carryHp(run, hp, potions);
  if (!won) { run.status = 'wiped'; run.pouch = { gold: 0, materials: {} }; return undefined; }
  run.nodes[run.at].done = true;
  const chapter = depthDef(run.depth).unlock, material = depthDef(run.depth).material;
  const gold = Math.round((14 + chapter * 5) * (fight.kind === 'elite' ? 2 : fight.kind === 'guardian' ? 4 : 1));
  const materials: Record<string, number> = {};
  if (fight.kind === 'elite') materials[material] = 1;
  if (fight.kind === 'guardian') { materials[material] = 3; if (run.depth >= 3) materials['ember-shard'] = (materials['ember-shard'] ?? 0) + 1; }
  if (fight.kind === 'battle' && next(run) < .3) materials[material] = 1;
  run.pouch.gold += gold;
  for (const [id, amount] of Object.entries(materials)) addMaterial(run.pouch, id, amount);
  if (fight.kind === 'guardian') run.status = 'cleared';
  return { gold, materials };
}

/** Flee the pending fight: wounds and potions used are kept, the room stays uncleared (the fight waits there) and
 *  half of the pouch, rounded against the party, stays behind. Returns what was lost. */
export function fleeFight(run: DungeonRun, hp: Record<number, number>, potions: number): Pouch | undefined {
  const fight = run.pendingFight;
  if (!fight || run.status !== 'active') return undefined;
  carryHp(run, hp, potions);
  run.pendingFight = { kind: fight.kind, enemy: fight.enemy };
  const lost: Pouch = { gold: run.pouch.gold - Math.floor(run.pouch.gold * FLEE_KEEP), materials: {} };
  run.pouch.gold -= lost.gold;
  for (const [id, n] of Object.entries(run.pouch.materials)) { const keep = Math.floor(n * FLEE_KEEP); if (n - keep > 0) lost.materials[id] = n - keep; if (keep > 0) run.pouch.materials[id] = keep; else delete run.pouch.materials[id]; }
  return lost;
}

/** Note the state of the fight in progress (saved on every fall, potion and every few seconds): an interrupted fight
 *  costs at least this much. False when no fight is in progress. */
export function noteFight(run: DungeonRun, hp: Record<number, number>, potions: number): boolean {
  if (!run.pendingFight?.started || run.status !== 'active') return false;
  run.pendingFight.seen = { hp: Object.fromEntries(run.party.filter(id => Number.isFinite(hp[id])).map(id => [id, Math.max(0, Math.min(1, hp[id]))])), potions: Math.max(0, Math.min(run.potions, Math.floor(potions))) };
  return true;
}

/** A fight that began but never got a result (the page was closed or reloaded) is a flee. Each hero ends at the worse
 *  of its last noted HP (a hero who fell stays down) and a flat wound that never fells a standing hero; potions used
 *  by then stay used. `background`: the game was closed while it sat in the background (the OS discarded the tab), not
 *  by the player: each hero keeps its noted HP (the run's HP when nothing was noted) with no extra wound, potions as
 *  noted, the pouch untouched, and the fight waits in the room. It returns an empty pouch (nothing was lost). */
export function interruptFight(run: DungeonRun, background = false): Pouch | undefined {
  const fight = run.pendingFight;
  if (!fight?.started) return undefined;
  const seen = fight.seen;
  if (background) {
    carryHp(run, Object.fromEntries(run.party.map(id => [id, seen?.hp[id] ?? run.hp[id]])), Math.min(run.potions, seen?.potions ?? run.potions));
    run.pendingFight = { kind: fight.kind, enemy: fight.enemy };
    return { gold: 0, materials: {} };
  }
  const wound = (id: number) => run.hp[id] > 0 ? Math.max(.05, run.hp[id] - INTERRUPT_WOUND) : 0;
  return fleeFight(run, Object.fromEntries(run.party.map(id => [id, Math.min(wound(id), seen?.hp[id] ?? 1)])), Math.min(run.potions, seen?.potions ?? run.potions));
}

/** `lore` is a letter id from `DUNGEON_LETTERS`. */
export type Outcome = { gold?: number; materials?: Record<string, number>; heal?: number; hurt?: number; power?: number; vitality?: number; potion?: number; fight?: boolean; lore?: string };

/** Why an event choice cannot be taken right now: the gold it needs, or 'potions' when the potion belt is full. */
export function choiceNeed(run: DungeonRun, event: string, choice: string): number | 'potions' | undefined {
  const cost = EVENT_COST[`${event}:${choice}`] ?? 0;
  if (cost > run.pouch.gold) return cost;
  if (event === 'merchant' && choice === 'buy' && run.potions >= 3) return 'potions';
  return undefined;
}
const letter = (run: DungeonRun) => pick(run, DUNGEON_LETTERS[depthDef(run.depth).id - 1]);

/** Resolve an event choice. Returns the applied outcome (an ambush sets `pendingFight`); a choice the party cannot
 *  afford returns undefined and leaves the event open. */
export function chooseEvent(run: DungeonRun, choice: string): Outcome | undefined {
  const node = run.nodes[run.at];
  if (!node || node.kind !== 'event' || node.done || run.status !== 'active' || !DUNGEON_EVENTS[node.event!]?.includes(choice) || choiceNeed(run, node.event!, choice) !== undefined) return undefined;
  const def = depthDef(run.depth), chapter = def.unlock, roll = next(run);
  const out: Outcome = {}, key = `${node.event}:${choice}`, fx = EVENT_EFFECTS[key] ?? {};
  switch (key) {
    case 'shrine:pray': out.heal = fx.heal; break;
    case 'shrine:offering': out.gold = 40 + chapter * 10; out.hurt = fx.hurt; break;
    case 'archive:search': if (roll < .6) out.materials = { [def.material]: 2 }; else { out.fight = true; } break;
    case 'lantern:guide': out.materials = { 'ember-shard': 1 }; out.lore = letter(run); break;
    case 'lantern:keep': out.power = fx.power; break;
    case 'merchant:buy': out.gold = -EVENT_COST['merchant:buy']; out.potion = 1; break;
    case 'bell:ring': out.vitality = fx.vitality; out.hurt = fx.hurt; break;
    case 'bell:muffle': out.heal = fx.heal; break;
    case 'well:drink': if (roll < .5) out.heal = fx.heal; else out.hurt = fx.hurt; break;
    case 'well:coin': out.gold = -EVENT_COST['well:coin']; out.power = fx.power; break;
    case 'letters:read': out.lore = letter(run); out.heal = fx.heal; break;
    case 'letters:burn': out.gold = 30 + chapter * 8; break;
    case 'forge:temper': out.materials = { [def.material]: 1 }; out.hurt = fx.hurt; break;
    case 'echo:answer': out.fight = true; out.materials = { [def.material]: 1 }; break;
    case 'echo:silence': out.heal = fx.heal; break;
    case 'cradle:rock': out.lore = letter(run); out.vitality = fx.vitality; out.hurt = fx.hurt; break;
    default: if (choice === 'leave') out.heal = LEAVE_HEAL; break;
  }
  applyOutcome(run, out);
  node.done = true;
  if (out.fight) run.pendingFight = { kind: 'elite', enemy: pick(run, def.elite) };
  return out;
}

function applyOutcome(run: DungeonRun, out: Outcome) {
  if (out.gold) run.pouch.gold = Math.max(0, run.pouch.gold + out.gold);
  for (const [id, amount] of Object.entries(out.materials ?? {})) addMaterial(run.pouch, id, amount);
  for (const id of run.party) {
    if (run.hp[id] <= 0) continue;
    if (out.heal) run.hp[id] = Math.min(1, run.hp[id] + out.heal);
    if (out.hurt) run.hp[id] = Math.max(.05, run.hp[id] - out.hurt);
  }
  if (out.power) run.blessing.power = Math.round((run.blessing.power + out.power) * 100) / 100;
  if (out.vitality) run.blessing.vitality = Math.round((run.blessing.vitality + out.vitality) * 100) / 100;
  if (out.potion) run.potions = Math.min(3, run.potions + out.potion);
}

/** Open a treasure room: gold and a material, once. */
export function openTreasure(run: DungeonRun): Outcome | undefined {
  const node = run.nodes[run.at];
  if (!node || node.kind !== 'treasure' || node.done || run.status !== 'active') return undefined;
  const def = depthDef(run.depth);
  const out: Outcome = { gold: 30 + def.unlock * 9, materials: { [def.material]: 1 + (next(run) < .4 ? 1 : 0) } };
  applyOutcome(run, out); node.done = true;
  return out;
}

/** Camp: rest (heal CAMP_REST, revive the fallen at CAMP_REVIVE) or extract with the pouch. */
export function campChoice(run: DungeonRun, choice: 'rest' | 'extract'): boolean {
  const node = run.nodes[run.at];
  if (!node || node.kind !== 'camp' || node.done || run.status !== 'active') return false;
  node.done = true;
  if (choice === 'extract') { run.status = 'extracted'; return true; }
  for (const id of run.party) run.hp[id] = run.hp[id] <= 0 ? CAMP_REVIVE : Math.min(1, run.hp[id] + CAMP_REST);
  return true;
}

/** True when the current room has been dealt with and the party may move on. */
export function roomSettled(run: DungeonRun): boolean {
  return run.at < 0 || (!run.pendingFight && Boolean(run.nodes[run.at].done));
}

export function normalizeRun(raw: unknown): DungeonRun | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as DungeonRun;
  if (!Number.isInteger(r.depth) || r.depth < 1 || r.depth > DEPTHS.length || !Number.isInteger(r.seed) || !Array.isArray(r.party) || !r.party.length) return undefined;
  if (!['active', 'cleared', 'extracted', 'wiped'].includes(r.status)) return undefined;
  // Saves from before layouts were versioned were drawn with layout 1.
  const layout = Number.isInteger(r.layout) && r.layout >= 1 && r.layout <= MAP_VERSION ? r.layout : 1;
  const nodes = generateMap(r.depth, r.seed, layout);
  const visited = Array.isArray(r.visited) ? r.visited.filter(id => Number.isInteger(id) && nodes[id]) : [];
  for (const id of visited) if (r.nodes?.[id]?.done) nodes[id].done = true;
  const at = Number.isInteger(r.at) && (r.at === -1 || nodes[r.at]) ? r.at : -1;
  const ratio = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  const bless = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(2, v)) : 1;
  // A run saved with nine heroes (before the story party stopped at eight) keeps the first eight: the ninth could never fight.
  const party = r.party.filter(id => Number.isInteger(id)).slice(0, STORY_PARTY_MAX);
  const materials: Record<string, number> = {};
  for (const [id, amount] of Object.entries(r.pouch?.materials ?? {})) if (MATERIALS.includes(id as MaterialId) && Number.isSafeInteger(amount) && amount > 0) materials[id] = amount;
  const run: DungeonRun = {
    depth: r.depth, seed: r.seed, rng: Number.isInteger(r.rng) ? r.rng >>> 0 : r.seed >>> 0, nodes, at, visited,
    party, hp: Object.fromEntries(party.map(id => [id, ratio(r.hp?.[id])])),
    potions: Math.max(0, Math.min(3, Number.isInteger(r.potions) ? r.potions : 2)),
    pouch: { gold: Math.max(0, Math.min(1_000_000, Number.isSafeInteger(r.pouch?.gold) ? r.pouch.gold : 0)), materials },
    blessing: { power: bless(r.blessing?.power), vitality: bless(r.blessing?.vitality) },
    status: r.status, layout,
  };
  // An enemy that no longer exists is replaced by the room's own foe (or the depth's first elite for an event ambush).
  const room = nodes[at], fight = r.pendingFight;
  if (run.status === 'active' && fight && ['battle', 'elite', 'guardian'].includes(fight.kind)) {
    const enemy = typeof fight.enemy === 'string' && ENEMIES[fight.enemy] ? fight.enemy : room?.enemy ?? (room?.kind === 'event' ? depthDef(r.depth).elite[0] : undefined);
    const seen = fight.started === true && fight.seen && typeof fight.seen === 'object' ? { hp: Object.fromEntries(run.party.filter(id => Number.isFinite(fight.seen!.hp?.[id])).map(id => [id, ratio(fight.seen!.hp[id])])), potions: Number.isInteger(fight.seen.potions) ? Math.max(0, Math.min(run.potions, fight.seen.potions)) : run.potions } : undefined;
    const hiddenAt = fight.started === true && typeof fight.hiddenAt === 'number' && Number.isFinite(fight.hiddenAt) && fight.hiddenAt > 0 ? fight.hiddenAt : undefined;
    if (enemy) run.pendingFight = { kind: fight.kind, enemy, ...(fight.started === true ? { started: true } : {}), ...(seen ? { seen } : {}), ...(hiddenAt ? { hiddenAt } : {}) };
  }
  // A fight room that was entered but never won always has its fight waiting, so the run cannot get stuck.
  if (run.status === 'active' && !run.pendingFight && room?.enemy && !room.done && (room.kind === 'battle' || room.kind === 'elite' || room.kind === 'guardian')) run.pendingFight = { kind: room.kind, enemy: room.enemy };
  return run;
}
