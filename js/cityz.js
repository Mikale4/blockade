/* cityz.js -- City Z: the persistent world. One save (localStorage 'blockade.cityz') holds the clock,
   the squad (each operator's health, needs, pack and guns), every location's state (what has been
   searched, how many infected are left, every wall broken and board nailed up), the safehouses and
   their stashes, the survivors, the vehicles and the story. Entering a location builds it
   (cityz-zones.js), puts back what you changed there, and fills it with what is left of its
   infected, its loot and its people. Leaving it writes all that back.

   It runs as a match (G.mode 'match') with GAME.mode 'cityz': the game's movement, guns, gadgets,
   bots, interactions and HUD all work, and this file takes over the round logic.

     CZ.newGame(squadOps, diff)  CZ.continue()  CZ.enter(zone, side)  CZ.travel(to)  CZ.save()
     CZ.update(dt) (every frame)  CZ.orders(kind)  CZ.takeControl(actor) */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const VS = 0.25;
  CZ.TEAM = 0; CZ.INF = 2;
  CZ.on = () => GAME.mode === 'cityz' && GAME.active;
  /* watching: all five are AI and play on their own; you spectate (the City Z menu, or an online
     room's spectator seat on the host) */
  CZ.watching = false;
  CZ.isWatching = () => CZ.watching && CZ.on();
  /* who the squad follows: the player's member, or (watching) the first one alive */
  CZ.leader = () => { const p = G.player; if (p && p.cz && p.cz.m && !p.ghost && p.state !== 'dead') return p; return G.actors.find(a => a.cz && a.cz.m && a.state === 'alive') || null; };
  /* whose needs and pack the HUD shows: yours, or (spectating) the member you watch */
  CZ.viewed = () => { const p = G.player; if (p && p.ghost) { const s = PLAYER.spec; return s && s.cz && s.cz.m ? s : CZ.leader(); } return p; };
  /* a small event bus the other City Z files listen on: 'kill' (victim, killer, head), 'enter' (zone),
     'leave' (zone), 'loot' (actor, container), 'restore' (zone), 'day' (day) */
  const EV = {};
  CZ.listen = (name, fn) => (EV[name] || (EV[name] = [])).push(fn);
  CZ.fire = (name, ...args) => { for (const fn of EV[name] || []) { try { fn(...args); } catch (e) { console.error('cityz ' + name, e); } } };
  CZ.KEY = 'cityz';

  /* ================================================================ the save */
  const needs0 = () => ({ hunger: 10, thirst: 10, fatigue: 5, stamina: 100, infection: 0, bleed: 0, fracture: false, temp: 37, sick: 0, pain: 0 });
  function member(opId, player) {
    const op = DATA.OPMAP[opId];
    const inv = {};
    const p = op.primaries[0], s = op.secondaries[0];
    // four magazines' worth for each gun, a little food and water, a dressing
    for (const id of [p, s]) { const c = CZ.calOf(id), w = DATA.WEAPONS[id]; inv[c] = (inv[c] || 0) + (w.mag || 10) * 4; }
    Object.assign(inv, { water: 1, bar: 1, bandage: 1 });
    return { op: opId, name: op.name, hp: 100, alive: true, player: !!player, st: needs0(), inv, guns: [{ id: p, mag: -1 }, { id: s, mag: -1 }], gad: -1, ab: -1 };
  }
  CZ.newGame = function (ops, diff) {
    const S = CZ.S = {
      v: 1, diff: diff || 'survivor', day: 1, min: 7 * 60 + 30, weather: 'clear', wT: 0, zone: CZ.START, side: 'S',
      squad: ops.map((id, i) => member(id, i === 0)),
      zones: {}, known: [CZ.START], visited: [], stash: {}, safe: {}, survivors: [], vehicles: [], events: [],
      story: { ch: 0, step: 0, flags: {}, choices: {}, log: [], done: false, ending: null },
      stats: { kills: 0, looted: 0, travelled: 0, crafted: 0, rescued: 0, deaths: 0, started: Date.now() },
      order: 'follow', seed: Math.floor(Math.random() * 1e9),
    };
    for (const z of Object.keys(CZ.ZONES[CZ.START].links)) if (!S.known.includes(z)) S.known.push(z);
    // the first vehicle: a hatchback with a quarter tank, outside the firehouse
    S.vehicles.push({ id: 'v1', kind: 'hatch', zone: CZ.START, x: 47, z: 52, yaw: 0, fuel: 10, hp: 300 });
    if (CZ.storyStart) CZ.storyStart(S);
    CZ.save(true);
    return S;
  };
  CZ.hasSave = () => !!U.store.get(CZ.KEY, null);
  CZ.load = function () { const S = U.store.get(CZ.KEY, null); if (S && S.v === 1) { CZ.S = S; return S; } return null; };
  CZ.wipe = () => { try { localStorage.removeItem(U.store.k(CZ.KEY)); } catch (e) { } CZ.S = null; };
  CZ.save = function (quiet) {
    const S = CZ.S; if (!S) return;
    if (CZ.on() && CZ.Z) { CZ.snapSquad(); CZ.snapZone(); }
    try { localStorage.setItem(U.store.k(CZ.KEY), JSON.stringify(S)); }
    catch (e) { // the voxel records are what grows: trim the biggest and try again
      const big = Object.values(S.zones).sort((a, b) => (b.vox || '').length - (a.vox || '').length)[0];
      if (big) { big.vox = (big.vox || '').slice(0, Math.floor((big.vox || '').length / 2)); try { localStorage.setItem(U.store.k(CZ.KEY), JSON.stringify(S)); } catch (e2) { } }
    }
    if (!quiet && CZ.on()) HUD.toast('Saved', 'info');
  };
  CZ.zoneState = z => CZ.S.zones[z] || (CZ.S.zones[z] = { looted: [], pop: -1, day: CZ.S.day, vox: '', seen: false, cleared: false, bodies: 0 });
  CZ.diff = () => CZ.DIFF[CZ.S.diff] || CZ.DIFF.survivor;

  /* ---- what you changed in a place: every voxel that differs from how it was built, as a compact
     string (delta-coded indices in base 36, then the material) */
  function voxDiff(w) {
    const v = w.v, o = w.orig, parts = []; let last = 0, n = 0;
    for (let i = 0; i < v.length; i++) if (v[i] !== o[i]) { parts.push((i - last).toString(36) + '.' + v[i].toString(36)); last = i; if (++n >= 16000) break; }
    return parts.join(',');
  }
  CZ.voxApply = (w, s) => voxApply(w, s);
  function voxApply(w, s) {
    if (!s) return 0;
    let i = 0, n = 0;
    for (const p of s.split(',')) { const k = p.indexOf('.'); if (k < 0) continue; i += parseInt(p.slice(0, k), 36); const m = parseInt(p.slice(k + 1), 36); if (i >= 0 && i < w.v.length) { w.v[i] = m; n++; } }
    return n;
  }

  /* ================================================================ the clock */
  /* one real second is one minute of the day (a day is 24 minutes); travel and sleep move it on */
  CZ.clock = () => { const m = CZ.S.min, h = Math.floor(m / 60), mm = Math.floor(m % 60); return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; };
  CZ.night = () => { const h = CZ.S.min / 60; return h < 5.5 || h > 20.5; };
  CZ.dark = () => { const h = CZ.S.min / 60; if (h >= 7 && h <= 19) return 0; if (h > 19 && h < 21.5) return (h - 19) / 2.5; if (h > 4.5 && h < 7) return 1 - (h - 4.5) / 2.5; return 1; };
  CZ.advance = function (minutes, why) {
    const S = CZ.S; S.min += minutes;
    while (S.min >= 1440) { S.min -= 1440; S.day++; newDay(); }
    // the needs of everyone, as if that time had passed (cityz-survival.js)
    if (CZ.passTime) CZ.passTime(minutes, why);
  };
  function newDay() {
    const S = CZ.S;
    // places fill up again a little; safehouses produce; the weather turns
    for (const [z, st] of Object.entries(S.zones)) { const cap = Math.round(CZ.POP[CZ.ZONES[z].danger] * CZ.diff().inf); if (st.pop >= 0 && st.pop < cap) st.pop = Math.min(cap, st.pop + Math.ceil(cap * (CZ.isSafe(z) && (S.safe[z].up || []).includes('walls') ? 0.05 : 0.25))); }
    if (CZ.dailySafe) CZ.dailySafe();
    CZ.fire('day', S.day);
  }
  const WEATHERS = ['clear', 'clear', 'overcast', 'overcast', 'rain', 'fog'];
  function weatherTick(dt) {
    const S = CZ.S; S.wT = (S.wT || 0) - dt;
    if (S.wT <= 0) { S.wT = 300 + Math.random() * 400; const w = WEATHERS[Math.floor(Math.random() * WEATHERS.length)]; if (w !== S.weather) { S.weather = w; HUD.toast(w === 'rain' ? 'It has started to rain' : w === 'fog' ? 'Fog is rolling in' : w === 'overcast' ? 'The sky has clouded over' : 'The sky is clearing', 'info'); } }
  }
  /* night and weather on screen: the fog closes in, a dark wash over the picture */
  let lightKey = '';
  function lighting() {
    const f = G.scene.fog; if (!f) return;
    const d = CZ.dark(), w = CZ.S.weather, base = CZ.Z.fog0;
    const far = Math.max(14, base.far * (1 - d * 0.72) * (w === 'fog' ? 0.4 : w === 'rain' ? 0.7 : 1)), near = Math.min(base.near, far * 0.3);
    const key = Math.round(far) + w + Math.round(d * 20);
    if (key !== lightKey) {
      lightKey = key;
      const c = new THREE.Color(base.color).lerp(new THREE.Color(0x05070e), d * 0.92);
      if (w === 'fog') c.lerp(new THREE.Color(0xa8aca8), 0.4 * (1 - d));
      if (w === 'rain') c.lerp(new THREE.Color(0x4a5058), 0.35 * (1 - d));
      f.color.copy(c); f.far = far; f.near = near; G.renderer.setClearColor(c);
    }
    const night = U.$('czNight'); if (night) night.style.opacity = String(Math.min(0.62, d * 0.62 + (w === 'rain' ? 0.08 : 0)));
  }

  /* ================================================================ places */
  /* which road end (N S E W) leads to which neighbour: the one pointing most nearly that way */
  CZ.exitsOf = function (zid) {
    const Z = CZ.ZONES[zid], out = {}, used = new Set();
    const ls = Object.keys(Z.links).map(t => { const T = CZ.ZONES[t], dx = T.x - Z.x, dy = T.y - Z.y; return { t, dx, dy, a: Math.atan2(dy, dx) }; });
    const dirs = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
    const pairs = [];
    for (const l of ls) for (const [s, d] of Object.entries(dirs)) pairs.push({ l, s, score: (l.dx * d[0] + l.dy * d[1]) / Math.hypot(l.dx, l.dy) });
    pairs.sort((p, q) => q.score - p.score);
    for (const p of pairs) { if (used.has(p.s) || out[p.l.t]) continue; out[p.l.t] = p.s; used.add(p.s); }
    return out;   // neighbour -> side
  };
  CZ.sideTo = (from, to) => CZ.exitsOf(from)[to];
  CZ.isSafe = z => !!(CZ.S.safe[z] && (CZ.S.safe[z].up || []).includes('restore'));

  /* go into a place, arriving by the road end `side` */
  CZ.enter = function (zid, side) {
    const S = CZ.S;
    MENU.loading('Entering ' + CZ.ZONES[zid].name + '…', () => {
      S.zone = zid; S.side = side || S.side || 'S';
      if (!S.known.includes(zid)) S.known.push(zid);
      for (const n of Object.keys(CZ.ZONES[zid].links)) if (!S.known.includes(n)) S.known.push(n);
      if (!S.visited.includes(zid)) S.visited.push(zid);
      start(zid);
    });
  };
  function start(zid) {
    const S = CZ.S, st = CZ.zoneState(zid), Zd = CZ.ZONES[zid];
    // the world: built, then what you changed put back
    MAIN.loadMap('cz_' + zid);
    if (st.vox) { voxApply(G.world, st.vox); G.world.computeSky(); G.world.remeshAll(); }
    NAV.build();
    G.mode = 'match'; GAME.mode = 'cityz'; GAME.active = true; GAME.phase = 'action'; GAME.timer = 1e9; GAME.round = 0; GAME.score = [0, 0];
    if (!(window.NP && NP.active)) { GAME.net = false; GAME.client = false; }
    GAME.myTeam = 0; GAME.spectator = false; GAME.ranked = false; GAME.sandbox = false;
    GAME.stats = new Map(); GAME.feed = []; GAME.obj = { rooms: [] }; GAME.siteNames = []; GAME.siteRooms = []; GAME.reinforced = []; GAME.pool = { 0: 0, 1: 0 }; GAME.startSide = 'atk'; GAME.blackout = null;
    KC.reset();
    const f = G.scene.fog; CZ.Z = { id: zid, def: Zd, st, fog0: { color: f.color.getHex(), near: f.near, far: f.far }, exits: G.map.exits, t: 0, saveT: 60 };
    lightKey = '';
    // the squad (online: guests take over members of it)
    spawnSquad(S.side);
    if (CZ.netAssign) CZ.netAssign();
    // the place's things: loot, the infected, people, vehicles, safehouse fixtures, the story
    if (CZ.spawnLoot) CZ.spawnLoot(zid);
    if (CZ.populate) CZ.populate(zid, st);
    if (CZ.spawnPeople) CZ.spawnPeople(zid);
    if (CZ.spawnVehicles) CZ.spawnVehicles(zid);
    if (CZ.spawnSafe) CZ.spawnSafe(zid);
    CZ.fire('enter', zid);
    st.seen = true;
    // the bots' plans: the squad follows its orders, the infected operators hunt
    AI.teams = {};
    const squadBots = G.actors.filter(a => a.team === CZ.TEAM && a.bot);
    AI.teams[CZ.TEAM] = { side: 'atk', team: CZ.TEAM, bots: squadBots, goalFor: CZ.squadGoal, cleared: new Map(), intel: [] };
    AI.teams[CZ.INF] = { side: 'def', team: CZ.INF, bots: G.actors.filter(a => a.team === CZ.INF && a.bot), goalFor: CZ.infGoal || ARC.goal, cleared: new Map(), intel: [] };
    PLAYER.roundStart(); HUD.roundStart(); HUD.show(true); MENU.hide();
    document.body.classList.add('cz');
    if (CZ.ui) CZ.ui.enter();
    HUD.banner(Zd.name, Zd.area + ' · DAY ' + S.day + ' · ' + CZ.clock(), 3);
    MUSIC.play && MUSIC.play('range');
    CZ.save(true);
    if (CZ.netStarted) CZ.netStarted(zid);
  }

  /* ================================================================ the squad */
  function spawnSquad(side) {
    const S = CZ.S, ex = G.map.exits.find(e => e.side === side) || G.map.exits[0];
    // just inside the road end, facing in
    const inward = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[ex.side];
    G.actors = []; G.player = null;
    let k = 0;
    for (const m of S.squad) {
      if (!m.alive) continue;
      const lat = (k - 2) * 1.2, fw = 2.5 + (k % 2) * 1.2;
      const p = V().set(ex.x + inward[0] * fw + (inward[0] ? 0 : lat), ex.y, ex.z + inward[1] * fw + (inward[1] ? 0 : lat));
      CZ.spawnMember(m, p, Math.atan2(-inward[0], -inward[1]));
      k++;
    }
    if (CZ.watching) { G.player = PLAYER.ghost(); return; }
    if (!G.player) { const a = G.actors.find(x => x.team === CZ.TEAM); if (a) CZ.takeControl(a, true); }
  }
  /* one member of the squad into the place: an operator, or someone recruited on the way (a civilian
     with their own name and look) */
  CZ.spawnMember = function (m, p, yaw) {
    let op = DATA.OPMAP[m.op];
    if (m.recruit) op = Object.assign({}, op, { name: m.name, look: Object.assign({}, op.look, m.look || {}) });
    const lo = { primary: m.guns[0] ? m.guns[0].id : op.primaries[0], secondary: m.guns[1] ? m.guns[1].id : op.secondaries[0], gadget: (op.gadgets || [])[0] || null, cos: {} };
    const a = new Actor({ name: m.name, team: CZ.TEAM, side: 'atk', op, loadout: lo, isPlayer: m.player && !CZ.watching });
    a.drones = 0; a.cz = { m };
    a.hp = Math.max(1, Math.min(a.maxHp, m.hp));
    // magazines as they were; reserves come from the pack (cityz-survival.js keeps them in step)
    a.w.forEach((w, i) => { const g = m.guns[i]; if (g && g.mag >= 0) w.mag = Math.min(g.mag, w.def.mag || g.mag); w.reserve = 0; });
    if (a.gadget && m.gad >= 0) a.gadget.count = m.gad;
    if (a.ability && m.ab >= 0) a.ability.count = m.ab;
    const n = NAV.nearest(p, 8); a.pos.copy(n >= 0 ? NAV.nodePos(n) : p);
    a.yaw = yaw || 0;
    if (!m.player || CZ.watching) { a.isPlayer = false; a.isBot = true; a.persona = PERSONA.make([]); AI.attach(a); a.bot.role = 'squad'; }
    else G.player = a;
    a.addTo(G.scene); G.actors.push(a);
    a.match = { k: 0, d: 0, a: 0, s: 0, hs: 0, name: a.name, team: 0, human: !!m.player, me: !!m.player, op: op.id };
    return a;
  };
  /* the squad as it is now, into the save */
  function snapSquad() {
    for (const a of G.actors) {
      if (!a.cz || !a.cz.m) continue;
      const m = a.cz.m;
      m.alive = a.state !== 'dead'; m.hp = a.state === 'alive' ? Math.round(a.hp) : a.state === 'dbno' ? 20 : 0;
      m.guns = a.w.map(w => ({ id: w.id, mag: w.mag }));
      if (a.gadget) m.gad = a.gadget.count; if (a.ability) m.ab = a.ability.count;
      m.player = a === G.player;
    }
  }
  function snapZone() {
    const st = CZ.zoneState(CZ.Z.id);
    st.vox = voxDiff(G.world);
    if (CZ.countInfected) st.pop = CZ.countInfected();
    st.day = CZ.S.day;
    for (const v of G.ents) if (v.alive && v.type === 'czcar' && v.rec && !v.rec.moved) Object.assign(v.rec, { zone: CZ.Z.id, x: v.pos.x, z: v.pos.z, yaw: v.yaw, fuel: v.fuel, hp: v.hp });
  }
  CZ.snapSquad = snapSquad; CZ.snapZone = snapZone;

  /* the player takes over another member of the squad (when you die, or by choice) */
  CZ.takeControl = function (a, quiet) {
    const old = G.player;
    if (old && old !== a && old.state !== 'dead') { old.isPlayer = false; old.isBot = true; old.persona = old.persona || PERSONA.make([]); AI.attach(old); old.bot.role = 'squad'; if (AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots.push(old); }
    if (old && old.cz) old.cz.m.player = false;
    if (old && old !== a && old.state === 'dead') old.isPlayer = false;
    a.isPlayer = true; a.isBot = false; a.bot = null; G.player = a; a.cz.m.player = true;
    if (AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots = AI.teams[CZ.TEAM].bots.filter(x => x !== a);
    PLAYER.view = 'body'; PLAYER.vmKey = ''; PLAYER.deadT = 0; PLAYER.eyeY = null; PLAYER.enabled = true; PLAYER.spec = null;
    if (!quiet) HUD.banner(a.op.name, 'You are now playing ' + a.name, 2);
  };

  /* ---- orders: what the AI members of the squad do */
  CZ.ORDERS = {
    follow: { name: 'FOLLOW ME', key: 1 }, hold: { name: 'HOLD HERE', key: 2 }, attack: { name: 'ATTACK MY TARGET', key: 3 },
    loot: { name: 'SCAVENGE NEARBY', key: 4 }, quiet: { name: 'STAY QUIET', key: 5 },
  };
  CZ.orders = function (kind) {
    const S = CZ.S, p = G.player; if (!p || p.ghost) return;
    S.order = kind;
    CZ.holdAt = kind === 'hold' ? p.pos.clone() : null;
    CZ.holdLook = kind === 'hold' ? p.eye(V()).addScaledVector(p.fwd(V()), 12) : null;
    if (kind === 'attack') {
      // what the player is looking at: the nearest infected near the line of sight
      const e = p.eye(V()), f = p.fwd(V()); let best = null, bd = 0.97;
      for (const t of G.actors) { if (t.team === CZ.TEAM || t.state !== 'alive') continue; const d = t.center(V()).sub(e), L = d.length(); if (L > 60) continue; const c = d.dot(f) / L; if (c > bd && G.world.los(e, t.center(V()))) { bd = c; best = t; } }
      CZ.focus = best; if (!best) { HUD.toast('No target', 'warn'); S.order = 'follow'; return; }
      for (const a of G.actors) if (a.bot && a.team === CZ.TEAM) { a.bot.target = best; a.bot.seenT = G.time; a.bot.lastSeen = best.pos.clone(); a.bot.lastSeenT = G.time; }
    }
    for (const a of G.actors) if (a.bot && a.team === CZ.TEAM) { a.bot.goal = null; a.bot.loot = null; }
    HUD.toast('Squad: ' + CZ.ORDERS[kind].name, 'info');
    if (window.VOICE) { const m = G.actors.find(a => a.bot && a.team === CZ.TEAM && a.state === 'alive'); if (m) VOICE.say(m, 'ack', ['Copy that.', 'On it.', 'Understood.', 'Moving.'], 2); }
  };
  /* a doorway (one of the map's door openings) someone is standing in, if any: the spot a step clear of
     it on whichever side they'd rather be (toward), so nobody stops, rests or shelters in a door and
     blocks the rest of the squad behind them */
  CZ.doorAt = function (pos) {
    for (const o of G.map.openings || []) {
      if (o.kind !== 'door' || Math.abs(o.y0 / 4 - pos.y) > 0.6) continue;
      const along = o.axis === 'x' ? pos.x * 4 : pos.z * 4, across = o.axis === 'x' ? pos.z * 4 : pos.x * 4;
      if (along < o.a0 - 2 || along > o.a1 + 3 || Math.abs(across - (o.line + 0.5)) > 4) continue;   // in it, or a step from it
      return o;
    }
    return null;
  };
  CZ.offDoor = function (a, toward) {
    const o = CZ.doorAt(a.pos); if (!o) return null;
    const mid = o.axis === 'x' ? V().set((o.a0 + o.a1 + 1) / 8, a.pos.y, (o.line + 0.5) / 4) : V().set((o.line + 0.5) / 4, a.pos.y, (o.a0 + o.a1 + 1) / 8);
    const nrm = o.axis === 'x' ? V().set(0, 0, 1) : V().set(1, 0, 0);
    const t = toward || a.pos, k = ((t.x - mid.x) * nrm.x + (t.z - mid.z) * nrm.z) >= 0 ? 1 : -1;
    const n = NAV.nearest(mid.clone().addScaledVector(nrm, 1.6 * k).add(V().set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), 3);
    return n >= 0 ? NAV.nodePos(n) : null;
  };
  /* a squad bot's goal: by the current order */
  CZ.squadGoal = function (a) {
    const S = CZ.S, p = CZ.leader(); if (!p || !S) return null;
    if (a === p) return CZ.autoGoal ? CZ.autoGoal(a) : null;   // watching: the leader plays on its own
    const mates = G.actors.filter(x => x.bot && x.team === CZ.TEAM && x.state === 'alive');
    const i = Math.max(0, mates.indexOf(a));
    const look = p.eye(V()).addScaledVector(p.fwd(V()), 10);
    const order = CZ.orderOf ? CZ.orderOf(a) : S.order;   // (cityz-people.js: not everyone jumps when told)
    if (order === 'hold' && CZ.holdAt) {
      const ang = i * 1.6, spot = CZ.holdAt.clone().add(V().set(Math.cos(ang) * 1.4, 0, Math.sin(ang) * 1.4));
      const n = NAV.nearest(spot, 4);
      return { pos: n >= 0 ? NAV.nodePos(n) : CZ.holdAt, kind: 'hold', r: 1, look: CZ.holdLook || look, crouch: true };
    }
    if (order === 'attack' && CZ.focus && CZ.focus.state === 'alive') return { pos: CZ.focus.pos.clone(), kind: 'push', r: 5, look: CZ.focus.eye(V()), sprint: true };
    if (order === 'loot' && CZ.botLoot) { const g = CZ.botLoot(a); if (g) return g; }
    // follow: a loose file behind the player, sprinting to catch up
    const d = U.dist3(a.pos, p.pos), back = p.fwd(V()).setY(0).normalize().multiplyScalar(-1);
    const side = V().set(-back.z, 0, back.x), off = back.multiplyScalar(1.8 + Math.floor(i / 2) * 1.6).addScaledVector(side, (i % 2 ? 1 : -1) * 1.3);
    const want = p.pos.clone().add(off);
    if (d < 3.5 && Math.abs(a.pos.y - p.pos.y) < 1.5) { const off = CZ.offDoor(a, p.pos); return off ? { pos: off, kind: 'follow', r: 0.5, look } : { pos: a.pos.clone(), kind: 'follow', r: 9, look }; }
    const n = NAV.nearest(want, 4);
    return { pos: n >= 0 ? NAV.nodePos(n) : p.pos.clone(), kind: 'follow', r: 1.6, look, sprint: d > 12 };
  };

  /* ================================================================ travel */
  /* a road end: walk up to it to leave for the place it leads to */
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || !CZ.Z || GAME.client) return;
    const ex = CZ.exitsOf(CZ.Z.id);
    for (const [to, side] of Object.entries(ex)) {
      const e = CZ.Z.exits.find(x => x.side === side); if (!e) continue;
      if (Math.hypot(a.pos.x - e.x, a.pos.z - e.z) > 3.2) continue;
      const mins = CZ.ZONES[CZ.Z.id].links[to];
      out.push({ kind: 'travel', label: 'TRAVEL TO ' + CZ.ZONES[to].name + ' · ' + mins + ' MIN ON FOOT', time: 0.8, ok: () => true, run: () => CZ.travelMenu ? CZ.travelMenu(to) : CZ.travel(to) });
      return;
    }
  });
  /* leave for a neighbouring place: the squad goes with you (the ones near enough), time passes */
  CZ.travel = function (to, byCar) {
    const S = CZ.S, from = CZ.Z.id, mins = Math.round(CZ.ZONES[from].links[to] * (byCar ? 0.34 : 1));
    // who comes: everyone alive and within 40 m (the rest are left where they are... and lost)
    const p = CZ.leader() || G.player;
    CZ.snapSquad(); CZ.snapZone();
    CZ.advance(mins, byCar ? 'drive' : 'walk');
    S.stats.travelled += mins;
    // something on the road? (cityz-events.js)
    const side = CZ.sideTo(to, from) || 'S';
    CZ.fire('leave', from);
    if (CZ.roadEvent && CZ.roadEvent(from, to, byCar)) return;
    CZ.enter(to, side);
  };

  /* ================================================================ the frame */
  CZ.update = function (dt) {
    const S = CZ.S, Z = CZ.Z; if (!S || !Z) return;
    Z.t += dt;
    // an online guest: the host keeps the city; here, the light, the HUD and our own guns
    if (Z.guest) { lighting(); if (CZ.ui) CZ.ui.frame(dt); if (CZ.guestTick) CZ.guestTick(dt); return; }
    if (CZ.netTick) CZ.netTick(dt);
    // the clock: a real second is a minute
    S.min += dt; if (S.min >= 1440) { S.min -= 1440; S.day++; newDay(); }
    weatherTick(dt); lighting();
    if (CZ.survivalTick) CZ.survivalTick(dt);
    if (CZ.infectedTick) CZ.infectedTick(dt);
    if (CZ.eventsTick) CZ.eventsTick(dt);
    if (CZ.storyTick) CZ.storyTick(dt);
    if (CZ.peopleTick) CZ.peopleTick(dt);
    if (CZ.ui) CZ.ui.frame(dt);
    // the player down or dead: carry on as someone else in the squad
    const p = G.player;
    if (CZ.watching) { if (!Z.switching && !Z.wipedOut && !G.actors.some(a => a.cz && a.cz.m && a.state !== 'dead')) { Z.switching = true; setTimeout(() => { Z.switching = false; if (CZ.on() && CZ.wiped && !Z.wipedOut) { Z.wipedOut = true; CZ.wiped(); } }, 3500); } }
    else if (p && p.state === 'dead' && !Z.switching) {
      Z.switching = true;
      setTimeout(() => {
        Z.switching = false;
        if (!CZ.on()) return;
        const next = G.actors.find(a => a.cz && a.cz.m && a.state === 'alive' && a !== p);
        if (next) { CZ.takeControl(next); }
        else if (CZ.wiped) CZ.wiped();
      }, 3500);
    }
    // a save every minute of real time
    if ((Z.saveT -= dt) <= 0) { Z.saveT = 60; CZ.save(true); }
  };

  /* ================================================================ hooks */
  const oUpd = GAME.update;
  GAME.update = function (dt) {
    if (GAME.mode !== 'cityz') return oUpd.apply(this, arguments);
    if (!GAME.active) return;
    if (!GAME.client) for (const a of G.actors) GAME.updateInteract(a, dt);
    CZ.update(dt);
  };
  const oQuit = GAME.quit;
  GAME.quit = function () {
    if (GAME.mode === 'cityz' && CZ.S && GAME.active) { CZ.save(true); CZ.stop(); }
    return oQuit.apply(this, arguments);
  };
  CZ.stop = function () {
    document.body.classList.remove('cz');
    if (CZ.ui) CZ.ui.leave();
    CZ.Z = null; GAME.mode = 'bomb';
  };
  // no kill cam, no "attackers can't be hurt in preparation" in City Z
  const oQueue = KC.queue;
  KC.queue = function () { if (GAME.mode === 'cityz') return; return oQueue.apply(this, arguments); };
  // the kill feed only for the squad (not every infected)
  const oFeed = GAME.addFeed;
  GAME.addFeed = function (k, v) { if (GAME.mode === 'cityz' && v && v.team !== CZ.TEAM && !(v.cz && v.cz.person)) return; return oFeed.apply(this, arguments); };
  // a member of the squad dead: their pack lies where they fell
  const oKill = GAME.onKill;
  GAME.onKill = function (v, k, head) {
    const r = oKill.apply(this, arguments);
    if (GAME.mode !== 'cityz') return r;
    if (v.cz && v.cz.m) { v.cz.m.alive = false; CZ.S.stats.deaths++; if (CZ.dropPack) CZ.dropPack(v); HUD.banner(v.name + ' IS GONE', v.op.name + ' died in ' + CZ.Z.def.name, 3, 'lose'); }
    if (v.cz && v.cz.inf && k && k.team === CZ.TEAM) CZ.S.stats.kills++;
    CZ.fire('kill', v, k, head);
    return r;
  };
})();
