'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../shared/game.js');

const perfect = (order) => ({ tea: order.tea, fill: G.FILL_TARGET, sweet: order.sweet, ice: order.ice, toppings: order.toppings, shake: 1 });

test('a perfect drink scores 100 and three stars', () => {
  const order = { tea: 'taro', sweet: 2, ice: 1, toppings: ['pearls', 'pudding'] };
  const r = G.scoreDrink(order, perfect(order));
  assert.strictEqual(r.total, 100);
  assert.strictEqual(r.stars, 3);
});

test('mistakes cost points in the right categories', () => {
  const order = { tea: 'matcha', sweet: 2, ice: 2, toppings: ['jelly'] };
  const r = G.scoreDrink(order, { tea: 'thai', fill: 0.5, sweet: 3, ice: 0, toppings: ['jelly', 'redbean'], shake: 0.5 });
  assert.strictEqual(r.parts.tea, 0);
  assert.strictEqual(r.parts.fill, 0);
  assert.strictEqual(r.parts.sweet, 7);
  assert.strictEqual(r.parts.ice, 0);
  assert.strictEqual(r.parts.toppings, 13);
  assert.strictEqual(r.parts.shake, 8);
});

test('garbage drinks are sanitized instead of crashing', () => {
  const order = { tea: 'classic', sweet: 0, ice: 0, toppings: [] };
  const r = G.scoreDrink(order, { tea: '<script>', fill: 'lots', sweet: 99, toppings: 'pearls' });
  assert.ok(r.total >= 0 && r.total <= 100);
  assert.strictEqual(r.parts.tea, 0);
});

test('room flow: join, open, take, serve, close', () => {
  let t = 1000;
  const room = new G.Room({ seed: 42, dayLengthMs: 60000 });
  room.addPlayer('a', 'Alice');
  room.addPlayer('b', 'Bob');
  assert.strictEqual(room.hostId, 'a');
  assert.strictEqual(room.startDay('b', t).ok, false, 'only host can start');
  assert.ok(room.startDay('a', t).ok);

  t += 2000;
  room.tick(t);
  const c = room.customers[0];
  assert.ok(c, 'a customer arrives');
  assert.strictEqual(room.snapshot(t).customers[0].order, null, 'order hidden until taken');

  assert.ok(room.handle('b', { type: 'take', cid: c.id }, t).ok);
  assert.strictEqual(c.claimedBy, 'b');
  assert.ok(room.handle('a', { type: 'claim', cid: c.id }, t).ok);
  assert.strictEqual(c.claimedBy, 'a');

  const res = room.handle('a', { type: 'serve', cid: c.id, drink: perfect(c.order) }, t + 1000);
  assert.ok(res.ok);
  assert.strictEqual(res.result.stars, 3);
  assert.ok(room.money > 4);
  assert.strictEqual(room.handle('a', { type: 'serve', cid: c.id, drink: perfect(c.order) }, t).ok, false, 'no double serving');

  room.tick(1000 + 60000);
  assert.strictEqual(room.phase, 'results');
  assert.strictEqual(room.lastResults.served, 1);
  assert.strictEqual(room.lastResults.players[0].name, 'Alice');
});

test('impatient customers leave and count as lost', () => {
  let t = 0;
  const room = new G.Room({ seed: 7, dayLengthMs: 600000 });
  room.addPlayer('a', 'Solo');
  room.startDay('a', t);
  t += 2000;
  room.tick(t);
  const c = room.customers[0];
  room.tick(c.leaveAt + 1);
  assert.strictEqual(c.status, 'left');
  assert.ok(room.stats.lost >= 1);
});

test('host passes on when the host leaves, and rooms cap at six', () => {
  const room = new G.Room({ seed: 1 });
  for (let i = 0; i < G.MAX_PLAYERS; i++) assert.ok(room.addPlayer('p' + i, 'P' + i).ok);
  assert.strictEqual(room.addPlayer('extra', 'X').ok, false);
  room.removePlayer('p0');
  assert.strictEqual(room.hostId, 'p1');
});

test('names are cleaned', () => {
  const room = new G.Room({ seed: 1 });
  room.addPlayer('x', '<img src=x onerror=alert(1)>');
  assert.ok(!/[<>=]/.test(room.players.get('x').name));
});
