/* maps-kit.js -- a layout kit for the larger maps (maps-new-d.js, maps-rework-d.js ...).
   A map is written as floor plans: rows of named rooms per level, plus stairwells and whatever
   is special about it. The kit then cuts the doors between neighbouring rooms, the ways in from
   outside, the windows and the hatches, and furnishes every room by what its name says it is.
   Everything it does is decided by hashes of room names, so a map builds the same way every time. */
(function () {
  'use strict';
  const { M, mat } = DATA;
  const GY = 12;
  const K = {};
  let S = null;

  /* shared materials */
  mat('KT_VELVET', 0x8e1f2c, { hp: 3, pen: 0.8, xp: true, hb: true, melee: true });
  mat('KT_GOLD', 0xd9b25a, {});
  mat('KT_COPPER', 0xb5713a, {});
  mat('KT_MOLTEN', 0xff8a2a, { glow: true });
  mat('KT_STEEL', 0x5a626c, { pat: 'plates' });
  mat('KT_SLATE', 0x3c4450, { pat: 'plates' });
  mat('KT_TIMBER', 0x9a7446, { hp: 5, pen: 0.55, xp: true, hb: true, pat: 'planks', wall: true });
  mat('KT_ADOBE', 0xcfa97a, { hp: 9, pen: 0.4, xp: true, hb: true, pat: 'noise', wall: true });
  mat('KT_TEAL', 0x3f8f8a, { pat: 'checker' });
  mat('KT_MOSS', 0x5d7a44, { pat: 'noise' });
  mat('KT_STAIN_R', 0xc8484e, { hp: 1, pen: 0.95, xp: true, hb: true, see: true, melee: true, glow: true });
  mat('KT_STAIN_B', 0x4a78d0, { hp: 1, pen: 0.95, xp: true, hb: true, see: true, melee: true, glow: true });
  mat('KT_STAIN_Y', 0xe2b84a, { hp: 1, pen: 0.95, xp: true, hb: true, see: true, melee: true, glow: true });

  const hs = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return ((h >>> 0) % 100000) / 100000; };
  K.hs = hs;
  const CIRC = /Hall|Corridor|Lobby|Landing|Stairs|Gallery|Catwalk|Passage|Tunnel|Balcony|Concourse|Walk|Foyer|Arcade|Cloister|Atrium|Deck|Nave|Aisle|Mezzanine|Platform|Rotunda/;
  const base = n => n.replace(/ (\dF|B)$/, '');

  K.begin = function (B) { S = { B, rooms: [], keep: [] }; K.S = S; return S; };
  /* an opening in a wall shared by two buildings is indoors: not a way in, not a rappel window */
  K.inner = op => { op.ext = false; op.nrm = 0; return op; };

  /* Buildings that share a wall line: the later one cleared the line up to six voxels above its own
     roof. Where the earlier one is taller, put its wall back; and take the kerb off buildings that
     are wholly underground (lo 0, hi 0), whose roof is the ground. Call it once all buildings exist. */
  K.shells = function (B) {
    const bs = B.meta.buildings;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j];
      if (c.roofY >= a.roofY) continue;
      const x0 = Math.max(a.x, c.x), x1 = Math.min(a.x1, c.x1), z0 = Math.max(a.z, c.z), z1 = Math.min(a.z1, c.z1);
      if (x0 > x1 || z0 > z1) continue;
      B.w.fill(x0, Math.max(c.roofY, a.lo * 12), z0, x1, Math.min(c.roofY + 6, a.roofY), z1, (x, y, z) => (x === a.x || x === a.x1 || z === a.z || z === a.z1) ? a.ext : -1);
    }
    for (const t of bs) {
      if (t.hi !== 0) continue;
      const others = bs.filter(o => o !== t && o.hi >= 1);
      const held = (x, z) => others.some(o => x >= o.x && x <= o.x1 && z >= o.z && z <= o.z1);
      B.w.fill(t.x, GY + 1, t.z, t.x1, GY + 2, t.z1, (x, y, z) => (x === t.x || x === t.x1 || z === t.z || z === t.z1) && !held(x, z) ? 0 : -1);
    }
  };

  /* ------------------------------------------------------------------ rooms */
  const FLOORS = [
    [/Kitchen|Bath|Shower|Wash|Clinic|Infirm|Medical|Pool|Cold|Galley|Laundry|Toilet|Morgue|Scull|Dairy|Larder|Pantry|Sauna|Steam|Lab|Cryo/, n => M.TILE],
    [/Office|Suite|Bed|Lounge|Library|Study|Quarters|Board|Conference|Chapel|Parlou?r|Reading|Cabin|Dorm|Guest|Box\b|Salon/, n => hs(n + 'c') < 0.5 ? M.CARPET : M.CARPET2],
  ];
  K.room = function (b, L, name, x0, z0, x1, z1, o) {
    o = typeof o === 'string' ? { skip: o } : (o || {});
    const pal = b.pal || [b.inner];
    const wall = o.wall || pal[Math.floor(hs(base(name)) * pal.length)];
    let floor = o.floor;
    if (floor === undefined && !b.plain) for (const [re, f] of FLOORS) if (re.test(name)) { floor = f(base(name)); break; }
    const r = b.room(L, name, x0, z0, x1, z1, { wall, floor: floor || undefined, skip: o.skip });
    const e = { r, b, L, name, x0, z0, x1, z1, wx0: b.X(x0), wz0: b.Z(z0), wx1: b.X(x1), wz1: b.Z(z1), circ: CIRC.test(name), stair: !!o.stair, axis: o.axis, bare: !!o.bare };
    S.rooms.push(e);
    return e;
  };
  /* A floor plan as text. Each line is a band of rooms:   z0-z1[@x0]: Name x1 | Name x1 | - x1
     Rooms run left to right from x0 (0 if not given) to each x1; "-" leaves a gap (a stairwell goes
     there). A name ending "~" is left unfurnished; "/nsew" after it leaves those walls open.
     With cols = true a line is  x0-x1[@z0]: Name z1 | ...  and rooms run top to bottom. */
  K.plan = function (b, L, text, cols) {
    for (const ln of text.split('\n')) {
      const m = /^\s*(\d+)-(\d+)(?:@(\d+))?:\s*(.+)$/.exec(ln);
      if (!m) continue;
      const a0 = +m[1], a1 = +m[2];
      let c = +(m[3] || 0);
      for (const t of m[4].split('|')) {
        const q = /^\s*(.+?)\s+(\d+)\s*$/.exec(t);
        if (!q) throw new Error('plan: cannot read "' + t + '"');
        let name = q[1];
        const end = +q[2], o = {};
        const sk = /\/([nsew]+)$/.exec(name); if (sk) { o.skip = sk[1]; name = name.slice(0, sk.index); }
        if (name.endsWith('~')) { o.bare = true; name = name.slice(0, -1); }
        if (name !== '-') { if (cols) K.room(b, L, name, a0, c, a1, end, o); else K.room(b, L, name, c, a0, end, a1, o); }
        c = end;
      }
    }
  };

  /* An enclosed switchback stair for levels lo..hi. axis 'z': 13 wide, 25 long along z; axis 'x':
     25 x 13. A landing five deep at each end, the flights between them, alternating halves.
     The kit cuts a door at each landing into whatever room lies along its long sides. */
  K.well = function (b, name, lx, lz, axis, lo, hi, wall) {
    const z = axis === 'z';
    for (let L = lo; L <= hi; L++) K.room(b, L, name + (L ? ' ' + L + 'F' : ' B'), lx, lz, lx + (z ? 12 : 24), lz + (z ? 24 : 12), { wall, stair: true, axis, floor: null });
    for (let L = lo, k = 0; L < hi; L++, k++) {
      const U = L + 1;
      if (z) {
        b.rail(U, lx + 6, lz + 6, lx + 6, lz + 17);
        if (k % 2 === 0) { b.stairs(L, lx + 7, lz + 17, '-z', 5); b.rail(U, lx + 7, lz + 18, lx + 11, lz + 18); }
        else { b.stairs(L, lx + 1, lz + 6, '+z', 5); b.rail(U, lx + 1, lz + 5, lx + 5, lz + 5); }
      } else {
        b.rail(U, lx + 6, lz + 6, lx + 17, lz + 6);
        if (k % 2 === 0) { b.stairs(L, lx + 17, lz + 7, '-x', 5); b.rail(U, lx + 18, lz + 7, lx + 18, lz + 11); }
        else { b.stairs(L, lx + 6, lz + 1, '+x', 5); b.rail(U, lx + 5, lz + 1, lx + 5, lz + 5); }
      }
    }
  };
  /* an open straight flight in a hall, with rails round its opening on the floor above */
  K.flight = function (b, L, lx, lz, dir, n) {
    b.stairs(L, lx, lz, dir, n);
    const U = L + 1;
    // the floor at the foot and at the head of the flight stays clear of furniture
    const kp = (lv, x0, z0, x1, z1) => S.keep.push({ L: lv, x0: b.X(Math.min(x0, x1)), z0: b.Z(Math.min(z0, z1)), x1: b.X(Math.max(x0, x1)), z1: b.Z(Math.max(z0, z1)) });
    if (dir === '+z') { kp(L, lx - 1, lz - 5, lx + n, lz - 1); kp(U, lx - 1, lz + 12, lx + n, lz + 16); }
    else if (dir === '-z') { kp(L, lx - 1, lz + 1, lx + n, lz + 5); kp(U, lx - 1, lz - 16, lx + n, lz - 12); }
    else if (dir === '+x') { kp(L, lx - 5, lz - 1, lx - 1, lz + n); kp(U, lx + 12, lz - 1, lx + 16, lz + n); }
    else { kp(L, lx + 1, lz - 1, lx + 5, lz + n); kp(U, lx - 16, lz - 1, lx - 12, lz + n); }
    if (dir === '+z') { b.rail(U, lx - 1, lz - 1, lx - 1, lz + 11); b.rail(U, lx + n, lz - 1, lx + n, lz + 11); b.rail(U, lx, lz - 1, lx + n - 1, lz - 1); }
    else if (dir === '-z') { b.rail(U, lx - 1, lz - 11, lx - 1, lz + 1); b.rail(U, lx + n, lz - 11, lx + n, lz + 1); b.rail(U, lx, lz + 1, lx + n - 1, lz + 1); }
    else if (dir === '+x') { b.rail(U, lx - 1, lz - 1, lx + 11, lz - 1); b.rail(U, lx - 1, lz + n, lx + 11, lz + n); b.rail(U, lx - 1, lz, lx - 1, lz + n - 1); }
    else { b.rail(U, lx - 11, lz - 1, lx + 1, lz - 1); b.rail(U, lx - 11, lz + n, lx + 1, lz + n); b.rail(U, lx + 1, lz, lx + 1, lz + n - 1); }
  };
  /* a round hole in the floor of level L, railed */
  K.round = function (b, L, cx, cz, R) {
    for (let dz = -R - 2; dz <= R + 2; dz++) for (let dx = -R - 2; dx <= R + 2; dx++) {
      const d = Math.hypot(dx, dz);
      if (d <= R) b.void(L, cx + dx, cz + dz, cx + dx, cz + dz);
      else if (d <= R + 1.25) b.rail(L, cx + dx, cz + dz, cx + dx, cz + dz);
    }
  };
  /* a fossil skeleton standing on the floor of level L: spine along x from lx, `len` long */
  K.fossil = function (b, L, lx, lz, len, h) {
    const m = M.BONE;
    b.box(L, lx, lz, lx + len, lz, h, h, m);                                   // spine
    for (let i = 4; i < len - 6; i += 3) { b.box(L, lx + i, lz - 3, lx + i, lz + 3, h - 1, h - 1, m); b.box(L, lx + i, lz - 3, lx + i, lz - 3, h - 4, h - 2, m); b.box(L, lx + i, lz + 3, lx + i, lz + 3, h - 4, h - 2, m); }
    for (const i of [5, len - 9]) for (const s of [-3, 3]) b.box(L, lx + i, lz + s, lx + i + 1, lz + s, 0, h - 1, m);   // legs
    b.box(L, lx + len + 1, lz - 1, lx + len + 5, lz + 1, h, h + 3, m); b.box(L, lx + len + 3, lz - 1, lx + len + 5, lz + 1, h + 1, h + 1, 0);   // skull
    for (let i = 1; i <= 8; i++) b.box(L, lx - i, lz, lx - i, lz, h - Math.floor(i / 2), h - Math.floor(i / 2), m);        // tail
  };
  /* a hole in the floor of level L (the hall below is open through it), railed all round */
  K.atrium = function (b, L, x0, z0, x1, z1) {
    b.void(L, x0, z0, x1, z1);
    b.rail(L, x0 - 1, z0 - 1, x1 + 1, z0 - 1); b.rail(L, x0 - 1, z1 + 1, x1 + 1, z1 + 1);
    b.rail(L, x0 - 1, z0, x0 - 1, z1); b.rail(L, x1 + 1, z0, x1 + 1, z1);
  };

  /* ------------------------------------------------------------------ doors */
  /* floor to stand on at (x, z) on level L, with headroom */
  const stand = (x, L, z) => {
    const w = S.B.w, y = L * 12, f = w.get(x, y, z);
    if (!f || f === M.HATCH || f === DATA.OOB) return false;
    for (let h = 1; h <= 8; h++) if (w.get(x, y + h, z)) return false;
    return true;
  };
  K.stand = stand;
  const wallAt = (c, k, h) => c.axis === 'x' ? S.B.w.get(c.line, c.A.L * 12 + (h || 2), k) : S.B.w.get(k, c.A.L * 12 + (h || 2), c.line);
  function isOpen(c) { let n = 0; for (let k = c.lo; k <= c.hi; k++) if (!wallAt(c, k)) n++; return n >= 3; }
  function cut(c) {
    const { A, C, axis, line, lo, hi } = c, L = A.L, bb = A.b;
    const ok = (a, n) => {
      for (let k = a; k < a + n; k++) {
        if (!wallAt(c, k)) return false;
        for (let d = 1; d <= 3; d++) if (axis === 'x' ? !(stand(line - d, L, k) && stand(line + d, L, k)) : !(stand(k, L, line - d) && stand(k, L, line + d))) return false;
      }
      return true;
    };
    const zones = [], st = A.stair ? A : C.stair ? C : null, hub = (A.circ || A.stair) && (C.circ || C.stair);
    if (st && ((st.axis === 'z') === (axis === 'x'))) {
      const s0 = axis === 'x' ? st.wz0 : st.wx0;
      zones.push([Math.max(lo, s0 + 1), Math.min(hi, s0 + 4)], [Math.max(lo, s0 + 19), Math.min(hi, s0 + 23)]);
    } else if (!st && hi - lo >= 44 && (A.circ || C.circ)) { const md = (lo + hi) >> 1; zones.push([lo + 1, md - 3], [md + 3, hi - 1]); }
    else zones.push([lo + 1, hi - 1]);
    let made = 0;
    for (const [z0, z1] of zones) {
      const n = hub && !st && z1 - z0 >= 13 ? 6 : 4;
      if (z1 - z0 + 1 < n) continue;
      const mid = z0 + Math.floor((z1 - z0 + 1 - n) * (0.2 + 0.6 * hs(A.name + '>' + C.name)));
      let best = -1;
      for (let d = 0; d <= z1 - z0 && best < 0; d++) for (const a of [mid - d, mid + d]) if (a >= z0 && a + n - 1 <= z1 && ok(a, n)) { best = a; break; }
      if (best < 0) continue;
      const op = axis === 'x' ? bb.doorX(L, line - bb.x, best - bb.z, n) : bb.doorZ(L, line - bb.z, best - bb.x, n);
      if (A.b !== C.b) K.inner(op);
      made++;
    }
    return made > 0;
  }
  /* a door between every pair of neighbouring rooms where one is a hall, corridor or stair; between
     two ordinary rooms with probability p, and always when they would otherwise not be joined.
     o.no: ['Room A|Room B', 'Room C|*'] pairs to leave walled. */
  K.doors = function (o) {
    o = o || {};
    const no = new Set(o.no || []), p = o.p == null ? 0.5 : o.p;
    const R = S.rooms, par = R.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
    const later = [];
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const A = R[i], C = R[j];
      if (A.L !== C.L) continue;
      let axis = null, line, lo, hi;
      if (A.wx1 === C.wx0 || C.wx1 === A.wx0) { axis = 'x'; line = A.wx1 === C.wx0 ? A.wx1 : A.wx0; lo = Math.max(A.wz0, C.wz0) + 1; hi = Math.min(A.wz1, C.wz1) - 1; }
      if (!axis || hi - lo + 1 < 6) {
        if (A.wz1 === C.wz0 || C.wz1 === A.wz0) { axis = 'z'; line = A.wz1 === C.wz0 ? A.wz1 : A.wz0; lo = Math.max(A.wx0, C.wx0) + 1; hi = Math.min(A.wx1, C.wx1) - 1; } else axis = null;
      }
      if (!axis || hi - lo + 1 < 6) continue;
      const an = base(A.name), cn = base(C.name);
      if (no.has(an + '|' + cn) || no.has(cn + '|' + an) || no.has(an + '|*') || no.has(cn + '|*')) continue;
      const c = { A, C, i, j, axis, line, lo, hi };
      if (isOpen(c)) { par[find(i)] = find(j); continue; }
      if (A.circ || C.circ || A.stair || C.stair || hs(an + '+' + cn) < p) { if (cut(c)) par[find(i)] = find(j); }
      else later.push(c);
    }
    for (const c of later) if (find(c.i) !== find(c.j) && cut(c)) par[find(c.i)] = find(c.j);
  };

  const other = (b, x, z, y) => S.B.meta.buildings.some(c => c !== b && c.hi >= 1 && x >= c.x && x <= c.x1 && z >= c.z && z <= c.z1 && y <= c.roofY + 2);
  /* ways in from outside on the ground floor: every hall, corridor or lobby that touches an outside
     wall gets one, other rooms with probability p. o.force / o.none: room names. */
  K.ext = function (b, o) {
    o = o || {};
    if (b.lo > 1 || b.hi < 1) return 0;
    const p = o.p == null ? 0.45 : o.p, w = S.B.w, force = o.force || [], none = o.none || [];
    let made = 0;
    for (const e of S.rooms) {
      if (e.b !== b || e.L !== 1 || e.stair || none.includes(e.name)) continue;
      for (const side of ['z0', 'z1', 'x0', 'x1']) {
        const on = side === 'z0' ? e.z0 === 0 : side === 'z1' ? e.z1 === b.d - 1 : side === 'x0' ? e.x0 === 0 : e.x1 === b.w - 1;
        if (!on) continue;
        if (!(e.circ || force.includes(e.name) || hs(e.name + side) < p)) continue;
        const alongX = side[0] === 'z', line = side[1] === '0' ? 0 : (alongX ? b.d : b.w) - 1, out = line === 0 ? -1 : 1;
        const a0 = (alongX ? e.x0 : e.z0) + 2, a1 = (alongX ? e.x1 : e.z1) - 2, n = e.circ && a1 - a0 >= 12 ? 6 : 4;
        const P = (a, off) => alongX ? [b.X(a), b.Z(line + off)] : [b.X(line + off), b.Z(a)];
        const ok = a => {
          for (let k = a; k < a + n; k++) {
            const [xo, zo] = P(k, out), [xw, zw] = P(k, 0);
            if (w.get(xw, 14, zw) !== b.ext || other(b, xo, zo, 14)) return false;
            for (let d = 1; d <= 3; d++) { const [xi, zi] = P(k, -out * d), [xe, ze] = P(k, out * d); if (!stand(xi, 1, zi) || !stand(xe, 1, ze)) return false; }
          }
          return true;
        };
        const mid = a0 + Math.floor((a1 - a0 + 1 - n) * (0.15 + 0.7 * hs(e.name + side + 'p')));
        let best = -1;
        for (let d = 0; d <= a1 - a0 && best < 0; d++) for (const a of [mid - d, mid + d]) if (a >= a0 && a + n - 1 <= a1 && ok(a)) { best = a; break; }
        if (best < 0) continue;
        if (alongX) b.doorZ(1, line, best, n); else b.doorX(1, line, best, n);
        made++;
      }
    }
    return made;
  };
  /* windows on every outside wall of every floor above ground level */
  K.wins = function (b, o) {
    o = o || {};
    if (b.hi < 1) return;
    const n = o.n || 5, step = o.step || 13, w = S.B.w;
    for (let L = Math.max(1, b.lo); L <= b.hi; L++) for (const side of ['z0', 'z1', 'x0', 'x1']) {
      const alongX = side[0] === 'z', len = alongX ? b.w : b.d, line = side[1] === '0' ? 0 : (alongX ? b.d : b.w) - 1, inw = line === 0 ? 1 : -1, y = L * 12 + 6;
      const P = (a, off) => alongX ? [b.X(a), b.Z(line + off)] : [b.X(line + off), b.Z(a)];
      const at = (a, off) => { const [x, z] = P(a, off); return w.get(x, y, z); };
      let a = 3 + Math.floor(hs(b.x + side + L) * 5);
      while (a + n + 2 < len) {
        let ok = true;
        for (let k = a - 2; k <= a + n + 1 && ok; k++) if (at(k, 0) !== b.ext) ok = false;
        for (let k = a - 1; k <= a + n && ok; k++) { const [x, z] = P(k, -inw); if (at(k, inw) || at(k, -inw) || other(b, x, z, y)) ok = false; }
        if (!ok) { a += 2; continue; }
        if (alongX) b.winZ(L, line, a, n); else b.winX(L, line, a, n);
        a += step;
      }
    }
  };
  /* up to `per` hatches in the floor of each level above the lowest, each over open floor below */
  K.hatches = function (b, per) {
    const w = S.B.w;
    let total = 0;
    const good = (L, lx, lz) => {
      for (let dz = -1; dz <= 4; dz++) for (let dx = -1; dx <= 4; dx++) {
        const x = b.X(lx + dx), z = b.Z(lz + dz), y = L * 12, f = w.get(x, y, z);
        if (!f || f === M.HATCH) return false;
        for (let h = 1; h <= 4; h++) if (w.get(x, y + h, z)) return false;
        for (let yy = y - 11; yy < y; yy++) if (w.get(x, yy, z)) return false;
        if (!w.get(x, y - 12, z)) return false;
      }
      const x = b.X(lx + 1), z = b.Z(lz + 1);
      return S.rooms.some(e => e.L === L - 1 && !e.stair && x > e.wx0 + 1 && x < e.wx1 - 4 && z > e.wz0 + 1 && z < e.wz1 - 4);
    };
    for (let L = b.lo + 1; L <= b.hi; L++) {
      const rs = S.rooms.filter(e => e.b === b && e.L === L && !e.stair && e.x1 - e.x0 >= 14 && e.z1 - e.z0 >= 14).sort((p, q) => hs(p.name + 'h') - hs(q.name + 'h'));
      let n = 0;
      for (const e of rs) {
        if (n >= per) break;
        for (let t = 0; t < 8; t++) {
          const lx = e.x0 + 3 + Math.floor(hs(e.name + 'x' + t) * (e.x1 - e.x0 - 9)), lz = e.z0 + 3 + Math.floor(hs(e.name + 'z' + t) * (e.z1 - e.z0 - 9));
          if (!good(L, lx, lz)) continue;
          b.hatch(L, lx, lz); n++; total++; break;
        }
      }
    }
    return total;
  };

  /* ------------------------------------------------------------------ furniture */
  const KINDS = [
    [/Office|Admin|Records|Archive|Study|Bureau|Clerk|Registry|Briefing|Board|Conference|Class|Security|Reception|Ticket|Post/, 'office'],
    [/Stor|Supply|Larder|Pantry|Closet|Cellar|Vault|Magazine|Armou?ry|Depot|Stock|Locker|Evidence|Luggage|Parcel|Baggage|Wardrobe|Prop|Crypt|Granary|Silo|Tack|Linen|Wine|Ossuary/, 'store'],
    [/Bunk|Bed|Dorm|Quarters|Cabin|Suite|Cells?\b|Guest|Ward\b|Infirm|Sick|Barrack|Berth|Nursery|Room \d/, 'bunk'],
    [/Kitchen|Galley|Scullery|Bakery|Mess|Canteen|Cafe|Dining|Refectory|Bar\b|Brew|Buffet|Tavern|Pub\b/, 'kitchen'],
    [/Lab|Clinic|Medical|Cryo|Specimen|Sample|Test|Research|Dissect|Analysis|Hydro|Grow|Seed|Assay|Chem|Quarantine|Autopsy|Conservation|Restoration|Taxiderm/, 'lab'],
    [/Server|Control|Radio|Comms|Signal|Generator|Pump|Boiler|Engine|Turbine|Machine|Power|Switch|Relay|Transformer|Battery|Reactor|Vent|Filter|Plant|Projection|Dimmer|Sound|Telemetry|Valve|Compressor|Furnace|Telegraph|Clock/, 'tech'],
    [/Lounge|Lobby|Foyer|Reading|Library|Parlou?r|Common|Rec\b|Recreation|Waiting|Club|Chapel|Green Room|Salon|Smoking|Sacristy|Chapter|Vestry|Scriptorium|Billiard|Trophy|Den\b|Living|Great Room/, 'lounge'],
    [/Workshop|Garage|Bay|Forge|Tool|Repair|Hangar|Dock|Freight|Cargo|Hold|Loading|Scenery|Carpent|Paint|Smith|Barn|Stable|Shed|Mill|Press|Packing|Canning|Gutting|Smoke|Casting|Rolling|Foundry|Pattern|Mould|Ski|Wax|Milking|Tractor|Net|Sail|Cooper|Engine Shed|Goods/, 'shop'],
  ];
  const kindOf = e => { if (e.b.gallery && /Gallery|Hall|Collection|Room$/.test(e.name) && !/Entrance|Stor|Lecture|Reading|Board|Boiler|Children|Print|Costume|Undercroft/.test(e.name) && e.L >= 1) return 'gallery'; if (e.circ) return 'hall'; for (const [re, k] of KINDS) if (re.test(e.name)) return k; return 'misc'; };
  const FAB = () => [M.FAB_RED, M.FAB_BLUE, M.KT_VELVET, M.FELT];
  /* r = [lx0, lz0, lx1, lz1]; side = which wall the piece backs onto ('N' = low z, 'S', 'W' = low x, 'E') */
  const IT = {
    shelf: { len: 8, dep: 2, tall: 1, f: (b, L, r) => b.shelf(L, r[0], r[1], r[2], r[3], 7) },
    locker: { len: 6, dep: 2, tall: 1, f: (b, L, r) => b.box(L, r[0], r[1], r[2], r[3], 0, 8, M.METAL) },
    desk: { len: 8, dep: 4, f: (b, L, r) => b.desk(L, r[0], r[1], r[2], r[3]) },
    couch: { len: 8, dep: 3, f: (b, L, r, sd, h) => b.couch(L, r[0], r[1], r[2], r[3], FAB()[Math.floor(h * 4)], { N: 's', S: 'n', W: 'w', E: 'e' }[sd]) },
    bed: { len: 10, dep: 6, f: (b, L, r, sd, h) => b.bed(L, r[0], r[1], r[2], r[3], h < 0.5 ? M.FAB_BLUE : M.WHITE) },
    counter: { len: 10, dep: 3, f: (b, L, r) => b.counter(L, r[0], r[1], r[2], r[3]) },
    fridge: { len: 4, dep: 3, tall: 1, f: (b, L, r) => b.box(L, r[0], r[1], r[2], r[3], 0, 7, M.FRIDGE) },
    crate: { len: 4, dep: 4, f: (b, L, r, sd, h) => { b.box(L, r[0], r[1], r[2], r[3], 0, 3, M.CRATE); if (h < 0.45) b.box(L, r[0], r[1], r[2] - 1, r[3] - 1, 4, 6, M.CRATE); } },
    rack: { len: 6, dep: 3, tall: 1, f: (b, L, r) => b.rack(L, r[0], r[1], r[2], r[3]) },
    tank: { len: 5, dep: 5, tall: 1, f: (b, L, r, sd, h) => b.tank(L, (r[0] + r[2]) >> 1, (r[1] + r[3]) >> 1, 2, 7, h < 0.5 ? M.METAL : M.BOILER) },
    bench: { len: 10, dep: 3, f: (b, L, r) => { b.box(L, r[0], r[1], r[2], r[3], 0, 3, M.LAB_WHITE); b.box(L, r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1, 4, 5, M.GLASS); } },
    pallet: { len: 6, dep: 4, f: (b, L, r) => { b.box(L, r[0], r[1], r[2], r[3], 0, 0, M.WOOD); b.box(L, r[0] + 1, r[1], r[2] - 1, r[3], 1, 4, M.SANDBAG); } },
    table: { len: 8, dep: 5, f: (b, L, r) => b.table(L, r[0], r[1], r[2], r[3]) },
    console: { len: 8, dep: 3, f: (b, L, r) => { b.box(L, r[0], r[1], r[2], r[3], 0, 3, M.PANEL_DARK); b.box(L, r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1, 4, 5, M.SCREEN); } },
    planter: { len: 4, dep: 3, f: (b, L, r) => { b.box(L, r[0], r[1], r[2], r[3], 0, 1, M.POT); b.box(L, r[0], r[1], r[2], r[3], 2, 5, M.LEAF); } },
    case: { len: 7, dep: 3, f: (b, L, r) => { b.box(L, r[0], r[1], r[2], r[3], 0, 2, M.TRIM); b.box(L, r[0], r[1], r[2], r[3], 3, 6, M.GLASS); } },
    plinth: { len: 3, dep: 3, f: (b, L, r, sd, h) => { b.box(L, r[0], r[1], r[2], r[3], 0, 2, M.MARBLE); b.box(L, r[0] + 1, r[1] + 1, r[0] + 1, r[1] + 1, 3, 6 + Math.floor(h * 3), h < 0.5 ? M.BONE : M.BRASS); } },
  };
  const POOL = {
    office: ['desk', 'shelf', 'desk', 'couch', 'shelf', 'locker'],
    store: ['shelf', 'crate', 'locker', 'crate', 'shelf', 'pallet'],
    bunk: ['bed', 'locker', 'bed', 'shelf', 'desk'],
    kitchen: ['counter', 'fridge', 'counter', 'shelf', 'table'],
    lab: ['bench', 'rack', 'bench', 'shelf', 'fridge', 'console'],
    tech: ['rack', 'console', 'tank', 'locker', 'rack', 'crate'],
    lounge: ['couch', 'planter', 'shelf', 'couch', 'table'],
    shop: ['crate', 'tank', 'locker', 'pallet', 'crate', 'counter'],
    hall: ['planter', 'crate', 'couch'],
    gallery: ['case', 'plinth', 'case', 'couch', 'case', 'planter'],
    misc: ['crate', 'shelf', 'table', 'locker', 'pallet'],
  };
  const MID = {
    office: ['table', 'pillar'], store: ['crates', 'crates', 'pillar'], bunk: ['table'], kitchen: ['island', 'table'], lab: ['island', 'pillar'],
    tech: ['machine', 'pillar', 'crates'], lounge: ['table', 'planter', 'pillar'], shop: ['crates', 'machine', 'pillar'], hall: ['pillar', 'planter'], gallery: ['case', 'statue', 'pillar', 'case'], misc: ['crates', 'table', 'pillar'],
  };
  K.furnish = function () {
    const w = S.B.w;
    for (const e of S.rooms) {
      if (e.stair || e.bare) continue;
      const b = e.b, L = e.L, kind = kindOf(e), pool = POOL[kind];
      const ix = e.x1 - e.x0 - 1, iz = e.z1 - e.z0 - 1;         // interior size
      if (Math.min(ix, iz) < 9) continue;
      const kept = (x, z) => S.keep.some(k => k.L === L && x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1);
      const free = (lx, lz) => lx > e.x0 && lx < e.x1 && lz > e.z0 && lz < e.z1 && stand(b.X(lx), L, b.Z(lz)) && !kept(b.X(lx), b.Z(lz));
      const wv = (lx, lz, h) => w.get(b.X(lx), L * 12 + h, b.Z(lz));
      let seq = Math.floor(hs(e.name) * 7);
      const sparse = e.circ && kind === 'hall';
      const sides = sparse ? (ix >= iz ? ['N'] : ['W']) : ['N', 'S', 'W', 'E'];
      for (const sd of sides) {
        const alongX = sd === 'N' || sd === 'S', perp = alongX ? iz : ix, span0 = (alongX ? e.x0 : e.z0) + 1, span1 = (alongX ? e.x1 : e.z1) - 1;
        const wl = sd === 'N' ? e.z0 : sd === 'S' ? e.z1 : sd === 'W' ? e.x0 : e.x1, inw = sd === 'N' || sd === 'W' ? 1 : -1;
        const cell = (a, d) => alongX ? [a, wl + inw * d] : [wl + inw * d, a];
        // (five clear of each corner, so a door near the corner on the next wall is never boxed in)
        let a = span0 + 5 + Math.floor(hs(e.name + sd) * 4);
        while (a < span1 - 5) {
          const it = IT[pool[seq % pool.length]];
          const far = sd === 'S' || sd === 'E';
          if (perp < it.dep * (far ? 2 : 1) + 6 || a + it.len - 1 > span1 - 5 || hs(e.name + sd + a) > (sparse ? 0.35 : 0.8)) { a += 3; seq++; continue; }
          let ok = true;
          for (let k = a - 2; k <= a + it.len + 1 && ok; k++) {
            if (k < span0 || k > span1) continue;
            const [wx, wz] = cell(k, 0);
            if (!wv(wx, wz, 2) || !wv(wx, wz, 8) || (it.tall && wv(wx, wz, 6) === M.GLASS)) ok = false;
            for (let d = 1; d <= it.dep + 2 && ok; d++) { const [cx, cz] = cell(k, d); if (!free(cx, cz)) ok = false; }
          }
          if (!ok) { a += 2; continue; }
          const [p0x, p0z] = cell(a, 1), [p1x, p1z] = cell(a + it.len - 1, it.dep);
          it.f(b, L, [Math.min(p0x, p1x), Math.min(p0z, p1z), Math.max(p0x, p1x), Math.max(p0z, p1z)], sd, hs(e.name + sd + a + 'h'));
          a += it.len + 3 + Math.floor(hs(e.name + a) * 6); seq++;
        }
      }
      // cover out in the middle of big rooms
      if (ix < 26 || iz < 26) continue;
      const mids = MID[kind];
      for (let gz = e.z0 + 11; gz <= e.z1 - 15; gz += 15) for (let gx = e.x0 + 11; gx <= e.x1 - 15; gx += 15) {
        const h = hs(e.name + gx + ':' + gz);
        if (h > (sparse ? 0.55 : 0.8)) continue;
        const x = gx + Math.floor(hs(e.name + 'jx' + gx + gz) * 4), z = gz + Math.floor(hs(e.name + 'jz' + gx + gz) * 4);
        let ok = true;
        for (let dz = -3; dz <= 7 && ok; dz++) for (let dx = -3; dx <= 8 && ok; dx++) if (!free(x + dx, z + dz)) ok = false;
        if (!ok) continue;
        const t = mids[Math.floor(h * 97) % mids.length];
        if (t === 'pillar') b.box(L, x, z, x + 2, z + 2, 0, 10, b.pillar || M.CONCRETE);
        else if (t === 'crates') { b.box(L, x, z, x + 3, z + 3, 0, 3, M.CRATE); b.box(L, x + 4, z, x + 6, z + 3, 0, 5, M.CRATE); if (h < 0.3) b.box(L, x, z, x + 3, z + 3, 4, 7, M.CRATE); }
        else if (t === 'table') b.table(L, x, z, x + 6, z + 3);
        else if (t === 'island') b.box(L, x, z, x + 6, z + 2, 0, 3, kind === 'lab' ? M.LAB_WHITE : M.COUNTER);
        else if (t === 'case') { b.box(L, x, z, x + 6, z + 3, 0, 2, M.TRIM); b.box(L, x, z, x + 6, z + 3, 3, 6, M.GLASS); }
        else if (t === 'statue') { b.box(L, x, z, x + 3, z + 3, 0, 2, M.MARBLE); b.box(L, x + 1, z + 1, x + 2, z + 2, 3, 9, M.BONE); }
        else if (t === 'machine') { b.box(L, x, z, x + 5, z + 3, 0, 5, M.METAL); b.box(L, x + 1, z + 1, x + 2, z + 2, 6, 9, M.PIPE); }
        else { b.box(L, x, z, x + 3, z + 3, 0, 1, M.POT); b.box(L, x, z, x + 3, z + 3, 2, 6, M.LEAF); }
      }
    }
  };

  /* defender cameras: one per building floor first, in halls and corridors */
  K.cams = function (n) {
    const c = S.rooms.filter(e => e.circ && !e.stair && Math.min(e.x1 - e.x0, e.z1 - e.z0) >= 8).sort((p, q) => hs(p.name + 'cam') - hs(q.name + 'cam'));
    const put = e => {
      const lx = e.x0 + 1, lz = e.z0 + 1, dx = (e.x0 + e.x1) / 2 - lx, dz = (e.z0 + e.z1) / 2 - lz;
      e.b.cam(e.L, lx, lz, Math.atan2(-dx, -dz) * 180 / Math.PI, base(e.name).toUpperCase());
      e.cam = true;
    };
    const seen = new Set();
    let k = 0;
    for (const e of c) { const key = S.B.meta.buildings.indexOf(e.b) + ':' + e.L; if (k >= n || seen.has(key)) continue; seen.add(key); put(e); k++; }
    for (const e of c) if (k < n && !e.cam) { put(e); k++; }
  };

  /* props on open ground: fn(x, z, hash, i) at jittered grid points at least `margin` from any building */
  K.scatter = function (step, margin, fn) {
    const B = S.B, bs = B.meta.buildings;
    let i = 0;
    for (let z = 6; z < B.D - 14; z += step) for (let x = 6; x < B.W - 14; x += step) {
      const xx = x + Math.floor(U.hash3(x, 7, z) * step * 0.6), zz = z + Math.floor(U.hash3(z, 3, x) * step * 0.6);
      if (bs.some(b => xx > b.x - margin && xx < b.x1 + margin && zz > b.z - margin && zz < b.z1 + margin)) continue;
      fn(xx, zz, U.hash3(xx, 1, zz), i++);
    }
  };
  /* the four attacker spawns: names for north, south, east, west of the main building */
  K.spawns = function (n, s, e, w) {
    const B = S.B, m = B.meta.buildings[0], cx = (m.x + m.x1) >> 1, cz = (m.z + m.z1) >> 1;
    const cl = (v, hi) => Math.max(4, Math.min(hi - 5, v));
    B.spawn(n, cx, cl(m.z - 40, B.D), 180); B.spawn(s, cx, cl(m.z1 + 40, B.D), 0);
    B.spawn(e, cl(m.x1 + 40, B.W), cz, 90); B.spawn(w, cl(m.x - 40, B.W), cz, -90);
  };
  /* everything automatic, in the right order. Build stairs, atriums and set pieces before this. */
  K.finish = function (o) {
    o = o || {};
    const bs = S.B.meta.buildings;
    K.doors(o.doors);
    let ext = 0, hat = 0;
    for (const b of bs) ext += K.ext(b, Object.assign({}, o.ext, b.extOpt));
    for (const b of bs) K.wins(b, o.wins);
    for (const b of bs) hat += K.hatches(b, o.hatch == null ? 3 : o.hatch);
    K.furnish();
    K.cams(o.cams || 7);
    return { ext, hat };
  };

  MAPS.KIT = K;
})();
