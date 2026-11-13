/* ============================================================================
   persona.js -- WHO A BOT IS.

   Every bot seat in a match is a player with a playstyle: an archetype (Entry
   Fragger, Tactician, Anchor, Support, Flanker, Marksman, Opportunist, Lurker),
   one of that archetype's variations, and its own traits on top. The seat keeps
   all of it for the whole match, with its name and looks.

   The TRAITS (0..1 unless noted) are what ai.js reads when it decides:
     aggr      aggression: takes fights, pushes, chases what it hears
     caution   moves carefully, slices doorways, checks corners
     conf      confidence: keeps fighting when hurt or outnumbered
     risk      risk tolerance: takes 1-v-2s, crosses open ground
     react     reaction time multiplier (0.8 sharp .. 1.25 slow)
     patience  holds long, waits for the moment, moves late
     aware     tactical awareness: pre-aims, listens, turns to unseen fire
     team      teamwork: stays with the team, trades, revives, covers
     range     preferred fight distance, metres
     repos     willingness to move after giving a position away
     cover     preference for cover and leaning
     stealth   walks quietly, takes the long way round
   A variation also has FLAGS for things a number can't say (slices every
   doorway, follows the entry to trade, shifts between angles, goes in late...).

   The archetype also has a TASTE in operators (by what their abilities do),
   guns (by type, range and handling) and gadgets. Each seat picks two "mains"
   per side from the operators that suit it, so the same bot tends to play the
   same few, and picks are weighted, not fixed, so nothing is ever certain.

     PERSONA.make(teamPersonas)       a new persona, varied against its team
     PERSONA.chooseOp(p, side, taken, teamOps, banned)
     PERSONA.loadout(p, op)           { primary, secondary, gadget }
     PERSONA.label(p)                 'ENTRY FRAGGER · Relentless'
   ========================================================================== */
(function () {
  'use strict';
  const T = (aggr, caution, conf, risk, react, patience, aware, team, range, repos, cover, stealth) => ({ aggr, caution, conf, risk, react, patience, aware, team, range, repos, cover, stealth });

  /* ---------------------------------------------------------------- archetypes */
  const STYLES = {
    entry: {
      name: 'ENTRY FRAGGER', short: 'ENTRY', w: 1.2,
      desc: 'Takes the first fight. Pushes, swings wide, closes the distance.',
      base: T(0.85, 0.25, 0.8, 0.75, 0.9, 0.2, 0.5, 0.45, 7, 0.5, 0.3, 0.1),
      variants: [
        { name: 'Relentless', desc: 'never stops pressuring', d: { aggr: 0.1, patience: -0.15, cover: -0.15, conf: 0.1 }, f: { chaseAll: 1 } },
        { name: 'Calculated', desc: 'pushes behind utility, at the right moment', d: { aggr: -0.15, aware: 0.25, cover: 0.3, patience: 0.2 }, f: { utilFirst: 1 } },
        { name: 'Point-blank', desc: 'lives at shotgun range', d: { range: -3.5, risk: 0.1 }, f: { closeQuarters: 1 } },
      ],
      ops: { entry: 3, flash: 2, flush: 2, roam: 2.5, mobile: 1, breach: 1, pick: 1, shield: 1.2, hard: 0.5 },
      guns: { SMG: 2, SG: 2, AR: 1, LMG: 0.3, DMR: -1.5, PISTOL: -1, MP: 0.8 },
      gadgets: { stun: 2, stim: 2, frag: 1.5, breach: 1.2, impact: 2, c4: 1, claymore: -0.5, emp: 0.5, smoke: 0.3, wire: 0, dshield: -0.5, alarm: 0, fog: 0 },
    },
    tactical: {
      name: 'TACTICIAN', short: 'TACTICAL', w: 1.1,
      desc: 'Methodical. Clears room by room, uses cover and leans, picks its fights.',
      base: T(0.4, 0.8, 0.6, 0.35, 1.0, 0.65, 0.85, 0.6, 12, 0.5, 0.85, 0.55),
      variants: [
        { name: 'Room Clearer', desc: 'slices every doorway and checks every corner', d: { caution: 0.1, aware: 0.1, range: -3 }, f: { slice: 1 } },
        { name: 'Angle Control', desc: 'takes a sightline and owns it', d: { patience: 0.15, range: 4, repos: -0.15 }, f: { holdLines: 1 } },
        { name: 'Intel First', desc: 'waits for information before it moves', d: { aware: 0.1, team: 0.15, aggr: -0.1 }, f: { waitIntel: 1, slice: 1 } },
      ],
      ops: { intel: 2.5, utility: 2, trap: 1.5, team: 1, hold: 1, denial: 1, long: 0.5 },
      guns: { AR: 2, SMG: 1.2, DMR: 1, LMG: 1, SG: 0.4, PISTOL: 0, MP: 0.5 },
      gadgets: { stun: 1.5, emp: 2, breach: 1.5, claymore: 1.5, alarm: 2, wire: 1.5, dshield: 1, smoke: 1, frag: 0.8, stim: 0.5, impact: 0.8, c4: 0.5, fog: 1 },
    },
    anchor: {
      name: 'ANCHOR', short: 'ANCHOR', w: 1.0,
      desc: 'Holds the important ground. Sets an angle, keeps its body hidden, does not leave without a reason.',
      base: T(0.2, 0.7, 0.7, 0.3, 0.95, 0.9, 0.7, 0.5, 9, 0.2, 0.9, 0.4),
      variants: [
        { name: 'Bedrock', desc: 'never leaves the spot', d: { patience: 0.1, repos: -0.15 }, f: { bedrock: 1 } },
        { name: 'Shifter', desc: 'keeps changing angles', d: { repos: 0.5, patience: -0.2 }, f: { shift: 1 } },
        { name: 'Last Line', desc: 'deep in the site, close range', d: { range: -4, cover: 0.1, aggr: -0.1 }, f: { deep: 1, closeQuarters: 1 } },
      ],
      ops: { hold: 3, hard: 2, cover: 2, trap: 1.5, denial: 1.5, shield: 1.5, heal: 0.5, team: 0.5 },
      guns: { LMG: 2, SG: 1.5, AR: 1.5, SMG: 1, DMR: 0.8, PISTOL: 0, MP: 0.5 },
      gadgets: { dshield: 2.5, wire: 2, impact: 1, alarm: 1.5, c4: 0.5, fog: 1, smoke: 1, claymore: 1.5, stun: 1, frag: 0.5, breach: 0.5, emp: 0.5, stim: 1 },
    },
    support: {
      name: 'SUPPORT', short: 'SUPPORT', w: 1.0,
      desc: 'Plays for the team: covering fire, trades, revives, stays close.',
      base: T(0.4, 0.55, 0.6, 0.4, 1.0, 0.55, 0.65, 0.95, 11, 0.45, 0.65, 0.25),
      variants: [
        { name: 'Trade Partner', desc: 'a step behind the entry, ready to trade', d: { aggr: 0.15, range: -3 }, f: { trade: 1 } },
        { name: 'Medic', desc: 'revives first, shoots second', d: { team: 0.05, caution: 0.1 }, f: { medic: 1 } },
        { name: 'Overwatch', desc: 'covers the team\'s pushes from behind', d: { range: 5, cover: 0.15, patience: 0.1 }, f: { overwatch: 1 } },
      ],
      ops: { team: 3, heal: 3, cover: 1.5, intel: 1, flash: 1, utility: 1, denial: 0.5 },
      guns: { AR: 2, LMG: 1.5, SMG: 1.2, SG: 0.4, DMR: 0.5, PISTOL: 0, MP: 0.5 },
      gadgets: { smoke: 2.5, stim: 2, frag: 1, dshield: 1.5, wire: 1.5, fog: 1.5, stun: 1, breach: 1, impact: 1, alarm: 1, emp: 0.8, claymore: 0.5, c4: 0.3 },
    },
    flanker: {
      name: 'FLANKER', short: 'FLANKER', w: 1.0,
      desc: 'Takes another way round and hits from where nobody is looking.',
      base: T(0.65, 0.45, 0.7, 0.65, 0.95, 0.55, 0.7, 0.2, 8, 0.75, 0.5, 0.7),
      variants: [
        { name: 'Wide Rotator', desc: 'takes the long way round, patiently', d: { patience: 0.25, stealth: 0.15 }, f: { wide: 1 } },
        { name: 'Backdoor', desc: 'a quick cut behind the line', d: { aggr: 0.15, patience: -0.2 }, f: { quick: 1 } },
        { name: 'Vertical', desc: 'comes from the floor above or below', d: { aware: 0.1 }, f: { vertical: 1 } },
      ],
      ops: { flank: 3, mobile: 2, stealth: 2, roam: 2.5, pick: 1, entry: 0.5 },
      guns: { SMG: 2.5, SG: 1.2, AR: 1, LMG: -0.5, DMR: -0.5, PISTOL: 0, MP: 1 },
      gadgets: { claymore: 2.5, stun: 1, emp: 1, alarm: 1.5, c4: 1.5, fog: 1, frag: 1, stim: 1, breach: 0.8, smoke: 0.5, impact: 1, wire: 0.5, dshield: 0 },
    },
    marksman: {
      name: 'MARKSMAN', short: 'MARKSMAN', w: 0.85,
      desc: 'Long sightlines and controlled shots. Moves when it has been found.',
      base: T(0.3, 0.65, 0.65, 0.3, 0.9, 0.8, 0.75, 0.45, 22, 0.55, 0.75, 0.4),
      variants: [
        { name: 'Long Watch', desc: 'one sightline, all round', d: { range: 6, patience: 0.15, repos: -0.2 }, f: { perch: 1 } },
        { name: 'Pick and Move', desc: 'takes a shot, then moves', d: { repos: 0.3, patience: -0.25 }, f: { relocate: 1 } },
      ],
      ops: { long: 3.5, intel: 1, cover: 1, hold: 1, denial: 0.5 },
      guns: { DMR: 3, AR: 1.8, LMG: 1.2, SMG: -0.5, SG: -1.5, PISTOL: 0.5, MP: -0.5 },
      gadgets: { claymore: 2, dshield: 2, alarm: 2, smoke: 1, frag: 1, impact: 1, wire: 1, stun: 0.5, emp: 0.8, breach: 0.5, stim: 0.8, c4: 0.5, fog: 0.5 },
    },
    opportunist: {
      name: 'OPPORTUNIST', short: 'OPPORTUNIST', w: 0.9,
      desc: 'Watches before committing. Picks off the hurt, the distracted and the isolated.',
      base: T(0.5, 0.55, 0.55, 0.45, 1.0, 0.7, 0.8, 0.4, 12, 0.65, 0.6, 0.5),
      variants: [
        { name: 'Vulture', desc: 'joins other people\'s fights and finishes the hurt', d: { aggr: 0.05 }, f: { vulture: 1 } },
        { name: 'Chameleon', desc: 'changes its game to fit the round', d: { aware: 0.1 }, f: { adapt: 1 } },
      ],
      ops: { pick: 3, flush: 1.5, intel: 1.5, trap: 1, stealth: 1, utility: 0.5 },
      guns: { AR: 1.5, SMG: 1.5, SG: 1, DMR: 1, LMG: 0.5, PISTOL: 0, MP: 0.8 },
      gadgets: { frag: 2, impact: 2, c4: 2, claymore: 1, stun: 1, emp: 1, alarm: 1, fog: 1, stim: 1, smoke: 0.5, breach: 0.8, wire: 0.8, dshield: 0.5 },
    },
    lurker: {
      name: 'LURKER', short: 'LURKER', w: 0.75,
      desc: 'Alone and quiet, far from the team. Waits for enemies to pass, then strikes from behind.',
      base: T(0.35, 0.6, 0.6, 0.5, 1.0, 0.9, 0.7, 0.1, 10, 0.6, 0.6, 0.95),
      variants: [
        { name: 'Ghost', desc: 'silent, deep behind the line', d: { stealth: 0.05, aggr: -0.1 }, f: { deepLurk: 1 } },
        { name: 'Late Clock', desc: 'stays hidden until the clock runs down', d: { patience: 0.1 }, f: { late: 1 } },
      ],
      ops: { stealth: 3, roam: 3, flank: 1.5, pick: 1, mobile: 1 },
      guns: { SMG: 2, SG: 1, AR: 0.8, LMG: -0.5, DMR: 0, PISTOL: 0, MP: 1 },
      gadgets: { claymore: 2, alarm: 2.5, c4: 1.5, fog: 2, emp: 1, stun: 1, frag: 1, impact: 1, stim: 1, smoke: 0.3, breach: 0.3, wire: 0.5, dshield: 0 },
    },
  };

  /* what each operator brings, by what its ability and kit actually do */
  const OP_TAGS = {
    kiln: ['breach', 'hard', 'team'], torque: ['breach', 'utility'], rivet: ['breach', 'entry', 'mobile'], glare: ['flash', 'entry', 'team'],
    crag: ['shield', 'entry', 'hold'], marlow: ['long', 'intel'], halcyon: ['heal', 'team'], vesper: ['intel', 'team'],
    static: ['utility', 'team', 'intel'], quill: ['intel', 'utility'], pike: ['denial', 'team', 'long'], brace: ['cover', 'team'],
    haze: ['flush', 'entry'], wraith: ['stealth', 'flank', 'mobile'], gaff: ['entry', 'pick'], splice: ['utility', 'flank'],
    tusk: ['entry', 'hard', 'breach'], dynamo: ['entry', 'mobile', 'flank'], triad: ['long', 'intel'],
    anvil: ['hold', 'hard'], okafor: ['hold', 'team'], brick: ['hold', 'hard', 'cover'], tamsin: ['heal', 'team', 'hold'],
    sable: ['trap', 'hold'], kestrel: ['intel', 'mobile', 'pick'], morrow: ['utility', 'hold', 'team'], juno: ['intel', 'team'],
    hollis: ['denial', 'hold'], rhea: ['flank', 'utility'], lark: ['roam', 'stealth', 'mobile', 'flank'], seam: ['team', 'hold', 'cover'],
    lumen: ['denial', 'hold', 'long'], nox: ['stealth', 'roam', 'flank'], moor: ['roam', 'entry'], warden: ['long', 'hold'],
    ferro: ['trap', 'pick', 'utility'], mimic: ['pick', 'stealth', 'trap'], veil: ['stealth', 'roam'],
  };
  const KEYS = ['aggr', 'caution', 'conf', 'risk', 'react', 'patience', 'aware', 'team', 'range', 'repos', 'cover', 'stealth'];
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const jit = s => (Math.random() + Math.random() - 1) * s;   // a soft spread around zero

  const PERSONA = window.PERSONA = { STYLES, OP_TAGS };
  /* a new persona. teamPersonas: the others on its team, so one team isn't five anchors */
  PERSONA.make = function (teamPersonas, forceId) {
    const have = {}; for (const p of teamPersonas || []) have[p.id] = (have[p.id] || 0) + 1;
    let id = forceId;
    if (!STYLES[id]) {
      const ids = Object.keys(STYLES), w = ids.map(k => STYLES[k].w / (1 + 2 * (have[k] || 0)));
      let r = Math.random() * w.reduce((s, x) => s + x, 0); id = ids[ids.length - 1];
      for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) { id = ids[i]; break; } }
    }
    const S = STYLES[id], v = S.variants[Math.floor(Math.random() * S.variants.length)];
    const t = {};
    for (const k of KEYS) {
      let x = S.base[k] + (v.d[k] || 0);
      if (k === 'range') t[k] = Math.max(3, x + jit(2.5));
      else if (k === 'react') t[k] = Math.max(0.8, Math.min(1.25, x + jit(0.08)));
      else t[k] = clamp01(x + jit(0.1));
    }
    return { id, name: S.name, short: S.short, variant: v.name, vdesc: v.desc, f: Object.assign({}, v.f), t, mains: {} };
  };
  PERSONA.label = p => p ? p.name + ' · ' + p.variant : '';
  /* a quick default (a bot taking over a player who left, the range's targets) */
  PERSONA.forBot = a => a.persona || (a.persona = PERSONA.make([]));

  /* ------------------------------------------------------------- operators */
  function opScore(p, op) {
    const S = STYLES[p.id]; let s = 0;
    for (const tag of OP_TAGS[op.id] || []) s += S.ops[tag] || 0;
    // the guns it could carry: an operator with no gun this style likes is a poor fit
    s += Math.max(...op.primaries.map(g => gunScore(p, g))) * 0.35;
    // fast and quiet for those who move a lot; armour for those who stand and hold
    s += (op.speed - 2) * (p.t.aggr + p.t.stealth - p.t.patience) * 0.5;
    s += (op.armor - 2) * (p.t.patience + p.t.cover - p.t.aggr - p.t.stealth) * 0.4;
    return s;
  }
  /* pick an operator: the mains first, a weighted draw over the rest. taken: ops already on
     the team; teamOps: those plus their tags so a team still gets a breacher and a holder */
  PERSONA.chooseOp = function (p, side, taken, teamOps, banned) {
    const pool = DATA.OPS.filter(o => (side === 'any' || o.side === side) && !(taken || []).includes(o.id) && !(banned && banned(o.id)));
    if (!pool.length) return null;
    const key = side === 'any' ? 'any' : side;
    if (!p.mains[key]) {
      // two favourites from the operators that suit this player best (not always the top two)
      const ranked = DATA.OPS.filter(o => side === 'any' || o.side === side).map(o => [o, opScore(p, o) + Math.random() * 1.6]).sort((x, y) => y[1] - x[1]);
      p.mains[key] = ranked.slice(0, 2).map(x => x[0].id);
    }
    const tags = new Set(); for (const id of teamOps || []) for (const tg of OP_TAGS[id] || []) tags.add(tg);
    const n = (teamOps || []).length;
    const w = pool.map(o => {
      let s = opScore(p, o) + (p.mains[key].includes(o.id) ? 1.8 : 0);
      // a team that has gone three picks without a breacher (attack) or a holder (defence) wants one
      if (n >= 2 && side === 'atk' && !tags.has('breach') && (OP_TAGS[o.id] || []).includes('breach')) s += 2;
      if (n >= 2 && side === 'def' && !tags.has('hold') && (OP_TAGS[o.id] || []).includes('hold')) s += 1.5;
      return Math.exp(s * 0.55);
    });
    let r = Math.random() * w.reduce((t, x) => t + x, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };

  /* ------------------------------------------------------------- loadouts */
  function gunScore(p, id) {
    const d = DATA.WEAPONS[id]; if (!d) return -9;
    if (id === 'shield') return 1;   // a shield operator's shield is the point of them
    const S = STYLES[p.id];
    let s = S.guns[d.type] || 0;
    const eff = ((d.f0 || 10) + (d.f1 || 20)) / 2;          // where it still hits hard
    const want = p.t.range * 1.4 + 6;
    s -= Math.abs(Math.log(eff / want)) * 1.2;
    if (d.sight === 'acog') s += p.t.range > 15 ? 0.8 : -0.4;
    if (d.silent) s += (p.t.stealth - 0.5) * 2;
    s += ((d.mob || 1) - 1) * 10 * (p.t.aggr + p.t.stealth - 0.8);
    if (d.pellets > 1 && p.f.closeQuarters) s += 1.5;
    return s;
  }
  const weighted = (items, score, k) => {
    const w = items.map(x => Math.exp(score(x) * (k || 1.2)));
    let r = Math.random() * w.reduce((t, x) => t + x, 0);
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };
  PERSONA.loadout = function (p, op) {
    const S = STYLES[p.id];
    const primary = weighted(op.primaries, g => gunScore(p, g));
    // a sidearm: a machine pistol or a stub shotgun for those who push, a heavy pistol for the patient
    const secondary = weighted(op.secondaries, g => {
      const d = DATA.WEAPONS[g] || {};
      return (d.type === 'MP' || d.type === 'SG' ? p.t.aggr * 1.5 : 0) + (d.dmg > 55 ? (1 - p.t.aggr) * 1.2 + (p.t.range > 15 ? 0.6 : 0) : 0) + (d.rpm > 1000 ? p.t.aggr : 0);
    });
    const gadget = weighted(op.gadgets, g => S.gadgets[g] || 0, 1.0);
    const att = {};
    for (const g of [primary, secondary]) { const a = PERSONA.attachments(p, g); if (Object.keys(a).length) att[g] = a; }
    return { primary, secondary, gadget, att };
  };

  /* -------------------------------------------------------------- attachments */
  /* what each playstyle reaches for (on top of what its traits say: see attScore) */
  const ATT_TASTE = {
    entry: { iron: 0.5, reflex: 1, red: 0.8, holo: 0.6, acog: -1, var: -0.8, agrip: 1, laser: 0.8, fmag: 1, comp: 0.5, flash: 0.4 },
    tactical: { red: 0.8, holo: 0.8, var: 1, flash: 1, sup: 0.5, vgrip: 0.6, agrip: 0.6, xmag: 0.3, fmag: 0.3 },
    anchor: { acog: 0.8, holo: 0.8, red: 0.5, comp: 1, vgrip: 1.2, xmag: 1.2, choke: 0.6 },
    support: { holo: 1, red: 0.6, comp: 1.2, vgrip: 1.2, xmag: 1.2, flash: 0.5 },
    flanker: { reflex: 0.8, red: 0.6, sup: 1.5, agrip: 0.8, fmag: 0.8, laser: -0.8 },
    marksman: { acog: 1.2, scope4: 1.5, var: 1.2, brake: 1, ext: 1, agrip: 0.5, xmag: 0.8, laser: -1 },
    opportunist: { red: 0.6, holo: 0.6, var: 0.6, sup: 0.8, ext: 0.6, laser: 0.3, xmag: 0.5 },
    lurker: { red: 0.8, reflex: 0.6, sup: 2, agrip: 0.6, flash: 0.6, laser: -1.5 },
  };
  function attScore(p, gid, slot, id) {
    const t = p.t, W = DATA.WEAPONS[gid];
    let s = (ATT_TASTE[p.id] || {})[id] || 0;
    if (slot === 'optic') {
      // magnification to suit the distance it likes to fight at; quick sights for the aggressive
      const sight = id ? ATT.LIST[id].sight : W.sight, z = ATT.zoom(sight);
      const want = t.range > 20 ? 3 : t.range > 13 ? 2 : t.range > 8 ? 1.25 : 1.1;
      s -= Math.abs(Math.log(z / want)) * 2;
      if (sight === 'iron' || sight === 'reflex') s += t.aggr * 0.6;
      return s;
    }
    if (!id) return -0.3 + t.patience * 0.2 - t.aggr * 0.2;   // some leave a slot empty
    if (id === 'sup') s += (t.stealth - 0.4) * 3;
    if (id === 'comp' || id === 'vgrip') s += (t.patience + t.team) * 0.6 - 0.4;   // sustained fire
    if (id === 'brake') s += t.range > 15 ? 0.8 : -0.2;
    if (id === 'ext') s += (t.range - 12) / 10;
    if (id === 'agrip') s += t.aggr * 1.2 - 0.3;
    if (id === 'laser') s += (t.aggr - t.stealth) * 1.2 - (t.range > 12 ? 0.8 : 0);
    if (id === 'flash') s += t.stealth * 0.8 + t.caution * 0.4 - 0.3;
    if (id === 'xmag') s += (t.patience + t.team) * 0.7 - 0.5;
    if (id === 'fmag') s += t.aggr * 0.9 - 0.3;
    if (id === 'choke') s += p.f.closeQuarters ? -0.3 : 0.5;
    return s;
  }
  /* a bot's setup for a gun: decided once per gun and kept for the match */
  PERSONA.attachments = function (p, gid) {
    p.att = p.att || {};
    if (p.att[gid]) return p.att[gid];
    const out = {}, W = DATA.WEAPONS[gid];
    if (W && window.ATT) for (const s of ATT.SLOTS) {
      const fits = ATT.fits(gid, s); if (!fits.length) continue;
      const opts = [null].concat(fits.filter(x => !(s === 'optic' && ATT.LIST[x].sight === W.sight)));
      const pick = weighted(opts, x => attScore(p, gid, s, x), 1.3);
      if (pick) out[s] = pick;
    }
    return (p.att[gid] = out);
  };
  PERSONA.attScore = attScore;
  PERSONA.gunScore = gunScore; PERSONA.opScore = opScore;
})();
