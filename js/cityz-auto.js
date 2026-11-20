/* cityz-auto.js -- City Z: the squad's own judgement. Every AI member of the squad (whether you play
   alongside them or only watch):

     looks after itself   treats bleeding, breaks, wounds and infection; eats and drinks; crafts a
                          dressing or a splint from its own pack when it has none; switches to its
                          other gun when one runs dry
     looks after others   hands what it can spare (a dressing, food, water, rounds of the right
                          calibre) to a teammate who needs it, you included, and treats wounds itself
     asks                 says what it needs and shows it on the squad list when nobody can give it
     scavenges            goes through nearby rooms of the right kind for what is missing (kitchens
                          for food, medical rooms for dressings, police and army rooms for rounds),
                          and picks over containers close by when things are quiet
     fights smart         throws a molotov or a pipe bomb into a pack of infected

   Watching (CZ.watching), the squad's leader also plays the campaign: it follows the objective
   markers (things, people, roads), restores and builds at safehouses, sleeps there when the squad is
   worn out, loots each place and moves on. Conversations answer themselves. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const FOOD = ['stew', 'mre', 'beans', 'soup', 'bar', 'apple', 'crisps', 'dogfood'];
  const DRINK = ['water', 'soda', 'coffee', 'dirtywater'];
  const NEED = {
    bleed: { ids: ['bandage', 'rag', 'medkit'], craft: ['bandage', 'rag'], word: 'a dressing', tables: ['medical', 'pharmacy', 'home'], treat: true },
    fracture: { ids: ['splint', 'medkit', 'painkillers'], craft: ['splint'], word: 'a splint', tables: ['medical', 'workshop', 'store'], treat: true },
    hurt: { ids: ['medkit', 'painkillers', 'bandage'], word: 'medical supplies', tables: ['medical', 'pharmacy', 'home'], treat: true },
    infection: { ids: ['antiviral', 'antibiotics'], word: 'antibiotics', tables: ['pharmacy', 'medical'], treat: true },
    thirst: { ids: DRINK, word: 'water', tables: ['kitchen', 'shop', 'store'] },
    hunger: { ids: FOOD, word: 'food', tables: ['kitchen', 'shop', 'store', 'farm'] },
    ammo: { word: 'ammunition', tables: ['police', 'military', 'home', 'office'] },
  };
  const squad = () => G.actors.filter(a => a.cz && a.cz.m && a.state !== 'dead');
  const fighting = a => a.bot && a.bot.target && a.bot.target.state === 'alive' && G.time - (a.bot.seenT || -99) < 4;
  const calOf = a => CZ.calOf((a.w[0] || {}).id || 'p10');
  const rounds = (m, a) => { let n = 0; const seen = new Set(); for (const w of a.w) { const c = CZ.calOf(w.id); if (seen.has(c)) continue; seen.add(c); n += m.inv[c] || 0; } return n + a.w.reduce((t, w) => t + (w.mag || 0), 0); };

  /* what someone needs, most urgent first */
  function needsOf(a) {
    const m = a.cz.m, st = m.st, out = [];
    if (st.bleed > 0) out.push('bleed');
    if (st.fracture && !(st.pain > 0)) out.push('fracture');
    if (a.hp < 45) out.push('hurt');
    if (st.infection > 45) out.push('infection');
    if (st.thirst > 60) out.push('thirst');
    if (st.hunger > 65) out.push('hunger');
    const mag = (a.w[0] && a.w[0].def.mag) || 20;
    if (rounds(m, a) < mag) out.push('ammo');
    return out;
  }
  CZ.needsOf = needsOf;
  /* the item in a pack that answers a need (the last resorts only when it is bad) */
  function itemIn(m, need, a) {
    if (need === 'ammo') { const c = calOf(a); return (m.inv[c] || 0) > 0 ? c : null; }
    const st = m.st;
    return NEED[need].ids.find(id => (m.inv[id] || 0) > 0 && !(id === 'dirtywater' && st.thirst < 88) && !(id === 'dogfood' && st.hunger < 85) && !(id === 'painkillers' && need === 'fracture' && (m.inv.splint || 0) > 0));
  }
  /* can it be spared? (keep one for yourself unless you have plenty) */
  function spare(m, id, giver, need, t) {
    const n = m.inv[id] || 0; if (!n) return 0;
    // food and water: one to spare goes freely; the last one goes to someone clearly worse off, or to
    // anyone close to starving (unless the giver is just as close)
    if (need === 'hunger' || need === 'thirst') {
      if (n > 1) return 1;
      const gs = giver.cz.m.st[need] || 0, ts = t && t.cz ? t.cz.m.st[need] || 0 : 0;
      return (ts >= 80 && gs < 85) || ts - gs >= 20 ? 1 : 0;
    }
    if ((need === 'bleed' || need === 'hurt') && NEED.bleed.ids.includes(id)) return giver.cz.m.st.bleed > 0 && n < 2 ? 0 : 1;
    if (CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'ammo') { const keep = giver.w.some(w => CZ.calOf(w.id) === id) ? ((giver.w[0] && giver.w[0].def.mag) || 20) * 2 : 0; return Math.max(0, Math.min(n - keep, 60)); }
    return n > 1 || !needsOf(giver).length ? 1 : 0;
  }

  /* treat someone else: the giver's item, its effect on them */
  CZ.treat = function (giver, t, id) {
    const it = CZ.ITEMS[id]; if (!it || !it.use || t.czTendT > G.time || !CZ.take(giver.cz.m, id, 1)) return false;
    const u = it.use, st = t.cz.m.st; t.czTendT = G.time + 2.5;
    giver.busy = 2.2; giver.busyLabel = 'TREATING';
    setTimeout(() => {
      if (t.state === 'dead') return;
      if (u.bleed) st.bleed = Math.max(0, st.bleed + u.bleed);
      if (u.fracture) st.fracture = false;
      if (u.infection) st.infection = Math.max(0, st.infection + u.infection);
      if (u.pain) st.pain = u.pain;
      if (u.hp) t.heal(u.hp);
      t.cz.m.hp = t.hp;
      CZ.tell(t, giver.op.name + ' used ' + it.name + ' on you', 'info');
    }, 2000);
    return true;
  };
  /* the last resort for a wound with nothing to dress it: a strip torn from your clothes and pressed
     on it. It stops the bleeding altogether (no light bleed left over), takes longer than a bandage, and can't be done again
     by the same hands for a minute */
  CZ.IMPROV_CD = 60;
  CZ.canImprovise = giver => G.time > (giver.czImprovT || 0);
  CZ.improvise = function (giver, t) {
    t = t || giver;
    if (!t.cz || !t.cz.m || !(t.cz.m.st.bleed > 0) || giver.busy > 0 || !CZ.canImprovise(giver) || t.czTendT > G.time) return false;
    giver.czImprovT = G.time + CZ.IMPROV_CD; giver.busy = 3; giver.busyLabel = 'IMPROVISING A DRESSING'; t.czTendT = G.time + 3.5;
    setTimeout(() => {
      if (t.state === 'dead' || giver.state === 'dead') return;
      const st = t.cz.m.st; st.bleed = 0;
      CZ.tell(t, t === giver ? 'You tore a strip from your clothes and stopped the bleeding' : giver.op.name + ' pressed a torn strip on your wound', 'info');
    }, 2700);
    return true;
  };
  /* a dressing from the safehouse stash, when the stash is right here */
  function fromStash(a, need) {
    const z = CZ.Z && CZ.Z.id; if (!z || !CZ.isSafe(z) || !CZ.atSafe || !CZ.atSafe(a)) return null;
    const st = CZ.S.stash[z] || {}, id = NEED[need].ids.find(x => (st[x] || 0) > 0);
    if (!id) return null;
    st[id]--; if (st[id] <= 0) delete st[id];
    a.cz.m.inv[id] = (a.cz.m.inv[id] || 0) + 1;
    return id;
  }
  /* craft something from one's own pack (a bot making a dressing or a splint) */
  function craftOwn(a, rid) {
    const r = CZ.RECIPES.find(x => x.id === rid); if (!r || (r.bench || 0) > 0) return false;
    const m = a.cz.m;
    if (!Object.entries(r.needs).every(([k, n]) => (m.inv[k] || 0) >= n)) return false;
    for (const [k, n] of Object.entries(r.needs)) CZ.take(m, k, n);
    m.inv[r.makes[0]] = (m.inv[r.makes[0]] || 0) + r.makes[1]; a.busy = 1.5; a.busyLabel = 'CRAFTING';
    return true;
  }
  const say = (a, key, lines, pri) => { if (window.VOICE) VOICE.say(a, key, lines, pri || 2); };

  /* ================================================================ the care tick (every AI member) */
  CZ.botCare = function (a, dt) {
    if ((a.czCareT = (a.czCareT || 0) - dt) > 0) return;
    a.czCareT = 1.5;
    if (a.busy > 0 || a.state !== 'alive') return;
    const m = a.cz.m, needs = needsOf(a), hot = fighting(a);
    // a dry gun: the other one
    if (a.w[a.cur] && a.w[a.cur].mag <= 0 && a.w[a.cur].reserve <= 0) { const o = a.w.findIndex((w, i) => i !== a.cur && (w.mag > 0 || w.reserve > 0)); if (o >= 0) WPN.swap(a, o); }
    a.czNeed = null;
    for (const need of needs) {
      if (hot && need !== 'bleed' && !(need === 'hurt' && a.hp < 25)) continue;   // in a fight only what can't wait (a wound can't)
      const id = itemIn(m, need, a) || (need !== 'ammo' && fromStash(a, need));
      if (id && need !== 'ammo') { CZ.use(a, id, true); if (Math.random() < 0.3) say(a, 'self', need === 'bleed' ? ['Patching myself up.', 'Bandaging.'] : need === 'thirst' ? ['Drinking.'] : need === 'hunger' ? ['Eating something quick.'] : ['Treating it.']); return; }
      if (need === 'ammo' && id) continue;
      if (NEED[need].craft && NEED[need].craft.some(rid => craftOwn(a, rid))) return;
      if (need === 'bleed') {
        // nothing to dress it with: a teammate has a few seconds to bring something; then the last resort
        a.czBleedSince = a.czBleedSince || G.time;
        const bad = m.st.bleed >= 2 || a.hp < 55, waited = G.time - a.czBleedSince > (bad ? 4 : 10);
        if ((waited || hot) && CZ.improvise(a)) { a.czBleedSince = 0; say(a, 'self', ['Tearing my sleeve for this.', 'Pressing on it. Hold on.'], 3); return; }
      }
      a.czNeed = a.czNeed || need;
    }
    if (!m.st.bleed) a.czBleedSince = 0;
    // ask for what it can't sort out itself
    if (a.czNeed && G.time > (a.czAskT || 0)) {
      a.czAskT = G.time + 45;
      const w = a.czNeed === 'ammo' ? CZ.itemName(calOf(a)) : NEED[a.czNeed].word;
      say(a, 'ask', a.czNeed === 'ammo' ? ["I'm almost out. Need " + w + '.', 'Low on ammo!'] : a.czNeed === 'bleed' ? ["I'm bleeding, anyone got " + w + '?', 'Need a bandage here!'] : ['I need ' + w + '.', 'Anyone got ' + w + '?'], 3);
      const p = G.player; if (p && !p.ghost && p.cz) CZ.tell(p, a.op.name + ' needs ' + w + (p.state === 'alive' ? ' · give it from your pack (' + KEYS.name('czInv') + ')' : ''), 'warn');
    }
    // and help: the nearest teammate (you too) with a need this one can answer
    if (hot || a.czGiveT > G.time) return;
    for (const t of squad()) {
      // someone starving or bleeding badly is worth going further for
      const ts = t.cz.m.st, urgent = ts.hunger >= 80 || ts.thirst >= 80 || ts.bleed >= 2;
      if (t === a || U.dist3(t.pos, a.pos) > (urgent ? 40 : 16) || t.czTendT > G.time || (t.busy > 0 && /IMPROVISING|TREATING/.test(t.busyLabel || ''))) continue;
      for (const need of needsOf(t)) {
        let id = need === 'ammo' ? calOf(t) : itemIn(m, need, t);
        if (!id && need === 'bleed' && craftOwn(a, 'rag')) id = 'rag';
        if (!id && need === 'bleed' && (t.cz.m.st.bleed >= 2 || t.hp < 55) && CZ.canImprovise(a) && !(t.bot && CZ.canImprovise(t))) {
          a.czGiveT = G.time + 6;
          a.bot.tasks.unshift({ at: t.pos.clone(), time: 0.4, run: x => { if (t.state !== 'dead' && U.dist3(t.pos, x.pos) < 4 && CZ.improvise(x, t)) say(x, 'give', ['Hold still, pressing on it.', "I've got you."], 3); } });
          return;
        }
        if (!id) continue;
        const n = spare(m, id, a, need, t);
        if (!n) continue;
        a.czGiveT = G.time + 8;
        a.bot.tasks.unshift({ at: t.pos.clone(), time: 0.6, run: x => {
          if (t.state === 'dead' || U.dist3(t.pos, x.pos) > 4) return;
          if (NEED[need].treat && t.state !== 'dead') CZ.treat(x, t, id);
          else { const g = CZ.add(t.cz.m, id, n); CZ.take(x.cz.m, id, g); if (g) CZ.tell(t, x.op.name + ' gave you ' + (g > 1 ? g + ' × ' : '') + CZ.itemName(id), 'info'); }
          say(x, 'give', ['Here, take this.', 'Got you.', 'Catch.'], 2);
        } });
        return;
      }
    }
  };

  /* ================================================================ scavenging */
  /* a container to go through: near the leader, not someone else's, of a kind that has what is needed */
  function pickContainer(a, need, range) {
    const lead = CZ.leader() || a, want = need && NEED[need] ? NEED[need].tables : null;
    let best = null, bs = 1e9;
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czloot' || U.dist3(e.pos, lead.pos) > range || Math.abs(e.pos.y - lead.pos.y) > 7) continue;
      if (G.actors.some(b => b !== a && b.bot && b.bot.loot === e)) continue;
      let s = U.dist3(e.pos, a.pos);
      if (want && !want.includes(e.table)) s += 25;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  function lootGoal(a, e, then) {
    a.bot.loot = e;
    return { pos: e.pos.clone(), kind: 'loot', r: 1.1, look: e.pos.clone().setY(e.pos.y + 0.5), act: x => {
      if (x.busy > 0 || !e.alive) { if (!e.alive) x.bot.loot = null; return; }
      x.busy = 1.3; x.busyLabel = 'SEARCHING';
      setTimeout(() => { if (x.state === 'alive' && e.alive && CZ.on()) CZ.loot(x, e); if (x.bot) x.bot.loot = null; x.czCareT = 0; if (then) then(x); }, 1200);
    } };
  }
  /* in the follow order: go and find what is missing, or pick over what is close when it is quiet */
  CZ.forageGoal = function (a) {
    if (fighting(a) || CZ.S.order === 'quiet' || CZ.S.order === 'hold') return null;
    if (a.bot.loot && a.bot.loot.alive) return lootGoal(a, a.bot.loot);
    const lead = CZ.leader(); if (!lead || lead === a) return null;
    const calm = !G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 18);
    if (!calm) return null;
    if (a.czNeed && !squad().some(t => t !== a && itemIn(t.cz.m, a.czNeed, a))) { const e = pickContainer(a, a.czNeed, 30); if (e) return lootGoal(a, e); }
    if (G.time > (a.czPickT || 0) && CZ.weight(a.cz.m) < CZ.capacity(a.cz.m) * 0.75) {
      a.czPickT = G.time + 20 + Math.random() * 20;
      const e = pickContainer(a, null, 12); if (e) return lootGoal(a, e);
    }
    return null;
  };
  // squad goals: scavenging comes before falling in behind the leader
  const oGoal = CZ.squadGoal;
  CZ.squadGoal = function (a) {
    const lead = CZ.leader();
    if (a !== lead && CZ.S.order === 'follow') { const g = CZ.forageGoal(a); if (g) return g; }
    return oGoal.apply(this, arguments);
  };

  /* ================================================================ fighting smart */
  /* a pack of infected 6-20 m off: a molotov or a pipe bomb into it */
  function throwAtPack(a) {
    if (!fighting(a) || a.busy > 0 || G.time < (a.czThrowT || 0)) return;
    const m = a.cz.m, id = ['pipebomb', 'molotov'].find(t => (m.inv[t] || 0) > 0); if (!id) return;
    const inf = G.actors.filter(t => t.cz && t.cz.inf && t.state === 'alive');
    for (const c of inf) {
      const d = U.dist3(c.pos, a.pos); if (d < 6 || d > 20) continue;
      const near = inf.filter(t => U.dist3(t.pos, c.pos) < 4);
      if (near.length < 3 || squad().some(t => U.dist3(t.pos, c.pos) < 5)) continue;
      a.czThrowT = G.time + 10;
      a.yaw = Math.atan2(-(c.pos.x - a.pos.x), -(c.pos.z - a.pos.z)); a.pitch = Math.atan2(4, d) * 0.5;
      CZ.throwItem(a); say(a, 'throw', id === 'molotov' ? ['Burn!', 'Fire out!'] : ['Pipe bomb!', 'Clear out!'], 3);
      return;
    }
  }
  OPS2.chain('tick', function (a, dt) {
    if (!CZ.on() || !a.bot || !a.cz || !a.cz.m || GAME.client) return false;
    if ((a.czThrowChk = (a.czThrowChk || 0) - dt) <= 0) { a.czThrowChk = 0.7; throwAtPack(a); }
    return false;
  });

  /* ================================================================ the leader, watching */
  function inPlace() { const t = CZ.targets ? CZ.targets() : []; const lead = CZ.leader(); if (!lead) return null; t.sort((p, q) => U.dist3(p.p, lead.pos) - U.dist3(q.p, lead.pos)); return t[0] || null; }
  function exitTo(zone) { const side = CZ.exitsOf(CZ.Z.id)[zone]; return side ? CZ.Z.exits.find(e => e.side === side) : null; }
  function roadGoal(a, zone) {
    const e = exitTo(zone); if (!e) return null;
    const p = V().set(e.x, e.y, e.z), n = NAV.nearest(p, 6);
    return { pos: n >= 0 ? NAV.nodePos(n) : p, kind: 'road', r: 2.5, act: () => { if (CZ.Z && !CZ.Z.leaving) { CZ.Z.leaving = true; HUD.toast('The squad heads for ' + CZ.ZONES[zone].name, 'info'); setTimeout(() => CZ.on() && CZ.travel(zone), 600); } } };
  }
  function fixGoal(a, kind, act) {
    const e = G.ents.find(x => x.alive && x.czFix === kind); if (!e) return null;
    const n = NAV.nearest(e.pos, 4);
    return { pos: n >= 0 ? NAV.nodePos(n) : e.pos.clone(), kind: 'fix', r: 1.4, look: e.pos.clone(), act: x => { if (x.busy > 0 || G.time < (x.czActT || 0)) return; x.czActT = G.time + 3; act(x); } };
  }
  CZ.autoGoal = function (a) {
    if (!CZ.watching) return null;
    const S = CZ.S, here = CZ.Z.id, Z = CZ.Z;
    Z.autoT = (Z.autoT || 0);
    if (fighting(a)) return null;   // the bot's own fighting first
    // its own needs first: scavenge for them
    if (a.czNeed && !squad().some(t => t !== a && itemIn(t.cz.m, a.czNeed, a))) { const e = pickContainer(a, a.czNeed, 40); if (e) return lootGoal(a, e); }
    // a safehouse: restore it, build what the story wants, sleep when the squad is worn out
    if (CZ.ZONES[here].safe && !CZ.isSafe(here) && CZ.haveAll(CZ.SAFE_UP[0].needs, CZ.sources(a))) { const g = fixGoal(a, 'czbench', x => CZ.restore(here, x)); if (g) return g; }
    if (CZ.isSafe(here)) {
      const tired = squad().reduce((t, x) => t + x.cz.m.st.fatigue, 0) / Math.max(1, squad().length);
      const hurt = squad().some(x => x.hp < 50);
      if ((tired > 70 || (CZ.night() && tired > 35) || (hurt && CZ.night())) && G.time > (Z.sleptT || 0)) { const g = fixGoal(a, 'czbed', () => { Z.sleptT = G.time + 120; CZ.sleep(); }); if (g) return g; }
      const sf = S.safe[here];
      if (!sf.up.includes('radio') && CZ.haveAll(CZ.SAFE_UP.find(u => u.id === 'radio').needs, CZ.sources(a))) { const g = fixGoal(a, 'czbench', x => CZ.upgrade(here, 'radio', x)); if (g) return g; }
      for (const u of CZ.SAFE_UP.slice(1)) if (!sf.up.includes(u.id) && (!u.after || sf.up.includes(u.after)) && u.id !== 'radio' && CZ.haveAll(u.needs, CZ.sources(a))) { const g = fixGoal(a, 'czbench', x => CZ.upgrade(here, u.id, x)); if (g) return g; }
    }
    // the objective
    const t = inPlace();
    if (t) {
      if (t.road) return roadGoal(a, t.road);
      const box = G.ents.find(e => e.alive && e.type === 'czloot' && e.pos === t.p); if (box) return lootGoal(a, box);
      const who = G.actors.find(x => x.pos === t.p && x.cz && x.cz.person);
      if (who) return { pos: who.pos.clone(), kind: 'talk', r: 1.8, look: who.eye(V()), act: () => { if (G.time < (Z.talkT || 0) || (CZ.ui && CZ.ui.isOpen())) return; Z.talkT = G.time + 8; const o = who.cz.person; if (o.talk) o.talk(who); } };
      const fx = G.ents.find(e => e.alive && e.czFix && e.pos === t.p);
      if (fx && fx.czFix === 'uplink') return fixGoal(a, 'uplink', () => { if (!(CZ.ui && CZ.ui.isOpen()) && CZ.finale) CZ.finale(); });
      if (fx && fx.czFix === 'czbench' && CZ.isSafe(here) && CZ.haveAll(CZ.SAFE_UP.find(u => u.id === 'radio').needs, CZ.sources(a))) return fixGoal(a, 'czbench', x => CZ.upgrade(here, 'radio', x));
    }
    // otherwise: go through the place, then move on
    Z.autoT += 1;
    const box = pickContainer(a, null, 70);
    if (box && Z.t < 420) return lootGoal(a, box);
    // on toward the objective's place, or somewhere not seen yet
    const st = CZ.objective && CZ.objective(), goal = st && st.zone;
    let next = goal && goal !== here ? CZ.routeTo(here, goal) : null;
    if (!next) { const ns = Object.keys(CZ.ZONES[here].links); next = ns.find(z => !S.visited.includes(z)) || ns[Math.floor(Math.random() * ns.length)]; }
    return roadGoal(a, next);
  };
})();
