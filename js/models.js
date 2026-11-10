/* models.js -- voxel models: a paintable grid, a mesher, operator rigs,
   first- and third-person guns, gadgets, drones and cameras.
   Model space: +Y up, the model faces -Z (same as the camera), voxel (0,0,0) is
   centred on the part's pivot.                                                 */
(function () {
  'use strict';
  const GLOW = 0x1000000;
  const glow = c => (c & 0xffffff) | GLOW;
  const H = U.hash3;

  class Grid {
    constructor() { this.m = new Map(); }
    static k(x, y, z) { return ((x + 256) * 512 + (y + 256)) * 512 + (z + 256); }
    set(x, y, z, c) { if (c == null || c < 0) this.m.delete(Grid.k(x, y, z)); else this.m.set(Grid.k(x, y, z), c); return this; }
    has(x, y, z) { return this.m.has(Grid.k(x, y, z)); }
    box(x0, y0, z0, x1, y1, z1, c) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const v = typeof c === 'function' ? c(x, y, z) : c; if (v != null && v >= 0) this.set(x, y, z, v); else if (v === -2) this.m.delete(Grid.k(x, y, z));
      }
      return this;
    }
    cut(x0, y0, z0, x1, y1, z1) { return this.box(x0, y0, z0, x1, y1, z1, -2); }
    each(fn) { for (const [k, v] of this.m) { const z = (k % 512) - 256, y = (Math.floor(k / 512) % 512) - 256, x = Math.floor(k / 262144) - 256; fn(x, y, z, v); } }
  }

  const FACES = VW.FACES;
  const SH = [0.82, 0.72, 1.0, 0.55, 0.92, 0.78];
  function mesh(grid, s, jit) {
    jit = jit == null ? 0.06 : jit;
    const P = [], C = [], I = [];
    const col = new THREE.Color();
    grid.each((x, y, z, v) => {
      const g = (v & GLOW) !== 0;
      col.setHex(v & 0xffffff);
      const j = 1 + (H(x, y, z) - 0.5) * 2 * (g ? 0 : jit);
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        if (grid.has(x + F.d[0], y + F.d[1], z + F.d[2])) continue;
        const sh = g ? 1 : SH[f] * j, b = P.length / 3;
        for (const c of F.c) {
          P.push((x + c[0] - 0.5) * s, (y + c[1] - 0.5) * s, (z + c[2] - 0.5) * s);
          C.push(Math.min(1, col.r * sh), Math.min(1, col.g * sh), Math.min(1, col.b * sh));
        }
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.setIndex(I);
    geo.computeBoundingSphere();
    return geo;
  }
  const geoCache = new Map();
  function cached(key, build) { if (!geoCache.has(key)) geoCache.set(key, build()); return geoCache.get(key); }
  function mat() { return new THREE.MeshBasicMaterial({ vertexColors: true }); }
  function part(geo, material) { const m = new THREE.Mesh(geo, material); return m; }
  const shade = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return (r << 16) | (g << 8) | b; };

  /* ======================================================= operators (1/16 m) */
  const S = 1 / 16;
  function buildHead(L) {
    const g = new Grid(), skin = L.skin, hair = L.hair, hc = L.helmet, acc = L.accent;
    g.box(-2, 0, -2, 2, 4, 2, skin);
    g.set(-1, 2, -3, 0x15171a).set(1, 2, -3, 0x15171a); // eyes (front is -z)
    g.box(-2, 3, -2, 2, 4, 2, hair);
    switch (L.head) {
      case 'helmet': g.box(-3, 3, -3, 3, 5, 3, hc); g.box(-3, 1, -1, -3, 3, 3, hc); g.box(3, 1, -1, 3, 3, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-2, 3, -3, 2, 3, -3, shade(hc, 0.7)); break;
      case 'visor': g.box(-3, 3, -3, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-3, 1, 0, -3, 3, 3, hc); g.box(3, 1, 0, 3, 3, 3, hc); g.box(-2, 2, -3, 2, 2, -3, glow(acc)); break;
      case 'gasmask': g.box(-3, 3, -3, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-2, 0, -3, 2, 2, -3, 0x1e2024); g.set(-1, 2, -3, glow(0xff9a50)).set(1, 2, -3, glow(0xff9a50)); g.box(0, 0, -4, 0, 1, -4, acc); break;
      case 'cap': g.box(-2, 4, -2, 2, 5, 2, hc); g.box(-2, 4, -4, 2, 4, -3, hc); break;
      case 'beanie': g.box(-2, 4, -2, 2, 6, 2, hc); g.box(-3, 3, -2, 3, 3, 2, hc); g.box(-2, 3, -3, 2, 3, 3, hc); g.set(-1, 2, -3, glow(acc)).set(1, 2, -3, glow(acc)); break;
      case 'beret': g.box(-3, 4, -2, 2, 5, 2, hc); g.box(-3, 5, 0, -2, 5, 2, shade(hc, 0.85)); g.set(1, 4, -3, acc); break;
      case 'boonie': g.box(-2, 4, -2, 2, 5, 2, hc); g.box(-4, 4, -4, 4, 4, 4, hc); break;
      case 'hood': g.box(-3, 0, -2, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-2, 0, -2, 2, 3, -2, skin); g.set(-1, 2, -3, 0x15171a).set(1, 2, -3, 0x15171a); g.box(-2, 3, -3, 2, 3, -3, hc); break;
      case 'balaclava': g.box(-2, 0, -2, 2, 5, 2, hc); g.box(-2, 2, -2, 2, 2, -2, skin); g.set(-1, 2, -3, 0x15171a).set(1, 2, -3, 0x15171a); break;
      case 'bandana': g.box(-2, 0, -3, 2, 1, -2, hc); g.box(-3, 0, -2, 3, 1, 2, hc); g.box(-2, 4, -2, 2, 5, 2, hair); g.box(-3, 2, -1, -3, 3, 1, 0x111111); g.set(-3, 2, -2, glow(acc)); break;
    }
    return g;
  }
  function buildTorso(L, bulk) {
    const g = new Grid(), w = bulk > 2 ? 5 : 4, vest = L.vest, cloth = L.cloth;
    g.box(-w, 0, -2, w - 1, 10, 2, cloth);
    g.box(-w, 2, -3, w - 1, 9, 3, vest);
    g.box(-w, 0, -3, w - 1, 1, 3, 0x26282c);
    g.box(-3, 3, -4, -2, 5, -4, shade(vest, 0.8)); g.box(-1, 3, -4, 0, 5, -4, shade(vest, 0.8)); g.box(1, 3, -4, 2, 5, -4, shade(vest, 0.8));
    g.box(-2, 6, 4, 1, 9, 4, shade(vest, 0.85));
    g.set(w - 1, 8, -4, glow(L.accent)).set(-w, 8, -4, L.accent);
    if (bulk > 2) { g.box(-w - 1, 7, -3, -w - 1, 10, 3, vest); g.box(w, 7, -3, w, 10, 3, vest); }
    return g;
  }
  function buildArm(L) { const g = new Grid(); g.box(-1, -9, -1, 0, 0, 0, L.cloth); g.box(-1, -9, -1, 0, -8, 0, 0x2a2622); g.box(-1, -4, -1, 0, -3, 0, shade(L.cloth, 0.8)); return g; }
  function buildThigh(L) { const g = new Grid(); g.box(-1, -6, -1, 1, 0, 1, L.cloth); return g; }
  function buildShin(L) { const g = new Grid(); g.box(-1, -7, -1, 1, 0, 1, L.cloth); g.box(-1, -1, -2, 1, 0, -2, 0x2e2f33); g.box(-1, -7, -2, 1, -5, 1, 0x26241f); g.box(-1, -7, -3, 1, -7, -2, 0x26241f); return g; }

  /* third-person gun */
  function gunGeo3P(wid) {
    return cached('g3:' + wid, () => {
      const g = new Grid(), W = DATA.WEAPONS[wid], dark = 0x222428, poly = 0x34373c;
      const t = W ? W.type : 'AR';
      if (t === 'SHIELD') { g.box(-5, -12, 0, 5, 10, 0, 0x2c3540); g.box(-4, 2, -1, 4, 3, -1, glow(0x9ad8ff)); g.box(-5, -12, 1, 5, -12, 1, 0x15171a); return mesh(g, S, 0.03); }
      if (t === 'PISTOL' || t === 'MP') { g.box(0, 0, -5, 0, 1, 0, dark); g.box(0, -3, -1, 0, -1, 0, poly); return mesh(g, S); }
      const len = t === 'DMR' ? 14 : t === 'SMG' ? 9 : t === 'LMG' ? 13 : t === 'SG' ? 12 : 11;
      g.box(0, 0, -len, 0, 1, 4, dark); g.box(0, -2, -2, 0, -1, -1, poly);
      g.box(0, -1, 2, 0, 0, 5, poly);
      if (t === 'LMG') g.box(-1, -3, -4, 1, -1, -1, 0x3a3c32); else if (t !== 'SG') g.box(0, -3, -5, 0, -1, -4, dark);
      if (t === 'DMR') g.box(0, 2, -6, 0, 3, -1, 0x15171a); else g.box(0, 2, -3, 0, 2, -2, 0x15171a);
      if (t === 'SG') g.box(0, -1, -len + 1, 0, -1, -4, 0x5a3a22);
      return mesh(g, S);
    });
  }

  const opCache = new Map();
  function opGeos(op) {
    if (opCache.has(op.id)) return opCache.get(op.id);
    const L = op.look, bulk = op.armor;
    const geos = { head: mesh(buildHead(L), S), torso: mesh(buildTorso(L, bulk), S), arm: mesh(buildArm(L), S), thigh: mesh(buildThigh(L), S), shin: mesh(buildShin(L), S) };
    opCache.set(op.id, geos);
    return geos;
  }
  /* an operator rig: { root, pose, hips, torso, head, aim, armL, armR, gun, thighL.. } */
  function operator(op, weaponId) {
    const G = opGeos(op), m = mat();
    const root = new THREE.Group(), pose = new THREE.Group(), hips = new THREE.Group();
    root.add(pose); pose.add(hips); hips.position.y = 13 * S;
    const mk = (geo, parent, x, y, z) => { const p = new THREE.Group(); const me = part(geo, m); p.add(me); p.position.set(x * S, y * S, z * S); parent.add(p); return p; };
    const thighL = mk(G.thigh, hips, -2, 0, 0), thighR = mk(G.thigh, hips, 2, 0, 0);
    const shinL = mk(G.shin, thighL, 0, -6.5, 0), shinR = mk(G.shin, thighR, 0, -6.5, 0);
    const torso = mk(G.torso, hips, 0, 0.5, 0);
    const head = mk(G.head, torso, 0, 11, 0);
    const aim = new THREE.Group(); aim.position.set(0, 9 * S, -1 * S); torso.add(aim);
    const armR = mk(G.arm, aim, 4.5, 0, 0), armL = mk(G.arm, aim, -4.5, 0, 0);
    // arms hang along -Y; a positive X rotation swings them forward (-Z) to hold the gun
    armR.rotation.x = 1.45; armL.rotation.x = 1.35; armL.rotation.z = 0.5; armR.rotation.z = -0.08;
    const gun = new THREE.Group(); gun.position.set(2.5 * S, -1 * S, -7 * S); aim.add(gun);
    const gm = part(gunGeo3P(weaponId || 'vkr5'), m); gun.add(gm);
    const rig = { root, pose, hips, torso, head, aim, armL, armR, gun, gunMesh: gm, thighL, thighR, shinL, shinR, mat: m, shield: null };
    root.traverse(o => { o.matrixAutoUpdate = true; });
    return rig;
  }
  function setRigGun(rig, wid) {
    rig.gun.remove(rig.gunMesh);
    rig.gunMesh = part(gunGeo3P(wid), rig.mat); rig.gun.add(rig.gunMesh);
    const pistol = /PISTOL|MP/.test((DATA.WEAPONS[wid] || {}).type);
    rig.gun.position.set((pistol ? 0.5 : 2.5) * S, -1 * S, (pistol ? -9 : -7) * S);
  }
  function addShield(rig) {
    const g = part(gunGeo3P('shield'), rig.mat);
    const p = new THREE.Group(); p.add(g); p.position.set(-3 * S, -2 * S, -9 * S);
    rig.aim.add(p); rig.shield = p; return p;
  }

  /* hostage: a civilian */
  const HOSTAGE_OP = { id: '_hostage', armor: 1, look: { head: 'bandana', helmet: 0xe8e0d0, vest: 0x8a8f9a, cloth: 0x5a6a8a, accent: 0xffffff, skin: 0xe0b898, hair: 0x5a3a20 } };

  /* ================================================== first-person guns (1/48) */
  const VS1 = 1 / 48;
  function viewGun(wid, op) {
    const W = DATA.WEAPONS[wid], t = W.type, g = new Grid();
    const dark = 0x1e2024, poly = 0x2e3136, mid = 0x44474d, acc = op ? op.look.accent : 0x888888, glove = 0x2a2622, sleeve = op ? op.look.cloth : 0x444444;
    let sightY = 4, muzzleZ = -40, sight = W.sight;
    if (t === 'SHIELD') {
      g.box(-14, -30, -4, 14, 26, -4, 0x2a333c); g.box(-13, -29, -3, 13, 25, -3, 0x3a4450); g.box(-6, 10, -4, 6, 14, -4, 0x0b0d10); g.box(-5, 11, -4, 5, 13, -4, glow(0x7ab8d8));
      g.box(-2, -6, -2, 2, -2, 6, glove);
      return { geo: mesh(g, VS1, 0.03), sightY: 0, muzzleZ: 0, len: 0, shield: true };
    }
    if (t === 'PISTOL' || t === 'MP') {
      const big = wid === 'maul';
      g.box(-2, 0, -18, 2, 4, 4, dark); g.box(-2, -10, 0, 2, -1, 5, poly); g.box(-1, -1, -2, 1, -1, 0, mid);
      if (big) { g.box(-3, -1, -10, 3, 3, -4, mid); g.box(-1, 1, -26, 1, 3, -18, dark); }
      if (t === 'MP') g.box(-2, -16, 1, 2, -11, 4, poly);
      g.set(0, 5, -16, dark); g.set(-1, 5, 3, dark); g.set(1, 5, 3, dark);
      if (sight === 'red') { g.box(-3, 5, -2, 3, 10, 1, dark); g.cut(-2, 6, -2, 2, 9, 1); sightY = 7.5; }
      else sightY = 5;
      muzzleZ = big ? -26 : -18;
      g.box(-2, -12, 1, 2, -3, 5, glove); g.box(-3, -16, 1, 3, -10, 6, glove);
      return { geo: mesh(g, VS1, 0.04), sightY: sightY * VS1, muzzleZ: muzzleZ * VS1, sight, iron: true };
    }
    const L = t === 'DMR' ? 64 : t === 'SMG' ? 36 : t === 'LMG' ? 56 : t === 'SG' ? 54 : 48;
    // receiver
    g.box(-3, -2, -18, 3, 4, 10, dark);
    g.box(-3, -4, -L + 16, 3, 2, -18, poly);           // handguard
    g.box(-1, -1, -L, 1, 1, -L + 16, dark);            // barrel
    g.box(-2, -2, -L - 2, 2, 2, -L, mid);              // muzzle
    g.box(-2, -2, 10, 2, 3, 26, poly);                 // stock
    g.box(-2, -8, 2, 2, -3, 6, poly);                  // grip
    if (t === 'SG') { g.box(-2, -6, -L + 2, 2, -4, -10, 0x5a3a22); g.box(-2, -2, 10, 2, 3, 26, 0x5a3a22); }
    else if (t === 'LMG') { g.box(-5, -14, -12, 4, -3, -2, 0x3a3c32); g.box(-1, -8, -L + 4, -1, -4, -L + 6, mid); }
    else g.box(-2, -14, -14, 2, -3, -8, poly);         // magazine
    // rail & sight
    g.box(-1, 5, -16, 1, 5, 8, mid);
    if (sight === 'acog') { g.box(-3, 6, -14, 3, 11, 2, 0x18191c); g.box(-2, 7, -15, 2, 10, -15, glow(0x5a7a90)); sightY = 8.5; }
    else if (sight === 'holo') { g.box(-4, 6, -6, 4, 14, 0, dark); g.cut(-3, 7, -6, 3, 13, 0); g.box(-3, 6, -6, 3, 6, 0, mid); sightY = 10; }
    else if (sight === 'red') { g.box(-3, 6, -5, 3, 12, 0, dark); g.cut(-2, 7, -5, 2, 11, 0); g.box(-2, 6, -5, 2, 6, -4, mid); sightY = 9; }
    else { g.box(-1, 6, -L + 18, 1, 8, -L + 18, dark); g.set(0, 9, -L + 18, dark); g.box(-2, 6, 6, 2, 8, 6, dark); g.cut(0, 7, 6, 0, 8, 6); sightY = 8.5; }
    g.set(3, 0, -10, glow(acc));
    // hands
    g.box(-3, -10, 1, 3, -4, 6, glove);                // trigger hand
    g.box(-4, -7, -L + 22, 4, -3, -L + 28, glove);     // support hand
    muzzleZ = -L - 2;
    return { geo: mesh(g, VS1, 0.04), sightY: sightY * VS1, muzzleZ: muzzleZ * VS1, sight };
  }
  function viewArms(op) {
    const g = new Grid(), sl = op.look.cloth, glove = 0x2a2622;
    g.box(-3, -3, 0, 3, 3, 40, sl); g.box(-3, -3, 0, 3, 3, 3, shade(sl, 0.8));
    return mesh(g, VS1, 0.04);
  }

  /* ================================================== gadgets & devices (1/32) */
  const S2 = 1 / 32;
  const GADGET_BUILD = {
    frag: g => { g.box(-2, -2, -2, 2, 2, 2, 0x4a5a3a); g.box(-1, 3, -1, 1, 3, 1, 0x888888); },
    smoke: g => { g.box(-2, -3, -2, 2, 3, 2, 0x8a8f94); g.box(-2, 1, -2, 2, 1, 2, 0xd0d0d0); },
    stun: g => { g.box(-2, -3, -2, 2, 3, 2, 0x2a2a2a); g.box(-2, -1, -2, 2, 0, 2, glow(0xffffff)); },
    breach: g => { g.box(-8, -12, 0, 8, 12, 1, 0x3a3a34); g.box(-6, -10, -1, 6, 10, -1, 0xcfa060); g.set(0, 8, -2, glow(0xff3030)); },
    claymore: g => { g.box(-4, 0, -1, 4, 4, 1, 0x4a5a3a); g.box(-3, -2, 0, -3, -1, 0, 0x222222); g.box(3, -2, 0, 3, -1, 0, 0x222222); g.set(0, 3, -2, glow(0xff3030)); },
    wire: g => { for (let i = -16; i <= 16; i += 2) { g.box(i, 0, -6, i, 3, -6, 0x9aa0a6); g.box(i, 0, 6, i, 3, 6, 0x9aa0a6); g.box(i, 2 + (i & 2 ? 1 : 0), -6, i + 1, 2 + (i & 2 ? 1 : 0), 6, 0x7a8086); } },
    dshield: g => { g.box(-16, 0, 0, 16, 26, 1, 0x3a4450); g.box(-14, 22, 0, 14, 24, -1, 0x2a333c); g.box(-18, 0, -4, -16, 2, 4, 0x222222); g.box(16, 0, -4, 18, 2, 4, 0x222222); },
    c4: g => { g.box(-3, -2, -1, 3, 2, 1, 0x7a6a4a); g.set(0, 0, -2, glow(0xff3030)); },
    impact: g => { g.box(-2, -2, -2, 2, 2, 2, 0x5a3a3a); g.box(-2, 0, -2, 2, 0, 2, glow(0xffaa30)); },
    bore: g => { g.box(-8, -10, 0, 8, 10, 2, 0x5a4a3a); g.box(-6, -8, -1, 6, 8, -1, 0x3a3a3a); for (let i = -6; i <= 6; i += 4) g.set(i, 0, -2, glow(0xff8a30)); },
    rivet: g => { g.box(-2, -2, -2, 2, 2, 2, 0x2fb3a6); g.set(0, 0, -3, glow(0xffffff)); },
    photon: g => { g.box(-3, -3, -1, 3, 3, 1, 0x2a2a2a); g.box(-2, -2, -2, 2, 2, -2, glow(0xfff27a)); },
    spike: g => { g.box(-2, -2, 0, 2, 2, 6, 0x5a4a3a); g.box(-1, -1, -4, 1, 1, -1, 0x9aa0a6); g.set(0, 3, 2, glow(0xff8a30)); },
    beacon: g => { g.box(-3, 0, -3, 3, 2, 3, 0x3a3f45); g.box(-1, 3, -1, 1, 10, 1, 0x9aa0a6); g.box(-2, 11, -2, 2, 12, 2, glow(0x7ce0a0)); },
    dampener: g => { g.box(-4, -4, 0, 4, 4, 3, 0x26404a); g.box(-2, -2, -1, 2, 2, -1, glow(0x5ad8ff)); },
    snare: g => { g.box(-2, -2, 0, 2, 2, 2, 0x2a2a2a); g.set(0, 0, -1, glow(0xff3050)); },
    scrambler: g => { g.box(-4, 0, -3, 4, 3, 3, 0x24212e); g.box(-1, 4, -1, 1, 8, 1, 0x555555); g.box(-3, 1, -4, 3, 1, -4, glow(0xb07cff)); },
    sensor: g => { g.box(-2, -2, 0, 2, 2, 1, 0x332c40); g.set(0, 0, -1, glow(0xb07cff)); },
    medstation: g => { g.box(-8, 0, -5, 8, 9, 5, 0xe8e8e2); g.box(-1, 3, -6, 1, 7, -6, glow(0xff3030)); g.box(-3, 4, -6, 3, 6, -6, glow(0xff3030)); },
    incendiary: g => { g.box(-3, -3, -3, 3, 3, 3, 0x8a4b2a); g.box(-1, 4, -1, 1, 5, 1, 0x3a2a1a); },
    decoy: g => { g.box(-3, 0, -3, 3, 5, 3, 0x40382c); g.box(-2, 2, -4, 2, 4, -4, 0x111111); g.set(0, 6, 0, glow(0xb0523f)); },
    seeker: g => { g.box(-5, 0, -5, 5, 6, 5, 0x2c3a3e); for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.box(x, 7, z, x, 8, z, glow(0x2fb3a6)); },
    rcharge: g => { g.box(-4, -3, 0, 4, 3, 2, 0x4a2c22); g.set(0, 0, -1, glow(0xff7a2a)); },
    cam: g => { g.box(-3, 0, -3, 3, 2, 3, 0x2a2c30); g.box(-2, -3, -2, 2, -1, 2, 0x111111); g.set(0, -2, -3, glow(0xff3030)); },
    bpcam: g => { g.box(-4, -4, 0, 4, 4, 3, 0x3a4048); g.box(-2, -2, -2, 2, 2, -1, 0x111111); g.set(0, 0, -3, glow(0x9ad8ff)); },
    defuser: g => { g.box(-6, 0, -4, 6, 5, 4, 0x2a2c30); g.box(-4, 6, -2, 4, 6, 2, glow(0xff3030)); g.box(-1, 7, -1, 1, 12, 1, 0x666666); },
    biohazard: g => { g.box(-8, 0, -6, 8, 12, 6, 0xd8b52a); g.box(-6, 13, -4, 6, 14, 4, 0x333333); g.box(-2, 4, -7, 2, 8, -7, glow(0xff5a30)); },
    smokegl: g => { g.box(-2, -2, -2, 2, 2, 2, 0x8a8f94); },
    spentshell: g => { g.box(0, 0, 0, 0, 0, 1, 0xd8b050); },
  };
  function gadget(id) {
    const geo = cached('gd:' + id, () => { const g = new Grid(); (GADGET_BUILD[id] || GADGET_BUILD.c4)(g); return mesh(g, S2); });
    return new THREE.Mesh(geo, mat());
  }
  function drone(accent) {
    const key = 'drone:' + (accent || 0);
    const geo = cached(key, () => {
      const g = new Grid();
      g.box(-3, 0, -3, 3, 3, 3, 0x2a2c30); g.box(-2, 1, -4, 2, 2, -4, 0x111111); g.set(0, 2, -5, glow(accent || 0x5ad8ff));
      for (const s of [-1, 1]) { g.box(s * 4, -1, -3, s * 6, 4, 3, 0x1a1a1a); g.box(s * 4, 1, -1, s * 6, 2, 1, 0x555555); }
      g.box(0, 4, 2, 0, 7, 2, 0x666666);
      return mesh(g, S2);
    });
    return new THREE.Mesh(geo, mat());
  }

  /* a voxel cube instance geometry for debris */
  function cubeGeo() { return cached('cube', () => { const g = new Grid(); g.set(0, 0, 0, 0xffffff); return mesh(g, 1, 0); }); }

  window.MD = { Grid, mesh, glow, operator, setRigGun, addShield, viewGun, viewArms, gadget, drone, cubeGeo, HOSTAGE_OP, S };
})();
