// ===================================================================================
//   ANZARG CODE STUDIO - ZERO-TOUCH DYNAMIC SERVICE WORKER
//   Copyright (c) 2026 ANZARG (All Rights Reserved)
// ===================================================================================

// URL Parameter se Dynamic Version auto-read karega (?v=X.X)
const swUrl = new URL(location);
const dynamicVer = swUrl.searchParams.get('v') || '1.0';
const CACHE_NAME = `anzarg-studio-v${dynamicVer}`;

// Local static core files
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// External library bundles
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,400;0,500;1,400&display=swap'
];

// Install: Fresh assets cache karein
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(LOCAL_ASSETS);
      } catch (err) {
        console.warn('Local asset caching warning:', err);
      }

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
            if (noCorsRes) await cache.put(noCorsReq, noCorsRes);
          } catch (err) {}
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: Purane kisi bhi version ka cache turant delete karein
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purana cache deleted:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Reset command listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.source && event.source.postMessage) {
            event.source.postMessage({ action: 'CACHES_CLEARED_SUCCESS' });
          }
        })
    );
  }
});

// Fetch Interceptor: Stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
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

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const isNav = event.request.mode === 'navigate' || 
                        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
          if (isNav) {
            return (await caches.match('./', { ignoreSearch: true })) || 
                   (await caches.match('./index.html', { ignoreSearch: true }));
          }
        });
    })
  );
});