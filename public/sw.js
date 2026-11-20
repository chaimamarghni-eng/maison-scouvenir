/* Maison SCouvenir : permet d'ouvrir l'application sans connexion. */
const CACHE = 'scouvenir-v2';
const SHELL = ['/', '/styles.css', '/app.js', '/fonts/fonts.css', '/fonts/cormorant-garamond-latin.woff2', '/fonts/jost-latin.woff2',
  '/icon.svg', '/apple-touch-icon.png', '/icon-512.png', '/manifest.webmanifest', '/vendor/xlsx.full.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // Retire les anciennes versions de l'application.
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // L'application elle-même : la version en ligne si elle répond vite, sinon la copie enregistrée.
  if (e.request.mode === 'navigate' || ['/', '/app.js', '/styles.css'].includes(url.pathname)) {
    const key = e.request.mode === 'navigate' ? '/' : url.pathname;
    e.respondWith(withTimeout(fetch(e.request), 4000).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key)));
    return;
  }
  // Polices, icônes, Excel : la copie enregistrée d'abord.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
