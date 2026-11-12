/* maps-new-d.js -- five new maps on the layout kit (maps-kit.js):
     GRAND THEATRE   an opera house: stage and fly tower, a galleried auditorium over an orchestra
                     pit, the foyer, a backstage annex
     IRON GORGE DAM  a hydro station: the turbine hall, inspection galleries inside the dam wall,
                     the admin tower, a switchyard shed
     CLOISTER        an abbey round an open garth: chapel and crypt, library and brewery range,
                     dormitory range, refectory
     BIODOME         a jungle under a glass dome ringed by walkways, with lab, visitor, arid-house
                     and plant wings
     FOUNDRY         a steelworks: the casting hall round its furnace, a rolling mill, the power
                     house, the office block */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, define } = MAPS;
  const K = MAPS.KIT;

  /* =================================================================== GRAND THEATRE */
  function theatre() {
    const B = new Builder('theatre', 'GRAND THEATRE', 300, 64, 300);
    K.begin(B);
    B.meta.desc = 'An old opera house on a wet night: the stage under its fly tower, an auditorium with a horseshoe balcony over the orchestra pit, a marble foyer, and a backstage annex of workshops and dressing rooms.';
    B.theme({ sky: [0x0b0d1e, 0x3a2a4a], fog: 0x1c1a2c, fogFar: 115, lightOut: [0.5, 0.5, 0.7], lightIn: [0.95, 0.84, 0.66], sun: 0xb8a8ff, outer: 0x2a2c34 });
    B.ground(M.ASPHALT);
    B.surf(60, 227, 210, 262, M.MARBLE); B.surf(0, 264, 299, 286, M.CONC_DARK);
    const b = B.building(85, 70, 97, 109, { lo: 0, hi: 3, ext: M.PLASTER, inner: M.DRY_RED, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.MARBLE });
    const f = B.building(85, 178, 97, 49, { lo: 1, hi: 2, ext: M.MARBLE, inner: M.DRY_RED, slab: M.MARBLE, roof: M.ROOF, parapet: M.MARBLE });
    const a = B.building(181, 80, 49, 73, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.WOODFLOOR, roof: M.CORRUGATE, parapet: M.RUST });
    K.shells(B);
    b.pal = [M.DRY_RED, M.DRY_BEIGE, M.DRY_GREY, M.KT_TIMBER]; b.pillar = M.MARBLE; f.pal = [M.DRY_RED, M.DRY_BEIGE]; f.plain = true; a.pal = [M.DRY_GREY, M.DRY_SAGE, M.KT_TIMBER];

    K.plan(b, 0, `
      0-24: Costume Store 24 | - 36 | Boiler Room 60 | - 72 | Band Room 96
      24-54: Scene Store 20 | Trap Room 76 | Dimmer Room 96
      54-66: Orchestra Pit 96
      66-108: Wine Vault 30 | Under-Stalls Passage 66 | Carpenter's Shop 96`);
    K.plan(b, 1, `
      0-24: Scenery Dock 24 | - 36 | Stage Door Hall 60 | - 72 | Prop Room 96
      24-54: Stage Left 20 | Stage~ 76 | Stage Right 96
      54-108: West Aisle 12 | Auditorium~ 84 | East Aisle 96`);
    K.plan(b, 2, `
      0-24: Dressing Room A 24 | - 36 | Wardrobe 60 | - 72 | Dressing Room B 96
      24-54: Loading Gallery 20 | Fly Gallery~ 76 | Lighting Store 96
      54-108: West Circle Corridor 12 | Grand Circle Balcony~ 84 | East Circle Corridor 96`);
    K.plan(b, 3, `
      0-24: Rehearsal Room 24 | - 36 | Green Room 60 | - 72 | Manager's Office 96
      24-54: Grid Loft West 20 | Rigging Catwalk~ 76 | Grid Loft East 96
      54-108: Lighting Loft 30 | Projection Room 66 | Sound Booth 96`);
    K.well(b, 'Stage Stairs West', 24, 0, 'z', 0, 3);
    K.well(b, 'Stage Stairs East', 60, 0, 'z', 0, 3);
    // the fly tower over the stage, and the auditorium open to its balcony
    K.atrium(b, 2, 27, 30, 69, 48); K.atrium(b, 3, 27, 30, 69, 48);
    b.void(2, 22, 55, 74, 92); b.rail(2, 21, 55, 21, 93); b.rail(2, 75, 55, 75, 93); b.rail(2, 21, 93, 75, 93);
    // the proscenium: the wall between stage and house opened through both floors, framed in gold
    B.w.fill(b.X(28), 13, b.Z(54), b.X(68), 23, b.Z(54), 0); B.w.fill(b.X(28), 25, b.Z(54), b.X(68), 33, b.Z(54), 0);
    for (const x of [27, 69]) B.w.fill(b.X(x), 13, b.Z(54), b.X(x), 34, b.Z(54), M.KT_GOLD);
    B.w.fill(b.X(27), 34, b.Z(54), b.X(69), 34, b.Z(54), M.KT_GOLD); b.rail(2, 28, 54, 68, 54);
    // the stage, a metre up, with steps down into the house either side of the orchestra pit
    b.box(1, 25, 28, 71, 53, 0, 0, M.WOOD); b.box(1, 26, 29, 70, 53, 0, 1, M.WOOD); b.box(1, 27, 30, 69, 53, 0, 2, M.WOOD);
    for (const x of [28, 64]) { b.box(1, x, 54, x + 4, 54, 0, 1, M.WOOD); b.box(1, x, 55, x + 4, 55, 0, 0, M.WOOD); }
    b.void(1, 34, 56, 62, 59); b.rail(1, 33, 60, 63, 60); b.rail(1, 33, 56, 33, 59); b.rail(1, 63, 56, 63, 59);
    b.box(1, 30, 31, 34, 40, 3, 9, M.KT_TIMBER); b.box(1, 60, 34, 66, 36, 3, 8, M.KT_TIMBER); b.box(1, 44, 44, 52, 47, 3, 4, M.TRIM);     // scenery flats and a prop table
    for (let z = 64; z <= 100; z += 6) for (const x of [16, 51]) { b.box(1, x, z, x + 29, z + 1, 0, 1, M.KT_VELVET); b.box(1, x, z + 1, x + 29, z + 1, 2, 2, M.KT_VELVET); }
    for (const z of [97, 102]) for (const x of [16, 51]) b.box(2, x, z, x + 29, z + 1, 0, 1, M.KT_VELVET);
    b.box(2, 46, 70, 50, 74, 7, 9, M.LAMP); b.box(2, 48, 72, 48, 72, 10, 11, M.BRASS);                                   // the chandelier
    K.flight(b, 1, 2, 96, '-z', 5); K.flight(b, 1, 90, 96, '-z', 5);
    b.cellar('w', 80);

    K.plan(f, 1, `0-48: Box Office 20 | Grand Foyer~ 76 | Theatre Bar 96`);
    K.plan(f, 2, `0-48: Press Office 20 | Foyer Balcony~ 76 | Crush Bar 96`);
    K.atrium(f, 2, 28, 8, 68, 40);
    K.flight(f, 1, 21, 36, '-z', 5); K.flight(f, 1, 71, 36, '-z', 5);
    for (const x of [34, 61]) for (const z of [14, 33]) f.box(1, x, z, x + 1, z + 1, 0, 22, M.MARBLE);
    f.couch(1, 40, 20, 56, 22, M.KT_VELVET, 's'); f.couch(1, 40, 26, 56, 28, M.KT_VELVET, 'n');

    K.plan(a, 0, `
      0-36: Lumber Store 24 | Electrics Store 48
      36-48: Annex Passage 48
      48-72: Prop Cellar 24 | - 36 | Furnace Room 48`);
    K.plan(a, 1, `
      0-36: Scenery Workshop 48
      36-48: Stage Door Lobby 48
      48-72: Paint Shop 24 | - 36 | Porter's Office 48`);
    K.plan(a, 2, `
      0-36: Chorus Room 24 | Wig Room 48
      36-48: Dressing Corridor 48
      48-72: Star Dressing Room 24 | - 36 | Laundry 48`);
    K.well(a, 'Annex Stairs', 24, 48, 'z', 0, 2);
    a.shutterX(1, 48, 8, 14);

    K.finish({ hatch: 3, cams: 8 });
    // the square: lamps, cars, playbills by the doors
    for (const x of [70, 196]) { B.obox(x, 228, x + 1, 240, 2, 9, M.TRIM); B.obox(x, 230, x + 1, 238, 3, 8, M.NEON_P); }
    K.scatter(26, 14, (x, z, h) => { if (z > 222 && z < 264 && x > 56 && x < 214) return; if (h < 0.22) B.lamp(x, z, 15); else if (h < 0.4) B.car(x, z, h < 0.3 ? 'x' : 'z', [M.CAR_K, M.CAR_W, M.CAR_R][Math.floor(h * 30) % 3]); else if (h < 0.5) B.tree(x, z, 14); else if (h < 0.56) B.dumpster(x, z); });
    K.spawns('Stage Door Alley', 'Theatre Square', 'Scenery Yard', 'Carriage Lane');
    B.meta.bombs = [['Trap Room', 'Scene Store'], ['Costume Store', 'Boiler Room'], ['Dressing Room A', 'Wardrobe'], ['Projection Room', 'Sound Booth'], ['Rehearsal Room', 'Green Room'], ['Chorus Room', 'Wig Room']];
    B.meta.secure = ['Stage', 'Auditorium', 'Grand Foyer', 'Lighting Loft', 'Scenery Workshop'];
    B.meta.hostage = ['Band Room', 'Prop Room', "Manager's Office", 'Star Dressing Room', 'Theatre Bar'];
    B.meta.defSpawns = ['Green Room', 'Wardrobe', 'Trap Room'];
    return B;
  }
  define({ id: 'theatre', name: 'GRAND THEATRE', fn: theatre, blurb: 'Opera house, stage & fly tower · wet night', cover: 'garage', tint: 'rgba(150,40,60,0.38)' });

  /* =================================================================== IRON GORGE DAM */
  function dam() {
    const B = new Builder('dam', 'IRON GORGE DAM', 320, 64, 300);
    K.begin(B);
    B.meta.desc = 'A hydro station in a mountain gorge: three generators in the turbine hall under a travelling crane, inspection galleries running the length of the dam wall, the admin tower, and a switchyard shed. Overcast.';
    B.theme({ sky: [0x6e7c88, 0xb9c2c6], fog: 0x9aa6aa, fogFar: 120, lightOut: [0.9, 0.93, 0.96], lightIn: [0.7, 0.68, 0.62], sun: 0xf0f4f6, outer: 0x4a5a48 });
    B.ground(M.GRAVEL);
    B.surf(0, 262, 319, 299, M.WATER); B.surf(254, 100, 319, 262, M.WATER); B.surf(86, 40, 319, 58, M.ASPHALT);
    const b = B.building(84, 120, 121, 61, { lo: 0, hi: 2, ext: M.CONCRETE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.ROOF, parapet: M.KT_STEEL });
    const g = B.building(60, 60, 25, 181, { lo: 0, hi: 2, ext: M.CONCRETE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CONCRETE, parapet: M.CONCRETE });
    const c = B.building(204, 114, 49, 73, { lo: 1, hi: 3, ext: M.FACADE, inner: M.DRY_BEIGE, slab: M.TILE, roof: M.ROOF, parapet: M.KT_STEEL });
    const s = B.building(110, 180, 61, 37, { lo: 1, hi: 1, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    K.shells(B);
    b.pal = [M.DRY_GREY, M.DRY_BLUE, M.PANEL_DARK]; b.pillar = M.KT_STEEL; b.plain = g.plain = true; g.pal = [M.CONCRETE, M.DRY_GREY, M.DRY_GREY]; c.pal = [M.DRY_BEIGE, M.DRY_BLUE, M.DRY_SAGE];

    K.plan(b, 0, `
      0-36: Turbine Pit 42 | Penstock Gallery 84 | Valve Chamber 120
      36-60: Drainage Sump 30 | - 42 | Cable Vault 72 | Pump Room 108 | - 120`);
    K.plan(b, 1, `
      0-36: Turbine Hall~ 84 | Switchgear Room 120
      36-60: Machine Workshop 30 | - 42 | Oil Store 72 | Transformer Bay 108 | - 120`);
    K.plan(b, 2, `
      0-36: Crane Gallery~ 84 | Control Room 120
      36-60: Relay Room 30 | - 42 | Engineers Office 72 | Battery Room 108 | - 120`);
    K.well(b, 'Workshop Stairs', 30, 36, 'z', 0, 2);
    K.well(b, 'East Stairs', 108, 36, 'z', 0, 2);
    K.atrium(b, 2, 7, 7, 77, 29);
    K.flight(b, 1, 79, 30, '-z', 4);
    // three generators, the crane over them, their shafts in the pit below
    for (const x of [18, 40, 62]) { b.tank(1, x, 18, 6, 6, M.KT_STEEL); b.tank(1, x, 18, 4, 9, M.RED_PAINT); b.tank(1, x, 18, 2, 12, M.BRASS); }
    for (const x of [18, 62]) b.tank(0, x, 18, 4, 10, M.METAL);
    b.box(2, 8, 16, 76, 19, 8, 9, M.KT_STEEL); b.box(2, 30, 17, 31, 18, 2, 7, M.PIPE); b.box(2, 29, 16, 32, 19, 0, 1, M.RUST);
    b.box(1, 8, 30, 14, 33, 0, 3, M.CRATE); b.box(1, 50, 30, 56, 33, 0, 5, M.CRATE); b.box(1, 28, 4, 32, 7, 0, 3, M.METAL);

    K.plan(g, 0, `
      0-30: Drain Chamber 24
      30-54: - 12 | Grout Store 24
      54-126: Lower Gallery 24
      126-150: - 12 | Sump Room 24
      150-180: Outlet Works 24`);
    K.plan(g, 1, `
      0-30: Gate Room 24
      30-54: - 12 | Gauge Room 24
      54-126: Inspection Gallery 24
      126-150: - 12 | Seepage Lab 24
      150-180: Hoist Room 24`);
    K.plan(g, 2, `
      0-30: Crest Office 24
      30-54: - 12 | Sluice Control 24
      54-126: Crest Gallery 24
      126-150: - 12 | Survey Room 24
      150-180: Winch House 24`);
    K.well(g, 'North Shaft', 0, 30, 'z', 0, 2);
    K.well(g, 'South Shaft', 0, 126, 'z', 0, 2);
    // the forebay behind the dam wall: a walled basin brim-full
    B.obox(16, 88, 59, 212, 0, 17, M.CONCRETE); B.obox(18, 90, 59, 210, 15, 17, M.WATER);

    K.plan(c, 1, `
      0-36: Canteen 24 | Kitchen 48
      36-48: Visitor Lobby 48
      48-72: Locker Room 24 | - 36 | First Aid 48`);
    K.plan(c, 2, `
      0-36: Operations Office 24 | Records Room 48
      36-48: Admin Corridor 48
      48-72: Server Room 24 | - 36 | Drawing Office 48`);
    K.plan(c, 3, `
      0-36: Director Suite 24 | Board Room 48
      36-48: Top Landing 48
      48-72: Radio Room 24 | - 36 | Map Room 48`);
    K.well(c, 'Admin Stairs', 24, 48, 'z', 1, 3);

    K.plan(s, 1, `0-36: Truck Bay~ 26 | Line Store 44 | Yard Office 60`);
    s.box(1, 6, 8, 14, 28, 1, 4, M.CAR_K); s.box(1, 6, 8, 14, 14, 5, 8, M.CAR_W); s.box(1, 7, 9, 13, 13, 6, 7, M.GLASS); s.box(1, 18, 24, 22, 30, 0, 3, M.CRATE);
    s.shutterZ(1, 36, 5, 14);

    K.finish({ hatch: 3, cams: 8 });
    // the switchyard: pylons, transformers, a fence
    for (const [x, z] of [[196, 214], [232, 214], [214, 244]]) { B.obox(x, z, x + 1, z + 1, 0, 30, M.KT_STEEL); B.obox(x - 5, z, x + 6, z + 1, 24, 24, M.KT_STEEL); B.obox(x - 5, z, x + 6, z + 1, 30, 30, M.KT_STEEL); }
    for (const x of [200, 216, 232]) { B.obox(x, 228, x + 6, 234, 0, 6, M.PANEL_DARK); B.obox(x + 2, 230, x + 4, 232, 7, 10, M.PIPE); }
    B.fence(186, 204, 250, 204); B.fence(186, 204, 186, 254);
    K.scatter(26, 14, (x, z, h) => { if (z > 258 || x > 250 || (z > 36 && z < 62)) return; if (x > 182 && z > 200) return; if (h < 0.3) B.rock(x, z, 3 + Math.floor(h * 10)); else if (h < 0.5) B.tree(x, z, 16 + Math.floor(h * 10), true); else if (h < 0.58) B.obox(x, z, x + 5, z + 2, 0, 2, M.PIPE); });
    B.truck(120, 44, 'x', M.CAR_W);
    K.spawns('Crest Road', 'Tailrace', 'Switchyard', 'Spillway');
    B.meta.bombs = [['Drainage Sump', 'Cable Vault'], ['Machine Workshop', 'Oil Store'], ['Relay Room', 'Engineers Office'], ['Control Room', 'Battery Room'], ['Operations Office', 'Records Room'], ['Sluice Control', 'Crest Office']];
    B.meta.secure = ['Turbine Hall', 'Control Room', 'Valve Chamber', 'Server Room', 'Gate Room'];
    B.meta.hostage = ['Cable Vault', 'Switchgear Room', 'Director Suite', 'Seepage Lab', 'First Aid'];
    B.meta.defSpawns = ['Oil Store', 'Engineers Office', 'Pump Room'];
    return B;
  }
  define({ id: 'dam', name: 'IRON GORGE DAM', fn: dam, blurb: 'Hydro station & dam galleries · overcast', cover: 'cabin', tint: 'rgba(110,125,135,0.36)' });

  /* =================================================================== CLOISTER */
  function cloister() {
    const B = new Builder('cloister', 'CLOISTER', 300, 64, 300);
    K.begin(B);
    B.meta.desc = 'A hilltop abbey at first light: four ranges round an open garth. The chapel with its nave and crypt, the library and brewery range, the dormitory range and the refectory, joined by the cloister walk.';
    B.theme({ sky: [0x4a5a8a, 0xf0b890], fog: 0xc9a79a, fogFar: 135, lightOut: [1.02, 0.86, 0.76], lightIn: [0.62, 0.58, 0.54], sun: 0xffd0a0, outer: 0x5a6a3c });
    B.ground(M.GRASS);
    B.surf(130, 0, 170, 79, M.GRAVEL);
    const b = B.building(90, 80, 121, 49, { lo: 0, hi: 2, ext: M.STONE, inner: M.PLASTER, slab: M.STONE, roof: M.KT_SLATE, parapet: M.STONE });
    const w = B.building(91, 128, 37, 97, { lo: 0, hi: 2, ext: M.PLASTER, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.KT_SLATE, parapet: M.STONE });
    const e = B.building(173, 128, 37, 97, { lo: 1, hi: 2, ext: M.PLASTER, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.KT_SLATE, parapet: M.STONE });
    const s = B.building(127, 188, 47, 37, { lo: 1, hi: 2, ext: M.PLASTER, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.KT_SLATE, parapet: M.STONE });
    K.shells(B);
    b.pal = [M.PLASTER, M.DRY_BEIGE]; b.plain = true; b.pillar = M.STONE; for (const q of [w, e, s]) { q.pal = [M.DRY_BEIGE, M.DRY_WHITE, M.KT_TIMBER]; q.pillar = M.STONE; }

    K.plan(b, 0, `
      0-24: - 12 | Ossuary 24
      24-48: Reliquary Vault 24
      0-48@24: Crypt 84 | Catacomb Passage 120`);
    K.plan(b, 1, `
      0-24: - 12 | Vestry 24
      24-48: Sacristy 24
      0-48@24: Nave~ 84 | Sanctuary 120`);
    K.plan(b, 2, `
      0-24: - 12 | Organ Loft 24
      24-48: Bell Room 24
      0-48@24: Triforium Gallery~ 84 | Abbot's Chapel 120`);
    K.well(b, 'Tower Stairs', 0, 0, 'z', 0, 2);
    K.atrium(b, 2, 31, 7, 77, 41);
    K.flight(b, 1, 79, 30, '-z', 4);
    for (let x = 34; x <= 70; x += 5) { b.box(1, x, 9, x + 1, 20, 0, 1, M.WOOD); b.box(1, x, 28, x + 1, 39, 0, 1, M.WOOD); }
    b.box(1, 100, 20, 106, 28, 0, 3, M.MARBLE); b.box(1, 103, 24, 103, 24, 4, 10, M.KT_GOLD); b.box(1, 103, 22, 103, 26, 8, 8, M.KT_GOLD);
    b.box(1, 92, 10, 94, 12, 0, 6, M.BRASS); b.box(1, 92, 36, 94, 38, 0, 6, M.BRASS);

    K.plan(w, 0, `
      0-24: Beer Cellar 30 | - 42 | Brewhouse 66 | Cheese Store 96
      24-36: Cellar Walk 96`, true);
    K.plan(w, 1, `
      0-24: Library 30 | - 42 | Scriptorium 66 | Guest Hall 96
      24-36: West Cloister Walk 96`, true);
    K.plan(w, 2, `
      0-24: Upper Library 30 | - 42 | Bindery 66 | Guest Cells 96
      24-36: Library Corridor 96`, true);
    K.well(w, 'Library Stairs', 0, 30, 'x', 0, 2);
    K.plan(e, 1, `
      0-12: East Cloister Walk 96
      12-36: Chapter House 30 | - 42 | Infirmary 66 | Calefactory 96`, true);
    K.plan(e, 2, `
      0-12: Dormitory Corridor 96
      12-36: Monks Dormitory 30 | - 42 | Novices Dormitory 66 | Prior's Cell 96`, true);
    K.well(e, 'Night Stairs', 12, 30, 'x', 1, 2);
    K.plan(s, 1, `
      0-12: South Cloister Walk 46
      12-36: Refectory 28 | Kitchen 46`);
    K.plan(s, 2, `
      0-12: South Gallery 46
      12-36: Abbot's Lodging 28 | Treasury 46`);
    // arches from the walks onto the garth
    for (const z of [8, 28, 48]) { w.doorX(1, 36, z, 6); e.doorX(1, 0, z, 6); }
    s.doorZ(1, 0, 8, 6); s.doorZ(1, 0, 32, 6);

    K.finish({ hatch: 3, cams: 8 });
    // stained glass in the chapel
    const stain = [M.KT_STAIN_R, M.KT_STAIN_B, M.KT_STAIN_Y];
    B.w.fill(b.x, 13, b.z, b.x1, b.roofY, b.z1, (x, y, z, cur) => cur === M.GLASS && (x === b.x || x === b.x1 || z === b.z || z === b.z1) ? stain[(x + z + (y >> 1)) % 3] : -1);
    // the bell tower over the west end
    B.w.fill(b.x, 37, b.z, b.x + 24, 57, b.z + 24, (x, y, z) => (x === b.x || x === b.x + 24 || z === b.z || z === b.z + 24) ? (y >= 47 && y <= 53 && ((x > b.x + 8 && x < b.x + 16) || (z > b.z + 8 && z < b.z + 16)) ? 0 : M.STONE) : -1);
    B.box(b.x, 58, b.z, b.x + 24, 58, b.z + 24, M.KT_SLATE); B.box(b.x + 10, 49, b.z + 10, b.x + 14, 53, b.z + 14, M.BRASS); B.box(b.x + 12, 54, b.z + 12, b.x + 12, 57, b.z + 12, M.PIPE);
    // the garth: paths, a well, a tree, the arcade posts
    B.surf(148, 129, 152, 187, M.GRAVEL); B.surf(128, 156, 172, 160, M.GRAVEL);
    B.drum(150, 158, 4, 0, 3, M.STONE); B.drum(150, 158, 2, 2, 3, M.WATER); B.tree(138, 142, 14); B.tree(162, 174, 12);
    for (let z = 134; z <= 184; z += 10) { B.obox(132, z, 132, z, 0, 8, M.STONE); B.obox(168, z, 168, z, 0, 8, M.STONE); }
    B.obox(128, 129, 133, 187, 9, 9, M.KT_SLATE); B.obox(167, 129, 172, 187, 9, 9, M.KT_SLATE);
    // graves to the west, vines to the south
    for (let z = 96; z < 200; z += 14) for (let x = 34; x < 78; x += 12) { B.obox(x, z, x + 1, z, 0, 3, M.STONE); B.obox(x, z + 1, x + 1, z + 5, 0, 0, M.DIRT); }
    for (let x = 60; x < 250; x += 10) B.obox(x, 244, x + 1, 288, 0, 3, M.LEAF);
    K.scatter(26, 14, (x, z, h) => { if (x < 84 && z > 90 && z < 204) return; if (z > 238) return; if (x > 126 && x < 174 && z < 80) return; if (h < 0.45) B.tree(x, z, 12 + Math.floor(h * 16)); else if (h < 0.55) B.rock(x, z, 2 + Math.floor(h * 4)); });
    K.spawns('Pilgrim Road', 'Vineyard', 'Orchard', 'Graveyard');
    B.meta.bombs = [['Crypt', 'Reliquary Vault'], ['Chapter House', 'Infirmary'], ['Library', 'Scriptorium'], ['Monks Dormitory', 'Novices Dormitory'], ['Refectory', 'Kitchen'], ['Beer Cellar', 'Brewhouse']];
    B.meta.secure = ['Nave', 'Sanctuary', 'Treasury', 'Upper Library', 'Calefactory'];
    B.meta.hostage = ['Ossuary', 'Sacristy', "Prior's Cell", 'Guest Cells', "Abbot's Lodging"];
    B.meta.defSpawns = ['Sacristy', 'Scriptorium', 'Infirmary'];
    return B;
  }
  define({ id: 'cloister', name: 'CLOISTER', fn: cloister, blurb: 'Hilltop abbey round an open garth · dawn', cover: 'gardenwall', tint: 'rgba(200,150,110,0.36)' });

  /* =================================================================== BIODOME */
  function biodome() {
    const B = new Builder('biodome', 'BIODOME', 310, 64, 300);
    K.begin(B);
    B.meta.desc = 'A research garden in dry scrubland: a jungle growing under a glass dome, ringed by walkways on two floors, with the laboratories, the visitor centre, an arid house and the water plant built against it. Late afternoon.';
    B.theme({ sky: [0x3f7fc8, 0xf2d9a0], fog: 0xe6cfa0, fogFar: 165, lightOut: [1.08, 0.98, 0.84], lightIn: [0.7, 0.7, 0.62], sun: 0xfff0c8, outer: 0xb89a5c });
    B.ground(M.SAND);
    B.surf(0, 246, 309, 266, M.ASPHALT); B.surf(120, 231, 184, 246, M.CONCRETE);
    const b = B.building(110, 110, 85, 85, { lo: 0, hi: 2, ext: M.FACADE, inner: M.LAB_WHITE, slab: M.CONCRETE, roof: M.ROOF, parapet: M.METAL });
    const l = B.building(104, 74, 97, 37, { lo: 1, hi: 2, ext: M.FACADE, inner: M.LAB_WHITE, slab: M.LAB_FLOOR, roof: M.ROOF, parapet: M.METAL });
    const v = B.building(116, 194, 73, 37, { lo: 1, hi: 2, ext: M.STUCCO, inner: M.DRY_BEIGE, slab: M.TILE, roof: M.ROOF, parapet: M.KT_TEAL });
    const a = B.building(194, 122, 49, 61, { lo: 1, hi: 1, ext: M.FACADE, inner: M.LAB_WHITE, slab: M.SAND, roof: M.GLASS, parapet: M.METAL });
    const p = B.building(74, 122, 37, 61, { lo: 0, hi: 1, ext: M.CONCRETE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.ROOF, parapet: M.BLUE_PAINT });
    K.shells(B);
    b.pal = [M.LAB_WHITE, M.DRY_GREY]; b.plain = true; b.pillar = M.METAL; l.pal = [M.LAB_WHITE, M.DRY_BLUE, M.PANEL_DARK]; v.pal = [M.DRY_BEIGE, M.DRY_SAGE]; p.pal = [M.DRY_GREY, M.CONCRETE]; p.plain = a.plain = true;

    K.plan(b, 0, `
      0-36: Seed Vault 28 | Irrigation Plant 56 | Water Tanks 84
      36-48: Service Tunnel 84
      48-84: Root Lab 28 | Compost Store 56 | Mulch Bunker 84`);
    K.plan(b, 1, `
      0-12: North Concourse 84
      12-72: West Concourse 12 | Jungle Biome~ 72 | East Concourse 84
      72-84: South Concourse 84`);
    K.plan(b, 2, `
      0-12: North Canopy Walk 84
      12-72: West Canopy Walk 12 | Canopy Catwalk~ 72 | East Canopy Walk 84
      72-84: South Canopy Walk 84`);
    K.flight(b, 1, 2, 30, '+z', 4); K.flight(b, 1, 79, 54, '-z', 4);
    K.flight(b, 0, 30, 38, '+x', 4); K.flight(b, 0, 60, 20, '+z', 4);
    K.round(b, 2, 42, 42, 24);
    // the jungle floor: moss, a pond, trees up through the canopy ring, undergrowth
    B.w.fill(b.X(13), 12, b.Z(13), b.X(71), 12, b.Z(71), (x, y, z, cur) => cur ? M.KT_MOSS : -1);
    B.w.fill(b.X(46), 12, b.Z(50), b.X(56), 12, b.Z(58), (x, y, z, cur) => cur ? M.WATER : -1);
    for (const [x, z, h] of [[32, 30, 18], [52, 26, 20], [58, 46, 17], [36, 56, 19], [48, 62, 16], [26, 48, 18]]) B.tree(b.X(x), b.Z(z), h);
    for (let z = 16; z < 70; z += 7) for (let x = 16; x < 70; x += 7) {
      const h = U.hash3(x, 5, z), lx = x + Math.floor(h * 4), lz = z + Math.floor(U.hash3(z, 9, x) * 4);
      if (h > 0.5 || !K.stand(b.X(lx), 1, b.Z(lz)) || !K.stand(b.X(lx + 3), 1, b.Z(lz + 2))) continue;
      if (h < 0.3) b.box(1, lx, lz, lx + 3, lz + 2, 0, 1 + Math.floor(h * 10), M.LEAF); else B.rock(b.X(lx + 1), b.Z(lz + 1), 2);
    }

    K.plan(l, 1, `
      0-24: Hydroponics Lab 26 | Genetics Lab 52 | - 64 | Soil Lab 96
      24-36: Lab Corridor 96`);
    K.plan(l, 2, `
      0-24: Climate Control 26 | Entomology Lab 52 | - 64 | Herbarium 96
      24-36: Upper Lab Corridor 96`);
    K.well(l, 'Lab Stairs', 52, 0, 'z', 1, 2);
    K.plan(v, 1, `
      0-12: Visitor Hall 72
      12-36: Gift Shop 24 | - 36 | Cafe 72`);
    K.plan(v, 2, `
      0-12: Terrace Corridor 72
      12-36: Education Room 24 | - 36 | Staff Office 72`);
    K.well(v, 'Visitor Stairs', 24, 12, 'z', 1, 2);
    K.plan(a, 1, `
      0-36: Arid House~ 48
      36-60: Butterfly House 24 | Potting Shed 48`);
    for (const [x, z, h] of [[10, 8, 7], [22, 20, 9], [36, 10, 6], [40, 26, 8], [12, 28, 5], [28, 6, 5]]) { a.box(1, x, z, x + 1, z + 1, 0, h, M.LEAF); a.box(1, x - 1, z, x - 1, z, 3, 5, M.LEAF); a.box(1, x + 2, z + 1, x + 2, z + 1, 2, 4, M.LEAF); }
    for (const [x, z] of [[18, 12], [32, 22], [8, 20]]) B.rock(a.X(x), a.Z(z), 2);
    K.plan(p, 0, `
      0-24: Cistern 36
      24-36: Pipe Corridor 36
      36-60: Filter Room 24 | - 36`);
    K.plan(p, 1, `
      0-24: Chiller Hall 36
      24-36: Plant Corridor 36
      36-60: Boiler Plant 24 | - 36`);
    K.well(p, 'Plant Stairs', 24, 36, 'z', 0, 1);

    K.finish({ hatch: 3, cams: 8 });
    // the dome: the roof opened under a shell of glass and steel ribs
    const cx = b.X(42), cz = b.Z(42), R = 40, top = d => 37 + Math.floor(18 * Math.sqrt(Math.max(0, 1 - (d / R) * (d / R))));
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > R) continue;
      const x = cx + dx, z = cz + dz, rib = Math.abs(dx) % 10 === 0 || Math.abs(dz) % 10 === 0;
      if (d < R - 1) B.w.fill(x, 36, z, x, 38, z, 0);
      B.w.fill(x, Math.min(top(d), top(d + 1.5)), z, x, top(d), z, rib ? M.METAL : M.GLASS);
    }
    // outside: solar arrays, a water tower, scrub
    for (let z = 100; z < 190; z += 16) for (let x = 262; x < 300; x += 14) { B.obox(x, z, x + 9, z + 5, 3, 3, M.PANEL_DARK); B.obox(x + 4, z + 2, x + 5, z + 3, 0, 2, M.PIPE); }
    B.drum(50, 96, 6, 14, 24, M.METAL); for (const [x, z] of [[46, 92], [54, 92], [46, 100], [54, 100]]) B.obox(x, z, x, z, 0, 13, M.PIPE);
    K.scatter(24, 14, (x, z, h) => { if (z > 228 && x > 110 && x < 194) return; if (z > 242 && z < 270) return; if (x > 256 && z > 96 && z < 194) return; if (h < 0.3) B.obox(x, z, x + 2, z + 2, 0, 1 + Math.floor(h * 8), M.LEAF); else if (h < 0.5) B.rock(x, z, 2 + Math.floor(h * 6)); else if (h < 0.56) B.tree(x, z, 12); });
    B.car(130, 250, 'x', M.CAR_W); B.car(160, 250, 'x', M.CAR_R);
    K.spawns('Research Road', 'Visitor Car Park', 'Solar Field', 'Pump Station');
    B.meta.bombs = [['Seed Vault', 'Irrigation Plant'], ['Root Lab', 'Compost Store'], ['Hydroponics Lab', 'Genetics Lab'], ['Climate Control', 'Entomology Lab'], ['Gift Shop', 'Cafe'], ['Butterfly House', 'Potting Shed']];
    B.meta.secure = ['Jungle Biome', 'Arid House', 'Water Tanks', 'Herbarium', 'Chiller Hall'];
    B.meta.hostage = ['Soil Lab', 'Education Room', 'Mulch Bunker', 'Boiler Plant', 'Staff Office'];
    B.meta.defSpawns = ['Genetics Lab', 'Root Lab', 'Cafe'];
    return B;
  }
  define({ id: 'biodome', name: 'BIODOME', fn: biodome, blurb: 'A jungle under glass in dry scrubland · late afternoon', cover: 'shelter', tint: 'rgba(70,150,90,0.38)' });

  /* =================================================================== FOUNDRY */
  function foundry() {
    const B = new Builder('foundry', 'FOUNDRY', 300, 64, 300);
    K.begin(B);
    B.meta.desc = 'A steelworks at the end of a shift: the casting hall round its blast furnace, glowing runners in the floor and a ladle on the crane, a rolling mill, the power house, and the office block at the gate. Smoky sunset.';
    B.theme({ sky: [0x3a2c3a, 0xe07840], fog: 0x7a4a3a, fogFar: 110, lightOut: [1.0, 0.72, 0.52], lightIn: [0.72, 0.6, 0.48], sun: 0xff9050, outer: 0x3a3430 });
    B.ground(M.GRAVEL);
    B.surf(0, 40, 299, 60, M.ASPHALT); B.surf(0, 250, 299, 262, M.DIRT);
    const b = B.building(100, 100, 121, 73, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const p = B.building(52, 106, 49, 61, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const r = B.building(148, 172, 73, 61, { lo: 1, hi: 2, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const o = B.building(100, 172, 49, 49, { lo: 1, hi: 3, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.STONE });
    K.shells(B);
    b.pal = [M.DRY_GREY, M.KT_TIMBER, M.PANEL_DARK]; b.pillar = M.KT_STEEL; b.plain = p.plain = r.plain = true; p.pal = [M.DRY_GREY, M.PANEL_DARK]; p.pillar = M.KT_STEEL; o.pal = [M.DRY_BEIGE, M.DRY_SAGE, M.DRY_RED];

    K.plan(b, 0, `
      0-48: Slag Pit 42 | Cooling Tunnel 84 | Sand Cellar 120
      48-72: Ash Store 30 | - 42 | Flue Chamber 78 | Blower Room 108 | - 120`);
    K.plan(b, 1, `
      0-48: Casting Hall~ 84 | Pattern Shop 120
      48-72: Mould Store 30 | - 42 | Core Room 78 | Blower House 108 | - 120`);
    K.plan(b, 2, `
      0-48: Crane Walk~ 84 | Pour Control 120
      48-72: Metallurgy Lab 30 | - 42 | Shift Office 78 | Time Office 108 | - 120`);
    K.well(b, 'Mould Stairs', 30, 48, 'z', 0, 2);
    K.well(b, 'Blower Stairs', 108, 48, 'z', 0, 2);
    K.atrium(b, 2, 7, 7, 77, 41);
    K.flight(b, 1, 79, 36, '-z', 4);
    // the furnace, its runner glowing in the floor, ingot moulds, the ladle on the crane
    b.tank(1, 24, 22, 8, 20, M.BRICK); b.tank(1, 24, 22, 6, 21, M.KT_STEEL); b.box(1, 33, 21, 34, 23, 0, 2, M.KT_MOLTEN);
    for (const h of [5, 11, 17]) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) { const d = dx * dx + dz * dz; if (d <= 64.5 && d > 49) b.box(1, 24 + dx, 22 + dz, 24 + dx, 22 + dz, h, h, M.KT_STEEL); }
    B.w.fill(b.X(35), 12, b.Z(22), b.X(72), 12, b.Z(22), M.KT_MOLTEN);
    for (const x of [44, 54, 64]) { B.w.fill(b.X(x), 12, b.Z(22), b.X(x), 12, b.Z(32), M.KT_MOLTEN); b.box(1, x - 2, 33, x + 2, 37, 0, 1, M.KT_STEEL); b.box(1, x - 1, 34, x + 1, 36, 1, 1, M.KT_MOLTEN); }
    b.box(2, 8, 21, 76, 23, 8, 9, M.KT_STEEL); b.box(2, 56, 20, 60, 24, 1, 5, M.KT_STEEL); b.box(2, 57, 21, 59, 23, 5, 5, M.KT_MOLTEN); b.box(2, 58, 22, 58, 22, 6, 7, M.PIPE);
    b.box(1, 44, 8, 50, 12, 0, 3, M.CRATE); b.box(1, 66, 8, 72, 12, 0, 5, M.SANDBAG); b.box(1, 10, 38, 16, 42, 0, 3, M.CRATE);

    K.plan(p, 0, `
      0-24: Condenser Pit 24 | Ash Tunnel 48
      24-36: Pipe Passage 48
      36-60: Feed Pump Room 18 | - 30 | Coal Chute 48`);
    K.plan(p, 1, `
      0-24: Boiler House 24 | Coal Bunker 48
      24-36: Engine Hall 48
      36-60: Fitter's Shop 18 | - 30 | Lamp Store 48`);
    K.plan(p, 2, `
      0-24: Dynamo Room 24 | Switch Room 48
      24-36: Power Gallery 48
      36-60: Chief Engineer 18 | - 30 | Instrument Room 48`);
    K.well(p, 'Power Stairs', 18, 36, 'z', 0, 2);

    K.plan(r, 1, `
      0-48: Rolling Mill~ 60
      48-72: Shear Room 18 | - 30 | Roll Store 60`, true);
    K.plan(r, 2, `
      0-48: Mill Gallery~ 60
      48-72: Inspection Office 18 | - 30 | Gauge Room 60`, true);
    K.well(r, 'Mill Stairs', 48, 18, 'x', 1, 2);
    K.atrium(r, 2, 7, 7, 41, 53);
    for (const x of [12, 28]) { r.box(1, x, 10, x + 4, 50, 0, 2, M.KT_STEEL); r.box(1, x + 1, 14, x + 3, 30, 3, 3, M.KT_MOLTEN); r.box(1, x - 2, 32, x + 6, 36, 0, 7, M.METAL); r.box(1, x + 1, 32, x + 3, 36, 3, 4, 0); }
    r.box(1, 40, 6, 44, 10, 0, 4, M.CRATE);
    r.shutterZ(1, 60, 14, 14);

    K.plan(o, 1, `
      0-24: Gatehouse Lobby 48
      24-48: Canteen 18 | - 30 | Wash House 48`);
    K.plan(o, 2, `
      0-24: Drawing Office 24 | Accounts Office 48
      24-48: Assay Lab 18 | - 30 | Pay Office 48`);
    K.plan(o, 3, `
      0-24: Boardroom 24 | Owner's Suite 48
      24-48: Deed Archive 18 | - 30 | Sample Room 48`);
    K.well(o, 'Office Stairs', 18, 24, 'z', 1, 3);

    K.finish({ hatch: 3, cams: 8 });
    // the stack, ore wagons on the siding, slag and coal
    B.drum(72, 190, 5, 0, 46, M.BRICK); B.drum(72, 190, 3, 0, 47, 0); B.drum(72, 190, 5, 47, 47, M.DARK);
    for (const z of [254, 258]) B.obox(20, z, 280, z, 0, 0, M.RAIL);
    for (let x = 40; x < 240; x += 34) { B.obox(x, 252, x + 22, 260, 1, 6, M.RUST); B.obox(x + 1, 253, x + 21, 259, 4, 6, 0); B.obox(x + 1, 253, x + 21, 259, 3, 3, M.DARK); }
    K.scatter(26, 14, (x, z, h) => { if (z > 246 && z < 266) return; if (z > 36 && z < 64) return; if (h < 0.28) B.rock(x, z, 3 + Math.floor(h * 12)); else if (h < 0.42) B.obox(x, z, x + 4, z + 4, 0, 2 + Math.floor(h * 10) % 3, M.DARK); else if (h < 0.52) B.drum(x, z, 2, 0, 4, M.RUST); else if (h < 0.6) B.lamp(x, z, 16, M.LAMP_R); });
    B.truck(150, 46, 'x', M.CAR_K);
    K.spawns('Works Gate', 'Rail Siding', 'Slag Heap', 'Canal Wharf');
    B.meta.bombs = [['Slag Pit', 'Cooling Tunnel'], ['Mould Store', 'Core Room'], ['Metallurgy Lab', 'Shift Office'], ['Boiler House', 'Coal Bunker'], ['Drawing Office', 'Accounts Office'], ['Dynamo Room', 'Switch Room']];
    B.meta.secure = ['Casting Hall', 'Rolling Mill', 'Pour Control', 'Engine Hall', 'Boardroom'];
    B.meta.hostage = ['Sand Cellar', 'Pattern Shop', 'Assay Lab', "Owner's Suite", 'Roll Store'];
    B.meta.defSpawns = ['Core Room', 'Shift Office', 'Flue Chamber'];
    return B;
  }
  define({ id: 'foundry', name: 'FOUNDRY', fn: foundry, blurb: 'Steelworks round a blast furnace · smoky sunset', cover: 'boxcar', tint: 'rgba(200,100,50,0.38)' });
})();
