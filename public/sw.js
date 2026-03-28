// Service Worker for PWA and Monetag verification
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Standard fetch handler
  event.respondWith(fetch(event.request));
});
