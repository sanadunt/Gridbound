import type { Profile } from '../game/profile';
import { unlockedDepth } from '../game/dungeon';

/** Town features that open as the story reaches them (UI-side table; game rules never read it). Value = chapters cleared. */
export const UNLOCKS = { dungeon: 1, raid: 2, endless: 4 } as const;
export type Feature = keyof typeof UNLOCKS;
export const FEATURES = Object.keys(UNLOCKS) as Feature[];
export const isFeature = (tab: string): tab is Feature => tab in UNLOCKS;

/** Challenge modes the active Commander has a run in (a suspended Bell Trials run, an unfinished raid): reachable whatever the story. */
let inUse: Feature[] = [];
type RunHolder = { raid?: { activeRun?: unknown }; rogue?: { activeRun?: unknown }; encounters?: Partial<Record<string, { settled: boolean }>> };
export function noteModesInUse(doc: RunHolder | undefined) {
  const open = (run: unknown, mode: string) => Boolean(run) || doc?.encounters?.[mode]?.settled === false;
  inUse = doc ? (['raid', 'endless'] as const).filter(f => f === 'raid' ? open(doc.raid?.activeRun, 'raid') : open(doc.rogue?.activeRun, 'roguelike')) : [];
}
/** Open once the story reached it, or already used (an older save that raided or descended keeps its modes, a run in progress stays reachable). */
export function featureOpen(p: Profile, f: Feature) {
  if (p.cleared.length >= UNLOCKS[f] || inUse.includes(f)) return true;
  return f === 'raid' ? p.ledger.raids > 0 : f === 'endless' ? p.bestFloor > 0 : unlockedDepth(p.cleared, p.journey.depth) > 0 || p.journey.depth > 0 || p.journey.run?.status === 'active';
}
/** A route the player cannot enter yet. */
export const routeLocked = (p: Profile, tab: string) => isFeature(tab) && !featureOpen(p, tab);

/** Per-viewer flags (localStorage, best effort): which unlock intros played and which new modes were visited. */
const KEY = 'gridbound.ui.unlocks';
type Flags = { intro: string[]; visited: string[] };
function read(): Flags {
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Flags>; return { intro: Array.isArray(raw.intro) ? raw.intro : [], visited: Array.isArray(raw.visited) ? raw.visited : [] }; } catch { return { intro: [], visited: [] }; }
}
function write(flags: Flags) { try { localStorage.setItem(KEY, JSON.stringify(flags)); } catch { /* storage blocked: the flags last this page only */ } }
let memory: Flags | undefined;
const flags = () => memory ??= read();
/** A feature counts as known when the save already used it, so long-time players get no NEW flags or intro cards for it. */
const used = (p: Profile, f: Feature) => inUse.includes(f) || (f === 'raid' ? p.ledger.raids > 0 : f === 'endless' ? p.bestFloor > 0 : p.journey.depth > 0 || Boolean(p.journey.run));
/** Open features whose one-time intro card has not played. */
export const pendingIntros = (p: Profile) => FEATURES.filter(f => featureOpen(p, f) && !used(p, f) && !flags().intro.includes(f));
export function markIntro(f: Feature) { const v = flags(); if (!v.intro.includes(f)) { v.intro.push(f); write(v); } }
/** 'NEW' on the hotspot until the mode is visited once. */
export const isNew = (p: Profile, f: Feature) => featureOpen(p, f) && !used(p, f) && !flags().visited.includes(f);
export function markVisited(f: Feature) { const v = flags(); if (!v.visited.includes(f)) { v.visited.push(f); write(v); } }
/** Tests and QA: forget the flags (localStorage included). */
export function resetUnlockFlags() { memory = { intro: [], visited: [] }; write(memory); }
