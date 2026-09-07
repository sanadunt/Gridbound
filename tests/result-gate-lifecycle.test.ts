import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResultGate, RESULT_INPUT_DELAY_MS } from '../src/ui/result-gate';

test('result lock closes permanently after its one-second window', () => {
  const gate = new ResultGate();
  const generation = gate.open(1000);
  assert.equal(gate.allows(1000 + RESULT_INPUT_DELAY_MS - 1, generation), false);
  assert.equal(gate.allows(1000 + RESULT_INPUT_DELAY_MS, generation), true);
  gate.close();
  assert.equal(gate.allows(Number.MAX_SAFE_INTEGER, generation), false);
  assert.equal(gate.allows(Number.MAX_SAFE_INTEGER), false);
});
