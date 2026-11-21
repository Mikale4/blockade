/* cityz-bonds.js -- City Z: how the squad feel about each other. Every member has a feeling for every
   other one (you included), -100 (can't stand them) to 100 (would die for them), each way and not
   always matching.

     where it starts   how well their natures fit (a veteran and a rookie, a joker and a cynic, two
                       short fuses), plus chance; some of the starting crew have history: old friends,
                       or bad blood from something years ago. A recruit starts as a stranger
     what moves it     a gift (their own last one counts double), dressing a wound, talking someone
                       down, shooting the thing that was on top of them; refusing to share, running
                       off when it got bad, eating more than their share, the noise; quiet hours by a
                       fire or in a safehouse (which can go either way), and arguments
     grudges           each bad turn is remembered by what it was ("the water you wouldn't share"),
                       and brought up again
     what it changes   who shares with whom and who gets helped first, how far a calming word goes,
                       whether your orders are followed, how hard a death hits (and how little), and
                       what people say to each other

   And it boils over: people who dislike each other argue (which sometimes clears the air), a short
   fuse may shove, and someone who can't stand another any more says it's them or me: patch it up
   (a gift, a calming word) or part ways with one of them, or they walk. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const mem = x => x && (x.cz ? x.cz.m : x);
  const per = x => { const m = mem(x); return m && m.p ? m.p : null; };
  const nm = x => x && x.cz ? CZ.nm(x) : (x && x.name) || '?';
  const actorOf = uid => G.actors.find(x => x.cz && x.cz.m && x.cz.m.p && x.cz.m.p.uid === uid && x.state !== 'dead');
  const squad = () => G.actors.filter(x => x.cz && x.cz.m && x.cz.m.p && x.state === 'alive');
  const log = t => { if (CZ.S) CZ.S.story.log.push({ d: CZ.S.day, t }); };
  const say = (a, key, lines, pri) => { if (window.VOICE && a && a.bot) VOICE.say(a, key, lines, pri || 2); };

  /* ================================================================ natures */
  /* how well two people fit, -1..1 */
  function compat(p, q) {
    const A = p.t, B = q.t;
    let c = 0.15 - Math.abs(A.gen - B.gen) * 0.4 - A.temper * B.temper * 0.6 - Math.abs(A.disc - B.disc) * 0.25 + (A.gen + B.gen) * 0.15;
    const pair = [p.arch, q.arch].sort().join('+');
    c += ({ 'cynic+joker': -0.3, 'hothead+scholar': -0.25, 'hothead+veteran': -0.15, 'rookie+veteran': 0.35, 'carer+rookie': 0.25, 'loner+loner': -0.2, 'hothead+hothead': -0.2, 'carer+loner': -0.1, 'joker+rookie': 0.2, 'cynic+scholar': 0.15, 'carer+carer': 0.2, 'joker+joker': 0.15 })[pair] || 0;
    if (p.arch === 'carer' || q.arch === 'carer') c += 0.15;
    if (p.flaws.includes('hoarder') || q.flaws.includes('hoarder')) c -= 0.1;
    return U.clamp(c, -1, 1);
  }
  CZ.compat = compat;
  const FRIENDS = ['served together for years', 'one pulled the other out of a burning car once', 'came up through training together', 'grew up two streets apart', 'have each other\'s backs since the Harrow job'];
  const ENEMIES = ['a job that went wrong, and who got blamed for it', 'a promotion one of them didn\'t get', 'something said at a funeral', 'an old debt that never got paid', 'a report one of them wrote about the other'];

  /* ================================================================ feelings */
  CZ.relOf = (a, b) => { const p = per(a), q = per(b); if (!p || !q || p === q) return 0; return (p.rel && p.rel[q.uid]) || 0; };
  CZ.grudgeOf = (a, b) => { const p = per(a), q = per(b); return p && q && p.gr ? p.gr[q.uid] || null : null; };
  /* a's feelings for b move by d (why: what it was, remembered: a grudge if it hurt, a debt if it helped) */
  function bond(a, b, d, why) {
    const p = per(a), q = per(b); if (!p || !q || p === q || !d) return;
    p.rel = p.rel || {}; p.gr = p.gr || {}; p.gd = p.gd || {};
    const was = p.rel[q.uid] || 0, now = U.clamp(was + d, -100, 100);
    p.rel[q.uid] = now;
    if (why) { if (d < 0) p.gr[q.uid] = why; else p.gd[q.uid] = why; }
    // the big turns go in the journal (between teammates; not your own feelings)
    const A = a.cz ? a : actorOf(p.uid), B = b.cz ? b : actorOf(q.uid);
    if (!A || !B || A.isPlayer) return;
    if (was < 50 && now >= 50 && CZ.relOf(B, A) >= 25) log(nm(A) + ' and ' + nm(B) + ' have become close.');
    if (was > -50 && now <= -50) log(nm(A) + ' can\'t stand ' + (B.isPlayer ? 'you' : nm(B)) + (p.gr[q.uid] ? ' (' + p.gr[q.uid] + ')' : '') + '.');
  }
  CZ.bond = bond;
  /* a word for a feeling */
  CZ.relWord = v => v >= 60 ? 'close friends' : v >= 30 ? 'friends' : v >= 12 ? 'gets on with' : v > -12 ? null : v > -30 ? 'wary of' : v > -60 ? 'dislikes' : 'can\'t stand';

  /* ================================================================ where it starts */
  function uidFor(m) { if (!m.p.uid) m.p.uid = Math.random().toString(36).slice(2, 9); return m.p.uid; }
  function meet(m, n, stranger) {
    uidFor(m); uidFor(n);
    m.p.rel = m.p.rel || {}; n.p.rel = n.p.rel || {};
    if (m.p.rel[n.p.uid] != null) return;
    const c = compat(m.p, n.p);
    m.p.rel[n.p.uid] = Math.round(c * (stranger ? 15 : 35) + R(stranger ? -10 : -18, stranger ? 10 : 18));
    n.p.rel[m.p.uid] = Math.round(c * (stranger ? 15 : 35) + R(stranger ? -10 : -18, stranger ? 10 : 18));
  }
  function crewHistory(S) {
    const crew = S.squad.filter(m => m.p);
    // a pair or two with history, different every run
    const n = Math.random() < 0.7 ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0;
    for (let k = 0; k < n; k++) {
      const a = pick(crew), b = pick(crew.filter(x => x !== a)); if (!a || !b) continue;
      const good = Math.random() < 0.5;
      const why = good ? pick(FRIENDS) : pick(ENEMIES);
      for (const [x, y] of [[a, b], [b, a]]) {
        x.p.rel[y.p.uid] = good ? R(50, 70) : R(-60, -40);
        if (good) x.p.gd = Object.assign(x.p.gd || {}, { [y.p.uid]: why }); else x.p.gr = Object.assign(x.p.gr || {}, { [y.p.uid]: why });
        x.p.hist = Object.assign(x.p.hist || {}, { [y.p.uid]: (good ? 'old friends: ' : 'bad blood: ') + why });
      }
    }
  }
  function everyoneMeets(S, stranger) {
    const ms = S.squad.filter(m => m.p);
    for (const m of ms) uidFor(m);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) meet(ms[i], ms[j], stranger);
  }
  const oNew = CZ.newGame;
  CZ.newGame = function () { const S = oNew.apply(this, arguments); everyoneMeets(S, false); crewHistory(S); CZ.save(true); return S; };
  const oLoad = CZ.load;
  CZ.load = function () { const S = oLoad.apply(this, arguments); if (S) everyoneMeets(S, false); return S; };
  const oRec = CZ.recruit;
  CZ.recruit = function () {
    const m = oRec.apply(this, arguments);
    if (m && m.p) { uidFor(m); for (const n of CZ.S.squad) if (n !== m && n.p && n.alive) meet(m, n, true); }
    return m;
  };

  /* ================================================================ what moves it */
  const WORD = { thirst: 'water', hunger: 'food', bleed: 'dressing', hurt: 'medicine', infection: 'medicine', sick: 'medicine', ammo: 'ammo', fracture: 'splint', fatigue: 'coffee' };
  // a gift: the taker warms to the giver (more for someone's own last one)
  CZ.listen('gave', (giver, taker, id, n, last) => {
    if (!giver || !taker || giver === taker) return;
    taker.czAskRec = null;
    bond(taker, giver, last ? 14 : 7, last ? 'gave them their last ' + CZ.itemName(id).toLowerCase() : 'shared their ' + CZ.itemName(id).toLowerCase());
    if (last && taker.bot && Math.random() < 0.6) setTimeout(() => say(taker, 'thanks', ['That was your last one. I won\'t forget it, ' + nm(giver) + '.', 'I owe you, ' + nm(giver) + '.'], 3), 1500);
  });
  // asking out loud, and you standing there with it in your pack, doing nothing: that's remembered
  const HAS = { thirst: ['water', 'soda'], hunger: ['beans', 'soup', 'bar', 'mre', 'apple', 'choc', 'crisps', 'stew'], bleed: ['bandage', 'rag', 'medkit'], infection: ['antibiotics', 'antiviral'], sick: ['antibiotics'], hurt: ['medkit', 'painkillers', 'bandage'], fracture: ['splint', 'medkit'] };
  CZ.listen('askedFor', (a, need) => { if (!a.czAskRec || a.czAskRec.need !== need) a.czAskRec = { need, t: G.time }; });
  function ignored(a) {
    const r = a.czAskRec, pl = G.player; if (!r || !pl || pl.ghost || !pl.cz || G.time - r.t < 50) return;
    a.czAskRec = null;
    if (!(CZ.needsOf(a) || []).includes(r.need) || U.dist3(pl.pos, a.pos) > 12) return;
    const ids = r.need === 'ammo' ? [CZ.calOf((a.w[0] || {}).id || 'p10')] : HAS[r.need] || [];
    if (ids.some(id => (pl.cz.m.inv[id] || 0) > (r.need === 'ammo' ? 30 : 0))) { bond(a, pl, -4, 'you ignoring them when they needed ' + (WORD[r.need] || 'help')); if (Math.random() < 0.5) say(a, 'ignored', ['I can see it in your pack, ' + nm(pl) + '.', 'Thanks for nothing.'], 2); }
  }
  CZ.listen('treated', (giver, t) => { if (giver && t && giver !== t) bond(t, giver, 10, 'patched them up'); });
  // a refusal stings, if they asked
  CZ.listen('refused', (giver, t, need) => {
    if (!giver || !t || t.isPlayer || !t.bot || t.czNeed !== need) return;
    bond(t, giver, -6, 'the ' + (WORD[need] || 'help') + ' they wouldn\'t share');
  });
  CZ.listen('calmed', (by, who, snap) => { bond(who, by, snap ? 1 : 6, snap ? null : 'talked them down'); bond(by, who, snap ? -3 : 2, snap ? 'snapping at them' : null); });
  // bolting from a fight leaves the others in it
  CZ.listen('panic', (a, kind) => {
    if (kind !== 'flee') return;
    for (const x of squad()) if (x !== a && x.czNearInfT > G.time && U.dist3(x.pos, a.pos) < 18) bond(x, a, -6, 'running off when it got bad');
  });
  CZ.listen('asked', (t, p, got, kept) => { if (kept && got) bond(t, p, -2, 'taking their things'); else if (!got) bond(t, p, -1, null); });
  CZ.listen('clumsy', a => { for (const x of squad()) if (x !== a && U.dist3(x.pos, a.pos) < 12 && Math.random() < 0.3) bond(x, a, -1.5, 'all the noise they make'); });
  CZ.listen('revealed', (a, kind) => {
    for (const x of squad()) {
      if (x === a) continue;
      const r = CZ.relOf(x, a), q = per(x);
      if ((kind === 'traitor' || kind === 'agent') && q) { q.stress = Math.min(100, q.stress + 10 + Math.max(0, r) * 0.4); if (r > 30 && x.bot) say(x, 'betrayed', [nm(a) + '? No. Not ' + nm(a) + '.', 'I trusted you!'], 4); }
      if (kind === 'guardian') bond(x, a, 15, 'patched everyone up');
      if (kind === 'secretbite') { if (q && (q.t.gen > 0.7 || q.arch === 'carer')) bond(x, a, 5, null); else bond(x, a, -12, 'lying about the bite'); }
    }
  });
  // eating more than their share, while others go hungry
  const oUse = CZ.use;
  CZ.use = function (a, id) {
    const r = oUse.apply(this, arguments);
    if (r && CZ.has(a, 'glutton') && CZ.ITEMS[id] && CZ.ITEMS[id].cat === 'food')
      for (const x of squad()) if (x !== a && U.dist3(x.pos, a.pos) < 8 && x.cz.m.st.hunger > 55) bond(x, a, -3, 'eating more than their share');
    return r;
  };
  CZ.listen('kill', (v, k) => {
    // the infected that was on top of someone: they owe the one who shot it
    if (v.cz && (v.cz.inf || v.cz.opx) && k && k.cz && k.cz.m) {
      for (const x of squad()) {
        if (x === k || U.dist3(x.pos, v.pos) > 3.5) continue;
        bond(x, k, 5, 'shot one off them');
        if (x.bot && G.time > (x.czThankT || 0) && Math.random() < 0.5) { x.czThankT = G.time + 30; say(x, 'thanks', ['Thanks, ' + nm(k) + '. That was close.', 'Owe you one, ' + nm(k) + '.'], 3); }
      }
      // a bad fight shared: those in it together come out a little closer
      const near = squad().filter(x => U.dist3(x.pos, v.pos) < 15 && per(x).stress > 40);
      for (const x of near) for (const y of near) if (x !== y) bond(x, y, 0.4, null);
    }
    // a death in the squad: it hits friends harder, rivals less
    if (v.cz && v.cz.m && v.cz.m.p) {
      for (const x of squad()) {
        if (x === v) continue;
        const r = CZ.relOf(x, v), q = per(x);
        if (r > 40) { q.stress = Math.min(100, q.stress + 15 + (r - 40) * 0.3); if (x.bot) setTimeout(() => say(x, 'grief', ['No. No, not ' + nm(v) + '.', nm(v) + '... I\'m sorry. I\'m so sorry.', 'They got ' + nm(v) + '. They got ' + nm(v) + '!'], 4), 900); if (r > 60) log(nm(x) + ' took ' + nm(v) + '\'s death hard.'); }
        else if (r < -40) { q.stress = Math.max(0, q.stress - 10); if (x.bot && Math.random() < 0.4) setTimeout(() => say(x, 'cold', ['Can\'t say I\'ll miss them.', '...Well. That\'s that.'], 2), 2500); }
      }
    }
  });

  /* ================================================================ living together */
  /* every few seconds: quiet time together, arguments, shoves, ultimatums, a word to a friend */
  const oSurv = CZ.survivalTick;
  CZ.survivalTick = function (dt) {
    oSurv.apply(this, arguments);
    const Z = CZ.Z; if (!CZ.S || !Z || Z.guest) return;
    if ((Z.bondT = (Z.bondT || 0) - dt) <= 0) { Z.bondT = 5; together(); }
    if ((Z.argT = (Z.argT == null ? 25 : Z.argT) - dt) <= 0) { Z.argT = R(10, 20); friction(); }
    if ((Z.ultT = (Z.ultT || 0) - dt) <= 0) { Z.ultT = 4; ultimatums(); }
    if ((Z.chatT = (Z.chatT == null ? 40 : Z.chatT) - dt) <= 0) { Z.chatT = R(35, 80); chat(); }
  };
  const calmHere = a => !(a.czNearInfT > G.time);
  const restful = a => (CZ.isSafe(CZ.Z.id) && CZ.atSafe(a)) || CZ.nearFire(a) || a.czResting;
  /* hours by a fire or in a safehouse: they get to know each other, which brings the well-matched
     together and, when everyone is on edge, rubs the badly matched up the wrong way */
  function together() {
    const sq = squad();
    for (const a of sq) if (a.bot) ignored(a);
    for (const a of sq) for (const b of sq) {
      if (a === b || U.dist3(a.pos, b.pos) > 6 || !calmHere(a) || !restful(a)) continue;
      const p = per(a), q = per(b), c = compat(p, q), r = CZ.relOf(a, b);
      if (p.stress > 50 && q.stress > 50 && c < 0) { if (r > -40) bond(a, b, -0.4, null); }
      else if (r < 20 + c * 40) bond(a, b, 0.4 * (1 + c), null);
    }
  }
  /* people who don't like each other, close together, when nothing else is going on: words */
  function friction() {
    const sq = squad();
    for (const a of sq) {
      if (!a.bot || !calmHere(a) || CZ.inPanic(a) || a.busy > 0) continue;
      const p = per(a);
      for (const b of sq) {
        if (b === a || U.dist3(a.pos, b.pos) > 8) continue;
        const r = CZ.relOf(a, b); if (r > -25) continue;
        if (Math.random() > 0.05 + p.stress / 100 * 0.15 + p.t.temper * 0.12 + (r < -60 ? 0.1 : 0)) continue;
        argue(a, b); return;   // one row at a time
      }
    }
  }
  function argue(a, b) {
    const p = per(a), q = per(b), g = CZ.grudgeOf(a, b), bn = b.isPlayer ? nm(b) : nm(b);
    say(a, 'argue', g ? ["Don't think I've forgotten " + g + ', ' + bn + '.', bn + ', we need to talk about ' + g + '.', 'After ' + g + '? Unbelievable, ' + bn + '.'] : ['Can you not stand so close to me, ' + bn + '?', 'Do you ever stop talking, ' + bn + '?', 'Why are you even here, ' + bn + '?'], 3);
    p.stress = Math.min(100, p.stress + 5);
    if (b.isPlayer) { CZ.tell(b, nm(a) + ' has a problem with you' + (g ? ': ' + g : '') + ' · a gift or a calming word might help', 'warn'); bond(a, b, -1, null); return; }
    // the other one: owns up, or bites back (and a short fuse may shove)
    setTimeout(() => {
      if (!CZ.on() || a.state !== 'alive' || b.state !== 'alive') return;
      const sorry = q.t.temper < 0.45 && (q.t.gen > 0.5 || CZ.relOf(b, a) > 0) && Math.random() < 0.6;
      if (sorry) {
        say(b, 'sorry', ['Alright. I\'m sorry. I mean it.', 'Fair. That was on me.', 'You\'re right. I\'m sorry, ' + nm(a) + '.'], 3);
        bond(a, b, 9, 'apologised'); bond(b, a, 3, null); if (p.gr) delete p.gr[q.uid];
        if (Math.random() < 0.5) log(nm(a) + ' and ' + nm(b) + ' had words, and cleared the air.');
        return;
      }
      say(b, 'retort', ['Oh, here we go.', 'Get over it.', 'Like you\'re any better.', 'Say that again. I dare you.'], 3);
      bond(a, b, -4, null); bond(b, a, -5, 'what ' + nm(a) + ' said'); q.stress = Math.min(100, q.stress + 6);
      for (const x of squad()) if (x !== a && x !== b && U.dist3(x.pos, a.pos) < 10) per(x).stress = Math.min(100, per(x).stress + 3);
      if (CZ.relOf(a, b) < -65 && p.t.temper > 0.6 && Math.random() < 0.5) setTimeout(() => shove(a, b), 1200);
      else if (Math.random() < 0.4) log(nm(a) + ' and ' + nm(b) + ' had a shouting match' + (CZ.grudgeOf(a, b) ? ' over ' + CZ.grudgeOf(a, b) : '') + '.');
    }, 1800);
  }
  function shove(a, b) {
    if (!CZ.on() || a.state !== 'alive' || b.state !== 'alive' || U.dist3(a.pos, b.pos) > 4) return;
    const f = b.pos.clone().sub(a.pos).setY(0); if (f.lengthSq() < 0.01) f.set(1, 0, 0); f.normalize();
    b.vel.x += f.x * 5; b.vel.z += f.z * 5; WPN.aimPunch(b, 0.5); SFX.melee(b.eye(new THREE.Vector3()));
    say(a, 'shove', ['Touch me again. Go on.', 'Back OFF.'], 4);
    bond(b, a, -12, nm(a) + ' shoving them');
    HUD.toast(nm(a) + ' shoved ' + nm(b), 'warn');
    log(nm(a) + ' shoved ' + nm(b) + (CZ.grudgeOf(a, b) ? ' over ' + CZ.grudgeOf(a, b) : '') + '.');
  }
  /* "It's me or them": someone who can't stand another any more, on edge, gives you two minutes to
     sort it. It ends if they come round (above -70), if you part ways with the other, or if they go */
  function ultimatums() {
    const S = CZ.S;
    for (const a of squad()) {
      if (!a.bot || a.cz.m.player) continue;
      const u = a.czUlt;
      if (u) {
        const b = actorOf(u.uid);
        if (!b || CZ.relOf(a, b) > -70) { a.czUlt = null; if (b) { say(a, 'ult', ['Fine. Fine. I\'ll stay. For now.', 'Alright. We\'re square. Just about.'], 3); HUD.toast(nm(a) + ' will stay', 'info'); } continue; }
        if (G.time > u.until && calmHere(a)) {
          a.czUlt = null;
          if (CZ.squadCount() <= 2) continue;
          say(a, 'bye', ['I said I\'d go. I\'m going.', 'Good luck. You\'ll need it with ' + nm(b) + ' around.'], 4);
          log(nm(a) + ' left the squad: it was them or ' + (b.isPlayer ? 'you' : nm(b)) + '.');
          CZ.partWays(a);
        }
        continue;
      }
      if (per(a).stress < 55 || !calmHere(a) || CZ.squadCount() <= 2 || G.time < (a.czUltCd || 0)) continue;
      for (const b of squad()) {
        if (b === a || CZ.relOf(a, b) > -85 || Math.random() > 0.08) continue;
        a.czUlt = { uid: per(b).uid, until: G.time + 150 }; a.czUltCd = G.time + 600;
        say(a, 'ult', b.isPlayer ? ["I'm done following you, " + nm(b) + '. Give me a reason to stay.', "Either things change with you, or I'm gone."] : ["It's me or " + nm(b) + '. Decide.', "One of us walks. I'm not sleeping in the same room as " + nm(b) + '.'], 4);
        const pl = G.player; if (pl && !pl.ghost) HUD.toast(nm(a) + (b.isPlayer ? ' is ready to leave because of you' : ' says it\'s them or ' + nm(b)) + ' · patch it up (a gift, a calming word)' + (b.isPlayer ? '' : ' or part ways with one of them') + ' in the next two minutes', 'warn');
        log(nm(a) + ' said it was them or ' + (b.isPlayer ? 'you' : nm(b)) + '.');
        break;
      }
    }
  }
  /* now and then, a word to a friend (or about someone they can't stand) */
  function chat() {
    const sq = squad().filter(a => a.bot && calmHere(a) && !CZ.inPanic(a));
    const a = pick(sq); if (!a) return;
    const p = per(a);
    let best = null, bv = 0;
    for (const b of squad()) { if (b === a || U.dist3(a.pos, b.pos) > 10) continue; const r = CZ.relOf(a, b); if (Math.abs(r) > Math.abs(bv)) { bv = r; best = b; } }
    if (!best || Math.abs(bv) < 30) return;
    const bn = nm(best), q = per(best);
    if (bv > 0) say(a, 'friend', p.arch === 'veteran' && q.arch === 'rookie' ? ['Keep your head down, ' + bn + '. You\'re doing fine.', 'Stay on my shoulder, ' + bn + '.'] : p.arch === 'joker' ? ['If I get eaten, ' + bn + ', you can have my crisps.', bn + ', remind me why we signed up for this?'] : ['Glad it\'s you watching my back, ' + bn + '.', 'Stay close, ' + bn + '.', 'We\'re getting out of this, ' + bn + '. Both of us.'], 1);
    else say(a, 'rival', ['Keep ' + bn + ' away from me.', 'If ' + bn + ' says one more word...', 'Don\'t put me on watch with ' + bn + '.'], 1);
  }

  /* ================================================================ what you know */
  /* who gets on with whom, as far as you've seen: after a day together, or once it's come out */
  CZ.bondsOf = function (a) {
    const p = per(a); if (!p || !p.rel) return null;
    const days = CZ.S.day - (p.met || 1), out = { likes: [], dislikes: [], you: null, hist: [], ult: null };
    for (const b of squad()) {
      if (b === a) continue;
      const q = per(b), r = CZ.relOf(a, b), w = CZ.relWord(r), h = p.hist && p.hist[q.uid];
      if (h) out.hist.push(nm(b) + ' (' + h + ')');
      if (b.isPlayer) { if (days >= 1 || Math.abs(r) >= 30) out.you = { r, w: r >= 50 ? 'would follow you anywhere' : r >= 20 ? 'trusts you' : r > -15 ? 'neutral about you' : r > -45 ? 'wary of you' : 'resents you', why: r < -15 ? CZ.grudgeOf(a, b) : r > 15 ? (p.gd && p.gd[q.uid]) : null }; continue; }
      if (!w || (days < 1 && Math.abs(r) < 45)) continue;
      (r > 0 ? out.likes : out.dislikes).push(nm(b) + ' (' + w + (r < 0 && CZ.grudgeOf(a, b) ? ': ' + CZ.grudgeOf(a, b) : '') + ')');
    }
    if (a.czUlt) { const b = actorOf(a.czUlt.uid); if (b) out.ult = 'Wants ' + (b.isPlayer ? 'things to change with you' : nm(b) + ' gone') + ': it\'s them or me (' + Math.max(0, Math.ceil(a.czUlt.until - G.time)) + ' s)'; }
    return out;
  };
})();
