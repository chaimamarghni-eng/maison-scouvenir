'use strict';
/*
 * Maison SCouvenir — serveur de l'application de gestion des commandes.
 * Aucune dépendance à installer : Node.js 22.13 ou plus récent suffit.
 * Démarrage : node --no-warnings server.js   (ou double-clic sur demarrer.bat / demarrer.command)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'donnees'));
const BACKUP_DIR = path.join(DATA_DIR, 'sauvegardes');
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUPS_TO_KEEP = 60;
const SESSION_DAYS = 90;

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'scouvenir.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    salt TEXT NOT NULL,
    hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL DEFAULT 'autre',
    product TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,      -- en millimes (1 DT = 1000 millimes)
    order_date TEXT NOT NULL,
    delivery_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'nouvelle',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,                     -- en millimes
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    is_advance INTEGER NOT NULL DEFAULT 0
  );
`);

// Migration : identifiant unique (uid) pour la synchronisation hors ligne.
for (const t of ['orders', 'payments']) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'uid')) db.exec(`ALTER TABLE ${t} ADD COLUMN uid TEXT`);
  for (const r of db.prepare(`SELECT id FROM ${t} WHERE uid IS NULL`).all()) db.prepare(`UPDATE ${t} SET uid = ? WHERE id = ?`).run(crypto.randomUUID(), r.id);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${t}_uid ON ${t}(uid)`);
}

{
  const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
  if (!cols.includes('discount')) db.exec('ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('delivery_mode')) db.exec("ALTER TABLE orders ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'sur_place'");
  if (!cols.includes('address')) db.exec("ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT ''");
}

const EVENT_TYPES = ['mariage', 'fiancailles', 'naissance', 'anniversaire', 'autre'];
const STATUSES = ['nouvelle', 'preparation', 'prete', 'livree', 'annulee'];

/* ---------- utilitaires ---------- */
const nowIso = () => new Date().toISOString();
const todayStr = () => localDate(new Date());
function localDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const mil = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? n : 0;
};
const validUid = (u) => (typeof u === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(u) ? u : null);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

/* ---------- sauvegardes automatiques ---------- */
function makeBackup(reason = 'auto') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, `scouvenir-${stamp}-${reason}.db`);
  try {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  } catch (e) {
    console.error('Sauvegarde impossible :', e.message);
    return null;
  }
  const files = listBackups();
  for (const f of files.slice(BACKUPS_TO_KEEP)) fs.rmSync(path.join(BACKUP_DIR, f.name), { force: true });
  return file;
}
function listBackups() {
  return fs.readdirSync(BACKUP_DIR)
    .filter((n) => n.endsWith('.db'))
    .map((name) => ({ name, time: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
}
function backupIfDue() {
  const last = listBackups()[0];
  if (!last || Date.now() - last.time > 24 * 3600 * 1000) makeBackup('auto');
}
backupIfDue();
setInterval(backupIfDue, 3600 * 1000).unref();

/* ---------- données ---------- */
function allOrders() {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  const pays = db.prepare('SELECT * FROM payments ORDER BY date, id').all();
  const byOrder = new Map(orders.map((o) => [o.id, Object.assign(o, { payments: [] })]));
  for (const p of pays) byOrder.get(p.order_id)?.payments.push(p);
  return orders;
}
function cleanOrder(b) {
  const o = {
    client_name: str(b.client_name, 120),
    phone: str(b.phone, 40),
    event_type: EVENT_TYPES.includes(b.event_type) ? b.event_type : 'autre',
    product: str(b.product, 200),
    description: str(b.description, 3000),
    quantity: Math.max(1, Math.min(100000, Math.round(Number(b.quantity) || 1))),
    unit_price: mil(b.unit_price),
    discount: mil(b.discount),
    delivery_mode: b.delivery_mode === 'livraison' ? 'livraison' : 'sur_place',
    address: b.delivery_mode === 'livraison' ? str(b.address, 500) : '',
    order_date: isDate(b.order_date) ? b.order_date : todayStr(),
    delivery_date: isDate(b.delivery_date) ? b.delivery_date : '',
    status: STATUSES.includes(b.status) ? b.status : 'nouvelle',
  };
  if (!o.client_name) throw httpError(400, 'Le nom de la cliente est obligatoire.');
  return o;
}
function insertPayment(orderId, p) {
  const uid = validUid(p.uid) || crypto.randomUUID();
  if (db.prepare('SELECT id FROM payments WHERE uid = ?').get(uid)) return; // déjà reçu (renvoi après coupure)
  db.prepare('INSERT INTO payments (order_id, amount, date, note, is_advance, uid) VALUES (?,?,?,?,?,?)')
    .run(orderId, mil(p.amount), isDate(p.date) ? p.date : todayStr(), str(p.note, 200), p.is_advance ? 1 : 0, uid);
}
function insertOrder(o, isDemo = 0, payments = [], uid = null) {
  const t = nowIso();
  const r = db.prepare(`INSERT INTO orders (client_name, phone, event_type, product, description, quantity, unit_price, discount, delivery_mode, address,
      order_date, delivery_date, status, is_demo, created_at, updated_at, uid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(o.client_name, o.phone, o.event_type, o.product, o.description, o.quantity, o.unit_price, o.discount, o.delivery_mode, o.address,
      o.order_date, o.delivery_date, o.status, isDemo ? 1 : 0, o.created_at || t, o.updated_at || t, validUid(uid) || crypto.randomUUID());
  const id = Number(r.lastInsertRowid);
  for (const p of payments) if (mil(p.amount) > 0) insertPayment(id, p);
  return id;
}
function findOrder(key) {
  return /^\d+$/.test(key) ? db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(key))
    : db.prepare('SELECT * FROM orders WHERE uid = ?').get(key);
}

function seedDemo() {
  const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return localDate(x); };
  const demo = [
    { client_name: 'Amira Ben Salah', phone: '22 456 789', event_type: 'mariage', product: 'Boîtes à dragées en velours',
      description: 'Prénoms « Amira & Youssef », date du mariage, couleur vieux rose, ruban satin ivoire.',
      quantity: 120, unit_price: 4500, order_date: d(-12), delivery_date: d(4), status: 'preparation',
      payments: [{ amount: 200000, date: d(-12), is_advance: 1, note: 'Avance' }] },
    { client_name: 'Nour Trabelsi', phone: '55 321 654', event_type: 'fiancailles', product: 'Plateau de fiançailles personnalisé',
      description: 'Plateau miroir doré, initiales N & K, fleurs séchées beiges.',
      quantity: 1, unit_price: 185000, order_date: d(-8), delivery_date: d(2), status: 'prete',
      payments: [{ amount: 80000, date: d(-8), is_advance: 1, note: 'Avance' }, { amount: 50000, date: d(-3), note: 'Deuxième versement' }] },
    { client_name: 'Salma Gharbi', phone: '98 112 233', event_type: 'naissance', product: 'Sachets de dragées naissance',
      description: 'Prénom « Lina », thème nuage, couleurs beige et blanc.',
      quantity: 60, unit_price: 3000, order_date: d(-3), delivery_date: d(9), status: 'nouvelle',
      payments: [{ amount: 50000, date: d(-3), is_advance: 1, note: 'Avance' }] },
    { client_name: 'Rania Jaziri', phone: '20 987 654', event_type: 'anniversaire', product: 'Bougies parfumées gravées',
      description: 'Gravure « Rania 30 ans », pots en verre ambré.',
      quantity: 25, unit_price: 12000, order_date: d(-20), delivery_date: d(-6), status: 'livree',
      payments: [{ amount: 100000, date: d(-20), is_advance: 1, note: 'Avance' }, { amount: 200000, date: d(-6), note: 'Solde à la livraison' }] },
    { client_name: 'Ines Mansouri', phone: '52 741 852', event_type: 'mariage', product: 'Cadres photo pour témoins',
      description: 'Bois clair, gravure des prénoms et de la date.',
      quantity: 6, unit_price: 35000, order_date: d(-1), delivery_date: d(15), status: 'nouvelle', payments: [] },
    { client_name: 'Yasmine Chaabane', phone: '29 654 123', event_type: 'autre', product: 'Coffrets cadeaux entreprise',
      description: 'Logo doré sur couvercle, carte de remerciement.',
      quantity: 40, unit_price: 25000, order_date: d(-15), delivery_date: d(-2), status: 'annulee', payments: [] },
  ];
  for (const o of demo) insertOrder(cleanOrder(o), 1, o.payments);
}

/* ---------- sessions & sécurité ---------- */
const failed = new Map(); // ip -> { count, until }
function getUser(req) {
  const m = /(?:^|;\s*)sc_session=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const row = db.prepare(`SELECT u.id, u.username, u.display_name, s.expires FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).get(sha(m[1]));
  if (!row || row.expires < Date.now()) return null;
  return row;
}
function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?,?,?)')
    .run(sha(token), userId, Date.now() + SESSION_DAYS * 86400 * 1000);
  res.setHeader('Set-Cookie', cookie(req, token, SESSION_DAYS * 86400));
}
function cookie(req, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  return `sc_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

/* ---------- HTTP ---------- */
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!/application\/json/.test(req.headers['content-type'] || '')) return reject(httpError(415, 'Format non accepté.'));
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(httpError(413, 'Fichier trop volumineux.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(httpError(400, 'Données illisibles.')); } });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': rel.startsWith('/vendor/') || rel.startsWith('/fonts/') ? 'public, max-age=604800' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

  if (route === 'GET /api/me') {
    const u = getUser(req);
    return send(res, 200, { setupNeeded: userCount === 0, user: u ? { username: u.username, display_name: u.display_name } : null });
  }
  if (route === 'POST /api/setup') {
    if (userCount > 0) throw httpError(403, 'Le compte existe déjà.');
    const b = await readBody(req);
    const username = str(b.username, 60).toLowerCase();
    if (username.length < 3) throw httpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    if (String(b.password || '').length < 8) throw httpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    const { salt, hash } = hashPassword(String(b.password));
    const r = db.prepare('INSERT INTO users (username, display_name, salt, hash) VALUES (?,?,?,?)')
      .run(username, str(b.display_name, 80), salt, hash);
    if (db.prepare('SELECT COUNT(*) AS n FROM orders').get().n === 0) seedDemo();
    startSession(req, res, Number(r.lastInsertRowid));
    return send(res, 200, { ok: true });
  }
  if (route === 'POST /api/login') {
    const ip = clientIp(req);
    const f = failed.get(ip);
    if (f && f.until > Date.now()) throw httpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    const b = await readBody(req);
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(str(b.username, 60).toLowerCase());
    if (!user || !checkPassword(String(b.password || ''), user)) {
      const count = (f?.count || 0) + 1;
      failed.set(ip, { count: count >= 5 ? 0 : count, until: count >= 5 ? Date.now() + 10 * 60 * 1000 : 0 });
      throw httpError(401, 'Identifiant ou mot de passe incorrect.');
    }
    failed.delete(ip);
    startSession(req, res, user.id);
    return send(res, 200, { ok: true });
  }
  if (route === 'POST /api/logout') {
    const m = /(?:^|;\s*)sc_session=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
    res.setHeader('Set-Cookie', cookie(req, '', 0));
    return send(res, 200, { ok: true });
  }

  // Tout ce qui suit nécessite d'être connectée.
  const user = getUser(req);
  if (!user) throw httpError(401, 'Veuillez vous reconnecter.');

  if (route === 'GET /api/orders') return send(res, 200, allOrders());
  if (route === 'POST /api/orders') {
    const b = await readBody(req);
    const existing = validUid(b.uid) && db.prepare('SELECT id, uid FROM orders WHERE uid = ?').get(b.uid);
    if (existing) return send(res, 200, existing); // déjà reçue (renvoi après coupure)
    const o = cleanOrder(b);
    const id = insertOrder(o, 0, b.advance ? [{ amount: b.advance, date: o.order_date, is_advance: 1, note: 'Avance', uid: b.advance_uid }] : [], b.uid);
    return send(res, 200, db.prepare('SELECT id, uid FROM orders WHERE id = ?').get(id));
  }
  let m;
  if ((m = /^(PUT|DELETE|PATCH) \/api\/orders\/([A-Za-z0-9-]{1,64})$/.exec(route))) {
    const existing = findOrder(m[2]);
    if (!existing && m[1] === 'DELETE') return send(res, 200, { ok: true }); // déjà supprimée
    if (!existing) throw httpError(404, 'Commande introuvable.');
    const id = existing.id;
    if (m[1] === 'DELETE') { db.prepare('DELETE FROM orders WHERE id = ?').run(id); return send(res, 200, { ok: true }); }
    const b = await readBody(req);
    if (m[1] === 'PATCH') {
      if (!STATUSES.includes(b.status)) throw httpError(400, 'Statut inconnu.');
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(b.status, nowIso(), id);
      return send(res, 200, { ok: true });
    }
    const o = cleanOrder({ ...existing, ...b });
    db.prepare(`UPDATE orders SET client_name=?, phone=?, event_type=?, product=?, description=?, quantity=?, unit_price=?, discount=?, delivery_mode=?, address=?,
      order_date=?, delivery_date=?, status=?, updated_at=? WHERE id=?`)
      .run(o.client_name, o.phone, o.event_type, o.product, o.description, o.quantity, o.unit_price, o.discount, o.delivery_mode, o.address,
        o.order_date, o.delivery_date, o.status, nowIso(), id);
    return send(res, 200, { ok: true });
  }
  if ((m = /^POST \/api\/orders\/([A-Za-z0-9-]{1,64})\/payments$/.exec(route))) {
    const order = findOrder(m[1]);
    if (!order) throw httpError(404, 'Commande introuvable.');
    const b = await readBody(req);
    if (mil(b.amount) <= 0) throw httpError(400, 'Indiquez un montant supérieur à 0.');
    insertPayment(order.id, b);
    return send(res, 200, { ok: true });
  }
  if ((m = /^DELETE \/api\/payments\/([A-Za-z0-9-]{1,64})$/.exec(route))) {
    if (/^\d+$/.test(m[1])) db.prepare('DELETE FROM payments WHERE id = ?').run(Number(m[1]));
    else db.prepare('DELETE FROM payments WHERE uid = ?').run(m[1]);
    return send(res, 200, { ok: true });
  }
  if (route === 'DELETE /api/demo') {
    const r = db.prepare('DELETE FROM orders WHERE is_demo = 1').run();
    return send(res, 200, { deleted: Number(r.changes) });
  }
  if (route === 'POST /api/account') {
    const b = await readBody(req);
    const full = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!checkPassword(String(b.current_password || ''), full)) throw httpError(400, 'Le mot de passe actuel est incorrect.');
    const username = str(b.username || full.username, 60).toLowerCase();
    if (username.length < 3) throw httpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    let { salt, hash } = full;
    if (b.new_password) {
      if (String(b.new_password).length < 8) throw httpError(400, 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      ({ salt, hash } = hashPassword(String(b.new_password)));
    }
    db.prepare('UPDATE users SET username=?, display_name=?, salt=?, hash=? WHERE id=?')
      .run(username, str(b.display_name ?? full.display_name, 80), salt, hash, user.id);
    if (b.new_password) { // déconnecte les autres appareils
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      startSession(req, res, user.id);
    }
    return send(res, 200, { ok: true });
  }
  if (route === 'GET /api/users') {
    return send(res, 200, db.prepare('SELECT id, username, display_name FROM users ORDER BY id').all().map((u) => ({ ...u, me: u.id === user.id })));
  }
  if (route === 'POST /api/users') {
    const b = await readBody(req);
    const username = str(b.username, 60).toLowerCase();
    if (username.length < 3) throw httpError(400, "L'identifiant doit contenir au moins 3 caractères.");
    if (String(b.password || '').length < 8) throw httpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw httpError(400, 'Cet identifiant est déjà utilisé.');
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n >= 10) throw httpError(400, "Nombre maximal d'accès atteint.");
    const { salt, hash } = hashPassword(String(b.password));
    db.prepare('INSERT INTO users (username, display_name, salt, hash) VALUES (?,?,?,?)').run(username, str(b.display_name, 80), salt, hash);
    return send(res, 200, { ok: true });
  }
  if ((m = /^DELETE \/api\/users\/(\d+)$/.exec(route))) {
    if (Number(m[1]) === user.id) throw httpError(400, 'Vous ne pouvez pas retirer votre propre accès.');
    db.prepare('DELETE FROM users WHERE id = ?').run(Number(m[1])); // ses sessions partent avec lui
    return send(res, 200, { ok: true });
  }
  if (route === 'GET /api/backups') {
    const list = listBackups();
    return send(res, 200, { count: list.length, last: list[0] ? new Date(list[0].time).toISOString() : null, folder: BACKUP_DIR });
  }
  if (route === 'POST /api/backups') { makeBackup('manuelle'); return send(res, 200, { ok: true }); }
  if (route === 'GET /api/export') {
    return send(res, 200, { app: 'maison-scouvenir', version: 1, exported_at: nowIso(), orders: allOrders() });
  }
  if (route === 'POST /api/restore') {
    const b = await readBody(req);
    if (b.app !== 'maison-scouvenir' || !Array.isArray(b.orders)) throw httpError(400, "Ce fichier n'est pas une sauvegarde Maison SCouvenir.");
    makeBackup('avant-restauration');
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM payments; DELETE FROM orders;');
      for (const o of [...b.orders].reverse()) insertOrder({ ...cleanOrder(o), created_at: o.created_at, updated_at: o.updated_at }, o.is_demo, o.payments || [], o.uid);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return send(res, 200, { restored: b.orders.length });
  }
  throw httpError(404, 'Action inconnue.');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'");
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Méthode non autorisée.');
    serveStatic(req, res);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Une erreur est survenue. Réessayez.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Maison SCouvenir est prête : http://localhost:${PORT}`);
  console.log(`  Données : ${DB_PATH}`);
  console.log(`  Sauvegardes automatiques : ${BACKUP_DIR}\n`);
});
