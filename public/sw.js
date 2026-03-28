// Standard Service Worker for PWA functionality and Monetag Verification
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Add caching strategies here if needed for offline play
  event.respondWith(fetch(event.request));
});
