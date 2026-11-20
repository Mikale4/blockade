/* cityz-vehicles.js -- City Z: cars. A vehicle stays where you leave it (in the save: which place, where,
   its fuel and its damage). Get in to drive it (the squad near you gets in too), W/S to go and brake,
   A/D to steer, the interact key to get out. Engines are loud: the infected come to the noise. Anyone
   in the way is run down. Driving to a road end takes the whole squad to the next place in a third of
   the time, for fuel. Fuel cans refill it; engine parts repair it. */
(function () {
  'use strict';
  const CZ = window.CZ;
  const V = () => new THREE.Vector3();
  const mesh = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial ? new THREE.MeshLambertMaterial({ color: c }) : new THREE.MeshBasicMaterial({ color: c }));
  Object.assign(GAD.NAMES || {}, { czcar: 'Vehicle' });

  class Car extends GAD.Ent {
    constructor(rec, pos) {
      super('czcar', null, pos, { model: false, hp: 999, hitR: 0, melee: false, team: -1 });
      this.rec = rec; this.def = CZ.VEHICLES[rec.kind]; this.yaw = rec.yaw || 0; this.fuel = rec.fuel; this.hp = rec.hp; this.spd = 0; this.blastproof = false; this.meleeable = false;
      this.L = rec.kind === 'van' ? 4.8 : rec.kind === 'pickup' ? 5 : 4.1; this.Wd = rec.kind === 'van' ? 2.0 : 1.9; this.H = rec.kind === 'van' ? 2.2 : 1.6;
      const g = this.mesh = new THREE.Group(), c = this.def.color;
      const body = new THREE.Mesh(new THREE.BoxGeometry(this.Wd, 0.75, this.L), new THREE.MeshBasicMaterial({ color: c })); body.position.y = 0.7; g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(this.Wd * 0.94, this.H - 1.1, rec.kind === 'van' ? this.L * 0.9 : this.L * 0.5), new THREE.MeshBasicMaterial({ color: 0x9ab0c0 })); cab.position.set(0, 1.07 + (this.H - 1.1) / 2, rec.kind === 'pickup' ? -0.6 : 0.1); g.add(cab);
      if (rec.kind !== 'van') { const roof = new THREE.Mesh(new THREE.BoxGeometry(this.Wd * 0.95, 0.06, this.L * 0.48), new THREE.MeshBasicMaterial({ color: c })); roof.position.set(0, this.H, cab.position.z); g.add(roof); }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.62), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); w.position.set(x * this.Wd * 0.48, 0.31, z * this.L * 0.32); g.add(w); }
      for (const x of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })); l.position.set(x, 0.85, -this.L / 2 - 0.01); g.add(l); }
      G.scene.add(g); this.sync();
      this.riders = [];
    }
    fwd() { return V().set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
    sync() {
      this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw;
      // the box it fills (axis-aligned round its turned footprint): bodies and rounds stop on it
      const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw)), hx = (this.Wd * c + this.L * s) / 2, hz = (this.Wd * s + this.L * c) / 2;
      this.solid = this.hitBox = this.driver ? null : { x0: this.pos.x - hx, x1: this.pos.x + hx, y0: this.pos.y, y1: this.pos.y + this.H * 0.85, z0: this.pos.z - hz, z1: this.pos.z + hz };
      this.passOwner = true;
    }
    shot(dmg) { this.hp -= dmg * 0.12; if (this.hp <= 0) this.wreck(); }
    wreck() {
      if (this.dead) return; this.dead = true;
      GAD.explode(this.pos.clone().setY(this.pos.y + 0.8), 4, 90, null);
      this.mesh.children.forEach(m => m.material && m.material.color && m.material.color.setHex(0x2a2624));
      if (this.driver) CZ.leaveCar(this.driver);
      this.rec.hp = 0; this.hp = 0; this.fuel = 0;
      HUD.toast('The ' + this.def.name + ' is wrecked', 'warn');
    }
    // can it be here? (the four corners and the nose, from knee to roof height, clear of walls)
    clearAt(p, yaw) {
      const f = V().set(-Math.sin(yaw), 0, -Math.cos(yaw)), r = V().set(-f.z, 0, f.x), W = G.world;
      for (const [a, b] of [[0.5, 0.45], [0.5, -0.45], [-0.5, 0.45], [-0.5, -0.45], [0.52, 0], [0, 0.48], [0, -0.48]]) {
        const q = p.clone().addScaledVector(f, a * this.L).addScaledVector(r, b * this.Wd);
        for (const h of [0.6, 1.2]) if (W.get(Math.floor(q.x * 4), Math.floor((p.y + h) * 4), Math.floor(q.z * 4))) return false;
      }
      return true;
    }
    update(dt) {
      this.t += dt;
      if (this.dead) return;
      const d = this.driver;
      if (!d) { this.spd *= Math.pow(0.1, dt); return; }
      if (d.state !== 'alive') { CZ.leaveCar(d); return; }
      // the pedals and the wheel: the player's movement keys
      const go = this.fuel > 0 ? d.mf : 0, steer = d.mr;
      const top = this.def.speed * (go < 0 ? 0.4 : 1) * (this.hp < this.def.hp * 0.3 ? 0.6 : 1);
      const want = go * top;
      const acc = Math.sign(want - this.spd) === Math.sign(this.spd) || !this.spd ? 6 : 12;
      this.spd += U.clamp(want - this.spd, -acc * dt, acc * dt);
      if (!go) this.spd *= Math.pow(0.35, dt);
      this.yaw -= steer * 1.7 * dt * U.clamp(Math.abs(this.spd) / 4, 0, 1) * Math.sign(this.spd || 1);
      const step = this.fwd().multiplyScalar(this.spd * dt);
      if (Math.abs(this.spd) > 0.05) {
        const np = this.pos.clone().add(step);
        const gy = G.world.groundBelow(np.x, this.pos.y + 0.55, np.z);
        np.y = Math.abs(gy - this.pos.y) < 0.6 ? gy : this.pos.y;
        if (gy < this.pos.y - 0.6) np.y = Math.max(gy, this.pos.y - 9.8 * dt * 2);   // off a ledge: drops
        if (this.clearAt(np, this.yaw)) { this.pos.copy(np); this.fuel = Math.max(0, this.fuel - Math.abs(this.spd * dt) * 0.03 * this.def.burn); }
        else { const hit = Math.abs(this.spd); if (hit > 3) { this.hp -= hit * 6; SFX.metal(this.pos); SFX.impact(this.pos, false); GAME.noise(this.pos, 30, d, 'explosion'); d.hurt(hit > 10 ? hit : 0, { kind: 'fall' }); } this.spd = -this.spd * 0.2; if (this.hp <= 0) return this.wreck(); }
      }
      // anyone in front of it, moving: run down
      if (Math.abs(this.spd) > 3) for (const a of G.actors) {
        if (a === d || a.czCar === this || a.state === 'dead' || Math.abs(a.pos.y - this.pos.y) > 1.2) continue;
        if (U.dist2(a.pos, this.pos) > this.L * 0.55) continue;
        const k = Math.abs(this.spd);
        a.hurt(k * 14, { src: d, kind: 'explosion', dir: this.fwd() }); a.vel.addScaledVector(this.fwd(), k * 0.8); a.vel.y += 3;
        this.hp -= 3; SFX.impact(a.pos, true);
      }
      if (this.fuel <= 0 && !this.dry) { this.dry = true; HUD.toast('Out of fuel', 'warn'); }
      // engine noise: carries a long way
      if ((this.noiseT = (this.noiseT || 0) - dt) <= 0) { this.noiseT = 0.5; GAME.noise(this.pos, 26 + Math.abs(this.spd) * 3, d, 'vehicle'); }
      if ((this.humT = (this.humT || 0) - dt) <= 0 && SFX.synth && SFX.ctx) { this.humT = 0.22; const sy = SFX.synth, out = sy.chain(null, 1, 0.12); if (out) sy.tone(out, sy.now(), 0.25, 48 + Math.abs(this.spd) * 7, 40 + Math.abs(this.spd) * 6, 0.5, 'sawtooth'); }
      this.sync();
      for (const r of this.riders) { r.pos.copy(this.pos); r.vel.set(0, 0, 0); }
      d.pos.copy(this.pos).setY(this.pos.y); d.vel.set(0, 0, 0);
    }
  }
  CZ.Car = Car;

  /* ---- in and out */
  CZ.enterCar = function (a, car) {
    if (car.driver || car.dead) return;
    car.driver = a; a.czDriving = car; a.trigger = false; a.ads = 0; a.adsWant = false;
    car.riders = G.actors.filter(x => x !== a && x.cz && x.cz.m && x.state === 'alive' && U.dist3(x.pos, car.pos) < 18).slice(0, car.def.seats - 1);
    for (const r of car.riders) r.czCar = car;
    if (a.isPlayer) HUD.toast('Driving: ' + KEYS.name('forward') + '/' + KEYS.name('back') + ' go and brake, ' + KEYS.name('left') + '/' + KEYS.name('right') + ' steer, ' + KEYS.name('interact') + ' to get out', 'info');
    car.sync(); SFX.metal(car.pos);
  };
  CZ.leaveCar = function (a) {
    const car = a.czDriving; if (!car) return;
    car.driver = null; a.czDriving = null; car.spd = 0;
    const side = V().set(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
    const out = (k, i) => { for (const s of [1, -1, 0]) { const p = car.pos.clone().addScaledVector(side, s * (car.Wd / 2 + 0.8)).addScaledVector(car.fwd(), (i - 1) * 1.1); const n = NAV.nearest(p, 4); if (n >= 0) return NAV.nodePos(n); } return car.pos.clone().setY(car.pos.y + 1.6); };
    a.pos.copy(out(0, 1));
    car.riders.forEach((r, i) => { r.czCar = null; r.pos.copy(out(1, i)); });
    car.riders = []; car.sync(); SFX.metal(car.pos);
  };
  // while in a car: no walking, no falling, not seen as a target by the infected
  OPS2.chain('physics', function (a) { if (a.czDriving || a.czCar) { a.vel.set(0, 0, 0); a.onGround = true; a.sprint = false; a.trigger = false; return true; } return false; });
  const oRig = Actor.prototype.updateRig;
  Actor.prototype.updateRig = function (dt, visible) { oRig.call(this, dt, visible && !this.czDriving && !this.czCar); };
  // the camera: behind and above the car
  const oCam = PLAYER.camera;
  PLAYER.camera = function (dt) {
    oCam.call(this, dt);
    const a = G.player, car = a && a.czDriving; if (!car) return;
    // third person: a chase camera behind and above the car, smoothed on its own (the first-person
    // camera has already been put at the driver's eye this frame, so it can't be the starting point)
    const f = car.fwd(), cam = G.camera, want = car.pos.clone().addScaledVector(f, -7.5).setY(car.pos.y + 3.4);
    if (!car.camPos || car.camPos.distanceTo(want) > 25) car.camPos = want.clone();
    car.camPos.lerp(want, Math.min(1, (dt || 0.016) * 5));
    // not through a wall: pull in toward the car if something is in between
    const from = car.pos.clone().setY(car.pos.y + 1.6), d = car.camPos.clone().sub(from), L = d.length(), h = L > 0.1 ? G.world.raycast(from, d.clone().normalize(), L, true) : null;
    cam.position.copy(h ? from.addScaledVector(d.normalize(), Math.max(1.5, h.dist - 0.3)) : car.camPos);
    cam.lookAt(car.pos.clone().addScaledVector(f, 5).setY(car.pos.y + 1.1));
    if (PLAYER.vm) PLAYER.vm.root.visible = false;
  };

  /* ---- the cars of a place */
  CZ.spawnVehicles = function (zid) {
    const S = CZ.S;
    for (const rec of S.vehicles) {
      if (rec.zone !== zid) continue;
      let p;
      if (rec.atSide) { const e = G.map.exits.find(x => x.side === rec.atSide) || G.map.exits[0], inw = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[e.side]; p = V().set(e.x + inw[0] * 9, e.y, e.z + inw[1] * 9); rec.yaw = Math.atan2(inw[0], inw[1]); delete rec.atSide; }
      else p = V().set(rec.x, 0, rec.z);
      p.y = G.world.groundBelow(p.x, 20, p.z);
      const car = new Car(rec, p);
      if (rec.hp <= 0) { car.dead = true; car.mesh.children.forEach(m => m.material && m.material.color && m.material.color.setHex(0x2a2624)); }
    }
  };
  CZ.carHere = function () { const a = G.player; if (!a) return null; if (a.czDriving) return a.czDriving; return G.ents.find(e => e.alive && e.type === 'czcar' && !e.dead && U.dist3(e.pos, a.pos) < 12) || null; };
  /* drive to the next place: the car, the squad and the fuel go with you */
  CZ.drive = function (car, to) {
    const from = CZ.Z.id, mins = CZ.ZONES[from].links[to], need = Math.ceil(mins * car.def.burn / 3);
    if (car.fuel < need) { HUD.toast('Not enough fuel: ' + Math.floor(car.fuel) + ' of ' + need, 'warn'); return; }
    car.fuel -= need;
    const a = G.player;
    // everyone gets in
    for (const x of G.actors) if (x.cz && x.cz.m && x.state === 'alive') { x.pos.copy(car.pos); }
    if (a.czDriving) CZ.leaveCar(a);
    Object.assign(car.rec, { zone: to, fuel: car.fuel, hp: car.hp, atSide: CZ.sideTo(to, from) || 'S' });
    car.rec.moved = true;
    CZ.travel(to, true);
  };
  // a car rec carried to the new place keeps its new spot (snapZone would write the old one back)
  const oSnap = CZ.snapZone;
  CZ.snapZone = function () { const moved = CZ.S.vehicles.filter(r => r.moved); oSnap(); for (const r of moved) { r.moved = false; } };

  /* ---- what you can do at a car */
  OPS2.chain('interactions', function (a, out) {
    if (!CZ.on() || !a.isPlayer || GAME.client) return;
    const car = a.czDriving;
    if (car) {
      // a road end close by: drive on
      const ex = CZ.exitsOf(CZ.Z.id);
      for (const [to, side] of Object.entries(ex)) { const e = CZ.Z.exits.find(x => x.side === side); if (e && Math.hypot(car.pos.x - e.x, car.pos.z - e.z) < 9) { out.push({ kind: 'drive', label: 'DRIVE TO ' + CZ.ZONES[to].name, time: 0.5, ok: () => true, run: () => CZ.travelMenu(to) }); break; } }
      out.push({ kind: 'car', label: 'GET OUT · FUEL ' + Math.floor(car.fuel) + ' / ' + car.def.fuelMax, time: 0.25, ok: () => true, run: () => CZ.leaveCar(a) });
      return;
    }
    for (const e of G.ents) {
      if (!e.alive || e.type !== 'czcar' || U.dist2(e.pos, a.pos) > e.L * 0.6 + 1) continue;
      const m = a.cz.m;
      if (e.dead) { out.push({ kind: 'car', label: 'STRIP THE WRECK FOR SCRAP', time: 3, ok: () => !e.stripped, run: () => { e.stripped = true; CZ.add(m, 'scrap', 3); HUD.toast('+ 3 Scrap Metal', 'info'); } }); return; }
      if (m.inv.fuel > 0 && e.fuel < e.def.fuelMax - 2) out.push({ kind: 'car', label: 'REFUEL THE ' + e.def.name.toUpperCase() + ' (+12)', time: 2, ok: () => true, run: () => { CZ.take(m, 'fuel', 1); e.fuel = Math.min(e.def.fuelMax, e.fuel + 12); e.dry = false; HUD.toast('Fuel ' + Math.floor(e.fuel) + ' / ' + e.def.fuelMax, 'info'); } });
      if (m.inv.engine > 0 && e.hp < e.def.hp - 20) out.push({ kind: 'car', label: 'REPAIR THE ' + e.def.name.toUpperCase() + ' (ENGINE PARTS)', time: 4, ok: () => true, run: () => { CZ.take(m, 'engine', 1); const mech = (CZ.S.survivors || []).some(s => s.home === CZ.Z.id && s.skill === 'mechanic' && s.state === 'home'); e.hp = Math.min(e.def.hp, e.hp + (mech ? 500 : 250)); HUD.toast('Repaired', 'info'); } });
      out.push({ kind: 'car', label: 'DRIVE THE ' + e.def.name.toUpperCase() + ' · FUEL ' + Math.floor(e.fuel) + ' · ' + Math.round(e.hp / e.def.hp * 100) + '%', time: 0.6, ok: () => !e.driver, run: () => CZ.enterCar(a, e) });
      return;
    }
  });
  // the infected don't go for people inside cars
  // (cityz-infected.js chooses prey from G.actors; the physics hook above parks riders at the car)
  CZ.listen('enter', () => { for (const a of G.actors) { a.czDriving = null; a.czCar = null; } });

  // more cars out in the city, from the start of a campaign
  const oNew = CZ.newGame;
  CZ.newGame = function (ops, diff) {
    const S = oNew(ops, diff);
    S.vehicles.push({ id: 'v2', kind: 'pickup', zone: 'industrial', x: 45, z: 22, yaw: 0, fuel: 6, hp: 520 });
    S.vehicles.push({ id: 'v3', kind: 'van', zone: 'highway', x: 66, z: 45, yaw: 1.57, fuel: 0, hp: 380 });
    S.vehicles.push({ id: 'v4', kind: 'hatch', zone: 'farm', x: 45, z: 70, yaw: 0, fuel: 14, hp: 260 });
    CZ.save(true);
    return S;
  };
})();
