/*
 * Maison SCouvenir — version Cloudflare (gratuite) : Pages Functions + base D1.
 * Le dossier public/ est servi tel quel ; toutes les adresses /api/* arrivent ici.
 * La base D1 doit être liée au projet sous le nom « DB ».
 */
const SESSION_DAYS = 90;
const PBKDF2_ROUNDS = 20000;
const EVENT_TYPES = ['mariage', 'fiancailles', 'naissance', 'anniversaire', 'autre'];
const STATUSES = ['nouvelle', 'preparation', 'prete', 'livree', 'annulee'];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '', salt TEXT NOT NULL, hash TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE, client_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL DEFAULT 'autre', product TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0, order_date TEXT NOT NULL, delivery_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'nouvelle',
    is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', is_advance INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)`,
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  const cols = (await db.prepare('PRAGMA table_info(orders)').all()).results;
  const has = (n) => cols.some((c) => c.name === n);
  if (!has('discount')) await db.prepare('ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0').run();
  if (!has('delivery_mode')) await db.prepare("ALTER TABLE orders ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'sur_place'").run();
  if (!has('address')) await db.prepare("ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT ''").run();
  if (!has('items')) await db.prepare("ALTER TABLE orders ADD COLUMN items TEXT NOT NULL DEFAULT '[]'").run();
  schemaReady = true;
}

/* ---------- utilitaires ---------- */
const nowIso = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
// Date du jour en Tunisie (UTC+1).
const todayStr = () => { const d = new Date(Date.now() + 3600 * 1000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const mil = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1e12 ? n : 0; };
const validUid = (u) => (typeof u === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(u) ? u : null);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function hashPassword(password, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ROUNDS }, key, 256);
  return { salt, hash: hex(bits) };
}
async function checkPassword(password, user) {
  const { hash } = await hashPassword(password, user.salt);
  if (hash.length !== user.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ user.hash.charCodeAt(i);
  return diff === 0;
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});
async function readBody(request) {
  if (!/application\/json/.test(request.headers.get('content-type') || '')) throw new HttpError(415, 'Format non accepté.');
  const text = await request.text();
  if (text.length > 20 * 1024 * 1024) throw new HttpError(413, 'Fichier trop volumineux.');
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'Données illisibles.'); }
}
const cookie = (value, maxAge) => `sc_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const tokenFrom = (request) => (/(?:^|;\s*)sc_session=([a-f0-9]{64})/.exec(request.headers.get('cookie') || '') || [])[1];

/* ---------- données ---------- */
// Articles d'une commande : [{ product, model, quantity, unit_price (millimes) }]
function cleanItems(raw) {
  let list = raw;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 50).map((i) => ({
    product: str(i && i.product, 200), model: str(i && i.model, 200),
    quantity: Math.max(1, Math.min(100000, Math.round(Number(i && i.quantity) || 1))), unit_price: mil(i && i.unit_price),
  })).filter((i) => i.product || i.model || i.unit_price);
}
function withItems(o, raw) {
  const items = cleanItems(raw);
  o.items = JSON.stringify(items);
  if (items.length) {
    o.product = items.map((i) => i.product || i.model || 'Article').join(', ').slice(0, 200);
    o.quantity = items.reduce((s, i) => s + i.quantity, 0);
    o.unit_price = items.length === 1 ? items[0].unit_price : 0;
  }
  return o;
}
function cleanOrder(b) {
  const o = {
    client_name: str(b.client_name, 120), phone: str(b.phone, 40),
    event_type: EVENT_TYPES.includes(b.event_type) ? b.event_type : 'autre',
    product: str(b.product, 200), description: str(b.description, 3000),
    quantity: Math.max(1, Math.min(100000, Math.round(Number(b.quantity) || 1))), unit_price: mil(b.unit_price), discount: mil(b.discount),
    delivery_mode: b.delivery_mode === 'livraison' ? 'livraison' : 'sur_place', address: b.delivery_mode === 'livraison' ? str(b.address, 500) : '',
    order_date: isDate(b.order_date) ? b.order_date : todayStr(), delivery_date: isDate(b.delivery_date) ? b.delivery_date : '',
    status: STATUSES.includes(b.status) ? b.status : 'nouvelle',
  };
  if (!o.client_name) throw new HttpError(400, 'Le nom de la cliente est obligatoire.');
  return withItems(o, b.items);
}

// Insère plusieurs commandes (et leurs paiements) en deux requêtes seulement.
function bulkInsertStatements(db, list) {
  const t = nowIso();
  const orders = [], payments = [];
  for (const raw of list) {
    const o = { ...cleanOrder(raw), uid: validUid(raw.uid) || crypto.randomUUID(), is_demo: raw.is_demo ? 1 : 0,
      created_at: str(raw.created_at, 40) || t, updated_at: str(raw.updated_at, 40) || t };
    orders.push(o);
    for (const p of raw.payments || []) {
      if (mil(p.amount) > 0) payments.push({ uid: validUid(p.uid) || crypto.randomUUID(), order_uid: o.uid, amount: mil(p.amount),
        date: isDate(p.date) ? p.date : todayStr(), note: str(p.note, 200), is_advance: p.is_advance ? 1 : 0 });
    }
  }
  return [
    db.prepare(`INSERT OR IGNORE INTO orders (uid, client_name, phone, event_type, product, description, quantity, unit_price, discount, delivery_mode, address, items, order_date, delivery_date, status, is_demo, created_at, updated_at)
      SELECT j.value->>'uid', j.value->>'client_name', j.value->>'phone', j.value->>'event_type', j.value->>'product', j.value->>'description',
        j.value->>'quantity', j.value->>'unit_price', j.value->>'discount', j.value->>'delivery_mode', j.value->>'address', j.value->>'items', j.value->>'order_date', j.value->>'delivery_date', j.value->>'status', j.value->>'is_demo',
        j.value->>'created_at', j.value->>'updated_at' FROM json_each(?1) j`).bind(JSON.stringify(orders)),
    db.prepare(`INSERT OR IGNORE INTO payments (uid, order_id, amount, date, note, is_advance)
      SELECT j.value->>'uid', o.id, j.value->>'amount', j.value->>'date', j.value->>'note', j.value->>'is_advance'
      FROM json_each(?1) j JOIN orders o ON o.uid = j.value->>'order_uid'`).bind(JSON.stringify(payments)),
  ];
}

function demoOrders() {
  const d = (n) => addDays(todayStr(), n);
  return [
    ['Amira Ben Salah', '22 456 789', 'mariage', 'Boîtes à dragées en velours', 'Prénoms « Amira & Youssef », date du mariage, couleur vieux rose, ruban satin ivoire.', 120, 4500, -12, 4, 'preparation', [[200000, -12, 1, 'Avance']]],
    ['Nour Trabelsi', '55 321 654', 'fiancailles', 'Plateau de fiançailles personnalisé', 'Plateau miroir doré, initiales N & K, fleurs séchées beiges.', 1, 185000, -8, 2, 'prete', [[80000, -8, 1, 'Avance'], [50000, -3, 0, 'Deuxième versement']]],
    ['Salma Gharbi', '98 112 233', 'naissance', 'Sachets de dragées naissance', 'Prénom « Lina », thème nuage, couleurs beige et blanc.', 60, 3000, -3, 9, 'nouvelle', [[50000, -3, 1, 'Avance']]],
    ['Rania Jaziri', '20 987 654', 'anniversaire', 'Bougies parfumées gravées', 'Gravure « Rania 30 ans », pots en verre ambré.', 25, 12000, -20, -6, 'livree', [[100000, -20, 1, 'Avance'], [200000, -6, 0, 'Solde à la livraison']]],
    ['Ines Mansouri', '52 741 852', 'mariage', 'Cadres photo pour témoins', 'Bois clair, gravure des prénoms et de la date.', 6, 35000, -1, 15, 'nouvelle', []],
    ['Yasmine Chaabane', '29 654 123', 'autre', 'Coffrets cadeaux entreprise', 'Logo doré sur couvercle, carte de remerciement.', 40, 25000, -15, -2, 'annulee', []],
  ].map(([client_name, phone, event_type, product, description, quantity, unit_price, od, dd, status, pays]) => ({
    client_name, phone, event_type, product, description, quantity, unit_price, order_date: d(od), delivery_date: d(dd), status, is_demo: 1,
    payments: pays.map(([amount, pd, is_advance, note]) => ({ amount, date: d(pd), is_advance, note })),
  }));
}

async function allOrders(db) {
  const [o, p] = await db.batch([db.prepare('SELECT * FROM orders ORDER BY id DESC'), db.prepare('SELECT * FROM payments ORDER BY date, id')]);
  const orders = o.results;
  const byId = new Map(orders.map((x) => [x.id, Object.assign(x, { payments: [] })]));
  for (const pay of p.results) byId.get(pay.order_id)?.payments.push(pay);
  return orders;
}
const findOrder = (db, key) => (/^\d+$/.test(key)
  ? db.prepare('SELECT * FROM orders WHERE id = ?').bind(Number(key)).first()
  : db.prepare('SELECT * FROM orders WHERE uid = ?').bind(key).first());

async function getUser(db, request) {
  const t = tokenFrom(request);
  if (!t) return null;
  const row = await db.prepare(`SELECT u.id, u.username, u.display_name, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .bind(await sha(t)).first();
  return row && row.expires > Date.now() ? row : null;
}
async function newSession(db, userId) {
  const token = randomHex(32);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()),
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?,?,?)').bind(await sha(token), userId, Date.now() + SESSION_DAYS * 86400000),
  ]);
  return cookie(token, SESSION_DAYS * 86400);
}

/* ---------- routes ---------- */
async function api(request, db) {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  let m;

  if (route === 'GET /api/me') {
    const [{ n }, u] = await Promise.all([db.prepare('SELECT COUNT(*) AS n FROM users').first(), getUser(db, request)]);
    return json({ setupNeeded: n === 0, user: u ? { username: u.username, display_name: u.display_name } : null });
  }
  if (route === 'POST /api/setup') {
    if ((await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n > 0) throw new HttpError(403, 'Le compte existe déjà.');
    const b = await readBody(request);
    const username = str(b.username, 60).toLowerCase();
    if (username.length < 3) throw new HttpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    if (String(b.password || '').length < 8) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    const { salt, hash } = await hashPassword(String(b.password));
    const r = await db.prepare('INSERT INTO users (username, display_name, salt, hash) VALUES (?,?,?,?)').bind(username, str(b.display_name, 80), salt, hash).run();
    if ((await db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n === 0) await db.batch(bulkInsertStatements(db, demoOrders()));
    return json({ ok: true }, 200, { 'Set-Cookie': await newSession(db, r.meta.last_row_id) });
  }
  if (route === 'POST /api/login') {
    const ip = request.headers.get('cf-connecting-ip') || 'inconnu';
    const att = await db.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(ip).first();
    if (att && att.until > Date.now()) throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    const b = await readBody(request);
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(str(b.username, 60).toLowerCase()).first();
    if (!user || !(await checkPassword(String(b.password || ''), user))) {
      const count = (att?.count || 0) + 1;
      await db.prepare('INSERT OR REPLACE INTO login_attempts (ip, count, until) VALUES (?,?,?)')
        .bind(ip, count >= 5 ? 0 : count, count >= 5 ? Date.now() + 10 * 60000 : 0).run();
      throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
    }
    await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    return json({ ok: true }, 200, { 'Set-Cookie': await newSession(db, user.id) });
  }
  if (route === 'POST /api/logout') {
    const t = tokenFrom(request);
    if (t) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha(t)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }

  const user = await getUser(db, request);
  if (!user) throw new HttpError(401, 'Veuillez vous reconnecter.');

  if (route === 'GET /api/orders') return json(await allOrders(db));
  if (route === 'POST /api/orders') {
    const b = await readBody(request);
    const existing = validUid(b.uid) && await db.prepare('SELECT id, uid FROM orders WHERE uid = ?').bind(b.uid).first();
    if (existing) return json(existing);
    const o = cleanOrder(b);
    const uid = validUid(b.uid) || crypto.randomUUID();
    const pays = mil(b.advance) > 0 ? [{ amount: b.advance, date: o.order_date, is_advance: 1, note: 'Avance', uid: b.advance_uid }] : [];
    await db.batch(bulkInsertStatements(db, [{ ...o, uid, payments: pays }]));
    return json(await db.prepare('SELECT id, uid FROM orders WHERE uid = ?').bind(uid).first());
  }
  if ((m = /^(PUT|DELETE|PATCH) \/api\/orders\/([A-Za-z0-9-]{1,64})$/.exec(route))) {
    const existing = await findOrder(db, m[2]);
    if (!existing && m[1] === 'DELETE') return json({ ok: true });
    if (!existing) throw new HttpError(404, 'Commande introuvable.');
    if (m[1] === 'DELETE') {
      await db.batch([db.prepare('DELETE FROM payments WHERE order_id = ?').bind(existing.id), db.prepare('DELETE FROM orders WHERE id = ?').bind(existing.id)]);
      return json({ ok: true });
    }
    const b = await readBody(request);
    if (m[1] === 'PATCH') {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Statut inconnu.');
      await db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(b.status, nowIso(), existing.id).run();
      return json({ ok: true });
    }
    const o = cleanOrder({ ...existing, ...b });
    await db.prepare(`UPDATE orders SET client_name=?, phone=?, event_type=?, product=?, description=?, quantity=?, unit_price=?, discount=?, delivery_mode=?, address=?, items=?, order_date=?, delivery_date=?, status=?, updated_at=? WHERE id=?`)
      .bind(o.client_name, o.phone, o.event_type, o.product, o.description, o.quantity, o.unit_price, o.discount, o.delivery_mode, o.address, o.items, o.order_date, o.delivery_date, o.status, nowIso(), existing.id).run();
    return json({ ok: true });
  }
  if ((m = /^POST \/api\/orders\/([A-Za-z0-9-]{1,64})\/payments$/.exec(route))) {
    const order = await findOrder(db, m[1]);
    if (!order) throw new HttpError(404, 'Commande introuvable.');
    const b = await readBody(request);
    if (mil(b.amount) <= 0) throw new HttpError(400, 'Indiquez un montant supérieur à 0.');
    await db.prepare('INSERT OR IGNORE INTO payments (uid, order_id, amount, date, note, is_advance) VALUES (?,?,?,?,?,?)')
      .bind(validUid(b.uid) || crypto.randomUUID(), order.id, mil(b.amount), isDate(b.date) ? b.date : todayStr(), str(b.note, 200), b.is_advance ? 1 : 0).run();
    return json({ ok: true });
  }
  if ((m = /^DELETE \/api\/payments\/([A-Za-z0-9-]{1,64})$/.exec(route))) {
    const col = /^\d+$/.test(m[1]) ? 'id' : 'uid';
    await db.prepare(`DELETE FROM payments WHERE ${col} = ?`).bind(col === 'id' ? Number(m[1]) : m[1]).run();
    return json({ ok: true });
  }
  if (route === 'DELETE /api/demo') {
    const [, r] = await db.batch([
      db.prepare('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)'),
      db.prepare('DELETE FROM orders WHERE is_demo = 1'),
    ]);
    return json({ deleted: r.meta.changes });
  }
  if (route === 'POST /api/account') {
    const b = await readBody(request);
    const full = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    if (!(await checkPassword(String(b.current_password || ''), full))) throw new HttpError(400, 'Le mot de passe actuel est incorrect.');
    const username = str(b.username || full.username, 60).toLowerCase();
    if (username.length < 3) throw new HttpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    if (username !== full.username && await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()) throw new HttpError(400, 'Cet identifiant est déjà utilisé.');
    let { salt, hash } = full;
    if (b.new_password) {
      if (String(b.new_password).length < 8) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      ({ salt, hash } = await hashPassword(String(b.new_password)));
    }
    await db.prepare('UPDATE users SET username=?, display_name=?, salt=?, hash=? WHERE id=?')
      .bind(username, str(b.display_name ?? full.display_name, 80), salt, hash, user.id).run();
    if (b.new_password) { // déconnecte les autres appareils
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
      return json({ ok: true }, 200, { 'Set-Cookie': await newSession(db, user.id) });
    }
    return json({ ok: true });
  }
  if (route === 'GET /api/users') {
    const { results } = await db.prepare('SELECT id, username, display_name FROM users ORDER BY id').all();
    return json(results.map((u) => ({ ...u, me: u.id === user.id })));
  }
  if (route === 'POST /api/users') {
    const b = await readBody(request);
    const username = str(b.username, 60).toLowerCase();
    if (username.length < 3) throw new HttpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    if (String(b.password || '').length < 8) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()) throw new HttpError(400, 'Cet identifiant est déjà utilisé.');
    if ((await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n >= 10) throw new HttpError(400, "Nombre maximal d'accès atteint.");
    const { salt, hash } = await hashPassword(String(b.password));
    await db.prepare('INSERT INTO users (username, display_name, salt, hash) VALUES (?,?,?,?)').bind(username, str(b.display_name, 80), salt, hash).run();
    return json({ ok: true });
  }
  if ((m = /^DELETE \/api\/users\/(\d+)$/.exec(route))) {
    if (Number(m[1]) === user.id) throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre accès.');
    await db.batch([db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(Number(m[1])), db.prepare('DELETE FROM users WHERE id = ?').bind(Number(m[1]))]);
    return json({ ok: true });
  }
  if (route === 'GET /api/backups') return json({ kind: 'cloudflare' });
  if (route === 'GET /api/export') return json({ app: 'maison-scouvenir', version: 1, exported_at: nowIso(), orders: await allOrders(db) });
  if (route === 'POST /api/restore') {
    const b = await readBody(request);
    if (b.app !== 'maison-scouvenir' || !Array.isArray(b.orders)) throw new HttpError(400, "Ce fichier n'est pas une sauvegarde Maison SCouvenir.");
    const list = [...b.orders].reverse();
    list.forEach(cleanOrder); // vérifie tout le fichier avant de toucher aux données
    await db.batch([db.prepare('DELETE FROM payments'), db.prepare('DELETE FROM orders'), ...bulkInsertStatements(db, list)]);
    return json({ restored: b.orders.length });
  }
  throw new HttpError(404, 'Action inconnue.');
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) throw new HttpError(500, "La base de données n'est pas encore reliée (liaison D1 « DB » manquante).");
    await ensureSchema(env.DB);
    return await api(request, env.DB);
  } catch (e) {
    if (!e.status) console.error(e);
    return json({ error: e.status ? e.message : 'Une erreur est survenue. Réessayez.' }, e.status || 500);
  }
}
