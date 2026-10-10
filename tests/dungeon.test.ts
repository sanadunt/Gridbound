import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, startRun, reachable, enterNode, resolveFight, fleeFight, interruptFight, noteFight, chooseEvent, choiceNeed, openTreasure, campChoice, unlockedDepth, normalizeRun, dungeonBattleOptions, DEPTHS, DUNGEON_ROWS, CAMP_ROW, DUNGEON_EVENTS, DUNGEON_LETTERS, EVENT_COST, LEAVE_HEAL, INTERRUPT_WOUND, MAP_VERSION, type DungeonRun } from '../src/game/dungeon';
import { ENEMIES } from '../src/game/world';
import { createProfile, normalizeProfile, profileModifiers } from '../src/game/profile';
import { setStoryParty } from '../src/game/story-party';
import { normalizeJourney } from '../src/game/journey';
import { Battle } from '../src/game/simulation';
import { EN } from '../src/i18n/en';

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

// A run standing in a fresh event room (helper for the event tests).
const eventRoom = (event: string, gold = 0, depth = 1) => { const run = startRun(depth, 3, [0, 4]); const id = run.nodes.length; run.nodes.push({ id, row: 1, col: 9, kind: 'event', next: [], event }); run.at = id; run.pouch.gold = gold; run.hp = { 0: .5, 4: .5 }; return run; };

test('the run party is locked: party edits are refused mid-run and fights field run.party, not the story party', () => {
  const p = normalizeProfile({ ...createProfile(), roster: [0, 4, 3, 2, 7], cleared: [0, 1, 2], storyActive: [0, 4, 3] });
  p.journey.run = startRun(1, 42, [0, 4, 3]); p.journey.run.hp = { 0: .2, 4: .2, 3: .2 };
  assert.equal(setStoryParty(p, [2, 7, 0]), false, 'no party edits while the run is active');
  p.storyActive = [2, 7, 0]; // a story party changed some other way does not leak into the run either
  enterNode(p.journey.run, reachable(p.journey.run)[0]);
  const b = new Battle('dungeon', 1, profileModifiers(p), dungeonBattleOptions(p, p.journey.run)!);
  assert.deepEqual(b.heroes.map(h => h.id).sort(), [0, 3, 4], 'fight heroes are the run party');
  assert.ok(b.heroes.every(h => h.hp === Math.round(h.maxHp * .2)), 'with their carried HP');
  resolveFight(p.journey.run, true, { 0: .1, 4: .2 }, 2);
  assert.deepEqual(p.journey.run.hp, { 0: .1, 3: .2, 4: .2 }, 'a hero missing from the result keeps its HP instead of falling');
  p.journey.run.status = 'extracted';
  assert.equal(setStoryParty(p, [2, 7, 0]), true, 'the party opens again once the run ends');
});

test('fleeing keeps the wounds and potions used, keeps the fight waiting and drops half the pouch', () => {
  const run = startRun(1, 42, [0, 4, 3]); enterNode(run, reachable(run)[0]);
  run.pendingFight!.started = true; run.pouch = { gold: 31, materials: { 'ember-shard': 3, 'bell-bronze': 1 } };
  const lost = fleeFight(run, { 0: .4, 4: 0, 3: .9 }, 1)!;
  assert.deepEqual(lost, { gold: 16, materials: { 'ember-shard': 2, 'bell-bronze': 1 } });
  assert.deepEqual(run.pouch, { gold: 15, materials: { 'ember-shard': 1 } });
  assert.deepEqual(run.hp, { 0: .4, 4: 0, 3: .9 }); assert.equal(run.potions, 1);
  assert.deepEqual(run.pendingFight, { kind: 'battle', enemy: run.nodes[run.at].enemy }, 'the fight waits, no longer in progress');
  assert.ok(!run.nodes[run.at].done); assert.deepEqual(reachable(run), [], 'the room is still uncleared');
  assert.equal(run.status, 'active');
  assert.equal(interruptFight(run), undefined, 'a fight that has not begun is not interrupted');
  assert.equal(fleeFight(startRun(1, 1, [0]), {}, 2), undefined, 'nothing to flee from');
});

test('a reload mid-fight resolves as a flee: the started flag survives the save and costs a wound and half the pouch', () => {
  const run = startRun(2, 8, [0, 4, 3]); enterNode(run, reachable(run)[0]);
  run.hp = { 0: .8, 4: .1, 3: 0 }; run.pouch.gold = 40; run.pendingFight!.started = true;
  const saved = normalizeJourney(JSON.parse(JSON.stringify({ run })), [0, 1, 2]).run!;
  assert.equal(saved.pendingFight?.started, true, 'the fight-in-progress flag is saved');
  const lost = interruptFight(saved)!;
  assert.equal(lost.gold, 20); assert.equal(saved.pouch.gold, 20);
  assert.ok(Math.abs(saved.hp[0] - (.8 - INTERRUPT_WOUND)) < 1e-9); assert.equal(saved.hp[4], .05, 'the wound never fells a standing hero'); assert.equal(saved.hp[3], 0);
  assert.equal(saved.pendingFight?.started, undefined); assert.equal(interruptFight(saved), undefined, 'resolved once');
});

test('a reload never costs less than fleeing at the last noted moment: falls, potions and deep wounds are kept', () => {
  const run = startRun(2, 8, [0, 4, 3]); enterNode(run, reachable(run)[0]);
  run.hp = { 0: .9, 4: .9, 3: .9 }; run.potions = 2;
  assert.equal(noteFight(run, { 0: .1 }, 1), false, 'nothing to note before the fight begins');
  run.pendingFight!.started = true;
  assert.ok(noteFight(run, { 0: .1, 4: 0, 3: .8, 9: .5 }, 1));
  const saved = normalizeJourney(JSON.parse(JSON.stringify({ run })), [0, 1, 2]).run!;
  assert.deepEqual(saved.pendingFight?.seen, { hp: { 0: .1, 4: 0, 3: .8 }, potions: 1 }, 'the noted state survives the save');
  interruptFight(saved);
  assert.equal(saved.hp[0], .1, 'a deep wound is kept'); assert.equal(saved.hp[4], 0, 'a hero who fell stays down');
  assert.ok(Math.abs(saved.hp[3] - (.9 - INTERRUPT_WOUND)) < 1e-9, 'a light wound still costs the flat wound');
  assert.equal(saved.potions, 1, 'potions used stay used'); assert.equal(saved.pendingFight?.seen, undefined);
});

test('normalizeRun repairs corrupted runs: unknown enemies, non-numeric blessings and a fight room without its fight', () => {
  const run = startRun(2, 9, [0, 4]); const room = run.nodes.find(n => n.row === 0)!; enterNode(run, room.id);
  const raw = JSON.parse(JSON.stringify(run)); raw.pendingFight = { kind: 'battle', enemy: 'removed-enemy', started: true }; raw.blessing = { power: 'x', vitality: NaN };
  const fixed = normalizeRun(raw)!;
  assert.deepEqual(fixed.pendingFight, { kind: 'battle', enemy: room.enemy, started: true }, 'the room\'s own foe replaces an unknown enemy');
  assert.deepEqual(fixed.blessing, { power: 1, vitality: 1 });
  delete raw.pendingFight; assert.deepEqual(normalizeRun(raw)!.pendingFight, { kind: 'battle', enemy: room.enemy }, 'an unwon fight room gets its fight back');
  const ambush = eventRoom('archive'); ambush.pendingFight = { kind: 'elite', enemy: 'gone' };
  assert.equal(normalizeRun(JSON.parse(JSON.stringify({ ...ambush, nodes: ambush.nodes.slice(0, -1), at: -1 })))?.pendingFight, undefined, 'a fight with no room to fall back on is dropped');
});

test('event choices are honest: unaffordable ones are refused without using the event, and every choice does something', () => {
  for (const [key, cost] of Object.entries(EVENT_COST)) {
    const [event, choice] = key.split(':'), run = eventRoom(event, cost - 1);
    assert.equal(choiceNeed(run, event, choice), cost);
    assert.equal(chooseEvent(run, choice), undefined, `${key} needs ${cost}G`);
    assert.equal(run.pouch.gold, cost - 1); assert.equal(run.blessing.power, 1); assert.ok(!run.nodes[run.at].done, 'the event stays open');
    run.pouch.gold = cost; assert.ok(chooseEvent(run, choice)); assert.equal(run.pouch.gold, 0);
  }
  const full = eventRoom('merchant', 200); full.potions = 3;
  assert.equal(choiceNeed(full, 'merchant', 'buy'), 'potions'); assert.equal(chooseEvent(full, 'buy'), undefined);
  for (const [event, choices] of Object.entries(DUNGEON_EVENTS)) for (const choice of choices) {
    const run = eventRoom(event, 500), out = chooseEvent(run, choice)!;
    assert.ok(Object.keys(out).length > 0, `${event}:${choice} does something`);
    if (choice === 'leave') assert.equal(out.heal, LEAVE_HEAL, `${event}:leave heals a little`);
  }
  const rock = eventRoom('cradle'), out = chooseEvent(rock, 'rock')!;
  assert.ok(out.hurt! > 0 && out.vitality! > 0, 'the cradle\'s blessing has a price');
  for (const depth of DEPTHS.map(d => d.id)) for (const [event, choice] of [['letters', 'read'], ['cradle', 'rock'], ['lantern', 'guide']]) {
    const lore = chooseEvent(eventRoom(event, 0, depth), choice)!.lore!;
    assert.ok(DUNGEON_LETTERS[depth - 1].includes(lore), `${event} reads a letter from depth ${depth}'s pool`);
  }
  for (const id of DUNGEON_LETTERS.flat()) assert.ok(EN[`dungeon.letter.${id}` as keyof typeof EN], `letter ${id} has text`);
});

test('variety: 2-3 elites per depth, no repeat foe on linked rooms, more events mid-map; old saves keep their layout', () => {
  for (const d of DEPTHS) { assert.ok(d.elite.length >= 2 && d.elite.length <= 3); assert.ok(d.elite.every(id => ENEMIES[id] && id !== d.guardian && !d.enemies.includes(id)), `depth ${d.id} elites`); }
  let links = 0, repeats = 0; const elites = new Set<string>();
  for (const d of DEPTHS) for (let seed = 1; seed < 200; seed++) {
    const nodes = generateMap(d.id, seed);
    for (const n of nodes) { if (n.kind === 'elite') elites.add(n.enemy!); for (const id of n.next) if (n.enemy && n.kind === nodes[id].kind && (n.kind === 'battle' || n.kind === 'elite')) { links++; if (n.enemy === nodes[id].enemy) repeats++; } }
  }
  assert.ok(repeats / links < .01, `same foe on linked rooms only when unavoidable (${repeats}/${links})`);
  assert.deepEqual([...elites].sort(), [...new Set(DEPTHS.flatMap(d => d.elite))].sort(), 'elite rooms draw from every depth\'s elites');
  const events = (layout: number) => DEPTHS.reduce((sum, d) => sum + Array.from({ length: 200 }, (_, seed) => generateMap(d.id, seed, layout).filter(n => n.row >= 2 && n.row <= 4 && n.kind === 'event').length).reduce((a, b) => a + b, 0), 0);
  assert.ok(events(MAP_VERSION) > events(1) * 1.1, 'rows 2-4 hold more events');
  // Layout 1 is the pre-versioning generator: a save from before keeps the exact rooms it was walking.
  const fingerprint = (layout: number) => generateMap(5, 9, layout).map(x => x.kind[0] + (x.enemy ? `:${x.enemy}` : x.event ? `:${x.event}` : '')).join(' ');
  assert.equal(fingerprint(1), 'b:harpy-frost b:harpy-frost b:harpy-frost e:lantern b:harpy-frost e:bell b:harpy-frost t b:wolf-frost t b:basilisk-frost t b:basilisk-frost e:merchant b:basilisk-frost b:harpy-frost e:archive b:wolf-frost c c g:colossus');
  const old: Partial<DungeonRun> = JSON.parse(JSON.stringify(startRun(5, 9, [0]))); delete old.layout; old.nodes = generateMap(5, 9, 1);
  assert.equal(normalizeRun(old)!.layout, 1); assert.deepEqual(normalizeRun(old)!.nodes, generateMap(5, 9, 1));
  assert.equal(startRun(5, 9, [0]).layout, MAP_VERSION); assert.notEqual(fingerprint(MAP_VERSION), fingerprint(1));
});
