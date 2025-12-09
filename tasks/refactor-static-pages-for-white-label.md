# Task: Remove Static Pages and Implement Tenant-Managed Footer Links

## Objective

Remove all static content pages (Terms, Privacy, Cookies, Pricing) from the application. Tenants will host their own static content externally. The footer will be updated to render tenant-configured external links instead of internal routes.

## Scope Clarification

- **KEEP**: Policy acceptance system (modal, hooks, API endpoints) - policies are core app functionality
- **REMOVE**: Static pages that render policy content - tenants host their own
- **REMOVE**: `legal.privacyPolicyUrl` and `legal.termsOfServiceUrl` from branding schema
- **ADD**: `footer.links` array for tenant-configurable external links
- **OUT OF SCOPE**: Admin UI for managing footer links (future task - will support multiple columns)

---

## Phase 1: Delete Static Pages (webapp-v2)

### Files to DELETE:
- [ ] `webapp-v2/src/pages/static/PricingPage.tsx`
- [ ] `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
- [ ] `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
- [ ] `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
- [ ] `webapp-v2/src/pages/static/` (entire directory)
- [ ] `webapp-v2/src/components/StaticPageLayout.tsx`
- [ ] `webapp-v2/src/components/policy/PolicyRenderer.tsx`
- [ ] `webapp-v2/src/hooks/usePolicy.ts`

### Files to MODIFY:

- [ ] **`webapp-v2/src/App.tsx`:**
  - Remove lazy imports for `PricingPage`, `TermsOfServicePage`, `PrivacyPolicyPage`, `CookiePolicyPage`
  - Remove route wrappers: `PricingRoute`, `TermsRoute`, `PrivacyRoute`, `CookieRoute`
  - Remove routes: `/pricing`, `/terms-of-service`, `/terms`, `/privacy-policy`, `/privacy`, `/cookies-policy`, `/cookies`
  - KEEP: `usePolicyAcceptance` hook and `PolicyAcceptanceModal` component

- [ ] **`webapp-v2/src/services/navigation.service.ts`:**
  - Remove: `goToPricing()`, `goToTerms()`, `goToPrivacyPolicy()`, `goToCookiePolicy()` methods

- [ ] **`webapp-v2/src/constants/routes.ts`:**
  - Remove: `PRICING`, `TERMS_OF_SERVICE`, `PRIVACY_POLICY`, `COOKIE_POLICY` route constants

- [ ] **`webapp-v2/src/app/apiClient.ts`:**
  - Remove: `getCurrentPolicy()`, `getCurrentPolicyWithAbort()`, `getPrivacyPolicy()`, `getTermsOfService()`, `getCookiePolicy()` methods
  - Remove: `getCurrentPolicyInternal()` helper
  - KEEP: All user policy status/acceptance methods

---

## Phase 2: Update Branding Schema (packages/shared)

- [ ] **`packages/shared/src/types/branding.ts`:**

  Update `BrandingLegalSchema` - remove URL fields:
  ```typescript
  const BrandingLegalSchema = z.object({
      appName: z.string().min(1),
      companyName: z.string().min(1),
      supportEmail: z.string().email(),
      // REMOVED: privacyPolicyUrl, termsOfServiceUrl
  });
  ```

  Add new footer schema:
  ```typescript
  const FooterLinkSchema = z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      url: z.string().url(),
  });

  const BrandingFooterSchema = z.object({
      links: z.array(FooterLinkSchema).default([]),
  }).optional();
  ```

  Add `footer` to `BrandingTokensSchema`

- [ ] **`packages/shared/src/schemas/apiSchemas.ts`:**
  - Remove: `CurrentPolicyResponseSchema` definition
  - Remove: `'GET /policies/:policyId/current'` from `responseSchemas` map

- [ ] **`packages/shared/src/shared-types.ts`:**
  - Remove: `CurrentPolicyResponse` interface
  - KEEP: All other policy types (used by acceptance system)

---

## Phase 3: Update Backend (firebase/functions)

- [ ] **`firebase/functions/src/routes/route-config.ts`:**
  - Remove: `GET /policies/:policyId/current` route (public endpoint)
  - KEEP: All other policy routes (admin management, user acceptance)

- [ ] **`firebase/functions/src/policies/PolicyHandlers.ts`:**
  - Remove: `getCurrentPolicy` handler method
  - KEEP: All admin policy handlers

- [ ] **`packages/shared/src/api.ts`:**
  - Remove from `PublicAPI`: `getCurrentPolicy()`, `getPrivacyPolicy()`, `getTermsOfService()`, `getCookiePolicy()`
  - KEEP: All `AdminAPI` and `API` policy methods

---

## Phase 4: Refactor Footer Component (webapp-v2)

- [ ] **`webapp-v2/src/components/layout/Footer.tsx`:**
  - Read `footer.links` from tenant config
  - Render links as external `<a>` tags with `target="_blank" rel="noopener noreferrer"`
  - Hide links section if `footer.links` is empty
  - Remove: `useNavigation` import and internal route calls
  - Remove: `Clickable` component usage (use `<a>` for external links)

---

## Phase 5: Update Tenant Config Files

- [ ] All tenant configs in `firebase/docs/tenants/*/config.json`:
  - Remove: `legal.privacyPolicyUrl`, `legal.termsOfServiceUrl`
  - Add: `footer.links` array

Example:
```json
"legal": {
    "appName": "BillSplit",
    "companyName": "BillSplit Ltd",
    "supportEmail": "support@example.com"
},
"footer": {
    "links": [
        { "id": "terms", "label": "Terms of Service", "url": "https://example.com/terms" },
        { "id": "privacy", "label": "Privacy Policy", "url": "https://example.com/privacy" }
    ]
}
```

---

## Phase 6: Update Tests

### Files to DELETE:
- [ ] `webapp-v2/src/__tests__/unit/vitest/components/PolicyRenderer.test.tsx`
- [ ] `firebase/functions/src/__tests__/unit/api/public-policies.test.ts`

### Files to MODIFY:
- [ ] `webapp-v2/src/__tests__/unit/vitest/components/Footer.test.tsx` - Update for dynamic footer
- [ ] `packages/test-support/src/ApiDriver.ts` - Remove `getCurrentPolicy` methods
- [ ] `firebase/functions/src/__tests__/unit/AppDriver.ts` - Remove `getCurrentPolicy` methods

### Files to KEEP:
- `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts` (modal still exists)

---

## Phase 7: Update Translations

- [ ] **`webapp-v2/src/locales/en/translation.json`:**
  - Remove: `staticPages.*` keys
  - Add: `footer.linksSection` key
  - KEEP: `policyComponents.*` keys (modal uses these)

---

## Phase 8: Final Verification

- [ ] Run `npm run build` - verify compilation
- [ ] Run `npm run knip` - find orphaned code
- [ ] Run tests
- [ ] Manual checks:
  - Navigate to `/terms`, `/privacy`, `/cookies` → should 404
  - Footer renders tenant-configured external links
  - Policy acceptance modal still works for authenticated users

---

## Files Summary

### DELETE (9 files):
1. `webapp-v2/src/pages/static/PricingPage.tsx`
2. `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
3. `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
4. `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
5. `webapp-v2/src/components/StaticPageLayout.tsx`
6. `webapp-v2/src/components/policy/PolicyRenderer.tsx`
7. `webapp-v2/src/hooks/usePolicy.ts`
8. `webapp-v2/src/__tests__/unit/vitest/components/PolicyRenderer.test.tsx`
9. `firebase/functions/src/__tests__/unit/api/public-policies.test.ts`

### MODIFY (15+ files):
1. `webapp-v2/src/App.tsx`
2. `webapp-v2/src/services/navigation.service.ts`
3. `webapp-v2/src/constants/routes.ts`
4. `webapp-v2/src/app/apiClient.ts`
5. `webapp-v2/src/components/layout/Footer.tsx`
6. `webapp-v2/src/locales/en/translation.json`
7. `packages/shared/src/types/branding.ts`
8. `packages/shared/src/schemas/apiSchemas.ts`
9. `packages/shared/src/shared-types.ts`
10. `packages/shared/src/api.ts`
11. `firebase/functions/src/routes/route-config.ts`
12. `firebase/functions/src/policies/PolicyHandlers.ts`
13. `packages/test-support/src/ApiDriver.ts`
14. `firebase/functions/src/__tests__/unit/AppDriver.ts`
15. `firebase/docs/tenants/*/config.json`
