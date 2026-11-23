/* cityz-kit.js -- City Z: what each member of the squad takes in with them, beyond their guns.

     a perk         one passive edge, chosen with the operator (the player picks theirs on the squad
                    screen; teammates and recruits pick their own, by who they are):
                      GUNPLAY      swap and reload faster, hip-fire tighter, aim down sights faster
                      MARATHON     run faster, more stamina
                      HIBERNATION  more in every search, hunger and thirst build more slowly
                      IRON MIKE    a melee blow kills any infected, from further off
                      FIELD MEDIC  brings a fallen teammate back (two first-aid kits and two medicines)
     a care package one kind, chosen the same way, called in once for every place the squad clears:
                    a helicopter comes over, the crate comes down on a parachute where they stood
                      AMMO BOX     every magazine and the pack filled for both guns
                      HEALTH KIT   health back to full, bleeding stopped, a break set
                      RATIONS      hunger and thirst back to nothing
                      PRESCRIPTION MEDS  nerves steadied, sickness and pain gone, the infection pushed back
                    The player calls theirs with a key (or the CARE button); teammates call theirs when
                    they need what's in it, out in the open and when it's quiet.

   And the trash-can fires: a few burning drums out in the streets of every place, for the look of
   the city (standing by one settles the nerves a little, like any fire). */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const R = (a, b) => a + Math.random() * (b - a);
  const pickW = w => { let t = 0; for (const v of Object.values(w)) t += Math.max(0, v); let x = Math.random() * t; for (const [k, v] of Object.entries(w)) { x -= Math.max(0, v); if (x <= 0) return k; } return Object.keys(w)[0]; };
  const say = (a, key, lines, pri) => { if (window.VOICE && a && a.bot) VOICE.say(a, key, lines, pri || 2); };
  const squad = () => G.actors.filter(a => a.cz && a.cz.m && a.state === 'alive');
  const fighting = a => a.bot && a.bot.target && a.bot.target.state === 'alive' && G.time - (a.bot.seenT || -99) < 4;

  /* ================================================================ the choices */
  CZ.OP_PERKS = {
    gunplay: { name: 'GUNPLAY', desc: 'Swap weapons and reload faster, hip-fire more accurately, aim down sights faster.' },
    marathon: { name: 'MARATHON', desc: 'Run faster, with more stamina.' },
    hibernation: { name: 'HIBERNATION', desc: 'More in every search, and hunger and thirst build more slowly.' },
    ironmike: { name: 'IRON MIKE', desc: 'A melee blow kills any infected outright, and reaches further.' },
    fieldmedic: { name: 'FIELD MEDIC', desc: 'Bring a fallen teammate back: two first-aid kits and two medicines (antibiotics, painkillers or the antiviral).' },
  };
  CZ.CARE_KINDS = {
    ammo: { name: 'AMMO BOX', desc: 'Every magazine and the pack filled, for both guns.' },
    health: { name: 'HEALTH KIT', desc: 'Health back to full, bleeding stopped, a break set.' },
    rations: { name: 'RATIONS', desc: 'Hunger and thirst back to nothing.' },
    meds: { name: 'PRESCRIPTION MEDS', desc: 'Nerves steadied, sickness and pain gone, the infection pushed back.' },
  };
  CZ.perkOf = x => { const m = x && (x.cz ? x.cz.m : x); return (m && m.perk) || null; };
  /* a teammate's own choice: who they are (cityz-people.js) leans it */
  CZ.choosePerk = function (m) {
    const p = m.p; if (!p) return pickW({ gunplay: 1, marathon: 1, hibernation: 1, ironmike: 1, fieldmedic: 1 });
    const t = p.t, has = k => p.perks.includes(k) || p.flaws.includes(k);
    return pickW({
      gunplay: 1 + t.disc + (has('sharpshooter') ? 2 : 0) + (p.arch === 'veteran' ? 1.5 : 0),
      marathon: 1 + (1 - t.nerve) + (p.arch === 'rookie' ? 1.5 : 0) + (has('coward') ? 1 : 0),
      hibernation: 1 + t.smarts + (p.arch === 'scholar' ? 1.5 : 0) + (has('glutton') ? 1.5 : 0),
      ironmike: 1 + t.temper * 2 + (p.arch === 'hothead' ? 1.5 : 0),
      fieldmedic: 1 + t.gen + (has('medic') ? 3 : 0) + (p.arch === 'carer' ? 2 : 0),
    });
  };
  CZ.chooseCare = function (m) {
    const p = m.p; if (!p) return pickW({ ammo: 1, health: 1, rations: 1, meds: 1 });
    const t = p.t, has = k => p.perks.includes(k) || p.flaws.includes(k);
    return pickW({ ammo: 1.2 + t.temper + t.nerve * 0.5, health: 1 + t.care + (has('medic') ? 0.5 : 0), rations: 0.8 + t.app + (has('glutton') ? 1.5 : 0), meds: 0.5 + (1 - t.nerve) + (has('anxious') ? 2 : 0) });
  };
  /* a teammate's guns and gadget, from what the operator can carry (so a squad isn't five of the same) */
  CZ.chooseKit = function (m) {
    const op = DATA.OPMAP[m.op]; if (!op || !op.primaries) return;
    const lo = { primary: op.primaries[Math.floor(Math.random() * op.primaries.length)], secondary: op.secondaries[Math.floor(Math.random() * op.secondaries.length)], gadget: (op.gadgets || [])[Math.floor(Math.random() * (op.gadgets || []).length)] };
    CZ.applyKit(m, lo);
  };
  /* a loadout onto a member: the guns, rounds for them (four magazines each), the gadget, attachments */
  CZ.applyKit = function (m, lo) {
    if (!lo) return;
    for (const k of Object.keys(m.inv)) if (CZ.ITEMS[k] && CZ.ITEMS[k].cat === 'ammo') delete m.inv[k];
    m.guns = [{ id: lo.primary, mag: -1 }, { id: lo.secondary, mag: -1 }];
    for (const id of [lo.primary, lo.secondary]) { const w = DATA.WEAPONS[id]; if (!w) continue; const c = CZ.calOf(id); m.inv[c] = (m.inv[c] || 0) + (w.mag || 10) * 4; }
    m.gadget = lo.gadget || null; m.att = lo.att || null;
  };

  // a new campaign: the player's own choices (the squad screen), everyone else their own
  const oNew = CZ.newGame;
  CZ.newGame = function (ops, diff, setup) {
    const S = oNew.apply(this, arguments);
    S.squad.forEach((m, i) => {
      if (i === 0 && setup && !CZ.watching) { CZ.applyKit(m, setup.lo); m.perk = setup.perk; m.care = setup.care; }
      else { CZ.chooseKit(m); m.perk = CZ.choosePerk(m); m.care = CZ.chooseCare(m); }
      m.careN = 0;
    });
    CZ.save(true);
    return S;
  };
  const oLoad = CZ.load;
  CZ.load = function () { const S = oLoad.apply(this, arguments); if (S) for (const m of S.squad) { if (CZ.unifyAmmo) CZ.unifyAmmo(m); if (!m.perk) m.perk = CZ.choosePerk(m); if (!m.care) m.care = CZ.chooseCare(m); if (m.careN == null) m.careN = 0; } return S; };
  const oRec = CZ.recruit;
  CZ.recruit = function () { const m = oRec.apply(this, arguments); if (m) { m.perk = CZ.choosePerk(m); m.care = CZ.chooseCare(m); m.careN = 0; } return m; };

  /* ================================================================ perks at work */
  /* on the body: Gunplay's quicker hands, Iron Mike's reach (and whatever the gun's numbers become) */
  function applyPerk(a) {
    if (!a || !a.cz || !a.cz.m) return;
    const perk = CZ.perkOf(a);
    a.meleeReach = perk === 'ironmike' ? 2.5 : 0;
    if (perk !== 'gunplay') return;
    const quick = d => Object.assign({}, d, { reload: (d.reload || 2) * 0.7, reloadE: (d.reloadE || d.reload || 2.5) * 0.7, shell: d.shell ? d.shell * 0.75 : d.shell, adsT: (d.adsT || 0.25) * 0.6, hip: (d.hip || 2) * 0.65 });
    for (const w of a.w) { if (w.czQuick) continue; w.def = quick(w.def); if (w.modeDefs) w.modeDefs = w.modeDefs.map(quick); w.czQuick = true; }
  }
  CZ.applyPerk = applyPerk;
  const oSpawn = CZ.spawnMember;
  CZ.spawnMember = function () { const a = oSpawn.apply(this, arguments); applyPerk(a); return a; };
  if (CZ.equip) { const oEq = CZ.equip; CZ.equip = function (a) { const r = oEq.apply(this, arguments); applyPerk(a); if (a && a.cz && CZ.unifyAmmo) CZ.unifyAmmo(a.cz.m); return r; }; }
  const oSwap = WPN.swap;
  WPN.swap = function (a) { const r = oSwap.apply(this, arguments); if (CZ.on && CZ.on() && a && a.cz && a.cz.m && CZ.perkOf(a) === 'gunplay' && a.swap > 0) a.swap *= 0.5; return r; };
  // Iron Mike: one blow, any infected
  const oHurt = Actor.prototype.hurt;
  Actor.prototype.hurt = function (dmg, info) {
    if (info && info.kind === 'melee' && info.src && this.cz && (this.cz.inf || this.cz.opx) && CZ.on && CZ.on() && CZ.perkOf(info.src) === 'ironmike') dmg = this.hp * 4 + 999;
    return oHurt.call(this, dmg, info);
  };
  // Hibernation: more in each container (an extra half a search)
  const oLoot = CZ.loot;
  CZ.loot = function (a, e) {
    if (e && e.alive && !e.items && a && CZ.perkOf(a) === 'hibernation' && CZ.rollLoot) { e.items = CZ.rollLoot(e.table); for (const [id, n] of Object.entries(CZ.rollLoot(e.table, 0.6))) e.items[id] = (e.items[id] || 0) + n; }
    return oLoot.apply(this, arguments);
  };
  // (Marathon's pace and stamina, and Hibernation's slower hunger, are in cityz-survival.js)

  /* ---- Field Medic: a fallen teammate back on their feet */
  const MEDICINE = ['antibiotics', 'painkillers', 'antiviral'];
  const reviveCost = m => (m.inv.medkit || 0) >= 2 && MEDICINE.reduce((t, id) => t + (m.inv[id] || 0), 0) >= 2;
  const revivable = b => b && b.cz && b.cz.m && b.state === 'dead' && !b.cz.m.gone && !b.cz.m.turned && !b.cz.m.lostTo && !b.czReviving;
  CZ.canRevive = a => CZ.perkOf(a) === 'fieldmedic' && reviveCost(a.cz.m);
  CZ.revive = function (a, b) {
    if (!CZ.canRevive(a) || !revivable(b) || a.busy > 0 || U.dist3(a.pos, b.pos) > 2.6) return false;
    const m = a.cz.m; CZ.take(m, 'medkit', 2);
    let left = 2; for (const id of MEDICINE) { const n = Math.min(left, m.inv[id] || 0); if (n) { CZ.take(m, id, n); left -= n; } }
    a.busy = 5; a.busyLabel = 'REVIVING ' + CZ.nm(b).toUpperCase(); b.czReviving = true;
    say(a, 'revive', ['Stay with me. Stay with me!', "Don't you dare. Come on!", "I've got you. Breathe!"], 4);
    setTimeout(() => {
      b.czReviving = false;
      if (!CZ.on() || a.state !== 'alive' || b.state !== 'dead') return;
      const bm = b.cz.m;
      b.respawn(b.pos.clone(), b.yaw); b.hp = 40; bm.alive = true; bm.hp = 40; bm.st.bleed = 0;
      if (!b.isPlayer && !b.bot) { b.isBot = true; b.persona = b.persona || PERSONA.make([]); AI.attach(b); b.bot.role = 'squad'; if (AI.teams[CZ.TEAM]) AI.teams[CZ.TEAM].bots.push(b); }
      applyPerk(b);
      HUD.banner(CZ.nm(b).toUpperCase() + ' IS BACK', CZ.nm(a) + ' brought them round', 3, 'win');
      CZ.S.story.log.push({ d: CZ.S.day, t: CZ.nm(a) + ' brought ' + CZ.nm(b) + ' back from the dead (as near as makes no difference).' });
      say(b, 'revived', ['...What happened? Did I...?', "I saw a light. It was a flashlight. Thanks."], 4);
      if (CZ.bond) CZ.bond(b, a, 30, 'brought them back');
    }, 4800);
    return true;
  };
  // a field medic with someone down nearby keeps the revive kit for them (it doesn't go on their own
  // scratches, or to a teammate who could do without)
  if (CZ.botCare) {
    const oCare = CZ.botCare;
    CZ.botCare = function (a, dt) {
      const m = a && a.cz && a.cz.m;
      if (!m || !CZ.canRevive(a) || !G.actors.some(b => revivable(b) && U.dist3(b.pos, a.pos) < 40)) return oCare.apply(this, arguments);
      const keep = {}; for (const id of ['medkit', ...MEDICINE]) if (m.inv[id]) { keep[id] = m.inv[id]; delete m.inv[id]; }
      try { return oCare.apply(this, arguments); } finally { for (const [id, n] of Object.entries(keep)) m.inv[id] = (m.inv[id] || 0) + n; }
    };
  }
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client || CZ.perkOf(a) !== 'fieldmedic') return;
    for (const b of G.actors) {
      if (b === a || !revivable(b) || U.dist3(b.pos, a.pos) > 2.4) continue;
      const ok = reviveCost(a.cz.m);
      out.push({ kind: 'revive', label: ok ? 'REVIVE ' + CZ.nm(b).toUpperCase() : 'REVIVING ' + CZ.nm(b).toUpperCase() + ' NEEDS 2 FIRST-AID KITS + 2 MEDICINES', time: 1, ok: () => ok && revivable(b), run: () => CZ.revive(a, b) });
      return;
    }
  });

  /* ================================================================ care packages */
  // one for each member alive, for every place cleared
  CZ.listen('cleared', () => {
    let n = 0;
    for (const m of CZ.S.squad) if (m.alive && !m.gone) { m.careN = Math.min(2, (m.careN || 0) + 1); n++; }
    if (n) HUD.toast('Place cleared: everyone has a care package to call in (' + KEYS.name('czCare') + ')', 'info');
    CZ.save(true);
  });
  const inbound = new Set();
  /* call it in: out in the open (the pilot has to see you) */
  CZ.callCare = function (a) {
    const m = a && a.cz && a.cz.m; if (!m) return false;
    if (CZ.isGuest && CZ.isGuest()) { HUD.toast('The host calls in care packages', 'warn'); return false; }
    if (!(m.careN > 0)) { CZ.tell(a, 'No care package to call in: clear a place first', 'warn'); return false; }
    if (inbound.has(m)) { CZ.tell(a, 'Your care package is already on its way', 'warn'); return false; }
    if (CZ.sheltered(a)) { CZ.tell(a, 'Get outside: the helicopter has to be able to see you', 'warn'); return false; }
    const f = a.fwd(V()).setY(0).normalize(), n = NAV.nearest(a.pos.clone().addScaledVector(f, 2.5), 4), at = n >= 0 ? NAV.nodePos(n) : a.pos.clone();
    m.careN--; inbound.add(m);
    new Heli(a, m, at);
    CZ.tell(a, CZ.CARE_KINDS[m.care].name + ' on its way: the helicopter is inbound', 'info');
    say(a, 'care', ['Calling in a drop.', 'Care package inbound!', 'Requesting resupply. Mark my position.'], 3);
    if (window.SFX) SFX.beep(a.pos, 900, 0.4);
    return true;
  };
  /* what's in it, for whoever opens it */
  function open(a, crate) {
    const m = a.cz.m, st = m.st, kind = crate.kind;
    if (kind === 'ammo') { for (const w of a.w) { w.mag = w.def.mag || w.mag; const c = CZ.calOf(w.id); m.inv[c] = Math.max(m.inv[c] || 0, (w.def.mag || 10) * Math.max(4, w.def.mags || 4)); } }
    if (kind === 'health') { a.hp = a.maxHp; m.hp = a.hp; st.bleed = 0; st.fracture = false; }
    if (kind === 'rations') { st.hunger = 0; st.thirst = 0; }
    if (kind === 'meds') { const p = CZ.P && CZ.P(a); if (p) p.stress = 0; st.sick = 0; a.czQueasy = null; st.pain = 120; st.infection = Math.max(0, st.infection - 30); a.czPanic = null; }
    crate.destroy('used');
    CZ.tell(a, CZ.CARE_KINDS[kind].name + ': ' + CZ.CARE_KINDS[kind].desc, 'info');
    if (a.isPlayer && window.SFX) SFX.ui(800);
    say(a, 'opened', ['That hits the spot.', 'Good timing, pilot.', 'Now we are talking.'], 2);
  }
  CZ.openCare = open;
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client) return;
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czcare' || !e.landed || U.dist3(e.pos, a.pos.clone().setY(a.pos.y + 0.4)) > 1.9) continue;
      out.push({ kind: 'care', label: 'OPEN THE CARE PACKAGE · ' + CZ.CARE_KINDS[e.kind].name + (e.forWho && e.forWho !== a.cz.m ? ' (' + e.forWho.name + "'s)" : ''), time: 0.8, ok: () => e.alive, run: () => open(a, e) });
      return;
    }
  });

  /* ---- the helicopter, the crate and its parachute */
  const box = (g, x0, y0, z0, x1, y1, z1, c) => g.box(x0, y0, z0, x1, y1, z1, c);
  Object.assign(GAD.EXTRA, {
    czheli: g => {   // a utility helicopter, 1/32 m units: nose toward -z
      box(g, -26, 0, -80, 26, 46, 40, 0x3e4a3a); box(g, -22, 6, -96, 22, 40, -80, 0x3e4a3a); box(g, -18, 20, -100, 18, 38, -96, 0x8ab0c0);
      box(g, -27, 22, -60, 27, 38, -20, 0x2a3028); box(g, -8, 20, 40, 8, 32, 170, 0x3e4a3a); box(g, -3, 32, 150, 3, 66, 170, 0x3e4a3a);
      box(g, -30, -16, -60, -26, -12, 30, 0x222622); box(g, 26, -16, -60, 30, -12, 30, 0x222622); box(g, -27, -12, -40, -24, 0, -36, 0x222622); box(g, 24, -12, -40, 27, 0, -36, 0x222622); box(g, -27, -12, 14, -24, 0, 18, 0x222622); box(g, 24, -12, 14, 27, 0, 18, 0x222622);
      box(g, -4, 46, -8, 4, 56, 8, 0x222622); box(g, -27, 30, 0, -26, 34, 10, 0xd83a3a); box(g, 26, 30, 0, 27, 34, 10, 0x3ad83a);
    },
    czrotor: g => { box(g, -200, 0, -5, 200, 2, 5, 0x1a1a1a); box(g, -5, 0, -200, 5, 2, 200, 0x1a1a1a); },
    czcare: g => { box(g, -14, 0, -10, 14, 18, 10, 0x4a5a34); box(g, -14.5, 8, -10.5, 14.5, 10, 10.5, 0xd8c040); box(g, -3, 18, -3, 3, 18.5, 3, 0xd83a3a); box(g, -6, 4, -10.6, 6, 14, -10.6, 0xe8e8e8); box(g, -1.5, 5, -10.8, 1.5, 13, -10.8, 0xd83a3a); box(g, -5, 7.5, -10.8, 5, 10.5, -10.8, 0xd83a3a); },
    czchute: g => { box(g, -40, 70, -40, 40, 78, 40, 0xe8e8e8); box(g, -44, 64, -44, 44, 70, 44, 0xd87a2a); box(g, -1, 18, -1, 1, 64, 1, 0xcccccc); },
    czbarrel: g => { box(g, -8, 0, -8, 8, 28, 8, 0x4a3426); box(g, -8.5, 6, -8.5, 8.5, 8, 8.5, 0x5a4232); box(g, -8.5, 18, -8.5, 8.5, 20, 8.5, 0x5a4232); box(g, -7, 26, -7, 7, 28, 7, 0xff7a1a); box(g, -4, 28, -4, 4, 30, 4, 0xffc040); box(g, -6, 27, 2, -1, 29, 6, 0xff5010); },
  });
  class Heli extends GAD.Ent {
    constructor(caller, m, at) {
      const ex = (CZ.Z.exits && CZ.Z.exits[Math.floor(Math.random() * CZ.Z.exits.length)]) || { x: 0, z: 0 };
      const from = V().set(ex.x, at.y + 30, ex.z), dir = at.clone().setY(from.y).sub(from); if (dir.lengthSq() < 4) dir.set(1, 0, 0);
      from.addScaledVector(dir.clone().normalize(), -25);
      super('czheli', null, from, { model: 'czheli', upright: true, hp: 999, hitR: 0, melee: false, team: -1 });
      this.bulletproof = true; this.blastproof = true; this.meleeable = false;
      this.rotor = GAD.mesh('czrotor'); G.scene.add(this.rotor);
      this.at = at.clone(); this.m = m; this.caller = caller; this.phase = 'in'; this.hover = 0;
      this.loop = window.SFX && SFX.loop ? SFX.loop('drone', this.pos) : null; if (this.loop) { this.loop.base = 0.12; this.loop.range = 90; }
      this.face(dir);
    }
    face(dir) { if (this.mesh) this.mesh.rotation.y = Math.atan2(-dir.x, -dir.z) + Math.PI; }
    update(dt) {
      super.update(dt);
      const over = this.at.clone().setY(this.at.y + 22);
      if (this.phase === 'in') {
        const d = over.clone().sub(this.pos), L = d.length();
        if (L < 0.6) { this.phase = 'hover'; GAME.noise(this.at, 60, null, 'explosion'); }
        else this.pos.addScaledVector(d.normalize(), Math.min(L, 14 * dt));
      } else if (this.phase === 'hover') {
        if ((this.hover += dt) > 1.2 && !this.dropped) { this.dropped = true; new Crate(this.m, this.at, this.pos.clone().setY(this.pos.y - 1.5)); inbound.delete(this.m); }
        if (this.hover > 3) { this.phase = 'out'; this.out = this.pos.clone().sub(this.at).setY(0); if (this.out.lengthSq() < 0.01) this.out.set(1, 0, 0); this.out.normalize(); this.face(this.out.clone().negate()); }
      } else { this.pos.addScaledVector(this.out, 18 * dt); this.pos.y += 3 * dt; if (this.t > 30 || U.dist3(this.pos, this.at) > 140) { this.destroy('gone'); return; } }
      if (this.mesh) this.mesh.position.copy(this.pos);
      if (this.rotor) { this.rotor.position.copy(this.pos).setY(this.pos.y + 1.8); this.rotor.rotation.y += dt * 24; }
      if (this.loop) this.loop.set(this.pos);
    }
    // (gone before the drop, the place left behind: the package isn't lost, it can be called again)
    destroy(w) { if (this.rotor) { G.scene.remove(this.rotor); this.rotor = null; } if (this.m) { inbound.delete(this.m); if (!this.dropped) this.m.careN = Math.min(2, (this.m.careN || 0) + 1); } super.destroy(w); }
  }
  class Crate extends GAD.Ent {
    constructor(m, at, from) {
      super('czcare', null, from, { model: 'czcare', upright: true, hp: 999, hitR: 0, melee: false, team: -1 });
      this.bulletproof = true; this.blastproof = true; this.meleeable = false;
      this.forWho = m; this.kind = m.care || 'ammo'; this.ground = at.y; this.landed = false; this.label = CZ.CARE_KINDS[this.kind].name;
      this.chute = GAD.mesh('czchute'); G.scene.add(this.chute);
    }
    update(dt) {
      super.update(dt);
      if (!this.landed) {
        this.pos.y = Math.max(this.ground, this.pos.y - 4.5 * dt);
        if (this.pos.y <= this.ground + 0.001) { this.landed = true; if (this.chute) { G.scene.remove(this.chute); this.chute = null; } if (window.SFX) SFX.wood(this.pos); GAME.noise(this.pos, 18, null, 'step'); }
      }
      if (this.mesh) this.mesh.position.copy(this.pos);
      if (this.chute) this.chute.position.copy(this.pos);
    }
    destroy(w) { if (this.chute) { G.scene.remove(this.chute); this.chute = null; } super.destroy(w); }
  }

  /* ---- teammates: call theirs when they need what's in it, and go and open it */
  function needsCare(a) {
    const m = a.cz.m, st = m.st, p = CZ.P && CZ.P(a);
    switch (m.care) {
      case 'ammo': { const mag = (a.w[0] && a.w[0].def.mag) || 20; return (CZ.calRounds ? CZ.calRounds(a, CZ.calOf(a.w[0].id)) : 99) < mag * 1.5; }
      case 'health': return a.hp < 50 || st.bleed >= 2;
      case 'rations': return st.hunger > 70 || st.thirst > 70;
      case 'meds': return (p && p.stress > 65) || st.sick > 30 || st.infection > 45;
    }
    return false;
  }
  OPS2.chain('tick', function (a, dt) {
    if (!CZ.on() || !a.bot || !a.cz || !a.cz.m || GAME.client || a.state !== 'alive') return false;
    if ((a.czCareChk = (a.czCareChk || 0) - dt) > 0) return false;
    a.czCareChk = 3 + Math.random() * 2;
    const m = a.cz.m;
    if (m.careN > 0 && !inbound.has(m) && !fighting(a) && !CZ.sheltered(a) && !G.actors.some(t => t.cz && (t.cz.inf || t.cz.opx) && t.state === 'alive' && U.dist3(t.pos, a.pos) < 20)) {
      a.czCareHeld = (a.czCareHeld || 0) + 4;
      if (needsCare(a) || a.czCareHeld > 600) { a.czCareHeld = 0; CZ.callCare(a); }
    }
    return false;
  });
  /* the squad's goals: a crate that's theirs (or anyone's, if it's just lying there), a fallen teammate a field medic can bring back */
  const hasAmmo = e => !!e.items && Object.keys(e.items).some(k => e.items[k] > 0 && CZ.ITEMS[k] && CZ.ITEMS[k].cat === 'ammo');
  // rounds, or a gun on the floor better than the one they hold
  const worth = (a, e) => hasAmmo(e) || (!!e.czGun && e.items && e.items['gun:' + e.czGun] > 0 && CZ.wantsGun && CZ.wantsGun(a, e.czGun));
  const oGoal = CZ.squadGoal;
  CZ.squadGoal = function (a) {
    if (a.cz && a.cz.m && !fighting(a)) {
      const crate = G.ents.find(e => e.alive && e.type === 'czcare' && e.landed && (e.forWho === a.cz.m || G.time - (e.landT || (e.landT = G.time)) > 90) && U.dist3(e.pos, a.pos) < 60);
      if (crate) return { pos: crate.pos.clone(), kind: 'care', r: 1.4, look: crate.pos.clone(), act: x => { if (crate.alive && x.busy <= 0) { x.busy = 0.8; x.busyLabel = 'OPENING'; setTimeout(() => { if (crate.alive && x.state === 'alive') open(x, crate); }, 700); } } };
      if (CZ.canRevive(a)) {
        const b = G.actors.find(x => revivable(x) && U.dist3(x.pos, a.pos) < 40);
        if (b) { const n = NAV.nearest(b.pos, 3); return { pos: n >= 0 ? NAV.nodePos(n) : b.pos.clone(), kind: 'revive', r: 1.8, look: b.pos.clone(), act: x => { if (x.busy <= 0) CZ.revive(x, b); } }; }
      }
      // rounds lying about (a dropped pack, an infected operator's gear, a fallen teammate's bag): anyone
      // passing within 18 m picks them up, short of ammo or not (any rounds fit any gun), as long as it
      // doesn't take them off from the squad (and they haven't been told to hold)
      const held = CZ.orderOf && a !== CZ.leader() && CZ.orderOf(a) === 'hold';
      if (held && a.czAmmoGrab) { if (a.bot && a.bot.loot === a.czAmmoGrab) a.bot.loot = null; a.czAmmoGrab = null; }
      if (a.bot && !held && G.time > (a.czAmmoGrabT || 0) && CZ.lootGoal) {
        a.czAmmoGrabT = G.time + 0.8;
        const m = a.cz.m, kg = CZ.weight(m), lead = CZ.leader();
        const skip = a.czAmmoSkip || (a.czAmmoSkip = {});
        // one they're already on the way to stays theirs (the way round a wall can be longer than 18 m),
        // unless it's taking too long: then it's left for a minute
        let cur = a.czAmmoGrab;
        if (cur && (!cur.alive || !worth(a, cur) || U.dist3(cur.pos, a.pos) > 45 || (lead && lead !== a && U.dist3(cur.pos, lead.pos) > 45))) cur = null;
        if (cur && G.time - (a.czAmmoGrabSince || G.time) > 30) { skip[cur.cid] = G.time + 60; cur = null; }
        if (kg < CZ.capacity(m) * 1.25) {
          let best = cur, bd = cur ? Math.min(18, U.dist3(cur.pos, a.pos) - 3) : 18;
          for (const e of G.ents) {
            if (e === cur || !e.alive || e.type !== 'czloot' || !worth(a, e) || skip[e.cid] > G.time || (CZ.Z.skip && CZ.Z.skip['loot:' + e.cid] > G.time)) continue;
            if (e.czFullFor && e.czFullFor[a.id] != null && kg >= e.czFullFor[a.id] - 0.3) continue;
            if (G.actors.some(b => b !== a && b.bot && b.bot.loot === e)) continue;
            const d = U.dist3(e.pos, a.pos); if (d > bd || Math.abs(e.pos.y - a.pos.y) > 2.5) continue;
            if (lead && lead !== a && U.dist3(e.pos, lead.pos) > 30) continue;
            bd = d; best = e;
          }
          if (best !== a.czAmmoGrab) {
            if (a.czAmmoGrab && a.bot.loot === a.czAmmoGrab) a.bot.loot = null;
            if (best) { a.czAmmoGrabSince = G.time; if (Math.random() < 0.4) say(a, 'grab', best.czGun ? ["That's a better gun. Mine.", 'Grabbing that ' + DATA.WEAPONS[best.czGun].name + '.'] : ['Ammo here, grabbing it.', 'Rounds. Mine now.', "Somebody's leftovers. Thanks."], 1); }
            a.czAmmoGrab = best;
          }
        } else if (a.czAmmoGrab) { if (a.bot.loot === a.czAmmoGrab) a.bot.loot = null; a.czAmmoGrab = null; }
      }
      const g = a.czAmmoGrab;
      if (a.bot && g && g.alive && worth(a, g)) return CZ.lootGoal(a, g, x => { x.czAmmoGrab = null; });
      if (g && a.bot && a.bot.loot === g) a.bot.loot = null;
      a.czAmmoGrab = null;
    }
    return oGoal.apply(this, arguments);
  };

  /* ================================================================ trash-can fires */
  /* three to five burning drums out in the streets of every place (the same ones each visit): flames,
     the crackle, a glow on the minimap; standing within 3.2 m counts as by a fire for the nerves */
  class Barrel extends GAD.Ent {
    constructor(p) {
      super('czbarrel', null, p, { model: 'czbarrel', upright: true, hp: 999, hitR: 0, melee: false, team: -1 });
      this.bulletproof = true; this.blastproof = true; this.meleeable = false; this.fx = 0;
      this.loop = window.SFX && SFX.loop ? SFX.loop('fire', this.pos) : null; if (this.loop) { this.loop.base = 0.12; this.loop.range = 14; }
    }
    update(dt) {
      super.update(dt);
      if ((this.fx -= dt) <= 0) { this.fx = 0.14; if (window.FX && FX.flames) FX.flames(this.pos.clone().setY(this.pos.y + 0.95), 0.22, 1); }
    }
  }
  CZ.barrels = () => G.ents.filter(e => e.alive && e.type === 'czbarrel');
  CZ.nearBarrel = a => G.ents.some(e => e.alive && e.type === 'czbarrel' && U.dist3(e.pos, a.pos) < 3.2);
  CZ.listen('enter', zid => {
    if (!CZ.S || !CZ.Z || CZ.Z.guest) return;
    const st = CZ.zoneState(zid);
    if (!st.barrels) {
      st.barrels = [];
      const nodes = (window.OPS3 && OPS3.navNodes ? OPS3.navNodes() : []).map(n => NAV.nodePos(n)).filter(p => !G.map.inside(p) && G.world.outdoor(p.clone().setY(p.y + 1)));
      const want = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < 200 && st.barrels.length < want && nodes.length; k++) {
        const p = nodes[Math.floor(Math.random() * nodes.length)];
        if (CZ.Z.exits.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 8)) continue;
        if (st.barrels.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 18)) continue;
        if (CZ.doorAt && CZ.doorAt(p)) continue;
        st.barrels.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
      }
    }
    for (const b of st.barrels) new Barrel(V().set(b.x, b.y, b.z));
  });
})();
