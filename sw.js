// sw.js - simple versioned cache with conservative strategy
const CACHE_NAME = 'prado-schedule-v1';
const ASSETS = ['/','/index.html','/app.css','/app.js','/rules.js','/storage.js','/manifest.json'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // network-first for HTML
  if (req.mode === 'navigate' || req.headers.get('accept').includes('text/html')) {
    event.respondWith(fetch(req).then(resp => {
      const copy = resp.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)); return resp;
    }).catch(() => caches.match(req)));
    return;
  }
  // stale-while-revalidate for static assets
  event.respondWith(caches.match(req).then(cached => {
    const network = fetch(req).then(resp => { caches.open(CACHE_NAME).then(cache => cache.put(req, resp.clone())); return resp; }).catch(()=>{});
    return cached || network;
  }));
});
