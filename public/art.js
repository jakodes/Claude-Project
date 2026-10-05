/* Boba Rush art: SVG drawings for cups, toppings and people. */
(function () {
  'use strict';
  const G = window.BobaGame;
  const find = (list, id) => list.find((t) => t.id === id) || {};
  const teaColor = (id) => find(G.TEAS, id).color;
  const topColor = (id) => find(G.TOPPINGS, id).color;
  const drizzleColor = (id) => find(G.DRIZZLES, id).color;
  const INK = '#2d1b33';
  let uidSeq = 0;
  const uid = (p) => p + (++uidSeq).toString(36);

  function rand(i, salt) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function hexToRgb(h) {
    const n = parseInt(String(h || '#888888').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** Blend two colors, t = 0 gives a, t = 1 gives b. */
  function mix(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const light = (c, t) => mix(c, '#ffffff', t);
  const dark = (c, t) => mix(c, '#000000', t);
  const f1 = (v) => Math.round(v * 10) / 10;

  /* ---------------- the cup ---------------- */
  // A clear plastic cup. Interior runs from the rim (y=32) down to the base (y=185).
  const TOP = 32;
  const RIM = 36;
  const BOTTOM = 184;
  const DEPTH = BOTTOM - RIM;
  const halfWidthAt = (y) => 47 - ((y - TOP) / (BOTTOM - TOP)) * 13;
  const OUTER = 'M20 30 L120 30 L106.5 183 Q106 189 99 189 L41 189 Q34 189 33.5 183 Z';
  const INNER = 'M23 32 L117 32 L104 182 Q103.5 186 98 186 L42 186 Q36.5 186 36 182 Z';
  const MILKY = new Set(['classic', 'taro', 'thai', 'strawberry', 'brown', 'coconut', 'matcha']);

  /** Where piece i of a topping sits. kind: heap (sinks), spread (suspended), surface (floats on top). */
  function spot(i, salt, kind, top, heapH, pad) {
    let y;
    if (kind === 'heap') y = BOTTOM - pad - Math.pow(rand(i, salt), 1.5) * heapH;
    else if (kind === 'surface') y = top + 1 + rand(i, salt) * 7;
    else y = top + 8 + Math.pow(rand(i, salt), 0.8) * Math.max(4, BOTTOM - top - 16);
    const hw = halfWidthAt(y) - pad - 2;
    const x = 70 + (rand(i, salt + 7) * 2 - 1) * hw;
    return [f1(x), f1(y)];
  }

  // Each topping knows how many pieces it has, how they settle and how to draw one.
  const PIECES = {
    pearls: { n: 26, kind: 'heap', heap: 30, pad: 6, spread: 0.25, draw: (x, y, d, i) => `<circle cx="${x}" cy="${y}" r="5.6" fill="url(#${d}p)"/><circle cx="${f1(x - 1.8)}" cy="${f1(y - 2)}" r="1.4" fill="#fff" opacity=".55"/>` },
    redbean: { n: 24, kind: 'heap', heap: 20, pad: 4, spread: 0.2, draw: (x, y, d, i) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2.5" fill="#7c2424" transform="rotate(${Math.round(rand(i, 4) * 180)} ${x} ${y})"/><circle cx="${f1(x - 1)}" cy="${f1(y - 0.8)}" r=".8" fill="#fff" opacity=".45"/>` },
    pudding: { n: 4, kind: 'heap', heap: 16, pad: 10, draw: (x, y) => `<path d="M${x - 9} ${y + 5} Q${x - 10} ${y - 6} ${x} ${y - 7} Q${x + 10} ${y - 6} ${x + 9} ${y + 5} Z" fill="#f6c443" stroke="#d9a21b" stroke-width="1"/><path d="M${x - 8} ${y - 2} Q${x} ${y - 9} ${x + 8} ${y - 2}" stroke="#a8641a" stroke-width="2.4" fill="none" opacity=".8"/>` },
    grass: { n: 7, kind: 'heap', heap: 40, pad: 8, spread: 0.4, draw: (x, y, d, i) => `<rect x="${x - 5.5}" y="${y - 5.5}" width="11" height="11" rx="2" fill="#2f3b2a" transform="rotate(${Math.round(rand(i, 6) * 60 - 30)} ${x} ${y})"/><path d="M${x - 4} ${y - 4} h6" stroke="#6f8a5f" stroke-width="1.5" opacity=".7" transform="rotate(${Math.round(rand(i, 6) * 60 - 30)} ${x} ${y})"/>` },
    popping: { n: 13, kind: 'spread', pad: 5, draw: (x, y, d) => `<circle cx="${x}" cy="${y}" r="5.2" fill="url(#${d}o)"/><circle cx="${f1(x - 1.6)}" cy="${f1(y - 1.8)}" r="1.6" fill="#fff" opacity=".85"/>` },
    crystal: { n: 14, kind: 'spread', pad: 5, draw: (x, y, d) => `<circle cx="${x}" cy="${y}" r="4.7" fill="url(#${d}c)" stroke="#fff" stroke-width=".8" opacity=".9"/><circle cx="${f1(x - 1.4)}" cy="${f1(y - 1.6)}" r="1.2" fill="#fff"/>` },
    jelly: { n: 11, kind: 'spread', pad: 6, draw: (x, y, d, i) => `<rect x="${x - 5}" y="${y - 3}" width="10" height="6" rx="1.6" fill="#f3f8dc" opacity=".78" stroke="#fff" stroke-width=".8" transform="rotate(${Math.round(rand(i, 8) * 140 - 70)} ${x} ${y})"/>` },
    aloe: { n: 12, kind: 'spread', pad: 5, draw: (x, y, d, i) => `<rect x="${x - 3.6}" y="${y - 3.6}" width="7.2" height="7.2" rx="1.6" fill="#e2f5cd" opacity=".82" stroke="#a9d38a" stroke-width=".8" transform="rotate(${Math.round(rand(i, 9) * 90)} ${x} ${y})"/>` },
    cookie: { n: 22, kind: 'surface', pad: 6, spread: 0.35, draw: (x, y, d, i) => `<path d="M${x - 2.6} ${y} l${f1(1.2 + rand(i, 3))} -2.6 l2.6 .6 l.8 2.6 l-2.4 1.6 z" fill="${rand(i, 5) > 0.75 ? '#efe6d8' : '#2e2424'}"/>` },
  };

  function cupDefs(d, color, cup) {
    const pop = cup.toppings && cup.toppings.includes('popping') ? topColor('popping') : '#ff5d8f';
    return `<defs>
      <clipPath id="${d}k"><path d="${INNER}"/></clipPath>
      <linearGradient id="${d}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light(color, 0.22)}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${dark(color, 0.16)}"/></linearGradient>
      <linearGradient id="${d}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".22" stop-color="#fff" stop-opacity=".06"/><stop offset=".78" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
      <radialGradient id="${d}p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8a5a3c"/><stop offset=".45" stop-color="#3a2419"/><stop offset="1" stop-color="#140a05"/></radialGradient>
      <radialGradient id="${d}o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${light(pop, 0.5)}"/><stop offset=".6" stop-color="${pop}"/><stop offset="1" stop-color="${dark(pop, 0.25)}"/></radialGradient>
      <radialGradient id="${d}c" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#dbe8ff" stop-opacity=".85"/><stop offset="1" stop-color="#b6c9f0" stop-opacity=".7"/></radialGradient>
      <linearGradient id="${d}i" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#e9f7ff" stop-opacity=".55"/><stop offset="1" stop-color="#bfe6fb" stop-opacity=".7"/></linearGradient>
      <linearGradient id="${d}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f6e2b8"/></linearGradient>
    </defs>`;
  }

  /** Brown-sugar style stripes running down the inside of the cup. */
  function drizzleSvg(id, animate) {
    const c = drizzleColor(id);
    const out = [];
    for (let k = 0; k < 9; k++) {
      const x0 = 70 + ((k + 0.5) / 9 * 2 - 1) * 40 + (rand(k, 41) - 0.5) * 6;
      const len = 46 + rand(k, 42) * 86;
      let dpath = `M${f1(x0)} ${RIM - 2}`;
      let x = x0;
      for (let s = 1; s <= 4; s++) {
        const y = RIM - 2 + (len * s) / 4;
        x += (rand(k * 4 + s, 43) - 0.5) * 9;
        dpath += ` Q${f1(x + (s % 2 ? 4 : -4))} ${f1(y - len / 8)} ${f1(x)} ${f1(y)}`;
      }
      const w = f1(2.5 + rand(k, 44) * 3.5);
      out.push(`<path d="${dpath}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity=".86" ${animate ? `pathLength="1" class="fx-draw" style="--dl:${(k * 0.05).toFixed(2)}s"` : ''}/>`);
    }
    out.push(`<path d="M36 ${BOTTOM - 3} Q70 ${BOTTOM - 13} 104 ${BOTTOM - 3} L104 190 L36 190Z" fill="${c}" opacity=".7" ${animate ? 'class="fx-fade"' : ''}/>`);
    return out.join('');
  }

  function cupSvg(cup, opts) {
    opts = opts || {};
    const d = uid('c');
    const fill = Math.min(1, cup.fill || 0);
    const hasTea = !!cup.tea && fill > 0;
    const liquidTop = BOTTOM - fill * DEPTH;
    const color = teaColor(cup.tea) || '#d9eef7';
    const drops = new Set([].concat(opts.drop || []));
    const drop = drops.size ? [...drops][0] : null;
    const t = opts.t || 0;
    const tops = cup.toppings || [];
    const mixed = cup.shake > 0 || cup.sealed;
    const p = [];
    p.push(cupDefs(d, color, cup));
    if (opts.shadow !== false) p.push(`<ellipse cx="70" cy="192" rx="44" ry="5" fill="#000" opacity=".14"/>`);
    p.push(`<path d="${INNER}" fill="#eef8fc" opacity=".6"/>`);
    // the straw sits inside the drink, so draw it first and let the tea tint it
    const straw = opts.straw || '#ff8fab';
    if (cup.sealed) p.push(`<line x1="86" y1="-36" x2="60" y2="180" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><line x1="86" y1="-36" x2="60" y2="180" stroke="${straw}" stroke-width="9" stroke-linecap="round"/>`);
    p.push(`<g clip-path="url(#${d}k)">`);
    if (hasTea) {
      p.push(`<rect x="0" y="${f1(liquidTop)}" width="140" height="${f1(BOTTOM - liquidTop + 6)}" fill="url(#${d}l)" opacity=".93"/>`);
      if (!mixed && MILKY.has(cup.tea) && fill > 0.25) {
        const h = BOTTOM - liquidTop;
        p.push(`<path d="M30 ${f1(liquidTop + h * 0.3)} C50 ${f1(liquidTop + h * 0.15)} 70 ${f1(liquidTop + h * 0.5)} 110 ${f1(liquidTop + h * 0.32)}" stroke="#fff" stroke-width="7" fill="none" opacity=".18" stroke-linecap="round"/>`);
        p.push(`<path d="M34 ${f1(liquidTop + h * 0.62)} C60 ${f1(liquidTop + h * 0.5)} 80 ${f1(liquidTop + h * 0.78)} 108 ${f1(liquidTop + h * 0.58)}" stroke="#fff" stroke-width="5" fill="none" opacity=".14" stroke-linecap="round"/>`);
      }
      if (cup.sweet > 0 && !mixed) {
        p.push(`<rect x="0" y="${BOTTOM - 8 - cup.sweet * 4}" width="140" height="${16 + cup.sweet * 4}" fill="#8a4b14" opacity="${0.1 + cup.sweet * 0.05}" ${drops.has('syrup') ? 'class="fx-fade"' : ''}/>`);
      } else if (cup.sweet > 0) {
        p.push(`<rect x="0" y="${f1(liquidTop)}" width="140" height="${f1(BOTTOM - liquidTop + 6)}" fill="#8a4b14" opacity="${0.03 * cup.sweet}"/>`);
      }
    }
    if (cup.drizzle) p.push(drizzleSvg(cup.drizzle, drops.has('drizzle')));

    // toppings: sinkers first, suspended pieces next, floaters last
    const top = hasTea ? liquidTop : BOTTOM - 26;
    const order = ['pearls', 'redbean', 'pudding', 'grass', 'popping', 'crystal', 'jelly', 'aloe'];
    for (const id of order) {
      if (!tops.includes(id)) continue;
      const spec = PIECES[id];
      const salt = 10 + order.indexOf(id) * 13;
      const dropping = drops.has(id);
      for (let i = 0; i < spec.n; i++) {
        let kind = spec.kind;
        if (spec.spread && hasTea && rand(i, salt + 2) < spec.spread) kind = 'spread';
        if (!hasTea && kind === 'spread') kind = 'heap';
        const [x, y] = spot(i, salt, kind, top, spec.heap || 30, spec.pad);
        const piece = spec.draw(x, y, d, i);
        p.push(dropping ? `<g class="fx-pc" style="--dl:${(i * 0.025 + rand(i, 3) * 0.1).toFixed(2)}s;--fy:${Math.round(-y - 40)}px">${piece}</g>` : piece);
      }
    }

    // ice floats near the surface
    const cubes = [0, 4, 7][cup.ice || 0];
    for (let i = 0; i < cubes; i++) {
      const band = hasTea ? Math.min(54, (BOTTOM - liquidTop) * 0.6) : 24;
      const y = (hasTea ? liquidTop + 3 : BOTTOM - 30) + rand(i, 21) * band;
      const hw = halfWidthAt(y) - 12;
      const x = 70 + (rand(i, 33) * 2 - 1) * hw;
      const s = 15 + rand(i, 34) * 5;
      const r = Math.round(rand(i, 5) * 50 - 25);
      const cube = `<g transform="rotate(${r} ${f1(x)} ${f1(y)})"><rect x="${f1(x - s / 2)}" y="${f1(y - s / 2)}" width="${f1(s)}" height="${f1(s)}" rx="3.5" fill="url(#${d}i)" stroke="#fff" stroke-width="1.2" stroke-opacity=".8"/><path d="M${f1(x - s / 2 + 3)} ${f1(y - s / 2 + 4)} l${f1(s * 0.35)} 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>`;
      p.push(drops.has('ice') ? `<g class="fx-pc" style="--dl:${(i * 0.06).toFixed(2)}s;--fy:${Math.round(-y - 40)}px">${cube}</g>` : cube);
    }

    // surface: a soft meniscus, rippling while the tap runs
    if (hasTea) {
      if (opts.pouring) {
        let w = `M0 ${f1(liquidTop)}`;
        for (let x = 0; x <= 140; x += 10) w += ` L${x} ${f1(liquidTop + Math.sin(x / 9 + t / 110) * 1.8)}`;
        p.push(`<path d="${w} L140 ${f1(liquidTop + 6)} L0 ${f1(liquidTop + 6)}Z" fill="${light(color, 0.35)}" opacity=".7"/>`);
        for (let i = 0; i < 7; i++) {
          const h = BOTTOM - liquidTop;
          if (h < 12) break;
          const by = BOTTOM - ((t / 1000) * 50 + i * 23) % h;
          const bx = 70 + (rand(i, 51) * 2 - 1) * (halfWidthAt(by) - 10);
          p.push(`<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(1.4 + rand(i, 52) * 1.6)}" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>`);
        }
      } else {
        p.push(`<ellipse cx="70" cy="${f1(liquidTop + 1)}" rx="${f1(halfWidthAt(liquidTop))}" ry="3" fill="${light(color, 0.35)}" opacity=".55"/>`);
      }
      if (drop && !(drops.size === 1 && drops.has('drizzle'))) p.push(`<ellipse class="fx-ripple" cx="70" cy="${f1(liquidTop + 1)}" rx="26" ry="3.5" fill="none" stroke="#fff" stroke-width="2"/>`);
    }

    if (tops.includes('foam')) {
      const fy = hasTea ? liquidTop : BOTTOM - 10;
      const foam = [`<rect x="0" y="${f1(fy - 4)}" width="140" height="22" fill="url(#${d}f)"/>`];
      let edge = `M0 ${f1(fy + 18)}`;
      for (let x = 0; x <= 140; x += 10) edge += ` Q${x + 5} ${f1(fy + 24 + rand(x, 61) * 4)} ${x + 10} ${f1(fy + 18)}`;
      foam.push(`<path d="${edge} L140 ${f1(fy)} L0 ${f1(fy)}Z" fill="#f6e2b8"/>`);
      for (let i = 0; i < 10; i++) foam.push(`<circle cx="${f1(26 + rand(i, 62) * 88)}" cy="${f1(fy + 2 + rand(i, 63) * 12)}" r="${f1(1 + rand(i, 64) * 1.6)}" fill="#fff" opacity=".7"/>`);
      p.push(drops.has('foam') ? `<g class="fx-foam">${foam.join('')}</g>` : foam.join(''));
    }
    if (tops.includes('cookie')) {
      const spec = PIECES.cookie;
      const ctop = (hasTea ? liquidTop : BOTTOM - 14) - (tops.includes('foam') ? 4 : 0);
      for (let i = 0; i < spec.n; i++) {
        const kind = hasTea && rand(i, 71) < spec.spread ? 'spread' : 'surface';
        const [x, y] = spot(i, 72, kind, ctop, 20, spec.pad);
        const piece = spec.draw(x, y, d, i);
        p.push(drops.has('cookie') ? `<g class="fx-pc" style="--dl:${(i * 0.02).toFixed(2)}s;--fy:${Math.round(-y - 30)}px">${piece}</g>` : piece);
      }
    }
    if (drops.has('syrup') && hasTea) {
      p.push(`<path class="fx-syrup" d="M70 ${RIM - 30} q-4 7 0 10 q4 -3 0 -10z" fill="#9a5418"/>`);
    }
    p.push(`</g>`);

    // the plastic itself
    p.push(`<path d="${OUTER}" fill="url(#${d}g)" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`);
    p.push(`<ellipse cx="70" cy="30.5" rx="50" ry="3.4" fill="none" stroke="${INK}" stroke-width="3"/>`);
    p.push(`<path d="M29 40 L40 176" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".5"/>`);
    p.push(`<path d="M111 44 L104 120" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>`);
    for (let y = 60; y < 180; y += 30) p.push(`<path d="M${f1(70 - halfWidthAt(y) - 1)} ${y} h3" stroke="${INK}" stroke-width="1" opacity=".18"/>`);
    // cold drinks sweat
    if (cup.ice && hasTea && !opts.mini) {
      for (let i = 0; i < 9; i++) {
        const y = liquidTop + 6 + rand(i, 81) * (BOTTOM - liquidTop - 12);
        const side = rand(i, 82) < 0.5 ? -1 : 1;
        const x = 70 + side * (halfWidthAt(y) - 2 - rand(i, 83) * 22);
        p.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="1.3" ry="1.9" fill="#fff" opacity=".7"/>`);
      }
    }
    if (opts.target) {
      const ty = BOTTOM - G.FILL_TARGET * DEPTH;
      p.push(`<line x1="6" x2="134" y1="${ty}" y2="${ty}" stroke="#ff4d6d" stroke-width="2.4" stroke-dasharray="6 4"/>`);
      if (!opts.mini) p.push(`<text x="134" y="${ty - 5}" font-size="10" text-anchor="end" fill="#ff4d6d" font-weight="700" font-family="Fredoka, sans-serif">FILL LINE</text>`);
    }
    if (cup.sealed) {
      p.push(`<path d="M17 31 Q70 18 123 31 L121 37 Q70 27 19 37 Z" fill="#fdfdfd" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
      p.push(`<path d="M30 31 Q70 23 110 31" stroke="${straw}" stroke-width="3" fill="none" stroke-dasharray="8 6" opacity=".8"/>`);
      p.push(`<line x1="86" y1="-36" x2="79.6" y2="17" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><line x1="86" y1="-36" x2="79.6" y2="17" stroke="${straw}" stroke-width="9" stroke-linecap="round"/>`);
      p.push(`<line x1="83.6" y1="-30" x2="79" y2="10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`);
    }
    if (cup.spilled) {
      p.push(`<path d="M22 32 q-7 16 -3 30 q5 -9 7 -24z M118 32 q7 18 3 34 q-5 -11 -7 -28z" fill="${color}" stroke="${INK}" stroke-width="1.5"/>`);
      p.push(`<ellipse cx="70" cy="191" rx="52" ry="5" fill="${color}" opacity=".85"/>`);
    }
    return `<svg class="cup-svg${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 -40 140 236" aria-hidden="true">${p.join('')}</svg>`;
  }

  /** A little window of what's inside a topping jar. */
  function jarSvg(id) {
    const d = uid('j');
    const spec = PIECES[id];
    const p = [`<defs><radialGradient id="${d}p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8a5a3c"/><stop offset=".45" stop-color="#3a2419"/><stop offset="1" stop-color="#140a05"/></radialGradient>
      <radialGradient id="${d}o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffc0d4"/><stop offset=".6" stop-color="#ff5d8f"/><stop offset="1" stop-color="#c23c66"/></radialGradient>
      <radialGradient id="${d}c" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#dbe8ff"/><stop offset="1" stop-color="#b6c9f0"/></radialGradient></defs>`];
    if (id === 'foam') {
      p.push(`<rect x="0" y="14" width="60" height="50" fill="#fff6e3"/><path d="M0 16 q8 -8 15 0 t15 0 t15 0 t15 0" fill="#fffaf0"/>`);
      for (let i = 0; i < 8; i++) p.push(`<circle cx="${f1(6 + rand(i, 1) * 48)}" cy="${f1(22 + rand(i, 2) * 36)}" r="${f1(1.5 + rand(i, 3) * 2)}" fill="#fff"/>`);
    } else if (spec) {
      p.push(`<rect x="0" y="40" width="60" height="30" fill="${id === 'pearls' || id === 'redbean' || id === 'grass' ? '#5a3a22' : '#f4f9e8'}" opacity=".35"/>`);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const x = f1(5 + rand(i, 91) * 50);
        const y = f1(64 - Math.pow(rand(i, 92), 0.7) * 46);
        p.push(spec.draw(x, y, d, i));
      }
    }
    return `<svg class="jar-svg" viewBox="0 10 60 56" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${p.join('')}</svg>`;
  }

  /* ---------------- people ---------------- */
  function mood(patience) {
    if (patience > 0.6) return 'happy';
    if (patience > 0.35) return 'ok';
    if (patience > 0.15) return 'upset';
    return 'angry';
  }

  function hairBack(style, h) {
    switch (style) {
      case 1: return `<path d="M33 50 C28 86 30 118 40 126 L80 126 C90 118 92 86 87 50 Z" fill="${h}"/>`;
      case 3: {
        let s = '';
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          s += `<circle cx="${f1(60 + Math.cos(a) * 28)}" cy="${f1(50 + Math.sin(a) * 26)}" r="${f1(11 + rand(i, 5) * 3)}" fill="${h}"/>`;
        }
        return s;
      }
      case 4: return `<path d="M80 38 C100 44 102 78 92 100 C88 84 86 62 78 50Z" fill="${h}"/>`;
      case 6: return `<path d="M32 52 C29 74 33 92 40 95 L80 95 C87 92 91 74 88 52Z" fill="${h}"/>`;
      default: return '';
    }
  }

  function hairFront(style, h) {
    const hl = light(h, 0.28);
    const shine = `<path d="M44 31 Q56 24 70 27" stroke="${hl}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`;
    switch (style) {
      case 0: return `<path d="M34 54 C32 30 46 20 60 20 C76 20 89 30 86 54 C83 42 77 35 67 34 C58 40 46 41 36 47Z" fill="${h}"/>
        <path d="M46 26 l3 7 M54 23 l2 8 M63 22 l0 8 M72 25 l-2 8" stroke="${dark(h, 0.25)}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>${shine}`;
      case 1: return `<path d="M34 58 C31 30 46 20 60 20 C77 20 89 32 86 60 C84 46 80 38 73 33 C64 42 50 47 36 58Z" fill="${h}"/>${shine}`;
      case 2: return `<circle cx="60" cy="17" r="10" fill="${h}"/><circle cx="57" cy="14" r="3" fill="${hl}" opacity=".5"/>
        <path d="M35 50 C34 30 46 23 60 23 C74 23 86 30 85 50 C78 38 70 33 60 33 C50 33 42 38 35 50Z" fill="${h}"/>${shine}`;
      case 3: {
        let s = '';
        for (let i = 0; i < 9; i++) s += `<circle cx="${f1(37 + i * 5.8)}" cy="${f1(36 - Math.sin((i / 8) * Math.PI) * 12 + rand(i, 9) * 3)}" r="${f1(7 + rand(i, 8) * 2)}" fill="${h}"/>`;
        return s + `<circle cx="50" cy="24" r="3" fill="${hl}" opacity=".45"/>`;
      }
      case 4: return `<path d="M35 52 C33 30 46 22 60 22 C75 22 87 30 85 52 C80 40 72 33 56 33 C48 36 40 42 35 52Z" fill="${h}"/>
        <circle cx="82" cy="40" r="4.5" fill="${INK}" opacity=".7"/>${shine}`;
      case 5: return `<path d="M35 50 C35 30 46 24 60 24 C74 24 85 30 85 50 C80 40 70 36 60 36 C50 36 40 40 35 50Z" fill="${h}" opacity=".88"/>`;
      case 6: return `<path d="M33 58 C31 30 46 20 60 20 C76 20 89 30 87 58 L84 58 C83 47 81 43 79 42 L41 42 C39 43 37 47 36 58Z" fill="${h}"/>${shine}`;
      case 7: return `<path d="M35 52 C33 32 44 21 54 16 C67 9 86 15 85 31 C86 37 86 45 85 52 C80 39 70 34 58 35 C48 36 40 42 35 52Z" fill="${h}"/>
        <path d="M52 20 Q66 12 80 20" stroke="${hl}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".55"/>`;
      default: return '';
    }
  }

  function outfitSvg(look, w, d) {
    const c = look.shirt;
    const dk = dark(c, 0.22);
    const lt = light(c, 0.35);
    switch (look.outfit) {
      case 1: // hoodie
        return `<path d="M42 101 Q60 94 78 101 Q74 114 60 116 Q46 114 42 101Z" fill="${dk}"/>
          <path d="M55 114 v18 M65 114 v18" stroke="${light(c, 0.6)}" stroke-width="2" stroke-linecap="round"/>
          <circle cx="55" cy="133" r="1.8" fill="${light(c, 0.6)}"/><circle cx="65" cy="133" r="1.8" fill="${light(c, 0.6)}"/>
          <path d="M40 146 Q60 140 80 146" stroke="${dk}" stroke-width="2" fill="none"/>`;
      case 2: // collared shirt
        return `<path d="M49 99 L60 113 L53 119 L44 104Z" fill="${lt}" stroke="${dk}" stroke-width="1.2"/><path d="M71 99 L60 113 L67 119 L76 104Z" fill="${lt}" stroke="${dk}" stroke-width="1.2"/>
          <path d="M60 113 V150" stroke="${dk}" stroke-width="1.4"/><circle cx="62.5" cy="124" r="1.3" fill="${dk}"/><circle cx="62.5" cy="136" r="1.3" fill="${dk}"/>`;
      case 3: // open jacket over a tee
        return `<path d="M50 101 L60 150 L70 101 Q60 108 50 101Z" fill="#f2f2f0"/><path d="M50 101 Q60 108 70 101" stroke="#d6d6d2" stroke-width="2" fill="none"/>
          <path d="M50 101 L57 150 M70 101 L63 150" stroke="${dk}" stroke-width="2.4"/>
          <path d="M${60 - w + 8} 112 L50 118 M${60 + w - 8} 112 L70 118" stroke="${dk}" stroke-width="1.4" opacity=".6"/>`;
      case 4: { // striped sweater
        let s = `<g clip-path="url(#${d}t)">`;
        for (let y = 112; y < 150; y += 10) s += `<rect x="0" y="${y}" width="120" height="4" fill="${lt}" opacity=".85"/>`;
        return s + `</g><path d="M49 101 Q60 111 71 101" stroke="${dk}" stroke-width="4" fill="none"/>`;
      }
      default: // tee
        return `<path d="M49 101 Q60 112 71 101" stroke="${dk}" stroke-width="2.4" fill="none"/>
          <path d="M${60 - w + 9} 113 Q${60 - w + 12} 128 ${60 - w + 10} 150 M${60 + w - 9} 113 Q${60 + w - 12} 128 ${60 + w - 10} 150" stroke="${dk}" stroke-width="1.3" fill="none" opacity=".5"/>`;
    }
  }

  const BROWS = {
    happy: (x, s) => `M${x - 7} 50 Q${x} 45.5 ${x + 7} 50`,
    ok: (x, s) => `M${x - 7} 51 Q${x} 48 ${x + 7} 51`,
    upset: (x, s) => (s < 0 ? `M${x - 7} 52 Q${x - 1} 50.5 ${x + 6} 47.5` : `M${x + 7} 52 Q${x + 1} 50.5 ${x - 6} 47.5`),
    angry: (x, s) => (s < 0 ? `M${x - 7} 47.5 Q${x} 49 ${x + 6} 53.5` : `M${x + 7} 47.5 Q${x} 49 ${x - 6} 53.5`),
  };

  function mouthSvg(m) {
    switch (m) {
      case 'happy': return `<path d="M51 79 Q60 89 69 79 Q60 82.5 51 79Z" fill="#6e2424" stroke="#5a1c1c" stroke-width="1.2" stroke-linejoin="round"/><path d="M53.5 79.8 Q60 82.6 66.5 79.8 L65.6 81.4 Q60 83.4 54.4 81.4Z" fill="#fff"/>`;
      case 'ok': return `<path d="M53 80.5 Q60 84 67 80.5" stroke="#8a3b3b" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 'upset': return `<path d="M53.5 83 Q60 79.5 66.5 83" stroke="#8a3b3b" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      default: return `<path d="M52 84 Q60 76 68 84 Q60 81.5 52 84Z" fill="#5a1c1c" stroke="#4a1414" stroke-width="1.2"/><path d="M54.5 82 h11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }

  /** A customer, head and shoulders, as they stand at the counter. */
  function customerSvg(look, m, opts) {
    opts = opts || {};
    const d = uid('p');
    const s = look.skin;
    const h = look.hair;
    const sd = dark(s, 0.16);
    const w = [40, 45, 50][look.build || 0];
    const style = look.style || 0;
    const hijab = style === 8;
    const scarf = mix(look.shirt, '#5b3a6e', 0.35);
    const p = [];
    p.push(`<defs>
      <radialGradient id="${d}s" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${light(s, 0.14)}"/><stop offset=".7" stop-color="${s}"/><stop offset="1" stop-color="${sd}"/></radialGradient>
      <linearGradient id="${d}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light(look.shirt, 0.18)}"/><stop offset="1" stop-color="${dark(look.shirt, 0.18)}"/></linearGradient>
      <clipPath id="${d}t"><path d="M${60 - w} 150 L${60 - w} 128 C${60 - w} 112 ${60 - w + 10} 104 48 101 Q60 106 72 101 C${60 + w - 10} 104 ${60 + w} 112 ${60 + w} 128 L${60 + w} 150 Z"/></clipPath>
    </defs>`);
    // body
    p.push(`<g class="c-body">`);
    p.push(`<path d="M${60 - w} 152 L${60 - w} 128 C${60 - w} 112 ${60 - w + 10} 104 48 101 Q60 106 72 101 C${60 + w - 10} 104 ${60 + w} 112 ${60 + w} 128 L${60 + w} 152 Z" fill="url(#${d}c)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`);
    p.push(`<path d="M51 84 L51 102 Q60 109 69 102 L69 84 Z" fill="${sd}"/>`);
    p.push(`<path d="M51 92 Q60 99 69 92 L69 86 L51 86Z" fill="${dark(s, 0.3)}" opacity=".35"/>`);
    p.push(outfitSvg(look, w, d));
    if (look.acc === 2) p.push(`<path d="M41 100 Q60 118 79 100" stroke="#2b2b33" stroke-width="4" fill="none"/><ellipse cx="41" cy="101" rx="6" ry="7.5" fill="#3a3a46" stroke="${INK}" stroke-width="1.5"/><ellipse cx="79" cy="101" rx="6" ry="7.5" fill="#3a3a46" stroke="${INK}" stroke-width="1.5"/>`);
    if (hijab) p.push(`<path d="M38 82 C44 98 52 104 60 104 C68 104 76 98 82 82 C88 94 94 106 98 116 L22 116 C26 106 32 94 38 82Z" fill="${scarf}" stroke="${INK}" stroke-width="2"/>`);
    p.push(`</g>`);
    // head
    p.push(`<g class="c-head">`);
    p.push(hijab ? `<path d="M30 56 C29 26 45 16 60 16 C75 16 91 26 90 56 C90 74 86 88 80 96 L40 96 C34 88 30 74 30 56Z" fill="${scarf}" stroke="${INK}" stroke-width="2.4"/>` : hairBack(style, h));
    if (!hijab) {
      p.push(`<ellipse cx="34.5" cy="61" rx="4.6" ry="7" fill="${s}" stroke="${INK}" stroke-width="2"/><ellipse cx="85.5" cy="61" rx="4.6" ry="7" fill="${s}" stroke="${INK}" stroke-width="2"/>`);
      p.push(`<path d="M34 59 q2 3 0 5 M86 59 q-2 3 0 5" stroke="${sd}" stroke-width="1.2" fill="none"/>`);
    }
    p.push(`<path d="M60 24 C79 24 86 39 86 56 C86 74 78 90 60 93 C42 90 34 74 34 56 C34 39 41 24 60 24Z" fill="url(#${d}s)" stroke="${INK}" stroke-width="2.6"/>`);
    if (m === 'angry') p.push(`<path d="M60 24 C79 24 86 39 86 56 C86 74 78 90 60 93 C42 90 34 74 34 56 C34 39 41 24 60 24Z" fill="#ff2d2d" opacity=".16"/>`);
    // beard sits under the mouth
    if (look.beard === 1) p.push(`<path d="M40 70 C42 84 50 92 60 92 C70 92 78 84 80 70 C74 80 68 84 60 84 C52 84 46 80 40 70Z" fill="${h}" opacity=".28"/>`);
    if (look.beard === 2) p.push(`<path d="M37 64 C38 84 48 96 60 96 C72 96 82 84 83 64 C80 74 74 78 68 76 Q60 72 52 76 C46 78 40 74 37 64Z" fill="${h}"/>`);
    // eyes
    for (const [x, side] of [[48, -1], [72, 1]]) {
      p.push(`<path d="M${x - 6.5} 60 Q${x} 53.5 ${x + 6.5} 60 Q${x} 65.5 ${x - 6.5} 60Z" fill="#fff"/>`);
      p.push(`<circle cx="${x + (m === 'upset' ? -1 : 0)}" cy="60" r="3.4" fill="${look.eyes || '#3b2414'}"/><circle cx="${x + (m === 'upset' ? -1 : 0)}" cy="60" r="1.7" fill="#111"/><circle cx="${x + 1.2}" cy="58.6" r="1" fill="#fff"/>`);
      p.push(`<path d="M${x - 7} 60 Q${x} 53 ${x + 7} 60" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`);
      p.push(`<path d="${BROWS[m] ? BROWS[m](x, side) : BROWS.ok(x, side)}" stroke="${dark(h, 0.2)}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    }
    // blinking lids
    p.push(`<g class="c-lids" opacity="0" style="--bd:${(rand(look.skin.length + (look.style || 0), look.build || 1) * -5).toFixed(2)}s"><ellipse cx="48" cy="59.5" rx="7" ry="5" fill="${s}"/><ellipse cx="72" cy="59.5" rx="7" ry="5" fill="${s}"/></g>`);
    // nose
    p.push(`<path d="M60.5 62 Q57.2 70.5 59.5 72.6 Q61.6 73.6 63.6 72.2" stroke="${dark(s, 0.32)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
    p.push(`<ellipse cx="45" cy="71" rx="5" ry="3" fill="#ff6b6b" opacity="${m === 'happy' ? 0.26 : 0.12}"/><ellipse cx="75" cy="71" rx="5" ry="3" fill="#ff6b6b" opacity="${m === 'happy' ? 0.26 : 0.12}"/>`);
    if (look.acc === 5) for (let i = 0; i < 9; i++) p.push(`<circle cx="${f1((i % 2 ? 66 : 47) + rand(i, 2) * 8)}" cy="${f1(66 + rand(i, 3) * 6)}" r=".9" fill="${dark(s, 0.35)}"/>`);
    p.push(mouthSvg(m));
    if (look.beard === 3) p.push(`<path d="M50 78 Q55 73 60 76 Q65 73 70 78 Q65 76.5 60 78 Q55 76.5 50 78Z" fill="${h}"/>`);
    if (look.glasses === 1) p.push(`<g fill="#fff" fill-opacity=".14" stroke="#2b2b2b" stroke-width="2"><circle cx="48" cy="60" r="8.2"/><circle cx="72" cy="60" r="8.2"/></g><path d="M56.2 59 Q60 56.5 63.8 59 M39.8 59 L35 57 M80.2 59 L85 57" stroke="#2b2b2b" stroke-width="2" fill="none"/>`);
    if (look.glasses === 2) p.push(`<g fill="#fff" fill-opacity=".14" stroke="#1f1f1f" stroke-width="2.4"><rect x="38.5" y="54" width="18" height="12" rx="3.5"/><rect x="63.5" y="54" width="18" height="12" rx="3.5"/></g><path d="M56.5 58.5 h7 M38.5 58 L35 56.5 M81.5 58 L85 56.5" stroke="#1f1f1f" stroke-width="2.2"/>`);
    // hair and headwear on top
    if (hijab) {
      p.push(`<path d="M34 54 C34 32 46 24 60 24 C74 24 86 32 86 54 C82 38 72 31 60 31 C48 31 38 38 34 54Z" fill="${scarf}" stroke="${INK}" stroke-width="2"/>`);
    } else if (look.acc === 3) {
      const b = mix(look.shirt, '#2d1b33', 0.25);
      if (style === 1 || style === 6) p.push(`<path d="M34 56 C33 46 36 44 40 44 L40 60Z M86 56 C87 46 84 44 80 44 L80 60Z" fill="${h}"/>`);
      p.push(`<path d="M32 50 C31 24 46 14 60 14 C74 14 89 24 88 50 Z" fill="${b}" stroke="${INK}" stroke-width="2.4"/>`);
      p.push(`<rect x="31" y="42" width="58" height="11" rx="5" fill="${dark(b, 0.15)}" stroke="${INK}" stroke-width="2.2"/>`);
      for (let x = 37; x < 86; x += 6) p.push(`<path d="M${x} 44 v7" stroke="${light(b, 0.25)}" stroke-width="1.4"/>`);
      p.push(`<circle cx="60" cy="13" r="6.5" fill="${light(b, 0.35)}" stroke="${INK}" stroke-width="2"/>`);
    } else if (look.acc === 4) {
      p.push(hairFront(style === 7 || style === 3 ? 0 : style, h).replace(/<circle cx="60" cy="17" r="10"[^>]*\/>/, ''));
      p.push(`<path d="M34 47 C33 27 46 19 60 19 C74 19 87 27 86 47 Z" fill="${look.shirt}" stroke="${INK}" stroke-width="2.4"/>`);
      p.push(`<path d="M50 46 C64 42 92 42 100 48 C92 52 70 52 50 49Z" fill="${dark(look.shirt, 0.2)}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`);
      p.push(`<circle cx="60" cy="20" r="2.4" fill="${dark(look.shirt, 0.25)}"/>`);
    } else {
      p.push(hairFront(style, h));
    }
    if (look.acc === 1 && !hijab) p.push(`<circle cx="34" cy="70" r="2.2" fill="#ffd34d" stroke="${INK}" stroke-width="1"/><circle cx="86" cy="70" r="2.2" fill="#ffd34d" stroke="${INK}" stroke-width="1"/>`);
    if (m === 'upset') p.push(`<path class="c-sweat" d="M84 40 q4 7 0 10 q-4 -3 0 -10z" fill="#7fd3ff" stroke="${INK}" stroke-width="1"/>`);
    p.push(`</g>`);
    if (m === 'angry') {
      p.push(`<g class="c-steam"><path d="M28 30 q-6 -6 0 -12 q6 -6 0 -12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M92 30 q6 -6 0 -12 q-6 -6 0 -12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>`);
    }
    if (opts.hearts) p.push(`<g class="c-hearts"><path d="M20 30 c-4 -6 -12 -1 -6 5 l6 5 l6 -5 c6 -6 -2 -11 -6 -5z" fill="#ff5c8a" stroke="${INK}" stroke-width="1.5"/><path d="M96 20 c-3 -5 -10 -1 -5 4 l5 4 l5 -4 c5 -5 -2 -9 -5 -4z" fill="#ff5c8a" stroke="${INK}" stroke-width="1.5"/></g>`);
    return `<svg class="customer-svg mood-${m}" viewBox="0 4 120 148" aria-hidden="true">${p.join('')}</svg>`;
  }

  function hash(str) {
    let x = 2166136261;
    for (const ch of String(str)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
    return x >>> 0;
  }

  /** A player's barista: a face under a cap in their team color. The face is stable per player id. */
  function baristaSvg(color, seed) {
    const d = uid('b');
    const n = hash(seed || color);
    const skins = ['#f8dcc4', '#f1c7a5', '#e3ad86', '#c98d63', '#a5683f', '#7d4a2b'];
    const hairs = ['#1f1612', '#4a2f1d', '#a8743e', '#d9b46a', '#8c2f1e', '#2e1d14'];
    const s = skins[n % skins.length];
    const h = hairs[(n >> 4) % hairs.length];
    const long = (n >> 8) % 3 === 0;
    return `<svg class="barista-svg" viewBox="0 0 64 64" aria-hidden="true">
      <defs><radialGradient id="${d}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${light(s, 0.14)}"/><stop offset=".75" stop-color="${s}"/><stop offset="1" stop-color="${dark(s, 0.15)}"/></radialGradient></defs>
      ${long ? `<path d="M13 32 C11 50 14 58 20 60 L44 60 C50 58 53 50 51 32Z" fill="${h}"/>` : ''}
      <path d="M8 66 C8 54 16 50 32 50 C48 50 56 54 56 66Z" fill="${color}" stroke="${INK}" stroke-width="3"/>
      <path d="M24 51 L32 60 L40 51" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="32" cy="36" rx="18" ry="19" fill="url(#${d})" stroke="${INK}" stroke-width="3"/>
      <path d="M14 30 C14 22 18 18 22 18 L42 18 C46 18 50 22 50 30 C44 26 38 25 32 25 C26 25 20 26 14 30Z" fill="${h}"/>
      <path d="M13 27 C12 12 22 7 32 7 C42 7 52 12 51 27 Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M36 25 C46 22 58 23 61 28 C54 30 44 30 36 28Z" fill="${dark(color, 0.18)}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="27" cy="14" r="3" fill="#fff" opacity=".45"/>
      <ellipse cx="25.5" cy="38" rx="2.4" ry="3" fill="${INK}"/><ellipse cx="38.5" cy="38" rx="2.4" ry="3" fill="${INK}"/>
      <circle cx="26.3" cy="37" r=".9" fill="#fff"/><circle cx="39.3" cy="37" r=".9" fill="#fff"/>
      <path d="M27 46 q5 4.5 10 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="21" cy="44" rx="3.2" ry="2" fill="#ff6b6b" opacity=".3"/><ellipse cx="43" cy="44" rx="3.2" ry="2" fill="#ff6b6b" opacity=".3"/>
    </svg>`;
  }

  window.BobaArt = { cupSvg, jarSvg, customerSvg, baristaSvg, mood, teaColor, topColor, drizzleColor, mix, light, dark };
})();
