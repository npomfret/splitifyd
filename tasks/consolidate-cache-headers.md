# Task: Consolidate Cache Header Configuration

## Goal
Centralize all cache header durations into environment-aware configuration, following existing patterns in `app-config.ts`.

## Current State
Cache durations are scattered and inconsistent:
- `cacheMaxAgeSeconds` - already in config (60s dev / 300s prod)
- `staticPageCacheSeconds` - already in config, per-path
- Theme CSS versioned - hardcoded 31536000 (1 year) in `ThemeHandlers.ts`
- Theme CSS unversioned - hardcoded `no-cache` in `ThemeHandlers.ts`
- API endpoints - hardcoded `no-store, no-cache...` in `cache-control.ts` (keep as-is)

## Proposed Changes

### 1. Add env vars to Zod schema in `app-config.ts`

Add optional cache override variables to `envSchema`:

```typescript
// Cache overrides (optional - defaults applied based on environment)
__CACHE_API_CONFIG_MAX_AGE: z.coerce.number().optional(),
__CACHE_THEME_VERSIONED_MAX_AGE: z.coerce.number().optional(),
__CACHE_THEME_UNVERSIONED_MAX_AGE: z.coerce.number().optional(),
__CACHE_STATIC_HOME_MAX_AGE: z.coerce.number().optional(),
__CACHE_STATIC_LOGIN_MAX_AGE: z.coerce.number().optional(),
__CACHE_STATIC_TERMS_MAX_AGE: z.coerce.number().optional(),
__CACHE_STATIC_PRIVACY_MAX_AGE: z.coerce.number().optional(),
__CACHE_STATIC_CONFIG_MAX_AGE: z.coerce.number().optional(),
```

### 2. Extend `AppConfig` interface in `app-config.ts`

Replace scattered cache fields with a unified cache configuration section:

```typescript
interface CacheConfig {
    apiConfigMaxAge: number;           // Current cacheMaxAgeSeconds
    staticPages: Record<string, number>; // Current staticPageCacheSeconds
    themeVersionedMaxAge: number;      // New: versioned theme.css (31536000 default)
    themeUnversionedMaxAge: number;    // New: unversioned theme.css (0 = no-cache)
}
```

Update `AppConfig`:
```typescript
interface AppConfig {
    // ... existing fields ...
    cache: CacheConfig;  // replaces cacheMaxAgeSeconds and staticPageCacheSeconds
    // ... rest of fields ...
}
```

### 3. Update `buildConfig()` in `app-config.ts`

Replace scattered cache values with unified `cache` object, with env overrides:

```typescript
cache: {
    apiConfigMaxAge: env.__CACHE_API_CONFIG_MAX_AGE ?? (emulator ? 60 : 300),
    staticPages: {
        '/': env.__CACHE_STATIC_HOME_MAX_AGE ?? 300,
        '/login': env.__CACHE_STATIC_LOGIN_MAX_AGE ?? 300,
        '/terms': env.__CACHE_STATIC_TERMS_MAX_AGE ?? (emulator ? 300 : 3600),
        '/privacy': env.__CACHE_STATIC_PRIVACY_MAX_AGE ?? (emulator ? 300 : 3600),
        '/config': env.__CACHE_STATIC_CONFIG_MAX_AGE ?? (emulator ? 300 : 3600),
    },
    themeVersionedMaxAge: env.__CACHE_THEME_VERSIONED_MAX_AGE ?? (emulator ? 300 : 31536000),
    themeUnversionedMaxAge: env.__CACHE_THEME_UNVERSIONED_MAX_AGE ?? 0,  // 0 = no-cache
}
```

### 4. Update consumers

**`ApplicationFactory.ts`** (~line 107):
```typescript
// Before
res.setHeader('Cache-Control', `public, max-age=${serverConfig.cacheMaxAgeSeconds}, must-revalidate`);
// After
res.setHeader('Cache-Control', `public, max-age=${serverConfig.cache.apiConfigMaxAge}, must-revalidate`);
```

**`cache-control.ts`** (~line 20):
```typescript
// Before
const maxAge = config.staticPageCacheSeconds[req.path];
// After
const maxAge = config.cache.staticPages[req.path];
```

**`ThemeHandlers.ts`** (~lines 39, 42):
```typescript
// Before
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
res.setHeader('Cache-Control', 'no-cache');

// After
import { getAppConfig } from '../app-config';

const config = getAppConfig();
if (requestedVersion) {
    res.setHeader('Cache-Control', `public, max-age=${config.cache.themeVersionedMaxAge}, immutable`);
} else {
    const maxAge = config.cache.themeUnversionedMaxAge;
    res.setHeader('Cache-Control', maxAge > 0 ? `public, max-age=${maxAge}` : 'no-cache');
}
```

### 5. Keep API no-cache hardcoded

The `no-store, no-cache, must-revalidate, proxy-revalidate` for API endpoints in `cache-control.ts` stays hardcoded - this is intentional for security/correctness.

## Files to Modify

| File | Change |
|------|--------|
| `firebase/functions/src/app-config.ts` | Add env vars to schema, `CacheConfig` interface, restructure cache values |
| `firebase/functions/src/ApplicationFactory.ts` | Update to use `cache.apiConfigMaxAge` |
| `firebase/functions/src/middleware/cache-control.ts` | Update to use `cache.staticPages` |
| `firebase/functions/src/theme/ThemeHandlers.ts` | Use config for theme cache durations |

## Available .env Overrides (all optional)

| Variable | Default (emulator) | Default (prod) |
|----------|-------------------|----------------|
| `__CACHE_API_CONFIG_MAX_AGE` | 60 | 300 |
| `__CACHE_THEME_VERSIONED_MAX_AGE` | 300 | 31536000 |
| `__CACHE_THEME_UNVERSIONED_MAX_AGE` | 0 | 0 |
| `__CACHE_STATIC_HOME_MAX_AGE` | 300 | 300 |
| `__CACHE_STATIC_LOGIN_MAX_AGE` | 300 | 300 |
| `__CACHE_STATIC_TERMS_MAX_AGE` | 300 | 3600 |
| `__CACHE_STATIC_PRIVACY_MAX_AGE` | 300 | 3600 |
| `__CACHE_STATIC_CONFIG_MAX_AGE` | 300 | 3600 |

## Benefits
- Single source of truth for all cache durations
- Environment-aware (dev vs prod) defaults
- Per-instance override via .env when needed
- Maintains security: API endpoints stay no-cache
