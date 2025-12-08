
# Task: Remove All Static Pages and Implement Custom Footer Links

## Objective
Purge all static, marketing, and legal pages from the application, transforming it into a pure, embeddable white-label app. Tenants will be fully responsible for their own static content. This will be replaced by a system allowing tenants to fully customize the links in the application's footer.

## Rationale
The project is pivoting to be a pure white-label application core. The app should not serve or be concerned with any static content (legal, marketing, etc.). This change simplifies the application's scope, reduces maintenance, and gives tenants complete control over their branding, legal compliance, and user-facing links.

---

## Phase 1: Deep Dive & Code Removal

This phase focuses on completely removing all code related to the old static page system.

### `webapp-v2` (Frontend) Cleanup

- [ ] **Delete Static Page Components:**
    - [ ] Delete the entire directory: `webapp-v2/src/pages/static/`
- [ ] **Delete Static Page Layout:**
    - [ ] Delete the component file: `webapp-v2/src/components/StaticPageLayout.tsx`
- [ ] **Remove Routing:**
    - [ ] Edit `webapp-v2/src/App.tsx`:
        - [ ] Remove the lazy-loaded imports for `PricingPage`, `TermsOfServicePage`, `PrivacyPolicyPage`, and `CookiePolicyPage`.
        - [ ] Remove the `<Route>` components for `/pricing`, `/terms`, `/privacy`, and `/cookies`.
- [ ] **Delete Policy Hooks:**
    - [ ] Delete the file: `webapp-v2/src/hooks/usePolicy.ts`
    - [ ] Delete the file: `webapp-v2/src/hooks/usePolicyAcceptance.ts`
- [ ] **Delete Policy UI Components:**
    - [ ] Delete the component file: `webapp-v2/src/components/policy/PolicyAcceptanceModal.tsx`
- [ ] **Update API Client:**
    - [ ] Edit `webapp-v2/src/app/apiClient.ts`:
        - [ ] Remove the `getCurrentPolicy` method.
        - [ ] Remove the `getCurrentPolicyWithAbort` method.

### `packages/shared` (Shared Code) Cleanup

- [ ] **Remove Shared Types:**
    - [ ] Edit `packages/shared/src/shared-types.ts`:
        - [ ] Delete the `PolicyIds` enum.
        - [ ] Delete the `CurrentPolicyResponse` type interface.
- [ ] **Remove Shared Schemas:**
    - [ ] Edit `packages/shared/src/schemas/apiSchemas.ts`:
        - [ ] Remove the Zod schema related to the `CurrentPolicyResponse` (likely named `currentPolicyResponseSchema` or similar).

### `firebase/functions` (Backend) Cleanup

- [ ] **Identify and Remove API Endpoint:**
    - [ ] **Research:** Search the `firebase/functions/src/` directory for the string `/api/policies` or `getCurrentPolicy` to locate the route definition and handler.
    - [ ] **Action:** Delete the identified route from the Express app (likely in `firebase/functions/src/index.ts` or a routing file).
    - [ ] **Action:** Delete the handler function(s) and any associated service files responsible for fetching policy documents from Firestore.
    - [ ] **Action:** Delete any Zod validation schemas in the `firebase/functions/src/validation/` directory related to the policy API.

---

## Phase 2: Implement Tenant-Managed Custom Footer

This phase focuses on building the new, flexible footer link system.

- [ ] **Update Tenant Schema (`packages/shared`):**
    - [ ] Edit the tenant configuration type (likely in `packages/shared/src/shared-types.ts`).
    - [ ] Add a new structure for custom footer links.
    - **Proposed Schema:**
      ```typescript
      // In tenant branding configuration
      "footer": {
        "links": Array<{
          "id": string; // e.g., UUID for stable key
          "label": string;
          "url": string;
        }>
      }
      ```
- [ ] **Enhance Admin UI (`webapp-v2`):**
    - [ ] Locate the Tenant Branding editor component in the admin section.
    - [ ] Implement a new UI section for "Footer Links" that allows a tenant admin to:
        - [ ] Add a new link (providing a Label and a URL).
        - [ ] Edit an existing link's Label and URL.
        - [ ] Reorder the links (e.g., using drag-and-drop).
        - [ ] Delete a link.
    - [ ] Implement robust URL validation on the input fields.
- [ ] **Refactor Webapp Footer (`webapp-v2`):**
    - [ ] **Locate Component:** Identify the main footer component (likely `webapp-v2/src/components/layout/Footer.tsx` or similar).
    - [ ] **Refactor Logic:**
        - [ ] Fetch the `footer.links` array from the tenant's configuration.
        - [ ] Dynamically render the links based on the array content and order.
        - [ ] Ensure links open in a new tab (`target="_blank" rel="noopener noreferrer"`).
        - [ ] If the `links` array is empty or does not exist, the entire link section of the footer should be hidden.

---

## Phase 3: Final Cleanup and Verification

- [ ] **Delete Obsolete Tests:**
    - [ ] Find and delete all test files related to the removed static pages, hooks, and components.
- [ ] **Write New Tests:**
    - [ ] Add tests for the new Admin UI footer link editor.
    - [ ] Add tests for the dynamic rendering of the webapp footer component (testing cases with 0, 1, and multiple links).
- [ ] **Run Static Analysis:**
    - [ ] Execute `npm run knip` (or equivalent) to find and remove any newly orphaned files, types, or exports.
- [ ] **Manual Verification:**
    - [ ] Confirm that navigating to old static page URLs (e.g., `/terms`) correctly results in a 404 page.
    - [ ] Confirm the application functions correctly for tenants with and without custom footer links configured.
    - [ ] Run `npm run build` and `npm run test` to ensure the entire project is in a clean, working state.
