/* maps.js -- a small builder for voxel buildings, and the nine original maps
   (Roadhouse, Summit Lodge, Homestead, Checkpoint, Helix Labs, Cannery, Observatory,
   Rail Depot, Museum) plus the range.

   Levels: B = 0, 1F = 1, 2F = 2. The floor slab of level L is at voxel y = 12L,
   its air runs y = 12L+1 .. 12L+11, so feet stand at y = 12L+1. Outdoor ground's
   top voxel is y = 12 (level with the 1F slab).
   Building coordinates (lx, lz) are local voxels; walls sit ON room-rect edges. */
(function () {
  'use strict';
  const { M } = DATA;
  const GY = 12, VS = 0.25;

  class Builder {
    constructor(id, name, W, H, D) {
      this.w = new VW.World(W, H, D);
      this.W = W; this.H = H; this.D = D;
      this.meta = {
        id, name, rooms: [], openings: [], hatches: [], spawns: [], cams: [], flights: [], fences: [],
        bombs: [], secure: [], hostage: [], buildings: [], theme: {}, desc: '',
      };
    }
    ground(top, sub) {
      const w = this.w;
      this.meta.ground = { top, sub: sub || M.DIRT };
      w.fill(0, 0, 0, this.W - 1, 0, this.D - 1, M.BEDROCK);
      w.fill(0, 1, 0, this.W - 1, GY - 1, this.D - 1, sub || M.DIRT);
      w.fill(0, GY, 0, this.W - 1, GY, this.D - 1, top);
    }
    surf(x0, z0, x1, z1, m) { this.w.fill(x0, GY, z0, x1, GY, z1, m); }
    box(x0, y0, z0, x1, y1, z1, m) { this.w.fill(x0, y0, z0, x1, y1, z1, m); }
    /* outdoor box measured from the ground: h0..h1 voxels above it */
    obox(x0, z0, x1, z1, h0, h1, m) { this.w.fill(x0, GY + 1 + h0, z0, x1, GY + 1 + h1, z1, m); }
    building(x, z, w, d, o) { const b = new Bld(this, x, z, w, d, o); this.meta.buildings.push(b); return b; }
    spawn(name, x, z, yawDeg) { this.meta.spawns.push({ name, x: (x + 0.5) * VS, y: (GY + 1) * VS, z: (z + 0.5) * VS, yaw: (yawDeg || 0) * Math.PI / 180 }); }
    cam(x, y, z, yawDeg, pitchDeg, name) { this.meta.cams.push({ x: (x + 0.5) * VS, y: (y + 0.5) * VS, z: (z + 0.5) * VS, yaw: yawDeg * Math.PI / 180, pitch: (pitchDeg || -20) * Math.PI / 180, name: name || 'CAM' }); }
    theme(t) { this.meta.theme = t; this.w.light = { out: t.lightOut, in: t.lightIn }; }

    /* ---- outdoor props (world voxel coords) */
    car(x, z, along, m) {
      const L = 17, Wd = 8;
      const [w, d] = along === 'x' ? [L, Wd] : [Wd, L];
      this.obox(x, z, x + w - 1, z + d - 1, 1, 3, m);
      const inset = 3;
      if (along === 'x') { this.obox(x + inset, z, x + w - 1 - inset - 1, z + d - 1, 4, 5, M.GLASS); this.obox(x + inset + 1, z + 1, x + w - inset - 3, z + d - 2, 6, 6, m); }
      else { this.obox(x, z + inset, x + w - 1, z + d - 1 - inset - 1, 4, 5, M.GLASS); this.obox(x + 1, z + inset + 1, x + w - 2, z + d - inset - 3, 6, 6, m); }
      const tires = along === 'x' ? [[x + 2, z - 1], [x + w - 4, z - 1], [x + 2, z + d], [x + w - 4, z + d]] : [[x - 1, z + 2], [x - 1, z + d - 4], [x + w, z + 2], [x + w, z + d - 4]];
      for (const [tx, tz] of tires) this.obox(tx, tz, tx + (along === 'x' ? 2 : 0), tz + (along === 'x' ? 0 : 2), 0, 1, M.TIRE);
      this.obox(along === 'x' ? x : x, z, along === 'x' ? x : x + w - 1, along === 'x' ? z + d - 1 : z, 2, 2, M.LAMP);
    }
    truck(x, z, along, m) {
      const L = 30, Wd = 9;
      const [w, d] = along === 'x' ? [L, Wd] : [Wd, L];
      this.obox(x, z, x + w - 1, z + d - 1, 1, 3, M.CAR_K);
      if (along === 'x') { this.obox(x, z, x + 8, z + d - 1, 4, 8, m); this.obox(x + 1, z, x + 7, z + d - 1, 6, 7, M.GLASS); this.obox(x + 10, z, x + w - 1, z + d - 1, 4, 11, M.CONT_B); }
      else { this.obox(x, z, x + w - 1, z + 8, 4, 8, m); this.obox(x, z + 1, x + w - 1, z + 7, 6, 7, M.GLASS); this.obox(x, z + 10, x + w - 1, z + d - 1, 4, 11, M.CONT_B); }
    }
    container(x, z, along, m, open) {
      const L = 24, Wd = 10;
      const [w, d] = along === 'x' ? [L, Wd] : [Wd, L];
      this.obox(x, z, x + w - 1, z + d - 1, 0, 9, m);
      this.obox(x + 1, z + 1, x + w - 2, z + d - 2, 0, 8, 0);
      if (open) { if (along === 'x') this.obox(x + w - 1, z + 1, x + w - 1, z + d - 2, 0, 8, 0); else this.obox(x + 1, z + d - 1, x + w - 2, z + d - 1, 0, 8, 0); }
    }
    tree(x, z, h, pine, snowy) {
      h = h || 18;
      this.obox(x, z, x + 1, z + 1, 0, h, M.BARK);
      const w = this.w;
      if (pine) {
        for (let y = 5; y <= h + 3; y++) {
          const r = Math.max(1, Math.round((h + 4 - y) * 0.42));
          for (let dz = -r; dz <= r + 1; dz++) for (let dx = -r; dx <= r + 1; dx++) {
            if ((dx - 0.5) ** 2 + (dz - 0.5) ** 2 > r * r + 0.5) continue;
            if (y % 3 === 0 && (dx - 0.5) ** 2 + (dz - 0.5) ** 2 > (r - 1) * (r - 1)) continue;
            const yy = GY + 1 + y;
            if (!w.get(x + dx, yy, z + dz)) w.put(x + dx, yy, z + dz, snowy && (y % 3 === 1) ? M.SNOW : M.LEAF);
          }
        }
      } else {
        const cy = h, R = 5;
        for (let dy = -3; dy <= 4; dy++) for (let dz = -R; dz <= R + 1; dz++) for (let dx = -R; dx <= R + 1; dx++) {
          const d = ((dx - 0.5) / R) ** 2 + ((dz - 0.5) / R) ** 2 + (dy / 4) ** 2;
          if (d > 1 || U.hash3(x + dx, dy, z + dz) < 0.12) continue;
          const yy = GY + 1 + cy + dy;
          if (!w.get(x + dx, yy, z + dz)) w.put(x + dx, yy, z + dz, M.LEAF);
        }
      }
    }
    lamp(x, z, h, m) { h = h || 16; this.obox(x, z, x, z, 0, h, M.PIPE); this.obox(x - 1, z - 1, x + 1, z + 1, h + 1, h + 1, m || M.LAMP); }
    fence(x0, z0, x1, z1, m, h) {
      h = h || 5; m = m || M.FENCE;
      this.meta.fences.push({ x0, z0, x1, z1, m, h });
      const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n);
        if (i % 6 === 0) this.obox(x, z, x, z, 0, h, m);
        else { this.obox(x, z, x, z, h - 1, h - 1, m); this.obox(x, z, x, z, 1, 1, m); }
      }
    }
    barrier(x0, z0, x1, z1) { this.obox(x0, z0, x1, z1, 0, 3, M.CONCRETE); }
    sandbags(x0, z0, x1, z1) { this.obox(x0, z0, x1, z1, 0, 3, M.SANDBAG); }
    dumpster(x, z) { this.obox(x, z, x + 9, z + 5, 0, 5, M.CONT_G); this.obox(x + 1, z + 1, x + 8, z + 4, 5, 5, 0); }
    /* a voxel line between two world points */
    line(x0, y0, z0, x1, y1, z1, m) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
      for (let i = 0; i <= n; i++) this.w.put(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), Math.round(z0 + (z1 - z0) * i / n), m);
    }
    /* an upright cylinder, h0..h1 voxels above the ground */
    drum(cx, cz, r, h0, h1, m) { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + 0.5) this.obox(cx + dx, cz + dz, cx + dx, cz + dz, h0, h1, m); }
    /* a boulder sitting on the ground, its top layer `cap` (snow) if given */
    rock(cx, cz, r, cap) {
      const hy = Math.max(2, Math.round(r * 0.7));
      for (let dy = 0; dy <= hy; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const flat = (dx / r) ** 2 + (dz / r) ** 2;
        if (flat + (dy / hy) ** 2 > 1) continue;
        this.w.put(cx + dx, GY + 1 + dy, cz + dz, cap && flat + ((dy + 1) / hy) ** 2 > 1 ? cap : M.STONE);
      }
    }
  }

  class Bld {
    constructor(B, x, z, w, d, o) {
      Object.assign(this, { B, W: B.w, x, z, w, d });
      this.lo = o.lo; this.hi = o.hi;
      this.ext = o.ext || M.BRICK; this.inner = o.inner || M.DRY_WHITE;
      this.slab = o.slab || M.WOODFLOOR; this.roof = o.roof || M.ROOF;
      const W = this.W, x1 = x + w - 1, z1 = z + d - 1;
      const yb = this.lo * 12, yt = (this.hi + 1) * 12;
      this.roofY = yt;
      W.fill(x, yb + 1, z, x1, yt + 6, z1, 0);
      for (let L = this.lo; L <= this.hi; L++) W.fill(x, L * 12, z, x1, L * 12, z1, L === 0 ? M.CONCRETE : this.slab);
      W.fill(x, yt, z, x1, yt, z1, this.roof);
      const perim = (m, y0, y1) => {
        W.fill(x, y0, z, x1, y1, z, m); W.fill(x, y0, z1, x1, y1, z1, m);
        W.fill(x, y0, z, x, y1, z1, m); W.fill(x1, y0, z, x1, y1, z1, m);
      };
      if (yb < GY) perim(M.CONC_DARK, yb, GY - 1);
      perim(this.ext, Math.max(yb, GY), yt);
      perim(o.parapet || M.CONCRETE, yt + 1, yt + 2);
      this.x1 = x1; this.z1 = z1;
    }
    X(lx) { return this.x + lx; }
    Z(lz) { return this.z + lz; }
    sy(L) { return L * 12; }
    /* a rectangular room; walls on its edges (exterior edges are the shell) */
    room(L, name, lx0, lz0, lx1, lz1, o) {
      o = o || {};
      const W = this.W, y0 = L * 12 + 1, y1 = L * 12 + 11, m = o.wall || this.inner, skip = o.skip || '';
      const edge = (a, b, c, d) => W.fill(this.X(a), y0, this.Z(b), this.X(c), y1, this.Z(d), m);
      if (lz0 !== 0 && !skip.includes('s')) edge(lx0, lz0, lx1, lz0);
      if (lz1 !== this.d - 1 && !skip.includes('n')) edge(lx0, lz1, lx1, lz1);
      if (lx0 !== 0 && !skip.includes('w')) edge(lx0, lz0, lx0, lz1);
      if (lx1 !== this.w - 1 && !skip.includes('e')) edge(lx1, lz0, lx1, lz1);
      if (o.floor) W.fill(this.X(lx0 + 1), L * 12, this.Z(lz0 + 1), this.X(lx1 - 1), L * 12, this.Z(lz1 - 1), (xx, yy, zz, cur) => cur ? o.floor : -1);
      const r = { name, L, x0: this.X(lx0 + 1), z0: this.Z(lz0 + 1), x1: this.X(lx1 - 1), z1: this.Z(lz1 - 1), y: y0, b: this.B.meta.buildings.indexOf(this) };
      r.cx = (r.x0 + r.x1 + 1) / 2 * VS; r.cz = (r.z0 + r.z1 + 1) / 2 * VS; r.fy = y0 * VS;
      this.B.meta.rooms.push(r);
      return r;
    }
    /* openings. axis 'z': wall at lz=line, spans lx a0..a0+n-1. axis 'x': wall at lx=line */
    open(L, axis, line, a0, n, ylo, yhi, kind, fillMat) {
      const W = this.W, y0 = L * 12 + 1 + ylo, y1 = L * 12 + yhi;
      let ext = false, nrm = 0;
      if (axis === 'z') { W.fill(this.X(a0), y0, this.Z(line), this.X(a0 + n - 1), y1, this.Z(line), fillMat || 0); ext = line === 0 || line === this.d - 1; nrm = line === 0 ? -1 : 1; }
      else { W.fill(this.X(line), y0, this.Z(a0), this.X(line), y1, this.Z(a0 + n - 1), fillMat || 0); ext = line === 0 || line === this.w - 1; nrm = line === 0 ? -1 : 1; }
      const op = { kind, L, axis, line: axis === 'z' ? this.Z(line) : this.X(line), a0: axis === 'z' ? this.X(a0) : this.Z(a0), y0, y1, ext, nrm: ext ? nrm : 0 };
      op.a1 = op.a0 + n - 1;
      this.B.meta.openings.push(op);
      return op;
    }
    doorZ(L, lz, lx0, n, h) { return this.open(L, 'z', lz, lx0, n || 4, 0, h || 9, 'door'); }
    doorX(L, lx, lz0, n, h) { return this.open(L, 'x', lx, lz0, n || 4, 0, h || 9, 'door'); }
    winZ(L, lz, lx0, n, glass) { return this.open(L, 'z', lz, lx0, n || 4, 4, 8, 'window', glass === false ? 0 : M.GLASS); }
    winX(L, lx, lz0, n, glass) { return this.open(L, 'x', lx, lz0, n || 4, 4, 8, 'window', glass === false ? 0 : M.GLASS); }
    shutterX(L, lx, lz0, n) { this.open(L, 'x', lx, lz0, n, 0, 9, 'shutter'); this.W.fill(this.X(lx), L * 12 + 3, this.Z(lz0), this.X(lx), L * 12 + 9, this.Z(lz0 + n - 1), M.SHUTTER); }
    shutterZ(L, lz, lx0, n) { this.open(L, 'z', lz, lx0, n, 0, 9, 'shutter'); this.W.fill(this.X(lx0), L * 12 + 3, this.Z(lz), this.X(lx0 + n - 1), L * 12 + 9, this.Z(lz), M.SHUTTER); }
    /* extra wall segment */
    wallZ(L, lz, lx0, lx1, m) { this.W.fill(this.X(lx0), L * 12 + 1, this.Z(lz), this.X(lx1), L * 12 + 11, this.Z(lz), m || this.inner); }
    wallX(L, lx, lz0, lz1, m) { this.W.fill(this.X(lx), L * 12 + 1, this.Z(lz0), this.X(lx), L * 12 + 11, this.Z(lz1), m || this.inner); }
    /* 12 steps from level L to L+1, climbing toward dir, `n` wide */
    stairs(L, lx0, lz0, dir, n) {
      const W = this.W, base = L * 12;
      const run = (dir === '+x' ? [11, 0] : dir === '-x' ? [-11, 0] : dir === '+z' ? [0, 11] : [0, -11]);
      this.B.meta.flights.push({ L, dir, n, x: this.X(lx0), z: this.Z(lz0), ex: this.X(lx0 + run[0]), ez: this.Z(lz0 + run[1]) });
      for (let i = 0; i < 12; i++) {
        for (let k = 0; k < n; k++) {
          let lx, lz;
          if (dir === '+z') { lx = lx0 + k; lz = lz0 + i; } else if (dir === '-z') { lx = lx0 + k; lz = lz0 - i; }
          else if (dir === '+x') { lx = lx0 + i; lz = lz0 + k; } else { lx = lx0 - i; lz = lz0 + k; }
          W.fill(this.X(lx), base + 12, this.Z(lz), this.X(lx), base + 12, this.Z(lz), 0); // cut the slab above
          W.fill(this.X(lx), base + 1, this.Z(lz), this.X(lx), base + 1 + i, this.Z(lz), M.STAIR);
          W.fill(this.X(lx), base + 2 + i, this.Z(lz), this.X(lx), base + 11 + i, this.Z(lz), (x, y, z, cur) => y === base + 12 ? 0 : (cur === M.STAIR ? 0 : -1));
        }
      }
    }
    rail(L, lx0, lz0, lx1, lz1) { this.W.fill(this.X(lx0), L * 12 + 1, this.Z(lz0), this.X(lx1), L * 12 + 3, this.Z(lz1), (x, y, z, cur) => cur ? -1 : (y === L * 12 + 3 || (x + z) % 4 === 0 ? M.RAIL : -1)); }
    /* a standard 12-wide stairwell spanning every level: walls lx0..lx0+12, lz0..lz1.
       up flight (L1->L2) on the west half, down flight (L0->L1) on the east half */
    stairwell(lx0, lz0, lz1) {
      for (let L = this.lo; L <= this.hi; L++) this.room(L, L === 0 ? 'Stairs B' : 'Stairs ' + L + 'F', lx0, lz0, lx0 + 12, lz1, { wall: this.inner, stair: true });
      if (this.hi >= 2) { this.stairs(1, lx0 + 1, lz0 + 4, '+z', 5); this.rail(2, lx0 + 6, lz0 + 3, lx0 + 6, lz0 + 15); this.rail(2, lx0 + 1, lz0 + 3, lx0 + 5, lz0 + 3); }
      if (this.lo === 0) { this.stairs(0, lx0 + 7, lz0 + 15, '-z', 5); }
      if (this.hi >= 2 || this.lo === 0) this.rail(1, lx0 + 6, lz0 + 4, lx0 + 6, lz0 + 15);
      if (this.lo === 0) this.doorZ(0, lz0, lx0 + 1, 4);
      this.doorZ(1, lz0, lx0 + 1, 4);
      if (this.hi >= 2) this.doorZ(2, lz0, lx0 + 7, 4);
    }
    hatch(L, lx, lz) {
      this.W.fill(this.X(lx), L * 12, this.Z(lz), this.X(lx + 3), L * 12, this.Z(lz + 3), M.HATCH);
      this.B.meta.hatches.push({ L, x: this.X(lx), z: this.Z(lz), y: L * 12 });
    }
    void(L, lx0, lz0, lx1, lz1) { this.W.fill(this.X(lx0), L * 12, this.Z(lz0), this.X(lx1), L * 12, this.Z(lz1), 0); }
    /* basement access from outside: a trench with steps down along the wall */
    cellar(side, a0) {
      const W = this.W;
      const P = (u, v) => side === 'w' ? [this.X(-v), this.Z(u)] : side === 'e' ? [this.X(this.w - 1 + v), this.Z(u)] : side === 's' ? [this.X(u), this.Z(-v)] : [this.X(u), this.Z(this.d - 1 + v)];
      for (let v = 1; v <= 6; v++) {
        for (let j = 0; j < 12; j++) { const [x, z] = P(a0 - 2 - j, v); W.fill(x, 1, z, x, GY, z, (xx, y) => y <= 1 + j ? M.CONCRETE : 0); }
        for (let u = a0 - 1; u <= a0 + 4; u++) { const [x, z] = P(u, v); W.fill(x, 1, z, x, GY, z, 0); }
      }
      for (let u = a0 - 14; u <= a0 + 5; u++) { const [x, z] = P(u, 7); W.fill(x, GY + 1, z, x, GY + 3, z, (xx, y) => y === GY + 3 || u % 3 === 0 ? M.RAIL : -1); }
      for (let v = 1; v <= 7; v++) { const [x, z] = P(a0 + 5, v); W.fill(x, GY + 1, z, x, GY + 3, z, (xx, y) => y === GY + 3 || v % 3 === 0 ? M.RAIL : -1); }
      const op = side === 'w' || side === 'e' ? this.open(0, 'x', side === 'w' ? 0 : this.w - 1, a0, 4, 0, 9, 'door') : this.open(0, 'z', side === 's' ? 0 : this.d - 1, a0, 4, 0, 9, 'door');
      return op;
    }
    /* ---- furniture, in level-local coords; h0..h1 voxels above the floor */
    box(L, lx0, lz0, lx1, lz1, h0, h1, m) { this.W.fill(this.X(lx0), L * 12 + 1 + h0, this.Z(lz0), this.X(lx1), L * 12 + 1 + h1, this.Z(lz1), m); }
    table(L, lx0, lz0, lx1, lz1, m) {
      m = m || M.WOOD;
      this.box(L, lx0, lz0, lx1, lz1, 3, 3, m);
      for (const [a, b] of [[lx0, lz0], [lx1, lz0], [lx0, lz1], [lx1, lz1]]) this.box(L, a, b, a, b, 0, 2, m);
    }
    desk(L, lx0, lz0, lx1, lz1) { this.table(L, lx0, lz0, lx1, lz1, M.TRIM); this.box(L, lx0, lz0, lx0 + 1, lz1, 0, 2, M.TRIM); this.box(L, lx0 + 2, lz0 + 1, lx0 + 2, lz0 + 1, 4, 5, M.SCREEN); }
    shelf(L, lx0, lz0, lx1, lz1, h) { h = h || 7; this.box(L, lx0, lz0, lx1, lz1, 0, h, M.TRIM); this.box(L, lx0, lz0, lx1, lz1, 1, h - 1, M.BOOKS); }
    couch(L, lx0, lz0, lx1, lz1, m, back) {
      m = m || M.FAB_RED; this.box(L, lx0, lz0, lx1, lz1, 0, 1, m);
      const b = back || 's';
      if (b === 's') this.box(L, lx0, lz0, lx1, lz0, 2, 3, m); else if (b === 'n') this.box(L, lx0, lz1, lx1, lz1, 2, 3, m);
      else if (b === 'w') this.box(L, lx0, lz0, lx0, lz1, 2, 3, m); else this.box(L, lx1, lz0, lx1, lz1, 2, 3, m);
    }
    bed(L, lx0, lz0, lx1, lz1, m) { this.box(L, lx0, lz0, lx1, lz1, 0, 1, M.TRIM); this.box(L, lx0, lz0, lx1, lz1, 2, 2, m || M.WHITE); this.box(L, lx0, lz0, lx0 + 1, lz1, 3, 3, M.WHITE); }
    counter(L, lx0, lz0, lx1, lz1, m) { this.box(L, lx0, lz0, lx1, lz1, 0, 3, m || M.COUNTER); }
    crates(L, lx, lz, n) { for (let i = 0; i < n; i++) this.box(L, lx + (i % 2) * 4, lz + ((i >> 1) % 2) * 4, lx + (i % 2) * 4 + 3, lz + ((i >> 1) % 2) * 4 + 3, (i >> 2) * 4, (i >> 2) * 4 + 3, M.CRATE); }
    rack(L, lx0, lz0, lx1, lz1) { this.box(L, lx0, lz0, lx1, lz1, 0, 8, M.SERVER); this.W.fill(this.X(lx0), L * 12 + 2, this.Z(lz0), this.X(lx1), L * 12 + 8, this.Z(lz1), (x, y, z, c) => c && (x + y * 3 + z) % 5 === 0 ? M.LED_G : -1); }
    tank(L, lx, lz, r, h, m) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + 0.5) this.box(L, lx + dx, lz + dz, lx + dx, lz + dz, 0, h, m || M.METAL);
    }
    fireplace(L0, L1, lx0, lz0, lx1, lz1) {
      for (let L = L0; L <= L1; L++) this.box(L, lx0, lz0, lx1, lz1, 0, 10, M.STONE);
      this.box(L0, lx0 + 1, lz0 + 2, lx1, lz1 - 2, 0, 2, 0);
      this.box(L0, lx0 + 1, lz0 + 2, lx0 + 1, lz1 - 2, 0, 0, M.LAMP_R);
      this.W.fill(this.X(lx0), this.roofY, this.Z(lz0), this.X(lx1), this.roofY + 6, this.Z(lz1), M.STONE);
    }
    cam(L, lx, lz, yawDeg, name) { this.B.cam(this.X(lx), L * 12 + 10, this.Z(lz), yawDeg, -22, name); }
  }

  const THEMES = {
    dusk:  { sky: [0x2b2440, 0xd9825a], fog: 0x6a4a52, fogFar: 140, lightOut: [1.0, 0.8, 0.66], lightIn: [0.6, 0.54, 0.46], sun: 0xffb27a, outer: 0x4a5a32 },
    snow:  { sky: [0x9aa8b8, 0xe8edf2], fog: 0xd6dde4, fogFar: 95, lightOut: [0.96, 0.99, 1.05], lightIn: [0.66, 0.6, 0.52], sun: 0xffffff, outer: 0xeef2f5, snow: true },
    farm:  { sky: [0x5a8ad0, 0xcfe4f5], fog: 0xbcd2e2, fogFar: 160, lightOut: [1.06, 1.0, 0.9], lightIn: [0.62, 0.58, 0.52], sun: 0xfff2d0, outer: 0x5b8a3a },
    desert:{ sky: [0x4a8ad6, 0xe6dcc4], fog: 0xdcd2bc, fogFar: 170, lightOut: [1.1, 1.04, 0.94], lightIn: [0.64, 0.62, 0.58], sun: 0xfff6e0, outer: 0xc8b68a },
    night: { sky: [0x05070f, 0x1a2a48], fog: 0x0e1626, fogFar: 110, lightOut: [0.4, 0.46, 0.64], lightIn: [0.82, 0.84, 0.9], sun: 0x8aa0ff, outer: 0x1c2a3a, water: true },
    range: { sky: [0x5a7ab0, 0xd6e2ee], fog: 0xc0ccd8, fogFar: 160, lightOut: [1.02, 1.0, 0.96], lightIn: [0.66, 0.64, 0.6], sun: 0xffffff, outer: 0x77746e },
    harbor:  { sky: [0x6c7c8a, 0xc6ced4], fog: 0xa9b3b9, fogFar: 88, lightOut: [0.86, 0.9, 0.96], lightIn: [0.62, 0.6, 0.56], sun: 0xe8eff4, outer: 0x2a4450, water: true },
    starry:  { sky: [0x03050d, 0x1c2848], fog: 0x0f1626, fogFar: 125, lightOut: [0.48, 0.54, 0.74], lightIn: [0.84, 0.82, 0.76], sun: 0x9fb0ff, outer: 0x6a7078 },
    rain:    { sky: [0x2c3038, 0x6e6a72], fog: 0x50525a, fogFar: 100, lightOut: [0.72, 0.74, 0.82], lightIn: [0.72, 0.64, 0.52], sun: 0xc8c4d8, outer: 0x3e4436 },
    evening: { sky: [0x1c1e3e, 0x9a6a80], fog: 0x46405a, fogFar: 125, lightOut: [0.74, 0.68, 0.82], lightIn: [0.86, 0.8, 0.68], sun: 0xe0b0ff, outer: 0x3e5232 },
  };

  /* =================================================================== ROADHOUSE */
  function roadhouse() {
    const B = new Builder('roadhouse', 'ROADHOUSE', 200, 56, 168);
    B.meta.desc = 'A highway diner and motor garage in the pines, with a brewery in the cellar. Dusk.';
    B.theme(THEMES.dusk);
    B.ground(M.GRASS);
    B.surf(0, 0, 199, 10, M.ASPHALT);
    for (let x = 4; x < 196; x += 10) B.surf(x, 5, x + 5, 5, M.LINE);
    B.surf(28, 11, 172, 46, M.GRAVEL);
    B.surf(152, 46, 199, 140, M.GRAVEL);
    const b = B.building(48, 50, 104, 72, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    // ---- B
    b.room(0, 'Brewery', 0, 0, 44, 36, { wall: M.DRY_GREY });
    b.room(0, 'Cold Storage', 44, 0, 72, 36, { wall: M.DRY_GREY });
    b.room(0, 'Parts Room', 72, 0, 103, 71, { wall: M.CONCRETE });
    b.room(0, 'Lower Hall', 0, 36, 72, 44, { wall: M.DRY_GREY });
    b.room(0, 'Laundry', 0, 44, 28, 71, { wall: M.DRY_WHITE });
    b.room(0, 'Generator Room', 28, 44, 48, 71, { wall: M.CONCRETE });
    b.room(0, 'Safe Room', 60, 44, 72, 71, { wall: M.CONCRETE });
    // ---- 1F
    b.room(1, 'Diner', 0, 0, 44, 36, { wall: M.DRY_RED, floor: M.TILE });
    b.room(1, 'Bar Lounge', 44, 0, 72, 36, { wall: M.DRY_RED });
    b.room(1, 'Garage', 72, 0, 103, 71, { wall: M.DRY_GREY, floor: M.CONCRETE });
    b.room(1, 'Hallway', 0, 36, 72, 44, { wall: M.DRY_BEIGE });
    b.room(1, 'Kitchen', 0, 44, 28, 71, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(1, 'Back Office', 28, 44, 48, 71, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    b.room(1, 'Storage', 60, 44, 72, 71, { wall: M.DRY_GREY });
    // ---- 2F
    b.room(2, 'Living Room', 0, 0, 40, 36, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, 'Bedroom', 40, 0, 72, 36, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(2, 'Gym', 72, 0, 103, 36, { wall: M.DRY_GREY });
    b.room(2, 'Upper Hall', 0, 36, 103, 44, { wall: M.DRY_BEIGE });
    b.room(2, 'Bathroom', 0, 44, 20, 71, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(2, 'Boss Office', 20, 44, 48, 71, { wall: M.DRY_RED, floor: M.CARPET });
    b.room(2, 'Armory', 60, 44, 72, 71, { wall: M.DRY_GREY });
    b.room(2, 'Trophy Room', 72, 44, 103, 71, { wall: M.DRY_BLUE });
    b.stairwell(48, 44, 71);
    // ---- doors B
    b.doorZ(0, 36, 20); b.doorZ(0, 36, 56); b.doorX(0, 44, 16); b.doorZ(0, 44, 10); b.doorZ(0, 44, 36); b.doorZ(0, 44, 64);
    b.doorX(0, 72, 38); b.doorX(0, 72, 20); b.doorX(0, 28, 58);
    b.cellar('w', 16);
    // ---- doors 1F
    b.doorZ(1, 0, 20); b.doorZ(1, 0, 56); b.doorX(1, 44, 14); b.doorX(1, 44, 24, 6); b.doorZ(1, 36, 8); b.doorZ(1, 36, 60);
    b.doorX(1, 72, 18); b.doorX(1, 72, 38); b.doorZ(1, 44, 12); b.doorZ(1, 44, 36); b.doorZ(1, 44, 64); b.doorX(1, 28, 60);
    b.doorZ(1, 71, 6); b.doorX(1, 0, 38); b.doorZ(1, 0, 84); b.doorZ(1, 71, 90); b.doorX(1, 72, 56);
    b.shutterX(1, 103, 24, 20);
    b.winZ(1, 0, 6, 5); b.winZ(1, 0, 30, 5); b.winZ(1, 0, 48, 4); b.winZ(1, 0, 64, 4); b.winZ(1, 0, 94, 5);
    b.winX(1, 0, 12, 5); b.winX(1, 0, 24, 5); b.winX(1, 0, 52, 5); b.winX(1, 103, 8, 5); b.winX(1, 103, 56, 5);
    b.winZ(1, 71, 16, 5); b.winZ(1, 71, 36, 5); b.winZ(1, 71, 64, 4);
    // ---- doors 2F
    b.doorZ(2, 36, 16); b.doorZ(2, 36, 56); b.doorZ(2, 36, 84); b.doorZ(2, 44, 8); b.doorZ(2, 44, 30); b.doorZ(2, 44, 64); b.doorZ(2, 44, 86);
    b.doorX(2, 40, 20); b.doorX(2, 72, 10); b.doorX(2, 20, 56); b.doorX(2, 72, 56);
    for (const a of [8, 26, 48, 62, 80, 94]) b.winZ(2, 0, a, 5);
    b.winX(2, 0, 14, 5); b.winX(2, 0, 54, 4); b.winX(2, 103, 16, 5); b.winX(2, 103, 52, 5);
    for (const a of [26, 38, 82, 94]) b.winZ(2, 71, a, 5); b.winZ(2, 71, 64, 4);
    // ---- hatches
    b.hatch(2, 56, 20); b.hatch(2, 32, 56); b.hatch(1, 30, 24); b.hatch(1, 16, 56);
    // ---- furniture B
    b.tank(0, 10, 10, 3, 8, M.METAL); b.tank(0, 22, 10, 3, 8, M.METAL); b.tank(0, 34, 10, 3, 8, M.METAL);
    b.box(0, 4, 26, 30, 28, 0, 2, M.CRATE); b.crates(0, 50, 4, 6); b.shelf(0, 64, 2, 70, 3, 7); b.shelf(0, 46, 26, 60, 27, 6);
    b.crates(0, 80, 10, 4); b.crates(0, 92, 40, 6); b.shelf(0, 74, 60, 90, 61, 7);
    b.box(0, 4, 50, 8, 54, 0, 3, M.WHITE); b.box(0, 4, 58, 8, 62, 0, 3, M.WHITE); b.table(0, 14, 60, 22, 66);
    b.box(0, 32, 50, 42, 58, 0, 6, M.METAL); b.box(0, 36, 59, 37, 70, 7, 7, M.PIPE);
    b.box(0, 64, 62, 70, 68, 0, 5, M.METAL); b.box(0, 62, 48, 64, 56, 0, 1, M.FAB_BLUE);
    // ---- furniture 1F
    b.counter(1, 4, 28, 30, 30); b.couch(1, 2, 3, 8, 8, M.FAB_RED, 'w'); b.couch(1, 26, 3, 32, 8, M.FAB_RED, 's'); b.table(1, 12, 10, 18, 16); b.table(1, 30, 14, 36, 20);
    b.counter(1, 46, 6, 48, 28, M.TRIM); b.shelf(1, 45, 2, 46, 30, 6); b.box(1, 56, 12, 64, 18, 0, 2, M.TRIM); b.box(1, 56, 12, 64, 18, 3, 3, M.FELT);
    b.box(1, 68, 30, 70, 34, 0, 6, M.NEON_P); b.couch(1, 60, 26, 68, 32, M.FAB_BLUE, 'n');
    B.car(b.X(80), b.Z(48), 'z', M.CAR_R); b.box(1, 74, 4, 76, 30, 0, 3, M.TRIM); b.shelf(1, 100, 2, 102, 20, 8); b.crates(1, 92, 60, 4);
    b.counter(1, 2, 46, 26, 48); b.counter(1, 2, 64, 6, 70, M.FRIDGE); b.box(1, 10, 54, 18, 58, 0, 3, M.METAL);
    b.desk(1, 34, 58, 42, 62); b.shelf(1, 30, 66, 46, 69); b.box(1, 44, 46, 46, 50, 0, 5, M.METAL);
    b.crates(1, 62, 48, 6); b.shelf(1, 62, 64, 70, 66, 8);
    // ---- furniture 2F
    b.couch(2, 6, 14, 18, 20, M.FAB_BLUE, 'n'); b.box(2, 8, 2, 16, 3, 2, 5, M.SCREEN); b.table(2, 24, 20, 32, 28);
    b.bed(2, 44, 4, 54, 12, M.FAB_RED); b.shelf(2, 66, 2, 70, 14, 8); b.box(2, 60, 26, 70, 34, 0, 2, M.TRIM);
    b.box(2, 76, 4, 82, 6, 0, 2, M.METAL); b.box(2, 90, 20, 92, 22, 0, 8, M.FAB_RED); b.box(2, 84, 26, 98, 30, 0, 1, M.FAB_BLUE);
    b.box(2, 2, 60, 10, 66, 0, 2, M.WHITE); b.desk(2, 30, 60, 42, 64); b.shelf(2, 22, 46, 24, 70, 8); b.couch(2, 34, 46, 46, 50, M.FAB_RED, 's');
    b.box(2, 62, 46, 70, 47, 0, 8, M.METAL); b.box(2, 62, 64, 70, 70, 0, 4, M.CRATE);
    b.box(2, 76, 60, 100, 62, 0, 4, M.TRIM); b.box(2, 76, 60, 100, 62, 5, 7, M.GLASS); b.box(2, 86, 48, 90, 52, 0, 3, M.TRIM);
    // ---- outside
    b.cam(1, 22, 34, 160, 'DINER'); b.cam(2, 2, 40, -90, 'UPPER HALL'); b.cam(0, 2, 40, -90, 'LOWER HALL'); b.cam(1, 100, 68, 40, 'GARAGE');
    B.cam(100, 26, 30, 200, -14, 'LOT'); B.cam(150, 26, 140, 20, -14, 'YARD');
    B.box(100, 13, 30, 100, 25, 30, M.PIPE);
    B.box(150, 13, 140, 150, 25, 140, M.PIPE);
    B.car(40, 20, 'x', M.CAR_W); B.car(66, 26, 'x', M.CAR_K); B.car(120, 18, 'x', M.CAR_R); B.car(140, 30, 'z', M.CAR_W);
    B.obox(86, 22, 98, 26, 0, 1, M.CONCRETE); B.obox(88, 23, 89, 25, 2, 6, M.RED_PAINT); B.obox(95, 23, 96, 25, 2, 6, M.RED_PAINT); B.obox(84, 20, 100, 28, 12, 12, M.WHITE);
    for (const [x, z] of [[84, 20], [100, 20], [84, 28], [100, 28]]) B.obox(x, z, x, z, 0, 11, M.PIPE);
    B.truck(160, 70, 'z', M.CAR_W); B.container(176, 104, 'z', M.CONT_R, true); B.dumpster(156, 124);
    B.dumpster(36, 126); B.fence(30, 130, 30, 160, M.TRIM); B.fence(30, 160, 170, 160, M.TRIM);
    for (const [x, z] of [[10, 30], [16, 60], [4, 106], [20, 120], [12, 150], [60, 150], [90, 148], [130, 152], [188, 20], [190, 60], [184, 150], [6, 6]]) B.tree(x, z, 20 + (x % 5), true);
    B.lamp(30, 44); B.lamp(150, 44); B.lamp(170, 120);
    B.spawn('Parking Lot', 100, 12, 0); B.spawn('Pine Woods', 12, 86, -90); B.spawn('Loading Yard', 190, 96, 90); B.spawn('Back Road', 110, 150, 180);
    B.meta.bombs = [['Brewery', 'Cold Storage'], ['Kitchen', 'Back Office'], ['Living Room', 'Bedroom']];
    B.meta.secure = ['Bar Lounge', 'Boss Office', 'Cold Storage', 'Armory'];
    B.meta.hostage = ['Boss Office', 'Brewery', 'Bar Lounge', 'Trophy Room'];
    B.meta.defSpawns = ['Brewery', 'Kitchen', 'Bedroom'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ================================================================ SUMMIT LODGE */
  function lodge() {
    const B = new Builder('lodge', 'SUMMIT LODGE', 192, 56, 168);
    B.meta.desc = 'A log-and-stone ski lodge snowed in on the mountain. Overcast and cold.';
    B.theme(THEMES.snow);
    B.ground(M.SNOW);
    B.surf(70, 0, 120, 47, M.GRAVEL);
    const b = B.building(48, 48, 96, 72, { lo: 0, hi: 2, ext: M.LOGWALL, inner: M.LOGWALL, slab: M.WOODFLOOR, roof: M.ROOF });
    // B
    b.room(0, 'Boiler Room', 0, 0, 48, 36, { wall: M.CONCRETE });
    b.room(0, 'Wine Cellar', 48, 0, 95, 36, { wall: M.STONE });
    b.room(0, 'Ski Workshop', 0, 36, 48, 71, { wall: M.DRY_GREY });
    b.room(0, 'Cellar Storage', 48, 36, 95, 71, { wall: M.DRY_GREY });
    // 1F
    b.room(1, 'Great Room', 0, 0, 36, 44);
    b.room(1, 'Foyer', 36, 0, 60, 20, { wall: M.DRY_BEIGE });
    b.room(1, 'Dining Room', 60, 0, 95, 28, { wall: M.DRY_RED });
    b.room(1, 'Kitchen', 60, 28, 95, 48, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(1, 'Ski Lockers', 36, 20, 60, 44, { wall: M.DRY_BEIGE });
    b.room(1, 'Library', 0, 44, 32, 71, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(1, 'Trophy Hall', 32, 44, 60, 71);
    b.room(1, 'Mudroom', 60, 48, 95, 71, { wall: M.DRY_GREY, floor: M.TILE });
    // 2F
    b.room(2, 'Master Suite', 0, 0, 36, 36, { floor: M.CARPET });
    b.room(2, 'Study', 36, 0, 60, 20, { wall: M.DRY_SAGE });
    b.room(2, 'Guest Room', 60, 0, 95, 30, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, 'Landing', 36, 20, 60, 44);
    b.room(2, 'Billiards', 0, 36, 36, 71, { wall: M.DRY_RED });
    b.room(2, 'Bunk Room', 36, 44, 60, 71, { wall: M.DRY_BEIGE });
    b.room(2, 'Office', 60, 30, 95, 71, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    // stairs
    // both flights start 5 voxels clear of the south wall, so there's room to line up and climb
    b.stairs(1, 37, 26, '+z', 6); b.rail(2, 43, 25, 43, 37); b.rail(2, 37, 25, 42, 25);
    b.stairs(1, 62, 53, '+z', 5); b.rail(2, 67, 52, 67, 64); b.rail(2, 62, 52, 66, 52);
    b.stairs(0, 85, 66, '-z', 5); b.rail(1, 84, 55, 84, 66); b.rail(1, 90, 55, 90, 66); b.rail(1, 84, 67, 90, 67);
    // doors B
    b.doorX(0, 48, 14); b.doorZ(0, 36, 20); b.doorZ(0, 36, 64); b.doorZ(0, 36, 80); b.doorX(0, 48, 52);
    b.cellar('e', 44);
    // doors 1F
    b.doorZ(1, 0, 44, 8); b.doorX(1, 36, 6); b.doorX(1, 36, 38); b.doorX(1, 60, 8); b.doorZ(1, 20, 44, 8); b.doorZ(1, 44, 12); b.doorZ(1, 44, 50);
    b.doorZ(1, 28, 70); b.doorX(1, 60, 36); b.doorZ(1, 48, 72); b.doorX(1, 60, 65); b.doorX(1, 32, 56); b.doorZ(1, 71, 76); b.doorX(1, 95, 52); b.doorX(1, 0, 22);
    b.winZ(1, 0, 6, 6); b.winZ(1, 0, 22, 8); b.winZ(1, 0, 66, 6); b.winZ(1, 0, 82, 6);
    b.winX(1, 95, 8, 5); b.winX(1, 95, 18, 5); b.winX(1, 95, 34, 5); b.winX(1, 0, 4, 5); b.winX(1, 0, 32, 5); b.winX(1, 0, 52, 5); b.winX(1, 0, 62, 5);
    b.winZ(1, 71, 8, 5); b.winZ(1, 71, 20, 5); b.winZ(1, 71, 40, 5); b.winZ(1, 71, 50, 5);
    // doors 2F
    b.doorX(2, 36, 8); b.doorX(2, 36, 21); b.doorZ(2, 20, 46); b.doorX(2, 60, 8); b.doorX(2, 60, 24); b.doorX(2, 36, 38); b.doorZ(2, 44, 48);
    b.doorX(2, 60, 34); b.doorX(2, 60, 64); b.doorZ(2, 36, 16); b.doorX(2, 36, 58);
    b.winZ(2, 0, 8, 5); b.winZ(2, 0, 22, 5); b.winZ(2, 0, 44, 5); b.winZ(2, 0, 70, 5); b.winZ(2, 0, 84, 5);
    b.winX(2, 95, 10, 5); b.winX(2, 95, 44, 5); b.winX(2, 95, 60, 5); b.winX(2, 0, 48, 5); b.winX(2, 0, 12, 5);
    b.winZ(2, 71, 72, 5); b.winZ(2, 71, 86, 5); b.winZ(2, 71, 44, 5); b.winZ(2, 71, 10, 5); b.winZ(2, 71, 24, 5);
    b.hatch(2, 48, 8); b.hatch(2, 76, 40); b.hatch(1, 20, 30); b.hatch(1, 76, 14);
    // furniture
    b.fireplace(1, 2, 1, 10, 3, 18);
    b.couch(1, 10, 10, 22, 16, M.FAB_RED, 'e'); b.couch(1, 10, 24, 22, 30, M.FAB_RED, 'e'); b.table(1, 26, 16, 32, 26); b.box(1, 2, 36, 12, 42, 0, 0, M.FAB_RED);
    b.box(1, 40, 2, 44, 3, 0, 4, M.TRIM); b.box(1, 54, 2, 58, 6, 0, 6, M.WOOD);
    b.table(1, 66, 8, 88, 18); b.shelf(1, 62, 22, 70, 26, 5);
    b.counter(1, 62, 30, 92, 32); b.counter(1, 74, 38, 82, 42, M.METAL); b.counter(1, 90, 40, 94, 46, M.FRIDGE);
    b.box(1, 50, 24, 58, 25, 0, 8, M.METAL); b.box(1, 50, 34, 58, 35, 0, 8, M.METAL); b.box(1, 44, 40, 48, 42, 0, 1, M.TRIM);
    b.shelf(1, 1, 46, 3, 70, 9); b.shelf(1, 10, 60, 22, 62, 8); b.table(1, 12, 50, 20, 54); b.couch(1, 24, 64, 30, 70, M.FAB_BLUE, 'e');
    b.box(1, 34, 66, 58, 70, 0, 2, M.TRIM); b.box(1, 40, 52, 50, 56, 0, 3, M.TRIM);
    b.box(1, 70, 64, 80, 70, 0, 6, M.TRIM); b.box(1, 92, 62, 94, 70, 0, 3, M.WOOD);
    b.bed(2, 4, 4, 16, 14, M.FAB_RED); b.shelf(2, 24, 2, 34, 4, 7); b.couch(2, 20, 24, 30, 30, M.FAB_BLUE, 'n');
    b.desk(2, 40, 4, 48, 8); b.shelf(2, 52, 2, 58, 4, 8);
    b.bed(2, 66, 4, 76, 12, M.FAB_BLUE); b.bed(2, 82, 4, 92, 12, M.FAB_BLUE); b.box(2, 86, 20, 94, 28, 0, 6, M.TRIM);
    b.box(2, 10, 48, 22, 56, 0, 2, M.TRIM); b.box(2, 10, 48, 22, 56, 3, 3, M.FELT); b.shelf(2, 1, 60, 3, 70, 6); b.couch(2, 24, 64, 34, 70, M.FAB_RED, 'n');
    for (let i = 0; i < 3; i++) { b.box(2, 38 + i * 7, 60, 42 + i * 7, 70, 0, 1, M.TRIM); b.box(2, 38 + i * 7, 60, 42 + i * 7, 70, 5, 5, M.TRIM); }
    b.desk(2, 76, 54, 88, 60); b.shelf(2, 92, 32, 94, 50, 8); b.couch(2, 72, 34, 82, 38, M.FAB_RED, 's');
    b.box(0, 6, 6, 14, 16, 0, 8, M.BOILER); b.box(0, 20, 6, 26, 12, 0, 6, M.METAL); b.box(0, 9, 17, 10, 34, 9, 9, M.PIPE);
    for (let i = 0; i < 6; i++) b.box(0, 52 + i * 7, 2, 55 + i * 7, 8, 0, 8, M.TRIM);
    for (let i = 0; i < 4; i++) b.box(0, 56 + i * 9, 20, 60 + i * 9, 24, 0, 2, M.CRATE);
    b.table(0, 10, 50, 22, 56); b.box(0, 2, 40, 4, 70, 0, 7, M.TRIM); b.crates(0, 30, 58, 6);
    b.crates(0, 52, 40, 6); b.shelf(0, 52, 66, 76, 68, 8);
    b.cam(1, 4, 2, 150, 'GREAT ROOM'); b.cam(1, 58, 22, -150, 'LOCKERS'); b.cam(2, 38, 42, -40, 'LANDING'); b.cam(0, 50, 38, -130, 'STORAGE');
    B.cam(96, 24, 30, 180, -14, 'DRIVE'); B.cam(30, 26, 140, -40, -14, 'BACK');
    B.box(96, 13, 30, 96, 23, 30, M.PIPE); B.box(30, 13, 140, 30, 25, 140, M.PIPE);
    // outside
    B.car(76, 14, 'x', M.CAR_K); B.car(98, 22, 'x', M.CAR_R); B.car(110, 8, 'z', M.CAR_W);
    for (let i = 0; i < 3; i++) B.obox(20 + i * 8, 20, 24 + i * 8, 28, 0, 2, M.CAR_R);
    B.obox(150, 60, 160, 74, 0, 7, M.WOOD); B.obox(150, 75, 160, 90, 0, 12, M.LOGWALL); B.obox(151, 76, 159, 89, 0, 10, 0); B.obox(150, 80, 150, 84, 0, 8, 0);
    B.surf(60, 130, 120, 160, M.ICE);
    for (const [x, z] of [[8, 10], [20, 50], [10, 90], [24, 128], [8, 150], [50, 156], [130, 150], [170, 140], [182, 100], [176, 40], [160, 12], [180, 8], [134, 30], [40, 30], [140, 128]]) B.tree(x, z, 20 + (z % 7), true, true);
    B.sandbags(130, 40, 140, 42);
    B.lamp(66, 40); B.lamp(140, 44);
    B.spawn('Front Drive', 96, 10, 0); B.spawn('Ski Slope', 12, 70, -90); B.spawn('Woodshed', 176, 70, 90); B.spawn('Frozen Pond', 90, 150, 180);
    B.meta.bombs = [['Wine Cellar', 'Boiler Room'], ['Great Room', 'Library'], ['Master Suite', 'Billiards'], ['Dining Room', 'Kitchen']];
    B.meta.secure = ['Trophy Hall', 'Office', 'Wine Cellar', 'Study'];
    B.meta.hostage = ['Office', 'Library', 'Boiler Room', 'Guest Room'];
    B.meta.defSpawns = ['Wine Cellar', 'Great Room', 'Guest Room'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* =================================================================== HOMESTEAD */
  function homestead() {
    const B = new Builder('homestead', 'HOMESTEAD', 200, 56, 168);
    B.meta.desc = 'A family farm with a prepper bunker under the house and a hay barn across the yard. Afternoon.';
    B.theme(THEMES.farm);
    B.ground(M.GRASS);
    B.surf(30, 30, 196, 140, M.DIRT);
    const b = B.building(36, 52, 88, 64, { lo: 0, hi: 2, ext: M.SIDING, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    b.room(0, 'Root Cellar', 0, 0, 40, 40, { wall: M.STONE });
    b.room(0, 'Bunker', 40, 0, 87, 40, { wall: M.CONCRETE });
    b.room(0, 'Workshop', 0, 40, 40, 63, { wall: M.DRY_GREY });
    b.room(0, 'Furnace Room', 52, 40, 87, 63, { wall: M.DRY_GREY });
    b.room(1, 'Living Room', 0, 0, 36, 32, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(1, 'Dining Room', 36, 0, 60, 32, { wall: M.DRY_BEIGE });
    b.room(1, 'Kitchen', 60, 0, 87, 32, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(1, 'Main Hall', 0, 32, 87, 40);
    b.room(1, 'Pantry', 0, 40, 20, 63, { wall: M.DRY_WHITE });
    b.room(1, 'Laundry', 20, 40, 40, 63, { wall: M.DRY_BLUE, floor: M.TILE });
    b.room(1, 'Den', 52, 40, 87, 63, { wall: M.DRY_RED, floor: M.CARPET2 });
    b.room(2, 'Kids Room', 0, 0, 30, 32, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, 'Master Bedroom', 30, 0, 60, 32, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(2, 'Sewing Room', 60, 0, 87, 32, { wall: M.DRY_RED });
    b.room(2, 'Upper Hall', 0, 32, 87, 40);
    b.room(2, 'Bathroom', 0, 40, 20, 63, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(2, 'Study', 20, 40, 40, 63, { wall: M.DRY_SAGE });
    b.room(2, 'Guest Room', 52, 40, 87, 63, { wall: M.DRY_BEIGE, floor: M.CARPET });
    b.stairwell(40, 40, 63);
    b.doorX(0, 40, 18); b.doorZ(0, 40, 18); b.doorZ(0, 40, 66); b.doorX(0, 52, 58);
    b.cellar('w', 18);
    b.doorZ(1, 0, 14); b.doorX(1, 36, 12); b.doorX(1, 60, 12); b.doorZ(1, 32, 8); b.doorZ(1, 32, 46); b.doorZ(1, 32, 70);
    b.doorZ(1, 40, 6); b.doorZ(1, 40, 28); b.doorZ(1, 40, 66); b.doorX(1, 20, 50); b.doorX(1, 87, 16); b.doorX(1, 0, 34); b.doorZ(1, 63, 70); b.doorX(1, 87, 34);
    b.winZ(1, 0, 4, 5); b.winZ(1, 0, 24, 6); b.winZ(1, 0, 44, 6); b.winZ(1, 0, 66, 5); b.winZ(1, 0, 78, 5);
    b.winX(1, 0, 12, 5); b.winX(1, 0, 22, 4); b.winX(1, 0, 48, 4); b.winX(1, 87, 24, 5); b.winX(1, 87, 48, 5);
    b.winZ(1, 63, 6, 4); b.winZ(1, 63, 26, 5); b.winZ(1, 63, 58, 5); b.winZ(1, 63, 76, 5);
    b.doorX(2, 30, 14); b.doorX(2, 60, 14); b.doorZ(2, 32, 10); b.doorZ(2, 32, 42); b.doorZ(2, 32, 72); b.doorZ(2, 40, 8); b.doorZ(2, 40, 28); b.doorZ(2, 40, 66); b.doorX(2, 20, 52);
    for (const a of [4, 18, 36, 50, 66, 78]) b.winZ(2, 0, a, 5);
    b.winX(2, 0, 14, 5); b.winX(2, 0, 50, 4); b.winX(2, 87, 14, 5); b.winX(2, 87, 50, 5);
    b.winZ(2, 63, 6, 4); b.winZ(2, 63, 26, 5); b.winZ(2, 63, 60, 5); b.winZ(2, 63, 76, 5);
    b.hatch(2, 44, 16); b.hatch(2, 22, 50); b.hatch(1, 20, 20); b.hatch(1, 70, 20);
    // furniture
    b.box(0, 2, 2, 4, 38, 0, 7, M.TRIM); b.box(0, 2, 2, 4, 38, 1, 6, M.POT); b.crates(0, 20, 4, 4); b.box(0, 10, 26, 30, 28, 0, 3, M.CRATE);
    b.box(0, 44, 2, 85, 3, 0, 8, M.METAL); b.box(0, 50, 14, 58, 22, 0, 2, M.FAB_BLUE); b.box(0, 66, 10, 80, 14, 0, 3, M.METAL); b.crates(0, 70, 24, 6); b.desk(0, 46, 28, 54, 32);
    b.table(0, 10, 48, 26, 54); b.box(0, 2, 42, 4, 62, 0, 7, M.TRIM); b.box(0, 60, 46, 72, 54, 0, 7, M.BOILER); b.box(0, 66, 55, 67, 62, 8, 8, M.PIPE);
    b.couch(1, 4, 6, 16, 12, M.FAB_BLUE, 'w'); b.box(1, 22, 2, 30, 3, 2, 5, M.SCREEN); b.table(1, 18, 16, 26, 22); b.shelf(1, 30, 24, 34, 30, 7);
    b.table(1, 40, 10, 56, 20); b.shelf(1, 38, 2, 44, 3, 6);
    b.counter(1, 62, 2, 85, 4); b.counter(1, 70, 14, 78, 20, M.TRIM); b.counter(1, 82, 24, 85, 30, M.FRIDGE);
    b.shelf(1, 2, 44, 4, 62, 8); b.shelf(1, 8, 60, 18, 62, 8); b.box(1, 22, 54, 26, 58, 0, 3, M.WHITE); b.box(1, 28, 54, 32, 58, 0, 3, M.WHITE);
    b.couch(1, 60, 50, 74, 56, M.FAB_RED, 'n'); b.box(1, 78, 42, 85, 44, 0, 6, M.TRIM); b.table(1, 62, 44, 68, 47);
    b.bed(2, 4, 4, 12, 10, M.FAB_BLUE); b.bed(2, 16, 4, 24, 10, M.FAB_RED); b.crates(2, 20, 22, 2);
    b.bed(2, 40, 4, 52, 14, M.FAB_RED); b.box(2, 34, 24, 40, 30, 0, 7, M.TRIM);
    b.table(2, 66, 10, 78, 16); b.shelf(2, 82, 2, 85, 20, 7);
    b.box(2, 2, 50, 8, 60, 0, 2, M.WHITE); b.desk(2, 24, 52, 34, 58); b.shelf(2, 22, 42, 38, 44, 8);
    b.bed(2, 60, 48, 70, 56, M.FAB_BLUE); b.box(2, 80, 52, 85, 60, 0, 7, M.TRIM);
    // barn
    const barn = B.building(148, 60, 44, 56, { lo: 1, hi: 2, ext: M.CORRUGATE, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.RUST });
    barn.room(1, 'Barn Floor', 0, 0, 43, 55);
    barn.void(2, 1, 1, 42, 30);
    barn.room(2, 'Hayloft', 0, 30, 43, 55, { skip: 's' });
    barn.rail(2, 7, 31, 42, 31);
    barn.stairs(1, 2, 19, '+z', 5);
    barn.doorZ(1, 0, 14, 16, 10); barn.doorZ(1, 55, 14, 16, 10); barn.doorX(1, 0, 40); barn.doorX(1, 43, 20, 6);
    barn.winZ(2, 55, 8, 5, false); barn.winZ(2, 55, 30, 5, false); barn.winX(2, 0, 40, 6, false); barn.winX(2, 43, 44, 6, false);
    for (let i = 0; i < 5; i++) barn.box(2, 6 + i * 7, 40, 10 + i * 7, 46, 0, 3, M.HAY);
    barn.box(1, 30, 36, 42, 54, 0, 3, M.HAY); barn.box(1, 30, 40, 42, 50, 4, 7, M.HAY);
    for (let i = 0; i < 3; i++) barn.box(1, 2, 32 + i * 8, 10, 33 + i * 8, 0, 5, M.WOOD);
    B.obox(160, 74, 172, 82, 1, 4, M.CONT_G); B.obox(161, 75, 167, 81, 5, 9, M.CONT_G); B.obox(162, 76, 166, 80, 6, 8, M.GLASS);
    B.obox(158, 72, 160, 74, 0, 2, M.TIRE); B.obox(172, 72, 174, 74, 0, 2, M.TIRE); B.obox(158, 82, 160, 84, 0, 2, M.TIRE); B.obox(172, 82, 174, 84, 0, 2, M.TIRE);
    // yard
    const silo = [176, 140];
    for (let y = 0; y < 40; y++) for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
      const d = dx * dx + dz * dz; if (d > 81 || (d < 64 && y > 0)) continue;
      B.w.put(silo[0] + dx, GY + 1 + y, silo[1] + dz, y > 36 ? M.RUST : M.METAL);
    }
    B.obox(176, 131, 177, 131, 0, 9, 0);
    B.fence(30, 40, 30, 160, M.TRIM); B.fence(30, 160, 196, 160, M.TRIM);
    for (let x = 34; x < 140; x += 5) for (let z = 4; z < 30; z += 3) if (U.hash3(x, 0, z) > 0.15) B.obox(x, z, x, z, 0, 7, M.LEAF);
    for (const [x, z] of [[132, 40], [140, 46], [130, 130], [118, 140]]) B.obox(x, z, x + 4, z + 4, 0, 3, M.HAY);
    B.obox(134, 100, 138, 104, 0, 3, M.STONE); B.obox(135, 101, 137, 103, 0, 3, 0);
    for (const [x, z] of [[8, 20], [14, 70], [8, 120], [20, 150], [60, 150], [96, 150], [190, 30], [196, 120], [110, 20], [10, 46]]) B.tree(x, z, 16 + (x % 4));
    B.car(40, 34, 'x', M.CAR_R); B.truck(110, 60, 'z', M.CAR_W);
    b.cam(1, 2, 2, 135, 'LIVING'); b.cam(1, 86, 34, 90, 'MAIN HALL'); b.cam(2, 86, 34, 90, 'UPPER HALL'); b.cam(0, 42, 2, 135, 'BUNKER');
    B.cam(140, 26, 50, 230, -14, 'YARD'); B.box(140, 13, 50, 140, 25, 50, M.PIPE);
    B.spawn('Cornfield', 80, 10, 0); B.spawn('Creek Road', 6, 96, -90); B.spawn('Silo', 186, 146, 135); B.spawn('Orchard', 70, 152, 180);
    B.meta.bombs = [['Root Cellar', 'Bunker'], ['Kitchen', 'Dining Room'], ['Master Bedroom', 'Kids Room']];
    B.meta.secure = ['Den', 'Guest Room', 'Bunker', 'Hayloft'];
    B.meta.hostage = ['Bunker', 'Master Bedroom', 'Den', 'Study'];
    B.meta.defSpawns = ['Bunker', 'Den', 'Kids Room'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ================================================================== CHECKPOINT */
  function checkpoint() {
    const B = new Builder('checkpoint', 'CHECKPOINT', 200, 56, 164);
    B.meta.desc = 'A desert border inspection station with a double-height customs hall. High noon.';
    B.theme(THEMES.desert);
    B.ground(M.SAND);
    B.surf(0, 0, 199, 44, M.ASPHALT);
    for (let z = 6; z < 44; z += 12) for (let x = 0; x < 200; x += 8) B.surf(x, z, x + 4, z, M.LINE);
    B.surf(0, 124, 199, 163, M.ASPHALT);
    const b = B.building(44, 52, 112, 64, { lo: 1, hi: 2, ext: M.STUCCO, inner: M.DRY_WHITE, slab: M.TILE, roof: M.ROOF });
    b.room(1, 'Customs Hall', 0, 0, 48, 63, { floor: M.TILE });
    b.room(1, 'Detention', 48, 0, 72, 24, { wall: M.DRY_GREY });
    b.room(1, 'Interrogation', 72, 0, 90, 24, { wall: M.DRY_GREY });
    b.room(1, 'Armory', 90, 0, 111, 24, { wall: M.DRY_BLUE });
    b.room(1, 'Corridor', 48, 24, 111, 32);
    b.room(1, 'Offices', 48, 32, 76, 63, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    b.room(1, 'Break Room', 76, 32, 99, 63, { wall: M.DRY_SAGE });
    b.void(2, 1, 1, 35, 62);
    b.room(2, 'Balcony', 36, 0, 48, 63, { skip: 'w' });
    b.rail(2, 36, 1, 36, 62);
    b.room(2, 'Comms Room', 48, 0, 72, 24, { wall: M.DRY_GREY });
    b.room(2, 'Supervisor Office', 72, 0, 111, 24, { wall: M.DRY_BLUE, floor: M.CARPET });
    b.room(2, 'Upper Corridor', 48, 24, 111, 32);
    b.room(2, 'Briefing Room', 48, 32, 80, 63, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    b.room(2, 'Locker Room', 80, 32, 99, 63, { wall: M.DRY_GREY });
    b.stairwell(99, 32, 63);
    b.stairs(1, 40, 4, '+z', 6); b.rail(2, 39, 3, 39, 15); b.rail(2, 46, 3, 46, 15); b.rail(2, 39, 3, 46, 3);
    b.doorZ(1, 0, 14, 8); b.doorZ(1, 63, 14, 8); b.doorX(1, 48, 10); b.doorX(1, 48, 26); b.doorX(1, 48, 44); b.doorX(1, 72, 8);
    b.doorZ(1, 24, 58); b.doorZ(1, 24, 78); b.doorZ(1, 24, 98); b.doorZ(1, 32, 60); b.doorZ(1, 32, 84); b.doorX(1, 111, 26); b.doorZ(1, 63, 84); b.doorX(1, 76, 50);
    b.winZ(1, 0, 4, 6); b.winZ(1, 0, 26, 6); b.winZ(1, 0, 56, 4); b.winZ(1, 0, 78, 4); b.winX(1, 0, 20, 6); b.winX(1, 0, 40, 6);
    b.winZ(1, 63, 30, 6); b.winZ(1, 63, 54, 5); b.winZ(1, 63, 66, 5); b.winZ(1, 63, 78, 4); b.winZ(1, 63, 92, 4); b.winX(1, 111, 8, 5);
    b.doorX(2, 48, 10); b.doorX(2, 48, 26); b.doorX(2, 48, 44); b.doorX(2, 72, 14); b.doorZ(2, 24, 58); b.doorZ(2, 24, 88);
    b.doorZ(2, 32, 60); b.doorZ(2, 32, 72); b.doorZ(2, 32, 86); b.doorX(2, 80, 50);
    b.winZ(2, 0, 54, 5); b.winZ(2, 0, 64, 5); b.winZ(2, 0, 80, 6); b.winZ(2, 0, 96, 6); b.winX(2, 111, 8, 6);
    b.winZ(2, 63, 54, 6); b.winZ(2, 63, 68, 6); b.winZ(2, 63, 86, 5); b.winX(2, 0, 20, 6); b.winX(2, 0, 40, 6); b.winZ(2, 0, 4, 6); b.winZ(2, 0, 26, 6);
    b.hatch(2, 84, 12); b.hatch(2, 60, 48); b.hatch(2, 56, 12);
    // furniture
    for (let i = 0; i < 3; i++) { b.counter(1, 6 + i * 10, 26, 12 + i * 10, 28, M.TRIM); b.box(1, 6 + i * 10, 26, 12 + i * 10, 28, 4, 6, M.GLASS); }
    b.box(1, 4, 44, 30, 46, 0, 1, M.METAL); b.box(1, 2, 54, 6, 60, 0, 4, M.CRATE); b.box(1, 22, 6, 30, 10, 0, 3, M.METAL);
    // cell bars stop short of the corridor wall, leaving a walkway into every cell
    for (let i = 0; i < 3; i++) { b.box(1, 50 + i * 7, 2, 50 + i * 7, 17, 0, 9, M.RAIL); }
    b.box(1, 65, 2, 68, 8, 0, 1, M.FAB_BLUE); b.table(1, 78, 8, 84, 14, M.METAL);
    b.box(1, 92, 2, 110, 3, 0, 8, M.METAL); b.box(1, 92, 12, 98, 16, 0, 3, M.CRATE); b.box(1, 104, 12, 110, 16, 0, 3, M.CRATE);
    b.desk(1, 52, 40, 58, 44); b.desk(1, 64, 40, 70, 44); b.desk(1, 52, 52, 58, 56); b.shelf(1, 72, 34, 74, 60, 8);
    b.table(1, 80, 42, 90, 50); b.counter(1, 78, 58, 96, 61); b.counter(1, 96, 34, 97, 40, M.FRIDGE);
    b.rack(2, 52, 2, 54, 20); b.rack(2, 58, 2, 60, 20); b.desk(2, 64, 12, 70, 18);
    b.desk(2, 90, 8, 102, 14); b.shelf(2, 106, 2, 110, 20, 8); b.couch(2, 76, 2, 86, 6, M.FAB_BLUE, 's');
    b.table(2, 56, 42, 74, 52); b.box(2, 50, 34, 78, 35, 3, 7, M.WHITE);
    for (let i = 0; i < 3; i++) b.box(2, 82 + i * 6, 61, 85 + i * 6, 62, 0, 8, M.METAL);
    b.cam(1, 2, 2, 135, 'CUSTOMS'); b.cam(1, 110, 30, 90, 'CORRIDOR'); b.cam(2, 110, 30, 90, 'UPPER CORRIDOR'); b.cam(2, 46, 62, 0, 'BALCONY');
    // lanes, canopy, booths
    for (const [x, z] of [[30, 6], [90, 6], [150, 6], [30, 38], [90, 38], [150, 38]]) B.obox(x, z, x + 1, z + 1, 0, 14, M.CONCRETE);
    B.obox(28, 4, 154, 40, 15, 15, M.METAL);
    for (const x of [56, 116]) { B.obox(x, 18, x + 6, 24, 0, 8, M.STUCCO); B.obox(x + 1, 19, x + 5, 23, 0, 7, 0); B.obox(x, 18, x + 6, 24, 4, 6, (xx, y, z, c) => c ? M.GLASS : -1); B.obox(x + 3, 18, x + 3, 18, 0, 6, 0); }
    B.car(20, 10, 'x', M.CAR_W); B.car(66, 28, 'x', M.CAR_R); B.truck(96, 9, 'x', M.CAR_K); B.car(132, 30, 'x', M.CAR_K);
    B.barrier(10, 46, 30, 47); B.barrier(60, 46, 80, 47); B.barrier(120, 46, 140, 47); B.barrier(170, 70, 171, 90);
    B.container(164, 100, 'z', M.CONT_B, true); B.container(178, 64, 'z', M.CONT_R); B.container(10, 70, 'z', M.CONT_G, true);
    B.fence(0, 120, 64, 120); B.fence(84, 120, 124, 120); B.fence(144, 120, 199, 120); B.sandbags(30, 126, 40, 128); B.sandbags(150, 126, 160, 128);
    B.obox(18, 100, 19, 101, 0, 30, M.PIPE); B.obox(20, 92, 20, 99, 22, 28, M.BLUE_PAINT);
    for (const [x, z] of [[4, 140], [60, 150], [130, 156], [190, 140]]) B.obox(x, z, x + 4, z + 3, 0, 2, M.STONE);
    B.cam(100, 27, 20, 180, -14, 'LANES'); B.cam(180, 25, 130, 40, -14, 'NORTH');
    // Vehicle Lanes sits in the open just past the truck's tail (the truck covers x 96-125, z 9-17)
    B.spawn('Vehicle Lanes', 136, 12, 0); B.spawn('Truck Yard', 190, 84, 90); B.spawn('Riverbank', 100, 154, 180); B.spawn('Dry Wash', 8, 92, -90);
    B.meta.bombs = [['Armory', 'Interrogation'], ['Offices', 'Break Room'], ['Supervisor Office', 'Comms Room'], ['Briefing Room', 'Locker Room']];
    B.meta.secure = ['Detention', 'Supervisor Office', 'Briefing Room', 'Armory'];
    B.meta.hostage = ['Detention', 'Comms Room', 'Offices', 'Locker Room'];
    B.meta.defSpawns = ['Armory', 'Offices', 'Briefing Room'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ================================================================== HELIX LABS */
  function helix() {
    const B = new Builder('helix', 'HELIX LABS', 196, 56, 168);
    B.meta.desc = 'An island research campus: glass, white corridors and a specimen vault below. Night.';
    B.theme(THEMES.night);
    B.ground(M.GRASS, M.DIRT);
    B.surf(0, 0, 40, 167, M.SAND);
    B.surf(40, 0, 195, 46, M.DOCK);
    B.surf(140, 46, 195, 167, M.DOCK);
    const b = B.building(46, 48, 104, 72, { lo: 0, hi: 2, ext: M.FACADE, inner: M.LAB_WHITE, slab: M.LAB_FLOOR, roof: M.ROOF });
    b.room(0, 'Generator Hall', 0, 0, 32, 40, { wall: M.CONCRETE });
    b.room(0, 'Specimen Vault', 32, 0, 72, 40, { wall: M.DRY_GREY });
    b.room(0, 'Maintenance Tunnel', 72, 0, 103, 71, { wall: M.CONCRETE });
    b.room(0, 'Data Archive', 0, 40, 32, 71, { wall: M.DRY_GREY });
    b.room(0, 'Pump Room', 44, 40, 72, 71, { wall: M.DRY_GREY });
    b.room(1, 'Cafeteria', 0, 0, 36, 32);
    b.room(1, 'Atrium', 36, 0, 68, 32, { wall: M.PANEL_DARK });
    b.room(1, 'Exhibit Hall', 68, 0, 103, 32, { wall: M.PANEL_DARK });
    b.room(1, 'Main Hall', 0, 32, 103, 40);
    b.room(1, 'Clean Room', 0, 40, 32, 71);
    b.room(1, 'Cryo Lab', 44, 40, 72, 71, { wall: M.DRY_BLUE });
    b.room(1, 'Security Office', 72, 40, 103, 71, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    b.room(2, 'Server Farm', 0, 0, 36, 32, { wall: M.PANEL_DARK });
    b.room(2, 'Observation Deck', 36, 0, 68, 32);
    b.room(2, "Director's Suite", 68, 0, 103, 32, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(2, 'Upper Hall', 0, 32, 103, 40);
    b.room(2, 'Genetics Lab', 0, 40, 32, 71);
    b.room(2, 'Containment', 44, 40, 72, 71, { wall: M.DRY_GREY });
    b.room(2, 'Conference', 72, 40, 103, 71, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    b.stairwell(32, 40, 71);
    b.doorX(0, 32, 16); b.doorX(0, 72, 14); b.doorZ(0, 40, 12); b.doorZ(0, 40, 56); b.doorX(0, 72, 52); b.doorX(0, 44, 60);
    b.cellar('e', 30);
    b.doorZ(1, 0, 48, 8); b.doorX(1, 36, 12, 8); b.doorX(1, 68, 12); b.doorZ(1, 32, 14); b.doorZ(1, 32, 48, 8); b.doorZ(1, 32, 84); b.doorZ(1, 40, 12);
    b.doorZ(1, 40, 54); b.doorZ(1, 40, 84); b.doorX(1, 72, 56); b.doorX(1, 0, 20); b.doorX(1, 103, 50); b.doorX(1, 103, 34); b.doorX(1, 0, 34);
    b.winZ(1, 40, 20, 8); b.winZ(1, 0, 6, 6); b.winZ(1, 0, 20, 8); b.winZ(1, 0, 38, 8); b.winZ(1, 0, 58, 8); b.winZ(1, 0, 74, 6); b.winZ(1, 0, 88, 8);
    b.winX(1, 0, 6, 6); b.winX(1, 103, 8, 6); b.winX(1, 103, 20, 6);
    b.winZ(1, 71, 8, 6); b.winZ(1, 71, 50, 6); b.winZ(1, 71, 80, 6); b.winZ(1, 71, 92, 6);
    b.doorX(2, 36, 14); b.doorX(2, 68, 14); b.doorZ(2, 32, 16); b.doorZ(2, 32, 48); b.doorZ(2, 32, 58); b.doorZ(2, 32, 84); b.doorZ(2, 40, 14); b.doorZ(2, 40, 54); b.doorZ(2, 40, 86); b.doorX(2, 72, 56);
    b.winZ(2, 0, 8, 6); b.winZ(2, 0, 22, 6); b.winZ(2, 0, 40, 24); b.winZ(2, 0, 74, 6); b.winZ(2, 0, 90, 6);
    b.winX(2, 103, 10, 6); b.winX(2, 103, 50, 6); b.winX(2, 0, 10, 6); b.winX(2, 0, 50, 6);
    b.winZ(2, 71, 8, 6); b.winZ(2, 71, 20, 6); b.winZ(2, 71, 52, 8); b.winZ(2, 71, 80, 6); b.winZ(2, 71, 94, 4); b.winZ(2, 40, 62, 6);
    b.hatch(2, 50, 12); b.hatch(2, 58, 56); b.hatch(1, 50, 20); b.hatch(1, 16, 56);
    // furniture
    b.box(0, 4, 4, 14, 14, 0, 7, M.METAL); b.box(0, 18, 4, 28, 14, 0, 7, M.METAL); b.box(0, 9, 15, 10, 38, 8, 8, M.PIPE); b.box(0, 4, 28, 10, 36, 0, 3, M.CRATE);
    for (let i = 0; i < 4; i++) b.box(0, 36 + i * 9, 6, 40 + i * 9, 10, 0, 5, M.GLASS);
    b.box(0, 36, 24, 68, 26, 0, 3, M.METAL); b.box(0, 46, 34, 60, 36, 0, 7, M.METAL);
    b.box(0, 80, 6, 82, 64, 9, 9, M.PIPE); b.crates(0, 90, 50, 6); b.box(0, 86, 10, 100, 14, 0, 4, M.METAL);
    b.shelf(0, 2, 44, 4, 70, 9); b.rack(0, 10, 50, 12, 66); b.rack(0, 18, 50, 20, 66);
    b.tank(0, 54, 54, 4, 8, M.PIPE); b.box(0, 62, 46, 70, 50, 0, 4, M.METAL);
    for (let i = 0; i < 3; i++) b.table(1, 6 + i * 10, 8 + (i % 2) * 8, 12 + i * 10, 14 + (i % 2) * 8, M.WHITE); b.counter(1, 2, 26, 30, 28);
    b.counter(1, 46, 14, 58, 18, M.PANEL_DARK); b.box(1, 50, 15, 54, 17, 4, 4, M.NEON_B); b.box(1, 40, 2, 41, 2, 0, 7, M.LEAF);
    b.box(1, 78, 10, 84, 16, 0, 4, M.GLASS); b.box(1, 90, 14, 96, 20, 0, 4, M.GLASS); b.box(1, 80, 12, 82, 14, 0, 2, M.NEON_P);
    b.box(1, 4, 46, 28, 48, 0, 3, M.METAL); b.box(1, 4, 58, 28, 60, 0, 3, M.METAL); b.box(1, 10, 66, 14, 70, 0, 8, M.METAL);
    for (let i = 0; i < 3; i++) b.box(1, 48 + i * 8, 62, 52 + i * 8, 68, 0, 7, M.METAL); b.counter(1, 46, 44, 70, 46, M.WHITE);
    b.desk(1, 76, 46, 86, 50); b.box(1, 90, 64, 102, 70, 2, 7, M.SCREEN); b.box(1, 90, 62, 102, 63, 0, 3, M.COUNTER); b.shelf(1, 100, 42, 102, 56, 8);
    for (let i = 0; i < 4; i++) b.rack(2, 4 + i * 8, 6, 6 + i * 8, 26);
    b.couch(2, 42, 20, 52, 24, M.FAB_BLUE, 'n'); b.couch(2, 56, 20, 66, 24, M.FAB_BLUE, 'n'); b.box(2, 38, 2, 66, 3, 0, 2, M.RAIL);
    b.desk(2, 78, 10, 90, 16); b.shelf(2, 98, 2, 102, 26, 8); b.couch(2, 72, 24, 82, 30, M.FAB_RED, 'n');
    b.counter(2, 4, 48, 28, 50, M.WHITE); b.counter(2, 4, 58, 28, 60, M.WHITE); b.box(2, 6, 49, 7, 49, 4, 5, M.NEON_B);
    b.box(2, 50, 52, 66, 62, 0, 9, M.GLASS); b.box(2, 51, 53, 65, 61, 0, 9, 0); b.box(2, 56, 56, 60, 58, 0, 2, M.NEON_P);
    b.table(2, 78, 50, 98, 60, M.TRIM); b.box(2, 76, 42, 100, 43, 3, 7, M.SCREEN);
    b.cam(1, 66, 2, -140, 'ATRIUM'); b.cam(1, 2, 34, -90, 'MAIN HALL'); b.cam(2, 102, 34, 90, 'UPPER HALL'); b.cam(0, 70, 2, -135, 'VAULT');
    // outside
    for (let a = 0; a < 64; a++) { const r = 14, t = a / 64 * Math.PI * 2; B.surf(100 + Math.round(Math.cos(t) * r), 22 + Math.round(Math.sin(t) * r), 100 + Math.round(Math.cos(t) * r), 22 + Math.round(Math.sin(t) * r), M.LINE); }
    B.surf(94, 15, 95, 29, M.WHITE); B.surf(105, 15, 106, 29, M.WHITE); B.surf(95, 21, 105, 22, M.WHITE);
    for (const [x, z] of [[56, 40], [140, 40], [44, 130], [150, 130], [170, 80], [24, 60]]) B.lamp(x, z, 16, M.NEON_B);
    for (const [x, z] of [[10, 20], [20, 52], [8, 90], [24, 120], [12, 150], [60, 140], [100, 150], [180, 156], [186, 20]]) B.tree(x, z, 16);
    B.container(160, 60, 'z', M.CONT_B); B.container(176, 96, 'z', M.CONT_G, true); B.container(150, 140, 'x', M.CONT_R, true);
    B.obox(60, 130, 74, 140, 0, 6, M.METAL); B.obox(80, 132, 88, 138, 0, 4, M.METAL);
    B.fence(40, 160, 195, 160, M.FENCE);
    B.obox(44, 47, 152, 47, 25, 25, M.NEON_B);
    B.cam(60, 26, 24, 160, -14, 'HELIPAD'); B.cam(170, 25, 120, 40, -14, 'CARGO');
    B.box(60, 13, 24, 60, 25, 24, M.PIPE); B.box(170, 13, 120, 170, 24, 120, M.PIPE);
    B.spawn('Helipad', 100, 9, 0); B.spawn('Pier', 10, 100, -90); B.spawn('Cliff Path', 188, 90, 90); B.spawn('Cargo Lot', 110, 154, 180);
    B.meta.bombs = [['Specimen Vault', 'Generator Hall'], ['Cryo Lab', 'Security Office'], ['Server Farm', 'Observation Deck'], ['Containment', 'Conference']];
    B.meta.secure = ['Clean Room', 'Containment', 'Specimen Vault', "Director's Suite"];
    B.meta.hostage = ['Security Office', 'Genetics Lab', 'Pump Room', "Director's Suite"];
    B.meta.defSpawns = ['Generator Hall', 'Security Office', "Director's Suite"];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ===================================================================== CANNERY */
  function cannery() {
    const B = new Builder('cannery', 'CANNERY', 200, 56, 168);
    B.meta.desc = 'A brick fish cannery on the harbour quay, with an ice plant and cold stores below. Foggy morning.';
    B.theme(THEMES.harbor);
    B.ground(M.DOCK);
    B.surf(0, 46, 40, 167, M.GRAVEL); B.surf(160, 46, 199, 167, M.GRAVEL); B.surf(40, 128, 160, 167, M.GRAVEL);
    const b = B.building(48, 50, 104, 72, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_WHITE, slab: M.WOODFLOOR, roof: M.ROOF });
    // ---- B
    b.room(0, 'Cold Storage', 0, 0, 40, 36, { wall: M.DRY_GREY });
    b.room(0, 'Ice Plant', 40, 0, 72, 36, { wall: M.DRY_GREY });
    b.room(0, 'Pump Room', 72, 0, 103, 36, { wall: M.CONCRETE });
    b.room(0, 'Lower Corridor', 0, 36, 103, 44, { wall: M.DRY_GREY });
    b.room(0, 'Brine Tanks', 0, 44, 36, 71, { wall: M.CONCRETE });
    b.room(0, 'Net Store', 48, 44, 76, 71, { wall: M.DRY_GREY });
    b.room(0, 'Boiler Room', 76, 44, 103, 71, { wall: M.CONCRETE });
    // ---- 1F
    b.room(1, 'Processing Floor', 0, 0, 52, 44, { floor: M.TILE });
    b.room(1, 'Canning Line', 52, 0, 80, 36, { floor: M.TILE });
    b.room(1, 'Loading Bay', 80, 0, 103, 44, { wall: M.DRY_GREY, floor: M.CONCRETE });
    b.room(1, 'Hallway', 52, 36, 80, 44, { wall: M.DRY_BEIGE });
    b.room(1, 'Locker Room', 0, 44, 20, 71, { wall: M.DRY_BLUE, floor: M.TILE });
    b.room(1, 'Break Room', 20, 44, 36, 71, { wall: M.DRY_SAGE });
    b.room(1, 'Shipping Office', 48, 44, 76, 71, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    b.room(1, 'Cooler', 76, 44, 103, 71, { wall: M.DRY_GREY, floor: M.TILE });
    // ---- 2F: the processing floor rises through both storeys, with a catwalk along its east side
    b.void(2, 1, 1, 39, 43);
    b.room(2, 'Catwalk', 40, 0, 52, 44, { skip: 'w' });
    b.rail(2, 40, 1, 40, 43);
    b.room(2, 'Foreman Office', 52, 0, 80, 36, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(2, 'Radio Room', 80, 0, 103, 36, { wall: M.DRY_GREY });
    b.room(2, 'Upper Hall', 52, 36, 103, 44, { wall: M.DRY_BEIGE });
    b.room(2, 'Canteen', 0, 44, 36, 71, { wall: M.DRY_RED, floor: M.TILE });
    b.room(2, "Owner's Office", 48, 44, 76, 71, { wall: M.DRY_BLUE, floor: M.CARPET });
    b.room(2, 'Storage Loft', 76, 44, 103, 71, { wall: M.DRY_GREY });
    b.stairwell(36, 44, 71);
    b.stairs(1, 44, 4, '+z', 6); b.rail(2, 43, 3, 43, 15); b.rail(2, 50, 3, 50, 15); b.rail(2, 43, 3, 50, 3);
    // ---- doors B
    b.doorZ(0, 36, 16); b.doorZ(0, 36, 56); b.doorZ(0, 36, 86); b.doorX(0, 40, 10); b.doorX(0, 72, 24);
    b.doorZ(0, 44, 14); b.doorZ(0, 44, 60); b.doorZ(0, 44, 90); b.doorX(0, 76, 58);
    b.cellar('w', 20);
    // ---- doors 1F
    b.doorZ(1, 0, 20, 6); b.doorZ(1, 0, 64); b.doorX(1, 0, 30); b.doorZ(1, 71, 8); b.doorZ(1, 71, 60); b.doorX(1, 103, 36);
    b.shutterX(1, 103, 14, 16);
    b.doorX(1, 52, 20, 6); b.doorX(1, 52, 38); b.doorZ(1, 36, 66); b.doorX(1, 80, 20, 6); b.doorX(1, 80, 38);
    b.doorZ(1, 44, 10); b.doorZ(1, 44, 26); b.doorZ(1, 44, 60); b.doorZ(1, 44, 88); b.doorX(1, 76, 56); b.doorX(1, 20, 56);
    b.winZ(1, 0, 6, 6); b.winZ(1, 0, 32, 6); b.winZ(1, 0, 56, 5); b.winZ(1, 0, 72, 5); b.winZ(1, 0, 88, 6);
    b.winX(1, 0, 8, 5); b.winX(1, 0, 18, 4); b.winX(1, 0, 52, 5); b.winX(1, 0, 62, 5);
    b.winZ(1, 71, 24, 5); b.winZ(1, 71, 52, 5); b.winZ(1, 71, 84, 5); b.winZ(1, 71, 94, 5);
    b.winX(1, 103, 4, 5); b.winX(1, 103, 54, 5); b.winX(1, 103, 64, 5);
    // ---- doors 2F
    b.doorX(2, 52, 20); b.doorX(2, 52, 38); b.doorZ(2, 36, 64); b.doorZ(2, 36, 90); b.doorX(2, 80, 14);
    b.doorX(2, 36, 62); b.doorZ(2, 44, 60); b.doorX(2, 76, 58); b.doorZ(2, 44, 90); b.doorX(2, 48, 64);
    b.winZ(2, 0, 8, 6); b.winZ(2, 0, 24, 6); b.winZ(2, 0, 45, 4); b.winZ(2, 0, 58, 5); b.winZ(2, 0, 70, 5); b.winZ(2, 0, 86, 5); b.winZ(2, 0, 96, 5);
    b.winX(2, 0, 12, 6); b.winX(2, 0, 28, 6); b.winX(2, 0, 52, 5); b.winX(2, 0, 64, 5);
    b.winZ(2, 71, 8, 5); b.winZ(2, 71, 22, 5); b.winZ(2, 71, 56, 5); b.winZ(2, 71, 66, 5); b.winZ(2, 71, 84, 5); b.winZ(2, 71, 94, 5);
    b.winX(2, 103, 10, 5); b.winX(2, 103, 24, 5); b.winX(2, 103, 54, 5); b.winX(2, 103, 64, 5);
    b.winZ(2, 44, 6, 8); b.winZ(2, 44, 20, 8);   // the canteen looks down over the processing floor
    b.hatch(2, 64, 16); b.hatch(2, 86, 58); b.hatch(2, 26, 60); b.hatch(1, 58, 22); b.hatch(1, 90, 52);
    // ---- furniture B
    b.shelf(0, 2, 2, 38, 3, 8); b.crates(0, 8, 10, 6); b.box(0, 24, 22, 34, 24, 0, 6, M.FRIDGE); b.box(0, 26, 8, 34, 14, 0, 2, M.ICE);
    b.tank(0, 50, 8, 3, 8, M.METAL); b.tank(0, 64, 8, 3, 8, M.METAL); b.box(0, 44, 26, 52, 30, 0, 3, M.ICE); b.box(0, 46, 18, 68, 18, 9, 9, M.PIPE);
    b.box(0, 78, 6, 86, 12, 0, 5, M.BOILER); b.box(0, 92, 6, 100, 12, 0, 5, M.BOILER); b.box(0, 76, 20, 100, 20, 9, 9, M.PIPE); b.crates(0, 90, 22, 4);
    b.box(0, 2, 38, 100, 38, 10, 10, M.PIPE);
    b.tank(0, 8, 56, 4, 7, M.METAL); b.tank(0, 24, 62, 4, 7, M.METAL); b.box(0, 14, 66, 19, 69, 0, 3, M.CRATE);
    b.crates(0, 54, 52, 4); b.box(0, 52, 62, 62, 68, 0, 2, M.FAB_BLUE); b.shelf(0, 66, 48, 74, 49, 7);
    b.box(0, 82, 56, 92, 66, 0, 8, M.BOILER); b.box(0, 86, 46, 87, 55, 9, 9, M.PIPE);
    // ---- furniture 1F
    b.box(1, 6, 10, 34, 12, 0, 3, M.METAL); b.box(1, 6, 22, 34, 24, 0, 3, M.METAL);
    for (let i = 0; i < 4; i++) { b.box(1, 8 + i * 7, 11, 10 + i * 7, 11, 4, 4, M.WHITE); b.box(1, 9 + i * 7, 23, 11 + i * 7, 23, 4, 4, M.WHITE); }
    b.table(1, 8, 32, 16, 36, M.METAL); b.table(1, 22, 32, 30, 36, M.METAL); b.box(1, 38, 26, 42, 32, 0, 6, M.BOILER); b.box(1, 2, 2, 8, 6, 0, 4, M.CRATE);
    b.box(1, 56, 6, 72, 8, 0, 3, M.METAL); b.box(1, 57, 7, 71, 7, 4, 4, M.PIPE); b.box(1, 56, 26, 62, 31, 0, 6, M.METAL); b.crates(1, 68, 10, 4);
    b.crates(1, 88, 28, 4); b.box(1, 90, 6, 94, 12, 0, 4, M.LINE); b.box(1, 90, 13, 94, 14, 0, 0, M.METAL);
    b.box(1, 6, 52, 12, 53, 0, 7, M.METAL); b.box(1, 6, 60, 12, 61, 0, 1, M.WOOD); b.box(1, 14, 64, 18, 69, 0, 7, M.METAL);
    b.table(1, 26, 50, 33, 54); b.counter(1, 22, 66, 34, 69);
    b.desk(1, 52, 50, 58, 54); b.desk(1, 64, 50, 70, 54); b.shelf(1, 50, 67, 56, 69, 7); b.box(1, 64, 60, 70, 63, 0, 3, M.CRATE);
    b.box(1, 80, 64, 90, 65, 0, 7, M.METAL); b.box(1, 94, 64, 101, 69, 0, 3, M.ICE); b.box(1, 94, 54, 98, 58, 0, 7, M.FRIDGE);
    // ---- furniture 2F
    b.box(2, 41, 30, 44, 33, 0, 3, M.CRATE);
    b.desk(2, 58, 6, 66, 10); b.shelf(2, 70, 14, 74, 15, 7); b.couch(2, 56, 26, 66, 30, M.FAB_RED, 's');
    b.rack(2, 96, 4, 98, 20); b.desk(2, 84, 6, 92, 10); b.counter(2, 84, 28, 100, 30, M.COUNTER); b.box(2, 86, 29, 98, 29, 4, 5, M.SCREEN);
    b.table(2, 6, 52, 14, 56); b.table(2, 18, 52, 24, 56); b.table(2, 6, 62, 14, 66); b.counter(2, 18, 67, 30, 69);
    b.desk(2, 58, 58, 68, 62); b.shelf(2, 61, 68, 65, 69, 8); b.box(2, 54, 58, 56, 60, 0, 4, M.METAL); b.couch(2, 66, 48, 74, 52, M.FAB_BLUE, 'n');
    b.crates(2, 94, 52, 6); b.box(2, 80, 64, 84, 68, 0, 3, M.CRATE); b.box(2, 92, 64, 100, 68, 0, 3, M.CRATE);
    b.cam(1, 2, 2, -135, 'PROCESSING'); b.cam(1, 102, 2, 135, 'LOADING BAY'); b.cam(2, 102, 40, 90, 'UPPER HALL'); b.cam(0, 2, 40, -90, 'LOWER CORRIDOR');
    // ---- the quay: a gantry crane, containers, fish tubs
    for (const [x, z] of [[58, 10], [58, 30], [84, 10], [84, 30]]) B.obox(x, z, x + 1, z + 1, 0, 33, M.LINE);
    B.obox(58, 10, 85, 11, 34, 35, M.LINE); B.obox(58, 30, 85, 31, 34, 35, M.LINE); B.obox(58, 12, 59, 29, 34, 35, M.LINE); B.obox(84, 12, 85, 29, 34, 35, M.LINE);
    B.obox(70, 12, 72, 29, 34, 35, M.LINE); B.obox(67, 17, 75, 23, 29, 33, M.CAR_W); B.obox(67, 17, 75, 17, 31, 32, M.GLASS);
    B.obox(71, 20, 71, 20, 13, 28, M.RAIL); B.obox(69, 19, 73, 21, 11, 12, M.RUST);
    // the quay edge is the north edge of the finished (grown) map: paint it, and bollards, once the map has its final size
    B.meta.afterPad = (B) => { B.surf(0, 0, B.W - 1, 1, M.LINE); for (let x = 6; x < B.W - 4; x += 16) B.obox(x, 3, x + 1, 4, 0, 1, M.DARK); };
    B.container(118, 14, 'x', M.CONT_B, true); B.container(150, 6, 'z', M.CONT_R); B.container(168, 20, 'z', M.CONT_G, true);
    const tub = (x, z) => { B.obox(x, z, x + 3, z + 3, 0, 2, M.BLUE_PAINT); B.obox(x + 1, z + 1, x + 2, z + 2, 2, 2, M.ICE); };
    for (const [x, z] of [[30, 20], [35, 20], [30, 25], [104, 36], [109, 36], [146, 40]]) tub(x, z);
    B.obox(20, 34, 27, 41, 0, 7, M.CRATE); B.obox(132, 34, 139, 41, 0, 3, M.CRATE);
    // ---- dry dock: a fishing boat up on blocks
    {
      const cx = 19, z0 = 110, L = 44;
      for (let i = 0; i < L; i++) {
        const bow = i < 11 ? 1 - i / 11 : 0;
        for (let h = 2; h <= 11; h++) {
          const hw = Math.max(0, Math.round((1 + (h - 2) * 0.7) * (1 - bow * 0.8)));
          B.obox(cx - hw, z0 + i, cx + hw, z0 + i, h, h, h < 6 ? M.RED_PAINT : h < 11 ? M.WHITE : M.WOOD);
        }
      }
      for (const i of [8, 20, 32]) B.obox(cx - 3, z0 + i, cx + 3, z0 + i + 2, 0, 1, M.WOOD);
      B.obox(cx - 4, z0 + 30, cx + 4, z0 + 38, 12, 18, M.WHITE); B.obox(cx - 4, z0 + 30, cx + 4, z0 + 30, 15, 16, M.GLASS); B.obox(cx - 4, z0 + 30, cx + 4, z0 + 38, 19, 19, M.RED_PAINT);
      B.obox(cx, z0 + 14, cx, z0 + 14, 12, 30, M.WOOD);
    }
    // ---- fuel pier and net sheds
    B.drum(180, 60, 7, 0, 16, M.WHITE); B.drum(180, 60, 7, 10, 11, M.RED_PAINT); B.drum(180, 130, 7, 0, 16, M.WHITE); B.drum(180, 130, 7, 10, 11, M.RED_PAINT);
    B.obox(170, 88, 171, 90, 0, 5, M.RED_PAINT); B.obox(170, 96, 171, 98, 0, 5, M.RED_PAINT);
    const shed = (x, z, w, d) => { B.obox(x, z, x + w - 1, z + d - 1, 0, 9, M.CORRUGATE); B.obox(x + 1, z, x + w - 2, z + d - 2, 0, 8, 0); };
    shed(30, 140, 24, 12); shed(140, 140, 24, 12);
    B.obox(34, 146, 46, 150, 0, 1, M.FAB_BLUE); B.obox(150, 145, 152, 147, 0, 2, M.RED_PAINT);
    B.lamp(44, 44); B.lamp(156, 44); B.lamp(44, 126); B.lamp(156, 126);
    B.cam(100, 26, 30, 180, -14, 'QUAY'); B.box(100, 13, 30, 100, 25, 30, M.PIPE);
    B.cam(170, 25, 150, 45, -14, 'NET SHEDS'); B.box(170, 13, 150, 170, 24, 150, M.PIPE);
    B.spawn('Quay', 100, 8, 0); B.spawn('Dry Dock', 8, 92, -90); B.spawn('Fuel Pier', 190, 92, 90); B.spawn('Net Sheds', 100, 158, 180);
    B.meta.bombs = [['Cold Storage', 'Ice Plant'], ['Canning Line', 'Loading Bay'], ['Foreman Office', 'Radio Room'], ["Owner's Office", 'Storage Loft']];
    B.meta.secure = ['Ice Plant', 'Shipping Office', 'Radio Room', 'Net Store'];
    B.meta.hostage = ["Owner's Office", 'Brine Tanks', 'Cooler', 'Foreman Office'];
    B.meta.defSpawns = ['Boiler Room', 'Locker Room', 'Radio Room'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ================================================================= OBSERVATORY */
  function observatory() {
    const B = new Builder('observatory', 'OBSERVATORY', 200, 56, 168);
    B.meta.desc = 'A mountaintop observatory under a clear, starry sky, with a domed telescope hall. Night.';
    B.theme(THEMES.starry);
    B.ground(M.SNOW, M.STONE);
    B.surf(92, 0, 108, 40, M.GRAVEL); B.surf(40, 40, 160, 128, M.GRAVEL);
    const b = B.building(52, 48, 96, 72, { lo: 0, hi: 2, ext: M.PLASTER, inner: M.DRY_WHITE, slab: M.WOODFLOOR, roof: M.ROOF });
    // B
    b.room(0, 'Generator Room', 0, 0, 44, 36, { wall: M.CONCRETE });
    b.room(0, 'Mirror Lab', 44, 0, 72, 36, { wall: M.DRY_GREY });
    b.room(0, 'Workshop', 72, 0, 95, 36, { wall: M.DRY_GREY });
    b.room(0, 'Service Corridor', 0, 36, 95, 44, { wall: M.DRY_GREY });
    b.room(0, 'Cold Store', 0, 44, 32, 71, { wall: M.CONCRETE });
    b.room(0, 'Water Tanks', 44, 44, 72, 71, { wall: M.CONCRETE });
    b.room(0, 'Server Room', 72, 44, 95, 71, { wall: M.DRY_GREY });
    // 1F
    b.room(1, 'Telescope Hall', 0, 0, 44, 44, { floor: M.TILE });
    b.room(1, 'Lobby', 44, 0, 68, 28, { wall: M.DRY_BEIGE, floor: M.TILE });
    b.room(1, 'Visitor Center', 68, 0, 95, 28, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(1, 'Corridor', 44, 28, 95, 36);
    b.room(1, 'Library', 0, 44, 32, 71, { wall: M.DRY_SAGE, floor: M.CARPET });
    b.room(1, 'Control Room', 44, 36, 72, 71, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    b.room(1, 'Kitchen', 72, 36, 95, 71, { wall: M.DRY_WHITE, floor: M.TILE });
    // 2F: a gallery runs round the telescope well; a flight on its east side climbs to it from the hall
    b.room(2, 'Gallery', 0, 0, 44, 44);
    b.void(2, 8, 8, 36, 36);
    b.rail(2, 7, 7, 37, 7); b.rail(2, 7, 37, 37, 37); b.rail(2, 7, 8, 7, 36); b.rail(2, 37, 8, 37, 36);
    b.stairs(1, 38, 10, '+z', 5); b.rail(2, 38, 9, 42, 9); b.rail(2, 43, 9, 43, 21);
    b.room(2, 'Dormitory', 44, 0, 72, 28, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, "Astronomer's Quarters", 72, 0, 95, 28, { wall: M.DRY_RED, floor: M.CARPET });
    b.room(2, 'Upper Corridor', 44, 28, 95, 36);
    b.room(2, 'Lecture Room', 0, 44, 32, 71, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    b.room(2, 'Radio Lab', 44, 36, 72, 71, { wall: M.DRY_GREY });
    b.room(2, 'Infirmary', 72, 36, 95, 71, { wall: M.DRY_WHITE, floor: M.TILE });
    b.stairwell(32, 44, 71);
    // doors B
    b.doorZ(0, 36, 20); b.doorZ(0, 36, 56); b.doorZ(0, 36, 84); b.doorX(0, 44, 14); b.doorX(0, 72, 20);
    b.doorZ(0, 44, 14); b.doorZ(0, 44, 58); b.doorZ(0, 44, 82); b.doorX(0, 72, 62);
    b.cellar('e', 50);
    // doors 1F
    b.doorZ(1, 0, 52, 8); b.doorZ(1, 0, 82); b.doorX(1, 0, 20, 6); b.doorZ(1, 71, 12); b.doorZ(1, 71, 84); b.doorX(1, 95, 12); b.doorX(1, 95, 62);
    b.doorX(1, 44, 2, 6); b.doorX(1, 44, 30); b.doorX(1, 44, 38); b.doorZ(1, 44, 16);
    b.doorX(1, 68, 12); b.doorZ(1, 28, 54); b.doorZ(1, 28, 84); b.doorZ(1, 36, 56); b.doorZ(1, 36, 84); b.doorX(1, 72, 58);
    b.winZ(1, 0, 6, 6); b.winZ(1, 0, 26, 6); b.winZ(1, 0, 46, 4); b.winZ(1, 0, 62, 4); b.winZ(1, 0, 72, 5); b.winZ(1, 0, 88, 5);
    b.winX(1, 0, 6, 6); b.winX(1, 0, 32, 6); b.winX(1, 0, 52, 5); b.winX(1, 0, 62, 5);
    b.winZ(1, 71, 22, 6); b.winZ(1, 71, 50, 6); b.winZ(1, 71, 62, 6); b.winZ(1, 71, 76, 4);
    b.winX(1, 95, 20, 5); b.winX(1, 95, 40, 4);
    // doors 2F
    b.doorX(2, 44, 3); b.doorX(2, 44, 30); b.doorX(2, 44, 38); b.doorZ(2, 44, 14);
    b.doorX(2, 72, 12); b.doorZ(2, 28, 56); b.doorZ(2, 28, 84); b.doorZ(2, 36, 58); b.doorZ(2, 36, 84); b.doorX(2, 72, 56); b.doorX(2, 32, 62); b.doorX(2, 44, 64);
    b.winZ(2, 0, 10, 6); b.winZ(2, 0, 26, 6); b.winZ(2, 0, 50, 5); b.winZ(2, 0, 62, 5); b.winZ(2, 0, 78, 5); b.winZ(2, 0, 88, 5);
    b.winX(2, 0, 10, 6); b.winX(2, 0, 28, 6); b.winX(2, 0, 52, 5); b.winX(2, 0, 62, 5);
    b.winZ(2, 71, 8, 6); b.winZ(2, 71, 20, 6); b.winZ(2, 71, 52, 6); b.winZ(2, 71, 80, 6);
    b.winX(2, 95, 10, 5); b.winX(2, 95, 46, 5); b.winX(2, 95, 60, 5);
    b.hatch(2, 56, 12); b.hatch(2, 80, 52); b.hatch(1, 58, 58); b.hatch(1, 22, 64);
    // the dome over the well, its glazed slit facing north, and the telescope on its pier
    {
      const R = 14, cx = b.X(22), cz = b.Z(22), ry = b.roofY;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const r2 = dx * dx + dz * dz;
        if (r2 < (R - 1) * (R - 1)) B.w.put(cx + dx, ry, cz + dz, 0);
        for (let dy = 0; dy <= R; dy++) {
          const d = Math.sqrt(r2 + dy * dy);
          if (d > R + 0.5 || d < R - 0.8) continue;
          B.w.put(cx + dx, ry + dy, cz + dz, Math.abs(dx) <= 1 && dz < 0 && dy >= 3 ? M.GLASS : M.DOME);
        }
      }
    }
    b.box(1, 19, 19, 25, 25, 0, 5, M.STONE); b.box(1, 20, 20, 24, 24, 6, 7, M.METAL); b.box(1, 21, 21, 23, 23, 8, 10, M.METAL);
    for (let t = 0; t <= 20; t++) { const h = 10 + Math.round(t * 0.85), lz = 22 - Math.round(t * 0.45); b.box(1, 20, lz - 1, 24, lz + 2, h, h + 3, t > 17 ? M.DARK : M.WHITE); }
    b.box(1, 21, 24, 23, 27, 7, 11, M.METAL);
    // furniture 1F
    b.desk(1, 6, 30, 12, 34); b.box(1, 2, 2, 8, 3, 0, 2, M.WOOD); b.shelf(1, 2, 38, 8, 39, 6); b.box(1, 30, 32, 33, 35, 0, 2, M.TRIM); b.box(1, 31, 33, 32, 34, 3, 4, M.BLUE_PAINT);
    b.counter(1, 46, 18, 52, 20, M.TRIM); b.box(1, 60, 8, 66, 9, 0, 1, M.WOOD);
    b.box(1, 74, 8, 78, 12, 0, 3, M.TRIM); b.box(1, 74, 8, 78, 12, 4, 6, M.GLASS); b.tank(1, 86, 18, 2, 4, M.RED_PAINT); b.shelf(1, 90, 22, 94, 23, 6);
    b.shelf(1, 4, 56, 14, 57, 8); b.shelf(1, 18, 56, 28, 57, 8); b.table(1, 6, 60, 14, 64); b.couch(1, 23, 48, 30, 52, M.FAB_RED, 'n');
    b.desk(1, 48, 46, 56, 50); b.desk(1, 60, 46, 68, 50); b.box(1, 45, 54, 45, 66, 2, 7, M.SCREEN); b.box(1, 48, 62, 54, 66, 0, 3, M.TRIM);
    b.box(1, 78, 41, 80, 45, 0, 7, M.FRIDGE); b.counter(1, 84, 52, 88, 56); b.table(1, 84, 44, 90, 48);
    // furniture 2F
    b.bed(2, 52, 4, 58, 8, M.FAB_BLUE); b.bed(2, 62, 4, 68, 8, M.FAB_BLUE); b.bed(2, 48, 16, 56, 20, M.FAB_RED); b.shelf(2, 62, 18, 66, 19, 7);
    b.bed(2, 84, 4, 92, 10, M.FAB_RED); b.desk(2, 76, 4, 82, 8); b.shelf(2, 86, 18, 90, 19, 7); b.box(2, 78, 22, 79, 23, 0, 5, M.BRASS);
    for (let i = 0; i < 3; i++) b.box(2, 6, 52 + i * 5, 26, 52 + i * 5, 0, 1, M.FAB_RED);
    b.box(2, 31, 48, 31, 58, 2, 7, M.DARK);
    b.rack(2, 52, 60, 54, 68); b.desk(2, 56, 50, 64, 54); b.box(2, 62, 60, 66, 63, 0, 6, M.METAL);
    b.bed(2, 86, 46, 94, 50, M.WHITE); b.bed(2, 86, 58, 94, 62, M.WHITE); b.box(2, 78, 62, 81, 65, 0, 6, M.WHITE);
    // furniture B
    b.box(0, 6, 6, 16, 14, 0, 6, M.METAL); b.box(0, 24, 6, 34, 14, 0, 6, M.METAL); b.box(0, 4, 26, 10, 30, 0, 3, M.RED_PAINT); b.box(0, 11, 15, 12, 34, 9, 9, M.PIPE);
    b.tank(0, 58, 14, 6, 2, M.METAL); b.tank(0, 58, 14, 4, 3, M.GLASS); b.shelf(0, 46, 29, 52, 30, 7);
    b.table(0, 78, 6, 88, 12); b.shelf(0, 92, 4, 94, 20, 8); b.crates(0, 80, 22, 4);
    b.box(0, 2, 38, 93, 38, 10, 10, M.PIPE);
    b.shelf(0, 2, 60, 12, 61, 8); b.crates(0, 4, 50, 4);
    b.tank(0, 53, 62, 4, 9, M.METAL); b.tank(0, 65, 53, 3, 8, M.METAL);
    b.rack(0, 78, 50, 80, 64); b.rack(0, 86, 50, 88, 64);
    b.cam(2, 2, 2, -135, 'GALLERY'); b.cam(1, 46, 2, -135, 'LOBBY'); b.cam(2, 94, 32, 90, 'UPPER CORRIDOR'); b.cam(0, 2, 40, -90, 'SERVICE CORRIDOR');
    // outside: a weather hut and radio mast, a snowcat, a dish, the cable-car stop, boulders
    const hut = B.building(10, 26, 20, 16, { lo: 1, hi: 1, ext: M.CORRUGATE, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.RUST });
    hut.room(1, 'Weather Hut', 0, 0, 19, 15);
    hut.doorX(1, 19, 6); hut.winZ(1, 0, 8, 4); hut.winZ(1, 15, 8, 4);
    hut.desk(1, 2, 2, 8, 5); hut.shelf(1, 12, 12, 17, 13, 7);
    for (let h = 0; h <= 38; h++) B.obox(14, 110, 15, 111, h, h, (h >> 3) % 2 ? M.WHITE : M.RED_PAINT);
    B.obox(14, 110, 15, 111, 39, 39, M.LAMP_R);
    B.truck(116, 14, 'x', M.RED_PAINT);
    B.obox(172, 30, 173, 31, 0, 11, M.PIPE);
    for (let c = -6; c <= 6; c++) for (let a = -6; a <= 6; a++) if (a * a + c * c <= 36) B.w.put(172 + a, GY + 13 + Math.round(c * 0.6), 31 + Math.round(c * 0.8), M.WHITE);
    for (const [x, z, r] of [[30, 14, 5], [168, 150, 6], [20, 150, 5], [186, 40, 4], [60, 150, 4], [140, 30, 3]]) B.rock(x, z, r, M.SNOW);
    B.obox(174, 104, 196, 120, 0, 0, M.CONCRETE);
    B.obox(180, 108, 190, 116, 3, 12, M.RED_PAINT); B.obox(181, 109, 189, 115, 4, 11, 0);
    B.obox(180, 109, 180, 115, 7, 10, M.GLASS); B.obox(190, 109, 190, 115, 7, 10, M.GLASS);
    B.obox(185, 112, 185, 112, 13, 30, M.METAL); B.obox(185, 112, 185, 167, 31, 31, M.RAIL); B.obox(184, 140, 186, 142, 0, 30, M.METAL);
    B.obox(60, 136, 70, 140, 0, 1, M.SNOW); B.obox(130, 20, 138, 24, 0, 1, M.SNOW);
    B.fence(20, 162, 180, 162, M.TRIM);
    B.lamp(46, 42); B.lamp(154, 42); B.lamp(46, 126); B.lamp(154, 126);
    B.cam(100, 26, 30, 180, -14, 'ACCESS ROAD'); B.box(100, 13, 30, 100, 25, 30, M.PIPE);
    B.cam(30, 25, 140, -45, -14, 'RIDGE'); B.box(30, 13, 140, 30, 24, 140, M.PIPE);
    B.spawn('Access Road', 100, 6, 0); B.spawn('Radio Mast', 8, 92, -90); B.spawn('Cable Car', 192, 86, 90); B.spawn('Ridge Trail', 100, 156, 180);
    B.meta.bombs = [['Generator Room', 'Mirror Lab'], ['Control Room', 'Kitchen'], ['Radio Lab', 'Infirmary'], ['Dormitory', "Astronomer's Quarters"]];
    B.meta.secure = ['Mirror Lab', 'Control Room', 'Lecture Room', 'Water Tanks'];
    B.meta.hostage = ["Astronomer's Quarters", 'Server Room', 'Library', 'Radio Lab'];
    B.meta.defSpawns = ['Generator Room', 'Kitchen', 'Lecture Room'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ================================================================== RAIL DEPOT */
  function depot() {
    const B = new Builder('depot', 'RAIL DEPOT', 200, 56, 176);
    B.meta.desc = 'A brick railway station with a freight tunnel underneath, a train at the platform and a signal box down the line. Rainy dusk.';
    B.theme(THEMES.rain);
    B.ground(M.GRAVEL);
    // two tracks along the north side, the street along the south
    const track = z0 => { for (let x = 0; x < 200; x += 3) B.surf(x, z0 + 1, x, z0 + 10, M.WOOD); B.obox(0, z0 + 3, 199, z0 + 3, 0, 0, M.RAIL); B.obox(0, z0 + 8, 199, z0 + 8, 0, 0, M.RAIL); };
    track(16); track(34);
    B.surf(0, 128, 199, 139, M.CONCRETE); B.surf(0, 140, 199, 158, M.ASPHALT);
    for (let x = 4; x < 196; x += 10) B.surf(x, 149, x + 4, 149, M.LINE);
    for (const [x, z, w, d] of [[40, 152, 6, 3], [90, 144, 5, 2], [150, 154, 7, 3], [70, 132, 5, 2], [12, 60, 4, 3], [176, 140, 5, 2]]) B.surf(x, z, x + w, z + d, M.PUDDLE);
    const b = B.building(48, 64, 104, 64, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    // B
    b.room(0, 'Freight Tunnel', 0, 0, 103, 14, { wall: M.CONCRETE });
    b.room(0, 'Lost Property', 0, 14, 40, 40, { wall: M.DRY_GREY });
    b.room(0, 'Coal Store', 40, 14, 70, 40, { wall: M.DRY_GREY });
    b.room(0, 'Boiler Room', 70, 14, 103, 40, { wall: M.CONCRETE });
    b.room(0, 'Pump Room', 0, 40, 56, 63, { wall: M.DRY_GREY });
    b.room(0, 'Cistern', 68, 40, 103, 63, { wall: M.CONCRETE });
    // 1F
    b.room(1, 'Waiting Room', 0, 0, 32, 40, { wall: M.DRY_SAGE });
    b.room(1, 'Ticket Hall', 32, 0, 72, 40, { floor: M.TILE });
    b.room(1, 'Parcels Office', 72, 0, 103, 24, { wall: M.DRY_GREY, floor: M.CONCRETE });
    b.room(1, 'Ticket Office', 72, 24, 103, 40, { wall: M.DRY_RED, floor: M.CARPET2 });
    b.room(1, 'Cafe', 0, 40, 30, 63, { wall: M.DRY_RED, floor: M.TILE });
    b.room(1, 'Washrooms', 30, 40, 56, 63, { wall: M.DRY_WHITE, floor: M.TILE });
    b.room(1, 'Telegraph Office', 68, 40, 103, 63, { wall: M.DRY_SAGE, floor: M.CARPET });
    // 2F: the ticket hall rises through both storeys, with a mezzanine on its east side
    b.void(2, 33, 1, 59, 39);
    b.room(2, 'Mezzanine', 60, 0, 72, 40, { skip: 'w' });
    b.rail(2, 60, 1, 60, 39);
    b.stairs(1, 64, 4, '+z', 6); b.rail(2, 63, 3, 63, 15); b.rail(2, 70, 3, 70, 15); b.rail(2, 63, 3, 70, 3);
    b.room(2, "Station Master's Office", 0, 0, 32, 24, { wall: M.DRY_BLUE, floor: M.CARPET });
    b.room(2, 'Records Room', 0, 24, 32, 40, { wall: M.DRY_GREY });
    b.room(2, 'Archive', 72, 0, 103, 24, { wall: M.DRY_GREY });
    b.room(2, 'Pay Office', 72, 24, 103, 40, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    b.room(2, 'Dormitory', 0, 40, 30, 63, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, 'Crew Lounge', 30, 40, 56, 63, { wall: M.DRY_RED, floor: M.CARPET });
    b.room(2, 'Clock Room', 68, 40, 103, 63, { wall: M.DRY_BEIGE });
    b.stairwell(56, 40, 63);
    // doors B: the freight tunnel has a ramp down at each end
    b.doorZ(0, 14, 16); b.doorZ(0, 14, 52); b.doorZ(0, 14, 86); b.doorX(0, 40, 24); b.doorX(0, 70, 24);
    b.doorZ(0, 40, 16); b.doorZ(0, 40, 46); b.doorZ(0, 40, 84);
    b.cellar('w', 6); b.cellar('e', 6);
    // doors 1F
    b.doorZ(1, 0, 14); b.doorZ(1, 0, 42, 8); b.doorZ(1, 0, 96); b.shutterZ(1, 0, 78, 16);
    b.doorZ(1, 63, 12); b.doorZ(1, 63, 50); b.doorZ(1, 63, 84); b.doorX(1, 0, 18); b.doorX(1, 0, 50); b.doorX(1, 103, 30); b.doorX(1, 103, 52);
    b.doorX(1, 32, 10, 6); b.doorX(1, 32, 28); b.doorX(1, 72, 18); b.doorX(1, 72, 30); b.doorZ(1, 24, 86); b.doorZ(1, 40, 86);
    b.doorZ(1, 40, 42); b.doorZ(1, 40, 14); b.doorX(1, 30, 50);
    b.winZ(1, 0, 4, 6); b.winZ(1, 0, 22, 6); b.winZ(1, 0, 34, 6); b.winZ(1, 0, 54, 6);
    b.winX(1, 0, 28, 6); b.winX(1, 0, 44, 4); b.winX(1, 0, 57, 4);
    b.winZ(1, 63, 20, 6); b.winZ(1, 63, 36, 4); b.winZ(1, 63, 72, 6); b.winZ(1, 63, 94, 6);
    b.winX(1, 103, 14, 6); b.winX(1, 103, 44, 4); b.winX(1, 103, 58, 4);
    // doors 2F
    b.doorX(2, 72, 18); b.doorX(2, 72, 30); b.doorZ(2, 24, 86); b.doorZ(2, 40, 86); b.doorX(2, 68, 52); b.doorX(2, 56, 58);
    b.doorX(2, 30, 50); b.doorZ(2, 40, 14); b.doorZ(2, 24, 14);
    b.winZ(2, 0, 6, 6); b.winZ(2, 0, 20, 6); b.winZ(2, 0, 36, 8); b.winZ(2, 0, 48, 8); b.winZ(2, 0, 64, 4); b.winZ(2, 0, 78, 6); b.winZ(2, 0, 92, 6);
    b.winX(2, 0, 10, 6); b.winX(2, 0, 30, 6); b.winX(2, 0, 48, 6);
    b.winZ(2, 63, 10, 6); b.winZ(2, 63, 40, 6); b.winZ(2, 63, 76, 6); b.winZ(2, 63, 92, 6);
    b.winX(2, 103, 10, 6); b.winX(2, 103, 30, 6); b.winX(2, 103, 50, 6);
    b.winX(2, 32, 8, 8); b.winX(2, 32, 28, 6); b.winZ(2, 40, 38, 8);   // the offices look down into the ticket hall
    b.hatch(2, 84, 8); b.hatch(2, 12, 50); b.hatch(1, 92, 56); b.hatch(1, 16, 26);
    // furniture B
    b.crates(0, 22, 2, 2); b.crates(0, 72, 2, 2); b.box(0, 40, 3, 46, 7, 0, 3, M.RUST);
    b.shelf(0, 2, 20, 3, 36, 8); b.box(0, 14, 30, 22, 34, 0, 3, M.CRATE); b.box(0, 26, 18, 30, 20, 0, 2, M.FAB_RED); b.box(0, 30, 30, 34, 32, 0, 1, M.FAB_BLUE);
    b.box(0, 48, 22, 58, 30, 0, 3, M.DARK); b.box(0, 50, 24, 56, 28, 4, 5, M.DARK);
    b.box(0, 76, 20, 88, 30, 0, 8, M.BOILER); b.box(0, 81, 31, 82, 38, 9, 9, M.PIPE); b.box(0, 94, 18, 100, 22, 0, 3, M.METAL);
    b.box(0, 6, 50, 12, 56, 0, 5, M.BOILER); b.tank(0, 30, 54, 4, 7, M.METAL); b.box(0, 40, 58, 52, 61, 0, 3, M.METAL);
    b.box(0, 72, 47, 88, 57, 0, 4, M.CONCRETE); b.box(0, 73, 48, 87, 56, 4, 4, M.WATER);
    // furniture 1F
    for (const z of [8, 16, 32]) { b.box(1, 6, z, 26, z, 0, 1, M.WOOD); b.box(1, 6, z + 1, 26, z + 1, 0, 3, M.WOOD); }
    for (const z of [16, 26]) { b.box(1, 38, z, 54, z, 0, 1, M.WOOD); b.box(1, 38, z + 1, 54, z + 1, 0, 3, M.WOOD); }
    b.box(1, 33, 1, 59, 1, 11, 11, M.TRIM); b.box(1, 34, 1, 58, 1, 12, 15, M.SCREEN); b.box(1, 34, 36, 35, 37, 0, 6, M.LEAF);
    b.crates(1, 88, 10, 4); b.box(1, 96, 16, 101, 21, 0, 3, M.CRATE); b.box(1, 74, 10, 76, 14, 0, 4, M.METAL);
    b.counter(1, 79, 33, 96, 34, M.TRIM); b.box(1, 79, 33, 96, 34, 4, 7, M.GLASS);
    b.table(1, 3, 50, 7, 54); b.table(1, 20, 50, 24, 54); b.table(1, 3, 64, 7, 68); b.counter(1, 20, 65, 26, 69);
    for (let i = 0; i < 3; i++) b.box(1, 34 + i * 5, 56, 34 + i * 5, 62, 0, 7, M.DRY_WHITE);
    b.counter(1, 48, 42, 54, 43, M.WHITE);
    b.desk(1, 74, 46, 80, 50); b.shelf(1, 70, 56, 72, 62, 8); b.box(1, 94, 44, 100, 45, 0, 3, M.TRIM); b.box(1, 95, 44, 99, 44, 4, 5, M.BRASS);
    // furniture 2F
    b.box(2, 62, 30, 64, 33, 0, 3, M.CRATE);
    b.desk(2, 10, 8, 20, 12); b.shelf(2, 1, 17, 2, 22, 8); b.couch(2, 22, 16, 28, 20, M.FAB_RED, 'e');
    b.shelf(2, 4, 30, 5, 34, 8); b.shelf(2, 22, 30, 23, 34, 8); b.shelf(2, 26, 30, 27, 34, 8);
    b.bed(2, 2, 44, 8, 48, M.FAB_BLUE); b.bed(2, 2, 56, 8, 60, M.FAB_BLUE); b.bed(2, 18, 56, 24, 60, M.FAB_RED);
    b.couch(2, 36, 54, 46, 58, M.FAB_BLUE, 's'); b.table(2, 38, 46, 44, 50); b.box(2, 50, 42, 54, 42, 2, 5, M.SCREEN);
    b.shelf(2, 92, 3, 93, 16, 8); b.shelf(2, 97, 3, 98, 16, 8); b.shelf(2, 76, 2, 77, 12, 8);
    b.desk(2, 80, 30, 88, 34); b.box(2, 94, 28, 97, 31, 0, 5, M.METAL);
    b.tank(2, 86, 52, 4, 1, M.BRASS); b.box(2, 85, 51, 87, 53, 2, 9, M.METAL);
    b.cam(1, 34, 2, -135, 'TICKET HALL'); b.cam(0, 4, 2, -90, 'TUNNEL'); b.cam(2, 70, 38, 45, 'MEZZANINE'); b.cam(1, 102, 26, 135, 'TICKET OFFICE');
    // a hollow clock tower over the ticket hall, with a face north and south
    {
      const x0 = b.X(44), z0 = b.Z(0), ry = b.roofY;
      B.box(x0, ry + 1, z0, x0 + 11, ry + 16, z0 + 11, M.BRICK); B.box(x0 + 1, ry + 1, z0 + 1, x0 + 10, ry + 15, z0 + 10, 0);
      for (let k = 0; k < 3; k++) B.box(x0 + k, ry + 17 + k, z0 + k, x0 + 11 - k, ry + 17 + k, z0 + 11 - k, M.ROOF);
      const cy = ry + 8.5;
      for (const z of [z0, z0 + 11]) for (let i = 0; i < 12; i++) for (let y = ry + 2; y <= ry + 15; y++) {
        const d = (i - 5.5) ** 2 + (y - cy) ** 2;
        if (d <= 16) B.w.put(x0 + i, y, z, M.WHITE); else if (d <= 24) B.w.put(x0 + i, y, z, M.BRASS);
      }
      for (const z of [z0, z0 + 11]) { B.box(x0 + 5, ry + 8, z, x0 + 6, ry + 11, z, M.DARK); B.box(x0 + 6, ry + 8, z, x0 + 9, ry + 8, z, M.DARK); }
    }
    // the platform and its canopy
    B.obox(50, 50, 150, 63, 0, 0, M.CONCRETE); B.obox(50, 50, 150, 50, 0, 0, M.LINE); B.obox(110, 54, 114, 56, 0, 0, M.PUDDLE);
    for (const x of [52, 70, 88, 102, 120, 148]) B.obox(x, 60, x, 60, 1, 14, M.METAL);
    B.obox(50, 52, 150, 63, 15, 15, M.CORRUGATE);
    for (const x of [61, 79, 111, 135]) B.obox(x, 57, x, 57, 14, 14, M.LAMP);
    B.obox(72, 61, 77, 61, 1, 1, M.WOOD); B.obox(106, 61, 111, 61, 1, 1, M.WOOD);
    // a train at the platform: two carriages you can walk through, and the locomotive
    const carriage = (x0, len, m) => {
      const x1 = x0 + len - 1;
      B.obox(x0, 34, x1, 45, 1, 12, m); B.obox(x0 + 1, 35, x1 - 1, 44, 2, 11, 0);
      B.obox(x0, 34, x1, 34, 4, 4, M.LINE); B.obox(x0, 45, x1, 45, 4, 4, M.LINE);
      for (let x = x0 + 12; x < x1 - 10; x += 6) {
        B.obox(x, 34, x + 3, 34, 6, 9, M.GLASS); B.obox(x, 45, x + 3, 45, 6, 9, M.GLASS);
        B.obox(x, 36, x + 1, 38, 2, 3, M.FAB_BLUE); B.obox(x, 41, x + 1, 43, 2, 3, M.FAB_BLUE);
      }
      for (const dx of [5, len - 9]) for (const [z, s] of [[34, 33], [45, 46]]) { B.obox(x0 + dx, z, x0 + dx + 3, z, 2, 10, 0); B.obox(x0 + dx, s, x0 + dx + 3, s, 0, 0, M.METAL); }
    };
    carriage(64, 40, M.CAR_R); carriage(110, 40, M.CAR_R);
    B.obox(156, 34, 185, 45, 1, 14, M.CAR_K); B.obox(156, 34, 185, 34, 3, 3, M.RED_PAINT); B.obox(156, 45, 185, 45, 3, 3, M.RED_PAINT);
    B.obox(178, 34, 183, 34, 9, 11, M.GLASS); B.obox(178, 45, 183, 45, 9, 11, M.GLASS); B.obox(185, 38, 185, 41, 5, 6, M.LAMP);
    B.obox(0, 18, 1, 25, 0, 4, M.RED_PAINT); B.obox(0, 36, 1, 43, 0, 4, M.RED_PAINT);
    // goods yard
    B.container(4, 66, 'z', M.CONT_R, true); B.container(22, 120, 'z', M.CONT_B);
    B.obox(28, 92, 35, 99, 0, 7, M.CRATE); B.obox(10, 140, 17, 147, 0, 3, M.CRATE);
    // the signal box down the line
    const sb = B.building(164, 96, 24, 24, { lo: 1, hi: 2, ext: M.BRICK, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.ROOF });
    sb.room(1, 'Relay Room', 0, 0, 23, 23, { wall: M.WOOD });
    sb.room(2, 'Signal Cabin', 0, 0, 23, 23, { wall: M.WOOD });
    sb.stairs(1, 1, 6, '+z', 5); sb.rail(2, 6, 5, 6, 17); sb.rail(2, 1, 5, 5, 5);
    sb.doorZ(1, 0, 12); sb.doorX(1, 23, 14);
    sb.winX(1, 0, 14, 4); sb.winZ(1, 23, 8, 5);
    sb.winZ(2, 0, 8, 6); sb.winZ(2, 0, 16, 5); sb.winX(2, 0, 10, 8); sb.winX(2, 23, 6, 6); sb.winX(2, 23, 14, 6); sb.winZ(2, 23, 8, 8);
    sb.rack(1, 18, 2, 20, 10); sb.box(2, 10, 12, 20, 13, 0, 3, M.RED_PAINT); sb.desk(2, 14, 2, 20, 5);
    // the street
    B.car(20, 142, 'x', M.CAR_R); B.car(124, 150, 'x', M.CAR_W); B.car(160, 142, 'x', M.CAR_K);
    for (const x of [60, 72]) B.obox(x, 132, x, 132, 0, 9, M.METAL);
    B.obox(59, 131, 73, 136, 10, 10, M.METAL); B.obox(60, 136, 72, 136, 1, 8, M.GLASS); B.obox(62, 134, 70, 135, 0, 1, M.WOOD);
    B.lamp(30, 138); B.lamp(90, 138); B.lamp(150, 138); B.lamp(30, 52); B.lamp(170, 52);
    B.cam(100, 27, 58, 0, -14, 'PLATFORM'); B.box(100, 14, 58, 100, 26, 58, M.PIPE);
    B.cam(150, 25, 150, 45, -14, 'STATION ROAD'); B.box(150, 13, 150, 150, 24, 150, M.PIPE);
    B.spawn('Sidings', 100, 6, 0); B.spawn('Goods Yard', 8, 108, -90); B.spawn('Signal Box', 192, 70, 90); B.spawn('Station Road', 100, 168, 180);
    B.meta.bombs = [['Coal Store', 'Boiler Room'], ['Ticket Office', 'Parcels Office'], ['Archive', 'Pay Office'], ["Station Master's Office", 'Records Room']];
    B.meta.secure = ['Telegraph Office', 'Lost Property', 'Clock Room', 'Waiting Room'];
    B.meta.hostage = ['Cistern', 'Crew Lounge', 'Pay Office', 'Telegraph Office'];
    B.meta.defSpawns = ['Lost Property', 'Telegraph Office', "Station Master's Office"];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ====================================================================== MUSEUM */
  function museum() {
    const B = new Builder('museum', 'MUSEUM', 208, 56, 168);
    B.meta.desc = 'A natural-history museum after closing: a skylit atrium with a fossil skeleton, galleries on two floors and a vault below. Evening.';
    B.theme(THEMES.evening);
    B.ground(M.GRASS);
    B.surf(40, 0, 168, 40, M.DOCK); B.surf(100, 120, 108, 167, M.GRAVEL); B.surf(0, 80, 47, 86, M.GRAVEL); B.surf(166, 0, 186, 167, M.ASPHALT); B.surf(160, 80, 207, 86, M.GRAVEL);
    const b = B.building(48, 48, 112, 72, { lo: 0, hi: 2, ext: M.MARBLE, inner: M.DRY_WHITE, slab: M.WOODFLOOR, roof: M.ROOF });
    // B (the vault goes last so its concrete walls win every shared edge)
    b.room(0, 'Fossil Storage', 0, 0, 40, 36, { wall: M.DRY_GREY });
    b.room(0, 'Conservation', 72, 0, 111, 36, { wall: M.DRY_WHITE });
    b.room(0, 'Lower Hall', 0, 36, 111, 48, { wall: M.DRY_GREY });
    b.room(0, 'Boiler Room', 0, 48, 44, 71, { wall: M.CONCRETE });
    b.room(0, 'Crate Room', 56, 48, 80, 71, { wall: M.DRY_GREY });
    b.room(0, 'Server Room', 80, 48, 111, 71, { wall: M.DRY_GREY });
    b.room(0, 'Vault', 40, 0, 72, 36, { wall: M.CONCRETE });
    // 1F
    b.room(1, 'Fossil Gallery', 0, 0, 36, 28, { wall: M.DRY_BEIGE });
    b.room(1, 'Mineral Gallery', 0, 28, 36, 48, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(1, 'Ancient Gallery', 76, 0, 111, 28, { wall: M.DRY_RED });
    b.room(1, 'Gift Shop', 76, 28, 111, 48, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    b.room(1, 'Cafe', 0, 48, 28, 71, { wall: M.DRY_RED, floor: M.TILE });
    b.room(1, 'Cloakroom', 28, 48, 44, 71, { wall: M.DRY_BEIGE, floor: M.CARPET });
    b.room(1, 'Security Office', 56, 48, 80, 71, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    b.room(1, 'Loading Dock', 80, 48, 111, 71, { wall: M.DRY_GREY, floor: M.CONCRETE });
    b.room(1, 'Atrium', 36, 0, 76, 48, { wall: M.MARBLE, floor: M.TILE });
    // 2F: the atrium is open to a glass roof, with a mezzanine along its south side and a grand stair up to it
    b.void(2, 37, 1, 75, 35);
    b.room(2, 'Portrait Gallery', 0, 0, 36, 28, { wall: M.DRY_RED, floor: M.CARPET });
    b.room(2, 'Map Room', 0, 28, 36, 48, { wall: M.DRY_SAGE });
    b.room(2, 'Textile Gallery', 76, 0, 111, 28, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    b.room(2, "Curator's Office", 76, 28, 111, 48, { wall: M.DRY_BEIGE, floor: M.CARPET });
    b.room(2, 'Restoration Lab', 0, 48, 44, 71, { wall: M.DRY_WHITE });
    b.room(2, 'Board Room', 56, 48, 80, 71, { wall: M.PANEL_DARK, floor: M.CARPET });
    b.room(2, 'Photo Studio', 80, 48, 111, 71, { wall: M.DRY_GREY });
    b.room(2, 'Mezzanine', 36, 36, 76, 48, { wall: M.MARBLE, skip: 's' });
    b.rail(2, 37, 36, 51, 36); b.rail(2, 60, 36, 75, 36);
    b.stairs(1, 52, 24, '+z', 8);
    b.stairwell(44, 48, 71);
    // doors B
    b.doorZ(0, 36, 16); b.doorZ(0, 36, 54); b.doorZ(0, 36, 90); b.doorX(0, 40, 14); b.doorX(0, 72, 24);
    b.doorZ(0, 48, 18); b.doorZ(0, 48, 66); b.doorZ(0, 48, 94); b.doorX(0, 80, 60);
    b.cellar('e', 56);
    // doors 1F
    b.doorZ(1, 0, 50, 12); b.doorZ(1, 0, 14); b.doorZ(1, 0, 92); b.doorX(1, 0, 20); b.doorX(1, 0, 36); b.doorX(1, 0, 58);
    b.doorZ(1, 71, 12); b.doorZ(1, 71, 64); b.shutterZ(1, 71, 86, 16); b.doorX(1, 111, 36); b.doorX(1, 111, 12);
    b.doorX(1, 36, 10, 6); b.doorX(1, 36, 38); b.doorX(1, 76, 10, 6); b.doorX(1, 76, 38); b.doorZ(1, 28, 16); b.doorZ(1, 28, 92);
    b.doorZ(1, 48, 38); b.doorZ(1, 48, 64); b.doorX(1, 28, 58); b.doorZ(1, 48, 12); b.doorX(1, 80, 58); b.doorZ(1, 48, 92);
    b.winZ(1, 0, 4, 6); b.winZ(1, 0, 24, 6); b.winZ(1, 0, 40, 6); b.winZ(1, 0, 66, 6); b.winZ(1, 0, 80, 6); b.winZ(1, 0, 100, 6);
    b.winX(1, 0, 8, 6); b.winX(1, 0, 42, 4); b.winX(1, 0, 50, 4); b.winX(1, 0, 64, 4);
    b.winZ(1, 71, 20, 5); b.winZ(1, 71, 34, 5); b.winZ(1, 71, 72, 5);
    b.winX(1, 111, 20, 5); b.winX(1, 111, 64, 5);
    // doors 2F
    b.doorX(2, 36, 40); b.doorX(2, 76, 40); b.doorZ(2, 28, 16); b.doorZ(2, 28, 92); b.doorZ(2, 48, 16); b.doorZ(2, 48, 94);
    b.doorX(2, 44, 64); b.doorX(2, 56, 60); b.doorX(2, 80, 58); b.doorZ(2, 48, 66);
    b.winZ(2, 0, 6, 8); b.winZ(2, 0, 22, 8); b.winZ(2, 0, 42, 8); b.winZ(2, 0, 62, 8); b.winZ(2, 0, 82, 8); b.winZ(2, 0, 98, 8);
    b.winX(2, 0, 10, 6); b.winX(2, 0, 36, 6); b.winX(2, 0, 54, 6); b.winX(2, 0, 64, 4);
    b.winZ(2, 71, 10, 6); b.winZ(2, 71, 28, 6); b.winZ(2, 71, 62, 6); b.winZ(2, 71, 86, 6); b.winZ(2, 71, 100, 6);
    b.winX(2, 111, 10, 6); b.winX(2, 111, 36, 6); b.winX(2, 111, 56, 6);
    b.winX(2, 36, 8, 8); b.winX(2, 36, 20, 6); b.winX(2, 76, 8, 8); b.winX(2, 76, 20, 6);   // the upper galleries overlook the atrium
    b.hatch(2, 20, 12); b.hatch(2, 92, 58); b.hatch(1, 16, 40); b.hatch(1, 92, 12);
    // the glass roof on steel ribs
    B.box(b.X(37), b.roofY, b.Z(1), b.X(75), b.roofY, b.Z(35), M.GLASS);
    for (let lx = 37; lx <= 75; lx += 6) B.box(b.X(lx), b.roofY, b.Z(1), b.X(lx), b.roofY, b.Z(35), M.METAL);
    // a long-necked fossil skeleton on a low plinth, facing east
    b.box(1, 42, 5, 70, 14, 0, 0, M.MARBLE);
    const bone = (a, c) => B.line(b.X(a[0]), 13 + a[1], b.Z(a[2]), b.X(c[0]), 13 + c[1], b.Z(c[2]), M.BONE);
    bone([44, 3, 9], [50, 9, 9]); bone([50, 9, 9], [62, 11, 9]); bone([62, 11, 9], [68, 19, 9]);
    for (const [x, z] of [[52, 7], [52, 11], [60, 7], [60, 11]]) { bone([x, 1, z], [x, 9, z]); b.box(1, x, z, x + 1, z + 1, 1, 1, M.BONE); }
    for (let x = 52; x <= 60; x += 2) for (const s of [-1, 1]) { bone([x, 10, 9 + s], [x, 9, 9 + 2 * s]); bone([x, 9, 9 + 2 * s], [x, 6, 9 + 3 * s]); bone([x, 6, 9 + 3 * s], [x, 5, 9 + 2 * s]); }
    b.box(1, 67, 8, 71, 10, 19, 21, M.BONE); b.box(1, 70, 8, 70, 8, 20, 20, M.DARK); b.box(1, 70, 10, 70, 10, 20, 20, M.DARK);
    // furniture 1F
    b.box(1, 40, 20, 46, 20, 0, 1, M.WOOD); b.box(1, 66, 20, 72, 20, 0, 1, M.WOOD); b.counter(1, 62, 40, 69, 42, M.TRIM);
    for (const [x, z] of [[6, 6], [24, 6], [6, 16]]) { b.box(1, x, z, x + 4, z + 4, 0, 2, M.TRIM); b.box(1, x, z, x + 4, z + 4, 3, 5, M.GLASS); }
    b.tank(1, 26, 20, 3, 1, M.STONE);
    b.box(1, 4, 32, 12, 33, 0, 3, M.TRIM); b.box(1, 4, 32, 12, 33, 4, 5, M.GLASS); b.box(1, 24, 32, 32, 33, 0, 3, M.TRIM); b.box(1, 24, 32, 32, 33, 4, 5, M.GLASS); b.box(1, 24, 42, 28, 46, 0, 4, M.STONE);
    b.tank(1, 84, 8, 1, 3, M.POT); b.tank(1, 90, 8, 1, 3, M.POT); b.box(1, 96, 16, 104, 20, 0, 3, M.STONE); b.box(1, 82, 20, 84, 22, 0, 9, M.MARBLE);
    b.shelf(1, 82, 34, 90, 35, 5); b.shelf(1, 96, 34, 104, 35, 5); b.counter(1, 80, 42, 88, 44);
    b.table(1, 3, 50, 7, 54); b.table(1, 20, 50, 24, 54); b.table(1, 3, 64, 7, 68); b.counter(1, 20, 65, 26, 69);
    b.box(1, 35, 64, 41, 64, 6, 6, M.PIPE); b.box(1, 35, 64, 41, 64, 2, 5, M.FAB_BLUE); b.counter(1, 30, 54, 40, 55, M.TRIM);
    b.desk(1, 62, 58, 70, 62); b.box(1, 57, 56, 57, 66, 2, 7, M.SCREEN);
    b.crates(1, 98, 58, 4); b.box(1, 100, 50, 106, 54, 0, 4, M.CRATE);
    // furniture 2F
    b.box(2, 8, 14, 16, 15, 0, 1, M.FAB_RED); b.box(2, 1, 2, 1, 7, 3, 7, M.BLUE_PAINT); b.box(2, 1, 18, 1, 24, 3, 7, M.RED_PAINT); b.box(2, 4, 27, 10, 27, 3, 7, M.FELT); b.box(2, 24, 27, 30, 27, 3, 7, M.LINE);
    b.table(2, 10, 34, 24, 42, M.WOOD); b.box(2, 30, 32, 32, 34, 0, 1, M.TRIM); b.box(2, 30, 32, 32, 34, 2, 4, M.BLUE_PAINT);
    b.box(2, 82, 6, 90, 6, 1, 9, M.FAB_RED); b.box(2, 96, 6, 104, 6, 1, 9, M.FAB_BLUE); b.box(2, 88, 16, 92, 20, 0, 2, M.TRIM); b.box(2, 88, 16, 92, 20, 3, 5, M.GLASS);
    b.desk(2, 90, 36, 100, 40); b.shelf(2, 104, 36, 105, 42, 8); b.couch(2, 82, 33, 88, 37, M.FAB_RED, 'w');
    b.table(2, 6, 54, 16, 58, M.METAL); b.table(2, 22, 54, 32, 58, M.METAL); b.box(2, 8, 64, 9, 66, 0, 6, M.WOOD);
    b.table(2, 63, 54, 73, 62, M.TRIM);
    b.box(2, 100, 52, 108, 52, 0, 9, M.WHITE); b.box(2, 86, 56, 86, 56, 0, 7, M.PIPE); b.box(2, 85, 55, 87, 57, 8, 8, M.LAMP);
    // furniture B
    b.crates(0, 6, 8, 6); b.box(0, 24, 20, 34, 26, 0, 3, M.CRATE); b.box(0, 24, 8, 32, 10, 0, 1, M.BONE);
    b.box(0, 44, 2, 68, 3, 0, 8, M.METAL); b.box(0, 50, 16, 62, 22, 0, 3, M.METAL); b.box(0, 51, 17, 61, 21, 4, 5, M.GLASS);
    b.table(0, 78, 6, 90, 12, M.METAL); b.tank(0, 100, 24, 3, 5, M.METAL);
    b.box(0, 2, 40, 109, 40, 10, 10, M.PIPE);
    b.box(0, 8, 56, 20, 66, 0, 8, M.BOILER); b.box(0, 26, 56, 34, 62, 0, 6, M.METAL);
    b.crates(0, 60, 56, 6); b.crates(0, 66, 64, 2);
    b.rack(0, 86, 54, 88, 66); b.rack(0, 94, 54, 96, 66);
    b.cam(1, 38, 2, -135, 'ATRIUM'); b.cam(2, 38, 46, -90, 'MEZZANINE'); b.cam(0, 2, 42, -90, 'LOWER HALL'); b.cam(1, 110, 30, 135, 'GIFT SHOP');
    // the front steps and portico
    B.obox(b.X(36), 39, b.X(76), 47, 0, 0, M.MARBLE);
    for (const lx of [38, 46, 64, 72]) B.obox(b.X(lx), 41, b.X(lx) + 1, 42, 1, 14, M.MARBLE);
    B.obox(b.X(36), 39, b.X(76), 47, 15, 16, M.MARBLE);
    // fountain on the plaza
    for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) { const d = dx * dx + dz * dz; if (d <= 81) B.obox(104 + dx, 24 + dz, 104 + dx, 24 + dz, 0, d > 64 ? 2 : 0, d > 64 ? M.STONE : M.WATER); }
    B.drum(104, 24, 2, 0, 7, M.MARBLE); B.drum(104, 24, 4, 7, 7, M.MARBLE); B.drum(104, 24, 3, 7, 7, M.WATER);
    // sculpture garden, hedges, the service lane, the park
    for (const [x, z] of [[10, 60], [28, 70], [12, 128], [30, 112]]) { B.obox(x, z, x + 3, z + 3, 0, 3, M.MARBLE); B.obox(x + 1, z + 1, x + 2, z + 2, 4, 9, M.BRASS); B.obox(x, z + 1, x + 3, z + 2, 8, 9, M.BRASS); }
    B.obox(20, 50, 21, 88, 0, 3, M.LEAF); B.obox(20, 104, 21, 140, 0, 3, M.LEAF);
    B.truck(170, 20, 'z', M.CAR_W); B.dumpster(190, 120); B.obox(188, 60, 195, 67, 0, 3, M.CRATE);
    for (const [x, z] of [[20, 150], [60, 140], [80, 158], [130, 150], [160, 136], [190, 156], [196, 20], [16, 20], [60, 26]]) B.tree(x, z, 16 + (x % 4));
    B.obox(96, 162, 98, 164, 0, 9, M.MARBLE); B.obox(110, 162, 112, 164, 0, 9, M.MARBLE); B.fence(0, 163, 95, 163, M.FENCE); B.fence(113, 163, 207, 163, M.FENCE);
    B.obox(70, 130, 76, 131, 0, 1, M.WOOD); B.obox(136, 130, 142, 131, 0, 1, M.WOOD);
    B.lamp(44, 44); B.lamp(164, 44); B.lamp(44, 124); B.lamp(164, 124);
    B.cam(126, 26, 30, 180, -14, 'PLAZA'); B.box(126, 13, 30, 126, 25, 30, M.PIPE);
    B.cam(184, 25, 140, 45, -14, 'PARK'); B.box(184, 13, 140, 184, 24, 140, M.PIPE);
    B.spawn('Fountain Plaza', 104, 6, 0); B.spawn('Sculpture Garden', 8, 96, -90); B.spawn('Service Lane', 198, 84, 90); B.spawn('Park Gate', 104, 156, 180);
    B.meta.bombs = [['Vault', 'Fossil Storage'], ['Ancient Gallery', 'Gift Shop'], ['Portrait Gallery', 'Map Room'], ['Board Room', 'Photo Studio']];
    B.meta.secure = ['Vault', "Curator's Office", 'Security Office', 'Restoration Lab'];
    B.meta.hostage = ["Curator's Office", 'Conservation', 'Fossil Gallery', 'Board Room'];
    B.meta.defSpawns = ['Server Room', 'Cafe', 'Textile Gallery'];   // defender spawn rooms: different floors or ends of the building
    return B;
  }

  /* ======================================================================= RANGE */
  function range() {
    const B = new Builder('range', 'TRAINING GROUNDS', 160, 48, 200);
    B.meta.desc = 'Firing lanes, a breach house and a drone course.';
    B.theme(THEMES.range);
    B.ground(M.GRAVEL);
    B.surf(0, 0, 70, 199, M.CONCRETE);
    // firing lanes: shooters at z=12, targets north
    B.obox(2, 14, 68, 15, 0, 3, M.CONCRETE);
    for (let x = 2; x <= 68; x += 11) B.obox(x, 4, x, 14, 0, 9, M.TRIM);
    B.obox(2, 4, 68, 14, 10, 10, M.ROOF);
    B.obox(0, 0, 0, 199, 0, 14, M.CONCRETE); B.obox(70, 16, 70, 120, 0, 14, M.CONCRETE);
    B.obox(84, 46, 100, 47, 0, 3, M.CONCRETE);
    B.obox(0, 199, 70, 199, 0, 20, M.SANDBAG);
    for (const d of [5, 10, 20, 35, 50]) { const z = 14 + d * 4; B.obox(3, z, 4, z, 0, 0, M.LINE); B.surf(1, z, 69, z, M.LINE); }
    // breach house
    const h = B.building(96, 60, 40, 32, { lo: 1, hi: 1, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    h.room(1, 'Front Room', 0, 0, 20, 31, { wall: M.DRY_SAGE });
    h.room(1, 'Back Room', 20, 0, 39, 31, { wall: M.DRY_SAGE });
    h.doorZ(1, 0, 8); h.doorX(1, 20, 12); h.winZ(1, 0, 28, 5); h.winX(1, 39, 20, 5); h.winZ(1, 31, 8, 5);
    h.hatch(2, 28, 12);
    // pre-reinforced panel on the back room's east wall
    B.box(h.X(39), 13, h.Z(4), h.X(39), 23, h.Z(10), M.REINF);
    h.table(1, 26, 18, 34, 24); h.crates(1, 4, 22, 4);
    // stairs to the roof (outside, west side)
    for (let i = 0; i < 12; i++) B.box(h.X(-6), 13, h.Z(4 + i), h.X(-2), 13 + i, h.Z(4 + i), M.CONCRETE);
    B.box(h.X(-6), 13, h.Z(16), h.X(-1), 24, h.Z(19), M.CONCRETE);
    // drone course: low tunnel
    B.obox(84, 120, 140, 121, 0, 6, M.CONCRETE); B.obox(84, 128, 140, 129, 0, 6, M.CONCRETE); B.obox(84, 120, 140, 129, 3, 3, M.CONCRETE);
    B.obox(84, 120, 140, 129, 4, 6, 0); B.obox(84, 122, 140, 127, 0, 2, 0);
    for (let x = 92; x < 140; x += 12) B.obox(x, 122, x, 127, 0, 1, M.CRATE);
    B.obox(84, 120, 140, 129, 4, 6, (x, y, z, c) => -1);
    B.lamp(80, 40); B.lamp(140, 40); B.lamp(80, 110);
    B.spawn('Range', 29, 8, 180); B.spawn('House', 116, 30, 180);
    B.meta.secure = ['Back Room']; B.meta.hostage = ['Back Room']; B.meta.bombs = [['Back Room', 'Front Room']];
    return B;
  }

  const LIST = [
    { id: 'roadhouse', name: 'ROADHOUSE', fn: roadhouse, blurb: 'Highway diner & garage · dusk' },
    { id: 'lodge', name: 'SUMMIT LODGE', fn: lodge, blurb: 'Mountain ski lodge · snow' },
    { id: 'homestead', name: 'HOMESTEAD', fn: homestead, blurb: 'Farm compound & barn · afternoon' },
    { id: 'checkpoint', name: 'CHECKPOINT', fn: checkpoint, blurb: 'Border inspection station · noon' },
    { id: 'helix', name: 'HELIX LABS', fn: helix, blurb: 'Island research campus · night' },
    { id: 'cannery', name: 'CANNERY', fn: cannery, blurb: 'Harbour fish cannery · foggy morning' },
    { id: 'observatory', name: 'OBSERVATORY', fn: observatory, blurb: 'Mountaintop telescope dome · starry night' },
    { id: 'depot', name: 'RAIL DEPOT', fn: depot, blurb: 'Station & freight tunnel · rainy dusk' },
    { id: 'museum', name: 'MUSEUM', fn: museum, blurb: 'Natural-history museum · evening' },
  ];

  /* ---- attacker spawns. Every map has four, one off each side of the main building, standing
     27 m from the nearest building wall (25 m from the nearest of the five spots game.js spreads
     a team over). The map grows to make room: after the stretch its edge ground is carried
     outward and everything in the metadata shifts with it. Each spawn gets one cover structure
     built for the map's setting, between it and the building, and every perimeter fence on the
     way in from it gets a gate. */
  const SPAWN_D = 108, SPAWN_BEHIND = 30, SPAWN_LAT = 32, SPAWN_AHEAD = 22;
  // per side: u runs across the spawn, v points at the building
  const FRAME = {
    N: { ux: 1, uz: 0, vx: 0, vz: 1 }, S: { ux: -1, uz: 0, vx: 0, vz: -1 },
    W: { ux: 0, uz: -1, vx: 1, vz: 0 }, E: { ux: 0, uz: 1, vx: -1, vz: 0 },
  };
  /* cover structures: b(u0, u1, v0, v1, h0, h1, m) fills a box, in voxels, with h above the ground.
     Each one stands 2.5-5 m in front of the spawn, about 11 m across and 3.5 m tall, and shows its
     solid side to the building. */
  const COVER = {
    // a semi-trailer parked broadside, its tractor at one end
    trailer(b) {
      b(-20, 17, 11, 19, 2, 14, M.CONT_B); b(-20, 17, 11, 11, 0, 1, M.DARK); b(-20, 17, 19, 19, 0, 1, M.DARK); b(-20, 17, 11, 11, 9, 9, M.WHITE);
      for (const u of [-17, -12, 7, 12]) b(u, u + 2, 10, 20, 0, 1, M.TIRE);
      b(18, 26, 11, 19, 1, 11, M.CAR_R); b(19, 25, 12, 18, 12, 12, M.CAR_R); b(26, 26, 12, 18, 7, 9, M.GLASS); b(18, 26, 10, 20, 0, 1, M.TIRE);
    },
    // a log woodshed, open toward the spawn, stacked with cut logs
    woodshed(b) {
      b(-22, 22, 18, 19, 0, 13, M.LOGWALL); b(-22, -21, 10, 17, 0, 13, M.LOGWALL); b(21, 22, 10, 17, 0, 13, M.LOGWALL);
      b(-20, 20, 13, 17, 0, 8, M.LOGWALL); b(-20, 20, 13, 13, 0, 8, M.WOOD);
      b(-23, 23, 9, 20, 14, 14, M.ROOF); b(-23, 23, 9, 20, 15, 15, M.SNOW);
    },
    // a hay shelter: a field-stone back wall, bales stacked against it, a lean-to roof on posts
    haywall(b) {
      b(-22, 22, 17, 19, 0, 13, M.STONE); b(-22, -21, 10, 16, 0, 13, M.STONE); b(21, 22, 10, 16, 0, 13, M.STONE);
      b(-20, 20, 11, 16, 0, 7, M.HAY); b(-18, 18, 12, 16, 8, 13, M.HAY);
      b(-23, 23, 9, 19, 14, 14, M.ROOF);
    },
    // a site office cabin with its door and windows on the spawn side
    cabin(b) {
      b(-20, 20, 10, 19, 0, 12, M.STUCCO); b(-21, 21, 9, 20, 13, 13, M.METAL);
      b(-2, 1, 10, 10, 0, 8, M.BLUE_PAINT); b(-14, -8, 10, 10, 5, 8, M.DARK); b(8, 14, 10, 10, 5, 8, M.DARK);
      b(-4, 3, 13, 17, 14, 18, M.WHITE); b(15, 18, 9, 9, 8, 11, M.METAL);
    },
    // a corrugated equipment shelter with a lit stripe and a roller door
    shelter(b) {
      b(-22, 22, 10, 19, 0, 13, M.CORRUGATE); b(-23, 23, 9, 20, 14, 14, M.PANEL_DARK);
      b(-22, 22, 10, 10, 11, 11, M.NEON_B); b(-6, 5, 10, 10, 0, 9, M.SHUTTER);
    },
    // a boat shed with a pitched roof and big red doors
    boatshed(b) {
      b(-22, 22, 10, 19, 0, 11, M.CORRUGATE);
      b(-23, 23, 9, 20, 12, 12, M.RUST); b(-23, 23, 11, 18, 13, 13, M.RUST); b(-23, 23, 13, 16, 14, 14, M.RUST);
      b(-10, 9, 10, 10, 0, 9, M.RED_PAINT); b(-10, 9, 10, 10, 5, 5, M.WHITE);
    },
    // a snowcat garage, snow on its roof, fuel drums by the door
    garage(b) {
      b(-22, 22, 10, 19, 0, 12, M.CORRUGATE); b(-23, 23, 9, 20, 13, 13, M.METAL); b(-23, 23, 10, 19, 14, 14, M.SNOW);
      b(-8, 7, 10, 10, 0, 9, M.SHUTTER); b(12, 14, 7, 9, 0, 3, M.RED_PAINT); b(16, 18, 7, 9, 0, 3, M.RED_PAINT);
    },
    // a freight wagon left on a stub of siding
    boxcar(b) {
      for (let u = -26; u <= 26; u += 3) b(u, u, 11, 19, -1, -1, M.WOOD);
      b(-26, 26, 12, 12, 0, 0, M.RAIL); b(-26, 26, 18, 18, 0, 0, M.RAIL);
      b(-22, 22, 11, 19, 1, 15, M.RUST); b(-21, 21, 12, 18, 16, 16, M.RUST);
      for (const u of [-18, -14, 13, 17]) b(u, u + 1, 10, 20, 1, 2, M.DARK);
      b(-4, 3, 10, 10, 3, 13, M.CAR_K); b(-23, -23, 13, 17, 4, 5, M.DARK); b(23, 23, 13, 17, 4, 5, M.DARK);
    },
    // a brick garden wall with marble pillars and urns, a clipped hedge along its foot
    gardenwall(b) {
      b(-22, 22, 15, 17, 0, 12, M.BRICK); b(-23, 23, 14, 18, 13, 13, M.MARBLE);
      for (const u of [-24, -1, 22]) { b(u, u + 2, 14, 18, 0, 15, M.MARBLE); b(u, u + 2, 15, 17, 16, 17, M.POT); }
      b(-20, 20, 11, 13, 0, 5, M.LEAF);
    },
  };
  // where an outbuilding still looks past one end of a cover, that end gets a return: [wall, cap]
  const WING = { trailer: [M.CONT_R, M.CONT_R], woodshed: [M.LOGWALL, M.ROOF], haywall: [M.STONE, M.STONE], cabin: [M.STUCCO, M.METAL], shelter: [M.CORRUGATE, M.PANEL_DARK], boatshed: [M.CORRUGATE, M.RUST], garage: [M.CORRUGATE, M.SNOW], boxcar: [M.WOOD, M.RUST], gardenwall: [M.BRICK, M.MARBLE] };
  const COVER_OF = { roadhouse: 'trailer', lodge: 'woodshed', homestead: 'haywall', checkpoint: 'cabin', helix: 'shelter', cannery: 'boatshed', observatory: 'garage', depot: 'boxcar', museum: 'gardenwall' };

  /* move every coordinate in the metadata by (dx, dz) voxels */
  function shiftMeta(meta, dx, dz) {
    for (const r of meta.rooms) { r.x0 += dx; r.x1 += dx; r.z0 += dz; r.z1 += dz; r.cx += dx * VS; r.cz += dz * VS; }
    for (const o of meta.openings) { if (o.axis === 'z') { o.line += dz; o.a0 += dx; o.a1 += dx; } else { o.line += dx; o.a0 += dz; o.a1 += dz; } }
    for (const h of meta.hatches) { h.x += dx; h.z += dz; }
    for (const f of meta.flights) { f.x += dx; f.z += dz; f.ex += dx; f.ez += dz; }
    for (const p of [...meta.spawns, ...meta.cams]) { p.x += dx * VS; p.z += dz * VS; }
    for (const b of meta.buildings) { b.x += dx; b.z += dz; b.x1 += dx; b.z1 += dz; }
    for (const f of meta.fences) { f.x0 += dx; f.x1 += dx; f.z0 += dz; f.z1 += dz; }
  }
  /* grow the world by pw/pn/pe/ps voxels on its west/north/east/south sides: the new ground is the
     edge's ground carried straight out (bedrock, subsoil and its surface, never anything on it) */
  function pad(B, pw, pn, pe, ps) {
    const w = B.w, W = w.W, H = w.H, D = w.D, v = w.v, W2 = W + pw + pe, D2 = D + pn + ps;
    const nw = new VW.World(W2, H, D2); nw.light = w.light;
    const nv = nw.v, g = B.meta.ground || { top: M.GRASS, sub: M.DIRT };
    // broad surfaces carry on; painted lines, sleepers, puddles and the like give way to plain ground
    const broad = new Set([M.GRASS, M.DIRT, M.SNOW, M.SAND, M.GRAVEL, M.ASPHALT, M.DOCK, M.CONCRETE, M.ICE, M.STONE]);
    for (let z2 = 0; z2 < D2; z2++) {
      const z = z2 - pn, zc = Math.min(D - 1, Math.max(0, z));
      for (let x2 = 0; x2 < W2; x2++) {
        const x = x2 - pw;
        if (z >= 0 && z < D && x >= 0 && x < W) {
          for (let y = 0; y < H; y++) { const m = v[(y * D + z) * W + x]; if (m) nv[(y * D2 + z2) * W2 + x2] = m; }
          continue;
        }
        const top = v[(GY * D + zc) * W + Math.min(W - 1, Math.max(0, x))];
        nv[z2 * W2 + x2] = M.BEDROCK;
        for (let y = 1; y < GY; y++) nv[(y * D2 + z2) * W2 + x2] = g.sub;
        nv[(GY * D2 + z2) * W2 + x2] = broad.has(top) ? top : g.top;
      }
    }
    B.w = nw; B.W = W2; B.D = D2;
    shiftMeta(B.meta, pw, pn);
  }
  /* where the straight way in from a spawn crosses a perimeter fence, open a 5 m gate */
  function gates(B, plan, bx, bz) {
    const GH = 10;
    for (const f of B.meta.fences) for (const p of plan) {
      const alongX = f.z0 === f.z1;
      let ix, iz;
      if (alongX) {
        iz = f.z0; if ((p.z - iz) * (bz - iz) > 0) continue;
        ix = Math.round(p.x + (bx - p.x) * (iz - p.z) / ((bz - p.z) || 1e-9));
        if (ix < Math.min(f.x0, f.x1) - 2 || ix > Math.max(f.x0, f.x1) + 2) continue;
      } else {
        ix = f.x0; if ((p.x - ix) * (bx - ix) > 0) continue;
        iz = Math.round(p.z + (bz - p.z) * (ix - p.x) / ((bx - p.x) || 1e-9));
        if (iz < Math.min(f.z0, f.z1) - 2 || iz > Math.max(f.z0, f.z1) + 2) continue;
      }
      const clear = (x, y, z, cur) => cur === f.m ? 0 : -1;
      if (alongX) { B.w.fill(ix - GH, GY + 1, iz - 2, ix + GH, GY + 2 + f.h, iz + 2, clear); for (const x of [ix - GH - 1, ix + GH + 1]) B.obox(x, iz, x, iz, 0, f.h + 1, f.m); }
      else { B.w.fill(ix - 2, GY + 1, iz - GH, ix + 2, GY + 2 + f.h, iz + GH, clear); for (const z of [iz - GH - 1, iz + GH + 1]) B.obox(ix, z, ix, z, 0, f.h + 1, f.m); }
    }
  }
  /* where a defender could look out from: just inside every exterior door and window, and the edge
     of every roof (standing just inside the parapet). Metres. */
  function viewpoints(meta, w) {
    const out = [], V3 = THREE.Vector3;
    for (const op of meta.openings) {
      if (!op.ext || op.L === 0) continue;
      const mid = (op.a0 + op.a1 + 1) / 2 * VS, line = (op.line + 0.5) * VS, floorY = (op.L * 12 + 1) * VS;
      for (const d of [0.5, 1.5, 3, 5, 8]) for (const lat of [-1.5, 0, 1.5]) for (const h of [1.1, 1.65]) {
        const x = op.axis === 'x' ? line - op.nrm * d : mid + lat, z = op.axis === 'z' ? line - op.nrm * d : mid + lat;
        const m = w.get(Math.floor(x * 4), Math.floor((floorY + h) * 4), Math.floor(z * 4));
        if (!m || DATA.MAT[m].see) out.push(new V3(x, floorY + h, z));
      }
    }
    for (const b of meta.buildings) {
      const x0 = b.x / 4 + 0.8, x1 = (b.x1 + 1) / 4 - 0.8, z0 = b.z / 4 + 0.8, z1 = (b.z1 + 1) / 4 - 0.8, y = (b.roofY + 1) * VS + 1.65;
      for (let t = x0; t <= x1; t += 3) out.push(new V3(t, y, z0), new V3(t, y, z1));
      for (let t = z0; t <= z1; t += 3) out.push(new V3(x0, y, t), new V3(x1, y, t));
    }
    return out;
  }
  /* the five spots game.js spreads a team over, at crouched and standing eye height */
  function spawnSpots(x, y, z) {
    const out = [];
    for (let i = 0; i < 5; i++) { const a = i * 1.3, r = i ? 1.5 : 0; for (const h of [0.6, 1.65]) out.push(new THREE.Vector3(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r)); }
    return out;
  }
  function placeSpawns(B) {
    const meta = B.meta, bs = meta.buildings, main = bs[0];
    const cx = (main.x + main.x1 + 1) / 2, cz = (main.z + main.z1 + 1) / 2;
    const wallDist = (x, z) => Math.min(...bs.map(b => Math.hypot(Math.max(b.x - x, 0, x - b.x1 - 1), Math.max(b.z - z, 0, z - b.z1 - 1))));
    // each spawn keeps its name and the side of the building it was given
    const plan = meta.spawns.map(s => {
      const dx = s.x / VS - cx, dz = s.z / VS - cz;
      const sd = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'S' : 'N'), f = FRAME[sd];
      let x = sd === 'W' ? main.x - SPAWN_D : sd === 'E' ? main.x1 + 1 + SPAWN_D : Math.round(cx);
      let z = sd === 'N' ? main.z - SPAWN_D : sd === 'S' ? main.z1 + 1 + SPAWN_D : Math.round(cz);
      while (wallDist(x + 0.5, z + 0.5) < SPAWN_D) { x -= f.vx; z -= f.vz; }   // an outbuilding on this side: step further out
      return { s, sd, f, x, z };
    });
    if (new Set(plan.map(p => p.sd)).size !== plan.length) throw new Error(meta.id + ': two attacker spawns on one side');
    // grow the map until every spawn has its cover ahead of it and open ground behind
    let x0 = 0, z0 = 0, x1 = B.W - 1, z1 = B.D - 1;
    for (const p of plan) for (const u of [-SPAWN_LAT, SPAWN_LAT]) for (const v of [-SPAWN_BEHIND, SPAWN_AHEAD]) {
      const x = p.x + u * p.f.ux + v * p.f.vx, z = p.z + u * p.f.uz + v * p.f.vz;
      x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
    }
    const pw = -x0, pn = -z0;
    if (pw || pn || x1 >= B.W || z1 >= B.D) pad(B, pw, pn, Math.max(0, x1 - (B.W - 1)), Math.max(0, z1 - (B.D - 1)));
    for (const p of plan) { p.x += pw; p.z += pn; }
    if (meta.afterPad) meta.afterPad(B, plan);
    const kind = COVER_OF[meta.id], kit = COVER[kind], wing = WING[kind], bx = cx + pw, bz = cz + pn, views = viewpoints(meta, B.w);
    for (const p of plan) {
      const b = (u0, u1, v0, v1, h0, h1, m) => {
        const ax = p.x + u0 * p.f.ux + v0 * p.f.vx, az = p.z + u0 * p.f.uz + v0 * p.f.vz, ex = p.x + u1 * p.f.ux + v1 * p.f.vx, ez = p.z + u1 * p.f.uz + v1 * p.f.vz;
        B.obox(Math.min(ax, ex), Math.min(az, ez), Math.max(ax, ex), Math.max(az, ez), h0, h1, m);
      };
      b(-SPAWN_LAT, SPAWN_LAT, -SPAWN_BEHIND, SPAWN_AHEAD, 0, 40, 0);   // clear ground for the team and the cover
      kit(b);
      // an outbuilding off to one side can look past the end of the cover: close that end
      const spots = spawnSpots((p.x + 0.5) * VS, (GY + 1) * VS, (p.z + 0.5) * VS), done = {};
      for (let pass = 0; pass < 2; pass++) {
        let seen = null;
        for (const q of views) { if (spots.some(t => B.w.los(q, t))) { seen = q; break; } }
        if (!seen) break;
        const sg = (seen.x * 4 - p.x) * p.f.ux + (seen.z * 4 - p.z) * p.f.uz >= 0 ? 1 : -1;
        if (done[sg]) break;
        done[sg] = true;
        const u0 = sg > 0 ? 27 : -30;
        b(u0, u0 + 3, 0, 19, 0, 13, wing[0]); b(u0 - (sg > 0 ? 0 : 1), u0 + 3 + (sg > 0 ? 1 : 0), -1, 20, 14, 14, wing[1]);
      }
      p.s.x = (p.x + 0.5) * VS; p.s.y = (GY + 1) * VS; p.s.z = (p.z + 0.5) * VS;
      p.s.yaw = Math.atan2(-(bx - p.x), -(bz - p.z));
      delete p.s.covers;
    }
    gates(B, plan, bx, bz);
  }

  /* Stretch a finished map by about `s` in x and z: duplicate voxel planes that don't carry a wall,
     so rooms, corridors, doorways and the ground between buildings and spawns all get roomier,
     while walls stay one voxel thick and staircases and hatches keep their exact shape. Every
     coordinate in the map's metadata moves with the voxels. */
  const STRETCH = 1.4;
  function stretch(B, s) {
    const w = B.w, W = w.W, H = w.H, D = w.D, v = w.v, T = 24;
    const at = (x, y, z) => v[(y * D + z) * W + x];
    const pick = (n, axis) => {
      const bad = new Uint8Array(n);
      bad[0] = bad[n - 1] = 1;
      // a plane crossing a thin wall lengthwise would thicken it
      for (let c = 1; c < n - 1; c++) {
        let thin = 0;
        outer: for (let y = 1; y < H; y++) {
          if (axis === 'x') { for (let z = 0; z < D; z++) if (at(c, y, z) && !at(c - 1, y, z) && !at(c + 1, y, z) && ++thin > T) break outer; }
          else { for (let x = 0; x < W; x++) if (at(x, y, c) && !at(x, y, c - 1) && !at(x, y, c + 1) && ++thin > T) break outer; }
        }
        if (thin > T) bad[c] = 1;
      }
      const keep = (a, b) => { for (let c = Math.max(0, a); c <= Math.min(n - 1, b); c++) bad[c] = 1; };
      for (const h of B.meta.hatches) { const c0 = axis === 'x' ? h.x : h.z; keep(c0 - 1, c0 + 4); }
      // (a plane along a flight's run just lengthens one tread: the stair gets a little gentler)
      const dup = new Uint8Array(n); let acc = 0;
      for (let c = 1; c < n - 1; c++) { if (bad[c]) continue; acc += s - 1; if (acc >= 1) { dup[c] = 1; acc -= 1; } }
      const map = new Int32Array(n + 1); let k = 0;
      for (let c = 0; c < n; c++) { map[c] = c + k; if (dup[c]) k++; }
      map[n] = n + k;
      return { dup, map, n2: n + k };
    };
    const X = pick(W, 'x'), Z = pick(D, 'z'), W2 = X.n2, D2 = Z.n2;
    const nw = new VW.World(W2, H, D2); nw.light = w.light;
    const nv = nw.v;
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) {
      const tz = Z.map[z], nzc = Z.dup[z] ? 2 : 1;
      for (let x = 0; x < W; x++) {
        const m = v[(y * D + z) * W + x]; if (!m) continue;
        const tx = X.map[x], nxc = X.dup[x] ? 2 : 1;
        for (let a = 0; a < nzc; a++) for (let b = 0; b < nxc; b++) nv[(y * D2 + tz + a) * W2 + tx + b] = m;
      }
    }
    B.w = nw; B.W = W2; B.D = D2;
    // metadata: voxel indices, inclusive voxel ranges and metres
    const vx = c => X.map[c], vz = c => Z.map[c];
    const hx = c => X.map[c] + X.dup[c], hz = c => Z.map[c] + Z.dup[c];   // last voxel of a range
    const mx = m => { const c = Math.floor(m * 4); return (X.map[c] + (m * 4 - c) * (X.dup[c] ? 2 : 1)) * VS; };
    const mz = m => { const c = Math.floor(m * 4); return (Z.map[c] + (m * 4 - c) * (Z.dup[c] ? 2 : 1)) * VS; };
    const meta = B.meta;
    for (const r of meta.rooms) {
      r.x0 = vx(r.x0); r.x1 = hx(r.x1); r.z0 = vz(r.z0); r.z1 = hz(r.z1);
      r.cx = (r.x0 + r.x1 + 1) / 2 * VS; r.cz = (r.z0 + r.z1 + 1) / 2 * VS;
    }
    for (const o of meta.openings) {
      if (o.axis === 'z') { o.line = vz(o.line); o.a0 = vx(o.a0); o.a1 = hx(o.a1); }
      else { o.line = vx(o.line); o.a0 = vz(o.a0); o.a1 = hz(o.a1); }
    }
    for (const h of meta.hatches) { h.x = vx(h.x); h.z = vz(h.z); }
    for (const f of meta.flights) {
      // first and last step, each taken at its outer edge
      const sx = f.dir === '-x' ? hx : vx, sz = f.dir === '-z' ? hz : vz, ex = f.dir === '+x' ? hx : vx, ez = f.dir === '+z' ? hz : vz;
      f.x = sx(f.x); f.z = sz(f.z); f.ex = ex(f.ex); f.ez = ez(f.ez);
    }
    for (const p of [...meta.spawns, ...meta.cams]) { p.x = mx(p.x); p.z = mz(p.z); }
    for (const b of meta.buildings) { b.x = vx(b.x); b.z = vz(b.z); b.x1 = hx(b.x1); b.z1 = hz(b.z1); }
    for (const f of meta.fences) {
      const lx = f.x0 === f.x1, lz = f.z0 === f.z1;   // a fence along z keeps one x, and the other way round
      f.x0 = vx(f.x0); f.x1 = lx ? f.x0 : hx(f.x1); f.z0 = vz(f.z0); f.z1 = lz ? f.z0 : hz(f.z1);
    }
  }

  /* add a map, or replace one of the same id (other files: js/maps-*.js).
       { id, name, fn, blurb, cover: a COVER kit name, tint: 'rgba(...)' for its menu card, stretch: 1.4 } */
  function define(def) {
    const i = LIST.findIndex(m => m.id === def.id);
    if (i >= 0) LIST[i] = Object.assign({}, LIST[i], def); else LIST.push(def);
    if (def.cover) COVER_OF[def.id] = def.cover;
  }
  function build(id) {
    const def = id === 'range' ? { fn: range } : LIST.find(m => m.id === id);
    const B = def.fn();
    if (id !== 'range') { const s = def.stretch == null ? STRETCH : def.stretch; if (s > 1) stretch(B, s); placeSpawns(B); }
    const meta = B.meta, w = B.w;
    meta.world = w;
    meta.buildings = meta.buildings.map(b => ({ x0: b.x, z0: b.z, x1: b.x1, z1: b.z1, lo: b.lo, hi: b.hi, roofY: b.roofY }));
    meta.roomByName = {};
    for (const r of meta.rooms) (meta.roomByName[r.name] = meta.roomByName[r.name] || []).push(r);
    meta.inside = p => {
      const x = p.x * 4, z = p.z * 4, y = p.y * 4;
      for (const b of meta.buildings) if (x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1 && y < b.roofY + 1) return true;
      return false;
    };
    meta.roomAt = p => {
      const x = Math.floor(p.x * 4), z = Math.floor(p.z * 4), y = Math.floor(p.y * 4 + 0.2);
      for (const r of meta.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && y >= r.y - 1 && y <= r.y + 10) return r;
      return null;
    };
    w.computeSky();
    w.snapshot();
    return meta;
  }

  window.MAPS = { LIST, THEMES, build, GY, VS, viewpoints, spawnSpots, Builder, Bld, COVER, WING, COVER_OF, define };
})();
