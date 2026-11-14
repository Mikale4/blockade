/* ops2-b.js -- seasons 10-14, batch 2: new ways up, across and through, and a floor that gives.
     SPAN   zipline rig: a cable to a ledge, window or roof up to 28 m away that the team rides
     RUNG   breach ladder: a hole through a soft floor or ceiling with a ladder in it (both teams)
     FERRET crawl cutter: a prone-only hole through a soft wall at floor level (both teams)
     JOLT   window guard: blasts attackers off ropes, lines and ladders and out of vaults
     SINK   collapse charge: the floor under an attacker drops away a level
   Lines, ladders and crawl holes are NAV links, so bots of either team route through them.
   Added to js/ops2.js's hooks with OPS2.chain. */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent, Proj = GAD.Proj;
  const STAND = Actor.STAND, pv = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  for (const t of ['wguard', 'collapse']) { GAD.ELEC.add(t); GAD.TRAPS.add(t); }
  Object.assign(GAD.NAMES, { ladder: 'Breach ladder', zipline: 'Zipline', zipanchor: 'Zipline anchor', wguard: 'Window guard', collapse: 'Collapse charge' });
  // can a body stand at (x, y, z)? (clear to standing height, something under the feet)
  const standAt = (x, y, z) => { const W = G.world; return !W.boxHits(x - 0.24, y + 0.02, z - 0.24, x + 0.24, y + STAND, z + 0.24) && W.boxHits(x - 0.1, y - 0.2, z - 0.1, x + 0.1, y - 0.01, z + 0.1); };
  const soft = m => m && MAT[m].xp && !MAT[m].reinf && !MAT[m].see && m !== M.RESIN && m !== M.LEAF;

  /* ---------------------------------------------------------------- meshes */
  const mBasic = c => new THREE.MeshBasicMaterial({ color: c });
  function ladderMesh(h) {
    const g = new THREE.Group(), rail = new THREE.BoxGeometry(0.05, h, 0.05), rung = new THREE.BoxGeometry(0.46, 0.04, 0.04);
    for (const x of [-0.23, 0.23]) { const m = new THREE.Mesh(rail, mBasic(0x9aa0a6)); m.position.set(x, h / 2, 0); g.add(m); }
    for (let y = 0.25; y < h - 0.05; y += 0.3) { const m = new THREE.Mesh(rung, mBasic(0xd8853a)); m.position.set(0, y, 0); g.add(m); }
    return g;
  }
  GAD.MESH_FN.ladder = () => new THREE.Group();     // (a guest builds the real one once it knows the height)
  GAD.MESH_FN.zipline = () => new THREE.Group();
  Object.assign(GAD.EXTRA, {
    zipmast: g => { g.box(-1, 0, -1, 1, 66, 1, 0x5a5a5a); g.box(-4, 0, -4, 4, 2, 4, 0x3a3a3a); g.box(-2, 62, -2, 2, 66, 2, 0xd8853a); g.set(0, 67, 0, MD.glow(0xffa040)); },
    ziphook: g => { g.box(-3, -3, 0, 3, 3, 2, 0x3a3a3a); g.box(-1, -1, -3, 1, 1, -1, 0x9aa0a6); g.box(-4, -4, -1, -3, -2, -1, 0x9aa0a6); g.box(3, -4, -1, 4, -2, -1, 0x9aa0a6); g.set(0, 2, -2, MD.glow(0xffa040)); },
    wguard: g => { g.box(-6, -2, 0, 6, 2, 2, 0x26303c); g.box(-5, -1, -1, 5, 1, -1, MD.glow(0x5ad8ff)); g.set(-6, 3, 1, MD.glow(0xff5a3a)); },
    collapse: g => { g.box(-3, -3, 0, 3, 3, 1, 0x4a3a2a); g.box(-2, -2, -1, 2, 2, -1, 0x2a2a2a); g.set(0, 0, -2, MD.glow(0xff5a2a)); },
  });

  /* ================================================================ RUNG */
  /* a ladder through a hole in a floor: grab it walking into it from below (or by stepping into the
     hole from above, which slides you down it), climb with forward, go down with back, let go with
     jump. At the top it steps you out onto the floor beside the hole */
  class Ladder extends Ent {
    constructor(a, x, z, bot, top, exit) {
      super('ladder', a, V().set(x, bot, z), { model: false, hp: 80, hitR: 0 });
      this.model = 'ladder'; this.x = x; this.z = z; this.bot = bot; this.top = top; this.exit = exit.clone();
      this.stopBullets = false; this.blastproof = false;
      this.mesh = ladderMesh(top - bot + 1); this.mesh.position.set(x, bot, z); this.mesh.rotation.y = a ? Math.round(a.yaw / (Math.PI / 2)) * (Math.PI / 2) : 0; G.scene.add(this.mesh);
      this.hitBox = { x0: x - 0.26, x1: x + 0.26, y0: bot, y1: top + 0.9, z0: z - 0.26, z1: z + 0.26 };
      NAV.addLink(V().set(x, bot, z), this.exit, 'ladder', 6 + (top - bot) * 2, this);
    }
    onDestroy() { NAV.dropLinks(this); for (const b of G.actors) if (b.climb && b.climb.lad === this) b.climb = null; }
  }
  OPS2.ABIL.ladder = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 3.2);
    if (!h || Math.abs(h.n.y) < 0.7) { GAD.tell(a, 'Aim up at a ceiling or down at the floor'); return false; }
    const L = OPS2.cutLadder(a, h);
    if (!L) return false;
    return spend();
  };
  /* the hole (5 x 5 voxels, through the slab) and the ladder in it; null with a reason told */
  OPS2.cutLadder = function (a, h) {
    const W = G.world, up = h.n.y < 0, dy = up ? 1 : -1;
    // the slab: soft all the way through at the middle, with open air on the far side
    let k = 0; while (k < 4 && soft(W.get(h.x, h.y + dy * k, h.z))) k++;
    if (!k || W.get(h.x, h.y + dy * k, h.z)) { GAD.tell(a, 'Ladders need a soft floor with a room beyond it'); return null; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const m = W.get(h.x + dx, h.y, h.z + dz); if (m && !soft(m)) { GAD.tell(a, 'That floor is reinforced or too hard here'); return null; } }
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let i = 0; i < k; i++) { const y = h.y + dy * i; if (soft(W.get(h.x + dx, y, h.z + dz))) { W.set(h.x + dx, y, h.z + dz, 0); n++; } }
    const x = (h.x + 0.5) / 4, z = (h.z + 0.5) / 4;
    const topY = up ? (h.y + k) / 4 : (h.y + 1) / 4;                 // the floor surface it climbs to
    const bot = up ? G.world.groundBelow(x, h.py - 0.2, z) : G.world.groundBelow(x, (h.y - k) / 4 - 0.05, z);
    // stepping off at the top: beside the hole, preferring the side the deployer looked from
    const f = a.fwd(V()); f.y = 0; f.normalize();
    const sides = [[-f.x, -f.z], [f.x, f.z], [-f.z, f.x], [f.z, -f.x]];
    let exit = null;
    for (const [sx, sz] of sides) { if (exit) break; for (const d of [0.95, 1.2]) { const ex = x + sx * d, ez = z + sz * d; if (standAt(ex, topY, ez)) { exit = V().set(ex, topY, ez); break; } } }
    if (n) { const c = V().set(x, up ? topY - 0.2 : topY, z); SFX.crumble(c, n); SFX.explosion(c, false); FX.puff(c, 1.4, 0.8, 0xc8b8a0); GAME.noise(c, 40, a, 'breach'); G.emit && G.emit('breach'); }
    if (!exit || topY - bot < 1) { GAD.tell(a, 'Hole cut, but there is no room for a ladder'); return n ? { hole: true } : null; }
    const L = new Ladder(a, x, z, bot, topY, exit);
    GAD.tell(a, 'Ladder up');
    return L;
  };
  OPS2.DEPLOY.ladder = (a, p, n, yaw) => null;   // (always cut by OPS2.cutLadder)
  const ladderNear = a => {
    for (const e of G.ents) if (e.alive && e.type === 'ladder' && Math.abs(a.pos.x - e.x) < 0.5 && Math.abs(a.pos.z - e.z) < 0.5 && a.pos.y > e.bot - 0.3 && a.pos.y < e.top + 0.3) return e;
    return null;
  };
  function climbStep(a, dt) {
    const c = a.climb, L = c.lad;
    if (!L || L.alive === false || a.state !== 'alive') { a.climb = null; return false; }
    a.vel.set(0, 0, 0); a.onGround = false; a.stance = 0; a.h = STAND; a.eyeH = STAND - 0.15; a.leanT = 0; a.lean = 0;
    a.pos.x += (L.x - a.pos.x) * Math.min(1, dt * 10); a.pos.z += (L.z - a.pos.z) * Math.min(1, dt * 10);
    const v = a.mf > 0.2 ? 2.6 : a.mf < -0.2 || c.slide ? -3 : 0;
    a.pos.y += v * dt;
    if (v > 0 && a.pos.y >= L.top - 0.15) {
      a.climb = null; a.vault = { t: 0, dur: 0.5, from: a.pos.clone(), to: L.exit.clone(), top: L.top + 0.35 }; SFX.whoosh(a.pos); return true;
    }
    if (a.pos.y <= L.bot) { a.pos.y = L.bot; a.climb = null; a.onGround = true; return true; }
    if (v) { a.stepAcc += dt; if (a.stepAcc > 0.35) { a.stepAcc = 0; SFX.step(a.pos, false, a.isPlayer, 'metal'); GAME.noise(a.pos, 10, a, 'step'); } }
    a.moving = Math.abs(v);
    return true;
  }

  /* ================================================================ SPAN */
  /* a zipline: a mast at Span's feet (the line leaves it 2.1 m up) to a hook up to 28 m away. Either
     end rides to the other with interact (his team only): 7 m/s, no shooting, a hum anyone near hears.
     Shooting either anchor (25 HP) cuts it, and drops anyone on it */
  class Zipline extends Ent {
    constructor(a, A, B, landA, landB, n, op) {
      super('zipline', a, A, { model: false, hp: 999, hitR: 0 });
      this.model = 'zipline'; this.A = A.clone(); this.B = B.clone(); this.landA = landA.clone(); this.landB = landB.clone(); this.op = op || null;
      this.blastproof = true;
      this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.A, this.B]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); G.scene.add(this.line);
      const mast = new Ent('zipanchor', a, landA, { model: 'zipmast', upright: true, hp: 25, hitR: 0.12 });
      const hook = new Ent('zipanchor', a, B, { model: 'ziphook', normal: n, hp: 25, hitR: 0.18 });
      for (const x of [mast, hook]) { x.zip = this; x.onDestroy = () => { if (this.alive) this.destroy('shot'); }; }
      this.anchors = [mast, hook];
      const len = U.dist3(A, B);
      NAV.addLink(landA, landB, 'zip', 3 + len / 7 * 2, this);
      SFX.metal(B); SFX.whoosh(A); GAME.noise(B, 18, a, 'gadget');
    }
    update(dt) { this.t += dt; }
    destroy(w) {
      if (!this.alive) return;
      super.destroy(w);
      if (this.line) { G.scene.remove(this.line); this.line = null; }
      for (const x of this.anchors || []) if (x.alive) x.destroy('silent');
      NAV.dropLinks(this);
      for (const b of G.actors) if (b.ride && b.ride.line === this) { b.ride = null; if (b.net && window.NP) NP.push({ k: 'unride', to: b.net }); }
      if (w !== 'silent' && this.owner) GAD.tell(this.owner, 'Your zipline was cut', 'warn');
    }
  }
  OPS2.ABIL.zip = (a, ab, need, spend) => {
    if (!need()) return false;
    const e = a.eye(V()), f = a.fwd(V()), h = G.world.raycast(e, f, 28);
    if (!h || h.dist < 4 || h.m === DATA.OOB) { GAD.tell(a, 'Aim at a wall, ledge, window or roof 4-28 m away'); return false; }
    const n = V().set(h.nx, h.ny, h.nz), B = V().set(h.px, h.py, h.pz).addScaledVector(n, 0.12);
    const landA = V().set(a.pos.x, a.pos.y, a.pos.z), A = landA.clone().setY(landA.y + 2.1);
    const dir = B.clone().sub(A), L = dir.length(); dir.divideScalar(L);
    if (L < 4 || G.world.raycast(A, dir, L - 0.35)) { GAD.tell(a, 'Something is in the way of the line'); return false; }
    const landB = landingNear(B, n, h);
    if (!landB) { GAD.tell(a, 'Nowhere to land at the far end'); return false; }
    new Zipline(a, A, B, landA, landB, n, Actor.windowAt ? Actor.windowAt(B.x - n.x * 0.2, B.y, B.z - n.z * 0.2, 0.6) : null);
    return spend();
  };
  /* where a rider ends up: over the ledge or in through the window the hook is on, else on the
     ground under it */
  function landingNear(B, n, h) {
    const W = G.world;
    for (const k of [0.6, 0.9, 1.3]) for (let dy = -1.6; dy <= 1.0; dy += 0.25) {
      const x = B.x - n.x * k, z = B.z - n.z * k, y = Math.floor((B.y + dy) * 4) / 4;
      if (Math.abs(n.y) < 0.5 && standAt(x, y, z)) return V().set(x, y, z);
    }
    // a roof or a floor: on top of it
    if (n.y > 0.5 && standAt(B.x, Math.round(B.y * 4) / 4, B.z)) return V().set(B.x, Math.round(B.y * 4) / 4, B.z);
    const x = B.x + n.x * 0.6, z = B.z + n.z * 0.6, gy = W.groundBelow(x, B.y, z);
    return standAt(x, gy, z) && B.y - gy < 9 ? V().set(x, gy, z) : null;
  }
  OPS2.startRide = function (a, line, fromB) {
    if (a.ride || a.state !== 'alive') return false;
    const from = fromB ? line.B : line.A, to = fromB ? line.A : line.B, land = fromB ? line.landA : line.landB;
    a.ride = { line, from: from.clone(), to: to.clone(), land: land.clone(), t: 0, len: Math.max(1, U.dist3(from, to)), hum: 0 };
    a.rappel = null; a.trigger = false; a.ads = 0;
    if (a.net && window.NP) NP.push({ k: 'ride', to: a.net, nid: line.nid, f: pv(from), t: pv(to), l: pv(land) });
    SFX.whoosh(a.pos); GAME.noise(a.pos, 14, a, 'gadget');
    return true;
  };
  function rideStep(a, dt) {
    const r = a.ride;
    if (!r.line || r.line.alive === false || a.state !== 'alive') { a.ride = null; return false; }
    r.t = Math.min(1, r.t + 7 * dt / r.len);
    const p = r.from.clone().lerp(r.to, r.t);
    a.pos.set(p.x, p.y - 2.0, p.z); a.vel.set(0, 0, 0); a.onGround = false; a.stance = 0; a.h = STAND; a.moving = 0;
    r.hum -= dt; if (r.hum <= 0) { r.hum = 0.5; GAME.noise(p, 12, a, 'gadget'); SFX.step(p, false, a.isPlayer, 'metal'); }
    if (r.t >= 1) {
      a.ride = null;
      // in through a window at the end: its glass or boards give
      const op = r.line.op; if (op && Actor.smashWindow && !GAME.client && Actor.windowState(op).state !== 'blocked') Actor.smashWindow(op, a);
      a.vault = { t: 0, dur: 0.45, from: a.pos.clone(), to: r.land.clone(), top: Math.max(a.pos.y, r.land.y) + 0.3 };
    }
    return true;
  }

  /* ============================================================== FERRET */
  /* a crawl hole: 3 voxels wide and 3 tall (0.75 m) at floor level through a soft wall, cut in 1.5 s.
     Only a prone body (or a drone) fits. Bots of either team crawl through (a NAV link) */
  const crawlable = m => soft(m) && m !== M.BARR && m !== M.GLASS;
  OPS2.holes = [];
  OPS2.ABIL.crawl = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.0);
    if (!h || Math.abs(h.n.y) > 0.5 || !crawlable(h.m)) { GAD.tell(a, 'Aim at a soft wall'); return false; }
    const W = G.world, nx = Math.round(h.nx), nz = Math.round(h.nz);
    const fy = Math.round(W.groundBelow(h.px + nx * 0.3, h.py, h.pz + nz * 0.3) * 4);
    // through the wall: soft from the face to open air within three voxels
    let depth = 0; while (depth < 3 && crawlable(W.get(h.x - nx * depth, fy + 1, h.z - nz * depth))) depth++;
    if (!depth || W.get(h.x - nx * depth, fy + 1, h.z - nz * depth)) { GAD.tell(a, 'No way through there'); return false; }
    a.busy = 1.5; a.busyLabel = 'CUTTING';
    const job = new Ent('cutting', a, h.p, { model: false, hp: 999, hitR: 0 });
    job.blastproof = true;
    job.update = function (dt) {
      this.t += dt;
      if (Math.random() < dt * 8) FX.dust(h.p, nx, 0, nz, h.m);
      if (Math.random() < dt * 3) GAME.noise(h.p, 8, a, 'breach');
      if (this.t < 1.5) return;
      this.destroy('used');
      if (a.state !== 'alive') return;
      OPS2.cutCrawl(a, h.x, fy, h.z, nx, nz, depth, h.m);
    };
    return spend();
  };
  OPS2.cutCrawl = function (a, vx, fy, vz, nx, nz, depth, m0) {
    const W = G.world;
    let n = 0;
    for (let t = -1; t <= 1; t++) for (let y = fy; y <= fy + 2; y++) for (let k = 0; k < depth; k++) {
      const x = nz ? vx + t : vx - nx * k, z = nx ? vz + t : vz - nz * k;
      if (crawlable(W.get(x, y, z))) { W.set(x, y, z, 0); n++; }
    }
    if (!n) return null;
    const c = V().set((vx + 0.5) / 4, fy / 4 + 0.3, (vz + 0.5) / 4);
    SFX.crumble(c, n); FX.puff(c, 0.8, 0.6, 0xc8b8a0);
    const front = V().set((vx + 0.5) / 4 + nx * 0.75, fy / 4, (vz + 0.5) / 4 + nz * 0.75), back = V().set((vx + 0.5) / 4 - nx * (depth * 0.25 + 0.7), fy / 4, (vz + 0.5) / 4 - nz * (depth * 0.25 + 0.7));
    const hole = { x: vx, y: fy, z: vz, nx, nz, depth, front, back, c };
    OPS2.holes.push(hole);
    NAV.addLink(front, back, 'crawl', 5, hole);
    G.emit && G.emit('breach');
    return hole;
  };

  /* ================================================================ JOLT */
  /* a window guard: under a window, doorway or hatch. Any attacker within 2.5 m of it on a rope, on a
     line, on a ladder or mid-vault is blasted 3 m back, off whatever they were on: 10 damage and a
     1.2 s stun. Three pulses, a second apart at least, then it is spent */
  class WindowGuard extends Ent {
    constructor(a, p, n) { super('wguard', a, p, { normal: n, hp: 1, hitR: 0.15 }); this.pulses = 3; this.cool = 0; SFX.reload(this.pos, a.isPlayer, 1); }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      this.cool -= dt; if (this.cool > 0) return;
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        if (!(b.rappel || b.ride || b.climb || b.vault) || U.dist3(b.center(V()), this.pos) > 2.5) continue;
        OPS2.jolt(b, this);
        this.pulses--; this.cool = 1;
        if (this.pulses <= 0) this.destroy('used');
        return;
      }
    }
  }
  OPS2.jolt = function (b, src) {
    const d = V().set(b.pos.x - src.pos.x, 0, b.pos.z - src.pos.z); if (d.lengthSq() < 0.01) d.set(src.normal.x, 0, src.normal.z); d.normalize();
    b.rappel = null; b.vault = null; b.ride = null; b.climb = null;
    const vx = d.x * 8, vz = d.z * 8;
    b.knock = { vx, vz, t: 0.38 };
    b.hurt(10, { src: src.owner, kind: 'explosion', dir: d });
    if (!(b.odT > 0)) b.stun = Math.max(b.stun, 1.2);
    if (b.net && window.NP) NP.push({ k: 'jolt', to: b.net, v: [vx, vz] });
    FX.flash(src.pos, 2, 0.15); FX.sparks(src.pos, src.normal.x, src.normal.y, src.normal.z, 0x5ad8ff); SFX.zap(src.pos); SFX.explosion(src.pos, false);
    GAME.noise(src.pos, 30, src.owner, 'explosion');
    GAD.tell(b, 'WINDOW GUARD: knocked off', 'warn'); GAD.tellTeam(src.team, 'Window guard fired');
  };
  OPS2.ABIL.wguard = (a, ab, need, spend) => {
    if (!need()) return false;
    // a hatch overhead or underfoot, or the opening ahead
    const h = GAD.aim(a, 2.6);
    if (h && Math.abs(h.n.y) > 0.7 && (h.md.hatch || h.m === M.RHATCH)) { new WindowGuard(a, h.p, h.n); return spend(); }
    const op = GAD.findOpening(a, 2.6);
    if (!op) { GAD.tell(a, 'Look at a window, a doorway or a hatch'); return false; }
    const c = GAD.opCenter(op), inw = V().set(a.pos.x - c.x, 0, a.pos.z - c.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize();
    const p = c.clone().addScaledVector(inw, 0.16); p.y = op.y0 * 0.25 + 0.15;
    new WindowGuard(a, p, inw); return spend();
  };
  OPS2.DEPLOY.wguard = (a, p, n) => new WindowGuard(a, p, n || V().set(0, 1, 0));

  /* ================================================================ SINK */
  /* a collapse charge on a soft floor (from above) or its underside (from below). Armed after 2 s;
     an attacker standing over it drops the 1.5 m patch of floor around it: they fall a level, take 20
     and are stunned 1.5 s. One bullet (from where it can be seen) disarms it */
  class Collapse extends Ent {
    constructor(a, h) {
      super('collapse', a, h.p, { normal: h.n, hp: 1, hitR: 0.1 });
      const W = G.world, up = h.n.y < 0, dy = up ? 1 : -1;
      let k = 0; while (k < 4 && soft(W.get(h.x, h.y + dy * k, h.z))) k++;
      this.cx = h.x; this.cz = h.z;
      this.ys = []; for (let i = 0; i < k; i++) this.ys.push(h.y + dy * i);
      this.surf = (Math.max(...this.ys) + 1) / 4;      // the floor surface people stand on
      SFX.reload(this.pos, a.isPlayer, 1);
    }
    update(dt) {
      this.t += dt; if (this.t < 2 || this.disabled) return;
      const x0 = (this.cx - 3) / 4, x1 = (this.cx + 3) / 4, z0 = (this.cz - 3) / 4, z1 = (this.cz + 3) / 4;
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        if (b.pos.x < x0 || b.pos.x > x1 || b.pos.z < z0 || b.pos.z > z1 || Math.abs(b.pos.y - this.surf) > 0.3) continue;
        this.spring(b); return;
      }
    }
    spring(b) {
      const W = G.world; let n = 0;
      for (let dx = -3; dx <= 2; dx++) for (let dz = -3; dz <= 2; dz++) for (const y of this.ys) if (soft(W.get(this.cx + dx, y, this.cz + dz))) { W.set(this.cx + dx, y, this.cz + dz, 0); n++; }
      const c = V().set((this.cx + 0.5) / 4, this.surf, (this.cz + 0.5) / 4);
      SFX.crumble(c, n); SFX.explosion(c, false); FX.puff(c, 1.6, 1.0, 0xb8a890); FX.burst(c, 0x6a5a4a, 16, 3, 0.08, 0.8, 1);
      GAME.noise(c, 35, this.owner, 'explosion');
      b.hurt(20, { src: this.owner, kind: 'explosion' }); if (!(b.odT > 0)) b.stun = Math.max(b.stun, 1.5);
      b.rappel = null; b.climb = null;
      GAD.tell(b, 'The floor gave way!', 'warn'); GAD.tellTeam(this.team, 'Collapse charge sprung');
      this.destroy('used');
      G.emit && G.emit('breach');
    }
  }
  const sinkable = h => {
    if (!h || Math.abs(h.n.y) < 0.7 || !soft(h.m)) return false;
    // soft right through, with somewhere to fall to below
    const W = G.world, dy = h.n.y < 0 ? 1 : -1;
    let k = 0; while (k < 4 && soft(W.get(h.x, h.y + dy * k, h.z))) k++;
    if (!k) return false;
    const below = h.n.y < 0 ? h.y - 1 : h.y - k;
    return !W.get(h.x, below, h.z) && !W.get(h.x, below - 1, h.z);
  };
  OPS2.ABIL.collapse = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.4);
    if (!sinkable(h)) { GAD.tell(a, 'Stick it to a soft floor (or its underside) with a room below'); return false; }
    new Collapse(a, h); return spend();
  };

  /* ============================================================ movement */
  OPS2.chain('physics', function (a, dt) {
    if (a.ride && !a.ride.net) return rideStep(a, dt);
    if (a.climb && !a.climb.net) return climbStep(a, dt);
    if (a.state !== 'alive' || a.stance === 2 || a.vault) return false;
    const L = ladderNear(a); if (!L) return false;
    const dx = L.x - a.pos.x, dz = L.z - a.pos.z, d = Math.hypot(dx, dz);
    // falling into the hole from above: catch the ladder and slide down it
    if (a.vel.y < -2.5 && a.pos.y > L.bot + 0.4) { a.climb = { lad: L, slide: true }; return climbStep(a, dt); }
    // walking into it from below, facing it
    if (a.pos.y < L.top - 0.5 && d < 0.42 && a.mf > 0.3) {
      const f = a.fwd(V()); if (d < 0.08 || (f.x * dx + f.z * dz) / d > 0.3) { a.climb = { lad: L }; return climbStep(a, dt); }
    }
    return false;
  });
  OPS2.chain('letGo', function (a) {
    if (a.climb) { a.climb = null; return true; }
    if (a.ride) { a.ride = null; return true; }   // (a long drop, maybe)
  });
  OPS2.chain('interactions', function (a, out) {
    if (a.ride || a.climb) return;
    for (const z of G.ents) {
      if (!z.alive || z.type !== 'zipline' || z.team !== a.team) continue;
      const atA = U.dist3(a.pos, z.landA) < 1.6, atB = U.dist3(a.pos, z.landB) < 1.6;
      if (atA || atB) { out.push({ kind: 'ride', label: 'RIDE LINE', time: 0.2, ok: () => z.alive, run: () => OPS2.startRide(a, z, atB && !atA) }); return; }
    }
  });
  /* a bot crossing a link: climb, crawl or ride, then carry on along the path */
  OPS2.chain('followLink', function (a, b, dt) {
    const n = b.path[b.pi], l = n && n.link; if (!l) return false;
    const done = () => { b.pi++; if (a.stance === 2 && l.kind === 'crawl' && a.canStand(STAND)) a.setStance(0); return false; };
    if (U.dist2(a.pos, n) < 0.55 && Math.abs(a.pos.y - n.y) < 0.7 && !a.climb && !a.ride && !a.vault) return done();
    if (l.kind === 'ladder') {
      const L = l.ref; if (!L.alive) { b.path = null; b.goal = null; return true; }
      if (a.vault) return true;
      if (a.climb) { a.mf = l.back ? -1 : 1; a.mr = 0; return true; }
      // to the foot of it (going up), or into the hole (coming down: you catch it as you drop)
      const tgt = l.back ? V().set(L.x, a.pos.y, L.z) : V().set(L.x, L.bot, L.z);
      AI.faceTo(a, tgt.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0; a.sprint = false;
      return true;
    }
    if (l.kind === 'crawl') {
      const h = l.ref, from = l.back ? h.back : h.front;
      if (a.stance !== 2 && U.dist2(a.pos, from) < 1.3) a.setStance(2);
      AI.faceTo(a, n.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0; a.sprint = false;
      return true;
    }
    if (l.kind === 'zip') {
      const z = l.ref; if (!z.alive) { b.path = null; b.goal = null; return true; }
      if (a.ride || a.vault) { a.mf = a.mr = 0; return true; }
      const from = l.back ? z.landB : z.landA;
      if (U.dist2(a.pos, from) < 1.2) { if (OPS2.startRide(a, z, l.back)) return true; }
      AI.faceTo(a, from.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0;
      return true;
    }
    return false;
  });

  /* ============================================================== guests */
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'ladder') { x.lb = Math.round(e.bot * 100) / 100; x.lt = Math.round(e.top * 100) / 100; x.lx = pv(e.exit); }
    if (e.type === 'zipline') { x.za = pv(e.A); x.zb = pv(e.B); }
  });
  OPS2.chain('mirrorSet', function (m, x, first) {
    if (m.type === 'ladder' && x.lb != null && !m.built) {
      m.built = true; m.bot = x.lb; m.top = x.lt; m.exit = V().set(...x.lx); m.x = m.tpos.x; m.z = m.tpos.z;
      const g = ladderMesh(m.top - m.bot + 1); g.position.set(m.x, m.bot, m.z); G.scene.add(g); (m.extra || (m.extra = [])).push(g);
    }
    if (m.type === 'zipline' && x.za && !m.built) {
      m.built = true; m.A = V().set(...x.za); m.B = V().set(...x.zb);
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([m.A, m.B]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); G.scene.add(l); (m.extra || (m.extra = [])).push(l);
    }
  });
  OPS2.chain('guestEvent', function (e) {
    const me = G.player; if (!me || e.to !== NP.me) return;
    if (e.k === 'ride' && Array.isArray(e.f)) {
      const line = G.ents.find(x => x.nid === e.nid) || { alive: true };
      me.ride = { line, from: V().set(...e.f), to: V().set(...e.t), land: V().set(...e.l), t: 0, len: Math.max(1, U.dist3(V().set(...e.f), V().set(...e.t))), hum: 0 };
      me.rappel = null; return true;
    }
    if (e.k === 'unride') { me.ride = null; return true; }
    if (e.k === 'jolt' && Array.isArray(e.v)) { me.rappel = null; me.vault = null; me.ride = null; me.climb = null; me.knock = { vx: +e.v[0] || 0, vz: +e.v[1] || 0, t: 0.38 }; PLAYER.shake(0.5); HUD.toast('WINDOW GUARD: knocked off', 'warn'); return true; }
  });

  /* ================================================================= HUD */
  OPS2.chain('status', function (a) {
    if (a.climb && !a.climb.net) return 'ON LADDER' + KEYS.fmt(' · {forward} up · {back} down · {vault} let go');
    if (a.ride && !a.ride.net) return 'RIDING THE LINE' + KEYS.fmt(' · {vault} let go');
    return '';
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.ability.count <= 0 || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // Ferret, roaming: a crawl hole out of a room it is holding when the attack comes close
    if (ab.id === 'crawl' && !t && b.role === 'roam' && c.S.known && G.time - c.S.kt < 6 && U.dist3(a.pos, c.S.known) < 14 && G.time > (b.crawlT || 0)) {
      b.crawlT = G.time + 15;
      const h = GAD.aim(a, 2.0);
      if (h && Math.abs(h.n.y) < 0.5 && crawlable(h.m)) { GAD.ability(a); return true; }
    }
    return false;
  });
  /* attack prep: Span strings a line to an upper-floor site window; Rung puts a ladder up into the
     site from the room under it */
  OPS2.chain('aiPlanAtk', function (a, plan, c) {
    const { b, id } = c, W = G.world;
    if (id === 'zip') {
      const near = (op, dL) => plan.rooms.some(rm => rm.L + dL === op.L && GAD.opCenter(op).distanceTo(V().set(rm.cx, rm.fy + 1 + dL * 3, rm.cz)) < 14);
      const win = op => op.ext && op.kind === 'window' && op.L >= 1;
      const ops = U.shuffle(G.map.openings.filter(op => win(op) && near(op, 0))).concat(U.shuffle(G.map.openings.filter(op => win(op) && near(op, 1))));
      for (const op of ops) {
        const c0 = GAD.opCenter(op), outN = V(); if (op.axis === 'z') outN.set(0, 0, op.nrm || 1); else outN.set(op.nrm || 1, 0, 0);
        // the outside is the side with nothing in the way: try both
        for (const s of [1, -1]) {
          const nrm = outN.clone().multiplyScalar(s);
          for (const dist of [10, 14, 18, 8]) for (const side of [0, 4, -4]) {
            const st = c0.clone().addScaledVector(nrm, dist).add(V().set(nrm.z * side, 0, -nrm.x * side));
            st.y = W.groundBelow(st.x, c0.y + 1, st.z);
            if (!NAV.walkable(st) || Actor.indoors(st.x, st.y + 0.5, st.z)) continue;
            const A = st.clone().setY(st.y + 2.1), aim = c0.clone().setY(op.y0 * 0.25 + 0.4), d = aim.clone().sub(A), L = d.length(); d.divideScalar(L);
            if (L > 26 || W.raycast(A, d, L - 0.6)) continue;
            const pth = NAV.path(a.pos, st); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], st) > 1) continue;
            b.tasks.push({ at: st, look: aim, time: 0.7, hurry: true, maxTravel: 50, run: x => { AI.faceTo(x, aim, 1, 99); x.pitch = Math.atan2(aim.y - (x.pos.y + x.eyeH), Math.hypot(aim.x - x.pos.x, aim.z - x.pos.z)); if (GAD.ability(x)) { const z = G.ents.filter(q => q.alive && q.type === 'zipline' && q.owner === x).pop(); if (z) OPS2.startRide(x, z, false); x.bot.entered = true; } } });
            return false;   // (the rest of his kit is planned as usual)
          }
        }
      }
    }
    if (id === 'ladder') {
      // a room straight under a site room with a soft ceiling: the ladder goes up from there; else a
      // room straight over one with a soft floor: it comes down into the site
      const overlap = (rm, site) => !(rm.x1 < site.x0 || rm.x0 > site.x1 || rm.z1 < site.z0 || rm.z0 > site.z1);
      for (const dir of [1, -1]) for (const site of plan.rooms) {
        const rooms = G.map.rooms.filter(rm => rm.L === site.L - dir && overlap(rm, site));
        for (const rm of U.shuffle(rooms)) for (let i = 0; i < 6; i++) {
          const p = NAV.randomIn(rm); if (!p) continue;
          const x = Math.max(site.x0 + 2, Math.min(site.x1 - 2, Math.floor(p.x * 4))), z = Math.max(site.z0 + 2, Math.min(site.z1 - 2, Math.floor(p.z * 4)));
          const st = V().set((x + 0.5) / 4, rm.fy, (z + 0.5) / 4);
          if (!NAV.walkable(st)) continue;
          const h0 = dir > 0 ? W.raycast(st.clone().setY(st.y + 1.6), V().set(0, 1, 0), 2.5) : W.raycast(st.clone().setY(st.y + 0.4), V().set(0, -1, 0), 1);
          if (!h0 || !soft(h0.m)) continue;
          const pth = NAV.path(a.pos, st); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], st) > 1) continue;
          b.tasks.push({ at: st, time: 0.6, hurry: true, maxTravel: 50, run: y => { y.pitch = dir > 0 ? 1.3 : -1.35; const h = GAD.aim(y, 3.2); if (h && Math.abs(h.n.y) > 0.7) { const L = OPS2.cutLadder(y, h); if (L) y.ability.count--; } } });
          return false;
        }
      }
    }
    return false;
  });
  /* defence prep: Jolt guards the site's outside windows and hatches; Ferret cuts crawl holes out of
     the site; Sink rigs the floor just inside the ways in (where there is a floor to fall through) */
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { place, atEntry, ents, b, inner } = c, id = a.ability ? a.ability.id : null, W = G.world;
    if (id === 'wguard') {
      const wins = G.map.openings.filter(op => op.kind === 'window' && plan.rooms.some(rm => G.map.roomAt(GAD.opCenter(op).clone().add(V().set(0, -0.5, 0))) === rm || roomBeside(op, rm)));
      const ord = wins.concat(ents.filter(op => !wins.includes(op)));
      for (let i = 0; i < Math.min(3, ord.length); i++) {
        const op = ord[i], cc = GAD.opCenter(op), rr = plan.rooms.find(x => x.L === op.L) || plan.rooms[0];
        const inw = V().set(rr.cx - cc.x, 0, rr.cz - cc.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize();
        const st = cc.clone().addScaledVector(inw, 1.0); st.y = rr.fy;
        b.tasks.unshift({ at: st, look: cc, time: 0.6, run: x => { if (x.ability.count <= 0) return; const p = cc.clone().addScaledVector(inw, 0.16); p.y = op.y0 * 0.25 + 0.15; GAD.deployAt(x, 'wguard', p, inw); x.ability.count--; } });
      }
    }
    if (id === 'crawl') {
      const pans = U.shuffle(plan.rooms.flatMap(rm => AI.roomPanels(rm))).slice(0, 2);
      for (const p of pans) b.tasks.unshift({ at: p.stand, look: p.look.clone().setY(p.room.fy + 0.4), time: 0.5, run: x => { x.pitch = -0.45; AI.faceTo(x, p.look.clone().setY(p.room.fy + 0.3), 1, 99); GAD.ability(x); } }, { at: p.stand, time: 1.7 });
      b.role = 'roam';
    }
    if (id === 'collapse') for (let i = 0; i < Math.min(3, Math.max(1, ents.length)); i++) {
      const tk = atEntry(i, (x, op, st, inw, cc) => {
        if (x.ability.count <= 0) return;
        const p = cc.clone().addScaledVector(inw, 1.0); p.y = st.y + 0.05;
        const h = W.raycast(p.clone().setY(p.y + 0.4), V().set(0, -1, 0), 1);
        if (!h) return;
        h.p = V().set(h.px, h.py + 0.03, h.pz); h.n = V().set(h.nx, h.ny, h.nz); h.md = MAT[h.m];
        if (sinkable(h)) { new Collapse(x, h); x.ability.count--; OPS2.sunk = (OPS2.sunk || 0) + 1; }
      }, 0.6);
      if (tk) b.tasks.unshift(tk);
    }
  });
  function roomBeside(op, rm) { const c = GAD.opCenter(op); return Math.abs(c.y - (rm.fy + 1)) < 2 && c.x > rm.x0 * 0.25 - 0.6 && c.x < (rm.x1 + 1) * 0.25 + 0.6 && c.z > rm.z0 * 0.25 - 0.6 && c.z < (rm.z1 + 1) * 0.25 + 0.6; }
})();
