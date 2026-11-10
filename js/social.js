/* ============================================================================
   social.js -- FRIENDS, MESSAGES, player cards, match invites (from Wordle n' Friends).

   FRIENDS: add someone by their friend code (Name#TAG), from the lobby, or
   from their player card. They get a request (in their inbox, kept on the
   relay until they're next online); once they accept you're friends on both
   sides: you see when they're online and what they're doing, can message,
   challenge and invite them, and join their public room.
   MESSAGES: one conversation per player, end-to-end encrypted (net.js). A
   message to someone offline waits on the relay. One tick = sent, two =
   their game has it. Options: messages from everyone, or friends only.
   BLOCK: their requests, messages, challenges and invites are dropped, and
   their lobby chat is hidden.
   Your friends list and messages are saved with your account, on this device.
   ========================================================================== */
(function () {
  'use strict';
  const { el } = U;
  const MSG_MAX = 500;
  let inited = false, openConvo = null, prompts = new Map();
  const S = () => Auth.S;
  const changed = () => { Auth.save(); Social.emit('change'); };
  const shown = t => (Auth.prefs.filter ? U.unswear(t) : t);
  const tagOf = id => '#' + String(id).slice(0, 4).toUpperCase();

  const Social = window.Social = Object.assign(U.hub(), {
    init() {
      if (inited) return; inited = true;
      Net.on('inbox', got);
      Net.on('players', () => Social.emit('change'));
    },
    isFriend: id => !!(S() && S().friends[id]),
    blocked: id => !!(S() && S().blocked[id]),

    /* ------------------------------------------------------------ friends */
    async add(id, name) {
      const s = S(); if (id === Auth.id || s.friends[id]) return;
      if (s.reqIn[id]) return Social.accept(id);
      const r = await Net.send(id, 'freq', {});
      if (r.err) { UI.toast(r.err, 'bad'); return; }
      s.reqOut[id] = { n: name || Net.nameOf(id), t: Date.now() }; changed();
      UI.toast('Friend request sent to ' + s.reqOut[id].n + (r.queued ? ' (it goes out when you\'re back online)' : '') + '.', 'gold');
    },
    accept(id) {
      const s = S(), q = s.reqIn[id]; if (!q) return;
      s.friends[id] = { n: q.n, epk: q.epk, since: Date.now() }; delete s.reqIn[id]; changed();
      Net.send(id, 'facc', {}); UI.toast('You and ' + q.n + ' are friends now.', 'gold'); SFX.ping();
    },
    decline(id) { const s = S(); if (!s.reqIn[id]) return; delete s.reqIn[id]; changed(); Net.send(id, 'fdec', {}); },
    cancel(id) { const s = S(); delete s.reqOut[id]; changed(); },
    remove(id) { const s = S(), f = s.friends[id]; if (!f) return; delete s.friends[id]; changed(); Net.send(id, 'frem', {}); UI.toast('Removed ' + f.n + ' from your friends.'); },
    block(id, name) {
      const s = S(); name = name || Net.nameOf(id);
      if (s.friends[id]) { delete s.friends[id]; Net.send(id, 'frem', {}); }
      delete s.reqIn[id]; delete s.reqOut[id]; s.blocked[id] = name; changed();
      UI.toast('Blocked ' + name + '.');
    },
    unblock(id) { const s = S(); delete s.blocked[id]; changed(); },

    /* ------------------------------------------------------------ messages */
    convo(id) { const s = S(); return s.convos[id] = s.convos[id] || { n: Net.nameOf(id), msgs: [], unread: 0 }; },
    async dm(id, text) {
      text = U.clean(text, MSG_MAX); if (!text) return;
      const c = Social.convo(id), m = { i: U.rid(8), me: true, x: text, t: Date.now(), st: 'sending' };
      c.msgs.push(m); trim(c); changed();
      const r = await Net.send(id, 'dm', { x: text }, true);
      m.st = r.err ? 'failed' : r.queued ? 'queued' : 'sent'; m.ni = r.i; if (r.err) m.why = r.err;
      changed();
      if (r.err) UI.toast(r.err, 'bad');
    },
    unread() { return Object.values(S().convos).reduce((a, c) => a + (c.unread || 0), 0); },
  });
  const trim = c => { if (c.msgs.length > 300) c.msgs.splice(0, c.msgs.length - 300); };

  /* --------------------------------------------------------------- the inbox */
  function got(m) {
    const s = S(); if (!s) return;
    const known = s.friends[m.f];
    if (known) { known.n = m.n; if (m.epk) known.epk = m.epk; }
    switch (m.k) {
      case 'freq':
        if (s.friends[m.f]) { Net.send(m.f, 'facc', {}); break; }                         // (they lost their list: back on it)
        if (s.reqOut[m.f]) { s.friends[m.f] = { n: m.n, epk: m.epk, since: Date.now() }; delete s.reqOut[m.f]; Net.send(m.f, 'facc', {}); UI.toast('You and ' + m.n + ' are friends now.', 'gold'); SFX.ping(); break; }
        s.reqIn[m.f] = { n: m.n, epk: m.epk, t: m.t };
        UI.toast(m.n + ' sent you a friend request.', 'gold'); SFX.ping(); break;
      case 'facc':
        if (!s.reqOut[m.f] && !s.friends[m.f]) break;
        s.friends[m.f] = Object.assign(s.friends[m.f] || { since: Date.now() }, { n: m.n, epk: m.epk || (s.friends[m.f] || {}).epk });
        if (s.reqOut[m.f]) { delete s.reqOut[m.f]; UI.toast(m.n + ' accepted your friend request!', 'gold'); SFX.ping(); }
        break;
      case 'fdec': delete s.reqOut[m.f]; break;
      case 'frem': delete s.friends[m.f]; break;
      case 'dm': {
        if (s.prefs.dmFrom === 'friends' && !s.friends[m.f]) break;
        const text = U.clean(m.b.x, MSG_MAX); if (!text) break;
        const c = Social.convo(m.f); c.n = m.n;
        if (c.msgs.some(x => x.ni === m.i)) break;
        c.msgs.push({ i: U.rid(8), ni: m.i, me: false, x: text, t: Math.min(m.t, Date.now()) }); c.msgs.sort((a, b) => a.t - b.t); trim(c);
        if (openConvo !== m.f || !document.querySelector('.page.messages')) {
          c.unread = (c.unread || 0) + 1;
          const t = UI.toast(m.n + ': ' + shown(text).slice(0, 80), 'msg', 4000); t.onclick = () => Social.messages(m.f);
        }
        SFX.ui(1500);
        Net.send(m.f, 'ack', { i: m.i });
        break;
      }
      case 'ack': for (const c of Object.values(s.convos)) for (const x of c.msgs) if (x.me && x.ni === m.b.i) x.st = 'got'; break;
      case 'chal': challenged(m); break;
      case 'chalx': { const p = prompts.get(m.b.code); if (p) { p.close(); UI.toast(m.n + ' called off the challenge.'); } break; }
      case 'chalno': if (window.Online) Online.declined(m); break;
      case 'inv': invited(m); break;
    }
    changed();
  }

  /* an incoming challenge: accept to join the room they opened for it */
  function challenged(m) {
    const b = m.b || {}; if (!/^[A-Z0-9]{5}$/.test(b.code || '')) return;
    if (Net.status.a === 'room' || Net.status.a === 'play') { Net.send(m.f, 'chalno', { code: b.code, busy: true }); return; }
    SFX.ping();
    const rules = String(b.desc || 'Custom match').slice(0, 60);
    const p = UI.modal({ title: 'MATCH INVITE', cls: 'challenge', body: [
      el('div', { class: 'chalwho' }, UI.avatar(m.f, m.n, 'lg'), el('div', null, el('h3', null, m.n, el('small', null, ' ' + tagOf(m.f))), el('p', null, 'invites you to a match!'), el('em', { class: 'pill' + (b.ranked ? ' hot' : '') }, rules))),
      el('p', { class: 'small muted' }, 'Accepting takes you straight into their room.'),
    ], buttons: [['ACCEPT', () => { prompts.delete(b.code); Online.join(b.code, String(b.pass || '')); }, 'big hot'], ['DECLINE', () => { prompts.delete(b.code); Net.send(m.f, 'chalno', { code: b.code }); }, 'ghost'], ['BLOCK', () => { prompts.delete(b.code); Net.send(m.f, 'chalno', { code: b.code }); Social.block(m.f, m.n); }, 'ghost small']],
      onClose: () => prompts.delete(b.code) });
    prompts.set(b.code, p);
    setTimeout(() => { if (prompts.get(b.code) === p) { p.close(); } }, 90000);
  }
  function invited(m) {
    const b = m.b || {}; if (!/^[A-Z0-9]{5}$/.test(b.code || '')) return;
    if (Net.status.a === 'play') { UI.toast(m.n + ' invited you to a room (code ' + b.code + ').', 'gold', 5000); return; }
    SFX.ping();
    UI.modal({ title: 'ROOM INVITE', body: [
      el('div', { class: 'chalwho' }, UI.avatar(m.f, m.n, 'lg'), el('div', null, el('h3', null, m.n), el('p', null, 'invites you to ', el('b', null, U.clean(b.name, 24) || 'their room'), '.'), el('small', { class: 'muted' }, 'Room ' + b.code))),
    ], buttons: [['JOIN', () => Online.join(b.code, String(b.pass || '')), 'big'], ['NOT NOW', () => {}, 'ghost']] });
  }

  /* ------------------------------------------------------------ player card */
  function statusOf(id) {
    const p = Net.online(id); if (p) return { on: true, text: p.x || 'Online', rm: p.rm };
    const pr = Net.profiles.get(id); return { on: false, text: pr ? 'Last seen ' + U.ago(pr.t) : 'Offline' };
  }
  Social.statusOf = statusOf;
  Social.card = id => {
    const s = S(), me = id === Auth.id;
    const pr = Net.profiles.get(id) || {}, pl = Net.online(id) || {}, name = me ? Auth.name : Net.nameOf(id);
    const P = me ? Net.myProfile() : pr;
    const r = me ? s.rank.rating : pl.r || pr.r || 1000, lv = me ? Auth.lv() : pl.lv || pr.lv || 1, st = me ? { on: Net.state === 'up', text: 'This is you' } : statusOf(id);
    const fr = s.friends[id], blk = s.blocked[id], out = s.reqOut[id], inc = s.reqIn[id];
    const B = [];
    if (!me) {
      if (blk) B.push(['UNBLOCK', () => Social.unblock(id), 'ghost']);
      else {
        if (fr) B.push(['MESSAGE', () => Social.messages(id), '']);
        else if (inc) B.push(['ACCEPT REQUEST', () => Social.accept(id), 'hot']);
        else if (!out) B.push(['ADD FRIEND', () => Social.add(id, name), 'hot']);
        if (!fr && s.prefs.dmFrom === 'everyone') B.push(['MESSAGE', () => Social.messages(id), 'ghost']);
        if (st.on) B.push(['INVITE TO MATCH', () => Social.challenge(id), '']);
        if (st.rm) B.push(['JOIN ROOM', () => Online.join(st.rm, ''), 'ghost']);
        if (window.Online && Online.inRoom() && st.on) B.push(['INVITE TO ROOM', () => Online.invite(id), 'ghost']);
        B.push(['BLOCK', () => Social.block(id, name), 'ghost small']);
      }
    }
    const kd = P && P.dd ? (P.k / P.dd).toFixed(2) : P && P.k ? String(P.k) : '0.00';
    const favOp = P && P.fav && DATA.OPMAP[P.fav] ? DATA.OPMAP[P.fav].name : '-';
    UI.modal({ title: me ? 'YOU' : 'PLAYER', cls: 'pcard', body: [
      el('div', { class: 'pchead' }, UI.avatar(id, name, 'lg'), el('div', null,
        el('h2', null, name, el('small', null, ' ' + tagOf(id))),
        el('div', { class: 'row' }, UI.lv(lv), el('span', { class: 'muted' }, ' RATING '), UI.rating(r)),
        el('p', { class: 'pcstatus' + (st.on ? ' on' : '') }, el('i', { class: 'dot' + (st.on ? ' on' : '') }), st.text))),
      el('div', { class: 'nums' },
        el('div', null, el('b', null, P ? (P.mw || 0) + '/' + (P.m || 0) : '-'), el('small', null, 'MATCHES WON')),
        el('div', null, el('b', null, kd), el('small', null, 'K/D')),
        el('div', null, el('b', null, me ? s.rank.wins : pr.w || 0), el('small', null, 'ONLINE WINS')),
        el('div', null, el('b', null, favOp), el('small', null, 'FAVOURITE'))),
      fr ? el('p', { class: 'small muted' }, 'Friends since ' + new Date(fr.since).toLocaleDateString() + ' · ', el('button', { class: 'linkbtn', onclick: () => { Social.remove(id); document.querySelector('.uoverlay .mclose').click(); } }, 'remove friend')) : null,
      out ? el('p', { class: 'small muted' }, 'Friend request sent. Waiting for them.') : null,
      blk ? el('p', { class: 'small muted' }, 'You\'ve blocked this player.') : null,
    ], buttons: B });
  };

  /* ------------------------------------------------------------ invite to a match */
  Social.challenge = id => {
    if (!Net.online(id)) { UI.toast(Net.nameOf(id) + ' isn\'t online.', 'bad'); return; }
    const o = { mode: 'bomb', map: 'roadhouse', teams: 'versus' };
    const body = el('div', { class: 'chalform' });
    const draw = () => {
      body.innerHTML = '';
      const seg = (label, val, opts, fn) => el('div', { class: 'seg2' }, el('span', null, label), el('div', null, ...opts.map(([v, t]) => el('button', { class: String(val) === String(v) ? 'on' : '', onclick: () => { fn(v); draw(); } }, t))));
      body.append(
        el('div', { class: 'chalwho' }, UI.avatar(id, Net.nameOf(id), 'lg'), el('div', null, el('h3', null, Net.nameOf(id)), el('small', null, statusOf(id).text))),
        seg('MODE', o.mode, Object.keys(DATA.MODES).map(k => [k, DATA.MODES[k].name]), v => { o.mode = v; }),
        seg('MAP', o.map, MAPS.LIST.map(m => [m.id, m.name]), v => { o.map = v; }),
        seg('TEAMS', o.teams, [['versus', 'Against each other'], ['together', 'Same team']], v => { o.teams = v; }),
        el('p', { class: 'small muted' }, 'A private room opens for the two of you; bots fill the other slots.'));
    };
    draw();
    UI.modal({ title: 'INVITE TO MATCH', body: [body], buttons: [['SEND INVITE', () => Online.challenge(id, o), 'big hot'], ['CANCEL', () => {}, 'ghost']] });
  };

  /* ------------------------------------------------------------ FRIENDS screen */
  Social.friends = tab => {
    tab = tab || Social._ftab || 'friends'; Social._ftab = tab;
    const { btn, topbar } = UI, s = S();
    const nIn = Object.keys(s.reqIn).length;
    const body = el('div', { class: 'flist' });
    const row = (id, n, sub, on, ...acts) => el('div', { class: 'frow' + (on ? ' on' : '') },
      el('button', { class: 'fwho', onclick: () => Social.card(id) }, UI.avatar(id, n), el('i', { class: 'dot' + (on ? ' on' : '') }),
        el('span', null, el('b', null, n, el('small', null, ' ' + tagOf(id))), el('small', null, sub))),
      el('div', { class: 'facts' }, ...acts));
    const draw = () => {
      if (!document.body.contains(body)) { offs.forEach(f => f()); return; }
      body.innerHTML = '';
      if (tab === 'friends') {
        const ids = Object.keys(s.friends).sort((a, b) => (Net.online(b) ? 1 : 0) - (Net.online(a) ? 1 : 0) || s.friends[a].n.localeCompare(s.friends[b].n));
        if (!ids.length) body.append(el('p', { class: 'empty' }, 'No friends yet. Add someone by their friend code under ADD FRIEND, or from a player card in the ONLINE LOBBY.'));
        for (const id of ids) {
          const f = s.friends[id], st = statusOf(id), p = Net.online(id), c = s.convos[id];
          body.append(row(id, f.n, st.text, st.on,
            p ? UI.lv(p.lv) : null,
            btn('MESSAGE' + (c && c.unread ? ' (' + c.unread + ')' : ''), () => Social.messages(id), 'small'),
            st.on ? btn('INVITE TO MATCH', () => Social.challenge(id), 'small hot') : null,
            st.rm ? btn('JOIN', () => Online.join(st.rm, ''), 'small ghost') : null,
            st.on && Online.inRoom() ? btn('INVITE', () => Online.invite(id), 'small ghost') : null));
        }
      } else if (tab === 'requests') {
        const ins = Object.keys(s.reqIn), outs = Object.keys(s.reqOut);
        if (!ins.length && !outs.length) body.append(el('p', { class: 'empty' }, 'No requests right now.'));
        if (ins.length) body.append(el('h3', null, 'FOR YOU'));
        for (const id of ins) body.append(row(id, s.reqIn[id].n, 'Wants to be friends · ' + U.ago(s.reqIn[id].t), !!Net.online(id),
          btn('ACCEPT', () => Social.accept(id), 'small hot'), btn('DECLINE', () => Social.decline(id), 'small ghost'), btn('BLOCK', () => Social.block(id, s.reqIn[id].n), 'small ghost')));
        if (outs.length) body.append(el('h3', null, 'SENT'));
        for (const id of outs) body.append(row(id, s.reqOut[id].n, 'Waiting for them · sent ' + U.ago(s.reqOut[id].t), !!Net.online(id), btn('CANCEL', () => Social.cancel(id), 'small ghost')));
      } else if (tab === 'add') {
        const q = el('input', { type: 'text', class: 'input', placeholder: 'Name#TAG (or just a name)', maxlength: 24, value: Social._q || '' });
        const res = el('div', { class: 'fres' });
        const search = () => {
          Social._q = q.value; res.innerHTML = '';
          if (!q.value.trim()) return;
          const found = Net.find(q.value);
          if (!found.length) { res.append(el('p', { class: 'empty' }, Net.state === 'up' ? 'Nobody by that name has been seen on the relay. Check the spelling and the #TAG, or ask them to go online.' : 'You\'re not connected, so nobody can be found.')); return; }
          for (const p of found) {
            const st = statusOf(p.id), fr = s.friends[p.id], out = s.reqOut[p.id];
            res.append(row(p.id, p.n, st.text, st.on, UI.lv(p.lv),
              fr ? el('em', { class: 'pill' }, 'FRIENDS') : out ? el('em', { class: 'pill' }, 'REQUESTED') : btn('ADD FRIEND', () => { Social.add(p.id, p.n); setTimeout(search, 50); }, 'small hot')));
          }
        };
        q.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
        body.append(
          el('div', { class: 'mycode' }, el('small', null, 'YOUR FRIEND CODE'), el('b', { class: 'sel' }, Auth.name + '#' + Auth.tag),
            btn('COPY', () => { try { navigator.clipboard.writeText(Auth.name + '#' + Auth.tag); UI.toast('Copied. Send it to a friend.'); } catch (e) { /* fine */ } }, 'ghost small')),
          el('div', { class: 'searchrow' }, q, btn('SEARCH', search, '')), res,
          el('h3', null, 'ONLINE NOW'));
        const others = [...Net.players.values()].filter(p => p.id !== Auth.id && !s.friends[p.id] && !s.blocked[p.id]).slice(0, 30);
        if (!others.length) body.append(el('p', { class: 'empty' }, Net.state === 'up' ? 'Nobody else is online right now.' : 'Not connected.'));
        for (const p of others) body.append(row(p.id, p.n, p.x, true, UI.lv(p.lv), s.reqOut[p.id] ? el('em', { class: 'pill' }, 'REQUESTED') : btn('ADD', () => Social.add(p.id, p.n), 'small')));
        if (q.value) search();
        setTimeout(() => q.focus(), 30);
      } else if (tab === 'blocked') {
        const ids = Object.keys(s.blocked);
        if (!ids.length) body.append(el('p', { class: 'empty' }, 'You haven\'t blocked anyone.'));
        for (const id of ids) body.append(row(id, s.blocked[id], 'Blocked', false, btn('UNBLOCK', () => Social.unblock(id), 'small ghost')));
      }
    };
    const onlineN = Object.keys(s.friends).filter(id => Net.online(id)).length;
    UI.screen(el('div', { class: 'page friends' }, topbar('FRIENDS', () => MENU.home()),
      el('div', { class: 'panel fpanel' },
        el('div', { class: 'tabs' }, ...[['friends', 'FRIENDS · ' + onlineN + '/' + Object.keys(s.friends).length], ['requests', 'REQUESTS' + (nIn ? ' (' + nIn + ')' : '')], ['add', 'ADD FRIEND'], ['blocked', 'BLOCKED']]
          .map(([k, t]) => el('button', { class: tab === k ? 'on' : '', onclick: () => Social.friends(k) }, t))),
        body,
        Net.state !== 'up' ? el('p', { class: 'fine' }, Net.state === 'off' ? 'You\'re offline. ' : 'Connecting to the relay... ', Net.state === 'off' ? btn('GO ONLINE', () => { Net.start(); Social.friends(tab); }, 'small') : null) : null)));
    const offs = tab === 'add' ? [] : [Social.on('change', draw), Net.on('players', draw), Net.on('profiles', draw)];
    draw();
  };

  /* ------------------------------------------------------------ MESSAGES screen */
  Social.messages = id => {
    const { btn, topbar } = UI, s = S();
    const want = id && id !== Auth.id ? id : null;
    if (want) Social.convo(want);
    const list = el('div', { class: 'convlist' }), thread = el('div', { class: 'thread' });
    const box = el('input', { type: 'text', class: 'input', maxlength: MSG_MAX, placeholder: 'Write a message...', autocomplete: 'off', enterkeyhint: 'send' });
    const send = () => { if (!openConvo || !box.value.trim()) return; Social.dm(openConvo, box.value); box.value = ''; box.focus(); };
    box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    const tick = st => ({ sending: '…', queued: '◷', sent: '✓', got: '✓✓', failed: '!' })[st] || '';
    const drawList = () => {
      list.innerHTML = '';
      list.append(btn('NEW MESSAGE', () => pickFriend(), 'small wide'));
      const ids = Object.keys(s.convos).filter(k => s.convos[k].msgs.length || k === openConvo).sort((a, b) => ((s.convos[b].msgs.slice(-1)[0] || {}).t || Date.now()) - ((s.convos[a].msgs.slice(-1)[0] || {}).t || Date.now()));
      if (!ids.length) list.append(el('p', { class: 'empty' }, 'No messages yet.'));
      for (const k of ids) {
        const c = s.convos[k], last = c.msgs.slice(-1)[0], on = !!Net.online(k);
        list.append(el('button', { class: 'conv' + (k === openConvo ? ' on' : '') + (c.unread ? ' unread' : ''), onclick: () => Social.messages(k) },
          UI.avatar(k, c.n), el('i', { class: 'dot' + (on ? ' on' : '') }),
          el('span', { class: 'convt' }, el('b', null, c.n), el('small', null, last ? (last.me ? 'You: ' : '') + shown(last.x).slice(0, 40) : 'New conversation')),
          el('span', { class: 'convr' }, last ? el('small', null, U.ago(last.t)) : null, c.unread ? el('i', { class: 'nbadge' }, c.unread) : null)));
      }
    };
    const drawThread = () => {
      thread.innerHTML = '';
      if (!openConvo) { thread.append(el('div', { class: 'tempty' }, el('p', null, 'Pick a conversation, or start a new one.'))); return; }
      const k = openConvo, c = Social.convo(k), st = statusOf(k);
      c.unread = 0; Auth.save();
      const msgs = el('div', { class: 'tmsgs' });
      let lastDay = '';
      for (const m of c.msgs) {
        const d = new Date(m.t).toDateString();
        if (d !== lastDay) { lastDay = d; msgs.append(el('div', { class: 'tday' }, d === new Date().toDateString() ? 'Today' : new Date(m.t).toLocaleDateString())); }
        msgs.append(el('div', { class: 'bub ' + (m.me ? 'me' : 'them') + (m.st === 'failed' ? ' failed' : ''), title: m.why || '' }, shown(m.x),
          el('small', null, U.time(m.t), m.me ? ' ' + tick(m.st) : '')));
      }
      if (!c.msgs.length) msgs.append(el('p', { class: 'empty' }, 'Say hi to ' + c.n + '!' + (st.on ? '' : ' They\'re offline: your message will wait for them.')));
      const blocked = s.blocked[k];
      thread.append(
        el('div', { class: 'thead' }, el('button', { class: 'tback', onclick: () => Social.messages() }, '‹'),
          el('button', { class: 'fwho', onclick: () => Social.card(k) }, UI.avatar(k, c.n), el('span', null, el('b', null, c.n, el('small', null, ' ' + tagOf(k))), el('small', null, st.text))),
          el('div', { class: 'grow' }), st.on && !blocked ? btn('INVITE TO MATCH', () => Social.challenge(k), 'small hot') : null),
        msgs,
        blocked ? el('p', { class: 'empty' }, 'You\'ve blocked this player. ', btn('UNBLOCK', () => Social.unblock(k), 'small ghost')) : el('div', { class: 'tsend' }, box, btn('SEND', send, '')));
      msgs.scrollTop = 1e6;
    };
    const pickFriend = () => {
      const ids = Object.keys(s.friends);
      UI.modal({ title: 'NEW MESSAGE', body: [ids.length ? el('div', { class: 'flist' }, ...ids.map(k => el('button', { class: 'conv', onclick: () => { document.querySelector('.uoverlay .mclose').click(); Social.messages(k); } },
        UI.avatar(k, s.friends[k].n), el('span', { class: 'convt' }, el('b', null, s.friends[k].n), el('small', null, statusOf(k).text))))) : el('p', { class: 'empty' }, 'Add friends first (or open someone\'s player card in the lobby).')] });
    };
    const draw = () => { if (!document.body.contains(list)) { offs.forEach(f => f()); return; } const typing = document.activeElement === box; drawList(); drawThread(); if (typing) box.focus(); };
    UI.screen(el('div', { class: 'page messages' + (want ? ' has' : '') }, topbar('MESSAGES', () => (openConvo && innerWidth < 760 ? Social.messages() : MENU.home())),
      el('div', { class: 'panel msgpanel' }, list, thread)));
    openConvo = want;
    const offs = [Social.on('change', draw), Net.on('players', draw)];
    UI.onLeave(() => { openConvo = null; });
    draw(); Social.emit('change');
    if (openConvo) setTimeout(() => box.focus(), 50);
  };
})();
