/* actor.js -- anyone with a body: the player, bots, the hostage, range dummies.
   Movement (AABB vs voxels with step-up), stances, lean, vault, rappel,
   hitboxes (sphere chains), damage, down-but-not-out, revive.            */
(function () {
  'use strict';
  const { ARMOR_HP, SPEED, WEAPONS, GADGETS, MAT, M } = DATA;
  const STAND = 1.75, CROUCH = 1.2, PRONE = 0.55, RAD = 0.24, GRAV = 22;
  const EYE = [1.6, 1.08, 0.36];
  let NID = 1;

  class WState {
    constructor(id) {
      const d = WEAPONS[id];
      this.id = id; this.def = d;
      this.mag = d.mag || 0; this.reserve = (d.mag || 0) * (d.mags || 0);
      this.cool = 0; this.reload = 0; this.reloadMax = 0; this.bloom = 0; this.semiLock = false; this.auto = !!d.auto;
      this.shellLoop = false;
    }
  }

  class Actor {
    constructor(o) {
      this.id = NID++;
      this.name = o.name || 'Bot';
      this.team = o.team == null ? -1 : o.team;
      this.side = o.side || 'atk';
      this.op = o.op;
      this.isPlayer = !!o.isPlayer; this.hostage = !!o.hostage; this.dummy = !!o.dummy;
      this.isBot = !this.isPlayer && !this.hostage && !this.dummy;
      const op = this.op;
      this.loadout = Object.assign({ primary: op.primaries ? op.primaries[0] : 'p10', secondary: op.secondaries ? op.secondaries[0] : 'p10', gadget: op.gadgets ? op.gadgets[0] : null }, o.loadout || {});
      this.maxHp = this.hostage ? 100 : (o.hp || ARMOR_HP[op.armor] || 100);
      this.hp = this.maxHp; this.over = 0;
      this.spd = SPEED[op.speed] || SPEED[2];
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
      this.yaw = 0; this.pitch = 0;
      this.stance = 0; this.h = STAND; this.eyeH = EYE[0]; this.lean = 0; this.leanT = 0;
      this.mf = 0; this.mr = 0; this.sprint = false; this.trigger = false; this.adsWant = false; this.ads = 0;
      this.onGround = false; this.stepAcc = 0; this.moving = 0;
      this.state = 'alive'; this.bleed = 0; this.downedBy = null; this.revivedBy = null; this.reviving = null;
      this.stun = 0; this.blind = 0; this.blindK = 0; this.rooted = 0; this.slow = 0; this.revealed = 0; this.deaf = 0;
      this.vault = null; this.rappel = null; this.busy = 0; this.busyLabel = '';
      this.carry = null;  // 'defuser' | hostage actor
      this.followTarget = null; // hostage: who it follows
      this.kills = 0; this.deaths = 0; this.assists = 0; this.score = 0; this.dmgBy = new Map();
      this.lastShot = -9; this.lastHurt = -9; this.lastNoise = -9; this.noisePos = new THREE.Vector3();
      this.sprintT = 0; this.fireDelay = 0;
      // weapons
      this.w = [];
      if (!this.hostage) {
        const prim = this.loadout.primary;
        this.shieldOp = prim === 'shield';
        this.w.push(new WState(this.shieldOp ? this.loadout.secondary : prim));
        this.w.push(new WState(this.loadout.secondary));
        if (this.shieldOp) { this.w[0].reserve = this.w[0].reserve + this.w[1].mag + this.w[1].reserve; this.w.length = 1; }
      }
      this.cur = 0; this.swap = 0;
      this.shieldUp = this.shieldOp; this.shieldPlanted = null;
      this.gadget = this.loadout.gadget ? { id: this.loadout.gadget, count: GADGETS[this.loadout.gadget].count } : null;
      this.ability = op.ability ? { id: op.ability.id, count: op.ability.count, cd: 0, on: false, zaps: op.ability.id === 'surge' ? 3 : 0 } : null;
      this.drones = this.side === 'atk' && !this.hostage && !this.dummy ? 2 : 0;
      this.placed = [];     // gadget entities this actor owns that can be detonated
      // model
      this.rig = null;
      if (o.model !== false) this.buildRig();
      this.animT = Math.random() * 10; this.deathT = 0;
    }
    get wpn() { return this.w[this.cur]; }
    get alive() { return this.state === 'alive'; }
    get up() { return this.state !== 'dead'; }

    buildRig() {
      this.rig = MD.operator(this.hostage ? MD.HOSTAGE_OP : this.op, this.hostage ? 'p10' : this.w[0].id);
      if (this.hostage) this.rig.gun.visible = false;
      if (this.shieldOp) MD.addShield(this.rig);
      this.rig.root.userData.actor = this;
    }
    addTo(scene) { if (this.rig) scene.add(this.rig.root); }
    removeFrom(scene) { if (this.rig) scene.remove(this.rig.root); }

    /* ---------------------------------------------------------------- geometry */
    fwd(out) { out = out || new THREE.Vector3(); const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
    right(out) { out = out || new THREE.Vector3(); return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
    eye(out) {
      out = out || new THREE.Vector3();
      out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
      if (this.lean) { const k = this.lean * (this.stance === 2 ? 0.15 : 0.38); out.x += Math.cos(this.yaw) * k; out.z -= Math.sin(this.yaw) * k; out.y -= Math.abs(this.lean) * 0.08; }
      return out;
    }
    center(out) { out = out || new THREE.Vector3(); return out.set(this.pos.x, this.pos.y + this.h * 0.6, this.pos.z); }
    /* hit spheres: [x,y,z,r,part] */
    spheres() {
      const p = this.pos, out = [];
      if (this.state === 'dead') return out;
      if (this.stance === 2 || this.state === 'dbno') {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        out.push([p.x + fx * 0.75, p.y + 0.3, p.z + fz * 0.75, 0.14, 'head']);
        out.push([p.x + fx * 0.3, p.y + 0.22, p.z + fz * 0.3, 0.24, 'body']);
        out.push([p.x - fx * 0.15, p.y + 0.2, p.z - fz * 0.15, 0.22, 'body']);
        out.push([p.x - fx * 0.6, p.y + 0.16, p.z - fz * 0.6, 0.2, 'limb']);
        return out;
      }
      const e = this.eye(U.v1), h = this.h;
      const lx = (e.x - p.x) * 0.6, lz = (e.z - p.z) * 0.6;
      out.push([e.x, e.y + 0.03, e.z, 0.14, 'head']);
      out.push([p.x + lx, p.y + h * 0.72, p.z + lz, 0.24, 'body']);
      out.push([p.x + lx * 0.6, p.y + h * 0.57, p.z + lz * 0.6, 0.25, 'body']);
      out.push([p.x, p.y + h * 0.42, p.z, 0.22, 'body']);
      out.push([p.x, p.y + h * 0.25, p.z, 0.2, 'limb']);
      out.push([p.x, p.y + h * 0.09, p.z, 0.19, 'limb']);
      return out;
    }
    /* ray vs hit spheres -> {t, part} | null */
    rayHit(o, d, maxT) {
      let best = null;
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z;
      if (dx * dx + dz * dz > (maxT + 2) * (maxT + 2)) return null;
      for (const s of this.spheres()) {
        const ox = o.x - s[0], oy = o.y - s[1], oz = o.z - s[2];
        const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - s[3] * s[3];
        const disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t < 0 || t > maxT) continue;
        if (!best || t < best.t) best = { t, part: s[4] };
      }
      return best;
    }

    /* ---------------------------------------------------------------- movement */
    canStand(h) { return !G.world.boxHits(this.pos.x - RAD, this.pos.y + 0.05, this.pos.z - RAD, this.pos.x + RAD, this.pos.y + h, this.pos.z + RAD); }
    setStance(s) {
      if (this.state !== 'alive' || this.rappel) return;
      if (s < this.stance && !this.canStand(s === 0 ? STAND : CROUCH)) return;
      if (this.carry && this.carry.hostage && s === 2) return;
      this.stance = s;
    }
    blocked(x, y, z, h) { return G.world.boxHits(x - RAD, y, z - RAD, x + RAD, y + h, z + RAD) || this.entBlock(x, y, z, h) || this.prepFenced(x, y, z); }
    /* preparation phase: defenders can't leave the building (doors, windows, vaults, the roof).
       Someone already outside isn't trapped, they just can't wander further. */
    prepFenced(x, y, z) {
      if (this.side !== 'def' || G.mode !== 'match' || GAME.phase !== 'prep' || !G.map || !G.map.buildings) return false;
      return !Actor.indoors(x, y, z) && Actor.indoors(this.pos.x, this.pos.y, this.pos.z);
    }
    static indoors(x, y, z) {
      const e = 1e-3, V = 0.25;   // voxel size
      for (const b of G.map.buildings) {
        if (x - RAD >= (b.x0 + 1) * V - e && x + RAD <= b.x1 * V + e && z - RAD >= (b.z0 + 1) * V - e && z + RAD <= b.z1 * V + e && y < b.roofY * V) return true;
      }
      return false;
    }
    entBlock(x, y, z, h) {
      for (const e of G.ents) if (e.solid && e.alive) {
        const b = e.solid;
        if (x + RAD > b.x0 && x - RAD < b.x1 && z + RAD > b.z0 && z - RAD < b.z1 && y + h > b.y0 && y < b.y1) return true;
      }
      return false;
    }
    speedNow() {
      let v = this.sprint && this.mf > 0.3 && this.stance === 0 && this.ads < 0.3 && !this.carry ? this.spd.run : this.spd.walk;
      v *= [1, 0.55, 0.25][this.stance];
      v *= 1 - this.ads * 0.38;
      const w = this.wpn; if (w) v *= w.def.mob || 1;
      if (this.shieldOp && this.shieldUp) v *= 0.92;
      if (this.slow > 0) v *= 0.38;
      if (this.stun > 0) v *= 0.6;
      if (this.carry && this.carry.hostage) v *= 0.85;
      if (this.rooted > 0) v = 0;
      if (this.state === 'dbno') v = 0.45;
      if (this.hostage) v = this.followTarget ? 3.4 : 0;
      return v;
    }
    physics(dt) {
      if (this.state === 'dead') { this.vel.set(0, 0, 0); return; }
      const W = G.world;
      if (this.vault) return this.doVault(dt);
      if (this.rappel) return this.doRappel(dt);
      // stance height
      const targetH = this.state === 'dbno' ? PRONE : [STAND, CROUCH, PRONE][this.stance];
      if (targetH > this.h && !this.canStand(targetH)) { /* stay */ }
      else this.h = U.smooth(this.h, targetH, 12, dt);
      this.eyeH = Math.max(0.3, this.h - 0.15);
      // lean
      const running = this.sprint && this.mf > 0.3 && this.stance === 0;
      if (running) this.leanT = 0;   // breaking into a run straightens you up (and clears a toggled lean)
      const leanOK = this.state === 'alive' && !running;
      this.lean = U.smooth(this.lean, leanOK ? this.leanT : 0, 12, dt);
      if (this.lean) { const e = this.eye(U.v2); if (W.boxHits(e.x - 0.12, e.y - 0.12, e.z - 0.12, e.x + 0.12, e.y + 0.12, e.z + 0.12)) this.lean *= 0.85; }
      // desired velocity
      const sp = this.speedNow();
      let mf = this.mf, mr = this.mr;
      const ml = Math.hypot(mf, mr); if (ml > 1) { mf /= ml; mr /= ml; }
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const tx = (-sy * mf + cy * mr) * sp, tz = (-cy * mf - sy * mr) * sp;
      const acc = this.onGround ? 14 : 3;
      this.vel.x = U.smooth(this.vel.x, tx, acc, dt);
      this.vel.z = U.smooth(this.vel.z, tz, acc, dt);
      this.vel.y -= GRAV * dt;
      // integrate per axis
      const p = this.pos, h = this.h;
      /* corner slide: a move blocked only by the very edge of a corner (a rail end, a door
         jamb) shifts us sideways around it instead of stopping us dead. A flat wall is
         still blocked at every offset, so walking into one behaves as before. */
      const slide = (alongX, to, lateralV) => {
        const pref = lateralV < 0 ? -1 : 1, room = Math.abs(alongX ? this.vel.x : this.vel.z) * dt;
        for (const off of [0.04, 0.08, 0.12]) for (const sgn of [pref, -pref]) {
          const o = off * sgn;
          const free = alongX ? !this.blocked(to, p.y, p.z + o, h) && !this.blocked(p.x, p.y, p.z + o, h)
            : !this.blocked(p.x + o, p.y, to, h) && !this.blocked(p.x + o, p.y, p.z, h);
          if (free) { const s = Math.min(off, Math.max(room, 0.01)) * sgn; if (alongX) p.z += s; else p.x += s; return true; }
        }
        return false;
      };
      // step up exactly onto the next voxel top, so the feet stay planted (no airborne frame
      // per step, which used to cost air control on every stair)
      const up = Math.round(p.y * 4) / 4 + 0.25;
      let nx = p.x + this.vel.x * dt;
      if (this.blocked(nx, p.y, p.z, h)) {
        if (this.onGround && !this.blocked(nx, up, p.z, h) && !this.blocked(p.x, up, p.z, h)) { p.y = up; this.stepUp = 0.25; }
        else if (slide(true, nx, this.vel.z)) nx = p.x;
        else { nx = p.x; this.vel.x = 0; }
      }
      p.x = nx;
      let nz = p.z + this.vel.z * dt;
      if (this.blocked(p.x, p.y, nz, h)) {
        const upz = Math.round(p.y * 4) / 4 + 0.25;
        if (this.onGround && !this.blocked(p.x, upz, nz, h) && !this.blocked(p.x, upz, p.z, h)) { p.y = upz; this.stepUp = 0.25; }
        else if (slide(false, nz, this.vel.x)) nz = p.z;
        else { nz = p.z; this.vel.z = 0; }
      }
      p.z = nz;
      // step down: walking off a stair step or a kerb keeps your feet on the ground, instead of a
      // quarter-metre free fall per step (hopping down stairs with no air control). Real drops
      // (two voxels or more) still fall.
      if (this.onGround && this.vel.y <= 0 && !this.blocked(p.x, p.y - 0.05, p.z, 0.04)
        && this.blocked(p.x, p.y - 0.3, p.z, 0.04) && !this.blocked(p.x, p.y - 0.25, p.z, h)) p.y -= 0.25;
      let ny = p.y + this.vel.y * dt;
      this.onGround = false;
      if (this.vel.y <= 0) {
        if (this.blocked(p.x, ny, p.z, 0.05)) {
          // land on the top of the voxel we hit
          ny = Math.floor(ny * 4 + 1e-3) / 4 + 0.25; if (ny > p.y) ny = Math.ceil(p.y * 4 - 1e-3) / 4;
          if (this.vel.y < -11 && !this.dummy) this.hurt(Math.round((-this.vel.y - 11) * 9), { kind: 'fall' });
          this.vel.y = 0; this.onGround = true;
          // snap to exact voxel top
          while (this.blocked(p.x, ny, p.z, 0.02) && ny < p.y + 0.3) ny += 0.25;
        }
      } else if (this.blocked(p.x, ny, p.z, h)) { ny = p.y; this.vel.y = 0; }
      p.y = ny;
      if (p.y < -5) { p.y = 4; }
      // footsteps
      const hs = Math.hypot(this.vel.x, this.vel.z);
      this.moving = hs;
      if (this.onGround && hs > 0.6) {
        this.stepAcc += hs * dt;
        const stride = hs > 4 ? 0.8 : 0.62;
        if (this.stepAcc > stride) {
          this.stepAcc = 0;
          const quiet = (this.op && this.op.ability && this.op.ability.id === 'decoy') || this.stance === 2;
          const loud = hs > 3.6;
          if (!quiet || loud) {
            const m = W.get(Math.floor(p.x * 4), Math.floor(p.y * 4 - 0.5), Math.floor(p.z * 4));
            const metal = m && (MAT[m].reinf || m === M.METAL || m === M.RHATCH || m === M.CORRUGATE);
            if (!this.isPlayer) SFX.step(p, loud && !quiet, false, metal ? 'metal' : null);
            else SFX.step(p, loud, true, metal ? 'metal' : null);
            if (!this.hostage) GAME.noise(p, quiet ? 4 : loud ? 14 : this.stance === 1 ? 4 : 8, this, 'step');
          }
        }
      }
    }
    /* vault over a low obstacle or through a window */
    tryVault() {
      if (this.state !== 'alive' || this.vault || this.carry && this.carry.hostage) return false;
      const W = G.world, f = this.fwd(U.v1); f.y = 0; f.normalize();
      const p = this.pos;
      // something in front at waist height?
      for (let reach = 0.5; reach <= 0.9; reach += 0.2) {
        const fx = p.x + f.x * reach, fz = p.z + f.z * reach;
        if (!W.boxHits(fx - 0.1, p.y + 0.3, fz - 0.1, fx + 0.1, p.y + 1.3, fz + 0.1)) continue;
        // find obstacle top (<= 1.4m)
        for (let top = 0.25; top <= 1.5; top += 0.25) {
          const clear = !W.boxHits(fx - 0.12, p.y + top, fz - 0.12, fx + 0.12, p.y + top + 0.55, fz + 0.12);
          if (!clear) continue;
          // land on the far side
          for (let land = reach + 0.6; land <= reach + 1.6; land += 0.25) {
            const lx = p.x + f.x * land, lz = p.z + f.z * land;
            for (let dy = top; dy >= -1.6; dy -= 0.25) {
              const ly = p.y + dy;
              if (!this.blocked(lx, ly, lz, CROUCH) && this.blocked(lx, ly - 0.25, lz, 0.2)) {
                this.vault = { t: 0, dur: 0.55, from: p.clone(), to: new THREE.Vector3(lx, ly, lz), top: p.y + top + 0.1 };
                SFX.whoosh(p); G.emit('vault'); return true;
              }
            }
          }
          return false;
        }
        return false;
      }
      return false;
    }
    doVault(dt) {
      const v = this.vault; v.t += dt;
      const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(v.from, v.to, e);
      this.pos.y = Math.max(this.pos.y, U.lerp(v.from.y, v.top, Math.sin(k * Math.PI)) );
      this.h = U.smooth(this.h, CROUCH, 15, dt); this.eyeH = this.h - 0.15;
      if (k >= 1) { this.vault = null; this.vel.set(0, 0, 0); }
    }
    /* rappel: hang on an exterior wall you are facing */
    tryRappel() {
      if (this.state !== 'alive' || this.side !== 'atk' || this.carry || !G.map || !G.world.outdoor(this.pos)) return false;
      const f = this.fwd(U.v1); f.y = 0; f.normalize();
      // snap to the dominant axis
      const ax = Math.abs(f.x) > Math.abs(f.z) ? 'x' : 'z', s = ax === 'x' ? Math.sign(f.x) : Math.sign(f.z);
      const W = G.world, p = this.pos;
      const probe = new THREE.Vector3(p.x + (ax === 'x' ? s * 0.5 : 0), p.y + 1.2, p.z + (ax === 'z' ? s * 0.5 : 0));
      const m = W.get(Math.floor(probe.x * 4), Math.floor(probe.y * 4), Math.floor(probe.z * 4));
      if (!m || m === DATA.OOB || !(MAT[m].wall || m === M.CONC_DARK || m === M.CONCRETE || MAT[m].reinf || m === M.GLASS || m === M.BARR)) return false;
      this.rappel = { ax, s };
      this.yaw = ax === 'x' ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : (s > 0 ? Math.PI : 0);
      this.vel.set(0, 0, 0); this.stance = 0;
      SFX.whoosh(p);
      return true;
    }
    doRappel(dt) {
      const r = this.rappel, p = this.pos, W = G.world;
      this.h = STAND; this.eyeH = STAND - 0.15;
      const up = this.mf * 2.2, side = this.mr * 1.6;
      const sx = r.ax === 'x' ? 0 : (r.s > 0 ? -1 : 1), sz = r.ax === 'z' ? 0 : (r.s > 0 ? 1 : -1);
      // move sideways along wall
      const nx = p.x + sx * side * dt, nz = p.z + sz * side * dt;
      if (!this.blocked(nx, p.y, nz, this.h)) { p.x = nx; p.z = nz; }
      const ny = p.y + up * dt;
      if (up < 0 && this.blocked(p.x, ny, p.z, 0.05)) { this.rappel = null; return; }
      if (!this.blocked(p.x, ny, p.z, this.h)) p.y = ny;
      // climbed above the wall top: step onto the roof
      const wx = p.x + (r.ax === 'x' ? r.s * 0.5 : 0), wz = p.z + (r.ax === 'z' ? r.s * 0.5 : 0);
      const wallTop = W.boxHits(wx - 0.1, p.y + 0.2, wz - 0.1, wx + 0.1, p.y + 0.6, wz + 0.1);
      if (!wallTop && up > 0) {
        const tx = p.x + (r.ax === 'x' ? r.s * 0.9 : 0), tz = p.z + (r.ax === 'z' ? r.s * 0.9 : 0);
        for (let dy = 0; dy <= 1.2; dy += 0.25) if (!this.blocked(tx, p.y + dy, tz, CROUCH) && this.blocked(tx, p.y + dy - 0.25, tz, 0.2)) {
          this.vault = { t: 0, dur: 0.6, from: p.clone(), to: new THREE.Vector3(tx, p.y + dy, tz), top: p.y + dy + 0.2 }; this.rappel = null; return;
        }
      }
      this.vel.set(0, 0, 0); this.onGround = false;
      // footsteps on the wall
      if (Math.abs(up) + Math.abs(side) > 0.3) { this.stepAcc += dt; if (this.stepAcc > 0.45) { this.stepAcc = 0; SFX.step(p, false, this.isPlayer); GAME.noise(p, 9, this, 'step'); } }
    }

    /* ------------------------------------------------------------------ damage */
    hurt(dmg, info) {
      info = info || {};
      if (this.state === 'dead' || dmg <= 0) return;
      if (this.dummy) { const before = this.hp; this.hp -= dmg; this.lastHurt = G.time; if (RANGE.onDummyHit) RANGE.onDummyHit(this, dmg, info, before); if (this.hp <= 0) this.hp = this.maxHp; return; }
      const src = info.src;
      // attackers are not deployed yet during preparation: nothing can hurt them
      if (G.mode === 'match' && GAME.phase === 'prep' && this.side === 'atk') return;
      if (src && src !== this && src.team === this.team && !this.hostage && info.kind === 'bullet') return; // no friendly bullets
      if (src && src.team === this.team && info.kind !== 'bullet' && src !== this) dmg *= 0.5;
      if (src && src !== this) this.dmgBy.set(src, (this.dmgBy.get(src) || 0) + dmg);
      this.lastHurt = G.time;
      if (info.dir) this.hurtDir = Math.atan2(-info.dir.x, -info.dir.z);
      if (this.over > 0) { const a = Math.min(this.over, dmg); this.over -= a; dmg -= a; }
      if (this.isPlayer) { SFX.hurt(); HUD.hurt(info.dir); }
      else if (this.net && window.NP) NP.push({ k: 'hurt', to: this.net, d: info.dir ? [info.dir.x, info.dir.y, info.dir.z].map(v => Math.round(v * 100) / 100) : null });
      if (this.state === 'dbno') {
        this.hp -= dmg;
        if (this.hp <= 0) this.die(src || this.downedBy, info.head);
        return;
      }
      if (this.hp - dmg > 0) { this.hp -= dmg; return; }
      // lethal: down or dead?
      const canDown = !info.head && info.kind !== 'fall' && (this.hp > 20 || this.hostage) && dmg < this.hp + 60 && !this.carry;
      if (canDown && G.mode !== 'range') this.down(src);
      else this.die(src, info.head);
    }
    down(src) {
      this.state = 'dbno'; this.hp = 20; this.over = 0; this.bleed = this.hostage ? 999 : 25; this.downedBy = src || null;
      this.stance = 2; this.trigger = false; this.ads = 0; this.lean = this.leanT = 0; this.rappel = null; this.vault = null;
      if (this.carry === 'defuser') GAME.dropDefuser(this);
      if (this.carry && this.carry.hostage) { this.carry.followTarget = null; this.carry = null; }
      GAME.onDown(this, src);
    }
    die(src, head) {
      if (this.state === 'dead') return;
      this.state = 'dead'; this.hp = 0; this.trigger = false; this.deathT = 0; this.rappel = null; this.vault = null;
      if (this.carry === 'defuser') GAME.dropDefuser(this);
      if (this.carry && this.carry.hostage) { this.carry.followTarget = null; }
      this.carry = null;
      if (this.shieldPlanted) { /* stays */ }
      GAME.onKill(this, src, head);
    }
    revive(by) {
      if (this.state !== 'dbno') return;
      this.state = 'alive'; this.hp = 20; this.bleed = 0; this.stance = 1; this.downedBy = null;
      GAME.onRevive(this, by);
    }
    heal(n, overMax) {
      if (this.state !== 'alive') return;
      const cap = this.maxHp;
      if (this.hp < cap) { const a = Math.min(n, cap - this.hp); this.hp += a; n -= a; }
      if (n > 0 && overMax) this.over = Math.min(overMax, this.over + n);
    }
    statusTick(dt) {
      this.stun = Math.max(0, this.stun - dt); this.blind = Math.max(0, this.blind - dt); this.rooted = Math.max(0, this.rooted - dt);
      this.slow = Math.max(0, this.slow - dt); this.revealed = Math.max(0, this.revealed - dt); this.deaf = Math.max(0, this.deaf - dt);
      if (this.over > 0) this.over = Math.max(0, this.over - dt * 0.6);
      if (this.state === 'dbno') {
        this.bleed -= dt;
        if (!this.hostage && Math.floor(this.bleed + dt) !== Math.floor(this.bleed)) { this.hp = Math.max(1, Math.ceil(this.bleed * 20 / 25)); }
        if (this.bleed <= 0) this.die(this.downedBy, false);
      }
    }

    /* ------------------------------------------------------------- 3rd person */
    updateRig(dt, visible) {
      const r = this.rig; if (!r) return;
      r.root.visible = visible;
      if (!visible) return;
      r.root.position.copy(this.pos);
      r.root.rotation.y = this.yaw;
      const hs = this.moving || 0;
      this.animT += dt * (hs > 0.2 ? 3 + hs * 1.7 : 0);
      const sw = hs > 0.2 ? Math.sin(this.animT) : 0;
      if (this.state === 'dead') {
        this.deathT = Math.min(1, this.deathT + dt * 2.5);
        r.pose.rotation.x = U.lerp(0, Math.PI / 2, this.deathT * this.deathT); r.pose.position.y = 0.05; r.pose.position.z = this.deathT * 0.2;
        r.torso.rotation.z = 0; r.aim.rotation.x = -0.8; return;
      }
      const prone = this.stance === 2 || this.state === 'dbno';
      if (prone) {
        r.pose.rotation.x = this.state === 'dbno' ? -1.35 : -Math.PI / 2 + 0.05; r.pose.position.y = 0.22; r.pose.position.z = 0.1;
        r.thighL.rotation.x = sw * 0.3; r.thighR.rotation.x = -sw * 0.3; r.shinL.rotation.x = -0.2; r.shinR.rotation.x = -0.2;
        r.hips.position.y = 13 * MD.S; r.torso.rotation.x = 0;
        r.aim.rotation.x = this.state === 'dbno' ? -0.5 : Math.PI / 2 - 0.1 + this.pitch * 0.5;
        r.torso.rotation.z = 0;
        return;
      }
      r.pose.rotation.x = 0; r.pose.position.y = 0; r.pose.position.z = 0;
      const c = Math.max(0, Math.min(1, (STAND - this.h) / (STAND - CROUCH)));
      // +X rotation swings a limb forward (the model faces -Z): thighs forward, shins back = knees bend forward
      r.hips.position.y = (13 - c * 5.6) * MD.S;
      r.thighL.rotation.x = c * 1.25 + sw * 0.55; r.thighR.rotation.x = c * 1.25 - sw * 0.55;
      r.shinL.rotation.x = -(c * 1.9 + Math.max(0, -sw) * 0.7); r.shinR.rotation.x = -(c * 1.9 + Math.max(0, sw) * 0.7);
      r.torso.rotation.x = -c * 0.25;
      r.torso.rotation.z = -this.lean * 0.38;
      r.aim.rotation.x = this.pitch + c * 0.25 + (this.sprint && hs > 3.5 ? -0.6 : 0);
      r.head.rotation.x = this.pitch * 0.4;
      if (this.rappel) { r.thighL.rotation.x = 0.9; r.thighR.rotation.x = 0.7; r.shinL.rotation.x = -0.9; r.shinR.rotation.x = -0.8; }
    }
    tint(k) { if (this.rig) this.rig.mat.color.setRGB(k[0], k[1], k[2]); }
  }

  window.Actor = Actor;
  window.WState = WState;
  Actor.STAND = STAND; Actor.CROUCH = CROUCH; Actor.PRONE = PRONE; Actor.RAD = RAD;
})();
