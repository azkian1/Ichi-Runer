'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { createReadStream } = require('node:fs');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

function publicPath(rawUrl) {
  const raw = String(rawUrl || '').split(/[?#]/, 1)[0];
  if (!raw.startsWith('/') || raw.startsWith('//') || /%(?:00|2f|5c|25)/i.test(raw)) return null;
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (/[\0\\:]/.test(decoded) || decoded.split('/').some(p => p === '.' || p === '..' || p.startsWith('.'))) return null;
  if (decoded === '/' || decoded === '/index.html') return 'index.html';
  if (decoded === '/v1/' || decoded === '/v2/') return decoded.slice(1) + 'index.html';
  if (!/^\/v[12]\//.test(decoded) || !MIME[path.extname(decoded).toLowerCase()]) return null;
  return decoded.slice(1);
}

function createServer() {
  return http.createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('Cache-Control', 'no-store');
    const fail = status => { response.writeHead(status, { 'Content-Type': 'text/plain' }); response.end('Request unavailable'); };
    const port = request.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return fail(403);
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); return fail(405); }
    if (String(request.url).length > 4096) return fail(414);
    const relative = publicPath(request.url);
    if (!relative) return fail(404);
    try {
      const root = await fs.realpath(ROOT);
      const file = await fs.realpath(path.join(ROOT, relative));
      const check = path.relative(root, file);
      if (check.startsWith('..') || path.isAbsolute(check) || publicPath('/' + check.split(path.sep).join('/')) !== relative) return fail(404);
      const stat = await fs.stat(file);
      if (!stat.isFile()) return fail(404);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Content-Length': stat.size });
      if (request.method === 'HEAD') return response.end();
      await pipeline(createReadStream(file), response);
    } catch {
      if (!response.headersSent) fail(404);
      else response.destroy();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8794);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port from 1024 to 65535.');
  const server = createServer();
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('Could not start the local server. Check the port.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Ichi Runer: http://127.0.0.1:${port}/`));
}

module.exports = { publicPath, createServer };
