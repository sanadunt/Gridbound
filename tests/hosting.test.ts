import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const config = 'public/.htaccess';
test('Hostinger bundle supplies an Apache-compatible index and conservative cache configuration', () => {
  assert.ok(existsSync(config));
  const text = readFileSync(config, 'utf8');
  assert.match(text, /DirectoryIndex index\.html/);
  assert.match(text, /Options -Indexes/);
  assert.match(text, /no-cache/);
  assert.match(text, /immutable/);
  assert.match(text, /nosniff/);
  assert.doesNotMatch(text, /RewriteRule/);
});

test('Hostinger packager produces identical static-only ZIPs and rejects secrets/source maps', () => {
  const root = mkdtempSync(join(tmpdir(), 'gridbound-package-test-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'dist/assets'), { recursive: true });
    copyFileSync('scripts/package-hostinger.py', join(root, 'scripts/package-hostinger.py'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: 'fixture' }));
    writeFileSync(join(root, 'dist/index.html'), '<!doctype html><title>Packaging test fixture</title>');
    writeFileSync(join(root, 'dist/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    copyFileSync(config, join(root, 'dist/.htaccess'));
    writeFileSync(join(root, 'dist/assets/index-testhash.js'), 'export {};');
    const run = () => JSON.parse(execFileSync('python3', [join(root, 'scripts/package-hostinger.py')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const first = run();
    const bytes = readFileSync(first.zip);
    assert.equal(first.files, 4);
    assert.equal(first.root_entry, 'index.html');
    assert.equal(run().sha256, first.sha256);
    assert.deepEqual(readFileSync(first.zip), bytes);
    for (const invalid of ['.env', 'assets/.env', 'assets/index-testhash.js.map', 'assets/source.ts']) {
      const path = join(root, 'dist', invalid);
      writeFileSync(path, 'REJECTED TEST FIXTURE');
      assert.throws(run, /Unexpected payload/);
      rmSync(path);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
