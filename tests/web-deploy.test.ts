import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfigFromFile } from 'vite';

test('managed Vite deployment explicitly emits the dist directory configured in hPanel', async () => {
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.config.ts');
  assert.ok(loaded);
  assert.equal(loaded.config.build?.outDir, 'dist');
  assert.equal(loaded.config.base, './');
});
