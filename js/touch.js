/* touch.js -- playing on a phone or a tablet. Only on touch screens (a coarse pointer); a mouse and
   keyboard never see any of this.

     moving       a stick that appears wherever the left thumb lands (pushed all the way: sprint)
     looking      drag anywhere on the right half (the fire button too, so you can aim while shooting)
     buttons      fire, aim, reload, vault, crouch, use (hold), gadget, ability, swap, melee, lean left
                  and right, the drone / cameras, and the scoreboard
     City Z       pack, map, orders (the five orders as buttons), treat, throw
     spectating   previous / next player, free camera
     pause        top right, any time in a match

   A phone has no pointer lock, so while a match is being played, touch counts as locked (player.js
   only takes actions when it is). Every button presses the action's own key (KEYS.map), so anything
   rebound still works. Matches want the phone sideways: held upright, it says so. */
(function () {
  'use strict';
  const coarse = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  const T = window.TOUCH = { on: coarse() };
  if (!T.on) return;
  document.documentElement.classList.add('touch');
  const P = () => window.PLAYER;

  /* ------------------------------------------------ no pointer lock on a phone */
  const oLock = PLAYER.lock;
  PLAYER.lock = function () { if (T.on) { PLAYER.locked = true; try { SFX.init(); } catch (e) { } return; } return oLock.apply(this, arguments); };
  const oRelease = PLAYER.release;
  PLAYER.release = function () { const r = oRelease.apply(this, arguments); PLAYER.locked = false; return r; };

  const code = act => KEYS.map[act];
  const press = act => { const c = code(act); if (c) P().codeDown(c); };
  const lift = act => { const c = code(act); if (c) P().codeUp(c); };
  const key = act => { const c = code(act); if (c) { window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })); } };

  /* ------------------------------------------------ the layer */
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const root = el('div', 'tc'); root.id = 'touchUI';
  const stickZone = el('div', 'tc-stick-zone'), lookZone = el('div', 'tc-look-zone');
  const stick = el('div', 'tc-stick'), knob = el('div', 'tc-knob'); stick.append(knob);
  root.append(lookZone, stickZone, stick);
  // buttons: [action, label, class]; 'hold' ones stay down while touched
  const BTN = [
    ['fire', 'FIRE', 'b-fire'], ['aim', 'AIM', 'b-aim'], ['reload', 'RELOAD', 'b-reload'], ['vault', 'VAULT', 'b-jump'],
    ['crouch', 'CROUCH', 'b-crouch'], ['interact', 'USE', 'b-use'], ['gadget', 'GADGET', 'b-gadget'], ['ability', 'ABILITY', 'b-ability'],
    ['swap', 'SWAP', 'b-swap'], ['melee', 'MELEE', 'b-melee'], ['leanL', '◀ LEAN', 'b-leanl'], ['leanR', 'LEAN ▶', 'b-leanr'],
    ['device', 'DRONE', 'b-device'], ['scoreboard', 'SCORES', 'b-score'],
  ];
  const buttons = {};
  for (const [act, label, cls] of BTN) { const b = el('button', 'tc-btn ' + cls, label); b.dataset.act = act; root.append(b); buttons[act] = b; }
  // City Z
  const cz = el('div', 'tc-cz');
  for (const [act, label] of [['czInv', 'PACK'], ['czMap', 'MAP'], ['czOrders', 'ORDERS'], ['czHeal', 'TREAT'], ['czThrow', 'THROW'], ['czCare', 'CARE']]) { const b = el('button', 'tc-btn tc-small', label); b.dataset.key = act; cz.append(b); }
  const orders = el('div', 'tc-orders'); root.append(cz, orders);
  // spectating
  const spec = el('div', 'tc-spec');
  for (const [act, label] of [['aim', '◀ PREV'], ['device', 'FREE CAM'], ['fire', 'NEXT ▶']]) { const b = el('button', 'tc-btn tc-small', label); b.dataset.tap = act; spec.append(b); }
  root.append(spec);
  const pause = el('button', 'tc-btn tc-pause', 'II'); root.append(pause);
  const rotate = el('div', 'tc-rotate', 'Turn your phone sideways to play'); root.append(rotate);
  document.body.append(root);

  /* ------------------------------------------------ pointers */
  const held = new Map();      // pointerId -> { kind, act, x, y }
  const LOOK_K = 1.7;          // finger pixels -> mouse counts (then the game's own sensitivity)
  function look(dx, dy) { if (P().locked) P().look(dx * LOOK_K, dy * LOOK_K); }
  const MOVE = ['forward', 'back', 'left', 'right', 'sprint'];
  const moveOn = {};
  function setMove(want) { for (const a of MOVE) { if (!!want[a] === !!moveOn[a]) continue; moveOn[a] = !!want[a]; if (want[a]) press(a); else lift(a); } }
  function stickAt(s, x, y) {
    const dx = x - s.x, dy = y - s.y, r = 56, d = Math.hypot(dx, dy), k = Math.min(1, d / r);
    const nx = d ? dx / d * k : 0, ny = d ? dy / d * k : 0;
    knob.style.transform = 'translate(' + (nx * r) + 'px,' + (ny * r) + 'px)';
    setMove({ forward: ny < -0.35, back: ny > 0.35, left: nx < -0.35, right: nx > 0.35, sprint: k > 0.95 && ny < -0.6 });
  }
  root.addEventListener('pointerdown', e => {
    const t = e.target;
    e.preventDefault();
    try { t.setPointerCapture && t.setPointerCapture(e.pointerId); } catch (err) { }
    if (t === pause) { MENU.pause(); return; }
    if (t.dataset.tap) { press(t.dataset.tap); lift(t.dataset.tap); t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 120); return; }
    if (t.dataset.key) {
      if (t.dataset.key === 'czOrders' && window.CZ && CZ.ORDERS) { openOrders(); return; }
      key(t.dataset.key); return;
    }
    if (t.dataset.order) { CZ.orders(t.dataset.order); orders.classList.remove('show'); return; }
    if (t.dataset.act) { press(t.dataset.act); t.classList.add('on'); held.set(e.pointerId, { kind: 'btn', act: t.dataset.act, el: t, x: e.clientX, y: e.clientY }); return; }
    if (t === stickZone) { held.set(e.pointerId, { kind: 'stick', x: e.clientX, y: e.clientY }); stick.style.left = (e.clientX - 60) + 'px'; stick.style.top = (e.clientY - 60) + 'px'; stick.classList.add('show'); stickAt(held.get(e.pointerId), e.clientX, e.clientY); return; }
    if (t === lookZone) { held.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY }); }
  }, { passive: false });
  root.addEventListener('pointermove', e => {
    const h = held.get(e.pointerId); if (!h) return;
    e.preventDefault();
    if (h.kind === 'stick') { stickAt(h, e.clientX, e.clientY); return; }
    // looking: the look zone, and dragging off the fire or aim button
    if (h.kind === 'look' || h.act === 'fire' || h.act === 'aim') { look(e.clientX - h.x, e.clientY - h.y); h.x = e.clientX; h.y = e.clientY; }
  }, { passive: false });
  const end = e => {
    const h = held.get(e.pointerId); if (!h) return;
    held.delete(e.pointerId);
    if (h.kind === 'btn') { lift(h.act); h.el.classList.remove('on'); }
    if (h.kind === 'stick') { setMove({}); stick.classList.remove('show'); knob.style.transform = ''; }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  function releaseAll() { for (const [id, h] of [...held]) end({ pointerId: id }); setMove({}); }
  function openOrders() {
    orders.innerHTML = '';
    for (const [k, o] of Object.entries(CZ.ORDERS)) { const b = el('button', 'tc-btn tc-small', o.name); b.dataset.order = k; orders.append(b); }
    orders.classList.toggle('show');
  }

  /* ------------------------------------------------ when it shows */
  function playing() {
    if (!window.G || !(G.mode === 'match' || G.mode === 'range') || G.paused) return false;
    const scr = document.getElementById('screens'); if (scr && scr.children.length && getComputedStyle(scr).display !== 'none' && scr.firstElementChild && scr.firstElementChild.offsetParent !== null) return false;
    if (window.CZ && CZ.ui && CZ.ui.isOpen && CZ.ui.isOpen()) return false;
    if (window.MENU && MENU.capturing) return false;
    return !!(G.player && PLAYER.enabled);
  }
  let was = false;
  function frame() {
    const on = playing();
    if (on !== was) { was = on; if (!on) releaseAll(); }
    root.classList.toggle('show', on);
    if (on) {
      if (!PLAYER.locked) PLAYER.locked = true;
      const ghost = !!(G.player && G.player.ghost);
      root.classList.toggle('spec', ghost);
      root.classList.toggle('cz', !!(window.GAME && GAME.mode === 'cityz'));
      root.classList.toggle('upright', innerHeight > innerWidth * 1.1 && innerWidth < 600);   // (a tablet upright is wide enough)
      const a = G.player;
      if (a && !ghost) {
        buttons.gadget.style.display = a.gadget ? '' : 'none';
        buttons.ability.style.display = a.ability ? '' : 'none';
        buttons.swap.style.display = a.w && a.w.length > 1 ? '' : 'none';
      }
    } else if (PLAYER.locked && !document.pointerLockElement) PLAYER.locked = false;
    requestAnimationFrame(frame);
  }
  // the weapon swap: whichever one isn't in hand (a touch-only "key", never saved with the bindings)
  KEYS.map.swap = 'TouchSwap';
  const oSave = KEYS.save; KEYS.save = function () { delete KEYS.map.swap; const r = oSave.apply(this, arguments); KEYS.map.swap = 'TouchSwap'; return r; };
  const oAction = PLAYER.action;
  PLAYER.action = function (act) { if (act === 'swap') { const a = G.player; if (a && !a.ghost && a.w && a.w.length > 1) return oAction.call(this, a.cur === 0 ? 'secondary' : 'primary'); return; } return oAction.apply(this, arguments); };
  requestAnimationFrame(frame);
  // a tap on the page starts the audio (browsers wait for one)
  window.addEventListener('pointerdown', () => { try { SFX.init(); if (window.MUSIC && MUSIC.unlock) MUSIC.unlock(); } catch (e) { } }, { passive: true });
})();
