/* player.js -- input, the first-person camera and viewmodel, drone piloting,
   the camera network, spectating, pinging.                                  */
(function () {
  'use strict';
  const V = () => new THREE.Vector3();
  const D2R = Math.PI / 180;
  const P = {
    keys: {}, mouse: { l: false, r: false }, locked: false, view: 'body', drone: null, cam: null, camList: [], specIdx: 0, spec: null,
    rec: { p: 0, y: 0 }, kick: 0, shakeT: 0, bob: 0, eyeY: null, vm: null, vmKey: '', flashT: 0, xDown: 0, xFired: false, deadT: 0, meleeT: 0, swayX: 0, swayY: 0, enabled: false,
  };

  /* ------------------------------------------------------------------ input */
  P.init = function () {
    const cv = G.renderer.domElement;
    cv.addEventListener('click', () => { if (P.enabled && !P.locked && !G.paused) P.lock(); });
    document.addEventListener('pointerlockchange', () => {
      P.locked = document.pointerLockElement === cv;
      if (!P.locked && P.enabled && !P.suppressPause && G.mode !== 'menu') MENU.pause();
      P.suppressPause = false;
    });
    document.addEventListener('mousemove', e => { if (P.locked) P.look(e.movementX, e.movementY); });
    document.addEventListener('mousedown', e => {
      if (MENU.capturing || !P.locked) return;
      if (e.button === 1) e.preventDefault();
      P.codeDown('Mouse' + e.button);
    });
    document.addEventListener('mouseup', e => P.codeUp('Mouse' + e.button));
    document.addEventListener('contextmenu', e => { if (P.enabled) e.preventDefault(); });
    window.addEventListener('keydown', e => {
      if (MENU.capturing || !P.enabled) return;
      if (KEYS.actionsFor(e.code).length || e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      P.codeDown(e.code);
    });
    window.addEventListener('keyup', e => P.codeUp(e.code));
    window.addEventListener('blur', () => { P.down = {}; HUD.scoreboard(false); });
  };
  P.down = {};
  /* is the input bound to an action held? */
  P.held = act => !!P.down[KEYS.map[act]];
  P.codeDown = function (code) {
    P.down[code] = true;
    const acts = KEYS.actionsFor(code);
    if (acts.includes('scoreboard')) HUD.scoreboard(true);
    if (P.locked) for (const act of acts) P.action(act);
  };
  P.codeUp = function (code) {
    if (!P.down[code]) return;
    P.down[code] = false;
    const acts = KEYS.actionsFor(code);
    if (acts.includes('scoreboard')) HUD.scoreboard(false);
    if (acts.includes('ability')) P.xUp();
    if (acts.includes('aim') && G.settings.aimToggle === false) { /* hold mode: nothing */ }
    if (!G.settings.leanToggle && (acts.includes('leanL') || acts.includes('leanR')) && G.player) G.player.leanT = P.held('leanL') ? -1 : P.held('leanR') ? 1 : 0;
    if (!G.settings.crouchToggle && acts.includes('crouch') && G.player && G.player.stance === 1) G.player.setStance(0);
  };
  P.lock = function () { try { G.renderer.domElement.requestPointerLock(); } catch (e) { } SFX.init(); };
  P.release = function () { P.enabled = false; P.suppressPause = true; if (document.pointerLockElement) document.exitPointerLock(); P.down = {}; P.aimLatch = false; };
  P.interactHeld = () => P.held('interact') && P.locked;
  P.viewActor = () => P.view === 'spectate' ? P.spec : (P.view === 'body' ? G.player : null);

  P.look = function (dx, dy) {
    const s = G.settings, a = G.player;
    let k = 0.0022 * s.sens;
    if (P.view === 'body' && a) k *= U.lerp(1, s.adsSens / P.zoomNow(), a.ads);
    if (s.invertY) dy = -dy;
    if (P.view === 'body' && a && a.state !== 'dead') {
      a.yaw -= dx * k; a.pitch = U.clamp(a.pitch - dy * k, -1.45, 1.45);
      if (a.rappel) { /* free look on the rope */ }
      P.swayX = U.clamp(P.swayX + dx * 0.0004, -0.03, 0.03); P.swayY = U.clamp(P.swayY + dy * 0.0004, -0.03, 0.03);
    } else if (P.view === 'drone' && P.drone) { P.drone.yaw -= dx * k; P.drone.pitch = U.clamp(P.drone.pitch - dy * k, -0.9, 0.9); }
    else if (P.view === 'cams' && P.cam) { P.cam.look.yaw = U.clamp(P.cam.look.yaw - dx * k, -1.2, 1.2); P.cam.look.pitch = U.clamp(P.cam.look.pitch - dy * k, -0.7, 0.5); }
  };
  /* a bound action was pressed */
  P.action = function (act) {
    const a = G.player; if (!a) return;
    if (act === 'chat') { HUD.openChat(); return; }
    const atkPrep = GAME.phase === 'prep' && a.side === 'atk' && G.mode === 'match';
    if (P.view === 'replay') { if (act === 'vault' || act === 'interact') KC.skip(); return; }
    if (P.view === 'drone') {
      if (act === 'device' || act === 'interact') { if (!atkPrep) P.leaveDrone(); else HUD.toast('Attackers drone during preparation'); }
      if (act === 'vault' && P.drone) P.drone.jump = true;
      if ((act === 'ability' || act === 'aim') && P.drone && P.drone.surge) P.drone.zap();
      if (act === 'ping' || act === 'fire') P.ping();
      return;
    }
    if (P.view === 'cams') {
      if (act === 'device' || act === 'interact') P.leaveCams();
      if (act === 'left' || act === 'leanL') P.cycleCam(-1);
      if (act === 'right' || act === 'leanR' || act === 'aim') P.cycleCam(1);
      if (act === 'ping' || act === 'fire') P.ping();
      return;
    }
    if (P.view === 'spectate') {
      if (act === 'device') P.openDeviceView(true);
      if (act === 'left' || act === 'aim') P.cycleSpec(-1);
      if (act === 'right' || act === 'fire') P.cycleSpec(1);
      return;
    }
    if (a.state !== 'alive') return;
    switch (act) {
      case 'walk': if (G.settings.walkToggle) P.walkLatch = !P.walkLatch; break;
      case 'crouch': if (a.rappel) { a.ropeInvert(); break; } a.setStance(G.settings.crouchToggle ? (a.stance === 1 ? 0 : 1) : 1); break;
      case 'prone': a.setStance(a.stance === 2 ? 0 : 2); break;
      case 'leanL': a.leanT = G.settings.leanToggle ? (a.leanT === -1 ? 0 : -1) : -1; break;
      case 'leanR': a.leanT = G.settings.leanToggle ? (a.leanT === 1 ? 0 : 1) : 1; break;
      case 'aim': if (G.settings.aimToggle) P.aimLatch = !P.aimLatch; break;
      case 'reload': WPN.reload(a); break;
      case 'primary': if (!(a.carry && a.carry.hostage)) WPN.swap(a, 0); break;
      case 'secondary': WPN.swap(a, 1); break;
      case 'gadget': if (!atkPrep) { if (GAME.client) NP.act('gadget'); else GAD.secondary(a); } break;
      case 'ability': {
        P.xDown = G.time; P.xFired = false;
        if (!a.ability || a.ability.id === 'rcharge' || atkPrep) break;
        // scanner / scope zoom are purely local; everything else the host carries out
        if (GAME.client && a.ability.id !== 'scanner' && a.ability.id !== 'spotter') NP.act('ability'); else GAD.ability(a);
        break;
      }
      case 'melee': if (GAME.client) { if ((a.meleeT || 0) > G.time) break; const bash = a.shieldOp && a.shieldUp; a.meleeT = G.time + (bash ? 1.1 : 0.85); if (bash) a.shBash = 0.3; P.onMelee(); SFX.melee(a.eye(V())); NP.act('melee'); } else WPN.melee(a); break;
      case 'vault': {
        if (atkPrep) break;
        if (a.rappel) {
          // beside a window: crash through it. A blocked window says so; press again to just let go
          if (a.ropeWindow()) {
            if (a.crashWindow()) break;
            if (!(P.crashNag > G.time)) { HUD.toast(a.crashFail + ' · ' + KEYS.name('vault') + ' again to let go', 'warn'); P.crashNag = G.time + 1.5; break; }
          }
          a.ropeLetGo(); break;
        }
        if (!a.tryVault()) a.tryRappel();
        break;
      }
      case 'device': P.openDeviceView(false); break;
      case 'ping': P.ping(); break;
      case 'firemode': if (a.wpn && a.wpn.def.auto) { a.wpn.auto = !a.wpn.auto; HUD.toast(a.wpn.auto ? 'FULL AUTO' : 'SINGLE'); } break;
      case 'interact': { if (GAME.client) { NP.act('interact'); break; } if (a.interact) break; const its = GAME.interactions(a); if (its.length) GAME.beginInteract(a, its[0]); break; }
    }
  };
  P.xUp = function () {
    const a = G.player; if (!a || !a.ability || a.ability.id !== 'rcharge' || P.view !== 'body' || !P.locked) return;
    if (!P.xFired && G.time - P.xDown < 0.35) { if (GAME.client) NP.act('ability'); else GAD.ability(a); }
  };
  P.openDeviceView = function (dead) {
    const a = G.player;
    if (a.side === 'atk' && GAME.client) { NP.act('device'); return; }
    if (a.side === 'atk') {
      const mine = G.ents.filter(e => e.alive && e.type === 'drone' && e.owner === a);
      if (mine.length) return P.enterDrone(mine[(P.droneCycle = ((P.droneCycle || 0) + 1)) % mine.length]);
      if (!dead && GAME.phase === 'action' && a.drones > 0) { const d = GAD.deployDrone(a, false); if (d) setTimeout(() => { if (d.alive) P.enterDrone(d); }, 400); return; }
      HUD.toast('No drones left');
    } else {
      P.camList = GAD.cams(a.team);
      if (!P.camList.length) { HUD.toast('All cameras destroyed'); return; }
      P.view = 'cams'; P.camIdx = 0; P.cam = P.camList[0];
      a.mf = a.mr = 0; a.trigger = false; a.adsWant = false;
    }
  };
  P.enterDrone = function (d) {
    if (!d || !d.alive) return;
    P.view = 'drone'; P.drone = d; d.pilot = G.player; d.loop = SFX.loop('drone', d.pos); d.loop.local = true;
    const a = G.player; a.mf = a.mr = 0; a.trigger = false; a.adsWant = false;
  };
  P.leaveDrone = function (fromHost) {
    if (GAME.client && P.drone && !fromHost) NP.act('undrone');
    if (P.drone) { if (!P.drone.mirror) P.drone.pilot = null; P.drone.mf = P.drone.mr = 0; if (P.drone.loop) { P.drone.loop.stop(); P.drone.loop = null; } }
    if (window.NP) NP.myDrone = null;
    P.drone = null;
    if (P.view === 'drone') P.view = G.player && G.player.state === 'dead' ? 'spectate' : 'body';
  };
  P.leaveCams = function () { P.cam = null; if (P.view === 'cams') P.view = G.player && G.player.state === 'dead' ? 'spectate' : 'body'; };
  P.cycleCam = function (d) {
    P.camList = GAD.cams(G.player.team); if (!P.camList.length) return P.leaveCams();
    P.camIdx = ((P.camIdx || 0) + d + P.camList.length) % P.camList.length; P.cam = P.camList[P.camIdx]; SFX.ui(1400);
  };
  P.cycleSpec = function (d) {
    const list = G.actors.filter(t => t.team === G.player.team && t.state !== 'dead' && !t.isPlayer);
    if (!list.length) { P.spec = null; return; }
    P.specIdx = ((P.specIdx || 0) + d + list.length) % list.length; P.spec = list[P.specIdx];
  };
  /* mark the enemy nearest the crosshair */
  P.ping = function () {
    let e, f;
    const a = G.player;
    if (P.view === 'drone' && P.drone) { e = P.drone.eye(); f = P.drone.fwd(); }
    else if (P.view === 'cams' && P.cam) { e = P.cam.pos.clone(); f = camFwd(P.cam); }
    else if (P.view === 'body' && a.alive) { e = a.eye(V()); f = a.fwd(V()); }
    else return;
    let best = null, bd = 0.05;
    for (const t of G.actors) {
      if (t.team === a.team || t.state === 'dead' || t.hostage) continue;
      const c = t.center(V()), to = c.clone().sub(e), d = to.length(); to.normalize();
      const off = 1 - to.dot(f);
      if (off < bd && d < 60 && (G.world.los(e, c) || G.world.los(e, t.eye(V()))) && !FX.smokeBlocks(e, c)) { bd = off; best = t; }
    }
    if (best) { if (GAME.client) NP.act('ping', { aid: best.id }); else GAME.mark(best, a.team, 5, true); SFX.ping(); HUD.toast(best.op.name + ' spotted'); }
    else {
      const h = G.world.raycast(e, f, 60);
      if (h) { HUD.pingAt(new THREE.Vector3(h.px, h.py, h.pz)); SFX.ui(1300); }
    }
  };

  /* ------------------------------------------------------------- per frame */
  P.update = function (dt) {
    const a = G.player; if (!a) return;
    const atkPrep = GAME.phase === 'prep' && a.side === 'atk';
    if (P.view === 'body' && a.state !== 'dead' && P.locked) {
      const h = P.held;
      a.mf = (h('forward') ? 1 : 0) - (h('back') ? 1 : 0); a.mr = (h('right') ? 1 : 0) - (h('left') ? 1 : 0);
      a.sprint = h('sprint');
      // walking: hold (or toggle) for a slow, quiet pace; breaking into a sprint ends a toggled walk
      if (a.sprint && a.mf > 0.3) P.walkLatch = false;
      a.walk = !a.sprint && (G.settings.walkToggle ? !!P.walkLatch : h('walk'));
      if (!G.settings.leanToggle && a.state === 'alive') a.leanT = h('leanL') ? -1 : h('leanR') ? 1 : 0;
      const scanning = a.ability && a.ability.id === 'scanner' && a.ability.on;
      a.trigger = h('fire') && !scanning && !(a.carry && a.carry.hostage && a.cur === 0);
      a.adsWant = G.settings.aimToggle ? !!P.aimLatch : h('aim');
      if (a.sprint && a.mf > 0.3 && G.settings.aimToggle) P.aimLatch = false;
      if (a.state === 'dbno') { a.trigger = false; a.adsWant = false; a.sprint = false; }
      if (atkPrep) { a.mf = a.mr = 0; a.trigger = false; }
      // Rhea: hold the ability to detonate
      if (h('ability') && a.ability && a.ability.id === 'rcharge' && !P.xFired && G.time - P.xDown > 0.35) { P.xFired = true; if (GAME.client) NP.act('rdet'); else { const n = GAD.detonateAll(a, 'rcharge'); if (!n) HUD.toast('No charges placed'); } }
      // Marlow spots under her scope
      if (a.op.ability && a.op.ability.id === 'spotter' && a.ads > 0.7 && a.wpn.def.type === 'DMR') {
        const e = a.eye(V()), f = a.fwd(V());
        for (const t of G.actors) { if (t.team === a.team || t.state !== 'alive' || t.hostage) continue; const c = t.center(V()), to = c.clone().sub(e), d = to.length(); if (d < 60 && 1 - to.normalize().dot(f) < 0.002 && G.world.los(e, c) && !GAME.marked(t, a.team) && (t.spotT || 0) < G.time) { t.spotT = G.time + 1; if (GAME.client) NP.act('ping', { aid: t.id, dur: 6 }); else GAME.mark(t, a.team, 6, true); SFX.ping(); } }
      }
    } else if (P.view !== 'body') { a.mf = a.mr = 0; a.trigger = false; a.adsWant = false; a.sprint = false; a.walk = false; }
    if (!P.locked) { a.trigger = false; }
    if (P.view === 'drone' && P.drone) {
      const h = P.held, d = P.drone;
      if (!d.alive) { P.leaveDrone(); }
      else {
        d.mf = (h('forward') ? 1 : 0) - (h('back') ? 1 : 0); d.mr = (h('right') ? 1 : 0) - (h('left') ? 1 : 0);
        // booster (the sprint key). The cooldown is kept here too, so a guest's HUD can show it
        P.dBoostCd = Math.max(0, (P.dBoostCd || 0) - dt);
        if (h('sprint') && P.dBoostCd <= 0) { d.boost = true; P.dBoostCd = GAD.Drone.BOOST_CD; P.dBoostSend = true; }
      }
    }
    if (P.view === 'cams' && P.cam && !P.cam.alive) P.cycleCam(1);
    if (a.state === 'dead') {
      P.deadT += dt;
      // Deathmatch / Team Deathmatch: stay down until the respawn, no spectating
      if (P.view === 'body' && P.deadT > 2.2 && !KC.busy() && !GAME.arcade) { P.view = 'spectate'; P.cycleSpec(0); }
      if (P.view === 'spectate' && (!P.spec || P.spec.state === 'dead')) P.cycleSpec(1);
    }
    // recoil recovery (visual part)
    P.rec.p = U.smooth(P.rec.p, 0, 9, dt); P.rec.y = U.smooth(P.rec.y, 0, 9, dt); P.kick = U.smooth(P.kick, 0, 14, dt);
    P.shakeT = Math.max(0, P.shakeT - dt);
    P.flashT = Math.max(0, P.flashT - dt);
  };
  P.onFire = function (d) {
    const a = G.player;
    const m = (a.stance === 1 ? 0.85 : a.stance === 2 ? 0.7 : 1) * (1 - a.ads * 0.15) * (d.bipod && a.stance >= 1 ? 0.45 : 1) * (a.exhT > 0 ? 1.3 : 1);
    const up = d.rv * m * (0.85 + Math.random() * 0.3) * D2R, side = (Math.random() - 0.45) * 2 * d.rh * m * D2R;
    if (P.view === 'body') { a.pitch = U.clamp(a.pitch + up * 0.65, -1.45, 1.45); a.yaw -= side * 0.65; }
    P.rec.p += up * 0.35; P.rec.y += side * 0.35; P.kick = Math.min(1, P.kick + 0.6);
    P.flashT = 0.04;
  };
  P.onMelee = function () { P.meleeT = 0.35; };
  P.shake = function (k) { P.shakeT = Math.max(P.shakeT, k); };
  /* aim punch (from a shield bash): the view gets knocked up and sideways and shakes */
  P.punch = function (k) { P.rec.p += 0.2 * k; P.rec.y += (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.12) * k; P.shake(0.5 * k); };
  P.zoomNow = () => P.zoomOf(G.player);
  P.zoomOf = function (a) {
    if (!a || !a.wpn) return 1;
    const s = a.wpn.def.sight;
    let z = s === 'acog' ? (a.zoom4 ? 4 : 2.5) : s === 'iron' ? 1.12 : 1.22;
    if (a.wpn.def.type === 'SG') z = 1.1;
    return z;
  };
  P.onDeath = function (k) {
    P.deadT = 0; P.leaveDrone(); P.leaveCams();
    let head = !!(GAME.lastElim && GAME.lastElim.v === G.player && GAME.lastElim.head);
    // a guest hears who did it from the kill feed
    if (GAME.client) { const f = feedEntry(G.player); if (f) { k = k || G.actors.find(a => GAME.who(a) === f.k && a.team === f.kt) || null; head = !!f.head; } }
    P.killer = k;
    HUD.toast(k && k !== G.player ? 'Eliminated by ' + GAME.who(k) + ' (' + k.op.name + ')' : 'You died', 'warn');
    // the kill cam: a moment on the floor, then the last few seconds again from the killer's side
    // (not in Deathmatch / Team Deathmatch: you're back in four seconds)
    if (GAME.arcade) P.respawnAt = G.time + ARC.RESPAWN;
    else if (G.mode === 'match' && GAME.phase === 'action') KC.queue('death', k, G.player, 1.1, { head });
  };
  const feedEntry = v => GAME.feed.find(e => e.v === GAME.who(v) && e.vt === v.team && !e.verb);
  P.feedEntry = feedEntry;
  P.roundStart = function () {
    P.view = 'body'; P.drone = null; P.cam = null; P.spec = null; P.deadT = 0; P.eyeY = null; P.vmKey = ''; P.enabled = true; P.respawnAt = 0;
    const a = G.player;
    if (a.side === 'atk' && !GAME.client && !GAME.arcade) { const d = GAD.deployDrone(a, true); if (d) P.enterDrone(d); }
    HUD.reticle && document.documentElement.style.setProperty('--xc', SHOP.css('reticle'));
    if (!P.locked) P.lock();
  };
  /* back in after a death (Deathmatch / Team Deathmatch) */
  P.respawned = function () {
    if (KC.play) KC.stop(true);
    P.view = 'body'; P.drone = null; P.cam = null; P.spec = null; P.deadT = 0; P.eyeY = null; P.vmKey = ''; P.respawnAt = 0;
    P.rec.p = P.rec.y = 0; P.kick = 0;
  };
  P.actionStart = function () { if (P.view === 'drone' && G.player.state === 'alive') P.leaveDrone(); };

  /* --------------------------------------------------------------- camera */
  function camFwd(c) { const y = c.yaw + c.look.yaw, p = c.pitch + c.look.pitch, cp = Math.cos(p); return V().set(-Math.sin(y) * cp, Math.sin(p), -Math.cos(y) * cp); }
  P.camera = function (dt) {
    const cam = G.camera, a = G.player, s = G.settings;
    let fov = s.fov;
    P.vmVisible = false;
    for (const e of G.ents) if (e.type === 'drone' && e.mesh) e.mesh.visible = !(P.view === 'drone' && P.drone === e);
    if (P.view === 'replay' && KC.play) {
      fov = KC.camera(cam, dt);
    } else if (P.view === 'drone' && P.drone) {
      cam.position.copy(P.drone.eye()); cam.rotation.set(P.drone.pitch, P.drone.yaw, 0, 'YXZ'); fov = 80;
    } else if (P.view === 'cams' && P.cam) {
      cam.position.copy(P.cam.pos).add(V().set(0, -0.12, 0)); cam.rotation.set(P.cam.pitch + P.cam.look.pitch, P.cam.yaw + P.cam.look.yaw, 0, 'YXZ'); fov = 70;
    } else if (P.view === 'spectate' && P.spec) {
      // through a teammate's eyes, their gun on screen (updateVM), their sight's zoom when they aim
      const t = P.spec; cam.position.copy(t.eye(V())); cam.rotation.set(t.pitch, t.yaw, -t.lean * 0.16, 'YXZ'); fov = s.fov / U.lerp(1, P.zoomOf(t), t.ads || 0);
      if (t.sprint && t.moving > 3.6) fov += 4;
    } else if (a) {
      const e = a.eye(V());
      // smooth step-ups
      if (P.eyeY == null || Math.abs(P.eyeY - e.y) > 1) P.eyeY = e.y; else P.eyeY = U.smooth(P.eyeY, e.y, 18, dt);
      e.y = P.eyeY;
      if (a.state === 'dead') { const k = Math.min(1, P.deadT * 2); e.y -= k * (a.eyeH - 0.3); }
      cam.position.copy(e);
      let sx = 0, sy = 0;
      if (P.shakeT > 0) { sx = (Math.random() - 0.5) * P.shakeT * 0.06; sy = (Math.random() - 0.5) * P.shakeT * 0.06; }
      if (a.stun > 0) { sx += Math.sin(G.time * 3) * 0.02 * Math.min(1, a.stun); sy += Math.cos(G.time * 2.3) * 0.015 * Math.min(1, a.stun); }
      cam.rotation.set(a.pitch + P.rec.p + sy, a.yaw + P.rec.y + sx, -a.lean * 0.16 + (a.rappel ? 0 : 0), 'YXZ');
      fov = s.fov / U.lerp(1, P.zoomNow(), a.ads);
      if (a.sprint && a.moving > 3.6) fov += 4;
      P.vmVisible = a.state === 'alive' || a.state === 'dbno';
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    SFX.setListener(cam.position, cam.rotation.y);
    P.updateVM(dt);
  };

  /* ----------------------------------------------------------- viewmodel */
  /* whose hands and gun are on screen: mine, the teammate I am watching, or the shooter in a
     kill cam (a stand-in made from the recording: killcam.js) */
  P.vmSubject = function () {
    if (P.view === 'spectate') { const t = P.spec; return t && t.state !== 'dead' && t.wpn && !t.hostage ? t : null; }
    if (P.view === 'replay') return KC.subject();
    return P.vmVisible ? G.player : null;
  };
  P.buildVM = function (a) {
    const cos = a.cos || {}, key = a.op.id + ':' + a.wpn.id + ':' + (a.shieldOp && a.shieldUp ? 'S' : '') + ':' + (cos.finish || '') + ':' + (cos.suit || '');
    if (key === P.vmKey) return;
    P.vmKey = key;
    if (P.vm) G.vmScene.remove(P.vm.root);
    const root = new THREE.Group(), gun = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const vg = MD.viewGun(a.wpn.id, a.op, cos.finish);
    const gm = new THREE.Mesh(vg.geo, mat); gun.add(gm);
    const arms = new THREE.Mesh(MD.viewArms(a.op, cos.suit), mat); arms.position.set(0.02, -0.17, 0.12); arms.rotation.x = 0.25; gun.add(arms);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.flashTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.set(0, 0, vg.muzzleZ - 0.04); flash.scale.setScalar(0.22); flash.visible = false; gun.add(flash);
    const SC = 0.5;
    gun.scale.setScalar(SC);
    root.add(gun);
    let shield = null;
    if (a.shieldOp && a.shieldUp) {
      // held low on the left with a clear glass viewport: the middle and right of the screen stay open
      const vs = MD.viewShield(a.op);
      shield = new THREE.Group();
      shield.add(new THREE.Mesh(vs.frame, mat));
      const glass = new THREE.Mesh(vs.glass, new THREE.MeshBasicMaterial({ color: 0x9fd2ee, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      glass.renderOrder = 3; shield.add(glass);
      shield.scale.setScalar(0.62);
      root.add(shield);
    }
    G.vmScene.add(root);
    P.vm = { root, gun, mat, flash, sightY: vg.sightY * SC, shield, pistol: /PISTOL|MP/.test(a.wpn.def.type) };
  };
  P.flashTex = function () {
    if (P._ft) return P._ft;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.4, 'rgba(255,190,80,0.8)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (P._ft = new THREE.CanvasTexture(c));
  };
  P.updateVM = function (dt) {
    const a = P.vmSubject();
    if (!a || !a.wpn) { if (P.vm) P.vm.root.visible = false; HUD.reticle(''); HUD.scope(false); return; }
    P.buildVM(a);
    if (a !== G.player) { P.swayX = P.swayY = 0; P.meleeT = 0; }       // someone else's hands: my mouse doesn't sway them
    const vm = P.vm; vm.root.visible = true;
    const w = a.wpn, ads = a.ads;
    P.bob += dt * (a.moving > 0.3 && a.onGround ? 4 + a.moving * 1.6 : 0);
    const bobA = Math.min(1, a.moving / 4) * (1 - ads * 0.85);
    // held low on the right, far enough out that the sight housing doesn't fill the screen
    // (13 cm away, a red dot or holo frame covered a third of the view); aiming brings the sight
    // to the centre
    const hip = vm.shield ? V().set(0.1, -0.095, -0.21) : vm.pistol ? V().set(0.1, -0.12, -0.3) : V().set(0.12, -0.15, -0.3);
    const aim = V().set(0, -vm.sightY, vm.pistol ? -0.32 : -0.28);
    const pos = hip.lerp(aim, ads);
    pos.x += Math.sin(P.bob) * 0.006 * bobA - P.swayX * 0.5 * (1 - ads * 0.8);
    pos.y += Math.abs(Math.cos(P.bob)) * 0.005 * bobA + P.swayY * 0.5 * (1 - ads * 0.8);
    pos.z += P.kick * 0.022;
    P.swayX *= Math.exp(-dt * 8); P.swayY *= Math.exp(-dt * 8);
    let rx = P.kick * 0.06, ry = 0, rz = 0;
    // reload / swap / sprint / gadget poses
    if (w.reload > 0) { const t = 1 - w.reload / (w.reloadMax || 1); const k = Math.sin(Math.min(1, t) * Math.PI); pos.y -= 0.035 * k; rx -= 0.5 * k; rz += 0.4 * k; }
    if (a.swap > 0) { const k = Math.min(1, a.swap / 0.4); pos.y -= 0.12 * k; rx -= 0.6 * k; }
    if (a.sprint && a.moving > 3.5) { pos.x += 0.02; pos.y -= 0.015; ry += 0.6; rz += 0.2; }
    if (a.busy > 0) { pos.y -= 0.08; rx -= 0.4; }
    if (a.ability && a.ability.on) { pos.y -= 0.12; }
    if (a.state === 'dbno') { pos.y -= 0.15; }
    if (P.meleeT > 0) { const k = Math.sin((1 - P.meleeT / 0.35) * Math.PI); pos.z -= 0.08 * k; pos.x -= 0.04 * k; ry -= 0.5 * k; P.meleeT -= dt; }
    vm.gun.position.copy(pos); vm.gun.rotation.set(rx, ry, rz);
    vm.flash.visible = P.flashT > 0; if (vm.flash.visible) vm.flash.material.rotation = Math.random() * 6;
    if (vm.shield) {
      // the same three poses the hit test uses: up in front, aside to aim, round to the flank to sprint
      const k = ads, sd = a.shSide || 0, bs = a.shBash > 0 ? Math.sin(a.shBash / 0.3 * Math.PI) : 0;
      const sp = V().set(-0.25, -0.23, -0.44).lerp(V().set(-0.4, -0.33, -0.42), k).lerp(V().set(-0.5, -0.46, -0.3), sd);
      sp.x += 0.13 * bs; sp.y += 0.07 * bs; sp.z += 0.1 * bs;
      sp.x += Math.sin(P.bob) * 0.008 * bobA - P.swayX * 0.4; sp.y += Math.abs(Math.cos(P.bob)) * 0.006 * bobA + P.swayY * 0.4;
      if (a.state === 'dbno') sp.y -= 0.2;
      vm.shield.position.copy(sp);
      vm.shield.rotation.set(0.06 + 0.25 * sd, U.lerp(U.lerp(0.32, 0.55, k), 1.15, sd) - 0.25 * bs, 0.05 + 0.25 * sd);
    }
    // scope overlay for magnified optics
    const scoped = w.def.sight === 'acog' && ads > 0.85;
    vm.gun.visible = !scoped;
    HUD.scope(scoped);
    HUD.reticle(ads > 0.82 && !scoped && w.reload <= 0 ? w.def.sight : '');
    // match world lighting
    const L = G.world.outdoor(a.pos) ? G.world.light.out : G.world.light.in;
    const lk = (L[0] + L[1] + L[2]) / 3;
    vm.mat.color.setRGB(Math.min(1.1, lk * 1.05), Math.min(1.1, lk * 1.05), Math.min(1.1, lk * 1.05));
  };

  window.PLAYER = P;
})();
