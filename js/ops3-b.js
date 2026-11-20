/* ops3-b.js -- seasons 15-18, batch B: PRISM, what you see and what you think you see.
     STAIN   dye grenades: defenders caught turn bright orange for 20 s (seen at a glance, cloaked or not)
     GLANCE  corner mirror: look round a corner or over cover without leaning out (no shooting meanwhile)
     FEINT   feint charges: a charge that does everything a breach charge does except make a hole
     GLINT   lens tape: any attacker optic, drone, flank cam or mirror that looks at a strip glints
     CHAFF   chaff canister: a cloud people see through and devices do not; marks fail inside it
     BLUFF   decoy kit: fake gadgets (C4, camera, alarm, sensor); shooting one marks the shooter
   Built on js/ops2.js's registry. Devices (cameras, drones, flank cams, the rotor) check
   OPS2.deviceBlocks, which the chaff cloud answers. */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent, Proj = GAD.Proj;
  const OPS3 = window.OPS3 = window.OPS3 || {};
  for (const t of ['tape', 'bluff']) GAD.TRAPS.add(t);
  Object.assign(GAD.NAMES, { dyenade: 'Dye grenade', mirror: 'Corner mirror', feint: 'Breach charge', tape: 'Lens tape', chaffcan: 'Chaff canister', chaffcloud: 'Chaff cloud', bluff: 'Gadget' });
  Object.assign(GAD.EXTRA, {
    dyenade: g => { g.box(-2, -2, -2, 2, 2, 2, 0xff8a20); g.box(-1, 3, -1, 1, 3, 1, 0x333333); g.set(0, 0, -3, MD.glow(0xffc070)); },
    mirror: g => { g.box(-2, -3, 0, 2, 3, 0, 0x9ad8e8); g.box(-3, -4, 1, 3, 4, 1, 0x333333); g.box(0, -12, 1, 0, -4, 1, 0x555555); },
    tape: g => { g.box(-4, -1, 0, 4, 1, 0, MD.glow(0xfff4a0)); g.box(-4, 0, 0, 4, 0, 0, 0xd8d0a0); },
    chaffcan: g => { g.box(-2, -3, -2, 2, 3, 2, 0x4a5a6a); g.box(-2, 3, -2, 2, 3, 2, 0xc8d8f0); g.set(0, 0, -3, MD.glow(0xc8d8f0)); },
  });
  GAD.MESH_FN.chaffcloud = () => new THREE.Group();

  /* ================================================================= STAIN */
  class DyeNade extends Proj {
    constructor(a) {
      super('dyenade', a, GAD.throwStart(a), GAD.throwVel(a, 13), { fuse: 1.4, hp: 1 });
      this.onFuse = () => OPS3.dyeBurst(this);
    }
  }
  OPS3.dyeBurst = function (n) {
    const p = n.pos.clone(), a = n.owner;
    FX.burst(p, 0xff8a20, 34, 3.2, 0.07, 0.9, 0.6); FX.puff(p, 3.2, 1.4, 0xff9a40);
    SFX.impact(p, true); GAME.noise(p, 16, a, 'gadget');
    for (const b of G.actors) {
      if (b.state === 'dead' || b.hostage || !a || b.team === a.team) continue;
      const c = b.center(V()); if (U.dist3(c, p) > 3.5 || !G.world.los(p, c)) continue;
      OPS3.dye(b, 20);
    }
    n.destroy('used');
  };
  OPS3.dye = function (b, secs) {
    b.dyeT = G.time + secs;
    GAD.tell(b, 'DYED: you stand out for ' + secs + ' s (water washes it off)', 'warn');
    if (window.NP && NP.active && NP.host) NP.push({ k: 'dye', a: b.id, t: secs });
  };
  OPS2.ABIL.dye = (a, ab, need, spend) => { if (!need()) return false; new DyeNade(a); return spend(); };
  /* the look: the operator's whole model (and gun) orange, on every screen */
  function dyeLook(b, on) {
    if (!b.rig) return;
    (b.rig.root || b.rig).traverse(m => {
      if (!m.isMesh || !m.material) return;
      if (on) { if (!m.userData.dyeOrig) { m.userData.dyeOrig = m.material; m.material = m.material.clone(); } m.material.color.setRGB(2.2, 1.0, 0.22); }
      else if (m.userData.dyeOrig) { m.material.dispose(); m.material = m.userData.dyeOrig; delete m.userData.dyeOrig; }
    });
    b._dyed = on;
  }
  /* water (Drench's sprinklers, the extinguisher) washes dye off and settles chaff */
  const oClear = FX.clearSmoke;
  FX.clearSmoke = function (p, r) {
    const out = oClear.apply(this, arguments);
    for (const b of G.actors) if (b.dyeT > G.time && U.dist2(b.pos, p) < r) { b.dyeT = 0; if (window.NP && NP.active && NP.host) NP.push({ k: 'dye', a: b.id, t: 0 }); }
    for (const e of G.ents) if (e.alive && e.type === 'chaffcloud' && U.dist3(e.pos, p) < r + e.r * 0.5) e.destroy('used');
    return out;
  };

  /* ================================================================ GLANCE */
  /* where the mirror is: out to the side she favours (the way she leans, else right) and a little
     forward, at eye height; never through a wall */
  OPS3.mirrorPos = function (a) {
    const e = a.eye(V()), f = a.fwd(V()); f.y = 0; f.normalize();
    const side = a.mirror ? a.mirror.side : 1, r = V().set(-f.z, 0, f.x).multiplyScalar(-side);
    const want = e.clone().addScaledVector(r, 0.62).addScaledVector(f, 0.28);
    const d = want.clone().sub(e), L = d.length(); d.divideScalar(L);
    const h = G.world.raycast(e, d, L + 0.08);
    return h ? e.addScaledVector(d, Math.max(0.05, h.dist - 0.1)) : want;
  };
  class Mirror extends Ent {
    constructor(a) { super('mirror', a, OPS3.mirrorPos(a), { model: 'mirror', upright: true, yaw: a.yaw, hp: 1, hitR: 0.11 }); this.blastproof = false; this.passOwner = true; }
    update(dt) {
      this.t += dt; const a = this.owner;
      if (!a || !a.mirror || a.state !== 'alive') { this.destroy('silent'); return; }
      this.pos.copy(OPS3.mirrorPos(a)); a.mirror.pos = this.pos.clone();
      if (this.mesh) { this.mesh.position.copy(this.pos); this.mesh.rotation.y = a.yaw; }
    }
    destroy(w) {
      if (!this.alive) return;
      super.destroy(w);
      const a = this.owner;
      if (a && a.mirror && w !== 'silent') { OPS3.endMirror(a); a.mirrorLock = G.time + 6; GAD.tell(a, 'Mirror shot out: 6 s to fit another', 'warn'); }
    }
  }
  OPS3.startMirror = function (a, side) {
    a.mirror = { side: side || (a.lean ? Math.sign(a.lean) : 1), t: G.time };
    a.mirror.ent = new Mirror(a); a.mirror.pos = a.mirror.ent.pos.clone();
    a.ads = 0; a.adsWant = false; a.trigger = false;
    SFX.ui && SFX.ui(900);
    if (a.net && window.NP) NP.push({ k: 'mirror', to: a.net, on: 1, s: a.mirror.side });
  };
  OPS3.endMirror = function (a) {
    if (!a.mirror) return;
    const m = a.mirror; a.mirror = null;
    if (m.ent && m.ent.alive) m.ent.destroy('silent');
    if (a.net && window.NP) NP.push({ k: 'mirror', to: a.net, on: 0 });
  };
  OPS2.ABIL.mirror = (a, ab, need, spend) => {
    if (a.mirror) { OPS3.endMirror(a); return true; }
    if (G.time < (a.mirrorLock || 0)) { GAD.tell(a, 'Mirror lost: ' + Math.ceil(a.mirrorLock - G.time) + ' s'); return false; }
    OPS3.startMirror(a); a.busy = 0.2; return true;
  };
  /* a bot's peek: whatever the mirror can see in front, the team learns */
  OPS3.mirrorPeek = function (a) {
    OPS3.startMirror(a, Math.random() < 0.5 ? 1 : -1);
    const m = a.mirror.pos, f = a.fwd(V()); f.y = 0; f.normalize();
    let n = 0;
    for (const t of G.actors) {
      if (t.team === a.team || t.state !== 'alive' || t.hostage) continue;
      const c = t.center(V()), to = c.clone().sub(m), L = to.length(); if (L > 16) continue;
      to.divideScalar(L); if (to.x * f.x + to.z * f.z < 0.1) continue;
      if (!G.world.los(m, c) || FX.smokeBlocks(m, c)) continue;
      GAME.mark(t, a.team, 3, true); n++;
    }
    a.bot.mirrorEnd = G.time + 1.6;
    return n;
  };

  /* ================================================================= FEINT */
  /* to a defender it is a breach charge: the same box, the same beeps, the same bang and dust (and
     the same noise bots run to), and the barricade it was on is gone. The wall is not */
  class Feint extends Ent {
    constructor(a, h) {
      super('feint', a, h.p, { model: 'breach', normal: h.n, hp: 1, hitR: 0.13 });
      this.scanAs = 'breach'; this.fuse = 3.2; this.beep = 0; this.blastproof = false; this.vox = { x: h.x, y: h.y, z: h.z };
      SFX.metal(h.p); GAME.noise(h.p, 10, a, 'gadget');
    }
    update(dt) {
      this.t += dt; this.fuse -= dt;
      if ((this.beep -= dt) <= 0) { this.beep = this.fuse < 1 ? 0.18 : 0.5; SFX.beep(this.pos, 1800, 0.12); }
      if (this.fuse <= 0) this.boom();
    }
    boom() {
      const p = this.pos.clone(), a = this.owner, W = G.world;
      FX.explosion(p, 1.4); SFX.explosion(p, false); FX.puff(p, 1.6, 1.0, 0xc8b8a0);
      GAME.noise(p, 70, a, 'explosion'); G.emit && G.emit('breach');
      // whatever barricade it was on is blown out (and only that)
      const R = 5; for (let x = this.vox.x - R; x <= this.vox.x + R; x++) for (let y = this.vox.y - R; y <= this.vox.y + R; y++) for (let z = this.vox.z - R; z <= this.vox.z + R; z++) if (W.get(x, y, z) === M.BARR) W.breakVoxel(x, y, z);
      if (G.player && U.dist3(G.player.pos, p) < 7) PLAYER.shake(0.35);
      if (window.VOICE && a) VOICE.say(a, 'feint');
      this.destroy('used');
    }
  }
  OPS3.Feint = Feint;
  OPS2.ABIL.feint = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 1.8);
    if (!h || h.md.see) { GAD.tell(a, 'Stick it to a wall, a hatch or a barricade'); return false; }
    new Feint(a, h); return spend();
  };

  /* ================================================================= GLINT */
  /* a strip of retroreflective tape: whatever lens looks at it within 15 m (an optic aimed at it,
     a drone or rotor camera, a flank cam, a corner mirror) flashes back. The defense sees a glint
     where the watcher is (not a mark: just "someone is looking from there") */
  OPS3.glints = [];
  const optic = b => { const s = b.wpn && b.wpn.def && b.wpn.def.sight; return s && s !== 'iron'; };
  class Tape extends Ent {
    constructor(a, p, n) { super('tape', a, p, { model: 'tape', normal: n, hp: 1, hitR: 0.07 }); this.cd = new Map(); this.scan = 0; this.told = 0; this.blastproof = false; }
    update(dt) {
      this.t += dt; if ((this.scan -= dt) > 0) return; this.scan = 0.2;
      const p = this.pos, W = G.world;
      const sees = (e, f, cosMax) => { const to = p.clone().sub(e), L = to.length(); if (L > 15 || L < 0.3) return false; to.divideScalar(L); if (f && to.dot(f) < cosMax) return false; return W.los(e, p.clone().addScaledVector(this.normal, 0.05)); };
      for (const b of G.actors) if (b.state === 'alive' && b.team !== this.team && !b.hostage && b.ads > 0.6 && optic(b) && sees(b.eye(V()), b.fwd(V()), 0.94)) this.glint(b.eye(V()), b, b);
      for (const e of G.ents) {
        if (!e.alive || e.team === this.team || e.team < 0) continue;
        if (e.type === 'drone' && (e.pilot || e.auto) && sees(e.eye(), e.fwd(), 0.7)) this.glint(e.pos, e, e.owner);
        else if (e.type === 'flankcam' && sees(e.pos, e.normal, 0.5)) this.glint(e.pos, e, e.owner);
        else if (e.type === 'mirror' && sees(e.pos, null)) this.glint(e.pos, e, e.owner);
      }
    }
    glint(at, key, who) {
      if (G.time < (this.cd.get(key) || 0)) return;
      this.cd.set(key, G.time + 2.5);
      OPS3.glints.push({ p: at.clone(), t: G.time, team: this.team });
      if (OPS3.glints.length > 30) OPS3.glints.splice(0, OPS3.glints.length - 30);
      if (G.time > this.told) { this.told = G.time + 6; GAD.tellTeam(this.team, 'GLINT: a lens is on your tape'); if (window.VOICE && this.owner && this.owner.state === 'alive') VOICE.say(this.owner, 'intel'); }
      if (key && key.pos) GAME.intel(key, this.team, 25);   // (their bots turn to look)
    }
  }
  OPS2.ABIL.tape = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.2);
    if (!h || h.md.see) { GAD.tell(a, 'Stick it to a wall, a floor or a ceiling'); return false; }
    new Tape(a, h.p, h.n); return spend();
  };
  OPS3.placeTape = (a, p, n) => new Tape(a, p, n);

  /* ================================================================= CHAFF */
  class ChaffCan extends Proj {
    constructor(a) {
      super('chaffcan', a, GAD.throwStart(a), GAD.throwVel(a, 11), { hp: 1, fuse: 2.2 });
      this.onLand = () => { if (this.fuse > 0.25) this.fuse = 0.25; };
      this.onFuse = () => { new ChaffCloud(this.owner, this.pos.clone()); this.destroy('used'); };
    }
  }
  class ChaffCloud extends Ent {
    constructor(a, p) {
      super('chaffcloud', a, p, { model: false, hp: 999, hitR: 0, melee: false });
      this.model = 'chaffcloud'; this.r = 6; this.life = 25; this.blastproof = true; this.meleeable = false;
      this.mesh = OPS3.chaffMesh(this.r); this.mesh.position.copy(p); G.scene.add(this.mesh);
      SFX.whoosh(p); GAME.noise(p, 14, a, 'gadget');
    }
    update(dt) {
      this.t += dt;
      if (Math.random() < dt * 14) { const q = this.pos.clone().add(V().set((Math.random() - 0.5) * this.r * 1.6, (Math.random() - 0.3) * 2.4, (Math.random() - 0.5) * this.r * 1.6)); FX.burst(q, 0xdde6f4, 1, 0.2, 0.025, 0.8, 0.1); }
      if (this.t > this.life) this.destroy('used');
    }
  }
  OPS3.chaffMesh = r => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshBasicMaterial({ color: 0xa8b0bc, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  OPS2.ABIL.chaff = (a, ab, need, spend) => { if (!need()) return false; new ChaffCan(a); return spend(); };
  OPS3.clouds = () => G.ents.filter(e => e.alive && e.type === 'chaffcloud' && e.r);
  OPS3.inChaff = p => OPS3.clouds().some(c => U.dist3(c.pos, p) < c.r);
  /* does a device looking from e to c see through a cloud? (a segment-sphere test) */
  OPS3.chaffBlocks = function (e, c) {
    for (const cl of OPS3.clouds()) {
      const d = c.clone().sub(e), L = d.length(); if (L < 0.01) continue; d.divideScalar(L);
      const m = cl.pos.clone().sub(e), t = U.clamp(m.dot(d), 0, L), q = e.clone().addScaledVector(d, t);
      if (q.distanceTo(cl.pos) < cl.r * 0.92) return true;
    }
    return false;
  };
  OPS2.deviceBlocks = (e, c) => OPS3.chaffBlocks(e, c);
  // marks and pings don't land on anyone standing in chaff
  const oMark = GAME.mark;
  GAME.mark = function (t, team) { if (t && t.isActor !== false && t.center && OPS3.inChaff(t.center(V()))) return; return oMark.apply(this, arguments); };
  /* how a cloud looks to whoever is watching: to an eye, a faint glitter; through a camera, a drone,
     a rotor or a magnified scope, a wall of static */
  OPS3.chaffLook = function () {
    const P = PLAYER, a = G.player, cls = OPS3.clouds(); if (!cls.length) return;
    const device = P.view === 'drone' || P.view === 'cams' || (P.view === 'spectate' && P.spec && P.specDrone && P.specDrone(P.spec));
    const scoped = a && P.view === 'body' && a.ads > 0.6 && a.wpn && ['acog', 'scope4', 'var'].includes(a.wpn.def.sight);
    const dense = device || scoped, flick = 0.85 + Math.random() * 0.15;
    for (const c of cls) { const m = c.mesh && c.mesh.material; if (!m) continue; m.opacity = dense ? 0.94 : 0.05; m.color.setScalar(dense ? 0.55 * flick : 0.66); }
  };

  /* ================================================================= BLUFF */
  /* decoys: a C4, a camera, an alarm, a sensor, in turn. They look and scan like the real thing (an EMP
     doesn't kill them: there's nothing inside), and whoever shoots or strikes one is marked for 4 s */
  const KINDS = ['c4', 'cam', 'alarm', 'sensor'];
  class Bluff extends Ent {
    constructor(a, kind, p, n) {
      super('bluff', a, p, { model: kind, normal: n, hp: 1, hitR: kind === 'cam' ? 0.16 : 0.12 });
      this.kind = kind; this.scanAs = kind; this.blastproof = false;
      if (kind === 'cam' && this.mesh) { this.mesh.rotation.set(0, Math.atan2(n.x, n.z) + Math.PI, 0); }
    }
    shot(dmg, src) { this.caught(src); this.destroy('shot'); }
    destroy(w) { if (w === 'melee' && OPS3.cause) this.caught(OPS3.cause); super.destroy(w); }
    caught(src) {
      if (!src || !src.op || !src.center || src.team === this.team || this.done) return;
      this.done = true; GAME.mark(src, this.team, 4, true);
      GAD.tellTeam(this.team, 'DECOY HIT: the shooter is marked');
      if (window.VOICE && this.owner && this.owner.state === 'alive') VOICE.say(this.owner, 'intel');
    }
  }
  OPS3.placeBluff = (a, kind, p, n) => new Bluff(a, kind, p, n);
  OPS2.ABIL.bluffkit = (a, ab, need, spend) => {
    if (!need()) return false;
    const kind = KINDS[(a.op.ability.count - ab.count) % KINDS.length];
    if (kind === 'c4') { const p = GAD.floorAhead(a, 1.0); if (!p) { GAD.tell(a, 'Clear floor in front of you'); return false; } new Bluff(a, kind, p, V().set(0, 1, 0)); }
    else { const h = GAD.aim(a, 2.6); if (!h || h.md.see) { GAD.tell(a, 'Look at a wall or a ceiling'); return false; } new Bluff(a, kind, h.p, h.n); }
    GAD.tell(a, 'Decoy ' + kind.toUpperCase() + ' placed' + (ab.count > 1 ? ' · next: ' + KINDS[(a.op.ability.count - ab.count + 1) % KINDS.length].toUpperCase() : ''));
    return spend();
  };

  /* ============================================================ per frame */
  OPS2.chain('hudFrame', function (a, dt) {
    for (const b of G.actors) { const want = b.dyeT > G.time && b.state !== 'dead'; if (!!b._dyed !== want) dyeLook(b, want); }
    OPS3.chaffLook();
    // a guest's own mirror: where it is, for the camera
    if (a && a.mirror && GAME.client) a.mirror.pos = OPS3.mirrorPos(a);
  });
  OPS2.chain('tick', function (a, dt) {
    if (a.mirror) {
      a.trigger = false; a.adsWant = false; a.ads = 0;
      if (a.bot && a.bot.mirrorEnd && G.time > a.bot.mirrorEnd) { a.bot.mirrorEnd = 0; OPS3.endMirror(a); }
    }
  });

  /* ============================================================== guests */
  OPS2.chain('guestEvent', function (e) {
    if (e.k === 'dye') { const b = NP.byId && NP.byId.get(e.a); if (b) b.dyeT = e.t ? G.time + e.t : 0; return true; }
    const me = G.player; if (!me || e.to !== NP.me) return;
    if (e.k === 'mirror') { me.mirror = e.on ? { side: e.s || 1, t: G.time } : null; if (me.mirror) me.mirror.pos = OPS3.mirrorPos(me); return true; }
  });
  OPS2.chain('entRec', function (e, x) { if (e.type === 'chaffcloud') x.cr = e.r; if (e.scanAs) x.sa = e.scanAs; });
  OPS2.chain('mirrorSet', function (m, x) {
    if (m.type === 'chaffcloud' && x.cr && !m.built) { m.built = true; m.r = x.cr; const mesh = OPS3.chaffMesh(x.cr); mesh.position.copy(m.pos); G.scene.add(mesh); (m.extra || (m.extra = [])).push(mesh); m.mesh2 = mesh; }
    if (x.sa) m.scanAs = x.sa;
  });
  OPS2.chain('mirrorFx', function (m, dt) { if (m.type === 'chaffcloud' && m.mesh2) { m.mesh = m.mesh2; } });

  /* ================================================================= HUD */
  OPS2.chain('status', function (a) {
    if (a.dyeT > G.time) return 'DYED ' + Math.ceil(a.dyeT - G.time) + 's · you stand out (water washes it off)';
    if (a.mirror) return 'CORNER MIRROR · you can\'t shoot · ' + KEYS.fmt('{ability} to put it away');
    return '';
  });
  OPS2.chain('hudCount', function (a) {
    if (!a.ability) return null;
    if (a.ability.id === 'mirror') return a.mirror ? 'IN USE' : G.time < (a.mirrorLock || 0) ? Math.ceil(a.mirrorLock - G.time) + 's' : 'READY';
    if (a.ability.id === 'bluffkit' && a.ability.count > 0) return a.ability.count + ' · ' + KINDS[(a.op.ability.count - a.ability.count) % KINDS.length].toUpperCase();
    return null;
  });
  OPS2.chain('markers', function (a, put, jam) {
    if (G.mode !== 'match' || jam) return;
    for (const g of OPS3.glints) if (g.team === a.team && G.time - g.t < 2.5) put(g.p.clone(), 'mk-ring a1', '✦');
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null, S = c.S;
    const fresh = S && S.known && G.time - S.kt < 4;
    // Stain: dye where the defense was last seen, a room away
    if (ab.id === 'dye' && ab.count > 0 && !t && fresh && G.time > (b.dyeT || 0)) {
      const d = U.dist3(a.pos, S.known);
      if (d > 5 && d < 16) { b.dyeT = G.time + 10; AI.lobAt(a, S.known); GAD.ability(a); return true; }
    }
    // Glance: a mirror round the corner before going round it
    if (ab.id === 'mirror' && !t && !a.mirror && G.time > (b.mirT || 0) && G.time > (a.mirrorLock || 0) && (fresh ? U.dist3(a.pos, S.known) < 18 : c.obj && U.dist3(a.pos, c.obj) < 16)) {
      b.mirT = G.time + 6 + Math.random() * 4; OPS3.mirrorPeek(a); return true;
    }
    // Chaff: a cloud on an enemy drone poking about near her
    if (ab.id === 'chaff' && ab.count > 0 && !t && G.time > (b.chaffT || 0)) {
      const d = G.ents.find(e => e.alive && e.type === 'drone' && e.team !== a.team && U.dist3(e.pos, a.pos) < 14 && G.world.los(a.eye(V()), e.pos));
      if (d) { b.chaffT = G.time + 20; AI.lobAt(a, d.pos); GAD.ability(a); return true; }
    }
    // Feint: one more fake breach once the push is on, away from where the team is going in
    if (ab.id === 'feint' && ab.count > 0 && !t && !b.entered && c.obj && U.dist3(a.pos, c.obj) < 14 && G.time > (b.feintT || 0)) {
      b.feintT = G.time + 20; const h = GAD.aim(a, 1.8); if (h && !h.md.see) { GAD.ability(a); return true; }
    }
    return false;
  });
  OPS2.chain('aiPlanAtk', function (a, plan, c) {
    const { b, id } = c;
    if (id === 'feint') {
      // a fake breach on the site wall furthest from the team's way in: the defense rotates to it
      const E = plan.entries && plan.entries[0], main = E && (E.at || E.pos || (E.op && GAD.opCenter(E.op)));
      let best = null, bs = -1e9;
      for (const p of plan.rooms.flatMap(rm => AI.roomPanels(rm))) {
        const inward = V().set(p.stand.x - p.look.x, 0, p.stand.z - p.look.z).normalize();
        const out = p.look.clone().addScaledVector(inward, -0.9); out.y = p.room.fy;
        if (!NAV.walkable(out)) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 1) continue;
        let L = 0; for (let i = 1; i < pth.length; i++) L += pth[i].distanceTo(pth[i - 1]);
        const sc = (main ? Math.min(U.dist3(out, main), 20) : 0) - L;   // (away from the real entry, but not a long walk)
        if (sc > bs) { bs = sc; best = { p, out }; }
      }
      if (best) {
        const aim = best.p.look.clone().setY(best.p.room.fy + 1.0);
        b.tasks.unshift({ at: best.out, look: aim, time: 0.5, hurry: true, maxTravel: 50, run: x => { AI.faceTo(x, aim, 1, 99); x.pitch = -0.1; GAD.ability(x); } });
      }
    }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b, ents } = c, id = a.ability ? a.ability.id : null, W = G.world;
    const inwardOf = op => { const cc = GAD.opCenter(op), rr = plan.rooms.find(x => x.L === op.L) || plan.rooms[0]; const inw = V().set(rr.cx - cc.x, 0, rr.cz - cc.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; return { cc, rr, inw: inw.normalize() }; };
    if (id === 'tape') {
      // tape on the far wall of the site, where anyone looking in through a way in looks
      let n = 0;
      for (const op of ents) {
        if (n >= 3) break;
        const { cc, rr, inw } = inwardOf(op), e0 = cc.clone().setY(rr.fy + 1.4);
        const h = W.raycast(e0, inw, 12); if (!h || h.dist < 3) continue;
        const hit = V().set(h.px, h.py, h.pz), st = hit.clone().addScaledVector(inw, -1.2); st.y = rr.fy;
        if (!NAV.walkable(st)) continue;
        n++;
        b.tasks.unshift({ at: st, look: hit, time: 0.5, run: x => { AI.faceTo(x, hit, 1, 99); x.pitch = Math.atan2(hit.y - (x.pos.y + x.eyeH), Math.hypot(hit.x - x.pos.x, hit.z - x.pos.z)); if (x.ability.count <= 0) return; const g = GAD.aim(x, 2.2); if (g && !g.md.see) { OPS3.placeTape(x, g.p, g.n); x.ability.count--; } } });
      }
    }
    if (id === 'chaff') {
      // a cloud in the way in the drones come through, early in the drone phase
      const op = ents[0]; if (op) { const { cc, rr, inw } = inwardOf(op), st = cc.clone().addScaledVector(inw, 2.0); st.y = rr.fy; b.tasks.unshift({ at: st, look: cc, time: 0.4, run: x => { if (x.ability.count <= 0) return; AI.faceTo(x, cc, 1, 99); x.pitch = 0.1; new ChaffCan(x); x.ability.count--; } }); }
    }
    if (id === 'bluffkit') {
      // a fake alarm and sensor beside two ways in, a fake camera up by a third, a fake C4 on the site floor
      let k = 0;
      for (const op of ents.slice(0, 3)) {
        const { cc, rr, inw } = inwardOf(op), side = V().set(-inw.z, 0, inw.x), half = ((op.a1 - op.a0 + 1) * 0.25) / 2;
        const kind = ['alarm', 'sensor', 'cam'][k++];
        const p = cc.clone().addScaledVector(side, half + 0.45).addScaledVector(inw, 0.13); p.y = rr.fy + (kind === 'cam' ? 2.3 : 1.15);
        if (W.get(Math.floor(p.x * 4 - inw.x), Math.floor(p.y * 4), Math.floor(p.z * 4 - inw.z)) === 0) continue;   // (no wall there)
        const st = cc.clone().addScaledVector(inw, 1.1); st.y = rr.fy;
        b.tasks.unshift({ at: st, look: p, time: 0.5, run: x => { if (x.ability.count <= 0) return; OPS3.placeBluff(x, kind, p, inw); x.ability.count--; } });
      }
      const rm = plan.rooms[0], q = NAV.randomIn(rm);
      if (q) b.tasks.unshift({ at: q, time: 0.5, run: x => { if (x.ability.count <= 0) return; OPS3.placeBluff(x, 'c4', x.pos.clone().add(V().set(0.5, 0.01, 0)), V().set(0, 1, 0)); x.ability.count--; } });
    }
  });
  /* ============================================================= voices */
  if (window.VOICE) {
    VOICE.add('stain', {
      pick: ['Raghunathan. Everyone I hit, you will see.', 'Hide all you like. Orange is not a hiding colour.'],
      round: ['Find them and I will paint them.', 'Let us make this easy for everyone.', 'Colours ready.'],
      ability: ['Dye out!', 'Painting the room.', 'Let\'s see you hide now.'],
      kill: ['Easy to see, easy to hit.', 'Orange suits you.', 'Done.'],
      spot: ['Orange one, there!', 'I see the painted one!'],
      reload: ['Reloading.', 'One moment, reloading.'], hurt: ['Hit! I\'m fine.', 'They got me.'], down: ['I\'m down, come quickly!', 'Down. Hurry, please.'],
      lost: ['We lost one. Focus.', 'Man down.'], win: ['Clean work, everyone.', 'Exactly as planned.'], lose: ['We were sloppy.', 'Not good enough.'],
    });
    VOICE.add('glance', {
      pick: ['Doherty. Look first, shoot second.', 'I\'ll tell you what\'s round the corner.'],
      round: ['Nobody turns a corner blind. Wait for me.', 'Quiet and slow.', 'I\'ll have a peek.'],
      ability: ['Mirror out.', 'Having a look.', 'Let\'s see now.'],
      kill: ['Saw you first.', 'Should\'ve had a mirror.', 'There you go.'],
      spot: ['One round the corner!', 'Seen one in the mirror!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Ah, feck. Hit.', 'I\'m hit.'], down: ['Down! Mind the corner!', 'I\'m down.'],
      lost: ['We lost one.', 'Man down. Careful now.'], win: ['Grand.', 'That\'s us.'], lose: ['Ah well.', 'They saw us coming.'],
    });
    VOICE.add('feint', {
      pick: ['Moreira! Watch the left hand. No, the other one.', 'Showtime.'],
      round: ['Ladies and gentlemen, look over there!', 'I make the noise, you make the entry.', 'Let\'s give them a show.'],
      ability: ['Charge set. Or is it?', 'Ta-da... in three.', 'Big bang coming!'],
      feint: ['And they all ran the wrong way!', 'Abracadabra.', 'Nothing up my sleeve.'],
      kill: ['Surprise!', 'Wrong wall, my friend.', 'Obrigado.'],
      spot: ['There! They fell for it!', 'Contact!'],
      reload: ['Reloading, hold applause.', 'Mag!'], hurt: ['Ai! That was real!', 'Hit!'], down: ['I\'m down... not part of the act!', 'Down!'],
      lost: ['We lost one. Keep the show going!', 'Man down!'], win: ['Thank you, thank you!', 'Encore!'], lose: ['Tough crowd.', 'The trick didn\'t land.'],
    });
    VOICE.add('glint', {
      pick: ['Mokoena. If they look at it, I see them.', 'Every lens shines in the right light.'],
      round: ['Tape is up. Let them look.', 'Patience. They always look.', 'Shh. Let them come and peek.'],
      ability: ['Tape on.', 'There. Shiny.', 'Strip down.'],
      intel: ['Glint! Somebody\'s watching from there.', 'A lens, out there. They\'re looking in.', 'I caught a reflection.'],
      kill: ['I saw you looking.', 'Sharp eyes, slow hands.', 'Got you.'],
      spot: ['Contact, there.', 'Eyes on.'],
      reload: ['Reloading.', 'Mag change.'], hurt: ['Eish, I\'m hit.', 'Hit.'], down: ['I\'m down. Somebody...', 'Down.'],
      lost: ['We lost one. Stay calm.', 'One down.'], win: ['Lekker.', 'Good hunting.'], lose: ['Next time.', 'They were careful.'],
    });
    VOICE.add('chaff', {
      pick: ['Lindgren. Your camera is useless here.', 'Use your eyes. If you remember how.'],
      round: ['Cloud is ready. Let them fly their toys.', 'Drones incoming. Good.', 'Stay calm and watch.'],
      ability: ['Chaff out.', 'Cloud up. Blind them.', 'There. Static.'],
      kill: ['No camera can save you.', 'Down.', 'Efficient.'],
      spot: ['Contact.', 'There, one.'],
      reload: ['Reloading.', 'Changing.'], hurt: ['I\'m hit.', 'Hit, still fine.'], down: ['I\'m down.', 'Down. Help.'],
      lost: ['We lost one.', 'One down. Hold.'], win: ['Good.', 'As expected.'], lose: ['Unfortunate.', 'They adapted.'],
    });
    VOICE.add('bluff', {
      pick: ['El Amrani. Everything here is real. Probably.', 'Go on. Shoot the camera.'],
      round: ['My props are in place. Now the audience.', 'Let them find my little gifts.', 'Shh. Let\'s see who bites.'],
      ability: ['Prop placed.', 'There. Very convincing.', 'One more for the collection.'],
      intel: ['Ha! They shot the fake. I see them!', 'Someone bit. Marked!', 'Got a nibble.'],
      kill: ['That one was real.', 'Surprise.', 'Good night.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag!'], hurt: ['Ah! Real bullets!', 'Hit!'], down: ['I\'m down, my friends!', 'Down!'],
      lost: ['We lost one. Stay sharp.', 'Man down.'], win: ['Beautiful work.', 'The show was a success.'], lose: ['They saw through it.', 'Hm. Next time.'],
    });
  }
})();
