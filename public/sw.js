// Standard Service Worker for PWA and Monetag Verification
self.addEventListener('install', function(event) {
  console.log('SW installed');
});

self.addEventListener('fetch', function(event) {
  // Simple pass-through fetch handler
});
