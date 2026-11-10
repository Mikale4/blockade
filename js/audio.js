/* audio.js -- every sound is synthesised with WebAudio. Positional sounds are
   panned and attenuated relative to the listener, and muffled when the source
   is behind walls or on another floor (footsteps are how you read a fight). */
(function () {
  'use strict';
  const SFX = { ctx: null, master: null, noise: null, lp: { x: 0, y: 0, z: 0, yaw: 0 }, loops: new Set() };

  SFX.init = function () {
    if (SFX.ctx) { if (SFX.ctx.state === 'suspended') SFX.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      SFX.ctx = new C();
      SFX.master = SFX.ctx.createGain(); SFX.master.gain.value = G.settings.volume;
      const comp = SFX.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      SFX.master.connect(comp); comp.connect(SFX.ctx.destination);
      const n = SFX.ctx.sampleRate * 2, buf = SFX.ctx.createBuffer(1, n, SFX.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      SFX.noise = buf;
    } catch (e) { SFX.ctx = null; }
  };
  SFX.setVolume = v => { if (SFX.master) SFX.master.gain.value = v; };
  SFX.setListener = (p, yaw) => { SFX.lp.x = p.x; SFX.lp.y = p.y; SFX.lp.z = p.z; SFX.lp.yaw = yaw; };

  /* output chain for a sound at pos (null = 2D). returns the input node or null if inaudible */
  function chain(pos, range, gain, occl) {
    const c = SFX.ctx; if (!c) return null;
    let g = gain, pan = 0, cut = 20000;
    if (pos) {
      const dx = pos.x - SFX.lp.x, dy = pos.y - SFX.lp.y, dz = pos.z - SFX.lp.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > range) return null;
      g *= Math.pow(1 - d / range, 1.6) * Math.min(1, 3 / Math.max(1, d * 0.6) + 0.35);
      const ang = Math.atan2(-dx, -dz) - SFX.lp.yaw;   // 0 = straight ahead
      pan = -Math.sin(ang) * Math.min(1, d / 2);
      if (occl === undefined && G.world && d > 1.5) occl = !G.world.los(SFX.lp, pos);
      if (occl) { g *= 0.55; cut = 900 + 3000 * (1 - d / range); }
      if (Math.abs(dy) > 2.2) { g *= 0.7; cut = Math.min(cut, 700); }
      if (Math.cos(ang) < -0.2) cut = Math.min(cut, 6000);
    }
    if (g < 0.004) return null;
    const out = c.createGain(); out.gain.value = g;
    let head = out;
    if (cut < 19000) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.connect(out); head = f; }
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(SFX.master); }
    else out.connect(SFX.master);
    return head;
  }
  function noise(dest, t0, dur, type, freq, q, a, decay) {
    const c = SFX.ctx, s = c.createBufferSource(); s.buffer = SFX.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur * (decay || 1));
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
    return f;
  }
  function tone(dest, t0, dur, f0, f1, a, type) {
    const c = SFX.ctx, o = c.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  const now = () => SFX.ctx.currentTime;

  SFX.shot = function (wdef, pos, local) {
    if (!SFX.ctx) return;
    const t = wdef.type, d = chain(local ? null : pos, t === 'PISTOL' ? 60 : 90, local ? 0.55 : 0.9);
    if (!d) return;
    const t0 = now();
    const body = t === 'SG' ? 380 : t === 'PISTOL' ? 1400 : t === 'MP' ? 1600 : t === 'DMR' ? 700 : t === 'LMG' ? 820 : t === 'SMG' ? 1300 : 1000;
    noise(d, t0, t === 'SG' ? 0.32 : 0.16, 'lowpass', body * 2.5, 0.8, 0.9);
    noise(d, t0, 0.05, 'highpass', 3000, 0.5, 0.5);
    tone(d, t0, t === 'SG' ? 0.22 : 0.12, t === 'SG' ? 120 : 160, 50, t === 'SG' ? 0.8 : 0.5, 'sine');
    if (!local) noise(d, t0 + 0.03, 0.35, 'bandpass', 600, 0.6, 0.15);
  };
  SFX.step = function (pos, loud, local, mat) {
    if (!SFX.ctx) return;
    const d = chain(local ? null : pos, loud ? 22 : 12, (local ? 0.12 : 0.5) * (loud ? 1 : 0.55));
    if (!d) return;
    const t0 = now(), metal = mat === 'metal';
    noise(d, t0, 0.07, 'bandpass', metal ? 2200 : 500 + Math.random() * 300, 1.2, 0.8);
    tone(d, t0, 0.05, 90, 60, 0.3);
  };
  SFX.explosion = function (pos, big) {
    if (!SFX.ctx) return;
    const d = chain(pos, 140, big ? 1.2 : 0.9, false); if (!d) return;
    const t0 = now();
    noise(d, t0, 1.4, 'lowpass', 900, 0.7, 1.0, 1);
    noise(d, t0, 0.25, 'highpass', 1800, 0.5, 0.6);
    tone(d, t0, 0.9, 90, 28, 1.0);
    noise(d, t0 + 0.12, 1.2, 'bandpass', 400, 0.5, 0.25);
  };
  SFX.crumble = function (pos, n) {
    if (!SFX.ctx) return;
    const d = chain(pos, 50, Math.min(0.7, 0.15 + n * 0.01)); if (!d) return;
    const t0 = now();
    for (let i = 0; i < 4; i++) noise(d, t0 + i * 0.05 + Math.random() * 0.05, 0.25, 'bandpass', 300 + Math.random() * 900, 0.8, 0.4);
  };
  SFX.glass = function (pos) {
    if (!SFX.ctx) return;
    const d = chain(pos, 40, 0.5); if (!d) return;
    const t0 = now();
    noise(d, t0, 0.4, 'highpass', 4000, 0.6, 0.6);
    for (let i = 0; i < 5; i++) tone(d, t0 + Math.random() * 0.15, 0.2, 2500 + Math.random() * 3000, null, 0.08, 'triangle');
  };
  SFX.impact = function (pos, soft) {
    if (!SFX.ctx) return;
    const d = chain(pos, 25, 0.25); if (!d) return;
    noise(d, now(), 0.06, 'bandpass', soft ? 700 : 2600, 1.5, 0.6);
  };
  SFX.wood = function (pos) {
    if (!SFX.ctx) return;
    const d = chain(pos, 35, 0.6); if (!d) return;
    const t0 = now(); noise(d, t0, 0.25, 'bandpass', 420, 1.0, 0.8); tone(d, t0, 0.12, 180, 90, 0.4, 'triangle');
  };
  SFX.melee = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 25, 0.6); if (!d) return; noise(d, now(), 0.15, 'lowpass', 600, 0.8, 0.9); };
  SFX.reload = function (pos, local, phase) {
    if (!SFX.ctx) return;
    const d = chain(local ? null : pos, 14, local ? 0.25 : 0.4); if (!d) return;
    const t0 = now();
    noise(d, t0, 0.05, 'bandpass', phase ? 3200 : 1800, 3, 0.7);
    tone(d, t0, 0.04, phase ? 1400 : 900, null, 0.15, 'square');
  };
  SFX.empty = function () { if (!SFX.ctx) return; const d = chain(null, 1, 0.2); tone(d, now(), 0.03, 2200, null, 0.3, 'square'); };
  SFX.hit = function (head) { if (!SFX.ctx) return; const d = chain(null, 1, 0.22); tone(d, now(), 0.05, head ? 2600 : 1700, null, 0.5, 'triangle'); };
  SFX.hurt = function () { if (!SFX.ctx) return; const d = chain(null, 1, 0.5); noise(d, now(), 0.18, 'lowpass', 400, 1, 1); tone(d, now(), 0.15, 110, 60, 0.6); };
  SFX.beep = function (pos, f, vol) { if (!SFX.ctx) return; const d = chain(pos, 30, vol || 0.35); if (!d) return; tone(d, now(), 0.09, f || 1800, null, 0.6, 'square'); };
  SFX.ui = function (f) { if (!SFX.ctx) return; const d = chain(null, 1, 0.18); tone(d, now(), 0.05, f || 900, null, 0.7, 'triangle'); };
  SFX.ping = function () { if (!SFX.ctx) return; const d = chain(null, 1, 0.25); const t = now(); tone(d, t, 0.12, 1320, null, 0.5); tone(d, t + 0.08, 0.18, 1760, null, 0.4); };
  SFX.alarm = function () { if (!SFX.ctx) return; const d = chain(null, 1, 0.25); const t = now(); for (let i = 0; i < 3; i++) tone(d, t + i * 0.12, 0.08, 980, null, 0.5, 'square'); };
  SFX.metal = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 35, 0.6); if (!d) return; const t = now(); tone(d, t, 0.5, 320, 300, 0.4, 'triangle'); tone(d, t, 0.4, 755, null, 0.25, 'triangle'); noise(d, t, 0.1, 'bandpass', 2000, 2, 0.5); };
  SFX.zap = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 30, 0.6); if (!d) return; const t = now(); tone(d, t, 0.35, 90, 1600, 0.4, 'sawtooth'); noise(d, t, 0.3, 'highpass', 5000, 1, 0.3); };
  SFX.sonar = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 40, 0.5); if (!d) return; const t = now(); tone(d, t, 1.1, 1400, 700, 0.35); tone(d, t + 0.02, 1.0, 2100, 1050, 0.12); };
  SFX.flashRing = function (strength) { if (!SFX.ctx) return; const d = chain(null, 1, 0.12 * strength); if (!d) return; const t = now(); tone(d, t, 3.5 * strength, 3600, 3400, 0.6); };
  SFX.throwS = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 15, 0.3); if (!d) return; noise(d, now(), 0.12, 'bandpass', 1200, 1, 0.5); };
  SFX.whoosh = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 30, 0.5); if (!d) return; noise(d, now(), 0.4, 'bandpass', 800, 0.8, 0.6); };
  /* rappel: a hook clanking onto the wall top, then the rope paying out */
  SFX.hook = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 30, 0.55); if (!d) return; const t = now(); tone(d, t, 0.16, 1900, 1500, 0.3, 'triangle'); tone(d, t + 0.02, 0.1, 2700, null, 0.15, 'triangle'); noise(d, t + 0.08, 0.45, 'bandpass', 1300, 1.4, 0.45); };
  SFX.voice = function (kind) {
    if (!SFX.ctx) return; const d = chain(null, 1, 0.22); const t = now();
    const seq = kind === 'win' ? [660, 880, 1100] : kind === 'lose' ? [440, 330, 220] : kind === 'start' ? [523, 659] : [700];
    seq.forEach((f, i) => tone(d, t + i * 0.14, 0.2, f, null, 0.5, 'triangle'));
  };

  /* looping sounds: returns {stop(), set(pos)} */
  SFX.loop = function (kind, pos) {
    if (!SFX.ctx) return { stop() { }, set() { } };
    const c = SFX.ctx, g = c.createGain(); g.gain.value = 0;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { g.connect(p); p.connect(SFX.master); } else g.connect(SFX.master);
    let src;
    if (kind === 'drone') { src = c.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 140; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; src.connect(f); f.connect(g); }
    else if (kind === 'burn' || kind === 'fire') { src = c.createBufferSource(); src.buffer = SFX.noise; src.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'burn' ? 2500 : 700; f.Q.value = 0.6; src.connect(f); f.connect(g); }
    else { src = c.createOscillator(); src.frequency.value = 600; src.connect(g); }
    src.start();
    const L = {
      pos, base: kind === 'drone' ? 0.06 : 0.35, range: kind === 'drone' ? 18 : 28, local: false,
      set(np) { L.pos = np; },
      update() {
        let gain = L.base, pan = 0;
        if (!L.local && L.pos) {
          const dx = L.pos.x - SFX.lp.x, dy = L.pos.y - SFX.lp.y, dz = L.pos.z - SFX.lp.z, d = Math.hypot(dx, dy, dz);
          gain *= Math.max(0, 1 - d / L.range) ** 1.5;
          pan = -Math.sin(Math.atan2(-dx, -dz) - SFX.lp.yaw) * Math.min(1, d / 2);
        }
        g.gain.setTargetAtTime(gain, c.currentTime, 0.05);
        if (p) p.pan.setTargetAtTime(pan, c.currentTime, 0.05);
      },
      stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.05); src.stop(c.currentTime + 0.3); } catch (e) { } SFX.loops.delete(L); },
    };
    SFX.loops.add(L);
    return L;
  };
  SFX.update = function () { for (const L of SFX.loops) L.update(); };
  SFX.stopAll = function () { for (const L of [...SFX.loops]) L.stop(); };

  /* ------------------------------------------------ the defuser being planted */
  SFX.plant = function (pos) { if (!SFX.ctx) return; const d = chain(pos, 30, 0.5); if (!d) return; const t = now(); for (let i = 0; i < 4; i++) tone(d, t + i * 0.09, 0.07, 1400 + i * 300, null, 0.5, 'square'); };

  /* ------------------------------------------------ your own sound files
     "sound effects/sfx.js" sets window.SFX_FILES = { key: ['file.mp3', ...] }.
     Any key with a file plays that file (a random one if several) in place of
     the synthesised sound, with the same 3D placement, walls and distance. */
  const FILES = {}, asked = new Set();
  SFX.loadFiles = function () {
    const map = window.SFX_FILES; if (!map || !SFX.ctx) return;
    for (const key in map) for (const f of [].concat(map[key] || [])) {
      if (!f || asked.has(key + '|' + f)) continue; asked.add(key + '|' + f);
      fetch('sound%20effects/' + encodeURIComponent(f)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(f)))
        .then(b => SFX.ctx.decodeAudioData(b)).then(buf => { (FILES[key] = FILES[key] || []).push(buf); })
        .catch(() => console.warn('sound effect not found or unreadable: sound effects/' + f));
    }
  };
  SFX.hasFile = key => !!(FILES[key] && FILES[key].length);
  function playFile(key, pos, range, gain) {
    const d = chain(pos, range, gain); if (!d) return;
    const src = SFX.ctx.createBufferSource(); src.buffer = FILES[key][Math.floor(Math.random() * FILES[key].length)];
    src.playbackRate.value = 0.97 + Math.random() * 0.06; src.connect(d); src.start();
  }
  // name: [keys(...args) -> candidate keys, pos(...args), range, gain(...args)]
  const OVR = {
    shot: [(w, p, l) => ['shot.' + w.id, 'shot.' + w.type, 'shot'], (w, p, l) => l ? null : p, 90, (w, p, l) => l ? 0.6 : 0.9],
    step: [(p, loud, l, m) => [m === 'metal' ? 'step.metal' : 'step', 'step'], (p, loud, l) => l ? null : p, 18, (p, loud, l) => (l ? 0.2 : 0.6) * (loud ? 1 : 0.55)],
    explosion: [(p, big, v) => [v ? 'explosion.' + v : '', 'explosion'], p => p, 140, () => 1],
    crumble: [() => ['crumble'], p => p, 50, () => 0.7],
    glass: [() => ['glass'], p => p, 40, () => 0.6],
    impact: [(p, soft) => [soft ? 'impact.soft' : 'impact.hard', 'impact'], p => p, 25, () => 0.35],
    wood: [(p, brk) => [brk ? 'break' : 'barricade', 'wood'], p => p, 35, () => 0.8],
    melee: [() => ['melee'], p => p, 25, () => 0.7],
    reload: [(p, l, ph) => [ph ? 'reload.in' : 'reload.out', 'reload'], (p, l) => l ? null : p, 14, (p, l) => l ? 0.4 : 0.5],
    empty: [() => ['empty'], () => null, 1, () => 0.4],
    hit: [h => [h ? 'hit.head' : 'hit', 'hit'], () => null, 1, () => 0.5],
    hurt: [() => ['hurt'], () => null, 1, () => 0.6],
    beep: [() => ['beep'], p => p, 30, () => 0.5],
    ui: [() => ['ui'], () => null, 1, () => 0.4],
    ping: [() => ['ping'], () => null, 1, () => 0.6],
    alarm: [() => ['alarm'], () => null, 1, () => 0.6],
    metal: [() => ['metal'], p => p, 35, () => 0.7],
    zap: [() => ['zap'], p => p, 30, () => 0.7],
    sonar: [() => ['sonar'], p => p, 40, () => 0.8],
    flashRing: [() => ['ring'], () => null, 1, s => 0.5 * s],
    throwS: [() => ['throw'], p => p, 15, () => 0.5],
    whoosh: [() => ['whoosh'], p => p, 30, () => 0.6],
    hook: [() => ['hook'], p => p, 30, () => 0.7],
    plant: [() => ['plant'], p => p, 30, () => 0.9],
    voice: [k => ['round.' + k], () => null, 1, () => 0.7],
  };
  for (const name in OVR) {
    const [keys, posF, range, gainF] = OVR[name], orig = SFX[name];
    SFX[name] = function (...a) {
      if (SFX.ctx && window.SFX_FILES) { const k = keys(...a).find(x => x && SFX.hasFile(x)); if (k) { playFile(k, posF(...a), range, gainF(...a)); return; } }
      return orig.apply(SFX, a);
    };
  }
  const init0 = SFX.init;
  SFX.init = function () { const had = !!SFX.ctx; init0(); if (!had && SFX.ctx) SFX.loadFiles(); };

  window.SFX = SFX;
})();
