// ─────────────────────────────────────────────────────────────────────────────
// JEEVAN Service Worker — Offline-First Cache Strategy
//
// HOW IT WORKS:
// 1. On first load (online), this SW caches ALL static files (HTML, CSS, JS)
// 2. On every subsequent request, it serves from CACHE FIRST
// 3. If the cache has no match AND network is available → fetch from network
// 4. If completely offline → serve from cache (app works fully offline)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'jeevan-v2';

// All static assets to pre-cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/logo.png',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500&display=swap'
];

// ── INSTALL: cache all static assets immediately ──────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing and pre-caching static assets...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            console.log('[SW] All assets cached. App is now offline-capable.');
            // Take control of all pages immediately (don't wait for refresh)
            return self.skipWaiting();
        })
    );
});

// ── ACTIVATE: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new service worker...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ── FETCH: Cache-First strategy ───────────────────────────────────────────────
// For API calls (/api/*): Network first, fall back to nothing (data is in localStorage)
// For static assets: Cache first, then network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API requests: always try network first (data comes from localStorage anyway)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Offline: return a simple offline JSON response
                return new Response(
                    JSON.stringify({ error: 'offline', message: 'No network connection. Data is available locally.' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // Static assets: cache-first
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Serve from cache (works fully offline)
                return cachedResponse;
            }

            // Not in cache → fetch from network and store in cache
            return fetch(event.request).then((networkResponse) => {
                // Only cache successful GET requests
                if (event.request.method === 'GET' && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Both cache and network failed
                // For HTML navigations, serve the cached index.html (SPA fallback)
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
