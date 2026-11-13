/* ============================================================================
   attach.js -- WEAPON ATTACHMENTS.

   Four slots on a gun: OPTIC (replaces its own sight), BARREL, UNDERBARREL
   and MAGAZINE. What fits depends on the kind of gun (a pistol takes no grip,
   a shotgun takes a choke, an integrally suppressed gun no muzzle device).

   An attachment changes the gun's real numbers. ATT.def(id, att) builds the
   gun's EFFECTIVE stats (a copy of DATA.WEAPONS[id] with the changes applied)
   and that copy is what a carried gun reads everywhere (actor.js WState.def):
   recoil climb and sideways kick (rv, rh), hip and aimed spread (hip, ads),
   time to aim (adsT), damage range (f0, f1), magazine size and spares (mag,
   mags), reload times, how fast you move with it (mob), its sight and zoom,
   whether it is suppressed (silent: bots hear it only close by, no tracers
   for the enemy), whether it flashes, and a laser's tighter hip-fire (which
   the enemy can see). Every one comes with a cost: there is no best kit.

     ATT.LIST / ATT.SLOTS          the attachments, the slot order
     ATT.fits(id, slot)            what can go in a slot on that gun
     ATT.clean(id, att)            drop anything that doesn't fit (saved, or off the network)
     ATT.def(id, att)              the effective stats
     ATT.saved(id) / ATT.save(id, att)   a player's setup for a gun (this browser)
     ATT.effects(id, att)          a short list of what changed, for the loadout screen
   ========================================================================== */
(function () {
  'use strict';
  const LIST = {
    // ---- optics (zoom: aiming magnification)
    iron: { slot: 'optic', name: 'IRON SIGHTS', sight: 'iron', mods: { adsT: -0.04 }, desc: 'No glass. The quickest to aim, and nothing hides the room around the target.' },
    reflex: { slot: 'optic', name: 'REFLEX SIGHT', sight: 'reflex', mods: { adsT: -0.02 }, desc: 'A small open dot. Quick on target, very little magnification (1.1x).' },
    red: { slot: 'optic', name: 'RED DOT', sight: 'red', mods: {}, desc: 'A clean dot in a short tube (1.2x).' },
    holo: { slot: 'optic', name: 'HOLOGRAPHIC', sight: 'holo', mods: { adsT: 0.01, hipK: -0.06 }, desc: 'A ring and dot that are easy to pick up on the move (1.2x). Slightly steadier from the hip.' },
    acog: { slot: 'optic', name: '2.5x TELESCOPIC', sight: 'acog', mods: { adsT: 0.06, adsK: -0.15 }, desc: 'Magnified for range: tighter aimed fire. Slower to aim, and up close it fills the view.' },
    var: { slot: 'optic', name: '1.5-3x VARIABLE', sight: 'var', mods: { adsT: 0.08, adsK: -0.1 }, desc: 'Switch between 1.5x and 3x while aiming (firemode key). Slow to bring up.' },
    scope4: { slot: 'optic', name: '4x MARKSMAN SCOPE', sight: 'scope4', mods: { adsT: 0.12, adsK: -0.3, mob: -0.02 }, desc: 'Superb at range, the tightest aimed fire. The slowest to aim; heavy.' },
    // ---- barrel
    sup: { slot: 'barrel', name: 'SUPPRESSOR', mods: { rangeK: -0.15, adsT: 0.02 }, flags: { silent: true, noFlash: true }, desc: 'Quiet: bots hear it only close by, the enemy sees no tracers and no flash. Damage falls off sooner.' },
    comp: { slot: 'barrel', name: 'COMPENSATOR', mods: { rhK: -0.4, rvK: 0.05 }, flags: { bigFlash: true }, desc: 'Much less sideways kick; a little more climb. A bigger muzzle flash.' },
    brake: { slot: 'barrel', name: 'MUZZLE BRAKE', mods: { rvK: -0.25, hipK: 0.12 }, flags: { bigFlash: true }, desc: 'Tames the climb of every shot. Looser from the hip, and a bigger flash.' },
    flash: { slot: 'barrel', name: 'FLASH HIDER', mods: { rvK: -0.08, rhK: -0.08 }, flags: { noFlash: true }, desc: 'No muzzle flash: harder to place where the shots come from. A little less kick.' },
    ext: { slot: 'barrel', name: 'EXTENDED BARREL', mods: { rangeK: 0.18, adsT: 0.03, mob: -0.02 }, desc: 'Damage holds out further. Heavier to aim and to carry.' },
    choke: { slot: 'barrel', name: 'TIGHT CHOKE', mods: { hipK: -0.22, adsK: -0.22, rangeK: 0.15, adsT: 0.02 }, desc: 'A narrower spread of pellets that reaches further. Less forgiving up close.' },
    // ---- underbarrel
    vgrip: { slot: 'under', name: 'VERTICAL GRIP', mods: { rvK: -0.18, adsT: 0.01 }, desc: 'Less upward kick on sustained fire.' },
    agrip: { slot: 'under', name: 'ANGLED GRIP', mods: { adsT: -0.06, rvK: 0.04 }, desc: 'Much faster to aim down sights; a touch more climb.' },
    laser: { slot: 'under', name: 'LASER', mods: { hipK: -0.28 }, flags: { laser: true }, desc: 'Tighter hip-fire. The enemy can see the beam while you are not aiming.' },
    // ---- magazine
    xmag: { slot: 'mag', name: 'EXTENDED MAG', mods: { magK: 0.34, reloadK: 0.15, mob: -0.01 }, desc: 'About a third more rounds. A slower reload, a little heavier.' },
    fmag: { slot: 'mag', name: 'QUICK MAG', mods: { reloadK: -0.2, mags: -1 }, desc: 'A faster reload. One spare magazine fewer.' },
  };
  const SLOTS = ['optic', 'barrel', 'under', 'mag'];
  const SLOT_NAMES = { optic: 'OPTIC', barrel: 'BARREL', under: 'UNDERBARREL', mag: 'MAGAZINE' };
  // what fits on each kind of gun
  const FIT = {
    AR: { optic: ['iron', 'reflex', 'red', 'holo', 'acog', 'var'], barrel: ['sup', 'comp', 'brake', 'flash', 'ext'], under: ['vgrip', 'agrip', 'laser'], mag: ['xmag', 'fmag'] },
    SMG: { optic: ['iron', 'reflex', 'red', 'holo', 'acog'], barrel: ['sup', 'comp', 'flash', 'ext'], under: ['vgrip', 'agrip', 'laser'], mag: ['xmag', 'fmag'] },
    LMG: { optic: ['iron', 'red', 'holo', 'acog', 'var'], barrel: ['comp', 'brake', 'flash'], under: ['vgrip'], mag: ['fmag'] },
    DMR: { optic: ['red', 'holo', 'acog', 'var', 'scope4'], barrel: ['sup', 'brake', 'flash', 'ext'], under: ['agrip', 'laser'], mag: ['xmag'] },
    SG: { optic: ['iron', 'reflex', 'red', 'holo'], barrel: ['choke'], under: ['agrip', 'laser'], mag: ['xmag'] },
    PISTOL: { optic: ['iron', 'reflex', 'red'], barrel: ['sup', 'comp'], under: ['laser'], mag: ['xmag'] },
    MP: { optic: ['iron', 'reflex', 'red'], barrel: ['sup', 'comp', 'flash'], under: ['vgrip', 'laser'], mag: ['xmag'] },
  };
  /* guns that are different from their kind */
  const EXCEPT = {
    hush45: { barrel: [] },                                            // suppressed already
    hammer50: { optic: ['acog', 'scope4'], under: ['agrip'] },          // an anti-materiel rifle wears a scope
    slug8: { barrel: ['brake', 'flash'], optic: ['iron', 'reflex', 'red', 'holo', 'acog'] },   // a slug gun reaches out
    stub: { barrel: [], optic: ['iron'], under: ['laser'] },            // a sawn-off sidearm
    maul: { optic: ['iron', 'reflex', 'red'] },
  };
  const ATT = window.ATT = { LIST, SLOTS, SLOT_NAMES };
  ATT.fits = function (id, slot) {
    const d = DATA.WEAPONS[id]; if (!d || d.type === 'SHIELD') return [];
    const x = EXCEPT[id] && EXCEPT[id][slot];
    return (x || (FIT[d.type] || {})[slot] || []).slice();
  };
  /* the default in a slot: a gun's own sight (nothing in the other slots) */
  ATT.stock = id => { const d = DATA.WEAPONS[id] || {}; return { optic: d.sight || 'iron' }; };
  ATT.clean = function (id, att) {
    const out = {};
    if (!att || typeof att !== 'object') return out;
    for (const s of SLOTS) { const v = att[s]; if (typeof v === 'string' && LIST[v] && LIST[v].slot === s && ATT.fits(id, s).includes(v)) out[s] = v; }
    // the gun's own sight is its default: no need to name it
    if (out.optic && out.optic === (DATA.WEAPONS[id] || {}).sight) delete out.optic;
    return out;
  };
  ATT.key = att => att ? SLOTS.map(s => att[s] || '').join(',') : '';
  const cache = new Map();
  ATT.def = function (id, att) {
    const base = DATA.WEAPONS[id];
    att = ATT.clean(id, att);
    const key = ATT.key(att);
    if (!base || key === ',,,') return base;
    const ck = id + '|' + key;
    if (cache.has(ck)) return cache.get(ck);
    const d = Object.assign({}, base), k = { rvK: 0, rhK: 0, hipK: 0, adsK: 0, rangeK: 0, magK: 0, reloadK: 0 };
    d.adsT = d.adsT || 0.25; d.mob = d.mob || 1;
    for (const s of SLOTS) {
      const x = LIST[att[s]]; if (!x) continue;
      for (const [m, v] of Object.entries(x.mods || {})) {
        if (m in k) k[m] += v;
        else if (m === 'adsT') d.adsT = Math.max(0.1, d.adsT + v);
        else if (m === 'mob') d.mob += v;
        else if (m === 'mags') d.mags = Math.max(1, (d.mags || 1) + v);
      }
      if (x.sight) d.sight = x.sight;
      if (x.flags) Object.assign(d, x.flags);
    }
    if (d.rv != null) d.rv *= 1 + k.rvK;
    if (d.rh != null) d.rh *= 1 + k.rhK;
    if (d.hip != null) d.hip *= 1 + k.hipK;
    if (d.ads != null) d.ads *= 1 + k.adsK;
    if (d.f0 != null) { d.f0 *= 1 + k.rangeK; d.f1 *= 1 + k.rangeK; }
    if (k.magK) d.mag = d.shell ? d.mag + 2 : Math.round(d.mag * (1 + k.magK));
    if (d.reload) d.reload *= 1 + k.reloadK;
    if (d.reloadE) d.reloadE *= 1 + k.reloadK;
    if (d.shell) d.shell *= 1 + k.reloadK;
    // how hard it is to keep on target over a burst (bots and bloom read this)
    d.recoilK = ((1 + k.rvK) * 0.6 + (1 + k.rhK) * 0.4);
    d.att = att; d.attKey = key;
    cache.set(ck, d);
    return d;
  };
  /* a player's saved setup for a gun */
  ATT.saved = id => ATT.clean(id, U.store.get('att_' + id, {}));
  ATT.save = (id, att) => U.store.set('att_' + id, ATT.clean(id, att));
  /* what a setup changes, as short lines ('+34% magazine', '-25% climb') */
  ATT.effects = function (id, att) {
    const b = DATA.WEAPONS[id], d = ATT.def(id, att); if (!b || b === d) return [];
    const out = [], pct = (x, y) => Math.round((y / x - 1) * 100);
    const line = (label, x, y, goodUp) => { if (x == null || y == null || Math.abs(y - x) < 1e-6) return; const p = pct(x, y); if (!p) return; out.push({ t: (p > 0 ? '+' : '') + p + '% ' + label, good: goodUp ? p > 0 : p < 0 }); };
    line('vertical recoil', b.rv, d.rv, false); line('horizontal recoil', b.rh, d.rh, false);
    line('hip-fire spread', b.hip, d.hip, false); line('aimed spread', b.ads, d.ads, false);
    line('aim time', b.adsT || 0.25, d.adsT, false); line('damage range', b.f1, d.f1, true);
    line('magazine', b.mag, d.mag, true); line('reload time', b.reload, d.reload, false); line('mobility', b.mob || 1, d.mob, true);
    if ((d.mags || 0) < (b.mags || 0)) out.push({ t: '-1 spare magazine', good: false });
    if (d.silent && !b.silent) out.push({ t: 'suppressed', good: true });
    if (d.noFlash && !b.silent) out.push({ t: 'no muzzle flash', good: true });
    if (d.bigFlash) out.push({ t: 'bigger muzzle flash', good: false });
    if (d.laser) out.push({ t: 'visible laser', good: false });
    if (d.sight !== b.sight) out.push({ t: ATT.zoomText(d.sight) + ' sight', good: true });
    return out;
  };
  ATT.zoomText = s => ({ iron: 'iron', reflex: '1.1x', red: '1.2x', holo: '1.2x', acog: '2.5x', var: '1.5-3x', scope4: '4x' })[s] || s;
  /* the aiming zoom of a sight (player.js uses it for the view; bots for their aim at range) */
  ATT.zoom = (sight, alt) => sight === 'acog' ? (alt ? 4 : 2.5) : sight === 'scope4' ? 4 : sight === 'var' ? (alt ? 3 : 1.5) : sight === 'iron' ? 1.12 : sight === 'reflex' ? 1.1 : 1.22;
  ATT.scoped = s => s === 'acog' || s === 'scope4' || s === 'var';
})();
