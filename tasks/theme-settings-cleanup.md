# Theme Settings Cleanup

Clean up unused and deprecated branding/theme configuration.

## Background

Audit confirmed:
- Theme generation uses only `BrandingTokens` via `ThemeArtifactService`
- Legacy `BrandingConfig` properties have zero effect on CSS output
- Several dead-end fields exist (stored but never read)

---

## Tasks

### 1. ~~Remove `surface.spotlight` token~~ ✅ DONE

### 2. ~~Remove `customCSS` field~~ ✅ DONE

### 3. ~~Move `marketingFlags` out of branding~~ ✅ DONE

Moved from `tenant.branding.marketingFlags` to `tenant.marketingFlags` (top-level).

### 4. ~~Remove unused legacy `BrandingConfig` color properties~~ ✅ DONE

Removed **unused** properties only (after audit confirmed they have no production usage):
- `surfaceColor` - not used in any production code
- `textColor` - not used in any production code
- `themePalette` - not used in any production code

**Kept** (still actively used in admin UIs):
- `primaryColor` - used in TenantBrandingPage.tsx, TenantEditorModal.tsx, config-store.ts
- `secondaryColor` - used in admin UIs
- `accentColor` - used in admin UIs

**Files updated:**
- `packages/shared/src/shared-types.ts` - removed types and converters
- `packages/shared/src/schemas/apiSchemas.ts` - removed from schema
- `firebase/functions/src/schemas/tenant.ts` - removed from schemas
- All builders and tests updated
- Tenant config JSON files updated (marketingFlags moved to top-level)

### 5. Consolidate `appName`, `logoUrl`, `faviconUrl`

**Status:** Duplicated - exists in both `branding` and `brandingTokens`

**Current:**
- `branding.appName` → should use `brandingTokens.legal.companyName`
- `branding.logoUrl` → should use `brandingTokens.assets.logoUrl`
- `branding.faviconUrl` → should use `brandingTokens.assets.faviconUrl`

**Approach:** Keep legacy fields for now but ensure all code reads from `brandingTokens`. Mark legacy fields as deprecated in types.

---

## Order of Operations

1. ~~Remove `customCSS` (zero impact - nothing uses it)~~ ✅
2. ~~Remove `surface.spotlight` (zero impact - nothing uses it)~~ ✅
3. ~~Move `marketingFlags` (requires coordinated update)~~ ✅
4. ~~Remove unused legacy color properties (surfaceColor, textColor, themePalette)~~ ✅
5. Deprecate duplicate asset/name fields (lower priority)

---

## Validation

After each change:
- `npm run build` passes
- Tenant branding page still works
- Theme CSS still generates correctly
- Landing page feature flags still work (after step 3)
