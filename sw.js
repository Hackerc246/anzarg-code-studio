// ===================================================================================
//   ANZARG CODE STUDIO - ULTRA RESILIENT OFFLINE SERVICE WORKER
//   Copyright (c) 2026 Mohammed Anzar / ANZARG. All Rights Reserved.
//   Version: Production Shield Master (Zero-Crash • Dual Guard Architecture)
// ===================================================================================

// Dynamic Version Query Parameter (?v=X.X) se bind karega
const swUrl = new URL(location);
const dynamicVer = swUrl.searchParams.get('v') || '7.9';
const CACHE_NAME = `anzarg-studio-v${dynamicVer}`;

// 1. Local Core Static Shell
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 2. External Essential CDN Dependencies (Offline Pre-cache targets)
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

// INSTALL EVENT: Core Shell & External Dependencies ko cache mein store karna
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Local Assets Cache
      for (const localUrl of LOCAL_ASSETS) {
        try {
          await cache.add(localUrl);
        } catch (err) {
          console.warn('[SW Install] Local asset bypass/warning:', localUrl);
        }
      }

      // External CDN Assets Cache (CORS & No-CORS Safety Guard)
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

// ACTIVATE EVENT: Purane out-of-date caches ko hatana par active version ko protect karna
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW Activate] Purana version cache safely cleaned:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ===================================================================================
// SMART FACTORY RESET & CACHE SHIELD GUARD
// ===================================================================================
self.addEventListener('message', (event) => {
  if (event.data && (event.data.action === 'CLEAR_ALL_CACHES' || event.data.action === 'SAFE_USER_RESET')) {
    event.waitUntil(
      caches.keys().then(async (keys) => {
        for (const key of keys) {
          // GUARD: Active App Engine Cache ko delete hone se 100% bachayega
          if (key === CACHE_NAME) {
            console.log('[SW Cache Shield Active]: App Core Engine Protected from Deletion ->', key);
            continue; 
          }
          // Sirf purane ya orphan caches ko purge karega
          await caches.delete(key);
        }
      }).then(() => {
        if (event.source && event.source.postMessage) {
          event.source.postMessage({ action: 'CACHES_CLEARED_SUCCESS' });
        }
      })
    );
  }
});

// ===================================================================================
// FETCH INTERCEPTOR: ZERO-CRASH & SILENT AUTO-HEALING ENGINE
// ===================================================================================
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Live AI APIs aur Worker proxy calls ko offline cache se bypass rakhein
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('generateContent')) return;
  if (url.hostname.includes('workers.dev')) return;

  const isSameOrigin = url.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: isSameOrigin }).then(async (cachedResponse) => {
      // Direct string URL fallback match (Redirected CDNs ke liye)
      const finalCached = cachedResponse || (await caches.match(event.request.url));

      // CASE 1: Agar asset local cache mein maujood hai
      if (finalCached) {
        // Silent Background Auto-Healing (Jab internet active ho toh silent update karega)
        if (navigator.onLine) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
        }
        return finalCached;
      }

      // CASE 2: Agar cache mein nahi mila toh network se mangwayega
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
        // CASE 3: COMPLETE OFFLINE GUARD (ERR_FAILED crash ko 100% rokna)
        const isNav = event.request.mode === 'navigate' || 
                      (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));
        
        if (isNav) {
          const fallbackShell = (await caches.match('./', { ignoreSearch: true })) || 
                                (await caches.match('./index.html', { ignoreSearch: true }));
          if (fallbackShell) return fallbackShell;
        }

        // Kisi script ya asset ke fail hone par blank safe response taaki white/black screen na aaye
        return new Response('/* Offline Guard Active */', { 
          status: 200, 
          statusText: 'Offline Guard Active',
          headers: { 'Content-Type': 'text/javascript' }
        });
      }
    })
  );
});