/* maps-millrace.js -- MILLRACE: a farmstead grown up round an old stone grist mill. A weathered
   farmhouse, the brick feed store built onto its side, the four-storey mill with its wheel pit,
   a machine shed, and the tunnels people dug between their cellars. The plan (property, every
   floor, connections, stairs, objectives, routes, outside): tools/MILLRACE.md */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, define } = MAPS;
  const K = MAPS.KIT;

  mat('MR_SIDING', 0x8d907d, { hp: 7, pen: 0.45, xp: true, hb: true, pat: 'siding', wall: true });   // weathered clapboard
  mat('MR_OAK', 0x5c3e24, { hp: 6, pen: 0.5, xp: true, hb: true, pat: 'grain' });                    // the wheel, beams, props
  mat('MR_MILLSTONE', 0x8f8b84, { pat: 'stone' });
  mat('MR_CORN', 0x98a044, { hp: 1, pen: 0.95, xp: true, hb: true, pat: 'noise' });
  mat('MR_TRACTOR', 0x3f7a3a, { hp: 20, pen: 0.3, pat: 'noise' });

  /* a flat disc (a millstone, a vat, a bale stack) on level L, heights above that floor */
  const disc = (b, L, cx, cz, r, h0, h1, m) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + 0.5) b.box(L, cx + dx, cz + dz, cx + dx, cz + dz, h0, h1, m); };

  function millrace() {
    const B = new Builder('millrace', 'MILLRACE', 330, 64, 292);
    K.begin(B);
    B.meta.desc = 'A farmstead that grew for a century round an old stone grist mill: a weathered farmhouse with a stone cellar, the brick feed store built onto its side, the four-storey mill on its race with a great wheel turning in a three-floor pit, a machine shed, and the tunnels dug between their cellars. Overcast morning.';
    B.theme({ sky: [0x7d8a94, 0xd8dcd8], fog: 0xbcc3c2, fogFar: 150, lightOut: [0.98, 0.96, 0.9], lightIn: [0.6, 0.56, 0.5], sun: 0xf0ecdc, outer: 0x5e7a42 });
    B.ground(M.GRASS);
    // the ground: county road, the drive, the store yard, the farmyard, the track to the mill
    B.surf(0, 16, 329, 30, M.GRAVEL);
    B.surf(163, 31, 176, 93, M.GRAVEL);
    B.surf(148, 60, 230, 93, M.GRAVEL);
    B.surf(96, 162, 200, 200, M.DIRT);
    B.surf(176, 162, 196, 262, M.DIRT);
    B.surf(100, 200, 112, 262, M.DIRT);

    // ---- the buildings. The farmhouse is the main one; the feed store shares its east wall
    const h = B.building(60, 100, 90, 61, { lo: 0, hi: 2, ext: M.MR_SIDING, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.WHITE });
    const s = B.building(149, 94, 72, 67, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const m = B.building(196, 196, 60, 61, { lo: 0, hi: 3, ext: M.STONE, inner: M.KT_TIMBER, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.STONE });
    const t = B.building(40, 192, 60, 48, { lo: 0, hi: 2, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const u = B.building(200, 160, 15, 37, { lo: 0, hi: 0, ext: M.STONE, inner: M.STONE, roof: M.GRAVEL });
    const c = B.building(80, 160, 13, 33, { lo: 0, hi: 0, ext: M.STONE, inner: M.STONE, roof: M.DIRT });
    const p = B.building(282, 214, 24, 24, { lo: 1, hi: 1, ext: M.STONE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.STONE });
    K.shells(B);
    h.pal = [M.DRY_BEIGE, M.DRY_SAGE, M.DRY_BLUE, M.DRY_WHITE];
    s.pal = [M.DRY_GREY, M.DRY_WHITE, M.DRY_BEIGE]; s.pillar = M.BRICK;
    m.pal = [M.KT_TIMBER]; m.pillar = M.MR_OAK;
    t.pal = [M.DRY_GREY]; t.pillar = M.METAL;
    u.pal = [M.STONE]; u.plain = true; c.pal = [M.STONE]; c.plain = true;
    p.pal = [M.DRY_GREY];

    // ---- FARMHOUSE: stone cellar, ground floor, bedrooms upstairs (lx 0-89, lz 0-60)
    K.plan(h, 0, `
      0-24: Root Cellar 18 | Canning Room 42 | Boiler Room 66 | Wine Cellar 89
      24-36: Cellar Hall 89
      36-60: Coal Bin 16 | Workshop 38 | - 50 | Cold Storage 70 | Storm Shelter 89`);
    K.plan(h, 1, `
      0-24: Mud Room 16 | Farm Kitchen 46 | Dining Room 68 | Front Parlour 89
      24-36: Long Hall 89
      36-60: Pantry 16 | Laundry 38 | - 50 | Living Room 72 | Den 89`);
    K.plan(h, 2, `
      0-24: Master Bedroom 24 | Bathroom 40 | Kids Bedroom 64 | Guest Bedroom 89
      24-36: Upstairs Hall 89
      36-60: Linen Room 16 | Nursery 38 | - 50 | Sewing Room 70 | Old Office 89`);
    K.well(h, 'House Stairs', 38, 36, 'z', 0, 2);
    K.flight(h, 0, 6, 28, '+x', 4);      // Cellar Steps: up from the cellar hall into the long hall
    K.flight(h, 1, 56, 28, '+x', 4);     // Front Stairs: up from the long hall to the bedrooms
    h.cellar('w', 44);                    // the storm-cellar bulkhead into the coal bin
    h.fireplace(1, 2, 84, 8, 88, 16);     // the parlour's stone fireplace, its chimney up through the guest room
    for (let x = 22; x <= 84; x += 12) h.box(0, x, 25, x, 35, 10, 10, M.MR_OAK);    // cellar joists
    h.box(1, 26, 8, 36, 12, 0, 3, M.COUNTER);                                      // the kitchen island
    h.table(1, 52, 6, 62, 14, M.MR_OAK);                                           // the long dining table

    // ---- FEED STORE: stock basement, shop floor, offices and loft (lx 0-71, lz 0-66)
    K.plan(s, 0, `
      0-30: Fertilizer Store 26 | Stock Room 71
      30-42: Store Cellar Hall 71
      42-66: Pump Room 22 | - 34 | Bagging Room 71`);
    K.plan(s, 1, `
      0-30: Front Office 20 | Seed Room 44 | Showroom 71
      30-42: Store Hall 71
      42-66: Feed Room 22 | - 34 | Sales Floor 71`);
    K.plan(s, 2, `
      0-30: Ledger Office 24 | Records Room 46 | Owners Suite 71
      30-42: Store Upper Hall 71
      42-66: Bulk Loft 22 | - 34 | Grain Office 52 | Sample Lab 71`);
    K.well(s, 'Store Stairs', 22, 42, 'z', 0, 2);
    K.flight(s, 1, 44, 34, '+x', 4);     // Back Stairs: store hall up to the offices
    s.cellar('s', 44);                    // the loading chute from the yard down into the stock room
    // the sales floor: long gondola shelves of feed and seed, a counter by the hall
    for (const z of [47, 55]) { s.box(1, 40, z, 52, z + 1, 0, 5, M.TRIM); s.box(1, 40, z, 52, z + 1, 1, 4, M.SANDBAG); }
    s.counter(1, 58, 45, 68, 47);

    // ---- GRIST MILL: race cellar, millstone floor, stone loft, bin floor (lx 0-59, lz 0-60)
    K.plan(m, 0, `
      0-24: Tunnel Landing 18 | Grain Pit 40 | Wheel Pit~ 59
      24-36: Mill Cellar Hall 59
      36-60: Sack Store 20 | - 32 | Race Gate Room 59`);
    K.plan(m, 1, `
      0-24: Miller Office 18 | Millstone Floor~ 40 | Wheel Room~ 59
      24-36: Mill Hall 59
      36-60: Bolting Room 20 | - 32 | Loading Bay~ 59`);
    K.plan(m, 2, `
      0-24: Hopper Room 18 | Stone Loft 40 | Wheel Gallery~ 59
      24-36: Mill Upper Hall 59
      36-60: Sifter Room 20 | - 32 | Sack Hoist Room 59`);
    K.plan(m, 3, `
      0-24: Bin Floor 40 | Hoist Head 59
      24-36: Bin Hall 59
      36-60: Grain Bins 20 | - 32 | Lookout Loft 59`);
    K.well(m, 'Mill Stairs', 20, 36, 'z', 0, 3);
    K.flight(m, 0, 36, 28, '+x', 4);     // Pit Steps: cellar hall up to the mill hall
    K.flight(m, 1, 8, 28, '+x', 4);      // Mill Steps: mill hall up to the stone loft's hall
    K.flight(m, 2, 36, 28, '+x', 4);     // Bin Steps: upper hall up to the bin floor
    K.flight(m, 2, 44, 41, '+z', 4);     // Hoist Steps: sack hoist room up to the lookout loft
    m.cellar('e', 44);                    // the race gate: down from the race into the cellar
    m.shutterZ(1, 60, 38, 14);            // the loading bay's roll-up door
    // THE WHEEL PIT: the 1F and 2F floors open over the pit, railed, a nine-metre shaft; the great
    // oak wheel stands in it against the east wall, its axle running west at head height through
    // the wall into the millstone floor, where a crown gear turns the stones
    K.atrium(m, 1, 46, 5, 55, 19);
    K.atrium(m, 2, 46, 5, 55, 19);
    const HUB = 21, R = 7;                // building height of the hub (the cellar floor is 0), radius
    const at = (y, lx0, lz0, lx1, lz1, mm) => m.box(0, lx0, lz0, lx1, lz1, y - 1, y - 1, mm);
    for (let i = 0; i < 56; i++) {
      const a = i / 56 * Math.PI * 2, z = 12 + Math.round(Math.cos(a) * R), y = HUB + Math.round(Math.sin(a) * R);
      at(y, 53, z, 54, z, M.MR_OAK);
      if (i % 7 === 0) { const z2 = 12 + Math.round(Math.cos(a) * (R + 1)), y2 = HUB + Math.round(Math.sin(a) * (R + 1)); at(y2, 52, z2, 55, z2, M.MR_OAK); }   // paddles
    }
    for (let i = 0; i < 8; i++) {          // spokes
      const a = i / 8 * Math.PI * 2;
      for (let r = 1; r < R; r++) at(HUB + Math.round(Math.sin(a) * r), 53, 12 + Math.round(Math.cos(a) * r), 54, 12 + Math.round(Math.cos(a) * r), M.MR_OAK);
    }
    m.box(0, 52, 11, 55, 13, HUB - 2, HUB, M.METAL);        // the hub
    m.box(0, 30, 11, 58, 12, HUB - 1, HUB, M.MR_OAK);       // the axle, through the wall to the gear
    for (let i = 0; i < 40; i++) {                          // the crown gear in the millstone floor
      const a = i / 40 * Math.PI * 2;
      at(HUB + Math.round(Math.sin(a) * 4), 31, 12 + Math.round(Math.cos(a) * 4), 32, 12 + Math.round(Math.cos(a) * 4), M.MR_OAK);
    }
    // the millstones: two pairs of stones on timber vats, hoppers over them from the loft
    for (const [x, z] of [[24, 6], [24, 18]]) {
      disc(m, 1, x, z, 4, 0, 2, M.MR_OAK); disc(m, 1, x, z, 3, 3, 4, M.MR_MILLSTONE);
      m.box(1, x - 1, z - 1, x + 1, z + 1, 8, 10, M.MR_OAK);
    }
    for (const x of [22, 30, 38]) m.box(1, x, 1, x, 23, 10, 10, M.MR_OAK);   // beams
    // the loading bay: sacks on pallets and a hand cart
    for (const [x, z] of [[36, 52], [44, 54], [52, 50]]) { m.box(1, x, z, x + 4, z + 3, 0, 0, M.WOOD); m.box(1, x, z, x + 4, z + 3, 1, 3, M.SANDBAG); }
    m.box(1, 50, 40, 54, 42, 0, 2, M.MR_OAK);
    // the stone loft above the millstones: hopper bins on legs
    for (const z of [5, 17]) { m.box(2, 22, z - 2, 26, z + 2, 3, 8, M.MR_OAK); for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) m.box(2, 22 + dx, z - 2 + dz, 22 + dx, z - 2 + dz, 0, 2, M.MR_OAK); }

    // ---- MACHINE SHED: parts cellar and inspection pit, a double-height shop under a loft
    K.plan(t, 0, `
      0-24: Parts Cellar 30 | Inspection Pit 59
      24-47: Oil Store 22 | Shed Cellar Hall 59`);
    K.plan(t, 1, `
      0-30: Machine Shop~ 59
      30-47: Paint Booth 18 | Shed Hall 59`);
    K.plan(t, 2, `
      0-30: Shop Loft~ 59
      30-47: Tool Loft 18 | Loft Hall 59`);
    K.flight(t, 0, 30, 34, '+x', 4);     // cellar hall up to the shed hall
    K.flight(t, 1, 26, 41, '+x', 4);     // shed hall up to the loft hall
    K.atrium(t, 2, 4, 4, 55, 20);         // the shop is open to the roof; the loft runs round it
    t.shutterZ(1, 0, 22, 16);             // the roll-up door to the yard
    // the shop: a tractor in for repair, benches along the walls, an engine hoist, tyres, drums
    t.box(1, 30, 8, 42, 15, 1, 5, M.MR_TRACTOR); t.box(1, 30, 9, 35, 14, 6, 9, M.MR_TRACTOR); t.box(1, 31, 10, 34, 13, 9, 9, M.GLASS);
    for (const [x, z] of [[29, 7], [29, 16], [40, 7], [40, 16]]) t.box(1, x, z, x + 3, z, 0, 3, M.TIRE);
    for (const x of [6, 18, 48]) { t.box(1, x, 24, x + 8, 27, 0, 3, M.METAL); t.box(1, x, 27, x + 8, 27, 4, 7, M.TRIM); }
    t.box(1, 14, 6, 14, 14, 0, 10, M.METAL); t.box(1, 20, 6, 20, 14, 0, 10, M.METAL); t.box(1, 14, 10, 20, 10, 10, 10, M.METAL);
    for (const [x, z] of [[50, 6], [53, 6], [50, 9]]) t.box(1, x, z, x + 1, z + 1, 0, 3, M.RUST);
    for (const x of [12, 24, 36, 48]) t.box(2, x, 4, x, 20, 9, 9, M.MR_OAK);   // roof trusses over the shop
    // the inspection pit: a sunken bay with a lift ramp
    t.box(0, 36, 6, 52, 8, 0, 2, M.CONCRETE); t.box(0, 36, 16, 52, 18, 0, 2, M.CONCRETE);

    // ---- TUNNELS and the PUMP HOUSE
    K.plan(u, 0, `0-14: Mill Tunnel 36`, true);
    K.plan(c, 0, `0-12: Cellar Tunnel 32`, true);
    for (let z = 4; z <= 32; z += 7) { u.box(0, 1, z, 1, z, 0, 10, M.MR_OAK); u.box(0, 13, z, 13, z, 0, 10, M.MR_OAK); u.box(0, 1, z, 13, z, 10, 10, M.MR_OAK); }
    for (let z = 4; z <= 28; z += 6) { c.box(0, 1, z, 1, z, 0, 10, M.MR_OAK); c.box(0, 11, z, 11, z, 0, 10, M.MR_OAK); c.box(0, 1, z, 11, z, 10, 10, M.MR_OAK); }
    K.plan(p, 1, `0-23: Pump House 23`);

    K.finish({ hatch: 3, cams: 10, ext: { p: 0.55 } });

    // ---- OUTSIDE
    // the farmhouse porch: a deck one step up, posts, a roof level with the bedroom floor
    B.obox(60, 92, 148, 99, 0, 0, M.WOOD);
    for (let x = 62; x <= 146; x += 12) B.obox(x, 92, x, 92, 1, 10, M.WOOD);
    B.obox(59, 91, 148, 99, 11, 11, M.ROOF);
    // the chicken coop and its run
    B.obox(26, 116, 42, 128, 0, 5, M.WOOD); B.obox(25, 115, 43, 129, 6, 6, M.CORRUGATE); B.obox(32, 128, 35, 128, 0, 3, 0);
    B.fence(24, 130, 44, 130, M.WOOD, 3); B.fence(24, 130, 24, 146, M.WOOD, 3); B.fence(44, 130, 44, 146, M.WOOD, 3);
    // the hay shed: an open pole barn stacked with bales between the shed and the mill
    for (let x = 116; x <= 168; x += 13) for (const z of [204, 238]) B.obox(x, z, x + 1, z + 1, 0, 15, M.WOOD);
    B.obox(114, 202, 170, 240, 16, 16, M.CORRUGATE);
    for (const [x, z, hh] of [[120, 208, 3], [120, 214, 7], [134, 208, 3], [146, 220, 7], [158, 210, 3], [128, 228, 3], [150, 230, 7], [162, 226, 3], [138, 220, 3]]) B.obox(x, z, x + 7, z + 4, 0, hh, M.HAY);
    B.obox(140, 232, 148, 236, 1, 4, M.RED_PAINT); for (const [x, z] of [[140, 231], [147, 231], [140, 237], [147, 237]]) B.obox(x, z, x, z, 0, 1, M.TIRE);
    // the silos by the mill track, the race and its footbridge, the pump house's wind pump
    B.drum(244, 178, 7, 0, 32, M.CORRUGATE); B.drum(244, 178, 6, 33, 34, M.METAL);
    B.drum(262, 176, 6, 0, 26, M.CORRUGATE); B.drum(262, 176, 5, 27, 28, M.METAL);
    B.surf(268, 140, 277, 291, M.WATER);
    B.obox(267, 222, 278, 225, 0, 0, M.WOOD); B.obox(267, 221, 278, 221, 1, 3, M.RAIL); B.obox(267, 226, 278, 226, 1, 3, M.RAIL);
    for (const [x, z] of [[312, 210], [316, 210], [312, 214], [316, 214]]) B.obox(x, z, x, z, 0, 28, M.METAL);
    B.obox(311, 209, 317, 215, 29, 29, M.METAL); B.obox(313, 211, 315, 213, 30, 34, M.METAL);
    // vehicles and yard clutter: cover in the open
    B.truck(124, 66, 'x', M.CAR_R);
    B.obox(104, 176, 114, 182, 0, 4, M.MR_TRACTOR); B.obox(104, 175, 106, 183, 0, 3, M.TIRE); B.obox(112, 175, 114, 183, 0, 3, M.TIRE);
    B.drum(186, 172, 3, 0, 4, M.RUST);
    for (const [x, z] of [[150, 176], [160, 184], [226, 112], [232, 138], [176, 244]]) { B.obox(x, z, x + 3, z + 3, 0, 3, M.CRATE); B.obox(x + 4, z, x + 6, z + 3, 0, 5, M.CRATE); }
    B.obox(160, 168, 172, 170, 0, 2, M.METAL);    // a water trough
    for (const z of [40, 60, 80]) B.lamp(178, z, 14);
    // fences: the paddock east of the store, the lane along the orchard
    B.fence(230, 64, 318, 64, M.WOOD, 4); B.fence(318, 64, 318, 150, M.WOOD, 4); B.fence(230, 150, 318, 150, M.WOOD, 4);
    B.fence(52, 36, 52, 92, M.WOOD, 4);
    // corn rows to the south, along the way in (so walking north through them is open)
    for (let x = 102; x <= 200; x += 5) B.obox(x, 268, x + 1, 289, 0, 6, M.MR_CORN);
    // the orchard to the west, a tree line round everything else
    for (let z = 40; z <= 180; z += 13) for (let x = 6; x <= 46; x += 11) if (!(z > 110 && z < 150 && x > 20)) B.tree(x + (z % 2) * 3, z, 9 + ((x + z) % 5));
    K.scatter(22, 16, (x, z, hh) => {
      if (z < 34 || (x > 140 && x < 236 && z < 96) || (x > 96 && x < 204 && z > 262) || (x < 52 && z < 190) || (x > 264 && x < 280)) return;
      if (hh < 0.45) B.tree(x, z, 11 + Math.floor(hh * 14)); else if (hh < 0.55) B.obox(x, z, x + 5, z + 3, 0, 3, M.HAY);
    });

    K.spawns('County Road', 'Corn Rows', 'Mill Pond', 'Orchard');
    B.meta.bombs = [['Boiler Room', 'Canning Room'], ['Stock Room', 'Fertilizer Store'], ['Farm Kitchen', 'Dining Room'], ['Showroom', 'Seed Room'],
      ['Millstone Floor', 'Miller Office'], ['Kids Bedroom', 'Guest Bedroom'], ['Stone Loft', 'Hopper Room']];
    B.meta.secure = ['Living Room', 'Sales Floor', 'Machine Shop', 'Bagging Room', 'Owners Suite'];
    B.meta.hostage = ['Storm Shelter', 'Nursery', 'Records Room', 'Bolting Room', 'Parts Cellar'];
    B.meta.defSpawns = ['Den', 'Ledger Office', 'Sack Store'];
    return B;
  }
  define({ id: 'millrace', name: 'MILLRACE', fn: millrace, blurb: 'Farmhouse, feed store & stone grist mill · overcast morning', cover: 'haywall', tint: 'rgba(110,130,90,0.36)' });
})();
