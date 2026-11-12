/* maps-new-c.js -- two maps:
     IRONWOOD  a decommissioned penitentiary: a three-tier cell block, a rotunda where the wings meet, a fenced yard
     BIODOME   a botanical research garden: three glasshouse biomes round a low visitor and laboratory building */
(function () {
  'use strict';
  const { M, mat, SOFTW } = DATA;
  const { Builder, COVER, WING, define } = MAPS;
  const GY = 12, FL = ['B', '1F', '2F', '3F'];

  /* ------------------------------------------------------------------ shared helpers */
  /* A stair core through levels lo..hi: 13 across and 24 along, walls included, the flights
     switching sides every storey. ax 'z' lays the run along z, 'x' along x. Odd levels land at
     the low end of the run and even levels at the high end, so that is where each level's door
     goes (the caller cuts them). A landing no flight reaches is walled up solid. */
  function core(b, lx, lz, o) {
    const ax = o.ax || 'z', lo = o.lo == null ? b.lo : o.lo, hi = o.hi == null ? b.hi : o.hi, wall = o.wall || b.inner;
    const R = (u0, v0, u1, v1) => ax === 'z' ? [lx + v0, lz + u0, lx + v1, lz + u1] : [lx + u0, lz + v0, lx + u1, lz + v1];
    for (let L = lo; L <= hi; L++) { const r = R(0, 0, 23, 12); b.room(L, o.name + ' ' + FL[L], r[0], r[1], r[2], r[3], { wall }); }
    for (let L = lo; L < hi; L++) {
      if (L % 2 === 0) { if (ax === 'z') b.stairs(L, lx + 7, lz + 16, '-z', 5); else b.stairs(L, lx + 16, lz + 7, '-x', 5); }
      else if (ax === 'z') b.stairs(L, lx + 1, lz + 5, '+z', 5); else b.stairs(L, lx + 5, lz + 1, '+x', 5);
    }
    for (let L = lo; L <= hi; L++) {
      const up = L < hi, down = L > lo;
      const rl = (u0, v0, u1, v1) => { const r = R(u0, v0, u1, v1); b.rail(L, r[0], r[1], r[2], r[3]); };
      const solid = (u0, v0, u1, v1) => { const r = R(u0, v0, u1, v1); b.box(L, r[0], r[1], r[2], r[3], 0, 10, wall); };
      rl(5, 6, 16, 6);
      if (up && down) { if (L % 2) solid(17, 1, 22, 11); else solid(1, 1, 4, 11); }
      else if (down) { if (L % 2) rl(17, 7, 17, 11); else rl(4, 1, 4, 5); }
    }
  }
  /* a rail on every floor voxel of level L in the rectangle that has a drop beside it (the edge of a
     void, the sides and foot of a stair hole): call it once the voids and flights are cut */
  function autoRail(b, L, lx0, lz0, lx1, lz1) {
    const W = b.W, y = L * 12;
    for (let lz = lz0; lz <= lz1; lz++) for (let lx = lx0; lx <= lx1; lx++) {
      const x = b.X(lx), z = b.Z(lz), m = W.get(x, y, z);
      if (!m || m === M.STAIR || W.get(x, y + 1, z)) continue;
      let edge = false;
      for (let dz = -1; dz <= 1 && !edge; dz++) for (let dx = -1; dx <= 1; dx++) if (!W.get(x + dx, y, z + dz)) { edge = true; break; }
      if (!edge) continue;
      for (let h = 1; h <= 3; h++) if (h === 3 || (x + z) % 4 === 0) W.put(x, y + h, z, M.RAIL);
    }
  }
  /* a grille along a wall line from a0 to a1: upright bars every second voxel tied by rails, with clear
     doorways at `gaps` ([from, to] pairs). Whatever stood on the line goes first. */
  function bars(b, L, axis, line, a0, a1, gaps, m) {
    const W = b.W, y0 = L * 12 + 1;
    for (let a = a0; a <= a1; a++) {
      const x = axis === 'z' ? b.X(a) : b.X(line), z = axis === 'z' ? b.Z(line) : b.Z(a);
      const gap = (gaps || []).some(g => a >= g[0] && a <= g[1]);
      for (let h = 0; h <= 10; h++) W.put(x, y0 + h, z, (gap ? h >= 9 : h % 3 === 0 || h === 10 || (a & 1) === 0) ? m : 0);
    }
  }
  /* glass let into a wall without making it a window the game knows about (interior screens, and
     lights in a wall that stands over a lower roof, where nobody can rope up) */
  const pane = (b, L, axis, line, a0, n, h0, h1) => axis === 'z'
    ? b.box(L, a0, line, a0 + n - 1, line, h0 == null ? 4 : h0, h1 == null ? 8 : h1, M.GLASS)
    : b.box(L, line, a0, line, a0 + n - 1, h0 == null ? 4 : h0, h1 == null ? 8 : h1, M.GLASS);
  /* recolour the floor of level L in a rectangle (whatever slab is there; holes stay holes) */
  const paint = (b, L, lx0, lz0, lx1, lz1, m) => b.W.fill(b.X(lx0), L * 12, b.Z(lz0), b.X(lx1), L * 12, b.Z(lz1), (x, y, z, cur) => cur && cur !== M.STAIR && cur !== M.HATCH ? m : -1);
  /* several windows of one width along a wall */
  const wins = (b, L, axis, line, list, n) => { for (const a of list) if (axis === 'z') b.winZ(L, line, a, n); else b.winX(L, line, a, n); };

  /* ====================================================================== IRONWOOD */
  const IRN_STONE = mat('IRN_STONE', 0x7c7e7a, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'brick', wall: true });
  const IRN_BLOCK = mat('IRN_BLOCK', 0x99a596, { pat: 'block' });
  const IRN_CREAM = mat('IRN_CREAM', 0xcbc4a8, SOFTW);
  const IRN_GREEN = mat('IRN_GREEN', 0x7d9383, SOFTW);
  const IRN_BARS = mat('IRN_BARS', 0x34383c, {});
  const IRN_FLOOR = mat('IRN_FLOOR', 0x8b8d8a, { hp: 40, pen: 0.45, xp: true, hb: true, pat: 'noise', floor: true });
  const IRN_LINO = mat('IRN_LINO', 0x86958a, { hp: 40, pen: 0.45, xp: true, hb: true, pat: 'checker', floor: true });
  const IRN_GRATE = mat('IRN_GRATE', 0x565b60, { hp: 40, pen: 0.6, xp: true, hb: true, pat: 'plates', floor: true });
  const IRN_SCRUB = mat('IRN_SCRUB', 0x6c705c, { pat: 'noise' });
  const IRN_ORANGE = mat('IRN_ORANGE', 0xc9682c, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true, pat: 'noise' });

  // attacker cover: a stretch of the old perimeter wall, taller than the three-storey roofs can see over, with a sentry box
  COVER.irnwall = b => {
    b(-23, 23, 15, 18, 0, 15, M.CONCRETE); b(-24, 24, 14, 19, 16, 16, M.DARK);
    for (const u of [-25, -9, 7, 23]) b(u, u + 2, 14, 19, 0, 17, IRN_STONE);
    b(-20, -12, 9, 14, 0, 11, M.WHITE); b(-21, -11, 8, 14, 12, 12, M.DARK); b(-17, -15, 9, 9, 0, 8, M.BLUE_PAINT); b(-14, -13, 9, 9, 5, 8, M.GLASS);
    b(4, 16, 11, 13, 0, 3, M.SANDBAG); b(-6, -6, 14, 14, 0, 20, M.PIPE); b(-7, -5, 13, 14, 21, 21, M.LAMP);
  };
  WING.irnwall = [M.CONCRETE, M.DARK];

  function ironwood() {
    const B = new Builder('ironwood', 'IRONWOOD', 310, 64, 279);
    B.meta.desc = 'A decommissioned penitentiary: a three-tier cell block, a rotunda where the wings meet, a mess and laundry wing, the warden\'s offices, and a fenced yard under two watchtowers. A grey, windy day.';
    B.theme({ sky: [0x59606a, 0xaab0b4], fog: 0x9aa0a4, fogFar: 120, lightOut: [0.82, 0.85, 0.9], lightIn: [0.66, 0.64, 0.6], sun: 0xdfe5ea, outer: 0x6c705c });
    B.ground(IRN_SCRUB);
    // the yard, the road in through the sally port, the visitors' car park, the delivery yard, the motor pool
    B.surf(43, 45, 266, 103, M.ASPHALT); B.surf(126, 0, 143, 39, M.ASPHALT);
    B.surf(56, 248, 214, 278, M.ASPHALT); B.surf(121, 239, 133, 247, M.CONCRETE);
    B.surf(0, 150, 39, 178, M.ASPHALT); B.surf(270, 112, 309, 176, M.GRAVEL); B.surf(167, 168, 268, 190, M.GRAVEL);

    const hub = B.building(103, 104, 64, 64, { lo: 0, hi: 3, ext: IRN_STONE, inner: IRN_CREAM, slab: IRN_FLOOR, roof: M.ROOF });
    const cb = B.building(166, 104, 104, 64, { lo: 0, hi: 3, ext: IRN_STONE, inner: IRN_BLOCK, slab: IRN_FLOOR, roof: M.ROOF });
    const sv = B.building(40, 104, 64, 64, { lo: 0, hi: 2, ext: IRN_STONE, inner: IRN_GREEN, slab: IRN_LINO, roof: M.ROOF });
    const ad = B.building(103, 167, 64, 72, { lo: 1, hi: 2, ext: M.BRICK, inner: IRN_CREAM, slab: M.WOODFLOOR, roof: M.ROOF });
    // the hub stands a storey above the services and admin wings: make its walls good above their roofs
    B.box(103, 37, 104, 103, 48, 167, IRN_STONE); B.box(103, 49, 104, 103, 50, 167, M.CONCRETE);
    B.box(103, 37, 167, 166, 48, 167, IRN_STONE); B.box(103, 49, 167, 166, 50, 167, M.CONCRETE);

    /* ------------------------------------------------------------------ THE HUB (rotunda) */
    paint(hub, 1, 1, 1, 62, 62, M.TILE);
    core(hub, 0, 0, { ax: 'x', name: 'Hub Stairs', wall: IRN_BLOCK });
    hub.room(0, 'Electrical Room', 23, 0, 63, 25, { wall: M.CONCRETE });
    hub.room(0, 'Evidence Store', 0, 38, 63, 63, { wall: M.CONCRETE });
    hub.room(0, 'Tunnel Junction', 0, 12, 63, 38, { skip: 'sn' });
    hub.room(1, 'Key Room', 45, 0, 63, 18, { floor: M.CARPET2 });
    hub.room(1, 'Staff Room', 0, 45, 18, 63, { wall: IRN_GREEN, floor: IRN_LINO });
    hub.room(1, 'Search Room', 45, 45, 63, 63, { wall: IRN_GREEN, floor: IRN_FLOOR });
    hub.room(1, 'Guard Station', 26, 26, 38, 38, { wall: M.METAL, floor: M.CARPET2 });
    hub.room(1, 'Rotunda', 0, 0, 63, 63);
    hub.room(2, 'Watch Office', 45, 0, 63, 18, { floor: M.CARPET2 });
    hub.room(2, 'Rotunda Gallery', 0, 0, 63, 63);
    hub.void(2, 20, 20, 43, 43);
    hub.room(3, 'Radio Room', 23, 0, 63, 24, { floor: M.CARPET2 });
    hub.room(3, 'Central Control', 0, 34, 63, 63, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    hub.room(3, 'Control Corridor', 0, 12, 63, 34, { skip: 'sn' });
    // the glazed guard station in the middle of the rotunda, under the open well
    for (const [x0, z0, x1, z1] of [[28, 26, 36, 26], [28, 38, 36, 38], [26, 28, 26, 36], [38, 28, 38, 36]]) hub.box(1, x0, z0, x1, z1, 4, 8, M.GLASS);
    hub.box(1, 27, 27, 37, 37, 10, 10, M.METAL);
    for (const [x, z] of [[20, 20], [42, 20], [20, 42], [42, 42]]) hub.box(1, x, z, x + 1, z + 1, 0, 10, M.CONCRETE);
    // doors: basement
    hub.doorZ(0, 12, 18); hub.doorZ(0, 25, 40); hub.doorX(0, 23, 16); hub.doorZ(0, 38, 14); hub.doorZ(0, 38, 46);
    hub.doorX(0, 0, 28, 8); hub.doorX(0, 63, 28, 8);
    // doors: 1F -- the four gateways (yard, cell hall, admin, services), the corner rooms, the guard station
    hub.doorZ(1, 0, 29, 6); hub.doorX(1, 63, 26, 12, 10); hub.doorZ(1, 63, 28, 8, 10); hub.doorX(1, 0, 28, 8, 10);
    hub.doorZ(1, 12, 1); hub.doorX(1, 45, 8); hub.doorZ(1, 18, 52); hub.doorX(1, 18, 52); hub.doorZ(1, 45, 8); hub.doorX(1, 45, 52); hub.doorZ(1, 45, 52);
    hub.doorZ(1, 26, 30); hub.doorZ(1, 38, 30);
    // doors: 2F and 3F
    hub.doorZ(2, 12, 18); hub.doorX(2, 45, 8); hub.doorZ(2, 18, 52);
    hub.doorX(2, 63, 28, 8); hub.doorX(2, 0, 28, 8); hub.doorZ(2, 63, 28, 8);
    hub.doorZ(3, 12, 1); hub.doorZ(3, 24, 30); hub.doorZ(3, 24, 52); hub.doorX(3, 23, 16); hub.doorZ(3, 34, 10); hub.doorZ(3, 34, 44, 6);
    hub.doorX(3, 63, 26, 6);
    hub.winZ(1, 0, 24, 4); wins(hub, 1, 'z', 0, [38, 50], 5); wins(hub, 2, 'z', 0, [27, 37, 50], 6); wins(hub, 3, 'z', 0, [28, 40, 52], 6);
    pane(hub, 2, 'x', 45, 2, 5); pane(hub, 2, 'z', 18, 46, 5);
    for (const a of [16, 42, 52]) pane(hub, 3, 'x', 0, a, 6);
    for (const a of [8, 24, 40, 54]) pane(hub, 3, 'z', 63, a, 6);
    pane(hub, 3, 'x', 63, 36, 9, 3, 8);   // central control looks down the cell hall
    hub.hatch(3, 8, 44); hub.hatch(2, 48, 12); hub.hatch(1, 50, 4);
    autoRail(hub, 2, 19, 19, 44, 44);
    // furniture: basement
    hub.rack(0, 28, 2, 44, 4); hub.rack(0, 48, 2, 60, 4); hub.box(0, 52, 12, 60, 18, 0, 6, M.METAL); hub.box(0, 28, 12, 34, 17, 0, 4, M.BOILER); hub.box(0, 26, 22, 36, 23, 0, 3, M.CRATE);
    hub.box(0, 1, 26, 62, 26, 10, 10, M.PIPE); hub.box(0, 26, 27, 33, 30, 0, 3, M.CRATE); hub.box(0, 4, 14, 9, 19, 0, 7, M.METAL); hub.box(0, 52, 34, 58, 37, 0, 3, M.CRATE);
    for (const x of [6, 22, 38, 54]) hub.shelf(0, x, 46, x + 1, 60, 8);
    hub.table(0, 26, 40, 34, 43, M.METAL); hub.box(0, 44, 52, 50, 58, 0, 3, M.CRATE); hub.box(0, 10, 50, 16, 54, 0, 3, M.CRATE); hub.box(0, 58, 40, 61, 44, 0, 6, M.METAL);
    // furniture: 1F
    hub.box(1, 24, 3, 25, 11, 0, 1, M.WOOD); hub.box(1, 8, 13, 17, 14, 0, 7, M.METAL); hub.desk(1, 12, 39, 18, 42);
    hub.box(1, 27, 56, 27, 56, 0, 9, M.METAL); hub.box(1, 36, 56, 36, 56, 0, 9, M.METAL); hub.box(1, 27, 56, 36, 56, 9, 9, M.METAL);
    hub.box(1, 19, 56, 26, 56, 0, 3, M.METAL); hub.box(1, 37, 56, 44, 56, 0, 3, M.METAL);
    hub.box(1, 56, 20, 61, 21, 0, 1, M.WOOD); hub.box(1, 56, 42, 61, 43, 0, 1, M.WOOD); hub.box(1, 2, 20, 3, 25, 0, 1, M.WOOD);
    hub.box(1, 27, 29, 28, 35, 0, 3, M.COUNTER); hub.box(1, 27, 30, 27, 34, 4, 5, M.SCREEN); hub.box(1, 36, 29, 37, 35, 0, 3, M.COUNTER); hub.box(1, 37, 30, 37, 34, 4, 5, M.SCREEN);
    hub.box(1, 62, 3, 62, 16, 3, 8, M.BRASS); hub.desk(1, 55, 9, 60, 12); hub.box(1, 58, 14, 61, 17, 0, 5, M.METAL);
    hub.table(1, 4, 54, 10, 58); hub.couch(1, 2, 60, 12, 62, M.FAB_BLUE, 'n'); hub.counter(1, 14, 47, 17, 50); hub.box(1, 2, 47, 4, 49, 0, 7, M.FRIDGE);
    hub.table(1, 56, 57, 61, 61, M.METAL); hub.box(1, 47, 60, 53, 61, 0, 1, M.WOOD); hub.box(1, 58, 47, 62, 48, 0, 7, M.METAL);
    // furniture: 2F gallery and watch office
    hub.box(2, 3, 16, 6, 24, 0, 6, M.METAL); hub.couch(2, 3, 40, 5, 48, M.FAB_BLUE, 'w'); hub.table(2, 12, 52, 20, 56); hub.box(2, 46, 52, 52, 57, 0, 3, M.CRATE);
    hub.box(2, 57, 40, 61, 46, 0, 6, M.METAL); hub.desk(2, 57, 21, 62, 24); hub.box(2, 26, 2, 34, 4, 0, 1, M.WOOD); hub.box(2, 10, 30, 12, 33, 0, 3, M.CRATE);
    hub.desk(2, 54, 3, 60, 6); hub.shelf(2, 47, 16, 50, 17, 7); hub.box(2, 61, 10, 62, 16, 0, 7, M.METAL);
    // furniture: 3F
    hub.rack(3, 60, 4, 62, 20); hub.table(3, 34, 9, 44, 14, M.METAL); hub.box(3, 36, 10, 42, 11, 4, 5, M.SERVER); hub.desk(3, 26, 3, 32, 6); hub.box(3, 48, 16, 54, 19, 0, 3, M.CRATE);
    hub.box(3, 2, 20, 4, 22, 0, 5, M.WHITE); hub.box(3, 14, 30, 22, 32, 0, 1, M.WOOD); hub.box(3, 52, 31, 57, 33, 0, 3, M.CRATE); hub.box(3, 8, 14, 12, 16, 0, 3, M.CRATE);
    hub.rack(3, 3, 42, 5, 58); hub.rack(3, 16, 48, 18, 60);
    hub.counter(3, 38, 43, 54, 45, M.COUNTER); hub.box(3, 39, 45, 53, 45, 4, 6, M.SCREEN); hub.counter(3, 44, 54, 58, 56, M.COUNTER); hub.box(3, 45, 54, 57, 54, 4, 6, M.SCREEN);
    hub.table(3, 22, 52, 28, 58, M.METAL); hub.box(3, 58, 36, 61, 39, 0, 5, M.METAL); hub.box(3, 30, 61, 40, 62, 0, 1, M.WOOD);
    // the radio mast on the roof
    for (let h = 0; h <= 12; h++) B.box(hub.X(52), hub.roofY + 1 + h, hub.Z(8), hub.X(52), hub.roofY + 1 + h, hub.Z(8), h % 4 < 2 ? M.RED_PAINT : M.WHITE);
    B.box(hub.X(52), hub.roofY + 14, hub.Z(8), hub.X(52), hub.roofY + 14, hub.Z(8), M.LAMP_R);

    /* ------------------------------------------------------------------ THE CELL BLOCK */
    // basement: the service tunnel, solitary, plant
    cb.room(0, 'Generator Room', 0, 0, 52, 25, { wall: M.CONCRETE });
    cb.room(0, 'Pump Room', 52, 0, 103, 25, { wall: M.CONCRETE });
    cb.room(0, 'Service Tunnel', 0, 25, 103, 38, { wall: M.CONCRETE });
    cb.room(0, 'Solitary', 0, 38, 103, 63, { wall: M.CONCRETE });
    // 1F: the hall floor, a row of cells down each side, an office, a lobby with the back stairs
    cb.room(1, 'Block Office', 0, 0, 22, 13, { floor: IRN_LINO });
    cb.room(1, 'Cells 1F North', 22, 0, 103, 13);
    cb.room(1, 'East Lobby', 82, 50, 103, 63);
    cb.room(1, 'Cells 1F South', 0, 50, 82, 63);
    cb.room(1, 'Cell Hall', 0, 13, 103, 50);
    // 2F and 3F: two tiers of cells behind catwalk galleries, open to the hall between
    for (const L of [2, 3]) {
      cb.room(L, 'Tier ' + L + ' North', 0, 0, 103, 32, { skip: 'n' });
      cb.room(L, 'Tier ' + L + ' South', 0, 31, 103, 63, { skip: 's' });
      cb.wallZ(L, 13, 1, 102, IRN_BLOCK); cb.wallZ(L, 50, 1, 102, IRN_BLOCK);
      for (const [x0, x1] of [[23, 37], [46, 57], [66, 81]]) cb.void(L, x0, 21, x1, 42);
      paint(cb, L, 1, 14, 102, 49, IRN_GRATE);
    }
    /* a row of n ten-voxel cells from lx0: partitions, a barred front with a doorway, a bunk, a pan, a window */
    const cellRow = (L, lx0, n, zBack, zFront, skip) => {
      const s = zFront > zBack ? 1 : -1, za = zBack + s, zb = zFront - s, z0 = Math.min(za, za + s * 6), z1 = Math.max(za, za + s * 6);
      for (let i = 0; i <= n; i++) cb.wallX(L, lx0 + i * 10, Math.min(za, zb), Math.max(za, zb), IRN_BLOCK);
      for (let i = 0; i < n; i++) {
        const p = lx0 + i * 10;
        if (skip && skip.includes(i)) continue;
        bars(cb, L, 'z', zFront, p + 1, p + 9, [[p + 5, p + 8]], IRN_BARS);
        cb.box(L, p + 1, z0, p + 3, z1, 0, 1, M.METAL); cb.box(L, p + 1, z0, p + 3, z1, 2, 2, (i + L) % 2 ? M.FAB_BLUE : M.WHITE);
        cb.box(L, p + 1, z0, p + 3, z1, 5, 5, M.METAL); cb.box(L, p + 1, z0, p + 3, z1, 6, 6, (i + L) % 2 ? M.WHITE : M.FAB_BLUE);
        cb.box(L, p + 8, Math.min(za, za + s), p + 9, Math.max(za, za + s), 0, 2, M.WHITE);
        cb.winZ(L, zBack, p + 4, 4);
      }
    };
    for (const L of [1, 2, 3]) { cellRow(L, 22, 6, 0, 13, L === 1 ? [2] : null); cellRow(L, 22, 6, 63, 50); }
    // solitary: six blind cells off their own corridor
    cb.wallZ(0, 50, 1, 72, M.CONCRETE); cb.wallX(0, 72, 50, 62, M.CONCRETE);
    for (let i = 0; i < 6; i++) {
      const p = i * 12;
      if (i) cb.wallX(0, p, 51, 62, M.CONCRETE);
      cb.box(0, p + 4, 50, p + 7, 50, 0, 8, 0); cb.box(0, p + 1, 57, p + 3, 62, 0, 2, M.CONCRETE); cb.box(0, p + 10, 61, p + 11, 62, 0, 2, M.WHITE);
    }
    // flights: back stairs to the basement, and one up each tier at each end of the hall
    cb.stairs(0, 85, 57, '+x', 5);
    cb.stairs(1, 5, 14, '+x', 5); cb.stairs(1, 98, 45, '-x', 5);
    cb.stairs(2, 5, 45, '+x', 5); cb.stairs(2, 98, 14, '-x', 5);
    // doors: basement
    cb.doorZ(0, 25, 20); cb.doorZ(0, 25, 44); cb.doorZ(0, 25, 70); cb.doorZ(0, 25, 92); cb.doorX(0, 52, 10);
    cb.doorZ(0, 38, 30); cb.doorZ(0, 38, 60); cb.doorZ(0, 38, 90);
    cb.cellar('s', 78);
    // doors: 1F (the west end is the gateway from the rotunda)
    cb.doorX(1, 103, 29, 6); cb.doorZ(1, 13, 17); cb.doorZ(1, 0, 8); cb.doorZ(1, 13, 90); cb.doorZ(1, 0, 88);
    cb.doorZ(1, 13, 44, 6); cb.doorZ(1, 0, 45);                      // a passage through the north cells to the yard
    cb.doorZ(1, 50, 8); cb.doorZ(1, 50, 83); cb.doorZ(1, 63, 98); cb.doorX(1, 103, 52);
    // doors: the end units of each tier
    for (const L of [2, 3]) { cb.doorZ(L, 13, 17); cb.doorZ(L, 50, 17); cb.doorZ(L, 13, 83); cb.doorZ(L, 50, 83); }
    // windows: the end units and the tall lights at the east end of the hall (every cell has its own)
    wins(cb, 1, 'z', 0, [14, 94], 5); wins(cb, 1, 'z', 63, [4, 14], 5); wins(cb, 1, 'x', 103, [4, 18, 40, 58], 5);
    for (const L of [2, 3]) { wins(cb, L, 'z', 0, [5, 14, 86, 95], 5); wins(cb, L, 'z', 63, [5, 14, 86, 95], 5); wins(cb, L, 'x', 103, [4, 21, 29, 37, 55], 6); }
    pane(cb, 1, 'z', 13, 3, 11);
    cb.hatch(1, 60, 30); cb.hatch(1, 2, 5); cb.hatch(2, 36, 6); cb.hatch(3, 66, 55);
    autoRail(cb, 1, 83, 51, 102, 62);
    for (const L of [2, 3]) autoRail(cb, L, 1, 14, 102, 49);
    // the long rooflight over the hall
    B.box(cb.X(23), cb.roofY, cb.Z(21), cb.X(81), cb.roofY, cb.Z(42), M.GLASS);
    for (let lx = 23; lx <= 81; lx += 6) B.box(cb.X(lx), cb.roofY, cb.Z(21), cb.X(lx), cb.roofY, cb.Z(42), M.METAL);
    B.box(cb.X(23), cb.roofY, cb.Z(31), cb.X(81), cb.roofY, cb.Z(32), M.METAL);
    // furniture: basement
    cb.box(0, 16, 4, 28, 12, 0, 7, M.METAL); cb.box(0, 34, 4, 46, 12, 0, 7, M.METAL); cb.box(0, 17, 5, 27, 11, 8, 8, M.RED_PAINT); cb.box(0, 35, 5, 45, 11, 8, 8, M.RED_PAINT);
    cb.tank(0, 6, 18, 2, 5, M.RED_PAINT); cb.tank(0, 12, 20, 2, 5, M.RED_PAINT); cb.rack(0, 28, 22, 40, 23); cb.box(0, 30, 13, 31, 21, 9, 9, M.PIPE);
    cb.tank(0, 88, 13, 4, 6, M.METAL); cb.tank(0, 98, 6, 3, 6, M.METAL); cb.box(0, 54, 16, 60, 21, 0, 3, M.CRATE); cb.table(0, 66, 3, 74, 6, M.METAL); cb.box(0, 88, 13, 88, 24, 9, 9, M.PIPE);
    cb.box(0, 1, 27, 102, 27, 10, 10, M.PIPE); cb.box(0, 12, 34, 19, 37, 0, 3, M.CRATE); cb.box(0, 48, 26, 54, 28, 0, 3, M.CRATE); cb.box(0, 76, 34, 84, 37, 0, 3, M.METAL); cb.box(0, 98, 26, 102, 29, 0, 5, M.CRATE);
    cb.desk(0, 42, 40, 48, 43); cb.box(0, 4, 40, 12, 41, 0, 1, M.WOOD); cb.box(0, 94, 41, 101, 47, 0, 3, M.CRATE); cb.box(0, 74, 52, 79, 56, 0, 5, M.METAL);
    // furniture: 1F
    for (const x of [28, 48, 70]) { cb.table(1, x, 29, x + 7, 34, M.METAL); cb.box(1, x, 27, x + 7, 27, 0, 1, M.METAL); cb.box(1, x, 36, x + 7, 36, 0, 1, M.METAL); }
    cb.box(1, 41, 31, 42, 32, 0, 10, M.METAL); cb.box(1, 61, 35, 62, 36, 0, 10, M.METAL); cb.desk(1, 20, 40, 26, 43); cb.box(1, 90, 22, 96, 25, 0, 3, M.CRATE);
    cb.desk(1, 12, 3, 18, 6); cb.box(1, 2, 10, 6, 12, 0, 6, M.METAL); cb.box(1, 14, 10, 15, 12, 0, 1, M.WOOD);
    cb.couch(1, 95, 2, 101, 5, M.FAB_BLUE, 's'); cb.table(1, 84, 7, 87, 11); cb.box(1, 96, 11, 100, 12, 0, 5, M.TRIM); cb.box(1, 97, 11, 99, 11, 6, 8, M.SCREEN);
    paint(cb, 1, 1, 51, 21, 62, M.TILE);
    for (const x of [5, 10, 15]) cb.box(1, x, 57, x, 62, 0, 7, M.WHITE);
    cb.box(1, 1, 61, 20, 62, 9, 9, M.PIPE); cb.box(1, 18, 52, 20, 55, 0, 1, M.WOOD);
    cb.box(1, 90, 51, 95, 52, 0, 7, M.METAL);
    // furniture: the tiers (end units and landings)
    cb.desk(2, 3, 3, 9, 6); cb.box(2, 12, 9, 15, 12, 0, 6, M.METAL); cb.shelf(2, 2, 60, 12, 61, 7); cb.box(2, 8, 52, 12, 55, 0, 3, IRN_ORANGE);
    cb.couch(2, 94, 2, 100, 5, M.FAB_RED, 's'); cb.box(2, 96, 11, 100, 12, 0, 5, M.TRIM); cb.box(2, 97, 11, 99, 11, 6, 8, M.SCREEN); cb.crates(2, 92, 54, 4);
    cb.box(3, 3, 3, 10, 9, 0, 3, M.CRATE); cb.box(3, 4, 4, 8, 7, 4, 7, M.CRATE); cb.shelf(3, 2, 60, 14, 61, 8); cb.table(3, 4, 53, 10, 56);
    cb.box(3, 90, 3, 97, 4, 0, 1, M.METAL); cb.box(3, 89, 6, 98, 6, 3, 3, M.DARK); cb.box(3, 93, 9, 96, 12, 0, 2, M.FAB_BLUE); cb.box(3, 90, 55, 97, 56, 0, 1, M.WOOD); cb.box(3, 90, 60, 97, 61, 0, 1, M.WOOD);
    for (const L of [2, 3]) { cb.box(L, 15, 37, 19, 40, 0, 3, M.CRATE); cb.box(L, 88, 24, 93, 27, 0, 3, M.CRATE); cb.box(L, 2, 22, 3, 25, 0, 6, M.METAL); }

    /* ------------------------------------------------------------------ THE SERVICES WING */
    core(sv, 0, 38, { ax: 'x', name: 'Services Stairs', wall: IRN_BLOCK });
    sv.room(0, 'Kitchen Stores', 0, 0, 63, 25, { wall: M.CONCRETE });
    sv.room(0, 'Service Tunnel', 0, 25, 63, 38, { wall: M.CONCRETE });
    sv.room(0, 'Boiler Room', 23, 38, 63, 63, { wall: M.CONCRETE });
    sv.room(0, 'Coal Bunker', 0, 50, 23, 63, { wall: M.CONCRETE });
    sv.room(1, 'Kitchen', 0, 0, 26, 26, { floor: M.TILE });
    sv.room(1, 'Mess Hall', 26, 0, 63, 26);
    sv.room(1, 'Services Corridor', 0, 26, 63, 38);
    sv.room(1, 'Laundry', 23, 38, 63, 63, { wall: IRN_CREAM, floor: M.TILE });
    sv.room(1, 'Loading Bay', 0, 50, 23, 63, { wall: IRN_BLOCK, floor: M.CONCRETE });
    sv.room(2, 'Infirmary', 0, 0, 63, 26, { wall: IRN_CREAM, floor: M.TILE });
    sv.room(2, 'Services Hall', 0, 26, 63, 38);
    sv.room(2, 'Workshop', 23, 38, 63, 63, { wall: IRN_CREAM, floor: M.CONCRETE });
    sv.room(2, 'Tool Crib', 0, 50, 23, 63, { wall: IRN_CREAM });
    // doors: basement
    sv.doorZ(0, 25, 12); sv.doorZ(0, 25, 46); sv.doorZ(0, 38, 10); sv.doorZ(0, 38, 30); sv.doorZ(0, 38, 52); sv.doorX(0, 23, 54);
    sv.cellar('n', 16);
    // doors: 1F
    sv.doorX(1, 0, 30); sv.doorX(1, 0, 8); sv.doorZ(1, 0, 42, 6); sv.doorZ(1, 63, 44); sv.shutterX(1, 0, 52, 10);
    sv.doorZ(1, 26, 10); sv.doorX(1, 26, 16); sv.winX(1, 26, 4, 9, false); sv.doorZ(1, 26, 34); sv.doorZ(1, 26, 54);
    sv.doorZ(1, 38, 1); sv.doorZ(1, 38, 30); sv.doorZ(1, 38, 52); sv.doorX(1, 23, 54);
    // doors: 2F
    sv.doorZ(2, 26, 10); sv.doorZ(2, 26, 34); sv.doorZ(2, 26, 54); sv.doorZ(2, 38, 18); sv.doorZ(2, 38, 30); sv.doorZ(2, 38, 52); sv.doorX(2, 23, 54);
    wins(sv, 1, 'z', 0, [6, 16, 30, 52], 5); wins(sv, 1, 'x', 0, [16], 5); wins(sv, 1, 'z', 63, [30, 54], 6);
    wins(sv, 2, 'z', 0, [6, 18, 30, 42, 54], 6); wins(sv, 2, 'x', 0, [8, 30, 54], 5); wins(sv, 2, 'z', 63, [6, 28, 40, 54], 6);
    sv.hatch(2, 44, 12); sv.hatch(2, 56, 44); sv.hatch(1, 4, 18); sv.hatch(1, 36, 44);
    // furniture: basement
    sv.box(0, 2, 2, 20, 3, 0, 9, M.FRIDGE); sv.box(0, 2, 4, 3, 14, 0, 9, M.FRIDGE); sv.box(0, 8, 8, 14, 12, 0, 3, M.ICE);
    for (const x of [26, 34, 52, 60]) sv.shelf(0, x, 4, x + 1, 18, 8);
    sv.crates(0, 40, 4, 6); sv.box(0, 20, 20, 26, 23, 0, 3, M.CRATE); sv.box(0, 56, 21, 61, 23, 0, 2, M.SANDBAG);
    sv.box(0, 1, 27, 62, 27, 10, 10, M.PIPE); sv.box(0, 20, 34, 26, 37, 0, 3, M.METAL); sv.box(0, 21, 35, 25, 36, 4, 4, IRN_ORANGE); sv.box(0, 40, 26, 46, 28, 0, 3, M.CRATE); sv.box(0, 2, 26, 5, 29, 0, 5, M.CRATE);
    sv.box(0, 28, 48, 38, 60, 0, 8, M.BOILER); sv.box(0, 48, 48, 58, 60, 0, 8, M.BOILER); sv.box(0, 33, 44, 33, 47, 9, 9, M.PIPE); sv.box(0, 53, 44, 53, 47, 9, 9, M.PIPE); sv.tank(0, 60, 42, 2, 7, M.METAL);
    sv.box(0, 2, 52, 10, 58, 0, 3, M.DARK); sv.box(0, 3, 53, 8, 57, 4, 5, M.DARK); sv.box(0, 2, 60, 6, 62, 0, 2, M.DARK);
    // furniture: 1F
    sv.counter(1, 4, 1, 22, 3, M.METAL); sv.box(1, 4, 1, 22, 2, 9, 10, M.METAL); sv.counter(1, 10, 9, 18, 12, M.METAL); sv.counter(1, 23, 4, 25, 12, M.COUNTER);
    sv.box(1, 20, 21, 24, 24, 0, 8, M.FRIDGE); sv.box(1, 2, 22, 3, 25, 0, 6, M.METAL); sv.tank(1, 13, 10, 1, 5, M.METAL);
    const mess = (x, z) => { sv.table(1, x, z + 1, x + 7, z + 2, M.METAL); sv.box(1, x, z - 1, x + 7, z - 1, 0, 1, M.METAL); sv.box(1, x, z + 4, x + 7, z + 4, 0, 1, M.METAL); };
    mess(30, 7); mess(52, 7); mess(33, 16); mess(44, 16); mess(55, 16);
    sv.box(1, 28, 2, 36, 3, 0, 3, M.COUNTER); sv.box(1, 60, 2, 62, 4, 0, 5, M.BLUE_PAINT);
    sv.box(1, 16, 27, 22, 28, 0, 3, M.METAL); sv.box(1, 42, 36, 47, 37, 0, 3, M.CRATE); sv.box(1, 58, 27, 61, 27, 0, 1, M.WOOD);
    sv.box(1, 58, 42, 62, 60, 0, 6, M.WHITE); for (let z = 44; z <= 58; z += 5) sv.box(1, 58, z, 58, z + 1, 2, 4, M.GLASS);
    sv.box(1, 26, 59, 40, 62, 0, 7, M.METAL); sv.table(1, 46, 45, 54, 49); sv.box(1, 47, 46, 53, 48, 4, 5, IRN_ORANGE); sv.box(1, 26, 46, 30, 49, 0, 3, IRN_ORANGE); sv.box(1, 50, 59, 55, 62, 0, 3, M.WHITE);
    sv.box(1, 8, 51, 13, 54, 0, 3, M.CRATE); sv.box(1, 14, 60, 20, 62, 0, 3, M.CRATE); sv.box(1, 15, 61, 19, 62, 4, 6, M.CRATE);
    // furniture: 2F
    for (const x of [30, 42, 54]) { sv.bed(2, x, 2, x + 7, 5, M.WHITE); if (x < 54) sv.box(2, x + 9, 1, x + 9, 8, 0, 7, M.FAB_BLUE); }
    sv.bed(2, 30, 15, 37, 18, M.WHITE); sv.bed(2, 54, 15, 61, 18, M.WHITE);
    sv.wallX(2, 26, 1, 14, IRN_CREAM); pane(sv, 2, 'x', 26, 3, 9);
    sv.shelf(2, 2, 2, 3, 18, 8); sv.shelf(2, 9, 2, 10, 12, 8); sv.counter(2, 14, 14, 22, 16, M.WHITE); sv.box(2, 20, 2, 24, 5, 0, 7, M.FRIDGE); sv.table(2, 14, 4, 18, 8, M.METAL);
    sv.box(2, 20, 27, 27, 28, 0, 3, M.WHITE); sv.box(2, 44, 36, 50, 37, 0, 1, M.WOOD); sv.box(2, 2, 27, 4, 29, 0, 6, M.METAL);
    sv.table(2, 28, 58, 44, 61); sv.box(2, 30, 59, 34, 60, 4, 5, M.METAL); sv.box(2, 34, 46, 40, 50, 0, 5, M.METAL); sv.box(2, 46, 52, 52, 56, 0, 6, M.METAL); sv.box(2, 60, 52, 62, 62, 0, 7, M.WOOD); sv.crates(2, 40, 40, 2);
    sv.shelf(2, 2, 52, 3, 61, 8); sv.shelf(2, 8, 60, 18, 61, 8); sv.table(2, 10, 52, 16, 55, M.METAL);

    /* ------------------------------------------------------------------ ADMIN AND INTAKE */
    ad.room(1, 'Admin Corridor', 26, 0, 38, 44);
    ad.room(1, 'Intake', 0, 0, 26, 24, { wall: IRN_GREEN, floor: IRN_LINO });
    ad.room(1, 'Visiting Room', 38, 20, 63, 44, { floor: IRN_LINO });
    ad.room(1, 'Reception', 0, 44, 46, 71, { floor: M.TILE });
    ad.room(1, 'Waiting Room', 46, 44, 63, 71, { floor: M.CARPET2 });
    ad.room(1, 'Holding Cells', 0, 24, 26, 44, { wall: IRN_BLOCK, floor: IRN_FLOOR });
    ad.room(1, 'Armoury', 38, 0, 63, 20, { wall: M.CONCRETE, floor: IRN_FLOOR });
    ad.room(2, 'Admin Hall', 26, 0, 38, 44);
    ad.room(2, "Captain's Office", 0, 0, 26, 24, { floor: M.CARPET2 });
    ad.room(2, 'Staff Lounge', 0, 24, 26, 44, { wall: IRN_GREEN });
    ad.room(2, 'Briefing Room', 38, 0, 63, 20, { wall: IRN_GREEN });
    ad.room(2, 'Records', 38, 20, 63, 44);
    ad.room(2, 'Upper Lobby', 0, 44, 38, 71, { floor: M.CARPET });
    ad.room(2, "Warden's Office", 38, 44, 63, 71, { wall: M.PANEL_DARK, floor: M.CARPET });
    ad.stairs(1, 6, 62, '-z', 6);
    autoRail(ad, 2, 1, 45, 37, 70);
    // doors: 1F
    ad.doorZ(1, 71, 20, 8); ad.doorX(1, 0, 64); ad.doorX(1, 0, 10); ad.doorX(1, 63, 36); ad.doorZ(1, 71, 52); ad.doorX(1, 63, 60);
    ad.doorX(1, 26, 6); ad.doorZ(1, 24, 16); ad.doorX(1, 26, 32); ad.doorX(1, 38, 8); ad.doorZ(1, 20, 56); ad.doorX(1, 38, 30);
    ad.doorZ(1, 44, 54); ad.doorZ(1, 44, 30, 6); ad.doorX(1, 46, 56);
    // doors: 2F
    ad.doorZ(2, 44, 30, 6); ad.doorZ(2, 44, 12); ad.doorX(2, 38, 56); ad.doorZ(2, 44, 48); ad.doorX(2, 38, 30); ad.doorX(2, 38, 8); ad.doorZ(2, 20, 52);
    ad.doorX(2, 26, 10); ad.doorX(2, 26, 32); ad.doorZ(2, 24, 6);
    wins(ad, 1, 'x', 0, [16, 48], 5); wins(ad, 1, 'x', 0, [27, 37], 4); wins(ad, 1, 'x', 63, [24, 48], 6); wins(ad, 1, 'z', 71, [6, 32, 40, 58], 5);
    wins(ad, 2, 'x', 0, [6, 16, 30, 48, 62], 6); wins(ad, 2, 'x', 63, [6, 28, 50, 62], 6); wins(ad, 2, 'z', 71, [8, 22, 44, 54], 6);
    ad.hatch(2, 56, 62); ad.hatch(2, 42, 36); ad.hatch(2, 12, 14);
    // holding cells, the armoury cage, the visiting-room screen
    ad.wallZ(1, 34, 1, 12, IRN_BLOCK); bars(ad, 1, 'x', 13, 25, 43, [[27, 30], [37, 40]], IRN_BARS);
    ad.box(1, 1, 25, 2, 32, 0, 1, M.METAL); ad.box(1, 1, 36, 2, 43, 0, 1, M.METAL); ad.box(1, 11, 25, 12, 26, 0, 2, M.WHITE); ad.box(1, 11, 42, 12, 43, 0, 2, M.WHITE);
    bars(ad, 1, 'x', 45, 1, 19, [[12, 15]], IRN_BARS);
    ad.box(1, 50, 21, 50, 38, 0, 3, M.COUNTER); ad.box(1, 50, 21, 50, 38, 4, 8, M.GLASS); ad.box(1, 50, 21, 50, 38, 9, 10, M.METAL); ad.box(1, 50, 43, 50, 43, 0, 10, M.METAL);
    for (const z of [26, 32, 38]) { ad.box(1, 48, z, 52, z, 0, 6, M.TRIM); ad.box(1, 47, z - 3, 47, z - 3, 0, 1, M.METAL); ad.box(1, 53, z - 3, 53, z - 3, 0, 1, M.METAL); }
    // furniture: 1F
    ad.desk(1, 4, 2, 10, 5); ad.box(1, 2, 18, 12, 19, 0, 1, M.WOOD); ad.counter(1, 18, 12, 24, 14, M.COUNTER); ad.box(1, 14, 2, 15, 3, 0, 6, M.DARK); ad.box(1, 20, 2, 24, 3, 0, 7, M.METAL);
    ad.desk(1, 18, 38, 24, 41); ad.box(1, 21, 26, 25, 27, 0, 1, M.WOOD);
    ad.box(1, 27, 14, 28, 24, 0, 1, M.WOOD); ad.box(1, 36, 38, 37, 41, 0, 7, M.BLUE_PAINT); ad.box(1, 36, 16, 37, 22, 0, 1, M.WOOD);
    ad.box(1, 39, 1, 43, 2, 0, 8, M.METAL); ad.table(1, 39, 16, 42, 18, M.METAL); ad.box(1, 54, 3, 61, 5, 0, 8, M.METAL); ad.box(1, 54, 8, 61, 11, 0, 3, M.CRATE); ad.box(1, 55, 9, 60, 10, 4, 6, M.CRATE); ad.box(1, 47, 1, 51, 2, 0, 3, M.CRATE);
    ad.box(1, 60, 22, 61, 30, 0, 1, M.WOOD); ad.box(1, 40, 22, 41, 27, 0, 1, M.METAL); ad.box(1, 60, 41, 62, 43, 0, 5, M.LEAF);
    ad.counter(1, 28, 52, 42, 54, M.TRIM); ad.box(1, 28, 52, 42, 52, 4, 7, M.GLASS); ad.box(1, 32, 66, 42, 67, 0, 1, M.WOOD); ad.box(1, 14, 46, 22, 47, 0, 7, M.METAL); ad.box(1, 43, 67, 45, 69, 0, 5, M.LEAF); ad.box(1, 14, 66, 17, 69, 0, 5, M.LEAF);
    for (const z of [48, 52, 64]) ad.box(1, 48, z, 51, z + 1, 0, 1, M.FAB_BLUE);
    ad.box(1, 60, 46, 62, 52, 0, 7, M.METAL); ad.table(1, 56, 66, 60, 69);
    // furniture: 2F
    ad.desk(2, 6, 5, 14, 9); ad.shelf(2, 14, 1, 22, 2, 8); ad.couch(2, 18, 16, 24, 20, M.FAB_BLUE, 'e'); ad.box(2, 2, 12, 3, 16, 0, 6, M.METAL);
    ad.couch(2, 2, 36, 5, 42, M.FAB_RED, 'w'); ad.table(2, 10, 30, 16, 36); ad.counter(2, 18, 26, 24, 28); ad.box(2, 2, 26, 4, 28, 0, 7, M.FRIDGE);
    for (const z of [5, 9, 13]) ad.box(2, 44, z, 58, z, 0, 1, M.FAB_BLUE);
    ad.box(2, 44, 1, 58, 1, 3, 8, M.WHITE); ad.box(2, 40, 16, 44, 18, 0, 4, M.TRIM);
    ad.shelf(2, 56, 26, 61, 27, 8); ad.shelf(2, 40, 26, 49, 27, 8); ad.shelf(2, 46, 34, 60, 35, 8); ad.box(2, 56, 40, 61, 42, 0, 3, M.PAPER);
    ad.desk(2, 26, 60, 32, 63); ad.couch(2, 16, 66, 26, 69, M.FAB_BLUE, 'n'); ad.shelf(2, 18, 46, 26, 47, 7); ad.box(2, 2, 46, 4, 48, 0, 5, M.LEAF);
    ad.desk(2, 44, 62, 52, 66); ad.shelf(2, 40, 46, 46, 47, 8); ad.couch(2, 57, 48, 61, 54, M.FAB_RED, 'e'); ad.box(2, 61, 68, 61, 68, 0, 8, M.BRASS); ad.box(2, 61, 67, 61, 67, 6, 8, M.RED_PAINT); ad.table(2, 40, 50, 44, 54);
    ad.box(2, 27, 14, 28, 24, 0, 1, M.WOOD); ad.box(2, 36, 36, 37, 41, 0, 6, M.METAL);
    // the porch over the front door, and the flag
    B.obox(ad.X(18), ad.Z(72), ad.X(29), ad.Z(77), 10, 10, M.CONCRETE); for (const lx of [18, 29]) B.obox(ad.X(lx), ad.Z(77), ad.X(lx), ad.Z(77), 0, 9, M.CONCRETE);
    B.obox(140, 246, 140, 246, 0, 26, M.PIPE); B.obox(141, 246, 146, 246, 22, 25, M.RED_PAINT);

    /* ------------------------------------------------------------------ THE YARD: towers, sally port, fences */
    const tower = (x, name, east) => {
      const t = B.building(x, 40, 20, 20, { lo: 1, hi: 2, ext: IRN_STONE, inner: IRN_BLOCK, slab: IRN_FLOOR, roof: M.ROOF });
      t.room(1, name + ' Tower', 0, 0, 19, 19); t.room(2, name + ' Lookout', 0, 0, 19, 19);
      t.stairs(1, east ? 14 : 1, 4, '+z', 5); autoRail(t, 2, 1, 1, 18, 18);
      t.doorX(1, east ? 0 : 19, 12); t.doorZ(1, 0, 8);
      t.winZ(1, 19, 8, 4); t.winX(1, east ? 19 : 0, 8, 4);
      t.winZ(2, 0, 6, 8); t.winZ(2, 19, 6, 8); t.winX(2, 0, 6, 8); t.winX(2, 19, 6, 8);
      t.box(1, 8, 16, 11, 18, 0, 3, M.CRATE); t.desk(2, 8, 2, 13, 4); t.box(2, east ? 2 : 15, 16, east ? 4 : 17, 17, 0, 6, M.METAL);
      for (let k = 0; k < 4; k++) B.box(t.x + k, t.roofY + 1 + k, t.z + k, t.x1 - k, t.roofY + 1 + k, t.z1 - k, M.ROOF);
      B.box(t.x + 9, t.roofY + 5, t.z + 9, t.x + 10, t.roofY + 6, t.z + 10, M.LAMP);
      return t;
    };
    tower(40, 'West', false); tower(250, 'East', true);
    const gh = B.building(117, 40, 36, 20, { lo: 1, hi: 1, ext: IRN_STONE, inner: IRN_BLOCK, slab: M.CONCRETE, roof: M.ROOF });
    gh.room(1, 'Sally Port', 0, 0, 22, 19); gh.room(1, 'Gate Office', 22, 0, 35, 19, { floor: IRN_LINO });
    gh.doorZ(1, 0, 5, 12, 10); gh.shutterZ(1, 19, 5, 12); gh.doorZ(1, 0, 27); gh.doorZ(1, 19, 27); gh.doorX(1, 22, 12);
    pane(gh, 1, 'x', 22, 3, 7); gh.winX(1, 35, 7, 6); gh.winX(1, 0, 7, 6);
    gh.desk(1, 30, 8, 34, 11); gh.box(1, 32, 14, 34, 17, 0, 6, M.METAL); gh.box(1, 2, 2, 3, 7, 0, 3, M.CONCRETE); gh.box(1, 18, 2, 20, 6, 0, 3, M.CRATE);
    gh.box(1, 5, 9, 16, 9, 4, 4, M.LINE);
    // the yard fence, twice the usual height, with a gate each side
    const fence = (x0, z0, x1, z1) => { B.fence(x0, z0, x1, z1, M.FENCE, 11); B.fence(x0, z0, x1, z1, M.FENCE, 6); };
    fence(60, 44, 116, 44); fence(153, 44, 249, 44);
    fence(42, 60, 42, 74); fence(42, 86, 42, 103); fence(267, 60, 267, 74); fence(267, 86, 267, 103);
    // a ball court, bleachers, a handball wall, the weight pit, tables
    for (const [x0, z0, x1, z1] of [[176, 56, 236, 56], [176, 92, 236, 92], [176, 56, 176, 92], [236, 56, 236, 92], [206, 56, 206, 92], [176, 68, 186, 68], [176, 80, 186, 80], [186, 68, 186, 80], [226, 68, 236, 68], [226, 80, 236, 80], [226, 68, 226, 80]]) B.surf(x0, z0, x1, z1, M.LINE);
    for (const [x, s] of [[178, 1], [234, -1]]) { B.obox(x, 74, x, 74, 0, 12, M.PIPE); B.obox(x + s, 72, x + s, 76, 9, 12, M.WHITE); B.obox(x + 2 * s, 74, x + 3 * s, 74, 9, 9, M.RED_PAINT); }
    B.obox(190, 46, 222, 47, 0, 2, M.CONCRETE); B.obox(190, 48, 222, 49, 0, 1, M.CONCRETE); B.obox(190, 50, 222, 51, 0, 0, M.CONCRETE);
    B.obox(156, 64, 157, 88, 0, 11, M.CONCRETE); B.obox(98, 62, 99, 84, 0, 11, M.CONCRETE);
    for (const [x, z] of [[66, 64], [78, 64], [66, 76], [78, 76]]) { B.obox(x, z, x + 6, z + 1, 0, 1, M.METAL); B.obox(x - 1, z - 2, x + 7, z - 2, 3, 3, M.DARK); B.obox(x - 1, z - 2, x - 1, z - 2, 0, 2, M.METAL); B.obox(x + 7, z - 2, x + 7, z - 2, 0, 2, M.METAL); }
    B.obox(88, 88, 94, 94, 0, 0, M.FAB_BLUE);
    for (const [x, z] of [[108, 84], [108, 94], [160, 94], [246, 66], [246, 80]]) { B.obox(x, z, x + 7, z + 2, 3, 3, M.METAL); B.obox(x + 1, z + 1, x + 1, z + 1, 0, 2, M.METAL); B.obox(x + 6, z + 1, x + 6, z + 1, 0, 2, M.METAL); B.obox(x, z - 2, x + 7, z - 2, 0, 1, M.METAL); B.obox(x, z + 4, x + 7, z + 4, 0, 1, M.METAL); }
    B.barrier(120, 70, 121, 80); B.barrier(148, 70, 149, 80); B.obox(60, 96, 63, 99, 0, 5, M.CRATE);
    B.lamp(64, 48, 22); B.lamp(246, 48, 22); B.lamp(112, 100, 18); B.lamp(160, 100, 18);
    // outside the wire: car park, delivery yard, motor pool, an outer fence each side
    for (let x = 62; x <= 208; x += 12) B.surf(x, 254, x, 268, M.LINE);
    B.car(66, 256, 'z', M.CAR_W); B.car(102, 256, 'z', M.CAR_R); B.car(162, 256, 'z', M.CAR_K); B.car(198, 256, 'z', M.CAR_W);
    B.truck(4, 156, 'x', M.CAR_W); B.dumpster(22, 170); B.dumpster(8, 140); B.obox(30, 142, 37, 149, 0, 3, M.CRATE);
    B.container(280, 114, 'z', M.CONT_B, true); B.container(292, 148, 'z', M.CONT_R); B.car(276, 150, 'z', M.CAR_K);
    B.drum(190, 180, 5, 0, 12, M.WHITE); B.drum(190, 180, 5, 8, 9, M.RED_PAINT); B.obox(214, 172, 224, 180, 0, 8, M.CORRUGATE); B.obox(215, 173, 223, 180, 0, 7, 0);
    B.car(131, 14, 'z', M.CAR_W);
    B.fence(14, 100, 14, 180, M.FENCE, 9); B.fence(298, 100, 298, 180, M.FENCE, 9); B.fence(84, 274, 186, 274, M.FENCE, 9);
    for (const [x, z] of [[20, 60], [28, 216], [70, 226], [228, 216], [286, 206], [290, 60], [232, 20], [50, 16]]) { B.obox(x, z, x + 1, z + 1, 0, 13, M.BARK); B.line(x, GY + 10, z, x - 4, GY + 16, z + 1, M.BARK); B.line(x + 1, GY + 12, z + 1, x + 5, GY + 18, z, M.BARK); B.line(x, GY + 14, z + 1, x + 1, GY + 20, z + 5, M.BARK); }
    B.lamp(90, 244); B.lamp(180, 244); B.lamp(36, 136); B.lamp(276, 180);
    // cameras
    hub.cam(1, 25, 14, -135, 'ROTUNDA'); cb.cam(1, 2, 22, -100, 'CELL HALL'); cb.cam(3, 101, 32, 90, 'TOP TIER'); cb.cam(0, 2, 27, -90, 'TUNNEL');
    sv.cam(1, 28, 2, -135, 'MESS HALL'); ad.cam(1, 2, 46, -135, 'RECEPTION');
    B.cam(150, 30, 62, 160, -16, 'YARD'); B.box(150, 13, 62, 150, 29, 62, M.PIPE);
    B.cam(112, 26, 244, 20, -14, 'FRONT GATE'); B.box(112, 13, 244, 112, 25, 244, M.PIPE);
    B.spawn('Gate Road', 135, 6, 0); B.spawn('Delivery Yard', 6, 136, -90); B.spawn('Motor Pool', 304, 136, 90); B.spawn('Car Park', 135, 272, 180);
    // the road carries on to the edge of the finished map
    B.meta.afterPad = (B) => { B.surf(gh.x + 12, 0, gh.x + 29, gh.z - 1, M.ASPHALT); };
    B.meta.bombs = [['Armoury', 'Visiting Room'], ["Warden's Office", 'Records'], ['Kitchen', 'Mess Hall'], ['Central Control', 'Radio Room'], ['Generator Room', 'Pump Room'], ['Infirmary', 'Workshop']];
    B.meta.secure = ['Armoury', 'Central Control', 'Evidence Store', 'Boiler Room', 'Laundry'];
    B.meta.hostage = ["Warden's Office", 'Infirmary', 'Solitary', 'Holding Cells', 'Radio Room'];
    B.meta.defSpawns = ['Central Control', 'Mess Hall', 'Evidence Store'];
    return B;
  }
  define({ id: 'ironwood', name: 'IRONWOOD', fn: ironwood, blurb: 'Decommissioned penitentiary · grey, windy day', cover: 'irnwall', tint: 'rgba(110,122,128,0.34)' });
})();
