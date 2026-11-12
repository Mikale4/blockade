/* maps-rework-d.js -- the remaining first maps rebuilt far larger, each in several parts, on the
   layout kit (maps-kit.js). Each replaces the map of the same id in maps.js:
     SUMMIT LODGE  a mountain hotel: a great hall open through two floors round a stone hearth, a
                   guest wing, a spa with a sunken pool, a gondola station, an attic
     HOMESTEAD     a farm compound: farmhouse and attic, a bunker under the yard, a barn open
                   through two floors, a dairy and machine shed
     HELIX LABS    an island research campus round a glass atrium with a helix sculpture
     CANNERY       a harbour cannery: the processing hall under a catwalk, ice plant, offices,
                   a smokehouse and net loft, a boat shed
     RAIL DEPOT    station and clock tower, engine shed over inspection pits, goods warehouse,
                   a freight tunnel under the tracks
     MUSEUM        a natural-history museum: atrium and fossil, two gallery wings, vaults, an attic */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, THEMES, define } = MAPS;
  const K = MAPS.KIT;

  /* =================================================================== SUMMIT LODGE */
  function lodge() {
    const B = new Builder('lodge', 'SUMMIT LODGE', 304, 64, 300);
    K.begin(B);
    B.meta.desc = 'A grand log-and-stone mountain hotel snowed in above the valley: a great hall open through two floors round a stone hearth, a guest wing, a spa with a sunken pool and a gondola station. Overcast and cold.';
    B.theme(THEMES.snow);
    B.ground(M.SNOW);
    B.surf(0, 40, 303, 62, M.ASPHALT); B.surf(140, 62, 176, 104, M.GRAVEL);
    const b = B.building(100, 105, 113, 73, { lo: 0, hi: 3, ext: M.LOGWALL, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.SNOW });
    const g = B.building(212, 95, 39, 105, { lo: 1, hi: 2, ext: M.LOGWALL, inner: M.DRY_SAGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.SNOW });
    const s = B.building(52, 115, 49, 61, { lo: 0, hi: 1, ext: M.STONE, inner: M.DRY_WHITE, slab: M.TILE, roof: M.ROOF, parapet: M.SNOW });
    const k = B.building(120, 177, 71, 43, { lo: 1, hi: 2, ext: M.KT_TIMBER, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.SNOW });
    K.shells(B);
    b.pal = [M.DRY_BEIGE, M.DRY_RED, M.DRY_SAGE, M.KT_TIMBER]; b.pillar = M.LOGWALL;
    g.pal = [M.DRY_SAGE, M.DRY_BLUE, M.DRY_BEIGE]; k.pal = [M.DRY_GREY, M.KT_TIMBER];

    K.plan(b, 0, `
      0-36: Wine Cellar 34 | Boiler Room 78 | Ski Lockers 112
      36-48: Cellar Passage 112
      48-72: Laundry 28 | - 40 | Cold Store 66 | Generator Room 100 | - 112`);
    K.plan(b, 1, `
      0-36: Dining Room 34 | Great Hall~ 78 | Bar Lounge 112
      36-48: Lobby Hall 112
      48-72: Kitchen 28 | - 40 | Reception 66 | Ski Shop 100 | - 112`);
    K.plan(b, 2, `
      0-36: Library 34 | Hall Gallery~ 78 | Billiards 112
      36-48: Upper Hall 112
      48-72: Master Suite 28 | - 40 | Trophy Room 66 | Card Room 100 | - 112`);
    K.plan(b, 3, `
      0-36: Attic Dormitory 44 | Trunk Store 78 | Radio Room 112
      36-48: Attic Hall 112
      48-72: Staff Quarters 28 | - 40 | Linen Store 66 | Games Loft 100 | - 112`);
    K.well(b, 'West Stairs', 28, 48, 'z', 0, 3);
    K.well(b, 'East Stairs', 100, 48, 'z', 0, 3);
    // the great hall: open to the gallery above, a stone hearth in the middle, a stair up the west side
    K.atrium(b, 2, 40, 6, 72, 30);
    b.fireplace(1, 2, 54, 14, 58, 22);
    K.flight(b, 1, 35, 30, '-z', 4);
    for (const x of [44, 66]) { b.couch(1, x, 12, x + 2, 22, M.FAB_RED, x < 50 ? 'w' : 'e'); b.box(1, x, 28, x + 3, 31, 0, 2, M.TRIM); }
    b.box(1, 50, 26, 62, 30, 0, 0, M.FAB_RED);
    b.cellar('n', 20);

    K.plan(g, 1, `
      0-14: East Corridor 104
      14-38: Guest Room 1 22 | Guest Room 2 44 | - 56 | Guest Room 3 80 | Ski Store 104`, true);
    K.plan(g, 2, `
      0-14: East Gallery 104
      14-38: Guest Room 4 22 | Guest Room 5 44 | - 56 | Guest Room 6 80 | Honeymoon Suite 104`, true);
    K.well(g, 'Guest Stairs', 14, 44, 'x', 1, 2);

    K.plan(s, 0, `
      0-36: Pump Room 22 | Plant Room 48
      36-60: Massage Room 16 | Steam Room 36 | - 48`);
    K.plan(s, 1, `
      0-36: Pool Hall~ 48
      36-60: Sauna 16 | Changing Room 36 | - 48`);
    K.well(s, 'Spa Stairs', 36, 36, 'z', 0, 1);
    // the sunken pool: a tiled basin hung under the floor, one step down into the water
    s.box(0, 9, 7, 39, 29, 9, 9, M.TILE); s.box(0, 10, 8, 38, 28, 10, 10, M.WATER); s.void(1, 10, 8, 38, 28);
    for (const x of [4, 42]) for (const z of [6, 16, 26]) s.box(1, x, z, x + 2, z + 5, 0, 1, M.WHITE);

    K.plan(k, 1, `
      0-30: Gondola Hall~ 46 | Ski Workshop 70
      30-42: Wax Room 22 | Ticket Office 46 | - 70`);
    K.plan(k, 2, `
      0-30: Cable Gallery~ 46 | Lift Control 70
      30-42: Machine Loft 22 | Rental Office 46 | - 70`);
    K.well(k, 'Lift Stairs', 46, 30, 'x', 1, 2);
    K.atrium(k, 2, 8, 7, 38, 23);
    // two gondola cabins hanging on the cable, and the bull wheel
    for (const x of [12, 28]) { k.box(1, x, 11, x + 7, 18, 2, 9, M.RED_PAINT); k.box(1, x + 1, 11, x + 6, 18, 5, 7, M.GLASS); k.box(1, x + 1, 12, x + 6, 17, 3, 8, 0); k.box(1, x + 3, 14, x + 4, 15, 10, 20, M.PIPE); }
    k.box(2, 6, 14, 40, 15, 9, 9, M.PIPE);
    k.shutterZ(1, 42, 6, 14);

    const res = K.finish({ hatch: 3, cams: 8 });
    B.meta.auto = res;
    // outside: pines, boulders, the car park and the lift line running south
    K.scatter(22, 12, (x, z, h) => { if (z > 36 && z < 66) return; if (h < 0.62) B.tree(x, z, 16 + Math.floor(h * 14), true, true); else if (h < 0.8) B.rock(x, z, 3 + Math.floor(h * 4), M.SNOW); });
    B.car(150, 68, 'x', M.CAR_R); B.car(182, 68, 'x', M.CAR_W); B.truck(60, 46, 'x', M.CAR_K);
    for (let z = 226; z < 296; z += 22) { B.obox(154, z, 155, z + 1, 0, 26, M.PIPE); B.obox(150, z, 159, z + 1, 26, 26, M.PIPE); }
    K.spawns('Access Road', 'Lift Line', 'East Slope', 'West Ridge');
    B.meta.bombs = [['Wine Cellar', 'Boiler Room'], ['Dining Room', 'Kitchen'], ['Library', 'Billiards'], ['Master Suite', 'Trophy Room'], ['Attic Dormitory', 'Radio Room']];
    B.meta.secure = ['Great Hall', 'Pool Hall', 'Boiler Room', 'Card Room', 'Ski Workshop'];
    B.meta.hostage = ['Wine Cellar', 'Master Suite', 'Lift Control', 'Sauna', 'Staff Quarters'];
    B.meta.defSpawns = ['Reception', 'Library', 'Cold Store'];
    return B;
  }
  define({ id: 'lodge', name: 'SUMMIT LODGE', fn: lodge, blurb: 'Mountain hotel, spa & gondola station · snow', cover: 'woodshed', tint: 'rgba(170,190,210,0.36)' });
  /* =================================================================== HOMESTEAD */
  mat('HS_BARN', 0x8a2f24, { hp: 5, pen: 0.55, xp: true, hb: true, pat: 'planks', wall: true });
  function homestead() {
    const B = new Builder('homestead', 'HOMESTEAD', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A family farm with more under it than over it: a farmhouse and attic, a prepper bunker beneath the yard that runs from the cellar to the barn, a hay barn open through two floors, and a dairy and tractor shed. Afternoon.';
    B.theme(THEMES.farm);
    B.ground(M.GRASS);
    B.surf(0, 30, 299, 46, M.DIRT); B.surf(104, 46, 122, 109, M.DIRT);
    B.surf(159, 111, 217, 169, M.GRAVEL);
    for (let z = 222; z < 286; z += 6) B.surf(20, z, 200, z + 2, M.DIRT);
    const b = B.building(70, 110, 89, 61, { lo: 0, hi: 3, ext: M.SIDING, inner: M.DRY_WHITE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.WHITE });
    const u = B.building(158, 110, 61, 61, { lo: 0, hi: 0, ext: M.GRAVEL, inner: M.DRY_GREY, roof: M.GRAVEL });
    const n = B.building(218, 104, 55, 73, { lo: 0, hi: 2, ext: M.HS_BARN, inner: M.KT_TIMBER, slab: M.WOODFLOOR, roof: M.CORRUGATE, parapet: M.WHITE });
    const d = B.building(80, 170, 73, 37, { lo: 1, hi: 1, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    K.shells(B);
    b.pal = [M.DRY_WHITE, M.DRY_BEIGE, M.DRY_BLUE, M.DRY_SAGE]; u.pal = [M.CONCRETE, M.DRY_GREY, M.DRY_GREY]; u.plain = true; n.pal = [M.KT_TIMBER]; n.pillar = M.WOOD;

    K.plan(b, 0, `
      0-24: Root Cellar 30 | Canning Kitchen 60 | Furnace Room 88
      24-36: Cellar Hall 88
      36-60: Workshop Cellar 26 | - 38 | Coal Store 62 | Storm Shelter 88`);
    K.plan(b, 1, `
      0-24: Kitchen 30 | Dining Room 60 | Living Room 88
      24-36: Front Hall 88
      36-60: Mud Room 26 | - 38 | Farm Office 62 | Parlour 88`);
    K.plan(b, 2, `
      0-24: Master Bedroom 30 | Kids Room 60 | Guest Bedroom 88
      24-36: Upper Hall 88
      36-60: Bathroom 26 | - 38 | Sewing Room 62 | Nursery 88`);
    K.plan(b, 3, `
      0-24: Attic Store 44 | Attic Bedroom 88
      24-36: Attic Landing 88
      36-60: Trunk Room 26 | - 38 | Pigeon Loft 88`);
    K.well(b, 'House Stairs', 26, 36, 'z', 0, 3);
    K.flight(b, 0, 12, 26, '+x', 4); K.flight(b, 1, 62, 26, '+x', 4); K.flight(b, 2, 40, 26, '+x', 4);
    b.cellar('n', 70);

    // the bunker under the yard: from the farmhouse cellar to the barn cellar
    K.plan(u, 0, `
      0-24: Bunk Room 20 | Command Room 42 | Armory 60
      24-36: Bunker Passage 60
      36-60: Water Store 20 | Diesel Room 42 | Decon Room 60`);
    u.cellar('n', 28);
    u.hatch(1, 28, 28); u.hatch(1, 48, 44);
    B.obox(u.X(26), u.Z(26), u.X(33), u.Z(26), 0, 3, M.WOOD); B.obox(u.X(26), u.Z(33), u.X(33), u.Z(33), 0, 3, M.WOOD);

    K.plan(n, 0, `
      0-42: Barn Cellar 36 | Cider Cellar 72
      42-54: Seed Store 24 | - 48 | Apple Store 72`, true);
    K.plan(n, 1, `
      0-16: Stable 36 | Tack Room 72
      16-42: Barn Floor~ 72
      42-54: Feed Store 24 | - 48 | Calf Pen 72`, true);
    K.plan(n, 2, `
      0-16: West Loft 72
      16-42: Hay Loft~ 72
      42-54: Loft Store 24 | - 48 | Grain Bins 72`, true);
    K.well(n, 'Barn Stairs', 42, 24, 'z', 0, 2);
    K.atrium(n, 2, 22, 12, 36, 60);
    n.shutterZ(1, 0, 22, 14); n.shutterZ(1, 72, 22, 14);
    for (const [x, z, h] of [[19, 8, 3], [34, 20, 6], [19, 34, 3], [33, 46, 3], [20, 58, 6]]) n.box(1, x, z, x + 6, z + 4, 0, h, M.HAY);
    for (const z of [3, 26, 50]) n.box(2, 18, z, 21, z + 8, 0, 4, M.HAY);
    n.box(1, 26, 30, 31, 40, 1, 4, M.RED_PAINT); n.box(1, 27, 28, 30, 29, 1, 5, M.METAL);     // a hay wagon

    K.plan(d, 1, `
      0-36: Milking Parlour 24 | Dairy 44 | Tractor Shed~ 72`);
    d.box(1, 52, 8, 62, 22, 1, 5, M.RED_PAINT); d.box(1, 54, 10, 60, 14, 6, 9, M.RED_PAINT); d.box(1, 55, 11, 59, 13, 7, 8, M.GLASS);
    for (const [x, z] of [[51, 8], [51, 19], [63, 8], [63, 19]]) d.box(1, x, z, x, z + 3, 0, 4, M.TIRE);
    d.box(1, 48, 28, 56, 33, 0, 3, M.CRATE); d.shutterZ(1, 36, 50, 14);

    K.finish({ hatch: 3, cams: 8 });
    // the silo, the well, fences, an orchard
    B.drum(246, 196, 8, 0, 34, M.CORRUGATE); B.drum(246, 196, 6, 35, 37, M.METAL);
    B.drum(140, 86, 3, 0, 3, M.STONE);
    B.fence(40, 100, 40, 215, M.WOOD, 4); B.fence(40, 215, 215, 215, M.WOOD, 4);
    K.scatter(24, 14, (x, z, h) => { if (z > 26 && z < 50) return; if (z > 218 && x < 204) return; if (h < 0.42) B.tree(x, z, 12 + Math.floor(h * 16)); else if (h < 0.55) B.obox(x, z, x + 5, z + 3, 0, 3, M.HAY); });
    B.truck(120, 34, 'x', M.CAR_R);
    K.spawns('County Road', 'Corn Field', 'Orchard', 'Creek');
    B.meta.bombs = [['Command Room', 'Armory'], ['Root Cellar', 'Canning Kitchen'], ['Kitchen', 'Dining Room'], ['Master Bedroom', 'Kids Room'], ['Feed Store', 'Calf Pen']];
    B.meta.secure = ['Diesel Room', 'Living Room', 'Barn Floor', 'Dairy', 'Attic Bedroom'];
    B.meta.hostage = ['Bunk Room', 'Nursery', 'Tack Room', 'Storm Shelter', 'Farm Office'];
    B.meta.defSpawns = ['Farm Office', 'Kids Room', 'Command Room'];
    return B;
  }
  define({ id: 'homestead', name: 'HOMESTEAD', fn: homestead, blurb: 'Farmhouse, bunker, barn & dairy · afternoon', cover: 'haywall', tint: 'rgba(120,150,70,0.36)' });

  /* =================================================================== HELIX LABS */
  function helix() {
    const B = new Builder('helix', 'HELIX LABS', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'An island research campus built round a glass atrium where a double helix climbs three floors: laboratories on every side of it, a containment wing, a dock house and a specimen vault below. Night.';
    B.theme(THEMES.night);
    B.ground(M.GRASS);
    B.surf(0, 0, 299, 40, M.SAND); B.surf(0, 250, 299, 289, M.SAND); B.surf(247, 130, 299, 166, M.DOCK);
    B.surf(120, 60, 180, 104, M.CONCRETE);
    const b = B.building(95, 105, 109, 85, { lo: 0, hi: 3, ext: M.FACADE, inner: M.LAB_WHITE, slab: M.LAB_FLOOR, roof: M.ROOF, parapet: M.METAL });
    const c = B.building(47, 115, 49, 61, { lo: 0, hi: 1, ext: M.CONCRETE, inner: M.LAB_WHITE, slab: M.LAB_FLOOR, roof: M.ROOF, parapet: M.RED_PAINT });
    const r = B.building(203, 120, 45, 55, { lo: 1, hi: 2, ext: M.CORRUGATE, inner: M.DRY_BLUE, slab: M.CONCRETE, roof: M.ROOF, parapet: M.BLUE_PAINT });
    K.shells(B);
    b.pal = [M.LAB_WHITE, M.DRY_WHITE, M.DRY_BLUE, M.PANEL_DARK]; b.pillar = M.METAL; c.pal = [M.LAB_WHITE, M.PANEL_DARK]; r.pal = [M.DRY_BLUE, M.DRY_GREY];

    K.plan(b, 0, `
      0-24: Specimen Vault 30 | Cold Vault 66 | - 78 | Pump Room 108
      24-60: Generator Hall 36 | Containment 72 | Reactor Room 108
      60-84: Incinerator 30 | - 42 | Morgue 78 | Hazmat Store 108`);
    K.plan(b, 1, `
      0-24: Security Office 30 | Cryo Lab 66 | - 78 | Sample Prep 108
      24-60: West Lab 36 | Helix Atrium~ 72 | East Lab 108
      60-84: Conference 30 | - 42 | Clean Room 78 | Data Office 108`);
    K.plan(b, 2, `
      0-24: Genome Lab 30 | Imaging 66 | - 78 | Chem Store 108
      24-60: Culture Lab 36 | Atrium Gallery~ 72 | Server Farm 108
      60-84: Observation Deck 30 | - 42 | Director Office 78 | Archive 108`);
    K.plan(b, 3, `
      0-24: Greenhouse Lab 30 | Telemetry 66 | - 78 | Vent Plant 108
      24-60: Residence Lounge 36 | Sky Gallery~ 72 | Dormitory 108
      60-84: Canteen 30 | - 42 | Briefing Room 78 | Radio Room 108`);
    K.well(b, 'North Stairs', 66, 0, 'z', 0, 3);
    K.well(b, 'South Stairs', 30, 60, 'z', 0, 3);
    K.flight(b, 2, 4, 30, '+z', 4); K.flight(b, 0, 96, 30, '+z', 4); K.flight(b, 1, 76, 52, '-z', 4);
    // the atrium: a round well through two floors under a glass roof, and the helix
    K.round(b, 2, 54, 42, 12); K.round(b, 3, 54, 42, 12);
    const cx = b.X(54), cz = b.Z(42);
    for (let dz = -13; dz <= 13; dz++) for (let dx = -13; dx <= 13; dx++) if (dx * dx + dz * dz <= 169) B.w.put(cx + dx, b.roofY, cz + dz, (dx + dz) % 6 === 0 ? M.METAL : M.GLASS);
    for (let y = 13; y <= 46; y++) {
      const a = (y - 13) * 0.36, ox = Math.round(Math.cos(a) * 5), oz = Math.round(Math.sin(a) * 5);
      B.w.put(cx + ox, y, cz + oz, M.NEON_B); B.w.put(cx - ox, y, cz - oz, M.NEON_P);
      if (y % 3 === 0) B.line(cx + ox, y, cz + oz, cx - ox, y, cz - oz, M.WHITE);
    }
    b.box(1, 48, 36, 60, 48, 0, 0, M.METAL);

    K.plan(c, 0, `
      0-24: Quarantine Cells 24 | Autopsy Lab 48
      24-36: Lower Airlock Corridor 48
      36-60: Waste Room 18 | - 30 | Crematory 48`);
    K.plan(c, 1, `
      0-24: Bio Lab 24 | Animal Lab 48
      24-36: Airlock Corridor 48
      36-60: Decon Showers 18 | - 30 | Tissue Bank 48`);
    K.well(c, 'Containment Stairs', 18, 36, 'z', 0, 1);

    K.plan(r, 1, `
      0-30: Boat Dock~ 44
      30-54: Dive Store 20 | - 32 | Dock Workshop 44`);
    K.plan(r, 2, `
      0-30: Harbor Office 22 | Crew Lounge 44
      30-54: Chart Room 20 | - 32 | Bunk Cabin 44`);
    K.well(r, 'Dock Stairs', 20, 30, 'z', 1, 2);
    r.shutterX(1, 44, 8, 14);
    r.box(1, 12, 8, 34, 16, 1, 4, M.WHITE); r.box(1, 14, 10, 32, 14, 3, 4, 0); r.box(1, 20, 10, 26, 14, 5, 7, M.BLUE_PAINT); r.box(1, 12, 9, 12, 15, 0, 0, M.WOOD); r.box(1, 34, 9, 34, 15, 0, 0, M.WOOD);
    r.box(1, 6, 22, 12, 26, 0, 3, M.CRATE); r.box(1, 30, 22, 38, 25, 0, 2, M.CONT_B);

    K.finish({ hatch: 3, cams: 8, ext: { p: 0.75 } });
    // the pier, a helipad, palms and rocks
    for (let x = 250; x < 296; x += 12) B.obox(x, 128, x + 1, 129, 0, 3, M.WOOD);
    B.surf(138, 68, 162, 92, M.LINE); B.surf(141, 71, 159, 89, M.CONCRETE);
    K.scatter(24, 12, (x, z, h) => { if (x > 116 && x < 184 && z < 104) return; if (x > 244 && z > 124 && z < 170) return; if (h < 0.4) B.tree(x, z, 14 + Math.floor(h * 12)); else if (h < 0.6) B.rock(x, z, 2 + Math.floor(h * 4)); });
    K.spawns('Helipad', 'South Beach', 'Pier', 'West Cove');
    B.meta.bombs = [['Specimen Vault', 'Cold Vault'], ['Cryo Lab', 'Security Office'], ['Genome Lab', 'Imaging'], ['Server Farm', 'Archive'], ['Dormitory', 'Radio Room'], ['Bio Lab', 'Animal Lab']];
    B.meta.secure = ['Containment', 'Helix Atrium', 'Clean Room', 'Director Office', 'Boat Dock'];
    B.meta.hostage = ['Morgue', 'Conference', 'Culture Lab', 'Quarantine Cells', 'Briefing Room'];
    B.meta.defSpawns = ['Clean Room', 'Genome Lab', 'Containment'];
    return B;
  }
  define({ id: 'helix', name: 'HELIX LABS', fn: helix, blurb: 'Island research campus round a helix atrium · night', cover: 'shelter', tint: 'rgba(50,120,170,0.36)' });

  /* =================================================================== CANNERY */
  function cannery() {
    const B = new Builder('cannery', 'CANNERY', 290, 64, 300);
    K.begin(B);
    B.meta.desc = 'A brick fish cannery on the harbour quay: the canning hall under its catwalk, an ice plant and brine cellars below, the office block with a smokehouse and a net loft, and a boat shed with a hull on the slip. Foggy morning.';
    B.theme(THEMES.harbor);
    B.ground(M.DOCK);
    B.surf(0, 0, 289, 70, M.ASPHALT); B.surf(0, 262, 289, 299, M.WATER); B.surf(230, 150, 289, 262, M.WATER);
    const b = B.building(100, 110, 121, 73, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const o = B.building(52, 110, 49, 73, { lo: 0, hi: 3, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.WHITE });
    const s = B.building(140, 182, 61, 49, { lo: 1, hi: 2, ext: M.KT_TIMBER, inner: M.KT_TIMBER, slab: M.WOODFLOOR, roof: M.CORRUGATE, parapet: M.BLUE_PAINT });
    K.shells(B);
    b.pal = [M.DRY_GREY, M.DRY_WHITE, M.DRY_BLUE]; b.pillar = M.METAL; o.pal = [M.DRY_BEIGE, M.DRY_SAGE, M.DRY_RED, M.KT_TIMBER]; s.pal = [M.KT_TIMBER]; s.pillar = M.WOOD;

    K.plan(b, 0, `
      0-48: Cold Storage 30 | Ice Plant 66 | Brine Tanks 96 | Fish Cellar 120
      48-72: Salt Store 30 | - 42 | Compressor Room 78 | Drain Tunnel 108 | - 120`);
    K.plan(b, 1, `
      0-48: Gutting Room 30 | Canning Hall~ 96 | Loading Bay 120
      48-72: Label Room 30 | - 42 | Packing Room 78 | Boiler House 108 | - 120`);
    K.plan(b, 2, `
      0-48: Foreman Office 30 | Line Catwalk~ 96 | Storage Loft 120
      48-72: Radio Room 30 | - 42 | Owner's Office 78 | Break Room 108 | - 120`);
    K.well(b, 'West Stairs', 30, 48, 'z', 0, 2);
    K.well(b, 'East Stairs', 108, 48, 'z', 0, 2);
    K.atrium(b, 2, 37, 7, 89, 41);
    K.flight(b, 1, 31, 30, '-z', 4);
    // two canning lines, the retort vats, and crates
    for (const z of [14, 30]) { b.box(1, 42, z, 84, z + 2, 0, 2, M.KT_STEEL); b.box(1, 42, z + 1, 84, z + 1, 3, 3, M.METAL); for (let x = 46; x < 84; x += 9) b.box(1, x, z, x + 1, z + 2, 3, 6, M.PIPE); }
    for (const x of [44, 60, 76]) b.tank(1, x, 42, 3, 7, M.BOILER);
    b.box(1, 86, 8, 92, 12, 0, 3, M.CRATE); b.box(1, 86, 20, 92, 26, 0, 5, M.CRATE);
    b.shutterZ(1, 0, 100, 14); b.shutterX(1, 120, 12, 14);

    K.plan(o, 0, `
      0-36: Smoke Cellar 24 | Coal Bunker 48
      36-48: Cellar Corridor 48
      48-72: Net Store 24 | - 36 | Tar Room 48`);
    K.plan(o, 1, `
      0-36: Smokehouse 24 | Scale Room 48
      36-48: Office Corridor 48
      48-72: Front Office 24 | - 36 | Pay Office 48`);
    K.plan(o, 2, `
      0-36: Accounts Office 24 | Drafting Room 48
      36-48: Upper Corridor 48
      48-72: Sample Kitchen 24 | - 36 | Chart Room 48`);
    K.plan(o, 3, `
      0-36: Net Loft 48
      36-48: Loft Landing 48
      48-72: Sail Store 24 | - 36 | Lookout 48`);
    K.well(o, 'Office Stairs', 24, 48, 'z', 0, 3);
    for (const x of [8, 20, 32]) o.box(3, x, 6, x, 30, 6, 9, M.FENCE);                      // nets hung to dry

    K.plan(s, 1, `
      0-36: Boat Shed~ 48
      36-60: Chandlery 18 | - 30 | Engine Shop 48`, true);
    K.plan(s, 2, `
      0-36: Slip Gallery~ 48
      36-60: Sail Loft 18 | - 30 | Shipwright Office 48`, true);
    K.well(s, 'Shed Stairs', 36, 18, 'x', 1, 2);
    K.atrium(s, 2, 7, 7, 29, 41);
    // the hull on the slip
    s.box(1, 12, 10, 24, 38, 3, 8, M.WOOD); s.box(1, 13, 11, 23, 37, 5, 8, 0); s.box(1, 15, 6, 21, 9, 4, 8, M.WOOD); s.box(1, 17, 3, 19, 5, 6, 8, M.WOOD);
    for (const z of [12, 24, 36]) s.box(1, 14, z, 22, z + 1, 0, 2, M.TRIM);
    s.box(1, 4, 40, 9, 44, 0, 3, M.CRATE); s.box(1, 28, 6, 32, 10, 0, 2, M.TIRE);
    s.shutterZ(1, 48, 10, 16);

    K.finish({ hatch: 3, cams: 8 });
    // the quay: a crane, a boat at the wall, stacked crates and nets
    B.obox(214, 236, 217, 239, 0, 34, M.RUST); B.obox(196, 236, 240, 239, 34, 36, M.RUST); B.obox(238, 237, 238, 238, 22, 33, M.PIPE);
    B.obox(236, 190, 250, 230, 0, 3, M.BLUE_PAINT); B.obox(238, 192, 248, 228, 2, 3, 0); B.obox(240, 204, 246, 214, 2, 7, M.WHITE);
    K.scatter(26, 12, (x, z, h) => { if (z > 258 || (x > 226 && z > 146)) return; if (h < 0.3) B.container(x, z, h < 0.15 ? 'x' : 'z', [M.CONT_R, M.CONT_B, M.CONT_G][Math.floor(h * 10) % 3]); else if (h < 0.5) B.obox(x, z, x + 3, z + 3, 0, 3 + Math.floor(h * 8) % 4, M.CRATE); else if (h < 0.58) B.dumpster(x, z); });
    B.truck(60, 50, 'x', M.CAR_W);
    K.spawns('Harbour Road', 'Quay', 'Fish Market', 'Dry Dock');
    B.meta.bombs = [['Cold Storage', 'Ice Plant'], ['Gutting Room', 'Label Room'], ['Packing Room', 'Boiler House'], ['Foreman Office', 'Radio Room'], ["Owner's Office", 'Break Room'], ['Accounts Office', 'Drafting Room']];
    B.meta.secure = ['Canning Hall', 'Compressor Room', 'Storage Loft', 'Net Loft', 'Boat Shed'];
    B.meta.hostage = ['Salt Store', 'Smokehouse', 'Chart Room', 'Sail Loft', 'Loading Bay'];
    B.meta.defSpawns = ['Packing Room', 'Foreman Office', 'Ice Plant'];
    return B;
  }
  define({ id: 'cannery', name: 'CANNERY', fn: cannery, blurb: 'Harbour cannery, offices & boat shed · foggy morning', cover: 'boatshed', tint: 'rgba(110,130,140,0.36)' });
  /* =================================================================== RAIL DEPOT */
  function depot() {
    const B = new Builder('depot', 'RAIL DEPOT', 330, 64, 330);
    K.begin(B);
    B.meta.desc = 'A brick railway terminus: the station round its galleried concourse with a clock tower on the corner, a train standing at the platform, a freight tunnel under the tracks, an engine shed with two locomotives over their pits, and a goods warehouse. Rainy dusk.';
    B.theme(THEMES.rain);
    B.ground(M.GRAVEL);
    B.surf(0, 40, 329, 66, M.ASPHALT); B.surf(60, 66, 250, 99, M.CONCRETE);
    B.surf(40, 161, 300, 171, M.DOCK);
    const b = B.building(95, 100, 113, 61, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.TILE, roof: M.ROOF, parapet: M.STONE });
    const t = B.building(71, 100, 25, 25, { lo: 1, hi: 3, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.KT_SLATE, parapet: M.STONE });
    const u = B.building(95, 160, 113, 37, { lo: 0, hi: 0, ext: M.GRAVEL, inner: M.DRY_GREY, roof: M.GRAVEL });
    const e = B.building(115, 196, 73, 85, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.CORRUGATE, parapet: M.RUST });
    const g = B.building(187, 205, 85, 49, { lo: 1, hi: 2, ext: M.CORRUGATE, inner: M.DRY_GREY, slab: M.WOODFLOOR, roof: M.CORRUGATE, parapet: M.RUST });
    K.shells(B);
    b.pal = [M.DRY_BEIGE, M.DRY_RED, M.DRY_SAGE, M.DRY_GREY]; b.pillar = M.STONE; u.pal = [M.CONCRETE, M.DRY_GREY]; u.plain = true; e.pal = [M.DRY_GREY, M.KT_TIMBER]; e.pillar = M.KT_STEEL; g.pal = [M.DRY_GREY, M.KT_TIMBER];

    K.plan(b, 0, `
      0-24: Coal Store 28 | Boiler Room 56 | - 68 | Lamp Room 112
      24-60: Mail Vault 28 | Baggage Tunnel 84 | Cellar Bar 112`);
    K.plan(b, 1, `
      0-24: Ticket Office 28 | Parcels Office 56 | - 68 | Waiting Room 112
      24-60: Station Cafe 28 | Grand Concourse~ 84 | Left Luggage 112`);
    K.plan(b, 2, `
      0-24: Station Master's Office 28 | Records Room 56 | - 68 | Pay Office 112
      24-60: Archive 28 | Concourse Gallery~ 84 | Lost Property 112`);
    K.well(b, 'Station Stairs', 56, 0, 'z', 0, 2);
    K.atrium(b, 2, 34, 31, 78, 53);
    K.flight(b, 1, 29, 52, '-z', 4); K.flight(b, 1, 80, 52, '-z', 4);
    for (const x of [40, 62]) { b.box(1, x, 36, x + 10, 37, 0, 1, M.WOOD); b.box(1, x, 46, x + 10, 47, 0, 1, M.WOOD); }
    b.box(1, 52, 40, 60, 44, 0, 8, M.TRIM); b.box(1, 53, 41, 59, 43, 0, 7, 0); b.box(1, 54, 44, 58, 44, 0, 6, 0); b.box(1, 52, 40, 60, 44, 9, 10, M.SCREEN);

    K.plan(t, 1, `0-24: - 12 | Tower Lobby 24`);
    K.plan(t, 2, `0-24: - 12 | Telegraph Office 24`);
    K.plan(t, 3, `0-24: - 12 | Clock Room 24`);
    K.well(t, 'Tower Stairs', 0, 0, 'z', 1, 3);

    // the freight tunnel under the tracks: from the station cellars to the engine shed's pit level
    K.plan(u, 0, `0-36: Freight Tunnel~ 80 | Tunnel Store 112`);
    K.flight(u, 0, 8, 6, '+x', 5); K.flight(u, 0, 76, 26, '-x', 5);
    u.hatch(1, 40, 4); u.hatch(1, 96, 30);
    for (const x of [26, 46, 62]) u.box(0, x, 16, x + 7, 21, 0, 4, M.CRATE);
    u.box(0, 30, 28, 42, 32, 0, 2, M.RUST); u.box(0, 31, 29, 41, 31, 1, 2, 0);

    K.plan(e, 0, `
      0-48: Pit Level~ 84
      48-72: Oil Store 24 | - 36 | Sand House 60 | Parts Cellar 84`, true);
    K.plan(e, 1, `
      0-48: Engine Shed~ 84
      48-72: Machine Shop 24 | - 36 | Tool Crib 60 | Crew Room 84`, true);
    K.plan(e, 2, `
      0-48: Shed Gallery~ 84
      48-72: Drawing Office 24 | - 36 | Crew Bunks 60 | Signal School 84`, true);
    K.well(e, 'Shed Stairs', 48, 24, 'x', 0, 2);
    K.atrium(e, 2, 6, 6, 42, 78);
    // two locomotives standing over their inspection pits
    for (const [x, z0, z1, m] of [[10, 16, 66, M.DARK], [28, 24, 62, M.RED_PAINT]]) {
      e.void(1, x + 3, z0 + 4, x + 6, z1 - 4);
      e.box(1, x, z0, x + 9, z1, 2, 8, m); e.box(1, x, z1 - 10, x + 9, z1, 9, 10, M.KT_STEEL); e.box(1, x + 1, z1 - 9, x + 8, z1 - 1, 5, 8, 0); e.box(1, x, z1 - 7, x + 9, z1 - 3, 6, 7, 0);
      e.box(1, x, z0 + 2, x + 1, z1 - 2, 0, 1, M.METAL); e.box(1, x + 8, z0 + 2, x + 9, z1 - 2, 0, 1, M.METAL); e.box(1, x + 3, z0 + 3, x + 6, z0 + 6, 9, 12, M.PIPE);
    }
    for (const [x, z] of [[22, 12], [22, 40], [22, 70], [42, 50]]) e.box(0, x, z, x + 2, z + 2, 0, 10, M.CONCRETE);
    for (const [x, z] of [[4, 8], [40, 14], [6, 72], [38, 74]]) e.box(0, x, z, x + 4, z + 4, 0, 3, M.CRATE);
    e.box(1, 22, 70, 26, 76, 0, 4, M.CRATE); e.box(1, 42, 8, 46, 12, 0, 6, M.METAL);
    e.shutterZ(1, 84, 9, 12); e.shutterZ(1, 84, 27, 12);

    K.plan(g, 1, `
      0-24: Weigh Office 22 | - 34 | Customs Cage 60 | Bonded Store 84
      24-48: Goods Shed~ 84`);
    K.plan(g, 2, `
      0-24: Clerk's Office 22 | - 34 | Stationery Store 60 | Agent's Office 84
      24-48: Goods Gallery~ 84`);
    K.well(g, 'Goods Stairs', 22, 0, 'z', 1, 2);
    K.atrium(g, 2, 7, 31, 77, 41);
    for (const [x, h] of [[10, 3], [22, 6], [40, 3], [52, 7], [66, 4]]) { g.box(1, x, 33, x + 5, 38, 0, h, M.CRATE); g.box(1, x + 7, 40, x + 10, 43, 0, 2, M.SANDBAG); }
    g.shutterZ(1, 48, 20, 14); g.shutterZ(1, 48, 52, 14);

    K.finish({ hatch: 3, cams: 8 });
    // the clock, the train at the platform, tracks and yard clutter
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 17) B.w.put(t.X(12) + dx, 43 + dy, t.z, dx * dx + dy * dy > 11 ? M.BRASS : M.LAMP);
    for (const z of [178, 183]) B.obox(40, z, 300, z, 0, 0, M.RAIL);
    const car = (x, m) => {
      B.obox(x, 176, x + 30, 185, 0, 9, m); B.obox(x + 1, 177, x + 29, 184, 1, 8, 0);
      for (const xx of [x, x + 30]) B.obox(xx, 179, xx, 182, 1, 7, 0);
      for (const z of [176, 185]) { for (const dx of [5, 22]) B.obox(x + dx, z, x + dx + 3, z, 1, 7, 0); B.obox(x + 11, z, x + 19, z, 4, 6, M.GLASS); }
      B.obox(x + 12, 177, x + 18, 178, 1, 2, M.FAB_RED); B.obox(x + 12, 183, x + 18, 184, 1, 2, M.FAB_RED);
    };
    car(100, M.CONT_G); car(134, M.CONT_G); car(168, M.CONT_R);
    for (let x = 60; x < 290; x += 34) { B.obox(x, 164, x, 164, 0, 12, M.PIPE); B.obox(x - 4, 162, x + 4, 169, 13, 13, M.CORRUGATE); }
    K.scatter(26, 14, (x, z, h) => { if (z > 36 && z < 100) return; if (z > 172 && z < 190) return; if (h < 0.22) B.container(x, z, 'x', [M.CONT_R, M.CONT_B, M.CONT_G][Math.floor(h * 20) % 3]); else if (h < 0.4) B.obox(x, z, x + 3, z + 3, 0, 3, M.CRATE); else if (h < 0.5) B.lamp(x, z, 16); else if (h < 0.6) B.drum(x, z, 2, 0, 4, M.RUST); });
    B.car(120, 74, 'x', M.CAR_K); B.car(170, 74, 'x', M.CAR_W);
    K.spawns('Station Road', 'Marshalling Yard', 'Signal Box', 'Coal Stage');
    B.meta.bombs = [['Coal Store', 'Boiler Room'], ['Ticket Office', 'Parcels Office'], ["Station Master's Office", 'Records Room'], ['Machine Shop', 'Tool Crib'], ['Oil Store', 'Sand House'], ["Clerk's Office", 'Stationery Store']];
    B.meta.secure = ['Grand Concourse', 'Engine Shed', 'Goods Shed', 'Mail Vault', 'Clock Room'];
    B.meta.hostage = ['Lamp Room', 'Waiting Room', 'Crew Bunks', 'Telegraph Office', 'Bonded Store'];
    B.meta.defSpawns = ['Parcels Office', 'Tool Crib', 'Archive'];
    return B;
  }
  define({ id: 'depot', name: 'RAIL DEPOT', fn: depot, blurb: 'Terminus, engine shed & freight tunnel · rainy dusk', cover: 'boxcar', tint: 'rgba(120,90,80,0.36)' });

  /* =================================================================== MUSEUM */
  function museum() {
    const B = new Builder('museum', 'MUSEUM', 300, 64, 300);
    K.begin(B);
    B.meta.desc = 'A natural-history museum after closing: four floors of galleries round a skylit atrium where a fossil stands, a dinosaur hall in the east wing, antiquities in the west, and vaults and workshops below. Evening.';
    B.theme(THEMES.evening);
    B.ground(M.GRASS);
    B.surf(0, 36, 299, 58, M.ASPHALT); B.surf(126, 58, 170, 99, M.MARBLE);
    const b = B.building(100, 100, 97, 97, { lo: 0, hi: 3, ext: M.MARBLE, inner: M.PLASTER, slab: M.MARBLE, roof: M.ROOF, parapet: M.MARBLE });
    const w = B.building(52, 118, 49, 61, { lo: 0, hi: 2, ext: M.MARBLE, inner: M.DRY_RED, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.MARBLE });
    const e = B.building(196, 118, 49, 61, { lo: 1, hi: 2, ext: M.MARBLE, inner: M.DRY_SAGE, slab: M.WOODFLOOR, roof: M.ROOF, parapet: M.MARBLE });
    K.shells(B);
    b.pal = [M.DRY_BEIGE, M.DRY_SAGE, M.DRY_BLUE, M.DRY_RED, M.DRY_WHITE]; w.pal = [M.DRY_RED, M.DRY_BEIGE]; e.pal = [M.DRY_SAGE, M.DRY_BEIGE];
    b.gallery = w.gallery = e.gallery = true; b.pillar = w.pillar = e.pillar = M.MARBLE; b.plain = true;

    K.plan(b, 0, `
      0-24: Vault 30 | - 42 | Fossil Storage 66 | Crate Store 96
      24-72: Workshop 24 | Undercroft Hall 72 | Boiler Room 96
      72-96: Loading Dock 30 | Prep Lab 54 | - 66 | Wet Collection 96`);
    K.plan(b, 1, `
      0-24: Gift Shop 30 | - 42 | Entrance Hall 66 | Cloakroom 96
      24-72: Ancient Gallery 24 | Fossil Atrium~ 72 | Mineral Gallery 96
      72-96: Cafe 30 | Lecture Room 54 | - 66 | Children's Room 96`);
    K.plan(b, 2, `
      0-24: Portrait Gallery 30 | - 42 | Sculpture Hall 66 | Print Room 96
      24-72: Insect Gallery 24 | Atrium Balcony~ 72 | Bird Gallery 96
      72-96: Map Room 30 | Reading Room 54 | - 66 | Photo Studio 96`);
    K.plan(b, 3, `
      0-24: Board Room 30 | - 42 | Director's Office 66 | Curator Office 96
      24-72: Herbarium 24 | Skylight Walk~ 72 | Taxidermy Lab 96
      72-96: Conservation Lab 30 | Staff Library 54 | - 66 | Drawing Store 96`);
    K.well(b, 'North Stairs', 30, 0, 'z', 0, 3);
    K.well(b, 'South Stairs', 54, 72, 'z', 0, 3);
    K.atrium(b, 2, 30, 30, 66, 66); K.atrium(b, 3, 30, 30, 66, 66);
    K.flight(b, 1, 25, 60, '-z', 4); K.flight(b, 2, 68, 36, '+z', 4);
    for (let z = 30; z <= 66; z++) for (let x = 30; x <= 66; x++) B.w.put(b.X(x), b.roofY, b.Z(z), x % 9 === 3 || z % 9 === 3 ? M.METAL : M.GLASS);
    K.fossil(b, 1, 36, 48, 22, 14);
    for (const [x, z] of [[33, 33], [58, 33], [33, 60], [58, 60]]) { b.box(1, x, z, x + 5, z + 3, 0, 2, M.TRIM); b.box(1, x, z, x + 5, z + 3, 3, 5, M.GLASS); }
    b.cellar('s', 12);

    K.plan(w, 0, `
      0-24: Tomb Store 24 | Carpentry Shop 48
      24-36: West Passage 48
      36-60: Plaster Room 18 | - 30 | Frame Store 48`);
    K.plan(w, 1, `
      0-24: Egyptian Gallery 24 | Armour Gallery 48
      24-36: West Corridor 48
      36-60: Ceramics Room 18 | - 30 | Coin Room 48`);
    K.plan(w, 2, `
      0-24: Textile Gallery 24 | Clock Gallery 48
      24-36: West Balcony 48
      36-60: Costume Store 18 | - 30 | Miniatures Room 48`);
    K.well(w, 'West Stairs', 18, 36, 'z', 0, 2);

    K.plan(e, 1, `
      0-36: Dinosaur Hall~ 48
      36-60: Fossil Prep 18 | - 30 | Geology Room 48`);
    K.plan(e, 2, `
      0-36: Dinosaur Balcony~ 48
      36-60: Gem Vault 18 | - 30 | Meteorite Room 48`);
    K.well(e, 'East Stairs', 18, 36, 'z', 1, 2);
    K.atrium(e, 2, 7, 7, 41, 29);
    K.fossil(e, 1, 12, 18, 22, 13);
    for (const [x, z] of [[8, 9], [36, 9], [8, 27], [36, 27]]) { e.box(1, x, z, x + 3, z + 2, 0, 2, M.TRIM); e.box(1, x, z, x + 3, z + 2, 3, 5, M.GLASS); }

    K.finish({ hatch: 3, cams: 8 });
    // the portico, a fountain, hedges and lamps
    for (let x = 34; x <= 62; x += 7) B.obox(b.X(x), b.z - 9, b.X(x) + 1, b.z - 8, 0, 22, M.MARBLE);
    B.obox(b.X(32), b.z - 10, b.X(65), b.z - 1, 23, 24, M.MARBLE);
    B.drum(148, 78, 7, 0, 1, M.STONE); B.drum(148, 78, 5, 1, 1, M.WATER); B.drum(148, 78, 1, 0, 7, M.STONE);
    for (const x of [112, 180]) B.obox(x, 64, x + 3, 96, 0, 3, M.LEAF);
    K.scatter(24, 14, (x, z, h) => { if (z > 32 && z < 100 && x > 104 && x < 192) return; if (z > 32 && z < 60) return; if (h < 0.4) B.tree(x, z, 14 + Math.floor(h * 14)); else if (h < 0.5) B.lamp(x, z, 14); else if (h < 0.6) { B.obox(x, z, x + 2, z + 2, 0, 2, M.MARBLE); B.obox(x, z, x + 1, z + 1, 3, 8, M.BONE); } });
    K.spawns('Museum Avenue', 'Sculpture Garden', 'East Lawn', 'Service Yard');
    B.meta.bombs = [['Vault', 'Fossil Storage'], ['Ancient Gallery', 'Gift Shop'], ['Map Room', 'Reading Room'], ['Board Room', "Director's Office"], ['Egyptian Gallery', 'Armour Gallery'], ['Conservation Lab', 'Staff Library']];
    B.meta.secure = ['Fossil Atrium', 'Dinosaur Hall', 'Vault', 'Bird Gallery', 'Taxidermy Lab'];
    B.meta.hostage = ['Wet Collection', 'Cafe', 'Coin Room', 'Photo Studio', 'Curator Office'];
    B.meta.defSpawns = ['Lecture Room', 'Reading Room', 'Workshop'];
    return B;
  }
  define({ id: 'museum', name: 'MUSEUM', fn: museum, blurb: 'Natural-history museum round a skylit atrium · evening', cover: 'gardenwall', tint: 'rgba(130,100,150,0.36)' });
})();
