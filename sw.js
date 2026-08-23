const CACHE = 'mathquest-v7';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './js/app.js', './js/facts.js', './js/engine.js', './js/store.js', './js/sound.js', './js/confetti.js', './js/teach.js', './js/api.js', './js/account.js', './js/config.js', './js/art.js', './js/asteroids.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for same-origin (so updates land), falling back to cache for offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
