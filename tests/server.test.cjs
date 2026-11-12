'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { publicPath, createServer } = require('../server.cjs');

test('only the game entry points and assets are exposed', () => {
  assert.equal(publicPath('/'), 'index.html');
  assert.equal(publicPath('/v1/'), 'v1/index.html');
  assert.equal(publicPath('/v2/?review=1'), 'v2/index.html');
  for (const url of ['/.git/config', '/.env', '/server.cjs', '/package.json', '/README.md', '/v2/../server.cjs', '/v2/%2e%2e/server.cjs', '/v2/%252e%252e/server.cjs', '//v2/game.js', '/v2/%5cgame.js', '/v2/.env', '/v2/game.js%00']) assert.equal(publicPath(url), null, url);
});

test('local HTTP serves both versions and rejects writes and foreign hosts', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  function request(url, method = 'GET', host = `127.0.0.1:${port}`) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: url, method, headers: { Host: host } }, res => {
        res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.on('error', reject); req.end();
    });
  }
  try {
    for (const url of ['/', '/v1/', '/v2/', '/v2/game.js', '/v2/assets/three.module.min.js']) assert.equal((await request(url)).status, 200, url);
    for (const url of ['/.env', '/.git/config', '/v2/../README.md', '/v2/%2e%2e/README.md', '/server.cjs', '/package.json']) assert.equal((await request(url)).status, 404, url);
    assert.equal((await request('/v2/game.js', 'POST')).status, 405);
    assert.equal((await request('/', 'GET', 'example.invalid')).status, 403);
    assert.equal((await request('/v2/game.js', 'HEAD')).status, 200);
    assert.ok((await request('/')).headers['content-security-policy'].includes("connect-src 'self'"));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
