/* ops2.js -- seasons 10-14: the second-generation operators (design: tools/NEW-OPERATORS.md).

   Their abilities and devices, the new secondary gadgets, the new weapons' effects, what moves
   bodies in new ways (slick floors, lines, ladders), how bots use all of it, and what guests need
   to see. It plugs into registries the rest of the game asks:
     GAD.ability / GAD.secondary / GAD.deployAt  ->  ABIL / GADG / DEPLOY
     AI.useKit / planDefKit / planAttackKit       ->  aiUse / aiPlanDef(+Gadget) / aiPlanAtk
     Actor.physics                                ->  physics / onSlick / wetAt (and NAV: navCost)
     WPN.fire                                     ->  bolt / shotEffects
     np.js (entities to guests)                   ->  entRec / mirrorSet / mirrorFx
     hud.js                                       ->  status / hudCount / hudFrame              */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const OPS2 = window.OPS2 = { ABIL: {}, GADG: {}, DEPLOY: {} };
  const Ent = GAD.Ent, Proj = GAD.Proj;
  // electronics (EMP, surges and scanners act on them) and defender traps (the scanner shows them)
  for (const t of ['flankcam', 'degauss', 'sprinkler']) GAD.ELEC.add(t);
  for (const t of ['caltrops', 'sprinkler']) GAD.TRAPS.add(t);
  Object.assign(GAD.NAMES, { flankcam: 'Flank cam', caltrops: 'Caltrops', degauss: 'Degausser', sprinkler: 'Sprinkler head', slick: 'Slick', bolt: 'Crossbow bolt' });
  const live = t => G.ents.filter(e => e.alive && e.type === t);

  /* ---------------------------------------------------------------- meshes */
  Object.assign(GAD.EXTRA, {
    bolt: g => { g.box(0, 0, -12, 0, 0, 6, 0xc8c0a0); g.box(0, 0, -14, 0, 0, -13, 0x9aa0a6); g.box(-1, 0, 5, 1, 0, 6, 0xd84a20); g.box(0, -1, 5, 0, 1, 6, 0xd84a20); },
  });
  const disc = (r, color, opacity) => () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.renderOrder = 1; return m;
  };
  GAD.MESH_FN.slick = disc(1.75, 0x5aa8d0, 0.4);    // a glossy pool of polymer
  GAD.MESH_FN.wet = disc(3.2, 0x22384a, 0.28);      // a wet floor under a sprinkler

  /* =============================================================== weapons */
  /* Quarrel: a bolt that flies (speed, drop) and is traced a frame's travel at a time, so it hits
     bodies, gadgets, glass and walls the way a bullet would; it doesn't go through walls. It stays
     stuck where it lands for a while. */
  class Bolt extends Proj {
    constructor(a, o, dir, d) {
      super('bolt', a, o.clone().addScaledVector(dir, 0.3), dir.clone().multiplyScalar(d.proj.speed), { g: d.proj.g, hitR: 0, hp: 999, intercept: false });
      this.d = d; this.flying = true; this.melee = false; this.blastproof = true;
      if (this.mesh) this.mesh.lookAt(this.pos.clone().add(dir));
    }
    update(dt) {
      this.t += dt;
      if (!this.flying) { if (this.t > 8) this.destroy('silent'); return; }
      this.vel.y -= 18 * this.g * dt;
      const L = this.vel.length() * dt, dir = this.vel.clone().normalize();
      const end = WPN.trace(this.owner, this.pos, dir, this.d, L, 1);
      const stopped = U.dist3(end, this.pos) < L - 0.02;
      this.pos.copy(end);
      if (this.mesh) { this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(dir)); }
      if (stopped) {
        this.flying = false; this.t = 0; this.vel.set(0, 0, 0);
        // in somebody: gone; in a wall: it stays a while
        if (G.actors.some(b => b.state !== 'dead' && U.dist3(b.center(V()), end) < 0.7)) this.destroy('silent');
        else SFX.impact(end, true);
      } else if (this.t > 3) this.destroy('silent');
    }
  }
  OPS2.bolt = function (a, o, dir, d) {
    if (GAME.client) return;
    // a bot holds a little high for the drop over the distance to its target (a player learns to)
    const t = a.bot && a.bot.target;
    if (t && t.pos) { const dist = U.dist3(a.pos, t.pos), tt = dist / d.proj.speed; dir = dir.clone(); dir.y += 0.5 * 18 * d.proj.g * tt * tt / Math.max(1, dist); dir.normalize(); }
    new Bolt(a, o, dir, d);
  };
  /* what a shot does besides its rounds: Grit's suppression along every round's path, and a
     dragon's-breath shell lighting a small fire where it hits the floor */
  OPS2.shotEffects = function (a, d, e, ends) {
    if (GAME.client) return;
    if (a.supFire > G.time) for (const end of ends) suppressAlong(a, e, end);
    if (d.burn && ends[0]) {
      const p = ends[0], W = G.world;
      if (W.boxHits(p.x - 0.04, p.y - 0.18, p.z - 0.04, p.x + 0.04, p.y - 0.02, p.z + 0.04) && live('fire').filter(f => f.small).length < 4) {
        const f = new GAD.Fire(a, V().set(p.x, Math.round(p.y * 4) / 4 + 0.02, p.z), 0.9, 3); f.small = true;
      }
    }
  };
  /* Grit: a round passing within 1.6 m of a defender (or striking what they hide behind) pins them */
  function suppressAlong(a, o, end) {
    const dx = end.x - o.x, dy = end.y - o.y, dz = end.z - o.z, L2 = dx * dx + dy * dy + dz * dz || 1;
    for (const b of G.actors) {
      if (b.state !== 'alive' || b.team === a.team || b.hostage) continue;
      const c = b.center(V());
      const t = U.clamp(((c.x - o.x) * dx + (c.y - o.y) * dy + (c.z - o.z) * dz) / L2, 0, 1);
      const px = o.x + dx * t - c.x, py = o.y + dy * t - c.y, pz = o.z + dz * t - c.z;
      if (px * px + py * py + pz * pz > 1.6 * 1.6) continue;
      const was = b.supT > G.time;
      b.supT = G.time + 2;
      if (b.isPlayer) PLAYER.shake(0.15); else if (b.net && window.NP) NP.push({ k: 'shake', to: b.net, s: 0.15 });
      if (!was) GAD.tell(b, 'SUPPRESSED', 'warn');
    }
  }

  /* ===================================================== secondary gadgets */
  /* a flank cam: sticks to a wall (or sits on the floor facing the way you look); any defender in its
     100° view within 14 m, in sight and out of smoke, is marked for your team every half second */
  class FlankCam extends Ent {
    constructor(a, p, n, yaw) {
      super('flankcam', a, p, { normal: n, hp: 1, hitR: 0.12, yaw });
      this.dir = n.y > 0.7 ? V().set(-Math.sin(yaw), 0, -Math.cos(yaw)) : n.clone().setY(0).normalize();
      this.tick = 0; SFX.reload(this.pos, a.isPlayer, 1);
    }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      this.tick -= dt; if (this.tick > 0) return; this.tick = 0.5;
      if (GAD.jammed(this.pos, this.team, ['scrambler'])) return;
      const eye = this.pos.clone().addScaledVector(this.dir, 0.12).add(V().set(0, 0.05, 0));
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage || b.cloakT > 0 || b.nullT > G.time) continue;
        const c = b.center(V()), to = c.clone().sub(eye), d = to.length(); if (d > 14) continue;
        to.divideScalar(d); if (to.x * this.dir.x + to.z * this.dir.z < 0.64) continue;   // outside its 100°
        if (!G.world.los(eye, c) || FX.smokeBlocks(eye, c)) continue;
        if (!(b.marks && b.marks[this.team] > G.time + 0.5)) SFX.beep(this.pos, 2100, 0.25);
        GAME.mark(b, this.team, 2, true);
      }
    }
  }
  OPS2.GADG.flankcam = (a, g, spend) => {
    const h = GAD.aim(a, 2.2), wall = h && !h.md.see && Math.abs(h.n.y) < 0.5;
    const p = wall ? h.p : GAD.floorAhead(a, 0.9); if (!p) return false;
    new FlankCam(a, p, wall ? h.n : V().set(0, 1, 0), a.yaw); return spend();
  };
  OPS2.DEPLOY.flankcam = (a, p, n, yaw) => new FlankCam(a, p, n, yaw);
  /* the extinguisher: a CO2 blast out to 4 m. Fires, gas and slick in it are gone; any burning
     body is put out; the smoke there thins; a brief white cloud hangs where it blew */
  OPS2.GADG.extinguisher = (a, g, spend) => {
    const e = a.eye(V()), f = a.fwd(V()), hit = G.world.raycast(e, f, 4.2);
    const reach = hit ? Math.max(0.6, hit.dist - 0.15) : 4, mid = e.clone().addScaledVector(f, Math.min(2.2, reach)), end = e.clone().addScaledVector(f, reach);
    let n = 0;
    for (const x of G.ents) if (x.alive && (x.type === 'fire' || x.type === 'irritant' || x.type === 'slick') && (U.dist2(x.pos, mid) < 2.6 || U.dist2(x.pos, end) < 2.6) && Math.abs(x.pos.y - end.y) < 2.2) { x.destroy('used'); n++; }
    for (const b of G.actors) if (b.burnT > G.time && U.dist3(b.center(V()), mid) < 2.6) { b.burnT = 0; n++; }
    FX.clearSmoke(end, 2.6);
    GAD.smokeOf(a, end.clone().setY(end.y - 0.6), 1.5, 2.4);
    FX.puff(end, 1.4, 0.8, 0xf2f6f8); SFX.whoosh(e); GAME.noise(e, 16, a, 'gadget');
    if (n) GAD.tell(a, 'Extinguished');
    return spend();
  };
  /* caltrops: anyone of the other team crossing them faster than a careful walk is hurt (7 a step),
     slowed and heard. Crouching, walking slowly or creeping gets through */
  class Caltrops extends Ent {
    constructor(a, p, yaw) { super('caltrops', a, p, { upright: true, yaw, hp: 999, hitR: 0 }); this.cool = new Map(); SFX.metal(this.pos); }
    update(dt) {
      this.t += dt; if (this.t < 0.6) return;
      for (const b of G.actors) {
        if (b.state !== 'alive' || b.team === this.team || b.hostage) continue;
        if (Math.abs(b.pos.x - this.pos.x) > 0.8 || Math.abs(b.pos.z - this.pos.z) > 0.8 || Math.abs(b.pos.y - this.pos.y) > 0.5) continue;
        if (b.stance >= 1 || b.walk || (b.moving || 0) < 1.6 || G.time < (this.cool.get(b) || 0)) continue;
        this.cool.set(b, G.time + 0.45);
        b.hurt(7, { src: this.owner, kind: 'trap' }); b.slow = Math.max(b.slow, 1.0);
        SFX.metal(this.pos); GAME.noise(this.pos, 16, b, 'wire');
        if (!(b.calNag > G.time)) { b.calNag = G.time + 3; GAD.tell(b, 'CALTROPS: crouch or walk across', 'warn'); }
      }
    }
  }
  OPS2.GADG.caltrops = (a, g, spend) => { const p = GAD.floorAhead(a, 1.2); if (!p) return false; new Caltrops(a, p, a.yaw); return spend(); };
  OPS2.DEPLOY.caltrops = (a, p, n, yaw) => new Caltrops(a, p, yaw);

  /* ============================================================== RUST */
  /* the degausser: on reinforced steel it sets up for a second, hums for six, then the plate in a
     2 m x 2.5 m area (through its thickness) turns brittle: WEAK, which every soft breach opens */
  class Degausser extends Ent {
    constructor(a, h) {
      super('degauss', a, h.p, { normal: h.n, hp: 40, hitR: 0.25 });
      this.vox = { x: h.x, y: h.y, z: h.z }; this.hum = 0;
      SFX.metal(this.pos); GAD.tell(a, 'Degausser set: the steel goes brittle in 7 s');
    }
    update(dt) {
      this.t += dt;
      const j = GAD.jammed(this.pos, this.team, ['dampener', 'scrambler']);
      if (j && this.t > 0.3) { FX.sparks(this.pos, this.normal.x, this.normal.y, this.normal.z, 0x5ad8ff); SFX.zap(this.pos); GAD.tell(this.owner, 'Degausser jammed: ' + GAD.nameOf(j).toLowerCase() + ' nearby'); this.destroy('silent'); return; }
      if (this.t < 1) return;
      if (!this.loop) this.loop = SFX.loop('burn', this.pos);
      this.hum -= dt;
      if (this.hum <= 0) { this.hum = 1; GAME.noise(this.pos, 12, this.owner, 'breach'); }
      if (Math.random() < dt * 4) FX.burst(this.pos.clone().addScaledVector(this.normal, 0.1), 0xff7a3a, 1, 0.5, 0.03, 0.4, 0);
      if (this.t >= 7) {
        const n = OPS2.degauss(this.vox, this.normal, this.pos);
        SFX.zap(this.pos); FX.flash(this.pos, 1.5, 0.2); FX.puff(this.pos, 1.2, 0.8, 0xb87333);
        GAD.tell(this.owner, n ? 'Steel degaussed: breach it' : 'Degausser: no steel here');
        if (n && !GAME.ffa) GAD.tellTeam(1 - this.team, 'A reinforced wall has been degaussed', true);
        if (n) OPS2.teamBreach(this);
        this.destroy('used');
      }
    }
  }
  OPS2.degauss = function (vox, n, p) {
    const W = G.world;
    let cnt = 0;
    const conv = (x, y, z) => { const m = W.get(x, y, z); if (m && MAT[m].reinf) { W.set(x, y, z, M.WEAK); cnt++; return true; } return false; };
    if (Math.abs(n.y) > 0.5) {
      // a hatch or a floor plate: 2 m square, through its thickness
      for (let dx = -4; dx <= 3; dx++) for (let dz = -4; dz <= 3; dz++) for (let k = 0; k < 3; k++) if (!conv(vox.x + dx, vox.y - Math.sign(n.y) * k, vox.z + dz) && k) break;
    } else {
      const along = Math.abs(n.x) > 0.5 ? 'z' : 'x', sx = Math.sign(n.x), sz = Math.sign(n.z);
      const fy = Math.floor(W.groundBelow(p.x + n.x * 0.3, p.y, p.z + n.z * 0.3) * 4);
      for (let t = -4; t <= 3; t++) for (let y = fy; y <= fy + 10; y++) for (let k = 0; k < 3; k++) {
        const x = along === 'z' ? vox.x - sx * k : vox.x + t, z = along === 'z' ? vox.z + t : vox.z - sz * k;
        if (!conv(x, y, z) && k) break;
      }
    }
    // a panel whose steel is gone no longer counts as reinforced (the bots' soft breachers go for it)
    if (cnt) GAME.reinforced = GAME.reinforced.filter(pn => { const x = pn.axis === 'z' ? (pn.a0 + pn.a1) >> 1 : pn.line, z = pn.axis === 'z' ? pn.line : (pn.a0 + pn.a1) >> 1, m = W.get(x, pn.y0 + 4, z); return m && MAT[m].reinf; });
    return cnt;
  };
  /* a degaussed wall wants opening: if its owner carries no breach charges, the nearest bot on the
     team who can soft-breach (a breach charge, a rivet, a spike) is sent to it */
  OPS2.teamBreach = function (dg) {
    const o = dg.owner; if (!o || (o.gadget && o.gadget.id === 'breach' && o.gadget.count > 0)) return;
    const soft = a => a.ability && (a.ability.id === 'rivet' || a.ability.id === 'spike') && a.ability.count > 0;
    const can = a => a.bot && a.state === 'alive' && a.team === dg.team && ((a.gadget && a.gadget.id === 'breach' && a.gadget.count > 0) || soft(a));
    const n = dg.normal, out = dg.pos.clone().addScaledVector(V().set(n.x, 0, n.z).normalize(), 0.9);
    out.y = G.world.groundBelow(out.x, dg.pos.y, out.z);
    if (!NAV.walkable(out)) return;
    const x = G.actors.filter(can).sort((p, q) => U.dist3(p.pos, out) - U.dist3(q.pos, out))[0];
    if (!x || U.dist3(x.pos, out) > 45) return;
    const look = dg.pos.clone(), back = out.clone().addScaledVector(V().set(n.x, 0, n.z).normalize(), 1.4);
    x.bot.task = null;
    x.bot.tasks.unshift({ at: out, look, time: 0.7, hurry: true, maxTravel: 45, run: y => { AI.faceTo(y, look, 1, 99); if (soft(y)) GAD.ability(y); else if (GAD.secondary(y)) setTimeout(() => { if (y.alive) GAD.secondary(y); }, 1500); } },
      { at: NAV.walkable(back) ? back : out, time: 2 });
  };
  OPS2.ABIL.degauss = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.0);
    if (!h || !h.md.reinf) { GAD.tell(a, 'The degausser goes on reinforced steel: a wall, a plate or a hatch'); return false; }
    new Degausser(a, h); return spend();
  };

  /* ============================================================== SKID */
  /* slick: a 3.5 m pool for 18 s. Bodies on it slide (Actor.physics reads onSlick); bots route
     round it (navCost); sprinklers and extinguishers clear it */
  class Slick extends Ent {
    constructor(a, p) { super('slick', a, p, { hp: 999, hitR: 0, melee: false }); this.r = 1.75; this.life = 18; this.blastproof = true; }
    update(dt) {
      this.t += dt; if (this.t > this.life) { this.destroy('used'); return; }
      if (Math.random() < dt * 2.5) FX.burst(this.pos.clone().add(V().set((Math.random() - 0.5) * 3, 0.05, (Math.random() - 0.5) * 3)), 0x9ad8ff, 1, 0.3, 0.03, 0.5, 0);
    }
  }
  OPS2.ABIL.slick = (a, ab, need, spend) => {
    if (!need()) return false;
    new Proj('slickcan', a, GAD.throwStart(a), GAD.throwVel(a, 13), { impact: true, intercept: true, onFuse: s => {
      s.destroy('used');
      const gy = G.world.groundBelow(s.pos.x, s.pos.y + 0.3, s.pos.z);
      new Slick(a, V().set(s.pos.x, gy + 0.03, s.pos.z));
      SFX.whoosh(s.pos); FX.puff(s.pos, 1.2, 0.6, 0x9ad8ff); GAME.noise(s.pos, 18, a, 'gadget');
    } });
    return spend();
  };
  OPS2.DEPLOY.slick = (a, p) => new Slick(a, p);
  /* is this body standing on slick? (guests ask the mirrored pools, so their own feet slide too) */
  OPS2.onSlick = function (b) {
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'slick') continue;
      const dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z;
      if (dx * dx + dz * dz < 1.75 * 1.75 && Math.abs(b.pos.y - e.pos.y) < 0.6) return true;
    }
    return false;
  };
  /* bots' paths: slick costs extra to cross (null when there is none, so it costs nothing) */
  OPS2.navCost = function () {
    let pools = null;
    for (const e of G.ents) if (e.alive && e.type === 'slick') (pools || (pools = [])).push(e.pos);
    if (!pools) return null;
    return P => { for (const q of pools) if ((P.x - q.x) ** 2 + (P.z - q.z) ** 2 < 4 && Math.abs(P.y - q.y) < 1) return 8; return 0; };
  };

  /* ============================================================== GRIT */
  OPS2.ABIL.suppress = (a, ab, need, spend) => {
    if (a.supFire > G.time) return false;
    if (!need()) return false;
    a.supFire = G.time + 9; ab.count--; a.busy = 0.2;
    SFX.reload(a.pos, a.isPlayer, 1); GAD.tell(a, 'SUPPRESSIVE FIRE: 9 s');
    return true;
  };

  /* ============================================================== GROUT */
  /* resin: a 2 m x 2.5 m patch of soft wall (or 2 m square of floor, hatch or ceiling), through its
     thickness, set as RESIN: bulletproof, and explosives don't touch it */
  const resinable = m => m && MAT[m].xp && !MAT[m].reinf && !MAT[m].see && m !== M.BARR && m !== M.LEAF && m !== M.RESIN;
  OPS2.resinAt = function (a, h) {
    const W = G.world, nx = Math.round(h.nx), ny = Math.round(h.ny), nz = Math.round(h.nz);
    let cnt = 0;
    // a column into the surface: every soft voxel until the first that isn't
    const column = (x, y, z, dx, dy, dz) => { for (let k = 0; k < 3; k++) { const X = x + dx * k, Y = y + dy * k, Z = z + dz * k; if (!resinable(W.get(X, Y, Z))) break; W.set(X, Y, Z, M.RESIN); cnt++; } };
    if (ny) for (let dx = -4; dx <= 3; dx++) for (let dz = -4; dz <= 3; dz++) column(h.x + dx, h.y, h.z + dz, 0, -ny, 0);
    else {
      const fy = Math.floor(W.groundBelow(h.px + nx * 0.3, h.py, h.pz + nz * 0.3) * 4);
      for (let t = -4; t <= 3; t++) for (let y = fy; y <= fy + 10; y++) column(nx ? h.x : h.x + t, y, nz ? h.z : h.z + t, -nx, 0, -nz);
    }
    if (cnt) { FX.puff(h.p, 1.5, 1.0, 0xd8c890); SFX.whoosh(h.p); GAME.noise(h.p, 14, a, 'breach'); }
    return cnt;
  };
  OPS2.ABIL.resin = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.5);
    if (!h || !resinable(h.m)) { GAD.tell(a, h && h.m === M.RESIN ? 'That is resin already' : 'Aim at a soft wall, floor or hatch'); return false; }
    if (!OPS2.resinAt(a, h)) return false;
    GAD.tell(a, 'Resin set'); return spend();
  };

  /* ============================================================== DRENCH */
  /* a sprinkler head: waits for attacker smoke, gas, slick or fire within 7 m, then rains for 10 s:
     smoke clears, gas and slick and every fire go, burning bodies are put out, and the floor under
     it stays wet (loud footsteps) for 20 s. One shower, then it is spent */
  class Sprinkler extends Ent {
    constructor(a, p, n) { super('sprinkler', a, p, { normal: n, hp: 1, hitR: 0.12 }); this.rain = -1; this.tick = 0; this.r = 7; SFX.reload(this.pos, a.isPlayer, 1); }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      if (this.rain < 0) {
        this.tick -= dt; if (this.tick > 0) return; this.tick = 0.25;
        if (utilityNear(this.pos, this.r, this.team)) this.start();
        return;
      }
      this.rain += dt; this.tick -= dt;
      rainFx(this.pos, dt);
      if (this.tick <= 0) { this.tick = 0.25; douse(this.pos, this.r); }
      if (this.rain >= 10) this.destroy('used');
    }
    start() {
      this.rain = 0; this.tick = 0;
      SFX.whoosh(this.pos); GAME.noise(this.pos, 22, this.owner, 'alarm');
      const gy = G.world.groundBelow(this.pos.x, this.pos.y - 0.3, this.pos.z), rm = G.map.roomAt ? G.map.roomAt(this.pos) : null;
      const w = new Ent('wet', this.owner, V().set(this.pos.x, gy + 0.02, this.pos.z), { hp: 999, hitR: 0, melee: false }); w.blastproof = true; w.update = function (dt) { this.t += dt; if (this.t > 22) this.destroy('used'); };
      GAD.tellTeam(this.team, 'Sprinkler triggered' + (rm ? ': ' + rm.name : ''));
    }
  }
  function utilityNear(p, r, team) {
    for (const c of FX.smokes) if (c.team != null && c.team !== team && c.team >= 0 && U.dist2(c.pos, p) < r && Math.abs(c.pos.y - p.y) < 4) return true;
    for (const e of G.ents) if (e.alive && e.team !== team && (e.type === 'irritant' || e.type === 'slick' || e.type === 'fire') && U.dist2(e.pos, p) < r && Math.abs(e.pos.y - p.y) < 4) return true;
    return false;
  }
  function douse(p, r) {
    FX.clearSmoke(p, r);
    for (const e of G.ents) if (e.alive && (e.type === 'irritant' || e.type === 'slick' || e.type === 'fire') && U.dist2(e.pos, p) < r && Math.abs(e.pos.y - p.y) < 4) e.destroy('used');
    for (const b of G.actors) if (b.burnT > G.time && U.dist2(b.pos, p) < r) b.burnT = 0;
  }
  function rainFx(p, dt) {
    if (Math.random() > dt * 22) return;
    const q = p.clone().add(V().set((Math.random() - 0.5) * 5, -0.1, (Math.random() - 0.5) * 5));
    FX.burst(q, 0x9ad8ff, 2, 0.4, 0.035, 0.7, 1.3);
  }
  OPS2.ABIL.sprinkler = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.6);
    if (!h || h.md.see || h.n.y > 0.5) { GAD.tell(a, 'Mount the sprinkler on a ceiling or a wall'); return false; }
    new Sprinkler(a, h.p, h.n); return spend();
  };
  OPS2.DEPLOY.sprinkler = (a, p, n) => new Sprinkler(a, p, n);
  /* a wet floor: footsteps on it splash (Actor.physics) */
  OPS2.wetAt = function (p) {
    for (const e of G.ents) if (e.alive && e.type === 'wet' && U.dist2(e.pos, p) < 3.2 && Math.abs(e.pos.y - p.y) < 0.6) return true;
    return false;
  };

  /* ===================================================== movement hooks */
  /* lines and ladders (batch 2) move bodies themselves: true when they did */
  OPS2.physics = function (a, dt) { return false; };

  /* ========================================================== guests */
  OPS2.entRec = function (e, x) {
    if (e.type === 'sprinkler' && e.rain >= 0) x.rn = 1;
  };
  OPS2.mirrorSet = function (m, x, first) { m.rain = x.rn ? 1 : -1; };
  OPS2.mirrorFx = function (m, dt) {
    if (m.type === 'sprinkler' && m.rain > 0) rainFx(m.pos, dt);
    else if (m.type === 'slick' && Math.random() < dt * 2.5) FX.burst(m.pos.clone().add(V().set((Math.random() - 0.5) * 3, 0.05, (Math.random() - 0.5) * 3)), 0x9ad8ff, 1, 0.3, 0.03, 0.5, 0);
  };

  /* ================================================================ HUD */
  OPS2.status = function (a) {
    if (a.supT > G.time) return 'SUPPRESSED · stay in cover';
    if (a.supFire > G.time) return 'SUPPRESSIVE FIRE ' + Math.ceil(a.supFire - G.time) + 's';
    if (a.burnT > G.time) return 'ON FIRE';
    if (a.slickT > G.time) return 'NO GRIP · slick floor';
    return '';
  };
  OPS2.hudCount = function (a) {
    if (a.ability && a.ability.id === 'suppress' && a.supFire > G.time) return Math.ceil(a.supFire - G.time) + 's';
    return null;
  };
  let vig = null;
  OPS2.hudFrame = function (a, dt) {
    // suppressed: the edges of the view close in
    if (!vig) { vig = document.createElement('div'); vig.id = 'suppvig'; vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .15s;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(20,18,12,.78) 100%)'; document.body.append(vig); }
    const on = G.mode === 'match' && a.supT > G.time && a.state === 'alive';
    vig.style.opacity = on ? '1' : '0';
  };

  /* ================================================================ bots */
  const near = (a, p, r) => p && U.dist3(a.pos, p) < r;
  /* in the action phase: true when it used something */
  OPS2.aiUse = function (a, b, c) {
    if (GAME.phase !== 'action') return false;
    const ab = a.ability, g = a.gadget, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null, dist = t ? U.dist3(a.pos, t.pos) : 99;
    if (ab && ab.count > 0 && a.busy <= 0) {
      // Grit: suppressive fire as a fight starts, when the team has fresh contact close by, or for
      // the push into the objective
      const S = c.S, fresh = S.known && G.time - S.kt < 5 && U.dist3(a.pos, S.known) < 25;
      if (ab.id === 'suppress' && !(a.supFire > G.time) && ((t && dist > 3 && dist < 32) || fresh || (b.entered && c.nearObj && (S.threat || b.alert > 0)))) { GAD.ability(a); return true; }
      // Skid: slick lobbed onto a defender holding 5-18 m away (seen, or just heard of); one per 8 s
      if (ab.id === 'slick' && G.time > (b.slickT || 0)) {
        const at = t && dist > 5 && dist < 18 ? t.pos : fresh && U.dist3(a.pos, S.known) > 5 && U.dist3(a.pos, S.known) < 18 ? S.known : null;
        if (at && c.safe(at) && Math.random() < 0.6) { AI.lobAt(a, at); if (GAD.ability(a)) { b.slickT = G.time + 8; return true; } }
      }
    }
    if (g && g.count > 0 && a.busy <= 0) {
      // an extinguisher on a fire or gas in the way, or on yourself burning
      if (g.id === 'extinguisher' && !t) {
        const hz = G.ents.find(x => x.alive && x.team !== a.team && (x.type === 'fire' || x.type === 'irritant' || x.type === 'slick') && U.dist3(x.pos, a.pos) < 4.5 && U.dist3(x.pos, a.pos) > 1);
        if (hz || a.burnT > G.time) { if (hz) AI.faceTo(a, hz.pos.clone().setY(hz.pos.y + 0.3), 1, 99); GAD.secondary(a); return true; }
      }
      // a flank cam on the way in, watching back the way the team came
      if (g.id === 'flankcam' && b.entered && !t && !(a.placed.some(x => x.alive && x.type === 'flankcam')) && G.time > (b.camT || 0)) {
        b.camT = G.time + 20;
        const back = b.entry && b.entry.op ? GAD.opCenter(b.entry.op) : null;
        const yaw = back ? Math.atan2(-(back.x - a.pos.x), -(back.z - a.pos.z)) : a.yaw + Math.PI;
        const p = V().set(a.pos.x, G.world.groundBelow(a.pos.x, a.pos.y + 0.5, a.pos.z) + 0.01, a.pos.z);
        const cam = GAD.deployAt(a, 'flankcam', p, V().set(0, 1, 0), yaw); if (cam) { a.placed.push(cam); g.count--; return true; }
      }
    }
    return false;
  };
  /* attack prep (AI.actionStart): true when this bot's kit is planned here */
  OPS2.aiPlanAtk = function (a, plan, c) {
    const { b, r, id } = c;
    // Rust: degauss a reinforced site wall from outside, wait out the hum, then breach it herself
    if (id === 'degauss') {
      const W = G.world, steel = p => { const x = p.axis === 'z' ? (p.a0 + p.a1) >> 1 : p.line, z = p.axis === 'z' ? p.line : (p.a0 + p.a1) >> 1, m = W.get(x, p.y0 + 4, z); return m && MAT[m].reinf; };
      // (the reinforced panels: AI.roomPanels only lists walls still soft)
      for (const p of U.shuffle(GAME.reinforced.filter(q => plan.rooms.includes(q.room) && q.look && q.stand && steel(q)))) {
        const room = p.room, outD = V().copy(p.look).sub(p.stand).setY(0).normalize();
        const out = p.look.clone().addScaledVector(outD, 0.9); out.y = room.fy;
        if (!NAV.walkable(out) || plan.rooms.includes(G.map.roomAt(out))) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 0.8) continue;
        const back = out.clone().addScaledVector(outD, 1.6);
        b.tasks.push({ at: out, look: p.look, time: 0.8, hurry: true, maxTravel: 60, run: x => { x.pitch = 0; AI.faceTo(x, p.look, 1, 99); GAD.ability(x); } });
        b.tasks.push({ at: NAV.walkable(back) ? back : out, look: p.look, time: 7.5 });
        // her own breach charges if she carries them (if not, a teammate is sent: OPS2.teamBreach)
        if (a.gadget && a.gadget.id === 'breach') {
          b.tasks.push({ at: out, look: p.look, time: 0.8, run: x => { AI.faceTo(x, p.look, 1, 99); if (GAD.secondary(x)) setTimeout(() => { if (x.alive) GAD.secondary(x); }, 1500); } });
          b.tasks.push({ at: NAV.walkable(back) ? back : out, time: 2 });
        }
        return true;
      }
    }
    return false;
  };
  /* defence prep (planDefKit): the operator's ability */
  OPS2.aiPlanDef = function (a, plan, c) {
    const { place, atEntry, ents, b } = c, id = a.ability ? a.ability.id : null;
    // Grout: resin on the site's soft walls that weren't reinforced (and on a hatch over it, if any)
    if (id === 'resin') {
      const W = G.world, soft = p => { const x = p.axis === 'z' ? (p.a0 + p.a1) >> 1 : p.line, z = p.axis === 'z' ? p.line : (p.a0 + p.a1) >> 1; return resinable(W.get(x, p.y0 + 4, z)); };
      const pans = U.shuffle(plan.rooms.flatMap(rm => AI.roomPanels(rm)).filter(soft)).slice(0, a.ability.count);
      // first thing in the prep phase (reinforcing comes after, and leaves resin alone)
      b.tasks.unshift(...pans.map(p => ({ at: p.stand, look: p.look, time: 0.7, run: x => { x.pitch = 0; AI.faceTo(x, p.look, 1, 99); if (soft(p)) GAD.ability(x); } })));
    }
    // Drench: a sprinkler on the ceiling just inside each of three ways in
    if (id === 'sprinkler') place(Math.min(3, Math.max(1, ents.length)), i => atEntry(i, (x, op, st, inw, cc) => {
      const from = st.clone().addScaledVector(inw, 1.2).setY(st.y + 1.5), up = G.world.raycast(from, V().set(0, 1, 0), 3.5);
      if (!up || x.ability.count <= 0) return;
      GAD.deployAt(x, 'sprinkler', V().set(from.x, up.py - 0.03, from.z), V().set(0, -1, 0)); x.ability.count--;
    }, 0.7) || { time: 0 });
  };
  OPS2.aiPlanDefGadget = function (a, plan, c) {
    const { place, atEntry, g } = c;
    // caltrops just inside two ways in, where a rush lands
    if (g.id === 'caltrops') place(g.count, i => atEntry(i + 1, (x, op, st, inw, cc) => {
      const p = cc.clone().addScaledVector(inw, 1.3); p.y = G.world.groundBelow(p.x, cc.y + 0.5, p.z) + 0.01;
      if (Math.abs(p.y - st.y) < 0.6 && x.gadget.count > 0) { GAD.deployAt(x, 'caltrops', p, null, op.axis === 'z' ? 0 : Math.PI / 2); x.gadget.count--; }
    }) || { time: 0 });
  };
})();
