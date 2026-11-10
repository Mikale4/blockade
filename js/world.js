/* world.js -- the destructible voxel world.
   One voxel = 0.25 m. Storage is a flat Uint8Array of material ids (see DATA.MAT).
   Meshing is per 16^3 chunk with face culling, ambient occlusion and baked light
   (sun-facing shade + an "under a roof" indoor tint), drawn unlit.          */
(function () {
  'use strict';
  const { MAT, M, OOB } = DATA;
  const VS = 0.25, INV = 4, CS = 16;

  // faces: normal, 4 corner offsets (CCW from outside), baked sun shade
  const FACES = [
    { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.80 },
    { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.68 },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
    { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.52 },
    { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.90 },
    { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.74 },
  ];
  const AOV = [0.55, 0.72, 0.87, 1.0];
  // per face, per corner: offsets (from the outside neighbour cell) of side1, side2, corner
  const AOOFF = FACES.map(F => {
    const ax = F.d[0] !== 0 ? 0 : F.d[1] !== 0 ? 1 : 2;
    const ua = ax === 0 ? 1 : 0, va = ax === 2 ? 1 : 2;
    return F.c.map(cc => {
      const su = cc[ua] ? 1 : -1, sv = cc[va] ? 1 : -1;
      const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
      a[ua] = su; b[va] = sv; c[ua] = su; c[va] = sv;
      return [...a, ...b, ...c];
    });
  });

  // scratch buffers shared by every chunk build
  const MAXV = 140000;
  const POS = new Float32Array(MAXV * 3), COL = new Uint8Array(MAXV * 3), IDX = new Uint32Array(MAXV * 1.5 | 0);
  const GPOS = new Float32Array(30000 * 3), GCOL = new Uint8Array(30000 * 3), GIDX = new Uint32Array(45000);

  const baseRGB = MAT.map(m => m ? [((m.c >> 16) & 255) / 255, ((m.c >> 8) & 255) / 255, (m.c & 255) / 255] : [1, 0, 1]);
  const BOOKC = [[0.42, 0.29, 0.54], [0.6, 0.2, 0.18], [0.2, 0.38, 0.55], [0.75, 0.62, 0.3], [0.25, 0.45, 0.28], [0.8, 0.78, 0.7]];
  const H = U.hash3;

  /* colour of a voxel, before lighting */
  function patColor(m, x, y, z, out) {
    const b = baseRGB[m], p = MAT[m].pat;
    let k = 1 + (H(x, y, z) - 0.5) * 0.08;
    let r = b[0], g = b[1], bl = b[2];
    switch (p) {
      case 'brick': { const row = y, off = (row & 1) ? 1 : 0; const bid = Math.floor((x + z + off) / 2); k *= 0.88 + 0.22 * H(bid, row, 7); break; }
      case 'planks': { const along = (x + z * 7) ; const pl = Math.floor(((y & 0) + (x)) / 1); k *= 0.86 + 0.2 * H(pl, Math.floor(z / 6), 3); if (((z + (x & 1) * 3) % 6) === 0) k *= 0.85; break; }
      case 'plank': { k *= 0.82 + 0.25 * H(y, 11, 5) + (H(x, y, z) - 0.5) * 0.06; break; }
      case 'checker': { k *= ((x + z) & 1) ? 0.9 : 1.03; break; }
      case 'noise': { k = 1 + (H(x, y, z) - 0.5) * 0.18; break; }
      case 'plates': { const px = (x + z) % 4, py = y % 4; if (px === 0 || py === 0) k *= 0.78; else if (px === 2 && py === 2) k *= 1.15; break; }
      case 'ribs': { k *= ((x + z) & 1) ? 0.84 : 1.04; break; }
      case 'block': { const off = (y & 1) ? 2 : 0; k *= 0.92 + 0.1 * H(Math.floor((x + z + off) / 4), y, 2); break; }
      case 'grain': { k *= 0.9 + 0.12 * H(y, (x + z) >> 2, 9); break; }
      case 'logs': { k *= (y % 2 === 0) ? 0.86 : 1.06; k *= 0.94 + 0.1 * H(y >> 1, (x + z) >> 3, 4); break; }
      case 'stone': { k *= 0.8 + 0.35 * H(Math.floor((x + (y & 1)) / 2), y, Math.floor(z / 2)); break; }
      case 'siding': { k *= (y % 2 === 0) ? 0.88 : 1.04; break; }
      case 'books': { const c = BOOKC[Math.floor(H(x + z, y, 1) * BOOKC.length)]; r = c[0]; g = c[1]; bl = c[2]; break; }
    }
    out[0] = r * k; out[1] = g * k; out[2] = bl * k;
  }

  class World {
    constructor(W, Hh, D) {
      this.W = W; this.H = Hh; this.D = D;
      this.v = new Uint8Array(W * Hh * D);
      this.dmg = new Uint8Array(W * Hh * D);
      this.orig = null;
      this.sky = new Int16Array(W * D);
      this.ncx = Math.ceil(W / CS); this.ncy = Math.ceil(Hh / CS); this.ncz = Math.ceil(D / CS);
      this.chunks = new Array(this.ncx * this.ncy * this.ncz).fill(null);
      this.dirty = new Set();
      this.group = new THREE.Group();
      this.light = { out: [1, 1, 1], in: [0.68, 0.64, 0.58] };
      this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      this.gmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false });
      this.onBreak = null;    // (x,y,z,m) -> debris fx
      this.onChange = null;   // (x,y,z) -> nav etc.
      this.changed = 0;
    }
    idx(x, y, z) { return (y * this.D + z) * this.W + x; }
    get(x, y, z) {
      if (x < 0 || z < 0 || x >= this.W || z >= this.D) return OOB;
      if (y < 0) return M.BEDROCK;
      if (y >= this.H) return 0;
      return this.v[(y * this.D + z) * this.W + x];
    }
    /* raw set used by the map builder (no dirty tracking) */
    put(x, y, z, m) {
      if (x < 0 || z < 0 || y < 0 || x >= this.W || z >= this.D || y >= this.H) return;
      this.v[(y * this.D + z) * this.W + x] = m;
    }
    fill(x0, y0, z0, x1, y1, z1, m) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      for (let y = Math.max(0, y0); y <= Math.min(this.H - 1, y1); y++)
        for (let z = Math.max(0, z0); z <= Math.min(this.D - 1, z1); z++)
          for (let x = Math.max(0, x0); x <= Math.min(this.W - 1, x1); x++) {
            const mm = typeof m === 'function' ? m(x, y, z, this.v[(y * this.D + z) * this.W + x]) : m;
            if (mm != null && mm >= 0) this.v[(y * this.D + z) * this.W + x] = mm;
          }
    }
    /* live set: tracks dirty chunks, sky, listeners */
    set(x, y, z, m) {
      if (x < 0 || z < 0 || y < 0 || x >= this.W || z >= this.D || y >= this.H) return;
      const i = (y * this.D + z) * this.W + x;
      if (this.v[i] === m) return;
      this.v[i] = m; this.dmg[i] = 0;
      this.markDirty(x, y, z);
      const ci = z * this.W + x;
      if (m && y + 1 > this.sky[ci]) this.sky[ci] = y + 1;
      else if (!m && y + 1 === this.sky[ci]) this.skyCol(x, z);
      this.changed++;
      if (this.onChange) this.onChange(x, y, z);
    }
    skyCol(x, z) {
      let y = this.H - 1;
      while (y >= 0 && !this.v[(y * this.D + z) * this.W + x]) y--;
      this.sky[z * this.W + x] = y + 1;
    }
    computeSky() { for (let z = 0; z < this.D; z++) for (let x = 0; x < this.W; x++) this.skyCol(x, z); }
    markDirty(x, y, z) {
      const cx = (x / CS) | 0, cy = (y / CS) | 0, cz = (z / CS) | 0;
      this.dirty.add(this.ci(cx, cy, cz));
      const lx = x % CS, ly = y % CS, lz = z % CS;
      if (lx === 0 && cx > 0) this.dirty.add(this.ci(cx - 1, cy, cz));
      if (lx === CS - 1 && cx < this.ncx - 1) this.dirty.add(this.ci(cx + 1, cy, cz));
      if (ly === 0 && cy > 0) this.dirty.add(this.ci(cx, cy - 1, cz));
      if (ly === CS - 1 && cy < this.ncy - 1) this.dirty.add(this.ci(cx, cy + 1, cz));
      if (lz === 0 && cz > 0) this.dirty.add(this.ci(cx, cy, cz - 1));
      if (lz === CS - 1 && cz < this.ncz - 1) this.dirty.add(this.ci(cx, cy, cz + 1));
    }
    ci(cx, cy, cz) { return (cy * this.ncz + cz) * this.ncx + cx; }

    snapshot() { this.orig = this.v.slice(); }
    restore() { this.v.set(this.orig); this.dmg.fill(0); this.computeSky(); this.remeshAll(); }

    /* ------------------------------------------------------------ meshing */
    remeshAll() { for (let i = 0; i < this.chunks.length; i++) this.buildChunk(i); this.dirty.clear(); }
    flush(max) {
      let n = 0;
      for (const i of this.dirty) { this.dirty.delete(i); this.buildChunk(i); if (++n >= max) break; }
    }
    buildChunk(ci) {
      const cx = ci % this.ncx, cz = ((ci / this.ncx) | 0) % this.ncz, cy = (ci / (this.ncx * this.ncz)) | 0;
      const old = this.chunks[ci];
      if (old) { for (const m of old) { this.group.remove(m); m.geometry.dispose(); } this.chunks[ci] = null; }
      const x0 = cx * CS, y0 = cy * CS, z0 = cz * CS;
      const x1 = Math.min(x0 + CS, this.W), y1 = Math.min(y0 + CS, this.H), z1 = Math.min(z0 + CS, this.D);
      const W = this.W, D = this.D, v = this.v, dmg = this.dmg, sky = this.sky;
      const Lo = this.light.out, Li = this.light.in;
      let nv = 0, ni = 0, gv = 0, gi = 0;
      const col = [0, 0, 0];
      const get = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D) ? OOB : y < 0 ? 1 : y >= this.H ? 0 : v[(y * D + z) * W + x];
      const occ = m => m !== 0 && m !== OOB && !MAT[m].see;
      for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
        const i = (y * D + z) * W + x, m = v[i];
        if (!m) continue;
        const md = MAT[m], see = md.see, glow = md.glow;
        let colorDone = false;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f], dx = F.d[0], dy = F.d[1], dz = F.d[2];
          const nx = x + dx, ny = y + dy, nz = z + dz;
          const n = get(nx, ny, nz);
          if (n === OOB) continue;
          if (n !== 0) { if (!MAT[n].see || n === m) continue; }
          if (!colorDone) {
            patColor(m, x, y, z, col);
            if (md.hp < 255 && dmg[i]) { const t = 1 - 0.45 * Math.min(1, dmg[i] / md.hp); col[0] *= t; col[1] *= t; col[2] *= t; }
            colorDone = true;
          }
          // light: outdoor when the neighbouring air cell is above every roof in its column
          let lr, lg, lb;
          if (glow) { lr = lg = lb = 1; }
          else {
            const skyH = (nx < 0 || nz < 0 || nx >= W || nz >= D) ? 0 : sky[nz * W + nx];
            const L = ny >= skyH ? Lo : Li;
            lr = L[0] * F.s; lg = L[1] * F.s; lb = L[2] * F.s;
          }
          // which buffers
          let P, C, I, base;
          if (see) { if (gv + 4 > 30000) continue; P = GPOS; C = GCOL; I = GIDX; base = gv; }
          else { if (nv + 4 > MAXV) continue; P = POS; C = COL; I = IDX; base = nv; }
          // ao
          const ao = [3, 3, 3, 3];
          if (!glow && !see) {
            const offs = AOOFF[f];
            for (let c = 0; c < 4; c++) {
              const o = offs[c];
              const s1 = occ(get(nx + o[0], ny + o[1], nz + o[2])) ? 1 : 0;
              const s2 = occ(get(nx + o[3], ny + o[4], nz + o[5])) ? 1 : 0;
              const s3 = occ(get(nx + o[6], ny + o[7], nz + o[8])) ? 1 : 0;
              ao[c] = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
            }
          }
          for (let c = 0; c < 4; c++) {
            const cc = F.c[c], o = (base + c) * 3;
            P[o] = (x + cc[0]) * VS; P[o + 1] = (y + cc[1]) * VS; P[o + 2] = (z + cc[2]) * VS;
            const a = AOV[ao[c]];
            C[o] = Math.min(255, col[0] * lr * a * 255); C[o + 1] = Math.min(255, col[1] * lg * a * 255); C[o + 2] = Math.min(255, col[2] * lb * a * 255);
          }
          let ii = see ? gi : ni;
          if (ao[0] + ao[2] < ao[1] + ao[3]) { I[ii++] = base + 1; I[ii++] = base + 2; I[ii++] = base + 3; I[ii++] = base + 1; I[ii++] = base + 3; I[ii++] = base; }
          else { I[ii++] = base; I[ii++] = base + 1; I[ii++] = base + 2; I[ii++] = base; I[ii++] = base + 2; I[ii++] = base + 3; }
          if (see) { gv += 4; gi = ii; } else { nv += 4; ni = ii; }
        }
      }
      const meshes = [];
      if (nv) meshes.push(this.mkMesh(POS, COL, IDX, nv, ni, this.mat));
      if (gv) { const g = this.mkMesh(GPOS, GCOL, GIDX, gv, gi, this.gmat); g.renderOrder = 2; meshes.push(g); }
      for (const m of meshes) this.group.add(m);
      this.chunks[ci] = meshes.length ? meshes : null;
    }
    mkMesh(P, C, I, nv, ni, mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P.slice(0, nv * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(C.slice(0, nv * 3), 3, true));
      g.setIndex(new THREE.BufferAttribute(I.slice(0, ni), 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      return m;
    }
    dispose() {
      for (const c of this.chunks) if (c) for (const m of c) { this.group.remove(m); m.geometry.dispose(); }
      this.chunks.fill(null);
    }

    /* -------------------------------------------------------------- rays --
       visit(o, d, maxDist, cb): walks every non-air voxel along a normalised ray.
       cb(m, x, y, z, distMeters, nx, ny, nz) -> true to stop.                 */
    visit(o, d, maxDist, cb) {
      const px = o.x * INV, py = o.y * INV, pz = o.z * INV;
      let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
      const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
      const tdx = d.x !== 0 ? Math.abs(1 / d.x) : 1e30, tdy = d.y !== 0 ? Math.abs(1 / d.y) : 1e30, tdz = d.z !== 0 ? Math.abs(1 / d.z) : 1e30;
      let tmx = d.x !== 0 ? (sx > 0 ? (x + 1 - px) : (px - x)) * tdx : 1e30;
      let tmy = d.y !== 0 ? (sy > 0 ? (y + 1 - py) : (py - y)) * tdy : 1e30;
      let tmz = d.z !== 0 ? (sz > 0 ? (z + 1 - pz) : (pz - z)) * tdz : 1e30;
      const maxT = maxDist * INV;
      let t = 0, nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < 4000; i++) {
        const m = this.get(x, y, z);
        if (m !== 0) { if (cb(m, x, y, z, t * VS, nx, ny, nz)) return true; }
        if (tmx < tmy) {
          if (tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
          else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
        } else {
          if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
          else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
        }
        if (t > maxT) return false;
        if (y < -2 || y > this.H + 2) return false;
      }
      return false;
    }
    /* first solid voxel (glass counts unless skipSee) */
    raycast(o, d, maxDist, skipSee) {
      let hit = null;
      this.visit(o, d, maxDist, (m, x, y, z, t, nx, ny, nz) => {
        if (skipSee && m !== OOB && MAT[m].see) return false;
        hit = { m, x, y, z, dist: t, nx, ny, nz, px: o.x + d.x * t, py: o.y + d.y * t, pz: o.z + d.z * t };
        return true;
      });
      return hit;
    }
    /* line of sight between two points: glass and leaves do not block */
    los(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
      if (L < 1e-4) return true;
      U.v3.set(dx / L, dy / L, dz / L);
      return !this.visit(a, U.v3, L - 0.05, m => m === OOB || !(MAT[m].see || m === M.LEAF));
    }

    /* ---------------------------------------------------------- collision */
    solid(x, y, z) { const m = this.get(x, y, z); return m !== 0; }
    boxHits(minx, miny, minz, maxx, maxy, maxz) {
      const x0 = Math.floor(minx * INV), x1 = Math.floor((maxx - 1e-4) * INV);
      const y0 = Math.floor(miny * INV), y1 = Math.floor((maxy - 1e-4) * INV);
      const z0 = Math.floor(minz * INV), z1 = Math.floor((maxz - 1e-4) * INV);
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
        if (this.get(x, y, z) !== 0) return true;
      return false;
    }
    /* height (m) of the top of the highest solid voxel under (x,z) at or below y */
    groundBelow(px, py, pz) {
      const x = Math.floor(px * INV), z = Math.floor(pz * INV);
      for (let y = Math.floor(py * INV); y >= 0; y--) if (this.get(x, y, z) !== 0) return (y + 1) * VS;
      return 0;
    }
    outdoor(p) {
      const x = Math.floor(p.x * INV), z = Math.floor(p.z * INV);
      if (x < 0 || z < 0 || x >= this.W || z >= this.D) return true;
      return p.y * INV + 0.5 >= this.sky[z * this.W + x];
    }

    /* -------------------------------------------------------- destruction */
    hitVoxel(x, y, z, amount) {
      const m = this.get(x, y, z);
      if (!m || m === OOB) return false;
      const md = MAT[m];
      if (md.hp >= 255) return false;
      const i = this.idx(x, y, z);
      const d = this.dmg[i] + amount;
      if (d >= md.hp) { this.breakVoxel(x, y, z); return true; }
      this.dmg[i] = d;
      if (d * 3 >= md.hp) this.markDirty(x, y, z);
      return false;
    }
    breakVoxel(x, y, z, quiet) {
      const m = this.get(x, y, z);
      if (!m || m === OOB) return;
      this.set(x, y, z, 0);
      if (!quiet && this.onBreak) this.onBreak(x, y, z, m);
    }
    /* sphere of destruction. hard: also eats reinforcement. returns voxels removed */
    explode(cx, cy, cz, r, hard, debrisMax) {
      const R = r * INV, X = cx * INV, Y = cy * INV, Z = cz * INV;
      let n = 0, deb = 0; debrisMax = debrisMax == null ? 40 : debrisMax;
      for (let y = Math.floor(Y - R); y <= Math.ceil(Y + R); y++)
        for (let z = Math.floor(Z - R); z <= Math.ceil(Z + R); z++)
          for (let x = Math.floor(X - R); x <= Math.ceil(X + R); x++) {
            const m = this.get(x, y, z);
            if (!m || m === OOB) continue;
            const md = MAT[m];
            if (!(md.xp || (hard && md.hb))) continue;
            const dd = ((x + 0.5 - X) ** 2 + (y + 0.5 - Y) ** 2 + (z + 0.5 - Z) ** 2);
            const rr = R * (0.8 + 0.35 * H(x, y, z));
            if (dd > rr * rr) continue;
            this.set(x, y, z, 0); n++;
            if (this.onBreak && deb < debrisMax && (H(x, z, y) < 0.35)) { deb++; this.onBreak(x, y, z, m); }
          }
      return n;
    }
    /* remove voxels in a box that pass test(m) */
    carve(x0, y0, z0, x1, y1, z1, test, debrisMax) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      let n = 0, deb = 0; debrisMax = debrisMax == null ? 30 : debrisMax;
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const m = this.get(x, y, z);
        if (!m || m === OOB || !test(MAT[m], m)) continue;
        this.set(x, y, z, 0); n++;
        if (this.onBreak && deb < debrisMax && H(x, y, z) < 0.4) { deb++; this.onBreak(x, y, z, m); }
      }
      return n;
    }
  }

  window.VW = { World, VS, INV, CS, FACES, patColor, baseRGB };
})();
