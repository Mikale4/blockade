/* data.js -- every table in the game: voxel materials, weapons, gadgets, operators, units, modes.
   All operators, units, weapons and places are original to BLOCKADE. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ materials --
     hp   : bullet hits to destroy one voxel (255 = bullets never break it)
     pen  : damage kept by a bullet passing through one voxel (0 = stops it)
     xp   : destroyed by explosions        hb : destroyed by a hard breach
     see  : rendered see-through (glass)   glow : unlit
     melee: broken by a melee strike       pat : colour pattern            */
  const MAT = [];
  const M = {};
  let nid = 0;
  function mat(key, c, o) {
    if (M[key] != null) return M[key];   // map files may ask for the same material twice
    const id = nid++;
    M[key] = id;
    MAT[id] = Object.assign({ id, key, c, hp: 255, pen: 0, xp: false, hb: false, see: false, glow: false, melee: false, pat: null, solid: true, elec: false }, o || {});
    return id;
  }
  const SOFTW = { hp: 3, pen: 0.72, xp: true, hb: true, melee: true, wall: true };
  mat('AIR', 0x000000, { solid: false });
  mat('CONCRETE', 0x8d8b85, { pat: 'block' });
  mat('BRICK', 0x9a5240, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'brick', wall: true });
  mat('DRY_WHITE', 0xd9d4c7, SOFTW);
  mat('DRY_BEIGE', 0xcdb68f, SOFTW);
  mat('DRY_SAGE', 0x9db498, SOFTW);
  mat('DRY_BLUE', 0x8ea5bf, SOFTW);
  mat('DRY_RED', 0xa5685b, SOFTW);
  mat('DRY_GREY', 0xaaaaa4, SOFTW);
  mat('WOODFLOOR', 0x8a6240, { hp: 40, pen: 0.5, xp: true, hb: true, pat: 'planks', floor: true });
  mat('TILE', 0xcac8c0, { hp: 40, pen: 0.45, xp: true, hb: true, pat: 'checker', floor: true });
  mat('CARPET', 0x6b2f3a, { hp: 40, pen: 0.5, xp: true, hb: true, pat: 'noise', floor: true });
  mat('CARPET2', 0x3b4a60, { hp: 40, pen: 0.5, xp: true, hb: true, pat: 'noise', floor: true });
  mat('REINF', 0x5c6670, { hb: true, pat: 'plates', reinf: true });
  mat('BARR', 0xa47b48, { hp: 1, pen: 0.9, xp: true, hb: true, melee: true, pat: 'plank' });
  mat('GLASS', 0x9fd6ea, { hp: 1, pen: 0.95, xp: true, hb: true, see: true, melee: true });
  mat('METAL', 0x70767c, {});
  mat('WOOD', 0x7a5634, { hp: 4, pen: 0.6, xp: true, hb: true, melee: true, pat: 'grain' });
  mat('GRASS', 0x5b8a3a, { pat: 'noise' });
  mat('DIRT', 0x6b4f35, { pat: 'noise' });
  mat('ASPHALT', 0x3a3c3f, { pat: 'noise' });
  mat('ROOF', 0x58534e, { hp: 40, pen: 0.4, xp: true, hb: true, pat: 'noise', floor: true });
  mat('HATCH', 0xa07d50, { hp: 6, pen: 0.6, xp: true, hb: true, melee: true, pat: 'planks', hatch: true });
  mat('RHATCH', 0x58626c, { hb: true, pat: 'plates', reinf: true });
  mat('STAIR', 0x6c5844, { pat: 'grain' });
  mat('SHUTTER', 0x7e8891, { hp: 5, pen: 0.6, xp: true, hb: true, pat: 'ribs' });
  mat('FAB_RED', 0x8c3030, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('FAB_BLUE', 0x2f4f8c, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('PAPER', 0xd9cfb0, { hp: 2, pen: 0.85, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('DARK', 0x2a2c30, {});
  mat('WHITE', 0xe8e8e2, {});
  mat('LINE', 0xd8b52a, {});
  mat('SERVER', 0x23272c, { hp: 8, pen: 0.3, xp: true, hb: true, pat: 'ribs' });
  mat('LED_G', 0x46ff7a, { glow: true, hp: 8, pen: 0.3, xp: true, hb: true });
  mat('CONT_R', 0xa0362c, { pat: 'ribs' });
  mat('CONT_B', 0x2d5f8f, { pat: 'ribs' });
  mat('CONT_G', 0x3f7d4a, { pat: 'ribs' });
  mat('CAR_W', 0xcfd3d6, {});
  mat('CAR_K', 0x2b2e33, {});
  mat('CAR_R', 0x9b2a26, {});
  mat('TIRE', 0x1b1b1c, {});
  mat('LEAF', 0x3f6e2c, { hp: 1, pen: 0.95, xp: true, hb: true, pat: 'noise', melee: true });
  mat('BARK', 0x5a4028, {});
  mat('RAIL', 0x3a3f45, {});
  mat('LAMP', 0xfff1b0, { glow: true });
  mat('BEDROCK', 0x3a3530, {});
  mat('DOCK', 0x9c968a, { pat: 'block' });
  mat('SANDBAG', 0xb3a27a, { pat: 'noise' });
  mat('SCREEN', 0x6ad0ff, { glow: true, hp: 1, pen: 0.9, xp: true, hb: true, melee: true });
  mat('TRIM', 0x4a3424, { hp: 4, pen: 0.6, xp: true, hb: true, melee: true });
  mat('BOILER', 0x7c3b2b, { pat: 'ribs' });
  mat('PIPE', 0x8a8f94, {});
  mat('CRATE', 0xa88a55, { hp: 5, pen: 0.55, xp: true, hb: true, melee: true, pat: 'planks' });
  mat('FRIDGE', 0xdfe3e6, { hp: 10, pen: 0.3, xp: true, hb: true });
  mat('COUNTER', 0x55504a, {});
  mat('POT', 0x8a4b2a, { hp: 2, pen: 0.8, xp: true, hb: true, melee: true });
  mat('FENCE', 0x7a7f85, {});
  mat('GRAVEL', 0x77746e, { pat: 'noise' });
  mat('CONC_DARK', 0x6d6c68, { pat: 'block' });
  mat('SAND', 0xc8b68a, { pat: 'noise' });
  mat('TARGET', 0xe9e2cf, { hp: 255, pen: 0 });
  mat('RED_PAINT', 0xb33a32, {});
  mat('BLUE_PAINT', 0x2f6db3, {});
  mat('LAMP_R', 0xff5a3a, { glow: true });
  mat('BOOKS', 0x6a4a8a, { hp: 2, pen: 0.8, xp: true, hb: true, melee: true, pat: 'books' });
  // map themes
  mat('SNOW', 0xeef2f5, { pat: 'noise' });
  mat('LOGWALL', 0x8a5a32, { hp: 6, pen: 0.5, xp: true, hb: true, pat: 'logs', wall: true });
  mat('STONE', 0x84807a, { pat: 'stone' });
  mat('LAB_WHITE', 0xe6eaee, SOFTW);
  mat('LAB_FLOOR', 0xb9c2c9, { hp: 40, pen: 0.45, xp: true, hb: true, pat: 'checker', floor: true });
  mat('HAY', 0xd2b45a, { hp: 2, pen: 0.85, xp: true, hb: true, melee: true, pat: 'noise' });
  mat('CORRUGATE', 0x8f8a7c, { hp: 5, pen: 0.55, xp: true, hb: true, pat: 'ribs', wall: true });
  mat('NEON_B', 0x5ad8ff, { glow: true });
  mat('NEON_P', 0xff5ad0, { glow: true });
  mat('SIDING', 0xb8b2a0, { hp: 7, pen: 0.45, xp: true, hb: true, pat: 'siding', wall: true });
  mat('PANEL_DARK', 0x3a4048, { hp: 3, pen: 0.72, xp: true, hb: true, melee: true, wall: true });
  mat('ICE', 0xcfe8f2, { pat: 'noise' });
  mat('RUST', 0x7a4a2e, { pat: 'ribs' });
  mat('STUCCO', 0xc9b48a, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'noise', wall: true });
  mat('FACADE', 0xd5dbe0, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'siding', wall: true });
  mat('FELT', 0x2f6b45, {});
  // Season 2: hardened foam (Brace's barrier walls, Seam's patches): stops a few bullets per
  // voxel, explosives clear it, and it can be breached again like any soft surface
  mat('FOAM', 0xd9cf9e, { hp: 6, pen: 0.3, xp: true, hb: true, pat: 'noise' });
  // second map pack (appended, so every earlier id stays the same)
  mat('MARBLE', 0xd8d2c6, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'block', wall: true });
  mat('PLASTER', 0xe0dcd2, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'noise', wall: true });
  mat('BONE', 0xe2d6b8, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true });
  mat('BRASS', 0xb38b3c, {});
  mat('WATER', 0x24506a, { pat: 'noise' });
  mat('PUDDLE', 0x353f4a, { pat: 'noise' });
  mat('DOME', 0xc3c8ce, { pat: 'plates' });
  // seasons 10-14: Rust's degausser leaves reinforcement as brittle plate a soft breach opens;
  // Grout's resin is bulletproof and shrugs off explosives (heavy rounds chip it, a bore cuts it)
  mat('WEAK', 0x8a5a3a, { hp: 6, pen: 0.45, xp: true, hb: true, melee: true, pat: 'ribs', wall: true });
  mat('RESIN', 0xd8c890, { hp: 30, pen: 0, hb: true, pat: 'noise', wall: true });
  // a voxel id beyond the table means "outside the world": solid, never drawn
  const OOB = 255;
  // ...with a table entry of its own, so a lookup at the edge of the map reads "unbreakable"
  // instead of throwing (a bot smashing clutter beside the boundary used to freeze the game)
  MAT[OOB] = Object.assign({}, MAT[M.BEDROCK], { id: OOB, key: 'OOB' });

  /* --------------------------------------------------------------- weapons --
     dmg per bullet, rpm, mag, mags (spare), reload (s), reloadE (empty),
     rv/rh recoil per shot (deg), hip/ads spread (deg), adsT (s),
     f0..f1 falloff range (m) down to fmin, destr (wall damage per hit),
     pellets, sight ('iron','red','holo','acog'), mob (move-speed factor)  */
  const WEAPONS = {
    vkr5:    { name: 'VKR-5', type: 'AR', cls: 'Assault Rifle', dmg: 41, rpm: 760, mag: 30, mags: 5, reload: 2.4, reloadE: 3.0, rv: 0.55, rh: 0.3, hip: 2.6, ads: 0.18, adsT: 0.26, f0: 25, f1: 40, fmin: 0.62, destr: 1, sight: 'red', auto: true, mob: 1.0 },
    halberd: { name: 'HALBERD', type: 'AR', cls: 'Battle Rifle', dmg: 47, rpm: 640, mag: 25, mags: 5, reload: 2.6, reloadE: 3.3, rv: 0.75, rh: 0.36, hip: 2.8, ads: 0.16, adsT: 0.3, f0: 28, f1: 45, fmin: 0.65, destr: 1, sight: 'holo', auto: true, mob: 0.96 },
    k77:     { name: 'K-77', type: 'AR', cls: 'Carbine', dmg: 37, rpm: 840, mag: 30, mags: 5, reload: 2.2, reloadE: 2.8, rv: 0.48, rh: 0.28, hip: 2.4, ads: 0.2, adsT: 0.22, f0: 22, f1: 38, fmin: 0.6, destr: 1, sight: 'red', auto: true, mob: 1.02 },
    salvo9:  { name: 'SALVO-9', type: 'SMG', cls: 'Submachine Gun', dmg: 31, rpm: 900, mag: 30, mags: 6, reload: 2.0, reloadE: 2.6, rv: 0.42, rh: 0.3, hip: 2.0, ads: 0.24, adsT: 0.2, f0: 15, f1: 28, fmin: 0.55, destr: 1, sight: 'red', auto: true, mob: 1.05 },
    strider: { name: 'STRIDER', type: 'SMG', cls: 'Submachine Gun', dmg: 35, rpm: 780, mag: 25, mags: 6, reload: 2.1, reloadE: 2.7, rv: 0.5, rh: 0.28, hip: 2.1, ads: 0.22, adsT: 0.21, f0: 16, f1: 30, fmin: 0.55, destr: 1, sight: 'holo', auto: true, mob: 1.05 },
    gale12:  { name: 'GALE 12', type: 'SG', cls: 'Pump Shotgun', dmg: 24, pellets: 8, rpm: 72, mag: 7, mags: 4, shell: 0.55, rv: 3.2, rh: 0.6, hip: 5.5, ads: 4.2, adsT: 0.24, f0: 6, f1: 18, fmin: 0.2, destr: 2, sight: 'iron', auto: false, mob: 1.0, headMul: 2.2 },
    torrent: { name: 'TORRENT', type: 'SG', cls: 'Auto Shotgun', dmg: 17, pellets: 8, rpm: 280, mag: 10, mags: 4, reload: 2.9, reloadE: 3.4, rv: 2.2, rh: 0.7, hip: 6.0, ads: 4.6, adsT: 0.26, f0: 5, f1: 16, fmin: 0.2, destr: 2, sight: 'iron', auto: true, mob: 0.98, headMul: 2.2 },
    lancet:  { name: 'LANCET', type: 'DMR', cls: 'Marksman Rifle', dmg: 68, rpm: 380, mag: 10, mags: 6, reload: 2.5, reloadE: 3.0, rv: 1.6, rh: 0.4, hip: 3.4, ads: 0.06, adsT: 0.34, f0: 40, f1: 60, fmin: 0.75, destr: 1, sight: 'acog', auto: false, mob: 0.96 },
    tallow:  { name: 'TALLOW', type: 'LMG', cls: 'Light Machine Gun', dmg: 45, rpm: 650, mag: 80, mags: 2, reload: 5.2, reloadE: 5.8, rv: 0.44, rh: 0.42, hip: 3.4, ads: 0.24, adsT: 0.4, f0: 30, f1: 45, fmin: 0.65, destr: 1, sight: 'holo', auto: true, mob: 0.9 },
    p10:     { name: 'P-10', type: 'PISTOL', cls: 'Handgun', dmg: 42, rpm: 420, mag: 15, mags: 4, reload: 1.8, reloadE: 2.2, rv: 1.1, rh: 0.3, hip: 1.9, ads: 0.3, adsT: 0.15, f0: 15, f1: 25, fmin: 0.55, destr: 1, sight: 'iron', auto: false, mob: 1.0, sec: true },
    maul:    { name: 'MAUL .44', type: 'PISTOL', cls: 'Revolver', dmg: 64, rpm: 190, mag: 6, mags: 5, reload: 2.6, reloadE: 2.6, rv: 2.4, rh: 0.5, hip: 2.4, ads: 0.25, adsT: 0.18, f0: 18, f1: 30, fmin: 0.6, destr: 1, sight: 'iron', auto: false, mob: 1.0, sec: true },
    hornet:  { name: 'HORNET', type: 'MP', cls: 'Machine Pistol', dmg: 27, rpm: 1000, mag: 20, mags: 5, reload: 1.9, reloadE: 2.3, rv: 0.6, rh: 0.45, hip: 2.4, ads: 0.5, adsT: 0.16, f0: 10, f1: 20, fmin: 0.5, destr: 1, sight: 'red', auto: true, mob: 1.0, sec: true },
    stub:    { name: 'STUB', type: 'SG', cls: 'Breaching Shotgun', dmg: 20, pellets: 10, rpm: 150, mag: 2, mags: 8, reload: 2.2, reloadE: 2.2, rv: 4.0, rh: 1.0, hip: 7.5, ads: 6, adsT: 0.18, f0: 3, f1: 10, fmin: 0.15, destr: 5, sight: 'iron', auto: false, mob: 1.0, sec: true, headMul: 1.6 },
    shield:  { name: 'BULWARK', type: 'SHIELD', cls: 'Ballistic Shield', shield: true, mob: 0.92 },
    // ---- seasons 4-9. New mechanics, read by weapons.js:
    //   burst: rounds per trigger pull · silent: bots barely hear it, no tracer for the other team
    //   penMul: how much better it goes through soft walls · rico: bounces once off hard surfaces
    //   bipod: recoil drops when crouched or prone
    kb3:      { name: 'KB-3', type: 'AR', cls: 'Burst Rifle', dmg: 46, rpm: 900, burst: 3, burstGap: 0.2, mag: 30, mags: 5, reload: 2.4, reloadE: 3.0, rv: 0.5, rh: 0.22, hip: 2.5, ads: 0.1, adsT: 0.25, f0: 30, f1: 48, fmin: 0.68, destr: 1, sight: 'acog', auto: false, mob: 1.0, note: 'Three-round bursts' },
    hush45:   { name: 'HUSH-45', type: 'SMG', cls: 'Suppressed SMG', dmg: 30, rpm: 820, mag: 30, mags: 6, reload: 2.0, reloadE: 2.6, rv: 0.36, rh: 0.24, hip: 2.0, ads: 0.22, adsT: 0.19, f0: 14, f1: 26, fmin: 0.5, destr: 1, sight: 'red', auto: true, mob: 1.06, silent: true, note: 'Suppressed: quiet, no tracers' },
    hammer50: { name: 'HAMMERHEAD .50', type: 'DMR', cls: 'Anti-Materiel Rifle', dmg: 105, rpm: 52, mag: 5, mags: 5, reload: 3.2, reloadE: 3.8, rv: 3.4, rh: 0.6, hip: 5.0, ads: 0.03, adsT: 0.5, f0: 60, f1: 90, fmin: 0.8, destr: 6, sight: 'acog', auto: false, mob: 0.86, penMul: 3, note: 'Punches through soft walls almost unslowed' },
    slug8:    { name: 'MODEL 8 SLUG', type: 'SG', cls: 'Slug Shotgun', dmg: 92, pellets: 1, rpm: 95, mag: 6, mags: 5, shell: 0.5, rv: 3.0, rh: 0.5, hip: 2.2, ads: 0.35, adsT: 0.24, f0: 14, f1: 40, fmin: 0.45, destr: 4, sight: 'red', auto: false, mob: 1.0, headMul: 2, note: 'One heavy slug: a shotgun that reaches' },
    bankshot: { name: 'BANKSHOT', type: 'SMG', cls: 'Ricochet PDW', dmg: 29, rpm: 880, mag: 35, mags: 5, reload: 2.1, reloadE: 2.7, rv: 0.4, rh: 0.3, hip: 2.1, ads: 0.24, adsT: 0.2, f0: 16, f1: 30, fmin: 0.55, destr: 1, sight: 'holo', auto: true, mob: 1.05, rico: 1, note: 'Rounds bounce once off hard surfaces' },
    rampart:  { name: 'RAMPART', type: 'LMG', cls: 'Belt-Fed LMG', dmg: 43, rpm: 700, mag: 100, mags: 1, reload: 5.6, reloadE: 6.2, rv: 0.62, rh: 0.5, hip: 3.8, ads: 0.26, adsT: 0.44, f0: 30, f1: 45, fmin: 0.65, destr: 1, sight: 'holo', auto: true, mob: 0.86, bipod: true, note: 'Bipod: steady when crouched or prone' },
    needler:  { name: 'NEEDLER-6', type: 'SG', cls: 'Flechette Shotgun', dmg: 20, pellets: 6, rpm: 110, mag: 6, mags: 5, shell: 0.5, rv: 2.6, rh: 0.5, hip: 3.4, ads: 2.4, adsT: 0.24, f0: 10, f1: 26, fmin: 0.35, destr: 1, sight: 'iron', auto: false, mob: 1.0, penMul: 2.2, headMul: 2, note: 'Tight flechettes that go through soft walls' },
    verdict:  { name: 'VERDICT', type: 'PISTOL', cls: 'Burst Pistol', dmg: 37, rpm: 1100, burst: 2, burstGap: 0.24, mag: 16, mags: 5, reload: 1.8, reloadE: 2.2, rv: 1.0, rh: 0.35, hip: 2.0, ads: 0.28, adsT: 0.15, f0: 15, f1: 25, fmin: 0.55, destr: 1, sight: 'iron', auto: false, mob: 1.0, sec: true, note: 'Two-round bursts' },
    // ---- seasons 10-14. More mechanics, read by weapons.js:
    //   modes: firing configurations FIREMODE cycles through (numbers given are the stock gun's)
    //   heat: no magazine; each shot adds `per`, it cools at `cool`/s, and full heat vents for `vent` s
    //   spin: seconds of trigger to spin up from 35% to full rate · bolt: seconds working the bolt
    //   proj: a physical round with travel time and drop · markHit: a hit marks the target (s)
    //   burn: a hit sets the target alight (s) · tandem: every other reload is this quick
    //   taser: wired darts (range, stun) instead of bullets
    twinfire: { name: 'TWINFIRE', type: 'AR', cls: 'Dual-Mode Rifle', dmg: 36, rpm: 820, mag: 30, mags: 5, reload: 2.4, reloadE: 3.0, rv: 0.5, rh: 0.28, hip: 2.6, ads: 0.18, adsT: 0.26, f0: 24, f1: 40, fmin: 0.62, destr: 1, sight: 'holo', auto: true, mob: 1.0,
      modes: [{ label: 'AUTO' }, { label: 'MARKSMAN', dmg: 58, rpm: 330, auto: false, rv: 1.0, rh: 0.25, ads: 0.08, adsT: 0.3, f0: 35, f1: 55, fmin: 0.7 }], note: 'FIREMODE swaps full auto for a hard-hitting marksman mode' },
    volta:    { name: 'VOLTA', type: 'AR', cls: 'Coil Carbine', dmg: 33, rpm: 780, mag: 99, mags: 0, reload: 1.4, reloadE: 1.4, rv: 0.38, rh: 0.24, hip: 2.3, ads: 0.18, adsT: 0.24, f0: 22, f1: 38, fmin: 0.6, destr: 1, sight: 'red', auto: true, mob: 1.0,
      heat: { per: 0.016, cool: 0.4, vent: 2.6 }, note: 'No magazine: it heats up. Hold it down and it overheats; RELOAD vents it early' },
    spindle:  { name: 'SPINDLE', type: 'LMG', cls: 'Rotary LMG', dmg: 34, rpm: 1150, spin: 1.1, mag: 150, mags: 1, reload: 6.0, reloadE: 6.5, rv: 0.32, rh: 0.36, hip: 4.2, ads: 0.3, adsT: 0.5, f0: 25, f1: 40, fmin: 0.6, destr: 1, sight: 'holo', auto: true, mob: 0.84, note: 'Spins up: slow first shots, then a torrent. Aiming keeps the barrels turning' },
    longbow:  { name: 'LONGBOW', type: 'SR', cls: 'Bolt-Action Rifle', dmg: 118, rpm: 42, mag: 5, mags: 4, reload: 3.2, reloadE: 3.8, rv: 3.8, rh: 0.5, hip: 6.0, ads: 0.0, adsT: 0.55, f0: 70, f1: 100, fmin: 0.85, destr: 3, sight: 'scope4', auto: false, mob: 0.88, penMul: 1.6, bolt: 0.9, note: 'One heavy round, then work the bolt (no aiming for a moment)' },
    quarrel:  { name: 'QUARREL', type: 'XBOW', cls: 'Crossbow', dmg: 96, rpm: 60, mag: 1, mags: 14, reload: 1.5, reloadE: 1.5, rv: 1.2, rh: 0.2, hip: 3.0, ads: 0.05, adsT: 0.3, f0: 40, f1: 60, fmin: 1, destr: 1, sight: 'red', auto: false, mob: 1.0, silent: true, noFlash: true, proj: { speed: 55, g: 0.35 }, note: 'Silent bolts that fly and drop: lead your target' },
    tally:    { name: 'TALLY', type: 'DMR', cls: 'Marking DMR', dmg: 52, rpm: 400, mag: 15, mags: 5, reload: 2.4, reloadE: 2.9, rv: 1.2, rh: 0.32, hip: 3.0, ads: 0.08, adsT: 0.3, f0: 35, f1: 55, fmin: 0.72, destr: 1, sight: 'acog', auto: false, mob: 0.98, markHit: 3, note: 'Paint rounds: whoever you hit is marked for your team for 3 s' },
    bramble:  { name: 'BRAMBLE', type: 'SG', cls: 'Incendiary Shotgun', dmg: 14, pellets: 8, rpm: 80, mag: 6, mags: 5, shell: 0.55, rv: 3.0, rh: 0.6, hip: 5.0, ads: 4.0, adsT: 0.24, f0: 5, f1: 14, fmin: 0.25, destr: 2, sight: 'iron', auto: false, mob: 1.0, headMul: 2, burn: 2.5, note: 'Dragon\'s-breath shells: a hit burns for a moment, and they light the floor' },
    lattice:  { name: 'LATTICE', type: 'SMG', cls: 'Tandem-Mag SMG', dmg: 30, rpm: 860, mag: 32, mags: 6, reload: 2.1, reloadE: 2.6, rv: 0.4, rh: 0.26, hip: 2.0, ads: 0.24, adsT: 0.2, f0: 15, f1: 28, fmin: 0.55, destr: 1, sight: 'holo', auto: true, mob: 1.05, tandem: 0.9, note: 'Two magazines clamped together: every other reload is a quick flip' },
    stinger:  { name: 'STINGER', type: 'PISTOL', cls: 'Taser Pistol', dmg: 22, rpm: 90, mag: 2, mags: 6, reload: 2.0, reloadE: 2.0, rv: 1.6, rh: 0.3, hip: 2.6, ads: 0.6, adsT: 0.15, f0: 6, f1: 10, fmin: 0.3, destr: 0, sight: 'iron', auto: false, mob: 1.0, sec: true, noFlash: true, taser: { range: 10, stun: 1.6 }, note: 'Two wired darts, 10 m: a hit stuns and slows (no headshots)' },
  };
  for (const k in WEAPONS) { WEAPONS[k].id = k; if (!WEAPONS[k].pellets) WEAPONS[k].pellets = 1; }

  /* ---------------------------------------------------- secondary gadgets -- */
  const GADGETS = {
    frag:     { name: 'FRAG GRENADE', count: 2, side: 'atk', icon: '✸', desc: 'Lethal blast around where it lands. Cooks while you hold the throw.' },
    smoke:    { name: 'SMOKE GRENADE', count: 2, side: 'atk', icon: '☁', desc: 'A thick cloud that blocks every line of sight for 12 seconds.' },
    stun:     { name: 'STUN GRENADE', count: 3, side: 'atk', icon: '✦', desc: 'Blinds and deafens anyone with eyes on it.' },
    breach:   { name: 'BREACH CHARGE', count: 3, side: 'atk', icon: '▣', desc: 'Stick it to a soft wall, floor or barricade and blow a hole. Press again to detonate.' },
    claymore: { name: 'TRIP CLAYMORE', count: 1, side: 'atk', icon: '◭', desc: 'Watches your back: detonates when a defender walks into its beam.' },
    wire:     { name: 'RAZOR WIRE', count: 2, side: 'def', icon: '⌇', desc: 'Slows and gives away anyone walking through it.' },
    dshield:  { name: 'DEPLOYABLE COVER', count: 1, side: 'def', icon: '▬', desc: 'Waist-high bulletproof cover. Explosives destroy it.' },
    c4:       { name: 'DETONATOR PACK', count: 1, side: 'def', icon: '✹', desc: 'Throw it, it sticks; press again to set it off. Very lethal.' },
    impact:   { name: 'IMPACT GRENADE', count: 2, side: 'def', icon: '✺', desc: 'Bursts on contact. Opens soft walls and floors for rotations.' },
    // ---- the second kit (carried by the season 4-9 operators and a few of the first)
    emp:      { name: 'EMP GRENADE', count: 2, side: 'atk', icon: '⌁', desc: 'Knocks out every defender electronic within 5 m for 12 seconds: turrets, sensors, cameras, coils, fields and detonators go dead, then come back.' },
    stim:     { name: 'STIM SHOT', count: 2, side: 'atk', icon: '✚', desc: 'Jab it in: 45 health back on the spot. It takes a second, and you cannot shoot while you do it.' },
    alarm:    { name: 'PROXIMITY ALARM', count: 2, side: 'def', icon: '◉', desc: 'Stick it to a wall or the floor. An attacker within 4 m sets it shrieking and is marked for your team. One bullet silences it.' },
    fog:      { name: 'FOG CANISTER', count: 2, side: 'def', icon: '☁', desc: 'Throw it, it sticks; press again to flood the spot with thick fog for 13 seconds. Nobody sees through it.' },
    // ---- seasons 10-14
    flankcam: { name: 'FLANK CAM', count: 2, side: 'atk', icon: '◫', desc: 'Stick it to a wall. Any defender in its 100° view within 14 m is marked for your team for 2 s. One bullet kills it; scramblers jam it.' },
    extinguisher: { name: 'EXTINGUISHER', count: 2, side: 'atk', icon: '❄', desc: 'A CO2 blast 4 m ahead: puts out fires, clears gas and slick, and leaves a brief white cloud.' },
    caltrops: { name: 'CALTROPS', count: 2, side: 'def', icon: '⁂', desc: 'A 1.6 m patch of spikes on the floor. Attackers who cross it faster than a careful walk are hurt, slowed and heard; crouching or walking gets through.' },
  };

  /* -------------------------------------------------------------- units -- */
  const UNITS = {
    aegis:     { name: 'AEGIS', full: 'Aegis Rapid Response Group', color: '#4f86c6', desc: 'Close-protection and hostage-rescue specialists drawn from coast-guard and police tactical teams.' },
    northwatch:{ name: 'NORTHWATCH', full: 'Northwatch Arctic Detachment', color: '#c9d3c4', desc: 'Cold-weather recon and rescue operators who learned to fight in whiteouts.' },
    vanta:     { name: 'VANTA', full: 'Vanta Signals Division', color: '#8e6bd6', desc: 'Electronic-warfare unit: if it beeps, glows or transmits, Vanta owns it.' },
    cinder:    { name: 'CINDER', full: 'Cinder Urban Demolition Brigade', color: '#e0782f', desc: 'Firefighters turned breachers. They open buildings for a living.' },
    tidebreak: { name: 'TIDEBREAK', full: 'Tidebreak Maritime Interdiction', color: '#2fb3a6', desc: 'Ship-boarding specialists who fight corridor to corridor.' },
    ironveil:  { name: 'IRONVEIL', full: 'Ironveil Border Rangers', color: '#b0523f', desc: 'SEASON 1 · Operation Cold Iron. A two-operator expansion squad.' },
    driftline: { name: 'DRIFTLINE', full: 'Driftline Harbor Engineers', color: '#4f9a6e', desc: 'SEASON 2 · Operation Low Tide. Salvage and flood-control engineers who build cover and seal breaches in minutes.' },
    meridian:  { name: 'MERIDIAN', full: 'Meridian Riot Response', color: '#d6b13a', desc: 'SEASON 3 · Operation Floodlight. Crowd-control specialists: light, haze and noise.' },
    umbra:     { name: 'UMBRA', full: 'Umbra Night Operations', color: '#6a5acd', desc: 'SEASON 4 · Operation Nightfall. They own the dark: one walks through it unseen, the other switches it on.' },
    trawl:     { name: 'TRAWL', full: 'Trawl Deep-Sea Recovery', color: '#3a8fb7', desc: 'SEASON 5 · Operation Iron Tide. Salvage divers who move people and things with a line: pulled in, or snapped back.' },
    override:  { name: 'OVERRIDE', full: 'Override Systems Group', color: '#e04a6a', desc: 'SEASON 6 · Operation Hard Reset. Machines that fight for whoever holds the keys.' },
    breakline: { name: 'BREAKLINE', full: 'Breakline Entry Team', color: '#c97a3a', desc: 'SEASON 7 · Operation Ram Raid. One goes through walls, the other makes sure your gun fails when you arrive.' },
    kinetic:   { name: 'KINETIC', full: 'Kinetic Response Cell', color: '#e8d24a', desc: 'SEASON 8 · Operation Overclock. Speed and misdirection.' },
    resonant:  { name: 'RESONANT', full: 'Resonant Acoustics Unit', color: '#5fc9a8', desc: 'SEASON 9 · Operation Echo. One hears every shot, the other makes a room go quiet.' },
    // ---- seasons 10-14: four operators each, two a side
    halyard:   { name: 'HALYARD', full: 'Halyard Rope Access Team', color: '#d8853a', desc: 'SEASON 10 · Operation High Line. Industrial climbers and riggers: new ways up, down, across and through, and the people who close them.' },
    cipher:    { name: 'CIPHER', full: 'Cipher Information Operations', color: '#3fd0e0', desc: 'SEASON 11 · Operation Dead Air. They do not hide the truth from you; they hand you a better story.' },
    foundry:   { name: 'FOUNDRY', full: 'Foundry Materials Unit', color: '#c0603a', desc: 'SEASON 12 · Operation Cold Forge. Metallurgists and chemists who change what a wall, a floor or the ground under you is made of.' },
    squall:    { name: 'SQUALL', full: 'Squall Environmental Response', color: '#5aa0d8', desc: 'SEASON 13 · Operation Downpour. Disaster-response specialists: sound, water and shelter.' },
    sightline: { name: 'SIGHTLINE', full: 'Sightline Group', color: '#e0c050', desc: 'SEASON 14 · Operation Long Shadow. Who can see whom, from where, and for how long.' },
  };

  /* ----------------------------------------------------------- operators --
     armor 1..3 (more HP, slower) · speed 3..1                                 */
  const OPS = [
    // ---------------- attackers
    { id: 'kiln', name: 'KILN', real: 'Ines Varga', side: 'atk', unit: 'cinder', role: 'Hard Breacher', armor: 2, speed: 2,
      primaries: ['vkr5', 'gale12'], secondaries: ['p10', 'maul'], gadgets: ['stun', 'claymore'],
      ability: { id: 'bore', name: 'PLASMA BORE', count: 2, desc: 'A sticky thermal lance that cuts a doorway through ANY wall, even reinforced ones. Takes 4 s to burn; dampeners and scramblers make it fizzle.' },
      look: { head: 'visor', helmet: 0xd06a2a, vest: 0x34322f, cloth: 0x4a4440, accent: 0xff9a3c, skin: 0xa7735a, hair: 0x221a14 },
      bio: 'Ex-foundry engineer. Kiln will tell you that walls are just a suggestion with a melting point.' },
    { id: 'torque', name: 'TORQUE', real: 'Dmitri Halloran', side: 'atk', unit: 'cinder', role: 'Area Clear', armor: 2, speed: 2,
      primaries: ['halberd', 'tallow'], secondaries: ['p10', 'hornet'], gadgets: ['breach', 'stun'],
      ability: { id: 'spike', name: 'CONCUSSION SPIKE', count: 3, desc: 'Drill a spike through a soft wall or floor. It punches through and bursts on the far side: stuns, wounds and wrecks defender gadgets.' },
      look: { head: 'gasmask', helmet: 0x3b3936, vest: 0x5a4a3a, cloth: 0x45403a, accent: 0xe0782f, skin: 0xd0a080, hair: 0x6b4a2a },
      bio: 'Torque cleared collapsed buildings for twelve years. He listens to walls before he drills them.' },
    { id: 'rivet', name: 'RIVET', real: 'Mara Quell', side: 'atk', unit: 'tidebreak', role: 'Soft Breacher', armor: 1, speed: 3,
      primaries: ['k77', 'strider'], secondaries: ['p10', 'stub'], gadgets: ['breach', 'claymore'],
      ability: { id: 'rivet', name: 'RIVET GUN', count: 3, desc: 'Fires a shaped charge up to 35 m that blows a hole through soft walls, floors and barricades. Useless against reinforcement.' },
      look: { head: 'beanie', helmet: 0x1f5a5a, vest: 0x2a3b45, cloth: 0x2b4a52, accent: 0x2fb3a6, skin: 0xe2b89a, hair: 0xb06b2a },
      bio: 'A ship\'s welder who discovered that the fastest way between two compartments is straight through.' },
    { id: 'glare', name: 'GLARE', real: 'Tomas Ruelle', side: 'atk', unit: 'tidebreak', role: 'Flash Support', armor: 1, speed: 3,
      primaries: ['k77', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['smoke', 'frag'],
      ability: { id: 'photon', name: 'PHOTON MINES', count: 3, desc: 'Sticky light traps. When a defender comes into view within 6 m, the mine pops and blinds them.' },
      look: { head: 'cap', helmet: 0x1d2a44, vest: 0x2f3d55, cloth: 0x27324a, accent: 0xfff27a, skin: 0x8a5a3c, hair: 0x111111 },
      bio: 'Glare used to light stadium shows. Now he lights rooms, briefly and painfully.' },
    { id: 'crag', name: 'CRAG', real: 'Henrik Aalto', side: 'atk', unit: 'aegis', role: 'Shield', armor: 3, speed: 1,
      primaries: ['shield'], secondaries: ['p10', 'maul'], gadgets: ['smoke', 'stun'],
      ability: { id: 'plant', name: 'BULWARK PLANT', count: 99, desc: 'Carries a full-height ballistic shield. Press the ability to plant it as cover, and interact to pick it back up.' },
      look: { head: 'helmet', helmet: 0x3c4a5c, vest: 0x2e3846, cloth: 0x3a4554, accent: 0x4f86c6, skin: 0xe8c0a0, hair: 0xcfae7a },
      bio: 'Six foot five and patient. Crag has never lost a corridor he walked into first.' },
    { id: 'marlow', name: 'MARLOW', real: 'Clara Marlow', side: 'atk', unit: 'aegis', role: 'Marksman', armor: 1, speed: 3,
      primaries: ['lancet', 'vkr5'], secondaries: ['p10', 'maul'], gadgets: ['frag', 'claymore'],
      ability: { id: 'spotter', name: 'SPOTTER SCOPE', count: 99, desc: 'Every defender under her scope is marked for the whole team for 6 s. The ability toggles a 4x zoom.' },
      look: { head: 'boonie', helmet: 0x55634a, vest: 0x3d4a3a, cloth: 0x4a5442, accent: 0x4f86c6, skin: 0xf0c8a8, hair: 0xd8b070 },
      bio: 'Former Olympic biathlete. Breathes out, waits, and then you are marked.' },
    { id: 'halcyon', name: 'HALCYON', real: 'Seo-yun Park', side: 'atk', unit: 'northwatch', role: 'Support', armor: 2, speed: 2,
      primaries: ['halberd', 'strider'], secondaries: ['p10', 'hornet'], gadgets: ['smoke', 'frag', 'stim'],
      ability: { id: 'beacon', name: 'FIELD BEACON', count: 1, desc: 'A deployable beacon that heals allies around it, overheals up to +20 and revives downed allies in its field.' },
      look: { head: 'hood', helmet: 0xd8ddd2, vest: 0x5d6a4e, cloth: 0xc9d0c2, accent: 0x7ce0a0, skin: 0xf2d0b0, hair: 0x14110f },
      bio: 'Arctic flight medic. Her beacon has pulled more people out of the snow than any helicopter.' },
    { id: 'vesper', name: 'VESPER', real: 'Aleksi Norrback', side: 'atk', unit: 'northwatch', role: 'Intel', armor: 2, speed: 2,
      primaries: ['vkr5', 'torrent'], secondaries: ['p10', 'maul'], gadgets: ['stun', 'breach'],
      ability: { id: 'sonar', name: 'SONAR PULSE', count: 99, cd: 20, desc: 'Sends a pulse through walls: every defender within 18 m is revealed to the team for 3 s. Recharges in 20 s.' },
      look: { head: 'balaclava', helmet: 0xe6e8e2, vest: 0x6a705e, cloth: 0xd8dccf, accent: 0x9ad8ff, skin: 0xf0d0b8, hair: 0xeeeeee },
      bio: 'Submarine sonar operator. To Vesper, a building is just a very noisy ocean.' },
    { id: 'static', name: 'STATIC', real: 'Jun Ito-Brandt', side: 'atk', unit: 'vanta', role: 'Anti-Gadget', armor: 2, speed: 2,
      primaries: ['k77', 'torrent'], secondaries: ['p10', 'hornet'], gadgets: ['breach', 'claymore', 'emp'],
      ability: { id: 'surge', name: 'SURGE DRONE', count: 3, desc: 'Static\'s drones carry arc emitters: fire while piloting to fry every defender electronic within 3.5 m. Three zaps per round.' },
      look: { head: 'hood', helmet: 0x1b1a22, vest: 0x2a2633, cloth: 0x221f2a, accent: 0xb07cff, skin: 0xe8c8a8, hair: 0x101010 },
      bio: 'Static builds drones out of what other people throw away, and then throws them at you.' },
    { id: 'quill', name: 'QUILL', real: 'Noor Haddad', side: 'atk', unit: 'vanta', role: 'Trap Hunter', armor: 1, speed: 3,
      primaries: ['halberd', 'strider'], secondaries: ['p10', 'maul'], gadgets: ['frag', 'breach'],
      ability: { id: 'scanner', name: 'GADGET SCANNER', count: 99, desc: 'Raise the scanner to see every defender gadget within 25 m through walls. Hold interact on a trap within 2 m to disarm it.' },
      look: { head: 'bandana', helmet: 0x2b2533, vest: 0x352d40, cloth: 0x2e2838, accent: 0xb07cff, skin: 0xb07a58, hair: 0x1a1210 },
      bio: 'Quill cut her teeth defusing car bombs. Tripwires do not impress her.' },
    { id: 'pike', name: 'PIKE', real: 'Owen Pike', side: 'atk', unit: 'ironveil', role: 'Area Denial', armor: 2, speed: 2, season: 1,
      primaries: ['vkr5', 'tallow'], secondaries: ['p10', 'stub'], gadgets: ['stun', 'frag'],
      ability: { id: 'smokegl', name: 'SMOKE LAUNCHER', count: 4, desc: 'An underbarrel launcher with four long-burning smoke canisters. Blocks sight lines and cameras around a plant.' },
      look: { head: 'beret', helmet: 0x6a2a24, vest: 0x5a5040, cloth: 0x6b604c, accent: 0xb0523f, skin: 0xd8a888, hair: 0x5a3a20 },
      bio: 'Season 1. A border ranger who believes the best cover is the cover you bring with you.' },
    { id: 'brace', name: 'BRACE', real: 'Ilse Varnholt', side: 'atk', unit: 'driftline', role: 'Cover Builder', armor: 2, speed: 2, season: 2,
      primaries: ['k77', 'torrent'], secondaries: ['p10', 'hornet'], gadgets: ['smoke', 'breach'],
      ability: { id: 'foam', name: 'BARRIER FOAM', count: 3, desc: 'Fires a canister that sets into a waist-high foam wall, 2 m wide, where it lands. It stops bullets until it is shot apart; explosives clear it at once. Cover for a plant in an open room.' },
      look: { head: 'cap', helmet: 0x2f5a44, vest: 0x3a4a3e, cloth: 0x45574a, accent: 0x7ce0a0, skin: 0xe0b896, hair: 0xc8a060 },
      bio: 'Season 2. A flood-barrier engineer who has held back rivers with less than she carries now.' },
    { id: 'haze', name: 'HAZE', real: 'Noemi Brandvold', side: 'atk', unit: 'meridian', role: 'Flush', armor: 2, speed: 2, season: 3,
      primaries: ['vkr5', 'strider'], secondaries: ['p10', 'maul'], gadgets: ['frag', 'claymore'],
      ability: { id: 'irritant', name: 'IRRITANT SHELLS', count: 3, desc: 'Lobs a canister that fills 3.5 m with a stinging haze for 12 s. It does not block sight, but defenders inside take steady damage, cough out loud and are revealed to your team every 2 s.' },
      look: { head: 'gasmask', helmet: 0x5a4a1c, vest: 0x4a4430, cloth: 0x5a5238, accent: 0xd6b13a, skin: 0xc89070, hair: 0x2a1a10 },
      bio: 'Season 3. Riot-control veteran. Haze would rather you walked out of that corner on your own.' },
    { id: 'wraith', name: 'WRAITH', real: 'Linnea Sorrel', side: 'atk', unit: 'umbra', role: 'Infiltrator', armor: 1, speed: 3, season: 4,
      primaries: ['hush45', 'k77'], secondaries: ['verdict', 'p10'], gadgets: ['stun', 'claymore', 'emp'],
      ability: { id: 'cloak', name: 'PHASE CLOAK', count: 2, desc: 'Six seconds of near-invisibility with silent footsteps. Bots lose you beyond 4 m, players see only a shimmer, and nothing can mark you. Firing, a melee or throwing something ends it.' },
      look: { head: 'balaclava', helmet: 0x1c1a2a, vest: 0x23203a, cloth: 0x1a1826, accent: 0x8a7cff, skin: 0xe0c0a8, hair: 0x101018 },
      bio: 'Season 4. Wraith never kicked a door in her life. She was already in the room.' },
    { id: 'gaff', name: 'GAFF', real: 'Bram Oosterhuis', side: 'atk', unit: 'trawl', role: 'Displacer', armor: 3, speed: 1, season: 5,
      primaries: ['slug8', 'halberd'], secondaries: ['maul', 'p10'], gadgets: ['smoke', 'frag', 'stim'],
      ability: { id: 'harpoon', name: 'HARPOON LINE', count: 3, desc: 'Fires a barbed line up to 16 m. Hook a defender and they are dragged five metres toward you, staggered and slowed. Hook a gadget and it is ripped off the wall.' },
      look: { head: 'beanie', helmet: 0x1f4a66, vest: 0x2a3a48, cloth: 0x2c5a78, accent: 0x7cd0ff, skin: 0xd8a888, hair: 0x8a5a30 },
      bio: 'Season 5. Thirty years hauling wrecks off the seabed. If Gaff wants you out of that corner, you are coming out.' },
    { id: 'splice', name: 'SPLICE', real: 'Amara Diallo', side: 'atk', unit: 'override', role: 'Hacker', armor: 2, speed: 2, season: 6,
      primaries: ['kb3', 'strider'], secondaries: ['p10', 'hornet'], gadgets: ['breach', 'stun', 'emp'],
      ability: { id: 'hijack', name: 'HIJACK DART', count: 3, desc: 'Shoot a defender\'s electronic gadget from up to 20 m and it changes sides: snares catch defenders, sensors and cameras report to you, turrets and floodlights turn on their owners.' },
      look: { head: 'visor', helmet: 0x3a1420, vest: 0x2a2228, cloth: 0x3a2a30, accent: 0xff5a7a, skin: 0x6a4630, hair: 0x120c0a },
      bio: 'Season 6. Splice does not break your security system. She promotes herself to its administrator.' },
    { id: 'tusk', name: 'TUSK', real: 'Viktor Hale', side: 'atk', unit: 'breakline', role: 'Ram', armor: 3, speed: 1, season: 7,
      primaries: ['rampart', 'torrent'], secondaries: ['maul', 'stub'], gadgets: ['frag', 'smoke', 'stim'],
      ability: { id: 'ram', name: 'BATTERING CHARGE', count: 3, desc: 'For four seconds, sprint straight through a soft wall or barricade: it bursts open around you and anyone within two metres of the far side is knocked reeling. Reinforced and hard walls stop you.' },
      look: { head: 'helmet', helmet: 0x6a4a2a, vest: 0x4a3a2c, cloth: 0x5a4632, accent: 0xffa040, skin: 0xe8c0a0, hair: 0x3a2a1a },
      bio: 'Season 7. Rugby prop, then demolition crew. Tusk considers a door a formality and a wall a short delay.' },
    { id: 'dynamo', name: 'DYNAMO', real: 'Kira Tanaka-Reyes', side: 'atk', unit: 'kinetic', role: 'Entry', armor: 1, speed: 3, season: 8,
      primaries: ['bankshot', 'vkr5'], secondaries: ['verdict', 'hornet'], gadgets: ['stun', 'breach', 'stim'],
      ability: { id: 'overdrive', name: 'OVERDRIVE', count: 2, desc: 'Seven seconds of adrenaline: 30% faster on your feet, snap aim, half-time reloads, and wire, snares and stuns do not hold you. Then three seconds winded: slower and shakier.' },
      look: { head: 'cap', helmet: 0xd8c040, vest: 0x2a2a30, cloth: 0x3a3a44, accent: 0xfff06a, skin: 0xe8c8a0, hair: 0x1a1414 },
      bio: 'Season 8. Dynamo is through the door before the door has finished opening.' },
    { id: 'triad', name: 'TRIAD', real: 'Soren Whitlock', side: 'atk', unit: 'resonant', role: 'Counter-Fire', armor: 2, speed: 2, season: 9,
      primaries: ['kb3', 'hammer50'], secondaries: ['p10', 'maul'], gadgets: ['claymore', 'smoke', 'emp'],
      ability: { id: 'triang', name: 'TRIANGULATOR', count: 2, desc: 'A listening post. While it stands, any defender who fires an unsuppressed gun within 25 m of it is marked for your team for 2.5 s. One bullet breaks it.' },
      look: { head: 'boonie', helmet: 0x3a6a5a, vest: 0x2e3e3a, cloth: 0x3a5048, accent: 0x7ce8c0, skin: 0xf0d0b0, hair: 0xb89060 },
      bio: 'Season 9. An artillery spotter who can tell you which window a shot came from, and what the shooter had for lunch.' },
    // ---- seasons 10-14 (tools/NEW-OPERATORS.md)
    { id: 'rust', name: 'RUST', real: 'Agnieszka Rustova', side: 'atk', unit: 'foundry', role: 'Reinforcement Breaker', armor: 2, speed: 2, season: 12,
      primaries: ['halberd', 'gale12'], secondaries: ['p10', 'stub'], gadgets: ['breach', 'smoke'],
      ability: { id: 'degauss', name: 'DEGAUSSER', count: 2, desc: 'Mount it on reinforced steel: a wall, a bunker plate, a shutter or a hatch. After a 6 s hum the plate in a 2 m × 2.5 m area turns brittle. It still stands, but breach charges, rivets, spikes, a battering charge or shotguns now open it. Dampeners and scramblers jam it; 40 HP; the hum carries.' },
      look: { head: 'welder', pack: 'coil', helmet: 0x5a3020, vest: 0x3a3430, cloth: 0x4a3c34, accent: 0xff7a3a, skin: 0xe8c0a0, hair: 0x8a3a1a },
      bio: 'Season 12. A shipyard metallurgist. Rust does not cut your steel; she talks it out of being steel.' },
    { id: 'skid', name: 'SKID', real: 'Paulo Mendes', side: 'atk', unit: 'foundry', role: 'Traction Denial', armor: 1, speed: 3, season: 12,
      primaries: ['lattice', 'vkr5'], secondaries: ['p10', 'hornet'], gadgets: ['frag', 'extinguisher'],
      ability: { id: 'slick', name: 'SLICK CANISTER', count: 3, desc: 'Throw a canister that bursts into a 3.5 m pool of polymer slick for 18 s. Anyone on it, either team, loses traction: slow to start and slow to stop, no sprinting, a looser aim, and every step squeaks loudly. Sprinklers wash it away.' },
      look: { head: 'respirator', pack: 'tank', helmet: 0x2a4a5a, vest: 0x30383c, cloth: 0x3c4a50, accent: 0x5ad0ff, skin: 0x8a5a3c, hair: 0x101010 },
      bio: 'Season 12. A tyre-test engineer from a race circuit. Skid knows exactly how little it takes to put you on the floor.' },
    { id: 'grit', name: 'GRIT', real: 'Abel Grützner', side: 'atk', unit: 'sightline', role: 'Suppression', armor: 3, speed: 1, season: 14,
      primaries: ['spindle', 'rampart'], secondaries: ['maul', 'p10'], gadgets: ['smoke', 'frag'],
      ability: { id: 'suppress', name: 'SUPPRESSIVE FIRE', count: 2, desc: 'Nine seconds in which Grit\'s rounds pin people down: one that passes within 1.6 m of a defender, or hits the cover they are behind, suppresses them for 2 s: a shaking view, +3° spread, aiming and leaning at half speed. Suppressed bots stop peeking and go for cover.' },
      look: { head: 'heavy', pack: 'ammo', pads: true, helmet: 0x4a4a32, vest: 0x3a3a2c, cloth: 0x4a4a3a, accent: 0xe0c050, skin: 0xd8a888, hair: 0x2a1a10 },
      bio: 'Season 14. Twenty years a machine-gun instructor. Grit does not need to hit you to stop you peeking.' },
    // ---------------- defenders
    { id: 'anvil', name: 'ANVIL', real: 'Gregor Sand', side: 'def', unit: 'tidebreak', role: 'Anti-Breach', armor: 3, speed: 1,
      primaries: ['torrent', 'tallow'], secondaries: ['p10', 'maul'], gadgets: ['wire', 'dshield'],
      ability: { id: 'dampener', name: 'DAMPENER', count: 2, desc: 'Mount it on a wall. Any plasma bore, rivet charge or concussion spike within 2.5 m fizzles. One bullet kills it.' },
      look: { head: 'helmet', helmet: 0x26404a, vest: 0x1f3038, cloth: 0x2a3d44, accent: 0x2fb3a6, skin: 0x6e4a34, hair: 0x111111 },
      bio: 'Anvil sat in front of a ship\'s reactor door for three days once. Nobody got in.' },
    { id: 'okafor', name: 'OKAFOR', real: 'Chidi Okafor', side: 'def', unit: 'tidebreak', role: 'Anti-Projectile', armor: 2, speed: 2,
      primaries: ['salvo9', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['wire', 'c4'],
      ability: { id: 'seeker', name: 'HUNTER SEEKER', count: 2, desc: 'A launcher box that fires micro-seekers at drones and thrown projectiles within 9 m. Three seekers per box.' },
      look: { head: 'cap', helmet: 0x264a50, vest: 0x2c3a3e, cloth: 0x33464a, accent: 0x2fb3a6, skin: 0x5a3a28, hair: 0x0e0e0e },
      bio: 'Naval air-defence officer. Considers every flying object a personal insult.' },
    { id: 'brick', name: 'BRICK', real: 'Rosa Brickell', side: 'def', unit: 'aegis', role: 'Anchor', armor: 3, speed: 1,
      primaries: ['gale12', 'strider'], secondaries: ['p10', 'maul'], gadgets: ['dshield', 'impact'],
      ability: { id: 'bunker', name: 'BUNKER PLATES', count: 2, desc: 'Seal an open doorway with steel plates (only a hard breach gets through). Also brings two extra reinforcements and reinforces twice as fast.' },
      look: { head: 'helmet', helmet: 0x384656, vest: 0x2a3440, cloth: 0x404a58, accent: 0x4f86c6, skin: 0xd8a888, hair: 0x3a2418 },
      bio: 'A structural engineer with a riot-control past. Builds her own walls when she does not like yours.' },
    { id: 'tamsin', name: 'TAMSIN', real: 'Tamsin Reyes', side: 'def', unit: 'aegis', role: 'Medic', armor: 2, speed: 2,
      primaries: ['salvo9', 'torrent'], secondaries: ['p10', 'hornet'], gadgets: ['wire', 'impact'],
      ability: { id: 'medstation', name: 'MED STATION', count: 1, desc: 'A trauma crate: each defender can grab a +40 HP overheal once, and it slowly heals anyone standing beside it.' },
      look: { head: 'cap', helmet: 0x8a2a2a, vest: 0x34404e, cloth: 0x3d4858, accent: 0xff6a6a, skin: 0xc89070, hair: 0x2a1810 },
      bio: 'ER nurse turned tactical medic. Will patch you up and then tell you what you did wrong.' },
    { id: 'sable', name: 'SABLE', real: 'Ingrid Solberg', side: 'def', unit: 'northwatch', role: 'Trapper', armor: 2, speed: 2,
      primaries: ['strider', 'gale12'], secondaries: ['p10', 'maul'], gadgets: ['c4', 'dshield'],
      ability: { id: 'snare', name: 'SNARE LINE', count: 4, desc: 'A laser tether across a door or window. The first attacker through is rooted for 2.5 s and revealed to your team.' },
      look: { head: 'beanie', helmet: 0xe2e4dc, vest: 0x5a6250, cloth: 0xcfd4c6, accent: 0x7ce0a0, skin: 0xf2d6c0, hair: 0xe8d090 },
      bio: 'Trapper from the far north. Sable thinks of doorways as places where people stop moving.' },
    { id: 'kestrel', name: 'KESTREL', real: 'Ada Lindgren', side: 'def', unit: 'northwatch', role: 'Intel', armor: 1, speed: 3,
      primaries: ['salvo9', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['wire', 'impact'],
      ability: { id: 'bpcam', name: 'ARMORED CAMS', count: 2, desc: 'Bulletproof cameras you mount anywhere and watch from the camera network. Only explosives and surges take them out.' },
      look: { head: 'hood', helmet: 0xdadfd6, vest: 0x5d6656, cloth: 0xc4ccbc, accent: 0x9ad8ff, skin: 0xf0d2bc, hair: 0x8a5a30 },
      bio: 'Wildlife photographer turned surveillance specialist. Patient enough to watch a doorway for an hour.' },
    { id: 'morrow', name: 'MORROW', real: 'Felix Morrow', side: 'def', unit: 'vanta', role: 'Anti-Electronics', armor: 2, speed: 2,
      primaries: ['strider', 'torrent'], secondaries: ['p10', 'maul'], gadgets: ['wire', 'dshield'],
      ability: { id: 'scrambler', name: 'SIGNAL SCRAMBLER', count: 4, desc: 'Jams everything electronic within 2.5 m: drones die, breach charges will not fire, plasma bores fizzle.' },
      look: { head: 'balaclava', helmet: 0x1e1c26, vest: 0x2c2838, cloth: 0x24212e, accent: 0xb07cff, skin: 0xe0c0a0, hair: 0x222222 },
      bio: 'Morrow once took down a city\'s traffic lights by accident. Now he does it on purpose, very locally.' },
    { id: 'juno', name: 'JUNO', real: 'Juno Achterberg', side: 'def', unit: 'vanta', role: 'Early Warning', armor: 1, speed: 3,
      primaries: ['salvo9', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['c4', 'impact', 'alarm'],
      ability: { id: 'sensor', name: 'PROXIMITY SENSOR', count: 5, desc: 'Sticky motion sensors. When an attacker comes within 4 m, even through a wall, the whole team sees them for 3 s.' },
      look: { head: 'visor', helmet: 0x2a2436, vest: 0x332c40, cloth: 0x2b2638, accent: 0xb07cff, skin: 0xf4dcc8, hair: 0xd04a8a },
      bio: 'Juno wires buildings so they can tell on you.' },
    { id: 'hollis', name: 'HOLLIS', real: 'Wade Hollis', side: 'def', unit: 'cinder', role: 'Area Denial', armor: 2, speed: 2,
      primaries: ['torrent', 'strider'], secondaries: ['p10', 'maul'], gadgets: ['wire', 'c4'],
      ability: { id: 'incendiary', name: 'INCENDIARY POT', count: 3, desc: 'Throw a pot of gel fuel: a 2.5 m pool of fire burns for 10 s, hurting anyone who stands in it.' },
      look: { head: 'gasmask', helmet: 0x3a332c, vest: 0x4a3a2c, cloth: 0x3d342b, accent: 0xff7a2a, skin: 0xd0a080, hair: 0x2a1a10 },
      bio: 'Wildland firefighter. Knows exactly how fire moves, and where you will not want to be.' },
    { id: 'rhea', name: 'RHEA', real: 'Rhea Castellanos', side: 'def', unit: 'cinder', role: 'Rotation', armor: 2, speed: 2,
      primaries: ['salvo9', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['dshield', 'impact'],
      ability: { id: 'rcharge', name: 'ROTATION CHARGE', count: 3, desc: 'Sticky remote charges. Throw with the ability, HOLD the ability to set them all off: opens soft walls and floors, deadly up close.' },
      look: { head: 'bandana', helmet: 0x4a2c22, vest: 0x3d3028, cloth: 0x4a3a30, accent: 0xff7a2a, skin: 0xb88060, hair: 0x1a0e08 },
      bio: 'Rhea opens new hallways where the architect forgot to put them.' },
    { id: 'lark', name: 'LARK', real: 'Ezra Lindqvist', side: 'def', unit: 'ironveil', role: 'Roamer', armor: 1, speed: 3, season: 1,
      primaries: ['strider', 'gale12'], secondaries: ['p10', 'maul'], gadgets: ['c4', 'wire', 'fog'],
      ability: { id: 'decoy', name: 'DECOY EMITTER', count: 2, desc: 'Throws a speaker that fakes footsteps and gunfire for 20 s. Lark\'s own footsteps are near silent.' },
      look: { head: 'hood', helmet: 0x4a2a26, vest: 0x40382c, cloth: 0x50463a, accent: 0xb0523f, skin: 0xe8c4a4, hair: 0x6a3a1a },
      bio: 'Season 1. Border tracker who learned to walk on dry leaves without a sound.' },
    { id: 'seam', name: 'SEAM', real: 'Tobiah Mensah', side: 'def', unit: 'driftline', role: 'Repair', armor: 2, speed: 2, season: 2,
      primaries: ['strider', 'gale12'], secondaries: ['p10', 'maul'], gadgets: ['wire', 'dshield'],
      ability: { id: 'patch', name: 'PATCH SPRAY', count: 4, desc: 'Sprays fast-setting sealant into the breach you are looking at, refilling a hole in a wall, floor or hatch up to about 3 m across. The patch is soft foam, so it can be broken open again.' },
      look: { head: 'beanie', helmet: 0x2f5a44, vest: 0x34443a, cloth: 0x3d5044, accent: 0x7ce0a0, skin: 0x6e4a34, hair: 0x111111 },
      bio: 'Season 2. Ship\'s damage-control chief. Every hole you make, Seam has already priced the repair.' },
    { id: 'lumen', name: 'LUMEN', real: 'Rafael Quint', side: 'def', unit: 'meridian', role: 'Denial', armor: 1, speed: 3, season: 3,
      primaries: ['salvo9', 'torrent'], secondaries: ['p10', 'hornet'], gadgets: ['c4', 'wire'],
      ability: { id: 'floodlight', name: 'FLOODLIGHT', count: 2, desc: 'A tripod floodlight. Attackers within 15 m who look into its beam are dazzled: a white glare and shaky aim. Two or three bullets break it; explosives and surges kill it.' },
      look: { head: 'visor', helmet: 0x6a5a20, vest: 0x3d3a30, cloth: 0x4a4636, accent: 0xfff27a, skin: 0xd8a888, hair: 0x5a3a20 },
      bio: 'Season 3. Stadium lighting rigger turned riot officer. Lumen picks where you are allowed to look.' },
    { id: 'nox', name: 'NOX', real: 'Idris Vane', side: 'def', unit: 'umbra', role: 'Blackout', armor: 2, speed: 2, season: 4,
      primaries: ['hush45', 'gale12'], secondaries: ['verdict', 'p10'], gadgets: ['c4', 'wire', 'fog'],
      ability: { id: 'blackout', name: 'BLACKOUT', count: 2, desc: 'Cuts the power for nine seconds. Attackers see only a few metres through the dark and bots lose sight beyond seven; defenders wear night optics and see as normal.' },
      look: { head: 'visor', helmet: 0x14121e, vest: 0x1e1c2c, cloth: 0x181624, accent: 0x6a5acd, skin: 0x8a6048, hair: 0x0c0c10 },
      bio: 'Season 4. Nox wired the breaker panel before you arrived. He has been waiting to use it.' },
    { id: 'moor', name: 'MOOR', real: 'Catriona Baird', side: 'def', unit: 'trawl', role: 'Roamer', armor: 2, speed: 2, season: 5,
      primaries: ['rampart', 'strider'], secondaries: ['maul', 'p10'], gadgets: ['impact', 'dshield', 'alarm'],
      ability: { id: 'recall', name: 'RECALL ANCHOR', count: 2, desc: 'Drop an anchor, go anywhere, and press again to be snapped straight back to it. Each anchor is good for one recall, and attackers can shoot it.' },
      look: { head: 'hood', helmet: 0x1f4a66, vest: 0x25323e, cloth: 0x2a4a60, accent: 0x7cd0ff, skin: 0xf0d2bc, hair: 0xc04a2a },
      bio: 'Season 5. A saturation diver. Moor always knows exactly how far she is from the way home.' },
    { id: 'warden', name: 'WARDEN', real: 'Elias Krantz', side: 'def', unit: 'override', role: 'Sentry', armor: 3, speed: 1, season: 6,
      primaries: ['hammer50', 'torrent'], secondaries: ['p10', 'hornet'], gadgets: ['wire', 'dshield', 'alarm'],
      ability: { id: 'turret', name: 'WATCHDOG TURRET', count: 1, desc: 'An automatic sentry gun. It watches an 80° arc out to 16 m, locks on after half a second and fires bursts. It can be shot apart, blown up, surged, or hijacked.' },
      look: { head: 'helmet', helmet: 0x4a1a26, vest: 0x2e2a30, cloth: 0x3a3238, accent: 0xff5a7a, skin: 0xe0b898, hair: 0x808080 },
      bio: 'Season 6. Warden trusts his turret more than most colleagues. It has never once been late.' },
    { id: 'ferro', name: 'FERRO', real: 'Dana Okonkwo', side: 'def', unit: 'breakline', role: 'Saboteur', armor: 2, speed: 2, season: 7,
      primaries: ['needler', 'salvo9'], secondaries: ['p10', 'maul'], gadgets: ['c4', 'wire', 'fog'],
      ability: { id: 'jamfield', name: 'MISFIRE COIL', count: 2, desc: 'A magnetic coil with a 6 m field. Attackers\' guns inside it misfire about one shot in five and reload much more slowly. Shoot it, blow it up or surge it to clear the field.' },
      look: { head: 'gasmask', helmet: 0x4a3420, vest: 0x3a3026, cloth: 0x4a3c2c, accent: 0xffa040, skin: 0x6e4a34, hair: 0x111111 },
      bio: 'Season 7. A railgun technician. Ferro would like to remind you that your rifle is mostly steel.' },
    { id: 'mimic', name: 'MIMIC', real: 'Paloma Ferreira', side: 'def', unit: 'kinetic', role: 'Deception', armor: 1, speed: 3, season: 8,
      primaries: ['bankshot', 'gale12'], secondaries: ['verdict', 'p10'], gadgets: ['impact', 'wire', 'alarm'],
      ability: { id: 'mannequin', name: 'BODY DOUBLE', count: 3, desc: 'Sets up a life-size double of herself. It looks like an operator holding an angle. Whoever shoots it is marked for her team for five seconds.' },
      look: { head: 'beret', helmet: 0xd8c040, vest: 0x2c2c34, cloth: 0x40404a, accent: 0xfff06a, skin: 0xc89070, hair: 0x2a1810 },
      bio: 'Season 8. A stage illusionist. Mimic is never where you shot, and now everyone knows where you are.' },
    { id: 'veil', name: 'VEIL', real: 'Hana Morgenstern', side: 'def', unit: 'resonant', role: 'Counter-Intel', armor: 2, speed: 2, season: 9,
      primaries: ['hush45', 'needler'], secondaries: ['p10', 'hornet'], gadgets: ['dshield', 'impact', 'fog'],
      ability: { id: 'nullfield', name: 'NULL FIELD', count: 2, desc: 'An emitter with a 7 m field. Defenders inside it cannot be marked or revealed by anything, their footsteps make no sound, and attacker drones that enter it lose signal.' },
      look: { head: 'hood', helmet: 0x2a5a4c, vest: 0x26342f, cloth: 0x2e463e, accent: 0x7ce8c0, skin: 0xf2d8c4, hair: 0xe8e0d0 },
      bio: 'Season 9. An anechoic-chamber engineer. Step into Veil\'s room and, as far as anyone can tell, you were never there.' },
    // ---- seasons 10-14
    { id: 'grout', name: 'GROUT', real: 'Bea Lindqvist-Oyelaran', side: 'def', unit: 'foundry', role: 'Hardening', armor: 3, speed: 1, season: 12,
      primaries: ['bramble', 'volta'], secondaries: ['p10', 'maul'], gadgets: ['wire', 'dshield'],
      ability: { id: 'resin', name: 'RESIN INJECTOR', count: 3, desc: 'Flood a 2 m × 2.5 m patch of soft wall, floor or hatch within 2.5 m with resin, all the way through. It turns bulletproof and shrugs off breach charges, rivets, spikes, impacts and a battering charge. It works where reinforcement can\'t, but it blocks your rotations too. A plasma bore cuts it; heavy rounds slowly chip it.' },
      look: { head: 'hardresp', pack: 'tank', helmet: 0xd8b040, vest: 0x4a4038, cloth: 0x5a4c40, accent: 0xffd060, skin: 0x6e4a34, hair: 0x111111 },
      bio: 'Season 12. A tunnel-grouting engineer. Grout seals cracks in mountains; your breach charge is a smaller problem.' },
    { id: 'drench', name: 'DRENCH', real: 'Rafe Okonjo', side: 'def', unit: 'squall', role: 'Utility Counter', armor: 2, speed: 2, season: 13,
      primaries: ['salvo9', 'gale12'], secondaries: ['p10', 'hornet'], gadgets: ['dshield', 'alarm'],
      ability: { id: 'sprinkler', name: 'SPRINKLER HEADS', count: 3, desc: 'Mount a head on a ceiling or wall. When attacker smoke, gas, slick or fire appears within 7 m it rains for 10 s: smoke clears in seconds, gas and slick wash away, every fire under it goes out (yours too), and the wet floor makes footsteps splash. One shower each; one bullet kills a head.' },
      look: { head: 'souwester', pack: 'tank', helmet: 0xe0c030, vest: 0x2a4a6a, cloth: 0x2e5070, accent: 0x5ab0ff, skin: 0xc89070, hair: 0x2a1810 },
      bio: 'Season 13. A fire-suppression engineer. Drench has put out refinery fires; your smoke grenade is a light drizzle.' },
  ];
  const OPMAP = {}; OPS.forEach(o => OPMAP[o.id] = o);

  const ARMOR_HP = { 1: 100, 2: 115, 3: 130 };
  const SPEED = { 1: { walk: 2.75, run: 4.6 }, 2: { walk: 3.05, run: 5.05 }, 3: { walk: 3.35, run: 5.5 } };

  const MODES = {
    bomb:    { name: 'BOMB', desc: 'Attackers plant a defuser on one of two bomb sites. Defenders stop the plant or disable the defuser.' },
    secure:  { name: 'SECURE AREA', desc: 'Attackers must hold the biohazard room with no defenders inside long enough to secure it.' },
    hostage: { name: 'HOSTAGE', desc: 'Attackers must reach the hostage and escort them to an extraction zone. Whoever harms the hostage loses.' },
    // arcade modes: one long round, instant respawns, no objective, no down-but-not-out
    tdm:     { name: 'TEAM DEATHMATCH', arcade: true, limit: 40, time: 420, desc: 'Two teams of five with respawns. First team to 40 kills wins, or the most kills when the 7 minutes run out.' },
    dm:      { name: 'DEATHMATCH', arcade: true, ffa: true, limit: 20, time: 360, desc: 'Ten players, everyone for themselves, with respawns. First to 20 kills wins, or the most kills after 6 minutes.' },
  };

  /* shop cosmetics: looks only, never stats. price 0 = everyone has it. */
  const RARITY = { common: { name: 'COMMON', color: '#9aa4b2' }, rare: { name: 'RARE', color: '#4f9be0' }, epic: { name: 'EPIC', color: '#b07cff' }, legendary: { name: 'LEGENDARY', color: '#f2c14e' } };
  const COSMETICS = {
    // weapon finishes: the colours of every gun's metal, polymer and fittings
    finish: {
      factory:  { name: 'Factory', rarity: 'common', price: 0, dark: 0x222428, poly: 0x34373c, mid: 0x44474d },
      sand:     { name: 'Desert Tan', rarity: 'common', price: 400, dark: 0x6b5a3e, poly: 0x8a7552, mid: 0xa48d64 },
      olive:    { name: 'Olive Drab', rarity: 'common', price: 400, dark: 0x3a4229, poly: 0x4f5a37, mid: 0x667148 },
      arctic:   { name: 'Arctic', rarity: 'common', price: 400, dark: 0xc4ccd4, poly: 0xe2e7ec, mid: 0x9aa4ae },
      cobalt:   { name: 'Cobalt', rarity: 'rare', price: 900, dark: 0x1c2f5a, poly: 0x2b4a8c, mid: 0x5a7fc8 },
      crimson:  { name: 'Crimson', rarity: 'rare', price: 900, dark: 0x5a1416, poly: 0x8c2226, mid: 0xc8484a },
      graphite: { name: 'Graphite', rarity: 'rare', price: 900, dark: 0x121316, poly: 0x1c1e22, mid: 0x7a8088, glowMid: true },
      toxic:    { name: 'Toxic', rarity: 'epic', price: 1800, dark: 0x1a2418, poly: 0x2a3a24, mid: 0x7cf05a, glowMid: true },
      neon:     { name: 'Neon Pulse', rarity: 'epic', price: 1800, dark: 0x1e1430, poly: 0x2c1e48, mid: 0xff4fd8, glowMid: true },
      gilded:   { name: 'Gilded', rarity: 'legendary', price: 4000, dark: 0x8a6a1c, poly: 0xc89a2a, mid: 0xf6d36a },
      obsidian: { name: 'Obsidian Ember', rarity: 'legendary', price: 4000, dark: 0x0c0c0e, poly: 0x18181c, mid: 0xff7a2a, glowMid: true },
    },
    // uniforms: the cloth and vest of whichever operator you play
    suit: {
      standard: { name: 'Unit Standard', rarity: 'common', price: 0 },
      urban:    { name: 'Urban Grey', rarity: 'common', price: 500, cloth: 0x4a4e55, vest: 0x2f3237 },
      dune:     { name: 'Dune', rarity: 'common', price: 500, cloth: 0x9a8560, vest: 0x6e5c40 },
      snow:     { name: 'Snowfield', rarity: 'rare', price: 1100, cloth: 0xd8dde2, vest: 0x9aa6b0, helmet: 0xe8ecf0 },
      jungle:   { name: 'Jungle', rarity: 'rare', price: 1100, cloth: 0x3a5a2e, vest: 0x2a3a20, helmet: 0x4a5a30 },
      night:    { name: 'Night Ops', rarity: 'epic', price: 2200, cloth: 0x15171c, vest: 0x0c0d10, helmet: 0x1a1c22, accent: 0x5ad8ff },
      redguard: { name: 'Red Guard', rarity: 'epic', price: 2200, cloth: 0x6a1c1c, vest: 0x3a1010, helmet: 0x2a0c0c, accent: 0xffc040 },
      royal:    { name: 'Royal', rarity: 'legendary', price: 4500, cloth: 0x1c2c6a, vest: 0xc8a030, helmet: 0x1c2c6a, accent: 0xfff0a0 },
    },
    // crosshair colours
    reticle: {
      white:   { name: 'White', rarity: 'common', price: 0, css: '#ffffff' },
      green:   { name: 'Signal Green', rarity: 'common', price: 250, css: '#5cff7a' },
      cyan:    { name: 'Cyan', rarity: 'common', price: 250, css: '#4fe6ff' },
      yellow:  { name: 'Hi-Vis Yellow', rarity: 'rare', price: 600, css: '#ffe14f' },
      magenta: { name: 'Magenta', rarity: 'rare', price: 600, css: '#ff4fd8' },
      red:     { name: 'Laser Red', rarity: 'epic', price: 1200, css: '#ff4040' },
    },
    // player cards: the banner behind your name on your profile, the home screen and the results
    card: {
      plain:   { name: 'Plain', rarity: 'common', price: 0, css: 'linear-gradient(120deg, #1a1f28, #12161d)' },
      dusk:    { name: 'Dusk', rarity: 'common', price: 400, css: 'linear-gradient(120deg, #3a2a5a, #1a1a30)' },
      ember:   { name: 'Ember', rarity: 'rare', price: 900, css: 'linear-gradient(120deg, #7a2a12, #2a1208)' },
      glacier: { name: 'Glacier', rarity: 'rare', price: 900, css: 'linear-gradient(120deg, #1a5a7a, #0c2030)' },
      aurora:  { name: 'Aurora', rarity: 'epic', price: 2000, css: 'linear-gradient(120deg, #1a7a5a, #2a3a8a 55%, #5a1a7a)' },
      sovereign: { name: 'Sovereign', rarity: 'legendary', price: 4000, css: 'linear-gradient(120deg, #8a6a1c, #f2c14e 50%, #6a4a10)' },
    },
  };
  const COS_KINDS = { finish: 'WEAPON FINISHES', suit: 'UNIFORMS', reticle: 'RETICLES', card: 'PLAYER CARDS' };

  const DIFFS = [
    { name: 'RECRUIT', react: 0.75, aimErr: 3.4, head: 0.08, track: 3.5 },
    { name: 'NORMAL', react: 0.5, aimErr: 2.2, head: 0.15, track: 5.5 },
    { name: 'REALISTIC', react: 0.32, aimErr: 1.3, head: 0.25, track: 8.0 },
  ];

  // mat(key, colour, opts): map files add their own materials with it (ids stay below OOB)
  window.DATA = { MAT, M, OOB, WEAPONS, GADGETS, UNITS, OPS, OPMAP, ARMOR_HP, SPEED, MODES, DIFFS, COSMETICS, COS_KINDS, RARITY, mat, SOFTW };
})();
