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
    // defenders in the preparation phase may not leave the building: plan routes that stay in
    const indoors = a.side === 'def' && GAME.phase === 'prep' && G.mode === 'match' && Actor.indoors(a.pos.x, a.pos.y, a.pos.z);
    b.path = NAV.path(a.pos, p, Object.assign({ partial: true, indoors }, opts || {}));
    b.pi = 0;
    return !!b.path;
  };
  /* corners and doorways to check on stepping into a room, swept from one side to the other */
  function clearLooks(a, room, dx, dz) {
    const y = room.fy + 1.5, i = 0.5, out = [];
    const pts = [[room.x0 * 0.25 + i, room.z0 * 0.25 + i], [(room.x1 + 1) * 0.25 - i, room.z0 * 0.25 + i], [room.x0 * 0.25 + i, (room.z1 + 1) * 0.25 - i], [(room.x1 + 1) * 0.25 - i, (room.z1 + 1) * 0.25 - i]];
    for (const op of roomOpenings(room)) { const c = GAD.opCenter(op); if (U.dist2(c, a.pos) > 2) pts.push([c.x, c.z]); }
    const L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
    for (const [x, z] of pts) {
      const ox = x - a.pos.x, oz = z - a.pos.z, d = Math.hypot(ox, oz) || 1;
      const ahead = (ox * fx + oz * fz) / d, side = (ox * fz - oz * fx) / d;
      if (ahead > -0.1 && d > 1.2) out.push({ p: V().set(x, y, z), side });
    }
    out.sort((p, q) => p.side - q.side);
    return out.slice(0, 4).map(o => o.p);
  }
  function follow(a, dt, lookAhead) {
    const b = a.bot;
    if (!b.path || b.pi >= b.path.length) { a.mf = a.mr = 0; return true; }
    let n = b.path[b.pi];
    let dx = n.x - a.pos.x, dz = n.z - a.pos.z;
    while (Math.hypot(dx, dz) < 0.32 && b.pi < b.path.length - 1) { b.pi++; n = b.path[b.pi]; dx = n.x - a.pos.x; dz = n.z - a.pos.z; }
    if (b.pi === b.path.length - 1 && Math.hypot(dx, dz) < 0.3) { b.pi++; a.mf = a.mr = 0; return true; }
    let speed = 1;
    // clear the room: stepping into a new one in the action phase, sweep its corners and other
    // doorways at head height, a little slower, instead of staring down the route
    const fight = GAME.phase === 'action' && !a.sprint;
    const room = G.map.roomAt(a.pos);
    if (room !== b.room) { b.room = room; b.clear = fight && room ? clearLooks(a, room, dx, dz) : null; b.clearT = 0; }
    if (fight && b.clear && b.clear.length && lookAhead !== false) {
      faceTo(a, b.clear[0], dt, 10); speed = 0.65;
      if ((b.clearT += dt) > 0.32) { b.clear.shift(); b.clearT = 0; }
    } else if (lookAhead !== false) { const la = b.path[Math.min(b.path.length - 1, b.pi + 2)]; faceTo(a, V().set(la.x, a.pos.y + a.eyeH - 0.05, la.z), dt, 6); }
    // spacing: ease off rather than walk up a teammate's back, so a team moves as a spread-out
    // group (and one grenade or one spray can't catch them all) instead of a conga line
    const ml = Math.hypot(dx, dz) || 1;
    for (const o of G.actors) {
      if (o === a || o.team !== a.team || o.state !== 'alive' || o.hostage) continue;
      const ox = o.pos.x - a.pos.x, oz = o.pos.z - a.pos.z, d = Math.hypot(ox, oz);
      if (d > 2.4 || d < 0.01 || Math.abs(o.pos.y - a.pos.y) > 1.5) continue;
      if ((ox * dx + oz * dz) / (d * ml) > 0.55) speed = Math.min(speed, U.clamp((d - 0.9) / 1.5, 0.2, 1));
    }
    steer(a, dx, dz, speed);
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
    const hurt = G.time - (b.hurtT || -99) < 2.5;
    for (const t of G.actors) {
      if (t.team === a.team || t.state === 'dead' || t.hostage || t.dummy) continue;
      if (prep && t.side === 'atk') continue;   // attackers are droning, not on the field
      t.isActor = true;
      const p = canSee(a, t, e); if (!p) continue;
      let d = U.dist3(e, p);
      // a target we've already poured shots into for nothing (behind a shield or cover the
      // bullets can't get through) is left alone for a while, unless it's close or hurting us
      if (b.futile && b.futile.get(t) > G.time && d > 6 && !hurt) continue;
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
        if (b.entIgnore && b.entIgnore.get(g) > G.time) continue;   // already tried and missed it
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
    // never shoot through the hostage: a bullet in them loses the round for whoever fired it
    const hz = GAME.obj && GAME.obj.hostage;
    if (fire && hz && hz.state !== 'dead') {
      const hc = hz.center(V()), seg = aim.clone().sub(e), L = seg.length() || 1; seg.divideScalar(L);
      const to = hc.clone().sub(e), along = to.dot(seg);
      const spread = a.wpn && a.wpn.def.pellets > 1 ? 1.4 : 0.75;   // shotgun pellets fan out
      if (along > 0 && along < L + 0.5 && to.addScaledVector(seg, -along).length() < spread) fire = false;
    }
    const w = a.wpn;
    if (fire && w && w.def.auto && dist > 14) {
      b.burst += dt; if (b.burst > 0.45) { fire = false; if (b.burst > 0.75) b.burst = 0; }
    }
    a.trigger = fire && !(a.ability && a.ability.on);
    if (!w.def.auto && a.trigger && Math.random() < 0.35) a.trigger = false; // tap fire
    // is this fight going anywhere? Track the target's health while we shoot at it: several
    // seconds of fire (or a long stare) without denting it means the shots can't reach it, so
    // stop holding this angle and get back to the job instead of trading forever
    const hpOf = x => x.isActor ? x.hp + (x.state === 'dbno' ? 0 : 500) : (x.hp != null ? x.hp : 0);
    if (b.engTgt !== t) { b.engTgt = t; b.engT = 0; b.engFire = 0; b.engHp = hpOf(t); }
    b.engT += dt; if (a.trigger) b.engFire += dt;
    if (hpOf(t) < b.engHp - 0.5) { b.engHp = hpOf(t); b.engFire = 0; b.engT = 0; }
    if ((b.engFire > 3.5 || b.engT > 9) && dist > 6 && G.time - (b.hurtT || -99) > 2.5) {
      (b.futile || (b.futile = new Map())).set(t, G.time + 10);
      b.target = null; b.engTgt = null; a.trigger = false;
      return;
    }
    // movement while fighting
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeT = U.rnd(0.35, 1.1); b.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.25) b.strafeDir = 0; }
    const S = situation(a.team);
    const pushing = a.side === 'atk' && b.role !== 'hold' && (dist > 8 || (dist > 3.5 && (S.late || S.mode === 'hunt')));
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
    if (tk.at && (U.dist2(a.pos, tk.at) > (tk.r || 0.45) || Math.abs(a.pos.y - tk.at.y) > 1.2)) {
      if (!b.goal || b.goalKind !== 'task' || U.dist3(b.goal, tk.at) > 0.3) { if (!AI.moveTo(a, tk.at, 'task')) { b.task = null; return false; } }
      follow(a, dt);
      // the route ran out short of the spot (it's inside furniture, or walled off): if we're
      // beside it, do the job from here; otherwise drop it rather than stand waiting
      if (!b.path || b.pi >= b.path.length) {
        tk.stall = (tk.stall || 0) + dt;
        if (tk.stall > 0.8) {
          if (U.dist3(a.pos, tk.at) < 1.8 && Math.abs(a.pos.y - tk.at.y) < 1.2) { tk.at = null; a.mf = a.mr = 0; return true; }
          b.task = null; return false;
        }
      }
      a.sprint = GAME.phase === 'prep' || U.dist2(a.pos, tk.at) > 8;
      tk.travel = (tk.travel || 0) + dt;
      if (tk.travel > 25) { b.task = null; }
      // still walking but no closer for 4 s (pressed against a wall or furniture short of a spot the
      // route can't really reach): do it from here if close enough, otherwise drop it
      const dd = U.dist3(a.pos, tk.at);
      if (tk.best == null || dd < tk.best - 0.3) { tk.best = dd; tk.noProg = 0; } else tk.noProg = (tk.noProg || 0) + dt;
      if (tk.noProg > 4) {
        if (dd < 1.8 && Math.abs(a.pos.y - tk.at.y) < 1.2) { tk.at = null; a.mf = a.mr = 0; return true; }
        b.task = null; b.goal = null; return false;
      }
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
  /* move a task's standing spot onto the walkable grid in the same room, or report it unreachable */
  function reachable(p, room) {
    const n = NAV.nearest(p, 1.2);
    if (n < 0 || (NAV.main && !NAV.main.has(n))) return null;
    const q = NAV.nodePos(n);
    if (Math.abs(q.y - p.y) > 0.6 || U.dist2(q, p) > 1.1) return null;
    if (room && G.map.roomAt(q) !== room) return null;
    return q;
  }

  /* ---------------------------------------------------------- main update */
  AI.update = function (a, dt) {
    const b = a.bot; if (!b || a.dummy) return;
    a.trigger = false; a.adsWant = false; a.leanT = 0;
    if (a.state === 'dbno') { a.mf = a.mr = 0; return; }
    if (a.state !== 'alive') return;
    if (b.lastHp != null && a.hp < b.lastHp) b.hurtT = G.time;
    b.lastHp = a.hp;
    // a defender caught in irritant haze gets out of it instead of holding the spot
    if (a.side === 'def' && a.hazeT && G.time - a.hazeT < 0.6 && b.hold && U.dist2(a.pos, b.hold) < 4.5) { b.hold = null; b.holdRoom = null; b.goal = null; }
    b.alert = Math.max(0, b.alert - dt);
    b.think -= dt;
    if (b.think <= 0) { b.think = 0.12 + Math.random() * 0.08; perceive(a); }
    const phase = GAME.phase;
    if (phase === 'prep' && a.side === 'atk') { a.mf = a.mr = 0; return; }
    if (phase === 'post' || phase === 'end') { a.mf = a.mr = 0; return; }
    // on a rope or mid-vault through a window: finish getting in first
    if (b.winStep && (a.rappel || a.vault)) { if (windowStep(a, dt)) return; }
    else if (a.rappel) a.ropeLetGo();
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
      // a small gadget (a snare's anchor is 0.1 m across) can soak a whole magazine at range:
      // give it three seconds, then leave it and get on with the job rather than freeze here
      if (b.entShot !== b.entTarget) { b.entShot = b.entTarget; b.entT = 0; }
      b.entT += dt;
      if (b.entT > 3) { (b.entIgnore || (b.entIgnore = new Map())).set(b.entTarget, G.time + 30); b.entTarget = null; b.entShot = null; }
    }
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
    // at the wall under a window entry: vault in, or hook on
    if (b.winStep) { if (windowStep(a, dt)) return; }
    // job from the team plan
    AI.job(a, dt);
  };

  /* what to do with no enemy in sight and no task */
  AI.job = function (a, dt) {
    const b = a.bot, plan = AI.teams[a.team] || {};
    // when the objective needs this bot right now (a planted defuser to disable, a dropped one
    // to pick up, the hostage leaving, the clock running out) it skips every detour below
    const urgent = urgentFor(a);
    // investigate recent sounds
    if (!urgent && b.heard && G.time - b.heard.t < 6 && U.dist3(b.heard.pos, a.pos) > 2 && chases(a, b.heard)) {
      if (!b.goal || b.goalKind !== 'heard' || U.dist3(b.goal, b.heard.pos) > 2) AI.moveTo(a, b.heard.pos, 'heard');
      if (follow(a, dt)) { b.heard = null; b.deafUntil = G.time + 3; }
      return;
    }
    // a defender freezes to listen only once in position: stopping mid-walk for every noise kept
    // anchors standing in the open under steady gunfire. And only for a few seconds at a time:
    // a steady stream of noise used to keep anchors staring at a wall all round
    const freeze = !urgent && b.heard && a.side === 'def' && b.role !== 'roam' && G.time - b.heard.t < 3 && G.time > (b.deafUntil || 0) && (!b.hold || U.dist2(a.pos, b.hold) < 1);
    if (freeze) {
      if (!b.freezeAt) b.freezeAt = G.time;
      if (G.time - b.freezeAt > 4) { b.heard = null; b.freezeAt = 0; b.deafUntil = G.time + 8; }
      else { faceTo(a, b.heard.pos.clone().setY(a.pos.y + 1.5), dt, 4); a.mf = a.mr = 0; return; }
    } else b.freezeAt = 0;
    // last seen enemy close by: attackers push it, defenders recheck it if roaming. Far-off intel
    // (drone spots, callouts across the map) is just information for the team's picture: sending
    // everyone who heard it to the same spot is what made whole teams walk in a line
    if (!urgent && b.lastSeen && G.time - b.lastSeenT < 8 && G.time - b.lastSeenT > 1.2 && !a.carry && (a.side === 'atk' || b.role === 'roam') && U.dist3(a.pos, b.lastSeen) < 15) {
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
        // the route ended short of the goal (it can't be reached from here): choose another spot
        // rather than stand at the end of a partial path until a timer runs out
        if (!b.path || b.pi >= b.path.length) {
          b.shortT = (b.shortT || 0) + dt;
          if (b.shortT > 1.5) {
            b.shortT = 0; b.goal = null;
            // forget the unreachable spot itself, or the same goal comes straight back
            if (goal.kind === 'roam') b.roamGoal = null;
            if (goal.kind === 'hold') { b.hold = null; b.holdRoom = null; }
            if (goal.kind === 'plant') b.plantSpot = null;
            if (goal.kind === 'push') b.atkSpot = null;
            if (goal.kind === 'guard') b.guard = null;
            if (goal.kind === 'hunt' || goal.kind === 'search') { const S = situation(a.team); S.cleared = G.time; b.huntSpot = null; }
            if (goal.kind === 'contest') b.contestSpot = null;
            if (goal.kind === 'stage') b.staged = true;
            if (goal.kind === 'enter') b.entered = true;
          }
        } else b.shortT = 0;
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
    // nothing lethal goes off near the hostage: harming them loses the round
    const hz = GAME.obj && GAME.obj.hostage;
    const safe = p => !(hz && hz.state !== 'dead' && p && U.dist3(hz.pos, p) < 6);
    // Vesper sonar
    if (ab && ab.id === 'sonar' && ab.cd <= 0 && nearObj) GAD.ability(a);
    // throw a grenade at a recently seen enemy behind cover
    if (g && g.count > 0 && b.lastSeen && G.time - b.lastSeenT > 1 && G.time - b.lastSeenT < 5 && !b.target) {
      const d = U.dist3(a.pos, b.lastSeen);
      if (d > 4 && d < 16 && ['frag', 'stun', 'impact', 'c4'].includes(g.id) && (g.id === 'stun' || safe(b.lastSeen)) && Math.random() < 0.35) {
        lobAt(a, b.lastSeen); GAD.secondary(a); if (g.id === 'c4') setTimeout(() => GAD.secondary(a), 1600); return;
      }
    }
    if (ab && ab.count > 0 && b.lastSeen && G.time - b.lastSeenT < 5 && !b.target) {
      const d = U.dist3(a.pos, b.lastSeen);
      if ((ab.id === 'incendiary' || ab.id === 'photon') && (ab.id === 'photon' || safe(b.lastSeen)) && d > 4 && d < 14 && Math.random() < 0.3) { lobAt(a, b.lastSeen); GAD.ability(a); return; }
      // Haze: flush a defender out of the corner they were last seen in
      if (ab.id === 'irritant' && d > 4 && d < 16 && Math.random() < 0.35) { lobAt(a, b.lastSeen); GAD.ability(a); return; }
    }
    // Brace: in a fight at range with nothing to hide behind, put a foam wall down in front
    if (ab && ab.id === 'foam' && ab.count > 0 && b.target && b.target.isActor && U.dist3(a.pos, b.target.pos) > 8 && Math.random() < 0.25) {
      const t = b.target.pos, dx = t.x - a.pos.x, dz = t.z - a.pos.z, L = Math.hypot(dx, dz) || 1;
      const spot = a.pos.clone().add(V().set(dx / L * 2.2, 0, dz / L * 2.2));
      if (NAV.walkable(spot)) { const k = a.pitch; lobAt(a, spot, true); a.pitch = -0.35; GAD.ability(a); a.pitch = k; return; }
    }
    // Seam: patch any breach the attack has opened into the site
    if (ab && ab.id === 'patch' && ab.count > 0 && !b.target && !b.task && plan.rooms) {
      for (const r of plan.rooms) {
        const h = breachIn(r); if (!h) continue;
        b.task = { at: h.stand, look: h.look, time: 0.6, run: x => { faceTo(x, h.look, 1, 99); GAD.ability(x); } }; b.taskT = 0;
        return;
      }
    }
    // attacker utility before entering the objective
    if (a.side === 'atk' && obj && nearObj && !b.target) {
      const d = U.dist3(a.pos, obj);
      if (g && g.count > 0 && (g.id === 'stun' || (g.id === 'frag' && safe(obj))) && d > 5 && d < 12 && Math.random() < 0.2 && G.world.los(a.eye(V()), obj.clone().setY(obj.y + 1))) { lobAt(a, obj); GAD.secondary(a); return; }
      if (ab && ab.id === 'smokegl' && ab.count > 0 && plan.planting && Math.random() < 0.4) { lobAt(a, obj, true); GAD.ability(a); return; }
      if (ab && ab.id === 'irritant' && ab.count > 0 && d > 5 && d < 14 && Math.random() < 0.25 && G.world.los(a.eye(V()), obj.clone().setY(obj.y + 1))) { lobAt(a, obj); GAD.ability(a); return; }
      // Brace: cover for the planter, between the defuser and the way a retake will come
      if (ab && ab.id === 'foam' && ab.count > 0 && plan.planting && plan.carrier && plan.carrier.alive && U.dist3(a.pos, plan.carrier.pos) < 7 && Math.random() < 0.5) {
        const ops = roomOpenings(plan.rooms[0]); const op = ops.length ? U.pick(ops) : null;
        if (op) { const c = GAD.opCenter(op), m = plan.carrier.pos.clone().lerp(c, 0.4); m.y = plan.carrier.pos.y; if (NAV.walkable(m)) { lobAt(a, m, true); a.pitch -= 0.2; GAD.ability(a); return; } }
      }
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

  /* ===================================================== reading the round
     Each team keeps a running picture of the round (who's still up on each side, where the
     enemy was last seen or marked, how much time is left, whether the objective is under
     threat), and every bot chooses its job from it: play the objective, hunt the last
     enemies down when that's the better way to win, or drop everything for the objective
     when it needs them now. */
  const SIT = {};
  function situation(team) {
    const S = SIT[team] || (SIT[team] = { cleared: -99, t: -99 });
    if (G.time - S.t < 0.4) return S;
    S.t = G.time;
    const side = GAME.sideOf(team), obj = GAME.obj;
    const alive = t => G.actors.filter(x => x.team === t && x.state === 'alive' && !x.hostage).length;
    S.side = side; S.mine = alive(team); S.theirs = alive(1 - team); S.adv = S.mine - S.theirs;
    S.known = null; S.kt = -99;
    for (const x of G.actors) if (x.team === team && x.bot && x.state === 'alive' && x.bot.lastSeen && x.bot.lastSeenT > S.kt) { S.kt = x.bot.lastSeenT; S.known = x.bot.lastSeen; }
    for (const t of G.actors) if (t.team !== team && t.state === 'alive' && !t.hostage && GAME.marked(t, team) && G.time > S.kt) { S.kt = G.time; S.known = t.pos.clone(); }
    if (S.kt <= S.cleared) S.known = null;      // somebody already went there and found nothing
    const fresh = S.known && G.time - S.kt < 14;
    S.planted = !!(obj.defuser && obj.defuser.alive);
    S.late = GAME.phase === 'action' && GAME.timer < 55 && !S.planted;
    S.threat = side === 'def' && !!(S.planted || (obj.hostage && obj.hostage.followTarget) || (GAME.mode === 'secure' && (obj.prog > 0 || obj.contested)));
    S.mode = 'objective';
    if (GAME.phase === 'action' && fresh && S.theirs > 0) {
      // attackers win just as well by clearing the building: with the numbers on their side
      // (or one defender left) and time in hand, they go after the enemy they know about
      if (side === 'atk' && !S.late && !S.planted && (S.theirs === 1 || S.adv >= 2)) S.mode = 'hunt';
      // defenders only leave the site when the attack is nearly spent and nothing is at risk
      if (side === 'def' && !S.threat && ((S.theirs === 1 && S.mine >= 2) || S.adv >= 3)) S.mode = 'hunt';
    }
    return S;
  }
  AI.situation = situation;
  /* does the objective need this bot right now? */
  function urgentFor(a) {
    if (GAME.phase !== 'action' || GAME.arcade) return false;
    const S = situation(a.team), obj = GAME.obj;
    if (a.side === 'def') return S.threat;
    return !!a.carry || S.late || (obj.dropped && obj.dropped.alive && pickupBot(a.team) === a);
  }
  /* the attacker bot nearest a dropped defuser fetches it; the rest carry on or cover it */
  function pickupBot(team) {
    const d = GAME.obj.dropped; if (!d || !d.alive) return null;
    let best = null, bd = 1e9;
    for (const x of G.actors) if (x.team === team && x.bot && x.state === 'alive' && !x.carry) { const dd = U.dist3(x.pos, d.pos); if (dd < bd) { bd = dd; best = x; } }
    return best;
  }
  /* go to where the enemy was last known to be; once there with nobody in sight, that intel is spent */
  function huntGoal(a, S) {
    const b = a.bot;
    if (!S.known) return null;
    if (!b.huntSpot || U.dist3(b.huntSpot, S.known) > 3) { const n = NAV.nearest(S.known, 4); b.huntSpot = n >= 0 ? NAV.nodePos(n) : S.known.clone(); }
    if (U.dist2(a.pos, b.huntSpot) < 1.6 && Math.abs(a.pos.y - b.huntSpot.y) < 1.2) { S.cleared = G.time; b.huntSpot = null; return null; }
    return { pos: b.huntSpot, r: 1.0, kind: 'hunt', sprint: U.dist3(a.pos, b.huntSpot) > 18, look: S.known.clone().setY(S.known.y + 1.4) };
  }

  /* ====================================================== round planning */
  AI.roundStart = function () {
    AI.teams = {};
    for (const k in SIT) delete SIT[k];
    // Deathmatch / Team Deathmatch: no plan to follow, just hunt (arcade.js)
    if (GAME.arcade) {
      for (const a of G.actors) if (a.bot && !AI.teams[a.team]) AI.teams[a.team] = { side: a.side, bots: G.actors.filter(x => x.team === a.team && x.bot), goalFor: ARC.goal };
      return;
    }
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
      plan.actionT = G.time;
      AI.actSnap = G.world.v.slice();   // the building as the action starts: what a breach takes away
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
        // breachers have their own way in: a window entry goes to someone with nothing else to do
        const wb = plan.bots.find(a => a.bot.entry && a.bot.entry.win && a.bot.tasks.length);
        const free = wb && plan.bots.find(a => !a.bot.tasks.length && a.bot.entry && !a.bot.entry.win && !a.carry);
        if (wb && free) { const t = wb.bot.entry; wb.bot.entry = free.bot.entry; free.bot.entry = t; wb.bot.staged = free.bot.staged = false; }
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
    // (every standing spot is checked against the walkable grid first: a spot inside furniture or
    // behind a wall used to keep a defender walking into it for the whole prep phase)
    for (const h of hatches) { const stand = reachable(V().set((h.x + 2) * 0.25, h.L * 3 + 0.25, (h.z + 2) * 0.25)); if (!stand) continue; const a = workers[pi++ % workers.length]; if (!a) break; a.bot.tasks.push({ at: stand, look: stand.clone().setY(stand.y - 0.5), time: 3, run: () => GAME.reinforceHatch(h, a) }); }
    for (const p of panels) { const stand = reachable(p.stand, p.room); if (!stand) continue; const a = workers[pi++ % workers.length]; if (!a) break; a.bot.tasks.push({ at: stand, look: p.look, time: a.op.id === 'brick' ? 1.8 : 3.2, run: () => GAME.reinforcePanel(p, a) }); }
    // gadgets next, then barricades on every entry
    for (const a of bots) planDefKit(a, plan);
    let bi = 0;
    for (const op of entries) {
      if (op.kind === 'shutter') continue;
      const a = workers[bi++ % workers.length]; if (!a) break;
      const c = GAD.opCenter(op), inward = V();
      const r = rooms.find(rr => rr.L === op.L) || rooms[0];
      inward.set(r.cx - c.x, 0, r.cz - c.z); if (op.axis === 'z') inward.x = 0; else inward.z = 0; inward.normalize();
      const s0 = c.clone().addScaledVector(inward, 0.9); s0.y = r.fy;
      const stand = reachable(s0); if (!stand) { bi--; continue; }
      a.bot.tasks.push({ at: stand, look: c, time: 1.2, run: () => { GAD.barricade(op); SFX.wood(c); } });
    }
    // where to stand afterwards
    plan.goalFor = a => defGoal(a, plan);
  }
  function anchorSpot(a, plan) {
    const b = a.bot;
    if (b.hold && b.holdRoom) return b.hold;
    // anchors share the site rooms out between them, keep a few metres apart (one grenade or
    // one spray shouldn't take two), and each holds a different doorway: a crossfire, not a stack
    const anchors = plan.bots.filter(x => x.bot && x.bot.role !== 'roam');
    const r = plan.rooms[Math.max(0, anchors.indexOf(a)) % plan.rooms.length];
    const mates = plan.bots.filter(x => x !== a && x.state === 'alive' && x.bot && x.bot.hold);
    let best = null, bs = -1e9;
    const ents = roomOpenings(r);
    for (let i = 0; i < 14; i++) {
      const p = NAV.randomIn(r);
      // prefer spots set back from the entries (an off-angle) that still see one
      let s = 0;
      for (const op of ents) { const c = GAD.opCenter(op); const d = U.dist2(c, p); s += Math.min(d, 6) * 0.4; if (G.world.los(p.clone().setY(p.y + 1.5), c)) s += 1; }
      for (const m of mates) { const d = U.dist2(m.bot.hold, p); s += Math.min(d, 5) * 0.5 - (d < 2.5 ? 3 : 0); }
      for (const g of G.ents) if (g.alive && g.type === 'irritant' && g.team !== a.team && U.dist2(g.pos, p) < g.r + 1) s -= 6;
      s += Math.random();
      if (s > bs) { bs = s; best = p; }
    }
    b.hold = best; b.holdRoom = r;
    const watched = new Set(mates.map(m => m.bot.holdOp).filter(Boolean));
    const seen = ents.filter(op => G.world.los(best.clone().setY(best.y + 1.5), GAD.opCenter(op)));
    const free = seen.filter(op => !watched.has(op));
    const op = free.length ? U.pick(free) : seen.length ? U.pick(seen) : ents.length ? U.pick(ents) : null;
    b.holdOp = op;
    b.holdLook = op ? headAt(op) : V().set(r.cx, r.fy + 1.4, r.cz);
    return best;
  }
  function defGoal(a, plan) {
    const b = a.bot, S = situation(a.team), obj = GAME.obj;
    // defuser planted: go disable it
    if (obj.defuser && obj.defuser.alive) {
      const d = obj.defuser;
      return { pos: d.pos, r: 1.0, kind: 'defuse', sprint: true, look: d.pos, act: (x) => GAME.tryInteract(x, 'disable') };
    }
    // the hostage is on the move: everyone, roamers too, cuts the escort off
    if (GAME.mode === 'hostage' && obj.hostage && obj.hostage.followTarget) {
      return { pos: obj.hostage.pos, r: 3, kind: 'chase', sprint: true };
    }
    // attackers are taking the area: get into the room and contest it
    if (GAME.mode === 'secure' && (obj.prog > 0 || obj.contested)) {
      const site = plan.rooms[0];
      if (!b.contestSpot || G.map.roomAt(b.contestSpot) !== site) b.contestSpot = NAV.randomIn(site);
      return { pos: b.contestSpot, r: 0.8, kind: 'contest', sprint: U.dist3(a.pos, b.contestSpot) > 6, look: V().set(site.cx, site.fy + 1.4, site.cz) };
    }
    // the attack is nearly spent: roamers and all but one anchor go and finish it
    if (S.mode === 'hunt') {
      const anchors = plan.bots.filter(x => x.state === 'alive' && x.bot && x.bot.role === 'anchor');
      if (b.role === 'roam' || anchors[0] !== a) { const g = huntGoal(a, S); if (g) return g; }
    }
    // roamers fall back to the site once the defense is down two or more
    if (b.role === 'roam' && S.adv > -2) {
      if (!b.roamGoal || U.dist2(a.pos, b.roamGoal) < 1 || G.time > (b.roamUntil || 0)) {
        const rs = G.map.rooms.filter(r => Math.abs(r.L - plan.rooms[0].L) <= 1 && !plan.rooms.includes(r) && !/Stairs/.test(r.name));
        const r = U.pick(rs.length ? rs : G.map.rooms);
        b.roamGoal = NAV.randomIn(r); b.roamUntil = G.time + U.rnd(12, 25);
      }
      return { pos: b.roamGoal, r: 0.8, kind: 'roam', look: b.roamGoal.clone().add(V().set(Math.sin(G.time * 0.5 + a.id) * 3, 1.4, Math.cos(G.time * 0.5 + a.id) * 3)) };
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
      // Lumen: a floodlight set back from each of two entries, shining into the doorway
      case 'floodlight': place(Math.min(2, ents.length), i => atEntry(i, (x, op, st, inw, c) => {
        let p = c.clone().addScaledVector(inw, 2.6); p.y = st.y;
        if (G.world.boxHits(p.x - 0.2, p.y + 0.1, p.z - 0.2, p.x + 0.2, p.y + 1.5, p.z + 0.2) || !NAV.walkable(p)) p = st.clone();
        GAD.deployAt(x, 'floodlight', p, null, Math.atan2(-(c.x - p.x), -(c.z - p.z))); x.ability.count--;
      }, 0.8) || { time: 0 }); break;
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

  /* a hole the attack has opened into a room since the action phase began (its walls or the
     ceiling over it): where it is, and where to stand to patch it */
  function breachIn(room) {
    const W = G.world, snap = AI.actSnap, v = W.v; if (!snap) return null;
    const miss = (x, y, z) => { if (x < 0 || z < 0 || y < 1 || x >= W.W || z >= W.D || y >= W.H) return false; const i = W.idx(x, y, z), o = snap[i]; return o && !v[i] && MAT[o].xp && o !== M.GLASS && o !== M.LEAF && o !== M.BARR; };
    const pts = [];
    for (const [ax, line] of [['x', room.x0 - 1], ['x', room.x1 + 1], ['z', room.z0 - 1], ['z', room.z1 + 1]]) {
      const a0 = ax === 'x' ? room.z0 : room.x0, a1 = ax === 'x' ? room.z1 : room.x1;
      for (let k = a0; k <= a1; k += 2) for (let y = room.y; y <= room.y + 10; y += 2) { const x = ax === 'x' ? line : k, z = ax === 'x' ? k : line; if (miss(x, y, z)) pts.push([x, y, z]); }
    }
    const cy = room.y + 11;
    for (let z = room.z0; z <= room.z1; z += 2) for (let x = room.x0; x <= room.x1; x += 2) if (miss(x, cy, z)) pts.push([x, cy, z]);
    if (pts.length < 3) return null;
    const s = pts[0], cl = pts.filter(p => Math.abs(p[0] - s[0]) <= 6 && Math.abs(p[1] - s[1]) <= 6 && Math.abs(p[2] - s[2]) <= 6);
    if (cl.length < 3) return null;
    const look = V(); for (const p of cl) look.add(V().set(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5)); look.multiplyScalar(0.25 / cl.length);
    const stand = s[1] === cy ? V().set(look.x, room.fy, look.z) : look.clone().lerp(V().set(room.cx, look.y, room.cz), Math.min(1, 1.3 / Math.max(0.1, Math.hypot(room.cx - look.x, room.cz - look.z))));
    stand.y = room.fy;
    const n = NAV.nearest(stand, 2); if (n < 0) return null;
    return { look, stand: NAV.nodePos(n) };
  }
  /* head height in a doorway (windows: their middle), where a defender pre-aims */
  function headAt(op) { const c = GAD.opCenter(op); if (op.kind === 'door') c.y = op.y0 * 0.25 + 1.5; return c; }
  /* a post-plant spot: sees the defuser from 3.5-10 m, away from teammates, in the site or a
     neighbouring room; it looks at the doorway the retake is most likely to come through */
  function guardSpot(a, d) {
    const dp = d.pos, site = d.siteRoom || G.map.roomAt(dp) || AI.teams[a.team].rooms[0];
    const near = G.map.rooms.filter(r => r.L === site.L && r !== site && Math.hypot(r.cx - dp.x, r.cz - dp.z) < 14 && !/Stairs/.test(r.name));
    const mates = G.actors.filter(x => x !== a && x.team === a.team && x.state === 'alive' && !x.hostage).map(x => (x.bot && x.bot.guard) || x.pos);
    const tgt = dp.clone().setY(dp.y + 0.3);
    let best = null, bs = -1e9;
    for (let i = 0; i < 16; i++) {
      const p = NAV.randomIn(i < 7 || !near.length ? site : U.pick(near)), dd = U.dist3(p, dp);
      let s = G.world.los(p.clone().setY(p.y + 1.5), tgt) ? 3 : 0;
      s += dd >= 3.5 && dd <= 10 ? 2 : -Math.abs(dd - 6) * 0.3;
      for (const m of mates) { const md = U.dist2(m, p); s += Math.min(md, 6) * 0.4 - (md < 2.5 ? 2 : 0); }
      s += Math.random();
      if (s > bs) { bs = s; best = p; }
    }
    const ops = roomOpenings(site).filter(op => G.world.los(best.clone().setY(best.y + 1.5), GAD.opCenter(op)));
    const look = ops.length ? headAt(U.pick(ops)) : tgt.clone().setY(dp.y + 1.4);
    return { p: best, look };
  }
  /* which building an opening belongs to */
  function opBuilding(op) {
    const c = GAD.opCenter(op), x = c.x * 4, z = c.z * 4;
    return G.map.buildings.findIndex(b => x >= b.x0 - 1 && x <= b.x1 + 2 && z >= b.z0 - 1 && z <= b.z1 + 2);
  }
  /* the attack's ways in: the exterior doors of the objective's building nearest the site, on
     different walls where possible, each with a spot outside to stack up on and one inside */
  function entryPlan(plan) {
    const site = plan.rooms[0], oc = plan.objCenter, out = [];
    for (const op of G.map.openings) {
      if (!op.ext || op.kind !== 'door' || opBuilding(op) !== site.b) continue;
      const c = GAD.opCenter(op), n = op.axis === 'z' ? V().set(0, 0, op.nrm) : V().set(op.nrm, 0, 0), fy = op.y0 * 0.25;
      const o = c.clone().addScaledVector(n, op.L === 0 ? 1.4 : 3.2); o.y = fy;
      const ni = NAV.nearest(o, 3); if (ni < 0) continue;
      const ii = NAV.nearest(c.clone().addScaledVector(n, -1.3).setY(fy), 2); if (ii < 0) continue;
      out.push({ op, stage: NAV.nodePos(ni), inside: NAV.nodePos(ii), d: U.dist3(c, oc) + Math.abs(fy - oc.y) * 3, wall: op.axis + op.line });
    }
    out.sort((p, q) => p.d - q.d);
    const pick = [];
    for (const e of out) if (pick.length < 3 && !pick.some(p => p.wall === e.wall)) pick.push(e);
    for (const e of out) if (pick.length < 3 && !pick.includes(e)) pick.push(e);
    // plus a window close to the site on its own floor: vaulted from the ground on the ground
    // floor, or reached on a rope and crashed through higher up. It hits the site from an angle
    // the defense can't hold with the doors
    if (typeof Actor.windowApproach === 'function' && pick.length) {
      const wins = [];
      for (const op of G.map.openings) {
        if (!op.ext || op.kind !== 'window' || op.L !== site.L || opBuilding(op) !== site.b) continue;
        const ap = Actor.windowApproach(op); if (!ap) continue;
        const ni = NAV.nearest(ap.stand, 1.5); if (ni < 0) continue;
        const stage = NAV.nodePos(ni); if (U.dist2(stage, ap.stand) > 1.2 || Math.abs(stage.y - ap.stand.y) > 0.5) continue;
        wins.push({ op, win: ap, stage, d: U.dist3(GAD.opCenter(op), oc) });
      }
      wins.sort((p, q) => p.d - q.d);
      if (wins[0] && wins[0].d < 16) pick.splice(1, 0, wins[0]);
    }
    return pick;
  }
  /* a window entry, step by step: walk into the wall below it, then vault through (ground floor)
     or hook on, climb to it and crash in feet-first. Anything refused (reinforced, blocked,
     furniture behind it) and the bot goes round to a door instead */
  function windowStep(a, dt) {
    const b = a.bot, w = b.winStep, plan = AI.teams[a.team] || {};
    w.t += dt;
    const giveUp = () => {
      b.winStep = null; if (a.rappel) a.ropeLetGo();
      const door = (plan.entries || []).find(e => !e.win);
      b.entry = door || null; b.entered = !door; b.goal = null;
      return false;
    };
    if (a.rappel) {
      a.mr = 0; a.mf = 0; a.sprint = false;
      if (a.ropeWindow() === w.op) { if (a.crashWindow()) { b.winStep = null; b.entered = true; b.goal = null; return true; } return giveUp(); }
      a.mf = 1;
      if (w.t > 10) return giveUp();
      return true;
    }
    if (a.vault) return true;
    if (w.vaulted) { b.winStep = null; b.entered = true; b.goal = null; return false; }
    const wp = w.ap.wallPoint, dx = wp.x - a.pos.x, dz = wp.z - a.pos.z;
    a.yaw = Math.atan2(-dx, -dz); a.pitch = w.ap.ground ? -0.1 : 0; a.sprint = false;
    if (w.ap.ground) { if (a.vaultWindow()) { w.vaulted = true; return true; } }
    else if (a.rappelAt(wp)) { w.t = 0; GAME.noise(a.pos, 8, a, 'step'); return true; }
    steer(a, dx, dz, 0.45);
    if (w.t > 1.6) return giveUp();
    return true;
  }
  function planAttack(plan, bots, obj) {
    const rooms = obj.rooms;
    plan.rooms = rooms;
    const r = rooms[0];
    plan.objCenter = V().set(r.cx, r.fy, r.cz);
    U.shuffle(bots);
    bots.forEach((a, i) => { a.bot.role = i === 0 ? 'lead' : i % 2 ? 'entry' : 'flank'; a.bot.tasks = []; a.bot.delay = i * U.rnd(2, 5); });
    if (GAME.mode === 'bomb') plan.carrier = bots.find(a => a.carry === 'defuser') || null;
    // split the team over the entries so the site gets hit from several sides at once; the
    // defuser goes in by the closest one
    plan.entries = entryPlan(plan); plan.execute = false;
    if (plan.carrier) { bots.splice(bots.indexOf(plan.carrier), 1); bots.unshift(plan.carrier); }
    bots.forEach((a, i) => { const b = a.bot; b.entry = plan.entries.length ? plan.entries[i % plan.entries.length] : null; b.staged = false; b.entered = false; });
    plan.goalFor = a => atkGoal(a, plan);
  }
  /* before the execute: get to your entry and stack up outside it. The team goes in together once
     everyone is in place, as soon as anyone makes contact, or after 30 s at the latest */
  function stageGoal(a, plan, S) {
    const b = a.bot;
    if (!b.entry || b.entered) return null;
    // already inside (a breach of our own took us in): no need to go back out to the entry
    if (Actor.indoors(a.pos.x, a.pos.y, a.pos.z) && !b.winStep) { b.entered = true; return null; }
    if (!plan.execute) {
      const live = plan.bots.filter(x => x.state === 'alive' && x.bot && x.bot.entry);
      const contact = plan.bots.some(x => x.state === 'alive' && x.bot && x.bot.target && x.bot.target.isActor);
      if (live.every(x => x.bot.staged) || G.time - (plan.actionT || 0) > 30 || contact || S.late) { plan.execute = true; for (const x of live) x.bot.delay = U.rnd(0, 1.2); }
    }
    if (!plan.execute) {
      const st = b.entry.stage;
      if (U.dist2(a.pos, st) < 1.6 && Math.abs(a.pos.y - st.y) < 1.2) b.staged = true;
      return { pos: st, r: 1.2, kind: 'stage', sprint: U.dist3(a.pos, st) > 14, look: GAD.opCenter(b.entry.op) };
    }
    if (b.delay > 0) return { pos: a.pos.clone(), r: 9, kind: 'wait', look: GAD.opCenter(b.entry.op) };
    // a window entry: at the wall below it, hand over to windowStep
    if (b.entry.win) {
      const st = b.entry.stage;
      if (U.dist2(a.pos, st) < 0.7 && Math.abs(a.pos.y - st.y) < 0.6) { b.winStep = { op: b.entry.op, ap: b.entry.win, t: 0 }; return { pos: a.pos.clone(), r: 9, kind: 'wait' }; }
      return { pos: st, r: 0.5, kind: 'enter', look: GAD.opCenter(b.entry.op) };
    }
    // through our own door first, then on to the site
    const ins = b.entry.inside;
    if (U.dist2(a.pos, ins) < 1.4 && Math.abs(a.pos.y - ins.y) < 1.2) { b.entered = true; return null; }
    return { pos: ins, r: 1.0, kind: 'enter', look: ins.clone().setY(ins.y + 1.5) };
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
    const b = a.bot, obj = GAME.obj, S = situation(a.team);
    if (b.delay > 0) { b.delay -= 0.016; }
    const R = plan.rooms;
    // bomb: carrier plants; others clear site
    if (GAME.mode === 'bomb') {
      if (obj.defuser && obj.defuser.alive) {
        // post-plant: spread out to separate spots that can see the defuser (a crossfire on
        // it), each watching a different way in, instead of crouching in a pile beside it
        if (!b.guard || U.dist3(b.guard, obj.defuser.pos) > 12) { const g = guardSpot(a, obj.defuser); b.guard = g.p; b.guardLook = g.look; }
        return { pos: b.guard, r: 0.8, kind: 'guard', look: b.guardLook, crouch: true };
      }
      // a dropped defuser: the nearest bot goes and gets it, and anyone close by covers it
      if (obj.dropped && obj.dropped.alive && (!obj.carrier || obj.carrier.state !== 'alive')) {
        const dp = obj.dropped.pos;
        if (pickupBot(a.team) === a) return { pos: dp, r: 0.6, kind: 'pickup', sprint: true, act: x => GAME.tryInteract(x, 'pickup') };
        if (U.dist3(a.pos, dp) < 20) {
          if (!b.cover || U.dist3(b.cover, dp) > 6) { const n = NAV.nearest(dp.clone().add(V().set(Math.sin(a.id * 2.1) * 3, 0, Math.cos(a.id * 2.1) * 3)), 4); b.cover = n >= 0 ? NAV.nodePos(n) : dp.clone(); }
          return { pos: b.cover, r: 1.0, kind: 'cover', look: plan.objCenter.clone().setY(plan.objCenter.y + 1.4) };
        }
      }
    }
    // stack up on our entry, then go in with the team
    if (!a.carry || a.carry === 'defuser') { const sg = stageGoal(a, plan, S); if (sg) return sg; }
    if (GAME.mode === 'bomb') {
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
    // with the numbers (or one defender left) and time in hand: go and finish the defense off
    if (S.mode === 'hunt' && !a.carry) { const g = huntGoal(a, S); if (g) return g; }
    if (!b.atkSpot || G.time > (b.atkUntil || 0)) {
      const rr = U.pick(R); b.atkSpot = NAV.randomIn(rr); b.atkUntil = G.time + U.rnd(S.late ? 6 : 15, S.late ? 10 : 30);
    }
    return { pos: b.atkSpot, r: 0.8, kind: 'push', sprint: U.dist3(a.pos, b.atkSpot) > (S.late ? 8 : 25), look: plan.objCenter.clone().setY(plan.objCenter.y + 1.4) };
  }

  window.AI = AI;
})();
