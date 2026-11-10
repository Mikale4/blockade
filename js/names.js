/* names.js -- player-style names for bots: the kind of handle a real person picks
   (QuietOtter, mako_219, xFrostline, sam_k27...). They follow the same rules as account
   names (3-16 letters, numbers, - and _), and every name in a match is different.

     NAMES.make()          one name
     NAMES.many(n, avoid)  n different names, none matching the names in avoid      */
(function () {
  'use strict';
  const ADJ = ['Quiet', 'Rusty', 'Silent', 'Lucky', 'Frosty', 'Salty', 'Sleepy', 'Brave', 'Grumpy', 'Swift', 'Lazy', 'Cosmic', 'Dusty', 'Feral', 'Mellow', 'Sneaky', 'Hollow',
    'Crispy', 'Wild', 'Rapid', 'Neon', 'Cold', 'Bold', 'Calm', 'Mighty', 'Tiny', 'Big', 'Spicy', 'Lunar', 'Solar', 'Grim', 'Odd', 'Static', 'Atomic', 'Velvet', 'Iron',
    'Paper', 'Turbo', 'Toxic', 'Shady', 'Humble', 'Clumsy', 'Royal', 'Rogue', 'Stray', 'Wired', 'Polar', 'Faded', 'Crimson', 'Golden'];
  const NOUN = ['Otter', 'Falcon', 'Anchor', 'Badger', 'Viper', 'Raven', 'Moose', 'Panda', 'Lynx', 'Comet', 'Pickle', 'Waffle', 'Taco', 'Biscuit', 'Hornet', 'Kraken',
    'Yeti', 'Gecko', 'Mango', 'Pebble', 'Walrus', 'Cactus', 'Tundra', 'Ember', 'Shadow', 'Ghost', 'Wolf', 'Fox', 'Bear', 'Owl', 'Shark', 'Goose', 'Noodle', 'Pigeon',
    'Muffin', 'Bandit', 'Ranger', 'Nomad', 'Pilot', 'Drifter', 'Hunter', 'Monk', 'Wizard', 'Knight', 'Duck', 'Squid', 'Turtle', 'Coyote', 'Heron', 'Bison', 'Storm',
    'Echo', 'Frost', 'Blaze', 'Spark', 'Rocket', 'Pixel', 'Glitch', 'Cipher', 'Vector', 'Orbit', 'Saber', 'Arrow', 'Bolt', 'Dagger', 'Hammer', 'Reaper', 'Tank'];
  const FIRST = ['sam', 'alex', 'jordan', 'mike', 'chris', 'leo', 'max', 'nina', 'kai', 'zoe', 'ben', 'lucas', 'mia', 'eli', 'noah', 'ava', 'finn', 'ivy', 'jake',
    'liam', 'emma', 'owen', 'ryan', 'tyler', 'dylan', 'sofia', 'maya', 'theo', 'oscar', 'luca', 'jonas', 'mateo', 'ana', 'yuki', 'kenji', 'omar', 'ravi', 'ines',
    'pablo', 'erik', 'lars', 'tomas', 'dani', 'nico', 'remy', 'jules', 'casey', 'riley', 'quinn', 'drew'];
  const WORD = ['frost', 'shadow', 'storm', 'nova', 'blitz', 'drift', 'echo', 'viper', 'raven', 'ghost', 'pulse', 'flux', 'zero', 'apex', 'onyx', 'void', 'hex',
    'rift', 'jinx', 'vortex', 'ember', 'havoc', 'mirage', 'static', 'tempest', 'phantom', 'cobra', 'sniper', 'breach', 'recoil'];
  const TAIL = ['line', 'bite', 'fall', 'byte', 'shot', 'core', 'wave', 'fire', 'born', 'lock', 'mark', 'side'];
  const r = n => Math.floor(Math.random() * n), pick = a => a[r(a.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const num = () => { const k = Math.random(); return k < 0.35 ? String(r(90) + 10) : k < 0.6 ? String(r(900) + 100) : k < 0.75 ? String(r(10)) : k < 0.88 ? '0' + r(10) : String(1990 + r(17)).slice(-2); };
  const leet = s => { const m = { a: '4', e: '3', i: '1', o: '0', s: '5' }; const ks = [...s].map((c, i) => m[c.toLowerCase()] ? i : -1).filter(i => i >= 0); if (!ks.length) return s; const i = pick(ks); return s.slice(0, i) + m[s[i].toLowerCase()] + s.slice(i + 1); };
  const STYLES = [
    () => pick(ADJ) + pick(NOUN),                                        // QuietOtter
    () => pick(ADJ) + pick(NOUN) + num(),                                // SaltyWaffle77
    () => pick(NOUN).toLowerCase() + '_' + num(),                        // mako_219
    () => pick(FIRST) + '_' + String.fromCharCode(97 + r(26)) + (Math.random() < 0.5 ? num() : ''),   // sam_k27
    () => cap(pick(FIRST)) + String.fromCharCode(65 + r(26)),            // LiamP
    () => pick(FIRST) + num(),                                           // jordan04
    () => 'x' + cap(pick(WORD)) + (Math.random() < 0.5 ? pick(TAIL) : ''),   // xFrostline
    () => cap(pick(WORD)) + pick(TAIL),                                  // Stormbyte
    () => leet(cap(pick(WORD)) + (Math.random() < 0.5 ? pick(TAIL) : '')),   // R4venfall
    () => pick(ADJ).toLowerCase() + '_' + pick(NOUN).toLowerCase(),      // quiet_storm
    () => (Math.random() < 0.5 ? 'its' : 'not') + cap(pick(FIRST)),      // itsJordan
    () => 'The' + pick(ADJ) + pick(NOUN),                                // TheLazyMoose
    () => pick(WORD) + '-' + pick(WORD),                                 // nova-hex
    () => cap(pick(FIRST)) + pick(NOUN),                                 // MayaFalcon
    () => pick(NOUN) + 'Main',                                           // BadgerMain
  ];
  const ok = s => s.length >= 3 && s.length <= 16 && /^[a-zA-Z0-9_-]+$/.test(s);
  const NAMES = {
    make() { for (let i = 0; i < 20; i++) { const s = pick(STYLES)(); if (ok(s)) return s; } return 'player' + (1000 + r(9000)); },
    many(n, avoid) {
      const seen = new Set((avoid || []).map(s => String(s).toLowerCase())), out = [];
      while (out.length < n) { const s = NAMES.make(); if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); } }
      return out;
    },
  };
  window.NAMES = NAMES;
})();
