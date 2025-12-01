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

### 22. `firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts` ✅
- Fixed: Added `withoutDescription()` method to `CreateGroupRequestBuilder`
- Fixed: Replaced `delete (groupRequest as any).description` with `withoutDescription()` fluent method

### 23. `firebase/functions/src/__tests__/unit/groups/GroupLifecycleSimulator.test.ts` ✅
- Fixed: `updateGroup` now uses `GroupUpdateBuilder`

### 25. `firebase/functions/src/__tests__/unit/auth/registration-validation.test.ts` ✅
- Fixed: Added `empty()` static method to `UserRegistrationBuilder` for incomplete data tests
- Fixed: `incompleteData` array now uses `UserRegistrationBuilder.empty()`
- Fixed: Multiple errors test uses `UserRegistrationBuilder.empty()`
- Fixed: Valid input test uses `UserRegistrationBuilder`

### 30. `firebase/functions/src/__tests__/unit/services/storage/CloudThemeArtifactStorage.test.ts` ✅
- Fixed: Created `ThemeArtifactPayloadBuilder`
- Fixed: `save` now uses `ThemeArtifactPayloadBuilder`

### 31. `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts` ✅
- Fixed: `save` now uses `ThemeArtifactPayloadBuilder`

### 33. `firebase/functions/src/__tests__/unit/validation/string-validation.test.ts` ✅
- Fixed: Replaced spread syntax with factory functions returning builders
- Fixed: Update tests use `ExpenseUpdateBuilder.minimal()`

---

## Remaining Violations

### 19. `firebase/functions/src/__tests__/unit/api/policies.test.ts`
- **Status:** File no longer exists (may have been removed/renamed).

### 34. `firebase/functions/src/__tests__/unit/security.test.ts`
- **Status:** False positive - tests raw user input sanitization, not domain objects. Object literals intentionally represent untrusted input.

### 35-38. `packages/firebase-simulator/` tests
- **Status:** Ignored - firebase-simulator is infrastructure testing, not domain object testing.

### 39. `packages/shared/src/__tests__/unit/serialization.test.ts`
- **Status:** False positive - tests serialization of arbitrary data structures, not domain objects.

### 40. `packages/shared/src/__tests__/unit/split-utils.test.ts`
- **Status:** False positive - object literals in `toEqual()` assertions are expected output verification, not test data creation.

### 41. `packages/shared/src/__tests__/unit/tenant-config-schema.test.ts` ✅
- Fixed: Created `MarketingFlagsBuilder`
- Fixed: `withMarketingFlags` now uses `MarketingFlagsBuilder`

### 42. `webapp-v2/src/__tests__/integration/playwright/group-display-name-settings.test.ts`
- **Status:** False positive - object literals are for mock API message/error responses (e.g., `{ message: 'Group display name updated.' }`), not domain objects. Already uses builders for GroupDTO, GroupFullDetailsBuilder, GroupMemberBuilder.

### 43. `webapp-v2/src/__tests__/integration/playwright/group-security-pending-members.test.ts` ✅
- Fixed: `withPermissions` now uses `GroupPermissionsBuilder.adminOnly().build()`

### 44. `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts`
- **Status:** False positive - already uses `PolicyAcceptanceStatusDTOBuilder` and `UserPolicyStatusResponseBuilder` correctly. Remaining object literals are raw mock API responses for `createJsonHandler`, not domain objects.

### 45. `webapp-v2/src/__tests__/integration/playwright/dashboard-realtime-updates.test.ts`
- **Status:** False positive - `emitRawActivityFeedDocuments` intentionally sends malformed/invalid data to test error handling. Using a builder would defeat the purpose. Already uses `ActivityFeedItemBuilder` for valid data.

### 46. `firebase/functions/src/__tests__/unit/tenant-validation.test.ts`
- **Status:** False positive - tests raw user input validation, not domain objects. Object literals intentionally represent untrusted input.

### 47. `firebase/functions/src/__tests__/unit/schema-validation.test.ts`
- **Status:** False positive - tests schema validation infrastructure with constructed response objects. These are testing the validation mechanism itself.

### 49. `webapp-v2/src/__tests__/integration/playwright/settings-functionality.test.ts`
- **Status:** False positive - mock profile responses in `route.fulfill` derive from already-built `ClientUser` objects. These are HTTP response mocking for Playwright, not domain object construction.

### 50. `webapp-v2/src/__tests__/unit/vitest/stores/join-group-store.test.ts` ✅
- Fixed: `mockResolvedValue` now uses `JoinGroupResponseBuilder`

### 51. `webapp-v2/src/__tests__/unit/vitest/utils/displayName.test.ts`
- **Status:** False positive - tests a utility function that accepts partial objects. The function signature expects `{ groupDisplayName?: string }`, not a full `GroupMember`. Creating a builder for minimal input parameters is unnecessary.

### 52. `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-collection-manager.test.ts`
- **Status:** False positive - pagination metadata objects (`{ hasMore, nextCursor }`) are infrastructure concerns, not domain objects. These are internal state tracking primitives.

### 53. `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-side-effects.test.ts`
- **Status:** False positive - tests infrastructure code with partial objects cast to `any`. The test is checking theme color syncing behavior, not domain object construction.

### 54. `webapp-v2/src/__tests__/unit/vitest/stores/groups-pagination-controller.test.ts`
- **Status:** False positive - pagination metadata objects are infrastructure concerns for controller state management, not domain objects.
