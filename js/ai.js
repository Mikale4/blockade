/* ai.js -- bot brains. Each bot perceives (sight, hearing, team intel), picks a
   job from its team plan (defend a site, push an objective, plant, defuse,
   escort, revive) and fights with difficulty-scaled reaction and aim.       */
(function () {
  'use strict';
  const { M, MAT, DIFFS } = DATA;
  const AI = { teams: {} };
  const V = () => new THREE.Vector3();
  const D2R = Math.PI / 180;

  AI.attach = function (a) {
    a.bot = {
      state: 'idle', path: null, pi: 0, goal: null, repathT: 0, goalKind: '', hold: null, holdLook: null,
      target: null, seenT: 0, reactT: 0, lastSeen: null, lastSeenT: -99, think: Math.random() * 0.2,
      errY: 0, errP: 0, strafeT: 0, strafeDir: 1, burst: 0, burstPause: 0, stuckT: 0, lastPos: V(), meleeT: 0,
      tasks: [], task: null, taskT: 0, heard: null, extraSpread: 0, wantHead: false, role: 'entry', util: 0, scanT: 0,
      crouchT: 0, alert: 0, entT: 0, entTarget: null,
    };
  };
  const diff = () => DIFFS[G.settings.difficulty] || DIFFS[1];

  /* ------------------------------------------------------------- helpers */
  function faceTo(a, p, dt, rate, eyeOverride) {
    const e = eyeOverride || a.eye(V());
    const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const k = 1 - Math.exp(-(rate || 8) * dt);
    a.yaw = a.yaw + U.wrap(yaw - a.yaw) * k;
    a.pitch = a.pitch + (pitch - a.pitch) * k;
    return Math.abs(U.wrap(yaw - a.yaw)) + Math.abs(pitch - a.pitch);
  }
  AI.faceTo = faceTo;
  /* move toward a world direction while looking wherever */
  function steer(a, dx, dz, speedK) {
    const L = Math.hypot(dx, dz); if (L < 1e-4) { a.mf = a.mr = 0; return; }
    dx /= L; dz /= L;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
    a.mf = (dx * fx + dz * fz) * (speedK || 1); a.mr = (dx * rx + dz * rz) * (speedK || 1);
  }
  AI.moveTo = function (a, p, kind, opts) {
    const b = a.bot;
    if (b.goal && b.path && U.dist3(b.goal, p) < 0.6 && b.goalKind === kind) return true;
    b.goal = p.clone(); b.goalKind = kind; b.repathT = 0;
    b.path = NAV.path(a.pos, p, Object.assign({ partial: true }, opts || {}));
    b.pi = 0;
    return !!b.path;
  };
  function follow(a, dt, lookAhead) {
    const b = a.bot;
    if (!b.path || b.pi >= b.path.length) { a.mf = a.mr = 0; return true; }
    let n = b.path[b.pi];
    let dx = n.x - a.pos.x, dz = n.z - a.pos.z;
    while (Math.hypot(dx, dz) < 0.32 && b.pi < b.path.length - 1) { b.pi++; n = b.path[b.pi]; dx = n.x - a.pos.x; dz = n.z - a.pos.z; }
    if (b.pi === b.path.length - 1 && Math.hypot(dx, dz) < 0.3) { b.pi++; a.mf = a.mr = 0; return true; }
    if (lookAhead !== false) { const la = b.path[Math.min(b.path.length - 1, b.pi + 2)]; faceTo(a, V().set(la.x, a.pos.y + a.eyeH - 0.05, la.z), dt, 6); }
    steer(a, dx, dz);
    // stuck? break what is in front (barricades, soft walls, wire)
    b.stuckT = U.dist2(a.pos, b.lastPos) < 0.3 * dt * 10 ? b.stuckT + dt : 0;
    if (Math.random() < 0.1) b.lastPos.copy(a.pos);
    if (b.stuckT > 0.6) {
      const f = V().set(dx, 0, dz).normalize();
      if (breakThrough(a, f)) b.stuckT = 0.1;
      else if (b.stuckT > 2) { b.path = null; b.goal = null; b.stuckT = 0; a.mr = Math.random() < 0.5 ? 1 : -1; }
    }
    return false;
  }
  /* smash barricades / soft clutter in the body-sized box ahead */
  function breakThrough(a, f) {
    if ((a.meleeT || 0) > G.time) return true;
    const W = G.world, p = a.pos;
    const x0 = Math.floor((p.x + Math.min(0, f.x * 0.75) - 0.3) * 4), x1 = Math.floor((p.x + Math.max(0, f.x * 0.75) + 0.3) * 4);
    const z0 = Math.floor((p.z + Math.min(0, f.z * 0.75) - 0.3) * 4), z1 = Math.floor((p.z + Math.max(0, f.z * 0.75) + 0.3) * 4);
    const y0 = Math.floor(p.y * 4), y1 = y0 + 7;
    let any = false;
    for (let y = y0; y <= y1 && !any; y++) for (let z = z0; z <= z1 && !any; z++) for (let x = x0; x <= x1; x++) { const m = W.get(x, y, z); if (m && MAT[m].melee) { any = true; break; } }
    if (!any) return false;
    a.yaw = Math.atan2(-f.x, -f.z); a.pitch = -0.2;
    a.meleeT = G.time + 0.8;
    const n = W.carve(x0, y0, z0, x1, y1, z1, md => md.melee, 10);
    SFX.wood(V().set(p.x + f.x * 0.5, p.y + 1, p.z + f.z * 0.5), true); GAME.noise(p, 18, a, 'breach');
    if (a.isPlayer === false && a.rig) a.busy = 0.3;
    return n > 0;
  }

  /* ---------------------------------------------------------- perception */
  function canSee(a, t, e) {
    const tp = t.isActor ? null : t.pos;
    const c = tp ? tp : (t.state === 'dbno' || t.stance === 2 ? t.center(V()) : t.eye(V()));
    const d = U.dist3(e, c);
    if (d > 70) return null;
    const f = a.fwd(V()), to = c.clone().sub(e).normalize();
    const dot = to.dot(f);
    if (dot < 0.25 && d > 3.5) return null;
    if (a.blind > 0.4 && a.blindK > 0.4) return null;
    if (!G.world.los(e, c)) {
      if (tp) return null;
      const cc = t.center(V()); if (!G.world.los(e, cc)) return null;
      if (FX.smokeBlocks(e, cc)) return null;
      return cc;
    }
    if (FX.smokeBlocks(e, c)) return null;
    // far + dark + crouched in shadow: harder to notice
    return c;
  }
  function perceive(a) {
    const b = a.bot, e = a.eye(V());
    let best = null, bd = 1e9, bp = null;
    const prep = GAME.phase === 'prep' && G.mode === 'match';
    for (const t of G.actors) {
      if (t.team === a.team || t.state === 'dead' || t.hostage || t.dummy) continue;
      if (prep && t.side === 'atk') continue;   // attackers are droning, not on the field
      t.isActor = true;
      const p = canSee(a, t, e); if (!p) continue;
      let d = U.dist3(e, p);
      if (t === b.target) d *= 0.6;
      if (t.state === 'dbno') d *= 1.8;
      if (d < bd) { bd = d; best = t; bp = p; }
    }
    // drones are targets for defenders
    if (!best && a.side === 'def') for (const t of G.ents) {
      if (!t.alive || t.type !== 'drone' || t.team === a.team) continue;
      if (U.dist3(e, t.pos) > 20) continue;
      const p = canSee(a, t, e); if (p) { best = t; bp = p; bd = U.dist3(e, p); break; }
    }
    if (best) {
      if (best !== b.target) {
        const d = diff();
        b.reactT = d.react * U.rnd(0.75, 1.3) * (b.alert > 0 ? 0.65 : 1) * (best.isActor ? 1 : 1.4);
        b.errY = U.rnd(-1, 1) * d.aimErr * 2.2 * D2R; b.errP = U.rnd(-1, 1) * d.aimErr * 1.4 * D2R;
        b.wantHead = Math.random() < d.head;
        b.target = best; b.burst = 0;
      }
      b.lastSeen = (best.pos || bp).clone(); b.lastSeenT = G.time; b.seenP = bp; b.alert = 6;
      if (best.isActor && G.time > (b.calloutT || 0)) { b.calloutT = G.time + 1.5; GAME.intel(best, a.team, 20); }
    } else if (b.target && (G.time - b.lastSeenT > 0.4)) { b.target = null; }
    // enemy gadgets worth shooting
    b.entTarget = null;
    if (!best && a.wpn && a.side === 'atk' || !best && a.side === 'def') {
      for (const g of G.ents) {
        if (!g.alive || g.team === a.team || g.team < 0 || g.bulletproof || !GAD.TRAPS.has(g.type) && g.type !== 'drone' && g.type !== 'photon' && g.type !== 'beacon' && g.type !== 'claymore') continue;
        if (g.type === 'drone' && a.side === 'atk') continue;
        const d = U.dist3(e, g.pos); if (d > 14) continue;
        const to = g.pos.clone().sub(e).normalize(); if (to.dot(a.fwd(V())) < 0.5) continue;
        if (!G.world.los(e, g.pos)) continue;
        b.entTarget = g; break;
      }
    }
  }
  AI.hear = function (a, pos, type, src, fake) {
    const b = a.bot; if (!b || a.state !== 'alive') return;
    b.alert = Math.max(b.alert, type === 'shot' || type === 'explosion' ? 5 : 2.5);
    if (b.target) return;
    const start = b.heard && G.time - b.heard.t < 3 ? b.heard.start : G.time;
    b.heard = { pos: pos.clone(), t: G.time, type, fake, start };
  };
  /* should this bot walk over to a sound? */
  function chases(a, h) {
    const b = a.bot;
    if (G.time < (b.deafUntil || 0)) return false;
    if (a.carry) return false;
    if (G.time - h.start > 9) { b.deafUntil = G.time + 6; b.heard = null; return false; }
    if (a.side === 'def') return b.role === 'roam';
    return (h.type === 'shot' || h.type === 'explosion') && U.dist3(h.pos, a.pos) < 22;
  }

  /* ------------------------------------------------------------- combat */
  function engage(a, dt) {
    const b = a.bot, t = b.target, d = diff();
    const tgtPos = b.seenP || (t.pos ? t.pos : t.eye(V()));
    let aim;
    if (t.isActor) {
      if (t.state === 'dbno' || t.stance === 2) aim = t.center(V());
      else aim = b.wantHead ? t.eye(V()).add(V().set(0, 0.02, 0)) : t.center(V()).add(V().set(0, 0.25, 0));
      // lead a little
      aim.addScaledVector(t.vel, 0.05);
    } else aim = t.pos.clone();
    // error decays toward a residual wobble
    b.errY *= Math.exp(-dt * 1.4); b.errP *= Math.exp(-dt * 1.4);
    const wob = d.aimErr * 0.35 * D2R;
    const e = a.eye(V());
    const dx = aim.x - e.x, dy = aim.y - e.y, dz = aim.z - e.z, dist = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(-dx, -dz) + b.errY + Math.sin(G.time * 3.1 + a.id) * wob;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + b.errP + Math.sin(G.time * 2.3 + a.id * 2) * wob * 0.6;
    const k = 1 - Math.exp(-d.track * dt * (a.stun > 0 ? 0.4 : 1));
    a.yaw += U.wrap(yaw - a.yaw) * k; a.pitch += (pitch - a.pitch) * k;
    const off = Math.abs(U.wrap(yaw - a.yaw)) + Math.abs(pitch - a.pitch);
    b.reactT -= dt;
    a.adsWant = dist > 6 && !a.shieldOp;
    b.extraSpread = a.blind > 0 ? 4 : 0;
    // fire control
    let fire = b.reactT <= 0 && off < Math.max(0.035, 0.5 / Math.max(1, dist));
    if (t.isActor && t.hostage) fire = false;
    const w = a.wpn;
    if (fire && w && w.def.auto && dist > 14) {
      b.burst += dt; if (b.burst > 0.45) { fire = false; if (b.burst > 0.75) b.burst = 0; }
    }
    a.trigger = fire && !(a.ability && a.ability.on);
    if (!w.def.auto && a.trigger && Math.random() < 0.35) a.trigger = false; // tap fire
    // movement while fighting
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeT = U.rnd(0.35, 1.1); b.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.25) b.strafeDir = 0; }
    const pushing = a.side === 'atk' && dist > 8 && b.role !== 'hold';
    a.mr = b.strafeDir * (dist < 3 ? 1 : 0.7);
    a.mf = pushing ? 0.5 : 0;
    a.sprint = false;
    if (dist > 12 && a.stance === 0 && Math.random() < dt * 0.4 && !a.shieldOp) a.setStance(1);
    if (dist < 6 && a.stance === 1 && Math.random() < dt) a.setStance(0);
    if (w.mag === 0 && w.reserve === 0 && a.w[1]) WPN.swap(a, 1);
  }

  /* --------------------------------------------------------------- tasks */
  /* do a timed task standing at `at` facing `look` */
  function runTask(a, dt) {
    const b = a.bot, tk = b.task;
    if (!tk) return false;
    if (tk.at && U.dist2(a.pos, tk.at) > (tk.r || 0.45)) {
      if (!b.goal || b.goalKind !== 'task' || U.dist3(b.goal, tk.at) > 0.3) { if (!AI.moveTo(a, tk.at, 'task')) { b.task = null; return false; } }
      follow(a, dt);
      a.sprint = GAME.phase === 'prep' || U.dist2(a.pos, tk.at) > 8;
      tk.travel = (tk.travel || 0) + dt;
      if (tk.travel > 25) { b.task = null; }
      return true;
    }
    a.mf = a.mr = 0; a.sprint = false;
    if (tk.look) faceTo(a, tk.look, dt, 10);
    b.taskT += dt;
    if (b.taskT >= (tk.time || 0.5)) {
      b.taskT = 0;
      try { tk.run && tk.run(a); } catch (e) { console.warn('task failed', e); }
      b.task = null;
    }
    return true;
  }
  function nextTask(a) { const b = a.bot; if (!b.task && b.tasks.length) { b.task = b.tasks.shift(); b.taskT = 0; } return b.task; }

  /* ---------------------------------------------------------- main update */
  AI.update = function (a, dt) {
    const b = a.bot; if (!b || a.dummy) return;
    a.trigger = false; a.adsWant = false; a.leanT = 0;
    if (a.state === 'dbno') { a.mf = a.mr = 0; return; }
    if (a.state !== 'alive') return;
    b.alert = Math.max(0, b.alert - dt);
    b.think -= dt;
    if (b.think <= 0) { b.think = 0.12 + Math.random() * 0.08; perceive(a); }
    const phase = GAME.phase;
    if (phase === 'prep' && a.side === 'atk') { a.mf = a.mr = 0; return; }
    if (phase === 'post' || phase === 'end') { a.mf = a.mr = 0; return; }
    // utility & abilities
    AI.useKit(a, dt);
    // fight
    if (b.target && (b.target.isActor ? b.target.state !== 'dead' : b.target.alive)) {
      if (b.task && b.task.critical && b.taskT > 0) { /* finish planting etc. */ }
      else { engage(a, dt); b.task && (b.task.travel = 0); return; }
    }
    a.sprint = false;
    // shoot gadgets
    if (b.entTarget && b.entTarget.alive) {
      const off = faceTo(a, b.entTarget.pos, dt, 7);
      a.mf = a.mr = 0;
      if (off < 0.06) a.trigger = true;
      return;
    }
    // reload in a lull
    const w = a.wpn;
    if (w && w.mag < w.def.mag * 0.4 && w.reserve > 0 && w.reload <= 0) WPN.reload(a);
    if (w && w.mag === 0 && w.reserve === 0 && a.cur === 0 && a.w[1]) WPN.swap(a, 1);
    // revive a downed friend nearby
    if (!b.task || !b.task.critical) {
      const down = G.actors.find(t => t.team === a.team && t.state === 'dbno' && !t.hostage && U.dist3(t.pos, a.pos) < 14 && !G.actors.some(o => o !== a && o.bot && o.bot.task && o.bot.task.reviving === t));
      if (down && (!b.task || !b.task.reviving)) {
        b.task = { at: down.pos.clone(), r: 0.9, look: down.pos.clone(), time: 5, reviving: down, critical: true, run: () => { if (down.state === 'dbno') down.revive(a); } };
        b.taskT = 0;
      }
    }
    if (b.task || nextTask(a)) { if (runTask(a, dt)) return; }
    // job from the team plan
    AI.job(a, dt);
  };

  /* what to do with no enemy in sight and no task */
  AI.job = function (a, dt) {
    const b = a.bot, plan = AI.teams[a.team] || {};
    // investigate recent sounds
    if (b.heard && G.time - b.heard.t < 6 && U.dist3(b.heard.pos, a.pos) > 2 && chases(a, b.heard)) {
      if (!b.goal || b.goalKind !== 'heard' || U.dist3(b.goal, b.heard.pos) > 2) AI.moveTo(a, b.heard.pos, 'heard');
      if (follow(a, dt)) { b.heard = null; b.deafUntil = G.time + 3; }
      return;
    }
    if (b.heard && a.side === 'def' && b.role !== 'roam' && G.time - b.heard.t < 3) { faceTo(a, b.heard.pos.clone().setY(a.pos.y + 1.5), dt, 4); a.mf = a.mr = 0; return; }
    // last seen enemy: attackers push it, defenders recheck it if roaming
    if (b.lastSeen && G.time - b.lastSeenT < 8 && G.time - b.lastSeenT > 1.2 && !a.carry && (a.side === 'atk' || b.role === 'roam')) {
      if (!b.goal || b.goalKind !== 'last') AI.moveTo(a, b.lastSeen, 'last');
      if (follow(a, dt)) b.lastSeen = null;
      return;
    }
    const goal = plan.goalFor ? plan.goalFor(a) : null;
    if (!goal) { a.mf = a.mr = 0; return; }
    if (goal.pos) {
      const close = U.dist2(a.pos, goal.pos) < (goal.r || 0.5) && Math.abs(a.pos.y - goal.pos.y) < 1.2;
      if (!close) {
        if (!b.goal || U.dist3(b.goal, goal.pos) > 0.6 || b.goalKind !== goal.kind) AI.moveTo(a, goal.pos, goal.kind);
        b.repathT += dt; if (b.repathT > 5) { b.goal = null; }
        follow(a, dt);
        a.sprint = !!goal.sprint && !b.alert;
        if (b.alert > 0 && a.side === 'atk') a.sprint = false;
        return;
      }
      a.mf = a.mr = 0;
      if (goal.look) faceTo(a, goal.look, dt, 4);
      if (goal.act) goal.act(a, dt);
      if (goal.crouch && a.stance === 0) a.setStance(1);
    }
  };

  /* ------------------------------------------------------- kit usage */
  AI.useKit = function (a, dt) {
    const b = a.bot; b.util -= dt;
    if (b.util > 0 || GAME.phase !== 'action') return;
    b.util = 1 + Math.random();
    const ab = a.ability, g = a.gadget;
    const plan = AI.teams[a.team] || {};
    const obj = plan.objCenter;
    const nearObj = obj && U.dist3(a.pos, obj) < 18;
    // Vesper sonar
    if (ab && ab.id === 'sonar' && ab.cd <= 0 && nearObj) GAD.ability(a);
    // throw a grenade at a recently seen enemy behind cover
    if (g && g.count > 0 && b.lastSeen && G.time - b.lastSeenT > 1 && G.time - b.lastSeenT < 5 && !b.target) {
      const d = U.dist3(a.pos, b.lastSeen);
      if (d > 4 && d < 16 && ['frag', 'stun', 'impact', 'c4'].includes(g.id) && Math.random() < 0.35) {
        lobAt(a, b.lastSeen); GAD.secondary(a); if (g.id === 'c4') setTimeout(() => GAD.secondary(a), 1600); return;
      }
    }
    if (ab && ab.count > 0 && b.lastSeen && G.time - b.lastSeenT < 5 && !b.target) {
      const d = U.dist3(a.pos, b.lastSeen);
      if ((ab.id === 'incendiary' || ab.id === 'photon') && d > 4 && d < 14 && Math.random() < 0.3) { lobAt(a, b.lastSeen); GAD.ability(a); return; }
    }
    // attacker utility before entering the objective
    if (a.side === 'atk' && obj && nearObj && !b.target) {
      const d = U.dist3(a.pos, obj);
      if (g && g.count > 0 && (g.id === 'stun' || g.id === 'frag') && d > 5 && d < 12 && Math.random() < 0.2 && G.world.los(a.eye(V()), obj.clone().setY(obj.y + 1))) { lobAt(a, obj); GAD.secondary(a); return; }
      if (ab && ab.id === 'smokegl' && ab.count > 0 && plan.planting && Math.random() < 0.4) { lobAt(a, obj, true); GAD.ability(a); return; }
      if (g && g.id === 'smoke' && g.count > 0 && plan.planting && Math.random() < 0.4) { lobAt(a, obj); GAD.secondary(a); return; }
      if (ab && ab.id === 'beacon' && ab.count > 0 && d < 6) { GAD.ability(a); return; }
      if (ab && ab.id === 'photon' && ab.count > 0 && d < 10 && Math.random() < 0.3) { lobAt(a, obj); GAD.ability(a); return; }
    }
  };
  function lobAt(a, p, direct) {
    const e = a.eye(V()), dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    a.yaw = Math.atan2(-dx, -dz);
    a.pitch = direct ? Math.atan2(p.y + 0.5 - e.y, d) : U.clamp(Math.atan2(p.y + 1 - e.y, d) + d * 0.025, -0.6, 0.9);
  }
  AI.lobAt = lobAt;

  /* ====================================================== round planning */
  AI.roundStart = function () {
    AI.teams = {};
    const obj = GAME.obj;
    for (const team of [0, 1]) {
      const side = GAME.sideOf(team), bots = G.actors.filter(a => a.team === team && a.bot);
      const plan = AI.teams[team] = { side, bots };
      if (side === 'def') planDefense(plan, bots, obj); else planAttack(plan, bots, obj);
    }
  };
  AI.actionStart = function () {
    for (const team of [0, 1]) {
      const plan = AI.teams[team]; if (!plan) continue;
      plan.bots = plan.bots.filter(a => a.bot);
      if (plan.side === 'atk') {
        // simulated drone intel
        for (const a of plan.bots) if (Math.random() < 0.45) {
          const defs = G.actors.filter(t => t.team !== team && t.alive && !t.hostage);
          if (defs.length) GAME.mark(U.pick(defs), team, 5, true);
        }
        // Static zaps from his drone
        for (const a of plan.bots) if (a.ability && a.ability.id === 'surge') {
          const els = G.ents.filter(e => e.alive && e.elec && e.team !== a.team && plan.objCenter && U.dist3(e.pos, plan.objCenter) < 14);
          for (let i = 0; i < Math.min(2, els.length); i++) { els[i].destroy('surge'); a.ability.zaps--; }
        }
        for (const a of plan.bots) planAttackKit(a, plan);
      } else {
        for (const a of plan.bots) if (a.ability && a.ability.id === 'decoy' && plan.entries && plan.entries.length) {
          const op = U.pick(plan.entries); const c = GAD.opCenter(op);
          a.bot.tasks.push({ at: NAV.randomIn(plan.rooms[0]), look: c, time: 0.4, run: b => { lobAt(b, c); GAD.ability(b); } });
        }
      }
    }
  };

  function roomOpenings(room) {
    return G.map.openings.filter(op => op.L === room.L && (
      (op.axis === 'z' && (op.line === room.z0 - 1 || op.line === room.z1 + 1) && op.a1 >= room.x0 && op.a0 <= room.x1) ||
      (op.axis === 'x' && (op.line === room.x0 - 1 || op.line === room.x1 + 1) && op.a1 >= room.z0 && op.a0 <= room.z1)));
  }
  AI.roomOpenings = roomOpenings;
  /* soft wall panels around a room (for reinforcement) */
  function roomPanels(room) {
    const W = G.world, out = [], ops = roomOpenings(room);
    const blockedBy = (axis, line, a0, a1) => ops.some(op => op.axis === axis && op.line === line && op.a1 >= a0 - 1 && op.a0 <= a1 + 1);
    const edges = [['z', room.z0 - 1, room.x0, room.x1, 1], ['z', room.z1 + 1, room.x0, room.x1, -1], ['x', room.x0 - 1, room.z0, room.z1, 1], ['x', room.x1 + 1, room.z0, room.z1, -1]];
    for (const [axis, line, lo, hi, inward] of edges) {
      for (let a = lo; a + 6 <= hi; a += 7) {
        if (blockedBy(axis, line, a, a + 6)) continue;
        let soft = 0, n = 0;
        for (let y = room.y; y <= room.y + 10; y += 2) for (let k = a; k <= a + 6; k += 2) {
          const m = axis === 'z' ? W.get(k, y, line) : W.get(line, y, k); n++;
          if (m && MAT[m].wall && !MAT[m].reinf) soft++;
        }
        if (soft < n * 0.8) continue;
        const mid = (a + 3.5) * 0.25, l = (line + 0.5) * 0.25;
        const stand = axis === 'z' ? V().set(mid, room.fy, l + inward * 0.9) : V().set(l + inward * 0.9, room.fy, mid);
        const look = axis === 'z' ? V().set(mid, room.fy + 1.2, l) : V().set(l, room.fy + 1.2, mid);
        out.push({ axis, line, a0: a, a1: a + 6, y0: room.y, y1: room.y + 10, stand, look, room, ext: line === room.z0 - 1 || line === room.z1 + 1 ? 0 : 0 });
      }
    }
    return out;
  }
  AI.roomPanels = roomPanels;

  function planDefense(plan, bots, obj) {
    const rooms = obj.rooms;
    plan.rooms = rooms;
    plan.objCenter = V().set(rooms[0].cx, rooms[0].fy, rooms[0].cz);
    const entries = []; for (const r of rooms) entries.push(...roomOpenings(r));
    plan.entries = entries;
    const panels = []; for (const r of rooms) panels.push(...roomPanels(r));
    U.shuffle(panels);
    // hatches over the objective
    const hatches = G.map.hatches.filter(h => rooms.some(r => h.L === r.L + 1 && h.x >= r.x0 - 2 && h.x <= r.x1 && h.z >= r.z0 - 2 && h.z <= r.z1));
    // roles: 1-2 roamers, rest anchors
    U.shuffle(bots);
    bots.forEach((a, i) => { a.bot.role = (i < 2 && bots.length >= 4 && !['anvil', 'brick', 'tamsin'].includes(a.op.id)) || (i < 1 && bots.length >= 2) ? 'roam' : 'anchor'; a.bot.tasks = []; });
    if (bots.length && !bots.some(a => a.bot.role === 'anchor')) bots[bots.length - 1].bot.role = 'anchor';
    // reinforcements
    let pi = 0;
    const workers = bots.slice();
    for (const h of hatches) { const a = workers[pi++ % workers.length]; if (!a) break; const room = rooms.find(r => h.L === r.L + 1) || rooms[0]; const stand = V().set((h.x + 2) * 0.25, h.L * 3 + 0.25, (h.z + 2) * 0.25); a.bot.tasks.push({ at: stand, look: stand.clone().setY(stand.y - 0.5), time: 3, run: () => GAME.reinforceHatch(h, a) }); }
    for (const p of panels) { const a = workers[pi++ % workers.length]; if (!a) break; a.bot.tasks.push({ at: p.stand, look: p.look, time: a.op.id === 'brick' ? 1.8 : 3.2, run: () => GAME.reinforcePanel(p, a) }); }
    // gadgets next, then barricades on every entry
    for (const a of bots) planDefKit(a, plan);
    let bi = 0;
    for (const op of entries) {
      if (op.kind === 'shutter') continue;
      const a = workers[bi++ % workers.length]; if (!a) break;
      const c = GAD.opCenter(op), inward = V();
      const r = rooms.find(rr => rr.L === op.L) || rooms[0];
      inward.set(r.cx - c.x, 0, r.cz - c.z); if (op.axis === 'z') inward.x = 0; else inward.z = 0; inward.normalize();
      const stand = c.clone().addScaledVector(inward, 0.9); stand.y = r.fy;
      a.bot.tasks.push({ at: stand, look: c, time: 1.2, run: () => { GAD.barricade(op); SFX.wood(c); } });
    }
    // where to stand afterwards
    plan.goalFor = a => defGoal(a, plan);
  }
  function anchorSpot(a, plan) {
    const b = a.bot;
    if (b.hold && b.holdRoom) return b.hold;
    const r = U.pick(plan.rooms);
    let best = null, bs = -1e9;
    const ents = roomOpenings(r);
    for (let i = 0; i < 10; i++) {
      const p = NAV.randomIn(r);
      // prefer spots away from entries with a view of one
      let s = 0;
      for (const op of ents) { const c = GAD.opCenter(op); const d = U.dist2(c, p); s += Math.min(d, 6) * 0.4; if (G.world.los(p.clone().setY(p.y + 1.5), c)) s += 1; }
      s += Math.random();
      if (s > bs) { bs = s; best = p; }
    }
    b.hold = best; b.holdRoom = r;
    const op = ents.length ? U.pick(ents) : null;
    b.holdLook = op ? GAD.opCenter(op) : V().set(r.cx, r.fy + 1.4, r.cz);
    return best;
  }
  function defGoal(a, plan) {
    const b = a.bot;
    // defuser planted: go disable it
    if (GAME.obj.defuser && GAME.obj.defuser.alive) {
      const d = GAME.obj.defuser;
      return { pos: d.pos, r: 1.0, kind: 'defuse', sprint: true, look: d.pos, act: (x) => GAME.tryInteract(x, 'disable') };
    }
    if (b.role === 'roam') {
      if (!b.roamGoal || U.dist2(a.pos, b.roamGoal) < 1 || G.time > (b.roamUntil || 0)) {
        const rs = G.map.rooms.filter(r => Math.abs(r.L - plan.rooms[0].L) <= 1 && !plan.rooms.includes(r) && !/Stairs/.test(r.name));
        const r = U.pick(rs.length ? rs : G.map.rooms);
        b.roamGoal = NAV.randomIn(r); b.roamUntil = G.time + U.rnd(12, 25);
      }
      return { pos: b.roamGoal, r: 0.8, kind: 'roam', look: b.roamGoal.clone().add(V().set(Math.sin(G.time * 0.5 + a.id) * 3, 1.4, Math.cos(G.time * 0.5 + a.id) * 3)) };
    }
    if (GAME.mode === 'hostage' && GAME.obj.hostage && GAME.obj.hostage.followTarget) {
      return { pos: GAME.obj.hostage.pos, r: 3, kind: 'chase', sprint: true };
    }
    const p = anchorSpot(a, plan);
    return { pos: p, r: 0.6, kind: 'hold', look: b.holdLook, crouch: Math.random() < 0.002 };
  }
  function planDefKit(a, plan) {
    const id = a.ability ? a.ability.id : null, r = plan.rooms[0], b = a.bot;
    const ents = plan.entries, inner = () => NAV.randomIn(U.pick(plan.rooms));
    const place = (n, fn) => { for (let i = 0; i < n; i++) b.tasks.push(fn(i)); };
    const atEntry = (i, fn, time) => { const op = ents[i % Math.max(1, ents.length)]; if (!op) return null; const c = GAD.opCenter(op); const rr = plan.rooms.find(x => x.L === op.L) || r; const inw = V().set(rr.cx - c.x, 0, rr.cz - c.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; inw.normalize(); const st = c.clone().addScaledVector(inw, 1.1); st.y = rr.fy; return { at: st, look: c, time: time || 0.8, run: x => fn(x, op, st, inw, c) }; };
    switch (id) {
      case 'snare': place(Math.min(4, ents.length), i => atEntry(i, (x, op) => GAD.snareAt(x, op)) || { time: 0 }); a.ability.count = 0; break;
      case 'sensor': place(4, i => atEntry(i + 1, (x, op, st, inw, c) => { GAD.deployAt(x, 'sensor', c.clone().addScaledVector(inw, 0.6).setY(c.y + 0.9), inw.clone()); x.ability.count--; }) || { time: 0 }); break;
      case 'scrambler': place(3, i => { const p = inner(); return { at: p, time: 0.6, run: x => { GAD.deployAt(x, 'scrambler', p.clone().setY(p.y + 0.01)); x.ability.count--; } }; }); break;
      case 'seeker': place(2, i => { const p = inner(); return { at: p, time: 0.6, run: x => { GAD.deployAt(x, 'seeker', p.clone()); x.ability.count--; } }; }); break;
      case 'medstation': { const p = inner(); b.tasks.push({ at: p, time: 0.6, run: x => { GAD.deployAt(x, 'medstation', p.clone(), null, x.yaw); x.ability.count--; } }); break; }
      case 'bpcam': place(2, i => { const p = inner(); return { at: p, time: 0.6, run: x => { GAD.deployAt(x, 'bpcam', p.clone().setY(p.y + 2.3), null, x.yaw); x.ability.count--; } }; }); break;
      case 'bunker': { const op = ents.find(o => o.kind === 'door'); if (op) b.tasks.push(atEntry(ents.indexOf(op), (x, o) => { let n = 0; GAD.opCells(o, (X, Y, Z) => { const m = G.world.get(X, Y, Z); if (!m || m === M.BARR || m === M.GLASS) { G.world.set(X, Y, Z, M.REINF); n++; } }); x.ability.count--; SFX.metal(o.c || GAD.opCenter(o)); }, 1.5)); break; }
      case 'dampener': plan.wantDampener = a; break;
      case 'rcharge': {
        // open a rotation hole from the site into a neighbour
        const pan = AI.roomPanels(r)[0];
        if (pan) b.tasks.push({ at: pan.stand, look: pan.look, time: 1, run: x => { const W = G.world, mid = (pan.a0 + pan.a1) >> 1; if (pan.axis === 'z') W.carve(mid - 2, pan.y0, pan.line, mid + 2, pan.y0 + 7, pan.line, md => md.xp, 20); else W.carve(pan.line, pan.y0, mid - 2, pan.line, pan.y0 + 7, mid + 2, md => md.xp, 20); SFX.explosion(pan.look, false); FX.explosion(pan.look, 1); x.ability.count--; } });
        break;
      }
    }
    // secondary gadgets
    const g = a.gadget;
    if (g) {
      if (g.id === 'wire') place(g.count, i => atEntry(i + 2, (x, op, st, inw, c) => { const p = c.clone().addScaledVector(inw, -1.4); p.y = G.world.groundBelow(p.x, c.y + 0.5, p.z) + 0.01; if (Math.abs(p.y - st.y) < 0.6) { GAD.deployAt(x, 'wire', p, null, op.axis === 'z' ? 0 : Math.PI / 2); x.gadget.count--; } }) || { time: 0 });
      if (g.id === 'dshield') { const p = inner(); b.tasks.push({ at: p, time: 0.6, run: x => { const op = U.pick(ents); const yaw = op ? Math.atan2(-(GAD.opCenter(op).x - p.x), -(GAD.opCenter(op).z - p.z)) : 0; const f = V().set(-Math.sin(yaw), 0, -Math.cos(yaw)); GAD.deployAt(x, 'dshield', p.clone().addScaledVector(f, 0.6), null, yaw); x.gadget.count--; } }); }
    }
  }
  /* finish placing dampeners once walls are reinforced (end of prep) */
  AI.lateDefense = function () {
    for (const team of [0, 1]) {
      const plan = AI.teams[team]; if (!plan || plan.side !== 'def' || !plan.wantDampener) continue;
      const a = plan.wantDampener; if (!a.alive) continue;
      const panels = GAME.reinforced.filter(p => plan.rooms.includes(p.room));
      for (let i = 0; i < Math.min(a.ability.count, panels.length); i++) {
        const p = panels[i], n = V().copy(p.stand).sub(p.look).setY(0).normalize();
        GAD.deployAt(a, 'dampener', p.look.clone().addScaledVector(n, 0.16), n);
        a.ability.count--;
      }
    }
  };

  function planAttack(plan, bots, obj) {
    const rooms = obj.rooms;
    plan.rooms = rooms;
    const r = rooms[0];
    plan.objCenter = V().set(r.cx, r.fy, r.cz);
    U.shuffle(bots);
    bots.forEach((a, i) => { a.bot.role = i === 0 ? 'lead' : i % 2 ? 'entry' : 'flank'; a.bot.tasks = []; a.bot.delay = i * U.rnd(2, 5); });
    if (GAME.mode === 'bomb') plan.carrier = bots.find(a => a.carry === 'defuser') || null;
    plan.goalFor = a => atkGoal(a, plan);
  }
  function planAttackKit(a, plan) {
    const b = a.bot, r = plan.rooms[0];
    const id = a.ability ? a.ability.id : null;
    // hard breach a reinforced site wall from outside
    if (id === 'bore') {
      const pans = GAME.reinforced.filter(p => plan.rooms.includes(p.room));
      for (const p of U.shuffle(pans.slice())) {
        const out = p.look.clone().addScaledVector(V().copy(p.look).sub(p.stand).setY(0).normalize(), 0.9); out.y = p.room.fy;
        if (!NAV.walkable(out)) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 0.8) continue;
        b.tasks.push({ at: out, look: p.look, time: 0.8, run: x => { x.pitch = 0; faceTo(x, p.look, 1, 99); GAD.ability(x); } });
        b.tasks.push({ at: out.clone().addScaledVector(V().copy(p.stand).sub(p.look).setY(0).normalize(), -1.6), time: 6 });
        break;
      }
    }
    // soft breach into the site
    const soft = id === 'rivet' || id === 'spike' || (a.gadget && a.gadget.id === 'breach');
    if (soft) {
      const pans = AI.roomPanels(r).filter(p => !GAME.reinforced.includes(p));
      for (const p of U.shuffle(pans.slice())) {
        const out = p.look.clone().addScaledVector(V().copy(p.look).sub(p.stand).setY(0).normalize(), 1.0); out.y = r.fy;
        if (!NAV.walkable(out)) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 0.8) continue;
        if (id === 'rivet' || id === 'spike') b.tasks.push({ at: out, look: p.look, time: 0.6, run: x => { faceTo(x, p.look, 1, 99); GAD.ability(x); } });
        else b.tasks.push({ at: out, look: p.look, time: 0.8, run: x => { faceTo(x, p.look, 1, 99); if (GAD.secondary(x)) setTimeout(() => { if (x.alive) GAD.secondary(x); }, 1500); } });
        b.tasks.push({ at: out.clone().addScaledVector(V().copy(p.stand).sub(p.look).setY(0).normalize(), -1.4), time: 2 });
        break;
      }
    }
  }
  function atkGoal(a, plan) {
    const b = a.bot, obj = GAME.obj;
    if (b.delay > 0) { b.delay -= 0.016; }
    const R = plan.rooms;
    // bomb: carrier plants; others clear site
    if (GAME.mode === 'bomb') {
      if (obj.defuser && obj.defuser.alive) {
        if (!b.guard || U.dist3(b.guard, obj.defuser.pos) > 8) b.guard = NAV.randomIn(obj.defuser.siteRoom || R[0]);
        return { pos: b.guard, r: 0.8, kind: 'guard', look: obj.defuser.pos.clone().add(V().set(Math.sin(a.id) * 6, 1.4, Math.cos(a.id) * 6)), crouch: true };
      }
      if (obj.dropped && obj.dropped.alive && (!obj.carrier || obj.carrier.state !== 'alive')) return { pos: obj.dropped.pos, r: 0.6, kind: 'pickup', sprint: true, act: x => GAME.tryInteract(x, 'pickup') };
      if (a.carry === 'defuser') {
        const site = R.find(rr => GAME.siteRooms.includes(rr)) || R[0];
        if (!b.plantSpot || b.plantRoom !== site) { b.plantSpot = NAV.randomIn(site); b.plantRoom = site; }
        plan.planting = U.dist2(a.pos, b.plantSpot) < 4;
        return { pos: b.plantSpot, r: 0.7, kind: 'plant', act: x => GAME.tryInteract(x, 'plant') };
      }
    }
    if (GAME.mode === 'hostage' && obj.hostage) {
      const h = obj.hostage;
      if (h.state !== 'dead' && !h.followTarget) {
        const carrierAlive = plan.hostageCarrier && plan.hostageCarrier.alive && plan.hostageCarrier.carry === h;
        if (!carrierAlive) { plan.hostageCarrier = a; }
        if (plan.hostageCarrier === a) return { pos: h.pos, r: 1.0, kind: 'grab', act: x => GAME.tryInteract(x, 'hostage') };
      }
      if (a.carry === h) {
        const ex = GAME.nearestExtract(a.pos);
        return { pos: ex, r: 1.2, kind: 'extract', sprint: false };
      }
      if (h.followTarget) return { pos: h.followTarget.pos.clone().add(V().set(Math.sin(a.id * 2) * 2, 0, Math.cos(a.id * 2) * 2)), r: 1.5, kind: 'escort' };
    }
    if (!b.atkSpot || G.time > (b.atkUntil || 0)) {
      const rr = U.pick(R); b.atkSpot = NAV.randomIn(rr); b.atkUntil = G.time + U.rnd(15, 30);
    }
    return { pos: b.atkSpot, r: 0.8, kind: 'push', sprint: U.dist3(a.pos, b.atkSpot) > 25, look: plan.objCenter.clone().setY(plan.objCenter.y + 1.4) };
  }

  window.AI = AI;
})();
