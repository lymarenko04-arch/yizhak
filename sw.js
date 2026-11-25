// Офлайн-кеш оболонки застосунку. Змінюйте VERSION після кожного оновлення файлів.
const VERSION = 'yizhak-v6';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/ui.js', 'js/store.js', 'js/local.js', 'js/remote.js', 'js/config.js', 'js/tour.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Свої файли: спершу мережа (щоб оновлення приходили одразу), без мережі — кеш.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
