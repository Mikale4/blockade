/* arcade.js -- Deathmatch and Team Deathmatch: one long round with respawns, no objective
   and no down-but-not-out. First to the kill limit wins, or the most kills when time runs out.

   Spawns: every respawn looks at a few dozen walkable spots around the building and takes the
   one farthest from the enemy that no enemy can see (in Team Deathmatch, close to teammates
   too), so nobody is dropped into someone's sights. A respawn comes 4 s after a death, with
   two seconds of protection that end the moment you fire.

     ARC.prepare()       ARC.spawnAll(list)   ARC.tick(dt)   ARC.check()
     ARC.standings()     ARC.place(a)         ARC.goal(a)    (a bot's job: hunt and roam)  */
(function () {
  'use strict';
  const V = () => new THREE.Vector3();
  const ARC = { RESPAWN: 4, spots: [], recent: [] };
  const mode = () => DATA.MODES[GAME.mode] || {};

  /* where people can appear: walkable ground around and inside the main building */
  ARC.prepare = function () {
    const b = G.map.buildings[0], pad = 22;
    const x0 = b.x0 / 4 - pad, x1 = b.x1 / 4 + pad, z0 = b.z0 / 4 - pad, z1 = b.z1 / 4 + pad;
    const all = [...(NAV.main || [])], out = [];
    for (let i = 0; i < all.length; i += 3) {
      const p = NAV.nodePos(all[i]);
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      out.push(p);
    }
    ARC.spots = out; ARC.recent = [];
  };
  function score(p, a) {
    let minE = 99, seen = false, mate = 99;
    const eye = V().set(p.x, p.y + 1.6, p.z);
    for (const t of G.actors) {
      if (t === a || t.hostage || t.state === 'dead') continue;
      const d = U.dist3(t.pos, p);
      if (t.team === a.team) { mate = Math.min(mate, d); continue; }
      minE = Math.min(minE, d);
      if (!seen && d < 55 && G.world.los(eye, t.eye(V()))) seen = true;
    }
    let s = Math.min(minE, 32) - (seen ? 40 : 0) - (minE < 8 ? 40 : 0);
    if (!GAME.ffa && mate < 99) s += mate < 16 ? 6 : -Math.min(10, (mate - 16) * 0.3);
    for (const r of ARC.recent) if (G.time - r.t < 6 && U.dist3(r.p, p) < 4) s -= 15;   // not the same spot twice in a row
    return s + Math.random() * 3;
  }
  ARC.pickSpawn = function (a) {
    if (!ARC.spots.length) ARC.prepare();
    let best = null, bs = -1e9;
    for (let i = 0; i < 45; i++) {
      const p = ARC.spots[Math.floor(Math.random() * ARC.spots.length)];
      if (!p || a.blocked(p.x, p.y, p.z, 1.75)) continue;
      const s = score(p, a); if (s > bs) { bs = s; best = p; }
    }
    best = (best || ARC.spots[0]).clone();
    ARC.recent.push({ p: best, t: G.time }); if (ARC.recent.length > 12) ARC.recent.shift();
    return best;
  };
  const faceIn = p => { const b = G.map.buildings[0]; return U.yawTo(p, V().set((b.x0 + b.x1) / 8, 0, (b.z0 + b.z1) / 8)); };

  /* the start of the match: Deathmatch spreads everyone out; Team Deathmatch uses the usual
     attacker and defender spawns (see GAME.startRound) */
  ARC.spawnAll = function (list) {
    for (const a of list) a.pos.set(-999, -999, -999);
    for (const a of list) { const p = ARC.pickSpawn(a); a.pos.copy(p); a.yaw = faceIn(p); }
  };
  ARC.respawn = function (a) {
    const p = ARC.pickSpawn(a), yaw = faceIn(p);
    a.respawn(p, yaw); a.respawnAt = 0;
    if (a.bot) { AI.attach(a); a.bot.role = 'roam'; }
    if (a.isPlayer) PLAYER.respawned();
    if (a.net && window.NP) NP.push({ k: 'spawn', to: a.net, p: [p.x, p.y, p.z].map(v => Math.round(v * 100) / 100), y: Math.round(yaw * 100) / 100 });
  };
  ARC.tick = function () {
    for (const a of G.actors) if (a.state === 'dead' && !a.hostage && a.respawnAt && G.time >= a.respawnAt) ARC.respawn(a);
  };

  /* who's winning */
  ARC.standings = () => G.actors.filter(a => !a.hostage && a.match).sort((p, q) => q.match.k - p.match.k || p.match.d - q.match.d);
  ARC.place = a => ARC.standings().indexOf(a) + 1;
  ARC.check = function () {
    const M = mode();
    if (GAME.ffa) {
      const top = ARC.standings()[0]; if (!top) return;
      if (top.match.k >= M.limit) return GAME.endRound(top.team, top.name + ' reached ' + M.limit + ' kills');
      if (GAME.timer <= 0) return GAME.endRound(top.team, 'Time ran out');
    } else {
      for (const t of [0, 1]) if (GAME.score[t] >= M.limit) return GAME.endRound(t, 'Kill limit reached');
      if (GAME.timer <= 0) return GAME.endRound(GAME.score[0] === GAME.score[1] ? -1 : GAME.score[0] > GAME.score[1] ? 0 : 1, 'Time ran out');
    }
  };
  ARC.ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH');

  /* a bot's job with nobody in sight: go where an enemy was last seen or heard, otherwise
     roam the map, drifting toward where the fighting is */
  ARC.goal = function (a) {
    const b = a.bot;
    if (b.lastSeen && G.time - b.lastSeenT < 10 && U.dist3(a.pos, b.lastSeen) > 2) return { pos: b.lastSeen, r: 1.2, kind: 'hunt', sprint: U.dist3(a.pos, b.lastSeen) > 12 };
    if (!b.roamGoal || G.time > (b.roamT || 0) || U.dist2(a.pos, b.roamGoal) < 1.5) {
      // toward a random enemy's rough area (gunfire carries), or anywhere on the map
      const foes = G.actors.filter(t => t.team !== a.team && t.state === 'alive' && !t.hostage);
      let p = null;
      if (foes.length && Math.random() < 0.6) {
        const f = U.pick(foes), j = V().set(f.pos.x + (Math.random() - 0.5) * 16, f.pos.y, f.pos.z + (Math.random() - 0.5) * 16);
        const n = NAV.nearest(j, 6); if (n >= 0) p = NAV.nodePos(n);
      }
      if (!p && ARC.spots.length) p = U.pick(ARC.spots).clone();
      b.roamGoal = p; b.roamT = G.time + 12 + Math.random() * 10; b.roamRun = Math.random() < 0.7;
    }
    return b.roamGoal ? { pos: b.roamGoal, r: 1.5, kind: 'roam', sprint: b.roamRun && U.dist3(a.pos, b.roamGoal) > 14 } : null;
  };

  window.ARC = ARC;
})();
