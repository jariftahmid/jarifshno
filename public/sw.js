// Service Worker for Web Uno Arena
// This file is used for PWA features and Monetag verification.

const CACHE_NAME = 'uno-arena-v1';
const ASSETS = [
  '/',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk:wght@700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Monetag verification scripts can be added below if required by their instructions:
// importScripts('https://example.com/monetag-script.js');
