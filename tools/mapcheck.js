/* mapcheck.js -- build maps without a browser and check them.

     node tools/mapcheck.js              every map
     node tools/mapcheck.js cannery ...  just these
     node tools/mapcheck.js --list       ids only
     node tools/mapcheck.js --plan cannery   also print each floor as ASCII (0.5 m per character):
         # wall   = glass   o furniture / low cover   . floor you can walk   , floor cut off from the rest
         / stairs   H hatch   (blank) no floor

   Loads three.js, util, data, world, maps, every js/maps-*.js and nav in a sandbox, runs the
   real MAPS.build() (stretch, spawn placement and all), then checks what the game relies on:
     - objective rooms named in bombs / secure / hostage / defSpawns exist
     - every room has walkable floor that is part of the main connected area
     - from each of the four attacker spawns there is a full route to every objective room
     - every staircase connects its two floors
     - every door has walkable floor on both sides
     - no exterior window, door or roof edge can see an attacker spawn
   Exit code 1 if any map fails. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const noop = () => { };
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, append: noop, appendChild: noop, addEventListener: noop, setAttribute: noop });
const ctx = {
  console, performance: require('perf_hooks').performance, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { getElementById: () => null, createElement: el, createTextNode: el, addEventListener: noop, body: el(), head: el() },
  navigator: { userAgent: 'node' }, addEventListener: noop, removeEventListener: noop, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const extra = fs.readdirSync(path.join(root, 'js')).filter(f => /^maps-.*\.js$/.test(f)).sort().map(f => 'js/' + f);
for (const f of ['lib/three.min.js', 'js/util.js', 'js/data.js', 'js/world.js', 'js/maps.js', ...extra, 'js/nav.js']) load(f);

const run = code => vm.runInContext(code, ctx);
const ids = run('MAPS.LIST.map(m => m.id)');
const args = process.argv.slice(2);
if (args.includes('--list')) { console.log(ids.join('\n')); process.exit(0); }
const want = args.filter(a => !a.startsWith('--'));
const PLAN = args.includes('--plan');
const todo = want.length ? want : ids;
let failed = 0;

for (const id of todo) {
  if (!ids.includes(id)) { console.log(`\n== ${id}: no such map`); failed++; continue; }
  const t0 = Date.now();
  let r;
  try {
    r = run(`(function () {
      const V = (x, y, z) => new THREE.Vector3(x, y, z), VS = 0.25;
      const meta = MAPS.build(${JSON.stringify(id)}), w = meta.world;
      G.world = w; G.map = meta; G.ents = []; G.actors = [];
      NAV.build();
      const out = { errors: [], warns: [] };
      const E = s => out.errors.push(s), Wn = s => out.warns.push(s);
      out.size = [w.W, w.H, w.D];
      out.buildings = meta.buildings.map(b => ({ w: (b.x1 - b.x0 + 1) * VS, d: (b.z1 - b.z0 + 1) * VS, lo: b.lo, hi: b.hi }));
      out.rooms = meta.rooms.length; out.hatches = meta.hatches.length; out.flights = meta.flights.length;
      out.doors = meta.openings.filter(o => o.kind === 'door').length; out.windows = meta.openings.filter(o => o.kind === 'window').length;
      out.extDoors = meta.openings.filter(o => o.kind !== 'window' && o.ext && o.L >= 1).length;
      out.nav = NAV.main.size;
      if (w.H > 64) E('world height ' + w.H + ' > 64 (pathfinding stores heights in 6 bits)');
      // a walkable, connected spot in a room
      const spotIn = room => {
        const cells = [];
        for (let nz = room.z0 >> 1; nz <= room.z1 >> 1; nz++) for (let nx = room.x0 >> 1; nx <= room.x1 >> 1; nx++) {
          const ci = nz * NAV.NW + nx, ys = NAV.cols[ci];
          if (ys && ys.includes(room.y) && NAV.main.has(ci * 64 + room.y)) cells.push(V(nx * 0.5 + 0.25, room.y * 0.25, nz * 0.5 + 0.25));
        }
        return cells;
      };
      const areaOf = {};
      for (const room of meta.rooms) {
        const cells = spotIn(room);
        areaOf[room.name + '@' + room.L] = cells.length * 0.25;
        if (!cells.length) E('room "' + room.name + '" (L' + room.L + ') has no reachable floor');
        else if (cells.length < 8 && !/Stairs/.test(room.name)) Wn('room "' + room.name + '" (L' + room.L + ') has only ' + (cells.length * 0.25) + ' m2 of reachable floor');
      }
      // objectives
      const sites = new Set();
      const need = (name, what) => { const rs = meta.roomByName[name]; if (!rs) { E(what + ' names a room that does not exist: "' + name + '"'); return null; } sites.add(name); return rs[0]; };
      if (!meta.bombs.length) E('no bomb sites');
      for (const pair of meta.bombs) {
        const a = need(pair[0], 'bombs'), b = need(pair[1], 'bombs');
        if (a && b) { if (a.L !== b.L) Wn('bomb pair ' + pair.join(' / ') + ' is on two floors'); const d = Math.hypot(a.cx - b.cx, a.cz - b.cz); if (d > 30) Wn('bomb pair ' + pair.join(' / ') + ' is ' + d.toFixed(0) + ' m apart'); }
      }
      if (!meta.secure.length) E('no secure-area rooms'); for (const n of meta.secure) need(n, 'secure');
      if (!meta.hostage.length) E('no hostage rooms'); for (const n of meta.hostage) need(n, 'hostage');
      for (const n of meta.defSpawns || []) if (!meta.roomByName[n]) E('defSpawns names a room that does not exist: "' + n + '"');
      for (const n of sites) { const r0 = meta.roomByName[n][0]; if ((areaOf[n + '@' + r0.L] || 0) < 12) Wn('objective room "' + n + '" has only ' + (areaOf[n + '@' + r0.L] || 0) + ' m2 of floor'); }
      // spawns
      if (meta.spawns.length !== 4) E('expected 4 attacker spawns, found ' + meta.spawns.length);
      out.routes = [];
      for (const s of meta.spawns) {
        const from = V(s.x, s.y, s.z);
        if (NAV.nearest(from, 2) < 0) { E('spawn "' + s.name + '" is not on walkable ground'); continue; }
        let worst = 0;
        for (const n of sites) {
          const room = meta.roomByName[n][0], cells = spotIn(room); if (!cells.length) continue;
          const to = cells[cells.length >> 1];
          const p = NAV.path(from, to, { max: 400000 });
          if (!p || !p.length || p[p.length - 1].distanceTo(to) > 1.5) { E('no route from spawn "' + s.name + '" to "' + n + '"'); continue; }
          let len = 0; for (let i = 1; i < p.length; i++) len += p[i].distanceTo(p[i - 1]);
          worst = Math.max(worst, len);
        }
        out.routes.push(s.name + ' ' + worst.toFixed(0) + 'm');
      }
      // spawns hidden from the buildings
      const views = MAPS.viewpoints(meta, w);
      for (const s of meta.spawns) {
        const spots = MAPS.spawnSpots(s.x, s.y, s.z); let seen = 0;
        for (const q of views) if (spots.some(t => w.los(q, t))) seen++;
        if (seen) E('spawn "' + s.name + '" can be seen from ' + seen + ' window / door / roof viewpoints');
      }
      // staircases: the foot and the head of each flight are joined by a short walk
      for (const f of meta.flights) {
        const dx = Math.sign(f.ex - f.x), dz = Math.sign(f.ez - f.z);
        const a = V((f.x - dx * 2 + 0.5) * VS, (f.L * 12 + 1) * VS, (f.z - dz * 2 + 0.5) * VS), b = V((f.ex + dx * 2 + 0.5) * VS, ((f.L + 1) * 12 + 1) * VS, (f.ez + dz * 2 + 0.5) * VS);
        const p = NAV.path(a, b, { max: 60000 });
        let len = 0; if (p) for (let i = 1; i < p.length; i++) len += p[i].distanceTo(p[i - 1]);
        if (!p || !p.length || Math.abs(p[p.length - 1].y - b.y) > 0.6 || len > 30) E('stairs at L' + f.L + ' (' + f.x + ',' + f.z + ' ' + f.dir + ') do not connect their floors' + (p ? ' (detour ' + len.toFixed(0) + ' m)' : ''));
      }
      // doors: floor on both sides
      for (const o of meta.openings) {
        if (o.kind !== 'door') continue;
        const mid = (o.a0 + o.a1 + 1) / 2 * VS, line = (o.line + 0.5) * VS, y = (o.L * 12 + 1) * VS;
        for (const side of [-1, 1]) {
          const p = o.axis === 'x' ? V(line + side * 0.75, y, mid) : V(mid, y, line + side * 0.75);
          const n = NAV.nearest(p, 0.8);
          if (n < 0 || Math.abs(NAV.nodePos(n).y - y) > 0.6) { if (!(o.ext && o.L === 0)) Wn('door at L' + o.L + ' ' + o.axis + '=' + o.line + ' [' + o.a0 + '..' + o.a1 + '] has little or no floor on one side (furniture against it, or it opens onto nothing)'); break; }
        }
      }
      if (${PLAN}) {
        out.plans = [];
        const M = DATA.M, MAT = DATA.MAT;
        for (let bi = 0; bi < meta.buildings.length; bi++) {
          const b = meta.buildings[bi];
          for (let L = b.lo; L <= b.hi; L++) {
            const rows = [], fy = L * 12 + 1;
            for (let z = b.z0 - 2; z <= b.z1 + 2; z += 2) {
              let row = '';
              for (let x = b.x0 - 2; x <= b.x1 + 2; x += 2) {
                const hi = w.get(x, fy + 6, z), lo = w.get(x, fy + 1, z), slab = w.get(x, fy - 1, z);
                const ci = (z >> 1) * NAV.NW + (x >> 1), ys = NAV.cols[ci] || [];
                let c = ' ';
                if (hi && MAT[hi] && MAT[hi].see) c = '=';
                else if (hi) c = '#';
                else if (slab === M.HATCH || slab === M.RHATCH) c = 'H';
                else if (ys.some(y => y > fy && y < fy + 11)) c = '/';
                else if (lo) c = 'o';
                else if (ys.includes(fy)) c = NAV.main.has(ci * 64 + fy) ? '.' : ',';
                row += c;
              }
              rows.push(row);
            }
            out.plans.push({ title: 'building ' + bi + ' · level ' + L + ' (' + ['B', '1F', '2F', '3F', '4F'][L] + ')', rows });
          }
        }
        out.roomList = meta.rooms.map(r => 'L' + r.L + ' ' + r.name + ' [' + r.x0 + ',' + r.z0 + ' .. ' + r.x1 + ',' + r.z1 + ']');
      }
      return out;
    })()`);
  } catch (e) {
    console.log(`\n== ${id}: BUILD FAILED\n   ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n   ') : e}`);
    failed++; continue;
  }
  const m = v => (v * 0.25).toFixed(0);
  console.log(`\n== ${id}  ${r.errors.length ? 'FAIL' : 'ok'}  (${Date.now() - t0} ms)`);
  console.log(`   world ${m(r.size[0])} x ${m(r.size[2])} m, ${r.size[1]} voxels tall (${(r.size[0] * r.size[1] * r.size[2] / 1e6).toFixed(1)} M voxels) · walkable cells ${r.nav}`);
  console.log(`   buildings ${r.buildings.map(b => `${b.w.toFixed(0)}x${b.d.toFixed(0)}m L${b.lo}-${b.hi}`).join(', ')}`);
  console.log(`   rooms ${r.rooms} · doors ${r.doors} (${r.extDoors} outside) · windows ${r.windows} · hatches ${r.hatches} · stair flights ${r.flights}`);
  console.log(`   longest route from each spawn: ${r.routes.join(' · ')}`);
  if (r.plans) {
    for (const p of r.plans) { console.log(''); console.log('   --- ' + p.title); for (const row of p.rows) console.log('   ' + row); }
    console.log(''); console.log('   rooms (voxel rects after stretch):');
    for (const line of r.roomList) console.log('   ' + line);
  }
  for (const w of r.warns) console.log('   warn: ' + w);
  for (const e of r.errors) console.log('   ERROR: ' + e);
  if (r.errors.length) failed++;
}
console.log(failed ? `\n${failed} map(s) failed` : `\nall ${todo.length} map(s) ok`);
process.exit(failed ? 1 : 0);
