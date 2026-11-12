/* maps-rework-c.js -- three maps rebuilt far larger, each in several joined parts:
     OBSERVATORY  a summit facility: the domed telescope hall, an entrance block with a planetarium,
                  an optics workshop wing, a residence wing, a second dome down a covered link and
                  a tunnel, and the cable-car terminal
     RAIL DEPOT   a grand terminus: a two-storey concourse under the clock tower, a hotel above it,
                  a freight wing, three platforms with two trains, a goods level and subway below
     MUSEUM       a three-storey atrium with the fossil skeleton, two gallery wings, a rotunda,
                  a research block, vaults and a loading bay below, roof terraces above */
(function () {
  'use strict';
  const { M, mat, SOFTW } = DATA;
  const { Builder, THEMES, define } = MAPS;
  const GY = MAPS.GY;

  /* ------------------------------------------------------------------ helpers -- */
  // a door cut in a wall two buildings share is an inside door, not a way in from outdoors
  const inside = op => { op.ext = false; op.nrm = 0; return op; };

  /* A switchback stairwell, 12 wide (two lanes of 5 and a rail between), running `len` voxels
     along `ax` from (lx0, lz0) and joining levels lo..hi of the building. u runs along it, v
     across. The flights sit at u = f0..f0+11 with a landing at each end; they alternate lanes
     and direction, so each one starts on the landing where the one below arrived.
     On a middle level only the landing you arrive on is connected (the other one is a pocket
     behind the next flight), so doors go: bottom and top level at either end, the level above
     the bottom at the high end (or the low end when `flip`), and so on alternately.
     Returns { door(L, code, n, u) }: code 'a' / 'b' is the end wall at u = 0 / u = len,
     'la' 'lb' the v = 0 side wall at the low / high landing, 'ra' 'rb' the v = 12 side wall. */
  function well(b, name, lx0, lz0, ax, len, o) {
    o = o || {};
    const l0 = o.lo == null ? b.lo : o.lo, l1 = o.hi == null ? b.hi : o.hi, f0 = o.f0 == null ? 6 : o.f0;
    const P = (u, v) => ax === 'z' ? [lx0 + v, lz0 + u] : [lx0 + u, lz0 + v];
    const R = (u0, v0, u1, v1) => { const a = P(u0, v0), c = P(u1, v1); return [a[0], a[1], c[0], c[1]]; };
    for (let L = l0; L <= l1; L++) b.room(L, name, ...R(0, 0, len, 12), { wall: o.wall });
    for (let L = l0; L < l1; L++) {
      const j = L - l0, up = (j % 2 === 0) !== !!o.flip, v0 = j % 2 ? 7 : 1;
      const s = P(up ? f0 : f0 + 11, v0);
      b.stairs(L, s[0], s[1], (up ? '+' : '-') + ax, 5);
      const ue = up ? f0 - 1 : f0 + 12;                      // the low end of the hole in the floor above
      b.rail(L + 1, ...R(ue, v0, ue, v0 + 4));
    }
    for (let L = l0; L <= l1; L++) b.rail(L, ...R(f0 - 1, 6, f0 + 12, 6));
    return {
      door(L, code, n, u) {
        n = n || 4;
        if (code === 'a' || code === 'b') { const e = code === 'a' ? 0 : len; return ax === 'z' ? b.doorZ(L, lz0 + e, lx0 + 4, n) : b.doorX(L, lx0 + e, lz0 + 4, n); }
        const v = code[0] === 'l' ? 0 : 12, u0 = u != null ? u : code[1] === 'a' ? 1 : len - 1 - n;
        return ax === 'z' ? b.doorX(L, lx0 + v, lz0 + u0, n) : b.doorZ(L, lz0 + v, lx0 + u0, n);
      },
    };
  }

  /* Floor that furniture must leave alone: both sides of every doorway, every flight with the
     floor before its first step and after its last, and every hatch with the spot below it. */
  function keepOut(B) {
    const set = new Set(), key = (L, x, z) => (L * 4096 + x) * 4096 + z;
    const add = (L, xa, za, xb, zb) => { for (let z = Math.min(za, zb); z <= Math.max(za, zb); z++) for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) set.add(key(L, x, z)); };
    for (const o of B.meta.openings) {
      if (o.kind === 'window') continue;
      if (o.axis === 'z') add(o.L, o.a0 - 1, o.line - 4, o.a1 + 1, o.line + 4); else add(o.L, o.line - 4, o.a0 - 1, o.line + 4, o.a1 + 1);
    }
    for (const f of B.meta.flights) {
      const s = f.dir[0] === '+' ? 1 : -1, n = f.n - 1;
      if (f.dir[1] === 'x') { add(f.L, f.x - 5 * s, f.z - 1, f.ex, f.z + n + 1); add(f.L + 1, f.x, f.z - 1, f.ex + 5 * s, f.z + n + 1); }
      else { add(f.L, f.x - 1, f.z - 5 * s, f.x + n + 1, f.ez); add(f.L + 1, f.x - 1, f.z, f.x + n + 1, f.ez + 5 * s); }
    }
    for (const h of B.meta.hatches) { add(h.L, h.x - 1, h.z - 1, h.x + 4, h.z + 4); add(h.L - 1, h.x - 1, h.z - 1, h.x + 4, h.z + 4); }
    return (L, x, z) => set.has(key(L, x, z));
  }
  /* from here on this building's furniture skips the kept floor (every furniture call ends in box) */
  function guard(b, kept) {
    b.box = function (L, lx0, lz0, lx1, lz1, h0, h1, m) {
      this.W.fill(this.X(lx0), L * 12 + 1 + h0, this.Z(lz0), this.X(lx1), L * 12 + 1 + h1, this.Z(lz1), (x, y, z) => kept(L, x, z) ? -1 : m);
    };
  }
  /* rooms are declared with a furniture kit; the kits run once the doors, stairs and hatches exist */
  function site(B) {
    const later = [];
    return {
      room(b, L, name, x0, z0, x1, z1, o, kit, ko) {
        const r = b.room(L, name, x0, z0, x1, z1, o || {});
        if (kit) later.push(() => KIT[kit](b, L, x0, z0, x1, z1, ko || {}));
        return r;
      },
      furnish() { const kept = keepOut(B); for (const b of B.meta.buildings) guard(b, kept); for (const f of later) f(); },
    };
  }

  /* a dome of radius R standing on a roof at height ry, open to the room below; `slit` is the
     direction [dx, dz] its glazed slit faces (or null), `m` may be a function of (dx, dy, dz) */
  function dome(B, cx, cz, R, ry, m, slit) {
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const r2 = dx * dx + dz * dz;
      if (r2 < (R - 1) * (R - 1)) B.w.put(cx + dx, ry, cz + dz, 0);
      for (let dy = 0; dy <= R; dy++) {
        const d = Math.sqrt(r2 + dy * dy);
        if (d > R + 0.5 || d < R - 0.8) continue;
        const glass = slit && dy >= 3 && dx * slit[0] + dz * slit[1] > 0 && Math.abs(dx * slit[1] - dz * slit[0]) <= 1;
        B.w.put(cx + dx, ry + dy, cz + dz, glass ? M.GLASS : typeof m === 'function' ? m(dx, dy, dz) : m);
      }
    }
  }

  /* ---------------------------------------------------------- furniture kits -- */
  // sides are plan sides: 'N' is the low-z wall, 'S' the high-z wall, 'W' low x, 'E' high x
  const spot = (x0, z0, x1, z1, side, t, len, dep) => {      // a rect `len` long, `dep` deep, against a wall, t = 0..1 along it
    if (side === 'N' || side === 'S') { const a = Math.round(x0 + 3 + Math.max(0, x1 - x0 - 6 - len) * t); return side === 'N' ? [a, z0 + 1, a + len - 1, z0 + dep] : [a, z1 - dep, a + len - 1, z1 - 1]; }
    const a = Math.round(z0 + 3 + Math.max(0, z1 - z0 - 6 - len) * t); return side === 'W' ? [x0 + 1, a, x0 + dep, a + len - 1] : [x1 - dep, a, x1 - 1, a + len - 1];
  };
  const strip = (x0, z0, x1, z1, side, dep) => side === 'N' ? [x0 + 3, z0 + 1, x1 - 3, z0 + dep] : side === 'S' ? [x0 + 3, z1 - dep, x1 - 3, z1 - 1]
    : side === 'W' ? [x0 + 1, z0 + 3, x0 + dep, z1 - 3] : [x1 - dep, z0 + 3, x1 - 1, z1 - 3];
  const full = (x0, z0, x1, z1, side, dep) => side === 'N' ? [x0 + 1, z0 + 1, x1 - 1, z0 + dep] : side === 'S' ? [x0 + 1, z1 - dep, x1 - 1, z1 - 1]
    : side === 'W' ? [x0 + 1, z0 + 1, x0 + dep, z1 - 1] : [x1 - dep, z0 + 1, x1 - 1, z1 - 1];
  const trim = (r, side, k) => side === 'N' || side === 'S' ? [r[0] + k, r[1], r[2] - k, r[3]] : [r[0], r[1] + k, r[2], r[3] - k];   // shorten along the wall
  // islands iw x id, at least `mg` clear of the walls and gx / gz apart, centred in the room
  function grid(x0, z0, x1, z1, iw, id, gx, gz, mg, cb) {
    const w = x1 - x0 - 1 - 2 * mg, d = z1 - z0 - 1 - 2 * mg;
    const nx = Math.floor((w + gx) / (iw + gx)), nz = Math.floor((d + gz) / (id + gz));
    if (nx < 1 || nz < 1) return 0;
    const ox = x0 + 1 + mg + Math.floor((w - (nx * iw + (nx - 1) * gx)) / 2), oz = z0 + 1 + mg + Math.floor((d - (nz * id + (nz - 1) * gz)) / 2);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) cb(ox + i * (iw + gx), oz + k * (id + gz), i, k);
    return nx * nz;
  }
  const BACK = { N: 's', S: 'n', W: 'w', E: 'e' };
  const dcase = (b, L, x, z, w, d, m) => { b.box(L, x, z, x + w - 1, z + d - 1, 0, 2, m || M.TRIM); b.box(L, x, z, x + w - 1, z + d - 1, 3, 5, M.GLASS); };
  const wallItem = (b, L, r, h0, h1, m) => b.box(L, r[0], r[1], r[2], r[3], h0, h1, m);
  const couchAt = (b, L, x0, z0, x1, z1, side, t, len, m) => { const r = spot(x0, z0, x1, z1, side, t, len, 3); b.couch(L, r[0], r[1], r[2], r[3], m || M.FAB_RED, BACK[side]); };
  const shelfAt = (b, L, x0, z0, x1, z1, side, h) => { const r = strip(x0, z0, x1, z1, side, 2); b.shelf(L, r[0], r[1], r[2], r[3], h || 8); };

  const KIT = {
    office(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 7, 4, 6, 6, 5, (x, z) => b.desk(L, x, z, x + 6, z + 3));
      shelfAt(b, L, x0, z0, x1, z1, o.wall || 'W', o.h);
      if (o.couch) couchAt(b, L, x0, z0, x1, z1, o.couch, 0.5, 9, o.fab);
    },
    study(b, L, x0, z0, x1, z1, o) {                     // one big desk, a couch, books
      const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
      b.desk(L, cx - 5, cz - 2, cx + 4, cz + 2);
      shelfAt(b, L, x0, z0, x1, z1, o.wall || 'N', 8);
      couchAt(b, L, x0, z0, x1, z1, o.couch || 'S', 0.3, 9, o.fab);
      wallItem(b, L, spot(x0, z0, x1, z1, o.couch || 'S', 0.9, 3, 3), 0, 5, M.BRASS);
    },
    store(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 8, 8, 7, 7, 4, (x, z, i, k) => b.crates(L, x, z, (i + k) % 3 === 0 ? 6 : (i + k) % 3 === 1 ? 4 : 3));
      { const r = full(x0, z0, x1, z1, o.wall || 'N', 2); b.shelf(L, r[0], r[1], r[2], r[3], 8); }
      if (o.wall2) shelfAt(b, L, x0, z0, x1, z1, o.wall2, 8);
    },
    lab(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 9, 4, 6, 6, 5, (x, z, i, k) => {
        b.table(L, x, z, x + 8, z + 3, o.m || M.METAL);
        if ((i + k) % 2) b.box(L, x + 2, z + 1, x + 4, z + 2, 4, 5, M.GLASS); else b.box(L, x + 5, z + 1, x + 5, z + 2, 4, 5, M.SCREEN);
      });
      wallItem(b, L, strip(x0, z0, x1, z1, o.wall || 'N', 2), 0, 7, o.cab || M.FRIDGE);
      if (o.rack) { const r = spot(x0, z0, x1, z1, o.rack, 0.5, 10, 3); b.rack(L, r[0], r[1], r[2], r[3]); }
    },
    plant(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 10, 7, 7, 7, 5, (x, z, i, k) => {
        b.box(L, x, z, x + 9, z + 6, 0, o.h || 7, (i + k) % 2 ? (o.m2 || M.METAL) : (o.m || M.BOILER));
        b.box(L, x + 4, z + 3, x + 5, z + 3, (o.h || 7) + 1, 9, M.PIPE);
      });
      const lx = (x1 - x0) >= (z1 - z0), c = lx ? (z0 + z1) >> 1 : (x0 + x1) >> 1;
      if (lx) b.box(L, x0 + 2, c, x1 - 2, c, 9, 9, M.PIPE); else b.box(L, c, z0 + 2, c, z1 - 2, 9, 9, M.PIPE);
      wallItem(b, L, spot(x0, z0, x1, z1, o.wall || 'W', 0.5, 8, 2), 0, 4, M.RED_PAINT);
    },
    tanks(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 9, 9, 6, 6, 4, (x, z, i, k) => b.tank(L, x + 4, z + 4, 4, o.h || 8, (i + k) % 2 ? (o.m2 || M.METAL) : (o.m || M.METAL)));
      const lx = (x1 - x0) >= (z1 - z0), c = lx ? z0 + 3 : x0 + 3;
      if (lx) b.box(L, x0 + 2, c, x1 - 2, c, 10, 10, M.PIPE); else b.box(L, c, z0 + 2, c, z1 - 2, 10, 10, M.PIPE);
    },
    server(b, L, x0, z0, x1, z1, o) {
      if ((x1 - x0) >= (z1 - z0)) grid(x0, z0, x1, z1, 3, 12, 6, 6, 4, (x, z) => b.rack(L, x, z, x + 2, z + 11));
      else grid(x0, z0, x1, z1, 12, 3, 6, 6, 4, (x, z) => b.rack(L, x, z, x + 11, z + 2));
      const r = spot(x0, z0, x1, z1, o.wall || 'S', 0.5, 7, 4); b.desk(L, r[0], r[1], r[2], r[3]);
    },
    dorm(b, L, x0, z0, x1, z1, o) {
      const m = [o.fab || M.FAB_BLUE, o.fab2 || M.FAB_RED];
      for (let z = z0 + 3, i = 0; z + 4 <= z1 - 2; z += 9, i++) { b.bed(L, x0 + 1, z, x0 + 8, z + 4, m[i % 2]); b.bed(L, x1 - 8, z, x1 - 1, z + 4, m[(i + 1) % 2]); }
      const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
      b.box(L, cx - 1, cz - 4, cx + 1, cz + 4, 0, 7, M.METAL);      // a block of lockers down the middle
    },
    kitchen(b, L, x0, z0, x1, z1, o) {
      const a = o.wall || 'N', c = o.wall2 || 'W';
      const r = full(x0, z0, x1, z1, a, 3); b.counter(L, r[0], r[1], r[2], r[3]);
      const q = strip(x0, z0, x1, z1, c, 3); b.counter(L, q[0], q[1], q[2], q[3], M.METAL);
      wallItem(b, L, spot(x0, z0, x1, z1, a, 0, 4, 3), 0, 7, M.FRIDGE);
      grid(x0, z0, x1, z1, 10, 4, 6, 6, 6, (x, z) => { b.counter(L, x, z, x + 9, z + 3, M.TRIM); b.box(L, x + 2, z + 1, x + 3, z + 2, 4, 4, M.POT); });
    },
    mess(b, L, x0, z0, x1, z1, o) {
      grid(x0, z0, x1, z1, 6, 5, 5, 5, 4, (x, z) => { b.table(L, x, z, x + 5, z + 4, o.m || M.WOOD); b.box(L, x + 2, z + 2, x + 3, z + 2, 4, 4, o.top || M.WHITE); });
      if (o.wall) { const r = strip(x0, z0, x1, z1, o.wall, 3); b.counter(L, r[0], r[1], r[2], r[3], M.TRIM); }
    },
    lounge(b, L, x0, z0, x1, z1, o) {
      const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
      couchAt(b, L, x0, z0, x1, z1, o.wall || 'W', 0.5, 10, o.fab);
      couchAt(b, L, x0, z0, x1, z1, o.wall2 || 'S', 0.5, 9, o.fab2 || M.FAB_BLUE);
      b.table(L, cx - 3, cz - 2, cx + 3, cz + 2);
      shelfAt(b, L, x0, z0, x1, z1, o.shelf || 'E', 7);
    },
    library(b, L, x0, z0, x1, z1, o) {
      if ((x1 - x0) >= (z1 - z0)) grid(x0, z0, x1, z1, 2, 11, 6, 6, 5, (x, z) => b.shelf(L, x, z, x + 1, z + 10, 8));
      else grid(x0, z0, x1, z1, 11, 2, 6, 6, 5, (x, z) => b.shelf(L, x, z, x + 10, z + 1, 8));
      shelfAt(b, L, x0, z0, x1, z1, o.wall || 'N', 8);
    },
    theatre(b, L, x0, z0, x1, z1, o) {                   // rows of seats facing a stage and a screen
      const s = o.stage || 'N', f = o.fab || M.FAB_RED;
      const st = strip(x0, z0, x1, z1, s, 5); b.box(L, st[0], st[1], st[2], st[3], 0, 0, M.WOOD);
      const sc = trim(strip(x0, z0, x1, z1, s, 1), s, 3); b.box(L, sc[0], sc[1], sc[2], sc[3], 3, 9, o.screen || M.WHITE);
      if (s === 'N' || s === 'S') {
        for (let i = 0, z = s === 'N' ? z0 + 11 : z1 - 12; s === 'N' ? z + 2 <= z1 - 4 : z - 1 >= z0 + 4; z += s === 'N' ? 5 : -5, i++) {
          const h = Math.min(i, 3);
          for (const [a, c] of [[x0 + 4, ((x0 + x1) >> 1) - 3], [((x0 + x1) >> 1) + 3, x1 - 4]]) { if (h) b.box(L, a, z, c, z + 1, 0, h - 1, M.TRIM); b.box(L, a, z, c, z + 1, h, h + 1, f); }
        }
      } else {
        for (let i = 0, x = s === 'W' ? x0 + 11 : x1 - 12; s === 'W' ? x + 2 <= x1 - 4 : x - 1 >= x0 + 4; x += s === 'W' ? 5 : -5, i++) {
          const h = Math.min(i, 3);
          for (const [a, c] of [[z0 + 4, ((z0 + z1) >> 1) - 3], [((z0 + z1) >> 1) + 3, z1 - 4]]) { if (h) b.box(L, x, a, x + 1, c, 0, h - 1, M.TRIM); b.box(L, x, a, x + 1, c, h, h + 1, f); }
        }
      }
    },
    gallery(b, L, x0, z0, x1, z1, o) {                   // display cases and plinths
      grid(x0, z0, x1, z1, 5, 5, 8, 8, 5, (x, z, i, k) => {
        if ((i + k) % 2 === 0) dcase(b, L, x, z, 5, 5, o.base);
        else { b.box(L, x + 1, z + 1, x + 3, z + 3, 0, 3, o.plinth || M.MARBLE); b.box(L, x + 2, z + 2, x + 2, z + 2, 4, 7, o.art || M.BRASS); }
      });
      if (o.wall) { const r = trim(strip(x0, z0, x1, z1, o.wall, 1), o.wall, 2); b.box(L, r[0], r[1], r[2], r[3], 3, 7, o.hang || M.FAB_RED); }
    },
    corridor(b, L, x0, z0, x1, z1, o) {
      const lx = (x1 - x0) >= (z1 - z0), a = lx ? 'N' : 'W', c = lx ? 'S' : 'E';
      wallItem(b, L, spot(x0, z0, x1, z1, a, 0.22, 7, 2), 0, 1, o.m || M.WOOD);
      wallItem(b, L, spot(x0, z0, x1, z1, c, 0.7, 4, 2), 0, o.h || 5, o.m2 || M.METAL);
      if ((lx ? x1 - x0 : z1 - z0) > 70) wallItem(b, L, spot(x0, z0, x1, z1, a, 0.9, 4, 3), 0, 3, M.CRATE);
    },
    workshop(b, L, x0, z0, x1, z1, o) {
      const r = strip(x0, z0, x1, z1, o.wall || 'N', 3); b.table(L, r[0], r[1], r[2], r[3], M.WOOD); b.box(L, r[0] + 2, r[1], r[0] + 4, r[1], 4, 5, M.RED_PAINT);
      grid(x0, z0, x1, z1, 6, 6, 8, 7, 6, (x, z, i, k) => {
        if ((i + k) % 2 === 0) { b.box(L, x, z, x + 5, z + 5, 0, 4, o.m || M.METAL); b.box(L, x + 2, z + 2, x + 3, z + 3, 5, 8, M.DARK); }
        else b.crates(L, x, z, 3);
      });
      wallItem(b, L, spot(x0, z0, x1, z1, o.wall2 || 'E', 0.5, 9, 2), 0, 7, M.METAL);
    },
    waiting(b, L, x0, z0, x1, z1, o) {
      if ((x1 - x0) >= (z1 - z0)) grid(x0, z0, x1, z1, 12, 2, 6, 6, 5, (x, z) => { b.box(L, x, z, x + 11, z, 0, 1, o.m || M.WOOD); b.box(L, x, z + 1, x + 11, z + 1, 0, 3, o.m || M.WOOD); });
      else grid(x0, z0, x1, z1, 2, 12, 6, 6, 5, (x, z) => { b.box(L, x, z, x, z + 11, 0, 1, o.m || M.WOOD); b.box(L, x + 1, z, x + 1, z + 11, 0, 3, o.m || M.WOOD); });
      if (o.wall) { const r = spot(x0, z0, x1, z1, o.wall, 0.5, 12, 2); b.counter(L, r[0], r[1], r[2], r[3], M.TRIM); }
    },
    control(b, L, x0, z0, x1, z1, o) {                   // a wall of screens and rows of consoles facing it
      const s = strip(x0, z0, x1, z1, o.wall || 'N', 1); b.box(L, s[0], s[1], s[2], s[3], 2, 8, M.SCREEN);
      grid(x0, z0, x1, z1, 8, 4, 5, 6, 6, (x, z) => { b.desk(L, x, z, x + 7, z + 3); b.box(L, x + 5, z + 1, x + 5, z + 2, 4, 5, M.SCREEN); });
      if (o.rack) { const r = spot(x0, z0, x1, z1, o.rack, 0.5, 10, 3); b.rack(L, r[0], r[1], r[2], r[3]); }
    },
    lockers(b, L, x0, z0, x1, z1, o) {
      wallItem(b, L, full(x0, z0, x1, z1, o.wall || 'N', 2), 0, 7, o.m || M.METAL);
      if (o.wall2) wallItem(b, L, strip(x0, z0, x1, z1, o.wall2, 2), 0, 7, o.m || M.METAL);
      grid(x0, z0, x1, z1, 8, 2, 6, 7, 6, (x, z) => b.box(L, x, z, x + 7, z + 1, 0, 1, M.WOOD));
    },
    wards(b, L, x0, z0, x1, z1, o) {                     // infirmary: beds, screens, a cabinet
      for (let z = z0 + 2; z + 4 <= z1 - 2; z += 10) { b.bed(L, x1 - 9, z, x1 - 1, z + 4, M.WHITE); if (z + 7 <= z1 - 4) b.box(L, x1 - 10, z + 7, x1 - 3, z + 7, 0, 7, M.PAPER); }
      wallItem(b, L, spot(x0, z0, x1, z1, 'W', 0.3, 6, 2), 0, 6, M.WHITE);
      const r = spot(x0, z0, x1, z1, 'W', 0.8, 7, 4); b.desk(L, r[0], r[1], r[2], r[3]);
    },
  };

  // windows by plan side: { N: [[a0, n], ...], S, W, E }
  function wins(b, L, w) {
    for (const [a, n] of w.N || []) b.winZ(L, 0, a, n);
    for (const [a, n] of w.S || []) b.winZ(L, b.d - 1, a, n);
    for (const [a, n] of w.W || []) b.winX(L, 0, a, n);
    for (const [a, n] of w.E || []) b.winX(L, b.w - 1, a, n);
  }

  /* ================================================================= OBSERVATORY
     Seven buildings on the summit. The telescope hall (main) stands in the middle, walled in on
     three sides by the entrance block (north), the optics workshops (west) and the residence
     (east); a covered link over a tunnel runs south to the second dome; the cable-car terminal
     and the weather hut stand apart. */
  mat('OBS_CLEAN', 0xdcecf0, SOFTW);
  mat('OBS_NIGHT', 0x171d3a, { pat: 'noise' });
  mat('OBS_STAR', 0xfff3c0, { glow: true });
  mat('OBS_MIRROR', 0xb9d2e0, {});
  mat('OBS_AMBER', 0xffb347, { glow: true });

  function observatory() {
    const B = new Builder('observatory', 'OBSERVATORY', 304, 64, 292);
    B.meta.desc = 'A summit observatory under a clear, starry sky: the great telescope dome ringed by a gallery, an entrance block with a planetarium, optics workshops, a residence wing, a second dome down a covered link and a tunnel, and the cable-car terminal. Night.';
    B.theme(THEMES.starry);
    B.ground(M.SNOW, M.STONE);
    B.surf(46, 46, 258, 246, M.GRAVEL); B.surf(138, 0, 170, 46, M.GRAVEL); B.surf(140, 246, 158, 291, M.GRAVEL); B.surf(258, 192, 303, 208, M.GRAVEL);
    const sh = { lo: 0, hi: 2, ext: M.PLASTER, inner: M.DRY_WHITE, slab: M.WOODFLOOR, roof: M.ROOF };
    const b = B.building(112, 96, 72, 72, sh);                                                                       // telescope hall (main)
    const nb = B.building(96, 56, 104, 41, Object.assign({}, sh, { inner: M.DRY_BEIGE }));                           // entrance block
    const ww = B.building(56, 96, 57, 72, Object.assign({}, sh, { inner: M.LAB_WHITE, slab: M.LAB_FLOOR }));         // optics workshops
    const ew = B.building(183, 96, 57, 72, Object.assign({}, sh, { lo: 1, inner: M.DRY_BEIGE }));                    // residence
    const lk = B.building(140, 167, 17, 25, Object.assign({}, sh, { hi: 1, inner: M.DRY_GREY, slab: M.TILE }));      // covered link over the tunnel
    const sd = B.building(124, 191, 49, 45, Object.assign({}, sh, { hi: 1, inner: M.DRY_GREY, slab: M.TILE }));      // south dome
    const ct = B.building(196, 186, 52, 44, { lo: 1, hi: 2, ext: M.SIDING, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.RUST });   // cable-car terminal
    const hut = B.building(64, 188, 24, 20, { lo: 1, hi: 1, ext: M.CORRUGATE, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.RUST });
    B.box(140, 25, 167, 156, 30, 167, M.PLASTER);   // the hall's south wall above the link's roof
    const S = site(B);

    // ---- telescope hall: plant under it, the hall through two floors, the gallery round the well
    S.room(b, 0, 'Pier Passage', 26, 0, 46, 71, { wall: M.DRY_GREY });
    S.room(b, 0, 'Cryo Plant', 0, 0, 26, 38, { wall: M.CONCRETE }, 'tanks', { m: M.WHITE, h: 8 });
    S.room(b, 0, 'Pump Room', 0, 38, 26, 71, { wall: M.CONCRETE }, 'plant', { m: M.BLUE_PAINT, h: 5 });
    S.room(b, 0, 'Plate Archive', 46, 0, 71, 36, { wall: M.DRY_GREY }, 'library', { wall: 'E' });
    S.room(b, 0, 'Battery Room', 46, 36, 71, 71, { wall: M.DRY_GREY }, 'server', { wall: 'E' });
    S.room(b, 1, 'Telescope Hall', 0, 0, 71, 71, { floor: M.TILE });
    S.room(b, 2, 'Gallery', 0, 0, 71, 71);
    b.void(2, 16, 16, 56, 56);
    b.rail(2, 15, 15, 57, 15); b.rail(2, 15, 57, 57, 57); b.rail(2, 15, 16, 15, 56); b.rail(2, 57, 16, 57, 56);
    b.stairs(1, 1, 44, '+z', 6); b.rail(2, 7, 43, 7, 55); b.rail(2, 1, 43, 6, 43);          // west flight up to the gallery
    b.stairs(1, 65, 27, '-z', 6); b.rail(2, 64, 16, 64, 28); b.rail(2, 65, 28, 70, 28);     // east flight
    b.doorX(0, 26, 14); b.doorX(0, 26, 52); b.doorX(0, 46, 16); b.doorX(0, 46, 50); b.doorZ(0, 38, 10); b.doorZ(0, 36, 58);
    b.doorZ(1, 71, 12, 6); b.doorZ(1, 71, 54, 6);
    wins(b, 1, { S: [[4, 5], [21, 5], [47, 5], [63, 6]] });
    wins(b, 2, { S: [[6, 6], [18, 6], [48, 6], [60, 6]] });

    // ---- entrance block (north): plant below, lobby level, lecture theatre and planetarium above
    S.room(nb, 0, 'Generator Room', 0, 0, 30, 40, { wall: M.CONCRETE }, 'plant', { h: 7 });
    S.room(nb, 0, 'Server Room', 42, 0, 74, 28, { wall: M.DRY_GREY }, 'server', { wall: 'N' });
    S.room(nb, 0, 'Water Tanks', 74, 0, 103, 28, { wall: M.CONCRETE }, 'tanks', { h: 9 });
    S.room(nb, 0, 'Service Corridor', 42, 28, 103, 40, { wall: M.DRY_GREY }, 'corridor');
    S.room(nb, 1, 'Control Room', 0, 0, 30, 40, { wall: M.PANEL_DARK, floor: M.CARPET2 }, 'control', { wall: 'W', rack: 'S' });
    S.room(nb, 1, 'Lobby', 42, 0, 74, 40, { floor: M.TILE });
    S.room(nb, 1, 'Visitor Center', 74, 0, 103, 40, { wall: M.DRY_BLUE, floor: M.CARPET2 }, 'gallery', { wall: 'E', hang: M.BLUE_PAINT });
    S.room(nb, 2, 'Lecture Theatre', 0, 0, 30, 40, { floor: M.CARPET2 }, 'theatre', { stage: 'N' });
    S.room(nb, 2, 'Planetarium', 42, 0, 74, 28, { wall: M.PANEL_DARK, floor: M.CARPET });
    S.room(nb, 2, 'Radio Lab', 74, 0, 103, 28, { wall: M.DRY_GREY }, 'lab', { rack: 'E', wall: 'N' });
    S.room(nb, 2, 'Upper Hall', 42, 28, 103, 40, {}, 'corridor');
    const nw = well(nb, 'North Stairs', 30, 0, 'z', 40, { f0: 22 });
    nw.door(0, 'la', 4, 8); nw.door(0, 'ra', 4, 8); nw.door(0, 'lb'); nw.door(0, 'rb'); inside(nw.door(0, 'b'));
    nb.doorZ(0, 28, 54); nb.doorZ(0, 28, 86); nb.doorX(0, 74, 12);
    inside(nb.doorZ(0, 40, 50, 6)); inside(nb.doorZ(0, 40, 76)); inside(nb.doorZ(0, 40, 6));
    nb.cellar('e', 16);
    nb.doorZ(1, 0, 54, 8); nb.doorZ(1, 0, 12); nb.doorZ(1, 0, 88); nb.doorZ(1, 0, 34); nb.doorX(1, 0, 18); nb.doorX(1, 103, 32);
    nw.door(1, 'lb'); nw.door(1, 'rb'); inside(nw.door(1, 'b')); nw.door(1, 'ra', 4, 8);
    nb.doorX(1, 74, 16, 6);
    inside(nb.doorZ(1, 40, 54, 8)); inside(nb.doorZ(1, 40, 24)); inside(nb.doorZ(1, 40, 80)); inside(nb.doorZ(1, 40, 6)); inside(nb.doorZ(1, 40, 94));
    nw.door(2, 'la', 4, 10); nw.door(2, 'ra', 4, 10); nw.door(2, 'lb'); nw.door(2, 'rb'); inside(nw.door(2, 'b'));
    nb.doorZ(2, 28, 56, 6); nb.doorZ(2, 28, 86); nb.doorX(2, 74, 12);
    inside(nb.doorZ(2, 40, 62, 6)); inside(nb.doorZ(2, 40, 94)); inside(nb.doorZ(2, 40, 6)); inside(nb.doorZ(2, 40, 24));
    wins(nb, 1, { N: [[4, 5], [20, 6], [45, 6], [65, 6], [78, 6], [95, 5]], W: [[6, 6], [28, 6]], E: [[8, 6], [24, 5]] });
    wins(nb, 2, { N: [[4, 6], [16, 6], [33, 6], [46, 6], [62, 6], [78, 6], [92, 6]], W: [[6, 6], [26, 6]], E: [[6, 6], [17, 6], [31, 6]] });

    // ---- optics workshops (west)
    S.room(ww, 0, 'Cold Store', 0, 0, 56, 30, { wall: M.CONCRETE }, 'store', { wall: 'N' });
    S.room(ww, 0, 'Pipe Corridor', 0, 30, 56, 42, { wall: M.DRY_GREY }, 'corridor');
    S.room(ww, 0, 'Compressor Room', 0, 42, 44, 71, { wall: M.CONCRETE }, 'plant', { m: M.CONT_G, h: 6 });
    S.room(ww, 1, 'Mirror Lab', 0, 0, 34, 30, { wall: M.DRY_GREY });
    S.room(ww, 1, 'Clean Room', 34, 0, 56, 30, { wall: M.OBS_CLEAN }, 'lab', { m: M.WHITE, wall: 'N' });
    S.room(ww, 1, 'Workshop Corridor', 0, 30, 56, 42, {}, 'corridor');
    S.room(ww, 1, 'Machine Shop', 0, 42, 44, 71, { wall: M.DRY_GREY, floor: M.CONCRETE }, 'workshop', { wall: 'S', wall2: 'W' });
    S.room(ww, 2, 'Instrument Lab', 0, 0, 34, 30, { wall: M.DRY_GREY }, 'lab', { rack: 'W', wall: 'N' });
    S.room(ww, 2, 'Coating Room', 34, 0, 56, 30, { wall: M.OBS_CLEAN }, 'tanks', { m: M.OBS_MIRROR, h: 6 });
    S.room(ww, 2, 'Lab Corridor', 0, 30, 56, 42, {}, 'corridor');
    S.room(ww, 2, 'Electronics Lab', 0, 42, 44, 71, { wall: M.DRY_GREY, floor: M.CARPET2 }, 'lab', { m: M.TRIM, rack: 'W', wall: 'S', cab: M.METAL });
    const wl = well(ww, 'West Stairs', 44, 42, 'z', 29, { flip: true });
    ww.doorZ(0, 30, 14, 6); ww.doorZ(0, 30, 42); ww.doorZ(0, 42, 14, 6); wl.door(0, 'a'); wl.door(0, 'lb');
    inside(ww.doorX(0, 56, 32)); inside(wl.door(0, 'rb'));
    ww.cellar('n', 50);
    ww.doorX(1, 0, 34); ww.doorZ(1, 0, 14); ww.doorX(1, 0, 56); ww.doorZ(1, 71, 14);
    ww.doorZ(1, 30, 12, 6); ww.doorZ(1, 30, 44); ww.doorX(1, 34, 14); ww.doorZ(1, 42, 14, 6); wl.door(1, 'a'); wl.door(1, 'la'); wl.door(1, 'lb');
    inside(ww.doorX(1, 56, 33, 6)); inside(ww.doorX(1, 56, 12));
    ww.doorZ(2, 30, 12, 6); ww.doorZ(2, 30, 44); ww.doorX(2, 34, 14); ww.doorZ(2, 42, 14, 6); wl.door(2, 'a'); wl.door(2, 'lb');
    inside(ww.doorX(2, 56, 33, 6)); inside(ww.doorX(2, 56, 12)); inside(wl.door(2, 'rb'));
    wins(ww, 1, { W: [[6, 6], [18, 6], [46, 6], [63, 5]], N: [[4, 6], [22, 6]], S: [[4, 6], [22, 6], [30, 5]] });
    wins(ww, 2, { W: [[6, 6], [18, 6], [33, 6], [48, 6], [62, 6]], N: [[4, 6], [14, 6], [26, 6]], S: [[4, 6], [16, 6], [28, 6], [47, 6]] });

    // ---- residence (east)
    S.room(ew, 1, 'Kitchen', 0, 0, 26, 30, { wall: M.DRY_WHITE, floor: M.TILE }, 'kitchen', { wall: 'N', wall2: 'W' });
    S.room(ew, 1, 'Mess Hall', 26, 0, 56, 30, { wall: M.DRY_SAGE }, 'mess');
    S.room(ew, 1, 'Residence Corridor', 0, 30, 56, 42, {}, 'corridor');
    S.room(ew, 1, 'Library', 0, 42, 26, 71, { wall: M.DRY_SAGE, floor: M.CARPET }, 'library', { wall: 'S' });
    S.room(ew, 1, 'Lounge', 38, 42, 56, 71, { wall: M.DRY_RED, floor: M.CARPET }, 'lounge', { wall: 'E', wall2: 'S', shelf: 'W' });
    S.room(ew, 2, 'Dormitory', 0, 0, 30, 30, { wall: M.DRY_BLUE, floor: M.CARPET2 }, 'dorm');
    S.room(ew, 2, "Astronomer's Quarters", 30, 0, 56, 30, { wall: M.DRY_RED, floor: M.CARPET }, 'study', { wall: 'N', couch: 'E' });
    S.room(ew, 2, 'Upper Corridor', 0, 30, 56, 42, {}, 'corridor');
    S.room(ew, 2, 'Infirmary', 0, 42, 26, 71, { wall: M.DRY_WHITE, floor: M.TILE }, 'wards');
    S.room(ew, 2, 'Common Room', 38, 42, 56, 71, { wall: M.DRY_SAGE, floor: M.CARPET2 }, 'lounge', { wall: 'E', wall2: 'S', shelf: 'W', fab: M.FAB_BLUE, fab2: M.FAB_RED });
    const el = well(ew, 'East Stairs', 26, 42, 'z', 29);
    ew.doorX(1, 56, 34); ew.doorX(1, 56, 58); ew.doorZ(1, 0, 40); ew.doorZ(1, 71, 10); ew.doorZ(1, 71, 46);
    ew.doorZ(1, 30, 10); ew.doorZ(1, 30, 38, 6); ew.doorX(1, 26, 8); ew.winX(1, 26, 16, 8, false);
    ew.doorZ(1, 42, 10); el.door(1, 'a'); ew.doorZ(1, 42, 46); el.door(1, 'rb');
    inside(ew.doorX(1, 0, 6)); inside(ew.doorX(1, 0, 33, 6)); inside(ew.doorX(1, 0, 58));
    ew.doorZ(2, 30, 12); ew.doorZ(2, 30, 42); ew.doorX(2, 30, 14); ew.doorZ(2, 42, 10); el.door(2, 'a'); ew.doorZ(2, 42, 46); el.door(2, 'rb'); el.door(2, 'lb');
    inside(ew.doorX(2, 0, 6)); inside(ew.doorX(2, 0, 33, 6)); inside(ew.doorX(2, 0, 58));
    wins(ew, 1, { N: [[19, 5], [30, 6], [48, 6]], E: [[6, 6], [18, 6], [46, 6], [65, 5]], S: [[18, 6], [30, 6], [52, 4]] });
    wins(ew, 2, { N: [[18, 6], [34, 6], [46, 6]], E: [[6, 6], [18, 6], [33, 6], [48, 6], [62, 6]], S: [[6, 6], [16, 6], [30, 6], [42, 6], [50, 5]] });

    // ---- covered link over the tunnel, and the south dome
    S.room(lk, 0, 'Tunnel', 0, 0, 16, 24, { wall: M.CONCRETE });
    S.room(lk, 1, 'Covered Link', 0, 0, 16, 24, {});
    inside(lk.doorZ(0, 0, 6, 5)); inside(lk.doorZ(0, 24, 6, 5)); inside(lk.doorZ(1, 0, 6, 5)); inside(lk.doorZ(1, 24, 6, 5));
    lk.doorX(1, 0, 10); lk.doorX(1, 16, 10);
    wins(lk, 1, { W: [[3, 5], [17, 5]], E: [[3, 5], [17, 5]] });
    S.room(sd, 0, 'Spectrograph Vault', 16, 0, 48, 44, { wall: M.CONCRETE }, 'lab', { wall: 'E', rack: 'S' });
    S.room(sd, 0, 'Dome Cellar', 0, 0, 16, 44, { wall: M.DRY_GREY });
    S.room(sd, 1, 'Astrograph Dome', 16, 0, 48, 44, { floor: M.TILE });
    S.room(sd, 1, 'Dark Room', 0, 0, 16, 16, { wall: M.PANEL_DARK });
    S.room(sd, 1, 'Dome Landing', 0, 16, 16, 44, {});
    sd.stairs(0, 1, 36, '-z', 5); sd.rail(1, 6, 25, 6, 37); sd.rail(1, 1, 37, 5, 37);
    sd.doorX(0, 16, 30, 6); sd.doorX(0, 16, 6); sd.cellar('n', 40);
    sd.doorX(1, 16, 8); sd.doorZ(1, 16, 8); sd.doorX(1, 16, 30, 6);
    sd.doorZ(1, 44, 20, 6); sd.doorX(1, 48, 20); sd.doorX(1, 0, 19);
    wins(sd, 1, { N: [[4, 5], [38, 6]], E: [[6, 6], [32, 6]], S: [[4, 6]], W: [[6, 5], [39, 4]] });

    // ---- cable-car terminal and the weather hut
    S.room(ct, 1, 'Waiting Room', 0, 0, 24, 43, { floor: M.TILE }, 'waiting', { wall: 'W' });
    S.room(ct, 1, 'Terminal Hall', 24, 0, 51, 43, { floor: M.CONCRETE });
    S.room(ct, 2, 'Operator Cabin', 0, 0, 24, 43, { floor: M.CARPET2 }, 'control', { wall: 'E', rack: 'N' });
    S.room(ct, 2, 'Winch Loft', 24, 0, 51, 43, {});
    ct.stairs(1, 30, 38, '+x', 5); ct.rail(2, 29, 37, 41, 37); ct.rail(2, 29, 38, 29, 42);
    ct.doorX(1, 0, 18); ct.doorZ(1, 0, 8); ct.doorZ(1, 0, 34, 6); ct.doorZ(1, 43, 45); ct.open(1, 'x', 51, 8, 12, 0, 10, 'door');
    ct.doorX(1, 24, 8, 6); ct.doorX(1, 24, 30); ct.doorX(2, 24, 10); ct.doorX(2, 24, 30);
    wins(ct, 1, { N: [[16, 5], [44, 5]], W: [[6, 6], [30, 6]], S: [[6, 6], [16, 5]], E: [[28, 6]] });
    wins(ct, 2, { N: [[4, 6], [14, 6], [30, 6], [42, 6]], W: [[6, 6], [18, 6], [30, 6]], S: [[6, 6], [16, 6], [44, 5]], E: [[6, 6], [18, 6], [30, 6]] });
    S.room(hut, 1, 'Weather Hut', 0, 0, 23, 19, {});
    hut.doorX(1, 23, 8); hut.doorZ(1, 0, 6); wins(hut, 1, { S: [[8, 5]], W: [[6, 5]], N: [[14, 4]] });

    // ---- hatches
    // (hatches share a few rows and columns: the stretch never widens a plane through a hatch)
    nb.hatch(2, 54, 8); nb.hatch(2, 86, 8); nb.hatch(1, 12, 8);
    ww.hatch(2, 20, 12); ww.hatch(1, 20, 54); ew.hatch(2, 12, 12); ew.hatch(2, 44, 12);
    b.hatch(1, 10, 12); b.hatch(1, 58, 54); ct.hatch(2, 31, 14);

    S.furnish();

    // ---- the great dome, and the telescope on its pier in the well
    dome(B, b.X(36), b.Z(36), 26, b.roofY, M.DOME, [0, -1]);
    b.box(0, 32, 32, 40, 40, 0, 10, M.CONCRETE);
    b.box(1, 31, 31, 41, 41, 0, 5, M.STONE); b.box(1, 33, 33, 39, 39, 6, 9, M.METAL);
    b.box(1, 31, 34, 32, 38, 6, 17, M.METAL); b.box(1, 40, 34, 41, 38, 6, 17, M.METAL);
    for (let t = 0; t <= 22; t++) { const h = 11 + Math.round(t * 0.95), lz = 38 - Math.round(t * 0.75); b.box(1, 33, lz - 2, 39, lz + 2, h, h + 5, t > 19 ? M.DARK : M.WHITE); }
    b.box(1, 34, 40, 38, 44, 7, 12, M.METAL); b.box(1, 35, 45, 37, 46, 8, 10, M.BRASS);
    for (const [x, z] of [[14, 14], [57, 14], [14, 57], [57, 57], [14, 35], [57, 35], [35, 14], [35, 57]]) b.box(1, x, z, x + 1, z + 1, 0, 10, M.PLASTER);
    // hall floor: consoles, crated instruments, a mirror cell on its cart
    b.desk(1, 22, 61, 29, 64); b.desk(1, 43, 61, 50, 64); b.box(1, 32, 62, 40, 63, 0, 3, M.TRIM); b.box(1, 33, 62, 39, 62, 4, 6, M.SCREEN);
    b.crates(1, 20, 6, 4); b.crates(1, 50, 20, 6); b.box(1, 58, 8, 63, 11, 0, 3, M.CRATE);
    b.box(1, 8, 62, 17, 67, 0, 1, M.METAL); b.tank(1, 12, 64, 2, 3, M.OBS_MIRROR);
    b.box(1, 24, 47, 34, 48, 0, 3, M.CONCRETE); b.box(1, 38, 24, 48, 25, 0, 3, M.CONCRETE);
    b.box(1, 10, 30, 13, 36, 0, 5, M.METAL); b.box(1, 58, 40, 62, 46, 0, 2, M.CRATE);
    // gallery: chart tables, benches and cabinets on the ring
    b.table(2, 28, 3, 37, 7); b.box(2, 30, 4, 34, 6, 4, 4, M.PAPER); b.shelf(2, 54, 1, 62, 2, 7);
    b.box(2, 20, 67, 30, 70, 0, 3, M.CRATE); b.couch(2, 40, 67, 50, 69, M.FAB_BLUE, 'n');
    b.shelf(2, 1, 22, 2, 34, 7); b.desk(2, 9, 60, 13, 66); b.box(2, 66, 40, 69, 50, 0, 3, M.TRIM); b.box(2, 60, 62, 63, 66, 0, 5, M.METAL);

    // ---- lobby, planetarium and the rest of the entrance block
    nb.counter(1, 62, 24, 71, 26, M.TRIM); nb.box(1, 64, 25, 64, 25, 4, 5, M.SCREEN);
    nb.box(1, 54, 14, 61, 20, 0, 2, M.TRIM); nb.tank(1, 57, 17, 2, 4, M.DOME); nb.box(1, 54, 14, 61, 20, 3, 3, M.SNOW);
    nb.box(1, 44, 3, 46, 5, 0, 5, M.LEAF); nb.box(1, 70, 3, 72, 5, 0, 5, M.LEAF);
    nb.box(1, 46, 30, 52, 31, 0, 1, M.WOOD); nb.box(1, 64, 34, 70, 35, 0, 1, M.WOOD);
    dome(B, nb.X(58), nb.Z(14), 12, nb.roofY, (dx, dy, dz) => U.hash3(dx + 40, dy, dz + 40) < 0.07 ? M.OBS_STAR : M.OBS_NIGHT, null);
    nb.box(2, 57, 13, 59, 15, 0, 4, M.DARK); nb.box(2, 56, 12, 60, 16, 5, 8, M.DARK); nb.box(2, 58, 14, 58, 14, 9, 9, M.OBS_STAR);
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, x = 58 + Math.round(Math.cos(a) * 10), z = 14 + Math.round(Math.sin(a) * 10); nb.box(2, x, z, x + 1, z + 1, 0, 1, M.FAB_BLUE); }
    nb.box(0, 44, 30, 101, 30, 10, 10, M.PIPE); nb.crates(0, 90, 32, 2);
    nb.box(1, 31, 2, 41, 3, 0, 1, M.WOOD);

    // ---- workshops: the mirror on its grinding table under a gantry, cold store ice, coating chamber
    ww.tank(1, 11, 18, 6, 2, M.METAL); ww.tank(1, 11, 18, 5, 3, M.OBS_MIRROR);
    for (const [x, z] of [[4, 10], [18, 10], [4, 26], [18, 26]]) ww.box(1, x, z, x, z, 0, 9, M.LINE);
    ww.box(1, 4, 10, 18, 10, 10, 10, M.LINE); ww.box(1, 4, 26, 18, 26, 10, 10, M.LINE); ww.box(1, 11, 10, 11, 26, 10, 10, M.LINE); ww.box(1, 11, 18, 11, 18, 8, 9, M.RAIL);
    ww.table(1, 26, 20, 32, 23, M.METAL); ww.box(1, 28, 26, 32, 28, 0, 6, M.FRIDGE); ww.box(1, 22, 1, 31, 2, 0, 7, M.METAL);
    ww.box(0, 6, 22, 14, 27, 0, 2, M.ICE); ww.box(0, 40, 22, 50, 26, 0, 6, M.FRIDGE); ww.box(0, 2, 32, 54, 32, 10, 10, M.PIPE);
    ww.box(2, 42, 20, 50, 26, 0, 7, M.METAL); ww.box(2, 44, 19, 48, 19, 2, 5, M.GLASS);

    // ---- residence touches
    ew.bed(2, 46, 20, 54, 26, M.FAB_RED); ew.box(2, 32, 22, 34, 24, 0, 6, M.BRASS); ew.box(2, 33, 23, 33, 23, 7, 9, M.METAL);
    ew.box(1, 30, 26, 52, 28, 0, 3, M.TRIM); ew.box(1, 2, 44, 6, 47, 0, 3, M.TRIM);

    // ---- link, tunnel and the south dome with its astrograph
    lk.box(1, 1, 4, 2, 8, 0, 1, M.WOOD); lk.box(1, 14, 16, 15, 20, 0, 1, M.WOOD);
    lk.box(0, 1, 2, 1, 22, 9, 10, M.PIPE); lk.box(0, 13, 14, 15, 18, 0, 3, M.CRATE); lk.box(0, 1, 4, 3, 8, 0, 4, M.METAL);
    dome(B, sd.X(32), sd.Z(22), 15, sd.roofY, M.DOME, [0, 1]);
    sd.box(1, 29, 19, 35, 25, 0, 3, M.STONE); sd.box(1, 31, 21, 33, 23, 4, 8, M.METAL);
    for (let t = 0; t <= 10; t++) { const h = 8 + t, lz = 20 + Math.round(t * 0.7); sd.box(1, 30, lz - 1, 34, lz + 2, h, h + 3, t > 8 ? M.DARK : M.WHITE); }
    sd.desk(1, 20, 36, 26, 39); sd.shelf(1, 40, 1, 46, 2, 7); sd.box(1, 42, 36, 46, 40, 0, 3, M.CRATE); sd.box(1, 18, 4, 21, 9, 0, 5, M.METAL);
    sd.counter(1, 1, 1, 14, 3, M.COUNTER); sd.box(1, 3, 2, 5, 2, 4, 4, M.RED_PAINT); sd.box(1, 10, 11, 14, 14, 0, 6, M.DARK);
    sd.crates(1, 9, 39, 2);
    sd.crates(0, 3, 4, 4); sd.shelf(0, 1, 20, 2, 28, 8); sd.box(0, 9, 40, 14, 42, 0, 3, M.CRATE);
    sd.box(0, 28, 16, 38, 26, 0, 4, M.METAL); sd.box(0, 30, 18, 36, 24, 5, 7, M.DARK); sd.box(0, 32, 20, 34, 22, 8, 10, M.BRASS);

    // ---- terminal: luggage, the ticket barrier, the bullwheel in the loft
    ct.box(1, 28, 22, 40, 23, 0, 3, M.METAL); ct.box(1, 44, 22, 49, 23, 0, 3, M.METAL);
    ct.crates(1, 27, 3, 4); ct.box(1, 44, 30, 49, 35, 0, 2, M.CRATE); ct.box(1, 36, 28, 40, 31, 0, 1, M.FAB_BLUE); ct.box(1, 28, 30, 31, 32, 0, 2, M.FAB_RED);
    ct.tank(2, 40, 26, 7, 1, M.RED_PAINT); ct.tank(2, 40, 26, 2, 6, M.METAL); ct.box(2, 46, 24, 49, 28, 0, 6, M.METAL);
    ct.crates(2, 27, 3, 6); ct.box(2, 27, 20, 30, 30, 0, 3, M.CRATE); ct.box(2, 38, 4, 39, 10, 0, 7, M.METAL);
    hut.desk(1, 2, 2, 8, 5); hut.shelf(1, 12, 16, 20, 17, 7); hut.box(1, 2, 13, 5, 16, 0, 4, M.METAL);

    // ---- cameras
    b.cam(1, 2, 2, -135, 'TELESCOPE HALL'); b.cam(2, 69, 69, 45, 'GALLERY'); nb.cam(1, 44, 2, -135, 'LOBBY'); nb.cam(0, 101, 30, 90, 'SERVICE CORRIDOR');
    ww.cam(1, 2, 32, -90, 'WORKSHOPS'); ew.cam(2, 54, 32, 90, 'RESIDENCE');
    B.cam(134, 26, 40, 180, -14, 'ACCESS ROAD'); B.box(134, 13, 40, 134, 25, 40, M.PIPE);
    B.cam(104, 25, 250, -45, -14, 'RIDGE'); B.box(104, 13, 250, 104, 24, 250, M.PIPE);

    // ---- outside: the cable car, a canopy from the residence to the terminal
    B.obox(248, 190, 262, 209, 0, 0, M.CONCRETE);
    B.obox(250, 195, 260, 204, 1, 11, M.RED_PAINT); B.obox(251, 196, 259, 203, 2, 10, 0); B.obox(250, 198, 250, 201, 2, 9, 0);
    B.obox(252, 195, 258, 195, 6, 9, M.GLASS); B.obox(252, 204, 258, 204, 6, 9, M.GLASS); B.obox(260, 197, 260, 202, 6, 9, M.GLASS);
    B.obox(255, 199, 255, 200, 12, 20, M.METAL); B.obox(248, 199, 303, 200, 21, 21, M.RAIL);
    B.obox(282, 197, 285, 202, 0, 20, M.METAL); B.obox(280, 198, 287, 201, 22, 23, M.METAL); B.obox(283, 199, 284, 200, 24, 24, M.LAMP_R);
    for (const [x, z] of [[228, 169], [237, 169], [228, 184], [237, 184]]) B.obox(x, z, x, z, 0, 10, M.METAL);
    B.obox(227, 168, 238, 185, 11, 11, M.CORRUGATE); B.obox(227, 168, 238, 185, 12, 12, M.SNOW);
    // the radio mast on its guys, the dish, snowcats, fuel, boulders, drifts
    for (let h = 0; h <= 46; h++) B.obox(34, 176, 35, 177, h, h, (h >> 3) % 2 ? M.WHITE : M.RED_PAINT);
    B.obox(34, 176, 35, 177, 47, 47, M.LAMP_R);
    for (const [x, z] of [[20, 162], [50, 162], [34, 194]]) { B.line(34, GY + 40, 176, x, GY + 1, z, M.RAIL); B.obox(x - 1, z - 1, x + 1, z + 1, 0, 1, M.CONCRETE); }
    B.obox(36, 226, 37, 227, 0, 11, M.PIPE);
    for (let c = -8; c <= 8; c++) for (let a = -8; a <= 8; a++) if (a * a + c * c <= 64) B.w.put(36 + a, GY + 14 + Math.round(c * 0.6), 228 + Math.round(c * 0.8), M.WHITE);
    B.truck(176, 12, 'z', M.RED_PAINT); B.truck(64, 62, 'x', M.CAR_W);
    B.drum(214, 86, 3, 0, 8, M.RED_PAINT); B.drum(222, 86, 3, 0, 8, M.RED_PAINT); B.obox(212, 90, 224, 91, 0, 2, M.CONCRETE);
    for (const [x, z, r] of [[70, 28, 5], [236, 36, 6], [274, 140, 5], [26, 104, 4], [96, 268, 6], [206, 262, 5], [270, 254, 4], [24, 48, 4], [282, 60, 5], [20, 262, 5]]) B.rock(x, z, r, M.SNOW);
    for (const [x0, z0, x1, z1] of [[60, 48, 76, 52], [216, 48, 232, 51], [48, 150, 52, 164], [250, 110, 256, 124], [96, 236, 110, 240], [182, 238, 194, 242]]) B.obox(x0, z0, x1, z1, 0, 1, M.SNOW);
    B.obox(92, 180, 99, 187, 0, 7, M.CRATE); B.obox(180, 176, 187, 183, 0, 3, M.CRATE); B.container(262, 150, 'z', M.CONT_R, true);
    B.fence(40, 264, 136, 264, M.TRIM); B.fence(162, 264, 262, 264, M.TRIM);
    for (const [x, z] of [[90, 50], [208, 50], [48, 178], [252, 176], [116, 244], [182, 246], [134, 30], [174, 30]]) B.lamp(x, z);

    B.spawn('Access Road', 148, 8, 0); B.spawn('Radio Mast', 8, 132, -90); B.spawn('Cable Car', 296, 132, 90); B.spawn('Ridge Trail', 148, 284, 180);
    B.meta.bombs = [['Generator Room', 'Server Room'], ['Cryo Plant', 'Plate Archive'], ['Mirror Lab', 'Machine Shop'], ['Kitchen', 'Mess Hall'], ['Lecture Theatre', 'Planetarium'], ['Dormitory', "Astronomer's Quarters"]];
    B.meta.secure = ['Mirror Lab', 'Control Room', 'Lecture Theatre', 'Water Tanks', 'Spectrograph Vault', 'Radio Lab'];
    B.meta.hostage = ["Astronomer's Quarters", 'Server Room', 'Library', 'Radio Lab', 'Operator Cabin'];
    B.meta.defSpawns = ['Generator Room', 'Kitchen', 'Lecture Theatre'];
    return B;
  }
  define({ id: 'observatory', name: 'OBSERVATORY', fn: observatory, blurb: 'Summit observatory: two domes, workshops & cable car · starry night', cover: 'garage', tint: 'rgba(52,70,150,0.38)' });
})();
