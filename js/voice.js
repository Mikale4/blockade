/* voice.js -- operators talk. Lines are written per operator and per situation; each one is shown as a
   radio subtitle and spoken by the browser's speech synthesis, with a voice, pitch and pace chosen to
   suit whoever is talking (DATA operator .voice: { g, pitch, rate, lang }). Settings: voiceLines (the
   subtitles), voiceSpeech (speaking them).

   Who hears what: your own lines, your team's (on the radio), and an enemy's only within 14 m.
   One line at a time; each operator waits 7 s between lines and each kind of line has its own
   cooldown, so a firefight is a few words, not a chorus. In an online match the host decides who
   says what and sends it to the guests ('vo' events), so everyone hears the same line.

     VOICE.say(actor, event)         a line for this situation, if one is due
     VOICE.add(opId, { event: [...] })  more lines (each operator file adds its own)
   Events: round (the action phase begins), ability, kill, spot, reload, hurt, down, lost (a teammate
   fell), win, lose, pick (chosen on the select screen), plus operator-specific ones (move, intel). */
(function () {
  'use strict';
  const VOICE = window.VOICE = { LINES: {}, GENERIC: {} };
  VOICE.add = (id, lines) => { VOICE.LINES[id] = Object.assign(VOICE.LINES[id] || {}, lines); };
  const PRIO = { down: 5, kill: 3, lost: 4, spot: 3, intel: 3, ability: 2, move: 2, hurt: 2, win: 4, lose: 4, round: 1, reload: 1, pick: 5 };
  const EVCD = { reload: 14, hurt: 10, spot: 8, round: 30, kill: 3, ability: 4, intel: 5, move: 6 };
  const lastBy = new Map(), lastEv = {}, lastIdx = {};
  let shownUntil = 0, el = null;

  /* ------------------------------------------------------------ lines */
  VOICE.GENERIC = {
    atk: { round: ['Moving in.', 'Stack up, let\'s go.', 'On me.'], kill: ['Got one.', 'Tango down.', 'Target down.'], spot: ['Contact!', 'Enemy spotted.', 'Eyes on one.'], reload: ['Reloading!', 'Changing mags.'], hurt: ['I\'m hit!', 'Taking fire!'], down: ['I\'m down!', 'Need a hand here!'], lost: ['Man down!', 'We lost one.'], win: ['Area clear.', 'That\'s the round.'], lose: ['Pull back...', 'They had us.'] },
    def: { round: ['Here they come.', 'Hold your angles.', 'Stay sharp.'], kill: ['Got one.', 'One less.', 'Down.'], spot: ['Contact!', 'They\'re here.', 'Eyes on one.'], reload: ['Reloading!', 'Changing mags.'], hurt: ['I\'m hit!', 'Taking fire!'], down: ['I\'m down!', 'Need a hand!'], lost: ['Man down!', 'We lost one.'], win: ['Site\'s ours.', 'Held it.'], lose: ['They\'re through...', 'Lost the site.'] },
  };
  VOICE.add('pivot', {
    pick: ['Every wall is a door. Some of them just don\'t know it yet.', 'Arancibia. I\'ll get you in quietly.'],
    round: ['Give me four seconds and a wall.', 'No explosions. I\'ll find you a door.', 'Quietly, everyone. We have time.'],
    ability: ['Door\'s cut. Say the word.', 'Panel\'s free. Open when you\'re ready.', 'There. Now it is a door.'],
    kill: ['Excuse me.', 'Lo siento.', 'He should have checked the wall.'],
    spot: ['Behind that wall. I heard him breathe.', 'One there. Don\'t rush it.'],
    reload: ['Reloading. Patience.', 'One moment.'],
    hurt: ['Ay... that one stung.', 'I\'m hit. It\'s nothing.'],
    down: ['I\'m down. Somebody... open a door for me.', 'Down. Don\'t leave me under the rubble.'],
    lost: ['We lost one. Keep calm.', 'Man down. Slow and steady now.'],
    win: ['Clean. Like I said: no mess.', 'And not one explosion.'],
    lose: ['Next time I cut faster.', 'We made too much noise.'],
  });
  VOICE.add('bound', {
    pick: ['Kamau. You go round. I go over.', 'Floors are a suggestion.'],
    round: ['Race you to the roof.', 'Up and over, let\'s move!', 'Watch this.'],
    ability: ['Plate\'s down. Mind the first step.', 'Spring\'s set. One way up!', 'Plate down. Jump on.'],
    move: ['Wheee... okay, I\'m up!', 'Landed! Mostly.', 'Up top!'],
    kill: ['Too slow!', 'Didn\'t see me coming, did you?', 'Photo finish.'],
    spot: ['One up top!', 'Contact, high!'],
    reload: ['Reloading, cover me!', 'Mag change!'],
    hurt: ['Ow! Okay, okay.', 'Hit! Still running.'],
    down: ['I\'m down... somebody carry me over the line.', 'Down! Bad landing!'],
    lost: ['No! Keep moving, keep moving!', 'We lost one. Don\'t stop now.'],
    win: ['First place!', 'Gold medal, team.'],
    lose: ['Should have trained harder.', 'Next heat. We go again.'],
  });
  VOICE.add('plummet', {
    pick: ['Haugland. I\'ll come in from above.', 'Ceilings. Nobody watches the ceilings.'],
    round: ['Find me a hole in a floor.', 'I\'ll be overhead.', 'Quiet now.'],
    ability: ['On the line.', 'Going down.', 'Anchor set.'],
    kill: ['Look up next time.', 'From above.', 'Done.'],
    spot: ['Below me, one.', 'Contact. Under the floor.'],
    reload: ['Reloading.', 'Mag.'],
    hurt: ['Hit.', 'That one went through.'],
    down: ['Down. Line\'s cut.', 'I\'m down.'],
    lost: ['One down. Stay calm.', 'We lost one.'],
    win: ['Good work.', 'Clear.'],
    lose: ['Hm.', 'Again, then.'],
  });
  VOICE.add('perch', {
    pick: ['McIntyre! Gie\'s a metre of scaffold and I\'ll gie ye the room.', 'Right, who wants the view?'],
    round: ['Up we go, lads! Best seat in the house.', 'Eyes up, they\'re coming.', 'Here they come, the daft beggars.'],
    ability: ['Scaffold\'s up! Built tae last... about a minute.', 'There ye go, a wee perch.', 'Up she goes!'],
    kill: ['Get it right up ye!', 'Never looked up, did ye?', 'Wee bit high for ye, pal.'],
    spot: ['One coming in! I see him!', 'Contact, doorway!'],
    reload: ['Reloadin\'!', 'Hold on, hold on, mag!'],
    hurt: ['Ah, ya bas... I\'m hit!', 'That\'ll leave a mark!'],
    down: ['I\'m down! Somebody get me aff the floor!', 'Doon! I\'m doon!'],
    lost: ['Ach, we lost one!', 'Man down, man down!'],
    win: ['Get in there! Drinks are on Rosario!', 'Told ye. Best view in the house.'],
    lose: ['Aw, bloody hell.', 'Nae luck, lads.'],
  });
  VOICE.add('winch', {
    pick: ['Dimaculangan. Who needs stairs?', 'Up, down, wherever you need. Hold on tight.'],
    round: ['Everyone know where the hoist is? Good.', 'Okay, positions! Quickly, quickly.', 'Stay together and stay alive, ha?'],
    ability: ['Hoist is rigged! Grab and go!', 'Hoist ready. Mind your fingers.', 'Up and down, anytime.'],
    kill: ['That\'s what you get!', 'Sit down!', 'Ay, next!'],
    spot: ['One coming, watch it!', 'Contact! Below us!'],
    reload: ['Reloading, cover me, anak!', 'Wait, wait, reloading!'],
    hurt: ['Aray! I\'m hit!', 'Ay! Okay, okay, I\'m fine!'],
    down: ['I\'m down! Somebody pull me up!', 'Help! I\'m down!'],
    lost: ['Ay, no! We lost one!', 'Man down! Hold together!'],
    win: ['Good job, everyone! I\'m proud!', 'See? Teamwork!'],
    lose: ['Ay, sayang. Next round.', 'We\'ll do better. Come, come.'],
  });
  VOICE.add('strain', {
    pick: ['Inoue. Every structure tells you when it is about to fail.', 'I listen to the walls.'],
    round: ['Gauges are reading. Patience.', 'Let them come to the wall.', 'Quiet. The building will tell us.'],
    ability: ['Gauge set.', 'This patch is mine now.', 'Calibrated.'],
    intel: ['A spike on the east panel. Someone is cutting.', 'Load reading. They are on the wall.', 'The gauge is talking. There.'],
    kill: ['Failure under load.', 'As predicted.', 'Tolerance exceeded.'],
    spot: ['One there. Exactly there.', 'Contact.'],
    reload: ['Reloading.', 'A moment.'],
    hurt: ['Hit. Within tolerance.', 'I am hit.'],
    down: ['I am down. Structural failure.', 'Down. Please hurry.'],
    lost: ['We lost one.', 'One down. Stay calm.'],
    win: ['Holding. As calculated.', 'Good. The structure held.'],
    lose: ['The margins were too thin.', 'Collapse.'],
  });

  /* ------------------------------------------------------------ voices */
  const FEM = /female|zira|hazel|susan|samantha|victoria|karen|moira|tessa|fiona|veena|heera|catherine|sonia|libby|aria|jenny|emma|ava|allison|serena|kate|linda|natasha|clara/i;
  const MALE = /\bmale\b|david|mark|george|daniel|alex|fred|rishi|james|ryan|guy|thomas|oliver|arthur|liam|aaron|gordon|lee|william/i;
  const voiceCache = new Map();
  function pickVoice(op) {
    if (!window.speechSynthesis) return null;
    if (voiceCache.has(op.id)) return voiceCache.get(op.id);
    const all = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    if (!all.length) return null;
    const pv = op.voice || {}, want = pv.lang || ['en-US', 'en-GB'], g = pv.g || 'm';
    const gender = v => FEM.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : '?';
    let pool = [];
    for (const l of want) { pool = all.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(l.toLowerCase()) && gender(v) === g); if (pool.length) break; }
    if (!pool.length) pool = all.filter(v => gender(v) === g);
    if (!pool.length) pool = all;
    let h = 0; for (const c of op.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const v = pool[h % pool.length];
    voiceCache.set(op.id, v);
    return v;
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => voiceCache.clear();

  /* ------------------------------------------------------------ saying */
  function linesFor(a, ev) {
    const own = (VOICE.LINES[a.op.id] || {})[ev];
    if (own && own.length) return own;
    const gen = VOICE.GENERIC[a.side === 'def' ? 'def' : 'atk'];
    return gen && gen[ev];
  }
  VOICE.say = function (a, ev, force, pri) {
    if (Array.isArray(force)) return sayText(a, ev, force, pri);   // (a, key, [lines], priority): words of the caller's own
    if (!a || !a.op || a.hostage || a.dummy || a.ghost) return false;
    if (window.GAME && GAME.client) return false;            // (the host decides, and tells the guests)
    if (a.state === 'dead' && ev !== 'down') return false;
    const L = linesFor(a, ev); if (!L || !L.length) return false;
    const now = G.time, pr = PRIO[ev] || 1;
    if (!force) {
      if (now - (lastBy.get(a) || -99) < 7 && pr < 4) return false;
      const k = a.team + ':' + ev; if (now - (lastEv[k] || -99) < (EVCD[ev] || 2)) return false;
      lastEv[k] = now;
    }
    lastBy.set(a, now);
    const key = a.op.id + ':' + ev; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === lastIdx[key]) i = (i + 1) % L.length; lastIdx[key] = i;
    deliver(a, ev, i, pr);
    if (window.NP && NP.active && NP.host) NP.push({ k: 'vo', a: a.id, e: ev, i });
    return true;
  };
  /* a line written by the caller (City Z's people say what they feel and need): one of the lines given,
     with the same pacing (a few seconds between lines from one person, longer for the same kind) */
  function sayText(a, ev, L, pri) {
    if (!a || !a.op || a.hostage || a.dummy || a.ghost || !L || !L.length) return false;
    if (window.GAME && GAME.client) return false;
    if (a.state === 'dead') return false;
    const now = G.time, pr = pri || 2;
    if (pr < 4) {
      if (now - (lastBy.get(a) || -99) < (pr >= 3 ? 3 : 6)) return false;
      const k = a.id + ':' + ev; if (now - (lastEv[k] || -99) < 12) return false; lastEv[k] = now;
    }
    lastBy.set(a, now);
    const key = a.id + ':' + ev; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === lastIdx[key]) i = (i + 1) % L.length; lastIdx[key] = i;
    deliverText(a, L[i], pr);
    if (window.NP && NP.active && NP.host) NP.push({ k: 'vo', a: a.id, t: L[i], p: pr });
    return true;
  }
  VOICE.sayText = sayText;
  /* show it and speak it, if it reaches this player */
  function deliver(a, ev, i, pr) {
    const L = linesFor(a, ev); if (!L || !L[i]) return;
    deliverText(a, L[i], pr);
  }
  function deliverText(a, text, pr) {
    const me = G.player; if (!me) return;
    const spect = !!(GAME && GAME.spectator) || me.ghost;
    const mine = a === me, team = !spect && a.team === me.team, near = U.dist3(a.pos, me.pos) < 14;
    if (!mine && !team && !near && !spect) return;
    if (G.settings.voiceLines !== false) show(a, text, !mine && !team && !spect);
    if (G.settings.voiceSpeech !== false && window.speechSynthesis && (pr >= 2 || !speechSynthesis.speaking)) speak(a, text, mine || team || spect ? 1 : 0.55);
  }
  VOICE.deliver = deliver;
  function show(a, text, enemy) {
    if (!el) { el = document.createElement('div'); el.id = 'vo'; document.body.appendChild(el); }
    const u = DATA.UNITS[a.op.unit], col = u ? u.color : '#ddd';
    const row = document.createElement('div'); row.className = 'vo-line' + (enemy ? ' enemy' : '');
    const nm = document.createElement('b'); nm.textContent = (enemy ? '(nearby) ' : '') + a.op.name; nm.style.color = col;
    const tx = document.createElement('span'); tx.textContent = ' ' + text;
    row.append(nm, tx); el.appendChild(row);
    while (el.children.length > 3) el.removeChild(el.firstChild);
    setTimeout(() => { row.classList.add('fade'); setTimeout(() => row.remove(), 700); }, 3600);
  }
  function speak(a, text, vol) {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[^\w\s.,!?'\-]/g, ''));
      const v = pickVoice(a.op); if (v) u.voice = v;
      const pv = a.op.voice || {};
      // older operators without a profile: a stable pitch from their name
      let h = 0; for (const c of a.op.id) h = (h * 17 + c.charCodeAt(0)) % 997;
      u.pitch = pv.pitch || (0.85 + (h % 30) / 100); u.rate = pv.rate || 1.02;
      u.volume = Math.max(0, Math.min(1, (G.settings.voiceVol == null ? 0.85 : G.settings.voiceVol) * (G.settings.volume == null ? 1 : G.settings.volume) * vol));
      if (speechSynthesis.pending) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { }
  }
  /* the select screen: the operator introduces themself */
  VOICE.intro = function (op) {
    if (!op || G.settings.voiceSpeech === false) return;
    const L = (VOICE.LINES[op.id] || {}).pick; if (!L || !L.length) return;
    try { speechSynthesis.cancel(); } catch (e) { }
    speak({ op }, U.pick(L), 1);
  };

  /* ------------------------------------------------------------ hooks */
  const wrap = (obj, key, after) => { const o = obj[key]; if (typeof o !== 'function') return; obj[key] = function () { const r = o.apply(this, arguments); try { after.call(this, r, arguments); } catch (e) { } return r; }; };
  wrap(GAD, 'ability', (r, [a]) => { if (r && a && a.ability && !['rcharge', 'scanner', 'spotter', 'hinge'].includes(a.ability.id)) VOICE.say(a, 'ability'); });
  wrap(GAME, 'onKill', (r, [v, k]) => {
    if (k && k !== v && k.team !== v.team) VOICE.say(k, 'kill');
    if (!v.hostage) { const mate = G.actors.find(x => x !== v && x.team === v.team && x.state === 'alive' && !x.hostage); if (mate) VOICE.say(mate, 'lost'); }
  });
  wrap(GAME, 'onDown', (r, [v]) => { if (!v.hostage) VOICE.say(v, 'down', true); });
  wrap(GAME, 'beginAction', () => {
    for (const t of [0, 1]) { const xs = G.actors.filter(x => x.team === t && x.state === 'alive' && !x.hostage); if (xs.length) VOICE.say(U.pick(xs), 'round', true); }
  });
  wrap(GAME, 'endRound', (r, [winner]) => {
    for (const t of [0, 1]) { const xs = G.actors.filter(x => x.team === t && x.state === 'alive' && !x.hostage); if (xs.length) VOICE.say(U.pick(xs), t === winner ? 'win' : 'lose', true); }
  });
  wrap(GAME, 'mark', (r, [t, team, dur, announce]) => {
    if (!announce || !t || !t.isActor) return;
    let best = null, bd = 30; for (const x of G.actors) if (x.team === team && x.state === 'alive' && !x.hostage && U.dist3(x.pos, t.pos) < bd) { bd = U.dist3(x.pos, t.pos); best = x; }
    if (best) VOICE.say(best, 'spot');
  });
  wrap(WPN, 'reload', (r, [a]) => { if (a && a.wpn && a.wpn.mag === 0) VOICE.say(a, 'reload'); });
  if (window.Actor && Actor.prototype.hurt) {
    const oh = Actor.prototype.hurt;
    Actor.prototype.hurt = function (dmg, info) { const r = oh.apply(this, arguments); try { if (this.state === 'alive' && this.hp < 45 && this.hp > 0 && !(info && info.kind === 'fall')) VOICE.say(this, 'hurt'); } catch (e) { } return r; };
  }
  // guests: what the host says
  if (window.OPS2) OPS2.chain('guestEvent', function (e) {
    if (e.k !== 'vo') return;
    const a = NP.byId && NP.byId.get(e.a); if (a) { if (e.t) deliverText(a, String(e.t), e.p || 2); else deliver(a, e.e, e.i | 0, PRIO[e.e] || 1); }
    return true;
  });
})();
