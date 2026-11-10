/* main.js -- renderer, scenes, map loading and the frame loop. */
(function () {
  'use strict';
  const MAIN = {};
  const V = () => new THREE.Vector3();
  let sky, outer, lastT = 0, menuT = 0;

  MAIN.init = function () {
    const cv = U.$('view');
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    r.autoClear = false;
    G.renderer = r;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(G.settings.fov, 1, 0.04, 400);
    G.camera.rotation.order = 'YXZ';
    G.vmScene = new THREE.Scene();
    G.vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    // sky dome
    const sg = new THREE.SphereGeometry(300, 24, 16);
    sg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sg.attributes.position.count * 3), 3));
    sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; G.scene.add(sky);
    outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x4a5a32 }));
    outer.rotation.x = -Math.PI / 2; G.scene.add(outer);
    FX.init(G.scene);
    HUD.init(); PLAYER.init();
    window.addEventListener('resize', MAIN.resize); MAIN.resize();
    U.$('boot').remove();
    Auth.resume();
    MENU.title();
    // browsers only allow audio after a gesture: unlock on the first click/key
    const unlock = () => { SFX.init(); MUSIC.unlock(); if (G.mode === 'menu' && !MUSIC.cur) MUSIC.play('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    requestAnimationFrame(MAIN.frame);
  };
  MAIN.resize = function () {
    const w = innerWidth, h = innerHeight, s = G.settings.renderScale || 1;
    G.renderer.setPixelRatio(Math.min(2, devicePixelRatio) * s);
    G.renderer.setSize(w, h, false);
    G.renderer.domElement.style.width = w + 'px'; G.renderer.domElement.style.height = h + 'px';
    G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
    G.vmCam.aspect = w / h; G.vmCam.updateProjectionMatrix();
  };
  function applyTheme(t) {
    const top = new THREE.Color(t.sky[0]), hor = new THREE.Color(t.sky[1]), c = new THREE.Color();
    const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) { const k = Math.max(0, pos.getY(i) / 300); c.copy(hor).lerp(top, Math.pow(k, 0.6)); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
    G.scene.fog = new THREE.Fog(t.fog, 30, t.fogFar || 150);
    G.renderer.setClearColor(t.fog);
    outer.material.color.setHex(t.water ? 0x0d2236 : t.outer);
    outer.position.y = t.water ? 2.6 : 3.24;
  }
  /* the ground (or sea) beyond the map: a 900 m square with the map's own footprint cut out.
     The voxels draw their own ground inside it, so the plane never caps a basement stairwell,
     a cellar trench or a blast crater with a flat sheet of colour. */
  function outerRing(Wm, Dm) {
    const R = 450, cx = Wm / 2, cz = Dm / 2, sh = new THREE.Shape(), hole = new THREE.Path();
    // shape space (x, y) lies on the ground as world (x, -z) once rotated flat
    sh.moveTo(cx - R, -(cz - R)); sh.lineTo(cx + R, -(cz - R)); sh.lineTo(cx + R, -(cz + R)); sh.lineTo(cx - R, -(cz + R)); sh.lineTo(cx - R, -(cz - R));
    hole.moveTo(0, 0); hole.lineTo(0, -Dm); hole.lineTo(Wm, -Dm); hole.lineTo(Wm, 0); hole.lineTo(0, 0);
    sh.holes.push(hole);
    outer.geometry.dispose();
    outer.geometry = new THREE.ShapeGeometry(sh);
    outer.position.x = 0; outer.position.z = 0;
  }
  MAIN.loadMap = function (id) {
    GAD.clear(); FX.clear(); SFX.stopAll();
    for (const a of G.actors) a.removeFrom(G.scene);
    G.actors = []; G.player = null;
    if (G.world) { G.scene.remove(G.world.group); G.world.dispose(); }
    const map = MAPS.build(id);
    G.map = map; G.world = map.world;
    G.world.onBreak = (x, y, z, m) => FX.debris(x, y, z, m);
    G.world.onChange = (x, y, z) => NAV.touch(x, y, z);
    applyTheme(map.theme);
    G.world.remeshAll();
    G.scene.add(G.world.group);
    outerRing(G.world.W * 0.25, G.world.D * 0.25);
    NAV.build();
    MAIN.mapId = id;
  };
  /* back to the pristine map for a new round */
  MAIN.resetWorld = function (keepActors) {
    GAD.clear(); FX.clear(); SFX.stopAll(); KC.reset();
    if (!keepActors) { for (const a of G.actors) a.removeFrom(G.scene); G.actors = []; }
    G.world.restore();
    NAV.build();
  };
  MAIN.menuBackground = function () {
    if (!G.world || MAIN.mapId === 'range') MAIN.loadMap(U.pick(MAPS.LIST).id);
    G.actors.forEach(a => a.removeFrom(G.scene)); G.actors = [];
    GAD.clear();
  };

  function separate() {
    const A = G.actors;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.state === 'dead' || b.state === 'dead' || a.dummy || b.dummy || a.remote || b.remote) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.5 || d < 1e-4 || Math.abs(a.pos.y - b.pos.y) > 1.4) continue;
      const push = (0.5 - d) * 0.5, nx = dx / d * push, nz = dz / d * push;
      if (!a.blocked(a.pos.x - nx, a.pos.y, a.pos.z - nz, a.h)) { a.pos.x -= nx; a.pos.z -= nz; }
      if (!b.blocked(b.pos.x + nx, b.pos.y, b.pos.z + nz, b.h)) { b.pos.x += nx; b.pos.z += nz; }
    }
  }
  function simulate(dt) {
    PLAYER.update(dt);
    // an online guest: only my operator is simulated here; the host sends the rest
    if (GAME.client) {
      const a = G.player;
      if (a) {
        a.busy = Math.max(0, a.busy - dt);
        a.physics(dt);
        WPN.update(a, dt);
      }
      NP.guestUpdate(dt);
      GAME.update(dt);
      KC.record(); KC.update(dt);
      return;
    }
    for (const a of G.actors) if (a.bot) AI.update(a, dt);
    for (const a of G.actors) {
      a.busy = Math.max(0, a.busy - dt);
      if (a.ability && a.ability.cd > 0) a.ability.cd -= dt;
      a.statusTick(dt);
      if (!a.dummy && !a.remote) a.physics(dt);
      if (!a.hostage && !a.dummy && !a.remote) WPN.update(a, dt);
    }
    separate();
    GAD.update(dt);
    if (G.mode === 'match') GAME.update(dt); else if (G.mode === 'range') RANGE.update(dt);
    if (NP.active && NP.host) NP.hostUpdate(dt);
    KC.record(); KC.update(dt);
  }
  function drawActors(dt) {
    const P = PLAYER, W = G.world, kc = KC.frameNow();
    for (const a of G.actors) {
      // a replay poses everyone from the recording just for drawing, then puts the live state back
      const saved = kc ? KC.pose(a, kc) : null;
      const hide = kc ? KC.hidden(a) : (a === G.player && P.view === 'body') || (P.view === 'spectate' && a === P.spec);
      a.updateRig(dt, !hide);
      if (!hide && a.rig) { const L = W.outdoor(a.pos.clone().setY(a.pos.y + 1)) ? W.light.out : W.light.in; a.tint([Math.min(1.1, L[0] * 1.05), Math.min(1.1, L[1] * 1.05), Math.min(1.1, L[2] * 1.05)]); }
      if (saved) KC.unpose(a, saved);
    }
  }

  MAIN.frame = function (t) {
    requestAnimationFrame(MAIN.frame);
    let dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    G.dt = dt;
    const playing = (G.mode === 'match' || G.mode === 'range') && G.player;
    if (playing && !G.paused) {
      G.time += dt;
      simulate(dt);
      G.world.flush(8);
      FX.update(dt);
      drawActors(dt);
      PLAYER.camera(dt);
      HUD.update(dt);
      SFX.update();
    } else if (playing && G.paused) {
      PLAYER.camera(0);
    } else if (G.world) {
      // menu flyover
      menuT += dt * 0.05;
      const W = G.world, cx = W.W / 8, cz = W.D / 8, R = Math.max(cx, cz) * 1.05;
      G.camera.position.set(cx + Math.cos(menuT) * R, 18 + Math.sin(menuT * 0.7) * 3, cz + Math.sin(menuT) * R);
      G.camera.lookAt(cx, 5, cz);
      if (G.camera.fov !== 60) { G.camera.fov = 60; G.camera.updateProjectionMatrix(); }
      G.world.flush(8); FX.update(dt);
      if (PLAYER.vm) PLAYER.vm.root.visible = false;
    }
    MUSIC.update();
    sky.position.copy(G.camera.position);
    G.renderer.clear();
    G.renderer.render(G.scene, G.camera);
    if (playing && PLAYER.vm && PLAYER.vm.root.visible) { G.renderer.clearDepth(); G.renderer.render(G.vmScene, G.vmCam); }
  };

  /* advance the game by n fixed steps (testing / when the tab is in the background) */
  MAIN.step = function (n, dt) {
    dt = dt || 1 / 60;
    for (let i = 0; i < (n || 1); i++) {
      if (!G.player || G.paused) break;
      G.time += dt; simulate(dt); G.world.flush(8); FX.update(dt); drawActors(dt); PLAYER.camera(dt); HUD.update(dt);
    }
    MUSIC.update();
    G.renderer.clear(); G.renderer.render(G.scene, G.camera);
    if (PLAYER.vm && PLAYER.vm.root.visible) { G.renderer.clearDepth(); G.renderer.render(G.vmScene, G.vmCam); }
  };

  window.MAIN = MAIN;
  window.addEventListener('load', () => {
    try { MAIN.init(); }
    catch (e) { console.error(e); const b = U.$('boot'); if (b) b.innerHTML = 'BLOCKADE<small>failed to start: ' + e.message + '</small>'; }
  });
})();
