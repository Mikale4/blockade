# Seasons 10-14: twenty new operators

Design and build tracker for the second-generation roster (20 operators, 9 weapons, 3 gadgets).
Stage one was the audit and this design; the status table at the end is kept current while they
are built and tested.

## 1. Audit of the existing roster (38 operators, 19 a side)

| Mechanic family | Already covered by |
|---|---|
| Hard breach (any wall) | Kiln plasma bore |
| Soft breach at range / through walls | Rivet rivet gun, Torque concussion spike, breach charge |
| Body through walls | Tusk battering charge |
| Blind / dazzle | Glare photon mines, Lumen floodlight, stun grenade |
| Reveal everyone nearby | Vesper sonar, Juno sensors, proximity alarm |
| Reveal by gunfire / by being seen | Triad triangulator, Marlow spotter scope |
| Gadget detection and removal | Quill scanner, Static surge drone, EMP grenade, Gaff harpoon |
| Turn enemy gadgets | Splice hijack dart |
| Personal stealth | Wraith cloak, Lark silent steps, Veil null field |
| Fake sound | Lark decoy emitter |
| Fake body | Mimic body double |
| Healing / revive | Halcyon beacon, Tamsin med station, stim |
| Movement buffs | Dynamo overdrive |
| Pull / displace | Gaff harpoon |
| Teleport | Moor recall anchor |
| Cover building | Brace foam, deployable cover, Crag shield |
| Sealing openings | Brick bunker plates, Seam patch spray |
| Anti-breach jamming | Anvil dampener, Morrow scrambler |
| Projectile / drone interception | Okafor hunter seeker |
| Area damage | Hollis incendiary, Haze irritant |
| Movement denial | Sable snare (root), razor wire (slow) |
| Darkness | Nox blackout |
| Automated fire | Warden turret |
| Weapon sabotage | Ferro misfire coil |
| Rotation holes | Rhea rotation charges |

Weapon mechanics: burst, suppressed, wall penetration, ricochet, bipod.

Gaps no operator touches: traversal routes (lines, ladders, crawlspaces), changing what a
surface *is*, momentum and traction, false information (rather than hiding true information),
counter-intel against the attackers' own picture, sound you can see, utility that cancels
utility, dynamic doors, passable-but-bulletproof barriers, suppression, aerial recon.

## 2. The twenty

Ten attackers, ten defenders, in five units (two attackers and two defenders each).

### HALYARD Rope Access Team — Season 10 · Operation High Line

**SPAN** (attacker · Access · armor 2 / speed 2) — *Andrej Kovač*
- Ability ZIPLINE RIG (2): aim at a solid surface 4-28 m away with line of sight; the hook
  anchors and a cable runs from a ground anchor at Span's feet. Span and his team ride it with
  interact at either end (7 m/s), landing at the nearest standing spot by the far anchor.
- Limits: riders cannot shoot, are in the open and the cable hums. Either anchor (25 HP) can be shot,
  dropping a rider. Jolt's window guard knocks riders off.
- Kit: TWINFIRE / K-77 · P-10 / STINGER · smoke, flank cam.
- Look: climbing helmet, harness, cable spool on the back.

**RUNG** (attacker · Vertical Breach · 2/2) — *Hollis "Rung" Adeyemi*
- Ability BREACH LADDER (2): aim at a soft ceiling or soft floor within 3 m. A ring charge cuts a
  hatch-sized hole and a telescoping ladder drops through it: a new two-way route for anyone (both
  teams), which bots path through.
- Limits: reinforced hatches, resin and hard floors refuse it. The ladder (80 HP) collapses if shot,
  and Seam or Grout can seal the hole.
- Kit: LATTICE / HALBERD · P-10 / MAUL · stun, breach charge.
- Look: hard hat, ladder segments on the back.

**JOLT** (defender · Anti-Access · 2/2) — *Mireille Okoro*
- Ability WINDOW GUARD (3): a pulse plate under a window, hatch or doorway within 2.6 m. Any attacker
  rappelling, ziplining, climbing a ladder or vaulting / crashing within 2.5 m is blasted back 3 m,
  off the rope, line or ladder, for 10 damage and a 1.2 s stun. Three pulses, then it is spent.
- Limits: people walking through a doorway are not affected. One bullet kills it; EMP and surge too.
- Kit: TWINFIRE / LATTICE · P-10 / MAUL · detonator pack, caltrops.
- Look: mohawk, high-collar vest, coil pack.

**FERRET** (defender · Crawlspace Roamer · 1/3) — *Tomasz Ferenc*
- Ability CRAWL CUTTER (4): cut a 0.75 m crawl hole at floor level through a soft wall in 1.5 s
  (a scrape heard 8 m away). Only a prone body fits, and drones. Both teams can use the holes;
  bots crawl through them.
- Limits: reinforced, resin and hard walls refuse it.
- Kit: QUARREL / STRIDER · VERDICT / P-10 · caltrops, detonator pack.
- Look: knee pads, low headlamp cap, tool roll.

### CIPHER Information Operations — Season 11 · Operation Dead Air

**PHANTOM** (attacker · Deception · 1/3) — *Imogen Vale*
- Ability GHOST SIGNAL (2): throw a spoofer that sticks. A second later it puts three phantom attacker
  contacts into the defenders' picture: red marks walking nearby routes for 15 s. Defender bots
  believe them and rotate or pre-aim.
- Limits: a phantom vanishes when a defender has a clear look at its spot within 12 m. Shooting the
  spoofer (1 HP) ends them all; scramblers jam it; seekers intercept the throw. Phantoms never make
  sound or show on cameras.
- Kit: TWINFIRE / STRIDER · VERDICT / P-10 · stun, flank cam.
- Look: headset with boom mic, antenna pack.

**LOOP** (attacker · Counter-Surveillance · 2/2) — *Desmond Achebe-Ruiz*
- Ability FEED LOOP (3): hold the ability on a defender camera, armored cam, sensor, alarm or turret
  within 22 m in sight for 1.5 s (a channel: look away and it fails). For 30 s the device runs but
  reports nothing. Cameras draw no attackers and mark nobody; sensors and alarms stay quiet; turrets
  sweep without firing. Defenders get no warning.
- Tells: a looped feed shows a rolling line; its light blinks amber.
- Kit: VOLTA / K-77 · P-10 / HORNET · smoke, breach charge.
- Look: hood with a data visor, laptop case.

**BABEL** (defender · Comms Jamming · 2/2) — *Noa Brightwater*
- Ability COMMS JAMMER (2): a floor emitter with an 8 m field. Attackers inside lose their team's
  picture: no teammate or shared marks, they can't ping, and what they see there isn't passed to
  their team. Bots' sightings and drone marks inside aren't relayed.
- Limits: 30 HP; EMP and surge kill it.
- Kit: TALLY / HUSH-45 · STINGER / VERDICT · detonator pack, fog.
- Look: head scarf, aerial pack.

**RELAY** (defender · Counter-Recon · 2/2) — *Gunnar Holt*
- Ability BACKTRACE DART (3): shoot an attacker drone (ground or rotor) within 20 m. It keeps
  working, but whoever pilots it is marked for the defense every 4 s while driving and for 4 s
  after.
- Tells: the pilot's screen says SIGNAL TRACED, so a human can abandon the drone. Bots stop driving
  traced drones.
- Kit: TALLY / SALVO-9 · P-10 / STINGER · razor wire, proximity alarm.
- Look: earmuff headset, radio pack.

### FOUNDRY Materials Unit — Season 12 · Operation Cold Forge

**RUST** (attacker · Reinforcement Breaker · 2/2) — *Agnieszka Rustova*
- Ability DEGAUSSER (2): mount on a reinforced wall, bunker plate, shutter or reinforced hatch. After
  a 1 s set-up it hums for 6 s, then the steel in a 2 m × 2.5 m area becomes WEAKENED plate. It stays
  standing, but it is no longer reinforced: breach charges, rivets, spikes, the battering charge and
  shotguns open it.
- Limits: dampeners and scramblers jam it, 40 HP, the hum carries 12 m, and resin is not steel.
- Kit: HALBERD / GALE 12 · P-10 / STUB · breach charge, smoke.
- Look: welder's mask tipped up, coil pack.

**SKID** (attacker · Traction Denial · 1/3) — *Paulo "Skid" Mendes*
- Ability SLICK CANISTER (3): a burst of polymer slick 3.5 m across for 18 s. Anyone on it, either team,
  loses traction: slow to start, slow to stop, no sprint, +1.5° spread, and every step squeaks
  loudly. Bots path around it.
- Limits: Drench's sprinklers wash it away.
- Kit: LATTICE / VKR-5 · P-10 / HORNET · frag, extinguisher.
- Look: respirator, chemical tank.

**GROUT** (defender · Hardening · 3/1) — *Bea Lindqvist-Oyelaran*
- Ability RESIN INJECTOR (3): flood a 2 m × 2.5 m patch of soft wall, floor or hatch within 2.5 m with
  resin, through its whole depth. It becomes bulletproof and shrugs off breach charges, rivets,
  spikes, impacts and the battering charge, and it works where reinforcement can't (floors, half
  walls, any panel).
- Limits: the plasma bore cuts it, and heavy rounds (a .50) chip it; melee does nothing. It also
  blocks your own team's rotations.
- Kit: BRAMBLE / VOLTA · P-10 / MAUL · razor wire, deployable cover.
- Look: respirator and hard hat, resin tank.

**SINK** (defender · Collapse Trap · 2/2) — *Edda Sinkovic*
- Ability COLLAPSE CHARGE (3): stick a charge to a soft floor (from above) or a soft ceiling (from
  below). Armed after 2 s, it waits for an attacker to stand over it; then a 1.5 m patch of floor
  drops away. They fall a level: 20 damage, 1.5 s stun, cut off from their team.
- Limits: reinforced, resin and hard floors refuse it. Shooting the charge (1 HP) from where it can
  be seen disarms it; the scanner shows it.
- Kit: BRAMBLE / SALVO-9 · P-10 / MAUL · razor wire, impact.
- Look: hard hat with lamp, sapper bag.

### SQUALL Environmental Response — Season 13 · Operation Downpour

**TREMOR** (attacker · Acoustic Recon · 2/2) — *Kaito Brennan-Sato*
- Ability SEISMIC STAKE (2): drive a stake into the floor. For 30 s, every noise a defender makes
  within 16 m (± one floor) shows to the attackers as a ring at its source: footsteps, reloads,
  gadgets, gunfire, reinforcing. Bots treat rings as sound contacts.
- Limits: quiet movement shows nothing, nor does anyone in a null field. The stake (1 HP) buzzes.
- Kit: KB-3 / HALBERD · P-10 / MAUL · breach charge, frag.
- Look: ear defenders, stake quiver.

**MURMUR** (attacker · Sound Deception · 1/3) — *Céleste Amari*
- Ability THROW VOICE (2): throw a projector that sticks. For 10 s every sound Murmur makes —
  footsteps, reloads, gunfire, gadgets — is heard from the projector instead, by players and bots
  alike, along with every noise-based reaction.
- Limits: sensors, alarms and eyes still find her. Shooting the projector (1 HP) ends it.
- Kit: QUARREL / HUSH-45 · VERDICT / P-10 · stun, extinguisher.
- Look: wrapped scarf, speaker pack.

**DRENCH** (defender · Utility Counter · 2/2) — *Rafe Okonjo*
- Ability SPRINKLER HEADS (3): mount on a ceiling or wall. A head fires by itself when attacker smoke,
  irritant, slick or fire appears within 7 m, and rains for 10 s:
  - smoke clears in 2 s;
  - irritant and slick wash away;
  - every fire under it goes out (your own team's too);
  - the floor stays wet for 20 s, and footsteps on it splash loudly.
- Limits: one trigger per head; shoot it (1 HP) first.
- Kit: SALVO-9 / GALE 12 · P-10 / HORNET · deployable cover, proximity alarm.
- Look: sou'wester, water tank.

**HARBOR** (defender · Rotation Cover · 3/1) — *Ines Harbourne*
- Ability BALLISTIC CURTAIN (3): hang a heavy curtain in a doorway within 3 m. It stops bullets and
  blocks sight both ways, but anyone can push through, at a crawl and with a loud rustle. Hides
  rotations.
- Limits: explosives tear it down, three melee hits rip it, and the battering charge goes straight
  through.
- Kit: VOLTA / STRIDER · P-10 / HORNET · impact, deployable cover.
- Look: helmet and shoulder pads, rolled curtain on the back.

### SIGHTLINE Group — Season 14 · Operation Long Shadow

**KITE** (attacker · Aerial Recon · 1/3) — *Saoirse Kitteridge*
- Ability ROTOR DRONE (1 drone): a small quadcopter. Fly it from the drone view, with jump to climb
  and crouch to descend; fire spots. The battery lasts 12 s of flight and recharges on the ground at
  half speed; flat, it comes down, and left alone it settles to the floor. Press the ability again to
  fly it again. Usable in the drone phase (bots fly it then, toward the objective, spotting).
- Limits: it buzzes loud (18 m) and has 1 HP; seekers, scramblers and Relay's darts all work on it.
- Kit: LONGBOW / K-77 · P-10 / VERDICT · frag, flank cam.
- Look: pilot's helmet and visor, drone cradle.

**GRIT** (attacker · Suppression · 3/1) — *Abel Grützner*
- Ability SUPPRESSIVE FIRE (2, 9 s): Grit's rounds that pass within 1.6 m of a defender, or hit the
  cover they are behind, suppress them for 2 s: screen shake and vignette, +3° spread, 50% slower ADS
  and lean. Suppressed bots stop peeking and go for cover.
- Limits: break line of sight; shields and curtains catch the rounds.
- Kit: SPINDLE / RAMPART · MAUL / P-10 · smoke, frag.
- Look: ear defenders, ammo pack, shoulder plates.

**LATCH** (defender · Sightline Control · 2/2) — *Oona Latchford*
- Ability REMOTE SHUTTER (2): look at an open doorway or window close by (about 2.5 m) to install a
  motorised steel shutter (it starts open). Press the ability anywhere else to slam all your shutters
  shut, or open them again (a window gets its glass back). A shutter won't close on anyone. Bots fit
  theirs in the main ways in, slam them when the attack comes close and open them once it's quiet.
- Limits: the plasma bore cuts it; the degausser softens it; EMP freezes it in place for 12 s;
  shooting the motor box (1 HP) leaves it stuck as it is.
- Kit: VOLTA / SALVO-9 · STINGER / P-10 · razor wire, caltrops.
- Look: cap and goggles, shutter rails on the back.

**MIRAGE** (defender · False Wall · 1/3) — *Lucía Miraflores*
- Ability FALSE WALL (2): an emitter projects a hologram filling a doorway, window or breach hole within
  3 m. Attackers see a solid wall; defenders see a faint outline and look straight through. Bullets
  and bodies pass through, and attacker bots cannot see through it.
- Limits: it collapses for good when an attacker or a drone passes through it or any bullet crosses
  it (so shooting through it gives it away), and every few seconds it shimmers for a moment.
- Kit: LATTICE / GALE 12 · VERDICT / P-10 · impact, caltrops.
- Look: hooded cowl, projector pack.

## 3. New weapons (9)

| Weapon | Class | Mechanic |
|---|---|---|
| TWINFIRE | Dual-mode rifle | FIREMODE swaps auto (36 dmg, 820 rpm) for a marksman mode (58 dmg, 330 rpm, tight) |
| VOLTA | Coil carbine | No magazine: heat. Overheats into a 2.6 s vent if held; reload vents early |
| SPINDLE | Rotary LMG | Spins up from 35% to full rate over 1.1 s of trigger; aiming keeps it spinning |
| LONGBOW | Bolt-action rifle | 118 dmg, 4x scope; the bolt has to be worked (no aiming for 0.9 s after a shot) |
| QUARREL | Crossbow | Silent bolts that fly (55 m/s) and drop; one-shot head, heavy body |
| TALLY | Marking DMR | A hit marks the target for your team for 3 s |
| BRAMBLE | Incendiary shotgun | Pellets set the target burning for 2.5 s and light the floor briefly |
| LATTICE | Tandem-mag SMG | Every other reload flips the clamped magazine (0.9 s) |
| STINGER | Taser pistol | Two darts, 10 m: stun and slow, no headshots |

## 4. New gadgets (3)
- FLANK CAM (attacker): sticks to a wall and marks any defender in its 100° view within 14 m for 2 s.
  1 HP, and scramblers jam it.
- EXTINGUISHER (attacker): a CO2 blast 4 m ahead. It puts out fires, clears irritant and slick, and
  leaves a brief white cloud.
- CALTROPS (defender): a 1.6 m patch of spikes. Attackers crossing it faster than a careful walk take
  damage, are slowed and make a racket; crouching or walking gets you through.

## 5. Interactions (no hard counters, many soft ones)
- **Rust vs Grout, Latch, Brick:** Rust softens Latch's shutters and Brick's plates, but Grout's
  resin is not steel. Grout's resin also stops Rung's ladder charges and Sink's charges.
- **Drench vs Skid, Pike, Haze, Hollis, Bramble:** sprinklers wash out Skid's slick, Pike's smoke,
  Haze's gas and fire, the defenders' own included.
- **Jolt vs Span, Rung, rappellers:** Jolt's window guards answer the access team: Span's riders,
  Rung's ladders and anyone on a rope.
- **Relay vs Kite, Static:** Relay's darts turn Kite's rotor drone and Static's surge drones into a
  liability for their pilots.
- **Loop vs Kestrel, Warden, Juno, alarms:** Loop blinds them silently; Babel's jammer can't be looped.
- **Babel vs Tremor, Phantom:** Babel's field stops Tremor's rings and any marks reaching attackers
  inside it. Phantom's ghosts are fed to defenders, so Babel does not stop them.
- **Murmur vs Tremor:** Murmur relocates real noise; Tremor's rings show only defender noise, so the
  two never contradict.
- **Mirage vs drones, Grit:** drones and bodies break Mirage's hologram. Grit's rounds pass through
  it and still suppress.
- **Harbor vs Grit, Kite, Tusk:** Harbor's curtain blocks Grit's rounds and Kite's view, and Tusk's
  ram tears it down.
- **Ferret vs Skid:** crawl holes are routes for both teams. A slick pool at a crawl hole's mouth
  stops it being a quiet exit.

## 6. Build plan and status

| # | Operator | Side | Batch | Status |
|---|---|---|---|---|
| 1 | RUST | atk | 1 | built · tested offline (ability, bots in 3 maps) |
| 2 | SKID | atk | 1 | built · tested offline (ability, bots in 3 maps) |
| 3 | GRIT | atk | 1 | built · tested offline (ability, bots in 3 maps) |
| 4 | GROUT | def | 1 | built · tested offline (ability, bots in 3 maps) |
| 5 | DRENCH | def | 1 | built · tested offline (ability, bots in 3 maps) |
| 6 | SPAN | atk | 2 | built · tested offline (ability, bots in 3 maps) |
| 7 | RUNG | atk | 2 | built · tested offline (ability, bots in 3 maps) |
| 8 | JOLT | def | 2 | built · tested offline (ability, bots in 3 maps) |
| 9 | FERRET | def | 2 | built · tested offline (ability, bots in 3 maps) |
| 10 | SINK | def | 2 | built · tested offline (ability, bots in 3 maps) |
| 11 | PHANTOM | atk | 3 | built · tested offline (ability, bots in 3 maps) |
| 12 | LOOP | atk | 3 | built · tested offline (ability, bots in 3 maps) |
| 13 | TREMOR | atk | 3 | built · tested offline (ability, bots in 3 maps) |
| 14 | BABEL | def | 3 | built · tested offline (ability, bots in 3 maps) |
| 15 | RELAY | def | 3 | built · tested offline (ability, bots in 3 maps) |
| 16 | KITE | atk | 4 | built · tested offline (ability, bots in 4 maps) and online |
| 17 | MURMUR | atk | 4 | built · tested offline (ability, bots in 4 maps) and online |
| 18 | LATCH | def | 4 | built · tested offline (ability, bots in 4 maps) and online |
| 19 | MIRAGE | def | 4 | built · tested offline (ability, bots in 4 maps) and online |
| 20 | HARBOR | def | 4 | built · tested offline (ability, bots in 4 maps) and online |

Batch 1 also built all 9 weapons and 3 gadgets (each tested), the 18 new heads and back packs, the
registry hooks (js/ops2.js), and the network fields. Pathfinding links came with batch 2 (js/ops2-b.js:
ladders, crawl holes, ziplines), batch 3 (js/ops2-c.js) is the information and deception kit, and
batch 4 (js/ops2-d.js) the sight and sound kit. Each batch went into the roster only once it worked for
players, bots and online guests.

All 20 are in. Testing, per batch: every ability driven by hand in an offline match (what it does, its
limits and counters), then all-bot rounds with the batch's operators forced onto both teams on three or
four maps (kit used, no script errors). After batch 4, a two-tab online match (a host and a guest over a
local peer link, new operators on both teams, a round and a half with no errors on either side) checked
what a guest sees and does with the batch-4 kit: their own rotor flight, holograms, curtains, the voice
projector's link to its thrower, and shutter steel arriving as voxels.
