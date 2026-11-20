/* cityz-net.js -- City Z online: up to five players in the host's city. An online room set to
   CITY Z (CO-OP) runs the host's own City Z save; each guest takes over one of the squad's four AI
   members (their operator, health, needs and pack), moves and fights as in any online match
   (np.js), and searches, eats, treats, throws, crafts and swaps guns from their own pack. The host
   leads: travel, safehouses, the story and its conversations are theirs, and the whole room follows
   them from place to place. Guests see their own needs and pack; the host's game keeps them.

   Messages (on top of np.js):
     np.czzone  host -> all    the place (and what has been changed in it) before each np.round
     czs        host -> guest  (in the event stream) your needs, pack, guns; the clock and objective
     czsave     host -> all    the city as the map and journal need it (no voxel records), every 8 s
     czgun      host -> guest  your guns changed (a swap)
     np.cz      guest -> host  use / heal / throw / equip / drop / give / craft / ammo spent */
(function () {
  'use strict';
  const CZ = window.CZ;
  const net = () => window.NP && NP.active;
  const host = () => net() && NP.host;
  const guest = () => net() && !NP.host && GAME.mode === 'cityz';
  CZ.isGuest = guest; CZ.isHost = host;

  /* ================================================================ the room */
  // starting an online room set to City Z starts the host's city, not a match
  const oStartMatch = GAME.startMatch;
  GAME.startMatch = function (cfg) {
    if (cfg && cfg.mode === 'cityz') return CZ.hostStart(cfg);
    return oStartMatch.apply(this, arguments);
  };
  CZ.hostStart = function () {
    GAME.mode = 'cityz'; CZ.watching = !!GAME.spectator;   // the host in a spectator seat watches the squad play
    if (!CZ.load()) {
      const ops = DATA.OPS.slice().sort(() => Math.random() - 0.5).slice(0, 5).map(o => o.id);
      CZ.newGame(ops, (NP.room && NP.room.czdiff) || 'survivor');
    }
    CZ.enter(CZ.S.zone, CZ.S.side);
  };
  /* each guest takes one of the squad's AI members (the host keeps playing their own) */
  CZ.netAssign = function () {
    if (!host()) return;
    const guests = NP.players().filter(m => m.id !== NP.me);
    const free = G.actors.filter(a => a.cz && a.cz.m && a !== G.player && a.state !== 'dead');
    guests.forEach((g, i) => {
      const a = free[i]; if (!a) return;
      a.bot = null; a.isBot = false; a.remote = true; a.net = g.id; a.cz.m.who = g.name; a.name = g.name;
    });
  };
  CZ.netStarted = function (zid) {
    if (!host()) return;
    NP.hookWorld();
    Online.toAll({ t: 'np.czzone', zone: zid, vox: CZ.zoneState(zid).vox || '', S: publicSave() }, true);
    NP.roundStarted();
    known = new Set(G.actors.map(a => a.id));
    // each guest's magazines as the save has them (the roster alone would hand them full ones)
    for (const a of G.actors) if (a.net && a.cz && a.cz.m) NP.push({ k: 'czgun', to: a.net, lo: { primary: a.loadout.primary, secondary: a.loadout.secondary, gadget: a.loadout.gadget }, mags: a.w.map(w => w.mag) });
  };
  /* actors that turn up after the round's roster (the infected coming in, people) and the ones the
     host clears away: told to the guests as they happen */
  let known = new Set();
  const r2 = v => Math.round(v * 100) / 100;
  const recOf = a => ({ id: a.id, n: a.name, tm: a.team, sd: a.side, op: a.op.id, lo: { primary: a.loadout.primary, secondary: a.loadout.secondary, gadget: a.loadout.gadget }, h: a.isPlayer ? NP.me : a.net || null, p: [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)], y: r2(a.yaw), st: a.stance });
  function rosterDiff() {
    const now = new Set();
    for (const a of G.actors) { now.add(a.id); if (!known.has(a.id)) { NP.byId.set(a.id, a); NP.push({ k: 'czadd', r: recOf(a) }); } }
    for (const id of known) if (!now.has(id)) { NP.byId.delete(id); NP.push({ k: 'czdel', id }); }
    known = now;
  }
  function publicSave() {
    const S = JSON.parse(JSON.stringify(CZ.S));
    for (const z of Object.values(S.zones)) { delete z.vox; delete z.left; delete z.drops; }
    return S;
  }
  // a guest who leaves: their member goes back to being an AI teammate
  const oLeft = NP.memberLeft;
  if (oLeft) NP.memberLeft = function (peer, name) {
    const a = NP.actorOf && NP.actorOf(peer);
    const r = oLeft.apply(this, arguments);
    if (GAME.mode === 'cityz' && a && a.bot) { a.bot.role = 'squad'; a.name = a.cz && a.cz.m ? a.cz.m.name : a.name; if (AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots.push(a); }
    return r;
  };

  /* ================================================================ host: keeping guests informed */
  let sT = 0, saveT = 0;
  CZ.netTick = function (dt) {
    if (!host()) return;
    if ((sT -= dt) <= 0) {
      sT = 0.4;
      const S = CZ.S, obj = CZ.objective ? CZ.objective() : null;
      for (const a of G.actors) {
        if (!a.net || !a.cz || !a.cz.m) continue;
        const m = a.cz.m;
        NP.push({ k: 'czs', to: a.net, st: m.st, inv: m.inv, guns: a.w.map(w => w.id), min: Math.round(S.min * 10) / 10, day: S.day, weather: S.weather, order: S.order, zone: CZ.Z.id, obj });
      }
    }
    if ((saveT -= dt) <= 0) { saveT = 8; NP.push({ k: 'czsave', S: publicSave() }); }
    rosterDiff();
  };
  // what a guest asks for, done to their member here
  CZ.netAct = function (a, d) {
    if (!a || !a.cz || !a.cz.m) return;
    const m = a.cz.m, op = d.op;
    if (op === 'ammo') { CZ.take(m, String(d.c), Math.max(0, d.n | 0)); return; }
    if (op === 'use') return CZ.use(a, String(d.id));
    if (op === 'heal') return CZ.quickHeal(a);
    if (op === 'throw') return CZ.throwItem(a);
    if (op === 'drop') { const id = String(d.id), n = m.inv[id] || 0; if (n) { CZ.take(m, id, n); CZ.dropLoot(a.pos, [[id, n]], 'Dropped'); } return; }
    if (op === 'give') { const t = NP.byId.get(d.to); const id = String(d.id); if (t && t.cz && t.cz.m && U.dist3(t.pos, a.pos) < 7 && m.inv[id] > 0) { const n = CZ.add(t.cz.m, id, Math.min(m.inv[id], d.n | 0 || 1)); CZ.take(m, id, n); } return; }
    if (op === 'craft') return CZ.craft(String(d.rid), a);
    if (op === 'equip') { CZ.equip(a, String(d.id), d.slot ? 1 : 0); NP.push({ k: 'czgun', to: a.net, lo: { primary: a.loadout.primary, secondary: a.loadout.secondary, gadget: a.loadout.gadget }, mags: a.w.map(w => w.mag) }); return; }
  };
  const oHostGot = NP.hostGot;
  NP.hostGot = function (id, d) {
    if (d && d.t === 'np.cz' && GAME.mode === 'cityz') { const a = NP.actorOf(id); return CZ.netAct(a, d); }
    return oHostGot.apply(this, arguments);
  };
  // messages to a guest's member: their screen, not the host's
  const oToast = HUD.toast;
  CZ.tell = (a, x, c) => { if (!a) return; if (a.isPlayer) oToast(x, c); else if (a.net && host()) NP.push({ k: 'toast', to: a.net, x, c }); };

  /* ================================================================ guest */
  CZ.netVox = null;
  const oGuestGot = NP.guestGot;
  NP.guestGot = function (d) {
    if (d && d.t === 'np.czzone') return guestZone(d);
    const r = oGuestGot.apply(this, arguments);
    if (d && d.t === 'np.round' && GAME.mode === 'cityz') guestRound();
    return r;
  };
  function guestZone(d) {
    hookReset();
    GAME.mode = 'cityz'; GAME.myTeam = 0;
    CZ.S = d.S; CZ.netVox = { zone: d.zone, vox: d.vox || '' };
    if (MAIN.mapId !== 'cz_' + d.zone) MAIN.loadMap('cz_' + d.zone);
  }
  // the round's world reset puts the place back as built: put back what has changed in it
  // (main.js loads after this file: the hook goes in the first time it is needed)
  function hookReset() {
    if (CZ._resetHooked) return; CZ._resetHooked = true;
    const oReset = MAIN.resetWorld;
    MAIN.resetWorld = function () {
      const r = oReset.apply(this, arguments);
      if (guest() && CZ.netVox && G.map && G.map.cz === CZ.netVox.zone && CZ.netVox.vox) { CZ.voxApply(G.world, CZ.netVox.vox); G.world.computeSky(); G.world.remeshAll(); NAV.build(); }
      return r;
    };
  }
  function guestRound() {
    const f = G.scene.fog;
    CZ.Z = { id: CZ.netVox.zone, def: CZ.ZONES[CZ.netVox.zone], st: {}, fog0: { color: f.color.getHex(), near: f.near, far: f.far }, exits: G.map.exits, t: 0, guest: true };
    CZ.guestM = CZ.guestM || { name: '', st: { hunger: 0, thirst: 0, fatigue: 0, stamina: 100, infection: 0, bleed: 0, fracture: false, temp: 37, sick: 0, pain: 0 }, inv: {}, guns: [] };
    if (G.player && !G.player.ghost) { G.player.cz = { m: CZ.guestM, res: [] }; G.player.drones = 0; }
    for (const a of G.actors) dress(a);
    document.body.classList.add('cz'); CZ.ui.enter();
    HUD.banner(CZ.Z.def.name, 'DAY ' + CZ.S.day + ' · ' + CZ.clock() + ' · the host leads', 3);
  }
  // the infected and people as the host's game has them: no guns in hand, the infected's pose
  function dress(a) {
    const id = a.op && a.op.id || '';
    if (/^_inf_/.test(id)) { const kind = id.slice(5), d = CZ.INFECTED[kind]; a.cz = { inf: kind, def: d, state: 'idle' }; if (a.rig) { a.rig.gun.visible = false; if (d && d.scale) a.rig.root.scale.setScalar(d.scale); } }
    else if (/^_civ/.test(id)) { if (a.rig) a.rig.gun.visible = false; }
  }
  function addActor(r) {
    if (NP.byId.has(r.id)) return;
    const op = DATA.OPMAP[r.op]; if (!op) return;
    const a = new Actor({ name: r.n, team: r.tm, side: r.sd, op, loadout: r.lo || {} });
    a.id = r.id; a.pos.set(r.p[0], r.p[1], r.p[2]); a.yaw = r.y; a.stance = r.st || 0; a.tpos = a.pos.clone(); a.tyaw = a.yaw;
    a.match = { k: 0, d: 0, a: 0, s: 0 };
    a.addTo(G.scene); G.actors.push(a); NP.byId.set(a.id, a); dress(a);
  }
  function delActor(id) { const a = NP.byId.get(id); if (!a || a === G.player) return; a.removeFrom(G.scene); const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1); NP.byId.delete(id); }
  OPS2.chain('guestEvent', function (e) {
    if (e.k === 'czadd' && guest()) { addActor(e.r); return true; }
    if (e.k === 'czdel' && guest()) { delActor(e.id); return true; }
    if (e.k === 'czs' && guest() && e.to === NP.me) {
      const m = CZ.guestM || (CZ.guestM = { st: {}, inv: {}, guns: [] });
      m.st = e.st; m.inv = e.inv; m.guns = (e.guns || []).map(id => ({ id, mag: 0 }));
      if (CZ.S) { CZ.S.min = e.min; CZ.S.day = e.day; CZ.S.weather = e.weather; CZ.S.order = e.order; }
      CZ.guestObj = e.obj;
      if (G.player && !G.player.cz) G.player.cz = { m, res: [] };
      return true;
    }
    if (e.k === 'czsave' && guest()) { const keep = CZ.S && { min: CZ.S.min, day: CZ.S.day }; CZ.S = e.S; if (keep) Object.assign(CZ.S, keep); return true; }
    if (e.k === 'czgun' && guest() && G.player && e.to === NP.me) {
      const a = G.player; a.loadout = Object.assign({}, a.loadout, e.lo); a.resetKit(); a.w.forEach((w, i) => { w.mag = (e.mags || [])[i] || 0; w.reserve = 0; });
      if (a.cz) a.cz.res = []; a.cur = Math.min(a.cur || 0, a.w.length - 1); if (a.rig) MD.setRigGun(a.rig, a.w[a.cur].id); PLAYER.vmKey = '';
      return true;
    }
    return false;
  });
  // the guest's own guns: the reserve is their pack's rounds; what they fire is reported
  CZ.guestTick = function (dt) {
    const a = G.player; if (!a || !a.cz || a.ghost) return;
    const m = a.cz.m, last = a.cz.res || (a.cz.res = []);
    for (let i = 0; i < a.w.length; i++) {
      const w = a.w[i], c = CZ.calOf(w.id);
      if (last[i] != null && w.reserve < last[i]) { const n = last[i] - w.reserve; m.inv[c] = Math.max(0, (m.inv[c] || 0) - n); Online.toHost({ t: 'np.cz', op: 'ammo', c, n }); }
    }
    for (let i = 0; i < a.w.length; i++) { const w = a.w[i]; w.reserve = m.inv[CZ.calOf(w.id)] || 0; last[i] = w.reserve; }
  };
  /* a guest's actions on their own pack: asked of the host */
  CZ.ask = (op, extra) => Online.toHost(Object.assign({ t: 'np.cz', op }, extra || {}));

  /* ================================================================ what guests see of City Z things */
  OPS2.chain('entRec', function (e, x) {
    if (e.type === 'czloot' || e.type === 'czfix') x.lb = String(e.label || '').slice(0, 60);
    if (e.type === 'czcar') { x.car = [e.rec.kind, Math.round(e.yaw * 100) / 100, e.dead ? 1 : 0, e.driver ? 1 : 0]; }
  });
  OPS2.chain('mirrorSet', function (m, x) {
    if (x.lb != null) m.label = x.lb;
    if (x.car) {
      if (!m.carMesh) {
        const def = CZ.VEHICLES[x.car[0]] || CZ.VEHICLES.hatch, g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 4.2), new THREE.MeshBasicMaterial({ color: def.color })); body.position.y = 0.7; g.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.1), new THREE.MeshBasicMaterial({ color: 0x9ab0c0 })); cab.position.y = 1.35; g.add(cab);
        G.scene.add(g); m.carMesh = g; (m.extra || (m.extra = [])).push(g);
      }
      m.carMesh.position.copy(m.tpos || m.pos); m.carMesh.rotation.y = x.car[1];
      if (x.car[2]) m.carMesh.children.forEach(c => c.material.color.setHex(0x2a2624));
    }
  });
})();
