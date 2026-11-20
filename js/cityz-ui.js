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
      H.bars = {};
      for (const [k, label] of [['hp', 'HEALTH'], ['stamina', 'STAMINA'], ['hunger', 'FOOD'], ['thirst', 'WATER'], ['fatigue', 'REST'], ['infection', 'INFECTION'], ['temp', 'WARMTH']]) {
        const fill = $('i'), row = $('div', { class: 'cz-bar ' + k }, $('span', {}, label), $('b', {}, fill));
        H.bars[k] = { row, fill }; H.needs.append(row);
      }
    }
    hud.append(H.box, H.squad, H.obj, H.orders);
    H.orders.style.display = 'none';
  };
  UI.leave = function () { const n = U.$('czNight'); if (n) n.style.display = 'none'; if (H) for (const e of [H.box, H.squad, H.obj, H.orders]) e.remove(); UI.close(); };
  UI.frame = function (dt) {
    if ((hT -= dt) > 0 || !H) return; hT = 0.2;
    const S = CZ.S, p = G.player; if (!p || !p.cz) return;
    const m = p.cz.m, st = m.st;
    H.place.innerHTML = '<b>' + CZ.ZONES[CZ.Z.id].name + '</b><span>DAY ' + S.day + ' · ' + CZ.clock() + ' · ' + S.weather.toUpperCase() + (CZ.isSafe(CZ.Z.id) ? ' · SAFEHOUSE' : '') + '</span>';
    const set = (k, v, bad) => { const b = H.bars[k]; b.fill.style.width = pct(v); b.row.classList.toggle('bad', !!bad); };
    set('hp', p.hp / p.maxHp * 100, p.hp < 35);
    set('stamina', st.stamina, st.stamina < 15);
    set('hunger', 100 - st.hunger, st.hunger > 75);
    set('thirst', 100 - st.thirst, st.thirst > 75);
    set('fatigue', 100 - st.fatigue, st.fatigue > 80);
    set('infection', st.infection, st.infection > 50); H.bars.infection.row.style.display = st.infection > 0.5 ? '' : 'none';
    set('temp', (st.temp - 33) / 4.4 * 100, st.temp < 35.5);
    const tags = [];
    if (st.bleed > 0) tags.push('<i class="bad">BLEEDING ' + '●'.repeat(Math.min(4, Math.ceil(st.bleed))) + '</i>');
    if (st.fracture) tags.push('<i class="bad">BROKEN BONE</i>');
    if (st.sick > 0) tags.push('<i class="warn">SICK</i>');
    if (st.pain > 0) tags.push('<i>PAINKILLERS</i>');
    if (st.temp < 35.5) tags.push('<i class="bad">HYPOTHERMIA</i>');
    const kg = CZ.weight(m), cap = CZ.capacity(m);
    tags.push('<i class="' + (kg > cap ? 'warn' : '') + '">PACK ' + kg + ' / ' + cap + ' KG</i>');
    H.status.innerHTML = tags.join('');
    // the squad: names, health, order
    H.squad.innerHTML = '<div class="cz-ord">ORDERS · ' + CZ.ORDERS[S.order].name + ' <kbd>Y</kbd></div>' + G.actors.filter(a => a.cz && a.cz.m).map(a => '<div class="cz-mate' + (a === p ? ' me' : '') + (a.state !== 'alive' ? ' ' + a.state : '') + '"><b>' + a.op.name + '</b><i style="width:' + pct(a.state === 'dead' ? 0 : a.hp / a.maxHp * 100) + '"></i>' + (a.cz.m.st.infection > 40 ? '<em>INFECTED</em>' : '') + '</div>').join('');
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
    open = node; PLAYER.release(); G.paused = !GAME.net;
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
    const p = G.player; if (!p || !p.cz) return;
    tab = tab || UI.lastTab || 'pack'; UI.lastTab = tab;
    const S = CZ.S, z = CZ.Z.id, safe = CZ.isSafe(z) && CZ.atSafe(p);
    const tabs = [['pack', 'PACK'], ['craft', 'CRAFT'], ['squad', 'SQUAD'], ...(safe ? [['stash', 'STASH'], ['safe', 'SAFEHOUSE']] : []), ['log', 'JOURNAL']];
    if (!tabs.some(t => t[0] === tab)) tab = 'pack';
    const body = $('div', { class: 'cz-tabbody' });
    const panel = $('div', { class: 'panel cz-panel' },
      $('div', { class: 'cz-tabs' }, ...tabs.map(([k, n]) => $('button', { class: 'cz-tab' + (k === tab ? ' on' : ''), onclick: () => UI.inventory(k) }, n)), $('button', { class: 'cz-tab x', onclick: () => UI.close() }, 'CLOSE ✕')),
      body);
    ({ pack: packTab, craft: craftTab, squad: squadTab, stash: stashTab, safe: safeTab, log: logTab })[tab](body, p);
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
    const near = G.actors.filter(a => a !== p && a.cz && a.cz.m && a.state === 'alive' && U.dist3(a.pos, p.pos) < 6);
    body.append(...itemRows(m.inv, id => {
      const it = CZ.ITEMS[id] || {}, acts = [];
      if (it.use) acts.push(btn('USE', () => { CZ.use(p, id); UI.close(); }));
      if (id.startsWith('gun:')) { acts.push(btn('EQUIP PRIMARY', () => { equip(p, id.slice(4), 0); UI.inventory('pack'); })); acts.push(btn('EQUIP SECONDARY', () => { equip(p, id.slice(4), 1); UI.inventory('pack'); })); }
      if (id === 'barricade') acts.push(btn('BOARD UP', () => { UI.close(); setTimeout(() => CZ.boardUp(p), 50); }));
      for (const a of near) acts.push(btn('GIVE ' + a.op.name, () => { const n = id.startsWith('a') && CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'ammo' ? Math.min(m.inv[id], 30) : 1; const t = CZ.add(a.cz.m, id, Math.min(n, m.inv[id])); CZ.take(m, id, t); if (!t) HUD.toast(a.op.name + ' can\'t carry it', 'warn'); UI.inventory('pack'); }, 'ghost'));
      acts.push(btn('DROP', () => { const n = m.inv[id]; CZ.take(m, id, n); CZ.dropLoot(p.pos, [[id, n]], 'Dropped'); UI.inventory('pack'); }, 'ghost'));
      return acts;
    }));
  }
  /* put a found gun in hand: the old one goes into the pack */
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
    PLAYER.vmKey = '';
    HUD.toast('Equipped ' + DATA.WEAPONS[gid].name, 'info');
  }
  function craftTab(body, p) {
    const lvl = CZ.benchLevel();
    body.append($('p', { class: 'sub' }, lvl ? 'At the workbench' + (lvl > 1 ? ' and machine shop' : '') + '. Materials come from your pack, the stash and teammates beside you.' : 'By hand. A restored safehouse workbench makes more. Materials come from your pack and teammates beside you.'));
    for (const r of CZ.RECIPES) {
      const ok = CZ.canCraft(r), locked = (r.bench || 0) > lvl;
      body.append($('div', { class: 'cz-item' + (ok ? '' : ' off') },
        $('b', {}, (r.makes[1] > 1 ? r.makes[1] + ' × ' : '') + CZ.itemName(r.makes[0])),
        $('small', {}, Object.entries(r.needs).map(([k, n]) => n + ' ' + CZ.itemName(k)).join(' · ') + (r.bench ? ' · needs ' + (r.bench > 1 ? 'the machine shop' : 'the workbench') : '') + (r.fire ? ' · cooked' : '')),
        $('div', { class: 'cz-acts' }, locked ? $('span', { class: 'muted' }, 'LOCKED') : btn('MAKE', () => { CZ.craft(r.id); UI.inventory('craft'); }, ok ? '' : 'ghost'))));
    }
  }
  function squadTab(body, p) {
    for (const a of G.actors.filter(x => x.cz && x.cz.m)) {
      const m = a.cz.m, st = m.st;
      const card = $('div', { class: 'cz-mcard' + (a === p ? ' me' : '') },
        $('b', {}, a.op.name + ' · ' + a.name + (a === p ? ' (YOU)' : '')),
        $('span', {}, a.state === 'dead' ? 'DEAD' : 'Health ' + Math.round(a.hp) + ' · Food ' + Math.round(100 - st.hunger) + '% · Water ' + Math.round(100 - st.thirst) + '% · Rest ' + Math.round(100 - st.fatigue) + '%' + (st.infection > 0.5 ? ' · Infection ' + Math.round(st.infection) + '%' : '') + (st.bleed > 0 ? ' · bleeding' : '') + (st.fracture ? ' · broken bone' : '')),
        $('small', {}, 'Pack ' + CZ.weight(m) + ' / ' + CZ.capacity(m) + ' kg: ' + (CZ.itemsText(m.inv) || 'empty')),
        a !== p && a.state === 'alive' ? $('div', { class: 'cz-acts' },
          btn('PLAY AS ' + a.op.name, () => { UI.close(); CZ.takeControl(a); }),
          U.dist3(a.pos, p.pos) < 6 ? btn('TAKE THEIR SUPPLIES', () => { for (const [id, n] of Object.entries(m.inv)) { if (CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'ammo' && (CZ.calOf(a.w[0].id) === id || CZ.calOf(a.w[1] ? a.w[1].id : '') === id)) continue; const t = CZ.add(p.cz.m, id, n); CZ.take(m, id, t); } UI.inventory('squad'); }, 'ghost') : null) : null);
      body.append(card);
    }
    const fallen = CZ.S.squad.filter(m => !m.alive);
    if (fallen.length) body.append($('h3', {}, 'LOST'), $('p', { class: 'muted' }, fallen.map(m => DATA.OPMAP[m.op].name + ' · ' + m.name).join(', ')));
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
      $('div', { class: 'actions' }, btn('UNTIL MORNING', () => { UI.close(); CZ.sleep(); }, 'big'), btn('4 HOURS', () => { UI.close(); CZ.sleep(4); }), btn('1 HOUR', () => { UI.close(); CZ.sleep(1); }), btn('NOT NOW', () => UI.close(), 'ghost'))));
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
  };

  /* ================================================================ throwing */
  CZ.throwables = ['molotov', 'pipebomb', 'noisemaker', 'flare'];
  CZ.throwItem = function (a) {
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
    if (!PLAYER.locked || !G.player || G.player.state !== 'alive') return;
    const a = G.player;
    if (e.code === KEYS.map.czInv) { e.preventDefault(); UI.inventory('pack'); }
    else if (e.code === KEYS.map.czMap) { e.preventDefault(); UI.map(); }
    else if (e.code === KEYS.map.czOrders) { orderT = G.time + 3; if (H) { H.orders.style.display = ''; H.orders.innerHTML = Object.entries(CZ.ORDERS).map(([k, o]) => '<div><kbd>' + o.key + '</kbd> ' + o.name + '</div>').join(''); } }
    else if (orderT > G.time && /^Digit[1-5]$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); const k = +e.code.slice(5), o = Object.entries(CZ.ORDERS).find(([, v]) => v.key === k); if (o) CZ.orders(o[0]); orderT = 0; if (H) H.orders.style.display = 'none'; }
    else if (e.code === KEYS.map.czHeal) { e.preventDefault(); CZ.quickHeal(a); }
    else if (e.code === KEYS.map.czThrow) { e.preventDefault(); CZ.throwItem(a); }
  }, true);
  setInterval(() => { if (H && orderT && G.time > orderT) { orderT = 0; H.orders.style.display = 'none'; } }, 500);
  // the keys, rebindable like the rest
  Object.assign(KEYS.defaults, { czInv: 'KeyI', czMap: 'KeyM', czOrders: 'KeyY', czHeal: 'Digit4', czThrow: 'Digit3' });
  for (const k of ['czInv', 'czMap', 'czOrders', 'czHeal', 'czThrow']) if (!KEYS.map[k]) KEYS.map[k] = KEYS.defaults[k];
  KEYS.groups.push(['CITY Z', [['czInv', 'Pack, crafting, squad, stash'], ['czMap', 'Region map'], ['czOrders', 'Squad orders (then 1-5)'], ['czHeal', 'Treat yourself'], ['czThrow', 'Throw (molotov, pipe bomb, noisemaker, flare)']]]);

  /* ================================================================ menus */
  /* City Z from the home menu: continue, or a new squad */
  CZ.menu = function () {
    const s = U.$('screens'); s.innerHTML = ''; s.className = '';
    const has = CZ.hasSave(), S = has ? U.store.get(CZ.KEY, null) : null;
    const page = $('div', { class: 'panel cz-menu' },
      $('h2', {}, 'CITY Z'), $('p', { class: 'sub' }, 'Varrow, eleven weeks after the Grey Fever. Five of BLOCKADE go into the quarantine zone: find out what happened, find what can be saved, and get out. One persistent city: what you do to it stays done.'),
      has ? $('div', { class: 'cz-sum' }, $('b', {}, 'DAY ' + S.day + ' · ' + CZ.ZONES[S.zone].name), $('span', {}, CZ.DIFF[S.diff].name + ' · ' + S.squad.filter(m => m.alive).map(m => DATA.OPMAP[m.op].name).join(', ') + (S.story && S.story.ending ? ' · campaign finished' : ''))) : null,
      $('div', { class: 'actions' },
        has ? btn('CONTINUE', () => { CZ.load(); CZ.enter(CZ.S.zone, CZ.S.side); }, 'big') : null,
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
  function newSquad() {
    const s = U.$('screens'); s.innerHTML = '';
    const pick = [], diff = { v: 'survivor' };
    const grid = $('div', { class: 'cz-opgrid' });
    const status = $('p', { class: 'sub' });
    const draw = () => {
      grid.innerHTML = '';
      for (const o of DATA.OPS) {
        const i = pick.indexOf(o.id);
        grid.append($('div', { class: 'cz-op' + (i >= 0 ? ' on' : ''), style: { '--uc': (DATA.UNITS[o.unit] || {}).color || '#888' }, onclick: () => { if (i >= 0) pick.splice(i, 1); else if (pick.length < 5) pick.push(o.id); SFX.ui(); draw(); } },
          i >= 0 ? $('em', {}, i === 0 ? 'YOU' : String(i + 1)) : null, $('b', {}, o.name), $('span', {}, o.role || '')));
      }
      status.textContent = pick.length < 5 ? 'Pick five operators. The first you pick is you; the others follow your orders (and you can take over any of them).' : 'Squad: ' + pick.map(id => DATA.OPMAP[id].name).join(', ');
      go.disabled = pick.length < 5;
    };
    const go = btn('GO INTO VARROW', () => { if (pick.length < 5) return; CZ.newGame(pick.slice(), diff.v); if (CZ.storyIntro) CZ.storyIntro(() => CZ.enter(CZ.START, 'S')); else CZ.enter(CZ.START, 'S'); }, 'big');
    const diffs = $('div', { class: 'seg' }, ...Object.entries(CZ.DIFF).map(([k, d]) => $('button', { class: diff.v === k ? 'on' : '', title: d.desc, onclick: ev => { diff.v = k; for (const b of diffs.children) b.className = ''; ev.target.className = 'on'; dd.textContent = d.desc; } }, d.name)));
    const dd = $('p', { class: 'muted' }, CZ.DIFF.survivor.desc);
    s.append($('div', { class: 'panel cz-menu wide' }, $('h2', {}, 'YOUR SQUAD'), status, grid, $('h3', {}, 'DIFFICULTY'), diffs, dd,
      $('div', { class: 'actions' }, btn('← BACK', CZ.menu, 'ghost'), go)));
    draw();
  }
  /* everyone dead: a new squad, the same city */
  CZ.wiped = function () {
    const S = CZ.S, home = Object.keys(S.safe).find(z => CZ.isSafe(z)) || CZ.START;
    PLAYER.release(); G.paused = true;
    overlay($('div', { class: 'panel cz-panel cz-small' }, $('h2', {}, 'THE SQUAD IS GONE'), $('p', {}, 'Day ' + S.day + '. Nobody is left of the five who went into Varrow.'),
      $('p', { class: 'sub' }, 'BLOCKADE can send another squad. The city stays as you left it: the safehouses, the stashes, the people you helped.'),
      $('div', { class: 'actions' }, btn('SEND A NEW SQUAD', () => {
        const ops = DATA.OPS.filter(o => !S.squad.some(m => m.op === o.id)).sort(() => Math.random() - 0.5).slice(0, 5).map(o => o.id);
        const fresh = CZ.newGame.bind(null);
        const keep = JSON.parse(JSON.stringify(S));
        fresh(ops, S.diff);
        Object.assign(CZ.S, { zones: keep.zones, known: keep.known, visited: keep.visited, stash: keep.stash, safe: keep.safe, survivors: keep.survivors, vehicles: keep.vehicles, story: keep.story, day: keep.day + 1, min: 7 * 60, stats: keep.stats });
        UI.close(true); open = null; G.paused = false; CZ.enter(home, 'S');
      }, 'big'), btn('MAIN MENU', () => { UI.close(true); open = null; G.paused = false; GAME.quit(); MENU.home(); }, 'ghost'))));
  };
})();
