/* ops2-c.js -- seasons 10-14, batch 3: information warfare.
     PHANTOM ghost signal: false attacker contacts walking in the defenders' picture
     LOOP    feed loop: a camera, sensor, alarm or turret keeps running and reports nothing
     TREMOR  seismic stake: every noise a defender makes nearby shows as a ring
     BABEL   comms jammer: attackers inside lose their team's picture and can't add to it
     RELAY   backtrace dart: whoever pilots the tagged drone is marked for the defense
   Added to js/ops2.js's hooks with OPS2.chain. */
(function () {
  'use strict';
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent, Proj = GAD.Proj;
  const pv = v => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  for (const t of ['spoofer', 'stake']) GAD.ELEC.add(t);
  GAD.ELEC.add('jammer'); GAD.TRAPS.add('jammer');
  Object.assign(GAD.NAMES, { spoofer: 'Ghost spoofer', stake: 'Seismic stake', jammer: 'Comms jammer' });
  Object.assign(GAD.EXTRA, {
    spoofer: g => { g.box(-3, -3, 0, 3, 3, 2, 0x22262e); g.box(-2, -2, -1, 2, 2, -1, MD.glow(0x3fd0e0)); g.box(0, 4, 1, 0, 9, 1, 0x333333); g.set(0, 10, 1, MD.glow(0x3fd0e0)); },
    stake: g => { g.box(-1, -10, -1, 1, 8, 1, 0x5a4a3a); g.box(-2, 8, -2, 2, 11, 2, 0x2e3a3a); g.set(0, 12, 0, MD.glow(0x7ce8c0)); for (let y = -8; y <= 4; y += 4) g.box(-2, y, 0, 2, y, 0, 0x9aa0a6); },
    jammer: g => { g.box(-6, 0, -6, 6, 3, 6, 0x2a2c34); g.box(-5, 4, -5, 5, 4, 5, 0x1a1c22); for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { g.box(x, 5, z, x, 14, z, 0x444650); g.set(x, 15, z, MD.glow(0x3fd0e0)); } },
  });

  /* ============================================================= PHANTOM */
  /* the spoofer: thrown, it sticks; a second later three phantom attackers walk the routes around it in
     the defenders' picture for 15 s (red marks on their screens; their bots believe them). A phantom
     goes the moment a defender has a clear look at where it is within 12 m, or shoots near it. The
     spoofer (1 HP) can be shot, jammed by a scrambler, or caught in the air by a seeker */
  class Spoofer extends Proj {
    constructor(a) {
      super('spoofer', a, GAD.throwStart(a), GAD.throwVel(a, 13), { sticky: true, hp: 1, intercept: true });
      this.ph = []; this.on = -1;
      this.onStick = () => { this.on = 0; SFX.beep(this.pos, 1600, 0.3); };
    }
    update(dt) {
      super.update(dt);
      if (!this.alive || this.on < 0) return;
      this.on += dt;
      if (GAD.jammed(this.pos, this.team, ['scrambler'])) { if (this.ph.length) GAD.tell(this.owner, 'Ghost signal jammed'); this.destroy('silent'); return; }
      if (this.on > 1 && !this.started) { this.started = true; for (let i = 0; i < 3; i++) this.ph.push(this.spawn(i)); }
      if (this.on > 16) { this.destroy('used'); return; }
      for (const p of this.ph) if (p.alive) walk(p, dt);
      // a defender who sees the spot clearly (or a bullet near it) breaks the illusion
      for (const p of this.ph) {
        if (!p.alive) continue;
        const chest = p.pos.clone().setY(p.pos.y + 1.2);
        for (const b of G.actors) {
          if (b.state !== 'alive' || b.team === this.team || b.hostage || U.dist3(b.eye(V()), chest) > 12) continue;
          const to = chest.clone().sub(b.eye(V())).normalize(); if (to.dot(b.fwd(V())) < 0.6) continue;
          if (!G.world.los(b.eye(V()), chest) || FX.smokeBlocks(b.eye(V()), chest)) continue;
          p.alive = false; FX.burst(chest, 0x3fd0e0, 6, 1, 0.04, 0.4, 0); GAD.tell(b, 'Nobody there: a spoofed signal', 'warn'); break;
        }
      }
    }
    spawn(i) {
      const p = { pos: this.pos.clone(), alive: true, path: null, pi: 0, i };
      const n = NAV.nearest(this.pos, 3); if (n >= 0) p.pos.copy(NAV.nodePos(n));
      p.pos.x += (i - 1) * 0.7;
      return p;
    }
    destroy(w) { super.destroy(w); this.ph = []; }
  }
  // a phantom wanders: a walkable point 6-14 m off, then another, at a walking pace
  function walk(p, dt) {
    if (!p.path || p.pi >= p.path.length) {
      for (let k = 0; k < 4; k++) {
        const ang = Math.random() * 6.28, d = 6 + Math.random() * 8;
        const to = p.pos.clone().add(V().set(Math.cos(ang) * d, 0, Math.sin(ang) * d));
        const path = NAV.path(p.pos, to, { partial: true, max: 4000 });
        if (path && path.length > 2) { p.path = path; p.pi = 0; break; }
      }
      if (!p.path) return;
    }
    const n = p.path[p.pi], dx = n.x - p.pos.x, dz = n.z - p.pos.z, L = Math.hypot(dx, dz);
    if (L < 0.2) { p.pi++; p.pos.y = n.y; return; }
    const s = Math.min(L, 2.4 * dt); p.pos.x += dx / L * s; p.pos.z += dz / L * s; p.pos.y += (n.y - p.pos.y) * Math.min(1, dt * 8);
  }
  OPS2.ABIL.ghost = (a, ab, need, spend) => { if (!need()) return false; new Spoofer(a); GAD.tell(a, 'Ghost signal out'); return spend(); };
  /* the phantoms a team is being shown (live ones, by position): host or guest alike */
  OPS2.phantomsFor = function (team) {
    const out = [];
    for (const e of G.ents) if (e.alive && e.type === 'spoofer' && e.team !== team && e.ph) for (const p of e.ph) if (p.alive) out.push(p.pos);
    return out;
  };

  /* ================================================================ LOOP */
  /* the feed loop: keep a defender camera, armored cam, sensor, alarm or turret in your sights (within
     22 m, in sight) for 1.5 s and it loops for 30 s: it carries on, and reports nothing */
  const LOOPABLE = new Set(['cam', 'bpcam', 'sensor', 'alarm', 'turret']);
  function loopTarget(a) {
    const e = a.eye(V()), f = a.fwd(V());
    let best = null, bd = 22;
    for (const x of G.ents) {
      if (!x.alive || !LOOPABLE.has(x.type) || x.team === a.team || x.team < 0) continue;
      const to = x.pos.clone().sub(e), d = to.length(); if (d > bd) continue;
      to.divideScalar(d); if (to.dot(f) < 0.992) continue;
      if (!G.world.los(e, x.pos.clone().addScaledVector(to, -0.25))) continue;
      best = x; bd = d;
    }
    return best;
  }
  OPS2.ABIL.loop = (a, ab, need, spend) => {
    if (a.loopCh) return false;
    if (!need()) return false;
    const t = loopTarget(a);
    if (!t) { GAD.tell(a, 'Aim at a defender camera, sensor, alarm or turret within 22 m'); return false; }
    if (t.loopT > G.time + 5) { GAD.tell(a, 'Already looped'); return false; }
    a.loopCh = { target: t, t: 0 }; SFX.beep(a.pos, 900, 0.2);
    return true;
  };
  OPS2.chain('tick', function (a, dt) {
    const c = a.loopCh; if (!c) return;
    const t = c.target;
    // a bot holds still with it in its sights
    if (a.bot && t.alive) { AI.faceTo(a, t.pos, dt, 12); a.mf = a.mr = 0; a.trigger = false; }
    if (!t.alive || a.state !== 'alive' || loopTarget(a) !== t) { a.loopCh = null; GAD.tell(a, 'Feed loop lost'); return; }
    c.t += dt;
    if (c.t >= 1.5) {
      t.loopT = G.time + 30; a.loopCh = null; a.ability.count--;
      SFX.beep(a.pos, 1400, 0.25); GAD.tell(a, 'LOOPED: ' + GAD.nameOf(t) + ' (30 s)', 'kill');
    }
  });
  /* a looped device (GAD.update asks): sensors and alarms say nothing; a turret sweeps its arc and
     never locks on; a camera still turns (camIntel skips it) */
  OPS2.looped = function (e, dt) {
    if (e.type === 'sensor' || e.type === 'alarm') { e.t += dt; return true; }
    if (e.type === 'turret') { e.t += dt; e.tgt = null; e.lock = 0; e.aimYaw = U.turn(e.aimYaw, e.yaw + Math.sin(e.t * 0.9) * 0.6, Math.min(1, dt * 5)); if (e.mesh) e.mesh.rotation.y = e.aimYaw; return true; }
    return false;
  };
  /* watching a looped camera: no attacker shows in its feed */
  OPS2.hideInView = function (a) {
    const P = PLAYER;
    return P.view === 'cams' && P.cam && P.cam.loopT > G.time && G.player && a.team !== G.player.team && !a.hostage;
  };

  /* ============================================================== TREMOR */
  /* a seismic stake: 30 s. Any noise a defender makes within 16 m (a floor up or down) shows to the
     attackers as a ring where it was made: footsteps, reloads, gadgets, gunfire, reinforcing. Quiet
     movement makes none (it is not loud enough), and nor does anyone in a null field */
  class Stake extends Ent {
    constructor(a, p) { super('stake', a, p, { upright: true, hp: 1, hitR: 0.12 }); this.life = 30; SFX.metal(this.pos); GAME.noise(this.pos, 10, a, 'gadget'); }
    update(dt) { this.t += dt; if (this.t > this.life) this.destroy('used'); else if (Math.random() < dt) SFX.beep(this.pos, 220, 0.12); }
  }
  OPS2.ABIL.stake = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 0.6) || V().set(a.pos.x, G.world.groundBelow(a.pos.x, a.pos.y + 0.5, a.pos.z) + 0.01, a.pos.z);
    new Stake(a, p); GAD.tell(a, 'Seismic stake: listening for 30 s'); return spend();
  };
  OPS2.DEPLOY.stake = (a, p) => new Stake(a, p);
  OPS2.rings = [];   // { p, t, team } -- the team that sees it
  const addRing = (p, team) => {
    if (OPS2.rings.some(r => r.team === team && G.time - r.t < 0.6 && U.dist3(r.p, p) < 1.2)) return;
    OPS2.rings.push({ p: p.clone(), t: G.time, team });
    if (OPS2.rings.length > 40) OPS2.rings.shift();
  };
  OPS2.chain('noiseHook', function (p, r, src, type, fake) {
    if (!src || fake || r < 6 || !src.op || !src.pos) return;
    if (src.nullT > G.time || GAME.client) return;
    for (const s of G.ents) {
      if (!s.alive || s.type !== 'stake' || s.team === src.team || s.disabled) continue;
      if (U.dist2(s.pos, p) > 16 || Math.abs(s.pos.y - p.y) > 4.5) continue;
      addRing(p, s.team);
      if (window.NP && NP.active && NP.host) NP.push({ k: 'ring', team: s.team, p: pv(p) });
      break;
    }
  });

  /* =============================================================== BABEL */
  /* a comms jammer: an 8 m field. An attacker inside is cut off from the team's picture: no allies or
     shared marks on screen, no pings, and nothing they see is passed on (their bots' sightings stay
     with them). 30 HP; EMP and surges kill it */
  class Jammer extends Ent {
    constructor(a, p, yaw) { super('jammer', a, p, { upright: true, yaw, hp: 30, hitR: 0.25 }); this.r = 8; this.hiss = 0; SFX.reload(this.pos, a.isPlayer, 1); }
    update(dt) {
      this.t += dt; if (this.t < 1 || this.disabled) return;
      if (Math.random() < dt * 2) FX.burst(this.pos.clone().add(V().set((Math.random() - 0.5) * 4, 0.6, (Math.random() - 0.5) * 4)), 0x3fd0e0, 1, 0.4, 0.03, 0.5, 0);
      for (const b of G.actors) if (b.state !== 'dead' && b.team !== this.team && !b.hostage && U.dist2(b.pos, this.pos) < this.r && Math.abs(b.pos.y - this.pos.y) < 3) {
        if (!(b.jamT > G.time)) GAD.tell(b, 'COMMS JAMMED', 'warn');
        b.jamT = G.time + 0.4;
      }
    }
  }
  OPS2.ABIL.jammer = (a, ab, need, spend) => { if (!need()) return false; const p = GAD.floorAhead(a, 0.9); if (!p) return false; new Jammer(a, p, a.yaw); return spend(); };
  OPS2.DEPLOY.jammer = (a, p, n, yaw) => new Jammer(a, p, yaw);
  OPS2.jammed = a => !!(a && a.jamT > G.time && G.mode === 'match');

  /* =============================================================== RELAY */
  /* the backtrace dart: hitscan, 20 m, at an attacker drone. It keeps working, but whoever pilots it is
     marked for the defense every 4 s while driving (their screen says SIGNAL TRACED) */
  OPS2.ABIL.backtrace = (a, ab, need, spend) => {
    if (!need()) return false;
    const e = a.eye(V()), f = a.fwd(V()), wall = G.world.raycast(e, f, 20, true), maxT = wall ? wall.dist + 0.3 : 20;
    let best = null, bt = maxT;
    for (const x of G.ents) {
      if (!x.alive || x.type !== 'drone' || x.team === a.team) continue;
      const to = x.pos.clone().sub(e), t = to.dot(f); if (t < 0.3 || t > maxT) continue;
      if (to.addScaledVector(f, -t).length() < 0.4 && t < bt) { bt = t; best = x; }
    }
    FX.tracer(GAD.throwStart(a), e.clone().addScaledVector(f, bt), 0xffa040); SFX.zap(a.pos); GAME.noise(e, 10, a, 'shot');
    if (!best) { GAD.tell(a, 'Backtrace dart: no drone hit'); return spend(); }
    best.traced = a.team; best.traceT = 0;
    GAD.tell(a, 'Drone traced: its pilot will show', 'kill');
    return spend();
  };
  OPS2.chain('entTick', function (e, dt) {
    if (e.type !== 'drone' || e.traced == null) return;
    const p = e.pilot;
    if (!p || p.state === 'dead') return;
    e.traceT -= dt;
    if (e.traceT <= 0) { e.traceT = 4; GAME.mark(p, e.traced, 4, true); SFX.beep(e.pos, 1900, 0.2); }
    // a bot doesn't keep driving a drone it knows is traced
    if (p.bot && e.traceT < 3.5) { e.pilot = null; e.mf = e.mr = 0; }
  });
  OPS2.aiEntTarget = function (a, g) {
    if (!a.ability || a.ability.id !== 'backtrace' || a.ability.count <= 0 || g.type !== 'drone' || g.traced != null || a.busy > 0) return false;
    GAD.ability(a); return true;
  };

  /* ====================================================== team knowledge */
  OPS2.chain('sitHook', function (S, team) {
    // the defenders believe their phantoms (a fresh sighting beats them)
    if (GAME.sideOf(team) === 'def') {
      const ph = OPS2.phantomsFor(team);
      if (ph.length && G.time - S.kt > 2) { S.known = ph[0].clone(); S.kt = G.time; }
    }
    // the attackers hear what their stakes hear
    const r = OPS2.rings.filter(q => q.team === team && G.time - q.t < 2).pop();
    if (r && r.t > S.kt) { S.known = r.p.clone(); S.kt = r.t; }
  });

  /* ======================================================== guests */
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'spoofer' && e.ph && e.ph.length) { const live = e.ph.filter(p => p.alive); if (live.length) x.ph = live.map(p => pv(p.pos)); }
    if ((e.type === 'cam' || e.type === 'bpcam') && e.loopT > G.time) x.lp = 1;
    if (e.type === 'drone' && e.traced != null) x.tr = e.traced;
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if (m.type === 'spoofer') m.ph = (x.ph || []).map(q => ({ pos: V().set(...q), alive: true }));
    if (m.type === 'cam' || m.type === 'bpcam') m.loopT = x.lp ? G.time + 1 : 0;
    if (m.type === 'drone') m.traced = x.tr != null ? x.tr : null;
  });
  OPS2.chain('guestEvent', function (e) {
    if (e.k === 'ring' && Array.isArray(e.p) && G.player && e.team === G.player.team) { addRing(V().set(...e.p), e.team); return true; }
  });

  /* ================================================================ HUD */
  OPS2.chain('markers', function (a, put, jam) {
    if (G.mode !== 'match') return;
    // phantom contacts: exactly like a marked enemy
    if (!jam) for (const p of OPS2.phantomsFor(a.team)) put(p.clone().setY(p.y + 1.2), 'mk-enemy', '◆');
    // seismic rings, fading over two seconds
    if (!jam) for (const r of OPS2.rings) { const age = G.time - r.t; if (r.team === a.team && age < 2) put(r.p.clone().setY(r.p.y + 0.3), 'mk-ring a' + Math.min(2, Math.floor(age * 1.5)), '◯'); }
  });
  OPS2.chain('status', function (a) {
    if (OPS2.jammed(a)) return 'COMMS JAMMED · your team can\'t see what you see';
    if (a.loopCh || a.loopP > 0) return 'LOOPING FEED ' + Math.round((a.loopCh ? a.loopCh.t / 1.5 : a.loopP) * 100) + '% · keep it in your sights';
    return '';
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.ability.count <= 0 || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // Phantom: a ghost signal toward the objective as the team goes in (a decoy push elsewhere)
    if (ab.id === 'ghost' && !t && c.obj && U.dist3(a.pos, c.obj) < 26 && U.dist3(a.pos, c.obj) > 8 && G.time > (b.ghostT || 0)) {
      b.ghostT = G.time + 20;
      AI.lobAt(a, c.obj.clone().add(V().set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6))); GAD.ability(a); return true;
    }
    // Loop: a defender watcher in sight within 20 m that isn't looped yet
    if (ab.id === 'loop' && !t && !a.loopCh) {
      const eye = a.eye(V());
      const w = G.ents.find(x => x.alive && LOOPABLE.has(x.type) && x.team !== a.team && x.team >= 0 && !(x.loopT > G.time) && U.dist3(x.pos, eye) < 20 && G.world.los(eye, x.pos.clone().add(V().set(0, 0.1, 0))));
      if (w) { AI.faceTo(a, w.pos, 1, 99); if (GAD.ability(a)) return true; }
    }
    // Tremor: a stake once near the objective, another later
    if (ab.id === 'stake' && !t && c.obj && U.dist3(a.pos, c.obj) < 20 && G.time > (b.stakeT || 0)) { b.stakeT = G.time + 32; GAD.ability(a); return true; }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b, inner, ents } = c, id = a.ability ? a.ability.id : null;
    // Babel: a jammer just inside the way in the attack is most likely to use
    if (id === 'jammer') {
      for (let i = 0; i < Math.min(2, a.ability.count); i++) {
        const op = ents[i % Math.max(1, ents.length)], p = op ? GAD.opCenter(op) : null, q = p ? NAV.nearest(p, 3) : -1;
        const at = q >= 0 && plan.rooms.includes(G.map.roomAt(NAV.nodePos(q))) ? NAV.nodePos(q) : inner();
        b.tasks.unshift({ at, time: 0.6, run: x => { if (x.ability.count > 0) { GAD.deployAt(x, 'jammer', at.clone().setY(at.y + 0.01), null, x.yaw); x.ability.count--; } } });
      }
    }
  });
})();
