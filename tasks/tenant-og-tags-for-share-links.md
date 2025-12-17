# Tenant-Specific Open Graph Tags for Share Links

## Status: IMPLEMENTED

## Problem

When users share invite links on WhatsApp (or other social platforms), the preview looks bad - showing a generic PNG icon instead of a rich branded preview.

**Root cause:** This is a client-rendered SPA. Social media crawlers don't execute JavaScript, so they see the static `index.html` without any OG tags. The `SEOHead` component sets tags client-side, which crawlers never see.

## Solution Implemented

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Build Phase                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. webapp-v2 build → dist/index.html (with hashed assets)      │
│ 2. Build script copies:                                         │
│    - index.html → functions/lib/sharing/index-template.html    │
│    - locales/* → functions/lib/locales/                        │
│ 3. Functions deploy includes template + translations            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Runtime (Request to /join)                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Firebase Hosting rewrite → Cloud Function                    │
│ 2. Function resolves tenant from Host header                    │
│ 3. Function reads cached template (from disk, loaded once)      │
│ 4. Function loads translations (from disk, loaded once)         │
│ 5. Function builds OG tags from:                                │
│    - Translations (title, description)                          │
│    - Tenant config (appName, ogImage)                           │
│ 6. Function injects OG tags into <head>                         │
│ 7. Function returns HTML with Vary: Host header                 │
│                                                                 │
│ Result: Crawler sees OG tags, human sees full SPA               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Translations for description** - OG description comes from i18n translations (`sharing.ogDescription`), NOT from tenant config. This ensures consistency and proper internationalization.

2. **Tenant config for image** - OG image can be customized per-tenant via `tokens.sharing.ogImage`.

3. **App name from tenant** - Title includes tenant's `appName` via translation interpolation.

### Files Created/Modified

| File | Change |
|------|--------|
| `firebase/functions/src/sharing/SharingHandlers.ts` | NEW: Handler class with translation loading |
| `packages/shared/src/types/branding.ts` | Added `BrandingSharingSchema` (ogImage only) |
| `firebase/functions/src/routes/route-config.ts` | Added GET /join route (no auth) |
| `firebase/functions/src/services/ComponentBuilder.ts` | Added `buildSharingHandlers()` |
| `firebase/functions/src/ApplicationFactory.ts` | Wired up sharingHandlers |
| `firebase/firebase.template.json` | Added /join rewrite before catch-all |
| `firebase/functions/package.json` | Added `copy-sharing-assets` script |
| `webapp-v2/src/locales/en/translation.json` | Added `sharing.ogDescription` and `sharing.joinTitle` |

### Translation Keys

```json
{
  "sharing": {
    "ogDescription": "Split expenses easily with friends and family",
    "joinTitle": "Join a group on {{appName}}"
  }
}
```

### Tenant Config (Optional)

Tenants can optionally set a custom OG image:

```json
{
  "tokens": {
    "sharing": {
      "ogImage": "https://example.com/og-image.png"
    }
  }
}
```

**Fallback chain for image:**
1. `tokens.sharing.ogImage`
2. `tokens.assets.logoUrl` (tenants always have a logo)

### Build Pipeline

The `build:prod` script in `firebase/functions/package.json`:
- Copies `webapp-v2/dist/index.html` → `lib/sharing/index-template.html`
- Copies `webapp-v2/src/locales/*` → `lib/locales/`

For dev mode, SharingHandlers looks for files in both compiled (`lib/`) and source (`../../../webapp-v2/`) locations.

## Testing

**Manual testing:**
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

**Local testing:**
1. Run the dev server
2. Use `curl -v http://localhost:PORT/join?shareToken=test`
3. Verify OG tags in response HTML

## Security

- All tenant-provided values are HTML-escaped before injection
- `/join` route has no auth middleware (crawlers can't authenticate)
- `Vary: Host` header ensures proper multi-tenant CDN caching

## Future Extensions

To add more shareable routes:

1. Add rewrite in `firebase.template.json`: `{ "source": "/receipt/**", "function": "api" }`
2. Add route in `route-config.ts`
3. Add case in `SharingHandlers.determineRoute()` and `getTitleForRoute()`
4. Add translation keys if needed
