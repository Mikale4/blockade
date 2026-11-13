# MILLRACE — design plan

An original map for BLOCKADE. A family farmstead that grew for a century around an old stone grist
mill: a weathered farmhouse, a brick feed store bolted onto its side in the fifties, the four-storey
mill on its dry race, a machine shed, and the tunnels people dug between their cellars. Overcast
morning.

The goal is the *kind* of play a big rural tactical map gives (several wings, a real basement,
vertical fights, many ways into every objective, a large outside) with a layout of its own. Nothing
here traces another game's map.

All numbers are voxels before the ×1.4 stretch (1 voxel = 0.25 m). Levels: 0 basement, 1 ground,
2 upstairs, 3 mill top. x runs east, z runs south.

## 1. Property layout (world)

```
 z  0 ┌───────────────────────────────────────────────────────────────────────┐
      │                       C O U N T Y   R O A D   (gravel, z 16-30)        │
   30 │      orchard                     drive ║                               │
      │      (trees)                           ║        paddock (fenced)       │
   92 │            porch ══════════════  ┌─────╨──────┐                        │
  100 │      coop  ┌───────────────────┐ │  FEED      │                        │
      │            │   FARMHOUSE  H    │═│  STORE  S  │   silo ○               │
      │            │   90 × 61, B-2F   │ │ 72×67, B-2F│                        │
  160 │            └──────┬─C─┬────────┘ └──────┬U┬───┘                        │
      │                   │ │ │ tunnel           │ │ │ tunnel     race ≈≈≈     │
  192 │   ┌───────────────┴─┴─┴──┐   hay shed    ┌┴─┴─┴────────────┐ ≈≈ ┌───┐ │
      │   │  MACHINE SHED  T     │  (pole barn)  │  GRIST MILL  M  │ ≈≈ │ P │ │
      │   │  60 × 48, B-2F       │   hay stacks  │  60 × 61, B-3F  │ ≈≈ └───┘ │
  240 │   └──────────────────────┘               │  stone, wheel   │ ≈≈ pump  │
  256 │                                          └─────────────────┘ ≈≈ house │
      │                C O R N   R O W S                                        │
  290 └───────────────────────────────────────────────────────────────────────┘
     x 0        40        100      149  200 220     255  268   291           330
```

| Part | World box (x, z) | Levels | Shell | Character |
|---|---|---|---|---|
| H Farmhouse (main) | 60-149, 100-160 | B, 1F, 2F | weathered siding (breachable) | wallpapered rooms, wood floors, cellar of stone |
| S Feed Store | 149-220, 94-160 | B, 1F, 2F | brick (breachable) | concrete floors, shop, offices, stock basement |
| M Grist Mill | 196-255, 196-256 | B, 1F, 2F, 3F | stone (bulletproof) | timber interior, 3-storey wheel pit |
| T Machine Shed | 40-99, 192-239 | B, 1F, 2F | corrugated steel | double-height shop under a loft, inspection pit |
| U Mill Tunnel | 200-214, 160-196 | B | stone | store basement ↔ mill basement |
| C Cellar Tunnel | 80-92, 160-192 | B | stone | farmhouse cellar ↔ shed basement |
| P Pump House | 268-291, 214-237 | 1F | stone | lone outbuilding by the race |

H and S share the wall line x = 149: their halls line up on every floor, so the two are one
building inside (doors cut through on all three levels).

## 2. Floor plans (local coordinates of each building)

### Farmhouse H (lx 0-89, lz 0-60)

| Level | North band lz 0-24 | Hall lz 24-36 | South band lz 36-60 |
|---|---|---|---|
| B | Root Cellar · Canning Room · Boiler Room · Wine Cellar | Cellar Hall | Coal Bin · Workshop · [House Stairs] · Cold Storage · Storm Shelter |
| 1F | Mud Room · Farm Kitchen · Dining Room · Front Parlour | Long Hall | Pantry · Laundry · [House Stairs] · Family Room · Den |
| 2F | Master Bedroom · Bathroom · Kids Bedroom · Guest Bedroom | Upstairs Hall | Linen Room · Nursery · [House Stairs] · Sewing Room · Old Office |

Column breaks (lx): north 0|16|46|68|89 on 1F (cellar 0|18|42|66|89, upstairs 0|24|40|64|89);
south 0|16|38|50|72|89 (cellar 0|16|38|50|70|89, upstairs 0|16|38|50|70|89). House Stairs
occupies lx 38-50, lz 36-60 on every level.

### Feed Store S (lx 0-71, lz 0-66)

| Level | North band lz 0-30 | Hall lz 30-42 | South band lz 42-66 |
|---|---|---|---|
| B | Fertilizer Store · Stock Room | Store Cellar Hall | Pump Room · [Store Stairs] · Bagging Room |
| 1F | Front Office · Seed Room · Showroom | Store Hall | Feed Room · [Store Stairs] · Sales Floor |
| 2F | Ledger Office · Records Room · Owners Suite | Store Upper Hall | Bulk Loft · [Store Stairs] · Grain Office · Sample Lab |

Store Stairs occupies lx 22-34, lz 42-66. The store's halls (world z 124-136) meet the farmhouse
halls through the shared wall.

### Grist Mill M (lx 0-59, lz 0-60)

| Level | North band lz 0-24 | Hall lz 24-36 | South band lz 36-60 |
|---|---|---|---|
| B | Tunnel Landing · Grain Pit · Wheel Pit | Mill Cellar Hall | Sack Store · [Mill Stairs] · Race Gate Room |
| 1F | Miller Office · Millstone Floor · Wheel Room | Mill Hall | Bolting Room · [Mill Stairs] · Loading Bay |
| 2F | Hopper Room · Stone Loft · Wheel Gallery | Mill Upper Hall | Sifter Room · [Mill Stairs] · Sack Hoist Room |
| 3F | Bin Floor · Hoist Head | Bin Hall | Grain Bins · [Mill Stairs] · Lookout Loft |

Columns: north 0|18|40|59, south 0|20|32|59. Mill Stairs lx 20-32, lz 36-60, levels B-3F.

**Set piece — the wheel pit.** The Wheel Pit (B), Wheel Room (1F) and Wheel Gallery (2F) stack
up the mill's east side. The 1F and 2F floors are open over lx 44-55, lz 4-20 with rails round
the holes, so the pit is a nine-metre shaft. The great oak wheel stands against the east wall in
it, its axle running west at head height into the Millstone Floor, where two millstones on timber
stages and a crown gear fill the room. Fights in the pit happen across three floors at once.

### Machine Shed T (lx 0-59, lz 0-47)

| Level | North band lz 0-24/30 | South band |
|---|---|---|
| B | Parts Cellar · Inspection Pit (lz 0-24) | Oil Store · Shed Cellar Hall (lz 24-47) |
| 1F | Machine Shop, double height (lz 0-30) | Paint Booth · Shed Hall (lz 30-47) |
| 2F | Shop Loft, open over the shop (lz 0-30) | Tool Loft · Loft Hall (lz 30-47) |

### Tunnels and the pump house

- U **Mill Tunnel** (B): from the store's Bagging Room south wall to the mill's Tunnel Landing.
- C **Cellar Tunnel** (B): from the farmhouse Workshop south wall to the shed's Inspection Pit.
- P **Pump House** (1F): one stone room by the race.

## 3. Connectivity (rooms)

- Every hall, landing, stair and tunnel opens into each room beside it; ordinary neighbouring rooms
  connect about half the time, and the kit guarantees no room is cut off.
- Farmhouse ↔ store: Long Hall ↔ Store Hall (1F), Upstairs Hall ↔ Store Upper Hall (2F), Cellar
  Hall ↔ Store Cellar Hall (B), plus room-to-room doors through the shared wall (Front Parlour ↔
  Front Office, Den ↔ Feed Room, and their basement/upstairs counterparts by chance).
- Basement network: shed ⇄ Cellar Tunnel ⇄ farmhouse cellar ⇄ store basement ⇄ Mill Tunnel ⇄ mill
  basement. A defender can rotate from the shed to the mill without going outside.
- Every floor of every part has at least two ways in from the rest (stairs + hall door, or stairs +
  tunnel), so no wing is a dead end.

## 4. Stairs and vertical routes

| Between | Routes |
|---|---|
| B ↔ 1F | House Stairs, Cellar Steps (open flight, Cellar Hall → Long Hall), Store Stairs, Mill Stairs, Pit Steps (mill), Shed flight, the farmhouse bulkhead, the store's loading chute and the mill's race gate from outside |
| 1F ↔ 2F | House Stairs, Front Stairs (open flight in the Long Hall), Store Stairs, Back Stairs (store hall), Mill Stairs, Mill Steps, Shed flight |
| 2F ↔ 3F | Mill Stairs, Bin Hall flight, Sack Hoist flight (all in the mill) |

Plus destructible hatches (the kit places up to three per floor per building over open floor
below), the wheel pit's open shaft, soft walls and floors everywhere except the mill's stone
shell, and the porch roof, reachable from the farmhouse's upstairs windows.

## 5. Objectives

| Mode | Rooms |
|---|---|
| Bomb pairs | Boiler Room + Canning Room (B, house) · Stock Room + Fertilizer Store (B, store) · Farm Kitchen + Dining Room (1F, house) · Showroom + Seed Room (1F, store) · Millstone Floor + Miller Office (1F, mill) · Kids Bedroom + Guest Bedroom (2F, house) · Stone Loft + Hopper Room (2F, mill) |
| Secure Area | Family Room · Sales Floor · Machine Shop · Bagging Room · Owners Suite |
| Hostage | Storm Shelter · Nursery · Records Room · Bolting Room · Parts Cellar |
| Defender spawns | Den (house) · Ledger Office (store) · Sack Store (mill) |

Seven bomb pairs over three floors and three buildings; each site has a hall on one side, a
staircase within a room or two, a hatch or soft ceiling over it and an outside wall or window.

## 6. Attacker and defender routes

- **House sites** (kitchen/dining, bedrooms, boiler/canning): from the north porch doors and
  windows, the west mud-room side, the bulkhead into the coal bin, rappel to the upstairs windows,
  vertical play through the soft floors and hatches, or through the store from its yard doors.
  Defenders rotate on the Long Hall / Upstairs Hall / Cellar Hall spine and the three staircases.
- **Store sites** (showroom/seed, stock/fertilizer): the yard doors and big front windows, the
  loading chute into the Stock Room, the back stairs, and through the house. Defenders hold from
  the Sales Floor and the hall junction with the house, and rotate through both basements.
- **Mill sites** (millstone floor, stone loft): the stone shell can't be breached, so attackers
  use the loading-bay shutter, the doors, the race gate into the basement, windows on every
  floor, or the Mill Tunnel from the store's basement. The wheel pit gives attackers on the
  gallery a look down into the 1F and basement, and defenders a fast drop between floors.
- **Shed** (machine shop): the north roll-up door, side doors, the loft windows, and the Cellar
  Tunnel from the house.
- Flankers and lurkers live in the basement network and the hay shed; marksmen get long looks
  across the yard, from the mill's Lookout Loft and the store's upstairs offices.

## 7. Outside

- North: the gravel county road, a drive to a gravel yard in front of the store, the farmhouse's
  covered porch (posts, deck, a roof level with the upstairs floor).
- West: an orchard of rows of fruit trees, a chicken coop, a split-rail fence.
- Middle: the open yard between house, shed and mill, a pole-barn hay shed full of stacked bales
  (soft cover), a tractor, an old truck, fuel tank, water trough.
- East: the dry-stone silo pair, a paddock fence, the mill race (water) with a plank footbridge, the
  pump house.
- South: corn rows (soft, waist-to-shoulder high) toward the south spawn.
- Spawns (the game places them 27 m off the farmhouse): County Road (N), Corn Rows (S), Mill Pond
  (E), Orchard (W).

## 8. Build and check order

1. Shells and floor plans (K.plan), stairwells and flights, tunnels, voids.
2. The wheel pit and the millstones, the shed's double-height shop.
3. K.finish: doors, ways in, windows, hatches, furniture, cameras.
4. The outside: road, yard, porch, orchard, coop, hay shed, silos, race, fences, corn, trees.
5. `node tools/mapcheck.js millrace`: no ERRORs, every warning read. Then all-bot matches on every
   mode with drone scouting and the new bot playstyles, watched in spectator.
