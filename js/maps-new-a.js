/* maps-new-a.js -- three maps:
     AURORA STATION  a polar research station: a ring of modules on spokes round a domed hub
     GRAND THEATRE   an old opera house: a three-storey auditorium, a stage with a fly tower
     HYDRO DAM       a hydroelectric power station: a long turbine hall under a crane gantry */
(function () {
  'use strict';
  const { M, mat, SOFTW } = DATA;
  const { Builder, THEMES, COVER, WING, define } = MAPS;
  const GY = 12;
  const HARDW = { hp: 9, pen: 0.4, xp: true, hb: true, wall: true };            // an outside wall: breachable, takes a rope
  const FLOORM = { hp: 40, pen: 0.45, xp: true, hb: true, floor: true };

  /* ================================================================ shared helpers */
  /* Furniture goes through b.box. Remember each piece so sweep() can clear doorways and stair
     ends afterwards; b.solid() is the untracked original, for structure. */
  function track(B, b) {
    B.furn = B.furn || [];
    const box = b.box;
    b.box = function (L, x0, z0, x1, z1, h0, h1, m) {
      if (m && h0 <= 8) B.furn.push([L, b.X(Math.min(x0, x1)), b.Z(Math.min(z0, z1)), b.X(Math.max(x0, x1)), b.Z(Math.max(z0, z1)), Math.min(h1, 9)]);
      box.call(b, L, x0, z0, x1, z1, h0, h1, m);
    };
    b.solid = (L, x0, z0, x1, z1, h0, h1, m) => box.call(b, L, x0, z0, x1, z1, h0, h1, m);
    return b;
  }
  /* no furniture within 4 voxels of a doorway, or of the foot or head of a flight */
  function sweep(B) {
    const W = B.w, D = 4;
    const clear = (L, x0, z0, x1, z1) => {
      for (const f of B.furn || []) {
        if (f[0] !== L) continue;
        const ax = Math.max(x0, f[1]), az = Math.max(z0, f[2]), bx = Math.min(x1, f[3]), bz = Math.min(z1, f[4]);
        if (ax <= bx && az <= bz) W.fill(ax, L * 12 + 1, az, bx, L * 12 + 1 + f[5], bz, 0);
      }
    };
    for (const o of B.meta.openings) {
      if (o.kind === 'window') continue;
      if (o.axis === 'z') { clear(o.L, o.a0, o.line - D, o.a1, o.line - 1); clear(o.L, o.a0, o.line + 1, o.a1, o.line + D); }
      else { clear(o.L, o.line - D, o.a0, o.line - 1, o.a1); clear(o.L, o.line + 1, o.a0, o.line + D, o.a1); }
    }
    for (const f of B.meta.flights) {
      const s = f.dir[0] === '+' ? 1 : -1, lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
      if (f.dir[1] === 'z') {
        clear(f.L, f.x, lo(f.z - s, f.z - D * s), f.x + f.n - 1, hi(f.z - s, f.z - D * s));
        clear(f.L + 1, f.x, lo(f.ez + s, f.ez + D * s), f.x + f.n - 1, hi(f.ez + s, f.ez + D * s));
      } else {
        clear(f.L, lo(f.x - s, f.x - D * s), f.z, hi(f.x - s, f.x - D * s), f.z + f.n - 1);
        clear(f.L + 1, lo(f.ex + s, f.ex + D * s), f.z, hi(f.ex + s, f.ex + D * s), f.z + f.n - 1);
      }
    }
  }
  /* a doorway in the wall two joined buildings share: an inside door, not a way in from outside */
  function link(b, L, axis, line, a0, n, h) {
    const op = axis === 'z' ? b.doorZ(L, line, a0, n, h) : b.doorX(L, line, a0, n, h);
    op.ext = false; op.nrm = 0;
    return op;
  }
  /* The game counts a spot as indoors when it is inside one building's walls, so the wall line two
     joined buildings share would read as "outside" and hold defenders back in the preparation
     phase. A joint is an entry in the building list that spans such a wall (world voxels, both
     sides already indoors) so its doorways are indoors too. It has no voxels of its own. */
  function joint(B, x0, z0, x1, z1, roofY) { (B.joints = B.joints || []).push({ x: x0, z: z0, x1, z1, lo: 1, hi: 1, roofY }); }
  function finish(B) {
    sweep(B);
    for (const j of B.joints || []) B.meta.buildings.push(j);
    return B;
  }
  /* A flight with its rails: on the floor above, a rail down both sides of the hole and across its
     foot wherever there is floor to stand on. `bal` ('lo', 'hi', 'both') gives an open flight solid
     stringers on those sides. */
  function flight(b, L, lx0, lz0, dir, n, o) {
    o = o || {};
    b.stairs(L, lx0, lz0, dir, n);
    const W = b.W, ax = dir[1] === 'x', s = dir[0] === '+' ? 1 : -1, base = L * 12, top = base + 12;
    const P = (i, k) => ax ? [b.X(lx0 + s * i), b.Z(lz0 + k)] : [b.X(lx0 + k), b.Z(lz0 + s * i)];
    const rail = (i, k) => {
      const [x, z] = P(i, k);
      if (!W.get(x, top, z)) return;
      for (let hh = 1; hh <= 3; hh++) if (!W.get(x, top + hh, z) && (hh === 3 || (x + z) % 4 === 0)) W.put(x, top + hh, z, M.RAIL);
    };
    if (!o.norail) {
      for (let i = -1; i <= 11; i++) { rail(i, -1); rail(i, n); }
      for (let k = 0; k < n; k++) rail(-1, k);
    }
    for (const k of o.bal === 'both' ? [-1, n] : o.bal === 'lo' ? [-1] : o.bal === 'hi' ? [n] : []) {
      for (let i = 0; i <= 11; i++) { const [x, z] = P(i, k); for (let y = base + 1; y <= base + 4 + i; y++) if (!W.get(x, y, z)) W.put(x, y, z, o.balMat || M.METAL); }
    }
  }
  /* An enclosed switchback stair, 13 across: a landing at each end and a spine wall between two
     halves, the flights alternating between them. `start` ('lo' | 'hi') is the end the first flight
     leaves from; on the floors in between only the landing a flight arrives at is of any use, so
     the other one is walled up unless that level is listed in `keep`. */
  function core(b, name, lx0, lz0, o) {
    const ax = o.axis || 'z', from = o.from, to = o.to, a = o.lenLo || 5, c = o.lenHi || 5, V = a + 13 + c, m = o.wall || b.inner;
    const T = (u, v) => ax === 'z' ? [lx0 + u, lz0 + v] : [lx0 + v, lz0 + u];
    const [ex, ez] = T(12, V);
    for (let L = from; L <= to; L++) {
      b.room(L, name, lx0, lz0, ex, ez, { wall: m, stair: true });
      const [sx0, sz0] = T(6, a + 1), [sx1, sz1] = T(6, a + 12);
      if (ax === 'z') b.wallX(L, sx0, sz0, sz1, m); else b.wallZ(L, sz0, sx0, sx1, m);
    }
    for (let L = from; L < to; L++) {
      const k = L - from, up = (k % 2 === 0) === (o.start !== 'hi');
      const [fx, fz] = T(k % 2 === 0 ? 1 : 7, up ? a + 1 : a + 12);
      flight(b, L, fx, fz, (up ? '+' : '-') + ax, 5);
      if (L + 1 < to && !(o.keep || []).includes(L + 1)) {
        const [x0, z0] = T(1, up ? 1 : a + 13), [x1, z1] = T(11, up ? a : a + 12 + c);
        b.solid(L + 1, x0, z0, x1, z1, 0, 10, m);
      }
    }
  }
  const wz = (b, L, line, xs, n) => { for (const x of xs) b.winZ(L, line, x, n || 5); };
  const wx = (b, L, line, zs, n) => { for (const z of zs) b.winX(L, line, z, n || 5); };
  /* a two-tier bunk */
  function bunk(b, L, x0, z0, x1, z1, m) {
    b.bed(L, x0, z0, x1, z1, m);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(L, x, z, x, z, 3, 7, M.TRIM);
    b.box(L, x0, z0, x1, z1, 6, 6, M.TRIM); b.box(L, x0, z0, x1, z1, 7, 7, m || M.WHITE);
  }
  /* a lab bench with glassware */
  function bench(b, L, x0, z0, x1, z1) {
    b.counter(L, x0, z0, x1, z1, M.WHITE);
    for (let x = x0 + 1; x < x1; x += 4) b.box(L, x, z0, x, z0, 4, 5, M.GLASS);
  }

  /* ============================================================== AURORA STATION */
  mat('AUR_SHELL', 0xcfd6dc, Object.assign({ pat: 'siding' }, HARDW));
  mat('AUR_ORANGE', 0xcf6a2c, Object.assign({ pat: 'siding' }, HARDW));
  mat('AUR_BLUE', 0x2f6ea5, Object.assign({ pat: 'siding' }, HARDW));
  mat('AUR_RED', 0xa8382c, Object.assign({ pat: 'siding' }, HARDW));
  mat('AUR_YELLOW', 0xc9a227, Object.assign({ pat: 'ribs' }, HARDW));
  mat('AUR_TUBE', 0x9aa4ad, Object.assign({ pat: 'ribs' }, HARDW));
  mat('AUR_SNOWROOF', 0xe4e9ee, { hp: 40, pen: 0.4, xp: true, hb: true, pat: 'noise', floor: true });
  mat('AUR_GLOW', 0x7dffc8, { glow: true });
  const AUR_THEME = { sky: [0x030816, 0x1d7a62], fog: 0x0c2230, fogFar: 125, lightOut: [0.44, 0.58, 0.72], lightIn: [0.92, 0.8, 0.62], sun: 0x8fffd0, outer: 0x5f7f9c, snow: true };
  // a polar tent: an orange barrel vault with a snow drift against the side that faces the station
  COVER.aurora = b => {
    for (let v = 10; v <= 19; v++) {
      const hh = Math.round(13 * Math.sqrt(Math.max(0, 1 - ((v - 14.5) / 5.4) ** 2)));
      b(-22, 22, v, v, 0, Math.max(3, hh), M.AUR_ORANGE);
    }
    b(-22, 22, 13, 16, 14, 14, M.AUR_ORANGE); b(-22, 22, 19, 20, 0, 6, M.SNOW); b(-22, 22, 21, 21, 0, 3, M.SNOW);
    b(-3, 2, 10, 10, 0, 8, M.DARK); b(-16, -12, 10, 10, 5, 8, M.GLASS); b(11, 15, 10, 10, 5, 8, M.GLASS);
    for (const u of [-22, -8, 6, 22]) b(u, u, 10, 19, 14, 14, M.WHITE);
  };
  WING.aurora = [M.SNOW, M.SNOW];

  function aurora() {
    const B = new Builder('aurora', 'AURORA STATION', 282, 56, 266);
    B.meta.desc = 'A polar research station under the aurora: insulated modules on corridor spokes round a domed hub, a drill hall cored down into the ice, and ice tunnels to the generator plant below. Night.';
    B.theme(AUR_THEME);
    B.ground(M.SNOW, M.ICE);
    const O = { inner: M.DRY_WHITE, slab: M.LAB_FLOOR, roof: M.AUR_SNOWROOF, parapet: M.METAL };
    const mk = (x, z, w, d, lo, hi, ext, o) => track(B, B.building(x, z, w, d, Object.assign({ lo, hi, ext }, O, o)));
    // the hub first (the main building), the four spokes, then a module on the end of each
    const h = mk(100, 92, 81, 81, 0, 2, M.AUR_SHELL, { slab: M.TILE });
    const sw = mk(80, 126, 21, 13, 1, 1, M.AUR_TUBE), se = mk(180, 126, 21, 13, 0, 1, M.AUR_TUBE);
    const sn = mk(134, 72, 13, 21, 0, 1, M.AUR_TUBE), ss = mk(134, 172, 13, 21, 1, 1, M.AUR_TUBE);
    const hab = mk(24, 96, 57, 73, 1, 2, M.AUR_ORANGE, { slab: M.WOODFLOOR, inner: M.DRY_BEIGE });
    const dr = mk(200, 96, 57, 73, 0, 2, M.AUR_YELLOW);
    const sci = mk(102, 24, 77, 49, 0, 2, M.AUR_BLUE, { inner: M.LAB_WHITE });
    const vb = mk(102, 192, 77, 49, 1, 2, M.AUR_RED, { inner: M.DRY_GREY });
    // a spoke clears the hub wall above its own roof: put it back
    B.box(100, 25, 126, 100, 36, 138, M.AUR_SHELL); B.box(180, 25, 126, 180, 36, 138, M.AUR_SHELL);
    B.box(134, 25, 92, 146, 36, 92, M.AUR_SHELL); B.box(134, 25, 172, 146, 36, 172, M.AUR_SHELL);

    /* ---------------------------------------------------------------- HUB (operations) */
    // B: generator plant, fuel and batteries round the junction of the ice tunnels
    h.room(0, 'Tunnel Junction', 26, 0, 54, 54, { wall: M.ICE, floor: M.ICE });
    h.room(0, 'Battery Hall', 54, 0, 80, 54, { wall: M.DRY_GREY });
    h.room(0, 'Fuel Store', 0, 0, 26, 54, { wall: M.CONCRETE });
    h.room(0, 'Generator Plant', 0, 54, 80, 80, { wall: M.CONCRETE });
    // 1F: four operations rooms in the corners of a cross-shaped hall
    h.room(1, 'Comms Room', 0, 0, 26, 26, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    h.room(1, 'Command Centre', 54, 0, 80, 26, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    h.room(1, 'Armoury', 54, 54, 80, 80, { wall: M.DRY_GREY });
    h.room(1, 'Briefing Room', 0, 54, 26, 80, { wall: M.DRY_SAGE, floor: M.CARPET });
    h.room(1, 'Hub Atrium', 26, 0, 54, 80, { skip: 'nsew' });
    h.room(1, 'West Lock Hall', 0, 26, 27, 54, { skip: 'nsew' });
    h.room(1, 'East Lock Hall', 53, 26, 80, 54, { skip: 'nsew' });
    // 2F: a gallery round the well under the dome
    h.room(2, "Chief's Office", 0, 0, 26, 26, { wall: M.DRY_BEIGE, floor: M.CARPET });
    h.room(2, 'Map Room', 54, 0, 80, 26, { wall: M.DRY_SAGE, floor: M.WOODFLOOR });
    h.room(2, 'Sick Bay', 54, 54, 80, 80, { wall: M.LAB_WHITE, floor: M.LAB_FLOOR });
    h.room(2, 'Observation Lounge', 0, 54, 26, 80, { wall: M.DRY_RED, floor: M.CARPET });
    h.room(2, 'Dome Gallery', 26, 0, 54, 80, { skip: 'nsew' });
    h.room(2, 'West Gallery', 0, 26, 27, 54, { skip: 'nsew' });
    h.room(2, 'East Gallery', 53, 26, 80, 54, { skip: 'nsew' });
    h.void(2, 32, 32, 48, 48);
    h.rail(2, 31, 31, 49, 31); h.rail(2, 31, 49, 49, 49); h.rail(2, 31, 32, 31, 48); h.rail(2, 49, 32, 49, 48);
    flight(h, 0, 49, 22, '-z', 5);            // tunnels up into the north arm
    flight(h, 1, 58, 27, '+x', 6);            // east arm up to the gallery
    flight(h, 1, 22, 48, '-x', 6);            // west arm up to the gallery
    // doors B
    h.doorX(0, 26, 12, 5); h.doorX(0, 26, 40, 5); h.doorX(0, 54, 40, 6);
    h.doorZ(0, 54, 37, 7); h.doorZ(0, 54, 10, 5); h.doorZ(0, 54, 64, 5);
    h.cellar('n', 14);
    // doors 1F
    h.doorX(1, 26, 12, 5); h.doorZ(1, 26, 10, 5);
    h.doorX(1, 54, 3, 5); h.doorZ(1, 26, 72, 5);
    h.doorX(1, 54, 64, 5); h.doorZ(1, 54, 64, 5);
    h.doorX(1, 26, 64, 5); h.doorZ(1, 54, 3, 5);
    h.doorZ(1, 0, 28, 5); h.doorZ(1, 80, 48, 5); h.doorX(1, 0, 28, 5); h.doorX(1, 80, 48, 5);
    wz(h, 1, 0, [6, 16, 48, 60, 70]); wz(h, 1, 80, [6, 16, 28, 60, 70]);
    wx(h, 1, 0, [6, 16, 48, 60, 70]); wx(h, 1, 80, [6, 16, 28, 60, 70]);
    // doors 2F, and one out onto the roof of each spoke
    h.doorX(2, 26, 12, 5); h.doorZ(2, 26, 10, 5);
    h.doorX(2, 54, 12, 5); h.doorZ(2, 26, 72, 5);
    h.doorX(2, 54, 64, 5); h.doorZ(2, 54, 64, 5);
    h.doorX(2, 26, 64, 5); h.doorZ(2, 54, 3, 5);
    h.doorZ(2, 0, 37, 7); h.doorZ(2, 80, 37, 7); h.doorX(2, 0, 37, 7); h.doorX(2, 80, 37, 7);
    wz(h, 2, 0, [6, 16, 28, 48, 60, 70]); wz(h, 2, 80, [6, 16, 28, 48, 60, 70]);
    wx(h, 2, 0, [6, 16, 28, 48, 60, 70]); wx(h, 2, 80, [6, 16, 28, 48, 60, 70]);
    h.hatch(2, 10, 12); h.hatch(2, 64, 62); h.hatch(1, 64, 12); h.hatch(1, 10, 64);
    // the glass dome over the well, on steel ribs
    {
      const R = 13, cx = h.X(40), cz = h.Z(40), ry = h.roofY;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const r2 = dx * dx + dz * dz;
        if (r2 < (R - 1) * (R - 1)) B.w.put(cx + dx, ry, cz + dz, 0);
        for (let dy = 0; dy <= R; dy++) {
          const d = Math.sqrt(r2 + dy * dy);
          if (d > R + 0.5 || d < R - 0.8) continue;
          const rib = dx === 0 || dz === 0 || Math.abs(dx) === Math.abs(dz) || dy === 0 || dy === 7;
          B.w.put(cx + dx, ry + dy, cz + dz, rib ? M.METAL : M.GLASS);
        }
      }
      B.box(cx, ry + R + 1, cz, cx, ry + R + 3, cz, M.METAL); B.box(cx, ry + R + 4, cz, cx, ry + R + 4, cz, M.AUR_GLOW);
    }
    // furniture B
    h.box(0, 20, 62, 31, 71, 0, 7, M.BOILER); h.box(0, 46, 62, 57, 71, 0, 7, M.BOILER); h.box(0, 62, 62, 73, 71, 0, 7, M.BOILER);
    for (const x of [25, 51, 67]) { h.box(0, x, 60, x + 1, 61, 0, 10, M.PIPE); h.box(0, x - 3, 64, x - 3, 69, 2, 4, M.LED_G); }
    h.box(0, 2, 58, 4, 70, 0, 7, M.METAL); h.box(0, 5, 60, 5, 68, 4, 6, M.SCREEN); h.box(0, 74, 74, 79, 79, 0, 7, M.RED_PAINT); h.box(0, 74, 74, 79, 79, 4, 4, M.WHITE); h.crates(0, 36, 72, 4);
    h.box(0, 2, 56, 78, 56, 10, 10, M.PIPE);
    h.tank(0, 10, 10, 6, 8, M.WHITE); h.tank(0, 10, 28, 6, 8, M.WHITE); h.box(0, 4, 18, 16, 19, 9, 9, M.PIPE);
    h.box(0, 2, 38, 15, 41, 0, 4, M.RED_PAINT); h.box(0, 2, 38, 15, 41, 2, 2, M.WHITE); h.box(0, 2, 46, 11, 49, 0, 4, M.BLUE_PAINT); h.box(0, 2, 46, 11, 49, 2, 2, M.WHITE);
    h.box(0, 20, 2, 24, 6, 0, 3, M.CRATE); h.box(0, 18, 48, 24, 52, 0, 4, M.METAL);
    h.rack(0, 58, 6, 60, 26); h.rack(0, 72, 6, 74, 26); h.box(0, 76, 2, 78, 10, 0, 7, M.METAL);
    h.table(0, 60, 46, 70, 49, M.METAL); h.box(0, 56, 30, 58, 36, 0, 5, M.METAL); h.box(0, 72, 30, 78, 33, 0, 3, M.CRATE);
    h.crates(0, 28, 6, 4); h.box(0, 30, 30, 36, 36, 0, 4, M.BOILER); h.box(0, 28, 46, 33, 51, 0, 3, M.CRATE); h.box(0, 44, 2, 47, 5, 0, 5, M.ICE);
    h.box(0, 27, 26, 53, 26, 10, 10, M.PIPE); h.box(0, 40, 1, 40, 53, 10, 10, M.AUR_GLOW);
    // furniture 1F: a winter garden under the dome, lockers and benches in the arms
    h.box(1, 35, 35, 45, 45, 0, 1, M.WOOD); h.box(1, 36, 36, 44, 44, 2, 3, M.LEAF); h.box(1, 38, 38, 42, 42, 4, 6, M.LEAF);
    h.box(1, 40, 40, 40, 40, 2, 9, M.BARK); h.box(1, 39, 39, 41, 41, 10, 10, M.LAMP);
    h.box(1, 32, 30, 38, 31, 0, 1, M.WOOD); h.box(1, 42, 49, 48, 50, 0, 1, M.WOOD);
    h.box(1, 27, 18, 28, 24, 0, 7, M.METAL); h.box(1, 44, 5, 47, 8, 0, 3, M.CRATE);
    h.crates(1, 28, 71, 4); h.box(1, 45, 58, 52, 59, 0, 1, M.WOOD); h.box(1, 44, 72, 46, 78, 0, 7, M.METAL);
    h.box(1, 16, 27, 24, 28, 0, 6, M.FAB_RED); h.box(1, 4, 44, 9, 45, 0, 1, M.WOOD); h.box(1, 2, 34, 4, 35, 0, 3, M.CRATE);
    h.box(1, 56, 44, 61, 49, 0, 3, M.CRATE); h.box(1, 72, 34, 78, 35, 0, 1, M.WOOD); h.box(1, 62, 52, 62, 53, 0, 7, M.METAL);
    h.desk(1, 3, 3, 11, 6); h.desk(1, 14, 3, 22, 6); h.rack(1, 5, 12, 7, 20); h.box(1, 16, 19, 22, 21, 0, 6, M.METAL); h.box(1, 16, 18, 22, 18, 3, 5, M.SCREEN);
    h.box(1, 60, 8, 72, 8, 0, 8, M.PANEL_DARK); h.box(1, 61, 9, 71, 9, 3, 7, M.SCREEN); h.table(1, 60, 17, 72, 21, M.TRIM); h.desk(1, 74, 10, 78, 20);
    h.box(1, 60, 62, 62, 74, 0, 6, M.METAL); h.box(1, 70, 60, 72, 72, 0, 6, M.METAL); h.crates(1, 74, 74, 2); h.table(1, 58, 76, 66, 78, M.METAL);
    h.box(1, 11, 79, 15, 79, 3, 8, M.WHITE); h.table(1, 14, 57, 22, 61); h.box(1, 4, 70, 9, 71, 0, 1, M.FAB_BLUE); h.box(1, 16, 70, 22, 71, 0, 1, M.FAB_BLUE); h.box(1, 4, 75, 9, 76, 0, 1, M.FAB_BLUE);
    // furniture 2F
    h.desk(2, 14, 16, 22, 20); h.shelf(2, 2, 22, 8, 24, 7); h.couch(2, 16, 3, 23, 6, M.FAB_RED, 's'); h.box(2, 3, 3, 5, 5, 0, 5, M.LEAF);
    h.table(2, 60, 8, 72, 16, M.WOOD); h.box(2, 62, 10, 70, 14, 4, 4, M.PAPER); h.shelf(2, 76, 4, 78, 12, 7); h.box(2, 58, 20, 62, 22, 0, 3, M.TRIM);
    h.bed(2, 58, 72, 66, 76, M.WHITE); h.bed(2, 70, 72, 78, 76, M.WHITE); h.box(2, 76, 56, 78, 62, 0, 7, M.WHITE); h.table(2, 57, 57, 61, 60, M.METAL);
    h.couch(2, 4, 72, 14, 76, M.FAB_BLUE, 'n'); h.couch(2, 3, 58, 6, 66, M.FAB_BLUE, 'w'); h.counter(2, 16, 56, 24, 58, M.TRIM); h.box(2, 20, 74, 20, 74, 0, 5, M.PIPE); h.box(2, 19, 75, 21, 77, 5, 6, M.BRASS);
    h.box(2, 28, 12, 29, 18, 0, 1, M.WOOD); h.box(2, 50, 62, 52, 68, 0, 3, M.CRATE); h.box(2, 28, 60, 30, 62, 0, 4, M.LEAF); h.box(2, 16, 36, 22, 37, 0, 1, M.WOOD); h.box(2, 60, 46, 66, 47, 0, 1, M.WOOD);
    h.cam(1, 28, 78, -45, 'ATRIUM'); h.cam(0, 28, 52, -45, 'TUNNEL JUNCTION'); h.cam(2, 52, 2, 135, 'DOME GALLERY');

    /* ---------------------------------------------------------------- SPOKES */
    sw.room(1, 'West Spoke Passage', 0, 0, 20, 12);
    se.room(1, 'East Spoke Passage', 0, 0, 20, 12); se.room(0, 'East Ice Tunnel', 0, 0, 20, 12, { floor: M.ICE });
    sn.room(1, 'North Spoke Passage', 0, 0, 12, 20); sn.room(0, 'North Ice Tunnel', 0, 0, 12, 20, { floor: M.ICE });
    ss.room(1, 'South Spoke Passage', 0, 0, 12, 20);
    // ice walls for the tunnels
    B.box(180, 1, 126, 200, 11, 126, M.ICE); B.box(180, 1, 138, 200, 11, 138, M.ICE); B.box(134, 1, 72, 134, 11, 92, M.ICE); B.box(146, 1, 72, 146, 11, 92, M.ICE);
    for (const L of [1]) { link(sw, L, 'x', 0, 3, 7); link(sw, L, 'x', 20, 3, 7); link(ss, L, 'z', 0, 3, 7); link(ss, L, 'z', 20, 3, 7); }
    for (const L of [0, 1]) { link(se, L, 'x', 0, 3, 7); link(se, L, 'x', 20, 3, 7); link(sn, L, 'z', 0, 3, 7); link(sn, L, 'z', 20, 3, 7); }
    sw.doorZ(1, 0, 8, 5); se.doorZ(1, 12, 8, 5); sn.doorX(1, 12, 8, 5); ss.doorX(1, 0, 8, 5);
    wz(sw, 1, 12, [3, 13], 4); wz(sw, 1, 0, [2, 15], 4); wz(se, 1, 0, [3, 13], 4); wz(se, 1, 12, [2, 15], 4);
    wx(sn, 1, 0, [3, 13], 4); wx(sn, 1, 12, [2, 15], 4); wx(ss, 1, 12, [3, 13], 4); wx(ss, 1, 0, [2, 15], 4);
    sw.box(1, 14, 9, 17, 11, 0, 3, M.CRATE); se.box(1, 3, 1, 6, 3, 0, 3, M.CRATE); sn.box(1, 1, 14, 3, 17, 0, 3, M.CRATE); ss.box(1, 9, 3, 11, 6, 0, 3, M.CRATE);
    se.box(0, 2, 9, 6, 11, 0, 2, M.CRATE); se.box(0, 1, 1, 19, 1, 10, 10, M.PIPE); sn.box(0, 9, 12, 11, 16, 0, 2, M.CRATE); sn.box(0, 1, 1, 1, 19, 10, 10, M.PIPE);
    // the spoke roofs are open-air walks between the upper floors
    sw.rail(2, 1, 0, 19, 0); sw.rail(2, 1, 12, 19, 12); se.rail(2, 1, 0, 19, 0); se.rail(2, 1, 12, 19, 12);
    sn.rail(2, 0, 1, 0, 19); sn.rail(2, 12, 1, 12, 19); ss.rail(2, 0, 1, 0, 19); ss.rail(2, 12, 1, 12, 19);
    joint(B, 74, 126, 106, 138, 24); joint(B, 174, 126, 206, 138, 24); joint(B, 134, 66, 146, 98, 24); joint(B, 134, 166, 146, 198, 24);

    /* ---------------------------------------------------------------- HABITAT (west) */
    hab.room(1, 'Galley', 0, 0, 26, 30, { wall: M.DRY_WHITE, floor: M.TILE });
    hab.room(1, 'Mess Hall', 26, 0, 56, 30, { wall: M.DRY_BEIGE });
    hab.room(1, 'Habitat Corridor', 0, 30, 56, 42);
    hab.room(1, 'Rec Room', 0, 42, 30, 72, { wall: M.DRY_RED, floor: M.CARPET });
    hab.room(1, 'Boot Room', 30, 42, 44, 72, { wall: M.DRY_GREY, floor: M.TILE });
    hab.room(2, 'Bunk Room A', 0, 0, 28, 30, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    hab.room(2, 'Bunk Room B', 28, 0, 56, 30, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    hab.room(2, 'Bunk Corridor', 0, 30, 56, 42);
    hab.room(2, 'Crew Lounge', 0, 42, 44, 72, { wall: M.DRY_BEIGE, floor: M.CARPET });
    core(hab, 'Habitat Stairs', 44, 42, { from: 1, to: 2, start: 'lo', lenLo: 5, lenHi: 12 });
    hab.doorZ(1, 30, 10, 5); hab.doorZ(1, 30, 38, 5); hab.doorX(1, 26, 12, 6);
    hab.doorZ(1, 42, 12, 5); hab.doorZ(1, 42, 35, 5); hab.doorX(1, 30, 56, 5); hab.doorZ(1, 42, 48, 5);
    hab.doorX(1, 0, 34, 5); hab.doorZ(1, 72, 35, 5); hab.doorZ(1, 0, 40, 5); hab.doorX(1, 0, 12, 5);
    link(hab, 1, 'x', 56, 33, 7);
    wz(hab, 1, 0, [6, 16, 30, 48]); wx(hab, 1, 0, [4, 21, 48, 60]); wz(hab, 1, 72, [6, 18, 48]); wx(hab, 1, 56, [6, 18, 62]);
    hab.doorZ(2, 30, 10, 5); hab.doorZ(2, 30, 40, 5); hab.doorX(2, 28, 14, 5);
    hab.doorZ(2, 42, 8, 5); hab.doorZ(2, 42, 30, 5); hab.doorZ(2, 42, 48, 5);
    hab.doorX(2, 56, 33, 7);
    wz(hab, 2, 0, [6, 18, 32, 46]); wx(hab, 2, 0, [6, 18, 34, 48, 60]); wz(hab, 2, 72, [6, 18, 30, 48]); wx(hab, 2, 56, [6, 18, 64]);
    hab.hatch(2, 12, 12); hab.hatch(2, 20, 56);
    // furniture 1F
    hab.counter(1, 4, 2, 22, 4, M.METAL); hab.box(1, 6, 2, 9, 3, 4, 4, M.DARK); hab.counter(1, 6, 18, 18, 21, M.METAL); hab.box(1, 16, 27, 24, 29, 0, 7, M.FRIDGE); hab.box(1, 2, 24, 5, 28, 0, 4, M.CRATE);
    hab.table(1, 30, 6, 37, 10); hab.table(1, 30, 19, 37, 23); hab.table(1, 47, 8, 53, 12); hab.table(1, 47, 19, 53, 23); hab.counter(1, 28, 26, 34, 28, M.COUNTER);
    hab.box(1, 18, 31, 30, 32, 0, 7, M.METAL); hab.box(1, 44, 40, 52, 41, 0, 1, M.WOOD); hab.box(1, 4, 40, 8, 41, 0, 3, M.CRATE);
    hab.table(1, 8, 52, 18, 58, M.TRIM); hab.box(1, 8, 52, 18, 58, 4, 4, M.FELT); hab.couch(1, 4, 64, 14, 68, M.FAB_BLUE, 'n'); hab.box(1, 4, 43, 10, 43, 3, 6, M.SCREEN); hab.shelf(1, 23, 69, 28, 70, 7); hab.table(1, 22, 46, 27, 50);
    hab.box(1, 42, 46, 43, 66, 0, 7, M.METAL); hab.box(1, 31, 46, 32, 52, 0, 1, M.WOOD); hab.box(1, 31, 62, 34, 66, 0, 5, M.FAB_RED);
    // furniture 2F
    bunk(hab, 2, 2, 3, 9, 6, M.FAB_BLUE); bunk(hab, 2, 2, 20, 9, 23, M.FAB_BLUE); bunk(hab, 2, 18, 3, 25, 6, M.FAB_RED); bunk(hab, 2, 18, 22, 25, 25, M.FAB_RED); hab.box(1 + 1, 2, 26, 6, 28, 0, 7, M.METAL);
    bunk(hab, 2, 31, 3, 38, 6, M.FAB_BLUE); bunk(hab, 2, 31, 22, 38, 25, M.FAB_BLUE); bunk(hab, 2, 46, 3, 53, 6, M.FAB_RED); bunk(hab, 2, 46, 12, 53, 15, M.FAB_RED); hab.box(2, 50, 24, 54, 28, 0, 7, M.METAL);
    hab.shelf(2, 18, 31, 28, 32, 7); hab.box(2, 36, 40, 42, 41, 0, 1, M.WOOD);
    hab.couch(2, 4, 62, 14, 66, M.FAB_RED, 'n'); hab.couch(2, 30, 58, 34, 68, M.FAB_BLUE, 'e'); hab.table(2, 6, 48, 14, 52); hab.counter(2, 2, 68, 12, 70, M.COUNTER); hab.shelf(2, 36, 69, 42, 70, 7); hab.table(2, 30, 46, 36, 50); hab.box(2, 40, 44, 42, 46, 0, 5, M.LEAF);
    hab.cam(1, 54, 40, 45, 'HABITAT');

    /* ---------------------------------------------------------------- SCIENCE (north) */
    sci.room(0, 'Cold Storage', 0, 0, 30, 36, { wall: M.DRY_GREY });
    sci.room(0, 'Ice Core Archive', 30, 0, 64, 36, { wall: M.DRY_GREY });
    sci.room(0, 'Science Tunnel', 0, 36, 76, 48, { wall: M.ICE, floor: M.ICE });
    sci.room(1, 'Wet Lab', 0, 0, 30, 36, { floor: M.TILE });
    sci.room(1, 'Dry Lab', 30, 0, 64, 36);
    sci.room(1, 'Science Corridor', 0, 36, 76, 48);
    sci.room(2, 'Server Room', 0, 0, 30, 36, { wall: M.PANEL_DARK });
    sci.room(2, 'Weather Office', 30, 0, 64, 36, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    sci.room(2, 'Upper Science Corridor', 0, 36, 76, 48);
    core(sci, 'Science Stairs', 64, 0, { from: 0, to: 2, start: 'lo', lenLo: 11, lenHi: 12 });
    for (const L of [0, 1, 2]) { sci.doorZ(L, 36, 12, 5); sci.doorZ(L, 36, 44, 5); sci.doorZ(L, 36, 68, 5); sci.doorX(L, 30, 14, 5); }
    sci.cellar('s', 20);
    link(sci, 0, 'z', 48, 35, 7); link(sci, 1, 'z', 48, 35, 7);
    sci.doorX(1, 0, 40, 5); sci.doorX(1, 76, 40, 5); sci.doorZ(1, 0, 52, 5);
    wz(sci, 1, 0, [6, 22, 34, 44]); wx(sci, 1, 0, [8, 22]); wx(sci, 1, 76, [28]); wz(sci, 1, 48, [6, 18, 50, 62]);
    sci.doorZ(2, 48, 35, 7);
    wz(sci, 2, 0, [6, 20, 34, 46, 56, 68]); wx(sci, 2, 0, [8, 22, 40]); wx(sci, 2, 76, [4, 28, 40]); wz(sci, 2, 48, [6, 18, 50, 62]);
    sci.hatch(2, 14, 20); sci.hatch(2, 50, 22); sci.hatch(1, 46, 12); sci.hatch(1, 8, 26);
    // furniture B
    sci.box(0, 2, 6, 4, 30, 0, 7, M.FRIDGE); sci.box(0, 10, 10, 20, 12, 0, 6, M.METAL); sci.box(0, 10, 10, 20, 12, 1, 5, M.ICE); sci.box(0, 10, 20, 20, 22, 0, 6, M.METAL); sci.box(0, 10, 20, 20, 22, 1, 5, M.ICE);
    sci.box(0, 24, 26, 28, 32, 0, 3, M.ICE); sci.crates(0, 1, 1, 2);
    for (const x of [36, 42, 52, 58]) { sci.box(0, x, 4, x + 1, 30, 0, 8, M.METAL); sci.box(0, x, 5, x + 1, 29, 1, 7, M.ICE); sci.box(0, x, 4, x + 1, 4, 0, 8, M.METAL); sci.box(0, x, 17, x + 1, 17, 0, 8, M.METAL); }
    sci.box(0, 2, 38, 74, 38, 10, 10, M.PIPE); sci.box(0, 6, 44, 10, 46, 0, 3, M.CRATE); sci.box(0, 56, 37, 60, 39, 0, 3, M.ICE); sci.box(0, 20, 37, 20, 47, 10, 10, M.AUR_GLOW); sci.box(0, 54, 37, 54, 47, 10, 10, M.AUR_GLOW);
    // furniture 1F
    bench(sci, 1, 4, 6, 22, 9); sci.box(1, 2, 14, 4, 24, 0, 8, M.METAL); sci.box(1, 5, 15, 5, 23, 3, 7, M.GLASS); bench(sci, 1, 14, 30, 26, 32); sci.tank(1, 24, 22, 2, 5, M.GLASS);
    bench(sci, 1, 34, 6, 44, 9); sci.table(1, 36, 22, 46, 27, M.METAL); sci.box(1, 37, 23, 45, 24, 4, 4, M.ICE); sci.shelf(1, 60, 6, 62, 30, 7); sci.box(1, 54, 28, 58, 32, 0, 3, M.CRATE);
    sci.box(1, 22, 46, 30, 47, 0, 1, M.WOOD); sci.tank(1, 60, 46, 1, 5, M.BLUE_PAINT); sci.tank(1, 63, 46, 1, 5, M.BLUE_PAINT); sci.box(1, 4, 37, 8, 38, 0, 3, M.CRATE);
    // furniture 2F
    sci.rack(2, 4, 4, 6, 18); sci.rack(2, 20, 4, 22, 18); sci.rack(2, 4, 24, 6, 32); sci.rack(2, 22, 24, 24, 32); sci.box(2, 10, 30, 12, 34, 0, 5, M.METAL); sci.box(2, 12, 2, 16, 3, 0, 6, M.METAL);
    sci.desk(2, 34, 4, 42, 8); sci.desk(2, 46, 4, 54, 8); sci.table(2, 36, 26, 46, 31); sci.box(2, 38, 27, 44, 30, 4, 4, M.PAPER); sci.shelf(2, 60, 8, 62, 28, 7); sci.box(2, 58, 2, 62, 4, 0, 5, M.METAL);
    sci.box(2, 22, 46, 30, 47, 0, 1, M.WOOD); sci.box(2, 54, 37, 60, 38, 0, 3, M.CRATE); sci.box(2, 4, 44, 6, 46, 0, 5, M.LEAF);
    sci.cam(1, 2, 38, -90, 'SCIENCE');

    /* ---------------------------------------------------------------- DRILL HALL (east) */
    dr.room(0, 'Drill Pit', 0, 0, 56, 50, { wall: M.CONCRETE });
    dr.room(0, 'Sample Freezer', 0, 50, 56, 72, { wall: M.DRY_GREY });
    dr.room(1, 'Drill Hall', 0, 0, 56, 50, { wall: M.CORRUGATE, floor: M.CONCRETE });
    dr.room(1, 'Core Processing', 0, 50, 30, 72, { wall: M.LAB_WHITE });
    dr.room(1, 'Tool Crib', 30, 50, 56, 72, { wall: M.DRY_GREY, floor: M.CONCRETE });
    dr.room(2, 'Gantry Catwalk', 0, 0, 56, 50, { wall: M.CORRUGATE, floor: M.METAL });
    dr.room(2, 'Drill Control', 0, 50, 30, 72, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    dr.room(2, 'Core Library', 30, 50, 56, 72, { wall: M.DRY_BEIGE });
    // the hall is open through both floors: a catwalk round it and a gantry bridge across, a pit under the rig
    dr.void(2, 9, 9, 47, 31); dr.void(2, 9, 39, 47, 42);
    dr.rail(2, 8, 8, 39, 8); dr.rail(2, 45, 8, 48, 8); dr.rail(2, 8, 9, 8, 32); dr.rail(2, 48, 9, 48, 32);
    dr.rail(2, 9, 32, 47, 32); dr.rail(2, 9, 38, 47, 38); dr.rail(2, 8, 38, 8, 43); dr.rail(2, 48, 38, 48, 43); dr.rail(2, 9, 43, 47, 43);
    dr.void(1, 24, 21, 32, 29);
    dr.rail(1, 23, 20, 33, 20); dr.rail(1, 23, 30, 33, 30); dr.rail(1, 23, 21, 23, 29); dr.rail(1, 33, 21, 33, 29);
    flight(dr, 1, 40, 20, '-z', 5, { bal: 'both' });
    flight(dr, 0, 51, 30, '-z', 5);
    dr.doorZ(0, 50, 10, 5); dr.doorZ(0, 50, 40, 5); link(dr, 0, 'x', 0, 33, 7); dr.cellar('n', 44);
    dr.doorZ(1, 50, 12, 5); dr.doorZ(1, 50, 40, 5); dr.doorX(1, 30, 58, 5); link(dr, 1, 'x', 0, 33, 7);
    dr.doorZ(1, 0, 8, 5); dr.shutterX(1, 56, 34, 12); dr.doorZ(1, 72, 12, 5); dr.doorX(1, 56, 58, 5);
    wz(dr, 1, 0, [20, 30, 46]); wx(dr, 1, 56, [6]); wx(dr, 1, 0, [6, 16, 44, 56, 64]); wz(dr, 1, 72, [4, 20, 36]); wx(dr, 1, 56, [66], 4);
    dr.doorZ(2, 50, 12, 5); dr.doorZ(2, 50, 40, 5); dr.doorX(2, 30, 58, 5); dr.doorX(2, 0, 33, 7);
    wz(dr, 2, 0, [10, 26, 42]); wx(dr, 2, 56, [10, 24, 38, 58]); wx(dr, 2, 0, [10, 20, 44, 58]); wz(dr, 2, 72, [6, 18, 36, 46]);
    dr.winZ(2, 50, 3, 7); dr.winZ(2, 50, 20, 7);       // drill control looks down the hall
    dr.hatch(2, 20, 60); dr.hatch(1, 8, 60); dr.hatch(1, 44, 62);
    // the rig: a derrick from the hall floor up through the roof, the drill string down into the sump
    {
      const y0 = 13, y1 = 52, legs = [[22, 19], [34, 19], [34, 31], [22, 31]];
      for (const [x, z] of legs) B.box(dr.X(x), y0, dr.Z(z), dr.X(x), y1, dr.Z(z), M.LINE);
      for (const y of [22, 34, 46, 52]) for (let i = 0; i < 4; i++) { const a = legs[i], c = legs[(i + 1) % 4]; B.line(dr.X(a[0]), y, dr.Z(a[1]), dr.X(c[0]), y, dr.Z(c[1]), M.LINE); }
      for (const y of [22, 34]) for (let i = 0; i < 4; i++) { const a = legs[i], c = legs[(i + 1) % 4]; B.line(dr.X(a[0]), y, dr.Z(a[1]), dr.X(c[0]), y + 12, dr.Z(c[1]), M.LINE); }
      B.box(dr.X(28), 2, dr.Z(25), dr.X(28), 51, dr.Z(25), M.PIPE);
      B.box(dr.X(27), 41, dr.Z(24), dr.X(29), 44, dr.Z(26), M.RED_PAINT); B.box(dr.X(26), 52, dr.Z(23), dr.X(30), 52, dr.Z(27), M.LINE); B.box(dr.X(28), 53, dr.Z(25), dr.X(28), 53, dr.Z(25), M.LAMP_R);
      B.box(dr.X(27), 16, dr.Z(24), dr.X(29), 19, dr.Z(26), M.METAL);
    }
    // furniture B: the sump, mud tanks and pumps
    dr.box(0, 22, 19, 34, 31, 0, 1, M.CONC_DARK); dr.box(0, 24, 21, 32, 29, 1, 1, M.WATER);
    dr.box(0, 6, 6, 14, 12, 0, 5, M.BOILER); dr.tank(0, 44, 8, 4, 7, M.METAL); dr.tank(0, 34, 8, 3, 6, M.METAL); dr.box(0, 15, 9, 30, 9, 9, 9, M.PIPE);
    dr.box(0, 4, 42, 16, 44, 0, 6, M.METAL); dr.box(0, 4, 42, 16, 44, 1, 5, M.ICE); dr.crates(0, 38, 40, 4); dr.box(0, 2, 20, 4, 28, 0, 3, M.CRATE);
    dr.box(0, 16, 56, 36, 60, 0, 3, M.FRIDGE); dr.box(0, 4, 68, 26, 70, 0, 7, M.FRIDGE); dr.box(0, 50, 54, 54, 60, 0, 6, M.METAL); dr.box(0, 50, 54, 54, 60, 1, 5, M.ICE); dr.box(0, 2, 52, 5, 55, 0, 3, M.CRATE);
    // furniture 1F
    dr.box(1, 2, 4, 4, 26, 0, 4, M.PIPE); dr.tank(1, 14, 12, 4, 6, M.METAL); dr.crates(1, 10, 42, 6); dr.box(1, 36, 38, 42, 44, 0, 5, M.BOILER); dr.box(1, 46, 4, 52, 8, 0, 3, M.CRATE);
    dr.box(1, 14, 26, 18, 34, 0, 2, M.CRATE); dr.box(1, 24, 4, 30, 6, 0, 4, M.METAL); dr.box(1, 44, 44, 48, 48, 0, 3, M.CRATE);
    dr.table(1, 4, 66, 10, 70, M.METAL); bench(dr, 1, 18, 52, 28, 54); dr.box(1, 24, 64, 28, 70, 0, 4, M.METAL); dr.box(1, 2, 52, 4, 56, 0, 3, M.ICE);
    dr.shelf(1, 33, 68, 44, 70, 7); dr.table(1, 34, 53, 37, 58, M.METAL); dr.box(1, 50, 52, 54, 55, 0, 6, M.METAL); dr.box(1, 50, 66, 54, 70, 0, 3, M.CRATE);
    // furniture 2F
    dr.box(2, 1, 1, 3, 3, 0, 3, M.CRATE); dr.box(2, 54, 44, 55, 48, 0, 3, M.CRATE); dr.box(2, 53, 1, 55, 3, 0, 5, M.METAL); dr.box(2, 20, 33, 23, 34, 0, 3, M.CRATE); dr.box(2, 1, 44, 2, 48, 0, 4, M.METAL);
    dr.counter(2, 3, 52, 26, 54, M.COUNTER); dr.box(2, 5, 53, 9, 53, 4, 5, M.SCREEN); dr.box(2, 20, 53, 24, 53, 4, 5, M.SCREEN); dr.desk(2, 4, 66, 12, 70); dr.rack(2, 26, 64, 28, 70);
    dr.shelf(2, 34, 56, 36, 68, 7); dr.shelf(2, 44, 56, 46, 68, 7); dr.table(2, 50, 62, 54, 68); dr.box(2, 51, 63, 53, 67, 4, 4, M.ICE);
    dr.cam(2, 54, 2, 135, 'DRILL HALL');

    /* ---------------------------------------------------------------- VEHICLE BAY (south) */
    vb.room(1, 'Vehicle Bay', 0, 0, 52, 48, { wall: M.CORRUGATE, floor: M.CONCRETE });
    vb.room(1, 'Workshop', 52, 0, 76, 26, { wall: M.DRY_GREY, floor: M.CONCRETE });
    vb.room(1, 'Parts Store', 52, 26, 76, 48, { wall: M.DRY_GREY, floor: M.CONCRETE });
    vb.room(2, 'Bay Mezzanine', 0, 0, 52, 48, { wall: M.CORRUGATE, floor: M.METAL });
    vb.room(2, 'Dispatch Loft', 52, 0, 76, 48, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    vb.void(2, 1, 16, 51, 47); vb.rail(2, 6, 15, 51, 15);
    flight(vb, 1, 1, 27, '-z', 5, { bal: 'hi' });
    vb.doorX(1, 52, 10, 5); vb.doorX(1, 52, 34, 5); vb.doorZ(1, 26, 62, 5); link(vb, 1, 'z', 0, 35, 7);
    vb.shutterZ(1, 48, 12, 14); vb.shutterZ(1, 48, 32, 14); vb.doorX(1, 0, 34, 5); vb.doorX(1, 76, 10, 5); vb.doorZ(1, 48, 62, 5);
    wz(vb, 1, 0, [6, 18, 58, 68]); wx(vb, 1, 0, [6, 42]); wx(vb, 1, 76, [18, 34]); wz(vb, 1, 48, [54, 70], 4);
    vb.doorX(2, 52, 4, 5); vb.doorZ(2, 0, 35, 7); vb.winX(2, 52, 22, 8); vb.winX(2, 52, 36, 8);
    wz(vb, 2, 0, [6, 20, 46, 58, 68]); wx(vb, 2, 0, [4, 24, 38]); wx(vb, 2, 76, [8, 22, 36]); wz(vb, 2, 48, [10, 30, 44, 58, 68]);
    vb.hatch(2, 62, 12); vb.hatch(2, 62, 36);
    const snowcat = (x, z, m) => {       // 12 x 22, nose toward +z
      B.obox(x, z, x + 2, z + 21, 0, 2, M.TIRE); B.obox(x + 9, z, x + 11, z + 21, 0, 2, M.TIRE);
      B.obox(x + 1, z + 1, x + 10, z + 20, 3, 6, m); B.obox(x + 1, z + 9, x + 10, z + 19, 7, 10, m); B.obox(x + 1, z + 12, x + 10, z + 18, 8, 9, M.GLASS);
      B.obox(x + 2, z + 20, x + 9, z + 20, 8, 9, M.GLASS); B.obox(x + 2, z + 21, x + 3, z + 21, 4, 5, M.LAMP); B.obox(x + 8, z + 21, x + 9, z + 21, 4, 5, M.LAMP); B.obox(x + 2, z + 2, x + 9, z + 7, 7, 7, M.CRATE);
    };
    snowcat(vb.X(13), vb.Z(19), M.AUR_ORANGE); snowcat(vb.X(33), vb.Z(19), M.CAR_R);
    vb.counter(1, 8, 1, 22, 3, M.METAL); vb.box(1, 46, 2, 50, 6, 0, 4, M.RED_PAINT); vb.box(1, 47, 18, 50, 27, 0, 4, M.RED_PAINT); vb.box(1, 47, 18, 50, 27, 2, 2, M.WHITE); vb.box(1, 2, 41, 6, 46, 0, 2, M.TIRE); vb.box(1, 8, 44, 10, 46, 0, 3, M.CRATE);
    vb.table(1, 56, 20, 68, 24, M.METAL); vb.box(1, 70, 2, 74, 7, 0, 5, M.METAL); vb.box(1, 56, 2, 60, 5, 0, 3, M.CRATE); vb.box(1, 72, 18, 74, 24, 0, 7, M.METAL);
    vb.shelf(1, 54, 28, 60, 30, 7); vb.shelf(1, 68, 28, 74, 30, 7); vb.shelf(1, 54, 44, 60, 46, 7); vb.box(1, 70, 40, 74, 44, 0, 3, M.CRATE);
    vb.box(2, 8, 2, 14, 6, 0, 3, M.CRATE); vb.box(2, 20, 10, 26, 13, 0, 2, M.TIRE); vb.box(2, 44, 2, 50, 4, 0, 5, M.METAL); vb.box(2, 2, 2, 4, 8, 0, 6, M.METAL);
    vb.desk(2, 56, 20, 64, 24); vb.bed(2, 68, 4, 74, 8, M.FAB_RED); vb.bed(2, 68, 40, 74, 44, M.FAB_BLUE); vb.shelf(2, 72, 20, 74, 30, 7); vb.table(2, 56, 28, 60, 32); vb.box(2, 54, 44, 58, 46, 0, 6, M.METAL);
    vb.cam(1, 2, 46, -45, 'VEHICLE BAY');

    /* ---------------------------------------------------------------- outside */
    B.surf(104, 241, 176, 265, M.ICE); B.surf(136, 0, 144, 23, M.ICE); B.surf(257, 126, 281, 138, M.ICE);
    // radome and antenna field (north-west)
    B.drum(56, 52, 8, 0, 5, M.CONCRETE);
    for (let dy = -9; dy <= 9; dy++) for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) { const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= 9.4 && d >= 7.8) B.w.put(56 + dx, GY + 16 + dy, 52 + dz, (dx + dy + dz) % 5 === 0 ? M.PIPE : M.DOME); }
    const mast = (x, z, hgt) => { for (let hh = 0; hh <= hgt; hh++) B.obox(x, z, x, z, hh, hh, (hh >> 2) % 2 ? M.WHITE : M.RED_PAINT); B.obox(x, z, x, z, hgt + 1, hgt + 1, M.LAMP_R); for (const [dx, dz] of [[-8, 0], [8, 0], [0, -8], [0, 8]]) B.line(x, GY + hgt - 4, z, x + dx, GY + 1, z + dz, M.RAIL); };
    mast(24, 30, 34); mast(82, 18, 30); mast(250, 74, 34);
    B.obox(30, 70, 37, 77, 0, 6, M.AUR_ORANGE); B.obox(31, 71, 36, 76, 0, 5, 0); B.obox(33, 77, 34, 77, 0, 4, 0);
    // fuel farm (north-east): three tanks in a snow berm
    for (const x of [212, 230, 248]) { B.drum(x, 44, 6, 0, 11, M.WHITE); B.drum(x, 44, 6, 8, 8, M.RED_PAINT); }
    B.obox(202, 34, 258, 35, 0, 2, M.SNOW); B.obox(202, 36, 203, 52, 0, 2, M.SNOW); B.obox(257, 36, 258, 52, 0, 2, M.SNOW);
    for (const [x0, x1] of [[202, 216], [225, 235], [244, 258]]) B.obox(x0, 53, x1, 54, 0, 2, M.SNOW);
    B.obox(212, 51, 248, 51, 1, 1, M.PIPE); B.obox(196, 60, 199, 63, 0, 3, M.RED_PAINT);
    // cargo line (south-west): containers, sledges of crates
    B.container(30, 190, 'x', M.AUR_ORANGE, true); B.container(34, 214, 'x', M.CONT_B); B.container(70, 230, 'z', M.CONT_R, true);
    for (const [x, z] of [[62, 196], [74, 196], [60, 180]]) { B.obox(x, z, x + 7, z + 5, 0, 0, M.WOOD); B.obox(x + 1, z + 1, x + 6, z + 4, 1, 4, M.CRATE); }
    B.obox(18, 236, 25, 243, 0, 3, M.CRATE); B.obox(84, 206, 87, 209, 0, 3, M.RED_PAINT);
    // helipad and core racks (south-east)
    for (let dz = -17; dz <= 17; dz++) for (let dx = -17; dx <= 17; dx++) { const d = dx * dx + dz * dz; if (d <= 289) B.surf(228 + dx, 214 + dz, 228 + dx, 214 + dz, d >= 240 ? M.LINE : M.ICE); }
    B.surf(222, 206, 223, 222, M.LINE); B.surf(233, 206, 234, 222, M.LINE); B.surf(224, 213, 232, 214, M.LINE);
    B.obox(254, 196, 254, 196, 0, 14, M.PIPE); B.obox(255, 196, 259, 196, 12, 14, M.AUR_ORANGE);
    for (const z of [178, 186]) { B.obox(196, z, 214, z + 1, 0, 5, M.METAL); B.obox(196, z, 214, z + 1, 1, 4, M.ICE); }
    snowcat(186, 232, M.AUR_ORANGE); snowcat(152, 244, M.CAR_W);
    // flag lines, drifts, lights
    const flag = (x, z) => { B.obox(x, z, x, z, 0, 7, M.WOOD); B.obox(x + 1, z, x + 2, z, 6, 7, M.RED_PAINT); };
    for (const z of [4, 14]) { flag(130, z); flag(150, z); }
    for (let x = 4; x < 20; x += 8) flag(x, 150);
    for (let x = 262; x < 280; x += 8) flag(x, 114);
    for (const [x, z, r] of [[14, 62, 5], [94, 10, 4], [190, 80, 5], [266, 182, 6], [66, 254, 5], [10, 204, 4], [194, 256, 4], [270, 22, 5], [90, 84, 3], [262, 250, 4], [40, 10, 4]]) B.rock(x, z, r, M.SNOW);
    for (const [x0, z0, x1, z1] of [[60, 100, 76, 103], [186, 174, 196, 176], [84, 240, 96, 243], [240, 84, 252, 86], [2, 100, 12, 102]]) B.obox(x0, z0, x1, z1, 0, 1, M.SNOW);
    for (const [x, z] of [[96, 88], [184, 88], [96, 176], [184, 176], [20, 172], [260, 92], [98, 20], [182, 244]]) B.lamp(x, z, 15, M.NEON_B);
    B.cam(88, 26, 84, -135, -14, 'ANTENNA FIELD'); B.box(88, 13, 84, 88, 25, 84, M.PIPE);
    B.cam(192, 26, 184, 45, -14, 'HELIPAD'); B.box(192, 13, 184, 192, 25, 184, M.PIPE);
    B.spawn('North Ice Road', 140, 6, 0); B.spawn('West Flag Line', 6, 132, -90); B.spawn('East Core Field', 276, 132, 90); B.spawn('South Skiway', 140, 260, 180);
    B.meta.bombs = [['Command Centre', 'Comms Room'], ['Generator Plant', 'Battery Hall'], ['Server Room', 'Weather Office'], ['Galley', 'Mess Hall'], ['Drill Control', 'Core Library']];
    B.meta.secure = ['Armoury', 'Ice Core Archive', 'Server Room', 'Bunk Room A', 'Drill Pit'];
    B.meta.hostage = ['Sick Bay', 'Cold Storage', 'Crew Lounge', 'Tool Crib', 'Dispatch Loft'];
    B.meta.defSpawns = ['Briefing Room', 'Rec Room', 'Dry Lab'];
    return finish(B);
  }
  define({ id: 'aurora', name: 'AURORA STATION', fn: aurora, blurb: 'Polar research station · aurora night', cover: 'aurora', tint: 'rgba(40,150,130,0.35)' });
})();
