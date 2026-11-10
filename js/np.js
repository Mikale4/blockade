/* ============================================================================
   np.js -- the networked match (online rooms).

   The HOST's game runs the match: bots, damage, gadgets, destruction, rounds.
   Ten times a second it sends every guest a snapshot: every operator (pose,
   health, status), the gadgets in the world (only what changed), the voxels
   that changed, the kill feed, the clock, and the sounds and effects that
   happened (so everyone hears footsteps, gunfire and explosions where they are).

   A GUEST moves its own operator itself (so moving and aiming feel instant)
   and tells the host where it is twenty times a second. Its shots go to the
   host, which traces them in its own world and applies the damage; gadgets,
   interactions (plant, revive, reinforce...), drones and pings are requests
   the host carries out. Everything else a guest sees comes from snapshots.

   If a guest leaves, a bot takes over their operator. If the host leaves, the
   match ends for everyone.
   ========================================================================== */
(function () {
  'use strict';
  const { WEAPONS, OPMAP, OPS } = DATA;
  const V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  const r2 = v => Math.round(v * 100) / 100;
  const r4 = v => Math.round(v * 10000) / 10000;
  const pv = v => [r2(v.x), r2(v.y), r2(v.z)];
  const NP = window.NP = { active: false, host: false, me: null, room: null, picks: new Map(), ev: [], vox: [], snapT: 0, inT: 0, lastEnt: new Map(), feedSig: '', sides: ['atk', 'def'], byId: new Map(), mirrors: new Map(), _depth: 0 };

  /* ---------------------------------------------- replicate sounds & effects */
  const SFX_EV = ['explosion', 'crumble', 'glass', 'impact', 'wood', 'metal', 'zap', 'sonar', 'beep', 'whoosh', 'throwS', 'melee', 'step', 'plant'];
  const FX_EV = ['explosion', 'flash', 'smoke', 'puff'];
  const oS = {}, oF = {};
  const ser = a => a instanceof THREE.Vector3 ? { v: pv(a) } : typeof a === 'number' ? r2(a) : (typeof a === 'boolean' || typeof a === 'string' || a == null) ? a : null;
  const des = a => a && a.v ? V(a.v[0], a.v[1], a.v[2]) : a;
  NP.install = () => {
    if (NP._inst) return; NP._inst = true;
    for (const f of SFX_EV) { oS[f] = SFX[f]; SFX[f] = function (...a) { if (NP.active && NP.host && !NP._depth) NP.ev.push({ k: 's', f, a: a.map(ser) }); NP._depth++; try { return oS[f].apply(SFX, a); } finally { NP._depth--; } }; }
    for (const f of FX_EV) { oF[f] = FX[f]; FX[f] = function (...a) { if (NP.active && NP.host && !NP._depth) NP.ev.push({ k: 'f', f, a: a.map(ser) }); NP._depth++; try { return oF[f].apply(FX, a); } finally { NP._depth--; } }; }
  };
  NP.quiet = fn => { NP._depth++; try { return fn(); } finally { NP._depth--; } };
  NP.push = e => { if (NP.active && NP.host) NP.ev.push(e); };
  NP.tell = (a, x, c) => { if (!a) return; if (a.isPlayer) HUD.toast(x, c); else if (a.net) NP.push({ k: 'toast', to: a.net, x, c }); };
  NP.tellTeam = (team, x, alarm) => { if (G.player && G.player.team === team) { if (alarm) SFX.alarm(); HUD.toast(x); } NP.push({ k: 'toast', team, x, alarm: !!alarm }); };

  /* ================================================================ start / stop */
  NP.start = (host, room, me) => {
    NP.install();
    Object.assign(NP, { active: true, host, room, me, picks: new Map(), ev: [], vox: [], lastEnt: new Map(), feedSig: '', byId: new Map(), mirrors: new Map(), snapT: 0, inT: 0, pilot: 0 });
    NP.prevSettings = { diff: G.settings.difficulty, rounds: G.settings.roundsToWin, swap: G.settings.swapEveryRound };
    G.settings.difficulty = room.diff; G.settings.roundsToWin = room.rounds; G.settings.swapEveryRound = true;
    GAME.net = true; GAME.client = !host; GAME.ranked = !!room.ranked;
    const mm = room.members.find(m => m.id === me); GAME.myTeam = mm ? mm.team : 0;
    Online.setPresence();
    MENU.loading('Loading ' + (MAPS.LIST.find(m => m.id === room.map) || {}).name + '…', () => {
      if (host) GAME.startMatch({ mode: room.mode, map: room.map, side: room.side, online: true, ranked: !!room.ranked });
      else { GAME.mode = room.mode; GAME.mapId = room.map; MAIN.loadMap(room.map); GAME.active = true; GAME.phase = 'select'; waiting('Waiting for the host…'); }
    });
  };
  NP.stop = () => {
    if (!NP.active) return;
    NP.active = false;
    for (const m of NP.mirrors.values()) m.destroy();
    NP.mirrors.clear();
    if (NP.prevSettings) { G.settings.difficulty = NP.prevSettings.diff; G.settings.roundsToWin = NP.prevSettings.rounds; G.settings.swapEveryRound = NP.prevSettings.swap; }
    GAME.net = false; GAME.client = false; GAME.myTeam = 0;
    clearTimeout(NP.selT);
  };
  /* the host's world: every voxel that changes goes to the guests */
  NP.hookWorld = () => {
    const w = G.world, prev = w.onChange;
    w.onChange = (x, y, z) => { prev && prev(x, y, z); if (NP.active && NP.host) NP.vox.push(x, y, z, w.get(x, y, z)); };
  };
  function waiting(text) {
    G.mode = 'select'; HUD.show(false); PLAYER.release();
    const s = U.$('screens'); s.innerHTML = ''; s.className = '';
    s.append(U.el('div', { class: 'loading' }, U.el('div', { class: 'spin' }), text, U.el('button', { class: 'btn ghost small', onclick: () => Online.leave() }, 'LEAVE')));
  }
  NP.waiting = waiting;

  /* ======================================================== operator select */
  NP.select = () => {
    // host: everyone picks; the round starts when all have (or after 45 s)
    NP.picks.clear();
    const R = NP.room;
    const teams = {}; for (const m of R.members) teams[m.id] = m.team;
    Online.toAll({ t: 'np.sel', round: GAME.round, score: GAME.score, sites: GAME.siteNames, sd: [GAME.sideOf(0), GAME.sideOf(1)], mode: GAME.mode, teams }, true);
    clearTimeout(NP.selT);
    NP.selT = setTimeout(() => { if (NP.active && NP.host && GAME.phase === 'select') { GAME.startRound(); } }, 45000);
  };
  NP.myPick = c => {
    if (NP.host) { NP.picks.set(NP.me, { op: c.op.id, lo: c.loadout, sp: c.spawn }); NP.tryStart(); }
    else Online.toHost({ t: 'np.pick', op: c.op.id, lo: c.loadout, sp: c.spawn });
    if (!NP.host || !NP.allPicked()) waiting('Waiting for the other players to pick…');
  };
  NP.allPicked = () => NP.room.members.every(m => NP.picks.has(m.id));
  NP.tryStart = () => { if (NP.host && GAME.phase === 'select' && NP.allPicked()) { clearTimeout(NP.selT); GAME.startRound(); } };
  /* who plays what this round */
  NP.humanPicks = () => {
    const out = [], taken = [new Set(), new Set()];
    for (const m of NP.room.members) {
      const side = GAME.ffa ? 'any' : GAME.sideOf(m.team), p = NP.picks.get(m.id) || {};
      let op = OPMAP[p.op];
      // Deathmatch: any operator, and two players may pick the same one
      if (!op || (side !== 'any' && (op.side !== side || taken[m.team].has(op.id)))) op = U.shuffle(OPS.filter(o => (side === 'any' || o.side === side) && !taken[m.team].has(o.id)))[0];
      taken[m.team].add(op.id);
      const lo = Object.assign({ primary: op.primaries[0], secondary: op.secondaries[0], gadget: op.gadgets[0] }, p.lo || {});
      if (!op.primaries.includes(lo.primary)) lo.primary = op.primaries[0];
      if (!op.secondaries.includes(lo.secondary)) lo.secondary = op.secondaries[0];
      if (!op.gadgets.includes(lo.gadget)) lo.gadget = op.gadgets[0];
      lo.cos = SHOP.clean(lo.cos);
      out.push({ team: m.team, op, loadout: lo, spawn: p.sp | 0, name: m.name, peer: m.id, local: m.id === NP.me, r: m.r });
    }
    return out;
  };

  /* ================================================================ host side */
  NP.roundStarted = () => {
    NP.byId.clear(); for (const a of G.actors) NP.byId.set(a.id, a);
    NP.lastEnt.clear(); NP.feedSig = ''; NP.ev = []; NP.vox = [];
    const roster = G.actors.map(a => ({ id: a.id, n: a.name, tm: a.team, sd: a.side, op: a.hostage ? '_hostage' : a.op.id, lo: a.loadout, h: a.isPlayer ? NP.me : a.net || null, hs: a.hostage ? 1 : 0, p: pv(a.pos), y: r2(a.yaw), st: a.stance, rr: a.rating || 0 }));
    Online.toAll({ t: 'np.round', roster, sites: GAME.siteNames, round: GAME.round, score: GAME.score, sd: [GAME.sideOf(0), GAME.sideOf(1)], mode: GAME.mode, ph: GAME.phase, tm: GAME.timer }, true);
    // remote attackers drone during prep, like everyone else
    if (!GAME.arcade) for (const a of G.actors) if (a.net && a.side === 'atk') { const d = GAD.deployDrone(a, true); if (d) pilot(a, d); }
  };
  NP.actionStart = () => {
    for (const a of G.actors) if (a.net && a.netDrone) { const d = G.ents.find(e => e.nid === a.netDrone); if (d) { d.pilot = null; d.mf = d.mr = 0; } a.netDrone = 0; NP.push({ k: 'undrone', to: a.net }); }
  };
  function pilot(a, d) { d.pilot = a; a.netDrone = d.nid; NP.push({ k: 'pilot', to: a.net, nid: d.nid }); }
  NP.actorOf = peer => G.actors.find(a => a.net === peer) || null;
  NP.memberLeft = (peer, name) => {
    NP.picks.delete(peer);
    const a = NP.actorOf(peer);
    if (a) { a.net = null; a.remote = false; AI.attach(a); if (GAME.arcade) a.bot.role = 'roam'; a.name = NAMES.make(); HUD.toast(name + ' left: a bot took over ' + a.op.name, 'warn'); }
    if (NP.host && GAME.phase === 'select') NP.tryStart();
  };
  NP.hostGot = (id, d) => {
    if (!NP.active || !NP.host) return;
    if (d.t === 'np.pick') { NP.picks.set(id, { op: d.op, lo: d.lo, sp: d.sp }); NP.tryStart(); return; }
    const a = NP.actorOf(id); if (!a) return;
    if (d.t === 'np.in') return applyIn(a, d);
    if (d.t === 'np.shot') return remoteShot(a, d);
    if (d.t === 'np.act') return remoteAct(a, d);
  };
  function applyIn(a, d) {
    if (!Array.isArray(d.p)) return;
    const dx = d.p[0] - a.pos.x, dz = d.p[2] - a.pos.z;
    a.pos.set(d.p[0], d.p[1], d.p[2]);
    if (Array.isArray(d.v)) a.vel.set(d.v[0], d.v[1], d.v[2]);
    a.yaw = +d.yw || 0; a.pitch = +d.pt || 0; a.stance = d.st | 0; a.h = +d.h || 1.75; a.eyeH = Math.max(0.3, a.h - 0.15);
    a.lean = +d.ln || 0; a.ads = +d.ad || 0; a.moving = +d.mv || 0; a.sprint = !!d.sp; a.walk = !!d.wk; a.netHold = !!d.hd; a.mf = d.mf || 0;
    if (a.w[d.cu] && a.cur !== d.cu) { a.cur = d.cu; if (a.rig) MD.setRigGun(a.rig, a.wpn.id); }
    a.rappel = d.rp ? (a.rappel || { ax: 'x', s: 1 }) : null;
    // footsteps for everyone else to hear (and the bots)
    const moved = Math.hypot(dx, dz);
    if (moved < 2 && a.state !== 'dead' && !a.rappel && a.moving > 0.6) {
      a.stepAcc += moved;
      if (a.stepAcc > (a.moving > 4 ? 0.8 : 0.62)) {
        a.stepAcc = 0;
        const quiet = (a.op.ability && a.op.ability.id === 'decoy') || a.stance === 2, loud = a.moving > 3.6, soft = a.walk && !loud;
        if (!quiet || loud) { SFX.step(a.pos, loud && !quiet, false, null, soft); GAME.noise(a.pos, soft ? 2.5 : quiet ? 4 : loud ? 14 : a.stance === 1 ? 4 : 8, a, 'step'); }
      }
    }
    if (Array.isArray(d.dr) && a.netDrone) { const dr = G.ents.find(e => e.nid === a.netDrone && e.alive); if (dr) { dr.mf = d.dr[0]; dr.mr = d.dr[1]; if (d.dr[2]) dr.jump = true; dr.yaw = d.dr[3]; dr.pitch = d.dr[4]; } }
  }
  function remoteShot(a, d) {
    if (a.state !== 'alive') return;
    a.spawnProt = 0;
    const def = WEAPONS[d.w]; if (!def || !Array.isArray(d.o) || !Array.isArray(d.d)) return;
    const o = V(d.o[0], d.o[1], d.o[2]), ends = [];
    for (const dd of d.d.slice(0, 12)) { const dir = V(dd[0], dd[1], dd[2]).normalize(); ends.push(pv(WPN.trace(a, o, dir, def, def.pellets > 1 ? 40 : 140, 1))); }
    a.lastShot = G.time; MUSIC.lastShot = G.time;
    GAME.noise(o, 45, a, 'shot');
    NP.push({ k: 'shot', s: a.id, o: d.o, e: ends.slice(0, 3), w: d.w });
    // the host hears and sees it too
    const mz = WPN.muzzlePos(a);
    SFX.shot(def, o, false); NP.quiet(() => FX.flash(mz, 0.4, 0.04));
    for (const e of ends.slice(0, 2)) FX.tracer(mz, V(e[0], e[1], e[2]), 0xffb070);
    KC.shot(a, def.id, mz, ends.slice(0, 3).map(e => V(e[0], e[1], e[2])));
  }
  function remoteAct(a, d) {
    if (Array.isArray(d.p) && a.state === 'alive') a.pos.set(d.p[0], d.p[1], d.p[2]);
    if (d.yw != null) { a.yaw = +d.yw; a.pitch = +d.pt || 0; }
    switch (d.k) {
      case 'gadget': GAD.secondary(a); break;
      case 'ability': GAD.ability(a); break;
      case 'rdet': if (!GAD.detonateAll(a, 'rcharge')) NP.tell(a, 'No charges placed'); break;
      case 'melee': WPN.melee(a); break;
      case 'interact': if (!a.interact) { const its = GAME.interactions(a); if (its.length) GAME.beginInteract(a, its[0]); } break;
      case 'device': {
        if (a.side !== 'atk' || a.state !== 'alive' && a.state !== 'dead') break;
        const mine = G.ents.filter(e => e.alive && e.type === 'drone' && e.owner === a);
        if (mine.length) { const cur = mine.findIndex(e => e.nid === a.netDrone); pilot(a, mine[(cur + 1) % mine.length]); break; }
        if (a.state === 'alive' && GAME.phase === 'action' && a.drones > 0) { const dr = GAD.deployDrone(a, false); if (dr) setTimeout(() => { if (dr.alive && NP.active) pilot(a, dr); }, 400); }
        else NP.tell(a, 'No drones left');
        break;
      }
      case 'undrone': { const dr = G.ents.find(e => e.nid === a.netDrone); if (dr) { dr.pilot = null; dr.mf = dr.mr = 0; } a.netDrone = 0; break; }
      case 'zap': { const dr = G.ents.find(e => e.nid === a.netDrone && e.alive); if (dr) dr.zap(); break; }
      case 'ping': { const t = NP.byId.get(d.aid); if (t && t.team !== a.team && t.state !== 'dead') GAME.mark(t, a.team, Math.min(6, +d.dur || 5), true); break; }
      // a guest crashed or vaulted through a window: break it here too, so everyone sees it open
      case 'smash': { const op = G.map.openings[d.w | 0]; if (op && op.kind === 'window' && op.ext && a.side === 'atk') Actor.smashWindow(op, a); break; }
    }
  }
  /* --- snapshots */
  function actRec(a) {
    const st = a.state === 'alive' ? 0 : a.state === 'dbno' ? 1 : 2;
    const fl = (a.shieldUp ? 1 : 0) | (a.rappel ? 2 : 0) | (a.carry === 'defuser' ? 4 : 0) | (a.carry && a.carry.hostage ? 8 : 0);
    const mk = [a.marks && a.marks[0] > G.time ? r2(a.marks[0] - G.time) : 0, a.marks && a.marks[1] > G.time ? r2(a.marks[1] - G.time) : 0];
    const rec = [a.id, r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), r2(a.pitch), a.stance, r2(a.h), r2(a.lean), Math.ceil(a.hp), Math.ceil(a.over), st, a.wpn ? a.wpn.id : '', r2(a.ads), r2(a.moving || 0), fl,
      r2(a.stun), r2(a.blind), r2(a.blindK), r2(a.rooted), r2(a.slow), r2(a.bleed), mk, a.interact ? r2(a.interact.t / a.interact.it.time) : -1, a.interact ? a.interact.it.label : '', a.followTarget ? a.followTarget.id : 0];
    if (a.net || a.isPlayer) rec.push([a.gadget ? a.gadget.count : 0, a.ability ? a.ability.count : 0, a.ability ? r2(a.ability.cd) : 0, a.ability ? a.ability.zaps : 0, a.drones, a.placed.filter(e => e.alive && e.detonate && a.gadget && e.type === a.gadget.id).length]);
    return rec;
  }
  function entRec(e) {
    const m = e.mesh, x = {};
    if (e.type === 'cam' || e.type === 'bpcam') { x.n = e.name; x.y = r2(e.yaw); x.p = r2(e.pitch); }
    if (e.type === 'defuser') x.l = Math.ceil(e.left);
    if (e.type === 'drone') { x.pl = e.pilot ? e.pilot.id : 0; x.sg = e.surge ? 1 : 0; x.j = r2(e.jamT); }
    if (e.type === 'snare' && e.p0) { x.a = pv(e.p0); x.b = pv(e.p1); }
    if (e.type === 'medstation') { x.u = e.uses; x.us = [...e.used].map(q => q.id); }
    if (e.type === 'fire') x.r = e.r;
    if (e.solid) { const b = e.solid; x.bx = [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1].map(r2); }
    if (m && (m.scale.x !== 1 || m.scale.y !== 1)) x.sc = [r2(m.scale.x), r2(m.scale.y), r2(m.scale.z)];
    return [e.nid, e.type, e.team, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), m ? r2(m.rotation.x) : 0, m ? r2(m.rotation.y) : 0, m ? r2(m.rotation.z) : 0, e.model || e.type, x];
  }
  function snapshot() {
    const o = GAME.obj;
    const s = { t: 'np.s', ph: GAME.phase, tm: r2(GAME.timer), sc: GAME.score.slice(), rd: GAME.round, sd: [GAME.sideOf(0), GAME.sideOf(1)], pool: [GAME.pool[0] || 0, GAME.pool[1] || 0],
      o: { df: o.defuser && o.defuser.alive ? o.defuser.nid : 0, dp: o.dropped && o.dropped.alive ? o.dropped.nid : 0, hs: o.hostage ? o.hostage.id : 0, pg: r2(o.prog || 0), ct: o.contested ? 1 : 0 },
      a: G.actors.map(actRec), e: [], g: [], ev: NP.ev, v: NP.vox,
      // everyone's kills, deaths, assists and score, for the Tab board and Deathmatch standings
      st: G.actors.filter(a => a.match).map(a => [a.id, a.match.k, a.match.d, a.match.a, a.match.s]) };
    NP.ev = []; NP.vox = [];
    const seen = new Set();
    for (const e of G.ents) {
      if (!e.alive || !e.nid) continue;
      seen.add(e.nid);
      const r = entRec(e), key = JSON.stringify(r);
      if (NP.lastEnt.get(e.nid) !== key) { NP.lastEnt.set(e.nid, key); s.e.push(r); }
    }
    for (const nid of [...NP.lastEnt.keys()]) if (!seen.has(nid)) { NP.lastEnt.delete(nid); s.g.push(nid); }
    const fs = JSON.stringify(GAME.feed.map(f => [f.k, f.v, f.verb, f.head, f.t]));
    if (fs !== NP.feedSig) { NP.feedSig = fs; s.f = GAME.feed.map(f => ({ k: f.k, kt: f.kt, v: f.v, vt: f.vt, head: f.head, verb: f.verb })); }
    return s;
  }
  NP.hostUpdate = dt => {
    if (!NP.active || !NP.host || (GAME.phase !== 'prep' && GAME.phase !== 'action' && GAME.phase !== 'post')) return;
    NP.snapT += dt;
    if (NP.snapT >= 0.1) { NP.snapT = 0; Online.toAll(snapshot(), true); }
  };
  NP.matchEnd = () => {
    const stats = G.actors.filter(a => !a.hostage).map(a => ({ n: a.name, op: a.op.id, tm: a.team, h: a.isPlayer ? NP.me : a.net || null, k: a.match.k, a: a.match.a, d: a.match.d, s: a.match.s, r: a.rating || 1000 }));
    Online.toAll({ t: 'np.end', score: GAME.score, stats }, true);
    return stats;
  };

  /* ================================================================ guest side */
  class Mirror {
    constructor(r) {
      this.nid = r[0]; this.type = r[1]; this.team = r[2]; this.alive = true; this.hp = 1; this.mirror = true;
      this.pos = V(r[3], r[4], r[5]); this.tpos = this.pos.clone(); this.normal = V(0, 1, 0);
      this.look = { yaw: 0, pitch: 0 }; this.used = new Set(); this.uses = 4; this.yaw = 0; this.pitch = 0;
      this.elec = ['cam', 'bpcam', 'dampener', 'scrambler', 'sensor', 'seeker', 'snare', 'photon', 'claymore', 'beacon', 'drone', 'decoy', 'c4', 'rcharge', 'breach'].includes(this.type);
      if (this.type === 'drone') this.mesh = MD.drone(r[10] && r[10].sg ? 0xb07cff : 0x5ad8ff);
      else if (this.type !== 'fire' && this.type !== 'irritant') this.mesh = GAD.mesh(r[9]);
      if (this.mesh) { this.mesh.position.copy(this.pos); G.scene.add(this.mesh); }
      this.set(r, true);
    }
    set(r, first) {
      this.tpos.set(r[3], r[4], r[5]); this.team = r[2];
      if (this.mesh) this.mesh.rotation.set(r[6], r[7], r[8]);
      const x = r[10] || {};
      if (x.n) { this.name = x.n; this.yaw = x.y; this.pitch = x.p; }
      if (x.l != null) this.left = x.l;
      if (x.pl != null) { this.pilotId = x.pl; this.surge = !!x.sg; this.jamT = x.j || 0; if (NP.myDrone !== this) { this.yaw = r[7]; } }
      if (x.a && !this.line) { this.p0 = V(...x.a); this.p1 = V(...x.b); this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.p0, this.p1]), new THREE.LineBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.55 })); G.scene.add(this.line); }
      if (x.u != null) { this.uses = x.u; this.used = new Set((x.us || []).map(id => NP.byId.get(id)).filter(Boolean)); }
      if (x.r) this.r = x.r;
      if (x.bx) { const b = x.bx; this.solid = this.hitBox = { x0: b[0], y0: b[1], z0: b[2], x1: b[3], y1: b[4], z1: b[5] }; }
      if (x.sc && this.mesh) this.mesh.scale.set(x.sc[0], x.sc[1], x.sc[2]);
      if (first) this.pos.copy(this.tpos);
    }
    update(dt) {
      this.pos.lerp(this.tpos, Math.min(1, dt * 14));
      if (this.mesh) this.mesh.position.copy(this.pos);
      if (this.type === 'fire') FX.flames(this.pos, this.r || 2.5, 3);
      if (this.type === 'irritant') GAD.hazeFx(this.pos, 3.5, dt);
    }
    eye() { return this.pos.clone().add(V(0, 0.12, 0)); }
    fwd() { const cp = Math.cos(this.pitch); return V(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
    zap() { Online.toHost({ t: 'np.act', k: 'zap' }); return true; }
    shot() { }
    destroy() { if (!this.alive) return; this.alive = false; if (this.mesh) G.scene.remove(this.mesh); if (this.line) G.scene.remove(this.line); if (PLAYER.drone === this) PLAYER.leaveDrone(true); }
  }
  NP.guestGot = d => {
    if (!NP.active || NP.host) return;
    switch (d.t) {
      case 'np.sel': {
        KC.reset();
        GAME.round = d.round; NP.sides = d.sd; GAME.siteNames = d.sites; GAME.mode = d.mode;
        if (d.teams && d.teams[NP.me] != null) GAME.myTeam = d.teams[NP.me];
        GAME.score = d.score; GAME.phase = 'select';
        const mine = GAME.myTeam;
        MENU.opSelect({ side: GAME.ffa ? 'any' : NP.sides[mine], round: d.round, score: [d.score[mine], d.score[1 - mine]], mode: d.mode, sites: d.sites, map: G.map, online: true, onReady: c => NP.myPick(c) });
        break;
      }
      case 'np.round': buildRound(d); break;
      case 'np.s': applySnap(d); break;
      case 'np.end': matchOver(d); break;
    }
  };
  function buildRound(d) {
    MAIN.resetWorld();
    for (const m of NP.mirrors.values()) m.destroy();
    NP.mirrors.clear(); NP.byId.clear();
    GAME.round = d.round; GAME.score = d.score; NP.sides = d.sd; GAME.siteNames = d.sites; GAME.mode = d.mode;
    GAME.siteRooms = d.sites.map(n => G.map.roomByName[n][0]); GAME.obj = { rooms: GAME.siteRooms }; GAME.feed = []; GAME.reinforced = [];
    G.actors = [];
    for (const r of d.roster) {
      const op = r.hs ? MD.HOSTAGE_OP : OPMAP[r.op];
      const lo = Object.assign({}, r.lo || {}); if (!r.hs) lo.cos = SHOP.clean(lo.cos);
      const a = new Actor({ name: r.n, team: r.tm, side: r.sd, op, loadout: lo, isPlayer: r.h === NP.me, hostage: !!r.hs });
      a.id = r.id; a.pos.set(r.p[0], r.p[1], r.p[2]); a.yaw = r.y; a.stance = r.st || 0; a.tpos = a.pos.clone(); a.tyaw = a.yaw;
      if (r.h && r.h !== NP.me) a.netHuman = r.h;
      a.addTo(G.scene); G.actors.push(a); NP.byId.set(a.id, a);
      if (a.isPlayer) { G.player = a; if (GAME.ffa) GAME.myTeam = a.team; }
      if (a.hostage) GAME.obj.hostage = a;
      a.match = { k: 0, d: 0, a: 0, s: 0 }; a.rating = r.rr;
    }
    GAME.phase = d.ph; GAME.timer = d.tm; GAME.active = true;
    G.mode = 'match'; MENU.hide(); HUD.show(true);
    PLAYER.roundStart(); HUD.roundStart();
    SFX.voice('start');
    const M = DATA.MODES[GAME.mode] || {};
    if (GAME.arcade) HUD.banner(M.name, GAME.ffa ? 'Everyone for themselves · first to ' + M.limit + ' kills' : 'First team to ' + M.limit + ' kills', 3);
    else HUD.banner('ROUND ' + (GAME.round + 1), (NP.sides[GAME.myTeam] === 'atk' ? 'ATTACK' : 'DEFENSE') + ' · PREPARATION PHASE', 2.5);
    Online.setPresence();
  }
  function tryPilot() {
    if (!NP.pilot) return;
    const m = NP.mirrors.get(NP.pilot);
    if (m && m.alive) { NP.myDrone = m; m.yaw = G.player ? G.player.yaw : 0; m.pitch = 0; PLAYER.enterDrone(m); NP.pilot = 0; }
  }
  function applySnap(s) {
    if (!G.player || !G.world) return;
    const prevPh = GAME.phase;
    GAME.phase = s.ph; GAME.timer = s.tm; GAME.score = s.sc; GAME.round = s.rd; NP.sides = s.sd; GAME.pool = { 0: s.pool[0], 1: s.pool[1] };
    if (prevPh === 'prep' && s.ph === 'action') { PLAYER.actionStart(); HUD.banner('ACTION PHASE', GAME.mode === 'bomb' ? 'Bomb · ' + GAME.siteNames.join(' / ') : GAME.siteNames[0], 2); SFX.voice('start'); }
    // voxels
    const W = G.world, v = s.v || [];
    for (let i = 0; i + 3 < v.length; i += 4) { const old = W.get(v[i], v[i + 1], v[i + 2]); W.set(v[i], v[i + 1], v[i + 2], v[i + 3]); if (!v[i + 3] && old && Math.random() < 0.3) FX.debris(v[i], v[i + 1], v[i + 2], old); }
    // gadgets
    for (const r of s.e || []) { const m = NP.mirrors.get(r[0]); if (m) m.set(r); else { const nm = new Mirror(r); NP.mirrors.set(r[0], nm); G.ents.push(nm); } }
    for (const nid of s.g || []) { const m = NP.mirrors.get(nid); if (m) { m.destroy(); NP.mirrors.delete(nid); } }
    if (G.ents.length > 80) G.ents = G.ents.filter(e => e.alive);
    tryPilot();
    // objective
    const o = GAME.obj;
    o.defuser = s.o.df ? NP.mirrors.get(s.o.df) || null : null;
    o.dropped = s.o.dp ? NP.mirrors.get(s.o.dp) || null : null;
    o.hostage = s.o.hs ? NP.byId.get(s.o.hs) || o.hostage : null;
    o.prog = s.o.pg; o.contested = !!s.o.ct;
    // operators
    for (const r of s.st || []) { const a = NP.byId.get(r[0]); if (a && a.match) { a.match.k = r[1]; a.match.d = r[2]; a.match.a = r[3]; a.match.s = r[4]; } }
    // the feed first, so a death below already knows who did it
    if (s.f) { GAME.feed = s.f; HUD.feedDirty = true; }
    for (const r of s.a) applyActor(r);
    for (const e of s.ev || []) { try { playEv(e); } catch (x) { console.warn('event', e, x); } }
  }
  function applyActor(r) {
    const a = NP.byId.get(r[0]); if (!a) return;
    const me = a === G.player;
    if (!me) {
      a.tpos = a.tpos || a.pos.clone(); a.tpos.set(r[1], r[2], r[3]);
      if (a.tpos.distanceTo(a.pos) > 4) a.pos.copy(a.tpos);
      a.tyaw = r[4]; a.pitch = r[5]; a.stance = r[6]; a.h = r[7]; a.lean = r[8]; a.ads = r[13]; a.moving = r[14]; a.eyeH = Math.max(0.3, a.h - 0.15);
      a.rappel = (r[15] & 2) ? (a.rappel || { ax: 'x', s: 1 }) : null;
      if (r[12] && a.wpn && a.wpn.id !== r[12]) { const i = a.w.findIndex(w => w.id === r[12]); if (i >= 0) { a.cur = i; if (a.rig) MD.setRigGun(a.rig, r[12]); } }
    }
    a.hp = r[9]; a.over = r[10];
    const st = ['alive', 'dbno', 'dead'][r[11]];
    if (st !== a.state) {
      const prev = a.state; a.state = st;
      if (st === 'dead') { a.deathT = 0; a.trigger = false; if (me) PLAYER.onDeath(null); }
      else if (st === 'dbno') { a.stance = 2; if (me) HUD.toast('YOU ARE DOWN · wait for a revive', 'warn'); }
      else if (st === 'alive' && prev === 'dbno') a.stance = 1;
    }
    const fl = r[15], sh = !!(fl & 1);
    if (a.shieldOp && sh !== a.shieldUp) { a.shieldUp = sh; if (a.rig) { if (sh && !a.rig.shield) MD.addShield(a.rig); else if (!sh && a.rig.shield) { a.rig.aim.remove(a.rig.shield); a.rig.shield = null; } } }
    a.carry = (fl & 4) ? 'defuser' : (fl & 8) ? (GAME.obj.hostage || null) : null;
    a.stun = r[16]; a.blind = r[17]; a.blindK = r[18]; a.rooted = r[19]; a.slow = r[20]; a.bleed = r[21];
    a.marks = { 0: r[22][0] ? G.time + r[22][0] : 0, 1: r[22][1] ? G.time + r[22][1] : 0 };
    if (me) a.interact = r[23] >= 0 ? { it: { label: r[24], time: 1, kind: 'net', ok: () => true, run: () => { } }, t: r[23], from: a.pos.clone() } : null;
    a.followTarget = r[25] ? NP.byId.get(r[25]) || null : null;
    if (me && r[26]) { const c = r[26]; if (a.gadget) a.gadget.count = c[0]; if (a.ability) { a.ability.count = c[1]; a.ability.cd = c[2]; a.ability.zaps = c[3]; } a.drones = c[4]; a.netPlaced = c[5]; }
  }
  function playEv(e) {
    switch (e.k) {
      case 's': {
        const a = e.a.map(des);
        if (e.f === 'step') { if (G.player && a[0] && U.dist3(a[0], G.player.pos) < 0.9) return; a[2] = false; }
        oS[e.f].apply(SFX, a); break;
      }
      case 'f': oF[e.f].apply(FX, e.a.map(des)); break;
      case 'shot': {
        const s = NP.byId.get(e.s); if (!s || s === G.player) break;
        const def = WEAPONS[e.w]; if (!def) break;
        const o = V(...e.o), mz = WPN.muzzlePos(s);
        SFX.shot(def, o, PLAYER.viewActor() === s); oF.flash(mz, 0.4, 0.04);
        for (const p of e.e || []) FX.tracer(mz, V(...p), 0xffb070);
        KC.shot(s, def.id, mz, (e.e || []).map(p => V(...p)));
        s.lastShot = G.time; MUSIC.lastShot = G.time;
        break;
      }
      case 'hit': if (e.to === NP.me) HUD.hitmarker(e.h, e.x); break;
      case 'hurt': if (e.to === NP.me) { SFX.hurt(); HUD.hurt(e.d ? V(...e.d) : null); } break;
      case 'flash': if (e.to === NP.me) { HUD.flash(e.s); SFX.flashRing(e.s); } break;
      case 'shake': if (e.to === NP.me) PLAYER.shake(e.s); break;
      case 'toast': if (e.to === NP.me || (e.team != null && G.player && e.team === G.player.team)) { HUD.toast(e.x, e.c); if (e.alarm) SFX.alarm(); } break;
      case 'pilot': if (e.to === NP.me) { NP.pilot = e.nid; tryPilot(); } break;
      case 'undrone': if (e.to === NP.me && PLAYER.view === 'drone') PLAYER.leaveDrone(true); break;
      case 'plant': HUD.banner('DEFUSER PLANTED', e.r, 2, e.tm === GAME.myTeam ? 'win' : 'lose'); break;
      case 'spawn': {
        // the host respawned me (Deathmatch / Team Deathmatch): move there and start fresh
        if (e.to !== NP.me || !G.player || !Array.isArray(e.p)) break;
        G.player.respawn(V(e.p[0], e.p[1], e.p[2]), +e.y || 0); PLAYER.respawned();
        break;
      }
      case 'rend': {
        const place = e.arc && e.pl ? e.pl[NP.me] || 0 : 0;
        const won = e.arc && GAME.ffa ? place === 1 : e.w === GAME.myTeam;
        SFX.voice(won ? 'win' : 'lose'); MUSIC.sting(won);
        const title = e.arc ? (GAME.ffa ? ARC.ordinal(place) + ' PLACE' : e.w < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT') : won ? 'ROUND WON' : 'ROUND LOST';
        const ban = dur => HUD.banner(title, e.arc ? e.r : e.r + '  ·  ' + GAME.score[GAME.myTeam] + ' – ' + GAME.score[1 - GAME.myTeam], dur, won ? 'win' : 'lose');
        PLAYER.leaveDrone(true); PLAYER.leaveCams();
        // the host says which kill ended it; replay it from this side's own recording
        let dur = 0;
        if (e.kc) { const v = NP.byId.get(e.kc.v), k = e.kc.k ? NP.byId.get(e.kc.k) || null : null; if (v) dur = KC.queue('round', k, v, 1.4, { head: !!e.kc.h, done: () => ban(Math.max(1, GAME.timer - 0.4)) }); }
        ban(dur ? 1.4 : 6.5);
        break;
      }
    }
  }
  /* guest frame: smooth the others, run gadget visuals, send my state */
  NP.guestUpdate = dt => {
    if (!NP.active || NP.host) return;
    const k = 1 - Math.exp(-dt * 14);
    for (const a of G.actors) {
      if (a === G.player || !a.tpos) continue;
      a.pos.lerp(a.tpos, k);
      if (a.tyaw != null) a.yaw = U.turn(a.yaw, a.tyaw, k);
    }
    for (const m of NP.mirrors.values()) m.update(dt);
    const a = G.player; if (!a) return;
    NP.inT += dt;
    if (NP.inT >= 0.05 && (GAME.phase === 'prep' || GAME.phase === 'action')) {
      NP.inT = 0;
      const d = PLAYER.drone && PLAYER.view === 'drone' ? PLAYER.drone : null;
      Online.toHost({ t: 'np.in', p: pv(a.pos), v: pv(a.vel), yw: r4(a.yaw), pt: r4(a.pitch), st: a.stance, h: r2(a.h), ln: r2(a.lean), ad: r2(a.ads), mv: r2(a.moving || 0), cu: a.cur, sp: a.sprint ? 1 : 0, wk: a.walk ? 1 : 0, mf: a.mf,
        hd: PLAYER.interactHeld() ? 1 : 0, rp: a.rappel ? 1 : 0, dr: d ? [d.mf || 0, d.mr || 0, d.jump ? 1 : 0, r4(d.yaw), r4(d.pitch)] : 0 });
      if (d) d.jump = false;
    }
  };
  /* a request to the host, carrying where I am and where I'm looking */
  NP.act = (k, extra) => { const a = G.player; if (!a) return; Online.toHost(Object.assign({ t: 'np.act', k, p: pv(a.pos), yw: r4(a.yaw), pt: r4(a.pitch) }, extra || {})); };
  NP.shot = (o, dirs, w) => Online.toHost({ t: 'np.shot', o: pv(o), d: dirs.map(v => [r4(v.x), r4(v.y), r4(v.z)]), w });

  function matchOver(d) {
    GAME.active = false; GAME.phase = 'end';
    NP.stop(); PLAYER.release();
    MENU.matchOver(d.score, null, { online: true, stats: d.stats, myTeam: d.stats.find(s => s.h === Online.myId()) ? d.stats.find(s => s.h === Online.myId()).tm : GAME.myTeam });
  }
  NP.matchOverLocal = matchOver;
})();
