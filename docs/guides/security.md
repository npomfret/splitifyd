# Security

## Core Principle

**Zero-trust client.** All security enforcement happens server-side. The client's only security responsibility is sending the auth token.

---

## Server-Side (Authoritative)

### Three Defense Layers

1. **Authentication Middleware** - Verifies Firebase ID token on every request, attaches `req.user`
2. **Authorization Checks** - `PermissionEngineAsync.checkPermission()` evaluates group permissions
3. **Firestore Security Rules** - Data-layer defense for direct Firestore access

### Auth Middleware (`firebase/functions/src/auth/middleware.ts`)

| Middleware | Requires |
|------------|----------|
| `authenticate` | Valid Firebase ID token |
| `authenticateAdmin` | `system_admin` role |
| `authenticateTenantAdmin` | `tenant_admin` or higher |

### Request Flow

```
Request → authenticate (verify token) → handler → getGroupAccessContext() → checkPermission() → execute or 403
```

### Input Validation & Sanitization

- All request bodies validated with Zod schemas before processing
- Query params validated explicitly - no silent defaults
- User-provided strings sanitized via `sanitizeString()` (uses `xss` library)
- `checkForDangerousPatterns()` blocks XSS attempts, prototype pollution, dangerous HTML
- See `docs/guides/validation.md`

### Trust Boundaries

- **Trust** internal data (from our own services)
- **Never trust** external data (user input, API responses from third parties)

---

## Client-Side (UI Only)

### What the Client Does

- Sends ID token with every API request (via `ApiClient`)
- Mirrors permission logic for UI visibility (`permissionsStore`)
- Redirects unauthenticated users (`ProtectedRoute`)

### What the Client Does NOT Do

- Make authorization decisions
- Enforce access control
- Trust its own permission calculations (always defers to 403 from server)

---

## Security Headers (`middleware/security-headers.ts`)

Applied to all API responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Browser XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary APIs |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS (configurable) |
| `Content-Security-Policy` | From config | XSS prevention |

CORS: Allows credentialed requests from any origin (Firebase Hosting handles domain restriction).

---

## Client-Side CSP

- Never use inline handlers (`onclick=...`)
- Attach event listeners via `addEventListener()` in JS
- All styles via Tailwind classes, never inline `style={}`
- Preact/JSX auto-escapes output (XSS-safe by default)

---

## Sensitive Data

- Never commit secrets to git (`.env` files, API keys, service account keys)
- Service account key location: `firebase/service-account-key.json` (gitignored)
- Environment configs: `firebase/functions/.env.instance*` (gitignored)

---

## Key Files

| Purpose | Location |
|---------|----------|
| Auth middleware | `firebase/functions/src/auth/middleware.ts` |
| Permission engine | `firebase/functions/src/permissions/permission-engine-async.ts` |
| Security headers | `firebase/functions/src/middleware/security-headers.ts` |
| XSS/sanitization | `firebase/functions/src/utils/security.ts` |
| Firestore rules | `firebase/firestore.rules` |
| Client auth store | `webapp-v2/src/app/stores/auth-store.ts` |
| Client permissions | `webapp-v2/src/stores/permissions-store.ts` |

---

## See Also

- `docs/guides/roles-and-authorization.md` - Role types and group permission settings
- `docs/guides/validation.md` - Input validation patterns
