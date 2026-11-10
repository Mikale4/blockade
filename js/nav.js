/* nav.js -- bot navigation. Cells are 2x2 voxel columns (0.5 m). A cell is
   walkable at feet height y when all four columns are clear for 7 voxels and
   something below supports it. Barricades are passable at a cost (bots break
   them). Destruction marks columns dirty and they are rebuilt before a search. */
(function () {
  'use strict';
  const { M } = DATA;
  const NAV = { cols: null, flags: null, NW: 0, ND: 0, dirty: new Set() };
  const CLEAR = 7;

  function buildCol(ci) {
    const W = G.world, nx = ci % NAV.NW, nz = (ci / NAV.NW) | 0;
    const x0 = nx * 2, z0 = nz * 2, ys = [], fl = [];
    const H = W.H;
    for (let y = 1; y < H - CLEAR; y++) {
      let sup = false, ok = true, barr = false;
      for (let dz = 0; dz < 2 && ok; dz++) for (let dx = 0; dx < 2 && ok; dx++) {
        const x = x0 + dx, z = z0 + dz;
        if (W.get(x, y - 1, z)) sup = true;
        for (let k = 0; k < CLEAR; k++) {
          const m = W.get(x, y + k, z);
          if (m === 0) continue;
          if (m === M.BARR) { barr = true; continue; }
          ok = false; break;
        }
      }
      if (ok && sup) { ys.push(y); fl.push(barr ? 1 : 0); y += CLEAR - 1; }
    }
    NAV.cols[ci] = ys; NAV.flags[ci] = fl;
  }
  NAV.build = function () {
    const W = G.world;
    NAV.NW = Math.ceil(W.W / 2); NAV.ND = Math.ceil(W.D / 2);
    NAV.cols = new Array(NAV.NW * NAV.ND); NAV.flags = new Array(NAV.NW * NAV.ND);
    for (let i = 0; i < NAV.cols.length; i++) buildCol(i);
    NAV.dirty.clear();
  };
  NAV.touch = function (x, y, z) {
    const nx = x >> 1, nz = z >> 1;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const a = nx + dx, b = nz + dz;
      if (a >= 0 && b >= 0 && a < NAV.NW && b < NAV.ND) NAV.dirty.add(b * NAV.NW + a);
    }
  };
  NAV.refresh = function () { if (!NAV.dirty.size) return; for (const ci of NAV.dirty) buildCol(ci); NAV.dirty.clear(); };

  const key = (ci, y) => ci * 64 + y;
  NAV.nodePos = function (id, out) {
    const ci = (id / 64) | 0, y = id % 64, nx = ci % NAV.NW, nz = (ci / NAV.NW) | 0;
    return (out || new THREE.Vector3()).set(nx * 0.5 + 0.25, y * 0.25, nz * 0.5 + 0.25);
  };
  /* nearest node to a world point */
  NAV.nearest = function (p, maxR) {
    NAV.refresh();
    const cx = Math.floor(p.x * 2), cz = Math.floor(p.z * 2), py = p.y * 4;
    let best = -1, bd = 1e9;
    maxR = maxR || 4;
    for (let r = 0; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= NAV.NW || nz >= NAV.ND) continue;
        const ci = nz * NAV.NW + nx, ys = NAV.cols[ci];
        for (const y of ys) {
          const dy = y - py;
          if (dy > 3 || dy < -14) continue;
          const d = Math.abs(dy) * 0.6 + r * 2;
          if (d < bd) { bd = d; best = key(ci, y); }
        }
      }
      if (best >= 0) return best;
    }
    return best;
  };
  /* does cell (ax,az) have an intermediate step whose top voxel is at y? (stairs climb 2 voxels per cell) */
  function hasStep(ax, az, y) {
    const W = G.world;
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (W.get(ax * 2 + dx, y, az * 2 + dz) && !W.get(ax * 2 + dx, y + 1, az * 2 + dz)) return true;
    return false;
  }
  function neighbours(id, out) {
    out.length = 0;
    const ci = (id / 64) | 0, y = id % 64, nx = ci % NAV.NW, nz = (ci / NAV.NW) | 0;
    const find = (ax, az) => {
      if (ax < 0 || az < 0 || ax >= NAV.NW || az >= NAV.ND) return -1;
      const c = az * NAV.NW + ax, ys = NAV.cols[c];
      let best = -1, bd = 99;
      for (let i = 0; i < ys.length; i++) {
        const dy = ys[i] - y;
        if (dy > 2 || dy < -4) continue;
        if (dy === 2 && !hasStep(ax, az, y)) continue;
        if (Math.abs(dy) < bd) { bd = Math.abs(dy); best = i; }
      }
      return best < 0 ? -1 : c * 64 + ys[best];
    };
    const o = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = find(nx + dx, nz + dz); o.push(n); if (n >= 0) out.push(n, 1); }
    for (const [dx, dz, a, b] of [[1, 1, 0, 2], [1, -1, 0, 3], [-1, 1, 1, 2], [-1, -1, 1, 3]]) {
      if (o[a] < 0 || o[b] < 0) continue;
      const n = find(nx + dx, nz + dz); if (n >= 0) out.push(n, 1.414);
    }
  }
  const flagOf = id => { const ci = (id / 64) | 0, y = id % 64, ys = NAV.cols[ci]; const i = ys.indexOf(y); return i >= 0 ? NAV.flags[ci][i] : 0; };

  /* binary heap of [f, id] */
  class Heap {
    constructor() { this.a = []; }
    push(f, id) { const a = this.a; a.push([f, id]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
    get size() { return this.a.length; }
  }
  const NB = [];
  /* A* from point to point -> array of Vector3 (feet positions) or null */
  NAV.path = function (from, to, opts) {
    opts = opts || {};
    NAV.refresh();
    const s = NAV.nearest(from), t = NAV.nearest(to, 6);
    if (s < 0 || t < 0) return null;
    if (s === t) return [NAV.nodePos(t)];
    const tp = NAV.nodePos(t);
    const tci = (t / 64) | 0, tnx = tci % NAV.NW, tnz = (tci / NAV.NW) | 0, ty = t % 64;
    const h = id => { const ci = (id / 64) | 0, nx = ci % NAV.NW, nz = (ci / NAV.NW) | 0; const dx = Math.abs(nx - tnx), dz = Math.abs(nz - tnz); return (dx + dz + (1.414 - 2) * Math.min(dx, dz)) + Math.abs((id % 64) - ty) * 0.3; };
    const g = new Map(), came = new Map(), open = new Heap(), closed = new Set();
    g.set(s, 0); open.push(h(s), s);
    const avoid = opts.avoid;
    let it = 0, max = opts.max || 12000, bestId = s, bestH = h(s);
    while (open.size && it++ < max) {
      const [, cur] = open.pop();
      if (cur === t) break;
      if (closed.has(cur)) continue;
      closed.add(cur);
      const hc = h(cur); if (hc < bestH) { bestH = hc; bestId = cur; }
      neighbours(cur, NB);
      const gc = g.get(cur);
      for (let i = 0; i < NB.length; i += 2) {
        const n = NB[i]; if (closed.has(n)) continue;
        let c = NB[i + 1];
        if (flagOf(n)) c += opts.barrCost == null ? 5 : opts.barrCost;
        if (avoid) c += avoid(n) || 0;
        const ng = gc + c;
        if (ng < (g.has(n) ? g.get(n) : 1e9)) { g.set(n, ng); came.set(n, cur); open.push(ng + h(n), n); }
      }
    }
    let end = came.has(t) ? t : (opts.partial ? bestId : -1);
    if (end < 0) return null;
    const out = [];
    for (let c = end; c !== undefined && c !== s; c = came.get(c)) out.push(NAV.nodePos(c));
    out.reverse();
    if (end === t && opts.exact !== false) { const last = out[out.length - 1]; if (last && U.dist2(last, to) < 0.7 && Math.abs(last.y - to.y) < 0.6) last.set(to.x, last.y, to.z); }
    return out;
  };
  /* a random walkable point inside a room */
  NAV.randomIn = function (room, tries) {
    for (let i = 0; i < (tries || 30); i++) {
      const x = U.rndi(room.x0 + 1, room.x1 - 1), z = U.rndi(room.z0 + 1, room.z1 - 1);
      const ci = (z >> 1) * NAV.NW + (x >> 1), ys = NAV.cols[ci];
      if (ys && ys.includes(room.y)) return new THREE.Vector3((x >> 1) * 0.5 + 0.25, room.y * 0.25, (z >> 1) * 0.5 + 0.25);
    }
    return new THREE.Vector3(room.cx, room.fy, room.cz);
  };
  NAV.walkable = function (p) { const id = NAV.nearest(p, 0); if (id < 0) return false; return Math.abs(NAV.nodePos(id).y - p.y) < 0.4; };

  NAV.neighbours = id => { const o = []; neighbours(id, o); return o; };
  window.NAV = NAV;
})();
