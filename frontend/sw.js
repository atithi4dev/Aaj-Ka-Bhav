// sw.js: cache-first. After the first visit the app opens with no signal.
// Bump VERSION whenever any cached file or data/*.json changes, or phones keep the old copy.
const VERSION = 'abh-v4';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'logic.js', 'i18n.js', 'icons.js',
  'manifest.webmanifest', 'icons/Rupee.webp', 'icons/Rupee.webp', 'icons/Rupee.webp', 'icons/Rupee.webp',
  'data/data.json',
  'fonts/mukta-devanagari-500.woff2', 'fonts/mukta-devanagari-800.woff2', 'fonts/mukta-latin-500.woff2', 'fonts/mukta-latin-800.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // ignoreSearch: "index.html?lang=en" is the same page as "index.html"
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit ||
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
