# Tenant-Specific Open Graph Tags for Share Links

## Problem

When users share invite links on WhatsApp (or other social platforms), the preview looks bad - showing a generic PNG icon instead of a rich branded preview.

**Root cause:** This is a client-rendered SPA. Social media crawlers don't execute JavaScript, so they see the static `index.html` without any OG tags. The `SEOHead` component sets tags client-side, which crawlers never see.

## Requirements

1. Share link previews must show tenant-specific branding
2. Each tenant needs configurable OG metadata (image, title, description)
3. The `/join` page (and potentially other shareable URLs) must serve proper OG tags server-side
4. Human users must still get the full SPA experience (no redirect flash)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Build Phase                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. webapp-v2 build → dist/index.html (with hashed assets)      │
│ 2. Deploy script copies index.html → functions/sharing/        │
│ 3. Functions deploy includes the template                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Runtime (Request to /join)                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Firebase Hosting rewrite → Cloud Function                    │
│ 2. Function resolves tenant from Host header                    │
│ 3. Function reads cached template (from disk, loaded once)      │
│ 4. Function builds OG tags from tenant config + route           │
│ 5. Function injects OG tags into <head>                         │
│ 6. Function returns HTML with Vary: Host header                 │
│                                                                 │
│ Result: Crawler sees OG tags, human sees full SPA               │
└─────────────────────────────────────────────────────────────────┘
```

**Why this approach:**

| Principle | How it's satisfied |
|-----------|-------------------|
| Single source of truth | One `index.html`, copied at deploy time |
| No runtime dependencies | Template is local to Function, no network fetch |
| Tenant isolation | Host-based resolution, `Vary: Host` caching |
| Type safety | Zod-validated tenant `sharing` config |
| Security | HTML-escape all injected values |
| Extensibility | Generic handler, easy to add `/receipt/:id`, `/pay`, etc. |
| Testability | OG generation logic can be unit tested |
| Cache efficiency | Short TTL + ETag based on template + tenant config |

## Solution

### 1. Extend Tenant Config

Add a `sharing` section to `tokens` in tenant config:

```json
{
  "tokens": {
    "sharing": {
      "ogImage": "https://storage.googleapis.com/.../og-share-image.png",
      "defaultTitle": "{appName}",
      "defaultDescription": "Split bills easily with friends and family"
    }
  }
}
```

**Fallback chain:**
- `tokens.sharing.ogImage` → `tokens.assets.ogImage` → global default OG image
- `tokens.sharing.defaultTitle` → `tokens.legal.appName`
- `tokens.sharing.defaultDescription` → hardcoded default

**OG Image requirements:**
- Recommended size: 1200x630px (Facebook/LinkedIn optimized)
- Format: PNG or JPG
- Must be publicly accessible URL (not behind auth)
- Each tenant uploads their own branded image

### 2. Build Pipeline Changes

**Add to webapp-v2 build or deploy script:**

```bash
# After webapp build, copy index.html to functions
cp webapp-v2/dist/index.html firebase/functions/src/sharing/index-template.html
```

This ensures the Function always has the correct template with current asset hashes.

### 3. Create Sharing Handler

New file: `firebase/functions/src/sharing/SharingHandlers.ts`

```typescript
class SharingHandlers {
  private template: string;  // Loaded once at cold start

  constructor(private tenantRegistry: TenantRegistryService) {
    this.template = fs.readFileSync(
      path.join(__dirname, 'index-template.html'),
      'utf-8'
    );
  }

  async serveShareablePage(req: Request, res: Response) {
    const tenant = await this.tenantRegistry.resolveTenant(req);
    const route = this.determineRoute(req.path);

    const ogTags = this.buildOgTags({
      tenant,
      route,
      url: this.buildCanonicalUrl(req),
    });

    const html = this.injectOgTags(this.template, ogTags);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Vary', 'Host');
    res.setHeader('Cache-Control', 'public, max-age=300');  // 5 min
    res.send(html);
  }

  private buildOgTags({ tenant, route, url }): OgTagSet {
    const appName = tenant.tokens.legal.appName;
    const sharing = tenant.tokens.sharing ?? {};

    return {
      title: this.getTitleForRoute(route, appName, sharing),
      description: sharing.defaultDescription ?? 'Split bills with friends',
      image: sharing.ogImage ?? tenant.tokens.assets?.ogImage ?? DEFAULT_OG_IMAGE,
      url,
      siteName: appName,
    };
  }

  private getTitleForRoute(route: string, appName: string, sharing: SharingConfig): string {
    // Route-specific titles
    switch (route) {
      case 'join':
        return `Join a group on ${appName}`;
      case 'receipt':
        return `View receipt on ${appName}`;
      default:
        return sharing.defaultTitle?.replace('{appName}', appName) ?? appName;
    }
  }

  private injectOgTags(template: string, tags: OgTagSet): string {
    const metaTags = `
    <!-- Open Graph -->
    <meta property="og:title" content="${escapeHtml(tags.title)}" />
    <meta property="og:description" content="${escapeHtml(tags.description)}" />
    <meta property="og:image" content="${escapeHtml(tags.image)}" />
    <meta property="og:url" content="${escapeHtml(tags.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(tags.siteName)}" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(tags.title)}" />
    <meta name="twitter:description" content="${escapeHtml(tags.description)}" />
    <meta name="twitter:image" content="${escapeHtml(tags.image)}" />
    `;

    return template.replace('</head>', `${metaTags}</head>`);
  }

  private buildCanonicalUrl(req: Request): string {
    const protocol = 'https';  // Always https for canonical
    const host = req.hostname;
    const path = req.originalUrl;  // Includes query params
    return `${protocol}://${host}${path}`;
  }

  private determineRoute(path: string): string {
    if (path.startsWith('/join')) return 'join';
    if (path.startsWith('/receipt')) return 'receipt';
    return 'default';
  }
}
```

### 4. Update Firebase Hosting Rewrites

In `firebase.json` (or the template that generates it):

```json
{
  "rewrites": [
    { "source": "/api/**", "function": { "functionId": "api", "region": "us-central1" } },
    { "source": "/join", "function": { "functionId": "api", "region": "us-central1" } },
    { "source": "/join/**", "function": { "functionId": "api", "region": "us-central1" } },
    { "source": "**", "destination": "/index.html" }
  ]
}
```

The `/join` rewrites must come BEFORE the catch-all `**`.

### 5. Route Configuration

Add to `firebase/functions/src/routes/route-config.ts`:

```typescript
{
  method: 'get',
  path: '/join',
  handler: (h) => h.sharingHandlers.serveShareablePage,
  middleware: [],  // No auth required - crawlers can't authenticate
}
```

**Note:** This route has NO authentication middleware. Crawlers cannot authenticate, so the page must be accessible without auth. The SPA handles auth after it loads.

## Files to Create/Modify

| File | Change |
|------|--------|
| `firebase/functions/src/sharing/SharingHandlers.ts` | NEW: Handler class |
| `firebase/functions/src/sharing/index-template.html` | NEW: Copied from webapp build |
| `firebase/functions/src/sharing/types.ts` | NEW: OgTagSet, SharingConfig types |
| `firebase/functions/src/schemas/tenant-schemas.ts` | Add `sharing` schema to tenant config |
| `packages/shared/src/shared-types.ts` | Add SharingConfig type |
| `firebase/functions/src/routes/route-config.ts` | Add GET /join route |
| `firebase/functions/src/services/ComponentBuilder.ts` | Wire up SharingHandlers |
| `firebase/functions/src/ApplicationFactory.ts` | Expose sharingHandlers |
| `firebase/scripts/generate-firebase-config.ts` | Add /join rewrite |
| `firebase/docs/tenants/*/config.json` | Add `sharing` section |
| Deploy scripts | Copy index.html to functions |

## Implementation Order

1. Add `sharing` schema to tenant config (Zod + types)
2. Create SharingHandlers with OG tag generation logic
3. Add route configuration (GET /join, no auth)
4. Update firebase.json generator to add rewrite
5. Update build/deploy to copy index.html template
6. Add `sharing` config to test tenants
7. Test with Facebook Sharing Debugger

## Testing

**Manual testing:**
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

**Unit tests:**
- OG tag generation with various tenant configs
- HTML injection (proper escaping)
- Fallback chain behavior
- Route-specific title generation

**Integration tests:**
- Request to /join returns HTML with OG tags
- Different tenants (hosts) get different OG tags
- Vary: Host header is present
- SPA still loads correctly for human users

## Security Considerations

- **HTML escaping:** All tenant-provided values (title, description, image URL) must be escaped before injection
- **URL validation:** ogImage URL should be validated (https, allowed domains)
- **No auth on route:** The /join route has no auth middleware - this is intentional for crawlers
- **CSP headers:** Ensure existing CSP headers are preserved in the response

## Caching Strategy

- `Cache-Control: public, max-age=300` (5 minutes)
- `Vary: Host` - critical for multi-tenant, prevents CDN mixing tenants
- Consider ETag based on: template hash + tenant config hash + route

## Future Extensions

Once this infrastructure is in place, adding new shareable routes is simple:

1. Add rewrite in firebase.json: `{ "source": "/receipt/**", "function": "api" }`
2. Add route in route-config.ts
3. Add case in `getTitleForRoute()` for route-specific title
4. Optionally add dynamic data (e.g., fetch receipt details for title)

## Effort

Medium - requires new handler, schema changes, build pipeline update, and hosting config.
