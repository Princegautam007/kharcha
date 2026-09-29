// Kharcha service worker.
// Saves the app files on the first visit so the app opens without internet.
// Change CACHE_VERSION whenever the list of files below changes.
const CACHE_VERSION = 'kharcha-v1';
const APP_FILES = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Remove caches left over from older versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Pages: try the network first so a new deploy shows up, fall back to cache offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Everything else: use the saved copy, and refresh it in the background.
  event.respondWith(
    caches.match(request).then(saved => {
      const refresh = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => saved);
      return saved || refresh;
    })
  );
});
