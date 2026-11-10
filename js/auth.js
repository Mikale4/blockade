/* ============================================================================
   auth.js -- accounts (kept in this browser) and each account's save, as in
   Wordle n' Friends.

   Accounts live in localStorage, so a password here is NOT a security boundary
   (anyone at this machine with devtools can read the save). Passwords are
   salted SHA-256 only so a reused one is never stored in the clear.

   Every account also gets an online identity, two key pairs made in the
   browser at sign-up (WebCrypto, P-256):
     a SIGNING key: everything you post online is signed with it, so nobody
       can post as you. Your player ID is a hash of its public half, and your
       TAG (the #A1B2 after your name) is the start of that ID.
     an ENCRYPTION key: messages and invites to you are encrypted to it.
   The private halves never leave this browser.

     Auth.list() register(u, pw, remember) login(u, pw, remember) resume()
     logout() save() remove(id) record(result)   Auth.user  Auth.S  Auth.id  Auth.tag
   ========================================================================== */
(function () {
  'use strict';
  const ACC = 'blockade.accounts', SES = 'blockade.session';
  const all = () => U.read(ACC, {}) || {};
  const norm = u => String(u || '').trim().toLowerCase();
  const subtle = window.crypto && crypto.subtle;
  function salt() { const b = new Uint8Array(16); crypto.getRandomValues(b); return U.hexb(b); }
  async function hash(pw, s) {
    const data = new TextEncoder().encode(s + '|' + pw);
    if (subtle) return U.hexb(await subtle.digest('SHA-256', data));
    let h = 0; for (const c of s + '|' + pw) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return 'weak:' + (h >>> 0).toString(16);
  }
  /* the player ID: the first 16 hex digits of SHA-256 over the signing key's public point */
  async function idOf(spk) { return U.hexb(await subtle.digest('SHA-256', new TextEncoder().encode(spk[0] + '.' + spk[1]))).slice(0, 16); }
  async function makeKeys() {
    const s = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const e = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const ex = k => subtle.exportKey('jwk', k);
    return { sPriv: await ex(s.privateKey), sPub: await ex(s.publicKey), ePriv: await ex(e.privateKey), ePub: await ex(e.publicKey) };
  }
  const PREFS = { autoOnline: true, dmFrom: 'everyone', filter: false, mute: [] };
  function freshSave() {
    return {
      xp: 0,
      stats: { matches: 0, wins: 0, losses: 0, rounds: 0, roundsWon: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, online: 0, onlineWins: 0, ops: {} },
      rank: { rating: 1000, games: 0, wins: 0, losses: 0, peak: 1000 },
      friends: {}, reqIn: {}, reqOut: {}, blocked: {}, convos: {}, seen: [],
      prefs: Object.assign({}, PREFS), created: Date.now(),
    };
  }
  function upgrade(a) {
    const f = freshSave(); for (const k in f) if (a.save[k] == null) a.save[k] = f[k];
    a.save.stats = Object.assign({}, f.stats, a.save.stats);
    a.save.prefs = Object.assign({}, PREFS, a.save.prefs);
    return a;
  }
  /* level from xp: each level needs a little more */
  function level(xp) {
    let lv = 1, need = 500, left = xp || 0;
    while (left >= need) { left -= need; lv++; need = 500 + (lv - 1) * 120; }
    return { lv, into: left, need };
  }

  const Auth = window.Auth = {
    user: null, ready: !!subtle,
    get S() { return Auth.user && Auth.user.save; },
    get id() { return Auth.user && Auth.user.id; },
    get tag() { return Auth.user ? Auth.user.id.slice(0, 4).toUpperCase() : ''; },
    get name() { return Auth.user ? Auth.user.user : ''; },
    get prefs() { return Auth.S ? Auth.S.prefs : PREFS; },
    idOf, level,
    lv() { return Auth.S ? level(Auth.S.xp).lv : 1; },
    list() { return Object.values(all()).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)).map(a => ({ id: a.id, user: a.user, lastLogin: a.lastLogin, lv: level(a.save ? a.save.xp : 0).lv })); },
    checkName(u) {
      u = String(u || '').trim();
      if (u.length < 3) return 'Name needs at least 3 characters.';
      if (u.length > 16) return 'Name can be at most 16 characters.';
      if (!/^[a-zA-Z0-9_-]+$/.test(u)) return 'Letters, numbers, - and _ only (no spaces).';
      if (Object.values(all()).some(a => norm(a.user) === norm(u))) return 'That name is already an account on this device.';
      return null;
    },
    async register(user, pw, remember) {
      if (!subtle) return { err: 'This browser can\'t make accounts here: it needs a secure page (https, or http://localhost). Use "Play BLOCKADE.bat" or the local server.' };
      const e = Auth.checkName(user) || (String(pw || '').length < 4 ? 'Password needs at least 4 characters.' : null);
      if (e) return { err: e };
      const keys = await makeKeys(), id = await idOf([keys.sPub.x, keys.sPub.y]), s = salt();
      const a = { id, user: String(user).trim(), salt: s, hash: await hash(pw, s), keys, created: Date.now(), lastLogin: Date.now(), save: freshSave() };
      const A = all(); A[id] = a; U.write(ACC, A);
      Auth.user = a; U.write(SES, remember ? id : null); Auth.emit('login');
      return { ok: true, fresh: true };
    },
    async login(user, pw, remember) {
      const a = Object.values(all()).find(x => norm(x.user) === norm(user));
      if (!a) return { err: 'No player by that name on this device. (Accounts live in the browser they were made in.)' };
      if (await hash(pw, a.salt) !== a.hash) return { err: 'Wrong password.' };
      a.lastLogin = Date.now(); Auth.user = upgrade(a); Auth.save(); U.write(SES, remember ? a.id : null); Auth.emit('login');
      return { ok: true };
    },
    resume() { const id = U.read(SES, null); const a = id && all()[id]; if (a) { Auth.user = upgrade(a); a.lastLogin = Date.now(); Auth.save(); Auth.emit('login'); return true; } return false; },
    logout() { if (window.Online) Online.leave(true); if (window.Net) Net.stop(); Auth.user = null; Auth._k = null; U.write(SES, null); Auth.emit('logout'); },
    remove(id) { const A = all(); delete A[id]; U.write(ACC, A); },
    save() { if (!Auth.user) return; const A = all(); A[Auth.user.id] = Auth.user; U.write(ACC, A); },
    async changePassword(oldPw, newPw) {
      const a = Auth.user; if (await hash(oldPw, a.salt) !== a.hash) return { err: 'Your current password is wrong.' };
      if (String(newPw || '').length < 4) return { err: 'Password needs at least 4 characters.' };
      a.salt = salt(); a.hash = await hash(newPw, a.salt); Auth.save(); return { ok: true };
    },
    async keys() {
      if (Auth._k && Auth._k.id === Auth.id) return Auth._k;
      const K = Auth.user.keys, imp = (j, alg, use) => subtle.importKey('jwk', j, alg, false, use);
      Auth._k = {
        id: Auth.id,
        sign: await imp(K.sPriv, { name: 'ECDSA', namedCurve: 'P-256' }, ['sign']),
        ecdh: await imp(K.ePriv, { name: 'ECDH', namedCurve: 'P-256' }, ['deriveKey']),
        spk: [K.sPub.x, K.sPub.y], epk: [K.ePub.x, K.ePub.y],
      };
      return Auth._k;
    },
    /* a finished match: { won, rounds, roundsWon, k, d, a, hs, op, online, ranked } */
    record(r) {
      const S = Auth.S; if (!S) return null;
      const st = S.stats, before = level(S.xp).lv;
      st.matches++; if (r.won) st.wins++; else st.losses++;
      st.rounds += r.rounds || 0; st.roundsWon += r.roundsWon || 0;
      st.kills += r.k || 0; st.deaths += r.d || 0; st.assists += r.a || 0; st.headshots += r.hs || 0;
      if (r.op) st.ops[r.op] = (st.ops[r.op] || 0) + 1;
      let xp = 150 + (r.won ? 250 : 0) + (r.roundsWon || 0) * 60 + (r.k || 0) * 40 + (r.a || 0) * 15;
      if (r.online) { st.online++; if (r.won) st.onlineWins++; xp = Math.round(xp * 1.5); }
      S.xp += xp;
      if (r.online) {
        const R = S.rank; R.games++;
        const delta = r.won ? 24 : -18; R.rating = Math.max(100, R.rating + delta); if (r.won) R.wins++; else R.losses++;
        R.peak = Math.max(R.peak, R.rating); r.delta = delta;
      }
      Auth.save();
      if (window.Net) Net.profile();
      return { xp, lv: level(S.xp).lv, up: level(S.xp).lv > before, delta: r.delta };
    },
  };
  Object.assign(Auth, U.hub());   // on / emit (mixed in after: Object.assign would call the getters above)
})();
