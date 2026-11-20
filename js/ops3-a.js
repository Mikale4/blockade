/* ops3-a.js -- seasons 15-18, batch A: KEYSTONE, people who rearrange the building.
     PIVOT    hinge cutter: a door-sized panel of soft wall becomes a door that opens and shuts
     BOUND    spring plate: a floor plate that throws whoever steps on it up and forward
     PLUMMET  drop line: down through a hole in a floor on a winch line, shooting from the ceiling
     PERCH    scaffold kit: a small steel scaffold with steps, built in a room in 3 s
     WINCH    rotation hoist: a hoist at a hatch or floor hole that carries anyone up or down a floor
     STRAIN   strain gauges: a gauge on a surface reports whoever cuts, breaches or charges it
   Built on js/ops2.js's registry (OPS2.ABIL, OPS2.chain hooks). Doors, scaffolds and holes are voxels,
   so pathfinding, bullets and explosions treat them like the rest of the building; plates and hoists
   are NAV links, so bots of either team use them. */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent;
  const STAND = Actor.STAND;
  const pv = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  const OPS3 = window.OPS3 = window.OPS3 || {};
  // can a body stand at (x, y, z)? (clear to standing height, something under the feet)
  const standAt = (x, y, z) => { const W = G.world; return !W.boxHits(x - 0.24, y + 0.02, z - 0.24, x + 0.24, y + STAND, z + 0.24) && W.boxHits(x - 0.1, y - 0.2, z - 0.1, x + 0.1, y - 0.01, z + 0.1); };
  const soft = m => m && MAT[m].xp && !MAT[m].reinf && !MAT[m].see && m !== M.RESIN && m !== M.LEAF;
  OPS3.standAt = standAt;
  // the walkable nodes of the main area, as an array (NAV.main is a Set), rebuilt with each map
  OPS3.navNodes = () => { if (OPS3._navSet !== NAV.main) { OPS3._navSet = NAV.main; OPS3._navArr = NAV.main ? [...NAV.main] : []; } return OPS3._navArr; };

  // the scaffold's steel (frames let most rounds through) and its boards
  DATA.mat('SCAFFOLD', 0x8a8f94, { hp: 10, pen: 0.75, xp: true, hb: true, melee: true, pat: 'ribs' });
  DATA.mat('SCAFDECK', 0x7a6446, { hp: 8, pen: 0.7, xp: true, hb: true, melee: true, pat: 'planks' });

  for (const t of ['spring']) GAD.TRAPS.add(t);
  for (const t of ['gauge', 'hoist']) { GAD.ELEC.add(t); GAD.TRAPS.add(t); }
  Object.assign(GAD.NAMES, { hinge: 'Hinged door', hingecut: 'Hinge cutter', spring: 'Spring plate', dropanchor: 'Drop-line anchor', hoist: 'Rotation hoist', gauge: 'Strain gauge', scafjob: 'Scaffold' });
  Object.assign(GAD.EXTRA, {
    spring: g => { g.box(-6, 0, -6, 6, 1, 6, 0x2a2e30); g.box(-5, 2, -5, 5, 2, 5, 0x3a7a5a); for (const x of [-4, 0, 4]) g.box(x, 2, -6, x, 2, 6, 0x7cf0a0); g.box(-1, 2, -7, 1, 2, -7, MD.glow(0x7cf0a0)); g.box(-6, 1, -6, -5, 3, -5, 0x555555); g.box(5, 1, 5, 6, 3, 6, 0x555555); },
    dropanchor: g => { g.box(-3, 0, -3, 3, 1, 3, 0x333333); g.box(-1, 2, -1, 1, 6, 1, 0x8a8f94); g.box(-2, 6, -2, 2, 7, 2, 0xc83a2a); g.set(0, 8, 0, MD.glow(0xfff0a0)); },
    hoist: g => { g.box(-4, 0, -4, 4, 2, 4, 0x2a3440); g.box(-1, 3, -1, 1, 14, 1, 0x8a8f94); g.box(-6, 14, -1, 6, 15, 1, 0x8a8f94); g.box(-3, 10, -3, 3, 13, 3, 0xf0c030); g.set(0, 12, -4, MD.glow(0x40c0f0)); },
    gauge: g => { g.box(-3, -1, 0, 3, 1, 1, 0x2a2c34); g.box(-2, 0, -1, 2, 0, -1, 0x9aa0a6); g.set(0, 0, -2, MD.glow(0x9a7cff)); g.set(-3, 0, -1, 0x9a7cff).set(3, 0, -1, 0x9a7cff); },
  });
  GAD.MESH_FN.hinge = () => new THREE.Group();
  GAD.MESH_FN.hingecut = () => new THREE.Group();
  GAD.MESH_FN.scafjob = () => new THREE.Group();

  /* ================================================================ PIVOT */
  const hingeable = m => m && MAT[m] && MAT[m].xp && MAT[m].wall && !MAT[m].reinf && !MAT[m].see && m !== M.RESIN && m !== M.BARR;
  OPS3.hingeable = hingeable;
  /* the panel a cut at h would make: 5 voxels wide, 9 tall from the floor, through the wall */
  OPS3.hingePlan = function (a, h, quiet) {
    const W = G.world, nx = Math.round(h.nx), nz = Math.round(h.nz), say = t => { if (!quiet) GAD.tell(a, t); return null; };
    if (Math.abs(nx) + Math.abs(nz) !== 1) return say('Aim square at a wall');
    const fy = Math.round(W.groundBelow(h.px + nx * 0.3, h.py, h.pz + nz * 0.3) * 4);
    let depth = 0; while (depth < 3 && hingeable(W.get(h.x - nx * depth, fy + 4, h.z - nz * depth))) depth++;
    if (!depth || W.get(h.x - nx * depth, fy + 4, h.z - nz * depth)) return say('No room on the other side of that wall');
    const cells = []; let face = 0, ok = 0;
    for (let t = -2; t <= 2; t++) for (let y = fy; y <= fy + 8; y++) for (let k = 0; k < depth; k++) {
      const x = nz ? h.x + t : h.x - nx * k, z = nx ? h.z + t : h.z - nz * k, m = W.get(x, y, z);
      if (k === 0) { face++; if (hingeable(m)) ok++; else if (m && MAT[m].reinf) return say('That wall is reinforced'); }
      if (hingeable(m)) cells.push([x, y, z, m]);
    }
    if (ok < face * 0.75) return say('Not enough wall there for a door');
    if (G.ents.some(e => e.alive && e.type === 'hinge' && e.cells.some(c => cells.some(d => d[0] === c[0] && d[1] === c[1] && d[2] === c[2])))) return say('There is a door there already');
    const u0 = (nz ? h.x - 2 : h.z - 2) * 0.25, faceL = ((nx ? h.x : h.z) + ((nx || nz) > 0 ? 1 : 0)) * 0.25;
    const center = nz ? V().set((h.x + 0.5) / 4, fy / 4 + 1.1, faceL) : V().set(faceL, fy / 4 + 1.1, (h.z + 0.5) / 4);
    return { cells, nx, nz, fy, depth, u0, faceL, center, m: h.m };
  };
  OPS2.ABIL.hinge = (a, ab, need, spend) => {
    const h = ab.count > 0 ? GAD.aim(a, 2.2) : null;
    if (h && Math.abs(h.n.y) < 0.5 && hingeable(h.m)) {
      const P = OPS3.hingePlan(a, h); if (!P) return false;
      OPS3.startCut(a, P); return true;   // (the charge is spent when the cut is finished)
    }
    return OPS3.toggleHinges(a);
  };
  OPS3.startCut = function (a, P) {
    const from = a.pos.clone();
    a.busy = 4.1; a.busyLabel = 'CUTTING A DOOR';
    const job = new Ent('hingecut', a, P.center, { model: false, hp: 999, hitR: 0 });
    job.blastproof = true; job.melee = false; job.meleeable = false;
    job.update = function (dt) {
      this.t += dt;
      if (a.state !== 'alive' || U.dist2(a.pos, from) > 1.2) { this.destroy('used'); a.busy = 0; GAD.tell(a, 'Cut abandoned'); return; }
      if (Math.random() < dt * 10) { const s = this.t / 4, p = P.center.clone(); p.y = P.fy / 4 + (s < 0.5 ? s * 4.4 : 2.2); if (P.nz) p.x = P.u0 + (s < 0.5 ? 0.1 : (s - 0.5) * 2.5); else p.z = P.u0 + (s < 0.5 ? 0.1 : (s - 0.5) * 2.5); FX.sparks(p, P.nx, 0, P.nz, 0xffb050); }
      if ((this.hum = (this.hum || 0) - dt) <= 0) { this.hum = 0.4; GAME.noise(P.center, 9, a, 'breach'); SFX.zap(P.center); }
      if (this.t < 4) return;
      this.destroy('used');
      if (a.ability && a.ability.count > 0) a.ability.count--;
      const d = new Hinge(a, P);
      GAD.tell(a, 'Door cut: press the ability (away from a wall) to open or shut your doors');
      if (window.VOICE) VOICE.say(a, 'ability');
      return d;
    };
    return job;
  };
  function doorMesh(P, color) {
    const g = new THREE.Group(), w = 1.25, hgt = 2.25, th = Math.max(0.12, P.depth * 0.25 - 0.02);
    const mat = new THREE.MeshBasicMaterial({ color });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, th), mat); slab.position.set(w / 2, hgt / 2, -th / 2); g.add(slab);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, hgt, th + 0.02), new THREE.MeshBasicMaterial({ color: 0x3a3a3a })); frame.position.set(0.03, hgt / 2, -th / 2); g.add(frame);
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); knob.position.set(w - 0.15, 1.0, 0.04); g.add(knob);
    // hinged at the panel's start, swung out to the side it was cut from
    if (P.nz) { g.position.set(P.u0, P.fy / 4, P.faceL); g.userData.closed = 0; g.userData.open = -P.nz * Math.PI / 2; }
    else { g.position.set(P.faceL, P.fy / 4, P.u0); g.userData.closed = -Math.PI / 2; g.userData.open = P.nx > 0 ? 0 : -Math.PI; }
    g.rotation.y = g.userData.closed;
    return g;
  }
  /* the hinged door: closed it is the wall's own voxels; open, they are gone and a slab hangs aside */
  class Hinge extends Ent {
    constructor(a, P) {
      super('hinge', a, P.center, { model: false, hp: 999, hitR: 0 });
      this.model = 'hinge'; this.P = P; this.cells = P.cells; this.closed = true; this.ruined = false;
      this.blastproof = false; this.meleeable = false; this.melee = false;
      this.color = MAT[P.m] ? MAT[P.m].c : 0xb8b2a0;
      this.mesh = doorMesh(P, this.color); this.mesh.visible = false; G.scene.add(this.mesh); this.swing = 0;
    }
    update(dt) {
      this.t += dt;
      // a panel shot or blasted while shut is a hole in a wall, not a door any more
      if (this.closed && !this.ruined && (this.t % 0.5) < dt && this.cells.some(c => G.world.get(c[0], c[1], c[2]) !== c[3])) { this.ruined = true; if (this.owner) GAD.tell(this.owner, 'One of your doors was smashed', 'warn'); }
      const ud = this.mesh.userData, want = this.closed ? 0 : 1;
      if (this.swing !== want) { this.swing = U.clamp(this.swing + (want ? dt : -dt) * 3, 0, 1); this.mesh.rotation.y = ud.closed + (ud.open - ud.closed) * this.swing; this.mesh.visible = this.swing > 0.02; }
    }
    // a body in the doorway stops it shutting
    blocked() { return G.actors.some(b => b.state !== 'dead' && this.cells.some(c => { const x = c[0] * 0.25, y = c[1] * 0.25, z = c[2] * 0.25; return x + 0.25 > b.pos.x - 0.26 && x < b.pos.x + 0.26 && z + 0.25 > b.pos.z - 0.26 && z < b.pos.z + 0.26 && y + 0.25 > b.pos.y && y < b.pos.y + (b.h || 1.8); })); }
    setOpen(open, who) {
      if (this.ruined || !this.alive || open === !this.closed) return false;
      const W = G.world;
      if (open) for (const c of this.cells) { if (W.get(c[0], c[1], c[2]) === c[3]) W.set(c[0], c[1], c[2], 0); }
      else { if (this.blocked()) { if (who) GAD.tell(who, 'Someone is in the doorway'); return false; } for (const c of this.cells) if (!W.get(c[0], c[1], c[2])) W.set(c[0], c[1], c[2], c[3]); }
      this.closed = !open;
      SFX.wood(this.pos, false); GAME.noise(this.pos, 12, who || this.owner, 'gadget');
      return true;
    }
    destroy(w) {
      if (!this.alive) return;
      // blown: an open door stays a hole; a shut one stays wall (now just wall)
      super.destroy(w === 'blast' ? 'silent' : w);
      if (this.mesh) G.scene.remove(this.mesh);
    }
  }
  OPS3.Hinge = Hinge;
  OPS3.toggleHinges = function (a) {
    const mine = G.ents.filter(e => e.alive && e.type === 'hinge' && e.owner === a && !e.ruined);
    if (!mine.length) { GAD.tell(a, a.ability && a.ability.count > 0 ? 'Aim at a soft wall to cut a door' : 'No doors left to work'); return false; }
    const open = mine.some(e => e.closed);
    let n = 0; for (const d of mine) if (d.setOpen(open, a)) n++;
    GAD.tell(a, n ? 'Doors ' + (open ? 'OPEN' : 'SHUT') : 'No door moved');
    a.busy = 0.4;
    return n > 0;
  };

  /* ================================================================ BOUND */
  const LAUNCH_UP = 14, LAUNCH_ON = 4.2;
  /* the arc a body thrown from p facing yaw follows: where (and if) it comes down on its feet */
  OPS3.arc = function (p, yaw) {
    const W = G.world, f = V().set(-Math.sin(yaw), 0, -Math.cos(yaw)), q = p.clone(), v = V().set(f.x * LAUNCH_ON, LAUNCH_UP, f.z * LAUNCH_ON), dt = 1 / 30;
    const hits = (x, y, z) => W.boxHits(x - 0.24, y + 0.05, z - 0.24, x + 0.24, y + 1.7, z + 0.24);
    for (let i = 0; i < 90; i++) {
      v.y -= 22 * dt;
      const nx = q.x + v.x * dt, nz = q.z + v.z * dt, ny = q.y + v.y * dt;
      if (hits(nx, q.y, nz)) { v.x = v.z = 0; } else { q.x = nx; q.z = nz; }
      if (hits(q.x, ny, q.z)) {
        if (v.y < 0) { const gy = W.groundBelow(q.x, q.y + 0.3, q.z); return standAt(q.x, gy, q.z) ? V().set(q.x, gy, q.z) : null; }
        v.y = 0;
      } else q.y = ny;
      if (q.y < p.y - 6) return null;
    }
    return null;
  };
  class Spring extends Ent {
    constructor(a, p, yaw) {
      if (!isFinite(yaw)) yaw = 0;
      super('spring', a, p, { model: 'spring', upright: true, yaw, hp: 50, hitR: 0.3 });
      this.yaw = yaw; this.cd = 0; this.blastproof = false;
      this.dir = V().set(-Math.sin(yaw), 0, -Math.cos(yaw));
      // the landing, for the bots: a one-way link over the arc, if it ends somewhere new
      const land = OPS3.arc(p, yaw);
      if (land && (land.y > p.y + 1 || U.dist2(land, p) > 3) && NAV.addLink) { this.land = land; NAV.addLink(p.clone(), land, 'spring', 3, this, true); }
      SFX.metal(p); GAME.noise(p, 10, a, 'gadget');
    }
    update(dt) {
      this.t += dt; if (this.t < 0.4 || G.time < this.cd) return;
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.stance === 2 || b.ride || b.climb || b.hang || b.hoist || b.vault || b.flyT > G.time) continue;
        if (Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z) > 0.42 || Math.abs(b.pos.y - this.pos.y) > 0.35) continue;
        OPS3.launch(b, this); this.cd = G.time + 0.6; break;
      }
    }
    onDestroy() { NAV.dropLinks(this); }
  }
  OPS3.launch = function (b, s) {
    const v = [s.dir.x * LAUNCH_ON, LAUNCH_UP, s.dir.z * LAUNCH_ON];
    b.vel.set(v[0], v[1], v[2]); b.onGround = false; b.flyT = G.time + 1.6; b.safeFallT = G.time + 2.6; b.interact = null;
    SFX.whoosh(s.pos); SFX.metal(s.pos); GAME.noise(s.pos, 22, b, 'gadget');
    if (b.net && window.NP) NP.push({ k: 'launch', to: b.net, v });
    if (window.VOICE && b.op && b.op.id === 'bound') VOICE.say(b, 'move');
  };
  OPS2.ABIL.spring = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 1.1);
    if (!p) { GAD.tell(a, 'Put it on clear floor in front of you'); return false; }
    new Spring(a, p, a.yaw); return spend();
  };
  OPS2.DEPLOY.spring = (a, p, n, yaw) => new Spring(a, p, yaw);

  /* =============================================================== PLUMMET */
  /* a hole in the floor in front of her: a column of air through the slab with a room under it */
  OPS3.findHole = function (a, reach) {
    const W = G.world, f = a.fwd(V()); f.y = 0; f.normalize();
    const fy = Math.round(a.pos.y * 4);
    for (const d of [0.5, 0.8, 1.1, 1.4].filter(d => d <= (reach || 1.5))) {
      const x = Math.floor((a.pos.x + f.x * d) * 4), z = Math.floor((a.pos.z + f.z * d) * 4);
      let open = true;
      for (let dx = -1; dx <= 1 && open; dx++) for (let dz = -1; dz <= 1 && open; dz++) for (let k = 1; k <= 2; k++) if (W.get(x + dx, fy - k, z + dz)) open = false;
      if (!open) continue;
      // down to the floor beneath: at least 2 m of drop, at most 6
      const cx = (x + 0.5) / 4, cz = (z + 0.5) / 4, bot = W.groundBelow(cx, a.pos.y - 0.3, cz);
      if (a.pos.y - bot < 2 || a.pos.y - bot > 6.5) continue;
      return { x: cx, z: cz, top: a.pos.y, bot };
    }
    return null;
  };
  class DropLine extends Ent {
    constructor(a, H) {
      const f = V().set(a.pos.x - H.x, 0, a.pos.z - H.z); if (f.lengthSq() < 0.01) f.set(1, 0, 0); f.normalize();
      const p = V().set(H.x + f.x * 0.55, H.top + 0.01, H.z + f.z * 0.55);
      super('dropanchor', a, p, { model: 'dropanchor', upright: true, hp: 1, hitR: 0.16 });
      this.H = H; this.blastproof = false;
      this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().setY(p.y + 0.3), V().set(H.x, H.top, H.z)]), new THREE.LineBasicMaterial({ color: 0x1a1a1a })); G.scene.add(this.line);
    }
    update(dt) {
      this.t += dt;
      const r = G.actors.find(b => b.hang && b.hang.line === this), end = r ? r.pos.clone().setY(r.pos.y + 1.7) : V().set(this.H.x, this.H.top - 0.3, this.H.z);
      const P = this.line.geometry.attributes.position; P.setXYZ(1, end.x, end.y, end.z); P.needsUpdate = true;
    }
    destroy(w) {
      if (!this.alive) return;
      super.destroy(w);
      if (this.line) { G.scene.remove(this.line); this.line = null; }
      for (const b of G.actors) if (b.hang && b.hang.line === this) { b.hang = null; if (b.net && window.NP) NP.push({ k: 'unhang', to: b.net }); }
    }
  }
  OPS3.startHang = function (a, L) {
    if (a.hang || a.state !== 'alive') return false;
    a.hang = { line: L, x: L.H.x, z: L.H.z, top: L.H.top, bot: L.H.bot, hum: 0 };
    a.pos.set(L.H.x, L.H.top - 1.9, L.H.z); a.vel.set(0, 0, 0); a.rappel = null; a.climb = null;
    if (a.net && window.NP) NP.push({ k: 'hang', to: a.net, nid: L.nid, h: [L.H.x, L.H.z, L.H.top, L.H.bot].map(v => Math.round(v * 100) / 100) });
    SFX.whoosh(a.pos); GAME.noise(a.pos, 12, a, 'gadget');
    return true;
  };
  /* no hole? the anchor's cutter punches a body-sized one (3 x 3 voxels) through a soft floor or roof
     in front of her, 2.5 s, before she goes down. Reinforced and resin floors stop it */
  OPS3.punchPlan = function (a) {
    const W = G.world, f = a.fwd(V()); f.y = 0; f.normalize();
    const fy = Math.round(a.pos.y * 4), x = Math.floor((a.pos.x + f.x * 1.0) * 4), z = Math.floor((a.pos.z + f.z * 1.0) * 4);
    let k = 0; while (k < 4 && W.get(x, fy - 1 - k, z)) k++;
    if (!k || k >= 4) return null;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let i = 1; i <= k; i++) { const m = W.get(x + dx, fy - i, z + dz); if (m && !soft(m)) return null; }
    const cx = (x + 0.5) / 4, cz = (z + 0.5) / 4, bot = W.groundBelow(cx, (fy - k) / 4 - 0.05, cz);
    if (a.pos.y - bot < 2 || a.pos.y - bot > 6.5) return null;
    return { x, z, fy, k };
  };
  OPS3.punch = function (a, P) {
    const W = G.world; let n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let i = 1; i <= P.k; i++) if (W.get(P.x + dx, P.fy - i, P.z + dz)) { W.set(P.x + dx, P.fy - i, P.z + dz, 0); n++; }
    const c = V().set((P.x + 0.5) / 4, P.fy / 4, (P.z + 0.5) / 4);
    SFX.crumble(c, n); FX.puff(c, 0.8, 0.6, 0xc8b8a0); GAME.noise(c, 30, a, 'breach'); G.emit && G.emit('breach');
  };
  OPS2.ABIL.dropline = (a, ab, need, spend) => {
    // her line already rigged: back on it from the edge
    const mine = G.ents.find(e => e.alive && e.type === 'dropanchor' && e.owner === a);
    if (mine && U.dist2(a.pos, mine.pos) < 1.8 && Math.abs(a.pos.y - mine.H.top) < 0.5) return OPS3.startHang(a, mine);
    if (!need()) return false;
    const H = OPS3.findHole(a, 1.5);
    if (H) { const L = new DropLine(a, H); OPS3.startHang(a, L); return spend(); }
    const P = OPS3.punchPlan(a);
    if (!P) { GAD.tell(a, 'Face a hole, an open hatch or a soft floor with a room under it'); return false; }
    // cut, then down she goes
    const from = a.pos.clone(); a.busy = 2.6; a.busyLabel = 'CUTTING THROUGH';
    const job = new Ent('cutting', a, V().set((P.x + 0.5) / 4, P.fy / 4, (P.z + 0.5) / 4), { model: false, hp: 999, hitR: 0 });
    job.blastproof = true; job.meleeable = false;
    job.update = function (dt) {
      this.t += dt;
      if (a.state !== 'alive' || U.dist2(a.pos, from) > 1.0) { this.destroy('used'); a.busy = 0; return; }
      if (Math.random() < dt * 8) FX.sparks(this.pos, 0, 1, 0, 0xffb050);
      if ((this.hum = (this.hum || 0) - dt) <= 0) { this.hum = 0.4; GAME.noise(this.pos, 10, a, 'breach'); SFX.zap(this.pos); }
      if (this.t < 2.5) return;
      this.destroy('used');
      OPS3.punch(a, P);
      const cx = (P.x + 0.5) / 4, cz = (P.z + 0.5) / 4, top = P.fy / 4, H2 = { x: cx, z: cz, top, bot: G.world.groundBelow(cx, top - P.k * 0.25 - 0.05, cz) };
      if (a.ability.count > 0) { a.ability.count--; const L = new DropLine(a, H2); OPS3.startHang(a, L); }
    };
    return true;
  };
  function hangStep(a, dt) {
    const h = a.hang;
    if (h.line && h.line.alive === false) { a.hang = null; return false; }
    if (a.state !== 'alive') { a.hang = null; return false; }
    a.vel.set(0, 0, 0); a.onGround = false; a.stance = 0; a.h = STAND; a.eyeH = STAND - 0.15; a.lean = 0; a.leanT = 0;
    a.pos.x += (h.x - a.pos.x) * Math.min(1, dt * 8); a.pos.z += (h.z - a.pos.z) * Math.min(1, dt * 8);
    const v = a.mf > 0.2 ? 1.8 : a.mf < -0.2 ? -1.8 : 0;
    a.pos.y += v * dt;
    if (a.pos.y + 1.75 > h.top + 0.05 && v > 0) {
      // back up through the hole: out onto the floor beside it
      const f = a.fwd(V()); f.y = 0; f.normalize();
      let exit = null; for (const [sx, sz] of [[f.x, f.z], [-f.x, -f.z], [-f.z, f.x], [f.z, -f.x]]) { if (exit) break; for (const d of [0.95, 1.2]) if (standAt(h.x + sx * d, h.top, h.z + sz * d)) { exit = V().set(h.x + sx * d, h.top, h.z + sz * d); break; } }
      a.hang = null;
      if (exit) a.vault = { t: 0, dur: 0.5, from: a.pos.clone(), to: exit, top: h.top + 0.35 };
      return true;
    }
    if (a.pos.y <= h.bot) { a.pos.y = h.bot; a.hang = null; a.onGround = true; return true; }
    if (v) { h.hum -= dt; if (h.hum <= 0) { h.hum = 0.4; SFX.zap(a.pos); GAME.noise(a.pos, 10, a, 'gadget'); } }
    a.moving = 0;
    return true;
  }

  /* ================================================================= PERCH */
  /* a scaffold: a deck of boards on four steel legs with steps up one side, as high as the room lets
     a man stand on it (0.5-1.5 m). Built from voxels: it is cover, it is walked on, it is shot through
     and blown apart like the rest of the building */
  OPS3.scaffoldPlan = function (a, quiet) {
    const W = G.world, say = t => { if (!quiet) GAD.tell(a, t); return null; };
    const p = GAD.floorAhead(a, 1.9); if (!p) return say('Find clear floor ahead');
    const fy = Math.round(p.y * 4), cx = Math.floor(p.x * 4), cz = Math.floor(p.z * 4);
    // facing: the steps come down toward Perch
    const f = a.fwd(V()); f.y = 0; f.normalize(); const sx = Math.abs(f.x) > Math.abs(f.z) ? -Math.sign(f.x) : 0, sz = sx ? 0 : -Math.sign(f.z);
    const x0 = cx - 3, z0 = cz - 3, x1 = cx + 2, z1 = cz + 2;
    let clear = 99;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!W.get(x, fy - 1, z)) return say('The floor there is not solid');
      let k = 0; while (k < 16 && !W.get(x, fy + k, z)) k++;
      clear = Math.min(clear, k);
    }
    if (clear < 10) return say('Not enough room to stand up there');
    const hv = Math.max(2, Math.min(6, clear - 8));
    // the steps: hv-1 of them, three wide, off the side facing Perch
    const steps = [];
    for (let i = 1; i < hv; i++) for (let w = -1; w <= 1; w++) {
      const x = sx ? (sx > 0 ? x1 + (hv - i) : x0 - (hv - i)) : cx + w, z = sz ? (sz > 0 ? z1 + (hv - i) : z0 - (hv - i)) : cz + w;
      for (let y = fy; y < fy + i + 8; y++) if (W.get(x, y, z)) return say('Something is in the way of the steps');
      if (!W.get(x, fy - 1, z)) return say('The floor there is not solid');
      steps.push([x, fy + i - 1, z]);
    }
    return { x0, z0, x1, z1, fy, hv, steps, center: V().set((cx + 0.5) / 4, fy / 4, (cz + 0.5) / 4), deck: V().set((cx + 0.5) / 4, (fy + hv) / 4, (cz + 0.5) / 4) };
  };
  OPS3.buildScaffold = function (a, P, instant) {
    const W = G.world, cells = [];
    // legs, then the deck, then the steps (in the order they go up)
    for (const [x, z] of [[P.x0, P.z0], [P.x1, P.z0], [P.x0, P.z1], [P.x1, P.z1]]) for (let y = P.fy; y < P.fy + P.hv - 1; y++) cells.push([x, y, z, M.SCAFFOLD]);
    for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) cells.push([x, P.fy + P.hv - 1, z, M.SCAFDECK]);
    for (const [x, y, z] of P.steps) cells.push([x, y, z, M.SCAFDECK]);
    // a rail on the far side: a little cover for the man on top
    if (P.hv >= 3) for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) {
      const edge = x === P.x0 || x === P.x1 || z === P.z0 || z === P.z1, stepSide = P.steps.some(s => Math.abs(s[0] - x) <= 1 && Math.abs(s[2] - z) <= 1);
      if (edge && !stepSide && (x + z) % 2 === 0) cells.push([x, P.fy + P.hv, z, M.SCAFFOLD]);
    }
    if (instant) { for (const c of cells) W.set(c[0], c[1], c[2], c[3]); return true; }
    const job = new Ent('scafjob', a, P.center, { model: false, hp: 999, hitR: 0 });
    job.blastproof = true; job.meleeable = false; job.i = 0;
    a.busy = 3; a.busyLabel = 'BUILDING';
    job.update = function (dt) {
      this.t += dt;
      const want = Math.min(cells.length, Math.ceil(cells.length * this.t / 3));
      for (; this.i < want; this.i++) { const c = cells[this.i]; if (!W.get(c[0], c[1], c[2]) && !G.actors.some(b => b.state !== 'dead' && Math.abs(b.pos.x - (c[0] + 0.5) / 4) < 0.3 && Math.abs(b.pos.z - (c[2] + 0.5) / 4) < 0.3 && b.pos.y < (c[1] + 1) / 4 && b.pos.y + 1.8 > c[1] / 4)) W.set(c[0], c[1], c[2], c[3]); }
      if (Math.random() < dt * 6) { SFX.metal(P.center); GAME.noise(P.center, 14, a, 'reinforce'); }
      if (this.i >= cells.length) this.destroy('used');
    };
    return true;
  };
  OPS2.ABIL.scaffold = (a, ab, need, spend) => {
    if (!need()) return false;
    const P = OPS3.scaffoldPlan(a); if (!P) return false;
    OPS3.buildScaffold(a, P); a.lastScaffold = P;
    return spend();
  };

  /* ================================================================= WINCH */
  /* a hoist at a hole in a floor: from the floor under the hole to the floor beside it above. Anyone
     rides it with interact (1.5 s). The motor box sits on the upper floor at the edge: one bullet */
  OPS3.hoistAt = function (a, quiet) {
    const W = G.world, say = t => { if (!quiet) GAD.tell(a, t); return null; };
    const h = GAD.aim(a, 2.8);
    if (!h || Math.abs(h.n.y) < 0.7) return say('Look at a hatch or a hole in a floor or ceiling');
    if (h.m === M.RHATCH) return say('That hatch is reinforced');
    const up = h.n.y < 0;   // looking up at a ceiling (the hole is above) or down at a floor
    let hx = h.x, hz = h.z;
    if (h.m === M.HATCH) {
      // the hatch is opened for it: every hatch voxel joined to the one looked at
      const st = [[h.x, h.z]], seen = new Set(); let n = 0, sx = 0, sz = 0;
      while (st.length && n < 64) { const [x, z] = st.pop(), k = x + ',' + z; if (seen.has(k)) continue; seen.add(k); if (W.get(x, h.y, z) !== M.HATCH) continue; W.set(x, h.y, z, 0); n++; sx += x; sz += z; st.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]); }
      hx = Math.round(sx / n - 0.5); hz = Math.round(sz / n - 0.5);
      SFX.wood(h.p, true); GAME.noise(h.p, 18, a, 'breach');
    } else {
      // a hole: the nearest place in the slab row with 3 x 3 voxels of air
      let best = null, bd = 99;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
        let open = true; for (let i = -1; i <= 1 && open; i++) for (let j = -1; j <= 1 && open; j++) if (W.get(h.x + dx + i, h.y, h.z + dz + j)) open = false;
        if (open && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = [h.x + dx, h.z + dz]; }
      }
      if (!best) return say('Look at a hatch or a hole in a floor or ceiling');
      [hx, hz] = best;
    }
    const cx = (hx + 0.5) / 4, cz = (hz + 0.5) / 4;
    let top, bot;
    if (!up) { top = Math.round(a.pos.y * 4) / 4; bot = W.groundBelow(cx, top - 0.3, cz); }
    else {
      bot = Math.round(a.pos.y * 4) / 4; top = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) { const g = W.groundBelow(cx + dx, h.py + 1.4, cz + dz); if (g > bot + 1.8) { top = g; break; } }
    }
    if (top == null || top - bot > 4.6 || top - bot < 2) return say('There is no floor above and below to hoist between');
    for (let y = Math.floor(bot * 4) + 1; y < Math.floor(top * 4) + 7; y++) if (W.get(hx, y, hz)) return say('The way through is blocked: open it up first');
    let exit = null;
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (exit) break; for (const d of [1.0, 1.25]) if (standAt(cx + sx * d, top, cz + sz * d)) { exit = V().set(cx + sx * d, top, cz + sz * d); break; } }
    if (!exit) return say('No room to step off at the top');
    return { x: cx, z: cz, bot, top, exit };
  };
  class Hoist extends Ent {
    constructor(a, H) {
      const mp = H.exit.clone().lerp(V().set(H.x, H.top, H.z), 0.35); mp.y = H.top + 0.01;
      super('hoist', a, mp, { model: 'hoist', upright: true, yaw: Math.atan2(-(H.x - mp.x), -(H.z - mp.z)), hp: 1, hitR: 0.2 });
      this.H = H; this.blastproof = false;
      this.cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V().set(H.x, H.top + 0.95, H.z), V().set(H.x, H.bot + 0.1, H.z)]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); G.scene.add(this.cable);
      NAV.addLink(V().set(H.x, H.bot, H.z), H.exit.clone(), 'hoist', 3, this);
      SFX.metal(mp); GAME.noise(mp, 16, a, 'gadget');
    }
    destroy(w) {
      if (!this.alive) return;
      super.destroy(w);
      if (this.cable) { G.scene.remove(this.cable); this.cable = null; }
      NAV.dropLinks(this);
      for (const b of G.actors) if (b.hoist && b.hoist.h === this) b.hoist = null;
    }
  }
  OPS3.rideHoist = function (a, h, down) {
    if (a.hoist || a.state !== 'alive' || !h.alive) return false;
    const H = h.H, from = a.pos.clone(), to = down ? V().set(H.x, H.bot, H.z) : H.exit.clone();
    a.hoist = { h, from, to, mid: V().set(H.x, down ? H.top : H.top + 0.05, H.z), down, t: 0 };
    a.interact = null; a.rappel = null;
    if (a.net && window.NP) NP.push({ k: 'hoist', to: a.net, nid: h.nid, f: pv(from), t: pv(to), m: pv(a.hoist.mid), d: down ? 1 : 0 });
    SFX.zap(h.pos); SFX.metal(h.pos); GAME.noise(h.pos, 18, a, 'gadget');
    return true;
  };
  function hoistStep(a, dt) {
    const r = a.hoist;
    if (!r.h || r.h.alive === false || a.state !== 'alive') { a.hoist = null; return false; }
    r.t = Math.min(1, r.t + dt / 1.5);
    // up: straight up the cable, then a step sideways onto the floor; down: in over the hole, then down
    const k = r.t, H = r.h.H || r;
    let p;
    if (!r.down) { const up = V().set(H.x, U.lerp(r.from.y, r.to.y + 0.1, Math.min(1, k / 0.8)), H.z); p = k < 0.8 ? up : up.lerp(r.to, (k - 0.8) / 0.2); }
    else { const over = V().set(H.x, r.from.y, H.z); p = k < 0.2 ? r.from.clone().lerp(over, k / 0.2) : over.setY(U.lerp(r.from.y, r.to.y, (k - 0.2) / 0.8)); }
    a.pos.copy(p); a.vel.set(0, 0, 0); a.onGround = false; a.stance = 0; a.h = STAND; a.moving = 0;
    if (r.t >= 1) { a.pos.copy(r.to); a.hoist = null; a.onGround = true; }
    return true;
  }
  OPS2.ABIL.hoist = (a, ab, need, spend) => {
    if (!need()) return false;
    const H = OPS3.hoistAt(a); if (!H) return false;
    if (G.ents.some(e => e.alive && e.type === 'hoist' && Math.hypot(e.H.x - H.x, e.H.z - H.z) < 1)) { GAD.tell(a, 'There is a hoist there already'); return false; }
    new Hoist(a, H); return spend();
  };

  /* ================================================================ STRAIN */
  /* a gauge feels a patch 2.5 m round where it is glued. Any voxel in it that changes or takes damage,
     and any attacker gadget stuck or working in it, is a reading: whoever caused it is marked for 3 s */
  OPS3.cause = null;
  OPS3.touched = []; OPS3.touchedBy = [];
  OPS3.watching = 0;
  const VWp = window.VW && VW.World && VW.World.prototype;
  if (VWp) {
    const oHit = VWp.hitVoxel, oSet = VWp.set;
    // (who did it is kept with each change: the shooter is only known at that moment)
    VWp.hitVoxel = function (x, y, z, amount) { if (OPS3.watching) { OPS3.touched.push(x, y, z, 1); OPS3.touchedBy.push(OPS3.cause); } return oHit.call(this, x, y, z, amount); };
    VWp.set = function (x, y, z, m) { if (OPS3.watching && this === G.world) { OPS3.touched.push(x, y, z, m === DATA.M.WEAK ? 3 : 2); OPS3.touchedBy.push(OPS3.cause); } return oSet.call(this, x, y, z, m); };
  }
  // who did it: the shooter, the swinger or the bomb's owner of the moment
  const wrapCause = (obj, key, who) => { const o = obj[key]; obj[key] = function () { const prev = OPS3.cause; OPS3.cause = who.apply(null, arguments) || prev; try { return o.apply(this, arguments); } finally { OPS3.cause = prev; } }; };
  wrapCause(WPN, 'trace', s => s);
  wrapCause(WPN, 'melee', s => s);
  wrapCause(GAD, 'explode', function () { for (const v of arguments) if (v && v.isActor) return v; return null; });
  class Gauge extends Ent {
    constructor(a, p, n, vox) {
      super('gauge', a, p, { model: 'gauge', normal: n, hp: 1, hitR: 0.1 });
      this.vox = vox; this.cd = 0; this.seen = new Set(); this.blastproof = false;
      OPS3.watching++;
    }
    feel(cause, what) {
      if (G.time < this.cd) return;
      if (!cause || cause.team === this.team || cause.state === 'dead') return;
      this.cd = G.time + 2;
      GAME.mark(cause, this.team, 3, true);
      const rm = G.map.roomAt && G.map.roomAt(this.pos.clone().add(V().set(0, -0.5, 0)));
      GAD.tellTeam(this.team, 'STRAIN GAUGE: ' + what + (rm && rm.name ? ' · ' + rm.name : ''), true);
      OPS3.alerts.push({ p: this.pos.clone(), t: G.time, team: this.team });
      SFX.beep(this.pos, 1500, 0.15);
      if (window.VOICE && this.owner && this.owner.state === 'alive') VOICE.say(this.owner, 'intel');
    }
    update(dt) {
      this.t += dt;
      if (OPS3.gt !== G.time) { OPS3.gt = G.time; OPS3.gaugeTick(); }   // (the first gauge each frame reads for all)
      // charges and tools of the attack working on this patch
      if ((this.scan = (this.scan || 0) - dt) <= 0) {
        this.scan = 0.3;
        for (const e of G.ents) {
          if (!e.alive || e.team === this.team || e.team < 0 || this.seen.has(e) || !e.owner) continue;
          if (!(e.stuck || e.stickVox || WORKING.has(e.type))) continue;   // (stuck to it or working on it, not flying past)
          if (U.dist3(e.pos, this.pos) > 2.5) continue;
          this.seen.add(e);
          this.feel(e.owner, e.type === 'hingecut' ? 'A WALL IS BEING CUT' : 'CHARGE PLANTED (' + (GAD.NAMES[e.type] || e.type) + ')');
        }
      }
    }
    destroy(w) { if (this.alive) OPS3.watching = Math.max(0, OPS3.watching - 1); super.destroy(w); }
  }
  OPS3.alerts = [];
  const WORKING = new Set(['hingecut', 'cutting', 'bore', 'breach', 'degauss', 'claymore', 'spike', 'flankcam', 'triang', 'stake']);
  // the readings: every touched voxel in a gauge's patch, once a frame
  OPS3.gaugeTick = function () {
    const T = OPS3.touched; if (!T.length) return;
    const gs = G.ents.filter(e => e.alive && e.type === 'gauge');
    if (gs.length) for (let i = 0; i < T.length; i += 4) {
      const x = T[i], y = T[i + 1], z = T[i + 2], k = T[i + 3];
      for (const g of gs) {
        const dx = x - g.vox.x, dy = y - g.vox.y, dz = z - g.vox.z;
        if (dx * dx + dy * dy + dz * dz > 100) continue;
        let who = OPS3.touchedBy[i >> 2];
        if (who && who.team === g.team) continue;   // (their own team's doing: not a reading)
        if (!who) {
          // a gadget doing it (a bore, a degausser, a cutter): its owner; else the nearest attacker
          const p = V().set((x + 0.5) / 4, (y + 0.5) / 4, (z + 0.5) / 4);
          let best = null, bd = 6;
          for (const e of G.ents) if (e.alive && e.owner && e.team !== g.team && e.team >= 0 && U.dist3(e.pos, p) < 1.6) { best = e.owner; break; }
          if (!best) for (const b of G.actors) if (b.state === 'alive' && b.team !== g.team && !b.hostage && U.dist3(b.pos, p) < bd) { bd = U.dist3(b.pos, p); best = b; }
          who = best;
        }
        g.feel(who, k === 3 ? 'STEEL DEGAUSSED' : k === 2 ? 'SURFACE BREACHED' : 'SURFACE HIT');
      }
    }
    T.length = 0; OPS3.touchedBy.length = 0;
  };
  OPS2.ABIL.gauge = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.2);
    if (!h || h.md.see) { GAD.tell(a, 'Glue it to a wall, a floor, a hatch or a barricade'); return false; }
    new Gauge(a, h.p, h.n, { x: h.x, y: h.y, z: h.z }); return spend();
  };
  OPS3.placeGauge = function (a, h) { return new Gauge(a, h.p, h.n, { x: h.x, y: h.y, z: h.z }); };

  /* ============================================================ movement */
  OPS2.chain('physics', function (a, dt) {
    if (a.hang && !a.hang.net) return hangStep(a, dt);
    if (a.hoist && !a.hoist.net) return hoistStep(a, dt);
    return false;
  });
  OPS2.chain('letGo', function (a) {
    if (a.hang) { a.hang = null; return true; }
  });
  OPS2.chain('interactions', function (a, out) {
    if (a.ride || a.climb || a.hang || a.hoist) return;
    for (const d of G.ents) {
      if (!d.alive) continue;
      if (d.type === 'hinge' && !d.ruined && Math.hypot(a.pos.x - d.pos.x, a.pos.z - d.pos.z) < 1.5 && Math.abs(a.pos.y + 1 - d.pos.y) < 1.4) {
        out.push({ kind: 'hinge', label: d.closed ? 'OPEN DOOR' : 'SHUT DOOR', time: 0.3, ok: () => d.alive, run: () => d.setOpen && d.setOpen(d.closed, a) }); return;
      }
      if (d.type === 'hoist' && d.H) {
        const H = d.H, atBot = Math.hypot(a.pos.x - H.x, a.pos.z - H.z) < 0.9 && Math.abs(a.pos.y - H.bot) < 0.6, atTop = U.dist2(a.pos, V().set(H.x, H.top, H.z)) < 1.6 && Math.abs(a.pos.y - H.top) < 0.6;
        if (atBot || atTop) { out.push({ kind: 'hoist', label: atBot ? 'RIDE HOIST UP' : 'RIDE HOIST DOWN', time: 0.2, ok: () => d.alive, run: () => OPS3.rideHoist(a, d, !atBot) }); return; }
      }
      if (d.type === 'dropanchor' && d.H && d.team === a.team && !a.hang && U.dist2(a.pos, d.pos) < 1.6 && Math.abs(a.pos.y - d.H.top) < 0.6) {
        out.push({ kind: 'dropline', label: 'GO DOWN THE LINE', time: 0.3, ok: () => d.alive, run: () => OPS3.startHang(a, d) }); return;
      }
    }
  });
  /* a bot crossing a link: onto the plate (and keep going), onto the hoist */
  OPS2.chain('followLink', function (a, b, dt) {
    const n = b.path[b.pi], l = n && n.link; if (!l) return false;
    if (l.kind === 'spring') {
      const s = l.ref; if (!s.alive) { b.path = null; b.goal = null; return true; }
      if (a.flyT > G.time && !a.onGround) { AI.faceTo(a, n.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0; a.sprint = false; return true; }
      if (U.dist2(a.pos, n) < 0.7 && Math.abs(a.pos.y - n.y) < 0.8) { b.pi++; return false; }
      AI.faceTo(a, s.pos.clone().setY(a.pos.y + a.eyeH), dt, 12); a.mf = U.dist2(a.pos, s.pos) > 0.12 ? 1 : 0; a.mr = 0; a.sprint = false; a.walk = U.dist2(a.pos, s.pos) < 0.8;
      return true;
    }
    if (l.kind === 'hoist') {
      const h = l.ref; if (!h.alive) { b.path = null; b.goal = null; return true; }
      if (a.hoist || a.vault) { a.mf = a.mr = 0; return true; }
      if (U.dist2(a.pos, n) < 0.6 && Math.abs(a.pos.y - n.y) < 0.6) { b.pi++; return false; }
      const H = h.H, from = l.back ? V().set(H.x, H.top, H.z) : V().set(H.x, H.bot, H.z), d = Math.hypot(a.pos.x - from.x, a.pos.z - from.z);
      if ((l.back ? d < 1.4 && Math.abs(a.pos.y - H.top) < 0.6 : d < 0.8 && Math.abs(a.pos.y - H.bot) < 0.6) && OPS3.rideHoist(a, h, !!l.back)) return true;
      AI.faceTo(a, from.clone().setY(a.pos.y + a.eyeH), dt, 10); a.mf = 1; a.mr = 0; a.sprint = false;
      return true;
    }
    return false;
  });

  /* ============================================================== guests */
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'hinge' && e.P) { const P = e.P; x.hg = [P.nx, P.nz, P.fy, P.depth, Math.round(P.u0 * 100) / 100, Math.round(P.faceL * 100) / 100, e.closed ? 1 : 0, e.ruined ? 1 : 0]; x.hc = e.color; }
    if (e.type === 'dropanchor' && e.H) x.dh = [e.H.x, e.H.z, e.H.top, e.H.bot].map(v => Math.round(v * 100) / 100);
    if (e.type === 'hoist' && e.H) x.ho = [e.H.x, e.H.z, e.H.top, e.H.bot].map(v => Math.round(v * 100) / 100).concat(pv(e.H.exit));
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if (m.type === 'hinge' && x.hg) {
      const [nx, nz, fy, depth, u0, faceL, closed, ruined] = x.hg;
      if (!m.built) { m.built = true; m.P = { nx, nz, fy, depth, u0, faceL }; m.door = doorMesh(m.P, x.hc || 0xb8b2a0); G.scene.add(m.door); (m.extra || (m.extra = [])).push(m.door); m.swing = closed ? 0 : 1; }
      m.closed = !!closed; m.ruined = !!ruined;
    }
    if (m.type === 'dropanchor' && x.dh && !m.H) m.H = { x: x.dh[0], z: x.dh[1], top: x.dh[2], bot: x.dh[3] };
    if (m.type === 'hoist' && x.ho && !m.H) {
      m.H = { x: x.ho[0], z: x.ho[1], top: x.ho[2], bot: x.ho[3], exit: V().set(x.ho[4], x.ho[5], x.ho[6]) };
      const c = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V().set(m.H.x, m.H.top + 0.95, m.H.z), V().set(m.H.x, m.H.bot + 0.1, m.H.z)]), new THREE.LineBasicMaterial({ color: 0x2a2a2a })); G.scene.add(c); (m.extra || (m.extra = [])).push(c);
    }
  });
  OPS2.chain('mirrorFx', function (m, dt) {
    if (m.type === 'hinge' && m.door) {
      const ud = m.door.userData, want = m.closed ? 0 : 1;
      if (m.swing !== want) { m.swing = U.clamp(m.swing + (want ? dt : -dt) * 3, 0, 1); }
      m.door.rotation.y = ud.closed + (ud.open - ud.closed) * m.swing; m.door.visible = m.swing > 0.02;
    }
  });
  OPS2.chain('guestEvent', function (e) {
    const me = G.player; if (!me || e.to !== NP.me) return;
    if (e.k === 'launch' && Array.isArray(e.v)) { me.vel.set(+e.v[0], +e.v[1], +e.v[2]); me.onGround = false; me.flyT = G.time + 1.6; me.safeFallT = G.time + 2.6; return true; }
    if (e.k === 'hang' && Array.isArray(e.h)) { const L = G.ents.find(x => x.nid === e.nid) || { alive: true }; me.hang = { line: L, x: +e.h[0], z: +e.h[1], top: +e.h[2], bot: +e.h[3], hum: 0 }; me.pos.set(me.hang.x, me.hang.top - 1.9, me.hang.z); me.vel.set(0, 0, 0); return true; }
    if (e.k === 'unhang') { me.hang = null; return true; }
    if (e.k === 'hoist' && Array.isArray(e.f)) { const h = G.ents.find(x => x.nid === e.nid) || { alive: true }; const m = V().set(...e.m); me.hoist = { h: { alive: true, H: h.H || { x: m.x, z: m.z } }, from: V().set(...e.f), to: V().set(...e.t), down: !!e.d, t: 0 }; return true; }
  });

  /* ================================================================= HUD */
  OPS2.chain('status', function (a) {
    if (a.hang && !a.hang.net) return 'ON THE DROP LINE' + KEYS.fmt(' · {forward} up · {back} down · {vault} let go');
    if (a.hoist && !a.hoist.net) return 'ON THE HOIST';
    if (a.busyLabel === 'CUTTING A DOOR' && a.busy > 0) return 'CUTTING A DOOR ' + Math.round((1 - a.busy / 4.1) * 100) + '% · hold still';
    return '';
  });
  OPS2.chain('hudCount', function (a) {
    if (!a.ability) return null;
    if (a.ability.id === 'hinge') { const n = G.ents.filter(e => e.alive && e.type === 'hinge' && e.owner === a && !e.ruined); if (n.length) return (n.some(e => e.closed) ? 'SHUT ' : 'OPEN ') + n.length + (a.ability.count ? ' +' + a.ability.count : ''); }
    return null;
  });
  OPS2.chain('markers', function (a, put, jam) {
    if (G.mode !== 'match' || jam) return;
    for (const r of OPS3.alerts) if (r.team === a.team && G.time - r.t < 3) put(r.p.clone(), 'mk-ring a0', '⚠');
    if (OPS3.alerts.length > 20) OPS3.alerts.splice(0, OPS3.alerts.length - 20);
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // Pivot: doors opened as the push goes in (and shut again once the team is through and it's quiet)
    if (ab.id === 'hinge' && G.time > (b.hingeT || 0)) {
      const mine = G.ents.filter(e => e.alive && e.type === 'hinge' && e.owner === a && !e.ruined);
      if (mine.length) {
        b.hingeT = G.time + 3;
        const shut = mine.some(e => e.closed);
        if (shut && (c.nearObj || b.entered)) { OPS3.toggleHinges(a); return true; }
      }
    }
    // Plummet: on a line, hanging over a room: lower to fighting height, and drop once it's done
    if (a.hang) { if (t) a.mf = 0; else if (a.pos.y > a.hang.bot + 1.2) a.mf = -1; else { a.mf = 0; if (G.time > (b.hangT || (b.hangT = G.time + 6))) { a.hang = null; b.hangT = 0; } } return true; }
    // Plummet: a hole in front of her near the objective: down it goes
    if (ab.id === 'dropline' && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) < 16 && G.time > (b.dropT || 0)) {
      b.dropT = G.time + 4;
      const H = OPS3.findHole(a, 1.5); if (H && H.bot < a.pos.y - 2) { GAD.ability(a); return true; }
    }
    // Bound: a plate under her feet's way when the path climbs a wall she can't
    return false;
  });
  /* is the floor clear for a metre on both sides of a wall panel (AI.roomPanels), across its middle? */
  OPS3.clearBehind = function (p) {
    const W = G.world, mid = Math.round((p.a0 + p.a1) / 2), y0 = Math.round(p.room.fy * 4);
    for (let k = 1; k <= 2; k++) for (const s of [1, -1]) for (let t = -1; t <= 1; t++) for (let y = y0 + 1; y <= y0 + 6; y++) {
      const x = p.axis === 'z' ? mid + t : p.line + s * k, z = p.axis === 'z' ? p.line + s * k : mid + t;
      if (W.get(x, y, z)) return false;
    }
    return true;
  };
  OPS2.chain('aiPlanAtk', function (a, plan, c) {
    const { b, id } = c, W = G.world;
    if (id === 'hinge') {
      // a soft wall into the site, the nearest one he can walk to: cut it from outside, wait out the cut
      let best = null, bl = 1e9;
      for (const p of plan.rooms.flatMap(rm => AI.roomPanels(rm))) {
        const clear = OPS3.clearBehind(p);   // (a door into a counter or a shelf is a worse door: still a sightline)
        const inward = V().set(p.stand.x - p.look.x, 0, p.stand.z - p.look.z).normalize();
        const out = p.look.clone().addScaledVector(inward, -0.95); out.y = p.room.fy;
        if (!NAV.walkable(out)) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 1) continue;
        let L = clear ? 0 : 40; for (let i = 1; i < pth.length; i++) L += pth[i].distanceTo(pth[i - 1]);
        if (L < bl) { bl = L; best = { p, out }; }
      }
      if (best) {
        const { p, out } = best, aim = p.look.clone().setY(p.room.fy + 1.1);
        b.tasks.unshift({ at: out, look: aim, time: 0.4, hurry: true, maxTravel: 60, run: x => { AI.faceTo(x, aim, 1, 99); x.pitch = -0.05; const h = GAD.aim(x, 2.2); if (h && hingeable(h.m)) { const P = OPS3.hingePlan(x, h, true); if (P) OPS3.startCut(x, P); } } }, { at: out, look: aim, time: 4.3 });
        return false;
      }
    }
    if (id === 'spring') {
      // a plate where the arc lands somewhere higher near the objective: onto a roof, a balcony, a ledge
      const obj = plan.objCenter; if (!obj) return false;
      const cand = [];
      const all = OPS3.navNodes(); if (all.length) for (let i = 0; i < 900 && cand.length < 70; i++) { const q = NAV.nodePos(U.pick(all)); if (U.dist2(q, obj) < 30 && !Actor.indoors(q.x, q.y + 0.5, q.z)) cand.push(q); }
      let best = null, bs = -1e9;
      for (const p of cand) {
        if (Actor.indoors(p.x, p.y + 0.5, p.z)) continue;
        for (let k = 0; k < 8; k++) {
          const yaw = k * Math.PI / 4, land = OPS3.arc(p, yaw);
          if (!land || land.y < p.y + 2.4) continue;
          const sc = -U.dist3(land, obj) + (land.y - p.y) * 2;
          if (sc > bs) { bs = sc; best = { p, yaw, land }; }
        }
      }
      if (best) {
        const { p, yaw } = best;
        // put it down, then go where it throws you (the path takes the plate's link)
        b.tasks.push({ at: p.clone().add(V().set(Math.sin(yaw) * 1.1, 0, Math.cos(yaw) * 1.1)), time: 0.4, hurry: true, maxTravel: 60, run: x => { x.yaw = yaw; x.pitch = -0.4; if (x.ability.count > 0) { new Spring(x, p.clone(), yaw); x.ability.count--; } } });
        b.tasks.push({ at: best.land.clone(), time: 0.2, hurry: true, maxTravel: 25 });
      }
      return false;
    }
    if (id === 'dropline') {
      // over the site: soft floor (or roof) right over a site room, where she cuts her own hole
      const nodes = OPS3.navNodes();
      let best = null, bl = 1e9, found = 0;
      for (const site of plan.rooms) {
        const above = site.fy + 2.6;
        for (let i = 0; i < 1600 && found < 14; i++) {
          const q = NAV.nodePos(U.pick(nodes));
          if (q.y < above || q.y > above + 1.2) continue;
          const vx = Math.floor(q.x * 4), vz = Math.floor(q.z * 4);
          if (vx < site.x0 + 2 || vx > site.x1 - 2 || vz < site.z0 + 2 || vz > site.z1 - 2) continue;
          // stand a metre back from the spot, facing it
          const dir = V().set(site.cx - q.x, 0, site.cz - q.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize();
          const st = q.clone().addScaledVector(dir, -1.0); if (!NAV.walkable(st)) continue;
          let ok = true; for (let dx = -1; dx <= 1 && ok; dx++) for (let dz = -1; dz <= 1 && ok; dz++) { const m = W.get(vx + dx, Math.round(q.y * 4) - 1, vz + dz); if (!soft(m)) ok = false; }
          if (!ok) continue;
          const pth = NAV.path(a.pos, st); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], st) > 1) continue;
          let L = 0; for (let j = 1; j < pth.length; j++) L += pth[j].distanceTo(pth[j - 1]);
          found++; if (L < bl) { bl = L; best = { st, look: q.clone().setY(q.y + 0.2) }; }
        }
      }
      if (best) {
        const { st, look } = best;
        b.tasks.unshift({ at: st, look, time: 0.4, hurry: true, maxTravel: 80, run: x => { AI.faceTo(x, look.clone().setY(x.pos.y + x.eyeH), 1, 99); x.pitch = -0.7; if (GAD.ability(x)) x.bot.entered = true; } }, { at: st, look, time: 2.7 });
        return false;
      }
      // or a hatch in its ceiling
      const hs = (G.map.hatches || []).filter(h => plan.rooms.some(rm => rm.L === h.L - 1 && h.x >= rm.x0 - 1 && h.x <= rm.x1 + 1 && h.z >= rm.z0 - 1 && h.z <= rm.z1 + 1));
      for (const h of U.shuffle(hs)) {
        const c0 = V().set((h.x + 2) / 4, h.y / 4 + 0.25, (h.z + 2) / 4);
        for (const [dx, dz] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) {
          const st = c0.clone().add(V().set(dx, 0, dz)); st.y = W.groundBelow(st.x, c0.y + 0.6, st.z);
          if (!NAV.walkable(st)) continue;
          const pth = NAV.path(a.pos, st); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], st) > 1) continue;
          b.tasks.push({ at: st, look: c0.clone().setY(c0.y - 0.3), time: 0.6, hurry: true, maxTravel: 70, run: x => {
            // break the hatch (an axe of a melee strike or two), then go down the line
            for (let X = h.x; X <= h.x + 3; X++) for (let Z = h.z; Z <= h.z + 3; Z++) if (W.get(X, h.y, Z) === M.HATCH) W.breakVoxel(X, h.y, Z);
            SFX.wood(c0, true); GAME.noise(c0, 20, x, 'breach');
            AI.faceTo(x, c0, 1, 99); x.pitch = -0.6;
            const H = OPS3.findHole(x, 1.5); if (H) { const L = new DropLine(x, H); if (OPS3.startHang(x, L)) { x.ability.count--; x.bot.entered = true; } }
          } });
          return false;
        }
      }
    }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b, ents, atEntry } = c, id = a.ability ? a.ability.id : null, W = G.world;
    if (id === 'scaffold') {
      // a scaffold 3-4 m inside the site from one of its ways in, facing it; he holds on top
      for (let i = 0; i < Math.min(ents.length, 3); i++) {
        const op = ents[i], cc = GAD.opCenter(op), rr = plan.rooms.find(x => x.L === op.L) || plan.rooms[0];
        const inw = V().set(rr.cx - cc.x, 0, rr.cz - cc.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize();
        const st = cc.clone().addScaledVector(inw, 5.2); st.y = rr.fy;
        if (!NAV.walkable(st)) continue;
        b.tasks.unshift({ at: st, look: cc, time: 0.4, run: x => {
          AI.faceTo(x, cc.clone().setY(x.pos.y + x.eyeH), 1, 99); x.pitch = -0.2;
          const P = OPS3.scaffoldPlan(x, true); if (!P || x.ability.count <= 0) return;
          OPS3.buildScaffold(x, P); x.ability.count--;
          // and he holds up there, watching that way in
          x.bot.hold = P.deck.clone(); x.bot.holdRoom = rr; x.bot.holdLook = cc.clone(); x.bot.holdSince = G.time + 600;
        } });
        return;
      }
    }
    if (id === 'hoist') {
      // a hatch in, over or under the site: a hoist through it
      const hs = (G.map.hatches || []).filter(h => plan.rooms.some(rm => Math.abs(rm.L - h.L) <= 1 && h.x >= rm.x0 - 2 && h.x <= rm.x1 + 2 && h.z >= rm.z0 - 2 && h.z <= rm.z1 + 2));
      let n = 0;
      for (const h of U.shuffle(hs)) {
        if (n >= 2) break;
        const c0 = V().set((h.x + 2) / 4, h.y / 4, (h.z + 2) / 4);
        // from below, looking up at it
        const st = c0.clone().add(V().set(1.0, 0, 0)); st.y = W.groundBelow(st.x, c0.y - 0.3, st.z);
        if (!NAV.walkable(st)) continue;
        n++;
        b.tasks.unshift({ at: st, look: c0, time: 0.6, run: x => { AI.faceTo(x, c0, 1, 99); x.pitch = 1.0; if (x.ability.count <= 0) return; const H = OPS3.hoistAt(x, true); if (H && !G.ents.some(e => e.alive && e.type === 'hoist' && Math.hypot(e.H.x - H.x, e.H.z - H.z) < 1)) { new Hoist(x, H); x.ability.count--; } } });
      }
    }
    if (id === 'gauge') {
      // gauges on the site's soft walls (where a breach is coming) and on its reinforced ones
      const pans = U.shuffle(plan.rooms.flatMap(rm => AI.roomPanels(rm))).slice(0, 3);
      const steel = U.shuffle((GAME.reinforced || []).filter(q => plan.rooms.includes(q.room) && q.stand && q.look)).slice(0, 2);
      for (const p of steel.concat(pans).slice(0, 4)) {
        b.tasks.unshift({ at: p.stand, look: p.look, time: 0.5, run: x => { AI.faceTo(x, p.look, 1, 99); x.pitch = 0; if (x.ability.count <= 0) return; const h = GAD.aim(x, 2.2); if (h && !h.md.see) { OPS3.placeGauge(x, h); x.ability.count--; } } });
      }
    }
  });
})();
