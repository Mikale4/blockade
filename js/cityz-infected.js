/* cityz-infected.js -- City Z: the infected. Each is an Actor (so guns, melee, explosions and fire all
   hurt them as they would anyone) with a brain of its own instead of the operator AI:

     idle      stands or shuffles about, groans now and then
     alert     heard something: goes to look
     chase     sees someone: paths to them (and straight at them once in sight and close)
     attack    in reach: hits, every `cd` seconds; a bite can infect and can open a wound
     lurk      a Lurker waits crouched and still in the dark until someone is close, then pounces

   Runners sprint, Brutes shrug off body shots and knock you back, Screamers shriek when they see you
   (every infected that hears it comes), Spitters lob acid that burns and infects, and infected
   operators still carry their guns and use them (the normal bot AI, on the infected's side).
   A location keeps a population (cityz.js); the living ones are topped up from it out of sight. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const CAP = 18;
  const live = () => G.actors.filter(a => a.cz && (a.cz.inf || a.cz.opx) && a.state !== 'dead');
  // people holed up somewhere (the pharmacist, survivors waiting) are hidden: the infected only find
  // them once the squad is close (and making noise), or once they're out and following someone
  const hidden = a => a.cz && a.cz.person && !a.cz.person.follow && !G.actors.some(x => x.cz && x.cz.m && x.state === 'alive' && U.dist3(x.pos, a.pos) < 15);
  const preyOf = () => G.actors.filter(a => a.state !== 'dead' && (a.team === CZ.TEAM || (a.cz && a.cz.person)) && !a.ghost && !a.czCar && !a.czDriving && !hidden(a));

  /* ------------------------------------------------------------------ bodies */
  const OPS_INF = {};
  const opOf = kind => OPS_INF[kind] || (OPS_INF[kind] = { id: '_inf_' + kind, name: CZ.INFECTED[kind].name, armor: 1, speed: 2, look: CZ.INFECTED[kind].look, primaries: ['p10'], secondaries: ['p10'], gadgets: [], unit: 'none' });
  // known by id everywhere (an online guest builds them from the host's roster)
  for (const k of Object.keys(CZ.INFECTED)) DATA.OPMAP['_inf_' + k] = opOf(k);
  CZ.spawnInfected = function (kind, pos) {
    if (kind === 'opx') return spawnOpx(pos);
    const d = CZ.INFECTED[kind], diff = CZ.diff();
    const a = new Actor({ name: d.name, team: CZ.INF, side: 'def', op: opOf(kind), loadout: { primary: 'p10', secondary: 'p10', gadget: null } });
    a.cz = { inf: kind, def: d, state: d.lurk ? 'lurk' : 'idle', t: Math.random() * 3, hitT: 0, path: null, pi: 0, pathT: 0, target: null, heard: null, groanT: 3 + Math.random() * 8, wander: null, stuckT: 0, last: V(), screamT: 0, spitT: 0, pounceT: 0 };
    a.maxHp = a.hp = Math.round(d.hp * (diff.inf > 1.2 ? 1.15 : 1));
    a.drones = 0; a.w.forEach(w => { w.mag = 0; w.reserve = 0; });
    a.pos.copy(pos); a.yaw = Math.random() * 6.28;
    if (d.lurk) a.setStance(1);
    a.addTo(G.scene);
    if (a.rig) { a.rig.gun.visible = false; if (d.scale) a.rig.root.scale.setScalar(d.scale); }
    G.actors.push(a);
    return a;
  };
  /* an infected operator: one of BLOCKADE's own, turned, still armed */
  function spawnOpx(pos) {
    const ops = DATA.OPS.filter(o => !/^_/.test(o.id)), op = ops[Math.floor(Math.random() * ops.length)];
    const a = new Actor({ name: 'Infected ' + op.name, team: CZ.INF, side: 'def', op, loadout: { primary: op.primaries[0], secondary: op.secondaries[0], gadget: op.gadgets[0] } });
    a.cz = { opx: true, def: { name: 'Infected operator', infect: 4 } };
    a.maxHp = a.hp = 120; a.drones = 0;
    a.persona = PERSONA.make([]); PERSONA.tune && PERSONA.tune(a.persona, 1.4, 0.4); AI.attach(a); a.bot.role = 'roam';
    // the infected can still pull a trigger, but not aim: a wide, wild spread on every shot (weapons.js
    // adds czShake; the bot's own extraSpread is reset every frame, so it never held)
    a.czShake = 2.6 * Math.min(1.3, CZ.diff().inf);
    a.pos.copy(pos); a.yaw = Math.random() * 6.28;
    a.addTo(G.scene); G.actors.push(a);
    if (AI.teams && AI.teams[CZ.INF]) AI.teams[CZ.INF].bots.push(a);
    return a;
  }
  // the infected operators' plan: go for the nearest of the squad they know about
  CZ.infGoal = function (a) {
    const ps = preyOf(); if (!ps.length) return null;
    let best = null, bd = 1e9; for (const p of ps) { const d = U.dist3(p.pos, a.pos); if (d < bd) { bd = d; best = p; } }
    if (bd > 45 && !(a.bot.heard && G.time - a.bot.heard.t < 8)) { if (!a.bot.wander || U.dist3(a.pos, a.bot.wander) < 2) a.bot.wander = randomSpot(a.pos, 20); return { pos: a.bot.wander, kind: 'roam', r: 1.5 }; }
    return { pos: best.pos.clone(), kind: 'hunt', r: 6, look: best.eye(V()) };
  };
  // their pose: arms out, no gun
  const oRig = Actor.prototype.updateRig;
  Actor.prototype.updateRig = function (dt, visible) {
    oRig.call(this, dt, visible);
    const c = this.cz; if (!c || !c.inf || !this.rig || !visible || this.state === 'dead') return;
    const r = this.rig, sway = Math.sin(G.time * 3 + this.id) * 0.12, lunge = c.lungeT > G.time ? 0.5 : 0;
    r.armL.rotation.set(1.35 + sway + lunge, 0, 0.18); r.armR.rotation.set(1.45 - sway + lunge, 0, -0.18);
    r.head.rotation.z = Math.sin(G.time * 1.3 + this.id) * 0.25;
    if (r.gun.visible) r.gun.visible = false;
  };
  // the turned look sickly
  const oTint = Actor.prototype.tint;
  Actor.prototype.tint = function (c) { if (this.cz && this.cz.opx) c = [c[0] * 0.72, c[1] * 0.95, c[2] * 0.62]; return oTint.call(this, c); };
  // the infected never go down to be revived: they drop
  const oDown = Actor.prototype.down;
  Actor.prototype.down = function (src) { if (this.cz && (this.cz.inf || this.cz.opx)) return this.die(src, false); return oDown.apply(this, arguments); };
  // a Brute's hide: body rounds do a third
  const oHurt = Actor.prototype.hurt;
  Actor.prototype.hurt = function (dmg, info) {
    const c = this.cz;
    if (c && c.def && c.def.armour && info && !info.head && (info.kind === 'bullet' || info.kind === 'melee')) dmg *= c.def.armour;
    if (c && c.inf && info && info.src && this.state === 'alive') { c.target = info.src.isActor !== false && info.src.pos ? info.src : c.target; if (c.state === 'idle' || c.state === 'lurk' || c.state === 'alert') c.state = 'chase'; }
    return oHurt.call(this, dmg, info);
  };

  /* ------------------------------------------------------------------ senses */
  // everything that makes a noise the infected can hear too (louder than for operators)
  const oNoise = GAME.noise;
  GAME.noise = function (p, r, src, type, fake) {
    oNoise.apply(this, arguments);
    if (GAME.mode !== 'cityz' || !r || (src && src.cz && src.cz.inf)) return;
    const R = r * (type === 'scream' ? 1 : 1.35);
    for (const a of G.actors) {
      const c = a.cz; if (!c || !c.inf || a.state !== 'alive') continue;
      if (U.dist3(a.pos, p) > R) continue;
      if (c.state === 'chase' && c.target && c.target.state !== 'dead' && G.time - (c.seenT || 0) < 3) continue;
      c.heard = { pos: p.clone(), t: G.time };
      if (c.state === 'idle' || c.state === 'alert') c.state = 'alert';
      if (c.state === 'lurk' && U.dist3(a.pos, p) < 9) c.state = 'alert';
    }
  };
  function sees(a, t) {
    const c = a.cz, d = c.def, dist = U.dist3(a.pos, t.pos);
    let range = d.sight * (CZ.dark() > 0.6 ? 0.55 : 1) * (CZ.S.weather === 'fog' ? 0.6 : 1);
    if (t.stance > 0) range *= 0.7;
    if (t.cloakT > 0) range *= 0.2;
    if (dist > range) return false;
    if (dist > 3) { const f = a.fwd(V()).setY(0).normalize(), to = t.pos.clone().sub(a.pos).setY(0).normalize(); if (f.dot(to) < -0.1) return false; }
    return G.world.los(a.eye(V()), t.eye(V()));
  }
  function randomSpot(near, r) {
    for (let i = 0; i < 8; i++) { const p = near.clone().add(V().set((Math.random() - 0.5) * 2 * r, 0, (Math.random() - 0.5) * 2 * r)); const n = NAV.nearest(p, 6); if (n >= 0 && NAV.main.has(n)) return NAV.nodePos(n); }
    return near.clone();
  }

  /* ------------------------------------------------------------------ brain */
  function moveAlong(a, dt, goal, run) {
    const c = a.cz;
    if ((c.pathT -= dt) <= 0 || !c.path || (c.goalP && U.dist3(c.goalP, goal) > 1.5)) {
      c.pathT = 0.9 + Math.random() * 0.6; c.goalP = goal.clone();
      c.path = NAV.path(a.pos, goal, { partial: true, max: 9000 }); c.pi = 0;
    }
    let to = goal;
    if (c.path && c.path.length) {
      while (c.pi < c.path.length - 1 && Math.hypot(c.path[c.pi].x - a.pos.x, c.path[c.pi].z - a.pos.z) < 0.5 && Math.abs(c.path[c.pi].y - a.pos.y) < 1.3) c.pi++;
      to = c.path[c.pi];
    }
    const yaw = Math.atan2(-(to.x - a.pos.x), -(to.z - a.pos.z));
    let dy = yaw - a.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
    a.yaw += U.clamp(dy, -dt * 6, dt * 6);
    a.mf = Math.abs(dy) < 1.4 ? 1 : 0.3; a.mr = 0; a.sprint = !!run;
    // stuck against something: a barricade gets beaten down, anything else gets a new path
    const moved = U.dist2(a.pos, c.last); c.last.copy(a.pos);
    if (moved < dt * 0.3) c.stuckT += dt; else c.stuckT = Math.max(0, c.stuckT - dt);
    if (c.stuckT > 1.2) { c.stuckT = 0; if (!bash(a)) c.path = null; }
  }
  // boards and barricades in front: knocked out a few at a time
  const BASHABLE = () => [DATA.M.BARR, DATA.M.CZ_BOARD, DATA.M.WOOD, DATA.M.GLASS].filter(Boolean);
  function bash(a) {
    const W = G.world, f = a.fwd(V()).setY(0).normalize(), B = BASHABLE();
    let n = 0;
    for (let h = 0.3; h < 1.9; h += 0.25) for (const reach of [0.4, 0.65]) {
      const p = a.pos.clone().addScaledVector(f, reach).setY(a.pos.y + h);
      const x = Math.floor(p.x * 4), y = Math.floor(p.y * 4), z = Math.floor(p.z * 4), m = W.get(x, y, z);
      if (m && B.includes(m) && Math.random() < 0.6) { W.set(x, y, z, 0); FX.debris && FX.debris(x, y, z, m); n++; }
    }
    if (n) { SFX.wood(a.pos, true); GAME.noise(a.pos, 14, a, 'breach'); a.cz.lungeT = G.time + 0.35; }
    return n > 0;
  }
  function attack(a, t) {
    const c = a.cz, d = c.def, diff = CZ.diff();
    if (G.time < c.hitT) return;
    c.hitT = G.time + d.cd * (0.85 + Math.random() * 0.3); c.lungeT = G.time + 0.3;
    const dir = t.pos.clone().sub(a.pos).setY(0).normalize();
    SFX.bite(a.pos); GAME.noise(a.pos, 8, a, 'melee');
    t.hurt(d.dmg * diff.dmg, { src: a, kind: 'melee', dir });
    if (d.armour) { t.vel.x += dir.x * 7; t.vel.z += dir.z * 7; t.stun = Math.max(t.stun || 0, 0.5); }
    if (CZ.bitten) CZ.bitten(t, d.infect * diff.infect, d);
  }
  function think(a, dt) {
    const c = a.cz, d = c.def;
    if (a.state !== 'alive') { a.mf = a.mr = 0; return; }
    if (a.stun > 0) { a.mf = a.mr = 0; return; }
    c.t += dt;
    // groans
    if ((c.groanT -= dt) <= 0) { c.groanT = 4 + Math.random() * 9; if (U.dist3(a.pos, G.player ? G.player.pos : a.pos) < 30) SFX.groan(a.eye(V()), d.armour ? 0.7 : d.scream ? 1.6 : 1); }
    // look for someone, a few times a second
    if ((c.lookT = (c.lookT || 0) - dt) <= 0) {
      c.lookT = 0.25 + Math.random() * 0.15;
      let best = null, bd = 1e9;
      for (const t of preyOf()) { if (t.state === 'dead') continue; const dd = U.dist3(t.pos, a.pos); if (dd < bd && (c.state === 'lurk' ? dd < 6 && G.world.los(a.eye(V()), t.eye(V())) : sees(a, t))) { bd = dd; best = t; } }
      if (best) {
        if (c.state !== 'chase' && d.scream && G.time > c.screamT) { c.screamT = G.time + 14; SFX.shriek(a.eye(V())); GAME.noise(a.pos, 60, a, 'scream'); c.fleeT = G.time + 3; if (best.isPlayer) HUD.toast('A Screamer has seen you', 'warn'); }
        if (c.state === 'lurk') { c.pounceT = G.time + 1.6; a.setStance(0); }
        c.state = 'chase'; c.target = best; c.seenT = G.time;
      }
    }
    // the screamer stays out of reach after screaming
    if (d.scream && c.fleeT > G.time && c.target) { const away = a.pos.clone().sub(c.target.pos).setY(0).normalize().multiplyScalar(8).add(a.pos); moveAlong(a, dt, away, true); return; }
    switch (c.state) {
      case 'lurk': a.mf = a.mr = 0; return;
      case 'idle': {
        if (!c.wander || U.dist2(a.pos, c.wander) < 1 || c.t > 14) { c.t = 0; c.wander = Math.random() < 0.5 ? null : randomSpot(a.pos, 8); }
        if (c.wander) moveAlong(a, dt, c.wander, false); else { a.mf = a.mr = 0; a.sprint = false; }
        return;
      }
      case 'alert': {
        if (!c.heard || G.time - c.heard.t > 20) { c.state = 'idle'; return; }
        if (U.dist2(a.pos, c.heard.pos) < 1.5) { c.heard = null; c.state = 'idle'; return; }
        moveAlong(a, dt, c.heard.pos, d.run > 1.1);
        return;
      }
      case 'chase': {
        const t = c.target;
        if (!t || t.state === 'dead') { c.target = null; c.state = c.heard ? 'alert' : 'idle'; return; }
        const dist = U.dist3(a.pos, t.pos);
        // lost them: go to where they were last seen, then give up
        if (G.time - c.seenT > 6) { c.heard = { pos: t.pos.clone(), t: G.time }; c.state = 'alert'; return; }
        if (G.time - c.seenT < 0.6 && dist < d.reach + 0.2 && Math.abs(t.pos.y - a.pos.y) < 1.4) {
          a.mf = 0; a.mr = 0; a.yaw = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); attack(a, t); return;
        }
        // a spitter keeps its distance and spits
        if (d.spit && dist > 4 && dist < 16 && G.time - c.seenT < 0.6 && G.time > c.spitT) { c.spitT = G.time + 4 + Math.random() * 2; spit(a, t); }
        if (d.spit && dist < 9 && dist > 3.5) { a.mf = 0; a.yaw = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); return; }
        const run = d.run > 1.1 || c.pounceT > G.time || (dist < 8 && d.run > 0.8);
        // in sight and close: straight at them
        if (dist < 6 && G.time - c.seenT < 0.4 && Math.abs(t.pos.y - a.pos.y) < 1) {
          const yaw = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); a.yaw = yaw; a.mf = 1; a.mr = 0; a.sprint = run;
          const moved = U.dist2(a.pos, c.last); c.last.copy(a.pos); if (moved < dt * 0.3) { c.stuckT += dt; if (c.stuckT > 1.2) { c.stuckT = 0; bash(a); } } else c.stuckT = 0;
        } else moveAlong(a, dt, t.pos, run);
        return;
      }
    }
  }
  // the speed of each kind (through the shared speed factor, ops3-c.js)
  function pace(a) {
    const c = a.cz, d = c.def, run = a.sprint;
    let k = run ? d.run / 1.35 : d.speed / 0.55 * 0.62;
    if (c.pounceT > G.time) k *= 1.5;
    if (CZ.S.diff === 'nightmare') k *= 1.1;
    a.czMul = k;
  }

  /* ------------------------------------------------------------------ acid */
  function spit(a, t) {
    const at = t.pos.clone().add(V().set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2));
    SFX.throwS(a.eye(V()));
    const blob = new GAD.Ent('czacid', a, at.clone().setY(at.y + 0.02), { model: false, hp: 999, hitR: 0, melee: false });
    blob.life = 6; blob.r = 1.4; blob.delay = 0.45; blob.team = CZ.INF;
    blob.update = function (dt) {
      this.t += dt;
      if (this.t < this.delay) return;
      if (!this.hit) { this.hit = true; SFX.impact(this.pos, true); }
      if (this.t > this.life + this.delay) { this.destroy('used'); return; }
      if ((this.fx = (this.fx || 0) - dt) <= 0) { this.fx = 0.3; FX.puff(this.pos.clone().setY(this.pos.y + 0.1), this.r * 0.8, 0.6, 0x8ac83a); }
      for (const b of preyOf()) if (b.state === 'alive' && Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z) < this.r && Math.abs(b.pos.y - this.pos.y) < 0.8) {
        b.hurt(5 * dt * CZ.diff().dmg, { src: this.owner, kind: 'gas' });
        if (CZ.bitten) CZ.bitten(b, 0.6 * dt * CZ.diff().infect, null, true);
      }
    };
  }

  /* ------------------------------------------------------------------ population */
  function pickKind(danger) {
    const mix = Object.assign({}, CZ.MIX[danger]);
    if (CZ.night()) { mix.runner = (mix.runner || 0) * 2; mix.lurker = (mix.lurker || 0) * 1.5; }
    let tot = 0; for (const k in mix) tot += mix[k];
    let r = Math.random() * tot; for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
    return 'walker';
  }
  // somewhere out of the squad's sight, at least `far` metres from all of them
  function hiddenSpot(far, indoors) {
    const nodes = OPS3.navNodes(); if (!nodes.length) return null;
    const squad = G.actors.filter(a => a.team === CZ.TEAM && a.state !== 'dead');
    for (let i = 0; i < 40; i++) {
      let p;
      if (indoors && G.map.rooms.length) { const r = G.map.rooms[Math.floor(Math.random() * G.map.rooms.length)]; p = NAV.randomIn(r); if (!p) continue; }
      else p = NAV.nodePos(nodes[Math.floor(Math.random() * nodes.length)]);
      if (squad.some(a => U.dist3(a.pos, p) < far)) continue;
      if (squad.some(a => U.dist3(a.pos, p) < 45 && G.world.los(a.eye(V()), p.clone().setY(p.y + 1.5)))) continue;
      return p;
    }
    return null;
  }
  CZ.populate = function (zid, st) {
    const Z = CZ.ZONES[zid], diff = CZ.diff();
    if (st.pop < 0) st.pop = Math.round(CZ.POP[Z.danger] * diff.inf);
    if (CZ.isSafe(zid)) st.pop = Math.min(st.pop, (CZ.S.safe[zid].up || []).includes('walls') ? 2 : 5);
    const n = Math.min(st.pop, cap());
    for (let i = 0; i < n; i++) { const kind = pickKind(Z.danger), p = hiddenSpot(22, Math.random() < 0.55 || kind === 'lurker'); if (p) CZ.spawnInfected(kind, p); }
    CZ.Z.trickleT = 20;
  };
  const cap = () => Math.round((CAP + (CZ.night() ? 6 : 0)) * Math.min(1.3, CZ.diff().inf));
  CZ.countInfected = () => CZ.Z ? CZ.zoneState(CZ.Z.id).pop : 0;
  CZ.infectedTick = function (dt) {
    for (const a of G.actors) if (a.cz && a.cz.inf) { think(a, dt); pace(a); }
    const Z = CZ.Z, st = CZ.zoneState(Z.id), L = live();
    // more come out of the side streets while the place still has them
    if ((Z.trickleT -= dt) <= 0) {
      Z.trickleT = CZ.night() ? 12 : 22;
      if (L.length < Math.min(cap(), st.pop)) { const kind = pickKind(Z.def.danger), p = hiddenSpot(32, Math.random() < 0.4); if (p) CZ.spawnInfected(kind, p); }
    }
    // the dead are cleared away after a while (keeps the place light)
    for (const a of [...G.actors]) if (a.cz && (a.cz.inf || a.cz.opx) && a.state === 'dead' && (a.deathT || 0) > 25) { a.removeFrom(G.scene); const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1); }
  };
  const GADGET_ITEM = { frag: 'pipebomb', impact: 'pipebomb', c4: 'pipebomb', claymore: 'pipebomb', breach: 'pipebomb', smoke: 'flare', stun: 'noisemaker', flash: 'noisemaker', stim: 'painkillers', alarm: 'battery', flankcam: 'parts', dshield: 'scrap', wire: 'scrap' };
  function gearOf(v) {
    const out = [];
    for (const w of v.w) { if (!w || !DATA.WEAPONS[w.id]) continue; out.push(['gun:' + w.id, 1]); out.push([CZ.calOf(w.id), Math.max(0, w.mag || 0) + 8 + Math.floor(Math.random() * 18)]); }
    const g = v.gadget && GADGET_ITEM[v.gadget.id]; if (g && (v.gadget.count == null || v.gadget.count > 0)) out.push([g, 1]);
    if (Math.random() < 0.25) out.push(['pack_s', 1]);
    if (Math.random() < 0.18) out.push(['jacket', 1]);
    if (Math.random() < 0.4) out.push(['bandage', 1]);
    if (Math.random() < 0.15) out.push(['torch', 1]);
    return out;
  }
  CZ.onKillInf = function (v) {
    if (!CZ.Z) return;
    const st = CZ.zoneState(CZ.Z.id); st.pop = Math.max(0, st.pop - 1);
    if (st.pop === 0 && !st.cleared) { st.cleared = true; HUD.banner('CLEARED', CZ.Z.def.name + ' is quiet, for now', 3, 'win'); }
    // what they carried
    if (CZ.dropLoot) {
      if (v.cz.opx && !v.czTurnedM) CZ.dropLoot(v.pos, gearOf(v), 'Gear of ' + v.name);
      else if (Math.random() < 0.18) CZ.dropLoot(v.pos, [[['cloth', 'bandage', 'a9', 'water', 'bar', 'battery'][Math.floor(Math.random() * 6)], 1 + Math.floor(Math.random() * 2)]], 'Pockets');
    }
  };
  CZ.listen('kill', v => { if (v.cz && (v.cz.inf || v.cz.opx)) CZ.onKillInf(v); });

  /* ------------------------------------------------------------------ hordes */
  /* a horde: a crowd of walkers and runners coming through from one road end toward a point */
  CZ.horde = function (n, towards) {
    const ex = CZ.Z.exits[Math.floor(Math.random() * CZ.Z.exits.length)];
    const goal = towards || (G.player ? G.player.pos.clone() : V().set(45, 3.25, 45));
    let made = 0;
    for (let i = 0; i < n && live().length < cap() + 14; i++) {
      const p = V().set(ex.x + (Math.random() - 0.5) * 6, ex.y, ex.z + (Math.random() - 0.5) * 6), q = NAV.nearest(p, 8);
      if (q < 0) continue;
      const a = CZ.spawnInfected(Math.random() < 0.25 ? 'runner' : 'walker', NAV.nodePos(q));
      a.cz.state = 'alert'; a.cz.heard = { pos: goal.clone(), t: G.time + 30 }; made++;
    }
    const st = CZ.zoneState(CZ.Z.id); st.pop += made;
    HUD.banner('HORDE', 'A horde is coming in from the ' + ({ N: 'north', S: 'south', E: 'east', W: 'west' })[ex.side], 3, 'lose');
    return made;
  };
  // the infected don't talk: no radio calls ("Contact!", "Man down!") from the dead, only their groans,
  // so the squad's own voices come through. (Someone who turned on the squad is still a person.)
  VOICE.mute = a => GAME.mode === 'cityz' && !!(a.cz && (a.cz.inf || (a.cz.opx && !a.czTurnedM)) || a.team === CZ.INF && GAME.mode === 'cityz');
})();
