/* util.js -- shared helpers: math, DOM, settings storage, the global game state G. */
(function () {
  'use strict';
  const U = {};
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rnd = (a, b) => a + Math.random() * (b - a);
  U.rndi = (a, b) => Math.floor(U.rnd(a, b + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.chance = p => Math.random() < p;
  U.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  U.wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  U.turn = (a, b, k) => a + U.wrap(b - a) * k;
  U.smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  U.dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  U.dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  U.yawTo = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z)); // camera yaw convention: forward = -Z
  U.fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  U.hex = n => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
  U.hash3 = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  U.$ = id => document.getElementById(id);
  U.el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };

  U.store = {
    k(key) { return 'blockade.' + key; },
    get(key, def) { try { const v = localStorage.getItem(U.store.k(key)); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(key, val) { try { localStorage.setItem(U.store.k(key), JSON.stringify(val)); } catch (e) { /* private mode */ } },
  };

  /* ---- online helpers (accounts, relay, social) */
  U.read = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
  U.write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* keep going */ } };
  U.rid = (n = 12) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, x => (x % 36).toString(36)).join(''); };
  U.ago = ts => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago'; return new Date(ts).toLocaleDateString();
  };
  U.time = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  /* typed text from other people: plain, one line, no control or direction-flipping characters */
  const BADCH = c => c < 32 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff;
  U.clean = (t, max = 160) => Array.from(String(t == null ? '' : t)).filter(ch => !BADCH(ch.codePointAt(0))).join('').replace(/\s+/g, ' ').trim().slice(0, max);
  const SWEARS = /\b(f+u+c+k|s+h+i+t|b+i+t+c+h|c+u+n+t|a+s+s+h+o+l+e|b+a+s+t+a+r+d|s+l+u+t|w+h+o+r+e|t+w+a+t|w+a+n+k|d+i+c+k+h+e+a+d|m+o+t+h+e+r+f+u+c+k)\w*/gi;
  U.unswear = t => t.replace(SWEARS, w => w[0] + '*'.repeat(Math.max(1, w.length - 1)));
  U.b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  U.unb64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  U.hexb = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
  /* a tiny event hub: U.hub() -> { on(type, fn) -> off, emit(type, data) } */
  U.hub = () => {
    const L = {};
    return {
      on(t, fn) { (L[t] = L[t] || new Set()).add(fn); return () => L[t].delete(fn); },
      emit(t, d) { for (const fn of [...(L[t] || [])]) { try { fn(d); } catch (e) { console.error(e); } } },
    };
  };

  /* reusable temporaries */
  U.v1 = new THREE.Vector3(); U.v2 = new THREE.Vector3(); U.v3 = new THREE.Vector3();

  /* the global game state */
  window.G = {
    renderer: null, scene: null, camera: null, vmScene: null, vmCam: null,
    world: null, map: null, actors: [], ents: [], player: null,
    mode: 'menu', paused: false, time: 0, dt: 0,
    settings: Object.assign({
      sens: 1.0, adsSens: 0.8, fov: 80, volume: 0.8, music: 0.45, difficulty: 1,
      leanToggle: false, crouchToggle: true, aimToggle: false, renderScale: 1, roundsToWin: 3, swapEveryRound: true,
      showFps: false, invertY: false,
    }, U.store.get('settings', {})),
  };
  G.saveSettings = () => U.store.set('settings', G.settings);

  /* ------------------------------------------------------- key bindings --
     every action maps to one input code: a KeyboardEvent.code, or Mouse0/1/2/3/4 */
  const DEFAULT_KEYS = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'KeyC', prone: 'KeyZ',
    leanL: 'KeyQ', leanR: 'KeyE', vault: 'Space',
    fire: 'Mouse0', aim: 'Mouse2', reload: 'KeyR', primary: 'Digit1', secondary: 'Digit2', firemode: 'KeyB', melee: 'KeyV',
    gadget: 'KeyG', ability: 'KeyX', interact: 'KeyF', device: 'Digit5', ping: 'KeyT', scoreboard: 'Tab', chat: 'Enter',
    rangeOp: 'KeyO', refill: 'KeyH', rebuild: 'KeyK', drill: 'KeyJ', skipStep: 'KeyN',
  };
  const KEY_GROUPS = [
    ['MOVEMENT', [['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'], ['sprint', 'Sprint (hold)'], ['crouch', 'Crouch'], ['prone', 'Prone'], ['leanL', 'Lean left'], ['leanR', 'Lean right'], ['vault', 'Vault / rappel / drone hop']]],
    ['COMBAT', [['fire', 'Fire'], ['aim', 'Aim down sights'], ['reload', 'Reload'], ['primary', 'Primary weapon'], ['secondary', 'Secondary weapon'], ['firemode', 'Fire mode'], ['melee', 'Melee']]],
    ['GADGETS & TEAM', [['gadget', 'Secondary gadget / detonate'], ['ability', 'Operator ability (Rhea: hold)'], ['interact', 'Interact (hold): plant, revive, reinforce'], ['device', 'Drone / cameras'], ['ping', 'Spot enemy'], ['scoreboard', 'Scoreboard (hold)'], ['chat', 'Room chat (online)']]],
    ['RANGE & TRAINING', [['rangeOp', 'Range: change operator'], ['refill', 'Range: refill gadgets'], ['rebuild', 'Range: rebuild the house'], ['drill', 'Range: kill-house drill'], ['skipStep', 'Training: skip step']]],
  ];
  const PRETTY = { ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Space: 'SPACE', Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER', Backspace: 'BKSP', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'MOUSE 4', Mouse4: 'MOUSE 5' };
  window.KEYS = {
    defaults: DEFAULT_KEYS, groups: KEY_GROUPS,
    map: Object.assign({}, DEFAULT_KEYS, G.settings.keys || {}),
    pretty(code) { if (!code) return '—'; if (PRETTY[code]) return PRETTY[code]; return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase(); },
    name(act) { return KEYS.pretty(KEYS.map[act]); },
    actionsFor(code) { const out = []; for (const k in KEYS.map) if (KEYS.map[k] === code) out.push(k); return out; },
    /* bind; an action already on that code swaps to this action's old code */
    set(act, code) {
      const old = KEYS.map[act];
      for (const k in KEYS.map) if (k !== act && KEYS.map[k] === code) KEYS.map[k] = old;
      KEYS.map[act] = code; KEYS.save();
    },
    reset() { KEYS.map = Object.assign({}, DEFAULT_KEYS); KEYS.save(); },
    save() { G.settings.keys = Object.assign({}, KEYS.map); G.saveSettings(); },
    /* "{fire} to shoot" -> "LMB to shoot" */
    fmt(s) { return s.replace(/\{(\w+)\}/g, (m, a) => KEYS.map[a] ? KEYS.name(a) : m); },
  };
  /* gameplay events (training listens to these) */
  G.emit = ev => { if (window.RANGE && RANGE.active && RANGE.onEvent) RANGE.onEvent(ev); };

  window.U = U;
})();
