/* cityz-ui.js -- City Z on screen: the survival HUD (needs, status, clock, place, squad and their
   orders), the pack / stash / crafting / safehouse / squad screens, the region map, travel and sleep
   prompts, dialogue with choices, the City Z menu (continue, new squad, difficulty), and its keys:

     I  pack (and crafting, the squad's packs, the stash at a safehouse)   M  region map
     Y  squad orders, then 1-5                                            4  treat yourself
     3  throw what you carry (molotov, pipe bomb, noisemaker, flare)      F  search, travel, use */
(function () {
  'use strict';
  const CZ = window.CZ;
  const $ = U.el;
  const V = () => new THREE.Vector3();
  const UI = CZ.ui = {};
  const root = () => U.$('czui') || document.body.appendChild($('div', { id: 'czui' }));
  const btn = (t, fn, cls) => $('button', { class: 'btn ' + (cls || ''), onclick: e => { e.stopPropagation(); SFX.init(); SFX.ui(); fn(); } }, t);
  const pct = v => Math.round(Math.max(0, Math.min(100, v))) + '%';

  /* ================================================================ HUD */
  let H = null, hT = 0;
  UI.enter = function () {
    if (!U.$('czNight')) document.body.appendChild($('div', { id: 'czNight' }));
    U.$('czNight').style.display = 'block';
    const hud = U.$('hud');
    if (!H) {
      H = {};
      H.box = $('div', { class: 'cz-hud' },
        H.place = $('div', { class: 'cz-place' }),
        H.needs = $('div', { class: 'cz-needs' }),
        H.status = $('div', { class: 'cz-status' }));
      H.squad = $('div', { class: 'cz-squad' });
      H.obj = $('div', { class: 'cz-obj' });
      H.orders = $('div', { class: 'cz-orders' });
      H.mini = $('canvas', { class: 'cz-mini', width: 320, height: 320 });
      H.bars = {};
      for (const [k, label] of [['hp', 'HEALTH'], ['stamina', 'STAMINA'], ['hunger', 'FOOD'], ['thirst', 'WATER'], ['fatigue', 'REST'], ['infection', 'INFECTION'], ['temp', 'WARMTH'], ['nerves', 'NERVES']]) {
        const fill = $('i'), row = $('div', { class: 'cz-bar ' + k }, $('span', {}, label), $('b', {}, fill));
        H.bars[k] = { row, fill }; H.needs.append(row);
      }
    }
    hud.append(H.box, H.squad, H.obj, H.orders, H.mini); miniBase = null;
    H.orders.style.display = 'none';
  };
  UI.leave = function () { if (UI.wpHide) UI.wpHide(); const n = U.$('czNight'); if (n) n.style.display = 'none'; if (H) for (const e of [H.box, H.squad, H.obj, H.orders, H.mini]) e.remove(); UI.close(); };
  UI.frame = function (dt) {
    if (H) wpFrame();
    if (H && (miniT -= dt) <= 0) { miniT = 0.08; try { drawMini(); } catch (e) { } }
    if ((hT -= dt) > 0 || !H) return; hT = 0.2;
    const S = CZ.S, p = CZ.viewed ? CZ.viewed() : G.player; if (!p || !p.cz) return;
    const m = p.cz.m, st = m.st;
    H.place.innerHTML = '<b>' + CZ.ZONES[CZ.Z.id].name + '</b><span>DAY ' + S.day + ' · ' + CZ.clock() + ' · ' + String(S.weather || '').toUpperCase() + (CZ.isSafe(CZ.Z.id) ? ' · SAFEHOUSE' : '') + '</span>';
    if (!m || !m.st || st.stamina == null) return;
    const set = (k, v, bad) => { const b = H.bars[k]; b.fill.style.width = pct(v); b.row.classList.toggle('bad', !!bad); };
    set('hp', p.hp / p.maxHp * 100, p.hp < 35);
    set('stamina', st.stamina, st.stamina < 15);
    set('hunger', 100 - st.hunger, st.hunger > 75);
    set('thirst', 100 - st.thirst, st.thirst > 75);
    set('fatigue', 100 - st.fatigue, st.fatigue > 80);
    set('infection', st.infection, st.infection > 50); H.bars.infection.row.style.display = st.infection > 0.5 && !(CZ.hidBite && CZ.hidBite(p) && p !== G.player) ? '' : 'none';
    set('temp', (st.temp - 33) / 4.4 * 100, st.temp < 35.5);
    const pp = CZ.P && CZ.P(p);
    set('nerves', pp ? 100 - pp.stress : 100, pp && pp.stress > 70); H.bars.nerves.row.style.display = pp ? '' : 'none';
    const tags = [];
    if (st.bleed > 0) tags.push('<i class="bad">BLEEDING ' + '●'.repeat(Math.min(4, Math.ceil(st.bleed))) + '</i>');
    if (st.fracture) tags.push('<i class="bad">BROKEN BONE</i>');
    if (st.sick > 0) tags.push('<i class="warn">SICK' + (st.sick > 25 ? ' · ANTIBIOTICS CLEAR IT' : '') + '</i>');
    if (p.czQueasy) tags.push('<i>YOUR STOMACH FEELS ODD</i>');
    if (pp) { const pk = CZ.inPanic && CZ.inPanic(p); if (pk) tags.push('<i class="bad">PANIC ATTACK · CROUCH AND BREATHE</i>'); else if (pp.stress > 75) tags.push('<i class="bad">' + (pp.t.temper > 0.65 ? 'SEEING RED' : 'TERRIFIED') + ' · SHAKING HANDS</i>'); else if (pp.stress > 50) tags.push('<i class="warn">' + (pp.t.temper > 0.65 ? 'ON EDGE' : 'ANXIOUS') + '</i>'); }
    if (st.pain > 0) tags.push('<i>PAINKILLERS</i>');
    if (p.czResting) tags.push('<i>RESTING</i>');
    else if (st.fatigue >= 80) tags.push('<i class="' + (st.fatigue >= 95 ? 'bad' : 'warn') + '">' + (st.fatigue >= 95 ? 'EXHAUSTED' : 'TIRED') + ' · REST OR SLEEP</i>');
    if (st.temp < 35.5) tags.push('<i class="bad">HYPOTHERMIA</i>');
    else if (st.temp < 36.2) tags.push('<i class="warn">COLD · GET INSIDE, BY A FIRE OR INTO A JACKET</i>');
    if (CZ.nearFire && CZ.nearFire(p)) tags.push('<i>BY THE FIRE</i>');
    if (m.careN > 0 && CZ.CARE_KINDS) tags.push('<i class="ok">' + CZ.CARE_KINDS[m.care || 'ammo'].name + ' READY · ' + KEYS.name('czCare') + '</i>');
    const kg = CZ.weight(m), cap = CZ.capacity(m);
    tags.push('<i class="' + (kg > cap ? 'warn' : '') + '">PACK ' + kg + ' / ' + cap + ' KG</i>');
    H.status.innerHTML = tags.join('');
    // the squad: names, health, order
    const sq = CZ.isGuest && CZ.isGuest() ? G.actors.filter(a => a.team === CZ.TEAM && a.op && !/^_/.test(a.op.id)).map(a => (a.cz || (a.cz = { m: { st: {} } }), a)) : G.actors.filter(a => a.cz && a.cz.m);
    H.squad.classList.toggle('many', sq.length > 6);   // a bigger squad: tighter rows
    H.squad.innerHTML = (CZ.isWatching && CZ.isWatching() ? '<div class="cz-ord">WATCHING · THE SQUAD PLAYS ON ITS OWN</div>' : '<div class="cz-ord">ORDERS · ' + CZ.ORDERS[S.order || 'follow'].name + ' <kbd>Y</kbd></div>') + sq.map(a => { const q = CZ.P && CZ.P(a), hid = q && q.agenda && q.agenda.kind === 'secretbite' && !q.agenda.shown && a.cz.m.st.infection < 75, pk = CZ.inPanic && CZ.inPanic(a), mood = a.state === 'alive' && q ? CZ.moodOf(a) : ''; return '<div class="cz-mate' + (a === p ? ' me' : '') + (a.state !== 'alive' ? ' ' + a.state : '') + '"><b>' + a.op.name + '</b>' + (mood ? '<small class="mood ' + mood + '">' + (pk ? 'PANICKING' : mood.toUpperCase()) + '</small>' : '') + '<i style="width:' + pct(a.state === 'dead' ? 0 : a.hp / a.maxHp * 100) + '"></i>' + (a.cz.m.st.infection > 40 && !hid ? '<em>INFECTED</em>' : '') + (a.cz.m.st.sick > 25 ? '<em class="need">SICK</em>' : '') + (a.czNeed ? '<em class="need">NEEDS ' + (a.czNeed === 'ammo' ? 'AMMO' : a.czNeed === 'bleed' ? 'A DRESSING' : a.czNeed === 'thirst' ? 'WATER' : a.czNeed === 'hunger' ? 'FOOD' : a.czNeed === 'infection' || a.czNeed === 'sick' ? 'MEDS' : a.czNeed === 'fracture' ? 'A SPLINT' : 'MEDICAL') + '</em>' : '') + '</div>'; }).join('');
    // the story's current objective
    const o = CZ.objective ? CZ.objective() : null;
    H.obj.innerHTML = o ? '<b>' + o.title + '</b><span>' + o.text + '</span>' : '';
    H.obj.style.display = o ? '' : 'none';
  };

  /* ================================================================ overlays */
  let open = null;
  UI.isOpen = () => !!open;
  function overlay(node, cls) {
    UI.close(true);
    const r = root(); r.innerHTML = ''; r.className = 'on ' + (cls || ''); r.append(node);
    open = node; PLAYER.release(); G.paused = !GAME.net && !(CZ.isWatching && CZ.isWatching());
    r.onclick = e => { if (e.target === r) UI.close(); };
  }
  UI.close = function (keep) {
    const r = U.$('czui'); if (r) { r.innerHTML = ''; r.className = ''; }
    if (!open) return; open = null;
    if (keep) return;
    G.paused = false;
    if (CZ.on() && G.player) { PLAYER.enabled = true; PLAYER.lock(); }
  };
  UI.fade = function () { const f = $('div', { class: 'cz-fade' }); document.body.append(f); setTimeout(() => f.remove(), 1600); };

  /* ---- the pack screen: tabs for the pack, crafting, the squad, the stash and the safehouse */
  UI.inventory = function (tab) {
    const p = CZ.viewed ? CZ.viewed() : G.player; if (!p || !p.cz) return;
    tab = tab || UI.lastTab || 'pack'; UI.lastTab = tab;
    const S = CZ.S, z = CZ.Z.id, safe = CZ.isSafe(z) && CZ.atSafe && CZ.atSafe(p);
    const gst = (CZ.isGuest && CZ.isGuest()) || (CZ.isWatching && CZ.isWatching());
    const tabs = [['pack', 'PACK'], ['craft', 'CRAFT'], ...(gst ? [] : [['squad', 'SQUAD']]), ...(safe && !gst ? [['stash', 'STASH'], ['safe', 'SAFEHOUSE']] : []), ['log', 'JOURNAL']];
    if (!tabs.some(t => t[0] === tab)) tab = 'pack';
    const body = $('div', { class: 'cz-tabbody' });
    const panel = $('div', { class: 'panel cz-panel' },
      $('div', { class: 'cz-tabs' }, ...tabs.map(([k, n]) => $('button', { class: 'cz-tab' + (k === tab ? ' on' : ''), onclick: () => UI.inventory(k) }, n)), $('button', { class: 'cz-tab x', onclick: () => UI.close() }, 'CLOSE ✕')),
      body);
    ({ pack: packTab, craft: craftTab, squad: squadTab, stash: stashTab, safe: safeTab, log: logTab })[tab](body, p);
    if (CZ.isWatching && CZ.isWatching()) for (const b of panel.querySelectorAll('.cz-acts')) b.remove();   // watching: look, don't touch
    overlay(panel);
  };
  const CATS = [['weapon', 'GUNS'], ['ammo', 'AMMUNITION'], ['med', 'MEDICAL'], ['food', 'FOOD'], ['drink', 'DRINK'], ['throw', 'THROWN'], ['gear', 'GEAR'], ['mat', 'MATERIALS'], ['quest', 'STORY']];
  const catOf = id => id.startsWith('gun:') ? 'weapon' : (CZ.ITEMS[id] || {}).cat || 'mat';
  const nameOf = id => CZ.itemName(id.startsWith('gun:') ? id.slice(4) : id);
  function itemRows(inv, actions) {
    const out = [];
    for (const [cat, title] of CATS) {
      const ids = Object.keys(inv).filter(id => inv[id] > 0 && catOf(id) === cat).sort();
      if (!ids.length) continue;
      out.push($('h3', {}, title));
      for (const id of ids) {
        const kg = (id.startsWith('gun:') ? CZ.itemKg(id.slice(4)) : CZ.itemKg(id)) * inv[id];
        const it = CZ.ITEMS[id] || {};
        out.push($('div', { class: 'cz-item' }, $('b', {}, nameOf(id)), $('span', {}, '× ' + inv[id]), $('em', {}, (Math.round(kg * 10) / 10) + ' kg'), it.desc ? $('small', {}, it.desc) : null, $('div', { class: 'cz-acts' }, ...actions(id))));
      }
    }
    return out.length ? out : [$('p', { class: 'muted' }, 'Empty.')];
  }
  function packTab(body, p) {
    const m = p.cz.m, kg = CZ.weight(m), cap = CZ.capacity(m);
    body.append($('div', { class: 'cz-sum' }, $('b', {}, p.op.name + ' · ' + p.name), $('span', {}, 'Pack ' + kg + ' / ' + cap + ' kg' + (kg > cap ? ' (slowed)' : ''))));
    body.append($('h3', {}, 'IN HAND'), $('div', { class: 'cz-guns' }, ...p.w.map((w, i) => $('div', { class: 'cz-gun' }, $('b', {}, (i ? 'SECONDARY · ' : 'PRIMARY · ') + w.def.name), $('span', {}, w.mag + ' in the magazine · ' + (m.inv[CZ.calOf(w.id)] || 0) + ' ' + CZ.itemName(CZ.calOf(w.id)))))));
    const near = CZ.isGuest && CZ.isGuest() ? G.actors.filter(a => a !== p && a.team === CZ.TEAM && a.op && !/^_/.test(a.op.id) && a.state === 'alive' && U.dist3(a.pos, p.pos) < 6) : G.actors.filter(a => a !== p && a.cz && a.cz.m && a.state === 'alive' && U.dist3(a.pos, p.pos) < 6);
    body.append(...itemRows(m.inv, id => {
      const it = CZ.ITEMS[id] || {}, acts = [];
      const G2 = CZ.isGuest && CZ.isGuest();
      if (it.use) acts.push(btn('USE', () => { CZ.use(p, id); UI.close(); }));
      if (id.startsWith('gun:')) for (const slot of [0, 1]) acts.push(btn(slot ? 'EQUIP SECONDARY' : 'EQUIP PRIMARY', () => { if (G2) { CZ.ask('equip', { id: id.slice(4), slot }); UI.close(); } else { equip(p, id.slice(4), slot); UI.inventory('pack'); } }));
      if (id === 'barricade' && !G2) acts.push(btn('BOARD UP', () => { UI.close(); setTimeout(() => CZ.boardUp(p), 50); }));
      if (id === 'firewood' && !G2) acts.push(btn('LIGHT A CAMPFIRE', () => { UI.close(); setTimeout(() => CZ.lightFire(p), 50); }));
      if (id === 'dirtywater') acts.push(CZ.canBoil(p) ? btn('BOIL IT ALL', () => { UI.close(); CZ.boil(p); }) : $('span', { class: 'muted' }, 'boil it by a campfire or at a workbench'));
      for (const a of near) acts.push(btn('GIVE ' + a.op.name, () => { const n = CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'ammo' ? Math.min(m.inv[id], 30) : 1; if (G2) { CZ.ask('give', { id, to: a.id, n }); UI.close(); return; } const t = CZ.add(a.cz.m, id, Math.min(n, m.inv[id])); CZ.take(m, id, t); if (!t) HUD.toast(a.op.name + ' can\'t carry it', 'warn'); else CZ.fire('gave', p, a, id, t, !(m.inv[id] > 0)); UI.inventory('pack'); }, 'ghost'));
      acts.push(btn('DROP', () => { if (G2) { CZ.ask('drop', { id }); UI.close(); return; } const n = m.inv[id]; CZ.take(m, id, n); CZ.dropLoot(p.pos, [[id, n]], 'Dropped'); UI.inventory('pack'); }, 'ghost'));
      return acts;
    }));
  }
  /* put a found gun in hand: the old one goes into the pack */
  CZ.equip = (a, gid, slot) => equip(a, gid, slot);
  function equip(a, gid, slot) {
    const m = a.cz.m, old = a.w[slot];
    if (old && old.id === gid) return;
    CZ.take(m, 'gun:' + gid, 1);
    if (old) m.inv['gun:' + old.id] = (m.inv['gun:' + old.id] || 0) + 1;
    const lo = Object.assign({}, a.loadout); if (slot === 0) lo.primary = gid; else lo.secondary = gid;
    const keep = a.w.map(w => ({ id: w.id, mag: w.mag }));
    a.loadout = lo; a.resetKit();
    a.w.forEach((w, i) => { w.mag = i === slot ? 0 : (keep[i] && keep[i].id === w.id ? keep[i].mag : 0); w.reserve = 0; });
    a.cz.res = []; a.cz.m.guns = a.w.map(w => ({ id: w.id, mag: w.mag }));
    if (a.rig) MD.setRigGun(a.rig, a.w[a.cur].id);
    if (a.isPlayer) { PLAYER.vmKey = ''; HUD.toast('Equipped ' + DATA.WEAPONS[gid].name, 'info'); }
  }
  function craftTab(body, p) {
    const lvl = CZ.benchLevel();
    body.append($('p', { class: 'sub' }, lvl ? 'At the workbench' + (lvl > 1 ? ' and machine shop' : '') + '. Materials come from your pack, the stash and teammates beside you.' : 'By hand. A restored safehouse workbench makes more. Materials come from your pack and teammates beside you.'));
    for (const r of CZ.RECIPES) {
      const ok = CZ.canCraft(r), locked = (r.bench || 0) > lvl;
      body.append($('div', { class: 'cz-item' + (ok ? '' : ' off') },
        $('b', {}, (r.makes[1] > 1 ? r.makes[1] + ' × ' : '') + CZ.itemName(r.makes[0])),
        $('small', {}, Object.entries(r.needs).map(([k, n]) => n + ' ' + CZ.itemName(k)).join(' · ') + (r.bench ? ' · needs ' + (r.bench > 1 ? 'the machine shop' : 'the workbench') : '') + (r.fire ? ' · over a fire: a campfire, or the workbench stove' : '')),
        $('div', { class: 'cz-acts' }, locked ? $('span', { class: 'muted' }, 'LOCKED') : btn('MAKE', () => { CZ.craft(r.id); UI.inventory('craft'); }, ok ? '' : 'ghost'))));
    }
  }
  /* how someone gets on with the rest, as far as you've seen */
  function bondLines(a, me) {
    const b = CZ.bondsOf && CZ.bondsOf(a); if (!b) return [];
    const out = [];
    if (b.ult) out.push($('small', { class: 'bad' }, b.ult));
    if (b.hist.length) out.push($('small', {}, 'History: ' + b.hist.join(' · ')));
    if (!me && b.you) out.push($('small', { class: b.you.r < -15 ? 'warn' : '' }, 'About you: ' + b.you.w + (b.you.why ? ' (' + b.you.why + ')' : '')));
    if (b.likes.length) out.push($('small', {}, 'Gets on with: ' + b.likes.join(', ')));
    if (b.dislikes.length) out.push($('small', { class: 'warn' }, 'Clashes with: ' + b.dislikes.join(', ')));
    return out;
  }
  function squadTab(body, p) {
    const full = CZ.squadCount ? CZ.squadCount() : 0;
    body.append($('p', { class: 'sub' }, 'The squad: ' + full + ' of ' + (CZ.MAX_SQUAD || 5) + '. You learn who people are by travelling with them: what they\'re like after a day, whether to trust them only when they show you.'));
    for (const a of G.actors.filter(x => x.cz && x.cz.m)) {
      const m = a.cz.m, st = m.st, k = CZ.knownAbout ? CZ.knownAbout(a) : null, me = a === p;
      const who = k ? $('div', { class: 'cz-who' },
        $('span', {}, k.kind + (me ? '' : ' · ' + (CZ.inPanic(a) ? 'panicking' : k.mood)) + (k.words.length ? ' · ' + k.words.join(', ') : '')),
        $('small', {}, (k.perks.length ? 'Good at: ' + k.perks.join(', ') : '') + (k.flaws.length ? ' · Weak spots: ' + k.flaws.join(', ') : '')),
        $('small', { class: 'muted' }, k.bio + (me ? '' : ' ' + k.trust)),
        ...(a.state === 'dead' ? [] : bondLines(a, me))) : null;
      const card = $('div', { class: 'cz-mcard' + (a === p ? ' me' : '') },
        $('b', {}, (m.recruit ? a.name : a.op.name + ' · ' + a.name) + (a === p ? ' (YOU)' : '')), who,
        $('span', {}, a.state === 'dead' ? 'DEAD' : 'Health ' + Math.round(a.hp) + ' · Food ' + Math.round(100 - st.hunger) + '% · Water ' + Math.round(100 - st.thirst) + '% · Rest ' + Math.round(100 - st.fatigue) + '%' + (st.infection > 0.5 && !(CZ.hidBite && CZ.hidBite(a)) ? ' · Infection ' + Math.round(st.infection) + '%' : '') + (st.bleed > 0 ? ' · bleeding' : '') + (st.fracture ? ' · broken bone' : '')),
        CZ.OP_PERKS && m.perk ? $('small', {}, 'Perk: ' + CZ.OP_PERKS[m.perk].name + ' · Care package: ' + CZ.CARE_KINDS[m.care || 'ammo'].name + (m.careN ? ' (' + m.careN + ' to call in)' : '')) : null,
        $('small', {}, 'Pack ' + CZ.weight(m) + ' / ' + CZ.capacity(m) + ' kg: ' + (CZ.itemsText(m.inv) || 'empty')),
        a !== p && a.state === 'alive' ? $('div', { class: 'cz-acts' },
          btn('PLAY AS ' + a.op.name, () => { UI.close(); CZ.takeControl(a); }),
          U.dist3(a.pos, p.pos) < 6 ? btn('ASK FOR THEIR SUPPLIES', () => { CZ.askSupplies(a, p); UI.inventory('squad'); }, 'ghost') : null,
          U.dist3(a.pos, p.pos) < 6 && CZ.P(a) && CZ.P(a).stress > 45 && G.time > (a.czCalmedT || 0) ? btn('CALM THEM DOWN', () => { a.czCalmedT = G.time + 60; CZ.calmDown(p, a); UI.inventory('squad'); }, 'ghost') : null,
          btn('PART WAYS', () => { if (a.czPartAsk !== true) { a.czPartAsk = true; HUD.toast('Press PART WAYS again to send ' + a.name + ' away for good', 'warn'); setTimeout(() => { a.czPartAsk = false; }, 4000); return; } CZ.partWays(a); UI.inventory('squad'); }, 'ghost')) : null);
      body.append(card);
    }
    const fallen = CZ.S.squad.filter(m => !m.alive);
    if (fallen.length) body.append($('h3', {}, 'LOST'), $('p', { class: 'muted' }, fallen.map(m => (m.recruit ? m.name : DATA.OPMAP[m.op].name + ' · ' + m.name) + (m.turned ? ' (turned on you)' : m.gone ? ' (gone)' : '')).join(', ')));
  }
  function stashTab(body, p) {
    const S = CZ.S, z = CZ.Z.id, stash = S.stash[z] || (S.stash[z] = {}), m = p.cz.m;
    body.append($('div', { class: 'cz-two' },
      $('div', {}, $('h3', {}, 'YOUR PACK · ' + CZ.weight(m) + ' / ' + CZ.capacity(m) + ' KG'), btn('STORE ALL BUT WEAPONS AND AMMO', () => { for (const [id, n] of Object.entries(m.inv)) { if (catOf(id) === 'ammo' || CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'gear') continue; stash[id] = (stash[id] || 0) + n; delete m.inv[id]; } UI.inventory('stash'); }, 'ghost'),
        ...itemRows(m.inv, id => [btn('STORE', () => { const n = m.inv[id]; CZ.take(m, id, n); stash[id] = (stash[id] || 0) + n; UI.inventory('stash'); }, 'ghost')])),
      $('div', {}, $('h3', {}, 'STASH · ' + CZ.ZONES[z].name),
        ...itemRows(stash, id => [btn('TAKE', () => { const t = CZ.add(m, id, stash[id]); stash[id] -= t; if (stash[id] <= 0) delete stash[id]; if (!t) HUD.toast('Too heavy', 'warn'); UI.inventory('stash'); }), btn('TAKE 1', () => { if (CZ.add(m, id, 1)) { stash[id]--; if (stash[id] <= 0) delete stash[id]; } UI.inventory('stash'); }, 'ghost')]))));
  }
  function safeTab(body) {
    const S = CZ.S, z = CZ.Z.id, sf = S.safe[z];
    body.append($('p', { class: 'sub' }, CZ.ZONES[z].name + ' · restored on day ' + sf.since + '. Building uses what is in your pack, the stash and your teammates\' packs.'));
    for (const u of CZ.SAFE_UP.slice(1)) {
      const have = sf.up.includes(u.id), can = !have && (!u.after || sf.up.includes(u.after));
      body.append($('div', { class: 'cz-item' + (have ? ' done' : can ? '' : ' off') }, $('b', {}, u.name), $('small', {}, u.desc + ' · ' + Object.entries(u.needs).map(([k, n]) => n + ' ' + CZ.itemName(k)).join(', ')),
        $('div', { class: 'cz-acts' }, have ? $('span', { class: 'ok' }, 'BUILT') : can ? btn('BUILD', () => { CZ.upgrade(z, u.id); UI.inventory('safe'); }, CZ.haveAll(u.needs) ? '' : 'ghost') : $('span', { class: 'muted' }, 'NEEDS ' + (CZ.SAFE_UP.find(x => x.id === u.after) || {}).name))));
    }
    const ppl = (S.survivors || []).filter(s => s.home === z && s.state === 'home');
    body.append($('h3', {}, 'PEOPLE HERE'), ppl.length ? $('div', {}, ...ppl.map(s => $('div', { class: 'cz-item' }, $('b', {}, s.name), $('small', {}, (CZ.SURVIVOR_SKILLS[s.skill] || {}).name + ': ' + (CZ.SURVIVOR_SKILLS[s.skill] || {}).desc)))) : $('p', { class: 'muted' }, 'Nobody yet. Survivors you rescue can be sent here.'));
  }
  function logTab(body) {
    const S = CZ.S;
    body.append($('div', { class: 'cz-sum' }, $('b', {}, 'DAY ' + S.day + ' · ' + CZ.clock()), $('span', {}, CZ.DIFF[S.diff].name + ' · ' + S.stats.kills + ' infected killed · ' + S.stats.looted + ' places searched · ' + S.stats.travelled + ' minutes on the road')));
    const o = CZ.objective && CZ.objective();
    if (o) body.append($('h3', {}, 'NOW'), $('div', { class: 'cz-item' }, $('b', {}, o.title), $('small', {}, o.text)));
    body.append($('h3', {}, 'JOURNAL'), ...(S.story.log || []).slice().reverse().map(l => $('div', { class: 'cz-log' }, $('em', {}, 'Day ' + l.d), ' ', l.t)));
  }

  /* ---- the region map */
  UI.map = function () {
    const S = CZ.S, here = CZ.Z.id, ex = CZ.exitsOf(here), W = 640, Hh = 520, sx = x => 40 + x * 56, sy = y => 40 + y * 56;
    const svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh); svg.setAttribute('class', 'cz-map');
    const mk = (tag, attrs, txt) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
    const known = z => S.known.includes(z);
    const drawn = new Set();
    for (const [z, Z] of Object.entries(CZ.ZONES)) for (const [t, mins] of Object.entries(Z.links)) {
      const key = [z, t].sort().join(); if (drawn.has(key) || !known(z) || !known(t)) continue; drawn.add(key);
      const T = CZ.ZONES[t];
      mk('line', { x1: sx(Z.x), y1: sy(Z.y), x2: sx(T.x), y2: sy(T.y), class: 'road' + ((z === here || t === here) ? ' here' : '') });
      mk('text', { x: (sx(Z.x) + sx(T.x)) / 2, y: (sy(Z.y) + sy(T.y)) / 2 - 4, class: 'mins' }, mins + "'");
    }
    const info = $('div', { class: 'cz-mapinfo' });
    const showInfo = z => {
      const Z = CZ.ZONES[z], st = S.zones[z];
      info.innerHTML = '';
      info.append($('b', {}, Z.name), $('span', {}, Z.area + ' · danger ' + '▮'.repeat(Z.danger) + '▯'.repeat(5 - Z.danger)),
        $('p', {}, S.visited.includes(z) ? Z.desc : 'Not been there yet.'),
        $('small', {}, [CZ.isSafe(z) ? 'Your safehouse' : Z.safe ? 'Could be a safehouse' : '', st && st.cleared ? 'Cleared' : st && st.pop >= 0 ? '~' + st.pop + ' infected' : '', z === here ? 'You are here' : ex[z] ? 'Leave by the ' + ({ N: 'north', S: 'south', E: 'east', W: 'west' })[ex[z]] + ' road (' + CZ.ZONES[here].links[z] + ' min)' : ''].filter(Boolean).join(' · ')));
    };
    for (const [z, Z] of Object.entries(CZ.ZONES)) {
      if (!known(z)) continue;
      const g = mk('g', { class: 'zone' + (z === here ? ' here' : '') + (S.visited.includes(z) ? ' seen' : '') + (CZ.isSafe(z) ? ' safe' : '') });
      const c = document.createElementNS(svgNS, 'circle'); c.setAttribute('cx', sx(Z.x)); c.setAttribute('cy', sy(Z.y)); c.setAttribute('r', z === here ? 13 : 10); g.append(c);
      const t = document.createElementNS(svgNS, 'text'); t.setAttribute('x', sx(Z.x)); t.setAttribute('y', sy(Z.y) + 26); t.textContent = Z.name; g.append(t);
      if (CZ.isSafe(z)) { const s = document.createElementNS(svgNS, 'text'); s.setAttribute('x', sx(Z.x)); s.setAttribute('y', sy(Z.y) + 5); s.setAttribute('class', 'icon'); s.textContent = '⌂'; g.append(s); }
      const ob = CZ.objective && CZ.objective();
      if (ob && ob.zone === z) { const s = document.createElementNS(svgNS, 'circle'); s.setAttribute('cx', sx(Z.x)); s.setAttribute('cy', sy(Z.y)); s.setAttribute('r', 18); s.setAttribute('class', 'obj'); g.append(s); }
      for (const e of S.events || []) if (e.zone === z && e.until > S.day * 1440 + S.min) { const s = document.createElementNS(svgNS, 'text'); s.setAttribute('x', sx(Z.x) + 14); s.setAttribute('y', sy(Z.y) - 10); s.setAttribute('class', 'ev'); s.textContent = e.kind === 'drop' ? '✚' : e.kind === 'horde' ? '☠' : '!'; g.append(s); }
      g.addEventListener('mouseenter', () => showInfo(z)); g.addEventListener('click', () => showInfo(z));
      svg.append(g);
    }
    showInfo(here);
    overlay($('div', { class: 'panel cz-panel cz-mappanel' }, $('div', { class: 'cz-tabs' }, $('b', { class: 'cz-title' }, 'VARROW · CITY Z'), $('button', { class: 'cz-tab x', onclick: () => UI.close() }, 'CLOSE ✕')), $('div', { class: 'cz-mapwrap' }, svg, info)));
  };

  /* ---- travel, sleep, dialogue, notes */
  CZ.travelMenu = function (to) {
    const S = CZ.S, from = CZ.Z.id, mins = CZ.ZONES[from].links[to], arrive = (S.min + mins) % 1440, hh = Math.floor(arrive / 60), mm = Math.floor(arrive % 60);
    const car = CZ.carHere ? CZ.carHere() : null;
    const left = G.actors.filter(a => a.cz && a.cz.m && a.state !== 'dead' && a !== G.player && U.dist3(a.pos, G.player.pos) > 40);
    overlay($('div', { class: 'panel cz-panel cz-small' }, $('h2', {}, CZ.ZONES[to].name), $('p', { class: 'sub' }, CZ.ZONES[to].area + ' · danger ' + CZ.ZONES[to].danger + ' of 5'),
      $('p', {}, S.visited.includes(to) ? CZ.ZONES[to].desc : 'You have not been there yet.'),
      $('p', {}, 'On foot: ' + mins + ' minutes, there at ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + '.'),
      left.length ? $('p', { class: 'warn' }, left.map(a => a.op.name).join(', ') + (left.length > 1 ? ' are' : ' is') + ' too far away and will catch up.') : null,
      $('div', { class: 'actions' }, btn('GO ON FOOT', () => { UI.close(true); open = null; G.paused = false; CZ.travel(to, false); }, 'big'),
        car ? btn('DRIVE (' + Math.round(mins / 3) + ' MIN, ' + Math.ceil(mins * car.def.burn / 3) + ' FUEL)', () => { UI.close(true); open = null; G.paused = false; CZ.drive ? CZ.drive(car, to) : CZ.travel(to, true); }) : null,
        btn('STAY', () => UI.close(), 'ghost'))));
  };
  UI.sleepMenu = function () {
    overlay($('div', { class: 'panel cz-panel cz-small' }, $('h2', {}, 'SLEEP'), $('p', { class: 'sub' }, 'Day ' + CZ.S.day + ', ' + CZ.clock() + '. Sleeping heals, passes the time and makes you hungry and thirsty. Your squad sleeps too.'),
      $('div', { class: 'actions' }, btn('UNTIL MORNING (06:30 · ' + Math.round(CZ.toMorning() / 60) + ' H)', () => { UI.close(); CZ.sleep(); }, 'big'), btn('4 HOURS', () => { UI.close(); CZ.sleep(4); }), btn('1 HOUR', () => { UI.close(); CZ.sleep(1); }), btn('NOT NOW', () => UI.close(), 'ghost')),
      CZ.toMorning() > 14 * 60 ? $('p', { class: 'warn' }, 'That is a long sleep from here: eat and drink first. Anyone who gets desperately hungry or thirsty wakes the squad.') : null));
  };
  /* a conversation: lines in turn, then choices */
  UI.dialog = function (o) {
    const lines = [].concat(o.lines || o.text || []), choices = o.choices || [{ label: 'OK' }];
    let i = 0;
    const box = $('div', { class: 'cz-dialog' });
    const draw = () => {
      box.innerHTML = '';
      const l = lines[i] || '', who = typeof l === 'object' ? l.who : o.who, txt = typeof l === 'object' ? l.t : l;
      box.append($('div', { class: 'cz-who' }, who || ''), $('p', {}, txt));
      if (i < lines.length - 1) box.append($('div', { class: 'actions' }, btn('CONTINUE ▸', () => { i++; draw(); }, 'big')));
      else box.append($('div', { class: 'actions cz-choices' }, ...choices.map(c => btn(c.label, () => { UI.close(); if (c.fn) setTimeout(c.fn, 30); }, c.cls || ''))));
      if (who && window.VOICE && o.voice !== false && G.settings.voiceSpeech && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.volume = (G.settings.voiceVol || 0.85) * 0.9; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) { } }
    };
    draw();
    overlay(box, 'dim');
    if (CZ.isWatching && CZ.isWatching()) {
      G.paused = false;
      const iv = setInterval(() => {
        if (!box.isConnected) return clearInterval(iv);
        if (i < lines.length - 1) { i++; draw(); return; }
        clearInterval(iv); const c = choices.find(x => x.recruit && x.fn) || choices.find(x => x.fn) || choices[0]; UI.close(true); open = null; G.paused = false; if (c.fn) setTimeout(c.fn, 30);
      }, 3500);
    }
  };

  /* ================================================================ spectating */
  const oCycle = PLAYER.cycleSpec;
  PLAYER.cycleSpec = function (d) {
    if (GAME.mode !== 'cityz') return oCycle.apply(this, arguments);
    const list = G.actors.filter(t => t.cz && t.cz.m && t.state !== 'dead');
    if (!list.length) { PLAYER.spec = null; return; }
    PLAYER.specIdx = ((PLAYER.specIdx || 0) + d + list.length) % list.length; PLAYER.spec = list[PLAYER.specIdx];
  };

  /* ================================================================ objective markers */
  /* where to go: a diamond on screen over each thing the current objective points at (or the road
     toward its place), with the distance; at the screen's edge when it is off to the side or behind */
  const WP = [];
  /* ================================================================ the minimap */
  /* North up, centred on you (or whoever you're watching), about 45 m either way: the buildings, the
     squad (you as an arrow), the story's markers, the trash-can fires, care package crates (a parachute
     while one comes down) and the helicopter bringing one; anything worth knowing that's further off
     sits on the edge, pointing the way */
  let miniT = 0, miniBase = null, miniZone = null;
  const MS = 2;   // px per metre in the drawing of the whole place
  function base() {
    const W = G.world.W * 0.25, D = G.world.D * 0.25, c = document.createElement('canvas');
    c.width = Math.ceil(W * MS); c.height = Math.ceil(D * MS);
    const g = c.getContext('2d');
    g.fillStyle = '#2b2f2a'; g.fillRect(0, 0, c.width, c.height);
    for (const b of G.map.buildings || []) {
      const x = b.x0 / 4 * MS, z = b.z0 / 4 * MS, w = (b.x1 - b.x0 + 1) / 4 * MS, h = (b.z1 - b.z0 + 1) / 4 * MS;
      g.fillStyle = '#585e68'; g.fillRect(x, z, w, h); g.strokeStyle = '#8a909a'; g.lineWidth = 1; g.strokeRect(x + 0.5, z + 0.5, w - 1, h - 1);
    }
    for (const e of G.map.exits || []) { g.fillStyle = '#d8c060'; g.fillRect(e.x * MS - 3, e.z * MS - 3, 6, 6); }
    return c;
  }
  function drawMini() {
    const cv = H.mini; if (!cv || !cv.isConnected || !G.world || !CZ.Z) return;
    if (!miniBase || miniZone !== CZ.Z) { miniBase = base(); miniZone = CZ.Z; }
    const g = cv.getContext('2d'), N = cv.width, half = N / 2, k = N / 90;   // ~45 m each side
    const me = (CZ.viewed && CZ.viewed()) || G.player, at = me && !me.ghost ? me.pos : G.camera.position;
    const sx = x => half + (x - at.x) * k, sz = z => half + (z - at.z) * k;
    g.save(); g.clearRect(0, 0, N, N);
    g.beginPath(); g.arc(half, half, half - 2, 0, 6.2832); g.clip();
    g.fillStyle = '#1e211d'; g.fillRect(0, 0, N, N);
    g.drawImage(miniBase, half - at.x * MS * (k / MS), half - at.z * MS * (k / MS), miniBase.width * (k / MS), miniBase.height * (k / MS));
    // on the rim if it's further off than the map shows
    const pin = (x, z, draw) => { let px = sx(x), pz = sz(z); const dx = px - half, dz = pz - half, d = Math.hypot(dx, dz), R = half - 9; let edge = false; if (d > R) { px = half + dx / d * R; pz = half + dz / d * R; edge = true; } draw(px, pz, edge, Math.atan2(dz, dx)); };
    // trash-can fires
    for (const e of G.ents) if (e.alive && e.type === 'czbarrel') { const x = sx(e.pos.x), z = sz(e.pos.z); g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(x, z, 4, 0, 6.2832); g.fill(); }
    // the story's markers
    for (const t of (CZ.targets ? CZ.targets() : [])) if (t.p) pin(t.p.x, t.p.z, (x, z) => { g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(x, z - 6); g.lineTo(x + 6, z); g.lineTo(x, z + 6); g.lineTo(x - 6, z); g.closePath(); g.fill(); });
    // care package crates, and one coming down
    for (const e of G.ents) if (e.alive && e.type === 'czcare') pin(e.pos.x, e.pos.z, (x, z) => {
      g.fillStyle = '#5a7a3a'; g.fillRect(x - 6, z - 6, 12, 12); g.fillStyle = '#fff'; g.fillRect(x - 1.5, z - 5, 3, 10); g.fillRect(x - 5, z - 1.5, 10, 3);
      if (!e.landed) { g.strokeStyle = '#e8e8e8'; g.lineWidth = 2; g.beginPath(); g.arc(x, z - 9, 7, Math.PI, 0); g.stroke(); }
    });
    // the squad
    for (const a of G.actors) {
      if (!a.cz || !a.cz.m || a.state === 'dead' || a === me) continue;
      g.fillStyle = a.state === 'dbno' ? '#d84a3a' : '#5ab0ff'; g.beginPath(); g.arc(sx(a.pos.x), sz(a.pos.z), 4, 0, 6.2832); g.fill();
    }
    // the helicopter: its body and a spinning rotor, or an arrow on the rim while it's still coming
    for (const e of G.ents) if (e.alive && e.type === 'czheli') pin(e.pos.x, e.pos.z, (x, z, edge, ang) => {
      if (edge) { g.save(); g.translate(x, z); g.rotate(ang); g.fillStyle = '#9ad86a'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.restore(); }
      g.fillStyle = '#9ad86a'; g.fillRect(x - 4, z - 6, 8, 12); g.fillRect(x - 1.5, z + 4, 3, 9);
      const r = G.time * 14; g.strokeStyle = 'rgba(220,240,200,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + Math.cos(r) * 10, z + Math.sin(r) * 10); g.lineTo(x - Math.cos(r) * 10, z - Math.sin(r) * 10); g.moveTo(x + Math.cos(r + 1.57) * 10, z + Math.sin(r + 1.57) * 10); g.lineTo(x - Math.cos(r + 1.57) * 10, z - Math.sin(r + 1.57) * 10); g.stroke();
    });
    // you: an arrow the way you face
    const yaw = me && !me.ghost ? me.yaw : (G.camera.rotation.y || 0);
    g.save(); g.translate(half, half); g.rotate(-yaw); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(half, half, half - 2, 0, 6.2832); g.stroke();
    g.fillStyle = '#e8eaed'; g.font = '700 20px sans-serif'; g.textAlign = 'center'; g.fillText('N', half, 22);
  }
  UI.drawMini = drawMini;
  function wpFrame() {
    const ts = CZ.targets ? CZ.targets() : [], hud = U.$('hud'), cam = G.camera, me = CZ.viewed && CZ.viewed();
    while (WP.length < ts.length) { const e = $('div', { class: 'cz-wp' }, $('i'), $('b'), $('span')); hud.append(e); WP.push(e); }
    const W = innerWidth, Hh = innerHeight;
    for (let i = 0; i < WP.length; i++) {
      const e = WP[i], t = ts[i];
      if (!t || !CZ.on()) { e.style.display = 'none'; continue; }
      const p = t.p.clone(); p.y += t.up || 1.2;
      const v = p.clone().project(cam), behind = v.z > 1;
      let x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * Hh;
      if (behind) { x = W - x; y = Hh - 40; }
      const off = behind || x < 30 || x > W - 30 || y < 30 || y > Hh - 30;
      x = Math.max(30, Math.min(W - 30, x)); y = Math.max(30, Math.min(Hh - 30, y));
      e.style.display = ''; e.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      e.classList.toggle('edge', off);
      e.children[1].textContent = t.label;
      e.children[2].textContent = me ? Math.round(U.dist3(me.pos, t.p)) + ' m' : '';
    }
  }
  UI.wpHide = () => { for (const e of WP) e.style.display = 'none'; };

  /* ================================================================ throwing */
  CZ.throwables = ['molotov', 'pipebomb', 'noisemaker', 'flare'];
  CZ.throwItem = function (a) {
    if (CZ.isGuest && CZ.isGuest()) { CZ.ask('throw'); return; }
    const m = a.cz.m, id = CZ.throwables.find(t => m.inv[t] > 0);
    if (!id) { HUD.toast('Nothing to throw', 'warn'); return; }
    if (a.busy > 0) return;
    CZ.take(m, id, 1); a.busy = 0.5;
    const pos = GAD.throwStart(a), vel = GAD.throwVel(a, id === 'pipebomb' ? 14 : 13);
    const e = new GAD.Ent('czthrow', a, pos, { model: 'czbag', hp: 999, hitR: 0, melee: false });
    e.vel = vel; e.kind = id; e.mesh && e.mesh.scale.setScalar(0.45);
    SFX.throwS(pos);
    e.update = function (dt) {
      this.t += dt;
      if (!this.landed) {
        this.vel.y -= 9.8 * dt;
        const dir = this.vel.clone().normalize(), n = this.pos.clone().addScaledVector(this.vel, dt), h = G.world.raycast(this.pos, dir, this.vel.length() * dt + 0.05, true);
        if (h || this.t > 6) { this.landed = true; if (h) this.pos.addScaledVector(dir, Math.max(0, h.dist - 0.1)); this.land(); }
        else this.pos.copy(n);
        if (this.mesh) this.mesh.position.copy(this.pos);
        return;
      }
      if (this.kind === 'noisemaker') { if ((this.beep = (this.beep || 0) - dt) <= 0) { this.beep = 0.6; SFX.beep(this.pos, 1500, 0.6); GAME.noise(this.pos, 40, this.owner, 'gadget'); } if (this.t > 14) this.destroy('used'); }
      if (this.kind === 'flare') { if ((this.fx = (this.fx || 0) - dt) <= 0) { this.fx = 0.15; FX.puff(this.pos, 0.4, 0.5, 0xff4a2a); GAME.noise(this.pos, 18, this.owner, 'gadget'); } if (this.t > 30) this.destroy('used'); }
    };
    e.land = function () {
      const p = this.pos;
      if (this.kind === 'molotov') { SFX.glass(p); new GAD.Fire(this.owner, V().set(p.x, Math.round(p.y * 4) / 4 + 0.02, p.z), 2.8, 12); this.destroy('used'); }
      else if (this.kind === 'pipebomb') { setTimeout(() => { if (!this.alive) return; GAD.explode(this.pos.clone(), 4.5, 140, this.owner); this.destroy('used'); }, 1500); for (let i = 0; i < 3; i++) setTimeout(() => this.alive && SFX.beep(this.pos, 1900, 0.5), i * 450); }
      else if (this.kind === 'noisemaker') { this.t = 0; HUD.toast('Noisemaker going', 'info'); }
      else if (this.kind === 'flare') { this.t = 0; }
    };
  };

  /* ---- boarding up: a barricade kit nails boards across the doorway or window you face */
  CZ.boardUp = function (a) {
    const m = a.cz.m; if (!(m.inv.barricade > 0)) return;
    const e = a.eye(V()), f = a.fwd(V());
    let best = null, bd = 3;
    for (const o of G.map.openings) {
      const c = o.axis === 'z' ? V().set((o.a0 + o.a1 + 1) / 8, (o.y0 + o.y1) / 8, (o.line + 0.5) / 4) : V().set((o.line + 0.5) / 4, (o.y0 + o.y1) / 8, (o.a0 + o.a1 + 1) / 8);
      const d = c.clone().sub(e), L = d.length(); if (L > bd || d.dot(f) / L < 0.6) continue;
      bd = L; best = o;
    }
    if (!best) { HUD.toast('Face a doorway or window, close up', 'warn'); return; }
    let n = 0;
    for (let y = best.y0; y <= best.y1; y++) for (let t = best.a0; t <= best.a1; t++) { if ((y - best.y0) % 3 === 2) continue; const [x, z] = best.axis === 'z' ? [t, best.line] : [best.line, t]; const cur = G.world.get(x, y, z); if (!cur || cur === DATA.M.GLASS) { G.world.set(x, y, z, DATA.M.CZ_BOARD); n++; } }
    if (!n) { HUD.toast('Already blocked', 'warn'); return; }
    CZ.take(m, 'barricade', 1); a.busy = 2.5; a.busyLabel = 'BOARDING UP';
    for (let i = 0; i < 5; i++) setTimeout(() => SFX.wood(a.pos), i * 400);
    GAME.noise(a.pos, 22, a, 'barricade');
  };

  /* ================================================================ keys */
  let orderT = 0;
  window.addEventListener('keydown', e => {
    if (!CZ.on() || MENU.capturing) return;
    if (open) { if (e.code === 'Escape' || e.code === KEYS.map.czInv || e.code === KEYS.map.czMap) { e.preventDefault(); UI.close(); } return; }
    const watch = CZ.isWatching && CZ.isWatching();
    if (!PLAYER.locked || !G.player || (G.player.state !== 'alive' && !watch)) return;
    const a = G.player;
    if (watch) { if (e.code === KEYS.map.czInv) { e.preventDefault(); UI.inventory('pack'); } else if (e.code === KEYS.map.czMap) { e.preventDefault(); UI.map(); } return; }
    if (e.code === KEYS.map.czInv) { e.preventDefault(); UI.inventory('pack'); }
    else if (e.code === KEYS.map.czMap) { e.preventDefault(); UI.map(); }
    else if (e.code === KEYS.map.czOrders && !(CZ.isGuest && CZ.isGuest())) { orderT = G.time + 3; if (H) { H.orders.style.display = ''; H.orders.innerHTML = Object.entries(CZ.ORDERS).map(([k, o]) => '<div><kbd>' + o.key + '</kbd> ' + o.name + '</div>').join(''); } }
    else if (orderT > G.time && /^Digit[1-5]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); const k = +e.code.slice(5), o = Object.entries(CZ.ORDERS).find(([, v]) => v.key === k); if (o) CZ.orders(o[0]); orderT = 0; if (H) H.orders.style.display = 'none'; }
    else if (e.code === KEYS.map.czHeal) { e.preventDefault(); CZ.quickHeal(a); }
    else if (e.code === KEYS.map.czThrow) { e.preventDefault(); CZ.throwItem(a); }
    else if (e.code === KEYS.map.czCare && CZ.callCare) { e.preventDefault(); CZ.callCare(a); }
  }, true);
  setInterval(() => { if (H && orderT && G.time > orderT) { orderT = 0; H.orders.style.display = 'none'; } }, 500);
  // the keys, rebindable like the rest
  Object.assign(KEYS.defaults, { czInv: 'KeyI', czMap: 'KeyM', czOrders: 'KeyY', czHeal: 'Digit4', czThrow: 'Digit3', czCare: 'KeyP' });
  for (const k of ['czInv', 'czMap', 'czOrders', 'czHeal', 'czThrow', 'czCare']) if (!KEYS.map[k]) KEYS.map[k] = KEYS.defaults[k];
  KEYS.groups.push(['CITY Z', [['czInv', 'Pack, crafting, squad, stash'], ['czMap', 'Region map'], ['czOrders', 'Squad orders (then 1-5)'], ['czHeal', 'Treat yourself'], ['czThrow', 'Throw (molotov, pipe bomb, noisemaker, flare)'], ['czCare', 'Call in your care package']]]);

  /* ================================================================ menus */
  /* City Z from the home menu: continue, or a new squad */
  CZ.menu = function () {
    const s = U.$('screens'); s.innerHTML = ''; s.className = '';
    const has = CZ.hasSave(), S = has ? U.store.get(CZ.KEY, null) : null;
    const page = $('div', { class: 'panel cz-menu' },
      $('h2', {}, 'CITY Z'), $('p', { class: 'sub' }, 'Varrow, eleven weeks after the Grey Fever. Five of BLOCKADE go into the quarantine zone: find out what happened, find what can be saved, and get out. One persistent city: what you do to it stays done.'),
      has ? $('div', { class: 'cz-sum' }, $('b', {}, 'DAY ' + S.day + ' · ' + CZ.ZONES[S.zone].name), $('span', {}, CZ.DIFF[S.diff].name + ' · ' + S.squad.filter(m => m.alive).map(m => DATA.OPMAP[m.op].name).join(', ') + (S.story && S.story.ending ? ' · campaign finished' : ''))) : null,
      $('div', { class: 'actions' },
        has ? btn('CONTINUE', () => { CZ.watching = false; CZ.load(); CZ.enter(CZ.S.zone, CZ.S.side); }, 'big') : null,
        has ? btn('WATCH THE SQUAD (SPECTATE)', () => { CZ.watching = true; CZ.load(); CZ.enter(CZ.S.zone, CZ.S.side); }) : null,
        btn(has ? 'NEW CAMPAIGN' : 'START', () => { if (has) UI.confirm('Start again? Your City Z save will be lost.', () => newSquad()); else newSquad(); }, has ? '' : 'big'),
        btn('← BACK', () => MENU.home(), 'ghost')),
      $('h3', {}, 'HOW IT PLAYS'),
      $('p', { class: 'muted' }, 'Move between the city\'s places by their roads (walk to a road end and use it). Search rooms for food, water, medicine, ammunition and materials; your pack has a weight limit. Eat, drink and sleep. Bites infect; antibiotics and the antiviral slow it. Restore safehouses to sleep, store, craft and build. Keys: ' + ['czInv', 'czMap', 'czOrders', 'czHeal', 'czThrow'].map(k => KEYS.name(k)).join(' · ') + ' (pack · map · orders · treat · throw); ' + KEYS.name('interact') + ' searches, travels and uses.'));
    s.append(page);
  };
  UI.confirm = function (text, yes) {
    const s = U.$('screens'), old = s.firstChild;
    const box = $('div', { class: 'panel cz-small' }, $('h2', {}, 'ARE YOU SURE?'), $('p', {}, text), $('div', { class: 'actions' }, btn('YES', () => { yes(); }, 'big'), btn('NO', () => { s.innerHTML = ''; if (old) s.append(old); }, 'ghost')));
    s.innerHTML = ''; s.append(box);
  };
  function newSquad(initial) {
    const s = U.$('screens'); s.innerHTML = '';
    const pick = (initial || []).slice(), diff = { v: (initial && initial.diff) || 'survivor' };
    const grid = $('div', { class: 'cz-opgrid' });
    const status = $('p', { class: 'sub' });
    const draw = () => {
      grid.innerHTML = '';
      for (const o of DATA.OPS) {
        const i = pick.indexOf(o.id);
        grid.append($('div', { class: 'cz-op' + (i >= 0 ? ' on' : ''), style: { '--uc': (DATA.UNITS[o.unit] || {}).color || '#888' }, onclick: () => { if (i >= 0) pick.splice(i, 1); else if (pick.length < 5) pick.push(o.id); SFX.ui(); draw(); } },
          i >= 0 ? $('em', {}, i === 0 ? 'YOU' : String(i + 1)) : null, $('b', {}, o.name), $('span', {}, o.role || '')));
      }
      status.textContent = pick.length < 5 ? 'Pick five operators. The first you pick is you; the others follow your orders (and you can take over any of them). Or send all five in and watch them play.' : 'Squad: ' + pick.map(id => DATA.OPMAP[id].name).join(', ');
      go.disabled = pick.length < 5; watchGo.disabled = pick.length < 5;
      rand.textContent = pick.length > 0 && pick.length < 5 ? 'FILL THE REST AT RANDOM' : pick.length === 5 ? 'RANDOM AGAIN' : 'RANDOM SQUAD';
    };
    // random: fills the empty places (or, with five already, picks a whole new five); who's "you" is
    // whoever lands first
    const rand = btn('RANDOM SQUAD', () => {
      if (pick.length === 5) pick.length = 0;
      const pool = DATA.OPS.map(o => o.id).filter(id => !pick.includes(id));
      while (pick.length < 5 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      SFX.ui(); draw();
    }, 'ghost');
    const go = btn('NEXT: YOUR OPERATOR', () => { if (pick.length < 5) return; setup(pick.slice(), diff.v, kit => { CZ.watching = false; CZ.newGame(pick.slice(), diff.v, kit); if (CZ.storyIntro) CZ.storyIntro(() => CZ.enter(CZ.START, 'S')); else CZ.enter(CZ.START, 'S'); }); }, 'big');
    const watchGo = btn('SEND THEM IN AND WATCH', () => { if (pick.length < 5) return; CZ.watching = true; CZ.newGame(pick.slice(), diff.v); CZ.enter(CZ.START, 'S'); });
    const diffs = $('div', { class: 'seg' }, ...Object.entries(CZ.DIFF).map(([k, d]) => $('button', { class: diff.v === k ? 'on' : '', title: d.desc, onclick: ev => { diff.v = k; for (const b of diffs.children) b.className = ''; ev.target.className = 'on'; dd.textContent = d.desc; } }, d.name)));
    const dd = $('p', { class: 'muted' }, CZ.DIFF.survivor.desc);
    s.append($('div', { class: 'panel cz-menu wide' }, $('h2', {}, 'YOUR SQUAD'), status, grid, $('div', { class: 'cz-randrow' }, rand), $('h3', {}, 'DIFFICULTY'), diffs, dd,
      $('div', { class: 'actions' }, btn('← BACK', CZ.menu, 'ghost'), watchGo, go)));
    draw();
  }
  /* your operator for the campaign, set up as in any match: the guns and the gadget (with their
     attachments, saved for each gun as everywhere else), with the operator's bust; and City Z's own
     two: the perk and the care package. The rest of the squad choose their own (cityz-kit.js) */
  function setup(pick, diff, go) {
    const s = U.$('screens'); s.innerHTML = '';
    const op = DATA.OPMAP[pick[0]];
    const lo = Object.assign({ primary: op.primaries[0], secondary: op.secondaries[0], gadget: op.gadgets[0] }, U.store.get('lo_' + op.id, {}));
    const pref = U.store.get('czKit', {});
    let perk = CZ.OP_PERKS[pref.perk] ? pref.perk : 'gunplay', care = CZ.CARE_KINDS[pref.care] ? pref.care : 'ammo';
    const wrap = $('div', { class: 'panel cz-menu wide cz-setup' });
    const cards = (list, cur, set) => $('div', { class: 'czs-cards' }, ...Object.entries(list).map(([k, v]) => $('button', { class: 'czs-card' + (cur === k ? ' on' : ''), onclick: () => { set(k); SFX.ui(); render(); } }, $('b', {}, v.name), $('small', {}, v.desc))));
    const render = () => {
      wrap.innerHTML = '';
      const left = MENU.opDetail ? MENU.opDetail(op, lo, render) : $('div', {}, op.name);
      const mates = $('div', { class: 'czs-mates' }, ...pick.slice(1).map(id => { const o = DATA.OPMAP[id]; return $('div', { class: 'czs-mate' }, MENU.bust(o, 44), $('b', {}, o.name), $('small', {}, 'picks their own')); }));
      wrap.append($('h2', {}, 'YOUR OPERATOR'),
        $('p', { class: 'sub' }, 'Your guns, gadget and attachments, your perk, and the care package a helicopter drops for you each time the squad clears a place. The rest of the squad choose their own.'),
        $('div', { class: 'czs-body' }, left,
          $('div', { class: 'czs-right' },
            $('h3', {}, 'PERK'), cards(CZ.OP_PERKS, perk, k => { perk = k; }),
            $('h3', {}, 'CARE PACKAGE'), $('p', { class: 'muted' }, 'One for every place the squad clears, called in with ' + KEYS.name('czCare') + ' (outside, where the pilot can see you).'), cards(CZ.CARE_KINDS, care, k => { care = k; }),
            $('h3', {}, 'THE REST OF THE SQUAD'), mates)),
        $('div', { class: 'actions' }, btn('← BACK', () => { const p2 = pick.slice(); p2.diff = diff; newSquad(p2); }, 'ghost'),
          btn('GO INTO VARROW', () => { U.store.set('lo_' + op.id, lo); U.store.set('czKit', { perk, care }); go({ lo: MENU.withAttachments(lo), perk, care }); }, 'big')));
    };
    s.append(wrap); render();
  }
  CZ.setupScreen = setup;
  /* everyone dead: a new squad, the same city */
  CZ.wiped = function () {
    const S = CZ.S, home = Object.keys(S.safe).find(z => CZ.isSafe(z)) || CZ.START;
    PLAYER.release(); G.paused = true;
    const watching = CZ.isWatching && CZ.isWatching();
    let sent = false;
    const box = $('div', { class: 'panel cz-panel cz-small' }, $('h2', {}, 'THE SQUAD IS GONE'), $('p', {}, 'Day ' + S.day + '. Nobody is left of the five who went into Varrow.'),
      $('p', { class: 'sub' }, 'BLOCKADE can send another squad. The city stays as you left it: the safehouses, the stashes, the people you helped.' + (watching ? ' Watching: a new squad goes in by itself in a few seconds.' : '')),
      $('div', { class: 'actions' }, btn('SEND A NEW SQUAD', () => {
        if (sent) return; sent = true;
        const ops = DATA.OPS.filter(o => !S.squad.some(m => m.op === o.id)).sort(() => Math.random() - 0.5).slice(0, 5).map(o => o.id);
        const fresh = CZ.newGame.bind(null);
        const keep = JSON.parse(JSON.stringify(S));
        fresh(ops, S.diff);
        Object.assign(CZ.S, { zones: keep.zones, known: keep.known, visited: keep.visited, stash: keep.stash, safe: keep.safe, survivors: keep.survivors, vehicles: keep.vehicles, story: keep.story, day: keep.day + 1, min: 7 * 60, stats: keep.stats });
        UI.close(true); open = null; G.paused = false; CZ.enter(home, 'S');
      }, 'big'), btn('MAIN MENU', () => { sent = true; UI.close(true); open = null; G.paused = false; GAME.quit(); MENU.home(); }, 'ghost')));
    overlay(box);
    // watching: the campaign carries on with a new squad on its own
    if (watching) setTimeout(() => { if (!sent && box.isConnected) { const b2 = box.querySelector('.actions button'); if (b2) b2.click(); } }, 6000);
  };
})();
