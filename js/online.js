/* ============================================================================
   online.js -- THE ONLINE LOBBY and ROOMS (built like Wordle n' Friends').

   THE LOBBY: the room list, everyone online (net.js presence), a leaderboard
   and the lobby chat. Click a player for their card: add, message, invite.
   QUICK PLAY drops you into an open public room (or opens one).

   THE ROOM LIST: each host keeps a short note about its room on the two public
   MQTT brokers (retained, refreshed every 10 s, wiped by the broker's "last
   will" when the host's browser goes away). Public and private (password)
   rooms are listed; any room can be joined by its five-letter code; "code only"
   rooms aren't listed.

   A ROOM: up to ten players on two teams of five. The host runs it: map, mode,
   rounds, bot difficulty, starting side, bots filling empty slots, privacy,
   lock, kick / block. Everyone readies up; the host starts the match.

   THE LINKS: browsers connect directly (WebRTC through PeerJS; the free PeerJS
   service only introduces them). If a direct link can't get through, the room's
   messages go over the lobby's MQTT brokers instead, encrypted (relay.js).
   The match itself is run by the host's game (np.js).

     Online.open() quick() host(o) join(code, pass) leave() inRoom() invite(id) challenge(id, o)
   ========================================================================== */
(function () {
  'use strict';
  const el = U.el;
  const PROTO = 'blk-room-1';
  const PEER_JS = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
  const PREFIX = 'blockade-room-', ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ROOM_MAX = 10, TEAM_MAX = 5;
  const QUICK = ['GG!', 'Good luck!', 'Nice shot!', 'Ready!', 'One more?', 'Be right back', 'Rotate!', 'Thanks for the game!'];
  const DENY = {
    version: 'That room is on a different version of the game. Reload the page (Ctrl+F5) and try again.',
    blocked: 'The host of that room has blocked you.',
    locked: 'That room is locked: its host isn\'t letting anyone new in.',
    full: 'That room is full.',
    playing: 'That room is in the middle of a match. Try again when it ends.',
    pass: 'That room is private: it needs its password.',
    wrongpass: 'Wrong password.',
  };
  const why = e => ({
    'peer-unavailable': 'No room with that code. It may have closed, or check the code.',
    'network': 'Couldn\'t reach the matchmaking service. Check your connection and try again.',
    'server-error': 'The matchmaking service is having trouble. Try again in a minute.',
    'socket-error': 'Couldn\'t reach the matchmaking service. Check your connection and try again.',
    'socket-closed': 'Lost the matchmaking service. Try again.',
    'browser-incompatible': 'This browser can\'t do peer-to-peer connections. Try Chrome, Edge, Firefox or Safari.',
    'webrtc': 'The connection failed. Some networks block it.',
  })[e && e.type] || ('Connection problem' + (e && e.type ? ' (' + e.type + ')' : '') + '. Try again.');

  const Online = window.Online = Object.assign(U.hub(), { PROTO });
  let N = null;        // the session: the lobby tab, or the room you're in
  const loadPeer = () => Net.loadScript(PEER_JS, () => !!window.Peer);
  const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  const toast = (t, c) => UI.toast(t, c || 'gold');
  const meInfo = () => ({ uid: Auth.id, name: Auth.name, lv: Auth.lv(), r: Auth.S.rank.rating });
  const memberOf = id => N && N.room ? N.room.members.find(m => m.id === id) || null : null;
  const mapName = id => (MAPS.LIST.find(m => m.id === id) || { name: id }).name;
  const modeName = id => (DATA.MODES[id] || { name: id }).name;
  Online.inRoom = () => !!(N && N.room && N.stage === 'room');
  Online.room = () => N && N.room;
  Online.myId = () => N && N.myId;
  Online.isHost = () => !!(N && N.host);

  /* ===================================================== the room note */
  const Dir = {
    pub: null,
    async host(code, info) {
      Dir.stopHost();
      const topic = Net.PRE + 'rooms/' + code, P = Dir.pub = { topic, info, clients: [] };
      try { await Net.loadMqtt(); } catch (e) { return; }
      if (Dir.pub !== P) return;
      P.clients = Net.BROKERS.map(url => {
        const c = mqtt.connect(url, { clientId: 'blkh_' + U.rid(10), keepalive: 30, reconnectPeriod: 5000, connectTimeout: 8000, clean: true, will: { topic, payload: '', retain: true, qos: 0 } });
        c.on('connect', () => Dir.publish(c)); c.on('error', () => { });
        return c;
      });
      P.t = setInterval(() => Dir.update(), 10000);
    },
    publish(c) { const P = Dir.pub; if (!P) return; const i = P.info(); try { c.publish(P.topic, i ? JSON.stringify(Object.assign(i, { v: PROTO, ts: Date.now() })) : '', { retain: true, qos: 0 }); } catch (e) { /* fine */ } },
    update() { const P = Dir.pub; if (!P) return; for (const c of P.clients) if (c.connected) Dir.publish(c); },
    stopHost() {
      const P = Dir.pub; if (!P) return; Dir.pub = null; clearInterval(P.t);
      for (const c of P.clients) { try { if (c.connected) c.publish(P.topic, '', { retain: true, qos: 0 }); } catch (e) { /* fine */ } setTimeout(() => { try { c.end(true); } catch (e) { /* fine */ } }, 600); }
    },
  };
  const listedRooms = () => [...Net.rooms.values()].filter(r => r.v === PROTO);

  /* ===================================================== messages */
  function toMember(id, msg) {
    if (!N || !N.host) return;
    if (id === N.myId) { setTimeout(() => { if (N) guestGot(msg); }, 0); return; }
    const M = N.mem.get(id); if (M && M.conn && M.conn.open) { try { M.conn.send(msg); } catch (e) { /* closed */ } }
  }
  function toAll(msg, exceptMe) { if (!N || !N.host) return; for (const m of N.room.members) if (!(exceptMe && m.id === N.myId)) toMember(m.id, msg); }
  function toHost(msg) { if (!N) return; if (N.host) hostGot(N.myId, msg); else if (N.conn && N.conn.open) { try { N.conn.send(msg); } catch (e) { /* closed */ } } }
  Online.toAll = toAll; Online.toHost = toHost; Online.toMember = toMember;

  /* ===================================================== the host's side */
  function newRoom(o, code) {
    return {
      code, name: U.clean(o.name, 24) || Auth.name + '\'s room', priv: !!o.priv, listed: o.listed !== false, locked: false, max: ROOM_MAX,
      map: o.map || 'roadhouse', mode: o.mode || 'bomb', rounds: o.rounds || 3, diff: o.diff == null ? 1 : o.diff, side: o.side || 'random', bots: o.bots !== false,
      members: [], playing: false, chat: 'on', chal: o.chal || null,
      // Ranked: fixed rules, no ready-up; the match starts by itself when the wait runs out
      ranked: !!o.ranked, startAt: o.ranked ? Date.now() + (o.wait || 30) * 1000 : 0, done: false,
    };
  }
  function listing() {
    const R = N && N.room; if (!R || !R.listed) return null;
    return { name: R.name, host: Auth.name, hostId: Auth.id, n: R.members.length, max: R.max, priv: R.priv, map: R.map, mode: R.mode, rounds: R.rounds,
      ranked: R.ranked ? 1 : 0, r: Auth.S.rank.rating,
      state: R.locked ? 'locked' : R.members.length >= R.max ? 'full' : R.playing ? 'playing' : 'open' };
  }
  let pushT = null;
  function pushRoom() {
    if (!N || !N.host) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => { if (!N || !N.host) return; toAll({ t: 'room', room: N.room }, true); Dir.update(); setPresence(); redraw(); }, 30);
  }
  function sysSay(text) { if (!N) return; const c = { sys: text }; if (N.host) { toAll({ t: 'chat', c }, true); gotChat(c); } }
  const teamCount = t => N.room.members.filter(m => m.team === t).length;
  function hostConn(conn) {
    conn.on('data', d => hostData(conn, d));
    conn.on('close', () => memberGone(conn.peer, 'left'));
    conn.on('error', () => { });
  }
  function hostData(conn, d) {
    if (!N || !N.host || !d || typeof d !== 'object') return;
    const id = conn.peer, R = N.room;
    if (d.t === 'hello') {
      if (N.mem.has(id)) return;
      const deny = w => { try { conn.send({ t: 'deny', why: w }); } catch (e) { /* fine */ } setTimeout(() => { try { conn.close(); } catch (e) { /* fine */ } }, 400); };
      if (d.ver !== PROTO) return deny('version');
      const me = d.me || {}, uid = String(me.uid || '').slice(0, 16);
      if (N.blocked.has(uid)) return deny('blocked');
      if (R.members.some(m => m.uid === uid)) return deny('full');
      const chal = R.chal && uid === R.chal.to;
      if (R.locked && !chal) return deny('locked');
      if (R.playing) return deny('playing');
      if (R.members.length >= R.max) return deny('full');
      if (R.priv && !chal && String(d.pass || '') !== N.pass) return deny(d.pass ? 'wrongpass' : 'pass');
      N.mem.set(id, { conn });
      let team = teamCount(0) <= teamCount(1) ? 0 : 1;
      if (chal) team = R.chal.together ? 0 : 1;
      if (teamCount(team) >= TEAM_MAX) team = 1 - team;
      const m = { id, uid, name: U.clean(me.name, 16) || 'Player', lv: (+me.lv | 0) || 1, r: Math.round(+me.r || 1000), team, ready: false, host: false };
      R.members.push(m);
      conn.send({ t: 'welcome', you: id, room: R, pass: R.priv ? N.pass : '' });
      sysSay(m.name + ' joined.');
      if (chal) { R.chal = null; }
      pushRoom(); return;
    }
    if (!N.mem.has(id)) return;
    hostGot(id, d);
  }
  const flood = new Map();
  function hostGot(id, d) {
    const R = N.room, m = memberOf(id); if (!m || !d) return;
    if (typeof d.t === 'string' && d.t.startsWith('np.')) { NP.hostGot(id, d); return; }
    switch (d.t) {
      case 'ready': if (R.playing) return; m.ready = !!d.on; pushRoom(); break;
      case 'team': if (R.playing) return; if (d.tm !== 0 && d.tm !== 1) return; if (m.team !== d.tm && teamCount(d.tm) >= TEAM_MAX) return; m.team = d.tm; m.ready = m.host; pushRoom(); break;
      case 'say': {
        const x = U.clean(d.x, 160); if (!x) return;
        if (R.chat === 'off' && !m.host) return;
        const now = Date.now(), f = (flood.get(id) || []).filter(t => now - t < 10000); if (f.length >= 6) return; f.push(now); flood.set(id, f);
        const c = { id: m.uid, n: m.name, x, tm: m.team };
        toAll({ t: 'chat', c }, true); gotChat(c);
        break;
      }
      case 'leave': memberGone(id, 'left'); break;
    }
  }
  function memberGone(id, how) {
    if (!N || !N.host) return;
    const R = N.room, i = R.members.findIndex(m => m.id === id); if (i < 0) return;
    const m = R.members[i]; R.members.splice(i, 1);
    const M = N.mem.get(id); N.mem.delete(id); if (M && M.conn) { try { M.conn.close(); } catch (e) { /* fine */ } }
    sysSay(m.name + (how === 'kick' ? ' was removed.' : ' left.'));
    if (R.playing) NP.memberLeft(id, m.name);
    pushRoom();
  }
  /* host controls */
  Online.set = (k, v) => { if (!N || !N.host || N.room.playing) return; N.room[k] = v; if (k === 'priv' && v && !N.pass) N.pass = U.rid(4).toUpperCase(); pushRoom(); };
  Online.kick = id => { const m = memberOf(id); if (!m || m.host) return; toMember(id, { t: 'kick' }); setTimeout(() => memberGone(id, 'kick'), 200); };
  Online.block = id => { const m = memberOf(id); if (!m || m.host) return; N.blocked.add(m.uid); Online.kick(id); };
  Online.move = id => { if (!N || !N.host || N.room.playing) return; const m = memberOf(id); if (!m) return; const t = 1 - m.team; if (teamCount(t) >= TEAM_MAX) { toast('That team is full.', 'bad'); return; } m.team = t; pushRoom(); };
  Online.start = () => {
    if (!N || !N.host) return;
    const R = N.room;
    if (R.playing) return;
    R.playing = true; R.members.forEach(m => m.ready = false);
    pushRoom();
    toAll({ t: 'start', room: R }, true);
    NP.start(true, R, N.myId);
  };
  /* the host's game is done with the match: back to the room */
  Online.matchEnded = () => { if (!N) return; if (N.host) { N.room.playing = false; N.room.members.forEach(m => m.ready = m.host); pushRoom(); } };

  /* ===================================================== the guest's side */
  function guestGot(d) {
    if (!N || !d || typeof d !== 'object') return;
    if (typeof d.t === 'string' && d.t.startsWith('np.')) { NP.guestGot(d); return; }
    switch (d.t) {
      case 'welcome': N.myId = d.you; N.room = d.room; N.stage = 'room'; if (d.pass) N.pass = d.pass; N.chat = N.chat || []; setPresence(); Online.showRoom(); break;
      case 'deny': toast(DENY[d.why] || 'You couldn\'t join that room.', 'bad'); endSession(); Online.open(); break;
      case 'room': { const was = N.room && N.room.playing; N.room = d.room; setPresence(); if (!d.room.playing && !NP.active) redraw(); if (was && !d.room.playing && !NP.active) Online.showRoom(); break; }
      case 'chat': gotChat(d.c); break;
      case 'kick': toast('The host removed you from the room.', 'bad'); endSession(); Online.open(); break;
      case 'closed': hostGone('The host closed the room.'); break;
      case 'start': N.room = d.room; NP.start(false, d.room, N.myId); break;
    }
  }
  function hostGone(text) {
    if (!N || N.host) return;
    toast(text, 'bad');
    const inMatch = NP.active;
    endSession();
    if (inMatch) { NP.stop(); GAME.quit(); PLAYER.release(); HUD.show(false); }
    Online.open();
  }
  function gotChat(c) {
    if (!N) return;
    if (c.id && Auth.S.blocked[c.id]) return;
    N.chat = N.chat || []; N.chat.push(Object.assign({ t: Date.now() }, c)); if (N.chat.length > 120) N.chat.shift();
    if (NP.active && window.HUD && HUD.chatLine) HUD.chatLine(c);
    else redraw();
  }
  Online.say = text => { text = U.clean(text, 160); if (!text || !N || !N.room) return; toHost({ t: 'say', x: text }); };

  /* ===================================================== sessions */
  function endSession() {
    if (!N) return;
    const S0 = N; N = null;
    try { if (S0.host) { for (const m of S0.room ? S0.room.members : []) if (m.id !== S0.myId) { const M = S0.mem.get(m.id); if (M && M.conn && M.conn.open) M.conn.send({ t: 'closed' }); } Dir.stopHost(); }
      else if (S0.conn && S0.conn.open) S0.conn.send({ t: 'leave' }); } catch (e) { /* fine */ }
    setTimeout(() => {
      try { if (S0.relay) S0.relay.stop(); } catch (e) { /* fine */ }
      for (const t of S0.tries || []) { try { t.close(); } catch (e) { /* fine */ } }
      try { if (S0.conn) S0.conn.close(); } catch (e) { /* fine */ }
      try { if (S0.peer) S0.peer.destroy(); } catch (e) { /* fine */ }
    }, 300);
    clearTimeout(S0.relayT);
    setPresence();
  }
  Online.leave = silent => {
    if (!N) return;
    leaveRanked();
    if (NP.active) { NP.stop(); GAME.quit(); }
    endSession();
    if (!silent) Online.open();
  };
  function setPresence() {
    if (!window.Net || !Auth.user) return;
    if (!N || !N.room) { if (G.mode === 'menu' || G.mode === 'select') Net.setStatus('lobby', 'In the online lobby'); return; }
    const R = N.room, pub = R.listed && !R.priv ? R.code : null;
    if (R.playing) Net.setStatus('play', 'Playing ' + modeName(R.mode) + ' on ' + mapName(R.map), pub);
    else Net.setStatus('room', 'In a room · ' + mapName(R.map), pub);
  }
  Online.setPresence = setPresence;

  Online.host = async o => {
    o = o || {};
    if (Net.state === 'off') Net.start();
    Online.leave(true);
    const S0 = N = { stage: 'creating', host: true, mem: new Map(), blocked: new Set(), chat: [], pass: o.pass || (o.priv ? U.rid(4).toUpperCase() : '') };
    UI.screen(el('div', { class: 'page loadingpg' }, el('div', { class: 'spin' }), 'Opening your room…'));
    try { await loadPeer(); } catch (e) { if (N === S0) { N = null; toast(e.message, 'bad'); Online.open(); } return; }
    const open = () => {
      const code = makeCode(), peer = new Peer(PREFIX + code, { debug: 0 });
      S0.peer = peer;
      peer.on('open', id => {
        if (N !== S0) { try { peer.destroy(); } catch (e) { /* fine */ } return; }
        S0.myId = id; S0.room = newRoom(o, code);
        S0.room.members.push({ id, uid: Auth.id, name: Auth.name, lv: Auth.lv(), r: Auth.S.rank.rating, team: 0, ready: true, host: true });
        S0.stage = 'room';
        Dir.host(code, listing);
        S0.relay = Relay.host(code, link => { if (N === S0) hostConn(link); });
        setPresence(); Online.showRoom();
        if (o.ranked) rankedClock(S0);
        if (o.chal) Net.send(o.chal.to, 'chal', { code, pass: S0.pass, desc: modeName(o.mode) + ' · ' + mapName(o.map) + (o.chal.together ? ' · same team' : ' · versus') }, true).then(r => { if (r.err) toast(r.err, 'bad'); else toast('Invite sent to ' + o.chal.name + '.'); });
      });
      peer.on('connection', conn => { if (N !== S0) return; hostConn(conn); });
      peer.on('error', e => {
        if (N !== S0) return;
        if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (x) { /* fine */ } open(); return; }
        if (S0.stage === 'creating') { N = null; toast(why(e), 'bad'); Online.open(); }
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* fine */ } });
    };
    open();
  };

  /* a ranked room's host: start when it's full or the wait is over. Nobody came? Then it's a
     match against bots, played locally */
  function rankedClock(S0) {
    const t = setInterval(() => {
      if (N !== S0 || !S0.room) { clearInterval(t); return; }
      const R = S0.room; if (R.playing || R.done) return;
      if (R.members.length >= R.max || Date.now() >= R.startAt) {
        clearInterval(t);
        if (R.members.length <= 1) { Online.leave(true); RANKED.solo(); return; }
        R.done = true; Online.start();
      }
    }, 500);
  }
  Online.join = async (code, pass) => {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { toast('Room codes are five letters or numbers.', 'bad'); return; }
    if (N && N.room && N.room.code === code) { Online.showRoom(); return; }
    if (Net.state === 'off') Net.start();
    Online.leave(true);
    const S0 = N = { stage: 'joining', host: false, chat: [], pass: pass || '', tries: [] };
    UI.screen(el('div', { class: 'page loadingpg' }, el('div', { class: 'spin' }), 'Joining room ' + code + '…'));
    try { await loadPeer(); } catch (e) { if (N === S0) { N = null; toast(e.message, 'bad'); Online.open(); } return; }
    const hello = () => ({ t: 'hello', ver: PROTO, me: meInfo(), pass: S0.pass });
    const adopt = link => {
      if (N !== S0 || S0.conn) { try { link.close(); } catch (e) { /* fine */ } return; }
      S0.conn = link; clearTimeout(S0.relayT);
      for (const t of S0.tries) if (t !== link) { t.dropped = true; try { t.close(); } catch (e) { /* fine */ } }
      link.on('data', d => { if (N === S0) guestGot(d); });
      link.on('close', () => { if (N === S0) hostGone('Lost the connection to the room.'); });
      link.send(hello());
    };
    const tryRelay = () => {
      if (N !== S0 || S0.conn || S0.relayed) return; S0.relayed = true;
      const link = Relay.join(code); S0.tries.push(link);
      link.on('open', () => adopt(link));
      link.on('close', () => { if (N === S0 && !S0.conn) { N = null; toast('Couldn\'t reach that room. It may have closed.', 'bad'); Online.open(); } });
    };
    const peer = new Peer({ debug: 0 }); S0.peer = peer;
    peer.on('open', () => {
      if (N !== S0) return;
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }); S0.tries.push(conn);
      conn.on('open', () => adopt(conn));
      conn.on('close', () => { if (!conn.dropped && N === S0 && !S0.conn) tryRelay(); });
      conn.on('error', () => { });
      S0.relayT = setTimeout(tryRelay, 5000);
    });
    peer.on('error', e => {
      if (N !== S0 || S0.conn) return;
      if (e.type === 'peer-unavailable') { if (!S0.relayed) { tryRelay(); return; } }
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { tryRelay(); return; }
      N = null; toast(why(e), 'bad'); Online.open();
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* fine */ } });
  };

  Online.quick = () => {
    const open = listedRooms().filter(r => r.state === 'open' && !r.priv && !r.ranked && r.n < r.max).sort((a, b) => b.n - a.n);
    if (open.length) { Online.join(open[0].code, ''); return; }
    toast('No open rooms right now: opening one for you.');
    Online.host({ name: Auth.name + '\'s match', map: U.pick(MAPS.LIST).id, mode: U.pick(Object.keys(DATA.MODES)) });
  };
  /* walking out of a ranked match counts as a loss */
  const leaveRanked = () => { if (NP.active && GAME.ranked && GAME.active && GAME.phase !== 'end') RANKED.abandon(); };
  Online.challenge = (id, o) => {
    Online.host({ name: Auth.name + ' & ' + Net.nameOf(id), priv: true, listed: false, map: o.map, mode: o.mode, chal: { to: id, name: Net.nameOf(id), together: o.teams === 'together' } });
  };
  Online.invite = id => {
    if (!N || !N.room) return;
    Net.send(id, 'inv', { code: N.room.code, pass: N.pass || '', name: N.room.name }, true).then(r => toast(r.err || 'Invite sent to ' + Net.nameOf(id) + '.', r.err ? 'bad' : 'gold'));
  };
  Online.declined = m => toast(m.n + (m.b && m.b.busy ? ' is busy right now.' : ' declined your invite.'), 'bad');

  /* ===================================================== screens */
  let redraw = () => { };
  Online.open = tab => {
    if (!Auth.user) { MENU.title(); return; }
    G.mode = 'menu'; HUD.show(false); PLAYER.release();
    if (N && N.room && N.stage === 'room') { Online.showRoom(); return; }
    if (Net.state === 'off') Net.start();
    tab = tab || Online._tab || 'rooms'; Online._tab = tab;
    setPresence();
    MUSIC.play('menu');
    const left = el('div', { class: 'panel lobbyL' }), right = el('div', { class: 'panel lobbyR' });
    const page = el('div', { class: 'page lobby' }, UI.topbar('ONLINE LOBBY', () => MENU.home()), el('div', { class: 'lobbygrid' }, left, right));
    const chatBox = el('div', { class: 'chatlog' });
    const input = el('input', { class: 'input', maxlength: 160, placeholder: 'Say something to the lobby…', autocomplete: 'off' });
    const send = () => { const r = Net.say(input.value); if (r.err) toast(r.err, 'bad'); else input.value = ''; };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    right.append(el('h3', {}, 'LOBBY CHAT'), chatBox, el('div', { class: 'chatsend' }, input, UI.btn('SEND', send, '')));
    const drawChat = () => {
      const atBottom = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 30;
      chatBox.innerHTML = '';
      const S = Auth.S;
      const lines = Net.chat.filter(c => !S.blocked[c.f]);
      if (!lines.length) chatBox.append(el('p', { class: 'empty' }, Net.state === 'up' ? 'Nobody has said anything lately. Say hi!' : 'Connecting to the lobby…'));
      for (const c of lines) chatBox.append(el('div', { class: 'cl' + (c.f === Auth.id ? ' me' : '') }, el('button', { class: 'cn', onclick: () => Social.card(c.f) }, c.n), el('span', {}, S.prefs.filter ? U.unswear(c.x) : c.x), el('small', {}, U.time(c.t))));
      if (atBottom) chatBox.scrollTop = 1e6;
    };
    const drawLeft = () => {
      left.innerHTML = '';
      left.append(el('div', { class: 'tabs' }, ...[['rooms', 'ROOMS · ' + listedRooms().length], ['players', 'ONLINE · ' + Math.max(0, Net.players.size - 1)], ['top', 'LEADERBOARD']].map(([k, t]) => el('button', { class: tab === k ? 'on' : '', onclick: () => { tab = Online._tab = k; drawLeft(); } }, t))));
      if (Net.state !== 'up') left.append(el('p', { class: 'fine' }, Net.state === 'connecting' ? 'Connecting to the relay…' : 'You\'re offline. ', Net.state !== 'connecting' ? UI.btn('GO ONLINE', () => Net.retry(), 'small') : null));
      if (tab === 'rooms') {
        const code = el('input', { class: 'input code', maxlength: 5, placeholder: 'CODE', autocomplete: 'off' });
        code.addEventListener('keydown', e => { if (e.key === 'Enter') Online.join(code.value); e.stopPropagation(); });
        left.append(el('div', { class: 'lobbyacts' }, UI.btn('QUICK PLAY', () => Online.quick(), 'big'), UI.btn('HOST A ROOM', () => hostForm(), ''), el('div', { class: 'joincode' }, code, UI.btn('JOIN', () => Online.join(code.value), 'small'))));
        const rooms = listedRooms().sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || b.n - a.n);
        if (!rooms.length) left.append(el('p', { class: 'empty' }, 'No rooms open right now. Host one, or use QUICK PLAY.'));
        for (const r of rooms) left.append(el('button', { class: 'roomrow ' + r.state, onclick: () => r.priv ? askPass(r.code) : Online.join(r.code, '') },
          el('div', {}, el('b', {}, (r.priv ? '🔒 ' : '') + r.name, r.ranked ? el('em', { class: 'pill ranked' }, 'RANKED') : null), el('small', {}, 'Host ' + r.host + ' · ' + modeName(r.mode) + ' · ' + mapName(r.map) + (DATA.MODES[r.mode] && DATA.MODES[r.mode].arcade ? '' : ' · first to ' + r.rounds))),
          el('div', { class: 'rr' }, el('b', {}, r.n + '/' + r.max), el('em', { class: 'pill ' + r.state }, r.state.toUpperCase()))));
      } else if (tab === 'players') {
        const S = Auth.S;
        const ps = [...Net.players.values()].filter(p => p.id !== Auth.id && !S.blocked[p.id]).sort((a, b) => (S.friends[b.id] ? 1 : 0) - (S.friends[a.id] ? 1 : 0) || a.n.localeCompare(b.n));
        if (!ps.length) left.append(el('p', { class: 'empty' }, Net.state === 'up' ? 'Nobody else is online right now.' : 'Not connected.'));
        for (const p of ps) left.append(el('button', { class: 'prow', onclick: () => Social.card(p.id) }, UI.avatar(p.id, p.n), el('i', { class: 'dot on' }),
          el('span', {}, el('b', {}, p.n, el('small', {}, ' ' + UI.tagOf(p.id))), el('small', {}, p.x || 'Online')), S.friends[p.id] ? el('em', { class: 'pill' }, 'FRIEND') : null, UI.lv(p.lv)));
      } else {
        const all = [...Net.profiles.values()].sort((a, b) => b.r - a.r || b.w - a.w).slice(0, 50);
        if (!all.length) left.append(el('p', { class: 'empty' }, 'No ranked players seen yet.'));
        all.forEach((p, i) => left.append(el('button', { class: 'prow lb' + (p.id === Auth.id ? ' me' : ''), onclick: () => Social.card(p.id) }, el('b', { class: 'lbn' }, '#' + (i + 1)), UI.avatar(p.id, p.n),
          el('span', {}, el('b', {}, p.n, el('small', {}, ' ' + UI.tagOf(p.id))), el('small', {}, (p.w || 0) + ' online wins · ' + (p.m || 0) + ' matches')), UI.rating(p.r))));
      }
    };
    const askPass = code => {
      const inp = el('input', { class: 'input', type: 'password', placeholder: 'Password', maxlength: 24 });
      inp.addEventListener('keydown', e => e.stopPropagation());
      UI.modal({ title: 'PRIVATE ROOM', body: [el('p', {}, 'Room ' + code + ' needs a password.'), inp], buttons: [['JOIN', () => Online.join(code, inp.value), 'big'], ['CANCEL', () => { }, 'ghost']] });
      setTimeout(() => inp.focus(), 50);
    };
    UI.screen(page);
    redraw = () => { if (!document.body.contains(page)) return; drawLeft(); drawChat(); };
    const offs = [Net.on('rooms', () => tab === 'rooms' && drawLeft()), Net.on('players', () => tab !== 'top' && drawLeft()), Net.on('profiles', () => tab === 'top' && drawLeft()), Net.on('chat', drawChat), Net.on('state', redraw)];
    UI.onLeave(() => { offs.forEach(f => f()); redraw = () => { }; });
    redraw();
  };

  /* host-a-room form */
  function hostForm() {
    const o = { name: Auth.name + '\'s room', map: 'roadhouse', mode: 'bomb', rounds: 3, diff: G.settings.difficulty, side: 'random', bots: true, priv: false, listed: true, pass: '' };
    const body = el('div', { class: 'chalform' });
    const draw = () => {
      body.innerHTML = '';
      const seg = (label, val, opts, fn) => el('div', { class: 'seg2' }, el('span', null, label), el('div', null, ...opts.map(([v, t]) => el('button', { class: String(val) === String(v) ? 'on' : '', onclick: () => { fn(v); draw(); } }, t))));
      const name = el('input', { class: 'input', maxlength: 24, value: o.name }); name.addEventListener('input', () => o.name = name.value); name.addEventListener('keydown', e => e.stopPropagation());
      const pass = el('input', { class: 'input', maxlength: 24, placeholder: 'Password', value: o.pass }); pass.addEventListener('input', () => o.pass = pass.value); pass.addEventListener('keydown', e => e.stopPropagation());
      body.append(el('div', { class: 'seg2' }, el('span', null, 'NAME'), name),
        seg('MODE', o.mode, Object.keys(DATA.MODES).map(k => [k, DATA.MODES[k].name]), v => o.mode = v),
        seg('MAP', o.map, MAPS.LIST.map(m => [m.id, m.name]), v => o.map = v),
        seg('FIRST TO', o.rounds, [[2, '2'], [3, '3'], [4, '4'], [5, '5']], v => o.rounds = +v),
        seg('BOTS', o.bots, [[true, 'Fill empty slots'], [false, 'Humans only']], v => o.bots = v === true || v === 'true'),
        seg('BOT SKILL', o.diff, DATA.DIFFS.map((d, i) => [i, d.name]), v => o.diff = +v),
        seg('TEAM A STARTS', o.side, [['atk', 'Attack'], ['def', 'Defense'], ['random', 'Random']], v => o.side = v),
        seg('ROOM', o.priv ? 'priv' : o.listed ? 'pub' : 'code', [['pub', 'Public'], ['priv', 'Private (password)'], ['code', 'Code only']], v => { o.priv = v === 'priv'; o.listed = v !== 'code'; }),
        o.priv ? el('div', { class: 'seg2' }, el('span', null, 'PASSWORD'), pass) : null);
    };
    draw();
    UI.modal({ title: 'HOST A ROOM', cls: 'wide', body: [body], buttons: [['OPEN ROOM', () => { if (o.priv && !o.pass) o.pass = U.rid(4).toUpperCase(); Online.host(o); }, 'big'], ['CANCEL', () => { }, 'ghost']] });
  }

  /* the room */
  Online.showRoom = () => {
    if (!N || !N.room) { Online.open(); return; }
    G.mode = 'menu'; HUD.show(false); PLAYER.release();
    const page = el('div', { class: 'page roompg' });
    const chatBox = el('div', { class: 'chatlog' });
    const input = el('input', { class: 'input', maxlength: 160, placeholder: 'Room chat…', autocomplete: 'off' });
    const send = () => { if (!input.value.trim()) return; Online.say(input.value); input.value = ''; };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    const body = el('div', { class: 'roomgrid' });
    page.append(UI.topbar('ROOM', () => UI.modal({ title: 'LEAVE ROOM?', body: [el('p', {}, N && N.host ? 'You\'re the host: leaving closes the room for everyone.' : 'Leave this room?')], buttons: [['LEAVE', () => Online.leave(), 'big hot'], ['STAY', () => { }, 'ghost']] })), body);
    const draw = () => {
      if (!N || !N.room || !document.body.contains(page)) return;
      const R = N.room, host = N.host, me = memberOf(N.myId) || {};
      body.innerHTML = '';
      if (R.ranked) return drawRanked(R);
      // header
      body.append(el('div', { class: 'panel roomhead' },
        el('div', {}, el('h2', {}, R.name), el('small', {}, (R.priv ? 'PRIVATE' : R.listed ? 'PUBLIC' : 'CODE ONLY') + (R.locked ? ' · LOCKED' : '') + ' · ' + R.members.length + '/' + R.max + ' players')),
        el('div', { class: 'roomcode' }, el('small', {}, 'ROOM CODE'), el('b', { class: 'sel' }, R.code), UI.btn('COPY', () => { try { navigator.clipboard.writeText(R.code); toast('Copied the room code.'); } catch (e) { /* fine */ } }, 'ghost small')),
        R.priv && N.pass ? el('div', { class: 'roomcode' }, el('small', {}, 'PASSWORD'), el('b', { class: 'sel' }, N.pass)) : null));
      // teams
      const firstSide = R.side === 'random' ? 'random' : R.side;
      const teamCol = t => {
        const ms = R.members.filter(m => m.team === t);
        const col = el('div', { class: 'panel teamcol t' + t }, el('h3', {}, t === 0 ? 'TEAM A' : 'TEAM B', el('small', {}, firstSide === 'random' ? ' · sides decided at start' : ' · ' + ((t === 0) === (firstSide === 'atk') ? 'attacks first' : 'defends first'))));
        for (const m of ms) col.append(el('div', { class: 'mrow' + (m.id === N.myId ? ' me' : '') },
          UI.avatar(m.uid, m.name), el('span', { class: 'mn' }, el('button', { class: 'linkbtn', onclick: () => Social.card(m.uid) }, m.name), el('small', {}, ' ' + UI.tagOf(m.uid) + ' · LV ' + m.lv)),
          m.host ? el('em', { class: 'pill host' }, 'HOST') : el('em', { class: 'pill ' + (m.ready ? 'ready' : '') }, m.ready ? 'READY' : 'NOT READY'),
          host && !m.host ? el('span', { class: 'macts' }, el('button', { class: 'linkbtn', onclick: () => Online.move(m.id) }, 'move'), el('button', { class: 'linkbtn', onclick: () => Online.kick(m.id) }, 'kick'), el('button', { class: 'linkbtn', onclick: () => Online.block(m.id) }, 'block')) : null));
        for (let i = ms.length; i < TEAM_MAX; i++) col.append(el('div', { class: 'mrow empty' }, el('span', { class: 'mn' }, R.bots ? 'BOT' : 'EMPTY SLOT')));
        if (me.team !== t && !R.playing && ms.length < TEAM_MAX) col.append(UI.btn('JOIN ' + (t === 0 ? 'TEAM A' : 'TEAM B'), () => toHost({ t: 'team', tm: t }), 'small ghost'));
        return col;
      };
      // settings
      const set = el('div', { class: 'panel roomset' }, el('h3', {}, 'MATCH SETTINGS'));
      const seg = (label, key, opts) => el('div', { class: 'seg2' }, el('span', null, label), host && !R.playing ? el('div', null, ...opts.map(([v, t]) => el('button', { class: String(R[key]) === String(v) ? 'on' : '', onclick: () => { SFX.ui(); Online.set(key, typeof R[key] === 'number' ? +v : typeof R[key] === 'boolean' ? (v === true || v === 'true') : v); } }, t))) : el('b', null, (opts.find(o => String(o[0]) === String(R[key])) || ['', String(R[key])])[1]));
      set.append(seg('MODE', 'mode', Object.keys(DATA.MODES).map(k => [k, DATA.MODES[k].name])),
        seg('MAP', 'map', MAPS.LIST.map(m => [m.id, m.name])),
        seg('FIRST TO', 'rounds', [[2, '2'], [3, '3'], [4, '4'], [5, '5']]),
        seg('BOTS', 'bots', [[true, 'Fill slots'], [false, 'Humans only']]),
        seg('BOT SKILL', 'diff', DATA.DIFFS.map((d, i) => [i, d.name])),
        seg('TEAM A STARTS', 'side', [['atk', 'Attack'], ['def', 'Defense'], ['random', 'Random']]),
        host ? seg('ROOM', 'locked', [[false, 'Open'], [true, 'Locked']]) : null,
        host ? seg('CHAT', 'chat', [['on', 'On'], ['off', 'Host only']]) : null);
      // chat
      const chat = el('div', { class: 'panel roomchat' }, el('h3', {}, 'ROOM CHAT'), chatBox, el('div', { class: 'quick' }, ...QUICK.map(q => el('button', { class: 'qbtn', onclick: () => Online.say(q) }, q))), el('div', { class: 'chatsend' }, input, UI.btn('SEND', send, '')));
      // actions
      const others = R.members.filter(m => !m.host);
      const waiting = others.filter(m => !m.ready).length;
      const acts = el('div', { class: 'panel roomacts' },
        host ? UI.btn(R.playing ? 'MATCH IN PROGRESS' : waiting ? 'START ANYWAY (' + waiting + ' not ready)' : 'START MATCH', () => { if (!R.playing) Online.start(); }, 'big' + (waiting ? ' ghost' : '')) :
          UI.btn(me.ready ? 'READY ✓ (click to unready)' : 'READY UP', () => toHost({ t: 'ready', on: !me.ready }), 'big' + (me.ready ? ' ghost' : '')),
        UI.btn('INVITE FRIENDS', () => inviteForm(), ''),
        UI.btn('LEAVE ROOM', () => Online.leave(), 'ghost'));
      body.append(el('div', { class: 'teams' }, teamCol(0), el('div', { class: 'vs' }, 'VS'), teamCol(1)), el('div', { class: 'roomlow' }, set, chat), acts);
      drawChat();
    };
    // Ranked: who's been found so far and the countdown to the start; nothing to set or ready up
    let rkT = null;
    const drawRanked = R => {
      const left = () => Math.max(0, Math.ceil((R.startAt - Date.now()) / 1000));
      const clock = el('b', { class: 'rk-clock' }, '0:' + String(left()).padStart(2, '0'));
      clearInterval(rkT); rkT = setInterval(() => { if (!document.body.contains(clock)) { clearInterval(rkT); return; } clock.textContent = R.playing ? 'STARTING' : '0:' + String(left()).padStart(2, '0'); }, 250);
      body.append(el('div', { class: 'panel rk-search' }, el('div', { class: 'spin' }), el('h2', {}, 'RANKED · FINDING PLAYERS'), clock,
        el('p', { class: 'muted' }, R.members.length + ' of ' + R.max + ' players found · empty seats are filled by bots when the countdown ends'),
        el('div', { class: 'rk-found' }, ...R.members.map(m => el('div', { class: 'mrow' + (m.id === N.myId ? ' me' : '') }, UI.avatar(m.uid, m.name), el('span', { class: 'mn' }, m.name, el('small', {}, ' LV ' + m.lv)), RANKED.badge(m.r)))),
        el('div', { class: 'actions' }, UI.btn('CANCEL', () => { Online.leave(true); RANKED.open(); }, 'ghost'))));
    };
    UI.onLeave(() => clearInterval(rkT));
    const drawChat = () => {
      chatBox.innerHTML = '';
      for (const c of (N && N.chat) || []) chatBox.append(c.sys ? el('div', { class: 'cl sys' }, c.sys) : el('div', { class: 'cl' }, el('button', { class: 'cn', onclick: () => c.id && Social.card(c.id) }, c.n), el('span', {}, Auth.S.prefs.filter ? U.unswear(c.x) : c.x)));
      chatBox.scrollTop = 1e6;
    };
    UI.screen(page);
    redraw = draw;
    UI.onLeave(() => { redraw = () => { }; });
    draw();
  };
  function inviteForm() {
    const S = Auth.S;
    const ids = Object.keys(S.friends).filter(id => Net.online(id));
    UI.modal({ title: 'INVITE FRIENDS', body: [ids.length ? el('div', { class: 'flist' }, ...ids.map(id => el('div', { class: 'frow on' }, UI.avatar(id, S.friends[id].n), el('span', {}, el('b', {}, S.friends[id].n), el('small', {}, ' ' + (Net.online(id).x || 'Online'))), UI.btn('INVITE', () => Online.invite(id), 'small hot'))))
      : el('p', { class: 'empty' }, 'None of your friends are online. Share the room code instead: ' + (N && N.room ? N.room.code : ''))] });
  }
})();
