/* maps-new-b.js -- three maps:
     FREIGHTER  a cargo ship moored in the wet dock of a container port (overcast day)
     MONASTERY  a stone mountain monastery built round a cloister (late afternoon)
     METRO      a city underground interchange: street hall, mezzanine, platforms and trains (night)
   Every place, name and layout here is original to BLOCKADE. */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, COVER, WING, define } = MAPS;
  const GY = 12, FL = ['B', '1F', '2F', '3F'];

  /* ------------------------------------------------------------------ shared helpers */
  /* a railing on any slab: y is the slab's voxel height (GY for the ground) */
  function orail(B, x0, z0, x1, z1, y) {
    y = y == null ? GY : y;
    B.w.fill(x0, y + 1, z0, x1, y + 3, z1, (x, yy, z, c) => c ? -1 : (yy === y + 3 || (x + z) % 4 === 0 ? M.RAIL : -1));
  }
  /* An enclosed 12-wide switchback stair joining levels lo..hi of building b. It runs along `axis`
     ('x' or 'z') for `len` voxels (26 or more) from (x0, z0); `flip` turns it end for end.
     Across it (u): lane A is u 1..5, the divider u 6, lane B u 7..11. Along it (v): the low landing
     is v 1..6, the flights v 7..18, the high landing v 19..len-1.
     Odd flights (1->2) climb +v in lane A, even flights (0->1, 2->3) climb -v in lane B, so:
       level 0 and the top level reach both landings; level 1 (over a basement) only the low
       landing; level 2 (under a level 3) only the high landing. The unreachable landing of a
       middle level is walled up unless the level is listed in o.keep. Doors are the caller's. */
  function well(b, x0, z0, axis, len, lo, hi, o) {
    o = o || {};
    const keep = o.keep || [], wm = o.wall || b.inner;
    const P = (u, v) => { const t = o.flip ? len - v : v; return axis === 'z' ? [x0 + u, z0 + t] : [x0 + t, z0 + u]; };
    const span = (u0, v0, u1, v1) => { const p = P(u0, v0), q = P(u1, v1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
    const up = (o.flip ? '-' : '+') + axis, dn = (o.flip ? '+' : '-') + axis;
    const rail = (L, u0, v0, u1, v1) => { const s = span(u0, v0, u1, v1); b.rail(L, s[0], s[1], s[2], s[3]); };
    const block = (L, u0, v0, u1, v1) => { const s = span(u0, v0, u1, v1); b.box(L, s[0], s[1], s[2], s[3], 0, 10, wm); };
    const rooms = [], rs = span(0, 0, 12, len);
    for (let L = lo; L <= hi; L++) rooms.push(b.room(L, (o.name || 'Stairs') + ' ' + FL[L], rs[0], rs[1], rs[2], rs[3], { wall: wm, floor: o.floor && o.floor[L] }));
    for (let L = lo; L < hi; L++) {
      if (L % 2) { const p = P(1, 7); b.stairs(L, p[0], p[1], up, 5); }
      else { const p = P(7, 18); b.stairs(L, p[0], p[1], dn, 5); }
    }
    for (let L = lo; L <= hi; L++) {
      const hole = L > lo ? ((L - 1) % 2 ? 'A' : 'B') : '';
      if (L < hi || hole) rail(L, 6, 7, 6, 18);
      if (hole === 'B') { if (L === hi || keep.includes(L)) rail(L, 7, 19, 11, 19); else block(L, 1, 19, 11, len - 1); }
      if (hole === 'A') { if (L === hi || keep.includes(L)) rail(L, 1, 6, 5, 6); else block(L, 1, 1, 11, 6); }
    }
    return rooms;
  }

  /* ====================================================================== FREIGHTER */
  mat('FRT_HULL', 0x27323c, { pat: 'plates' });
  mat('FRT_KEEL', 0x8c3229, { pat: 'plates' });
  mat('FRT_PLATE', 0x5c6267, { pat: 'checker' });
  mat('FRT_DECK', 0x5a6e62, { hp: 40, pen: 0.3, xp: true, hb: true, pat: 'plates', floor: true });
  mat('FRT_STEEL', 0xd8d5ca, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'plates', wall: true });
  mat('FRT_ORANGE', 0xdc6a20, {});

  // spawn cover: containers stacked two high
  COVER.frt_stack = b => {
    b(-24, -1, 10, 19, 0, 9, M.CONT_B); b(0, 23, 10, 19, 0, 9, M.CONT_R);
    b(-24, -1, 10, 19, 10, 19, M.CONT_G); b(0, 23, 10, 19, 10, 19, M.CONT_B);
    b(-24, 23, 10, 10, 9, 10, M.DARK); b(-24, 23, 19, 19, 9, 10, M.DARK);
    b(-20, -17, 6, 9, 0, 3, M.CRATE); b(14, 17, 6, 9, 0, 3, M.CRATE);
  };
  WING.frt_stack = [M.CONT_B, M.CONT_B];

  function freighter() {
    const B = new Builder('freighter', 'FREIGHTER', 344, 64, 264);
    B.meta.desc = 'A coastal freighter moored in the wet dock of a container port: cargo holds and the engine room below, deckhouses, container stacks and a three-storey bridge above, a customs house and a warehouse on the quay. Overcast day.';
    B.theme({ sky: [0x747e88, 0xc2c7ca], fog: 0xacb3b7, fogFar: 125, lightOut: [0.9, 0.93, 0.97], lightIn: [0.66, 0.63, 0.58], sun: 0xe8edf0, outer: 0x2a4450, water: true });
    B.ground(M.DOCK);
    const HX = 64, HZ = 60, hx = x => HX + x, hz = z => HZ + z;
    const PL = M.FRT_PLATE, DK = M.FRT_DECK, ST = M.FRT_STEEL;
    // ---- the wet dock: a concrete basin, the water five voxels below the quay (out of reach of a step)
    B.box(41, 1, 15, 286, GY, 130, M.DOCK);
    B.box(42, 8, 16, 285, GY, 129, 0);
    B.box(42, 1, 16, 285, 7, 129, M.WATER);
    B.surf(41, 130, 286, 130, M.LINE); B.surf(41, 15, 286, 15, M.LINE); B.surf(41, 15, 41, 130, M.LINE); B.surf(286, 15, 286, 130, M.LINE);
    B.surf(0, 212, 343, 240, M.ASPHALT); B.surf(0, 225, 343, 226, M.LINE);
    B.surf(46, 133, 300, 133, M.RAIL); B.surf(46, 156, 300, 156, M.RAIL);

    // ---- the hull: the main building is its below-deck level; its roof is the main deck
    const hull = B.building(HX, HZ, 216, 64, { lo: 0, hi: 0, ext: M.FRT_HULL, inner: M.DRY_GREY, roof: DK, parapet: M.FRT_HULL });
    B.w.fill(HX, 0, HZ, HX + 215, 11, HZ + 63, (x, y, z, c) => c === M.CONC_DARK ? (y <= 8 ? M.FRT_KEEL : M.FRT_HULL) : -1);
    const bulw = (x0, z0, x1, z1) => B.box(x0, 13, z0, x1, 16, z1, M.FRT_HULL), gap = (x0, z0, x1, z1) => B.box(x0, 13, z0, x1, 16, z1, 0);
    bulw(HX, HZ, HX + 215, HZ); bulw(HX, HZ + 63, HX + 215, HZ + 63); bulw(HX, HZ, HX, HZ + 63); bulw(HX + 215, HZ, HX + 215, HZ + 63);
    // the bow: a tapering prow deck ahead of the forecastle
    for (let i = 1; i <= 16; i++) {
      const x = HX - i, t = Math.round(i * 1.6), t2 = Math.round((i + 1) * 1.6), z0 = HZ + t, z1 = HZ + 63 - t;
      B.box(x, 1, z0, x, 8, z1, M.FRT_KEEL); B.box(x, 9, z0, x, 11, z1, M.FRT_HULL); B.box(x, GY, z0, x, GY, z1, DK);
      if (i === 16) bulw(x, z0, x, z1); else { bulw(x, z0, x, HZ + t2); bulw(x, HZ + 63 - t2, x, z1); }
    }
    gap(HX, HZ + 2, HX, HZ + 7); gap(HX, HZ + 56, HX, HZ + 61);
    // deckhouses standing on the main deck: forecastle, hold casing, bridge superstructure
    const fc = B.building(hx(0), hz(8), 33, 48, { lo: 1, hi: 1, ext: ST, inner: M.DRY_GREY, slab: DK, roof: DK, parapet: ST });
    const cas = B.building(hx(80), hz(8), 56, 48, { lo: 1, hi: 1, ext: ST, inner: M.DRY_GREY, slab: DK, roof: M.RUST, parapet: ST });
    const sup = B.building(hx(142), hz(8), 60, 48, { lo: 1, hi: 3, ext: ST, inner: M.DRY_WHITE, slab: M.LAB_FLOOR, roof: DK, parapet: ST });

    // ---- below decks (hull-local coordinates)
    const soft = { wall: M.DRY_GREY, floor: PL }, rib = { wall: M.CORRUGATE, floor: PL };
    hull.room(0, 'Chain Locker', 0, 0, 32, 30, soft);
    hull.room(0, 'Bosun Store', 0, 30, 32, 63, soft);
    hull.room(0, 'Port Passage', 32, 0, 136, 10, soft);
    hull.room(0, 'Starboard Passage', 32, 54, 136, 63, soft);
    hull.room(0, 'Generator Room', 136, 0, 174, 18, soft);
    hull.room(0, 'Workshop', 136, 46, 174, 63, soft);
    hull.room(0, 'Control Room', 174, 0, 198, 19, { wall: M.PANEL_DARK, floor: PL });
    hull.room(0, 'Pump Room', 174, 45, 198, 63, soft);
    hull.room(0, 'Lower Alleyway', 186, 19, 198, 45, soft);
    hull.room(0, 'Steering Gear', 198, 0, 215, 32, soft);
    hull.room(0, 'Provision Store', 198, 32, 215, 63, { wall: M.DRY_WHITE, floor: PL });
    hull.room(0, 'Forward Hold', 32, 10, 80, 54, rib);
    hull.room(0, 'Main Hold', 80, 10, 136, 54, rib);
    hull.room(0, 'Engine Room', 136, 18, 174, 46, rib);

    // ---- forecastle (1F)
    fc.room(1, 'Windlass Room', 0, 0, 32, 22, { wall: M.DRY_GREY });
    fc.room(1, 'Focsle Stairs', 0, 22, 14, 47, { wall: M.DRY_GREY });
    fc.room(1, 'Paint Locker', 14, 22, 32, 47, { wall: M.DRY_GREY });
    // ---- hold casing (1F): catwalks round the main hold, which is open from its floor to the hatch covers
    cas.room(1, 'Port Catwalk', 0, 0, 55, 8, { skip: 'n' });
    cas.room(1, 'Starboard Catwalk', 0, 39, 55, 47, { skip: 's' });
    cas.room(1, 'Fore Catwalk', 0, 8, 8, 39, { skip: 'nse' });
    cas.room(1, 'Aft Catwalk', 47, 8, 55, 39, { skip: 'nsw' });
    cas.void(1, 9, 9, 46, 38);
    // ---- superstructure 1F: mess, galley, offices
    sup.room(1, 'Crew Mess', 0, 0, 24, 26, { wall: M.DRY_SAGE, floor: M.TILE });
    sup.room(1, 'Galley', 0, 26, 24, 47, { wall: M.DRY_WHITE, floor: M.TILE });
    sup.room(1, 'Cross Alleyway', 24, 0, 32, 47, { wall: M.DRY_WHITE });
    sup.room(1, 'Laundry', 32, 0, 44, 11, { wall: M.DRY_BLUE, floor: M.TILE });
    sup.room(1, 'Dry Store', 32, 37, 44, 47, { wall: M.DRY_GREY });
    sup.room(1, "Ship's Office", 44, 0, 59, 24, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    sup.room(1, 'Changing Room', 44, 24, 59, 47, { wall: M.DRY_BLUE, floor: M.TILE });
    // ---- superstructure 2F: crew quarters
    sup.room(2, 'Cabin 1', 0, 0, 12, 20, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    sup.room(2, 'Cabin 2', 12, 0, 24, 20, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    sup.room(2, 'Cabin 3', 12, 28, 24, 47, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    sup.room(2, 'Bridge Stairs', 0, 28, 12, 47, { wall: M.DRY_GREY });
    sup.room(2, 'Cabin Corridor', 0, 20, 24, 28, { wall: M.DRY_BEIGE });
    sup.room(2, 'Upper Alleyway', 24, 0, 32, 47, { wall: M.DRY_WHITE });
    sup.room(2, 'Linen Store', 32, 0, 44, 11, { wall: M.DRY_GREY });
    sup.room(2, 'Showers', 32, 37, 44, 47, { wall: M.DRY_BLUE, floor: M.TILE });
    sup.room(2, 'Officers Lounge', 44, 0, 59, 24, { wall: M.DRY_RED, floor: M.CARPET });
    sup.room(2, 'Sick Bay', 44, 24, 59, 47, { wall: M.DRY_WHITE, floor: M.TILE });
    // ---- superstructure 3F: the bridge
    sup.room(3, 'Chart Room', 32, 0, 44, 11, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    sup.room(3, 'Signal Locker', 32, 37, 44, 47, { wall: M.DRY_GREY });
    sup.room(3, "Captain's Cabin", 44, 0, 59, 24, { wall: M.DRY_RED, floor: M.CARPET });
    sup.room(3, 'Radio Room', 44, 24, 59, 47, { wall: M.DRY_GREY, floor: M.CARPET2 });
    sup.room(3, 'Bridge', 0, 0, 32, 47, { wall: M.PANEL_DARK, floor: M.CARPET2 });
    well(sup, 32, 11, 'z', 26, 0, 3, { name: 'Aft Stairs', wall: M.DRY_GREY, floor: [PL] });

    // ---- stairs between the hold level and the deck
    hull.stairs(0, 4, 52, '-z', 5);                                   // forecastle
    fc.rail(1, 3, 33, 3, 45); fc.rail(1, 9, 33, 9, 45); fc.rail(1, 3, 45, 9, 45);
    hull.stairs(0, 92, 28, '-z', 5); hull.stairs(0, 119, 35, '+z', 5);   // main hold floor to the catwalks
    cas.rail(1, 8, 8, 47, 8); cas.rail(1, 8, 39, 47, 39); cas.rail(1, 8, 8, 8, 39); cas.rail(1, 47, 8, 47, 39);
    cas.box(1, 12, 8, 16, 8, 0, 2, 0); cas.box(1, 39, 39, 43, 39, 0, 2, 0);
    hull.stairs(0, 70, 28, '+z', 5);                                  // fore-deck companionway, under a steel hood
    B.box(hx(69), 13, hz(27), hx(69), 23, hz(39), ST); B.box(hx(75), 13, hz(27), hx(75), 23, hz(39), ST); B.box(hx(69), 13, hz(27), hx(75), 23, hz(27), ST);
    B.box(hx(69), 23, hz(27), hx(75), 23, hz(39), ST);
    hull.stairs(0, 209, 8, '+z', 4);                                  // aft companionway on the poop deck
    B.box(hx(208), 13, hz(7), hx(208), 23, hz(19), ST); B.box(hx(213), 13, hz(7), hx(213), 23, hz(19), ST); B.box(hx(208), 13, hz(7), hx(213), 23, hz(7), ST);
    B.box(hx(208), 23, hz(7), hx(213), 23, hz(19), ST);
    sup.stairs(2, 3, 42, '-z', 5);                                    // cabin deck up into the bridge
    sup.rail(3, 2, 31, 2, 43); sup.rail(3, 8, 31, 8, 43); sup.rail(3, 2, 43, 8, 43);
    // outside stairs up the after face: poop deck -> boat-deck landing -> bridge-deck gallery
    sup.stairs(1, 60, 40, '-z', 5);
    B.box(sup.X(60), 24, sup.Z(16), sup.X(66), 24, sup.Z(28), DK); B.box(sup.X(60), 24, sup.Z(6), sup.X(64), 24, sup.Z(15), DK);
    sup.stairs(2, 60, 17, '-z', 5);
    sup.rail(2, 66, 16, 66, 28); sup.rail(2, 65, 16, 66, 16); sup.rail(2, 65, 28, 66, 28);
    B.box(sup.X(60), 36, sup.Z(-8), sup.X(66), 36, sup.Z(5), DK); B.box(sup.X(14), 36, sup.Z(-8), sup.X(59), 36, sup.Z(-1), DK);   // gallery along the north face to the bridge wing
    sup.rail(3, 14, -8, 66, -8); sup.rail(3, 14, -8, 14, -1); sup.rail(3, 66, -8, 66, 5); sup.rail(3, 65, 5, 66, 5);
    B.box(sup.X(14), 36, sup.Z(48), sup.X(30), 36, sup.Z(55), DK);                                                              // south bridge wing
    sup.rail(3, 14, 55, 30, 55); sup.rail(3, 14, 48, 14, 55); sup.rail(3, 30, 48, 30, 55);

    // ---- doors below decks
    hull.doorZ(0, 30, 20); hull.doorX(0, 32, 3); hull.doorX(0, 32, 18); hull.doorX(0, 32, 34); hull.doorX(0, 32, 57);
    hull.doorZ(0, 10, 52); hull.doorZ(0, 10, 100); hull.doorZ(0, 10, 126); hull.doorZ(0, 54, 66); hull.doorZ(0, 54, 128);
    hull.doorX(0, 80, 20, 6); hull.doorX(0, 80, 40, 6);
    hull.doorX(0, 136, 3); hull.doorX(0, 136, 57); hull.doorX(0, 136, 30, 5);
    hull.doorZ(0, 18, 138); hull.doorZ(0, 46, 158); hull.doorX(0, 174, 8); hull.doorX(0, 174, 52);
    hull.doorZ(0, 19, 190); hull.doorZ(0, 45, 190); hull.doorX(0, 198, 24); hull.doorX(0, 198, 38); hull.doorZ(0, 32, 203);
    sup.doorX(0, 32, 13); sup.doorX(0, 32, 31); sup.doorX(0, 44, 13); sup.doorX(0, 44, 31);
    // ---- forecastle and casing doors, portholes
    fc.doorX(1, 0, 9); fc.doorX(1, 32, 9); fc.doorX(1, 32, 33); fc.doorZ(1, 22, 5); fc.doorX(1, 14, 25);
    fc.winZ(1, 0, 6, 5); fc.winZ(1, 0, 20, 5); fc.winZ(1, 47, 4, 4); fc.winZ(1, 47, 20, 6); fc.winX(1, 0, 30, 5); fc.winX(1, 32, 18, 3);
    cas.doorX(1, 0, 12, 5); cas.doorX(1, 0, 31, 5); cas.doorX(1, 55, 22, 5); cas.doorZ(1, 0, 26, 5); cas.doorZ(1, 47, 26, 5);
    cas.winZ(1, 0, 8, 6); cas.winZ(1, 0, 40, 6); cas.winZ(1, 47, 8, 6); cas.winZ(1, 47, 40, 6); cas.winX(1, 0, 21, 6); cas.winX(1, 55, 8, 5); cas.winX(1, 55, 34, 5);
    // ---- superstructure doors
    sup.doorX(1, 0, 10); sup.doorX(1, 0, 34); sup.doorZ(1, 0, 26); sup.doorZ(1, 47, 26); sup.doorX(1, 59, 8); sup.doorX(1, 59, 42);
    sup.doorX(1, 24, 6); sup.doorZ(1, 26, 9, 6); sup.doorX(1, 24, 36); sup.doorX(1, 32, 4); sup.doorX(1, 32, 40); sup.doorX(1, 32, 13); sup.doorX(1, 44, 13);
    sup.doorZ(1, 24, 50); sup.doorX(1, 44, 4); sup.doorX(1, 44, 40);
    sup.doorZ(2, 20, 4); sup.doorZ(2, 20, 16); sup.doorZ(2, 28, 16); sup.doorZ(2, 28, 8); sup.doorX(2, 24, 21, 6);
    sup.doorX(2, 32, 4); sup.doorX(2, 32, 40); sup.doorX(2, 32, 31); sup.doorX(2, 44, 31); sup.doorZ(2, 24, 50); sup.doorX(2, 44, 4); sup.doorX(2, 44, 40); sup.doorX(2, 59, 20);
    sup.doorX(3, 32, 13); sup.doorX(3, 32, 31); sup.doorX(3, 44, 13); sup.doorX(3, 44, 31); sup.doorX(3, 32, 4); sup.doorX(3, 32, 40); sup.doorX(3, 44, 4); sup.doorZ(3, 24, 50);
    sup.doorZ(3, 0, 20); sup.doorX(3, 59, 1);
    const wing = sup.doorZ(3, 47, 20); wing.ext = false; wing.nrm = 0;   // the south wing is a lookout, not a way in
    // ---- superstructure windows
    sup.winX(1, 0, 18, 5); sup.winX(1, 0, 41, 5); sup.winZ(1, 0, 6, 6); sup.winZ(1, 0, 16, 5); sup.winZ(1, 0, 35, 5); sup.winZ(1, 0, 48, 6);
    sup.winZ(1, 47, 6, 6); sup.winZ(1, 47, 16, 5); sup.winZ(1, 47, 35, 5); sup.winZ(1, 47, 48, 6); sup.winX(1, 59, 16, 5);
    sup.winX(2, 0, 6, 6); sup.winX(2, 0, 21, 6); sup.winX(2, 0, 34, 5); sup.winZ(2, 0, 4, 5); sup.winZ(2, 0, 16, 5); sup.winZ(2, 0, 26, 4); sup.winZ(2, 0, 36, 5); sup.winZ(2, 0, 48, 6);
    sup.winZ(2, 47, 4, 5); sup.winZ(2, 47, 16, 5); sup.winZ(2, 47, 26, 4); sup.winZ(2, 47, 36, 5); sup.winZ(2, 47, 48, 6); sup.winX(2, 59, 6, 6); sup.winX(2, 59, 38, 6);
    sup.winX(3, 0, 3, 12); sup.winX(3, 0, 18, 12); sup.winX(3, 0, 33, 12); sup.winZ(3, 0, 4, 12); sup.winZ(3, 0, 26, 4); sup.winZ(3, 0, 35, 6); sup.winZ(3, 0, 48, 6);
    sup.winZ(3, 47, 4, 12); sup.winZ(3, 47, 26, 4); sup.winZ(3, 47, 35, 6); sup.winZ(3, 47, 48, 6); sup.winX(3, 59, 10, 6); sup.winX(3, 59, 32, 8);
    // ---- hatches: fore deck -> forward hold, casing roof -> catwalks, and down through the accommodation
    // (hatches sit in three rows across the ship, so the stretch has fewer planes to leave alone)
    cas.hatch(2, 30, 2); cas.hatch(2, 30, 42);
    sup.hatch(1, 8, 21); sup.hatch(2, 8, 2); sup.hatch(2, 50, 42); sup.hatch(3, 20, 21); sup.hatch(3, 50, 2);
    // the hatch covers are slid half open over the main hold
    B.box(cas.X(18), 24, cas.Z(14), cas.X(37), 24, cas.Z(33), 0);

    // ---- furniture below decks
    hull.box(0, 4, 4, 12, 12, 0, 3, M.RAIL); hull.box(0, 6, 6, 10, 10, 4, 5, M.RAIL); hull.box(0, 4, 18, 10, 24, 0, 2, M.RAIL); hull.box(0, 8, 8, 8, 8, 6, 10, M.PIPE); hull.crates(0, 18, 8, 5);
    hull.shelf(0, 12, 61, 28, 62, 7); hull.shelf(0, 10, 31, 16, 32, 7); hull.tank(0, 24, 48, 3, 1, M.SANDBAG); hull.tank(0, 16, 44, 2, 2, M.SANDBAG); hull.tank(0, 29, 45, 1, 3, M.RED_PAINT); hull.tank(0, 29, 50, 1, 3, M.BLUE_PAINT);
    hull.box(0, 33, 1, 135, 1, 9, 10, M.PIPE); hull.box(0, 66, 6, 72, 8, 0, 3, M.CRATE); hull.box(0, 112, 1, 118, 3, 0, 4, M.METAL); hull.box(0, 86, 7, 89, 9, 0, 5, M.RED_PAINT);
    hull.box(0, 33, 62, 135, 62, 9, 10, M.PIPE); hull.box(0, 44, 55, 50, 57, 0, 3, M.CRATE); hull.box(0, 78, 60, 84, 62, 0, 4, M.METAL); hull.box(0, 116, 55, 121, 57, 0, 3, M.CRATE);
    hull.box(0, 40, 16, 63, 25, 0, 8, M.CONT_B); hull.box(0, 38, 41, 61, 50, 0, 8, M.CONT_R); hull.box(0, 66, 14, 71, 19, 0, 3, M.CRATE); hull.crates(0, 70, 46, 4); hull.box(0, 34, 26, 37, 31, 0, 2, M.SANDBAG);
    hull.box(0, 102, 18, 125, 27, 0, 8, M.CONT_G); hull.box(0, 102, 18, 125, 27, 9, 17, M.CONT_R); hull.box(0, 88, 42, 111, 51, 0, 8, M.CONT_B);
    hull.crates(0, 82, 12, 6); hull.box(0, 126, 38, 133, 45, 0, 5, M.CRATE); hull.box(0, 84, 30, 87, 35, 0, 3, M.CRATE);
    hull.box(0, 144, 23, 166, 28, 0, 6, M.BOILER); hull.box(0, 146, 25, 164, 26, 7, 8, M.METAL); hull.box(0, 144, 36, 166, 41, 0, 6, M.BOILER); hull.box(0, 146, 38, 164, 39, 7, 8, M.METAL);
    hull.box(0, 168, 24, 169, 25, 0, 10, M.PIPE); hull.box(0, 168, 38, 169, 39, 0, 10, M.PIPE); hull.box(0, 137, 21, 137, 27, 3, 7, M.SCREEN);
    hull.box(0, 141, 9, 147, 13, 0, 5, M.METAL); hull.box(0, 158, 9, 168, 13, 0, 5, M.METAL); hull.rack(0, 152, 1, 166, 2);
    hull.table(0, 140, 48, 152, 51, M.METAL); hull.box(0, 144, 58, 154, 61, 0, 4, M.METAL); hull.shelf(0, 162, 61, 172, 62, 7); hull.tank(0, 168, 51, 2, 4, M.BLUE_PAINT);
    hull.counter(0, 178, 2, 194, 4, M.PANEL_DARK); hull.box(0, 179, 2, 193, 2, 4, 6, M.SCREEN); hull.desk(0, 179, 12, 186, 15); hull.rack(0, 195, 7, 196, 14);
    hull.tank(0, 181, 58, 3, 6, M.METAL); hull.tank(0, 192, 57, 3, 6, M.METAL); hull.box(0, 177, 46, 184, 48, 0, 3, M.BLUE_PAINT); hull.box(0, 181, 49, 181, 54, 8, 9, M.PIPE);
    hull.box(0, 187, 29, 188, 35, 0, 4, M.RED_PAINT);
    hull.box(0, 200, 12, 204, 18, 0, 4, M.METAL); hull.box(0, 201, 14, 203, 16, 5, 6, M.PIPE); hull.box(0, 200, 2, 204, 5, 0, 2, M.CRATE);
    hull.shelf(0, 200, 60, 213, 61, 7); hull.shelf(0, 212, 36, 213, 50, 7); hull.box(0, 200, 54, 203, 59, 0, 7, M.FRIDGE); hull.crates(0, 204, 52, 4);
    // ---- furniture: forecastle and catwalks
    fc.box(1, 10, 2, 16, 6, 0, 4, M.METAL); fc.box(1, 11, 3, 15, 5, 5, 5, M.RAIL); fc.box(1, 10, 15, 16, 19, 0, 4, M.METAL); fc.box(1, 11, 16, 15, 18, 5, 5, M.RAIL); fc.box(1, 20, 3, 28, 4, 0, 1, M.RAIL); fc.box(1, 22, 16, 27, 20, 0, 2, M.SANDBAG);
    fc.shelf(1, 16, 45, 30, 46, 7); fc.tank(1, 20, 39, 1, 3, M.BLUE_PAINT); fc.tank(1, 24, 41, 1, 3, M.RED_PAINT); fc.box(1, 26, 24, 30, 27, 0, 3, M.CRATE);
    cas.box(1, 1, 22, 3, 25, 0, 3, M.CRATE); cas.box(1, 52, 14, 54, 17, 0, 3, M.CRATE); cas.box(1, 40, 1, 44, 3, 0, 3, M.CRATE); cas.box(1, 10, 44, 14, 46, 0, 3, M.CRATE);
    // ---- furniture: superstructure
    sup.table(1, 14, 2, 20, 5); sup.table(1, 2, 15, 6, 19); sup.table(1, 15, 14, 21, 18); sup.couch(1, 1, 23, 5, 24, M.FAB_BLUE, 'w'); sup.counter(1, 1, 2, 2, 6, M.TRIM);
    sup.counter(1, 1, 27, 6, 29); sup.counter(1, 17, 27, 23, 29); sup.counter(1, 6, 35, 17, 37, M.METAL); sup.box(1, 20, 44, 22, 46, 0, 7, M.FRIDGE); sup.box(1, 1, 44, 8, 46, 0, 3, M.METAL);
    sup.box(1, 34, 1, 42, 2, 0, 4, M.WHITE); sup.shelf(1, 34, 45, 42, 46, 7); sup.box(1, 25, 21, 25, 24, 0, 3, M.RED_PAINT);
    sup.desk(1, 50, 2, 56, 5); sup.shelf(1, 57, 14, 58, 22, 7); sup.box(1, 45, 19, 47, 22, 0, 4, M.METAL);
    sup.box(1, 45, 26, 46, 36, 0, 7, M.METAL); sup.box(1, 54, 28, 57, 29, 0, 1, M.WOOD); sup.box(1, 57, 32, 58, 38, 0, 7, M.METAL);
    sup.bed(2, 1, 8, 4, 16, M.FAB_BLUE); sup.desk(2, 9, 11, 11, 16); sup.bed(2, 13, 1, 21, 4, M.FAB_RED); sup.box(2, 22, 8, 23, 14, 0, 7, M.METAL);
    sup.bed(2, 13, 43, 21, 46, M.FAB_BLUE); sup.desk(2, 21, 31, 23, 37); sup.shelf(2, 34, 1, 42, 2, 7);
    sup.box(2, 36, 44, 37, 46, 0, 8, M.WHITE); sup.box(2, 41, 44, 42, 46, 0, 8, M.WHITE); sup.box(2, 33, 38, 34, 39, 0, 3, M.WHITE);
    sup.couch(2, 46, 9, 48, 18, M.FAB_RED, 'w'); sup.table(2, 54, 14, 57, 17); sup.shelf(2, 55, 1, 58, 2, 6);
    sup.bed(2, 54, 26, 58, 29); sup.bed(2, 54, 41, 58, 44); sup.box(2, 45, 36, 46, 38, 0, 6, M.WHITE);
    sup.counter(3, 2, 4, 4, 28, M.PANEL_DARK); sup.box(3, 2, 6, 2, 26, 4, 5, M.SCREEN); sup.box(3, 8, 15, 9, 17, 0, 4, M.TRIM); sup.box(3, 10, 16, 10, 16, 3, 5, M.BRASS);
    sup.table(3, 14, 36, 22, 41); sup.box(3, 12, 26, 14, 28, 0, 3, M.FAB_BLUE); sup.box(3, 26, 44, 30, 45, 0, 7, M.METAL);
    sup.shelf(3, 34, 1, 42, 2, 5); sup.table(3, 35, 8, 41, 10); sup.shelf(3, 34, 45, 42, 46, 7);
    sup.bed(3, 54, 16, 58, 22, M.FAB_RED); sup.desk(3, 45, 18, 48, 22); sup.couch(3, 51, 6, 57, 8, M.FAB_RED, 'n');
    sup.rack(3, 46, 45, 56, 46); sup.desk(3, 53, 34, 57, 37); sup.box(3, 57, 26, 58, 30, 0, 6, M.METAL);

    // ---- the open deck: container stacks, deck crane, winches
    B.container(hx(36), hz(5), 'x', M.CONT_R); B.container(hx(36), hz(15), 'x', M.CONT_B, true); B.obox(hx(36), hz(5), hx(59), hz(14), 10, 19, M.CONT_G);
    B.container(hx(40), hz(38), 'x', M.CONT_G, true); B.container(hx(40), hz(48), 'x', M.CONT_R); B.obox(hx(40), hz(48), hx(63), hz(57), 10, 19, M.CONT_B);
    B.surf(hx(42), hz(27), hx(62), hz(36), M.RUST); hull.hatch(1, 44, 29); hull.hatch(1, 56, 29);
    B.obox(hx(65), hz(6), hx(68), hz(9), 0, 24, M.LINE); B.line(hx(66), 38, hz(8), hx(50), 44, hz(30), M.LINE); B.obox(hx(64), hz(5), hx(69), hz(10), 0, 1, M.DARK);
    B.obox(hx(66), hz(48), hx(71), hz(52), 0, 3, M.METAL); B.obox(hx(67), hz(49), hx(70), hz(51), 4, 4, M.RAIL); B.obox(hx(76), hz(58), hx(78), hz(60), 0, 2, M.DARK);
    B.obox(HX - 9, HZ + 26, HX - 5, HZ + 30, 0, 3, M.METAL); B.obox(HX - 9, HZ + 34, HX - 5, HZ + 38, 0, 3, M.METAL); B.obox(HX - 12, HZ + 31, HX - 12, HZ + 32, 0, 12, M.PIPE);
    B.obox(hx(137), hz(42), hx(138), hz(46), 0, 3, M.CRATE);
    // funnel, mast and radar on the bridge roof; lifeboats on the boat deck
    B.box(sup.X(38), 49, sup.Z(18), sup.X(50), 58, sup.Z(30), M.BLUE_PAINT); B.box(sup.X(38), 55, sup.Z(18), sup.X(50), 56, sup.Z(30), M.WHITE); B.box(sup.X(40), 49, sup.Z(20), sup.X(48), 59, sup.Z(28), M.DARK);
    B.box(sup.X(10), 49, sup.Z(23), sup.X(11), 60, sup.Z(24), M.WHITE); B.box(sup.X(7), 57, sup.Z(23), sup.X(14), 57, sup.Z(24), M.WHITE); B.box(sup.X(9), 61, sup.Z(21), sup.X(12), 61, sup.Z(26), M.DARK);
    B.box(sup.X(20), 49, sup.Z(4), sup.X(34), 52, sup.Z(9), M.FRT_ORANGE); B.box(sup.X(20), 49, sup.Z(38), sup.X(34), 52, sup.Z(43), M.FRT_ORANGE);

    // ---- gangways: three from the quay, one at the stem, a ramp at the stern, a plank from the bunker barge
    const gangway = (x0, x1) => {
      B.box(x0, GY, 124, x1, GY, 129, PL); orail(B, x0, 124, x0, 129); orail(B, x1, 124, x1, 129); gap(x0 + 1, HZ + 63, x1 - 1, HZ + 63);
    };
    const canopy = (x0, x1) => { B.obox(x0, 124, x1, 159, 10, 10, M.CORRUGATE); for (const z of [124, 129, 138, 148, 158]) { B.obox(x0, z, x0, z, 0, 9, M.PIPE); B.obox(x1, z, x1, z, 0, 9, M.PIPE); } };
    gangway(hx(36), hx(45)); canopy(hx(36), hx(45)); gangway(hx(100), hx(111)); gangway(hx(164), hx(173)); canopy(hx(164), hx(173));
    B.box(42, GY, 88, 47, GY, 95, PL); orail(B, 42, 88, 47, 88); orail(B, 42, 95, 47, 95); gap(HX - 16, 89, HX - 16, 94);
    B.box(280, GY, hz(28), 285, GY, hz(35), PL); orail(B, 280, hz(28), 285, hz(28)); orail(B, 280, hz(35), 285, hz(35)); gap(HX + 215, hz(29), HX + 215, hz(34));
    // the bunker barge on the seaward side, reached by a timber jetty from the far quay
    B.box(hx(96), 1, 36, hx(143), 8, 57, M.FRT_KEEL); B.box(hx(96), 9, 36, hx(143), 11, 57, M.RUST); B.box(hx(96), GY, 36, hx(143), GY, 57, DK);
    B.box(hx(96), 13, 36, hx(143), 14, 36, M.RUST); B.box(hx(96), 13, 57, hx(143), 14, 57, M.RUST); B.box(hx(96), 13, 36, hx(96), 14, 57, M.RUST); B.box(hx(143), 13, 36, hx(143), 14, 57, M.RUST);
    B.box(hx(124), 13, 36, hx(131), 14, 36, 0); B.box(hx(114), 13, 57, hx(119), 14, 57, 0);
    B.box(hx(114), GY, 58, hx(119), GY, 59, PL); gap(hx(114), HZ, hx(119), HZ);
    B.box(hx(124), GY, 16, hx(131), GY, 35, M.STAIR); orail(B, hx(124), 16, hx(124), 35); orail(B, hx(131), 16, hx(131), 35);
    for (const z of [18, 26, 34]) { B.box(hx(124), 1, z, hx(124), 11, z, M.BARK); B.box(hx(131), 1, z, hx(131), 11, z, M.BARK); }
    B.drum(hx(104), 46, 4, 0, 5, M.WHITE); B.drum(hx(104), 46, 4, 3, 3, M.RED_PAINT); B.obox(hx(134), 40, hx(141), 47, 0, 8, ST); B.obox(hx(134), 43, hx(134), 45, 4, 6, M.GLASS); B.obox(hx(110), 50, hx(122), 50, 1, 1, M.PIPE); B.obox(hx(136), 51, hx(139), 54, 0, 2, M.CRATE);

    // ---- the customs house on the quay
    const cus = B.building(72, 160, 76, 44, { lo: 1, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    cus.room(1, 'Customs Hall', 0, 0, 40, 43, { wall: M.DRY_BEIGE, floor: M.TILE });
    cus.room(1, 'Inspection Bay', 40, 0, 75, 22, { wall: M.DRY_GREY, floor: M.CONCRETE });
    cus.room(1, 'Interview Room', 40, 22, 58, 43, { wall: M.DRY_BLUE, floor: M.CARPET2 });
    cus.room(1, 'Holding Cell', 58, 22, 75, 43, { wall: M.BRICK, floor: M.CONCRETE });
    cus.room(2, 'Port Office', 0, 0, 40, 26, { wall: M.DRY_SAGE, floor: M.CARPET2 });
    cus.room(2, 'Records Room', 0, 26, 40, 43, { wall: M.DRY_BEIGE });
    cus.room(2, 'Harbour Master', 40, 0, 75, 22, { wall: M.PANEL_DARK, floor: M.CARPET });
    cus.room(2, 'Break Room', 40, 22, 75, 43, { wall: M.DRY_SAGE, floor: M.TILE });
    cus.stairs(1, 1, 8, '+z', 5); cus.rail(2, 6, 7, 6, 19); cus.rail(2, 1, 7, 5, 7);
    cus.doorZ(1, 0, 30, 6); cus.shutterZ(1, 0, 46, 10); cus.doorZ(1, 43, 16, 6); cus.doorX(1, 0, 30); cus.doorX(1, 75, 8); cus.doorZ(1, 43, 46);
    cus.doorX(1, 40, 8); cus.doorX(1, 40, 30); cus.doorZ(1, 22, 50); cus.doorX(1, 58, 30);
    cus.doorZ(2, 26, 20); cus.doorX(2, 40, 8); cus.doorX(2, 40, 32); cus.doorZ(2, 22, 60);
    cus.winZ(1, 0, 6, 6); cus.winZ(1, 0, 18, 6); cus.winZ(1, 0, 62, 6); cus.winZ(1, 43, 4, 6); cus.winZ(1, 43, 28, 6); cus.winZ(1, 43, 64, 4); cus.winX(1, 0, 22, 5); cus.winX(1, 0, 37, 4); cus.winX(1, 75, 15, 5); cus.winX(1, 75, 30, 4);
    cus.winZ(2, 0, 8, 6); cus.winZ(2, 0, 20, 6); cus.winZ(2, 0, 32, 6); cus.winZ(2, 0, 46, 6); cus.winZ(2, 0, 60, 6); cus.winZ(2, 43, 6, 6); cus.winZ(2, 43, 22, 6); cus.winZ(2, 43, 46, 6); cus.winZ(2, 43, 62, 6);
    cus.winX(2, 0, 21, 4); cus.winX(2, 0, 32, 6); cus.winX(2, 75, 6, 6); cus.winX(2, 75, 30, 6);
    cus.hatch(2, 54, 8);
    cus.counter(1, 10, 27, 28, 29, M.TRIM); cus.box(1, 24, 8, 34, 12, 0, 4, M.METAL); cus.box(1, 26, 9, 32, 11, 1, 3, M.DARK); cus.box(1, 10, 36, 16, 37, 0, 1, M.WOOD); cus.box(1, 28, 36, 34, 37, 0, 1, M.WOOD); cus.box(1, 37, 14, 38, 22, 0, 6, M.BLUE_PAINT);
    cus.table(1, 60, 3, 70, 6, M.METAL); cus.crates(1, 62, 13, 6); cus.box(1, 42, 15, 47, 19, 0, 3, M.CRATE);
    cus.table(1, 46, 36, 52, 39); cus.box(1, 44, 37, 44, 38, 0, 2, M.TRIM); cus.box(1, 54, 37, 54, 38, 0, 2, M.TRIM); cus.shelf(1, 41, 41, 45, 42, 6);
    cus.box(1, 60, 40, 72, 42, 0, 1, M.METAL); cus.box(1, 72, 24, 74, 28, 0, 3, M.WHITE);
    cus.desk(2, 12, 3, 18, 6); cus.desk(2, 24, 3, 30, 6); cus.table(2, 14, 14, 24, 18); cus.shelf(2, 34, 22, 38, 24, 7); cus.box(2, 37, 2, 38, 6, 0, 6, M.METAL);
    cus.shelf(2, 4, 30, 5, 40, 8); cus.shelf(2, 10, 30, 11, 40, 8); cus.shelf(2, 28, 34, 29, 41, 8); cus.shelf(2, 34, 34, 35, 41, 8); cus.table(2, 15, 36, 21, 40);
    cus.desk(2, 62, 3, 70, 7); cus.couch(2, 42, 14, 44, 20, M.FAB_BLUE, 'w'); cus.box(2, 72, 16, 74, 19, 0, 5, M.METAL); cus.box(2, 48, 1, 58, 1, 3, 8, M.PAPER);
    cus.table(2, 46, 30, 52, 34); cus.table(2, 46, 38, 52, 41); cus.counter(2, 64, 40, 74, 42); cus.box(2, 72, 34, 74, 37, 0, 7, M.FRIDGE);
    // ---- the warehouse
    const wh = B.building(186, 160, 80, 44, { lo: 1, hi: 2, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.RUST });
    wh.room(1, 'Warehouse Floor', 0, 0, 54, 43, { wall: M.DRY_GREY, floor: M.CONCRETE });
    wh.room(1, 'Bonded Store', 54, 0, 79, 22, { wall: M.BRICK, floor: M.CONCRETE });
    wh.room(1, 'Forklift Bay', 54, 22, 79, 43, { wall: M.DRY_GREY, floor: M.CONCRETE });
    wh.void(2, 1, 1, 41, 42);
    wh.room(2, 'Warehouse Gallery', 42, 0, 54, 43, { skip: 'w' });
    wh.room(2, 'Shipping Office', 54, 0, 79, 22, { wall: M.DRY_BEIGE, floor: M.CARPET2 });
    wh.room(2, 'Tally Room', 54, 22, 79, 43, { wall: M.DRY_GREY });
    wh.stairs(1, 30, 37, '+x', 5); wh.rail(2, 42, 1, 42, 36); wh.rail(2, 42, 42, 42, 42);
    wh.doorZ(1, 0, 44, 6); wh.shutterZ(1, 0, 10, 14); wh.shutterZ(1, 43, 8, 14); wh.doorZ(1, 43, 62); wh.doorX(1, 0, 20, 5); wh.doorX(1, 79, 8);
    wh.doorX(1, 54, 8, 5); wh.doorX(1, 54, 30, 6); wh.doorZ(1, 22, 64);
    wh.doorX(2, 54, 8); wh.doorX(2, 54, 30); wh.doorZ(2, 22, 64);
    wh.winZ(1, 0, 30, 6); wh.winZ(1, 0, 62, 6); wh.winZ(1, 43, 28, 6); wh.winZ(1, 43, 70, 5); wh.winX(1, 0, 6, 6); wh.winX(1, 0, 32, 6); wh.winX(1, 79, 30, 6);
    wh.winZ(2, 0, 6, 8); wh.winZ(2, 0, 22, 8); wh.winZ(2, 0, 44, 6); wh.winZ(2, 0, 60, 6); wh.winZ(2, 0, 70, 5); wh.winZ(2, 43, 6, 8); wh.winZ(2, 43, 22, 8); wh.winZ(2, 43, 44, 6); wh.winZ(2, 43, 60, 6); wh.winZ(2, 43, 70, 5);
    wh.winX(2, 0, 8, 8); wh.winX(2, 0, 28, 8); wh.winX(2, 79, 8, 6); wh.winX(2, 79, 30, 6);
    wh.hatch(2, 62, 8);
    wh.box(1, 1, 26, 2, 31, 0, 9, M.METAL); wh.box(1, 1, 26, 2, 31, 1, 3, M.CRATE); wh.box(1, 1, 26, 2, 31, 5, 7, M.CRATE);
    wh.box(1, 16, 26, 28, 27, 0, 9, M.METAL); wh.box(1, 16, 26, 28, 27, 1, 3, M.CRATE); wh.box(1, 16, 26, 28, 27, 5, 7, M.CRATE);
    wh.box(1, 28, 4, 37, 13, 0, 8, M.CONT_R); wh.crates(1, 44, 16, 6); wh.box(1, 10, 12, 15, 17, 0, 3, M.CRATE); wh.box(1, 44, 30, 49, 35, 0, 3, M.CRATE);
    wh.box(1, 58, 4, 76, 5, 0, 8, M.METAL); wh.box(1, 58, 4, 76, 5, 1, 3, M.CRATE); wh.box(1, 70, 14, 76, 19, 0, 4, M.CRATE); wh.box(1, 56, 16, 59, 19, 0, 5, M.METAL);
    wh.box(1, 62, 34, 70, 38, 1, 4, M.LINE); wh.box(1, 71, 35, 74, 37, 0, 0, M.METAL); wh.box(1, 64, 35, 68, 37, 5, 8, M.DARK); wh.box(1, 74, 24, 77, 28, 0, 3, M.CRATE);
    wh.box(2, 46, 12, 51, 15, 0, 3, M.CRATE); wh.box(2, 50, 24, 52, 28, 0, 3, M.CRATE);
    wh.desk(2, 66, 3, 74, 7); wh.shelf(2, 56, 18, 60, 20, 7); wh.table(2, 60, 13, 66, 16);
    wh.table(2, 60, 30, 70, 34, M.METAL); wh.shelf(2, 62, 41, 74, 42, 7); wh.box(2, 75, 26, 77, 30, 0, 3, M.CRATE);

    // ---- the quay: a ship-to-shore gantry crane with a box on the hook, stacks, trucks, lamps
    for (const [x, z] of [[150, 133], [150, 156], [180, 133], [180, 156]]) B.obox(x, z, x + 1, z + 1, 0, 33, M.LINE);
    B.obox(150, 133, 181, 134, 34, 35, M.LINE); B.obox(150, 156, 181, 157, 34, 35, M.LINE); B.obox(160, 86, 161, 157, 34, 35, M.LINE); B.obox(170, 86, 171, 157, 34, 35, M.LINE);
    B.obox(160, 86, 171, 87, 34, 35, M.LINE); B.obox(156, 140, 175, 150, 36, 40, M.WHITE); B.obox(156, 140, 175, 140, 37, 39, M.GLASS);
    B.obox(162, 88, 169, 96, 30, 33, M.FRT_ORANGE); for (const [x, z] of [[163, 89], [168, 89], [163, 95], [168, 95]]) B.obox(x, z, x, z, 26, 29, M.RAIL);
    B.obox(161, 82, 170, 103, 16, 25, M.CONT_R);
    B.container(112, 134, 'x', M.CONT_B); B.obox(112, 134, 135, 143, 10, 19, M.CONT_R); B.container(196, 134, 'x', M.CONT_G, true); B.container(242, 134, 'x', M.CONT_B); B.obox(242, 134, 265, 143, 10, 19, M.CONT_G);
    B.container(48, 140, 'z', M.CONT_R, true); B.container(274, 136, 'z', M.CONT_G);
    for (const x of [60, 120, 216, 290]) B.obox(x, 131, x + 1, 132, 0, 1, M.DARK);
    for (const x of [70, 150, 230, 310]) B.obox(x, 12, x + 1, 13, 0, 1, M.DARK);
    B.container(8, 40, 'z', M.CONT_B); B.container(20, 40, 'z', M.CONT_R, true); B.obox(8, 40, 17, 63, 10, 19, M.CONT_G); B.container(10, 104, 'x', M.CONT_G); B.container(10, 116, 'x', M.CONT_B, true);
    B.truck(300, 60, 'z', M.CAR_W); B.drum(318, 112, 7, 0, 14, M.WHITE); B.drum(318, 112, 7, 9, 10, M.RED_PAINT); B.container(296, 124, 'x', M.CONT_R);
    B.obox(150, 2, 152, 4, 0, 14, M.WHITE); B.obox(150, 2, 152, 4, 15, 16, M.LAMP_R); B.obox(214, 6, 226, 8, 0, 1, M.WOOD);
    B.truck(110, 215, 'x', M.CAR_R); B.truck(250, 228, 'x', M.CAR_W); B.car(40, 216, 'x', M.CAR_K); B.dumpster(152, 204);
    B.obox(166, 242, 178, 250, 0, 9, M.STUCCO); B.obox(166, 242, 178, 242, 4, 7, M.GLASS); B.obox(165, 241, 179, 251, 10, 10, M.METAL);
    B.fence(0, 254, 160, 254, M.FENCE); B.fence(184, 254, 343, 254, M.FENCE);
    B.lamp(60, 146); B.lamp(160, 196, 18); B.lamp(280, 146); B.lamp(30, 100); B.lamp(310, 30); B.lamp(120, 8); B.lamp(250, 8); B.lamp(60, 244); B.lamp(280, 244);
    // ---- cameras
    sup.cam(1, 28, 2, 180, 'ALLEYWAY'); sup.cam(3, 30, 2, 135, 'BRIDGE'); cas.cam(1, 2, 2, -135, 'MAIN HOLD'); hull.cam(0, 138, 20, -135, 'ENGINE ROOM'); hull.cam(0, 34, 12, -135, 'FORWARD HOLD');
    cus.cam(1, 2, 41, -45, 'CUSTOMS'); wh.cam(1, 2, 2, -135, 'WAREHOUSE');
    B.cam(hx(34), 22, hz(32), -90, -18, 'FORE DECK');

    for (const r of B.meta.rooms) if (r.b >= 1 && r.b <= 3) r.b = 0;   // the deckhouses are part of the ship
    B.spawn('Breakwater', 172, 6, 0); B.spawn('Container Yard', 6, 92, -90); B.spawn('Tank Farm', 338, 92, 90); B.spawn('Port Gate', 172, 258, 180);
    B.meta.bombs = [['Main Hold', 'Forward Hold'], ['Engine Room', 'Generator Room'], ['Crew Mess', 'Galley'], ['Bridge', "Captain's Cabin"], ['Customs Hall', 'Inspection Bay']];
    B.meta.secure = ['Control Room', 'Radio Room', 'Bosun Store', 'Bonded Store', 'Sick Bay'];
    B.meta.hostage = ["Captain's Cabin", 'Officers Lounge', 'Interview Room', 'Pump Room', 'Paint Locker'];
    B.meta.defSpawns = ['Engine Room', 'Crew Mess', 'Bridge'];
    return B;
  }
  define({ id: 'freighter', name: 'FREIGHTER', fn: freighter, blurb: 'Cargo ship at a container port · overcast day', cover: 'frt_stack', tint: 'rgba(70,100,120,0.35)' });
})();
