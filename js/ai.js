/* ai.js -- bot brains. Each bot perceives (sight, hearing, team intel), picks a
   job from its team plan (defend a site, push an objective, plant, defuse,
   escort, revive) and fights with difficulty-scaled reaction and aim.

   Every bot is also a PLAYER with a playstyle (persona.js). Its traits decide
   how it fights (peek from cover and lean, swing wide, hold, push, back off and
   come again from another angle), where it goes (straight at the site, room by
   room, round the side, up on a long sightline, behind a teammate to trade,
   alone and quiet far from everyone), what it does with what it hears, and
   when it gives a position up. The situation still decides in the end: a
   flanker defends when the objective needs it, an entry fragger backs off when
   it is hurt and alone.

   One update per frame: decide() picks what to do (it may ask for a lean or
   name what it is watching, b.focus), then leanCtl() turns that into a lean.
   The expensive looks (line-of-sight fans for cover and leaning) run a few
   times a second, never every frame.                                         */
(function () {
  'use strict';
  const { M, MAT, DIFFS } = DATA;
  const AI = { teams: {} };
  const V = () => new THREE.Vector3();
  const D2R = Math.PI / 180;

  AI.attach = function (a) {
    PERSONA.forBot(a);
    a.bot = {
      state: 'idle', path: null, pi: 0, goal: null, repathT: 0, goalKind: '', hold: null, holdLook: null,
      target: null, seenT: 0, reactT: 0, lastSeen: null, lastSeenT: -99, think: Math.random() * 0.2,
      errY: 0, errP: 0, strafeT: 0, strafeDir: 1, burst: 0, burstPause: 0, stuckT: 0, lastPos: V(), meleeT: 0,
      tasks: [], task: null, taskT: 0, heard: null, extraSpread: 0, wantHead: false, role: 'entry', util: 0, scanT: 0,
      crouchT: 0, alert: 0, entT: 0, entTarget: null,
      // playstyle state: mood (aggression after the situation), the fight posture, leaning
      ag: a.persona.t.aggr, morale: 0, kills0: 0, mateDown0: 0, visN: 0, threats: [], contact: null, fight: null,
      focus: null, leanReq: null, leanCur: 0, leanHold: 0, leanNext: 0, attn: null, stats: { lean: 0, peeks: 0, retreats: 0, relocs: 0, slices: 0, walk: 0 },
    };
  };
  const diff = () => DIFFS[G.settings.difficulty] || DIFFS[1];
  /* the bot's playstyle: traits, variation flags */
  const TR = a => (a.persona || PERSONA.forBot(a)).t;
  const FL = a => (a.persona || PERSONA.forBot(a)).f;
  const PID = a => (a.persona || PERSONA.forBot(a)).id;
  AI.TR = TR;

  /* ------------------------------------------------------- leaning & cover */
  const LEAN = 0.38;   // how far a lean moves the eye (actor.js)
  const eyeAt = (p, h, out) => (out || V()).set(p.x, p.y + h, p.z);
  /* the eye a lean to side s would put at standing spot p, facing point P */
  function leanEye(p, h, P, s, out) {
    const dx = P.x - p.x, dz = P.z - p.z, L = Math.hypot(dx, dz) || 1;
    return (out || V()).set(p.x - dz / L * LEAN * s, p.y + h - 0.08, p.z + dx / L * LEAN * s);
  }
  const headRoom = e => !G.world.boxHits(e.x - 0.12, e.y - 0.12, e.z - 0.12, e.x + 0.12, e.y + 0.12, e.z + 0.12);
  /* other enemies this bot knows about (seen in the last few seconds), apart from near `but` */
  function otherThreats(a, but) {
    const b = a.bot; return b.threats.filter(t => G.time - t.t < 5 && (!but || U.dist3(t.p, but) > 2.5));
  }
  /* which way to lean to see P that the bot can't see standing straight: -1, 1, or 0 (none
     needed, or none works). A lean that would show it to another enemy it knows about is
     no good: one corner at a time */
  function sideFor(a, P) {
    const h = a.eyeH, e0 = eyeAt(a.pos, h);
    if (G.world.los(e0, P)) return 0;
    const b = a.bot, others = otherThreats(a, P);
    const order = b.leanCur ? [b.leanCur, -b.leanCur] : (Math.random() < 0.5 ? [-1, 1] : [1, -1]);
    for (const s of order) {
      const e = leanEye(a.pos, h, P, s);
      if (!headRoom(e) || !G.world.los(e, P)) continue;
      if (others.some(t => G.world.los(e, t.p) && !G.world.los(e0, t.p))) continue;
      return s;
    }
    return 0;
  }
  /* a spot within R of `from` where the body is hidden from P (chest and hips) and a lean
     clears the edge: hold an angle, or trade shots, with only a head and shoulder showing */
  function coverPeek(a, P, R, from) {
    const o = from || a.pos, dx = P.x - o.x, dz = P.z - o.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, rx = -uz, rz = ux;
    const h = a.stance === 1 ? a.eyeH : 1.6, c = V(), chest = V(), hip = V(), e = V();
    let best = null, bs = -1e9;
    for (const off of [0, -0.35, 0.35, -0.7, 0.7, -1.1, 1.1, -1.5, 1.5]) {
      if (Math.abs(off) > R) continue;
      for (const back of [0, 0.5]) {
        c.set(o.x + rx * off - ux * back, o.y, o.z + rz * off - uz * back);
        const n = NAV.nearest(c, 1); if (n < 0) continue;
        const q = NAV.nodePos(n);
        if (Math.abs(q.y - o.y) > 0.6 || U.dist2(q, c) > 0.55) continue;
        if (G.world.los(P, chest.set(q.x, q.y + 1.1, q.z)) || G.world.los(P, hip.set(q.x, q.y + 0.7, q.z))) continue;
        for (const s of [-1, 1]) {
          leanEye(q, h, P, s, e);
          if (!headRoom(e) || !G.world.los(e, P)) continue;
          const sc = -U.dist2(q, o) - back * 0.4 + Math.random() * 0.25;
          if (sc > bs) { bs = sc; best = { pos: q, side: s, P: P.clone() }; }
        }
      }
    }
    return best;
  }
  AI.coverPeek = coverPeek;
  /* a spot within R that P can't see at all (to back off to): nearest first, away from P */
  function hideFrom(a, P, R) {
    const o = a.pos, c = V(), chest = V(), head = V();
    let best = null, bs = -1e9;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.3, r = 1.5 + (i % 3) * (R - 1.5) / 2;
      c.set(o.x + Math.cos(ang) * r, o.y, o.z + Math.sin(ang) * r);
      const n = NAV.nearest(c, 1); if (n < 0) continue;
      const q = NAV.nodePos(n);
      if (Math.abs(q.y - o.y) > 1.3) continue;
      if (G.world.los(P, chest.set(q.x, q.y + 1.1, q.z)) || G.world.los(P, head.set(q.x, q.y + 1.6, q.z))) continue;
      const sc = -U.dist2(q, o) * 0.8 + U.dist2(q, P) * 0.3 + Math.random();
      if (sc > bs) { bs = sc; best = q; }
    }
    return best;
  }
  /* the lean itself: asked for outright (a peek, a held angle), or worked out from what the bot
     is watching. A lean is held a moment once chosen (no twitching between sides), and never
     while running, prone, on a rope, behind a shield or carrying the hostage */
  function leanCtl(a, dt) {
    const b = a.bot;
    const can = !a.sprint && a.stance !== 2 && !a.rappel && !a.vault && !a.shieldOp && !(a.carry && a.carry.hostage) && GAME.phase !== 'prep';
    if (!can) { b.leanCur = 0; a.leanT = 0; return; }
    if (b.leanReq != null) { b.leanCur = b.leanReq; b.leanHold = G.time + 0.3; }
    else if (b.focus && (a.moving || 0) < 2.8) {
      if (G.time >= b.leanNext) {
        b.leanNext = G.time + 0.22 + Math.random() * 0.1;
        // how readily this bot leans at all: careful players do, wide-swinging ones step out instead
        if (b.focusKey !== b.focusKeyDone) { b.focusKeyDone = b.focusKey; b.leanWilling = Math.random() < 0.2 + TR(a).cover * 0.8; }
        const s = b.leanWilling ? sideFor(a, b.focus) : 0;
        if (s !== b.leanCur && (s !== 0 || G.time > b.leanHold)) { if (s) b.stats.peeks++; b.leanCur = s; b.leanHold = G.time + 0.45; }
      }
    } else if (G.time > b.leanHold) b.leanCur = 0;
    a.leanT = b.leanCur;
    if (b.leanCur) b.stats.lean += dt;
  }
  AI.leanCtl = leanCtl;
  /* what this bot is watching right now (the lean controller looks there) */
  const watch = (a, p, key) => { const b = a.bot; b.focus = p; b.focusKey = key || ((p.x * 2 | 0) + ':' + (p.z * 2 | 0)); };

  /* how the bot feels about the fight right now: its aggression moved by the numbers, its
     health, the clock and how the round has gone for it (kills lift it, teammates going down
     around it drop it). Re-read a few times a second */
  function mood(a) {
    const b = a.bot, t = TR(a), S = situation(a.team);
    if (a.kills > b.kills0) { b.morale = Math.min(1, b.morale + 0.4 * (a.kills - b.kills0)); b.kills0 = a.kills; }
    const down = G.actors.filter(x => x.team === a.team && x !== a && !x.hostage && x.state !== 'alive' && U.dist3(x.pos, a.pos) < 18).length;
    if (down > b.mateDown0) b.morale = Math.max(-1, b.morale - 0.3 * (down - b.mateDown0) * (1.2 - t.conf));
    b.mateDown0 = down;
    b.morale *= 0.995;
    let ag = t.aggr + U.clamp(S.adv, -3, 3) * 0.07 + b.morale * 0.15 - (1 - a.hp / a.maxHp) * (1 - t.conf) * 0.6;
    if (S.late && a.side === 'atk') ag += 0.3;
    if (S.threat && a.side === 'def') ag += 0.25;
    // a Chameleon reads the round: ahead, it presses; behind, it gets careful
    if (FL(a).adapt) ag += U.clamp(S.adv, -2, 2) * 0.12;
    b.ag = U.clamp(ag, 0, 1);
  }
  AI.mood = mood;

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
    // a step over a link (a ladder, a crawl hole, a zipline): js/ops2.js takes the body across
    if (window.OPS2 && OPS2.followLink(a, b, dt)) return false;
    if (!b.path || b.pi >= b.path.length) { a.mf = a.mr = 0; return true; }   // (that link was the last step)
    let n = b.path[b.pi];
    let dx = n.x - a.pos.x, dz = n.z - a.pos.z;
    while (Math.hypot(dx, dz) < 0.32 && b.pi < b.path.length - 1) { b.pi++; n = b.path[b.pi]; dx = n.x - a.pos.x; dz = n.z - a.pos.z; }
    if (b.pi === b.path.length - 1 && Math.hypot(dx, dz) < 0.3) { b.pi++; a.mf = a.mr = 0; return true; }
    let speed = 1;
    const tr = TR(a);
    // clear the room: stepping into a new one in the action phase, sweep its corners and other
    // doorways at head height, a little slower, instead of staring down the route. A careful
    // player sweeps all of it; a fast one checks the obvious corners, or none
    const fight = GAME.phase === 'action' && !a.sprint;
    const room = G.map.roomAt(a.pos);
    if (room !== b.room) {
      b.room = room; b.clearT = 0;
      if (room) markCleared(a, room);
      b.clear = fight && room && Math.random() < 0.35 + tr.caution * 0.65 ? clearLooks(a, room, dx, dz).slice(0, tr.caution > 0.6 ? 4 : 2) : null;
    }
    // slicing the doorway: about to step into a room nobody on the team has checked, a careful
    // player stops at the threshold and leans round it, a corner at a time, before going in
    if (fight && lookAhead !== false && !b.slice && G.time > (b.sliceCd || 0)) checkSlice(a, room);
    if (b.slice) {
      if (G.time > b.slice.until || !b.slice.pts.length || b.target) { b.slice = null; b.sliceCd = G.time + 4; }
      else {
        const p = b.slice.pts[0]; faceTo(a, p, dt, 9); watch(a, p, 'slice' + b.slice.pts.length);
        if ((b.slice.t += dt) > 0.55) { b.slice.pts.shift(); b.slice.t = 0; }
        a.mf = a.mr = 0; return false;
      }
    }
    if (fight && b.clear && b.clear.length && lookAhead !== false) {
      faceTo(a, b.clear[0], dt, 10); watch(a, b.clear[0]); speed = 0.55 + 0.35 * (1 - tr.caution);
      if ((b.clearT += dt) > 0.22 + tr.caution * 0.2) { b.clear.shift(); b.clearT = 0; }
    } else if (b.attn && G.time < b.attn.until && lookAhead !== false) {
      // heard something: keep walking, gun on where it came from
      faceTo(a, b.attn.p, dt, 7); watch(a, b.attn.p); speed = 0.75;
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
  /* the team has walked through this room (careful players don't re-slice it for a while) */
  function markCleared(a, room) { const p = AI.teams[a.team]; if (p) (p.cleared || (p.cleared = new Map())).set(room, G.time); }
  function checkSlice(a, room) {
    const b = a.bot, tr = TR(a);
    if (!(FL(a).slice || tr.caution > 0.55) || a.carry || b.target || !b.path || urgentFor(a)) return;
    // the first room ahead on the route that isn't this one (a doorway's own cells are in no room)
    let ahead = null, nr = null;
    for (let i = b.pi; i < Math.min(b.path.length, b.pi + 6); i++) {
      const n = b.path[i]; if (U.dist2(a.pos, n) > 2.6) break;
      const r = G.map.roomAt(n); if (r && r !== room) { ahead = n; nr = r; break; }
    }
    if (!nr) return;
    const p = AI.teams[a.team], cl = p && p.cleared && p.cleared.get(nr);
    if (cl && G.time - cl < 25) return;
    b.sliceCd = G.time + 3;
    if (Math.random() > 0.35 + tr.caution * 0.65) return;
    const pts = clearLooks(a, nr, ahead.x - a.pos.x, ahead.z - a.pos.z); if (!pts.length) return;
    b.slice = { pts, t: 0, until: G.time + 0.8 + tr.caution * 1.4 };
    b.stats.slices++;
  }
  /* footsteps: walk (near silent, half pace) when it pays to be quiet. Lurkers and quiet
     roamers nearly always; careful players close to the enemy; never in a hurry */
  function wantWalk(a) {
    const b = a.bot, tr = TR(a);
    if (G.time < (b.walkT || 0)) return b.walkOn;
    b.walkT = G.time + 1.2 + Math.random();
    const S = situation(a.team), plan = AI.teams[a.team] || {};
    let on = false;
    if (GAME.phase === 'action' && !b.target && !a.carry && !urgentFor(a) && !S.late) {
      const near = (S.known && G.time - S.kt < 10 && U.dist3(S.known, a.pos) < 14) || (a.side === 'atk' && plan.objCenter && U.dist3(a.pos, plan.objCenter) < 13);
      on = (tr.stealth > 0.75 && (near || PID(a) === 'lurker' || b.role === 'roam')) || (near && Math.random() < tr.stealth * 0.8);
    }
    b.walkOn = on; if (on) b.stats.walk++;
    return on;
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
    // a laser on someone's gun (not aiming) shows from well off to the side
    const beam = t.isActor && t.wpn && t.wpn.def.laser && t.ads < 0.5 && d < 30;
    if (dot < (beam ? -0.2 : 0.25) && d > 3.5) return null;
    if (a.blind > 0.4 && a.blindK > 0.4) return null;
    if (!G.world.los(e, c)) {
      if (tp) return null;
      const cc = t.center(V()); if (!G.world.los(e, cc)) return null;
      if (FX.smokeBlocks(e, cc) || (window.OPS2 && OPS2.blocksSight(a, e, cc))) return null;
      return cc;
    }
    if (FX.smokeBlocks(e, c)) return null;
    // a ballistic curtain (either side), or a false wall (the attackers can't see through it)
    if (window.OPS2 && OPS2.blocksSight(a, e, c)) return null;
    // far + dark + crouched in shadow: harder to notice
    return c;
  }
  function perceive(a) {
    const b = a.bot, e = a.eye(V());
    let best = null, bd = 1e9, bp = null, vis = 0;
    const prep = GAME.phase === 'prep' && G.mode === 'match';
    const hurt = G.time - (b.hurtT || -99) < 2.5;
    const tr = TR(a), vulture = FL(a).vulture || PID(a) === 'opportunist';
    for (const t of G.actors) {
      if (t.team === a.team || t.state === 'dead' || t.hostage || t.dummy) continue;
      if (prep && t.side === 'atk') continue;   // attackers are droning, not on the field
      t.isActor = true;
      if (t.cloakT > 0 && U.dist3(e, t.pos) > 4) continue;       // a cloaked operator: only seen up close
      const p = canSee(a, t, e); if (!p) continue;
      let d = U.dist3(e, p);
      if (d > 7 && GAME.dark(a.team)) continue;                   // blackout: a few metres of sight
      vis++;
      // every enemy in sight is remembered a few seconds (what a lean must not show us to)
      const th = b.threats.find(x => x.a === t); if (th) { th.p.copy(p); th.t = G.time; } else b.threats.push({ a: t, p: p.clone(), t: G.time });
      // a target we've already poured shots into for nothing (behind a shield or cover the
      // bullets can't get through) is left alone for a while, unless it's close or hurting us
      if (b.futile && b.futile.get(t) > G.time && d > 6 && !hurt) continue;
      if (t === b.target) d *= 0.6;
      if (t.state === 'dbno') d *= 1.8;
      // who to shoot first: the careful deal with whoever is looking at them; an opportunist
      // goes for the hurt and the distracted (looking at someone else)
      const toMe = U.v1.copy(e).sub(t.pos).normalize(), facing = t.fwd(U.v2).dot(toMe) > 0.6;
      if (facing) d *= 1 - tr.caution * 0.25;
      if (vulture) { if (t.hp < t.maxHp * 0.5) d *= 0.55; if (!facing) d *= 0.7; }
      if (d < bd) { bd = d; best = t; bp = p; }
    }
    b.visN = vis;
    if (b.threats.length > 6 || (b.threats.length && G.time - b.threats[0].t > 8)) b.threats = b.threats.filter(x => G.time - x.t < 8 && x.a.state !== 'dead').slice(-6);
    // drones are targets for defenders
    if (!best && a.side === 'def') for (const t of G.ents) {
      if (!t.alive || t.type !== 'drone' || t.team === a.team) continue;
      if (U.dist3(e, t.pos) > 20) continue;
      const p = canSee(a, t, e); if (p) { best = t; bp = p; bd = U.dist3(e, p); break; }
    }
    if (best) {
      if (best !== b.target) {
        const d = diff();
        // positioning beats reflexes: someone who was already aiming at that spot (holding the
        // angle, pre-aiming a sound) is much quicker on it than someone caught walking; a bot
        // that is moving fast, or leaning out blind, is slower
        const to = U.v1.copy(bp).sub(e).normalize(), aimed = a.fwd(U.v2).dot(to);
        const pre = aimed > 0.985 ? 0.55 : aimed > 0.94 ? 0.75 : 1;
        const moving = (a.moving || 0) > 3 ? 1.15 : 1;
        b.reactT = d.react * U.rnd(0.75, 1.3) * tr.react * pre * moving * (b.alert > 0 ? 0.7 : 1) * (best.isActor ? 1 : 1.4);
        const steady = 1.1 - tr.aware * 0.2;
        b.errY = U.rnd(-1, 1) * d.aimErr * 2.2 * D2R * steady; b.errP = U.rnd(-1, 1) * d.aimErr * 1.4 * D2R * steady;
        b.wantHead = Math.random() < d.head * (0.8 + tr.aware * 0.4);
        b.target = best; b.burst = 0;
      }
      b.lastSeen = (best.pos || bp).clone(); b.lastSeenT = G.time; b.seenP = bp; b.alert = 6;
      if (best.isActor && G.time > (b.calloutT || 0)) { b.calloutT = G.time + 1.5; GAME.intel(best, a.team, 20); }
    } else if (b.target && (G.time - b.lastSeenT > 0.4)) {
      // contact broken: what now depends on who this is (contact() carries it on)
      if (b.target.isActor && b.target.state !== 'dead') startContact(a, b.target, b.lastSeen);
      else if (b.target.isActor) afterKill(a);
      b.target = null;
    }
    // enemy gadgets worth shooting
    b.entTarget = null;
    if (!best && a.wpn && a.side === 'atk' || !best && a.side === 'def') {
      for (const g of G.ents) {
        if (!g.alive || g.team === a.team || g.team < 0 || g.bulletproof || !GAD.TRAPS.has(g.type) && g.type !== 'drone' && g.type !== 'photon' && g.type !== 'beacon' && g.type !== 'claymore') continue;
        if (b.entIgnore && b.entIgnore.get(g) > G.time) continue;   // already tried and missed it
        if (g.type === 'drone' && a.side === 'atk') continue;
        // a body double looks like a defender holding an angle, a turret is a threat from further
        // off (and is noticed at once when it is the thing shooting you); Quill's scanner finds
        // traps at 25 m
        const gp = g.aimPos || g.pos, far = g.type === 'mannequin' ? 30 : g.type === 'turret' ? 20 : (a.op.ability && a.op.ability.id === 'scanner') ? 25 : 14;
        const d = U.dist3(e, gp); if (d > far) continue;
        const to = gp.clone().sub(e).normalize(); if (to.dot(a.fwd(V())) < 0.5 && !(g.type === 'turret' && hurt)) continue;
        if (!G.world.los(e, gp)) continue;
        if (d > 7 && GAME.dark(a.team)) continue;
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
    // the gun goes to where it came from: an aware player turns for footsteps too
    const tr = TR(a);
    if (U.dist3(pos, a.pos) < 25 && (type !== 'step' || Math.random() < 0.25 + tr.aware * 0.75)) b.attn = { p: pos.clone().setY(pos.y + 1.3), until: G.time + 1.2 + tr.aware * 2.5 };
  };
  /* should this bot walk over to a sound? The aggressive go to gunfire from further off, and
     the most aggressive to footsteps too; a defender only leaves its post for it if it roams */
  function chases(a, h) {
    const b = a.bot, f = FL(a);
    if (G.time < (b.deafUntil || 0)) return false;
    if (a.carry) return false;
    if (G.time - h.start > 9) { b.deafUntil = G.time + 6; b.heard = null; return false; }
    const d = U.dist3(h.pos, a.pos), loud = h.type === 'shot' || h.type === 'explosion';
    if (a.side === 'def') return b.role === 'roam' && (b.ag > 0.35 || f.chaseAll) && (loud || b.ag > 0.6) && d < 10 + 25 * b.ag;
    return (loud || ((f.chaseAll || b.ag > 0.75) && h.type === 'step')) && d < 8 + 22 * b.ag;
  }
  /* shot by someone it can't see: turn to it. A held position that has been found is given up
     by those willing to move */
  function shotFromNowhere(a) {
    const b = a.bot, s = a.hurtBy;
    if (!s || !s.pos || b.target) return;
    // no muzzle flash (a suppressor or flash hider) and it is much harder to tell where it came from
    const hid = s.wpn && s.wpn.def.noFlash ? 4.5 : 1.5;
    const p = s.pos.clone().add(V().set(U.rnd(-hid, hid), 1.3, U.rnd(-hid, hid)));
    b.attn = { p, until: G.time + 2.5 }; b.alert = 6;
    b.heard = { pos: s.pos.clone(), t: G.time, type: 'shot', start: G.time };
    if (b.hold && Math.random() < TR(a).repos + 0.3) { b.hold = null; b.holdRoom = null; b.holdLean = 0; b.goal = null; b.stats.relocs++; }
    // badly hurt and the shooter unseen: get out of their line first
    if (a.hp < a.maxHp * 0.5 && !b.contact) startContact(a, s, s.pos.clone(), 'retreat');
  }

  /* ------------------------------------------------------------- combat */
  function engage(a, dt) {
    const b = a.bot, t = b.target, d = diff();
    const tgtPos = b.seenP || (t.pos ? t.pos : t.eye(V()));
    let aim;
    if (t.isActor) {
      // the drawn head or chest: the hitboxes follow the model, so this is where hits land
      if (t.state === 'dbno' || t.stance === 2) aim = t.chestPos(V());
      else aim = b.wantHead ? t.headPos(V()) : t.chestPos(V());
      // lead a little
      aim.addScaledVector(t.vel, 0.05);
      // Marlow's spotter scope: whoever she has in her sights is marked for the team
      if (a.op.ability && a.op.ability.id === 'spotter' && t.state === 'alive' && G.time > (b.spotT || 0)) { b.spotT = G.time + 3; GAME.mark(t, a.team, 6, true); }
    } else aim = t.pos.clone();
    // error decays toward a residual wobble
    b.errY *= Math.exp(-dt * 1.4); b.errP *= Math.exp(-dt * 1.4);
    const e = a.eye(V());
    const dx = aim.x - e.x, dy = aim.y - e.y, dz = aim.z - e.z, dist = Math.hypot(dx, dy, dz);
    // the sight on the gun: magnification steadies the aim at range, and a scope up close is
    // slow to track (attachments, attach.js)
    const zoom = a.wpn ? ATT.zoom(a.wpn.def.sight, a.zoom4) : 1, aiming = a.ads > 0.6;
    const steadyK = aiming && dist > 12 ? 1 / (1 + (zoom - 1) * 0.35) : 1;
    const trackK = aiming && dist < 7 && zoom >= 2.4 ? 0.7 : 1;
    const wob = d.aimErr * 0.35 * D2R * steadyK;
    const yaw = Math.atan2(-dx, -dz) + b.errY * steadyK + Math.sin(G.time * 3.1 + a.id) * wob;
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + b.errP * steadyK + Math.sin(G.time * 2.3 + a.id * 2) * wob * 0.6;
    const k = 1 - Math.exp(-d.track * trackK * dt * (a.stun > 0 ? 0.4 : 1));
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
    // bursts at range: a gun that kicks less (grips, brake, compensator) holds a longer one
    if (fire && w && w.def.auto && dist > 14) {
      const len = 0.45 / (w.def.recoilK || 1);
      b.burst += dt; if (b.burst > len) { fire = false; if (b.burst > len + 0.3) b.burst = 0; }
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
    watch(a, aim, 'fight');
    if (b.shootAt == null || U.dist2(a.pos, b.shootFrom || a.pos) > 2) { b.shootFrom = a.pos.clone(); b.shootAt = G.time; }
    // ---- how to fight it: re-thought a few times a second, not every frame
    if (G.time >= (b.cmT || 0)) { b.cmT = G.time + 0.25 + Math.random() * 0.15; combatPlan(a, t, dist); }
    combatMove(a, t, dist, dt);
    if (w.mag === 0 && w.reserve === 0 && a.w[1]) WPN.swap(a, 1);
  }
  /* the fight, by who this is and how it is going.
       retreat  hurt / alone against two / reloading up close (and not too proud to): back off
                out of their sight, then come again (contact())
       peek     there is cover beside us: stand behind it and lean out to shoot, back in to
                reload or after taking hits (jiggle)
       push     the aggressive, with the odds: close the distance, wide and fast
       hold     anchors and marksmen on their spot: still, crouched, let them come
       duel     no cover, no reason to move: strafe it out */
  function combatPlan(a, t, dist) {
    const b = a.bot, tr = TR(a), f = FL(a), w = a.wpn, S = situation(a.team);
    mood(a);
    const hpK = a.hp / a.maxHp;
    const allies = G.actors.filter(x => x !== a && x.team === a.team && x.state === 'alive' && !x.hostage && U.dist3(x.pos, a.pos) < 9).length;
    const outnumbered = b.visN >= 2 && allies === 0;
    const tHurt = t.isActor && (t.state === 'dbno' || t.hp < t.maxHp * 0.45);
    const dry = w.reload > 0 || (w.def.heat ? w.vent > 0 || w.heat > 0.86 : w.mag <= Math.max(1, w.def.mag * 0.12));
    const critical = (b.task && b.task.critical) || (a.side === 'def' && S.threat && GAME.obj.defuser && GAME.obj.defuser.alive && U.dist3(a.pos, GAME.obj.defuser.pos) < 12);
    let fear = (1 - hpK) * 1.3 + (outnumbered ? 0.7 : 0) + (dry && dist < 12 ? 0.6 : 0) + Math.max(0, b.visN - 1) * 0.25 + (a.carry ? 0.35 : 0)
      - tr.conf * 0.8 - tr.risk * 0.4 - (tHurt ? 0.4 : 0) - allies * 0.15 - b.morale * 0.2
      + (a.supT > G.time ? 0.8 - tr.conf * 0.3 : 0);   // pinned down by suppressive fire: stay in cover
    const prev = b.fight && b.fight.t === t ? b.fight : null;
    let mode = 'duel';
    if (t.isActor && fear > 0.55 && !critical && dist > 2.5) mode = 'retreat';
    else {
      // cover to fight from: looked for now and then, kept while it still works
      let pk = prev && prev.peek && U.dist3(prev.peek.P, b.seenP || t.pos) < 2.5 ? prev.peek : null;
      if (!pk && t.isActor && dist > 4.5 && G.time > (b.peekCd || 0) && Math.random() < 0.25 + tr.cover * 0.75) {
        b.peekCd = G.time + 1.5;
        pk = coverPeek(a, (b.seenP || t.eye(V())).clone(), 0.6 + tr.cover * 1.0);
      }
      const holder = (a.side === 'def' && b.role !== 'roam' && b.hold && U.dist2(a.pos, b.hold) < 2.5) || (PID(a) === 'marksman' && dist > 8) || f.perch;
      if (pk && (tr.cover > 0.4 || hpK < 0.6)) { mode = 'peek'; b.fpeek = pk; }
      else if (b.ag > 0.6 && (dist > tr.range * 0.8 || tHurt || f.closeQuarters && dist > 3.5) && !holder) mode = 'push';
      else if (holder || (tr.patience > 0.75 && b.ag < 0.45)) mode = 'hold';
    }
    if (mode === 'retreat' && (!prev || prev.mode !== 'retreat')) {
      const spot = hideFrom(a, (b.seenP || t.pos).clone(), 7);
      if (!spot) mode = 'duel'; else { b.retreatTo = spot; b.stats.retreats++; }
    }
    if (!prev || prev.mode !== mode) b.fight = { t, mode, since: G.time, peek: mode === 'peek' ? b.fpeek : null, out: true, cyc: G.time + U.rnd(0.6, 1.4) * (0.6 + b.ag) };
    else if (mode === 'peek') prev.peek = b.fpeek || prev.peek;
  }
  function combatMove(a, t, dist, dt) {
    const b = a.bot, tr = TR(a), F = b.fight || { mode: 'duel' }, w = a.wpn;
    a.sprint = false; a.mf = a.mr = 0;
    const toward = (p, k) => { const dx = p.x - a.pos.x, dz = p.z - a.pos.z; steer(a, dx, dz, k); };
    switch (F.mode) {
      case 'retreat': {
        const s = b.retreatTo;
        if (s && U.dist2(a.pos, s) > 0.35) { toward(s, 1); a.trigger = a.trigger && dist < 6; }
        else { F.mode = 'duel'; startContact(a, t, (b.seenP || t.pos).clone(), 'retreat'); }
        if (a.stance !== 0) a.setStance(0);
        return;
      }
      case 'peek': {
        const pk = F.peek;
        if (!pk) { F.mode = 'duel'; return; }
        if (U.dist2(a.pos, pk.pos) > 0.3) { toward(pk.pos, 0.8); return; }
        // in position: lean out to shoot, back in (body and head hidden) to reload, after
        // being hit, or for a beat between bursts; a patient player stays in longer
        const hit = G.time - (b.hurtT || -99) < 0.35;
        if (F.out && (G.time > F.cyc || w.reload > 0 || hit)) { F.out = false; F.cyc = G.time + U.rnd(0.35, 0.9) * (0.6 + tr.caution); }
        else if (!F.out && G.time > F.cyc && w.reload <= 0) { F.out = true; F.cyc = G.time + U.rnd(0.6, 1.5) * (0.6 + b.ag); b.stats.peeks++; }
        b.leanReq = F.out ? pk.side : 0;
        if (!F.out) a.trigger = false;
        if (dist > 9 && tr.cover > 0.6 && a.stance === 0 && a.canStand(1.2)) a.setStance(1);
        return;
      }
      case 'push': {
        b.strafeT -= dt;
        if (b.strafeT <= 0) { b.strafeT = U.rnd(0.25, 0.7); b.strafeDir = Math.random() < 0.5 ? -1 : 1; }
        a.mf = dist > 2.5 ? 1 : 0; a.mr = b.strafeDir * 0.8;
        if (a.stance !== 0) a.setStance(0);
        // a crouch-spam at close range
        if (dist < 7 && tr.aggr > 0.7 && Math.random() < dt * 1.5) a.setStance(a.stance ? 0 : 1);
        return;
      }
      case 'hold': {
        b.strafeT -= dt;
        if (b.strafeT <= 0) { b.strafeT = U.rnd(0.6, 1.6); b.strafeDir = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
        a.mr = b.strafeDir * 0.4;
        if (dist > 5 && a.stance === 0) a.setStance(1);
        // too close for a long-range player: give ground
        if (dist < tr.range * 0.3 && tr.range > 14) a.mf = -0.7;
        return;
      }
      default: {
        b.strafeT -= dt;
        if (b.strafeT <= 0) { b.strafeT = U.rnd(0.35, 1.1); b.strafeDir = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.25 + (1 - b.ag) * 0.2) b.strafeDir = 0; }
        const S = situation(a.team);
        const pushing = a.side === 'atk' && b.role !== 'hold' && b.ag > 0.3 && (dist > tr.range * 1.2 || (dist > 3.5 && (S.late || S.mode === 'hunt')));
        a.mr = b.strafeDir * (dist < 3 ? 1 : 0.7);
        a.mf = pushing ? 0.5 : dist < tr.range * 0.35 && tr.range > 14 ? -0.6 : 0;
        if (dist > 12 && a.stance === 0 && Math.random() < dt * (0.2 + tr.caution * 0.6) && !a.shieldOp) a.setStance(1);
        if (dist < 6 && a.stance === 1 && Math.random() < dt) a.setStance(0);
      }
    }
  }

  /* ---------------------------------------------------- after contact breaks */
  /* the enemy went out of sight. What a player does next is who they are:
       hold     wait on the angle they went round, leaning to see it, a few seconds
       peek     go on peeking from the same cover
       push     follow them round the corner
       flank    come at that spot from another way
       retreat  (it was going badly) get out of sight, reload, then hold the way they'd come
       relocate move somewhere they don't know about, then carry on */
  function startContact(a, t, pos, force) {
    const b = a.bot, tr = TR(a), f = FL(a), F = b.fight && b.fight.t === t ? b.fight : null;
    if (!pos) return;
    let mode = force;
    if (!mode) {
      if (F && F.mode === 'retreat') mode = 'retreat';
      else if (F && F.mode === 'peek' && F.peek) mode = 'peek';
      else if (b.ag > 0.7 || (f.chaseAll && b.ag > 0.5)) mode = 'push';
      else if ((PID(a) === 'flanker' || PID(a) === 'opportunist' || PID(a) === 'lurker') && tr.repos > 0.5 && U.dist3(a.pos, pos) > 6) mode = 'flank';
      else if (tr.repos > 0.6 && Math.random() < tr.repos * 0.6) mode = 'relocate';
      else mode = 'hold';
    }
    const len = mode === 'push' ? 6 : mode === 'flank' ? 14 : 3 + tr.patience * 7;
    b.contact = { t, pos: pos.clone(), mode, until: G.time + len, since: G.time, peek: F && F.peek, out: false, cyc: G.time + U.rnd(0.4, 1) };
    if (mode === 'relocate' || mode === 'flank') b.stats.relocs++;
  }
  function afterKill(a) {
    const b = a.bot, tr = TR(a);
    b.fight = null;
    // just fired from here, and they know it: some move on before the next one comes
    if (Math.random() < tr.repos * 0.8 && G.time - (b.shootAt || 0) > 1) {
      b.contact = { t: null, pos: b.lastSeen ? b.lastSeen.clone() : a.pos.clone(), mode: 'relocate', until: G.time + 6, since: G.time };
      b.stats.relocs++;
      if (b.hold && a.side === 'def') { b.hold = null; b.holdRoom = null; b.holdLean = 0; }
    }
  }
  /* returns true while the contact posture has the bot */
  function contact(a, dt) {
    const b = a.bot, c = b.contact;
    if (!c) return false;
    if (G.time > c.until || urgentFor(a) || (c.t && c.t.isActor && c.t.state === 'dead')) { b.contact = null; return false; }
    const tr = TR(a), w = a.wpn;
    const look = c.pos.clone().setY(c.pos.y + 1.4);
    if (w && w.mag < w.def.mag * 0.6 && w.reserve > 0 && w.reload <= 0 && c.mode !== 'push') WPN.reload(a);
    switch (c.mode) {
      case 'peek': {
        const pk = c.peek;
        if (!pk) { c.mode = 'hold'; return true; }
        if (U.dist2(a.pos, pk.pos) > 0.3) { if (!b.goal || b.goalKind !== 'peek') AI.moveTo(a, pk.pos, 'peek'); follow(a, dt, false); faceTo(a, look, dt, 8); return true; }
        a.mf = a.mr = 0; faceTo(a, look, dt, 9); watch(a, look, 'cpeek');
        if (G.time > c.cyc) { c.out = !c.out; c.cyc = G.time + (c.out ? U.rnd(0.8, 1.8) : U.rnd(0.5, 1.2) * (0.6 + tr.caution)); if (c.out) b.stats.peeks++; }
        b.leanReq = c.out ? pk.side : 0;
        return true;
      }
      case 'hold': {
        a.mf = a.mr = 0; faceTo(a, look, dt, 8); watch(a, look, 'chold');
        if (tr.caution > 0.5 && a.stance === 0 && U.dist3(a.pos, c.pos) > 5) a.setStance(1);
        return true;
      }
      case 'retreat': {
        const s = b.retreatTo;
        if (s && U.dist2(a.pos, s) > 0.35 && G.time - c.since < 4) {
          const dx = s.x - a.pos.x, dz = s.z - a.pos.z; faceTo(a, look, dt, 6); steer(a, dx, dz, 1); return true;
        }
        // out of sight: patch up, then hold the way they'd come
        if (a.gadget && a.gadget.id === 'stim' && a.gadget.count > 0 && a.hp < a.maxHp * 0.6 && a.busy <= 0) GAD.secondary(a);
        a.mf = a.mr = 0; faceTo(a, look, dt, 7); watch(a, look, 'cret');
        if (a.stance === 0 && a.canStand(1.2)) a.setStance(1);
        return true;
      }
      case 'push': {
        if (U.dist2(a.pos, c.pos) < 1.2) { b.contact = null; return false; }
        if (!b.goal || b.goalKind !== 'cpush' || U.dist3(b.goal, c.pos) > 1) AI.moveTo(a, c.pos, 'cpush');
        if (follow(a, dt)) { b.contact = null; return false; }
        return true;
      }
      case 'flank':
      case 'relocate': {
        if (!c.spot) {
          c.spot = c.mode === 'flank' ? flankSpot(a, c.pos) : hideFrom(a, c.pos.clone().setY(c.pos.y + 1.5), 8);
          if (!c.spot) { c.mode = 'hold'; return true; }
          AI.moveTo(a, c.spot, 'reloc', { avoid: avoidNear([c.pos], 5, 3) });
        }
        if (follow(a, dt)) { if (c.mode === 'flank') { c.mode = 'hold'; c.until = G.time + 3 + tr.patience * 5; return true; } b.contact = null; return false; }
        return true;
      }
    }
    return false;
  }
  /* somewhere off to the side of p, 5-8 m away, from where it can be seen (an angle they won't
     be watching) */
  function flankSpot(a, p) {
    const dx = p.x - a.pos.x, dz = p.z - a.pos.z, L = Math.hypot(dx, dz) || 1, rx = -dz / L, rz = dx / L, s = Math.random() < 0.5 ? -1 : 1;
    for (const sg of [s, -s]) for (const k of [6, 4.5, 8]) {
      const c = V().set(p.x + rx * k * sg - dx / L * 2, p.y, p.z + rz * k * sg - dz / L * 2);
      const n = NAV.nearest(c, 3); if (n < 0) continue;
      const q = NAV.nodePos(n); if (Math.abs(q.y - p.y) > 1.5) continue;
      if (G.world.los(V().set(q.x, q.y + 1.6, q.z), V().set(p.x, p.y + 1.3, p.z))) return q;
    }
    return null;
  }
  /* a route cost that keeps away from some points (known enemies, teammates' line) */
  function avoidNear(pts, r, cost) {
    const P = V();
    return n => { NAV.nodePos(n, P); let c = 0; for (const p of pts) { const d = U.dist2(P, p); if (d < r) c += cost * (1 - d / r); } return c; };
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
      if (tk.hurry) a.walk = false;            // (a job that has to happen: no creeping there)
      tk.travel = (tk.travel || 0) + dt;
      if (tk.travel > (tk.maxTravel || 25)) { b.task = null; }
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
    a.trigger = false; a.adsWant = false; a.walk = false;
    b.focus = null; b.leanReq = null;
    if (a.state !== 'alive') { a.leanT = 0; b.leanCur = 0; if (a.state === 'dbno') a.mf = a.mr = 0; return; }
    decide(a, dt);
    leanCtl(a, dt);
  };
  function decide(a, dt) {
    const b = a.bot;
    if (b.lastHp != null && a.hp < b.lastHp) { b.hurtT = G.time; if (!b.target) shotFromNowhere(a); }
    b.lastHp = a.hp;
    // a defender caught in irritant haze gets out of it instead of holding the spot
    if (a.side === 'def' && a.hazeT && G.time - a.hazeT < 0.6 && b.hold && U.dist2(a.pos, b.hold) < 4.5) { b.hold = null; b.holdRoom = null; b.goal = null; }
    b.alert = Math.max(0, b.alert - dt);
    b.think -= dt;
    if (b.think <= 0) { b.think = 0.12 + Math.random() * 0.08; perceive(a); if (Math.random() < 0.3) mood(a); }
    const phase = GAME.phase;
    if (phase === 'prep' && a.side === 'atk') { a.mf = a.mr = 0; if (AI.droneThink) AI.droneThink(a, dt); return; }
    if (phase === 'post' || phase === 'end') { a.mf = a.mr = 0; return; }
    // Tusk: head down, straight at the wall, until it gives or the charge runs out
    if (b.ramRun) {
      if (G.time > b.ramRun.until || a.ramT <= 0) b.ramRun = null;
      else { a.yaw = b.ramRun.yaw; a.pitch = 0; if (a.stance) a.setStance(0); a.mf = 1; a.mr = 0; a.sprint = true; return; }
    }
    // Moor: hurt and far from home, snap back to the anchor
    if (a.ability && a.ability.id === 'recall' && a.anchor && a.anchor.alive && a.busy <= 0 && a.hp < a.maxHp * 0.45 && G.time - (b.hurtT || -99) < 2 && U.dist3(a.pos, a.anchor.pos) > 8) {
      if (GAD.ability(a)) { b.goal = null; b.path = null; b.target = null; b.roamGoal = null; return; }
    }
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
    if (b.fight && (!b.target)) b.fight = null;
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
      const g = b.entTarget, off = faceTo(a, g.aimPos || g.pos, dt, 7);
      a.mf = a.mr = 0;
      if (off < 0.06) {
        if (a.ability && a.ability.id === 'hijack' && a.ability.count > 0 && g.elec && a.busy <= 0) { GAD.ability(a); b.entTarget = null; }
        else if (window.OPS2 && OPS2.aiEntTarget(a, g)) b.entTarget = null;
        else a.trigger = true;
      }
      return;
    }
    // reload in a lull
    const w = a.wpn;
    if (w && w.mag < w.def.mag * 0.4 && w.reserve > 0 && w.reload <= 0) WPN.reload(a);
    if (w && w.mag === 0 && w.reserve === 0 && a.cur === 0 && a.w[1]) WPN.swap(a, 1);
    // revive a downed friend nearby: team players go further for it, and a lone wolf won't walk
    // into a fight for it
    if (!b.task || !b.task.critical) {
      const tr = TR(a), reach = FL(a).medic ? 30 : 6 + tr.team * 18;
      const hot = otherThreats(a).length > 0 && tr.team < 0.6;
      const down = !hot && G.actors.find(t => t.team === a.team && t.state === 'dbno' && !t.hostage && U.dist3(t.pos, a.pos) < reach && !G.actors.some(o => o !== a && o.bot && o.bot.task && o.bot.task.reviving === t));
      if (down && (!b.task || !b.task.reviving)) {
        b.task = { at: down.pos.clone(), r: 0.9, look: down.pos.clone(), time: 5, reviving: down, critical: true, run: () => { if (down.state === 'dbno') down.revive(a); } };
        b.taskT = 0; b.contact = null;
      }
    }
    // the fight just went out of sight: hold it, peek it, chase it, or go round
    if (!(b.task && b.task.critical) && contact(a, dt)) return;
    a.walk = wantWalk(a);
    if (!b.task) supplyRun(a);   // between jobs, not only once the list is empty
    if (b.task || nextTask(a)) { if (runTask(a, dt)) return; }
    // at the wall under a window entry: vault in, or hook on
    if (b.winStep) { if (windowStep(a, dt)) return; }
    // job from the team plan
    AI.job(a, dt);
  }

  /* team supplies: every defender collects the +40 overheal from a friendly Med Station once,
     and a hurt attacker walks into a friendly Field Beacon's healing */
  function supplyRun(a) {
    const b = a.bot;
    if (G.time < (b.supplyT || 0) || a.carry || GAME.phase === 'post') return;
    b.supplyT = G.time + 1.5 + Math.random();
    if (urgentFor(a)) return;
    for (const g of G.ents) {
      if (!g.alive || g.team !== a.team) continue;
      let need = false, stay = 0.5;
      if (g.type === 'medstation') need = g.uses > 0 && !g.used.has(a);
      else if (g.type === 'beacon') { need = a.hp < a.maxHp * 0.7 && U.dist3(a.pos, g.pos) > 3; stay = 3; }
      if (!need || U.dist3(a.pos, g.pos) > 45) continue;
      const n = NAV.nearest(g.pos.clone().add(V().set(Math.sin(a.id) * 0.8, 0, Math.cos(a.id) * 0.8)), 2); if (n < 0) continue;
      const at = NAV.nodePos(n); if (U.dist3(at, g.pos) > 1.5) continue;
      b.task = { at, look: g.pos.clone().setY(g.pos.y + 0.4), time: stay, r: 0.7, run: x => { if (g.alive && g.type === 'medstation') g.use(x); } }; b.taskT = 0;
      return;
    }
  }
  AI.supplyRun = supplyRun;
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
      else { const hp = b.heard.pos.clone().setY(b.heard.pos.y + 1.4); faceTo(a, hp, dt, 4); watch(a, hp, 'heard'); a.mf = a.mr = 0; if (b.holdLean && TR(a).cover > 0.4) b.leanReq = b.holdLean; return; }
    } else b.freezeAt = 0;
    // last seen enemy close by: attackers push it, defenders recheck it if roaming. Far-off intel
    // (drone spots, callouts across the map) is just information for the team's picture: sending
    // everyone who heard it to the same spot is what made whole teams walk in a line. Only those
    // with the appetite for it go looking (the rest hold, or wait for it to come to them)
    const tr = TR(a);
    if (!urgent && b.lastSeen && G.time - b.lastSeenT < 8 && G.time - b.lastSeenT > 1.2 && !a.carry && ((a.side === 'atk' && b.ag > 0.35) || (b.role === 'roam' && b.ag > 0.3)) && U.dist3(a.pos, b.lastSeen) < 6 + b.ag * 12) {
      if (!b.goal || b.goalKind !== 'last') AI.moveTo(a, b.lastSeen, 'last');
      if (follow(a, dt)) b.lastSeen = null;
      return;
    }
    const goal = plan.goalFor ? plan.goalFor(a) : null;
    if (!goal) { a.mf = a.mr = 0; return; }
    if (goal.pos) {
      const close = U.dist2(a.pos, goal.pos) < (goal.r || 0.5) && Math.abs(a.pos.y - goal.pos.y) < 1.2;
      if (!close) {
        if (!b.goal || U.dist3(b.goal, goal.pos) > 0.6 || b.goalKind !== goal.kind) AI.moveTo(a, goal.pos, goal.kind, goal.route);
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
        a.sprint = !!goal.sprint && !b.alert && !a.walk;
        if (b.alert > 0 && a.side === 'atk') a.sprint = false;
        return;
      }
      a.mf = a.mr = 0;
      // in place. Something heard (or a shot from nowhere) gets the gun first; otherwise the
      // angle this spot is for
      const lookAt = b.attn && G.time < b.attn.until ? b.attn.p : goal.look;
      if (lookAt) { faceTo(a, lookAt, dt, lookAt === goal.look ? 4 : 7); if (GAME.phase === 'action') watch(a, lookAt, lookAt === goal.look ? 'goal' + goal.kind : 'attn'); }
      if (goal.act) goal.act(a, dt);
      if (goal.crouch && a.stance === 0) a.setStance(1);
      // holding an angle from cover: lean out to watch it with only a head and shoulder showing.
      // Calm, a careful player rests behind the wall now and then; alert, it stays out
      if (goal.lean && GAME.phase === 'action' && lookAt === goal.look) {
        const alert = b.alert > 0 || (b.heard && G.time - b.heard.t < 6);
        if (G.time > (b.holdCyc || 0)) { b.holdOut = alert || Math.random() < 0.55 + tr.patience * 0.35; b.holdCyc = G.time + (b.holdOut ? U.rnd(2.5, 6) : U.rnd(0.6, 1.4)); }
        b.leanReq = b.holdOut || alert ? goal.lean : 0;
      }
      // marksmen and careful anchors settle low on a long angle
      if (GAME.phase === 'action' && goal.kind === 'hold' && tr.cover > 0.7 && tr.range > 12 && a.stance === 0 && Math.random() < dt * 0.5) a.setStance(1);
    }
  };

  /* ------------------------------------------------------- kit usage */
  AI.useKit = function (a, dt) {
    const b = a.bot; b.util -= dt;
    if (b.util > 0 || GAME.phase !== 'action') return;
    b.util = (b.target ? 0.5 : 1) + Math.random();   // quicker on the draw with kit while in a fight
    const ab = a.ability, g = a.gadget;
    const plan = AI.teams[a.team] || {};
    const obj = plan.objCenter;
    const nearObj = obj && U.dist3(a.pos, obj) < 18;
    // nothing lethal goes off near the hostage: harming them loses the round
    const hz = GAME.obj && GAME.obj.hostage;
    const safe = p => !(hz && hz.state !== 'dead' && p && U.dist3(hz.pos, p) < 6);
    const S = situation(a.team), act = GAME.phase === 'action';
    // Vesper sonar: near the objective, once inside, or while hunting the last defenders
    if (ab && ab.id === 'sonar' && ab.cd <= 0 && (nearObj || b.entered || S.mode === 'hunt')) GAD.ability(a);
    // ---- seasons 10-14 (js/ops2.js)
    if (window.OPS2 && OPS2.aiUse(a, b, { plan, obj, S, nearObj, ab, g, safe })) return;
    // ---- seasons 4-9
    if (ab && act) {
      // Wraith: cloak for the last stretch to the objective
      if (ab.id === 'cloak' && ab.count > 0 && a.cloakT <= 0 && !b.target && obj && U.dist3(a.pos, obj) < 22 && (b.entered || GAME.arcade)) { GAD.ability(a); return; }
      // Dynamo: Overdrive as the fight starts
      if (ab.id === 'overdrive' && ab.count > 0 && a.odT <= 0 && a.exhT <= 0 && (b.target && b.target.isActor || (b.alert > 0 && nearObj && b.entered))) { GAD.ability(a); return; }
      // Gaff: drag a defender out of where they are holding
      if (ab.id === 'harpoon' && ab.count > 0 && b.target && b.target.isActor && b.target.state === 'alive') {
        const t = b.target, d = U.dist3(a.pos, t.pos);
        if (d > 5 && d < 15 && Math.random() < 0.75 && G.world.los(a.eye(V()), t.chestPos(V()))) { faceTo(a, t.chestPos(V()), 1, 99); GAD.ability(a); return; }
      }
      // Triad: a listening post on the way in, another once inside
      if (ab.id === 'triang' && ab.count > 0 && !b.target && obj && U.dist3(a.pos, obj) < 24 && G.time > (b.triT || 0)) {
        const p = V().set(a.pos.x, G.world.groundBelow(a.pos.x, a.pos.y + 0.5, a.pos.z) + 0.01, a.pos.z);
        GAD.deployAt(a, 'triang', p, null, a.yaw); ab.count--; b.triT = G.time + 25; return;
      }
      // Nox: lights out when the attack is on the objective
      if (ab.id === 'blackout' && ab.count > 0 && !(GAME.blackout && GAME.blackout.until > G.time)) {
        const close = S.known && obj && U.dist3(S.known, obj) < 12 && G.time - S.kt < 6;
        if (S.threat || close) { GAD.ability(a); return; }
      }
      // Moor: no anchor out, and standing in a site room: set one before roaming again
      if (ab.id === 'recall' && ab.count > 0 && !(a.anchor && a.anchor.alive) && !b.target && plan.rooms && plan.rooms.includes(G.map.roomAt(a.pos))) {
        GAD.deployAt(a, 'anchor', V().set(a.pos.x, a.pos.y + 0.01, a.pos.z)); return;
      }
    }
    // Halcyon: a beacon where someone is down, or when she is badly hurt herself
    if (ab && ab.id === 'beacon' && ab.count > 0 && !b.target && (a.hp < a.maxHp * 0.55 || G.actors.some(t => t.team === a.team && t.state === 'dbno' && U.dist3(t.pos, a.pos) < 5))) { GAD.ability(a); return; }
    // ---- the second kit
    // a stim shot when hurt and nobody is shooting
    if (g && g.id === 'stim' && g.count > 0 && !b.target && a.hp < a.maxHp * 0.55 && a.busy <= 0) { GAD.secondary(a); return; }
    // an EMP on the nearest live defender electronics: in sight, or close enough to lob it blind
    if (g && g.id === 'emp' && g.count > 0 && a.busy <= 0) {
      let best = null, bd = 15;
      const eye = a.eye(V());
      for (const e of G.ents) {
        if (!e.alive || !e.elec || e.team === a.team || e.team < 0 || e.empT > G.time || e.type === 'drone') continue;
        const dd = U.dist3(a.pos, e.pos);
        if (dd < 3.5 || dd >= bd || Math.abs(e.pos.y - a.pos.y) > 2.5) continue;
        if (dd > 8 && !G.world.los(eye, e.pos.clone().setY(e.pos.y + 0.3))) continue;
        best = e; bd = dd;
      }
      if (best && Math.random() < 0.6) { lobAt(a, best.pos); GAD.secondary(a); return; }
    }
    // a fog canister: set it off when an attacker is on top of it, or when the defuser goes down beside it
    if (g && g.id === 'fog') {
      const can = a.placed.find(e => e.alive && e.type === 'fog' && e.detonate && e.stuck && !(e.empT > G.time));
      if (can) {
        const near = G.actors.some(t => t.team !== a.team && t.state === 'alive' && !t.hostage && U.dist3(t.pos, can.pos) < 6.5);
        const df = GAME.obj && GAME.obj.defuser && GAME.obj.defuser.alive ? GAME.obj.defuser : null;
        if (near || (df && U.dist3(df.pos, can.pos) < 8)) { can.detonate(); return; }
      } else if (g.count > 0 && !b.target && obj && U.dist3(a.pos, obj) < 6 && a.busy <= 0 && Math.random() < 0.3) {
        // none set in prep (or it was shot): stick one down where we are holding
        GAD.deployAt(a, 'fog', V().set(a.pos.x, a.pos.y + 0.05, a.pos.z)); g.count--; return;
      }
    }
    // a claymore behind you once you are in position (holding the plant, or set up on the objective)
    if (g && g.id === 'claymore' && g.count > 0 && act && !b.target && a.side === 'atk' && obj && U.dist3(a.pos, obj) < 10 && (S.planted || b.entered) && Math.random() < 0.3) {
      const yaw = Math.atan2(-(a.pos.x - obj.x), -(a.pos.z - obj.z));   // facing away from the objective
      const p = V().set(a.pos.x - Math.sin(yaw) * 0.9, a.pos.y, a.pos.z - Math.cos(yaw) * 0.9); p.y = G.world.groundBelow(p.x, a.pos.y + 0.5, p.z) + 0.01;
      if (Math.abs(p.y - a.pos.y) < 0.4 && NAV.walkable(p)) { GAD.deployAt(a, 'claymore', p, null, yaw); g.count--; return; }
    }
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
    for (const x of G.actors) if (x.team === team && x.bot && x.state === 'alive' && x.bot.lastSeen && x.bot.lastSeenT > S.kt && !(x.jamT > G.time)) { S.kt = x.bot.lastSeenT; S.known = x.bot.lastSeen; }
    for (const t of G.actors) if (t.team !== team && t.state === 'alive' && !t.hostage && GAME.marked(t, team) && G.time > S.kt) { S.kt = G.time; S.known = t.pos.clone(); }
    if (window.OPS2) OPS2.sitHook(S, team);   // seasons 10-14: phantom contacts, seismic rings
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
      for (const a of G.actors) if (a.bot && !AI.teams[a.team]) AI.teams[a.team] = { side: a.side, team: a.team, bots: G.actors.filter(x => x.team === a.team && x.bot), goalFor: ARC.goal, cleared: new Map() };
      return;
    }
    const obj = GAME.obj;
    for (const team of [0, 1]) {
      const side = GAME.sideOf(team), bots = G.actors.filter(a => a.team === team && a.bot);
      const plan = AI.teams[team] = { side, bots, team, cleared: new Map(), intel: [] };
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
        // the drones are parked where they stopped; what they saw is the team's intel now
        // (AI.droneThink): a careful player whose way in turned out to be held picks another
        for (const a of plan.bots) { const d = a.bot && a.bot.drone; if (d && d.alive) { d.pilot = null; d.mf = d.mr = 0; } if (a.bot) a.bot.drone = null; }
        AI.droneIntelEntries(plan);
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
    // roles: who roams and who anchors comes from who they are (entry players, flankers and
    // lurkers roam; anchors, marksmen, support and tacticians hold), 1-2 roamers, the rest anchors
    U.shuffle(bots);
    const ROAM = { entry: 0.9, flanker: 0.9, lurker: 1, opportunist: 0.55, tactical: 0.25, support: 0.1, marksman: 0.1, anchor: 0 };
    const maxRoam = bots.length >= 4 ? 2 : bots.length >= 2 ? 1 : 0;
    const keen = bots.filter(a => !['anvil', 'brick', 'tamsin'].includes(a.op.id)).map(a => [a, (ROAM[PID(a)] || 0.3) + Math.random() * 0.35]).sort((p, q) => q[1] - p[1]);
    bots.forEach(a => { a.bot.role = 'anchor'; a.bot.tasks = []; });
    keen.slice(0, maxRoam).forEach(([a, s], i) => { if (s > 0.45 || i === 0 && bots.length >= 2) a.bot.role = 'roam'; });
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
    const b = a.bot, tr = TR(a), f = FL(a), pid = PID(a);
    if (b.hold && b.holdRoom) {
      // a Shifter (or anyone willing to move, after a while) takes up a different angle
      const stay = f.bedrock ? 1e9 : 15 + (1 - tr.repos) * 60;
      if (GAME.phase !== 'action' || G.time - (b.holdSince || 0) < stay || b.target || b.contact) return b.hold;
      b.hold = null; b.stats.relocs++;
    }
    // anchors share the site rooms out between them, keep a few metres apart (one grenade or
    // one spray shouldn't take two), and each holds a different doorway: a crossfire, not a stack
    const anchors = plan.bots.filter(x => x.bot && x.bot.role !== 'roam');
    const r = b.holdRoom && f.shift ? U.pick(plan.rooms) : plan.rooms[Math.max(0, anchors.indexOf(a)) % plan.rooms.length];
    const mates = plan.bots.filter(x => x !== a && x.state === 'alive' && x.bot && x.bot.hold);
    let best = null, bs = -1e9;
    const ents = roomOpenings(r);
    for (let i = 0; i < 14; i++) {
      const p = NAV.randomIn(r);
      // prefer spots set back from the entries (an off-angle) that still see one. A marksman
      // wants the longest look at a doorway it can get; a Last Line anchor sits deep; support
      // stays near the other anchors to trade
      let s = 0;
      for (const op of ents) {
        const c = GAD.opCenter(op), d = U.dist2(c, p), sees = G.world.los(p.clone().setY(p.y + 1.5), c);
        s += Math.min(d, pid === 'marksman' ? 14 : f.deep ? 9 : 6) * (pid === 'marksman' ? 0.6 : 0.4);
        if (sees) s += 1 + (pid === 'marksman' ? d * 0.15 : 0);
      }
      for (const m of mates) { const d = U.dist2(m.bot.hold, p); s += pid === 'support' ? -Math.abs(d - 4) * 0.5 : Math.min(d, 5) * 0.5 - (d < 2.5 ? 3 : 0); }
      for (const g of G.ents) if (g.alive && g.type === 'irritant' && g.team !== a.team && U.dist2(g.pos, p) < g.r + 1) s -= 6;
      if (b.lastHold && U.dist2(b.lastHold, p) < 2) s -= 4;   // a new angle means somewhere else
      s += Math.random();
      if (s > bs) { bs = s; best = p; }
    }
    b.hold = best; b.holdRoom = r; b.holdSince = G.time; b.lastHold = best.clone(); b.holdLean = 0;
    const watched = new Set(mates.map(m => m.bot.holdOp).filter(Boolean));
    const seen = ents.filter(op => G.world.los(best.clone().setY(best.y + 1.5), GAD.opCenter(op)));
    const free = seen.filter(op => !watched.has(op));
    const op = free.length ? U.pick(free) : seen.length ? U.pick(seen) : ents.length ? U.pick(ents) : null;
    b.holdOp = op;
    b.holdLook = op ? headAt(op) : V().set(r.cx, r.fy + 1.4, r.cz);
    // the same angle from behind cover: step to where the wall hides the body and a lean shows
    // the doorway (most of those who like cover do; a few prefer to stand and see it all)
    if (op && Math.random() < 0.2 + tr.cover * 0.8) {
      const pk = coverPeek(a, b.holdLook, 1.6, best);
      if (pk && G.map.roomAt(pk.pos) === r) { b.hold = pk.pos; b.holdLean = pk.side; }
    }
    return b.hold;
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
    if (b.role === 'roam' && S.adv > -2) return roamGoal(a, plan, S);
    const p = anchorSpot(a, plan);
    return { pos: p, r: 0.6, kind: 'hold', look: b.holdLook, crouch: Math.random() < 0.002, lean: b.holdLean };
  }
  /* a roamer's job, by who it is:
       entry players  out toward the attack, in the rooms on the outside walls, never still long
       lurkers        far from the site, quiet, holding one room's doorway for a long time
       flankers       once the attack is known inside, round behind it
       the rest       the rooms around the site */
  function roamGoal(a, plan, S) {
    const b = a.bot, tr = TR(a), pid = PID(a), site = plan.rooms[0], sc = plan.objCenter;
    // a flanker who knows where the attack is goes round behind it
    if ((pid === 'flanker' || FL(a).wide || FL(a).quick) && S.known && G.time - S.kt < 10 && GAME.phase === 'action') {
      if (!b.flankAt || G.time > b.flankUntil || U.dist3(b.flankFor, S.known) > 5) {
        const k = S.known, dx = k.x - sc.x, dz = k.z - sc.z, L = Math.hypot(dx, dz) || 1;
        const n = NAV.nearest(V().set(k.x + dx / L * 6, k.y, k.z + dz / L * 6), 4);
        b.flankAt = n >= 0 ? NAV.nodePos(n) : null; b.flankFor = k.clone(); b.flankUntil = G.time + 12;
      }
      if (b.flankAt && U.dist2(a.pos, b.flankAt) > 1.2) return { pos: b.flankAt, r: 1, kind: 'flank', route: { avoid: avoidNear([S.known], 7, 4) }, look: S.known.clone().setY(S.known.y + 1.4) };
    }
    // once there it stays a while on the room's doorway (a lurker until its time is up)
    const arrived = b.roamGoal && U.dist2(a.pos, b.roamGoal) < 1;
    if (arrived && !b.roamArr) b.roamArr = G.time; else if (!arrived) b.roamArr = 0;
    const dwell = pid === 'lurker' ? 1e9 : 1 + tr.patience * 8;
    if (!b.roamGoal || G.time > (b.roamUntil || 0) || (arrived && G.time - b.roamArr > dwell)) {
      b.roamArr = 0;
      let rs = G.map.rooms.filter(r => !plan.rooms.includes(r) && !/Stairs/.test(r.name));
      const dist = r => Math.hypot(r.cx - sc.x, r.cz - sc.z) + Math.abs(r.fy - sc.y) * 2;
      if (pid === 'lurker') rs = rs.filter(r => dist(r) > 14 && Math.abs(r.L - site.L) <= 2);
      else if (pid === 'entry' || b.ag > 0.7) rs = rs.filter(r => Math.abs(r.L - site.L) <= 1 && G.map.openings.some(op => op.ext && op.L === r.L && roomOpenings(r).includes(op)));
      else rs = rs.filter(r => Math.abs(r.L - site.L) <= 1 && dist(r) < 22);
      if (!rs.length) rs = G.map.rooms.filter(r => Math.abs(r.L - site.L) <= 1 && !plan.rooms.includes(r) && !/Stairs/.test(r.name));
      const r = U.pick(rs.length ? rs : G.map.rooms);
      b.roamGoal = NAV.randomIn(r); b.roamRoom = r;
      // how long it stays: a lurker settles in, an entry roamer keeps moving
      b.roamUntil = G.time + (pid === 'lurker' ? U.rnd(25, 45) : U.rnd(8, 16) + tr.patience * 14);
      b.roamLook = null; b.roamLean = 0;
      const ops = roomOpenings(r);
      if (ops.length) {
        const op = U.pick(ops); b.roamLook = headAt(op);
        if (tr.cover > 0.45 && Math.random() < tr.cover) { const pk = coverPeek(a, b.roamLook, 1.4, b.roamGoal); if (pk) { b.roamGoal = pk.pos; b.roamLean = pk.side; } }
      }
    }
    const look = b.roamLook || b.roamGoal.clone().add(V().set(Math.sin(G.time * 0.5 + a.id) * 3, 1.4, Math.cos(G.time * 0.5 + a.id) * 3));
    return { pos: b.roamGoal, r: 0.8, kind: 'roam', look, lean: b.roamLean, crouch: pid === 'lurker' && Math.random() < 0.01 };
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
      // ---- seasons 4-9
      // Warden: the turret set back from an entry, covering it
      case 'turret': { const t = atEntry(0, (x, op, st, inw, c) => {
        let p = c.clone().addScaledVector(inw, 3.2); p.y = st.y;
        if (G.world.boxHits(p.x - 0.25, p.y + 0.1, p.z - 0.25, p.x + 0.25, p.y + 1, p.z + 0.25) || !NAV.walkable(p)) p = st.clone();
        GAD.deployAt(x, 'turret', p, null, Math.atan2(-(c.x - p.x), -(c.z - p.z))); x.ability.count--;
      }, 1.0); if (t) b.tasks.push(t); break; }
      // Ferro: coils just inside two entries, so a push arrives with jamming guns
      case 'jamfield': place(Math.min(2, Math.max(1, ents.length)), i => atEntry(i + 1, (x, op, st, inw, c) => {
        let p = c.clone().addScaledVector(inw, 2.2); p.y = st.y; if (!NAV.walkable(p)) p = st.clone();
        GAD.deployAt(x, 'jamfield', p, null, 0); x.ability.count--;
      }, 0.8) || { time: 0 }); break;
      // Mimic: doubles standing where a defender would hold, each facing a way in
      case 'mannequin': place(3, i => { const p = inner(); return { at: p, time: 0.7, run: x => {
        const op = ents.length ? ents[i % ents.length] : null, c = op ? GAD.opCenter(op) : V().set(r.cx, r.fy, r.cz);
        const yaw = Math.atan2(-(c.x - p.x), -(c.z - p.z)), q = p.clone().add(V().set(-Math.sin(yaw) * 0.8, 0, -Math.cos(yaw) * 0.8));
        GAD.deployAt(x, 'mannequin', NAV.walkable(q) ? q : p.clone(), null, yaw); x.ability.count--;
      } }; }); break;
      // Veil: a null field over each site room
      case 'nullfield': place(2, i => { const rr = plan.rooms[i % plan.rooms.length], p = NAV.randomIn(rr); return { at: p, time: 0.6, run: x => { GAD.deployAt(x, 'nullfield', p.clone().setY(p.y + 0.01), null, 0); x.ability.count--; } }; }); break;
      // Moor: an anchor on the objective before she goes roaming
      case 'recall': { const p = inner(); b.tasks.push({ at: p, time: 0.5, run: x => { GAD.deployAt(x, 'anchor', p.clone().setY(p.y + 0.01)); } }); b.role = 'roam'; break; }
      default: if (window.OPS2) OPS2.aiPlanDef(a, plan, { place, atEntry, inner, ents, r, b }); break;
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
      // a proximity alarm on the floor just inside two of the ways in
      if (g.id === 'alarm') place(g.count, i => atEntry(i + 3, (x, op, st, inw, c) => { const p = c.clone().addScaledVector(inw, 1.0); p.y = G.world.groundBelow(p.x, c.y + 0.5, p.z) + 0.02; if (Math.abs(p.y - st.y) < 0.6 && x.gadget.count > 0) { GAD.deployAt(x, 'alarm', p); x.gadget.count--; } }) || { time: 0 });
      // a fog canister on the objective, kept for when they come in or plant
      if (g.id === 'fog') { const p = inner(); b.tasks.push({ at: p, time: 0.5, run: x => { if (x.gadget.count > 0) { GAD.deployAt(x, 'fog', p.clone().setY(p.y + 0.05)); x.gadget.count--; } } }); }
      if (window.OPS2) OPS2.aiPlanDefGadget(a, plan, { place, atEntry, inner, ents, r, b, g });
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
    const ROLE = { entry: 'entry', tactical: 'entry', flanker: 'flank', lurker: 'flank', marksman: 'overwatch', support: 'support', opportunist: 'support', anchor: 'support' };
    bots.forEach(a => { a.bot.role = ROLE[PID(a)] || 'entry'; a.bot.tasks = []; a.bot.goAt = 0; });
    if (GAME.mode === 'bomb') plan.carrier = bots.find(a => a.carry === 'defuser') || null;
    // split the team over the entries so the site gets hit from several sides at once; the
    // defuser goes in by the closest one, with the entry players and their trade partners.
    // Flankers and lurkers take the way in furthest from it
    plan.entries = entryPlan(plan); plan.execute = false;
    if (plan.carrier) { bots.splice(bots.indexOf(plan.carrier), 1); bots.unshift(plan.carrier); }
    const E = plan.entries;
    bots.forEach((a, i) => {
      const b = a.bot, pid = PID(a);
      let e = E.length ? E[i % E.length] : null;
      if (E.length > 1) {
        if (a === plan.carrier || pid === 'entry' || (pid === 'support' && FL(a).trade)) e = E[0];
        else if (pid === 'flanker' || pid === 'lurker') e = (FL(a).vertical && E.find(x => x.win)) || E[E.length - 1];
      }
      b.entry = e; b.staged = false; b.entered = false;
    });
    plan.cleared = new Map();
    plan.goalFor = a => atkGoal(a, plan);
  }
  /* how long after the call to go each player waits: the entry is first through the door, its
     trade partner a beat behind, the careful a little later, the opportunist once there is a
     fight to join, the lurker long after everyone */
  const GO = { entry: [0, 0.6], support: [0.6, 1.6], tactical: [1, 2.5], flanker: [0, 1.5], marksman: [2, 4], opportunist: [2.5, 5], lurker: [5, 12], anchor: [1, 2] };
  function goDelay(x) { const r = GO[PID(x)] || [0, 1.2]; return U.rnd(r[0], r[1]) * (0.7 + TR(x).patience * 0.6) + (FL(x).waitIntel ? 2 : 0); }
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
      if (live.every(x => x.bot.staged) || G.time - (plan.actionT || 0) > 30 || contact || S.late) { plan.execute = true; for (const x of live) x.bot.goAt = G.time + goDelay(x); }
    }
    if (!plan.execute) {
      const st = b.entry.stage;
      if (U.dist2(a.pos, st) < 1.6 && Math.abs(a.pos.y - st.y) < 1.2) b.staged = true;
      return { pos: st, r: 1.2, kind: 'stage', sprint: U.dist3(a.pos, st) > 14, look: GAD.opCenter(b.entry.op), route: intelRoute(a, plan) };
    }
    // a Late Clock lurker stays outside until the clock or the numbers say it's time
    const lateWait = FL(a).late && !S.late && S.theirs > 2 && GAME.timer > 75;
    if (G.time < (b.goAt || 0) || lateWait) return { pos: a.pos.clone(), r: 9, kind: 'wait', look: GAD.opCenter(b.entry.op) };
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
    // seasons 10-14 (js/ops2.js): true when it has planned this bot's kit itself
    if (window.OPS2 && OPS2.aiPlanAtk(a, plan, { b, r, id })) return;
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
    // Tusk: back off a few paces from a soft site wall, then straight through it
    if (id === 'ram') {
      // (a wall that leads in from outside the objective first: one between two site rooms is a last resort)
      const outOf = p => p.look.clone().addScaledVector(V().copy(p.look).sub(p.stand).setY(0).normalize(), 2.8).setY(r.fy);
      const pans = U.shuffle(AI.roomPanels(r).filter(p => !GAME.reinforced.includes(p))).sort((p, q) => (plan.rooms.includes(G.map.roomAt(outOf(p))) ? 1 : 0) - (plan.rooms.includes(G.map.roomAt(outOf(q))) ? 1 : 0));
      for (const p of pans) {
        const out = outOf(p);
        if (!NAV.walkable(out) || !G.world.los(out.clone().setY(out.y + 1), p.look.clone().addScaledVector(V().copy(p.look).sub(p.stand).setY(0).normalize(), 0.4).setY(out.y + 1))) continue;
        const pth = NAV.path(a.pos, out); if (!pth || !pth.length || U.dist3(pth[pth.length - 1], out) > 0.8) continue;
        b.tasks.push({ at: out, look: p.look, time: 0.5, run: x => { faceTo(x, p.look.clone().setY(x.pos.y + 1.5), 1, 99); x.pitch = 0; if (GAD.ability(x)) x.bot.ramRun = { yaw: x.yaw, until: G.time + 2.4 }; } });
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
    if (GAME.phase === 'action' && b.entered) preAimIntel(a, plan);
    const R = plan.rooms;
    // bomb: carrier plants; others clear site
    if (GAME.mode === 'bomb') {
      if (obj.defuser && obj.defuser.alive) {
        // post-plant: spread out to separate spots that can see the defuser (a crossfire on
        // it), each watching a different way in, instead of crouching in a pile beside it
        if (!b.guard || U.dist3(b.guard, obj.defuser.pos) > 12) {
          const g = guardSpot(a, obj.defuser); b.guard = g.p; b.guardLook = g.look; b.guardLean = 0;
          // from behind cover, leaning out on the way in, for those who play that way
          if (Math.random() < TR(a).cover) { const pk = coverPeek(a, g.look, 1.4, g.p); if (pk) { b.guard = pk.pos; b.guardLean = pk.side; } }
        }
        // (Crag plants his shield where he holds, facing the way in he is watching)
        return { pos: b.guard, r: 0.8, kind: 'guard', look: b.guardLook, crouch: !b.guardLean, lean: b.guardLean, act: x => { if (x.ability && x.ability.id === 'plant' && x.shieldUp && !(x.shieldPlanted && x.shieldPlanted.alive) && x.busy <= 0 && b.guardLook && faceTo(x, b.guardLook, 0.05, 6) < 0.3) GAD.ability(x); } };
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
    if (S.mode === 'hunt' && !a.carry && b.ag > 0.25) { const g = huntGoal(a, S); if (g) return g; }
    const styled = !S.late && !a.carry ? styleGoal(a, plan, S) : null;
    if (styled) return styled;
    if (!b.atkSpot || G.time > (b.atkUntil || 0) || b.atkKind !== 'push') {
      const rr = U.pick(R); b.atkSpot = NAV.randomIn(rr); b.atkKind = 'push'; b.atkUntil = G.time + U.rnd(S.late ? 6 : 15, S.late ? 10 : 30);
    }
    return { pos: b.atkSpot, r: 0.8, kind: 'push', sprint: U.dist3(a.pos, b.atkSpot) > (S.late ? 8 : 25), look: plan.objCenter.clone().setY(plan.objCenter.y + 1.4), route: intelRoute(a, plan) };
  }
  /* inside: where each playstyle goes before the site (they all go to the site once the clock
     is short, and the situation can always pull them off it):
       support      a few metres behind the most aggressive teammate, covering its angle (trade)
       opportunist  an angle on a fight a teammate is already in (or trailing the team)
       marksman     a spot in a neighbouring room with a long look into the site
       tactical     the rooms around the site, nearest first, one at a time
       flanker      a room beside the site on the far side from the team, by a route that keeps
                    away from teammates and from defenders the team knows about
       lurker       the same, then it waits there, quiet, until the round is late or thin   */
  function styleGoal(a, plan, S) {
    const b = a.bot, tr = TR(a), f = FL(a), pid = PID(a), oc = plan.objCenter, site = plan.rooms[0];
    const siteLook = oc.clone().setY(oc.y + 1.4);
    const mates = G.actors.filter(x => x !== a && x.team === a.team && x.state === 'alive' && !x.hostage);
    if (pid === 'support' || (pid === 'opportunist' && !f.vulture)) {
      const lead = mates.slice().sort((p, q) => ((q.bot ? q.bot.ag : 0.6) - U.dist3(q.pos, oc) * 0.02) - ((p.bot ? p.bot.ag : 0.6) - U.dist3(p.pos, oc) * 0.02))[0];
      if (lead && G.time - (b.tradeT || -9) > 1) {
        b.tradeT = G.time;
        const fw = lead.fwd(V()).setY(0).normalize(), rt = V().set(-fw.z, 0, fw.x), side = (a.id % 2) ? 1 : -1;
        const back = pid === 'opportunist' ? 6 : f.overwatch ? 5 : 2.5;
        const n = NAV.nearest(lead.pos.clone().addScaledVector(fw, -back).addScaledVector(rt, side * 1.2), 3);
        b.tradeSpot = n >= 0 ? NAV.nodePos(n) : null; b.tradeLook = lead.pos.clone().addScaledVector(fw, 8).setY(lead.pos.y + 1.4);
      }
      if (lead && b.tradeSpot) return { pos: b.tradeSpot, r: 1.3, kind: 'trade', look: b.tradeLook };
    }
    if (pid === 'opportunist') {
      const busy = mates.find(x => x.bot && x.bot.target && x.bot.target.isActor && x.bot.target.state === 'alive' && U.dist3(x.pos, a.pos) < 25);
      if (busy) {
        if (!b.thirdFor || b.thirdFor !== busy.bot.target || G.time > (b.thirdT || 0)) { b.thirdFor = busy.bot.target; b.thirdT = G.time + 4; b.thirdSpot = flankSpot(a, busy.bot.target.pos); }
        if (b.thirdSpot) return { pos: b.thirdSpot, r: 1, kind: 'third', look: busy.bot.target.pos.clone().setY(busy.bot.target.pos.y + 1.4), sprint: U.dist3(a.pos, b.thirdSpot) > 10 };
      }
    }
    if (pid === 'marksman' || f.overwatch && pid !== 'support') {
      if (!b.ow || G.time > b.owUntil) { b.ow = overwatchSpot(a, plan); b.owUntil = G.time + 20 + tr.patience * 35; }
      if (b.ow && mates.length) return { pos: b.ow.pos, r: 0.8, kind: 'overwatch', look: b.ow.look, lean: b.ow.lean, crouch: tr.cover > 0.6 };
    }
    if (pid === 'tactical' && (b.clearedN || 0) < 2 + Math.round(tr.caution * 3)) {
      const pc = plan.cleared || new Map();
      if (!b.clearRoom || G.map.roomAt(a.pos) === b.clearRoom && U.dist2(a.pos, b.atkSpot || a.pos) < 1.5) {
        if (b.clearRoom) b.clearedN = (b.clearedN || 0) + 1;
        const rooms = G.map.rooms.filter(r => r.L === site.L && !plan.rooms.includes(r) && !/Stairs/.test(r.name) && Math.hypot(r.cx - oc.x, r.cz - oc.z) < 16 && !(pc.get(r) && G.time - pc.get(r) < 60));
        rooms.sort((p, q) => Math.hypot(p.cx - a.pos.x, p.cz - a.pos.z) - Math.hypot(q.cx - a.pos.x, q.cz - a.pos.z));
        b.clearRoom = rooms[0] || null; b.atkSpot = b.clearRoom ? NAV.randomIn(b.clearRoom) : null; b.atkKind = 'clear';
      }
      if (b.clearRoom && b.atkSpot) return { pos: b.atkSpot, r: 1.2, kind: 'clear', look: siteLook, route: intelRoute(a, plan) };
    }
    if ((pid === 'flanker' || pid === 'lurker') && !b.flankDone) {
      if (!b.flankSpot) {
        const cen = V(); for (const m of mates) cen.add(m.pos); if (mates.length) cen.divideScalar(mates.length); else cen.copy(a.pos);
        const rooms = G.map.rooms.filter(r => (f.vertical ? Math.abs(r.L - site.L) === 1 : r.L === site.L) && !plan.rooms.includes(r) && !/Stairs/.test(r.name) && Math.hypot(r.cx - oc.x, r.cz - oc.z) < 16);
        const pick = rooms.map(r => [r, Math.hypot(r.cx - cen.x, r.cz - cen.z) + Math.random() * 4]).sort((p, q) => q[1] - p[1])[0];
        b.flankSpot = pick ? NAV.randomIn(pick[0]) : null; b.flankSince = G.time;
        if (!b.flankSpot) { b.flankDone = true; return null; }
      }
      const there = U.dist2(a.pos, b.flankSpot) < 1.3;
      if (there && !b.flankAt) b.flankAt = G.time;
      // a lurker waits it out; a flanker strikes once in place (a Wide Rotator gives it a moment)
      const wait = pid === 'lurker' ? (S.theirs > 2 && GAME.timer > 60 ? 1e9 : 0) : f.wide ? 6 : 1.5;
      if (there && G.time - b.flankAt > wait || G.time - b.flankSince > 60) { b.flankDone = true; return null; }
      const pts = mates.map(m => m.pos.clone()).concat(knownEnemies(plan));
      return { pos: b.flankSpot, r: 1.2, kind: 'flank', look: siteLook, route: { avoid: avoidNear(pts, f.wide ? 9 : 6, f.wide ? 6 : 3) }, crouch: pid === 'lurker' };
    }
    return null;
  }
  /* a spot in a neighbouring room on the site's floor with a long look into it */
  function overwatchSpot(a, plan) {
    const oc = plan.objCenter, site = plan.rooms[0], tr = TR(a);
    const rooms = G.map.rooms.filter(r => r.L === site.L && !plan.rooms.includes(r) && !/Stairs/.test(r.name) && Math.hypot(r.cx - oc.x, r.cz - oc.z) < 26);
    if (!rooms.length) return null;
    const targets = [oc.clone().setY(oc.y + 1.2)].concat(roomOpenings(site).map(headAt));
    let best = null, bs = -1e9;
    for (let i = 0; i < 16; i++) {
      const p = NAV.randomIn(U.pick(rooms)), e = p.clone().setY(p.y + 1.5);
      const seen = targets.filter(t => G.world.los(e, t));
      if (!seen.length) continue;
      const s = seen.length * 1.5 - Math.abs(U.dist3(p, oc) - tr.range) * 0.15 + Math.random();
      if (s > bs) { bs = s; best = { pos: p, look: seen[0].clone(), lean: 0 }; }
    }
    if (best && Math.random() < tr.cover) { const pk = coverPeek(a, best.look, 1.4, best.pos); if (pk) { best.pos = pk.pos; best.lean = pk.side; } }
    return best;
  }
  /* what the team knows about where the defenders are (drone spots, callouts, marks) */
  function knownEnemies(plan) {
    const out = [];
    for (const i of plan.intel || []) if (G.time - i.t < 60) out.push(i.pos);
    const S = situation(plan.team);
    if (S.known && G.time - S.kt < 15) out.push(S.known);
    return out.slice(-6);
  }
  AI.knownEnemies = knownEnemies;
  /* a route that stays out of known defender positions, for those careful enough to want one.
     An entry player goes straight at them instead, gun already on them (preAimIntel) */
  function intelRoute(a, plan) {
    const tr = TR(a); if (tr.caution < 0.4 && a.bot.ag > 0.6) return undefined;
    const pts = knownEnemies(plan); if (!pts.length) return undefined;
    return { avoid: avoidNear(pts, 6, 2 + tr.caution * 4) };
  }
  /* walking up on a spot the team knows a defender holds: the gun goes there first */
  function preAimIntel(a, plan) {
    const b = a.bot; if (b.target || (b.attn && G.time < b.attn.until) || G.time < (b.preT || 0)) return;
    b.preT = G.time + 0.5;
    let best = null, bd = 14;
    for (const p of knownEnemies(plan)) { const d = U.dist3(p, a.pos); if (d < bd && Math.abs(p.y - a.pos.y) < 2.5) { bd = d; best = p; } }
    if (best) b.attn = { p: best.clone().setY(best.y + 1.4), until: G.time + 0.8 };
  }

  /* ===================================================== the drone phase
     Attacking bots scout in the preparation phase, the way a player does: each puts a drone
     down at its spawn and drives it into the building, room to room, stopping to turn and look
     round, hopping what it can't drive over, boosting down long runs. What a drone actually sees
     (a defender with a clear line to its camera, within its view) is marked for the team and kept
     as the team's intel for the action phase; nothing else is known. Who is driving decides
     where it goes and how:
       entry players    straight to the objective, fast, and they linger where the defenders are
       tacticians       their own way in first, then the rooms round the site, slowly, scanning
       support          the team's main way in and the rooms the others haven't looked at
       flankers/lurkers the far way in, the side rooms, the floor above or below
       marksmen         the rooms with a long look into the site
       opportunists     the site, then they follow whoever they found
     The careful back a drone away from a defender who has seen it; the bold keep watching.
     A drone that is shot gets replaced by the second one if there is time. */
  function scoutRooms(a, plan) {
    const pid = PID(a), oc = plan.objCenter, site = plan.rooms[0], S = AI.teams[a.team] || plan;
    const near = (r, d) => Math.hypot(r.cx - oc.x, r.cz - oc.z) < d && Math.abs(r.L - site.L) <= 1 && !/Stairs/.test(r.name);
    const done = S.droned || (S.droned = new Map());
    const fresh = r => !(done.get(r) > G.time - 20);
    const around = G.map.rooms.filter(r => near(r, 16) && !plan.rooms.includes(r));
    // the rooms on the way from this bot's own entry to the site
    const route = [];
    if (a.bot.entry) {
      const pth = NAV.path(a.bot.entry.inside || a.bot.entry.stage, oc, { partial: true }) || [];
      for (let i = 0; i < pth.length; i += 8) { const r = G.map.roomAt(pth[i]); if (r && !route.includes(r) && !/Stairs/.test(r.name)) route.push(r); }
    }
    const far = around.slice().sort((p, q) => Math.hypot(q.cx - oc.x, q.cz - oc.z) - Math.hypot(p.cx - oc.x, p.cz - oc.z));
    let list;
    switch (pid) {
      case 'entry': list = plan.rooms.concat(U.shuffle(around.slice()).slice(0, 2)); break;
      case 'tactical': case 'anchor': list = route.slice(0, 3).concat(around.filter(fresh).slice(0, 3), plan.rooms); break;
      case 'support': list = route.filter(fresh).concat(around.filter(fresh), plan.rooms); break;
      case 'flanker': case 'lurker': list = far.filter(r => FL(a).vertical ? r.L !== site.L : true).slice(0, 4).concat(G.map.rooms.filter(r => near(r, 22) && r.L !== site.L).slice(0, 2), plan.rooms.slice(0, 1)); break;
      case 'marksman': list = around.filter(r => r.L === site.L).sort((p, q) => Math.hypot(q.cx - oc.x, q.cz - oc.z) - Math.hypot(p.cx - oc.x, p.cz - oc.z)).slice(0, 3).concat(plan.rooms); break;
      default: list = plan.rooms.concat(around.filter(fresh).slice(0, 3));
    }
    return [...new Set(list)].slice(0, 7);
  }
  AI.droneThink = function (a, dt) {
    const b = a.bot, plan = AI.teams[a.team];
    if (!plan || plan.side !== 'atk' || GAME.arcade || G.mode !== 'match') return;
    const tr = TR(a);
    let d = b.drone && b.drone.alive ? b.drone : null;
    // put one down (the second when the first is lost, if there is still time for it to be worth it)
    if (!d) {
      if (b.drone && !b.drone.alive) { b.drone = null; b.droneLost = G.time; }
      if (a.drones <= 0 || GAME.timer < 9 || G.time - (b.droneLost || -99) < 2 || G.time - (b.droneAt || -99) < 0.3) return;
      if (b.droneAt == null) b.droneAt = G.time + U.rnd(0.4, 2.5) * (0.6 + tr.caution);   // they don't all go at once
      if (G.time < b.droneAt) return;
      d = GAD.deployDrone(a, true); if (!d) return;
      d.pilot = a; b.drone = d; b.droneAt = G.time;
      b.dq = scoutRooms(a, plan); b.dPath = null; b.dGoal = null; b.dScan = 0; b.dStuck = 0; b.dLast = d.pos.clone();
      return;
    }
    const S = AI.teams[a.team];
    const done = S.droned || (S.droned = new Map());
    // ---- what the drone sees: defenders in front of its camera with a clear line, and gadgets
    if (G.time >= (b.dLook || 0)) {
      b.dLook = G.time + 0.25;
      const e = d.eye(), f = V().set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)), intel = plan.intel || (plan.intel = []);
      for (const t of G.actors) {
        if (t.team === a.team || t.state !== 'alive' || t.hostage || t.cloakT > 0 || t.nullT > G.time) continue;
        const c = t.center(V()), to = c.clone().sub(e), dist = to.length(); if (dist > 28) continue;
        to.normalize(); if (to.dot(f) < 0.35 || !G.world.los(e, c) || FX.smokeBlocks(e, c)) continue;
        const old = intel.find(x => x.a === t);
        if (old) { old.pos.copy(t.pos); old.t = G.time; } else intel.push({ a: t, pos: t.pos.clone(), t: G.time, op: t.op.id });
        if ((t.spotT || 0) < G.time) { t.spotT = G.time + 3; GAME.mark(t, a.team, 5, true); }
        b.dSeen = { t, at: G.time, dist, facing: t.fwd(V()).dot(to) < -0.5 };
      }
      // Static's drone: fry what it gets close to
      if (d.surge) for (const g of G.ents) if (g.alive && g.elec && g.team !== a.team && g.team >= 0 && U.dist3(g.pos, d.pos) < 3.2) { d.zap(); break; }
    }
    d.mf = d.mr = 0;
    // ---- a defender has seen it: the careful pull back out of sight, the bold keep looking
    const seen = b.dSeen && G.time - b.dSeen.at < 0.6 ? b.dSeen : null;
    if (seen && seen.facing && seen.dist < 12 && tr.risk < 0.55 + (PID(a) === 'entry' ? 0.3 : 0)) {
      if (!b.dHide || G.time > b.dHide.until) b.dHide = { until: G.time + 1.2 + tr.caution };
      d.mf = -1; d.mr = (a.id % 2 ? 1 : -1) * 0.6; if (Math.random() < dt * 2) d.jump = true;
      b.dPath = null;
      return;
    }
    if (seen && PID(a) === 'opportunist' && seen.dist > 4) {
      // follow what it found, from a distance
      const tp = seen.t.pos; d.yaw += U.wrap(Math.atan2(-(tp.x - d.pos.x), -(tp.z - d.pos.z)) - d.yaw) * Math.min(1, dt * 4);
      return;
    }
    // ---- scanning: turn round on the spot in a room, longer for the careful
    if (b.dScan > 0) { b.dScan -= dt; d.yaw += dt * (2.2 + tr.aggr); return; }
    // ---- driving to the next room on the list
    if (!b.dGoal) {
      const r = (b.dq || []).shift();
      if (!r) { b.dq = scoutRooms(a, plan).filter(x => !(done.get(x) > G.time - 10)); if (!b.dq.length) b.dq = plan.rooms.slice(); return; }
      b.dGoal = NAV.randomIn(r); b.dRoom = r; b.dPath = null;
    }
    if (!b.dPath || G.time > (b.dRepath || 0)) {
      b.dPath = NAV.path(d.pos, b.dGoal, { partial: true, barrCost: 40 }) || []; b.dPi = 0; b.dRepath = G.time + 6;
    }
    const P = b.dPath;
    while (b.dPi < P.length && U.dist2(d.pos, P[b.dPi]) < 0.4) b.dPi++;
    const inRoom = G.map.roomAt(d.pos) === b.dRoom;
    if (b.dPi >= P.length || (inRoom && U.dist2(d.pos, b.dGoal) < 2.5)) {
      // there (or as far as it goes): look round, note the room as checked, on to the next
      if (b.dRoom) done.set(b.dRoom, G.time);
      b.dScan = (inRoom ? 1 : 0.5) * (0.8 + tr.caution * 2.2 + (plan.rooms.includes(b.dRoom) && PID(a) === 'entry' ? 1.5 : 0));
      b.dGoal = null; b.dPath = null;
      return;
    }
    const n = P[b.dPi];
    const want = Math.atan2(-(n.x - d.pos.x), -(n.z - d.pos.z));
    d.yaw += U.wrap(want - d.yaw) * Math.min(1, dt * 10);
    d.mf = Math.abs(U.wrap(want - d.yaw)) < 0.6 ? 1 : 0.3;
    // boost down long straight runs (more often for the aggressive), hop what it's stuck on
    if (d.boostCd <= 0 && b.dPi + 6 < P.length && Math.random() < dt * (0.3 + tr.aggr * 1.2) && Math.abs(U.wrap(want - d.yaw)) < 0.2) d.boost = true;
    if (U.dist2(d.pos, b.dLast) > 0.25) { b.dLast.copy(d.pos); b.dStuck = 0; } else b.dStuck += dt;
    if (b.dStuck > 0.5 && d.onGround) d.jump = true;
    if (b.dStuck > 2.5) { b.dStuck = 0; b.dPath = null; if (Math.random() < 0.5) { if (b.dRoom) done.set(b.dRoom, G.time); b.dGoal = null; } }
  };
  /* the action phase: drones parked, and the drone intel decides a careful player's way in */
  AI.droneIntelEntries = function (plan) {
    const known = (plan.intel || []).filter(x => G.time - x.t < 60);
    if (!known.length || !plan.entries || plan.entries.length < 2) return;
    const hot = e => known.some(x => U.dist3(x.pos, e.inside || e.stage) < 7);
    for (const a of plan.bots) {
      const b = a.bot; if (!b || !b.entry || a.carry || b.entered) continue;
      if (hot(b.entry) && TR(a).caution > 0.5) { const alt = plan.entries.find(e => e !== b.entry && !hot(e)); if (alt) { b.entry = alt; b.staged = false; } }
    }
  };

  window.AI = AI;
})();
