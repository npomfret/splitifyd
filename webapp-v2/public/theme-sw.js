const CACHE_NAME = 'tenant-theme-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                    return undefined;
                }),
            ),
        ).then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/theme.css') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                const networkResponse = await fetch(request);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cached = await cache.match(request);
                if (cached) {
                    return cached;
                }
                throw error;
            }
        }),
    );
});
