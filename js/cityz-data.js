/* cityz-data.js -- City Z: the data. The region (its locations and the roads between them), items,
   what is found where, recipes, the infected, survivors and difficulty. Everything else in City Z
   (cityz*.js) reads from here.

   City Z is the quarantined city of Varrow, eleven weeks after the Grey Fever. BLOCKADE sends a squad
   of five in. It is one persistent world: you travel between its locations, come back to safehouses,
   and what you do to a place stays done. */
(function () {
  'use strict';
  const CZ = window.CZ = window.CZ || {};

  /* ------------------------------------------------------------- the region */
  /* x, y: where it sits on the region map (0..10 by 0..8). links: neighbour -> minutes on foot (a
     vehicle takes a third of that, and costs fuel). kind: what gets built there (cityz-zones.js).
     danger 1-5: how many infected and how tough. safe: a safehouse can be restored there. */
  CZ.ZONES = {
    firehouse: { name: 'ENGINE 9 FIREHOUSE', area: 'Ashford Row', kind: 'suburb', x: 2.2, y: 5.6, danger: 1, safe: true,
      desc: 'A brick firehouse on a street of terraced houses at the west edge of Varrow. Thick walls, one big door, a roof you can watch the street from. Somebody held out here for a while.',
      links: { mainst: 25, school: 30, farm: 40 } },
    mainst: { name: 'ASHFORD MAIN STREET', area: 'Ashford', kind: 'town', x: 4.3, y: 4.5, danger: 2,
      desc: 'The old high street: a pharmacy, a hardware store, a diner, a grocery and flats over the shops. Cars were left where they stopped.',
      links: { firehouse: 25, hospital: 30, mall: 35, subway: 20 } },
    school: { name: 'LINCOLN HIGH', area: 'North Ashford', kind: 'school', x: 2.0, y: 2.4, danger: 2, safe: true,
      desc: 'The school the city used as a refugee centre until the fences went down. Classrooms full of cots, a gym, a kitchen, and maybe still people.',
      links: { firehouse: 30, subway: 30, checkpoint: 40 } },
    hospital: { name: "ST BRIGID'S HOSPITAL", area: 'Medical District', kind: 'hospital', x: 6.4, y: 5.4, danger: 4,
      desc: 'Where the Grey Fever was first treated, and where it got out. The pharmacy, the labs and the isolation ward were never emptied.',
      links: { mainst: 30, mall: 30, industrial: 35 } },
    mall: { name: 'RIVERSIDE GALLERIA', area: 'City Centre', kind: 'mall', x: 6.2, y: 3.0, danger: 3,
      desc: 'Three floors of shops under a glass roof by the river. Everything anyone wanted, and everyone wanted it at once.',
      links: { mainst: 35, hospital: 30, subway: 25, highway: 40 } },
    subway: { name: 'KESSLER SQUARE STATION', area: 'Line 4', kind: 'subway', x: 4.6, y: 2.0, danger: 3,
      desc: 'A Line 4 station under a city square: the ticket hall, the platforms and the tunnels north toward the checkpoint. Dark down there.',
      links: { mainst: 20, school: 30, mall: 25, checkpoint: 30 } },
    industrial: { name: 'HARROW INDUSTRIAL ESTATE', area: 'Harrow', kind: 'industrial', x: 8.6, y: 6.2, danger: 3, safe: true,
      desc: 'Warehouses, a vehicle depot and a fuel station by the ring road. Fuel, tools, parts, and a yard you could lock.',
      links: { hospital: 35, highway: 30 } },
    farm: { name: 'GREENACRE FARM', area: 'Outskirts', kind: 'farm', x: 0.9, y: 7.2, danger: 1, safe: true,
      desc: 'A farm outside the wire: a farmhouse, a barn, a silo and fields gone to seed. Food grows here if somebody looks after it.',
      links: { firehouse: 40, highway: 60 } },
    checkpoint: { name: 'CHECKPOINT DELTA', area: 'Quarantine Line', kind: 'military', x: 3.6, y: 0.6, danger: 5,
      desc: 'The army post on the quarantine line: barracks, a command post, a field hospital and the gate out of Varrow. Overrun, or so the radio says.',
      links: { school: 40, subway: 30, highway: 45 } },
    highway: { name: 'ROUTE 9 OVERPASS', area: 'Ring Road', kind: 'highway', x: 9.2, y: 2.6, danger: 4,
      desc: 'A truck stop and motel under the ring-road overpass, the jammed lanes of the evacuation that never finished above it.',
      links: { mall: 40, industrial: 30, farm: 60, checkpoint: 45 } },
  };
  CZ.START = 'firehouse';

  /* ------------------------------------------------------------- difficulty */
  CZ.DIFF = {
    story: { name: 'STORY', desc: 'Fewer, slower infected; hunger and thirst build slowly; bites rarely infect. For the campaign.', inf: 0.65, need: 0.6, infect: 0.5, loot: 1.3, dmg: 0.7 },
    survivor: { name: 'SURVIVOR', desc: 'The way City Z is meant to be played.', inf: 1, need: 1, infect: 1, loot: 1, dmg: 1 },
    nightmare: { name: 'NIGHTMARE', desc: 'More of them, faster, and every bite counts. Little to find.', inf: 1.45, need: 1.35, infect: 1.6, loot: 0.7, dmg: 1.35 },
  };

  /* ------------------------------------------------------------------ items */
  /* kg: weight. cat: food / drink / med / ammo / mat / throw / gear / weapon / quest. use: what using it
     does (cityz-survival.js). stack: how many share a slot */
  CZ.ITEMS = {
    // sick + risk: the chance it makes you sick (an iron stomach never), and how badly. calm: what it does
    // for the nerves (stress down; coffee puts it up)
    beans: { name: 'Canned Beans', cat: 'food', kg: 0.45, use: { hunger: -32, calm: 3 } },
    soup: { name: 'Canned Soup', cat: 'food', kg: 0.45, use: { hunger: -25, thirst: -8, calm: 6 } },
    bar: { name: 'Energy Bar', cat: 'food', kg: 0.1, use: { hunger: -14, stamina: 30, calm: 3 } },
    mre: { name: 'Field Ration', cat: 'food', kg: 0.6, use: { hunger: -55, thirst: -10, calm: 5 } },
    apple: { name: 'Apples', cat: 'food', kg: 0.3, use: { hunger: -12, thirst: -6, calm: 3 } },
    crisps: { name: 'Crisps', cat: 'food', kg: 0.1, use: { hunger: -8, thirst: 6, calm: 6 } },
    choc: { name: 'Chocolate', cat: 'food', kg: 0.1, use: { hunger: -6, calm: 18 }, desc: 'Not much of a meal. Does wonders for the nerves.' },
    dogfood: { name: 'Dog Food', cat: 'food', kg: 0.5, use: { hunger: -28, sick: 30, risk: 0.5 }, desc: 'Filling. Half the time it comes back up.' },
    oldtin: { name: 'Unlabelled Tin', cat: 'food', kg: 0.45, use: { hunger: -30, sick: 30, risk: 0.35 }, desc: 'No label, a dent in the side, a bit swollen. Probably fine.' },
    stew: { name: 'Hot Stew', cat: 'food', kg: 0.5, use: { hunger: -45, warmth: 3, calm: 15 } },
    water: { name: 'Bottled Water', cat: 'drink', kg: 0.5, use: { thirst: -40 } },
    soda: { name: 'Can of Soda', cat: 'drink', kg: 0.35, use: { thirst: -22, hunger: -4, calm: 4 } },
    dirtywater: { name: 'Dirty Water', cat: 'drink', kg: 0.5, use: { thirst: -30, sick: 35, risk: 0.7 }, desc: 'From a tank, a trough or a puddle. Boil it by a campfire or at a safehouse workbench first, or risk getting sick.' },
    coffee: { name: 'Cold Coffee', cat: 'drink', kg: 0.3, use: { thirst: -12, fatigue: -18, calm: -6 } },
    rag: { name: 'Rag Dressing', cat: 'med', kg: 0.05, use: { bleed: -1 } },
    bandage: { name: 'Bandage', cat: 'med', kg: 0.05, use: { bleed: -3, hp: 5 } },
    splint: { name: 'Splint', cat: 'med', kg: 0.3, use: { fracture: true } },
    painkillers: { name: 'Painkillers', cat: 'med', kg: 0.05, use: { hp: 12, pain: 90, calm: 8 } },
    antibiotics: { name: 'Antibiotics', cat: 'med', kg: 0.05, use: { infection: -25, sick: -60 }, desc: 'Slows the infection a little. Cures a stomach bug.' },
    antiviral: { name: 'Antiviral (VX-7)', cat: 'med', kg: 0.05, use: { infection: -65 } },
    medkit: { name: 'First-Aid Kit', cat: 'med', kg: 0.6, use: { hp: 55, bleed: -9, fracture: true } },
    a9: { name: '9mm Rounds', cat: 'ammo', kg: 0.012 },
    a45: { name: '.45 Rounds', cat: 'ammo', kg: 0.02 },
    a556: { name: '5.56 Rounds', cat: 'ammo', kg: 0.012 },
    a762: { name: '7.62 Rounds', cat: 'ammo', kg: 0.025 },
    a12: { name: '12-Gauge Shells', cat: 'ammo', kg: 0.045 },
    a50: { name: '.50 / .44 Heavy', cat: 'ammo', kg: 0.05 },
    bolt: { name: 'Crossbow Bolts', cat: 'ammo', kg: 0.06 },
    scrap: { name: 'Scrap Metal', cat: 'mat', kg: 0.8 },
    cloth: { name: 'Cloth', cat: 'mat', kg: 0.15 },
    planks: { name: 'Planks', cat: 'mat', kg: 1.6 },
    nails: { name: 'Nails', cat: 'mat', kg: 0.25 },
    tape: { name: 'Duct Tape', cat: 'mat', kg: 0.2 },
    alcohol: { name: 'Alcohol', cat: 'mat', kg: 0.5 },
    fuel: { name: 'Fuel Can', cat: 'mat', kg: 4 },
    battery: { name: 'Batteries', cat: 'mat', kg: 0.2 },
    parts: { name: 'Electronic Parts', cat: 'mat', kg: 0.4 },
    chem: { name: 'Chemicals', cat: 'mat', kg: 0.5 },
    powder: { name: 'Gunpowder', cat: 'mat', kg: 0.2 },
    seeds: { name: 'Seed Packets', cat: 'mat', kg: 0.05 },
    engine: { name: 'Engine Parts', cat: 'mat', kg: 3 },
    molotov: { name: 'Molotov', cat: 'throw', kg: 0.6, throw: 'molotov' },
    pipebomb: { name: 'Pipe Bomb', cat: 'throw', kg: 0.7, throw: 'pipebomb' },
    noisemaker: { name: 'Noisemaker', cat: 'throw', kg: 0.3, throw: 'noise' },
    flare: { name: 'Road Flare', cat: 'throw', kg: 0.2, throw: 'flare' },
    barricade: { name: 'Barricade Kit', cat: 'gear', kg: 3, desc: 'Boards up a doorway or window you are looking at.' },
    pack_s: { name: 'Daypack', cat: 'gear', kg: 0.6, carry: 8, desc: 'Carry 8 kg more while it is in your kit.' },
    pack_l: { name: 'Hiking Pack', cat: 'gear', kg: 1.2, carry: 18, desc: 'Carry 18 kg more while it is in your kit.' },
    jacket: { name: 'Winter Jacket', cat: 'gear', kg: 1.4, warm: 2, desc: 'Keeps the cold out at night and in the rain.' },
    raincoat: { name: 'Raincoat', cat: 'gear', kg: 0.6, warm: 1, desc: 'Keeps you dry.' },
    torch: { name: 'Flashlight', cat: 'gear', kg: 0.3, desc: 'Lets you see further in the dark.' },
    firewood: { name: 'Firewood', cat: 'gear', kg: 2, desc: 'Lights a campfire where you stand: it keeps the squad warm for a few minutes (and burns any infected that walk into it).' },
    // story items
    notes: { name: "Dr Mara's Notes", cat: 'quest', kg: 0.3 },
    samples: { name: 'Blood Samples', cat: 'quest', kg: 0.5 },
    radiopart: { name: 'Radio Valve Set', cat: 'quest', kg: 1 },
    keycard: { name: 'Command Keycard', cat: 'quest', kg: 0.05 },
    culture: { name: 'Cure Culture', cat: 'quest', kg: 0.4 },
  };
  /* the calibre each gun class takes (a gun found takes the weight of its class) */
  CZ.CAL = { AR: 'a556', SMG: 'a9', MP: 'a9', PISTOL: 'a9', SG: 'a12', DMR: 'a762', LMG: 'a556', SR: 'a762', XBOW: 'bolt' };
  CZ.calOf = id => {
    const w = DATA.WEAPONS[id]; if (!w) return 'a9';
    if (id === 'warrant' || id === 'hush45') return 'a45';
    if (id === 'maul' || id === 'hammer50') return 'a50';
    if (id === 'tallow' || id === 'brunt') return 'a762';
    return CZ.CAL[w.type] || 'a9';
  };
  CZ.GUNKG = { AR: 3.4, SMG: 2.6, MP: 1.6, PISTOL: 0.9, SG: 3.4, DMR: 4.2, LMG: 7.5, SR: 5, XBOW: 3 };
  CZ.itemKg = id => CZ.ITEMS[id] ? CZ.ITEMS[id].kg : (DATA.WEAPONS[id] ? CZ.GUNKG[DATA.WEAPONS[id].type] || 3 : 0.5);
  CZ.itemName = id => CZ.ITEMS[id] ? CZ.ITEMS[id].name : (DATA.WEAPONS[id] ? DATA.WEAPONS[id].name : id);

  /* -------------------------------------------------------------- loot */
  /* what a container holds is drawn from the table its room's name points at, a few rolls each.
     [item, weight, min, max] */
  CZ.LOOT = {
    kitchen: [['beans', 6, 1, 2], ['soup', 5, 1, 2], ['water', 6, 1, 2], ['soda', 4, 1, 2], ['crisps', 3, 1, 3], ['alcohol', 2, 1, 1], ['cloth', 2, 1, 2], ['coffee', 2, 1, 1], ['dogfood', 1, 1, 1], ['oldtin', 2, 1, 1]],
    medical: [['bandage', 7, 1, 3], ['painkillers', 5, 1, 2], ['antibiotics', 3, 1, 1], ['medkit', 1, 1, 1], ['splint', 2, 1, 1], ['alcohol', 3, 1, 1], ['cloth', 3, 1, 2], ['antiviral', 0.4, 1, 1]],
    pharmacy: [['painkillers', 6, 1, 3], ['antibiotics', 5, 1, 2], ['bandage', 6, 2, 4], ['medkit', 2, 1, 1], ['antiviral', 0.8, 1, 1], ['chem', 2, 1, 1], ['water', 2, 1, 1]],
    workshop: [['scrap', 6, 1, 3], ['nails', 5, 1, 2], ['tape', 4, 1, 2], ['planks', 4, 1, 2], ['parts', 3, 1, 1], ['battery', 3, 1, 2], ['fuel', 1, 1, 1], ['chem', 2, 1, 1], ['engine', 0.6, 1, 1]],
    office: [['parts', 3, 1, 1], ['battery', 4, 1, 2], ['tape', 2, 1, 1], ['coffee', 3, 1, 1], ['bar', 3, 1, 2], ['water', 3, 1, 1], ['choc', 1.5, 1, 1], ['torch', 0.6, 1, 1], ['a9', 1, 6, 15]],
    home: [['beans', 3, 1, 1], ['water', 3, 1, 1], ['dirtywater', 2, 1, 1], ['oldtin', 1.5, 1, 1], ['choc', 1, 1, 1], ['cloth', 5, 1, 3], ['bandage', 2, 1, 1], ['painkillers', 2, 1, 1], ['alcohol', 2, 1, 1], ['battery', 2, 1, 1], ['jacket', 0.5, 1, 1], ['raincoat', 0.5, 1, 1], ['pack_s', 0.4, 1, 1], ['a9', 1, 4, 12], ['a12', 0.8, 2, 6]],
    shop: [['crisps', 4, 1, 3], ['soda', 4, 1, 2], ['choc', 3, 1, 2], ['water', 4, 1, 2], ['bar', 4, 1, 3], ['battery', 3, 1, 2], ['tape', 2, 1, 1], ['torch', 0.6, 1, 1], ['pack_s', 0.5, 1, 1], ['jacket', 0.4, 1, 1], ['flare', 1, 1, 2]],
    store: [['beans', 3, 1, 2], ['oldtin', 2, 1, 2], ['dirtywater', 2, 1, 2], ['firewood', 2, 1, 1], ['planks', 3, 1, 2], ['nails', 3, 1, 2], ['scrap', 3, 1, 2], ['cloth', 3, 1, 2], ['fuel', 1, 1, 1], ['water', 2, 1, 2], ['seeds', 1, 1, 2]],
    police: [['a9', 6, 10, 30], ['a45', 3, 6, 20], ['a12', 4, 4, 12], ['a556', 2, 10, 30], ['bandage', 3, 1, 2], ['flare', 2, 1, 2], ['gun:p10', 1.2, 1, 1], ['gun:salvo9', 0.6, 1, 1], ['gun:gale12', 0.5, 1, 1], ['pack_l', 0.3, 1, 1]],
    military: [['a556', 7, 15, 45], ['a762', 4, 10, 30], ['a9', 4, 15, 30], ['a12', 3, 6, 16], ['mre', 5, 1, 3], ['water', 4, 1, 2], ['medkit', 2, 1, 1], ['bandage', 4, 1, 3], ['pipebomb', 1, 1, 1], ['powder', 2, 1, 3], ['gun:mako', 0.8, 1, 1], ['gun:vkr5', 0.6, 1, 1], ['gun:razor', 0.4, 1, 1], ['gun:tallow', 0.2, 1, 1], ['pack_l', 0.6, 1, 1], ['antiviral', 0.3, 1, 1]],
    farm: [['apple', 6, 1, 3], ['dirtywater', 4, 1, 2], ['firewood', 3, 1, 2], ['seeds', 4, 1, 3], ['planks', 4, 1, 2], ['nails', 3, 1, 2], ['fuel', 2, 1, 1], ['a12', 2, 2, 8], ['cloth', 3, 1, 2], ['alcohol', 2, 1, 1], ['gun:gale12', 0.4, 1, 1], ['gun:longbow', 0.2, 1, 1]],
    garage: [['fuel', 4, 1, 1], ['dirtywater', 1.5, 1, 1], ['scrap', 5, 1, 3], ['engine', 2, 1, 1], ['tape', 3, 1, 2], ['battery', 3, 1, 2], ['parts', 2, 1, 1], ['chem', 2, 1, 1], ['nails', 2, 1, 2]],
    school: [['bar', 4, 1, 2], ['choc', 1.5, 1, 1], ['water', 4, 1, 2], ['soda', 3, 1, 1], ['bandage', 3, 1, 2], ['cloth', 3, 1, 2], ['battery', 2, 1, 1], ['parts', 2, 1, 1], ['chem', 1.5, 1, 1], ['painkillers', 1.5, 1, 1]],
    any: [['cloth', 4, 1, 2], ['scrap', 3, 1, 1], ['water', 3, 1, 1], ['dirtywater', 1.5, 1, 1], ['oldtin', 1, 1, 1], ['beans', 2, 1, 1], ['bandage', 2, 1, 1], ['tape', 1, 1, 1], ['battery', 1, 1, 1], ['a9', 1, 4, 10], ['alcohol', 1, 1, 1]],
  };
  /* a room's name -> its loot table */
  CZ.LOOT_BY_ROOM = [
    [/Kitchen|Canteen|Diner|Cafe|Cafeteria|Mess|Food|Grocery|Pantry|Larder|Cook|Restaurant|Bakery|Deli/, 'kitchen'],
    [/Pharmacy|Dispensary|Drug/, 'pharmacy'],
    [/Ward|Triage|Clinic|Nurse|Medical|First Aid|Surgery|Theatre|Treatment|Isolation|Recovery|Exam|Infirmary|Lab/, 'medical'],
    [/Workshop|Garage|Shop Floor|Tool|Fitters|Maintenance|Repair|Service Bay|Engine|Plant|Boiler|Generator|Pump/, 'workshop'],
    [/Office|Manager|Admin|Records|Reception|Desk|Study|Classroom|Library|Staff/, 'office'],
    [/Bedroom|Living|Lounge|Den|Bathroom|Nursery|Flat|Apartment|Attic|Bunk/, 'home'],
    [/Hardware|Utility|Tool/, 'workshop'],
    [/Store|Shop|Boutique|Newsagent|Mart|Outlet|Arcade/, 'shop'],
    [/Warehouse|Stock|Storage|Cellar|Basement|Shed|Barn|Stores|Loft/, 'store'],
    [/Police|Security|Guard|Armou?ry|Cells/, 'police'],
    [/Barracks|Command|Ops|Quartermaster|Ammunition|Radio|Mess Tent|Field/, 'military'],
    [/Farmhouse|Byre|Stable|Hay|Dairy|Coop|Greenhouse|Orchard/, 'farm'],
    [/Gym|Locker|Hall|Auditorium|Music|Art Room|Science|Changing/, 'school'],
    [/Bay|Depot|Yard|Fuel|Motor/, 'garage'],
  ];
  CZ.lootTable = name => { for (const [re, t] of CZ.LOOT_BY_ROOM) if (re.test(name)) return t; return 'any'; };

  /* ------------------------------------------------------------------ crafting */
  /* bench: needs a restored safehouse workbench (level). makes: [item, n] */
  CZ.RECIPES = [
    { id: 'rag', makes: ['rag', 1], needs: { cloth: 1 }, bench: 0 },
    { id: 'bandage', makes: ['bandage', 1], needs: { cloth: 2, alcohol: 0.5 }, bench: 0 },
    { id: 'splint', makes: ['splint', 1], needs: { planks: 1, cloth: 1 }, bench: 0 },
    { id: 'molotov', makes: ['molotov', 1], needs: { alcohol: 1, cloth: 1 }, bench: 0 },
    { id: 'noisemaker', makes: ['noisemaker', 1], needs: { parts: 1, battery: 1, tape: 1 }, bench: 0 },
    { id: 'barricade', makes: ['barricade', 1], needs: { planks: 2, nails: 1 }, bench: 0 },
    { id: 'firewood', makes: ['firewood', 1], needs: { planks: 2 }, bench: 0 },
    { id: 'pipebomb', makes: ['pipebomb', 1], needs: { scrap: 2, powder: 2, tape: 1 }, bench: 1 },
    { id: 'a9', makes: ['a9', 15], needs: { scrap: 1, powder: 1 }, bench: 1 },
    { id: 'a556', makes: ['a556', 12], needs: { scrap: 1, powder: 2 }, bench: 1 },
    { id: 'a12', makes: ['a12', 6], needs: { scrap: 1, powder: 1 }, bench: 1 },
    { id: 'a762', makes: ['a762', 8], needs: { scrap: 2, powder: 2 }, bench: 2 },
    { id: 'medkit', makes: ['medkit', 1], needs: { bandage: 2, painkillers: 1, alcohol: 1 }, bench: 1 },
    { id: 'stew', makes: ['stew', 1], needs: { beans: 1, water: 1 }, bench: 0, fire: true },
    { id: 'purify', makes: ['water', 1], needs: { dirtywater: 1 }, bench: 0, fire: true },
    { id: 'powder', makes: ['powder', 2], needs: { chem: 1 }, bench: 2 },
  ];

  /* ------------------------------------------------------------------ infected */
  /* hp, speed (x a walking operator), dmg per hit, reach, cd between hits, sight (m), infect (per bite),
     look: the colours of the model */
  CZ.INFECTED = {
    walker: { name: 'Walker', hp: 70, speed: 0.5, run: 0.85, dmg: 11, reach: 1.35, cd: 1.3, sight: 16, infect: 6, look: { head: 'cap', helmet: 0x5a5a52, vest: 0x4a4e44, cloth: 0x585448, accent: 0x7a2a22, skin: 0x8a9a7a, hair: 0x2a2a22 } },
    runner: { name: 'Runner', hp: 45, speed: 0.6, run: 1.35, dmg: 8, reach: 1.3, cd: 0.8, sight: 24, infect: 5, look: { head: 'hood', helmet: 0x3a3a40, vest: 0x2e3238, cloth: 0x3a3e48, accent: 0x8a2a22, skin: 0x9aa48a, hair: 0x1a1a1a } },
    brute: { name: 'Brute', hp: 420, speed: 0.45, run: 0.7, dmg: 34, reach: 1.6, cd: 2.1, sight: 18, infect: 8, armour: 0.35, scale: 1.25, look: { head: 'helmet', helmet: 0x4a5040, vest: 0x2a2e24, cloth: 0x3a3a30, accent: 0x6a2a20, skin: 0x7a8a68, hair: 0x222222 } },
    screamer: { name: 'Screamer', hp: 60, speed: 0.6, run: 1.0, dmg: 6, reach: 1.2, cd: 1, sight: 26, infect: 4, scream: true, look: { head: 'bandana', helmet: 0xa89a8a, vest: 0x6a5a5a, cloth: 0x7a6a6a, accent: 0xaa2a2a, skin: 0xb0b8a0, hair: 0x3a2a1a } },
    spitter: { name: 'Spitter', hp: 80, speed: 0.5, run: 0.75, dmg: 7, reach: 1.2, cd: 1.2, sight: 22, infect: 3, spit: true, look: { head: 'gasmask', helmet: 0x4a5a3a, vest: 0x3a4a2a, cloth: 0x4a5838, accent: 0x9ac83a, skin: 0x7a9a5a, hair: 0x222222 } },
    lurker: { name: 'Lurker', hp: 55, speed: 0.4, run: 1.2, dmg: 22, reach: 1.4, cd: 1.6, sight: 9, infect: 9, lurk: true, look: { head: 'balaclava', helmet: 0x1a1a1a, vest: 0x222222, cloth: 0x2a2a2a, accent: 0x5a1a1a, skin: 0x6a7a62, hair: 0x111111 } },
  };
  /* which kinds turn up, by danger (weights) */
  CZ.MIX = [
    null,
    { walker: 10, runner: 1 },
    { walker: 10, runner: 3, lurker: 1, screamer: 0.5 },
    { walker: 9, runner: 4, lurker: 2, screamer: 1, spitter: 1, brute: 0.5 },
    { walker: 8, runner: 5, lurker: 2, screamer: 1.5, spitter: 1.5, brute: 1.2, opx: 0.6 },
    { walker: 7, runner: 6, lurker: 2, screamer: 2, spitter: 2, brute: 2, opx: 1.2 },
  ];
  CZ.POP = [0, 14, 20, 26, 30, 34];   // infected in a zone at the start (they come back over the days)

  /* ------------------------------------------------------------------ survivors */
  /* people met in the world: some are story characters (cityz-story.js), the rest come from here */
  CZ.SURVIVOR_NAMES = ['Ada Kowal', 'Teo Baines', 'Mina Hale', 'Ruben Ostrow', 'Jun Park', 'Leila Haddad', 'Marta Quist', 'Callum Reyes', 'Ines Varga', 'Sol Abara', 'Petra Lind', 'Hugo Marsh', 'Dara Finch', 'Omar Sadiq', 'Bea Thorne', 'Nils Ekberg'];
  CZ.SURVIVOR_SKILLS = {
    medic: { name: 'Medic', desc: 'Treats the squad at the safehouse: everyone heals there twice as fast.' },
    mechanic: { name: 'Mechanic', desc: 'Keeps vehicles running: repairs them at the safehouse, and finds more fuel.' },
    cook: { name: 'Cook', desc: 'Turns what you bring back into meals: food at the safehouse lasts longer.' },
    scavenger: { name: 'Scavenger', desc: 'Goes out on their own and comes back with supplies every day.' },
    guard: { name: 'Guard', desc: 'Watches the safehouse: fewer things get in while you are away.' },
    farmer: { name: 'Farmer', desc: 'Grows food at a safehouse with a garden.' },
  };
  CZ.TRADES = [['water', 'a9', 1, 12], ['beans', 'a12', 1, 4], ['bandage', 'scrap', 1, 2], ['antibiotics', 'a556', 1, 20], ['fuel', 'mre', 1, 2], ['parts', 'water', 1, 2], ['a9', 'bandage', 15, 1], ['scrap', 'cloth', 2, 3]];

  /* ------------------------------------------------------------------ safehouse */
  /* what restoring and upgrading a safehouse costs, and what each step gives */
  CZ.SAFE_UP = [
    { id: 'restore', name: 'Restore', desc: 'Clear it, board the windows, a bed and a stash. You can sleep, store things and craft by hand here.', needs: { planks: 4, nails: 2, cloth: 2 } },
    { id: 'bench', name: 'Workbench', desc: 'Craft ammunition, pipe bombs, first-aid kits and meals.', needs: { planks: 3, scrap: 3, nails: 2, tape: 1 }, after: 'restore' },
    { id: 'walls', name: 'Fortify', desc: 'Steel over the ways in. Fewer infected get near while you are away; hordes stay out.', needs: { scrap: 6, planks: 4, nails: 3 }, after: 'restore' },
    { id: 'water', name: 'Rain Collector', desc: 'Two bottles of water a day in the stash.', needs: { scrap: 2, tape: 2, cloth: 1 }, after: 'restore' },
    { id: 'garden', name: 'Garden', desc: 'Food every day (more with a farmer).', needs: { seeds: 2, planks: 2, water: 1 }, after: 'restore' },
    { id: 'radio', name: 'Radio', desc: 'Hear about supply drops, hordes and people asking for help.', needs: { parts: 2, battery: 2, radiopart: 1 }, after: 'restore' },
    { id: 'bench2', name: 'Machine Shop', desc: 'Rifle ammunition and gunpowder from chemicals.', needs: { scrap: 6, parts: 3, engine: 1 }, after: 'bench' },
    { id: 'infirmary', name: 'Infirmary', desc: 'Heal fully and fight infection while you sleep here.', needs: { bandage: 4, medkit: 1, planks: 2 }, after: 'restore' },
  ];

  /* ------------------------------------------------------------------ vehicles */
  CZ.VEHICLES = {
    hatch: { name: 'Hatchback', seats: 4, trunk: 30, fuelMax: 40, burn: 0.5, hp: 400, speed: 13, color: 0x8a3a2a },
    pickup: { name: 'Pickup Truck', seats: 5, trunk: 60, fuelMax: 60, burn: 0.75, hp: 650, speed: 12, color: 0x3a5a7a },
    van: { name: 'Panel Van', seats: 5, trunk: 90, fuelMax: 70, burn: 0.9, hp: 700, speed: 11, color: 0xd8d8d0 },
  };
})();
