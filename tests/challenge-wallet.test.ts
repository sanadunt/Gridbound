import assert from 'node:assert/strict';
import test from 'node:test';
import { BANK_SHOP, BELL_TONIC, CHALLENGE_SHOP, FATE_RELIC, RELIC_IDS, WARD_RELIC, boonDraftSize, buyBankItem, buyBellTonic, refundBellTonic, buyRunItem, createRunWallet, creditRun, normalizeChallengeUnlocks, raidReward, roguelikeBankReward, validateRaidContract } from '../src/economy/challenge';
import { createCurrencyState } from '../src/economy/currency';
import { Battle, WARD_RELIC_BARRIER } from '../src/game/simulation';
import { boonChoices } from '../src/game/world';

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

test('WP3: the Ward Relic gives every Roguelike floor +1 potion and a 15% opening barrier', () => {
  const plain = new Battle('endless', 1), ward = new Battle('endless', 4, undefined, { relics: [WARD_RELIC] });
  assert.equal(plain.potions, 2);
  assert.equal(ward.potions, 3);
  assert.ok(plain.heroes.every(hero => hero.shield === 0));
  ward.heroes.forEach(hero => assert.ok(Math.abs(hero.shield - hero.maxHp * WARD_RELIC_BARRIER) < 1e-6));
  // Relics belong to the Roguelike only.
  assert.equal(new Battle('raid', 1, undefined, { relics: [WARD_RELIC] }).potions, 2);
  assert.equal(new Battle('adventure', 1, undefined, { relics: [WARD_RELIC] }).heroes[0].shield, 0);
});

test('WP3: the Fate Relic adds a fourth boon to every draft', () => {
  assert.equal(boonDraftSize([]), 3);
  assert.equal(boonDraftSize([WARD_RELIC]), 3);
  assert.equal(boonDraftSize([FATE_RELIC]), 4);
  const three = boonChoices([], 77, boonDraftSize([])), four = boonChoices([], 77, boonDraftSize([FATE_RELIC]));
  assert.equal(three.length, 3);
  assert.equal(four.length, 4);
  assert.deepEqual(four.slice(0, 3), three, 'the same seed keeps the first three cards');
});

test('WP3: Bell Tonic is a repeatable bank-Crystal sink that adds a potion to a Raid or Roguelike start', () => {
  const tonic = BANK_SHOP.find(item => item.id === BELL_TONIC)!;
  assert.equal(tonic.consumable, true);
  assert.ok(!RELIC_IDS.includes(BELL_TONIC));
  const state = createCurrencyState();
  state.commanderCrystal = tonic.cost * 2;
  assert.equal(buyBankItem(state, BELL_TONIC), null, 'not a permanent unlock');
  assert.equal(buyBellTonic(state, 'raid'), 1);
  assert.equal(buyBellTonic(state, 'roguelike'), 1);
  assert.equal(state.commanderCrystal, 0);
  assert.equal(buyBellTonic(state, 'raid'), 0, 'unaffordable');
  assert.equal(refundBellTonic(state, 'raid'), true, 'a departure taken back before its first fight returns the tonic');
  assert.equal(state.commanderCrystal, tonic.cost);
  assert.equal(refundBellTonic(state, 'story' as never), false, 'Story never holds Crystal');
  assert.deepEqual(normalizeChallengeUnlocks([BELL_TONIC, WARD_RELIC]), [WARD_RELIC]);
  assert.equal(new Battle('raid', 1, undefined, { extraPotions: 1 }).potions, 3);
  assert.equal(new Battle('endless', 1, undefined, { extraPotions: 1, relics: [WARD_RELIC] }).potions, 4);
  assert.equal(new Battle('adventure', 1, undefined, { extraPotions: 1 }).potions, 2, 'Story never takes a tonic');
});
