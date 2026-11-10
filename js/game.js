/* game.js -- the match: rounds, prep/action phases, Bomb / Secure Area / Hostage,
   spawning, objectives, reinforcement, barricades, interactions, noise & intel. */
(function () {
  'use strict';
  const { M, MAT, OPS, GADGETS, WEAPONS } = DATA;
  const V = () => new THREE.Vector3();
  const PREP = 45, ACTION = 180, PLANT = 7, DISABLE = 7, DEFUSE = 45, SECURE = 10, POST = 7;

  const GAME = {
    mode: 'bomb', mapId: 'roadhouse', phase: 'none', timer: 0, round: 0, score: [0, 0], startSide: 'atk',
    obj: {}, reinforced: [], pool: {}, feed: [], siteRooms: [], playerChoice: null, active: false, sandbox: false,
    net: false, client: false, myTeam: 0,
  };
  // Deathmatch / Team Deathmatch (DATA.MODES[mode].arcade / .ffa), worked out from the mode so
  // online guests know too
  Object.defineProperty(GAME, 'arcade', { get: () => !!(DATA.MODES[GAME.mode] || {}).arcade });
  Object.defineProperty(GAME, 'ffa', { get: () => !!(DATA.MODES[GAME.mode] || {}).ffa });
  /* the name shown for someone: a player's name, a bot's player-style name */
  GAME.who = a => !a ? '' : a.hostage ? 'HOSTAGE' : a.name;
  GAME.sideOf = team => {
    if (GAME.client) return (NP.sides && NP.sides[team]) || 'atk';
    const s0 = (G.settings.swapEveryRound ? GAME.round % 2 === 0 : GAME.round < G.settings.roundsToWin - 1 || GAME.round % 2 === 0) ? GAME.startSide : (GAME.startSide === 'atk' ? 'def' : 'atk');
    return team === 0 ? s0 : (s0 === 'atk' ? 'def' : 'atk');
  };
  GAME.playerSide = () => GAME.sideOf(GAME.myTeam);
  GAME.atkTeam = () => GAME.sideOf(0) === 'atk' ? 0 : 1;
  const mine = () => GAME.score[GAME.myTeam], theirs = () => GAME.score[1 - GAME.myTeam];
  GAME.mine = mine; GAME.theirs = theirs;

  /* ------------------------------------------------------------- match flow */
  GAME.startMatch = function (cfg) {
    GAME.mode = cfg.mode; GAME.mapId = cfg.map;
    GAME.startSide = cfg.side === 'random' ? (Math.random() < 0.5 ? 'atk' : 'def') : cfg.side;
    GAME.round = 0; GAME.score = [0, 0]; GAME.sandbox = false; GAME.active = true;
    GAME.stats = new Map(); GAME.seats = null;
    GAME.ranked = !!cfg.ranked;
    // ranked plays by its own rules: first to four, bots as good as your rank
    if (cfg.ranked && !cfg.online) { if (!GAME.prevSettings) GAME.prevSettings = { r: G.settings.roundsToWin, d: G.settings.difficulty, s: G.settings.swapEveryRound }; G.settings.roundsToWin = cfg.rounds || 4; if (cfg.diff != null) G.settings.difficulty = cfg.diff; G.settings.swapEveryRound = true; }
    if (!cfg.online) { GAME.net = false; GAME.client = false; GAME.myTeam = 0; }
    MAIN.loadMap(cfg.map);
    if (GAME.net && NP.host) NP.hookWorld();
    if (window.Net && Auth.user && !GAME.net) Net.setStatus('play', 'Playing ' + DATA.MODES[cfg.mode].name + ' against bots');
    GAME.prepareRound();
  };
  /* choose the objective and open operator select */
  GAME.prepareRound = function () {
    KC.reset();
    GAME.phase = 'select';
    const map = G.map;
    if (GAME.arcade) GAME.siteNames = [];
    else if (GAME.mode === 'bomb') { const pair = U.pick(map.bombs); GAME.siteNames = pair; }
    else if (GAME.mode === 'secure') GAME.siteNames = [U.pick(map.secure)];
    else GAME.siteNames = [U.pick(map.hostage)];
    if (GAME.net) NP.select();
    MENU.opSelect({
      side: GAME.ffa ? 'any' : GAME.playerSide(), round: GAME.round, score: [mine(), theirs()], mode: GAME.mode, sites: GAME.siteNames, map, online: GAME.net,
      onReady: choice => { GAME.playerChoice = choice; if (GAME.net) NP.myPick(choice); else GAME.startRound(); },
    });
  };
  /* defender spawn choices: the objective first, then up to three rooms elsewhere in the building
     (the map's own list when it has one, otherwise the biggest room on each floor) */
  GAME.defSpawnOptions = function (map) {
    const out = [{ name: 'OBJECTIVE', rooms: null }];
    const FL = ['B', '1F', '2F', '3F'];
    let picks = (map.defSpawns || []).map(n => map.roomByName[n] && map.roomByName[n][0]).filter(Boolean);
    if (!picks.length) {
      const skip = /Stairs|Hall|Corridor|Landing|Balcony|Catwalk|Mezzanine|Gallery|Tunnel|Passage|Lanes/;
      const levels = [...new Set(map.rooms.map(r => r.L))].sort();
      for (const L of levels) {
        const rs = map.rooms.filter(r => r.L === L && r.b === 0 && !skip.test(r.name));
        rs.sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0));
        if (rs[0]) picks.push(rs[0]);
      }
    }
    for (const r of picks.slice(0, 3)) out.push({ name: r.name.toUpperCase() + ' · ' + FL[r.L], rooms: [r] });
    return out;
  };
  GAME.startRound = function () {
    const ch = GAME.playerChoice, map = G.map;
    if (GAME.net) { G.mode = 'match'; MENU.hide(); HUD.show(true); }
    MAIN.resetWorld();
    GAME.reinforced = []; GAME.feed = []; GAME.obj = {}; G.actors = []; G.player = null; GAME.lastElim = null;
    GAME.siteRooms = GAME.siteNames.map(n => map.roomByName[n][0]);
    GAME.obj.rooms = GAME.siteRooms;
    // ---- operators: the humans, then bots to fill each team to five (Deathmatch: ten players,
    // each on a team of their own)
    const ffa = GAME.ffa, arcade = GAME.arcade;
    const pick = (side, taken, n) => U.shuffle(OPS.filter(o => (side === 'any' || o.side === side) && !taken.includes(o.id))).slice(0, Math.max(0, n));
    const humans = GAME.net ? NP.humanPicks() : [{ team: 0, op: ch.op, loadout: ch.loadout, spawn: ch.spawn, name: (Auth.user && Auth.name) || 'YOU', local: true, r: Auth.S ? Auth.S.rank.rating : 1000 }];
    // a bot seat keeps its name, rating and looks for the whole match, like a real player would
    const seatOf = key => {
      const S = GAME.seats || (GAME.seats = { _names: NAMES.many(12, humans.map(h => h.name)), _i: 0 });
      if (!S[key]) S[key] = { name: S._names[S._i++ % S._names.length], cos: SHOP.randomLook(), r: GAME.botRating() };
      return S[key];
    };
    const mkBot = (op, team, side, seatKey) => {
      const S = seatOf(seatKey);
      const lo = { primary: U.pick(op.primaries), secondary: U.pick(op.secondaries), gadget: U.pick(op.gadgets), cos: S.cos };
      const a = new Actor({ name: S.name, team, side, op, loadout: lo });
      a.seatKey = seatKey; a.rating = S.r;
      AI.attach(a); if (arcade) a.bot.role = 'roam';
      return a;
    };
    const mkHuman = h => {
      const a = new Actor({ name: h.name, team: h.team, side: ffa ? h.op.side : GAME.sideOf(h.team), op: h.op, loadout: h.loadout, isPlayer: !!h.local });
      if (!h.local) { a.remote = true; a.net = h.peer; }
      a.spawnPick = h.spawn; a.rating = h.r;
      if (h.local) G.player = a;
      return a;
    };
    const fill = GAME.net ? NP.room.bots : true;
    let teams;
    if (ffa) {
      humans.forEach((h, i) => { h.team = i; });
      teams = humans.map(h => [mkHuman(h)]);
      const ops = pick('any', humans.map(h => h.op.id), fill ? 10 - humans.length : 0);
      ops.forEach((op, i) => { const t = teams.length; teams.push([mkBot(op, t, op.side, 'd' + i)]); });
      GAME.myTeam = G.player ? G.player.team : 0;
    } else {
      teams = [[], []];
      for (const h of humans) teams[h.team].push(mkHuman(h));
      for (const t of [0, 1]) {
        const side = GAME.sideOf(t), taken = teams[t].map(a => a.op.id);
        pick(side, taken, fill ? 5 - teams[t].length : 0).forEach((op, i) => teams[t].push(mkBot(op, t, side, 't' + t + ':' + i)));
      }
    }
    G.actors = [].concat(...teams);
    // match stats follow the player, not the operator: humans by who they are, bots by their
    // seat, so changing operators between rounds keeps one row per player
    for (const a of G.actors) {
      a.addTo(G.scene);
      const key = a.isPlayer ? 'me' : a.net ? 'h:' + a.net : 'b:' + a.seatKey;
      const s = GAME.stats.get(key) || { k: 0, d: 0, a: 0, s: 0, hs: 0, name: a.name, team: a.team, human: !!(a.isPlayer || a.net), me: !!a.isPlayer, op: a.op.id };
      s.op = a.op.id; s.name = a.name; s.r = a.rating; a.match = s; GAME.stats.set(key, s);
    }
    if (arcade) ARC.prepare();
    if (ffa) { ARC.spawnAll(G.actors); return arcadeStart(); }
    // ---- spawn
    const atk = GAME.atkTeam(), atkTeam = teams[atk], defTeam = teams[1 - atk];
    const lead = atkTeam.find(a => a.isPlayer || a.net);
    const leadSpawn = lead && lead.spawnPick != null ? lead.spawnPick : U.rndi(0, map.spawns.length - 1);
    atkTeam.forEach((a, i) => {
      const si = (a.isPlayer || a.net) && a.spawnPick != null ? a.spawnPick : (Math.random() < 0.6 ? leadSpawn : U.rndi(0, map.spawns.length - 1));
      const s = map.spawns[si] || map.spawns[0];
      const ang = i * 1.3, r = i ? 1.5 : 0;
      // never start inside a tree, a vehicle or a spawn wall: close in toward the spawn point,
      // and failing that take the nearest walkable spot
      let ok = false;
      for (const k of [1, 0.66, 0.33, 0]) {
        a.pos.set(s.x + Math.cos(ang) * r * k, s.y, s.z + Math.sin(ang) * r * k);
        if (!a.blocked(a.pos.x, a.pos.y, a.pos.z, a.h)) { ok = true; break; }
      }
      if (!ok) { const n = NAV.nearest(a.pos, 8); if (n >= 0) a.pos.copy(NAV.nodePos(n)); }
      const b = map.buildings[0]; a.yaw = U.yawTo(a.pos, V().set((b.x0 + b.x1) / 8, 0, (b.z0 + b.z1) / 8));
    });
    // defenders pick a spawn too: the objective, or one of the map's other defender rooms.
    // Bots mostly start on the objective, and a few start elsewhere and rotate in.
    const dsp = GAME.defSpawnOptions(map);
    const inRooms = dsp.filter(o => o.rooms);
    defTeam.forEach(a => {
      const si = (a.isPlayer || a.net) && a.spawnPick != null ? a.spawnPick : (Math.random() < 0.7 ? 0 : U.rndi(0, dsp.length - 1));
      let o = dsp[si] || dsp[0];
      // Team Deathmatch has no objective room: start in one of the building's other rooms
      if (!o.rooms && !GAME.siteRooms.length) o = U.pick(inRooms) || o;
      const rooms = o.rooms || GAME.siteRooms;
      a.pos.copy(rooms.length ? NAV.randomIn(U.pick(rooms)) : ARC.pickSpawn(a)); a.yaw = Math.random() * 6.28;
    });
    if (arcade) return arcadeStart();
    // ---- objective things
    if (GAME.mode === 'bomb' && atkTeam.length) { const c = U.pick(atkTeam); c.carry = 'defuser'; GAME.obj.carrier = c; }
    if (GAME.mode === 'secure') { const r = GAME.siteRooms[0]; GAME.obj.bio = new GAD.Biohazard(V().set(r.cx, r.fy, r.cz)); GAME.obj.prog = 0; GAME.obj.overtime = 0; }
    if (GAME.mode === 'hostage') {
      const r = GAME.siteRooms[0];
      const h = new Actor({ name: 'HOSTAGE', team: -1, side: 'none', op: MD.HOSTAGE_OP, hostage: true });
      h.pos.copy(NAV.randomIn(r)); h.stance = 1; h.addTo(G.scene);
      G.actors.push(h); GAME.obj.hostage = h;
    }
    // ---- cameras
    const defT = 1 - atk;
    for (const c of map.cams) new GAD.Cam(V().set(c.x, c.y, c.z), c.yaw, c.pitch, defT, c.name, false);
    GAME.pool = {}; GAME.pool[defT] = 10 + defTeam.filter(a => a.op.id === 'brick').length * 2; GAME.pool[atk] = 0;
    GAME.phase = 'prep'; GAME.timer = PREP; GAME.planted = false;
    AI.roundStart();
    PLAYER.roundStart();
    HUD.roundStart();
    SFX.voice('start');
    HUD.banner('ROUND ' + (GAME.round + 1), (GAME.playerSide() === 'atk' ? 'ATTACK' : 'DEFENSE') + ' · PREPARATION PHASE', 2.5);
    if (GAME.net) NP.roundStarted();
  };
  /* Deathmatch / Team Deathmatch: straight into the fight, no objective, no cameras */
  function arcadeStart() {
    const M = DATA.MODES[GAME.mode];
    GAME.pool = {}; GAME.phase = 'action'; GAME.timer = M.time; GAME.planted = false;
    AI.roundStart();
    PLAYER.roundStart();
    HUD.roundStart();
    SFX.voice('start');
    HUD.banner(M.name, GAME.ffa ? 'Everyone for themselves · first to ' + M.limit + ' kills' : 'First team to ' + M.limit + ' kills', 3);
    if (GAME.net) NP.roundStarted();
  }
  /* a believable rating for a bot: near the players it plays with */
  GAME.botRating = function () {
    const base = Auth.S ? Auth.S.rank.rating : 1000, g = (Math.random() + Math.random() + Math.random() - 1.5) * 160;
    return Math.max(300, Math.round(base + g));
  };

  GAME.update = function (dt) {
    if (!GAME.active) return;
    if (GAME.client) { if (GAME.phase === 'prep' || GAME.phase === 'action' || GAME.phase === 'post') GAME.timer = Math.max(0, GAME.timer - dt); return; }
    if (GAME.phase === 'prep' || GAME.phase === 'action') {
      GAME.timer -= dt;
      for (const a of G.actors) GAME.updateInteract(a, dt);
      updateHostage(dt);
      if (GAME.arcade) { ARC.tick(dt); if (GAME.phase === 'action') ARC.check(); return; }
      if (GAME.phase === 'prep' && GAME.timer <= 0) GAME.beginAction();
      else if (GAME.phase === 'action') checkRound(dt);
      // defenders' cameras feed team intel
      GAME.camT = (GAME.camT || 0) - dt;
      if (GAME.camT <= 0) { GAME.camT = 1.5; camIntel(); }
    } else if (GAME.phase === 'post') {
      GAME.timer -= dt;
      if (GAME.timer <= 0) {
        if (GAME.arcade || GAME.score[0] >= G.settings.roundsToWin || GAME.score[1] >= G.settings.roundsToWin) GAME.endMatch();
        else { GAME.round++; GAME.prepareRound(); }
      }
    }
  };
  GAME.beginAction = function () {
    GAME.phase = 'action'; GAME.timer = ACTION;
    AI.lateDefense(); AI.actionStart();
    PLAYER.actionStart();
    if (GAME.net) NP.actionStart();
    HUD.banner('ACTION PHASE', GAME.mode === 'bomb' ? 'Bomb · ' + GAME.siteNames.join(' / ') : MODE_LINE(), 2);
    SFX.voice('start');
  };
  const MODE_LINE = () => (GAME.mode === 'secure' ? 'Secure Area · ' : 'Hostage · ') + GAME.siteNames[0];
  function teamOut(team) { return G.actors.filter(a => a.team === team && !a.hostage).every(a => a.state !== 'alive'); }
  function checkRound(dt) {
    const atk = GAME.atkTeam(), def = 1 - atk, o = GAME.obj;
    const atkOut = teamOut(atk), defOut = teamOut(def);
    if (GAME.mode === 'bomb') {
      if (o.defuser && o.defuser.alive) {
        if (o.defuser.left <= 0) return GAME.endRound(atk, 'Defuser completed');
        if (defOut) return GAME.endRound(atk, 'Defenders eliminated');
        return;
      }
      if (defOut) return GAME.endRound(atk, 'Defenders eliminated');
      if (atkOut) return GAME.endRound(def, 'Attackers eliminated');
      if (GAME.timer <= 0) return GAME.endRound(def, 'Time ran out');
    } else if (GAME.mode === 'secure') {
      if (defOut) return GAME.endRound(atk, 'Defenders eliminated');
      if (atkOut) return GAME.endRound(def, 'Attackers eliminated');
      const r = GAME.siteRooms[0];
      const inRoom = t => G.actors.filter(a => a.team === t && a.alive && G.map.roomAt(a.pos) === r).length;
      const ai = inRoom(atk), di = inRoom(def);
      o.contested = ai > 0 && di > 0;
      if (ai && !di) o.prog += dt; else if (di && !ai) o.prog = Math.max(0, o.prog - dt * 2);
      if (o.prog >= SECURE) return GAME.endRound(atk, 'Area secured');
      if (GAME.timer <= 0) {
        if (ai > 0 && (o.overtime += dt) < 15) return;
        return GAME.endRound(def, 'Time ran out');
      }
    } else {
      const h = o.hostage;
      if (h.state === 'dead') { const k = h.killer; const loser = k ? k.team : atk; return GAME.endRound(1 - loser, 'The hostage was killed'); }
      if (defOut) return GAME.endRound(atk, 'Defenders eliminated');
      if (atkOut) return GAME.endRound(def, 'Attackers eliminated');
      if (h.followTarget) { const ex = GAME.nearestExtract(h.pos); if (U.dist2(ex, h.pos) < 3) return GAME.endRound(atk, 'Hostage extracted'); }
      if (GAME.timer <= 0) return GAME.endRound(def, 'Time ran out');
    }
  }
  GAME.endRound = function (winner, reason) {
    if (GAME.phase !== 'action' && GAME.phase !== 'prep') return;
    if (GAME.arcade) return arcadeEnd(winner, reason);
    GAME.phase = 'post'; GAME.timer = POST;
    GAME.score[winner]++;
    for (const a of G.actors) { a.trigger = false; if (a.team === winner && a.match) a.match.s += 50; }
    const won = winner === GAME.myTeam;
    SFX.voice(won ? 'win' : 'lose'); MUSIC.sting(won);
    const ban = dur => HUD.banner(won ? 'ROUND WON' : 'ROUND LOST', reason + '  ·  ' + mine() + ' – ' + theirs(), dur, won ? 'win' : 'lose');
    PLAYER.leaveDrone(); PLAYER.leaveCams();
    // a round ended by a kill replays that kill, then the result comes back up
    const kc = GAME.roundKillcam(reason, () => ban(Math.max(1, GAME.timer - 0.4)));
    if (kc) GAME.timer = KC_LEAD + kc.dur + KC_TAIL;
    ban(kc ? KC_LEAD : POST - 0.5);
    NP.push({ k: 'rend', w: winner, r: reason, kc: kc ? { k: kc.k ? kc.k.id : 0, v: kc.v.id, h: kc.head ? 1 : 0 } : 0 });
  };
  /* Deathmatch / Team Deathmatch over: the result, the winning kill again, then the results screen */
  function arcadeEnd(winner, reason) {
    GAME.phase = 'post'; GAME.timer = POST; GAME.winner = winner;
    for (const a of G.actors) { a.trigger = false; a.respawnAt = 0; }
    const place = G.player ? ARC.place(G.player) : 0;
    const won = GAME.ffa ? place === 1 : winner === GAME.myTeam;
    const title = GAME.ffa ? ARC.ordinal(place) + ' PLACE' : winner < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    SFX.voice(won ? 'win' : 'lose'); MUSIC.sting(won);
    const ban = dur => HUD.banner(title, reason, dur, won ? 'win' : 'lose');
    PLAYER.leaveDrone(); PLAYER.leaveCams();
    const kc = GAME.roundKillcam(reason, () => ban(Math.max(1, GAME.timer - 0.4)));
    if (kc) GAME.timer = KC_LEAD + kc.dur + KC_TAIL;
    ban(kc ? KC_LEAD : POST - 0.5);
    const pl = {}; for (const a of G.actors) if (a.net) pl[a.net] = ARC.place(a);
    NP.push({ k: 'rend', w: winner, r: reason, arc: 1, pl, kc: kc ? { k: kc.k ? kc.k.id : 0, v: kc.v.id, h: kc.head ? 1 : 0 } : 0 });
  }
  /* the kill that ended the round, queued to replay after the result has shown for a moment */
  const KC_LEAD = 1.4, KC_TAIL = 3;
  GAME.roundKillcam = function (reason, done) {
    const le = GAME.lastElim;
    if (!/eliminated|hostage was killed|kills|Kill limit/.test(reason) || !le || !le.v || G.time - le.t > 2) return null;
    const dur = KC.queue('round', le.k, le.v, KC_LEAD, { head: le.head, done: () => {
      // skipping offline moves straight on; online the host keeps everyone's timing
      if (!GAME.net && GAME.phase === 'post') GAME.timer = Math.min(GAME.timer, KC_TAIL);
      done();
    } });
    return dur ? { dur, k: le.k, v: le.v, head: le.head } : null;
  };
  GAME.endMatch = function () {
    KC.reset();
    GAME.phase = 'end'; GAME.active = false;
    restoreRanked();
    PLAYER.release();
    if (GAME.net) {
      const stats = NP.matchEnd(), mt = GAME.myTeam, score = GAME.score.slice();
      NP.stop();
      MENU.matchOver(score, null, { online: true, stats, myTeam: mt, host: true });
      Online.matchEnded();
    } else MENU.matchOver(GAME.score, GAME.stats);
  };
  function restoreRanked() { const p = GAME.prevSettings; if (!p) return; G.settings.roundsToWin = p.r; G.settings.difficulty = p.d; G.settings.swapEveryRound = p.s; GAME.prevSettings = null; }
  GAME.restoreRanked = restoreRanked;
  GAME.quit = function () {
    // walking out of a ranked match counts as a loss
    if (GAME.ranked && GAME.active && GAME.phase !== 'end' && !GAME.net && Auth.user) RANKED.abandon();
    restoreRanked(); GAME.ranked = false;
    KC.reset(); GAME.active = false; GAME.phase = 'none'; SFX.stopAll(); if (window.NP && NP.active) NP.stop(); };

  /* ------------------------------------------------------------------ hostage */
  function updateHostage(dt) {
    const h = GAME.obj.hostage; if (!h || h.state !== 'alive') return;
    const c = h.followTarget;
    if (!c || c.state !== 'alive') { h.followTarget = null; h.mf = h.mr = 0; return; }
    const d = U.dist2(h.pos, c.pos);
    h.yaw = U.yawTo(h.pos, c.pos);
    if (d > 1.4) {
      h.pathT = (h.pathT || 0) - dt;
      if (h.pathT <= 0 || !h.hpath) { h.pathT = 0.8; h.hpath = NAV.path(h.pos, c.pos, { partial: true }); h.hpi = 0; }
      if (h.hpath && h.hpath.length) {
        let n = h.hpath[Math.min(h.hpi, h.hpath.length - 1)];
        if (U.dist2(h.pos, n) < 0.35 && h.hpi < h.hpath.length - 1) { h.hpi++; n = h.hpath[h.hpi]; }
        const yaw = U.yawTo(h.pos, n); h.yaw = yaw; h.mf = 1; h.mr = 0;
      } else { h.mf = 1; }
      if (d > 12) { h.pos.copy(c.pos).add(V().set(Math.sin(c.yaw) * 1.2, 0, Math.cos(c.yaw) * 1.2)); }
    } else { h.mf = h.mr = 0; }
    h.stance = c.stance === 2 ? 1 : c.stance;
  }
  GAME.nearestExtract = function (p) {
    let best = null, bd = 1e9;
    for (const s of G.map.spawns) { const d = U.dist2(p, s); if (d < bd) { bd = d; best = s; } }
    return V().set(best.x, best.y, best.z);
  };

  /* ------------------------------------------------------- kills & feed */
  GAME.onKill = function (v, k, head) {
    GAME.lastElim = { v, k, head, t: G.time };
    if (v.hostage) { v.killer = k; GAME.addFeed(k, v, head, 'killed the hostage'); return; }
    if (v.match) v.match.d++;
    if (k && k !== v && k.match && k.team !== v.team) { k.match.k++; k.match.s += head ? 120 : 100; if (GAME.arcade && !GAME.ffa && GAME.phase === 'action') GAME.score[k.team]++; }
    if (GAME.arcade && GAME.phase === 'action') v.respawnAt = G.time + ARC.RESPAWN;
    for (const [src] of v.dmgBy) if (src !== k && src.team !== v.team && src.match) { src.match.a++; src.match.s += 50; }
    GAME.addFeed(k, v, head);
    if (v.isPlayer) PLAYER.onDeath(k);
    if (k && v.team !== k.team) GAD.tell(k, (head ? 'HEADSHOT  ' : '') + GAME.who(v) + ' eliminated', 'kill');
    if (k && head && k.match && k.team !== v.team) k.match.hs = (k.match.hs || 0) + 1;
  };
  GAME.onDown = function (v, k) {
    GAME.lastElim = { v, k, head: false, t: G.time };
    if (v.hostage) { GAME.addFeed(k, v, false, 'downed'); return; }
    GAME.addFeed(k, v, false, 'downed');
    GAD.tell(v, 'YOU ARE DOWN · wait for a revive', 'warn');
  };
  GAME.onRevive = function (v, by) { if (by && by.match) by.match.s += 50; GAME.addFeed(by, v, false, 'revived'); };
  GAME.addFeed = function (k, v, head, verb) {
    GAME.feed.unshift({ k: k ? GAME.who(k) : '', kt: k ? k.team : -1, v: GAME.who(v), vt: v.team, head, verb: verb || '', t: G.time });
    if (GAME.feed.length > 6) GAME.feed.pop();
    HUD.feedDirty = true;
  };

  /* --------------------------------------------------------- noise & intel */
  GAME.noise = function (p, r, src, type, fake) {
    if (!r) return;
    for (const a of G.actors) {
      if (!a.bot || a.state !== 'alive') continue;
      if (src && a.team === src.team && !fake) continue;
      if (fake && src && a.team === src.team) continue;
      const d = U.dist3(a.pos, p);
      if (d > r) continue;
      AI.hear(a, p, type, src, fake);
    }
  };
  /* reveal an actor to a team */
  GAME.mark = function (t, team, dur, announce) {
    if (!t.marks) t.marks = {};
    t.marks[team] = Math.max(t.marks[team] || 0, G.time + dur);
    if (announce) for (const a of G.actors) if (a.bot && a.team === team && a.state === 'alive' && !a.bot.target) { a.bot.lastSeen = t.pos.clone(); a.bot.lastSeenT = G.time - 1.3; }
  };
  GAME.marked = (t, team) => t.marks && t.marks[team] > G.time;
  /* a bot callout: teammate bots learn roughly where an enemy is, but nothing is drawn on
     anyone's screen (only deliberate pings and spotting gadgets show markers) */
  GAME.intel = function (t, team, range) {
    for (const a of G.actors) {
      if (!a.bot || a.team !== team || a.state !== 'alive' || a.bot.target) continue;
      if (U.dist3(a.pos, t.pos) > (range || 30)) continue;
      a.bot.lastSeen = t.pos.clone(); a.bot.lastSeenT = G.time - 1.3;
    }
  };
  function camIntel() {
    if (GAME.phase !== 'action') return;
    const atk = GAME.atkTeam(), def = 1 - atk;
    for (const c of GAD.cams(def)) {
      for (const a of G.actors) {
        if (a.team !== atk || a.state !== 'alive' || a.hostage) continue;
        if (U.dist3(c.pos, a.pos) > 22) continue;
        const e = a.eye(V());
        const to = e.clone().sub(c.pos).normalize(), f = V().set(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
        if (to.dot(f) < -0.1) continue;
        if (!G.world.los(c.pos, e) || FX.smokeBlocks(c.pos, e)) continue;
        if (Math.random() < 0.35) GAME.intel(a, def, 40);
      }
    }
  }

  /* ------------------------------------------------------ reinforcement */
  const isSoftWall = m => m && MAT[m].wall && !MAT[m].reinf && m !== M.BRICK || m === M.BRICK || m === M.LOGWALL || m === M.SIDING || m === M.STUCCO || m === M.FACADE || m === M.CORRUGATE;
  GAME.reinforcePanel = function (p, by) {
    const team = by.team;
    if ((GAME.pool[team] || 0) <= 0) return false;
    const W = G.world; let n = 0;
    for (let y = p.y0; y <= p.y1; y++) for (let a = p.a0; a <= p.a1; a++) {
      const x = p.axis === 'z' ? a : p.line, z = p.axis === 'z' ? p.line : a;
      const m = W.get(x, y, z);
      if (isSoftWall(m)) { W.set(x, y, z, M.REINF); n++; }
    }
    if (!n) return false;
    GAME.pool[team]--; GAME.reinforced.push(p); G.emit('reinforce');
    SFX.metal(p.look || V().set((p.axis === 'z' ? (p.a0 + p.a1) / 2 : p.line) * 0.25, p.y0 * 0.25 + 1, (p.axis === 'z' ? p.line : (p.a0 + p.a1) / 2) * 0.25));
    return true;
  };
  GAME.reinforceHatch = function (h, by) {
    if ((GAME.pool[by.team] || 0) <= 0) return false;
    let n = 0;
    for (let z = h.z; z < h.z + 4; z++) for (let x = h.x; x < h.x + 4; x++) if (G.world.get(x, h.y, z) === M.HATCH) { G.world.set(x, h.y, z, M.RHATCH); n++; }
    if (!n) return false;
    G.emit('reinforce');
    GAME.pool[by.team]--; SFX.metal(V().set((h.x + 2) * 0.25, h.y * 0.25, (h.z + 2) * 0.25)); return true;
  };
  /* the wall panel the actor is looking at, if reinforceable */
  GAME.panelAt = function (a) {
    const h = GAD.aim(a, 2.0); if (!h) return null;
    if (h.m === M.HATCH) {
      const hz = G.map.hatches.find(q => h.y === q.y && h.x >= q.x && h.x < q.x + 4 && h.z >= q.z && h.z < q.z + 4);
      return hz ? { hatch: hz } : null;
    }
    if (!isSoftWall(h.m) || Math.abs(h.ny) > 0.5) return null;
    const y0 = Math.round(a.pos.y * 4), axis = Math.abs(h.nx) > 0.5 ? 'x' : 'z';
    const line = axis === 'x' ? h.x : h.z, c = axis === 'x' ? h.z : h.x;
    const p = { axis, line, a0: c - 3, a1: c + 3, y0, y1: y0 + 10 };
    let soft = 0, n = 0;
    for (let y = p.y0; y <= p.y1; y += 2) for (let k = p.a0; k <= p.a1; k++) { n++; if (isSoftWall(axis === 'x' ? G.world.get(line, y, k) : G.world.get(k, y, line))) soft++; }
    if (soft < n * 0.55) return null;
    p.room = G.map.roomAt(a.pos); p.look = V().set(h.px, h.py, h.pz); p.stand = a.pos.clone();
    return p;
  };

  /* ---------------------------------------------------------- interaction */
  GAME.interactions = function (a) {
    const out = [], side = a.side, e = a.eye(V()), o = GAME.obj, phase = GAME.phase;
    if (a.state !== 'alive') return out;
    // revive
    for (const t of G.actors) if (t !== a && t.team === a.team && t.state === 'dbno' && !t.hostage && U.dist3(t.pos, a.pos) < 1.6) { out.push({ kind: 'revive', label: 'REVIVE ' + t.op.name, time: 4.5, target: t, ok: () => t.state === 'dbno' && U.dist3(t.pos, a.pos) < 2, run: () => t.revive(a) }); break; }
    if (GAME.mode === 'bomb' && phase === 'action') {
      if (a.carry === 'defuser') { const r = G.map.roomAt(a.pos); if (r && GAME.siteRooms.includes(r)) out.push({ kind: 'plant', label: 'PLANT DEFUSER', time: PLANT, ok: () => a.carry === 'defuser' && G.map.roomAt(a.pos) === r, run: () => GAME.plant(a, r) }); }
      if (o.defuser && o.defuser.alive && side === 'def' && U.dist3(o.defuser.pos, a.pos) < 1.8) out.push({ kind: 'disable', label: 'DISABLE DEFUSER', time: DISABLE, ok: () => o.defuser && o.defuser.alive && U.dist3(o.defuser.pos, a.pos) < 2.2, run: () => GAME.disable(a) });
      if (o.dropped && o.dropped.alive && side === 'atk' && U.dist3(o.dropped.pos, a.pos) < 1.6) out.push({ kind: 'pickup', label: 'PICK UP DEFUSER', time: 0.3, ok: () => o.dropped && o.dropped.alive, run: () => { o.dropped.destroy('silent'); o.dropped = null; a.carry = 'defuser'; o.carrier = a; SFX.ui(); } });
    }
    if (GAME.mode === 'hostage' && o.hostage && side === 'atk' && phase === 'action') {
      const h = o.hostage;
      if (h.state === 'alive' && !h.followTarget && U.dist3(h.pos, a.pos) < 1.8) out.push({ kind: 'hostage', label: 'ESCORT HOSTAGE', time: 1.2, ok: () => !h.followTarget, run: () => { h.followTarget = a; a.carry = h; if (a.cur === 0 && a.w[1]) WPN.swap(a, 1); SFX.ui(); } });
      if (h.state === 'dbno' && U.dist3(h.pos, a.pos) < 1.8) out.push({ kind: 'revive', label: 'REVIVE HOSTAGE', time: 4, ok: () => h.state === 'dbno', run: () => h.revive(a) });
    }
    // gadget pickups / uses
    for (const g of G.ents) {
      if (!g.alive || U.dist3(g.pos, a.pos) > 2) continue;
      if (g.type === 'medstation' && g.team === a.team && g.uses > 0 && !g.used.has(a)) { out.push({ kind: 'med', label: 'USE MED STATION (+40)', time: 0.5, ok: () => g.alive, run: () => g.use(a) }); break; }
      if (g.type === 'pshield' && g.owner === a) { out.push({ kind: 'shield', label: 'PICK UP SHIELD', time: 0.6, ok: () => g.alive, run: () => GAD.ability(a) }); break; }
      if (a.ability && a.ability.id === 'scanner' && a.ability.on && g.team !== a.team && g.team >= 0 && GAD.TRAPS.has(g.type)) { out.push({ kind: 'disarm', label: 'DISARM ' + g.type.toUpperCase(), time: 1.2, ok: () => g.alive, run: () => { g.destroy('silent'); SFX.zap(g.pos); } }); break; }
    }
    if (side === 'def' && (phase === 'prep' || phase === 'action')) {
      const op = GAD.findOpening(a, 2.2);
      if (op && op.kind !== 'shutter') { const st = GAD.opState(op); if (st.air >= st.total * 0.7 && st.barr === 0) out.push({ kind: 'barricade', label: 'BARRICADE', time: 1.3, ok: () => true, run: () => { GAD.barricade(op); SFX.wood(GAD.opCenter(op)); } }); }
      if ((GAME.pool[a.team] || 0) > 0) {
        const p = GAME.panelAt(a);
        if (p) out.push({ kind: 'reinforce', label: p.hatch ? 'REINFORCE HATCH' : 'REINFORCE WALL', time: a.op.id === 'brick' ? 1.8 : 3.4, ok: () => !!GAME.panelAt(a), run: () => p.hatch ? GAME.reinforceHatch(p.hatch, a) : GAME.reinforcePanel(p, a) });
      }
    }
    return out;
  };
  GAME.beginInteract = function (a, it) { a.interact = { it, t: 0, from: a.pos.clone() }; if (it.time <= 0.31) { a.interact = null; it.run(); } };
  GAME.updateInteract = function (a, dt) {
    const I = a.interact; if (!I) return;
    const holding = a.isPlayer ? PLAYER.interactHeld() : a.remote ? !!a.netHold : !(a.bot && a.bot.target);
    if (!holding || a.state !== 'alive' || U.dist2(a.pos, I.from) > 0.5 || !I.it.ok()) { a.interact = null; return; }
    a.mf = a.mr = 0; a.trigger = false;
    I.t += dt;
    if (I.it.kind === 'reinforce' && Math.random() < dt * 3) SFX.impact(a.pos, false);
    if (I.it.kind === 'barricade' && Math.random() < dt * 4) SFX.wood(a.pos);
    if (I.it.kind === 'plant' && Math.random() < dt * 2) GAME.noise(a.pos, 12, a, 'plant');
    if (I.t >= I.it.time) { a.interact = null; I.it.run(); }
  };
  /* bots: start an interaction of a kind if possible */
  GAME.tryInteract = function (a, kind) {
    if (a.interact) return;
    const it = GAME.interactions(a).find(i => i.kind === kind);
    if (it) GAME.beginInteract(a, it);
  };

  /* --------------------------------------------------------------- bomb */
  GAME.plant = function (a, room) {
    a.carry = null;
    const d = new GAD.Defuser(a, V().set(a.pos.x, a.pos.y + 0.01, a.pos.z), room);
    d.siteRoom = room; d.left = DEFUSE;
    GAME.obj.defuser = d; GAME.planted = true;
    SFX.plant(d.pos);
    if (a.match) a.match.s += 100;
    GAME.timer = Math.max(GAME.timer, 0);
    HUD.banner('DEFUSER PLANTED', room.name, 2, a.team === GAME.myTeam ? 'win' : 'lose');
    NP.push({ k: 'plant', tm: a.team, r: room.name });
    GAME.noise(d.pos, 60, a, 'plant');
    for (const b of G.actors) if (b.bot && b.side === 'def') { b.bot.lastSeen = d.pos.clone(); b.bot.lastSeenT = G.time; }
  };
  GAME.disable = function (a) {
    const d = GAME.obj.defuser; if (!d) return;
    d.destroy('silent'); GAME.obj.defuser = null;
    if (a.match) a.match.s += 100;
    GAME.endRound(a.team, 'Defuser disabled');
  };
  GAME.dropDefuser = function (a) {
    a.carry = null;
    // land it where a teammate can walk up and take it: the floor below the carrier, or the
    // nearest walkable spot if they fell mid-vault, on a rope or wedged in a door frame
    const p = a.pos.clone();
    for (let i = 0; i < 80 && p.y > 0.25 && !a.blocked(p.x, p.y - 0.25, p.z, 0.2); i++) p.y -= 0.25;
    const n = NAV.nearest(p, 6);
    if (n >= 0) { const q = NAV.nodePos(n); if (Math.hypot(q.x - p.x, q.z - p.z) > 0.3 || Math.abs(q.y - p.y) > 0.3) p.copy(q); }
    GAME.obj.dropped = new GAD.Dropped(V().set(p.x, p.y + 0.05, p.z));
    GAME.obj.carrier = null;
    GAD.tellTeam(GAME.atkTeam(), 'The defuser was dropped');
  };

  window.GAME = GAME;
})();
