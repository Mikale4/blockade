/* ops3-c.js -- seasons 15-18, batch C: CAIRN, the people who keep a team in the fight.
     SUTLER  supply crate: four pulls, each a gadget charge back and full magazines
     CASTER  rolling mantlet: a wheeled steel plate pushed ahead (slowly), planted as cover
     HOUND   K-9 unit "PATCH": a robot dog that follows or is sent, and points at defenders it smells
     TETHER  lifeline link: damage split with a teammate; once a round he takes the blow that would drop them
     DRAG    countermeasure coil: near the objective it slows the defuser, the secure meter and the hostage
     MAGPIE  salvage kit: defuse an attacker's charge, claymore, flank cam or feint and use it herself
   Built on js/ops2.js's registry. */
(function () {
  'use strict';
  const { MAT, M, GADGETS } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent;
  const OPS3 = window.OPS3 = window.OPS3 || {};
  for (const t of ['coil']) { GAD.ELEC.add(t); GAD.TRAPS.add(t); }
  Object.assign(GAD.NAMES, { supply: 'Supply crate', mantlet: 'Rolling mantlet', k9: 'Robot dog', tetherline: 'Lifeline', coil: 'Countermeasure coil' });
  Object.assign(GAD.EXTRA, {
    supply: g => { g.box(-8, 0, -6, 8, 9, 6, 0x5a6a3a); g.box(-8, 9, -6, 8, 10, 6, 0x4a5a2a); g.box(-9, 2, -1, -9, 7, 1, 0x333333); g.box(9, 2, -1, 9, 7, 1, 0x333333); g.box(-2, 5, -7, 2, 7, -7, 0xd8c040); g.set(0, 10, 0, MD.glow(0x8ab070)); },
    coil: g => { g.box(-4, 0, -4, 4, 2, 4, 0x2a2c30); for (const y of [3, 5, 7]) g.box(-3, y, -3, 3, y, 3, 0xb87333); g.box(-1, 3, -1, 1, 9, 1, 0x555555); g.set(0, 10, 0, MD.glow(0xe0a050)); },
    k9: g => {
      g.box(-3, 6, -8, 3, 10, 6, 0x4a4e44);           // body
      g.box(-2, 9, -13, 2, 13, -8, 0x3a3e34);         // head
      g.box(-1, 10, -15, 1, 11, -14, 0x222222);       // snout
      g.set(-1, 12, -14, MD.glow(0xffb040)).set(1, 12, -14, MD.glow(0xffb040));
      g.box(-2, 14, -10, -2, 15, -10, 0x3a3e34); g.box(2, 14, -10, 2, 15, -10, 0x3a3e34);   // ears
      for (const [x, z] of [[-3, -6], [3, -6], [-3, 4], [3, 4]]) g.box(x - 1, 0, z - 1, x, 6, z, 0x2a2c26);
      g.box(-1, 9, 6, 1, 10, 9, 0x4a4e44);            // tail
      g.box(-1, 10, -2, 1, 11, 2, 0x8ab070);           // the unit stripe
    },
  });
  GAD.MESH_FN.mantlet = () => OPS3.mantletMesh();
  GAD.MESH_FN.tetherline = () => new THREE.Group();

  /* ================================================================ SUTLER */
  /* the crate: four pulls (2 s each, his team): a charge back on whatever gadget you carry and
     every magazine full. It beeps every 2 s; explosives wreck it */
  class Supply extends Ent {
    constructor(a, p, yaw) { super('supply', a, p, { model: 'supply', upright: true, yaw, hp: 999, bulletproof: true, hitR: 0.4 }); this.pulls = 4; this.beep = 0; this.blastproof = false; this.used = new Map(); }
    update(dt) { this.t += dt; if ((this.beep -= dt) <= 0) { this.beep = 2; SFX.beep(this.pos, 900, 0.1); GAME.noise(this.pos, 9, this.owner, 'gadget'); } }
  }
  OPS3.resupply = function (a, s) {
    if (!s.alive || s.pulls <= 0) return false;
    let did = [];
    const g = a.gadget; if (g && GADGETS[g.id] && g.count < GADGETS[g.id].count) { g.count++; did.push(GADGETS[g.id].name.toLowerCase()); }
    for (const w of a.w || []) { const full = (w.def.mag || 0) * (w.def.mags || 0); if (w.reserve < full) { w.reserve = full; did.push('ammo'); } }
    if (!did.length) { GAD.tell(a, 'Nothing to take: you are full'); return false; }
    s.pulls--; SFX.reload(s.pos, a.isPlayer, 1);
    GAD.tell(a, 'Resupplied: ' + [...new Set(did)].join(', ') + ' · ' + s.pulls + ' left in the crate');
    if (s.pulls <= 0) s.destroy('used');
    return true;
  };
  OPS2.ABIL.supply = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 1.1); if (!p) { GAD.tell(a, 'Clear floor in front of you'); return false; }
    new Supply(a, p, a.yaw); GAD.tell(a, 'Crate down: your team opens it with interact'); return spend();
  };

  /* ================================================================ CASTER */
  /* the mantlet: 0.9 x 1.3 m of steel on wheels. Pushing it he walks at 60%, and it rolls ahead of
     him; it won't go up stairs or over a step (he stops). Planted, it is cover anyone can stand behind
     and anyone of his team can push again. Explosives under it knock it over (destroy it) */
  OPS3.mantletMesh = function () {
    const g = new THREE.Group(), steel = new THREE.MeshBasicMaterial({ color: 0x4a5258 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), steel); plate.position.set(0, 0.8, 0); g.add(plate);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.07), new THREE.MeshBasicMaterial({ color: 0x0e1012 })); slot.position.set(0, 1.25, 0); g.add(slot);
    for (const x of [-0.38, 0.38]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); w.position.set(x, 0.08, 0.05); g.add(w); }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.07), new THREE.MeshBasicMaterial({ color: 0x8ab070 })); stripe.position.set(0, 0.5, 0); g.add(stripe);
    return g;
  };
  class Mantlet extends Ent {
    constructor(a) {
      const f = a.fwd(V()); f.y = 0; f.normalize();
      super('mantlet', a, a.pos.clone().addScaledVector(f, 0.75), { model: 'mantlet', upright: true, yaw: a.yaw, hp: 999, bulletproof: true, hitR: 0 });
      this.yaw = a.yaw; this.pusher = a; this.blastproof = false; this.meleeable = false;
      this.passOwner = true;   // (he fires through its slot; nobody else can)
      this.setBoxes();
    }
    setBoxes() {
      // a thin plate across the facing: bullets stop on it, bodies can't walk through it
      const f = V().set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = V().set(-f.z, 0, f.x), p = this.pos;
      const xs = [p.x + r.x * 0.45 + f.x * 0.05, p.x - r.x * 0.45 - f.x * 0.05], zs = [p.z + r.z * 0.45 + f.z * 0.05, p.z - r.z * 0.45 - f.z * 0.05];
      const box = { x0: Math.min(...xs) - 0.04, x1: Math.max(...xs) + 0.04, y0: p.y, y1: p.y + 1.45, z0: Math.min(...zs) - 0.04, z1: Math.max(...zs) + 0.04 };
      this.hitBox = box; this.solid = this.pusher ? null : box;   // (the man pushing it isn't blocked by his own plate)
      if (this.mesh) { this.mesh.position.copy(p); this.mesh.rotation.y = this.yaw; }
    }
    update(dt) {
      this.t += dt;
      const a = this.pusher;
      if (a) {
        if (a.state !== 'alive' || a.mantlet !== this) { this.plant(); return; }
        const f = a.fwd(V()); f.y = 0; f.normalize();
        const want = a.pos.clone().addScaledVector(f, 0.75), W = G.world;
        // it rolls on level floor only: a step or a stair stops it, and him with it
        const gy = W.groundBelow(want.x, a.pos.y + 0.3, want.z);
        const clear = !W.boxHits(want.x - 0.3, gy + 0.05, want.z - 0.3, want.x + 0.3, gy + 1.4, want.z + 0.3);
        if (Math.abs(gy - a.pos.y) < 0.13 && clear) { this.pos.set(want.x, gy, want.z); this.yaw = a.yaw; this.blocked = false; }
        else { this.blocked = true; a.pos.x -= a.vel.x * dt; a.pos.z -= a.vel.z * dt; a.vel.x *= 0.2; a.vel.z *= 0.2; }
        if (a.moving > 0.4 && (this.rumble = (this.rumble || 0) - dt) <= 0) { this.rumble = 0.45; GAME.noise(this.pos, 11, a, 'step'); }
      }
      this.setBoxes();
    }
    plant() { if (this.pusher) { this.pusher.mantlet = null; if (this.pusher.net && window.NP) NP.push({ k: 'mantlet', to: this.pusher.net, on: 0 }); } this.pusher = null; this.setBoxes(); SFX.metal(this.pos); }
    grab(a) { if (this.pusher || a.mantlet) return false; this.pusher = a; a.mantlet = this; if (a.net && window.NP) NP.push({ k: 'mantlet', to: a.net, on: 1 }); SFX.metal(this.pos); return true; }
    destroy(w) { if (this.pusher) { this.pusher.mantlet = null; if (this.pusher.net && window.NP) NP.push({ k: 'mantlet', to: this.pusher.net, on: 0 }); } super.destroy(w); }
  }
  OPS2.ABIL.mantlet = (a, ab, need, spend) => {
    if (a.mantlet) { a.mantlet.plant(); GAD.tell(a, 'Mantlet planted'); return true; }
    const mine = G.ents.find(e => e.alive && e.type === 'mantlet' && e.owner === a);
    if (mine) { if (U.dist2(mine.pos, a.pos) < 1.6) { mine.grab(a); return true; } GAD.tell(a, 'Your mantlet is over there: go to it'); return false; }
    if (!need()) return false;
    const m = new Mantlet(a); a.mantlet = m; if (a.net && window.NP) NP.push({ k: 'mantlet', to: a.net, on: 1 });
    GAD.tell(a, 'Pushing the mantlet: press again to plant it'); return spend();
  };

  /* ================================================================= HOUND */
  /* Patch: follows Hound a couple of metres back, or goes where she points (the ability) and waits
     there; pressed again, he comes back. Within 6 m of a defender (through walls: he smells them)
     he stops, points and barks: her team sees the bearing, not the spot. 30 HP */
  class K9 extends Ent {
    constructor(a) {
      const f = a.fwd(V()); f.y = 0; f.normalize();
      super('k9', a, a.pos.clone().addScaledVector(f, -1.2), { model: 'k9', upright: true, yaw: a.yaw, hp: 30, hitR: 0.35 });
      this.yaw = a.yaw; this.mode = 'follow'; this.path = null; this.pi = 0; this.repath = 0; this.sniff = 0; this.bark = 0; this.blastproof = false;
      this.hitBox = null;
    }
    update(dt) {
      this.t += dt; const a = this.owner;
      if (!a || a.state === 'dead') { this.mode = 'stay'; }
      const goal = this.mode === 'follow' && a ? a.pos : this.mode === 'go' ? this.goal : null;
      if (goal && U.dist2(this.pos, goal) > (this.mode === 'follow' ? 1.8 : 0.5)) {
        if ((this.repath -= dt) <= 0 || !this.path) { this.repath = this.mode === 'follow' ? 0.8 : 2; this.path = NAV.path(this.pos, goal, { partial: true }); this.pi = 0; }
        const n = this.path && this.path[this.pi];
        if (n) {
          const dx = n.x - this.pos.x, dz = n.z - this.pos.z, d = Math.hypot(dx, dz), sp = this.pointing > 0 ? 0 : 3.6;
          if (d < 0.25) this.pi++;
          else { const k = Math.min(1, sp * dt / d); this.pos.x += dx * k; this.pos.z += dz * k; this.yaw = Math.atan2(-dx, -dz); }
          this.pos.y = U.smooth(this.pos.y, n.y, 10, dt);
          if ((this.step = (this.step || 0) - dt) <= 0 && sp > 0) { this.step = 0.3; GAME.noise(this.pos, 3, a, 'step'); }
        }
      }
      // the nose: the nearest defender within 6 m, walls or not
      this.pointing = Math.max(0, (this.pointing || 0) - dt);
      if ((this.sniff -= dt) <= 0) {
        this.sniff = 0.5;
        let best = null, bd = 6;
        for (const t of G.actors) if (t.state === 'alive' && t.team !== this.team && !t.hostage && !(t.nullT > G.time)) { const d = U.dist3(t.pos, this.pos); if (d < bd) { bd = d; best = t; } }
        if (best) {
          this.pointing = 1.2;
          const dir = best.pos.clone().sub(this.pos); dir.y = 0; dir.normalize();
          this.yaw = Math.atan2(-dir.x, -dir.z);
          if ((this.bark -= 0.5) <= 0) {
            this.bark = 1.5; SFX.beep(this.pos, 520, 0.18); SFX.beep(this.pos, 640, 0.12); GAME.noise(this.pos, 15, a, 'gadget');
            OPS3.bearings.push({ from: this.pos.clone().setY(this.pos.y + 0.6), dir: dir.clone(), t: G.time, team: this.team });
            if (OPS3.bearings.length > 20) OPS3.bearings.splice(0, OPS3.bearings.length - 20);
            // her team's bots get a rough idea: that way, a few metres
            const guess = this.pos.clone().addScaledVector(dir, Math.min(bd, 4)); GAME.intel({ pos: guess }, this.team, 25);
            if (window.VOICE && a && a.state === 'alive' && Math.random() < 0.4) VOICE.say(a, 'intel');
          }
        }
      }
      if (this.mesh) { this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw; this.mesh.position.y += Math.abs(Math.sin(this.t * 9)) * 0.02 * (this.pointing > 0 ? 0 : 1); }
    }
  }
  OPS3.bearings = [];
  OPS3.sendDog = function (a, p) { const d = G.ents.find(e => e.alive && e.type === 'k9' && e.owner === a); if (!d) return false; d.mode = 'go'; d.goal = p.clone(); d.path = null; return true; };
  OPS2.ABIL.k9 = (a, ab, need, spend) => {
    let d = G.ents.find(e => e.alive && e.type === 'k9' && e.owner === a);
    if (!d) { if (!need()) return false; d = new K9(a); spend(); GAD.tell(a, 'Patch is with you: press again to send him where you look'); return true; }
    if (d.mode === 'go') { d.mode = 'follow'; d.path = null; GAD.tell(a, 'Patch: heel'); return true; }
    const h = G.world.raycast(a.eye(V()), a.fwd(V()), 30);
    const p = h ? V().set(h.px - h.nx * -0.3, h.py, h.pz - h.nz * -0.3) : a.eye(V()).addScaledVector(a.fwd(V()), 20);
    p.y = G.world.groundBelow(p.x, p.y + 0.3, p.z);
    d.mode = 'go'; d.goal = p; d.path = null; GAD.tell(a, 'Patch: go!'); SFX.ui && SFX.ui(1100);
    return true;
  };

  /* ================================================================ TETHER */
  /* the link: from him to a teammate within 10 m he is looking toward. While they are within 15 m of
     each other, any hit either takes is split between them (headshots and falls aren't); once a round,
     a blow that would put the partner down is all his instead. Over 15 m apart it breaks; he can link
     again after 10 s */
  class TetherLine extends Ent {
    constructor(a, b) {
      super('tetherline', a, a.pos, { model: false, hp: 999, hitR: 0, melee: false });
      this.model = 'tetherline'; this.a = a; this.b = b; this.saved = false; this.blastproof = true; this.meleeable = false;
      this.line = OPS3.tetherMesh(); G.scene.add(this.line);
      a.tether = this; b.tether = this;
    }
    update(dt) {
      this.t += dt; const a = this.a, b = this.b;
      if (a.state === 'dead' || b.state === 'dead' || U.dist3(a.pos, b.pos) > 15) { this.destroy('used'); return; }
      this.pos.copy(a.pos);
      OPS3.tetherLook(this.line, a.center(V()), b.center(V()), this.team);
    }
    destroy(w) {
      if (!this.alive) return;
      super.destroy(w);
      if (this.line) { G.scene.remove(this.line); this.line = null; }
      if (this.a.tether === this) this.a.tether = null; if (this.b.tether === this) this.b.tether = null;
      if (this.a.state === 'alive') { this.a.tetherCd = G.time + 10; GAD.tell(this.a, 'Lifeline broken'); }
    }
  }
  OPS3.tetherMesh = () => new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineBasicMaterial({ color: 0x8ab070, transparent: true, opacity: 0.5 }));
  OPS3.tetherLook = function (line, p, q, team) {
    const P = line.geometry.attributes.position; P.setXYZ(0, p.x, p.y, p.z); P.setXYZ(1, q.x, q.y, q.z); P.needsUpdate = true; line.geometry.computeBoundingSphere();
    line.visible = !G.player || GAME.spectator || G.player.team === team;   // (his team sees the link)
  };
  OPS3.linkTether = function (a, b) {
    if (!b || b === a || b.team !== a.team || b.state !== 'alive' || b.hostage) return null;
    if (a.tether) a.tether.destroy('silent');
    if (b.tether) b.tether.destroy('silent');
    const L = new TetherLine(a, b); SFX.zap(a.pos); GAD.tell(a, 'Linked to ' + b.op.name); GAD.tell(b, a.op.name + ' is sharing your hits');
    return L;
  };
  OPS2.ABIL.lifeline = (a, ab, need, spend) => {
    if (G.time < (a.tetherCd || 0)) { GAD.tell(a, 'Lifeline recharging: ' + Math.ceil(a.tetherCd - G.time) + ' s'); return false; }
    const e = a.eye(V()), f = a.fwd(V());
    let best = null, bs = -1;
    for (const b of G.actors) {
      if (b === a || b.team !== a.team || b.state !== 'alive' || b.hostage) continue;
      const to = b.center(V()).sub(e), d = to.length(); if (d > 10) continue;
      const s = to.normalize().dot(f) - d * 0.02; if (s > bs) { bs = s; best = b; }
    }
    if (!best) { GAD.tell(a, 'No teammate within 10 m'); return false; }
    return !!OPS3.linkTether(a, best);
  };
  const oHurt = Actor.prototype.hurt;
  Actor.prototype.hurt = function (dmg, info) {
    const L = this.tether;
    if (OPS3._split || !L || !L.alive || this.state !== 'alive' || (info && (info.head || info.kind === 'fall'))) return oHurt.apply(this, arguments);
    const other = L.a === this ? L.b : L.a, teth = L.a;
    if (other.state !== 'alive' || U.dist3(this.pos, other.pos) > 15) return oHurt.apply(this, arguments);
    OPS3._split = true;
    try {
      // once a round: the partner would go down: he takes it, all of it
      if (this !== teth && !L.saved && this.hp - dmg <= 0) { L.saved = true; GAD.tell(teth, 'LIFELINE: you took the hit for ' + this.op.name, 'warn'); return oHurt.call(teth, dmg, info); }
      const half = Math.ceil(dmg / 2);
      oHurt.call(other, dmg - half, info);
      return oHurt.call(this, half, info);
    } finally { OPS3._split = false; }
  };

  /* ================================================================== DRAG */
  /* a coil near the objective (within 8 m of where it is placed): the defuser counts down, the secure
     meter fills and the hostage moves 35% slower. It hums; 2 HP; an EMP shuts it off */
  class Coil extends Ent {
    constructor(a, p) { super('coil', a, p, { model: 'coil', upright: true, hp: 2, hitR: 0.18 }); this.hum = 0; this.blastproof = false; }
    get on() { return this.alive && !(this.empT > G.time); }
    update(dt) { this.t += dt; if (this.on && (this.hum -= dt) <= 0) { this.hum = 1.2; GAME.noise(this.pos, 7, this.owner, 'gadget'); SFX.zap(this.pos); } }
  }
  OPS3.coilNear = (p, team) => G.ents.some(e => e.alive && e.type === 'coil' && e.on && e.team === team && U.dist3(e.pos, p) < 8);
  OPS2.ABIL.coil = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 0.9); if (!p) { GAD.tell(a, 'Clear floor in front of you'); return false; }
    new Coil(a, p); return spend();
  };
  const defTeam = () => [0, 1].find(t => GAME.sideOf(t) === 'def');
  OPS2.objRate = function (kind) {
    if (kind === 'secure') { const rm = GAME.siteRooms && GAME.siteRooms[0]; if (!rm) return 1; const c = V().set(rm.cx, rm.fy + 0.5, rm.cz); return G.ents.some(e => e.alive && e.type === 'coil' && e.on && e.team === defTeam() && (U.dist3(e.pos, c) < 8 || G.map.roomAt(e.pos.clone().setY(e.pos.y + 0.3)) === rm)) ? 0.65 : 1; }
    return 1;
  };
  OPS2.chain('entTick', function (e, dt) {
    // the defuser: 35% slower beside a coil (it counts down in its own update; this gives some back)
    if (e.type === 'defuser' && e.alive && OPS3.coilNear(e.pos, 1 - e.team)) e.left += dt * 0.35;
  });

  /* ================================================================ MAGPIE */
  /* she defuses an attacker's breach charge, claymore, flank cam or feint charge (interact, 2 s) and
     pockets it (two at most); the ability puts the last one down as hers: a breach charge goes off 3 s
     after she sticks it (a rotation hole), a claymore and a flank cam work for her side, a feint fools
     the attackers */
  const SALVAGE = ['breach', 'claymore', 'flankcam', 'feint'];
  OPS3.salvage = function (a, e) {
    if (!e.alive) return false;
    a.salvage = a.salvage || [];
    if (a.salvage.length >= 2) { GAD.tell(a, 'Your pockets are full'); return false; }
    a.salvage.push(e.type); e.destroy('silent'); SFX.metal(a.pos);
    GAD.tell(a, 'Salvaged a ' + (GAD.NAMES[e.type] || e.type).toLowerCase() + ': the ability puts it down as yours');
    if (window.VOICE) VOICE.say(a, 'intel');
    return true;
  };
  const withGadget = (a, id, fn) => { const g0 = a.gadget; a.gadget = { id, count: 1 }; try { return fn(); } finally { a.gadget = g0; } };
  OPS2.ABIL.salvage = (a, ab, need, spend) => {
    const S = a.salvage || [];
    if (!S.length) { GAD.tell(a, 'Nothing salvaged: walk up to an attacker\'s charge, claymore or flank cam and interact'); return false; }
    const type = S[S.length - 1];
    let ok = false;
    if (type === 'claymore') ok = !!GAD.deployAt(a, 'claymore', GAD.floorAhead(a, 0.9) || a.pos.clone(), null, a.yaw);
    else if (type === 'feint') { const h = GAD.aim(a, 1.8); if (h && !h.md.see) { new OPS3.Feint(a, h); ok = true; } else GAD.tell(a, 'Stick it to a wall'); }
    else if (type === 'breach') {
      const n0 = (a.placed || []).length;
      ok = withGadget(a, 'breach', () => GAD.secondary(a));
      const b = (a.placed || [])[n0];
      if (ok && b) { const t = new Ent('magtimer', a, b.pos, { model: false, hp: 999, hitR: 0, melee: false }); t.blastproof = true; t.update = function (dt) { this.t += dt; if (this.t > 3) { this.destroy('used'); if (b.alive) b.detonate(); } }; }
    } else if (type === 'flankcam') ok = withGadget(a, 'flankcam', () => GAD.secondary(a));
    if (ok) { S.pop(); a.busy = 0.5; }
    return ok;
  };

  /* ============================================================ hooks */
  OPS2.chain('physics', function (a, dt) {
    // speed: pushing a mantlet (60%); carrying the hostage past a coil (65%)
    let k = 1;
    if (a.mantlet) k *= 0.6;
    if (a.mic) k *= 0.5;                                   // (Earshot listening: half speed)
    if (a.carry && a.carry.hostage && G.ents.some(e => e.alive && e.type === 'coil' && e.on && e.team !== a.team && U.dist3(e.pos, a.pos) < 8)) k *= 0.65;
    a.speedMul = k === 1 ? 0 : k;
    return false;
  });
  OPS2.chain('interactions', function (a, out) {
    for (const e of G.ents) {
      if (!e.alive) continue;
      if (e.type === 'supply' && e.team === a.team && U.dist3(e.pos, a.pos) < 1.6 && (e.pulls == null || e.pulls > 0)) { out.push({ kind: 'supply', label: 'RESUPPLY (' + (e.pulls == null ? '' : e.pulls) + ' left)', time: 2, ok: () => e.alive, run: () => OPS3.resupply(a, e) }); return; }
      if (e.type === 'mantlet' && e.team === a.team && !e.pusher && !a.mantlet && U.dist2(e.pos, a.pos) < 1.4) { out.push({ kind: 'mantlet', label: 'PUSH THE MANTLET', time: 0.3, ok: () => e.alive, run: () => e.grab && e.grab(a) }); return; }
      if (SALVAGE.includes(e.type) && a.ability && a.ability.id === 'salvage' && e.team !== a.team && e.team >= 0 && U.dist3(e.pos, a.pos) < 1.7) { out.push({ kind: 'salvage', label: 'SALVAGE IT', time: 2, ok: () => e.alive, run: () => OPS3.salvage(a, e) }); return; }
    }
  });

  /* ============================================================== guests */
  OPS2.chain('guestEvent', function (e) {
    const me = G.player; if (!me || e.to !== NP.me) return;
    if (e.k === 'mantlet') { me.mantlet = e.on ? { net: true } : null; return true; }
  });
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'tetherline' && e.a && e.b) x.tl = [e.a.id, e.b.id];
    if (e.type === 'supply') x.pu = e.pulls;
    if (e.type === 'mantlet') x.my = Math.round(e.yaw * 100) / 100;
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if (m.type === 'tetherline' && x.tl && !m.line) { m.ta = NP.byId.get(x.tl[0]); m.tb = NP.byId.get(x.tl[1]); m.line = OPS3.tetherMesh(); G.scene.add(m.line); (m.extra || (m.extra = [])).push(m.line); }
    if (m.type === 'supply' && x.pu != null) m.pulls = x.pu;
  });
  OPS2.chain('mirrorFx', function (m, dt) {
    if (m.type === 'tetherline' && m.line && m.ta && m.tb) OPS3.tetherLook(m.line, m.ta.center(V()), m.tb.center(V()), m.team);
  });

  /* ================================================================= HUD */
  OPS2.chain('status', function (a) {
    if (a.mantlet) return 'PUSHING THE MANTLET · ' + KEYS.fmt('{ability} to plant it');
    if (a.tether && a.tether.alive) { const o = a.tether.a === a ? a.tether.b : a.tether.a; return 'LIFELINE · ' + o.op.name + ' · ' + U.dist3(a.pos, o.pos).toFixed(0) + ' m of 15'; }
    if (a.salvage && a.salvage.length) return 'SALVAGED: ' + a.salvage.map(t => t.toUpperCase()).join(', ');
    return '';
  });
  OPS2.chain('hudCount', function (a) {
    if (!a.ability) return null;
    if (a.ability.id === 'k9') { const d = G.ents.find(e => e.alive && e.type === 'k9' && e.owner === a); return d ? (d.mode === 'go' ? 'SENT' : 'HEEL') : a.ability.count > 0 ? 'READY' : 'LOST'; }
    if (a.ability.id === 'salvage') return (a.salvage || []).length ? (a.salvage || []).length + ' HELD' : 'EMPTY';
    if (a.ability.id === 'lifeline') return a.tether && a.tether.alive ? 'LINKED' : G.time < (a.tetherCd || 0) ? Math.ceil(a.tetherCd - G.time) + 's' : 'READY';
    if (a.ability.id === 'mantlet') return a.mantlet ? 'PUSHING' : G.ents.some(e => e.alive && e.type === 'mantlet' && e.owner === a) ? 'PLANTED' : a.ability.count > 0 ? 'READY' : 'LOST';
    return null;
  });
  OPS2.chain('markers', function (a, put, jam) {
    if (G.mode !== 'match' || jam) return;
    // Patch's points: an arrow a metre and a half out from him, the way he is pointing
    for (const b of OPS3.bearings) if (b.team === a.team && G.time - b.t < 2) put(b.from.clone().addScaledVector(b.dir, 1.5), 'mk-ring a0', '➤');
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // anyone short of ammo or kit, with their team's crate close by: a pull
    if (!t && G.time > (b.supT || 0)) {
      const s = G.ents.find(e => e.alive && e.type === 'supply' && e.team === a.team && e.pulls > 0 && U.dist3(e.pos, a.pos) < 12);
      const g = a.gadget, low = (g && GADGETS[g.id] && g.count < GADGETS[g.id].count) || (a.w && a.w.some(w => w.reserve < (w.def.mag || 0) * (w.def.mags || 0) * 0.5));
      if (s && low) { b.supT = G.time + 15; b.tasks.unshift({ at: s.pos.clone().add(V().set(0.8, 0, 0)), r: 0.9, time: 2.0, run: x => OPS3.resupply(x, s) }); return true; }
    }
    if (!ab) return false;
    // Sutler: the crate down on the way in, near the objective
    if (ab.id === 'supply' && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) < 26 && G.time > (b.supplyT || 0)) { b.supplyT = G.time + 6; if (GAD.ability(a)) return true; }
    // Caster: push the plate toward the objective, plant it when the fight starts or once there
    if (ab.id === 'mantlet') {
      if (!a.mantlet && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) > 12 && U.dist3(a.pos, c.obj) < 40) { GAD.ability(a); return true; }
      if (a.mantlet && (t || (c.obj && U.dist3(a.pos, c.obj) < 8) || a.mantlet.blocked)) { GAD.ability(a); return true; }
    }
    // Hound: the dog first, then sent ahead toward the objective, and called back once there
    if (ab.id === 'k9') {
      const d = G.ents.find(e => e.alive && e.type === 'k9' && e.owner === a);
      if (!d && ab.count > 0) { GAD.ability(a); return true; }
      if (d && d.mode === 'follow' && !t && c.obj && U.dist3(a.pos, c.obj) < 30 && G.time > (b.dogT || 0)) { b.dogT = G.time + 12; OPS3.sendDog(a, c.obj); return true; }
      if (d && d.mode === 'go' && G.time > (b.dogT || 0)) { b.dogT = G.time + 10; d.mode = 'follow'; d.path = null; }
    }
    // Tether: a link to whoever is closest, whenever there is none
    if (ab.id === 'lifeline' && !(a.tether && a.tether.alive) && G.time > (a.tetherCd || 0) && G.time > (b.tethT || 0)) {
      b.tethT = G.time + 5; const m = G.actors.filter(x => x !== a && x.team === a.team && x.state === 'alive' && !x.hostage && U.dist3(x.pos, a.pos) < 10).sort((p, q) => U.dist3(p.pos, a.pos) - U.dist3(q.pos, a.pos))[0];
      if (m) { OPS3.linkTether(a, m); return true; }
    }
    // Magpie: an attacker charge or claymore near and nobody shooting: she takes it
    if (ab.id === 'salvage' && !t && (a.salvage || []).length < 2 && G.time > (b.salT || 0)) {
      const e = G.ents.find(x => x.alive && SALVAGE.includes(x.type) && x.team !== a.team && x.team >= 0 && U.dist3(x.pos, a.pos) < 12);
      if (e) { b.salT = G.time + 8; b.tasks.unshift({ at: e.pos.clone().setY(G.world.groundBelow(e.pos.x, e.pos.y + 0.2, e.pos.z)), r: 1.2, time: 2.0, run: x => { if (e.alive && U.dist3(x.pos, e.pos) < 2.2) OPS3.salvage(x, e); } }); return true; }
      // and puts a salvaged claymore at the site's way in
      if ((a.salvage || []).includes('claymore') && c.obj && U.dist3(a.pos, c.obj) < 10) { a.salvage.splice(a.salvage.indexOf('claymore'), 1); a.salvage.push('claymore'); GAD.ability(a); return true; }
    }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b } = c, id = a.ability ? a.ability.id : null;
    if (id === 'coil') {
      // two coils in the site, apart
      for (let i = 0; i < 2; i++) { const q = NAV.randomIn(plan.rooms[i % plan.rooms.length]); if (q) b.tasks.unshift({ at: q, time: 0.5, run: x => { if (x.ability.count <= 0) return; new Coil(x, x.pos.clone().add(V().set(0.4, 0.01, 0))); x.ability.count--; } }); }
    }
    if (id === 'lifeline') b.tasks.push({ time: 0.3, run: x => { const m = G.actors.filter(y => y !== x && y.team === x.team && y.state === 'alive' && !y.hostage).sort((p, q) => U.dist3(p.pos, x.pos) - U.dist3(q.pos, x.pos))[0]; if (m && U.dist3(m.pos, x.pos) < 10) OPS3.linkTether(x, m); } });
  });

  /* ============================================================= voices */
  if (window.VOICE) {
    VOICE.add('sutler', {
      pick: ['Gansukh. Nobody on my team runs dry.', 'Need something? I have it.'],
      round: ['Crate goes down near the wall. Come and get it.', 'Take what you need. Not more.', 'Ready when you are.'],
      ability: ['Crate is down! Fill up!', 'Supplies here!', 'Crate open for business.'],
      kill: ['Bought and paid for.', 'Down.', 'Account closed.'],
      spot: ['Contact!', 'There, one!'],
      reload: ['Reloading. I have plenty.', 'Changing mags.'], hurt: ['Hit. Keep going.', 'I am hit!'], down: ['I\'m down! The crate, use the crate!', 'Down!'],
      lost: ['We lost one.', 'Man down.'], win: ['Good. Restock.', 'Well supplied, well done.'], lose: ['We ran out of time.', 'Next round.'],
    });
    VOICE.add('caster', {
      pick: ['Brandstätter. Get behind me.', 'One plate, five people. Stay close.'],
      round: ['Stack behind the mantlet!', 'Slow and steady. Behind me.', 'Pushing up.'],
      ability: ['Mantlet up, stay behind it!', 'Rolling!', 'Planting it here.'],
      kill: ['Shouldn\'t have shot the plate.', 'Got him.', 'Down.'],
      spot: ['Contact front!', 'One ahead!'],
      reload: ['Reloading behind the plate!', 'Mag!'], hurt: ['Hit! Plate holds!', 'I\'m hit!'], down: ['Down! Use the plate!', 'I\'m down!'],
      lost: ['Man down, stay covered!', 'We lost one.'], win: ['Like a tunnel rescue. Slow and safe.', 'Everyone home.'], lose: ['They flanked us.', 'Too slow.'],
    });
    VOICE.add('hound', {
      pick: ['Kerrigan. And this is Patch. He doesn\'t bite. Much.', 'Good boy, Patch. Let\'s find them.'],
      round: ['Patch, with me.', 'Let him sniff it out first, yeah?', 'Righto, let\'s go.'],
      ability: ['Patch, go on! Find \'em!', 'Go get \'em, mate!', 'Here, boy.'],
      intel: ['He\'s pointing! That way!', 'Patch has one! Over there!', 'Good boy! They\'re that way!'],
      kill: ['Fetch.', 'Bad dog.', 'Got him.'],
      spot: ['Contact!', 'One there!'],
      reload: ['Reloading!', 'Mag!'], hurt: ['Strewth, I\'m hit!', 'Hit!'], down: ['I\'m down! Patch, stay!', 'Down!'],
      lost: ['We lost one, keep moving.', 'Man down!'], win: ['Who\'s a good boy?', 'Treats all round.'], lose: ['Patch is gonna be gutted.', 'Bugger.'],
    });
    VOICE.add('tether', {
      pick: ['Asante. If you bleed, I bleed with you.', 'Stay close. I have you.'],
      round: ['Linked up. Stay within fifteen metres.', 'Breathe. I have you.', 'Together, then.'],
      ability: ['Linked. I\'ve got you.', 'You\'re not alone.', 'Line\'s on.'],
      kill: ['That one hurt us both.', 'Down.', 'Done.'],
      spot: ['Contact.', 'There.'],
      reload: ['Reloading.', 'Changing.'], hurt: ['We\'re hit. Stay calm.', 'Hit. Still here.'], down: ['I\'m down. Get to me.', 'Down.'],
      lost: ['We lost one. Stay close.', 'Man down.'], win: ['Everyone breathing? Good.', 'We held.'], lose: ['I couldn\'t hold them.', 'Next time.'],
    });
    VOICE.add('drag', {
      pick: ['Novotná. Your defuser takes its time with me.', 'Patience. Theirs, not mine.'],
      round: ['Coils are humming.', 'Make them wait.', 'Ready.'],
      ability: ['Coil down.', 'That will slow them.', 'Humming.'],
      kill: ['Time\'s up.', 'Too slow.', 'Done.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Hit!', 'I\'m hit.'], down: ['I\'m down!', 'Down. Hurry.'],
      lost: ['We lost one.', 'Man down.'], win: ['Out of time. Theirs.', 'Good.'], lose: ['Not slow enough.', 'They got through.'],
    });
    VOICE.add('magpie', {
      pick: ['Tran. Thank you for the gifts.', 'Leave your toys lying around. Please.'],
      round: ['Let\'s see what they bring me.', 'Shopping time.', 'Eyes open, hands ready.'],
      ability: ['Returning this to its owner.', 'Your charge, my charge.', 'Mine now.'],
      intel: ['Got one of their charges!', 'Salvaged. Thank you!', 'That\'s mine now.'],
      kill: ['Finders keepers.', 'Thanks for the claymore.', 'Down.'],
      spot: ['Contact!', 'One there!'],
      reload: ['Reloading.', 'Mag!'], hurt: ['Hit!', 'Ow! Hit.'], down: ['I\'m down!', 'Down!'],
      lost: ['We lost one.', 'Man down.'], win: ['Good haul.', 'Nice and tidy.'], lose: ['They kept their toys.', 'Hm.'],
    });
  }
})();
