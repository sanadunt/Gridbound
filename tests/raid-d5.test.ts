import assert from 'node:assert/strict';
import test from 'node:test';
import { Battle } from '../src/game/simulation';
import { Battle as SimBattle, RAID_TIER_SCALE } from '../src/game/simulation';
import { createProfile, completeZone, settleProgress } from '../src/game/profile';
import { KITS, ROSTER } from '../src/game/content';
import { xpForLevel } from '../src/game/levels';
import {
  CERTIFIED_RAID_MODIFIER_COMBOS,
  IMPLEMENTED_RAID_MODIFIERS,
  RAID_CONTRACTS,
  RAID_MODIFIERS,
  getRaidContractForEnemy,
  raidModifierAvailable,
  sandboxRaidContract,
  raidReward,
  validateRaidContract,
  type RaidModifierId,
  type RaidTier,
} from '../src/economy/challenge';
import {
  createRaidBuild,
  defaultRaidBuild,
  normalizeRaidBuild,
  openRaidQuarry,
  raidQuarryUnlocked,
  setRaidHero,
  setRaidJob,
  setRaidPartySize,
  validRaidBuild,
} from '../src/game/raid-build';

function win(battle: Battle) {
  battle.start();
  battle.bossHp = 0;
  battle.tick(0.05);
  assert.equal(battle.status, 'victory');
  return battle;
}

test('D5: only calibrated authored modifier combos are rewarded', () => {
  assert.equal(RAID_MODIFIERS.length, 8);
  const base = getRaidContractForEnemy('dragon', 'gold');
  const certified = getRaidContractForEnemy('dragon', 'gold', ['RM01']);
  assert.equal(base?.sandbox, false);
  assert.equal(certified?.sandbox, false);
  assert.deepEqual(certified?.modifiers, ['RM01']);
  assert.ok(raidReward(certified, 'dragon') > raidReward(base, 'dragon'));

  const unsupported = validateRaidContract({
    id: base?.id,
    tier: 'gold',
    bossId: 'dragon',
    riskPoints: base?.riskPoints,
    validated: true,
    sandbox: false,
    modifiers: ['RM08'],
  });
  assert.equal(unsupported.sandbox, true);
  assert.equal(unsupported.validated, false);
  assert.equal(raidReward(unsupported, 'dragon'), 0);
});

test('D5: raw sliders force Sandbox even when an authored contract is supplied', () => {
  const profile = createProfile();
  const authored = getRaidContractForEnemy('dragon', 'gold');
  const battle = win(new Battle('raid', 1, undefined, {
    roster: profile.roster,
    loadouts: profile.loadouts,
    raidContract: authored,
    raidSandbox: { hpScale: 1.4, damageScale: 1.1, intervalScale: 0.9 },
    settlementId: 'd5-sandbox-settlement',
  }));
  assert.equal(battle.raidContract?.sandbox, true);
  assert.equal(raidReward(battle.raidContract, battle.enemyId), 0);
  assert.equal(settleProgress(profile, battle)?.length, profile.roster.length);
  assert.equal(profile.economy.commanderCrystal, 0);
});

test('D5: Raid build supports one to six temporary slots and duplicate basic jobs', () => {
  const roster = [0, 4, 3, 2, 7, 1];
  const build = createRaidBuild(roster, 1);
  assert.equal(build.slots.length, 1);
  assert.equal(setRaidPartySize(build, 6, roster), true);
  assert.equal(build.slots.length, 6);
  assert.equal(setRaidJob(build, 0, 'wizard'), true);
  assert.equal(setRaidJob(build, 1, 'wizard'), true);
  assert.deepEqual(build.slots.slice(0, 2).map(slot => slot.classId), ['wizard', 'wizard']);
  assert.equal(setRaidPartySize(build, 0, roster), false);
  assert.equal(normalizeRaidBuild({ slots: [...build.slots, { heroId: 0, classId: 'warrior' }] }, roster), undefined);
});

test('D5: custom Raid build does not mutate Story loadouts or Story party', () => {
  const profile = createProfile();
  const before = structuredClone({ loadouts: profile.loadouts, storyActive: profile.storyActive });
  const build = createRaidBuild([0, 4, 3], 3);
  assert.equal(setRaidJob(build, 0, 'wizard'), true);
  const battle = new Battle('raid', 1, undefined, {
    raidBuild: build,
    settlementId: 'd5-build-isolation',
  });
  assert.equal(battle.heroes.length, 3);
  assert.deepEqual(battle.heroes.map(hero => hero.classId), ['wizard', 'healer', 'archer']);
  assert.deepEqual({ loadouts: profile.loadouts, storyActive: profile.storyActive }, before);
});

// The shipped raid path (main.ts boot): whole roster + story loadouts + a raid build + an authored contract.
const raid = (tier: RaidTier = 'bronze', modifiers: RaidModifierId[] = [], extra: Partial<ConstructorParameters<typeof SimBattle>[3]> = {}, floor = 5) => {
  const p = createProfile();
  return new Battle('raid', floor, undefined, { roster: p.roster, loadouts: p.loadouts, enemyId: 'golem', raidContract: getRaidContractForEnemy('golem', tier, modifiers), raidBuild: createRaidBuild(p.roster, 3), ...extra });
};

test('WP3: raid heroes bring Story level, gear, talents and job; a raid class swap drops job and skills only', () => {
  const p = createProfile();
  for (let i = 0; i < 4; i++) completeZone(p, i);
  Object.assign(p.loadouts[0], { xp: xpForLevel(10), job: 'paladin', skills: [0, 4], talents: ['vigor'], inventory: ['iron-edge'], gear: { weapon: 'iron-edge' } });
  const options = { roster: p.roster, loadouts: p.loadouts, enemyId: 'golem', raidContract: getRaidContractForEnemy('golem'), raidBuild: createRaidBuild(p.roster, 3) };
  const hero = new Battle('raid', p.cleared.length + 1, undefined, options).hero(0)!;
  assert.equal(hero.level, 10);
  assert.equal(hero.job, 'paladin');
  assert.deepEqual(hero.skills, [0, 4]);
  assert.ok(hero.gearPower > 1.15, `gear and level power carry over (${hero.gearPower})`);
  assert.ok(hero.maxHp > KITS.warrior.hp * 1.18, 'level and vigor raise max HP');
  const swapped = createRaidBuild(p.roster, 3);
  assert.equal(setRaidJob(swapped, 0, 'wizard'), true);
  const wizard = new Battle('raid', p.cleared.length + 1, undefined, { ...options, raidBuild: swapped }).hero(0)!;
  assert.equal(wizard.classId, 'wizard');
  assert.equal(wizard.job, undefined, 'a warrior job never follows a wizard swap');
  assert.deepEqual(wizard.skills, [0, 1]);
  assert.equal(wizard.level, 10, 'level and gear stay with the hero');
  assert.ok(wizard.gearPower > 1.15);
});

test('WP3: contract tiers scale raid boss HP and damage; sandbox practice ignores the tier', () => {
  const bronze = raid('bronze'), silver = raid('silver'), gold = raid('gold');
  assert.ok(gold.bossMax > silver.bossMax && silver.bossMax > bronze.bossMax);
  assert.ok(Math.abs(gold.bossMax / bronze.bossMax - RAID_TIER_SCALE.gold.hp) < .001);
  assert.ok(Math.abs(gold.enemyScale() / bronze.enemyScale() - RAID_TIER_SCALE.gold.dmg) < 1e-9);
  assert.ok(silver.enemyScale() > bronze.enemyScale());
  const practice = raid('gold', [], { raidSandbox: { hpScale: 1, damageScale: 1, intervalScale: 1 } });
  assert.equal(practice.raidContract?.sandbox, true);
  assert.equal(practice.bossMax, bronze.bossMax);
  assert.equal(practice.enemyScale(), bronze.enemyScale());
});

test('WP3: RM01 cuts barrier gained during the raid by a quarter', () => {
  const shieldAfterUltimate = (modifiers: RaidModifierId[]) => { const b = raid('bronze', modifiers); b.start(); b.resolve = 100; assert.equal(b.ultimate(), true); return b.heroes.map(h => h.shield); };
  const plain = shieldAfterUltimate([]), fractured = shieldAfterUltimate(['RM01']);
  plain.forEach((value, i) => assert.ok(Math.abs(fractured[i] - value * .75) < 1e-6, `${fractured[i]} vs ${value}`));
  assert.ok(plain.every(value => value > 0));
});

test('WP3: RM05 summons a minion wave when the boss enters its next phase', () => {
  const phaseTwo = (modifiers: RaidModifierId[]) => { const b = raid('bronze', modifiers); b.start(); b.bossHp = Math.round(b.bossMax * .6); b.tick(1 / 60); return { minions: b.minions.length, summons: b.drain().filter(e => e.type === 'summon').length, phase: b.phase }; };
  assert.deepEqual(phaseTwo([]), { minions: 0, summons: 0, phase: 2 });
  const brood = phaseTwo(['RM05']);
  assert.equal(brood.phase, 2);
  assert.ok(brood.minions > 0);
  assert.equal(brood.summons, 1);
  // A summon that spawns nothing (every lane occupied) no longer announces reinforcements.
  const b = raid('bronze'); b.start(); b.summon(); b.drain();
  assert.equal(b.summon(), 0);
  assert.equal(b.drain().filter(e => e.type === 'summon').length, 0);
});

test('WP3: RM03 follows each all-grid impact with a telegraphed aftershock', () => {
  const afterRitual = (modifiers: RaidModifierId[]) => {
    const b = raid('bronze', modifiers); b.start();
    b.threats.push({ id: 900, name: 'WORLDLESS RITUAL', type: 'all', slots: Array.from({ length: 9 }, (_, i) => i), left: .01, total: 4.2, damage: 10 });
    b.tick(1 / 60);
    return b.threats.filter(t => t.name === 'AFTERSHOCK');
  };
  assert.equal(afterRitual([]).length, 0);
  const shocks = afterRitual(['RM03']);
  assert.equal(shocks.length, 1);
  assert.equal(shocks[0].type, 'meteor');
  assert.equal(shocks[0].slots.length, 1);
  assert.ok(shocks[0].left > 4, 'telegraphed, not instant');
});

test('WP3: only simulated modifiers are certified; RM06 and the other unbuilt pacts never pay', () => {
  assert.deepEqual([...IMPLEMENTED_RAID_MODIFIERS], ['RM01', 'RM02', 'RM03', 'RM05']);
  assert.ok(CERTIFIED_RAID_MODIFIER_COMBOS.every(combo => combo.every(raidModifierAvailable)));
  assert.ok(!CERTIFIED_RAID_MODIFIER_COMBOS.some(combo => combo.includes('RM06')));
  assert.ok(!RAID_CONTRACTS.some(contract => contract.modifiers.includes('RM06')));
  for (const id of ['RM04', 'RM06', 'RM07', 'RM08'] as const) {
    assert.equal(raidModifierAvailable(id), false);
    assert.equal(getRaidContractForEnemy('golem', 'gold', [id]), undefined);
  }
  assert.ok(RAID_MODIFIERS.some(modifier => modifier.id === 'RM06'), 'authored modifiers stay listed for the UI');
});

test('WP3: setRaidHero swaps in any recruited hero once, with that hero\'s own class', () => {
  const roster = [0, 4, 3, 2, 7];
  const build = createRaidBuild(roster, 3);
  assert.equal(setRaidHero(build, 1, 7, roster), true);
  assert.deepEqual(build.slots[1], { heroId: 7, classId: ROSTER[7].classId, slot: ROSTER[4].slot });
  assert.equal(setRaidHero(build, 0, 7, roster), false, 'a hero can fill only one slot');
  assert.equal(setRaidHero(build, 0, 5, roster), false, 'not recruited');
  assert.equal(setRaidHero(build, 3, 2, roster), false, 'no such slot');
  assert.equal(setRaidHero(build, 0, 0, roster), true, 'keeping the same hero is a no-op');
  assert.deepEqual(new Battle('raid', 1, undefined, { roster, raidBuild: build }).heroes.map(h => h.id), [0, 7, 3]);
});

test('WP3: resizing the raid party keeps the hero picks and gives new heroes a free tile', () => {
  const roster = [0, 4, 3, 2, 7, 1, 5];
  const build = createRaidBuild(roster, 3);
  assert.equal(setRaidHero(build, 0, 2, roster), true, 'Sable takes Aldric\'s tile 0');
  assert.equal(setRaidPartySize(build, 4, roster), true);
  assert.deepEqual(build.slots.map(slot => slot.heroId), [2, 4, 3, 0], 'picks stay, the first unpicked hero joins');
  assert.equal(validRaidBuild(build, roster), true);
  assert.equal(new Set(build.slots.map(slot => slot.slot)).size, 4, 'no two heroes share a tile');
  assert.equal(build.slots[0].slot, 0);
  assert.doesNotThrow(() => new Battle('raid', 1, undefined, { roster, raidBuild: build }));
  assert.equal(setRaidJob(build, 1, 'wizard'), true);
  assert.equal(setRaidPartySize(build, 2, roster), true);
  assert.deepEqual(build.slots.map(slot => [slot.heroId, slot.classId]), [[2, 'rogue'], [4, 'wizard']], 'shrinking keeps the first picks and their classes');
  assert.equal(setRaidPartySize(build, 8, roster), false);
  assert.equal(setRaidPartySize(createRaidBuild([0, 4], 2), 3, [0, 4]), false, 'not enough recruits');
});

test('WP3: default raid party fields the Story party first, on unique tiles', () => {
  const clash = createRaidBuild([0, 4, 9], 3);
  assert.equal(validRaidBuild(clash, [0, 4, 9]), true, 'Lyra and Tamsin share a home tile; Tamsin moves to a free one');
  assert.equal(new Set(clash.slots.map(slot => slot.slot)).size, 3);
  assert.deepEqual(defaultRaidBuild({ roster: [0, 4, 3, 2, 7], storyActive: [7, 2, 0] }).slots.map(slot => slot.heroId), [7, 2, 0]);
  assert.deepEqual(defaultRaidBuild({ roster: [0, 4] }).slots.map(slot => slot.heroId), [0, 4]);
});

test('WP3: practice with an uncertified pact combo still plays its pacts', () => {
  const battle = new Battle('raid', 1, undefined, { enemyId: 'golem', raidContract: sandboxRaidContract({ bossId: 'golem', tier: 'gold', modifiers: ['RM03', 'RM05'] }), raidSandbox: { hpScale: 1, damageScale: 1, intervalScale: 1 } });
  assert.equal(getRaidContractForEnemy('golem', 'gold', ['RM03', 'RM05']), undefined, 'not a certified combo');
  assert.equal(battle.raidContract?.sandbox, true);
  assert.deepEqual([...battle.raidContract!.modifiers], ['RM03', 'RM05']);
  assert.equal(battle.pact('RM05'), true);
  assert.equal(raidReward(battle.raidContract, battle.enemyId), 0);
});

test('WP3: raid quarries open with the story (first chapter, hunt quest or a recorded kill)', () => {
  const fresh = createProfile();
  assert.equal(raidQuarryUnlocked(fresh, 'wolf'), true, 'chapter-0 hunt quest');
  assert.equal(raidQuarryUnlocked(fresh, 'dragon'), false);
  assert.equal(raidQuarryUnlocked(fresh, 'choir-frost'), false, 'variants follow their archetype');
  assert.equal(openRaidQuarry(fresh, 'choir'), 'wolf');
  fresh.ledger.enemies.choir = 1;
  assert.equal(raidQuarryUnlocked(fresh, 'choir-frost'), true);
  const act1 = createProfile();
  for (let i = 0; i < 4; i++) completeZone(act1, i);
  assert.equal(raidQuarryUnlocked(act1, 'dragon'), true);
  assert.equal(raidQuarryUnlocked(act1, 'colossus'), false);
  assert.equal(raidQuarryUnlocked(act1, 'not-a-boss'), false);
});

test('WP3: pact raids stay deterministic', () => {
  const run = () => { const b = raid('gold', ['RM03'], {}, 9); b.start(); for (let i = 0; i < 60 * 90 && b.status === 'fighting'; i++) { if (i % 30 === 0) b.tap(b.heroes[i / 30 % 3]?.id ?? 0); b.tick(1 / 60); } return JSON.stringify(b.snapshot()); };
  assert.equal(run(), run());
});
