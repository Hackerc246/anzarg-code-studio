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
  './icon-512.png',
  './anzarg-apstore.png'
];

// External library bundles (100% Offline UI, Icons, ZIP, Cropper & Highlighting Guard)
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js',
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&family=Roboto+Mono:wght@400;500&display=swap'
];

// Install: Fresh assets cache karein (With Redirect & Opaque Guard)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const localUrl of LOCAL_ASSETS) {
        try {
          await cache.add(localUrl);
        } catch (err) {
          console.warn('Local asset caching warning:', localUrl);
        }
      }

      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors', redirect: 'follow' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.type === 'opaque')) {
            await cache.put(url, res.clone());
          }
        } catch (e) {
          try {
            const noCorsReq = new Request(url, { mode: 'no-cors' });
            const noCorsRes = await fetch(noCorsReq);
            if (noCorsRes) await cache.put(url, noCorsRes.clone());
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

// Fetch Interceptor: 100% Offline-First Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Live AI API calls ko cache se bypass rakhein
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('generateContent')) return;
  if (url.hostname.includes('workers.dev')) return;

  const isSameOrigin = url.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: isSameOrigin }).then(async (cachedResponse) => {
      // Fallback exact URL string match for redirected CDN assets
      const finalCached = cachedResponse || (await caches.match(event.request.url));

      if (finalCached) {
        // Background silent refresh jab internet chalu ho
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return finalCached;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      } catch (err) {
        const isNav = event.request.mode === 'navigate' || 
                      (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
        if (isNav) {
          return (await caches.match('./', { ignoreSearch: true })) || 
                 (await caches.match('./index.html', { ignoreSearch: true }));
        }
        // Safe empty response taaki offline me browser console error na feke
        return new Response('', { status: 200, statusText: 'Offline Guard Active' });
      }
    })
  );
});