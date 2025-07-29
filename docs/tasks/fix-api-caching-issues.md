# Fix API Caching Issues

## Problem Description

Users are experiencing stale data after making changes (e.g., creating expenses) and need to perform a hard refresh to see updates. This is unacceptable in any environment, but especially problematic during development.

### Root Cause

1. **Express.js default behavior**: Express automatically adds ETags to responses when no cache headers are explicitly set
2. **Browser behavior**: The browser caches responses with ETags and sends `If-None-Match` headers on subsequent requests
3. **Missing cache control headers**: Our API endpoints don't explicitly set cache control headers, allowing Express's default caching behavior

### Evidence

From the curl command in the user's request:
```
-H 'If-None-Match: W/"1128-fSqZrwMQuBAXi1HRY9VAr2evedg"'
```

This shows the browser is sending an ETag from a previous response, causing the server to return a 304 Not Modified instead of fresh data.

## Solution

### 1. Disable Caching in Development

Add middleware to set no-cache headers for all API responses in development:

```typescript
// In firebase/functions/src/index.ts, after other middleware setup
if (getConfig().isDevelopment) {
  app.use((req, res, next) => {
    // Check if this is a static page that can have minimal caching
    const staticPaths = ['/login', '/', '/terms', '/privacy'];
    const isStaticPage = staticPaths.includes(req.path);
    
    if (isStaticPage) {
      // Allow minimal caching for static pages even in dev
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    } else {
      // Disable all caching for API endpoints
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });
}
```

### 2. Smart Caching in Production

For production, implement intelligent caching:

- **Static pages** (/login, /, /terms, /privacy): Can be cached (5-60 minutes)
- **API endpoints** (/api/*): NO caching - all dynamic data must be fresh
- **Write operations** (POST, PUT, DELETE): Never cache

```typescript
// Middleware for production caching
app.use((req, res, next) => {
  const staticPages = {
    '/': 'public, max-age=300', // 5 minutes
    '/login': 'public, max-age=300', // 5 minutes  
    '/terms': 'public, max-age=3600', // 1 hour
    '/privacy': 'public, max-age=3600', // 1 hour
  };
  
  if (staticPages[req.path]) {
    // Static pages can be cached
    res.setHeader('Cache-Control', staticPages[req.path]);
  } else if (req.path.startsWith('/api/')) {
    // API endpoints should NEVER be cached
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
```

### 3. Client-Side Cache Busting

Update the API client to add cache-busting for critical requests:

```typescript
// In webapp-v2/src/app/apiClient.ts
const fetchOptions: RequestInit = {
  method: options.method,
  headers: {
    'Content-Type': 'application/json',
    // Add cache control for mutations
    ...(options.method !== 'GET' ? { 'Cache-Control': 'no-cache' } : {}),
    ...getAuthHeaders(),
    ...options.headers,
  },
  // Force cache reload for mutations
  ...(options.method !== 'GET' ? { cache: 'no-store' } : {}),
};
```

### 4. Invalidate Related Queries

When mutations occur, invalidate related cached data:

```typescript
// In groups store after creating expense
async createExpense(expense: CreateExpenseRequest) {
  const result = await apiClient.expenses.create(expense);
  // Force refresh of group data
  await this.fetchGroups();
  return result;
}
```

## Testing

### Manual Testing
1. Create a group
2. Add an expense
3. Verify the group's expense count updates immediately without refresh
4. Check Network tab to ensure no 304 responses for API calls

### Integration Tests
Add integration tests for EVERY endpoint to verify correct cache headers:

```typescript
// Example test structure for firebase/functions/__tests__/integration/cache-headers.test.ts
describe('Cache Headers', () => {
  // Test all API endpoints
  const endpoints = [
    { method: 'GET', path: '/api/groups', expectedCache: 'no-store' },
    { method: 'POST', path: '/api/groups', expectedCache: 'no-store' },
    { method: 'GET', path: '/api/expenses/group', expectedCache: 'no-store' },
    { method: 'POST', path: '/api/expenses', expectedCache: 'no-store' },
    { method: 'GET', path: '/api/config', expectedCache: 'no-store' },
    // ... add ALL endpoints
  ];

  endpoints.forEach(({ method, path, expectedCache }) => {
    it(`should have correct cache headers for ${method} ${path}`, async () => {
      const response = await request(app)[method.toLowerCase()](path);
      
      expect(response.headers['cache-control']).toBe(expectedCache);
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });
  
  // Test static pages (these can have minimal caching even in dev)
  const staticPages = [
    { path: '/login', cacheControl: 'public, max-age=300' }, // 5 minutes
    { path: '/', cacheControl: 'public, max-age=300' }, // landing page
    { path: '/terms', cacheControl: 'public, max-age=3600' }, // 1 hour
    { path: '/privacy', cacheControl: 'public, max-age=3600' }, // 1 hour
  ];
  
  staticPages.forEach(({ path, cacheControl }) => {
    it(`should allow minimal caching for static page ${path}`, async () => {
      const response = await request(app).get(path);
      expect(response.headers['cache-control']).toBe(cacheControl);
    });
  });
});

## Priority

**HIGH** - This affects user experience and developer productivity

## Acceptance Criteria

- [ ] No hard refresh required after any data mutation
- [ ] API endpoints have NO caching in any environment
- [ ] Static pages (login, landing, terms, privacy) have minimal caching even in dev
- [ ] Integration tests exist for EVERY endpoint verifying correct cache headers
- [ ] Client automatically refreshes stale data after mutations
- [ ] No ETags are sent by Express for API responses