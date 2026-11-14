/* gadgets.js -- every deployable: secondary gadgets, operator abilities, drones,
   cameras, the defuser and the biohazard container. Entities live in G.ents. */
(function () {
  'use strict';
  const { MAT, M, OOB } = DATA;
  const GAD = { nidc: 0 };
  GAD.tell = (a, x, c) => { if (window.NP) NP.tell(a, x, c); else if (a && a.isPlayer) HUD.toast(x, c); };
  GAD.tellTeam = (team, x, alarm) => { if (window.NP) NP.tellTeam(team, x, alarm); };
  const V = () => new THREE.Vector3();
  const ELEC = new Set(['cam', 'bpcam', 'dampener', 'scrambler', 'sensor', 'seeker', 'snare', 'photon', 'claymore', 'beacon', 'drone', 'decoy', 'c4', 'rcharge', 'breach', 'floodlight', 'turret', 'jamfield', 'triang', 'nullfield', 'anchor', 'alarm', 'fog']);
  const TRAPS = new Set(['snare', 'wire', 'sensor', 'c4', 'rcharge', 'dampener', 'scrambler', 'seeker', 'decoy', 'bpcam', 'cam', 'floodlight', 'turret', 'jamfield', 'nullfield', 'anchor', 'mannequin', 'alarm', 'fog']);
  const NAMES = { alarm: 'Proximity alarm', fog: 'Fog canister', emp: 'EMP grenade',  turret: 'Watchdog turret', jamfield: 'Misfire coil', triang: 'Triangulator', nullfield: 'Null field', anchor: 'Recall anchor', mannequin: 'Body double', cam: 'Camera', bpcam: 'Armored camera',
    snare: 'Snare line', sensor: 'Proximity sensor', scrambler: 'Scrambler', dampener: 'Dampener', seeker: 'Hunter seeker', floodlight: 'Floodlight', c4: 'Detonator pack', rcharge: 'Rotation charge', decoy: 'Decoy emitter', claymore: 'Claymore', beacon: 'Field beacon' };
  GAD.nameOf = e => NAMES[e.type] || e.type;
  GAD.ELEC = ELEC; GAD.NAMES = NAMES;
  /* meshes for gadgets that models.js has no builder for (the season 2 and 3 kit); online
     guests build theirs the same way, through GAD.mesh */
  const EXTRA = {
    floodlight: g => {
      for (const [x, z] of [[-6, 4], [6, 4], [0, -6]]) g.box(x, 0, z, x, 30, z, 0x3a3f45);
      g.box(-1, 28, -1, 1, 40, 1, 0x3a3f45);
      g.box(-6, 40, -3, 6, 50, 3, 0x2a2c30); g.box(-5, 41, -4, 5, 49, -4, MD.glow(0xfff6c8));
    },
    foam: g => { g.box(-2, -2, -3, 2, 2, 3, 0x6a8f7a); g.box(-1, -1, -4, 1, 1, -4, 0xd9cf9e); },
    irritant: g => { g.box(-2, -2, -2, 2, 3, 2, 0x8a7a2a); g.box(-1, 4, -1, 1, 4, 1, 0x333333); },
    // ---- seasons 4-9
    turret: g => {
      for (const [x, z] of [[-7, 5], [7, 5], [0, -8]]) g.box(x, 0, z, x, 14, z, 0x33363c);
      g.box(-2, 12, -2, 2, 20, 2, 0x2a2c30);
      g.box(-5, 20, -5, 5, 27, 6, 0x4a1a26); g.box(-4, 21, -6, 4, 26, -6, 0x2a2c30);
      g.box(-1, 22, -16, 1, 24, -6, 0x1a1c20); g.box(-3, 25, -7, -2, 26, -7, MD.glow(0xff3050));
      g.box(4, 21, 0, 6, 25, 5, 0x6a6e76);
    },
    jamfield: g => {
      g.box(-5, 0, -5, 5, 2, 5, 0x3a3026);
      for (let y = 3; y <= 15; y += 3) { g.box(-4, y, -4, 4, y + 1, 4, 0xb87333); g.box(-3, y, -3, 3, y + 1, 3, 0x000000); }
      for (let y = 3; y <= 16; y++) g.box(-1, y, -1, 1, y, 1, 0x6a6e76);
      g.box(-2, 17, -2, 2, 19, 2, MD.glow(0xffa040));
    },
    triang: g => {
      for (const [x, z] of [[-6, 4], [6, 4], [0, -7]]) g.box(x, 0, z, x, 18, z, 0x33363c);
      g.box(-1, 16, -1, 1, 30, 1, 0x4a5058);
      g.box(-7, 30, -1, 7, 31, 1, 0x2e3e3a); g.box(-7, 32, 0, -7, 36, 0, 0x2e3e3a); g.box(7, 32, 0, 7, 36, 0, 0x2e3e3a); g.box(0, 32, 0, 0, 38, 0, 0x2e3e3a);
      g.box(-1, 26, -2, 1, 28, -2, MD.glow(0x7ce8c0));
    },
    nullfield: g => {
      g.box(-7, 0, -7, 7, 2, 7, 0x26342f); g.box(-5, 3, -5, 5, 3, 5, 0x1a2420);
      for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) g.box(x, 3, z, x, 9, z, MD.glow(0x7ce8c0));
      g.box(-1, 4, -1, 1, 12, 1, 0x3a5048); g.box(-2, 13, -2, 2, 14, 2, MD.glow(0x7ce8c0));
    },
    emp: g => { g.box(-2, -3, -2, 2, 3, 2, 0x26344e); g.box(-2, 0, -2, 2, 0, 2, MD.glow(0x5ad8ff)); g.box(-1, 4, -1, 1, 5, 1, 0x8a9098); },
    fog: g => { g.box(-2, -4, -2, 2, 4, 2, 0x6f7f86); g.box(-2, 2, -2, 2, 2, 2, 0xd9dde0); g.box(-1, 5, -1, 1, 5, 1, MD.glow(0x9fe0ff)); },
    alarm: g => { g.box(-3, -3, -1, 3, 3, 1, 0x2e3238); g.box(-1, -1, -2, 1, 1, -2, MD.glow(0xff5040)); g.box(-3, 4, 0, -3, 8, 0, 0x6a6e76); },
    anchor: g => {
      g.box(-1, 0, -1, 1, 14, 1, 0x2a4a60); g.box(-5, 2, -1, 5, 3, 1, 0x2a4a60); g.box(-5, 4, -1, -5, 6, 1, 0x2a4a60); g.box(5, 4, -1, 5, 6, 1, 0x2a4a60);
      g.box(-2, 14, -1, 2, 16, 1, 0x2a4a60); g.box(-1, 17, -1, 1, 18, 1, MD.glow(0x7cd0ff));
    },
  };
  const extraGeo = new Map();
  GAD.EXTRA = EXTRA;
  /* MESH_FN: gadgets whose mesh isn't voxels (a pool of slick, a hologram): a function that makes one */
  GAD.MESH_FN = {};
  GAD.mesh = function (model) {
    if (GAD.MESH_FN[model]) return GAD.MESH_FN[model]();
    if (!EXTRA[model]) return MD.gadget(model);
    if (!extraGeo.has(model)) { const g = new MD.Grid(); EXTRA[model](g); extraGeo.set(model, MD.mesh(g, 1 / 32)); }
    return new THREE.Mesh(extraGeo.get(model), new THREE.MeshBasicMaterial({ vertexColors: true }));
  };

  /* ===================================================================== base */
  class Ent {
    constructor(type, owner, pos, o) {
      o = o || {};
      this.type = type; this.owner = owner || null; this.team = owner ? owner.team : (o.team == null ? -1 : o.team);
      this.pos = pos.clone(); this.alive = true; this.t = 0;
      this.hp = o.hp == null ? 1 : o.hp; this.hitR = o.hitR == null ? 0.14 : o.hitR;
      this.elec = ELEC.has(type); this.meleeable = o.melee !== false; this.bulletproof = !!o.bulletproof;
      this.normal = o.normal ? o.normal.clone() : new THREE.Vector3(0, 1, 0);
      this.mesh = null; this.nid = ++GAD.nidc; this.model = o.model || type;
      if (o.model !== false) {
        this.mesh = GAD.mesh(o.model || type);
        this.mesh.position.copy(this.pos);
        if (o.upright) this.mesh.rotation.y = o.yaw || 0;
        else if (this.normal.y > 0.7) { this.mesh.rotation.x = -Math.PI / 2; this.mesh.rotation.z = o.yaw || 0; }
        else this.mesh.lookAt(this.pos.clone().sub(this.normal));
        G.scene.add(this.mesh);
      }
      G.ents.push(this);
    }
    update(dt) { this.t += dt; }
    shot(dmg, src) { if (this.bulletproof) return; this.hp -= dmg; if (this.hp <= 0) this.destroy('shot', src); }
    destroy(why) {
      if (!this.alive) return;
      this.alive = false;
      if (this.mesh) G.scene.remove(this.mesh);
      if (this.loop) this.loop.stop();
      if (why !== 'silent' && why !== 'used') { FX.sparks(this.pos, this.normal.x, this.normal.y, this.normal.z, this.elec ? 0x9ad8ff : 0xffd080); SFX.impact(this.pos, false); }
      if (this.onDestroy) this.onDestroy(why);
    }
  }
  GAD.Ent = Ent;

  /* thrown things */
  class Proj extends Ent {
    constructor(type, owner, pos, vel, o) {
      super(type, owner, pos, Object.assign({ hitR: 0.1, model: o.model || type }, o));
      this.vel = vel.clone(); this.g = o.g == null ? 1 : o.g; this.sticky = !!o.sticky; this.stuck = false; this.fuse = o.fuse == null ? -1 : o.fuse;
      this.interceptable = owner && owner.side === 'atk' && o.intercept !== false; this.impact = !!o.impact; this.landed = false;
      this.onStick = o.onStick; this.onFuse = o.onFuse; this.onLand = o.onLand; this.passOwner = true;
      SFX.throwS(pos);
    }
    update(dt) {
      this.t += dt;
      if (!this.stuck) {
        const W = G.world, sp = this.vel.length(), n = Math.max(1, Math.ceil(sp * dt / 0.08));
        for (let i = 0; i < n && !this.stuck; i++) {
          const h = dt / n;
          this.vel.y -= 18 * this.g * h;
          const nx = this.pos.x + this.vel.x * h, ny = this.pos.y + this.vel.y * h, nz = this.pos.z + this.vel.z * h;
          if (W.get(Math.floor(nx * 4), Math.floor(ny * 4), Math.floor(nz * 4))) {
            const nrm = V();
            if (W.get(Math.floor(nx * 4), Math.floor(this.pos.y * 4), Math.floor(this.pos.z * 4))) nrm.x = -Math.sign(this.vel.x);
            else if (W.get(Math.floor(this.pos.x * 4), Math.floor(ny * 4), Math.floor(this.pos.z * 4))) nrm.y = -Math.sign(this.vel.y);
            else nrm.z = -Math.sign(this.vel.z);
            if (!nrm.lengthSq()) nrm.y = 1;
            this.normal.copy(nrm);
            if (this.impact) { this.stuck = true; this.trigger(); return; }
            if (this.sticky) {
              this.stuck = true; this.vel.set(0, 0, 0);
              if (this.mesh) { if (nrm.y > 0.7) { this.mesh.rotation.set(-Math.PI / 2, 0, 0); } else this.mesh.lookAt(this.pos.clone().sub(nrm)); }
              this.stickVox = { x: Math.floor((this.pos.x - nrm.x * 0.1) * 4), y: Math.floor((this.pos.y - nrm.y * 0.1) * 4), z: Math.floor((this.pos.z - nrm.z * 0.1) * 4) };
              if (this.onStick) this.onStick(this);
            } else {
              if (nrm.x) this.vel.x *= -0.35; if (nrm.y) this.vel.y *= -0.3; if (nrm.z) this.vel.z *= -0.35;
              this.vel.multiplyScalar(0.7);
              if (nrm.y > 0 && Math.abs(this.vel.y) < 1) { this.vel.y = 0; this.vel.x *= 0.8; this.vel.z *= 0.8; if (!this.landed) { this.landed = true; if (this.onLand) this.onLand(this); } }
              if (Math.random() < 0.5) SFX.impact(this.pos, true);
            }
          } else this.pos.set(nx, ny, nz);
          // impact grenades hit bodies too
          if (this.impact && this.t > 0.08) for (const a of G.actors) if (a.state !== 'dead' && a !== this.owner && U.dist3(a.center(V()), this.pos) < 0.45) { this.stuck = true; this.trigger(); return; }
        }
        if (this.mesh) { this.mesh.position.copy(this.pos); if (!this.stuck) { this.mesh.rotation.x += dt * 8; this.mesh.rotation.y += dt * 5; } }
      } else if (this.stickVox && !G.world.get(this.stickVox.x, this.stickVox.y, this.stickVox.z)) { this.stuck = false; this.stickVox = null; this.sticky = false; }
      if (this.fuse > 0) { this.fuse -= dt; if (this.fuse <= 0) { this.fuse = -1; if (this.onFuse) this.onFuse(this); } }
    }
    trigger() { if (this.onFuse) this.onFuse(this); }
  }
  GAD.Proj = Proj;

  /* ================================================================ helpers */
  GAD.aim = function (a, maxD) {
    const e = a.eye(V()), f = a.fwd(V());
    const h = G.world.raycast(e, f, maxD || 2.2);
    if (!h || h.m === OOB) return null;
    h.p = new THREE.Vector3(h.px + h.nx * 0.03, h.py + h.ny * 0.03, h.pz + h.nz * 0.03);
    h.n = new THREE.Vector3(h.nx, h.ny, h.nz);
    h.md = MAT[h.m];
    return h;
  };
  GAD.floorAhead = function (a, dist) {
    const f = a.fwd(V()); f.y = 0; f.normalize();
    const p = a.pos.clone().addScaledVector(f, dist || 1.0); p.y += 0.6;
    if (G.world.boxHits(p.x - 0.15, p.y, p.z - 0.15, p.x + 0.15, p.y + 0.3, p.z + 0.15)) return null;
    if (!G.world.los(a.eye(V()), p)) return null;
    const gy = G.world.groundBelow(p.x, p.y, p.z);
    if (p.y - gy > 1.2) return null;
    return new THREE.Vector3(p.x, gy + 0.01, p.z);
  };
  GAD.throwVel = (a, speed, up) => a.fwd(V()).multiplyScalar(speed).add(new THREE.Vector3(0, up == null ? 2 : up, 0)).add(a.vel.clone().multiplyScalar(0.5));
  GAD.throwStart = a => a.eye(V()).addScaledVector(a.fwd(V()), 0.4);
  /* is there an enemy jammer of these kinds near p? */
  GAD.jammed = function (p, team, kinds, r) {
    for (const e of G.ents) if (e.alive && e.team !== team && kinds.includes(e.type) && !e.disabled && !(e.empT > G.time) && U.dist3(e.pos, p) < (r || e.jamR || 2.5)) return e;
    return null;
  };
  GAD.byType = t => G.ents.filter(e => e.alive && e.type === t);

  /* explosion: damage, voxels, gadgets */
  GAD.explode = function (p, r, dmg, owner, o) {
    o = o || {};
    FX.explosion(p, r * 0.6); SFX.explosion(p, r > 3, o.snd);
    if (o.voxR) { const n = G.world.explode(p.x, p.y, p.z, o.voxR, o.hard, 50); if (n) SFX.crumble(p, n); }
    for (const a of G.actors) {
      if (a.state === 'dead') continue;
      const c = a.center(V()), d = U.dist3(c, p);
      if (d > r) continue;
      if (d > 1.2 && !G.world.los(p, c)) continue;
      const k = Math.pow(1 - d / r, 1.15);
      a.hurt(Math.round(dmg * k), { src: owner, kind: 'explosion', dir: c.clone().sub(p).normalize() });
      if (a.isPlayer) PLAYER.shake(0.6 * k + 0.1); else if (a.net) NP.push({ k: 'shake', to: a.net, s: 0.6 * k + 0.1 });
    }
    if (G.player && U.dist3(G.player.pos, p) < r * 3) PLAYER.shake(0.25);
    for (const e of G.ents) if (e.alive && e.type !== 'defuser' && e.type !== 'biohazard' && e.type !== 'fire' && U.dist3(e.pos, p) < r * 0.7 && !e.blastproof) e.destroy('blast');
    GAME.noise(p, 70, owner, 'explosion');
  };
  /* flash: blinds anyone looking toward p within r */
  GAD.flash = function (p, r, ownerTeam, onlyEnemy, power) {
    for (const a of G.actors) {
      if (a.state !== 'alive' || a.hostage) continue;
      if (onlyEnemy && a.team === ownerTeam) continue;
      const e = a.eye(V()), d = U.dist3(e, p);
      if (d > r || !G.world.los(e, p) || FX.smokeBlocks(e, p)) continue;
      const to = p.clone().sub(e).normalize(), facing = to.dot(a.fwd(V()));
      const k = Math.min(1, (1 - d / r) * 1.3) * (facing > 0.3 ? 1 : facing > -0.3 ? 0.55 : 0.25) * (power || 1);
      a.blind = Math.max(a.blind, 4.5 * k); a.blindK = Math.max(a.blindK, k); a.deaf = Math.max(a.deaf, 3 * k);
      if (a.isPlayer) { HUD.flash(k); SFX.flashRing(k); } else if (a.net) NP.push({ k: 'flash', to: a.net, s: k });
    }
  };

  /* ====================================================== secondary gadgets */
  GAD.secondary = function (a) {
    const g = a.gadget; if (!g || a.state !== 'alive' || a.busy > 0) return false;
    // detonators first
    if (g.id === 'breach' || g.id === 'c4' || g.id === 'fog') {
      const mine = a.placed.find(e => e.alive && e.type === g.id && (e.stuck || e.type === 'breach'));
      if (mine) { mine.detonate(); return true; }
    }
    if (g.count <= 0) return false;
    const spend = () => { g.count--; a.busy = 0.45; return true; };
    switch (g.id) {
      case 'frag': new Proj('frag', a, GAD.throwStart(a), GAD.throwVel(a, 15), { fuse: 2.4, onFuse: s => { s.destroy('used'); GAD.explode(s.pos, 4.6, 165, a, { voxR: 0.7 }); } }); return spend();
      case 'smoke': new Proj('smoke', a, GAD.throwStart(a), GAD.throwVel(a, 13), { fuse: 1.6, onFuse: s => { GAD.smokeOf(a, s.pos, 3.8, 13); SFX.whoosh(s.pos); s.destroy('used'); } }); return spend();
      case 'stun': new Proj('stun', a, GAD.throwStart(a), GAD.throwVel(a, 15), { fuse: 1.4, onFuse: s => { FX.flash(s.pos, 6, 0.25); SFX.explosion(s.pos, false); GAD.flash(s.pos, 8, a.team, false); for (const b of G.actors) if (b.alive && U.dist3(b.pos, s.pos) < 4) b.stun = Math.max(b.stun, 2); GAME.noise(s.pos, 40, a, 'explosion'); s.destroy('used'); } }); return spend();
      case 'impact': new Proj('impact', a, GAD.throwStart(a), GAD.throwVel(a, 16, 1.5), { impact: true, onFuse: s => { s.destroy('used'); GAD.explode(s.pos, 2.4, 60, a, { voxR: 1.1 }); } }); return spend();
      case 'c4': { const p = new Proj('c4', a, GAD.throwStart(a), GAD.throwVel(a, 11), { sticky: true, hp: 1, intercept: false });
        p.detonate = () => { if (!p.alive) return; if (p.empT > G.time) { SFX.beep(p.pos, 400); GAD.tell(a, 'Detonator is dead: EMP'); return; } p.destroy('used'); GAD.explode(p.pos, 3.8, 190, a, { voxR: 0.9, snd: 'c4' }); };
        a.placed.push(p); return spend(); }
      case 'breach': {
        const h = GAD.aim(a, 2.0);
        if (!h || !h.md.xp || h.md.reinf) { GAD.tell(a, 'Breach charges need a soft wall, floor or barricade'); return false; }
        new Breach(a, h); return spend();
      }
      case 'claymore': { const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Claymore(a, p, a.yaw); return spend(); }
      // ---- the second kit
      case 'emp': new Proj('emp', a, GAD.throwStart(a), GAD.throwVel(a, 15), { fuse: 1.5, onFuse: s => { s.destroy('used'); GAD.emp(s.pos, 5, 12, a); } }); return spend();
      case 'stim': {
        if (a.hp >= a.maxHp) { GAD.tell(a, 'Already at full health'); return false; }
        a.heal(45); g.count--; a.busy = 1; a.busyLabel = 'STIM';
        SFX.beep(a.pos, 900, 0.25); GAD.tell(a, 'Stim shot: +45 health');
        return true;
      }
      case 'alarm': {
        const h = GAD.aim(a, 2.2), p = h && !h.md.see ? h.p : GAD.floorAhead(a, 0.9);
        if (!p) return false;
        new Alarm(a, p, h && !h.md.see ? h.n : V().set(0, 1, 0)); return spend();
      }
      case 'fog': fogCan(a, GAD.throwStart(a), GAD.throwVel(a, 11)); return spend();
      case 'wire': { const p = GAD.floorAhead(a, 1.2); if (!p) return false; new Wire(a, p, a.yaw); return spend(); }
      case 'dshield': { const p = GAD.floorAhead(a, 1.0); if (!p) return false; new DShield(a, p, a.yaw); return spend(); }
    }
    if (window.OPS2 && OPS2.GADG[g.id]) return OPS2.GADG[g.id](a, g, spend);
    return false;
  };
  /* a vision-blocking cloud that remembers whose it is */
  GAD.smokeOf = function (a, p, r, dur) { const c = FX.smoke(p, r, dur); if (c) c.team = a ? a.team : -1; return c; };

  /* a fog canister: thrown, it sticks; set off by its owner it floods the spot with fog */
  function fogCan(a, pos, vel, stuck) {
    const p = new Proj('fog', a, pos, vel, { sticky: true, hp: 1, intercept: false });
    if (stuck) { p.stuck = true; if (p.mesh) p.mesh.rotation.set(-Math.PI / 2, 0, 0); }
    p.detonate = () => {
      if (!p.alive) return;
      if (p.empT > G.time) { SFX.beep(p.pos, 400); GAD.tell(a, 'Canister is dead: EMP'); return; }
      p.destroy('used'); GAD.smokeOf(a, p.pos.clone().add(V().set(0, 0.4, 0)), 4.2, 13); SFX.whoosh(p.pos);
    };
    a.placed.push(p);
    return p;
  }
  /* An EMP burst: every electronic gadget of the other team within r goes dead for `secs`. It is
     not destroyed: GAD.update skips it until the time is up, and a camera reports nothing. */
  GAD.emp = function (p, r, secs, a) {
    let n = 0;
    for (const e of G.ents) {
      if (!e.alive || !e.elec || e.team === a.team || e.team < 0 || U.dist3(e.pos, p) > r) continue;
      e.empT = G.time + secs; n++;
      FX.sparks(e.pos, e.normal.x, e.normal.y, e.normal.z, 0x9ad8ff);
    }
    FX.puff(p, 1.8, 0.5, 0x9ad8ff); FX.sparks(p, 0, 1, 0, 0x9ad8ff); SFX.beep(p, 220, 0.7); SFX.impact(p, false);
    GAME.noise(p, 22, a, 'emp');
    GAD.tell(a, n ? 'EMP: ' + n + ' device' + (n > 1 ? 's' : '') + ' knocked out for ' + secs + ' s' : 'EMP: nothing in range');
    if (n && !GAME.ffa) GAD.tellTeam(1 - a.team, 'EMP: ' + n + ' of your devices ' + (n > 1 ? 'are' : 'is') + ' down for ' + secs + ' s', true);
    return n;
  };
  /* a proximity alarm: an attacker inside 4 m sets it shrieking (everyone hears where) and is marked
     for the team that owns it; then it re-arms */
  class Alarm extends Ent {
    constructor(a, p, n) { super('alarm', a, p, { normal: n, hp: 1, hitR: 0.12 }); this.cool = 0; SFX.reload(this.pos, a.isPlayer, 1); }
    update(dt) {
      this.t += dt; this.cool -= dt;
      if (this.cool > 0 || this.t < 1.2) return;
      for (const b of G.actors) {
        if (!b.alive || b.team === this.team || b.hostage || U.dist3(b.center(V()), this.pos) > 4) continue;
        GAME.mark(b, this.team, 3, true); this.cool = 6;
        SFX.beep(this.pos, 3200, 0.6); SFX.beep(this.pos, 2500, 0.6);
        GAME.noise(this.pos, 30, b, 'alarm');
        const rm = G.map && G.map.roomAt ? G.map.roomAt(this.pos) : null;
        GAD.tellTeam(this.team, 'Proximity alarm' + (rm ? ': ' + rm.name : ''), true);
        return;
      }
    }
  }
  class Breach extends Ent {
    constructor(a, h) {
      super('breach', a, h.p, { normal: h.n, hp: 1 });
      this.vox = { x: h.x, y: h.y, z: h.z };
      a.placed.push(this); SFX.reload(this.pos, a.isPlayer, 1);
    }
    detonate() {
      if (!this.alive) return;
      if (GAD.jammed(this.pos, this.team, ['scrambler'])) { SFX.beep(this.pos, 400); GAD.tell(this.owner, 'Charge is being jammed'); return; }
      this.destroy('used');
      const n = this.normal, W = G.world;
      let cnt = 0;
      if (Math.abs(n.y) > 0.7) cnt = W.explode(this.pos.x, this.pos.y - n.y * 0.1, this.pos.z, 1.15, false, 40);
      else {
        // a doorway-ish hole: 5 wide, 9 tall from the floor below the charge
        const vx = this.vox.x, vz = this.vox.z, fy = Math.floor((this.pos.y - 1.2) * 4);
        const along = Math.abs(n.x) > 0.5 ? 'z' : 'x';
        const yb = Math.max(fy - 1, this.vox.y - 5);
        cnt = along === 'z' ? W.carve(vx - 1, yb, vz - 2, vx + 1, yb + 9, vz + 2, md => md.xp, 40) : W.carve(vx - 2, yb, vz - 1, vx + 2, yb + 9, vz + 1, md => md.xp, 40);
      }
      if (cnt) SFX.crumble(this.pos, cnt);
      GAD.explode(this.pos, 2.2, 85, this.owner, {});
      G.emit('breach');
    }
  }
  class Claymore extends Ent {
    constructor(a, p, yaw) { super('claymore', a, p, { upright: true, yaw, hp: 1, hitR: 0.15 }); this.yaw = yaw; this.arm = 1.2; }
    update(dt) {
      this.t += dt; if (this.t < this.arm) return;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 2.2 && (dx * fx + dz * fz) / (d || 1) > 0.5 && Math.abs(b.pos.y - this.pos.y) < 1) { this.destroy('used'); GAD.explode(this.pos.clone().add(V().set(0, 0.3, 0)), 3.2, 140, this.owner, {}); return; }
      }
    }
  }
  class Wire extends Ent {
    constructor(a, p, yaw) { super('wire', a, p, { upright: true, yaw, hp: 30, hitR: 0.3 }); this.yaw = yaw; this.stopBullets = false; this.rust = 0; }
    update(dt) {
      this.t += dt;
      for (const b of G.actors) {
        if (b.state === 'dead' || b.team === this.team || b.hostage) continue;
        const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z;
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < 0.6 && Math.abs(lz) < 0.3 && Math.abs(b.pos.y - this.pos.y) < 0.6) {
          b.slow = 0.2;
          if (b.moving > 0.3) { this.rust -= dt; if (this.rust <= 0) { this.rust = 0.35; SFX.impact(this.pos, true); GAME.noise(this.pos, 14, b, 'wire'); } }
        }
      }
    }
  }
  class DShield extends Ent {
    constructor(a, p, yaw) {
      super('dshield', a, p, { upright: true, yaw, hp: 999, bulletproof: true, melee: false, hitR: 0 });
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const hw = 0.5, hd = 0.08;
      const xs = [p.x + rx * hw + fx * hd, p.x - rx * hw + fx * hd, p.x + rx * hw - fx * hd, p.x - rx * hw - fx * hd];
      const zs = [p.z + rz * hw + fz * hd, p.z - rz * hw + fz * hd, p.z + rz * hw - fz * hd, p.z - rz * hw - fz * hd];
      this.hitBox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: p.y, y1: p.y + 0.85, z0: Math.min(...zs), z1: Math.max(...zs) };
      this.solid = this.hitBox;
    }
  }

  /* ========================================================= operator abilities */
  GAD.ability = function (a) {
    const ab = a.ability; if (!ab || a.state !== 'alive' || a.busy > 0) return false;
    const id = ab.id;
    const spend = () => { ab.count--; a.busy = 0.5; return true; };
    const need = () => { if (ab.count <= 0) { GAD.tell(a, 'No ' + a.op.ability.name.toLowerCase() + ' left'); return false; } return true; };
    switch (id) {
      case 'bore': {
        if (!need()) return false;
        const h = GAD.aim(a, 2.0);
        if (!h || !(h.md.hb || h.md.reinf) || Math.abs(h.n.y) > 0.5) { GAD.tell(a, 'Plasma bores go on walls'); return false; }
        new Bore(a, h); return spend();
      }
      case 'rivet': {
        if (!need()) return false;
        const p = new Proj('rivet', a, GAD.throwStart(a), a.fwd(V()).multiplyScalar(40), { g: 0.05, sticky: true, intercept: true, onStick: s => { s.fuse = 0.6; } });
        p.onFuse = s => {
          s.destroy('used');
          if (GAD.jammed(s.pos, s.team, ['dampener'])) { FX.sparks(s.pos, s.normal.x, s.normal.y, s.normal.z, 0x5ad8ff); SFX.zap(s.pos); return; }
          const sv = s.stickVox, m = sv ? G.world.get(sv.x, sv.y, sv.z) : 0;
          if (m && MAT[m].reinf) { FX.sparks(s.pos, s.normal.x, s.normal.y, s.normal.z); SFX.metal(s.pos); return; }
          const c = s.pos.clone().addScaledVector(s.normal, -0.12);
          const n = G.world.explode(c.x, c.y, c.z, 0.75, false, 30); if (n) SFX.crumble(c, n);
          GAD.explode(s.pos, 1.6, 40, a, {});
        };
        return spend();
      }
      case 'surge': return GAD.deployDrone(a);
      case 'plant': {
        if (a.shieldPlanted && a.shieldPlanted.alive) { if (U.dist3(a.shieldPlanted.pos, a.pos) < 2.2) { a.shieldPlanted.destroy('silent'); a.shieldPlanted = null; a.shieldUp = true; if (a.rig) MD.addShield(a.rig); SFX.metal(a.pos); return true; } return false; }
        const p = GAD.floorAhead(a, 0.8); if (!p) return false;
        a.shieldPlanted = new PlantedShield(a, p, a.yaw); a.shieldUp = false;
        if (a.rig && a.rig.shield) { a.rig.aim.remove(a.rig.shield); a.rig.shield = null; }
        SFX.metal(a.pos); a.busy = 0.6; return true;
      }
      case 'photon': { if (!need()) return false; const p = new Proj('photon', a, GAD.throwStart(a), GAD.throwVel(a, 13), { sticky: true, hp: 1 }); p.update = photonUpdate.bind(p, p.update.bind(p)); return spend(); }
      case 'sonar': {
        if (ab.cd > 0) { GAD.tell(a, 'Sonar recharging'); return false; }
        ab.cd = 20; SFX.sonar(a.pos); FX.flash(a.eye(V()), 1.2, 0.3);
        let n = 0;
        for (const b of G.actors) if (b.alive && b.team !== a.team && !b.hostage && U.dist3(b.pos, a.pos) < 18) { GAME.mark(b, a.team, 3, true); n++; }
        GAD.tell(a, n ? 'Sonar: ' + n + ' contact' + (n > 1 ? 's' : '') : 'Sonar: no contacts');
        return true;
      }
      case 'spike': {
        if (!need()) return false;
        const h = GAD.aim(a, 2.0);
        if (!h || !h.md.xp || h.md.reinf) { GAD.tell(a, 'Spikes need a soft wall or floor'); return false; }
        new Spike(a, h); return spend();
      }
      case 'beacon': { if (!need()) return false; const p = GAD.floorAhead(a, 1.0); if (!p) return false; new Beacon(a, p); return spend(); }
      case 'spotter': { a.zoom4 = !a.zoom4; GAD.tell(a, a.zoom4 ? 'Scope 4.0x' : 'Scope 2.5x'); return true; }
      case 'scanner': { ab.on = !ab.on; a.busy = 0.2; SFX.ui(ab.on ? 1200 : 700); return true; }
      case 'smokegl': { if (!need()) return false; new Proj('smokegl', a, GAD.throwStart(a), a.fwd(V()).multiplyScalar(26).add(V().set(0, 1.5, 0)), { impact: true, onFuse: s => { s.destroy('used'); GAD.smokeOf(a, s.pos.clone().addScaledVector(s.normal, 0.3), 4.2, 16); SFX.whoosh(s.pos); } }); SFX.whoosh(a.pos); return spend(); }
      // ---- season 2 / 3 attackers
      case 'foam': {
        if (!need()) return false;
        const yaw = a.yaw;
        new Proj('foam', a, GAD.throwStart(a), GAD.throwVel(a, 14, 1.5), { impact: true, intercept: true, onFuse: s => { s.destroy('used'); GAD.foamWall(a, s.pos.clone().addScaledVector(s.normal, 0.3), yaw); } });
        SFX.whoosh(a.pos); return spend();
      }
      case 'irritant': { if (!need()) return false; new Proj('irritant', a, GAD.throwStart(a), GAD.throwVel(a, 13), { impact: true, onFuse: s => { s.destroy('used'); new Irritant(a, s.pos.clone().addScaledVector(s.normal, 0.1)); } }); return spend(); }
      // ---- defenders
      case 'dampener': { if (!need()) return false; const h = GAD.aim(a, 2.2); if (!h || Math.abs(h.n.y) > 0.5) { GAD.tell(a, 'Mount the dampener on a wall'); return false; } new Device('dampener', a, h.p, h.n, { jamR: 2.5 }); return spend(); }
      case 'seeker': { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Seeker(a, p); return spend(); }
      case 'bunker': { if (!need()) return false; if (!GAD.bunker(a)) { GAD.tell(a, 'Look at an open doorway or window'); return false; } return spend(); }
      case 'medstation': { if (!need()) return false; const p = GAD.floorAhead(a, 1.0); if (!p) return false; new MedStation(a, p, a.yaw); return spend(); }
      case 'snare': { if (!need()) return false; if (!GAD.snare(a)) { GAD.tell(a, 'Look at a doorway or window'); return false; } return spend(); }
      case 'bpcam': { if (!need()) return false; const h = GAD.aim(a, 2.4); if (!h) return false; const c = new Cam(h.p, Math.atan2(h.n.x, h.n.z) + Math.PI, -0.15, a.team, 'ARMORED CAM', true); c.normal.copy(h.n); c.owner = a; return spend(); }
      case 'scrambler': { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Device('scrambler', a, p, null, { jamR: 2.5, upright: true, yaw: a.yaw }); return spend(); }
      case 'sensor': { if (!need()) return false; const h = GAD.aim(a, 2.4); if (!h) return false; new Sensor(a, h.p, h.n); return spend(); }
      case 'incendiary': { if (!need()) return false; new Proj('incendiary', a, GAD.throwStart(a), GAD.throwVel(a, 13), { impact: true, onFuse: s => { s.destroy('used'); new Fire(a, s.pos.clone().addScaledVector(s.normal, 0.05)); } }); return spend(); }
      case 'decoy': { if (!need()) return false; new Proj('decoy', a, GAD.throwStart(a), GAD.throwVel(a, 12), { hp: 1, onLand: s => decoyStart(s, a) }); return spend(); }
      case 'rcharge': {
        if (!need()) return false;
        const p = new Proj('rcharge', a, GAD.throwStart(a), GAD.throwVel(a, 12), { sticky: true, hp: 1, intercept: false });
        p.detonate = () => {
          if (!p.alive) return; p.destroy('used');
          const c = p.pos.clone().addScaledVector(p.normal, -0.1);
          const n = G.world.explode(c.x, c.y, c.z, 0.95, false, 35); if (n) SFX.crumble(c, n);
          GAD.explode(p.pos, 2.2, 95, a, {});
        };
        a.placed.push(p); return spend();
      }
      // ---- season 2 / 3 defenders
      case 'patch': { if (!need()) return false; const n = GAD.patch(a); if (!n) { GAD.tell(a, 'Aim at a hole in a wall, floor or hatch'); return false; } return spend(); }
      case 'floodlight': { if (!need()) return false; const p = GAD.floorAhead(a, 1.0); if (!p) return false; new Floodlight(a, p, a.yaw); return spend(); }
      // ---- seasons 4-9 attackers
      case 'cloak': {
        if (a.cloakT > 0) return false;
        if (!need()) return false;
        a.cloakT = 6; ab.count--; a.busy = 0.25; a.marks = {};
        SFX.whoosh(a.pos); FX.puff(a.center(V()), 0.9, 0.5, 0x8a7cff);
        return true;
      }
      case 'harpoon': {
        if (!need()) return false;
        const e = a.eye(V()), f = a.fwd(V()), R = 16;
        const wall = G.world.raycast(e, f, R, true);
        let bt = wall ? wall.dist : R, hitA = null, hitE = null;
        for (const b of G.actors) { if (b === a || b.state === 'dead' || b.team === a.team || b.hostage) continue; const h = b.rayHit(e, f, bt); if (h && h.t < bt) { bt = h.t; hitA = b; hitE = null; } }
        for (const x of G.ents) {
          if (!x.alive || x.team === a.team || x.type === 'defuser' || x.type === 'biohazard' || x.type === 'fire' || x.type === 'irritant' || x.type === 'dropped') continue;
          const to = x.pos.clone().sub(e), t = to.dot(f); if (t < 0.3 || t > bt + 0.25) continue;
          if (to.addScaledVector(f, -t).length() < Math.max(0.3, (x.hitR || 0.2) + 0.12)) { bt = Math.min(bt, t); hitE = x; hitA = null; }
        }
        const end = e.clone().addScaledVector(f, bt);
        FX.tracer(GAD.throwStart(a), end, 0x7cd0ff); SFX.metal(a.pos); SFX.whoosh(end); GAME.noise(e, 25, a, 'shot');
        a.cloakT = 0;
        if (hitA) {
          // dragged five metres toward the thrower, winded and off balance
          const dx = a.pos.x - hitA.pos.x, dz = a.pos.z - hitA.pos.z, L = Math.hypot(dx, dz) || 1, d = Math.min(5, Math.max(0, L - 1.3));
          const T = 0.36, vx = dx / L * d / T, vz = dz / L * d / T;
          hitA.knock = { vx, vz, t: T }; hitA.rappel = null;
          if (hitA.net && window.NP) NP.push({ k: 'knock', to: hitA.net, v: [vx, vz], t: T });
          hitA.hurt(15, { src: a, kind: 'melee', dir: V().set(-dx / L, 0, -dz / L) });
          if (!(hitA.odT > 0)) { hitA.stun = Math.max(hitA.stun, 1.3); hitA.slow = Math.max(hitA.slow, 1.6); }
          WPN.aimPunch(hitA, 1); GAME.mark(hitA, a.team, 2, true);
          GAD.tell(a, 'Hooked ' + GAME.who(hitA), 'kill'); GAD.tell(hitA, 'Harpooned!', 'warn');
        } else if (hitE) { GAD.tell(a, 'Harpoon tore out a ' + GAD.nameOf(hitE).toLowerCase()); hitE.destroy('blast'); }
        else FX.sparks(end, -f.x, -f.y, -f.z);
        return spend();
      }
      case 'hijack': {
        if (!need()) return false;
        const e = a.eye(V()), f = a.fwd(V()), R = 20;
        const wall = G.world.raycast(e, f, R, true), maxT = wall ? wall.dist + 0.35 : R;
        let best = null, bt = maxT;
        for (const x of G.ents) {
          if (!x.alive || x.team === a.team || !x.elec) continue;
          const to = x.pos.clone().sub(e), t = to.dot(f); if (t < 0.3 || t > maxT) continue;
          if (to.addScaledVector(f, -t).length() < Math.max(0.45, (x.hitR || 0.2) + 0.3) && t < bt) { bt = t; best = x; }
        }
        FX.tracer(GAD.throwStart(a), e.clone().addScaledVector(f, bt), 0xff5a7a); SFX.zap(a.pos); GAME.noise(e, 14, a, 'shot');
        a.cloakT = 0;
        if (best) GAD.hijack(best, a); else GAD.tell(a, 'Hijack dart: no electronics hit');
        return spend();
      }
      case 'ram': {
        if (a.ramT > 0) return false;
        if (!need()) return false;
        a.ramT = 4; ab.count--; a.busy = 0.2; a.cloakT = 0;
        SFX.whoosh(a.pos); GAD.tell(a, 'Battering charge: sprint into a soft wall or barricade');
        return true;
      }
      case 'overdrive': {
        if (a.odT > 0 || a.exhT > 0) return false;
        if (!need()) return false;
        a.odT = 7; a.slow = a.stun = a.rooted = 0; ab.count--; a.busy = 0.15;
        SFX.zap(a.pos); FX.burst(a.center(V()), 0xfff06a, 14, 3, 0.05, 0.5, 0);
        return true;
      }
      case 'triang': { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Triang(a, p, a.yaw); return spend(); }
      // ---- seasons 4-9 defenders
      case 'blackout': {
        if (GAME.blackout && GAME.blackout.until > G.time) { GAD.tell(a, 'The lights are already out'); return false; }
        if (!need()) return false;
        GAD.blackout(a.team, 9, a); return spend();
      }
      case 'recall': {
        const anc = a.anchor && a.anchor.alive ? a.anchor : null;
        if (anc && anc.empT > G.time) { GAD.tell(a, 'Anchor is dead: EMP'); return false; }
        if (!anc) {
          if (!need()) return false;
          const p = GAD.floorAhead(a, 0.6) || V().set(a.pos.x, a.pos.y + 0.01, a.pos.z);
          a.anchor = new Anchor(a, p); a.busy = 0.4;
          GAD.tell(a, 'Anchor set: use the ability again to snap back here');
          return true;
        }
        if (U.dist3(anc.pos, a.pos) < 2.5) { GAD.tell(a, 'You are standing on your anchor'); return false; }
        const from = a.center(V()), to = anc.pos.clone();
        FX.flash(from, 2, 0.25); FX.puff(from, 1.0, 0.6, 0x7cd0ff);
        a.pos.copy(to); a.vel.set(0, 0, 0); a.rappel = null; a.vault = null; a.knock = null;
        if (a.net && window.NP) NP.push({ k: 'tp', to: a.net, p: [to.x, to.y, to.z].map(v => Math.round(v * 100) / 100) });
        FX.flash(to.clone().setY(to.y + 1), 2.5, 0.3); FX.puff(to.clone().setY(to.y + 1), 1.2, 0.7, 0x7cd0ff); SFX.zap(to); GAME.noise(to, 18, a, 'step');
        anc.destroy('used'); a.anchor = null; ab.count--; a.busy = 0.5;
        return true;
      }
      case 'turret': { if (!need()) return false; const p = GAD.floorAhead(a, 1.1); if (!p) return false; new Turret(a, p, a.yaw); return spend(); }
      case 'jamfield': { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new JamField(a, p, a.yaw); return spend(); }
      case 'mannequin': { if (!need()) return false; const p = GAD.floorAhead(a, 1.0); if (!p) return false; new Mannequin(a, p, a.yaw); return spend(); }
      case 'nullfield': { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new NullField(a, p, a.yaw); return spend(); }
    }
    if (window.OPS2 && OPS2.ABIL[id]) return OPS2.ABIL[id](a, ab, need, spend);
    return false;
  };

  /* ------------------------------------------------ seasons 4-9 kit */
  /* Splice: an enemy gadget changes sides. Everything it does is decided by its team, so a
     hijacked snare catches defenders, a sensor reports them, a turret shoots them */
  GAD.hijack = function (x, a) {
    const old = x.team;
    x.team = a.team; x.owner = a; x.hijacked = true; x.t = 0; x.tgt = null; x.lock = 0;
    if (x.used) x.used = new Set();
    if (x.mesh && x.mesh.material && x.mesh.material.color) x.mesh.material.color.setRGB(1, 0.55, 0.7);
    FX.sparks(x.pos, x.normal.x, x.normal.y, x.normal.z, 0xff5a7a); SFX.beep(x.pos, 2600, 0.5);
    GAD.tell(a, 'HIJACKED: ' + GAD.nameOf(x), 'kill');
    GAD.tellTeam(old, GAD.nameOf(x) + ' hijacked by the attackers', true);
  };
  /* Nox: the lights go out for every team but his. Players get a dark screen, bots lose range. */
  GAD.blackout = function (team, secs, a) {
    GAME.blackout = { by: team, until: G.time + secs };
    if (window.NP) NP.push({ k: 'dark', by: team, t: secs });
    SFX.zap(a ? a.pos : G.camera.position); SFX.explosion(a ? a.pos : G.camera.position, false);
    if (G.player) HUD.toast(G.player.team === team ? 'BLACKOUT: night optics on' : 'BLACKOUT: the lights are out', G.player.team === team ? '' : 'warn');
  };
  /* Triad: a defender's unsuppressed shot within 25 m of a listening post gives them away */
  GAD.heardShot = function (a, p) {
    for (const x of G.ents) {
      if (!x.alive || x.type !== 'triang' || x.team === a.team || x.disabled) continue;
      if (U.dist3(x.pos, p) > 25) continue;
      GAME.mark(a, x.team, 2.5, true);
      if (G.time > (x.beepT || 0)) { x.beepT = G.time + 0.6; SFX.beep(x.pos, 1900, 0.3); }
    }
  };
  class Triang extends Ent {
    constructor(a, p, yaw) { super('triang', a, p, { upright: true, yaw, hp: 1, hitR: 0.2 }); }
    update(dt) { this.t += dt; if (Math.random() < dt * 1.5) FX.burst(this.pos.clone().add(V().set(0, 0.9, 0)), 0x7ce8c0, 1, 0.5, 0.03, 0.5, 0); }
  }
  class Anchor extends Ent {
    constructor(a, p) { super('anchor', a, p, { upright: true, yaw: a.yaw, hp: 1, hitR: 0.18 }); }
    update(dt) { this.t += dt; if (Math.random() < dt * 2) FX.burst(this.pos.clone().add(V().set(0, 0.5, 0)), 0x7cd0ff, 1, 0.5, 0.03, 0.6, -0.1); }
    onDestroy(why) { if (this.owner && this.owner.anchor === this) { this.owner.anchor = null; if (why !== 'used') GAD.tell(this.owner, 'Your recall anchor was destroyed', 'warn'); } }
  }
  /* Warden: a sentry gun. Sweeps an 80-degree arc, locks on, fires six-round bursts */
  const TURRET_GUN = { id: 'turret', name: 'WATCHDOG', type: 'SMG', dmg: 7, f0: 10, f1: 18, fmin: 0.6, destr: 1, pellets: 1 };
  class Turret extends Ent {
    constructor(a, p, yaw) { super('turret', a, p, { upright: true, yaw, hp: 110, hitR: 0.32 }); this.yaw = yaw; this.aimYaw = yaw; this.lock = 0; this.tgt = null; this.cool = 0; this.left = 6; }
    sees(b, eye) {
      if (b.state !== 'alive' || b.team === this.team || b.hostage || b.cloakT > 0) return false;
      const c = b.center(V()), dx = c.x - eye.x, dz = c.z - eye.z, d = Math.hypot(dx, dz);
      if (d > 16 || Math.abs(c.y - eye.y) > 4) return false;
      if (Math.abs(U.wrap(Math.atan2(-dx, -dz) - this.yaw)) > 0.7) return false;
      return G.world.los(eye, c) && !FX.smokeBlocks(eye, c);
    }
    update(dt) {
      this.t += dt; if (this.t < 1.2) return;                    // setting up
      if (this.disabled || GAD.jammed(this.pos, this.team, ['scrambler'])) return;
      this.cool -= dt;
      const eye = this.pos.clone().add(V().set(0, 0.72, 0));
      if (!this.tgt || !this.sees(this.tgt, eye)) {
        let best = null, bd = 99;
        for (const b of G.actors) { if (!this.sees(b, eye)) continue; const d = U.dist3(b.pos, eye); if (d < bd) { bd = d; best = b; } }
        if (best !== this.tgt) { this.tgt = best; this.lock = 0; this.left = 6; if (best) SFX.beep(this.pos, 1500, 0.45); }
      }
      let want = this.yaw + Math.sin(this.t * 0.9) * 0.6;       // idle: sweep the arc
      if (this.tgt) {
        const c = this.tgt.center(V());
        want = Math.atan2(-(c.x - eye.x), -(c.z - eye.z));
        this.lock += dt;
        if (this.lock > 0.55 && this.cool <= 0 && Math.abs(U.wrap(want - this.aimYaw)) < 0.2) {
          const dir = c.sub(eye).normalize();
          dir.x += (Math.random() - 0.5) * 0.07; dir.y += (Math.random() - 0.5) * 0.07; dir.z += (Math.random() - 0.5) * 0.07; dir.normalize();
          const from = eye.clone().addScaledVector(dir, 0.5);
          const end = WPN.trace(this.owner, from, dir, TURRET_GUN, 30, 1);
          FX.tracer(from, end, 0xff8a70); if (window.NP) NP.quiet(() => FX.flash(from, 0.35, 0.04)); else FX.flash(from, 0.35, 0.04);
          SFX.shot(DATA.WEAPONS.salvo9, eye, false); GAME.noise(eye, 30, this.owner, 'shot');
          this.cool = 0.11; if (--this.left <= 0) { this.left = 6; this.cool = 0.75; }
        }
      }
      this.aimYaw = U.turn(this.aimYaw, want, Math.min(1, dt * 5));
      if (this.mesh) this.mesh.rotation.y = this.aimYaw;
    }
  }
  /* Ferro: enemies inside the field get misfires and slow reloads (weapons.js reads a.misfire) */
  class JamField extends Ent {
    constructor(a, p, yaw) { super('jamfield', a, p, { upright: true, yaw, hp: 40, hitR: 0.22 }); this.r = 6; }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      if (Math.random() < dt * 3) FX.burst(this.pos.clone().add(V().set(0, 0.5, 0)), 0xffa040, 1, 0.8, 0.03, 0.4, 0);
      for (const b of G.actors) if (b.state === 'alive' && b.team !== this.team && !b.hostage && U.dist2(b.pos, this.pos) < this.r && Math.abs(b.pos.y - this.pos.y) < 2.6) b.misfire = G.time + 0.3;
    }
  }
  /* Veil: friends inside can't be marked and walk silently; enemy drones lose signal */
  class NullField extends Ent {
    constructor(a, p, yaw) { super('nullfield', a, p, { upright: true, yaw, hp: 30, hitR: 0.22 }); this.r = 7; }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      if (Math.random() < dt * 2) FX.burst(this.pos.clone().add(V().set((Math.random() - 0.5) * 3, 0.3, (Math.random() - 0.5) * 3)), 0x7ce8c0, 1, 0.4, 0.03, 0.7, -0.15);
      for (const b of G.actors) if (b.state !== 'dead' && b.team === this.team && U.dist2(b.pos, this.pos) < this.r && Math.abs(b.pos.y - this.pos.y) < 3) { b.nullT = G.time + 0.4; if (b.marks) b.marks = {}; }
      for (const d of G.ents) if (d.alive && d.type === 'drone' && d.team !== this.team && U.dist3(d.pos, this.pos) < this.r) d.jam(dt);
    }
  }
  /* Mimic: a still, life-size copy of her. Shooting it marks whoever pulled the trigger */
  class Mannequin extends Ent {
    constructor(a, p, yaw) {
      super('mannequin', a, p, { model: false, hp: 110, hitR: 0 });
      this.opId = a.op.id; this.wid = a.w[0] ? a.w[0].id : 'p10'; this.cos = a.cos || {}; this.yaw = yaw;
      this.mesh = GAD.mannequinMesh(this.opId, this.wid, this.cos);
      this.mesh.position.copy(p); this.mesh.rotation.y = yaw; G.scene.add(this.mesh);
      this.hitBox = { x0: p.x - 0.25, x1: p.x + 0.25, y0: p.y, y1: p.y + 1.78, z0: p.z - 0.25, z1: p.z + 0.25 };
      this.aimPos = V().set(p.x, p.y + 1.15, p.z);   // where a fooled bot shoots: its chest
    }
    shot(dmg, src) {
      if (src && src.team !== this.team && src.state === 'alive') {
        GAME.mark(src, this.team, 5, true);
        if (G.time > (this.toldT || 0)) { this.toldT = G.time + 2; GAD.tellTeam(this.team, 'Body double shot: ' + GAME.who(src) + ' marked', true); GAD.tell(src, 'That was a decoy: you are marked', 'warn'); }
      }
      super.shot(dmg, src);
    }
  }
  GAD.mannequinMesh = function (opId, wid, cos) {
    const rig = MD.operator(DATA.OPMAP[opId] || DATA.OPS[0], wid, cos);
    rig.aim.rotation.x = 0.02; rig.torso.rotation.z = 0.04;
    return rig.root;
  };
  /* hold-to-detonate (Rhea) */
  GAD.detonateAll = function (a, type) { let n = 0; for (const e of a.placed) if (e.alive && e.type === type && e.detonate) { e.detonate(); n++; } return n; };

  class Bore extends Ent {
    constructor(a, h) {
      super('bore', a, h.p, { normal: h.n, bulletproof: true, melee: false, hitR: 0.3 });
      this.vox = { x: h.x, y: h.y, z: h.z }; this.burn = 0; this.state = 'arm'; this.stopBullets = true; this.blastproof = true;
      SFX.metal(this.pos);
    }
    update(dt) {
      this.t += dt;
      const j = GAD.jammed(this.pos, this.team, ['dampener', 'scrambler']);
      if (j && this.t > 0.3) { FX.sparks(this.pos, this.normal.x, this.normal.y, this.normal.z, 0x5ad8ff); SFX.zap(this.pos); GAD.tell(this.owner, 'Plasma bore fizzled: ' + (j.type === 'dampener' ? 'dampener' : 'scrambler') + ' nearby'); this.destroy('silent'); return; }
      if (this.state === 'arm' && this.t > 1) { this.state = 'burn'; this.loop = SFX.loop('burn', this.pos); }
      if (this.state === 'burn') {
        this.burn += dt;
        if (Math.random() < 0.8) FX.sparks(this.pos, this.normal.x, this.normal.y + 0.5, this.normal.z, 0xffa040);
        if (Math.random() < dt * 4) GAME.noise(this.pos, 30, this.owner, 'breach');
        if (this.burn > 4) {
          const W = G.world, n = this.normal, vx = this.vox.x, vz = this.vox.z;
          const fy = Math.floor(W.groundBelow(this.pos.x + n.x * 0.3, this.pos.y, this.pos.z + n.z * 0.3) * 4);
          const along = Math.abs(n.x) > 0.5 ? 'z' : 'x';
          const test = md => md.hb;
          const cnt = along === 'z' ? W.carve(vx - 1, fy, vz - 3, vx + 1, fy + 8, vz + 3, test, 50) : W.carve(vx - 3, fy, vz - 1, vx + 3, fy + 8, vz + 1, test, 50);
          SFX.crumble(this.pos, cnt); SFX.explosion(this.pos, false); FX.explosion(this.pos, 1);
          for (const b of G.actors) if (b.state !== 'dead' && U.dist3(b.center(V()), this.pos) < 1.2) b.hurt(30, { src: this.owner, kind: 'explosion' });
          GAME.noise(this.pos, 60, this.owner, 'explosion');
          this.destroy('used');
          G.emit('bore');
        }
      }
    }
  }
  function photonUpdate(base, dt) {
    base(dt);
    if (!this.stuck || !this.alive) return;
    this.armT = (this.armT || 0) + dt; if (this.armT < 0.8) return;
    for (const b of G.actors) {
      if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
      const e = b.eye(V()); if (U.dist3(e, this.pos) > 6 || !G.world.los(this.pos.clone().addScaledVector(this.normal, 0.1), e)) continue;
      FX.flash(this.pos, 5, 0.3); SFX.explosion(this.pos, false);
      GAD.flash(this.pos, 6.5, this.team, true, 1.2);
      GAME.noise(this.pos, 30, this.owner, 'explosion');
      this.destroy('used'); return;
    }
  }
  class Spike extends Ent {
    constructor(a, h) { super('spike', a, h.p, { normal: h.n, hp: 30, hitR: 0.12 }); this.vox = { x: h.x, y: h.y, z: h.z }; this.loop = SFX.loop('burn', this.pos); }
    update(dt) {
      this.t += dt;
      if (GAD.jammed(this.pos, this.team, ['dampener', 'scrambler'])) { SFX.zap(this.pos); this.destroy('silent'); return; }
      if (Math.random() < 0.4) FX.dust(this.pos, this.normal.x, this.normal.y, this.normal.z, M.DRY_WHITE);
      if (this.t > 2) {
        const W = G.world, v = this.vox;
        W.carve(v.x - 1, v.y - 1, v.z - 1, v.x + 1, v.y + 1, v.z + 1, md => md.xp, 6);
        const far = this.pos.clone().addScaledVector(this.normal, -1.4);
        FX.flash(far, 3, 0.2); FX.puff(far, 1.6, 1.2); SFX.explosion(far, false);
        for (const b of G.actors) if (b.state === 'alive' && b.team !== this.team && !b.hostage && U.dist3(b.center(V()), far) < 4 && (U.dist3(b.center(V()), far) < 1.5 || W.los(far, b.center(V())))) { b.hurt(25, { src: this.owner, kind: 'explosion' }); b.stun = Math.max(b.stun, 4); if (b.isPlayer) PLAYER.shake(0.5); else if (b.net) NP.push({ k: 'shake', to: b.net, s: 0.5 }); }
        for (const e of G.ents) if (e.alive && e.team !== this.team && e !== this && U.dist3(e.pos, far) < 4 && e.type !== 'defuser' && e.type !== 'biohazard') e.destroy('blast');
        GAME.noise(far, 40, this.owner, 'explosion');
        this.destroy('used');
      }
    }
  }
  class Beacon extends Ent {
    constructor(a, p) { super('beacon', a, p, { upright: true, hp: 40, hitR: 0.25 }); this.life = 25; this.rev = new Map(); }
    update(dt) {
      this.t += dt; if (this.t > this.life) { this.destroy('used'); return; }
      if (Math.random() < dt * 6) FX.burst(this.pos.clone().add(V().set(0, 0.4, 0)), 0x7ce0a0, 1, 1, 0.04, 0.6, -0.2);
      for (const b of G.actors) {
        if (b.team !== this.team || b.state === 'dead' || U.dist3(b.pos, this.pos) > 4) continue;
        if (b.state === 'alive') b.heal(8 * dt, 20);
        else if (b.state === 'dbno') { const r = (this.rev.get(b) || 0) + dt; this.rev.set(b, r); if (r > 3) { b.revive(this.owner); this.rev.delete(b); } }
      }
    }
  }
  class PlantedShield extends Ent {
    constructor(a, p, yaw) {
      super('pshield', a, p, { model: 'dshield', upright: true, yaw, bulletproof: true, melee: false, hitR: 0 });
      this.mesh.scale.set(0.65, 1.7, 1);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const xs = [p.x + rx * 0.36 + fx * 0.06, p.x - rx * 0.36 + fx * 0.06, p.x + rx * 0.36 - fx * 0.06, p.x - rx * 0.36 - fx * 0.06];
      const zs = [p.z + rz * 0.36 + fz * 0.06, p.z - rz * 0.36 + fz * 0.06, p.z + rz * 0.36 - fz * 0.06, p.z - rz * 0.36 - fz * 0.06];
      this.hitBox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: p.y, y1: p.y + 1.45, z0: Math.min(...zs), z1: Math.max(...zs) };
      this.solid = this.hitBox; this.blastproof = true;
    }
  }
  /* generic electronic device on a wall or floor (dampener, scrambler) */
  class Device extends Ent {
    constructor(type, a, p, n, o) { super(type, a, p, Object.assign({ normal: n || V().set(0, 1, 0), hp: 1, hitR: 0.14 }, o)); this.jamR = o.jamR; }
    update(dt) {
      this.t += dt;
      if (this.type === 'scrambler') {
        if (Math.random() < dt * 2) FX.burst(this.pos.clone().add(V().set(0, 0.2, 0)), 0xb07cff, 1, 0.6, 0.03, 0.4, 0);
        for (const d of G.ents) if (d.alive && d.type === 'drone' && d.team !== this.team && U.dist3(d.pos, this.pos) < this.jamR) d.jam(dt);
      }
    }
  }
  class Seeker extends Ent {
    constructor(a, p) { super('seeker', a, p, { upright: true, hp: 1, hitR: 0.2 }); this.charges = 3; this.cool = 0; }
    update(dt) {
      this.t += dt; this.cool -= dt; if (this.cool > 0 || this.charges <= 0) return;
      const eye = this.pos.clone().add(V().set(0, 0.3, 0));
      for (const e of G.ents) {
        if (!e.alive || e.team === this.team) continue;
        if (!((e instanceof Proj && e.interceptable && !e.stuck) || e.type === 'drone')) continue;
        if (U.dist3(e.pos, eye) > 9 || !G.world.los(eye, e.pos)) continue;
        FX.tracer(eye, e.pos, 0x2fb3a6); SFX.zap(eye); e.destroy('intercept');
        this.charges--; this.cool = 0.5;
        if (this.charges <= 0) { this.mesh.material.color.setRGB(0.4, 0.4, 0.4); }
        return;
      }
    }
  }
  class MedStation extends Ent {
    constructor(a, p, yaw) { super('medstation', a, p, { upright: true, yaw, hp: 60, hitR: 0.3, melee: false }); this.uses = 4; this.used = new Set(); }
    update(dt) {
      this.t += dt;
      for (const b of G.actors) if (b.team === this.team && b.alive && U.dist3(b.pos, this.pos) < 1.6) b.heal(2 * dt, 0);
    }
    use(b) { if (this.uses <= 0 || this.used.has(b)) return false; this.used.add(b); this.uses--; b.heal(40, 40); SFX.ping(); return true; }
  }
  class Sensor extends Ent {
    constructor(a, p, n) { super('sensor', a, p, { normal: n, hp: 1, hitR: 0.1 }); this.cool = 0; }
    update(dt) {
      this.t += dt; this.cool -= dt; if (this.cool > 0 || this.t < 1) return;
      for (const b of G.actors) if (b.alive && b.team !== this.team && !b.hostage && U.dist3(b.center(V()), this.pos) < 4) {
        GAME.mark(b, this.team, 3, true); this.cool = 3;
        SFX.beep(this.pos, 2400, 0.4);
        GAD.tellTeam(this.team, 'Proximity sensor triggered', true);
        return;
      }
    }
  }
  class Fire extends Ent {
    constructor(a, p, r, life) { super('fire', a, p, { model: false, hp: 999, hitR: 0, melee: false }); this.r = r || 2.5; this.life = life || 10; this.loop = SFX.loop('fire', p); this.tick = 0; this.blastproof = true; }
    update(dt) {
      this.t += dt; if (this.t > this.life) { this.destroy('used'); return; }
      FX.flames(this.pos, this.r, this.r > 1.5 ? 3 : 1);
      this.tick -= dt; if (this.tick > 0) return; this.tick = 0.25;
      for (const b of G.actors) {
        if (b.state === 'dead') continue;
        const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z;
        if (dx * dx + dz * dz < this.r * this.r && Math.abs(b.pos.y - this.pos.y) < 1.2) b.hurt(b.team === this.team ? 1 : 3, { src: this.owner, kind: 'fire' });
      }
      GAME.noise(this.pos, 10, this.owner, 'fire');
    }
  }
  /* ------------------------------------------------ season 2 and 3 kit */
  /* does an actor's body overlap voxel (x, y, z)? Foam never sets inside somebody */
  function voxelHasActor(x, y, z) {
    const x0 = x * 0.25, y0 = y * 0.25, z0 = z * 0.25;
    for (const b of G.actors) {
      if (b.state === 'dead') continue;
      if (x0 + 0.25 > b.pos.x - 0.26 && x0 < b.pos.x + 0.26 && z0 + 0.25 > b.pos.z - 0.26 && z0 < b.pos.z + 0.26 && y0 + 0.25 > b.pos.y && y0 < b.pos.y + (b.h || 1.8)) return true;
    }
    return false;
  }
  /* Brace: a waist-high foam wall, 2 m wide and two voxels thick, square to the thrower */
  GAD.foamWall = function (a, p, yaw) {
    const W = G.world, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const alongX = Math.abs(fz) >= Math.abs(fx);
    const cx = Math.floor(p.x * 4), cz = Math.floor(p.z * 4);
    const gy = Math.floor(W.groundBelow(p.x, p.y + 0.3, p.z) * 4);
    let n = 0;
    for (let t = -4; t <= 3; t++) for (let k = 0; k <= 1; k++) for (let y = gy; y <= gy + 4; y++) {
      const x = alongX ? cx + t : cx + k, z = alongX ? cz + k : cz + t;
      if (W.get(x, y, z) || voxelHasActor(x, y, z)) continue;
      // only where it can stand: on the floor or on foam already set
      if (y > gy && !W.get(x, y - 1, z)) continue;
      if (y === gy && !W.get(x, y - 1, z)) continue;
      W.set(x, y, z, M.FOAM); n++;
    }
    FX.puff(V().set((cx + 0.5) / 4, gy / 4 + 0.6, (cz + 0.5) / 4), 1.6, 1.0, 0xd9cf9e);
    SFX.whoosh(p); GAME.noise(p, 20, a, 'breach');
    return n;
  };
  /* Seam: refill the breach under the crosshair. Anything that was a wall, floor or hatch when the
     round began and has been blown, shot or melted away since is set again in foam */
  GAD.patch = function (a) {
    const W = G.world, orig = W.orig, v = W.v, e = a.eye(V()), f = a.fwd(V());
    if (!orig) return 0;
    const hit = W.raycast(e, f, 4.5), maxD = hit ? Math.min(4.5, hit.dist + 0.4) : 4.5;
    const missing = (x, y, z) => {
      if (x < 0 || z < 0 || y < 1 || x >= W.W || z >= W.D || y >= W.H) return false;
      const i = W.idx(x, y, z), o = orig[i];
      return o && !v[i] && MAT[o].xp && o !== M.GLASS && o !== M.LEAF;
    };
    const R = 6;
    let best = null, bn = 0;
    for (let s = 0.5; s <= maxD; s += 0.25) {
      const c = e.clone().addScaledVector(f, s), cx = Math.floor(c.x * 4), cy = Math.floor(c.y * 4), cz = Math.floor(c.z * 4);
      let n = 0;
      for (let y = cy - R; y <= cy + R; y += 2) for (let z = cz - R; z <= cz + R; z += 2) for (let x = cx - R; x <= cx + R; x += 2) if (missing(x, y, z)) n++;
      if (n > bn) { bn = n; best = [cx, cy, cz]; }
    }
    if (!best || bn < 2) return 0;
    const [cx, cy, cz] = best;
    let n = 0;
    for (let y = cy - R; y <= cy + R; y++) for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > R * R + 1 || !missing(x, y, z) || voxelHasActor(x, y, z)) continue;
      W.set(x, y, z, M.FOAM); if (++n >= 400) break;
    }
    if (!n) return 0;
    const c = V().set((cx + 0.5) / 4, (cy + 0.5) / 4, (cz + 0.5) / 4);
    FX.puff(c, 1.4, 1.0, 0xd9cf9e); SFX.whoosh(c); GAME.noise(c, 16, a, 'breach');
    G.emit && G.emit('patch');
    return n;
  };
  /* Haze: a stinging cloud. Doesn't block sight; defenders inside are hurt, cough, and get marked */
  class Irritant extends Ent {
    constructor(a, p) { super('irritant', a, p, { model: false, hp: 999, hitR: 0, melee: false }); this.r = 3.5; this.life = 12; this.tick = 0; this.blastproof = true; this.marked = new Map(); this.loop = SFX.loop('burn', p); }
    update(dt) {
      this.t += dt; if (this.t > this.life) { this.destroy('used'); return; }
      GAD.hazeFx(this.pos, this.r, dt);
      this.tick -= dt; if (this.tick > 0) return; this.tick = 0.5;
      const c0 = this.pos.clone().add(V().set(0, 0.4, 0));
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z;
        if (dx * dx + dz * dz > this.r * this.r || Math.abs(b.pos.y - this.pos.y) > 1.8) continue;
        if (!G.world.los(c0, b.center(V()))) continue;      // the haze doesn't seep through walls
        b.hazeT = G.time;
        b.hurt(1, { src: this.owner, kind: 'gas' });
        if (G.time > (this.marked.get(b) || 0)) {
          this.marked.set(b, G.time + 2);
          GAME.mark(b, this.team, 2, true);
          GAME.noise(b.pos, 16, b, 'step');              // coughing: anyone close hears it
          SFX.step(b.pos, true, b.isPlayer);
          if (b.isPlayer) HUD.flash(0.05); else if (b.net && window.NP) NP.push({ k: 'flash', to: b.net, s: 0.05 });
        }
      }
    }
  }
  GAD.hazeFx = function (p, r, dt) {
    if (Math.random() > dt * 7) return;
    const q = p.clone().add(V().set((Math.random() - 0.5) * r * 1.6, Math.random() * 1.6, (Math.random() - 0.5) * r * 1.6));
    FX.puff(q, 0.9, 1.4, 0xbcc46a);
  };
  /* Lumen: a tripod floodlight that dazzles attackers who look into its beam */
  class Floodlight extends Ent {
    constructor(a, p, yaw) { super('floodlight', a, p, { upright: true, yaw, hp: 100, hitR: 0.3 }); this.yaw = yaw; this.tick = 0; }
    update(dt) {
      this.t += dt;
      if (this.disabled || GAD.jammed(this.pos, this.team, ['scrambler'])) return;
      this.tick -= dt; if (this.tick > 0) return; this.tick = 0.1;
      const lamp = this.pos.clone().add(V().set(0, 1.45, 0)), lf = V().set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        const e = b.eye(V()), d = U.dist3(e, lamp); if (d > 15) continue;
        const toEye = e.clone().sub(lamp).normalize(); if (toEye.dot(lf) < 0.35) continue;   // outside the beam
        const facing = toEye.clone().negate().dot(b.fwd(V())); if (facing < 0.55) continue;  // not looking at it
        if (!G.world.los(lamp, e) || FX.smokeBlocks(lamp, e)) continue;
        const k = Math.min(1, (1 - d / 15) * 1.4) * Math.min(1, (facing - 0.55) / 0.35);
        b.blind = Math.max(b.blind, 0.35 * k); b.blindK = Math.max(b.blindK, 0.35 * k);
        if (b.isPlayer) HUD.flash(0.05 + 0.15 * k); else if (b.net && window.NP) NP.push({ k: 'flash', to: b.net, s: 0.05 + 0.15 * k });
      }
    }
  }
  function decoyStart(s, a) {
    s.decoyT = 0; s.next = 0; s.passOwner = false;
    const base = s.update.bind(s);
    s.update = function (dt) {
      base(dt);
      if (!s.alive) return;
      s.decoyT += dt; s.next -= dt;
      if (s.decoyT > 20) { s.destroy('used'); return; }
      if (s.next <= 0) {
        s.next = 0.3 + Math.random() * 0.5;
        const fake = s.pos.clone().add(V().set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
        if (Math.random() < 0.15) { SFX.shot(DATA.WEAPONS.strider, fake, false); GAME.noise(fake, 45, a, 'shot', true); }
        else { SFX.step(fake, true, false); GAME.noise(fake, 14, a, 'step', true); }
      }
    };
  }
  /* Brick: seal an opening with steel */
  GAD.findOpening = function (a, maxD) {
    const e = a.eye(V()), f = a.fwd(V());
    let best = null, bd = maxD || 3;
    for (const op of G.map.openings) {
      // opening centre
      const cy = (op.y0 + op.y1 + 1) / 2 * 0.25, ca = (op.a0 + op.a1 + 1) / 2 * 0.25, cl = (op.line + 0.5) * 0.25;
      const c = op.axis === 'z' ? V().set(ca, cy, cl) : V().set(cl, cy, ca);
      const to = c.clone().sub(e), d = to.length();
      if (d > bd + 1) continue;
      to.normalize(); if (to.dot(f) < 0.75) continue;
      if (d < bd + 1) { best = op; bd = d - 1; best.c = c; }
    }
    return best;
  };
  GAD.opCells = function (op, fn) {
    for (let y = op.y0; y <= op.y1; y++) for (let a = op.a0; a <= op.a1; a++) { if (op.axis === 'z') fn(a, y, op.line); else fn(op.line, y, a); }
  };
  GAD.bunker = function (a) {
    const op = GAD.findOpening(a, 3); if (!op) return false;
    let filled = 0;
    GAD.opCells(op, (x, y, z) => { const m = G.world.get(x, y, z); if (!m || m === M.BARR || m === M.GLASS) { G.world.set(x, y, z, M.REINF); filled++; } });
    if (!filled) return false;
    SFX.metal(op.c); GAME.noise(op.c, 20, a, 'reinforce'); G.emit('bunker'); return true;
  };
  GAD.barricade = function (op) {
    let n = 0;
    GAD.opCells(op, (x, y, z) => { if (op.kind === 'door' && y === op.y0) return; const m = G.world.get(x, y, z); if (!m || m === M.GLASS) { G.world.set(x, y, z, M.BARR); n++; } });
    if (n) G.emit('barricade');
    return n;
  };
  GAD.opState = function (op) {
    let air = 0, barr = 0, total = 0, solid = 0;
    GAD.opCells(op, (x, y, z) => { total++; const m = G.world.get(x, y, z); if (!m || m === M.GLASS) air++; else if (m === M.BARR) barr++; else solid++; });
    return { air, barr, total, solid };
  };
  class Snare extends Ent {
    constructor(a, op) {
      const c = op.c.clone(); c.y = op.y0 * 0.25 + 0.45;
      super('snare', a, c, { hp: 1, hitR: 0.1, model: 'snare' });
      this.op = op; this.yLine = c.y;
      const a0 = op.a0 * 0.25, a1 = (op.a1 + 1) * 0.25, l = (op.line + 0.5) * 0.25;
      this.p0 = op.axis === 'z' ? V().set(a0, c.y, l) : V().set(l, c.y, a0);
      this.p1 = op.axis === 'z' ? V().set(a1, c.y, l) : V().set(l, c.y, a1);
      this.mesh.position.copy(this.p0);
      const g = new THREE.BufferGeometry().setFromPoints([this.p0, this.p1]);
      this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.55 }));
      G.scene.add(this.line); this.pos.copy(this.p0);
    }
    update(dt) {
      this.t += dt; if (this.t < 1) return;
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        if (Math.abs(b.pos.y + 0.4 - this.yLine) > 0.8) continue;
        const lo = this.op.axis === 'z' ? b.pos.z : b.pos.x, al = this.op.axis === 'z' ? b.pos.x : b.pos.z;
        if (Math.abs(lo - (this.op.line + 0.5) * 0.25) < 0.3 && al > this.op.a0 * 0.25 - 0.1 && al < (this.op.a1 + 1) * 0.25 + 0.1) {
          b.rooted = 2.5; GAME.mark(b, this.team, 5, true); SFX.zap(this.pos);
          GAD.tell(b, 'Caught in a snare line!');
          GAD.tellTeam(this.team, 'Snare line tripped');
          this.destroy('used'); return;
        }
      }
    }
    destroy(w) { if (this.line) { G.scene.remove(this.line); this.line = null; } super.destroy(w); }
  }
  GAD.snare = function (a) {
    const op = GAD.findOpening(a, 2.6); if (!op) return false;
    const st = GAD.opState(op); if (st.air < st.total * 0.5) return false;
    new Snare(a, op); return true;
  };

  /* ================================================================ cameras */
  class Cam extends Ent {
    constructor(p, yaw, pitch, team, name, armored) {
      super(armored ? 'bpcam' : 'cam', null, p, { team, model: armored ? 'bpcam' : 'cam', hp: 1, hitR: 0.16, bulletproof: !!armored, normal: V().set(0, -1, 0) });
      this.team = team; this.yaw = yaw; this.pitch = pitch; this.name = name; this.look = { yaw: 0, pitch: 0 };
      if (!armored) { this.mesh.rotation.set(0, yaw, 0); } else this.mesh.rotation.set(0, yaw + Math.PI, 0);
    }
  }
  GAD.Cam = Cam;
  GAD.cams = team => G.ents.filter(e => e.alive && !(e.empT > G.time) && (e.type === 'cam' || e.type === 'bpcam') && e.team === team);

  /* ================================================================= drones */
  class Drone extends Ent {
    constructor(owner, p, yaw) {
      super('drone', owner, p, { model: false, hp: 1, hitR: 0.17 }); this.model = 'drone';
      this.mesh = MD.drone(owner.op && owner.op.ability && owner.op.ability.id === 'surge' ? 0xb07cff : 0x5ad8ff);
      G.scene.add(this.mesh);
      this.vel = V(); this.yaw = yaw; this.pitch = 0; this.mf = 0; this.mr = 0; this.jump = false; this.onGround = false;
      this.boost = false; this.boostT = 0; this.boostCd = 0;   // a short burst of speed, then a cooldown
      this.jamT = 0; this.pilot = null; this.passOwner = true;
      this.surge = owner.op && owner.op.ability && owner.op.ability.id === 'surge';
    }
    jam(dt) { this.jamT += dt * 2; }
    update(dt) {
      this.t += dt;
      this.jamT = Math.max(0, this.jamT - dt);
      if (this.jamT > 1.2) { SFX.zap(this.pos); this.destroy('jam'); return; }
      const W = G.world, p = this.pos, r = 0.14, h = 0.16;
      const hit = (x, y, z) => W.boxHits(x - r, y, z - r, x + r, y + h, z + r);
      const jammed = this.jamT > 0.05;
      // booster: about a second at more than double speed, then eight seconds to recharge
      this.boostT = Math.max(0, this.boostT - dt); this.boostCd = Math.max(0, this.boostCd - dt);
      if (this.boost && this.boostCd <= 0 && !jammed) { this.boostT = Drone.BOOST_T; this.boostCd = Drone.BOOST_CD; SFX.whoosh(p); }
      this.boost = false;
      const sp = jammed ? 0.8 : this.boostT > 0 ? 7.6 : 3.4;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const tx = (-sy * this.mf + cy * this.mr) * sp, tz = (-cy * this.mf - sy * this.mr) * sp;
      this.vel.x = U.smooth(this.vel.x, tx, this.onGround ? 8 : 1.5, dt); this.vel.z = U.smooth(this.vel.z, tz, this.onGround ? 8 : 1.5, dt);
      // a hop of about 0.68 m: over a crate or a curb (the training tunnel's are 0.5 m), not up to a window sill
      if (this.jump && this.onGround && !jammed) { this.vel.y = 5.2; SFX.whoosh(p); }
      this.jump = false;
      this.vel.y -= 20 * dt;
      // a step no higher than one voxel (a stair tread, a kerb) is simply driven up: no hop needed
      const STEP = 0.27;
      let nx = p.x + this.vel.x * dt;
      if (hit(nx, p.y, p.z)) { if (this.onGround && !hit(nx, p.y + STEP, p.z) && !hit(p.x, p.y + STEP, p.z)) { p.y += STEP; this.vel.y = Math.max(this.vel.y, 0); } else { nx = p.x; this.vel.x = 0; } }
      p.x = nx;
      let nz = p.z + this.vel.z * dt;
      if (hit(p.x, p.y, nz)) { if (this.onGround && !hit(p.x, p.y + STEP, nz) && !hit(p.x, p.y + STEP, p.z)) { p.y += STEP; this.vel.y = Math.max(this.vel.y, 0); } else { nz = p.z; this.vel.z = 0; } }
      p.z = nz;
      let ny = p.y + this.vel.y * dt; this.onGround = false;
      if (hit(p.x, ny, p.z)) { if (this.vel.y < 0) { this.onGround = true; ny = Math.floor(ny * 4 + 1) / 4; while (hit(p.x, ny, p.z) && ny < p.y + 0.3) ny += 0.25; } else ny = p.y; this.vel.y = 0; }
      p.y = ny;
      if (p.y < -3) p.y = 4;
      this.mesh.position.copy(p); this.mesh.rotation.y = this.yaw;
      if (this.loop) this.loop.set(p);
      if (this.pilot && Math.hypot(this.vel.x, this.vel.z) > 0.5 && Math.random() < dt * 3) GAME.noise(p, 6, this.owner, 'drone');
    }
    eye() { return this.pos.clone().add(V().set(0, 0.12, 0)); }
    fwd() { const cp = Math.cos(this.pitch); return V().set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
    zap() {
      const o = this.owner; if (!this.surge || !o.ability || o.ability.zaps <= 0) return false;
      o.ability.zaps--; SFX.zap(this.pos); FX.flash(this.pos, 2.5, 0.25);
      let n = 0;
      for (const e of G.ents) if (e.alive && e.team !== this.team && e.elec && e !== this && U.dist3(e.pos, this.pos) < 3.5) { e.destroy('surge'); n++; }
      GAD.tell(o, n ? 'Surge fried ' + n + ' device' + (n > 1 ? 's' : '') : 'Surge: nothing in range');
      return true;
    }
    destroy(w) { super.destroy(w); if (this.pilot && this.pilot.isPlayer) PLAYER.leaveDrone(); else if (this.pilot && this.pilot.net) { NP.push({ k: 'undrone', to: this.pilot.net }); this.pilot.netDrone = 0; } this.pilot = null; }
  }
  Drone.BOOST_T = 1.1; Drone.BOOST_CD = 8;
  GAD.Drone = Drone;
  GAD.deployDrone = function (a, prep) {
    if (a.side !== 'atk' || a.drones <= 0) return false;
    a.drones--;
    const start = prep ? a.pos.clone().add(V().set(0, 0.3, 0)).addScaledVector(a.fwd(V()).setY(0).normalize(), 0.6) : GAD.throwStart(a);
    const d = new Drone(a, start, a.yaw);
    if (!prep) d.vel.copy(GAD.throwVel(a, 6, 1.5));
    return d;
  };

  /* ================================================== objectives as entities */
  class Defuser extends Ent {
    constructor(a, p, site) { super('defuser', a, p, { upright: true, yaw: a ? a.yaw : 0, hp: 999, bulletproof: true, melee: false, hitR: 0.25 }); this.site = site; this.blastproof = true; this.beep = 0; this.left = 45; this.disable = 0; }
    update(dt) {
      this.t += dt; this.left -= dt; this.beep -= dt;
      if (this.beep <= 0) { this.beep = this.left > 15 ? 1 : this.left > 5 ? 0.5 : 0.22; SFX.beep(this.pos, 2000, 0.5); }
    }
  }
  GAD.Defuser = Defuser;
  class Dropped extends Ent { constructor(p) { super('dropped', null, p, { model: 'defuser', upright: true, hp: 999, bulletproof: true, melee: false, hitR: 0 }); this.mesh.scale.setScalar(0.8); this.blastproof = true; } }
  GAD.Dropped = Dropped;
  class Biohazard extends Ent { constructor(p) { super('biohazard', null, p, { upright: true, hp: 999, bulletproof: true, melee: false, hitR: 0.35 }); this.blastproof = true; } }
  GAD.Biohazard = Biohazard;

  /* deploy at a given point (used by AI and tutorials) */
  GAD.deployAt = function (a, id, p, n, yaw) {
    n = n || V().set(0, 1, 0);
    switch (id) {
      case 'wire': return new Wire(a, p, yaw || 0);
      case 'dshield': return new DShield(a, p, yaw || 0);
      case 'dampener': return new Device('dampener', a, p, n, { jamR: 2.5 });
      case 'scrambler': return new Device('scrambler', a, p, null, { jamR: 2.5, upright: true, yaw: yaw || 0 });
      case 'seeker': return new Seeker(a, p);
      case 'medstation': return new MedStation(a, p, yaw || 0);
      case 'sensor': return new Sensor(a, p, n);
      case 'bpcam': { const c = new Cam(p, yaw || 0, -0.2, a.team, 'ARMORED CAM', true); c.owner = a; return c; }
      case 'claymore': return new Claymore(a, p, yaw || 0);
      case 'beacon': return new Beacon(a, p);
      case 'floodlight': return new Floodlight(a, p, yaw || 0);
      case 'turret': return new Turret(a, p, yaw || 0);
      case 'jamfield': return new JamField(a, p, yaw || 0);
      case 'nullfield': return new NullField(a, p, yaw || 0);
      case 'mannequin': return new Mannequin(a, p, yaw || 0);
      case 'triang': return new Triang(a, p, yaw || 0);
      case 'anchor': { const x = new Anchor(a, p); a.anchor = x; return x; }
      case 'alarm': return new Alarm(a, p, n);
      case 'fog': return fogCan(a, p, V(), true);
    }
    if (window.OPS2 && OPS2.DEPLOY[id]) return OPS2.DEPLOY[id](a, p, n, yaw || 0);
    return null;
  };
  GAD.snareAt = (a, op) => { op.c = op.c || GAD.opCenter(op); return new Snare(a, op); };
  GAD.opCenter = op => { const cy = (op.y0 + op.y1 + 1) / 2 * 0.25, ca = (op.a0 + op.a1 + 1) / 2 * 0.25, cl = (op.line + 0.5) * 0.25; return op.axis === 'z' ? V().set(ca, cy, cl) : V().set(cl, cy, ca); };
  GAD.TRAPS = TRAPS;
  GAD.Fire = Fire; GAD.Irritant = Irritant;
  GAD.update = function (dt) {
    for (const e of G.ents) {
      if (!e.alive) continue;
      // knocked out by an EMP (anything but a grenade still in the air): it does nothing, and spits a spark now and then
      if (e.empT > G.time && e.stuck !== false) { e.t += dt; if (Math.random() < dt * 2.5) FX.sparks(e.pos, e.normal.x, e.normal.y, e.normal.z, 0x9ad8ff); continue; }
      e.update(dt);
    }
    if (G.ents.length > 60) G.ents = G.ents.filter(e => e.alive);
  };
  GAD.clear = function () { for (const e of G.ents) if (e.alive) e.destroy('silent'); G.ents = []; };

  window.GAD = GAD;
})();
