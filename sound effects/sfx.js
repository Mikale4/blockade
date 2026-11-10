/* Sound effects for BLOCKADE: which files in this folder play for each effect.
   Put a file name (or several: one is picked at random each time) in any list;
   empty lists keep the game's own synthesised sound. Files play in 3D like the
   built-in sounds (panned, quieter with distance, muffled behind walls).
   After editing, reload the game. */
window.SFX_FILES = {
  // ---- your files
  'break':        ['Door Break.mp3'],   // a barricade or door smashed (melee, bullets, bots breaking through)
  'sonar':        ['Lion scan.mp3'],    // Vesper's sonar pulse
  'plant':        ['Plant bomb.mp3'],   // the defuser is planted
  'explosion.c4': ['c4.mp3'],           // a Detonator Pack goes off
  'ping':         ['call.mp3'],         // you spot an enemy / callout

  // ---- every other effect you can replace
  'shot': [],            // any gun (or be specific below)
  'shot.AR': [], 'shot.SMG': [], 'shot.SG': [], 'shot.DMR': [], 'shot.LMG': [], 'shot.PISTOL': [], 'shot.MP': [],
  // a single weapon: 'shot.vkr5', 'shot.halberd', 'shot.k77', 'shot.salvo9', 'shot.strider', 'shot.gale12', 'shot.torrent',
  // 'shot.lancet', 'shot.tallow', 'shot.p10', 'shot.maul', 'shot.hornet', 'shot.stub'
  'step': [], 'step.metal': [],
  'explosion': [],
  'crumble': [],          // walls collapsing
  'glass': [],
  'impact.hard': [], 'impact.soft': [],
  'barricade': [],        // a barricade being put up
  'melee': [],
  'reload.out': [], 'reload.in': [],
  'empty': [],            // dry fire
  'hit': [], 'hit.head': [],
  'hurt': [],
  'beep': [],             // defuser and sensor beeps
  'metal': [],            // reinforcing, shields, bunker plates
  'zap': [],              // surges, jammers, snares
  'ring': [],             // the ringing after a stun
  'throw': [],
  'whoosh': [],           // vaults, rappels, smoke
  'hook': [],             // a rappel hook catching the wall top
  'alarm': [],
  'ui': [],
  'round.start': [], 'round.win': [], 'round.lose': [],
};
