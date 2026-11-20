/* maps-xp2.js -- seasons 15-18 maps, part 2. Each is built round a piece of machinery (js/mapmech.js):
     SKYGATE          an airport terminal: a jet bridge shuttles between gate seven and a parked airliner;
                      baggage belts carry you between the baggage hall and check-in
     DEEPCUT          a colliery: the cage runs the shaft from the mine to the headframe; the old workings'
                      timber props hold up the pithead floor until they don't
     LIFTBRIDGE       a canal basin: the lifting bridge goes up from its control room (and by itself);
                      a footbridge high over the water is the other way across
     BROADCAST HOUSE  a television centre: the lighting desk blacks out the studios; scenery flats run
                      along their tracks and change the studio floor
     COLDSTORE        a data centre in the snow: every data hall has its own gas suppression
     TIMBERLINE       a sawmill: the log carriage runs the saw hall; blasts on the sawdust start fires */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, define } = MAPS;
  const K = MAPS.KIT;
  const SOFTW = { hp: 3, pen: 0.72, xp: true, hb: true, melee: true, wall: true };
  mat('XP_TERMINAL', 0xe4e8ec, SOFTW);
  mat('XP_FUSELAGE', 0xf2f4f6, { pat: 'plates' });
  mat('XP_TAILBLUE', 0x2a5aa8, { pat: 'plates' });
  mat('XP_STUDIO', 0x2a2a30, SOFTW);
  mat('XP_FLAT', 0xc8b89a, { hp: 2, pen: 0.85, xp: true, hb: true, melee: true, pat: 'planks' });
  mat('XP_COLDPANEL', 0xdfe6ec, SOFTW);
  mat('XP_SAWDUST', 0xd8b878, { hp: 1, pen: 0.95, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('XP_LOG', 0x7a5634, { hp: 6, pen: 0.45, xp: true, hb: true, pat: 'grain' });
  const X = (b, lx) => b.X(lx), Z = (b, lz) => b.Z(lz);
  const keep = (b, L, x0, z0, x1, z1) => K.S.keep.push({ L, x0: b.X(x0), z0: b.Z(z0), x1: b.X(x1), z1: b.Z(z1) });

  /* ===================================================================== SKYGATE */
  function skygate() {
    const B = new Builder('skygate', 'SKYGATE', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A regional airport on a bright morning: check-in over the baggage hall, the gates above, and an airliner on stand seven. Its jet bridge shuttles between the gate and the aircraft door; the baggage belts carry anyone who stands on them.';
    B.theme({ sky: [0x4a8ad0, 0xe4eef6], fog: 0xc8d8e4, fogFar: 170, lightOut: [1.0, 0.98, 0.94], lightIn: [0.94, 0.94, 0.9], sun: 0xfff6e4, outer: 0x8a949c });
    B.ground(M.ASPHALT);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.FACADE, inner: M.XP_TERMINAL, slab: M.TILE, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.XP_TERMINAL, M.DRY_WHITE, M.DRY_GREY, M.DRY_BLUE]; b.pillar = M.METAL;
    K.plan(b, 0, `
      0-24: Baggage Office 30 | Lost Baggage 54 | - 66 | Customs Store 96 | Plant Room 120
      24-72: Baggage Hall~ 120
      72-96: Sorting Room 30 | Cargo Office 54 | - 66 | Security Store 96 | Generator Room 120`);
    K.plan(b, 1, `
      0-24: Check-in West 30 | Airline Office 54 | - 66 | Security Search 96 | Police Post 120
      24-72: Check-in Hall~ 120
      72-96: Bureau de Change 30 | Pharmacy 54 | - 66 | Coffee Bar 96 | First Aid 120`);
    K.plan(b, 2, `
      0-24: Duty Free 30 | Bookshop 54 | - 66 | Business Lounge 96 | Lounge Bar 120
      24-72: Airside Hall 24 | Gate Lounge~ 96 | Gate Seven 120
      72-96: Prayer Room 30 | Smoking Room 54 | - 66 | Ops Office 96 | Crew Room 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    K.atrium(b, 2, 32, 32, 88, 64);   // the gate lounge looks down into check-in
    // check-in desks; baggage carousels (a step up, and they carry you)
    for (const x of [30, 70]) b.box(1, x, 28, x + 20, 29, 0, 3, M.COUNTER);
    b.box(0, 30, 40, 90, 42, 0, 0, M.RUST); b.box(0, 30, 54, 90, 56, 0, 0, M.RUST);
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 30), x1: X(b, 90), z0: Z(b, 40), z1: Z(b, 42), y: 2, dx: 1.0, dz: 0 });
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 30), x1: X(b, 90), z0: Z(b, 54), z1: Z(b, 56), y: 2, dx: -1.0, dz: 0 });
    // the belts between the floors: one carries you up into check-in, the other down to the hall
    K.flight(b, 0, 6, 62, '-z', 3); K.flight(b, 0, 112, 34, '+z', 3);
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 6), x1: X(b, 8), z0: Z(b, 50), z1: Z(b, 63), y: 1, dx: 0, dz: -1.2 });
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 112), x1: X(b, 114), z0: Z(b, 33), z1: Z(b, 46), y: 1, dx: 0, dz: -1.2 });
    // gate seven: a doorway in the east wall onto the jet bridge
    b.open(2, 'x', 120, 44, 8, 0, 9, 'gate'); keep(b, 2, 108, 42, 119, 53);
    // the airliner on stand seven, nose north: on its gear, a cabin you can walk through, two doors on the west side
    const px0 = X(b, 156), px1 = X(b, 172), pz0 = Z(b, 6), pz1 = Z(b, 92);
    B.w.fill(px0, 19, pz0, px1, 24, pz1, M.XP_FUSELAGE);
    B.w.fill(px0 + 1, 24, pz0 + 1, px1 - 1, 24, pz1 - 1, M.CARPET2);
    for (const x of [px0, px1]) B.w.fill(x, 25, pz0, x, 34, pz1, M.XP_FUSELAGE);
    for (const z of [pz0, pz1]) B.w.fill(px0, 25, z, px1, 34, z, M.XP_FUSELAGE);
    B.w.fill(px0, 35, pz0, px1, 35, pz1, M.XP_FUSELAGE);
    for (let z = pz0 + 3; z < pz1 - 2; z += 4) for (const x of [px0, px1]) B.w.fill(x, 29, z, x, 30, z + 1, M.GLASS);
    for (let z = pz0 + 6; z < pz1 - 5; z += 4) { if ((z > Z(b, 40) && z < Z(b, 56)) || (z > Z(b, 76) && z < Z(b, 88))) continue; B.w.fill(px0 + 2, 25, z, X(b, 162), 26, z + 1, M.FAB_BLUE); B.w.fill(X(b, 166), 25, z, px1 - 2, 26, z + 1, M.FAB_BLUE); }
    for (const [x, z] of [[px0 + 4, pz0 + 10], [px1 - 4, pz0 + 10], [px0 + 4, pz1 - 24], [px1 - 4, pz1 - 24]]) B.w.fill(x - 1, 13, z - 1, x + 1, 18, z + 1, M.TIRE);
    B.w.fill(X(b, 130), 21, Z(b, 58), px0 - 1, 22, Z(b, 70), M.XP_FUSELAGE); B.w.fill(px1 + 1, 21, Z(b, 58), X(b, 190), 22, Z(b, 70), M.XP_FUSELAGE);   // wings
    for (const x of [X(b, 140), X(b, 182)]) B.w.fill(x - 2, 16, Z(b, 56), x + 2, 20, Z(b, 66), M.METAL);                                                   // engines
    B.w.fill(X(b, 163), 36, pz1 - 10, X(b, 165), 52, pz1, M.XP_TAILBLUE);                                                                                   // the fin
    B.w.fill(px0, 25, Z(b, 44), px0, 33, Z(b, 51), 0);            // forward door (the jet bridge docks here)
    B.w.fill(px0, 25, Z(b, 80), px0, 33, Z(b, 84), 0);            // aft door, airstairs down to the apron
    for (let i = 0; i < 12; i++) B.w.fill(px0 - 1 - i, 13, Z(b, 80), px0 - 1 - i, 24 - i, Z(b, 84), M.METAL);
    // the jet bridge: from the gate door out to the aircraft and back, waiting at each end
    B.meta.mech.push({ kind: 'mover', x0: X(b, 121), x1: X(b, 126), z0: Z(b, 43), z1: Z(b, 52), y: 25, axis: 'x', speed: 1.1, dwell: 7, color: 0x8a9098, pts: [{ x: X(b, 153) }] });
    K.finish({ hatch: 4, cams: 9 });
    // the apron: stand markings, tugs and baggage carts; the landside road
    for (let z = 20; z < 270; z += 30) B.surf(X(b, 134), z, X(b, 134), z + 14, M.LINE);
    K.scatter(26, 16, (x, z, h) => { if (x > X(b, 126) && x < X(b, 205) && z > Z(b, -4) && z < Z(b, 100)) return; if (h < 0.25) B.lamp(x, z, 16); else if (h < 0.4) B.car(x, z, h < 0.33 ? 'x' : 'z', [M.CAR_W, M.CAR_K][Math.floor(h * 30) % 2]); else if (h < 0.5) B.container(x, z, 'x', M.CONT_B); });
    B.spawn('Drop-off Road', 150, 30, 180); B.spawn('Long-stay Car Park', 150, 210, 0); B.spawn('Stand Seven', 282, 236, 45); B.spawn('Fuel Farm Road', 50, 118, -90);
    B.meta.bombs = [['Baggage Office', 'Lost Baggage'], ['Customs Store', 'Plant Room'], ['Check-in West', 'Airline Office'], ['Business Lounge', 'Lounge Bar'], ['Ops Office', 'Crew Room']];
    B.meta.secure = ['Baggage Hall', 'Check-in Hall', 'Gate Lounge', 'Gate Seven'];
    B.meta.hostage = ['Police Post', 'Security Store', 'Duty Free', 'Prayer Room'];
    B.meta.defSpawns = ['Baggage Hall', 'Gate Seven', 'Security Search'];
    return B;
  }
  define({ id: 'skygate', name: 'SKYGATE', fn: skygate, blurb: 'Airport terminal, a jet bridge to an airliner · bright morning', cover: 'shelter', tint: 'rgba(110,150,210,0.36)' });

  /* ===================================================================== DEEPCUT */
  function deepcut() {
    const B = new Builder('deepcut', 'DEEPCUT', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A colliery on a wet evening: the pithead buildings, the headframe over the shaft and the mine level under it all. The cage still runs the shaft; in the old workings, timber props hold up the pithead floor, and if enough of them go the floor comes down.';
    B.theme({ sky: [0x2a2e38, 0x7a7468], fog: 0x4a4a4a, fogFar: 120, lightOut: [0.62, 0.6, 0.6], lightIn: [0.86, 0.78, 0.6], sun: 0xc8b8a0, outer: 0x3a3634 });
    B.ground(M.GRAVEL);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.BRICK });
    K.shells(B);
    b.pillar = M.KT_TIMBER;
    b.pal = [M.STONE, M.KT_SLATE];                // the mine level: rock and slate
    K.plan(b, 0, `
      0-24: Powder Store 30 | Pump Chamber 54 | - 66 | Lamp Room 96 | Refuge Chamber 120
      24-72: Haulage Road 46 | Cage Landing~ 60 | Old Workings~ 90 | Crusher Gallery 120
      72-96: Fan Drift 30 | Fitters Bay 54 | - 66 | Ore Pass 96 | Sump 120`);
    b.pal = [M.DRY_GREY, M.BRICK, M.KT_TIMBER, M.DRY_BEIGE];
    K.plan(b, 1, `
      0-24: Lamp Cabin 30 | Time Office 54 | - 66 | Manager's Office 96 | First Aid Room 120
      24-72: Pithead Hall 46 | Cage Bank~ 60 | Banksman Floor~ 90 | Winding Engine House 120
      72-96: Pithead Baths 30 | Locker Hall 54 | - 66 | Stores 96 | Blacksmith 120`);
    K.plan(b, 2, `
      0-24: Survey Office 30 | Drawing Office 54 | - 66 | Engineer's Office 96 | Control Cabin 120
      24-72: Headframe Gallery 46 | Upper Cage Bank~ 60 | Sheave Deck 90 | Engine Gallery 120
      72-96: Canteen 30 | Kitchen 54 | - 66 | Records Room 96 | Rescue Station 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    // the shaft: a 13 x 13 gap through the pithead floors, the cage in it, gates on its south side
    for (const L of [1, 2]) b.void(L, 47, 29, 59, 41);
    for (const L of [0, 1, 2]) { b.wallZ(L, 28, 46, 60); b.wallZ(L, 42, 46, 60); b.doorZ(L, 42, 51, 4); }
    B.meta.mech.push({ kind: 'lift', x0: X(b, 47), x1: X(b, 59), z0: Z(b, 29), z1: Z(b, 41), stops: [1, 13, 25] });
    // the old workings: six timber props under the banksman's floor, a header beam over each row
    const posts = [];
    for (const lz of [38, 48, 58]) { for (const lx of [68, 82]) { b.box(0, lx, lz, lx, lz, 0, 9, M.KT_TIMBER); posts.push({ x0: X(b, lx), x1: X(b, lx), z0: Z(b, lz), z1: Z(b, lz), y0: 1, y1: 10 }); } b.box(0, 64, lz, 86, lz, 10, 10, M.KT_TIMBER); }
    B.meta.mech.push({ kind: 'props', boxes: posts, x0: X(b, 64), x1: X(b, 86), z0: Z(b, 34), z1: Z(b, 62), y0: 12, y1: 12 });
    // tub rails on the haulage road, a few loaded tubs; the winding engine's drum
    for (const lz of [44, 50]) B.w.fill(X(b, 2), 0, Z(b, lz), X(b, 44), 0, Z(b, lz), M.RAIL);
    for (const lx of [8, 26]) b.box(0, lx, 44, lx + 6, 50, 0, 3, M.RUST);
    B.drum(X(b, 106), Z(b, 48), 7, 0, 0, M.RUST); for (let h = 1; h <= 6; h++) b.box(1, 99, 41 + h, 113, 41 + h, h, h, M.RUST);
    K.finish({ hatch: 3, cams: 8 });
    // the headframe over the shaft, its sheave wheel at the top
    for (const [lx, lz] of [[47, 29], [59, 29], [47, 41], [59, 41]]) B.w.fill(X(b, lx), 37, Z(b, lz), X(b, lx), 55, Z(b, lz), M.RUST);
    B.w.fill(X(b, 47), 55, Z(b, 29), X(b, 59), 55, Z(b, 41), M.RUST); B.w.fill(X(b, 48), 55, Z(b, 30), X(b, 58), 55, Z(b, 40), 0);
    for (let a = 0; a < 360; a += 5) { const r = a * Math.PI / 180; B.w.fill(Math.round(X(b, 53) + 4 * Math.cos(r)), Math.round(59 + 4 * Math.sin(r)), Z(b, 35), Math.round(X(b, 53) + 4 * Math.cos(r)), Math.round(59 + 4 * Math.sin(r)), Z(b, 35), M.RUST); }
    // spoil heaps and the yard
    for (const [x, z] of [[34, 30], [262, 250]]) for (let h = 0; h < 7; h++) B.drum(x, z, 12 - h, h, h, M.DARK);
    K.scatter(26, 16, (x, z, h) => { if (h < 0.22) B.lamp(x, z, 15); else if (h < 0.36) B.truck(x, z, h < 0.3 ? 'x' : 'z', M.CAR_K); else if (h < 0.48) B.obox(x, z, x + 5, z + 8, 0, 3, M.RUST); });
    K.spawns('Colliery Gate', 'Spoil Road', 'Railway Sidings', 'Washery Lane');
    B.meta.bombs = [['Powder Store', 'Pump Chamber'], ['Lamp Room', 'Refuge Chamber'], ['Fan Drift', 'Fitters Bay'], ["Manager's Office", 'First Aid Room'], ['Records Room', 'Rescue Station']];
    B.meta.secure = ['Old Workings', 'Winding Engine House', 'Crusher Gallery', 'Sheave Deck'];
    B.meta.hostage = ['Sump', 'Blacksmith', 'Control Cabin', 'Time Office'];
    B.meta.defSpawns = ['Old Workings', 'Winding Engine House', 'Control Cabin'];
    return B;
  }
  define({ id: 'deepcut', name: 'DEEPCUT', fn: deepcut, blurb: 'Colliery: the cage, the shaft & props that hold a floor up · wet evening', cover: 'woodshed', tint: 'rgba(110,90,60,0.4)' });

  /* ===================================================================== LIFTBRIDGE */
  function liftbridge() {
    const B = new Builder('liftbridge', 'LIFTBRIDGE', 340, 64, 290);
    K.begin(B);
    B.meta.desc = 'A canal basin in the old docks at dusk: the custom house and its bonded warehouse on one quay, the bridge house on the other, and a lifting bridge between them. The bridge goes up from its control room, and by itself every minute; the footbridge high over the water is the other way across.';
    B.theme({ sky: [0x2a3a5a, 0xd8986a], fog: 0x6a6a78, fogFar: 140, lightOut: [0.86, 0.74, 0.66], lightIn: [0.9, 0.82, 0.68], sun: 0xffb87a, outer: 0x4a4a50 });
    B.ground(M.DOCK);
    const b = B.building(44, 90, 97, 97, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.STONE });
    const e = B.building(188, 90, 97, 97, { lo: 1, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.STONE });
    K.shells(B);
    b.pal = [M.DRY_BEIGE, M.PLASTER, M.DRY_SAGE, M.BRICK]; b.pillar = M.KT_TIMBER; e.pal = [M.DRY_GREY, M.BRICK, M.DRY_BLUE];
    K.plan(b, 0, `
      0-24: Bonded Cellar 24 | Wine Vault 42 | - 54 | Coal Cellar 72 | Boiler Room 96
      24-72: Cellar Passage 24 | Bonded Warehouse~ 72 | Pump Room 96
      72-96: Rope Store 24 | Tally Cellar 42 | - 54 | Strongroom 72 | Cooperage 96`);
    K.plan(b, 1, `
      0-24: Customs Hall 24 | Clerks Office 42 | - 54 | Excise Office 72 | Waiting Room 96
      24-72: Long Room~ 72 | Quay Office 96
      72-96: Post Room 24 | Tally Office 42 | - 54 | Harbour Police 72 | Cells 96`);
    K.plan(b, 2, `
      0-24: Collector's Office 24 | Secretary 42 | - 54 | Map Room 72 | Records Room 96
      24-72: Upper Gallery 24 | Board Room 72 | Pilots Lounge 96
      72-96: Library 24 | Archive 42 | - 54 | Signal Room 72 | Footbridge Hall 96`);
    K.plan(e, 1, `
      0-24: Gear Room 42 | Engine Room 96
      24-72: Bridge Hall~ 48 | Chandlery 96
      72-96: Lock Keeper 42 | - 54 | Net Loft 96`);
    K.plan(e, 2, `
      0-24: Operators Mess 42 | Engine Store 96
      24-72: Bridge Control Room 48 | Sail Loft 96
      72-96: Footbridge Landing 42 | - 54 | Rigging Store 96`);
    K.well(b, 'West Stairs', 42, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 42, 72, 'z', 0, 2);
    K.well(e, 'Bridge Stairs', 42, 72, 'z', 1, 2);
    // the canal: stone quay walls, the water a storey down, steps out of it at each end
    B.w.fill(148, 1, 0, 180, 12, 289, 0); B.w.fill(148, 1, 0, 180, 6, 289, M.WATER);
    for (const x of [147, 181]) B.w.fill(x, 1, 0, x, 12, 289, M.STONE);
    for (const z0 of [40, 240]) for (let i = 0; i < 6; i++) { B.w.fill(148, 7, z0 + i, 151, 7 + i, z0 + i, M.STONE); B.w.fill(177, 7, z0 + i, 180, 7 + i, z0 + i, M.STONE); }
    // the lifting bridge (deck and rails), hinged at the bridge-house end
    B.w.fill(148, 11, 120, 180, 11, 136, M.METAL); B.w.fill(148, 12, 120, 180, 12, 136, M.ASPHALT);
    for (const z of [120, 136]) B.w.fill(148, 13, z, 180, 15, z, M.RAIL);
    B.meta.mech.push({ kind: 'bridge', x0: 148, x1: 180, z0: 120, z1: 136, y0: 11, y1: 15, every: 60, lever: { x: X(e, 8), z: Z(e, 40), y: 25 } });
    // the footbridge: L2 to L2, high over the water
    B.w.fill(141, 24, 172, 187, 24, 176, M.METAL);
    for (const z of [171, 177]) B.w.fill(141, 25, z, 187, 27, z, M.RAIL);
    b.open(2, 'x', 96, 82, 5, 0, 9, 'door'); e.open(2, 'x', 0, 82, 5, 0, 9, 'door');
    keep(b, 2, 88, 80, 95, 88); keep(e, 2, 1, 80, 8, 88);
    // bonded stacks in the warehouse
    for (let x = 4; x <= 64; x += 12) b.crates(0, x, 40, 4);
    K.finish({ hatch: 3, cams: 9 });
    // the quays: bollards, a crane, barrels; boats tied up
    for (let z = 10; z < 285; z += 24) { B.obox(145, z, 146, z + 1, 0, 2, M.RUST); B.obox(182, z, 183, z + 1, 0, 2, M.RUST); }
    for (const z of [60, 200]) { B.w.fill(152, 7, z, 160, 8, z + 22, M.WOOD); B.w.fill(153, 9, z + 2, 159, 10, z + 8, M.WOOD); }
    K.scatter(26, 16, (x, z, h) => { if (x > 136 && x < 192) return; if (h < 0.24) B.lamp(x, z, 15); else if (h < 0.36) B.drum(x, z, 2, 0, 4, M.RUST); else if (h < 0.46) B.container(x, z, h < 0.41 ? 'x' : 'z', [M.CONT_R, M.CONT_G][Math.floor(h * 30) % 2]); });
    B.spawn('Fish Quay', 92, 40, 180); B.spawn('Coal Wharf', 92, 240, 0); B.spawn('Brewery Yard', 326, 138, 90); B.spawn('Ropewalk', 4, 138, -90);
    B.meta.bombs = [['Bonded Cellar', 'Wine Vault'], ['Coal Cellar', 'Boiler Room'], ['Excise Office', 'Waiting Room'], ["Collector's Office", 'Secretary'], ['Map Room', 'Records Room']];
    B.meta.secure = ['Bonded Warehouse', 'Long Room', 'Bridge Hall', 'Board Room'];
    B.meta.hostage = ['Cells', 'Strongroom', 'Lock Keeper', 'Library'];
    B.meta.defSpawns = ['Long Room', 'Bonded Warehouse', 'Board Room'];
    return B;
  }
  define({ id: 'liftbridge', name: 'LIFTBRIDGE', fn: liftbridge, blurb: 'Canal basin, a lifting bridge & a footbridge · dusk', cover: 'boatshed', tint: 'rgba(70,100,130,0.38)' });

  /* ===================================================================== BROADCAST HOUSE */
  function broadcast() {
    const B = new Builder('broadcast', 'BROADCAST HOUSE', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A television centre on election night: two studios on the ground floor, the galleries over them and the tape archive in the basement. The lighting desk can black out the studio floor, and the scenery flats run along their tracks, opening one line and closing another.';
    B.theme({ sky: [0x0e0c1a, 0x3a2a4a], fog: 0x1e1a2a, fogFar: 120, lightOut: [0.52, 0.5, 0.66], lightIn: [0.94, 0.9, 0.86], sun: 0xb0a0ff, outer: 0x2a2830 });
    B.ground(M.ASPHALT);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.FACADE, inner: M.DRY_WHITE, slab: M.CARPET, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.DRY_WHITE, M.DRY_GREY, M.XP_STUDIO, M.DRY_RED]; b.pillar = M.METAL;
    K.plan(b, 0, `
      0-24: Archive Vault 30 | Tape Library 54 | - 66 | Wardrobe 96 | Props Store 120
      24-72: Scenery Store~ 60 | Carpenters Shop 120
      72-96: Plant Room 30 | Generator Room 54 | - 66 | Dressing Rooms 96 | Canteen 120`);
    K.plan(b, 1, `
      0-24: Reception 30 | Newsroom 54 | - 66 | Green Room 96 | Make-up Room 120
      24-72: Scene Dock 24 | Studio One~ 96 | Studio Two 120
      72-96: Edit Suite 30 | Dubbing Theatre 54 | - 66 | Graphics Room 96 | Sound Store 120`);
    K.plan(b, 2, `
      0-24: Production Gallery 30 | Vision Control 54 | - 66 | Sound Gallery 96 | Lighting Office 120
      24-72: Lighting Gallery 24 | Studio Gantry~ 96 | Presentation Studio 120
      72-96: Controllers Office 30 | Script Office 54 | - 66 | Transmission Room 96 | Server Room 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    K.atrium(b, 2, 32, 32, 88, 64);   // studio one is two storeys high, the gantry round it
    // the studio floor: the news desk, camera pedestals, audience risers
    b.box(1, 40, 62, 60, 64, 0, 3, M.XP_MARBLE_G);
    for (const [x, z] of [[46, 52], [56, 50], [36, 50]]) b.box(1, x, z, x + 1, z + 1, 0, 6, M.METAL);
    for (let i = 0; i < 4; i++) b.box(1, 78 + i * 3, 30, 80 + i * 3, 46, 0, i + 1, M.XP_STUDIO);
    // the flats: one across the studio's west end, one by the news desk; each runs along its track
    b.box(1, 34, 40, 50, 40, 0, 10, M.XP_FLAT);
    B.meta.mech.push({ kind: 'slider', label: 'WEST FLAT', x0: X(b, 34), x1: X(b, 50), z0: Z(b, 40), z1: Z(b, 40), y0: 13, y1: 23, dx: 22, dz: 0, panel: { x: X(b, 30), z: Z(b, 44), y: 13 } });
    b.box(1, 70, 50, 70, 64, 0, 10, M.XP_FLAT);
    B.meta.mech.push({ kind: 'slider', label: 'NEWS FLAT', x0: X(b, 70), x1: X(b, 70), z0: Z(b, 50), z1: Z(b, 64), y0: 13, y1: 23, dx: 0, dz: -18, panel: { x: X(b, 74), z: Z(b, 68), y: 13 } });
    // the lighting desk: blacks out the studio floor
    B.meta.mech.push({ kind: 'lights', label: 'STUDIO FLOOR', panel: { x: X(b, 108), z: Z(b, 8), y: 25 }, rooms: ['Studio One', 'Studio Two', 'Scene Dock', 'Studio Gantry', 'Lighting Gallery'] });
    // tape shelving in the archive
    for (let z = 4; z <= 20; z += 5) b.shelf(0, 4, z, 26, z + 1, 8);
    K.finish({ hatch: 4, cams: 10 });
    B.obox(X(b, 50), Z(b, -14), X(b, 70), Z(b, -12), 0, 6, M.NEON_P);   // the sign by the front door
    K.scatter(24, 14, (x, z, h) => { if (h < 0.25) B.lamp(x, z, 15); else if (h < 0.4) B.truck(x, z, h < 0.33 ? 'x' : 'z', M.CAR_W); else if (h < 0.5) B.car(x, z, 'x', [M.CAR_K, M.CAR_R][Math.floor(h * 30) % 2]); });
    K.spawns('Outside Broadcast Park', 'Canal Towpath', 'Satellite Yard', 'Studio Gate');
    B.meta.bombs = [['Archive Vault', 'Tape Library'], ['Wardrobe', 'Props Store'], ['Edit Suite', 'Dubbing Theatre'], ['Production Gallery', 'Vision Control'], ['Transmission Room', 'Server Room']];
    B.meta.secure = ['Studio One', 'Scenery Store', 'Studio Gantry', 'Newsroom'];
    B.meta.hostage = ['Green Room', 'Dressing Rooms', 'Controllers Office', 'Graphics Room'];
    B.meta.defSpawns = ['Studio One', 'Transmission Room', 'Archive Vault'];
    return B;
  }
  define({ id: 'broadcast', name: 'BROADCAST HOUSE', fn: broadcast, blurb: 'TV centre: a lighting desk & moving scenery · election night', cover: 'garage', tint: 'rgba(150,60,110,0.36)' });

  /* ===================================================================== COLDSTORE */
  function coldstore() {
    const B = new Builder('coldstore', 'COLDSTORE', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A data centre in the snow: three data halls of racks stacked one over another, with the plant that keeps them cold. Each hall has its own gas suppression, pulled from a station outside it: an alarm, then twelve seconds of gas nobody sees through and nobody should breathe.';
    B.theme({ sky: [0x8a9aac, 0xe8eef2], fog: 0xd8e2ea, fogFar: 130, lightOut: [0.9, 0.94, 1.0], lightIn: [0.78, 0.88, 0.96], sun: 0xe8f0ff, outer: 0xb8c4cc });
    B.ground(M.SNOW);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.CORRUGATE, inner: M.XP_COLDPANEL, slab: M.LAB_FLOOR, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.XP_COLDPANEL, M.LAB_WHITE, M.DRY_GREY, M.DRY_BLUE]; b.pillar = M.METAL;
    K.plan(b, 0, `
      0-24: UPS Room 30 | Battery Room 54 | - 66 | Chiller Plant 96 | Pump Room 120
      24-72: Cable Vault 24 | Data Hall Zero~ 96 | Fuel Store 120
      72-96: Generator Hall 30 | Switch Room 54 | - 66 | Water Treatment 96 | Workshop 120`);
    K.plan(b, 1, `
      0-24: Security Lobby 30 | Badge Office 54 | - 66 | Loading Dock 96 | Staging Room 120
      24-72: Cold Corridor 24 | Data Hall One~ 96 | Meet-me Room 120
      72-96: Network Operations 30 | Break Room 54 | - 66 | Tape Vault 96 | Spares Store 120`);
    K.plan(b, 2, `
      0-24: Site Manager 30 | Meeting Room 54 | - 66 | Customer Suite 96 | Viewing Gallery 120
      24-72: Hot Corridor 24 | Data Hall Two~ 96 | Fire Control 120
      72-96: Engineers Office 30 | Staff Kitchen 54 | - 66 | Comms Room 96 | Roof Plant 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    // the racks: rows down each hall with a cross aisle in the middle
    for (const L of [0, 1, 2]) for (let z = 30; z <= 65; z += 7) { b.box(L, 28, z, 54, z + 1, 0, 8, M.SERVER); b.box(L, 66, z, 92, z + 1, 0, 8, M.SERVER); }
    // each hall's suppression, its pull station in the corridor or room beside it
    B.meta.mech.push({ kind: 'gas', room: 'DATA HALL ZERO', x0: X(b, 25), x1: X(b, 95), z0: Z(b, 25), z1: Z(b, 71), y0: 1, panel: { x: X(b, 12), z: Z(b, 40), y: 1 } });
    B.meta.mech.push({ kind: 'gas', room: 'DATA HALL ONE', x0: X(b, 25), x1: X(b, 95), z0: Z(b, 25), z1: Z(b, 71), y0: 13, panel: { x: X(b, 12), z: Z(b, 40), y: 13 } });
    B.meta.mech.push({ kind: 'gas', room: 'DATA HALL TWO', x0: X(b, 25), x1: X(b, 95), z0: Z(b, 25), z1: Z(b, 71), y0: 25, panel: { x: X(b, 108), z: Z(b, 40), y: 25 } });
    K.finish({ hatch: 3, cams: 9 });
    // the yard: chillers, generators, snow on everything
    for (let x = 96; x <= 196; x += 20) B.obox(x, 40, x + 12, 48, 0, 6, M.METAL);
    K.scatter(24, 16, (x, z, h) => { if (h < 0.22) B.lamp(x, z, 15); else if (h < 0.4) B.tree(x, z, 12 + Math.floor(h * 10), true, true); else if (h < 0.5) B.truck(x, z, h < 0.45 ? 'x' : 'z', M.CAR_W); });
    K.spawns('Security Gate', 'Substation Road', 'Fuel Depot', 'Pine Ridge');
    B.meta.bombs = [['UPS Room', 'Battery Room'], ['Chiller Plant', 'Pump Room'], ['Security Lobby', 'Badge Office'], ['Site Manager', 'Meeting Room'], ['Comms Room', 'Roof Plant']];
    B.meta.secure = ['Data Hall Zero', 'Data Hall One', 'Data Hall Two', 'Meet-me Room'];
    B.meta.hostage = ['Tape Vault', 'Generator Hall', 'Customer Suite', 'Engineers Office'];
    B.meta.defSpawns = ['Data Hall One', 'Fire Control', 'Generator Hall'];
    return B;
  }
  define({ id: 'coldstore', name: 'COLDSTORE', fn: coldstore, blurb: 'Data centre: racked halls with gas suppression · snow', cover: 'trailer', tint: 'rgba(150,190,220,0.36)' });

  /* ===================================================================== TIMBERLINE */
  function timberline() {
    const B = new Builder('timberline', 'TIMBERLINE', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A sawmill in the pines on a misty morning: the saw hall with its log carriage, the gallery over it, the sawdust cellar under it and the log yard all round. The carriage runs the length of the hall carrying a log, and a blast anywhere on the sawdust starts a fire.';
    B.theme({ sky: [0x6a7a7a, 0xd8dcd0], fog: 0xb8c0b4, fogFar: 110, lightOut: [0.86, 0.88, 0.82], lightIn: [0.92, 0.84, 0.7], sun: 0xf0e8d0, outer: 0x5a5a4a });
    B.ground(M.DIRT);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.KT_TIMBER, inner: M.WOOD, slab: M.WOODFLOOR, roof: M.CORRUGATE, parapet: M.KT_TIMBER });
    K.shells(B);
    b.pal = [M.KT_TIMBER, M.WOOD, M.DRY_BEIGE, M.LOGWALL]; b.pillar = M.KT_TIMBER;
    K.plan(b, 0, `
      0-24: Boiler House 30 | Fuel Bunker 54 | - 66 | Shaft Room 96 | Sharpening Shop 120
      24-72: Sawdust Cellar~ 120
      72-96: Engine Room 30 | Belt Room 54 | - 66 | Oil Store 96 | Tool Crib 120`);
    K.plan(b, 1, `
      0-24: Log Deck 30 | Headrig Booth 54 | - 66 | Edger Room 96 | Trimmer Room 120
      24-72: Saw Hall~ 120
      72-96: Mill Office 30 | Grading Room 54 | - 66 | Planer Room 96 | Shipping Office 120`);
    K.plan(b, 2, `
      0-24: Filing Room 30 | Foremans Office 54 | - 66 | Drying Loft 96 | Bunk Room 120
      24-72: Catwalk 24 | Saw Hall Gallery~ 96 | Kiln Control 120
      72-96: Mess Hall 30 | Cook House 54 | - 66 | Pay Office 96 | Owners Office 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    K.atrium(b, 2, 32, 32, 88, 64);   // the gallery looks down on the saw hall
    // the carriage track down the saw hall, the headrig saw beside it, sawdust heaps
    for (const lz of [45, 51]) B.w.fill(X(b, 2), 12, Z(b, lz), X(b, 118), 12, Z(b, lz), M.RAIL);
    for (let a = 0; a < 360; a += 4) { const r = a * Math.PI / 180, x = Math.round(X(b, 60) + 5 * Math.cos(r)), y = Math.round(18 + 5 * Math.sin(r)); if (y >= 13) B.w.fill(x, y, Z(b, 56), x, y, Z(b, 56), M.METAL); }
    b.box(1, 54, 57, 66, 60, 0, 4, M.RUST);
    for (const [lx, lz] of [[20, 30], [96, 64], [40, 66], [104, 30]]) b.box(1, lx, lz, lx + 4, lz + 3, 0, 0, M.XP_SAWDUST);
    for (const [lx, lz] of [[20, 34], [70, 60], [100, 40]]) b.box(0, lx, lz, lx + 6, lz + 4, 0, 1, M.XP_SAWDUST);
    // the log carriage: a flat car with a log on it, end to end of the hall
    B.meta.mech.push({ kind: 'mover', x0: X(b, 4), x1: X(b, 15), z0: Z(b, 43), z1: Z(b, 53), y: 13, axis: 'x', speed: 1.6, dwell: 5, cargo: 1.25, cargoColor: 0x7a5634, color: 0x5a4a3a, pts: [{ x: X(b, 107) }] });
    B.meta.mech.push({ kind: 'sawdust', x0: X(b, 1), x1: X(b, 119), z0: Z(b, 25), z1: Z(b, 71), y: 13 });
    B.meta.mech.push({ kind: 'sawdust', x0: X(b, 1), x1: X(b, 119), z0: Z(b, 25), z1: Z(b, 71), y: 1 });
    K.finish({ hatch: 3, cams: 8 });
    // the log yard: stacks of logs, a loader, pines all round
    for (const [x, z] of [[40, 60], [40, 180], [240, 70], [244, 200]]) for (let i = 0; i < 4; i++) B.obox(x, z + i * 4, x + 24, z + i * 4 + 3, 0, 3 - (i % 2), M.XP_LOG);
    K.scatter(22, 16, (x, z, h) => { if (h < 0.5) B.tree(x, z, 14 + Math.floor(h * 16), true); else if (h < 0.58) B.truck(x, z, h < 0.54 ? 'x' : 'z', M.CAR_R); });
    K.spawns('Log Yard', 'Haul Road', 'Mill Pond', 'Ridge Track');
    B.meta.bombs = [['Boiler House', 'Fuel Bunker'], ['Shaft Room', 'Sharpening Shop'], ['Mill Office', 'Grading Room'], ['Edger Room', 'Trimmer Room'], ['Pay Office', 'Owners Office']];
    B.meta.secure = ['Saw Hall', 'Sawdust Cellar', 'Saw Hall Gallery', 'Drying Loft'];
    B.meta.hostage = ['Bunk Room', 'Oil Store', 'Headrig Booth', 'Filing Room'];
    B.meta.defSpawns = ['Saw Hall', 'Engine Room', 'Kiln Control'];
    return B;
  }
  define({ id: 'timberline', name: 'TIMBERLINE', fn: timberline, blurb: 'Sawmill: a log carriage & sawdust that burns · misty morning', cover: 'cabin', tint: 'rgba(120,100,60,0.38)' });
})();
