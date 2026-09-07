import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCurrencyState,
  creditCurrency,
  debitCurrency,
  type CurrencyState,
} from '../src/economy/currency';

test('D1: a fresh profile carries an isolated Story economy and shared challenge wallet', async () => {
  const { createProfile } = await import('../src/game/profile');
  const profile = createProfile();

  assert.deepEqual(profile.economy, {
    gold: 60,
    materials: {},
    commanderCrystal: 0,
  });
});

test('D1: Raid and Roguelike share the Commander Crystal wallet', () => {
  const state = createCurrencyState();

  assert.equal(creditCurrency(state, 'raid', 'crystal', 25), true);
  assert.equal(state.commanderCrystal, 25);
  assert.equal(debitCurrency(state, 'roguelike', 'crystal', 10), true);
  assert.equal(state.commanderCrystal, 15);
});

test('D1: Story cannot credit or debit Crystal', () => {
  const state = createCurrencyState();

  assert.equal(creditCurrency(state, 'story', 'crystal', 25), false);
  assert.equal(debitCurrency(state, 'story', 'crystal', 1), false);
  assert.equal(state.commanderCrystal, 0);
});

test('D1: Story Gold and materials stay outside the Crystal wallet', () => {
  const state: CurrencyState = createCurrencyState();

  assert.equal(creditCurrency(state, 'story', 'gold', 100), true);
  assert.equal(creditCurrency(state, 'story', 'material:ember-resin', 3), true);
  assert.equal(state.gold, 100);
  assert.equal(state.materials['ember-resin'], 3);
  assert.equal(state.commanderCrystal, 0);
});

test('D1: v3 normalization preserves valid wallet balances and defaults missing economy safely', async () => {
  const { createProfile, normalizeProfile } = await import('../src/game/profile');
  const base = createProfile();
  const restored = normalizeProfile({ ...base, economy: { gold: 125, materials: { 'ember-resin': 4 }, commanderCrystal: 37 } });
  assert.deepEqual(restored.economy, { gold: 125, materials: { 'ember-resin': 4 }, commanderCrystal: 37 });
  const { economy: _ignored, ...legacyShape } = base;
  const legacy = normalizeProfile({ ...legacyShape, gold: 90 });
  assert.deepEqual(legacy.economy, { gold: 90, materials: {}, commanderCrystal: 0 });
});

test('D1: invalid amounts and insufficient balances are rejected without mutation', () => {
  const state = createCurrencyState();

  assert.equal(creditCurrency(state, 'raid', 'crystal', 0), false);
  assert.equal(creditCurrency(state, 'raid', 'crystal', -2), false);
  assert.equal(debitCurrency(state, 'raid', 'crystal', 1), false);
  assert.deepEqual(state, createCurrencyState());
});
