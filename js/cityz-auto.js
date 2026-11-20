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
  const FOOD = ['stew', 'mre', 'beans', 'soup', 'bar', 'apple', 'choc', 'crisps', 'oldtin', 'dogfood'];
  const DRINK = ['water', 'soda', 'coffee', 'dirtywater'];
  // things that might make you sick: only when there's nothing else, unless you know no better
  const RISKY = id => { const u = CZ.ITEMS[id] && CZ.ITEMS[id].use; return !!(u && u.sick > 0); };
  // who they are decides what they do (cityz-people.js); without it, they just do it
  const decide = (a, kind, sev, t) => CZ.decide ? CZ.decide(a, kind, sev, t) : true;
  const th = (a, k, d) => CZ.th ? CZ.th(a, k, d) : d;
  const P = a => CZ.P ? CZ.P(a) : null;
  const orderOf = a => CZ.orderOf ? CZ.orderOf(a) : CZ.S.order;
  const KIND = { hunger: 'eat', thirst: 'drink', bleed: 'treat', fracture: 'treat', hurt: 'treat', infection: 'treat', sick: 'treat' };
  const NEED = {
    bleed: { ids: ['bandage', 'rag', 'medkit'], craft: ['bandage', 'rag'], word: 'a dressing', tables: ['medical', 'pharmacy', 'home'], treat: true },
    fracture: { ids: ['splint', 'medkit', 'painkillers'], craft: ['splint'], word: 'a splint', tables: ['medical', 'workshop', 'store'], treat: true },
    hurt: { ids: ['medkit', 'painkillers', 'bandage'], word: 'medical supplies', tables: ['medical', 'pharmacy', 'home'], treat: true },
    infection: { ids: ['antiviral', 'antibiotics'], word: 'antibiotics', tables: ['pharmacy', 'medical'], treat: true },
    sick: { ids: ['antibiotics'], word: 'something for my stomach', tables: ['pharmacy', 'medical'], treat: true },
    thirst: { ids: DRINK, word: 'water', tables: ['kitchen', 'shop', 'store'] },
    hunger: { ids: FOOD, word: 'food', tables: ['kitchen', 'shop', 'store', 'farm'] },
    ammo: { word: 'ammunition', tables: ['police', 'military', 'home', 'office'] },
    fatigue: { ids: ['coffee'], word: 'sleep', tables: ['kitchen', 'office'] },
    cold: { ids: ['jacket', 'raincoat', 'firewood', 'stew'], word: 'something warm', tables: ['home', 'shop', 'store', 'farm'] },
  };
  const squad = () => G.actors.filter(a => a.cz && a.cz.m && a.state !== 'dead');
  const fighting = a => a.bot && a.bot.target && a.bot.target.state === 'alive' && G.time - (a.bot.seenT || -99) < 4;
  const calOf = a => CZ.calOf((a.w[0] || {}).id || 'p10');
  const rounds = (m, a) => { let n = 0; const seen = new Set(); for (const w of a.w) { const c = CZ.calOf(w.id); if (seen.has(c)) continue; seen.add(c); n += m.inv[c] || 0; } return n + a.w.reduce((t, w) => t + (w.mag || 0), 0); };

  /* what someone needs, most urgent first: by their own limits (when hunger, a wound or the cold
     becomes something they act on is theirs, and moves from day to day) */
  function needsOf(a) {
    const m = a.cz.m, st = m.st, out = [];
    if (st.bleed > 0) out.push('bleed');
    if (st.fracture && !(st.pain > 0)) out.push('fracture');
    if (a.hp < th(a, 'hurt', 45)) out.push('hurt');
    if (st.infection > th(a, 'infection', 30)) out.push('infection');   // from 30 it grows by itself
    if (st.sick > 25) out.push('sick');
    if (st.thirst > th(a, 'thirst', 60)) out.push('thirst');
    if (st.hunger > th(a, 'hunger', 65)) out.push('hunger');
    // rounds for the main gun (in the pack and in the magazines): short at under two magazines' worth,
    // so it is sorted out before the gun runs dry
    const mag = (a.w[0] && a.w[0].def.mag) || 20;
    if (calRounds(a, calOf(a)) < mag * 2) out.push('ammo');
    if (st.fatigue > th(a, 'fatigue', 70)) out.push('fatigue');   // tired: rest (or coffee, or a bed) before it's exhaustion
    if (st.temp < coldAt(a)) out.push('cold');   // getting cold: warm up before hypothermia (35.5); sooner out in a cold, wet night
    return out;
  }
  CZ.needsOf = needsOf;
  const coldAt = a => th(a, 'cold', 36.2) + (exposed(a) ? 0.3 : 0);
  /* how bad a need is, 0..1 */
  function sevOf(a, need) {
    const st = a.cz.m.st, over = (v, t) => U.clamp((v - t) / Math.max(5, 100 - t), 0, 1);
    switch (need) {
      case 'bleed': return Math.min(1, 0.45 + st.bleed * 0.18 + (a.hp < 50 ? 0.2 : 0));
      case 'fracture': return 0.55;
      case 'hurt': return U.clamp((60 - a.hp) / 50, 0.1, 1);
      case 'infection': return over(st.infection, 25);
      case 'sick': return U.clamp(st.sick / 80, 0.1, 1);
      case 'thirst': return over(st.thirst, th(a, 'thirst', 60) - 5);
      case 'hunger': return over(st.hunger, th(a, 'hunger', 65) - 5);
      case 'fatigue': return over(st.fatigue, th(a, 'fatigue', 70) - 5);
      case 'cold': return U.clamp((coldAt(a) - st.temp) / 1.2, 0.05, 1);
      case 'ammo': { const mag = (a.w[0] && a.w[0].def.mag) || 20; return U.clamp(1 - calRounds(a, calOf(a)) / (mag * 2), 0, 1); }
    }
    return 0.5;
  }
  CZ.sevOf = sevOf;
  /* the item in a pack that answers a need (the last resorts only when it is bad) */
  function itemIn(m, need, a) {
    if (need === 'ammo') { const c = calOf(a); return (m.inv[c] || 0) > 0 ? c : null; }
    if (need === 'infection') { const inf = a && a.cz ? a.cz.m.st.infection : 50, order = inf >= 60 ? ['antiviral', 'antibiotics'] : ['antibiotics', 'antiviral']; return order.find(id => (m.inv[id] || 0) > 0) || null; }
    const iron = a && CZ.has && CZ.has(a, 'ironstomach');
    return NEED[need].ids.find(id => (m.inv[id] || 0) > 0 && (iron || !RISKY(id)) && !(id === 'painkillers' && need === 'fracture' && (m.inv.splint || 0) > 0));
  }
  /* the last resort for hunger or thirst: something that might make them ill */
  const riskyIn = (m, need) => (NEED[need].ids || []).find(id => RISKY(id) && (m.inv[id] || 0) > 0) || null;
  /* will they hand it over? Who they are, how bad it is, rolled now and then (and remembered for a
     while, so a refusal is a refusal). The generous sometimes give away their own last one */
  function willGive(a, t, need, base) {
    const p = P(a); if (!p) return base;
    const k = t.id + ':' + need, memo = a.czWill || (a.czWill = {});
    if (!memo[k] || memo[k].until < G.time) {
      const sev = sevOf(t, need);
      let v = 0;
      if (base > 0) v = decide(a, NEED[need] && NEED[need].treat ? 'help' : 'share', sev, t) ? 1 : 0;
      else if (CZ.relOf && CZ.relOf(a, t) < -30) v = 0;   // (nobody gives their last one to someone they can't stand)
      else if (need !== 'ammo' && need !== 'cold' && p.t.gen > 0.75 && !p.flaws.includes('hoarder') && Math.random() < (p.t.gen - 0.7) * 1.6 * (0.4 + sev)) v = 2;
      memo[k] = { v, until: G.time + 15 + Math.random() * 30 };
      if (v === 0 && base > 0) CZ.fire('refused', a, t, need);
      const rel = CZ.relOf ? CZ.relOf(a, t) : 0, gr = CZ.grudgeOf ? CZ.grudgeOf(a, t) : null;
      if (v === 0 && base > 0 && rel < -40 && (t.isPlayer || Math.random() < 0.5)) say(a, 'refuse', ['Not you. Not after ' + (gr || 'everything') + '.', 'Ask someone who likes you.', 'You? Get it yourself.'], 3);
      else if (v === 0 && base > 0 && (t.isPlayer || Math.random() < 0.3)) say(a, 'refuse', p.flaws.includes('hoarder') || p.t.gen < 0.25 ? ["Not mine to give. Well. It is. And I'm keeping it.", 'Get your own.', 'Sorry. Need it more than you.'] : p.flaws.includes('squeamish') && NEED[need] && NEED[need].treat ? ["I can't. The blood. I'm sorry.", "Don't ask me to do that."] : ["Can't spare it right now.", 'Ask someone else.'], 2);
      if (v === 2) say(a, 'give', ["Take mine. I'll manage.", "Here. Don't argue.", 'You need it more than me.'], 3);
    }
    const v = memo[k].v;
    return v === 0 ? 0 : v === 2 ? 1 : base;
  }
  /* can it be spared? (keep one for yourself unless you have plenty) */
  /* everything someone has of one calibre: the pack, and the magazines of the guns that take it */
  function calRounds(a, c) { let n = a.cz.m.inv[c] || 0; for (const w of a.w) if (CZ.calOf(w.id) === c) n += w.mag || 0; return n; }
  CZ.calRounds = calRounds;
  function spare(m, id, giver, need, t) {
    const n = m.inv[id] || 0; if (!n) return 0;
    // warm things: a jacket or raincoat only to someone with neither; firewood and a hot meal like food
    if (need === 'cold') {
      if ((id === 'jacket' || id === 'raincoat') && t && t.cz && ((t.cz.m.inv.jacket || 0) > 0 || (t.cz.m.inv.raincoat || 0) > 0)) return 0;
      if (n > 1) return 1;
      const gt = giver.cz.m.st.temp, tt = t && t.cz ? t.cz.m.st.temp : 37;
      return tt < 35.9 && gt > 36.3 && id !== 'jacket' && id !== 'raincoat' ? 1 : 0;
    }
    // medicine against the infection: a spare dose goes freely; the last one goes to someone 15 or
    // more ahead of the giver, or to anyone at 50 or more (unless the giver is as far gone)
    if (need === 'infection') {
      if (n > 1) return 1;
      const gi = giver.cz.m.st.infection || 0, ti = t && t.cz ? t.cz.m.st.infection || 0 : 0;
      return (ti >= 50 && gi < ti) || ti - gi >= 15 ? 1 : 0;
    }
    // food and water: one to spare goes freely; the last one goes to someone clearly worse off, or to
    // anyone close to starving (unless the giver is just as close)
    if (need === 'hunger' || need === 'thirst') {
      if (n > 1) return 1;
      const gs = giver.cz.m.st[need] || 0, ts = t && t.cz ? t.cz.m.st[need] || 0 : 0;
      return (ts >= 80 && gs < 85) || ts - gs >= 20 ? 1 : 0;
    }
    if ((need === 'bleed' || need === 'hurt') && NEED.bleed.ids.includes(id)) return giver.cz.m.st.bleed > 0 && n < 2 ? 0 : 1;
    if (CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'ammo') {
      const uses = giver.w.some(w => CZ.calOf(w.id) === id);
      if (!uses) return Math.min(n, 150);
      const gm = (giver.w.find(w => CZ.calOf(w.id) === id) || {}).def, keep = (gm && gm.mag) || 20;
      const give = Math.floor((calRounds(giver, id) - (t ? calRounds(t, id) : 0)) / 2);
      return give >= 5 ? Math.max(0, Math.min(give, n - keep)) : 0;
    }
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
      if (u.sick < 0) st.sick = Math.max(0, st.sick + u.sick);
      if (u.pain) st.pain = u.pain;
      if (u.hp) t.heal(u.hp);
      const q = P(t); if (q) q.stress = Math.max(0, q.stress - 6 - (u.calm || 0));   // being looked after helps
      t.cz.m.hp = t.hp;
      CZ.tell(t, giver.op.name + ' used ' + it.name + ' on you', 'info');
      CZ.fire('treated', giver, t, id);
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
      if (t !== giver) CZ.fire('treated', giver, t, 'strip');
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
  /* Nobody here runs on a timer. Each teammate thinks about their state every second or few (when is
     their own), notices what is past their own limits, and then decides, by who they are and how bad
     it is, whether to do something about it now: so one eats at the first pang and another waits until
     they're shaking, one dresses a cut straight away and another forgets until it's bad, the clever
     boil their water and the rest sometimes just drink it */
  CZ.botCare = function (a, dt) {
    if ((a.czCareT = (a.czCareT || 0) - dt) > 0) return;
    const p = P(a);
    a.czCareT = 1.2 + Math.random() * 2.3 + (p && p.flaws.includes('scatterbrain') ? 2 : 0);
    if (a.busy > 0 || a.state !== 'alive') return;
    if (CZ.inPanic && CZ.inPanic(a)) return;   // nobody sorts out their pack mid-panic
    const m = a.cz.m, needs = needsOf(a), hot = fighting(a);
    // a dry gun: the other one
    if (a.w[a.cur] && a.w[a.cur].mag <= 0 && a.w[a.cur].reserve <= 0) { const o = a.w.findIndex((w, i) => i !== a.cur && (w.mag > 0 || w.reserve > 0)); if (o >= 0) WPN.swap(a, o); }
    a.czNeed = null;
    if (!hot && G.time > (a.czGunT || 0)) { a.czGunT = G.time + 6; if (betterGun(a)) return; }
    restTick(a, hot);
    if (warmTick(a, hot)) return;
    // dirty water and a fire (or the safehouse stove): the ones who know better boil it first
    if (!hot && CZ.canBoil && CZ.canBoil(a) && decide(a, 'boil', 0.5)) { CZ.boil(a); if (Math.random() < 0.5) say(a, 'boil', ['Boiling this before anyone drinks it.', "Water's going on the fire."]); return; }
    for (const need of needs) {
      if (need === 'cold') continue;
      if (need === 'fatigue') { if ((m.inv.coffee || 0) > 0 && m.st.fatigue > 80 && !hot && decide(a, 'drink', sevOf(a, need) * 0.6)) { CZ.use(a, 'coffee', true); return; } continue; }
      if (hot && need !== 'bleed' && !(need === 'hurt' && a.hp < 25)) continue;   // in a fight only what can't wait (a wound can't)
      const sev = sevOf(a, need), kind = KIND[need];
      // not now: they put it off (they'll think of it again in a moment, more likely the worse it gets)
      if (kind && !decide(a, kind, sev)) continue;
      let id = itemIn(m, need, a);
      // hungry or thirsty with only something risky: a gamble, or (not knowing better) it's the first thing in the bag
      if ((need === 'hunger' || need === 'thirst') && !(CZ.has && CZ.has(a, 'ironstomach'))) {
        const r = riskyIn(m, need);
        if (r && (!id && decide(a, 'risky', sev) || id && p && p.t.smarts < 0.35 && Math.random() < 0.2)) {
          CZ.use(a, r, true); say(a, 'risky', r === 'dirtywater' ? ["It's water. Mostly.", 'Bottoms up. God help me.', "Can't be worse than thirst."] : ["Smells... fine. Probably.", "Don't watch me eat this."], 2);
          return;
        }
      }
      if (!id && need !== 'ammo') id = fromStash(a, need);
      if (id && need !== 'ammo') { CZ.use(a, id, true); if (Math.random() < 0.3) say(a, 'self', need === 'bleed' ? ['Patching myself up.', 'Bandaging.'] : need === 'thirst' ? ['Drinking.', 'Need a sip.'] : need === 'hunger' ? ['Eating something quick.', 'Two minutes. Food.'] : ['Treating it.']); return; }
      // rounds still in the pack: fine for now, unless it's down to the last magazine's worth (then say so)
      if (need === 'ammo' && id && calRounds(a, calOf(a)) >= ((a.w[0] && a.w[0].def.mag) || 20)) continue;
      // make one: if they know how (some just don't)
      if (NEED[need].craft && decide(a, 'craft', sev) && NEED[need].craft.some(rid => craftOwn(a, rid))) { if (Math.random() < 0.4) say(a, 'craft', ['Making a dressing.', 'Give me a second, tearing some cloth.']); return; }
      if (need === 'bleed') {
        // nothing to dress it with: a teammate has a few seconds to bring something; then the last
        // resort (sooner for the quick-witted, later for the rest)
        a.czBleedSince = a.czBleedSince || G.time;
        const bad = m.st.bleed >= 2 || a.hp < 55, slow = p ? 1.6 - p.t.smarts : 1, waited = G.time - a.czBleedSince > (bad ? 4 : 10) * slow;
        if ((waited || hot) && CZ.improvise(a)) { a.czBleedSince = 0; say(a, 'self', ['Tearing my sleeve for this.', 'Pressing on it. Hold on.'], 3); return; }
      }
      if (need === 'infection' && CZ.hidBite && CZ.hidBite(a)) continue;   // and saying nothing
      a.czNeed = a.czNeed || need;
    }
    if (!m.st.bleed) a.czBleedSince = 0;
    // ask for what it can't sort out itself: some straight away, some only when it's bad, some loudly
    if (a.czNeed && G.time > (a.czAskT || 0)) {
      a.czAskT = G.time + 6;
      if (decide(a, 'ask', sevOf(a, a.czNeed))) {
        a.czAskT = G.time + 35 + Math.random() * 40;
        const w = a.czNeed === 'ammo' ? CZ.itemName(calOf(a)) : NEED[a.czNeed].word, hot2 = p && p.t.temper > 0.65;
        say(a, 'ask', a.czNeed === 'ammo' ? ["I'm almost out. Need " + w + '.', 'Low on ammo!'] : a.czNeed === 'bleed' ? ["I'm bleeding, anyone got " + w + '?', 'Need a bandage here!'] : hot2 ? ['Is anyone going to get me ' + w + ' or what?', 'I need ' + w + '. Now.'] : p && p.t.nerve < 0.35 ? ['Sorry, does anyone have ' + w + '?', 'I... I need ' + w + '.'] : ['I need ' + w + '.', 'Anyone got ' + w + '?'], 3);
        CZ.fire('askedFor', a, a.czNeed);
        const pl = G.player; if (pl && !pl.ghost && pl.cz) CZ.tell(pl, a.op.name + ' needs ' + w + (pl.state === 'alive' ? ' · give it from your pack (' + KEYS.name('czInv') + ')' : ''), 'warn');
      }
    }
    // and help: the nearest teammate (you too) with a need this one can answer, if they're the helping kind
    if (a.czGiveT > G.time) return;
    if (hot) {
      // in a fight nobody walks over, but rounds get tossed to someone right beside you
      for (const t of squad()) {
        if (t === a || U.dist3(t.pos, a.pos) > 5 || !needsOf(t).includes('ammo')) continue;
        const c = calOf(t), n = willGive(a, t, 'ammo', spare(m, c, a, 'ammo', t)); if (!n) continue;
        const g = CZ.add(t.cz.m, c, n); CZ.take(m, c, g);
        if (g) { a.czGiveT = G.time + 6; CZ.fire('gave', a, t, c, g, false); CZ.tell(t, a.op.name + ' tossed you ' + g + ' × ' + CZ.itemName(c), 'info'); say(a, 'give', ['Mag! Catch!', 'Ammo, here!', 'Take these rounds!'], 3); return; }
      }
      return;
    }
    // the worst off first (a deep wound, a bad infection, starving), so two helpers don't both go to
    // the first name on the list while someone else goes without
    const worst = t => { const st = t.cz.m.st; return st.bleed * 30 + Math.max(0, st.infection - 30) * 1.5 + Math.max(0, st.hunger - 60) + Math.max(0, st.thirst - 60) + (t.hp < 45 ? 40 : 0); };
    const pri = t => worst(t) + (CZ.relOf ? CZ.relOf(a, t) * 0.25 : 0);   // a friend in need comes a little sooner
    // watching, the leader has the squad's job to do: it only stops for someone in a bad way close by
    // (with ten in the squad someone always needs something, and the leader used to spend the whole
    // time walking supplies over instead of talking to the person the story wanted)
    const leading = CZ.watching && CZ.leader() === a;
    for (const t of squad().sort((p2, q) => pri(q) - pri(p2))) {
      // someone starving or bleeding badly is worth going further for
      const ts = t.cz.m.st, urgent = ts.hunger >= 80 || ts.thirst >= 80 || ts.bleed >= 2 || ts.infection >= 60;
      if (leading && (!(ts.bleed >= 2 || ts.hunger >= 92 || ts.thirst >= 92 || t.hp < 30) || U.dist3(t.pos, a.pos) > 8)) continue;
      if (t === a || U.dist3(t.pos, a.pos) > (urgent ? 40 : 16) || t.czTendT > G.time || (t.busy > 0 && /IMPROVISING|TREATING/.test(t.busyLabel || ''))) continue;
      for (const need of needsOf(t)) {
        if (t.czClaim && t.czClaim[need] && t.czClaim[need].t > G.time && t.czClaim[need].by !== a) continue;   // someone's already bringing it
        if (need === 'infection' && CZ.hidBite && CZ.hidBite(t)) continue;   // they're hiding it
        let id = need === 'ammo' ? calOf(t) : itemIn(m, need, t);
        // the antiviral is scarce: it only goes to someone whose infection is serious
        if (id === 'antiviral' && need === 'infection' && t !== a && (t.cz.m.st.infection || 0) < 50 && (m.inv.antiviral || 0) < 2) id = null;
        if (!id && need === 'bleed' && decide(a, 'craft', sevOf(t, need)) && craftOwn(a, 'rag')) id = 'rag';
        if (!id && need === 'bleed' && (t.cz.m.st.bleed >= 2 || t.hp < 55) && CZ.canImprovise(a) && !(t.bot && CZ.canImprovise(t)) && willGive(a, t, 'bleed', 1)) {
          a.czGiveT = G.time + 6;
          a.bot.tasks.unshift({ at: t.pos.clone(), time: 0.4, run: x => { if (t.state !== 'dead' && U.dist3(t.pos, x.pos) < 4 && CZ.improvise(x, t)) say(x, 'give', ['Hold still, pressing on it.', "I've got you."], 3); } });
          return;
        }
        if (!id) continue;
        const n = willGive(a, t, need, spare(m, id, a, need, t));
        if (!n) continue;
        a.czGiveT = G.time + 8;
        (t.czClaim || (t.czClaim = {}))[need] = { by: a, t: G.time + 12 };
        a.bot.tasks.unshift({ at: t.pos.clone(), time: 0.6, run: x => {
          if (t.czClaim && t.czClaim[need] && t.czClaim[need].by === x) t.czClaim[need].t = G.time + 3;   // a moment for it to take effect
          if (t.state === 'dead' || U.dist3(t.pos, x.pos) > 4) return;
          // still needed, now they're here? (someone else may have seen to it on the way)
          if (!needsOf(t).includes(need) || (id === 'antiviral' && need === 'infection' && t.cz.m.st.infection < 50 && (x.cz.m.inv.antiviral || 0) < 2)) return;
          if (NEED[need].treat && t.state !== 'dead') CZ.treat(x, t, id);
          else { const g = CZ.add(t.cz.m, id, n); CZ.take(x.cz.m, id, g); if (g) { CZ.tell(t, x.op.name + ' gave you ' + (g > 1 ? g + ' × ' : '') + CZ.itemName(id), 'info'); CZ.fire('gave', x, t, id, g, !(x.cz.m.inv[id] > 0)); } }
          say(x, 'give', ['Here, take this.', 'Got you.', 'Catch.'], 2);
        } });
        return;
      }
    }
  };

  /* ================================================================ guns */
  /* how good a gun is to this person: its damage over time, its reach, who they are (a sharpshooter
     likes a long gun, a hothead a loud one), and whether they have rounds for it */
  function gunScore(a, id, inHand) {
    const d = DATA.WEAPONS[id]; if (!d) return 0;
    const dps = d.dmg * (d.pellets ? Math.min(d.pellets, 8) * 0.55 : 1) * Math.min(d.rpm || 300, 900) / 60;
    const reach = d.type === 'SG' ? 0.75 : d.type === 'PISTOL' || d.type === 'MP' ? 0.8 : d.type === 'SR' || d.type === 'DMR' ? 1.05 : 1;
    const p = P(a); let like = 1;
    if (p && p.perks.includes('sharpshooter') && (d.type === 'DMR' || d.type === 'SR')) like = 1.25;
    if (p && p.t.temper > 0.7 && (d.type === 'SG' || d.type === 'LMG')) like = 1.2;
    const c = CZ.calOf(id), n = inHand ? calRounds(a, c) : (a.cz.m.inv[c] || 0), mag = d.mag || 20;
    const ammo = n >= mag * 2 ? 1 : n >= mag ? 0.7 : n > 0 ? 0.4 : 0.05;
    return dps * reach * like * ammo;
  }
  const isSide = id => { const d = DATA.WEAPONS[id]; return !!d && (d.sec || d.type === 'PISTOL' || d.type === 'MP'); };
  /* a gun in the pack that beats the one in that hand: swap (the clever and the bold sooner); one they
     can't use and can't carry gets left behind */
  function betterGun(a) {
    const m = a.cz.m, p = P(a);
    for (const k of Object.keys(m.inv)) {
      if (!k.startsWith('gun:')) continue;
      const id = k.slice(4), slot = isSide(id) ? 1 : 0, cur = a.w[slot];
      if (cur && cur.id === id) continue;
      const mine = cur ? gunScore(a, cur.id, true) : 0, theirs = gunScore(a, id, false);
      if (theirs > mine * 1.2 && (!p || Math.random() < 0.4 + p.t.smarts * 0.4)) {
        CZ.equip(a, id, slot);
        say(a, 'gun', ['Swapping to the ' + DATA.WEAPONS[id].name + '.', "I'll take this one.", 'Better than what I had.'], 2);
        return true;
      }
    }
    // spare guns slowing them down: left where they stand
    if (CZ.weight(m) > CZ.capacity(m)) for (const k of Object.keys(m.inv)) if (k.startsWith('gun:')) { const n = m.inv[k]; CZ.take(m, k, n); CZ.dropLoot(a.pos, [[k, n]], 'Dropped'); return true; }
    return false;
  }
  CZ.betterGun = betterGun;
  // where the squad came in from (so a search for materials doesn't go straight back)
  CZ.listen('enter', zid => { const S = CZ.S; if (!CZ.Z || !S) return; const e = Object.entries(CZ.exitsOf(zid) || {}).find(([, sd]) => sd === S.side); CZ.Z.from = e ? e[0] : null; });
  /* the squad and melee: up close to the infected, who swings instead of shooting is theirs to decide
     (short of rounds, short of temper, bold enough to get that close; never at a brute) */
  /* Melee in City Z is the last resort. With rounds, they shoot. Out of rounds for every gun they carry,
     they go and find some (or a gun): the nearest container in the whole place known to hold rounds of
     their calibre or a gun, else one of a kind that could, a teammate's spare meanwhile (sharing does
     that). Only when there's nowhere left in the place that could have any do they take the infected
     on by hand (and anything already on top of them gets a swing to break free, ai.js) */
  const hasRounds = a => a.w.some(w => (w.mag || 0) > 0 || (w.reserve || 0) > 0 || (a.cz.m.inv[CZ.calOf(w.id)] || 0) > 0);
  CZ.hasRounds = hasRounds;
  const AMMO_TABLES = Object.keys(CZ.LOOT).filter(t => CZ.LOOT[t].some(r => /^a\d|^bolt$|^gun:/.test(r[0])));
  function ammoSource(a) {
    if (a.czAmmoSrc && a.czAmmoSrc.until > G.time && (!a.czAmmoSrc.e || a.czAmmoSrc.e.alive)) return a.czAmmoSrc.e;
    const cals = new Set(a.w.map(w => CZ.calOf(w.id))), kg = CZ.weight(a.cz.m);
    let best = null, bd = 1e9;
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czloot') continue;
      if (e.czFullFor && e.czFullFor[a.id] != null && kg >= e.czFullFor[a.id] - 0.3) continue;
      if (skipped('loot:' + e.cid) || G.actors.some(b => b !== a && b.bot && b.bot.loot === e)) continue;
      const good = e.items ? Object.keys(e.items).some(k => cals.has(k) || k.startsWith('gun:')) : AMMO_TABLES.includes(e.table);
      if (!good) continue;
      const d = U.dist3(e.pos, a.pos) + (e.items ? 0 : 10) + Math.abs(e.pos.y - a.pos.y) * 2;   // a known find before a maybe
      if (d < bd) { bd = d; best = e; }
    }
    a.czAmmoSrc = { e: best, until: G.time + 1 };
    return best;
  }
  CZ.ammoSource = ammoSource;
  AI.dryRush = function (a, t, dist) {
    if (!CZ.on() || !a.cz || !a.cz.m) return dist < 9;
    return !ammoSource(a) && dist < 9;   // nowhere left to look: then, and only then, hand to hand
  };
  AI.meleeWanted = function (a, t) {
    if (!CZ.on() || !a.cz || !a.cz.m || !t.cz || !t.cz.inf) return false;
    if (t.cz.def && t.cz.def.armour) return false;
    return !hasRounds(a) && !ammoSource(a);
  };
  /* the goal for someone with no rounds: the ammo, before anything else they'd do */
  CZ.dryGoal = function (a) {
    if (!CZ.on() || !a.cz || !a.cz.m || !a.bot || hasRounds(a)) { a.czDry = false; return null; }
    const e = ammoSource(a); if (!e) return null;
    if (!a.czDry) { a.czDry = true; say(a, 'dry', ["I'm out. Finding ammo.", 'Dry! Going to look for rounds.', 'No rounds left. Searching.'], 3); }
    return lootGoal(a, e);
  };

  /* ================================================================ warmth */
  /* Cold (body heat under 36.2, well before hypothermia at 35.5): a hot meal if it has one; a
     campfire if it has firewood (or two planks to make some) and the night or the rain is the cause;
     shelter indoors near the squad when it's quiet; and over the worst, it says so */
  /* out in a cold or wet night with nothing to keep it off: body heat drops fast, so act sooner */
  function exposed(a) { const m = a.cz.m; if (CZ.sheltered(a)) return false; const wet = CZ.S.weather === 'rain', dark = CZ.dark() > 0.5; return (dark || wet) && !(m.inv.jacket > 0) && !(wet && m.inv.raincoat > 0); }
  const fireNear = (p, r) => G.ents.find(e => e.alive && e.type === 'fire' && e.campfire && U.dist3(e.pos, p) < r);
  function warmTick(a, hot) {
    const m = a.cz.m, st = m.st;
    if (st.temp >= coldAt(a) + 0.4) { a.czColdWant = false; return false; }
    if (st.temp >= coldAt(a)) return false;
    // going to do something about it? (the careful sooner; some shrug it off until they're shaking)
    if (!a.czColdWant && !hot) { if (G.time < (a.czColdRollT || 0)) return false; a.czColdRollT = G.time + 6 + Math.random() * 8; if (!decide(a, 'warm', sevOf(a, 'cold'))) return false; }
    a.czColdWant = !hot;
    if (hot || a.busy > 0) return false;
    if ((m.inv.stew || 0) > 0 && st.temp < 35.9 && decide(a, 'eat', 0.6)) { CZ.use(a, 'stew', true); return true; }
    const calm = !G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 18);
    if (calm && !fireNear(a.pos, 12) && G.time > (CZ.Z.fireT || 0) && (CZ.night() || CZ.S.weather === 'rain' || st.temp < 35.9) && decide(a, 'fire', sevOf(a, 'cold'))) {
      if (!(m.inv.firewood > 0) && (m.inv.planks || 0) >= 2) { CZ.take(m, 'planks', 2); m.inv.firewood = (m.inv.firewood || 0) + 1; }
      if (m.inv.firewood > 0 && CZ.lightFire(a)) { CZ.Z.fireT = G.time + 150; say(a, 'fire', ['Getting a fire going.', "Freezing. I'm lighting a fire."], 3); return true; }
    }
    if (st.temp < 35.8 && G.time > (a.czColdAskT || 0)) {
      a.czColdAskT = G.time + 60;
      say(a, 'cold', ["I'm freezing. We need to get inside.", "Can't feel my hands. Need a fire or a coat."], 3);
      const p = G.player; if (p && !p.ghost && p.cz) CZ.tell(p, a.op.name + ' is freezing · get them inside, by a fire, or give them a jacket', 'warn');
    }
    return false;
  }
  /* where to warm up: a campfire close by, or indoors near the squad */
  CZ.warmGoal = function (a) {
    if (!a.czColdWant || fighting(a)) return null;
    const lead = CZ.leader(), near = lead && lead !== a ? lead.pos : a.pos;
    const f = fireNear(a.pos, 25);
    if (f) {
      // a place round the fire (each their own side of it), never in a doorway
      if (!a.czFireSpot || a.czFireSpot.f !== f) {
        let spot = null;
        for (let k = 0; k < 8 && !spot; k++) { const ang = (a.id * 1.3 + k * 0.8) % 6.283, n = NAV.nearest(f.pos.clone().add(V().set(Math.cos(ang) * 1.6, 0, Math.sin(ang) * 1.6)), 3); if (n >= 0) { const q = NAV.nodePos(n); if (!(CZ.doorAt && CZ.doorAt(q))) spot = q; } }
        a.czFireSpot = { f, p: spot || f.pos.clone() };
      }
      return { pos: a.czFireSpot.p.clone(), kind: 'warm', r: 1.2, look: f.pos.clone(), crouch: true };
    }
    // already under a roof: stay there (crouched, warming up) while the squad is within reach, rather
    // than following someone back out into the cold
    if (CZ.sheltered(a)) { if (U.dist3(a.pos, near) >= 35) return null; const off = CZ.offDoor && CZ.offDoor(a, near); return off ? { pos: off, kind: 'shelter', r: 0.5, crouch: true } : { pos: a.pos.clone(), kind: 'shelter', r: 3, crouch: true }; }
    if (!a.czShelter || G.time > a.czShelterT || U.dist3(a.czShelter, near) > 30) {
      a.czShelterT = G.time + 20; a.czShelter = null;
      let best = null, bd = 1e9;
      for (const r of G.map.rooms) { if (/Stairs/.test(r.name)) continue; const c = V().set((r.x0 + r.x1 + 1) / 8, r.y * 0.25, (r.z0 + r.z1 + 1) / 8); if (Math.abs(c.y - near.y) > 2) continue; const d = U.dist3(c, near); if (d < bd && d < 30) { bd = d; best = r; } }
      // a spot in that room that really is under the roof (not by a door or under an open atrium)
      // (a spot under the roof proper: not out in the open, and not in or beside a doorway, where a
      // crouched, shivering teammate blocked the way in for everyone else)
      if (best) for (let k = 0; k < 12 && !a.czShelter; k++) { const q = NAV.randomIn(best); if (q && !G.world.outdoor(q.clone().setY(q.y + 1)) && !(CZ.doorAt && CZ.doorAt(q))) a.czShelter = q; }
    }
    return a.czShelter ? { pos: a.czShelter.clone(), kind: 'shelter', r: 1.5, crouch: true } : null;
  };

  /* ================================================================ rest and sleep */
  /* Tired (over 70): when nothing is close, a teammate stops and rests (crouched) until it is back under
     45, unless the squad moves off; at a restored safehouse it naps on the bed instead, all the way
     down. Over 85 it asks to go back and sleep */
  const bed = () => G.ents.find(e => e.alive && e.czFix === 'czbed');
  function restTick(a, hot) {
    const st = a.cz.m.st;
    if (hot) { a.czRestWant = false; return; }
    const lim = th(a, 'fatigue', 70);
    // tired past their limit: stop for a rest? (some push on; the nervous stop sooner)
    if (st.fatigue > lim && !a.czRestWant && G.time > (a.czRestRollT || 0)) { a.czRestRollT = G.time + 8 + Math.random() * 10; if (decide(a, 'rest', sevOf(a, 'fatigue'))) a.czRestWant = true; }
    else if (st.fatigue < (a.czNap > G.time ? 15 : Math.max(45, lim - 25))) { if (a.czRestWant && a.stance > 0) a.setStance(0); a.czRestWant = false; a.czNap = 0; }
    if (st.fatigue > Math.max(85, lim + 10) && G.time > (a.czSleepAskT || 0)) {
      a.czSleepAskT = G.time + 90;
      const home = CZ.Z && CZ.isSafe(CZ.Z.id);
      say(a, 'tired', home ? ["I'm dead on my feet. I need that bed.", 'Need to sleep. Just an hour.'] : ["I'm running on empty. We need to get back and sleep.", "I can barely keep my eyes open."], 3);
      const p = G.player; if (p && !p.ghost && p.cz) CZ.tell(p, a.op.name + ' is exhausted · ' + (home ? 'let them use the bed, or sleep' : 'head back to a safehouse to sleep'), 'warn');
    }
  }
  CZ.restGoal = function (a) {
    if (!a.czRestWant || fighting(a)) return null;
    const lead = CZ.leader();
    // a safehouse bed right here: a proper nap
    const b = CZ.Z && CZ.isSafe(CZ.Z.id) ? bed() : null;
    if (b && (!lead || lead === a || U.dist3(lead.pos, b.pos) < 30)) {
      const n = NAV.nearest(b.pos, 4);
      return { pos: n >= 0 ? NAV.nodePos(n) : b.pos.clone(), kind: 'nap', r: 1.6, act: x => { if (!(x.czNap > G.time)) { x.czNap = G.time + 60; x.setStance(2); say(x, 'nap', ['Twenty minutes. Wake me if they come.', 'Lying down for a bit.'], 2); } } };
    }
    // otherwise a rest where it stands, crouched, as long as the squad isn't leaving it behind
    if (lead && lead !== a && U.dist3(lead.pos, a.pos) > 22) return null;
    if (G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 15)) return null;
    const off = CZ.offDoor && CZ.offDoor(a, lead ? lead.pos : null);   // (not in a doorway)
    if (off) return { pos: off, kind: 'rest', r: 0.5, crouch: true };
    return { pos: a.pos.clone(), kind: 'rest', r: 3, crouch: true, act: x => { if (x.stance === 0) x.setStance(1); } };
  };

  /* ================================================================ scavenging */
  /* a container to go through: near the leader, not someone else's, of a kind that has what is needed */
  /* what's in a container that someone wants: a need (its table, or what's known to be inside), a list
     of materials. strict: only containers that might have it */
  const wantedIds = (a, need) => need === 'ammo' ? [calOf(a)] : need && NEED[need] && NEED[need].ids ? NEED[need].ids : [];
  function pickContainer(a, need, range, strict, mats) {
    const lead = CZ.leader() || a, want = need && NEED[need] ? NEED[need].tables : null, ids = wantedIds(a, need);
    const matTables = mats ? Object.keys(CZ.LOOT).filter(t => CZ.LOOT[t].some(r => mats.includes(r[0]))) : null;
    const kg = CZ.weight(a.cz.m);
    let best = null, bs = 1e9;
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czloot' || U.dist3(e.pos, lead.pos) > range || Math.abs(e.pos.y - lead.pos.y) > 7) continue;
      if (G.actors.some(b => b !== a && b.bot && b.bot.loot === e)) continue;
      // searched already and what's left didn't fit: not again until there's room
      if (e.czFullFor && e.czFullFor[a.id] != null && kg >= e.czFullFor[a.id] - 0.3) continue;
      if (skipped('loot:' + e.cid)) continue;   // couldn't be reached a moment ago
      const known = e.items ? Object.keys(e.items) : null;
      const has = x => known && known.some(k => x.includes(k) || (need === 'ammo' && k.startsWith('gun:')));
      let s = U.dist3(e.pos, a.pos), fits = !want && !mats;
      if (want) { if (want.includes(e.table) || has(ids)) fits = true; else s += 25; if (has(ids)) s -= 20; }
      if (mats) { if (matTables.includes(e.table) || has(mats)) fits = true; else s += 25; if (has(mats)) s -= 20; }
      if (/^d_drop_/.test(String(e.cid)) || /important/.test(String(e.label))) s -= 40;   // a supply drop, or the story's
      if (strict && !fits) continue;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  const skipped = key => !!(CZ.Z && CZ.Z.skip && CZ.Z.skip[key] > G.time);
  function lootGoal(a, e, then) {
    a.bot.loot = e;
    return { key: 'loot:' + e.cid, pos: e.pos.clone(), kind: 'loot', r: 1.1, look: e.pos.clone().setY(e.pos.y + 0.5), act: x => {
      if (x.busy > 0 || !e.alive) { if (!e.alive) x.bot.loot = null; return; }
      x.busy = 1.3; x.busyLabel = 'SEARCHING';
      setTimeout(() => {
        if (x.state === 'alive' && e.alive && CZ.on()) { CZ.loot(x, e); if (e.alive) (e.czFullFor || (e.czFullFor = {}))[x.id] = CZ.weight(x.cz.m); }
        if (x.bot) x.bot.loot = null; x.czCareT = 0; x.czGunT = 0; if (then) then(x);
      }, 1200);
    } };
  }
  /* in the follow order: go and find what is missing, or pick over what is close when it is quiet */
  CZ.forageGoal = function (a) {
    const o = CZ.S && orderOf(a);
    if (!CZ.S || fighting(a) || o === 'quiet' || o === 'hold') return null;
    if (a.bot.loot && a.bot.loot.alive) return lootGoal(a, a.bot.loot);
    const lead = CZ.leader(); if (!lead || lead === a) return null;
    const calm = !G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 18);
    if (!calm) return null;
    if (a.czNeed && !squad().some(t => t !== a && itemIn(t.cz.m, a.czNeed, a)) && G.time > (a.czHuntT || 0)) {
      a.czHuntT = G.time + 6 + Math.random() * 6;
      if (decide(a, 'forage', sevOf(a, a.czNeed))) { const e = pickContainer(a, a.czNeed, 30, true); if (e) return lootGoal(a, e); }
    }
    if (G.time > (a.czPickT || 0) && CZ.weight(a.cz.m) < CZ.capacity(a.cz.m) * 0.75) {
      a.czPickT = G.time + 20 + Math.random() * 20;
      if (decide(a, 'forage', 0)) { const e = pickContainer(a, null, 12); if (e) return lootGoal(a, e); }
    }
    return null;
  };
  // squad goals: scavenging comes before falling in behind the leader
  const oGoal = CZ.squadGoal;
  CZ.squadGoal = function (a) {
    const dry = CZ.dryGoal(a); if (dry) return dry;
    const lead = CZ.leader();
    const o = CZ.S && orderOf(a);
    if (a !== lead && CZ.S && (o === 'follow' || o === 'hold')) { const w = CZ.warmGoal(a); if (w) return w; const r = CZ.restGoal(a); if (r) return r; }
    if (a !== lead && CZ.S && o === 'follow') { const g = CZ.forageGoal(a); if (g) return g; }
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
      if (!decide(a, 'throw', Math.min(1, near.length / 6))) { a.czThrowT = G.time + 3 + Math.random() * 4; return; }
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
  /* the objective's targets here, nearest first, less any it couldn't reach a moment ago */
  const targetKey = t => { const box = G.ents.find(e => e.alive && e.type === 'czloot' && e.pos === t.p); if (box) return 'loot:' + box.cid; const who = G.actors.find(x => x.pos === t.p && x.cz && x.cz.person); if (who) return 'talk:' + who.id; const fx = G.ents.find(e => e.alive && e.czFix && e.pos === t.p); return fx ? 'fix:' + fx.czFix : 'road:' + t.road; };
  function inPlace() { const t = CZ.targets ? CZ.targets() : []; const lead = CZ.leader(); if (!lead) return null; t.sort((p, q) => U.dist3(p.p, lead.pos) - U.dist3(q.p, lead.pos)); return t.find(x => !skipped(targetKey(x))) || null; }
  function exitTo(zone) { const side = CZ.exitsOf(CZ.Z.id)[zone]; return side ? CZ.Z.exits.find(e => e.side === side) : null; }
  function roadGoal(a, zone) {
    const e = exitTo(zone); if (!e) return null;
    const p = V().set(e.x, e.y, e.z), n = NAV.nearest(p, 6);
    return { key: 'road:' + zone, pos: n >= 0 ? NAV.nodePos(n) : p, kind: 'road', r: 2.5, act: () => { if (CZ.Z && !CZ.Z.leaving) { CZ.Z.leaving = true; HUD.toast('The squad heads for ' + CZ.ZONES[zone].name, 'info'); setTimeout(() => CZ.on() && CZ.travel(zone), 600); } } };
  }
  function fixGoal(a, kind, act) {
    const e = G.ents.find(x => x.alive && x.czFix === kind); if (!e) return null;
    const n = NAV.nearest(e.pos, 4);
    return { key: 'fix:' + kind, pos: n >= 0 ? NAV.nodePos(n) : e.pos.clone(), kind: 'fix', r: 1.4, look: e.pos.clone(), act: x => { if (x.busy > 0 || G.time < (x.czActT || 0)) return; x.czActT = G.time + 3; act(x); } };
  }
  /* what the objective still wants in materials (the squad's packs and every stash counted), for the
     steps that are built: restoring the first safehouse, the radio */
  function missingMats() {
    const S = CZ.S, st = CZ.STORY && CZ.STORY[S.story.step]; if (!st || S.story.ending) return null;
    let needs = null;
    if (st.id === 'restore' && !CZ.isSafe('firehouse')) needs = CZ.SAFE_UP[0].needs;
    if (st.id === 'radio') needs = Object.assign({}, CZ.SAFE_UP.find(u => u.id === 'radio').needs);
    if (!needs) return null;
    const out = {};
    for (const [k, n] of Object.entries(needs)) {
      let h = 0; for (const m of S.squad) if (m.alive) h += m.inv[k] || 0; for (const st2 of Object.values(S.stash)) h += st2[k] || 0;
      if (h < n) out[k] = n - h;
    }
    return Object.keys(out).length ? out : null;
  }
  CZ.missingMats = missingMats;
  /* at a safehouse: materials, spare guns and rounds nobody uses go into the stash (they still count
     for building there), so nobody walks out slowed by them */
  function unload() {
    const z = CZ.Z.id, S = CZ.S; if (!CZ.isSafe(z)) return;
    const stash = S.stash[z] || (S.stash[z] = {});
    for (const x of squad()) {
      if (!CZ.atSafe(x)) continue;
      const m = x.cz.m, uses = new Set(x.w.map(w => CZ.calOf(w.id)));
      for (const [id, n] of Object.entries(m.inv)) {
        const it = CZ.ITEMS[id], spareGun = id.startsWith('gun:'), spareAmmo = it && it.cat === 'ammo' && !uses.has(id);
        if (!(it && it.cat === 'mat') && !spareGun && !spareAmmo) continue;
        stash[id] = (stash[id] || 0) + n; delete m.inv[id];
      }
    }
  }
  /* The leader's plan (plan() below), with a check that it's getting somewhere: a target it hasn't got
     any closer to for 25 seconds (a container behind a wall it can't path round, a room whose way in
     is blocked) is given up on for a minute and a half, and it gets on with something else. A goal it
     can't reach used to hold it against a wall for good */
  CZ.autoGoal = function (a) {
    const g = plan(a); if (!g || !CZ.Z || !g.pos) return g;
    const Z = CZ.Z, key = g.key || (g.kind + ':' + Math.round(g.pos.x) + ',' + Math.round(g.pos.z)), d = U.dist3(a.pos, g.pos);
    if (Z.gk !== key) { Z.gk = key; Z.gkBest = d; Z.gkT = G.time; }
    else if (d < Z.gkBest - 0.75) { Z.gkBest = d; Z.gkT = G.time; }
    if (d > (g.r || 1.5) + 1 && G.time - Z.gkT > 25 && !(a.busy > 0) && !(CZ.ui && CZ.ui.isOpen()) && g.kind !== 'hold' && g.kind !== 'shelter' && g.kind !== 'warm') {
      (Z.skip || (Z.skip = {}))[key] = G.time + 90; Z.gk = null;
      if (a.bot && a.bot.loot) a.bot.loot = null;
      return null;
    }
    return g;
  };
  function plan(a) {
    if (!CZ.watching || !CZ.Z || !CZ.S) return null;   // (between places, while the next one loads)
    const S = CZ.S, here = CZ.Z.id, Z = CZ.Z;
    Z.autoT = (Z.autoT || 0);
    if (fighting(a)) return null;   // the bot's own fighting first
    if (CZ.isSafe(here) && G.time > (Z.unloadT || 0)) { Z.unloadT = G.time + 5; unload(); }
    // its own needs first: a few searches for them where they might be (not the whole place)
    if (a.czNeed && (Z.needN || 0) < 5 && !squad().some(t => t !== a && itemIn(t.cz.m, a.czNeed, a))) { const e = pickContainer(a, a.czNeed, 40, true); if (e) return lootGoal(a, e, () => { Z.needN = (Z.needN || 0) + 1; }); }
    // a dangerous place (the hospital, the checkpoint, the overpass): first hold together in the open by
    // the road in and let what's there come to the squad, until it's been quiet for a while (two minutes
    // at most); then go in. A squad that walks straight into the buildings gets surrounded in them
    if (CZ.ZONES[here].danger >= 4) {
      if (squad().some(x => fighting(x))) Z.contactT = G.time;
      if (!Z.inT) Z.inT = G.time;
      const quiet = G.time - (Z.contactT || Z.inT) > 25;
      if (!Z.entryDone && !quiet && G.time - Z.inT < 120) {
        if (!Z.holdP) { const e = Z.exits.find(x => x.side === S.side) || Z.exits[0], p0 = V().set(e.x, e.y, e.z), c = V().set(45, e.y, 45), q = p0.clone().lerp(c, 0.12), n = NAV.nearest(q, 8); Z.holdP = n >= 0 ? NAV.nodePos(n) : a.pos.clone(); }
        return { pos: Z.holdP.clone(), kind: 'hold', r: 3, crouch: false };
      }
      Z.entryDone = true;
    }
    // someone here waiting for help (a distress call, a stranger): go and talk to them
    const sv = G.actors.filter(x => x.cz && x.cz.person && x.cz.person.sid && !x.cz.person.talked && !x.cz.person.leaving && x.state === 'alive' && U.dist3(x.pos, a.pos) < 60 && !skipped('talk:' + x.id)).sort((p2, q) => U.dist3(p2.pos, a.pos) - U.dist3(q.pos, a.pos))[0];
    const storyP = (() => { const t0 = inPlace(); return t0 && G.actors.find(x => x.pos === t0.p && x.cz && x.cz.person); })();
    if (sv && !(storyP && U.dist3(storyP.pos, a.pos) < U.dist3(sv.pos, a.pos))) return { key: 'talk:' + sv.id, pos: sv.pos.clone(), kind: 'talk', r: 1.8, look: sv.eye(V()), act: () => { if (G.time < (Z.talkT || 0) || (CZ.ui && CZ.ui.isOpen()) || sv.czTalkUntil > performance.now()) return; Z.talkT = G.time + 8; sv.czTalkUntil = performance.now() + 30000; sv.cz.person.talked = true; const o = sv.cz.person; if (o.talk) o.talk(sv); else if (CZ.survivorTalk) CZ.survivorTalk(sv); } };
    // a safehouse: restore it, build what the story wants, sleep when the squad is worn out
    if (CZ.ZONES[here].safe && !CZ.isSafe(here) && CZ.haveAll(CZ.SAFE_UP[0].needs, CZ.sources(a))) { const g = fixGoal(a, 'czbench', x => CZ.restore(here, x)); if (g) return g; }
    // a cold squad: inside, or to a fire (the cold ones handle the fire themselves)
    if (squad().some(x => x.cz.m.st.temp < 36.0)) { a.czColdWant = true; const w = CZ.warmGoal(a); if (w) return w; }
    // worn out and away from home: back to the nearest safehouse to sleep (or, with none, a rest here)
    const tiredAll = squad().reduce((t, x) => t + x.cz.m.st.fatigue, 0) / Math.max(1, squad().length), worst = Math.max(...squad().map(x => x.cz.m.st.fatigue));
    if (!CZ.isSafe(here) && (tiredAll > 70 || worst > 85)) {
      const homes = Object.keys(S.safe).filter(z => CZ.isSafe(z));
      if (homes.length) { const best = homes.map(z => ({ z, n: CZ.routeTo(here, z) })).filter(x => x.n)[0]; if (best) { const g = roadGoal(a, best.n); if (g) { if (!Z.homeSaid) { Z.homeSaid = true; HUD.toast('The squad is worn out: heading back to ' + CZ.ZONES[best.z].name + ' to sleep', 'info'); } return g; } } }
      else { a.czRestWant = true; const r = CZ.restGoal(a); if (r) return r; }
    }
    if (CZ.isSafe(here)) {
      const tired = squad().reduce((t, x) => t + x.cz.m.st.fatigue, 0) / Math.max(1, squad().length);
      const hurt = squad().some(x => x.hp < 50);
      if ((tired > 70 || (CZ.night() && tired > 35) || (hurt && CZ.night())) && G.time > (Z.sleptT || 0)) { const g = fixGoal(a, 'czbed', () => { Z.sleptT = G.time + 120; const h = S.min / 60, toDusk = 19.5 - h; CZ.sleep(CZ.night() || toDusk < 3 ? undefined : Math.max(2, Math.min(Math.floor(toDusk), Math.ceil((tired - 10) / 14)))); }); if (g) return g; }
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
      if (who) return { key: 'talk:' + who.id, pos: who.pos.clone(), kind: 'talk', r: 1.8, look: who.eye(V()), act: () => { if (G.time < (Z.talkT || 0) || (CZ.ui && CZ.ui.isOpen()) || who.czTalkUntil > performance.now()) return; Z.talkT = G.time + 8; who.czTalkUntil = performance.now() + 20000; const o = who.cz.person; if (o.talk) o.talk(who); } };
      const fx = G.ents.find(e => e.alive && e.czFix && e.pos === t.p);
      if (fx && fx.czFix === 'uplink') return fixGoal(a, 'uplink', () => { if (!(CZ.ui && CZ.ui.isOpen()) && CZ.finale) CZ.finale(); });
      if (fx && fx.czFix === 'czbench' && CZ.isSafe(here) && CZ.haveAll(CZ.SAFE_UP.find(u => u.id === 'radio').needs, CZ.sources(a))) return fixGoal(a, 'czbench', x => CZ.upgrade(here, 'radio', x));
    }
    // materials the objective still needs: search for them here (where they might be), then elsewhere
    const miss = missingMats(), mats = miss ? Object.keys(miss) : null;
    if (mats) {
      const e = pickContainer(a, null, 70, true, mats);
      if (e && CZ.weight(a.cz.m) < CZ.capacity(a.cz.m) * 1.1) return lootGoal(a, e);
    }
    // otherwise: a short look round (a supply drop first), then move on
    Z.autoT += 1;
    const box = pickContainer(a, null, 45);
    if (box && (Z.t < 150 || /^d_drop_/.test(String(box.cid))) && CZ.weight(a.cz.m) < CZ.capacity(a.cz.m) * 0.85) return lootGoal(a, box);
    // on toward the objective's place (a safehouse for a building step, the nearest), or, while
    // materials are missing, somewhere new to look: places not yet searched first, not back where it came from
    const st = CZ.objective && CZ.objective(), cur = CZ.STORY && CZ.STORY[S.story.step];
    let goal = st && st.zone;
    if (cur && cur.anySafe) { const homes = Object.keys(S.safe).filter(z => CZ.isSafe(z)); if (homes.includes(here)) goal = here; else if (homes.length) goal = homes.sort((p2, q) => (CZ.routeTo(here, p2) ? 0 : 1) - (CZ.routeTo(here, q) ? 0 : 1))[0]; }
    let next = null;
    if (mats) {
      const ns = Object.keys(CZ.ZONES[here].links).filter(z => z !== Z.from);
      const score = z => (S.visited.includes(z) ? 0 : 3) + ((CZ.zoneState(z).looted || []).length < 12 ? 1 : 0) + Math.random();
      next = ns.sort((p2, q) => score(q) - score(p2))[0] || Object.keys(CZ.ZONES[here].links)[0];
    } else if (goal && goal !== here) next = CZ.routeTo(here, goal);
    if (!next || skipped('road:' + next)) { const ns = Object.keys(CZ.ZONES[here].links).filter(z => !skipped('road:' + z)); next = ns.find(z => !S.visited.includes(z)) || ns[Math.floor(Math.random() * ns.length)] || next; }
    return roadGoal(a, next);
  }
})();
