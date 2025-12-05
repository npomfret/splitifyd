# Theme Settings Cleanup

Clean up unused and deprecated branding/theme configuration.

## Background

Audit confirmed:
- Theme generation uses only `BrandingTokens` via `ThemeArtifactService`
- Legacy `BrandingConfig` properties have zero effect on CSS output
- Several dead-end fields exist (stored but never read)

---

## Tasks

### 1. Remove `surface.spotlight` token

**Status:** Unused - CSS variable generated but never consumed

**Files:**
- `packages/shared/src/types/branding.ts` - remove from `BrandingSemanticColorSchema`
- `firebase/docs/tenants/*/config.json` - remove from example configs

### 2. Remove `customCSS` field

**Status:** Dead-end - form UI saves it, but no injection mechanism exists

**Files:**
- `packages/shared/src/schemas/apiSchemas.ts` - remove from `BrandingConfigSchema`
- `packages/shared/src/shared-types.ts` - remove from `BrandingConfig` interface
- `firebase/functions/src/schemas/tenant.ts` - remove from schema
- `webapp-v2/src/pages/TenantBrandingPage.tsx` - remove form field

### 3. Move `marketingFlags` out of branding

**Status:** Feature flags incorrectly nested under branding config

**Current location:** `tenant.branding.marketingFlags`
**Target location:** `tenant.marketingFlags` (top-level)

**Files:**
- `packages/shared/src/schemas/apiSchemas.ts` - move schema
- `packages/shared/src/shared-types.ts` - update types
- `firebase/functions/src/schemas/tenant.ts` - update schema
- `webapp-v2/src/App.tsx` - update access path
- `webapp-v2/src/pages/LandingPage.tsx` - update access path
- `firebase/docs/tenants/*/config.json` - migrate example configs

### 4. Deprecate legacy `BrandingConfig` color properties

**Status:** Superseded by `BrandingTokens.palette` and `semantics.colors`

**Properties to remove:**
- `primaryColor`, `secondaryColor`, `accentColor`, `surfaceColor`, `textColor`
- `themePalette`

**Files:**
- `packages/shared/src/schemas/apiSchemas.ts` - remove from `BrandingConfigSchema`
- `packages/shared/src/shared-types.ts` - remove from `BrandingConfig`
- `webapp-v2/src/pages/TenantBrandingPage.tsx` - remove form fields (if present)

### 5. Consolidate `appName`, `logoUrl`, `faviconUrl`

**Status:** Duplicated - exists in both `branding` and `brandingTokens`

**Current:**
- `branding.appName` → should use `brandingTokens.legal.companyName`
- `branding.logoUrl` → should use `brandingTokens.assets.logoUrl`
- `branding.faviconUrl` → should use `brandingTokens.assets.faviconUrl`

**Approach:** Keep legacy fields for now but ensure all code reads from `brandingTokens`. Mark legacy fields as deprecated in types.

---

## Order of Operations

1. Remove `customCSS` (zero impact - nothing uses it)
2. Remove `surface.spotlight` (zero impact - nothing uses it)
3. Move `marketingFlags` (requires coordinated update)
4. Remove legacy color properties (requires audit of any remaining usage)
5. Deprecate duplicate asset/name fields (lower priority)

---

## Validation

After each change:
- `npm run build` passes
- Tenant branding page still works
- Theme CSS still generates correctly
- Landing page feature flags still work (after step 3)
