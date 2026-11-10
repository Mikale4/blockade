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

- **22 operators** (11 attack, 11 defense) in six units. The launch roster is 20 operators
  across five units, plus a two-operator **Season 1** squad (Ironveil: Pike and Lark).
  Each operator has an armor/speed rating, two primaries, two secondaries, two gadget choices
  and a unique ability.
- **5 maps**, each with a basement or upper floors, hatches, soft and hard walls, and 3–4
  bomb-site pairs, plus Secure Area and Hostage rooms:
  - **Roadhouse**: highway diner and garage, brewery cellar (dusk)
  - **Summit Lodge**: snowed-in log and stone ski lodge (overcast)
  - **Homestead**: farmhouse with a bunker underneath, plus a hay barn (afternoon)
  - **Checkpoint**: border station with a double-height customs hall (noon)
  - **Helix Labs**: island research campus with a specimen vault (night)
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
  can't be hurt in prep. Spawns are checked at map load so no
  window, door or room can see them, and cover walls are raised wherever one could.
- **Action phase (3 min):** vault (low walls, windows), rappel up outside walls onto roofs, lean,
  crouch, go prone, melee through barricades and hatches.
- **Down but not out:** lethal non-headshot damage usually downs you; teammates revive (hold
  interact). Headshots kill outright (shotgun pellets just hit harder).
- **Intel:** drones (attack), cameras (defense; attackers can shoot them), spotting marks
  enemies for your team.
- **Bots:** they path through the building (stairs, breached holes, barricades they smash),
  react to what they see and hear, reinforce and gadget up in prep, plant, disable, escort and
  revive. Choose Recruit, Normal or Realistic.

## Controls (all rebindable: **Controls** in the menu)

| Default | Action |
|---|---|
| WASD / mouse | Move / look |
| LMB / RMB | Fire / aim down sights |
| L-Shift | Sprint |
| C / Z | Crouch / prone |
| Q / E | Lean (hold **or toggle**, your choice) |
| Space | Vault, rappel (on outside walls; W/S to climb), drone hop |
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
`world` (voxel storage, meshing, rays, destruction) · `maps` (map builder, 5 maps, range,
spawn protection) · `models` (voxel rigs, guns, gadgets) · `audio` / `music` · `fx` ·
`actor` (movement, stances, damage) · `weapons` · `gadgets` · `nav` (pathfinding) · `ai` ·
`game` (rounds, modes, objectives) · `player` (input, camera, viewmodel) · `hud` · `menu` ·
`range` (range and training) · `main` · online: `ui` (toasts, modals, top bar) · `auth`
(accounts, keys, stats) · `net` (the relay) · `relay` (encrypted room fallback) · `social`
(friends, messages, invites) · `online` (lobby, rooms) · `np` (the networked match).
`audio/playlist.js` (music) and `sound effects/sfx.js` (sound-effect files).
