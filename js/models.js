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
      // ---- seasons 10-14: twenty new silhouettes
      case 'welder': g.box(-3, 4, -2, 3, 5, 3, hc); g.box(-3, 5, -4, 3, 9, -3, shade(hc, 0.75)); g.box(-2, 7, -5, 2, 8, -5, 0x1a1c1e); g.set(-3, 3, -3, acc).set(3, 3, -3, acc); break;
      case 'respirator': g.box(-3, 4, -2, 3, 5, 2, hc); g.box(-2, 0, -3, 2, 1, -3, 0x24272b); g.box(-3, 0, -4, -2, 1, -4, acc); g.box(2, 0, -4, 3, 1, -4, acc); g.box(-2, 2, -3, 2, 2, -3, glow(acc)); break;
      case 'heavy': g.box(-3, 3, -3, 3, 6, 3, hc); g.box(-3, 0, -2, -3, 3, 3, hc); g.box(3, 0, -2, 3, 3, 3, hc); g.box(-2, 0, -4, 2, 0, -4, shade(hc, 0.6)); g.box(-2, 2, -4, 2, 2, -4, shade(hc, 0.6)); g.set(-2, 1, -4, shade(hc, 0.6)).set(2, 1, -4, shade(hc, 0.6)); break;
      case 'hardresp': g.box(-3, 4, -3, 3, 6, 3, hc); g.box(-4, 4, -4, 4, 4, 4, hc); g.box(-2, 0, -3, 2, 1, -3, 0x2a2c30); g.set(0, 0, -4, acc); g.set(-2, 1, -4, 0x2a2c30).set(2, 1, -4, 0x2a2c30); break;
      case 'souwester': g.box(-3, 4, -3, 3, 6, 3, hc); g.box(-3, 4, -4, 3, 4, -4, hc); g.box(-4, 3, 1, 4, 3, 5, hc); g.box(-1, 7, -1, 1, 7, 1, shade(hc, 0.85)); break;
      case 'hardhat': g.box(-3, 4, -3, 3, 6, 3, hc); g.box(-4, 4, -4, 4, 4, 4, hc); g.box(0, 7, -2, 0, 7, 2, shade(hc, 0.85)); g.box(-1, 5, -4, 1, 5, -4, glow(0xfff2b0)); break;
      case 'climb': g.box(-3, 3, -3, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.set(-1, 6, 0, 0x111111).set(1, 6, 0, 0x111111); g.box(-1, 4, -4, 1, 4, -4, glow(0xfff6c8)); g.box(-3, 0, -1, -3, 2, -1, 0x2a2a2a); g.box(3, 0, -1, 3, 2, -1, 0x2a2a2a); break;
      case 'mohawk': g.box(-2, 3, -2, 2, 4, 2, skin); g.box(0, 4, -3, 0, 7, 3, hair); g.box(-1, 4, -2, 1, 5, 2, hair); g.set(-3, 2, 0, glow(acc)); g.set(3, 2, 0, 0x222222); break;
      case 'lampcap': g.box(-2, 4, -2, 2, 5, 2, hc); g.box(-2, 4, -4, 2, 4, -3, hc); g.box(-3, 4, -1, 3, 4, 1, 0x2a2a2a); g.box(-1, 5, -3, 1, 6, -3, glow(0xfff2a0)); break;
      case 'headset': g.box(-3, 1, -1, -3, 3, 1, 0x222428); g.box(3, 1, -1, 3, 3, 1, 0x222428); g.box(-3, 4, 0, 3, 5, 0, 0x222428); g.box(-3, 0, -2, -3, 0, -3, 0x222428); g.box(-2, 0, -3, -1, 0, -3, glow(acc)); break;
      case 'hoodvisor': g.box(-3, 0, -2, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-2, 0, -2, 2, 3, -2, skin); g.box(-2, 2, -3, 2, 2, -3, glow(acc)); g.box(-2, 3, -3, 2, 3, -3, hc); break;
      case 'scarf': g.box(-3, 0, -1, 3, 5, 3, hc); g.box(-2, 5, -2, 2, 5, 2, hc); g.box(-3, 3, -2, 3, 5, -2, hc); g.box(-2, -1, -2, 2, 0, 3, hc); g.set(3, 4, -2, acc); break;
      case 'radioman': g.box(-2, 4, -2, 2, 6, 2, hc); g.box(-3, 3, -2, 3, 3, 2, hc); g.box(-3, 1, -1, -3, 3, 1, acc); g.box(3, 1, -1, 3, 3, 1, acc); g.box(3, 0, -2, 3, 0, -3, 0x222222); break;
      case 'earmuffs': g.box(-2, 4, -2, 2, 4, 2, hair); g.box(-3, 1, -1, -3, 3, 1, hc); g.box(3, 1, -1, 3, 3, 1, hc); g.box(-3, 4, 0, 3, 5, 0, shade(hc, 0.7)); g.set(-3, 2, -2, glow(acc)); break;
      case 'wrap': g.box(-3, 0, -3, 3, 1, 3, hc); g.box(-3, 3, -2, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-3, 1, 1, 3, 2, 3, hc); g.box(1, -1, 3, 2, 1, 4, shade(hc, 0.8)); break;
      case 'riot': g.box(-3, 3, -3, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-3, 1, -1, -3, 3, 3, hc); g.box(3, 1, -1, 3, 3, 3, hc); g.box(-3, 5, -4, 3, 6, -4, 0x6a8aa0); break;
      case 'pilot': g.box(-3, 2, -3, 3, 5, 3, hc); g.box(-2, 6, -2, 2, 6, 2, hc); g.box(-3, 0, -1, -3, 2, 3, hc); g.box(3, 0, -1, 3, 2, 3, hc); g.box(-2, 1, -4, 2, 3, -4, 0x1a2a3a); g.box(-3, 0, -2, -2, 0, -4, 0x222222); g.set(0, 5, -4, glow(acc)); break;
      case 'goggles': g.box(-2, 4, -2, 2, 5, 2, hc); g.box(-2, 4, -4, 2, 4, -3, hc); g.box(-3, 3, -3, 3, 3, -3, 0x2a2a2a); g.box(-2, 3, -4, -1, 3, -4, glow(acc)); g.box(1, 3, -4, 2, 3, -4, glow(acc)); break;
      case 'miner': g.box(-3, 4, -3, 3, 6, 3, hc); g.box(-4, 4, -4, 4, 4, 4, shade(hc, 0.85)); g.box(-1, 5, -5, 1, 6, -4, 0x2a2a2a); g.box(-1, 5, -6, 1, 6, -6, glow(0xfff6c8)); g.box(-3, 0, -1, -3, 3, -1, 0x2a2a2a); g.box(3, 0, -1, 3, 3, -1, 0x2a2a2a); break;
      case 'cowl': g.box(-3, 0, -1, 3, 6, 3, hc); g.box(-2, 7, 0, 2, 7, 3, hc); g.box(-1, 8, 1, 1, 8, 3, hc); g.box(-3, 3, -2, 3, 6, -2, hc); g.box(-2, 0, -2, 2, 2, -2, shade(skin, 0.55)); g.set(-1, 2, -3, glow(acc)).set(1, 2, -3, glow(acc)); break;
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
    if (bulk > 2 || L.pads) { g.box(-w - 1, 7, -3, -w - 1, 10, 3, vest); g.box(w, 7, -3, w, 10, 3, vest); }
    if (L.pads) { g.box(-w - 1, 10, -2, -w, 11, 2, shade(vest, 1.2)); g.box(w - 1, 10, -2, w, 11, 2, shade(vest, 1.2)); }
    if (L.pack && PACKS[L.pack]) PACKS[L.pack](g, L);
    return g;
  }
  /* seasons 10-14: what each new operator carries on the back (the torso faces -z) */
  const PACKS = {
    coil: (g, L) => { g.box(-3, 3, 4, 2, 9, 6, 0x3a3026); for (const y of [4, 6, 8]) g.box(-3, y, 7, 2, y, 7, 0xb87333); g.set(-1, 10, 5, glow(L.accent)); },
    tank: (g, L) => { g.box(-2, 2, 4, 1, 10, 7, L.helmet); g.box(-1, 11, 5, 0, 11, 6, 0x8a8f94); g.box(2, 3, 5, 2, 9, 5, 0x222222); g.box(-2, 6, 7, 1, 6, 7, shade(L.helmet, 0.7)); },
    ammo: (g, L) => { g.box(-3, 2, 4, 2, 7, 7, 0x4a4a32); g.box(-2, 7, 5, 1, 7, 6, 0x2a2a22); for (let i = -3; i <= 3; i++) g.set(i, 5 + (i >> 1), -4, 0xc8a040); },
    spool: (g, L) => { g.box(-3, 4, 4, 2, 9, 7, 0x5a5a5a); g.box(-2, 5, 8, 1, 8, 8, L.accent); g.box(-4, 6, 5, -4, 7, 6, 0x333333); g.box(3, 6, 5, 3, 7, 6, 0x333333); },
    ladder: (g, L) => { g.box(-3, 0, 5, -3, 12, 5, 0x8a8f94); g.box(2, 0, 5, 2, 12, 5, 0x8a8f94); for (let y = 1; y <= 11; y += 2) g.box(-2, y, 5, 1, y, 5, 0x6a6e74); },
    antenna: (g, L) => { g.box(-2, 3, 4, 1, 8, 6, 0x2a2c30); g.box(1, 9, 5, 1, 16, 5, 0x333333); g.set(1, 17, 5, glow(L.accent)); g.box(-2, 6, 7, -1, 7, 7, glow(L.accent)); },
    case: (g, L) => { g.box(-3, 3, 4, 2, 9, 5, 0x2a2a30); g.box(-2, 4, 6, 1, 8, 6, 0x1a1a1e); g.box(-2, 7, 6, 1, 7, 6, glow(L.accent)); },
    radio: (g, L) => { g.box(-2, 3, 4, 1, 9, 6, 0x3a3a2c); g.box(-2, 10, 5, -2, 14, 5, 0x333333); g.box(0, 5, 7, 1, 6, 7, glow(L.accent)); },
    stake: (g, L) => { g.box(-1, 2, 4, 1, 10, 6, 0x5a4a3a); for (const x of [-1, 0, 1]) g.box(x, 11, 5, x, 13, 5, 0x9aa0a6); g.set(0, 6, 7, glow(L.accent)); },
    speaker: (g, L) => { g.box(-3, 3, 4, 2, 8, 6, 0x222222); g.box(-2, 4, 7, 1, 7, 7, 0x444444); g.set(-1, 5, 8, glow(L.accent)).set(0, 6, 8, glow(L.accent)); },
    drape: (g, L) => { g.box(-4, 8, 4, 3, 10, 7, 0x4a5a4a); g.box(-4, 9, 8, 3, 9, 8, shade(0x4a5a4a, 0.75)); g.box(-3, 2, 4, -3, 8, 4, 0x333333); g.box(2, 2, 4, 2, 8, 4, 0x333333); },
    cradle: (g, L) => { g.box(-1, 4, 4, 0, 9, 5, 0x333333); g.box(-5, 8, 5, 4, 8, 5, 0x333333); for (const x of [-5, 4]) g.box(x - 1, 9, 4, x + 1, 9, 6, glow(L.accent)); },
    rails: (g, L) => { g.box(-3, 1, 4, -3, 11, 4, 0x6a6e76); g.box(2, 1, 4, 2, 11, 4, 0x6a6e76); g.box(-2, 9, 4, 1, 11, 6, L.accent); for (let y = 2; y <= 8; y += 2) g.box(-2, y, 5, 1, y, 5, 0x50545a); },
    projector: (g, L) => { g.box(-2, 4, 4, 1, 8, 6, 0x2a2c38); g.box(-1, 6, 7, 0, 7, 7, glow(L.accent)); g.box(-3, 8, 5, -3, 12, 5, 0x333340); g.set(-3, 13, 5, glow(L.accent)); },
    roll: (g, L) => { g.box(-4, 2, 4, 3, 4, 6, 0x5a4a3a); g.box(-3, 5, 4, 2, 7, 5, 0x3a3a3a); g.set(-3, 3, 7, 0x9aa0a6).set(2, 3, 7, 0x9aa0a6); },
    sapper: (g, L) => { g.box(-3, 1, 4, 2, 6, 6, 0x4a3a2a); g.box(-2, 7, 4, 1, 8, 5, 0x3a2a1a); g.set(-1, 4, 7, glow(L.accent)).set(1, 4, 7, glow(L.accent)); },
  };
  function buildArm(L) { const g = new Grid(); g.box(-1, -9, -1, 0, 0, 0, L.cloth); g.box(-1, -9, -1, 0, -8, 0, 0x2a2622); g.box(-1, -4, -1, 0, -3, 0, shade(L.cloth, 0.8)); return g; }
  function buildThigh(L) { const g = new Grid(); g.box(-1, -6, -1, 1, 0, 1, L.cloth); return g; }
  function buildShin(L) { const g = new Grid(); g.box(-1, -7, -1, 1, 0, 1, L.cloth); g.box(-1, -1, -2, 1, 0, -2, 0x2e2f33); g.box(-1, -7, -2, 1, -5, 1, 0x26241f); g.box(-1, -7, -3, 1, -7, -2, 0x26241f); return g; }

  /* third-person gun */
  /* a weapon finish from the shop (DATA.COSMETICS.finish): the gun's metal, polymer and fittings */
  const finishOf = f => (DATA.COSMETICS.finish[f] && f !== 'factory') ? DATA.COSMETICS.finish[f] : null;
  const suitOf = s => (DATA.COSMETICS.suit[s] && s !== 'standard') ? DATA.COSMETICS.suit[s] : null;
  function gunGeo3P(wid, fin, att) {
    const F = finishOf(fin), ak = att && window.ATT ? ATT.key(att) : '';
    return cached('g3:' + wid + ':' + (F ? fin : '') + ':' + ak, () => {
      const g = new Grid(), W = DATA.WEAPONS[wid], dark = F ? F.dark : 0x222428, poly = F ? F.poly : 0x34373c;
      const t = W ? W.type : 'AR';
      if (t === 'SHIELD') {
        // 0.69 x 1.38 m plate with a dark viewport band at eye height (matches WPN.shieldRect)
        g.box(-5, -11, 0, 5, 10, 0, 0x2c3540); g.box(-5, -11, 1, 5, -11, 1, 0x15171a); g.box(-5, 10, 1, 5, 10, 1, 0x15171a);
        g.box(-3, 5, -1, 3, 7, -1, 0x15181c); g.box(-2, 6, -1, 2, 6, -1, glow(0x7ab8d8));
        return mesh(g, S, 0.03);
      }
      const A = att || {};
      if (t === 'PISTOL' || t === 'MP') {
        if (wid === 'stinger') { g.box(0, 0, -4, 0, 1, 0, 0xd8c020); g.box(0, -3, -1, 0, -1, 0, 0x2a2a2a); g.set(0, 0, -5, glow(0x9ad8ff)); return mesh(g, S); }
        g.box(0, 0, -5, 0, 1, 0, dark); g.box(0, -3, -1, 0, -1, 0, poly);
        if (A.barrel === 'sup') g.box(0, 0, -8, 0, 1, -6, 0x15171a);
        if (A.under === 'laser') g.set(0, -1, -4, glow(0xff3030));
        return mesh(g, S);
      }
      if (t === 'XBOW') {
        // a crossbow: stock and rail, limbs across the front, a bolt on the rail
        g.box(0, 0, -9, 0, 1, 4, dark); g.box(0, -2, -1, 0, -1, 0, poly); g.box(-5, 1, -9, 5, 1, -8, poly); g.box(-5, 0, -8, -5, 0, -7, poly); g.box(5, 0, -8, 5, 0, -7, poly);
        g.box(0, 2, -10, 0, 2, -2, 0xd8d0b0); if (A.optic) g.box(0, 2, -3, 0, 3, -1, 0x15171a);
        return mesh(g, S);
      }
      const len = t === 'SR' ? 17 : t === 'DMR' ? 14 : t === 'SMG' ? 9 : t === 'LMG' ? 13 : t === 'SG' ? 12 : 11;
      g.box(0, 0, -len, 0, 1, 4, dark); g.box(0, -2, -2, 0, -1, -1, poly);
      g.box(0, -1, 2, 0, 0, 5, poly);
      if (t === 'LMG') g.box(-1, -3, -4, 1, -1, -1, 0x3a3c32); else if (t !== 'SG') g.box(0, A.mag === 'xmag' ? -4 : -3, -5, 0, -1, -4, dark);
      // the sight (an attachment replaces the gun's own)
      const sight = (A.optic && window.ATT && ATT.LIST[A.optic] ? ATT.LIST[A.optic].sight : W && W.sight) || 'iron';
      if (sight === 'acog' || sight === 'var' || sight === 'scope4') g.box(0, 2, sight === 'scope4' ? -8 : -6, 0, 3, -1, 0x15171a); else if (sight !== 'iron') g.box(0, 2, -3, 0, 2, -2, 0x15171a);
      if (t === 'SG') g.box(0, -1, -len + 1, 0, -1, -4, F ? F.mid : 0x5a3a22);
      // barrel devices, grips, a laser
      if (A.barrel === 'sup') g.box(0, 0, -len - 4, 0, 1, -len - 1, 0x15171a);
      else if (A.barrel === 'ext') g.box(0, 0, -len - 3, 0, 0, -len - 1, dark);
      else if (A.barrel) g.box(0, 0, -len - 1, 0, 1, -len - 1, 0x2a2c30);
      if (A.under === 'vgrip') g.box(0, -2, -len + 3, 0, -1, -len + 3, poly);
      else if (A.under === 'agrip') g.box(0, -1, -len + 3, 0, -1, -len + 4, poly);
      else if (A.under === 'laser') g.set(0, -1, -len + 2, glow(0xff3030));
      if (F) g.set(0, 1, -len + 2, F.glowMid ? glow(F.mid) : F.mid);
      // seasons 10-14: the details that make each new gun read at a distance
      if (wid === 'spindle') { g.box(-1, -1, -len, 1, 1, -4, dark); g.box(-1, 2, -3, 1, 3, 0, 0x3a3c32); }
      else if (wid === 'volta') for (let z = -len + 2; z <= -3; z += 3) g.box(0, -1, z, 0, 2, z, glow(0x5ad8ff));
      else if (wid === 'twinfire') g.set(0, 2, 1, glow(0xffa040));
      else if (wid === 'lattice') g.box(0, -3, -6, 0, -1, -3, dark);
      else if (wid === 'bramble') g.box(0, -1, -len + 1, 0, -1, -len + 3, 0xd84a20);
      else if (wid === 'tally') g.box(0, -3, -4, 0, -2, -2, 0xff8a20);
      else if (wid === 'longbow') g.box(0, 2, -9, 0, 3, -2, 0x16171a);
      return mesh(g, S);
    });
  }

  const opCache = new Map();
  const lookOf = (op, suit) => { const U2 = suitOf(suit); return U2 ? Object.assign({}, op.look, U2.cloth ? { cloth: U2.cloth } : {}, U2.vest ? { vest: U2.vest } : {}, U2.helmet ? { helmet: U2.helmet } : {}, U2.accent ? { accent: U2.accent } : {}) : op.look; };
  function opGeos(op, suit) {
    const key = op.id + ':' + (suitOf(suit) ? suit : '');
    if (opCache.has(key)) return opCache.get(key);
    const L = lookOf(op, suit), bulk = op.armor;
    const geos = { head: mesh(buildHead(L), S), torso: mesh(buildTorso(L, bulk), S), arm: mesh(buildArm(L), S), thigh: mesh(buildThigh(L), S), shin: mesh(buildShin(L), S) };
    opCache.set(key, geos);
    return geos;
  }
  /* an operator rig: { root, pose, hips, torso, head, aim, armL, armR, gun, thighL.. } */
  function operator(op, weaponId, cos, att) {
    cos = cos || {};
    const G = opGeos(op, cos.suit), m = mat();
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
    const gm = part(gunGeo3P(weaponId || 'vkr5', cos.finish, att), m); gun.add(gm);
    const rig = { root, pose, hips, torso, head, aim, armL, armR, gun, gunMesh: gm, thighL, thighR, shinL, shinR, mat: m, shield: null, fin: cos.finish || null };
    root.traverse(o => { o.matrixAutoUpdate = true; });
    return rig;
  }
  function setRigGun(rig, wid, att) {
    // the attachments on the gun the rig's operator carries (or as given)
    if (!att) { const a = rig.root.userData.actor, w = a && a.w && a.w.find(x => x.id === wid); att = w && w.def.att; }
    rig.gun.remove(rig.gunMesh);
    rig.gunMesh = part(gunGeo3P(wid, rig.fin, att), rig.mat); rig.gun.add(rig.gunMesh);
    const pistol = /PISTOL|MP/.test((DATA.WEAPONS[wid] || {}).type);
    rig.gun.position.set((pistol ? 0.5 : 2.5) * S, -1 * S, (pistol ? -9 : -7) * S);
  }
  function addShield(rig) {
    const g = part(gunGeo3P('shield'), rig.mat);
    const p = new THREE.Group(); p.add(g); p.position.set(-1 * S, -4 * S, -6 * S);
    rig.aim.add(p); rig.shield = p; return p;
  }

  /* first-person shield: an opaque frame with a viewport cut through it, and the glass that fills the
     viewport as a separate see-through pane. Model faces -Z; +Z is toward the camera. Units are 1/48 m. */
  function viewShield(op) {
    return cached('vshield:' + (op ? op.id : ''), () => {
      const g = new Grid(), plate = 0x3a4450, edge = 0x252c34, rim = 0x14171b, glove = 0x2a2622, sleeve = op ? op.look.cloth : 0x444444;
      g.box(-12, -30, 0, 12, 19, 1, plate);
      g.box(-12, -30, 0, -12, 19, 1, edge); g.box(12, -30, 0, 12, 19, 1, edge); g.box(-12, 19, 0, 12, 19, 1, edge); g.box(-12, -30, 0, 12, -30, 1, edge);
      for (const y of [-22, -10, 2]) { g.set(-9, y, -1, edge); g.set(9, y, -1, edge); }
      // viewport: a dark rim, then the hole the glass sits in
      g.box(-9, 5, -1, 9, 15, 1, rim); g.cut(-8, 6, -1, 8, 14, 1);
      // grip and forearm behind the plate
      g.box(-2, -8, 2, 2, -4, 5, glove); g.box(-2, -8, 6, 2, -4, 16, sleeve);
      const frame = mesh(g, VS1, 0.03);
      const glass = new THREE.PlaneGeometry(17 * VS1, 9 * VS1); glass.translate(0, 10 * VS1, 0.5 * VS1);
      return { frame, glass };
    });
  }

  /* hostage: a civilian */
  const HOSTAGE_OP = { id: '_hostage', armor: 1, look: { head: 'bandana', helmet: 0xe8e0d0, vest: 0x8a8f9a, cloth: 0x5a6a8a, accent: 0xffffff, skin: 0xe0b898, hair: 0x5a3a20 } };

  /* ================================================== first-person guns (1/48) */
  const VS1 = 1 / 48;
  /* (bare: no hands on it, for showing the gun on its own: the loadout screen) */
  function viewGun(wid, op, fin, att, bare) {
    const W = DATA.WEAPONS[wid], t = W.type, g = new Grid(), F = finishOf(fin), A = att || {};
    const dark = F ? F.dark : 0x1e2024, poly = F ? F.poly : 0x2e3136, mid = F ? (F.glowMid ? glow(F.mid) : F.mid) : 0x44474d, acc = op ? op.look.accent : 0x888888, glove = 0x2a2622, sleeve = op ? op.look.cloth : 0x444444;
    let sightY = 4, muzzleZ = -40, sight = (A.optic && window.ATT && ATT.LIST[A.optic] ? ATT.LIST[A.optic].sight : W.sight) || 'iron';
    if (t === 'SHIELD') {
      g.box(-14, -30, -4, 14, 26, -4, 0x2a333c); g.box(-13, -29, -3, 13, 25, -3, 0x3a4450); g.box(-6, 10, -4, 6, 14, -4, 0x0b0d10); g.box(-5, 11, -4, 5, 13, -4, glow(0x7ab8d8));
      g.box(-2, -6, -2, 2, -2, 6, glove);
      return { geo: mesh(g, VS1, 0.03), sightY: 0, muzzleZ: 0, len: 0, shield: true };
    }
    if (wid === 'stinger') {
      // a taser pistol: a stubby yellow body with two dart bays
      g.box(-3, -1, -14, 3, 5, 4, 0xd8c020); g.box(-2, -10, 0, 2, -1, 5, 0x2a2a2a); g.box(-3, 0, -15, -1, 2, -15, glow(0x9ad8ff)); g.box(1, 0, -15, 3, 2, -15, glow(0x9ad8ff));
      g.box(-1, 6, -12, 1, 6, 2, 0x2a2a2a);
      if (!bare) { g.box(-2, -12, 1, 2, -3, 5, glove); g.box(-3, -16, 1, 3, -10, 6, glove); } else g.box(-2, -12, 1, 2, -3, 5, 0x2a2a2a);
      return { geo: mesh(g, VS1, 0.04), sightY: 6.5 * VS1, muzzleZ: -15 * VS1, sight: 'iron', iron: true };
    }
    if (t === 'XBOW') {
      // a crossbow: a long rail, limbs and string across the front, a bolt laid on it
      g.box(-2, -2, -40, 2, 2, 22, dark); g.box(-2, -10, 2, 2, -3, 6, poly); g.box(-2, -1, 10, 2, 3, 24, poly);
      g.box(-22, 1, -38, 22, 3, -35, poly); g.box(-24, 0, -34, -22, 2, -30, poly); g.box(22, 0, -34, 24, 2, -30, poly);
      g.box(-22, 2, -31, 22, 2, -31, 0xd8d0b0); g.box(-1, 3, -42, 1, 4, -6, 0xc8c0a0); g.box(-2, 3, -44, 2, 5, -42, 0x9aa0a6);
      if (sight === 'red' || sight === 'holo' || sight === 'reflex') { g.box(-3, 5, -8, 3, 11, -3, dark); g.cut(-2, 6, -8, 2, 10, -3); sightY = 8; } else sightY = 5;
      if (!bare) { g.box(-3, -10, 1, 3, -4, 6, glove); g.box(-4, -5, -26, 4, -1, -20, glove); }
      return { geo: mesh(g, VS1, 0.04), sightY: sightY * VS1, muzzleZ: -44 * VS1, sight };
    }
    if (t === 'PISTOL' || t === 'MP') {
      const big = wid === 'maul';
      g.box(-2, 0, -18, 2, 4, 4, dark); g.box(-2, -10, 0, 2, -1, 5, poly); g.box(-1, -1, -2, 1, -1, 0, mid);
      if (big) { g.box(-3, -1, -10, 3, 3, -4, mid); g.box(-1, 1, -26, 1, 3, -18, dark); }
      if (t === 'MP') g.box(-2, -16, 1, 2, -11, 4, poly);
      g.set(0, 5, -16, dark); g.set(-1, 5, 3, dark); g.set(1, 5, 3, dark);
      if (sight === 'red') { g.box(-3, 5, -2, 3, 10, 1, dark); g.cut(-2, 6, -2, 2, 9, 1); sightY = 7.5; }
      else if (sight === 'reflex') { g.box(-2, 5, -3, 2, 5, 0, dark); g.box(-2, 6, -3, 2, 9, -3, dark); g.cut(-1, 6, -3, 1, 8, -3); sightY = 7; }
      else sightY = 5;
      muzzleZ = big ? -26 : -18;
      if (bare) g.box(-2, -12, 1, 2, -3, 5, poly);          // (the grip the hand would hide)
      // a suppressor on the muzzle, a laser under the frame, a longer magazine
      if (A.barrel === 'sup') { g.box(-2, 0, muzzleZ - 14, 2, 4, muzzleZ - 1, 0x141518); muzzleZ -= 14; }
      else if (A.barrel) { g.box(-3, 0, muzzleZ - 4, 3, 4, muzzleZ - 1, mid); g.cut(-1, 1, muzzleZ - 3, 1, 3, muzzleZ - 2); muzzleZ -= 4; }
      if (A.under === 'laser') { g.box(-2, -3, -14, 2, -1, -8, dark); g.set(0, -2, -15, glow(0xff3030)); }
      else if (A.under === 'vgrip') g.box(-1, -8, -12, 1, -2, -10, poly);
      if (A.mag === 'xmag') g.box(-2, -15, 1, 2, -12, 4, poly);
      if (!bare) { g.box(-2, -12, 1, 2, -3, 5, glove); g.box(-3, -16, 1, 3, -10, 6, glove); }
      return { geo: mesh(g, VS1, 0.04), sightY: sightY * VS1, muzzleZ: muzzleZ * VS1, sight, iron: true };
    }
    const L = t === 'SR' ? 74 : t === 'DMR' ? 64 : t === 'SMG' ? 36 : t === 'LMG' ? 56 : t === 'SG' ? 54 : 48;
    // receiver
    g.box(-3, -2, -18, 3, 4, 10, dark);
    g.box(-3, -4, -L + 16, 3, 2, -18, poly);           // handguard
    g.box(-1, -1, -L, 1, 1, -L + 16, dark);            // barrel
    g.box(-2, -2, -L - 2, 2, 2, -L, mid);              // muzzle
    g.box(-2, -2, 10, 2, 3, 26, poly);                 // stock
    g.box(-2, -8, 2, 2, -3, 6, poly);                  // grip
    if (t === 'SG') { const wood = F ? F.poly : 0x5a3a22; g.box(-2, -6, -L + 2, 2, -4, -10, wood); g.box(-2, -2, 10, 2, 3, 26, wood); }
    else if (t === 'LMG') { g.box(-5, -14, -12, 4, -3, -2, 0x3a3c32); g.box(-1, -8, -L + 4, -1, -4, -L + 6, mid); }
    else g.box(-2, A.mag === 'xmag' ? -19 : -14, -14, 2, -3, -8, poly);         // magazine (longer: extended)
    if (A.mag === 'fmag' && t !== 'SG' && t !== 'LMG') g.box(-2, -15, -12, 2, -15, -10, glow(0x6a8a5a));   // a quick mag's pull tab
    // rail & sight
    g.box(-1, 5, -16, 1, 5, 8, mid);
    if (sight === 'acog') { g.box(-3, 6, -14, 3, 11, 2, 0x18191c); g.box(-2, 7, -15, 2, 10, -15, glow(0x5a7a90)); sightY = 8.5; }
    else if (sight === 'var') { g.box(-3, 6, -16, 3, 11, 4, 0x1a1c20); g.box(-4, 7, -16, 4, 10, -14, 0x101114); g.box(-2, 7, -17, 2, 10, -17, glow(0x6a8aa0)); g.box(-4, 7, 0, -4, 9, 2, mid); sightY = 8.5; }
    else if (sight === 'scope4') { g.box(-3, 7, -22, 3, 12, 6, 0x16171a); g.box(-4, 7, -24, 4, 12, -22, 0x0e0f11); g.box(-2, 8, -25, 2, 11, -25, glow(0x5a7a90)); g.box(-2, 6, -8, 2, 6, -4, mid); sightY = 9.5; }
    else if (sight === 'holo') { g.box(-4, 6, -6, 4, 14, 0, dark); g.cut(-3, 7, -6, 3, 13, 0); g.box(-3, 6, -6, 3, 6, 0, mid); sightY = 10; }
    else if (sight === 'red') { g.box(-3, 6, -5, 3, 12, 0, dark); g.cut(-2, 7, -5, 2, 11, 0); g.box(-2, 6, -5, 2, 6, -4, mid); sightY = 9; }
    else if (sight === 'reflex') { g.box(-3, 6, -4, 3, 6, 0, dark); g.box(-3, 7, -4, 3, 11, -4, dark); g.cut(-2, 7, -4, 2, 10, -4); g.box(-2, 7, -3, 2, 7, -3, glow(0x7affa0)); sightY = 9; }
    else { g.box(-1, 6, -L + 18, 1, 8, -L + 18, dark); g.set(0, 9, -L + 18, dark); g.box(-2, 6, 6, 2, 8, 6, dark); g.cut(0, 7, 6, 0, 8, 6); sightY = 8.5; }
    g.set(3, 0, -10, glow(acc));
    // seasons 10-14: what sets each new gun apart in your hands
    if (wid === 'spindle') { for (const [x, y] of [[-3, -3], [3, -3], [0, 3], [-3, 2], [3, 2]]) g.box(x - 1, y - 1, -L, x + 1, y + 1, -18, dark); g.box(-5, 6, -14, 5, 8, -2, 0x3a3c32); }
    else if (wid === 'volta') { for (let z = -L + 18; z <= -20; z += 5) g.box(-4, -4, z, 4, 3, z + 1, glow(0x5ad8ff)); g.box(-3, -12, -12, 3, -3, -6, 0x26344e); }
    else if (wid === 'twinfire') { g.box(3, 1, -2, 4, 2, 2, glow(0xffa040)); g.box(-4, 1, -2, -3, 2, 2, mid); }
    else if (wid === 'lattice') { g.box(-2, -14, -16, 2, -3, -12, poly); g.box(-1, -15, -14, 1, -15, -10, mid); }
    else if (wid === 'bramble') { g.box(-3, -7, -L + 4, 3, -5, -L + 12, 0xd84a20); g.box(-1, -4, 8, 1, -3, 12, 0xd84a20); }
    else if (wid === 'tally') { g.box(-2, -12, -6, 2, -3, -2, 0xff8a20); g.box(-3, 6, 2, 3, 7, 4, 0xff8a20); }
    else if (wid === 'longbow') { g.box(3, 2, 4, 6, 3, 6, mid); g.box(5, 3, 4, 6, 5, 5, mid); }
    // underbarrel: a grip, or a laser on the handguard's side
    if (A.under === 'vgrip') g.box(-2, -12, -L + 20, 2, -5, -L + 23, poly);
    else if (A.under === 'agrip') { g.box(-2, -7, -L + 18, 2, -5, -L + 24, poly); g.box(-2, -9, -L + 23, 2, -7, -L + 25, poly); }
    else if (A.under === 'laser') { g.box(3, -3, -L + 17, 5, 0, -L + 24, dark); g.set(4, -2, -L + 16, glow(0xff3030)); }
    // hands
    if (!bare) {
      g.box(-3, -10, 1, 3, -4, 6, glove);                // trigger hand
      if (A.under === 'vgrip') g.box(-3, -13, -L + 19, 3, -9, -L + 24, glove);   // support hand on the grip
      else g.box(-4, -7, -L + 22, 4, -3, -L + 28, glove);     // support hand
    }
    muzzleZ = -L - 2;
    // barrel devices
    if (A.barrel === 'sup') { g.box(-3, -3, -L - 22, 3, 3, -L - 2, 0x141518); g.box(-3, -3, -L - 22, 3, -3, -L - 2, 0x1d1f23); muzzleZ = -L - 22; }
    else if (A.barrel === 'ext') { g.box(-1, -1, -L - 10, 1, 1, -L - 2, dark); g.box(-2, -2, -L - 12, 2, 2, -L - 10, mid); muzzleZ = -L - 12; }
    else if (A.barrel === 'comp' || A.barrel === 'brake') { g.box(-3, -3, -L - 8, 3, 3, -L - 2, mid); g.cut(-3, -1, -L - 6, 3, 1, -L - 5); if (A.barrel === 'brake') g.cut(-3, -1, -L - 4, 3, 1, -L - 3); muzzleZ = -L - 8; }
    else if (A.barrel === 'flash') { g.box(-2, -2, -L - 7, 2, 2, -L - 2, dark); g.cut(-2, 0, -L - 7, 2, 0, -L - 4); muzzleZ = -L - 7; }
    else if (A.barrel === 'choke') { g.box(-2, -2, -L - 5, 2, 2, -L - 2, 0x2a2c30); muzzleZ = -L - 5; }
    return { geo: mesh(g, VS1, 0.04), sightY: sightY * VS1, muzzleZ: muzzleZ * VS1, sight };
  }
  function viewArms(op, suit) {
    const g = new Grid(), sl = lookOf(op, suit).cloth, glove = 0x2a2622;
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
    // the second-kit gadgets: an EMP grenade, a stim injector, a proximity alarm, a fog canister
    emp: g => { g.box(-2, -3, -2, 2, 3, 2, 0x26324a); g.box(-2, 0, -2, 2, 0, 2, glow(0x5ad8ff)); g.box(-1, 4, -1, 1, 4, 1, 0x888888); g.set(2, 2, 0, glow(0x5ad8ff)); },
    stim: g => { g.box(-1, -6, -1, 1, 4, 1, 0xd8dde0); g.box(-1, -3, -1, 1, 1, 1, glow(0x7ce0a0)); g.box(-2, 5, -2, 2, 5, 2, 0x9aa0a6); g.box(0, -9, 0, 0, -7, 0, 0x9aa0a6); },
    alarm: g => { g.box(-3, 0, -3, 3, 2, 3, 0x3a3f45); g.box(-2, 3, -2, 2, 3, 2, 0x22262b); g.set(0, 4, 0, glow(0xffcc30)); g.set(-2, 1, -4, glow(0xff5030)); },
    fog: g => { g.box(-2, 0, -2, 2, 7, 2, 0x6a7078); g.box(-2, 8, -2, 2, 8, 2, 0xd0d0d0); g.box(-1, 9, -1, 1, 9, 1, 0x555555); g.set(0, 4, -3, glow(0x9ad8ff)); },
    spentshell: g => { g.box(0, 0, 0, 0, 0, 1, 0xd8b050); },
    // ---- seasons 10-14: the new kit (gadgets, and the devices the new operators set down)
    flankcam: g => { g.box(-3, -3, 0, 3, 3, 2, 0x2a2c30); g.box(-2, -2, -1, 2, 2, -1, 0x101114); g.set(0, 0, -2, glow(0x5ad8ff)); g.box(-1, 4, 1, 1, 6, 1, 0x555555); },
    extinguisher: g => { g.box(-2, 0, -2, 2, 9, 2, 0xc8302a); g.box(-1, 10, -1, 1, 11, 1, 0x2a2a2a); g.box(-1, 11, -4, 1, 11, -2, 0x2a2a2a); g.box(-2, 6, -2, 2, 6, 2, 0xd8d8d8); },
    caltrops: g => { for (let x = -20; x <= 20; x += 5) for (let z = -20; z <= 20; z += 5) { const o = ((x * 7 + z * 13) & 3) - 1; g.box(x + o, 0, z, x + o, 2, z, 0x8a8f94); g.set(x + o + 1, 0, z, 0x6a6e74); } },
    degauss: g => { g.box(-9, -11, 0, 9, 11, 3, 0x3a3026); for (const y of [-8, -3, 2, 7]) g.box(-8, y, -1, 8, y + 1, -1, 0xb87333); g.box(-2, -2, -2, 2, 2, -2, glow(0xff7a3a)); },
    slickcan: g => { g.box(-2, -3, -2, 2, 3, 2, 0x2a4a5a); g.box(-2, 0, -2, 2, 0, 2, glow(0x5ad0ff)); g.box(-1, 4, -1, 1, 4, 1, 0x888888); },
    sprinkler: g => { g.box(-1, 0, -1, 1, 3, 1, 0x8a8f94); g.box(-4, -1, -4, 4, -1, 4, 0x6a6e74); g.box(-2, -2, -2, 2, -2, 2, 0xc8302a); g.set(0, 2, -2, glow(0x5ab0ff)); },
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

  window.MD = { Grid, mesh, glow, operator, setRigGun, addShield, viewGun, viewShield, viewArms, gadget, drone, cubeGeo, HOSTAGE_OP, S };
})();
