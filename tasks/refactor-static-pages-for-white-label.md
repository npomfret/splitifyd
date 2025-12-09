# Task: Remove Static Pages and Implement Tenant-Managed Footer Links

## Status: COMPLETED

## Objective

Remove all static content pages (Terms, Privacy, Cookies, Pricing) from the application. Tenants will host their own static content externally. The footer was updated to render tenant-configured external links instead of internal routes.

## Scope Clarification

- **KEEP**: Policy acceptance system (modal, hooks, API endpoints) - policies are core app functionality
- **KEEP**: PolicyRenderer component - used by PolicyAcceptanceModal to display policy content
- **KEEP**: Policy text endpoints (`getPrivacyPolicy`, `getTermsOfService`, `getCookiePolicy`) - used by tenant admin policy management
- **REMOVE**: Static pages that render policy content for end users - tenants host their own
- **REMOVE**: `legal.privacyPolicyUrl` and `legal.termsOfServiceUrl` from branding schema
- **REMOVE**: `showLandingPage` marketing flag - orphaned after LandingPage removal
- **ADD**: `footer.links` array for tenant-configurable external links

---

## Completed Work

### Phase 1: Delete Static Pages (webapp-v2)

**DELETED:**
- [x] `webapp-v2/src/pages/static/PricingPage.tsx`
- [x] `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
- [x] `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
- [x] `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
- [x] `webapp-v2/src/pages/static/` (entire directory)
- [x] `webapp-v2/src/components/StaticPageLayout.tsx`
- [x] `webapp-v2/src/hooks/usePolicy.ts`

**KEPT (used by policy acceptance system):**
- `webapp-v2/src/components/policy/PolicyRenderer.tsx` - displays policy content in acceptance modal
- `webapp-v2/src/hooks/usePolicyAcceptance.ts` - tracks user policy acceptance

**MODIFIED:**
- [x] `webapp-v2/src/App.tsx` - removed static page routes and imports
- [x] `webapp-v2/src/services/navigation.service.ts` - removed static page navigation methods
- [x] `webapp-v2/src/constants/routes.ts` - removed static page route constants

### Phase 2: Update Branding Schema (packages/shared)

- [x] Removed `legal.privacyPolicyUrl` and `legal.termsOfServiceUrl` fields
- [x] Added `footer.links` array for tenant-configurable external links

### Phase 3: Update Backend (firebase/functions)

- [x] **KEPT**: `GET /policies/:policyId/current` route - used by PolicyAcceptanceModal
- [x] **KEPT**: Policy text endpoints (`getPrivacyPolicy`, `getTermsOfService`, `getCookiePolicy`) - used by tenant admins

### Phase 4: Footer Component (webapp-v2)

- [x] Updated `Footer.tsx` to render tenant-configured external links
- [x] Links render as external `<a>` tags with `target="_blank" rel="noopener noreferrer"`
- [x] Links section hidden if `footer.links` is empty

### Phase 5: Tenant Config Files

- [x] All tenant configs updated in `firebase/docs/tenants/*/config.json`
- [x] Removed `legal.privacyPolicyUrl`, `legal.termsOfServiceUrl`
- [x] Added `footer.links` arrays

### Phase 6: Additional Cleanup

- [x] Removed `showLandingPage` from `BrandingMarketingFlags` - orphaned after LandingPage removal
- [x] Removed `showLandingPage` from all tenant configs
- [x] Removed `showLandingPage` from `MarketingFlagsBuilder`
- [x] Removed `showLandingPage` UI from `TenantBrandingPage.tsx` and `MarketingSection.tsx`
- [x] Updated all related tests

### Phase 7: Translations

- [x] Removed `staticPages.*` keys from translations
- [x] Removed `showLandingPage` translation
- [x] Added `footer.linksSection` key
- [x] **KEPT**: `policyComponents.*` keys (modal uses these)

### Phase 8: Tests

**KEPT (test core functionality):**
- `webapp-v2/src/__tests__/unit/vitest/components/PolicyRenderer.test.tsx` - tests component used by acceptance modal
- `firebase/functions/src/__tests__/unit/api/public-policies.test.ts` - tests policy text endpoints for tenant admins
- `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts` - tests acceptance flow

**MODIFIED:**
- [x] Footer tests updated for dynamic link rendering
- [x] Various tests updated to remove `showLandingPage` references

### Phase 9: Page Object and E2E Test Cleanup

**Page Objects updated to remove `showLandingPage` methods:**
- [x] `packages/test-support/src/page-objects/TenantEditorModalPage.ts` - removed `getShowLandingPageCheckbox`, `toggleShowLandingPage`, `verifyShowLandingPageChecked`
- [x] `packages/test-support/src/page-objects/TenantBrandingPage.ts` - removed `getShowLandingPageCheckbox`, `toggleShowLandingPage`, `verifyShowLandingPageChecked`, `getShowLandingPageCheckboxLocator`

**E2E tests updated:**
- [x] `e2e-tests/src/__tests__/integration/tenant-editor.e2e.test.ts` - removed `showLandingPage` assertions from "admin can update fields" and "admin can toggle all marketing flags" tests
- [x] `webapp-v2/src/__tests__/integration/playwright/tenant-branding.test.ts` - removed `showLandingPage` assertions from "should toggle marketing flags" and "should display marketing flags correctly" tests
- [x] `webapp-v2/src/__tests__/integration/playwright/tenant-editor-modal.test.ts` - changed "should toggle marketing flags" test to use `showPricingPage` instead

**Unit tests updated:**
- [x] `firebase/functions/src/__tests__/unit/api/authorization.test.ts` - removed `showLandingPage` from marketing flags assertions
- [x] `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts` - removed duplicate URL assertions

---

## Files Summary

### DELETED:
1. `webapp-v2/src/pages/static/` (entire directory with 4 pages)
2. `webapp-v2/src/pages/LandingPage.tsx`
3. `webapp-v2/src/components/StaticPageLayout.tsx`
4. `webapp-v2/src/components/landing/` (entire directory - CTASection, FeatureCard, FeaturesGrid, Globe, HeroSection)
5. `webapp-v2/src/components/ui/GradientText.tsx`
6. `webapp-v2/src/hooks/usePolicy.ts`
7. `webapp-v2/src/styles/landing.css`
8. `webapp-v2/src/__tests__/unit/vitest/pages/LandingPage.test.tsx`

### MODIFIED:
1. `webapp-v2/src/App.tsx`
2. `webapp-v2/src/services/navigation.service.ts`
3. `webapp-v2/src/constants/routes.ts`
4. `webapp-v2/src/components/layout/Footer.tsx`
5. `webapp-v2/src/locales/en/translation.json`
6. `packages/shared/src/shared-types.ts` (removed showLandingPage, kept policy types)
7. `packages/shared/src/schemas/apiSchemas.ts`
8. `packages/shared/src/builders/MarketingFlagsBuilder.ts`
9. `firebase/functions/src/routes/route-config.ts`
10. `firebase/functions/src/schemas/tenant.ts`
11. `firebase/docs/tenants/*/config.json` (all tenant configs)
12. `packages/test-support/src/page-objects/TenantEditorModalPage.ts`
13. `packages/test-support/src/page-objects/TenantBrandingPage.ts`
14. `e2e-tests/src/__tests__/integration/tenant-editor.e2e.test.ts`
15. `webapp-v2/src/__tests__/integration/playwright/tenant-branding.test.ts`
16. `webapp-v2/src/__tests__/integration/playwright/tenant-editor-modal.test.ts`
17. `firebase/functions/src/__tests__/unit/api/authorization.test.ts`
18. `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts`

### KEPT (intentionally preserved):
1. `webapp-v2/src/components/policy/PolicyRenderer.tsx` - used by PolicyAcceptanceModal
2. `webapp-v2/src/hooks/usePolicyAcceptance.ts` - policy acceptance tracking
3. `firebase/functions/src/__tests__/unit/api/public-policies.test.ts` - tests kept endpoints
4. `GET /policies/:policyId/current` API endpoint - used by PolicyAcceptanceModal
5. Policy text API endpoints - used by tenant admin policy management
