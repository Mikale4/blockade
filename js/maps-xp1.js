/* maps-xp1.js -- seasons 15-18 maps, part 1. Each is built round a piece of machinery (js/mapmech.js):
     UNDERLINE      a metro interchange: trains run the tunnel through the platform level
     ZENITH TOWER   the top floors of a skyscraper: a window cleaner's gondola rides the facade
     VAULTLINE      a bank headquarters: a security desk drops lockdown grilles and kills the vault lights
     MERCY GENERAL  a hospital: a working lift between all four floors, and the emergency power
     GALLERIA       a shopping centre: escalators that carry you, and shop grilles on a timer
     AQUARIUM       a public aquarium: break the great tank and the hall floods; a sluice floods the basement */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const { Builder, define } = MAPS;
  const K = MAPS.KIT;
  const SOFTW = { hp: 3, pen: 0.72, xp: true, hb: true, melee: true, wall: true };
  mat('XP_TILEBRICK', 0x9a8a72, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'brick', wall: true });
  mat('XP_METRO_TILE', 0xd8dcd0, SOFTW);
  mat('XP_CURTAIN', 0x6a8aa8, { hp: 1, pen: 0.95, xp: true, hb: true, see: true, melee: true });   // the tower's glass skin
  mat('XP_STEEL', 0x5a6068, { pat: 'plates' });
  mat('XP_MARBLE_G', 0x2e3a34, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'block', wall: true });
  mat('XP_VAULT', 0x6a7078, { hb: true, reinf: true, pat: 'plates' });
  mat('XP_WARD', 0xdfe8ea, SOFTW);
  mat('XP_SHOPFRONT', 0xb8c4cc, SOFTW);
  mat('XP_DEEPBLUE', 0x1a3a5a, { pat: 'noise' });
  mat('XP_CORAL', 0xd87a5a, { hp: 2, pen: 0.85, xp: true, hb: true, melee: true, pat: 'noise' });
  const X = (b, lx) => b.X(lx), Z = (b, lz) => b.Z(lz);

  /* ===================================================================== UNDERLINE */
  function underline() {
    const B = new Builder('underline', 'UNDERLINE', 300, 64, 280);
    K.begin(B);
    B.meta.desc = 'A metro interchange under a city street at night: a booking hall that looks down on the concourse, two platforms either side of a live track, and offices over it all. Trains come through every 45 seconds, and anyone on the track when they do is dead.';
    B.theme({ sky: [0x0a0c18, 0x2a2a3e], fog: 0x18182a, fogFar: 110, lightOut: [0.5, 0.52, 0.66], lightIn: [0.92, 0.9, 0.82], sun: 0xa8b0ff, outer: 0x2a2c30 });
    B.ground(M.ASPHALT);
    const b = B.building(90, 80, 121, 97, { lo: 0, hi: 2, ext: M.XP_TILEBRICK, inner: M.XP_METRO_TILE, slab: M.CONCRETE, roof: M.ROOF, parapet: M.CONCRETE });
    K.shells(B);
    b.pal = [M.XP_METRO_TILE, M.DRY_WHITE, M.DRY_GREY]; b.pillar = M.CONCRETE;
    K.plan(b, 0, `
      0-24: Ticket Office 30 | Staff Room 54 | - 66 | Left Luggage 96 | Plant Room 120
      24-40: Concourse Hall 120
      40-72: Platform Hall~ 120
      72-96: Signal Room 30 | Cable Store 54 | - 66 | Maintenance Shop 96 | Pump Room 120`);
    K.plan(b, 1, `
      0-24: Station Office 30 | Cafe 54 | - 66 | Newsagent 96 | Bike Store 120
      24-72: Booking Hall~ 120
      72-96: Ticket Hall West 30 | Locker Room 54 | - 66 | Transit Police 96 | Lost Property 120`);
    K.plan(b, 2, `
      0-24: Control Room 30 | Signal Desk 54 | - 66 | Staff Canteen 96 | Rest Room 120
      24-72: Upper Gallery 40 | Network Office 80 | Records Office 120
      72-96: Training Room 30 | Server Room 54 | - 66 | Manager's Office 96 | First Aid 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    // the booking hall looks down on the concourse; escalator flights between them
    K.atrium(b, 1, 24, 26, 96, 38);
    K.flight(b, 0, 4, 30, '+x', 5); K.flight(b, 0, 116, 30, '-x', 5);
    // the track (rails and ballast set into the floor), and the tunnel mouths through the end walls,
    // out into the earth either side
    B.w.fill(X(b, 1), 0, Z(b, 51), X(b, 119), 0, Z(b, 61), M.GRAVEL);
    for (const z of [53, 59]) B.w.fill(X(b, 1), 0, Z(b, z), X(b, 119), 0, Z(b, z), M.RAIL);
    for (const x of [1, 119]) b.box(0, x, 50, x, 50, 0, 1, M.LINE);   // (yellow line markers at the platform edges)
    for (const x of [0, 120]) B.w.fill(X(b, x), 1, Z(b, 51), X(b, x), 10, Z(b, 61), 0);
    B.w.fill(X(b, -44), 1, Z(b, 51), X(b, -1), 10, Z(b, 61), 0); B.w.fill(X(b, 121), 1, Z(b, 51), X(b, 164), 10, Z(b, 61), 0);
    for (const x of [20, 50, 80, 110]) for (const z of [44, 66]) b.box(0, x, z, x + 1, z + 1, 0, 10, M.CONCRETE);   // platform columns
    for (const x of [30, 60, 90]) b.box(0, x, 45, x + 6, 46, 0, 2, M.WOOD);                                       // benches
    B.meta.mech.push({ kind: 'train', x0: X(b, -44), x1: X(b, 164), z0: Z(b, 51), z1: Z(b, 61), y: 1, every: 45 });
    K.finish({ hatch: 4, cams: 8 });
    // the street: a bus stop, taxis, lamps
    K.scatter(24, 14, (x, z, h) => { if (h < 0.25) B.lamp(x, z, 15); else if (h < 0.45) B.car(x, z, h < 0.35 ? 'x' : 'z', [M.CAR_K, M.CAR_W, M.CAR_R][Math.floor(h * 30) % 3]); else if (h < 0.55) B.dumpster(x, z); });
    K.spawns('Taxi Rank', 'Market Street', 'Bus Station', 'Canal Steps');
    B.meta.bombs = [['Signal Room', 'Cable Store'], ['Ticket Office', 'Staff Room'], ['Control Room', 'Signal Desk'], ['Server Room', 'Training Room'], ['Station Office', 'Cafe']];
    B.meta.secure = ['Concourse Hall', 'Platform Hall', 'Network Office', 'Maintenance Shop'];
    B.meta.hostage = ['Left Luggage', 'Transit Police', "Manager's Office", 'Pump Room'];
    B.meta.defSpawns = ['Control Room', 'Signal Room', 'Lost Property'];
    return B;
  }
  define({ id: 'underline', name: 'UNDERLINE', fn: underline, blurb: 'Metro interchange: trains through the platforms · night', cover: 'shelter', tint: 'rgba(60,80,140,0.38)' });

  /* ===================================================================== ZENITH TOWER */
  function zenith() {
    const B = new Builder('zenith', 'ZENITH TOWER', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'The top three floors of a glass tower: a sky lobby, a penthouse round a double-height lounge, a roof garden and a helipad. A window cleaner\'s gondola runs up and down the south face all round, stopping at every floor.';
    B.theme({ sky: [0x3a6ab0, 0xd8e8f4], fog: 0xb8c8d8, fogFar: 160, lightOut: [1.0, 0.98, 0.94], lightIn: [0.86, 0.84, 0.8], sun: 0xfff4e0, outer: 0x8a98a8 });
    B.ground(M.ROOF);
    const b = B.building(90, 70, 121, 97, { lo: 1, hi: 3, ext: M.XP_CURTAIN, inner: M.DRY_WHITE, slab: M.MARBLE, roof: M.ROOF, parapet: M.METAL });
    const s = B.building(90, 166, 121, 41, { lo: 1, hi: 2, ext: M.FACADE, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.DRY_WHITE, M.DRY_BEIGE, M.MARBLE]; b.pillar = M.METAL; s.pal = [M.DRY_GREY, M.DRY_WHITE];
    K.plan(b, 1, `
      0-24: Sky Lobby 40 | Concierge 54 | - 66 | Security Desk 90 | Mail Room 120
      24-72: Lift Hall 24 | Sky Bar~ 96 | Cloakroom 120
      72-96: Business Lounge 30 | Meeting Room 54 | - 66 | Boardroom 96 | Executive Suite 120`);
    K.plan(b, 2, `
      0-24: Master Bedroom 30 | Dressing Room 54 | - 66 | Guest Bedroom 96 | Guest Bathroom 120
      24-72: Penthouse Hall 24 | Grand Lounge~ 96 | Study 120
      72-96: Dining Room 30 | Kitchen 54 | - 66 | Media Room 96 | Wine Room 120`);
    K.plan(b, 3, `
      0-24: Pool House 30 | Spa 54 | - 66 | Gym 96 | Sauna 120
      24-72: Roof Hall 24 | Lounge Gallery~ 96 | Plant Deck 120
      72-96: Garden Room 30 | Library 54 | - 66 | Observatory Room 96 | Helipad Office 120`);
    K.plan(s, 1, `0-40: Service Corridor 20 | Building Management 50 | Server Closet 80 | Loading Bay 120`);
    K.plan(s, 2, `0-40: Staff Corridor 20 | Housekeeping 50 | Laundry 80 | Plant Room 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 1, 3);
    K.well(b, 'East Stairs', 54, 72, 'z', 1, 3);
    K.atrium(b, 3, 32, 32, 88, 64);            // the grand lounge is two floors high (a gallery round it above)
    b.box(2, 50, 40, 70, 42, 0, 2, M.FAB_BLUE); b.box(2, 50, 54, 70, 56, 0, 2, M.FAB_BLUE);   // sofas
    b.box(1, 40, 36, 80, 38, 0, 3, M.XP_MARBLE_G);                                               // the bar
    // the gondola: a platform outside the north face (z just off the building), riding floor to floor
    const gz0 = Z(b, -8), gz1 = Z(b, -3), gx0 = X(b, 50), gx1 = X(b, 66);
    B.meta.mech.push({ kind: 'mover', x0: gx0, x1: gx1, z0: gz0, z1: gz1, y: 13, axis: 'x', speed: 1.2, dwell: 6, pts: [{ y: 25 }, { y: 37 }] });
    for (const L of [1, 2, 3]) b.winZ(L, 0, 52, 12);   // wide windows the gondola stops at
    K.finish({ hatch: 4, cams: 8 });
    B.obox(X(b, 80), Z(b, 30), X(b, 110), Z(b, 66), 37, 37, M.LINE);   // (a helipad mark)
    K.spawns('North Ledge', 'Service Roof', 'East Terrace', 'West Terrace');
    B.meta.bombs = [['Master Bedroom', 'Dressing Room'], ['Boardroom', 'Executive Suite'], ['Pool House', 'Spa'], ['Media Room', 'Wine Room'], ['Building Management', 'Server Closet']];
    B.meta.secure = ['Sky Bar', 'Grand Lounge', 'Plant Deck', 'Loading Bay'];
    B.meta.hostage = ['Study', 'Library', 'Guest Bedroom', 'Housekeeping'];
    B.meta.defSpawns = ['Grand Lounge', 'Boardroom', 'Gym'];
    return B;
  }
  define({ id: 'zenith', name: 'ZENITH TOWER', fn: zenith, blurb: 'Penthouse floors of a glass tower, a facade gondola · clear day', cover: 'shelter', tint: 'rgba(90,140,200,0.36)' });

  /* ===================================================================== VAULTLINE */
  function vaultline() {
    const B = new Builder('vaultline', 'VAULTLINE', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A bank\'s headquarters on a grey afternoon: a marble banking hall, the trading floor over it and the vaults beneath. The security desk can drop steel grilles across the halls and kill the lights in the vault level.';
    B.theme({ sky: [0x5a6470, 0xb8bcc0], fog: 0x9aa0a6, fogFar: 140, lightOut: [0.86, 0.86, 0.88], lightIn: [0.9, 0.86, 0.78], sun: 0xe8e8f0, outer: 0x6a6e72 });
    B.ground(M.CONC_DARK);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.STONE, inner: M.DRY_BEIGE, slab: M.MARBLE, roof: M.ROOF, parapet: M.STONE });
    const a = B.building(210, 70, 41, 97, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_GREY, slab: M.CONCRETE, roof: M.ROOF, parapet: M.STONE });
    K.shells(B);
    b.pal = [M.DRY_BEIGE, M.MARBLE, M.DRY_WHITE]; b.pillar = M.MARBLE; a.pal = [M.DRY_GREY, M.DRY_WHITE];
    K.plan(b, 0, `
      0-24: Deposit Boxes 30 | Vault Antechamber 54 | - 66 | Coin Store 96 | Cash Room 120
      24-72: Vault Corridor 24 | Main Vault~ 96 | Records Vault 120
      72-96: Counting Room 30 | Strongroom 54 | - 66 | Archive 96 | Generator Room 120`);
    K.plan(b, 1, `
      0-24: Manager's Office 30 | Loans Office 54 | - 66 | Security Office 96 | Staff Room 120
      24-72: West Hall 24 | Banking Hall~ 96 | East Hall 120
      72-96: Teller Office 30 | Waiting Room 54 | - 66 | Wealth Lounge 96 | Mail Room 120`);
    K.plan(b, 2, `
      0-24: Director's Office 30 | Secretary 54 | - 66 | Compliance 96 | Legal Office 120
      24-72: Gallery Corridor 24 | Trading Floor 96 | Analyst Room 120
      72-96: Boardroom 30 | Dining Room 54 | - 66 | IT Office 96 | Server Room 120`);
    K.plan(a, 0, `
      0-48: Garage Ramp Hall 40
      48-96: Armoured Car Bay 40`);
    K.plan(a, 1, `
      0-48: Courier Hall 40
      48-96: Clearing House 40`);
    K.plan(a, 2, `
      0-48: Annex Corridor 40
      48-96: Print Room 40`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    // the main vault: steel walls round the vault room
    B.w.fill(X(b, 25), 1, Z(b, 25), X(b, 95), 11, Z(b, 25), M.XP_VAULT); B.w.fill(X(b, 25), 1, Z(b, 71), X(b, 95), 11, Z(b, 71), M.XP_VAULT);
    B.w.fill(X(b, 58), 1, Z(b, 25), X(b, 62), 9, Z(b, 25), 0);   // the vault door, open
    for (let x = 32; x <= 88; x += 8) b.box(0, x, 34, x + 4, 62, 0, 8, M.XP_STEEL);   // safe-deposit stacks
    b.box(1, 36, 40, 84, 42, 0, 3, M.XP_MARBLE_G);                                    // the teller counter
    // lockdown: grilles across the banking hall's ways in and the vault corridor; the vault level's lights
    B.meta.mech.push({ kind: 'grille', panel: { x: X(b, 90), z: Z(b, 4), y: 13 }, boxes: [
      { x0: X(b, 24), x1: X(b, 24), z0: Z(b, 26), z1: Z(b, 70), y0: 13, y1: 21 },
      { x0: X(b, 96), x1: X(b, 96), z0: Z(b, 26), z1: Z(b, 70), y0: 13, y1: 21 },
      { x0: X(b, 1), x1: X(b, 23), z0: Z(b, 48), z1: Z(b, 48), y0: 1, y1: 9 } ] });
    B.meta.mech.push({ kind: 'lights', label: 'VAULT LEVEL', panel: { x: X(b, 86), z: Z(b, 4), y: 13 }, rooms: ['Main Vault', 'Vault Corridor', 'Records Vault', 'Deposit Boxes', 'Vault Antechamber', 'Coin Store', 'Cash Room', 'Counting Room', 'Strongroom'] });
    K.finish({ hatch: 4, cams: 9 });
    K.scatter(24, 14, (x, z, h) => { if (h < 0.25) B.lamp(x, z, 15); else if (h < 0.4) B.car(x, z, h < 0.33 ? 'x' : 'z', [M.CAR_K, M.CAR_W][Math.floor(h * 30) % 2]); else if (h < 0.5) B.tree(x, z, 12); });
    K.spawns('Bank Square', 'Delivery Lane', 'Exchange Street', 'Garden Plaza');
    B.meta.bombs = [['Strongroom', 'Counting Room'], ['Coin Store', 'Cash Room'], ['Security Office', 'Staff Room'], ['Boardroom', 'Dining Room'], ['IT Office', 'Server Room']];
    B.meta.secure = ['Main Vault', 'Banking Hall', 'Trading Floor', 'Clearing House'];
    B.meta.hostage = ["Manager's Office", "Director's Office", 'Wealth Lounge', 'Archive'];
    B.meta.defSpawns = ['Main Vault', 'Security Office', 'Trading Floor'];
    return B;
  }
  define({ id: 'vaultline', name: 'VAULTLINE', fn: vaultline, blurb: 'Bank HQ, vaults & a lockdown desk · grey afternoon', cover: 'garage', tint: 'rgba(120,120,110,0.36)' });

  /* ===================================================================== MERCY GENERAL */
  function mercy() {
    const B = new Builder('mercy', 'MERCY GENERAL', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A city hospital at night: an emergency department, wards and theatres over four floors, and a lift in the middle that still works. The emergency power in the basement can black out the wards.';
    B.theme({ sky: [0x0c1220, 0x34405a], fog: 0x202838, fogFar: 120, lightOut: [0.55, 0.6, 0.72], lightIn: [0.88, 0.94, 0.96], sun: 0xb8c8ff, outer: 0x2a3038 });
    B.ground(M.ASPHALT);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 3, ext: M.FACADE, inner: M.XP_WARD, slab: M.TILE, roof: M.ROOF, parapet: M.FACADE });
    K.shells(B);
    b.pal = [M.XP_WARD, M.DRY_WHITE, M.DRY_SAGE, M.DRY_BLUE]; b.pillar = M.CONCRETE;
    K.plan(b, 0, `
      0-24: Morgue 30 | Pathology 54 | - 66 | Pharmacy Store 96 | Linen Store 120
      24-72: Basement Corridor 46 | Lift Lobby~ 60 | Emergency Power 90 | Records Store 120
      72-96: Boiler Room 30 | Kitchen 54 | - 66 | Supply Store 96 | Workshop 120`);
    K.plan(b, 1, `
      0-24: Triage 30 | Resus Room 54 | - 66 | Waiting Room 96 | Reception 120
      24-72: Emergency Hall 46 | Ground Lift Lobby~ 60 | Ambulance Bay 90 | X-Ray 120
      72-96: Minor Injuries 30 | Plaster Room 54 | - 66 | Security Room 96 | Pharmacy 120`);
    K.plan(b, 2, `
      0-24: Ward A 30 | Nurses Station 54 | - 66 | Ward B 96 | Day Room 120
      24-72: Ward Corridor 46 | Ward Lift Lobby~ 60 | Isolation 90 | Sluice Room 120
      72-96: Ward C 30 | Treatment Room 54 | - 66 | Ward D 96 | Relatives Room 120`);
    K.plan(b, 3, `
      0-24: Theatre One 30 | Scrub Room 54 | - 66 | Theatre Two 96 | Recovery 120
      24-72: Theatre Corridor 46 | Theatre Lift Lobby~ 60 | Intensive Care 90 | Doctors Office 120
      72-96: Anaesthetics 30 | Sterile Store 54 | - 66 | Lab 96 | Chapel 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 3);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 3);
    // the lift shaft: a 13 x 13 gap in the middle of every floor, the car inside, doors on its west side
    for (const L of [1, 2, 3]) b.void(L, 47, 29, 59, 41);
    for (const L of [0, 1, 2, 3]) { b.wallZ(L, 28, 46, 60); b.wallZ(L, 42, 46, 60); b.doorZ(L, 42, 51, 4); }
    B.meta.mech.push({ kind: 'lift', x0: X(b, 47), x1: X(b, 59), z0: Z(b, 29), z1: Z(b, 41), stops: [1, 13, 25, 37] });
    B.meta.mech.push({ kind: 'lights', label: 'THE WARDS', panel: { x: X(b, 75), z: Z(b, 30), y: 1 }, rooms: ['Ward A', 'Ward B', 'Ward C', 'Ward D', 'Ward Corridor', 'Nurses Station', 'Day Room', 'Isolation', 'Treatment Room'] });
    K.finish({ hatch: 4, cams: 9 });
    B.obox(X(b, 62), Z(b, 98), X(b, 88), Z(b, 112), 0, 0, M.LINE);   // ambulance bay markings
    K.scatter(24, 14, (x, z, h) => { if (h < 0.25) B.lamp(x, z, 15); else if (h < 0.42) B.car(x, z, h < 0.33 ? 'x' : 'z', [M.CAR_W, M.CAR_K, M.CAR_R][Math.floor(h * 30) % 3]); else if (h < 0.5) B.tree(x, z, 12); });
    K.spawns('Car Park', 'Ambulance Approach', 'Helipad Road', 'Garden Path');
    B.meta.bombs = [['Morgue', 'Pathology'], ['Triage', 'Resus Room'], ['Ward A', 'Nurses Station'], ['Theatre Two', 'Recovery'], ['Pharmacy Store', 'Linen Store']];
    B.meta.secure = ['Emergency Hall', 'Intensive Care', 'Ambulance Bay', 'Emergency Power'];
    B.meta.hostage = ['Isolation', 'Chapel', 'Security Room', 'Doctors Office'];
    B.meta.defSpawns = ['Intensive Care', 'Emergency Power', 'Ward D'];
    return B;
  }
  define({ id: 'mercy', name: 'MERCY GENERAL', fn: mercy, blurb: 'Hospital: four floors, a working lift · night', cover: 'garage', tint: 'rgba(80,140,160,0.36)' });

  /* ===================================================================== GALLERIA */
  function galleria() {
    const B = new Builder('galleria', 'GALLERIA', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A shopping centre on a Saturday that never came: two floors of shops round a glass-roofed galleria with escalators that still run, a food court, and service corridors behind it all. The shop grilles come down and go up on a timer.';
    B.theme({ sky: [0x6aa0d8, 0xe8f0f4], fog: 0xd0dce4, fogFar: 160, lightOut: [1.0, 0.98, 0.94], lightIn: [0.96, 0.94, 0.88], sun: 0xfff8e8, outer: 0x9aa4ac });
    B.ground(M.ASPHALT);
    const b = B.building(80, 70, 141, 97, { lo: 0, hi: 2, ext: M.FACADE, inner: M.XP_SHOPFRONT, slab: M.TILE, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.XP_SHOPFRONT, M.DRY_WHITE, M.DRY_BEIGE, M.DRY_SAGE]; b.pillar = M.METAL;
    K.plan(b, 0, `
      0-24: Delivery Hall 30 | Cold Store 54 | - 66 | Stock Room 100 | Refuse Room 140
      24-72: Service Corridor 24 | Car Park Lobby 70 | Plant Room 110 | Security Hub 140
      72-96: Staff Canteen 30 | Lockers 54 | - 66 | Cleaners Store 100 | Generator Room 140`);
    K.plan(b, 1, `
      0-24: Fashion Store 30 | Shoe Shop 54 | - 66 | Electronics Store 100 | Pharmacy 140
      24-72: West Arcade 20 | Galleria Court~ 120 | East Arcade 140
      72-96: Toy Shop 30 | Book Shop 54 | - 66 | Jewellers 100 | Phone Shop 140`);
    K.plan(b, 2, `
      0-24: Department Store 30 | Sports Shop 54 | - 66 | Cinema Lobby 100 | Arcade Games 140
      24-72: Upper West Mall 20 | Food Court~ 120 | Upper East Mall 140
      72-96: Restaurant 30 | Coffee Shop 54 | - 66 | Management Office 100 | Gym 140`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    K.atrium(b, 2, 30, 34, 110, 62);
    // the escalators: an up flight and a down flight, each carrying whoever stands on it
    K.flight(b, 1, 22, 66, '-z', 5); K.flight(b, 1, 112, 30, '+z', 5);
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 22), x1: X(b, 26), z0: Z(b, 54), z1: Z(b, 67), y: 13, dx: 0, dz: -1.4 });
    B.meta.mech.push({ kind: 'conveyor', x0: X(b, 112), x1: X(b, 116), z0: Z(b, 29), z1: Z(b, 42), y: 13, dx: 0, dz: 1.4 });
    for (const x of [60, 80]) b.box(1, x, 44, x + 6, 52, 0, 3, M.LEAF);   // planters
    // shop grilles across the arcade ends, down and up on a 50 s timer
    B.meta.mech.push({ kind: 'grille', every: 50, boxes: [
      { x0: X(b, 20), x1: X(b, 20), z0: Z(b, 26), z1: Z(b, 70), y0: 13, y1: 21 },
      { x0: X(b, 120), x1: X(b, 120), z0: Z(b, 26), z1: Z(b, 70), y0: 13, y1: 21 } ], panel: { x: X(b, 130), z: Z(b, 30), y: 1 } });
    K.finish({ hatch: 4, cams: 9 });
    K.scatter(26, 14, (x, z, h) => { if (h < 0.22) B.lamp(x, z, 15); else if (h < 0.5) B.car(x, z, h < 0.36 ? 'x' : 'z', [M.CAR_K, M.CAR_W, M.CAR_R][Math.floor(h * 30) % 3]); else if (h < 0.56) B.tree(x, z, 12); });
    K.spawns('North Car Park', 'Bus Station', 'Retail Park', 'Taxi Rank');
    B.meta.bombs = [['Fashion Store', 'Shoe Shop'], ['Electronics Store', 'Pharmacy'], ['Department Store', 'Sports Shop'], ['Management Office', 'Gym'], ['Cold Store', 'Delivery Hall']];
    B.meta.secure = ['Galleria Court', 'Food Court', 'Security Hub', 'Cinema Lobby'];
    B.meta.hostage = ['Jewellers', 'Book Shop', 'Restaurant', 'Stock Room'];
    B.meta.defSpawns = ['Security Hub', 'Food Court', 'Jewellers'];
    return B;
  }
  define({ id: 'galleria', name: 'GALLERIA', fn: galleria, blurb: 'Shopping centre, moving escalators & timed grilles · bright day', cover: 'trailer', tint: 'rgba(220,180,120,0.34)' });

  /* ===================================================================== AQUARIUM */
  function aquarium() {
    const B = new Builder('aquarium', 'AQUARIUM', 300, 64, 290);
    K.begin(B);
    B.meta.desc = 'A public aquarium on the waterfront in the blue hour: an ocean hall round a great glass tank, a reef tunnel and galleries above. Break enough of the tank\'s glass and the hall floods; a sluice in the pump room floods the basement.';
    B.theme({ sky: [0x101e3a, 0x4a6a8a], fog: 0x26405a, fogFar: 130, lightOut: [0.6, 0.7, 0.86], lightIn: [0.62, 0.8, 0.92], sun: 0xa8c8ff, outer: 0x2a3a4a });
    B.ground(M.DOCK);
    const b = B.building(90, 70, 121, 97, { lo: 0, hi: 2, ext: M.FACADE, inner: M.DRY_BLUE, slab: M.CONCRETE, roof: M.ROOF, parapet: M.METAL });
    K.shells(B);
    b.pal = [M.DRY_BLUE, M.DRY_WHITE, M.XP_DEEPBLUE]; b.pillar = M.CONCRETE;
    K.plan(b, 0, `
      0-24: Quarantine Tanks 30 | Food Prep 54 | - 66 | Life Support 96 | Pump Room 120
      24-72: Keeper Corridor 24 | Reef Tunnel~ 96 | Filter Hall 120
      72-96: Dive Store 30 | Lab 54 | - 66 | Vet Room 96 | Plant Room 120`);
    K.plan(b, 1, `
      0-24: Entrance Hall 30 | Ticket Office 54 | - 66 | Gift Shop 96 | Cafe 120
      24-72: West Gallery 24 | Ocean Hall~ 96 | East Gallery 120
      72-96: Jellyfish Room 30 | Shark Room 54 | - 66 | Touch Pool 96 | Seahorse Room 120`);
    K.plan(b, 2, `
      0-24: Education Room 30 | Library 54 | - 66 | Director's Office 96 | Staff Room 120
      24-72: Upper Walkway 24 | Tank Gallery~ 96 | Function Room 120
      72-96: Exhibit Workshop 30 | Archive 54 | - 66 | Control Room 96 | Mezzanine Bar 120`);
    K.well(b, 'West Stairs', 54, 0, 'z', 0, 2);
    K.well(b, 'East Stairs', 54, 72, 'z', 0, 2);
    K.atrium(b, 2, 32, 32, 88, 64);
    // the great tank in the ocean hall: glass walls round deep water, coral inside
    const tx0 = 40, tx1 = 80, tz0 = 36, tz1 = 60;
    for (let y = 13; y <= 30; y++) { B.w.fill(X(b, tx0), y, Z(b, tz0), X(b, tx1), y, Z(b, tz0), M.GLASS); B.w.fill(X(b, tx0), y, Z(b, tz1), X(b, tx1), y, Z(b, tz1), M.GLASS); B.w.fill(X(b, tx0), y, Z(b, tz0), X(b, tx0), y, Z(b, tz1), M.GLASS); B.w.fill(X(b, tx1), y, Z(b, tz0), X(b, tx1), y, Z(b, tz1), M.GLASS); }
    b.box(1, tx0 + 1, tz0 + 1, tx1 - 1, tz1 - 1, 0, 0, M.SAND); for (let x = tx0 + 4; x < tx1 - 3; x += 7) b.box(1, x, tz0 + 6, x + 2, tz0 + 8, 0, 4, M.XP_CORAL);
    B.meta.mech.push({ kind: 'water', x0: X(b, 25), x1: X(b, 95), z0: Z(b, 25), z1: Z(b, 71), y0: 13, y1: 17, tank: { x0: X(b, tx0), x1: X(b, tx1), z0: Z(b, tz0), z1: Z(b, tz1), y0: 13, y1: 30 } });
    B.meta.mech.push({ kind: 'water', x0: X(b, 1), x1: X(b, 119), z0: Z(b, 25), z1: Z(b, 71), y0: 1, y1: 5, valve: { x: X(b, 110), z: Z(b, 4), y: 1 } });
    // the reef tunnel: a glass arch through the basement
    for (let x = 30; x <= 90; x += 10) b.box(0, x, 34, x + 4, 34, 0, 9, M.GLASS);
    K.finish({ hatch: 4, cams: 9 });
    K.scatter(24, 14, (x, z, h) => { if (h < 0.25) B.lamp(x, z, 15); else if (h < 0.35) B.drum(x, z); else if (h < 0.45) B.container(x, z, h < 0.4 ? 'x' : 'z', M.CONT_B); });
    K.spawns('Harbour Walk', 'Coach Park', 'Marina', 'Lighthouse Pier');
    B.meta.bombs = [['Life Support', 'Pump Room'], ['Quarantine Tanks', 'Food Prep'], ['Shark Room', 'Jellyfish Room'], ['Control Room', 'Mezzanine Bar'], ['Gift Shop', 'Cafe']];
    B.meta.secure = ['Ocean Hall', 'Reef Tunnel', 'Tank Gallery', 'Filter Hall'];
    B.meta.hostage = ["Director's Office", 'Vet Room', 'Touch Pool', 'Library'];
    B.meta.defSpawns = ['Ocean Hall', 'Life Support', 'Control Room'];
    return B;
  }
  define({ id: 'aquarium', name: 'AQUARIUM', fn: aquarium, blurb: 'Public aquarium round a great tank that floods · blue hour', cover: 'boatshed', tint: 'rgba(40,110,160,0.38)' });
})();
