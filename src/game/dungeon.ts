// The Undercroft: an optional story dungeon beneath Emberhollow's bell tower. Each run is a seeded
// map of rooms (battles, elites, events, treasure, a camp row, a guardian). The story party keeps its
// HP between rooms; gold and materials go into a pouch that is only kept by extracting or by beating
// the guardian. Pure logic only: text lives in the i18n tables under `dungeon.*`.
import { CAMPAIGN } from './world';

export type DungeonNodeKind = 'battle' | 'elite' | 'event' | 'treasure' | 'camp' | 'guardian';
export type DungeonNode = { id: number; row: number; col: number; kind: DungeonNodeKind; next: number[]; enemy?: string; event?: string; done?: boolean };
export type Pouch = { gold: number; materials: Record<string, number> };
export type DungeonRun = {
  depth: number; seed: number; rng: number; nodes: DungeonNode[]; at: number; visited: number[];
  party: number[]; hp: Record<number, number>; potions: number; pouch: Pouch;
  blessing: { power: number; vitality: number };
  status: 'active' | 'cleared' | 'extracted' | 'wiped';
  pendingFight?: { kind: 'battle' | 'elite' | 'guardian'; enemy: string };
};
export type DepthDef = { id: number; unlock: number; enemies: string[]; elite: string[]; guardian: string; material: string };

export const MATERIALS = ['ember-shard', 'bell-bronze', 'frost-glass'] as const;
export type MaterialId = typeof MATERIALS[number];
// Depth N opens once chapter `unlock` is cleared and fights at that chapter's difficulty.
export const DEPTHS: DepthDef[] = [
  { id: 1, unlock: 1, enemies: ['wolf', 'goblin', 'spider'], elite: ['shaman'], guardian: 'treant', material: 'ember-shard' },
  { id: 2, unlock: 3, enemies: ['shaman', 'moth', 'goblin'], elite: ['golem'], guardian: 'wraith', material: 'ember-shard' },
  { id: 3, unlock: 5, enemies: ['basilisk', 'harpy', 'spider-ash'], elite: ['revenant'], guardian: 'hydra', material: 'bell-bronze' },
  { id: 4, unlock: 7, enemies: ['revenant', 'goblin-ash', 'moth-ash'], elite: ['lich'], guardian: 'knight', material: 'bell-bronze' },
  { id: 5, unlock: 9, enemies: ['wolf-frost', 'harpy-frost', 'basilisk-frost'], elite: ['knight-frost'], guardian: 'colossus', material: 'frost-glass' },
  { id: 6, unlock: 11, enemies: ['treant-frost', 'moth-frost', 'crab-frost'], elite: ['lich-frost'], guardian: 'hydra-frost', material: 'frost-glass' },
  { id: 7, unlock: 13, enemies: ['choir', 'knight-auric', 'harpy-auric'], elite: ['lich-auric'], guardian: 'choir-auric', material: 'frost-glass' },
  { id: 8, unlock: 15, enemies: ['basilisk-auric', 'revenant-auric', 'colossus-auric'], elite: ['hydra-auric'], guardian: 'dragon-auric', material: 'frost-glass' },
];
export const DUNGEON_ROWS = 7;
export const CAMP_ROW = 5;

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

function next(run: { rng: number }) { run.rng = (Math.imul(1664525, run.rng) + 1013904223) >>> 0; return run.rng / 4294967296; }
const pick = <T>(run: { rng: number }, list: readonly T[]) => list[Math.floor(next(run) * list.length)];

export function depthDef(depth: number): DepthDef { return DEPTHS[Math.max(0, Math.min(DEPTHS.length - 1, depth - 1))]; }
/** Deepest depth the player may enter: depth N needs chapter `unlock` cleared and depth N-1 beaten (depth 1 only needs the chapter). */
export function unlockedDepth(cleared: readonly number[], best: number): number {
  let depth = 0;
  for (const d of DEPTHS) if (cleared.includes(d.unlock - 1) && d.id <= best + 1) depth = d.id;
  return depth;
}

export function generateMap(depth: number, seed: number): DungeonNode[] {
  const def = depthDef(depth), run = { rng: (seed ^ (depth * 2654435761)) >>> 0 }, nodes: DungeonNode[] = [];
  for (let row = 0; row < DUNGEON_ROWS; row++) {
    const width = row === DUNGEON_ROWS - 1 ? 1 : row === 0 ? 3 : row === CAMP_ROW ? 2 : next(run) < .5 ? 3 : 4;
    const treasureAt = row === 3 ? Math.floor(next(run) * width) : -1;
    for (let col = 0; col < width; col++) {
      let kind: DungeonNodeKind;
      if (row === DUNGEON_ROWS - 1) kind = 'guardian';
      else if (row === CAMP_ROW) kind = 'camp';
      else if (row === 0) kind = 'battle';
      else if (col === treasureAt) kind = 'treasure';
      else { const r = next(run); kind = r < .46 ? 'battle' : r < .74 ? 'event' : r < .9 ? 'elite' : 'treasure'; }
      const node: DungeonNode = { id: nodes.length, row, col, kind, next: [] };
      if (kind === 'battle') node.enemy = pick(run, def.enemies);
      if (kind === 'elite') node.enemy = pick(run, def.elite);
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
  return nodes;
}

export function startRun(depth: number, seed: number, party: number[]): DungeonRun {
  const nodes = generateMap(depth, seed);
  return { depth, seed, rng: (seed * 31 + depth) >>> 0, nodes, at: -1, visited: [], party: [...party], hp: Object.fromEntries(party.map(id => [id, 1])), potions: 2, pouch: { gold: 0, materials: {} }, blessing: { power: 1, vitality: 1 }, status: 'active' };
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

/** Enemy HP and damage multipliers for a dungeon fight at this depth, before the chapter tables. */
// Dungeon rooms hit harder than the chapter they unlock with: HP carries over, so attrition is the challenge.
export const DUNGEON_HP = 1.45, DUNGEON_DMG = 1.3;
// Per-depth damage trim (fitted with the balance harness's casual player at each depth's unlock).
export const DEPTH_DMG = [1, 1, 1, .92, 1, .8, .95, .78];

export function fightScale(run: DungeonRun, kind: 'battle' | 'elite' | 'guardian') {
  const chapter = depthDef(run.depth).unlock, stages = CAMPAIGN[chapter - 1].stages;
  const base = kind === 'guardian' ? stages.at(-1)!.hp * .85 : kind === 'elite' ? stages.at(-2)!.hp : stages[1].hp;
  return { chapter, hp: base * DUNGEON_HP, damage: DUNGEON_DMG * DEPTH_DMG[run.depth - 1] * (kind === 'elite' ? 1.12 : kind === 'guardian' ? 1 : .9) };
}

export function dungeonXP(run: DungeonRun, kind: 'battle' | 'elite' | 'guardian') {
  const chapter = depthDef(run.depth).unlock;
  return Math.round((60 + 25 * chapter) * (kind === 'elite' ? 1.5 : kind === 'guardian' ? 2.5 : 1));
}

const addMaterial = (pouch: Pouch, id: string, amount: number) => { if (amount > 0) pouch.materials[id] = (pouch.materials[id] ?? 0) + amount; };

/** Record the result of the pending fight. `hp` is each party hero's HP ratio after the battle. */
export function resolveFight(run: DungeonRun, won: boolean, hp: Record<number, number>, potions: number): { gold: number; materials: Record<string, number> } | undefined {
  const fight = run.pendingFight;
  if (!fight || run.status !== 'active') return undefined;
  delete run.pendingFight;
  for (const id of run.party) run.hp[id] = Math.max(0, Math.min(1, hp[id] ?? 0));
  run.potions = Math.max(0, Math.min(3, potions));
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

export type Outcome = { gold?: number; materials?: Record<string, number>; heal?: number; hurt?: number; power?: number; vitality?: number; potion?: number; fight?: boolean; lore?: boolean };

/** Resolve an event choice. Returns the applied outcome (an ambush sets `pendingFight`). */
export function chooseEvent(run: DungeonRun, choice: string): Outcome | undefined {
  const node = run.nodes[run.at];
  if (!node || node.kind !== 'event' || node.done || run.status !== 'active' || !DUNGEON_EVENTS[node.event!]?.includes(choice)) return undefined;
  const def = depthDef(run.depth), chapter = def.unlock, roll = next(run);
  const out: Outcome = {};
  switch (`${node.event}:${choice}`) {
    case 'shrine:pray': out.heal = .3; break;
    case 'shrine:offering': out.gold = 40 + chapter * 10; out.hurt = .12; break;
    case 'archive:search': if (roll < .6) out.materials = { [def.material]: 2 }; else { out.fight = true; } break;
    case 'lantern:guide': out.materials = { 'ember-shard': 1 }; out.lore = true; break;
    case 'lantern:keep': out.power = .08; break;
    case 'merchant:buy': if (run.pouch.gold >= 60 && run.potions < 3) { out.gold = -60; out.potion = 1; } break;
    case 'bell:ring': out.vitality = .08; out.hurt = .08; break;
    case 'bell:muffle': out.heal = .12; break;
    case 'well:drink': if (roll < .5) out.heal = .35; else out.hurt = .1; break;
    case 'well:coin': out.gold = -20; out.power = .05; break;
    case 'letters:read': out.lore = true; out.heal = .1; break;
    case 'letters:burn': out.gold = 30 + chapter * 8; break;
    case 'forge:temper': out.materials = { [def.material]: 1 }; out.hurt = .1; break;
    case 'echo:answer': out.fight = true; out.materials = { [def.material]: 1 }; break;
    case 'echo:silence': out.heal = .15; break;
    case 'cradle:rock': out.lore = true; out.vitality = .05; break;
    default: break;
  }
  if (out.gold && out.gold < 0 && run.pouch.gold < -out.gold) delete out.gold;
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

/** Camp: rest (heal 35%, revive the fallen at 25%) or extract with the pouch. */
export function campChoice(run: DungeonRun, choice: 'rest' | 'extract'): boolean {
  const node = run.nodes[run.at];
  if (!node || node.kind !== 'camp' || node.done || run.status !== 'active') return false;
  node.done = true;
  if (choice === 'extract') { run.status = 'extracted'; return true; }
  for (const id of run.party) run.hp[id] = run.hp[id] <= 0 ? .25 : Math.min(1, run.hp[id] + .35);
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
  const nodes = generateMap(r.depth, r.seed);
  const visited = Array.isArray(r.visited) ? r.visited.filter(id => Number.isInteger(id) && nodes[id]) : [];
  for (const id of visited) if (r.nodes?.[id]?.done) nodes[id].done = true;
  const at = Number.isInteger(r.at) && (r.at === -1 || nodes[r.at]) ? r.at : -1;
  const ratio = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  const materials: Record<string, number> = {};
  for (const [id, amount] of Object.entries(r.pouch?.materials ?? {})) if (MATERIALS.includes(id as MaterialId) && Number.isSafeInteger(amount) && amount > 0) materials[id] = amount;
  const run: DungeonRun = {
    depth: r.depth, seed: r.seed, rng: Number.isInteger(r.rng) ? r.rng >>> 0 : r.seed >>> 0, nodes, at, visited,
    party: r.party.filter(id => Number.isInteger(id)), hp: Object.fromEntries(r.party.map(id => [id, ratio(r.hp?.[id])])),
    potions: Math.max(0, Math.min(3, Number.isInteger(r.potions) ? r.potions : 2)),
    pouch: { gold: Math.max(0, Math.min(1_000_000, Number.isSafeInteger(r.pouch?.gold) ? r.pouch.gold : 0)), materials },
    blessing: { power: Math.max(1, Math.min(2, r.blessing?.power ?? 1)), vitality: Math.max(1, Math.min(2, r.blessing?.vitality ?? 1)) },
    status: r.status,
  };
  if (r.pendingFight && typeof r.pendingFight.enemy === 'string' && ['battle', 'elite', 'guardian'].includes(r.pendingFight.kind)) run.pendingFight = { kind: r.pendingFight.kind, enemy: r.pendingFight.enemy };
  return run;
}
