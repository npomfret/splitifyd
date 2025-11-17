# Task: Make App Name Configurable (Replace Hardcoded App Name)

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

| Line | Key | Current Value | Change Required |
|------|-----|---------------|-----------------|
| 56 | `common.titleSuffix` | `" - Splitifyd"` | Use appName from config |
| 71 | `landing.hero.appScreenshotAlt` | `"Splitifyd App Screenshot"` | Use appName |
| 163 | `registerPage.description` | `"Create your Splitifyd account..."` | Use appName |
| 218 | `dashboard.title` | `"Dashboard - Splitifyd"` | Use appName |
| 219 | `dashboard.description` | `"Manage your groups and expenses with Splitifyd"` | Use appName |
| 220 | `dashboard.welcomeMessage` | `"Welcome to Splitifyd, {{name}}!"` | Use appName |
| 556 | `navigation.footer.copyright` | `"© {{year}} Splitifyd. All rights reserved."` | Use appName |
| 596 | `policy.acceptance.instruction` | `"...to continue using Splitify."` | Use appName (typo currently "Splitify") |
| 608 | `pricing.description` | `"Simple, transparent pricing for Splitifyd..."` | Use appName |
| 672 | `seo.titleSuffix` | `" \| Splitifyd"` | Use appName |
| 673 | `seo.siteName` | `"Splitifyd"` | Use appName |
| 763 | `emptyGroupsState.gettingStartedTitle` | `"Getting started with Splitifyd:"` | Use appName |
| 820 | `header.logoAlt` | `"Splitifyd"` | Use appName |
| 838 | `footer.companyName` | `"Splitifyd"` | Use appName |
| 932 | `settingsPage.title` | `"Settings - Splitifyd"` | Use appName |
| 1320 | `policyComponents.policyAcceptanceModal.acceptanceInstructions` | `"...to continue using Splitify."` | Use appName |
| 1447 | `pages.landingPage.title` | `"Effortless Bill Splitting - Splitifyd"` | Use appName |
| 1481 | `authLayout.titleSuffix` | `" - Splitifyd"` | Use appName |

(And additional instances throughout the file.) Strategy: add `appName` to the global i18n context and use interpolation rather than literals.

**App code**

- `webapp-v2/src/stores/config-store.ts`: `DEFAULT_APP_TITLE = 'Splitifyd'`; logic checking `/splitifyd/i`.
- Static pages: `webapp-v2/src/pages/static/PricingPage.tsx`, `CookiePolicyPage.tsx`, `TermsOfServicePage.tsx`, `PrivacyPolicyPage.tsx` use hardcoded titles.
- `webapp-v2/src/utils/theme-bootstrap.ts`: `THEME_STORAGE_KEY = 'splitifyd:theme-hash'`; `window.__splitifydTheme`.
- `webapp-v2/src/pages/AdminDiagnosticsPage.tsx` and `webapp-v2/src/components/admin/AdminDiagnosticsTab.tsx`: remove the theme hash key.
- `webapp-v2/src/types/global.d.ts`: `__splitifydTheme?: { ... }`.
- Admin/tenant management: `webapp-v2/src/pages/AdminTenantsPage.tsx`, `webapp-v2/src/components/admin/AdminTenantsTab.tsx` should display/use `branding.appName`.
- `webapp-v2/index.html`: `<title>Splitifyd</title>`, storage key `splitifyd:theme-hash`, `window.__splitifydTheme` (initial paint before app boot).
- Public assets: `webapp-v2/public/robots.txt` (references Splitifyd / splitifyd.com), `webapp-v2/public/theme-sw.js` (`CACHE_NAME = 'splitifyd-theme-v1'`).

**SEO/meta**

- `webapp-v2/src/components/SEOHead.tsx` already uses translations; ensure the tenant config is available so translated values reflect the configured app name.

### Backend (firebase/functions)

- `firebase/functions/src/services/tenant/TenantRegistryService.ts`: `appName: toTenantAppName('Splitifyd')`.
- `firebase/functions/src/routes/route-config.ts`: comment references Splitifyd.
- `firebase/functions/src/services/ExpenseService.ts`: comment references `@splitifyd/shared`.
- `firebase/functions/src/schemas/index.ts`: comment references `@splitifyd/shared`.
- Translation/messages: `firebase/functions/src/locales/en/translation.json` — update any literals.
- Config response / registry: `firebase/functions/src/utils/config-response.ts` (verify app name flows through).

### Tests

Update fixtures/assertions to use configurable app name:
- `e2e-tests/src/__tests__/unit/hardcoded-values.test.ts` (re-enable once literals removed).
- `e2e-tests/src/__tests__/integration/error-handling-comprehensive.e2e.test.ts`.
- `firebase/functions/src/__tests__/integration/tenant/admin-tenant-publish.test.ts`.
- `firebase/functions/src/__tests__/unit/services/TenantRegistryService.test.ts` (includes host `app.splitifyd.com`).
- `firebase/functions/src/__tests__/unit/app.test.ts` (`https://static.splitifyd.dev`).
- `webapp-v2/src/test/msw/handlers.ts`.
- `webapp-v2/src/__tests__/utils/mock-firebase-service.ts`.
- `webapp-v2/src/__tests__/unit/vitest/stores/config-store.test.ts` (sets `document.title = 'Splitifyd'`).
- `webapp-v2/src/__tests__/unit/vitest/pages/TenantBrandingPage.test.tsx`.
- `webapp-v2/src/__tests__/integration/playwright/tenant-branding.test.ts`.
- `webapp-v2/src/__tests__/integration/playwright/root-route-conditional.test.ts`.
- `webapp-v2/src/__tests__/integration/playwright/admin-tenants.test.ts`.
- `webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts`.
- `packages/shared/src/fixtures/branding-tokens.ts` (e.g., `companyName: 'Splitifyd Labs'`).
- `packages/test-support/src/firebase/SplitifydFirestoreTestDatabase.ts` (class name and data).
- `packages/test-support/src/builders/AppConfigurationBuilder.ts`.

### Documentation

Update to reflect white-labeling rather than Splitifyd-specific branding:
- `README.md`.
- `docs/white-labelling/theme-storage.md`.
- `docs/white-labelling/white-label-admin-guide.md`.
- `docs/white-labelling/white-label-debug-runbook.md`.
- `docs/white-labelling/white-label-developer-guide.md`.
- `docs/guides/types.md`.
- `docs/guides/code.md`.
- `docs/guides/validation.md`.
- `docs/guides/webapp-and-style-guide.md`.
- `firebase/docs/policies/terms-and-conditions.md`.
- `firebase/docs/policies/privacy-policy.md`.
- `firebase/docs/policies/cookie-policy.md`.
- `tasks/modern-ui-overhaul-plan.md` (mentions Splitifyd).

### Configuration and Scripts

- `scripts/theme-storage/setup.sh`: `PROJECT_ID="${PROJECT_ID:-splitifyd}"`, `BUCKET_NAME="${THEME_BUCKET:-splitifyd-themes}"`, `https://splitifyd.com`.
- `firebase/functions/vitest.config.ts`: `GCLOUD_PROJECT: 'splitifyd'`.
- `firebase/scripts/prepare-functions-deploy.js`: `'splitifyd-service-account-key.json'`.
- `firebase/scripts/grant-deploy-roles.sh`: `PROJECT_ID="splitifyd"`.
- `firebase/scripts/show-logs.ts`: `const DEFAULT_PROJECT = 'splitifyd';`.
- `firebase/scripts/start-emulator.ts`: `logger.info('📍 The Splitifyd emulators are now fully operational');`.
- `firebase/package.json`: `GCLOUD_PROJECT=splitifyd`.
- `firebase/scripts/deploy-from-fresh-checkout.ts`: `mkdtempSync(join(tmpdir(), 'splitifyd-deploy-'));`.

## Implementation Strategy

### Phase 1: Client-Side Changes

1. **Update i18n Context**
   - Modify i18n initialization to include tenant config and add `appName` to the global translation context.
   - Replace hardcoded app names with interpolation in translation files.

2. **Update SEO/HTML/Theme**
   - Ensure SEOHead receives the tenant config (fix translations to drive values).
   - Update `index.html`, theme bootstrap, service worker cache name, robots.txt to be tenant-aware or generic.

3. **App code cleanup**
   - Replace literals in pages/components/config store and align localStorage keys/window globals with tenant names or a tenant-agnostic convention.

### Phase 2: Server-Side Changes

1. **Translation/Config Pathing**
   - Update `firebase/functions/src/locales/en/translation.json` and ensure config responses include app name.

2. **Email/Notifications**
   - If any email/notification templates exist, replace literals or document Console updates per tenant.

### Phase 3: Testing

1. **Update Fixtures**
   - Ensure builders/fixtures default to configurable app name; adjust assertions accordingly.

2. **Add/Enable Tests**
   - Re-enable `e2e-tests/src/__tests__/unit/hardcoded-values.test.ts` to guard against regressions.
   - Add or expand E2E coverage verifying UI surfaces reflect tenant app name.

3. **Manual Testing**
   - Validate with localhost-tenant ("Splitifyd Demo") and partner-tenant ("Partner Expenses"), confirming titles/footers/meta update dynamically.

### Phase 4: Documentation

1. **Update README** to explain white-label capabilities.
2. **Add migration guidance** for existing tenants and document default/fallback behavior.

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

- LocalStorage keys or window globals may need tenant scoping to avoid conflicts when switching tenants.
- The typo "Splitify" vs "Splitifyd" appears in translation lines 596 and 1320; both should use the configured app name.
- Consider whether service worker cache names, robots.txt, and theme storage keys should be tenant-specific or tenant-agnostic.
