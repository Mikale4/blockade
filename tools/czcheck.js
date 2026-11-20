/* czcheck.js -- build the City Z locations without a browser and check them.

     node tools/czcheck.js              every location
     node tools/czcheck.js firehouse    just these

   For each: it builds, every room has walkable floor joined to the rest, every room can be reached
   from each of the four road exits, and how big the walkable area is. Exit code 1 if any fails. */
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
for (const f of ['lib/three.min.js', 'js/util.js', 'js/data.js', 'js/world.js', 'js/maps.js', ...extra, 'js/nav.js', 'js/cityz-data.js', 'js/cityz-zones.js']) load(f);
const run = code => vm.runInContext(code, ctx);
const ids = run('Object.keys(CZ.ZONES)');
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
let failed = 0;
for (const id of want.length ? want : ids) {
  const t0 = Date.now();
  let r;
  try {
    r = run(`(function () {
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      const meta = MAPS.build('cz_${id}'), w = meta.world;
      G.world = w; G.map = meta; G.ents = []; G.actors = [];
      NAV.build();
      const out = { errors: [], rooms: meta.rooms.length, nav: NAV.main.size, size: [w.W, w.H, w.D], buildings: meta.buildings.length };
      // the exits: walkable and in the main area
      const exits = meta.exits.map(e => { const n = NAV.nearest(V(e.x, e.y, e.z), 6); return n >= 0 && NAV.main.has(n) ? n : -1; });
      exits.forEach((n, i) => { if (n < 0) out.errors.push('exit ' + meta.exits[i].side + ' not on walkable ground'); });
      const from = exits.find(n => n >= 0);
      let bad = 0;
      for (const room of meta.rooms) {
        let ok = false;
        for (let nz = room.z0 >> 1; nz <= room.z1 >> 1 && !ok; nz++) for (let nx = room.x0 >> 1; nx <= room.x1 >> 1 && !ok; nx++) {
          const ci = nz * NAV.NW + nx, ys = NAV.cols[ci];
          if (ys && ys.includes(room.y) && NAV.main.has(ci * 64 + room.y)) ok = true;
        }
        if (!ok) { bad++; if (bad < 8) out.errors.push('room "' + room.name + '" (L' + room.L + ') has no floor joined to the rest'); }
      }
      // a full route from the first exit to every other exit
      if (from != null && from >= 0) for (let i = 0; i < exits.length; i++) { if (exits[i] < 0 || exits[i] === from) continue; const p = NAV.path(NAV.nodePos(from), NAV.nodePos(exits[i])); if (!p || !p.length) out.errors.push('no route between exits ' + meta.exits[0].side + ' and ' + meta.exits[i].side); }
      return out;
    })()`);
  } catch (e) { r = { errors: ['BUILD FAILED: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')] }; }
  const ok = !r.errors.length;
  if (!ok) failed++;
  console.log(`== ${id}  ${ok ? 'ok' : 'FAIL'}  (${Date.now() - t0} ms)` + (r.rooms ? `  rooms ${r.rooms} · buildings ${r.buildings} · walkable ${r.nav}` : ''));
  for (const e of r.errors) console.log('   error: ' + e);
}
console.log(failed ? `\n${failed} location(s) failed` : '\nall ok');
process.exit(failed ? 1 : 0);
