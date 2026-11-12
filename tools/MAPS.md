# Making a BLOCKADE map

BLOCKADE is an original 5v5 voxel tactical shooter (attackers enter a building, defenders hold an
objective inside). Maps are built in code from voxels. This is everything a map author needs.

## Where a map lives

Each batch of maps is one file, `js/maps-<name>.js`, that registers its maps with `MAPS.define`.
Do **not** edit `js/maps.js`, `index.html` or any other file: `tools/mapcheck.js` loads every
`js/maps-*.js` automatically, and the script tags are added when the batch is merged.

```js
/* maps-example.js -- <the maps in this file, one line each> */
(function () {
  'use strict';
  const { M, mat, SOFTW } = DATA;
  const { Builder, THEMES, COVER, WING, define } = MAPS;

  // optional: your own materials (unique names; ids are assigned in load order)
  mat('EX_TEAL_TILE', 0x3f8f8a, { pat: 'checker' });
  mat('EX_PAPER_WALL', 0xe8e0c8, SOFTW);            // a soft wall: shot and blown through

  function example() {
    const B = new Builder('example', 'EXAMPLE', 260, 64, 220);   // world W, H, D in voxels, before the stretch
    B.meta.desc = 'One or two sentences on what and where it is.';
    B.theme(THEMES.dusk);            // or your own { sky:[top,bottom], fog, fogFar, lightOut:[r,g,b], lightIn:[r,g,b], sun, outer }
    B.ground(M.GRASS);
    const b = B.building(60, 60, 140, 96, { lo: 0, hi: 2, ext: M.BRICK, inner: M.DRY_BEIGE, slab: M.WOODFLOOR, roof: M.ROOF });
    // rooms, doors, windows, stairs, hatches, furniture, outside props, cameras, spawns, objectives...
    return B;
  }
  define({ id: 'example', name: 'EXAMPLE', fn: example, blurb: 'Short line for the menu card · time of day', cover: 'trailer', tint: 'rgba(120,60,50,0.35)' });
})();
```

Read `js/maps.js` before you start: lines 1-256 are the whole builder API, `museum()` and
`cannery()` are the best complete examples, and the comments above `placeSpawns` and `stretch`
explain what happens to a map after its function returns.

## Units and levels

- One voxel is 0.25 m. Every coordinate you write is in voxels.
- Level `L`: 0 = basement, 1 = ground floor, 2, 3 = upper floors. The floor slab of level L is at
  y = 12·L and its air is y = 12L+1 .. 12L+11, so a storey is 3 m. Outdoor ground is level with
  the 1F slab (y = 12).
- **World height H must be ≤ 64** (pathfinding stores heights in 6 bits). With a level 3 the roof
  slab is at y = 48 and its parapet reaches 50; use H = 64. Do not go above level 3.
- Every map is **stretched ×1.4 in x and z after it is built**: voxel planes that don't carry a
  wall are duplicated, so rooms, corridors and yards get roomier while walls stay one voxel thick
  and stairs and hatches keep their shape. Sizes you write are before the stretch. Don't change it.

## Buildings

`const b = B.building(x, z, w, d, { lo, hi, ext, inner, slab, roof, parapet })` clears a box and
builds the shell: slabs for levels lo..hi, a roof, exterior walls and a parapet. `lo: 0` gives a
basement, `lo: 1` sits on the ground.

- **The first building you make is the main one.** The four attacker spawns are placed 27 m off
  its four sides. Other buildings (wings, annexes, towers, outbuildings) are separate
  `B.building` calls. To join two into an L, T, U or courtyard shape, let them **share one wall
  line** (overlap by exactly one voxel) and cut doors in that wall after both exist, with either
  building's door call. Never overlap by more than the wall line: a new building clears its whole
  box. Buildings may also stand apart, joined by a covered walk, a yard or a basement tunnel.
  Keep everything within about 45 m of the main building.
- Coordinates inside a building are local: `(lx, lz)` from its corner. `b.X(lx)`, `b.Z(lz)` give
  world coordinates.

### Rooms

`b.room(L, 'Name', lx0, lz0, lx1, lz1, { wall, floor, skip })` builds interior walls **on the
rectangle's edges** (exterior edges are already the shell). Neighbouring rooms share a wall line,
so use the same coordinate for both. `skip: 'nsew'` leaves sides open (open-plan spaces,
half-walls you add yourself). Tile each level completely with rooms: bots and objectives work on
rooms, and unnamed floor has no callout.

- Objective rooms need unique names. Circulation rooms should have Hall, Corridor, Lobby, Landing,
  Stairs, Gallery, Catwalk, Passage, Tunnel or Balcony in the name (they are skipped as default
  defender spawn rooms).
- A sensible room is at least 16×16 voxels before the stretch. Objective rooms: 24×24 or more.

### Openings

- `b.doorZ(L, lz, lx0, n = 4, h = 9)`: a doorway in the wall on line `lz`, from `lx0`, `n` wide.
  `b.doorX(L, lx, lz0, n, h)` is the same for a wall on line `lx`. Lines 0 and d-1 / w-1 are the
  exterior walls: those are the ways in. Never make a door narrower than 4.
- `b.winZ(L, lz, lx0, n)`, `b.winX(...)`: windows with glass, sill at 1 m. Attackers rappel and
  crash through upper windows and vault through ground-floor ones, so put several on every façade.
- `b.shutterX / shutterZ`: a garage shutter (a wide soft barrier).
- `b.wallZ / wallX`: an extra wall segment. `b.rail`: a railing.

### Vertical routes

- `b.stairs(L, lx0, lz0, dir, n)`: twelve steps from level L up to L+1, starting at (lx0, lz0),
  climbing toward `dir` ('+x', '-x', '+z', '-z'), `n` wide (use 4-6). It cuts the slab above
  itself. Leave open floor before the first step and after the last one, on both levels, and
  don't put a wall or furniture across either end.
- `b.stairwell(lx0, lz0, lz1)`: an enclosed 12-wide switchback for levels 0-2 with its own doors
  (it only handles up to level 2: for level 3 add `b.stairs(2, ...)` yourself).
- `b.hatch(L, lx, lz)`: a 4×4 destructible hatch in the floor slab of level L, dropping into L-1.
- `b.void(L, lx0, lz0, lx1, lz1)`: removes the slab (atriums, double-height halls, balconies
  looking down). Put rails round the hole.
- `b.cellar(side, a0)`: steps down from outside to a basement door on that side ('n','s','e','w').
- There are no ladders or lifts. Every raised place people should reach needs stairs.

### Furniture (level-local, heights in voxels above the floor)

`b.box(L, lx0, lz0, lx1, lz1, h0, h1, m)`, `table`, `desk`, `shelf`, `couch`, `bed`, `counter`,
`crates`, `rack`, `tank`, `fireplace`. Give every room cover and character. Keep doorways, stair
ends and a walking lane through each room clear.

## Outside (world coordinates)

`B.surf(x0, z0, x1, z1, m)` paints ground. `B.obox(x0, z0, x1, z1, h0, h1, m)` is a box measured
from the ground. Props: `car`, `truck`, `container`, `tree`, `lamp`, `fence`, `barrier`,
`sandbags`, `dumpster`, `line`, `drum`, `rock`. A `fence` that stands between a spawn and the
building gets a gate cut through it automatically.

## What every map must declare

```js
B.spawn('Parking Lot', 100, 12, 0);    // exactly four, one roughly north, south, east and west of the main building
B.meta.bombs = [['Room A', 'Room B'], ...];   // pairs of nearby rooms on the same floor
B.meta.secure = ['Room', ...];
B.meta.hostage = ['Room', ...];
B.meta.defSpawns = ['Room', 'Room', 'Room'];  // three rooms in different parts of the building
b.cam(L, lx, lz, yawDeg, 'NAME');             // defender cameras inside; B.cam(x, y, z, yawDeg, pitchDeg, 'NAME') outside
```

- Only a spawn's **name and side** matter: the game moves each one to 27 m from the walls on its
  side, clears the ground there, builds a cover structure in front of it and checks that no
  window, door or roof edge can see it. Two spawns on the same side is an error.
- `cover` in `define` picks that cover structure: one of the kits in `MAPS.COVER` (`trailer`,
  `woodshed`, `haywall`, `cabin`, `shelter`, `boatshed`, `garage`, `boxcar`, `gardenwall`), or
  your own: `COVER.mykit = b => { b(u0, u1, v0, v1, h0, h1, material); ... }` plus
  `WING.mykit = [wallMaterial, capMaterial]`. Copy the proportions of an existing kit (about 11 m
  across, 3.5 m tall, solid side facing the building).
- `B.meta.afterPad = (B, plan) => { ... }` runs after the world has been enlarged for the spawns,
  if you need to dress the new ground.

## Materials

`DATA.M.NAME` for every existing material (see the `mat(...)` list at the top of `js/data.js`).
Walls people should be able to shoot and breach through use the soft drywall family (`DRY_*`,
`SOFTW` options). Hard materials (CONCRETE, STONE, METAL...) stop bullets. `see: true` makes a
material transparent to sight and bullets break it (glass). Add your own with
`mat('PREFIX_NAME', 0xRRGGBB, { hp, pen, xp, hb, see, glow, pat })`, with a prefix so names never
collide. Patterns (`pat`): 'block', 'brick', 'checker', 'grain', 'logs', 'noise', 'plank',
'planks', 'plates', 'ribs', 'siding', 'stone'.

## The standard for this game

Maps should feel like a place, large and in several parts, the way competitive tactical-shooter
maps are, without copying any real game's map:

- **Three or more distinct parts**: wings, annexes, a tower, a courtyard, an outbuilding joined by
  a covered walk or tunnel. Each part has its own character (materials, room types) and at least
  two ways into it from the rest.
- **40-60 rooms over 3-4 levels.** A main footprint of roughly 150-200 × 100-130 voxels before
  the stretch, or the same area spread over several joined buildings.
- **Routes**: at least three separate staircases between each pair of neighbouring floors, six or
  more hatches, ten or more exterior doors on the ground floor, windows on every façade and floor.
  No dead-end wing: every part can be reached two ways.
- **Objectives**: four or more bomb pairs on at least three different floors or wings, four or
  more secure rooms, four or more hostage rooms.
- **A signature set piece** nobody would mistake for another map (an atrium, a stage, a turbine
  hall, a ship's hold, a cloister...) and a layout shaped by it.
- Finished world no bigger than about 150 × 150 m and 22 M voxels (the checker prints both).

## The layout kit (`js/maps-kit.js`)

Most of the maps are written as floor plans on top of the builder, with `MAPS.KIT` doing the
repetitive work. See `js/maps-new-d.js` and `js/maps-rework-d.js` for eleven complete examples.

```js
const K = MAPS.KIT;
K.begin(B);                                   // after new Builder(...), before anything else
const b = B.building(...), g = B.building(...);
K.shells(B);                                  // once every building exists (repairs shared walls)
b.pal = [M.DRY_BEIGE, M.DRY_SAGE];            // wall colours picked per room; b.pillar, b.plain (no auto floors)
K.plan(b, 1, `
  0-36: Dining Room 34 | Great Hall~ 78 | Bar Lounge 112
  36-48: Lobby Hall 112
  48-72: Kitchen 28 | - 40 | Reception 66 | Ski Shop 100 | - 112`);
K.well(b, 'West Stairs', 28, 48, 'z', 0, 3);  // an enclosed switchback stair, levels 0..3, in the "-" gap
K.atrium(b, 2, 40, 6, 72, 30);                // a railed hole in the floor of level 2 (a double-height hall)
K.flight(b, 1, 35, 30, '-z', 4);              // an open flight with rails, its ends kept clear of furniture
// ... your set piece, by hand, with the builder ...
K.finish({ hatch: 3, cams: 8 });              // doors, ways in, windows, hatches, furniture, cameras
K.spawns('North Name', 'South Name', 'East Name', 'West Name');
```

- **`K.plan(b, L, text, cols)`**: each line is a band of rooms, `z0-z1[@x0]: Name x1 | Name x1`.
  Rooms run from `x0` to each `x1`; `-` leaves a gap; a name ending `~` is left unfurnished (dress
  it yourself); `/nsew` after a name leaves those walls open. With `cols = true` a line is
  `x0-x1[@z0]: Name z1 | ...`. Tile each level completely.
- **`K.well(b, name, lx, lz, axis, lo, hi)`** needs a 13 x 25 gap (`axis: 'z'`, long along z) or
  25 x 13 (`'x'`). It gets a door at each landing into whatever rooms lie along its long sides,
  so put a room or corridor there on every level.
- **`K.finish`** cuts a door between every pair of neighbouring rooms where one is a hall,
  corridor, gallery or stair (by name), between two ordinary rooms about half the time, and
  always where rooms would otherwise be cut off. It only cuts where there is clear floor three
  voxels deep on both sides, so build stairs, atriums and set pieces first. Rooms are furnished
  by what their names say they are (office, store, bunk, kitchen, lab, plant room, lounge,
  workshop...).

## Checking

```bash
node tools/mapcheck.js <id> [<id> ...]     # must end "ok" with no ERROR lines; read every warning
node tools/mapcheck.js --plan <id>         # the same, plus each floor drawn in ASCII
```

The checker runs the real build and verifies: objective rooms exist, every room has reachable
floor, every spawn has a full route to every objective room, every staircase joins its floors,
and no spawn is visible from the building. Use `--plan` to look at what you built: `#` wall,
`=` glass, `o` furniture, `.` floor, `,` floor cut off from the rest, `/` stairs, `H` hatch.
Fix every ERROR. Fix or consciously accept each warning.
