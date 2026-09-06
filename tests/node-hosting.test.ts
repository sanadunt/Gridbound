import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, symlink, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';

function get(port: number, path: string, method = 'GET') {
  return new Promise<{status: number, headers: import('node:http').IncomingHttpHeaders, body: string}>((resolve, reject) => {
    const req = request({host: '127.0.0.1', port, path, method}, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status: res.statusCode!, headers: res.headers, body}));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('HTTP timeout')));
    req.end();
  });
}

test('Node hosting entry serves built assets without exposing the repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gridbound-node-test-'));
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await copyFile('server.js', join(root, 'server.js'));
    await writeFile(join(root, 'package.json'), '{"type":"module","testFixture":true}');
    await mkdir(join(root, 'dist/assets'), {recursive: true});
    await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>Static server test fixture</title>');
    await writeFile(join(root, 'dist/assets/game-abcdefgh.js'), 'export const fixture = true;');
    await writeFile(join(root, 'dist/.htaccess'), '# fixture');
    await symlink(join(root, 'package.json'), join(root, 'dist/assets/escape-abcdefgh.js'));
    child = spawn(process.execPath, [join(root, 'server.js')], {
      cwd: tmpdir(), env: {...process.env, HOST: '127.0.0.1', PORT: '0'}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server readiness timeout')), 5000);
      let output = '';
      child!.stdout!.on('data', chunk => {
        output += chunk;
        const match = output.match(/listening on port (\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child!.once('error', err => { clearTimeout(timer); reject(err); });
      child!.once('exit', code => { clearTimeout(timer); reject(new Error(`Early server exit ${code}`)); });
    });
    await t.test('GET and HEAD work from a different cwd, with revalidating HTML', async () => {
      const page = await get(port, '/');
      assert.equal(page.status, 200);
      assert.match(page.body, /Static server test fixture/);
      assert.match(page.headers['content-type']!, /text\/html/);
      assert.match(page.headers['cache-control']!, /no-cache/);
      const head = await get(port, '/index.html', 'HEAD');
      assert.equal(head.status, 200);
      assert.equal(head.body, '');
      assert.equal(head.headers['content-length'], page.headers['content-length']);
    });
    await t.test('hashed JavaScript has the correct MIME, immutable cache and nosniff', async () => {
      const asset = await get(port, '/assets/game-abcdefgh.js?v=1');
      assert.equal(asset.status, 200);
      assert.match(asset.headers['content-type']!, /application\/javascript/);
      assert.match(asset.headers['cache-control']!, /immutable/);
      assert.equal(asset.headers['x-content-type-options'], 'nosniff');
    });
    await t.test('missing assets, source, dotfiles, traversal and symlinks never disclose files', async () => {
      for (const path of ['/assets/no-file.js', '/assets/', '/package.json', '/server.js', '/src/main.ts', '/.htaccess', '/.env', '/assets/%2e%2e/%2e%2e/package.json', '/assets/escape-abcdefgh.js']) {
        const response = await get(port, path);
        assert.equal(response.status, 404, path);
        assert.match(response.headers['cache-control']!, /no-store/);
        assert.equal(response.body.includes('testFixture'), false, path);
      }
    });
    await t.test('malformed URLs and writes are rejected', async () => {
      assert.equal((await get(port, '/%')).status, 400);
      const post = await get(port, '/', 'POST');
      assert.equal(post.status, 405);
      assert.equal(post.headers.allow, 'GET, HEAD');
    });
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child?.kill('SIGKILL'), 6000);
      await exit;
      clearTimeout(timer);
    }
    await rm(root, {recursive: true, force: true});
  }
});

test('Node hosting refuses an unbuilt project and invalid port', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gridbound-node-empty-'));
  try {
    await copyFile('server.js', join(root, 'server.js'));
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    const absent = spawnSync(process.execPath, [join(root, 'server.js')], {encoding: 'utf8', timeout: 5000});
    assert.equal(absent.status, 1);
    assert.match(absent.stderr, /npm run build/);
    const invalid = spawnSync(process.execPath, [resolve('server.js')], {env: {...process.env, PORT: 'not-a-port'}, encoding: 'utf8', timeout: 5000});
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Invalid PORT/);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(pkg.scripts.start, 'node server.js');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
