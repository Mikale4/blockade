/* ranked.js -- Ranked: Bomb, first to four, your rating on the line.

   FIND MATCH looks for real players first: an open ranked room near your rating on the lobby
   brokers, or failing that it opens one and waits up to 30 seconds for others to join. Whatever
   seats are still empty when the match starts are filled by bots playing at your level. Offline,
   it goes straight to bots.

   Ranks: BRONZE → SILVER → GOLD → PLATINUM → DIAMOND (three divisions each, III to I) → ELITE.
   Your first five matches are placements (the rating moves twice as fast). Leaving a ranked
   match early counts as a loss.

     RANKED.open()  find()  tier(rating)  diff(rating)  abandon()                              */
(function () {
  'use strict';
  const $ = U.el;
  const TIERS = [
    { name: 'BRONZE', min: 0, color: '#b07a4a' }, { name: 'SILVER', min: 1000, color: '#b8c2cc' }, { name: 'GOLD', min: 1300, color: '#f2c14e' },
    { name: 'PLATINUM', min: 1600, color: '#4fd8c8' }, { name: 'DIAMOND', min: 1900, color: '#8ab4ff' }, { name: 'ELITE', min: 2200, color: '#ff6a9a' },
  ];
  const PLACEMENTS = 5, SEARCH = 30;
  const RANKED = { TIERS, PLACEMENTS };
  RANKED.tier = function (r) {
    let i = TIERS.length - 1; while (i > 0 && r < TIERS[i].min) i--;
    const T = TIERS[i], next = TIERS[i + 1];
    if (!next) return { name: T.name, label: T.name, color: T.color, i, div: 0 };
    const span = (next.min - Math.max(T.min, i === 0 ? 700 : T.min)) / 3, base = i === 0 ? 700 : T.min;
    const d = Math.max(0, Math.min(2, Math.floor((r - base) / span)));
    const div = ['III', 'II', 'I'][d];
    return { name: T.name, div, label: T.name + ' ' + div, color: T.color, i, step: i * 3 + d };
  };
  RANKED.placing = () => Auth.S && Auth.S.rank.games < PLACEMENTS;
  RANKED.badge = (r, games) => {
    const t = RANKED.tier(r), placing = games != null && games < PLACEMENTS;
    return $('span', { class: 'rbadge', style: { '--rc': placing ? '#8b93a1' : t.color } }, $('i'), placing ? 'PLACEMENTS ' + games + '/' + PLACEMENTS : t.label);
  };
  /* bot skill for a rating: Recruit below Silver, Normal to Platinum, Realistic above */
  RANKED.diff = r => r < 1000 ? 0 : r < 1600 ? 1 : 2;
  RANKED.abandon = function () {
    const me = G.player && G.player.match;
    Auth.record({ won: false, ranked: true, abandon: true, rounds: GAME.score[0] + GAME.score[1], roundsWon: GAME.score[GAME.myTeam], k: me ? me.k : 0, d: me ? me.d : 0, a: me ? me.a : 0, op: G.player && G.player.op.id });
    UI.toast('You left a ranked match: it counts as a loss.', 'bad');
  };

  /* --------------------------------------------------------------- screen */
  RANKED.open = function () {
    if (!Auth.user) return MENU.title();
    if (window.Online && Online.inParty()) return Online.showRoom();
    G.mode = 'menu'; HUD.show(false); PLAYER.release();
    const R = Auth.S.rank, t = RANKED.tier(R.rating);
    const placing = RANKED.placing();
    const page = $('div', { class: 'page ranked' }, UI.topbar('RANKED', () => MENU.home()),
      $('div', { class: 'panel rankpanel' },
        $('div', { class: 'rk-top' },
          $('div', { class: 'rk-emblem', style: { '--rc': placing ? '#8b93a1' : t.color } }, $('b', {}, placing ? '?' : t.name.slice(0, 1)), $('small', {}, placing ? 'UNRANKED' : t.div || '')),
          $('div', {},
            $('h2', {}, placing ? 'PLACEMENTS' : t.label),
            $('p', { class: 'muted' }, placing ? 'Play ' + (PLACEMENTS - R.games) + ' more ranked match' + (PLACEMENTS - R.games === 1 ? '' : 'es') + ' to get your rank. Placements move your rating twice as fast.' : 'Rating ' + R.rating + ' · peak ' + R.peak),
            $('div', { class: 'rk-nums' }, $('span', {}, $('b', {}, R.wins + '–' + R.losses), $('small', {}, 'RANKED W–L')), $('span', {}, $('b', {}, R.games), $('small', {}, 'MATCHES')), $('span', {}, $('b', {}, R.rating), $('small', {}, 'RATING'))))),
        $('div', { class: 'rk-ladder' }, ...TIERS.map(T => $('div', { class: 'rk-step' + (!placing && T.name === t.name ? ' on' : ''), style: { '--rc': T.color } }, $('i'), $('b', {}, T.name), $('small', {}, T.min ? T.min + '+' : '')))),
        $('h3', {}, 'RULES'),
        $('ul', { class: 'rk-rules' },
          $('li', {}, 'Bomb on any map, first to four rounds, sides swap every round.'),
          $('li', {}, 'Matchmaking looks for real players near your rating for up to ' + SEARCH + ' seconds. Empty seats are filled by bots playing at your level.'),
          $('li', {}, 'Win to gain rating, lose to drop it: beating a higher-rated team gains more. Ranked pays 50% more credits.'),
          $('li', {}, 'Leaving a match early counts as a loss.'),
          $('li', {}, 'Play with friends: CREATE PARTY, invite up to four friends, and the party is matched together on one team. Its rating is the party average.')),
        $('div', { class: 'actions' }, UI.btn('CREATE PARTY', () => Online.createParty(), ''), UI.btn('FIND MATCH', () => RANKED.find(), 'big'))));
    UI.screen(page);
  };

  /* ---------------------------------------------------------- matchmaking */
  RANKED.find = function () {
    if (!Auth.user) return MENU.title();
    // in a party, the leader searches for everyone (and nobody searches on their own)
    if (window.Online && Online.inParty()) { if (Online.partyLeader()) Online.partySearch(); else UI.toast('Only the party leader can start the search.', 'bad'); Online.showRoom(); return; }
    if (window.Online && Online.inRoom()) Online.leave(true);
    const myR = Auth.S.rank.rating, up = window.Net && Net.state === 'up';
    const S0 = RANKED.search = { t0: Date.now(), cancelled: false };
    const clock = $('b', { class: 'rk-clock' }, '0:00'), note = $('p', { class: 'muted' }, up ? 'Looking for players near your rating…' : 'You\'re offline: setting up a match with bots…');
    const page = $('div', { class: 'page ranked' }, UI.topbar('RANKED', null),
      $('div', { class: 'panel rk-search' }, $('div', { class: 'spin' }), $('h2', {}, 'FINDING A MATCH'), clock, note, RANKED.badge(myR, Auth.S.rank.games),
        $('div', { class: 'actions' }, UI.btn('CANCEL', () => { S0.cancelled = true; clearInterval(S0.tick); if (window.Online && Online.inRoom()) Online.leave(true); RANKED.open(); }, 'ghost'))));
    UI.screen(page);
    S0.tick = setInterval(() => {
      if (S0.cancelled || RANKED.search !== S0) { clearInterval(S0.tick); return; }
      const s = Math.floor((Date.now() - S0.t0) / 1000); clock.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 250);
    if (!up) { setTimeout(() => { if (!S0.cancelled) { clearInterval(S0.tick); RANKED.solo(); } }, 4000); return; }
    // a ranked room near my rating that's still filling up? join it; else open one and wait there
    setTimeout(() => {
      if (S0.cancelled) return;
      const rooms = [...Net.rooms.values()].filter(r => r.v === Online.PROTO && r.ranked && r.state === 'open' && !r.priv && r.n < r.max && Math.abs((r.r || 1000) - myR) < 400).sort((a, b) => b.n - a.n);
      clearInterval(S0.tick);
      if (rooms.length) Online.join(rooms[0].code, '');
      else Online.host({ ranked: true, name: 'RANKED · ' + RANKED.tier(myR).label, map: U.pick(MAPS.LIST).id, mode: 'bomb', rounds: 4, diff: RANKED.diff(myR), side: 'random', bots: true, listed: true, wait: SEARCH });
    }, 1500);
  };
  /* nobody to play with (or offline): ranked against bots at your level */
  RANKED.solo = function () {
    const r = Auth.S.rank.rating, map = U.pick(MAPS.LIST);
    const cfg = { mode: 'bomb', map: map.id, side: 'random', ranked: true, rounds: 4, diff: RANKED.diff(r) };
    MENU.cfg = Object.assign({}, MENU.cfg);
    MENU.loading('Ranked · ' + map.name + ' · filling the lobby with bots…', () => GAME.startMatch(cfg));
  };

  window.RANKED = RANKED;
})();
