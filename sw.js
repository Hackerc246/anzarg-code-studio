const CACHE_NAME = 'anzarg-studio-v9';

// Core essential local assets jo app chalane ke liye zaroori hain
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// External CDN dependencies
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,400;0,500;1,400&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Step 1: Local assets ko guaranteed add karein
      await cache.addAll(LOCAL_ASSETS).catch((err) => {
        console.warn('Local assets cache error:', err);
      });

      // Step 2: External CDNs ko gracefully cache karein (agar network issue ho toh fail na ho)
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            await cache.put(req, res);
          }
        } catch (e) {
          console.warn('External asset caching warning for:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Chrome extensions aur non-http protocols ko bypass karein
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache-First with Background Update Strategy
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Network se fetch karein aur runtime par dynamic cache karein (Fonts & Icons included)
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline navigation fallback
          if (event.request.mode === 'navigate') {
            const fallback = await caches.match('./', { ignoreSearch: true }) || await caches.match('./index.html', { ignoreSearch: true });
            if (fallback) return fallback;
          }
        });
    })
  );
});