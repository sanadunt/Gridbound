/**
 * The web build's install surface (phone contract I2): a web app manifest, PNG icons and the Apple / mobile-web-app head tags, so the
 * game can be added to a phone's Home Screen and played standalone, without the browser bars. Web build only: `vite build --mode itch`
 * (npm run package:itch) leaves all of it out, because itch.io serves many games from one CDN origin (phone contract I3). Nothing is
 * committed as a binary and nothing is fetched: the icons are drawn here, at build time, from the favicon's 3×3 grid and encoded by a
 * tiny deterministic PNG writer (node:zlib, a CRC32 table and the IHDR/IDAT/IEND chunks). No service worker (deferred: it needs an
 * update flow); current Chrome installs from the manifest and icons alone.
 */
import { deflateSync } from 'node:zlib';
import type { Plugin } from 'vite';

type RGB = [number, number, number];
const hex = (value: string): RGB => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as RGB;
/** public/favicon.svg on its 32-unit grid: the board, eight gold cells and the green centre. */
export const ICON = { board: '#101e1c', gold: '#e6c78c', centre: '#8abb9f', page: '#0c1815' } as const;
const CELLS = [4, 13, 22], CELL = 6;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes: Uint8Array) { let c = 0xffffffff; for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]), out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
/** An 8-bit RGB PNG of `width`×`height`, each scanline with filter 0. The same pixels always give the same bytes. */
export function encodePng(width: number, height: number, pixel: (x: number, y: number) => RGB) {
  const row = width * 3 + 1, raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [r, g, b] = pixel(x, y), at = y * row + 1 + x * 3; raw[at] = r; raw[at + 1] = g; raw[at + 2] = b; }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 bits per channel, truecolour; compression, filter and interlace 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/** The favicon drawn at `scale` px per grid unit, `pad` units of board around it, on a `size` px square (centred). */
export function iconPng(size: number, scale: number, pad = 0) {
  const board = hex(ICON.board), gold = hex(ICON.gold), centre = hex(ICON.centre), offset = (size - (32 + pad * 2) * scale) / 2 + pad * scale;
  const cell = (v: number) => CELLS.findIndex(start => v >= start && v < start + CELL);
  return encodePng(size, size, (x, y) => {
    const ux = Math.floor((x - offset) / scale), uy = Math.floor((y - offset) / scale), cx = cell(ux), cy = cell(uy);
    if (x < offset || y < offset || cx < 0 || cy < 0) return board;
    return cx === 1 && cy === 1 ? centre : gold;
  });
}
/** 192 = 32 units × 6, 512 = × 16, the 180 Apple icon a 36-unit grid (2 units of board around it) × 5, and the maskable 512 the
 *  32-unit grid × 12 (384 px) centred on the board, every gold cell inside the 80% safe circle. */
export const ICONS = { 'app-icon-180.png': () => iconPng(180, 5, 2), 'app-icon-192.png': () => iconPng(192, 6), 'app-icon-512.png': () => iconPng(512, 16), 'app-icon-maskable-512.png': () => iconPng(512, 12) };
/** URLs in a manifest resolve against the manifest itself (assets/), so the game's folder is ../ wherever it is hosted. */
export const MANIFEST = {
  name: 'Gridbound: Ashes of the Bell', short_name: 'Gridbound', lang: 'en', start_url: '../', scope: '../',
  display: 'standalone', display_override: ['fullscreen', 'standalone'], orientation: 'portrait', background_color: ICON.page, theme_color: ICON.board,
  icons: [{ src: 'app-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
};
/** The head tags, all relative (the game is served from any subpath). black-translucent is safe: #app is padded by the safe-area insets. */
export const HEAD_TAGS: { tag: string; attrs: Record<string, string> }[] = [
  { tag: 'link', attrs: { rel: 'manifest', href: './assets/manifest.webmanifest' } },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './assets/app-icon-180.png' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Gridbound' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' } },
];
/** The Vite plugin: a production build that is not `--mode itch`. The dev server and the itch build get nothing. */
export function webApp(): Plugin {
  return {
    name: 'gridbound-web-app',
    apply: (_, env) => env.command === 'build' && env.mode !== 'itch',
    generateBundle() {
      for (const [name, draw] of Object.entries(ICONS)) this.emitFile({ type: 'asset', fileName: `assets/${name}`, source: draw() });
      this.emitFile({ type: 'asset', fileName: 'assets/manifest.webmanifest', source: `${JSON.stringify(MANIFEST, null, 2)}\n` });
    },
    transformIndexHtml: { order: 'post', handler: () => HEAD_TAGS.map(tag => ({ ...tag, injectTo: 'head' as const })) },
  };
}
