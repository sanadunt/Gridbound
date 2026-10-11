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

test('BattleScene keeps BREAK for armour breaks and gives stun, interrupt and KO their own feedback', () => {
  assert.match(source, /e\.type==='break'\)\{this\.setBossCue\('break'/);
  assert.match(source, /e\.type==='stun'\)/);
  assert.match(source, /e\.type==='interrupt'\)/);
  assert.match(source, /e\.type==='down'\)\{/);
  assert.match(source, /'interrupt','down','enrage'\]\.includes\(e\.type\)/, 'KO, interrupt and enrage reach the HUD banner');
  assert.match(source, /e\.type==='impact'\|\|e\.type==='stun'\)window\.dispatchEvent\(new CustomEvent\('battle-log'/, 'stun notes reach the HUD status strip and log');
  assert.doesNotMatch(source, /floating\(300,128,/, 'no stun text above the boss, where the intel band covers it on short phones');
  assert.match(source, /e\.slot===undefined\?300:/, 'boss status cast texts float between the boss and the grid');
  assert.match(source, /else if\(e\.targets\?\.length\)this\.addShake\(\.18\)/, 'a finished channel (no tiles) does not shake the screen');
});

test('hit feedback is relative and bounded: crit cue, shake budget, PACT style without a flash', () => {
  assert.match(source, /this\.hits\.crit\(/);
  assert.match(source, /if\(crit\)cue='crit'/);
  assert.doesNotMatch(source, /amount>=110/, 'no absolute crit threshold');
  assert.doesNotMatch(source, /this\.shake=\.|this\.shake = 0\./, 'every shake goes through the per-second budget');
  assert.match(source, /e\.type==='hurt'&&e\.text==='PACT'\)\{[^}]*\}/);
  assert.doesNotMatch(source.match(/e\.type==='hurt'&&e\.text==='PACT'\)\{([^}]*)\}/)![1], /screenFlash|addShake/);
});
