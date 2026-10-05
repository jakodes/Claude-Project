/* Boba Rush client: menus, stations, shop, co-op and showdown wiring. */
(function () {
  'use strict';
  const G = window.BobaGame;
  const A = window.BobaArt;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const money = (v) => '$' + (Number(v) || 0).toFixed(2);
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STATION_INFO = {
    counter: { ico: '🧾', label: 'Counter', sign: 'Counter' },
    brew: { ico: '🫖', label: 'Brew', sign: 'Brew Bar' },
    mix: { ico: '🍯', label: 'Mix', sign: 'Mix Station' },
    toppings: { ico: '🍡', label: 'Toppings', sign: 'Topping Shelf' },
    shake: { ico: '🥤', label: 'Shake', sign: 'Shake & Serve' },
  };
  const ICE_SHORT = ['No ice', 'Less ice', 'Regular'];
  const PEARL_COLORS = ['#3a2419', '#3a2419', '#ff5d8f', '#f3bf3a', '#8a2c2c', '#eef3d2', '#9cc46f', '#b79ddb'];
  const byId = (list, id) => list.find((t) => t.id === id) || {};
  const teaName = (id) => byId(G.TEAS, id).name || '?';
  const teaShort = (id) => byId(G.TEAS, id).short || '?';
  const topName = (id) => byId(G.TOPPINGS, id).name || '?';
  const topShort = (id) => byId(G.TOPPINGS, id).short || '?';
  const dzName = (id) => byId(G.DRIZZLES, id).name || '?';
  const special = (id) => G.SPECIALS.find((s) => s.id === id) || null;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  function freshCup() {
    return { tea: null, fill: 0, sweet: 0, ice: 0, toppings: [], drizzle: null, sealed: false, shake: 0, spilled: false };
  }

  const S = {
    t: null,
    pid: null,
    snap: null,
    offset: 0,
    screen: 'menu',
    station: 'counter',
    active: null,
    serveTarget: null,
    cup: freshCup(),
    seen: -1,
    pouring: false,
    shake: null,
    serving: false,
    fx: null,
    shownMoney: null,
    chipSig: '',
    raceSig: '',
    hoSig: '',
    lobbySig: '',
    reportSig: '',
    shopSig: '',
    resView: 'report',
    shopTab: 'upgrades',
    lastEmote: 0,
    seenTickets: new Set(),
  };
  const now = () => Date.now() + S.offset;
  const setUrl = (u) => { try { history.replaceState(null, '', u); } catch (e) { /* sandboxed frame */ } };

  /* ---------------- sound ---------------- */
  const Sound = {
    ctx: null,
    on: store.get('boba-muted') !== '1',
    tone(f, d, type, v, delay, slide) {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + (delay || 0);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
        g.gain.setValueAtTime(v || 0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + d + 0.02);
      } catch (e) { /* audio unavailable */ }
    },
    ding() { this.tone(988, 0.15, 'sine', 0.06); this.tone(1319, 0.25, 'sine', 0.06, 0.1); },
    cash() { this.tone(1568, 0.08, 'square', 0.035); this.tone(2093, 0.25, 'square', 0.035, 0.08); },
    rivalCash() { this.tone(784, 0.08, 'square', 0.025); this.tone(659, 0.2, 'square', 0.025, 0.07); },
    bad() { this.tone(220, 0.25, 'sawtooth', 0.04); this.tone(165, 0.35, 'sawtooth', 0.04, 0.15); },
    pop() { this.tone(520 + Math.random() * 240, 0.06, 'triangle', 0.08); },
    plink(n) { for (let i = 0; i < (n || 4); i++) this.tone(900 + Math.random() * 700, 0.05, 'sine', 0.05, i * 0.05); },
    squish() { this.tone(300, 0.18, 'triangle', 0.06, 0, 140); },
    click() { this.tone(420, 0.04, 'square', 0.03); },
    swish() { this.tone(660, 0.05, 'triangle', 0.04); this.tone(880, 0.06, 'triangle', 0.03, 0.04); },
    whoosh() { this.tone(200, 0.35, 'sawtooth', 0.025, 0, 900); },
    alarm() { [0, 0.22, 0.44].forEach((d) => this.tone(880, 0.16, 'square', 0.04, d, 660)); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.06, i * 0.12)); },
    levelUp() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.03, i * 0.07)); },
    streak(n) { for (let i = 0; i < Math.min(n, 6); i++) this.tone(523 * Math.pow(1.122, i), 0.12, 'square', 0.03, i * 0.06); },
  };

  /* ---------------- transports ---------------- */
  class LocalTransport {
    constructor(name) {
      this.pid = 'me';
      this.solo = true;
      this.room = new G.Room({ code: 'SOLO' });
      this.room.addPlayer(this.pid, name);
      this.room.startDay(this.pid, Date.now());
    }
    connect(onSnap) {
      this.onSnap = onSnap;
      this.push();
      this.timer = setInterval(() => {
        this.room.tick(Date.now());
        if (this.room.version !== this.v) this.push();
      }, 200);
    }
    push() {
      this.v = this.room.version;
      this.onSnap(this.room.snapshot(Date.now()));
    }
    async send(action) {
      const r = this.room.handle(this.pid, action, Date.now());
      if (this.room.version !== this.v) this.push();
      return r;
    }
    close() { clearInterval(this.timer); }
  }

  class NetTransport {
    constructor(code, pid, token) {
      Object.assign(this, { code, pid, token, solo: false });
    }
    connect(onSnap) {
      const q = new URLSearchParams({ code: this.code, pid: this.pid, token: this.token });
      this.es = new EventSource('api/events?' + q);
      this.es.onmessage = (e) => onSnap(JSON.parse(e.data));
      this.es.onerror = () => {
        if (this.es.readyState === EventSource.CLOSED && S.t === this) {
          toast('Lost connection to the room', 'bad');
          leave();
        }
      };
    }
    async send(action) {
      try {
        const r = await fetch('api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: this.code, pid: this.pid, token: this.token, action }),
        });
        return await r.json();
      } catch (e) {
        return { ok: false, error: 'Network hiccup, try again' };
      }
    }
    close() {
      if (this.es) this.es.close();
      const body = JSON.stringify({ code: this.code, pid: this.pid, token: this.token });
      if (navigator.sendBeacon) navigator.sendBeacon('api/leave', body);
    }
  }

  /* ---------------- helpers ---------------- */
  function toast(msg, kind, dot) {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    if (dot) {
      const d = document.createElement('span');
      d.className = 'tdot';
      d.style.background = dot;
      el.appendChild(d);
    }
    el.appendChild(document.createTextNode(msg));
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 2950);
  }

  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  let bannerTimer = null;
  function banner(text, sub, color) {
    const box = $('#banner');
    if (!box || S.screen !== 'game') return;
    box.innerHTML = `<div class="bn" style="--bn:${color || 'var(--pink)'}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (box.innerHTML = ''), 2000);
  }

  /** Little bits that arc from one element into another: toppings into the cup, coins into the wallet. */
  function flyBits(from, toEl, colors, n, coin) {
    if (!from || !toEl || calm()) return;
    const to = toEl.getBoundingClientRect();
    if (!to.width) return;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'flyer' + (coin ? ' coin' : '');
      el.innerHTML = coin ? '<span class="coin">$</span>' : `<i style="--c:${colors[i % colors.length]}"></i>`;
      document.body.appendChild(el);
      const sx = from.left + from.width / 2 + (Math.random() - 0.5) * from.width * 0.4;
      const sy = from.top + from.height * 0.4;
      const ex = to.left + to.width / 2 + (Math.random() - 0.5) * to.width * 0.3;
      const ey = to.top + to.height * (coin ? 0.5 : 0.22);
      const mx = (sx + ex) / 2;
      const my = Math.min(sy, ey) - 50 - Math.random() * 50;
      const anim = el.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(.6)`, opacity: 1 },
        { transform: `translate(${mx}px, ${my}px) scale(1.05)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${ex}px, ${ey}px) scale(.7)`, opacity: 0.3 },
      ], { duration: 460 + i * 25, easing: 'cubic-bezier(.4,0,.6,1)', delay: i * 30, fill: 'both' });
      anim.onfinish = () => el.remove();
      setTimeout(() => el.remove(), 1600);
    }
  }

  const player = (id) => (S.snap ? S.snap.players.find((p) => p.id === id) : null);
  const me = () => player(S.pid);
  const customer = (id) => (S.snap ? S.snap.customers.find((c) => c.id === id) : null);
  const showdown = () => !!(S.snap && S.snap.mode === 'showdown');
  const ordered = () => (S.snap ? S.snap.customers.filter((c) => c.status === 'ordered').sort((a, b) => a.leaveAt - b.leaveAt) : []);
  const tickets = () => {
    const list = ordered();
    // in a showdown your own ticket always hangs first
    return showdown() ? list.sort((a, b) => (b.claimedBy === S.pid) - (a.claimedBy === S.pid)) : list;
  };
  const myTicket = () => ordered().find((c) => c.claimedBy === S.pid) || null;
  const patienceOf = (c) => clamp((c.leaveAt - now()) / c.patienceMs, 0, 1);
  const barColor = (p) => (p > 0.5 ? 'var(--mint)' : p > 0.25 ? 'var(--yellow)' : 'var(--red)');
  const isHost = () => S.snap && S.snap.hostId === S.pid;
  const multi = () => S.snap && S.snap.players.length > 1;
  // someone else is holding this ticket right now
  const heldByOther = (c) => !!(c.claimedBy && c.claimedBy !== S.pid && player(c.claimedBy));
  /** The money, upgrades and recipes you play with: the team's in co-op, your own in a showdown. */
  function myShop() {
    const blank = { money: 0, upgrades: {}, recipes: [] };
    if (!S.snap) return blank;
    if (showdown()) return me() || blank;
    return { money: S.snap.money, upgrades: S.snap.upgrades || {}, recipes: S.snap.recipes || [] };
  }
  const perks = () => G.perks(myShop().upgrades);
  const day = () => (S.snap ? Math.max(1, S.snap.day) : 1);
  const takeFx = () => {
    const fx = S.fx;
    S.fx = null;
    return fx;
  };

  function showScreen(name) {
    S.screen = name;
    document.body.dataset.screen = name;
    for (const id of ['menu', 'lobby', 'game', 'results']) $('#' + id).classList.toggle('hidden', id !== name);
    if (name !== 'game') document.body.classList.remove('rush');
  }

  /* ---------------- fullscreen ---------------- */
  const docEl = document.documentElement;
  const fsSupported = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    try {
      if (fsActive()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const r = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
        if (r && r.catch) r.catch(() => toast('Fullscreen is blocked here', 'bad'));
      }
    } catch (e) {
      toast('Fullscreen is not available here', 'bad');
    }
  }
  function syncFsButtons() {
    $$('.fs-btn').forEach((b) => {
      b.classList.toggle('hidden', !fsSupported);
      b.textContent = fsActive() ? '🗗' : '⛶';
      b.title = fsActive() ? 'Exit fullscreen' : 'Fullscreen';
    });
  }
  $$('.fs-btn').forEach((b) => (b.onclick = toggleFullscreen));
  document.addEventListener('fullscreenchange', syncFsButtons);
  document.addEventListener('webkitfullscreenchange', syncFsButtons);
  syncFsButtons();

  /* ---------------- backdrop & title ---------------- */
  (function buildBackdrop() {
    const bg = $('#bg');
    let html = '';
    for (let i = 0; i < 18; i++) {
      const size = 14 + Math.random() * 30;
      html += `<i style="left:${Math.random() * 100}%;width:${size}px;height:${size}px;--c:${PEARL_COLORS[i % PEARL_COLORS.length]};--d:${16 + Math.random() * 18}s;--delay:${-Math.random() * 30}s;--sway:${(Math.random() * 2 - 1) * 60}px"></i>`;
    }
    bg.innerHTML = html;
    $('#logoCup').innerHTML = A.cupSvg({ tea: 'taro', fill: 0.82, sweet: 2, ice: 1, toppings: ['pearls', 'popping'], drizzle: 'sugar', sealed: true, shake: 1 }, { straw: '#ff5c8a' });
  })();

  /* ---------------- menu ---------------- */
  const nameInput = $('#nameInput');
  nameInput.value = store.get('boba-name') || '';
  function myName() {
    const n = nameInput.value.trim() || 'Barista';
    store.set('boba-name', n);
    return n;
  }

  function renderBest() {
    const best = JSON.parse(store.get('boba-best') || 'null');
    const el = $('#bestNote');
    el.classList.toggle('hidden', !best);
    el.textContent = best ? `🏆 Best day: ${money(best.money)} · ${best.grade} · Day ${best.day}` : '';
  }

  $('#soloBtn').onclick = () => startSession(new LocalTransport(myName()));
  $('#createBtn').onclick = () => joinRoom({ create: true });
  $('#joinBtn').onclick = () => joinRoom({ code: $('#codeInput').value });
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
  $('#howBtn').onclick = showHowTo;

  async function joinRoom(opts) {
    if (!opts.create && !String(opts.code || '').trim()) return toast('Type the 4 letter room code first', 'bad');
    try {
      const r = await fetch('api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ name: myName() }, opts)),
      });
      const j = await r.json();
      if (!j.ok) return toast(j.error || 'Could not join', 'bad');
      startSession(new NetTransport(j.code, j.pid, j.token));
      setUrl('?room=' + j.code);
    } catch (e) {
      toast('Could not reach the Boba Rush server', 'bad');
    }
  }

  async function checkServer() {
    const params = new URLSearchParams(location.search);
    if (params.get('room')) $('#codeInput').value = params.get('room').toUpperCase().slice(0, 4);
    let ok = false;
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('api/health', { cache: 'no-store' });
        ok = r.ok && (await r.json()).ok;
      } catch (e) { ok = false; }
    }
    $('#mpControls').classList.toggle('hidden', !ok);
    $('#mpNote').classList.toggle('hidden', ok);
    if (ok && params.get('room')) $('#joinBtn').focus();
  }

  function startSession(t) {
    if (S.t) S.t.close();
    Object.assign(S, {
      t, pid: t.pid, snap: null, seen: -1, station: 'counter', active: null, serveTarget: null,
      cup: freshCup(), pouring: false, shake: null, serving: false, fx: null, shownMoney: null,
      chipSig: '', raceSig: '', hoSig: '', lobbySig: '', reportSig: '', shopSig: '', resView: 'report', shopTab: 'upgrades',
      seenTickets: new Set(),
    });
    S.screen = '';
    buildTabs();
    buildEmotes();
    t.connect(onSnap);
  }

  function leave() {
    if (S.t) S.t.close();
    S.t = null;
    S.snap = null;
    S.pouring = false;
    S.shake = null;
    closeModal();
    $('#handoffs').innerHTML = '';
    $('#resultPop').innerHTML = '';
    setUrl(location.pathname);
    renderBest();
    showScreen('menu');
    checkServer();
  }
  $$('.leave-btn').forEach((b) => (b.onclick = leave));

  $('#muteBtn').textContent = Sound.on ? '🔊' : '🔇';
  $('#muteBtn').onclick = () => {
    Sound.on = !Sound.on;
    store.set('boba-muted', Sound.on ? '0' : '1');
    $('#muteBtn').textContent = Sound.on ? '🔊' : '🔇';
  };

  /* ---------------- snapshots ---------------- */
  function onSnap(snap) {
    if (!S.t) return;
    S.offset = snap.now - Date.now();
    const first = !S.snap;
    const prevPhase = S.snap && S.snap.phase;
    S.snap = snap;
    handleEvents(snap.events, first);

    // a ticket you were working on can be served, walk out, or get passed to a teammate
    if (S.active) {
      const c = customer(S.active);
      if (!c || c.status !== 'ordered' || heldByOther(c)) S.active = null;
    }
    if (showdown() && !S.active) {
      const mine = myTicket();
      if (mine) S.active = mine.id;
    }
    if (S.serveTarget && !tickets().some((c) => c.id === S.serveTarget)) S.serveTarget = null;

    const screen = snap.phase === 'lobby' ? 'lobby' : snap.phase === 'results' ? 'results' : 'game';
    if (screen === 'game' && prevPhase !== 'playing') {
      S.cup = freshCup();
      S.active = null;
      S.station = 'counter';
      S.shownMoney = null;
      S.seenTickets = new Set();
      S.raceSig = '';
      S.chipSig = '';
    }
    if (screen !== S.screen) {
      showScreen(screen);
      if (screen === 'game') {
        renderTabs();
        renderStation();
      }
      if (screen === 'results') onResults();
    }
    if (screen === 'lobby') renderLobby();
    if (screen === 'results') renderResults();
    if (screen === 'game') {
      renderTop();
      renderRace();
      renderTickets();
      renderOrderStrip();
      if (S.station === 'counter') renderCounter();
      if (S.station === 'shake' && S.cup.sealed) renderServeTargets();
      if (S.station === 'mix') updateAutoMix();
      if (S.station === 'toppings') updateTopBot();
    }
    renderHandoffs();
  }

  function handleEvents(events, initial) {
    for (const e of events) {
      if (e.id <= S.seen) continue;
      S.seen = e.id;
      if (initial) continue;
      const who = player(e.pid);
      const sd = showdown();
      switch (e.type) {
        case 'arrive':
          Sound.ding();
          if (e.special) toast(`⭐ ${e.name} wants a ${special(e.special).name}!`, 'good');
          else if (S.station !== 'counter') toast(`🔔 ${e.name} walked in`);
          break;
        case 'left':
          if (sd && e.pid && e.pid !== S.pid) {
            const rival = player(e.pid);
            toast(`😬 ${e.name} walked out on ${rival ? rival.name : 'a rival'}`, 'rival', rival && rival.color);
            break;
          }
          Sound.bad();
          toast(sd && e.pid === S.pid ? `😤 ${e.name} walked out on you! Streak lost.` : `😤 ${e.name} gave up and left`, 'bad');
          replay($('#station'), 'shake-screen');
          break;
        case 'served':
          if (e.pid !== S.pid) {
            if (sd) {
              Sound.rivalCash();
              toast(`${who ? who.name : 'A rival'} +${money(e.earned)} ${'⭐'.repeat(e.stars)}${e.streak >= 3 ? ' 🔥' + e.streak : ''}`, 'rival', who && who.color);
            } else {
              Sound.cash();
              toast(`${who ? who.name : 'Someone'} served ${e.name} ${'⭐'.repeat(e.stars) || '😐'} +${money(e.earned)}`, 'good');
            }
          }
          break;
        case 'lead':
          Sound.whoosh();
          if (e.pid === S.pid) banner('You took the lead!', 'Keep it up', 'var(--mint)');
          else banner(`${who ? who.name : 'A rival'} took the lead!`, 'Catch up!', who ? who.color : 'var(--red)');
          break;
        case 'rush':
          Sound.alarm();
          banner('Final Rush!', `Every drink pays ×${G.RUSH_MULT}`, '#ff6b2c');
          break;
        case 'join':
          if (e.pid !== S.pid) toast(`👋 ${e.name} joined the shop`, 'good');
          break;
        case 'leave':
          toast(`${e.name} left the shop`);
          break;
        case 'mode':
          Sound.swish();
          toast(e.mode === 'showdown' ? '⚔️ Showdown mode: every shop for itself!' : '🤝 Co-op mode: one team, one bank', 'good');
          break;
        case 'emote':
          floatEmote(e.pid, e.emote);
          break;
        case 'dayStart':
          setTimeout(() => banner(`Day ${e.day}`, e.mode === 'showdown' && multi() ? 'Showdown! Most cash wins' : 'The shop is open!', e.mode === 'showdown' ? 'var(--red)' : 'var(--grape)'), 350);
          break;
        case 'dayEnd':
          Sound.fanfare();
          break;
        case 'ready':
          if (e.pid !== S.pid) Sound.click();
          break;
        case 'handoffAsk':
          if (e.to === S.pid) Sound.ding();
          break;
        case 'handoff': {
          const giver = player(e.from);
          const taker = player(e.to);
          if (e.to === S.pid) {
            S.active = e.cid;
            S.serveTarget = null;
            Sound.ding();
            toast(`🤝 ${giver ? giver.name : 'A teammate'} passed you ticket #${e.cid}!`, 'good');
          } else if (e.from === S.pid) {
            toast(`🤝 You passed #${e.cid} to ${taker ? taker.name : 'a teammate'}`);
          }
          break;
        }
        case 'handoffNo':
          if (e.to === S.pid) {
            const holder = player(e.from);
            const name = holder ? holder.name : 'Your teammate';
            toast(e.timeout ? `⌛ ${name} didn't answer. #${e.cid} stays with them.` : `✋ ${name} is keeping #${e.cid}`, 'bad');
          }
          break;
        case 'upgrade': {
          const u = G.UPGRADES.find((x) => x.id === e.uid);
          if (!u) break;
          if (e.pid === S.pid || !sd) Sound.levelUp();
          const name = e.pid === S.pid ? 'You' : who ? who.name : 'Someone';
          toast(`${u.icon} ${name} bought ${u.name}${u.costs.length > 1 ? ' Lv ' + e.level : ''}!`, sd && e.pid !== S.pid ? 'rival' : 'good', sd && who ? who.color : null);
          if (e.pid === S.pid || !sd) S.justBought = e.uid;
          break;
        }
        case 'recipe': {
          const r = special(e.rid);
          if (!r) break;
          if (e.pid === S.pid || !sd) Sound.fanfare();
          const name = e.pid === S.pid ? 'You' : who ? who.name : 'Someone';
          toast(`${r.icon} ${name} learned ${r.name}!`, sd && e.pid !== S.pid ? 'rival' : 'good', sd && who ? who.color : null);
          if (e.pid === S.pid || !sd) S.justBought = e.rid;
          break;
        }
      }
    }
  }

  /* ---------------- lobby ---------------- */
  function renderLobby() {
    const snap = S.snap;
    $('#lobbyCode').textContent = snap.code;
    const sig = snap.players.map((p) => p.id + p.name + p.color).join('|') + snap.hostId;
    if (sig !== S.lobbySig) {
      S.lobbySig = sig;
      const slots = [];
      for (let i = 0; i < G.MAX_PLAYERS; i++) {
        const p = snap.players[i];
        slots.push(p
          ? `<div class="crew-slot">${p.id === snap.hostId ? '<span class="crown">👑</span>' : ''}${A.baristaSvg(p.color, p.id)}<span class="name">${esc(p.name)}</span><span class="tagline-sm">${p.id === S.pid ? 'You' : p.id === snap.hostId ? 'Host' : 'Barista'}</span></div>`
          : '<div class="crew-slot empty">Open spot</div>');
      }
      $('#lobbyPlayers').innerHTML = slots.join('');
    }
    for (const b of $$('[data-mode]', $('#modePick'))) {
      b.classList.toggle('on', b.dataset.mode === snap.mode);
      b.disabled = !isHost();
    }
    $('#startBtn').textContent = snap.mode === 'showdown' ? '⚔️ Start the Showdown!' : 'Open the Shop!';
    $('#startBtn').classList.toggle('hidden', !isHost());
    $('#lobbyWait').classList.toggle('hidden', isHost());
    $('#lobbyWait').textContent = `Waiting for the host to open the shop… (${snap.mode === 'showdown' ? 'Showdown' : 'Co-op'})`;
  }
  $('#modePick').onclick = async (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b || !S.t || !isHost() || b.classList.contains('on')) return;
    const r = await S.t.send({ type: 'mode', mode: b.dataset.mode });
    if (!r.ok) toast(r.error, 'bad');
  };
  $('#startBtn').onclick = async () => {
    const r = await S.t.send({ type: 'start' });
    if (!r.ok) toast(r.error, 'bad');
  };
  $('#copyLinkBtn').onclick = async () => {
    const link = `${location.origin}${location.pathname}?room=${S.snap.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied!', 'good');
    } catch (e) {
      window.prompt('Copy this invite link:', link);
    }
  };

  /* ---------------- results & shop ---------------- */
  function onResults() {
    S.resView = 'report';
    S.reportSig = '';
    S.shopSig = '';
    $('#resultPop').innerHTML = '';
    const r = S.snap.results;
    if (!r || !S.t.solo) return;
    const best = JSON.parse(store.get('boba-best') || 'null');
    if (r.served > 0 && (!best || r.money > best.money)) {
      store.set('boba-best', JSON.stringify({ money: r.money, grade: r.grade, day: r.day }));
      setTimeout(() => toast('🏆 New best solo day!', 'good'), 900);
    }
  }

  function renderResults() {
    const r = S.snap.results;
    if (!r) return;
    const sd = showdown();
    $('#reportView').classList.toggle('hidden', S.resView !== 'report');
    $('#shopView').classList.toggle('hidden', S.resView !== 'shop');
    const mine = me();
    const readyCount = S.snap.players.filter((p) => p.ready).length;
    $$('.next-day-btn').forEach((b) => {
      b.textContent = `Open Day ${r.day + 1} ▶`;
      b.classList.toggle('hidden', sd || !isHost());
    });
    $$('.ready-btn').forEach((b) => {
      b.classList.toggle('hidden', !sd);
      const on = !!(mine && mine.ready);
      b.classList.toggle('on', on);
      b.textContent = on ? `✔ Ready ${readyCount}/${S.snap.players.length}` : '✋ I\'m ready!';
    });
    $$('.res-wait').forEach((el) => {
      el.classList.toggle('hidden', sd ? false : isHost());
      el.textContent = sd
        ? `Day ${r.day + 1} opens when everyone is ready · ${readyCount}/${S.snap.players.length} ready`
        : 'Waiting for the host to start the next day…';
    });
    if (S.resView === 'report') renderReport(r);
    else renderShop();
  }

  function renderReport(r) {
    const sd = r.mode === 'showdown';
    const sig = JSON.stringify(r) + JSON.stringify(myShop()) + S.snap.players.map((p) => p.id + p.ready).join();
    if (sig === S.reportSig) return;
    const firstPaint = !S.reportSig;
    S.reportSig = sig;
    const anim = (i) => (firstPaint ? `animation-delay:${0.3 + i * 0.07}s` : 'animation:none');
    $('#resTitle').textContent = sd ? `Day ${r.day} Showdown` : `Day ${r.day} Complete!`;
    const mine = r.players.find((p) => p.id === S.pid);
    const grade = $('#resGrade');
    grade.classList.toggle('hidden', sd && r.players.length > 1);
    grade.textContent = sd && mine ? mine.grade : r.grade;
    grade.dataset.g = grade.textContent;
    const podium = $('#podium');
    podium.classList.toggle('hidden', !(sd && r.players.length > 1));
    if (sd && r.players.length > 1) {
      // second, first, third, so the winner stands in the middle
      const slots = [1, 0, 2].filter((rank) => r.players[rank]);
      const heights = ['86%', '62%', '44%'];
      podium.innerHTML = slots.map((rank) => {
        const p = r.players[rank];
        return `<div class="pod ${rank === 0 ? 'first' : ''}">
          ${rank === 0 ? '<span class="crown">👑</span>' : ''}${A.baristaSvg(p.color, p.id)}<span class="pn">${esc(p.name)}</span>
          <div class="block" style="--c:${p.color};--h:${heights[rank]};--dl:${firstPaint ? [0.9, 0.5, 0.2][rank] : 0}s"><b>${rank + 1}</b><span>${money(p.earned)}</span></div>
        </div>`;
      }).join('');
    }
    const stats = sd && mine
      ? [[mine.served, 'Served'], [mine.lost, 'Walked out'], [mine.perfects, 'Perfect'], [money(mine.earned), 'Earned today'], [money(mine.bonus), 'Bonus cash'], [money(mine.money), 'Your wallet']]
      : [[r.served, 'Drinks served'], [r.lost, 'Walked out'], [r.perfects, 'Perfect drinks'], [r.avg + '%', 'Avg quality'], [money(r.money), 'Earned today'], [money(S.snap.money), 'Team bank']];
    $('#resStats').innerHTML = stats.map(([v, l], i) => `<div style="${anim(i)}"><b>${v}</b><span>${l}</span></div>`).join('');
    const board = $('#resTable');
    board.classList.toggle('hidden', r.players.length < 2);
    board.innerHTML = r.players.map((p, i) => {
      const live = player(p.id);
      const ready = sd ? `<span class="rdy ${live && live.ready ? 'on' : ''}">${live && live.ready ? 'READY' : live ? 'shopping' : 'left'}</span>` : '';
      const extra = sd ? ` · +${money(p.bonus)} bonus` : ` · ${p.perfects} perfect`;
      const amt = sd ? `${money(p.earned)}<small>wallet ${money(p.money)}</small>` : money(p.earned);
      return `<div class="lb-row ${p.id === S.pid ? 'me' : ''}" style="${anim(i + 3)}">
        <span class="rank">${i + 1}</span>${A.baristaSvg(p.color, p.id)}
        <span class="who">${esc(p.name)}${i === 0 && p.earned > 0 ? ' 👑' : ''}${ready}<small>${p.served} served · ${p.avg}% avg${extra}</small></span>
        <span class="amt">${amt}</span></div>`;
    }).join('');
    const shop = myShop();
    const affordable = G.UPGRADES.some((u) => (shop.upgrades[u.id] || 0) < u.costs.length && shop.money + 1e-9 >= u.costs[shop.upgrades[u.id] || 0])
      || G.SPECIALS.some((s) => !shop.recipes.includes(s.id) && shop.money + 1e-9 >= s.cost);
    $('#shopBtn').innerHTML = `🛒 Shop${affordable ? '<span class="new-badge">NEW</span>' : ''}`;
  }

  function recipeMini(rc) {
    const bits = [`<span class="pill"><span class="swatch" style="background:${A.teaColor(rc.tea)}"></span>${teaShort(rc.tea)}</span>`];
    bits.push(`<span class="pill">🍯${G.SWEETNESS[rc.sweet]}</span><span class="pill">🧊${ICE_SHORT[rc.ice]}</span>`);
    for (const t of rc.toppings) bits.push(`<span class="pill"><span class="swatch" style="background:${A.topColor(t)}"></span>${topShort(t)}</span>`);
    if (rc.drizzle) bits.push(`<span class="pill dz"><span class="swatch sq" style="background:${A.drizzleColor(rc.drizzle)}"></span>${byId(G.DRIZZLES, rc.drizzle).short}</span>`);
    return bits.join('');
  }

  function renderShop() {
    const shop = myShop();
    const sig = S.shopTab + shop.money + JSON.stringify(shop.upgrades) + shop.recipes.join();
    if (sig === S.shopSig) return;
    const firstPaint = !S.shopSig || !S.shopSig.startsWith(S.shopTab);
    S.shopSig = sig;
    const bank = $('#shopBank');
    if (bank.textContent !== money(shop.money) && !firstPaint) replay(bank.parentElement, 'bump');
    bank.textContent = money(shop.money);
    $('#bankLabel').textContent = showdown() ? 'Your wallet' : 'Team bank';
    $$('#shopTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.shopTab));
    const grid = $('#shopGrid');
    grid.classList.toggle('settled', !firstPaint);
    const can = (cost) => shop.money + 1e-9 >= cost;
    const delay = (i) => `animation-delay:${firstPaint ? i * 0.04 : 0}s`;
    if (S.shopTab === 'upgrades') {
      grid.innerHTML = G.UPGRADES.map((u, i) => {
        const lv = shop.upgrades[u.id] || 0;
        const max = u.costs.length;
        const cost = u.costs[lv];
        const pips = max > 1 ? `<div class="up-pips">${u.costs.map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div>` : '<div class="up-pips"></div>';
        const buy = lv >= max
          ? `<div class="max-tag">${max > 1 ? '★ Maxed out' : '✔ Owned'}</div>`
          : `<button class="gbtn ${can(cost) ? 'gbtn-mint' : 'gbtn-cream'}" data-buy="${u.id}" data-level="${lv}" ${can(cost) ? '' : 'disabled'}><span class="coin">$</span>${cost}</button>`;
        return `<div class="upgrade ${lv >= max ? 'maxed' : ''} ${S.justBought === u.id ? 'just' : ''}" style="${delay(i)}">
          <div class="up-icon">${u.icon}</div><div class="up-name">${u.name}</div>${pips}
          <div class="up-desc">${u.desc}</div>${buy}</div>`;
      }).join('');
    } else {
      grid.innerHTML = G.SPECIALS.map((s, i) => {
        const known = shop.recipes.includes(s.id);
        const buy = known
          ? '<div class="max-tag">✔ On your menu</div>'
          : `<button class="gbtn ${can(s.cost) ? 'gbtn-mint' : 'gbtn-cream'}" data-recipe="${s.id}" ${can(s.cost) ? '' : 'disabled'}><span class="coin">$</span>${s.cost}</button>`;
        return `<div class="upgrade up-recipe ${known ? 'maxed' : ''} ${S.justBought === s.id ? 'just' : ''}" style="${delay(i)}">
          <div class="up-icon">${s.icon}</div><div class="up-name">${s.name}</div>
          <div class="up-pips" style="font-size:11px;font-weight:700;color:#b07a00">+${money(s.bonus)} a cup${s.minDay > day() + 1 ? ` · Day ${s.minDay}+` : ''}</div>
          <div class="up-desc">${s.desc}</div><div class="rc-mini">${recipeMini(s.recipe)}</div>${buy}</div>`;
      }).join('');
    }
    S.justBought = null;
  }

  $('#shopBtn').onclick = () => {
    S.resView = 'shop';
    S.shopSig = '';
    Sound.swish();
    renderResults();
  };
  $('#shopBackBtn').onclick = () => {
    S.resView = 'report';
    S.reportSig = '';
    Sound.swish();
    renderResults();
  };
  $('#shopTabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === S.shopTab) return;
    S.shopTab = b.dataset.tab;
    S.shopSig = '';
    Sound.click();
    renderResults();
  };
  $('#shopGrid').onclick = async (e) => {
    const b = e.target.closest('[data-buy],[data-recipe]');
    if (!b) {
      // phones hide the descriptions: tapping the card reads it out
      const card = e.target.closest('.upgrade');
      const desc = card && $('.up-desc', card);
      if (desc && !desc.offsetParent) toast(`${$('.up-name', card).textContent}: ${desc.textContent}`);
      return;
    }
    if (b.disabled || !S.t) return;
    b.disabled = true;
    const r = b.dataset.buy
      ? await S.t.send({ type: 'buy', id: b.dataset.buy, level: Number(b.dataset.level) })
      : await S.t.send({ type: 'recipe', id: b.dataset.recipe });
    if (!r.ok) {
      toast(r.error || 'Could not buy that', 'bad');
      S.shopSig = '';
      renderResults();
    }
  };
  $$('.next-day-btn').forEach((b) => (b.onclick = async () => {
    const r = await S.t.send({ type: 'start' });
    if (!r.ok) toast(r.error, 'bad');
  }));
  $$('.ready-btn').forEach((b) => (b.onclick = async () => {
    const mine = me();
    Sound.click();
    const r = await S.t.send({ type: 'ready', ready: !(mine && mine.ready) });
    if (!r.ok) toast(r.error, 'bad');
  }));

  /* ---------------- HUD ---------------- */
  let rollId = 0;
  function rollMoney(to) {
    const el = $('#money');
    const from = S.shownMoney == null ? to : S.shownMoney;
    S.shownMoney = to;
    if (from === to || calm()) {
      el.textContent = to.toFixed(2);
      return;
    }
    replay($('#wallet'), 'bump');
    const id = ++rollId;
    const t0 = performance.now();
    const step = (t) => {
      if (id !== rollId) return;
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = (from + (to - from) * (1 - Math.pow(1 - k, 3))).toFixed(2);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderTop() {
    const snap = S.snap;
    $('#dayLabel').textContent = snap.day;
    rollMoney(myShop().money);
    $('#modeTag').classList.toggle('hidden', !showdown());
    const sig = showdown() ? 'sd' : snap.players.map((p) => p.id + p.name + p.station + p.color).join('|');
    if (sig !== S.chipSig) {
      S.chipSig = sig;
      $('#playerChips').innerHTML = snap.players.length < 2 || showdown() ? '' : snap.players
        .map((p) => `<span class="chip ${p.id === S.pid ? 'me' : ''}" data-chip="${p.id}">${A.baristaSvg(p.color, p.id)}${esc(p.name)}<span class="st" title="${STATION_INFO[p.station].label}">${STATION_INFO[p.station].ico}</span></span>`)
        .join('');
      renderMates();
    }
  }

  /** Showdown race bar: everyone's takings for the day, re-sorted live. */
  function renderRace() {
    const box = $('#race');
    const on = showdown() && S.snap.players.length > 0;
    box.classList.toggle('hidden', !on);
    if (!on) return;
    const list = S.snap.players.slice().sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));
    const sig = list.map((p) => [p.id, p.earned, p.streak, p.station].join(':')).join('|');
    if (sig === S.raceSig) return;
    S.raceSig = sig;
    const top = Math.max(list[0].earned, 1);
    const old = new Map($$('.racer', box).map((el) => [el.dataset.racer, { left: el.getBoundingClientRect().left, earned: Number(el.dataset.earned), x: el.style.getPropertyValue('--x') }]));
    box.innerHTML = list.map((p, i) => {
      const lead = i === 0 && p.earned > 0;
      let diff = '';
      if (p.id === S.pid && list.length > 1) {
        const ref = i === 0 ? list[1] : list[0];
        const d = p.earned - ref.earned;
        diff = `<small class="${d >= 0 ? 'ahead' : 'behind'}">${d >= 0 ? '+' : '−'}${money(Math.abs(d))}</small>`;
      }
      const prev = old.get(p.id);
      return `<div class="racer ${p.id === S.pid ? 'me' : ''} ${lead ? 'lead' : ''}" data-racer="${p.id}" data-chip="${p.id}" data-earned="${p.earned}" style="--c:${p.color};--x:${prev ? prev.x || 0 : 0}">
        <span class="rk">${i + 1}</span>${A.baristaSvg(p.color, p.id)}
        <span class="info"><span class="nm">${lead ? '👑 ' : ''}${esc(p.name)}</span><span class="amt">${money(p.earned)}${diff}</span></span>
        <span class="meta">${p.streak >= 2 ? `<span class="hot">🔥${p.streak}</span>` : ''}<span>${STATION_INFO[p.station].ico}</span></span>
        <span class="track"><i></i></span></div>`;
    }).join('');
    const els = $$('.racer', box);
    for (const el of els) {
      const o = old.get(el.dataset.racer);
      if (o && !calm()) {
        const dx = o.left - el.getBoundingClientRect().left;
        if (Math.abs(dx) > 1) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
        if (Number(el.dataset.earned) > o.earned) replay(el, 'gain');
      }
    }
    requestAnimationFrame(() => {
      for (const el of els) el.style.setProperty('--x', (Number(el.dataset.earned) / top).toFixed(3));
    });
  }

  function buildEmotes() {
    $('#emotes').innerHTML = G.EMOTES.map((e) => `<button data-emote="${e}" aria-label="Send ${e}">${e}</button>`).join('');
  }
  $('#emoteBtn').onclick = (e) => {
    e.stopPropagation();
    $('#emotes').classList.toggle('hidden');
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.emote-wrap')) $('#emotes').classList.add('hidden');
  });
  $('#emotes').onclick = (e) => {
    const b = e.target.closest('[data-emote]');
    if (!b || !S.t) return;
    $('#emotes').classList.add('hidden');
    if (Date.now() - S.lastEmote < 700) return;
    S.lastEmote = Date.now();
    if (S.t.solo) floatEmote(S.pid, b.dataset.emote, true);
    else S.t.send({ type: 'emote', emote: b.dataset.emote });
  };

  function floatEmote(pid, emote, solo) {
    const chip = $(`[data-chip="${pid}"]`) || (solo || pid === S.pid ? $('.emote-wrap') : null);
    if (!chip) return;
    const el = document.createElement('span');
    el.className = 'float-emote';
    el.textContent = emote;
    chip.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  /* ---------------- dock ---------------- */
  function buildTabs() {
    $('#tabs').innerHTML = G.STATIONS
      .map((st, i) => `<button class="tab" data-station="${st}"><span class="key">${i + 1}</span><span class="ico">${STATION_INFO[st].ico}</span>${STATION_INFO[st].label}<span class="mates" data-mates="${st}"></span></button>`)
      .join('');
  }
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('[data-station]');
    if (b) switchStation(b.dataset.station);
  };
  function renderTabs() {
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.station === S.station));
    renderMates();
  }
  function renderMates() {
    if (!S.snap) return;
    for (const box of $$('[data-mates]')) {
      box.innerHTML = showdown() ? '' : S.snap.players
        .filter((p) => p.id !== S.pid && p.station === box.dataset.mates)
        .map((p) => `<i style="background:${p.color}" title="${esc(p.name)}"></i>`).join('');
    }
    // a sealed cup is ready to go: nudge the shake tab
    const shakeTab = $('.tab[data-station="shake"]');
    if (shakeTab) shakeTab.classList.toggle('ready-dot', S.cup.sealed && S.station !== 'shake');
  }
  function switchStation(st) {
    if (!G.STATIONS.includes(st) || st === S.station) return;
    stopPour();
    S.shake = null;
    const dir = G.STATIONS.indexOf(st) > G.STATIONS.indexOf(S.station) ? 'enter-right' : 'enter-left';
    S.station = st;
    Sound.swish();
    renderTabs();
    renderStation(dir);
    if (S.t && !S.t.solo) S.t.send({ type: 'station', station: st });
  }

  /* ---------------- ticket rail ---------------- */
  function orderPills(o) {
    const pills = o.toppings.map((t) => `<span class="pill"><span class="swatch" style="background:${A.topColor(t)}"></span>${topShort(t)}</span>`);
    if (o.drizzle) pills.push(`<span class="pill dz"><span class="swatch sq" style="background:${A.drizzleColor(o.drizzle)}"></span>${byId(G.DRIZZLES, o.drizzle).short}</span>`);
    return pills.length ? pills.join('') : '<span class="pill">No toppings</span>';
  }

  function ticketHtml(c) {
    const o = c.order;
    const owner = player(c.claimedBy);
    const mine = c.claimedBy === S.pid;
    const asking = c.request && c.request.from === S.pid;
    const sd = showdown();
    const rival = sd && owner && !mine;
    let tag = '';
    if (multi()) {
      if (asking) tag = `<span class="t-owner asking">⏳ Asked ${esc(owner ? owner.name : '')}</span>`;
      else if (mine) tag = '<span class="t-owner">You</span>';
      else if (owner) tag = `<span class="t-owner">${sd ? '⚔️' : '🔒'} ${esc(owner.name)}</span>`;
      else tag = '<span class="t-owner open">Open</span>';
    }
    const fresh = !S.seenTickets.has(c.id);
    S.seenTickets.add(c.id);
    const rot = (((c.id * 37) % 7) - 3) * 0.7;
    const sp = o.special && special(o.special);
    return `<button class="ticket ${owner ? 'owned' : ''} ${rival ? 'rival' : ''} ${sp ? 'special' : ''} ${S.active === c.id ? 'active' : ''} ${fresh ? 'fresh' : ''}" data-ticket="${c.id}" style="--rot:${rot}deg;--owner:${owner ? owner.color : 'transparent'}">
      <span class="clip"></span>
      <span class="t-head"><span class="t-num">#${c.id}</span><span class="t-name">${esc(c.name)}</span></span>
      ${sp ? `<span class="t-sp">${sp.icon} ${sp.name}</span>` : ''}
      <span class="t-line t-tea"><span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaShort(o.tea)}</span>
      ${rival ? '' : `<span class="t-line">🍯${G.SWEETNESS[o.sweet]}% · 🧊${ICE_SHORT[o.ice]}</span><span class="t-tops">${orderPills(o)}</span>`}
      ${tag}
      <span class="bar"><i data-bar="${c.id}"></i></span>
    </button>`;
  }

  function renderTickets() {
    const list = tickets();
    $('#tickets').innerHTML = list.length
      ? list.map(ticketHtml).join('')
      : `<div class="rail-empty">No tickets yet. Take an order at the Counter!</div>`;
    updateBars();
  }

  function refreshTicketViews() {
    renderTickets();
    renderOrderStrip();
    if (S.station === 'counter') renderCounter();
    if (S.station === 'shake' && S.cup.sealed) renderServeTargets();
    if (S.station === 'mix') updateAutoMix();
    if (S.station === 'toppings') renderStation();
  }

  async function selectTicket(cid) {
    const c = customer(cid);
    if (!c || c.status !== 'ordered') return;
    if (heldByOther(c)) {
      const owner = player(c.claimedBy);
      if (showdown()) return toast(`That's ${owner.name}'s customer`, 'bad');
      // never yank a ticket out of a teammate's hands: ask them for it instead
      if (c.request && c.request.from === S.pid) return toast(`Waiting for ${owner.name} to answer…`);
      const r = await S.t.send({ type: 'claim', cid });
      if (!r.ok) return toast(r.error, 'bad');
      if (r.pending) toast(`🙋 Asked ${owner.name} to pass you #${cid}`);
      return;
    }
    if (c.claimedBy !== S.pid) {
      const r = await S.t.send({ type: 'claim', cid });
      if (!r.ok) return toast(r.error, 'bad');
      if (r.pending) return toast(`${r.owner} grabbed #${cid} first. Asked them to pass it.`);
    }
    S.active = cid;
    S.serveTarget = null;
    Sound.click();
    refreshTicketViews();
  }

  $('#tickets').onclick = (e) => {
    const b = e.target.closest('[data-ticket]');
    if (b) selectTicket(Number(b.dataset.ticket));
  };

  /* ---------------- handoff prompts (co-op) ---------------- */
  function renderHandoffs() {
    const box = $('#handoffs');
    const asks = S.screen === 'game' && S.snap
      ? S.snap.customers.filter((c) => c.status === 'ordered' && c.claimedBy === S.pid && c.request && player(c.request.from))
      : [];
    const sig = asks.map((c) => c.id + ':' + c.request.from).join('|');
    if (sig === S.hoSig) return;
    S.hoSig = sig;
    box.innerHTML = asks.map((c) => {
      const who = player(c.request.from);
      return `<div class="handoff" data-ho="${c.id}">
        ${A.baristaSvg(who.color, who.id)}
        <div class="ho-text"><b>${esc(who.name)}</b> wants your ticket <b>#${c.id} ${esc(c.name)}</b>. Pass it over?</div>
        <div class="ho-btns">
          <button class="gbtn gbtn-mint" data-ho-answer="yes" data-cid="${c.id}">🤝 Pass it</button>
          <button class="gbtn gbtn-cream" data-ho-answer="no" data-cid="${c.id}">✋ Keep it</button>
        </div>
        <span class="bar"><i data-ho-bar="${c.id}"></i></span>
      </div>`;
    }).join('');
    updateBars();
  }
  $('#handoffs').onclick = async (e) => {
    const b = e.target.closest('[data-ho-answer]');
    if (!b || !S.t) return;
    $$('button', b.closest('.handoff')).forEach((x) => (x.disabled = true));
    const r = await S.t.send({ type: 'respond', cid: Number(b.dataset.cid), accept: b.dataset.hoAnswer === 'yes' });
    if (!r.ok) {
      toast(r.error, 'bad');
      S.hoSig = '';
      renderHandoffs();
    }
  };

  /* ---------------- recipe card ---------------- */
  function renderOrderStrip() {
    const card = $('#orderStrip');
    const c = S.active && customer(S.active);
    const cupHtml = `<div class="rc-cup">${A.cupSvg(S.cup, { target: true, mini: true, shadow: false })}</div>`;
    if (!c || !c.order) {
      card.innerHTML = `${cupHtml}<div class="rc-main"><div class="rc-title">Recipe card</div><div class="rc-hand">👆</div><div class="empty-msg">${showdown() ? 'Grab a customer at the Counter. One at a time!' : 'Take an order at the Counter, or tap a ticket on the rail.'}</div></div>`;
      return;
    }
    const o = c.order;
    const cup = S.cup;
    const sp = o.special && special(o.special);
    const items = [
      [cup.tea === o.tea, `<span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaShort(o.tea)}`],
      [cup.tea && Math.abs(cup.fill - G.FILL_TARGET) <= 0.04, 'Fill line'],
      [cup.sweet === o.sweet && cup.tea, `🍯 ${G.SWEETNESS[o.sweet]}%`],
      [cup.ice === o.ice && cup.tea, `🧊 ${ICE_SHORT[o.ice]}`],
    ];
    if (o.toppings.length) {
      for (const t of o.toppings) items.push([cup.toppings.includes(t), `<span class="swatch" style="background:${A.topColor(t)}"></span>${topShort(t)}`]);
    } else {
      items.push([cup.tea && cup.toppings.length === 0, 'No toppings']);
    }
    if (o.drizzle) items.push([cup.drizzle === o.drizzle, `<span class="swatch sq" style="background:${A.drizzleColor(o.drizzle)}"></span>${dzName(o.drizzle)}`]);
    else if (cup.drizzle) items.push([false, 'No drizzle']);
    items.push([cup.sealed && cup.shake >= 0.75, '🥤 Shake']);
    const done = items.filter(([ok]) => ok).length;
    card.innerHTML = `${cupHtml}<div class="rc-main"><div class="rc-title">#${c.id} ${esc(c.name)}${sp ? ` <span class="sp">${sp.icon}</span>` : ''} <small>${done}/${items.length}</small></div>
      <ul class="checklist">${items.map(([ok, h]) => `<li class="${ok ? 'ok' : ''}"><span class="box"></span>${h}</li>`).join('')}</ul></div>`;
  }

  /* ---------------- stations ---------------- */
  const stationEl = $('#station');
  const custEls = new Map();

  function renderStation(anim) {
    const fn = { counter: stationCounter, brew: stationBrew, mix: stationMix, toppings: stationToppings, shake: stationShake }[S.station];
    fn(stationEl);
    if (anim) {
      stationEl.classList.remove('enter-left', 'enter-right');
      replay(stationEl, anim);
    }
    renderMiniCup();
    renderMates();
  }

  function shell(cls, hint, body, noLock) {
    const info = STATION_INFO[S.station];
    return `<div class="scene ${cls}">
      <div class="st-head"><span class="st-sign">${info.ico} ${info.sign}</span><span class="st-hint">${hint}</span></div>
      ${noLock ? '' : lockedMsg()}${body}</div>`;
  }
  function lockedMsg() {
    return S.cup.sealed ? '<div class="locked-msg">🔒 Sealed! Serve it at Shake &amp; Serve, or dump it.</div>' : '';
  }
  function cupStage(opts) {
    opts = Object.assign({ drop: takeFx() }, opts);
    return `<div class="cup-stage" id="cupStage"><div class="big-cup"><div id="bigCup">${A.cupSvg(S.cup, opts)}</div>${opts.stream ? `<div class="stream" id="stream" style="--c:${opts.stream}"></div>` : ''}</div>${opts.extra || ''}</div>`;
  }
  function renderMiniCup() {
    $('#miniCup').innerHTML = A.cupSvg(S.cup, { target: true, mini: true });
    const rc = $('#orderStrip .rc-cup');
    if (rc) rc.innerHTML = A.cupSvg(S.cup, { target: true, mini: true, shadow: false });
  }
  function cupChanged() {
    renderMiniCup();
    renderOrderStrip();
  }
  function dumpCup() {
    stopPour();
    S.cup = freshCup();
    S.shake = null;
    Sound.squish();
    renderStation();
    renderOrderStrip();
  }
  const wanted = () => {
    const c = S.active && customer(S.active);
    return c && c.order ? c.order : null;
  };

  // ---- counter
  function stationCounter(el) {
    custEls.clear();
    const price = 4 + perks().bonusPrice;
    const known = myShop().recipes.map(special).filter(Boolean);
    const menu = G.TEAS.filter((t) => t.minDay <= day()).slice(0, 8).map((t) => `<span>${t.short}</span><span>${money(price)}</span>`).join('');
    const sp = known.slice(0, 2).map((s) => `<span class="sp">${s.icon} ${s.name}</span><span class="sp">${money(price + s.bonus)}</span>`).join('');
    el.innerHTML = shell('counter-scene', showdown() ? 'Grab a customer before your rivals do. One order at a time!' : `Take orders before patience runs out${multi() ? '. Tickets go on the team rail' : ''}.`, `
      <div class="wall">
        <div class="window" style="left:4%"><div class="cloud" style="top:16%"></div><div class="cloud" style="top:56%;animation-delay:-7s"></div></div>
        <div class="window" style="right:4%"><div class="cloud" style="top:30%;animation-delay:-3s"></div></div>
        <div class="lamp" style="left:30%"></div><div class="lamp" style="right:30%;animation-delay:-2s"></div>
        <div class="menu-board"><b>MENU</b>${menu}${sp}</div>
        <div class="neon">${showdown() ? 'SHOWDOWN' : 'OPEN'}</div>
      </div>
      <div class="line" id="line"></div>
      <div class="counter-lip"></div>
      <div class="counter-front"></div>
      <div class="counter-empty hidden" id="counterEmpty">No one here yet… the next customer is on the way!</div>`, true);
    renderCounter();
  }

  function counterAction(c, m) {
    const owner = player(c.claimedBy);
    const mine = c.claimedBy === S.pid;
    const asking = c.request && c.request.from === S.pid;
    const sd = showdown();
    if (c.status === 'waiting') {
      const busy = sd && myTicket();
      const sp = c.special && special(c.special);
      const bubble = sp && m !== 'angry' ? [`${sp.icon} ${sp.name}, please!`, sp.icon] : m === 'happy' ? ['Ready to order! 😊', '😊'] : m === 'ok' ? ['Um, excuse me?', '🙋'] : ['Hellooo?! 😠', '😠'];
      return {
        bubble, alert: true, sp: !!sp,
        action: busy
          ? '<button class="gbtn gbtn-cream" disabled><span class="long">Busy</span><span class="short">…</span></button>'
          : `<button class="gbtn gbtn-pink" data-take="${c.id}"><span class="long">Take order</span><span class="short">Take</span></button>`,
        figAttr: busy ? '' : `data-take="${c.id}"`,
      };
    }
    if (c.status === 'ordered') {
      const bubble = m === 'happy' ? [`${teaShort(c.order.tea)}, please!`, '🧋'] : m === 'ok' ? ['Is it ready yet?', '⏳'] : ['Hurry up! 😤', '😤'];
      if (sd && owner && !mine) return { bubble, action: `<span class="owner-tag" style="--owner:${owner.color}">⚔️ ${esc(owner.name)}</span>`, rival: true, figAttr: `data-ticket="${c.id}"` };
      let label = sd && !owner ? 'Grab it' : 'Open ticket';
      if (S.active === c.id) label = '✏️ On it';
      else if (mine) label = 'Your ticket';
      else if (asking) label = '⏳ Asked';
      else if (owner) label = `🔒 ${esc(owner.name)}`;
      return {
        bubble, mine,
        action: `<button class="gbtn ${S.active === c.id ? 'gbtn-grape' : 'gbtn-cream'}" data-ticket="${c.id}"><span class="long">${label}</span><span class="short">${S.active === c.id ? '✏️' : mine ? '★' : '🔒'}</span></button>`,
        figAttr: `data-ticket="${c.id}"`,
      };
    }
    if (c.status === 'served') {
      const b = c.stars === 3 ? ['PERFECT! ⭐⭐⭐', '🤩'] : c.stars === 2 ? ['Yum! ⭐⭐', '😋'] : c.stars === 1 ? ['It’s fine ⭐', '😐'] : ['Ew… 🤢', '🤢'];
      return { bubble: b, action: '', mine: c.claimedBy === S.pid };
    }
    return { bubble: ['I’m leaving! 😤', '😤'], action: '' };
  }

  function renderCounter() {
    const line = $('#line');
    if (!line || !S.snap) return;
    const seen = new Set();
    for (const c of S.snap.customers) {
      seen.add(c.id);
      let el = custEls.get(c.id);
      let fresh = false;
      if (!el || !el.isConnected) {
        el = document.createElement('div');
        line.appendChild(el);
        custEls.set(c.id, el);
        el._sig = '';
        fresh = true;
      }
      const p = patienceOf(c);
      const m = c.status === 'served' ? 'happy' : c.status === 'left' ? 'angry' : A.mood(p);
      const owner = player(c.claimedBy);
      const asking = c.request && c.request.from === S.pid;
      const busy = showdown() && !!myTicket();
      const sig = [c.status, m, c.claimedBy, S.active === c.id, owner && owner.name, asking, busy].join('|');
      if (sig === el._sig) continue;
      el._sig = sig;
      const a = counterAction(c, m);
      el.className = 'customer' + (fresh ? ' walking' : '') + (c.status === 'served' ? ' served' : c.status === 'left' ? ' left' : '') + (a.mine ? ' mine' : '') + (a.rival ? ' rival' : '');
      const live = c.status === 'waiting' || c.status === 'ordered';
      el.innerHTML = `<div class="bubble ${a.alert ? 'alert' : ''} ${a.sp ? 'sp' : ''}"><span class="long">${esc(a.bubble[0])}</span><span class="short">${a.bubble[1]}</span></div>
        <button class="cust-fig" ${a.figAttr || ''} aria-label="${esc(c.name)}">${A.customerSvg(c.look, m, { hearts: c.status === 'served' && c.stars >= 2 }).replace('<svg ', '<svg preserveAspectRatio="xMidYMax meet" ')}</button>
        <div class="plate"><span class="name">${esc(c.name)}</span>${live ? `<span class="bar"><i data-bar="${c.id}"></i></span>` : ''}${a.action}</div>`;
    }
    for (const [id, el] of custEls) {
      if (!seen.has(id)) {
        el.remove();
        custEls.delete(id);
      }
    }
    $('#counterEmpty').classList.toggle('hidden', S.snap.customers.length > 0);
    updateBars();
  }

  stationEl.addEventListener('click', async (e) => {
    const take = e.target.closest('[data-take]');
    if (take) {
      const cid = Number(take.dataset.take);
      $$(`[data-take="${cid}"]`).forEach((b) => (b.disabled = true));
      const r = await S.t.send({ type: 'take', cid });
      if (!r.ok) {
        $$(`[data-take="${cid}"]`).forEach((b) => (b.disabled = false));
        return toast(r.error, 'bad');
      }
      Sound.pop();
      if (!S.active || showdown()) {
        S.active = cid;
        refreshTicketViews();
      }
      return;
    }
    const tk = e.target.closest('[data-ticket]');
    if (tk) return selectTicket(Number(tk.dataset.ticket));
    if (e.target.closest('[data-dump]')) return dumpCup();
    if (e.target.closest('[data-automix]')) return autoMix();
    if (e.target.closest('[data-topbot]')) return autoToppings();
  });

  // ---- brew
  function fillText() {
    if (!S.cup.tea) return 'Pick a tea';
    if (S.cup.spilled) return '💦 Overflowed!';
    const pct = Math.round(S.cup.fill * 100);
    const off = Math.abs(S.cup.fill - G.FILL_TARGET);
    const tag = S.cup.fill === 0 ? '' : off <= 0.02 ? ' · Perfect!' : off <= 0.06 ? ' · Close' : S.cup.fill < G.FILL_TARGET ? ' · More' : ' · Too much';
    return `${pct}%${tag}`;
  }
  function fillMood() {
    if (!S.cup.tea || S.cup.fill === 0) return '';
    if (S.cup.spilled || S.cup.fill - G.FILL_TARGET > 0.06) return 'bad';
    return Math.abs(S.cup.fill - G.FILL_TARGET) <= 0.04 ? 'good' : '';
  }

  function stationBrew(el) {
    const locked = S.cup.sealed;
    const P = perks();
    const color = A.teaColor(S.cup.tea) || '#c9a27c';
    const o = wanted();
    el.innerHTML = shell('brew-scene', `Pick a tea, <b>hold</b> Pour (or Space), let go at the red line.${P.autoStop ? ' 🎯 Smart Spout stops for you.' : ''}`, `
      <div class="st-body brew-body">
        <div class="tap-machine">
          <div class="machine-head">TEA TAPS${P.pourRate > G.BASE_POUR_RATE ? ' ⚡' : ''}</div>
          <div class="taps">${G.TEAS.map((t) => {
            const soon = t.minDay > day();
            return `<button class="tap ${S.cup.tea === t.id ? 'selected' : ''} ${soon ? 'locked' : ''}" data-tea="${t.id}" style="--c:${t.color}" ${S.cup.fill > 0 || locked || soon ? 'disabled' : ''} title="${soon ? `Unlocks on Day ${t.minDay}` : t.name}"><span class="knob"></span><span>${soon ? '🔒' : ''}${t.short}${o && o.tea === t.id && !S.cup.tea ? ' 👈' : ''}</span></button>`;
          }).join('')}</div>
        </div>
        <div class="brew-ctrl">
          <button class="gbtn gbtn-pink gbtn-xl pour-btn" id="pourBtn" ${locked ? 'disabled' : ''}>Hold to Pour</button>
          <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump</button>
        </div>
        <div class="pour-area">
          <div class="nozzle"></div>
          ${cupStage({ target: true, stream: color }).replace('class="cup-stage" id="cupStage"', 'class="cup-stage" id="cupStage" style="flex:1;min-height:0;width:100%"')}
          <div class="readout ${fillMood()}" id="fillReadout">${fillText()}</div>
        </div>
      </div>`);
    $$('[data-tea]', el).forEach((b) => (b.onclick = () => {
      S.cup.tea = b.dataset.tea;
      Sound.click();
      renderStation();
      renderOrderStrip();
    }));
    const btn = $('#pourBtn');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      startPour();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stopPour));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function updatePourView(t) {
    const big = $('#bigCup');
    if (big) big.innerHTML = A.cupSvg(S.cup, { target: true, pouring: S.pouring, t });
    const ro = $('#fillReadout');
    if (ro) {
      ro.innerHTML = fillText();
      ro.className = 'readout ' + fillMood();
    }
    const st = $('#stream');
    if (!st) return;
    st.classList.toggle('on', S.pouring);
    if (!S.pouring) return;
    const svg = $('#bigCup .cup-svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const box = st.parentElement.getBoundingClientRect();
    // cup art: viewBox starts at y=-40 and is 236 tall; the surface sits at 184 - fill * 148
    const surface = r.top + ((184 - S.cup.fill * 148 + 40) / 236) * r.height;
    st.style.top = '0px';
    st.style.height = Math.max(0, surface - box.top) + 'px';
  }

  let lastSide = 0;
  function startPour() {
    if (S.station !== 'brew' || S.pouring || S.cup.sealed) return;
    if (!S.cup.tea) return toast('Pick a tea first!', 'bad');
    if (S.cup.spilled) return toast('It overflowed! Dump the cup and try again.', 'bad');
    S.pouring = true;
    const btn = $('#pourBtn');
    if (btn) btn.classList.add('pouring');
    $$('[data-tea]').forEach((b) => (b.disabled = true));
    const smart = perks().autoStop && S.cup.fill < G.FILL_TARGET;
    let last = performance.now();
    const step = (t) => {
      if (!S.pouring) return;
      S.cup.fill = Math.min(1, S.cup.fill + ((t - last) / 1000) * perks().pourRate);
      last = t;
      if (smart && S.cup.fill >= G.FILL_TARGET) {
        S.cup.fill = G.FILL_TARGET;
        stopPour();
        Sound.ding();
        return;
      }
      if (S.cup.fill >= 1) {
        S.cup.spilled = true;
        S.pouring = false;
        Sound.bad();
        toast('Overflow! 💦', 'bad');
        replay($('#cupStage'), 'shake-screen');
        if (btn) btn.classList.remove('pouring');
        updatePourView(t);
        cupChanged();
        return;
      }
      updatePourView(t);
      if (t - lastSide > 140) {
        lastSide = t;
        cupChanged();
        if (Math.random() < 0.5) Sound.tone(300 + Math.random() * 200, 0.04, 'sine', 0.02);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function stopPour() {
    if (!S.pouring) return;
    S.pouring = false;
    const btn = $('#pourBtn');
    if (btn) btn.classList.remove('pouring');
    Sound.click();
    updatePourView(performance.now());
    cupChanged();
  }

  // ---- mix
  function stationMix(el, pressed) {
    const locked = S.cup.sealed;
    const dis = locked ? 'disabled' : '';
    const cubes = [0, 1, 3];
    const o = wanted();
    el.innerHTML = shell('mix-scene', 'Pump the syrup (25% each), scoop the ice, pick a drizzle.', `
      <div class="st-body mix-body">
        <div class="syrup">
          <div class="sublabel">Sweet ${G.SWEETNESS[S.cup.sweet]}%</div>
          <button class="pump-bottle ${pressed ? 'press' : ''}" data-pump ${dis || (S.cup.sweet >= 4 ? 'disabled' : '')} aria-label="Pump syrup">
            <span class="pb-head"></span><span class="pb-stem"></span>
            <span class="pb-body"><span class="pb-syrup" style="height:${70 - S.cup.sweet * 8}%"></span><span class="pb-label">PUMP</span></span>
          </button>
          <div class="sweet-meter">${[1, 2, 3, 4].map((i) => `<span class="${S.cup.sweet >= i ? 'on' : ''}">${G.SWEETNESS[i]}</span>`).join('')}<button class="gbtn gbtn-cream" data-unpump ${dis} title="Reset sweetness" aria-label="Reset sweetness">↺</button></div>
        </div>
        <div class="mix-tools">
          <div class="mix-row"><div class="sublabel">Ice</div><div class="ice-bins">${G.ICE.map((name, i) => `<button class="bin ${S.cup.ice === i ? 'selected' : ''}" data-ice="${i}" ${dis}>
            <span class="cubes">${cubes[i] ? Array.from({ length: cubes[i] }, (_, k) => `<i style="--r:${(k * 23) % 30 - 12}deg"></i>`).join('') : '<b style="font-size:16px">🚫</b>'}</span>${ICE_SHORT[i]}</button>`).join('')}</div></div>
          <div class="mix-row"><div class="sublabel">Drizzle</div><div class="drizzles">
            <button class="dz-btn ${!S.cup.drizzle ? 'selected' : ''}" data-dz="" ${dis}><span class="dz-none">🚫</span><span>None</span></button>
            ${G.DRIZZLES.map((d) => {
              const soon = d.minDay > day();
              return `<button class="dz-btn ${S.cup.drizzle === d.id ? 'selected' : ''} ${soon ? 'locked' : ''}" data-dz="${d.id}" ${dis || (soon ? 'disabled' : '')} title="${soon ? `Unlocks on Day ${d.minDay}` : d.name}"><span class="dz-bottle" style="--c:${d.color}"></span><span>${soon ? '🔒' : ''}${d.short}${o && o.drizzle === d.id && S.cup.drizzle !== d.id ? ' 👈' : ''}</span></button>`;
            }).join('')}
          </div></div>
          <div class="automix" id="autoMixSlot"></div>
        </div>
        ${cupStage()}
      </div>`);
    $('[data-pump]', el).onclick = (e) => {
      const from = e.currentTarget.getBoundingClientRect();
      S.cup.sweet = Math.min(4, S.cup.sweet + 1);
      S.fx = 'syrup';
      Sound.pop();
      stationMix(el, true);
      flyBits(from, $('#bigCup'), ['#c97b33'], 2);
      cupChanged();
    };
    $('[data-unpump]', el).onclick = () => {
      S.cup.sweet = 0;
      Sound.click();
      renderStation();
      renderOrderStrip();
    };
    $$('[data-ice]', el).forEach((b) => (b.onclick = () => {
      const from = b.getBoundingClientRect();
      const next = Number(b.dataset.ice);
      if (next > S.cup.ice) S.fx = 'ice';
      S.cup.ice = next;
      Sound.plink(next + 1);
      renderStation();
      if (next) flyBits(from, $('#bigCup'), ['#e9f7ff'], next * 2);
      renderOrderStrip();
    }));
    $$('[data-dz]', el).forEach((b) => (b.onclick = () => {
      const id = b.dataset.dz || null;
      if (id === S.cup.drizzle) return;
      S.cup.drizzle = id;
      if (id) S.fx = 'drizzle';
      Sound.squish();
      renderStation();
      renderOrderStrip();
    }));
    updateAutoMix();
  }

  function updateAutoMix() {
    const slot = $('#autoMixSlot');
    if (!slot) return;
    if (!perks().autoMix) {
      slot.innerHTML = '';
      return;
    }
    const c = S.active && customer(S.active);
    const ready = c && c.order && !S.cup.sealed;
    const html = `<button class="gbtn gbtn-grape" data-automix ${ready ? '' : 'disabled'}>🤖 Mix-O-Matic${ready ? ` for #${c.id}` : ': pick a ticket'}</button>`;
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }
  function autoMix() {
    const c = S.active && customer(S.active);
    if (!c || !c.order || S.cup.sealed) return;
    if (c.order.ice > S.cup.ice) S.fx = 'ice';
    S.cup.sweet = c.order.sweet;
    S.cup.ice = c.order.ice;
    if (c.order.drizzle && S.cup.drizzle !== c.order.drizzle) S.fx = S.fx ? [S.fx, 'drizzle'] : 'drizzle';
    S.cup.drizzle = c.order.drizzle || null;
    Sound.levelUp();
    toast('🤖 Mixed to order!', 'good');
    renderStation();
    renderOrderStrip();
  }

  // ---- toppings
  function stationToppings(el, wiggle) {
    const locked = S.cup.sealed;
    const o = wanted();
    const jar = (t) => {
      const on = S.cup.toppings.includes(t.id);
      const soon = t.minDay > day();
      const want = o && o.toppings.includes(t.id);
      return `<button class="jar-btn ${on ? 'selected' : ''} ${soon ? 'locked' : ''} ${want ? 'wanted' : ''} ${wiggle === t.id ? 'wiggle' : ''}" data-top="${t.id}" style="--c:${t.color}" ${locked || soon ? 'disabled' : ''} title="${t.name}">
        <span class="jar-lid"></span><span class="jar-glass">${A.jarSvg(t.id)}</span>
        <span class="jl">${t.short}</span><span class="tagline-sm">${soon ? `🔒 Day ${t.minDay}` : on ? 'Added' : 'Tap'}</span></button>`;
    };
    const rows = [];
    for (let i = 0; i < G.TOPPINGS.length; i += 5) rows.push(`<div class="shelf-row">${G.TOPPINGS.slice(i, i + 5).map(jar).join('')}</div><div class="shelf-plank"></div>`);
    el.innerHTML = shell('toppings-scene', `Tap a jar to scoop it in, tap again to take it out. Max ${G.MAX_TOPPINGS}.`, `
      <div class="st-body top-body"><div class="shelf">${rows.join('')}<div class="topbot" id="topBotSlot"></div></div>${cupStage()}</div>`);
    $$('[data-top]', el).forEach((b) => (b.onclick = () => {
      const id = b.dataset.top;
      const list = S.cup.toppings;
      const from = b.getBoundingClientRect();
      let added = false;
      if (list.includes(id)) list.splice(list.indexOf(id), 1);
      else if (list.length >= G.MAX_TOPPINGS) return toast(`Max ${G.MAX_TOPPINGS} toppings per cup`, 'bad');
      else {
        list.push(id);
        S.fx = id;
        added = true;
      }
      if (added) Sound.plink(5);
      else Sound.pop();
      stationToppings(el, id);
      if (added) flyBits(from, $('#bigCup'), [A.topColor(id)], 6);
      cupChanged();
    }));
    updateTopBot();
  }

  function updateTopBot() {
    const slot = $('#topBotSlot');
    if (!slot) return;
    if (!perks().autoTop) {
      slot.innerHTML = '';
      return;
    }
    const o = wanted();
    const ready = o && !S.cup.sealed;
    const html = `<button class="gbtn gbtn-grape" data-topbot ${ready ? '' : 'disabled'}>🦾 Topping Bot${ready ? '' : ': pick a ticket'}</button>`;
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }
  function autoToppings() {
    const o = wanted();
    if (!o || S.cup.sealed) return;
    const fresh = o.toppings.filter((t) => !S.cup.toppings.includes(t));
    S.cup.toppings = o.toppings.slice();
    S.fx = fresh.length ? fresh : null;
    Sound.levelUp();
    Sound.plink(6);
    renderStation();
    cupChanged();
  }

  // ---- shake & serve
  function shakeLabel(q) {
    return q >= 0.9 ? 'Perfect shake! 🌟' : q >= 0.7 ? 'Nice shake 👍' : q >= 0.4 ? 'A bit sloppy 😅' : 'Barely shaken 😬';
  }

  function stationShake(el, justSealed) {
    const c = S.cup;
    if (!c.sealed) {
      el.innerHTML = shell('shake-scene', 'Seal the cup, then hit <b>STOP</b> (or Space) in the green zone.', `
        <div class="st-body shake-body">
          <div class="shake-ctrl">
            <div class="meter"><div class="meter-track"><div class="meter-zone" id="zone" style="display:none"></div><div class="meter-needle" id="needle" style="left:0%"></div></div></div>
            <div class="row">
              <button class="gbtn gbtn-pink gbtn-xl shake-btn" id="shakeBtn">🔒 Seal &amp; Shake</button>
              <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump</button>
            </div>
          </div>
          ${cupStage()}
        </div>`, true);
      $('#shakeBtn').onclick = () => (S.shake ? stopShake() : startShake());
      return;
    }
    el.innerHTML = shell('shake-scene', `${shakeLabel(c.shake)} ${showdown() ? 'Serve your customer!' : 'Pick who gets this drink.'}`, `
      <div class="st-body shake-body">
        <div class="shake-ctrl">
          <div class="sublabel">Serve to</div>
          <div class="serve-list" id="serveTargets"></div>
          <div class="row">
            <button class="gbtn gbtn-mint gbtn-xl serve-go" id="serveBtn">🛎️ Serve</button>
            <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump</button>
          </div>
        </div>
        ${cupStage({ straw: '#8a5cf6' })}
      </div>`, true);
    if (justSealed) replay($('#cupStage'), 'sealed-pop');
    $('#serveBtn').onclick = serve;
    $('#serveTargets').onclick = (e) => {
      const b = e.target.closest('[data-target]');
      if (!b || b.disabled) return;
      S.serveTarget = Number(b.dataset.target);
      Sound.click();
      renderServeTargets();
    };
    renderServeTargets();
  }

  function servable() {
    const list = tickets();
    return showdown() ? list.filter((c) => c.claimedBy === S.pid) : list;
  }
  function serveTargetId() {
    const list = servable().filter((c) => !heldByOther(c));
    if (S.serveTarget && list.some((c) => c.id === S.serveTarget)) return S.serveTarget;
    if (S.active && list.some((c) => c.id === S.active)) return S.active;
    const mine = list.find((c) => c.claimedBy === S.pid);
    return mine ? mine.id : list[0] ? list[0].id : null;
  }

  function renderServeTargets() {
    const box = $('#serveTargets');
    if (!box) return;
    const list = servable();
    const target = serveTargetId();
    const html = list.length
      ? list.map((c) => {
        const other = heldByOther(c) ? player(c.claimedBy) : null;
        const sp = c.order.special && special(c.order.special);
        return `<button class="target ${c.id === target ? 'selected' : ''}" data-target="${c.id}" ${other ? 'disabled' : ''}>
          <span class="swatch" style="background:${A.teaColor(c.order.tea)}"></span>
          <span>#${c.id} ${esc(c.name)}<small>${other ? `🔒 ${esc(other.name)}` : sp ? `${sp.icon} ${sp.name}` : teaShort(c.order.tea)}</small></span></button>`;
      }).join('')
      : `<div class="empty-msg">${showdown() ? 'Take an order at the Counter first.' : 'No open tickets. Take an order at the Counter first.'}</div>`;
    if (box.innerHTML !== html) box.innerHTML = html;
    const btn = $('#serveBtn');
    const tc = customer(target);
    btn.disabled = !tc || S.serving;
    btn.textContent = tc ? `🛎️ Serve ${tc.name}` : '🛎️ Serve';
  }

  function startShake() {
    if (S.cup.sealed || S.shake) return;
    if (!S.cup.tea || S.cup.fill <= 0) return toast('Pour some tea first!', 'bad');
    const P = perks();
    const margin = P.shakeHalfZone + 0.06;
    S.shake = {
      start: performance.now(),
      center: margin + Math.random() * (1 - 2 * margin),
      speed: (2.6 + 0.3 * Math.min(day(), 8)) * P.shakeSpeed,
      half: P.shakeHalfZone,
      grace: P.shakeGrace,
      pos: 0,
    };
    const zone = $('#zone');
    zone.style.display = 'block';
    zone.style.left = (S.shake.center - S.shake.half) * 100 + '%';
    zone.style.width = S.shake.half * 200 + '%';
    const btn = $('#shakeBtn');
    btn.textContent = '✋ STOP!';
    btn.classList.add('go');
    $('#cupStage').classList.add('shaking');
    $('#bigCup').innerHTML = A.cupSvg(Object.assign({}, S.cup, { sealed: true }));
    Sound.click();
    const step = (t) => {
      if (!S.shake) return;
      const sec = (t - S.shake.start) / 1000;
      S.shake.pos = (1 - Math.cos(sec * S.shake.speed)) / 2;
      const needle = $('#needle');
      if (needle) needle.style.left = S.shake.pos * 100 + '%';
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function stopShake() {
    if (!S.shake) return;
    const off = Math.abs(S.shake.pos - S.shake.center);
    const q = clamp(1 - Math.max(0, off - S.shake.grace) / 0.22, 0, 1);
    S.shake = null;
    S.cup.sealed = true;
    S.cup.shake = q;
    if (q >= 0.9) Sound.fanfare(); else Sound.pop();
    toast(shakeLabel(q), q >= 0.7 ? 'good' : '');
    stationShake(stationEl, true);
    if (q >= 0.9) flyBits($('#cupStage').getBoundingClientRect(), $('#bigCup'), ['#ffd166', '#ff5c8a', '#22c993', '#8a5cf6'], 10);
    cupChanged();
    renderMates();
  }

  async function serve() {
    const cid = serveTargetId();
    if (!cid || S.serving) return;
    const cust = customer(cid);
    S.serving = true;
    renderServeTargets();
    const c = S.cup;
    const from = $('#cupStage') && $('#cupStage').getBoundingClientRect();
    const r = await S.t.send({ type: 'serve', cid, drink: { tea: c.tea, fill: c.fill, sweet: c.sweet, ice: c.ice, toppings: c.toppings, drizzle: c.drizzle, shake: c.shake } });
    S.serving = false;
    if (!r.ok) {
      toast(r.error || 'Could not serve', 'bad');
      renderServeTargets();
      return;
    }
    Sound.cash();
    flyBits(from, $('#wallet'), [], Math.min(8, 2 + Math.round(r.result.earned / 2)), true);
    S.cup = freshCup();
    S.active = null;
    S.serveTarget = null;
    showResult(r.result, cust && cust.look);
    if (r.result.bonus) {
      Sound.streak(r.result.streak);
      banner(`Hot Streak ×${r.result.streak}`, `+${money(r.result.bonus)} bonus`, '#ff6b2c');
    }
    switchStation('counter');
    renderTickets();
    renderOrderStrip();
  }

  /* ---------------- score card ---------------- */
  let popTimer = null;
  function confetti() {
    const colors = ['#ff5c8a', '#ffc83d', '#22c993', '#8a5cf6', '#7fd3ff'];
    let html = '';
    for (let i = 0; i < 22; i++) {
      html += `<i style="--x:${Math.random() * 100}%;--c:${colors[i % colors.length]};--t:${1 + Math.random()}s;--d:${Math.random() * 0.3}s;--rot:${Math.random() * 720 - 360}deg"></i>`;
    }
    return `<div class="confetti">${html}</div>`;
  }

  function showResult(res, look) {
    const say = ['What is this?! 🤢', 'It’s… okay.', 'Yum, thanks!', 'PERFECTION! 🤩'][res.stars];
    const face = look ? A.customerSvg(look, res.stars >= 2 ? 'happy' : res.stars === 1 ? 'ok' : 'angry', { hearts: res.stars === 3 }) : '';
    const tags = [];
    const sp = res.special && special(res.special);
    if (sp) tags.push(`${sp.icon} ${sp.name}`);
    if (res.gold) tags.push(`✨ +${money(res.gold)}`);
    if (res.rush) tags.push(`⚡ Rush ×${G.RUSH_MULT}`);
    if (res.bonus) tags.push(`🔥 Streak +${money(res.bonus)}`);
    const box = $('#resultPop');
    box.innerHTML = `<div class="rp-card" role="status">
      ${res.stars === 3 ? confetti() : ''}
      <div class="rp-face">${face}</div>
      <div class="rp-say">${esc(res.name)}: “${say}”</div>
      <div class="rp-earned">+${money(res.earned)}<small>${res.total}% quality</small></div>
      <div class="rp-stars">${[1, 2, 3].map((i) => `<span class="star ${res.stars >= i ? 'on' : ''}" style="animation-delay:${0.1 + i * 0.12}s"></span>`).join('')}</div>
      <div class="rp-tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
    </div>`;
    clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      const card = $('.rp-card', box);
      if (card) card.classList.add('out');
      popTimer = setTimeout(() => (box.innerHTML = ''), 360);
    }, 3200);
  }

  /* ---------------- modals ---------------- */
  function openModal(html) {
    const modal = $('#modal');
    modal.innerHTML = html;
    modal.classList.remove('hidden');
    const ok = $('[data-close]', modal);
    if (ok) ok.focus();
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
  });

  function showHowTo() {
    openModal(`<div class="panel modal-card with-ribbon" role="dialog" aria-label="How to play">
      <div class="ribbon">How to play</div>
      <div class="modal-scroll"><ul class="howto-list">
        <li><span class="hi">🧾</span><span><b>Counter:</b> take a customer's order. It hangs on the ticket rail.</span></li>
        <li><span class="hi">🫖</span><span><b>Brew:</b> pick the tea, <i>hold</i> Pour and let go at the red line.</span></li>
        <li><span class="hi">🍯</span><span><b>Mix:</b> pump the syrup, scoop the ice and add the drizzle.</span></li>
        <li><span class="hi">🍡</span><span><b>Toppings:</b> add exactly what the ticket asks for.</span></li>
        <li><span class="hi">🥤</span><span><b>Shake &amp; Serve:</b> stop the needle in the green, then serve.</span></li>
        <li><span class="hi">🛒</span><span><b>Shop:</b> after each day buy upgrades and secret recipes that customers pay extra for.</span></li>
        <li><span class="hi">🤝</span><span><b>Co-op:</b> one bank. Tap a ticket to pick it up; teammates get asked to pass theirs.</span></li>
        <li><span class="hi">⚔️</span><span><b>Showdown:</b> same customers, separate shops. One order at a time, streaks and top-3 finishes pay bonus cash, the last 30s pay ×${G.RUSH_MULT}. Everyone readies up between days.</span></li>
      </ul></div>
      <p class="note">Keys: <kbd>1</kbd>-<kbd>5</kbd> stations, <kbd>Space</kbd> pours and stops the shaker.</p>
      <button class="gbtn gbtn-pink" data-close>Got it!</button>
    </div>`);
  }

  /* ---------------- live timers ---------------- */
  function updateBars() {
    if (!S.snap) return;
    for (const bar of $$('[data-bar]')) {
      const c = customer(Number(bar.dataset.bar));
      if (!c) continue;
      const p = patienceOf(c);
      bar.style.width = p * 100 + '%';
      bar.style.background = barColor(p);
      const tk = bar.closest('.ticket');
      if (tk) tk.classList.toggle('urgent', p < 0.2 && !tk.classList.contains('rival'));
    }
    for (const bar of $$('[data-ho-bar]')) {
      const c = customer(Number(bar.dataset.hoBar));
      if (!c || !c.request) continue;
      bar.style.width = clamp((c.request.expiresAt - now()) / G.HANDOFF_MS, 0, 1) * 100 + '%';
      bar.style.background = 'var(--ink)';
    }
  }

  setInterval(() => {
    if (!S.snap || S.screen !== 'game') return;
    const left = Math.max(0, S.snap.dayEndsAt - now());
    const secs = Math.ceil(left / 1000);
    $('#clock').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const ring = $('#clockRing');
    ring.style.setProperty('--p', clamp(left / (S.snap.dayLengthMs || G.DAY_LENGTH_MS), 0, 1));
    ring.classList.toggle('low', secs <= 20);
    document.body.classList.toggle('rush', showdown() && S.snap.phase === 'playing' && S.snap.rushAt > 0 && now() >= S.snap.rushAt);
    updateBars();
    if (S.station === 'counter') renderCounter();
  }, 250);

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (!$('#modal').classList.contains('hidden') && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
      e.preventDefault();
      return closeModal();
    }
    if (e.key === 'f' || e.key === 'F') return fsSupported && toggleFullscreen();
    if (S.screen !== 'game') return;
    const n = Number(e.key);
    if (n >= 1 && n <= G.STATIONS.length) return switchStation(G.STATIONS[n - 1]);
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (S.station === 'brew') startPour();
      else if (S.station === 'shake' && !S.cup.sealed) (S.shake ? stopShake() : startShake());
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && S.station === 'brew') stopPour();
  });
  window.addEventListener('blur', stopPour);
  window.addEventListener('pagehide', () => { if (S.t && !S.t.solo) S.t.close(); });

  renderBest();
  checkServer();
})();
