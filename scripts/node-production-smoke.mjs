import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const child = spawn(process.execPath, ['server.js'], {
  env: {...process.env, HOST: '127.0.0.1', PORT: '0'}, stdio: ['ignore', 'pipe', 'pipe'],
});
let errors = '';
child.stderr.on('data', chunk => errors += chunk);
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Node startup timed out: ${errors}`)), 5000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Node exited ${code}: ${errors}`)); });
  });
  const browser = spawn(process.execPath, ['scripts/production-smoke.mjs'], {
    env: {...process.env, GRIDBOUND_STATIC_URL: `http://127.0.0.1:${port}/`}, stdio: 'inherit',
  });
  const [code] = await once(browser, 'exit');
  assert.equal(code, 0, 'Production game must run through the actual Node entry');
  assert.equal(errors, '');
  console.log('PASS Node production entry: town, party preparation, campaign combat, local assets, no runtime errors');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 6000);
    await exited;
    clearTimeout(timer);
  }
}
