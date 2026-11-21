/* cityz-people.js -- City Z: the people in the squad are people. Each one (the starting five and anyone
   recruited on the way) is rolled fresh every campaign:

     a kind of person   eight archetypes (the veteran, the rookie, the loner, the carer, the hothead,
                        the scholar, the joker, the cynic), each with its own spread of traits:
                        generosity, nerve, know-how, discipline, appetite, care for wounds, temper
     strengths, flaws   one or two of each: a medic, a scrounger, a pack mule, an iron stomach ...
                        a glutton, a coward, squeamish, a hoarder, a scatterbrain ...
     a mood             stress that rises with wounds, hunger, the dead and the infected close,
                        and falls with food, rest, a fire's company and safety; scared people make worse choices
     their own limits   when hunger, thirst, a wound or tiredness becomes something they act on is theirs,
                        and moves a little from day to day
     a hidden agenda    most are what they seem; some are thieves, plants, deserters, hiding a bite, or
                        working for Command. You learn who someone is by travelling with them: their
                        traits over the first days, their true intentions only when they show them.

   Nothing they do is certain: CZ.decide() turns how badly something is needed, who they are and how
   they feel into a chance, rolled each time they think about it. So one eats at the first pang and
   another waits until they're shaking; one hands over their last can and another won't share at all.
   Recruits join the squad (ten at most, you included; a campaign starts with five); anyone can be let go. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ================================================================ who people are */
  // gen: generosity, nerve, smarts (know-how), disc: discipline, app: appetite (eats/drinks early),
  // care: treats wounds early, temper
  CZ.ARCHETYPES = {
    veteran: { name: 'The Veteran', desc: 'Has done this before. Steady, does what is needed, not much for talk.', t: { gen: 0.55, nerve: 0.85, smarts: 0.75, disc: 0.85, app: 0.45, care: 0.7, temper: 0.35 } },
    rookie: { name: 'The Rookie', desc: 'Wants to do right and is scared out of their mind.', t: { gen: 0.6, nerve: 0.2, smarts: 0.4, disc: 0.6, app: 0.6, care: 0.5, temper: 0.3 } },
    loner: { name: 'The Loner', desc: 'Looks after number one. Capable, but don\'t count on sharing.', t: { gen: 0.15, nerve: 0.65, smarts: 0.7, disc: 0.35, app: 0.55, care: 0.6, temper: 0.5 } },
    carer: { name: 'The Carer', desc: 'Notices when anyone is hurting, and gives away too much.', t: { gen: 0.95, nerve: 0.5, smarts: 0.6, disc: 0.6, app: 0.35, care: 0.4, temper: 0.15 } },
    hothead: { name: 'The Hothead', desc: 'First through the door, last to listen.', t: { gen: 0.45, nerve: 0.9, smarts: 0.4, disc: 0.2, app: 0.6, care: 0.25, temper: 0.9 } },
    scholar: { name: 'The Scholar', desc: 'Knows how to make anything out of anything. Jumps at shadows.', t: { gen: 0.5, nerve: 0.3, smarts: 0.95, disc: 0.55, app: 0.45, care: 0.75, temper: 0.25 } },
    joker: { name: 'The Joker', desc: 'Keeps everyone going. Forgets things. Eats your crisps.', t: { gen: 0.7, nerve: 0.6, smarts: 0.45, disc: 0.35, app: 0.8, care: 0.4, temper: 0.3 } },
    cynic: { name: 'The Cynic', desc: 'Expects the worst, plans for it, complains the whole time.', t: { gen: 0.3, nerve: 0.55, smarts: 0.7, disc: 0.5, app: 0.4, care: 0.65, temper: 0.65 } },
  };
  CZ.PERKS = {
    medic: { name: 'Medic', desc: 'Treats wounds quickly and well, never squeamish; spots a hidden bite.' },
    scrounger: { name: 'Scrounger', desc: 'Finds a little more in every search.' },
    packmule: { name: 'Pack mule', desc: 'Carries 8 kg more.' },
    ironstomach: { name: 'Iron stomach', desc: 'Dirty water and bad food don\'t make them sick.' },
    nightowl: { name: 'Night owl', desc: 'Tires less at night.' },
    sharpshooter: { name: 'Sharpshooter', desc: 'A steady aim.' },
    handy: { name: 'Handy', desc: 'Knows how to make dressings, splints, fires and boil water, whatever else they know.' },
    calm: { name: 'Calm', desc: 'Stress builds in them at half the rate.' },
    tough: { name: 'Tough', desc: 'Shrugs off a fifth of every hit.' },
  };
  CZ.FLAWS = {
    clumsy: { name: 'Clumsy', desc: 'Knocks things over: noisier than anyone.' },
    glutton: { name: 'Glutton', desc: 'Gets hungry faster, and eats when they don\'t need to.' },
    insomniac: { name: 'Insomniac', desc: 'Rest does them less good.' },
    squeamish: { name: 'Squeamish', desc: 'Struggles to dress anyone else\'s wounds.' },
    coward: { name: 'Coward', desc: 'Under enough stress, runs from the infected.' },
    hothead: { name: 'Short fuse', desc: 'Ignores orders to hold back.' },
    scatterbrain: { name: 'Scatterbrain', desc: 'Forgets to eat, drink or treat a wound until it\'s bad.' },
    hoarder: { name: 'Hoarder', desc: 'Doesn\'t like giving anything away.' },
    badback: { name: 'Bad back', desc: 'Carries 6 kg less.' },
    anxious: { name: 'Anxious', desc: 'Worry builds fast in them, and past a point it becomes a panic attack.' },
  };
  CZ.AGENDAS = {
    loyal: { name: 'Loyal', desc: 'What you see is what you get.' },
    thief: { name: 'Thief', desc: 'Has been skimming the stash. Gone one night, with it.' },
    traitor: { name: 'Plant', desc: 'Working for someone else all along: turns on the squad.' },
    secretbite: { name: 'Hiding a bite', desc: 'Bitten before you met, and saying nothing.' },
    deserter: { name: 'Quitter', desc: 'Will walk away when things get bad enough.' },
    agent: { name: 'Command\'s agent', desc: 'Here for the cure, for Command, whatever it takes.' },
    guardian: { name: 'Guardian', desc: 'A field medic hiding it: shows it when it counts.' },
  };
  const BIOS = ['Drove a delivery van before all this.', 'Was a nurse at a care home on the ring road.', 'Ran a bar in Ashford. Still wipes surfaces.', 'Played rugby badly and talks about it a lot.', 'Was halfway through a law degree.', 'Worked nights at the distribution centre.', 'Fixed boilers for a living.', 'Taught primary school. Counts everyone, always.', 'Was in the army reserve, says it never came up.', 'Sold phones at the Galleria.', 'Has a sister somewhere on the other side of the fence.', 'Lost everyone in the first week and won\'t talk about it.'];

  /* a person, rolled: an archetype with noise, strengths and flaws, their own thresholds, maybe an agenda */
  CZ.rollPerson = function (recruit, notPlayer) {
    const ak = pick(Object.keys(CZ.ARCHETYPES)), A = CZ.ARCHETYPES[ak];
    const t = {}; for (const [k, v] of Object.entries(A.t)) t[k] = clamp01(v + R(-0.2, 0.2));
    const perks = [], flaws = [], pk = Object.keys(CZ.PERKS), fk = Object.keys(CZ.FLAWS);
    perks.push(pick(pk)); if (Math.random() < 0.35) { const x = pick(pk); if (!perks.includes(x)) perks.push(x); }
    flaws.push(pick(fk)); if (Math.random() < 0.35) { const x = pick(fk); if (!flaws.includes(x)) flaws.push(x); }
    if (flaws.includes('hoarder')) t.gen = Math.min(t.gen, 0.15);
    if (flaws.includes('hothead')) { t.disc = Math.min(t.disc, 0.25); t.temper = Math.max(t.temper, 0.75); }
    if (flaws.includes('coward')) t.nerve = Math.min(t.nerve, 0.3);
    if (flaws.includes('scatterbrain')) t.smarts = Math.min(t.smarts, 0.35);
    if (flaws.includes('anxious')) t.nerve = Math.min(t.nerve, 0.45);
    const p = { arch: ak, t, perks, flaws, stress: R(5, 25), bio: pick(BIOS), met: CZ.S ? CZ.S.day : 1, th: {} };
    rollThresholds(p);
    // a hidden agenda: rarer in the crew BLOCKADE sent in than in strangers met in a dead city
    let ag = 'loyal';
    if (notPlayer !== false) {
      const r = Math.random();
      if (recruit ? r < 0.5 : r < 0.3) ag = pick(recruit ? ['thief', 'thief', 'traitor', 'traitor', 'secretbite', 'deserter', 'deserter', 'guardian'] : ['thief', 'traitor', 'secretbite', 'deserter', 'agent', 'guardian']);
    }
    p.agenda = { kind: ag, reveal: (CZ.S ? CZ.S.day : 1) + Math.floor(R(recruit ? 1.5 : 2.5, recruit ? 4.5 : 6.5)), shown: false, hints: 0 };
    return p;
  };
  /* when each need becomes something they act on: their own, moved a little each day */
  function rollThresholds(p) {
    const t = p.t, glut = p.flaws.includes('glutton'), scat = p.flaws.includes('scatterbrain');
    p.th = {
      hunger: Math.round(80 - t.app * 35 + R(-6, 6) - (glut ? 12 : 0) + (scat ? 10 : 0)),
      thirst: Math.round(75 - t.app * 30 + R(-6, 6) + (scat ? 10 : 0)),
      hurt: Math.round(35 + t.care * 30 + R(-6, 6) - (scat ? 10 : 0)),
      infection: Math.round(30 + (1 - t.smarts) * 20 + R(-4, 6)),
      fatigue: Math.round(65 + (t.nerve * 10) + R(-6, 8)),
    };
  }
  CZ.listen('day', () => { for (const m of CZ.S.squad) if (m.p && m.alive) rollThresholds(m.p); });

  /* ================================================================ accessors */
  CZ.P = a => (a && a.cz && a.cz.m && a.cz.m.p) || null;
  CZ.has = (a, perk) => { const p = CZ.P(a); return !!p && (p.perks.includes(perk) || p.flaws.includes(perk)); };
  CZ.nm = a => (a && a.cz && a.cz.m && a.cz.m.recruit) ? a.cz.m.name : (a && a.op ? a.op.name : '?');
  /* a bite they're keeping to themselves (until it's too far along to hide) */
  CZ.hidBite = a => { const p = CZ.P(a); return !!(p && p.agenda && p.agenda.kind === 'secretbite' && !p.agenda.shown && a.cz.m.st.infection < 75); };
  CZ.th = (a, need, def) => { const p = CZ.P(a); return p && p.th[need] != null ? p.th[need] : def; };
  /* how they feel, in a word */
  CZ.moodOf = a => {
    const p = CZ.P(a); if (!p) return '';
    const s = p.stress, angry = p.t.temper > 0.65;
    return s < 25 ? 'calm' : s < 50 ? 'uneasy' : s < 75 ? (angry ? 'angry' : 'scared') : (angry ? 'furious' : 'panicking');
  };

  /* ================================================================ the roll */
  /* Will they do it, now? A chance from how bad things are (sev 0..1) and who they are, rolled each
     time they think about it (every second and a half or so): so action comes after a delay that is
     theirs, and sometimes not at all */
  CZ.decide = function (a, kind, sev, who) {
    const p = CZ.P(a); if (!p) return true;
    const t = p.t, st = p.stress / 100, F = f => p.flaws.includes(f), K = k => p.perks.includes(k);
    sev = clamp01(sev);
    let c;
    switch (kind) {
      case 'eat': case 'drink': c = 0.15 + sev * 0.7 + t.app * 0.15 - (F('scatterbrain') ? 0.2 : 0) - st * 0.15; break;
      case 'treat': c = 0.2 + sev * 0.65 + t.care * 0.2 + (K('medic') ? 0.25 : 0) - (F('scatterbrain') ? 0.15 : 0) + st * 0.1; break;   // fear makes some patch up sooner
      case 'craft': if (t.smarts < 0.3 && !K('handy') && !K('medic')) return false; c = 0.25 + sev * 0.45 + t.smarts * 0.3; break;   // some just don't know how
      case 'boil': if (t.smarts < 0.4 && !K('handy')) return false; c = 0.35 + t.smarts * 0.5; break;
      case 'share': c = (t.gen - 0.3) * 1.1 + sev * 0.55 - st * 0.25 - (F('hoarder') ? 0.5 : 0); break;
      case 'help': c = 0.15 + t.gen * 0.4 + sev * 0.4 + (K('medic') ? 0.25 : 0) - (F('squeamish') ? 0.45 : 0) - st * 0.2; break;
      case 'forage': c = 0.2 + t.nerve * 0.5 + sev * 0.3 - st * 0.35 - (CZ.night() ? (1 - t.nerve) * 0.4 : 0); break;
      case 'rest': c = 0.2 + sev * 0.6 - t.nerve * 0.15 + st * 0.1; break;
      case 'ask': c = 0.15 + sev * 0.5 + (1 - t.nerve) * 0.15 + (t.temper > 0.6 ? 0.1 : 0); break;
      case 'throw': c = 0.15 + t.temper * 0.35 + t.nerve * 0.2 + sev * 0.3; break;
      case 'risky': c = 0.05 + sev * 0.6 + (1 - t.smarts) * 0.3 + (F('glutton') ? 0.15 : 0); break;   // eat or drink something that might make them sick
      default: c = 0.5 + sev * 0.3;
    }
    // for someone in particular: a friend gets more, someone they can't stand much less (cityz-bonds.js)
    if (who && CZ.relOf && (kind === 'share' || kind === 'help')) c += CZ.relOf(a, who) / 200;
    return Math.random() < clamp01(c);
  };

  /* ================================================================ orders */
  /* An order isn't obeyed like a switch: the disciplined move now, others in their own time, some
     argue, and a scared or stubborn one may refuse for a while (and say so) */
  const oOrders = CZ.orders;
  CZ.orders = function (kind) {
    const before = CZ.S && CZ.S.order;
    oOrders.apply(this, arguments);
    if (!CZ.S || CZ.S.order !== kind) return;
    for (const a of G.actors) {
      if (!a.bot || !a.cz || !a.cz.m) continue;
      const p = CZ.P(a); if (!p) continue;
      const t = p.t, st = p.stress / 100;
      let refuse = 0;
      if (kind === 'hold' && (p.flaws.includes('hothead') || t.disc < 0.25) && Math.random() < 0.5) refuse = R(8, 20);
      if ((kind === 'attack' || kind === 'loot') && t.nerve < 0.35 && Math.random() < 0.3 + st * 0.5) refuse = R(6, 18);
      const rel = CZ.relOf && G.player ? CZ.relOf(a, G.player) : 0;
      if (!refuse && rel < -40 && Math.random() < 0.15 + (-rel - 40) / 120) { refuse = R(8, 20); a.czOrder = { kind: before || 'follow', until: G.time + refuse }; if (window.VOICE) VOICE.say(a, 'no', ['Why should I listen to you?', "You're not the boss of me.", 'Do it yourself.'], 3); continue; }
      if (refuse) { a.czOrder = { kind: before || 'follow', until: G.time + refuse }; if (window.VOICE) VOICE.say(a, 'no', kind === 'hold' ? ['Hold? With them out there? No.', "I'm not sitting still."] : ['No way. Not out there.', "I can't. I'm sorry, I can't."], 3); continue; }
      const lag = ((1 - t.disc) * R(0, 4) + st * R(0, 2)) * (rel > 40 ? 0.5 : rel < -20 ? 1.5 : 1);
      if (lag > 1) a.czOrder = { kind: before || 'follow', until: G.time + lag };
      if (window.VOICE && Math.random() < 0.35) VOICE.say(a, 'ack', t.disc > 0.7 ? ['Copy.', 'On it.', 'Moving.'] : t.temper > 0.6 ? ['Yeah, yeah.', 'Fine.', "Whatever you say."] : ['Okay...', 'Sure, sure.', 'If you say so.'], 2);
    }
  };
  /* the order a bot is actually following right now */
  CZ.orderOf = a => (a.czOrder && a.czOrder.until > G.time) ? a.czOrder.kind : (CZ.S ? CZ.S.order : 'follow');

  /* ================================================================ nerves: stress, anxiety, panic */
  /* Everyone in the squad (you too) carries stress, 0-100. It climbs with wounds, hunger and thirst,
     exhaustion, sickness, the infected close, being alone or out in the dark, a friend dying
     and a friend panicking beside them; it eases at a safehouse, by a fire, resting, crouched and still,
     with something comforting to eat, with a steady head nearby, after sleep, or when someone talks them
     down. How fast is theirs: low nerve feels it more, Calm halves it, Anxious adds half again.
     What it does: shakier aim (and a swaying view, for you), slower hands with dressings and food,
     worse choices (CZ.decide), orders argued with, bad sleep; and past their limit a panic attack: for
     you a racing heartbeat, tunnel vision and loud breathing the infected can hear; for a teammate,
     freezing up, bolting, or charging in blind */
  CZ.inPanic = a => (a && a.czPanic && a.czPanic.until > G.time) ? a.czPanic.kind : null;
  const sq = () => G.actors.filter(x => x.cz && x.cz.m && x.state === 'alive');
  const V = () => new THREE.Vector3();
  /* who's around (twice a second): company, the infected, someone steady, someone panicking */
  function senseTick(a) {
    if (a.czSenseT > G.time) return;
    a.czSenseT = G.time + 0.5;
    for (const t of G.actors) {
      if (t === a || t.state !== 'alive') continue;
      const d = U.dist3(t.pos, a.pos);
      if (t.cz && (t.cz.inf || t.cz.opx)) { if (d < 11 && G.world.los(a.eye(V()), t.center(V()))) a.czNearInfT = G.time + 4; else if (d < 5) a.czNearInfT = G.time + 4; continue; }
      if (!t.cz || !t.cz.m) continue;
      if (d < 25) a.czCompanyT = G.time + 1;
      const q = CZ.P(t);
      if (q && d < 8 && q.stress < 30 && q.t.nerve > 0.65 && !(CZ.relOf && CZ.relOf(a, t) < -30)) a.czSteadyNear = G.time + 1;
      if (d < 10 && CZ.inPanic(t)) a.czPanicNear = G.time + 1;
    }
  }
  CZ.moodTick = function (a, dt) {
    const p = CZ.P(a); if (!p || a.state !== 'alive') return;
    senseTick(a);
    const st = a.cz.m.st, t = p.t, nerveK = 1.25 - t.nerve * 0.7;
    const rate = (p.perks.includes('calm') ? 0.5 : 1) * (p.flaws.includes('anxious') ? 1.5 : 1);
    let up = 0, down = 0.15;
    if (st.bleed > 0) up += 0.8 + st.bleed * 0.3;
    if (a.hp < 50) up += (50 - a.hp) / 50;
    if (st.hunger > 80 || st.thirst > 80) up += 0.4;
    if (st.fatigue > 85) up += 0.3;
    if (st.sick > 20) up += 0.3;
    if (st.infection > 50) up += 0.5;
    if (a.czNearInfT > G.time) up += 1.4 * nerveK;
    if (CZ.night() && !CZ.sheltered(a)) up += 0.25 * nerveK;
    if (!(a.czCompanyT > G.time)) up += 0.3 * nerveK;   // nobody else of the squad within 25 m
    if (a.czPanicNear > G.time) up += 0.6;              // someone beside them losing it
    if (CZ.isSafe(CZ.Z.id) && CZ.atSafe(a)) down += 1;
    if (CZ.nearFire(a)) down += 0.8;
    if (a.czResting) down += 0.5;
    if (a.czSteadyNear > G.time) down += 0.4;
    if (a.stance > 0 && (a.moving || 0) < 0.15 && !(a.czNearInfT > G.time)) down += 0.3;   // still, breathing
    p.stress = U.clamp(p.stress + (up * rate - down) * dt, 0, 100);
    // past their limit: a panic attack (the anxious and the nervous sooner), now and then, not always
    const lim = p.flaws.includes('anxious') ? 72 : 80 + t.nerve * 15;
    if (!CZ.inPanic(a) && p.stress > lim && G.time > (a.czPanicCd || 0) && Math.random() < dt * 0.08) panic(a, p);
    if (a.czPanic && a.czPanic.until <= G.time && !a.czPanic.over) { a.czPanic.over = true; p.stress = Math.max(0, p.stress - 15); if (a.isPlayer) CZ.tell(a, 'The panic passes. Breathe.', 'info'); }
    const pk = CZ.inPanic(a);
    if (pk === 'freeze' && !(a.busy > 0) && Math.random() < dt * 0.8) { a.busy = 1.2; a.busyLabel = 'FROZEN WITH FEAR'; if (a.stance === 0) a.setStance(1); }
    if (pk && a.isPlayer && (a.czBreathT = (a.czBreathT || 0) - dt) <= 0) { a.czBreathT = 1.4; GAME.noise(a.pos, 10, a, 'step'); }
    // what it does to the hands and the eyes: spread on every shot (weapons.js), a sway of the view (player.js)
    const sh = Math.max(0, p.stress - 35) / 65;
    a.czShake = sh * 1.6 * (p.perks.includes('sharpshooter') ? 0.5 : 1) + (pk ? 1.5 : 0);
    a.czSway = sh + (pk ? 1 : 0);
    // the clumsy make noise
    if (p.flaws.includes('clumsy') && (a.moving || 0) > 0.5 && Math.random() < dt * 0.15) { SFX.impact(a.pos, true); GAME.noise(a.pos, 14, a, 'step'); CZ.fire('clumsy', a); }
    // talking it down: a steady, caring teammate notices someone close to breaking
    if (a.bot && !pk && p.stress < 35 && (t.gen > 0.6 || p.arch === 'carer' || p.arch === 'veteran') && G.time > (a.czCalmT || 0) && !(a.czNearInfT > G.time)) {
      const who = sq().find(x => x !== a && CZ.P(x) && CZ.P(x).stress > 65 && U.dist3(x.pos, a.pos) < 6);
      if (who) { a.czCalmT = G.time + 50 + Math.random() * 40; calmDown(a, who); }
    }
    // and they say how they feel, now and then
    if ((a.czMoodT = (a.czMoodT || 30 + Math.random() * 60) - dt) <= 0) { a.czMoodT = 45 + Math.random() * 95; moodLine(a, p); }
  };
  function panic(a, p) {
    const t = p.t, d = 6 + Math.random() * 5;
    const kind = a.isPlayer ? 'attack' : t.temper > 0.7 && Math.random() < 0.6 ? 'rage' : (p.flaws.includes('coward') || t.nerve < 0.35) && Math.random() < 0.7 ? 'flee' : 'freeze';
    a.czPanic = { kind, until: G.time + d }; a.czPanicCd = G.time + d + 40 + Math.random() * 50;
    CZ.fire('panic', a, kind);
    if (a.isPlayer) { HUD.toast('PANIC ATTACK · your heart is racing and your hands won\'t stop shaking. Crouch and breathe, get clear of them, or get somewhere safe', 'warn'); if (PLAYER.punch) PLAYER.punch(0.3); return; }
    if (a.bot) { a.bot.goal = null; a.bot.loot = null; }
    const L = { rage: ['COME ON THEN! COME ON!', "That's it, I'll kill every one of you!"], flee: ["I'm out! I'm OUT!", 'Run! Just run!', "I can't, I can't, I can't!"], freeze: ["I can't move. I can't move.", 'No no no no no...', "My hands won't work..."] };
    if (window.VOICE) VOICE.say(a, 'panic', L[kind], 4);
    const pl = G.player; if (pl && !pl.ghost && pl.cz && pl !== a && U.dist3(pl.pos, a.pos) < 30) CZ.tell(pl, CZ.nm(a) + (kind === 'rage' ? ' has lost it and is charging in' : kind === 'flee' ? ' is panicking and running' : ' has frozen up with fear') + ' · get close and calm them down (' + KEYS.name('interact') + ')', 'warn');
  }
  /* someone talking someone else down: a lot from a friend they trust, less (or worse) for a hothead */
  function calmDown(by, who) {
    const q = CZ.P(who); if (!q) return 0;
    const bp = CZ.P(by), skill = bp ? 0.6 + bp.t.gen * 0.4 + (bp.perks.includes('medic') ? 0.2 : 0) - bp.stress / 200 : 0.8;
    const rel = CZ.relOf ? CZ.relOf(who, by) : 0;
    let k = (15 + Math.random() * 20) * skill * U.clamp(1 + rel / 150, 0.4, 1.6);
    const snap = Math.random() < (q.t.temper > 0.7 ? 0.4 : 0) + (rel < -30 ? 0.35 : 0);
    if (snap) k *= 0.3;
    q.stress = Math.max(0, q.stress - k);
    if (who.czPanic && who.czPanic.until > G.time && !snap) who.czPanic.until = G.time + Math.min(2, who.czPanic.until - G.time);
    if (window.VOICE) {
      if (by.bot) VOICE.say(by, 'calm', ['Hey. Hey. Look at me. Breathe.', "We've got this. Stay with me.", "You're alright. In through the nose."], 3);
      if (who.bot) setTimeout(() => { if (who.state === 'alive') VOICE.say(who, 'calmed', snap ? ["Don't tell me to calm down!", 'Back off. I\'m fine.'] : ['...Okay. Okay. Thanks.', 'Sorry. I\'m alright now.', 'Yeah. Breathing.'], 3); }, 1600);
    }
    if (who.isPlayer) CZ.tell(who, CZ.nm(by) + ' talks you down: your breathing slows', 'info');
    CZ.fire('calmed', by, who, snap);
    return k;
  }
  CZ.calmDown = calmDown;
  function moodLine(a, p) {
    if (!window.VOICE || !a.bot) return;
    const m = CZ.moodOf(a), st = a.cz.m.st;
    const L = {
      calm: p.arch === 'joker' ? ['Anyone else fancy a holiday after this?', 'Five stars. Would get eaten again.'] : p.arch === 'cynic' ? ['This is fine. Everything is fine.', 'Give it an hour.'] : p.arch === 'rookie' ? ['Is it always this quiet?', "I think I'm getting the hang of this."] : ['Quiet. I don\'t trust quiet.', 'Keep it tight.', 'We\'re doing alright.'],
      uneasy: ['Something feels off.', 'How much further?', st.hunger > 60 ? 'Could do with some food soon.' : 'Keep your eyes open.', p.flaws.includes('anxious') ? "I keep thinking I hear them." : 'Did that door move?'],
      scared: ['I don\'t like this. I really don\'t.', 'Did you hear that?', 'We need to get out of here.', 'My hands are shaking. Look at them.'],
      angry: ['Who planned this? Seriously.', 'Next one that comes at me, I swear...', 'Stop telling me to wait.'],
      panicking: ['I can\'t do this. I can\'t do this.', 'We\'re all going to die here.', 'Get me out, get me OUT.'],
      furious: ['That\'s it. That is IT.', 'I\'m done being careful.'],
    };
    VOICE.say(a, 'mood', L[m] || L.calm, 1);
  }
  // what stresses people: a friend dying hits hard; seeing the infected go down is a relief
  CZ.listen('kill', (v) => {
    if (v.cz && v.cz.m) for (const a of G.actors) { const p = CZ.P(a); if (p && a !== v) p.stress = Math.min(100, p.stress + 25 * (1.3 - p.t.nerve)); }
    if (v.cz && (v.cz.inf || v.cz.opx)) for (const a of G.actors) { const p = CZ.P(a); if (p && U.dist3(a.pos, v.pos) < 20) p.stress = Math.max(0, p.stress - 1.5); }
  });
  // someone who turned on you drops what they were carrying when they go down
  CZ.listen('kill', v => { const m = v.czTurnedM; if (!m) return; v.czTurnedM = null; const list = Object.entries(m.inv); for (const g of m.guns || []) if (g) list.push(['gun:' + g.id, 1]); m.inv = {}; if (list.length) CZ.dropLoot(v.pos, list, m.name + "'s pack"); });
  CZ.calmAfterSleep = () => { for (const m of CZ.S.squad) if (m.p && m.alive) m.p.stress = Math.max(0, m.p.stress * 0.4); };

  /* ================================================================ recruits */
  CZ.MAX_SQUAD = 10;   // you included; a campaign starts with five
  CZ.squadCount = () => CZ.S.squad.filter(m => m.alive && !m.gone).length;
  /* someone met in the city joins: a member like any other, with a pistol and a little */
  CZ.recruit = function (personActor, name, skill) {
    if (CZ.squadCount() >= CZ.MAX_SQUAD) { HUD.toast('The squad is full (' + CZ.MAX_SQUAD + ' at most): part ways with someone first', 'warn'); return null; }
    const k = Math.floor(Math.random() * 5), op = '_civ_' + k;
    const m = { op, name: name || 'Stranger', recruit: true, hp: 100, alive: true, player: false,
      st: { hunger: R(30, 60), thirst: R(30, 60), fatigue: R(20, 60), stamina: 100, infection: 0, bleed: 0, fracture: false, sick: 0, pain: 0 },
      inv: { a9: 30, cloth: 1 }, guns: [{ id: 'p10', mag: -1 }, { id: 'p10', mag: -1 }], gad: -1, ab: -1, joined: CZ.S.day, skill,
      look: personActor && personActor.op && personActor.op.look ? { head: personActor.op.look.head, vest: personActor.op.look.vest, cloth: personActor.op.look.cloth, skin: personActor.op.look.skin } : null };
    if (personActor && personActor.op && /^_civ_\d$/.test(personActor.op.id)) m.op = personActor.op.id;
    m.p = CZ.rollPerson(true);
    const o = personActor && personActor.cz && personActor.cz.person;
    if (o && o.sid) { const sv = CZ.S.survivors.find(x => x.id === o.sid); if (sv) sv.state = 'joined'; }
    // what they did before shows in what they're good at
    const SK = { medic: 'medic', scavenger: 'scrounger', mechanic: 'handy', guard: 'sharpshooter', cook: 'ironstomach', farmer: 'packmule' };
    if (SK[skill] && !m.p.perks.includes(SK[skill])) m.p.perks[0] = SK[skill];
    if (m.p.agenda.kind === 'secretbite') m.st.infection = R(35, 45);
    CZ.S.squad.push(m);
    // into the place now: an actor where the person stood
    if (CZ.on() && personActor) {
      const pos = personActor.pos.clone(); personActor.removeFrom(G.scene); { const i = G.actors.indexOf(personActor); if (i >= 0) G.actors.splice(i, 1); }
      if (CZ.spawnMember) { const a = CZ.spawnMember(m, pos, personActor.yaw); if (a && a.bot && AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots.push(a); if (CZ.netAdded) CZ.netAdded(a); }
    }
    HUD.banner(m.name.toUpperCase() + ' JOINS THE SQUAD', CZ.ARCHETYPES[m.p.arch].name + ' · you\'ll learn more about them the longer they travel with you', 3, 'win');
    CZ.S.story.log.push({ d: CZ.S.day, t: m.name + ' joined the squad.' });
    CZ.save(true);
    return m;
  };
  /* parting ways: they walk off (to a safehouse, if there is one, where they'll work like any survivor) */
  CZ.partWays = function (a) {
    const m = a.cz.m; if (m.player) return;
    m.alive = false; m.gone = true;
    const home = Object.keys(CZ.S.safe).find(z => CZ.isSafe(z));
    if (home) CZ.S.survivors.push({ id: 's' + Date.now().toString(36), name: CZ.nm(a), skill: m.skill || 'scavenger', home, state: 'home', zone: CZ.Z.id, day: CZ.S.day });
    if (window.VOICE) VOICE.say(a, 'bye', ['Look after yourselves.', 'It was good knowing you.', "Don't come looking for me."], 3);
    HUD.toast(CZ.nm(a) + (home ? ' heads for ' + CZ.ZONES[home].name : ' leaves the squad'), 'info');
    setTimeout(() => { if (a.rig) a.removeFrom(G.scene); const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1); if (AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots = AI.teams[CZ.TEAM].bots.filter(x => x !== a); }, 1500);
    CZ.S.story.log.push({ d: CZ.S.day, t: CZ.nm(a) + ' left the squad.' });
  };

  // strangers: now and then someone is in a place when you get there (not at a safehouse), and they can join
  CZ.listen('enter', zid => {
    if (!CZ.S || CZ.isSafe(zid) || CZ.Z.guest || Math.random() > 0.22 || !CZ.newSurvivor || !CZ.spawnPerson) return;
    setTimeout(() => {
      if (!CZ.on() || !CZ.Z || CZ.Z.id !== zid) return;
      const sv = CZ.newSurvivor(zid, Math.random() < 0.5 ? 'road' : 'trapped');
      const a = CZ.spawnPerson({ name: sv.name, sid: sv.id }); a.cz.person.sid = sv.id;
      CZ.S.story.log.push({ d: CZ.S.day, t: 'Met ' + sv.name + ' in ' + CZ.ZONES[zid].name + '.' });
    }, 1500);
  });

  /* ================================================================ hidden agendas */
  /* Hints come first (a line, something odd in the journal), then, once they've been with you long
     enough, the truth. Not for whoever you're playing as */
  function hint(a, kind) {
    const p = CZ.P(a), n = CZ.nm(a), S = CZ.S;
    const H = {
      thief: ['The stash looked lighter than you remember.', n + ' was going through the packs when you came back.', 'Two cans gone from the stash. Nobody saw anything.'],
      traitor: [n + ' keeps checking a handheld radio when they think nobody is looking.', n + ' asked a lot of questions about the safehouse door.', 'You heard ' + n + ' talking to someone on the radio last night.'],
      secretbite: [n + ' keeps their sleeve rolled down, even in the heat.', n + ' was coughing all night.', n + ' flinched when you touched their arm.'],
      deserter: [n + ' keeps talking about the other side of the fence.', n + ' said this was a mistake. Twice.', n + ' packed their bag and unpacked it again.'],
      agent: [n + ' asks about Mara\'s culture more than anyone.', n + ' has a Command ID card. Old job, they say.', n + ' was at the uplink map again.'],
      guardian: [n + ' patched your arm before you noticed it was cut.', n + ' knows a lot of medicine for a bus driver.'],
    };
    const L = H[kind]; if (!L) return;
    const t = L[Math.min(p.agenda.hints, L.length - 1)]; p.agenda.hints++;
    S.story.log.push({ d: S.day, t });
    if (Math.random() < 0.5) HUD.toast(t, 'info');
  }
  function reveal(a) {
    const p = CZ.P(a), m = a.cz.m, n = CZ.nm(a), S = CZ.S, kind = p.agenda.kind;
    p.agenda.shown = true;
    CZ.fire('revealed', a, p.agenda.kind);
    const log = t => S.story.log.push({ d: S.day, t });
    if (kind === 'thief') {
      // gone with their pack and a share of the stash
      const z = Object.keys(S.stash).find(k => Object.keys(S.stash[k] || {}).length), took = [];
      if (z) {
        const ids = Object.keys(S.stash[z]).sort((p2, q2) => S.stash[z][q2] - S.stash[z][p2]);
        ids.forEach((id, i) => { if (i > 0 && Math.random() > 0.55) return; const n2 = Math.ceil(S.stash[z][id] / 2); S.stash[z][id] -= n2; if (S.stash[z][id] <= 0) delete S.stash[z][id]; took.push(CZ.itemName(id)); });
      }
      m.alive = false; m.gone = true; if (a.rig) a.removeFrom(G.scene); const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1);
      HUD.banner(n.toUpperCase() + ' IS GONE', 'They left in the night' + (took.length ? ', with ' + took.slice(0, 3).join(', ') + (took.length > 3 ? '...' : '') : ''), 4, 'lose');
      log(n + ' was a thief. They left in the night with their pack' + (took.length ? ' and half the stash' : '') + '.');
    } else if (kind === 'traitor' || kind === 'agent') {
      // they turn on you: an enemy with their gun, right here
      m.alive = false; m.turned = true; a.czTurnedM = m;
      a.team = 3; a.side = 'def'; a.cz = { opx: true, def: { name: n, infect: 0 } }; a.name = n;
      a.persona = a.persona || PERSONA.make([]); AI.attach(a); a.bot.role = 'roam';
      AI.teams[3] = AI.teams[3] || { side: 'def', team: 3, bots: [], goalFor: CZ.infGoal || ARC.goal, cleared: new Map(), intel: [] }; AI.teams[3].bots.push(a);
      HUD.banner(n.toUpperCase() + ' TURNS ON YOU', kind === 'agent' ? 'Command\'s agent: they want the culture' : 'They were working for someone else all along', 4, 'lose');
      if (window.VOICE) VOICE.say(a, 'betray', kind === 'agent' ? ["Sorry. Command's paying better than you are.", 'Hand over the case.'] : ["Nothing personal. They're paying.", 'You should have checked who you let in.'], 4);
      log(n + (kind === 'agent' ? ' was Command\'s agent all along, and turned on the squad.' : ' was a plant, and turned on the squad.'));
    } else if (kind === 'secretbite') {
      HUD.banner(n.toUpperCase() + ' WAS BITTEN', 'They\'ve been hiding it since before you met: infection ' + Math.round(m.st.infection) + '%', 4, 'lose');
      log(n + ' admitted they had been bitten before they joined. They need the antiviral.');
    } else if (kind === 'deserter') {
      const food = ['beans', 'water', 'bar', 'mre'].filter(id => (m.inv[id] || 0) > 0);
      m.alive = false; m.gone = true; if (a.rig) a.removeFrom(G.scene); const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1);
      HUD.banner(n.toUpperCase() + ' WALKED AWAY', 'They\'d had enough' + (food.length ? ', and took their food with them' : ''), 4, 'lose');
      log(n + ' walked away from the squad. They\'d had enough.');
    } else if (kind === 'guardian') {
      if (!p.perks.includes('medic')) p.perks.push('medic');
      for (const x of G.actors) if (x.cz && x.cz.m && x.state === 'alive') { x.cz.m.st.bleed = 0; x.heal(20); }
      HUD.banner(n.toUpperCase() + ', FIELD MEDIC', 'They\'ve been one all along: they patch up the whole squad', 4, 'win');
      log(n + ' turned out to be a trained field medic, and patched up the whole squad.');
    }
    CZ.save(true);
  }
  CZ.revealAgenda = a => reveal(a);
  /* now and then: a hint, or (when it's time) the truth. Thieves and deserters go in the night;
     plants turn when the squad is busy fighting; a bite shows when it gets too bad to hide */
  CZ.agendaTick = function (dt) {
    const Z = CZ.Z; if ((Z.agT = (Z.agT == null ? 60 : Z.agT) - dt) > 0) return; Z.agT = R(60, 140);
    const S = CZ.S;
    for (const a of G.actors) {
      const p = CZ.P(a); if (!p || a.isPlayer || !a.bot || a.net || a.state !== 'alive' || p.agenda.shown || p.agenda.kind === 'loyal') continue;
      const kind = p.agenda.kind, due = S.day >= p.agenda.reveal, m = a.cz.m;
      if (kind === 'thief' && CZ.isSafe(Z.id)) { const st = S.stash[Z.id] || {}, ids = Object.keys(st); if (ids.length && Math.random() < 0.6) { const id = pick(ids); st[id]--; if (st[id] <= 0) delete st[id]; m.inv[id] = (m.inv[id] || 0) + 1; } }
      if (kind === 'secretbite' && m.st.infection < 50) m.st.infection += 0.5;   // it's in there, growing
      if (!due) { if (Math.random() < 0.45) hint(a, kind); continue; }
      const fighting = G.actors.some(t => t.cz && t.cz.inf && t.state === 'alive' && U.dist3(t.pos, a.pos) < 20);
      if ((kind === 'thief' || kind === 'deserter') && !CZ.night()) { if (Math.random() < 0.3) hint(a, kind); continue; }
      if (kind === 'deserter' && p.stress < 45 && Math.random() < 0.6) continue;   // they stay while things are bearable
      if (kind === 'traitor' && !fighting && Math.random() < 0.7) continue;
      if (kind === 'agent') continue;   // the agent waits for the uplink
      if (kind === 'secretbite' && m.st.infection < 60 && Math.random() < 0.6) continue;
      reveal(a); return;
    }
  };
  // the agent shows themself at the uplink
  CZ.agentAtUplink = function () {
    const ag = G.actors.find(a => { const p = CZ.P(a); return p && a.bot && !a.isPlayer && a.state === 'alive' && p.agenda.kind === 'agent' && !p.agenda.shown; });
    if (ag) { reveal(ag); return true; }
    return false;
  };
  // a medic spots a hidden bite
  CZ.medicSpots = function () {
    const medic = G.actors.find(a => a.state === 'alive' && CZ.has(a, 'medic'));
    if (!medic) return;
    for (const a of G.actors) { const p = CZ.P(a); if (p && a !== medic && p.agenda.kind === 'secretbite' && !p.agenda.shown && a.cz.m.st.infection > 40 && U.dist3(a.pos, medic.pos) < 6 && Math.random() < 0.02) { HUD.toast(CZ.nm(medic) + ' noticed something about ' + CZ.nm(a) + '\'s arm', 'warn'); reveal(a); return; } }
  };

  /* what you know about someone: their kind straight away, their traits after a day, and whether they
     can be trusted only when they've shown you */
  CZ.knownAbout = function (a) {
    const p = CZ.P(a); if (!p) return null;
    const days = CZ.S.day - (p.met || 1), A = CZ.ARCHETYPES[p.arch], t = p.t;
    const words = [];
    if (days >= 1) {
      words.push(t.gen > 0.7 ? 'generous' : t.gen < 0.3 ? 'tight-fisted' : 'fair', t.nerve > 0.7 ? 'brave' : t.nerve < 0.35 ? 'nervous' : 'steady', t.smarts > 0.7 ? 'resourceful' : t.smarts < 0.35 ? 'not much of a planner' : 'sensible', t.disc > 0.7 ? 'disciplined' : t.disc < 0.3 ? 'does their own thing' : 'reliable enough');
    }
    let trust = 'You don\'t know them well yet.';
    if (p.agenda.shown) trust = CZ.AGENDAS[p.agenda.kind].name + ': ' + CZ.AGENDAS[p.agenda.kind].desc;
    else if (days >= 6) trust = 'Six days together: you\'d trust them, mostly.';
    else if (days >= 3) trust = 'You\'re getting to know them.';
    return { kind: A.name, kindDesc: A.desc, words, perks: p.perks.map(k => CZ.PERKS[k].name), flaws: p.flaws.map(k => CZ.FLAWS[k].name), trust, mood: CZ.moodOf(a), bio: p.bio };
  };

  /* ================================================================ giving everyone a person */
  // the starting crew, at a new campaign (the player's own member gets strengths and flaws, no agenda)
  const oNew = CZ.newGame;
  CZ.newGame = function (ops, diff) {
    const S = oNew.apply(this, arguments);
    S.squad.forEach((m, i) => { m.p = CZ.rollPerson(false, i !== 0); m.p.met = 1; if (m.p.agenda.kind === 'secretbite') m.st.infection = R(30, 40); });
    CZ.save(true);
    return S;
  };
  // an older save: people get rolled the first time it's loaded
  const oLoad = CZ.load;
  CZ.load = function () { const S = oLoad.apply(this, arguments); if (S) for (const m of S.squad) if (!m.p) m.p = CZ.rollPerson(!!m.recruit, !m.player); return S; };

  /* ================================================================ every frame */
  // after the needs: nerves, strengths and flaws, agendas
  const oSurv = CZ.survivalTick;
  CZ.survivalTick = function (dt) {
    oSurv.apply(this, arguments);
    if (!CZ.S || !CZ.Z) return;
    for (const a of G.actors) {
      if (!a.cz || !a.cz.m || a.state !== 'alive' || !CZ.P(a)) continue;
      CZ.moodTick(a, dt);
      traitTick(a, dt);
    }
    CZ.agendaTick(dt);
    if ((CZ.Z.medT = (CZ.Z.medT || 0) - dt) <= 0) { CZ.Z.medT = 2; CZ.medicSpots(); }
    feel(dt);
  };
  /* strengths and flaws that work all the time */
  function traitTick(a, dt) {
    const p = CZ.P(a), st = a.cz.m.st, need = CZ.diff().need;
    if (p.flaws.includes('glutton')) st.hunger = Math.min(100, st.hunger + 0.075 * 0.35 * need * dt);
    if (p.perks.includes('nightowl') && CZ.night()) st.fatigue = Math.max(0, st.fatigue - 0.055 * 0.5 * need * dt);
    if (p.flaws.includes('insomniac') && a.czResting) st.fatigue = Math.min(100, st.fatigue + 0.12 * dt);
  }
  CZ.capacity = (function (o) { return function (m) { let c = o.apply(this, arguments); if (m && m.p) { if (m.p.perks.includes('packmule')) c += 8; if (m.p.flaws.includes('badback')) c -= 6; } return c; }; })(CZ.capacity);
  // Tough: a fifth off every hit
  const oHurt = Actor.prototype.hurt;
  Actor.prototype.hurt = function (dmg, info) { if (CZ.on && CZ.on() && this.cz && this.cz.m && CZ.has(this, 'tough') && dmg > 0) dmg *= 0.8; return oHurt.call(this, dmg, info); };
  // Scrounger: a little more in every container they open first
  const oLoot = CZ.loot;
  CZ.loot = function (a, e) {
    if (e && e.alive && !e.items && a && CZ.has(a, 'scrounger') && CZ.rollLoot) {
      e.items = CZ.rollLoot(e.table);
      for (const [id, n] of Object.entries(CZ.rollLoot(e.table, 0.5))) e.items[id] = (e.items[id] || 0) + n;
    }
    return oLoot.apply(this, arguments);
  };
  // sleep: the stressed and the insomniacs sleep badly; everyone wakes calmer
  const oSleep = CZ.sleep;
  CZ.sleep = function () {
    const before = CZ.S.squad.map(m => m.p ? m.p.stress : 0);
    const r = oSleep.apply(this, arguments);
    if (!r) return r;
    const bad = [];
    CZ.S.squad.forEach((m, i) => {
      if (!m.alive || !m.p) return;
      const worry = before[i] > 60, ins = m.p.flaws.includes('insomniac');
      if (worry || ins) { m.st.fatigue = Math.min(100, m.st.fatigue + (worry ? 10 : 0) + (ins ? 8 : 0)); bad.push(m.name); }
    });
    CZ.calmAfterSleep();
    if (bad.length) setTimeout(() => HUD.toast(bad.join(', ') + (bad.length > 1 ? ' barely slept' : ' barely slept: too wound up to rest'), 'warn'), 1200);
    return r;
  };

  /* ================================================================ how it feels to be you */
  /* stress you can feel: a heartbeat once it climbs, a darkening at the edge of sight, the view
     swaying (player.js) and the shots wandering (weapons.js) */
  let beatT = 0;
  function feel(dt) {
    const a = G.player, p = a && !a.ghost ? CZ.P(a) : null;
    let el = U.$('czStress');
    if (!el) { el = document.createElement('div'); el.id = 'czStress'; document.body.appendChild(el); }
    if (!p || a.state !== 'alive') { el.style.opacity = 0; return; }
    const s = p.stress, pk = CZ.inPanic(a);
    const v = Math.max(0, (s - 50) / 50) * 0.5 + (pk ? 0.35 : 0);
    el.style.opacity = (v * (0.85 + 0.15 * Math.sin(G.time * (pk ? 9 : 5)))).toFixed(3);
    if (s > 55 || pk) {
      const bpm = 70 + s * 0.8 + (pk ? 45 : 0);
      if ((beatT -= dt) <= 0) { beatT = 60 / bpm; heartbeat(Math.min(1, 0.25 + (s - 55) / 60 + (pk ? 0.3 : 0))); }
    }
  }
  function heartbeat(vol) {
    if (!SFX.ctx || !SFX.synth) return;
    const { chain, tone, now } = SFX.synth, d = chain(null, 1, 0.35 * vol); if (!d) return;
    const t = now(); tone(d, t, 0.11, 62, 40, 0.9, 'sine'); tone(d, t + 0.17, 0.09, 54, 36, 0.6, 'sine');
  }

  /* ================================================================ calming someone down, asking for things */
  // you, beside a teammate who is wound up: talk them down (once a minute each)
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client) return;
    for (const t of G.actors) {
      if (t === a || !t.bot || !t.cz || !t.cz.m || t.state !== 'alive' || U.dist3(t.pos, a.pos) > 2.4) continue;
      const q = CZ.P(t); if (!q || (q.stress < 45 && !CZ.inPanic(t)) || G.time < (t.czCalmedT || 0)) continue;
      out.push({ kind: 'calm', label: 'CALM ' + CZ.nm(t).toUpperCase() + ' DOWN', time: 1.5, ok: () => t.state === 'alive', run: () => { t.czCalmedT = G.time + 60; calmDown(a, t); } });
      return;
    }
  });
  /* you asking a teammate for their supplies: what they hand over is up to them. The generous give
     most of it (sometimes things they need themselves); the tight-fisted keep what matters to them; a
     hoarder hands over nothing worth having; the stressed hold on tighter */
  CZ.askSupplies = function (t, p) {
    const q = CZ.P(t), m = t.cz.m, got = [], kept = [];
    const mine = new Set(t.w.map(w => CZ.calOf(w.id)));
    const their = CZ.needsOf ? CZ.needsOf(t) : [];
    for (const [id, n] of Object.entries(m.inv)) {
      const it = CZ.ITEMS[id] || {};
      if (it.cat === 'quest') { const g = CZ.add(p.cz.m, id, n); CZ.take(m, id, g); if (g) got.push(CZ.itemName(id)); continue; }
      let give = n;
      if (q) {
        const g = q.t.gen - q.stress / 250 - (q.flaws.includes('hoarder') ? 0.4 : 0) + (CZ.relOf ? CZ.relOf(t, p) / 250 : 0);
        const valued = it.cat === 'food' || it.cat === 'drink' || it.cat === 'med' || mine.has(id);
        if (valued) give = g > 0.75 ? n : g > 0.5 ? Math.ceil(n / 2) : g > 0.3 ? Math.floor(n / 2) : 0;
        if (mine.has(id)) give = Math.min(give, Math.max(0, n - ((t.w[0] && t.w[0].def.mag) || 20) * (g > 0.75 ? 1 : 2)));
        if (valued && their.length && (it.cat === 'food' && their.includes('hunger') || it.cat === 'drink' && their.includes('thirst') || it.cat === 'med')) give = g > 0.85 && Math.random() < 0.5 ? give : Math.min(give, n - 1);
        if (it.cat === 'gear' && (id === 'jacket' || id === 'raincoat' || id === 'pack_s' || id === 'pack_l')) give = g > 0.85 ? n : 0;
      }
      if (give > 0) { const g2 = CZ.add(p.cz.m, id, give); CZ.take(m, id, g2); if (g2) got.push((g2 > 1 ? g2 + ' × ' : '') + CZ.itemName(id)); if (g2 < n) kept.push(CZ.itemName(id)); }
      else kept.push(CZ.itemName(id));
    }
    CZ.fire('asked', t, p, got.length, kept.length);
    if (window.VOICE && q) {
      const L = !got.length ? (q.flaws.includes('hoarder') ? ['Get your own.', "No. That's mine.", 'Find your own stuff.'] : ["I need what I've got.", "Sorry. I can't spare anything."])
        : kept.length ? ["Here. I'm keeping the rest.", 'That much. No more.', 'Take that. I need the rest.'] : ['Take whatever you need.', 'All yours.', "Here. I'll manage."];
      VOICE.say(t, 'share', L, 3);
    }
    HUD.toast(got.length ? CZ.nm(t) + ' gave you ' + got.join(', ') + (kept.length ? ' · kept ' + kept.slice(0, 4).join(', ') + (kept.length > 4 ? '...' : '') : '') : CZ.nm(t) + " won't give you anything", got.length ? 'info' : 'warn');
    return got.length;
  };

  /* ================================================================ panic, in the squad's goals */
  function fleeGoal(a) {
    let th = null, bd = 1e9;
    for (const t of G.actors) if (t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive') { const d = U.dist3(t.pos, a.pos); if (d < bd) { bd = d; th = t; } }
    if (!th || bd > 30) return null;
    const away = a.pos.clone().sub(th.pos).setY(0); if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    away.normalize().multiplyScalar(12);
    const n = NAV.nearest(a.pos.clone().add(away), 6);
    return n >= 0 ? { pos: NAV.nodePos(n), kind: 'flee', r: 1.5, sprint: true } : null;
  }
  const oSG = CZ.squadGoal;
  CZ.squadGoal = function (a) {
    const k = CZ.inPanic(a), p = CZ.P(a);
    if (k === 'freeze') return { pos: a.pos.clone(), kind: 'freeze', r: 6, crouch: true };
    if (k === 'flee' || (!k && p && p.flaws.includes('coward') && p.stress > 70 && a.czNearInfT > G.time)) { const g = fleeGoal(a); if (g) { if (!k && Math.random() < 0.2 && window.VOICE) VOICE.say(a, 'flee', ['Nope. Not today.', "I'm falling back!", 'Too many! Too many!'], 3); return g; } }
    if (k === 'rage') {
      let th = null, bd = 40;
      for (const t of G.actors) if (t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive') { const d = U.dist3(t.pos, a.pos); if (d < bd) { bd = d; th = t; } }
      if (th) return { pos: th.pos.clone(), kind: 'push', r: 1.5, look: th.eye(V()), sprint: true };
    }
    return oSG.apply(this, arguments);
  };
})();
