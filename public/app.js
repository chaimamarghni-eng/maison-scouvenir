/* Maison SCouvenir — interface de gestion des commandes */
(() => {
  'use strict';
  const DEMO = !!window.SC_DEMO;

  /* ================= Outils ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => localDate(new Date());
  const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return localDate(d); };
  const toMil = (v) => { const n = parseFloat(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0; };
  const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const nf3 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const money = (m) => (m < 0 ? '−' : '') + (Math.abs(m) % 1000 === 0 ? nf0.format(Math.abs(m) / 1000) : nf3.format(Math.abs(m) / 1000)) + ' DT';
  const milToInput = (m) => (m ? (m % 1000 === 0 ? String(m / 1000) : (m / 1000).toFixed(3).replace('.', ',')) : '');
  const fmtDate = (s, o = { day: 'numeric', month: 'long', year: 'numeric' }) => (s ? parseD(s).toLocaleDateString('fr-FR', o) : '—');
  const shortDate = (s) => fmtDate(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const frDate = (s) => (s ? s.split('-').reverse().join('/') : '');
  const ref = (o) => (o.id ? 'SC-' + String(o.id).padStart(4, '0') : 'En attente d\u2019envoi');

  const STATUS = {
    nouvelle: 'Nouvelle commande', preparation: 'En préparation', prete: 'Prête', livree: 'Livrée', annulee: 'Annulée',
  };
  const STATUS_SHORT = { nouvelle: 'Nouvelle', preparation: 'En préparation', prete: 'Prête', livree: 'Livrée', annulee: 'Annulée' };
  const EVENTS = { mariage: 'Mariage', fiancailles: 'Fiançailles', naissance: 'Naissance', anniversaire: 'Anniversaire', autre: 'Autre' };
  const ACTIVE = ['nouvelle', 'preparation', 'prete'];

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    wallet: '<path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6"/><path d="M16 14h.01"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    upload: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    hourglass: '<path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  function calc(o) {
    const total = o.quantity * o.unit_price;
    let paid = 0, advance = 0;
    for (const p of o.payments || []) { paid += p.amount; if (p.is_advance) advance += p.amount; }
    return { total, paid, advance, remaining: total - paid };
  }
  const isLate = (o) => o.delivery_date && o.delivery_date < today() && ACTIVE.includes(o.status);

  /* ================= Données de démonstration ================= */
  function demoOrders() {
    const d = (n) => addDays(today(), n);
    return [
      ['Amira Ben Salah', '22 456 789', 'mariage', 'Boîtes à dragées en velours', 'Prénoms « Amira & Youssef », date du mariage, couleur vieux rose, ruban satin ivoire.', 120, 4500, -12, 4, 'preparation', [[200000, -12, 1, 'Avance']]],
      ['Nour Trabelsi', '55 321 654', 'fiancailles', 'Plateau de fiançailles personnalisé', 'Plateau miroir doré, initiales N & K, fleurs séchées beiges.', 1, 185000, -8, 2, 'prete', [[80000, -8, 1, 'Avance'], [50000, -3, 0, 'Deuxième versement']]],
      ['Salma Gharbi', '98 112 233', 'naissance', 'Sachets de dragées naissance', 'Prénom « Lina », thème nuage, couleurs beige et blanc.', 60, 3000, -3, 9, 'nouvelle', [[50000, -3, 1, 'Avance']]],
      ['Rania Jaziri', '20 987 654', 'anniversaire', 'Bougies parfumées gravées', 'Gravure « Rania 30 ans », pots en verre ambré.', 25, 12000, -20, -6, 'livree', [[100000, -20, 1, 'Avance'], [200000, -6, 0, 'Solde à la livraison']]],
      ['Ines Mansouri', '52 741 852', 'mariage', 'Cadres photo pour témoins', 'Bois clair, gravure des prénoms et de la date.', 6, 35000, -1, 15, 'nouvelle', []],
      ['Yasmine Chaabane', '29 654 123', 'autre', 'Coffrets cadeaux entreprise', 'Logo doré sur couvercle, carte de remerciement.', 40, 25000, -15, -2, 'annulee', []],
    ].map(([client_name, phone, event_type, product, description, quantity, unit_price, od, dd, status, pays]) => ({
      client_name, phone, event_type, product, description, quantity, unit_price, order_date: d(od), delivery_date: d(dd), status,
      payments: pays.map(([amount, pd, is_advance, note]) => ({ amount, date: d(pd), is_advance, note })),
    }));
  }

  /* ================= Accès aux données ================= */
  const fail = (m) => { throw new Error(m); };
  const newUid = () => 'u' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const cleanOrder = (b, base = {}) => {
    const o = { ...base, ...b };
    if (!String(o.client_name || '').trim()) fail('Le nom de la cliente est obligatoire.');
    return {
      client_name: String(o.client_name).trim(), phone: String(o.phone || '').trim(), event_type: EVENTS[o.event_type] ? o.event_type : 'autre',
      product: String(o.product || '').trim(), description: String(o.description || '').trim(),
      quantity: Math.max(1, Math.round(Number(o.quantity) || 1)), unit_price: Math.max(0, Math.round(Number(o.unit_price) || 0)),
      order_date: o.order_date || today(), delivery_date: o.delivery_date || '', status: STATUS[o.status] ? o.status : 'nouvelle',
    };
  };
  // Application installée : serveur + copie locale pour travailler sans connexion.
  // Chaque modification est appliquée tout de suite sur l'appareil, mise en file d'attente,
  // puis envoyée au serveur dès que la connexion le permet.
  const Server = (() => {
    const CK = 'maison-scouvenir-copie-v1', QK = 'maison-scouvenir-attente-v1';
    const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué */ } };
    let cache = read(CK, { user: null, orders: [] });
    let queue = read(QK, []);
    const saveCache = () => write(CK, cache);
    const saveQueue = () => write(QK, queue);
    class OfflineError extends Error {}
    const NEED_NET = 'Cette action demande une connexion internet. Réessayez une fois connectée.';

    async function req(method, url, body) {
      let r;
      try {
        r = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store',
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: body !== undefined ? JSON.stringify(body) : undefined });
      } catch { throw new OfflineError('Pas de connexion internet.'); }
      if ([502, 503, 504].includes(r.status)) throw new OfflineError('Serveur momentanément indisponible.');
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(data.error || 'Une erreur est survenue. Réessayez.'); e.status = r.status; throw e; }
      return data;
    }
    const online = (fn) => async (...args) => {
      try { return await fn(...args); } catch (e) { if (e instanceof OfflineError) throw new Error(NEED_NET); throw e; }
    };
    function needLogin() { state.user = null; renderAuth(false); }

    let running = null;
    async function flush() {
      if (running) return running;
      running = (async () => {
        while (queue.length) {
          const op = queue[0];
          try { await req(op.method, op.url, op.body); } catch (e) {
            if (e instanceof OfflineError) return false;
            if (e.status === 401) { needLogin(); return false; }
            console.warn('Modification refusée par le serveur :', op, e.message); // ex. commande supprimée entre-temps
          }
          queue.shift(); saveQueue();
        }
        return true;
      })();
      try { return await running; } finally { running = null; updateNet(); }
    }
    async function mutate(method, url, body, apply) {
      apply(); saveCache();
      queue.push({ method, url, body }); saveQueue();
      updateNet();
      await flush();
      return {};
    }
    const findC = (uid) => cache.orders.find((o) => o.uid === uid) || fail('Commande introuvable.');

    return {
      pending: () => queue.length,
      flush,
      async me() {
        try {
          const r = await req('GET', '/api/me');
          if (r.user) { cache.user = r.user; saveCache(); }
          return r;
        } catch (e) {
          if (!(e instanceof OfflineError)) throw e;
          if (cache.user) return { user: cache.user, setupNeeded: false, offline: true };
          throw new Error("Pas de connexion internet. La première connexion sur cet appareil demande internet. Ensuite, l'application fonctionnera aussi hors ligne.");
        }
      },
      setup: online((b) => req('POST', '/api/setup', b)),
      login: online((b) => req('POST', '/api/login', b)),
      async logout() {
        if (!(await flush())) fail("Des modifications n'ont pas encore été envoyées. Connectez-vous à internet avant de vous déconnecter.");
        await online(() => req('POST', '/api/logout', {}))();
        cache = { user: null, orders: [] }; saveCache(); // rien ne reste sur l'appareil
        return { ok: true };
      },
      async listOrders() {
        if (await flush()) {
          try { cache.orders = await req('GET', '/api/orders'); saveCache(); } catch (e) {
            if (e.status === 401) { needLogin(); throw e; }
            if (!(e instanceof OfflineError)) throw e;
          }
        }
        return JSON.parse(JSON.stringify(cache.orders));
      },
      async createOrder(b) {
        const uid = newUid(), advance_uid = newUid();
        const o = { id: null, uid, ...cleanOrder(b), is_demo: 0, payments: [] };
        if (b.advance > 0) o.payments.push({ id: null, uid: advance_uid, amount: b.advance, date: o.order_date, note: 'Avance', is_advance: 1 });
        await mutate('POST', '/api/orders', { ...b, uid, advance_uid }, () => cache.orders.unshift(o));
        return { uid };
      },
      updateOrder: (uid, b) => mutate('PUT', `/api/orders/${uid}`, b, () => { const o = findC(uid); Object.assign(o, cleanOrder(b, o)); }),
      setStatus: (uid, status) => mutate('PATCH', `/api/orders/${uid}`, { status }, () => { findC(uid).status = status; }),
      deleteOrder: (uid) => mutate('DELETE', `/api/orders/${uid}`, undefined, () => { cache.orders = cache.orders.filter((o) => o.uid !== uid); }),
      addPayment(uid, b) {
        if (!(b.amount > 0)) fail('Indiquez un montant supérieur à 0.');
        const p = { id: null, uid: newUid(), amount: b.amount, date: b.date || today(), note: b.note || '', is_advance: b.is_advance ? 1 : 0 };
        return mutate('POST', `/api/orders/${uid}/payments`, p, () => findC(uid).payments.push(p));
      },
      deletePayment: (puid) => mutate('DELETE', `/api/payments/${puid}`, undefined, () => { for (const o of cache.orders) o.payments = o.payments.filter((p) => p.uid !== puid); }),
      deleteDemo: online(async () => { if (!(await flush())) fail(NEED_NET); return req('DELETE', '/api/demo'); }),
      updateAccount: online((b) => req('POST', '/api/account', b)),
      listUsers: online(() => req('GET', '/api/users')),
      addUser: online((b) => req('POST', '/api/users', b)),
      removeUser: online((id) => req('DELETE', `/api/users/${id}`)),
      backupsInfo: online(() => req('GET', '/api/backups')),
      backupNow: online(() => req('POST', '/api/backups', {})),
      async exportAll() {
        if (await flush()) { try { return await req('GET', '/api/export'); } catch (e) { if (!(e instanceof OfflineError)) throw e; } }
        return { app: 'maison-scouvenir', version: 1, exported_at: new Date().toISOString(), orders: JSON.parse(JSON.stringify(cache.orders)) };
      },
      restore: online(async (b) => { if (!(await flush())) fail(NEED_NET); return req('POST', '/api/restore', b); }),
    };
  })();

  // Aperçu : les données restent dans ce navigateur.
  const Local = (() => {
    const KEY = 'maison-scouvenir-apercu-v2';
    let mem = null;
    const load = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
      if (!mem) mem = { user: null, logged: false, seq: 1, pseq: 1, orders: [] };
      return mem;
    };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* stockage indisponible */ } };
    const hash = async (s) => {
      try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); } catch { return 'x' + s; }
    };
    const find = (uid) => load().orders.find((o) => o.uid === uid) || fail('Commande introuvable.');
    const insert = (b, isDemo, pays) => {
      const s = load();
      const o = { id: s.seq++, uid: b.uid || newUid(), ...cleanOrder(b), is_demo: isDemo ? 1 : 0, payments: [] };
      for (const p of pays || []) if (p.amount > 0) o.payments.push({ id: s.pseq++, uid: p.uid || newUid(), order_id: o.id, amount: p.amount, date: p.date || today(), note: p.note || '', is_advance: p.is_advance ? 1 : 0 });
      s.orders.push(o); return o;
    };
    return {
      async me() { const s = load(); return { setupNeeded: !s.user, user: s.user && s.logged ? { username: s.user.username, display_name: s.user.display_name } : null }; },
      async setup(b) {
        const s = load(); if (s.user) fail('Le compte existe déjà.');
        if (String(b.username || '').trim().length < 3) fail("L'identifiant doit contenir au moins 3 caractères.");
        if (String(b.password || '').length < 8) fail('Le mot de passe doit contenir au moins 8 caractères.');
        s.user = { username: b.username.trim().toLowerCase(), display_name: b.display_name || '', hash: await hash(b.password) };
        s.logged = true; if (!s.orders.length) demoOrders().forEach((o) => insert(o, 1, o.payments)); save(); return { ok: true };
      },
      async login(b) {
        const s = load();
        const u = String(b.username || '').trim().toLowerCase(), h = await hash(b.password || '');
        const ok = s.user && ((s.user.username === u && s.user.hash === h) || (s.extra || []).some((x) => x.username === u && x.hash === h));
        if (!ok) fail('Identifiant ou mot de passe incorrect.');
        s.logged = true; save(); return { ok: true };
      },
      async logout() { load().logged = false; save(); return { ok: true }; },
      async listOrders() { return JSON.parse(JSON.stringify([...load().orders].sort((a, b) => b.id - a.id))); },
      async createOrder(b) { const o = insert(b, 0, b.advance ? [{ amount: b.advance, date: b.order_date, is_advance: 1, note: 'Avance' }] : []); save(); return { id: o.id, uid: o.uid }; },
      async updateOrder(id, b) { const o = find(id); Object.assign(o, cleanOrder(b, o)); save(); return { ok: true }; },
      async setStatus(id, status) { find(id).status = status; save(); return { ok: true }; },
      async deleteOrder(id) { const s = load(); s.orders = s.orders.filter((o) => o.uid !== id); save(); return { ok: true }; },
      async addPayment(id, b) { if (!(b.amount > 0)) fail('Indiquez un montant supérieur à 0.'); const s = load(); find(id).payments.push({ id: s.pseq++, uid: newUid(), order_id: find(id).id, amount: b.amount, date: b.date || today(), note: b.note || '', is_advance: b.is_advance ? 1 : 0 }); save(); return { ok: true }; },
      async deletePayment(pid) { for (const o of load().orders) o.payments = o.payments.filter((p) => p.uid !== pid); save(); return { ok: true }; },
      async deleteDemo() { const s = load(); const n = s.orders.length; s.orders = s.orders.filter((o) => !o.is_demo); save(); return { deleted: n - s.orders.length }; },
      async updateAccount(b) {
        const s = load(); if (s.user.hash !== await hash(b.current_password || '')) fail('Le mot de passe actuel est incorrect.');
        if (b.new_password && b.new_password.length < 8) fail('Le nouveau mot de passe doit contenir au moins 8 caractères.');
        s.user.username = (b.username || s.user.username).trim().toLowerCase(); s.user.display_name = b.display_name ?? s.user.display_name;
        if (b.new_password) s.user.hash = await hash(b.new_password); save(); return { ok: true };
      },
      async listUsers() { const s = load(); return [{ id: 0, username: s.user.username, display_name: s.user.display_name, me: true }, ...(s.extra || []).map((u, i) => ({ id: i + 1, username: u.username, display_name: u.display_name, me: false }))]; },
      async addUser(b) {
        const s = load(); s.extra = s.extra || []; const u = String(b.username || '').trim().toLowerCase();
        if (u.length < 3) fail("L'identifiant doit contenir au moins 3 caractères."); if (String(b.password || '').length < 8) fail('Le mot de passe doit contenir au moins 8 caractères.');
        if (u === s.user.username || s.extra.some((x) => x.username === u)) fail('Cet identifiant est déjà utilisé.');
        s.extra.push({ username: u, display_name: b.display_name || '', hash: await hash(b.password) }); save(); return { ok: true };
      },
      async removeUser(id) { const s = load(); s.extra = (s.extra || []).filter((_, i) => i + 1 !== Number(id)); save(); return { ok: true }; },
      async backupsInfo() { return { count: 0, last: null }; },
      async backupNow() { return { ok: true }; },
      async exportAll() { return { app: 'maison-scouvenir', version: 1, exported_at: new Date().toISOString(), orders: await this.listOrders() }; },
      async restore(b) {
        if (b.app !== 'maison-scouvenir' || !Array.isArray(b.orders)) fail("Ce fichier n'est pas une sauvegarde Maison SCouvenir.");
        const s = load(); s.orders = []; [...b.orders].reverse().forEach((o) => insert(o, o.is_demo, o.payments)); save(); return { restored: b.orders.length };
      },
    };
  })();

  const store = DEMO ? Local : Server;

  /* ================= État & navigation ================= */
  const state = {
    user: null, orders: [], loaded: false,
    filters: { q: '', status: 'all', period: 'all', month: '', sort: 'delivery' },
  };
  const NAV = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'commandes', label: 'Commandes', icon: 'gift' },
    { id: 'nouvelle', label: 'Nouvelle commande', short: 'Nouvelle', icon: 'plus', plus: true },
    { id: 'finances', label: 'Finances', icon: 'wallet' },
    { id: 'parametres', label: 'Paramètres', icon: 'settings' },
  ];
  const root = $('#root');
  const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };
  const route = () => { const h = (location.hash || '').slice(1) || 'accueil'; const m = /^(commande|modifier)-([A-Za-z0-9-]+)$/.exec(h); return m ? { name: m[1], id: m[2] } : { name: h }; };

  function toast(msg) {
    $('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
  }
  function confirmBox(title, text, okLabel = 'Supprimer', danger = true) {
    return new Promise((resolve) => {
      const w = document.createElement('div');
      w.className = 'dialog-wrap';
      w.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
        <h2 id="dlg-t">${esc(title)}</h2><p class="muted" style="margin:0">${esc(text)}</p>
        <div class="actions"><button class="btn" id="dlg-no">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" id="dlg-ok">${esc(okLabel)}</button></div></div>`;
      const done = (v) => { w.remove(); resolve(v); };
      w.addEventListener('click', (e) => { if (e.target === w) done(false); });
      document.body.appendChild(w);
      $('#dlg-no', w).onclick = () => done(false);
      $('#dlg-ok', w).onclick = () => done(true);
      $('#dlg-ok', w).focus();
    });
  }
  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { toast(e.message); return undefined; } finally { if (btn) btn.disabled = false; }
  }
  async function reload() { state.orders = await store.listOrders(); state.loaded = true; updateNet(); }
  function updateNet() {
    const n = store.pending ? store.pending() : 0;
    const off = !navigator.onLine;
    const text = n ? `${off ? 'Hors ligne · ' : ''}${n} modification${n > 1 ? 's' : ''} en attente d'envoi` : (off ? 'Hors ligne · tout est enregistré sur cet appareil' : '');
    $$('.net').forEach((el) => { el.textContent = text; el.hidden = !text; });
  }
  async function syncNow() {
    if (!store.flush || !state.user) return;
    const had = store.pending();
    if (!(await store.flush())) return;
    try { await reload(); } catch { return; }
    const r = route().name;
    if (had && r !== 'nouvelle' && r !== 'modifier') { render(); toast('Modifications synchronisées'); }
  }

  /* ================= Connexion ================= */
  function renderAuth(setup) {
    root.innerHTML = `<div class="auth"><form class="auth-card" id="auth-form" novalidate>
      <header><div class="monogram">MS</div><h1>Maison SCouvenir</h1><div class="eyebrow">Gestion des commandes</div></header>
      ${setup ? `<p class="muted" style="margin:0;text-align:center">Bienvenue ! Créez votre accès personnel. Il vous sera demandé à chaque connexion.</p>
        <div class="field"><label for="a-name">Votre prénom</label><input type="text" id="a-name" autocomplete="given-name" placeholder="Ex. Sarra"></div>` : ''}
      <div class="field"><label for="a-user">Identifiant</label><input type="text" id="a-user" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label for="a-pass">Mot de passe</label><input type="password" id="a-pass" autocomplete="${setup ? 'new-password' : 'current-password'}" required>
        ${setup ? '<span class="hint">8 caractères minimum.</span>' : ''}</div>
      ${setup ? '<div class="field"><label for="a-pass2">Confirmer le mot de passe</label><input type="password" id="a-pass2" autocomplete="new-password" required></div>' : ''}
      <p class="error" id="a-err" hidden></p>
      <button class="btn primary block" id="a-go" type="submit">${setup ? 'Créer mon accès' : 'Se connecter'}</button>
      ${DEMO ? '<p class="demo-note">Aperçu de démonstration : les données restent dans ce navigateur. Créez un accès de test pour découvrir l\'application.</p>' : ''}
    </form></div>`;
    $('#a-user').focus();
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#a-err'); err.hidden = true;
      const b = { username: $('#a-user').value, password: $('#a-pass').value };
      if (setup) {
        b.display_name = $('#a-name').value.trim();
        if (b.password !== $('#a-pass2').value) { err.textContent = 'Les deux mots de passe ne sont pas identiques.'; err.hidden = false; return; }
      }
      const btn = $('#a-go'); btn.disabled = true;
      try {
        await (setup ? store.setup(b) : store.login(b));
        await boot();
      } catch (x) { err.textContent = x.message; err.hidden = false; } finally { btn.disabled = false; }
    });
  }

  /* ================= Coque ================= */
  function renderShell() {
    const navLinks = (cls) => NAV.map((n) => `<a href="#${n.id}" data-nav="${n.id}" class="${cls}${n.plus ? ' plus' : ''}">${n.plus && cls === '' ? `<span class="round">${icon('plus')}</span>` : icon(n.icon)}<span>${esc(cls === '' ? (n.short || n.label) : n.label)}</span></a>`).join('');
    root.innerHTML = `<div class="shell">
      <aside class="sidebar"><a class="brand" href="#accueil"><div class="monogram sm">MS</div><div><b>Maison SCouvenir</b><small>Commandes</small></div></a>
        ${navLinks('nav')}<div class="side-foot"><span class="net" role="status" hidden></span>${DEMO ? 'Aperçu de démonstration' : `Connectée : ${esc(state.user.display_name || state.user.username)}`}</div></aside>
      <div style="min-width:0"><header class="topbar"><a class="brand" href="#accueil"><div class="monogram sm">MS</div><div><b>Maison SCouvenir</b></div></a><span class="net" role="status" hidden></span></header>
        <main id="view"></main></div>
      <nav class="tabbar" aria-label="Navigation">${navLinks('')}</nav>
    </div>`;
  }
  function render() {
    if (!state.user) return;
    if (!$('#view')) renderShell();
    const r = route();
    const active = { commande: 'commandes', modifier: 'commandes' }[r.name] || r.name;
    $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === active));
    const view = $('#view');
    const views = { accueil: viewHome, commandes: viewOrders, nouvelle: () => viewForm(null), commande: () => viewDetail(r.id), modifier: () => viewForm(r.id), finances: viewFinances, parametres: viewSettings };
    (views[r.name] || viewHome)(view);
    window.scrollTo(0, 0);
    updateNet();
  }

  /* ================= Accueil ================= */
  function totals() {
    const live = state.orders.filter((o) => o.status !== 'annulee');
    const t = { count: live.length, cancelled: state.orders.length - live.length, active: 0, delivered: 0, total: 0, paid: 0, advance: 0, due: 0, overpaid: 0 };
    for (const o of live) {
      const c = calc(o);
      if (ACTIVE.includes(o.status)) t.active++;
      if (o.status === 'livree') t.delivered++;
      t.total += c.total; t.paid += c.paid; t.advance += c.advance;
      if (c.remaining > 0) t.due += c.remaining;
    }
    return t;
  }
  const stat = (lbl, ic, val, sub = '', cls = '') => `<div class="stat ${cls}"><div class="lbl">${icon(ic)}${esc(lbl)}</div><div class="val">${val}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;

  function upcomingRow(o) {
    const c = calc(o);
    const late = isLate(o);
    return `<a class="row" href="#commande-${o.uid}">
      <div style="min-width:0"><div class="who">${esc(o.client_name)}</div><div class="what">${esc(o.product || EVENTS[o.event_type])}${o.quantity > 1 ? ` · ${o.quantity} pièces` : ''}</div></div>
      <div class="right"><span class="pill ${late ? 'tag-late' : 'st-' + o.status}">${late ? 'En retard' : esc(STATUS_SHORT[o.status])}</span>
        <span class="muted num" style="font-size:.9rem">${esc(shortDate(o.delivery_date))}${c.remaining > 0 ? ` · reste ${money(c.remaining)}` : ''}</span></div></a>`;
  }

  function viewHome(v) {
    const t = totals();
    const hour = new Date().getHours();
    const hello = (hour < 18 ? 'Bonjour' : 'Bonsoir') + (state.user.display_name ? ' ' + state.user.display_name : '');
    const upcoming = state.orders.filter((o) => ACTIVE.includes(o.status) && o.delivery_date).sort((a, b) => a.delivery_date.localeCompare(b.delivery_date)).slice(0, 6);
    const demoCount = state.orders.filter((o) => o.is_demo).length;
    v.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">${esc(fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h1>${esc(hello)}</h1></div>
        <a class="btn primary" href="#nouvelle">${icon('plus')}Nouvelle commande</a></div>
      ${demoCount ? `<div class="banner"><span>${demoCount} commande${demoCount > 1 ? 's' : ''} d'exemple ${demoCount > 1 ? 'sont affichées' : 'est affichée'} pour découvrir l'application.</span><button class="btn small" id="del-demo">${icon('trash')}Supprimer les exemples</button></div>` : ''}
      <section class="stats six" aria-label="Résumé de l'activité">
        ${stat('Commandes', 'gift', nf0.format(t.count), t.cancelled ? `sans compter ${t.cancelled} annulée${t.cancelled > 1 ? 's' : ''}` : 'au total')}
        ${stat('En cours', 'clock', nf0.format(t.active), 'à préparer ou à livrer')}
        ${stat('Livrées', 'check', nf0.format(t.delivered), 'commandes terminées')}
        ${stat('Montant total', 'receipt', money(t.total), 'de toutes les commandes')}
        ${stat('Déjà encaissé', 'coins', money(t.paid), 'avances et paiements')}
        ${stat('Reste à encaisser', 'hourglass', money(t.due), 'à recevoir des clientes', 'accent')}
      </section>
      <section class="panel"><header><h2>Prochaines livraisons</h2><a class="btn ghost small" href="#commandes">Toutes les commandes</a></header>
        ${upcoming.length ? `<div class="rows">${upcoming.map(upcomingRow).join('')}</div>` : `<div class="empty">${icon('truck')}<span>Aucune livraison prévue pour le moment.</span></div>`}
      </section>`;
    $('#del-demo')?.addEventListener('click', deleteDemo);
  }
  async function deleteDemo(e) {
    if (!(await confirmBox('Supprimer les exemples ?', "Les commandes d'exemple seront effacées. Vos propres commandes ne sont pas touchées."))) return;
    await busy(e?.currentTarget, async () => { const r = await store.deleteDemo(); await reload(); toast(`${r.deleted} exemple${r.deleted > 1 ? 's' : ''} supprimé${r.deleted > 1 ? 's' : ''}`); render(); });
  }

  /* ================= Commandes ================= */
  function viewOrders(v) {
    const f = state.filters;
    const counts = { all: state.orders.length };
    for (const o of state.orders) counts[o.status] = (counts[o.status] || 0) + 1;
    v.innerHTML = `
      <div class="page-head"><div><h1>Commandes</h1><p class="muted">${state.orders.length} commande${state.orders.length > 1 ? 's' : ''} enregistrée${state.orders.length > 1 ? 's' : ''}</p></div>
        <a class="btn primary" href="#nouvelle">${icon('plus')}Nouvelle commande</a></div>
      <div class="toolbar">
        <div class="search">${icon('search')}<input type="search" id="f-q" placeholder="Rechercher un nom, un téléphone ou un numéro" value="${esc(f.q)}" aria-label="Rechercher"></div>
        <div class="chips" role="group" aria-label="Statut">
          ${[['all', 'Toutes'], ...Object.entries(STATUS_SHORT)].map(([k, l]) => `<button class="chip ${f.status === k ? 'on' : ''}" data-st="${k}">${esc(l)}<small>${counts[k] || 0}</small></button>`).join('')}
        </div>
        <div class="filter-row">
          <select id="f-period" aria-label="Date de livraison">
            <option value="all">Toutes les dates de livraison</option><option value="late">En retard</option><option value="today">Livraison aujourd'hui</option>
            <option value="week">Livraison dans les 7 jours</option><option value="month">Livraison ce mois-ci</option><option value="pick">Choisir un mois…</option>
          </select>
          <input type="month" id="f-month" value="${esc(f.month)}" aria-label="Mois de livraison" ${f.period === 'pick' ? '' : 'hidden'}>
          <select id="f-sort" aria-label="Trier">
            <option value="delivery">Trier par date de livraison</option><option value="recent">Les plus récentes d'abord</option><option value="name">Trier par nom</option><option value="due">Le plus gros reste à payer</option>
          </select>
        </div>
      </div>
      <div id="list"></div>`;
    $('#f-period').value = f.period; $('#f-sort').value = f.sort;
    $('#f-q').addEventListener('input', (e) => { f.q = e.target.value; drawList(); });
    $$('[data-st]').forEach((b) => b.addEventListener('click', () => { f.status = b.dataset.st; $$('[data-st]').forEach((x) => x.classList.toggle('on', x === b)); drawList(); }));
    $('#f-period').addEventListener('change', (e) => { f.period = e.target.value; $('#f-month').hidden = f.period !== 'pick'; if (f.period === 'pick' && !f.month) { f.month = today().slice(0, 7); $('#f-month').value = f.month; } drawList(); });
    $('#f-month').addEventListener('change', (e) => { f.month = e.target.value; drawList(); });
    $('#f-sort').addEventListener('change', (e) => { f.sort = e.target.value; drawList(); });
    drawList();
  }
  function filtered() {
    const f = state.filters, t = today();
    const q = f.q.trim().toLowerCase(), qDigits = q.replace(/\D/g, '');
    let list = state.orders.filter((o) => {
      if (f.status !== 'all' && o.status !== f.status) return false;
      if (q) {
        const hit = o.client_name.toLowerCase().includes(q) || ref(o).toLowerCase().includes(q) || (o.product || '').toLowerCase().includes(q)
          || (qDigits.length >= 2 && (o.phone.replace(/\D/g, '').includes(qDigits) || (o.id && String(o.id) === qDigits.replace(/^0+/, ''))));
        if (!hit) return false;
      }
      const d = o.delivery_date;
      switch (f.period) {
        case 'late': return isLate(o);
        case 'today': return d === t;
        case 'week': return d && d >= t && d <= addDays(t, 7);
        case 'month': return d && d.slice(0, 7) === t.slice(0, 7);
        case 'pick': return d && (!f.month || d.slice(0, 7) === f.month);
        default: return true;
      }
    });
    const done = (o) => (ACTIVE.includes(o.status) ? 0 : 1);
    const sorters = {
      delivery: (a, b) => done(a) - done(b) || (a.delivery_date || '9999').localeCompare(b.delivery_date || '9999') * (done(a) ? -1 : 1),
      recent: (a, b) => b.order_date.localeCompare(a.order_date) || (b.id || 1e9) - (a.id || 1e9),
      name: (a, b) => a.client_name.localeCompare(b.client_name, 'fr'),
      due: (a, b) => calc(b).remaining - calc(a).remaining,
    };
    return list.sort(sorters[f.sort] || sorters.delivery);
  }
  function orderCard(o) {
    const c = calc(o), late = isLate(o);
    return `<article class="order-card" data-open="${o.uid}" tabindex="0" aria-label="Commande de ${esc(o.client_name)}">
      <div class="top"><div style="min-width:0;flex:1 1 170px"><div class="name">${esc(o.client_name)}</div>
        <div class="meta">${esc(ref(o))} · ${esc(EVENTS[o.event_type])}${o.phone ? ' · ' + esc(o.phone) : ''}</div></div>
        <select class="pill st-${o.status}" data-status="${o.uid}" aria-label="Statut de la commande">${Object.entries(STATUS_SHORT).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="meta">${esc(o.product || 'Produit non précisé')} · ${o.quantity} × ${money(o.unit_price)}</div>
      <div class="figs"><div><span>Livraison</span><b>${esc(o.delivery_date ? shortDate(o.delivery_date) : '—')}</b>${late ? '<span class="pill tag-late" style="justify-self:start;font-size:.72rem;padding:2px 8px">En retard</span>' : ''}</div>
        <div><span>Total</span><b>${money(c.total)}</b></div>
        <div><span>Reste</span>${c.remaining > 0 ? `<b class="due">${money(c.remaining)}</b>` : '<b style="color:var(--ok)">Payée</b>'}</div></div>
    </article>`;
  }
  function drawList() {
    const list = filtered();
    const el = $('#list');
    if (!el) return;
    el.innerHTML = list.length ? `<div class="cards">${list.map(orderCard).join('')}</div>`
      : `<div class="empty">${icon('search')}<span>${state.orders.length ? 'Aucune commande ne correspond à votre recherche.' : 'Aucune commande pour le moment.'}</span>${state.orders.length ? '' : `<a class="btn primary" href="#nouvelle">${icon('plus')}Ajouter la première commande</a>`}</div>`;
    $$('[data-open]', el).forEach((card) => {
      card.addEventListener('click', (e) => { if (!e.target.closest('select')) go('commande-' + card.dataset.open); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === card) go('commande-' + card.dataset.open); });
    });
    $$('[data-status]', el).forEach((s) => s.addEventListener('change', () => changeStatus(s.dataset.status, s.value, drawList)));
  }
  async function changeStatus(id, status, after) {
    await busy(null, async () => { await store.setStatus(id, status); await reload(); toast(`Statut : ${STATUS[status]}`); after(); });
  }

  /* ================= Fiche commande ================= */
  function viewDetail(id) {
    const v = $('#view');
    const o = state.orders.find((x) => x.uid === id);
    if (!o) { v.innerHTML = `<a class="back" href="#commandes">${icon('back')}Commandes</a><div class="empty">Cette commande n'existe plus.</div>`; return; }
    const c = calc(o);
    const pct = c.total ? Math.min(100, Math.round((c.paid / c.total) * 100)) : 0;
    v.innerHTML = `
      <a class="back" href="#commandes">${icon('back')}Commandes</a>
      <div class="detail-head"><div style="min-width:0"><div class="eyebrow">${esc(ref(o))} · ${esc(EVENTS[o.event_type])}${o.is_demo ? ' · exemple' : ''}</div><h1>${esc(o.client_name)}</h1>
        ${o.phone ? `<p style="margin:6px 0 0"><a href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}" style="display:inline-flex;gap:6px;align-items:center;text-decoration:none">${icon('phone')}<span class="num">${esc(o.phone)}</span></a></p>` : ''}</div>
        <div class="actions"><a class="btn" href="#modifier-${o.uid}">${icon('edit')}Modifier</a><button class="btn danger" id="del">${icon('trash')}Supprimer</button></div></div>

      <section class="panel"><header><h2>Statut</h2>${isLate(o) ? '<span class="pill tag-late">Livraison en retard</span>' : ''}</header>
        <div class="status-picker">${Object.entries(STATUS).map(([k, l]) => `<button class="st-${k} ${k === o.status ? 'on' : ''}" data-set="${k}" aria-pressed="${k === o.status}">${esc(l)}</button>`).join('')}</div></section>

      <section class="panel"><header><h2>Détails de la commande</h2></header>
        <dl class="facts">
          <div><dt>Produit</dt><dd>${esc(o.product || '—')}</dd></div>
          <div><dt>Quantité</dt><dd class="num">${o.quantity}</dd></div>
          <div><dt>Prix unitaire</dt><dd class="num">${money(o.unit_price)}</dd></div>
          <div><dt>Prix total</dt><dd class="num"><b>${money(c.total)}</b></dd></div>
          <div><dt>Reçue le</dt><dd>${esc(fmtDate(o.order_date))}</dd></div>
          <div><dt>Livraison prévue</dt><dd>${esc(fmtDate(o.delivery_date))}</dd></div>
        </dl>
        ${o.description ? `<div class="field"><span class="label">Personnalisation</span><p class="desc">${esc(o.description)}</p></div>` : ''}
      </section>

      <section class="panel"><header><h2>Paiements</h2>${c.remaining <= 0 && c.total > 0 ? '<span class="pill tag-paid">Entièrement payée</span>' : ''}</header>
        <div class="money-line"><div><span>Prix total</span><b>${money(c.total)}</b></div><div><span>Déjà payé</span><b>${money(c.paid)}</b></div>
          <div class="due"><span>${c.remaining < 0 ? 'Trop-perçu' : 'Reste à payer'}</span><b>${money(Math.abs(c.remaining))}</b></div></div>
        <div class="bar" role="img" aria-label="${pct} % payé"><i style="width:${pct}%"></i></div>
        <div class="pay-list">${o.payments.length ? o.payments.map((p) => `<div class="pay">${icon('coins')}<div class="what">${esc(p.note || (p.is_advance ? 'Avance' : 'Paiement'))}<small>${esc(fmtDate(p.date))}</small></div><b>${money(p.amount)}</b>
            <button class="icon-btn" data-delpay="${p.uid}" aria-label="Supprimer ce paiement">${icon('trash')}</button></div>`).join('') : '<p class="muted" style="margin:0">Aucun paiement enregistré.</p>'}</div>
        <form class="pay-form" id="pay-form" novalidate>
          <div class="field"><label for="p-amount">Montant reçu (DT)</label><input type="text" id="p-amount" inputmode="decimal" placeholder="0" autocomplete="off"></div>
          <div class="field"><label for="p-date">Date</label><input type="date" id="p-date" value="${today()}"></div>
          <div class="field full"><label for="p-note">Note (facultatif)</label><input type="text" id="p-note" placeholder="Ex. deuxième versement, solde…"></div>
          <div class="actions full">${c.remaining > 0 ? `<button type="button" class="btn" id="p-rest">Payer le reste (${money(c.remaining)})</button>` : ''}
            <button class="btn primary" id="p-save" type="submit">${icon('plus')}Enregistrer le paiement</button></div>
        </form>
      </section>`;
    $$('[data-set]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.set !== o.status) changeStatus(o.uid, b.dataset.set, () => viewDetail(id)); }));
    $('#del').addEventListener('click', async (e) => {
      if (!(await confirmBox('Supprimer cette commande ?', `La commande de ${o.client_name} et ses paiements seront définitivement effacés.`))) return;
      await busy(e.currentTarget, async () => { await store.deleteOrder(o.uid); await reload(); toast('Commande supprimée'); go('commandes'); });
    });
    $('#p-rest')?.addEventListener('click', () => { $('#p-amount').value = milToInput(c.remaining); $('#p-note').value = 'Solde'; $('#p-amount').focus(); });
    $('#pay-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = toMil($('#p-amount').value);
      if (!amount) { toast('Indiquez le montant reçu.'); $('#p-amount').focus(); return; }
      await busy($('#p-save'), async () => {
        await store.addPayment(o.uid, { amount, date: $('#p-date').value || today(), note: $('#p-note').value.trim(), is_advance: o.payments.length === 0 ? 1 : 0 });
        await reload(); toast('Paiement enregistré'); viewDetail(id);
      });
    });
    $$('[data-delpay]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('Supprimer ce paiement ?', 'Le montant sera retiré du total payé de cette commande.'))) return;
      await busy(b, async () => { await store.deletePayment(b.dataset.delpay); await reload(); toast('Paiement supprimé'); viewDetail(id); });
    }));
  }

  /* ================= Formulaire ================= */
  function viewForm(id) {
    const v = $('#view');
    const editing = id != null;
    const o = editing ? state.orders.find((x) => x.uid === id) : null;
    if (editing && !o) { v.innerHTML = `<a class="back" href="#commandes">${icon('back')}Commandes</a><div class="empty">Cette commande n'existe plus.</div>`; return; }
    const val = o || { client_name: '', phone: '', event_type: 'mariage', product: '', description: '', quantity: 1, unit_price: 0, order_date: today(), delivery_date: '', status: 'nouvelle', payments: [] };
    const paidBefore = editing ? calc(o).paid : 0;
    v.innerHTML = `
      ${editing ? `<a class="back" href="#commande-${o.uid}">${icon('back')}Retour à la commande</a>` : ''}
      <div class="page-head"><div><h1>${editing ? 'Modifier la commande' : 'Nouvelle commande'}</h1><p class="muted">${editing ? esc(ref(o)) : 'Seul le nom de la cliente est obligatoire.'}</p></div></div>
      <form id="order-form" class="panel" novalidate style="gap:26px">
        <div class="form-section"><h2>${icon('user')}Cliente</h2>
          <div class="grid2">
            <div class="field"><label for="o-name">Nom et prénom *</label><input type="text" id="o-name" autocomplete="off" autocapitalize="words" value="${esc(val.client_name)}" required></div>
            <div class="field"><label for="o-phone">Téléphone</label><input type="tel" id="o-phone" inputmode="tel" autocomplete="off" placeholder="Ex. 22 456 789" value="${esc(val.phone)}"></div>
          </div></div>
        <div class="form-section"><h2>${icon('gift')}Commande</h2>
          <div class="field"><span class="label" id="ev-l">Type d'événement</span>
            <div class="choice" role="radiogroup" aria-labelledby="ev-l">${Object.entries(EVENTS).map(([k, l]) => `<label><input type="radio" name="o-event" id="o-ev-${k}" value="${k}" ${val.event_type === k ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
          <div class="field"><label for="o-product">Produit commandé</label><input type="text" id="o-product" placeholder="Ex. Boîtes à dragées, plateau, bougies…" value="${esc(val.product)}"></div>
          <div class="field"><label for="o-desc">Personnalisation et détails</label><textarea id="o-desc" placeholder="Prénoms, couleurs, date, modèle, texte à graver…">${esc(val.description)}</textarea></div>
          <div class="grid2">
            <div class="field"><label for="o-qty">Quantité</label><div class="stepper"><button type="button" id="q-minus" aria-label="Diminuer">−</button><input type="text" id="o-qty" inputmode="numeric" value="${val.quantity}"><button type="button" id="q-plus" aria-label="Augmenter">+</button></div></div>
            <div class="field"><label for="o-price">Prix unitaire (DT)</label><input type="text" id="o-price" inputmode="decimal" placeholder="0" value="${esc(milToInput(val.unit_price))}"></div>
          </div>
          <div class="grid2">
            <div class="field"><label for="o-date">Date de réception</label><input type="date" id="o-date" value="${esc(val.order_date)}"></div>
            <div class="field"><label for="o-delivery">Date de livraison prévue</label><input type="date" id="o-delivery" value="${esc(val.delivery_date)}"></div>
          </div>
          ${editing ? `<div class="field"><label for="o-status">Statut</label><select id="o-status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === val.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
        </div>
        <div class="form-section"><h2>${icon('coins')}Paiement</h2>
          ${editing ? `<p class="info" style="margin:0">Déjà payé : <b>${money(paidBefore)}</b>. Pour ajouter ou retirer un paiement, utilisez la fiche de la commande.</p>`
            : `<div class="field"><label for="o-adv">Avance payée (DT)</label><input type="text" id="o-adv" inputmode="decimal" placeholder="0"><span class="hint">Vous pourrez ajouter d'autres paiements ensuite.</span></div>`}
          <p class="error" id="o-warn" hidden></p>
        </div>
        <div class="summary"><div class="figs"><div><span>Prix total</span><b id="s-total">0 DT</b></div><div><span>Reste à payer</span><b id="s-rest">0 DT</b></div></div>
          <button class="btn primary" type="submit" id="o-save">${icon('save')}${editing ? 'Enregistrer' : 'Enregistrer la commande'}</button></div>
      </form>`;
    const qty = $('#o-qty');
    const readQty = () => Math.max(1, Math.round(Number(qty.value.replace(/\D/g, '')) || 1));
    const update = () => {
      const total = readQty() * toMil($('#o-price').value);
      const paid = editing ? paidBefore : toMil($('#o-adv').value);
      $('#s-total').textContent = money(total);
      $('#s-rest').textContent = money(Math.max(0, total - paid));
      const w = $('#o-warn');
      w.hidden = !(paid > total && total > 0);
      w.textContent = editing ? 'Le montant déjà payé dépasse le nouveau prix total.' : "L'avance dépasse le prix total.";
    };
    $('#q-minus').onclick = () => { qty.value = Math.max(1, readQty() - 1); update(); };
    $('#q-plus').onclick = () => { qty.value = readQty() + 1; update(); };
    $('#order-form').addEventListener('input', update);
    update();
    if (!editing) $('#o-name').focus();
    $('#order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#o-name').value.trim();
      if (!name) { toast('Indiquez le nom de la cliente.'); $('#o-name').focus(); return; }
      const b = {
        client_name: name, phone: $('#o-phone').value.trim(), event_type: $('input[name="o-event"]:checked')?.value || 'autre',
        product: $('#o-product').value.trim(), description: $('#o-desc').value.trim(), quantity: readQty(), unit_price: toMil($('#o-price').value),
        order_date: $('#o-date').value || today(), delivery_date: $('#o-delivery').value || '',
      };
      await busy($('#o-save'), async () => {
        if (editing) { b.status = $('#o-status').value; await store.updateOrder(o.uid, b); await reload(); toast('Modifications enregistrées'); go('commande-' + o.uid); }
        else { b.advance = toMil($('#o-adv').value); const r = await store.createOrder(b); await reload(); toast('Commande enregistrée'); go('commande-' + r.uid); }
      });
    });
  }

  /* ================= Finances ================= */
  function viewFinances(v) {
    const t = totals();
    const pct = t.total ? Math.min(100, Math.round((t.paid / t.total) * 100)) : 0;
    const dueList = state.orders.filter((o) => o.status !== 'annulee' && calc(o).remaining > 0)
      .sort((a, b) => (a.delivery_date || '9999').localeCompare(b.delivery_date || '9999'));
    const pays = state.orders.flatMap((o) => o.payments.map((p) => ({ ...p, o }))).sort((a, b) => b.date.localeCompare(a.date) || (b.id || 1e9) - (a.id || 1e9)).slice(0, 12);
    const thisMonth = state.orders.flatMap((o) => o.payments).filter((p) => p.date.slice(0, 7) === today().slice(0, 7)).reduce((s, p) => s + p.amount, 0);
    v.innerHTML = `
      <div class="page-head"><div><h1>Finances</h1><p class="muted">Montants en dinars tunisiens. Les commandes annulées ne sont pas comptées.</p></div></div>
      <section class="stats">
        ${stat('Total des commandes', 'receipt', money(t.total), `${t.count} commande${t.count > 1 ? 's' : ''}`)}
        ${stat('Avances reçues', 'heart', money(t.advance), 'versées à la commande')}
        ${stat('Total des paiements reçus', 'coins', money(t.paid), `dont ${money(thisMonth)} ce mois-ci`)}
        ${stat('Reste à encaisser', 'hourglass', money(t.due), `${dueList.length} commande${dueList.length > 1 ? 's' : ''} à solder`, 'accent')}
      </section>
      <section class="panel"><header><h2>Encaissé</h2><span class="muted num">${pct} % du total</span></header><div class="bar"><i style="width:${pct}%"></i></div></section>
      <section class="panel"><header><h2>Reste à encaisser</h2></header>
        ${dueList.length ? `<div class="rows">${dueList.map((o) => { const c = calc(o); return `<a class="row" href="#commande-${o.uid}"><div style="min-width:0"><div class="who">${esc(o.client_name)}</div><div class="what">${esc(o.product || EVENTS[o.event_type])} · livraison ${esc(o.delivery_date ? shortDate(o.delivery_date) : 'non fixée')}</div></div>
          <div class="right"><b class="num" style="color:var(--rose-deep)">${money(c.remaining)}</b><span class="muted num" style="font-size:.85rem">payé ${money(c.paid)} sur ${money(c.total)}</span></div></a>`; }).join('')}</div>`
        : `<div class="empty">${icon('check')}<span>Tout est encaissé. Bravo !</span></div>`}
      </section>
      <section class="panel"><header><h2>Derniers paiements reçus</h2></header>
        ${pays.length ? `<div class="rows">${pays.map((p) => `<a class="row" href="#commande-${p.o.uid}"><div style="min-width:0"><div class="who">${esc(p.o.client_name)}</div><div class="what">${esc(p.note || (p.is_advance ? 'Avance' : 'Paiement'))} · ${esc(fmtDate(p.date))}</div></div><div class="right"><b class="num">${money(p.amount)}</b></div></a>`).join('')}</div>`
        : `<div class="empty">${icon('coins')}<span>Aucun paiement enregistré.</span></div>`}
      </section>`;
  }

  /* ================= Paramètres ================= */
  function viewSettings(v) {
    const demoCount = state.orders.filter((o) => o.is_demo).length;
    v.innerHTML = `
      <div class="page-head"><div><h1>Paramètres</h1><p class="muted">Profil, sécurité et sauvegarde de vos données.</p></div></div>
      <div class="settings">
        <form class="panel" id="acc-form" novalidate><header><h2>Profil et sécurité</h2>${icon('shield')}</header>
          <div class="field"><label for="s-name">Votre prénom</label><input type="text" id="s-name" value="${esc(state.user.display_name)}"></div>
          <div class="field"><label for="s-user">Identifiant</label><input type="text" id="s-user" autocapitalize="none" autocomplete="username" value="${esc(state.user.username)}"></div>
          <div class="field"><label for="s-new">Nouveau mot de passe</label><input type="password" id="s-new" autocomplete="new-password" placeholder="Laisser vide pour ne pas changer"></div>
          <div class="field"><label for="s-new2">Confirmer le nouveau mot de passe</label><input type="password" id="s-new2" autocomplete="new-password"></div>
          <div class="field"><label for="s-cur">Mot de passe actuel *</label><input type="password" id="s-cur" autocomplete="current-password"><span class="hint">Nécessaire pour valider toute modification.</span></div>
          <button class="btn primary" id="s-save" type="submit">Enregistrer</button>
        </form>
        <section class="panel"><header><h2>Sauvegarde et export</h2>${icon('save')}</header>
          <p class="info" id="bk-info" style="margin:0">${DEMO ? "Aperçu : les données restent dans ce navigateur, et le téléchargement de fichiers y est désactivé. Dans votre application installée, ces boutons téléchargent vos fichiers." : 'Chargement des informations de sauvegarde…'}</p>
          <div class="setting-actions">
            <button class="btn" id="x-excel">${icon('sheet')}Exporter toutes les commandes vers Excel</button>
            <button class="btn" id="x-json">${icon('download')}Télécharger une sauvegarde complète</button>
            ${DEMO ? '' : `<button class="btn" id="x-now">${icon('shield')}Créer une sauvegarde maintenant</button>`}
            <label class="btn" for="x-file" style="cursor:pointer">${icon('upload')}Restaurer une sauvegarde</label>
            <input type="file" id="x-file" accept=".json,application/json" hidden>
          </div>
        </section>
        <section class="panel"><header><h2>Commandes d'exemple</h2>${icon('sparkle')}</header>
          <p class="muted" style="margin:0">${demoCount ? `${demoCount} commande${demoCount > 1 ? 's' : ''} d'exemple ${demoCount > 1 ? 'sont' : 'est'} encore présente${demoCount > 1 ? 's' : ''}. Supprimez-les quand vous êtes prête à travailler avec vos vraies commandes.` : "Il n'y a plus de commande d'exemple."}</p>
          ${demoCount ? `<button class="btn danger" id="x-demo">${icon('trash')}Supprimer les commandes d'exemple</button>` : ''}
        </section>
        <section class="panel"><header><h2>Accès à l'application</h2>${icon('user')}</header>
          <p class="muted" style="margin:0">Chaque personne a son identifiant et son mot de passe. Tout le monde voit les mêmes commandes.</p>
          <div class="pay-list" id="users"><p class="muted" style="margin:0">Chargement…</p></div>
          <form id="user-form" class="form-section" novalidate style="gap:10px">
            <h3>Ajouter un accès</h3>
            <div class="field"><label for="u-name">Prénom</label><input type="text" id="u-name" autocomplete="off" placeholder="Ex. prénom de votre collègue"></div>
            <div class="field"><label for="u-user">Identifiant</label><input type="text" id="u-user" autocapitalize="none" autocomplete="off" spellcheck="false"></div>
            <div class="field"><label for="u-pass">Mot de passe</label><input type="password" id="u-pass" autocomplete="new-password"><span class="hint">8 caractères minimum. Communiquez-le à la personne de vive voix.</span></div>
            <button class="btn primary" id="u-save" type="submit">${icon('plus')}Ajouter cet accès</button>
          </form>
        </section>
        <section class="panel"><header><h2>Session</h2>${icon('user')}</header>
          <p class="muted" style="margin:0">Connectée en tant que <b>${esc(state.user.username)}</b>. Déconnectez-vous si vous utilisez un appareil partagé.</p>
          <button class="btn" id="x-out">${icon('logout')}Se déconnecter</button>
        </section>
      </div>`;
    if (!DEMO) store.backupsInfo().then((b) => {
      const el = $('#bk-info'); if (!el) return;
      if (b.kind === 'cloudflare') {
        el.textContent = "Vos commandes sont enregistrées en continu chez Cloudflare, qui permet de revenir à l'état des 7 derniers jours. Téléchargez aussi une sauvegarde complète chaque semaine et gardez-la en lieu sûr.";
        $('#x-now')?.remove();
        return;
      }
      el.textContent = b.last
        ? `Une copie de sécurité est faite automatiquement chaque jour. Dernière copie : ${new Date(b.last).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} (${b.count} copie${b.count > 1 ? 's' : ''} conservée${b.count > 1 ? 's' : ''}).`
        : 'Une copie de sécurité est faite automatiquement chaque jour.';
    }).catch(() => {});
    $('#acc-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('#s-new').value !== $('#s-new2').value) { toast('Les deux nouveaux mots de passe ne sont pas identiques.'); return; }
      if (!$('#s-cur').value) { toast('Indiquez votre mot de passe actuel.'); $('#s-cur').focus(); return; }
      await busy($('#s-save'), async () => {
        await store.updateAccount({ display_name: $('#s-name').value.trim(), username: $('#s-user').value.trim(), new_password: $('#s-new').value || undefined, current_password: $('#s-cur').value });
        const me = await store.me(); state.user = me.user; toast('Profil enregistré'); renderShell(); render();
      });
    });
    $('#x-excel').addEventListener('click', (e) => busy(e.currentTarget, exportExcel));
    $('#x-json').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const data = await store.exportAll();
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `Maison-SCouvenir-sauvegarde-${today()}.json`);
      toast('Sauvegarde téléchargée');
    }));
    $('#x-now')?.addEventListener('click', (e) => busy(e.currentTarget, async () => { await store.backupNow(); toast('Copie de sécurité créée'); viewSettings(v); }));
    $('#x-file').addEventListener('change', async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { toast("Ce fichier n'est pas une sauvegarde valide."); return; }
      const n = Array.isArray(data.orders) ? data.orders.length : 0;
      if (!(await confirmBox('Restaurer cette sauvegarde ?', `Les commandes actuelles seront remplacées par les ${n} commandes du fichier. ${DEMO ? '' : 'Une copie de sécurité des données actuelles est faite juste avant.'}`, 'Restaurer', false))) return;
      await busy(null, async () => { const r = await store.restore(data); await reload(); toast(`${r.restored} commande${r.restored > 1 ? 's' : ''} restaurée${r.restored > 1 ? 's' : ''}`); viewSettings(v); });
    });
    $('#x-demo')?.addEventListener('click', async (e) => { await deleteDemo(e); });
    const drawUsers = async () => {
      const el = $('#users'); if (!el) return;
      try {
        const users = await store.listUsers();
        el.innerHTML = users.map((u) => `<div class="pay">${icon('user')}<div class="what">${esc(u.display_name || u.username)}<small>Identifiant : ${esc(u.username)}${u.me ? ' · vous' : ''}</small></div>
          ${u.me ? '' : `<button class="icon-btn" data-deluser="${u.id}" data-name="${esc(u.display_name || u.username)}" aria-label="Retirer cet accès">${icon('trash')}</button>`}</div>`).join('');
        $$('[data-deluser]', el).forEach((b) => b.addEventListener('click', async () => {
          if (!(await confirmBox('Retirer cet accès ?', `${b.dataset.name} ne pourra plus se connecter. Les commandes ne sont pas touchées.`, 'Retirer'))) return;
          await busy(b, async () => { await store.removeUser(b.dataset.deluser); toast('Accès retiré'); drawUsers(); });
        }));
      } catch (e) { el.innerHTML = `<p class="muted" style="margin:0">${esc(e.message)}</p>`; }
    };
    drawUsers();
    $('#user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await busy($('#u-save'), async () => {
        await store.addUser({ display_name: $('#u-name').value.trim(), username: $('#u-user').value.trim(), password: $('#u-pass').value });
        $('#u-name').value = ''; $('#u-user').value = ''; $('#u-pass').value = '';
        toast('Accès ajouté'); drawUsers();
      });
    });
    $('#x-out').addEventListener('click', async () => { if (!(await busy(null, store.logout))) return; state.user = null; state.orders = []; boot(); });
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = '/vendor/xlsx.full.min.js';
      s.onload = res; s.onerror = () => rej(new Error("Impossible de préparer le fichier Excel. Vérifiez votre connexion."));
      document.head.appendChild(s);
    });
  }
  async function exportExcel() {
    await loadXlsx();
    const X = window.XLSX;
    const dt = (m) => Math.round(m) / 1000;
    const orders = [...state.orders].sort((a, b) => (a.id || 1e9) - (b.id || 1e9));
    const rows = orders.map((o) => { const c = calc(o); return {
      'N°': ref(o), 'Cliente': o.client_name, 'Téléphone': o.phone, 'Événement': EVENTS[o.event_type], 'Produit': o.product, 'Personnalisation': o.description,
      'Quantité': o.quantity, 'Prix unitaire (DT)': dt(o.unit_price), 'Prix total (DT)': dt(c.total), 'Avance (DT)': dt(c.advance), 'Total payé (DT)': dt(c.paid),
      'Reste à payer (DT)': dt(c.remaining), 'Date de réception': frDate(o.order_date), 'Livraison prévue': frDate(o.delivery_date), 'Statut': STATUS[o.status],
    }; });
    const pays = orders.flatMap((o) => o.payments.map((p) => ({ 'N° commande': ref(o), 'Cliente': o.client_name, 'Date': frDate(p.date), 'Type': p.is_advance ? 'Avance' : 'Paiement', 'Note': p.note, 'Montant (DT)': dt(p.amount) })));
    const wb = X.utils.book_new();
    const ws1 = X.utils.json_to_sheet(rows);
    ws1['!cols'] = [8, 22, 14, 13, 28, 40, 9, 14, 14, 12, 14, 16, 15, 15, 18].map((w) => ({ wch: w }));
    X.utils.book_append_sheet(wb, ws1, 'Commandes');
    const ws2 = X.utils.json_to_sheet(pays.length ? pays : [{ 'N° commande': '', 'Cliente': '', 'Date': '', 'Type': '', 'Note': '', 'Montant (DT)': '' }]);
    ws2['!cols'] = [12, 22, 12, 10, 26, 14].map((w) => ({ wch: w }));
    X.utils.book_append_sheet(wb, ws2, 'Paiements');
    X.writeFile(wb, `Maison-SCouvenir-commandes-${today()}.xlsx`);
    toast('Fichier Excel téléchargé');
  }

  /* ================= Démarrage ================= */
  async function boot() {
    try {
      const me = await store.me();
      state.user = me.user;
      if (!me.user) return renderAuth(me.setupNeeded);
      await reload();
      renderShell(); render();
    } catch (e) {
      root.innerHTML = `<div class="auth"><div class="auth-card"><h2>Connexion impossible</h2><p class="muted">${esc(e.message)}</p><button class="btn primary" id="retry">Réessayer</button></div></div>`;
      $('#retry').addEventListener('click', () => location.reload());
    }
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('online', syncNow);
  window.addEventListener('offline', updateNet);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (store.pending && store.pending()) syncNow(); }, 30000);
  if (!DEMO && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* adresse non sécurisée : pas de mode hors ligne */ });
  boot();
})();
