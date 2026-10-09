import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation';
import { KITS, ROSTER, CLASS_IDS } from '../src/game/content';
import { JOBS } from '../src/game/jobs';
import { CAMPAIGN, ENEMIES } from '../src/game/world';
import { createProfile, completeZone, moveFormation } from '../src/game/profile';
import { storyPartyCap, setStoryParty } from '../src/game/story-party';

// A one-hero raid with the given class and skill in slot 0, ready to act.
function solo(classId: string, skill: number, extra: number[] = [0, 4, 3]) {
  const id = ROSTER.findIndex(h => h.classId === classId);
  const roster = [id, ...extra.filter(x => x !== id)];
  const b = new Battle('raid', 1, undefined, { roster, loadouts: { [id]: { skills: [skill, skill === 0 ? 1 : 0], talents: ['active-2', 'active-3'] } } });
  b.start();
  return { b, h: b.hero(id)! };
}

test('R2 adds four classes, each with four skills, two job branches and a class talent chain', () => {
  assert.deepEqual([...CLASS_IDS].slice(5), ['bard', 'hexer', 'monk', 'engineer']);
  for (const cls of ['bard', 'hexer', 'monk', 'engineer'] as const) {
    assert.ok(KITS[cls].skills.length >= 8, `${cls} has base skills plus four job skills`);
    assert.equal(Object.values(JOBS).filter(j => j.base === cls).length, 4);
  }
  assert.equal(ROSTER.length, 15);
});

test('haste shortens the rest of the party, delay and stun push the next intent', () => {
  const { b, h } = solo('bard', 0);
  for (const a of b.heroes) a.remaining = 5;
  b.act(h);
  assert.ok(b.heroes.filter(a => a !== h).every(a => a.remaining < 5));
  const lull = solo('bard', 2), before = (lull.b as any).attackIn;
  lull.b.act(lull.h); assert.ok((lull.b as any).attackIn > before);
  const mine = solo('engineer', 1), stagger = mine.b.stagger;
  mine.b.act(mine.h); assert.ok(mine.b.stagger > stagger);
});

test('weaken cuts enemy damage and resolve fills the ultimate', () => {
  const { b, h } = solo('bard', 1);
  b.act(h); assert.ok(b.weakenLeft > 0);
  const target = b.heroes[1], hp = target.hp; target.shield = 0; b.hurt(target, 100);
  assert.equal(hp - target.hp, 75);
  const encore = solo('bard', 3), r = encore.b.resolve;
  encore.b.act(encore.h); assert.ok(encore.b.resolve > r);
});

test('curses tick once per second and drain heals the most wounded ally', () => {
  const { b, h } = solo('hexer', 0);
  b.act(h); const hp = b.bossHp;
  for (let i = 0; i < 60; i++) b.tick(1 / 60);
  assert.ok(b.bossHp < hp);
  const drain = solo('hexer', 1); const hurt = drain.b.heroes[1]; hurt.hp = hurt.maxHp / 2; const low = hurt.hp;
  drain.b.act(drain.h); assert.ok(hurt.hp > low);
  const pact = solo('hexer', 2); const self = pact.h.hp, boss = pact.b.bossHp;
  pact.b.act(pact.h); assert.ok(pact.h.hp < self && pact.b.bossHp < boss);
});

test('monk combo stacks, counter halves damage and strikes back, inner calm heals and clears fatigue', () => {
  const { b, h } = solo('monk', 0);
  b.act(h); b.act(h); assert.equal(h.combo, 2);
  const counter = solo('monk', 1); counter.b.act(counter.h); counter.h.shield = 0;
  const hp = counter.h.hp, boss = counter.b.bossHp; counter.b.hurt(counter.h, 100);
  assert.equal(hp - counter.h.hp, 50); assert.ok(counter.b.bossHp < boss);
  const calm = solo('monk', 3); calm.h.hp = 10; calm.h.fatigue = 80; calm.b.act(calm.h);
  assert.ok(calm.h.hp > 10); assert.equal(calm.h.fatigue, 0);
});

test('turrets fire every second in their lane and repair adds one potion per stage', () => {
  const { b, h } = solo('engineer', 0);
  b.act(h); assert.equal(b.turrets.length, 1); const hp = b.bossHp;
  for (let i = 0; i < 70; i++) b.tick(1 / 60);
  assert.ok(b.bossHp < hp);
  const kit = solo('engineer', 2); const potions = kit.b.potions;
  kit.b.act(kit.h); kit.b.act(kit.h); assert.equal(kit.b.potions, potions + 1);
});

test('silence pushes cooldowns back unless guarded; mend heals the boss unless interrupted', () => {
  const b = new Battle('raid', 1, undefined, { enemyId: 'choir', roster: [0, 4, 3] }); b.start();
  b.telegraph(); const silence = b.threats.at(-1)!; assert.equal(silence.effect, 'silence');
  for (const h of b.heroes) h.remaining = 0.5;
  silence.left = 1 / 120; (b as any).attackIn = 99; (b as any).clawIn = 99; b.tick(1 / 60);
  assert.ok(b.heroes.every(h => h.hp <= 0 || h.remaining > 0.5));
  const lich = new Battle('raid', 1, undefined, { enemyId: 'lich', roster: [0, 4, 3] }); lich.start();
  (lich as any).pattern = 3; lich.telegraph(); const mend = lich.threats.at(-1)!;
  assert.equal(mend.type, 'channel'); lich.bossHp = lich.bossMax / 2; mend.left = 1 / 120; (lich as any).attackIn = 99; lich.tick(1 / 60);
  assert.ok(lich.bossHp > lich.bossMax / 2);
  const cut = new Battle('raid', 1, undefined, { enemyId: 'lich', roster: [0], loadouts: { 0: { skills: [2, 0], talents: ['active-2'] } } }); cut.start();
  (cut as any).pattern = 3; cut.telegraph(); cut.act(cut.hero(0)!); assert.equal(cut.threats.filter(t => t.type === 'channel').length, 0);
});

test('six new enemies have art-ready ids and three variants each; later chapters use them', () => {
  for (const id of ['lich', 'knight', 'hydra', 'harpy', 'colossus', 'choir']) for (const v of ['', '-ash', '-frost', '-auric']) assert.ok(ENEMIES[id + v], id + v);
  const used = new Set(CAMPAIGN.flatMap(c => c.stages.map(s => ENEMIES[s.enemy].archetype)));
  for (const id of ['moth', 'basilisk', 'crab', 'revenant', 'lich', 'knight', 'hydra', 'harpy', 'colossus', 'choir']) assert.ok(used.has(id), id);
});

test('new heroes join through the story and the grid grows to nine', () => {
  const p = createProfile();
  for (let i = 0; i < 13; i++) completeZone(p, i);
  assert.deepEqual(p.roster.slice(9), [9, 10, 11, 12, 13, 14]);
  assert.equal(storyPartyCap(p.cleared), 9);
  assert.ok(setStoryParty(p, p.roster.slice(-9)));
  assert.equal(new Set(p.storyActive.map(id => p.loadouts[id].slot)).size, 9, 'deployed heroes never share a tile');
  const b = new Battle('raid', 1, undefined, { roster: ROSTER.map((_, id) => id) });
  assert.equal(b.heroes.length, 9); assert.equal(new Set(b.heroes.map(h => h.slot)).size, 9);
  const first = p.storyActive[0], tile = p.loadouts[p.storyActive[1]].slot;
  assert.ok(moveFormation(p, first, tile));
  assert.equal(new Set(p.storyActive.map(id => p.loadouts[id].slot)).size, 9);
});
