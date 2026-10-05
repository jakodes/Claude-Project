/*
 * Boba Rush shared game rules.
 * Loaded by the Node server (require) and by the browser (window.BobaGame),
 * so solo play and online rooms run exactly the same logic.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BobaGame = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TEAS = [
    { id: 'classic', name: 'Classic Milk Tea', color: '#c9a27c' },
    { id: 'matcha', name: 'Matcha Latte', color: '#9cc46f' },
    { id: 'taro', name: 'Taro', color: '#b79ddb' },
    { id: 'thai', name: 'Thai Tea', color: '#f29e52' },
    { id: 'strawberry', name: 'Strawberry', color: '#f59db3' },
    { id: 'mango', name: 'Mango Green', color: '#f6cc4f' },
  ];

  const TOPPINGS = [
    { id: 'pearls', name: 'Tapioca Pearls', color: '#3a2419', minDay: 1 },
    { id: 'popping', name: 'Popping Boba', color: '#ff5d8f', minDay: 1 },
    { id: 'jelly', name: 'Lychee Jelly', color: '#eef3d2', minDay: 1 },
    { id: 'pudding', name: 'Egg Pudding', color: '#f3bf3a', minDay: 2 },
    { id: 'redbean', name: 'Red Bean', color: '#8a2c2c', minDay: 2 },
    { id: 'foam', name: 'Cheese Foam', color: '#fff4dc', minDay: 3 },
  ];

  const SWEETNESS = [0, 25, 50, 75, 100];
  const ICE = ['No Ice', 'Less Ice', 'Regular Ice'];
  const FILL_TARGET = 0.8;
  const FILL_TOLERANCE = 0.2;
  const MAX_TOPPINGS = 3;
  const MAX_PLAYERS = 6;
  const DAY_LENGTH_MS = 150000;
  const HANDOFF_MS = 15000;
  const BASE_POUR_RATE = 0.32; // cup fraction per second
  const PLAYER_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b'];
  const EMOTES = ['👍', '🔥', '😱', '🙏', '😂', '❤️'];
  const STATIONS = ['counter', 'brew', 'mix', 'toppings', 'shake'];

  // Bought with the shared bank between days. costs[i] is the price of level i + 1.
  const UPGRADES = [
    { id: 'turbo', name: 'Turbo Taps', icon: '⚡', desc: 'Tea pours 30% faster per level.', costs: [15, 30, 50] },
    { id: 'spout', name: 'Smart Spout', icon: '🎯', desc: 'Taps shut off by themselves right at the fill line.', costs: [45] },
    { id: 'mixer', name: 'Mix-O-Matic', icon: '🤖', desc: 'One button sets sweetness and ice to match your ticket.', costs: [35] },
    { id: 'shaker', name: 'Pro Shaker', icon: '🌀', desc: 'Bigger green zone and a calmer needle per level.', costs: [12, 25, 45] },
    { id: 'premium', name: 'Premium Ingredients', icon: '💎', desc: 'Every drink sells for $1 more per level.', costs: [25, 50, 80] },
    { id: 'lounge', name: 'Comfy Lounge', icon: '🛋️', desc: 'Customers wait 15% longer per level.', costs: [20, 40] },
  ];

  /** What the owned upgrade levels actually do. Used by the rules and by the client stations. */
  function perks(levels) {
    const L = (id) => (levels && levels[id]) || 0;
    return {
      pourRate: BASE_POUR_RATE * (1 + 0.3 * L('turbo')),
      autoStop: L('spout') > 0,
      autoMix: L('mixer') > 0,
      shakeHalfZone: 0.09 + 0.025 * L('shaker'),
      shakeGrace: 0.03 + 0.025 * L('shaker'),
      shakeSpeed: 1 - 0.12 * L('shaker'),
      bonusPrice: L('premium'),
      patience: 1 + 0.15 * L('lounge'),
    };
  }

  const CUSTOMER_NAMES = [
    'Mochi', 'Kiwi', 'Juniper', 'Bao', 'Pixel', 'Marlo', 'Suki', 'Remy', 'Tofu', 'Nova',
    'Ollie', 'Yuzu', 'Ziggy', 'Poppy', 'Dash', 'Maple', 'Kai', 'Luna', 'Biscuit', 'Rio',
    'Sprout', 'Indie', 'Taffy', 'Momo', 'Ace', 'Clover', 'Echo', 'Fig', 'Hazel', 'Jett',
  ];
  const SKIN = ['#f6d3b3', '#e8b48c', '#c98e62', '#a8693f', '#7a4a2a', '#ffe0c7'];
  const HAIR = ['#2b1d14', '#5a3825', '#c7883b', '#e8c872', '#d9534f', '#6c5ce7', '#1e90ff', '#f8f8f8'];
  const SHIRT = ['#ff8fab', '#74c0fc', '#8ce99a', '#ffd43b', '#b197fc', '#ffa94d', '#63e6be', '#ced4da'];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const round2 = (v) => Math.round(v * 100) / 100;

  function makeOrder(rng, day) {
    const pool = TOPPINGS.filter((t) => t.minDay <= day);
    const maxTop = day <= 1 ? 1 : 2;
    const count = Math.floor(rng() * (maxTop + 1));
    const toppings = [];
    while (toppings.length < count) {
      const t = pick(rng, pool).id;
      if (!toppings.includes(t)) toppings.push(t);
    }
    return {
      tea: pick(rng, TEAS).id,
      sweet: Math.floor(rng() * SWEETNESS.length),
      ice: Math.floor(rng() * ICE.length),
      toppings,
    };
  }

  function makeLook(rng) {
    return {
      skin: pick(rng, SKIN),
      hair: pick(rng, HAIR),
      shirt: pick(rng, SHIRT),
      style: Math.floor(rng() * 4),
      glasses: rng() < 0.25,
    };
  }

  /**
   * Score a finished drink against an order. Returns 0..100 plus a breakdown.
   * drink: { tea, fill (0..1), sweet (0..4), ice (0..2), toppings [ids], shake (0..1) }
   */
  function scoreDrink(order, drink) {
    const d = sanitizeDrink(drink);
    const parts = {};
    parts.tea = d.tea === order.tea ? 20 : 0;
    parts.fill = d.tea ? Math.round(15 * clamp(1 - Math.abs(d.fill - FILL_TARGET) / FILL_TOLERANCE, 0, 1)) : 0;
    const sweetOff = Math.abs(d.sweet - order.sweet);
    parts.sweet = sweetOff === 0 ? 15 : sweetOff === 1 ? 7 : 0;
    const iceOff = Math.abs(d.ice - order.ice);
    parts.ice = iceOff === 0 ? 10 : iceOff === 1 ? 4 : 0;
    if (order.toppings.length === 0) {
      parts.toppings = Math.round(25 * Math.max(0, 1 - d.toppings.length * 0.5));
    } else {
      const hits = d.toppings.filter((t) => order.toppings.includes(t)).length;
      const extras = d.toppings.length - hits;
      parts.toppings = Math.round(25 * Math.max(0, (hits - extras * 0.5) / order.toppings.length));
    }
    parts.shake = Math.round(15 * d.shake);
    const total = parts.tea + parts.fill + parts.sweet + parts.ice + parts.toppings + parts.shake;
    return { total, parts, stars: total >= 90 ? 3 : total >= 70 ? 2 : total >= 45 ? 1 : 0 };
  }

  function sanitizeDrink(drink) {
    const d = drink && typeof drink === 'object' ? drink : {};
    const toppings = Array.isArray(d.toppings)
      ? [...new Set(d.toppings.filter((t) => TOPPINGS.some((x) => x.id === t)))].slice(0, MAX_TOPPINGS)
      : [];
    return {
      tea: TEAS.some((t) => t.id === d.tea) ? d.tea : null,
      fill: clamp(Number(d.fill) || 0, 0, 1),
      sweet: clamp(Math.round(Number(d.sweet) || 0), 0, SWEETNESS.length - 1),
      ice: clamp(Math.round(Number(d.ice) || 0), 0, ICE.length - 1),
      toppings,
      shake: clamp(Number(d.shake) || 0, 0, 1),
    };
  }

  function drinkPrice(order) {
    return 4 + order.toppings.length * 0.75;
  }

  function gradeFor(stats) {
    const total = stats.served + stats.lost;
    if (total === 0) return 'C';
    const avg = stats.served ? stats.scoreSum / stats.served : 0;
    const kept = stats.served / total;
    const v = avg * (0.4 + 0.6 * kept);
    if (v >= 88) return 'S';
    if (v >= 75) return 'A';
    if (v >= 60) return 'B';
    if (v >= 40) return 'C';
    return 'D';
  }

  class Room {
    constructor(opts = {}) {
      this.code = opts.code || 'SOLO';
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
      this.dayLengthMs = opts.dayLengthMs || DAY_LENGTH_MS;
      this.players = new Map();
      this.hostId = null;
      this.phase = 'lobby';
      this.day = 0;
      this.money = 0;
      this.upgrades = Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));
      this.customers = [];
      this.nextCustomerId = 1;
      this.dayEndsAt = 0;
      this.nextSpawnAt = 0;
      this.stats = null;
      this.lastResults = null;
      this.events = [];
      this.eventSeq = 0;
      this.version = 0;
    }

    _event(type, data) {
      this.events.push(Object.assign({ id: ++this.eventSeq, type }, data));
      if (this.events.length > 30) this.events.shift();
    }

    _bump() {
      this.version++;
    }

    addPlayer(id, name) {
      if (this.players.has(id)) return { ok: true };
      if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };
      const used = new Set([...this.players.values()].map((p) => p.color));
      const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
      const clean = String(name || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16) || 'Barista';
      this.players.set(id, {
        id, name: clean, color, station: 'counter',
        served: 0, earned: 0, perfects: 0, scoreSum: 0,
      });
      if (!this.hostId) this.hostId = id;
      this._event('join', { pid: id, name: clean });
      this._bump();
      return { ok: true };
    }

    removePlayer(id) {
      const p = this.players.get(id);
      if (!p) return;
      this.players.delete(id);
      for (const c of this.customers) {
        if (c.request && c.request.from === id) c.request = null;
        if (c.claimedBy === id) {
          // if someone was asking for this ticket, they get it
          c.claimedBy = c.request ? c.request.from : null;
          c.request = null;
        }
      }
      if (this.hostId === id) this.hostId = this.players.keys().next().value || null;
      this._event('leave', { pid: id, name: p.name });
      this._bump();
    }

    startDay(pid, now) {
      if (pid !== this.hostId) return { ok: false, error: 'Only the host can open the shop' };
      if (this.phase === 'playing') return { ok: false, error: 'Shop is already open' };
      this.day++;
      this.phase = 'playing';
      this.customers = [];
      this.dayEndsAt = now + this.dayLengthMs;
      this.nextSpawnAt = now + 1200;
      this.stats = { served: 0, lost: 0, money: 0, perfects: 0, scoreSum: 0 };
      for (const p of this.players.values()) Object.assign(p, { served: 0, earned: 0, perfects: 0, scoreSum: 0 });
      this._event('dayStart', { day: this.day });
      this._bump();
      return { ok: true };
    }

    _spawnInterval() {
      const n = Math.max(1, this.players.size);
      const base = Math.max(6500, 15000 - (this.day - 1) * 1400);
      return (base / (1 + 0.7 * (n - 1))) * (0.75 + this.rng() * 0.5);
    }

    _maxLine() {
      return Math.min(8, 3 + this.players.size);
    }

    tick(now) {
      if (this.phase !== 'playing') return false;
      const before = this.version;
      if (now >= this.dayEndsAt) {
        this._endDay(now);
        return true;
      }
      const active = this.customers.filter((c) => c.status === 'waiting' || c.status === 'ordered');
      if (now >= this.nextSpawnAt && active.length < this._maxLine() && now < this.dayEndsAt - 8000) {
        this._spawn(now);
        this.nextSpawnAt = now + this._spawnInterval();
      } else if (now >= this.nextSpawnAt) {
        this.nextSpawnAt = now + 1500;
      }
      for (const c of active) {
        if (c.request && now >= c.request.expiresAt) {
          this._event('handoffNo', { cid: c.id, from: c.claimedBy, to: c.request.from, timeout: true });
          c.request = null;
          this._bump();
        }
        if (now >= c.leaveAt) {
          c.status = 'left';
          c.doneAt = now;
          this.stats.lost++;
          this._event('left', { cid: c.id, name: c.name });
          this._bump();
        }
      }
      // forget customers who finished a while ago
      const keep = this.customers.filter((c) => !c.doneAt || now - c.doneAt < 4000);
      if (keep.length !== this.customers.length) {
        this.customers = keep;
        this._bump();
      }
      return this.version !== before;
    }

    _spawn(now) {
      const order = makeOrder(this.rng, this.day);
      const base = Math.max(50000, 80000 - (this.day - 1) * 5000) + order.toppings.length * 6000;
      const patienceMs = Math.round(base * perks(this.upgrades).patience);
      const c = {
        id: this.nextCustomerId++,
        name: pick(this.rng, CUSTOMER_NAMES),
        look: makeLook(this.rng),
        order,
        status: 'waiting',
        arrivedAt: now,
        patienceMs,
        leaveAt: now + patienceMs,
        claimedBy: null,
        request: null,
        doneAt: 0,
      };
      this.customers.push(c);
      this._event('arrive', { cid: c.id, name: c.name });
      this._bump();
    }

    _endDay(now) {
      this.phase = 'results';
      for (const c of this.customers) {
        if (c.status === 'waiting' || c.status === 'ordered') {
          c.status = 'left';
          c.doneAt = now;
        }
      }
      const players = [...this.players.values()]
        .map((p) => ({
          id: p.id, name: p.name, color: p.color, served: p.served,
          earned: round2(p.earned), perfects: p.perfects,
          avg: p.served ? Math.round(p.scoreSum / p.served) : 0,
        }))
        .sort((a, b) => b.earned - a.earned);
      this.lastResults = {
        day: this.day,
        served: this.stats.served,
        lost: this.stats.lost,
        money: round2(this.stats.money),
        perfects: this.stats.perfects,
        avg: this.stats.served ? Math.round(this.stats.scoreSum / this.stats.served) : 0,
        grade: gradeFor(this.stats),
        players,
      };
      this._event('dayEnd', { day: this.day });
      this._bump();
    }

    _customer(cid) {
      return this.customers.find((c) => c.id === cid);
    }

    takeOrder(pid, cid) {
      if (this.phase !== 'playing') return { ok: false, error: 'Shop is closed' };
      const c = this._customer(cid);
      if (!c || c.status !== 'waiting') return { ok: false, error: 'That customer is not waiting' };
      c.status = 'ordered';
      c.claimedBy = this.players.has(pid) ? pid : null;
      c.leaveAt += 8000; // a little extra patience once someone has listened to them
      this._event('ordered', { cid, pid });
      this._bump();
      return { ok: true };
    }

    /**
     * Pick up a ticket. Open tickets are claimed straight away. A ticket someone else
     * already holds never switches owner here: the holder gets a request to pass it over.
     */
    claim(pid, cid, now) {
      const c = this._customer(cid);
      if (!c || c.status !== 'ordered') return { ok: false, error: 'No such ticket' };
      if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
      const owner = c.claimedBy ? this.players.get(c.claimedBy) : null;
      if (!owner || c.claimedBy === pid) {
        if (c.claimedBy !== pid) {
          c.claimedBy = pid;
          c.request = null;
          this._bump();
        }
        return { ok: true, claimed: true };
      }
      if (c.request && c.request.from === pid) return { ok: true, pending: true, owner: owner.name };
      if (c.request) {
        const asker = this.players.get(c.request.from);
        return { ok: false, error: `${asker ? asker.name : 'Someone'} already asked for this one` };
      }
      c.request = { from: pid, expiresAt: now + HANDOFF_MS };
      this._event('handoffAsk', { cid, from: pid, to: c.claimedBy });
      this._bump();
      return { ok: true, pending: true, owner: owner.name };
    }

    /** The ticket holder answers a request to pass their ticket over. */
    respondHandoff(pid, cid, accept) {
      const c = this._customer(cid);
      if (!c || c.status !== 'ordered' || !c.request) return { ok: false, error: 'That request is gone' };
      if (c.claimedBy !== pid) return { ok: false, error: 'That is not your ticket' };
      const to = c.request.from;
      c.request = null;
      if (accept && this.players.has(to)) {
        c.claimedBy = to;
        this._event('handoff', { cid, from: pid, to });
      } else {
        this._event('handoffNo', { cid, from: pid, to });
      }
      this._bump();
      return { ok: true };
    }

    /** Spend the shared bank on an upgrade. Only between days. */
    buyUpgrade(pid, uid, seenLevel) {
      if (this.phase !== 'results') return { ok: false, error: 'The upgrade shop opens at the end of each day' };
      if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
      const u = UPGRADES.find((x) => x.id === uid);
      if (!u) return { ok: false, error: 'No such upgrade' };
      const level = this.upgrades[uid];
      // two teammates clicking the same card at once should not buy two levels
      if (seenLevel != null && Number(seenLevel) !== level) return { ok: false, error: 'A teammate just bought that one' };
      if (level >= u.costs.length) return { ok: false, error: 'Already maxed out' };
      const cost = u.costs[level];
      if (this.money + 1e-9 < cost) return { ok: false, error: 'Not enough money in the bank' };
      this.money = round2(this.money - cost);
      this.upgrades[uid] = level + 1;
      this._event('upgrade', { pid, uid, level: level + 1, cost });
      this._bump();
      return { ok: true, level: level + 1 };
    }

    serve(pid, cid, drink, now) {
      if (this.phase !== 'playing') return { ok: false, error: 'Shop is closed' };
      const c = this._customer(cid);
      if (!c || c.status !== 'ordered') return { ok: false, error: 'That order is gone' };
      const owner = c.claimedBy && c.claimedBy !== pid ? this.players.get(c.claimedBy) : null;
      if (owner) return { ok: false, error: `That is ${owner.name}'s ticket. Ask them to pass it over.` };
      const result = scoreDrink(c.order, drink);
      const patience = clamp((c.leaveAt - now) / c.patienceMs, 0, 1);
      const quality = result.total / 100;
      const full = drinkPrice(c.order) + perks(this.upgrades).bonusPrice;
      const price = quality >= 0.45 ? full : full * 0.5;
      const tip = quality * quality * 5 * (0.4 + 0.6 * patience);
      const earned = round2(price + tip);
      c.status = 'served';
      c.doneAt = now;
      c.stars = result.stars;
      this.money = round2(this.money + earned);
      this.stats.served++;
      this.stats.money += earned;
      this.stats.scoreSum += result.total;
      if (result.stars === 3) this.stats.perfects++;
      const p = this.players.get(pid);
      if (p) {
        p.served++;
        p.earned += earned;
        p.scoreSum += result.total;
        if (result.stars === 3) p.perfects++;
      }
      this._event('served', { cid, pid, name: c.name, stars: result.stars, earned });
      this._bump();
      return { ok: true, result: Object.assign({}, result, { earned, tip: round2(tip), price: round2(price), name: c.name }) };
    }

    setStation(pid, station) {
      const p = this.players.get(pid);
      if (!p || !STATIONS.includes(station) || p.station === station) return { ok: true };
      p.station = station;
      this._bump();
      return { ok: true };
    }

    emote(pid, emote) {
      if (!this.players.has(pid) || !EMOTES.includes(emote)) return { ok: false };
      this._event('emote', { pid, emote });
      this._bump();
      return { ok: true };
    }

    /** Apply an action coming from a player. */
    handle(pid, action, now) {
      if (!action || typeof action !== 'object') return { ok: false, error: 'Bad action' };
      switch (action.type) {
        case 'start': return this.startDay(pid, now);
        case 'take': return this.takeOrder(pid, Number(action.cid));
        case 'claim': return this.claim(pid, Number(action.cid), now);
        case 'respond': return this.respondHandoff(pid, Number(action.cid), action.accept === true);
        case 'buy': return this.buyUpgrade(pid, String(action.id), action.level);
        case 'serve': return this.serve(pid, Number(action.cid), action.drink, now);
        case 'station': return this.setStation(pid, action.station);
        case 'emote': return this.emote(pid, action.emote);
        default: return { ok: false, error: 'Unknown action' };
      }
    }

    snapshot(now) {
      return {
        code: this.code,
        now,
        version: this.version,
        phase: this.phase,
        day: this.day,
        money: this.money,
        hostId: this.hostId,
        dayEndsAt: this.dayEndsAt,
        dayLengthMs: this.dayLengthMs,
        upgrades: Object.assign({}, this.upgrades),
        players: [...this.players.values()].map((p) => ({
          id: p.id, name: p.name, color: p.color, station: p.station,
          served: p.served, earned: round2(p.earned),
        })),
        customers: this.customers.map((c) => ({
          id: c.id, name: c.name, look: c.look, status: c.status,
          order: c.status === 'waiting' ? null : c.order,
          arrivedAt: c.arrivedAt, leaveAt: c.leaveAt, patienceMs: c.patienceMs,
          claimedBy: c.claimedBy, stars: c.stars,
          request: c.request ? { from: c.request.from, expiresAt: c.request.expiresAt } : null,
        })),
        stats: this.stats,
        results: this.lastResults,
        events: this.events.slice(-15),
      };
    }
  }

  return {
    TEAS, TOPPINGS, SWEETNESS, ICE, FILL_TARGET, FILL_TOLERANCE, MAX_TOPPINGS, MAX_PLAYERS,
    DAY_LENGTH_MS, HANDOFF_MS, BASE_POUR_RATE, EMOTES, STATIONS, PLAYER_COLORS, UPGRADES,
    Room, scoreDrink, sanitizeDrink, makeOrder, mulberry32, gradeFor, perks,
  };
});
