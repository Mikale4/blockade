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
      // every column needs ground within one step below: a cell half over a drop (the open side
      // of a flight, a loft edge, the top of a rail) is a ledge a body slides off
      let sup = false, ok = true, barr = false;
      for (let dz = 0; dz < 2 && ok; dz++) for (let dx = 0; dx < 2 && ok; dx++) {
        const x = x0 + dx, z = z0 + dz;
        if (W.get(x, y - 1, z)) sup = true;
        else if (!W.get(x, y - 2, z)) { ok = false; break; }
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
    NAV.main = mainArea();
  };
  /* the largest connected walkable area. Sealed pockets (the closet behind a stairwell's
     flights, a specimen tank) are never chosen as random destinations. */
  function mainArea() {
    const seen = new Set(), nb = [];
    let best = new Set();
    for (let ci = 0; ci < NAV.cols.length; ci++) for (const y of NAV.cols[ci]) {
      const s = key(ci, y);
      if (seen.has(s)) continue;
      const comp = new Set([s]), q = [s]; seen.add(s);
      while (q.length) {
        neighbours(q.pop(), nb);
        for (let i = 0; i < nb.length; i += 2) if (!seen.has(nb[i])) { seen.add(nb[i]); comp.add(nb[i]); q.push(nb[i]); }
      }
      if (comp.size > best.size) best = comp;
    }
    return best;
  }
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
  /* nearest node to a world point. Scored by true distance, and a node with a wall between it
     and the point loses to one in the open: someone standing against a wall must not be
     snapped to the cell on its far side and then walk into the wall to get there. */
  function walledOff(p, x, y, z) {
    const W = G.world, dx = x - p.x, dz = z - p.z, n = Math.ceil(Math.hypot(dx, dz) * 8);
    const yb = Math.min(p.y, y);
    for (let i = 1; i < n; i++) {
      const t = i / n, sx = Math.floor((p.x + dx * t) * 4), sz = Math.floor((p.z + dz * t) * 4);
      for (const h of [0.45, 1.3]) { const m = W.get(sx, Math.floor((yb + h) * 4), sz); if (m && m !== M.BARR) return true; }
    }
    return false;
  }
  NAV.nearest = function (p, maxR) {
    NAV.refresh();
    const cx = Math.floor(p.x * 2), cz = Math.floor(p.z * 2), py = p.y * 4;
    let best = -1, bd = 1e9, stop = 1e9;
    maxR = maxR || 4;
    for (let r = 0; r <= Math.min(maxR, stop); r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= NAV.NW || nz >= NAV.ND) continue;
        const ci = nz * NAV.NW + nx, ys = NAV.cols[ci];
        for (const y of ys) {
          const dy = y - py;
          if (dy > 3 || dy < -14) continue;
          const wx = nx * 0.5 + 0.25, wz = nz * 0.5 + 0.25;
          // another floor (a point inside furniture has the basement right under it) costs more
          // than any obstacle on this one
          let d = Math.abs(dy) * 0.6 + (Math.abs(dy) > 3 ? 10 : 0) + Math.hypot(wx - p.x, wz - p.z) * 4;
          if (d >= bd) continue;
          if (r && walledOff(p, wx, y * 0.25, wz)) d += 6;
          if (d < bd) { bd = d; best = key(ci, y); }
        }
      }
      // a closer node can sit one ring further out (the point near a cell edge): look there too
      if (best >= 0 && stop === 1e9) stop = r + 1;
    }
    return best;
  };
  /* Stairs climb two voxels per 0.5 m cell, so a cell two voxels higher is only reachable
     head-on up a flight: the edge of that cell facing us may rise at most one voxel (the
     next step), with the second step behind it. From the side (or diagonally) a body
     would meet both steps at once, a half-metre ledge it can't climb. */
  function stepOk(ax, az, y, dx, dz) {
    if (dx && dz) return false;
    const W = G.world, cols = dx === 1 ? [[ax * 2, az * 2], [ax * 2, az * 2 + 1]] : dx === -1 ? [[ax * 2 + 1, az * 2], [ax * 2 + 1, az * 2 + 1]]
      : dz === 1 ? [[ax * 2, az * 2], [ax * 2 + 1, az * 2]] : [[ax * 2, az * 2 + 1], [ax * 2 + 1, az * 2 + 1]];
    for (const [x, z] of cols) if (W.get(x, y + 1, z)) return false;   // the near edge is no higher than one step
    return cols.some(([x, z]) => W.get(x, y, z));                      // and has a step to stand on
  }
  /* columns of cell (cx, cz) free of anything but barricades from y0 to y1 */
  function clearCol(cx, cz, y0, y1) {
    const W = G.world;
    for (let y = y0; y <= y1; y++) for (let k = 0; k < 4; k++) {
      const m = W.get(cx * 2 + (k & 1), y, cz * 2 + (k >> 1));
      if (m && m !== M.BARR) return false;
    }
    return true;
  }
  function neighbours(id, out) {
    out.length = 0;
    const ci = (id / 64) | 0, y = id % 64, nx = ci % NAV.NW, nz = (ci / NAV.NW) | 0;
    const find = (dx, dz) => {
      const ax = nx + dx, az = nz + dz;
      if (ax < 0 || az < 0 || ax >= NAV.NW || az >= NAV.ND) return -1;
      const c = az * NAV.NW + ax, ys = NAV.cols[c];
      let best = -1, bd = 99;
      for (let i = 0; i < ys.length; i++) {
        const dy = ys[i] - y;
        if (dy > 2 || dy < -4) continue;
        if (dy === 2 && !stepOk(ax, az, y, dx, dz)) continue;
        // the body crosses at the higher of the two heights: there must be headroom for it there
        if (dy < 0 && !clearCol(ax, az, ys[i] + CLEAR, y + CLEAR - 1)) continue;
        if (dy > 0 && !clearCol(nx, nz, y + CLEAR, ys[i] + CLEAR - 1)) continue;
        if (Math.abs(dy) < bd) { bd = Math.abs(dy); best = i; }
      }
      return best < 0 ? -1 : c * 64 + ys[best];
    };
    const o = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = find(dx, dz); o.push(n); if (n >= 0) out.push(n, 1); }
    // diagonals only across level floor: cutting a corner on a flight puts the body against
    // two step edges (or the rail beside it) at once
    const lvl = n => n >= 0 && n % 64 === y;
    for (const [dx, dz, a, b] of [[1, 1, 0, 2], [1, -1, 0, 3], [-1, 1, 1, 2], [-1, -1, 1, 3]]) {
      if (!lvl(o[a]) || !lvl(o[b])) continue;
      const n = find(dx, dz); if (lvl(n)) out.push(n, 1.414);
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
    // solid gadgets (deployable cover, planted shields) aren't voxels: steer around them
    const solids = G.ents.filter(e => e.alive && e.solid).map(e => e.solid);
    const P = new THREE.Vector3();
    const inSolid = n => {
      if (!solids.length) return false;
      NAV.nodePos(n, P);
      for (const b of solids) if (P.x > b.x0 - 0.26 && P.x < b.x1 + 0.26 && P.z > b.z0 - 0.26 && P.z < b.z1 + 0.26 && P.y < b.y1 && P.y + 1.7 > b.y0) return true;
      return false;
    };
    // the stretched maps are about twice the area: long trips (barn loft to a basement) need room
    let it = 0, max = opts.max || 40000, bestId = s, bestH = h(s);
    while (open.size && it++ < max) {
      const [, cur] = open.pop();
      if (cur === t) break;
      if (closed.has(cur)) continue;
      closed.add(cur);
      const hc = h(cur); if (hc < bestH) { bestH = hc; bestId = cur; }
      neighbours(cur, NB);
      const gc = g.get(cur);
      for (let i = 0; i < NB.length; i += 2) {
        const n = NB[i]; if (closed.has(n) || (n !== t && inSolid(n))) continue;
        if (opts.indoors && !Actor.indoors(NAV.nodePos(n, P).x, P.y, P.z)) continue;
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
    const ok = ci => { const ys = NAV.cols[ci]; return ys && ys.includes(room.y) && (!NAV.main || NAV.main.has(ci * 64 + room.y)); };
    const at = (nx, nz) => new THREE.Vector3(nx * 0.5 + 0.25, room.y * 0.25, nz * 0.5 + 0.25);
    for (let i = 0; i < (tries || 30); i++) {
      const x = U.rndi(room.x0 + 1, room.x1 - 1), z = U.rndi(room.z0 + 1, room.z1 - 1);
      if (ok((z >> 1) * NAV.NW + (x >> 1))) return at(x >> 1, z >> 1);
    }
    // mostly sealed off (a stairwell's floor is largely flights and the closet behind them):
    // any reachable cell will do
    const cells = [];
    for (let nz = room.z0 >> 1; nz <= room.z1 >> 1; nz++) for (let nx = room.x0 >> 1; nx <= room.x1 >> 1; nx++) if (ok(nz * NAV.NW + nx)) cells.push([nx, nz]);
    if (cells.length) { const [nx, nz] = U.pick(cells); return at(nx, nz); }
    return new THREE.Vector3(room.cx, room.fy, room.cz);
  };
  NAV.walkable = function (p) { const id = NAV.nearest(p, 0); if (id < 0) return false; return Math.abs(NAV.nodePos(id).y - p.y) < 0.4; };

  NAV.neighbours = id => { const o = []; neighbours(id, o); return o; };
  window.NAV = NAV;
})();
