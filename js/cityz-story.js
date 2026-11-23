/* cityz-story.js -- City Z: the campaign, the people of Varrow, and what happens on its days.

   THE GREY FEVER. Varrow has been under quarantine for eleven weeks. A broadcast from St Brigid's
   claimed a treatment: Dr Halvard Mara. BLOCKADE's Overseer, Ines Calder, sends a squad of five in to
   find Mara and what he has, before Command's deadline: on day 20 the city is "sterilised" from the
   air (not on Story difficulty). Seven steps across the city, choices that change who lives and what
   your safehouses become, and three endings at the quarantine line.

   People: story characters, and survivors you meet (trapped, wounded, on the road) who can be sent to a
   safehouse, where each has a skill (medic, mechanic, cook, scavenger, guard, farmer). Days bring
   supply drops, hordes and calls for help; a safehouse radio tells you about them. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const DEADLINE = 20;
  const S = () => CZ.S;
  const log = t => { const s = S(); s.story.log.push({ d: s.day, t }); setTimeout(() => CZ.save(true), 0); };
  const say = (lines, choices, who) => CZ.ui.dialog({ lines, choices, who });
  const CALDER = 'OVERSEER CALDER (radio)';
  const me = () => (CZ.leader && CZ.leader()) || G.player;
  // someone out of the world, if they're still in it
  const drop = t => { if (t.rig) t.removeFrom(G.scene); const i = G.actors.indexOf(t); if (i >= 0) G.actors.splice(i, 1); };
  // a choice that only counts once (a conversation can be answered again in the moment before it takes effect)
  const once = (t, fn) => () => { if (t.czAnswered) return; t.czAnswered = true; fn(); };

  /* ================================================================ people */
  const CIV = { id: '_civ', armor: 1, speed: 2, look: { head: 'beanie', helmet: 0x6a5a4a, vest: 0x5a6a7a, cloth: 0x4a4a52, accent: 0xd8c8a8, skin: 0xd8a888, hair: 0x3a2a1a }, primaries: ['p10'], secondaries: ['p10'], gadgets: [] };
  const looks = [['beanie', 0x7a4a3a, 0x3a4a5a], ['cap', 0x3a5a3a, 0x5a5a62], ['hood', 0x6a6a72, 0x2a2a30], ['bandana', 0x8a6a4a, 0x4a3a2a], ['scarf', 0x4a4a7a, 0x6a6a6a]];
  // the five civilian looks, known by id (an online guest builds people from the host's roster)
  looks.forEach((L, k) => { DATA.OPMAP['_civ_' + k] = Object.assign({}, CIV, { id: '_civ_' + k, name: 'Survivor', look: Object.assign({}, CIV.look, { head: L[0], vest: L[1], cloth: L[2] }) }); });
  CZ.spawnPerson = function (o) {
    const k = Math.abs(String(o.name).split('').reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 7)) % looks.length, L = looks[k];
    const op = Object.assign({}, CIV, { id: '_civ_' + k, name: o.name, look: Object.assign({}, CIV.look, { head: o.head || L[0], vest: L[1], cloth: L[2], skin: o.skin || CIV.look.skin }) });
    const a = new Actor({ name: o.name, team: CZ.TEAM, side: 'atk', op, loadout: { primary: 'p10', secondary: 'p10', gadget: null } });
    a.cz = { person: o }; a.drones = 0; a.w.forEach(w => { w.mag = 0; w.reserve = 0; }); a.maxHp = a.hp = o.hp || 100;
    let p = o.pos;
    if (!p && o.room) { const r = (G.map.roomByName[o.room] || [])[0]; if (r) p = NAV.randomIn(r); }
    if (!p) { const n = OPS3.navNodes(); p = NAV.nodePos(n[Math.floor(Math.random() * n.length)]); }
    a.pos.copy(p); a.yaw = Math.random() * 6.28; if (o.crouch) a.setStance(1);
    a.addTo(G.scene); if (a.rig) a.rig.gun.visible = false;
    G.actors.push(a);
    return a;
  };
  // people stand still, turn to look at you, and follow you if asked; they talk when you use them
  CZ.peopleTick = function (dt) {
    const p = G.player;
    for (const a of [...G.actors]) {
      const o = a.cz && a.cz.person; if (!o || a.state !== 'alive') continue;
      // someone leaving: gone a moment later (they know their own way out)
      if (o.leaving) { o.leaveT = (o.leaveT || 0) + dt; a.mf = 1; if (o.leaveT > 1.2) drop(a); continue; }
      if (o.follow && p) {
        const d = U.dist3(a.pos, p.pos);
        if (d > 3) { const yaw = Math.atan2(-(p.pos.x - a.pos.x), -(p.pos.z - a.pos.z)); if ((a.czPathT = (a.czPathT || 0) - dt) <= 0) { a.czPathT = 1; a.czPath = NAV.path(a.pos, p.pos, { partial: true, max: 6000 }); a.czPi = 0; } const path = a.czPath; let to = p.pos; if (path && path.length) { while (a.czPi < path.length - 1 && Math.hypot(path[a.czPi].x - a.pos.x, path[a.czPi].z - a.pos.z) < 0.5) a.czPi++; to = path[a.czPi]; } a.yaw = Math.atan2(-(to.x - a.pos.x), -(to.z - a.pos.z)); a.mf = 1; a.sprint = d > 8; }
        else { a.mf = 0; a.sprint = false; }
      } else if (p && U.dist3(a.pos, p.pos) < 6) { a.mf = 0; const want = Math.atan2(-(p.pos.x - a.pos.x), -(p.pos.z - a.pos.z)); a.yaw += U.clamp(((want - a.yaw + 9.42) % 6.283) - 3.14, -dt * 3, dt * 3); }
      else a.mf = 0;
    }
  };
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client) return;
    for (const t of G.actors) {
      const o = t.cz && t.cz.person; if (!o || t.state !== 'alive' || U.dist3(t.pos, a.pos) > 2.2) continue;
      out.push({ kind: 'talk', label: 'TALK TO ' + t.name.toUpperCase(), time: 0.3, ok: () => t.state === 'alive', run: () => o.talk ? o.talk(t) : survivorTalk(t) });
      return;
    }
  });
  CZ.listen('kill', v => { const o = v.cz && v.cz.person; if (!o) return; HUD.toast(v.name + ' was killed', 'warn'); if (o.sid) { const s = S().survivors.find(x => x.id === o.sid); if (s) s.state = 'dead'; } if (o.onDeath) o.onDeath(v); });

  /* an older save: a survivor met on the way (or a teammate recruited from them) named after one of
     the story's people the story hasn't reached yet gets a name of their own, so the objective's
     marker and the squad's leader go to the real one */
  const STORY_FLAG = { 'Teo Baines': f => f.teo, 'Mina Hale': f => f.school, 'Ruben Ostrow': f => f.school, 'Petra Lind': f => f.school, 'Dr Halvard Mara': f => f.mara };
  function renameClashes(s) {
    if (!s || !s.story) return;
    const f = s.story.flags || {}, taken = new Set(s.survivors.map(x => x.name).concat(s.squad.map(m => m.name)));
    const fresh = () => { const n = CZ.SURVIVOR_NAMES.find(x => !taken.has(x)) || ('Survivor ' + (taken.size + 1)); taken.add(n); return n; };
    for (const x of s.survivors.concat(s.squad.filter(m => m.recruit))) if (STORY_FLAG[x.name] && !STORY_FLAG[x.name](f)) x.name = fresh();
  }
  const oLoadS = CZ.load;
  CZ.load = function () { const s = oLoadS.apply(this, arguments); try { renameClashes(s); } catch (e) { } return s; };

  /* ---- survivors: met, rescued, sent home */
  const SKILLS = Object.keys(CZ.SURVIVOR_SKILLS);
  CZ.newSurvivor = function (zone, why) {
    const s = S(), used = new Set(s.survivors.map(x => x.name).concat(s.squad.map(m => m.name), CZ.STORY_NAMES));
    const name = CZ.SURVIVOR_NAMES.find(n => !used.has(n)) || ('Survivor ' + (s.survivors.length + 1));
    const sv = { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 99), name, skill: SKILLS[Math.floor(Math.random() * SKILLS.length)], zone, state: 'waiting', why: why || 'trapped', day: s.day };
    s.survivors.push(sv); return sv;
  };
  function survivorTalk(t) {
    const o = t.cz.person, sv = S().survivors.find(x => x.id === o.sid); if (!sv) return;
    const homes = Object.keys(S().safe).filter(z => CZ.isSafe(z));
    const sk = CZ.SURVIVOR_SKILLS[sv.skill];
    const lines = [{ who: sv.name, t: sv.why === 'wounded' ? "I got bit, I think. Or scratched. I don't know. Please. I can't walk far." : sv.why === 'road' ? "Don't shoot! I'm not one of them. I've been walking for two days." : "Thank God. I've been hiding in here since the fences went down. I can't go out there alone." }, { who: sv.name, t: 'I was a ' + sk.name.toLowerCase() + ' before all this. I can still be useful. ' + sk.desc }];
    const choices = [];
    // join the squad (five at most, you included): anyone can. You'll find out who they are later
    if (CZ.recruit && CZ.squadCount() < CZ.MAX_SQUAD) choices.push({ label: 'COME WITH US (JOIN THE SQUAD · ' + CZ.squadCount() + '/' + CZ.MAX_SQUAD + ')', recruit: true, fn: once(t, () => { const m = CZ.recruit(t, sv.name, sv.skill); if (m) { sv.state = 'joined'; S().stats.rescued++; } }) });
    else if (CZ.recruit) lines.push({ who: sv.name, t: '(The squad is full: ' + CZ.MAX_SQUAD + ' is as many as can move together. Part ways with someone first if you want ' + sv.name + ' along.)' });
    for (const z of homes) choices.push({ label: 'GO TO ' + CZ.ZONES[z].name, fn: once(t, () => { sv.home = z; sv.state = 'travelling'; sv.arrive = S().day + 1; t.cz.person.leaving = true; S().stats.rescued++; log(sv.name + ' (' + sk.name + ') is making their way to ' + CZ.ZONES[z].name + '.'); HUD.toast(sv.name + ' will meet you at ' + CZ.ZONES[z].name, 'info'); drop(t); }) });
    if (!homes.length) choices.push({ label: 'FIND A SAFEHOUSE FIRST (WAIT HERE)', fn: () => { HUD.toast('Restore a safehouse, then come back for ' + sv.name, 'info'); } });
    choices.push({ label: 'HERE, TAKE SOME FOOD', fn: once(t, () => { const m = me().cz.m, f = ['bar', 'beans', 'water', 'apple'].find(id => m.inv[id] > 0); if (f) { CZ.take(m, f, 1); sv.state = 'gone'; HUD.toast(sv.name + ' thanks you and slips away', 'info'); const gift = ['a9', 'bandage', 'cloth', 'battery'][Math.floor(Math.random() * 4)]; CZ.add(m, gift, gift === 'a9' ? 12 : 1); HUD.toast('+ ' + CZ.itemName(gift), 'info'); t.cz.person.leaving = true; } else { t.czAnswered = false; HUD.toast('You have no food to give', 'warn'); } }) });
    choices.push({ label: "WE CAN'T HELP YOU", cls: 'ghost', fn: () => { sv.state = 'refused'; log('You left ' + sv.name + ' in ' + CZ.ZONES[sv.zone].name + '.'); } });
    say(lines, choices);
  }
  // survivors arrive home a day after you send them
  CZ.listen('day', d => { for (const sv of S().survivors) if (sv.state === 'travelling' && d >= sv.arrive) { sv.state = 'home'; log(sv.name + ' reached ' + CZ.ZONES[sv.home].name + '.'); } });

  /* ================================================================ the story */
  const has = id => S().squad.some(m => m.alive && (m.inv[id] || 0) > 0) || Object.values(S().stash).some(st => (st[id] || 0) > 0);
  const STEPS = [
    { id: 'restore', zone: 'firehouse', title: 'ENGINE 9',
      text: () => { const n = CZ.SAFE_UP[0].needs, h = haveCounts(n), ok = Object.keys(n).every(k => h[k] >= n[k]);
        return 'Make the red-brick firehouse (ENGINE 9 over its bay doors) the squad\'s safehouse. ' + (ok ? 'You have the materials: restore it at the workbench in the engine bay.' : 'Collect ' + Object.entries(n).map(([k, v]) => CZ.itemName(k) + ' ' + Math.min(v, h[k]) + '/' + v).join(', ') + ': the lumber pile and the linen cupboard in the firehouse have them.'); },
      targets: () => { const n = CZ.SAFE_UP[0].needs, h = haveCounts(n), ok = Object.keys(n).every(k => h[k] >= n[k]);
        if (ok) return fixes('czbench', 'WORKBENCH · RESTORE');
        const out = G.ents.filter(e => e.alive && e.type === 'czloot' && /^d_story_(lumber|linen)/.test(String(e.cid))).map(e => ({ p: e.pos, label: e.label.toUpperCase() }));
        return out.length ? out : fixes('czbench', 'WORKBENCH'); },
      done: () => CZ.isSafe('firehouse'),
      after: () => { log('The firehouse is ours: Engine 9 is the squad\'s first safehouse.'); say([{ who: CALDER, t: 'Good. A roof and a door. Now listen: Mara\'s broadcast came from St Brigid\'s, but nobody\'s answered from there since. A pharmacist on Main Street was still on the emergency band two days ago. Start there.' }]); } },
    { id: 'pharmacy', zone: 'mainst', title: 'MAIN STREET', text: 'Find the pharmacist holed up in the pharmacy on Ashford Main Street.', targets: () => person('Teo Baines', 'PHARMACIST'),
      people: z => z === 'mainst' && !S().story.flags.teo ? [{ name: 'Teo Baines', room: 'Pharmacy', head: 'cap', talk: teo, onDeath: () => { if (S().story.flags.teo) return; S().story.flags.teo = 'dead'; log('Teo Baines was dead when we got to him. A note on the counter said Lincoln High: the refugees there saw the doctor.'); advance(); } }] : [],
      done: () => !!S().story.flags.teo },
    { id: 'school', zone: 'school', title: 'LINCOLN HIGH', text: 'Teo says the refugees at Lincoln High saw Mara. Find them: the gym.', targets: () => person('Mina Hale', 'MINA HALE'),
      people: z => z === 'school' && !S().story.flags.school ? [{ name: 'Mina Hale', room: 'Gymnasium', head: 'bandana', talk: mina, onDeath: () => { const f = S().story.flags; f.minaDead = true; if (f.gymHold === 'on' || f.school) return; f.school = 'lost'; CZ.add(me().cz.m, 'radiopart', 1); log('Mina Hale died before we could help. The refugees scattered. We found a radio valve set in her things.'); advance(); } }] : [],
      done: () => !!S().story.flags.school },
    { id: 'radio', zone: 'firehouse', anySafe: true, title: 'THE RADIO', text: 'Build a radio at a safehouse workbench (2 electronic parts, 2 batteries and the valve set from the school) so Command can reach you.', targets: () => fixes('czbench', 'WORKBENCH · BUILD THE RADIO'),
      done: () => Object.values(S().safe).some(sf => (sf.up || []).includes('radio')),
      after: () => { log('The radio works. Calder is on the line.'); say([{ who: CALDER, t: 'There you are. I\'ll be straight with you: Command has a date. Day ' + DEADLINE + ', they burn Varrow from the air. Everything in it.' }, { who: CALDER, t: 'Mara\'s notes have to be in St Brigid\'s. His research lab, top floor. And he took blood samples from the first cases: the isolation ward. Get both.' }]); } },
    { id: 'hospital', zone: 'hospital', title: "ST BRIGID'S", text: "Find Dr Mara's notes in the Research Lab (top floor) and the blood samples in the Isolation Ward.",
      loot: z => z === 'hospital' ? [['Research Lab', 'notes'], ['Isolation Ward', 'samples']] : [], targets: () => finds(),
      done: () => has('notes') && has('samples'),
      after: () => { log("We have Mara's notes and the samples. The notes end mid-sentence: he went down into Line 4."); say([{ who: 'MARA\'S NOTES', t: '"...the antiviral slows it. It does not stop it. What stops it is the culture from patient one, grown on. I am taking the culture to Delta through the Line 4 tunnels. If the army has the uplink working the formula can go out to everyone, and then they cannot burn us..."' }]); } },
    { id: 'subway', zone: 'subway', title: 'LINE 4', text: 'Find Dr Mara at Kessler Square station. The notes say the signal room.', targets: () => person('Dr Halvard Mara', 'DR MARA').concat(finds()),
      people: z => z === 'subway' && !S().story.flags.mara ? [{ name: 'Dr Halvard Mara', room: 'Signal Room', head: 'scarf', crouch: true, hp: 60, talk: mara, onDeath: v => { if (!S().story.flags.mara) { S().story.flags.mara = 'dead'; CZ.dropLoot(v.pos.clone(), [['culture', 1]], "Mara's case (something important)"); log('Mara is dead. His case is on the floor of the signal room.'); } } }] : [],
      done: () => has('culture') },
    { id: 'checkpoint', zone: 'checkpoint', title: 'CHECKPOINT DELTA', text: "Take the command keycard from the Commander's Office, then use the uplink in the Comms Room.",
      loot: z => z === 'checkpoint' ? [["Commander's Office", 'keycard']] : [], targets: () => has('keycard') ? fixes('uplink', 'THE UPLINK') : finds(),
      done: () => !!S().story.ending },
  ];
  CZ.STORY = STEPS;
  /* ---- what the current step points at, in this place: things, people, or the road toward its place */
  function haveCounts(needs) { const h = {}, src = CZ.sources(CZ.leader ? CZ.leader() : G.player); for (const k of Object.keys(needs)) { h[k] = 0; for (const s of src) h[k] += s[k] || 0; } return h; }
  const fixes = (kind, label) => G.ents.filter(e => e.alive && (e.czFix === kind)).map(e => ({ p: e.pos, label }));
  // (the story's own person: never a survivor met on the way, nor a teammate, who happens to share the name)
  const person = (name, label) => G.actors.filter(a => a.name === name && a.state === 'alive' && a.cz && a.cz.person && !a.cz.person.sid && !a.cz.m).map(a => ({ p: a.pos, label, up: 2 }));
  const finds = () => G.ents.filter(e => e.alive && e.type === 'czloot' && /important/.test(String(e.label))).map(e => ({ p: e.pos, label: String(e.label).replace(' (something important)', '').toUpperCase() }));
  /* the first road to take from one place toward another (fewest minutes) */
  CZ.routeTo = function (from, to) {
    if (from === to) return null;
    const dist = { [from]: 0 }, first = {}, open = [from];
    while (open.length) {
      open.sort((a, b) => dist[a] - dist[b]); const z = open.shift();
      for (const [n, m] of Object.entries(CZ.ZONES[z].links)) { const d = dist[z] + m; if (dist[n] == null || d < dist[n]) { dist[n] = d; first[n] = z === from ? n : first[z]; open.push(n); } }
    }
    return first[to] || null;
  };
  CZ.targets = function () {
    const s = S(); if (!s || s.story.ending || !CZ.Z) return [];
    const st = step(); if (!st) return [];
    const here = CZ.Z.id, inPlace = st.zone === here || (st.anySafe && CZ.isSafe(here));
    if (!inPlace) {
      const nx = CZ.routeTo(here, st.zone), side = nx && CZ.exitsOf(here)[nx], e = side && CZ.Z.exits.find(x => x.side === side);
      return e ? [{ p: V().set(e.x, e.y, e.z), label: 'ROAD TO ' + CZ.ZONES[nx].name, road: nx }] : [];
    }
    const out = st.targets ? st.targets() : [];
    for (const f of finds()) if (!out.some(o => o.p === f.p)) out.push(f);
    return out;
  };
  CZ.survivorTalk = t => survivorTalk(t);
  const step = () => STEPS[S().story.step];
  CZ.objective = function () {
    if (CZ.isGuest && CZ.isGuest()) return CZ.guestObj || null;
    const s = S(); if (!s) return null;
    if (s.story.ending) return { title: 'VARROW', text: endingName(s.story.ending) + '. The city is yours to live in.', zone: null };
    const st = step(); if (!st) return null;
    const dl = s.diff === 'story' ? '' : ' (Day ' + s.day + ' of ' + DEADLINE + ')';
    return { title: st.title + dl, text: typeof st.text === 'function' ? st.text() : st.text, zone: st.zone };
  };
  function advance() {
    const s = S();
    while (step() && step().done()) {
      const st = step(); s.story.step++;
      if (st.after) st.after();
      HUD.banner('OBJECTIVE COMPLETE', st.title, 2.5, 'win');
      const nx = step(); if (nx) { log('New objective: ' + nx.text); if (!s.known.includes(nx.zone)) s.known.push(nx.zone); }
    }
  }
  CZ.storyTick = function (dt) {
    const Z = CZ.Z; if ((Z.storyT = (Z.storyT || 0) - dt) > 0) return; Z.storyT = 1;
    gymTick();
    advance();
    // the deadline
    const s = S();
    if (s.diff !== 'story' && !s.story.ending && s.day >= DEADLINE && !s.story.burnWarned) { s.story.burnWarned = true; ending('ash', true); }
  };
  CZ.listen('restore', () => advance());
  CZ.listen('enter', zid => {
    const s = S(), st = step();
    // the people and the special finds of the current step (and any earlier step's people still needed)
    for (const x of STEPS) { if (x.people) for (const o of x.people(zid)) CZ.spawnPerson(o); }
    if (st && st.loot) for (const [room, item] of st.loot(zid)) { if (has(item)) continue; const r = (G.map.roomByName[room] || [])[0]; if (!r) continue; const p = NAV.randomIn(r); if (p) { const e = CZ.dropLoot(p, [[item, 1]], room); e.label = room + ' (something important)'; e.cid = 'd_story_' + item; } }
    // the first job's materials: a lumber pile and a linen cupboard in the firehouse
    if (zid === 'firehouse' && st && st.id === 'restore' && !s.story.flags.supplies) {
      s.story.flags.supplies = true;
      const put = (room, items, label, cid) => { const r = (G.map.roomByName[room] || [])[0]; if (!r) return; const p = NAV.randomIn(r); if (!p) return; const e = CZ.dropLoot(p, items, label); e.cid = cid; };
      put('Workshop', [['planks', 4], ['nails', 2], ['tape', 1]], 'Lumber pile', 'd_story_lumber');
      put('Bunk Room', [['cloth', 3], ['bandage', 1]], 'Linen cupboard', 'd_story_linen');
    }
    // survivors waiting here
    for (const sv of s.survivors) if (sv.zone === zid && sv.state === 'waiting') { const a = CZ.spawnPerson({ name: sv.name, sid: sv.id, crouch: sv.why === 'wounded' }); a.cz.person.sid = sv.id; }
    // the uplink at the checkpoint
    if (zid === 'checkpoint' && !s.story.ending) { const r = (G.map.roomByName['Comms Room'] || [])[0]; if (r) { const p = NAV.randomIn(r); if (p) { const e = new GAD.Ent('czfix', null, p, { model: 'czradio', upright: true, hp: 999, hitR: 0, melee: false, team: -1 }); e.czFix = 'uplink'; e.bulletproof = true; e.blastproof = true; e.meleeable = false; } } }
    advance();
  });
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client) return;
    for (const e of G.ents) if (e.alive && e.czFix === 'uplink' && U.dist3(e.pos, a.pos.clone().setY(a.pos.y + 0.6)) < 1.8) { out.push({ kind: 'uplink', label: has('keycard') ? 'USE THE UPLINK' : 'THE UPLINK IS LOCKED (KEYCARD)', time: 1.2, ok: () => true, run: () => has('keycard') ? CZ.finale() : HUD.toast("The Commander's keycard opens it", 'warn') }); return; }
  });

  /* ---- the characters */
  function teo(t) {
    const homes = Object.keys(S().safe).filter(z => CZ.isSafe(z));
    say([{ who: 'Teo Baines', t: "You're not army. Army doesn't knock. ...BLOCKADE? Never heard of you. Doesn't matter. Get in, quick." },
      { who: 'Teo Baines', t: "Mara? Tall, grey, looked like he hadn't slept since the first week. He came through here for antivirals, the VX-7 stuff. Said he was going to the refugee school, Lincoln High. That was a fortnight ago." },
      { who: 'Teo Baines', t: "I'm a pharmacist. Was. I can't stay here, the back door won't hold another night." }],
    [CZ.recruit && CZ.squadCount() < CZ.MAX_SQUAD ? { label: 'JOIN THE SQUAD (' + CZ.squadCount() + '/' + CZ.MAX_SQUAD + ')', recruit: true, fn: () => { if (S().story.flags.teo) return; S().story.flags.teo = 'joined'; const m = CZ.recruit(t, 'Teo Baines', 'medic'); log('Teo Baines, a pharmacist, joined the squad. He says the refugees at Lincoln High saw Mara.'); if (!m) S().story.flags.teo = 'own'; advance(); } } : null,
     { label: homes.length ? 'COME WITH US: GO TO THE FIREHOUSE' : 'GO TO THE FIREHOUSE, WE\'LL MEET YOU', fn: () => { if (S().story.flags.teo) return; S().story.flags.teo = 'home'; const sv = CZ.newSurvivor('mainst'); Object.assign(sv, { name: 'Teo Baines', skill: 'medic', home: 'firehouse', state: 'travelling', arrive: S().day + 1 }); log('Teo Baines, a pharmacist, is going to the firehouse. He\'ll treat the squad there.'); drop(t); advance(); } },
      { label: 'TAKE THESE AND GO YOUR OWN WAY', fn: () => { if (S().story.flags.teo) return; S().story.flags.teo = 'own'; const m = me().cz.m; if (m.inv.water) CZ.take(m, 'water', 1); CZ.add(m, 'antibiotics', 2); HUD.toast('Teo gives you 2 antibiotics', 'info'); log('Teo Baines went his own way. He gave us antibiotics.'); t.cz.person.leaving = true; advance(); } }].filter(Boolean));
  }
  function mina(t) {
    const s = S();
    if (s.story.flags.gymHold === 'on' && CZ.Z.gym) { HUD.toast('Hold the gym!', 'warn'); return; }
    if (s.story.flags.gymHold === 'on') s.story.flags.gymHold = null;   // (not running: start it again)
    if (s.story.flags.gymHold === 'won') return minaAfter(t);
    say([{ who: 'Mina Hale', t: "Stop right there. ...You're not infected. Fine. I'm Mina, I run what's left of this place. Eleven of us in the gym." },
      { who: 'Mina Hale', t: "The doctor? He was here. Left the way he came, toward the hospital. But we have a problem first. The noise you made coming in. Listen." }],
    [{ label: 'WE\'LL HOLD THE GYM', fn: () => { if (!S().story.flags.gymHold) holdGym(t); } }]);
  }
  function holdGym(t) {
    const s = S(); s.story.flags.gymHold = 'on';
    HUD.banner('HOLD THE GYM', 'Keep them off the refugees for 90 seconds', 3, 'lose');
    // as many as the difficulty and the squad's size make fair: eleven and two waves of four for a squad
    // of five on Survivor (it was sixteen and two sixes, which a squad of bots rarely lived through)
    const k = CZ.diff().inf * (0.6 + 0.08 * Math.max(1, CZ.squadCount ? CZ.squadCount() : 5));
    CZ.horde(Math.round(11 * k), t.pos.clone());
    // the 90 seconds run on the game's clock (gymTick, from the story's tick), and only while the squad
    // is here: it was a timer of its own that a reload lost, with the save still saying the hold was on,
    // and Mina only ever said "Hold the gym!" after that
    CZ.Z.gym = { t, k, left: 90, last: G.time, wave: 60 };
  }
  function gymTick() {
    const s = S(), Z = CZ.Z, H = Z && Z.gym;
    if (s.story.flags.gymHold !== 'on') return;
    if (!H) { s.story.flags.gymHold = null; return; }   // a hold that isn't running here (left the place, a reload, a wipe): it starts over
    H.left -= Math.max(0, G.time - H.last); H.last = G.time;
    if (H.left <= H.wave && H.wave > 0) { CZ.horde(Math.round(4 * H.k), H.t.pos.clone()); HUD.toast(H.wave + ' seconds', 'warn'); H.wave -= 30; }
    if (H.left > 0) return;
    Z.gym = null; s.story.flags.gymHold = 'won'; const t = H.t;
    if (Z.skip) for (const k of Object.keys(Z.skip)) if (k.startsWith('talk:')) delete Z.skip[k];   // (Mina wants a word: whoever leads goes to her now)
    HUD.banner('THE GYM HELD', t.state === 'alive' ? 'Mina wants a word' : "Mina didn't make it", 3, 'win');
    if (t.state !== 'alive') { s.story.flags.school = 'lost'; CZ.add(me().cz.m, 'radiopart', 1); log('We held the gym, but Mina Hale died. We found a radio valve set in her things.'); advance(); }
  }
  function minaAfter(t) {
    const homes = Object.keys(S().safe).filter(z => CZ.isSafe(z));
    say([{ who: 'Mina Hale', t: 'You held. ...Thank you. Here: a valve set from the school radio. If you can get a set working, you can reach whoever sent you.' },
      { who: 'Mina Hale', t: "We can't stay here much longer. The fence is gone. Do you have somewhere safer? Or we fortify here and you come and trade with us. Your call." }],
    [CZ.recruit && CZ.squadCount() < CZ.MAX_SQUAD ? { label: 'MINA, JOIN THE SQUAD (THE OTHERS GO TO ' + (homes.length ? CZ.ZONES[homes[0]].name : 'THE FIREHOUSE') + ')', recruit: true, fn: () => { if (S().story.flags.school) return; S().story.flags.school = 'joined'; const home = homes[0] || 'firehouse'; for (const [n, sk] of [['Ruben Ostrow', 'cook'], ['Petra Lind', 'farmer']]) { const sv = CZ.newSurvivor('school'); Object.assign(sv, { name: n, skill: sk, home, state: 'travelling', arrive: S().day + 1 }); } CZ.add(me().cz.m, 'radiopart', 1); log('Mina Hale joined the squad; the rest of the Lincoln High refugees are moving to ' + CZ.ZONES[home].name + '.'); CZ.recruit(t, 'Mina Hale', 'guard'); advance(); } } : null,
     { label: homes.length ? 'COME TO ' + CZ.ZONES[homes[0]].name : 'COME TO THE FIREHOUSE', fn: () => { if (S().story.flags.school) return; S().story.flags.school = 'moved'; const home = homes[0] || 'firehouse'; for (const [n, sk] of [['Mina Hale', 'guard'], ['Ruben Ostrow', 'cook'], ['Petra Lind', 'farmer']]) { const sv = CZ.newSurvivor('school'); Object.assign(sv, { name: n, skill: sk, home, state: 'travelling', arrive: S().day + 1 }); } log('The Lincoln High refugees are moving to ' + CZ.ZONES[home].name + ': a guard, a cook and a farmer among them. More mouths to feed.'); CZ.add(me().cz.m, 'radiopart', 1); t.cz.person.leaving = true; advance(); } },
      { label: 'STAY AND FORTIFY: WE\'LL TRADE', fn: () => { if (S().story.flags.school) return; S().story.flags.school = 'trade'; log('The Lincoln High refugees are staying. Mina will trade with us.'); CZ.add(me().cz.m, 'radiopart', 1); advance(); } }].filter(Boolean));
  }
  function mara(t) {
    const s = S(), m = me().cz.m, haveAV = s.squad.some(x => x.alive && x.inv.antiviral > 0);
    say([{ who: 'Dr Halvard Mara', t: "Don't come closer. I'm... it's in me. Three days. Maybe two." },
      { who: 'Dr Halvard Mara', t: "You found the notes. Then you know. The culture's in this case. It works, it actually works, but it has to go out to everyone or Command burns it with the rest of us." },
      { who: 'Dr Halvard Mara', t: 'The uplink at Delta can send the formula anywhere. Take it.' }],
    [haveAV ? { label: 'GIVE HIM THE ANTIVIRAL', fn: () => { if (s.story.flags.mara) return; for (const x of s.squad) if (x.alive && x.inv.antiviral > 0) { x.inv.antiviral--; if (!x.inv.antiviral) delete x.inv.antiviral; break; } s.story.flags.mara = 'alive'; CZ.add(m, 'culture', 1); const sv = CZ.newSurvivor('subway'); const home = Object.keys(s.safe).find(z => CZ.isSafe(z)) || 'firehouse'; Object.assign(sv, { name: 'Dr Halvard Mara', skill: 'medic', home, state: 'travelling', arrive: s.day + 1 }); log('Mara lives, for now: the antiviral bought him time. He is going to ' + CZ.ZONES[home].name + '. We have the culture.'); t.cz.person.leaving = true; drop(t); advance(); } } : null,
      { label: 'TAKE THE CASE', fn: () => { if (s.story.flags.mara) return; s.story.flags.mara = 'left'; CZ.add(m, 'culture', 1); log("We took Mara's culture. He stayed in the signal room. He wasn't going to leave it."); setTimeout(() => { if (t.state === 'alive') { const p = t.pos.clone(); t.die(null, false); if (CZ.on()) CZ.spawnInfected('runner', p).name = 'Mara'; } }, 20000); advance(); } }].filter(Boolean));
  }
  /* ---- the end of the road: the uplink */
  CZ.finale = () => { if (CZ.agentAtUplink && CZ.agentAtUplink()) return; finale(); };
  function finale() {
    const s = S(), homes = Object.keys(s.safe).filter(z => CZ.isSafe(z)), home = (s.survivors || []).filter(x => x.state === 'home').length;
    const canStay = homes.length >= 2 || home >= 4;
    say([{ who: CALDER, t: "You're at the uplink. I see you. Listen to me very carefully, because Command is listening too." },
      { who: 'COMMAND (Brigadier Okafor)', t: "Squad. You have something of ours. Hand over the culture and we bring a helicopter to Delta in twenty minutes. You five walk out. The city is still scheduled." },
      { who: CALDER, t: "Or you send Mara's formula out on every frequency this thing has. Once it's out they can't burn the cure. They'll have to come in for the people instead. Your choice. I'm with you either way." }],
    [{ label: 'BROADCAST THE FORMULA', fn: () => ending('dawn') },
      { label: 'TRADE IT FOR THE HELICOPTER', cls: 'ghost', fn: () => ending('ash') },
      canStay ? { label: 'KEEP IT: VARROW CURES ITS OWN', fn: () => ending('stand') } : { label: 'KEEP IT (NEEDS 2 SAFEHOUSES OR 4 SURVIVORS)', cls: 'ghost', fn: () => HUD.toast('Varrow cannot hold on its own yet', 'warn') }]);
  }
  const ENDINGS = {
    dawn: { name: 'DAWN', lines: ['The formula went out at 04:12 on every band the uplink had. By six it was on the news in nine countries. By noon Command had stood the bombers down.', 'The first convoys came through Delta a week later: doctors, not soldiers. Varrow was still Varrow, full of the dead and the hungry, but it was a city again.', 'The squad stayed to help. Somebody had to know the way through the Galleria.'] },
    ash: { name: 'ASH', lines: ['The helicopter came. The five of you were on it, and the case was on Brigadier Okafor\'s lap.', 'Varrow burned at dawn. From four thousand feet it looked like the sun had come up twice.', 'Somewhere in a laboratory the cure is being made, for those who can pay. You think about the firehouse a lot.'] },
    stand: { name: 'VARROW STANDS', lines: ['You switched the uplink off and kept the culture. Mara\'s notes, a stove, a lot of patience: by the end of the month every safehouse had a dose for its people.', 'Command\'s deadline came and went. Calder told them the city was cured and dug in; they decided it wasn\'t worth the bombs. Nobody came in. Nobody needed to.', 'Varrow is still quarantined. It is also still alive.'] },
  };
  const endingName = k => (ENDINGS[k] || {}).name || k;
  function ending(kind, forced) {
    const s = S(); if (s.story.ending) return;
    s.story.ending = kind; s.story.done = true;
    if (forced) s.story.forced = true;
    log('ENDING: ' + ENDINGS[kind].name);
    const lines = (forced ? ['Day ' + DEADLINE + '. The engines were the first thing anyone heard: low, from the south, a lot of them.'] : []).concat(ENDINGS[kind].lines);
    CZ.save(true);
    say(lines.map(t => ({ who: ENDINGS[kind].name, t })), [{ label: 'CARRY ON IN VARROW', fn: () => HUD.banner(ENDINGS[kind].name, 'The campaign is over. The city is still here.', 4, 'win') }, { label: 'MAIN MENU', cls: 'ghost', fn: () => { GAME.quit(); MENU.home(); } }]);
  }

  /* ---- the opening */
  CZ.storyStart = function (s) { s.story.log.push({ d: 1, t: 'Inserted at the west edge of Varrow, by the Engine 9 firehouse.' }); };
  CZ.storyIntro = function (go) {
    const s = U.$('screens'); s.innerHTML = '';
    const lines = [
      'Eleven weeks ago the Grey Fever came out of St Brigid\'s Hospital. Six weeks ago the army put a fence round Varrow and called it a quarantine.',
      'Three days ago a broadcast got out: Dr Halvard Mara, St Brigid\'s, claiming a treatment. Then nothing.',
      'BLOCKADE\'s Overseer, Ines Calder, has put five of you over the fence at the west end of the city. Find Mara. Find what he has. Get it out.',
      CZ.S.diff === 'story' ? 'Take your time.' : 'Command has given the city ' + DEADLINE + ' days. After that, they burn it.'];
    let i = 0;
    const box = U.el('div', { class: 'cz-intro' });
    const draw = () => { box.innerHTML = ''; box.append(U.el('p', {}, lines[i]), U.el('div', { class: 'actions' }, U.el('button', { class: 'btn big', onclick: () => { SFX.ui(); if (++i < lines.length) draw(); else go(); } }, i < lines.length - 1 ? 'CONTINUE ▸' : 'GO IN'))); };
    draw(); s.append(box);
  };

  /* ================================================================ days */
  /* each new day: maybe a supply drop, a horde on the move, someone calling for help (you hear about
     them on a safehouse radio; without one you find them by going there) */
  const radioOn = () => Object.values(S().safe).some(sf => (sf.up || []).includes('radio'));
  CZ.listen('day', d => {
    const s = S(), zones = Object.keys(CZ.ZONES).filter(z => !CZ.isSafe(z));
    s.events = (s.events || []).filter(e => e.until > d * 1440);
    const pick = () => zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.5) s.events.push({ kind: 'drop', zone: pick(), until: (d + 1) * 1440 + 1440, id: 'drop' + d });
    if (Math.random() < 0.4) s.events.push({ kind: 'horde', zone: pick(), until: (d + 1) * 1440, id: 'horde' + d });
    if (Math.random() < 0.5) { const z = pick(); const sv = CZ.newSurvivor(z, Math.random() < 0.3 ? 'wounded' : 'trapped'); s.events.push({ kind: 'distress', zone: z, until: (d + 2) * 1440, sid: sv.id, id: 'sos' + d }); }
    if (radioOn() && s.events.length) HUD.toast('The radio has news: open the map (' + KEYS.name('czMap') + ')', 'info');
  });
  CZ.radio = function () {
    const s = S(), now = s.day * 1440 + s.min, ev = (s.events || []).filter(e => e.until > now);
    const lines = ev.length ? ev.map(e => ({ who: 'RADIO', t: e.kind === 'drop' ? 'A supply drop came down at ' + CZ.ZONES[e.zone].name + '. Military crates. Somebody will get to it.' : e.kind === 'horde' ? 'Big group of infected moving through ' + CZ.ZONES[e.zone].name + '. Stay clear if you can.' : 'Someone calling for help from ' + CZ.ZONES[e.zone].name + '. They sound scared.' })) : [{ who: 'RADIO', t: 'Static. Then, faintly, a station playing music to nobody.' }];
    if (!s.story.ending && step()) lines.push({ who: CALDER, t: 'Your objective: ' + step().text });
    say(lines);
  };
  // the day's events where they are, when you get there
  CZ.listen('enter', zid => {
    const s = S(), now = s.day * 1440 + s.min;
    for (const e of s.events || []) {
      if (e.zone !== zid || e.until < now || e.done) continue;
      if (e.kind === 'drop') { e.done = true; const n = OPS3.navNodes(); const p = NAV.nodePos(n[Math.floor(Math.random() * n.length)]); const items = {}; for (let i = 0; i < 4; i++) { const T = CZ.LOOT.military; const r = T[Math.floor(Math.random() * T.length)]; items[r[0]] = (items[r[0]] || 0) + r[2]; } const c = CZ.dropLoot(p, Object.entries(items), 'Supply drop'); c.cid = 'd_drop_' + e.id; HUD.toast('There is a supply drop here somewhere: listen for the beacon', 'info'); const iv = setInterval(() => { if (!c.alive || !CZ.on()) return clearInterval(iv); SFX.beep(c.pos, 1200, 0.5); GAME.noise(c.pos, 35, null, 'gadget'); }, 2500); }
      if (e.kind === 'horde') { e.done = true; setTimeout(() => { if (CZ.on() && CZ.Z.id === zid) CZ.horde(14 + Math.floor(Math.random() * 8)); }, 25000 + Math.random() * 40000); }
    }
  });
  /* on the road: sometimes something happens between places */
  CZ.roadEvent = function (from, to, byCar) {
    const r = Math.random(), s = S();
    if (r < 0.12) { const m = s.squad.find(x => x.player) || s.squad[0]; const got = ['scrap', 'fuel', 'water', 'cloth', 'a9'][Math.floor(Math.random() * 5)]; m.inv[got] = (m.inv[got] || 0) + (got === 'a9' ? 15 : 1); s.pendingToast = 'On the road you found ' + CZ.itemName(got) + ' in a wreck'; }
    else if (r < 0.2 && !byCar) { s.pendingAmbush = to; }
    else if (r < 0.27) { const sv = CZ.newSurvivor(to, 'road'); s.pendingToast = 'Someone was following you on the road: ' + sv.name; }
    return false;
  };
  CZ.listen('enter', zid => {
    const s = S();
    if (s.pendingToast) { HUD.toast(s.pendingToast, 'info'); s.pendingToast = null; }
    if (s.pendingAmbush === zid) { s.pendingAmbush = null; setTimeout(() => { const L = me(); if (!CZ.on() || !L || !L.cz) return; for (let i = 0; i < 5; i++) { const p = L.pos.clone().add(V().set((Math.random() - 0.5) * 24, 0, (Math.random() - 0.5) * 24)), n = NAV.nearest(p, 6); if (n >= 0 && U.dist3(NAV.nodePos(n), L.pos) > 9) { const a = CZ.spawnInfected('runner', NAV.nodePos(n)); a.cz.state = 'chase'; a.cz.target = L; a.cz.seenT = G.time; } } HUD.banner('AMBUSH', 'They followed you in', 2, 'lose'); }, 4000); }
  });
  /* random trouble in the place you are: a horde now and then, more at night */
  CZ.eventsTick = function (dt) {
    const Z = CZ.Z; if ((Z.evT = (Z.evT == null ? 240 : Z.evT) - dt) > 0) return;
    Z.evT = 200 + Math.random() * 260;
    const d = Z.def.danger, safe = CZ.isSafe(Z.id) && (S().safe[Z.id].up || []).includes('walls');
    if (!safe && Math.random() < 0.12 + d * 0.05 + (CZ.night() ? 0.12 : 0)) CZ.horde(8 + d * 2 + (CZ.night() ? 4 : 0));
  };
  /* the trader at Lincoln High (if the refugees stayed) */
  CZ.listen('enter', zid => {
    if (zid !== 'school' || S().story.flags.school !== 'trade') return;
    CZ.spawnPerson({ name: 'Mina Hale', room: 'Gymnasium', head: 'bandana', talk: t => {
      const m = me().cz.m, offers = CZ.TRADES.filter(([give]) => (m.inv[give] || 0) > 0).slice(0, 5);
      say([{ who: 'Mina Hale', t: offers.length ? 'What have you got? We\'ll make it worth your while.' : 'Come back when you have something to trade. Water, food, medicine, rounds.' }],
        offers.map(([give, get, gn, rn]) => ({ label: gn + ' ' + CZ.itemName(give) + ' → ' + rn + ' ' + CZ.itemName(get), fn: () => { if ((m.inv[give] || 0) >= gn) { CZ.take(m, give, gn); CZ.add(m, get, rn); HUD.toast('Traded', 'info'); } } })).concat([{ label: 'NOTHING TODAY', cls: 'ghost' }]));
    } });
  });
})();
