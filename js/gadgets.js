/* gadgets.js -- every deployable: secondary gadgets, operator abilities, drones,
   cameras, the defuser and the biohazard container. Entities live in G.ents. */
(function () {
  'use strict';
  const { MAT, M, OOB } = DATA;
  const GAD = { nidc: 0 };
  GAD.tell = (a, x, c) => { if (window.NP) NP.tell(a, x, c); else if (a && a.isPlayer) HUD.toast(x, c); };
  GAD.tellTeam = (team, x, alarm) => { if (window.NP) NP.tellTeam(team, x, alarm); };
  const V = () => new THREE.Vector3();
  const ELEC = new Set(['cam', 'bpcam', 'dampener', 'scrambler', 'sensor', 'seeker', 'snare', 'photon', 'claymore', 'beacon', 'drone', 'decoy', 'c4', 'rcharge', 'breach']);
  const TRAPS = new Set(['snare', 'wire', 'sensor', 'c4', 'rcharge', 'dampener', 'scrambler', 'seeker', 'decoy', 'bpcam', 'cam']);

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
        this.mesh = MD.gadget(o.model || type);
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
    for (const e of G.ents) if (e.alive && e.team !== team && kinds.includes(e.type) && !e.disabled && U.dist3(e.pos, p) < (r || e.jamR || 2.5)) return e;
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
    if (g.id === 'breach' || g.id === 'c4') {
      const mine = a.placed.find(e => e.alive && e.type === g.id && (e.stuck || e.type === 'breach'));
      if (mine) { mine.detonate(); return true; }
    }
    if (g.count <= 0) return false;
    const spend = () => { g.count--; a.busy = 0.45; return true; };
    switch (g.id) {
      case 'frag': new Proj('frag', a, GAD.throwStart(a), GAD.throwVel(a, 15), { fuse: 2.4, onFuse: s => { s.destroy('used'); GAD.explode(s.pos, 4.6, 165, a, { voxR: 0.7 }); } }); return spend();
      case 'smoke': new Proj('smoke', a, GAD.throwStart(a), GAD.throwVel(a, 13), { fuse: 1.6, onFuse: s => { FX.smoke(s.pos, 3.8, 13); SFX.whoosh(s.pos); s.destroy('used'); } }); return spend();
      case 'stun': new Proj('stun', a, GAD.throwStart(a), GAD.throwVel(a, 15), { fuse: 1.4, onFuse: s => { FX.flash(s.pos, 6, 0.25); SFX.explosion(s.pos, false); GAD.flash(s.pos, 8, a.team, false); for (const b of G.actors) if (b.alive && U.dist3(b.pos, s.pos) < 4) b.stun = Math.max(b.stun, 2); GAME.noise(s.pos, 40, a, 'explosion'); s.destroy('used'); } }); return spend();
      case 'impact': new Proj('impact', a, GAD.throwStart(a), GAD.throwVel(a, 16, 1.5), { impact: true, onFuse: s => { s.destroy('used'); GAD.explode(s.pos, 2.4, 60, a, { voxR: 1.1 }); } }); return spend();
      case 'c4': { const p = new Proj('c4', a, GAD.throwStart(a), GAD.throwVel(a, 11), { sticky: true, hp: 1, intercept: false });
        p.detonate = () => { if (!p.alive) return; p.destroy('used'); GAD.explode(p.pos, 3.8, 190, a, { voxR: 0.9, snd: 'c4' }); };
        a.placed.push(p); return spend(); }
      case 'breach': {
        const h = GAD.aim(a, 2.0);
        if (!h || !h.md.xp || h.md.reinf) { GAD.tell(a, 'Breach charges need a soft wall, floor or barricade'); return false; }
        new Breach(a, h); return spend();
      }
      case 'claymore': { const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Claymore(a, p, a.yaw); return spend(); }
      case 'wire': { const p = GAD.floorAhead(a, 1.2); if (!p) return false; new Wire(a, p, a.yaw); return spend(); }
      case 'dshield': { const p = GAD.floorAhead(a, 1.0); if (!p) return false; new DShield(a, p, a.yaw); return spend(); }
    }
    return false;
  };

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
      case 'smokegl': { if (!need()) return false; new Proj('smokegl', a, GAD.throwStart(a), a.fwd(V()).multiplyScalar(26).add(V().set(0, 1.5, 0)), { impact: true, onFuse: s => { s.destroy('used'); FX.smoke(s.pos.clone().addScaledVector(s.normal, 0.3), 4.2, 16); SFX.whoosh(s.pos); } }); SFX.whoosh(a.pos); return spend(); }
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
    }
    return false;
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
    constructor(a, p) { super('fire', a, p, { model: false, hp: 999, hitR: 0, melee: false }); this.r = 2.5; this.life = 10; this.loop = SFX.loop('fire', p); this.tick = 0; this.blastproof = true; }
    update(dt) {
      this.t += dt; if (this.t > this.life) { this.destroy('used'); return; }
      FX.flames(this.pos, this.r, 3);
      this.tick -= dt; if (this.tick > 0) return; this.tick = 0.25;
      for (const b of G.actors) {
        if (b.state === 'dead') continue;
        const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z;
        if (dx * dx + dz * dz < this.r * this.r && Math.abs(b.pos.y - this.pos.y) < 1.2) b.hurt(b.team === this.team ? 1 : 3, { src: this.owner, kind: 'fire' });
      }
      GAME.noise(this.pos, 10, this.owner, 'fire');
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
  GAD.cams = team => G.ents.filter(e => e.alive && (e.type === 'cam' || e.type === 'bpcam') && e.team === team);

  /* ================================================================= drones */
  class Drone extends Ent {
    constructor(owner, p, yaw) {
      super('drone', owner, p, { model: false, hp: 1, hitR: 0.17 }); this.model = 'drone';
      this.mesh = MD.drone(owner.op && owner.op.ability && owner.op.ability.id === 'surge' ? 0xb07cff : 0x5ad8ff);
      G.scene.add(this.mesh);
      this.vel = V(); this.yaw = yaw; this.pitch = 0; this.mf = 0; this.mr = 0; this.jump = false; this.onGround = false;
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
      const sp = jammed ? 0.8 : 3.4;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const tx = (-sy * this.mf + cy * this.mr) * sp, tz = (-cy * this.mf - sy * this.mr) * sp;
      this.vel.x = U.smooth(this.vel.x, tx, this.onGround ? 8 : 1.5, dt); this.vel.z = U.smooth(this.vel.z, tz, this.onGround ? 8 : 1.5, dt);
      if (this.jump && this.onGround && !jammed) { this.vel.y = 4.2; SFX.whoosh(p); }
      this.jump = false;
      this.vel.y -= 20 * dt;
      let nx = p.x + this.vel.x * dt; if (hit(nx, p.y, p.z)) { nx = p.x; this.vel.x = 0; } p.x = nx;
      let nz = p.z + this.vel.z * dt; if (hit(p.x, p.y, nz)) { nz = p.z; this.vel.z = 0; } p.z = nz;
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
    }
    return null;
  };
  GAD.snareAt = (a, op) => { op.c = op.c || GAD.opCenter(op); return new Snare(a, op); };
  GAD.opCenter = op => { const cy = (op.y0 + op.y1 + 1) / 2 * 0.25, ca = (op.a0 + op.a1 + 1) / 2 * 0.25, cl = (op.line + 0.5) * 0.25; return op.axis === 'z' ? V().set(ca, cy, cl) : V().set(cl, cy, ca); };
  GAD.TRAPS = TRAPS;
  GAD.update = function (dt) {
    for (const e of G.ents) if (e.alive) e.update(dt);
    if (G.ents.length > 60) G.ents = G.ents.filter(e => e.alive);
  };
  GAD.clear = function () { for (const e of G.ents) if (e.alive) e.destroy('silent'); G.ents = []; };

  window.GAD = GAD;
})();
