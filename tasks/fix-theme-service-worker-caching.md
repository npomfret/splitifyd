# Fix Theme Service Worker Caching

## Problem

When tenant theme settings are updated (e.g., colors changed via admin), users don't see the new theme until they manually unregister the service worker. A hard refresh alone doesn't work.

## Root Cause Analysis

The current `theme-sw.js` uses a "network-first with cache fallback" strategy:

```js
self.addEventListener('fetch', (event) => {
    // ...
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                const networkResponse = await fetch(request);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cached = await cache.match(request);
                if (cached) return cached;
                throw error;
            }
        }),
    );
});
```

**Issues identified:**

1. **Cache key includes query string**: `cache.put(request, ...)` uses the full URL (`/api/theme.css?v=abc123`) as the key. Different hashes = different cache entries = old entries never cleaned up.

2. **Stale tabs**: If a user has an old tab open, the SW may serve from its in-memory state or an old cache entry before the new hash propagates.

3. **No cache invalidation**: When a new theme hash arrives, old cached entries for previous hashes are never deleted.

4. **Race condition**: The SW's `fetch` handler runs before the page's `syncThemeHash()` updates the `<link>` href, so the first request may use the old URL.

## Proposed Solution

### Option A: Simplify - Remove theme service worker entirely

The service worker only provides offline caching for theme CSS. Given that:
- Theme CSS is small (~5-10KB)
- It's fetched once per page load
- The hash-versioned URL (`?v=hash`) already enables long browser caching
- The SW causes more problems than it solves

**Recommendation**: Delete `theme-sw.js` and remove its registration.

### Option B: Fix the service worker

If offline theme support is required:

1. **Normalize cache key**: Strip the `?v=` query param when caching, so all theme versions share one cache slot that gets overwritten:

```js
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname !== '/api/theme.css') return;

    // Always fetch fresh, cache for offline only
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const cache = caches.open(CACHE_NAME);
                // Cache with normalized key (no query string)
                const cacheKey = new Request(url.origin + url.pathname);
                cache.then(c => c.put(cacheKey, response.clone()));
                return response;
            })
            .catch(() => {
                // Offline fallback - use normalized key
                const cacheKey = new Request(url.origin + url.pathname);
                return caches.match(cacheKey);
            })
    );
});
```

2. **Bump cache version**: Change `CACHE_NAME` to `tenant-theme-v2` to clear old caches.

3. **Force SW update on deploy**: Ensure the SW file changes (e.g., version comment) so browsers fetch the new version.

## Recommendation

**Go with Option A** - remove the service worker. The complexity isn't worth it for caching a small CSS file that's already browser-cacheable via the `?v=hash` URL pattern.

## Files to Modify

| File | Change |
|------|--------|
| `webapp-v2/public/theme-sw.js` | Delete |
| `webapp-v2/src/utils/theme-bootstrap.ts` | Remove `registerThemeServiceWorker()` function and its call |
| `webapp-v2/src/index.tsx` or `App.tsx` | Remove SW registration call if present elsewhere |

## Testing

1. Deploy change
2. Users with existing SW will need one more manual unregister (unavoidable for existing installs)
3. New users / after unregister: theme changes should apply on normal page refresh

## Future Consideration

If offline theme support becomes important later, implement Option B with proper cache key normalization.
