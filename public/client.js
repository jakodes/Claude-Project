/* Boba Rush client: menus, stations, multiplayer wiring. */
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
    counter: { ico: '🧾', label: 'Counter' },
    brew: { ico: '🫖', label: 'Brew' },
    mix: { ico: '🍯', label: 'Mix' },
    toppings: { ico: '🧋', label: 'Toppings' },
    shake: { ico: '🥤', label: 'Shake & Serve' },
  };
  const ICE_ICONS = ['🚫', '🧊', '🧊🧊'];
  const POUR_RATE = 0.32; // cup fraction per second
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
  };
  const now = () => Date.now() + S.offset;

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
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.06, i * 0.12)); },
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
    while (box.children.length >= 4) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 2950);
  }

  const player = (id) => (S.snap ? S.snap.players.find((p) => p.id === id) : null);
  const customer = (id) => (S.snap ? S.snap.customers.find((c) => c.id === id) : null);
  const tickets = () => (S.snap ? S.snap.customers.filter((c) => c.status === 'ordered').sort((a, b) => a.leaveAt - b.leaveAt) : []);
  const patienceOf = (c) => clamp((c.leaveAt - now()) / c.patienceMs, 0, 1);
  const barColor = (p) => (p > 0.5 ? 'var(--mint)' : p > 0.25 ? 'var(--yellow)' : 'var(--red)');
  const isHost = () => S.snap && S.snap.hostId === S.pid;

  function showScreen(name) {
    S.screen = name;
    for (const id of ['menu', 'lobby', 'game', 'results']) $('#' + id).classList.toggle('hidden', id !== name);
    window.scrollTo(0, 0);
  }

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
    $('#bestNote').textContent = best ? `🏆 Best solo day: ${money(best.money)} with grade ${best.grade} (Day ${best.day})` : '';
  }

  $('#soloBtn').onclick = () => startSession(new LocalTransport(myName()));
  $('#createBtn').onclick = () => joinRoom({ create: true });
  $('#joinBtn').onclick = () => joinRoom({ code: $('#codeInput').value });
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });

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
      history.replaceState(null, '', '?room=' + j.code);
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
      cup: freshCup(), pouring: false, shake: null, serving: false, lastMoney: 0, chipSig: '',
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
    history.replaceState(null, '', location.pathname);
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

    if (S.active && !tickets().some((c) => c.id === S.active)) S.active = null;
    if (S.serveTarget && !tickets().some((c) => c.id === S.serveTarget)) S.serveTarget = null;

    const screen = snap.phase === 'lobby' ? 'lobby' : snap.phase === 'results' ? 'results' : 'game';
    if (screen === 'game' && prevPhase !== 'playing') {
      S.cup = freshCup();
      S.active = null;
      S.station = 'counter';
      S.lastMoney = snap.money;
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
    }
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
      }
    }
  }

  /* ---------------- lobby & results ---------------- */
  function renderLobby() {
    const snap = S.snap;
    $('#lobbyCode').textContent = snap.code;
    $('#lobbyPlayers').innerHTML = snap.players
      .map((p) => `<li><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === snap.hostId ? ' 👑' : ''}${p.id === S.pid ? ' <span class="note">(you)</span>' : ''}</li>`)
      .join('');
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

  function onResults() {
    const r = S.snap.results;
    if (!r || !S.t.solo) return;
    const best = JSON.parse(store.get('boba-best') || 'null');
    if (r.served > 0 && (!best || r.money > best.money)) {
      store.set('boba-best', JSON.stringify({ money: r.money, grade: r.grade, day: r.day }));
      setTimeout(() => toast('🏆 New best solo day!', 'good'), 600);
    }
  }

  function renderResults() {
    const r = S.snap.results;
    if (!r) return;
    $('#resTitle').textContent = `Day ${r.day} complete!`;
    $('#resGrade').textContent = r.grade;
    $('#resStats').innerHTML = [
      [r.served, 'Drinks served'],
      [r.lost, 'Walked out'],
      [money(r.money), 'Earned today'],
      [r.perfects, 'Perfect drinks'],
      [r.avg + '%', 'Avg quality'],
      [money(S.snap.money), 'Shop total'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const table = $('#resTable');
    table.classList.toggle('hidden', r.players.length < 2);
    table.innerHTML = '<tr><th>Barista</th><th>Served</th><th>⭐⭐⭐</th><th>Avg</th><th>Earned</th></tr>' +
      r.players.map((p, i) => `<tr><td><span class="dot" style="background:${p.color};display:inline-block;vertical-align:middle"></span> ${esc(p.name)}${i === 0 && p.earned > 0 ? ' 👑' : ''}</td><td>${p.served}</td><td>${p.perfects}</td><td>${p.avg}%</td><td>${money(p.earned)}</td></tr>`).join('');
    const btn = $('#nextDayBtn');
    btn.textContent = `Open Day ${r.day + 1}`;
    btn.classList.toggle('hidden', !isHost());
    $('#resWait').classList.toggle('hidden', isHost());
  }
  $('#nextDayBtn').onclick = async () => {
    const r = await S.t.send({ type: 'start' });
    if (!r.ok) toast(r.error, 'bad');
  };

  /* ---------------- top bar ---------------- */
  function renderTop() {
    const snap = S.snap;
    $('#dayLabel').textContent = `Day ${snap.day}`;
    const m = $('#money');
    m.textContent = money(snap.money);
    if (snap.money !== S.lastMoney) {
      m.classList.remove('bump');
      void m.offsetWidth;
      m.classList.add('bump');
      S.lastMoney = snap.money;
    }
    const sig = snap.players.map((p) => p.id + p.name + p.station + p.color).join('|');
    if (sig !== S.chipSig) {
      S.chipSig = sig;
      $('#playerChips').innerHTML = snap.players.length < 2 ? '' : snap.players
        .map((p) => `<span class="chip ${p.id === S.pid ? 'me' : ''}" data-chip="${p.id}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="st" title="${STATION_INFO[p.station].label}">${STATION_INFO[p.station].ico}</span></span>`)
        .join('');
    }
  }

  function buildEmotes() {
    $('#emotes').innerHTML = G.EMOTES.map((e) => `<button data-emote="${e}" aria-label="Send ${e}">${e}</button>`).join('');
  }
  $('#emotes').onclick = (e) => {
    const b = e.target.closest('[data-emote]');
    if (!b || !S.t) return;
    if (Date.now() - S.lastEmote < 700) return;
    S.lastEmote = Date.now();
    if (S.t.solo) floatEmote(S.pid, b.dataset.emote, true);
    else S.t.send({ type: 'emote', emote: b.dataset.emote });
  };

  function floatEmote(pid, emote, solo) {
    const chip = $(`[data-chip="${pid}"]`) || (solo ? $('#emotes') : null);
    if (!chip) return;
    const el = document.createElement('span');
    el.className = 'float-emote';
    el.textContent = emote;
    if (solo) { chip.style.position = 'relative'; el.style.top = '30px'; }
    chip.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  /* ---------------- tabs ---------------- */
  function buildTabs() {
    $('#tabs').innerHTML = G.STATIONS
      .map((st, i) => `<button class="tab" data-station="${st}"><span class="ico">${STATION_INFO[st].ico}</span>${STATION_INFO[st].label}<span class="key">${i + 1}</span></button>`)
      .join('');
  }
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('[data-station]');
    if (b) switchStation(b.dataset.station);
  };
  function renderTabs() {
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.station === S.station));
  }
  function switchStation(st) {
    if (!G.STATIONS.includes(st)) return;
    stopPour();
    S.shake = null;
    S.station = st;
    renderTabs();
    renderStation();
    if (S.t && !S.t.solo) S.t.send({ type: 'station', station: st });
  }

  /* ---------------- tickets ---------------- */
  function ticketHtml(c) {
    const o = c.order;
    const owner = player(c.claimedBy);
    const tops = o.toppings.length
      ? o.toppings.map((t) => `<span class="swatch" style="background:${A.topColor(t)}"></span>${topName(t)}`).join(' &nbsp;')
      : 'No toppings';
    return `<button class="ticket ${S.active === c.id ? 'active' : ''}" data-ticket="${c.id}">
      <div class="t-head"><span>#${c.id} ${esc(c.name)}</span>${owner && S.snap.players.length > 1 ? `<span class="owner" style="background:${owner.color}">${esc(owner.name)}</span>` : ''}</div>
      <div class="t-line"><span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaName(o.tea)}</div>
      <div class="t-line">🍯 ${G.SWEETNESS[o.sweet]}% sweet · ${ICE_ICONS[o.ice]} ${G.ICE[o.ice]}</div>
      <div class="t-line">${tops}</div>
      <div class="bar"><i data-bar="${c.id}"></i></div>
    </button>`;
  }

  function renderTickets() {
    const list = tickets();
    $('#tickets').innerHTML = list.length
      ? list.map(ticketHtml).join('')
      : '<div class="empty-msg">No tickets yet. Take an order at the counter!</div>';
    updateBars();
  }

  async function selectTicket(cid) {
    const c = customer(cid);
    if (!c || c.status !== 'ordered') return;
    S.active = cid;
    S.serveTarget = null;
    renderTickets();
    renderOrderStrip();
    if (S.station === 'counter') renderCounter();
    if (S.station === 'shake' && S.cup.sealed) renderServeTargets();
    if (c.claimedBy !== S.pid) {
      const other = player(c.claimedBy);
      if (other && other.id !== S.pid) toast(`You took over ${other.name}'s ticket`);
      S.t.send({ type: 'claim', cid });
    }
  }

  $('#tickets').onclick = (e) => {
    const b = e.target.closest('[data-ticket]');
    if (b) selectTicket(Number(b.dataset.ticket));
  };

  function renderOrderStrip() {
    const strip = $('#orderStrip');
    const c = S.active && customer(S.active);
    if (!c || !c.order) {
      strip.className = 'order-strip empty';
      strip.innerHTML = '🧾 No ticket selected. Take an order at the Counter, or tap a ticket.';
      return;
    }
    const o = c.order;
    const cup = S.cup;
    const tag = (ok, html) => `<span class="tag ${ok ? 'ok' : ''}">${html}</span>`;
    const parts = [
      `<span>#${c.id} ${esc(c.name)}:</span>`,
      tag(cup.tea === o.tea, `<span class="swatch" style="background:${A.teaColor(o.tea)}"></span>${teaName(o.tea)}`),
      tag(cup.tea && Math.abs(cup.fill - G.FILL_TARGET) <= 0.04, 'Fill to line'),
      tag(cup.sweet === o.sweet && cup.tea, `🍯 ${G.SWEETNESS[o.sweet]}%`),
      tag(cup.ice === o.ice && cup.tea, `${ICE_ICONS[o.ice]} ${G.ICE[o.ice]}`),
    ];
    if (o.toppings.length) {
      for (const t of o.toppings) parts.push(tag(cup.toppings.includes(t), `<span class="swatch" style="background:${A.topColor(t)}"></span>${topName(t)}`));
    } else {
      parts.push(tag(cup.tea && cup.toppings.length === 0, 'No toppings'));
    }
    parts.push(tag(cup.sealed && cup.shake >= 0.75, 'Shake'));
    strip.className = 'order-strip';
    strip.innerHTML = parts.join('');
  }

  /* ---------------- stations ---------------- */
  const stationEl = $('#station');
  const custEls = new Map();

  function renderStation() {
    const fn = { counter: stationCounter, brew: stationBrew, mix: stationMix, toppings: stationToppings, shake: stationShake }[S.station];
    fn(stationEl);
    renderMiniCup();
  }

  function lockedMsg() {
    return S.cup.sealed ? '<div class="locked-msg">🔒 This cup is sealed. Serve it at Shake &amp; Serve, or dump it to start over.</div>' : '';
  }
  function cupStage(opts) {
    return `<div class="cup-stage" id="cupStage"><div id="bigCup">${A.cupSvg(S.cup, opts)}</div>${opts && opts.extra ? opts.extra : ''}</div>`;
  }
  function updateCupViews(opts) {
    const big = $('#bigCup');
    if (big) big.innerHTML = A.cupSvg(S.cup, opts || { target: S.station === 'brew' });
    renderMiniCup();
    renderOrderStrip();
    const ro = $('#fillReadout');
    if (ro) ro.innerHTML = fillText();
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
    el.innerHTML = `<h2>🧾 Counter</h2>
      <p class="hint">Take orders before customers lose patience. Every order becomes a ticket${S.snap && S.snap.players.length > 1 ? ' your whole team can see' : ''}.</p>
      <div class="counter-scene">
        <div class="shop-sign">🧋 BOBA RUSH</div>
        <div class="window-deco" style="left:24px"></div><div class="window-deco" style="right:24px"></div>
        <div class="line" id="line"></div>
        <div class="counter-top"></div>
        <div class="counter-empty hidden" id="counterEmpty">No one here yet… the next customer is on the way!</div>
      </div>`;
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
      const sig = [c.status, m, c.claimedBy, S.active === c.id, owner && owner.name].join('|');
      if (sig === el._sig) continue;
      el._sig = sig;
      el.className = 'customer' + (c.status === 'served' ? ' served' : c.status === 'left' ? ' left' : '');
      let bubble = '';
      let action = '';
      if (c.status === 'waiting') {
        bubble = m === 'happy' ? 'Ready to order! 😊' : m === 'ok' ? 'Um, excuse me?' : 'Hellooo?! 😠';
        action = `<button class="btn btn-primary take-btn" data-take="${c.id}">Take order</button>`;
      } else if (c.status === 'ordered') {
        bubble = m === 'happy' ? `${teaName(c.order.tea)}, please!` : m === 'ok' ? 'Is it ready yet?' : 'Hurry up! 😤';
        const mine = c.claimedBy === S.pid;
        const label = S.active === c.id ? '✏️ Working on it' : mine ? 'Your ticket' : owner ? `${esc(owner.name)}'s ticket` : 'Open ticket';
        action = `<button class="btn take-btn ${S.active === c.id ? 'btn-secondary' : ''}" data-ticket="${c.id}">${label}</button>`;
      } else if (c.status === 'served') {
        bubble = c.stars === 3 ? 'PERFECT! ⭐⭐⭐' : c.stars === 2 ? 'Yum! ⭐⭐' : c.stars === 1 ? 'It’s fine ⭐' : 'Ew… 🤢';
      } else {
        bubble = 'I’m leaving! 😤';
      }
      el.innerHTML = `<div class="bubble">${bubble}</div>${A.customerSvg(c.look, m)}
        <div class="name">${esc(c.name)}</div>
        ${c.status === 'waiting' || c.status === 'ordered' ? `<div class="bar"><i data-bar="${c.id}"></i></div>` : ''}
        ${action}`;
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
        renderTickets();
        renderOrderStrip();
        renderCounter();
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

  function stationBrew(el) {
    const locked = S.cup.sealed;
    el.innerHTML = `<h2>🫖 Brew</h2>
      <p class="hint">Pick a tea, then <b>hold</b> Pour (or Space) and let go at the red line.</p>
      ${lockedMsg()}
      <div class="station-grid">
        <div>
          <div class="section-label">Tea taps</div>
          <div class="choice-grid">${G.TEAS.map((t) => `<button class="choice ${S.cup.tea === t.id ? 'selected' : ''}" data-tea="${t.id}" ${S.cup.fill > 0 || locked ? 'disabled' : ''}><span class="blob" style="background:${t.color}"></span>${t.name}</button>`).join('')}</div>
          <div class="row" style="margin-top:16px"><button class="btn" data-dump>🗑️ Dump cup</button></div>
        </div>
        ${cupStage({ target: true, extra: `<div class="readout" id="fillReadout">${fillText()}</div><button class="btn btn-primary pour-btn" id="pourBtn" ${locked ? 'disabled' : ''}>Hold to Pour</button>` })}
      </div>`;
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

  function startPour() {
    if (S.station !== 'brew' || S.pouring || S.cup.sealed) return;
    if (!S.cup.tea) return toast('Pick a tea first!', 'bad');
    if (S.cup.spilled) return toast('It overflowed! Dump the cup and try again.', 'bad');
    S.pouring = true;
    const btn = $('#pourBtn');
    if (btn) btn.classList.add('pouring');
    $$('[data-tea]').forEach((b) => (b.disabled = true));
    let last = performance.now();
    const step = (t) => {
      if (!S.pouring) return;
      S.cup.fill = Math.min(1, S.cup.fill + ((t - last) / 1000) * POUR_RATE);
      last = t;
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
  function stationMix(el) {
    const locked = S.cup.sealed;
    const dis = locked ? 'disabled' : '';
    el.innerHTML = `<h2>🍯 Mix</h2>
      <p class="hint">Each pump adds 25% sweetness. Then scoop the right amount of ice.</p>
      ${lockedMsg()}
      <div class="station-grid">
        <div>
          <div class="section-label">Sweetness: ${G.SWEETNESS[S.cup.sweet]}%</div>
          <div class="pumps">${[1, 2, 3, 4].map((i) => `<i class="${S.cup.sweet >= i ? 'on' : ''}"></i>`).join('')}</div>
          <div class="row">
            <button class="btn btn-primary" data-pump ${dis || (S.cup.sweet >= 4 ? 'disabled' : '')}>🍯 Pump syrup</button>
            <button class="btn" data-unpump ${dis}>↺ Reset</button>
          </div>
          <div class="section-label">Ice</div>
          <div class="choice-grid">${G.ICE.map((name, i) => `<button class="choice ${S.cup.ice === i ? 'selected' : ''}" data-ice="${i}" ${dis}><span style="font-size:28px">${ICE_ICONS[i]}</span>${name}</button>`).join('')}</div>
        </div>
        ${cupStage()}
      </div>`;
    const pump = $('[data-pump]', el);
    pump.onclick = () => {
      S.cup.sweet = Math.min(4, S.cup.sweet + 1);
      Sound.pop();
      renderStation();
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
  }

  // ---- toppings
  function stationToppings(el) {
    const locked = S.cup.sealed;
    el.innerHTML = `<h2>🧋 Toppings</h2>
      <p class="hint">Tap a jar to add it, tap again to take it out. Up to ${G.MAX_TOPPINGS} per cup.</p>
      ${lockedMsg()}
      <div class="station-grid">
        <div class="choice-grid">${G.TOPPINGS.map((t) => {
          const on = S.cup.toppings.includes(t.id);
          return `<button class="choice ${on ? 'selected' : ''}" data-top="${t.id}" ${locked ? 'disabled' : ''}>
            <span class="jar"><i style="background:${t.color}"></i></span>${t.name}<span class="small">${on ? 'Added ✓' : 'Tap to add'}</span></button>`;
        }).join('')}</div>
        ${cupStage()}
      </div>`;
    $$('[data-top]', el).forEach((b) => (b.onclick = () => {
      const id = b.dataset.top;
      const list = S.cup.toppings;
      if (list.includes(id)) list.splice(list.indexOf(id), 1);
      else if (list.length >= G.MAX_TOPPINGS) return toast(`Max ${G.MAX_TOPPINGS} toppings per cup`, 'bad');
      else list.push(id);
      Sound.pop();
      renderStation();
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
      el.innerHTML = `<h2>🥤 Shake &amp; Serve</h2>
        <p class="hint">Seal the cup, then hit <b>Stop</b> (or Space) when the needle is in the green zone.</p>
        <div class="station-grid">
          <div>
            <div class="shaker"><div class="shaker-track"><div class="shaker-zone" id="zone" style="display:none"></div><div class="shaker-needle" id="needle" style="left:0%"></div></div></div>
            <div class="row" style="margin-top:18px">
              <button class="btn btn-primary btn-big" id="shakeBtn">🔒 Seal &amp; Shake</button>
              <button class="btn" data-dump>🗑️ Dump cup</button>
            </div>
          </div>
          ${cupStage()}
        </div>`;
      $('#shakeBtn').onclick = () => (S.shake ? stopShake() : startShake());
      return;
    }
    el.innerHTML = `<h2>🥤 Shake &amp; Serve</h2>
      <p class="hint">${shakeLabel(c.shake)} Pick who gets this drink and serve it.</p>
      <div class="station-grid">
        <div>
          <div class="section-label">Serve to</div>
          <div class="choice-grid" id="serveTargets"></div>
          <div class="row" style="margin-top:18px">
            <button class="btn btn-mint btn-big" id="serveBtn">🛎️ Serve</button>
            <button class="btn" data-dump>🗑️ Dump cup</button>
          </div>
        </div>
        ${cupStage({ straw: '#845ec2' })}
      </div>`;
    $('#serveBtn').onclick = serve;
    $('#serveTargets').onclick = (e) => {
      const b = e.target.closest('[data-target]');
      if (!b) return;
      S.serveTarget = Number(b.dataset.target);
      renderServeTargets();
    };
    renderServeTargets();
  }

  function serveTargetId() {
    const list = tickets();
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
      ? list.map((c) => `<button class="choice ${c.id === target ? 'selected' : ''}" data-target="${c.id}">
          <span class="blob" style="background:${A.teaColor(c.order.tea)}"></span>#${c.id} ${esc(c.name)}<span class="small">${teaName(c.order.tea)}</span></button>`).join('')
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
    S.shake = { start: performance.now(), center: 0.15 + Math.random() * 0.7, speed: 2.6 + 0.3 * Math.min(day, 8), pos: 0 };
    const zone = $('#zone');
    zone.style.display = 'block';
    zone.style.left = (S.shake.center - 0.09) * 100 + '%';
    zone.style.width = '18%';
    $('#shakeBtn').textContent = '✋ STOP!';
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
    const q = clamp(1 - Math.max(0, off - 0.03) / 0.22, 0, 1);
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
    S.cup = freshCup();
    S.active = null;
    S.serveTarget = null;
    showResult(r.result);
    switchStation('counter');
    renderTickets();
    renderOrderStrip();
  }

  /* ---------------- result modal ---------------- */
  let modalTimer = null;
  function showResult(res) {
    const lines = [['Tea', res.parts.tea, 20], ['Fill', res.parts.fill, 15], ['Sweetness', res.parts.sweet, 15], ['Ice', res.parts.ice, 10], ['Toppings', res.parts.toppings, 25], ['Shake', res.parts.shake, 15]];
    const say = ['What is this?! 🤢', 'It’s… okay.', 'Yum, thanks!', 'PERFECTION! 🤩'][res.stars];
    const modal = $('#modal');
    modal.innerHTML = `<div class="modal-card" role="dialog" aria-label="Drink result">
      <h2>${esc(res.name)}: “${say}”</h2>
      <div class="stars">${[1, 2, 3].map((i) => `<span class="${res.stars >= i ? '' : 'off'}">⭐</span>`).join('')}</div>
      <div class="breakdown">${lines.map(([l, v, max]) => `<span>${l}</span><b>${v}/${max}</b>`).join('')}<span><b style="text-align:left;display:block">Quality</b></span><b>${res.total}%</b></div>
      <div class="earned">+${money(res.earned)}</div>
      <p class="note">${money(res.price)} drink + ${money(res.tip)} tip</p>
      <button class="btn btn-primary" id="modalOk" style="margin-top:10px">Next order!</button>
    </div>`;
    modal.classList.remove('hidden');
    $('#modalOk').onclick = closeModal;
    clearTimeout(modalTimer);
    modalTimer = setTimeout(closeModal, 4000);
  }
  function closeModal() {
    clearTimeout(modalTimer);
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

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
  }

  setInterval(() => {
    if (!S.snap || S.screen !== 'game') return;
    const left = Math.max(0, S.snap.dayEndsAt - now());
    const secs = Math.ceil(left / 1000);
    const clock = $('#clock');
    clock.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    clock.classList.toggle('low', secs <= 20);
    updateBars();
    if (S.station === 'counter') renderCounter();
  }, 250);

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', (e) => {
    if (S.screen !== 'game' || e.target.tagName === 'INPUT') return;
    if (!$('#modal').classList.contains('hidden') && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
      e.preventDefault();
      return closeModal();
    }
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
