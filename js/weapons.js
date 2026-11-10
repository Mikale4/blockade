/* weapons.js -- firing, ballistics (penetration through soft voxels), damage,
   reloads, swaps and melee. Shared by the player and bots.              */
(function () {
  'use strict';
  const { MAT, M, OOB, WEAPONS } = DATA;
  const WPN = {};
  const D2R = Math.PI / 180;
  const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpP = new THREE.Vector3();

  WPN.canAds = a => a.state === 'alive' && !a.vault && !(a.sprint && a.moving > 3.4 && a.mf > 0.3) && !(a.shieldOp && a.shieldUp) && a.busy <= 0;

  WPN.update = function (a, dt) {
    const w = a.wpn; if (!w) return;
    w.cool -= dt; a.swap = Math.max(0, a.swap - dt);
    w.bloom = Math.max(0, w.bloom - dt * (a.trigger ? 1.5 : 6));
    if (a.sprint && a.mf > 0.3 && a.moving > 3.4) a.sprintT = 0.18; else a.sprintT = Math.max(0, a.sprintT - dt);
    const adsT = w.def.adsT || 0.25;
    const want = a.adsWant && WPN.canAds(a);
    a.ads = U.clamp(a.ads + (want ? dt : -dt) / adsT, 0, 1);
    if (w.reload > 0) {
      w.reload -= dt;
      if (w.def.shell) {
        if (w.reload <= 0) {
          if (w.reserve > 0 && w.mag < w.def.mag) { w.mag++; w.reserve--; SFX.reload(a.pos, a === PLAYER.viewActor(), 1); }
          if (w.mag < w.def.mag && w.reserve > 0) w.reload = w.def.shell; else w.reload = 0;
        }
        if (a.trigger && w.mag > 0 && w.reload > 0.1) w.reload = 0;
      } else if (w.reload <= 0) {
        const cap = w.def.mag + (w.mag > 0 ? 1 : 0);
        const n = Math.min(cap - w.mag, w.reserve); w.mag += n; w.reserve -= n; w.reload = 0;
        SFX.reload(a.pos, a === PLAYER.viewActor(), 1);
      } else if (w.reload < w.reloadMax * 0.55 && !w.midSnd) { w.midSnd = true; SFX.reload(a.pos, a === PLAYER.viewActor(), 0); }
    }
    if (!a.trigger) { w.semiLock = false; w.clicked = false; }
    if (a.trigger && a.state === 'alive') {
      if (w.reload > 0 || a.swap > 0 || a.vault || a.busy > 0 || a.sprintT > 0 || w.cool > 0) return;
      if (a.shieldOp && a.shieldUp && a.ads > 0.5) return;
      if (w.mag <= 0) {
        if (!w.clicked) { if (a.isPlayer) SFX.empty(); w.clicked = true; }
        if (w.reserve > 0) WPN.reload(a);
        return;
      }
      if (w.semiLock) return;
      WPN.fire(a);
      if (!w.auto) w.semiLock = true;
    }
  };

  WPN.reload = function (a) {
    const w = a.wpn; if (!w || w.reload > 0 || w.reserve <= 0 || a.state !== 'alive') return;
    const cap = w.def.mag + (w.def.shell ? 0 : 1);
    if (w.mag >= (w.def.shell ? w.def.mag : cap) || (!w.def.shell && w.mag >= w.def.mag)) return;
    if (w.def.shell) w.reload = w.def.shell + 0.25;
    else w.reload = w.mag > 0 ? w.def.reload : w.def.reloadE;
    w.reloadMax = w.reload; w.midSnd = false;
    SFX.reload(a.pos, a === PLAYER.viewActor(), 0);
    GAME.noise(a.pos, 6, a, 'reload');
  };
  WPN.swap = function (a, i) {
    if (i === a.cur || !a.w[i] || a.state !== 'alive') return;
    a.wpn.reload = 0; a.cur = i;
    a.swap = /PISTOL|MP/.test(a.wpn.def.type) ? 0.35 : 0.55;
    if (a.rig) MD.setRigGun(a.rig, a.wpn.id);
    SFX.reload(a.pos, a.isPlayer, 0);
  };

  function spreadDir(f, deg, out) {
    if (deg <= 0) return out.copy(f);
    const ang = deg * D2R * Math.sqrt(Math.random()), rot = Math.random() * Math.PI * 2;
    // build a basis around f
    const up = Math.abs(f.y) < 0.95 ? tmpP.set(0, 1, 0) : tmpP.set(1, 0, 0);
    const r = new THREE.Vector3().crossVectors(f, up).normalize();
    const u = new THREE.Vector3().crossVectors(r, f).normalize();
    const s = Math.sin(ang);
    return out.copy(f).multiplyScalar(Math.cos(ang)).addScaledVector(r, Math.cos(rot) * s).addScaledVector(u, Math.sin(rot) * s).normalize();
  }
  WPN.spreadNow = function (a) {
    const w = a.wpn, d = w.def;
    let s = U.lerp(d.hip, d.ads, a.ads) + w.bloom;
    const mv = Math.min(1, (a.moving || 0) / 3);
    s += mv * (d.type === 'SG' ? 0.6 : 1.6) * (1 - a.ads * 0.6);
    if (a.stance === 1) s *= 0.85; else if (a.stance === 2) s *= 0.7;
    if (!a.onGround && !a.rappel) s += 2;
    if (a.stun > 0) s += 2.5;
    if (a.isBot) s += a.bot ? a.bot.extraSpread || 0 : 0;
    return s;
  };

  WPN.fire = function (a) {
    const w = a.wpn, d = w.def;
    if (GAME.client && a === G.player) return clientFire(a);
    w.mag--; w.cool = 60 / d.rpm;
    const e = a.eye(tmpO.clone()), f = a.fwd();
    const s = WPN.spreadNow(a);
    let endP = null;
    for (let i = 0; i < d.pellets; i++) {
      const dir = spreadDir(f, s, new THREE.Vector3());
      const r = WPN.trace(a, e, dir, d, d.pellets > 1 ? 40 : 140, 1);
      if (i === 0 || Math.random() < 0.3) endP = r;
      if (i < 3 && (a !== PLAYER.viewActor() || d.pellets > 1 || Math.random() < 0.5)) FX.tracer(muzzlePos(a), r, a.team === (G.player ? G.player.team : 0) ? 0xffe8a0 : 0xffb070);
    }
    if (d.type !== 'SG') w.bloom = Math.min(4, w.bloom + 0.28 * (1 - a.ads * 0.55));
    a.lastShot = G.time; MUSIC.lastShot = G.time;
    const local = a === PLAYER.viewActor();
    SFX.shot(d, e, local);
    GAME.noise(e, 45, a, 'shot');
    if (local) PLAYER.onFire(d);
    else NP.quiet(() => FX.flash(muzzlePos(a), 0.4, 0.04));
    if (NP.active && NP.host) NP.push({ k: 'shot', s: a.id, o: [e.x, e.y, e.z].map(v => Math.round(v * 100) / 100), e: [[endP.x, endP.y, endP.z].map(v => Math.round(v * 100) / 100)], w: d.id });
  };
  /* a guest's own shot: drawn here at once, traced and judged by the host */
  function clientFire(a) {
    const w = a.wpn, d = w.def;
    w.mag--; w.cool = 60 / d.rpm;
    const e = a.eye(new THREE.Vector3()), f = a.fwd(), s = WPN.spreadNow(a), dirs = [];
    for (let i = 0; i < d.pellets; i++) {
      const dir = spreadDir(f, s, new THREE.Vector3()); dirs.push(dir);
      if (i < 3) {
        const h = G.world.raycast(e, dir, d.pellets > 1 ? 40 : 140, true);
        const end = h ? new THREE.Vector3(h.px, h.py, h.pz) : e.clone().addScaledVector(dir, 140);
        FX.tracer(muzzlePos(a), end, 0xffe8a0);
        if (h && i === 0 && h.m !== DATA.OOB) FX.dust(end, h.nx, h.ny, h.nz, h.m);
      }
    }
    if (d.type !== 'SG') w.bloom = Math.min(4, w.bloom + 0.28 * (1 - a.ads * 0.55));
    a.lastShot = G.time;
    SFX.shot(d, e, true); PLAYER.onFire(d);
    NP.shot(e, dirs, d.id);
  }
  function muzzlePos(a) {
    const e = a.eye(new THREE.Vector3()), f = a.fwd(tmpD), r = a.right(new THREE.Vector3());
    return e.addScaledVector(f, 0.55).addScaledVector(r, 0.12).add(new THREE.Vector3(0, -0.1, 0));
  }
  WPN.muzzlePos = muzzlePos;

  /* falloff multiplier */
  function falloff(d, dist) { if (dist <= d.f0) return 1; if (dist >= d.f1) return d.fmin; return U.lerp(1, d.fmin, (dist - d.f0) / (d.f1 - d.f0)); }

  /* ray vs axis-aligned box: entry t or -1 */
  function rayBox(o, dd, b, maxT) {
    let t0 = 0, t1 = maxT;
    for (const [oa, da, lo, hi] of [[o.x, dd.x, b.x0, b.x1], [o.y, dd.y, b.y0, b.y1], [o.z, dd.z, b.z0, b.z1]]) {
      if (Math.abs(da) < 1e-8) { if (oa < lo || oa > hi) return -1; continue; }
      let a = (lo - oa) / da, c = (hi - oa) / da; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
    }
    return t0;
  }
  WPN.rayBox = rayBox;
  /* ray vs a carried shield (a vertical rectangle in front of the carrier) */
  function rayShield(o, dd, a, maxT) {
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const cx = a.pos.x + fx * 0.42, cz = a.pos.z + fz * 0.42, cy = a.pos.y + a.h * 0.52;
    const denom = dd.x * fx + dd.z * fz;
    if (Math.abs(denom) < 1e-4) return -1;
    const t = ((cx - o.x) * fx + (cz - o.z) * fz) / denom;
    if (t < 0 || t > maxT) return -1;
    const px = o.x + dd.x * t - cx, py = o.y + dd.y * t - cy, pz = o.z + dd.z * t - cz;
    const lat = Math.abs(px * fz - pz * fx);
    return (lat < 0.34 && Math.abs(py) < a.h * 0.46) ? t : -1;
  }
  WPN.rayShield = rayShield;

  /* walk a bullet: returns end point */
  WPN.trace = function (shooter, o, dir, d, range, mulIn) {
    const W = G.world;
    const hits = [];
    for (const a of G.actors) {
      if (a === shooter || a.state === 'dead') continue;
      const h = a.rayHit(o, dir, range);
      if (h) hits.push({ a, t: h.t, part: h.part });
      if (a.shieldOp && a.shieldUp && a.alive) { const t = rayShield(o, dir, a, range); if (t >= 0) hits.push({ shieldOf: a, t }); }
    }
    for (const e of G.ents) {
      if (!e.alive || e.owner === shooter && e.passOwner) continue;
      let t = -1;
      if (e.hitBox) t = rayBox(o, dir, e.hitBox, range);
      else if (e.hitR) {
        const ox = o.x - e.pos.x, oy = o.y - e.pos.y, oz = o.z - e.pos.z, b = ox * dir.x + oy * dir.y + oz * dir.z, c = ox * ox + oy * oy + oz * oz - e.hitR * e.hitR, disc = b * b - c;
        if (disc >= 0) { t = -b - Math.sqrt(disc); if (t < 0 || t > range) t = -1; }
      }
      if (t >= 0) hits.push({ e, t });
    }
    hits.sort((x, y) => x.t - y.t);
    let mul = mulIn || 1, hi = 0, endT = range, stopped = false;
    const apply = h => {
      const p = tmpP.copy(o).addScaledVector(dir, h.t);
      if (h.shieldOf) { FX.sparks(p, -dir.x, -dir.y, -dir.z); SFX.impact(p, false); return true; }
      if (h.e) {
        const dmg = d.dmg * mul;
        h.e.shot && h.e.shot(dmg, shooter, p, d);
        if (h.e.stopBullets !== false) { FX.sparks(p, -dir.x, -dir.y, -dir.z, 0xa0d8ff); return true; }
        return false;
      }
      const a = h.a, dist = h.t;
      let dmg = d.dmg * falloff(d, dist) * mul;
      let head = false;
      if (h.part === 'head') { if (d.pellets > 1) dmg *= d.headMul || 2; else { dmg = 500; } head = true; }
      else if (h.part === 'limb') dmg *= 0.75;
      const wasAlive = a.state;
      a.hurt(Math.round(dmg), { src: shooter, head, kind: 'bullet', dir });
      if (!a.hostage || true) FX.blood(p, dir);
      if (shooter && shooter.isPlayer && a.team !== shooter.team) HUD.hitmarker(head, a.state !== wasAlive);
      else if (shooter && shooter.net && a.team !== shooter.team) NP.push({ k: 'hit', to: shooter.net, h: head, x: a.state !== wasAlive });
      if (shooter && shooter.isPlayer && a.dummy) HUD.hitmarker(head, false);
      return true;
    };
    W.visit(o, dir, range, (m, x, y, z, t, nx, ny, nz) => {
      while (hi < hits.length && hits[hi].t < t) { if (apply(hits[hi])) { endT = hits[hi].t; stopped = true; return true; } hi++; }
      if (m === OOB) { endT = t; stopped = true; return true; }
      const md = MAT[m];
      const p = tmpP.set(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
      if (md.see) { W.breakVoxel(x, y, z); SFX.glass(p); mul *= 0.95; return false; }
      if (md.hp < 255) {
        const broke = W.hitVoxel(x, y, z, d.destr || 1);
        if (broke && md.melee) SFX.wood(p, true);
      }
      if (md.pen > 0 && mul * md.pen > 0.18) {
        if (Math.random() < 0.5) FX.dust(p, nx, ny, nz, m);
        mul *= md.pen; return false;
      }
      endT = t; stopped = true;
      if (md.reinf || m === M.METAL || m === M.PIPE || m === M.RAIL) FX.sparks(p, nx, ny, nz); else FX.dust(p, nx, ny, nz, m);
      if (Math.random() < 0.35) SFX.impact(p, !md.reinf);
      return true;
    });
    if (!stopped || true) {
      while (hi < hits.length && hits[hi].t <= endT) { if (apply(hits[hi])) { endT = hits[hi].t; break; } hi++; }
    }
    return new THREE.Vector3().copy(o).addScaledVector(dir, endT);
  };

  /* melee: hits a body in front, or smashes soft voxels / gadgets */
  WPN.melee = function (a) {
    if (a.state !== 'alive' || a.meleeT > G.time || a.vault) return;
    a.meleeT = G.time + 0.85;
    const e = a.eye(new THREE.Vector3()), f = a.fwd(new THREE.Vector3());
    SFX.melee(e); GAME.noise(e, 10, a, 'melee');
    if (a.isPlayer) PLAYER.onMelee();
    // bodies
    let best = null, bd = 1.7;
    for (const b of G.actors) {
      if (b === a || b.state === 'dead') continue;
      const c = b.center(new THREE.Vector3()); const to = c.clone().sub(e); const dist = to.length();
      if (dist > bd) continue;
      to.normalize(); if (to.dot(f) < 0.7) continue;
      if (!G.world.los(e, c)) continue;
      best = b; bd = dist;
    }
    if (best) {
      if (best.shieldOp && best.shieldUp && rayShield(e, f, best, 2) >= 0) { best.stun = Math.max(best.stun, 0.6); SFX.metal(e); return; }
      best.hurt(a.shieldOp ? 35 : 70, { src: a, kind: 'melee', dir: f });
      if (a.shieldOp) best.stun = Math.max(best.stun, 1.2);
      if (a.isPlayer) HUD.hitmarker(false, best.state === 'dead'); else if (a.net) NP.push({ k: 'hit', to: a.net, h: false, x: best.state === 'dead' });
      return;
    }
    // gadgets
    for (const g of G.ents) if (g.alive && g.meleeable && U.dist3(g.pos, e) < 1.8) { const to = g.pos.clone().sub(e).normalize(); if (to.dot(f) > 0.6) { g.destroy('melee'); return; } }
    // voxels
    const hit = G.world.raycast(e, f, 1.8);
    if (hit && hit.m !== OOB && MAT[hit.m].melee) {
      const X = hit.x, Y = hit.y, Z = hit.z, r = 2;
      const n = G.world.carve(X - r, Y - r, Z - r, X + r, Y + r, Z + r, md => md.melee, 10);
      if (n) { SFX.wood(new THREE.Vector3(hit.px, hit.py, hit.pz), true); GAME.noise(e, 18, a, 'breach'); }
    } else if (hit) FX.dust(new THREE.Vector3(hit.px, hit.py, hit.pz), hit.nx, hit.ny, hit.nz, hit.m);
  };

  window.WPN = WPN;
})();
