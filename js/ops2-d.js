/* ops2-d.js -- seasons 10-14, batch 4: who sees whom, and what they hear.
     KITE    rotor drone: a quadcopter that flies (12 s of battery a flight, recharging on the ground)
     MURMUR  throw voice: for 10 s every sound she makes comes from her projector instead
     LATCH   remote shutter: steel shutters on doorways and windows, slammed shut or open from anywhere
     MIRAGE  false wall: a hologram filling an opening: a wall to the attackers, glass to the defense
     HARBOR  ballistic curtain: stops bullets and sight both ways, but anyone can push through
   Added to js/ops2.js's hooks with OPS2.chain. */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent, Proj = GAD.Proj;
  const pv = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  for (const t of ['projector']) GAD.ELEC.add(t);
  for (const t of ['shutter']) { GAD.ELEC.add(t); GAD.TRAPS.add(t); }
  GAD.TRAPS.add('holo'); GAD.TRAPS.add('curtain');
  Object.assign(GAD.NAMES, { projector: 'Voice projector', shutter: 'Shutter motor', holo: 'False wall', curtain: 'Ballistic curtain' });
  Object.assign(GAD.EXTRA, {
    projector: g => { g.box(-3, -3, 0, 3, 3, 2, 0x222222); g.box(-2, -2, -1, 2, 2, -1, 0x444444); g.set(0, 0, -2, MD.glow(0xd88aff)); g.set(-2, 2, -2, MD.glow(0xd88aff)); },
    shutter: g => { g.box(-7, -3, 0, 7, 3, 4, 0x6a6e48); g.box(-6, -2, -1, 6, 2, -1, 0x4a4e30); g.set(5, 0, -2, MD.glow(0xe0c050)); g.box(-8, -3, 1, -8, 3, 3, 0x333333); g.box(8, -3, 1, 8, 3, 3, 0x333333); },
  });
  const inBox = (b, p, pad) => p.x > b.x0 - (pad || 0) && p.x < b.x1 + (pad || 0) && p.y > b.y0 - 0.2 && p.y < b.y1 && p.z > b.z0 - (pad || 0) && p.z < b.z1 + (pad || 0);
  // the box filling an opening (its whole width and height, one voxel deep)
  function opBox(op) {
    const a0 = op.a0 * 0.25, a1 = (op.a1 + 1) * 0.25, l0 = op.line * 0.25, l1 = (op.line + 1) * 0.25, y0 = op.y0 * 0.25, y1 = (op.y1 + 1) * 0.25;
    return op.axis === 'z' ? { x0: a0, x1: a1, y0, y1, z0: l0, z1: l1 } : { x0: l0, x1: l1, y0, y1, z0: a0, z1: a1 };
  }
  /* the false wall, voxel by voxel: each cell of the opening coloured as the wall beside it on that
     row would be (pattern, trim lines, indoor or outdoor light), so it reads as more of the same wall */
  const opOf = h => ({ axis: h[0] ? 'z' : 'x', line: h[1], a0: h[2], a1: h[3], y0: h[4], y1: h[5] });
  const opRec = op => [op.axis === 'z' ? 1 : 0, op.line, op.a0, op.a1, op.y0, op.y1];
  function holoMesh(op) {
    const W = G.world, zA = op.axis === 'z', pos = [], col = [], idx = [], c = [0, 0, 0];
    const rowMat = y => { for (const d of [1, 2, 3]) for (const a of [op.a0 - d, op.a1 + d]) { const m = zA ? W.get(a, y, op.line) : W.get(op.line, y, a); if (m && MAT[m] && MAT[m].solid && !MAT[m].see && m !== M.BARR && m !== 255) return m; } return M.DRY_WHITE; };
    GAD.opCells(op, (x, y, z) => {
      VW.patColor(rowMat(y), x, y, z, c);
      for (const s of [1, -1]) {
        const F = VW.FACES.find(f => zA ? f.d[2] === s : f.d[0] === s), nx = x + F.d[0], nz = z + F.d[2];
        const skyH = W.sky && nx >= 0 && nz >= 0 && nx < W.W && nz < W.D ? W.sky[nz * W.W + nx] : 0, L = y >= skyH ? W.light.out : W.light.in;
        const b = pos.length / 3;
        for (const q of F.c) { pos.push((x + q[0]) * 0.25, (y + q[1]) * 0.25, (z + q[2]) * 0.25); col.push(c[0] * L[0] * F.s, c[1] * L[1] * F.s, c[2] * L[2] * F.s); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
  }
  /* the curtain: hanging strips with folds, on a rail */
  function curtainMesh(op) {
    const g = new THREE.Group(), b = opBox(op), zA = op.axis === 'z', mid = (op.line + 0.5) * 0.25;
    const n = (op.a1 - op.a0 + 1) * 2, h = b.y1 - b.y0 - 0.07;
    for (let i = 0; i < n; i++) {
      const a = op.a0 * 0.25 + (i + 0.5) * 0.125, off = i & 1 ? 0.035 : -0.035;
      const m = new THREE.Mesh(new THREE.BoxGeometry(zA ? 0.13 : 0.05, h, zA ? 0.05 : 0.13), new THREE.MeshBasicMaterial({ color: i & 1 ? 0x37433a : 0x4a584c }));
      m.position.set(zA ? a : mid + off, b.y0 + 0.03 + h / 2, zA ? mid + off : a); g.add(m);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(zA ? b.x1 - b.x0 + 0.1 : 0.09, 0.06, zA ? 0.09 : b.z1 - b.z0 + 0.1), new THREE.MeshBasicMaterial({ color: 0x24262a }));
    rail.position.set(zA ? (b.x0 + b.x1) / 2 : mid, b.y1 - 0.03, zA ? mid : (b.z0 + b.z1) / 2); g.add(rail);
    return g;
  }
  GAD.MESH_FN.holo = () => new THREE.Group();
  GAD.MESH_FN.curtain = () => new THREE.Group();

  /* ================================================================ KITE */
  /* the rotor drone: flies where a ground drone can't (up stairwells, over furniture, through a hole in a
     ceiling). Jump climbs, crouch descends. 12 s of battery a flight; on the ground it recharges at half
     speed, and with no charge (or jammed) it comes down. It buzzes: anyone within 18 m hears it. One
     bullet, a seeker, a scrambler or a null field brings it down; Relay's dart traces it */
  function rotorMesh() {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), new THREE.MeshBasicMaterial({ color: 0x4a4e56 }));
    g.add(body);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), new THREE.MeshBasicMaterial({ color: 0xe0c050 })); eye.position.set(0, -0.01, -0.11); g.add(eye);
    g.props = [];
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0xe0c050 })); arm.position.set(x, 0.03, z); g.add(arm);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.02), new THREE.MeshBasicMaterial({ color: 0x9aa0a6 })); p.position.set(x, 0.05, z); g.add(p); g.props.push(p);
    }
    return g;
  }
  class Rotor extends GAD.Drone {
    constructor(owner, p, yaw) {
      super(owner, p, yaw);
      G.scene.remove(this.mesh); this.mesh = rotorMesh(); this.mesh.position.copy(this.pos); G.scene.add(this.mesh);
      this.rotor = true; this.bat = 12; this.up = 0; this.buzz = 0; this.hitR = 0.2;
    }
    update(dt) {
      this.t += dt;
      this.jamT = Math.max(0, this.jamT - dt);
      if (this.jamT > 1.2) { SFX.zap(this.pos); this.destroy('jam'); return; }
      const W = G.world, p = this.pos, r = 0.18, h = 0.12;
      const hit = (x, y, z) => W.boxHits(x - r, y, z - r, x + r, y + h, z + r);
      if (this.auto) OPS2.autopilot(this, dt);
      else if (!this.pilot) { this.mf = this.mr = 0; this.up = -1; }   // left alone, it settles to the floor
      const lift = this.bat > 0 && this.jamT <= 0.05;
      if (!this.onGround) this.bat = Math.max(0, this.bat - dt); else this.bat = Math.min(12, this.bat + dt * 0.5);
      const sp = 3.6, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const tx = (-sy * this.mf + cy * this.mr) * sp, tz = (-cy * this.mf - sy * this.mr) * sp;
      const air = !this.onGround || this.up > 0;
      this.vel.x = U.smooth(this.vel.x, air && lift ? tx : 0, 4, dt); this.vel.z = U.smooth(this.vel.z, air && lift ? tz : 0, 4, dt);
      if (lift && air) this.vel.y = U.smooth(this.vel.y, (this.up || 0) * 2.2, 5, dt);
      else this.vel.y -= 12 * dt;
      let nx = p.x + this.vel.x * dt; if (hit(nx, p.y, p.z)) { nx = p.x; this.vel.x = 0; } p.x = nx;
      let nz = p.z + this.vel.z * dt; if (hit(p.x, p.y, nz)) { nz = p.z; this.vel.z = 0; } p.z = nz;
      let ny = p.y + this.vel.y * dt; this.onGround = false;
      if (hit(p.x, ny, p.z)) { if (this.vel.y < 0) { this.onGround = true; ny = Math.floor(ny * 4 + 1) / 4; while (hit(p.x, ny, p.z) && ny < p.y + 0.3) ny += 0.25; } else ny = p.y; this.vel.y = 0; }
      p.y = ny; if (p.y < -3) p.y = 4;
      this.mesh.position.copy(p); this.mesh.rotation.y = this.yaw;
      if (this.mesh.props && !this.onGround) for (const q of this.mesh.props) q.rotation.y += dt * 40;
      if (this.loop) this.loop.set(p);
      // the buzz: loud while it flies
      this.buzz -= dt; if (!this.onGround && this.buzz <= 0) { this.buzz = 0.5; GAME.noise(p, 18, this.owner, 'drone'); }
    }
  }
  GAD.Rotor = Rotor;
  OPS2.ABIL.rotor = (a, ab, need, spend) => {
    const mine = G.ents.find(e => e.alive && e.rotor && e.owner === a);
    if (mine) { pilotRotor(a, mine); return true; }
    if (!need()) return false;
    const f = a.fwd(V()); f.y = 0; f.normalize();
    const d = new Rotor(a, a.pos.clone().add(V().set(0, 0.4, 0)).addScaledVector(f, 0.6), a.yaw);
    ab.count--; a.busy = 0.3;
    if (!a.bot) pilotRotor(a, d);
    return true;
  };
  function pilotRotor(a, d) {
    // (out of whatever they were flying first: a ground drone in the drone phase)
    for (const o of G.ents) if (o !== d && o.type === 'drone' && o.pilot === a) { o.pilot = null; o.mf = o.mr = 0; }
    if (a.isPlayer) { if (PLAYER.drone && PLAYER.drone !== d) PLAYER.leaveDrone(); PLAYER.enterDrone(d); }
    else if (a.net && window.NP) { d.pilot = a; a.netDrone = d.nid; NP.push({ k: 'pilot', to: a.net, nid: d.nid }); }
    else d.pilot = a;
  }
  /* a bot's rotor flies itself: a route toward the objective, 1.8 m over the floor, marking any
     defender its camera sees on the way; at the objective it circles, then lands */
  OPS2.autopilot = function (d, dt) {
    const A = d.auto, a = d.owner;
    if (GAME.phase !== 'prep') { d.auto = null; d.pilot = null; return; }
    if (!A.path) { A.path = NAV.path(d.pos, A.goal, { partial: true }) || []; A.pi = 0; A.t = 0; }
    A.t += dt;
    const n = A.path[A.pi];
    if (n) {
      const want = n.clone().setY(n.y + 1.8), dx = want.x - d.pos.x, dz = want.z - d.pos.z, dist = Math.hypot(dx, dz);
      d.yaw = Math.atan2(-dx, -dz); d.mf = dist > 0.3 ? 1 : 0; d.mr = 0;
      d.up = d.pos.y < want.y - 0.2 ? 1 : d.pos.y > want.y + 0.4 ? -1 : 0;
      if (dist < 0.6) A.pi++;
    } else { d.mf = 0; d.yaw += dt * 1.2; d.up = A.t > 9 ? -1 : 0; if (A.t > 14 || d.bat < 1) { d.auto = null; d.pilot = null; d.up = -1; return; } }
    if (d.bat < 2) d.up = -1;
    // spotting, legitimately: in front of the camera, in sight, within 20 m
    A.spot = (A.spot || 0) - dt;
    if (A.spot <= 0) {
      A.spot = 0.4;
      const eye = d.eye(), f = V().set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)), plan = AI.teams[a.team] || {}, intel = plan.intel || (plan.intel = []);
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === a.team || b.hostage) continue;
        const c = b.center(V()), to = c.clone().sub(eye), L = to.length(); if (L > 20) continue;
        to.divideScalar(L); if (to.x * f.x + to.z * f.z < 0.3) continue;
        if (!G.world.los(eye, c) || FX.smokeBlocks(eye, c)) continue;
        if ((b.spotT || 0) < G.time) { b.spotT = G.time + 3; GAME.mark(b, a.team, 5, true); }
        if (GAME.phase === 'action') GAME.intel(b, a.team, 30);
        const old = intel.find(e => e.a === b); if (old) { old.pos.copy(b.pos); old.t = G.time; } else intel.push({ a: b, pos: b.pos.clone(), t: G.time, op: b.op.id });
      }
    }
  };

  /* ============================================================== MURMUR */
  /* the voice projector: thrown, it sticks; for 10 s every sound she makes (footsteps, reloads,
     gunfire, gadgets) is heard from it, by players and bots alike. Sensors, alarms and eyes still find
     her where she is. One bullet ends it */
  class Projector extends Proj {
    constructor(a) {
      super('projector', a, GAD.throwStart(a), GAD.throwVel(a, 12), { sticky: true, hp: 1, intercept: true });
      this.onStick = () => { this.until = G.time + 10; a.voice = this; SFX.beep(this.pos, 1100, 0.2); GAD.tell(a, 'Throwing your voice: 10 s'); };
    }
    update(dt) { super.update(dt); if (this.until && G.time > this.until) this.destroy('used'); }
    destroy(w) { super.destroy(w); if (this.owner && this.owner.voice === this) this.owner.voice = null; }
  }
  OPS2.ABIL.voice = (a, ab, need, spend) => { if (a.voice && a.voice.alive) return false; if (!need()) return false; new Projector(a); return spend(); };
  OPS2.voicePos = a => a && a.voice && a.voice.alive && a.voice.until > G.time ? a.voice.pos : null;
  OPS2.chain('noiseHook', function (p, r, src) { const q = src && OPS2.voicePos(src); return q ? q.clone() : null; });

  /* =============================================================== LATCH */
  /* a remote shutter: looking at an open doorway or window within 3 m installs one (open). Pressed
     anywhere else, the ability slams every one of hers shut, or opens them again. Shut, it is steel:
     a plasma bore cuts it and a degausser softens it (and it moves no more). It won't close on
     anyone in the way. An EMP freezes it for 12 s; shooting the motor box leaves it where it is */
  OPS2.ABIL.shutter = (a, ab, need, spend) => {
    const op = ab.count > 0 ? GAD.findOpening(a, 1.8) : null;
    const taken = op && G.ents.some(e => e.alive && e.type === 'shutter' && e.op === op);
    if (op && !taken && ab.count > 0) {
      const st = GAD.opState(op);
      if (st.air < st.total * 0.7) { GAD.tell(a, 'Clear the opening first'); return false; }
      const m = OPS2.fitShutter(a, op, a.pos); if (!m) return false;
      SFX.metal(m.pos); GAD.tell(a, 'Shutter fitted (open): press the ability away from a doorway to slam them all');
      return spend();
    }
    return OPS2.toggleShutters(a);
  };
  OPS2.DEPLOY.shutter = (a, p, n, yaw, op) => null;
  OPS2.fitShutter = function (a, op, from) {
    if (G.ents.some(e => e.alive && e.type === 'shutter' && e.op === op)) return null;
    const c = GAD.opCenter(op), inw = V().set(from.x - c.x, 0, from.z - c.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize();
    const p = c.clone().addScaledVector(inw, 0.2); p.y = (op.y1 + 1) * 0.25 - 0.12;
    const m = new Ent('shutter', a, p, { normal: inw, hp: 1, hitR: 0.15 }); m.op = op; m.closed = false; m.cells = [];
    return m;
  };
  const bodyIn = (x, y, z) => { const x0 = x * 0.25, y0 = y * 0.25, z0 = z * 0.25; return G.actors.some(b => b.state !== 'dead' && x0 + 0.25 > b.pos.x - 0.26 && x0 < b.pos.x + 0.26 && z0 + 0.25 > b.pos.z - 0.26 && z0 < b.pos.z + 0.26 && y0 + 0.25 > b.pos.y && y0 < b.pos.y + (b.h || 1.8)); };
  OPS2.toggleShutters = function (a) {
    const mine = G.ents.filter(e => e.alive && e.type === 'shutter' && e.owner === a && !e.ruined);
    if (!mine.length) { GAD.tell(a, 'Look at an open doorway or window to fit a shutter'); return false; }
    const close = mine.some(e => !e.closed), W = G.world;
    let moved = 0, blocked = 0, frozen = 0;
    for (const s of mine) {
      if (s.empT > G.time) { frozen++; continue; }
      if (s.closed === close) continue;
      // a shutter Rust has degaussed (or one a breach has holed) is wrecked: it moves no more
      if (s.closed && s.cells.some(c => W.get(c[0], c[1], c[2]) !== M.LATCH_STEEL)) { s.ruined = true; GAD.tell(a, 'A shutter is wrecked'); continue; }
      if (close) {
        let inWay = false; GAD.opCells(s.op, (x, y, z) => { const m = W.get(x, y, z); if ((!m || m === M.GLASS) && bodyIn(x, y, z)) inWay = true; });
        if (inWay) { blocked++; continue; }
        // (what was there goes back when it opens: a window keeps its glass)
        s.cells = []; GAD.opCells(s.op, (x, y, z) => { const m = W.get(x, y, z); if (!m || m === M.GLASS) { s.cells.push([x, y, z, m]); W.set(x, y, z, M.LATCH_STEEL); } });
      } else { for (const c of s.cells) if (W.get(c[0], c[1], c[2]) === M.LATCH_STEEL) W.set(c[0], c[1], c[2], c[3]); s.cells = []; }
      s.closed = close; moved++;
      SFX.metal(s.pos); SFX.crumble(s.pos, 8); GAME.noise(s.pos, 25, a, 'reinforce');
    }
    GAD.tell(a, (moved ? 'Shutters ' + (close ? 'SHUT' : 'OPEN') : 'No shutter moved') + (blocked ? ' · ' + blocked + ' blocked' : '') + (frozen ? ' · ' + frozen + ' frozen (EMP)' : ''));
    a.busy = 0.3;
    return moved > 0;
  };

  /* ============================================================== MIRAGE */
  /* a false wall: an emitter fills an opening with a hologram of the wall around it. The attackers see
     a wall (their bots can't see through it); the defense sees a faint outline and looks straight
     through. Bullets and bodies pass through it, and it collapses for good the moment a bullet crosses
     it or an attacker or a drone goes through */
  class Holo extends Ent {
    constructor(a, op) {
      super('holo', a, GAD.opCenter(op), { model: false, hp: 1, hitR: 0 });
      this.model = 'holo'; this.op = op; this.blastproof = false; this.stopBullets = false;
      this.box = opBox(op); this.hitBox = this.box;
      this.mesh = holoMesh(op); G.scene.add(this.mesh);
      SFX.zap(this.pos); GAD.tell(a, 'False wall up');
    }
    shot() { this.collapse(); }
    update(dt) {
      this.t += dt;
      OPS2.holoLook(this.mesh, this.team);
      for (const b of G.actors) if (b.state !== 'dead' && b.team !== this.team && !b.hostage && inBox(this.box, b.center(V()), 0.05)) { this.collapse(); return; }
      for (const d of G.ents) if (d.alive && d.type === 'drone' && d.team !== this.team && inBox(this.box, d.pos, 0.05)) { this.collapse(); return; }
    }
    collapse() { if (!this.alive) return; FX.burst(this.pos, 0x7ab8ff, 14, 2, 0.05, 0.5, 0); SFX.zap(this.pos); GAD.tellTeam(this.team, 'A false wall collapsed'); this.destroy('used'); }
  }
  /* how a hologram looks to whoever is watching: solid to the other team, a faint outline to its own
     (and to spectators) */
  OPS2.holoLook = function (mesh, team) {
    if (!mesh || !mesh.material) return;
    const mine = !G.player || GAME.spectator || G.player.team === team;
    const op = mine ? 0.24 : 1;
    if (mesh.material.opacity !== op) { mesh.material.opacity = op; mesh.material.transparent = op < 1; mesh.material.depthWrite = op >= 1; mesh.material.needsUpdate = true; }
    // the tell: every few seconds it shimmers for a moment (a sharp eye catches it)
    const k = (G.time % 4.6) < 0.09 ? 1.22 : mine ? 1.6 : 1;
    if (mesh.material.color.r !== k) mesh.material.color.setScalar(k);
  };
  OPS2.ABIL.holo = (a, ab, need, spend) => {
    if (!need()) return false;
    const op = GAD.findOpening(a, 3);
    if (!op) { GAD.tell(a, 'Look at a doorway, a window or a hole'); return false; }
    if (G.ents.some(e => e.alive && (e.type === 'holo' || e.type === 'curtain') && e.op === op)) { GAD.tell(a, 'Something is already in that opening'); return false; }
    new Holo(a, op); return spend();
  };

  /* ============================================================== HARBOR */
  /* a ballistic curtain: hung in a doorway it stops bullets and sight both ways, but anyone can push
     through it: slowly, and loudly. Explosives tear it down, and a battering charge goes straight
     through it */
  class Curtain extends Ent {
    constructor(a, op) {
      super('curtain', a, GAD.opCenter(op), { model: false, hp: 999, hitR: 0, bulletproof: true });
      this.model = 'curtain'; this.op = op; this.blastproof = false;
      this.box = opBox(op); this.hitBox = this.box; this.rustle = new Map();
      this.mesh = curtainMesh(op); G.scene.add(this.mesh);
      SFX.reload(this.pos, a.isPlayer, 1); GAD.tell(a, 'Curtain hung');
      this.rips = 0;
    }
    // three melee hits rip it down (anything else that would destroy it outright still does)
    destroy(w) { if (w === 'melee' && ++this.rips < 3) { SFX.wood(this.pos, false); FX.puff(this.pos, 0.5, 0.3, 0x3e4a40); return; } super.destroy(w); }
    update(dt) {
      this.t += dt;
      for (const b of G.actors) {
        if (b.state === 'dead' || b.hostage || !inBox(this.box, b.center(V()), 0.2)) continue;
        if (b.ramT > 0) { FX.puff(this.pos, 1.2, 0.6, 0x3e4a40); SFX.wood(this.pos, true); this.destroy('blast'); return; }
        b.slow = Math.max(b.slow, 0.15);   // (pushing through: a crawl)
        if (G.time > (this.rustle.get(b) || 0)) { this.rustle.set(b, G.time + 0.5); SFX.step(this.pos, true, b.isPlayer); GAME.noise(this.pos, 14, b, 'step'); }
      }
    }
  }
  OPS2.ABIL.curtain = (a, ab, need, spend) => {
    if (!need()) return false;
    const op = GAD.findOpening(a, 3);
    if (!op) { GAD.tell(a, 'Look at a doorway or a window'); return false; }
    if (G.ents.some(e => e.alive && (e.type === 'holo' || e.type === 'curtain') && e.op === op)) { GAD.tell(a, 'Something is already in that opening'); return false; }
    new Curtain(a, op); return spend();
  };

  /* bots' eyes: a curtain blocks everyone; a false wall blocks the team it fools */
  OPS2.blocksSight = function (a, e, c) {
    let dir = null, L = 0;
    for (const x of G.ents) {
      if (!x.alive || !x.box || (x.type !== 'curtain' && x.type !== 'holo')) continue;
      if (x.type === 'holo' && x.team === a.team) continue;
      if (!dir) { dir = c.clone().sub(e); L = dir.length(); if (L < 0.01) return false; dir.divideScalar(L); }
      const t = WPN.rayBox(e, dir, x.box, L); if (t >= 0 && t < L - 0.05) return true;
    }
    return false;
  };

  /* ============================================================== guests */
  OPS2.chain('entRec', function (e, x) {
    if ((e.type === 'holo' || e.type === 'curtain') && e.op) x.ho = opRec(e.op);
    if (e.type === 'drone' && e.rotor) { x.rt = e.owner ? e.owner.id : 1; x.bt = Math.ceil(e.bat); }
    // Murmur's projector, while it carries her voice: guests hear her from it too
    if (e.type === 'projector' && e.until > G.time && e.owner) x.vo = [e.owner.id, Math.round((e.until - G.time) * 10) / 10];
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if ((m.type === 'holo' || m.type === 'curtain') && x.ho && !m.built) {
      m.built = true; const op = opOf(x.ho); m.box = m.hitBox = opBox(op); if (m.type === 'holo') m.stopBullets = false;
      const mesh = m.type === 'holo' ? holoMesh(op) : curtainMesh(op); G.scene.add(mesh); (m.extra || (m.extra = [])).push(mesh); m.boxMesh = mesh;
    }
    if (x.bt != null) m.bat = x.bt;
    if (m.type === 'drone' && x.rt && !m.rotorBuilt) { m.rotorBuilt = true; G.scene.remove(m.mesh); m.mesh = rotorMesh(); m.mesh.position.copy(m.pos); G.scene.add(m.mesh); m.rotor = true; m.owner = NP.byId.get(x.rt) || null; }
    if (m.type === 'projector' && x.vo) { const o = NP.byId.get(x.vo[0]); if (o) { o.voice = m; m.owner = o; m.until = G.time + x.vo[1]; } }
  });
  OPS2.chain('mirrorFx', function (m, dt) {
    if (m.type === 'holo' && m.boxMesh) OPS2.holoLook(m.boxMesh, m.team);
    if (m.rotor && m.mesh && m.mesh.props) for (const q of m.mesh.props) q.rotation.y += dt * 40;
  });

  /* ================================================================ HUD */
  OPS2.chain('status', function (a) {
    if (a.voice && a.voice.alive && a.voice.until > G.time) return 'THROWING YOUR VOICE ' + Math.ceil(a.voice.until - G.time) + 's';
    return '';
  });
  OPS2.chain('hudCount', function (a) {
    if (!a.ability) return null;
    if (a.ability.id === 'rotor') { const d = G.ents.find(e => e.alive && e.rotor && e.owner === a); return d ? 'FLY · ' + Math.ceil(d.bat) + 's' : a.ability.count > 0 ? 'READY' : 'LOST'; }
    if (a.ability.id === 'shutter') { const n = G.ents.filter(e => e.alive && e.type === 'shutter' && e.owner === a); if (n.length) return (n.some(e => !e.closed) ? 'OPEN ' : 'SHUT ') + n.length + (a.ability.count ? ' +' + a.ability.count : ''); }
    return null;
  });

  /* ================================================================ bots */
  OPS2.chain('tick', function (a, dt) {
    // Kite's bot: the rotor goes up in the drone phase, toward the objective
    // (in the drone phase only: a bot can't fly it and fight at the same time)
    if (a.bot && a.ability && a.ability.id === 'rotor' && a.ability.count > 0 && a.state === 'alive' && GAME.phase === 'prep' && G.time > (a.bot.rotorT || 0)) {
      const plan = AI.teams[a.team]; if (!plan || !plan.objCenter) return;
      a.bot.rotorT = G.time + 2;
      if (GAD.ability(a)) { const d = G.ents.filter(e => e.alive && e.rotor && e.owner === a).pop(); if (d) { d.pilot = a; d.auto = { goal: plan.objCenter.clone() }; } }
    }
  });
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // Murmur: as she closes on the objective, her voice goes somewhere else
    if (ab.id === 'voice' && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) < 22 && U.dist3(a.pos, c.obj) > 7 && G.time > (b.voiceT || 0) && !(a.voice && a.voice.alive)) {
      b.voiceT = G.time + 15;
      const to = c.obj.clone().sub(a.pos); to.y = 0; to.normalize();
      const side = V().set(-to.z, 0, to.x).multiplyScalar(Math.random() < 0.5 ? 9 : -9);
      AI.lobAt(a, a.pos.clone().add(side).addScaledVector(to, 4)); GAD.ability(a); return true;
    }
    // Latch, Mirage, Harbor: kit still unused (the prep job fell through)? Into an open doorway
    // right beside them, while they hold near the objective
    if ((ab.id === 'shutter' || ab.id === 'holo' || ab.id === 'curtain') && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) < 16 && G.time > (b.kitT || 0)) {
      b.kitT = G.time + 3;
      const taken = o => G.ents.some(e => e.alive && e.op === o && (e.type === 'shutter' || e.type === 'holo' || e.type === 'curtain'));
      const op = G.map.openings.find(o => { const cc = GAD.opCenter(o), st = GAD.opState(o); return U.dist2(cc, a.pos) < 3 && Math.abs(o.y0 * 0.25 - a.pos.y) < 0.6 && st.air >= st.total * 0.6 && !taken(o); });
      if (op) {
        if (ab.id === 'shutter') { if (OPS2.fitShutter(a, op, a.pos)) ab.count--; }
        else { new (ab.id === 'holo' ? Holo : Curtain)(a, op); ab.count--; }
        a.busy = 0.6; return true;
      }
    }
    // Latch: shut the shutters when the attack is close to one; open them again once it's quiet
    if (ab.id === 'shutter') {
      const mine = G.ents.filter(e => e.alive && e.type === 'shutter' && e.owner === a && !e.ruined);
      if (mine.length && G.time > (b.shutT || 0)) {
        const S = c.S, near = S.known && G.time - S.kt < 5 && mine.some(e => U.dist3(e.pos, S.known) < 11);
        const open = mine.some(e => !e.closed);
        if ((near && open) || (!near && !open && G.time - S.kt > 18)) { b.shutT = G.time + 4; OPS2.toggleShutters(a); return true; }
      }
    }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b, ents } = c, id = a.ability ? a.ability.id : null;
    // Latch, Mirage, Harbor: their kit in the ways in (Latch the main ones; Harbor the others, where
    // the defense rotates; Mirage one the attack is likely to come through)
    if (id !== 'shutter' && id !== 'holo' && id !== 'curtain') return;
    const order = id === 'curtain' ? ents.slice(1).concat(ents.slice(0, 1)) : ents.slice();
    const n = Math.min(a.ability.count, id === 'holo' ? 1 : 2, order.length);
    for (let i = 0; i < n; i++) {
      const op = order[i], cc = GAD.opCenter(op), rr = plan.rooms.find(x => x.L === op.L) || plan.rooms[0];
      const inw = V().set(rr.cx - cc.x, 0, rr.cz - cc.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize();
      const st = cc.clone().addScaledVector(inw, 1.1); st.y = rr.fy;
      b.tasks.unshift({ at: st, look: cc, time: 0.6, run: x => {
        if (x.ability.count <= 0) return;
        if (id === 'shutter') { if (OPS2.fitShutter(x, op, st)) x.ability.count--; }
        else if (!G.ents.some(e => e.alive && (e.type === 'holo' || e.type === 'curtain') && e.op === op)) { if (id === 'holo') new Holo(x, op); else new Curtain(x, op); x.ability.count--; }
      } });
    }
  });
})();
