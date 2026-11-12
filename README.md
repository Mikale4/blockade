# BLOCKADE — Tactical Voxel Breach

An original 5v5 attack-and-defend shooter in voxels. Every wall is made of voxels a quarter
of a metre across: shoot through drywall, blow holes in floors, reinforce walls in steel and
burn through them again. You play first person, with four bots on your team against five.

**Play in your browser:** https://mikale4.github.io/blockade/

**Install it** as an app, to get an icon on your desktop or home screen, full screen, and
matches against bots that work offline once it has loaded:
- **Chrome or Edge:** in the game, Settings > Install the game, or the install icon at the right
  of the address bar.
- **iPhone or iPad:** in Safari, tap Share, then Add to Home Screen.

Only the live site installs. A copy served from your own computer (below) only runs while its
server window is open.

**Play locally:** double-click `Play BLOCKADE.bat`. It starts a small local server and opens
http://localhost:8771 in your browser; close its window when you're done. (Without Python it
opens `index.html` straight from disk instead, which also works, but your own sound-effect
files won't load that way.) Click inside the game to capture the mouse; ESC opens the menu.

**First time:** make a player (name + password) on the title screen. Your account and stats
live in this browser, and you get a friend code like `Name#A1B2` for playing online.

BLOCKADE is its own game. Its operators, units, weapons, maps and music are all original.
It borrows the *genre*: prep and action phases, destruction, reinforcement, drones and cameras,
being downed instead of killed, and Bomb, Secure Area and Hostage.

## What's in it

- **Accounts:** title screen → log in / new player → home. Your profile tracks your level
  (XP from every match), matches and rounds won, kills, K/D, headshots, most-played operators,
  your Ranked rating and your credits.
- **Online lobby:** a room list, everyone online, a leaderboard and lobby chat. Use QUICK PLAY,
  HOST A ROOM (public, private with a password, or code only), or join by code.
- **Rooms:** two teams of five. The host picks the map, mode, rounds, bot skill and starting
  side, can fill empty slots with bots, and can lock the room or kick and block players.
  Everyone else readies up, and there's room chat (in matches too, with Enter).
- **Online matches:** you and your friends in the same match, on the same team or against
  each other, with bots in the remaining slots.
- **Ranked:** Bomb, first to four rounds. FIND MATCH looks for real players near your rating
  (an open ranked room, or it opens one and waits up to 30 seconds). Seats nobody fills go to
  bots playing at your level; offline it's you and bots. Ranks run Bronze, Silver, Gold,
  Platinum and Diamond (III to I each), then Elite. Your first five matches are placements.
  Your rating moves by the other team's average rating (beating a stronger team gains more),
  and leaving early counts as a loss. Only Ranked changes your rating.
- **Ban phase:** every Ranked match opens with one. Each team bans one attacker and one
  defender (30 seconds), and nobody on either team can play them for the whole match. Against
  bots you ban for your team and the bots ban for theirs. Online, the first player on each
  team is its captain and bans for it.
- **Parties:** play Ranked with friends. CREATE PARTY (on the Ranked screen), then invite up to
  four friends, or give them the party code to enter under ONLINE LOBBY → JOIN. When the leader
  presses FIND RANKED MATCH, the party is matched as one team at its average rating. Other
  players searching for Ranked fill the other seats first, and bots take any left over. After
  the match the party stays together for the next one.
- **Shop:** spend credits on looks: weapon finishes, uniforms, reticle colours and player
  cards, from Common to Legendary. Three items are 30% off each day. Credits come only from
  playing: every match pays, wins, kills and rounds pay more, online pays 25% extra, Ranked 50%,
  and your first win each day adds 250. Looks never change stats. Everyone in an online match
  sees your finish and uniform.
- **Player-style bot names:** bots have names like a real player picks (QuietOtter, mako_219,
  xFrostline), and each keeps its name, looks and rating for the whole match. Outside Ranked a
  small BOT tag on the scoreboard tells them apart.
- **Friends and messages:** add friends by friend code or from any player card. Messages are
  end-to-end encrypted and wait for friends who are offline. You can invite a friend to a
  match or a room, join their room, or block someone.

- **38 operators** (19 attack, 19 defense) in fourteen units. The launch roster is 20 operators
  across five units, plus nine two-operator season squads:
  - **Season 1 · Ironveil:** Pike (smoke launcher) and Lark (decoy emitter)
  - **Season 2 · Driftline:** Brace (Barrier Foam: a waist-high bulletproof foam wall) and Seam
    (Patch Spray: refills a breached wall, floor or hatch with foam)
  - **Season 3 · Meridian:** Haze (Irritant Shells: a haze that hurts, makes defenders cough and
    marks them) and Lumen (Floodlight: dazzles attackers who look into it)
  - **Season 4 · Umbra:** Wraith (Phase Cloak: six seconds nearly invisible and silent, and
    nothing can mark you; firing ends it) and Nox (Blackout: nine seconds of darkness for the
    attackers while defenders see as normal)
  - **Season 5 · Trawl:** Gaff (Harpoon Line: drags a defender five metres toward you, or rips
    a gadget off the wall) and Moor (Recall Anchor: drop it, roam, and snap straight back)
  - **Season 6 · Override:** Splice (Hijack Dart: a defender's electronic gadget changes sides)
    and Warden (Watchdog Turret: a sentry gun that covers an 80° arc)
  - **Season 7 · Breakline:** Tusk (Battering Charge: sprint straight through a soft wall and
    stagger whoever is behind it) and Ferro (Misfire Coil: attackers' guns near it jam about one
    shot in five and reload slowly)
  - **Season 8 · Kinetic:** Dynamo (Overdrive: seven seconds faster, with snap aim and quick
    reloads, shrugging off wire, snares and stuns, then three seconds winded) and Mimic (Body
    Double: a life-size decoy of herself; whoever shoots it is marked)
  - **Season 9 · Resonant:** Triad (Triangulator: a listening post that marks any defender who
    fires an unsuppressed gun near it) and Veil (Null Field: defenders inside can't be marked
    or revealed, walk silently, and drones lose signal)

  Each operator has an armor/speed rating, two primaries, two secondaries, two gadget choices
  and a unique ability.
- **Live busts:** wherever you pick an operator (operator select, the ban phase, the gallery,
  the range) each one is shown as a small voxel bust from the chest up, turned three-quarters
  to you and alive: breathing, looking about, glancing off now and then, blinking. The
  operator you have selected gets a larger one beside their name.
- **22 primaries and sidearms**, eight of them with a mechanic of their own: the KB-3 (three-round
  bursts), HUSH-45 (suppressed: heard from 10 m instead of 45, no tracer for the enemy, and it
  doesn't set off a Triangulator), HAMMERHEAD .50 (punches through soft walls with most of its
  damage), MODEL 8 SLUG (one heavy slug instead of pellets), BANKSHOT (rounds skip once off a
  hard surface, so you can shoot round a corner), RAMPART (a 100-round belt that steadies when
  you crouch or go prone), NEEDLER-6 (flechettes that keep going through cover) and the VERDICT
  (a two-round burst pistol).
- **Pick your spawn:** in operator select every player chooses their own spawn. Attackers pick
  one of the map's outdoor spawns; defenders pick the objective or another room in the building.
- **17 maps.** Every map is a compound in several parts: three to five joined buildings, 45 to 70
  rooms on three or four floors, a double-height centrepiece, a dozen or more ways in from
  outside, enclosed stairwells and open flights between every pair of floors, 8 to 20 hatches,
  5 or 6 bomb-site pairs spread over different floors and wings, plus Secure Area and Hostage
  rooms. The nine original maps were rebuilt to this standard:
  - **Roadhouse**: a highway truck stop. Diner and bar over a brewery, a two-storey motor
    workshop with inspection pits, a motel wing round a court, a fuel station (dusk)
  - **Summit Lodge**: a mountain hotel. A great hall open through two floors round a stone
    hearth, a guest wing, a spa with a sunken pool, a gondola station, an attic (snow)
  - **Homestead**: a farm. Farmhouse and attic, a bunker under the yard that runs from the
    cellar to the barn, a hay barn open through two floors, a dairy and tractor shed (afternoon)
  - **Checkpoint**: a desert border complex. A double-height customs hall, a vehicle shed over
    inspection pits, a detention block, barracks and a watchtower round an inner yard (noon)
  - **Helix Labs**: an island research campus round a glass atrium where a glowing double helix
    climbs three floors, with a containment wing and a dock house (night)
  - **Cannery**: a harbour cannery. The canning hall under its catwalk, ice plant and brine
    cellars, an office block with a smokehouse and net loft, a boat shed with a hull on the
    slip (foggy morning)
  - **Observatory**: a summit observatory. The great telescope dome ringed by a gallery, a
    planetarium, optics workshops, a residence wing, a second dome down a covered link and a
    tunnel, a cable-car terminal (starry night)
  - **Rail Depot**: a terminus. A galleried concourse and clock tower, a train you can walk
    through at the platform, a freight tunnel under the tracks, an engine shed with two
    locomotives over their pits, a goods warehouse (rainy dusk)
  - **Museum**: a natural-history museum. Four floors of galleries round a skylit atrium with a
    fossil skeleton, a dinosaur hall, an antiquities wing, vaults below (evening)

  And eight new ones:
  - **Aurora Station**: a polar research station. Insulated modules on corridor spokes round a
    domed hub, a drill hall cored down into the ice, ice tunnels to the generator plant (night,
    under the aurora)
  - **Freighter**: a coastal freighter moored in a container port. Cargo holds and the engine
    room, deckhouses, a three-storey bridge, a customs house and a warehouse on the quay
    (overcast)
  - **Ironwood**: a decommissioned penitentiary. A three-tier cell block, a rotunda where the
    wings meet, a mess and laundry wing, the warden's offices, a fenced yard under two
    watchtowers (grey, windy day)
  - **Grand Theatre**: an opera house. The stage under its fly tower, an auditorium with a
    horseshoe balcony over the orchestra pit, a marble foyer, a backstage annex (wet night)
  - **Iron Gorge Dam**: a hydro station. Three generators in the turbine hall, inspection
    galleries the length of the dam wall, an admin tower, a switchyard (overcast)
  - **Cloister**: a hilltop abbey round an open courtyard. Chapel with stained glass and a
    crypt, a library and brewery range, a dormitory range, a refectory (dawn)
  - **Biodome**: a jungle growing under a glass dome, ringed by walkways on two floors, with
    lab, visitor, arid-house and water-plant wings (late afternoon)
  - **Foundry**: a steelworks. The casting hall round its blast furnace with glowing runners in
    the floor, a rolling mill, a power house, an office block (smoky sunset)

  New maps go in their own file (`js/maps-*.js`) and register with `MAPS.define`; see
  [tools/MAPS.md](tools/MAPS.md). `node tools/mapcheck.js` builds every map headlessly and
  checks objectives, room reachability, spawn-to-objective routes, staircases and spawn
  sightlines.
- **Modes:** Bomb (plant the defuser and protect it, or disable it), Secure Area (hold the room
  with no defenders inside), Hostage (escort the hostage out; harming the hostage loses).
  Sides swap every round (optional), and the first team to N rounds wins.
  - **Team Deathmatch:** two teams of five with respawns, no objective. First team to 40 kills,
    or the most kills after 7 minutes.
  - **Deathmatch:** ten players, everyone for themselves, any operator. First to 20 kills, or
    the most after 6 minutes.

  In both, you respawn 4 seconds after dying at the safest spot: away from the enemy, out of
  their sight and (in Team Deathmatch) near your team. Two seconds of spawn protection end
  when you fire. There's no down-but-not-out, drones, cameras or reinforcements, and the
  match-winning kill replays at the end.
- **Shooting Range:** any operator, targets at 5–50 m (some moving), a breach house with soft,
  reinforced and barricaded surfaces and a hatch, a drone tunnel, and a kill-house drill
  against live bots.
- **Training:** 16 guided lessons covering movement, stances, leaning, shooting, headshots,
  vaulting, soft and hard breaching, drones, spotting, barricading, reinforcing, defender
  gadgets, planting and reviving.

## Mechanics

- **Destruction:** bullets chip and penetrate soft voxels (drywall, wood, barricades, glass);
  explosives tear holes; reinforced steel only falls to a hard breach (Kiln's Plasma Bore).
- **Preparation phase (45 s):** attackers pilot drones (spot with fire); defenders reinforce
  walls and hatches from a 10-panel team pool (+2 per Brick), barricade doors and windows, and
  place gadgets. Defenders can't leave the building until the action phase, and attackers
  can't be hurt in prep. Each map has four attacker spawns, one off each side of the building
  and at least 25 m from it, each behind one cover structure that suits the map (a parked
  trailer, a woodshed, a hay shelter, a boxcar...). At map load every spawn is checked against
  every door, window and roof edge; where an outbuilding can still look past the cover, that
  end gets a return wall. Fences on the way in have gates.
- **Action phase (3 min):** vault (low walls, windows), rappel up outside walls onto roofs, lean,
  crouch, go prone, melee through barricades and hatches.
- **Rappel and window entries:** attackers facing an outside wall get a RAPPEL prompt. On the
  rope you can climb, move sideways, shoot, and hang upside down to peek into a window from
  above. Beside a window, Space crashes you in feet-first: the glass or barricade shatters and you
  land crouched inside, loudly. A reinforced or blocked window won't give. From the ground,
  vaulting into a glass or barricaded window breaks it as you go through.
- **Shields:** carried low on the left with a glass viewport, so you can see past them. Held up,
  a shield stops bullets from the front, from the shins up (all the way down when you crouch),
  and you hip-fire your sidearm beside it. Aiming swings it aside so you shoot past its edge,
  which exposes part of your head and your gun arm. Sprinting swings it to your flank.
  Melee is a shield bash: a short lunge that knocks the target's aim and slows them.
  You can't go prone while holding one.
- **Down but not out:** lethal non-headshot damage usually downs you; teammates revive (hold
  interact). Headshots kill outright (shotgun pellets just hit harder).
- **Kill cam:** when you're killed you see the last few seconds again through your killer's
  eyes, in first person with their gun on screen, the way they saw it. A round that ends on a
  kill replays that kill for everyone before the result. The killing shot plays in slow motion.
  A kill by a gadget or explosive circles the victim instead. Press the vault key (Space) to
  skip; turn it off in Settings.
- **Spectating:** once you're dead you watch your teammates in first person too: their hands
  and gun, their sight when they aim, their recoil and reloads. Fire and aim switch teammate.
- **Intel:** drones (attack), cameras (defense; attackers can shoot them), spotting marks
  enemies for your team. Drones roll straight up stairs without jumping, and Sprint gives a
  drone a one-second burst of speed with an eight-second cooldown.
- **Bots:** they path through the building (stairs, breached holes, barricades they smash),
  react to what they see and hear, reinforce and gadget up in prep, plant, disable, escort and
  revive. They use their whole kit: every operator ability, grenades, breaching charges,
  claymores and traps, and they walk over to a teammate's med station or healing beacon when
  they can use it. Choose Recruit, Normal or Realistic.
  - **Attack:** the team splits over two or three entrances on different walls (sometimes a
    window near the site: vaulted on the ground floor, or reached on a rope and crashed through
    higher up, falling back to a door if it's reinforced or blocked), and each bot
    stacks up outside its door. Everyone goes in together once all are in place, as soon as
    anyone makes contact, or after 30 s. Bots keep their spacing instead of walking in a line,
    and they sweep a room's corners and doorways as they enter it.
  - **Defense:** anchors share out the site rooms, keep a few metres apart, and each pre-aims a
    different doorway at head height. Roamers fall back to the site when the defense is losing.
  - **Reading the round:** each team tracks how many players are left on each side, where the
    enemy was last seen, and the clock. Up in numbers (or with one enemy left) and time in hand,
    bots hunt the enemy down. When the objective needs them now, they drop every detour:
    - a dropped defuser: the nearest attacker fetches it while the others cover
    - a planted one: every defender goes to disable it
    - a hostage leaving, or the area being secured: defenders converge on it
    - the last minute: all attackers commit to the objective

    After a plant, attackers spread out to cover the defuser from separate spots. A bot that
    can't hurt its target (a shield, or cover bullets can't get through) stops trading shots
    after a few seconds and gets back to the job.

## Controls (all rebindable: **Controls** in the menu)

| Default | Action |
|---|---|
| WASD / mouse | Move / look |
| LMB / RMB | Fire / aim down sights |
| L-Shift | Sprint |
| Caps Lock | Walk slowly: about half speed, with footsteps quiet enough that only someone right beside you hears them |
| C / Z | Crouch / prone |
| Q / E | Lean (hold **or toggle**, your choice) |
| Space | Vault (smashes window glass or a barricade on the way through), rappel (attackers, facing an outside wall; on the rope W/S climb, A/D sidestep, C hang upside down, Space crash through the window beside you or let go), drone hop |
| R · 1 · 2 · B · V | Reload · primary · secondary · fire mode · melee |
| G | Secondary gadget (press again to detonate charges) |
| X | Operator ability (Rhea: hold to detonate) |
| F (hold) | Interact: plant, disable, revive, reinforce, barricade, escort |
| 5 | Drone (attack) / cameras (defense) |
| L-Shift (in a drone) | Drone boost: about a second of double speed, then an 8 s cooldown |
| T | Spot the enemy under your crosshair |
| Tab | Scoreboard |

Every action, including mouse buttons, can be rebound. Taking a key that another action uses
swaps the two. Lean, crouch, walk and aim each have a HOLD/TOGGLE switch.

## Music

Music comes from the MP3s in `audio/`, through **`audio/playlist.js`**, which lists the files
that play at each moment:

| Pool | Plays during |
|---|---|
| `menu` | title screen |
| `select` | operator select, between rounds |
| `prep` | preparation phase |
| `action` | action phase |
| `clutch` | after a defuser plant, the last 30 seconds, or while escorting the hostage |
| `range` | shooting range and training |
| `after` | match summary |

Each pool shuffles without repeats and moves on to the next track when one ends. Moments
crossfade into each other, and the win/loss sting plays over a ducked track. To change what
plays where, move file names between lists in `playlist.js`; any file can go in several lists.
New MP3s only play once they're listed.
**Music volume** is in Settings.

If `playlist.js` is missing or a pool is empty, the game falls back to its own synthesised
score, which also intensifies as the clock runs down. The music files are your own local
copies: `.gitignore` keeps them out of the repository, so they play only on your machine and
the published site plays the synthesised score.

## Sound effects

`sound effects/sfx.js` lists which files in that folder play for each effect, for example
`'break'` for a barricade being smashed, `'plant'` for the defuser plant, or `'shot.SMG'` for
SMG fire. Three of the files you added are mapped:

| File | Plays for |
|---|---|
| Lion scan | Vesper's sonar |
| Plant bomb | defuser plant |
| c4 | Detonator Pack blast |

`Door Break` and `call` are still in the folder but no longer used: barricades breaking and
spotting now use the game's own generated sounds (a splintering crack and a short radar chirp).
Put a file name back in `'break'` or `'ping'` to use a file again.

Every other effect key is listed with an empty list. Fill one in to replace that sound;
empty lists keep the game's built-in synthesised sound. Your files play in 3D like everything
else: panned, quieter with distance and muffled behind walls. Reload the game after editing.

## How online works

There's no server of ours: the setup is the same as Wordle n' Friends.
- **Presence and messages:** who's online, profiles, lobby chat, the room list and your inbox
  travel over two free public MQTT brokers. Everything is signed with your account's key, so
  nobody can post as you. Private messages and invites are encrypted to the person they're for.
- **Rooms:** players link browser to browser over WebRTC (PeerJS introduces them). If a network
  blocks direct links, the room falls back to the MQTT brokers, encrypted.
- **Matches:** the host's game runs the match (the bots, damage, gadgets and destruction)
  and streams it to everyone about ten times a second, including every sound and destroyed
  voxel. You move your own operator yourself, so movement feels instant; the host judges
  shots and gadgets.
- **Leaving:** if a player leaves, a bot takes over their operator. If the host leaves, the
  match ends.

Names, levels, statuses and lobby chat are public on the relay; messages, invites and the
match itself are not.

## Files

`index.html` · `css/style.css` · `lib/three.min.js` (three.js r128) · `js/`:
`util` (helpers, settings, key bindings) · `data` (materials, weapons, gadgets, operators) ·
`world` (voxel storage, meshing, rays, destruction) · `maps` (map builder, range,
attacker spawns and their cover) · `maps-kit` (floor-plan layout kit: doors, windows, stairwells,
hatches and furniture from a room plan) · `maps-new-*` and `maps-rework-*` (the 17 maps) · `models` (voxel rigs, guns, gadgets) · `audio` / `music` · `fx` ·
`actor` (movement, stances, damage) · `weapons` · `gadgets` · `nav` (pathfinding) · `ai` ·
`game` (rounds, modes, objectives) · `player` (input, camera, viewmodel) · `hud` · `menu` ·
`range` (range and training) · `killcam` (replays) · `names` (bot names) · `arcade` (Deathmatch and
Team Deathmatch) · `shop` (cosmetics, credits) · `ranked` (ranks, matchmaking) · `main` · online: `ui` (toasts, modals, top bar) · `auth`
(accounts, keys, stats) · `net` (the relay) · `relay` (encrypted room fallback) · `social`
(friends, messages, invites) · `online` (lobby, rooms) · `np` (the networked match).
`audio/playlist.js` (music) and `sound effects/sfx.js` (sound-effect files).
