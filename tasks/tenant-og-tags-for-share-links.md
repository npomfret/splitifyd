# Tenant-Specific Open Graph Tags for Share Links

## Problem

When users share invite links on WhatsApp (or other social platforms), the preview looks bad - showing a generic PNG icon instead of a rich branded preview.

**Root cause:** This is a client-rendered SPA. Social media crawlers don't execute JavaScript, so they see the static `index.html` without any OG tags. The `SEOHead` component sets tags client-side, which crawlers never see.

## Requirements

1. Share link previews must show tenant-specific branding
2. Each tenant needs configurable OG metadata (image, title, description)
3. The `/join` page (and potentially other shareable URLs) must serve proper OG tags server-side

## Solution

### 1. Extend Tenant Config

Add a dedicated `sharing` section to tenant config (preferred over nesting inside `tokens.assets` because it’s semantically different from general assets):

```json
{
  "tokens": {
    "assets": {
      "logoUrl": "...",
      "faviconUrl": "...",
      "ogImage": "https://storage.googleapis.com/.../og-share-image.png"
    },
    "sharing": {
      "defaultTitle": "Join me on {appName}",
      "defaultDescription": "Split bills easily with friends and family",
      "ogImage": "https://..."
    }
  }
}
```

**Fallback chain (define explicitly):**
- `tokens.sharing.ogImage` → `tokens.assets.ogImage` → global default OG image
- `tokens.sharing.defaultTitle/defaultDescription` → global defaults

**OG Image requirements:**
- Recommended size: 1200x630px (Facebook/LinkedIn) or 1200x675px (Twitter)
- Format: PNG or JPG
- Must be publicly accessible URL
- Each tenant uploads their own branded image

### 2. Create Server-Side HTML Handler

New handler: `firebase/functions/src/sharing/SharingHandlers.ts`

```typescript
// GET /share/join (or rewrite /join to this)
async serveJoinPage(req, res) {
  // 1. Resolve tenant from domain
  const tenant = await tenantRegistry.resolveTenant(req);

  // 2. Get OG metadata from tenant config
  const ogImage = tenant.tokens.sharing?.ogImage || tenant.tokens.assets?.ogImage || DEFAULT_OG_IMAGE;
  const appName = tenant.tokens.legal.appName;
  const description = tenant.tokens.sharing?.defaultDescription || 'Split bills with friends';

  // 3. Return HTML with OG tags that also loads the SPA
  res.send(generateHtmlWithOgTags({
    title: `Join a group on ${appName}`,
    description,
    image: ogImage,
    url: `https://${req.hostname}/join`,
    // Include all original index.html content for SPA bootstrap
  }));
}
```

**Recommendation: make this generic from day 1**
- Implement a single OG HTML responder that can be used for multiple shareable routes (start with `/join`, but make it easy to add `/pay`, `/receipt/:id`, etc.) rather than one-off handlers per URL.

### 3. Update Firebase Hosting Rewrites

In `firebase.json` (or the template that generates it):

```json
{
  "rewrites": [
    { "source": "/api/**", "function": "api" },
    { "source": "/join", "function": "api" },  // <-- NEW: route /join to function
    { "source": "**", "destination": "/index.html" }
  ]
}
```

The `/join` rewrite must come BEFORE the catch-all `**`.

### 4. Implementation Notes

**HTML Generation:**
- Prefer a minimal server-rendered HTML template (returned by the Function) that:
  - Injects OG + Twitter meta tags into `<head>`
  - Loads the SPA’s JS/CSS from Hosting (so humans still get the SPA)
- Avoid relying on reading `webapp-v2/dist/index.html` directly from the Function at runtime unless the build/deploy pipeline explicitly copies that file into the Functions deploy artifact (it won’t naturally exist in the Functions runtime).

**Meta tags:**
- Always use absolute URLs for `og:image` and `og:url`
- Add Twitter tags (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`) because different platforms prefer different tags
- Consider using `req.originalUrl` (not just `/join`) so the preview URL matches the actual shared link when query params are present

**Caching:**
- Prefer a short TTL rather than blanket `no-cache`
- Ensure caches don’t mix tenants: at minimum consider `Vary: Host` and ensure tenant resolution is based on host/domain only
- (Optional) If you do bot-specific caching, be careful: user-agent sniffing is unreliable and adds complexity

**Security:**
- Escape tenant-provided strings (title/description) before injecting into HTML
- Validate `sharing` config via Zod and avoid “anything goes” strings/URLs

**Testing:**
- Use Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Use Twitter Card Validator: https://cards-dev.twitter.com/validator
- Use LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

## Files to Modify

| File | Change |
|------|--------|
| `firebase/docs/tenants/*/config.json` | Add `sharing` or `assets.ogImage` |
| `packages/shared/src/shared-types.ts` | Add types for sharing config |
| `firebase/functions/src/schemas/` | Add Zod schema for sharing config |
| `firebase/functions/src/sharing/SharingHandlers.ts` | NEW: Handler for share pages |
| `firebase/functions/src/routes/route-config.ts` | Add route for share pages |
| `firebase/firebase.json` (or generator) | Add hosting rewrite |

## Open Questions

1. Should we serve dynamic HTML for ALL routes (for consistent OG tags on any shared URL)?
2. What's the fallback OG image if tenant hasn't uploaded one?
3. Should the OG image include dynamic text (group name) or just static branding?
4. Do we want to canonicalize `og:url` (enforce https / preferred host)?

## Effort

Medium - requires new handler, config schema changes, and hosting configuration.
