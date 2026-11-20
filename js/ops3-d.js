/* ops3-d.js -- seasons 15-18, batch D: WIREFRAME, physics as a weapon.
     ARCHIVE    afterimage scanner: a 2 s scan of a 12 m cone shows where defenders WERE 8-15 s ago
     LODESTONE  magnet charge: yanks every small metal gadget within 5 m into a clump on itself
     EARSHOT    parabolic mic: three times the hearing straight ahead; sounds there show as bearings
     GUST       turbine fan: blows smoke and gas away, throws grenades back out, pushes drones back
     CANARY     equipment sniffer: reports every attacker gadget deployed within 10 m of it
     CAROM      ricochet plate: an angled steel plate that turns bullets 90 degrees (both teams')
   Built on js/ops2.js's registry. */
(function () {
  'use strict';
  const { MAT, M } = DATA;
  const V = () => new THREE.Vector3();
  const Ent = GAD.Ent, Proj = GAD.Proj;
  const OPS3 = window.OPS3 = window.OPS3 || {};
  for (const t of ['sniffer', 'fan']) { GAD.ELEC.add(t); GAD.TRAPS.add(t); }
  GAD.TRAPS.add('carom');
  Object.assign(GAD.NAMES, { lodecharge: 'Magnet charge', sniffer: 'Equipment sniffer', fan: 'Turbine fan', carom: 'Ricochet plate', archscan: 'Afterimage scan' });
  Object.assign(GAD.EXTRA, {
    lodecharge: g => { g.box(-3, -3, 0, 3, 3, 2, 0xb02020); g.box(-3, -3, 0, -1, 3, 2, 0xc8ccd0); g.box(1, -3, 0, 3, 3, 2, 0xc8ccd0); g.set(0, 0, -1, MD.glow(0x60a8f0)); },
    sniffer: g => { g.box(-3, -2, 0, 3, 2, 2, 0xd8c040); g.box(-2, -1, -1, 2, 1, -1, 0x333333); g.set(0, 3, 1, MD.glow(0x60f0a0)); g.box(-1, 2, 1, 1, 4, 1, 0x555555); },
    fan: g => { g.box(-7, 0, -3, 7, 2, 3, 0x2a2e34); g.box(-6, 2, -1, 6, 14, 1, 0x3a4048); for (let i = -4; i <= 4; i += 2) g.box(i, 4, -2, i, 12, -2, 0x8a9098); g.box(-1, 7, -3, 1, 9, -3, MD.glow(0x60a8f0)); },
  });
  GAD.MESH_FN.carom = () => OPS3.caromMesh();
  GAD.MESH_FN.archscan = () => new THREE.Group();

  /* ================================================================ ARCHIVE */
  /* everyone's position, every half second, for the last 20 s (the scanner reads it back) */
  OPS3.hist = new Map(); OPS3.histT = 0;
  OPS3.record = function () {
    if (G.time - OPS3.histT < 0.5) return; OPS3.histT = G.time;
    for (const a of G.actors) { if (a.hostage) continue; let h = OPS3.hist.get(a); if (!h) OPS3.hist.set(a, h = []); h.push({ t: G.time, p: a.pos.clone(), alive: a.state !== 'dead' }); while (h.length && G.time - h[0].t > 20) h.shift(); }
  };
  OPS3.ghosts = [];
  OPS3.archive = function (a) {
    const e = a.eye(V()), f = a.fwd(V()); f.y = 0; f.normalize();
    let n = 0; const plan = AI.teams && AI.teams[a.team], intel = plan && (plan.intel || (plan.intel = []));
    for (const [b, h] of OPS3.hist) {
      if (b.team === a.team || b.hostage) continue;
      // the newest sample from 8-15 s ago inside the cone
      for (let i = h.length - 1; i >= 0; i--) {
        const s = h[i], age = G.time - s.t; if (age < 8) continue; if (age > 15) break;
        if (!s.alive) continue;
        const to = s.p.clone().sub(e); to.y = 0; const L = to.length(); if (L > 12 || L < 0.5) continue;
        if (to.divideScalar(L).dot(f) < 0.7) continue;
        OPS3.ghosts.push({ p: s.p.clone().setY(s.p.y + 1.0), age: Math.round(age), t: G.time, team: a.team }); n++;
        if (intel) intel.push({ a: b, pos: s.p.clone(), t: s.t, op: b.op.id });   // (old news, dated as such)
        break;
      }
    }
    if (OPS3.ghosts.length > 40) OPS3.ghosts.splice(0, OPS3.ghosts.length - 40);
    GAD.tell(a, n ? 'Afterimages: ' + n + ' (8-15 s old)' : 'Nobody was there');
    if (window.VOICE && n) VOICE.say(a, 'intel');
    return n;
  };
  OPS2.ABIL.afterimage = (a, ab, need, spend) => {
    if (!need()) return false;
    const from = a.pos.clone(); a.busy = 2; a.busyLabel = 'SCANNING';
    const job = new Ent('archscan', a, a.pos, { model: false, hp: 999, hitR: 0, melee: false }); job.blastproof = true; job.meleeable = false;
    job.update = function (dt) {
      this.t += dt;
      if (a.state !== 'alive' || U.dist2(a.pos, from) > 0.8) { this.destroy('used'); a.busy = 0; GAD.tell(a, 'Scan broken: hold still'); return; }
      if ((this.beep = (this.beep || 0) - dt) <= 0) { this.beep = 0.25; SFX.beep(a.pos, 1300 + this.t * 300, 0.05); }
      if (this.t < 2) return;
      this.destroy('used'); OPS3.archive(a);
    };
    return spend();
  };

  /* ============================================================== LODESTONE */
  /* sticks, then after 1.5 s pulls every small metal gadget of the other side within 5 m onto itself:
     a clump to frag. Electronics in the clump are dead (crushed together); C4 pulled in is disarmed */
  const METAL = new Set(['alarm', 'sensor', 'c4', 'caltrops', 'cam', 'coil', 'gauge', 'wguard', 'bluff', 'scrambler', 'jammer', 'decoy', 'shutter', 'sniffer', 'claymore', 'flankcam', 'breach', 'stake', 'triang', 'spring']);
  OPS3.METAL = METAL;
  class LodeCharge extends Proj {
    constructor(a) {
      super('lodecharge', a, GAD.throwStart(a), GAD.throwVel(a, 13), { sticky: true, hp: 1, intercept: true });
      this.onStick = () => { this.armT = 1.5; SFX.metal(this.pos); };
    }
    update(dt) {
      super.update(dt);
      if (this.armT > 0) { this.armT -= dt; if ((this.hum = (this.hum || 0) - dt) <= 0) { this.hum = 0.3; SFX.zap(this.pos); } if (this.armT <= 0) this.pull(); }
    }
    pull() {
      let n = 0;
      for (const e of G.ents) {
        if (!e.alive || e === this || e.team === this.team || e.team < 0 || !METAL.has(e.type) || e.clumped) continue;
        if (U.dist3(e.pos, this.pos) > 5) continue;
        n++;
        if (e.type === 'c4' || e.type === 'gauge') { e.destroy('used'); FX.sparks(this.pos, 0, 1, 0, 0x9ad8ff); continue; }   // disarmed, or crushed
        e.clumped = true; e.empT = G.time + 9999; e.update = function (dt) { this.t += dt; };
        const off = V().set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
        e.pos.copy(this.pos).add(off); if (e.mesh) e.mesh.position.copy(e.pos); e.hitBox = null; e.solid = null;
      }
      FX.burst(this.pos, 0x60a8f0, 18, 2, 0.05, 0.6, 0); SFX.metal(this.pos); GAME.noise(this.pos, 16, this.owner, 'gadget');
      GAD.tell(this.owner, n ? 'Magnet pulled ' + n + ' gadget' + (n > 1 ? 's' : '') + ': frag the clump' : 'Nothing metal in reach');
      if (window.VOICE && n) VOICE.say(this.owner, 'ability');
      this.pulled = n; this.destroy('used');
    }
  }
  OPS2.ABIL.magnet = (a, ab, need, spend) => { if (!need()) return false; new LodeCharge(a); return spend(); };
  OPS3.LodeCharge = LodeCharge;

  /* =============================================================== EARSHOT */
  /* the mic, while held up (ability on/off): half speed, no shooting, and every sound made by the other
     side in a narrow cone ahead (within three times its normal reach) shows as a bearing: a pip a few
     metres out along the line it came from. Off to the sides she hears little */
  OPS3.pips = [];
  OPS2.ABIL.mic = (a, ab, need, spend) => {
    a.mic = !a.mic; a.busy = 0.25;
    if (a.net && window.NP) NP.push({ k: 'mic', to: a.net, on: a.mic ? 1 : 0 });
    GAD.tell(a, a.mic ? 'Listening: half speed, no shooting' : 'Mic down');
    return true;
  };
  const oNoise = GAME.noise;
  GAME.noise = function (p, r, src, type) {
    const out = oNoise.apply(this, arguments);
    if (r && src && src.team != null) for (const a of G.actors) {
      if (!a.mic || a.state !== 'alive' || a.team === src.team) continue;
      const e = a.eye(V()), to = p.clone().sub(e), L = to.length(); if (L > r * 3 || L < 1) continue;
      const f = a.fwd(V()); to.divideScalar(L); if (to.dot(f) < 0.975) continue;
      OPS3.pips.push({ from: e, dir: to.clone(), t: G.time, team: a.team, kind: type });
      if (OPS3.pips.length > 30) OPS3.pips.splice(0, OPS3.pips.length - 30);
      if (a.bot) { const guess = p.clone().add(V().set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)); GAME.intel({ pos: guess }, a.team, 30); }
    }
    return out;
  };

  /* ================================================================== GUST */
  /* a fan on the floor, blowing the way it faces: 6 m long, 1.6 m wide. Smoke and gas in it clear,
     fires go out, grenades and thrown gadgets coming into it are blown back out, drones are pushed
     back. Its roar covers footsteps near it, both sides'. 75 HP (three or so rounds) */
  class Fan extends Ent {
    constructor(a, p, yaw) {
      super('fan', a, p, { model: 'fan', upright: true, yaw: yaw + Math.PI, hp: 75, hitR: 0.35 });
      this.yaw = yaw; this.dir = V().set(-Math.sin(yaw), 0, -Math.cos(yaw)); this.blastproof = false; this.roar = 0;
      this.loop = SFX.loop ? SFX.loop('drone', p) : null;
    }
    inZone(q) { const d = q.clone().sub(this.pos), along = d.dot(this.dir); if (along < 0 || along > 6 || Math.abs(d.y) > 2.2) return false; return Math.abs(d.x * this.dir.z - d.z * this.dir.x) < 0.8 + along * 0.1; }
    update(dt) {
      this.t += dt; if (this.empT > G.time) return;
      if ((this.roar -= dt) <= 0) { this.roar = 0.5; FX.clearSmoke(this.pos.clone().addScaledVector(this.dir, 3), 2.6); GAME.noise(this.pos, 6, this.owner, 'gadget'); }
      if (Math.random() < dt * 10) { const q = this.pos.clone().addScaledVector(this.dir, 0.6 + Math.random() * 5).add(V().set(0, 0.3 + Math.random(), 0)); FX.burst(q, 0xcfd8e0, 1, 0.3, 0.02, 0.4, 0); }
      for (const e of G.ents) {
        if (!e.alive || e === this) continue;
        if ((e.type === 'irritant' || e.type === 'fire' || e.type === 'slick' || e.type === 'chaffcloud') && this.inZone(e.pos)) { e.destroy('used'); continue; }
        if (e.vel && !e.stuck && e.team !== this.team && e.team >= 0 && this.inZone(e.pos)) {
          if (e.type === 'drone') { e.vel.addScaledVector(this.dir, 30 * dt); continue; }
          // a thrown thing: turned round and sent back the way it came
          if (e.vel.dot(this.dir) < 0) { e.vel.x = Math.abs(e.vel.x) * Math.sign(this.dir.x || 1) * 0.8 + this.dir.x * 4; e.vel.z = Math.abs(e.vel.z) * Math.sign(this.dir.z || 1) * 0.8 + this.dir.z * 4; e.vel.y = Math.max(e.vel.y, 2); SFX.whoosh(e.pos); }
        }
      }
    }
    destroy(w) { if (this.loop) { this.loop.stop(); this.loop = null; } super.destroy(w); }
  }
  OPS3.fanMasks = p => G.ents.some(e => e.alive && e.type === 'fan' && !(e.empT > G.time) && U.dist3(e.pos, p) < 6);
  // footsteps near a running fan are lost in its roar (to everyone's bots)
  const oNoise2 = GAME.noise;
  GAME.noise = function (p, r, src, type) { if (type === 'step' && OPS3.fanMasks(p)) return; return oNoise2.apply(this, arguments); };
  OPS2.ABIL.fan = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 1.0); if (!p) { GAD.tell(a, 'Clear floor in front of you'); return false; }
    new Fan(a, p, a.yaw); return spend();
  };
  OPS3.placeFan = (a, p, yaw) => new Fan(a, p, yaw);

  /* ================================================================ CANARY */
  /* a sniffer on a wall: any attacker gadget that turns up within 10 m (stuck, planted, thrown in, or a
     drone driven past) is reported where it is, for 4 s. 1 HP; an EMP silences it */
  OPS3.sniffs = [];
  class Sniffer extends Ent {
    constructor(a, p, n) { super('sniffer', a, p, { model: 'sniffer', normal: n, hp: 1, hitR: 0.1 }); this.seen = new Set(); this.scan = 0; this.told = 0; this.blastproof = false; }
    update(dt) {
      this.t += dt; if (this.empT > G.time || (this.scan -= dt) > 0) return; this.scan = 0.3;
      for (const e of G.ents) {
        if (!e.alive || e.team === this.team || e.team < 0 || !e.owner || this.seen.has(e)) continue;
        if (['archscan', 'magtimer', 'cutting', 'hingecut', 'scafjob'].includes(e.type)) continue;
        if (U.dist3(e.pos, this.pos) > 10) continue;
        this.seen.add(e);
        OPS3.sniffs.push({ p: e.pos.clone(), t: G.time, team: this.team, what: GAD.NAMES[e.type] || e.type });
        if (OPS3.sniffs.length > 30) OPS3.sniffs.splice(0, OPS3.sniffs.length - 30);
        GAME.intel({ pos: e.pos.clone() }, this.team, 25);
        if (G.time > this.told) { this.told = G.time + 3; GAD.tellTeam(this.team, 'CANARY: ' + (GAD.NAMES[e.type] || e.type).toUpperCase() + ' nearby'); SFX.beep(this.pos, 1700, 0.1); if (window.VOICE && this.owner && this.owner.state === 'alive') VOICE.say(this.owner, 'intel'); }
      }
    }
  }
  OPS2.ABIL.sniffer = (a, ab, need, spend) => {
    if (!need()) return false;
    const h = GAD.aim(a, 2.2); if (!h || h.md.see) { GAD.tell(a, 'Stick it to a wall or a ceiling'); return false; }
    new Sniffer(a, h.p, h.n); return spend();
  };
  OPS3.placeSniffer = (a, p, n) => new Sniffer(a, p, n);

  /* ================================================================= CAROM */
  /* a steel plate standing at 45 degrees: a round that hits it carries on turned through 90 degrees,
     with 70% of its punch (once: a round turned once isn't turned again). Bulletproof; explosives
     knock it flat. Placed so that fire toward it turns right (or left, leaning left) */
  OPS3.caromMesh = function () {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.05), new THREE.MeshBasicMaterial({ color: 0x9aa4ae })); plate.position.set(0, 1.05, 0); g.add(plate);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.055), new THREE.MeshBasicMaterial({ color: 0xe8f0f8 })); shine.position.set(0, 1.75, 0); g.add(shine);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a2e34 })); foot.position.set(0, 0.06, 0); g.add(foot);
    return g;
  };
  class Carom extends Ent {
    constructor(a, p, yaw, side) {
      const f = V().set(-Math.sin(yaw), 0, -Math.cos(yaw)), r = V().set(-f.z, 0, f.x).multiplyScalar(side || 1);
      const n = r.clone().sub(f).normalize();                      // fire along f turns toward r
      super('carom', a, p, { model: 'carom', normal: n, hp: 999, bulletproof: true, hitR: 0 });
      this.n = n; this.blastproof = false; this.meleeable = false;
      if (this.mesh) { this.mesh.position.copy(p); this.mesh.rotation.set(0, Math.atan2(n.x, n.z), 0); }
      // the plate across its face, as a box for bullets
      const t = V().set(-n.z, 0, n.x), xs = [p.x + t.x * 0.5, p.x - t.x * 0.5], zs = [p.z + t.z * 0.5, p.z - t.z * 0.5];
      this.hitBox = { x0: Math.min(...xs) - 0.05, x1: Math.max(...xs) + 0.05, y0: p.y + 0.15, y1: p.y + 1.95, z0: Math.min(...zs) - 0.05, z1: Math.max(...zs) + 0.05 };
    }
    shot(dmg, src, p, d, dir, left, bounced) {
      if (!dir || !d || bounced || !p) return;
      const k = dir.dot(this.n); if (k > -0.05) return;           // (from behind, or edge on: just steel)
      // where the round meets the plate itself (its box is only a box round a slanted plate)
      const back = p.clone().addScaledVector(dir, -2), tt = this.pos.clone().sub(back).dot(this.n) / dir.dot(this.n);
      if (tt > 0 && tt < 6) p = back.addScaledVector(dir, tt); else p = p.clone();
      if (Math.abs(p.clone().sub(this.pos).dot(V().set(-this.n.z, 0, this.n.x))) > 0.55) return;   // (past its edge: missed it)
      const r = dir.clone().addScaledVector(this.n, -2 * k).normalize();
      FX.sparks(p, this.n.x, this.n.y, this.n.z, 0xffe0a0); SFX.impact(p, false);
      // (the plate itself is out of the turned round's way: it starts inside its box)
      const hb = this.hitBox; this.hitBox = null;
      try { WPN.trace(src, p.clone().addScaledVector(r, 0.08), r, d, Math.max(5, (left || 30)), 0.7, true); } finally { this.hitBox = hb; }
    }
  }
  OPS2.ABIL.carom = (a, ab, need, spend) => {
    if (!need()) return false;
    const p = GAD.floorAhead(a, 1.4); if (!p) { GAD.tell(a, 'Clear floor in front of you'); return false; }
    new Carom(a, p, a.yaw, a.lean < -0.2 ? -1 : 1); return spend();
  };
  OPS3.Carom = Carom;

  /* ======================================================== to the guests */
  /* the season 15-18 HUD readings (gauge alerts, glints, the dog's bearings, afterimages, mic bearings,
     sniffer alerts) are made on the host: each one is sent on as it is made, and a guest adds it to its
     own list, timed from when it arrives */
  const ser = it => { const o = {}; for (const k in it) { const v = it[k]; o[k] = v && v.isVector3 ? { v: [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100] } : v; } return o; };
  const deser = o => { const it = {}; for (const k in o) { const v = o[k]; it[k] = v && v.v ? V().set(v.v[0], v.v[1], v.v[2]) : v; } it.t = G.time; return it; };
  for (const name of ['alerts', 'glints', 'bearings', 'ghosts', 'pips', 'sniffs']) {
    const arr = OPS3[name]; if (!arr) continue;
    arr.push = function () { const r = Array.prototype.push.apply(this, arguments); if (window.NP && NP.active && NP.host) for (const it of arguments) NP.push({ k: 'o3', l: name, it: ser(it) }); return r; };
  }
  OPS2.chain('guestEvent', function (e) {
    if (e.k !== 'o3' || !OPS3[e.l] || !e.it) return;
    Array.prototype.push.call(OPS3[e.l], deser(e.it)); if (OPS3[e.l].length > 40) OPS3[e.l].splice(0, OPS3[e.l].length - 40);
    return true;
  });

  /* ============================================================ per frame */
  OPS2.chain('entTick', function (e, dt) { if (e === G.ents[0]) OPS3.record(); });
  OPS2.chain('tick', function (a, dt) { if (a.mic) { a.trigger = false; a.adsWant = false; } });
  OPS2.chain('hudFrame', function (a, dt) { if (window.SFX) SFX.cone = !!(a && a.mic && a.state === 'alive' && PLAYER.view === 'body'); });

  /* ============================================================== guests */
  OPS2.chain('guestEvent', function (e) {
    const me = G.player; if (!me || e.to !== NP.me) return;
    if (e.k === 'mic') { me.mic = !!e.on; return true; }
  });
  OPS2.chain('entRec', function (e, x) { if (e.type === 'carom' && e.n) x.cn = [Math.round(e.n.x * 100) / 100, Math.round(e.n.z * 100) / 100]; });
  OPS2.chain('mirrorSet', function (m, x) { if (m.type === 'carom' && x.cn && m.mesh && !m.cr) { m.cr = true; m.mesh.rotation.set(0, Math.atan2(x.cn[0], x.cn[1]), 0); } });

  /* ================================================================= HUD */
  OPS2.chain('status', function (a) {
    if (a.mic) return 'LISTENING · half speed · no shooting · ' + KEYS.fmt('{ability} to lower the mic');
    return '';
  });
  OPS2.chain('hudCount', function (a) { if (a.ability && a.ability.id === 'mic') return a.mic ? 'ON' : 'OFF'; return null; });
  OPS2.chain('markers', function (a, put, jam) {
    if (G.mode !== 'match' || jam) return;
    for (const g of OPS3.ghosts) if (g.team === a.team && G.time - g.t < 6) put(g.p.clone(), 'mk-ring a2', '◌ ' + g.age + 's');
    for (const s of OPS3.pips) if (s.team === a.team && G.time - s.t < 1.5) put(s.from.clone().addScaledVector(s.dir, 5), 'mk-ring a0', '◈');
    for (const s of OPS3.sniffs) if (s.team === a.team && G.time - s.t < 4) put(s.p.clone(), 'mk-ring a1', '⚑');
  });

  /* ================================================================ bots */
  OPS2.chain('aiUse', function (a, b, c) {
    if (GAME.phase !== 'action' || !a.ability || a.busy > 0) return false;
    const ab = a.ability, t = b.target && b.target.isActor && b.target.state === 'alive' ? b.target : null;
    // Archive: a scan toward the objective before going in
    if (ab.id === 'afterimage' && ab.count > 0 && !t && c.obj && U.dist3(a.pos, c.obj) < 18 && G.time > (b.archT || 0)) {
      b.archT = G.time + 15; AI.faceTo(a, c.obj.clone().setY(a.pos.y + a.eyeH), 1, 99);
      if (GAD.ability(a)) { if (b.task) b.tasks.unshift(b.task); b.task = { look: c.obj.clone().setY(a.pos.y + a.eyeH), time: 2.2 }; b.taskT = 0; }   // (and holds still for the scan)
      return true;
    }
    // Lodestone: the charge onto a defender gadget it has seen (or into the site)
    if (ab.id === 'magnet' && ab.count > 0 && !t && G.time > (b.lodeT || 0)) {
      const g = G.ents.find(e => e.alive && e.team !== a.team && e.team >= 0 && METAL.has(e.type) && !e.clumped && U.dist3(e.pos, a.pos) < 14 && G.world.los(a.eye(V()), e.pos));
      if (g) { b.lodeT = G.time + 12; AI.lobAt(a, g.pos); GAD.ability(a); return true; }
    }
    // Earshot: the mic up toward the objective when nothing is in sight
    if (ab.id === 'mic') {
      if (!a.mic && !t && c.obj && U.dist3(a.pos, c.obj) < 25 && G.time > (b.micT || 0)) { b.micT = G.time + 14; AI.faceTo(a, c.obj.clone().setY(a.pos.y + a.eyeH), 1, 99); GAD.ability(a); b.micEnd = G.time + 4; return true; }
      if (a.mic && (t || G.time > (b.micEnd || 0))) { GAD.ability(a); return true; }
    }
    return false;
  });
  OPS2.chain('aiPlanDef', function (a, plan, c) {
    const { b, ents } = c, id = a.ability ? a.ability.id : null, W = G.world;
    const inwardOf = op => { const cc = GAD.opCenter(op), rr = plan.rooms.find(x => x.L === op.L) || plan.rooms[0]; const inw = V().set(rr.cx - cc.x, 0, rr.cz - cc.z); if (op.axis === 'z') inw.x = 0; else inw.z = 0; return { cc, rr, inw: inw.normalize() }; };
    if (id === 'fan') {
      // fans just inside two ways in, blowing out through them
      for (const op of ents.slice(0, 2)) {
        const { cc, rr, inw } = inwardOf(op), p = cc.clone().addScaledVector(inw, 1.2); p.y = rr.fy + 0.01;
        if (!NAV.walkable(p)) continue;
        const yaw = Math.atan2(inw.x, inw.z);   // facing out (toward the doorway)
        b.tasks.unshift({ at: cc.clone().addScaledVector(inw, 2.2).setY(rr.fy), look: cc, time: 0.5, run: x => { if (x.ability.count <= 0) return; OPS3.placeFan(x, p, yaw); x.ability.count--; } });
      }
    }
    if (id === 'sniffer') {
      // sniffers on the walls beside the ways in
      for (const op of ents.slice(0, 3)) {
        const { cc, rr, inw } = inwardOf(op), side = V().set(-inw.z, 0, inw.x), half = ((op.a1 - op.a0 + 1) * 0.25) / 2;
        const p = cc.clone().addScaledVector(side, half + 0.5).addScaledVector(inw, 0.13); p.y = rr.fy + 2.0;
        b.tasks.unshift({ at: cc.clone().addScaledVector(inw, 1.1).setY(rr.fy), look: p, time: 0.5, run: x => { if (x.ability.count <= 0) return; OPS3.placeSniffer(x, p, inw); x.ability.count--; } });
      }
    }
    if (id === 'carom') {
      // plates a few metres inside the ways in: bulletproof cover that sends the attack's fire sideways
      for (const op of ents.slice(0, 2)) {
        const { cc, rr, inw } = inwardOf(op), p = cc.clone().addScaledVector(inw, 3.0); p.y = rr.fy + 0.01;
        if (!NAV.walkable(p)) continue;
        const yaw = Math.atan2(inw.x, inw.z);   // facing the doorway
        b.tasks.unshift({ at: cc.clone().addScaledVector(inw, 4.4).setY(rr.fy), look: cc, time: 0.5, run: x => { if (x.ability.count <= 0) return; new Carom(x, p, yaw, Math.random() < 0.5 ? 1 : -1); x.ability.count--; } });
      }
    }
  });

  /* ============================================================= voices */
  if (window.VOICE) {
    VOICE.add('archive', {
      pick: ['Tamm. I know where you were. That is usually enough.', 'Every room keeps a record.'],
      round: ['Let me look at the history first.', 'Patience. The past is very informative.', 'Logging in.'],
      ability: ['Scanning.', 'Pulling the archive.', 'Reading back.'],
      intel: ['Afterimages. They were there ten seconds ago.', 'History says: that room.', 'Old tracks, but tracks.'],
      kill: ['Now you are history.', 'Archived.', 'Logged.'],
      spot: ['Contact. Live, not archived.', 'There.'],
      reload: ['Reloading.', 'One moment.'], hurt: ['I am hit.', 'Hit.'], down: ['I am down. Please.', 'Down.'],
      lost: ['We lost one.', 'One down.'], win: ['As the data predicted.', 'Good.'], lose: ['The data was stale.', 'Hm.'],
    });
    VOICE.add('lodestone', {
      pick: ['Gagnon. Anything metal is mine.', 'Your gadgets are coming with me.'],
      round: ['Let me clean up their toys.', 'Point me at their gadgets.', 'Allons-y.'],
      ability: ['Magnet out!', 'Come to mama.', 'Charge stuck. Wait for it...'],
      kill: ['Attraction.', 'Polarised.', 'Down.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag!'], hurt: ['Ouch! Hit.', 'Hit!'], down: ['I\'m down!', 'Down, help!'],
      lost: ['We lost one.', 'Man down.'], win: ['Clean sweep.', 'Magnifique.'], lose: ['Not enough metal.', 'Bof.'],
    });
    VOICE.add('earshot', {
      pick: ['Quispe. Be quiet and I will still hear you.', 'Shh. Listen.'],
      round: ['Quiet, please. I am listening.', 'Let me hear the building first.', 'Silence, everyone.'],
      ability: ['Mic up.', 'Listening.', 'Shh.'],
      intel: ['Footsteps, that bearing.', 'I hear one, straight ahead.', 'Sound, there.'],
      kill: ['I heard you coming.', 'Too loud.', 'Down.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Hit!', 'Ay, I\'m hit.'], down: ['I\'m down!', 'Down.'],
      lost: ['We lost one.', 'One down.'], win: ['Beautiful silence.', 'Good.'], lose: ['Too much noise.', 'Hm.'],
    });
    VOICE.add('gust', {
      pick: ['Visser. Your smoke is going home.', 'Feel that breeze? That is me.'],
      round: ['Fans are spinning. Bring your smoke.', 'Nice weather for it.', 'Ready.'],
      ability: ['Fan down. Mind your hair.', 'Blowing.', 'Wind\'s on.'],
      kill: ['Blown away.', 'Gone with the wind.', 'Down.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Hit!', 'Au! Hit.'], down: ['I\'m down!', 'Down!'],
      lost: ['We lost one.', 'Man down.'], win: ['Clear skies.', 'Lekker.'], lose: ['They had the wind.', 'Jammer.'],
    });
    VOICE.add('canary', {
      pick: ['Haddad. I smell their gadgets before you see them.', 'My canaries sing.'],
      round: ['Sniffers are listening.', 'Let them bring their toys.', 'Ready.'],
      ability: ['Sniffer set.', 'Little bird is up.', 'Watching for kit.'],
      intel: ['Canary sings: gadget at the door.', 'Their kit, right there.', 'Something of theirs just arrived.'],
      kill: ['Down.', 'Done.', 'Got him.'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Hit!', 'I\'m hit.'], down: ['I\'m down!', 'Down!'],
      lost: ['We lost one.', 'Man down.'], win: ['Well done.', 'Good.'], lose: ['They were clever.', 'Next time.'],
    });
    VOICE.add('carom', {
      pick: ['Bellini. Every shot has an angle.', 'Banked, like the ninth ball.'],
      round: ['Plates are set. Let them shoot.', 'Geometry, everyone.', 'Andiamo.'],
      ability: ['Plate down. Ninety degrees.', 'Bank shot set.', 'There. Perfect angle.'],
      kill: ['Off the cushion.', 'Corner pocket.', 'Bank shot!'],
      spot: ['Contact!', 'There!'],
      reload: ['Reloading.', 'Mag.'], hurt: ['Hit!', 'Mamma mia, hit!'], down: ['I\'m down!', 'Down!'],
      lost: ['We lost one.', 'Man down.'], win: ['Clean table.', 'Perfetto.'], lose: ['Scratched.', 'Bad break.'],
    });
  }
})();
