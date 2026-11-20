/* mapmech.js -- the machinery some maps are built round. A map lists its mechanics in B.meta.mech
   (voxel coordinates from its own plan; maps.js carries them through the stretch); at the start of
   every round they are set up as entities here. Each is usable by players and by bots, and runs on the
   host (guests see the result: entity positions, voxels, a few events).

     lift      a car between floors in a shaft: call it, ride it        { kind, x0,x1,z0,z1, stops:[y,...] }
     mover     a platform that shuttles along waypoints, carrying people { kind, x0,x1,z0,z1, y, pts:[{x,z,y}], speed, dwell }
     train     a train through a tunnel: horn, then death on the track   { kind, axis, line0,line1 (z0,z1 or x0,x1), a0,a1, y, every }
     bridge    a deck that lifts away and comes back (lever and timer)   { kind, x0,x1,z0,z1, y0,y1, lever:{x,z,y}, every }
     grille    bars across openings, from a security panel               { kind, boxes:[{x0,x1,z0,z1,y0,y1}], panel:{x,z,y} }
     lights    rooms that go dark from a panel                           { kind, rooms:[names], panel:{x,z,y}, label }
     conveyor  floor that carries you                                    { kind, x0,x1,z0,z1, y, dx, dz }
     water     a hall that floods (a valve, broken tank glass, the tide)  { kind, x0,x1,z0,z1, y0, y1, valve:{x,z,y}, tank:{x0..}, tide }
     gas       a room's fire-suppression gas, from a pull station        { kind, x0,x1,z0,z1, y0, panel:{x,z,y}, room }
     props     timber props holding a ceiling up: break them, it falls   { kind, boxes:[props], x0,x1,z0,z1, y0,y1 (the ceiling) }
     slider    a wall section that runs along a track (scenery flats)    { kind, x0,x1,z0,z1, y0,y1, dx, dz, panel:{x,z,y} }
     sawdust   floor where any blast or fire starts a fire that spreads  { kind, x0,x1,z0,z1, y }
   Coordinates are voxels; y values are voxel heights (12 per storey: a floor surface at 12L+1). */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent;
  const MECH = window.MECH = { list: [] };
  const VS = 0.25;
  const pv = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  const box3 = (m, y0, y1) => ({ x0: m.x0 * VS, x1: (m.x1 + 1) * VS, z0: m.z0 * VS, z1: (m.z1 + 1) * VS, y0, y1 });
  const inFoot = (b, p, pad) => p.x > b.x0 - (pad || 0) && p.x < b.x1 + (pad || 0) && p.z > b.z0 - (pad || 0) && p.z < b.z1 + (pad || 0);
  Object.assign(GAD.NAMES, { platform: 'Platform', train: 'Train', mechpanel: 'Control panel', water: 'Flood water', gasroom: 'Suppression gas' });
  ['platform', 'train', 'mechpanel', 'water', 'gasroom', 'bridgeleaf'].forEach(t => { GAD.MESH_FN[t] = () => new THREE.Group(); });
  Object.assign(GAD.EXTRA, {
    mechpanel: g => { g.box(-3, -4, 0, 3, 4, 2, 0x2a2e34); g.box(-2, -3, -1, 2, 3, -1, 0x1a1c20); g.set(-1, 1, -2, MD.glow(0x60f0a0)); g.set(1, 1, -2, MD.glow(0xff5a3a)); g.set(0, -2, -2, MD.glow(0xe0c050)); },
  });
  const solidMesh = (w, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));

  /* ------------------------------------------------------------ the base */
  /* a solid box that moves: people standing on it go with it, people in its way stop it (or, a train,
     are killed). Heights stay on the quarter-metre grid people stand on */
  class Platform extends Ent {
    constructor(def, p, w, d, thick, color, kind) {
      super(kind || 'platform', null, p, { team: -1, model: false, hp: 999, bulletproof: true, hitR: 0, melee: false });
      this.model = kind || 'platform'; this.def = def; this.w = w; this.d = d; this.thick = thick || 0.25; this.blastproof = true; this.meleeable = false;
      this.mesh = new THREE.Group(); const slab = solidMesh(w, this.thick, d, color || 0x5a6068); slab.position.y = -this.thick / 2; this.mesh.add(slab);
      this.mesh.position.copy(p); G.scene.add(this.mesh);
      this.setBox();
    }
    setBox() { const p = this.pos; this.solid = this.hitBox = { x0: p.x - this.w / 2, x1: p.x + this.w / 2, y0: p.y - this.thick, y1: p.y, z0: p.z - this.d / 2, z1: p.z + this.d / 2 }; }
    riders() { const b = this.solid; return G.actors.filter(a => a.state !== 'dead' && Math.abs(a.pos.y - b.y1) < 0.08 && inFoot(b, a.pos, 0.1)); }
    // is anyone (not riding) in the way of moving by (dx, dy, dz)?
    blockedBy(dx, dy, dz) {
      const b = this.solid, R = this.riders();
      const n = { x0: b.x0 + Math.min(0, dx), x1: b.x1 + Math.max(0, dx), y0: b.y0 + Math.min(0, dy), y1: b.y1 + Math.max(0, dy), z0: b.z0 + Math.min(0, dz), z1: b.z1 + Math.max(0, dz) };
      return G.actors.find(a => a.state !== 'dead' && !R.includes(a) && a.pos.x + 0.24 > n.x0 && a.pos.x - 0.24 < n.x1 && a.pos.z + 0.24 > n.z0 && a.pos.z - 0.24 < n.z1 && a.pos.y + 1.7 > n.y0 && a.pos.y < n.y1);
    }
    moveBy(dx, dy, dz) {
      const R = this.riders();
      this.pos.x += dx; this.pos.y += dy; this.pos.z += dz; this.setBox();
      for (const a of R) { a.pos.x += dx; a.pos.y += dy; a.pos.z += dz; if (dy) a.onGround = true; }
      this.mesh.position.copy(this.pos);
    }
  }
  MECH.Platform = Platform;

  /* ------------------------------------------------------------- panels */
  /* a box on a wall (or a lever) anyone can work with interact; one bullet doesn't stop it */
  class Panel extends Ent {
    constructor(def, p, label, run, ok) { super('mechpanel', null, p, { team: -1, model: 'mechpanel', upright: true, hp: 999, bulletproof: true, hitR: 0.1 }); this.blastproof = true; this.meleeable = false; this.label = label; this.run = run; this.okFn = ok; this.def = def; }
  }
  const panelAt = (def, q, label, run, ok) => new Panel(def, V().set((q.x + 0.5) * VS, (q.y || 13) * VS + 1.1, (q.z + 0.5) * VS), label, run, ok);

  /* ================================================================= LIFT */
  class Lift extends Platform {
    constructor(def) {
      const w = (def.x1 - def.x0 + 1) * VS, d = (def.z1 - def.z0 + 1) * VS;
      super(def, V().set((def.x0 + def.x1 + 1) / 2 * VS, def.stops[0] * VS, (def.z0 + def.z1 + 1) / 2 * VS), w - 0.1, d - 0.1, 0.25, 0x6a7078, 'platform');
      this.stops = def.stops.map(y => y * VS); this.at = 0; this.target = 0; this.speed = 2.0; this.wait = 0; this.kind = 'lift';
      // a cage: rails round three sides, so it reads as a lift car
      for (const [x, z, ww, dd] of [[0, -d / 2 + 0.05, w - 0.1, 0.05], [0, d / 2 - 0.05, w - 0.1, 0.05]]) { const r = solidMesh(ww, 1.0, dd, 0x8a9098); r.position.set(x, 0.5, z); this.mesh.add(r); }
      // NAV: landing to landing (the walkable floor nearest the shaft on each level), both ways
      // (the nearest walkable floor at that stop's height outside the shaft, up to 8 m away)
      const land = i => {
        NAV.refresh && NAV.refresh();
        const st = this.stops[i], cx = Math.floor(this.pos.x * 2), cz = Math.floor(this.pos.z * 2);
        for (let r = 0; r <= 16; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= NAV.NW || nz >= NAV.ND) continue;
          if (Math.abs((nx + 0.5) / 2 - this.pos.x) < w / 2 + 0.1 && Math.abs((nz + 0.5) / 2 - this.pos.z) < d / 2 + 0.1) continue;
          const ci = nz * NAV.NW + nx;
          for (const y of NAV.cols[ci] || []) if (Math.abs(y / 4 - st) < 0.3 && (!NAV.main || NAV.main.has(ci * 64 + y))) return NAV.nodePos(ci * 64 + y);
        }
        return null;
      };
      for (let i = 0; i + 1 < this.stops.length; i++) { const p = land(i), q = land(i + 1); if (p && q && Math.abs(p.y - this.stops[i]) < 0.6 && Math.abs(q.y - this.stops[i + 1]) < 0.6) NAV.addLink(p, q, 'lift', 6, { lift: this, a: i, b: i + 1 }); }
    }
    stopSpot(i) { return V().set(this.pos.x, this.stops[i], this.pos.z); }
    call(i) { if (this.target !== i) { this.target = i; SFX.beep(this.pos, 880, 0.12); } }
    update(dt) {
      this.t += dt;
      const ty = this.stops[this.target], dy = ty - this.pos.y;
      if (Math.abs(dy) < 0.01) { if (this.at !== this.target) { this.at = this.target; SFX.beep(this.pos, 1320, 0.1); SFX.metal(this.pos); GAME.noise(this.pos, 12, null, 'gadget'); } return; }
      this.acc = (this.acc || 0) + this.speed * dt;
      while (this.acc >= VS) {
        this.acc -= VS;
        const s = Math.sign(dy) * VS;
        if (this.blockedBy(0, s, 0)) { this.acc = 0; break; }    // (someone under it: it waits)
        this.moveBy(0, s, 0);
        if ((this.hum = (this.hum || 0) - 1) <= 0) { this.hum = 4; GAME.noise(this.pos, 10, null, 'gadget'); }
        if (Math.abs(this.stops[this.target] - this.pos.y) < 0.01) break;
      }
    }
    nearestStop(y) { let b = 0; for (let i = 1; i < this.stops.length; i++) if (Math.abs(this.stops[i] - y) < Math.abs(this.stops[b] - y)) b = i; return b; }
  }

  /* ================================================================ MOVER */
  /* a platform that goes round its waypoints on its own: a window cleaner's gondola, a jet bridge, a
     log carriage, a mine cart. It waits `dwell` s at each */
  class Mover extends Platform {
    constructor(def) {
      const w = (def.x1 - def.x0 + 1) * VS, d = (def.z1 - def.z0 + 1) * VS;
      const p0 = V().set((def.x0 + def.x1 + 1) / 2 * VS, (def.y || 13) * VS, (def.z0 + def.z1 + 1) / 2 * VS);
      super(def, p0, w, d, def.thick || 0.25, def.color || 0x6a6e74, 'platform');
      // waypoints: where the platform's centre goes (voxels; y in voxels too)
      this.pts = [p0.clone()].concat((def.pts || []).map(q => V().set(q.x != null ? (q.x + 0.5) * VS : p0.x, (q.y != null ? q.y : def.y || 13) * VS, q.z != null ? (q.z + 0.5) * VS : p0.z)));
      this.i = 0; this.dir = 1; this.wait = def.dwell || 4; this.speed = def.speed || 1.4; this.kind = 'mover';
      if (def.rails !== false) for (const s of [-1, 1]) { const r = solidMesh(def.axis === 'z' ? 0.05 : w, 1.0, def.axis === 'z' ? d : 0.05, 0x8a9098); if (def.axis === 'z') r.position.set(s * (w / 2 - 0.03), 0.5, 0); else r.position.set(0, 0.5, s * (d / 2 - 0.03)); this.mesh.add(r); }
      if (def.cargo) { const c = solidMesh(w * 0.8, def.cargo, d * 0.5, def.cargoColor || 0x7a5634); c.position.y = def.cargo / 2; this.mesh.add(c); this.cargo = def.cargo; }
    }
    setBox() {
      super.setBox();
      if (this.cargo) { const p = this.pos; this.solid = { x0: p.x - this.w * 0.4, x1: p.x + this.w * 0.4, y0: p.y - this.thick, y1: p.y + this.cargo, z0: p.z - this.d * 0.25, z1: p.z + this.d * 0.25 }; this.hitBox = this.solid; }
    }
    update(dt) {
      this.t += dt;
      if (this.wait > 0) { this.wait -= dt; return; }
      const next = this.i + this.dir; if (next < 0 || next >= this.pts.length) { this.dir *= -1; return; }
      const to = this.pts[next], d = to.clone().sub(this.pos), L = d.length();
      if (L < 0.02) { this.i = next; this.wait = this.def.dwell || 4; SFX.metal(this.pos); return; }
      // horizontal: smooth; vertical: in quarter-metre steps
      const step = Math.min(L, this.speed * dt); d.multiplyScalar(step / L);
      let dy = 0; this.yAcc = (this.yAcc || 0) + d.y; if (Math.abs(this.yAcc) >= VS) { dy = Math.sign(this.yAcc) * VS; this.yAcc -= dy; }
      if (Math.abs(to.y - this.pos.y) < VS * 0.5) dy = 0;
      if (this.blockedBy(d.x, dy, d.z)) return;
      this.moveBy(d.x, dy, d.z);
      if (Math.abs(to.x - this.pos.x) < 0.02 && Math.abs(to.z - this.pos.z) < 0.02 && Math.abs(to.y - this.pos.y) > VS * 0.5) { this.moveBy(0, Math.sign(to.y - this.pos.y) * VS, 0); }
      if ((this.hum = (this.hum || 0) - dt) <= 0) { this.hum = 0.8; GAME.noise(this.pos, 9, null, 'gadget'); }
    }
  }

  /* ================================================================ TRAIN */
  /* every `every` seconds a train runs the tunnel (alternate ways), 14 m/s: a horn and a light 4 s before,
     and anyone or anything on the track when it comes through is gone */
  class Train extends Ent {
    constructor(def) {
      super('train', null, V(), { team: -1, model: false, hp: 999, bulletproof: true, hitR: 0, melee: false });
      this.model = 'train'; this.def = def; this.blastproof = true; this.meleeable = false;
      // the track: x0..x1 by z0..z1 (voxels), running along `axis`
      const ax = def.axis || ((def.x1 - def.x0) >= (def.z1 - def.z0) ? 'x' : 'z');
      this.ax = ax;
      if (ax === 'x') { this.a0 = def.x0 * VS; this.a1 = (def.x1 + 1) * VS; this.l0 = def.z0 * VS; this.l1 = (def.z1 + 1) * VS; }
      else { this.a0 = def.z0 * VS; this.a1 = (def.z1 + 1) * VS; this.l0 = def.x0 * VS; this.l1 = (def.x1 + 1) * VS; }
      this.y = (def.y || 1) * VS;
      this.len = 26; this.every = def.every || 45; this.next = 12 + Math.random() * 10; this.runs = 0; this.on = false;
      this.mesh = new THREE.Group();
      const body = solidMesh(ax === 'x' ? this.len : this.l1 - this.l0 - 0.3, 2.6, ax === 'x' ? this.l1 - this.l0 - 0.3 : this.len, 0x3a5a7a); body.position.y = 1.5; this.mesh.add(body);
      for (let i = -3; i <= 3; i++) { const win = solidMesh(ax === 'x' ? 2.2 : this.l1 - this.l0 - 0.25, 0.6, ax === 'x' ? this.l1 - this.l0 - 0.25 : 2.2, 0xd8e8f0); win.position.set(ax === 'x' ? i * 3.6 : 0, 2.0, ax === 'x' ? 0 : i * 3.6); this.mesh.add(win); }
      const light = solidMesh(0.3, 0.3, 0.3, 0xfff6c8); this.light = light; this.mesh.add(light);
      this.mesh.visible = false; G.scene.add(this.mesh);
    }
    track() { return this.ax === 'x' ? { x0: this.a0, x1: this.a1, z0: this.l0, z1: this.l1 } : { x0: this.l0, x1: this.l1, z0: this.a0, z1: this.a1 }; }
    update(dt) {
      this.t += dt;
      if (!this.on) {
        this.next -= dt;
        if (this.next < 4 && !this.warned) { this.warned = true; const T = this.track(), c = V().set((T.x0 + T.x1) / 2, this.y + 1, (T.z0 + T.z1) / 2); SFX.beep(c, 330, 0.8); SFX.beep(c, 262, 0.8); GAME.noise(c, 60, null, 'gadget'); GAD.tellTeam(0, 'A train is coming'); GAD.tellTeam(1, 'A train is coming'); }
        if (this.next <= 0) { this.on = true; this.warned = false; this.dir = this.runs++ % 2 ? -1 : 1; this.s = this.dir > 0 ? this.a0 - this.len : this.a1 + this.len; this.mesh.visible = true; }
        return;
      }
      this.s += this.dir * 14 * dt;
      const c = (this.l0 + this.l1) / 2, mid = this.s + this.dir * this.len / 2;
      if (this.ax === 'x') this.pos.set(this.s + this.dir * this.len / 2, this.y, c); else this.pos.set(c, this.y, this.s + this.dir * this.len / 2);
      this.mesh.position.copy(this.pos); this.light.position.set(this.ax === 'x' ? this.dir * this.len / 2 : 0, 1.2, this.ax === 'x' ? 0 : this.dir * this.len / 2);
      const h = this.len / 2, T = this.ax === 'x' ? { x0: this.pos.x - h, x1: this.pos.x + h, z0: this.l0, z1: this.l1 } : { x0: this.l0, x1: this.l1, z0: this.pos.z - h, z1: this.pos.z + h };
      this.solid = this.hitBox = Object.assign({ y0: this.y, y1: this.y + 2.9 }, T);
      for (const a of G.actors) if (a.state !== 'dead' && a.pos.x > T.x0 - 0.2 && a.pos.x < T.x1 + 0.2 && a.pos.z > T.z0 - 0.2 && a.pos.z < T.z1 + 0.2 && a.pos.y < this.y + 2.6 && a.pos.y > this.y - 1) a.hurt(999, { kind: 'train' });
      for (const e of G.ents) if (e.alive && e !== this && e.type !== 'platform' && e.pos.x > T.x0 && e.pos.x < T.x1 && e.pos.z > T.z0 && e.pos.z < T.z1 && e.pos.y < this.y + 2.6 && e.pos.y > this.y - 0.5 && !e.blastproof) e.destroy('blast');
      if ((this.rumble = (this.rumble || 0) - dt) <= 0) { this.rumble = 0.4; GAME.noise(this.pos, 40, null, 'explosion'); SFX.whoosh(this.pos); }
      if ((this.dir > 0 && this.s > this.a1 + this.len) || (this.dir < 0 && this.s < this.a0 - this.len)) { this.on = false; this.solid = this.hitBox = null; this.mesh.visible = false; this.next = this.every; }
    }
  }

  /* =============================================================== BRIDGE */
  /* the deck (its voxels) lifts away: gone from the floor, shown standing up at its hinge end; it
     comes back down when it is clear. A lever in the control house, or every `every` s by itself */
  class Bridge extends Ent {
    constructor(def) {
      super('bridgeleaf', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, (def.y1 + 1) * VS, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, bulletproof: true, hitR: 0, melee: false });
      this.model = 'bridgeleaf'; this.def = def; this.blastproof = true; this.meleeable = false; this.up = false; this.next = def.every || 60;
      this.cells = []; const W = G.world;
      for (let y = def.y0; y <= def.y1; y++) for (let z = def.z0; z <= def.z1; z++) for (let x = def.x0; x <= def.x1; x++) { const m = W.get(x, y, z); if (m) this.cells.push([x, y, z, m]); }
      const ax = def.axis || ((def.x1 - def.x0) > (def.z1 - def.z0) ? 'x' : 'z'), L = ax === 'x' ? (def.x1 - def.x0 + 1) * VS : (def.z1 - def.z0 + 1) * VS, Wd = ax === 'x' ? (def.z1 - def.z0 + 1) * VS : (def.x1 - def.x0 + 1) * VS;
      this.raised = solidMesh(ax === 'x' ? 0.5 : Wd, L, ax === 'x' ? Wd : 0.5, 0x5a5048);
      this.raised.position.set(ax === 'x' ? def.x1 * VS : this.pos.x, this.pos.y + L / 2, ax === 'x' ? this.pos.z : def.z1 * VS); this.raised.visible = false;
      this.mesh = new THREE.Group(); this.mesh.add(this.raised); G.scene.add(this.mesh);
      if (def.lever) this.lever = panelAt(def, def.lever, () => this.up ? 'LOWER THE BRIDGE' : 'RAISE THE BRIDGE', () => this.toggle());
    }
    toggle() {
      const W = G.world;
      if (!this.up) { for (const c of this.cells) if (W.get(c[0], c[1], c[2]) === c[3]) W.set(c[0], c[1], c[2], 0); this.up = true; this.raised.visible = true; SFX.metal(this.pos); GAME.noise(this.pos, 50, null, 'gadget'); GAD.tellTeam(0, 'The bridge is going up'); GAD.tellTeam(1, 'The bridge is going up'); }
      else {
        const b = { x0: this.def.x0 * VS, x1: (this.def.x1 + 1) * VS, z0: this.def.z0 * VS, z1: (this.def.z1 + 1) * VS };
        if (G.actors.some(a => a.state !== 'dead' && inFoot(b, a.pos, 0.2) && Math.abs(a.pos.y - this.pos.y) < 2)) return false;
        for (const c of this.cells) if (!W.get(c[0], c[1], c[2])) W.set(c[0], c[1], c[2], c[3]);
        this.up = false; this.raised.visible = false; SFX.metal(this.pos); GAME.noise(this.pos, 50, null, 'gadget');
      }
      this.next = this.def.every || 60; return true;
    }
    update(dt) { this.t += dt; if (GAME.phase === 'action' && (this.next -= dt) <= 0) { if (!this.toggle()) this.next = 2; } }
  }

  /* ============================================================== GRILLE */
  /* vertical bars across openings: bodies can't pass, eyes and rounds go through the gaps */
  class Grille extends Ent {
    constructor(def) {
      super('grille', null, V(), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.on = false; this.blastproof = true; this.meleeable = false; this.cd = 0;
      if (def.panel) this.panel = panelAt(def, def.panel, () => this.on ? 'LIFT THE LOCKDOWN' : 'LOCKDOWN', () => this.toggle(), () => G.time > this.cd);
      this.next = def.every || 0;
    }
    cellsOf(b, fn) { for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) { const along = b.x1 - b.x0 >= b.z1 - b.z0 ? x : z; if (along % 2 === 0) fn(x, y, z); } }
    toggle() {
      if (G.time < this.cd) return false; this.cd = G.time + 8;
      const W = G.world, on = !this.on;
      for (const b of this.def.boxes) this.cellsOf(b, (x, y, z) => { const m = W.get(x, y, z); if (on && !m && !G.actors.some(a => a.state !== 'dead' && Math.abs(a.pos.x - (x + 0.5) * VS) < 0.3 && Math.abs(a.pos.z - (z + 0.5) * VS) < 0.3 && a.pos.y < (y + 1) * VS && a.pos.y + 1.8 > y * VS)) W.set(x, y, z, M.MECH_BARS); else if (!on && m === M.MECH_BARS) W.set(x, y, z, 0); });
      this.on = on; GAD.tellTeam(0, on ? 'LOCKDOWN: the grilles are down' : 'The grilles are up'); GAD.tellTeam(1, on ? 'LOCKDOWN: the grilles are down' : 'The grilles are up');
      const p = this.panel ? this.panel.pos : V(); SFX.metal(p); GAME.noise(p, 45, null, 'gadget');
      return true;
    }
    update(dt) { this.t += dt; if (this.def.every && GAME.phase === 'action' && (this.next -= dt) <= 0) { this.next = this.def.every; this.toggle(); } }
  }
  DATA.mat('MECH_BARS', 0x4a5058, { pat: 'ribs' });   // unbreakable steel bars

  /* =============================================================== LIGHTS */
  /* rooms that can go dark from a panel. In the dark you see a few metres (the camera's fog closes in),
     and so do bots */
  class Lights extends Ent {
    constructor(def) {
      super('lights', null, V(), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.dark = !!def.startDark; this.blastproof = true; this.meleeable = false; this.cd = 0;
      this.rooms = new Set((def.rooms || []).flatMap(n => G.map.roomByName[n] || []));
      if (def.panel) this.panel = panelAt(def, def.panel, () => (this.dark ? 'LIGHTS ON' : 'LIGHTS OFF') + (def.label ? ' · ' + def.label : ''), () => this.toggle(), () => G.time > this.cd);
    }
    toggle() { if (G.time < this.cd) return false; this.cd = G.time + 5; this.dark = !this.dark; const p = this.panel ? this.panel.pos : V(); SFX.metal(p); GAME.noise(p, 20, null, 'gadget'); GAD.tellTeam(0, this.dark ? 'The lights are out' + (this.def.label ? ': ' + this.def.label : '') : 'The lights are back'); GAD.tellTeam(1, this.dark ? 'The lights are out' + (this.def.label ? ': ' + this.def.label : '') : 'The lights are back'); return true; }
    has(p) { const r = G.map.roomAt(p); return !!r && this.rooms.has(r); }
  }
  MECH.dark = p => G.ents.some(e => e.alive && e.type === 'lights' && e.dark && e.has(p));

  /* ============================================================= CONVEYOR */
  class Conveyor extends Ent {
    constructor(def) {
      super('conveyor', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, (def.y || 13) * VS, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.box = box3(def, (def.y || 13) * VS - 0.3, (def.y || 13) * VS + 3.4); this.v = V().set(def.dx || 0, 0, def.dz || 0); this.blastproof = true; this.meleeable = false;
    }
  }

  /* ================================================================ WATER */
  /* a flood: the level rises over 8 s, holds 40 s and drains over 10. Under water to the knees you are
     slow and loud; electronics under it die. A valve, broken tank glass or the tide sets it off */
  class Water extends Ent {
    constructor(def) {
      super('water', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, def.y0 * VS, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.blastproof = true; this.meleeable = false; this.level = 0; this.max = (def.y1 - def.y0) * VS; this.state = 'dry'; this.hold = 0;
      const w = (def.x1 - def.x0 + 1) * VS, d = (def.z1 - def.z0 + 1) * VS;
      this.mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), new THREE.MeshBasicMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.55, depthWrite: false }));
      this.mesh.position.copy(this.pos); this.mesh.scale.y = 0.001; this.mesh.visible = false; G.scene.add(this.mesh);
      if (def.valve) this.valve = panelAt(def, def.valve, () => this.state === 'dry' ? 'OPEN THE SLUICE' : 'CLOSE THE SLUICE', () => this.toggle());
      if (def.tank) { this.tankGlass = 0; const t = def.tank; for (let y = t.y0; y <= t.y1; y++) for (let z = t.z0; z <= t.z1; z++) for (let x = t.x0; x <= t.x1; x++) if (G.world.get(x, y, z) === M.GLASS) this.tankGlass++; }
      this.tideT = def.tide ? 70 : 0;
    }
    toggle() { if (this.state === 'dry' || this.state === 'drain') { this.state = 'rise'; GAD.tellTeam(0, 'Water is coming in'); GAD.tellTeam(1, 'Water is coming in'); SFX.whoosh(this.pos); } else { this.state = 'drain'; } return true; }
    under(p) { const d = this.def; return this.level > 0.05 && p.x > d.x0 * VS && p.x < (d.x1 + 1) * VS && p.z > d.z0 * VS && p.z < (d.z1 + 1) * VS && p.y < this.pos.y + this.level && p.y > this.pos.y - 1; }
    update(dt) {
      this.t += dt;
      // a tank: once enough of its glass is gone, out it comes
      if (this.def.tank && this.state === 'dry' && (this.chk = (this.chk || 0) - dt) <= 0) {
        this.chk = 0.5; const t = this.def.tank; let n = 0;
        for (let y = t.y0; y <= t.y1; y++) for (let z = t.z0; z <= t.z1; z++) for (let x = t.x0; x <= t.x1; x++) if (G.world.get(x, y, z) === M.GLASS) n++;
        if (n < this.tankGlass * 0.85) { this.toggle(); this.hold = 999; FX.burst(this.pos.clone().setY(this.pos.y + 1), 0x6ab8d8, 40, 4, 0.08, 1, 1); }
      }
      if (this.def.tide && GAME.phase === 'action' && (this.tideT -= dt) <= 0 && this.state === 'dry') { this.tideT = 999; this.toggle(); this.hold = 999; GAD.tellTeam(0, 'The tide is coming in'); GAD.tellTeam(1, 'The tide is coming in'); }
      if (this.state === 'rise') { this.level = Math.min(this.max, this.level + this.max * dt / 8); if (this.level >= this.max) { this.state = 'full'; this.hold = this.hold || 40; } }
      else if (this.state === 'full') { this.hold -= dt; if (this.hold <= 0) this.state = 'drain'; }
      else if (this.state === 'drain') { this.level = Math.max(0, this.level - this.max * dt / 10); if (this.level <= 0) this.state = 'dry'; }
      this.mesh.visible = this.level > 0.02; this.mesh.scale.y = Math.max(0.001, this.level); this.mesh.position.y = this.pos.y + this.level / 2;
      if (this.level > 0.3) for (const e of G.ents) if (e.alive && e.elec && e.type !== 'mechpanel' && this.under(e.pos)) { FX.sparks(e.pos, 0, 1, 0, 0x9ad8ff); e.destroy('used'); }
    }
  }
  MECH.waterAt = p => G.ents.find(e => e.alive && e.type === 'water' && e.under && e.under(p));

  /* ================================================================== GAS */
  /* the fire-suppression system: pulled, an alarm for 3 s, then the room fills with gas for 12 s:
     nobody sees through it, and it hurts (5 a second) whoever stays in */
  class GasRoom extends Ent {
    constructor(def) {
      super('gasroom', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, (def.y0 || 13) * VS + 1.2, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.box = box3(def, (def.y0 || 13) * VS, (def.y0 || 13) * VS + 2.8); this.state = 'ready'; this.blastproof = true; this.meleeable = false;
      if (def.panel) this.panel = panelAt(def, def.panel, () => this.state === 'ready' ? 'PULL THE SUPPRESSION' + (def.room ? ' · ' + def.room : '') : 'SUPPRESSION ' + this.state.toUpperCase(), () => this.pull(), () => this.state === 'ready');
    }
    pull() { if (this.state !== 'ready') return false; this.state = 'alarm'; this.timer = 3; GAD.tellTeam(0, 'SUPPRESSION ALARM' + (this.def.room ? ': ' + this.def.room : '')); GAD.tellTeam(1, 'SUPPRESSION ALARM' + (this.def.room ? ': ' + this.def.room : '')); return true; }
    update(dt) {
      this.t += dt;
      if (this.state === 'alarm') { if ((this.beep = (this.beep || 0) - dt) <= 0) { this.beep = 0.4; SFX.beep(this.pos, 1400, 0.2); GAME.noise(this.pos, 30, null, 'gadget'); } if ((this.timer -= dt) <= 0) { this.state = 'venting'; this.timer = 12; const b = this.box, s = Math.max(3, Math.sqrt((b.x1 - b.x0) * (b.z1 - b.z0) / 16)); for (let x = b.x0 + s / 2; x < b.x1; x += s) for (let z = b.z0 + s / 2; z < b.z1; z += s) GAD.smokeOf(null, V().set(x, b.y0 + 1.2, z), Math.max(2.4, s * 0.62), 12); } }
      else if (this.state === 'venting') {
        if ((this.tick = (this.tick || 0) - dt) <= 0) { this.tick = 1; for (const a of G.actors) if (a.state === 'alive' && inFoot(this.box, a.pos) && a.pos.y >= this.box.y0 - 0.3 && a.pos.y < this.box.y1) a.hurt(5, { kind: 'gas' }); }
        if ((this.timer -= dt) <= 0) { this.state = 'recharging'; this.timer = 40; }
      } else if (this.state === 'recharging' && (this.timer -= dt) <= 0) this.state = 'ready';
    }
  }

  /* ================================================================ PROPS */
  /* timber props under a ceiling: when most of their wood is gone (shot, blown, cut), the ceiling they
     held comes down: its voxels fall in, and anyone under it is hit for 45 and stunned */
  /* who brought a ceiling down: the last one whose shot, swing or blast hit its wood (ops3-a.js keeps
     OPS3.cause for whatever is hitting voxels), so it crushes their enemies and never their own team
     (actor.js turns away any damage from your own side) */
  const VWp = window.VW && VW.World && VW.World.prototype;
  if (VWp) for (const k of ['hitVoxel', 'set']) {
    const o = VWp[k];
    VWp[k] = function (x, y, z) {
      if (Props.live.size && window.OPS3 && OPS3.cause && OPS3.cause.isActor && this === G.world)
        for (const P of Props.live) { if (!P.alive) { Props.live.delete(P); continue; } for (const b of P.def.boxes) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1) { P.lastBy = OPS3.cause; break; } }
      return o.apply(this, arguments);
    };
  }
  class Props extends Ent {
    static live = new Set();
    constructor(def) {
      super('props', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, def.y0 * VS, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.blastproof = true; this.meleeable = false; this.fallen = false;
      this.wood = this.count(); this.chk = 0;
      Props.live.add(this);
    }
    destroy(w) { Props.live.delete(this); return super.destroy(w); }
    count() { const W = G.world; let n = 0; for (const b of this.def.boxes) for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (W.get(x, y, z)) n++; return n; }
    update(dt) {
      this.t += dt; if (this.fallen || (this.chk -= dt) > 0) return; this.chk = 0.4;
      if (this.count() > this.wood * 0.45) return;
      this.fallen = true; const d = this.def, W = G.world;
      const n = W.carve(d.x0, d.y0, d.z0, d.x1, d.y1, d.z1, () => true, 60);
      const c = this.pos.clone(); SFX.crumble(c, n); SFX.explosion(c, true); FX.puff(c, 3, 1.5, 0x8a7a64); GAME.noise(c, 70, null, 'explosion'); G.emit && G.emit('breach');
      for (const a of G.actors) if (a.state === 'alive' && a.pos.x > d.x0 * VS && a.pos.x < (d.x1 + 1) * VS && a.pos.z > d.z0 * VS && a.pos.z < (d.z1 + 1) * VS && a.pos.y < d.y0 * VS && a.pos.y > d.y0 * VS - 4) { a.hurt(45, { kind: 'explosion', src: this.lastBy || null }); a.stun = Math.max(a.stun, 1.5); }
      GAD.tellTeam(0, 'A ceiling came down'); GAD.tellTeam(1, 'A ceiling came down');
    }
  }

  /* =============================================================== SLIDER */
  /* a wall section on a track (a scenery flat): it runs `dx`/`dz` voxels along and back, from a panel */
  class Slider extends Ent {
    constructor(def) {
      super('slider', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, def.y0 * VS + 1, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false });
      this.def = def; this.blastproof = true; this.meleeable = false; this.out = false; this.cd = 0;
      const W = G.world; this.cells = [];
      for (let y = def.y0; y <= def.y1; y++) for (let z = def.z0; z <= def.z1; z++) for (let x = def.x0; x <= def.x1; x++) { const m = W.get(x, y, z); if (m) this.cells.push([x, y, z, m]); }
      if (def.panel) this.panel = panelAt(def, def.panel, () => 'MOVE THE ' + (def.label || 'FLAT'), () => this.toggle(), () => G.time > this.cd);
    }
    toggle() {
      if (G.time < this.cd) return false;
      const W = G.world, s = this.out ? -1 : 1, dx = (this.def.dx || 0) * s, dz = (this.def.dz || 0) * s;
      const from = this.out ? this.cells.map(c => [c[0] + (this.def.dx || 0), c[1], c[2] + (this.def.dz || 0), c[3]]) : this.cells;
      // nobody standing where it is going
      for (const c of from) { const x = (c[0] + dx + 0.5) * VS, z = (c[2] + dz + 0.5) * VS, y = c[1] * VS; if (G.actors.some(a => a.state !== 'dead' && Math.abs(a.pos.x - x) < 0.35 && Math.abs(a.pos.z - z) < 0.35 && a.pos.y < y + 0.25 && a.pos.y + 1.8 > y)) return false; }
      for (const c of from) if (W.get(c[0], c[1], c[2]) === c[3]) W.set(c[0], c[1], c[2], 0);
      for (const c of from) W.set(c[0] + dx, c[1], c[2] + dz, c[3]);
      this.out = !this.out; this.cd = G.time + 4; SFX.metal(this.pos); GAME.noise(this.pos, 25, null, 'gadget');
      return true;
    }
  }

  /* ============================================================== SAWDUST */
  class Sawdust extends Ent {
    constructor(def) { super('sawdust', null, V().set((def.x0 + def.x1 + 1) / 2 * VS, (def.y || 13) * VS, (def.z0 + def.z1 + 1) / 2 * VS), { team: -1, model: false, hp: 999, hitR: 0, melee: false }); this.def = def; this.box = box3(def, (def.y || 13) * VS - 0.5, (def.y || 13) * VS + 3); this.blastproof = true; this.meleeable = false; this.lit = 0; }
    // any fire on the sawdust (a blast's, or an incendiary's) creeps: each one, after 3 s, lights the
    // floor 2.6 m on, up to six at once
    update(dt) {
      this.t += dt; if ((this.chk = (this.chk || 0) - dt) > 0) return; this.chk = 1;
      const bx = this.box, on = G.ents.filter(e => e.alive && e.type === 'fire' && inFoot(bx, e.pos) && e.pos.y > bx.y0 - 0.2 && e.pos.y < bx.y1);
      if (!on.length || on.length >= 6) return;
      for (const f of on) {
        if (f.crept || f.t < 3) continue;
        f.crept = true;
        for (let k = 0; k < 6; k++) {
          const ang = Math.random() * Math.PI * 2, q = V().set(f.pos.x + Math.cos(ang) * 2.6, f.pos.y, f.pos.z + Math.sin(ang) * 2.6);
          const fx = Math.floor(q.x / VS), fy = Math.floor((q.y - 0.1) / VS), fz = Math.floor(q.z / VS);
          if (!inFoot(bx, q) || !G.world.get(fx, fy, fz) || G.world.get(fx, fy + 1, fz) || G.world.get(fx, fy + 3, fz)) continue;
          new GAD.Fire(null, q, 2.4, 10); GAME.noise(q, 12, null, 'gadget'); return;
        }
      }
    }
  }
  const oExplode = GAD.explode;
  GAD.explode = function (p, r) {
    const out = oExplode.apply(this, arguments);
    for (const s of G.ents) if (s.alive && s.type === 'sawdust' && inFoot(s.box, p) && p.y > s.box.y0 && p.y < s.box.y1 && G.time > s.lit) { s.lit = G.time + 6; new GAD.Fire(null, V().set(p.x, Math.round((s.box.y0 + 0.5) * 4) / 4 + 0.02, p.z), 3, 14); GAD.tellTeam(0, 'The sawdust is burning'); GAD.tellTeam(1, 'The sawdust is burning'); }
    return out;
  };

  /* =============================================================== setup */
  const KINDS = { lift: Lift, mover: Mover, train: Train, bridge: Bridge, grille: Grille, lights: Lights, conveyor: Conveyor, water: Water, gas: GasRoom, props: Props, slider: Slider, sawdust: Sawdust };
  MECH.setup = function () {
    MECH.list = []; MECH.assigned = false; MECH.holder = null;
    if (!G.map || !G.map.mech || GAME.client) return;
    for (const def of G.map.mech) { const C = KINDS[def.kind]; if (C) { try { MECH.list.push(new C(def)); } catch (e) { console.warn('mech', def.kind, e); } } }
    for (const m of MECH.list) for (const k of ['panel', 'lever', 'valve']) if (m[k] && m[k].type === 'mechpanel') m[k].owner = m;
  };
  // every round: the machinery is set up again (the world and the entities are new each round)
  const oStart = GAME.startRound;
  GAME.startRound = function () { const r = oStart.apply(this, arguments); MECH.setup(); return r; };

  /* ================================================================ hooks */
  OPS2.chain('interactions', function (a, out) {
    for (const e of G.ents) {
      if (!e.alive) continue;
      if (e.type === 'mechpanel' && U.dist3(e.pos, a.pos.clone().setY(a.pos.y + 1.1)) < 1.6) {
        const label = typeof e.label === 'function' ? e.label() : e.label || 'USE';
        out.push({ kind: 'mech', label, time: 0.6, ok: () => e.alive && (!e.okFn || e.okFn()), run: () => e.run && e.run(a) }); return;
      }
      if (e.type === 'platform' && e.kind === 'lift' && e.stops) {
        // at a landing: call it; standing in it: send it to the next floor up (or back down)
        const inCar = inFoot(e.solid, a.pos, 0) && Math.abs(a.pos.y - e.pos.y) < 0.1;
        const near = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < Math.max(e.w, e.d) / 2 + 1.4;
        if (inCar) { const i = e.at, j = i + 1 < e.stops.length ? i + 1 : 0; out.push({ kind: 'lift', label: 'LIFT TO ' + (j > i ? 'UPPER' : 'LOWER') + ' FLOOR', time: 0.3, ok: () => e.alive, run: () => e.call(j) }); return; }
        if (near) { const i = e.nearestStop(a.pos.y); if (Math.abs(e.stops[i] - a.pos.y) < 0.6 && e.target !== i) { out.push({ kind: 'lift', label: 'CALL THE LIFT', time: 0.3, ok: () => e.alive, run: () => e.call(i) }); return; } }
      }
    }
  });
  OPS2.chain('physics', function (a, dt) {
    // conveyors carry whoever stands on them; water slows (and splashes)
    if (a.onGround) for (const c of G.ents) {
      if (!c.alive || c.type !== 'conveyor' || !inFoot(c.box, a.pos) || a.pos.y < c.box.y0 || a.pos.y > c.box.y1) continue;
      const nx = a.pos.x + c.v.x * dt, nz = a.pos.z + c.v.z * dt, h = a.h || 1.75;
      // (up a step if it has to: an escalator carries you up its stairs)
      if (!a.blocked(nx, a.pos.y, nz, h)) { a.pos.x = nx; a.pos.z = nz; }
      else if (!a.blocked(nx, a.pos.y + 0.26, nz, h)) { a.pos.x = nx; a.pos.z = nz; a.pos.y = Math.round(a.pos.y * 4) / 4 + 0.25; }
    }
    const w = MECH.waterAt(a.pos);
    if (w) { if (a.moving > 0.5 && (a.splashT = (a.splashT || 0) - dt) <= 0) { a.splashT = 0.45; SFX.step(a.pos, true, a.isPlayer); GAME.noise(a.pos, 14, a, 'step'); } }
    return false;
  });
  // in the dark, eyes reach a few metres (bots); the screen closes in (players)
  OPS2.chain('blocksSight', function (a, e, c) { return (MECH.dark(c) || MECH.dark(e)) && U.dist3(e, c) > 6; });
  let fog0 = null;
  OPS2.chain('hudFrame', function (a, dt) {
    const f = G.scene && G.scene.fog; if (!f) return;
    if (!fog0) fog0 = { near: f.near, far: f.far, color: f.color.getHex() };
    const cam = G.camera && G.camera.position, dark = cam && MECH.dark(cam.clone().setY(cam.y - 1));
    if (dark) { f.color.setHex(0x05060a); f.near = 1.5; f.far = 9; } else if (f.far !== fog0.far || f.near !== fog0.near) { f.color.setHex(fog0.color); f.near = fog0.near; f.far = fog0.far; }
  });
  // bots: through a lift link, call it, wait, step in, ride, step out
  OPS2.chain('followLink', function (a, b, dt) {
    const n = b.path[b.pi], l = n && n.link; if (!l || l.kind !== 'lift') return false;
    const L = l.ref.lift; if (!L || !L.alive) { b.path = null; b.goal = null; return true; }
    const from = l.back ? l.ref.b : l.ref.a, to = l.back ? l.ref.a : l.ref.b;
    if (Math.abs(a.pos.y - L.stops[to]) < 0.15 && L.at === to && Math.abs(L.pos.y - L.stops[to]) < 0.05) { b.pi++; return false; }   // arrived: off it goes
    const inCar = inFoot(L.solid, a.pos, 0) && Math.abs(a.pos.y - L.pos.y) < 0.15;
    a.sprint = false;
    if (inCar) { a.mf = 0; a.mr = 0; L.call(to); return true; }
    if (L.at !== from || Math.abs(L.pos.y - L.stops[from]) > 0.05) { L.call(from); a.mf = 0; a.mr = 0; AI.faceTo(a, L.pos.clone().setY(a.pos.y + a.eyeH), dt, 6); return true; }
    AI.faceTo(a, L.pos.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0;
    return true;
  });
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'platform') { x.pd = [Math.round(e.w * 100) / 100, Math.round(e.d * 100) / 100, Math.round(e.thick * 100) / 100]; if (e.cargo) x.pc = e.cargo; }
    if (e.type === 'bridgeleaf' && e.raised) { const r = e.raised, g = r.geometry.parameters; x.bl = [pv(r.position), [g.width, g.height, g.depth], e.up ? 1 : 0]; }
    if (e.type === 'train') { x.tr = e.on ? 1 : 0; x.ta = e.ax; x.tw = Math.round((e.l1 - e.l0) * 100) / 100; }
    if (e.type === 'water' && e.def) { x.wl = Math.round(e.level * 100) / 100; x.wb = [e.def.x0, e.def.x1, e.def.z0, e.def.z1]; }
    if (e.type === 'mechpanel') x.pl = typeof e.label === 'function' ? e.label() : e.label;
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if (m.type === 'platform' && x.pd && !m.built) { m.built = true; const g = solidMesh(x.pd[0], x.pd[2], x.pd[1], 0x6a7078); g.position.y = -x.pd[2] / 2; m.mesh.add(g); m.w = x.pd[0]; m.d = x.pd[1]; if (x.pc) { const c = solidMesh(m.w * 0.8, x.pc, m.d * 0.5, 0x7a5634); c.position.y = x.pc / 2; m.mesh.add(c); m.cargo = x.pc; } }
    if (m.type === 'bridgeleaf' && x.bl) { if (!m.leaf) { m.leaf = solidMesh(x.bl[1][0], x.bl[1][1], x.bl[1][2], 0x5a5048); G.scene.add(m.leaf); (m.extra || (m.extra = [])).push(m.leaf); } m.leaf.position.set(x.bl[0][0], x.bl[0][1], x.bl[0][2]); m.leaf.visible = !!x.bl[2]; }
    if (m.type === 'platform' && m.w) { const p = m.tpos; m.solid = m.hitBox = m.cargo ? { x0: p.x - m.w * 0.4, x1: p.x + m.w * 0.4, y0: p.y - 0.25, y1: p.y + m.cargo, z0: p.z - m.d * 0.25, z1: p.z + m.d * 0.25 } : { x0: p.x - m.w / 2, x1: p.x + m.w / 2, y0: p.y - 0.25, y1: p.y, z0: p.z - m.d / 2, z1: p.z + m.d / 2 }; }
    if (m.type === 'train' && x.ta && !m.built) { m.built = true; const body = solidMesh(x.ta === 'x' ? 26 : x.tw - 0.3, 2.6, x.ta === 'x' ? x.tw - 0.3 : 26, 0x3a5a7a); body.position.y = 1.5; m.mesh.add(body); }
    if (m.type === 'train') { m.mesh.visible = !!x.tr; }
    if (m.type === 'water' && x.wb) {
      if (!m.built) { m.built = true; const w = (x.wb[1] - x.wb[0] + 1) * VS, d = (x.wb[3] - x.wb[2] + 1) * VS; m.wm = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), new THREE.MeshBasicMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.55, depthWrite: false })); G.scene.add(m.wm); (m.extra || (m.extra = [])).push(m.wm); }
      m.wm.visible = x.wl > 0.02; m.wm.scale.y = Math.max(0.001, x.wl); m.wm.position.set(m.tpos.x, m.tpos.y + x.wl / 2, m.tpos.z);
    }
    if (m.type === 'mechpanel' && x.pl) m.label = x.pl;
  });
  OPS2.chain('physics', function (a, dt) {
    // a guest standing on a moving platform: carried by it (the host carries everyone else)
    if (!GAME.client || !a.isPlayer || !a.onGround) return false;
    for (const m of G.ents) if (m.alive && m.type === 'platform' && m.solid && Math.abs(a.pos.y - m.solid.y1) < 0.1 && inFoot(m.solid, a.pos, 0.05)) {
      if (m.lastP) { a.pos.x += m.pos.x - m.lastP.x; a.pos.z += m.pos.z - m.lastP.z; }
    }
    for (const m of G.ents) if (m.alive && m.type === 'platform') m.lastP = (m.lastP || V()).copy(m.pos);
    return false;
  });
  /* ================================================================= bots */
  /* Each machine says when working it would help a bot of that side right now. A bot standing by a
     panel works it then; one defender in two rounds is told to hold the room with a panel in it */
  const alive = x => x.state === 'alive' && !x.hostage;
  const anyIn = (a, mine, test) => G.actors.some(x => x !== a && alive(x) && (x.team === a.team) === mine && test(x.pos));
  const inBox = (bx, p) => inFoot(bx, p) && p.y >= bx.y0 - 0.3 && p.y < bx.y1;
  const nearBoxes = (boxes, p, r) => boxes.some(q => p.x > q.x0 * VS - r && p.x < (q.x1 + 1) * VS + r && p.z > q.z0 * VS - r && p.z < (q.z1 + 1) * VS + r && Math.abs(p.y - q.y0 * VS) < 4);
  MECH.wants = function (a, pnl) {
    const m = pnl.owner; if (!m || !m.alive || (pnl.okFn && !pnl.okFn())) return false;
    const def = a.side === 'def';
    switch (m.type) {
      case 'gasroom': return m.state === 'ready' && anyIn(a, false, p => inBox(m.box, p)) && !anyIn(a, true, p => inBox(m.box, p));
      case 'lights': return def ? !m.dark && anyIn(a, false, p => m.has(p)) : m.dark && anyIn(a, true, p => m.has(p));
      case 'grille': return def ? !m.on && anyIn(a, false, p => nearBoxes(m.def.boxes, p, 14)) && !anyIn(a, true, p => nearBoxes(m.def.boxes, p, 3)) : m.on;
      case 'bridgeleaf': { const c = m.pos; return def ? !m.up && anyIn(a, false, p => U.dist3(p, c) < 26) && !anyIn(a, true, p => U.dist3(p, c) < 12) : m.up; }
      case 'slider': return anyIn(a, false, p => U.dist3(p, m.pos) < 12) && Math.random() < 0.35;
      case 'water': { const d = m.def, inW = p => p.x > d.x0 * VS && p.x < (d.x1 + 1) * VS && p.z > d.z0 * VS && p.z < (d.z1 + 1) * VS && p.y > m.pos.y - 0.5 && p.y < m.pos.y + 2.5; return m.state === 'dry' && anyIn(a, false, inW) && !anyIn(a, true, inW); }
    }
    return false;
  };
  const panels = () => G.ents.filter(e => e.alive && e.type === 'mechpanel' && e.owner);
  // OPS2.tick runs for every actor every frame (host)
  OPS2.chain('tick', function (a, dt) {
    const b = a.bot;
    if (GAME.client || !b || a.state !== 'alive' || (b.mechChk = (b.mechChk || 0) - dt) > 0) return false;
    b.mechChk = 0.5;
    // in the preparation phase: one defender in two rounds goes to hold the panel nearest him
    if (GAME.phase === 'prep' && !MECH.assigned && a.side === 'def' && b.role !== 'roam') {
      MECH.assigned = true;
      const ps = panels().filter(q => ['gasroom', 'lights', 'grille', 'bridgeleaf', 'water'].includes(q.owner.type));
      if (ps.length && Math.random() < (MECH.botChance == null ? 0.5 : MECH.botChance)) {
        const q = ps.slice().sort((u, w) => U.dist3(u.pos, a.pos) - U.dist3(w.pos, a.pos))[0];
        const foot = q.pos.clone().setY(q.pos.y - 1.1), id = NAV.nearest(foot, 3);
        const spot = id >= 0 ? NAV.nodePos(id).clone() : null;
        if (spot && U.dist3(spot, foot) < 1.5) { b.tasks.push({ at: spot, time: 0.3, run: x => { x.bot.hold = spot.clone(); x.bot.holdRoom = G.map.roomAt(spot) || x.bot.holdRoom; x.bot.holdSince = G.time; } }); MECH.holder = a; }
      }
    }
    // in the action phase: a bot by a panel works it when that helps
    if (GAME.phase !== 'action' || a.busy > 0 || G.time < (b.mechT || 0)) return false;
    for (const q of panels()) {
      if (U.dist3(q.pos, a.pos.clone().setY(a.pos.y + 1.1)) > 1.8 || !MECH.wants(a, q)) continue;
      b.mechT = G.time + 6; a.busy = 0.6;
      q.run(a); MECH.botUses = (MECH.botUses || 0) + 1; break;
    }
    return false;
  });
})();
