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
    removeFrom(scene) { if (this.rig) scene.remove(this.rig.root); if (this.ropeMesh) { scene.remove(this.ropeMesh); this.ropeMesh = null; } }
    /* the rappel rope: a cord from the hook over the wall top down to the harness, drawn in the
       world so you see it in first person too (it hangs just in front of you, a little to the left) */
    updateRope() {
      const r = this.rappel, show = !!r && this.state !== 'dead';
      if (!show) { if (this.ropeMesh) this.ropeMesh.visible = false; return; }
      if (!this.ropeMesh) {
        this.ropeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1, 0.022), new THREE.MeshBasicMaterial({ color: 0x4a3f30 }));
        G.scene.add(this.ropeMesh);
      }
      const p = this.pos, tx = r.ax === 'x' ? r.s : 0, tz = r.ax === 'z' ? r.s : 0, lx = tz, lz = -tx;   // toward the wall, and to its left
      if (r.top == null) r.top = Actor.wallTop(p.x + tx * 0.5, p.y, p.z + tz * 0.5);   // a rope seen over the network
      const x = p.x + tx * 0.3 + lx * 0.1, z = p.z + tz * 0.3 + lz * 0.1;
      const y0 = p.y + (r.inv ? STAND - 0.45 : 1.0), y1 = Math.max(y0 + 0.1, r.top + 0.12);
      this.ropeMesh.visible = true;
      this.ropeMesh.position.set(x, (y0 + y1) / 2, z); this.ropeMesh.scale.set(1, y1 - y0, 1);
    }

    /* ---------------------------------------------------------------- geometry */
    fwd(out) { out = out || new THREE.Vector3(); const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
    right(out) { out = out || new THREE.Vector3(); return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
    eye(out) {
      out = out || new THREE.Vector3();
      out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
      if (this.lean) { const k = this.lean * (this.stance === 2 ? 0.15 : 0.38); out.x += Math.cos(this.yaw) * k; out.z -= Math.sin(this.yaw) * k; out.y -= Math.abs(this.lean) * 0.08; }
      // aiming with a shield: the head moves out past the shield's right edge to line up the sidearm
      if (this.shieldOp && this.shieldUp && this.ads > 0) { const k = this.ads * 0.1; out.x += Math.cos(this.yaw) * k; out.z -= Math.sin(this.yaw) * k; }
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
      if (this.rappel && this.rappel.inv) {
        // hanging upside down: head at the bottom, legs up the rope
        out.push([e.x, e.y - 0.03, e.z, 0.14, 'head']);
        out.push([p.x, p.y + h * 0.3, p.z, 0.24, 'body']);
        out.push([p.x, p.y + h * 0.45, p.z, 0.25, 'body']);
        out.push([p.x, p.y + h * 0.6, p.z, 0.22, 'body']);
        out.push([p.x, p.y + h * 0.76, p.z, 0.2, 'limb']);
        out.push([p.x, p.y + h * 0.92, p.z, 0.19, 'limb']);
        return out;
      }
      const lx = (e.x - p.x) * 0.6, lz = (e.z - p.z) * 0.6;
      out.push([e.x, e.y + 0.03, e.z, 0.14, 'head']);
      out.push([p.x + lx, p.y + h * 0.72, p.z + lz, 0.24, 'body']);
      out.push([p.x + lx * 0.6, p.y + h * 0.57, p.z + lz * 0.6, 0.25, 'body']);
      out.push([p.x, p.y + h * 0.42, p.z, 0.22, 'body']);
      out.push([p.x, p.y + h * 0.25, p.z, 0.2, 'limb']);
      out.push([p.x, p.y + h * 0.09, p.z, 0.19, 'limb']);
      // aiming past a shield exposes the gun arm beside its edge
      if (this.shieldOp && this.shieldUp && this.ads > 0.3) {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        out.push([e.x + rx * 0.13 + fx * 0.32, e.y - 0.14, e.z + rz * 0.13 + fz * 0.32, 0.08, 'limb']);
      }
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
      if (s === 2 && this.shieldOp && this.shieldUp) return;   // nobody goes prone behind a full-height shield
      this.stance = s;
    }
    /* a bot holding a shield in a fight keeps it squared up instead of sprinting with it aside */
    shieldBrace() {
      return this.isBot && this.shieldOp && this.shieldUp && !!this.bot && (!!this.bot.target || G.time - this.lastHurt < 3);
    }
    /* shield pose timers: shSide 0..1 = how far it has swung to the flank (sprinting), shBash = bash in progress */
    shieldTick(dt) {
      if (!this.shieldOp) return;
      const remoteView = GAME.client && !this.isPlayer;   // a guest only sees other people's speed, not their sprint key
      const run = this.shieldUp && this.state === 'alive' && this.stance === 0 && this.moving > 3.4 && this.ads < 0.3
        && (remoteView || (this.sprint && this.mf > 0.3 && !this.shieldBrace()));
      this.shSide = U.clamp((this.shSide || 0) + (run ? dt : -dt) / 0.2, 0, 1);
      this.shBash = Math.max(0, (this.shBash || 0) - dt);
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
      let v = this.sprint && this.mf > 0.3 && this.stance === 0 && this.ads < 0.3 && !this.carry && !this.shieldBrace() ? this.spd.run : this.spd.walk;
      v *= [1, 0.55, 0.25][this.stance];
      v *= 1 - this.ads * 0.38;
      const w = this.wpn; if (w) v *= w.def.mob || 1;
      if (this.shieldOp && this.shieldUp) v *= 0.92 * (1 - this.ads * 0.2);   // and slower still while aiming past it
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
    /* vault over a low obstacle or through a window. A window still filled with glass or a
       barricade gets smashed on the way through instead of stopping you. */
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
          let smash = null;
          const clear = !W.boxHits(fx - 0.12, p.y + top, fz - 0.12, fx + 0.12, p.y + top + 0.55, fz + 0.12);
          if (!clear) {
            // only window glass or a barricade in the way, inside a real window? break it and go through
            const op = Actor.windowAt(fx, p.y + top + 0.3, fz, 0.45);
            if (!op || !Actor.fillOnly(fx - 0.12, p.y + top, fz - 0.12, fx + 0.12, p.y + top + 0.55, fz + 0.12) || Actor.windowState(op).state === 'blocked') continue;
            smash = op;
          }
          // land on the far side
          for (let land = reach + 0.6; land <= reach + 1.6; land += 0.25) {
            const lx = p.x + f.x * land, lz = p.z + f.z * land;
            for (let dy = top; dy >= -1.6; dy -= 0.25) {
              const ly = p.y + dy;
              if (!this.blocked(lx, ly, lz, CROUCH) && this.blocked(lx, ly - 0.25, lz, 0.2)) {
                if (smash) Actor.smashWindow(smash, this);
                this.vault = { t: 0, dur: smash ? 0.65 : 0.55, from: p.clone(), to: new THREE.Vector3(lx, ly, lz), top: p.y + top + 0.1 };
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
    /* for bots: vault (smashing the glass or barricade first if need be) through the window or
       low obstacle straight ahead. Same as pressing vault. */
    vaultWindow() { return this.tryVault(); }
    doVault(dt) {
      const v = this.vault; v.t += dt;
      const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(v.from, v.to, e);
      // an arc from start to landing that peaks at v.top (also right for a crash that drops to a lower floor)
      this.pos.y = U.lerp(v.from.y, v.to.y, e) + Math.sin(k * Math.PI) * Math.max(0, v.top - Math.max(v.from.y, v.to.y));
      this.h = U.smooth(this.h, CROUCH, 15, dt); this.eyeH = this.h - 0.15;
      if (k >= 1) { this.vault = null; this.vel.set(0, 0, 0); if (v.crash) { this.stance = 1; this.h = CROUCH; } }
    }

    /* ---------------------------------------------------------------- windows
       A window is a map opening { kind:'window', axis, line, a0, a1, y0, y1, ext, nrm }: its wall
       is the voxel plane `line` on `axis`, it spans a0..a1 along the other axis and y0..y1 up.
       nrm points outward for an exterior window. */
    static winGeom(op) {
      const V = 0.25;
      return { wall: (op.line + 0.5) * V, s0: op.a0 * V, s1: (op.a1 + 1) * V, y0: op.y0 * V, y1: (op.y1 + 1) * V,
        perp: p => (op.axis === 'x' ? p.x : p.z), lat: p => (op.axis === 'x' ? p.z : p.x) };
    }
    /* the window whose opening contains world point (x, y, z), give or take `tol` metres off its wall plane */
    static windowAt(x, y, z, tol) {
      if (!G.map || !G.map.openings) return null;
      const P = { x, z };
      for (const op of G.map.openings) {
        if (op.kind !== 'window') continue;
        const g = Actor.winGeom(op), d = g.perp(P) - g.wall, l = g.lat(P);
        if (Math.abs(d) <= (tol || 0.3) && l >= g.s0 && l <= g.s1 && y >= g.y0 - 0.1 && y <= g.y1 + 0.1) return op;
      }
      return null;
    }
    /* true if every solid voxel in the box is window glass or a barricade */
    static fillOnly(x0, y0, z0, x1, y1, z1) {
      const W = G.world;
      for (let y = Math.floor(y0 * 4); y <= Math.floor(y1 * 4); y++) for (let z = Math.floor(z0 * 4); z <= Math.floor(z1 * 4); z++) for (let x = Math.floor(x0 * 4); x <= Math.floor(x1 * 4); x++) {
        const m = W.get(x, y, z);
        if (m && m !== M.GLASS && m !== M.BARR) return false;
      }
      return true;
    }
    /* what fills a window: 'open', 'fill' (glass and/or a barricade to smash) or 'blocked'
       (reinforced, rubble, a bunker plate or deployable cover across it) */
    static windowState(op) {
      const W = G.world, g = Actor.winGeom(op);
      let fill = 0, glass = 0, barr = 0, blocked = 0;
      for (let a = op.a0; a <= op.a1; a++) for (let y = op.y0; y <= op.y1; y++) {
        const m = op.axis === 'x' ? W.get(op.line, y, a) : W.get(a, y, op.line);
        if (!m) continue;
        if (m === M.GLASS) { glass++; fill++; } else if (m === M.BARR) { barr++; fill++; } else blocked++;
      }
      // gadgets standing in the opening (bunker plates, deployable cover)
      const ax = op.axis === 'x';
      for (const e of G.ents) if (e.alive && e.solid) {
        const b = e.solid, lo = ax ? b.z0 : b.x0, hi = ax ? b.z1 : b.x1, pl = ax ? [b.x0, b.x1] : [b.z0, b.z1];
        if (hi > g.s0 + 0.1 && lo < g.s1 - 0.1 && b.y1 > g.y0 && b.y0 < g.y1 && pl[1] > g.wall - 0.5 && pl[0] < g.wall + 0.5) blocked++;
      }
      return { state: blocked ? 'blocked' : fill ? 'fill' : 'open', glass, barr };
    }
    /* the top of the wall column at (x, z) above height y, in metres (the rope's hook point) */
    static wallTop(x, y, z) {
      const W = G.world, wx = Math.floor(x * 4), wz = Math.floor(z * 4), y0 = Math.floor(y * 4);
      for (let ty = W.H - 1; ty > y0; ty--) if (W.get(wx, ty, wz)) return (ty + 1) * 0.25;
      return y + 2;
    }
    /* for bots: how to get in through exterior window `op` from outside.
       stand: the ground spot outside, square to the window, 0.45 m off the wall (walk here first)
       wallPoint: the wall face in front of it (hand to rappelAt, or face it and vaultWindow)
       ground: true when the sill is low enough to vault from the ground (a 1F window)
       Then on the rope: climb (mf = 1) until ropeWindow() === op, and call crashWindow(). */
    static windowApproach(op) {
      if (!op || op.kind !== 'window' || !op.ext) return null;
      const g = Actor.winGeom(op), mid = (g.s0 + g.s1) / 2, gy = (MAPS.GY + 1) * 0.25;
      const at = (d, y) => op.axis === 'x' ? new THREE.Vector3(g.wall + op.nrm * d, y, mid) : new THREE.Vector3(mid, y, g.wall + op.nrm * d);
      return { stand: at(0.45, gy), wallPoint: at(0.13, gy), ground: g.y0 - gy <= 1.3, sill: g.y0 };
    }
    /* break the glass and barricade out of a window, loudly */
    static smashWindow(op, by) {
      const W = G.world, g = Actor.winGeom(op), st = Actor.windowState(op);
      const mid = (g.s0 + g.s1) / 2, c = op.axis === 'x' ? new THREE.Vector3(g.wall, (g.y0 + g.y1) / 2, mid) : new THREE.Vector3(mid, (g.y0 + g.y1) / 2, g.wall);
      for (let a = op.a0; a <= op.a1; a++) for (let y = op.y0; y <= op.y1; y++) {
        const x = op.axis === 'x' ? op.line : a, z = op.axis === 'x' ? a : op.line, m = W.get(x, y, z);
        if (m === M.GLASS || m === M.BARR) W.breakVoxel(x, y, z);
      }
      if (st.glass) SFX.glass(c);
      if (st.barr) SFX.wood(c, true);
      SFX.melee(c);
      GAME.noise(c, 40, by, 'breach');
      // an online guest asks the host to break it for everyone
      if (GAME.client && by === G.player && window.NP) NP.act('smash', { w: G.map.openings.indexOf(op) });
      return st;
    }

    /* rappel: hang on an exterior wall you are facing. Attackers only. */
    rappelProbe() {
      // (the defuser rides along on the rope; an escorted hostage can't)
      // outside the building (an awning or a sign overhead doesn't matter)
      if (this.state !== 'alive' || this.side !== 'atk' || (this.carry && this.carry.hostage) || this.rappel || this.vault || !G.map || Actor.indoors(this.pos.x, this.pos.y, this.pos.z)) return null;
      const f = this.fwd(U.v1); f.y = 0; f.normalize();
      // snap to the dominant axis
      const ax = Math.abs(f.x) > Math.abs(f.z) ? 'x' : 'z', s = ax === 'x' ? Math.sign(f.x) : Math.sign(f.z);
      const W = G.world, p = this.pos;
      const px = p.x + (ax === 'x' ? s * 0.5 : 0), pz = p.z + (ax === 'z' ? s * 0.5 : 0);
      // an outside wall in front, at chest height or above a doorway
      const hookable = h => { const m = W.get(Math.floor(px * 4), Math.floor((p.y + h) * 4), Math.floor(pz * 4)); return m && m !== DATA.OOB && (MAT[m].wall || m === M.CONC_DARK || m === M.CONCRETE || MAT[m].reinf || m === M.GLASS || m === M.BARR); };
      if (!hookable(1.2) && !hookable(2.6)) return null;
      // and it has to be a building's outside wall, not a container, a truck or a cover wall
      if (!G.map.buildings.some(b => px * 4 >= b.x0 - 1 && px * 4 <= b.x1 + 2 && pz * 4 >= b.z0 - 1 && pz * 4 <= b.z1 + 2)) return null;
      return { ax, s };
    }
    tryRappel() {
      const pr = this.rappelProbe(); if (!pr) return false;
      const { ax, s } = pr, p = this.pos, W = G.world;
      // the rope hooks over the top of this wall
      this.rappel = { ax, s, inv: false, top: Actor.wallTop(p.x + (ax === 'x' ? s * 0.5 : 0), p.y, p.z + (ax === 'z' ? s * 0.5 : 0)) };
      this.yaw = ax === 'x' ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : (s > 0 ? Math.PI : 0);
      this.vel.set(0, 0, 0); this.stance = 0; this.leanT = 0;
      SFX.hook(p); GAME.noise(p, 10, this, 'step');
      return true;
    }
    /* for bots: turn to face the outside wall at `wallPoint` (or just beyond it) and hook on */
    rappelAt(wallPoint) {
      if (!wallPoint) return false;
      const dx = wallPoint.x - this.pos.x, dz = wallPoint.z - this.pos.z;
      if (dx * dx + dz * dz > 2.5 * 2.5) return false;
      this.yaw = Math.atan2(-dx, -dz); this.pitch = 0;
      return this.tryRappel();
    }
    /* hang upside down on the rope (head at the bottom) to peek into a window from above, or turn back */
    ropeInvert() {
      const r = this.rappel; if (!r || this.state !== 'alive') return false;
      r.inv = !r.inv; SFX.whoosh(this.pos);
      return true;
    }
    /* drop off the rope */
    ropeLetGo() { if (!this.rappel) return false; this.rappel = null; return true; }
    /* the exterior window right beside you on the rope that you could crash through now, or null */
    ropeWindow() {
      const r = this.rappel; if (!r || !G.map) return null;
      const p = this.pos;
      for (const op of G.map.openings) {
        if (op.kind !== 'window' || !op.ext || op.axis !== r.ax || op.nrm !== -r.s) continue;
        const g = Actor.winGeom(op), d = (g.perp(p) - g.wall) * op.nrm, l = g.lat(p);
        if (d < 0 || d > 1.0 || l < g.s0 + 0.05 || l > g.s1 - 0.05) continue;
        if (p.y < g.y0 - 1.15 || p.y > g.y0 + 0.6) continue;
        return op;
      }
      return null;
    }
    /* crash feet-first through the window beside you on the rope: smashes its glass or barricade,
       lands you inside crouched, and makes a racket. False (with this.crashFail saying why) when
       there's no window here, it's reinforced or blocked, or there's no floor to land on. */
    crashWindow() {
      this.crashFail = '';
      const op = this.ropeWindow(); if (!op || this.state !== 'alive') { this.crashFail = 'NO WINDOW HERE'; return false; }
      const st = Actor.windowState(op);
      if (st.state === 'blocked') { this.crashFail = 'WINDOW IS REINFORCED OR BLOCKED'; return false; }
      const g = Actor.winGeom(op), fy = (op.L * 12 + 1) * 0.25, p = this.pos;
      // land straight in from where you hang if there's room, else anywhere across the window's width
      const lo = g.s0 + RAD + 0.02, hi = g.s1 - RAD - 0.02, l0 = U.clamp(g.lat(p), lo, hi);
      const lats = [l0, (lo + hi) / 2, lo, hi, (l0 + lo) / 2, (l0 + hi) / 2];
      // (a window over a two-storey hall drops you to the floor below it)
      let land = null;
      for (let drop = 0; drop <= 3.5 && !land; drop += 0.25) for (let depth = 0.6; depth <= 1.8 && !land; depth += 0.2) for (const l of lats) {
        const w = g.wall - op.nrm * depth, lx = op.axis === 'x' ? w : l, lz = op.axis === 'x' ? l : w, ly = fy - drop;
        if (!this.blocked(lx, ly, lz, CROUCH) && this.blocked(lx, ly - 0.25, lz, 0.2) && (!drop || !this.blocked(lx, fy, lz, CROUCH))) { land = new THREE.Vector3(lx, ly, lz); break; }
      }
      if (!land) { this.crashFail = 'NO ROOM TO LAND'; return false; }
      Actor.smashWindow(op, this);
      this.rappel = null;
      this.vault = { t: 0, dur: 0.5, from: p.clone(), to: land, top: Math.max(p.y, fy) + 0.25, crash: true };
      this.trigger = false; this.ads = 0;
      SFX.whoosh(p); G.emit('crash');
      return true;
    }
    doRappel(dt) {
      const r = this.rappel, p = this.pos, W = G.world;
      this.h = STAND; this.eyeH = r.inv ? 0.3 : STAND - 0.15;
      const up = this.mf * 2.2, side = this.mr * 1.6;
      const sx = r.ax === 'x' ? 0 : (r.s > 0 ? -1 : 1), sz = r.ax === 'z' ? 0 : (r.s > 0 ? 1 : -1);
      // move sideways along wall
      const nx = p.x + sx * side * dt, nz = p.z + sz * side * dt;
      if (!this.blocked(nx, p.y, nz, this.h)) { p.x = nx; p.z = nz; }
      const ny = p.y + up * dt;
      if (up < 0 && this.blocked(p.x, ny, p.z, 0.05)) { this.rappel = null; return; }
      // upside down you can't climb past the hook
      // (and nobody climbs past the hook into thin air)
      const capped = up > 0 && r.top != null && (r.inv ? ny + STAND > r.top + 0.1 : ny > r.top + 0.3);
      if (!this.blocked(p.x, ny, p.z, this.h) && !capped) p.y = ny;
      // climbed above the wall top: step onto the roof
      const wx = p.x + (r.ax === 'x' ? r.s * 0.5 : 0), wz = p.z + (r.ax === 'z' ? r.s * 0.5 : 0);
      const wallTop = W.boxHits(wx - 0.1, p.y + 0.2, wz - 0.1, wx + 0.1, p.y + 0.6, wz + 0.1);
      // (only up at the hook: climbing past a doorway or an open window doesn't tip you in through it)
      if (!wallTop && up > 0 && !r.inv && (r.top == null || p.y > r.top - 1.2)) {
        const tx = p.x + (r.ax === 'x' ? r.s * 0.9 : 0), tz = p.z + (r.ax === 'z' ? r.s * 0.9 : 0);
        // the roof can sit a little below your feet once they clear a parapet
        for (let dy = -0.75; dy <= 1.2; dy += 0.25) if (!this.blocked(tx, p.y + dy, tz, CROUCH) && this.blocked(tx, p.y + dy - 0.25, tz, 0.2)) {
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
      this.shieldTick(dt);
      if (this.state === 'dbno') {
        this.bleed -= dt;
        if (!this.hostage && Math.floor(this.bleed + dt) !== Math.floor(this.bleed)) { this.hp = Math.max(1, Math.ceil(this.bleed * 20 / 25)); }
        if (this.bleed <= 0) this.die(this.downedBy, false);
      }
    }

    /* ------------------------------------------------------------- 3rd person */
    updateRig(dt, visible) {
      this.updateRope();
      const r = this.rig; if (!r) return;
      r.root.visible = visible;
      if (!visible) return;
      r.root.position.copy(this.pos);
      r.root.rotation.y = this.yaw;
      r.pose.rotation.z = 0;
      if (this.rappel && this.rappel.inv && this.state === 'alive') {
        // hanging upside down from the rope: the whole body flipped about its middle, head at the bottom
        r.pose.rotation.set(0, 0, Math.PI); r.pose.position.set(0, STAND, 0);
        r.hips.position.y = 13 * MD.S; r.torso.rotation.set(0, 0, 0);
        r.thighL.rotation.x = 0.15; r.thighR.rotation.x = -0.1; r.shinL.rotation.x = -0.3; r.shinR.rotation.x = -0.1;
        r.aim.rotation.x = -this.pitch; r.head.rotation.x = -this.pitch * 0.4;
        return;
      }
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
      if (r.shield) {
        // the same poses the hit test uses (WPN.shieldRect): square in front, aside to aim, round to the flank to run
        if (GAME.client && !this.isPlayer) this.shieldTick(dt);
        const k = this.ads || 0, sd = this.shSide || 0, bs = this.shBash > 0 ? Math.sin(this.shBash / 0.3 * Math.PI) : 0, S = MD.S;
        r.shield.position.set((-1 - 3 * k - 5 * sd) * S, (-4 - k - 2 * sd) * S, (-6 + k + 5 * sd - 3.5 * bs) * S);
        r.shield.rotation.set(-r.aim.rotation.x, 0.2 * k + 1.25 * sd, 0);   // stays upright whatever the arms do
      }
      if (this.rappel) { r.thighL.rotation.x = 0.9; r.thighR.rotation.x = 0.7; r.shinL.rotation.x = -0.9; r.shinR.rotation.x = -0.8; }
    }
    tint(k) { if (this.rig) this.rig.mat.color.setRGB(k[0], k[1], k[2]); }
  }

  window.Actor = Actor;
  window.WState = WState;
  Actor.STAND = STAND; Actor.CROUCH = CROUCH; Actor.PRONE = PRONE; Actor.RAD = RAD;
})();
