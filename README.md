# BLOCKADE — Tactical Voxel Breach

An original 5v5 attack-and-defend shooter in voxels. Every wall is made of voxels a quarter
of a metre across: shoot through drywall, blow holes in floors, reinforce walls in steel and
burn through them again. You play first person, with four bots on your team against five.

**Play:** double-click `Play BLOCKADE.bat`. It starts a small local server and opens
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
  (XP from every match), matches and rounds won, kills, K/D, headshots, most-played operators
  and your online rating.
- **Online lobby:** a room list, everyone online, a leaderboard and lobby chat. Use QUICK PLAY,
  HOST A ROOM (public, private with a password, or code only), or join by code.
- **Rooms:** two teams of five. The host picks the map, mode, rounds, bot skill and starting
  side, can fill empty slots with bots, and can lock the room or kick and block players.
  Everyone else readies up, and there's room chat (in matches too, with Enter).
- **Online matches:** you and your friends in the same match, on the same team or against
  each other, with bots in the remaining slots.
- **Friends and messages:** add friends by friend code or from any player card. Messages are
  end-to-end encrypted and wait for friends who are offline. You can invite a friend to a
  match or a room, join their room, or block someone.

- **26 operators** (13 attack, 13 defense) in eight units. The launch roster is 20 operators
  across five units, plus three two-operator season squads:
  - **Season 1 · Ironveil:** Pike (smoke launcher) and Lark (decoy emitter)
  - **Season 2 · Driftline:** Brace (Barrier Foam: a waist-high bulletproof foam wall) and Seam
    (Patch Spray: refills a breached wall, floor or hatch with foam)
  - **Season 3 · Meridian:** Haze (Irritant Shells: a haze that hurts, makes defenders cough and
    marks them) and Lumen (Floodlight: dazzles attackers who look into it)

  Each operator has an armor/speed rating, two primaries, two secondaries, two gadget choices
  and a unique ability.
- **Pick your spawn:** in operator select every player chooses their own spawn. Attackers pick
  one of the map's outdoor spawns; defenders pick the objective or another room in the building.
- **9 maps**, each with a basement or upper floors, hatches, soft and hard walls, and 3–4
  bomb-site pairs, plus Secure Area and Hostage rooms:
  - **Roadhouse**: highway diner and garage, brewery cellar (dusk)
  - **Summit Lodge**: snowed-in log and stone ski lodge (overcast)
  - **Homestead**: farmhouse with a bunker underneath, plus a hay barn (afternoon)
  - **Checkpoint**: border station with a double-height customs hall (noon)
  - **Helix Labs**: island research campus with a specimen vault (night)
  - **Cannery**: brick fish cannery on the harbour quay, with a two-storey processing floor
    under a catwalk, an ice plant below, and a crane and a dry-docked boat outside (foggy morning)
  - **Observatory**: mountaintop observatory whose telescope hall rises into a dome, ringed by
    a gallery, with a weather hut and a cable-car stop outside (starry night)
  - **Rail Depot**: brick station with a clock tower, a freight tunnel underneath, a train you
    can walk through at the platform, and a signal box down the line (rainy dusk)
  - **Museum**: natural-history museum with a glass-roofed atrium, a fossil skeleton, a grand
    stair to the mezzanine and a concrete vault below (evening)
- **Modes:** Bomb (plant the defuser and protect it, or disable it), Secure Area (hold the room
  with no defenders inside), Hostage (escort the hostage out; harming the hostage loses).
  Sides swap every round (optional), and the first team to N rounds wins.
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
- **Kill cam:** when you're killed you see the last few seconds again over your killer's
  shoulder, then you spectate. A round that ends on a kill replays that kill for everyone before
  the result. The killing shot plays in slow motion, and gadget kills circle the victim. Press
  the vault key (Space) to skip; turn it off in Settings.
- **Intel:** drones (attack), cameras (defense; attackers can shoot them), spotting marks
  enemies for your team.
- **Bots:** they path through the building (stairs, breached holes, barricades they smash),
  react to what they see and hear, reinforce and gadget up in prep, plant, disable, escort and
  revive. Choose Recruit, Normal or Realistic.
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
| C / Z | Crouch / prone |
| Q / E | Lean (hold **or toggle**, your choice) |
| Space | Vault (smashes window glass or a barricade on the way through), rappel (attackers, facing an outside wall; on the rope W/S climb, A/D sidestep, C hang upside down, Space crash through the window beside you or let go), drone hop |
| R · 1 · 2 · B · V | Reload · primary · secondary · fire mode · melee |
| G | Secondary gadget (press again to detonate charges) |
| X | Operator ability (Rhea: hold to detonate) |
| F (hold) | Interact: plant, disable, revive, reinforce, barricade, escort |
| 5 | Drone (attack) / cameras (defense) |
| T | Spot the enemy under your crosshair |
| Tab | Scoreboard |

Every action, including mouse buttons, can be rebound. Taking a key that another action uses
swaps the two. Lean, crouch and aim each have a HOLD/TOGGLE switch.

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
copies; `.gitignore` keeps them out of a repository if you ever publish the game.

## Sound effects

`sound effects/sfx.js` lists which files in that folder play for each effect, for example
`'break'` for a barricade being smashed, `'plant'` for the defuser plant, or `'shot.SMG'` for
SMG fire. It already maps the five files you added:

| File | Plays for |
|---|---|
| Door Break | barricade breaks |
| Lion scan | Vesper's sonar |
| Plant bomb | defuser plant |
| c4 | Detonator Pack blast |
| call | spotting / callout ping |

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
`world` (voxel storage, meshing, rays, destruction) · `maps` (map builder, 9 maps, range,
attacker spawns and their cover) · `models` (voxel rigs, guns, gadgets) · `audio` / `music` · `fx` ·
`actor` (movement, stances, damage) · `weapons` · `gadgets` · `nav` (pathfinding) · `ai` ·
`game` (rounds, modes, objectives) · `player` (input, camera, viewmodel) · `hud` · `menu` ·
`range` (range and training) · `main` · online: `ui` (toasts, modals, top bar) · `auth`
(accounts, keys, stats) · `net` (the relay) · `relay` (encrypted room fallback) · `social`
(friends, messages, invites) · `online` (lobby, rooms) · `np` (the networked match).
`audio/playlist.js` (music) and `sound effects/sfx.js` (sound-effect files).
