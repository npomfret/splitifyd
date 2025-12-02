# Task: Consolidate Cache Header Configuration

**Status: Complete**

## Goal
Centralize all cache header durations into environment-aware configuration via `.env` files.

## Design

All cache durations are configured in `.env` files with the pattern `__CACHE_PATH_*` for path-based caching and `__CACHE_THEME_*` for theme CSS. Paths not in the config get `no-cache` headers.

### Configuration Structure

```typescript
interface CacheConfig {
    paths: Record<string, number>;  // path -> max-age in seconds
    themeVersioned: number;         // theme.css with ?v= query param
    themeUnversioned: number;       // theme.css without version (0 = no-cache)
}
```

### Environment Variables

| Variable | Description | Dev Value | Prod Value |
|----------|-------------|-----------|------------|
| `__CACHE_PATH_HOME` | `/` home page | 300 | 300 |
| `__CACHE_PATH_LOGIN` | `/login` page | 300 | 300 |
| `__CACHE_PATH_TERMS` | `/terms` page | 300 | 3600 |
| `__CACHE_PATH_PRIVACY` | `/privacy` page | 300 | 3600 |
| `__CACHE_PATH_API_CONFIG` | `/api/config` endpoint | 60 | 300 |
| `__CACHE_THEME_VERSIONED` | `theme.css?v=hash` | 300 | 31536000 |
| `__CACHE_THEME_UNVERSIONED` | `theme.css` (no version) | 0 | 0 |

### Behavior

- **Paths in config**: `Cache-Control: public, max-age={value}`
- **Paths not in config**: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- **Theme versioned**: `Cache-Control: public, max-age={value}, immutable`
- **Theme unversioned**: `Cache-Control: no-cache` when value is 0, otherwise `public, max-age={value}`

## Files Modified

| File | Change |
|------|--------|
| `firebase/functions/src/app-config.ts` | Added `CacheConfig` interface, env vars in schema |
| `firebase/functions/src/ApplicationFactory.ts` | Uses `cache.paths['/api/config']` |
| `firebase/functions/src/middleware/cache-control.ts` | Uses `cache.paths[req.path]` |
| `firebase/functions/src/theme/ThemeHandlers.ts` | Uses `cache.themeVersioned` / `cache.themeUnversioned` |
| `firebase/functions/.env.instance*` | Added cache configuration variables |
| `firebase/functions/.env.*.example` | Added cache configuration variables |
