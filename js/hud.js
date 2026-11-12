/* hud.js -- the in-game overlay (DOM). */
(function () {
  'use strict';
  const { GADGETS } = DATA;
  const H = { el: {}, markers: [], toasts: [], feedDirty: true, banT: 0, pings: [], hurtArcs: [], dmgNums: [] };
  const $ = U.el;
  const V = () => new THREE.Vector3();

  H.init = function () {
    const root = U.$('hud');
    root.innerHTML = '';
    const e = H.el;
    e.top = $('div', { class: 'h-top' },
      e.t0 = $('div', { class: 'h-team t0' }), e.s0 = $('div', { class: 'h-score s0' }, '0'),
      $('div', { class: 'h-clock' }, e.timer = $('div', { class: 'h-timer' }, '0:45'), e.phase = $('div', { class: 'h-phase' }, 'PREPARATION')),
      e.s1 = $('div', { class: 'h-score s1' }, '0'), e.t1 = $('div', { class: 'h-team t1' }));
    e.obj = $('div', { class: 'h-obj' });
    e.feed = $('div', { class: 'h-feed' });
    e.cross = $('div', { class: 'h-cross' }, $('i', { class: 'c-t' }), $('i', { class: 'c-b' }), $('i', { class: 'c-l' }), $('i', { class: 'c-r' }), $('b', { class: 'c-d' }));
    e.hit = $('div', { class: 'h-hit' });
    e.ret = $('div', { class: 'h-ret' });
    e.prompt = $('div', { class: 'h-prompt' }, e.pring = $('div', { class: 'p-ring' }), e.ptext = $('div', { class: 'p-text' }));
    e.toasts = $('div', { class: 'h-toasts' });
    e.hp = $('div', { class: 'h-hp' },
      e.opname = $('div', { class: 'hp-op' }),
      $('div', { class: 'hp-bar' }, e.hpfill = $('div', { class: 'hp-fill' }), e.hpover = $('div', { class: 'hp-over' })),
      e.hpnum = $('div', { class: 'hp-num' }), e.status = $('div', { class: 'hp-status' }));
    e.wpn = $('div', { class: 'h-wpn' },
      e.wname = $('div', { class: 'w-name' }), $('div', { class: 'w-ammo' }, e.mag = $('b', {}, '30'), e.res = $('span', {}, '/150')),
      e.slots = $('div', { class: 'w-slots' }));
    e.mode = $('div', { class: 'h-view' });
    e.markers = $('div', { class: 'h-markers' });
    e.banner = $('div', { class: 'h-banner' }, e.b1 = $('div', { class: 'b1' }), e.b2 = $('div', { class: 'b2' }));
    e.board = $('div', { class: 'h-board' });
    e.hurt = $('div', { class: 'h-hurt' });
    e.fps = $('div', { class: 'h-fps' });
    e.hint = $('div', { class: 'h-hint' });
    e.chat = $('div', { class: 'h-chat' });
    e.chatIn = $('input', { class: 'h-chatin', maxlength: 160, placeholder: 'Room chat (Enter to send, Esc to cancel)' });
    e.chatIn.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { if (e.chatIn.value.trim()) Online.say(e.chatIn.value); H.closeChat(); } else if (ev.key === 'Escape') H.closeChat(); });
    root.append(e.chat, e.chatIn, e.markers, e.top, e.obj, e.feed, e.cross, e.ret, e.hit, e.prompt, e.toasts, e.hp, e.wpn, e.mode, e.banner, e.board, e.hurt, e.fps, e.hint);
    for (let i = 0; i < 40; i++) { const m = $('div', { class: 'mk' }); m.style.display = 'none'; e.markers.append(m); H.markers.push(m); }
  };
  H.show = v => { U.$('hud').hidden = !v; };
  /* room chat during an online match */
  H.chatLine = c => {
    const line = $('div', { class: 'hc' + (c.sys ? ' sys' : '') }, c.sys ? c.sys : [$('b', { class: c.tm === GAME.myTeam ? 'mine' : 'theirs' }, c.n + ': '), (Auth.S && Auth.S.prefs.filter ? U.unswear(c.x) : c.x)]);
    H.el.chat.append(line); setTimeout(() => line.classList.add('old'), 9000);
    while (H.el.chat.children.length > 7) H.el.chat.firstChild.remove();
  };
  H.openChat = () => { if (!window.Online || !Online.inRoom()) return; H.el.chatIn.style.display = 'block'; H.el.chatIn.value = ''; PLAYER.down = {}; setTimeout(() => H.el.chatIn.focus(), 0); };
  H.closeChat = () => { H.el.chatIn.style.display = 'none'; H.el.chatIn.blur(); };
  H.roundStart = function () { H.feedDirty = true; H.teamKey = ''; H.el.board.style.display = 'none'; H.pings = []; H.el.hint.textContent = ''; };

  H.toast = function (text, kind) {
    const t = $('div', { class: 'toast ' + (kind || '') }, text);
    H.el.toasts.prepend(t);
    setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
    while (H.el.toasts.children.length > 4) H.el.toasts.lastChild.remove();
  };
  H.banner = function (a, b, dur, kind) {
    H.el.b1.textContent = a; H.el.b2.textContent = b || '';
    H.el.banner.className = 'h-banner on ' + (kind || '');
    H.banT = dur || 2;
  };
  H.hitmarker = function (head, kill) {
    const h = H.el.hit; h.className = 'h-hit on' + (head ? ' head' : '') + (kill ? ' kill' : '');
    clearTimeout(H.hitTO); H.hitTO = setTimeout(() => h.className = 'h-hit', kill ? 260 : 140);
    SFX.hit(head);
  };
  H.hurt = function (dir) {
    const a = G.player; if (!a) return;
    U.$('dmgVignette').style.opacity = 0.7; H.vigT = 0.6;
    if (!dir) return;
    // dir is the way the hit travelled, so it came from -dir. Its angle from where you face
    // (0 ahead, positive to your left) turns the arc, which sits at the top of its ring when
    // unrotated: ahead shows at the top, behind at the bottom, left on the left
    const ang = U.wrap(Math.atan2(dir.x, dir.z) - a.yaw);
    const arc = $('div', { class: 'arc' }); arc.style.transform = 'translate(-50%,-50%) rotate(' + (-ang * 180 / Math.PI) + 'deg)';
    H.el.hurt.append(arc); setTimeout(() => arc.remove(), 900);
  };
  H.flash = function (k) { const f = U.$('flash'); f.style.transition = 'none'; f.style.opacity = Math.min(1, k * 1.2); H.flashT = 4.5 * k; };
  H.reticle = function (s) { if (H._ret !== s) { H._ret = s; H.el.ret.className = 'h-ret ' + s; } };
  H.scope = function (on) { const s = U.$('scope'); if (H._scope !== on) { H._scope = on; s.style.display = on ? 'block' : 'none'; H.el.cross.style.visibility = on ? 'hidden' : ''; } };
  H.pingAt = function (p) { H.pings.push({ p, t: G.time + 4 }); };
  H.dmgNumber = function (p, n, head) { H.dmgNums.push({ p: p.clone(), n: Math.round(n), head, t: G.time }); };
  H.scoreboard = function (on) {
    const b = H.el.board;
    if (!on || !G.player || G.mode !== 'match') { b.style.display = 'none'; return; }
    b.style.display = 'block'; b.innerHTML = '';
    // a player's name; bots carry a small BOT tag except in Ranked, where they stand in for players
    const nameOf = a => $('span', {}, a.isPlayer ? 'YOU' : GAME.who(a), !a.isPlayer && !a.net && !a.netHuman && !GAME.ranked ? $('em', { class: 'bot' }, 'BOT') : null);
    if (GAME.ffa) {
      b.append($('div', { class: 'sb-head t0' }, 'DEATHMATCH', $('span', {}, 'FIRST TO ' + DATA.MODES.dm.limit)));
      ARC.standings().forEach((a, i) => {
        const s = a.match;
        b.append($('div', { class: 'sb-row ' + (a.isPlayer ? 't0 me' : 't1') + (a.state === 'dead' ? ' dead' : '') },
          $('span', { class: 'sb-op', style: { borderColor: DATA.UNITS[a.op.unit].color } }, '#' + (i + 1) + ' ' + a.op.name), nameOf(a), $('span', {}, s.s), $('span', {}, s.k), $('span', {}, s.a), $('span', {}, s.d)));
      });
      b.prepend($('div', { class: 'sb-cols' }, $('span', {}, 'OPERATOR'), $('span', {}, ''), $('span', {}, 'SCORE'), $('span', {}, 'K'), $('span', {}, 'A'), $('span', {}, 'D')));
      return;
    }
    for (const team of [GAME.myTeam, 1 - GAME.myTeam]) {
      const side = GAME.sideOf(team);
      const rows = G.actors.filter(a => a.team === team && !a.hostage);
      const mineT = team === GAME.myTeam;
      b.append($('div', { class: 'sb-head t' + (mineT ? 0 : 1) }, mineT ? 'YOUR TEAM' : 'ENEMY TEAM', $('span', {}, GAME.arcade ? GAME.score[team] + ' KILLS' : side === 'atk' ? 'ATTACK' : 'DEFENSE')));
      for (const a of rows) {
        const s = a.match || { k: 0, d: 0, a: 0, s: 0 };
        b.append($('div', { class: 'sb-row t' + (team === GAME.myTeam ? 0 : 1) + (a.isPlayer ? ' me' : '') + (a.state === 'dead' ? ' dead' : '') },
          $('span', { class: 'sb-op', style: { borderColor: DATA.UNITS[a.op.unit].color } }, a.op.name), nameOf(a),
          $('span', {}, s.s), $('span', {}, s.k), $('span', {}, s.a), $('span', {}, s.d)));
      }
    }
    b.prepend($('div', { class: 'sb-cols' }, $('span', {}, 'OPERATOR'), $('span', {}, ''), $('span', {}, 'SCORE'), $('span', {}, 'K'), $('span', {}, 'A'), $('span', {}, 'D')));
  };

  function project(p, out) {
    const v = U.v1.copy(p).project(G.camera);
    if (v.z > 1 || v.z < -1) return false;
    out.x = (v.x * 0.5 + 0.5) * innerWidth; out.y = (-v.y * 0.5 + 0.5) * innerHeight;
    return out.x > -40 && out.x < innerWidth + 40 && out.y > -40 && out.y < innerHeight + 40;
  }

  H.update = function (dt) {
    const a = G.player, e = H.el; if (!a) return;
    const isMatch = G.mode === 'match';
    e.top.style.display = isMatch ? '' : 'none';
    // ---- clock & teams
    if (isMatch) {
      const ph = GAME.phase;
      const d = GAME.obj.defuser;
      e.timer.textContent = d && d.alive ? U.fmtTime(d.left) : U.fmtTime(GAME.timer);
      e.timer.classList.toggle('planted', !!(d && d.alive));
      e.phase.textContent = GAME.arcade ? (ph === 'post' ? 'MATCH OVER' : 'FIRST TO ' + DATA.MODES[GAME.mode].limit) : ph === 'prep' ? 'PREPARATION' : ph === 'action' ? (d && d.alive ? 'DEFUSER PLANTED' : 'ACTION') : ph === 'post' ? 'ROUND OVER' : '';
      const MT = GAME.myTeam;
      if (GAME.ffa) return arcadeTop(a, e, dt);
      e.s0.textContent = GAME.score[GAME.myTeam]; e.s1.textContent = GAME.score[1 - GAME.myTeam];
      const key = MT + G.actors.map(x => x.state + (x.marks && GAME.marked(x, MT) ? 'm' : '')).join();
      if (key !== H.teamKey) {
        H.teamKey = key;
        for (const t of [MT, 1 - MT]) {
          const box = t !== MT ? e.t1 : e.t0; box.innerHTML = '';
          for (const x of G.actors.filter(q => q.team === t && !q.hostage)) {
            const known = t === MT || x.state !== 'alive' || GAME.marked(x, MT);
            box.append($('div', { class: 'ti ' + x.state + (x.isPlayer ? ' me' : ''), title: (x.net || x.netHuman ? x.name + ' · ' : '') + x.op.name, style: { borderColor: DATA.UNITS[x.op.unit].color } }, known ? x.op.name.slice(0, 3) : '?'));
          }
        }
        e.t0.className = 'h-team t0 ' + GAME.sideOf(MT); e.t1.className = 'h-team t1 ' + GAME.sideOf(1 - MT);
      }
      // objective line
      let o = '';
      const side = a.side, mode = GAME.mode;
      if (GAME.arcade) o = 'First team to ' + DATA.MODES[mode].limit + ' kills wins';
      else if (ph === 'prep') o = side === 'atk' ? KEYS.fmt('Drone the building: find the objective and spot defenders [{fire}]') : KEYS.fmt('Reinforce walls [hold {interact}], barricade [{interact}], set your gadgets');
      else if (mode === 'bomb') o = d && d.alive ? (side === 'atk' ? 'Protect the defuser' : 'Disable the defuser!') : (side === 'atk' ? (a.carry === 'defuser' ? 'You carry the defuser: plant it in ' + GAME.siteNames.join(' or ') : 'Plant the defuser in ' + GAME.siteNames.join(' or ')) : 'Defend ' + GAME.siteNames.join(' and '));
      else if (mode === 'secure') o = (side === 'atk' ? 'Secure ' : 'Hold ') + GAME.siteNames[0] + (GAME.obj.prog > 0 ? '  ·  ' + Math.round(GAME.obj.prog / 10 * 100) + '%' + (GAME.obj.contested ? ' CONTESTED' : '') : '');
      else if (mode === 'hostage') o = side === 'atk' ? (a.carry && a.carry.hostage ? 'Get the hostage to an extraction zone' : 'Extract the hostage from ' + GAME.siteNames[0]) : 'Keep the hostage in ' + GAME.siteNames[0];
      e.obj.textContent = o;
      e.obj.style.display = '';
    } else e.obj.style.display = 'none';
    H.body(a, e, dt);
  };
  /* Deathmatch: you and the leader instead of two teams */
  function arcadeTop(a, e, dt) {
    const st = ARC.standings(), me = st.indexOf(a), lead = st[0] === a ? st[1] : st[0];
    e.s0.textContent = a.match ? a.match.k : 0; e.s1.textContent = lead && lead.match ? lead.match.k : 0;
    const key = 'dm' + (me + 1) + (lead ? GAME.who(lead) : '');
    if (key !== H.teamKey) {
      H.teamKey = key;
      e.t0.innerHTML = ''; e.t1.innerHTML = '';
      e.t0.append($('div', { class: 'ti me alive dmt' }, 'YOU · ' + ARC.ordinal(me + 1)));
      if (lead) e.t1.append($('div', { class: 'ti alive dmt' }, (st[0] === a ? '2ND · ' : 'LEADER · ') + GAME.who(lead)));
      e.t0.className = 'h-team t0 dm'; e.t1.className = 'h-team t1 dm';
    }
    e.obj.textContent = 'Everyone for themselves · first to ' + DATA.MODES.dm.limit + ' kills';
    e.obj.style.display = '';
    H.body(a, e, dt);
  }
  H.body = function (a, e, dt) {
    const isMatch = G.mode === 'match';
    // ---- health
    e.opname.textContent = a.op.name + (a.isPlayer && a.side ? ' · ' + (a.side === 'atk' ? 'ATTACK' : 'DEFENSE') : '');
    e.hpfill.style.width = Math.max(0, a.hp / a.maxHp * 100) + '%';
    e.hpover.style.width = Math.min(100, a.over / a.maxHp * 100) + '%';
    e.hpnum.textContent = Math.ceil(a.hp + a.over);
    e.hp.classList.toggle('low', a.hp < 30);
    e.status.textContent = a.state === 'dbno' ? 'DOWN · bleeding out ' + Math.ceil(a.bleed) + 's' :
      a.cloakT > 0 ? 'CLOAKED' + (GAME.client ? '' : ' ' + Math.ceil(a.cloakT) + 's') : a.odT > 0 ? 'OVERDRIVE ' + Math.ceil(a.odT) + 's' : a.exhT > 0 ? 'WINDED' : a.ramT > 0 ? 'BATTERING CHARGE ' + Math.ceil(a.ramT) + 's · sprint into a soft wall' :
      a.misfire > G.time ? 'MISFIRE COIL NEARBY · weapon jamming' : GAME.dark && GAME.dark(a.team) ? 'BLACKOUT' : a.nullT > G.time ? 'NULL FIELD · you cannot be marked' : a.rooted > 0 ? 'SNARED' : a.stun > 0 ? 'CONCUSSED' : a.slow > 0 ? 'IN WIRE' : a.over > 0 ? 'OVERHEALED' : a.carry === 'defuser' ? 'CARRYING DEFUSER' : a.walk && a.moving > 0.3 ? 'WALKING · quiet' : '';
    // ---- weapon & slots
    const w = a.wpn;
    if (w) {
      e.wname.textContent = (a.shieldOp && a.shieldUp ? 'BULWARK + ' : '') + w.def.name + (w.def.auto ? (w.auto ? '  AUTO' : '  SINGLE') : '');
      e.mag.textContent = w.reload > 0 ? '··' : w.mag; e.res.textContent = '/' + w.reserve;
      e.mag.classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.25));
    }
    H.slotT = (H.slotT || 0) - dt;
    if (H.slotT <= 0) {
      H.slotT = 0.15;
      e.slots.innerHTML = '';
      const slot = (key, name, val, dim) => e.slots.append($('div', { class: 'slot' + (dim ? ' dim' : '') }, $('kbd', {}, key), $('span', {}, name), $('b', {}, val)));
      if (a.gadget) { const g = GADGETS[a.gadget.id]; const det = a.placed.some(x => x.alive && x.type === a.gadget.id && x.detonate) || a.netPlaced > 0; slot(KEYS.name('gadget'), det ? 'DETONATE' : g.name, a.gadget.count, a.gadget.count <= 0 && !det); }
      if (a.ability) {
        const ab = a.op.ability, cnt = ab.cd ? (a.ability.cd > 0 ? Math.ceil(a.ability.cd) + 's' : 'READY') : a.ability.id === 'surge' ? a.ability.zaps + ' zaps' : ab.count >= 99 ? '' : a.ability.count;
        slot(KEYS.name('ability'), ab.name, cnt, ab.count < 99 && a.ability.count <= 0);
      }
      // Deathmatch / Team Deathmatch have no drones, cameras or reinforcements
      if (!(G.mode === 'match' && GAME.arcade)) {
        if (a.side === 'atk') slot(KEYS.name('device'), 'DRONE', a.drones + G.ents.filter(x => x.alive && x.type === 'drone' && x.owner === a).length);
        else slot(KEYS.name('device'), 'CAMERAS', GAD.cams(a.team).length);
        if (a.side === 'def' && G.mode === 'match') slot(KEYS.name('interact'), 'REINFORCEMENTS', GAME.pool[a.team] || 0);
      }
    }
    // ---- view mode overlay
    const P = PLAYER;
    let vtxt = '';
    if (P.view === 'drone') vtxt = 'DRONE' + (P.drone && P.drone.jamT > 0.05 ? ' · SIGNAL JAMMED' : '') + KEYS.fmt('<small>{forward}{left}{back}{right} drive · {sprint} boost ' + (P.dBoostCd > 0.05 ? '(' + Math.ceil(P.dBoostCd) + 's)' : '(ready)') + ' · {vault} jump · {fire} spot' + (P.drone && P.drone.surge ? ' · {aim} surge (' + a.ability.zaps + ')' : '') + ' · {device} exit</small>');
    else if (P.view === 'cams') vtxt = (P.cam ? P.cam.name : 'CAMERA') + KEYS.fmt('<small>{left}/{right} switch · {fire} spot · {device} exit</small>');
    else if (P.view === 'spectate') vtxt = 'SPECTATING ' + (P.spec ? P.spec.op.name : '—') + KEYS.fmt('<small>{fire}/{aim} switch · {device} ' + (a.side === 'atk' ? 'drones' : 'cameras') + '</small>');
    else if (a.state === 'dbno') vtxt = 'DOWN<small>wait for a teammate to revive you</small>';
    else if (a.state === 'dead' && GAME.arcade && GAME.phase === 'action') { const t = (GAME.client ? P.respawnAt : a.respawnAt) - G.time; vtxt = t > 0 ? 'RESPAWNING IN ' + Math.ceil(t) + '<small>' + (P.killer && P.killer !== a ? 'eliminated by ' + GAME.who(P.killer) : '') + '</small>' : 'RESPAWNING…'; }
    if (H._v !== vtxt) { H._v = vtxt; e.mode.innerHTML = vtxt; e.mode.style.display = vtxt ? '' : 'none'; }
    U.$('fxLayer').className = P.view === 'drone' ? 'drone' : P.view === 'cams' ? 'cams' : '';
    // ---- crosshair
    const showX = P.view === 'body' && a.state === 'alive' && a.ads < 0.6 && !(a.sprint && a.moving > 3.5);
    e.cross.style.opacity = showX ? 1 : 0;
    if (showX && w) {
      const sp = WPN.spreadNow(a); const px = Math.tan(sp * Math.PI / 180) / Math.tan(G.camera.fov * Math.PI / 360) * innerHeight / 2;
      e.cross.style.setProperty('--gap', Math.max(4, px) + 'px');
    }
    // ---- interaction prompt
    let pr = '', prog = 0;
    if (a.interact) { pr = a.interact.it.label; prog = a.interact.t / a.interact.it.time; }
    else if (P.view === 'body' && a.state === 'alive' && (G.mode === 'match' || G.mode === 'range')) {
      H.intT = (H.intT || 0) - dt;
      if (H.intT <= 0) {
        H.intT = 0.12; const its = GAME.interactions(a); H.intLabel = its.length ? '[' + KEYS.name('interact') + '] ' + its[0].label + (its[0].time > 0.4 ? ' (hold)' : '') : '';
        // rope: what Space does right now; on the ground: an outside wall you can hook onto
        if (!H.intLabel && !(G.mode === 'match' && GAME.phase === 'prep' && a.side === 'atk')) {
          const v = '[' + KEYS.name('vault') + '] ', c = '[' + KEYS.name('crouch') + '] ';
          if (a.rappel) H.intLabel = a.ropeWindow() ? v + 'CRASH THROUGH WINDOW' : v + 'LET GO · ' + c + (a.rappel.inv ? 'TURN UPRIGHT' : 'HANG INVERTED');
          else if (a.rappelProbe()) H.intLabel = v + 'RAPPEL';
        }
      }
      pr = H.intLabel || '';
    }
    e.prompt.style.display = pr ? '' : 'none';
    e.ptext.textContent = pr; e.pring.style.setProperty('--p', Math.round(prog * 100));
    e.pring.style.display = prog > 0 ? '' : 'none';
    // ---- feed
    if (H.feedDirty && isMatch) {
      H.feedDirty = false; e.feed.innerHTML = '';
      for (const f of GAME.feed) {
        e.feed.append($('div', { class: 'kf' + (f.verb ? ' soft' : '') },
          f.k ? $('span', { class: 'k t' + (f.kt === GAME.myTeam ? 0 : f.kt < 0 ? -1 : 1) }, f.k) : null,
          $('span', { class: 'ico' }, f.verb ? f.verb : f.head ? '◎' : '✕'),
          $('span', { class: 'v t' + (f.vt === GAME.myTeam ? 0 : f.vt < 0 ? -1 : 1) }, f.v)));
      }
    }
    for (const c of e.feed.children) { /* fade by age handled in css */ }
    // ---- banner
    if (H.banT > 0) { H.banT -= dt; if (H.banT <= 0) e.banner.className = 'h-banner'; }
    // ---- flash & vignette
    if (H.flashT > 0) { H.flashT -= dt; const f = U.$('flash'); f.style.opacity = Math.max(0, Math.min(1, H.flashT / 2)); }
    if (H.vigT > 0) { H.vigT -= dt; U.$('dmgVignette').style.opacity = Math.max(a.hp < 30 && a.state !== 'dead' ? 0.35 : 0, H.vigT); }
    else U.$('dmgVignette').style.opacity = a.hp < 30 && a.state !== 'dead' ? 0.35 : 0;
    // ---- markers
    H.updateMarkers();
    // ---- fps
    if (G.settings.showFps) { H.fpsAcc = (H.fpsAcc || 0) + 1; H.fpsT = (H.fpsT || 0) + dt; if (H.fpsT > 0.5) { e.fps.textContent = Math.round(H.fpsAcc / H.fpsT) + ' FPS'; H.fpsAcc = 0; H.fpsT = 0; } }
    e.fps.style.display = G.settings.showFps ? '' : 'none';
  };

  H.updateMarkers = function () {
    const a = G.player, P = PLAYER; let i = 0;
    const scr = { x: 0, y: 0 };
    const put = (p, cls, text) => {
      if (i >= H.markers.length) return;
      if (!project(p, scr)) return;
      const m = H.markers[i++];
      m.style.display = ''; m.className = 'mk ' + cls; m.style.transform = 'translate(' + scr.x.toFixed(0) + 'px,' + scr.y.toFixed(0) + 'px)';
      if (m._t !== text) { m._t = text; m.textContent = text; }
    };
    const camPos = G.camera.position;
    for (const t of G.actors) {
      if (t === a && P.view === 'body') continue;
      if (t.state === 'dead') continue;
      const head = t.eye(V()).add(V().set(0, 0.35, 0));
      if (t.hostage) { put(head, 'mk-host', 'HOSTAGE'); continue; }
      if (t.dummy) continue;
      if (t.team === a.team) {
        if (U.dist3(camPos, head) < 45) put(head, 'mk-ally' + (t.state === 'dbno' ? ' down' : ''), t.state === 'dbno' ? '✚ ' + GAME.who(t) : GAME.who(t));
      } else if (GAME.marked(t, a.team)) put(t.center(V()).add(V().set(0, 0.5, 0)), 'mk-enemy', '◆');
    }
    if (G.mode === 'match') {
      const o = GAME.obj;
      if (GAME.siteRooms && (a.side === 'def' || GAME.phase === 'action' || P.view === 'drone')) {
        GAME.siteRooms.forEach((r, k) => { if (GAME.mode !== 'bomb' && k > 0) return; const p = V().set(r.cx, r.fy + 1.4, r.cz); put(p, 'mk-site', GAME.mode === 'bomb' ? (k ? 'B' : 'A') + '  ' + Math.round(U.dist3(camPos, p)) + 'm' : Math.round(U.dist3(camPos, p)) + 'm'); });
      }
      if (o.defuser && o.defuser.alive) put(o.defuser.pos.clone().add(V().set(0, 0.6, 0)), 'mk-def', 'DEFUSER');
      if (o.dropped && o.dropped.alive && a.side === 'atk') put(o.dropped.pos.clone().add(V().set(0, 0.5, 0)), 'mk-def', 'DEFUSER ▾');
      if (GAME.mode === 'hostage' && a.carry && a.carry.hostage) for (const s of G.map.spawns) put(V().set(s.x, s.y + 1.5, s.z), 'mk-site', 'EXTRACT');
    }
    for (const p of H.pings) if (p.t > G.time) put(p.p, 'mk-ping', '▼');
    H.pings = H.pings.filter(p => p.t > G.time);
    // Quill's scanner
    if (a.ability && a.ability.id === 'scanner' && a.ability.on && P.view === 'body') {
      for (const g of G.ents) if (g.alive && g.team !== a.team && g.team >= 0 && GAD.TRAPS.has(g.type) && U.dist3(g.pos, a.pos) < 25) put(g.pos, 'mk-trap', g.type.toUpperCase());
    }
    // damage numbers (range)
    H.dmgNums = H.dmgNums.filter(d => G.time - d.t < 1);
    for (const d of H.dmgNums) put(d.p.clone().add(V().set(0, (G.time - d.t) * 0.8, 0)), 'mk-dmg' + (d.head ? ' head' : ''), String(d.n));
    for (; i < H.markers.length; i++) if (H.markers[i].style.display !== 'none') H.markers[i].style.display = 'none';
  };

  window.HUD = H;
})();
