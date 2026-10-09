import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterStars, claimableChests, createJourney, normalizeJourney, recordStars, totalStars, STARS_PER_CHEST, STAR_PAR_SECONDS } from '../src/game/journey';
import { createProfile, normalizeProfile, refineGear, refineCost, claimStarChest, recordChapterResult, bankPouch, equipGear, settleProgress, profileModifiers } from '../src/game/profile';
import { gearStats, GEAR, MAX_REFINE, REFINE_STEP } from '../src/game/jobs';
import { Battle, HEROIC_HP, HEROIC_DMG } from '../src/game/simulation';
import { storyBattleOptions } from '../src/game/story-party';
import { heroPower, partyPower, powerVerdict, recommendedPower, RECOMMENDED_POWER } from '../src/game/power';
import { startRun, fightScale, dungeonXP, enterNode, reachable } from '../src/game/dungeon';
import { storyStateFromProfile, createCommanderDocument, materializeProfile } from '../src/game/commander';

test('chapter stars: clear, everyone standing, boss under par; only improvements count', () => {
  assert.equal(chapterStars(false, STAR_PAR_SECONDS + 1), 1);
  assert.equal(chapterStars(true, STAR_PAR_SECONDS + 1), 2);
  assert.equal(chapterStars(true, STAR_PAR_SECONDS), 3);
  const j = createJourney();
  assert.equal(recordStars(j, 0, 2), true);
  assert.equal(recordStars(j, 0, 1), false);
  assert.equal(j.stars[0], 2);
  assert.equal(recordStars(j, 0, 9), true);
  assert.equal(j.stars[0], 3);
});

test('star chests open every STARS_PER_CHEST stars and pay gold plus materials', () => {
  const p = createProfile(); p.cleared = [0, 1, 2];
  p.journey.stars = { 0: 3, 1: 3, 2: 2 };
  assert.equal(totalStars(p.journey), STARS_PER_CHEST);
  assert.equal(claimableChests(p.journey), 1);
  const gold = p.gold, reward = claimStarChest(p)!;
  assert.ok(reward.gold > 0);
  assert.equal(p.gold, gold + reward.gold);
  assert.equal(p.economy.materials['ember-shard'], 2);
  assert.equal(claimStarChest(p), undefined, 'one chest per threshold');
});

test('journey normalization drops stars and heroic clears for chapters not cleared', () => {
  const j = normalizeJourney({ stars: { 0: 3, 5: 3, 1: 7 }, chests: 99, heroic: [0, 0, 5], depth: 42, run: { junk: true } }, [0, 1]);
  assert.deepEqual(j.stars, { 0: 3, 1: 3 });
  assert.equal(j.chests, 0);
  assert.deepEqual(j.heroic, [0]);
  assert.equal(j.depth, 8);
  assert.equal(j.run, undefined);
});

test('a Heroic first clear pays once and does not touch stars', () => {
  const p = createProfile(); p.cleared = [0];
  const first = recordChapterResult(p, 0, 3, true);
  assert.ok(first.heroic && first.heroic.gold > 0);
  assert.deepEqual(p.journey.heroic, [0]);
  assert.equal(p.journey.stars[0], undefined);
  assert.equal(recordChapterResult(p, 0, 3, true).heroic, undefined, 'second Heroic clear pays nothing');
  assert.equal(recordChapterResult(p, 1, 3, true).heroic, undefined, 'Heroic needs the normal clear first');
});

test('Heroic battles are tougher than the normal chapter and allow one potion', () => {
  const p = createProfile();
  const normal = new Battle('adventure', 1, profileModifiers(p), storyBattleOptions(p));
  const heroic = new Battle('adventure', 1, profileModifiers(p), { ...storyBattleOptions(p), heroic: true });
  assert.equal(heroic.heroic, true);
  assert.equal(heroic.bossMax, Math.round(normal.bossMax * HEROIC_HP));
  assert.ok(Math.abs(heroic.enemyScale() / normal.enemyScale() - HEROIC_DMG) < 1e-9);
  assert.equal(heroic.potions, 1);
  assert.equal(new Battle('raid', 1, profileModifiers(p), { heroic: true }).heroic, false, 'only story chapters go Heroic');
});

test('refining spends gold and materials and raises gear stats by REFINE_STEP per level', () => {
  const p = createProfile(); p.gold = 5000; p.economy.gold = 5000;
  const gear = GEAR.find(g => g.id === 'iron-edge')!;
  assert.equal(refineGear(p, 0, gear.id), false, 'must own the gear');
  assert.equal(equipGear(p, 0, gear.id), true);
  assert.equal(refineGear(p, 0, gear.id), false, 'needs materials');
  bankPouch(p, { gold: 0, materials: { 'ember-shard': 2, 'bell-bronze': 3, 'frost-glass': 4 } });
  for (let level = 0; level < MAX_REFINE; level++) {
    const cost = refineCost(gear.id, level)!, gold = p.gold;
    assert.equal(refineGear(p, 0, gear.id), true, `refine to +${level + 1}`);
    assert.equal(p.gold, gold - cost.gold);
  }
  assert.equal(p.loadouts[0].refine?.[gear.id], MAX_REFINE);
  assert.equal(refineGear(p, 0, gear.id), false, 'capped');
  assert.deepEqual(Object.values(p.economy.materials).filter(n => n > 0), []);
  const base = gearStats({ weapon: gear.id }), refined = gearStats({ weapon: gear.id }, { [gear.id]: MAX_REFINE });
  assert.ok(gear.power > 0);
  assert.ok(Math.abs((refined.power - 1) - (base.power - 1) * (1 + REFINE_STEP * MAX_REFINE)) < 1e-9, 'power bonus scales by the refine step');
  const restored = normalizeProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.loadouts[0].refine?.[gear.id], MAX_REFINE, 'refine survives a save round trip');
});

test('party power grows with progress and the recommendation follows the campaign', () => {
  const p = createProfile(), before = partyPower(p);
  assert.ok(before > 200 && before < 400, `fresh party ~300, got ${before}`);
  p.loadouts[0].xp = 5000;
  assert.ok(partyPower(p) > before);
  assert.ok(RECOMMENDED_POWER.every((v, i) => i === 0 || v > RECOMMENDED_POWER[i - 1]), 'recommendation rises each chapter');
  assert.equal(recommendedPower(-3), RECOMMENDED_POWER[0]);
  assert.equal(recommendedPower(99), RECOMMENDED_POWER.at(-1));
  assert.equal(powerVerdict(100, 100), 'ready');
  assert.equal(powerVerdict(88, 100), 'close');
  assert.equal(powerVerdict(50, 100), 'under');
  const b = new Battle('raid', 1, undefined, { roster: [0], loadouts: p.loadouts });
  assert.ok(heroPower(b.heroes[0]) > 100);
});

test('dungeon battles carry HP, potions and blessings in and grant room XP', () => {
  const p = createProfile(), run = startRun(1, 5, [0, 4, 3]);
  enterNode(run, reachable(run)[0]);
  const scale = fightScale(run, 'elite'), xp = dungeonXP(run, 'elite');
  const b = new Battle('dungeon', scale.chapter, profileModifiers(p), { ...storyBattleOptions(p), enemyId: 'spider', dungeon: { chapter: scale.chapter, hp: scale.hp, damage: scale.damage, xp, startHp: { 0: .5, 4: 0, 3: 1 }, potions: 1, power: 1.2, vitality: 1 } });
  const hero = (id: number) => b.heroes.find(h => h.id === id)!;
  assert.equal(b.mode, 'dungeon');
  assert.equal(hero(0).hp, Math.round(hero(0).maxHp * .5));
  assert.equal(hero(4).hp, 0, 'a fallen hero stays down');
  assert.equal(b.potions, 1);
  assert.ok(b.bossMax > 0);
  b.start(); b.bossHp = 0; b.tick(1 / 60);
  assert.equal(b.status, 'victory');
  assert.equal(b.gold, 0, 'dungeon gold goes to the pouch, not the battle');
  const before = p.loadouts[0].xp ?? 0;
  settleProgress(p, b);
  assert.ok((p.loadouts[0].xp ?? 0) > before, 'room XP is granted');
});

test('the journey and an active dungeon run survive the Commander story slot', () => {
  const p = createProfile(); p.cleared = [0, 1];
  p.journey.stars = { 0: 3, 1: 2 }; p.journey.heroic = [0]; p.journey.depth = 1;
  p.journey.run = startRun(1, 11, [0, 4, 3]);
  const state = storyStateFromProfile(p);
  const doc = createCommanderDocument(p, 'QA');
  const back = materializeProfile(doc, 'story');
  assert.deepEqual(state.journey?.stars, { 0: 3, 1: 2 });
  assert.deepEqual(back.journey.stars, { 0: 3, 1: 2 });
  assert.deepEqual(back.journey.heroic, [0]);
  assert.equal(back.journey.run?.depth, 1);
  assert.equal(back.journey.run?.nodes.length, p.journey.run.nodes.length);
});
