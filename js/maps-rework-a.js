/* maps-rework-a.js -- three of the first maps rebuilt far larger, each in several parts:
     ROADHOUSE     a highway truck stop: diner & bar over a brewery, a two-storey motor workshop with
                   inspection pits and a parts mezzanine, a motel wing round a court, a fuel station
     SUMMIT LODGE  a grand mountain hotel: a great hall open through two floors round a stone fireplace,
                   a guest wing, a spa with a sunken pool, a ski workshop and gondola hall, an attic
     HOMESTEAD     a farm compound: farmhouse with porch and attic, a bunker complex under the yard,
                   a barn open through two floors, a dairy and machine shed, a grain store
   Each one replaces the map of the same id in maps.js (MAPS.define). */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, THEMES, define } = MAPS;
  const GY = MAPS.GY;

  /* ------------------------------------------------------------------ helpers */
  /* an opening in a wall shared by two buildings is indoors: not a way in, not a rappel window */
  const inner = op => { op.ext = false; op.nrm = 0; return op; };
  /* [name, lx0, lz0, lx1, lz1, wall, floor, skip] */
  const rooms = (b, L, list) => { for (const [name, x0, z0, x1, z1, wall, floor, skip] of list) b.room(L, name, x0, z0, x1, z1, { wall, floor, skip }); };
  /* doors along one wall line: a start, or [start, width, height] */
  const dz = (b, L, line, ...as) => { for (const a of as) Array.isArray(a) ? b.doorZ(L, line, a[0], a[1], a[2]) : b.doorZ(L, line, a); };
  const dx = (b, L, line, ...as) => { for (const a of as) Array.isArray(a) ? b.doorX(L, line, a[0], a[1], a[2]) : b.doorX(L, line, a); };

  /* Buildings that share a wall line: a later building clears its whole box, the shared line
     included, up to six voxels above its own roof. Where the earlier building is the taller one
     that leaves a slot in its wall: put the wall back. Then take the kerb off buildings that are
     wholly underground (lo 0, hi 0: tunnels, cellars under a yard), whose roof is the ground. */
  function shells(B) {
    const bs = B.meta.buildings;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j];
      if (c.roofY >= a.roofY) continue;
      const x0 = Math.max(a.x, c.x), x1 = Math.min(a.x1, c.x1), z0 = Math.max(a.z, c.z), z1 = Math.min(a.z1, c.z1);
      if (x0 > x1 || z0 > z1) continue;
      const y0 = Math.max(c.roofY, a.lo * 12);
      B.w.fill(x0, y0, z0, x1, Math.min(c.roofY + 6, a.roofY), z1, (x, y, z) => (x === a.x || x === a.x1 || z === a.z || z === a.z1) ? a.ext : -1);
    }
    for (const t of bs) {
      if (t.hi !== 0) continue;
      const others = bs.filter(o => o !== t && o.hi >= 1);
      const held = (x, z) => others.some(o => x >= o.x && x <= o.x1 && z >= o.z && z <= o.z1);
      B.w.fill(t.x, GY + 1, t.z, t.x1, GY + 2, t.z1, (x, y, z) => (x === t.x || x === t.x1 || z === t.z || z === t.z1) && !held(x, z) ? 0 : -1);
    }
  }

  /* windows along one outside wall. side: 'z0' / 'z1' (the walls on lz = 0 and lz = d-1), 'x0' / 'x1'.
     From a0 to a1 along the wall, each n wide, at least `step` apart; a place is skipped when a door
     is already cut there, a cross wall meets the wall, or something stands against it inside or out. */
  function wins(b, L, side, a0, a1, o) {
    o = o || {};
    const n = o.n || 5, step = o.step || 13, W = b.W, y = L * 12 + 6;
    const alongX = side === 'z0' || side === 'z1';
    const line = side === 'z0' || side === 'x0' ? 0 : (alongX ? b.d : b.w) - 1, inw = line === 0 ? 1 : -1;
    const at = (a, off) => alongX ? W.get(b.X(a), y, b.Z(line + off)) : W.get(b.X(line + off), y, b.Z(a));
    let a = a0, made = 0;
    while (a + n - 1 <= a1) {
      let ok = true;
      for (let k = a - 2; k <= a + n + 1 && ok; k++) if (at(k, 0) !== b.ext) ok = false;
      for (let k = a - 1; k <= a + n && ok; k++) if (at(k, inw) || at(k, -inw)) ok = false;
      if (!ok) { a += 2; continue; }
      if (alongX) b.winZ(L, line, a, n); else b.winX(L, line, a, n);
      made++; a += step;
    }
    return made;
  }

  /* a straight flight, with rails round its opening on the floor above (a rail is only placed where nothing stands) */
  function flight(b, L, lx, lz, dir, n) {
    b.stairs(L, lx, lz, dir, n);
    const U = L + 1;
    if (dir === '+z') { b.rail(U, lx - 1, lz - 1, lx - 1, lz + 11); b.rail(U, lx + n, lz - 1, lx + n, lz + 11); b.rail(U, lx, lz - 1, lx + n - 1, lz - 1); }
    else if (dir === '-z') { b.rail(U, lx - 1, lz - 11, lx - 1, lz + 1); b.rail(U, lx + n, lz - 11, lx + n, lz + 1); b.rail(U, lx, lz + 1, lx + n - 1, lz + 1); }
    else if (dir === '+x') { b.rail(U, lx - 1, lz - 1, lx + 11, lz - 1); b.rail(U, lx - 1, lz + n, lx + 11, lz + n); b.rail(U, lx - 1, lz, lx - 1, lz + n - 1); }
    else { b.rail(U, lx - 11, lz - 1, lx + 1, lz - 1); b.rail(U, lx - 11, lz + n, lx + 1, lz + n); b.rail(U, lx + 1, lz, lx + 1, lz + n - 1); }
  }

  /* an enclosed switchback stair, 12 wide (walls on lx0 and lx0+12), for levels lo..hi, with a name.
     Its doors go on the wall at lz = zd; it runs `depth` voxels from there toward +z (s = 1) or -z
     (s = -1). Flights alternate: lo -> lo+1 climbs the east half back toward the door wall, the
     next one climbs the west half away from it. The caller cuts the doors: on the door wall for the
     bottom level and for a level between two flights (both flights start beside that wall; the far
     end of such a level is cut off from the stair, so open it into the room next door), and on the
     half without the opening, or at the far end, for the top level. */
  function well(b, name, lx0, zd, s, depth, lo, hi, wall) {
    const zf = zd + s * depth;
    for (let L = lo; L <= hi; L++) b.room(L, name + (L ? ' ' + L + 'F' : ' B'), lx0, Math.min(zd, zf), lx0 + 12, Math.max(zd, zf), { wall, stair: true });
    const away = s > 0 ? '+z' : '-z', back = s > 0 ? '-z' : '+z';
    for (let L = lo; L < hi; L++) {
      if ((L - lo) % 2 === 0) {
        b.stairs(L, lx0 + 7, zd + s * 15, back, 5);
        b.rail(L + 1, lx0 + 6, zd + s * 4, lx0 + 6, zd + s * 15); b.rail(L + 1, lx0 + 7, zd + s * 16, lx0 + 11, zd + s * 16);
      } else {
        b.stairs(L, lx0 + 1, zd + s * 4, away, 5);
        b.rail(L + 1, lx0 + 6, zd + s * 3, lx0 + 6, zd + s * 15); b.rail(L + 1, lx0 + 1, zd + s * 3, lx0 + 5, zd + s * 3);
      }
    }
  }

  /* =================================================================== ROADHOUSE
     Five parts round a forecourt and a motel court (north is the highway, z = 0):
       the diner & bar block   brewery cellar · diner, bar, kitchen · the owner's apartment on top
       the motor workshop      three service bays open through both floors, two over inspection pits,
                               a parts mezzanine round them, tire shop, paint booth, loading dock, stores below
       the motel wing          rooms off a corridor on two floors, an outside walkway on the court side
       the bottling hall       under the forecourt, with a tunnel on to the workshop's pit level
       the fuel shop           on the forecourt beside the pump canopy, its cellar on the tunnel */
  mat('RDH_CINDER', 0xa39f93, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'block', wall: true });
  mat('RDH_MOTEL', 0x6f9f9a, { hp: 7, pen: 0.45, xp: true, hb: true, pat: 'siding', wall: true });
  mat('RDH_COPPER', 0xb5713a, {});
  mat('RDH_VINYL', 0x2d8a84, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true });
  mat('RDH_SIGN', 0xffc23a, { glow: true });

  function roadhouse() {
    const B = new Builder('roadhouse', 'ROADHOUSE', 324, 56, 344);
    B.meta.desc = 'A highway truck stop in the pines: a diner and bar over a brewery cellar, a two-storey motor workshop with inspection pits, a motel wing round a court and a fuel station on the forecourt. Dusk.';
    B.theme(THEMES.dusk);
    B.ground(M.GRASS);
    B.surf(0, 0, 323, 34, M.ASPHALT);
    for (let x = 4; x < 320; x += 10) B.surf(x, 16, x + 5, 16, M.LINE);
    B.surf(0, 3, 323, 3, M.WHITE); B.surf(0, 30, 323, 30, M.WHITE);
    B.surf(44, 35, 272, 119, M.ASPHALT);
    B.surf(261, 60, 323, 250, M.GRAVEL);
    B.surf(105, 197, 173, 304, M.GRAVEL); B.surf(174, 207, 306, 304, M.GRAVEL);
    B.surf(0, 320, 323, 343, M.DIRT);

    const b = B.building(64, 120, 111, 77, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    const g = B.building(174, 90, 87, 117, { lo: 0, hi: 2, ext: M.RDH_CINDER, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.ROOF, parapet: M.RUST });
    const mo = B.building(64, 196, 41, 85, { lo: 1, hi: 2, ext: M.RDH_MOTEL, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.WHITE });
    const bh = B.building(98, 90, 77, 31, { lo: 0, hi: 0, ext: M.ASPHALT, inner: M.DRY_GREY, roof: M.ASPHALT });
    const fs = B.building(112, 64, 41, 27, { lo: 0, hi: 1, ext: M.STUCCO, inner: M.DRY_WHITE, slab: M.TILE, roof: M.ROOF, parapet: M.RED_PAINT });
    shells(B);

    // ================= the diner & bar block
    rooms(b, 0, [
      ['Brewery', 0, 0, 46, 36, M.DRY_GREY], ['Cold Storage', 46, 0, 76, 36, M.DRY_GREY], ['Keg Cellar', 88, 0, 110, 36, M.DRY_GREY],
      ['Lower Hall', 0, 36, 110, 44, M.DRY_GREY], ['Generator Room', 0, 44, 34, 76, M.CONCRETE], ['Malt Store', 76, 44, 110, 76, M.DRY_GREY],
      ['Safe Room', 34, 44, 64, 76, M.CONCRETE]]);
    rooms(b, 1, [
      ['Diner', 0, 0, 46, 36, M.DRY_RED, M.TILE], ['Bar Lounge', 46, 0, 76, 36, M.DRY_RED], ['Service Desk', 88, 0, 110, 36, M.DRY_GREY, M.TILE],
      ['Hallway', 0, 36, 110, 44], ['Kitchen', 0, 44, 30, 76, M.DRY_WHITE, M.TILE], ['Service Corridor', 30, 44, 40, 76],
      ['Back Office', 40, 44, 64, 76, M.DRY_SAGE, M.CARPET2], ['Staff Room', 76, 44, 110, 76, M.DRY_BLUE]]);
    rooms(b, 2, [
      ['Living Room', 0, 0, 40, 36, M.DRY_BLUE, M.CARPET2], ['Bedroom', 40, 0, 76, 36, M.DRY_SAGE, M.CARPET], ['Gym', 88, 0, 110, 36, M.DRY_GREY],
      ['Upper Hall', 0, 36, 110, 44], ['Bathroom', 0, 44, 20, 76, M.DRY_WHITE, M.TILE], ['Boss Office', 20, 44, 48, 76, M.DRY_RED, M.CARPET],
      ['Armory', 48, 44, 64, 76, M.DRY_GREY], ['Trophy Room', 76, 44, 110, 76, M.DRY_BLUE]]);
    well(b, 'Bar Stairs', 76, 36, -1, 36, 0, 2);
    well(b, 'Main Stairs', 64, 44, 1, 32, 0, 2);
    // doors B
    dz(b, 0, 36, 20, 58, 77, 96); dz(b, 0, 44, 14, 46, 65, 90); dx(b, 0, 46, 14); dx(b, 0, 34, 58); dx(b, 0, 76, 64);
    b.cellar('w', 38);
    for (const a of [38, 58, 80, 98]) inner(b.doorZ(0, 0, a));           // north into the bottling hall and the tunnel
    inner(b.doorX(0, 110, 38)); inner(b.doorX(0, 110, 16));               // east into the workshop's pit level
    // doors 1F
    b.doorZ(1, 0, 20, 6); b.doorZ(1, 0, 58); b.doorZ(1, 0, 96); b.doorX(1, 0, 58); b.doorZ(1, 76, 52); b.doorZ(1, 76, 92);
    dx(b, 1, 46, 12, [24, 6]); dz(b, 1, 36, 8, 34, 54, 77, 96); dz(b, 1, 44, 12, 33, 48, 65, 90);
    dx(b, 1, 30, 60); dx(b, 1, 40, 52);
    b.doorX(1, 76, 4, 12, 10); b.doorX(1, 64, 62, 10, 10);                // the far ends of the two stairs are alcoves of the bar and the office
    inner(b.doorZ(1, 76, 33));                                            // the motel lobby
    inner(b.doorX(1, 110, 38)); inner(b.doorX(1, 110, 14)); inner(b.doorX(1, 110, 60)); inner(b.winX(1, 110, 24, 6));   // the workshop
    // doors 2F
    dz(b, 2, 36, 16, 56, 83, 96); dz(b, 2, 44, 8, 30, 54, 71, 90); dx(b, 2, 40, 20); dx(b, 2, 76, 8, 66); dx(b, 2, 88, 8);
    dx(b, 2, 20, 58); dx(b, 2, 48, 60); dx(b, 2, 64, 66);
    b.doorZ(2, 76, 42);                                                   // the boss's own door onto the motel walkway
    inner(b.doorX(2, 110, 38)); inner(b.doorX(2, 110, 60)); inner(b.winX(2, 110, 8, 8)); inner(b.winX(2, 110, 22, 8));   // mezzanine door; the gym looks down on the bays
    for (const L of [1, 2]) { wins(b, L, 'z0', 3, 107); wins(b, L, 'x0', 3, 73); wins(b, L, 'z1', 50, 107); }
    b.hatch(2, 12, 22); b.hatch(2, 56, 16); b.hatch(2, 42, 56); b.hatch(2, 92, 58);
    b.hatch(1, 28, 22); b.hatch(1, 56, 22); b.hatch(1, 12, 58); b.hatch(1, 92, 22);
    // furniture B
    b.tank(0, 8, 8, 4, 8, M.RDH_COPPER); b.tank(0, 8, 22, 4, 8, M.RDH_COPPER); b.tank(0, 22, 8, 3, 8, M.METAL);
    b.box(0, 8, 13, 9, 17, 9, 9, M.PIPE); b.box(0, 13, 8, 18, 9, 9, 9, M.PIPE);
    b.box(0, 34, 26, 44, 33, 0, 3, M.CRATE); b.box(0, 36, 28, 42, 32, 4, 6, M.CRATE); b.table(0, 3, 30, 13, 34, M.METAL);
    b.shelf(0, 72, 3, 74, 30, 8); b.box(0, 48, 24, 52, 34, 0, 6, M.FRIDGE); b.box(0, 64, 26, 70, 32, 0, 2, M.ICE); b.crates(0, 48, 3, 4);
    for (const z of [6, 30]) b.tank(0, 92, z, 2, 4, M.WOOD);
    b.box(0, 104, 24, 108, 34, 0, 6, M.WOOD); b.box(0, 104, 3, 108, 10, 0, 3, M.CRATE);
    b.box(0, 2, 38, 108, 38, 10, 10, M.PIPE); b.box(0, 50, 41, 55, 43, 0, 3, M.CRATE); b.box(0, 26, 37, 29, 38, 0, 4, M.METAL);
    b.box(0, 4, 64, 20, 72, 0, 6, M.METAL); b.box(0, 8, 62, 9, 63, 0, 10, M.PIPE); b.tank(0, 28, 49, 2, 4, M.RED_PAINT); b.tank(0, 28, 70, 2, 4, M.RED_PAINT);
    b.box(0, 1, 47, 2, 56, 2, 8, M.DARK);
    b.box(0, 56, 66, 62, 74, 0, 7, M.METAL); b.bed(0, 36, 66, 46, 72, M.FAB_BLUE); b.table(0, 52, 50, 60, 56); b.shelf(0, 36, 46, 42, 47, 7);
    b.box(0, 82, 68, 96, 74, 0, 3, M.SANDBAG); b.box(0, 84, 70, 94, 74, 4, 6, M.SANDBAG); b.shelf(0, 106, 48, 108, 72, 8); b.crates(0, 96, 52, 6);
    // furniture 1F: diner booths and counter, the bar, kitchen
    for (const x of [3, 30]) { b.couch(1, x, 1, x + 2, 6, M.RDH_VINYL, 'w'); b.table(1, x + 3, 1, x + 7, 5); b.couch(1, x + 8, 1, x + 10, 6, M.RDH_VINYL, 'e'); }
    b.couch(1, 1, 14, 6, 16, M.RDH_VINYL, 's'); b.table(1, 1, 17, 5, 21); b.couch(1, 1, 22, 6, 24, M.RDH_VINYL, 'n');
    b.counter(1, 14, 30, 30, 32); for (const x of [16, 20, 24, 28]) b.box(1, x, 27, x, 27, 0, 1, M.RED_PAINT);
    b.box(1, 42, 31, 44, 34, 0, 6, M.NEON_P);
    b.box(1, 50, 5, 56, 14, 0, 2, M.TRIM); b.box(1, 50, 5, 56, 14, 3, 3, M.FELT); b.box(1, 47, 18, 47, 22, 5, 8, M.NEON_P);
    b.counter(1, 62, 26, 73, 28, M.TRIM); b.shelf(1, 62, 33, 73, 34, 6); b.box(1, 48, 31, 51, 34, 0, 1, M.FAB_RED);
    b.box(1, 78, 1, 86, 6, 0, 0, M.TRIM); b.box(1, 84, 1, 86, 3, 1, 4, M.DARK); b.box(1, 78, 17, 80, 19, 0, 6, M.NEON_B);
    b.counter(1, 90, 8, 92, 18, M.TRIM); b.shelf(1, 104, 2, 108, 3, 7); b.tank(1, 92, 31, 2, 5, M.TIRE); b.box(1, 103, 31, 108, 34, 0, 1, M.WOOD);
    b.box(1, 68, 37, 73, 38, 0, 3, M.TRIM); b.box(1, 22, 42, 25, 43, 0, 7, M.FRIDGE);
    b.counter(1, 20, 46, 28, 48, M.METAL); b.counter(1, 2, 46, 8, 48); b.box(1, 9, 52, 21, 54, 0, 3, M.METAL); b.counter(1, 2, 68, 6, 74, M.FRIDGE); b.shelf(1, 12, 73, 26, 74, 7);
    b.box(1, 31, 66, 32, 74, 0, 4, M.CRATE);
    b.desk(1, 54, 50, 62, 54); b.shelf(1, 42, 66, 44, 74, 8); b.box(1, 42, 46, 46, 47, 0, 5, M.METAL);
    b.box(1, 70, 70, 74, 74, 0, 6, M.METAL); b.box(1, 65, 73, 68, 75, 0, 3, M.CRATE);
    b.box(1, 78, 46, 86, 47, 0, 8, M.METAL); b.table(1, 82, 56, 88, 62); b.couch(1, 100, 46, 108, 49, M.FAB_BLUE, 's'); b.counter(1, 78, 70, 86, 74);
    // furniture 2F: the apartment
    b.couch(2, 4, 8, 6, 18, M.FAB_BLUE, 'w'); b.box(2, 20, 10, 21, 16, 0, 1, M.TRIM); b.box(2, 20, 11, 20, 15, 2, 5, M.SCREEN); b.table(2, 24, 26, 34, 32); b.shelf(2, 26, 2, 36, 3, 7);
    b.bed(2, 44, 4, 54, 12, M.FAB_RED); b.box(2, 66, 26, 74, 34, 0, 8, M.TRIM); b.desk(2, 44, 28, 52, 32);
    b.box(2, 94, 16, 100, 18, 0, 1, M.DARK); b.box(2, 104, 28, 108, 34, 0, 4, M.METAL); b.box(2, 92, 26, 93, 27, 3, 10, M.FAB_RED); b.box(2, 100, 4, 108, 12, 0, 0, M.FAB_BLUE);
    b.box(2, 22, 37, 26, 38, 0, 3, M.TRIM); b.box(2, 60, 42, 62, 43, 0, 5, M.LEAF);
    b.box(2, 2, 66, 12, 72, 0, 2, M.WHITE); b.box(2, 3, 67, 11, 71, 2, 2, 0); b.counter(2, 2, 46, 6, 50, M.WHITE);
    b.desk(2, 26, 66, 38, 70); b.shelf(2, 22, 73, 36, 74, 8); b.couch(2, 36, 46, 46, 49, M.FAB_RED, 's');
    b.box(2, 60, 46, 62, 56, 0, 8, M.METAL); b.box(2, 49, 46, 52, 47, 0, 8, M.METAL); b.box(2, 50, 70, 56, 74, 0, 3, M.CRATE);
    for (const x of [80, 100]) { b.box(2, x, 50, x + 4, 54, 0, 2, M.TRIM); b.box(2, x, 50, x + 4, 54, 3, 6, M.GLASS); }
    b.box(2, 82, 72, 104, 74, 0, 3, M.TRIM); b.box(2, 82, 72, 104, 74, 4, 6, M.GLASS); b.box(2, 108, 48, 109, 54, 4, 7, M.BRASS);

    // ================= the motor workshop: three bays open through both floors, two of them over pits
    rooms(g, 0, [
      ['Pit Level', 0, 0, 60, 76, M.CONCRETE], ['Parts Room', 60, 0, 86, 38, M.DRY_GREY], ['Compressor Room', 60, 38, 86, 76, M.DRY_GREY],
      ['Tire Store', 0, 76, 86, 116, M.DRY_GREY]]);
    rooms(g, 1, [
      ['Service Bays', 0, 0, 60, 76, M.DRY_GREY], ['Tire Shop', 60, 0, 86, 38, M.DRY_GREY], ['Parts Counter', 60, 38, 86, 76, M.DRY_BEIGE, M.TILE],
      ['Paint Booth', 0, 76, 34, 116, M.DRY_WHITE], ['Machine Shop', 34, 76, 60, 116, M.DRY_GREY], ['Loading Dock', 60, 76, 86, 116, M.DRY_GREY]]);
    rooms(g, 2, [
      ['Parts Mezzanine', 0, 0, 60, 76, M.DRY_GREY], ['Parts Loft', 60, 0, 86, 38, M.DRY_GREY], ['Foreman Office', 60, 38, 86, 76, M.DRY_SAGE, M.CARPET2],
      ['Locker Room', 0, 76, 44, 116, M.DRY_BLUE, M.TILE], ['Tire Loft', 44, 76, 86, 116, M.DRY_GREY]]);
    g.void(2, 1, 1, 47, 59);
    g.rail(2, 48, 1, 48, 60); g.rail(2, 1, 60, 37, 60); g.rail(2, 44, 60, 47, 60);
    g.stairs(1, 38, 48, '+z', 6);                            // bays -> mezzanine
    g.void(1, 7, 14, 12, 46); g.void(1, 22, 14, 27, 46);     // the inspection pits: trenches at pit level, open to the bays
    for (const x of [6, 13, 21, 28]) g.wallX(0, x, 13, 47, M.CONCRETE);
    flight(g, 0, 52, 64, '-z', 5);                           // pit level -> bays
    flight(g, 1, 61, 81, '+z', 5);                           // loading dock -> tire loft
    // doors B
    dx(g, 0, 60, 18, 68); dz(g, 0, 76, 20, 44, 70); dz(g, 0, 38, 70);
    inner(g.doorX(0, 0, 13));                                // the forecourt tunnel
    g.cellar('n', 30);
    // doors 1F
    g.shutterZ(1, 0, 3, 13); g.shutterZ(1, 0, 18, 13); g.shutterZ(1, 0, 33, 13);
    g.doorZ(1, 0, 50); g.doorZ(1, 0, 68); g.doorX(1, 0, 20); g.doorX(1, 86, 18); g.doorX(1, 86, 56); g.shutterX(1, 86, 88, 16); g.doorZ(1, 116, 14); g.doorZ(1, 116, 70);
    dx(g, 1, 60, 16, [44, 6]); dz(g, 1, 38, 70); dz(g, 1, 76, [10, 6], 44, 70); dx(g, 1, 34, 94); dx(g, 1, 60, 96);
    // doors 2F
    dx(g, 2, 60, 14, 56); g.winX(2, 60, 44, 8); dz(g, 2, 38, 70); dz(g, 2, 76, 12, 50, 72); dx(g, 2, 44, 98);
    for (const L of [1, 2]) { wins(g, L, 'x1', 3, 113); wins(g, L, 'z1', 3, 83); wins(g, L, 'x0', 3, 27); }
    wins(g, 1, 'z0', 62, 83); wins(g, 2, 'z0', 3, 83);
    g.hatch(2, 66, 20); g.hatch(2, 20, 96); g.hatch(1, 66, 60);
    // the bays: a car over the first pit, the second open, a car up on the lift in the third, a gantry overhead
    B.car(g.X(6), g.Z(22), 'z', M.CAR_R);
    for (const [x, z] of [[34, 16], [45, 16], [34, 34], [45, 34]]) g.box(1, x, z, x, z, 0, 7, M.METAL);
    g.box(1, 34, 15, 45, 35, 7, 7, M.METAL); g.box(1, 36, 17, 43, 33, 8, 10, M.CAR_W); g.box(1, 36, 21, 43, 28, 11, 12, M.GLASS); g.box(1, 37, 22, 42, 27, 13, 13, M.CAR_W);
    g.box(1, 1, 50, 2, 64, 0, 3, M.METAL); g.box(1, 15, 20, 18, 23, 0, 4, M.RED_PAINT); g.tank(1, 16, 52, 2, 4, M.BLUE_PAINT); g.tank(1, 18, 68, 2, 3, M.TIRE);
    g.box(1, 26, 70, 34, 74, 0, 3, M.CRATE);
    g.box(2, 1, 30, 47, 31, 8, 9, M.LINE); g.box(2, 22, 29, 25, 32, 6, 7, M.METAL); g.box(2, 23, 30, 23, 30, 1, 5, M.RAIL);
    // pit level
    for (const [x, z] of [[16, 6], [40, 6], [16, 56], [40, 56]]) g.box(0, x, z, x + 1, z + 1, 0, 10, M.CONCRETE);
    g.tank(0, 36, 22, 2, 4, M.DARK); g.tank(0, 42, 22, 2, 4, M.DARK); g.box(0, 34, 36, 44, 38, 0, 3, M.METAL); g.box(0, 1, 56, 4, 62, 0, 3, M.CRATE);
    for (const x of [6, 13, 21, 28]) g.box(0, x, 28, x, 31, 6, 7, M.LAMP);
    g.shelf(0, 64, 4, 66, 14, 8); g.shelf(0, 74, 4, 76, 30, 8); g.shelf(0, 82, 4, 84, 30, 8); g.crates(0, 62, 26, 4);
    g.tank(0, 66, 48, 3, 7, M.BLUE_PAINT); g.box(0, 78, 44, 84, 56, 0, 6, M.METAL); g.box(0, 66, 52, 67, 58, 9, 9, M.PIPE); g.box(0, 80, 66, 84, 72, 0, 3, M.CRATE);
    for (const x of [8, 18, 54, 64, 76]) for (const z of [86, 104]) g.tank(0, x, z, 2, 5, M.TIRE);
    g.shelf(0, 2, 112, 14, 114, 8); g.shelf(0, 44, 112, 82, 114, 8); g.box(0, 40, 94, 41, 95, 0, 10, M.CONCRETE);
    // shops round the bays
    g.box(1, 62, 2, 64, 12, 0, 8, M.TIRE); g.box(1, 74, 2, 84, 4, 0, 6, M.TIRE); g.counter(1, 76, 28, 84, 30); g.tank(1, 64, 32, 2, 4, M.TIRE);
    g.counter(1, 66, 50, 80, 52, M.TRIM); g.shelf(1, 62, 72, 68, 74, 8); g.box(1, 82, 64, 84, 74, 0, 8, M.METAL); g.box(1, 62, 40, 64, 42, 0, 6, M.RED_PAINT);
    B.car(g.X(8), g.Z(100), 'x', M.CAR_W); g.tank(1, 4, 82, 2, 4, M.RED_PAINT); g.tank(1, 4, 110, 2, 4, M.BLUE_PAINT); g.box(1, 28, 78, 32, 84, 0, 6, M.METAL);
    g.box(1, 50, 80, 58, 84, 0, 4, M.METAL); g.box(1, 36, 106, 40, 110, 0, 7, M.METAL); g.box(1, 46, 110, 58, 114, 0, 3, M.WOOD);
    g.box(1, 74, 104, 82, 112, 0, 3, M.CRATE); g.box(1, 76, 106, 80, 110, 4, 6, M.CRATE); g.crates(1, 76, 78, 4); g.box(1, 68, 98, 71, 103, 0, 5, M.LINE);
    // 2F: the mezzanine, lofts, foreman
    g.shelf(2, 56, 2, 59, 10, 7); g.box(2, 54, 24, 59, 30, 0, 3, M.CRATE); g.box(2, 54, 34, 59, 40, 0, 3, M.CRATE); g.shelf(2, 18, 73, 34, 75, 7);
    g.shelf(2, 76, 4, 78, 16, 8); g.shelf(2, 82, 4, 84, 30, 8); g.crates(2, 62, 26, 4);
    g.desk(2, 64, 44, 72, 48); g.shelf(2, 82, 46, 84, 60, 8); g.couch(2, 77, 70, 84, 73, M.FAB_RED, 'n');
    g.box(2, 24, 78, 42, 79, 0, 8, M.METAL); g.box(2, 2, 78, 8, 79, 0, 8, M.METAL); g.box(2, 8, 104, 30, 105, 0, 1, M.WOOD); g.box(2, 2, 108, 3, 114, 0, 8, M.WHITE);
    g.tank(2, 50, 108, 2, 5, M.TIRE); g.tank(2, 56, 108, 2, 5, M.TIRE); g.box(2, 76, 100, 84, 114, 0, 6, M.TIRE); g.box(2, 78, 80, 84, 86, 0, 3, M.CRATE);

    // ================= the motel wing
    rooms(mo, 1, [
      ['Motel Lobby', 0, 0, 40, 14], ['Motel Corridor', 0, 14, 10, 84], ['Room 101', 10, 14, 40, 38, M.DRY_SAGE, M.CARPET],
      ['Room 102', 10, 38, 40, 62, M.DRY_BLUE, M.CARPET2], ['Laundry', 10, 62, 40, 84, M.DRY_WHITE, M.TILE]]);
    rooms(mo, 2, [
      ['Motel Landing', 0, 0, 40, 14], ['Motel Hall', 0, 14, 10, 84], ['Room 201', 10, 14, 40, 38, M.DRY_RED, M.CARPET],
      ['Room 202', 10, 38, 40, 62, M.DRY_SAGE, M.CARPET2], ['Room 203', 10, 62, 40, 84, M.DRY_BLUE, M.CARPET]]);
    flight(mo, 1, 14, 3, '+x', 5);
    mo.doorX(1, 0, 5); mo.doorX(1, 40, 5); mo.doorZ(1, 84, 3);
    for (const L of [1, 2]) { dz(mo, L, 14, 3); dx(mo, L, 10, 22, 46, 70); for (const a of [24, 48, 72]) mo.doorX(L, 40, a); }
    mo.doorX(2, 40, 5); dz(mo, 1, 38, 28); dz(mo, 2, 62, 28);
    for (const L of [1, 2]) { wins(mo, L, 'x0', 16, 81); wins(mo, L, 'z1', 12, 37); wins(mo, L, 'x1', 15, 82, { n: 4, step: 8 }); }
    mo.hatch(2, 28, 28); mo.hatch(2, 28, 72);
    // the walkway on the court side, its stair down at the south end
    B.box(mo.X(41), 24, mo.Z(1), mo.X(48), 24, mo.Z(86), M.CONCRETE);
    for (let lz = 6; lz <= 86; lz += 16) B.box(mo.X(48), 13, mo.Z(lz), mo.X(48), 23, mo.Z(lz), M.WHITE);
    mo.stairs(1, 42, 98, '-z', 6);
    mo.rail(2, 48, 1, 48, 86); mo.rail(2, 41, 86, 41, 86);
    // furniture
    mo.counter(1, 28, 10, 36, 12, M.TRIM); mo.box(1, 30, 13, 34, 13, 4, 7, M.BRASS); mo.box(1, 8, 11, 9, 12, 0, 4, M.LEAF);
    mo.box(1, 1, 34, 2, 37, 0, 7, M.RED_PAINT); mo.box(1, 7, 58, 9, 61, 0, 3, M.WHITE);
    mo.bed(1, 20, 16, 30, 22, M.FAB_RED); mo.box(1, 12, 33, 20, 36, 0, 3, M.TRIM); mo.box(1, 14, 36, 18, 36, 4, 6, M.SCREEN); mo.table(1, 34, 31, 38, 35);
    mo.bed(1, 20, 54, 30, 60, M.FAB_BLUE); mo.box(1, 12, 40, 18, 43, 0, 3, M.TRIM); mo.couch(1, 33, 40, 38, 44, M.FAB_RED, 's');
    mo.box(1, 12, 80, 30, 82, 0, 3, M.WHITE); mo.box(1, 12, 64, 18, 65, 0, 6, M.WHITE); mo.table(1, 32, 65, 37, 68); mo.box(1, 33, 80, 37, 82, 0, 2, M.FAB_BLUE);
    mo.couch(2, 30, 10, 37, 12, M.FAB_BLUE, 'n'); mo.box(2, 2, 2, 6, 3, 0, 3, M.TRIM);
    mo.box(2, 1, 40, 2, 43, 0, 6, M.FRIDGE); mo.box(2, 7, 76, 9, 79, 0, 3, M.WHITE);
    mo.bed(2, 14, 16, 24, 22, M.FAB_BLUE); mo.box(2, 32, 33, 38, 36, 0, 3, M.TRIM); mo.box(2, 12, 32, 16, 36, 0, 6, M.TRIM);
    mo.bed(2, 14, 54, 24, 60, M.FAB_RED); mo.desk(2, 12, 40, 20, 43); mo.box(2, 34, 40, 38, 44, 0, 2, M.CRATE);
    mo.bed(2, 16, 78, 26, 83, M.WHITE); mo.box(2, 12, 64, 18, 66, 0, 6, M.TRIM); mo.table(2, 33, 78, 38, 82);

    // ================= under the forecourt: the bottling hall and the tunnel to the pits
    rooms(bh, 0, [['Bottling Hall', 0, 0, 50, 30, M.DRY_GREY], ['Forecourt Tunnel', 50, 10, 76, 30, M.CONCRETE]]);
    bh.box(0, 51, 1, 75, 9, 0, 10, M.CONC_DARK);
    bh.cellar('w', 18);
    inner(bh.doorZ(0, 0, 34)); dx(bh, 0, 50, 18);
    bh.hatch(1, 22, 20); bh.hatch(1, 58, 20);
    bh.box(0, 10, 9, 42, 11, 0, 3, M.METAL); for (let x = 12; x <= 40; x += 4) bh.box(0, x, 10, x, 10, 4, 5, M.GLASS);
    bh.box(0, 14, 4, 20, 7, 0, 7, M.METAL); bh.box(0, 44, 2, 48, 6, 0, 3, M.CRATE); bh.box(0, 36, 24, 42, 28, 0, 3, M.CRATE); bh.box(0, 12, 24, 20, 28, 0, 3, M.CRATE); bh.box(0, 14, 25, 18, 27, 4, 6, M.CRATE);
    bh.box(0, 52, 26, 60, 28, 0, 3, M.CRATE); bh.box(0, 70, 26, 74, 28, 0, 4, M.METAL); bh.box(0, 52, 12, 74, 12, 10, 10, M.PIPE);

    // ================= the fuel shop
    rooms(fs, 0, [['Shop Cellar', 0, 0, 40, 26, M.DRY_GREY]]);
    rooms(fs, 1, [['Fuel Shop', 0, 0, 40, 26, M.DRY_WHITE]]);
    flight(fs, 0, 3, 1, '+x', 5);
    fs.doorZ(1, 26, 17, 6); fs.doorZ(1, 0, 28); fs.doorX(1, 40, 10); fs.doorX(1, 0, 14);
    wins(fs, 1, 'z1', 3, 37, { n: 6, step: 9 }); wins(fs, 1, 'z0', 3, 37); wins(fs, 1, 'x0', 3, 23); wins(fs, 1, 'x1', 3, 23);
    fs.shelf(1, 20, 9, 21, 19, 5); fs.shelf(1, 27, 9, 28, 19, 5); fs.counter(1, 31, 18, 38, 20); fs.box(1, 36, 19, 37, 19, 4, 5, M.SCREEN); fs.box(1, 6, 22, 14, 24, 0, 7, M.FRIDGE);
    fs.shelf(0, 30, 2, 38, 3, 7); fs.crates(0, 30, 14, 4); fs.box(0, 4, 18, 12, 24, 0, 3, M.CRATE);

    // ================= outside
    // the pump canopy over the forecourt
    for (const x of [108, 136, 164]) for (const z of [95, 113]) B.obox(x, z, x + 1, z + 1, 0, 12, M.WHITE);
    B.obox(104, 93, 169, 116, 13, 14, M.WHITE); B.obox(104, 93, 169, 93, 13, 14, M.RED_PAINT); B.obox(104, 116, 169, 116, 13, 14, M.RED_PAINT);
    for (const x of [126, 146]) { B.obox(x, 103, x + 9, 106, 0, 0, M.CONCRETE); B.obox(x + 1, 104, x + 2, 105, 1, 6, M.RED_PAINT); B.obox(x + 7, 104, x + 8, 105, 1, 6, M.RED_PAINT); B.obox(x + 4, 104, x + 5, 105, 12, 12, M.LAMP); }
    B.car(138, 96, 'x', M.CAR_K); B.car(70, 100, 'x', M.CAR_W); B.car(68, 46, 'x', M.CAR_R); B.car(160, 44, 'z', M.CAR_W);
    B.truck(196, 42, 'x', M.CAR_W); B.car(240, 66, 'z', M.CAR_K);
    // the sign by the highway
    B.obox(52, 60, 53, 61, 0, 26, M.PIPE); B.obox(45, 60, 60, 61, 27, 36, M.DARK); B.obox(46, 60, 59, 60, 28, 35, M.RDH_SIGN); B.obox(46, 61, 59, 61, 28, 35, M.RDH_SIGN);
    B.obox(48, 60, 57, 61, 31, 32, M.RED_PAINT);
    // loading yard
    B.truck(274, 150, 'z', M.CAR_R); B.container(292, 96, 'z', M.CONT_R, true); B.container(278, 200, 'x', M.CONT_B); B.dumpster(266, 124);
    B.obox(268, 226, 275, 233, 0, 3, M.CRATE); B.obox(298, 150, 305, 157, 0, 7, M.CRATE);
    // the motel court: parked cars, a drained pool
    B.car(118, 212, 'x', M.CAR_R); B.car(118, 240, 'x', M.CAR_K); B.car(118, 262, 'x', M.CAR_W);
    B.box(144, 9, 226, 166, 12, 252, 0); B.box(144, 8, 226, 166, 8, 252, M.BLUE_PAINT);
    for (let k = 0; k < 3; k++) B.box(146, 9, 226 + k * 2, 151, 11 - k, 227 + k * 2, M.WHITE);
    B.obox(143, 225, 167, 225, 0, 0, M.WHITE); B.obox(143, 253, 167, 253, 0, 0, M.WHITE); B.obox(143, 225, 143, 253, 0, 0, M.WHITE); B.obox(167, 225, 167, 253, 0, 0, M.WHITE);
    B.obox(134, 268, 140, 270, 0, 1, M.WOOD); B.obox(152, 262, 153, 263, 0, 7, M.PIPE); B.obox(149, 259, 156, 266, 8, 8, M.FAB_RED);
    // behind the workshop
    B.dumpster(180, 222); B.obox(214, 222, 230, 229, 1, 3, M.RUST); B.obox(217, 222, 226, 229, 4, 5, M.RUST); B.drum(204, 240, 3, 0, 2, M.TIRE); B.drum(212, 244, 3, 0, 1, M.TIRE);
    B.container(226, 262, 'x', M.CONT_G, true); B.fence(110, 310, 306, 310, M.TRIM);
    for (const [x, z] of [[14, 60], [30, 84], [10, 110], [36, 132], [16, 160], [40, 190], [12, 216], [34, 244], [14, 272], [44, 296], [20, 312], [70, 300], [96, 306],
      [150, 316], [190, 300], [240, 312], [292, 318], [310, 280], [314, 44], [302, 62], [22, 44], [48, 150], [50, 230], [306, 300]]) B.tree(x, z, 20 + (x % 5), true);
    B.lamp(60, 112); B.lamp(180, 84); B.lamp(266, 84); B.lamp(132, 290); B.lamp(268, 212); B.lamp(110, 286);
    b.cam(1, 2, 2, -135, 'DINER'); b.cam(0, 2, 40, -90, 'LOWER HALL'); b.cam(2, 108, 40, 90, 'UPPER HALL'); g.cam(2, 58, 2, 135, 'SERVICE BAYS'); mo.cam(1, 5, 82, 0, 'MOTEL');
    B.cam(100, 27, 86, -135, -14, 'FORECOURT'); B.box(100, 13, 86, 100, 26, 86, M.PIPE);
    B.cam(170, 27, 262, 60, -14, 'MOTEL COURT'); B.box(170, 13, 262, 170, 26, 262, M.PIPE);
    B.spawn('Parking Lot', 120, 10, 0); B.spawn('Pine Woods', 8, 158, -90); B.spawn('Loading Yard', 316, 158, 90); B.spawn('Back Road', 120, 336, 180);
    B.meta.bombs = [['Brewery', 'Cold Storage'], ['Kitchen', 'Back Office'], ['Living Room', 'Bedroom'], ['Tire Shop', 'Parts Counter'], ['Room 201', 'Room 202']];
    B.meta.secure = ['Bar Lounge', 'Boss Office', 'Cold Storage', 'Armory', 'Paint Booth', 'Laundry'];
    B.meta.hostage = ['Boss Office', 'Brewery', 'Bar Lounge', 'Trophy Room', 'Foreman Office', 'Room 102'];
    B.meta.defSpawns = ['Brewery', 'Kitchen', 'Foreman Office'];
    return B;
  }
  define({ id: 'roadhouse', name: 'ROADHOUSE', fn: roadhouse, blurb: 'Truck stop, workshop & motel · dusk', cover: 'trailer', tint: 'rgba(170,84,48,0.38)' });
})();
