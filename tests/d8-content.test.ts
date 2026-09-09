import test from 'node:test';
import assert from 'node:assert/strict';
import { D8_ADVANCED_PATHS, D8_THIRD_PATHS, D8_ULTRAS } from '../src/game/d8-content';

test('D8 catalog has the approved authored counts and unique IDs', () => {
  assert.equal(new Set(D8_ADVANCED_PATHS.map(item => item.id)).size, 18);
  assert.equal(new Set(D8_THIRD_PATHS.map(item => item.id)).size, 18);
  assert.equal(new Set(D8_ULTRAS.map(item => item.id)).size, 32);
  for (const item of [...D8_ADVANCED_PATHS, ...D8_THIRD_PATHS]) {
    assert.ok(item.id && item.heroId !== undefined && item.baseClass && item.name && item.description);
  }
  for (const item of D8_ULTRAS) {
    assert.ok(item.id && item.ownerHeroId !== undefined && item.gate && item.effect && item.icon && item.testHook);
  }
});
