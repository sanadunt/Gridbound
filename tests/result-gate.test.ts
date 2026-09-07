import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResultGate } from '../src/ui/result-gate';

test('result choices require a full second on every presentation', () => {
  const gate = new ResultGate();
  assert.equal(gate.allows(0), false);
  gate.open(500);
  assert.equal(gate.allows(1499), false);
  assert.equal(gate.allows(1500), true);
  gate.open(2000);
  assert.equal(gate.allows(2500), false);
  assert.equal(gate.allows(3000), true);
  gate.close();
  assert.equal(gate.allows(99999), false);
  assert.equal(gate.allows(Number.POSITIVE_INFINITY), false);
});

test('a closed gate rejects non-finite clock readings', () => {
  const gate = new ResultGate();
  assert.equal(gate.allows(Number.POSITIVE_INFINITY), false);
  assert.equal(gate.allows(Number.NaN), false);

  gate.open(Number.POSITIVE_INFINITY);
  assert.equal(gate.allows(10_000), false);
  assert.equal(gate.allows(Number.POSITIVE_INFINITY), false);

  gate.open(Number.NaN);
  assert.equal(gate.allows(10_000), false);
});

test('a stale presentation token cannot unlock a replacement presentation', () => {
  const gate = new ResultGate();
  const firstPresentation = gate.open(0);

  const replacementPresentation = gate.open(2_000);

  assert.equal(gate.allows(3_000), true);
  assert.equal(gate.allows(3_000, replacementPresentation), true);
  assert.equal(gate.allows(3_000, firstPresentation), false);
});
