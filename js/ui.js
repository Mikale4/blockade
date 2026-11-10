/* ui.js -- menu building blocks for the account, social and online screens:
   toasts, modals, avatars, buttons, the top bar (friends / messages / you). */
(function () {
  'use strict';
  const el = U.el;
  const UI = window.UI = {};
  let leave = [];

  UI.btn = (text, fn, cls) => el('button', { class: 'btn ' + (cls || ''), onclick: e => { SFX.init(); SFX.ui(); fn(e); } }, text);
  UI.toast = (text, kind, ms) => {
    let box = U.$('uiToasts'); if (!box) { box = el('div', { id: 'uiToasts' }); document.body.append(box); }
    const t = el('div', { class: 'utoast ' + (kind || '') }, text);
    box.prepend(t);
    setTimeout(() => t.classList.add('out'), ms || 3000); setTimeout(() => t.remove(), (ms || 3000) + 500);
    while (box.children.length > 5) box.lastChild.remove();
    return t;
  };
  UI.modal = o => {
    const card = el('div', { class: 'modal ' + (o.cls || '') }, el('div', { class: 'mhead' }, el('b', {}, o.title || ''), el('button', { class: 'mclose', onclick: () => close() }, '✕')));
    const body = el('div', { class: 'mbody' }, ...(o.body || []));
    const foot = el('div', { class: 'mfoot' }, ...(o.buttons || []).map(([t, fn, cls]) => el('button', { class: 'btn ' + (cls || ''), onclick: () => { SFX.ui(); if (fn() !== false) close(); } }, t)));
    card.append(body); if (o.buttons && o.buttons.length) card.append(foot);
    const ov = el('div', { class: 'uoverlay', onclick: e => { if (e.target === ov) close(); } }, card);
    document.body.append(ov);
    let closed = false;
    function close() { if (closed) return; closed = true; ov.remove(); if (o.onClose) o.onClose(); }
    return { close, el: card, body };
  };
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 360; };
  UI.avatar = (id, name, size) => el('div', { class: 'av ' + (size || ''), style: { background: 'hsl(' + hue(id) + ',45%,38%)' } }, String(name || '?').slice(0, 2).toUpperCase());
  UI.rating = r => el('span', { class: 'rchip' }, String(Math.round(r || 1000)));
  UI.lv = lv => el('span', { class: 'lvchip' }, 'LV ' + (lv || 1));
  UI.tagOf = id => '#' + String(id || '').slice(0, 4).toUpperCase();

  /* full-screen menu page (replaces whatever menu screen is up) */
  UI.screen = node => {
    const fns = leave; leave = []; fns.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    MENU.stopPreview && MENU.stopPreview();
    const s = U.$('screens'); s.innerHTML = ''; s.className = 'pages'; s.append(node);
  };
  UI.onLeave = fn => leave.push(fn);

  /* the bar along the top of the account screens */
  UI.topbar = (title, onBack) => {
    const bar = el('div', { class: 'topbar' });
    const draw = () => {
      if (!document.body.contains(bar) && bar.dataset.drawn) { offs.forEach(f => f()); return; }
      bar.dataset.drawn = 1; bar.innerHTML = '';
      const S = Auth.S;
      const reqs = S ? Object.keys(S.reqIn).length : 0, unread = S && window.Social ? Social.unread() : 0;
      const st = window.Net ? Net.state : 'off';
      bar.append(
        onBack ? el('button', { class: 'tb-back', onclick: () => { SFX.ui(); onBack(); } }, '‹') : el('span', { class: 'tb-logo' }, 'BLOCKADE'),
        el('b', { class: 'tb-title' }, title || ''),
        el('div', { class: 'grow' }),
        el('button', { class: 'tb-net ' + st, title: 'Online status', onclick: () => { if (st === 'off' || st === 'down') Net.start(); } }, el('i', { class: 'dot' + (st === 'up' ? ' on' : '') }), st === 'up' ? 'ONLINE · ' + Net.players.size : st === 'connecting' ? 'CONNECTING…' : st === 'down' ? 'OFFLINE · RETRY' : 'OFFLINE'),
        S ? el('button', { class: 'tb-btn', onclick: () => Social.friends() }, 'FRIENDS', reqs ? el('i', { class: 'nbadge' }, reqs) : null) : null,
        S ? el('button', { class: 'tb-btn', onclick: () => Social.messages() }, 'MESSAGES', unread ? el('i', { class: 'nbadge' }, unread) : null) : null,
        S ? el('button', { class: 'tb-me', onclick: () => MENU.profile() }, UI.avatar(Auth.id, Auth.name, 'sm'), el('span', {}, el('b', {}, Auth.name), el('small', {}, UI.tagOf(Auth.id) + ' · LV ' + Auth.lv()))) : null);
    };
    const offs = [Net.on('state', draw), Net.on('players', draw), window.Social ? Social.on('change', draw) : () => { }];
    draw();
    return bar;
  };
})();
