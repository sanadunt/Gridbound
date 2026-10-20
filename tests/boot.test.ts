import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// PERF (phone contract P1–P3, P6, P9): the first load paints a splash and the title without the engine; idle screens animate on the compositor.
const main = readFileSync('src/main.ts', 'utf8');
const css = (name: string) => readFileSync(`src/styles/${name}.css`, 'utf8');

test('main.ts never imports Phaser or the scene as a value: both come from startEngine()\'s dynamic import (P3)', () => {
  for (const line of main.split('\n').filter(l => /^import\b/.test(l))) {
    if (/from 'phaser'|from '\.\/render\/BattleScene'/.test(line)) assert.match(line, /^import type /, line);
    assert.doesNotMatch(line, /from 'gsap'/, 'route and title entrances use the Web Animations API (no computed-style reads)');
  }
  assert.match(main, /import\('phaser'\)/);
  assert.match(main, /import\('\.\/render\/BattleScene'\)/);
  assert.match(main, /get scene\(\) \{ return scene; \}/, 'the dev hook reads the scene through a getter (it exists only once the engine loaded)');
});

test('the engine renders without FX pipelines, at most 60 fps on a fast screen, without preserveDrawingBuffer (P9)', () => {
  const config = main.match(/new PhaserLib\.Game\(\{[^\n]*\}\)/)?.[0] ?? '';
  assert.match(config, /disablePreFX: true/);
  assert.match(config, /disablePostFX: true/);
  assert.match(config, /fps: \{ target: 60, limit: FPS_CAP \}/);
  // A cap of exactly 60 drops every other frame of a 60 Hz screen (Phaser compares the smoothed frame time with 1000/limit).
  assert.equal(Number(main.match(/const FPS_CAP = (\d+);/)?.[1]), 61);
  assert.match(config, /preserveDrawingBuffer: false/);
});

test('index.html paints an inline splash with no external URL, words or fonts (P1)', () => {
  const index = readFileSync('index.html', 'utf8');
  const splash = index.match(/<div id="app">([\s\S]*?)<\/div><script/)?.[1] ?? '';
  assert.match(splash, /class="boot-splash" role="progressbar" aria-busy="true"/);
  assert.equal(splash.replace(/<[^>]+>/g, '').trim(), 'GRIDBOUND', 'the brand is the only word: nothing to translate');
  assert.match(index, /<style>[^<]*background:#0c1815[^<]*env\(safe-area-inset-top[^<]*prefers-reduced-motion[^<]*<\/style>/);
  assert.doesNotMatch(index, /https?:\/\/|@import|url\(/);
});

test('the built page loads the engine chunk only on demand (no modulepreload), when dist/ exists', { skip: !existsSync('dist/index.html') }, () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.ok(readdirSync('dist/assets').some(name => /^engine-.*\.js$/.test(name)), 'the engine chunk exists');
  assert.doesNotMatch(html, /modulepreload[^>]*engine-/);
  assert.doesNotMatch(html, /src="[^"]*engine-/);
  assert.match(html, /class="boot-splash"/);
});

test('town and title decorations animate only transform and opacity; nothing blurs the backdrop (P6)', () => {
  for (const name of ['title', 'town', 'dungeon']) {
    for (const [, id, body] of css(name).matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
      const props = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
      assert.ok(props.length && props.every(p => p === 'transform' || p === 'opacity'), `${name}.css @keyframes ${id} animates ${props.join(', ')}`);
    }
  }
  for (const [call, from] of main.matchAll(/\benter\([^;]*?, (\{[^{}]*\}), \{/g)) {
    const props = [...from.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
    assert.ok(props.every(p => p === 'transform' || p === 'opacity'), `${call.slice(0, 60)} animates ${props.join(', ')}`);
  }
  assert.doesNotMatch(css('base'), /backdrop-filter/);
  assert.match(css('town'), /body\.title-up \.town-map \*[^{]*\{ animation-play-state: paused; \}/);
  assert.match(css('battle'), /body\.battle-idle :is\([^)]*\.intent-panel\.danger[^)]*\) \{ animation-play-state: paused; \}/);
});

test('the battle loop sleeps when nothing on the arena moves (P6)', () => {
  const live = main.match(/function arenaLive\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(live, /inTown \|\| \$\('battle-screen'\)\.hidden \|\| !resultScreen\.hidden/, 'asleep in town and behind a result or wave-clear card');
  assert.match(live, /battleView[^\n]*=== 'arena'/, 'asleep on the Status and Log views');
  assert.match(live, /s === 'fighting' \|\| s === 'ready' && !modal\.open/, 'asleep while paused, and on the ready window under a dialog');
  assert.match(live, /isEnemyDeathAnimationComplete/, 'awake while a won boss is still dying, so its result never waits on a sleeping loop');
  for (const site of ['function setBattleView', 'function showResultScreen', 'function clearResultState', 'function advanceWave', "modal.addEventListener('close'"]) {
    const at = main.indexOf(site);
    assert.ok(at >= 0 && main.slice(at, main.indexOf('\n}', at) + 2).includes('syncEngine()'), `${site} syncs the loop`);
  }
});
