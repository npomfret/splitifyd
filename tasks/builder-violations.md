# Builder Pattern Violations in Test Suite

This document lists all identified violations of the mandatory builder pattern in the project's test suite. The guiding principle is that all test data objects must be created using builders from the `@billsplit-wl/test-support` package, not with raw object literals. Factory functions that wrap object literals are also considered a violation.

---

## New Builders Created

The following builders were created to address violations:

- `CreatePolicyRequestBuilder` - For policy creation requests
- `UpdatePolicyRequestBuilder` - For policy update requests
- `UpdateUserRequestBuilder` - For full user profile updates
- `UpdateUserStatusRequestBuilder` - For user enable/disable requests
- `UpdateUserRoleRequestBuilder` - For user role changes
- `InitiateMergeRequestBuilder` - For account merge requests
- `AcceptPolicyRequestBuilder` - For policy acceptance requests
- `ChangeEmailRequestBuilder` - For email change requests

---

## Completed Fixes

### 15. `firebase/functions/src/__tests__/integration/security-rules.test.ts` ✅
- Fixed: `withSplits` now uses `ExpenseSplitBuilder.withSplit()` fluent interface
- Fixed: `withBalances` now uses `withBalance()` fluent interface

### 16. `firebase/functions/src/__tests__/unit/api/authorization.test.ts` ✅
- Fixed: `createPolicy` now uses `CreatePolicyRequestBuilder`
- Fixed: `updatePolicy` now uses `UpdatePolicyRequestBuilder`
- Fixed: `updateUser` now uses `UpdateUserStatusRequestBuilder`
- Fixed: `updateUserRole` now uses `UpdateUserRoleRequestBuilder`

### 17. `firebase/functions/src/__tests__/unit/api/expenses.test.ts` ✅
- Fixed: `ExpenseSplitBuilder.exactSplit` replaced with fluent `.withSplit()` interface

### 18. `firebase/functions/src/__tests__/unit/api/merge.test.ts` ✅
- Fixed: `initiateMerge` now uses `InitiateMergeRequestBuilder`

### 32. `firebase/functions/src/__tests__/unit/api/validation.test.ts` (partial) ✅
- Fixed: `ExpenseSplitBuilder.exactSplit` replaced with fluent `.withSplit()` interface

### 24. `firebase/functions/src/__tests__/unit/admin/UserAdminHandlers.test.ts` ✅
- Fixed: `updateUser` now uses `UpdateUserStatusRequestBuilder`
- Fixed: `updateUserRole` now uses `UpdateUserRoleRequestBuilder`

### 27. `firebase/functions/src/__tests__/unit/services/IncrementalBalanceService.scenarios.test.ts` ✅
- Fixed: `withSplits` now uses `ExpenseSplitBuilder.withSplit()` fluent interface

### 28. `firebase/functions/src/__tests__/unit/services/splits/ExactSplitStrategy.test.ts` ✅
- Fixed: `ExpenseSplitBuilder.exactSplit` replaced with fluent `.withSplit()` interface

### 29. `firebase/functions/src/__tests__/unit/services/splits/PercentageSplitStrategy.test.ts` ✅
- Fixed: `ExpenseSplitBuilder.percentageSplit` replaced with fluent `.withSplit()` interface

### 20. `firebase/functions/src/__tests__/unit/api/users.test.ts` ✅
- Fixed: `createPolicy` now uses `CreatePolicyRequestBuilder`
- Fixed: `updatePolicy` now uses `UpdatePolicyRequestBuilder`
- Fixed: `acceptMultiplePolicies` now uses `AcceptPolicyRequestBuilder`
- Fixed: `changeEmail` now uses `ChangeEmailRequestBuilder`

### 21. `firebase/functions/src/__tests__/unit/expenses/ExpenseConcurrentUpdates.test.ts` ✅
- Fixed: `createGroup` now uses `CreateGroupRequestBuilder`

### 48. `firebase/functions/src/__tests__/unit/api/balances.test.ts` ✅
- Verified: Already uses builders correctly. Removed from violations list.

### 26. `firebase/functions/src/__tests__/unit/comments/CommentHandlers.test.ts` ✅
- Fixed: `registerUser` now uses `UserRegistrationBuilder`

---

## Remaining Violations

### 19. `firebase/functions/src/__tests__/unit/api/policies.test.ts`
- **Status:** File no longer exists (may have been removed/renamed).

### 22. `firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts`
- **Violation:** A property is manually deleted from a builder-created object.
- **Recommendation:** The builder should provide a way to omit the property.

### 23. `firebase/functions/src/__tests__/unit/groups/GroupLifecycleSimulator.test.ts`
- **Violation:** `updateGroup` is called with an object literal.
- **Recommendation:** Use `GroupUpdateBuilder`.


### 25. `firebase/functions/src/__tests__/unit/auth/registration-validation.test.ts`
- **Violation:** An array of object literals `incompleteData` is used, and other object literals are used for test data.
- **Recommendation:** Use builders to create test data.

### 30. `firebase/functions/src/__tests__/unit/services/storage/CloudThemeArtifactStorage.test.ts`
- **Violation:** `save` is called with an object literal.
- **Recommendation:** Use a builder for the payload.

### 31. `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts`
- **Violation:** `save` is called with an object literal.
- **Recommendation:** Use a builder for the payload.

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
