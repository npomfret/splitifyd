# Builder Pattern Violations in Test Suite

This document lists all identified violations of the mandatory builder pattern in the project's test suite. The guiding principle is that all test data objects must be created using builders from the `@billsplit-wl/test-support` package, not with raw object literals. Factory functions that wrap object literals are also considered a violation.

---

## Violations Found

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

### 13. `firebase/functions/src/__tests__/integration/tenant/admin-tenant-publish.test.ts`
- **Violation:** `withBranding` and `withBrandingTokens` are called with object literals. `publishTenantTheme` is called with an object literal. `db.collection.set` and `fetch` body are created with object literals.
- **Recommendation:** Use builders for all data objects.

### 14. `firebase/functions/src/__tests__/integration/tenant/admin-tenant-crud.test.ts`
- **Violation:** `withBranding` and `withMarketingFlags` are called with object literals.
- **Recommendation:** Use builders for these objects.

### 15. `firebase/functions/src/__tests__/integration/security-rules.test.ts`
- **Violation:** Object literals used for `updateData`, `groupBalance`, and `userDataWithoutRole`. `withBalances` is also called with an object literal.
- **Recommendation:** Use builders for all test data objects.

### 16. `firebase/functions/src/__tests__/unit/api/authorization.test.ts`
- **Violation:** Object literals are used for `updateGroup`, `createPolicy`, `updatePolicy`, `updateUser`, `updateUserRole`, `withBranding`, and `withMarketingFlags`.
- **Recommendation:** Use builders for all these data objects.

### 17. `firebase/functions/src/__tests__/unit/api/expenses.test.ts`
- **Violation:** `withSplits` and `ExpenseSplitBuilder.exactSplit` are called with an array of object literals. `updateData` is an object literal.
- **Recommendation:** Use `ExpenseSplitBuilder`'s fluent interface and builders for request objects.

### 18. `firebase/functions/src/__tests__/unit/api/merge.test.ts`
- **Violation:** `initiateMerge` is called with an object literal.
- **Recommendation:** Use a builder for the `InitiateMergeRequest` object.

### 19. `firebase/functions/src/__tests__/unit/api/policies.test.ts`
- **Violation:** `createPolicy` and `updatePolicy` are called with object literals.
- **Recommendation:** Use builders for `CreatePolicyRequest` and `UpdatePolicyRequest`.

### 20. `firebase/functions/src/__tests__/unit/api/users.test.ts`
- **Violation:** `acceptMultiplePolicies` is called with an array of object literals. `updatePolicy` and `changeEmail` are called with object literals.
- **Recommendation:** Use builders for these data objects.

### 21. `firebase/functions/src/__tests__/unit/expenses/ExpenseConcurrentUpdates.test.ts`
- **Violation:** `createGroup` is called with an object literal.
- **Recommendation:** Use `CreateGroupRequestBuilder`.

### 22. `firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts`
- **Violation:** A property is manually deleted from a builder-created object.
- **Recommendation:** The builder should provide a way to omit the property.

### 23. `firebase/functions/src/__tests__/unit/groups/GroupLifecycleSimulator.test.ts`
- **Violation:** `updateGroup` is called with an object literal.
- **Recommendation:** Use `GroupUpdateBuilder`.

### 24. `firebase/functions/src/__tests__/unit/admin/UserAdminHandlers.test.ts`
- **Violation:** `updateUser` and `updateUserRole` are called with object literals.
- **Recommendation:** Use builders for `UpdateUserRequest` and `UpdateUserRoleRequest`.

### 25. `firebase/functions/src/__tests__/unit/auth/registration-validation.test.ts`
- **Violation:** An array of object literals `incompleteData` is used, and other object literals are used for test data.
- **Recommendation:** Use builders to create test data.

### 26. `firebase/functions/src/__tests__/unit/comments/CommentHandlers.test.ts`
- **Violation:** `registerUser` is called with an object literal.
- **Recommendation:** Use `UserRegistrationBuilder`.

### 27. `firebase/functions/src/__tests__/unit/services/IncrementalBalanceService.scenarios.test.ts`
- **Violation:** `withSplits` is called with an array of object literals.
- **Recommendation:** Use `ExpenseSplitBuilder`.

### 28. `firebase/functions/src/__tests__/unit/services/splits/ExactSplitStrategy.test.ts`
- **Violation:** `ExpenseSplitBuilder.exactSplit` is called with an array of object literals.
- **Recommendation:** Use `ExpenseSplitBuilder`'s fluent interface.

### 29. `firebase/functions/src/__tests__/unit/services/splits/PercentageSplitStrategy.test.ts`
- **Violation:** `ExpenseSplitBuilder.percentageSplit` is called with an array of object literals.
- **Recommendation:** Use `ExpenseSplitBuilder`'s fluent interface.

### 30. `firebase/functions/src/__tests__/unit/services/storage/CloudThemeArtifactStorage.test.ts`
- **Violation:** `save` is called with an object literal.
- **Recommendation:** Use a builder for the payload.

### 31. `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts`
- **Violation:** `save` is called with an object literal.
- **Recommendation:** Use a builder for the payload.

### 32. `firebase/functions/src/__tests__/unit/validation.test.ts`
- **Violation:** `updateData` is an object literal.
- **Recommendation:** Use `ExpenseUpdateBuilder`.

### 33. `firebase/functions/src/__tests__/unit/validation/string-validation.test.ts`
- **Violation:** Object spread syntax is used to create test data variations.
- **Recommendation:** Use builders to create test data variations.

### 34. `firebase/functions/src/__tests__/unit/security.test.ts`
- **Violation:** `userInput` is an object literal.
- **Recommendation:** Use a builder.

### 35. `packages/firebase-simulator/src/__tests__/integration/cloudtasks-compatibility.test.ts`
- **Violation:** `createTask` is called with an object literal payload.
- **Recommendation:** Use a builder for the task request.

### 36. `packages/firebase-simulator/src/__tests__/unit/StubCloudTasksClient.test.ts`
- **Violation:** `createTask` is called with an object literal payload.
- **Recommendation:** Use a builder for the task request.

### 37. `packages/firebase-simulator/src/__tests__/unit/StubFirestoreDatabase.test.ts`
- **Violation:** `set` and `update` are called with object literals.
- **Recommendation:** Use builders for test data.

### 38. `packages/firebase-simulator/src/__tests__/unit/StubStorage.test.ts`
- **Violation:** `save` and `seedFile` are called with object literals for metadata.
- **Recommendation:** Use a builder for metadata.

### 39. `packages/shared/src/__tests__/unit/serialization.test.ts`
- **Violation:** `payload` objects are created as object literals.
- **Recommendation:** Use builders.

### 40. `packages/shared/src/__tests__/unit/split-utils.test.ts`
- **Violation:** `expect().toEqual()` used with arrays of object literals.
- **Recommendation:** Use builders for expected values.

### 41. `packages/shared/src/__tests__/unit/tenant-config-schema.test.ts`
- **Violation:** `withMarketingFlags` is called with an object literal.
- **Recommendation:** Use a builder for `MarketingFlags`.

### 42. `webapp-v2/src/__tests__/integration/playwright/group-display-name-settings.test.ts`
- **Violation:** `withMembers` called with an array literal. `fulfillWithSerialization` body is an object literal.
- **Recommendation:** Use builders.

### 43. `webapp-v2/src/__tests__/integration/playwright/group-security-pending-members.test.ts`
- **Violation:** `withPermissions` is called with an object literal.
- **Recommendation:** Use `GroupPermissionsBuilder`.

### 44. `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts`
- **Violation:** `mockGroupsApi`, `createJsonHandler` are called with object literals. `toEqual` is used with an object literal.
- **Recommendation:** Use builders.

### 45. `webapp-v2/src/__tests__/integration/playwright/dashboard-realtime-updates.test.ts`
- **Violation:** `emitRawActivityFeedDocuments` is called with an array of object literals.
- **Recommendation:** Use `ActivityFeedItemBuilder`.

### 46. `firebase/functions/src/__tests__/unit/tenant-validation.test.ts`
- **Violation:** `validateUploadTenantAssetParams` is called with an object literal.
- **Recommendation:** Use a builder for `UploadTenantAssetParams`.

### 47. `firebase/functions/src/__tests__/unit/schema-validation.test.ts`
- **Violation:** `buildGroupResponse` returns an object literal. `listResponse` is an object literal.
- **Recommendation:** Use builders.

### 48. `firebase/functions/src/__tests__/unit/api/balances.test.ts`
- **Violation:** `withSplits` and `ExpenseSplitBuilder.exactSplit` are called with an array of object literals.
- **Recommendation:** Use `ExpenseSplitBuilder`'s fluent interface.

### 49. `webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts`
- **Violation:** `route.fulfill` body is an object literal for mock API responses.
- **Recommendation:** Use builders for mock responses.

### 50. `webapp-v2/src/__tests__/unit/vitest/stores/join-group-store.test.ts`
- **Violation:** `mockResolvedValue` is called with an object literal for the `JoinGroupResponse`.
- **Recommendation:** Use `JoinGroupResponseBuilder`.

### 51. `webapp-v2/src/__tests__/unit/vitest/utils/displayName.test.ts`
- **Violation:** `getGroupDisplayName` is called with an object literal for a partial `GroupMember` object.
- **Recommendation:** Use `GroupMemberBuilder`.

### 52. `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-collection-manager.test.ts`
- **Violation:** `replace` and `append` are called with an object literal for pagination metadata.
- **Recommendation:** Use a builder for pagination metadata.

### 53. `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-side-effects.test.ts`
- **Violation:** `syncMemberThemes` is called with an array of object literals.
- **Recommendation:** Use `GroupMemberBuilder`.

### 54. `webapp-v2/src/__tests__/unit/vitest/stores/groups-pagination-controller.test.ts`
- **Violation:** `applyResult` is called with an object literal for pagination metadata.
- **Recommendation:** Use a builder for pagination metadata.
