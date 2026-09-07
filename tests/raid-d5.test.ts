import assert from 'node:assert/strict';
import test from 'node:test';
import { Battle } from '../src/game/simulation';
import { createProfile, settleProgress } from '../src/game/profile';
import {
  RAID_MODIFIERS,
  getRaidContractForEnemy,
  raidReward,
  validateRaidContract,
} from '../src/economy/challenge';
import {
  createRaidBuild,
  normalizeRaidBuild,
  setRaidJob,
  setRaidPartySize,
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
