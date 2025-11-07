# White-label Brand Prep Notes

## Current Status

**Phases 1-6 Complete ✅**
- Tenant types and configuration infrastructure
- Domain-based tenant identification middleware
- Firestore tenant registry with fallback support
- Frontend dynamic branding (logos, colors, favicon)
- Feature flags and conditional routing
- Full tenant admin panel with branding editor and domain management

## Known Issue: CSS Variable Styling Failure

**Problem**: Card components remain white despite tenant branding being configured with orange colors.

**Root Cause**: Current CSS variable approach fails because:
1. Card components use JSX object-based inline styles: `style={{ backgroundColor: 'var(--brand-card-background, white)' }}`
2. CSS variables are set dynamically AFTER components render
3. Preact doesn't re-render components when CSS variables change
4. Even when using string-based styles (like Header), cards still fail to pick up colors

**Failed Attempts** (21+ iterations):
- Inline styles with CSS variables (object format)
- Inline styles with CSS variables (string format)
- Tailwind utility classes
- Direct DOM manipulation
- Various color values (#FB923C, #FD8A3E, #FDBA74)
- Cache TTL adjustments

**Working Components** (for comparison):
- Header: Uses string-based inline style `'background-color: var(--brand-header-background, white);'` ✅
- Body background: Direct DOM manipulation `document.body.style.backgroundColor` ✅

## Proposed Solution: Dynamic CSS Endpoint

Replace the CSS variable approach with a Cloud Function that serves tenant-specific CSS with actual color values.

### Architecture

**Endpoint**: `GET /api/styles/tenant.css`
- Generates CSS with actual hex colors, not CSS variables
- Uses existing tenant identification middleware (detects from domain)
- Proper caching (5min dev, 1hr prod) with ETag support
- No auth required (tenant identified from request domain)

### Implementation Plan

#### Backend Changes

1. **New File**: `firebase/functions/src/endpoints/tenant-styles.ts`
   ```typescript
   export async function serveTenantStyles(req: Request, res: Response): Promise<void>
   ```
   - Generates CSS template with tenant's actual color values
   - Includes overrides for Tailwind classes with `!important`
   - Returns proper cache headers and ETag
   - Handles conditional requests (304 Not Modified)

2. **Register Route** in `firebase/functions/src/routes/route-config.ts`:
   ```typescript
   {
       method: 'GET',
       path: '/styles/tenant.css',
       handlerName: 'serveTenantStyles',
       category: 'public',
       isInline: true,
   }
   ```

3. **Register Handler** in `firebase/functions/src/ApplicationFactory.ts`:
   - Import `serveTenantStyles`
   - Add to handler registry

#### Frontend Changes

1. **New File**: `webapp-v2/src/utils/load-tenant-css.ts`
   ```typescript
   export function loadTenantCSS(): void
   ```
   - Dynamically creates `<link>` tag for tenant CSS
   - Prevents duplicate loads
   - Adds cache-busting in development

2. **Update**: `webapp-v2/src/stores/config-store.ts`
   - Call `loadTenantCSS()` when branding config loads
   - Keep existing `applyBrandingPalette()` initially for safety

3. **Cleanup**: `webapp-v2/src/components/ui/Card.tsx`
   - Remove inline style attempts
   - Let tenant CSS handle background color

### Generated CSS Example

```css
:root {
    --brand-primary: #F97316;
    --brand-secondary: #EA580C;
    --brand-card-background: #FDBA74;
    /* ... other variables */
}

/* Override Tailwind with actual values */
.bg-primary { background-color: #F97316 !important; }
.text-primary { color: #F97316 !important; }
/* ... other overrides */

/* Body background */
body { background-color: #FFF7ED !important; }
```

### Benefits

✅ **No FOUC**: CSS loaded before React renders
✅ **Proper CSS cascade**: Uses standard CSS specificity
✅ **No timing issues**: Colors available immediately
✅ **Works with localhost & 127.0.0.1**: Leverages existing tenant identification
✅ **Cacheable**: Proper HTTP caching with ETags
✅ **Debuggable**: Visible in browser DevTools Network tab

### Files to Create/Modify

- **CREATE**: `firebase/functions/src/endpoints/tenant-styles.ts`
- **CREATE**: `webapp-v2/src/utils/load-tenant-css.ts`
- **MODIFY**: `firebase/functions/src/routes/route-config.ts`
- **MODIFY**: `firebase/functions/src/ApplicationFactory.ts`
- **MODIFY**: `webapp-v2/src/stores/config-store.ts`
- **MODIFY**: `webapp-v2/src/components/ui/Card.tsx` (remove inline style)

### Cache Strategy

- **Development**: 5 minutes (allows quick iteration)
- **Production**: 1 hour (balances freshness with performance)
- **ETag**: MD5 hash of tenant colors for efficient revalidation
- **Invalidation**: When tenant updates branding, ETag changes, browsers get new CSS

### Considerations

1. **Load Order**: Tenant CSS loads after main Vite CSS (ensures proper cascade)
2. **Specificity**: Using `!important` to override Tailwind defaults
3. **Testing**: E2E tests should verify correct CSS is loaded and applied
4. **Migration**: Keep existing CSS variable code initially, remove after verification

---

## Previous Progress

**Phase 6 - Tenant Admin Panel ✅ (Complete)**
- Backend APIs under `/settings/tenant` prefix
- Branding Editor UI with color pickers and live preview
- Domain Management UI with DNS instructions
- Comprehensive test coverage (unit + integration + E2E)
- Full CRUD operations for tenant configuration

---

## Future Enhancements (Post-MVP)

### Advanced Color Validation
- Automatic WCAG contrast validation
- Hover/active state generation
- Hue clash detection with system colors

### Enhanced Branding Assets
- Logo file uploads (SVG preferred)
- Asset validation (size, format, aspect ratio)
- Live contrast badges in admin UI

### Domain Verification
- DNS/SSL provisioning status
- Automated verification workflow
- Preview links before domains go live
