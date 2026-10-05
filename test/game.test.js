'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../shared/game.js');

const perfect = (order) => ({ tea: order.tea, fill: G.FILL_TARGET, sweet: order.sweet, ice: order.ice, toppings: order.toppings, drizzle: order.drizzle, shake: 1 });

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
  const ask = room.handle('a', { type: 'claim', cid: c.id }, t);
  assert.ok(ask.ok && ask.pending, 'claiming a held ticket asks for it');
  assert.strictEqual(c.claimedBy, 'b', 'the ticket does not switch on its own');
  assert.strictEqual(room.handle('a', { type: 'serve', cid: c.id, drink: perfect(c.order) }, t).ok, false, 'cannot serve a teammate\'s ticket');
  assert.ok(room.handle('b', { type: 'respond', cid: c.id, accept: true }, t).ok);
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

test('ticket handoff: decline, timeout, and the holder leaving', () => {
  let t = 0;
  const room = new G.Room({ seed: 3, dayLengthMs: 600000 });
  room.addPlayer('a', 'Alice');
  room.addPlayer('b', 'Bob');
  room.addPlayer('c', 'Cleo');
  room.startDay('a', t);
  t += 2000;
  room.tick(t);
  const cust = room.customers[0];
  room.handle('a', { type: 'take', cid: cust.id }, t);

  assert.ok(room.handle('b', { type: 'claim', cid: cust.id }, t).pending);
  assert.strictEqual(room.handle('c', { type: 'claim', cid: cust.id }, t).ok, false, 'one request at a time');
  assert.strictEqual(room.handle('b', { type: 'respond', cid: cust.id, accept: true }, t).ok, false, 'only the holder can answer');
  assert.ok(room.handle('a', { type: 'respond', cid: cust.id, accept: false }, t).ok);
  assert.strictEqual(cust.claimedBy, 'a');
  assert.strictEqual(cust.request, null);

  room.handle('c', { type: 'claim', cid: cust.id }, t);
  room.tick(t + G.HANDOFF_MS + 1);
  assert.strictEqual(cust.request, null, 'unanswered requests expire');
  assert.strictEqual(cust.claimedBy, 'a');
  assert.ok(room.events.some((e) => e.type === 'handoffNo' && e.timeout));

  room.handle('b', { type: 'claim', cid: cust.id }, t + G.HANDOFF_MS + 2);
  room.removePlayer('a');
  assert.strictEqual(cust.claimedBy, 'b', 'the asker inherits the ticket when the holder leaves');
});

test('upgrade shop: buy between days with the shared bank', () => {
  let t = 0;
  const room = new G.Room({ seed: 9, dayLengthMs: 60000 });
  room.addPlayer('a', 'Alice');
  room.addPlayer('b', 'Bob');
  room.startDay('a', t);
  room.money = 100;
  assert.strictEqual(room.handle('a', { type: 'buy', id: 'turbo', level: 0 }, t).ok, false, 'shop is closed during the day');

  room.tick(t + 60000);
  assert.strictEqual(room.phase, 'results');
  assert.ok(room.handle('b', { type: 'buy', id: 'turbo', level: 0 }, t).ok, 'any teammate can buy');
  assert.strictEqual(room.upgrades.turbo, 1);
  assert.strictEqual(room.money, 100 - G.UPGRADES[0].costs[0]);
  assert.strictEqual(room.handle('a', { type: 'buy', id: 'turbo', level: 0 }, t).ok, false, 'stale double click is rejected');
  assert.strictEqual(room.handle('a', { type: 'buy', id: 'nope' }, t).ok, false);
  room.money = 1;
  assert.strictEqual(room.handle('a', { type: 'buy', id: 'premium', level: 0 }, t).ok, false, 'cannot go into debt');
  assert.strictEqual(room.snapshot(t).upgrades.turbo, 1);

  const p = G.perks(room.upgrades);
  assert.ok(p.pourRate > G.BASE_POUR_RATE);
  assert.strictEqual(G.perks({}).pourRate, G.BASE_POUR_RATE);
});

test('premium ingredients raise prices and the lounge adds patience', () => {
  const run = (upgrades) => {
    const room = new G.Room({ seed: 11, dayLengthMs: 600000 });
    room.addPlayer('a', 'Solo');
    Object.assign(room.upgrades, upgrades);
    room.startDay('a', 0);
    room.tick(2000);
    const c = room.customers[0];
    room.handle('a', { type: 'take', cid: c.id }, 2000);
    const res = room.handle('a', { type: 'serve', cid: c.id, drink: perfect(c.order) }, 2000);
    return { price: res.result.price, patience: c.patienceMs };
  };
  const plain = run({});
  const fancy = run({ premium: 2, lounge: 1 });
  assert.strictEqual(fancy.price, plain.price + 2);
  assert.ok(fancy.patience > plain.patience);
});

test('drizzle counts with the toppings', () => {
  const order = { tea: 'classic', sweet: 3, ice: 1, toppings: ['pearls'], drizzle: 'sugar' };
  assert.strictEqual(G.scoreDrink(order, perfect(order)).total, 100);
  const noDrizzle = G.scoreDrink(order, Object.assign(perfect(order), { drizzle: null }));
  assert.strictEqual(noDrizzle.parts.toppings, 13);
  const wrong = G.scoreDrink({ tea: 'classic', sweet: 0, ice: 0, toppings: [] }, { tea: 'classic', fill: G.FILL_TARGET, drizzle: 'honey', shake: 1 });
  assert.strictEqual(wrong.parts.toppings, 13, 'a drizzle nobody asked for costs points');
  assert.strictEqual(G.sanitizeDrink({ drizzle: 'ketchup' }).drizzle, null);
});

test('new teas and toppings unlock by day', () => {
  const rng = G.mulberry32(5);
  for (let i = 0; i < 300; i++) {
    const o = G.makeOrder(rng, 1);
    assert.ok(G.TEAS.find((t) => t.id === o.tea).minDay <= 1);
    assert.ok(o.toppings.every((t) => G.TOPPINGS.find((x) => x.id === t).minDay <= 1));
    assert.strictEqual(o.drizzle, null, 'no drizzles on day 1');
  }
  const late = Array.from({ length: 400 }, () => G.makeOrder(rng, 5));
  assert.ok(late.some((o) => o.tea === 'butterfly'));
  assert.ok(late.some((o) => o.drizzle));
  assert.ok(late.some((o) => o.toppings.length === 3));
});

test('secret recipes: buy one and customers start ordering it for more money', () => {
  const room = new G.Room({ seed: 21, dayLengthMs: 60000 });
  room.addPlayer('a', 'Alice');
  room.startDay('a', 0);
  room.tick(60000);
  room.money = 100;
  assert.strictEqual(room.handle('a', { type: 'recipe', id: 'nope' }, 0).ok, false);
  assert.ok(room.handle('a', { type: 'recipe', id: 'tiger' }, 0).ok);
  assert.strictEqual(room.handle('a', { type: 'recipe', id: 'tiger' }, 0).ok, false, 'cannot buy twice');
  assert.strictEqual(room.money, 75);
  const orders = Array.from({ length: 200 }, () => G.makeOrder(room.rng, 2, room.recipes));
  const tiger = orders.find((o) => o.special === 'tiger');
  assert.ok(tiger, 'customers order the special');
  assert.deepStrictEqual(tiger.toppings, ['pearls']);
  assert.strictEqual(tiger.drizzle, 'sugar');
  assert.ok(G.drinkPrice(tiger, true) > G.drinkPrice(tiger, false));
  assert.ok(!G.makeOrder(G.mulberry32(1), 1, ['tiger']).special, 'specials wait for their ingredients');
});

test('new upgrades: tip jar, golden straws, topping bot', () => {
  const p = G.perks({ tipjar: 2, golden: 1, topbot: 1 });
  assert.strictEqual(p.tipMult, 1.5);
  assert.strictEqual(p.goldBonus, 1.5);
  assert.ok(p.autoTop);
  assert.ok(!G.perks({}).autoTop);
});

function showdownRoom(seed) {
  const room = new G.Room({ seed, dayLengthMs: 120000 });
  room.addPlayer('a', 'Alice');
  room.addPlayer('b', 'Bob');
  return room;
}

function spawnMany(room, n, t) {
  for (let i = 0; i < n; i++) room._spawn(t);
  return room.customers.filter((c) => c.status === 'waiting');
}

test('showdown: only the host picks it, and only in the lobby', () => {
  const room = showdownRoom(1);
  assert.strictEqual(room.handle('b', { type: 'mode', mode: 'showdown' }, 0).ok, false);
  assert.strictEqual(room.handle('a', { type: 'mode', mode: 'chaos' }, 0).ok, false);
  assert.ok(room.handle('a', { type: 'mode', mode: 'showdown' }, 0).ok);
  assert.strictEqual(room.snapshot(0).mode, 'showdown');
  room.startDay('a', 0);
  assert.strictEqual(room.handle('a', { type: 'mode', mode: 'coop' }, 0).ok, false, 'locked once open');
});

test('showdown: one customer at a time, no stealing, separate wallets', () => {
  const room = showdownRoom(2);
  room.setMode('a', 'showdown');
  room.startDay('a', 0);
  const [c1, c2, c3] = spawnMany(room, 3, 100);
  assert.ok(room.handle('a', { type: 'take', cid: c1.id }, 100).ok);
  assert.strictEqual(room.handle('a', { type: 'take', cid: c2.id }, 100).ok, false, 'one ticket at a time');
  assert.ok(room.handle('b', { type: 'take', cid: c2.id }, 100).ok);
  const steal = room.handle('b', { type: 'claim', cid: c1.id }, 100);
  assert.strictEqual(steal.ok, false, 'no handoff requests in showdown');
  assert.strictEqual(c1.request, null);
  assert.strictEqual(room.handle('b', { type: 'serve', cid: c1.id, drink: perfect(c1.order) }, 100).ok, false);

  const r = room.handle('a', { type: 'serve', cid: c1.id, drink: perfect(c1.order) }, 200);
  assert.ok(r.ok);
  assert.strictEqual(room.players.get('a').money, r.result.earned);
  assert.strictEqual(room.players.get('b').money, 0);
  assert.strictEqual(room.money, 0, 'the team bank is not used');
  assert.ok(room.handle('a', { type: 'take', cid: c3.id }, 300).ok, 'free to take the next one');
  assert.ok(room.events.some((e) => e.type === 'lead' && e.pid === 'a'));
});

test('showdown: streaks, final rush, placement bonus and ready-up', () => {
  const room = showdownRoom(3);
  room.setMode('a', 'showdown');
  room.startDay('a', 0);
  const serveOne = (pid, t) => {
    const [c] = spawnMany(room, 1, t);
    room.handle(pid, { type: 'take', cid: c.id }, t);
    return room.handle(pid, { type: 'serve', cid: c.id, drink: perfect(c.order) }, t).result;
  };
  serveOne('a', 1000);
  serveOne('a', 1000);
  const third = serveOne('a', 1000);
  assert.strictEqual(third.streak, 3);
  assert.strictEqual(third.bonus, 1, 'hot streak bonus');
  room.tick(room.dayEndsAt - G.RUSH_MS + 1);
  assert.ok(room.rushOn);
  const rushed = serveOne('b', room.dayEndsAt - 1000);
  assert.ok(rushed.rush);

  room.tick(room.dayEndsAt);
  assert.strictEqual(room.phase, 'results');
  const res = room.lastResults;
  assert.strictEqual(res.mode, 'showdown');
  assert.strictEqual(res.players[0].id, 'a');
  assert.strictEqual(res.players[0].placeBonus, G.placeBonus(0, 1));
  assert.strictEqual(res.players[1].placeBonus, G.placeBonus(1, 1));
  assert.ok(room.players.get('a').money > res.players[0].earned, 'bonus lands in the wallet');

  // each player shops for themselves
  room.players.get('b').money = 20;
  assert.ok(room.handle('b', { type: 'buy', id: 'turbo', level: 0 }, 0).ok);
  assert.strictEqual(room.players.get('b').upgrades.turbo, 1);
  assert.strictEqual(room.players.get('a').upgrades.turbo, 0);
  assert.strictEqual(room.upgrades.turbo, 0);

  assert.strictEqual(room.handle('a', { type: 'start' }, 0).ok, false, 'the host cannot skip the ready-up');
  assert.ok(room.handle('a', { type: 'ready', ready: true }, 0).ok);
  assert.strictEqual(room.phase, 'results');
  room.handle('b', { type: 'ready', ready: true }, 0);
  assert.strictEqual(room.phase, 'playing', 'everyone ready opens the next day');
  assert.strictEqual(room.day, 2);
  assert.ok([...room.players.values()].every((p) => !p.ready));
});

test('showdown: a player leaving while others are ready starts the day', () => {
  const room = showdownRoom(4);
  room.addPlayer('c', 'Cleo');
  room.setMode('a', 'showdown');
  room.startDay('a', 0);
  room.tick(room.dayEndsAt);
  room.handle('a', { type: 'ready', ready: true }, 0);
  room.handle('b', { type: 'ready', ready: true }, 0);
  room.removePlayer('c');
  room.tick(1);
  assert.strictEqual(room.phase, 'playing');
});

test('showdown: every player has a customer waiting when the day opens', () => {
  const room = showdownRoom(6);
  room.addPlayer('c', 'Cleo');
  room.setMode('a', 'showdown');
  room.startDay('a', 0);
  const waiting = room.customers.filter((c) => c.status === 'waiting');
  assert.strictEqual(waiting.length, 3, 'one per player');
  for (const [pid, c] of [['a', waiting[0]], ['b', waiting[1]], ['c', waiting[2]]]) {
    assert.ok(room.handle(pid, { type: 'take', cid: c.id }, 10).ok);
  }
  room.tick(1000);
  assert.strictEqual(room.customers.length, 3, 'the next one still waits for the spawn timer');

  // the same goes for every later day
  room.tick(room.dayEndsAt);
  for (const pid of ['a', 'b', 'c']) room.handle(pid, { type: 'ready', ready: true }, 0);
  assert.strictEqual(room.day, 2);
  assert.strictEqual(room.customers.filter((c) => c.status === 'waiting').length, 3);
});

test('co-op opens the day with an empty counter', () => {
  const room = showdownRoom(7);
  room.startDay('a', 0);
  assert.strictEqual(room.customers.length, 0);
});

test('showdown: Mix-O-Matic and Topping Bot are co-op only', () => {
  const room = showdownRoom(8);
  room.setMode('a', 'showdown');
  room.startDay('a', 0);
  room.tick(room.dayEndsAt);
  room.players.get('a').money = 500;
  for (const id of ['mixer', 'topbot']) {
    const r = room.handle('a', { type: 'buy', id, level: 0 }, 0);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /co-op only/);
    assert.strictEqual(room.players.get('a').upgrades[id], 0);
  }
  assert.strictEqual(room.players.get('a').money, 500, 'nothing was charged');
  assert.ok(room.handle('a', { type: 'buy', id: 'turbo', level: 0 }, 0).ok, 'other upgrades still sell');
  const owned = { mixer: 1, topbot: 1, turbo: 1 };
  assert.ok(!G.perks(owned, true).autoMix && !G.perks(owned, true).autoTop, 'no effect in a showdown');
  assert.ok(G.perks(owned, false).autoMix && G.perks(owned, false).autoTop);
  assert.strictEqual(G.perks(owned, true).pourRate, G.perks(owned, false).pourRate);

  const coop = showdownRoom(9);
  coop.startDay('a', 0);
  coop.tick(coop.dayEndsAt);
  coop.money = 500;
  assert.ok(coop.handle('a', { type: 'buy', id: 'mixer', level: 0 }, 0).ok, 'co-op can still buy them');
});

test('co-op ignores ready-up and keeps the shared bank', () => {
  const room = showdownRoom(5);
  room.startDay('a', 0);
  room.tick(room.dayEndsAt);
  assert.strictEqual(room.handle('a', { type: 'ready', ready: true }, 0).ok, false);
  assert.ok(room.handle('a', { type: 'start' }, 0).ok);
});
