self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Basic fetch handler for PWA requirements
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});