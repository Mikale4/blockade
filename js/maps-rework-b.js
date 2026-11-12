/* maps-rework-b.js -- three of the original maps rebuilt far larger, each in several joined parts:
     CHECKPOINT   a border complex: customs hall, vehicle inspection shed with pits, detention block,
                  barracks block, watchtower
     HELIX LABS   (below)
     CANNERY      (below)
   Each replaces the map of the same id in maps.js (MAPS.define), keeping its name, setting, spawn
   names and cover kit.

   Directions in the comments: north is -z (the top of a --plan drawing), west is -x. */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, THEMES, define } = MAPS;

  /* ------------------------------------------------------------------ helpers */

  /* a doorway between two joined buildings. It is cut in the wall they share, which is the
     perimeter of both, but it is not a way in from outside */
  function link(b, L, axis, line, a0, n, h) {
    const op = axis === 'z' ? b.doorZ(L, line, a0, n, h) : b.doorX(L, line, a0, n, h);
    op.ext = false; op.nrm = 0;
    return op;
  }
  /* an open flight from L up to L+1, with a rail round the hole it leaves in the floor above */
  function flight(b, L, lx, lz, dir, n) {
    b.stairs(L, lx, lz, dir, n);
    const U = L + 1;
    if (dir === '+z') { b.rail(U, lx - 1, lz - 1, lx - 1, lz + 11); b.rail(U, lx + n, lz - 1, lx + n, lz + 11); b.rail(U, lx - 1, lz - 1, lx + n, lz - 1); }
    else if (dir === '-z') { b.rail(U, lx - 1, lz - 11, lx - 1, lz + 1); b.rail(U, lx + n, lz - 11, lx + n, lz + 1); b.rail(U, lx - 1, lz + 1, lx + n, lz + 1); }
    else if (dir === '+x') { b.rail(U, lx - 1, lz - 1, lx + 11, lz - 1); b.rail(U, lx - 1, lz + n, lx + 11, lz + n); b.rail(U, lx - 1, lz - 1, lx - 1, lz + n); }
    else { b.rail(U, lx - 11, lz - 1, lx + 1, lz - 1); b.rail(U, lx - 11, lz + n, lx + 1, lz + n); b.rail(U, lx + 1, lz - 1, lx + 1, lz + n); }
  }
  /* An enclosed stair core through every level of b, flights alternating between its two halves.
     ax 'z': walls on lx0, lx0+12, lz0 and lz0+23, flights run along z. ax 'x': the same, turned
     (walls on lx0, lx0+23, lz0, lz0+12). The five voxels inside each end are the landings; end
     'a' is the low-coordinate one. `start` is the end the lowest flight climbs away from, so the
     levels are entered at alternate ends: bottom level either, then the other end, then `start`
     again... On the bottom and top levels both landings can be reached. On a level in between
     only one is a landing: the far end would be a sealed pocket, so it is blocked up.
     Doors are not cut here. */
  function core(b, name, lx0, lz0, ax, start, o) {
    o = o || {};
    const zr = ax === 'z';
    for (let L = b.lo; L <= b.hi; L++) {
      if (zr) { b.room(L, name, lx0, lz0, lx0 + 12, lz0 + 23, { wall: o.wall }); b.wallX(L, lx0 + 6, lz0 + 6, lz0 + 17, o.wall); }
      else { b.room(L, name, lx0, lz0, lx0 + 23, lz0 + 12, { wall: o.wall }); b.wallZ(L, lz0 + 6, lx0 + 6, lx0 + 17, o.wall); }
    }
    for (let L = b.lo; L < b.hi; L++) {
      const fwd = ((L - b.lo) % 2 === 0) === (start === 'a'), v = fwd ? 1 : 7, U = L + 1;
      if (zr) b.stairs(L, lx0 + v, lz0 + (fwd ? 6 : 17), fwd ? '+z' : '-z', 5);
      else b.stairs(L, lx0 + (fwd ? 6 : 17), lz0 + v, fwd ? '+x' : '-x', 5);
      // on the level above, the open end of the hole is at the end this flight left from
      const u0 = fwd ? 1 : 18, ur = fwd ? 5 : 18;
      if (U < b.hi) { if (zr) b.box(U, lx0 + 1, lz0 + u0, lx0 + 11, lz0 + u0 + 4, 0, 10, o.fill || M.CONCRETE); else b.box(U, lx0 + u0, lz0 + 1, lx0 + u0 + 4, lz0 + 11, 0, 10, o.fill || M.CONCRETE); }
      else if (zr) b.rail(U, lx0 + v, lz0 + ur, lx0 + v + 4, lz0 + ur);
      else b.rail(U, lx0 + ur, lz0 + v, lx0 + ur, lz0 + v + 4);
    }
  }
  /* a room hollowed out of a level that was filled solid (basements that only run under part of a block) */
  function carve(b, L, name, x0, z0, x1, z1, o) { b.box(L, x0 + 1, z0 + 1, x1 - 1, z1 - 1, 0, 10, 0); return b.room(L, name, x0, z0, x1, z1, o); }
  /* repaint part of a floor slab (only where there is slab) */
  function paint(b, L, x0, z0, x1, z1, m) { b.W.fill(b.X(x0), L * 12, b.Z(z0), b.X(x1), L * 12, b.Z(z1), (x, y, z, cur) => cur ? m : -1); }
  /* Joined buildings share one wall line, and the game asks "is this spot indoors?" of one
     building at a time, so a defender in a doorway of the shared wall would count as outside
     (and defenders may not leave the building during the preparation phase). Called at the very
     end of a map: move building g's recorded edge k voxels across the shared wall into its
     neighbour, so the two interiors overlap in the doorway. Only the bounds change, no voxels.
     side: 'n' = its -z edge, 's' = +z, 'w' = -x, 'e' = +x. */
  function weld(g, side, k) { k = k || 4; if (side === 'w') g.x -= k; else if (side === 'e') g.x1 += k; else if (side === 'n') g.z -= k; else g.z1 += k; }

  const HARD = { hp: 9, pen: 0.4, xp: true, hb: true, wall: true };
  const FLOOR = { hp: 40, pen: 0.45, xp: true, hb: true, floor: true };

  /* =================================================================== CHECKPOINT
     Five joined blocks round an inner yard, the road and its lanes along the north side:
       customs (main)  a double-height public hall under a mezzanine of offices; vault, archive and plant below
       shed            two drive-through lanes over real inspection pits, a gantry overhead, a tunnel to customs
       detention       booking, sally port, cells, interrogation, evidence; isolation cells and infirmary above
       barracks        armoury and mess, dormitory and briefing room, signals floor on top (the only 3F with the tower)
       watchtower      three floors on the south-west corner */
  mat('CHK_BLOCK', 0xb7ab94, Object.assign({ pat: 'block' }, HARD));     // painted blockwork
  mat('CHK_ADOBE', 0xb98f62, Object.assign({ pat: 'noise' }, HARD));     // darker render on the barracks
  mat('CHK_LINO', 0x8f9a8c, Object.assign({ pat: 'checker' }, FLOOR));
  mat('CHK_SLAB', 0x8a8780, Object.assign({ pat: 'block' }, FLOOR));     // a concrete floor that can still be breached

  function checkpoint() {
    const B = new Builder('checkpoint', 'CHECKPOINT', 404, 64, 362);
    B.meta.desc = 'A desert border complex at high noon: a double-height customs hall, a vehicle shed over inspection pits, a detention block, barracks and a watchtower round an inner yard.';
    B.theme(THEMES.desert);
    B.ground(M.SAND);
    const OX = 98, OZ = 98;
    // ---- ground: the road and its lanes, aprons, the inner yard, the truck yard, the river
    B.surf(0, 28, 403, 84, M.ASPHALT);
    for (const z of [45, 66]) for (let x = 0; x < 404; x += 8) B.surf(x, z, x + 4, z, M.LINE);
    B.surf(118, 85, 232, 97, M.DOCK); B.surf(226, 85, 312, 97, M.ASPHALT);
    B.surf(226, 194, 343, 285, M.GRAVEL); B.surf(305, 85, 343, 194, M.GRAVEL);
    B.surf(150, 170, 181, 262, M.CONCRETE);
    B.surf(0, 346, 403, 361, M.WATER); B.surf(0, 340, 403, 345, M.GRAVEL);

    const c = B.building(OX, OZ, 136, 72, { lo: 0, hi: 2, ext: M.STUCCO, inner: M.DRY_WHITE, slab: M.TILE, roof: M.ROOF });
    const d = B.building(OX, OZ + 71, 52, 72, { lo: 1, hi: 2, ext: M.CHK_BLOCK, inner: M.DRY_GREY, slab: M.CHK_LINO, roof: M.ROOF });
    const s = B.building(OX + 135, OZ, 72, 96, { lo: 0, hi: 2, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.CHK_SLAB, roof: M.ROOF, parapet: M.RUST });
    const a = B.building(OX + 84, OZ + 71, 52, 56, { lo: 1, hi: 3, ext: M.CHK_ADOBE, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    const t = B.building(OX, OZ + 142, 24, 24, { lo: 1, hi: 3, ext: M.CHK_BLOCK, inner: M.DRY_GREY, slab: M.CHK_LINO, roof: M.ROOF });

    /* ---------------------------------------------------------------- customs */
    // B: the south-west corner is unexcavated
    c.room(0, 'Records Archive', 0, 0, 42, 40, { wall: M.DRY_GREY });
    c.room(0, 'Plant Room', 94, 0, 135, 40, { wall: M.CONCRETE });
    c.room(0, 'Lower Corridor', 0, 40, 135, 48, { wall: M.DRY_GREY });
    c.room(0, 'Bonded Store', 39, 48, 135, 71, { wall: M.DRY_GREY });
    c.box(0, 1, 49, 26, 70, 0, 10, M.CONC_DARK);
    // 1F
    c.room(1, 'Passport Control', 0, 0, 30, 40, { wall: M.DRY_BEIGE });
    c.room(1, 'Baggage Search', 106, 0, 135, 40, { wall: M.DRY_SAGE });
    c.room(1, 'Service Corridor', 0, 40, 135, 48);
    c.room(1, 'Cashier Office', 0, 48, 27, 71, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    c.room(1, 'Staff Lounge', 39, 48, 90, 71, { wall: M.DRY_SAGE });
    c.room(1, 'Security Office', 90, 48, 135, 71, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    c.room(1, 'Customs Hall', 30, 0, 106, 40, { wall: M.PLASTER });
    // 2F: the hall is open to the roof; a gallery runs round three sides of it and the offices look down through glass
    c.void(2, 39, 1, 97, 31);
    c.room(2, 'Supervisor Office', 0, 0, 30, 20, { wall: M.DRY_BLUE, floor: M.CARPET });
    c.room(2, 'Offices', 0, 20, 30, 40, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    c.room(2, 'Customs Lab', 106, 0, 135, 40, { wall: M.DRY_WHITE });
    c.room(2, 'Upper Corridor', 0, 40, 135, 48);
    c.room(2, 'Records Office', 0, 48, 27, 71, { wall: M.DRY_GREY });
    c.room(2, 'Conference Room', 39, 48, 90, 71, { wall: M.DRY_BEIGE, floor: M.CARPET });
    c.room(2, 'Chief Inspector', 90, 48, 135, 71, { wall: M.DRY_BLUE, floor: M.CARPET });
    c.room(2, 'Mezzanine Gallery', 30, 0, 106, 40, { wall: M.PLASTER });
    core(c, 'West Stairs', 27, 48, 'z', 'b');
    c.room(0, 'Contraband Vault', 42, 0, 94, 40, { wall: M.CONCRETE });   // last: its concrete wins the shared edges
    // the twin stairs from the hall floor to the gallery
    c.stairs(1, 42, 20, '+z', 6); c.stairs(1, 89, 20, '+z', 6);
    c.rail(2, 38, 1, 38, 31); c.rail(2, 98, 1, 98, 31); c.rail(2, 38, 32, 41, 32); c.rail(2, 48, 32, 88, 32); c.rail(2, 95, 32, 98, 32);
    // doors B
    c.doorZ(0, 40, 16); c.doorZ(0, 40, 64, 6); c.doorZ(0, 40, 110); c.doorX(0, 42, 16); c.doorX(0, 94, 16);
    c.doorZ(0, 48, 31, 5); c.doorZ(0, 48, 60); c.doorZ(0, 48, 112); c.doorX(0, 39, 66);
    c.cellar('w', 30);
    // doors 1F
    c.doorZ(1, 0, 46, 8); c.doorZ(1, 0, 82, 8); c.doorZ(1, 0, 12); c.doorZ(1, 0, 120); c.doorX(1, 0, 42); c.doorZ(1, 71, 62, 6);
    c.doorX(1, 30, 8, 5); c.doorX(1, 30, 28, 5); c.doorX(1, 106, 8, 5); c.doorX(1, 106, 28, 5);
    c.doorZ(1, 40, 14); c.doorZ(1, 40, 36, 6); c.doorZ(1, 40, 64, 8); c.doorZ(1, 40, 94, 6); c.doorZ(1, 40, 118);
    c.doorZ(1, 48, 10); c.doorZ(1, 48, 31, 5); c.doorZ(1, 48, 60, 6); c.doorZ(1, 48, 110);
    c.winZ(1, 0, 4, 6); c.winZ(1, 0, 20, 6); c.winZ(1, 0, 34, 8); c.winZ(1, 0, 60, 16); c.winZ(1, 0, 94, 8); c.winZ(1, 0, 110, 6); c.winZ(1, 0, 127, 5);
    c.winX(1, 0, 6, 6); c.winX(1, 0, 22, 6); c.winX(1, 0, 54, 5); c.winX(1, 0, 63, 5);
    c.winZ(1, 71, 54, 6); c.winZ(1, 71, 72, 6);
    // doors 2F
    c.doorX(2, 30, 6); c.doorX(2, 30, 30); c.winX(2, 30, 12, 6); c.winX(2, 30, 23, 5);
    c.doorX(2, 106, 8); c.doorX(2, 106, 28); c.winX(2, 106, 15, 10);
    c.doorZ(2, 20, 12);
    c.doorZ(2, 40, 14); c.doorZ(2, 40, 32, 5); c.doorZ(2, 40, 64, 8); c.doorZ(2, 40, 99, 5); c.doorZ(2, 40, 118);
    c.doorZ(2, 48, 10); c.doorZ(2, 48, 31, 5); c.doorZ(2, 48, 60, 6); c.doorZ(2, 48, 110);
    c.doorX(2, 27, 66); c.doorX(2, 39, 66); c.doorX(2, 90, 58);
    c.winZ(2, 0, 6, 6); c.winZ(2, 0, 18, 6); c.winZ(2, 0, 42, 12); c.winZ(2, 0, 62, 12); c.winZ(2, 0, 82, 12); c.winZ(2, 0, 110, 6); c.winZ(2, 0, 124, 6);
    c.winX(2, 0, 6, 6); c.winX(2, 0, 26, 6); c.winX(2, 0, 42, 4); c.winX(2, 0, 54, 5); c.winX(2, 0, 63, 5);
    c.winZ(2, 71, 54, 6); c.winZ(2, 71, 66, 6); c.winZ(2, 71, 76, 6);
    // (every hatch on this map sits on one of four x lines and four z lines of the world: the stretch
    // leaves the planes through a hatch alone, so scattered hatches would keep the rooms from growing)
    c.hatch(2, 18, 30); c.hatch(2, 60, 60); c.hatch(2, 118, 30); c.hatch(1, 60, 30); c.hatch(1, 118, 60);
    // furniture B
    for (let i = 0; i < 4; i++) c.shelf(0, 6 + i * 8, 6, 7 + i * 8, 26, 9);
    c.table(0, 26, 32, 36, 36);
    c.crates(0, 48, 6, 8); c.box(0, 76, 6, 90, 10, 0, 5, M.CRATE); c.box(0, 50, 28, 58, 34, 0, 2, M.PAPER); c.box(0, 74, 26, 84, 32, 0, 4, M.METAL);
    c.box(0, 46, 20, 47, 26, 0, 6, M.METAL);
    c.box(0, 100, 24, 110, 34, 0, 8, M.BOILER); c.tank(0, 126, 30, 4, 8, M.METAL); c.box(0, 96, 1, 132, 1, 9, 9, M.PIPE); c.box(0, 116, 2, 124, 4, 0, 6, M.METAL);
    c.box(0, 2, 41, 133, 41, 10, 10, M.PIPE); c.box(0, 80, 45, 84, 47, 0, 3, M.CRATE); c.box(0, 20, 45, 24, 47, 0, 3, M.CRATE);
    for (let i = 0; i < 6; i++) c.shelf(0, 46 + i * 14, 56, 52 + i * 14, 57, 8);
    c.crates(0, 44, 62, 4); c.crates(0, 126, 62, 6); c.box(0, 90, 64, 100, 68, 0, 4, M.CRATE);
    // furniture 1F: passport booths across the hall, benches, an enquiry desk, the baggage belt
    for (let i = 0; i < 3; i++) { c.counter(1, 52 + i * 12, 10, 58 + i * 12, 12, M.TRIM); c.box(1, 52 + i * 12, 10, 58 + i * 12, 12, 4, 6, M.GLASS); }
    c.box(1, 32, 6, 33, 16, 0, 1, M.WOOD); c.box(1, 102, 16, 103, 26, 0, 1, M.WOOD); c.counter(1, 62, 32, 74, 35, M.TRIM); c.box(1, 66, 33, 67, 34, 4, 5, M.SCREEN);
    c.box(1, 34, 34, 36, 36, 0, 2, M.POT); c.box(1, 34, 34, 36, 36, 3, 6, M.LEAF); c.box(1, 100, 34, 102, 36, 0, 2, M.POT); c.box(1, 100, 34, 102, 36, 3, 6, M.LEAF);
    c.box(1, 66, 1, 70, 1, 12, 20, M.BLUE_PAINT); c.box(1, 52, 1, 56, 1, 12, 20, M.RED_PAINT); c.box(1, 80, 1, 84, 1, 12, 20, M.RED_PAINT);
    c.desk(1, 6, 6, 14, 10); c.desk(1, 6, 24, 14, 28); c.couch(1, 20, 35, 28, 38, M.FAB_BLUE, 'n'); c.box(1, 22, 2, 28, 3, 0, 7, M.METAL);
    c.table(1, 112, 8, 126, 12, M.METAL); c.table(1, 112, 24, 126, 28, M.METAL); c.box(1, 129, 14, 133, 22, 0, 6, M.METAL); c.crates(1, 108, 31, 4);
    c.box(1, 50, 46, 56, 47, 0, 1, M.WOOD); c.box(1, 76, 46, 79, 47, 0, 7, M.FRIDGE); c.box(1, 124, 41, 127, 42, 0, 7, M.METAL);
    c.counter(1, 6, 56, 20, 58, M.TRIM); c.box(1, 6, 56, 20, 58, 4, 6, M.GLASS); c.box(1, 2, 65, 6, 69, 0, 5, M.METAL); c.desk(1, 16, 63, 24, 67);
    c.couch(1, 44, 65, 56, 69, M.FAB_RED, 'n'); c.table(1, 70, 56, 80, 62); c.counter(1, 72, 67, 80, 69); c.box(1, 86, 50, 88, 51, 0, 7, M.FRIDGE);
    c.counter(1, 128, 52, 131, 66, M.COUNTER); c.box(1, 133, 52, 133, 66, 3, 7, M.SCREEN); c.desk(1, 102, 60, 110, 64); c.box(1, 92, 50, 93, 58, 0, 8, M.METAL);
    // furniture 2F
    c.desk(2, 6, 8, 16, 12); c.shelf(2, 4, 17, 9, 18, 8); c.couch(2, 20, 2, 28, 5, M.FAB_BLUE, 's');
    c.desk(2, 4, 24, 10, 28); c.desk(2, 18, 24, 24, 28); c.desk(2, 4, 33, 10, 37); c.desk(2, 18, 33, 24, 37);
    c.counter(2, 112, 6, 130, 8, M.WHITE); c.counter(2, 112, 18, 126, 20, M.WHITE); c.box(2, 114, 7, 115, 7, 4, 5, M.GLASS); c.box(2, 120, 19, 121, 19, 4, 5, M.GLASS); c.box(2, 130, 32, 133, 37, 0, 7, M.FRIDGE);
    c.box(2, 50, 46, 56, 47, 0, 1, M.WOOD); c.box(2, 78, 41, 80, 42, 0, 7, M.METAL);
    c.shelf(2, 2, 52, 3, 66, 9); c.shelf(2, 7, 58, 8, 68, 9); c.shelf(2, 15, 58, 16, 68, 9); c.desk(2, 18, 51, 24, 55);
    c.table(2, 52, 56, 76, 64, M.TRIM); c.box(2, 41, 50, 41, 60, 3, 7, M.WHITE);
    c.desk(2, 114, 58, 126, 63); c.shelf(2, 132, 50, 133, 62, 8); c.couch(2, 94, 50, 104, 53, M.FAB_RED, 's');
    c.box(2, 31, 12, 32, 20, 0, 1, M.WOOD); c.box(2, 104, 2, 105, 4, 0, 2, M.POT); c.box(2, 104, 2, 105, 4, 3, 6, M.LEAF); c.box(2, 60, 38, 68, 39, 0, 1, M.WOOD) ;

    /* -------------------------------------------------------------- detention */
    d.room(1, 'Booking', 0, 0, 24, 22);
    d.room(1, 'Sally Port', 24, 0, 51, 22, { wall: M.CONCRETE, floor: M.CHK_SLAB });
    d.room(1, 'Cell Corridor', 22, 22, 30, 71);
    d.room(1, 'Interrogation', 30, 22, 51, 46, { wall: M.DRY_GREY });
    d.room(1, 'Evidence Lock-up', 30, 46, 51, 71, { wall: M.CONCRETE });
    d.room(1, 'Detention', 0, 22, 22, 71, { wall: M.CONCRETE });
    d.room(2, 'Interview Room', 0, 0, 24, 22);
    d.room(2, 'Wardens Office', 24, 0, 51, 22, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    d.room(2, 'Upper Cell Corridor', 22, 22, 30, 71);
    d.room(2, 'Infirmary', 30, 22, 51, 71, { wall: M.DRY_WHITE, floor: M.TILE });
    d.room(2, 'Isolation Cells', 0, 22, 22, 71, { wall: M.CONCRETE });
    d.doorX(1, 0, 8); d.doorX(1, 24, 9); d.shutterX(1, 51, 4, 12); d.doorX(1, 51, 17); d.doorZ(1, 22, 15); d.doorZ(1, 22, 24, 5);
    d.doorX(1, 22, 30); d.doorX(1, 22, 62); d.doorX(1, 30, 30); d.doorX(1, 30, 56); d.doorZ(1, 46, 38); d.doorZ(1, 71, 24, 5); d.doorZ(1, 71, 40);
    d.doorX(2, 24, 9); d.doorZ(2, 22, 15); d.doorZ(2, 22, 24, 5); d.doorX(2, 22, 30); d.doorX(2, 22, 62); d.doorX(2, 30, 30); d.doorX(2, 30, 56);
    d.winX(1, 0, 14, 4); d.winX(1, 0, 28, 3); d.winX(1, 0, 40, 3); d.winX(1, 0, 52, 3); d.winX(1, 0, 64, 3); d.winX(1, 51, 36, 4);
    d.winX(2, 0, 6, 5); d.winX(2, 0, 28, 3); d.winX(2, 0, 40, 3); d.winX(2, 0, 52, 3); d.winX(2, 0, 64, 3);
    d.winX(2, 51, 6, 6); d.winX(2, 51, 30, 6); d.winX(2, 51, 52, 6); d.winZ(2, 71, 36, 6); d.winZ(2, 71, 44, 4);
    d.hatch(2, 34, 40);
    // the cells: bar partitions off the west wall, a barred front with a gap for each door
    for (const L of [1, 2]) for (const z0 of [23, 35, 47, 59]) {
      if (z0 < 59) d.box(L, 1, z0 + 11, 12, z0 + 11, 0, 9, M.RAIL);
      d.box(L, 13, z0, 13, z0 + 6, 0, 9, M.RAIL); if (z0 < 59) d.box(L, 13, z0 + 11, 13, z0 + 11, 0, 9, M.RAIL);
      d.bed(L, 2, z0 + 1, 5, z0 + 6, M.FAB_BLUE);
    }
    d.counter(1, 6, 10, 18, 12, M.COUNTER); d.box(1, 1, 15, 1, 20, 0, 9, M.WHITE); d.box(1, 16, 19, 22, 20, 0, 1, M.WOOD);
    B.car(d.X(30), d.Z(6), 'x', M.CAR_W); d.box(1, 26, 18, 32, 20, 0, 3, M.CRATE);
    d.box(1, 23, 40, 24, 50, 0, 1, M.WOOD);
    d.table(1, 38, 30, 44, 34, M.METAL); d.box(1, 40, 27, 41, 28, 0, 1, M.DARK); d.box(1, 40, 36, 41, 37, 0, 1, M.DARK); d.box(1, 47, 24, 49, 28, 0, 5, M.METAL); d.box(1, 41, 32, 41, 32, 4, 4, M.LAMP);
    d.shelf(1, 48, 48, 49, 68, 9); d.shelf(1, 40, 52, 41, 64, 9); d.crates(1, 32, 62, 2); d.box(1, 32, 48, 36, 50, 0, 4, M.METAL);
    d.table(2, 8, 8, 16, 12); d.box(2, 2, 2, 6, 3, 0, 7, M.METAL); d.couch(2, 14, 17, 22, 20, M.FAB_BLUE, 'n');
    d.desk(2, 36, 10, 46, 14); d.shelf(2, 49, 14, 50, 20, 8); d.box(2, 40, 2, 48, 3, 0, 7, M.METAL);
    d.bed(2, 44, 26, 49, 32); d.bed(2, 44, 36, 49, 42); d.bed(2, 44, 60, 49, 66); d.box(2, 32, 66, 40, 69, 0, 7, M.WHITE); d.counter(2, 36, 48, 44, 50, M.WHITE);
    d.box(2, 23, 40, 24, 50, 0, 1, M.WOOD);

    /* ------------------------------------------------------------- watchtower */
    t.room(1, 'Tower Guardroom', 0, 0, 23, 23); t.room(2, 'Tower Landing', 0, 0, 23, 23); t.room(3, 'Watchtower', 0, 0, 23, 23);
    flight(t, 1, 1, 6, '+z', 5); flight(t, 2, 18, 17, '-z', 5);
    t.doorZ(1, 23, 10); t.doorX(1, 0, 19); t.doorX(1, 23, 10);
    t.winZ(1, 23, 3, 5); t.winX(1, 23, 3, 5); t.winZ(2, 23, 4, 6); t.winZ(2, 23, 14, 6); t.winX(2, 0, 2, 3); t.winX(2, 23, 2, 3);
    t.winZ(3, 0, 6, 12); t.winZ(3, 23, 3, 8); t.winZ(3, 23, 13, 8); t.winX(3, 0, 3, 8); t.winX(3, 0, 13, 8); t.winX(3, 23, 1, 4); t.winX(3, 23, 19, 4);
    t.desk(1, 8, 10, 14, 14); t.box(1, 20, 16, 22, 21, 0, 8, M.METAL);
    t.crates(2, 9, 9, 4); t.box(2, 8, 20, 14, 22, 0, 3, M.SANDBAG);
    t.box(3, 2, 20, 12, 21, 0, 3, M.SANDBAG); t.table(3, 8, 9, 12, 13, M.METAL); t.box(3, 2, 2, 3, 3, 0, 4, M.METAL); t.box(3, 2, 2, 3, 3, 5, 6, M.LAMP);
    // a searchlight mast and a flag on the tower roof
    B.box(t.X(11), t.roofY + 1, t.Z(11), t.X(12), t.roofY + 8, t.Z(12), M.PIPE); B.box(t.X(10), t.roofY + 9, t.Z(10), t.X(13), t.roofY + 11, t.Z(13), M.LAMP);

    /* --------------------------------------------------------------- barracks */
    a.room(1, 'Admin Lobby', 0, 0, 22, 24); a.room(1, 'Armory', 22, 0, 51, 24, { wall: M.DRY_BLUE, floor: M.CHK_SLAB });
    a.room(1, 'Barracks Hall', 0, 24, 51, 32); a.room(1, 'Break Room', 0, 32, 39, 55, { wall: M.DRY_SAGE, floor: M.TILE });
    a.room(2, 'Barracks Landing', 0, 0, 22, 24); a.room(2, 'Briefing Room', 22, 0, 51, 24, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    a.room(2, 'Dormitory Hall', 0, 24, 51, 32); a.room(2, 'Dormitory', 0, 32, 20, 55, { wall: M.DRY_SAGE }); a.room(2, 'Locker Room', 20, 32, 39, 55, { wall: M.DRY_GREY, floor: M.TILE });
    a.room(3, 'Signals Landing', 0, 0, 22, 24); a.room(3, 'Comms Room', 22, 0, 51, 24, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    a.room(3, 'Signals Hall', 0, 24, 51, 32); a.room(3, 'Commander Quarters', 0, 32, 39, 55, { wall: M.DRY_BLUE, floor: M.CARPET });
    core(a, 'Barracks Stairs', 39, 32, 'z', 'b');
    flight(a, 1, 15, 17, '-z', 5); flight(a, 2, 3, 6, '+z', 5);
    a.doorX(1, 0, 10); a.doorX(1, 0, 26); a.doorX(1, 51, 26); a.doorZ(1, 55, 16);
    a.doorZ(1, 24, 6, 5); a.doorZ(1, 24, 34); a.doorX(1, 22, 3); a.doorZ(1, 32, 12, 5); a.doorZ(1, 32, 43, 5); a.doorX(1, 39, 50);
    a.doorZ(2, 24, 9, 5); a.doorX(2, 22, 1); a.doorZ(2, 24, 34); a.doorZ(2, 32, 8); a.doorZ(2, 32, 28); a.doorZ(2, 32, 43, 5); a.doorX(2, 20, 42);
    a.doorZ(3, 24, 9, 5); a.doorX(3, 22, 14); a.doorZ(3, 24, 34); a.doorZ(3, 32, 14, 5); a.doorZ(3, 32, 43, 5); a.doorX(3, 39, 50);
    a.winX(1, 0, 16, 5); a.winX(1, 0, 36, 5); a.winX(1, 0, 46, 5); a.winZ(1, 55, 4, 6); a.winZ(1, 55, 26, 6);
    a.winX(2, 0, 20, 3); a.winX(2, 0, 26, 4); a.winX(2, 0, 36, 5); a.winX(2, 0, 46, 5); a.winZ(2, 55, 6, 6); a.winZ(2, 55, 26, 6); a.winX(2, 51, 26, 4);
    a.winX(3, 0, 20, 3); a.winX(3, 0, 26, 4); a.winX(3, 0, 36, 5); a.winX(3, 0, 46, 5); a.winZ(3, 55, 6, 6); a.winZ(3, 55, 24, 6); a.winX(3, 51, 26, 4);
    a.winZ(3, 0, 30, 10); a.winZ(3, 0, 44, 5); a.winX(3, 51, 6, 10);
    a.hatch(2, 32, 6); a.hatch(3, 40, 6); a.hatch(2, 8, 43); a.hatch(3, 12, 40);
    a.box(1, 2, 20, 8, 21, 0, 1, M.WOOD); a.box(1, 2, 2, 3, 5, 0, 2, M.POT); a.box(1, 2, 2, 3, 5, 3, 6, M.LEAF);
    a.box(1, 26, 2, 48, 3, 0, 8, M.METAL); a.table(1, 30, 12, 40, 16, M.METAL); a.crates(1, 42, 14, 4); a.box(1, 24, 18, 27, 22, 0, 4, M.CRATE);
    a.box(1, 24, 30, 30, 31, 0, 1, M.WOOD);
    a.table(1, 6, 38, 16, 42); a.table(1, 24, 38, 34, 42); a.table(1, 6, 47, 14, 51); a.counter(1, 22, 51, 33, 53); a.box(1, 2, 52, 4, 54, 0, 7, M.FRIDGE);
    a.box(2, 1, 20, 5, 22, 0, 3, M.CRATE);
    a.table(2, 30, 12, 44, 16, M.TRIM); a.box(2, 26, 1, 40, 1, 3, 7, M.WHITE); a.box(2, 46, 2, 49, 5, 0, 5, M.METAL);
    a.bed(2, 2, 34, 7, 40); a.bed(2, 2, 47, 7, 53); a.bed(2, 13, 47, 18, 53); a.box(2, 14, 34, 18, 35, 0, 7, M.METAL);
    a.box(2, 22, 53, 36, 54, 0, 8, M.METAL); a.box(2, 26, 43, 34, 44, 0, 1, M.WOOD); a.box(2, 36, 34, 38, 40, 0, 8, M.METAL);
    a.box(3, 14, 2, 20, 4, 0, 3, M.CRATE);
    a.rack(3, 26, 4, 28, 18); a.rack(3, 32, 4, 34, 18); a.desk(3, 40, 14, 48, 18); a.box(3, 38, 22, 46, 23, 3, 7, M.SCREEN);
    a.bed(3, 2, 46, 8, 53); a.desk(3, 24, 44, 34, 48); a.couch(3, 4, 34, 10, 37, M.FAB_RED, 's'); a.shelf(3, 28, 53, 35, 54, 8);
    // aerials on the barracks roof
    B.box(a.X(36), a.roofY + 1, a.Z(12), a.X(36), a.roofY + 14, a.Z(12), M.PIPE); B.box(a.X(30), a.roofY + 1, a.Z(8), a.X(33), a.roofY + 3, a.Z(11), M.WHITE);

    /* ------------------------------------------------------------------- shed */
    // B: only the two pits and the tunnel that joins them to the customs plant room are dug out
    s.box(0, 1, 1, 70, 94, 0, 10, M.CONC_DARK);
    carve(s, 0, 'Pit Tunnel', 0, 0, 50, 20, { wall: M.CONCRETE });
    carve(s, 0, 'West Pit', 8, 20, 17, 64, { wall: M.CONCRETE });
    carve(s, 0, 'East Pit', 31, 20, 40, 64, { wall: M.CONCRETE });
    s.doorZ(0, 20, 9, 8); s.doorZ(0, 20, 32, 8);
    s.room(1, 'Parts Store', 50, 0, 71, 48, { wall: M.CORRUGATE });
    s.room(1, 'Dispatch Office', 50, 48, 71, 95, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    s.room(1, 'Inspection Shed', 0, 0, 50, 95, { wall: M.CORRUGATE });
    // the pits: a slot in the shed floor over each trench, steps up out of its south end
    s.void(1, 9, 22, 16, 51); s.void(1, 32, 22, 39, 51);
    s.stairs(0, 9, 52, '+z', 8); s.stairs(0, 32, 52, '+z', 8);
    for (const x of [8, 17, 31, 40]) paint(s, 1, x, 21, x, 64, M.LINE);
    for (const x of [8, 31]) { paint(s, 1, x, 21, x + 9, 21, M.LINE); }
    // 2F: the shed is open to its roof; a gantry runs down the west wall and across the middle
    s.void(2, 9, 1, 49, 43); s.void(2, 9, 52, 49, 94);
    s.room(2, 'Control Booth', 50, 0, 71, 52, { wall: M.PANEL_DARK });
    s.room(2, 'Drivers Lounge', 50, 52, 71, 95, { wall: M.DRY_SAGE });
    s.room(2, 'Gantry Catwalk', 0, 0, 50, 95, { wall: M.CORRUGATE });
    s.stairs(1, 44, 63, '-z', 6);
    s.rail(2, 8, 1, 8, 43); s.rail(2, 8, 52, 8, 94); s.rail(2, 9, 44, 49, 44); s.rail(2, 9, 51, 43, 51);
    s.doorZ(1, 0, 6, 14, 10); s.shutterZ(1, 0, 29, 14); s.shutterZ(1, 95, 6, 14); s.doorZ(1, 95, 29, 14, 10);
    s.doorX(1, 50, 20); s.doorX(1, 50, 86); s.doorZ(1, 48, 58); s.doorX(1, 71, 24); s.doorX(1, 71, 76); s.doorZ(1, 0, 54); s.doorZ(1, 95, 58);
    s.doorX(2, 50, 46); s.doorZ(2, 52, 58); s.winX(2, 50, 8, 10); s.winX(2, 50, 28, 10); s.winX(2, 50, 62, 8); s.winX(2, 50, 80, 8);
    s.winZ(1, 0, 22, 5); s.winZ(1, 0, 64, 5); s.winZ(1, 95, 22, 5); s.winZ(1, 95, 46, 3); s.winZ(1, 95, 64, 5);
    s.winX(1, 71, 8, 6); s.winX(1, 71, 36, 6); s.winX(1, 71, 56, 6); s.winX(1, 71, 86, 6);
    s.winZ(2, 0, 4, 8); s.winZ(2, 0, 18, 8); s.winZ(2, 0, 32, 8); s.winZ(2, 0, 54, 6); s.winZ(2, 0, 63, 6);
    s.winZ(2, 95, 4, 8); s.winZ(2, 95, 18, 8); s.winZ(2, 95, 32, 8); s.winZ(2, 95, 56, 6);
    s.winX(2, 71, 10, 6); s.winX(2, 71, 30, 6); s.winX(2, 71, 60, 6); s.winX(2, 71, 80, 6);
    s.hatch(2, 58, 30); s.hatch(2, 60, 70);
    // a car over the west pit, its wheels on the floor either side; a truck over the east one
    B.car(s.X(9), s.Z(26), 'z', M.CAR_R); B.truck(s.X(31), s.Z(18), 'z', M.CAR_W);
    s.box(1, 1, 60, 3, 70, 0, 5, M.RED_PAINT); s.counter(1, 21, 40, 27, 43, M.METAL); s.box(1, 20, 30, 23, 33, 0, 4, M.TIRE); s.tank(1, 23, 72, 2, 5, M.BLUE_PAINT); s.tank(1, 22, 80, 2, 5, M.BLUE_PAINT);
    s.box(1, 2, 86, 6, 92, 0, 4, M.CRATE); s.box(1, 44, 6, 48, 12, 0, 6, M.METAL); s.box(1, 24, 8, 25, 9, 0, 2, M.LINE); s.box(1, 24, 60, 25, 61, 0, 2, M.LINE);
    s.shelf(1, 60, 6, 61, 18, 9); s.shelf(1, 66, 6, 67, 18, 9); s.crates(1, 62, 36, 6); s.box(1, 52, 40, 56, 46, 0, 4, M.TIRE);
    s.desk(1, 56, 56, 64, 60); s.desk(1, 56, 80, 64, 84); s.counter(1, 52, 64, 54, 76); s.shelf(1, 68, 50, 69, 62, 8);
    s.counter(2, 52, 8, 54, 36, M.COUNTER); s.box(2, 52, 10, 52, 34, 4, 5, M.SCREEN); s.rack(2, 66, 4, 68, 20); s.desk(2, 60, 42, 68, 46);
    s.couch(2, 54, 90, 64, 93, M.FAB_BLUE, 'n'); s.table(2, 54, 60, 60, 64); s.bed(2, 64, 76, 69, 82); s.box(2, 66, 54, 69, 58, 0, 7, M.FRIDGE);
    s.box(2, 2, 88, 6, 92, 0, 3, M.CRATE); s.box(2, 2, 4, 6, 8, 0, 3, M.CRATE);
    s.box(0, 2, 2, 48, 2, 9, 9, M.PIPE); s.crates(0, 40, 6, 4); s.box(0, 22, 2, 28, 4, 0, 3, M.METAL); s.box(0, 9, 24, 10, 25, 0, 3, M.RED_PAINT); s.box(0, 38, 24, 39, 25, 0, 3, M.RED_PAINT);

    /* ------------------------------------------------- doors between the blocks */
    link(c, 0, 'x', 135, 10, 5);                                   // plant room -> pit tunnel
    link(c, 1, 'x', 135, 42); link(c, 2, 'x', 135, 42);            // corridors -> shed floor and gantry
    link(c, 1, 'z', 71, 10); link(c, 2, 'z', 71, 10);              // cashier -> booking, records -> interview room
    link(c, 2, 'z', 71, 31, 5);                                    // west stairs -> wardens office
    link(c, 1, 'z', 71, 96); link(c, 2, 'z', 71, 100);             // security -> barracks lobby, chief inspector -> landing
    link(a, 2, 'x', 51, 10);                                       // briefing room -> gantry
    link(d, 1, 'z', 71, 15); link(d, 2, 'z', 71, 15);              // cells -> watchtower

    c.cam(1, 32, 2, -135, 'CUSTOMS HALL'); c.cam(2, 104, 38, 45, 'MEZZANINE'); c.cam(0, 2, 44, -90, 'LOWER CORRIDOR');
    s.cam(1, 48, 2, 135, 'INSPECTION SHED'); a.cam(1, 2, 28, -90, 'BARRACKS'); d.cam(1, 26, 69, 0, 'CELL BLOCK');

    /* ---------------------------------------------------------------- outside */
    // the lanes: two islands with booths under a steel canopy, booms, queued traffic
    B.obox(128, 42, 212, 48, 0, 0, M.CONCRETE); B.obox(128, 63, 212, 69, 0, 0, M.CONCRETE);
    for (const z of [42, 63]) for (const x of [146, 190]) {
      B.obox(x, z, x + 6, z + 6, 1, 9, M.STUCCO); B.obox(x + 1, z + 1, x + 5, z + 5, 1, 8, 0);
      B.obox(x, z, x + 6, z + 6, 5, 7, (xx, y, zz, cur) => cur ? M.GLASS : -1); B.obox(x + 2, z, x + 4, z, 1, 7, 0);
    }
    for (const x of [112, 168, 223]) for (const z of [42, 78]) B.obox(x, z, x + 1, z + 1, 0, 15, M.CONCRETE);
    B.obox(110, 42, 226, 80, 16, 17, M.METAL); B.obox(110, 42, 226, 42, 14, 15, M.STUCCO); B.obox(110, 80, 226, 80, 14, 15, M.STUCCO);
    B.obox(160, 28, 160, 41, 4, 4, M.RED_PAINT); B.obox(160, 32, 160, 34, 4, 4, M.WHITE); B.obox(160, 38, 160, 40, 4, 4, M.WHITE); B.obox(160, 42, 161, 43, 1, 5, M.METAL);
    B.obox(160, 62, 160, 62, 1, 14, M.RED_PAINT); B.obox(160, 62, 160, 62, 6, 8, M.WHITE); B.obox(160, 69, 160, 69, 1, 14, M.RED_PAINT); B.obox(160, 69, 160, 69, 6, 8, M.WHITE);
    B.car(118, 31, 'x', M.CAR_W); B.car(176, 52, 'x', M.CAR_R); B.truck(232, 72, 'x', M.CAR_K); B.car(84, 73, 'x', M.CAR_K); B.car(270, 32, 'x', M.CAR_W); B.car(60, 52, 'x', M.CAR_R);
    B.barrier(100, 86, 116, 87); B.barrier(234, 26, 250, 27); B.barrier(70, 26, 86, 27);
    B.obox(126, 91, 126, 91, 0, 36, M.PIPE); B.obox(127, 91, 135, 91, 29, 35, M.BLUE_PAINT); B.obox(127, 91, 135, 91, 32, 32, M.WHITE);
    // the inner yard: secondary inspection, kennels against the lounge wall, a fence and gate across its mouth
    B.car(156, 196, 'z', M.CAR_K); B.obox(170, 200, 176, 204, 0, 3, M.METAL); B.obox(171, 201, 175, 203, 4, 4, M.CRATE);
    B.obox(152, 172, 157, 176, 0, 5, M.FENCE); B.obox(153, 173, 156, 176, 0, 4, 0); B.obox(174, 172, 179, 176, 0, 5, M.FENCE); B.obox(175, 173, 178, 176, 0, 4, 0);
    for (const [x, z] of [[160, 222], [172, 222], [166, 186]]) B.obox(x, z, x, z, 0, 2, M.LAMP_R);
    B.fence(150, 242, 181, 242, M.FENCE, 8); B.sandbags(152, 250, 162, 252); B.sandbags(170, 256, 180, 258);
    // the truck yard: containers, a trailer, a fuel tank on a bund; the perimeter fence
    B.container(318, 206, 'z', M.CONT_B, true); B.container(250, 264, 'x', M.CONT_R); B.container(280, 264, 'x', M.CONT_G, true); B.container(318, 100, 'z', M.CONT_R);
    B.truck(244, 222, 'x', M.CAR_W); B.dumpster(300, 250);
    B.obox(312, 150, 326, 164, 0, 1, M.CONCRETE); B.drum(319, 157, 5, 2, 12, M.WHITE); B.drum(319, 157, 5, 7, 8, M.RED_PAINT);
    B.obox(238, 236, 245, 243, 0, 3, M.CRATE); B.obox(284, 204, 291, 211, 0, 7, M.CRATE);
    B.fence(62, 90, 62, 286, M.FENCE, 8); B.fence(62, 286, 344, 286, M.FENCE, 8); B.fence(344, 90, 344, 286, M.FENCE, 8);
    // the dry wash and the riverbank
    for (const [x, z, r] of [[36, 120, 5], [26, 196, 6], [44, 250, 4], [120, 316, 5], [226, 322, 6], [330, 310, 4], [376, 240, 5]]) B.rock(x, z, r);
    for (const [x, z] of [[20, 150], [48, 176], [82, 300], [200, 330], [300, 326], [374, 120], [384, 300]]) { B.obox(x, z, x + 1, z + 1, 0, 8, M.LEAF); B.obox(x - 2, z, x - 1, z + 1, 3, 3, M.LEAF); B.obox(x - 2, z, x - 2, z + 1, 4, 6, M.LEAF); B.obox(x + 2, z, x + 3, z + 1, 4, 4, M.LEAF); B.obox(x + 3, z, x + 3, z + 1, 5, 7, M.LEAF); }
    for (let x = 6; x < 400; x += 22) B.obox(x, 344, x + 1, 345, 0, 2 + (x % 3), M.LEAF);
    B.lamp(120, 92); B.lamp(228, 92); B.lamp(146, 252); B.lamp(310, 198); B.lamp(92, 200);
    B.cam(166, 27, 88, 0, -14, 'LANES'); B.box(166, 13, 88, 166, 25, 88, M.PIPE);
    B.cam(322, 27, 190, 90, -14, 'TRUCK YARD'); B.box(322, 13, 190, 322, 25, 190, M.PIPE);

    B.spawn('Vehicle Lanes', OX + 68, 16, 0); B.spawn('Truck Yard', 392, OZ + 36, 90); B.spawn('Riverbank', OX + 68, 336, 180); B.spawn('Dry Wash', 10, OZ + 36, -90);
    B.meta.bombs = [['Detention', 'Interrogation'], ['Armory', 'Break Room'], ['Supervisor Office', 'Offices'], ['Briefing Room', 'Locker Room'], ['Contraband Vault', 'Records Archive'], ['Comms Room', 'Commander Quarters']];
    B.meta.secure = ['Contraband Vault', 'Evidence Lock-up', 'Armory', 'Comms Room', 'Customs Lab'];
    B.meta.hostage = ['Detention', 'Infirmary', 'Offices', 'Locker Room', 'Dispatch Office'];
    B.meta.defSpawns = ['Armory', 'Evidence Lock-up', 'Offices'];
    weld(d, 'n'); weld(a, 'n'); weld(s, 'w'); weld(t, 'n');
    return B;
  }
  define({ id: 'checkpoint', name: 'CHECKPOINT', fn: checkpoint, blurb: 'Border inspection complex · noon', cover: 'cabin', tint: 'rgba(201,180,138,0.38)' });
})();
