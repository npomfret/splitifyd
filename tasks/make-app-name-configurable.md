# Task: Make App Name Configurable (Replace Hardcoded App Name)

## Status: 🟡 IN PROGRESS

**Last Updated:** 2025-01-17

### Progress Summary
- ✅ **Phase 1 (Client-Side):** ~80% complete - Core i18n infrastructure working, key translation keys updated
- ✅ **Phase 2 (Server-Side):** ~90% complete - Config endpoint returns appName, marketingFlags defaults working
- 🟡 **Phase 3 (Testing):** ~60% complete - Integration tests passing, some fixtures updated, hardcoded-values test not re-enabled
- ❌ **Phase 4 (Documentation):** Not started - Policy docs updated, but guides and README pending

### Completed Work
- ✅ Backend config endpoint returns tenant appName with marketingFlags defaults
- ✅ Frontend i18n interpolation infrastructure for `{{appName}}`
- ✅ Core translation keys updated (titleSuffix, dashboard, copyright, pricing, etc.)
- ✅ index.html made tenant-agnostic (storage keys, window globals)
- ✅ theme-bootstrap.ts uses tenant-scoped storage keys
- ✅ Static policy pages use dynamic titles
- ✅ robots.txt and theme-sw.js made generic
- ✅ Integration tests passing (config.test.ts with 29/29 tests)
- ✅ Unit tests for config-response logic
- ✅ Test infrastructure renamed to TenantFirestoreTestDatabase
- ✅ Webapp test mocks updated for react-i18next

### Remaining Work
- ⏳ Additional translation keys (lines 673, 763, 820, 838, 932, 1320, 1447, 1481)
- ⏳ Backend scripts still have hardcoded "splitifyd" (low priority - dev tooling)
- ⏳ Re-enable e2e-tests/src/__tests__/unit/hardcoded-values.test.ts
- ⏳ Update remaining fixtures/builders
- ⏳ Documentation updates (README, guides)

## Overview

The app currently has "Splitifyd" and "Splitify" hardcoded throughout the codebase. Tenant configuration already supports a configurable `branding.appName` (`TenantConfig.branding.appName`), but that value is not used consistently. Merge of previous tasks: ensure every user-facing or tenant-aware surface pulls the app name from the tenant config rather than a literal string.

## Tenant Config Structure

```typescript
// packages/shared/src/shared-types.ts
export interface BrandingConfig {
    appName: TenantAppName;
    logoUrl: TenantLogoUrl;
    faviconUrl?: TenantFaviconUrl;
    // ... other branding fields
}

export interface TenantConfig {
    tenantId: TenantId;
    branding: BrandingConfig;
    createdAt: ISOString;
    updatedAt: ISOString;
}
```

Current tenant configurations (`firebase/scripts/tenant-configs.json`):
- localhost-tenant: "Splitifyd Demo"
- partner-tenant: "Partner Expenses"

## Areas to Update

### Frontend (webapp-v2)

**Translations: `webapp-v2/src/locales/en/translation.json`**

The following keys contain hardcoded "Splitifyd"/"Splitify" and should interpolate the configured app name (e.g., `{{appName}}`):

| Status | Line | Key | Current Value | Change Required |
|--------|------|-----|---------------|-----------------|
| ✅ | 56 | `common.titleSuffix` | `" - Splitifyd"` | Use appName from config |
| ✅ | 71 | `landing.hero.appScreenshotAlt` | `"Splitifyd App Screenshot"` | Use appName |
| ✅ | 163 | `registerPage.description` | `"Create your Splitifyd account..."` | Use appName |
| ✅ | 218 | `dashboard.title` | `"Dashboard - Splitifyd"` | Use appName |
| ✅ | 219 | `dashboard.description` | `"Manage your groups and expenses with Splitifyd"` | Use appName |
| ✅ | 220 | `dashboard.welcomeMessage` | `"Welcome to Splitifyd, {{name}}!"` | Use appName |
| ✅ | 556 | `navigation.footer.copyright` | `"© {{year}} Splitifyd. All rights reserved."` | Use appName |
| ✅ | 596 | `policy.acceptance.instruction` | `"...to continue using Splitify."` | Use appName (typo currently "Splitify") |
| ✅ | 608 | `pricing.description` | `"Simple, transparent pricing for Splitifyd..."` | Use appName |
| ✅ | 672 | `seo.titleSuffix` | `" \| Splitifyd"` | Use appName |
| ⏳ | 673 | `seo.siteName` | `"Splitifyd"` | Use appName |
| ⏳ | 763 | `emptyGroupsState.gettingStartedTitle` | `"Getting started with Splitifyd:"` | Use appName |
| ⏳ | 820 | `header.logoAlt` | `"Splitifyd"` | Use appName |
| ⏳ | 838 | `footer.companyName` | `"Splitifyd"` | Use appName |
| ⏳ | 932 | `settingsPage.title` | `"Settings - Splitifyd"` | Use appName |
| ⏳ | 1320 | `policyComponents.policyAcceptanceModal.acceptanceInstructions` | `"...to continue using Splitify."` | Use appName |
| ⏳ | 1447 | `pages.landingPage.title` | `"Effortless Bill Splitting - Splitifyd"` | Use appName |
| ⏳ | 1481 | `authLayout.titleSuffix` | `" - Splitifyd"` | Use appName |

(And additional instances throughout the file.) Strategy: add `appName` to the global i18n context and use interpolation rather than literals.

**App code**

- ✅ `webapp-v2/src/stores/config-store.ts`: Updates i18n default variables with appName (keeps `DEFAULT_APP_NAME = 'Splitifyd'` as fallback).
- ✅ Static pages: `webapp-v2/src/pages/static/PricingPage.tsx`, `CookiePolicyPage.tsx`, `TermsOfServicePage.tsx`, `PrivacyPolicyPage.tsx` now use dynamic titles.
- ✅ `webapp-v2/src/utils/theme-bootstrap.ts`: Now uses tenant-scoped storage key `'tenant-theme:' + host + ':hash'`; `window.__tenantTheme`.
- ✅ `webapp-v2/src/pages/AdminDiagnosticsPage.tsx` and `webapp-v2/src/components/admin/AdminDiagnosticsTab.tsx`: Updated for tenant-scoped theme hash key.
- ✅ `webapp-v2/src/types/global.d.ts`: Changed to `__tenantTheme?: { ... }`.
- ⏳ Admin/tenant management: `webapp-v2/src/pages/AdminTenantsPage.tsx`, `webapp-v2/src/components/admin/AdminTenantsTab.tsx` should display/use `branding.appName`.
- ✅ `webapp-v2/index.html`: Updated to `<title>App</title>`, tenant-scoped storage key, `window.__tenantTheme`.
- ✅ Public assets: `webapp-v2/public/robots.txt` (now generic), `webapp-v2/public/theme-sw.js` (now tenant-agnostic cache name).

**SEO/meta**

- `webapp-v2/src/components/SEOHead.tsx` already uses translations; ensure the tenant config is available so translated values reflect the configured app name.

### Backend (firebase/functions)

- ✅ `firebase/functions/src/utils/config-response.ts`: Added `cloneTenantConfig()` to provide default marketingFlags when undefined.
- ✅ `firebase/functions/src/__tests__/unit/config-response.test.ts`: Added unit tests for default marketingFlags behavior.
- ✅ `firebase/functions/src/__tests__/integration/config.test.ts`: Integration tests passing (29/29) with proper tenant override via X-Tenant-ID header.
- ⏳ `firebase/functions/src/services/tenant/TenantRegistryService.ts`: Fallback still uses `appName: toTenantAppName('Splitifyd')` (acceptable as last-resort default).
- ✅ `firebase/functions/src/routes/route-config.ts`: Comment references updated or benign.
- ⏳ `firebase/functions/src/services/ExpenseService.ts`: comment references `@splitifyd/shared` (package name, not user-facing).
- ⏳ `firebase/functions/src/schemas/index.ts`: comment references `@splitifyd/shared` (package name, not user-facing).
- ⏳ Translation/messages: `firebase/functions/src/locales/en/translation.json` — update any literals (if applicable).
- ✅ `firebase/functions/vitest.config.ts`: Default GCLOUD_PROJECT changed to 'splitifyd' (project ID, not branding).

### Tests

Update fixtures/assertions to use configurable app name:
- ⏳ `e2e-tests/src/__tests__/unit/hardcoded-values.test.ts` (re-enable once literals removed).
- ✅ `e2e-tests/src/__tests__/integration/site-quality.e2e.test.ts` (updated).
- ⏳ `e2e-tests/src/__tests__/integration/error-handling-comprehensive.e2e.test.ts`.
- ⏳ `firebase/functions/src/__tests__/integration/tenant/admin-tenant-publish.test.ts`.
- ⏳ `firebase/functions/src/__tests__/unit/services/TenantRegistryService.test.ts` (includes host `app.splitifyd.com`).
- ⏳ `firebase/functions/src/__tests__/unit/app.test.ts` (`https://static.splitifyd.dev`).
- ✅ `firebase/functions/src/__tests__/integration/config.test.ts` (29/29 tests passing).
- ✅ `firebase/functions/src/__tests__/unit/config-response.test.ts` (new unit tests for marketingFlags defaults).
- ✅ Multiple firebase unit tests updated for tenant-agnostic naming (AppDriver.ts, GroupService.test.ts, etc.).
- ✅ `webapp-v2/src/test/msw/handlers.ts` (updated).
- ⏳ `webapp-v2/src/__tests__/utils/mock-firebase-service.ts`.
- ⏳ `webapp-v2/src/__tests__/unit/vitest/stores/config-store.test.ts` (sets `document.title = 'Splitifyd'`).
- ✅ `webapp-v2/src/__tests__/unit/vitest/pages/TenantBrandingPage.test.tsx` (updated).
- ✅ `webapp-v2/src/__tests__/unit/vitest/components/GroupCard.test.tsx` (react-i18next mock updated).
- ✅ `webapp-v2/src/__tests__/unit/vitest/components/ShareGroupModal.test.tsx` (react-i18next mock updated).
- ✅ `webapp-v2/src/__tests__/unit/vitest/pages/DomainManagementPage.test.tsx` (react-i18next mock updated).
- ⏳ `webapp-v2/src/__tests__/integration/playwright/tenant-branding.test.ts`.
- ⏳ `webapp-v2/src/__tests__/integration/playwright/root-route-conditional.test.ts`.
- ⏳ `webapp-v2/src/__tests__/integration/playwright/admin-tenants.test.ts`.
- ✅ `webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts` (updated).
- ✅ `webapp-v2/src/__tests__/integration/playwright/theme-smoke.test.ts` (updated).
- ✅ `packages/shared/src/fixtures/branding-tokens.ts` (updated).
- ✅ `packages/test-support/src/firebase/TenantFirestoreTestDatabase.ts` (renamed from SplitifydFirestoreTestDatabase).
- ⏳ `packages/test-support/src/builders/AppConfigurationBuilder.ts`.

### Documentation

Update to reflect white-labeling rather than Splitifyd-specific branding:
- ⏳ `README.md`.
- ⏳ `docs/white-labelling/theme-storage.md`.
- ⏳ `docs/white-labelling/white-label-admin-guide.md`.
- ⏳ `docs/white-labelling/white-label-debug-runbook.md`.
- ⏳ `docs/white-labelling/white-label-developer-guide.md`.
- ⏳ `docs/guides/types.md`.
- ⏳ `docs/guides/code.md`.
- ⏳ `docs/guides/validation.md`.
- ⏳ `docs/guides/webapp-and-style-guide.md`.
- ✅ `firebase/docs/policies/terms-and-conditions.md` (updated).
- ✅ `firebase/docs/policies/privacy-policy.md` (updated).
- ✅ `firebase/docs/policies/cookie-policy.md` (updated).
- ⏳ `tasks/modern-ui-overhaul-plan.md` (mentions Splitifyd).

### Configuration and Scripts

**Note:** These are infrastructure/dev scripts. "splitifyd" here refers to the GCP project ID, not user-facing branding.

- ⏳ `scripts/theme-storage/setup.sh`: `PROJECT_ID="${PROJECT_ID:-splitifyd}"`, `BUCKET_NAME="${THEME_BUCKET:-splitifyd-themes}"`, `https://splitifyd.com` (project infrastructure, low priority).
- ✅ `firebase/functions/vitest.config.ts`: `GCLOUD_PROJECT: 'splitifyd'` (project ID, not branding - completed).
- ⏳ `firebase/scripts/prepare-functions-deploy.js`: `'splitifyd-service-account-key.json'` (infrastructure file name).
- ⏳ `firebase/scripts/grant-deploy-roles.sh`: `PROJECT_ID="splitifyd"` (GCP project ID).
- ⏳ `firebase/scripts/show-logs.ts`: `const DEFAULT_PROJECT = 'splitifyd';` (GCP project ID).
- ⏳ `firebase/scripts/start-emulator.ts`: `logger.info('📍 The Splitifyd emulators are now fully operational');` (dev-only log message).
- ⏳ `firebase/package.json`: `GCLOUD_PROJECT=splitifyd` (GCP project ID).
- ⏳ `firebase/scripts/deploy-from-fresh-checkout.ts`: `mkdtempSync(join(tmpdir(), 'splitifyd-deploy-'));` (temp directory prefix).

## Implementation Strategy

### Phase 1: Client-Side Changes ✅ ~80% Complete

1. ✅ **Update i18n Context**
   - ✅ Modified i18n initialization to include tenant config and add `appName` to global translation context (config-store.ts).
   - ✅ Replaced ~10 key translation keys with `{{appName}}` interpolation.
   - ⏳ ~8 additional translation keys still need updating (lines 673, 763, 820, 838, 932, 1320, 1447, 1481).

2. ✅ **Update SEO/HTML/Theme**
   - ✅ SEOHead already uses translations; works correctly with tenant config.
   - ✅ Updated `index.html` with generic title and tenant-scoped storage keys.
   - ✅ Updated theme bootstrap to use host-based storage key (`tenant-theme:{host}:hash`).
   - ✅ Updated service worker cache name to be tenant-agnostic.
   - ✅ Updated robots.txt to be generic.

3. ✅ **App code cleanup**
   - ✅ Replaced literals in static policy pages (PricingPage, CookiePolicyPage, etc.).
   - ✅ Updated config store to set i18n default variables with appName.
   - ✅ Aligned localStorage keys with tenant-scoped convention.
   - ✅ Changed `window.__splitifydTheme` → `window.__tenantTheme`.
   - ✅ Updated AdminDiagnosticsTab for tenant-scoped theme keys.

### Phase 2: Server-Side Changes ✅ ~90% Complete

1. ✅ **Translation/Config Pathing**
   - ✅ Config endpoint returns tenant appName via `getEnhancedConfigResponse()`.
   - ✅ Added `cloneTenantConfig()` to provide default marketingFlags when undefined.
   - ✅ Integration tests verify appName flows through correctly (29/29 passing).

2. N/A **Email/Notifications**
   - No email/notification templates exist yet.

### Phase 3: Testing 🟡 ~60% Complete

1. ✅ **Update Fixtures**
   - ✅ Renamed `SplitifydFirestoreTestDatabase` → `TenantFirestoreTestDatabase`.
   - ✅ Updated branding-tokens fixtures.
   - ⏳ Some builders/fixtures still need updating (AppConfigurationBuilder).

2. 🟡 **Add/Enable Tests**
   - ⏳ Need to re-enable `e2e-tests/src/__tests__/unit/hardcoded-values.test.ts`.
   - ✅ Integration tests passing (config.test.ts: 29/29).
   - ✅ Unit tests added for config-response logic.
   - ✅ Webapp unit tests updated (GroupCard, ShareGroupModal, DomainManagementPage, TenantBrandingPage).
   - ⏳ Some E2E tests still need updating (tenant-branding, admin-tenants, etc.).

3. ⏳ **Manual Testing**
   - Need to validate with localhost-tenant and partner-tenant after all changes complete.

### Phase 4: Documentation ❌ Not Started

1. ⏳ **Update README** to explain white-label capabilities.
2. ⏳ **Update guides** (types.md, code.md, validation.md, webapp-and-style-guide.md).
3. ✅ **Policy docs updated** (terms, privacy, cookie policy).
4. ⏳ **Add migration guidance** for existing tenants.

## Fallback Strategy

For backwards compatibility:

```typescript
const appName = config?.tenant?.branding?.appName ?? 'Splitifyd';
```

## Acceptance Criteria

- All instances of hardcoded "Splitifyd"/"Splitify" replaced with the tenant-config value or a generic identifier.
- Page titles, SEO meta tags, and initial HTML title use the configured app name.
- Footer/headers and other UI text pull from translations with interpolation.
- Tests updated to assert against configured app name; hardcoded-values guard test enabled.
- Documentation and scripts describe/configure white-label behavior and avoid Splitifyd-specific defaults where inappropriate.
- Fallback to default app name works when tenant branding is missing; no console errors/warnings.

## Notes

- ✅ LocalStorage keys updated to use tenant-scoped keys (`tenant-theme:{host}:hash`).
- ✅ Window globals changed from `__splitifydTheme` to `__tenantTheme`.
- ✅ The typo "Splitify" vs "Splitifyd" fixed (line 596 updated).
- ✅ Service worker cache name made tenant-agnostic.
- ✅ robots.txt made generic.
- ✅ Theme storage keys now tenant-scoped.

## Next Steps (Priority Order)

1. **Complete remaining translation keys** (~8 keys, lines 673, 763, 820, 838, 932, 1320, 1447, 1481)
2. **Re-enable hardcoded-values guard test** (`e2e-tests/src/__tests__/unit/hardcoded-values.test.ts`)
3. **Update remaining test fixtures** (AppConfigurationBuilder, etc.)
4. **Manual testing** - Validate with localhost-tenant and partner-tenant
5. **Documentation updates** (README, guides)
6. **Backend scripts** (low priority - dev tooling only, not user-facing)
