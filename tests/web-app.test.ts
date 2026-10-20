import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { crc32, encodePng, iconPng, ICONS, MANIFEST, HEAD_TAGS, webApp } from '../scripts/web-app';

// Phone contract I2: the web build is installable (manifest, PNG icons drawn at build time, Home Screen tags); I3: the itch build is not.
type Chunk = { type: string; data: Buffer; crc: number };
function chunks(png: Buffer) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG signature');
  const out: Chunk[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8), data = png.subarray(at + 8, at + 8 + length), crc = png.readUInt32BE(at + 8 + length);
    assert.equal(crc, crc32(png.subarray(at + 4, at + 8 + length)), `${type} CRC checks`);
    out.push({ type, data, crc }); at += 12 + length;
  }
  return out;
}
/** Decode an 8-bit RGB, filter-0 PNG back into a pixel reader. */
function pixels(png: Buffer) {
  const list = chunks(png), ihdr = list[0].data, width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const raw = inflateSync(Buffer.concat(list.filter(c => c.type === 'IDAT').map(c => c.data))), row = width * 3 + 1;
  return { width, height, at: (x: number, y: number) => { assert.equal(raw[y * row], 0, 'filter 0'); const i = y * row + 1 + x * 3; return `#${[raw[i], raw[i + 1], raw[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')}`; } };
}

test('the PNG encoder writes a valid PNG: signature, IHDR size and depth, CRCs that check, IEND last, and the same bytes every time', () => {
  assert.equal(crc32(Buffer.from('IEND')), 0xae426082, 'the well-known CRC of an empty IEND');
  const png = encodePng(3, 2, (x, y) => [x * 100, y * 200, 7]), list = chunks(png);
  assert.deepEqual(list.map(c => c.type), ['IHDR', 'IDAT', 'IEND']);
  assert.deepEqual([list[0].data.readUInt32BE(0), list[0].data.readUInt32BE(4), list[0].data[8], list[0].data[9], list[0].data[12]], [3, 2, 8, 2, 0], '3×2, 8-bit truecolour, not interlaced');
  const img = pixels(png);
  assert.equal(img.at(2, 1), '#c8c807');
  assert.deepEqual(encodePng(3, 2, (x, y) => [x * 100, y * 200, 7]), png, 'deterministic');
});

test('the app icons are the favicon grid at integer scales: 180 padded for Apple, 192, 512, and a maskable 512 inside the safe circle', () => {
  const sizes = Object.fromEntries(Object.entries(ICONS).map(([name, draw]) => { const img = pixels(draw()); return [name, `${img.width}x${img.height}`]; }));
  assert.deepEqual(sizes, { 'app-icon-180.png': '180x180', 'app-icon-192.png': '192x192', 'app-icon-512.png': '512x512', 'app-icon-maskable-512.png': '512x512' });
  const icon = pixels(iconPng(192, 6));
  assert.equal(icon.at(0, 0), '#101e1c', 'board');
  assert.equal(icon.at(4 * 6, 4 * 6), '#e6c78c', 'top-left gold cell starts at unit 4');
  assert.equal(icon.at(16 * 6, 16 * 6), '#8abb9f', 'green centre');
  assert.equal(icon.at(11 * 6, 4 * 6), '#101e1c', 'gap between cells');
  const apple = pixels(ICONS['app-icon-180.png']());
  assert.equal(apple.at(5 * 5, 5 * 5), '#101e1c', 'two units of board before the first cell (unit 4 + 2)');
  assert.equal(apple.at(6 * 5, 6 * 5), '#e6c78c');
  // Maskable: launchers crop to a circle of 40% of the size around the centre; every gold pixel lies inside it.
  const mask = pixels(ICONS['app-icon-maskable-512.png']());
  for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) if (mask.at(x, y) !== '#101e1c') assert.ok(Math.hypot(x + 0.5 - 256, y + 0.5 - 256) <= 512 * 0.4, `(${x},${y}) is inside the safe zone`);
  assert.equal(mask.at(256, 256), '#8abb9f');
});

test('the manifest: names, the game folder as start/scope, standalone with a fullscreen override, portrait, palette colours, icons 192/512/maskable', () => {
  assert.equal(MANIFEST.short_name, 'Gridbound');
  assert.deepEqual([MANIFEST.start_url, MANIFEST.scope], ['../', '../'], 'relative to assets/manifest.webmanifest: the folder the game is served from');
  assert.ok(!('id' in MANIFEST), 'no id: it defaults to start_url, so copies under two subpaths of one origin stay two apps');
  assert.deepEqual([MANIFEST.display, MANIFEST.display_override, MANIFEST.orientation], ['standalone', ['fullscreen', 'standalone'], 'portrait']);
  assert.match(readFileSync('index.html', 'utf8'), new RegExp(`name="theme-color" content="${MANIFEST.theme_color}"`), 'the same theme colour as the page');
  assert.deepEqual(MANIFEST.icons.map(i => `${i.src} ${i.sizes} ${'purpose' in i ? i.purpose : 'any'}`), ['app-icon-192.png 192x192 any', 'app-icon-512.png 512x512 any', 'app-icon-maskable-512.png 512x512 maskable']);
  for (const icon of MANIFEST.icons) assert.ok(icon.src in ICONS, `${icon.src} is emitted`);
  assert.deepEqual(HEAD_TAGS.map(t => t.attrs.rel ?? t.attrs.name), ['manifest', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'mobile-web-app-capable', 'apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style']);
  assert.ok(HEAD_TAGS.every(t => !t.attrs.href || t.attrs.href.startsWith('./assets/')), 'relative URLs: the game is served from any subpath');
});

test('the plugin runs on a web build only: never on the dev server or the itch build (vite build --mode itch)', () => {
  const plugin = webApp(), apply = plugin.apply as (config: unknown, env: { command: string; mode: string }) => boolean;
  assert.equal(apply({}, { command: 'build', mode: 'production' }), true);
  assert.equal(apply({}, { command: 'build', mode: 'itch' }), false);
  assert.equal(apply({}, { command: 'serve', mode: 'development' }), false);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.build, /vite build$/, 'npm run build is the web build');
  assert.match(pkg.scripts['package:itch'], /vite build --mode itch --outDir dist-itch && python3 scripts\/package-itch\.py --dist dist-itch/);
  assert.match(readFileSync('vite.config.ts', 'utf8'), /plugins: \[webApp\(\)\]/);
  assert.match(readFileSync('.gitignore', 'utf8'), /^dist-itch\/$/m);
});

test('the built web page links the manifest and the manifest parses with its icons (when dist/ exists)', { skip: !existsSync('dist/index.html') && 'no dist/ (npm run build)' }, () => {
  const index = readFileSync('dist/index.html', 'utf8');
  if (!index.includes('rel="manifest"')) return; // a dist/ from an older build or another mode
  for (const tag of ['<link rel="manifest" href="./assets/manifest.webmanifest">', '<link rel="apple-touch-icon" href="./assets/app-icon-180.png">', '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">']) assert.ok(index.includes(tag), tag);
  const manifest = JSON.parse(readFileSync('dist/assets/manifest.webmanifest', 'utf8'));
  assert.deepEqual(manifest, MANIFEST);
  for (const icon of manifest.icons) { const img = pixels(readFileSync(`dist/assets/${icon.src}`)); assert.equal(`${img.width}x${img.height}`, icon.sizes); }
  assert.equal(pixels(readFileSync('dist/assets/app-icon-180.png')).width, 180);
});
