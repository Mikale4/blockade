/* fx.js -- debris cubes, sparks, tracers, flashes, smoke clouds, flames. */
(function () {
  'use strict';
  const { MAT } = DATA;
  const FX = { smokes: [], fires: [] };
  const MAXP = 900;
  let inst, pData, pCount = 0, scene, tracers = [], flashes = [], smokeTex, flashTex, sprites = [];
  const dummy = new THREE.Object3D(), col = new THREE.Color();

  function radialTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  }

  FX.init = function (sc) {
    scene = sc;
    const m = new THREE.MeshBasicMaterial({ vertexColors: true });
    inst = new THREE.InstancedMesh(MD.cubeGeo(), m, MAXP);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.count = 0; inst.frustumCulled = false;
    for (let i = 0; i < MAXP; i++) inst.setColorAt(i, col.setRGB(1, 1, 1));
    scene.add(inst);
    pData = [];
    for (let i = 0; i < MAXP; i++) pData.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, life: 0, max: 1, g: 1, r: 1, gg: 1, b: 1, rot: 0, glow: false, bounce: true });
    smokeTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    flashTex = radialTex('rgba(255,240,200,1)', 'rgba(255,160,60,0)');
    // tracer pool
    for (let i = 0; i < 48; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
      l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 });
    }
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); flashes.push({ s, t: 0, max: 0.05 });
    }
  };

  function spawn(x, y, z, vx, vy, vz, s, life, r, g, b, grav, bounce) {
    if (pCount >= MAXP) return;
    const p = pData[pCount++];
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s = s; p.life = life; p.max = life;
    p.r = r; p.gg = g; p.b = b; p.g = grav; p.rot = Math.random() * 6; p.bounce = bounce !== false;
  }
  FX.burst = function (pos, color, n, speed, size, life, grav) {
    col.setHex(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 0.3, sp = speed * (0.4 + Math.random() * 0.8);
      const k = 0.85 + Math.random() * 0.3;
      spawn(pos.x, pos.y, pos.z, Math.cos(a) * sp, e * sp, Math.sin(a) * sp, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), col.r * k, col.g * k, col.b * k, grav == null ? 1 : grav);
    }
  };
  FX.debris = function (x, y, z, m) {
    const md = MAT[m]; if (!md) return;
    const c = md.c, r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
    const n = md.see ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const k = 0.8 + Math.random() * 0.3;
      spawn((x + Math.random()) * 0.25, (y + Math.random()) * 0.25, (z + Math.random()) * 0.25, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, md.see ? 0.04 : 0.07 + Math.random() * 0.06, 1.5 + Math.random() * 1.5, r * k, g * k, b * k, 1);
    }
  };
  FX.sparks = function (p, nx, ny, nz, color) {
    col.setHex(color || 0xffd080);
    for (let i = 0; i < 5; i++) spawn(p.x + nx * 0.02, p.y + ny * 0.02, p.z + nz * 0.02, nx * 2 + (Math.random() - 0.5) * 3, ny * 2 + Math.random() * 2, nz * 2 + (Math.random() - 0.5) * 3, 0.025, 0.25, col.r, col.g, col.b, 0.6, false);
  };
  FX.dust = function (p, nx, ny, nz, m) {
    const md = MAT[m] || MAT[1], c = md.c;
    col.setHex(c);
    for (let i = 0; i < 3; i++) spawn(p.x + nx * 0.03, p.y + ny * 0.03, p.z + nz * 0.03, nx * 1.5 + (Math.random() - 0.5) * 1.5, ny * 1.5 + Math.random() * 1.2, nz * 1.5 + (Math.random() - 0.5) * 1.5, 0.035, 0.5, col.r, col.g, col.b, 0.8);
  };
  FX.blood = function (p, dir) {
    if (window.KC) KC.fx('blood', p, dir);
    for (let i = 0; i < 6; i++) spawn(p.x, p.y, p.z, dir.x * 2 + (Math.random() - 0.5) * 2, dir.y * 2 + Math.random(), dir.z * 2 + (Math.random() - 0.5) * 2, 0.04, 0.5, 0.55, 0.06, 0.06, 1);
  };
  FX.flames = function (p, r, n) {
    for (let i = 0; i < (n || 2); i++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r, hot = Math.random();
      spawn(p.x + Math.cos(a) * d, p.y + 0.05, p.z + Math.sin(a) * d, 0, 1 + Math.random() * 1.5, 0, 0.08 + Math.random() * 0.08, 0.5 + Math.random() * 0.4, 1, 0.4 + hot * 0.5, 0.1, -0.3, false);
    }
  };
  FX.tracer = function (a, b, color) {
    const t = tracers.find(t => t.t <= 0) || tracers[0];
    const arr = t.l.geometry.attributes.position.array;
    // start a little ahead of the muzzle so it does not blind the shooter
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1, k = Math.min(0.6, L * 0.5) / L;
    arr[0] = a.x + dx * k; arr[1] = a.y + dy * k; arr[2] = a.z + dz * k; arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    t.l.geometry.attributes.position.needsUpdate = true;
    t.l.material.color.setHex(color || 0xffe0a0);
    t.l.visible = true; t.t = 0.06;
  };
  FX.flash = function (p, size, dur) {
    const f = flashes.find(f => f.t <= 0) || flashes[0];
    f.s.position.copy(p); f.s.scale.setScalar(size); f.s.visible = true; f.t = dur || 0.05; f.max = f.t;
  };
  FX.explosion = function (p, r) {
    if (window.KC) KC.fx('explosion', p, r);
    FX.flash(p, r * 2.4, 0.18);
    FX.burst(p, 0xffa040, 26, 7, 0.1, 0.5, 0.2);
    FX.burst(p, 0x4a4540, 20, 4, 0.14, 1.4, 0.4);
    FX.puff(p, r * 0.8, 1.6, 0x666058);
  };
  /* short-lived dust puff (not vision blocking) */
  FX.puff = function (p, r, dur, color) {
    const mat = new THREE.SpriteMaterial({ map: smokeTex, color: color || 0x9a9488, transparent: true, opacity: 0.7, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(p.x + (Math.random() - 0.5) * r, p.y + Math.random() * r * 0.6, p.z + (Math.random() - 0.5) * r);
      s.scale.setScalar(r * 1.2);
      scene.add(s); sprites.push({ s, t: dur * (0.7 + Math.random() * 0.5), max: dur, grow: 1.2 });
    }
  };
  /* vision-blocking smoke */
  FX.smoke = function (p, r, dur, color) {
    const cloud = { pos: p.clone(), r: 0.5, R: r, t: 0, dur, sprites: [] };
    const mat = new THREE.SpriteMaterial({ map: smokeTex, color: color || 0xc8ccd0, transparent: true, opacity: 0.0, depthWrite: false });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(mat.clone());
      const a = Math.random() * 6.28, d = Math.random(), h = Math.random();
      s.userData = { a, d, h, sz: 1.6 + Math.random() * 1.4 };
      scene.add(s); cloud.sprites.push(s);
    }
    FX.smokes.push(cloud);
    return cloud;
  };
  /* does smoke block the segment a-b? */
  FX.smokeBlocks = function (a, b) {
    for (const c of FX.smokes) {
      if (c.r < 1.2) continue;
      const r = c.r * 0.85;
      // segment-sphere test
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz || 1;
      let t = ((c.pos.x - a.x) * dx + (c.pos.y + 0.6 - a.y) * dy + (c.pos.z - a.z) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t - c.pos.x, py = a.y + dy * t - c.pos.y - 0.6, pz = a.z + dz * t - c.pos.z;
      if (px * px + py * py * 2 + pz * pz < r * r) return true;
    }
    return false;
  };
  /* thin out every cloud reaching within r of p: it fades away over the next 2 s (Drench's rain, an extinguisher) */
  FX.clearSmoke = function (p, r) {
    for (const c of FX.smokes) if (U.dist3(p, c.pos) < r + c.R * 0.6 && c.dur > c.t + 2) c.dur = c.t + 2;
  };
  FX.inSmoke = function (p) { for (const c of FX.smokes) if (c.r > 1 && U.dist3(p, c.pos) < c.r * 0.8) return true; return false; };

  FX.update = function (dt) {
    const w = G.world;
    let j = 0;
    for (let i = 0; i < pCount; i++) {
      const p = pData[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= 18 * p.g * dt;
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (p.bounce && w && w.get(Math.floor(nx * 4), Math.floor(ny * 4), Math.floor(nz * 4))) {
        if (!w.get(Math.floor(p.x * 4), Math.floor(ny * 4), Math.floor(p.z * 4))) { p.vx *= 0.5; p.vz *= 0.5; nx = p.x; nz = p.z; }
        else { p.vy = -p.vy * 0.25; p.vx *= 0.5; p.vz *= 0.5; ny = p.y; nx = p.x; nz = p.z; }
      }
      p.x = nx; p.y = ny; p.z = nz; p.rot += dt * 4;
      if (i !== j) { const q = pData[j]; pData[j] = p; pData[i] = q; }
      const s = p.s * Math.min(1, p.life / Math.min(0.4, p.max));
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rot, p.rot * 0.7, 0); dummy.scale.setScalar(s);
      dummy.updateMatrix(); inst.setMatrixAt(j, dummy.matrix);
      inst.setColorAt(j, col.setRGB(p.r, p.gg, p.b));
      j++;
    }
    pCount = j; inst.count = j;
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    for (const t of tracers) if (t.t > 0) { t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.06) * 0.85; if (t.t <= 0) t.l.visible = false; }
    for (const f of flashes) if (f.t > 0) { f.t -= dt; f.s.material.opacity = Math.max(0, f.t / f.max); if (f.t <= 0) f.s.visible = false; }
    for (let i = sprites.length - 1; i >= 0; i--) {
      const s = sprites[i]; s.t -= dt;
      s.s.material.opacity = Math.max(0, s.t / s.max) * 0.6; s.s.scale.multiplyScalar(1 + dt * 0.4); s.s.position.y += dt * 0.3;
      if (s.t <= 0) { scene.remove(s.s); s.s.material.dispose(); sprites.splice(i, 1); }
    }
    for (let i = FX.smokes.length - 1; i >= 0; i--) {
      const c = FX.smokes[i]; c.t += dt;
      c.r = Math.min(c.R, 0.5 + c.t * c.R * 0.9);
      const fade = c.t > c.dur - 2 ? Math.max(0, (c.dur - c.t) / 2) : Math.min(1, c.t * 2);
      for (const s of c.sprites) {
        const u = s.userData;
        s.position.set(c.pos.x + Math.cos(u.a + c.t * 0.05) * u.d * c.r * 0.75, c.pos.y + 0.3 + u.h * c.r * 0.7, c.pos.z + Math.sin(u.a + c.t * 0.05) * u.d * c.r * 0.75);
        s.scale.setScalar(u.sz * (0.5 + c.r / c.R * 0.8));
        s.material.opacity = 0.85 * fade;
      }
      if (c.t >= c.dur) { for (const s of c.sprites) { scene.remove(s); s.material.dispose(); } FX.smokes.splice(i, 1); }
    }
  };
  FX.clear = function () {
    pCount = 0; if (inst) inst.count = 0;
    for (const t of tracers) { t.t = 0; t.l.visible = false; }
    for (const f of flashes) { f.t = 0; f.s.visible = false; }
    for (const s of sprites) { scene.remove(s.s); s.s.material.dispose(); } sprites = [];
    for (const c of FX.smokes) for (const s of c.sprites) { scene.remove(s); s.material.dispose(); }
    FX.smokes = []; FX.fires = [];
  };

  window.FX = FX;
})();
