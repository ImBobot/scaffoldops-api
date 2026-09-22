// ScaffoldOps NZ — service worker
// Caches the static app shell so the dashboard opens instantly and installs
// as a PWA. API calls always go to the network — data must stay live.
const CACHE = 'scaffoldops-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/favicon-32.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API responses — always hit the network, and fail loudly
  // (as JSON) if there's no connection, so the UI can show a real error
  // instead of silently serving stale data.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline — no connection to the server' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  // App shell: cache-first, falling back to network, falling back to
  // whatever's cached if the network is unreachable.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
