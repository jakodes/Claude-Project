'use strict';
/*
 * Boba Rush server: serves the game and hosts multiplayer rooms.
 * Zero dependencies. Clients receive room snapshots over Server-Sent Events
 * and send actions with plain POST requests.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Room } = require('../shared/game.js');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');
const STATIC = {
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/style.css': 'public/style.css',
  '/art.js': 'public/art.js',
  '/client.js': 'public/client.js',
  '/game.js': 'shared/game.js',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const rooms = new Map(); // code -> { room, clients: Map(pid -> res), tokens: Map(pid -> token), emptySince, lastSent }

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function broadcast(entry) {
  const payload = `data: ${JSON.stringify(entry.room.snapshot(Date.now()))}\n\n`;
  for (const res of entry.clients.values()) res.write(payload);
  entry.lastSent = Date.now();
  entry.lastVersion = entry.room.version;
}

function authed(body) {
  const entry = rooms.get(String(body.code || '').toUpperCase());
  if (!entry) return null;
  if (!body.pid || entry.tokens.get(body.pid) !== body.token) return null;
  return entry;
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, rooms: rooms.size });

  if (url.pathname === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return send(res, 400, { ok: false, error: 'Bad request' });
    let code = String(body.code || '').toUpperCase().replace(/[^A-Z]/g, '');
    let entry;
    if (body.create) {
      code = newCode();
      entry = { room: new Room({ code }), clients: new Map(), tokens: new Map(), timers: new Map(), emptySince: Date.now(), lastSent: 0, lastVersion: -1 };
      rooms.set(code, entry);
    } else {
      entry = rooms.get(code);
      if (!entry) return send(res, 404, { ok: false, error: `No room called ${code || '(blank)'}` });
    }
    const pid = crypto.randomBytes(6).toString('hex');
    const added = entry.room.addPlayer(pid, body.name);
    if (!added.ok) return send(res, 409, added);
    const token = crypto.randomBytes(16).toString('hex');
    entry.tokens.set(pid, token);
    // drop the seat if the browser never opens its event stream
    entry.timers.set(pid, setTimeout(() => dropPlayer(entry, pid), 15000));
    return send(res, 200, { ok: true, code, pid, token });
  }

  if (url.pathname === '/api/events' && req.method === 'GET') {
    const q = Object.fromEntries(url.searchParams);
    const entry = authed(q);
    if (!entry) return send(res, 403, { ok: false, error: 'Not in this room' });
    clearTimeout(entry.timers.get(q.pid));
    const old = entry.clients.get(q.pid);
    if (old) old.end();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    entry.clients.set(q.pid, res);
    broadcast(entry);
    req.on('close', () => {
      if (entry.clients.get(q.pid) !== res) return;
      entry.clients.delete(q.pid);
      // give reconnects a grace period before freeing the seat
      entry.timers.set(q.pid, setTimeout(() => dropPlayer(entry, q.pid), 10000));
    });
    return;
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    const body = await readJson(req);
    const entry = body && authed(body);
    if (!entry) return send(res, 403, { ok: false, error: 'Not in this room' });
    const result = entry.room.handle(body.pid, body.action, Date.now());
    send(res, 200, result);
    if (entry.room.version !== entry.lastVersion) broadcast(entry);
    return;
  }

  if (url.pathname === '/api/leave' && req.method === 'POST') {
    const body = await readJson(req);
    const entry = body && authed(body);
    if (entry) dropPlayer(entry, body.pid);
    return send(res, 200, { ok: true });
  }

  send(res, 404, { ok: false, error: 'Not found' });
}

function dropPlayer(entry, pid) {
  if (entry.clients.has(pid)) return;
  entry.tokens.delete(pid);
  entry.timers.delete(pid);
  entry.room.removePlayer(pid);
  if (entry.room.players.size === 0) entry.emptySince = Date.now();
  broadcast(entry);
}

function serveStatic(req, res, url) {
  const rel = STATIC[url.pathname];
  if (!rel) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  fs.readFile(path.join(ROOT, rel), (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Server error');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)], 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, { ok: false, error: 'Server error' });
    });
  } else {
    serveStatic(req, res, url);
  }
});

// game clock: advance every room, push changes, keep idle streams alive
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of rooms) {
    if (entry.room.players.size === 0 && now - entry.emptySince > 60000) {
      for (const res of entry.clients.values()) res.end();
      rooms.delete(code);
      continue;
    }
    entry.room.tick(now);
    if (entry.room.version !== entry.lastVersion || now - entry.lastSent > 5000) broadcast(entry);
  }
}, 250);

if (require.main === module) {
  server.listen(PORT, () => console.log(`Boba Rush is open at http://localhost:${PORT}`));
}

module.exports = { server, rooms };
