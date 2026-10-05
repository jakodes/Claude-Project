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
    { id: 'classic', name: 'Classic Milk Tea', short: 'Classic', color: '#c9a27c', minDay: 1 },
    { id: 'matcha', name: 'Matcha Latte', short: 'Matcha', color: '#9cc46f', minDay: 1 },
    { id: 'taro', name: 'Taro', short: 'Taro', color: '#b79ddb', minDay: 1 },
    { id: 'thai', name: 'Thai Tea', short: 'Thai', color: '#f29e52', minDay: 1 },
    { id: 'strawberry', name: 'Strawberry', short: 'Berry', color: '#f59db3', minDay: 1 },
    { id: 'mango', name: 'Mango Green', short: 'Mango', color: '#f6cc4f', minDay: 1 },
    { id: 'brown', name: 'Brown Sugar Milk', short: 'Brown Sugar', color: '#b07a4f', minDay: 2 },
    { id: 'honeydew', name: 'Honeydew', short: 'Honeydew', color: '#bfe6a3', minDay: 2 },
    { id: 'coconut', name: 'Coconut Milk', short: 'Coconut', color: '#efe6d2', minDay: 3 },
    { id: 'butterfly', name: 'Butterfly Pea', short: 'Butterfly', color: '#6f86e0', minDay: 3 },
  ];

  const TOPPINGS = [
    { id: 'pearls', name: 'Tapioca Pearls', short: 'Pearls', color: '#3a2419', minDay: 1 },
    { id: 'popping', name: 'Popping Boba', short: 'Popping', color: '#ff5d8f', minDay: 1 },
    { id: 'jelly', name: 'Lychee Jelly', short: 'Lychee', color: '#eef3d2', minDay: 1 },
    { id: 'pudding', name: 'Egg Pudding', short: 'Pudding', color: '#f3bf3a', minDay: 2 },
    { id: 'redbean', name: 'Red Bean', short: 'Red Bean', color: '#8a2c2c', minDay: 2 },
    { id: 'foam', name: 'Cheese Foam', short: 'Foam', color: '#fff4dc', minDay: 3 },
    { id: 'crystal', name: 'Crystal Boba', short: 'Crystal', color: '#e4eeff', minDay: 3 },
    { id: 'aloe', name: 'Aloe Vera', short: 'Aloe', color: '#cfeab0', minDay: 3 },
    { id: 'grass', name: 'Grass Jelly', short: 'Grass', color: '#2f3b2a', minDay: 4 },
    { id: 'cookie', name: 'Cookie Crumble', short: 'Cookie', color: '#3b2f2f', minDay: 4 },
  ];

  // drizzled down the inside of the cup before the tea goes in
  const DRIZZLES = [
    { id: 'sugar', name: 'Brown Sugar', short: 'Sugar', color: '#6b3410', minDay: 2 },
    { id: 'caramel', name: 'Caramel', short: 'Caramel', color: '#c9792b', minDay: 2 },
    { id: 'choco', name: 'Chocolate', short: 'Choco', color: '#4a2a1a', minDay: 3 },
    { id: 'honey', name: 'Honey', short: 'Honey', color: '#f0b429', minDay: 3 },
  ];

  // Secret recipes. Bought in the shop; once owned, customers start asking for them and pay extra.
  const SPECIALS = [
    { id: 'tiger', name: 'Tiger Sugar', icon: '🐯', cost: 25, bonus: 2.5, minDay: 2, desc: 'Brown sugar stripes over milk tea and pearls.',
      recipe: { tea: 'classic', sweet: 3, ice: 1, toppings: ['pearls'], drizzle: 'sugar' } },
    { id: 'cloud', name: 'Taro Cloud', icon: '☁️', cost: 35, bonus: 3, minDay: 3, desc: 'Taro with egg pudding under a cheese foam cloud.',
      recipe: { tea: 'taro', sweet: 2, ice: 1, toppings: ['pudding', 'foam'], drizzle: null } },
    { id: 'zen', name: 'Matcha Zen', icon: '🍵', cost: 35, bonus: 3, minDay: 3, desc: 'Barely sweet matcha, red bean, foam and honey.',
      recipe: { tea: 'matcha', sweet: 1, ice: 0, toppings: ['redbean', 'foam'], drizzle: 'honey' } },
    { id: 'sunrise', name: 'Mango Sunrise', icon: '🌅', cost: 40, bonus: 3.5, minDay: 3, desc: 'Mango green loaded with lychee, popping boba and aloe.',
      recipe: { tea: 'mango', sweet: 3, ice: 2, toppings: ['jelly', 'popping', 'aloe'], drizzle: null } },
    { id: 'galaxy', name: 'Galaxy Fizz', icon: '🌌', cost: 45, bonus: 4, minDay: 3, desc: 'Butterfly pea with popping and crystal boba, honey swirl.',
      recipe: { tea: 'butterfly', sweet: 2, ice: 2, toppings: ['popping', 'crystal'], drizzle: 'honey' } },
    { id: 'cookies', name: 'Cookies & Cream', icon: '🍪', cost: 50, bonus: 4.5, minDay: 4, desc: 'Coconut milk, cookie crumble, pearls and chocolate.',
      recipe: { tea: 'coconut', sweet: 3, ice: 1, toppings: ['cookie', 'pearls'], drizzle: 'choco' } },
  ];

  const SWEETNESS = [0, 25, 50, 75, 100];
  const ICE = ['No Ice', 'Less Ice', 'Regular Ice'];
  const MODES = ['coop', 'showdown'];
  const FILL_TARGET = 0.8;
  const FILL_TOLERANCE = 0.2;
  const MAX_TOPPINGS = 3;
  const MAX_PLAYERS = 6;
  const DAY_LENGTH_MS = 150000;
  const HANDOFF_MS = 15000;
  const RUSH_MS = 30000; // showdown: the last 30 seconds pay more
  const RUSH_MULT = 1.25;
  const BASE_POUR_RATE = 0.32; // cup fraction per second
  const PLAYER_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8', '#ff922b'];
  const EMOTES = ['👍', '🔥', '😱', '🙏', '😂', '❤️', '😎', '💀', '🧋'];
  const STATIONS = ['counter', 'brew', 'mix', 'toppings', 'shake'];

  // Bought between days. costs[i] is the price of level i + 1. coopOnly upgrades can't be bought in a showdown.
  const UPGRADES = [
    { id: 'turbo', name: 'Turbo Taps', icon: '⚡', desc: 'Tea pours 30% faster per level.', costs: [15, 30, 50] },
    { id: 'spout', name: 'Smart Spout', icon: '🎯', desc: 'Taps shut off by themselves right at the fill line.', costs: [45] },
    { id: 'mixer', name: 'Mix-O-Matic', icon: '🤖', desc: 'One tap sets sweetness, ice and drizzle to match your ticket.', costs: [35], coopOnly: true },
    { id: 'topbot', name: 'Topping Bot', icon: '🦾', desc: 'One tap scoops every topping on your ticket.', costs: [55], coopOnly: true },
    { id: 'shaker', name: 'Pro Shaker', icon: '🌀', desc: 'Bigger green zone and a calmer needle per level.', costs: [12, 25, 45] },
    { id: 'premium', name: 'Premium Ingredients', icon: '💎', desc: 'Every drink sells for $1 more per level.', costs: [25, 50, 80] },
    { id: 'tipjar', name: 'Tip Jar', icon: '🫙', desc: 'Tips are 25% bigger per level.', costs: [18, 36, 60] },
    { id: 'golden', name: 'Golden Straws', icon: '✨', desc: 'Perfect 3-star drinks earn $1.50 extra per level.', costs: [30, 60] },
    { id: 'lounge', name: 'Comfy Lounge', icon: '🛋️', desc: 'Customers wait 15% longer per level.', costs: [20, 40] },
  ];

  /** What the owned upgrade levels actually do. Used by the rules and by the client stations.
   *  In a showdown the co-op only upgrades do nothing, even if somehow owned. */
  function perks(levels, showdown) {
    const L = (id) => (showdown && UPGRADES.some((u) => u.id === id && u.coopOnly) ? 0 : (levels && levels[id]) || 0);
    return {
      pourRate: BASE_POUR_RATE * (1 + 0.3 * L('turbo')),
      autoStop: L('spout') > 0,
      autoMix: L('mixer') > 0,
      autoTop: L('topbot') > 0,
      shakeHalfZone: 0.09 + 0.025 * L('shaker'),
      shakeGrace: 0.03 + 0.025 * L('shaker'),
      shakeSpeed: 1 - 0.12 * L('shaker'),
      bonusPrice: L('premium'),
      tipMult: 1 + 0.25 * L('tipjar'),
      goldBonus: 1.5 * L('golden'),
      patience: 1 + 0.15 * L('lounge'),
    };
  }

  const CUSTOMER_NAMES = [
    'Mochi', 'Kiwi', 'Juniper', 'Bao', 'Pixel', 'Marlo', 'Suki', 'Remy', 'Tofu', 'Nova',
    'Ollie', 'Yuzu', 'Ziggy', 'Poppy', 'Dash', 'Maple', 'Kai', 'Luna', 'Biscuit', 'Rio',
    'Sprout', 'Indie', 'Taffy', 'Momo', 'Ace', 'Clover', 'Echo', 'Fig', 'Hazel', 'Jett',
    'Priya', 'Mateo', 'Amara', 'Hiro', 'Zara', 'Felix', 'Noor', 'Theo', 'Ines', 'Kofi',
  ];
  const SKIN = ['#f8dcc4', '#f1c7a5', '#e3ad86', '#c98d63', '#a5683f', '#7d4a2b', '#5c3520'];
  const HAIR_NATURAL = ['#1f1612', '#2e1d14', '#4a2f1d', '#6e4628', '#a8743e', '#d9b46a', '#8c2f1e', '#cfc6bb'];
  const HAIR_DYED = ['#6c4fc9', '#2f7fd1', '#e8679b', '#2bb3a0'];
  const SHIRT = ['#ff8fab', '#5aa9e6', '#7bd389', '#ffd166', '#a78bfa', '#ff9f5a', '#4ecdc4', '#e9ecef', '#2b2d42', '#c1121f', '#606c38', '#f4a261'];
  const EYES = ['#3b2414', '#5a3a1e', '#2f6f8f', '#3f7a4a', '#7a5c2e', '#1d1d1d'];
  const HAIR_STYLES = 9;
  const OUTFITS = 5;

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
  const special = (id) => SPECIALS.find((s) => s.id === id) || null;

  /** A random order. `specials` are the recipe ids customers are allowed to ask for. */
  function makeOrder(rng, day, specials) {
    const menu = (specials || []).map(special).filter((s) => s && s.minDay <= day);
    if (menu.length && rng() < 0.3) {
      const s = pick(rng, menu);
      return Object.assign({ special: s.id }, s.recipe, { toppings: s.recipe.toppings.slice() });
    }
    const teas = TEAS.filter((t) => t.minDay <= day);
    const pool = TOPPINGS.filter((t) => t.minDay <= day);
    const maxTop = day <= 1 ? 1 : day <= 3 ? 2 : 3;
    const count = Math.floor(rng() * (maxTop + 1));
    const toppings = [];
    while (toppings.length < count) {
      const t = pick(rng, pool).id;
      if (!toppings.includes(t)) toppings.push(t);
    }
    const drizzles = DRIZZLES.filter((d) => d.minDay <= day);
    return {
      tea: pick(rng, teas).id,
      sweet: Math.floor(rng() * SWEETNESS.length),
      ice: Math.floor(rng() * ICE.length),
      toppings,
      drizzle: drizzles.length && rng() < 0.3 ? pick(rng, drizzles).id : null,
      special: null,
    };
  }

  function makeLook(rng) {
    const hair = rng() < 0.82 ? pick(rng, HAIR_NATURAL) : pick(rng, HAIR_DYED);
    return {
      skin: pick(rng, SKIN),
      hair,
      shirt: pick(rng, SHIRT),
      style: Math.floor(rng() * HAIR_STYLES),
      glasses: rng() < 0.25 ? 1 + Math.floor(rng() * 2) : 0,
      outfit: Math.floor(rng() * OUTFITS),
      eyes: pick(rng, EYES),
      acc: rng() < 0.45 ? 1 + Math.floor(rng() * 5) : 0, // earrings, headphones, beanie, cap, freckles
      beard: rng() < 0.22 ? 1 + Math.floor(rng() * 3) : 0, // stubble, beard, mustache
      build: Math.floor(rng() * 3),
    };
  }

  /** Toppings and drizzle are scored together as the drink's extras. */
  const extrasOf = (d) => d.toppings.concat(d.drizzle ? ['~' + d.drizzle] : []);

  /**
   * Score a finished drink against an order. Returns 0..100 plus a breakdown.
   * drink: { tea, fill (0..1), sweet (0..4), ice (0..2), toppings [ids], drizzle (id|null), shake (0..1) }
   */
  function scoreDrink(order, drink) {
    const d = sanitizeDrink(drink);
    const o = Object.assign({ drizzle: null }, order);
    const parts = {};
    parts.tea = d.tea === o.tea ? 20 : 0;
    parts.fill = d.tea ? Math.round(15 * clamp(1 - Math.abs(d.fill - FILL_TARGET) / FILL_TOLERANCE, 0, 1)) : 0;
    const sweetOff = Math.abs(d.sweet - o.sweet);
    parts.sweet = sweetOff === 0 ? 15 : sweetOff === 1 ? 7 : 0;
    const iceOff = Math.abs(d.ice - o.ice);
    parts.ice = iceOff === 0 ? 10 : iceOff === 1 ? 4 : 0;
    const want = extrasOf(o);
    const have = extrasOf(d);
    if (want.length === 0) {
      parts.toppings = Math.round(25 * Math.max(0, 1 - have.length * 0.5));
    } else {
      const hits = have.filter((t) => want.includes(t)).length;
      const extras = have.length - hits;
      parts.toppings = Math.round(25 * Math.max(0, (hits - extras * 0.5) / want.length));
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
      drizzle: DRIZZLES.some((x) => x.id === d.drizzle) ? d.drizzle : null,
      shake: clamp(Number(d.shake) || 0, 0, 1),
    };
  }

  /** Base price of an order. Secret recipes only pay extra to shops that own the recipe. */
  function drinkPrice(order, knowsSpecial) {
    const s = order.special && knowsSpecial !== false ? special(order.special) : null;
    return 4 + order.toppings.length * 0.75 + (order.drizzle ? 0.5 : 0) + (s ? s.bonus : 0);
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

  /** Showdown: cash for finishing the day in the top three (needs at least two players). */
  function placeBonus(rank, day) {
    return [10 + 2 * day, 5 + day, 2 + day][rank] || 0;
  }

  const blankUpgrades = () => Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));

  class Room {
    constructor(opts = {}) {
      this.code = opts.code || 'SOLO';
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
      this.dayLengthMs = opts.dayLengthMs || DAY_LENGTH_MS;
      this.players = new Map();
      this.hostId = null;
      this.mode = 'coop';
      this.phase = 'lobby';
      this.day = 0;
      // the shared co-op shop. In showdown every player has their own money, upgrades and recipes.
      this.money = 0;
      this.upgrades = blankUpgrades();
      this.recipes = [];
      this.customers = [];
      this.nextCustomerId = 1;
      this.dayEndsAt = 0;
      this.nextSpawnAt = 0;
      this.rushOn = false;
      this.leaderId = null;
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

    get showdown() {
      return this.mode === 'showdown';
    }

    /** Whose money, upgrades and recipes a player uses: the team's in co-op, their own in showdown. */
    _shop(pid) {
      return this.showdown ? this.players.get(pid) : this;
    }

    addPlayer(id, name) {
      if (this.players.has(id)) return { ok: true };
      if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };
      const used = new Set([...this.players.values()].map((p) => p.color));
      const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
      const clean = String(name || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16) || 'Barista';
      this.players.set(id, {
        id, name: clean, color, station: 'counter',
        served: 0, earned: 0, perfects: 0, scoreSum: 0, lost: 0, streak: 0, bonus: 0,
        money: 0, upgrades: blankUpgrades(), recipes: [], ready: false,
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
      if (this.leaderId === id) this.leaderId = null;
      if (this.hostId === id) this.hostId = this.players.keys().next().value || null;
      this._event('leave', { pid: id, name: p.name });
      this._bump();
    }

    setMode(pid, mode) {
      if (pid !== this.hostId) return { ok: false, error: 'Only the host can pick the mode' };
      if (this.phase !== 'lobby') return { ok: false, error: 'The mode is locked once the shop opens' };
      if (!MODES.includes(mode)) return { ok: false, error: 'No such mode' };
      if (mode !== this.mode) {
        this.mode = mode;
        this._event('mode', { mode });
        this._bump();
      }
      return { ok: true };
    }

    startDay(pid, now) {
      if (pid !== this.hostId) return { ok: false, error: 'Only the host can open the shop' };
      if (this.phase === 'playing') return { ok: false, error: 'Shop is already open' };
      if (this.showdown && this.phase === 'results') return { ok: false, error: 'Everyone has to ready up first' };
      this._beginDay(now);
      return { ok: true };
    }

    _beginDay(now) {
      this.day++;
      this.phase = 'playing';
      this.customers = [];
      this.dayEndsAt = now + this.dayLengthMs;
      this.nextSpawnAt = now + 1200;
      this.rushOn = false;
      this.leaderId = null;
      this.stats = { served: 0, lost: 0, money: 0, perfects: 0, scoreSum: 0 };
      for (const p of this.players.values()) {
        Object.assign(p, { served: 0, earned: 0, perfects: 0, scoreSum: 0, lost: 0, streak: 0, bonus: 0, ready: false });
      }
      this._event('dayStart', { day: this.day, mode: this.mode });
      if (this.showdown) {
        // one customer per player walks in at the bell, so nobody starts the day waiting
        for (let i = 0; i < this.players.size; i++) this._spawn(now);
        this.nextSpawnAt = now + this._spawnInterval();
      }
      this._bump();
    }

    /** Showdown: flip your ready flag between days. The next day opens once everyone is ready. */
    setReady(pid, ready, now) {
      if (!this.showdown || this.phase !== 'results') return { ok: false, error: 'Nothing to ready up for' };
      const p = this.players.get(pid);
      if (!p) return { ok: false, error: 'Not in this shop' };
      if (p.ready !== !!ready) {
        p.ready = !!ready;
        this._event('ready', { pid, ready: p.ready });
        this._bump();
      }
      this._maybeAutoStart(now);
      return { ok: true, ready: p.ready };
    }

    _maybeAutoStart(now) {
      if (!this.showdown || this.phase !== 'results' || this.players.size === 0) return false;
      for (const p of this.players.values()) if (!p.ready) return false;
      this._beginDay(now);
      return true;
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
      const before = this.version;
      if (this.phase === 'results') {
        this._maybeAutoStart(now);
        return this.version !== before;
      }
      if (this.phase !== 'playing') return false;
      if (now >= this.dayEndsAt) {
        this._endDay(now);
        return true;
      }
      if (this.showdown && !this.rushOn && now >= this.dayEndsAt - RUSH_MS) {
        this.rushOn = true;
        this._event('rush', {});
        this._bump();
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
          const owner = this.players.get(c.claimedBy);
          if (owner) {
            owner.lost++;
            owner.streak = 0;
          }
          this._event('left', { cid: c.id, name: c.name, pid: c.claimedBy });
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

    /** Recipes customers may order: the team's in co-op, anything any rival owns in showdown. */
    _menu() {
      if (!this.showdown) return this.recipes;
      const all = new Set();
      for (const p of this.players.values()) p.recipes.forEach((r) => all.add(r));
      return [...all];
    }

    _spawn(now) {
      const order = makeOrder(this.rng, this.day, this._menu());
      const base = Math.max(50000, 80000 - (this.day - 1) * 5000) + order.toppings.length * 6000 + (order.drizzle ? 3000 : 0);
      // co-op shares one lounge. In showdown your lounge kicks in when you take the order.
      const patienceMs = Math.round(base * (this.showdown ? 1 : perks(this.upgrades).patience));
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
      this._event('arrive', { cid: c.id, name: c.name, special: order.special });
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
      const list = [...this.players.values()].sort((a, b) => b.earned - a.earned);
      if (this.showdown && list.length > 1) {
        list.forEach((p, rank) => {
          const bonus = p.earned > 0 ? placeBonus(rank, this.day) : 0;
          p.placeBonus = bonus;
          p.bonus += bonus;
          p.money = round2(p.money + bonus);
        });
      }
      const players = list.map((p) => ({
        id: p.id, name: p.name, color: p.color, served: p.served,
        earned: round2(p.earned), perfects: p.perfects, lost: p.lost,
        avg: p.served ? Math.round(p.scoreSum / p.served) : 0,
        bonus: round2(p.bonus), placeBonus: round2(p.placeBonus || 0), money: round2(p.money),
        grade: gradeFor({ served: p.served, lost: p.lost, scoreSum: p.scoreSum }),
      }));
      for (const p of this.players.values()) {
        p.ready = false;
        p.placeBonus = 0;
      }
      this.lastResults = {
        day: this.day,
        mode: this.mode,
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

    /** Showdown: the ticket a player is working on right now, if any. */
    _busyWith(pid) {
      return this.customers.find((c) => c.status === 'ordered' && c.claimedBy === pid) || null;
    }

    takeOrder(pid, cid) {
      if (this.phase !== 'playing') return { ok: false, error: 'Shop is closed' };
      const c = this._customer(cid);
      if (!c || c.status !== 'waiting') return { ok: false, error: 'That customer is not waiting' };
      if (this.showdown) {
        if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
        const busy = this._busyWith(pid);
        if (busy) return { ok: false, error: `Finish ${busy.name}'s drink first` };
      }
      c.status = 'ordered';
      c.claimedBy = this.players.has(pid) ? pid : null;
      c.leaveAt += 8000; // a little extra patience once someone has listened to them
      if (this.showdown) {
        const extra = Math.round(c.patienceMs * (perks(this.players.get(pid).upgrades).patience - 1));
        c.leaveAt += extra;
        c.patienceMs += extra;
      }
      this._event('ordered', { cid, pid });
      this._bump();
      return { ok: true };
    }

    /**
     * Pick up a ticket. Open tickets are claimed straight away. A ticket someone else
     * already holds never switches owner here: the holder gets a request to pass it over.
     * Showdown has no handoffs: tickets belong to whoever took the order.
     */
    claim(pid, cid, now) {
      const c = this._customer(cid);
      if (!c || c.status !== 'ordered') return { ok: false, error: 'No such ticket' };
      if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
      const owner = c.claimedBy ? this.players.get(c.claimedBy) : null;
      if (this.showdown && owner && c.claimedBy !== pid) return { ok: false, error: `That is ${owner.name}'s customer` };
      if (!owner || c.claimedBy === pid) {
        if (c.claimedBy !== pid) {
          if (this.showdown && this._busyWith(pid)) return { ok: false, error: 'Finish your current drink first' };
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

    /** Spend money on an upgrade. Only between days. */
    buyUpgrade(pid, uid, seenLevel) {
      if (this.phase !== 'results') return { ok: false, error: 'The upgrade shop opens at the end of each day' };
      if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
      const u = UPGRADES.find((x) => x.id === uid);
      if (!u) return { ok: false, error: 'No such upgrade' };
      if (this.showdown && u.coopOnly) return { ok: false, error: `${u.name} is co-op only` };
      const shop = this._shop(pid);
      const level = shop.upgrades[uid];
      // two teammates clicking the same card at once should not buy two levels
      if (seenLevel != null && Number(seenLevel) !== level) return { ok: false, error: 'A teammate just bought that one' };
      if (level >= u.costs.length) return { ok: false, error: 'Already maxed out' };
      const cost = u.costs[level];
      if (shop.money + 1e-9 < cost) return { ok: false, error: this.showdown ? 'Not enough money in your wallet' : 'Not enough money in the bank' };
      shop.money = round2(shop.money - cost);
      shop.upgrades[uid] = level + 1;
      this._event('upgrade', { pid, uid, level: level + 1, cost });
      this._bump();
      return { ok: true, level: level + 1 };
    }

    /** Unlock a secret recipe. Customers start ordering it and it pays a premium. */
    buyRecipe(pid, rid) {
      if (this.phase !== 'results') return { ok: false, error: 'The shop opens at the end of each day' };
      if (!this.players.has(pid)) return { ok: false, error: 'Not in this shop' };
      const s = special(rid);
      if (!s) return { ok: false, error: 'No such recipe' };
      const shop = this._shop(pid);
      if (shop.recipes.includes(rid)) return { ok: false, error: 'You already know that recipe' };
      if (shop.money + 1e-9 < s.cost) return { ok: false, error: this.showdown ? 'Not enough money in your wallet' : 'Not enough money in the bank' };
      shop.money = round2(shop.money - s.cost);
      shop.recipes.push(rid);
      this._event('recipe', { pid, rid, cost: s.cost });
      this._bump();
      return { ok: true };
    }

    serve(pid, cid, drink, now) {
      if (this.phase !== 'playing') return { ok: false, error: 'Shop is closed' };
      const c = this._customer(cid);
      if (!c || c.status !== 'ordered') return { ok: false, error: 'That order is gone' };
      const owner = c.claimedBy && c.claimedBy !== pid ? this.players.get(c.claimedBy) : null;
      if (owner) return { ok: false, error: this.showdown ? `That is ${owner.name}'s customer` : `That is ${owner.name}'s ticket. Ask them to pass it over.` };
      const p = this.players.get(pid);
      if (this.showdown) {
        if (!p) return { ok: false, error: 'Not in this shop' };
        if (c.claimedBy !== pid) return { ok: false, error: 'Take this order first' };
      }
      const shop = this.showdown ? p : this;
      const P = perks(shop.upgrades);
      const result = scoreDrink(c.order, drink);
      const patience = clamp((c.leaveAt - now) / c.patienceMs, 0, 1);
      const quality = result.total / 100;
      const knows = !c.order.special || shop.recipes.includes(c.order.special);
      const full = drinkPrice(c.order, knows) + P.bonusPrice;
      const price = quality >= 0.45 ? full : full * 0.5;
      const tip = quality * quality * 5 * (0.4 + 0.6 * patience) * P.tipMult;
      const gold = result.stars === 3 ? P.goldBonus : 0;
      let earned = price + tip + gold;
      let bonus = 0;
      let rush = false;
      if (this.showdown) {
        p.streak = result.stars >= 2 ? p.streak + 1 : 0;
        if (p.streak >= 3) bonus = p.streak >= 5 ? 2 : 1;
        if (this.rushOn) {
          rush = true;
          earned *= RUSH_MULT;
        }
        earned += bonus;
        p.bonus += bonus;
      }
      earned = round2(earned);
      c.status = 'served';
      c.doneAt = now;
      c.stars = result.stars;
      shop.money = round2(shop.money + earned);
      this.stats.served++;
      this.stats.money += earned;
      this.stats.scoreSum += result.total;
      if (result.stars === 3) this.stats.perfects++;
      if (p) {
        p.served++;
        p.earned += earned;
        p.scoreSum += result.total;
        if (result.stars === 3) p.perfects++;
      }
      this._event('served', { cid, pid, name: c.name, stars: result.stars, earned, special: c.order.special, streak: p ? p.streak : 0 });
      if (this.showdown && this.players.size > 1) this._checkLead();
      this._bump();
      return {
        ok: true,
        result: Object.assign({}, result, {
          earned, tip: round2(tip), price: round2(price), gold: round2(gold), bonus, rush,
          streak: p ? p.streak : 0, name: c.name, special: knows ? c.order.special : null,
        }),
      };
    }

    _checkLead() {
      let best = null;
      for (const p of this.players.values()) if (!best || p.earned > best.earned) best = p;
      if (best && best.earned > 0 && best.id !== this.leaderId) {
        const tied = [...this.players.values()].some((p) => p !== best && Math.abs(p.earned - best.earned) < 1e-9);
        if (!tied) {
          this.leaderId = best.id;
          this._event('lead', { pid: best.id });
        }
      }
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
        case 'mode': return this.setMode(pid, action.mode);
        case 'ready': return this.setReady(pid, action.ready === true, now);
        case 'take': return this.takeOrder(pid, Number(action.cid));
        case 'claim': return this.claim(pid, Number(action.cid), now);
        case 'respond': return this.respondHandoff(pid, Number(action.cid), action.accept === true);
        case 'buy': return this.buyUpgrade(pid, String(action.id), action.level);
        case 'recipe': return this.buyRecipe(pid, String(action.id));
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
        mode: this.mode,
        phase: this.phase,
        day: this.day,
        money: this.money,
        hostId: this.hostId,
        dayEndsAt: this.dayEndsAt,
        dayLengthMs: this.dayLengthMs,
        rushAt: this.showdown ? this.dayEndsAt - RUSH_MS : 0,
        leaderId: this.leaderId,
        upgrades: Object.assign({}, this.upgrades),
        recipes: this.recipes.slice(),
        players: [...this.players.values()].map((p) => ({
          id: p.id, name: p.name, color: p.color, station: p.station,
          served: p.served, earned: round2(p.earned), perfects: p.perfects, lost: p.lost,
          streak: p.streak, bonus: round2(p.bonus), ready: p.ready,
          money: round2(p.money), upgrades: Object.assign({}, p.upgrades), recipes: p.recipes.slice(),
        })),
        customers: this.customers.map((c) => ({
          id: c.id, name: c.name, look: c.look, status: c.status,
          order: c.status === 'waiting' ? null : c.order,
          special: c.order.special,
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
    TEAS, TOPPINGS, DRIZZLES, SPECIALS, SWEETNESS, ICE, MODES, FILL_TARGET, FILL_TOLERANCE, MAX_TOPPINGS, MAX_PLAYERS,
    DAY_LENGTH_MS, HANDOFF_MS, RUSH_MS, RUSH_MULT, BASE_POUR_RATE, EMOTES, STATIONS, PLAYER_COLORS, UPGRADES,
    Room, scoreDrink, sanitizeDrink, makeOrder, makeLook, mulberry32, gradeFor, perks, drinkPrice, placeBonus,
  };
});
