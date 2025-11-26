const CACHE_NAME='habits-v1.04';const FILES=["./","./index.html","./style.css","./app.js","./manifest.json"];
self.addEventListener('install',evt=>{evt.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',evt=>{evt.waitUntil(self.clients.claim())});
self.addEventListener('fetch',evt=>{evt.respondWith(caches.match(evt.request).then(r=>r||fetch(evt.request)))});