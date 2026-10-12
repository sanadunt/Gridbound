import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfigFromFile } from 'vite';
import { backupLegacy, type BackupStore } from '../src/game/save';
import { framed, scrollsWithin, fullscreenAvailable, installEmbedGuards } from '../src/ui/embed';

// itch.io serves an HTML upload extracted, from index.html at the ZIP root, inside an <iframe> on a shared CDN origin under a
// per-upload path: relative URLs only, nothing fetched from other hosts, under 1000 files, and storage keys that cannot collide.
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
const sources = walk('src').filter(path => path.endsWith('.ts')).map(path => ({ path, text: readFileSync(path, 'utf8') }));
const zipNames = (zip: string): string[] => JSON.parse(execFileSync('python3', ['-I', '-c', 'import json, sys, zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' }));

test('itch.io build: relative base, a plain index.html, no service worker or manifest, nothing extra in public/', async () => {
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.config.ts');
  assert.equal(loaded?.config.base, './', 'itch serves the game from a nested path: every built URL must be relative');
  const index = readFileSync('index.html', 'utf8');
  assert.match(index, /<meta name="viewport"/);
  assert.match(index, /href="\.\/favicon\.svg"/);
  assert.doesNotMatch(index, /https?:\/\/|<base\b|rel="manifest"/i);
  for (const { path, text } of [...sources, { path: 'index.html', text: index }]) assert.doesNotMatch(text, /serviceWorker|registerSW|\.webmanifest/, `${path}: a service worker or manifest would outlive uploads on itch's shared origin`);
  assert.deepEqual(readdirSync('public').sort(), ['.htaccess', 'favicon.svg'], 'public/ ships into every ZIP');
});

test('every storage key, database, channel and lock is namespaced gridbound., and nothing clears or lists other games\' storage', () => {
  // On itch.io many games share one CDN origin (and its localStorage/IndexedDB), so a key without our prefix could meet another game's.
  const names = new Set<string>();
  const patterns = [/(?:localStorage|sessionStorage|store)\.(?:getItem|setItem|removeItem)\(\s*'([^']+)'/g, /\b[A-Z_]*KEY\s*=\s*'([^']+)'/g, /BACKUP_PREFIX\s*=\s*`\$\{SAVE_KEY\}([^`]*)`/g, /COMMANDER_DB_NAME\s*=\s*'([^']+)'/g, /new BroadcastChannel\(\s*'([^']+)'/g, /locks\.request\(\s*'([^']+)'/g];
  for (const { text } of sources) for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.add(match[1]);
  assert.ok(names.size >= 8, `the scan finds the game's keys (${[...names].join(', ')})`);
  const loose = [...names].filter(name => !name.startsWith('gridbound.') && !name.startsWith('.backup-'));
  assert.deepEqual(loose, [], 'storage names without the gridbound. prefix');
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /(?:localStorage|sessionStorage)\.clear\(|indexedDB\.(?:deleteDatabase|databases)\(/, `${path} clears or lists storage that other games on the origin own`);
    assert.doesNotMatch(text, /document\.domain|(?:top|parent)\.location|window\.parent\./, `${path} reaches into the embedding page (cross-origin on itch.io)`);
  }
});

test('legacy save backups only ever prune gridbound backup keys, never another game\'s', () => {
  const data = new Map<string, string>([['gridbound.v3', '{"v":3}'], ['other-game.save', 'theirs'], ['gridbound.v3.backup-2026-01-01T00:00:00.000Z', 'a'], ['gridbound.v3.backup-2026-01-02T00:00:00.000Z', 'b'], ['gridbound.v3.backup-2026-01-03T00:00:00.000Z', 'c'], ['zz.gridbound.v3.backup-x', 'not ours']]);
  const store: BackupStore = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); }, key: index => [...data.keys()][index] ?? null, get length() { return data.size; } };
  assert.equal(backupLegacy(store, '2026-02-01T00:00:00.000Z'), 'gridbound.v3.backup-2026-02-01T00:00:00.000Z');
  assert.deepEqual([...data.keys()].filter(key => key.startsWith('gridbound.v3.backup-')).sort(), ['gridbound.v3.backup-2026-01-02T00:00:00.000Z', 'gridbound.v3.backup-2026-01-03T00:00:00.000Z', 'gridbound.v3.backup-2026-02-01T00:00:00.000Z']);
  assert.equal(data.get('other-game.save'), 'theirs');
  assert.equal(data.get('zz.gridbound.v3.backup-x'), 'not ours');
});

/** A temp project with the packager and a dist/ fixture shaped like a Vite build. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'gridbound-itch-test-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'dist/assets'), { recursive: true });
  copyFileSync('scripts/package-itch.py', join(root, 'scripts/package-itch.py'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: 'fixture' }));
  writeFileSync(join(root, 'dist/index.html'), '<!doctype html><html><head><link rel="icon" href="./favicon.svg"><script type="module" crossorigin src="./assets/index-abc12345.js"></script><link rel="stylesheet" href="./assets/index-abc12345.css"></head><body><div id="app"></div></body></html>');
  writeFileSync(join(root, 'dist/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(root, 'dist/.htaccess'), 'DirectoryIndex index.html');
  writeFileSync(join(root, 'dist/assets/index-abc12345.js'), 'const ns="http://www.w3.org/2000/svg";console.log("Phaser / https://phaser.io");export{};');
  writeFileSync(join(root, 'dist/assets/index-abc12345.css'), '@font-face{src:url(./font-abc12345.woff2)}.x{background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'/%3E")}');
  writeFileSync(join(root, 'dist/assets/font-abc12345.woff2'), 'woff2');
  const run = () => JSON.parse(execFileSync('python3', [join(root, 'scripts/package-itch.py')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  return { root, run, file: (path: string, text: string) => writeFileSync(join(root, 'dist', path), text), read: (path: string) => readFileSync(join(root, 'dist', path), 'utf8') };
}

test('itch packager: a deterministic ZIP with index.html at the root, assets, no .htaccess or other dotfiles', () => {
  const { root, run } = fixture();
  try {
    const first = run();
    assert.equal(first.root_entry, 'index.html');
    assert.equal(first.files, 5, 'index, favicon, js, css, font; .htaccess left out');
    assert.match(first.zip, /Gridbound-itch-fixture\.zip$/);
    assert.deepEqual(zipNames(first.zip), ['assets/font-abc12345.woff2', 'assets/index-abc12345.css', 'assets/index-abc12345.js', 'favicon.svg', 'index.html']);
    const bytes = readFileSync(first.zip);
    assert.equal(run().sha256, first.sha256, 'the same dist/ gives the same ZIP');
    assert.deepEqual(readFileSync(first.zip), bytes);
    assert.equal(readFileSync(first.zip.replace(/\.zip$/, '.sha256'), 'utf8'), `${first.sha256}  Gridbound-itch-fixture.zip\n`);
    assert.deepEqual(first.inert_hosts, ['phaser.io', 'www.w3.org']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('itch packager refuses what breaks on itch.io: absolute or external URLs, missing or case-mismatched files, too many files', () => {
  const { root, run, file, read } = fixture();
  try {
    const refused = (setup: () => void, message: RegExp, undo: () => void) => { setup(); assert.throws(run, (error: Error & { stderr?: string }) => message.test(String(error.stderr ?? error.message))); undo(); run(); };
    const index = read('index.html'), js = read('assets/index-abc12345.js'), css = read('assets/index-abc12345.css');
    const restore = () => { file('index.html', index); file('assets/index-abc12345.js', js); file('assets/index-abc12345.css', css); };
    refused(() => file('index.html', index.replace('./assets/index-abc12345.js', '/assets/index-abc12345.js')), /only relative URLs work/, restore);
    refused(() => file('index.html', index.replace('./favicon.svg', 'https://cdn.example.com/favicon.svg')), /only relative URLs work/, restore);
    refused(() => file('index.html', index.replace('./assets/index-abc12345.js', './assets/Index-abc12345.js')), /not in the bundle/, restore);
    refused(() => file('assets/index-abc12345.css', `@import url(https://fonts.googleapis.com/css?family=X);${css}`), /only relative URLs work/, restore);
    refused(() => file('assets/index-abc12345.js', `fetch("https://api.example.com/score");${js}`), /external hosts in the bundle: api\.example\.com/, restore);
    refused(() => file('assets/index-abc12345.js', `navigator.serviceWorker.register("./sw.js");${js}`), /service worker/, restore);
    refused(() => file('assets/index-abc12345.js', `${js}\n//# sourceMappingURL=index.js.map`), /source map/, restore);
    refused(() => file('assets/index-abc12345.js', `new WebSocket("wss://live.example.com/feed");${js}`), /external hosts in the bundle: live\.example\.com/, restore);
    refused(() => file('assets/index-abc12345.css', `${css}\n/*# sourceMappingURL=index.css.map */`), /source map/, restore);
    for (const [extra, message] of [['.env', /Unexpected payload/], ['assets/.secret.js', /Unexpected payload/], ['assets/index-abc12345.js.map', /Unexpected payload/], ['assets/nested/x.js', /Unexpected payload/], ['assets/INDEX-ABC12345.JS', /Unexpected payload|differ only by case/], ['assets/Font-abc12345.woff2', /differ only by case/]] as [string, RegExp][]) {
      const path = join(root, 'dist', extra);
      refused(() => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, 'x'); }, message, () => rmSync(path));
    }
    refused(() => { for (let i = 0; i < 996; i++) file(`assets/chunk-${String(i).padStart(4, '0')}.js`, 'export{};'); }, /fewer than 1000/, () => { for (let i = 0; i < 996; i++) rmSync(join(root, 'dist/assets', `chunk-${String(i).padStart(4, '0')}.js`)); });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the built bundle passes the itch rules (when dist/ exists)', { skip: !existsSync('dist/index.html') && 'no dist/ (npm run build)' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'gridbound-itch-dist-'));
  try {
    mkdirSync(join(root, 'scripts'));
    copyFileSync('scripts/package-itch.py', join(root, 'scripts/package-itch.py'));
    copyFileSync('package.json', join(root, 'package.json'));
    cpSync('dist', join(root, 'dist'), { recursive: true });
    const summary = JSON.parse(execFileSync('python3', [join(root, 'scripts/package-itch.py')], { encoding: 'utf8' }));
    assert.ok(summary.files < 1000 && summary.extracted_bytes < 64 * 1024 * 1024);
    const names = zipNames(summary.zip);
    assert.ok(names.includes('index.html') && names.includes('favicon.svg') && names.some(name => /^assets\/.+\.js$/.test(name)));
    assert.ok(names.every(name => !name.split('/').some(part => part.startsWith('.'))), 'no dotfiles');
    const index = readFileSync('dist/index.html', 'utf8');
    for (const [, ref] of index.matchAll(/(?:src|href)="([^"]+)"/g)) assert.match(ref, /^\.\/(assets\/|favicon\.svg$)/, `index.html loads ${ref} relatively`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('embed guards: framed detection, scroll test and the fullscreen gate', () => {
  const g = globalThis as Record<string, unknown>, saved = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle };
  try {
    const self = {};
    g.window = { self, top: self };
    assert.equal(framed(), false, 'a top-level page');
    g.window = { self, top: {} };
    assert.equal(framed(), true, 'a frame');
    g.window = { self, get top() { throw new Error('cross-origin'); } };
    assert.equal(framed(), true, 'an inaccessible parent is a frame too');
    // Elements as plain objects: style = computed style, the chain ends at document.documentElement.
    const root = { style: { overflowX: 'hidden', overflowY: 'hidden' } };
    g.document = { documentElement: root };
    g.getComputedStyle = (el: { style: unknown }) => el.style;
    const box = (overflowY: string, scrollTop: number, parentElement: unknown) => ({ style: { overflowX: 'hidden', overflowY }, scrollTop, scrollHeight: 800, clientHeight: 200, scrollLeft: 0, scrollWidth: 100, clientWidth: 100, parentElement });
    const list = box('auto', 0, root), leaf = { style: { overflowX: 'visible', overflowY: 'visible' }, parentElement: list };
    assert.equal(scrollsWithin(leaf as never, 'y', 1), true, 'a list with room below takes a downward scroll');
    assert.equal(scrollsWithin(leaf as never, 'y', -1), false, 'at its top it cannot scroll up: the scroll would leak to the host');
    list.scrollTop = 600;
    assert.equal(scrollsWithin(leaf as never, 'y', 1), false, 'at its end nothing takes it');
    assert.equal(scrollsWithin(leaf as never, 'x', 1), false, 'nothing scrolls sideways');
    assert.equal(scrollsWithin(box('hidden', 0, root) as never, 'y', 1), false, 'overflow hidden is not a scroller');
    g.document = { fullscreenEnabled: false, documentElement: { requestFullscreen() {} } };
    assert.equal(fullscreenAvailable(), false, 'a frame without allow="fullscreen"');
    g.document = { fullscreenEnabled: true, documentElement: { requestFullscreen() {} } };
    assert.equal(fullscreenAvailable(), true);
    g.document = { fullscreenEnabled: undefined, documentElement: {} };
    assert.equal(fullscreenAvailable(), false, 'iPhone Safari: no element fullscreen');
  } finally { Object.assign(g, saved); }
});

test('embed guards: installed only in a frame; a wheel or scroll key nothing in the game takes is cancelled, typing and buttons keep theirs', () => {
  const g = globalThis as Record<string, unknown>, saved = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle, Element: g.Element, IntersectionObserver: g.IntersectionObserver };
  try {
    // A tiny DOM: closest() matches the leading tag of each selector; getComputedStyle reads `style`.
    class El {
      style = { overflowX: 'hidden', overflowY: 'visible' }; scrollTop = 0; scrollHeight = 0; clientHeight = 0; scrollLeft = 0; scrollWidth = 0; clientWidth = 0; classes = new Set<string>(); classList = { add: (name: string) => { this.classes.add(name); } };
      constructor(public tag: string, public parentElement: El | null = null, init: Partial<El> = {}) { Object.assign(this, init); }
      closest(selector: string) { const tags = selector.split(',').map(part => part.trim().match(/^[a-z]+/)?.[0]); for (let el: El | null = this; el; el = el.parentElement) if (tags.includes(el.tag)) return el; return null; }
    }
    const html = new El('html'), body = new El('body', html), canvas = new El('canvas', body), list = new El('div', body, { style: { overflowX: 'hidden', overflowY: 'auto' }, scrollHeight: 900, clientHeight: 300 }), item = new El('p', list), button = new El('button', list), area = new El('textarea', body);
    let listeners: { type: string; fn: (event: unknown) => void }[] = [], focusCalls = 0;
    const self = {}, win = (top: unknown) => ({ self, top, addEventListener: (type: string, fn: (event: unknown) => void) => listeners.push({ type, fn }), focus: () => { focusCalls++; } });
    let seen: ((entries: { intersectionRatio: number }[]) => void) | undefined, observed: unknown;
    g.IntersectionObserver = class { constructor(callback: typeof seen) { seen = callback; } observe(target: unknown) { observed = target; } };
    g.Element = El; g.getComputedStyle = (el: El) => el.style; g.document = { documentElement: html, body, hasFocus: () => false };
    g.window = win(self);
    assert.equal(installEmbedGuards(), false, 'a top-level page (the normal web build) gets no guards');
    assert.deepEqual([listeners.length, html.classes.size], [0, 0]);
    g.window = win({});
    assert.equal(installEmbedGuards(), true);
    assert.ok(html.classes.has('embedded'), 'html.embedded scopes the frame-only CSS');
    const fire = (type: string, init: Record<string, unknown>) => { const event = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...init, preventDefault() { event.defaultPrevented = true; } }; for (const l of listeners) if (l.type === type) l.fn(event); return event.defaultPrevented; };
    fire('pointerdown', { target: canvas });
    assert.equal(focusCalls, 1, 'a press in an unfocused frame takes the keyboard (the arena canvas prevents the default focus)');
    assert.equal(fire('wheel', { target: canvas, deltaY: 120, deltaX: 0 }), true, 'nothing under the arena scrolls: the wheel would scroll the host page');
    assert.equal(fire('wheel', { target: item, deltaY: 120, deltaX: 0 }), false, 'a list with room below scrolls itself');
    assert.equal(fire('wheel', { target: item, deltaY: -120, deltaX: 0 }), true, 'at its top an upward wheel would chain to the host');
    assert.equal(fire('wheel', { target: canvas, deltaY: 120, deltaX: 0, ctrlKey: true }), false, 'Ctrl+wheel zoom stays the browser\'s');
    for (const code of ['ArrowDown', 'PageDown', 'End', 'Space', 'ArrowRight']) assert.equal(fire('keydown', { code, target: body }), true, `${code} after a press on the arena`);
    assert.equal(fire('keydown', { code: 'KeyG', target: body }), false, 'game keys are not touched');
    assert.equal(fire('keydown', { code: 'ArrowDown', target: area }), false, 'typing in a text field');
    assert.equal(fire('keydown', { code: 'Space', target: button }), false, 'Space presses a focused button');
    assert.equal(fire('keydown', { code: 'ArrowDown', target: button }), false, 'an arrow on a control inside a list with room scrolls the list');
    fire('pointerdown', { target: item });
    assert.equal(fire('keydown', { code: 'PageDown', target: body }), false, 'with the focus on <body> the keys scroll what was last pressed, as the browser does');
    assert.equal(fire('keydown', { code: 'PageDown', target: body, defaultPrevented: true }), true, 'already handled');
    // The host page's window cuts the frame off (an embed taller than the window, a page scrolled past it): the wheel scrolls the page.
    assert.equal(observed, html, 'the frame watches how much of itself the top-level window shows');
    seen!([{ intersectionRatio: 0.7 }]);
    fire('pointerdown', { target: canvas });
    assert.equal(fire('wheel', { target: canvas, deltaY: 120, deltaX: 0 }), false, 'a cut-off frame lets the wheel bring it into view');
    assert.equal(fire('keydown', { code: 'ArrowDown', target: body }), true, 'keys stay the game\'s');
    seen!([{ intersectionRatio: 1 }]);
    assert.equal(fire('wheel', { target: canvas, deltaY: 120, deltaX: 0 }), true, 'fully on screen again: the wheel is held');
  } finally { Object.assign(g, saved); }
});

test('main.ts turns the iframe features on only when framed: the normal web build keeps its menus', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /const embedded = installEmbedGuards\(\);/);
  assert.match(main, /\$\{embedded && fullscreenAvailable\(\) \? `<label class="setting-row">/, 'Config → Fullscreen');
  assert.match(main, /\$\{embedded \? `<button id="import-text-button"/, 'Save → Paste backup');
  assert.match(main, /if \(embedded\) backupText\(text, filename\);/, 'the backup as text after a download');
  assert.match(main, /if \(embedded\) \{\s*document\.addEventListener\('close'/, 'the fullscreen modal fix');
  assert.doesNotMatch(main, /\bframed\(\)/, 'decided once, by installEmbedGuards()');
});

test('itch packaging runs in CI and has npm scripts; the smoke embeds at the size CLAUDE.md recommends', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['package:itch'], 'npm run build && python3 scripts/package-itch.py');
  assert.match(pkg.scripts['test:itch'], /scripts\/itch-smoke\.mjs/);
  assert.match(readFileSync('.github/workflows/ci.yml', 'utf8'), /run: python3 scripts\/package-itch\.py/);
  const [, w, h] = readFileSync('scripts/itch-smoke.mjs', 'utf8').match(/const EMBED = \{ width: (\d+), height: (\d+) \}/) ?? [];
  assert.ok(w && h, 'the smoke states its embed size');
  assert.ok(readFileSync('CLAUDE.md', 'utf8').includes(`${w}×${h}`), `CLAUDE.md recommends the ${w}×${h} embed the smoke checks`);
});
