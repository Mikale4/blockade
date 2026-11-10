/* killcam.js -- replays of the last seconds before a kill, seen over the killer's shoulder.
   Two uses: your own death (before you go to spectating), and the kill that ends a round.
   Everyone's pose is sampled 30 times a second for the last 8 s, along with the shots, blasts
   and blood in that time. Playback poses the models from the recording only while they are
   drawn, so the live game underneath is never touched, and re-fires the tracers, muzzle
   flashes and gunshots at their moments. The kill itself plays in slow motion. */
(function () {
  'use strict';
  const V = () => new THREE.Vector3();
  const KEEP = 8, RATE = 1 / 30 - 1e-4;
  const PRE = 3.6, AFTER = 1.0, SLOW_A = 0.25, SLOW_B = 0.35, SLOW = 0.4;
  const KC = { frames: [], ev: [], play: null, pending: null, lastRec: -1, replaying: false };
  const KEYS_SAVED = ['yaw', 'pitch', 'stance', 'h', 'lean', 'moving', 'state', 'sprint', 'ads', 'shSide', 'shBash', 'deathT', 'rappel'];

  KC.reset = function () {
    if (KC.play) KC.stop(true);
    KC.frames = []; KC.ev = []; KC.lastRec = -1; KC.pending = null;
  };
  KC.busy = () => !!(KC.play || KC.pending);

  /* ------------------------------------------------------------ recording */
  KC.record = function () {
    if (G.mode !== 'match' || !G.actors.length) return;
    if (GAME.phase !== 'prep' && GAME.phase !== 'action' && GAME.phase !== 'post') return;
    if (KC.play && KC.play.mode === 'round') return;
    if (G.time - KC.lastRec < RATE) return;
    KC.lastRec = G.time;
    const list = G.actors, d = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      // how far into falling over: kept here, since a body you can't see (your own) never animates it
      if (a.state !== 'dead') a.kcDead = null;
      else if (a.kcDead == null) a.kcDead = a.kcSeen ? G.time : -1e9;
      a.kcSeen = true;
      d[i] = { x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw, pitch: a.pitch, stance: a.stance, h: a.h, lean: a.lean || 0, moving: a.moving || 0,
        state: a.state, sprint: !!a.sprint, ads: a.ads || 0, shSide: a.shSide || 0, shBash: a.shBash || 0, deathT: a.kcDead == null ? 0 : Math.min(1, (G.time - a.kcDead) * 2.5), rappel: a.rappel || null, w: a.wpn ? a.wpn.id : null };
    }
    KC.frames.push({ t: G.time, list, d });
    const cut = G.time - KEEP;
    while (KC.frames.length && KC.frames[0].t < cut) KC.frames.shift();
    while (KC.ev.length && KC.ev[0].t < cut) KC.ev.shift();
  };
  /* a shot: where the muzzle was and where up to three of its rounds ended */
  KC.shot = function (a, wid, from, ends) {
    if (KC.replaying || G.mode !== 'match') return;
    KC.ev.push({ t: G.time, k: 'shot', a, w: wid, o: from.clone(), e: ends.slice(0, 3).map(p => p.clone()) });
  };
  KC.fx = function (k, p, x) {
    if (KC.replaying || G.mode !== 'match' || !p) return;
    KC.ev.push({ t: G.time, k, p: p.clone(), x: x && x.clone ? x.clone() : x });
  };

  /* ------------------------------------------------------------- planning */
  /* when it happened: the last time the victim's state changed (up -> down, down -> dead...) */
  function plan(killer, victim) {
    const fr = KC.frames; if (fr.length < 15 || !victim) return null;
    const list = fr[fr.length - 1].list, vi = list.indexOf(victim);
    if (vi < 0) return null;
    let tk = null;
    // it can be this very frame, before the recording has caught up
    if (fr[fr.length - 1].d[vi] && fr[fr.length - 1].d[vi].state !== victim.state) tk = G.time;
    for (let i = fr.length - 1; i > 0 && tk == null; i--) {
      const s = fr[i].d[vi], p = fr[i - 1].d[vi];
      if (s && p && s.state !== p.state && fr[i].list === list) { tk = fr[i].t; break; }
    }
    if (tk == null) return null;
    const t0 = Math.max(fr.find(f => f.list === list).t, tk - PRE), t1 = tk + AFTER;
    if (tk - t0 < 0.8) return null;
    const slow = Math.min(t1, tk + SLOW_B) - Math.max(t0, tk - SLOW_A);
    const dur = (t1 - t0 - slow) + slow / SLOW + 0.3;
    // a gun kill follows the killer; a gadget, a blast or a fall circles the victim instead
    const k = killer && killer !== victim && list.includes(killer) ? killer : null;
    const shot = k && KC.ev.some(e => e.k === 'shot' && e.a === k && e.t > tk - 0.9 && e.t <= tk + 0.1);
    return { list, vi, tk, t0, t1, dur, killer: k, victim, follow: shot ? k : null };
  }
  /* queue a replay to start `delay` seconds from now; returns how long it will run (0 = none) */
  KC.queue = function (mode, killer, victim, delay, opts) {
    if (G.settings.killcam === false) return 0;
    const p = plan(killer, victim);
    if (!p) return 0;
    if (KC.pending && KC.pending.mode === 'round' && mode !== 'round') return 0;
    KC.pending = Object.assign(p, { mode, at: G.time + (delay || 0) }, opts || {});
    return p.dur;
  };

  /* ------------------------------------------------------------- playback */
  function begin(q) {
    if (KC.play) KC.stop(true);
    if (q.list !== G.actors) return;
    const fr = KC.frames.filter(f => f.list === q.list && f.t >= q.t0 - 0.1);
    if (fr.length < 10) { if (q.done) q.done(); return; }
    const P = KC.play = Object.assign(q, { frames: fr, ev: KC.ev.filter(e => e.t >= q.t0 && e.t <= q.t1), t: q.t0, ei: 0, fi: 0, real: 0, cam: null, fp: false });
    P.t1 = Math.min(P.t1, fr[fr.length - 1].t);
    for (const a of P.list) a.kcGun = a.wpn ? a.wpn.id : null;
    PLAYER.view = 'replay';
    overlay(P);
    document.body.classList.add('kc');
  }
  KC.stop = function (silent) {
    const P = KC.play; if (!P) return;
    KC.play = null;
    for (const a of P.list) { if (a.kcGun && a.rig && a.wpn && a.kcGun !== a.wpn.id) MD.setRigGun(a.rig, a.wpn.id); a.kcGun = null; }
    document.body.classList.remove('kc');
    if (el) el.style.display = 'none';
    if (PLAYER.view === 'replay') {
      const dead = G.player && G.player.state === 'dead';
      PLAYER.view = dead ? 'spectate' : 'body';
      if (dead) PLAYER.cycleSpec(0);
    }
    if (!silent && P.done) P.done();
  };
  KC.skip = function () { if (KC.play && KC.play.real > 0.4) KC.stop(); };

  KC.update = function (dt) {
    if (KC.pending && G.time >= KC.pending.at) { const q = KC.pending; KC.pending = null; begin(q); }
    const P = KC.play; if (!P) return;
    if (P.list !== G.actors || G.mode !== 'match') return KC.stop(true);
    P.real += dt;
    const slow = P.t >= P.tk - SLOW_A && P.t <= P.tk + SLOW_B;
    const nt = Math.min(P.t1, P.t + dt * (slow ? SLOW : 1));
    // what was fired in this slice
    KC.replaying = true;
    try {
      while (P.ei < P.ev.length && P.ev[P.ei].t <= nt) { if (P.ev[P.ei].t > P.t - 1e-6) fire(P.ev[P.ei]); P.ei++; }
    } finally { KC.replaying = false; }
    P.t = nt;
    if (el) {
      el.querySelector('.kc-bar i').style.width = Math.round((P.t - P.t0) / Math.max(0.01, P.t1 - P.t0) * 100) + '%';
      el.classList.toggle('slow', slow);
    }
    if (P.t >= P.t1 - 1e-4) { P.endT = (P.endT || 0) + dt; if (P.endT > 0.3) KC.stop(); }
  };
  function fire(e) {
    const q = fn => (window.NP && NP.quiet ? NP.quiet(fn) : fn());
    if (e.k === 'shot') {
      const d = DATA.WEAPONS[e.w];
      if (d) SFX.shot(d, e.o, false);
      const col = G.player && e.a.team === G.player.team ? 0xffe8a0 : 0xffb070;
      q(() => FX.flash(e.o, 0.4, 0.04));
      for (const p of e.e) FX.tracer(e.o, p, col);
    } else if (e.k === 'explosion') { q(() => { FX.explosion(e.p, e.x || 3); SFX.explosion(e.p, (e.x || 3) > 3); }); }
    else if (e.k === 'blood') FX.blood(e.p, e.x || V().set(0, 1, 0));
  }

  /* the recorded pose of every actor at the replay's current moment */
  function at(P) {
    const fr = P.frames;
    while (P.fi < fr.length - 2 && fr[P.fi + 1].t <= P.t) P.fi++;
    while (P.fi > 0 && fr[P.fi].t > P.t) P.fi--;
    const A = fr[P.fi], B = fr[Math.min(fr.length - 1, P.fi + 1)];
    const k = B.t > A.t ? U.clamp((P.t - A.t) / (B.t - A.t), 0, 1) : 0;
    return { A, B, k };
  }
  function lerpPose(A, B, k) {
    if (!A || !B) return A || B;
    const L = U.lerp, n = k < 0.5 ? A : B;
    return { x: L(A.x, B.x, k), y: L(A.y, B.y, k), z: L(A.z, B.z, k), yaw: U.turn(A.yaw, B.yaw, k), pitch: L(A.pitch, B.pitch, k), stance: n.stance, h: L(A.h, B.h, k),
      lean: L(A.lean, B.lean, k), moving: L(A.moving, B.moving, k), state: n.state, sprint: n.sprint, ads: L(A.ads, B.ads, k), shSide: L(A.shSide, B.shSide, k),
      shBash: L(A.shBash, B.shBash, k), deathT: B.state === 'dead' && A.state === 'dead' ? L(A.deathT, B.deathT, k) : n.deathT, rappel: n.rappel, w: n.w };
  }
  /* drawing: pose an actor from the recording, draw, then put the live values back */
  KC.frameNow = () => KC.play ? at(KC.play) : null;
  KC.pose = function (a, f) {
    const P = KC.play, i = P.list.indexOf(a); if (i < 0) return null;
    const p = lerpPose(f.A.d[i], f.B.d[i], f.k); if (!p) return null;
    const saved = { x: a.pos.x, y: a.pos.y, z: a.pos.z };
    for (const key of KEYS_SAVED) saved[key] = a[key];
    a.pos.set(p.x, p.y, p.z);
    for (const key of KEYS_SAVED) a[key] = p[key];
    if (p.w && a.rig && a.kcGun !== p.w) { MD.setRigGun(a.rig, p.w); a.kcGun = p.w; }
    return saved;
  };
  KC.unpose = function (a, s) { a.pos.set(s.x, s.y, s.z); for (const key of KEYS_SAVED) a[key] = s[key]; };
  KC.hidden = a => !!(KC.play && KC.play.fp && a === KC.play.follow);

  /* the camera: over the killer's right shoulder looking where they aim, or circling the victim */
  KC.camera = function (cam, dt) {
    const P = KC.play; if (!P) return G.settings.fov;
    const f = at(P), W = G.world;
    let pos, yaw, pitch, fov = 70;
    if (P.follow) {
      const i = P.list.indexOf(P.follow), s = lerpPose(f.A.d[i], f.B.d[i], f.k);
      const eye = V().set(s.x, s.y + Math.max(0.3, s.h - 0.15), s.z);
      if (s.lean) { const kk = s.lean * 0.38; eye.x += Math.cos(s.yaw) * kk; eye.z -= Math.sin(s.yaw) * kk; }
      const back = V().set(Math.sin(s.yaw), 0, Math.cos(s.yaw)), right = V().set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
      // the right shoulder, or the left one when a wall is in the way; too cramped for either
      // (a narrow corridor) and it's the killer's own eyes, with their model hidden
      let best = null;
      for (const side of P.side ? [P.side, -P.side] : [1, -1]) {
        const want = eye.clone().addScaledVector(back, 1.75).addScaledVector(right, 0.62 * side).add(V().set(0, 0.18 - s.pitch * 0.35, 0));
        const dir = want.clone().sub(eye), L = dir.length(); dir.normalize();
        const h = W.raycast(eye, dir, L, true), dist = h ? Math.max(0, h.dist - 0.22) : L;
        if (!best || dist > best.dist + 0.2) best = { dir, dist, side };
        if (dist > L - 0.05) break;
      }
      P.side = best.side;
      P.fp = best.dist < (P.fp ? 1.45 : 1.25);   // a little hysteresis so it doesn't flicker
      pos = P.fp ? eye : eye.clone().addScaledVector(best.dir, best.dist);
      yaw = s.yaw; pitch = s.pitch; fov = 70 / U.lerp(1, 1.3, s.ads);
    } else {
      const s = lerpPose(f.A.d[P.vi], f.B.d[P.vi], f.k);
      const c = V().set(s.x, s.y + 0.9, s.z), ang = P.orbit0 == null ? (P.orbit0 = s.yaw + 2.4) : P.orbit0;
      const th = ang + (P.t - P.t0) * 0.32;
      const dir = V().set(Math.sin(th) * 3.4, 1.5, Math.cos(th) * 3.4), L = dir.length(); dir.normalize();
      const h = W.raycast(c, dir, L, true), dist = h ? Math.max(0.4, h.dist - 0.25) : L;
      pos = c.clone().addScaledVector(dir, dist);
      const to = c.clone().sub(pos);
      yaw = Math.atan2(-to.x, -to.z); pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    }
    // ease the camera so wall collisions and snappy bot aim don't jerk it around
    if (!P.cam) P.cam = { p: pos.clone(), yaw, pitch };
    else {
      const k = 1 - Math.exp(-dt * 14), ka = 1 - Math.exp(-dt * 20);
      P.cam.p.lerp(pos, k); P.cam.yaw = U.turn(P.cam.yaw, yaw, ka); P.cam.pitch = U.lerp(P.cam.pitch, pitch, ka);
    }
    cam.position.copy(P.cam.p); cam.rotation.set(P.cam.pitch, P.cam.yaw, 0, 'YXZ');
    return fov;
  };

  /* -------------------------------------------------------------- overlay */
  let el = null;
  const who = a => !a ? '' : a.isPlayer ? 'YOU' : a.hostage ? 'HOSTAGE' : GAME.who(a) + ' · ' + a.op.name;
  function overlay(P) {
    if (!el) {
      el = U.el('div', { id: 'kcLayer' });
      document.body.append(el);
    }
    const k = P.killer, v = P.victim, my = G.player ? G.player.team : 0;
    const side = a => !a ? '' : a.hostage ? 'neutral' : a.team === my ? 'mine' : 'theirs';
    const f = P.frames.find(x => x.t >= P.tk) || P.frames[P.frames.length - 1];
    const kd = k ? f.d[P.list.indexOf(k)] : null, wd = P.follow && kd && kd.w ? DATA.WEAPONS[kd.w] : null;
    el.innerHTML = '';
    el.append(
      U.el('div', { class: 'kc-top' }, U.el('div', { class: 'kc-tag' }, U.el('i', {}), 'REPLAY'),
        U.el('div', { class: 'kc-title' }, P.mode === 'round' ? 'ROUND-WINNING KILL' : 'KILL CAM'), U.el('div', { class: 'kc-bar' }, U.el('i', {}))),
      U.el('div', { class: 'kc-bottom' },
        U.el('div', { class: 'kc-line' },
          k ? U.el('b', { class: side(k) }, who(k)) : U.el('b', { class: 'neutral' }, P.mode === 'death' ? 'YOU DIED' : ''),
          k ? U.el('span', { class: 'kc-wpn' }, wd ? wd.name : P.follow ? '' : 'GADGET') : '',
          k ? U.el('b', { class: side(v) }, who(v)) : (P.mode === 'death' ? '' : U.el('b', { class: side(v) }, who(v))),
          P.head ? U.el('em', {}, 'HEADSHOT') : ''),
        U.el('div', { class: 'kc-skip' }, KEYS.fmt('[{vault}] skip'))));
    el.style.display = '';
  }

  window.KC = KC;
})();
