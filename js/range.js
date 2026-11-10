/* range.js -- the shooting range (any operator, targets, breach house, drone
   course, kill-house drill) and the guided training built on top of it.   */
(function () {
  'use strict';
  const { OPMAP, M } = DATA;
  const V = () => new THREE.Vector3();
  const R = { active: false, dummies: [], tut: null, refillT: 0, deadT: 0 };
  const DUMMY_OP = { id: '_dummy', armor: 1, speed: 2, look: { head: 'helmet', helmet: 0xd06a2a, vest: 0xe08a3a, cloth: 0x8a8a80, accent: 0xffffff, skin: 0xc8b8a0, hair: 0x333333 } };

  function spawnPlayer(opId, keepPos) {
    const op = OPMAP[opId] || OPMAP.kiln;
    const old = G.player;
    const lo = Object.assign({ primary: op.primaries[0], secondary: op.secondaries[0], gadget: op.gadgets[0] }, U.store.get('lo_' + op.id, {}), R.forceLo || {});
    if (!op.primaries.includes(lo.primary)) lo.primary = op.primaries[0];
    if (!op.gadgets.includes(lo.gadget) && !(R.forceLo && R.forceLo.gadget)) lo.gadget = op.gadgets[0];
    const a = new Actor({ name: op.name, team: 0, side: op.side, op, loadout: lo, isPlayer: true });
    if (old) { const i = G.actors.indexOf(old); if (i >= 0) G.actors.splice(i, 1); old.removeFrom(G.scene); }
    const s = G.map.spawns[0];
    if (keepPos && old && old.state !== 'dead') { a.pos.copy(old.pos); a.yaw = old.yaw; a.pitch = old.pitch; }
    else { a.pos.set(s.x, s.y, s.z); a.yaw = s.yaw; }
    G.player = a; G.actors.push(a); a.addTo(G.scene);
    GAME.startSide = op.side; GAME.round = 0;
    GAME.pool = { 0: 99, 1: 99 };
    PLAYER.vmKey = ''; PLAYER.view = 'body'; PLAYER.drone = null; PLAYER.cam = null; PLAYER.enabled = true; PLAYER.deadT = 0;
    if (op.side === 'def' && !GAD.cams(0).length) { new GAD.Cam(V().set(30, 6, 30), Math.PI, -0.3, 0, 'RANGE CAM', false); new GAD.Cam(V().set(112 / 4, 6, 104 / 4), 0, -0.3, 0, 'HOUSE CAM', false); }
    for (const c of GAD.cams(1 - 0)) { /* keep */ }
    for (const c of G.ents) if (c.alive && (c.type === 'cam') && c.team !== 0) c.team = 0;
    return a;
  }
  function addDummy(d, x, moving, crouch) {
    const a = new Actor({ name: 'TARGET', team: 1, side: 'def', op: DUMMY_OP, dummy: true, loadout: { primary: 'p10', secondary: 'p10', gadget: null } });
    a.pos.set(x, 3.25, 3.5 + d); a.yaw = 0; a.rig.gun.visible = false;
    a.home = a.pos.clone(); a.moveAmp = moving ? 2.2 : 0; a.phase = Math.random() * 6; a.dist = d;
    if (crouch) { a.stance = 1; }
    a.addTo(G.scene); G.actors.push(a); R.dummies.push(a);
    return a;
  }
  function setupDummies() {
    R.dummies.forEach(d => { d.removeFrom(G.scene); const i = G.actors.indexOf(d); if (i >= 0) G.actors.splice(i, 1); }); R.dummies = [];
    const lanes = [[5, 6], [10, 9], [10, 14], [20, 12], [20, 4], [35, 10], [50, 8]];
    lanes.forEach(([d, x], i) => addDummy(d, x, i === 2 || i === 5, i === 4));
  }

  R.start = function (opId, tut) {
    MENU.loading(tut ? 'Loading training…' : 'Loading the range…', () => {
      GAME.quit();
      MAIN.loadMap('range');
      G.mode = 'range'; R.active = true; R.tut = null; R.forceLo = null;
      GAME.sandbox = true; GAME.mode = 'bomb'; GAME.phase = 'action'; GAME.obj = {}; GAME.feed = [];
      const back = G.map.roomByName['Back Room'][0];
      GAME.siteRooms = [back]; GAME.siteNames = ['Back Room']; GAME.obj.rooms = [back, G.map.roomByName['Front Room'][0]];
      G.actors = [];
      setupDummies();
      spawnPlayer(opId || 'kiln');
      MENU.hide(); HUD.show(true); HUD.roundStart();
      if (tut) R.beginTutorial(); else HUD.el.hint.innerHTML = KEYS.fmt('<b>SHOOTING RANGE</b> · {rangeOp} change operator · {refill} refill gadgets · {rebuild} rebuild the house · {drill} kill-house drill (live bots) · ESC menu');
      PLAYER.lock();
    });
  };
  R.stop = function () { R.active = false; R.tut = null; if (HUD.el.hint) HUD.el.hint.innerHTML = ''; };
  R.setOp = function (id) { spawnPlayer(id, true); HUD.toast(OPMAP[id].name + ' ready'); };
  R.tutorial = function () { R.start('kiln', true); };

  R.onDummyHit = function (d, dmg, info, before) {
    HUD.dmgNumber(d.eye(V()), Math.min(dmg, 999), info.head);
    d.downCount = (d.downCount || 0) + (before - dmg <= 0 ? 1 : 0);
    if (info.head && info.src && info.src.isPlayer) R.headshot = (R.headshot || 0) + 1;
    if (d.hp <= 0 && R.tut) d.dead = true;
  };
  R.onEvent = function (ev) { R.ev = R.ev || {}; R.ev[ev] = (R.ev[ev] || 0) + 1; };

  /* kill-house drill: live bots in the breach house */
  R.drill = function () {
    for (const a of G.actors.filter(x => x.bot)) { a.removeFrom(G.scene); }
    G.actors = G.actors.filter(x => !x.bot);
    const me = G.player, enemySide = me.side === 'atk' ? 'def' : 'atk';
    const ops = U.shuffle(DATA.OPS.filter(o => o.side === enemySide)).slice(0, 3);
    for (const op of ops) {
      const a = new Actor({ name: op.name, team: 1, side: enemySide, op, loadout: { primary: op.primaries[0], secondary: op.secondaries[0], gadget: op.gadgets[0] } });
      AI.attach(a);
      if (enemySide === 'def') a.pos.copy(NAV.randomIn(U.pick(GAME.obj.rooms)));
      else { const s = G.map.spawns[1]; a.pos.set(s.x + Math.random() * 2, s.y, s.z - 2 + Math.random() * 2); }
      a.addTo(G.scene); G.actors.push(a);
    }
    AI.roundStart(); AI.actionStart();
    HUD.toast('Kill-house drill: ' + ops.length + ' ' + (enemySide === 'def' ? 'defenders in the house' : 'attackers incoming'), 'warn');
  };

  R.update = function (dt) {
    const a = G.player; if (!a) return;
    // keys
    const K = PLAYER.held;
    if (PLAYER.locked && !R.tut) {
      if (K('rangeOp') && !R._b) { R._b = true; PLAYER.release(); G.paused = true; MENU.rangePick(true); }
      if (K('refill') && !R._h) { R._h = true; R.refill(true); HUD.toast('Gadgets refilled'); }
      if (K('rebuild') && !R._k) { R._k = true; MAIN.resetWorld(true); G.actors = G.actors.filter(x => !x.bot); G.actors.forEach(x => x.addTo(G.scene)); HUD.toast('Breach house rebuilt'); }
      if (K('drill') && !R._j) { R._j = true; R.drill(); }
    }
    if (!K('rangeOp')) R._b = false; if (!K('refill')) R._h = false; if (!K('rebuild')) R._k = false; if (!K('drill')) R._j = false;
    if (R.tut && K('skipStep') && !R._n && PLAYER.locked) { R._n = true; R.next(); } if (!K('skipStep')) R._n = false;
    for (const x of G.actors) GAME.updateInteract(x, dt);
    // dummies
    for (const d of R.dummies) {
      if (d.moveAmp) { d.pos.x = d.home.x + Math.sin(G.time * 0.9 + d.phase) * d.moveAmp; d.moving = 1.5; d.yaw = Math.cos(G.time * 0.9 + d.phase) > 0 ? -Math.PI / 2 : Math.PI / 2; }
      if (d.hp < d.maxHp && G.time - d.lastHurt > 2.5) d.hp = d.maxHp;
    }
    // ammo is endless on the range
    for (const w of a.w) if (w.reserve < w.def.mag * 2) w.reserve = w.def.mag * 4;
    R.refillT -= dt; if (R.refillT <= 0 && !R.tut) { R.refillT = 10; R.refill(false); }
    if (a.state === 'dead') { R.deadT += dt; if (R.deadT > 2) { R.deadT = 0; spawnPlayer(a.op.id); } }
    if (a.state === 'dbno') { a.revive(a); }
    if (R.tut) R.tutUpdate(dt);
  };
  R.refill = function (all) {
    const a = G.player;
    if (a.gadget) a.gadget.count = DATA.GADGETS[a.gadget.id].count;
    if (a.ability && (all || a.ability.count < a.op.ability.count)) { a.ability.count = a.op.ability.count; a.ability.zaps = 3; a.ability.cd = 0; }
    if (a.side === 'atk') a.drones = Math.max(a.drones, 2);
  };

  /* ================================================================ training */
  const L = [
    { t: 'MOVE', x: 'Walk with {forward}{left}{back}{right} and look with the mouse. Walk out to the yellow marker on the firing line.', mark: () => V().set(14, 3.4, 2.6), ok: s => U.dist2(G.player.pos, V().set(14, 0, 2.6)) < 1.2 },
    { t: 'STANCES', x: 'Hold {sprint} to sprint. Press {crouch} to crouch and {prone} to go prone (press again to stand). Do all three.', ok: s => { const a = G.player; if (a.sprint && a.moving > 3.5) s.r = 1; if (a.stance === 1) s.c = 1; if (a.stance === 2) s.p = 1; return s.r && s.c && s.p; } },
    { t: 'LEAN', x: 'Use {leanL} to lean left and {leanR} to lean right (hold or toggle, see Controls): peek a corner while showing as little of yourself as possible.', ok: s => { const a = G.player; if (a.lean < -0.8) s.l = 1; if (a.lean > 0.8) s.rr = 1; return s.l && s.rr; } },
    { t: 'SHOOT', x: 'Use {aim} to aim down sights and {fire} to fire. Take down the targets at 5 and 10 m (hit each until it flashes).', start: s => { s.base = R.dummies.filter(d => d.dist <= 10).map(d => d.downCount || 0); }, ok: s => R.dummies.filter(d => d.dist <= 10).every((d, i) => (d.downCount || 0) > s.base[i]) },
    { t: 'HEADSHOTS', x: 'Any bullet to the head is lethal (shotgun pellets just hit harder). Land a headshot on a 20 m target.', start: s => { s.h = R.headshot || 0; }, ok: s => (R.headshot || 0) > s.h },
    { t: 'RELOAD & SWAP', x: 'Press {reload} to reload. Press {secondary} for your sidearm, then {primary} to go back to your primary.', ok: s => { const a = G.player; if (a.wpn.reload > 0) s.r = 1; if (a.cur === 1) s.two = 1; if (s.two && a.cur === 0) s.one = 1; return s.r && s.two && s.one; } },
    { t: 'VAULT', x: 'Head to the low concrete wall near the breach house (marker) and press {vault} facing it to vault over.', mark: () => V().set(23, 3.6, 11.4), start: s => { s.v = (R.ev || {}).vault || 0; }, ok: s => ((R.ev || {}).vault || 0) > s.v },
    { t: 'SOFT BREACH', x: 'You are RIVET now. Face the breach house\'s front wall, press {gadget} to stick a breach charge on it, back off and press {gadget} again.', op: 'rivet', lo: { gadget: 'breach' }, mark: () => V().set(28.6, 4.4, 14.8), start: s => { s.b = (R.ev || {}).breach || 0; }, ok: s => ((R.ev || {}).breach || 0) > s.b },
    { t: 'HARD BREACH', x: 'Reinforced walls only fall to a hard breach. As KILN, press {ability} on the steel panel on the east side of the house and wait for the burn.', op: 'kiln', mark: () => V().set(34.2, 4.5, 16.8), start: s => { s.b = (R.ev || {}).bore || 0; }, ok: s => ((R.ev || {}).bore || 0) > s.b },
    { t: 'DRONES', x: 'Press {device} to throw a drone and take control. Drive it through the low tunnel to the north ({vault} hops). Drones fit under barricades too.', op: 'vesper', mark: () => V().set(21.5, 3.6, 31.2), ok: s => G.ents.some(e => e.alive && e.type === 'drone' && e.pos.x > 34 && e.pos.z > 30 && e.pos.z < 32.5) },
    { t: 'SPOTTING', x: 'Look at a target and press {ping} (or {fire} while on a drone/camera) to spot it: your whole team sees it through walls.', ok: s => R.dummies.some(d => GAME.marked(d, 0)) },
    { t: 'BARRICADE & REINFORCE', x: 'You are BRICK, a defender. Hold {interact} at an open doorway or window to barricade it, then hold {interact} facing a wall to reinforce it.', op: 'brick', start: s => { s.b = (R.ev || {}).barricade || 0; s.r = (R.ev || {}).reinforce || 0; MAIN.resetWorld(true); G.actors.forEach(x => x.addTo(G.scene)); }, ok: s => ((R.ev || {}).barricade || 0) > s.b && ((R.ev || {}).reinforce || 0) > s.r },
    { t: 'DEFENDER GADGETS', x: 'Press {gadget} to drop deployable cover, then look at an open doorway or window and press {ability} to seal it with a bunker plate.', op: 'brick', lo: { gadget: 'dshield' }, start: s => { s.k = (R.ev || {}).bunker || 0; R.forceLo = null; }, ok: s => { if (G.ents.some(e => e.alive && (e.type === 'dshield'))) s.w = 1; return s.w && ((R.ev || {}).bunker || 0) > s.k; }, x2: 'Press G to drop deployable cover, then X at an open doorway or window for a bunker plate.' },
    { t: 'PLANT THE DEFUSER', x: 'Attackers win Bomb by planting the defuser. Walk into the BACK ROOM of the breach house and hold {interact} for 7 seconds.', op: 'vesper', start: s => { G.player.carry = 'defuser'; GAME.obj.defuser = null; }, ok: s => GAME.obj.defuser && GAME.obj.defuser.alive },
    { t: 'REVIVE', x: 'Shots that would kill you usually put you DOWN instead. A teammate is down by the firing line: hold {interact} next to them to revive.', start: s => { if (GAME.obj.defuser) { GAME.obj.defuser.destroy('silent'); GAME.obj.defuser = null; } const op = OPMAP.halcyon; const b = new Actor({ name: op.name, team: 0, side: 'atk', op }); b.pos.set(11, 3.25, 2.6); b.addTo(G.scene); G.actors.push(b); b.state = 'dbno'; b.hp = 20; b.bleed = 999; b.stance = 2; s.ally = b; }, ok: s => s.ally && s.ally.state === 'alive', mark: () => V().set(11, 4, 2.6) },
    { t: 'TRAINING COMPLETE', x: 'That is the core of BLOCKADE. Head to PLAY for a full match, or the SHOOTING RANGE to try every operator. Press ESC to leave. Every key can be rebound in CONTROLS.', ok: () => false },
  ];
  R.beginTutorial = function () { R.tut = { i: -1 }; R.ev = {}; R.next(); };
  R.next = function () {
    const T = R.tut; T.i = Math.min(L.length - 1, T.i + 1); T.s = {}; T.done = 0;
    const l = L[T.i];
    R.forceLo = l.lo || null;
    if (l.op && (!G.player || G.player.op.id !== l.op)) spawnPlayer(l.op, true);
    else if (l.lo) spawnPlayer(G.player.op.id, true);
    R.forceLo = null;
    if (l.start) l.start(T.s);
    SFX.ui(1200);
    R.drawHint();
  };
  R.drawHint = function () {
    const T = R.tut, l = L[T.i];
    HUD.el.hint.innerHTML = KEYS.fmt('<div class="tut"><small>TRAINING ' + (T.i + 1) + ' / ' + L.length + '</small><b>' + l.t + '</b><p>' + l.x + '</p><em>{skipStep} skip step · ESC leave</em></div>');
  };
  R.tutUpdate = function (dt) {
    const T = R.tut, l = L[T.i];
    if (l.mark) HUD.pings = [{ p: l.mark(), t: G.time + 0.2 }];
    if (T.done) { T.done -= dt; if (T.done <= 0) R.next(); return; }
    let ok = false; try { ok = l.ok(T.s); } catch (e) { ok = false; }
    if (ok) { T.done = 1.2; HUD.toast('✓ ' + l.t, 'kill'); SFX.ping(); }
    for (const w of G.player.w) if (w.reserve < w.def.mag * 2) w.reserve = w.def.mag * 4;
    R.refillT -= dt; if (R.refillT <= 0) { R.refillT = 3; R.refill(false); }
  };

  window.RANGE = R;
})();
