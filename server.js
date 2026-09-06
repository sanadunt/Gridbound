import { createServer } from 'node:http';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

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
    const hashed = /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(path);
    res.writeHead(200, {
      'Content-Type': type, 'Content-Length': info.size,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
    });
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
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => server.closeAllConnections(), 5000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
