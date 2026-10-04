// Minimal service worker so the POS page meets installability
// requirements (manifest + SW with a fetch handler). No offline
// caching yet - network-first passthrough is enough to make Chrome/Edge
// offer "Install Ethasfish POS" as a standalone desktop app.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
