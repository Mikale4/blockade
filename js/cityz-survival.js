/* cityz-survival.js -- City Z: staying alive. Each member of the squad has needs that change every
   minute (hunger, thirst, fatigue, stamina, infection, bleeding, a broken bone, body heat, sickness),
   a pack with a weight limit, and ammunition by calibre that is their guns' reserve. Rooms are searched
   for what their kind of room would hold; things are eaten, drunk, applied and crafted; safehouses are
   restored, upgraded, slept in, and keep a stash.

   One real second is one minute of the day. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const VS = 0.25;
  DATA.mat('CZ_BOARD', 0x8a6a44, { hp: 4, pen: 0.6, xp: true, hb: true, melee: true, pat: 'planks' });
  const squadActors = () => G.actors.filter(a => a.cz && a.cz.m && a.state !== 'dead');

  /* ================================================================ packs */
  CZ.weight = function (m) {
    let kg = 0;
    for (const [id, n] of Object.entries(m.inv)) kg += (id.startsWith('gun:') ? CZ.itemKg(id.slice(4)) : CZ.itemKg(id)) * n;
    for (const g of m.guns || []) if (g) kg += CZ.itemKg(g.id);
    return Math.round(kg * 10) / 10;
  };
  CZ.capacity = function (m) {
    let c = 22;
    for (const id of ['pack_s', 'pack_l']) if (m.inv[id] > 0) c = Math.max(c, 22 + CZ.ITEMS[id].carry);
    return c;
  };
  CZ.count = (m, id) => m.inv[id] || 0;
  CZ.add = function (m, id, n) {
    if (CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'quest') { m.inv[id] = (m.inv[id] || 0) + n; return n; }   // the story's things always go in
    const kg = id.startsWith('gun:') ? CZ.itemKg(id.slice(4)) : CZ.itemKg(id);
    const room = CZ.capacity(m) * 1.3 - CZ.weight(m);            // over the limit you are slow; 30% over, no more
    const fit = kg > 0 ? Math.max(0, Math.min(n, Math.floor(room / kg + 1e-6))) : n;
    if (fit > 0) m.inv[id] = (m.inv[id] || 0) + fit;
    return fit;
  };
  CZ.take = function (m, id, n) { const have = m.inv[id] || 0, t = Math.min(have, n); if (t > 0) { m.inv[id] = have - t; if (m.inv[id] <= 0) delete m.inv[id]; } return t; };
  // everything the squad can draw on here: your pack, the stash (at a safehouse), teammates near you
  CZ.sources = function (who) {
    const p = who || G.player, out = [];
    if (p && p.cz) out.push(p.cz.m.inv);
    const S = CZ.S, z = CZ.Z && CZ.Z.id;
    if (z && CZ.isSafe(z) && atSafe(p)) out.push(S.stash[z] || (S.stash[z] = {}));
    for (const a of squadActors()) if (a !== p && p && U.dist3(a.pos, p.pos) < 12) out.push(a.cz.m.inv);
    return out;
  };
  CZ.haveAll = function (needs, srcs) { srcs = srcs || CZ.sources(); for (const [id, n] of Object.entries(needs)) { let h = 0; for (const s of srcs) h += s[id] || 0; if (h < n) return false; } return true; };
  CZ.spend = function (needs, srcs) {
    srcs = srcs || CZ.sources();
    for (const [id, n0] of Object.entries(needs)) { let n = n0; for (const s of srcs) { const t = Math.min(n, s[id] || 0); if (t > 0) { s[id] -= t; if (s[id] <= 0) delete s[id]; n -= t; } if (n <= 0) break; } }
  };

  /* ================================================================ ammunition */
  /* a gun's reserve is the pack's rounds of its calibre: kept in step every frame (two guns of one
     calibre share them) */
  function ammoSync(a) {
    if (a.net) return;   // an online guest's guns: they report what they fire (cityz-net.js)
    const m = a.cz.m, last = a.cz.res || (a.cz.res = []);
    for (let i = 0; i < a.w.length; i++) {
      const w = a.w[i], c = CZ.calOf(w.id);
      if (last[i] != null && w.reserve < last[i]) CZ.take(m, c, last[i] - w.reserve);
    }
    for (let i = 0; i < a.w.length; i++) { const w = a.w[i]; w.reserve = m.inv[CZ.calOf(w.id)] || 0; last[i] = w.reserve; }
  }
  CZ.ammoSync = ammoSync;

  /* ================================================================ needs */
  const RATE = { hunger: 0.075, thirst: 0.11, fatigue: 0.055 };
  function outdoors(a) { return !G.map.inside(a.pos) || G.world.outdoor(a.pos.clone().setY(a.pos.y + 1)); }
  CZ.sheltered = a => !outdoors(a);   // under a roof, out of the rain (a doorway in a building's outline doesn't count)
  function warmth(m) { let w = 0; if (m.inv.jacket) w += 2; if (m.inv.raincoat) w += CZ.S.weather === 'rain' ? 1.5 : 0.5; return w; }
  function nearFire(a) { return G.ents.some(e => e.alive && e.type === 'fire' && U.dist3(e.pos, a.pos) < 4); }
  CZ.nearFire = nearFire;
  /* a campfire from firewood, a step ahead on the floor: three minutes of warmth for anyone within 4 m.
     It's the lighter's fire, so it doesn't burn the squad (no friendly fire); the infected it does */
  CZ.lightFire = function (a) {
    const m = a.cz && a.cz.m; if (!m || !(m.inv.firewood > 0) || a.busy > 0) return false;
    const f = a.fwd(V()).setY(0).normalize(), p = a.pos.clone().addScaledVector(f, 1.3);
    const n = NAV.nearest(p, 3), q = n >= 0 ? NAV.nodePos(n) : a.pos.clone();
    if (U.dist3(q, a.pos) < 0.9) q.addScaledVector(f, 0.8);
    CZ.take(m, 'firewood', 1); a.busy = 2; a.busyLabel = 'LIGHTING A FIRE';
    setTimeout(() => { if (!CZ.on() || a.state === 'dead') return; const fire = new GAD.Fire(a, V().set(q.x, Math.round(q.y * 4) / 4 + 0.02, q.z), 0.7, 180); fire.campfire = true; SFX.wood(q); CZ.tell(a, 'Campfire lit: stay close to warm up', 'info'); }, 1800);
    return true;
  };
  CZ.survivalTick = function (dt) {
    const diff = CZ.diff(), S = CZ.S;
    for (const a of squadActors()) {
      const m = a.cz.m, st = m.st;
      ammoSync(a);
      if (a.state !== 'alive') continue;
      // hunger, thirst, tiredness
      st.hunger = Math.min(100, st.hunger + RATE.hunger * diff.need * dt);
      st.thirst = Math.min(100, st.thirst + RATE.thirst * diff.need * dt * (st.sick > 0 ? 1.6 : 1));
      st.fatigue = Math.min(100, st.fatigue + RATE.fatigue * diff.need * dt * (a.sprint && a.moving > 0.5 ? 2.2 : 1));
      // a rest: still, with no infected within 15 m, tiredness comes back down (crouched or lying
      // faster, indoors faster), but only sleep takes it below 40. A nap on a safehouse bed goes all
      // the way down
      a.czResting = false;
      if (a.czNap && a.czNap > G.time) { st.fatigue = Math.max(0, st.fatigue - 1.4 * dt); a.czResting = true; }
      else if ((a.moving || 0) < 0.15 && st.fatigue > 40 && !(a.czCalmChk > G.time && a.czThreat)) {
        if (!(a.czCalmChk > G.time)) { a.czCalmChk = G.time + 1; a.czThreat = G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 15); }
        if (!a.czThreat) { st.fatigue = Math.max(40, st.fatigue - dt * (a.stance > 0 ? 0.45 : 0.22) * (G.map.inside(a.pos) ? 1.3 : 1)); a.czResting = true; }
      }
      // stamina: sprinting spends it; you get it back walking, slower when hungry, thirsty or exhausted
      const smax = Math.min(st.fatigue >= 95 ? 45 : st.fatigue > 80 ? 75 : 100, st.sick > 30 ? 70 : 100);
      if (a.sprint && a.moving > 0.5) st.stamina = Math.max(0, st.stamina - 13 * dt);
      else st.stamina = Math.min(smax, st.stamina + 15 * dt * (st.hunger > 75 || st.thirst > 75 ? 0.5 : 1));
      if (st.stamina <= 0) a.czWinded = G.time + 2.5;
      // wounds: bleeding drains health until dressed
      if (st.bleed > 0) { a.czBleedAcc = (a.czBleedAcc || 0) + dt * st.bleed * 0.55; if (a.czBleedAcc >= 1) { const n = Math.floor(a.czBleedAcc); a.czBleedAcc -= n; a.hurt(n, { kind: 'bleed' }); if (Math.random() < 0.3) FX.blood && FX.blood(a.center(V()), 0, -1, 0); } }
      if (st.hunger >= 100) a.hurt(0.25 * dt, { kind: 'starve' });
      if (st.thirst >= 100) a.hurt(0.35 * dt, { kind: 'starve' });
      // a bad tin or dirty water: it hits half a minute or so later, and then you're sick for a while (a
      // dose of antibiotics clears it): throwing up (what was eaten and drunk comes back up, loudly),
      // thirsty, short of breath, and a bad bout wears you down
      if (a.czQueasy && G.time > a.czQueasy.t) {
        st.sick = Math.min(100, st.sick + a.czQueasy.n); a.czQueasy = null;
        CZ.tell(a, 'Your stomach turns over: something you ate or drank was bad', 'warn');
        if (a.bot && window.VOICE) VOICE.say(a, 'sick', ['Oh no. Oh, that water...', "I'm going to be sick.", 'Should not have eaten that.'], 3);
      }
      if (st.sick > 0) {
        st.sick = Math.max(0, st.sick - 0.12 * dt);
        if (Math.random() < dt * (0.012 + st.sick / 100 * 0.04) && !(a.busy > 0)) {
          st.thirst = Math.min(100, st.thirst + 8); st.hunger = Math.min(100, st.hunger + 6);
          GAME.noise(a.pos, 12, a, 'step'); a.busy = 1.6; a.busyLabel = 'THROWING UP';
          if (a.isPlayer) { CZ.tell(a, 'You threw up', 'warn'); if (PLAYER.punch) PLAYER.punch(0.35); }
        }
        if (st.sick > 50) a.hurt(0.04 * dt, { kind: 'starve' });
      }
      st.pain = Math.max(0, (st.pain || 0) - dt);
      // the infection: once it has a hold it grows by itself; at 100 they turn
      if (st.infection > 30) st.infection = Math.min(100, st.infection + 0.018 * dt * diff.infect);
      if (st.infection > 60 && Math.random() < dt * 0.05) { SFX.groan(a.eye(V()), 1.2); GAME.noise(a.pos, 10, a, 'step'); }
      if (st.infection >= 100) { turn(a); continue; }
      // body heat
      const out = outdoors(a), dark = CZ.dark(), wet = S.weather === 'rain' && out;
      const cold = (out ? 0.8 + dark * 1.4 : 0.2 + dark * 0.3) + (wet ? 1.4 : 0) + (S.weather === 'fog' && out ? 0.3 : 0);
      const target = nearFire(a) ? 37.6 : 37 - Math.max(0, cold - warmth(m)) * 0.9;
      st.temp += (target - st.temp) * Math.min(1, dt * 0.012) + (nearFire(a) ? 0.02 * dt : 0);
      if (st.temp < 35.5) a.hurt((st.temp < 34 ? 0.5 : 0.15) * dt, { kind: 'cold' });
      // pace: a broken bone limps, a heavy pack drags, being winded or worn out stops the sprint
      const kg = CZ.weight(m), cap = CZ.capacity(m);
      let k = 1;
      if (st.fracture && !(st.pain > 0)) k *= 0.72;
      if (kg > cap) k *= kg > cap * 1.2 ? 0.62 : 0.82;
      if (st.fatigue >= 95) k *= 0.88;
      a.czMul = k === 1 ? 0 : k;
      if ((a.czWinded > G.time) || (st.fracture && !(st.pain > 0)) || kg > cap * 1.2) a.sprint = false;
      m.hp = a.hp;
      // bots look after themselves out of their own packs
      if (a.bot) botCare(a, dt);
    }
  };
  // a sprint key held while winded: the game's own movement reads a.sprint; stop it there too
  OPS2.chain('physics', function (a) { if (a.cz && a.cz.m && ((a.czWinded > G.time) || (a.cz.m.st.fracture && !(a.cz.m.st.pain > 0)))) a.sprint = false; return false; });
  function turn(a) {
    const m = a.cz.m;
    HUD.banner(a.name + ' HAS TURNED', 'The infection took them', 3, 'lose');
    const pos = a.pos.clone(); a.die(null, false); m.alive = false;
    if (CZ.dropPack) CZ.dropPack(a);
    setTimeout(() => { if (CZ.on() && CZ.spawnInfected) { const z = CZ.spawnInfected('runner', pos); z.name = 'Turned ' + m.name; } }, 2500);
  }
  /* time passing off screen (travel, sleep): needs as if it had been lived */
  CZ.passTime = function (minutes, why) {
    const diff = CZ.diff(), sleep = why === 'sleep', S = CZ.S;
    const z = CZ.Z && CZ.Z.id, inf = sleep && z && (S.safe[z] && (S.safe[z].up || []).includes('infirmary'));
    const medic = sleep && z && (S.survivors || []).some(s => s.home === z && s.skill === 'medic' && s.state === 'home');
    for (const m of S.squad) {
      if (!m.alive) continue;
      const st = m.st, h = minutes / 60;
      st.hunger = Math.min(100, st.hunger + RATE.hunger * diff.need * minutes * (sleep ? 0.6 : 1));
      st.thirst = Math.min(100, st.thirst + RATE.thirst * diff.need * minutes * (sleep ? 0.6 : 1));
      if (sleep) { st.fatigue = Math.max(0, st.fatigue - 14 * h); st.stamina = 100; m.hp = Math.min(100, m.hp + (inf ? 16 : 7) * h * (medic ? 2 : 1)); if (inf) st.infection = Math.max(0, st.infection - 4 * h); st.temp = 37; if (inf && st.fracture && h >= 6) st.fracture = false; }
      else { st.fatigue = Math.min(100, st.fatigue + RATE.fatigue * diff.need * minutes * 1.3); }
      if (st.infection > 30) st.infection = Math.min(99, st.infection + 0.018 * minutes * diff.infect);
      if (st.bleed > 0 && !sleep) m.hp = Math.max(5, m.hp - st.bleed * 0.55 * minutes * 0.2);
      if (st.hunger >= 100 || st.thirst >= 100) m.hp = Math.max(5, m.hp - minutes * 0.2);
    }
    for (const a of squadActors()) a.hp = Math.min(a.maxHp, Math.max(1, a.cz.m.hp));
  };

  /* ================================================================ using things */
  const USE_T = { food: 2.2, drink: 1.6, med: 3 };
  CZ.use = function (a, id, quiet) {
    if (CZ.isGuest && CZ.isGuest()) { CZ.ask('use', { id }); return true; }
    const m = a.cz && a.cz.m, it = CZ.ITEMS[id]; if (!m || !it || !it.use || !(m.inv[id] > 0) || a.state !== 'alive') return false;
    if (a.busy > 0) return false;
    const u = it.use, st = m.st;
    CZ.take(m, id, 1);
    // stressed hands are slower ones
    const P = CZ.P && CZ.P(a), shaky = P ? 1 + P.stress / 250 : 1;
    a.busy = (USE_T[it.cat] || 2) * shaky; a.busyLabel = it.cat === 'med' ? 'TREATING' : it.cat === 'drink' ? 'DRINKING' : 'EATING';
    setTimeout(() => {
      if (a.state !== 'alive') return;
      if (u.hunger) st.hunger = U.clamp(st.hunger + u.hunger, 0, 100);
      if (u.thirst) st.thirst = U.clamp(st.thirst + u.thirst, 0, 100);
      if (u.fatigue) st.fatigue = U.clamp(st.fatigue + u.fatigue, 0, 100);
      if (u.stamina) st.stamina = Math.min(100, st.stamina + u.stamina);
      if (u.bleed) st.bleed = Math.max(0, st.bleed + u.bleed);
      if (u.fracture) st.fracture = false;
      if (u.infection) st.infection = Math.max(0, st.infection + u.infection);
      if (u.sick < 0) st.sick = Math.max(0, st.sick + u.sick);
      else if (u.sick && !(CZ.has && CZ.has(a, 'ironstomach')) && Math.random() < (u.risk == null ? 1 : u.risk)) a.czQueasy = { n: u.sick, t: G.time + 20 + Math.random() * 30 };
      if (u.calm && P) P.stress = U.clamp(P.stress - u.calm, 0, 100);
      if (u.pain) st.pain = u.pain;
      if (u.warmth) st.temp = Math.min(37.4, st.temp + u.warmth * 0.3);
      if (u.hp) a.heal(u.hp);
      m.hp = a.hp;
      if (!quiet) CZ.tell(a, 'Used ' + it.name, 'info');
      if (a.isPlayer) SFX.ui(700);
    }, (USE_T[it.cat] || 2) * 900 * shaky);
    return true;
  };
  /* boiling dirty water: by a campfire, or at a safehouse workbench (its stove). All of it at once */
  CZ.canBoil = a => !!(a && a.cz && a.cz.m && (a.cz.m.inv.dirtywater || 0) > 0 && (nearFire(a) || CZ.benchLevel(a) > 0));
  CZ.boil = function (a) {
    if (CZ.isGuest && CZ.isGuest()) { CZ.ask('craft', { rid: 'purify' }); return true; }
    if (!CZ.canBoil(a) || a.busy > 0) return false;
    const m = a.cz.m, n = Math.min(4, m.inv.dirtywater);
    a.busy = 2 + n; a.busyLabel = 'BOILING WATER';
    setTimeout(() => { if (a.state !== 'alive' || !CZ.on()) return; const k = Math.min(n, m.inv.dirtywater || 0); if (!k) return; CZ.take(m, 'dirtywater', k); m.inv.water = (m.inv.water || 0) + k; CZ.tell(a, 'Boiled ' + k + ' × dirty water: safe to drink', 'info'); }, (2 + n) * 900);
    return true;
  };
  /* the quick heal key: whatever helps most right now */
  CZ.quickHeal = function (a) {
    if (CZ.isGuest && CZ.isGuest()) { CZ.ask('heal'); return true; }
    const m = a.cz.m, st = m.st, has = id => m.inv[id] > 0;
    let id = null;
    if (st.bleed > 0) id = has('bandage') ? 'bandage' : has('rag') ? 'rag' : has('medkit') ? 'medkit' : null;
    if (!id && st.fracture) id = has('splint') ? 'splint' : has('medkit') ? 'medkit' : has('painkillers') ? 'painkillers' : null;
    if (!id && a.hp < a.maxHp * 0.7) id = has('medkit') ? 'medkit' : has('painkillers') ? 'painkillers' : has('bandage') ? 'bandage' : null;
    if (!id && st.infection > 25) id = st.infection >= 60 ? (has('antiviral') ? 'antiviral' : has('antibiotics') ? 'antibiotics' : null) : (has('antibiotics') ? 'antibiotics' : has('antiviral') ? 'antiviral' : null);   // the antiviral kept for when it's bad
    // bleeding with nothing to dress it: tear a strip from your clothes
    if (!id && st.bleed > 0 && CZ.improvise) { if (CZ.improvise(a)) return true; CZ.tell(a, 'Nothing to dress it with (you can tear another strip in ' + Math.ceil((a.czImprovT || 0) - G.time) + ' s)', 'warn'); return false; }
    if (!id) { CZ.tell(a, st.bleed || st.fracture || a.hp < a.maxHp * 0.7 ? 'Nothing to treat it with' : 'Nothing needs treating', 'warn'); return false; }
    return CZ.use(a, id);
  };
  function botCare(a, dt) {
    if (CZ.botCare) return CZ.botCare(a, dt);   // cityz-auto.js: the fuller version
    if ((a.czCareT = (a.czCareT || 0) - dt) > 0 || a.busy > 0 || (a.bot && a.bot.target && G.time - a.bot.seenT < 3)) return;
    a.czCareT = 2;
    const m = a.cz.m, st = m.st, has = id => m.inv[id] > 0, pick = ids => ids.find(has);
    let id = null;
    if (st.bleed > 0) id = pick(['bandage', 'rag', 'medkit']);
    else if (st.fracture) id = pick(['splint', 'medkit']);
    else if (a.hp < 45) id = pick(['medkit', 'painkillers', 'bandage']);
    else if (st.infection > 45) id = pick(['antiviral', 'antibiotics']);
    else if (st.thirst > 62) id = pick(['water', 'soda', 'coffee']);
    else if (st.hunger > 66) id = pick(['mre', 'beans', 'soup', 'stew', 'bar', 'apple', 'crisps']);
    if (id) CZ.use(a, id, true);
    else if ((st.hunger > 85 || st.thirst > 85) && G.time > (a.czAskT || 0)) { a.czAskT = G.time + 60; if (window.VOICE) VOICE.say(a, 'ask', st.thirst > st.hunger ? ['I need water.', 'Anyone got water?'] : ['I need to eat something.', "I'm starving here."], 2); }
  };

  /* bitten, clawed or burnt by acid: the infection, and a wound */
  CZ.bitten = function (t, amount, def, acid) {
    if (!t.cz || !t.cz.m || t.state === 'dead') return;
    const st = t.cz.m.st;
    st.infection = Math.min(100, st.infection + amount * (0.6 + Math.random() * 0.8));
    if (!acid && Math.random() < 0.32) { st.bleed = Math.min(4, st.bleed + 1); if (t.isPlayer) HUD.toast('You are bleeding', 'warn'); }
    if (def && def.armour && Math.random() < 0.25) { st.fracture = true; if (t.isPlayer) HUD.toast('Something broke', 'warn'); }
  };
  // a long fall can break a bone; any bullet wound bleeds
  const oHurt = Actor.prototype.hurt;
  Actor.prototype.hurt = function (dmg, info) {
    const before = this.state;
    const r = oHurt.call(this, dmg, info);
    if (this.cz && this.cz.m && before === 'alive' && info) {
      const st = this.cz.m.st;
      if (info.kind === 'fall' && dmg > 18 && Math.random() < 0.6) { st.fracture = true; if (this.isPlayer) HUD.toast('Something broke in the fall', 'warn'); }
      if (info.kind === 'bullet' && dmg > 15 && Math.random() < 0.5) st.bleed = Math.min(4, st.bleed + 1);
      if (info.kind === 'explosion' && dmg > 20) st.bleed = Math.min(4, st.bleed + 1);
    }
    return r;
  };

  /* ================================================================ searching */
  /* a container in a room: what its room would hold, rolled when it is first opened */
  const MODEL = { kitchen: 'czfridge', pharmacy: 'czmed', medical: 'czmed', workshop: 'cztool', garage: 'cztool', office: 'czdesk', police: 'czlocker', military: 'czlocker' };
  Object.assign(GAD.NAMES || {}, { czloot: 'Container' });
  const box = (g, x0, y0, z0, x1, y1, z1, c) => g.box(x0, y0, z0, x1, y1, z1, c);
  Object.assign(GAD.EXTRA, {
    czcrate: g => { box(g, -9, 0, -7, 9, 13, 7, 0x8a6a44); box(g, -9, 13, -7, 9, 13, 7, 0x6a4e30); box(g, -9, 6, -7.5, 9, 7, -7.5, 0x5a4026); },
    czfridge: g => { box(g, -8, 0, -7, 8, 30, 7, 0xdfe2e4); box(g, -8, 18, -7.5, 8, 18, -7.5, 0xa8acb0); box(g, 5, 8, -8, 6, 26, -8, 0x888c90); },
    czmed: g => { box(g, -8, 0, -6, 8, 22, 6, 0xe8ecee); box(g, -3, 14, -6.5, 3, 16, -6.5, 0xd83a3a); box(g, -1, 12, -6.5, 1, 18, -6.5, 0xd83a3a); },
    cztool: g => { box(g, -10, 0, -6, 10, 16, 6, 0xb83a2a); for (let y = 3; y < 16; y += 4) box(g, -9, y, -6.5, 9, y, -6.5, 0x7a2a1a); },
    czdesk: g => { box(g, -10, 0, -6, 10, 12, 6, 0x6a5a4a); box(g, -10, 12, -7, 10, 13, 7, 0x8a7a64); box(g, -8, 5, -6.5, -2, 7, -6.5, 0x3a3028); },
    czlocker: g => { box(g, -7, 0, -6, 7, 32, 6, 0x4a5a4a); box(g, -1, 2, -6.5, 0, 30, -6.5, 0x2a3a2a); box(g, 3, 16, -7, 4, 18, -7, 0xc8c8c8); },
    czbag: g => { box(g, -6, 0, -4, 6, 9, 4, 0x3a4a3a); box(g, -4, 9, -3, 4, 11, 3, 0x2a3a2a); },
    czstash: g => { box(g, -12, 0, -7, 12, 26, 7, 0x3a5a7a); box(g, -11, 2, -7.5, 11, 24, -7.5, 0x2a4a6a); box(g, 8, 12, -8, 9, 14, -8, 0xe0c060); },
    czbed: g => { box(g, -10, 0, -22, 10, 6, 22, 0x5a4a3a); box(g, -9, 6, -21, 9, 8, 21, 0x8a9aaa); box(g, -8, 8, -20, 8, 10, -14, 0xe8e8e8); },
    czbench: g => { box(g, -16, 0, -8, 16, 14, 8, 0x6a5a44); box(g, -16, 14, -9, 16, 15, 9, 0x8a7a5a); box(g, -10, 15, -4, -4, 18, 0, 0x5a5e64); box(g, 6, 15, -2, 12, 16, 4, 0x8a3a2a); },
    czradio: g => { box(g, -6, 0, -4, 6, 10, 4, 0x2a2e2a); box(g, -5, 2, -4.5, 1, 8, -4.5, 0x1a1a1a); box(g, 3, 5, -4.5, 4, 6, -4.5, 0x60f0a0); box(g, 4, 10, 0, 4, 22, 0, 0x8a8a8a); },
  });
  const CIRC = /Stairs|Corridor|Landing|Hall\b|Concourse|Arcade|Gallery|Platform|Mall\b|Court|Walk/;
  function rollLoot(table, k) {
    const T = CZ.LOOT[table] || CZ.LOOT.any, out = {}, rolls = Math.max(1, Math.round((1 + Math.random() * 2.2) * CZ.diff().loot * (k || 1)));
    let tot = 0; for (const r of T) tot += r[1];
    for (let i = 0; i < rolls; i++) {
      let x = Math.random() * tot, r = T[0]; for (const e of T) { x -= e[1]; if (x <= 0) { r = e; break; } }
      out[r[0]] = (out[r[0]] || 0) + r[2] + Math.floor(Math.random() * (r[3] - r[2] + 1));
    }
    return out;
  }
  CZ.rollLoot = rollLoot;
  function makeContainer(pos, id, label, model, items, table) {
    const e = new GAD.Ent('czloot', null, pos, { model, upright: true, yaw: Math.random() * 6.28, hp: 999, hitR: 0, melee: false, team: -1 });
    e.bulletproof = true; e.blastproof = true; e.meleeable = false; e.cid = id; e.label = label; e.items = items || null; e.table = table || 'any';
    return e;
  }
  CZ.spawnLoot = function (zid) {
    const st = CZ.zoneState(zid);
    st.left = st.left || {}; st.drops = st.drops || [];
    G.map.rooms.forEach((r, ri) => {
      if (CIRC.test(r.name) && Math.random() < 0.7) return;
      const table = CZ.lootTable(r.name), area = (r.x1 - r.x0) * (r.z1 - r.z0);
      const n = 1 + (area > 900 ? 1 : 0) + (area > 2400 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const id = ri + '_' + k; if (st.looted.includes(id)) continue;
        const p = NAV.randomIn(r); if (!p) continue;
        makeContainer(p, id, r.name, MODEL[table] || 'czcrate', st.left[id] || null, table);
      }
    });
    // packs and pockets left on the ground last time
    for (const d of st.drops) makeContainer(V().set(d.x, d.y, d.z), d.id, d.label, 'czbag', d.items);
    st.drops = [];
  };
  CZ.dropLoot = function (pos, list, label) {
    const items = {}; for (const [id, n] of list) items[id] = (items[id] || 0) + n;
    const n = NAV.nearest(pos, 3), p = n >= 0 ? NAV.nodePos(n) : pos.clone();
    return makeContainer(p, 'd' + Math.floor(Math.random() * 1e9), label || 'Dropped', 'czbag', items);
  };
  CZ.dropPack = function (a) {
    const m = a.cz.m, list = Object.entries(m.inv);
    for (const g of m.guns || []) if (g) list.push(['gun:' + g.id, 1]);
    m.inv = {}; m.guns = [];
    if (list.length) CZ.dropLoot(a.pos, list, m.name + "'s pack" + (list.some(([id]) => CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'quest') ? ' (something important)' : ''));
  };
  // what's left in a container, as words
  CZ.itemsText = items => Object.entries(items).map(([id, n]) => (n > 1 ? n + ' × ' : '') + CZ.itemName(id.startsWith('gun:') ? id.slice(4) : id)).join(', ');
  /* search a container: take what fits, leave the rest */
  CZ.loot = function (a, e) {
    if (!e.alive) return;
    if (!e.items) e.items = rollLoot(e.table);
    const m = a.cz.m, got = [];
    for (const [id, n] of Object.entries(e.items)) {
      const t = CZ.add(m, id, n);
      if (t > 0) { got.push((t > 1 ? t + ' × ' : '') + CZ.itemName(id.startsWith('gun:') ? id.slice(4) : id)); e.items[id] -= t; if (e.items[id] <= 0) delete e.items[id]; }
    }
    const st = CZ.zoneState(CZ.Z.id);
    if (!Object.keys(e.items).length) { e.destroy('used'); if (!String(e.cid).startsWith('d')) st.looted.push(e.cid); delete (st.left || {})[e.cid]; CZ.S.stats.looted++; }
    else if (!String(e.cid).startsWith('d')) (st.left || (st.left = {}))[e.cid] = e.items;
    if (a.isPlayer || a.net) {
      if (got.length) CZ.tell(a, '+ ' + got.join(', '), 'info'); else CZ.tell(a, Object.keys(e.items).length ? 'Too heavy to take any more' : 'Nothing useful', 'warn');
      if (Object.keys(e.items).length && got.length) CZ.tell(a, 'Left: ' + CZ.itemsText(e.items), 'warn');
      if (a.isPlayer) SFX.ui(520);
    }
    GAME.noise(a.pos, 6, a, 'step');
  };
  // dropped packs survive leaving the place
  const oSnapZone = CZ.snapZone;
  CZ.snapZone = function () {
    oSnapZone();
    const st = CZ.zoneState(CZ.Z.id); st.drops = [];
    for (const e of G.ents) if (e.alive && e.type === 'czloot' && String(e.cid).startsWith('d') && e.items && Object.keys(e.items).length) st.drops.push({ id: e.cid, x: e.pos.x, y: e.pos.y, z: e.pos.z, label: e.label, items: e.items });
  };
  /* a squad bot told to scavenge: the nearest container near the player nobody else is on */
  CZ.botLoot = function (a) {
    const p = G.player; let best = null, bd = 1e9;
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czloot' || U.dist3(e.pos, p.pos) > 26) continue;
      if (G.actors.some(b => b !== a && b.bot && b.bot.loot === e)) continue;
      const d = U.dist3(e.pos, a.pos); if (d < bd) { bd = d; best = e; }
    }
    if (!best) return null;
    a.bot.loot = best;
    return { pos: best.pos.clone(), kind: 'loot', r: 1.1, look: best.pos.clone().setY(best.pos.y + 0.5), act: x => { if (x.busy > 0 || !best.alive) return; x.busy = 1.4; setTimeout(() => { if (x.state === 'alive' && best.alive && CZ.on()) { CZ.loot(x, best); if (best.alive) best.claimFull = true; x.bot && (x.bot.loot = null); } }, 1300); } };
  };

  /* ================================================================ crafting */
  CZ.benchLevel = function (who) { const z = CZ.Z && CZ.Z.id; if (!z || !CZ.isSafe(z) || !atSafe(who || G.player)) return 0; const up = CZ.S.safe[z].up; return up.includes('bench2') ? 2 : up.includes('bench') ? 1 : 0; };
  CZ.canCraft = (r, who) => (r.bench || 0) <= CZ.benchLevel(who) && (!r.fire || CZ.benchLevel(who) > 0 || nearFire(who || G.player)) && CZ.haveAll(r.needs, CZ.sources(who));
  CZ.craft = function (rid, who) {
    const r = CZ.RECIPES.find(x => x.id === rid), p = who || G.player; if (!r || !p) return false;
    if (CZ.isGuest && CZ.isGuest()) { CZ.ask('craft', { rid }); return true; }
    if (!CZ.canCraft(r, p)) { CZ.tell(p, 'Missing something for that', 'warn'); return false; }
    CZ.spend(r.needs, CZ.sources(p));
    const got = CZ.add(p.cz.m, r.makes[0], r.makes[1]);
    if (got < r.makes[1]) { const stash = CZ.isSafe(CZ.Z.id) ? (CZ.S.stash[CZ.Z.id] || (CZ.S.stash[CZ.Z.id] = {})) : null; if (stash) stash[r.makes[0]] = (stash[r.makes[0]] || 0) + r.makes[1] - got; else CZ.dropLoot(p.pos, [[r.makes[0], r.makes[1] - got]], 'Crafted'); }
    CZ.S.stats.crafted++; SFX.wood(p.pos); p.busy = 1.5; p.busyLabel = 'CRAFTING';
    CZ.tell(p, 'Made ' + (r.makes[1] > 1 ? r.makes[1] + ' × ' : '') + CZ.itemName(r.makes[0]), 'info');
    return true;
  };

  /* ================================================================ safehouses */
  /* the spot a safehouse is run from: the biggest ground-floor room of the place's first building */
  function safeRoom() {
    const b = G.map.buildings[0];
    const rs = G.map.rooms.filter(r => r.x0 >= b.x0 && r.x1 <= b.x1 + 1 && r.z0 >= b.z0 && r.z1 <= b.z1 + 1 && r.L === 1 && !/Stairs/.test(r.name));
    rs.sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0));
    return rs[0] || G.map.rooms[0];
  }
  function atSafe(a) { return !!(a && CZ.Z && CZ.Z.safeRoom && G.map.buildings[0] && (() => { const b = G.map.buildings[0], x = a.pos.x * 4, z = a.pos.z * 4; return x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1; })()); }
  CZ.atSafe = atSafe;
  function fixtures(zid) {
    for (const e of G.ents) if (e.alive && e.czFix) e.destroy('silent');
    const r = CZ.Z.safeRoom, c = V().set((r.x0 + r.x1 + 1) / 8, r.y * VS, (r.z0 + r.z1 + 1) / 8);
    const put = (model, dx, dz, label) => { const n = NAV.nearest(c.clone().add(V().set(dx, 0, dz)), 6), p = n >= 0 ? NAV.nodePos(n) : c.clone(); const e = new GAD.Ent('czfix', null, p, { model, upright: true, yaw: 0, hp: 999, hitR: 0, melee: false, team: -1 }); e.bulletproof = true; e.blastproof = true; e.meleeable = false; e.czFix = model; e.label = label; return e; };
    const S = CZ.S, sf = S.safe[zid];
    if (!sf || !sf.up.includes('restore')) { put('czbench', 0, 0, 'RESTORE THE SAFEHOUSE'); return; }
    put('czstash', -2.2, 0, 'STASH'); put('czbed', 2.4, 0.5, 'SLEEP'); put('czbench', 0, -2.2, 'WORKBENCH');
    if (sf.up.includes('radio')) put('czradio', 0, 2.2, 'RADIO');
  }
  CZ.spawnSafe = function (zid) {
    CZ.Z.safeRoom = null;
    if (!CZ.ZONES[zid].safe) return;
    CZ.Z.safeRoom = safeRoom();
    fixtures(zid);
  };
  /* restore: boards over the main building's windows, a bed, a stash, a bench */
  CZ.restore = function (zid, who) {
    const src = CZ.sources(who);
    const need = CZ.SAFE_UP[0].needs;
    if (!CZ.haveAll(need, src)) { HUD.toast('Needs ' + Object.entries(need).map(([k, n]) => n + ' ' + CZ.itemName(k)).join(', '), 'warn'); return false; }
    CZ.spend(need, src);
    CZ.S.safe[zid] = { up: ['restore'], since: CZ.S.day };
    CZ.S.stash[zid] = CZ.S.stash[zid] || {};
    // board the windows of the safehouse building
    const b = G.map.buildings[0];
    for (const o of G.map.openings) if (o.kind === 'window' && o.ext && o.line * 1 >= 0) {
      const inB = o.axis === 'z' ? (o.line >= b.z0 && o.line <= b.z1 + 1 && o.a0 >= b.x0 && o.a1 <= b.x1 + 1) : (o.line >= b.x0 && o.line <= b.x1 + 1 && o.a0 >= b.z0 && o.a1 <= b.z1 + 1);
      if (!inB) continue;
      for (let y = o.y0; y <= o.y1; y++) for (let t = o.a0; t <= o.a1; t++) { if ((y + t) % 3 === 0) continue; const [x, z] = o.axis === 'z' ? [t, o.line] : [o.line, t]; const m = G.world.get(x, y, z); if (!m || m === DATA.M.GLASS) G.world.set(x, y, z, DATA.M.CZ_BOARD); }
    }
    const st = CZ.zoneState(zid); st.pop = Math.min(st.pop, 5);
    HUD.banner('SAFEHOUSE RESTORED', CZ.ZONES[zid].name + ': a bed, a stash and a bench', 3, 'win');
    CZ.fire('restore', zid);
    fixtures(zid); CZ.save(true);
    return true;
  };
  CZ.upgrade = function (zid, uid, who) {
    const src = CZ.sources(who);
    const u = CZ.SAFE_UP.find(x => x.id === uid), sf = CZ.S.safe[zid]; if (!u || !sf || sf.up.includes(uid)) return false;
    if (u.after && !sf.up.includes(u.after)) return false;
    if (!CZ.haveAll(u.needs, src)) { HUD.toast('Not enough materials', 'warn'); return false; }
    CZ.spend(u.needs, src); sf.up.push(uid);
    HUD.toast(u.name + ' built', 'info'); SFX.wood((who || CZ.leader() || G.player).pos);
    if (uid === 'walls') { const st = CZ.zoneState(zid); st.pop = Math.min(st.pop, 2); }
    fixtures(zid); CZ.save(true);
    return true;
  };
  /* sleep: until morning (or so many hours). Not with infected close */
  CZ.sleep = function (hours) {
    const p = CZ.leader() || G.player, near = G.actors.filter(a => a.cz && (a.cz.inf || a.cz.opx) && a.state === 'alive' && U.dist3(a.pos, p.pos) < 28);
    if (near.length) { HUD.toast("You can't sleep with them this close", 'warn'); return false; }
    const S = CZ.S, now = S.min;
    // "until morning" means 06:30, however long that is (it used to stop at 14 hours, which from a
    // daytime nap meant waking at one in the morning). Hours are slept half an hour at a time, and
    // anyone getting desperately hungry or thirsty wakes the squad early
    let mins = hours ? hours * 60 : CZ.toMorning();
    mins = Math.max(60, mins);
    let slept = 0, woke = null;
    while (slept < mins) {
      const step = Math.min(30, mins - slept);
      CZ.advance(step, 'sleep'); slept += step;
      const m = S.squad.find(x => x.alive && (x.st.thirst >= 95 || x.st.hunger >= 95));
      if (m && slept < mins) { woke = m; break; }
    }
    for (const a of G.actors) if (a.cz && a.cz.m && a.state === 'alive') { a.hp = Math.min(a.maxHp, a.cz.m.hp); a.resetKit && false; if (a.gadget) a.gadget.count = Math.max(a.gadget.count, (DATA.GADGETS[a.gadget.id] || {}).count || a.gadget.count); if (a.ability && a.op.ability) a.ability.count = a.op.ability.count; }
    HUD.banner('DAY ' + S.day + ' · ' + CZ.clock(), woke ? 'Woken after ' + Math.round(slept / 60) + ' h: ' + DATA.OPMAP[woke.op].name + ' is too ' + (woke.st.thirst >= 95 ? 'thirsty' : 'hungry') + ' to sleep' : 'You slept ' + Math.round(slept / 60) + ' hours', 3);
    if (CZ.ui) CZ.ui.fade();
    CZ.save(true);
    return true;
  };
  /* minutes from now to 06:30 (the next one) */
  CZ.toMorning = () => { const m = (6.5 * 60 - CZ.S.min + 1440) % 1440; return m || 1440; };
  /* what safehouses make each day, and what their people do */
  CZ.dailySafe = function () {
    const S = CZ.S;
    for (const [z, sf] of Object.entries(S.safe)) {
      if (!sf.up.includes('restore')) continue;
      const stash = S.stash[z] || (S.stash[z] = {}), add = (id, n) => { stash[id] = (stash[id] || 0) + n; };
      if (sf.up.includes('water')) add('water', 2);
      const ppl = (S.survivors || []).filter(s => s.home === z && s.state === 'home');
      if (sf.up.includes('garden')) add('apple', 2 + ppl.filter(s => s.skill === 'farmer').length * 3);
      for (const s of ppl) {
        if (s.skill === 'scavenger') { const T = CZ.LOOT.any; const r = T[Math.floor(Math.random() * T.length)]; add(r[0], r[2]); }
        if (s.skill === 'cook' && (stash.beans || 0) > 0 && (stash.water || 0) > 0) { stash.beans--; stash.water--; add('stew', 2); }
        if (s.skill === 'mechanic') add('fuel', Math.random() < 0.4 ? 1 : 0);
        // everyone there eats
        const food = ['stew', 'apple', 'beans', 'soup', 'mre', 'bar'].find(id => (stash[id] || 0) > 0);
        if (food) { stash[food]--; s.hungry = 0; } else s.hungry = (s.hungry || 0) + 1;
        if (s.hungry >= 3) { s.state = 'left'; HUD.toast(s.name + ' left ' + CZ.ZONES[z].name + ': there was no food', 'warn'); }
      }
    }
  };

  /* ================================================================ interactions */
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.cz || !a.cz.m) return;
    const eye = a.pos.clone().setY(a.pos.y + 0.6);
    for (const e of G.ents) {
      if (!e.alive || U.dist3(e.pos, eye) > 1.7) continue;
      if (e.type === 'czloot') { out.push({ kind: 'search', label: 'SEARCH · ' + String(e.label).toUpperCase(), time: e.items ? 0.6 : 1.4, ok: () => e.alive, run: () => CZ.loot(a, e) }); return; }
      if (e.type === 'czfix' && a.isPlayer && !GAME.client) {
        const z = CZ.Z.id;
        if (e.czFix === 'czbench' && !CZ.isSafe(z)) { const n = CZ.SAFE_UP[0].needs; out.push({ kind: 'safe', label: 'RESTORE THE SAFEHOUSE · ' + Object.entries(n).map(([k, v]) => v + ' ' + CZ.itemName(k)).join(', '), time: 3, ok: () => true, run: () => CZ.restore(z) }); return; }
        if (e.czFix === 'czstash') { out.push({ kind: 'safe', label: 'OPEN THE STASH', time: 0.3, ok: () => true, run: () => CZ.ui && CZ.ui.inventory('stash') }); return; }
        if (e.czFix === 'czbed') { out.push({ kind: 'safe', label: 'SLEEP UNTIL MORNING', time: 1, ok: () => true, run: () => CZ.ui ? CZ.ui.sleepMenu() : CZ.sleep() }); return; }
        if (e.czFix === 'czbench') { out.push({ kind: 'safe', label: 'WORKBENCH · CRAFT AND BUILD', time: 0.3, ok: () => true, run: () => CZ.ui && CZ.ui.inventory('craft') }); return; }
        if (e.czFix === 'czradio') { out.push({ kind: 'safe', label: 'LISTEN TO THE RADIO', time: 1, ok: () => true, run: () => CZ.radio && CZ.radio() }); return; }
      }
    }
  });
})();
