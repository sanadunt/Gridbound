import { createServer } from 'node:http';
import { createReadStream, readdirSync, realpathSync, statSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const rawPort = process.env.PORT ?? '3000';
if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
  console.error('Invalid PORT: expected an integer between 0 and 65535.');
  process.exit(1);
}
let root;
try {
  root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), 'dist'));
  if (!statSync(resolve(root, 'index.html')).isFile()) throw new Error('Missing index');
} catch {
  console.error('Production files missing. Run npm run build before npm start.');
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
// Text is served compressed (contract P8): Brotli, else gzip, else as is, by the request's Accept-Encoding. Each file is compressed once per
// process (hashed assets at the strongest level, they never change; index.html and the icon are re-checked by mtime) and kept in memory;
// the cache is warmed at startup, so the first visitor does not wait for it. Fonts and images are already compressed.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.webmanifest']);
const HASHED = /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/;
const brotli = promisify(brotliCompress), gzipAsync = promisify(gzip);
const compressed = new Map();
function encodingFor(header = '') {
  const q = {};
  for (const part of String(header).toLowerCase().split(',')) {
    const [name, ...params] = part.trim().split(';');
    const weight = params.map(p => p.trim()).find(p => p.startsWith('q='));
    if (name) q[name] = weight ? Number(weight.slice(2)) || 0 : 1;
  }
  const allowed = name => (q[name] ?? q['*'] ?? 0) > 0;
  return allowed('br') ? 'br' : allowed('gzip') ? 'gzip' : undefined;
}
function compressedBody(file, info, encoding) {
  const key = `${encoding}:${file}`, cached = compressed.get(key);
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.body;
  const strong = HASHED.test(file);
  const body = readFile(file).then(raw => encoding === 'br'
    ? brotli(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: strong ? 11 : 9, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
    : gzipAsync(raw, { level: 9 }));
  body.catch(() => compressed.delete(key));
  compressed.set(key, { mtimeMs: info.mtimeMs, size: info.size, body });
  return body;
}
function warmCache() {
  const files = [resolve(root, 'index.html'), resolve(root, 'favicon.svg')];
  try { for (const name of readdirSync(join(root, 'assets'))) files.push(join(root, 'assets', name)); } catch { /* no assets folder */ }
  for (const file of files) {
    if (!COMPRESSIBLE.has(extname(file))) continue;
    try { const info = statSync(file); if (info.isFile()) for (const encoding of ['br', 'gzip']) compressedBody(file, info, encoding).catch(() => {}); } catch { /* skipped */ }
  }
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const fail = (status, message) => {
    res.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(req.method === 'HEAD' ? undefined : message);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return fail(405, 'Method not allowed');
  }
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.includes('\0')) throw new Error('Null path');
  } catch {
    return fail(400, 'Invalid URL');
  }
  if (path === '/') path = '/index.html';
  const type = types[extname(path)];
  if (!type || path.includes('\\') || path.split('/').some(part => part.startsWith('.')) ||
      !(path === '/index.html' || path === '/favicon.svg' || path.startsWith('/assets/'))) {
    return fail(404, 'Not found');
  }
  try {
    const file = await realpath(resolve(root, '.' + path));
    // Resolve symlinks before serving: repository files are never a public root.
    if (!file.startsWith(root + sep)) return fail(404, 'Not found');
    const info = await stat(file);
    if (!info.isFile()) return fail(404, 'Not found');
    const hashed = HASHED.test(path);
    const headers = { 'Content-Type': type, 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate' };
    const compressible = COMPRESSIBLE.has(extname(path)), encoding = compressible ? encodingFor(req.headers['accept-encoding']) : undefined;
    if (compressible) headers.Vary = 'Accept-Encoding';
    if (encoding) {
      const body = await compressedBody(file, info, encoding);
      res.writeHead(200, { ...headers, 'Content-Encoding': encoding, 'Content-Length': body.length });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(file), res);
  } catch (error) {
    if (res.headersSent || res.destroyed) return res.destroy();
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return fail(404, 'Not found');
    console.error('Static file error:', error.code ?? 'unknown');
    fail(500, 'Unable to serve file');
  }
});
server.on('error', error => {
  console.error('Server startup error:', error.code ?? error.message);
  process.exit(1);
});
server.listen(Number(rawPort), process.env.HOST || '0.0.0.0', () => {
  console.log(`Gridbound production server listening on port ${server.address().port}`);
  warmCache();
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => server.closeAllConnections(), 5000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
