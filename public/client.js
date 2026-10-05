/* Boba Rush client: menus, stations, upgrade shop, multiplayer wiring. */
(function () {
  'use strict';
  const G = window.BobaGame;
  const A = window.BobaArt;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const money = (v) => '$' + (Number(v) || 0).toFixed(2);

  const STATION_INFO = {
    counter: { ico: '🧾', label: 'Counter', sign: 'Counter' },
    brew: { ico: '🫖', label: 'Brew', sign: 'Brew Bar' },
    mix: { ico: '🍯', label: 'Mix', sign: 'Mix Station' },
    toppings: { ico: '🍡', label: 'Toppings', sign: 'Topping Shelf' },
    shake: { ico: '🥤', label: 'Shake', sign: 'Shake & Serve' },
  };
  const ICE_SHORT = ['No ice', 'Less ice', 'Regular'];
  const PEARL_COLORS = ['#3a2419', '#3a2419', '#ff5d8f', '#f3bf3a', '#8a2c2c', '#eef3d2', '#9cc46f', '#b79ddb'];
  const teaName = (id) => (G.TEAS.find((t) => t.id === id) || {}).name || '?';
  const topName = (id) => (G.TOPPINGS.find((t) => t.id === id) || {}).name || '?';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  function freshCup() {
    return { tea: null, fill: 0, sweet: 0, ice: 0, toppings: [], sealed: false, shake: 0, spilled: false };
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
    lastMoney: 0,
    lastEmote: 0,
    chipSig: '',
    hoSig: '',
    lobbySig: '',
    reportSig: '',
    shopSig: '',
    resView: 'report',
    seenTickets: new Set(),
  };
  const now = () => Date.now() + S.offset;
  const setUrl = (u) => { try { history.replaceState(null, '', u); } catch (e) { /* sandboxed frame */ } };
  const perks = () => G.perks(S.snap && S.snap.upgrades);

  /* ---------------- sound ---------------- */
  const Sound = {
    ctx: null,
    on: store.get('boba-muted') !== '1',
    tone(f, d, type, v, delay) {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + (delay || 0);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(v || 0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + d + 0.02);
      } catch (e) { /* audio unavailable */ }
    },
    ding() { this.tone(988, 0.15, 'sine', 0.06); this.tone(1319, 0.25, 'sine', 0.06, 0.1); },
    cash() { this.tone(1568, 0.08, 'square', 0.035); this.tone(2093, 0.25, 'square', 0.035, 0.08); },
    bad() { this.tone(220, 0.25, 'sawtooth', 0.04); this.tone(165, 0.35, 'sawtooth', 0.04, 0.15); },
    pop() { this.tone(520 + Math.random() * 240, 0.06, 'triangle', 0.08); },
    click() { this.tone(420, 0.04, 'square', 0.03); },
    swish() { this.tone(660, 0.05, 'triangle', 0.04); this.tone(880, 0.06, 'triangle', 0.03, 0.04); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.06, i * 0.12)); },
    levelUp() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.03, i * 0.07)); },
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
  function toast(msg, kind) {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
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

  const player = (id) => (S.snap ? S.snap.players.find((p) => p.id === id) : null);
  const customer = (id) => (S.snap ? S.snap.customers.find((c) => c.id === id) : null);
  const tickets = () => (S.snap ? S.snap.customers.filter((c) => c.status === 'ordered').sort((a, b) => a.leaveAt - b.leaveAt) : []);
  const patienceOf = (c) => clamp((c.leaveAt - now()) / c.patienceMs, 0, 1);
  const barColor = (p) => (p > 0.5 ? 'var(--mint)' : p > 0.25 ? 'var(--yellow)' : 'var(--red)');
  const isHost = () => S.snap && S.snap.hostId === S.pid;
  const multi = () => S.snap && S.snap.players.length > 1;
  // someone else is holding this ticket right now
  const heldByOther = (c) => !!(c.claimedBy && c.claimedBy !== S.pid && player(c.claimedBy));

  function showScreen(name) {
    S.screen = name;
    document.body.dataset.screen = name;
    for (const id of ['menu', 'lobby', 'game', 'results']) $('#' + id).classList.toggle('hidden', id !== name);
    window.scrollTo(0, 0);
  }

  /* ---------------- backdrop & title ---------------- */
  (function buildBackdrop() {
    const bg = $('#bg');
    let html = '';
    for (let i = 0; i < 18; i++) {
      const size = 14 + Math.random() * 30;
      html += `<i style="left:${Math.random() * 100}%;width:${size}px;height:${size}px;--c:${PEARL_COLORS[i % PEARL_COLORS.length]};--d:${16 + Math.random() * 18}s;--delay:${-Math.random() * 30}s;--sway:${(Math.random() * 2 - 1) * 60}px"></i>`;
    }
    bg.innerHTML = html;
    $('#logoCup').innerHTML = A.cupSvg({ tea: 'taro', fill: 0.82, sweet: 2, ice: 1, toppings: ['pearls'], sealed: true }, { straw: '#ff5c8a' });
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
      cup: freshCup(), pouring: false, shake: null, serving: false, lastMoney: 0,
      chipSig: '', hoSig: '', lobbySig: '', reportSig: '', shopSig: '', resView: 'report', seenTickets: new Set(),
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
    if (S.serveTarget && !tickets().some((c) => c.id === S.serveTarget)) S.serveTarget = null;

    const screen = snap.phase === 'lobby' ? 'lobby' : snap.phase === 'results' ? 'results' : 'game';
    if (screen === 'game' && prevPhase !== 'playing') {
      S.cup = freshCup();
      S.active = null;
      S.station = 'counter';
      S.lastMoney = snap.money;
      S.seenTickets = new Set();
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
      renderTickets();
      renderOrderStrip();
      if (S.station === 'counter') renderCounter();
      if (S.station === 'shake' && S.cup.sealed) renderServeTargets();
      if (S.station === 'mix') updateAutoMix();
    }
    renderHandoffs();
  }

  function handleEvents(events, initial) {
    for (const e of events) {
      if (e.id <= S.seen) continue;
      S.seen = e.id;
      if (initial) continue;
      const who = player(e.pid);
      switch (e.type) {
        case 'arrive':
          Sound.ding();
          if (S.station !== 'counter') toast(`🔔 ${e.name} walked in`);
          break;
        case 'left':
          Sound.bad();
          toast(`😤 ${e.name} gave up and left`, 'bad');
          replay($('#station'), 'shake-screen');
          break;
        case 'served':
          if (e.pid !== S.pid) {
            Sound.cash();
            toast(`${who ? who.name : 'Someone'} served ${e.name} ${'⭐'.repeat(e.stars) || '😐'} +${money(e.earned)}`, 'good');
          }
          break;
        case 'join':
          if (e.pid !== S.pid) toast(`👋 ${e.name} joined the shop`, 'good');
          break;
        case 'leave':
          toast(`${e.name} left the shop`);
          break;
        case 'emote':
          floatEmote(e.pid, e.emote);
          break;
        case 'dayStart':
          toast(`☀️ Day ${e.day}: the shop is open!`, 'good');
          break;
        case 'dayEnd':
          Sound.fanfare();
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
          Sound.levelUp();
          toast(`${u.icon} ${e.pid === S.pid ? 'You' : who ? who.name : 'Someone'} bought ${u.name}${u.costs.length > 1 ? ' Lv ' + e.level : ''}!`, 'good');
          S.justBought = e.uid;
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
          ? `<div class="crew-slot">${p.id === snap.hostId ? '<span class="crown">👑</span>' : ''}${A.baristaSvg(p.color)}<span class="name">${esc(p.name)}</span><span class="tagline-sm">${p.id === S.pid ? 'You' : p.id === snap.hostId ? 'Host' : 'Barista'}</span></div>`
          : '<div class="crew-slot empty">Open spot</div>');
      }
      $('#lobbyPlayers').innerHTML = slots.join('');
    }
    $('#startBtn').classList.toggle('hidden', !isHost());
    $('#lobbyWait').classList.toggle('hidden', isHost());
  }
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

  /* ---------------- results & upgrade shop ---------------- */
  function onResults() {
    S.resView = 'report';
    S.reportSig = '';
    S.shopSig = '';
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
    $('#reportView').classList.toggle('hidden', S.resView !== 'report');
    $('#shopView').classList.toggle('hidden', S.resView !== 'shop');
    $$('.next-day-btn').forEach((b) => {
      b.textContent = `Open Day ${r.day + 1} ▶`;
      b.classList.toggle('hidden', !isHost());
    });
    $$('.res-wait').forEach((el) => el.classList.toggle('hidden', isHost()));
    if (S.resView === 'report') renderReport(r);
    else renderShop();
  }

  function renderReport(r) {
    const sig = JSON.stringify(r) + S.snap.money;
    if (sig === S.reportSig) return;
    S.reportSig = sig;
    $('#resTitle').textContent = `Day ${r.day} Complete!`;
    const grade = $('#resGrade');
    grade.textContent = r.grade;
    grade.dataset.g = r.grade;
    $('#resStats').innerHTML = [
      [r.served, 'Drinks served'],
      [r.lost, 'Walked out'],
      [r.perfects, 'Perfect drinks'],
      [r.avg + '%', 'Avg quality'],
      [money(r.money), 'Earned today'],
      [money(S.snap.money), 'Team bank'],
    ].map(([v, l], i) => `<div style="animation-delay:${0.35 + i * 0.07}s"><b>${v}</b><span>${l}</span></div>`).join('');
    const board = $('#resTable');
    board.classList.toggle('hidden', r.players.length < 2);
    board.innerHTML = r.players.map((p, i) => `<div class="lb-row">
        <span class="rank">${i + 1}</span>${A.baristaSvg(p.color)}
        <span>${esc(p.name)}${i === 0 && p.earned > 0 ? ' 👑' : ''}<small>${p.served} served · ${p.perfects} perfect · ${p.avg}% avg</small></span>
        <span class="amt">${money(p.earned)}</span></div>`).join('');
    const levels = S.snap.upgrades || {};
    const affordable = G.UPGRADES.some((u) => (levels[u.id] || 0) < u.costs.length && S.snap.money + 1e-9 >= u.costs[levels[u.id] || 0]);
    $('#shopBtn').innerHTML = `🛒 Upgrade Shop${affordable ? '<span class="new-badge">NEW</span>' : ''}`;
  }

  function renderShop() {
    const levels = S.snap.upgrades || {};
    const sig = S.snap.money + JSON.stringify(levels);
    if (sig === S.shopSig) return;
    const firstPaint = !S.shopSig;
    S.shopSig = sig;
    $('#shopBank').textContent = money(S.snap.money);
    const grid = $('#shopGrid');
    grid.classList.toggle('settled', !firstPaint);
    grid.innerHTML = G.UPGRADES.map((u, i) => {
      const lv = levels[u.id] || 0;
      const max = u.costs.length;
      const cost = u.costs[lv];
      const pips = max > 1 ? `<div class="up-pips">${u.costs.map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const buy = lv >= max
        ? `<div class="max-tag">${max > 1 ? '★ Maxed out' : '✔ Owned'}</div>`
        : `<button class="gbtn ${S.snap.money + 1e-9 >= cost ? 'gbtn-mint' : 'gbtn-cream'}" data-buy="${u.id}" data-level="${lv}" ${S.snap.money + 1e-9 >= cost ? '' : 'disabled'}><span class="coin">$</span>${cost}</button>`;
      return `<div class="upgrade ${lv >= max ? 'maxed' : ''} ${S.justBought === u.id ? 'just' : ''}" style="animation-delay:${firstPaint ? i * 0.05 : 0}s">
        <div class="up-icon">${u.icon}</div>
        <div class="up-name">${u.name}</div>
        <div class="up-desc">${u.desc}</div>
        ${pips}${buy}</div>`;
    }).join('');
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
  $('#shopGrid').onclick = async (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b || b.disabled || !S.t) return;
    b.disabled = true;
    const r = await S.t.send({ type: 'buy', id: b.dataset.buy, level: Number(b.dataset.level) });
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

  /* ---------------- HUD ---------------- */
  function renderTop() {
    const snap = S.snap;
    $('#dayLabel').textContent = snap.day;
    const m = $('#money');
    m.textContent = money(snap.money).slice(1);
    if (snap.money !== S.lastMoney) {
      replay($('#wallet'), 'bump');
      S.lastMoney = snap.money;
    }
    const sig = snap.players.map((p) => p.id + p.name + p.station + p.color).join('|');
    if (sig !== S.chipSig) {
      S.chipSig = sig;
      $('#playerChips').innerHTML = snap.players.length < 2 ? '' : snap.players
        .map((p) => `<span class="chip ${p.id === S.pid ? 'me' : ''}" data-chip="${p.id}">${A.baristaSvg(p.color)}${esc(p.name)}<span class="st" title="${STATION_INFO[p.station].label}">${STATION_INFO[p.station].ico}</span></span>`)
        .join('');
      renderMates();
    }
  }

  function coinPop(amount) {
    const el = document.createElement('span');
    el.className = 'coin-pop';
    el.textContent = '+' + money(amount);
    $('#wallet').appendChild(el);
    setTimeout(() => el.remove(), 1400);
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
    const chip = $(`[data-chip="${pid}"]`) || (solo ? $('.emote-wrap') : null);
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
      box.innerHTML = S.snap.players
        .filter((p) => p.id !== S.pid && p.station === box.dataset.mates)
        .map((p) => `<i style="background:${p.color}" title="${esc(p.name)}"></i>`).join('');
    }
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
  function ticketHtml(c) {
    const o = c.order;
    const owner = player(c.claimedBy);
    const mine = c.claimedBy === S.pid;
    const asking = c.request && c.request.from === S.pid;
    let tag = '';
    if (multi()) {
      if (asking) tag = `<span class="t-owner asking">⏳ Asked ${esc(owner ? owner.name : '')}</span>`;
      else if (mine) tag = '<span class="t-owner">You</span>';
      else if (owner) tag = `<span class="t-owner">🔒 ${esc(owner.name)}</span>`;
      else tag = '<span class="t-owner open">Open</span>';
    }
    const fresh = !S.seenTickets.has(c.id);
    S.seenTickets.add(c.id);
    const rot = (((c.id * 37) % 7) - 3) * 0.7;
    const tops = o.toppings.length
      ? o.toppings.map((t) => `<span class="pill"><span class="swatch" style="background:${A.topColor(t)}"></span>${topName(t)}</span>`).join('')
      : '<span class="pill">No toppings</span>';
    return `<button class="ticket ${owner ? 'owned' : ''} ${S.active === c.id ? 'active' : ''} ${fresh ? 'fresh' : ''}" data-ticket="${c.id}" style="--rot:${rot}deg;--owner:${owner ? owner.color : 'transparent'}">
      <span class="clip"></span>
      <span class="t-head"><span class="t-num">#${c.id}</span><span class="t-name">${esc(c.name)}</span></span>
      <span class="t-line t-tea"><span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaName(o.tea)}</span>
      <span class="t-line">🍯 ${G.SWEETNESS[o.sweet]}% · 🧊 ${ICE_SHORT[o.ice]}</span>
      <span class="t-tops">${tops}</span>
      ${tag}
      <span class="bar"><i data-bar="${c.id}"></i></span>
    </button>`;
  }

  function renderTickets() {
    const list = tickets();
    $('#tickets').innerHTML = list.length
      ? list.map(ticketHtml).join('')
      : '<div class="rail-empty">No tickets on the rail. Take an order at the Counter!</div>';
    updateBars();
  }

  function refreshTicketViews() {
    renderTickets();
    renderOrderStrip();
    if (S.station === 'counter') renderCounter();
    if (S.station === 'shake' && S.cup.sealed) renderServeTargets();
    if (S.station === 'mix') updateAutoMix();
  }

  async function selectTicket(cid) {
    const c = customer(cid);
    if (!c || c.status !== 'ordered') return;
    if (heldByOther(c)) {
      // never yank a ticket out of a teammate's hands: ask them for it instead
      const owner = player(c.claimedBy);
      if (c.request && c.request.from === S.pid) return toast(`Waiting for ${owner.name} to answer…`);
      const r = await S.t.send({ type: 'claim', cid });
      if (!r.ok) return toast(r.error, 'bad');
      if (r.pending) toast(`🙋 Asked ${owner.name} to pass you #${cid}`);
      return;
    }
    S.active = cid;
    S.serveTarget = null;
    Sound.click();
    refreshTicketViews();
    if (c.claimedBy !== S.pid) {
      const r = await S.t.send({ type: 'claim', cid });
      if (!r.ok) toast(r.error, 'bad');
      else if (r.pending) toast(`${r.owner} grabbed #${cid} first. Asked them to pass it.`);
    }
  }

  $('#tickets').onclick = (e) => {
    const b = e.target.closest('[data-ticket]');
    if (b) selectTicket(Number(b.dataset.ticket));
  };

  /* ---------------- handoff prompts ---------------- */
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
        ${A.baristaSvg(who.color)}
        <div class="ho-text"><b>${esc(who.name)}</b> wants to take your ticket <b>#${c.id} ${esc(c.name)}</b>. Pass it over?</div>
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
    if (!c || !c.order) {
      card.innerHTML = '<div class="rc-title">Recipe card</div><div class="rc-hand">👆</div><div class="empty-msg">No ticket yet. Take an order at the Counter, or tap a ticket on the rail.</div>';
      return;
    }
    const o = c.order;
    const cup = S.cup;
    const items = [
      [cup.tea === o.tea, `<span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaName(o.tea)}`],
      [cup.tea && Math.abs(cup.fill - G.FILL_TARGET) <= 0.04, 'Fill to the line'],
      [cup.sweet === o.sweet && cup.tea, `🍯 ${G.SWEETNESS[o.sweet]}% sweet`],
      [cup.ice === o.ice && cup.tea, `🧊 ${G.ICE[o.ice]}`],
    ];
    if (o.toppings.length) {
      for (const t of o.toppings) items.push([cup.toppings.includes(t), `<span class="swatch" style="background:${A.topColor(t)}"></span>${topName(t)}`]);
    } else {
      items.push([cup.tea && cup.toppings.length === 0, 'No toppings']);
    }
    items.push([cup.sealed && cup.shake >= 0.75, '🥤 Good shake']);
    const done = items.filter(([ok]) => ok).length;
    card.innerHTML = `<div class="rc-title">#${c.id} ${esc(c.name)} <small>${done}/${items.length}</small></div>
      <ul class="checklist">${items.map(([ok, h]) => `<li class="${ok ? 'ok' : ''}"><span class="box"></span>${h}</li>`).join('')}</ul>`;
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
      stationEl.scrollTop = 0;
    }
    renderMiniCup();
  }

  function shell(cls, hint, body, noLock) {
    const info = STATION_INFO[S.station];
    return `<div class="scene ${cls}">
      <div class="st-head"><span class="st-sign">${info.ico} ${info.sign}</span><span class="st-hint">${hint}</span></div>
      ${noLock ? '' : lockedMsg()}${body}</div>`;
  }
  function lockedMsg() {
    return S.cup.sealed ? '<div class="locked-msg">🔒 This cup is sealed. Serve it at Shake &amp; Serve, or dump it to start over.</div>' : '';
  }
  function cupStage(opts) {
    return `<div class="cup-stage" id="cupStage"><div class="big-cup"><div id="bigCup">${A.cupSvg(S.cup, opts)}</div></div>${opts && opts.extra ? opts.extra : ''}</div>`;
  }
  function updateCupViews(opts) {
    const big = $('#bigCup');
    if (big) big.innerHTML = A.cupSvg(S.cup, opts || { target: S.station === 'brew' });
    renderMiniCup();
    renderOrderStrip();
    const ro = $('#fillReadout');
    if (ro) {
      ro.innerHTML = fillText();
      ro.className = 'readout ' + fillMood();
    }
    updateStream();
  }
  function renderMiniCup() {
    $('#miniCup').innerHTML = A.cupSvg(S.cup, { target: true });
  }
  function dumpCup() {
    stopPour();
    S.cup = freshCup();
    S.shake = null;
    Sound.click();
    renderStation();
    renderOrderStrip();
  }

  // ---- counter
  function stationCounter(el) {
    custEls.clear();
    const price = 4 + perks().bonusPrice;
    el.innerHTML = shell('counter-scene', `Take orders before patience runs out${multi() ? '. Tickets go on the team rail' : ''}.`, `
      <div class="wall">
        <div class="window" style="left:18px"><div class="cloud" style="top:16px"></div><div class="cloud" style="top:52px;animation-delay:-7s"></div></div>
        <div class="window" style="right:18px"><div class="cloud" style="top:30px;animation-delay:-3s"></div></div>
        <div class="lamp" style="left:30%"></div><div class="lamp" style="right:30%"></div>
        <div class="menu-board"><b>MENU</b>${G.TEAS.map((t) => `<span>${t.name}</span><span>${money(price)}</span>`).join('')}</div>
      </div>
      <div class="line" id="line"></div>
      <div class="counter-lip"></div>
      <div class="counter-front"></div>
      <div class="counter-empty hidden" id="counterEmpty">No one here yet… the next customer is on the way!</div>`, true);
    renderCounter();
  }

  function renderCounter() {
    const line = $('#line');
    if (!line || !S.snap) return;
    const seen = new Set();
    for (const c of S.snap.customers) {
      seen.add(c.id);
      let el = custEls.get(c.id);
      if (!el || !el.isConnected) {
        el = document.createElement('div');
        el.className = 'customer';
        line.appendChild(el);
        custEls.set(c.id, el);
        el._sig = '';
      }
      const p = patienceOf(c);
      const m = c.status === 'served' ? 'happy' : c.status === 'left' ? 'angry' : A.mood(p);
      const owner = player(c.claimedBy);
      const asking = c.request && c.request.from === S.pid;
      const sig = [c.status, m, c.claimedBy, S.active === c.id, owner && owner.name, asking].join('|');
      if (sig === el._sig) continue;
      el._sig = sig;
      el.className = 'customer' + (c.status === 'served' ? ' served' : c.status === 'left' ? ' left' : '');
      let bubble = '';
      let action = '';
      if (c.status === 'waiting') {
        bubble = m === 'happy' ? 'Ready to order! 😊' : m === 'ok' ? 'Um, excuse me?' : 'Hellooo?! 😠';
        action = `<button class="gbtn gbtn-pink" data-take="${c.id}">Take order</button>`;
      } else if (c.status === 'ordered') {
        bubble = m === 'happy' ? `${teaName(c.order.tea)}, please!` : m === 'ok' ? 'Is it ready yet?' : 'Hurry up! 😤';
        const mine = c.claimedBy === S.pid;
        let label = 'Open ticket';
        if (S.active === c.id) label = '✏️ On it';
        else if (mine) label = 'Your ticket';
        else if (asking) label = '⏳ Asked';
        else if (owner) label = `🔒 ${esc(owner.name)}`;
        action = `<button class="gbtn ${S.active === c.id ? 'gbtn-grape' : 'gbtn-cream'}" data-ticket="${c.id}">${label}</button>`;
      } else if (c.status === 'served') {
        bubble = c.stars === 3 ? 'PERFECT! ⭐⭐⭐' : c.stars === 2 ? 'Yum! ⭐⭐' : c.stars === 1 ? 'It’s fine ⭐' : 'Ew… 🤢';
      } else {
        bubble = 'I’m leaving! 😤';
      }
      const live = c.status === 'waiting' || c.status === 'ordered';
      el.innerHTML = `<div class="bubble ${c.status === 'waiting' ? 'alert' : ''}">${bubble}</div>${A.customerSvg(c.look, m)}
        <div class="plate"><span class="name">${esc(c.name)}</span>${live ? `<span class="bar"><i data-bar="${c.id}"></i></span>` : ''}${action}</div>`;
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
      take.disabled = true;
      const r = await S.t.send({ type: 'take', cid });
      if (!r.ok) return toast(r.error, 'bad');
      Sound.pop();
      if (!S.active) {
        S.active = cid;
        refreshTicketViews();
      }
      return;
    }
    const tk = e.target.closest('[data-ticket]');
    if (tk) return selectTicket(Number(tk.dataset.ticket));
    if (e.target.closest('[data-dump]')) return dumpCup();
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
    el.innerHTML = shell('brew-scene', `Pick a tea, <b>hold</b> Pour (or Space), let go at the red line.${P.autoStop ? ' 🎯 Smart Spout stops for you.' : ''}`, `
      <div class="st-body brew-body">
        <div class="tap-machine">
          <div class="machine-head">TEA TAPS${P.pourRate > G.BASE_POUR_RATE ? ' ⚡' : ''}</div>
          <div class="taps">${G.TEAS.map((t) => `<button class="tap ${S.cup.tea === t.id ? 'selected' : ''}" data-tea="${t.id}" style="--c:${t.color}" ${S.cup.fill > 0 || locked ? 'disabled' : ''}><span class="knob"></span>${t.name}</button>`).join('')}</div>
        </div>
        <div class="row brew-ctrl">
          <button class="gbtn gbtn-pink gbtn-xl pour-btn" id="pourBtn" ${locked ? 'disabled' : ''}>Hold to Pour</button>
          <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump cup</button>
        </div>
        <div class="pour-area">
          <div class="nozzle"></div>
          <div class="big-cup"><div id="bigCup">${A.cupSvg(S.cup, { target: true })}</div><div class="stream" id="stream" style="--c:${color}"></div></div>
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

  function updateStream() {
    const st = $('#stream');
    if (!st) return;
    st.classList.toggle('on', S.pouring);
    if (!S.pouring) return;
    const svg = $('#bigCup .cup-svg');
    const h = svg ? svg.getBoundingClientRect().height : 0;
    // cup art: viewBox starts at y=-24, 194 tall; liquid surface sits at 160 - fill * 136
    st.style.height = ((160 - S.cup.fill * 136 + 24) / 194) * h + 'px';
  }

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
        if (btn) btn.classList.remove('pouring');
      }
      updateCupViews({ target: true });
      if (S.pouring) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function stopPour() {
    if (!S.pouring) return;
    S.pouring = false;
    const btn = $('#pourBtn');
    if (btn) btn.classList.remove('pouring');
    Sound.click();
    updateCupViews({ target: true });
  }

  // ---- mix
  function stationMix(el, pressed) {
    const locked = S.cup.sealed;
    const dis = locked ? 'disabled' : '';
    const cubes = [0, 1, 3];
    el.innerHTML = shell('mix-scene', 'Each pump adds 25% sweetness. Then scoop the right ice.', `
      <div class="st-body">
        <div class="mix-tools">
          <div class="syrup">
            <div class="sublabel">Sweetness ${G.SWEETNESS[S.cup.sweet]}%</div>
            <button class="pump-bottle ${pressed ? 'press' : ''}" data-pump ${dis || (S.cup.sweet >= 4 ? 'disabled' : '')} aria-label="Pump syrup">
              <span class="pb-head"></span><span class="pb-stem"></span>
              <span class="pb-body"><span class="pb-syrup"></span><span class="pb-label">PUMP ME</span></span>
            </button>
            <div class="sweet-meter">${[1, 2, 3, 4].map((i) => `<span class="${S.cup.sweet >= i ? 'on' : ''}">${G.SWEETNESS[i]}</span>`).join('')}</div>
            <button class="gbtn gbtn-cream gbtn-sm" data-unpump ${dis}>↺ Reset</button>
          </div>
          <div>
            <div class="sublabel">Ice</div>
            <div class="ice-bins">${G.ICE.map((name, i) => `<button class="bin ${S.cup.ice === i ? 'selected' : ''}" data-ice="${i}" ${dis}>
              <span class="cubes">${cubes[i] ? Array.from({ length: cubes[i] }, (_, k) => `<i style="--r:${(k * 23) % 30 - 12}deg"></i>`).join('') : '<b style="font-size:22px">🚫</b>'}</span>${name}</button>`).join('')}</div>
          </div>
          <div class="automix" id="autoMixSlot"></div>
        </div>
        ${cupStage()}
      </div>`);
    $('[data-pump]', el).onclick = () => {
      S.cup.sweet = Math.min(4, S.cup.sweet + 1);
      Sound.pop();
      stationMix(el, true);
      renderMiniCup();
      renderOrderStrip();
    };
    $('[data-unpump]', el).onclick = () => {
      S.cup.sweet = 0;
      Sound.click();
      renderStation();
      renderOrderStrip();
    };
    $$('[data-ice]', el).forEach((b) => (b.onclick = () => {
      S.cup.ice = Number(b.dataset.ice);
      Sound.pop();
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
    const html = `<button class="gbtn gbtn-grape" data-automix ${ready ? '' : 'disabled'} style="width:100%">🤖 Mix-O-Matic${ready ? ` for #${c.id}` : ': pick a ticket'}</button>`;
    if (slot.innerHTML !== html) slot.innerHTML = html;
  }
  stationEl.addEventListener('click', (e) => {
    if (!e.target.closest('[data-automix]')) return;
    const c = S.active && customer(S.active);
    if (!c || !c.order || S.cup.sealed) return;
    S.cup.sweet = c.order.sweet;
    S.cup.ice = c.order.ice;
    Sound.levelUp();
    toast('🤖 Mixed to order!', 'good');
    renderStation();
    renderOrderStrip();
  });

  // ---- toppings
  function stationToppings(el, wiggle) {
    const locked = S.cup.sealed;
    const day = S.snap ? S.snap.day : 1;
    const jar = (t) => {
      const on = S.cup.toppings.includes(t.id);
      const soon = t.minDay > day;
      return `<button class="jar-btn ${on ? 'selected' : ''} ${soon ? 'locked' : ''} ${wiggle === t.id ? 'wiggle' : ''}" data-top="${t.id}" style="--c:${t.color}" ${locked || soon ? 'disabled' : ''}>
        <span class="jar-lid"></span><span class="jar-glass"><i class="${t.id === 'foam' ? 'solid' : ''}"></i></span>
        ${t.name}<span class="tagline-sm">${soon ? `🔒 Day ${t.minDay}` : on ? 'Added ✔' : 'Tap to add'}</span></button>`;
    };
    const rows = [];
    for (let i = 0; i < G.TOPPINGS.length; i += 3) rows.push(`<div class="shelf-row">${G.TOPPINGS.slice(i, i + 3).map(jar).join('')}</div><div class="shelf-plank"></div>`);
    el.innerHTML = shell('toppings-scene', `Tap a jar to scoop it in, tap again to take it out. Max ${G.MAX_TOPPINGS}.`, `
      <div class="st-body"><div class="shelf">${rows.join('')}</div>${cupStage()}</div>`);
    $$('[data-top]', el).forEach((b) => (b.onclick = () => {
      const id = b.dataset.top;
      const list = S.cup.toppings;
      if (list.includes(id)) list.splice(list.indexOf(id), 1);
      else if (list.length >= G.MAX_TOPPINGS) return toast(`Max ${G.MAX_TOPPINGS} toppings per cup`, 'bad');
      else list.push(id);
      Sound.pop();
      stationToppings(el, id);
      renderMiniCup();
      renderOrderStrip();
    }));
  }

  // ---- shake & serve
  function shakeLabel(q) {
    return q >= 0.9 ? 'Perfect shake! 🌟' : q >= 0.7 ? 'Nice shake 👍' : q >= 0.4 ? 'A bit sloppy 😅' : 'Barely shaken 😬';
  }

  function stationShake(el) {
    const c = S.cup;
    if (!c.sealed) {
      el.innerHTML = shell('shake-scene', 'Seal the cup, then hit <b>STOP</b> (or Space) in the green zone.', `
        <div class="st-body">
          <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
            <div class="meter"><div class="meter-track"><div class="meter-zone" id="zone" style="display:none"></div><div class="meter-needle" id="needle" style="left:0%"></div></div></div>
            <div class="row" style="justify-content:center">
              <button class="gbtn gbtn-pink gbtn-xl shake-btn" id="shakeBtn">🔒 Seal &amp; Shake</button>
              <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump</button>
            </div>
          </div>
          ${cupStage()}
        </div>`, true);
      $('#shakeBtn').onclick = () => (S.shake ? stopShake() : startShake());
      return;
    }
    el.innerHTML = shell('shake-scene', `${shakeLabel(c.shake)} Pick who gets this drink.`, `
      <div class="st-body">
        <div>
          <div class="sublabel">Serve to</div>
          <div class="serve-list" id="serveTargets"></div>
          <div class="row" style="margin-top:18px">
            <button class="gbtn gbtn-mint gbtn-xl" id="serveBtn">🛎️ Serve</button>
            <button class="gbtn gbtn-cream gbtn-sm" data-dump>🗑️ Dump</button>
          </div>
        </div>
        ${cupStage({ straw: '#8a5cf6' })}
      </div>`, true);
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

  function serveTargetId() {
    const list = tickets().filter((c) => !heldByOther(c));
    if (S.serveTarget && list.some((c) => c.id === S.serveTarget)) return S.serveTarget;
    if (S.active && list.some((c) => c.id === S.active)) return S.active;
    const mine = list.find((c) => c.claimedBy === S.pid);
    return mine ? mine.id : list[0] ? list[0].id : null;
  }

  function renderServeTargets() {
    const box = $('#serveTargets');
    if (!box) return;
    const list = tickets();
    const target = serveTargetId();
    box.innerHTML = list.length
      ? list.map((c) => {
        const other = heldByOther(c) ? player(c.claimedBy) : null;
        return `<button class="target ${c.id === target ? 'selected' : ''}" data-target="${c.id}" ${other ? 'disabled' : ''}>
          <span class="swatch" style="background:${A.teaColor(c.order.tea)}"></span>
          <span>#${c.id} ${esc(c.name)}<small>${other ? `🔒 ${esc(other.name)}'s ticket` : teaName(c.order.tea)}</small></span></button>`;
      }).join('')
      : '<div class="empty-msg">No open tickets. Take an order at the Counter first.</div>';
    const btn = $('#serveBtn');
    const tc = customer(target);
    btn.disabled = !tc || S.serving;
    btn.textContent = tc ? `🛎️ Serve ${tc.name}` : '🛎️ Serve';
  }

  function startShake() {
    if (S.cup.sealed || S.shake) return;
    if (!S.cup.tea || S.cup.fill <= 0) return toast('Pour some tea first!', 'bad');
    const day = S.snap ? S.snap.day : 1;
    const P = perks();
    const margin = P.shakeHalfZone + 0.06;
    S.shake = {
      start: performance.now(),
      center: margin + Math.random() * (1 - 2 * margin),
      speed: (2.6 + 0.3 * Math.min(day, 8)) * P.shakeSpeed,
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
    renderStation();
    renderOrderStrip();
  }

  async function serve() {
    const cid = serveTargetId();
    if (!cid || S.serving) return;
    const cust = customer(cid);
    S.serving = true;
    renderServeTargets();
    const c = S.cup;
    const r = await S.t.send({ type: 'serve', cid, drink: { tea: c.tea, fill: c.fill, sweet: c.sweet, ice: c.ice, toppings: c.toppings, shake: c.shake } });
    S.serving = false;
    if (!r.ok) {
      toast(r.error || 'Could not serve', 'bad');
      renderServeTargets();
      return;
    }
    Sound.cash();
    coinPop(r.result.earned);
    S.cup = freshCup();
    S.active = null;
    S.serveTarget = null;
    showResult(r.result, cust && cust.look);
    switchStation('counter');
    renderTickets();
    renderOrderStrip();
  }

  /* ---------------- modals ---------------- */
  let modalTimer = null;
  function openModal(html, autoMs) {
    const modal = $('#modal');
    modal.innerHTML = html;
    modal.classList.remove('hidden');
    clearTimeout(modalTimer);
    if (autoMs) modalTimer = setTimeout(closeModal, autoMs);
    const ok = $('[data-close]', modal);
    if (ok) ok.focus();
  }
  function closeModal() {
    clearTimeout(modalTimer);
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
  });

  function confetti() {
    const colors = ['#ff5c8a', '#ffc83d', '#22c993', '#8a5cf6', '#7fd3ff'];
    let html = '';
    for (let i = 0; i < 28; i++) {
      html += `<i style="--x:${Math.random() * 100}%;--c:${colors[i % colors.length]};--t:${1.2 + Math.random()}s;--d:${Math.random() * 0.4}s;--rot:${Math.random() * 720 - 360}deg"></i>`;
    }
    return `<div class="confetti">${html}</div>`;
  }

  function showResult(res, look) {
    const lines = [['Tea', res.parts.tea, 20], ['Fill', res.parts.fill, 15], ['Sweetness', res.parts.sweet, 15], ['Ice', res.parts.ice, 10], ['Toppings', res.parts.toppings, 25], ['Shake', res.parts.shake, 15]];
    const say = ['What is this?! 🤢', 'It’s… okay.', 'Yum, thanks!', 'PERFECTION! 🤩'][res.stars];
    const title = ['Yikes!', 'Okay!', 'Great!', 'Perfect!'][res.stars];
    const face = look ? `<div class="modal-face">${A.customerSvg(look, res.stars >= 2 ? 'happy' : res.stars === 1 ? 'ok' : 'angry')}</div>` : '';
    openModal(`<div class="panel modal-card with-ribbon" role="dialog" aria-label="Drink result">
      ${res.stars === 3 ? confetti() : ''}
      <div class="ribbon">${title}</div>
      ${face}
      <div class="say">${esc(res.name)}: “${say}”</div>
      <div class="stars">${[1, 2, 3].map((i) => `<span class="star ${res.stars >= i ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.15}s"></span>`).join('')}</div>
      <div class="breakdown">${lines.map(([l, v, max]) => `<span>${l}</span><b>${v}/${max}</b>`).join('')}<span class="tot">Quality</span><b class="tot">${res.total}%</b></div>
      <div class="earned">+${money(res.earned)}</div>
      <p class="note">${money(res.price)} drink + ${money(res.tip)} tip</p>
      <button class="gbtn gbtn-pink" data-close>Next order!</button>
    </div>`, 4500);
  }

  function showHowTo() {
    openModal(`<div class="panel modal-card with-ribbon" role="dialog" aria-label="How to play">
      <div class="ribbon">How to play</div>
      <ul class="howto-list">
        <li><span class="hi">🧾</span><span><b>Counter:</b> take a customer's order. It hangs on the ticket rail.</span></li>
        <li><span class="hi">🫖</span><span><b>Brew:</b> pick the tea, <i>hold</i> Pour and let go at the red line.</span></li>
        <li><span class="hi">🍯</span><span><b>Mix:</b> pump the syrup and scoop the right ice.</span></li>
        <li><span class="hi">🍡</span><span><b>Toppings:</b> add exactly what the ticket asks for.</span></li>
        <li><span class="hi">🥤</span><span><b>Shake &amp; Serve:</b> stop the needle in the green, then serve.</span></li>
        <li><span class="hi">🛒</span><span><b>Upgrade Shop:</b> after each day, spend the bank on faster taps, better shakers and more.</span></li>
        <li><span class="hi">🤝</span><span><b>Co-op:</b> tap a ticket to pick it up. If a teammate has it, they get asked to pass it over.</span></li>
      </ul>
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
