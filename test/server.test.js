'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { server } = require('../server/server.js');

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method, path, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function firstEvent(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path }, (res) => {
      let buf = '';
      res.on('data', (c) => {
        buf += c;
        const m = buf.match(/data: (.*)\n\n/);
        if (m) {
          req.destroy();
          resolve(JSON.parse(m[1]));
        }
      });
    });
    req.on('error', (e) => (e.code === 'ECONNRESET' ? null : reject(e)));
  });
}

test('two players can share a room over HTTP', async (t) => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  t.after(() => {
    server.closeAllConnections();
    server.close();
    setImmediate(() => process.exit(0)); // stop the game clock interval
  });

  const page = await request(port, 'GET', '/');
  assert.strictEqual(page.status, 200);
  assert.match(page.body, /Boba Rush/);
  assert.strictEqual((await request(port, 'GET', '/game.js')).status, 200);
  assert.strictEqual((await request(port, 'GET', '/../package.json')).status, 404);

  const host = JSON.parse((await request(port, 'POST', '/api/join', { create: true, name: 'Host' })).body);
  assert.ok(host.ok && /^[A-Z]{4}$/.test(host.code));
  const guest = JSON.parse((await request(port, 'POST', '/api/join', { code: host.code.toLowerCase(), name: 'Guest' })).body);
  assert.ok(guest.ok);

  const bad = await request(port, 'POST', '/api/action', { code: host.code, pid: host.pid, token: 'nope', action: { type: 'start' } });
  assert.strictEqual(bad.status, 403);

  const q = new URLSearchParams({ code: host.code, pid: host.pid, token: host.token });
  const snap = await firstEvent(port, '/api/events?' + q);
  assert.strictEqual(snap.players.length, 2);
  assert.strictEqual(snap.phase, 'lobby');

  const notHost = JSON.parse((await request(port, 'POST', '/api/action', { code: guest.code, pid: guest.pid, token: guest.token, action: { type: 'start' } })).body);
  assert.strictEqual(notHost.ok, false);
  const start = JSON.parse((await request(port, 'POST', '/api/action', { code: host.code, pid: host.pid, token: host.token, action: { type: 'start' } })).body);
  assert.ok(start.ok);

  const missing = await request(port, 'POST', '/api/join', { code: 'ZZZZ', name: 'Lost' });
  assert.strictEqual(missing.status, 404);
});
