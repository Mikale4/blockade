# The big expansion: 24 operators, 12 maps, City Z

The request (pasted in full on 2026-11-20): 24 new operators, 12 new maps with a mechanic each, and
**City Z**, a five-operator co-op zombie-survival mode with its own world, survival systems and a story
campaign. It is far too big for one pass, so it is built in phases and **this file is the record**: every
item is listed with an honest status. Nothing is marked done until it works for players, bots and, where
it applies, online guests.

Status words: `planned` · `building` · `built` (works, tested offline) · `done` (also tested in bot rounds
and online) · `partial` (what is missing is written next to it).

## 0. What the project is (the inspection)

Plain JavaScript + three.js r128, no build step. Voxel world at 0.25 m (`js/world.js`); maps are
built from room plans by `js/maps-kit.js` and registered with `MAPS.define`. Operators are data
(`js/data.js`) plus behaviour; the seasons 10-14 operators live in a hook registry (`js/ops2.js`:
`OPS2.ABIL / GADG / DEPLOY` fall through from `GAD`, and ~30 named hooks chained with `OPS2.chain`),
which this expansion reuses rather than reinventing. Bots: `js/ai.js` (plans, tasks, fights) and
`js/persona.js` (playstyles). Pathfinding: `js/nav.js` with links (ladders, crawl holes, ziplines).
Online: `js/online.js` (rooms over PeerJS) and `js/np.js` (host-authoritative matches: snapshots of
actors, entities and changed voxels; guests send input and actions). Modes: Bomb / Secure / Hostage plus
arcade TDM / DM (`js/arcade.js`). 18 maps, 58 operators, 31 weapons, 16 gadgets before this.

Engine facts that shape the design:
- Entities can block bodies (`solid`) but nobody can stand on one, so anything you walk on (scaffold,
  platforms) is built from voxels: that also gives it pathfinding, bullet penetration and destruction.
- A map is one voxel block (the largest is ~120 x 110 m). A "massive wasteland" cannot be one block, so
  City Z is a **region of connected zones**, each a voxel block of its own, entered by road at its edges;
  the zone you leave is saved (looted containers, dead infected, doors, barricades) and restored on return.
- There is no recorded voice. Voice lines are written dialogue shown as radio subtitles and spoken by
  the browser's speech synthesis with a different voice, pitch and pace per operator (a setting turns
  speech off). Voice *chat* between players would use the WebRTC link the online mode already has.

## 1. Plan and order

1. Inspection and this plan. `done`
2. Operators, in four batches of six by unit (each its own file `js/ops3-*.js` on the OPS2 registry),
   with the new weapons in the first batch and the voice-line system (`js/voice.js`).
3. Maps, two batches of six; each mechanic is a small reusable system in `js/mapmech.js`.
4. City Z foundations: region and zones, the infected (common, special, horde, infected operators),
   senses, survival stats, inventory, loot.
5. City Z systems: survivors and dialogue, squad commands for AI teammates, safehouses, crafting,
   vehicles, world events, five-player online co-op.
6. City Z campaign: chapters, missions, characters, choices, endings, saves.
7. Polish, online tests, performance.

## 2. The 24 operators (seasons 15-18)

Four new units of six. Every ability has counterplay; none is a stat buff. Each operator gets a look
(head, back pack, colours), a country, a biography, a personality and voice lines, a gun list chosen for
them, and bot behaviour.

### KEYSTONE (architecture: changing the building) — season 15, batch A
| Operator | Side | Country | Ability | What it does | Counters |
|---|---|---|---|---|---|
| PIVOT | atk | Chile | HINGE CUTTER (2) | 4 s to cut a door-sized panel in a soft wall into a hinged door. Closed it is the wall again; open, it swings aside. He opens or shuts all his doors from anywhere; anyone beside one can open or shut it by hand. A quiet breach you can close behind you. | Takes 4 s and hums; Strain gauges catch it; shooting or blasting the panel breaks it for good; no reinforced walls. |
| BOUND | atk | Kenya | SPRING PLATE (3) | A floor plate that throws whoever steps on it up and forward in the direction it faces: onto a balcony, a roof, a first-floor window, over cover. Both teams can use it. | Loud launch and landing; two bullets kill a plate; a defender can use it too; you land where they expect. |
| PLUMMET | atk | Norway | DROP LINE (1 line) | From a floor hole or broken hatch, anchor a winch line and lower yourself into the room below: stop at any height and shoot from the ceiling, go back up, let go. | One bullet in the anchor drops you; you hang in the open; the winch whirs. |
| PERCH | def | Scotland | SCAFFOLD KIT (2) | A 1.25 m steel scaffold with steps, built in 3 s: new high angles over cover and windows inside a room. | Frames stop few bullets; explosives and melee take it apart; you are high and exposed. |
| WINCH | def | Philippines | ROTATION HOIST (2) | Rigs a hoist at a floor hole or hatch: anyone (either team) rides it up or down a floor in 1.5 s. Fast vertical rotations. | Loud; the attackers can ride it too; one bullet in the motor stops it. |
| STRAIN | def | Japan | STRAIN GAUGES (4) | Glued to a wall, floor, hatch or barricade (steel too). Anything that cuts, breaches, degausses, melees or sticks a charge to that patch (2.5 m) marks whoever did it for 3 s. | Each gauge is 1 HP and shows on scans; it reports only its own patch. |

### PRISM (sight and deception) — season 16, batch B
| Operator | Side | Country | Ability | What it does | Counters |
|---|---|---|---|---|---|
| STAIN | atk | India | DYE GRENADES (3) | A burst of indelible dye: every defender caught turns bright orange for 20 s (their model, not a wallhack): easy to see at a glance, a cloaked or camouflaged body included. | Sprinklers and the extinguisher wash it off; it marks nobody through walls. |
| GLANCE | atk | Ireland | CORNER MIRROR | Hold to look around a corner or over cover with a telescoping mirror without leaning out. | The mirror glints (Glint's tape sees it); shooting the mirror ends it; you cannot shoot while looking. |
| FEINT | atk | Brazil | FEINT CHARGES (3) | A charge that does everything a breach charge does (the plant sound, the beep, the blast, the dust, the alarm bots hear) except make a hole. Pulls a rotation. | Hit it before it goes off; no hole means sharp defenders learn it's fake. |
| GLINT | def | South Africa | LENS TAPE (4) | Reflective strips: any attacker optic, drone, rotor or flank cam that looks at a strip within 15 m flashes a glint at its own position for the defense. | Tiny, 1 HP each; you only learn someone is watching, not what they saw. |
| CHAFF | def | Sweden | CHAFF CANISTER (2) | A 6 m cloud human eyes see through but cameras, drones and scopes do not: devices show static there; marks and pings fail inside it. Lasts 25 s. Defender cameras too. | Walk in and look; sprinklers settle it; it blinds your own cameras. |
| BLUFF | def | Morocco | DECOY KIT (4) | Fake gadgets (a C4, a turret, a camera, an alarm) that look real on drones and scans. Shooting or meleeing one marks whoever did for 4 s. | Real gadgets look the same: an EMP or a bullet tells you; a waste only if you fall for it. |

### CAIRN (support and logistics) — season 17, batch C
| Operator | Side | Country | Ability | What it does | Counters |
|---|---|---|---|---|---|
| SUTLER | atk | Mongolia | SUPPLY CRATE (1) | A crate with four pulls: each refills one gadget charge (not abilities) and the magazines of whoever opens it. | Opening takes 2 s; it beeps; explosives destroy it. |
| CASTER | atk | Austria | ROLLING MANTLET | A wheeled steel plate he pushes ahead (slow); teammates move behind it. Plant it as cover. | Flanks, explosives under it, slow on stairs (it cannot climb them). |
| HOUND | atk | Australia | K-9 UNIT "PATCH" | A robot dog: follows her, or is sent to a spot; within 6 m of a defender (through walls) it stops and points, barking; the team sees the bearing. | 30 HP; the barking tells the defense where it is; it points, it doesn't mark positions. |
| TETHER | def | Ghana | LIFELINE LINK | Links him to a teammate within 10 m: damage either takes is split between the two; once per round, a blow that would down the partner is taken by him instead. | Break line (over 15 m apart ends it); a frag on both still kills both. |
| DRAG | def | Czechia | COUNTERMEASURE COIL (2) | Near an objective it slows the defuser's progress, the secure meter or the extraction by 35%. | Hums, 2 HP, EMP shuts it off; it does nothing far from the objective. |
| MAGPIE | def | Vietnam | SALVAGE KIT | 2 s to defuse an attacker's breach charge, claymore, flank cam or feint charge, which goes into her pocket to place as her own. | You have to reach the gadget; a charge detonated early hurts her. |

### WIREFRAME (signals and machines) — season 18, batch D
| Operator | Side | Country | Ability | What it does | Counters |
|---|---|---|---|---|---|
| ARCHIVE | atk | Estonia | AFTERIMAGE SCANNER (3) | A 2 s scan of a 12 m cone: shows where defenders *were* 8-15 s ago, as ghosts. | Old news: defenders who moved are elsewhere; they can walk a false trail. |
| LODESTONE | atk | Canada | MAGNET CHARGE (2) | Sticks, then yanks every small metal gadget within 5 m (alarms, sensors, C4, caltrops, cameras, coils, gauges) into a clump on itself; C4 pulled in is disarmed. | Non-metal kit (resin, curtains, holograms, foam) ignores it; the hunter seeker can catch it. |
| EARSHOT | atk | Peru | PARABOLIC MIC | Hold to listen down a narrow cone at 3x range: every sound in it shows as a bearing pip on your compass. | Bearings, not positions; you are slow and deaf to the sides while listening. |
| GUST | def | Netherlands | TURBINE FAN (2) | A fan on the floor: blows smoke and gas away, throws grenades and thrown gadgets back out, pushes drones back. Loud. | 3 HP; it covers one doorway; its roar hides footsteps on both sides. |
| CANARY | def | Egypt | EQUIPMENT SNIFFER (3) | A sensor that reports every attacker gadget deployed within 10 m (a charge planted, a drone driven past, smoke, a rivet) with a marker where it happened. | It sees equipment, not people; 1 HP; jammed by EMP. |
| CAROM | def | Italy | RICOCHET PLATE (3) | An angled steel plate: bullets that hit it glance off at the reflected angle with 70% damage. Bank shots into a room. | Works for the attackers too; explosives knock it flat. |

### New weapons (batch A)
MAKO-556 (bullpup assault rifle, quick to aim), HUSKY (50-round SMG, slow and steady), TALON (machine
pistol), WARRANT .45 (heavy pistol), BREAKER 12 (magazine-fed semi-auto shotgun), RAZOR (light fast
DMR), HERON (semi-auto sniper rifle, 4x), BRUNT (box-fed LMG with a bipod), NAILER (silent nail gun,
close range). Each new operator's guns are chosen for them.

### Operator synergies (by design)
Pivot's doors + Glance's mirror (look before you open) · Bound's plates + Plummet (up, then down
through a roof hole) · Sutler's crate + Feint / Stain / Lodestone (more charges) · Hound's bearings +
Earshot (two bearings cross on a position) · Archive's ghosts + Stain (find, then mark) · Perch's
scaffold + Carom's plate (bank shots from height) · Winch's hoist + Strain's gauges (fast rotation to
the floor that's being cut) · Chaff + Bluff (scans that can't see real kit from fake) · Magpie steals
Feint's charges · Gust blows back Stain's dye and Lodestone's charge · Drag + Tether (hold the site).

## 3. The 12 maps (each with a mechanic)
| # | Map | Place | Mechanic | Status |
|---|---|---|---|---|
As built. Several planned names were replaced because the game already had that kind of place (a dam,
an observatory, a cannery, a theatre, a greenhouse dome, a rail depot): TERMINUS, SLUICEWAY,
COPPERLINE, STARGAZE, SALTMARSH, VERDANT and GRAND REGAL became the maps below. Halcyon Tower was built as
Zenith Tower and Stronghold as Vaultline.

| # | Map | Place | Mechanic | Status |
|---|---|---|---|---|
| 1 | UNDERLINE | metro interchange | a train through the platform hall every 45 s, horn first; deadly on the track | built · tested (horn, a man on the track killed) · bot round, no errors |
| 2 | ZENITH TOWER | penthouse floors of a glass tower | facade gondola between the three floors | built · tested (carries a rider up a floor) · bot round, no errors |
| 3 | VAULTLINE | bank HQ | security desk: lockdown grilles; vault-level lights | built · tested (261 bars; a route 16.5 -> 30.7 m; dark blocks sight past 6 m) · bot round, no errors |
| 4 | MERCY GENERAL | hospital | a lift on four floors (bots ride it); ward blackout | built · tested (called, ridden; 6 lift links) · bot round, no errors |
| 5 | GALLERIA | shopping centre | escalators that carry you; shop grilles every 50 s | built · tested (3.9 m along and 2.75 m up in 4 s; grilles) · bot round, no errors |
| 6 | AQUARIUM | public aquarium | the great tank breaks and floods the hall; a sluice floods the basement | built · tested (floods to 1 m, wading at 60% speed) |
| 7 | SKYGATE | airport | jet bridge between the gate and an airliner; baggage belts between floors | built · tested (gate to aircraft door and back with a rider) |
| 8 | DEEPCUT | colliery | the cage in the shaft (bots ride it); timber props hold the pithead floor up | built · tested (a bot rode the cage 0.25 -> 6.25 m; the floor fell, the man under it hit for 45) |
| 9 | LIFTBRIDGE | canal basin | lifting bridge from a lever and every 60 s; a high footbridge | built · tested (lever up and down, raises itself on its timer) |
| 10 | BROADCAST HOUSE | TV centre | lighting desk blackout; two sliding scenery flats | built · tested (both flats out and back; five rooms dark) |
| 11 | COLDSTORE | data centre | gas suppression in each of three data halls | built · tested (alarm, gas, 25 damage to a man inside) |
| 12 | TIMBERLINE | sawmill | log carriage with a log on it; sawdust fires that creep | built · tested (a rider carried 14 m; one blast became three fires) |

Every map passes `node tools/mapcheck.js` (objectives exist, every room reachable, a route from each
attacker spawn to every objective, stairs connect, spawns unseen from windows). Presentation: each has a
description, a lighting theme, a menu card tint and named rooms (the callouts); there is no separate
loading-screen art or per-map soundscape yet.

## 4. City Z (summary; the full design is written in the City Z phase)
**A persistent world, not a list of missions** (added 2026-11-20): one saved wasteland. You travel
between its locations on foot or by vehicle, come back to your safehouses, discover areas you have not
been to, and the world remembers what you did: rooms you looted stay looted, cleared streets stay
clearer (until a horde moves through), barricades you built and safehouses you restored stay built,
survivors you rescued live where you sent them, settlements you supplied grow. Story missions happen
*in* that world, at its locations, rather than as separate levels.

Five operators (players and/or AI teammates) in a region of zones: a town, a city centre with a mall, a
hospital district, an industrial estate, a military checkpoint and quarantine zone, farms, a subway, a
refugee school, a highway. Survival: hunger, thirst, fatigue, stamina, bleeding, injuries, infection,
temperature. Loot by place (shelves, fridges, lockers, cars, bodies), inventory with weight, ammunition
by calibre, crafting, safehouses to restore and upgrade, vehicles with fuel and damage, infected that
hear and see (common, fast, armoured, special infected with their own AI, hordes, infected operators
who still use guns and gadgets), survivors to talk to, trade with, rescue or refuse, squad commands,
dynamic events, day and night and weather, and a story campaign in chapters with choices and endings.

## 5. Status
| Item | Status |
|---|---|
| Plan and inspection | done |
| Voice-line system (`js/voice.js`) | built: subtitles + speech per operator, cooldowns and priorities, host-to-guest sync, intro on the select screen, settings; lines for batch A and generic lines for the 58 older operators |
| New weapons (9) | built (data, attachments; the 3D models use their class's shape) |
| Batch A: Pivot, Bound, Plummet, Perch, Winch, Strain | built · every ability tested offline · bot rounds on 5 maps, no errors: bots cut and open doors, launch off plates, punch through floors and drop in, build and hold scaffolds, ride hoists, gauge walls and get alerts |
| Batch B: Stain, Glance, Feint, Glint, Chaff, Bluff | built · each ability tested offline · bot rounds (see notes) |
| Batch C: Sutler, Caster, Hound, Tether, Drag, Magpie | built · every ability tested offline · bot rounds on 3 maps, no errors |
| Batch D: Archive, Lodestone, Earshot, Gust, Canary, Carom | built · every ability tested offline · bot rounds (see notes) |
| HUD readings for guests (gauge alerts, glints, bearings, afterimages, mic bearings, sniffer alerts) | built: sent host to guest as they are made |
| Victory poses and selection-screen artwork beyond the live busts | planned (polish phase) |
| Unique first-person hands per operator | partial: arms take each operator's colours; no per-operator hand models yet |
| Maps 1-6 (Underline, Zenith Tower, Vaultline, Mercy General, Galleria, Aquarium) | built · mechanics tested · bot rounds |
| Maps 7-12 (Skygate, Deepcut, Liftbridge, Broadcast House, Coldstore, Timberline) | built · mechanics tested · bot rounds |
| Bots and the machinery | bots ride lifts on their paths; any bot beside a panel works it when it helps its side (gas on enemies, lights out on attackers, grilles down, bridge up, flats moved, a flood on enemies); one defender in two rounds holds the room with the panel nearest him |
| Per-map loading-screen art and soundscapes | not built (the maps use the shared card, theme and ambience) |
| City Z: persistent world (save, clock, weather, ten places, travel by road, every change kept) | built · tested: a place left and re-entered (after a page reload) keeps its boarded windows, searched rooms, infected count and stash |
| City Z: places (`tools/czcheck.js` builds and checks all ten) | built · all ten pass (every room reachable, all road ends joined) |
| City Z: survival (hunger, thirst, fatigue, stamina, bleeding, fractures, body heat, sickness, infection) | built · tested (needs rise, bites infect and open wounds, effects apply) |
| City Z: packs, weight, ammunition by calibre, found guns, searching rooms by kind, crafting | built · tested |
| City Z: infected (walker, runner, brute, screamer, spitter, lurker, infected operators, hordes) | built · tested (they hear, chase, bite, beat barricades; the squad fights them) |
| City Z: safehouses (restore, stash, bed and sleep, 7 upgrades), survivors with skills, daily production | built · restore, stash and sleep tested |
| City Z: squad orders and control (follow, hold, attack, scavenge, quiet; take over any member) | built · follow, hold and taking over on death tested |
| City Z: vehicles (drive, fuel, damage, run over, refuel, repair, drive to the next place) | built · driving tested |
| City Z: campaign (7 objectives, characters, choices, 3 endings, day-20 deadline), events (drops, hordes, distress, road), radio | built · every story place and the finale tested; a full play-through by hand not yet |
| City Z: online co-op (five players in one city) | not built yet: City Z is single-player with four AI teammates |
| City Z: campaign length | honest note: seven objectives, a few hours with the scavenging between them, not 6-10 hours of authored missions |

## 6. Notes from testing
- Batch A. Pivot: a 45-voxel door cut in 4 s; open, the path through goes from 16 m round to 1.4 m.
  Bound: lands within 0.4-0.8 m of the predicted arc, 3-3.75 m up, no fall damage; the plate is a
  one-way path link bots use. Plummet: hangs and fires from the line, climbs out, the anchor shot drops
  her; with no hole she punches one (lodge, museum, millrace: down into the site). Perch: a 0.75-1.5 m
  deck as the room allows, walkable, mostly destroyed by a frag. Winch: rides up and down land on the
  right floor; one bullet removes the hoist and its link. Strain: an attacker's shot, charge or cut on a
  gauged patch marks them; a defender's own shot does not.
- Batch B. Stain: the dyed defender turns orange (and only the enemy), water washes it off; bots see a
  dyed target through darkness and cloak. Glance: the camera moves to the mirror 0.68 m out, no
  firing meanwhile, a shot mirror locks it 6 s. Feint: scans as a breach charge, blows out the barricade
  (40 voxels) and makes the explosion noise, no hole. Glint: both a scoped attacker and a drone
  glint. Chaff: a mark on someone inside fails, outside works; a device can't see through the cloud but
  can past it; water settles it. Bluff: decoys place and scan as the real kind; shooting one marks the
  shooter. (Bluff's ability was first called `decoy`, which is Lark's: renamed `bluffkit`.)
- Batch C. Sutler: a pull gives back a gadget charge and fills the reserve (5 -> 150). Caster: 60%
  speed pushing, a frontal round stopped by the plate, planted it blocks bodies, his team can push it
  again. Hound: the dog follows, and points straight at a defender 3 m away through a wall (the
  bearing's direction matches exactly). Tether: a 40-damage hit split 20/20; a lethal blow on the partner
  taken by him instead. Drag: a defuser beside a coil lost 1.3 s of its countdown in 2 s; the secure meter
  runs at 0.65. Magpie: an attacker's claymore salvaged and placed as hers ignores her team and hit an
  attacker for 72.
- Batch D. Archive: a defender who stood 6 m ahead 12 s ago shows as a ghost at exactly that spot,
  aged 12 s. Lodestone: a sensor and a decoy within 5 m pulled into the clump and dead, a C4 destroyed,
  one 8 m away untouched. Earshot: a footstep 20 m straight ahead shows as a bearing, one to the side
  doesn't; half speed; the sound cone is on. Gust: a 12 s smoke cut to 1.3 s; a grenade thrown into the
  fan's stream goes back out; a footstep beside the fan isn't heard, one 15 m off is. Canary: a claymore
  set near the sniffer is reported, one 25 m away isn't. Carom: a level round at the plate turns 90
  degrees and hits a man round the corner for 70% (26 of 37); a round from behind is just stopped.
  (Fixes on the way: the turned round started inside the plate's own box; it now leaves from the plate
  itself, and the plate is full height so rounds meet it level.)
