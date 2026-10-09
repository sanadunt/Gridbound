import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, startRun, reachable, enterNode, resolveFight, chooseEvent, openTreasure, campChoice, unlockedDepth, normalizeRun, DEPTHS, DUNGEON_ROWS, CAMP_ROW, DUNGEON_EVENTS } from '../src/game/dungeon';
import { ENEMIES } from '../src/game/world';

test('dungeon maps are seeded, fully connected, and end in a camp row and one guardian', () => {
  for (const depth of DEPTHS.map(d => d.id)) for (const seed of [1, 7, 99, 12345]) {
    const nodes = generateMap(depth, seed);
    assert.deepEqual(generateMap(depth, seed), nodes, 'same seed, same map');
    assert.equal(nodes.filter(n => n.kind === 'guardian').length, 1);
    assert.ok(nodes.filter(n => n.row === CAMP_ROW).every(n => n.kind === 'camp'));
    for (const n of nodes) {
      if (n.row < DUNGEON_ROWS - 1) assert.ok(n.next.length >= 1 && n.next.every(id => nodes[id].row === n.row + 1));
      if (n.row > 0) assert.ok(nodes.some(m => m.next.includes(n.id)), `room ${n.id} is reachable`);
      if (n.enemy) assert.ok(ENEMIES[n.enemy], n.enemy);
      if (n.event) assert.ok(DUNGEON_EVENTS[n.event]);
    }
  }
});

test('depths unlock with story chapters and the previous guardian', () => {
  assert.equal(unlockedDepth([], 0), 0);
  assert.equal(unlockedDepth([0], 0), 1);
  assert.equal(unlockedDepth([0, 1, 2], 0), 1, 'depth 2 waits for depth 1');
  assert.equal(unlockedDepth([0, 1, 2], 1), 2);
});

test('a run moves room by room, keeps HP, banks nothing on a wipe', () => {
  const run = startRun(1, 42, [0, 4, 3]);
  const first = reachable(run)[0];
  const room = enterNode(run, first)!; assert.equal(room.kind, 'battle'); assert.ok(run.pendingFight);
  assert.deepEqual(reachable(run), [], 'cannot leave mid-fight');
  const reward = resolveFight(run, true, { 0: .5, 4: .8, 3: 0 }, 1)!;
  assert.ok(reward.gold > 0); assert.equal(run.hp[3], 0); assert.equal(run.potions, 1);
  assert.ok(reachable(run).length >= 1);
  const loss = startRun(1, 42, [0]); enterNode(loss, reachable(loss)[0]); loss.pouch.gold = 99;
  resolveFight(loss, false, { 0: 0 }, 0);
  assert.equal(loss.status, 'wiped'); assert.equal(loss.pouch.gold, 0);
});

test('events, treasure and camp resolve once; camp revives and extract ends the run', () => {
  const run = startRun(2, 5, [0, 4]);
  const room = (kind: 'event' | 'treasure' | 'camp', row: number, event?: string) => { const id = run.nodes.length; run.nodes.push({ id, row, col: 9, kind, next: [], event }); run.at = id; };
  room('event', 1, 'shrine'); run.hp = { 0: .4, 4: .4 };
  const out = chooseEvent(run, 'pray')!; assert.equal(out.heal, .3); assert.ok(Math.abs(run.hp[0] - .7) < 1e-9);
  assert.equal(chooseEvent(run, 'pray'), undefined, 'events resolve once');
  room('treasure', 3);
  const loot = openTreasure(run)!; assert.ok(loot.gold! > 0 && Object.values(run.pouch.materials).some(v => v > 0));
  room('camp', CAMP_ROW); run.hp = { 0: 0, 4: .5 };
  assert.ok(campChoice(run, 'rest')); assert.equal(run.hp[0], .25); assert.equal(run.hp[4], .85);
  room('camp', CAMP_ROW);
  assert.ok(campChoice(run, 'extract')); assert.equal(run.status, 'extracted');
});

test('beating the guardian clears the run with its loot; saves round-trip through normalizeRun', () => {
  const run = startRun(3, 11, [0, 4, 3]);
  run.at = run.nodes.find(n => n.kind === 'guardian')!.id; run.pendingFight = { kind: 'guardian', enemy: 'hydra' };
  const loot = resolveFight(run, true, { 0: 1, 4: 1, 3: 1 }, 2)!;
  assert.equal(run.status, 'cleared'); assert.ok(loot.materials['bell-bronze'] >= 3);
  const copy = normalizeRun(JSON.parse(JSON.stringify(run)))!;
  assert.equal(copy.status, 'cleared'); assert.deepEqual(copy.pouch, run.pouch); assert.equal(copy.nodes.length, run.nodes.length);
  assert.equal(normalizeRun({ depth: 99 }), undefined);
});
