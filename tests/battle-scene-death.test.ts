import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/render/BattleScene.ts', import.meta.url)), 'utf8');

test('BattleScene exposes an awaitable enemy-death readiness contract', () => {
  assert.match(source, /public isEnemyDeathAnimationComplete\(\): boolean/);
  assert.match(source, /public waitForEnemyDeathAnimation\(\): Promise<void>/);
});

test('enemy death animation has a bounded normal and reduced-motion duration', () => {
  const normal = Number(source.match(/ENEMY_DEATH_ANIMATION_MS\s*=\s*(\d+)/)?.[1]);
  const reduced = Number(source.match(/ENEMY_DEATH_ANIMATION_REDUCED_MS\s*=\s*(\d+)/)?.[1]);
  assert.ok(normal >= 600 && normal <= 900, `normal duration should be 600-900ms, got ${normal}`);
  assert.ok(reduced > 0 && reduced < normal, `reduced duration should be shorter, got ${reduced}`);
});

test('terminal victory effects stop spawning ambient particles and reset on replacement', () => {
  assert.match(source, /b\.status!=='victory'&&b\.status!=='defeat'/);
  assert.match(source, /replace\(battle:Battle\)[\s\S]*?resetEnemyDeathAnimation\(\)/);
});
