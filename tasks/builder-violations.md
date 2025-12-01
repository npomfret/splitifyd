# Builder Pattern Violations in Test Suite

This document lists all identified violations of the mandatory builder pattern in the project's test suite. The guiding principle is that all test data objects must be created using builders from the `@billsplit-wl/test-support` package, not with raw object literals. Factory functions that wrap object literals are also considered a violation.

---

## Violations Found (Analysis in Progress)

### 1. `webapp-v2/src/__tests__/unit/vitest/stores/config-store.test.ts`

-   **Violation:** The `baseConfig` helper function creates a `ClientAppConfiguration` object and its nested `firebase` and `tenant` properties using object literals.
-   **Line:** `const baseConfig = (branding?: BrandingConfig): ClientAppConfiguration => ({ ... });`
-   **Recommendation:** Create a `ClientAppConfigurationBuilder` to construct the configuration object.

### 2. `firebase/functions/src/__tests__/unit/config-response.test.ts`

-   **Violation:** Multiple instances of `TenantConfig`, `TenantRequestContext`, and nested `branding` and `themeArtifact` objects are created using object literals.
-   **Examples:** `sourceTenant`, `tenant`, `context`, `tenantWithoutMarketingFlags`.
-   **Recommendation:** A `TenantConfigBuilder` and `TenantRequestContextBuilder` should be created and used.

### 3. `firebase/functions/src/__tests__/integration/config.test.ts`

-   **Violation:** In the `beforeAll` block, tenant data for seeding the test database is created with a raw object literal inside the `.set()` call.
-   **Line:** `await db.collection(FirestoreCollections.TENANTS).doc(marketingTenantId).set({ ... });`
-   **Recommendation:** Use a `TenantConfigBuilder` (or similar) to build the tenant data object before seeding.

### 4. `firebase/functions/src/__tests__/unit/services/MergeService.test.ts`

-   **Violation:** Test data for `User` documents and Auth records are created with object literals and passed to `db.seed()` and `stubAuth.setUser()`.
-   **Example:** `db.seed('users/...' , { id: ..., email: ... });` and `stubAuth.setUser(..., { uid: ..., email: ... });`
-   **Recommendation:** A `UserDocumentBuilder` and/or `AuthUserBuilder` should be created and used for seeding test data.

### 5. `firebase/functions/src/__tests__/unit/validation/date-validation.test.ts`

-   **Violation:** In the `'should allow updates without date field'` test, an `updateData` object (representing a partial `UpdateExpenseRequest`) is created as an object literal.
-   **Line:** `const updateData = { description: 'Updated description' };`
-   **Recommendation:** Use the existing `ExpenseUpdateBuilder.minimal().withDescription(...)` to construct the partial update object.

### 6. `firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts`

-   **Violation:** The `app.updateGroupPermissions` method is called with a raw object literal to define the permissions payload.
-   **Line:** `await app.updateGroupPermissions(groupId, { expenseEditing: ..., ... }, ownerId1);`
-   **Recommendation:** Create and use a `GroupPermissionsBuilder`.

### 7. `firebase/functions/src/__tests__/unit/pagination.test.ts`

-   **Violation:** `CursorData` objects are created using object literals throughout the test file.
-   **Line:** `const cursorData: CursorData = { updatedAt: ..., id: ... };`
-   **Recommendation:** Create and use a `CursorDataBuilder`.

### 8. `firebase/functions/src/__tests__/unit/services/TenantRegistryService.test.ts`

-   **Violation:** The `withBranding` method on the `AdminTenantRequestBuilder` is called with a raw object literal.
-   **Line:** `.withBranding({ appName: ..., logoUrl: ... })`
-   **Recommendation:** Use the `BrandingConfigBuilder` to construct the branding object and pass the result to `withBranding`.

### 9. `firebase/functions/src/__tests__/unit/services/FirestoreWriter.test.ts`

-   **Violation:** Similar to the `TenantRegistryService` test, the `withBranding` method on the `TenantPayloadBuilder` is called with a raw object literal.
-   **Line:** `.withBranding({ appName: ..., logoUrl: ... })`
-   **Recommendation:** Use a `BrandingConfigBuilder` to construct the branding object.

### 10. `webapp-v2/src/__tests__/unit/vitest/hooks/usePayerSelector.test.ts`

-   **Violation:** The `createTestMembers` factory function creates an array of `ExpenseFormMember` objects using object literals.
-   **Line:** `const createTestMembers = (): ExpenseFormMember[] => [ { uid: ... }, ... ];`
-   **Recommendation:** Create and use an `ExpenseFormMemberBuilder`.

### 11. `firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts`

-   **Violation:** The `db.seed()` method is used repeatedly with object literals to create test data for `users`, `account-merges`, `groups`, `expenses`, etc.
-   **Example:** `db.seed('groups/group-1', { id: 'group-1', ownerId: ... });`
-   **Recommendation:** Use the appropriate builders for each data type before seeding.

### 12. `firebase/functions/src/__tests__/unit/services/PolicyService.test.ts`

-   **Violation:** The `app.createPolicy` method is called with a raw object literal for the `CreatePolicyRequest` payload.
-   **Line:** `await app.createPolicy({ policyName, text: policyText }, adminToken);`
-   **Recommendation:** Create and use a `CreatePolicyRequestBuilder`.
