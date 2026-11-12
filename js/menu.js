/* menu.js -- every screen outside the action: title, match setup, operator
   select (with a 3D preview), operator gallery, settings, controls, pause,
   match summary. */
(function () {
  'use strict';
  const { OPS, UNITS, WEAPONS, GADGETS, MODES, DIFFS } = DATA;
  const $ = U.el;
  const MENU = { cfg: U.store.get('lastMatch', { mode: 'bomb', map: 'roadhouse', side: 'random' }) };
  const scr = () => U.$('screens');
  function show(node, overlay) {
    const s = scr(); s.innerHTML = ''; s.className = overlay ? 'overlay' : ''; if (node) s.append(node);
    MENU.stopPreview();
  }
  MENU.hide = () => { scr().innerHTML = ''; scr().className = ''; MENU.stopPreview(); };
  const btn = (text, fn, cls) => $('button', { class: 'btn ' + (cls || ''), onclick: () => { SFX.init(); SFX.ui(); fn(); } }, text);
  const back = fn => btn('← BACK', fn, 'ghost');

  /* ------------------------------------------------------------- preview */
  let pr = null;
  MENU.preview = function (host, op, wid, cos) {
    if (!pr) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, devicePixelRatio));
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 1.05, 4.2); cam.lookAt(0, 0.9, 0);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: 0x1a1f28 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
      pr = { r, sc, cam, rig: null, run: false, t: 0 };
    }
    host.innerHTML = ''; host.append(pr.r.domElement);
    const w = host.clientWidth || 300, h = host.clientHeight || 360;
    pr.r.setSize(w, h); pr.cam.aspect = w / h; pr.cam.updateProjectionMatrix();
    if (pr.rig) pr.sc.remove(pr.rig.root);
    pr.rig = MD.operator(op, wid === 'shield' ? 'p10' : wid, cos || (window.SHOP && Auth.user ? SHOP.look() : null));
    if (wid === 'shield') MD.addShield(pr.rig);
    pr.rig.aim.rotation.x = -0.15;
    pr.sc.add(pr.rig.root);
    if (!pr.run) { pr.run = true; const loop = () => { if (!pr.run) return; pr.t += 0.016; if (pr.rig) { pr.rig.root.rotation.y = Math.PI + Math.sin(pr.t * 0.6) * 0.9; pr.rig.head.rotation.y = Math.sin(pr.t * 1.3) * 0.2; } pr.r.render(pr.sc, pr.cam); requestAnimationFrame(loop); }; loop(); }
  };
  MENU.stopPreview = () => { if (pr) pr.run = false; };

  /* ----------------------------------------------------------------- title */
  /* the title screen: sign in (or make a player) first, as in our other games */
  MENU.title = function () {
    if (Auth.user) return MENU.home();
    G.mode = 'menu'; HUD.show(false); PLAYER.release();
    MAIN.menuBackground();
    MUSIC.play('menu');
    const accts = Auth.list();
    show($('div', { class: 'title' },
      $('div', { class: 'logo' }, 'BLOCKADE', $('small', {}, 'TACTICAL VOXEL BREACH')),
      $('div', { class: 'menu-col' },
        accts.length ? $('div', { class: 'accts' }, $('small', {}, 'PLAYERS ON THIS DEVICE'), ...accts.slice(0, 4).map(a => $('button', { class: 'acct', onclick: () => { SFX.init(); SFX.ui(); MENU.login(a.user); } }, UI.avatar(a.id, a.user, 'sm'), $('span', {}, $('b', {}, a.user), $('small', {}, UI.tagOf(a.id) + ' · LV ' + a.lv))))) : null,
        btn('LOG IN', () => MENU.login(), accts.length ? '' : 'big'),
        btn('NEW PLAYER', () => MENU.register(), accts.length ? 'ghost' : ''),
        btn('SETTINGS', () => MENU.settings(MENU.title), 'ghost'),
        btn('CONTROLS', () => MENU.controls(MENU.title), 'ghost')),
      $('div', { class: 'foot' }, 'An original 5v5 attack-and-defend shooter. Destroy, reinforce, outthink. · Accounts live in this browser.')));
  };
  function authForm(title, isNew, preset) {
    const name = $('input', { class: 'input', maxlength: 16, placeholder: 'Player name', value: preset || '', autocomplete: 'username' });
    const pw = $('input', { class: 'input', type: 'password', maxlength: 64, placeholder: 'Password', autocomplete: isNew ? 'new-password' : 'current-password' });
    const pw2 = isNew ? $('input', { class: 'input', type: 'password', maxlength: 64, placeholder: 'Password again', autocomplete: 'new-password' }) : null;
    const rem = $('input', { type: 'checkbox', checked: true });
    const err = $('p', { class: 'err' });
    const go = async () => {
      err.textContent = '';
      if (isNew && pw.value !== pw2.value) { err.textContent = 'The passwords don\'t match.'; return; }
      const r = isNew ? await Auth.register(name.value, pw.value, rem.checked) : await Auth.login(name.value, pw.value, rem.checked);
      if (r.err) { err.textContent = r.err; SFX.ui(300); return; }
      SFX.ping();
      MENU.home(r.fresh);
    };
    for (const i of [name, pw, pw2]) if (i) i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    show($('div', { class: 'panel authpanel' },
      $('h2', {}, title),
      isNew ? $('p', { class: 'sub' }, 'Your account lives in this browser. You also get a friend code (Name#TAG) so friends can find you online.') : null,
      name, pw, pw2,
      $('label', { class: 'remember' }, rem, ' Keep me signed in on this device'),
      err,
      $('div', { class: 'actions' }, back(MENU.title), btn(isNew ? 'CREATE PLAYER' : 'LOG IN', go, 'big'))));
    setTimeout(() => (preset ? pw : name).focus(), 50);
  }
  MENU.login = preset => authForm('LOG IN', false, preset);
  MENU.register = () => authForm('NEW PLAYER', true);

  /* the home menu, once signed in */
  MENU.home = function (fresh) {
    if (!Auth.user) return MENU.title();
    G.mode = 'menu'; HUD.show(false); PLAYER.release();
    if (window.Online && Online.inRoom()) { Online.showRoom(); return; }
    MAIN.menuBackground();
    MUSIC.play('menu');
    Social.init();
    if (Auth.prefs.autoOnline && Net.state === 'off') Net.start();
    Net.setStatus('menu', 'In the menus');
    const L = Auth.level(Auth.S.xp);
    const page = $('div', { class: 'page home' }, UI.topbar(''),
      $('div', { class: 'title homet' },
        $('div', { class: 'logo' }, 'BLOCKADE', $('small', {}, 'TACTICAL VOXEL BREACH')),
        MENU.card(),
        $('div', { class: 'menu-col' },
          btn('RANKED', () => RANKED.open(), 'big hot'),
          btn('ONLINE LOBBY', () => Online.open(), 'big'),
          btn('PLAY VS BOTS', MENU.play, ''),
          btn('SHOP', () => SHOP.open()),
          btn('TRAINING', () => RANGE.tutorial()),
          btn('SHOOTING RANGE', () => MENU.rangePick()),
          btn('OPERATORS', MENU.operators),
          btn('PROFILE & STATS', () => MENU.profile()),
          btn('SETTINGS', () => MENU.settings(MENU.home)),
          btn('CONTROLS', () => MENU.controls(MENU.home))),
        $('div', { class: 'xpbar' }, $('small', {}, 'LV ' + L.lv + ' · ' + L.into + ' / ' + L.need + ' XP'), $('div', {}, $('i', { style: { width: Math.round(L.into / L.need * 100) + '%' } }))),
        $('div', { class: 'foot' }, 'Signed in as ' + Auth.name + UI.tagOf(Auth.id) + ' · ', $('button', { class: 'linkbtn', onclick: () => { Auth.logout(); MENU.title(); } }, 'log out'))));
    UI.screen(page);
    if (fresh) UI.modal({ title: 'WELCOME, ' + Auth.name.toUpperCase(), body: [$('p', {}, 'Your friend code is ', $('b', {}, Auth.name + UI.tagOf(Auth.id)), '. Share it so friends can add you.'), $('p', {}, 'New to BLOCKADE? TRAINING walks you through everything in a few minutes.')], buttons: [['START TRAINING', () => RANGE.tutorial(), 'big'], ['LATER', () => { }, 'ghost']] });
  };

  /* your player card: the banner you equipped, your name, level, rank and credits */
  MENU.card = function () {
    const S = Auth.S, R = S.rank;
    return $('div', { class: 'pbanner home', style: { background: SHOP.css('card') } }, UI.avatar(Auth.id, Auth.name, 'lg'),
      $('div', {}, $('b', {}, Auth.name, $('small', {}, ' ' + UI.tagOf(Auth.id))), $('div', { class: 'row' }, UI.lv(Auth.lv()), RANKED.badge(R.rating, R.games))),
      $('div', { class: 'grow' }), $('button', { class: 'credits', title: 'Credits: earned by playing, spent in the shop', onclick: () => SHOP.open() }, $('i', {}, '◈'), SHOP.fmt(SHOP.credits())));
  };
  /* your profile: level, record, operators, account options */
  MENU.profile = function () {
    const S = Auth.S, st = S.stats, R = S.rank, L = Auth.level(S.xp);
    const fav = Object.entries(st.ops || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const kd = st.deaths ? (st.kills / st.deaths).toFixed(2) : String(st.kills);
    const tog = (label, get, set) => $('div', { class: 'set-row tg' }, $('label', {}, label), $('button', { class: 'tog' + (get() ? ' on' : ''), onclick: e => { set(!get()); Auth.save(); e.target.classList.toggle('on', get()); e.target.textContent = get() ? 'ON' : 'OFF'; SFX.ui(); } }, get() ? 'ON' : 'OFF'));
    const page = $('div', { class: 'page profile' }, UI.topbar('PROFILE', () => MENU.home()),
      $('div', { class: 'panel profpanel' },
        $('div', { class: 'pchead', style: { background: SHOP.css('card') } }, UI.avatar(Auth.id, Auth.name, 'lg'), $('div', {},
          $('h2', {}, Auth.name, $('small', {}, ' ' + UI.tagOf(Auth.id))),
          $('div', { class: 'row' }, UI.lv(L.lv), RANKED.badge(R.rating, R.games), $('span', { class: 'muted' }, ' RATING '), UI.rating(R.rating), $('span', { class: 'muted' }, ' · peak ' + R.peak + ' · ◈ ' + SHOP.fmt(SHOP.credits()) + ' credits')),
          $('div', { class: 'xpbar' }, $('small', {}, L.into + ' / ' + L.need + ' XP to LV ' + (L.lv + 1)), $('div', {}, $('i', { style: { width: Math.round(L.into / L.need * 100) + '%' } }))))),
        $('div', { class: 'nums' },
          $('div', {}, $('b', {}, st.wins + '/' + st.matches), $('small', {}, 'MATCHES WON')),
          $('div', {}, $('b', {}, st.roundsWon + '/' + st.rounds), $('small', {}, 'ROUNDS WON')),
          $('div', {}, $('b', {}, st.kills), $('small', {}, 'KILLS')),
          $('div', {}, $('b', {}, kd), $('small', {}, 'K/D')),
          $('div', {}, $('b', {}, st.headshots), $('small', {}, 'HEADSHOTS')),
          $('div', {}, $('b', {}, R.wins + '-' + R.losses), $('small', {}, 'RANKED W-L'))),
        $('h3', {}, 'MOST PLAYED'),
        fav.length ? $('div', { class: 'favs' }, ...fav.map(([id, n]) => $('div', { class: 'os-op', style: { '--uc': UNITS[OPS.find(o => o.id === id).unit].color } }, $('b', {}, OPS.find(o => o.id === id).name), $('span', {}, n + ' match' + (n > 1 ? 'es' : ''))))) : $('p', { class: 'empty' }, 'Play a match to see your favourites here.'),
        $('h3', {}, 'ONLINE & PRIVACY'),
        tog('Go online automatically when I sign in', () => Auth.prefs.autoOnline, v => { Auth.prefs.autoOnline = v; if (v) Net.start(); }),
        tog('Only friends can message me', () => Auth.prefs.dmFrom === 'friends', v => Auth.prefs.dmFrom = v ? 'friends' : 'everyone'),
        tog('Filter swearing in chat', () => Auth.prefs.filter, v => Auth.prefs.filter = v),
        $('div', { class: 'actions' }, btn('CHANGE PASSWORD', () => changePw(), 'ghost'), btn('LOG OUT', () => { Auth.logout(); MENU.title(); }, 'ghost'))));
    UI.screen(page);
  };
  function changePw() {
    const a = $('input', { class: 'input', type: 'password', placeholder: 'Current password' }), b = $('input', { class: 'input', type: 'password', placeholder: 'New password' });
    [a, b].forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
    UI.modal({ title: 'CHANGE PASSWORD', body: [a, b], buttons: [['SAVE', () => { Auth.changePassword(a.value, b.value).then(r => UI.toast(r.err || 'Password changed.', r.err ? 'bad' : 'gold')); }, 'big'], ['CANCEL', () => { }, 'ghost']] });
  }

  /* ------------------------------------------------------------ match setup */
  MENU.play = function () {
    const c = MENU.cfg;
    const wrap = $('div', { class: 'panel setup' });
    const render = () => {
      wrap.innerHTML = '';
      const M = MODES[c.mode] || {};
      wrap.append($('h2', {}, 'CUSTOM MATCH'), $('div', { class: 'sub' }, M.ffa ? 'You against nine bots, everyone for themselves.' : 'You and four bots against five bots.'));
      wrap.append($('h3', {}, 'MODE'), $('div', { class: 'cards' }, ...Object.keys(MODES).map(k => $('div', { class: 'card' + (c.mode === k ? ' sel' : ''), onclick: () => { c.mode = k; SFX.ui(); render(); } }, $('b', {}, MODES[k].name), $('p', {}, MODES[k].desc)))));
      wrap.append($('h3', {}, 'MAP'), $('div', { class: 'cards maps' }, ...MAPS.LIST.map(m => $('div', { class: 'card map-' + m.id + (c.map === m.id ? ' sel' : ''), style: m.tint ? { backgroundImage: 'linear-gradient(135deg, ' + m.tint + ', transparent)' } : {}, onclick: () => { c.map = m.id; SFX.ui(); render(); } }, $('b', {}, m.name), $('p', {}, m.blurb)))));
      wrap.append($('div', { class: 'row3' },
        M.ffa ? null : $('div', {}, $('h3', {}, M.arcade ? 'YOUR TEAM PLAYS' : 'STARTING SIDE'), $('div', { class: 'seg' }, ...['atk', 'def', 'random'].map(s => $('button', { class: c.side === s ? 'on' : '', onclick: () => { c.side = s; SFX.ui(); render(); } }, s === 'atk' ? 'ATTACK' : s === 'def' ? 'DEFENSE' : 'RANDOM')))),
        $('div', {}, $('h3', {}, 'BOT DIFFICULTY'), $('div', { class: 'seg' }, ...DIFFS.map((d, i) => $('button', { class: G.settings.difficulty === i ? 'on' : '', onclick: () => { G.settings.difficulty = i; G.saveSettings(); SFX.ui(); render(); } }, d.name)))),
        M.arcade ? $('div', {}, $('h3', {}, 'TO WIN'), $('p', { class: 'muted' }, M.limit + ' kills or the most in ' + Math.round(M.time / 60) + ' min')) :
          $('div', {}, $('h3', {}, 'ROUNDS TO WIN'), $('div', { class: 'seg' }, ...[2, 3, 4, 5].map(n => $('button', { class: G.settings.roundsToWin === n ? 'on' : '', onclick: () => { G.settings.roundsToWin = n; G.saveSettings(); SFX.ui(); render(); } }, String(n)))))));
      wrap.append($('div', { class: 'actions' }, back(MENU.title), btn('START MATCH', () => { U.store.set('lastMatch', c); MENU.loading('Building ' + MAPS.LIST.find(m => m.id === c.map).name + '…', () => GAME.startMatch(c)); }, 'big')));
    };
    render();
    show(wrap);
  };
  MENU.loading = function (text, fn) {
    show($('div', { class: 'loading' }, $('div', { class: 'spin' }), text));
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); show($('div', { class: 'panel' }, $('h2', {}, 'Something went wrong'), $('pre', {}, String(e.stack || e)), back(MENU.title))); } }, 60);
  };

  /* --------------------------------------------------------- operator card */
  function pips(n, max) { return $('span', { class: 'pips' }, ...Array.from({ length: max }, (_, i) => $('i', { class: i < n ? 'on' : '' }))); }
  function opDetail(op, lo, onChange) {
    const u = UNITS[op.unit];
    const d = $('div', { class: 'op-detail' });
    d.append($('div', { class: 'op-title' }, $('b', {}, op.name), $('span', { class: 'unit', style: { background: u.color } }, u.name), op.season ? $('span', { class: 'season' }, 'SEASON ' + op.season) : null));
    d.append($('div', { class: 'op-real' }, op.real + ' · ' + op.role));
    d.append($('div', { class: 'op-stats' }, $('span', {}, 'ARMOR ', pips(op.armor, 3)), $('span', {}, 'SPEED ', pips(op.speed, 3))));
    d.append($('div', { class: 'op-ab' }, $('kbd', {}, KEYS.name('ability')), $('b', {}, op.ability.name), $('p', {}, op.ability.desc)));
    d.append($('p', { class: 'op-bio' }, op.bio));
    if (lo) {
      const pickRow = (label, list, key, info) => $('div', { class: 'lo-row' }, $('label', {}, label), ...list.map(id => $('button', { class: lo[key] === id ? 'on' : '', title: info(id), onclick: () => { lo[key] = id; SFX.ui(); onChange(); } }, key === 'gadget' ? GADGETS[id].name : WEAPONS[id].name)));
      d.append($('div', { class: 'loadout' },
        pickRow('PRIMARY', op.primaries, 'primary', id => WEAPONS[id].cls + (WEAPONS[id].dmg ? ' · ' + WEAPONS[id].dmg + ' dmg · ' + WEAPONS[id].rpm + ' rpm' : '')),
        pickRow('SECONDARY', op.secondaries, 'secondary', id => WEAPONS[id].cls + ' · ' + WEAPONS[id].dmg + ' dmg'),
        pickRow('GADGET', op.gadgets, 'gadget', id => GADGETS[id].desc)));
      const g = GADGETS[lo.gadget], w = WEAPONS[lo.primary];
      d.append($('div', { class: 'lo-info' }, $('p', {}, $('b', {}, w.name), ' — ' + w.cls + (w.dmg ? ' · ' + w.dmg + ' damage · ' + w.rpm + ' rpm · ' + w.mag + ' rounds' : ' · blocks bullets from the front')), $('p', {}, $('b', {}, g.name + ' ×' + g.count), ' — ' + g.desc)));
    }
    return d;
  }

  /* ---------------------------------------------------------- operator select */
  MENU.opSelect = function (cfg) {
    G.mode = 'select'; HUD.show(false); PLAYER.release();
    MUSIC.play('select');
    const side = cfg.side, ops = side === 'any' ? OPS.slice() : OPS.filter(o => o.side === side), M = MODES[cfg.mode] || {};
    const last = U.store.get('lastOp_' + side, ops[0].id);
    const banned = o => GAME.banned(o.id);
    let sel = ops.find(o => o.id === last && !banned(o)) || ops.find(o => !banned(o)) || ops[0];
    let lo = Object.assign({ primary: sel.primaries[0], secondary: sel.secondaries[0], gadget: sel.gadgets[0] }, U.store.get('lo_' + sel.id, {}));
    let spawn = 0;
    const wrap = $('div', { class: 'opsel ' + side });
    const render = () => {
      wrap.innerHTML = '';
      const modeTxt = M.arcade ? M.name + ' · first to ' + M.limit + ' kills' : cfg.mode === 'bomb' ? 'BOMB · ' + cfg.sites.join(' / ') : (cfg.mode === 'secure' ? 'SECURE AREA · ' : 'HOSTAGE · ') + cfg.sites[0];
      wrap.append($('div', { class: 'os-top' },
        $('div', { class: 'os-side' }, side === 'any' ? 'ANY OPERATOR' : side === 'atk' ? 'ATTACK' : 'DEFENSE'),
        $('div', { class: 'os-info' }, $('b', {}, (M.arcade ? '' : 'ROUND ' + (cfg.round + 1) + ' · ') + cfg.map.name + (GAME.ranked ? ' · RANKED' : '')), $('span', {}, modeTxt)),
        $('div', { class: 'os-score' }, M.arcade ? '' : cfg.score[0] + ' – ' + cfg.score[1])));
      const grid = $('div', { class: 'os-grid' });
      for (const o of ops) grid.append($('div', { class: 'os-op' + (o === sel ? ' sel' : '') + (banned(o) ? ' ban off' : ''), style: { '--uc': UNITS[o.unit].color }, onclick: () => { if (banned(o)) return; sel = o; lo = Object.assign({ primary: o.primaries[0], secondary: o.secondaries[0], gadget: o.gadgets[0] }, U.store.get('lo_' + o.id, {})); SFX.ui(); render(); } },
        $('b', {}, o.name), $('span', {}, UNITS[o.unit].name), o.season ? $('i', {}, 'S' + o.season) : null, banned(o) ? $('em', {}, 'BANNED') : null));
      const prev = $('div', { class: 'os-prev' });
      const right = $('div', { class: 'os-right' }, opDetail(sel, lo, render));
      // every player picks their own spawn: attackers one of the map's outdoor spawns,
      // defenders the objective or another room in the building
      // (Deathmatch and Team Deathmatch respawn you wherever it is safe instead)
      if (!M.arcade) {
        const spawns = side === 'atk' ? cfg.map.spawns.map(s => s.name) : GAME.defSpawnOptions(cfg.map).map(o => o.name);
        right.append($('div', { class: 'lo-row spawn' }, $('label', {}, 'SPAWN'), ...spawns.map((s, i) => $('button', { class: spawn === i ? 'on' : '', onclick: () => { spawn = i; SFX.ui(); render(); } }, s))));
      }
      right.append($('div', { class: 'actions' }, btn(cfg.online ? 'LEAVE MATCH' : 'QUIT MATCH', () => { if (cfg.online) Online.leave(); else { GAME.quit(); MENU.home(); } }, 'ghost'),
        btn('READY', () => { U.store.set('lastOp_' + side, sel.id); U.store.set('lo_' + sel.id, lo); MENU.hide(); G.mode = 'match'; HUD.show(true); cfg.onReady({ op: sel, loadout: Object.assign({}, lo, { cos: Auth.user ? SHOP.look() : null }), spawn }); }, 'big')));
      wrap.append($('div', { class: 'os-body' }, grid, prev, right));
      requestAnimationFrame(() => MENU.preview(prev, sel, lo.primary));
    };
    show(wrap);
    render();
  };

  /* ------------------------------------------------------------- ranked ban phase */
  /* cfg: { captain, capName, time, map, online, onPick(ids) }. The captain picks one attacker and
     one defender and locks them in; when the clock runs out whatever is picked goes in. */
  MENU.banSelect = function (cfg) {
    G.mode = 'select'; HUD.show(false); PLAYER.release();
    MUSIC.play('select');
    const pick = { atk: null, def: null };
    let left = cfg.time || 30, done = false, iv = 0;
    const wrap = $('div', { class: 'opsel bans' });
    const lock = () => {
      if (done) return;
      done = true; clearInterval(iv);
      cfg.onPick([pick.atk, pick.def].filter(Boolean));
      if (wrap.isConnected) render();
    };
    const render = () => {
      wrap.innerHTML = '';
      const can = cfg.captain && !done;
      wrap.append($('div', { class: 'os-top' },
        $('div', { class: 'os-side' }, 'BAN PHASE'),
        $('div', { class: 'os-info' }, $('b', {}, cfg.map.name + ' · RANKED'),
          $('span', {}, cfg.captain ? 'Ban one attacker and one defender. Nobody on either team can play them this match.' : (cfg.capName || 'Your captain') + ' is choosing the bans for your team.')),
        $('div', { class: 'os-score ban-clock' }, done ? '' : String(Math.max(0, Math.ceil(left))))));
      const body = $('div', { class: 'ban-body' });
      for (const side of ['atk', 'def']) {
        body.append($('div', { class: 'ban-col ' + side }, $('h3', {}, side === 'atk' ? 'ATTACKERS' : 'DEFENDERS'),
          $('div', { class: 'os-grid wide' }, ...OPS.filter(o => o.side === side).map(o => $('div', {
            class: 'os-op' + (pick[side] === o.id ? ' ban' : '') + (can ? '' : ' off'), style: { '--uc': UNITS[o.unit].color },
            title: o.ability ? o.ability.name + ': ' + o.ability.desc : o.role,
            onclick: () => { if (!can) return; pick[side] = pick[side] === o.id ? null : o.id; SFX.ui(); render(); },
          }, $('b', {}, o.name), $('span', {}, o.role), o.season ? $('i', {}, 'S' + o.season) : null, pick[side] === o.id ? $('em', {}, 'BAN') : null)))));
      }
      wrap.append(body);
      const n = (pick.atk ? 1 : 0) + (pick.def ? 1 : 0);
      wrap.append($('div', { class: 'actions' },
        btn(cfg.online ? 'LEAVE MATCH' : 'QUIT MATCH', () => { if (cfg.online) Online.leave(); else { GAME.quit(); MENU.home(); } }, 'ghost'),
        !cfg.captain ? $('span', { class: 'ban-wait' }, 'Waiting for the captains…')
          : done ? $('span', { class: 'ban-wait' }, 'Bans locked in. Waiting for the other team…')
            : btn(n === 2 ? 'LOCK IN BANS' : n === 1 ? 'LOCK IN 1 BAN' : 'SKIP BANS', lock, 'big')));
    };
    iv = setInterval(() => {
      if (!wrap.isConnected || done) return clearInterval(iv);
      left -= 0.25;
      const c = wrap.querySelector('.ban-clock'); if (c) c.textContent = String(Math.max(0, Math.ceil(left)));
      if (left <= 0) { if (cfg.captain) lock(); else clearInterval(iv); }
    }, 250);
    show(wrap);
    render();
  };
  /* cfg: { teams: [[ids], [ids]], my, onDone } -- what each team took off the table */
  MENU.banReveal = function (cfg) {
    G.mode = 'select'; HUD.show(false);
    const wrap = $('div', { class: 'opsel bans' });
    const row = (label, ids) => $('div', { class: 'ban-row' }, $('h3', {}, label),
      $('div', { class: 'ban-list' }, ...((ids || []).length ? ids.map(id => { const o = DATA.OPMAP[id]; return $('div', { class: 'os-op ban off', style: { '--uc': UNITS[o.unit].color } }, $('b', {}, o.name), $('span', {}, o.side === 'atk' ? 'ATTACKER' : 'DEFENDER'), $('em', {}, 'BANNED')); }) : [$('p', { class: 'ban-wait' }, 'No bans')])));
    wrap.append($('div', { class: 'os-top' }, $('div', { class: 'os-side' }, 'BANNED'),
      $('div', { class: 'os-info' }, $('b', {}, 'Out for the whole match'), $('span', {}, 'Both teams, attack and defense')), $('div', { class: 'os-score' }, '')));
    wrap.append($('div', { class: 'ban-reveal' }, row('YOUR TEAM BANNED', cfg.teams[cfg.my]), row('THE OTHER TEAM BANNED', cfg.teams[1 - cfg.my])));
    show(wrap);
    SFX.ui();
    if (cfg.onDone) setTimeout(() => { if (wrap.isConnected) cfg.onDone(); }, 4000);
  };

  /* ------------------------------------------------------------- gallery */
  MENU.operators = function () {
    let sel = OPS[0];
    const wrap = $('div', { class: 'gallery' });
    const render = () => {
      wrap.innerHTML = '';
      const list = $('div', { class: 'g-list' });
      for (const side of ['atk', 'def']) {
        list.append($('h3', {}, side === 'atk' ? 'ATTACKERS' : 'DEFENDERS'));
        list.append($('div', { class: 'os-grid' }, ...OPS.filter(o => o.side === side).map(o => $('div', { class: 'os-op' + (o === sel ? ' sel' : ''), style: { '--uc': UNITS[o.unit].color }, onclick: () => { sel = o; SFX.ui(); render(); } }, $('b', {}, o.name), $('span', {}, UNITS[o.unit].name), o.season ? $('i', {}, 'S' + o.season) : null))));
      }
      const u = UNITS[sel.unit];
      const prev = $('div', { class: 'os-prev' });
      const right = $('div', { class: 'os-right' }, opDetail(sel, null),
        $('div', { class: 'g-unit' }, $('b', { style: { color: u.color } }, u.full), $('p', {}, u.desc)),
        $('div', { class: 'g-kit' }, $('p', {}, $('b', {}, 'PRIMARY  '), sel.primaries.map(w => WEAPONS[w].name + ' (' + WEAPONS[w].cls + ')').join(' · ')),
          $('p', {}, $('b', {}, 'SECONDARY  '), sel.secondaries.map(w => WEAPONS[w].name).join(' · ')),
          $('p', {}, $('b', {}, 'GADGETS  '), sel.gadgets.map(g => GADGETS[g].name).join(' · '))),
        $('div', { class: 'actions' }, back(MENU.title), btn('TRY IN RANGE', () => RANGE.start(sel.id))));
      wrap.append($('div', { class: 'os-body' }, list, prev, right));
      requestAnimationFrame(() => MENU.preview(prev, sel, sel.primaries[0]));
    };
    show(wrap); render();
  };

  /* -------------------------------------------------------------- settings */
  MENU.settings = function (onBack, overlay) {
    const s = G.settings;
    const slider = (label, key, min, max, step, fmt) => {
      const val = $('span', { class: 'val' }, fmt ? fmt(s[key]) : s[key]);
      return $('div', { class: 'set-row' }, $('label', {}, label), $('input', { type: 'range', min, max, step, value: s[key], oninput: e => { s[key] = +e.target.value; val.textContent = fmt ? fmt(s[key]) : s[key]; if (key === 'volume') SFX.setVolume(s[key]); if (key === 'music') MUSIC.setVolume(s[key]); if (key === 'renderScale') MAIN.resize(); G.saveSettings(); } }), val);
    };
    const toggle = (label, key) => $('div', { class: 'set-row' }, $('label', {}, label), $('button', { class: 'tog' + (s[key] ? ' on' : ''), onclick: e => { s[key] = !s[key]; e.target.classList.toggle('on', s[key]); e.target.textContent = s[key] ? 'ON' : 'OFF'; G.saveSettings(); SFX.ui(); } }, s[key] ? 'ON' : 'OFF'));
    show($('div', { class: 'panel settings' },
      $('h2', {}, 'SETTINGS'),
      slider('Mouse sensitivity', 'sens', 0.2, 3, 0.05, v => v.toFixed(2)),
      slider('Aim (ADS) sensitivity', 'adsSens', 0.2, 2, 0.05, v => v.toFixed(2)),
      slider('Field of view', 'fov', 60, 100, 1),
      slider('Effects volume', 'volume', 0, 1, 0.05, v => Math.round(v * 100) + '%'),
      slider('Music volume', 'music', 0, 1, 0.05, v => Math.round(v * 100) + '%'),
      slider('Render scale', 'renderScale', 0.5, 1.5, 0.05, v => Math.round(v * 100) + '%'),
      toggle('Toggle lean (instead of hold)', 'leanToggle'),
      toggle('Toggle crouch (instead of hold)', 'crouchToggle'),
      toggle('Toggle walk (instead of hold)', 'walkToggle'),
      toggle('Toggle aim down sights (instead of hold)', 'aimToggle'),
      toggle('Invert mouse Y', 'invertY'),
      toggle('Swap sides every round', 'swapEveryRound'),
      toggle('Kill cam (replay your death and the round-ending kill)', 'killcam'),
      toggle('Show FPS', 'showFps'),
      $('div', { class: 'actions' }, back(onBack))), overlay);
  };
  /* key bindings: click a binding, press a key or mouse button */
  MENU.controls = function (onBack, overlay) {
    const s = G.settings, wrap = $('div', { class: 'panel controls' });
    let cap = null;
    const onKey = e => { if (!cap) return; e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape') KEYS.set(cap, e.code); finish(); };
    const onMouse = e => { if (!cap) return; e.preventDefault(); e.stopPropagation(); KEYS.set(cap, 'Mouse' + e.button); finish(); };
    const noMenu = e => { if (cap || MENU.capturing) e.preventDefault(); };
    function stop() { MENU.capturing = false; window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onMouse, true); }
    function finish() { cap = null; stop(); SFX.ui(1200); setTimeout(() => window.removeEventListener('contextmenu', noMenu, true), 300); render(); }
    function capture(act) {
      cap = act; MENU.capturing = true; render();
      setTimeout(() => { window.addEventListener('keydown', onKey, true); window.addEventListener('mousedown', onMouse, true); window.addEventListener('contextmenu', noMenu, true); }, 0);
    }
    const mode = (label, key, hint) => $('div', { class: 'set-row tg' }, $('label', {}, label, hint ? $('small', {}, hint) : null),
      $('div', { class: 'seg' },
        $('button', { class: !s[key] ? 'on' : '', onclick: () => { s[key] = false; G.saveSettings(); SFX.ui(); render(); } }, 'HOLD'),
        $('button', { class: s[key] ? 'on' : '', onclick: () => { s[key] = true; G.saveSettings(); SFX.ui(); render(); } }, 'TOGGLE')));
    function render() {
      wrap.innerHTML = '';
      wrap.append($('h2', {}, 'CONTROLS'), $('div', { class: 'sub' }, 'Click a binding, then press any key or mouse button (ESC cancels). Taking a key that another action uses swaps the two.'));
      wrap.append($('h3', {}, 'HOLD OR TOGGLE'),
        mode('Lean', 'leanToggle', 'Hold: lean while the key is down. Toggle: tap to lean, tap again to stand up straight.'),
        mode('Crouch', 'crouchToggle'),
        mode('Walk', 'walkToggle', 'Hold: walk slowly while the key is down. Toggle: tap to walk, tap again (or sprint) to go back to normal speed.'),
        mode('Aim down sights', 'aimToggle'));
      for (const [title, list] of KEYS.groups) {
        wrap.append($('h3', {}, title));
        wrap.append($('div', { class: 'binds' }, ...list.map(([act, label]) => $('div', { class: 'bind' + (cap === act ? ' wait' : '') }, $('span', {}, label),
          $('button', { class: 'key', onclick: () => { if (!cap) capture(act); } }, cap === act ? 'PRESS A KEY…' : KEYS.name(act))))));
      }
      wrap.append($('div', { class: 'sub' }, 'Fixed: mouse to look, ESC to pause.'));
      wrap.append($('div', { class: 'actions' }, back(() => { cap = null; stop(); onBack(); }), btn('RESET TO DEFAULTS', () => { KEYS.reset(); render(); }, 'ghost')));
    }
    render();
    show(wrap, overlay);
  };

  /* ---------------------------------------------------------------- pause */
  MENU.pause = function () {
    if (G.mode === 'menu' || G.mode === 'select') return;
    const online = GAME.net;           // an online match keeps running: nobody else is paused
    if (!online) { G.paused = true; SFX.stopAll(); }
    const resume = () => { MENU.hide(); G.paused = false; PLAYER.lock(); };
    const p = () => show($('div', { class: 'panel pause' }, $('h2', {}, online ? 'MENU' : 'PAUSED'),
      online ? $('p', { class: 'sub' }, 'The match is still running.') : null,
      btn('RESUME', resume, 'big'),
      btn('SETTINGS', () => MENU.settings(p, true)),
      btn('CONTROLS', () => MENU.controls(p, true)),
      G.mode === 'range' ? btn('CHANGE OPERATOR', () => MENU.rangePick(true)) : null,
      online ? btn('LEAVE MATCH', () => { G.paused = false; Online.leave(); }, 'ghost') :
        btn(G.mode === 'match' ? 'QUIT MATCH' : 'LEAVE', () => { G.paused = false; GAME.quit(); RANGE.stop(); MENU.home(); }, 'ghost')), true);
    p();
  };

  /* ----------------------------------------------------------- match over */
  MENU.matchOver = function (score, stats, o) {
    o = o || {};
    G.mode = 'menu'; HUD.show(false);
    const mt = o.online ? o.myTeam : GAME.myTeam || 0, ranked = !!GAME.ranked, M = MODES[GAME.mode] || {};
    GAME.restoreRanked();
    // the rows: every player, my team first (Deathmatch: by kills)
    let rows;
    if (o.online) rows = o.stats.map(s => ({ name: s.n, op: DATA.OPMAP[s.op].name, team: s.tm, me: s.h === Online.myId(), human: !!s.h, s: s.s, k: s.k, a: s.a, d: s.d, r: s.r }));
    else rows = [...stats.values()].map(s => ({ name: s.name, op: DATA.OPMAP[s.op].name, team: s.team, me: s.me, human: s.human, s: s.s, k: s.k, a: s.a, d: s.d, hs: s.hs, r: s.r }));
    if (M.ffa) rows.sort((a, b) => b.k - a.k || a.d - b.d);
    else rows.sort((a, b) => (a.team === mt ? 0 : 1) - (b.team === mt ? 0 : 1) || b.s - a.s);
    const me = rows.find(r => r.me) || {}, place = rows.indexOf(me) + 1;
    const won = M.ffa ? place === 1 : score[mt] > score[1 - mt], draw = !M.ffa && score[mt] === score[1 - mt];
    SFX.voice(won ? 'win' : 'lose'); MUSIC.sting(won); MUSIC.play('after');
    // my record: the other team's average rating is what a ranked result is measured against
    const foes = rows.filter(r => r.team !== mt), oppR = foes.length ? foes.reduce((t, r) => t + (r.r || 1000), 0) / foes.length : null;
    let rec = null;
    if (Auth.user) rec = Auth.record({ won, rounds: M.arcade ? 0 : score[0] + score[1], roundsWon: M.arcade ? 0 : score[mt], k: me.k || 0, d: me.d || 0, a: me.a || 0, hs: me.hs || 0, op: o.online ? (o.stats.find(s => s.h === Online.myId()) || {}).op : ([...stats.values()].find(s => s.me) || {}).op, online: !!o.online, ranked, oppR });
    const title = M.ffa ? ARC.ordinal(place) + ' PLACE' : draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    const big = M.ffa ? (me.k || 0) + ' KILLS' : score[mt] + ' – ' + score[1 - mt];
    // Ranked: the rank you were and the rank you are now
    let rk = null;
    if (rec && ranked && rec.delta != null) {
      const t0 = RANKED.tier(rec.before), t1 = RANKED.tier(rec.rating), up = t1.step > t0.step, down = t1.step < t0.step;
      rk = $('div', { class: 'rk-result' }, RANKED.badge(rec.rating, Auth.S.rank.games), $('b', { class: rec.delta > 0 ? 'up' : 'down' }, (rec.delta > 0 ? '+' : '') + rec.delta + ' RATING'),
        $('span', { class: 'muted' }, rec.rating + (RANKED.placing() ? ' · placements ' + Auth.S.rank.games + '/' + RANKED.PLACEMENTS : up ? ' · PROMOTED TO ' + t1.label + '!' : down ? ' · dropped to ' + t1.label : '')));
    }
    const nameCell = r => $('span', { class: 'sb-op' }, r.me ? 'YOU' : r.name, !r.me && !r.human && !ranked ? $('em', { class: 'bot' }, 'BOT') : null);
    show($('div', { class: 'panel over ' + (won ? 'win' : 'lose') },
      $('h2', {}, title), $('div', { class: 'big-score' }, big), ranked ? $('div', { class: 'muted' }, 'RANKED MATCH') : M.arcade ? $('div', { class: 'muted' }, M.name) : null,
      rec ? $('p', { class: 'xpgain' }, '+' + rec.xp + ' XP' + (rec.up ? ' · LEVEL UP! LV ' + rec.lv : '') + ' · ◈ +' + rec.cr + ' credits' + (rec.first ? ' (first win of the day +250)' : '')) : null,
      rk,
      $('div', { class: 'h-board static' }, $('div', { class: 'sb-cols' }, $('span', {}, 'PLAYER'), $('span', {}, 'OPERATOR'), $('span', {}, 'SCORE'), $('span', {}, 'K'), $('span', {}, 'A'), $('span', {}, 'D')),
        ...rows.map((r, i) => $('div', { class: 'sb-row t' + ((M.ffa ? r.me : r.team === mt) ? 0 : 1) + (r.me ? ' me' : '') }, M.ffa ? $('span', { class: 'sb-op' }, '#' + (i + 1) + ' ', nameCell(r)) : nameCell(r), $('span', {}, r.op), $('span', {}, r.s), $('span', {}, r.k), $('span', {}, r.a), $('span', {}, r.d)))),
      ranked && o.online && Online.inParty() ? $('div', { class: 'actions' }, btn('LEAVE PARTY', () => { Online.leave(true); MENU.home(); }, 'ghost'), btn('BACK TO PARTY', () => Online.showRoom(), 'big')) :
      $('div', { class: 'actions' },
        ranked ? btn('MAIN MENU', () => { if (o.online) Online.leave(true); MENU.home(); }, 'ghost') : o.online ? btn('LEAVE ROOM', () => Online.leave(), 'ghost') : btn('MAIN MENU', MENU.home, 'ghost'),
        ranked ? btn('FIND ANOTHER', () => { if (o.online) Online.leave(true); RANKED.find(); }, 'big') : o.online ? btn('BACK TO ROOM', () => Online.showRoom(), 'big') : btn('REMATCH', () => MENU.loading('Resetting…', () => GAME.startMatch(MENU.cfg)), 'big'))));
  };

  /* ----------------------------------------------------- range op picker */
  MENU.rangePick = function (inRange) {
    let side = 'atk';
    const wrap = $('div', { class: 'panel rangepick' });
    const render = () => {
      wrap.innerHTML = '';
      wrap.append($('h2', {}, 'SHOOTING RANGE'), $('div', { class: 'sub' }, 'Pick any operator. Targets at 5–50 m, a breach house with soft, reinforced and barricaded surfaces, and a drone course. Press B in the range to come back here.'));
      wrap.append($('div', { class: 'seg' }, ...['atk', 'def'].map(s => $('button', { class: side === s ? 'on' : '', onclick: () => { side = s; render(); } }, s === 'atk' ? 'ATTACKERS' : 'DEFENDERS'))));
      wrap.append($('div', { class: 'os-grid wide' }, ...OPS.filter(o => o.side === side).map(o => $('div', { class: 'os-op', style: { '--uc': UNITS[o.unit].color }, onclick: () => { SFX.ui(); if (inRange) { MENU.hide(); G.paused = false; RANGE.setOp(o.id); PLAYER.lock(); } else RANGE.start(o.id); } }, $('b', {}, o.name), $('span', {}, o.role)))));
      wrap.append($('div', { class: 'actions' }, inRange ? btn('RESUME', () => { MENU.hide(); G.paused = false; PLAYER.lock(); }) : back(MENU.title)));
    };
    render(); show(wrap, inRange);
  };

  window.MENU = MENU;
})();
