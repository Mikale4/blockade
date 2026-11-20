/* cityz-zones.js -- City Z: building the places. Each location in CZ.ZONES is a block of the city,
   90 x 90 m: two roads crossing it (its ways out at their four ends), and buildings in the four
   corners built from the templates below with the map kit (js/maps-kit.js), so every room has a name,
   doors, windows and furniture. A location builds the same every time; what you change in it is kept
   by cityz.js and put back when you return.

   MAPS.build('cz_<zone>') builds one (no stretch, no attacker spawns). */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const K = MAPS.KIT;
  const CZ = window.CZ;
  const GY = MAPS.GY, VS = 0.25;
  const SIZE = 360, ROAD0 = 170, ROAD1 = 190;
  mat('CZ_GRIME', 0x6a6458, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'brick', wall: true });
  mat('CZ_BLOOD', 0x5a1a16, { pat: 'noise' });
  mat('CZ_BURNT', 0x2a2624, { pat: 'noise' });
  mat('CZ_ROT', 0x6a7a4a, { hp: 1, pen: 0.95, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('CZ_SIGNAL', 0xd84a2a, { glow: true });
  mat('CZ_FIREBRICK', 0xa8301f, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'brick', wall: true });
  mat('CZ_SIGNLIT', 0xffe6a0, { glow: true });
  /* lit letters on a wall: a 3 x 5 pixel font, reading left to right along +x (or +z), on the plane z (or x) */
  const FONT = { E: ['111', '100', '110', '100', '111'], N: ['101', '111', '111', '111', '101'], G: ['111', '100', '101', '101', '111'], I: ['111', '010', '010', '010', '111'], '9': ['111', '101', '111', '001', '111'], ' ': ['000', '000', '000', '000', '000'] };
  function voxText(B, x0, y0, z0, text, m) {
    let x = x0;
    for (const ch of text) { const g = FONT[ch] || FONT[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') B.w.fill(x + c, y0 + 4 - r, z0, x + c, y0 + 4 - r, z0, m); x += 4; }
  }

  /* ------------------------------------------------------------ templates */
  /* w x d voxels, levels lo..hi, a plan per level (K.plan text: {A} {B} {C} are the template's names),
     stairwells [name, lx, lz, lo, hi], an atrium [L, x0, z0, x1, z1] and flights, then extras */
  const T = {
    house: { w: 49, d: 49, lo: 1, hi: 2, ext: M.BRICK, pal: [M.DRY_BEIGE, M.DRY_SAGE, M.PLASTER, M.DRY_BLUE],
      plan: { 1: '0-24: Kitchen 18 | - 30 | Dining Room 48\n24-48: Living Room 30 | Utility Room 48', 2: '0-24: Bedroom 18 | - 30 | Bathroom 48\n24-48: Main Bedroom 30 | Nursery 48' },
      wells: [['Stairs', 18, 0, 1, 2]] },
    shops: { w: 97, d: 49, lo: 1, hi: 2, ext: M.BRICK, pal: [M.DRY_WHITE, M.DRY_BEIGE, M.DRY_GREY, M.PLASTER], names: ['Corner Shop', 'Hardware Store', 'Newsagent'],
      plan: { 1: '0-24: {A} 30 | Stock Room 42 | - 54 | {B} 96\n24-48: {C} 48 | Back Office 72 | Store Room 96', 2: '0-24: Flat Kitchen 30 | Flat Lounge 42 | - 54 | Bedroom 96\n24-48: Bathroom 30 | Landing 54 | Spare Bedroom 96' },
      wells: [['Back Stairs', 42, 0, 1, 2]] },
    firehouse: { w: 73, d: 73, lo: 1, hi: 2, ext: M.CZ_FIREBRICK, pal: [M.DRY_RED, M.DRY_WHITE, M.BRICK],
      plan: { 1: '0-24: Watch Room 30 | - 42 | Gear Room 72\n24-72: Apparatus Bay~ 48 | Workshop 72', 2: "0-24: Captain's Office 30 | - 42 | Bunk Room 72\n24-48: Kitchen 36 | Day Room 72\n48-72: Locker Room 36 | Showers 72" },
      wells: [['Stairs', 30, 0, 1, 2]],
      extra: (B, b) => {
        // the engine in its bay; two big bay doors onto the street; ENGINE 9 lit over them; a hose
        // tower on the corner with a beacon; a painted apron out front
        b.box(1, 8, 36, 20, 64, 0, 7, M.RED_PAINT); b.box(1, 9, 37, 19, 42, 4, 6, M.GLASS); b.box(1, 6, 38, 6, 40, 0, 1, M.TIRE);
        b.open(1, 'z', 72, 4, 18, 0, 10, 'door'); b.open(1, 'z', 72, 26, 18, 0, 10, 'door');
        B.w.fill(b.X(2), 13 + 11, b.Z(73), b.X(46), 13 + 11, b.Z(73), M.CZ_SIGNAL);
        voxText(B, b.X(8), 13 + 13, b.Z(73), 'ENGINE 9', M.CZ_SIGNLIT);
        B.w.fill(b.X(60), 37, b.Z(1), b.X(68), 54, b.Z(9), M.CZ_FIREBRICK);
        B.w.fill(b.X(61), 50, b.Z(1), b.X(67), 52, b.Z(1), M.GLASS); B.w.fill(b.X(61), 50, b.Z(9), b.X(67), 52, b.Z(9), M.GLASS);
        B.w.fill(b.X(63), 55, b.Z(4), b.X(65), 56, b.Z(6), M.CZ_SIGNAL);
        B.w.fill(b.X(0), 12, b.Z(73), b.X(50), 12, b.Z(96), M.CONCRETE);
        for (const x of [2, 24, 46]) B.w.fill(b.X(x), 12, b.Z(73), b.X(x + 1), 12, b.Z(96), M.LINE);
      } },
    school: { w: 121, d: 97, lo: 1, hi: 2, ext: M.BRICK, pal: [M.DRY_BEIGE, M.DRY_WHITE, M.DRY_BLUE, M.DRY_SAGE],
      plan: { 1: "0-24: Classroom 1A 30 | Classroom 1B 54 | - 66 | Nurse's Office 96 | Principal's Office 120\n24-72: Main Hall 24 | Gymnasium~ 84 | Changing Rooms 120\n72-96: Cafeteria 30 | Kitchen 54 | - 66 | Library 96 | Staff Room 120",
        2: '0-24: Classroom 2A 30 | Classroom 2B 54 | - 66 | Science Lab 96 | Art Room 120\n24-72: Upper Hall 24 | Gym Gallery~ 84 | Music Room 120\n72-96: Classroom 2C 30 | Computer Room 54 | - 66 | Records Office 96 | Store Cupboard 120' },
      wells: [['West Stairs', 54, 0, 1, 2], ['East Stairs', 54, 72, 1, 2]], atrium: [2, 30, 32, 78, 64],
      extra: (B, b) => { for (let x = 30; x < 78; x += 8) b.box(1, x, 34, x + 4, 62, 0, 0, M.FELT); for (let i = 0; i < 3; i++) b.box(1, 80 - i * 0, 30, 82, 66, i, i, M.WOOD); } },
    hospital: { w: 121, d: 97, lo: 0, hi: 3, ext: M.FACADE, pal: [M.XP_WARD || M.DRY_WHITE, M.DRY_WHITE, M.DRY_SAGE, M.DRY_BLUE],
      plan: { 0: '0-24: Morgue 30 | Pathology Lab 54 | - 66 | Pharmacy Store 96 | Linen Store 120\n24-72: Basement Corridor 60 | Boiler Room 90 | Generator Room 120\n72-96: Hospital Kitchen 30 | Supply Store 54 | - 66 | Records Store 96 | Workshop 120',
        1: '0-24: Triage 30 | Resus Room 54 | - 66 | Waiting Room 96 | Reception 120\n24-72: Emergency Hall 60 | Ambulance Bay 90 | X-Ray 120\n72-96: Minor Injuries 30 | Pharmacy 54 | - 66 | Security Room 96 | Cafe 120',
        2: '0-24: Ward A 30 | Nurses Station 54 | - 66 | Ward B 96 | Day Room 120\n24-72: Ward Corridor 60 | Isolation Ward 90 | Sluice Room 120\n72-96: Ward C 30 | Treatment Room 54 | - 66 | Ward D 96 | Relatives Room 120',
        3: "0-24: Operating Theatre 30 | Scrub Room 54 | - 66 | Research Lab 96 | Cold Room 120\n24-72: Theatre Corridor 60 | Intensive Care 90 | Doctors Office 120\n72-96: Recovery 30 | Sterile Store 54 | - 66 | Lab Office 96 | Chapel 120" },
      wells: [['West Stairs', 54, 0, 0, 3], ['East Stairs', 54, 72, 0, 3]] },
    mall: { w: 121, d: 97, lo: 1, hi: 2, ext: M.FACADE, pal: [M.XP_SHOPFRONT || M.DRY_WHITE, M.DRY_WHITE, M.DRY_BEIGE, M.DRY_GREY],
      plan: { 1: '0-24: Fashion Store 30 | Shoe Store 54 | - 66 | Electronics Store 96 | Pharmacy 120\n24-72: West Concourse 20 | Galleria Court~ 100 | East Concourse 120\n72-96: Toy Store 30 | Bookshop 54 | - 66 | Supermarket 96 | Hardware Store 120',
        2: '0-24: Department Store 30 | Sports Store 54 | - 66 | Cinema Lobby 96 | Arcade 120\n24-72: Upper West Mall 20 | Food Court~ 100 | Upper East Mall 120\n72-96: Diner 30 | Coffee Shop 54 | - 66 | Security Office 96 | Mall Office 120' },
      wells: [['West Stairs', 54, 0, 1, 2], ['East Stairs', 54, 72, 1, 2]], atrium: [2, 30, 34, 90, 62], flights: [[1, 22, 66, '-z', 5], [1, 94, 30, '+z', 5]] },
    station: { w: 121, d: 97, lo: 0, hi: 1, ext: M.STONE, pal: [M.XP_METRO_TILE || M.DRY_WHITE, M.DRY_WHITE, M.DRY_GREY],
      plan: { 0: '0-24: Ticket Office 30 | Staff Room 54 | - 66 | Signal Room 96 | Plant Room 120\n24-40: Concourse 120\n40-72: Platform Hall~ 120\n72-96: Cable Store 30 | Maintenance Shop 54 | - 66 | Lost Property 96 | Pump Room 120',
        1: '0-24: Station Entrance 30 | Newsagent 54 | - 66 | Cafe 96 | Police Office 120\n24-72: Booking Hall~ 120\n72-96: Waiting Room 30 | Bike Store 54 | - 66 | Station Office 96 | Toilets 120' },
      wells: [['West Stairs', 54, 0, 0, 1], ['East Stairs', 54, 72, 0, 1]], atrium: [1, 24, 26, 96, 38], flights: [[0, 4, 30, '+x', 5], [0, 116, 30, '-x', 5]],
      extra: (B, b) => {
        B.w.fill(b.X(1), 0, b.Z(51), b.X(119), 0, b.Z(61), M.GRAVEL); for (const z of [53, 59]) B.w.fill(b.X(1), 0, b.Z(z), b.X(119), 0, b.Z(z), M.RAIL);
        // a train stopped at the platform, doors open: a long box you can walk through
        const x0 = b.X(20), x1 = b.X(100), z0 = b.Z(52), z1 = b.Z(60);
        B.w.fill(x0, 1, z0, x1, 10, z1, M.METAL); B.w.fill(x0 + 1, 2, z0 + 1, x1 - 1, 9, z1 - 1, 0); B.w.fill(x0 + 1, 1, z0 + 1, x1 - 1, 1, z1 - 1, M.FAB_BLUE);
        for (let x = x0 + 6; x < x1 - 4; x += 14) { B.w.fill(x, 2, z0, x + 3, 8, z0, 0); B.w.fill(x, 2, z1, x + 3, 8, z1, 0); }
        for (let x = x0 + 2; x < x1 - 2; x += 5) { B.w.fill(x, 5, z0, x + 2, 7, z0, M.GLASS); B.w.fill(x, 5, z1, x + 2, 7, z1, M.GLASS); }
      } },
    warehouse: { w: 97, d: 73, lo: 1, hi: 1, ext: M.CORRUGATE, pal: [M.DRY_GREY, M.CORRUGATE],
      plan: { 1: "0-24: Dispatch Office 30 | Break Room 54 | Washroom 72 | Foreman's Office 96\n24-72: Warehouse Floor~ 96" },
      extra: (B, b) => { for (let z = 32; z <= 62; z += 10) { b.box(1, 8, z, 40, z + 2, 0, 9, M.METAL); b.box(1, 56, z, 88, z + 2, 0, 9, M.METAL); for (let x = 9; x < 40; x += 6) b.box(1, x, z, x + 3, z + 2, 1, 3, M.CRATE); } } },
    depot: { w: 97, d: 49, lo: 1, hi: 1, ext: M.CORRUGATE, pal: [M.DRY_GREY, M.DRY_WHITE],
      plan: { 1: '0-24: Service Bay~ 60 | Parts Store 96\n24-48: Fleet Office 30 | Tool Room 60 | Wash Bay 96' },
      extra: (B, b) => { b.box(1, 10, 6, 24, 18, 0, 6, M.CAR_W); b.box(1, 12, 7, 22, 17, 4, 5, M.GLASS); b.box(1, 34, 6, 48, 18, 0, 3, M.RUST); } },
    kiosk: { w: 49, d: 25, lo: 1, hi: 1, ext: M.FACADE, pal: [M.DRY_WHITE, M.DRY_RED],
      plan: { 1: '0-24: Fuel Kiosk 30 | Store Room 48' } },
    farmhouse: { w: 49, d: 49, lo: 1, hi: 2, ext: M.KT_TIMBER || M.WOOD, pal: [M.DRY_BEIGE, M.WOOD, M.PLASTER],
      plan: { 1: '0-24: Farmhouse Kitchen 18 | - 30 | Pantry 48\n24-48: Parlour 30 | Boot Room 48', 2: '0-24: Bedroom 18 | - 30 | Bathroom 48\n24-48: Main Bedroom 30 | Sewing Room 48' },
      wells: [['Stairs', 18, 0, 1, 2]] },
    barn: { w: 73, d: 49, lo: 1, hi: 1, ext: M.HS_BARN || M.WOOD, pal: [M.WOOD],
      plan: { 1: '0-48: Barn Floor~ 48 | Tack Room 72' },
      extra: (B, b) => { for (const [x, z] of [[6, 6], [6, 30], [30, 8], [20, 36]]) b.box(1, x, z, x + 6, z + 4, 0, 4, M.HAY); } },
    barracks: { w: 97, d: 49, lo: 1, hi: 2, ext: M.CONCRETE, pal: [M.DRY_SAGE, M.DRY_GREY],
      plan: { 1: '0-24: Barracks Room A 30 | Armoury 42 | - 54 | Barracks Room B 96\n24-48: Mess Hall 54 | Ablutions 72 | Quartermaster 96', 2: '0-24: Barracks Room C 30 | Kit Store 42 | - 54 | Barracks Room D 96\n24-48: NCO Office 30 | Day Room 72 | Radio Room 96' },
      wells: [['Stairs', 42, 0, 1, 2]] },
    command: { w: 73, d: 49, lo: 1, hi: 2, ext: M.CONCRETE, pal: [M.DRY_GREY, M.DRY_SAGE],
      plan: { 1: '0-24: Ops Room 30 | - 42 | Briefing Room 72\n24-48: Signals Office 36 | Duty Office 72', 2: "0-24: Commander's Office 30 | - 42 | Intelligence Office 72\n24-48: Comms Room 36 | Map Room 72" },
      wells: [['Stairs', 30, 0, 1, 2]] },
    fieldhosp: { w: 73, d: 49, lo: 1, hi: 1, ext: M.FAB_BLUE || M.CONCRETE, pal: [M.DRY_WHITE, M.DRY_SAGE],
      plan: { 1: '0-24: Triage Tent 36 | Field Pharmacy 72\n24-48: Isolation Bay 36 | Decon Room 72' } },
    motel: { w: 121, d: 49, lo: 1, hi: 2, ext: M.STUCCO || M.FACADE, pal: [M.DRY_BEIGE, M.DRY_SAGE, M.DRY_RED],
      plan: { 1: '0-24: Motel Office 24 | Guest Bedroom 101 42 | - 54 | Guest Bedroom 102 72 | Guest Bedroom 103 96 | Laundry 120\n24-48: Guest Bedroom 104 24 | Guest Bedroom 105 48 | Ice Machine Room 72 | Guest Bedroom 106 96 | Guest Bedroom 107 120',
        2: '0-24: Guest Bedroom 201 24 | Guest Bedroom 202 42 | - 54 | Guest Bedroom 203 72 | Guest Bedroom 204 96 | Guest Bedroom 205 120\n24-48: Guest Bedroom 206 24 | Guest Bedroom 207 48 | Linen Room 72 | Guest Bedroom 208 96 | Guest Bedroom 209 120' },
      wells: [['Stairs', 42, 0, 1, 2]] },
    truckstop: { w: 73, d: 49, lo: 1, hi: 1, ext: M.SIDING || M.FACADE, pal: [M.DRY_WHITE, M.DRY_RED],
      plan: { 1: "0-24: Truckers Diner 36 | Diner Kitchen 72\n24-48: Shop Floor 36 | Showers 54 | Manager's Office 72" } },
  };

  /* ------------------------------------------------------------ layouts */
  /* [template, x, z, names] in world voxels. The roads run x 170-190 and z 170-190 */
  const L = {
    suburb: [['firehouse', 40, 40], ['house', 214, 28], ['house', 284, 28], ['house', 214, 96], ['house', 30, 214], ['house', 100, 214], ['shops', 216, 216, ['Corner Shop', 'Hardware Store', 'Laundrette']], ['house', 240, 286]],
    town: [['shops', 30, 30, ['Pharmacy', 'Hardware Store', 'Newsagent']], ['shops', 220, 30, ['Diner', 'Bakery', 'Liquor Store']], ['house', 60, 98], ['house', 240, 98], ['shops', 30, 220, ['Grocery', 'Butcher', 'Laundrette']], ['shops', 220, 220, ['Bank Office', 'Police Office', 'Clinic']], ['house', 70, 290], ['house', 260, 290]],
    school: [['school', 20, 30], ['shops', 216, 34, ['Corner Shop', 'Barber Shop', 'Takeaway']], ['house', 230, 100], ['depot', 30, 226, null, 'BUS DEPOT'], ['house', 220, 220], ['house', 290, 220], ['house', 250, 290]],
    hospital: [['hospital', 22, 36], ['shops', 214, 36, ['Pharmacy', 'Medical Supplies', 'Florist']], ['house', 40, 226], ['house', 106, 226], ['depot', 214, 226, null, 'AMBULANCE DEPOT'], ['house', 250, 296]],
    mall: [['mall', 22, 30], ['shops', 214, 36, ['Supermarket', 'Electronics Store', 'Fashion Store']], ['warehouse', 214, 214], ['kiosk', 40, 300]],
    subway: [['station', 24, 38], ['shops', 214, 36, ['Newsagent', 'Cafe', 'Pharmacy']], ['shops', 214, 220, ['Pawn Shop', 'Hardware Store', 'Takeaway']], ['house', 36, 226], ['house', 104, 226]],
    industrial: [['warehouse', 30, 36], ['warehouse', 214, 36], ['depot', 30, 226], ['depot', 30, 290], ['kiosk', 250, 250]],
    farm: [['farmhouse', 60, 50], ['barn', 216, 40], ['barn', 216, 230], ['kiosk', 70, 250, null, 'FARM SHOP']],
    military: [['barracks', 30, 40], ['command', 226, 40], ['fieldhosp', 30, 226], ['warehouse', 214, 214]],
    highway: [['motel', 20, 220], ['truckstop', 220, 230], ['kiosk', 280, 300]],
  };

  /* ------------------------------------------------------------ the build */
  function build(zid) {
    const Z = CZ.ZONES[zid], kind = Z.kind;
    const B = new MAPS.Builder('cz_' + zid, Z.name, SIZE, 64, SIZE);
    K.begin(B);
    B.meta.desc = Z.desc; B.meta.cz = zid;
    B.theme({ sky: [0x5a6a7a, 0xc8c8c0], fog: 0x9a9a92, fogFar: 120, lightOut: [0.86, 0.86, 0.84], lightIn: [0.8, 0.78, 0.72], sun: 0xf0e8d8, outer: 0x5a5a52 });
    const farm = kind === 'farm';
    B.ground(farm ? M.GRASS : kind === 'military' ? M.GRAVEL : M.CONC_DARK, M.DIRT);
    // the roads: a cross, kerbs and a broken centre line; the farm has a dirt track
    const road = farm ? M.DIRT : M.ASPHALT;
    B.surf(ROAD0, 0, ROAD1, SIZE - 1, road); B.surf(0, ROAD0, SIZE - 1, ROAD1, road);
    if (!farm) {
      for (let i = 0; i < SIZE; i += 12) { B.surf(179, i, 180, i + 5, M.LINE); B.surf(i, 179, i + 5, 180, M.LINE); }
      for (const v of [ROAD0 - 1, ROAD1 + 1]) { B.surf(v, 0, v, SIZE - 1, M.CONCRETE); B.surf(0, v, SIZE - 1, v, M.CONCRETE); }
    }
    // buildings
    const bs = [];
    // the houses and shop rows are each faced differently (brick, siding, render), so a street isn't one wall repeated
    const FACES = [M.BRICK, M.SIDING || M.WOOD, M.STUCCO || M.PLASTER, M.CZ_GRIME, M.MR_SIDING || M.WOOD, M.RDH_CINDER || M.CONCRETE].filter(Boolean);
    for (const [tid, x, z, names] of L[kind]) {
      const t = T[tid];
      const ext = (tid === 'house' || tid === 'shops') ? FACES[Math.floor(U.hash3(x, 5, z) * FACES.length)] : t.ext;
      const b = B.building(x, z, t.w, t.d, { lo: t.lo, hi: t.hi, ext, inner: t.pal[0], slab: M.CONCRETE, roof: M.ROOF, parapet: ext });
      b.pal = t.pal.filter(Boolean); b.pillar = M.CONCRETE; b.tid = tid; b.names = names || t.names || [];
      bs.push(b);
    }
    K.shells(B);
    for (const b of bs) {
      const t = T[b.tid], nm = b.names;
      for (const lv of Object.keys(t.plan)) K.plan(b, +lv, t.plan[lv].replace('{A}', nm[0] || 'Shop').replace('{B}', nm[1] || 'Store').replace('{C}', nm[2] || 'Shop'));
      for (const w of t.wells || []) K.well(b, w[0], w[1], w[2], 'z', w[3], w[4]);
      if (t.atrium) K.atrium(b, ...t.atrium);
      for (const f of t.flights || []) K.flight(b, ...f);
      if (t.extra) t.extra(B, b);
    }
    // the place itself: what was left in the street
    dress(B, kind, zid);
    K.finish({ hatch: 0, cams: -1 });
    // ways out: the four ends of the roads
    B.meta.exits = [{ side: 'N', x: 180, z: 4 }, { side: 'S', x: 180, z: SIZE - 5 }, { side: 'W', x: 4, z: 180 }, { side: 'E', x: SIZE - 5, z: 180 }].map(e => ({ side: e.side, x: (e.x + 0.5) * VS, y: (GY + 1) * VS, z: (e.z + 0.5) * VS }));
    return B;
  }

  /* abandoned cars, barricades, the dead, fires burnt out: different for each kind of place */
  function dress(B, kind, zid) {
    const h = (a, b) => U.hash3(a, b, zid.length * 7 + zid.charCodeAt(0));
    const carM = [M.CAR_K, M.CAR_W, M.CAR_R, M.CZ_BURNT];
    // cars along the roads, some across them
    for (let i = 0; i < 9; i++) {
      const along = h(i, 1) < 0.5, t = 6 + h(i, 2) * (SIZE - 30);
      const x = along ? Math.round(t) : (h(i, 3) < 0.5 ? 172 : 182), z = along ? (h(i, 3) < 0.5 ? 172 : 182) : Math.round(t);
      if (Math.abs(x - 180) < 24 && Math.abs(z - 180) < 24) continue;
      if (kind === 'farm' && i > 3) break;
      B.car(along ? x : x, along ? z : z, along ? 'x' : 'z', carM[Math.floor(h(i, 4) * carM.length)]);
    }
    // bodies of the dead (dark patches), litter
    for (let i = 0; i < 18; i++) { const x = Math.round(8 + h(i, 5) * (SIZE - 16)), z = Math.round(8 + h(i, 6) * (SIZE - 16)); if (B.w.get(x, GY + 1, z)) continue; B.surf(x, z, x + 2, z + 1, i % 3 ? M.CZ_BLOOD : M.CZ_BURNT); }
    // lamps and trees on the corners
    for (const [x, z] of [[160, 160], [196, 160], [160, 196], [196, 196]]) B.lamp(x, z, 16);
    if (kind === 'suburb' || kind === 'school' || kind === 'farm') for (let i = 0; i < 10; i++) { const x = Math.round(10 + h(i, 7) * 340), z = Math.round(10 + h(i, 8) * 340); if (Math.abs(x - 180) < 16 || Math.abs(z - 180) < 16) continue; if (!B.meta.buildings.some(b => x > b.x - 4 && x < b.x1 + 4 && z > b.z - 4 && z < b.z1 + 4)) B.tree(x, z, 14 + Math.floor(h(i, 9) * 8), kind === 'farm'); }
    if (kind === 'military') {
      // the quarantine line: concrete barriers and sandbags across the north road, a gate, a tower
      B.barrier(130, 40, 168, 42); B.barrier(192, 40, 230, 42); B.sandbags(150, 50, 166, 52); B.sandbags(194, 50, 210, 52);
      B.fence(0, 20, 166, 20, M.FENCE, 8); B.fence(194, 20, SIZE - 1, 20, M.FENCE, 8); B.obox(166, 18, 167, 22, 0, 12, M.CONCRETE); B.obox(193, 18, 194, 22, 0, 12, M.CONCRETE); B.obox(166, 20, 194, 20, 11, 12, M.CZ_SIGNAL);
      B.obox(140, 100, 146, 106, 0, 18, M.WOOD); B.obox(138, 98, 148, 108, 19, 19, M.WOOD); B.obox(138, 98, 148, 98, 20, 22, M.SANDBAG);
      for (let i = 0; i < 4; i++) B.container(110 + i * 26, 300, 'x', [M.CONT_G, M.CONT_R][i % 2]);
    }
    if (kind === 'industrial') { for (let i = 0; i < 4; i++) B.container(120 + (i % 2) * 28, 250 + Math.floor(i / 2) * 14, 'x', [M.CONT_B, M.CONT_R, M.CONT_G][i % 3]); B.obox(236, 236, 300, 238, 0, 10, M.PIPE); B.obox(236, 236, 300, 290, 11, 11, M.METAL); for (const [x, z] of [[236, 290], [300, 290]]) B.obox(x, z, x + 1, z + 1, 0, 10, M.PIPE); }
    if (kind === 'farm') {
      for (let x = 20; x < 160; x += 5) for (let z = 210; z < 340; z += 5) if (h(x, z) < 0.7) B.obox(x, z, x, z, 0, 2 + Math.floor(h(z, x) * 3), M.MR_CORN || M.LEAF);
      B.fence(14, 204, 164, 204); B.fence(14, 204, 14, 346);
      for (const [x, z] of [[300, 60], [300, 90]]) B.drum(x, z, 6, 0, 30, M.METAL);
    }
    if (kind === 'mall') for (let i = 0; i < 12; i++) B.car(20 + (i % 6) * 22, 210 + Math.floor(i / 6) * 40, 'z', carM[i % 4]);
    if (kind === 'highway') {
      // the overpass: a deck two storeys up along the north of the block, pillars under it, a stair
      // ramp up at its east end, the evacuation's cars still on it
      B.w.fill(0, 24, 40, SIZE - 1, 24, 84, M.CONCRETE); B.w.fill(0, 25, 40, SIZE - 1, 27, 40, M.CONCRETE); B.w.fill(0, 25, 84, SIZE - 1, 27, 84, M.CONCRETE);
      for (let x = 20; x < SIZE; x += 60) for (const z of [48, 74]) B.w.fill(x, 13, z, x + 3, 23, z + 3, M.CONCRETE);
      for (let i = 0; i < 12; i++) B.w.fill(300 + i, 13, 86, 300 + i, 13 + i, 96, M.CONCRETE);
      B.w.fill(300, 25, 84, 312, 27, 84, 0);
      for (let i = 0; i < 10; i++) { const x = 10 + i * 34, z = 46 + (i % 3) * 12, m = carM[i % 4]; B.w.fill(x, 25, z, x + 16, 27, z + 7, m); B.w.fill(x + 3, 28, z, x + 12, 29, z + 7, M.GLASS); }
    }
  }

  /* ------------------------------------------------------------ MAPS.build */
  const oBuild = MAPS.build;
  MAPS.build = function (id) {
    if (!/^cz_/.test(id)) return oBuild(id);
    const B = build(id.slice(3));
    const meta = B.meta, w = B.w;
    meta.world = w; meta.spawns = []; meta.cams = [];
    meta.buildings = meta.buildings.map(b => ({ x0: b.x, z0: b.z, x1: b.x1, z1: b.z1, lo: b.lo, hi: b.hi, roofY: b.roofY }));
    meta.roomByName = {};
    for (const r of meta.rooms) (meta.roomByName[r.name] = meta.roomByName[r.name] || []).push(r);
    meta.inside = p => { const x = p.x * 4, z = p.z * 4, y = p.y * 4; for (const b of meta.buildings) if (x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1 && y < b.roofY + 1) return true; return false; };
    meta.roomAt = p => { const x = Math.floor(p.x * 4), z = Math.floor(p.z * 4), y = Math.floor(p.y * 4 + 0.2); for (const r of meta.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && y >= r.y - 1 && y <= r.y + 10) return r; return null; };
    meta.bombs = []; meta.secure = []; meta.hostage = [];
    w.computeSky(); w.snapshot();
    return meta;
  };
  CZ.buildZone = build;
  CZ.ZONE_SIZE = SIZE * VS;
})();
