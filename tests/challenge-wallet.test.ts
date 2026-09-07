import assert from 'node:assert/strict';
import test from 'node:test';
import { BANK_SHOP, CHALLENGE_SHOP, buyBankItem, buyRunItem, createRunWallet, creditRun, raidReward, roguelikeBankReward, validateRaidContract } from '../src/economy/challenge';
import { createCurrencyState } from '../src/economy/currency';

test('D2: run purse starts separately and shop spends only run purse', () => {
  const run = createRunWallet(0);
  const bank = createCurrencyState();
  bank.commanderCrystal = 60;
  assert.equal(run.crystal, 0);
  assert.equal(buyRunItem(run, 'run-heal'), null);
  assert.equal(creditRun(run, 10), true);
  assert.equal(buyRunItem(run, 'run-heal')?.id, 'run-heal');
  assert.equal(run.crystal, 2);
  assert.equal(bank.commanderCrystal, 60);
});

test('D2: bank shop is explicit and never reads Story Gold', () => {
  const state = createCurrencyState();
  state.gold = 1000;
  assert.equal(buyBankItem(state, CHALLENGE_SHOP[0].id), null);
  state.commanderCrystal = BANK_SHOP[0].cost;
  assert.equal(buyBankItem(state, BANK_SHOP[0].id)?.id, 'bank-relic-ward');
  assert.equal(state.gold, 1000);
  assert.equal(state.commanderCrystal, 0);
});

test('D2: validated Raid contracts pay by tier and Sandbox pays zero', () => {
  const certified = validateRaidContract({ id: 'dragon-gold', tier: 'gold', bossId: 'dragon', riskPoints: 6, validated: true });
  assert.equal(certified.sandbox, false);
  assert.equal(raidReward(certified), 42);
  assert.equal(raidReward(validateRaidContract({ id: 'custom', tier: 'gold', bossId: 'dragon', riskPoints: 99, validated: false })), 0);
});

test('D2: Roguelike bank reward follows act and final-clear seeds', () => {
  assert.equal(roguelikeBankReward(1), 6);
  assert.equal(roguelikeBankReward(2), 8);
  assert.equal(roguelikeBankReward(3), 12);
  assert.equal(roguelikeBankReward(3, true), 22);
});

test('D2: a run purse cannot be transferred into the persistent bank', () => {
  const run = createRunWallet(30);
  const bank = createCurrencyState();
  assert.equal(creditRun(run, 5), true);
  assert.equal(bank.commanderCrystal, 0);
  assert.equal(run.crystal, 35);
});

test('D2: only the authored contract can certify and contracts cannot be mutated by callers', () => {
  const authored = validateRaidContract({ id: 'dragon-gold', tier: 'gold', bossId: 'dragon', riskPoints: 6, validated: true });
  assert.equal(Object.isFrozen(authored), true);
  assert.equal(Reflect.set(authored as object, 'tier', 'bronze'), false);
  assert.equal(validateRaidContract({ id: 'dragon-gold', tier: 'gold', bossId: 'dragon', riskPoints: 99, validated: true }).sandbox, true);
  assert.equal(validateRaidContract({ id: 'dragon-gold', tier: 'gold', bossId: 'dragon', riskPoints: 6, validated: true, sandbox: true }).sandbox, true);
  assert.equal(validateRaidContract({ id: 'arbitrary', tier: 'gold', bossId: 'dragon', validated: true }).sandbox, true);
});

test('D2: unknown or non-boss enemy input is sandboxed and cannot select a rewarded boss', () => {
  const unknown = validateRaidContract({ id: 'custom', enemyId: 'not-a-boss', tier: 'gold', validated: true });
  assert.equal(unknown.sandbox, true);
  assert.equal(unknown.validated, false);
  assert.equal(raidReward(unknown), 0);
});

test('D2: bank unlock ownership is normalized to authored items', async () => {
  const { createProfile, buyChallengeUnlock, normalizeProfile } = await import('../src/game/profile');
  const profile = createProfile();
  profile.economy.commanderCrystal = BANK_SHOP[0].cost;
  assert.equal(buyChallengeUnlock(profile, BANK_SHOP[0].id)?.id, BANK_SHOP[0].id);
  assert.equal(profile.challengeUnlocks.includes(BANK_SHOP[0].id), true);
  assert.equal(buyChallengeUnlock(profile, BANK_SHOP[0].id), null);
  const restored = normalizeProfile({ ...profile, challengeUnlocks: [...profile.challengeUnlocks, 'forged-unlock'] });
  assert.deepEqual(restored.challengeUnlocks, [BANK_SHOP[0].id]);
});
