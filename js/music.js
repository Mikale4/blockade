/* music.js -- the soundtrack.
   If audio/playlist.js lists music files, each game moment (menu, select, prep,
   action, clutch, range, after) shuffles through its own pool with crossfades.
   Otherwise an original adaptive score is synthesised live. Win/loss stings are
   always synthesised, over a ducked track. */
(function () {
  'use strict';
  const MU = { cur: null, intensity: 0, gain: null, timer: null, step: 0, nextT: 0, files: {}, el: null };
  const A = () => SFX.ctx;
  // A minor-ish material
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const PROG = { menu: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], select: [[57, 60, 64], [55, 58, 62]], prep: [[45, 52], [44, 51]], action: [[45, 48, 52], [41, 45, 48], [43, 46, 50], [40, 44, 47]], range: [[57, 60, 64], [53, 57, 60]] };
  const TEMPO = { menu: 84, select: 96, prep: 72, action: 124, range: 100 };

  function out() {
    const c = A(); if (!c) return null;
    if (!MU.gain) { MU.gain = c.createGain(); MU.gain.gain.value = G.settings.music; const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; MU.gain.connect(comp); comp.connect(c.destination); }
    return MU.gain;
  }

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, peak, dest, a, filt) {
    const c = A(), o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    let head = o;
    if (filt) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; fl.Q.value = 3; o.connect(fl); head = fl; }
    head.connect(g); g.connect(dest); env(g, t, a || 0.005, peak, dur); o.start(t); o.stop(t + (a || 0.005) + dur + 0.05);
  }
  function noise(t, dur, peak, dest, type, f) {
    const c = A(), s = c.createBufferSource(); s.buffer = SFX.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = c.createGain();
    s.connect(fl); fl.connect(g); g.connect(dest); env(g, t, 0.002, peak, dur); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const kick = (t, d, v) => { const c = A(), o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); g.connect(d); env(g, t, 0.002, v, 0.25); o.start(t); o.stop(t + 0.35); };
  const pad = (notes, t, dur, d, v, filt) => { for (const n of notes) for (const det of [-6, 6]) { const c = A(), o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = N(n); o.detune.value = det; f.type = 'lowpass'; f.frequency.value = filt || 900; o.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05); } };

  /* one 16th-note step of the current track */
  function tick(name, s, t, d) {
    const prog = PROG[name], bar = Math.floor(s / 16), chord = prog[bar % prog.length], st = s % 16, I = MU.intensity;
    const spb = 60 / TEMPO[name] / 4;
    if (name === 'menu' || name === 'range') {
      if (st === 0) pad(chord, t, spb * 16, d, 0.035, 700);
      if (st % 4 === 0) osc('sine', N(chord[0] - 12), t, spb * 3, 0.12, d, 0.01, 400);
      if ([0, 3, 6, 10, 12].includes(st)) osc('triangle', N(chord[(st >> 1) % chord.length] + 12), t, spb * 2, 0.04, d, 0.003, 2400);
      if (name === 'range' && st % 8 === 4) noise(t, 0.08, 0.05, d, 'highpass', 6000);
    } else if (name === 'select') {
      if (st === 0) pad(chord, t, spb * 16, d, 0.03, 600);
      if (st % 2 === 0) osc('sawtooth', N(chord[0] - 12), t, spb * 0.9, 0.05, d, 0.003, 500 + (st % 8) * 120);
      if (st === 0 || st === 8) kick(t, d, 0.25);
      if (st % 4 === 2) noise(t, 0.05, 0.04, d, 'highpass', 7000);
    } else if (name === 'prep') {
      if (st === 0 && bar % 2 === 0) pad(chord, t, spb * 32, d, 0.05, 380);
      if (st === 0) osc('sine', N(chord[0] - 12), t, spb * 14, 0.12, d, 0.4, 200);
      if (st % 8 === 0) noise(t, 0.03, 0.06, d, 'bandpass', 3200);   // a clock tick
      if (st === 12 && bar % 4 === 3) osc('triangle', N(chord[1] + 24), t, spb * 6, 0.03, d, 0.02, 3000);
    } else if (name === 'action') {
      if (st === 0) pad(chord, t, spb * 16, d, 0.02 + I * 0.02, 600 + I * 900);
      if (st % 4 === 0 || (I > 0.5 && st === 14) || (I > 0.8 && st === 7)) kick(t, d, 0.32);
      if (st === 4 || st === 12) noise(t, 0.12, 0.08 + I * 0.05, d, 'bandpass', 1800);
      if (st % 2 === 0 || I > 0.6) noise(t, 0.03, 0.025 + I * 0.02, d, 'highpass', 8000);
      const bassPat = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 3, 0, 12, 7];
      osc('sawtooth', N(chord[0] - 12 + bassPat[st]), t, spb * 0.8, 0.06 + I * 0.03, d, 0.003, 300 + I * 700);
      if (I > 0.35 && st % 2 === 1) osc('square', N(chord[st % chord.length] + 12), t, spb * 0.5, 0.012 + I * 0.012, d, 0.002, 2000);
    }
  }
  function schedule() {
    const c = A(); if (!c || !MU.synth) return;
    const d = out(), name = MU.synth, spb = 60 / TEMPO[name] / 4;
    while (MU.nextT < c.currentTime + 0.15) { tick(name, MU.step, MU.nextT, d); MU.step++; MU.nextT += spb; }
  }
  /* ------------------------------------------------------------ file playlists
     audio/playlist.js sets window.MUSIC_PLAYLIST = { menu: [...], select: [...], ... }.
     Each moment shuffles through its own pool; moments crossfade into each other. */
  const FALLBACK = { clutch: ['action'], after: ['menu', 'select'], range: ['select', 'menu'], select: ['menu'], prep: ['select'], action: ['prep'] };
  const bad = new Set();
  MU.decks = [];          // { el, cat, target }
  MU.bags = {};
  function pool(cat) {
    const pl = window.MUSIC_PLAYLIST; if (!pl) return null;
    for (const c of [cat, ...(FALLBACK[cat] || [])]) { const l = (pl[c] || []).filter(f => !bad.has(f)); if (l.length) return l; }
    return null;
  }
  function draw(cat) {
    const l = pool(cat); if (!l) return null;
    let bag = MU.bags[cat];
    if (!bag || !bag.length) { bag = MU.bags[cat] = U.shuffle(l.slice()); if (MU.lastFile && bag.length > 1 && bag[bag.length - 1] === MU.lastFile) bag.unshift(bag.pop()); }
    let f = bag.pop(); while (f && bad.has(f)) f = bag.pop();
    return f || null;
  }
  function vol() { return G.settings.music * (MU.duckT > performance.now() ? 0.25 : 1); }
  function startFile(cat, tries) {
    tries = tries || 0;
    const f = draw(cat);
    if (!f || tries > 6) { MU.fileMode = false; startSynth(cat); return; }
    MU.lastFile = f;
    const el = new Audio('audio/' + encodeURIComponent(f));
    el.volume = 0; el.preload = 'auto';
    const deck = { el, cat, target: 1, file: f };
    for (const d of MU.decks) d.target = 0;
    MU.decks.push(deck);
    el.onended = () => { if (MU.cur === cat && MU.decks[MU.decks.length - 1] === deck) startFile(cat); };
    el.onerror = () => { bad.add(f); deck.target = 0; if (MU.cur === cat) startFile(cat, tries + 1); };
    const p = el.play(); if (p && p.catch) p.catch(() => { MU.blocked = true; });
    MU.nowPlaying = f.replace(/\.mp3$/i, '').replace(/^\d+\.\s*/, '');
  }
  function startSynth(name) {
    if (!A() || !TEMPO[name]) return;
    clearInterval(MU.timer); MU.step = 0; MU.nextT = A().currentTime + 0.1;
    MU.synth = name; MU.timer = setInterval(schedule, 50);
  }
  function stopSynth() { clearInterval(MU.timer); MU.timer = null; MU.synth = null; }
  MU.play = function (name) {
    if (MU.cur === name) return;
    MU.cur = name;
    if (pool(name)) { stopSynth(); MU.fileMode = true; startFile(name); }
    else { for (const d of MU.decks) d.target = 0; MU.fileMode = false; if (A()) startSynth(name === 'clutch' ? 'action' : name === 'after' ? 'menu' : name); }
  };
  MU.stop = function () { stopSynth(); MU.cur = null; for (const d of MU.decks) d.target = 0; };
  /* browsers block playback until a click or key: retry then */
  MU.unlock = function () {
    MU.blocked = false;
    const top = MU.decks[MU.decks.length - 1];
    if (top && top.el.paused) top.el.play().catch(() => { });
    if (!MU.fileMode && MU.cur && !MU.timer && A()) startSynth(MU.cur);
  };
  MU.sting = function (win) {
    MU.duckT = performance.now() + 3200;
    if (!A()) return;
    if (!MU.fileMode) stopSynth();
    const d = out(), t = A().currentTime + 0.05;
    const seq = win ? [57, 60, 64, 69] : [57, 56, 53, 50];
    seq.forEach((n, i) => { osc('sawtooth', N(n), t + i * 0.16, 0.5, 0.06, d, 0.01, 1800); osc('sine', N(n - 12), t + i * 0.16, 0.6, 0.08, d); });
    pad(win ? [57, 61, 64] : [53, 56, 60], t + 0.64, 2.4, d, 0.05, 900);
    kick(t, d, 0.4);
  };
  /* called every frame */
  let lastNow = performance.now();
  MU.update = function () {
    const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    // crossfades: 1.6 s in, 1.6 s out
    const v = vol();
    for (let i = MU.decks.length - 1; i >= 0; i--) {
      const d = MU.decks[i];
      d.level = U.clamp((d.level || 0) + (d.target ? dt : -dt) / 1.6, 0, 1);
      try { d.el.volume = U.clamp(d.level * v, 0, 1); } catch (e) { }
      if (!d.target && d.level <= 0) { d.el.pause(); d.el.src = ''; MU.decks.splice(i, 1); }
    }
    if (G.mode === 'match' && !G.paused) {
      const ph = GAME.phase;
      if (ph === 'prep') MU.play('prep');
      else if (ph === 'action') {
        const df = GAME.obj.defuser;
        const clutch = (df && df.alive) || GAME.timer < 30 || (GAME.mode === 'hostage' && GAME.obj.hostage && GAME.obj.hostage.followTarget);
        MU.play(clutch || MU.cur === 'clutch' ? 'clutch' : 'action');
        let target = df && df.alive ? 1 : GAME.timer < 30 ? 0.85 : GAME.timer < 60 ? 0.55 : 0.3;
        if (G.time - (MU.lastShot || -9) < 4) target = Math.max(target, 0.6);
        MU.intensity += (target - MU.intensity) * 0.02;
      }
    } else if (G.mode === 'range' && !G.paused) MU.play('range');
  };
  MU.setVolume = v => { if (MU.gain) MU.gain.gain.setTargetAtTime(v, A().currentTime, 0.1); };

  window.MUSIC = MU;
})();
