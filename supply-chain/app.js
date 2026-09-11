/* Supply-chain operations exhibit — vanilla JS, SVG drawn by hand.
   Every chart has a table twin; every value is reachable without hovering. */
(function () {
  'use strict';
  const D = window.SCX;
  if (!D) return;
  const M = D.months, R = D.regions, V = D.vendors, T = D.meta.targets, INT = D.meta.intervention;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const vById = Object.fromEntries(V.map(v => [v.id, v]));
  const rById = Object.fromEntries(R.map(r => [r.id, r]));
  const BUCKETS = [['b0', '0–7 days', 'var(--steel-100)'], ['b8', '8–14 days', 'var(--steel-200)'],
                   ['b15', '15–30 days', 'var(--steel-300)'], ['b30', 'Over 30 days', 'var(--steel-400)']];

  const state = { period: 'all', region: 'ALL', vendor: 'ALL', sortKey: 'n', sortDir: -1, hover: null, painted: false };

  /* ── helpers ─────────────────────────────────────────────────────── */
  const fmt = {
    pct: (v, d = 1) => v == null ? '—' : v.toFixed(d) + '%',
    int: v => v == null ? '—' : Math.round(v).toLocaleString('en-US'),
    d1: v => v == null ? '—' : v.toFixed(1),
    signed: (v, d = 1, unit = '') => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + unit,
    usdk: v => '$' + Math.round(v).toLocaleString('en-US') + 'K',
  };
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }
  function svg(tag, attrs, kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(c => e.appendChild(c));
    return e;
  }
  function txt(x, y, s, cls, attrs) { const t = svg('text', Object.assign({ x, y, class: cls }, attrs || {})); t.textContent = s; return t; }
  const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  function ticks(lo, hi, n) {
    const span = hi - lo, raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => span / s <= n) || p * 10;
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
  }
  function topRounded(x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    return `M${x} ${y + h}V${y + r}a${r} ${r} 0 0 1 ${r} -${r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h}Z`;
  }
  function rightRounded(x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}H${x}Z`;
  }
  const STATUS = v => { if (v == null) return ['', 'No data']; const r = Math.round(v * 10) / 10; return r >= T.otd ? ['good', 'On target'] : r >= 90 ? ['', 'Watch'] : ['bad', 'Breached']; };
  function statusEl(v) { const [c, w] = STATUS(v); return el('span', { class: 'st ' + c }, [el('i'), w]); }

  /* ── data slicing ────────────────────────────────────────────────── */
  function months() {
    if (state.period === 'post') return M.filter(m => m.i >= INT);
    if (state.period === 'last6') return M.slice(-6);
    return M;
  }
  const inR = r => state.region === 'ALL' || r === state.region;
  const inV = v => state.vendor === 'ALL' || v === state.vendor;
  function rows(opts) {
    const ms = new Set(months().map(m => m.i)); const o = opts || {};
    return D.rows.filter(x => ms.has(x.m) && (o.anyRegion || inR(x.r)) && (o.anyVendor || inV(x.v)));
  }
  function agg(xs) {
    let n = 0, ot = 0, acc = 0, tw = 0, esc = 0;
    for (const x of xs) { n += x.n; ot += x.ot; acc += x.acc; tw += x.tat * x.n; esc += x.esc; }
    return { n, ot, acc, esc, otd: n ? ot / n * 100 : null, accp: n ? acc / n * 100 : null, tat: n ? tw / n : null };
  }
  function byMonth(xs, ms) {
    const g = {}; for (const x of xs) (g[x.m] || (g[x.m] = [])).push(x);
    return (ms || months()).map(m => Object.assign({ m }, agg(g[m.i] || [])));
  }
  function backlogByMonth() {
    return months().map(m => {
      const b = { m, b0: 0, b8: 0, b15: 0, b30: 0 };
      D.backlog.filter(x => x.m === m.i && inR(x.r)).forEach(x => { b.b0 += x.b0; b.b8 += x.b8; b.b15 += x.b15; b.b30 += x.b30; });
      b.total = b.b0 + b.b8 + b.b15 + b.b30; return b;
    });
  }
  function continuityByMonth() {
    return months().map(m => {
      const xs = D.continuity.filter(x => x.m === m.i && inR(x.r));
      return { m, c: xs.length ? xs.reduce((a, x) => a + x.c, 0) / xs.length : null };
    });
  }

  /* ── tooltip ─────────────────────────────────────────────────────── */
  const tip = el('div', { id: 'tip', role: 'status' });
  document.body.appendChild(tip);
  let tipTimer;
  function showTip(title, lines, x, y) {
    tip.replaceChildren(el('div', { class: 'th', text: title }), ...lines.map(l => {
      const row = el('div', { class: 'tr' + (l.hi ? ' hi' : '') });
      const key = el('span'); if (l.swatch !== undefined) { const i = el('i'); if (l.sq) i.className = 'sq'; if (l.swatch) i.style.background = l.swatch; key.appendChild(i); }
      key.appendChild(document.createTextNode(l.k)); row.appendChild(key); row.appendChild(el('b', { text: l.v })); return row;
    }));
    tip.classList.add('on'); clearTimeout(tipTimer);
    if (x != null) placeTip(x, y);
  }
  function placeTip(x, y) {
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth, vh = innerHeight;
    let left = x + 16, top = y - h / 2;
    if (left + w > vw - 12) left = x - w - 16;
    if (top < 76) top = 76; if (top + h > vh - 12) top = vh - h - 12;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  /* ── chart frame ─────────────────────────────────────────────────── */
  function frame(host, h, pad) {
    const w = Math.max(280, host.clientWidth);
    const p = Object.assign({ l: 38, r: 46, t: 18, b: 28 }, pad || {});
    const s = svg('svg', { class: 'viz', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true', focusable: 'false' });
    return { s, w, h, p, iw: w - p.l - p.r, ih: h - p.t - p.b };
  }
  function xAxis(f, ms, x) {
    const g = svg('g'); const n = ms.length; const every = n > 12 ? (f.iw < 300 ? 6 : f.iw < 480 ? 4 : 3) : (f.iw < 300 ? 3 : f.iw < 360 ? 2 : 1);
    const idx = []; for (let i = 0; i < n; i += every) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) { if (n - 1 - idx[idx.length - 1] < every) idx[idx.length - 1] = n - 1; else idx.push(n - 1); }
    idx.forEach(i => g.appendChild(txt(x(i), f.h - f.p.b + 18, ms[i].short, 'ax', { 'text-anchor': i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle' })));
    return g;
  }
  function yGrid(f, y, tk, fmtF) {
    const g = svg('g');
    tk.forEach(v => { g.appendChild(svg('line', { x1: f.p.l, x2: f.w - f.p.r, y1: y(v), y2: y(v), class: 'grid' })); g.appendChild(txt(f.p.l - 8, y(v) + 4, fmtF(v), 'ax', { 'text-anchor': 'end' })); });
    return g;
  }
  function linePath(pts) { let d = '', pen = false; pts.forEach(([x, y]) => { if (y == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x + ' ' + y; pen = true; }); return d; }
  function tableTwin(card, head, body) {
    const wrap = $('.ctable', card); wrap.replaceChildren();
    const t = el('table', { class: 'dt compact' });
    t.appendChild(el('thead', null, [el('tr', null, head.map((h, i) => el('th', { class: i ? 'r' : '', scope: 'col', text: h })))]));
    t.appendChild(el('tbody', null, body.map(r => el('tr', null, r.map((c, i) => el('td', { class: i ? 'r' : '', text: c }))))));
    wrap.appendChild(t);
  }
  function crosshairLayer(f, ms, x, onMove) {
    const cross = svg('line', { class: 'cross', y1: f.p.t, y2: f.h - f.p.b, x1: 0, x2: 0 });
    const hit = svg('rect', { class: 'hit', x: f.p.l, y: f.p.t, width: f.iw, height: f.ih });
    hit.addEventListener('pointermove', e => {
      const rect = f.s.getBoundingClientRect(); const px = (e.clientX - rect.left) * (f.w / rect.width);
      const i = Math.max(0, Math.min(ms.length - 1, Math.round((px - f.p.l) / (f.iw / Math.max(1, ms.length - 1)))));
      onMove(i, e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', () => onMove(null));
    return { cross, hit };
  }
  function keyNav(card, items, onIdx, opts) {
    const body = $('.cbody', card);
    card._nav = { items, onIdx, vertical: !!(opts && opts.vertical) };
    if (body.dataset.nav) return;
    body.dataset.nav = '1'; body.tabIndex = 0; body.setAttribute('role', 'group');
    body.addEventListener('focus', () => tip.setAttribute('aria-live', 'polite'));
    body.addEventListener('keydown', e => {
      const nav = card._nav; const n = nav.items.length; if (!n) return;
      const next = nav.vertical ? (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0) : (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
      if (next) {
        e.preventDefault(); const cur = card._navIdx == null ? (nav.vertical ? -1 : n - 1) : card._navIdx;
        const i = Math.max(0, Math.min(n - 1, cur + next)); card._navIdx = i;
        const rect = body.getBoundingClientRect();
        const cx = nav.vertical ? rect.left + rect.width * 0.55 : rect.left + rect.width * (0.15 + 0.7 * i / Math.max(1, n - 1));
        const cy = nav.vertical ? rect.top + rect.height * (0.1 + 0.8 * i / Math.max(1, n - 1)) : rect.top + rect.height / 2;
        nav.onIdx(i, cx, cy);
      } else if (e.key === 'Escape') { card._navIdx = null; nav.onIdx(null); }
    });
    body.addEventListener('blur', () => { card._navIdx = null; card._nav.onIdx(null); tip.removeAttribute('aria-live'); });
  }

  /* ── KPI ledger ──────────────────────────────────────────────────── */
  function renderKPIs() {
    const ms = months(); const xs = rows(); const bm = byMonth(xs, ms); const bl = backlogByMonth(); const cm = continuityByMonth();
    const first = bm.find(x => x.n > 0), last = [...bm].reverse().find(x => x.n > 0);
    const contValid = cm.filter(x => x.c != null); const contAvg = contValid.length ? contValid.reduce((a, x) => a + x.c, 0) / contValid.length : null;
    const contHits = contValid.filter(x => x.c >= T.cont).length;
    const vendorNote = state.vendor !== 'ALL' ? 'Region-level · vendor filter not applied' : null;
    const tiles = [
      { id: 'otd', label: 'On-time delivery', val: last && last.otd, unit: '%', d: 1, spark: bm.map(x => x.otd),
        delta: last && first && first !== last ? { v: last.otd - first.otd, good: last.otd - first.otd >= 0, txt: fmt.signed(last.otd - first.otd, 1, ' pts') } : null,
        sub: last ? (first !== last ? `${last.m.short} vs ${first.m.short}` : last.m.label) + ` · target ${T.otd}%` : 'No orders in this slice' },
      { id: 'acc', label: 'Order accuracy', val: last && last.accp, unit: '%', d: 1, spark: bm.map(x => x.accp),
        delta: last && first && first !== last ? { v: last.accp - first.accp, good: last.accp - first.accp >= 0, txt: fmt.signed(last.accp - first.accp, 1, ' pts') } : null,
        sub: last ? (first !== last ? `${last.m.short} vs ${first.m.short}` : last.m.label) + ` · target ${T.acc}%` : 'No orders in this slice' },
      { id: 'tat', label: 'Turnaround', val: last && last.tat, unit: ' d', d: 1, spark: bm.map(x => x.tat),
        delta: last && first && first !== last ? { v: (last.tat - first.tat) / first.tat * 100, good: last.tat <= first.tat, txt: fmt.signed((last.tat - first.tat) / first.tat * 100, 1, '%') } : null,
        sub: last ? (first !== last ? `${last.m.short} vs ${first.m.short}` : last.m.label) + ` · target ${T.tat}\u00A0d` : 'No orders in this slice' },
      { id: 'bl', label: 'Open backlog', val: bl.length ? bl[bl.length - 1].total : null, unit: '', d: 0, spark: bl.map(x => x.total),
        delta: bl.length > 1 ? { v: bl[bl.length - 1].total - bl[0].total, good: bl[bl.length - 1].total <= bl[0].total, txt: fmt.signed(bl[bl.length - 1].total - bl[0].total, 0, ' orders') } : null,
        sub: vendorNote || (bl.length ? `${bl[bl.length - 1].m.short} · ${fmt.int(bl[bl.length - 1].b30)} over 30 days` : '') },
      { id: 'cont', label: 'Supply continuity', val: contAvg, unit: '%', d: 1, spark: cm.map(x => x.c),
        delta: contValid.length ? { v: contAvg - T.cont, good: contAvg >= T.cont, txt: `${contHits} of ${contValid.length} months on target` } : null,
        sub: vendorNote || `Period average · target ${T.cont}%` },
    ];
    const host = $('#kpis'); host.replaceChildren();
    tiles.forEach(t => {
      const tile = el('div', { class: 'kpi' });
      tile.appendChild(el('span', { class: 'label', text: t.label }));
      const fig = el('div', { class: 'fig num' });
      const num = el('span', { text: t.val == null ? '—' : t.val.toFixed(t.d) }); fig.appendChild(num);
      if (t.val != null && t.unit) fig.appendChild(el('small', { text: t.unit.trim() }));
      tile.appendChild(fig);
      const dl = el('div', { class: 'delta' + (t.delta ? (t.delta.good ? ' good' : ' bad') : '') });
      if (t.delta) {
        const up = t.delta.v >= 0; const tri = svg('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true' });
        tri.appendChild(svg('path', { d: up ? 'M5 1 9.5 9h-9z' : 'M5 9 .5 1h9z', fill: 'currentColor' }));
        if (t.id !== 'cont') dl.appendChild(tri);
        dl.appendChild(document.createTextNode(t.delta.txt));
      } else dl.appendChild(document.createTextNode('Single month'));
      tile.appendChild(dl);
      tile.appendChild(el('div', { class: 'sub', text: t.sub }));
      tile.appendChild(sparkline(t.spark, 30));
      host.appendChild(tile);
      if (!state.painted && !REDUCED && t.val != null) { if (host.classList.contains('in')) countUp(num, t.val, t.d); else pendingCounts.push([num, t.val, t.d]); }
    });
    state.painted = true;
  }
  const pendingCounts = [];
  function countUp(node, to, d) {
    const t0 = performance.now(), dur = 1400;
    (function step(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = (to * e).toFixed(d); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  function sparkline(vals, h) {
    const w = 200, s = svg('svg', { class: 'spark', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const v = vals.filter(x => x != null); if (v.length < 2) return s;
    const lo = Math.min(...v), hi = Math.max(...v), y = lin(lo, hi === lo ? lo + 1 : hi, h - 4, 4), x = lin(0, vals.length - 1, 2, w - 4);
    s.appendChild(svg('path', { d: linePath(vals.map((val, i) => [x(i), val == null ? null : y(val)])), fill: 'none', stroke: 'var(--on-surface-muted)', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
    const li = vals.length - 1;
    if (vals[li] != null) s.appendChild(svg('circle', { cx: x(li), cy: y(vals[li]), r: 3, fill: 'var(--on-surface)' }));
    return s;
  }

  /* ── small multiples: OTD by region ──────────────────────────────── */
  function renderSM() {
    const card = $('#sm-card'), host = $('#sm'); host.replaceChildren();
    const ms = months(); const all = byMonth(rows({ anyRegion: true }), ms);
    const regions = R.filter(r => inR(r.id));
    const series = regions.map(r => ({ r, pts: byMonth(rows({ anyRegion: true }).filter(x => x.r === r.id), ms) }));
    host.classList.toggle('single', regions.length === 1); const panels = []; const yLo = 74, yHi = 100;
    series.forEach((sr, idx) => {
      const panel = el('div', { class: 'panel' }); host.appendChild(panel);
      const f = frame(panel, regions.length === 1 ? 260 : 190, { l: 36, r: 48, t: 30, b: 26 });
      const x = lin(0, ms.length - 1, f.p.l, f.w - f.p.r), y = lin(yLo, yHi, f.h - f.p.b, f.p.t);
      f.s.appendChild(yGrid(f, y, [80, 90, 100], v => v + '%'));
      f.s.appendChild(svg('line', { x1: f.p.l, x2: f.w - f.p.r, y1: y(T.otd), y2: y(T.otd), class: 'target' }));
      f.s.appendChild(txt(f.w - f.p.r + 6, y(T.otd) + 4, 'target', 'ax'));
      const ii = ms.findIndex(m => m.i === INT);
      const has = sr.pts.some(p => p.n > 0);
      if (ii >= 0 && has) { f.s.appendChild(svg('line', { x1: x(ii), x2: x(ii), y1: f.p.t - 4, y2: f.h - f.p.b, class: 'int' })); if (idx === 0) f.s.appendChild(txt(x(ii) + 6, f.p.t + 2, 'SOPs LIVE', 'ann')); }
      f.s.appendChild(txt(f.p.l, 12, sr.r.name.toUpperCase(), 'ttl'));
      const lastPt = [...sr.pts].reverse().find(p => p.n > 0);
      if (lastPt) f.s.appendChild(txt(f.w - f.p.r, 14, fmt.pct(lastPt.otd), 'big', { 'text-anchor': 'end' }));
      if (has) f.s.appendChild(svg('path', { d: linePath(all.map((p, i) => [x(i), p.otd == null ? null : y(Math.max(yLo, p.otd))])), class: 'ghost' }));
      else f.s.appendChild(txt(f.p.l + f.iw / 2, f.p.t + f.ih / 2, 'No orders from this vendor in ' + sr.r.name, 'empty', { 'text-anchor': 'middle' }));
      f.s.appendChild(svg('path', { d: linePath(sr.pts.map((p, i) => [x(i), p.otd == null ? null : y(Math.max(yLo, p.otd))])), class: 'ink' }));
      const dots = svg('g');
      sr.pts.forEach((p, i) => { if (p.otd != null) dots.appendChild(svg('circle', { cx: x(i), cy: y(Math.max(yLo, p.otd)), r: 4, class: 'dot', 'data-i': i, style: i === sr.pts.length - 1 ? '' : 'opacity:0' })); });
      f.s.appendChild(dots);
      f.s.appendChild(xAxis(f, ms, x));
      const { cross, hit } = crosshairLayer(f, ms, x, (i, cx, cy) => hoverSM(i, cx, cy));
      f.s.appendChild(cross); f.s.appendChild(hit);
      panel.appendChild(f.s); panels.push({ f, x, cross, dots });
    });
    function hoverSM(i, cx, cy) {
      state.hover = i;
      panels.forEach(p => {
        p.cross.classList.toggle('on', i != null); if (i != null) { p.cross.setAttribute('x1', p.x(i)); p.cross.setAttribute('x2', p.x(i)); }
        $$('circle', p.dots).forEach(c => { const ci = +c.getAttribute('data-i'); const on = i == null ? ci === ms.length - 1 : ci === i; c.style.opacity = on ? 1 : 0; c.classList.toggle('hot', i != null && ci === i); });
      });
      if (i == null) return hideTip();
      const lines = series.map(sr => ({ k: sr.r.name, v: fmt.pct(sr.pts[i].otd), swatch: 'var(--on-surface)' }));
      lines.push({ k: 'All regions', v: fmt.pct(all[i].otd), swatch: 'var(--on-surface-muted)' });
      showTip(ms[i].label + ' · on-time delivery', lines, cx, cy);
    }
    keyNav(card, ms, hoverSM);
    tableTwin(card, ['Month', ...series.map(s => s.r.name), 'All regions'], ms.map((m, i) => [m.label, ...series.map(s => fmt.pct(s.pts[i].otd)), fmt.pct(all[i].otd)]));
    $('#sm-note').textContent = state.vendor !== 'ALL' ? `Showing ${vById[state.vendor].name} only · ghost line is all regions for this vendor` : 'Matched scales, 74–100%. The ghost line is all regions combined; the brass tick is the month the modelled intervention goes live.';
  }

  /* ── turnaround ──────────────────────────────────────────────────── */
  function renderTAT() {
    const card = $('#tat-card'), host = $('#tat'); host.replaceChildren();
    const ms = months(); const bm = byMonth(rows(), ms);
    const f = frame(host, 250, { l: 36, r: 52, t: 22, b: 28 }); host.appendChild(f.s);
    const vals = bm.map(p => p.tat).filter(v => v != null);
    if (!vals.length) { f.s.appendChild(txt(f.w / 2, f.h / 2, 'No orders in this slice', 'empty', { 'text-anchor': 'middle' })); tableTwin(card, ['Month', 'Days'], []); return; }
    const lo = Math.floor(Math.min(...vals, T.tat) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const x = lin(0, ms.length - 1, f.p.l, f.w - f.p.r), y = lin(lo, hi, f.h - f.p.b, f.p.t);
    f.s.appendChild(yGrid(f, y, ticks(lo, hi, 5), v => v + ' d'));
    f.s.appendChild(svg('line', { x1: f.p.l, x2: f.w - f.p.r, y1: y(T.tat), y2: y(T.tat), class: 'target' }));
    f.s.appendChild(txt(f.p.l + 6, y(T.tat) - 6, 'TARGET ' + T.tat + ' D', 'ttl'));
    const pts = bm.map((p, i) => [x(i), p.tat == null ? null : y(p.tat)]);
    const firstI = pts.findIndex(p => p[1] != null), lastI = pts.length - 1 - [...pts].reverse().findIndex(p => p[1] != null);
    if (firstI >= 0) f.s.appendChild(svg('path', { d: linePath(pts) + `L${x(lastI)} ${f.h - f.p.b}L${x(firstI)} ${f.h - f.p.b}Z`, class: 'wash' }));
    const ii = ms.findIndex(m => m.i === INT);
    if (ii >= 0) { f.s.appendChild(svg('line', { x1: x(ii), x2: x(ii), y1: f.p.t - 6, y2: f.h - f.p.b, class: 'int' })); f.s.appendChild(txt(x(ii) + 6, f.p.t + 2, f.w < 560 ? 'SOPs LIVE' : 'SOPs + ESCALATION PROTOCOL LIVE', 'ann')); }
    f.s.appendChild(svg('path', { d: linePath(pts), class: 'ink' }));
    const dots = svg('g'); bm.forEach((p, i) => { if (p.tat != null) dots.appendChild(svg('circle', { cx: x(i), cy: y(p.tat), r: 4, class: 'dot', 'data-i': i, style: i === lastI ? '' : 'opacity:0' })); }); f.s.appendChild(dots);
    if (lastI >= 0) f.s.appendChild(txt(x(lastI) + 10, y(bm[lastI].tat) + 4, fmt.d1(bm[lastI].tat) + ' d', 'lbl'));
    f.s.appendChild(xAxis(f, ms, x));
    const { cross, hit } = crosshairLayer(f, ms, x, hover); f.s.appendChild(cross); f.s.appendChild(hit);
    function hover(i, cx, cy) {
      state.hover = i; cross.classList.toggle('on', i != null);
      $$('circle', dots).forEach(c => { const ci = +c.getAttribute('data-i'); c.style.opacity = (i == null ? ci === lastI : ci === i) ? 1 : 0; c.classList.toggle('hot', i != null && ci === i); });
      if (i == null) return hideTip();
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      const p = bm[i]; showTip(ms[i].label, [{ k: 'Turnaround', v: fmt.d1(p.tat) + ' d', swatch: 'var(--on-surface)' }, { k: 'vs target', v: p.tat == null ? '—' : fmt.signed(p.tat - T.tat, 1, ' d') }, { k: 'Orders', v: fmt.int(p.n) }], cx, cy);
    }
    keyNav(card, ms, hover);
    tableTwin(card, ['Month', 'Days', 'Orders'], bm.map(p => [p.m.label, fmt.d1(p.tat), fmt.int(p.n)]));
  }

  /* ── backlog by age ──────────────────────────────────────────────── */
  function renderBL() {
    const card = $('#bl-card'), host = $('#bl'); host.replaceChildren();
    const ms = months(); const bl = backlogByMonth();
    const f = frame(host, 250, { l: 36, r: 34, t: 22, b: 28 }); host.appendChild(f.s);
    const hi = Math.max(...bl.map(b => b.total), 10);
    const x = lin(0, ms.length - 1, f.p.l + 14, f.w - f.p.r - 14), y = lin(0, hi * 1.08, f.h - f.p.b, f.p.t);
    f.s.appendChild(yGrid(f, y, ticks(0, hi * 1.08, 4), v => fmt.int(v)));
    const slot = f.iw / ms.length, bw = Math.min(24, Math.max(8, slot * 0.62));
    const cols = svg('g');
    bl.forEach((b, i) => {
      const g = svg('g', { class: 'col', 'data-i': i }); let acc = 0;
      BUCKETS.forEach(([k, , color], bi) => {
        const v = b[k]; if (!v) return; const y1 = y(acc + v), h = y(acc) - y1; const top = bi === BUCKETS.length - 1 || BUCKETS.slice(bi + 1).every(([kk]) => !b[kk]);
        g.appendChild(svg('rect', { x: x(i) - bw / 2, y: y1, width: bw, height: h, fill: color, class: 'seg' }));
        acc += v;
      });
      const hit = svg('rect', { x: x(i) - slot / 2, y: f.p.t, width: slot, height: f.ih, class: 'hit' });
      hit.addEventListener('pointermove', e => hover(i, e.clientX, e.clientY)); hit.addEventListener('pointerleave', () => hover(null));
      g.appendChild(hit); cols.appendChild(g);
    });
    f.s.appendChild(cols);
    const last = bl[bl.length - 1]; if (last) f.s.appendChild(txt(x(bl.length - 1), y(last.total) - 8, fmt.int(last.total), 'lbl', { 'text-anchor': 'middle' }));
    f.s.appendChild(svg('line', { x1: f.p.l, x2: f.w - f.p.r, y1: y(0), y2: y(0), class: 'base' }));
    f.s.appendChild(xAxis(f, ms, x));
    function hover(i, cx, cy) {
      state.hover = i; $$('.col', cols).forEach(c => c.classList.toggle('dim', i != null && +c.getAttribute('data-i') !== i));
      if (i == null) return hideTip();
      const b = bl[i]; showTip(ms[i].label + ' · open orders', [...BUCKETS.map(([k, name, color]) => ({ k: name, v: fmt.int(b[k]), swatch: color, sq: true })), { k: 'Total', v: fmt.int(b.total), hi: true }], cx, cy);
    }
    keyNav(card, ms, hover);
    const lg = $('.legend', card); lg.replaceChildren(...BUCKETS.map(([, name, color]) => { const i = el('i'); i.style.background = color; return el('span', null, [i, name]); }));
    tableTwin(card, ['Month', ...BUCKETS.map(b => b[1]), 'Total'], bl.map(b => [b.m.label, ...BUCKETS.map(([k]) => fmt.int(b[k])), fmt.int(b.total)]));
    $('#bl-note').textContent = state.vendor !== 'ALL' ? 'Region-level measure · vendor filter not applied' : 'Open orders at month end, by age. Lightest step is the newest bucket; the over-30-day bucket is the one to watch.';
  }

  /* ── late causes: before vs after ────────────────────────────────── */
  function renderCZ() {
    const card = $('#cz-card'), host = $('#cz'); host.replaceChildren();
    const ms = months(); const pre = ms.filter(m => m.i < INT), post = ms.filter(m => m.i >= INT);
    const rate = (mset) => { const ids = new Set(mset.map(m => m.i)); const n = D.rows.filter(x => ids.has(x.m) && inR(x.r)).reduce((a, x) => a + x.n, 0); const c = {}; D.causes.forEach(k => c[k.id] = 0); D.lateCauses.filter(x => ids.has(x.m) && inR(x.r)).forEach(x => D.causes.forEach(k => c[k.id] += x[k.id])); D.causes.forEach(k => c[k.id] = n ? c[k.id] / n * 100 : null); return c; };
    const a = pre.length ? rate(pre) : null, b = post.length ? rate(post) : null;
    const items = D.causes.map(k => ({ k, before: a ? a[k.id] : null, after: b ? b[k.id] : null })).sort((p, q) => ((p.before ?? p.after) < (q.before ?? q.after) ? 1 : -1));
    const narrow = host.clientWidth < 520; const rowH = narrow ? 50 : 44, f = frame(host, items.length * rowH + 34, { l: narrow ? 118 : 176, r: narrow ? 76 : 88, t: 10, b: 24 }); host.appendChild(f.s);
    const hi = Math.max(...items.flatMap(it => [it.before || 0, it.after || 0]), 1);
    const x = lin(0, Math.ceil(hi * 1.1), f.p.l, f.w - f.p.r);
    ticks(0, Math.ceil(hi * 1.1), 4).forEach(v => { f.s.appendChild(svg('line', { x1: x(v), x2: x(v), y1: f.p.t, y2: f.h - f.p.b, class: 'grid' })); f.s.appendChild(txt(x(v), f.h - f.p.b + 16, v.toFixed(v % 1 ? 1 : 0), 'ax', { 'text-anchor': 'middle' })); });
    items.forEach((it, i) => {
      const cy = f.p.t + rowH * i + rowH / 2; const g = svg('g');
      const name = it.k.name;
      if (f.w < 520 && name.length > 14 && name.includes(' ')) {
        const words = name.split(' '); let best = 1, diff = Infinity;
        for (let k = 1; k < words.length; k++) { const d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length); if (d < diff) { diff = d; best = k; } }
        const t = txt(f.p.l - 14, cy - 3, '', 'lbl', { 'text-anchor': 'end' });
        const a = svg('tspan', { x: f.p.l - 14, dy: 0 }); a.textContent = words.slice(0, best).join(' ');
        const b = svg('tspan', { x: f.p.l - 14, dy: 14 }); b.textContent = words.slice(best).join(' ');
        t.appendChild(a); t.appendChild(b); g.appendChild(t);
      } else g.appendChild(txt(f.p.l - 14, cy + 4, name, 'lbl', { 'text-anchor': 'end' }));
      if (it.before != null && it.after != null) g.appendChild(svg('line', { x1: x(it.before), x2: x(it.after), y1: cy, y2: cy, class: 'db-line' }));
      if (it.before != null) g.appendChild(svg('circle', { cx: x(it.before), cy, r: 6, class: 'db-before' }));
      if (it.after != null) g.appendChild(svg('circle', { cx: x(it.after), cy, r: 6, class: 'db-after' }));
      if (it.before != null && it.after != null) {
        const t = txt(x(Math.max(it.after, it.before)) + 14, cy + 4, '', 'lbl');
        const a = svg('tspan', { class: 'ax' }); a.textContent = fmt.d1(it.before) + ' → ';
        const b = svg('tspan'); b.textContent = fmt.d1(it.after);
        t.appendChild(a); t.appendChild(b); g.appendChild(t);
      } else if (it.after != null || it.before != null) g.appendChild(txt(x(it.after ?? it.before) + 14, cy + 4, fmt.d1(it.after ?? it.before), it.after != null ? 'lbl' : 'ax'));
      const hit = svg('rect', { class: 'hit', x: f.p.l - 170, y: cy - rowH / 2, width: f.w, height: rowH });
      const tipFor = (cx, cy) => showTip(it.k.name + ' · late per 100 orders', [{ k: 'Before Aug 2022', v: fmt.d1(it.before), swatch: 'var(--steel-300)', sq: true }, { k: 'After', v: fmt.d1(it.after), swatch: 'var(--on-surface)', sq: true }, { k: 'Change', v: it.before != null && it.after != null ? fmt.signed((it.after - it.before) / it.before * 100, 0, '%') : '—', hi: true }], cx, cy);
      it.tipFor = tipFor;
      hit.addEventListener('pointermove', e => tipFor(e.clientX, e.clientY));
      hit.addEventListener('pointerleave', hideTip);
      g.appendChild(hit); f.s.appendChild(g);
    });
    keyNav(card, items, (i, cx, cy) => { if (i == null) return hideTip(); items[i].tipFor(cx, cy); }, { vertical: true });
    const lg = $('.legend', card); lg.replaceChildren(
      el('span', null, [Object.assign(el('i', { class: 'dot' }), { style: 'background:var(--steel-300)' }), 'Before Aug 2022' + (pre.length ? ` (${pre.length} mo)` : ' · outside period')]),
      el('span', null, [Object.assign(el('i', { class: 'dot' }), { style: 'background:var(--on-surface)' }), 'After' + (post.length ? ` (${post.length} mo)` : ' · outside period')]));
    tableTwin(card, ['Cause', 'Before /100', 'After /100'], items.map(it => [it.k.name, fmt.d1(it.before), fmt.d1(it.after)]));
    $('#cz-note').textContent = state.vendor !== 'ALL' ? 'Region-level measure · vendor filter not applied' : 'Late shipments per 100 orders, by coded cause, before and after the modelled intervention. In this dataset customs documentation is the largest cause and the one that falls furthest.';
  }

  /* ── vendor scorecard ────────────────────────────────────────────── */
  function renderVT() {
    const ms = months(); const xs = rows({ anyVendor: true });
    const g = {}; xs.forEach(x => (g[x.v] || (g[x.v] = [])).push(x));
    let list = Object.keys(g).map(id => { const a = agg(g[id]); const bm = byMonth(g[id], ms); return Object.assign({ id, v: vById[id], spark: bm.map(p => p.otd), regions: [...new Set(g[id].map(x => x.r))] }, a); });
    const k = state.sortKey, dir = state.sortDir;
    list.sort((p, q) => { let a = k === 'name' ? p.v.name : p[k], b = k === 'name' ? q.v.name : q[k]; if (a == null) a = -Infinity; if (b == null) b = -Infinity; return (a > b ? 1 : a < b ? -1 : 0) * dir; });
    const tb = $('#vt tbody'); tb.replaceChildren();
    list.forEach(r => {
      const tr = el('tr', { class: 'pick' + (state.vendor === r.id ? ' sel' : '') });
      const pickBtn = el('button', { class: 'vpick', type: 'button', 'aria-pressed': state.vendor === r.id ? 'true' : 'false', 'aria-label': (state.vendor === r.id ? 'Clear filter: ' : 'Filter the exhibit to ') + r.v.name }, [el('span', { class: 'vn', text: r.v.name }), el('span', { class: 'vt', text: r.v.type })]);
      pickBtn.dataset.v = r.id; tr.appendChild(el('td', null, [pickBtn]));
      tr.appendChild(el('td', { class: 'dim hide-sm hide-md', text: r.regions.map(id => rById[id].name.replace(' (ex-DE)', '')).join(' · ') }));
      tr.appendChild(el('td', { class: 'r', text: fmt.int(r.n) }));
      tr.appendChild(el('td', { class: 'r', text: fmt.pct(r.otd) }));
      tr.appendChild(el('td', { class: 'r hide-sm hide-md', text: fmt.pct(r.accp) }));
      tr.appendChild(el('td', { class: 'r', text: fmt.d1(r.tat) }));
      tr.appendChild(el('td', { class: 'r hide-sm', text: fmt.int(r.esc) }));
      const sp = el('td', { class: 'hide-sm trend' }); sp.appendChild(sparkline(r.spark, 22)); sp.firstChild.classList.add('spark'); tr.appendChild(sp);
      tr.appendChild(el('td', null, [statusEl(r.otd)]));
      const pick = () => { state.vendor = state.vendor === r.id ? 'ALL' : r.id; $('#fvendor').value = state.vendor; state.refocus = r.id; update(); };
      tr.addEventListener('click', pick); pickBtn.addEventListener('click', e => { e.stopPropagation(); pick(); });
      tb.appendChild(tr);
    });
    $$('#vt th[data-key]').forEach(th => { const on = th.dataset.key === k; if (on) th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });
    $('#vt-count').textContent = `${list.length} vendors modelled, standing in for the ${D.meta.vendorsTotal}-plus vendors, logistics partners and customs teams of the real programme · ${D.meta.skus}-plus active SKUs behind the order counts`;
  }

  /* ── work streams (static) ───────────────────────────────────────── */
  function renderWS() {
    const tb = $('#ws tbody'); tb.replaceChildren();
    const words = { 'on-track': ['good', 'On track'], 'complete': ['good', 'Complete'], 'at-risk': ['', 'At risk'], 'over-budget': ['bad', 'Over budget'] };
    D.workstreams.forEach(w => {
      const tr = el('tr');
      tr.appendChild(el('td', null, [el('span', { class: 'vn', text: w.id }), el('span', { class: 'vt', text: w.name })]));
      tr.appendChild(el('td', { class: 'r', text: fmt.usdk(w.budget) }));
      tr.appendChild(el('td', { class: 'r hide-sm hide-md', text: fmt.usdk(w.planned) }));
      tr.appendChild(el('td', { class: 'r', text: fmt.usdk(w.spent) }));
      const v = w.variance; tr.appendChild(el('td', { class: 'r var ' + (v > 25 ? 'over' : v < -25 ? 'under' : ''), text: fmt.signed(v, 0, 'K').replace(/^([+−])/, '$1$') }));
      const mt = el('td', { class: 'hide-sm' }); const m = el('span', { class: 'meter', role: 'img', 'aria-label': Math.round(w.pct * 100) + '% complete' }); const fill = el('i'); fill.style.width = Math.round(w.pct * 100) + '%'; m.appendChild(fill); mt.appendChild(m); tr.appendChild(mt);
      tr.appendChild(el('td', { class: 'r', text: Math.round(w.pct * 100) + '%' }));
      const [c, wd] = words[w.status]; tr.appendChild(el('td', null, [el('span', { class: 'st ' + c }, [el('i'), wd])]));
      tb.appendChild(tr);
    });
  }

  /* ── summary + filters ───────────────────────────────────────────── */
  function renderSummary() {
    const ms = months(); const xs = rows(); const a = agg(xs); const vendors = new Set(xs.map(x => x.v)).size;
    const region = state.region === 'ALL' ? 'All regions' : rById[state.region].name;
    const vendor = state.vendor === 'ALL' ? `${vendors} vendors` : vById[state.vendor].name;
    $('#fsummary').textContent = `${ms[0].label} – ${ms[ms.length - 1].label} · ${region} · ${vendor} · ${fmt.int(a.n)} orders`;
  }
  function bindFilters() {
    $$('[data-period]').forEach(b => b.addEventListener('click', () => { state.period = b.dataset.period; update(); }));
    $$('[data-region]').forEach(b => b.addEventListener('click', () => { state.region = b.dataset.region; update(); }));
    const sel = $('#fvendor'); V.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(v => sel.appendChild(el('option', { value: v.id, text: v.name })));
    sel.addEventListener('change', () => { state.vendor = sel.value; update(); });
    $('#freset').addEventListener('click', () => { state.period = 'all'; state.region = 'ALL'; state.vendor = 'ALL'; sel.value = 'ALL'; update(); });
    $$('#vt th[data-key] button').forEach(b => b.addEventListener('click', () => { const k = b.parentElement.dataset.key; if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = k === 'name' ? 1 : -1; } renderVT(); }));
    $$('.chart').forEach(card => { const b = $('.tbtn', card); if (!b) return; b.addEventListener('click', () => { const on = card.classList.toggle('table-on'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? 'Chart' : 'Table'; }); });
  }
  function syncChips() {
    $$('[data-period]').forEach(b => b.setAttribute('aria-pressed', b.dataset.period === state.period ? 'true' : 'false'));
    $$('[data-region]').forEach(b => b.setAttribute('aria-pressed', b.dataset.region === state.region ? 'true' : 'false'));
  }
  function renderAll() { renderSummary(); renderKPIs(); renderSM(); renderTAT(); renderBL(); renderCZ(); renderVT(); }
  let pending;
  function update() {
    syncChips(); hideTip(); document.body.classList.add('is-updating');
    clearTimeout(pending);
    pending = setTimeout(() => { renderAll(); if (state.refocus) { const b = $('#vt .vpick[data-v="' + state.refocus + '"]'); if (b) b.focus({ preventScroll: true }); state.refocus = null; } requestAnimationFrame(() => document.body.classList.remove('is-updating')); }, REDUCED ? 0 : 160);
  }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderSM(); renderTAT(); renderBL(); renderCZ(); }, 120); });

  /* ── chrome ──────────────────────────────────────────────────────── */
  const nav = $('nav.top'); const onScroll = () => nav.classList.toggle('scrolled', scrollY > 24); onScroll(); addEventListener('scroll', onScroll, { passive: true });
  if (!REDUCED && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); if (e.target.id === 'kpis') { pendingCounts.splice(0).forEach(([n, v, d]) => countUp(n, v, d)); } } }), { rootMargin: '0px 0px -10% 0px' });
    $$('.rv').forEach(x => io.observe(x));
  } else $$('.rv').forEach(x => x.classList.add('in'));

  bindFilters(); syncChips(); renderWS(); renderAll();
})();
