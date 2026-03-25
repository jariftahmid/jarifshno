// Monetag Service Worker for Vignette and Push Notifications
importScripts('https://izcle.com/vignette.min.js?zone=10782652');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});