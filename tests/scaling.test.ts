import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, CHAPTER_HP, CHAPTER_DMG, POTION_HEAL, ULT_BASE, ULT_DAMAGE, ULT_HEAL, ULT_SHIELD, RESOLVE_DEALT, RESOLVE_TAKEN, STAGGER_SHARE, STAGGER_CAP, STAGGER_CAP_GROWTH, BREAK_SECONDS, MINION_FIRST, MINION_HP, ENDLESS_DMG, ENDLESS_DMG_GROWTH, ENDLESS_EARLY_DMG, ENDLESS_EARLY_FLOORS, HEROIC_HP, HEROIC_DMG, heroicScale } from '../src/game/simulation';
import { DEPTH_DMG, DEPTHS, GUARDIAN_HP, FIGHT_DMG, CAMP_REST, startRun, fightScale } from '../src/game/dungeon';
import { createProfile } from '../src/game/profile';
import { setStoryParty } from '../src/game/story-party';
import { partyPower } from '../src/game/power';
import { CAMPAIGN } from '../src/game/world';
import { xpForLevel } from '../src/game/levels';
import { JOBS } from '../src/game/jobs';
import { heroPower, REF_PARTY } from '../src/game/power';
import { KITS, ROSTER } from '../src/game/content';

// WP8: the party's tools and the boss's threats are measured against the fight, so they matter as much in chapter 16 as in chapter 1.
const party = (level: number) => Object.fromEntries([0, 4, 3].map(id => [id, { skills: [0, 1], talents: [], xp: xpForLevel(level) }])), party3 = party;
const story = (chapter: number, level: number, stage = 0) => { const b = new Battle('adventure', chapter, undefined, { roster: [0, 4, 3], loadouts: party(level), stage }); b.start(); return b; };
const chapterBoss = (ch: number) => CAMPAIGN[ch - 1].stages.at(-1)!.hp * CHAPTER_HP[ch - 1];
const near = (a: number, b: number, eps = 1e-6, msg?: string) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} != ${b}`);
const ENDS: [number, number][] = [[1, 1], [16, 22]];

test('a potion heals the same share of every hero max HP in chapter 1 and chapter 16', () => {
  for (const [ch, lv] of ENDS) { const b = story(ch, lv); for (const h of b.heroes) { h.hp = 1; h.shield = 0; } assert.ok(b.potion()); for (const h of b.heroes) near(h.hp, 1 + h.maxHp * POTION_HEAL); }
});

test('Ninefold Dawn hits for a share of the boss and heals and shields a share of each hero', () => {
  for (const [ch, lv] of ENDS) {
    const b = story(ch, lv, CAMPAIGN[ch - 1].stages.length - 1);for (const h of b.heroes) { h.hp = 1; h.shield = 0; }
    b.resolve = 100; const before = b.bossHp; assert.ok(b.ultimate());
    assert.equal(before - b.bossHp, Math.round(ULT_BASE + b.bossMax * ULT_DAMAGE));
    for (const h of b.heroes) { near(h.hp, 1 + h.maxHp * ULT_HEAL); near(h.shield, h.maxHp * ULT_SHIELD); }
  }
});

test('resolve fills by the share of the chapter boss dealt and of max HP taken, not by raw numbers', () => {
  const dealt = ENDS.map(([ch, lv]) => { const b = story(ch, lv); b.resolve = 0; b.hitBoss(Math.round(chapterBoss(ch) * .1), 0, 'test'); return b.resolve; });
  for (const r of dealt) near(r, .1 * RESOLVE_DEALT, .01);
  // Damage taken counts against the whole party's HP, so a bigger party does not fill the meter faster just by being hit more often.
  for (const [ch, lv] of ENDS) for (const roster of [[0, 4, 3], [0, 1, 2, 3, 4, 5, 6, 7]]) {
    const b = new Battle('adventure', ch, undefined, { roster, loadouts: Object.fromEntries(roster.map(id => [id, { skills: [0, 1], talents: [], xp: xpForLevel(lv) }])), storyCleared: Array.from({ length: 12 }, (_, i) => i), storyRecruited: roster });
    b.start(); const total = b.heroes.reduce((s, h) => s + h.maxHp, 0); b.resolve = 0;
    for (const h of b.heroes) { h.shield = 0; b.hurt(h, h.maxHp * .1); }
    near(b.resolve, .1 * RESOLVE_TAKEN, 1e-9, `every hero losing 10% fills ${(.1 * RESOLVE_TAKEN).toFixed(1)} resolve (${ch}, ${roster.length} heroes, ${total} HP)`);
  }
});

test('the stagger bar is a share of the boss, capped per chapter, and a break lasts BREAK_SECONDS', () => {
  for (const [ch, lv] of ENDS) {
    const b = story(ch, lv, CAMPAIGN[ch - 1].stages.length - 1);
    assert.equal(b.staggerThreshold(), Math.min(b.bossMax * STAGGER_SHARE, STAGGER_CAP * Math.pow(STAGGER_CAP_GROWTH, ch - 1)));
    assert.ok(b.staggerThreshold() > 800 || ch === 1, 'late bosses are no longer capped at the old flat 800');
    b.stagger = b.staggerThreshold(); b.addStagger(1); assert.equal(b.breakLeft, BREAK_SECONDS);
  }
});

test('minions strike soon after they appear and carry a share of the chapter boss HP', () => {
  for (const [ch, lv] of ENDS) {
    const b = story(ch, lv); b.minions = []; assert.ok(b.summon() > 0);
    for (const m of b.minions) { assert.equal(m.timer, MINION_FIRST); assert.equal(m.hp, Math.round(MINION_HP * chapterBoss(ch))); }
  }
});

test('Mending Light party heal grows with the healer power', () => {
  const heal = (level: number) => { const b = story(1, level), lyra = b.hero(4)!; for (const h of b.heroes) { h.hp = h.maxHp / 2; } b.hero(0)!.hp = 1; const before = b.hero(3)!.hp; b.act(lyra); return b.hero(3)!.hp - before; };
  near(heal(1), 20); assert.ok(heal(20) > 20 * 1.9, 'a level-20 healer tops the party up by more than the level-1 flat 20');
});

test('party power reads the stance skill and values utility by party size', () => {
  const power = (skills: number[], job?: string, roster = [0, 4, 3]) => { const b = new Battle('raid', 1, undefined, { roster, loadouts: { 0: { skills, talents: [], job, xp: xpForLevel(10) } } }); return heroPower(b.heroes.find(h => h.id === 0)!, roster.length); };
  assert.ok(power([JOBS.warlord.index, 0], 'warlord') > power([0, 1], 'warlord') * 1.3, 'a tier-3 attack skill rates well above Cleave');
  assert.ok(power([JOBS.aegis.index, 0], 'aegis', [0, 1, 2, 3, 4, 5, 6, 7]) > power([JOBS.aegis.index, 0], 'aegis'), 'a party shield is worth more to a bigger party');
  // The same party rates higher once its paid job skills are the stance (the old meter only counted the job itself).
  const p = createProfile(); p.cleared = [0, 1, 2, 3]; p.roster = [0, 4, 3, 2, 7];
  for (const id of p.roster) p.loadouts[id] = { ...p.loadouts[id] ?? { skills: [0, 1], talents: [] }, xp: xpForLevel(12) };
  p.loadouts[0].job = 'berserker'; p.loadouts[3].job = 'marksman'; p.loadouts[7].job = 'elementalist';
  assert.ok(setStoryParty(p, p.roster));
  const basic = partyPower(p);
  for (const [id, job] of [[0, 'berserker'], [3, 'marksman'], [7, 'elementalist']] as const) p.loadouts[id].skills = [JOBS[job].index, 0];
  assert.ok(partyPower(p) > basic * 1.1, `job skills raise party power (${basic} -> ${partyPower(p)})`);
});

test('a hero never rates lower in a bigger party, whatever skill it fights with', () => {
  for (const [classId, kit] of Object.entries(KITS)) {
    const id = ROSTER.findIndex(r => r.classId === classId);
    for (let i = 0; i < kit.skills.length; i++) {
      const job = Object.values(JOBS).find(j => j.base === classId && j.index === i)?.id;
      const h = new Battle('raid', 1, undefined, { roster: [id], loadouts: { [id]: { skills: [i, 0], talents: [], xp: xpForLevel(10), job } } }).heroes[0];
      for (let n = 1; n < 8; n++) assert.ok(heroPower(h, n + 1) >= heroPower(h, n), `${kit.skills[i].name} rates ${heroPower(h, n)} with ${n} heroes but ${heroPower(h, n + 1)} with ${n + 1}`);
    }
    const fresh = new Battle('raid', 1, undefined, { roster: [id], loadouts: { [id]: { skills: [0, 1], talents: [] } } }).heroes[0];
    assert.equal(heroPower(fresh, REF_PARTY), 100, `a fresh ${classId} on its first skill rates 100`);
  }
});

test('the difficulty tables are smooth: no damage spike or cliff, boss HP never falls, HP steps of at most 20% inside an act', () => {
  const d = CHAPTER_DMG, step = 1.2 + .01;
  // From chapter 6 on each chapter is within 20% of the one before; chapters 2-5 (Act I and the step into Act II) may rise further
  // (the party's early levels, gear, jobs and sixth hero grow it faster), but no chapter is ever 20% softer than the last.
  for (let i = 1; i < d.length; i++) assert.ok(d[i - 1] <= d[i] * step, `CHAPTER_DMG falls more than 20% at chapter ${i + 1}`);
  for (let i = 5; i < d.length; i++) assert.ok(d[i] <= d[i - 1] * step, `CHAPTER_DMG rises more than 20% at chapter ${i + 1}`);
  assert.ok(d[6] / d[5] < 1.25 && d[12] / d[11] < 1.25, 'the old chapter 6->7 and 12->13 damage spikes are gone');
  const boss = (i: number) => CAMPAIGN[i].stages.at(-1)!.hp * CHAPTER_HP[i];
  for (let i = 1; i < CHAPTER_HP.length; i++) {
    assert.ok(boss(i) >= boss(i - 1), `chapter ${i + 1}'s boss has less HP than chapter ${i}'s`);
    if (Math.floor(i / 4) === Math.floor((i - 1) / 4)) assert.ok(CHAPTER_HP[i] / CHAPTER_HP[i - 1] <= step && CHAPTER_HP[i - 1] / CHAPTER_HP[i] <= step, `CHAPTER_HP step at chapter ${i + 1}`);
  }
  assert.ok(CHAPTER_HP[0] <= 2.25, 'the first boss is softened');
});

test('Roguelike floors that pay Crystal hit harder, fading out before the deep floors', () => {
  const scale = (floor: number) => new Battle('endless', floor).enemyScale(), base = (floor: number) => ENDLESS_DMG * Math.pow(ENDLESS_DMG_GROWTH, floor - 1);
  for (let floor = 1; floor <= ENDLESS_EARLY_FLOORS; floor++) near(scale(floor), base(floor) * ENDLESS_EARLY_DMG, 1e-9);
  for (const floor of [ENDLESS_EARLY_FLOORS + 3, 20, 30]) near(scale(floor), base(floor), 1e-9);
  for (let floor = 2; floor <= 30; floor++) assert.ok(scale(floor) > scale(floor - 1), `floor ${floor} is never softer than the floor above`);
});

test('Heroic eases its bonus in Act IV only, and the dossier numbers come from the same scale', () => {
  for (const ch of [1, 8, 12]) assert.deepEqual(heroicScale(ch), { hp: HEROIC_HP, dmg: HEROIC_DMG });
  const late = heroicScale(16);assert.ok(late.hp < HEROIC_HP && late.hp > 1 && late.dmg < HEROIC_DMG && late.dmg > 1);
  const party = { roster: [0, 4, 3], loadouts: party3(20), storyCleared: Array.from({ length: 16 }, (_, i) => i) };
  const normal = new Battle('adventure', 16, undefined, party), heroic = new Battle('adventure', 16, undefined, { ...party, heroic: true });
  assert.equal(heroic.bossMax, Math.round(normal.bossMax * late.hp));
  near(heroic.enemyScale() / normal.enemyScale(), late.dmg, 1e-9);
});

test('Undercroft depths never get softer, guardians are tougher and the camp only rests 25%', () => {
  for (let i = 1; i < DEPTH_DMG.length; i++) assert.ok(DEPTH_DMG[i] >= DEPTH_DMG[i - 1], `depth ${i + 1} hits softer than depth ${i}`);
  assert.equal(DEPTH_DMG.length, DEPTHS.length);
  assert.ok(GUARDIAN_HP >= .85 * 1.25, 'guardians carry about 1.3x their old HP');
  assert.ok(FIGHT_DMG.guardian > FIGHT_DMG.battle && FIGHT_DMG.guardian < FIGHT_DMG.elite, 'a guardian hits harder than an ordinary room');
  assert.equal(CAMP_REST, .25);
  for (const d of DEPTHS) {
    const run = startRun(d.id, 3, [0, 4, 3]), boss = CAMPAIGN[d.unlock - 1].stages.at(-1)!.hp;
    for (const kind of ['battle', 'elite', 'guardian'] as const) assert.equal(fightScale(run, kind).damage, DEPTH_DMG[d.id - 1] * FIGHT_DMG[kind], 'room damage is the depth\'s own, not the chapter table');
    assert.equal(fightScale(run, 'guardian').hp, boss * GUARDIAN_HP * 1.45);
  }
  // The Battle uses the room's damage as is.
  const run = startRun(4, 3, [0, 4, 3]), scale = fightScale(run, 'elite');
  const b = new Battle('dungeon', scale.chapter, undefined, { roster: [0, 4, 3], enemyId: 'knight', dungeon: { chapter: scale.chapter, hp: scale.hp, damage: scale.damage, xp: 0 } });
  near(b.enemyScale(), scale.damage, 1e-9);
});
