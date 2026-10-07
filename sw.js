// Dynamic Version Extraction from URL parameter (?v=5.1 ya ?v=15)
const swUrl = new URL(location);
const dynamicVer = swUrl.searchParams.get('v') || '15';
const CACHE_NAME = `anzarg-studio-v${dynamicVer}`;

// Core essential local assets jo offline app chalane ke liye zaroori hain
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
      // Step 1: Local assets ko pre-cache karein
      try {
        await cache.addAll(LOCAL_ASSETS);
      } catch (err) {
        console.warn('Local assets cache warning:', err);
      }

      // Step 2: External CDNs ko gracefully pre-cache karein
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            await cache.put(req, res);
          }
        } catch (e) {
          try {
            const noCorsReq = new Request(url, { mode: 'no-cors' });
            const noCorsRes = await fetch(noCorsReq);
            if (noCorsRes) {
              await cache.put(noCorsReq, noCorsRes);
            }
          } catch (err) {
            console.warn('External asset caching warning for:', url);
          }
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
            return caches.delete(key).catch(() => {});
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Sirf GET requests ko intercept karein
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Non-HTTP protocols (chrome-extension:, blob:, data:, about:) ko bypass karein
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache mil gaya: turant return karein aur background me update karein (Stale-While-Revalidate)
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

      // Cache me nahi hai: network se fetch karein aur runtime par dynamic cache karein
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
          // Robust offline navigation fallback (?action=new, ?source=pwa ya direct load)
          const isNav = event.request.mode === 'navigate' || 
                        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
          if (isNav) {
            const fallback = (await caches.match('./', { ignoreSearch: true })) || 
                             (await caches.match('./index.html', { ignoreSearch: true }));
            if (fallback) return fallback;
          }
        });
    })
  );
});