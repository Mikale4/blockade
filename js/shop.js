/* shop.js -- the shop: spend the credits you earn by playing on looks for your operators.
   Weapon finishes, uniforms, reticle colours and player cards (DATA.COSMETICS). Nothing in
   here changes how anything plays, and credits only come from matches: there is no real money.
   Three items a day are on sale at 30% off.

     SHOP.open()  SHOP.look() (your {finish, suit})  SHOP.css(kind)  SHOP.randomLook()  SHOP.clean(cos)  */
(function () {
  'use strict';
  const { COSMETICS, COS_KINDS, RARITY, OPS } = DATA;
  const $ = U.el;
  const FREE = { finish: 'factory', suit: 'standard', reticle: 'white', card: 'plain' };
  const SHOP = {};
  const S = () => Auth.S;
  SHOP.credits = () => (S() && S().credits) || 0;
  SHOP.owns = (kind, id) => !!COSMETICS[kind][id] && (COSMETICS[kind][id].price === 0 || !!(S() && S().owned[kind + ':' + id]));
  SHOP.equipped = kind => { const id = S() && S().equip[kind]; return id && SHOP.owns(kind, id) ? id : FREE[kind]; };
  SHOP.look = () => ({ finish: SHOP.equipped('finish'), suit: SHOP.equipped('suit') });
  SHOP.css = kind => (COSMETICS[kind][SHOP.equipped(kind)] || {}).css || '';
  /* looks that came over the network: only names we know */
  SHOP.clean = c => ({ finish: c && COSMETICS.finish[c.finish] ? c.finish : FREE.finish, suit: c && COSMETICS.suit[c.suit] ? c.suit : FREE.suit });
  /* what a bot wears: about half keep the issue kit, the rest show off something (rarer is rarer) */
  const WEIGHT = { common: 6, rare: 3, epic: 1.5, legendary: 0.6 };
  function weighted(kind) {
    const ids = Object.keys(COSMETICS[kind]).filter(id => COSMETICS[kind][id].price > 0);
    let tot = 0; for (const id of ids) tot += WEIGHT[COSMETICS[kind][id].rarity];
    let r = Math.random() * tot; for (const id of ids) { r -= WEIGHT[COSMETICS[kind][id].rarity]; if (r <= 0) return id; }
    return ids[0];
  }
  SHOP.randomLook = () => ({ finish: Math.random() < 0.5 ? FREE.finish : weighted('finish'), suit: Math.random() < 0.6 ? FREE.suit : weighted('suit') });

  /* today's deals: the same three for everyone on a given day */
  SHOP.deals = function () {
    const day = new Date().toISOString().slice(0, 10);
    let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const all = [];
    for (const kind in COSMETICS) for (const id in COSMETICS[kind]) if (COSMETICS[kind][id].price > 0) all.push([kind, id]);
    const out = [];
    while (out.length < 3 && all.length) { h = (h * 1103515245 + 12345) >>> 0; out.push(all.splice(h % all.length, 1)[0]); }
    return out;
  };
  const onDeal = (kind, id) => SHOP.deals().some(([k, i]) => k === kind && i === id);
  SHOP.price = (kind, id) => { const p = COSMETICS[kind][id].price; return onDeal(kind, id) ? Math.round(p * 0.7 / 10) * 10 : p; };

  SHOP.buy = function (kind, id, then) {
    const it = COSMETICS[kind][id], price = SHOP.price(kind, id);
    if (SHOP.owns(kind, id)) return;
    if (SHOP.credits() < price) { UI.toast('Not enough credits: you need ' + (price - SHOP.credits()) + ' more. Play matches to earn them.', 'bad'); return; }
    UI.modal({ title: 'BUY ' + it.name.toUpperCase() + '?', body: [$('p', {}, it.name + ' · ' + RARITY[it.rarity].name + ' ' + kindName(kind)), $('p', {}, 'Costs ', $('b', {}, fmt(price) + ' credits'), '. You have ' + fmt(SHOP.credits()) + '.')],
      buttons: [['BUY', () => { S().credits -= price; S().owned[kind + ':' + id] = Date.now(); S().equip[kind] = id; Auth.save(); SFX.ping(); UI.toast(it.name + ' bought and equipped.', 'gold'); if (then) then(); }, 'big'], ['CANCEL', () => { }, 'ghost']] });
  };
  SHOP.equip = (kind, id) => { if (!SHOP.owns(kind, id)) return; S().equip[kind] = id; Auth.save(); SFX.ui(); };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const kindName = k => ({ finish: 'weapon finish', suit: 'uniform', reticle: 'reticle', card: 'player card' })[k];
  SHOP.fmt = fmt;

  /* ------------------------------------------------------------- the screen */
  SHOP.open = function (tab, sel) {
    if (!Auth.user) return MENU.title();
    tab = tab || 'featured';
    const page = $('div', { class: 'page shop' });
    const preview = $('div', { class: 'shop-prev' });
    const fav = Object.entries(S().stats.ops || {}).sort((a, b) => b[1] - a[1])[0];
    let op = (fav && OPS.find(o => o.id === fav[0])) || OPS[0];
    const draw = () => {
      page.innerHTML = '';
      page.append(UI.topbar('SHOP', () => MENU.home()));
      const tabs = $('div', { class: 'tabs shop-tabs' }, ...[['featured', 'FEATURED'], ...Object.entries(COS_KINDS)].map(([k, t]) => $('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sel = null; SFX.ui(); draw(); } }, t)),
        $('div', { class: 'grow' }), $('div', { class: 'credits big' }, $('i', {}, '◈'), fmt(SHOP.credits()), $('small', {}, ' CREDITS')));
      const grid = $('div', { class: 'shop-grid' });
      const items = tab === 'featured' ? SHOP.deals() : Object.keys(COSMETICS[tab]).map(id => [tab, id]);
      if (!sel) sel = items[0];
      for (const [kind, id] of items) grid.append(card(kind, id, sel && sel[0] === kind && sel[1] === id, () => { sel = [kind, id]; SFX.ui(); draw(); }));
      const left = $('div', { class: 'panel shop-left' }, tab === 'featured' ? $('div', { class: 'deal-head' }, $('h3', {}, "TODAY'S DEALS · 30% OFF"), $('p', { class: 'muted' }, 'Three new items every day. Earn credits by playing: every match pays, wins and kills pay more, Ranked pays 50% extra, and the first win of each day adds 250.')) : null, grid);
      page.append(tabs, $('div', { class: 'shop-body' }, left, detail(sel)));
    };
    function card(kind, id, on, pick) {
      const it = COSMETICS[kind][id], own = SHOP.owns(kind, id), eq = SHOP.equipped(kind) === id, deal = onDeal(kind, id);
      return $('button', { class: 'item rar-' + it.rarity + (on ? ' sel' : '') + (eq ? ' eq' : ''), onclick: pick },
        swatch(kind, id),
        $('b', {}, it.name), $('small', { style: { color: RARITY[it.rarity].color } }, RARITY[it.rarity].name + (tab === 'featured' ? ' · ' + kindName(kind).toUpperCase() : '')),
        $('span', { class: 'cost' }, eq ? 'EQUIPPED' : own ? 'OWNED' : deal ? [$('s', {}, fmt(it.price)), ' ◈ ' + fmt(SHOP.price(kind, id))] : '◈ ' + fmt(it.price)));
    }
    function swatch(kind, id) {
      const it = COSMETICS[kind][id], hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
      if (kind === 'finish') return $('div', { class: 'sw' }, ...['dark', 'poly', 'mid'].map(k => $('i', { style: { background: hex(it[k]) } })));
      if (kind === 'suit') return $('div', { class: 'sw' }, ...(it.cloth ? [it.cloth, it.vest, it.helmet || it.vest] : [0x4a5a3a, 0x3a4229, 0x2a2c30]).map(c => $('i', { style: { background: hex(c) } })));
      if (kind === 'reticle') return $('div', { class: 'sw ret', style: { '--xc': it.css } }, $('i'), $('i'), $('i'), $('i'));
      return $('div', { class: 'sw cardsw', style: { background: it.css } });
    }
    function detail(sel) {
      const [kind, id] = sel, it = COSMETICS[kind][id], own = SHOP.owns(kind, id), eq = SHOP.equipped(kind) === id;
      const box = $('div', { class: 'panel shop-detail' });
      box.append($('div', { class: 'sd-head' }, $('b', {}, it.name), $('span', { class: 'rar', style: { color: RARITY[it.rarity].color } }, RARITY[it.rarity].name + ' ' + kindName(kind).toUpperCase())));
      if (kind === 'finish' || kind === 'suit') {
        box.append(preview);
        box.append($('div', { class: 'lo-row' }, $('label', {}, 'PREVIEW ON'), ...OPS.filter((o, i) => i % 2 === 0 || o === op).slice(0, 8).map(o => $('button', { class: o === op ? 'on' : '', onclick: () => { op = o; SFX.ui(); draw(); } }, o.name))));
        const look = kind === 'finish' ? { finish: id, suit: SHOP.equipped('suit') } : { finish: SHOP.equipped('finish'), suit: id };
        requestAnimationFrame(() => MENU.preview(preview, op, op.primaries[0] === 'shield' ? op.secondaries[0] : op.primaries[0], look));
      } else if (kind === 'reticle') {
        box.append($('div', { class: 'ret-prev', style: { '--xc': it.css } }, $('div', { class: 'h-cross', style: { '--gap': '8px' } }, $('i', { class: 'c-t' }), $('i', { class: 'c-b' }), $('i', { class: 'c-l' }), $('i', { class: 'c-r' }), $('b', { class: 'c-d' }))));
      } else {
        box.append($('div', { class: 'pbanner', style: { background: it.css } }, UI.avatar(Auth.id, Auth.name, 'lg'), $('div', {}, $('b', {}, Auth.name), $('small', {}, UI.tagOf(Auth.id) + ' · LV ' + Auth.lv() + ' · ' + RANKED.tier(S().rank.rating).label))));
      }
      box.append($('p', { class: 'muted' }, kind === 'finish' ? 'Colours every gun you carry, in first person and on your operator.' : kind === 'suit' ? 'Recolours the uniform and vest of whichever operator you play. Everyone in the match sees it.' : kind === 'reticle' ? 'The colour of your crosshair.' : 'The banner behind your name on your profile, the home screen and the results.'));
      const price = SHOP.price(kind, id);
      box.append($('div', { class: 'actions' },
        eq ? UI.btn('EQUIPPED', () => { }, 'ghost') : own ? UI.btn('EQUIP', () => { SHOP.equip(kind, id); draw(); }, 'big') :
          UI.btn('BUY · ◈ ' + fmt(price), () => SHOP.buy(kind, id, draw), 'big' + (SHOP.credits() < price ? ' ghost' : ''))));
      return box;
    }
    UI.screen(page);
    draw();
  };

  window.SHOP = SHOP;
})();
