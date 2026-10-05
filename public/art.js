/* Boba Rush art: SVG drawings for cups and customers. */
(function () {
  'use strict';
  const G = window.BobaGame;
  const teaColor = (id) => (G.TEAS.find((t) => t.id === id) || {}).color;
  const topColor = (id) => (G.TOPPINGS.find((t) => t.id === id) || {}).color;

  function rand(i, salt) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // cup interior spans y=24 (rim) to y=160 (bottom)
  const RIM = 24;
  const BOTTOM = 160;
  const DEPTH = BOTTOM - RIM;
  const halfWidthAt = (y) => 42 - ((y - RIM) / DEPTH) * 14;

  function cupSvg(cup, opts) {
    opts = opts || {};
    const uid = 'c' + Math.random().toString(36).slice(2, 8);
    const fill = Math.min(1, cup.fill || 0);
    const liquidTop = BOTTOM - fill * DEPTH;
    const color = teaColor(cup.tea) || '#d9eef7';
    const parts = [];
    parts.push(`<defs><clipPath id="${uid}"><polygon points="18,24 102,24 88,160 32,160"/></clipPath>
      <linearGradient id="${uid}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>`);
    parts.push(`<polygon points="18,24 102,24 88,160 32,160" fill="#f4fbff" opacity=".9"/>`);
    parts.push(`<g clip-path="url(#${uid})">`);
    if (fill > 0) {
      parts.push(`<rect x="0" y="${liquidTop}" width="120" height="${BOTTOM - liquidTop + 2}" fill="${color}"/>`);
      parts.push(`<rect x="0" y="${liquidTop}" width="120" height="4" fill="#fff" opacity=".25"/>`);
      if (cup.sweet > 0) {
        parts.push(`<rect x="0" y="${BOTTOM - 10 - cup.sweet * 2}" width="120" height="${12 + cup.sweet * 2}" fill="#7a4a1a" opacity="${0.08 + cup.sweet * 0.04}"/>`);
      }
    }
    // toppings settle at the bottom
    (cup.toppings || []).forEach((t, k) => {
      if (t === 'foam') return;
      const c = topColor(t);
      for (let i = 0; i < 14; i++) {
        const y = BOTTOM - 6 - rand(i, k + 3) * 22 - k * 4;
        const hw = halfWidthAt(y) - 8;
        const x = 60 + (rand(i, k + 9) * 2 - 1) * hw;
        if (t === 'pearls' || t === 'redbean') {
          parts.push(`<circle cx="${x}" cy="${y}" r="${t === 'pearls' ? 5 : 3}" fill="${c}"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="1.2" fill="#fff" opacity=".35"/>`);
        } else if (t === 'popping') {
          parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" opacity=".9"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="1.5" fill="#fff" opacity=".7"/>`);
        } else if (t === 'jelly') {
          parts.push(`<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2" fill="${c}" opacity=".85" stroke="#cfd8a8" stroke-width="1"/>`);
        } else if (t === 'pudding' && i < 5) {
          parts.push(`<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="${c}" opacity=".9"/>`);
        }
      }
    });
    // ice floats near the surface
    if (fill > 0.1) {
      const cubes = [0, 3, 6][cup.ice || 0];
      for (let i = 0; i < cubes; i++) {
        const y = liquidTop + 6 + rand(i, 21) * Math.min(40, (BOTTOM - liquidTop) * 0.5);
        const hw = halfWidthAt(y) - 10;
        const x = 60 + (rand(i, 33) * 2 - 1) * hw;
        parts.push(`<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" fill="#fff" opacity=".55" transform="rotate(${rand(i, 5) * 40 - 20} ${x} ${y})"/>`);
      }
    }
    if ((cup.toppings || []).includes('foam') && fill > 0) {
      parts.push(`<rect x="0" y="${liquidTop - 2}" width="120" height="16" fill="${topColor('foam')}"/>`);
      parts.push(`<path d="M0 ${liquidTop + 14} q10 6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="${topColor('foam')}"/>`);
    }
    parts.push(`</g>`);
    parts.push(`<polygon points="18,24 102,24 88,160 32,160" fill="url(#${uid}g)" stroke="#9fb8c8" stroke-width="2.5" stroke-linejoin="round"/>`);
    if (opts.target) {
      const ty = BOTTOM - G.FILL_TARGET * DEPTH;
      parts.push(`<line x1="8" x2="112" y1="${ty}" y2="${ty}" stroke="#ff4d6d" stroke-width="2" stroke-dasharray="5 4"/>`);
      parts.push(`<text x="112" y="${ty - 4}" font-size="9" text-anchor="end" fill="#ff4d6d" font-weight="700">FILL LINE</text>`);
    }
    if (cup.sealed) {
      parts.push(`<rect x="14" y="18" width="92" height="8" rx="3" fill="#ffffff" stroke="#9fb8c8" stroke-width="2"/>`);
      parts.push(`<rect x="22" y="20" width="76" height="2" fill="#ffd6e0"/>`);
      parts.push(`<rect x="62" y="-22" width="11" height="150" rx="5" fill="${opts.straw || '#ff8fab'}" transform="rotate(10 67 60)" opacity=".95"/>`);
    }
    if (cup.spilled) {
      parts.push(`<path d="M18 24 q-6 14 -2 26 q4 -8 6 -20z M102 24 q6 16 2 30 q-4 -10 -6 -24z" fill="${color}" opacity=".9"/>`);
    }
    return `<svg class="cup-svg" viewBox="0 -24 120 194" aria-hidden="true">${parts.join('')}</svg>`;
  }

  function mood(patience) {
    if (patience > 0.6) return 'happy';
    if (patience > 0.35) return 'ok';
    if (patience > 0.15) return 'upset';
    return 'angry';
  }

  function customerSvg(look, m) {
    const s = look.skin, h = look.hair;
    const p = [];
    // body
    p.push(`<path d="M14 130 q0 -34 36 -36 q36 2 36 36z" fill="${look.shirt}"/>`);
    p.push(`<rect x="44" y="78" width="12" height="16" fill="${s}"/>`);
    // hair behind head
    if (look.style === 1) p.push(`<path d="M20 56 q0 -34 30 -34 q30 0 30 34 v38 h-60z" fill="${h}"/>`);
    if (look.style === 2) p.push(`<circle cx="50" cy="20" r="11" fill="${h}"/>`);
    // head
    p.push(`<circle cx="50" cy="56" r="27" fill="${s}"/>`);
    p.push(`<circle cx="23" cy="58" r="5" fill="${s}"/><circle cx="77" cy="58" r="5" fill="${s}"/>`);
    // hair on top
    if (look.style === 0) p.push(`<path d="M23 52 q2 -26 27 -26 q25 0 27 26 q-10 -12 -27 -12 q-17 0 -27 12z" fill="${h}"/>`);
    if (look.style === 1) p.push(`<path d="M23 54 q4 -28 27 -28 q23 0 27 28 q-16 -6 -22 -18 q-10 14 -32 18z" fill="${h}"/>`);
    if (look.style === 2) p.push(`<path d="M24 50 q4 -22 26 -22 q22 0 26 22 q-26 -10 -52 0z" fill="${h}"/>`);
    if (look.style === 3) {
      for (let i = 0; i < 7; i++) p.push(`<circle cx="${26 + i * 8}" cy="${34 - Math.sin((i / 6) * Math.PI) * 6}" r="8" fill="${h}"/>`);
    }
    // face
    const eyeY = 58;
    if (m === 'angry') {
      p.push(`<path d="M34 49 l10 4 M66 49 l-10 4" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>`);
    } else if (m === 'upset') {
      p.push(`<path d="M35 51 l9 -2 M65 51 l-9 -2" stroke="#2b2b2b" stroke-width="2.5" stroke-linecap="round"/>`);
    }
    p.push(`<ellipse cx="40" cy="${eyeY}" rx="3.5" ry="4.5" fill="#2b2b2b"/><ellipse cx="60" cy="${eyeY}" rx="3.5" ry="4.5" fill="#2b2b2b"/>`);
    p.push(`<circle cx="41.2" cy="${eyeY - 1.6}" r="1.2" fill="#fff"/><circle cx="61.2" cy="${eyeY - 1.6}" r="1.2" fill="#fff"/>`);
    if (look.glasses) {
      p.push(`<circle cx="40" cy="${eyeY}" r="8" fill="none" stroke="#333" stroke-width="2"/><circle cx="60" cy="${eyeY}" r="8" fill="none" stroke="#333" stroke-width="2"/><path d="M48 ${eyeY} h4" stroke="#333" stroke-width="2"/>`);
    }
    if (m === 'happy' || m === 'ok') p.push(`<circle cx="33" cy="68" r="4" fill="#ff8fa3" opacity=".45"/><circle cx="67" cy="68" r="4" fill="#ff8fa3" opacity=".45"/>`);
    const mouths = {
      happy: 'M42 69 q8 8 16 0',
      ok: 'M43 71 h14',
      upset: 'M42 73 q8 -5 16 0',
      angry: 'M41 74 q9 -8 18 0',
    };
    p.push(`<path d="${mouths[m] || mouths.ok}" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
    if (m === 'angry') p.push(`<path d="M74 34 q4 6 0 10 q-4 -4 0 -10z" fill="#74c0fc"/>`);
    return `<svg class="customer-svg" viewBox="0 0 100 130" aria-hidden="true">${p.join('')}</svg>`;
  }

  window.BobaArt = { cupSvg, customerSvg, mood, teaColor, topColor };
})();
