# Test Data Builder Audit Report

This document reports the findings of an audit of all test files in the project. The audit was conducted to identify any test cases that manually create raw data objects instead of using the required builder pattern.

## Progress (Updated 2025-01-28)

### ✅ COMPLETED - New Builders Created
- `TenantBrandingUpdateBuilder` - For `UpdateTenantBrandingRequest` testing
- `AddTenantDomainRequestBuilder` - For `AddTenantDomainRequest` testing
- `ActivityFeedResponseBuilder` - For `ActivityFeedResponse` objects
- `ActivityFeedRealtimePayloadBuilder` - For `ActivityFeedRealtimePayload` objects

### ✅ COMPLETED - Enhanced Existing Builders
- `CreateExpenseRequestBuilder`: Added `withMismatchedSplitTotal()`, `withInvalidCurrencyPrecision()`
- `UserRegistrationBuilder`: Added `withInvalidPassword()`
- `AdminTenantRequestBuilder`: Added `withInvalidTenantId()`, `withInvalidPrimaryColor()`
- `ActivityFeedRealtimePayloadBuilder`: Added `withNullCursor()`
- `CreateGroupRequestBuilder`: Added `static empty()` factory method
- `BrandingTokensBuilder`: Added `withWordmarkUrl()`, `withMotionFlags()`, `withAllPaletteColors()`

### ✅ COMPLETED - Fixed Test Files
| File | Status |
|------|--------|
| `GroupLifecycleSimulator.test.ts` | ✅ Fixed - uses `registerUser()` helper with `UserRegistrationBuilder` |
| `security-rules.test.ts` | ✅ Fixed - uses `GroupUpdateBuilder`, `ExpenseUpdateBuilder`, `SettlementUpdateBuilder` |
| `ExpenseHandlers.test.ts` | ✅ Fixed - uses `ExpenseUpdateBuilder` and `withInvalidX()` methods |
| `ThemeArtifactService.test.ts` | ✅ Fixed - uses `BrandingTokensBuilder` |
| `admin.test.ts` | ✅ Fixed - uses `AdminTenantRequestBuilder` with new helper methods |
| `GroupHandlers.test.ts` | ✅ Fixed - uses `CreateGroupRequestBuilder.empty()` and `GroupUpdateBuilder.empty()` |
| `SettlementHandlers.test.ts` | ✅ Fixed - uses `SettlementUpdateBuilder.empty()` |
| `GroupService.test.ts` | ✅ Fixed - uses `GroupUpdateBuilder` methods |
| `authorization.test.ts` | ✅ Fixed - uses `TenantBrandingUpdateBuilder`, `AddTenantDomainRequestBuilder`, `SettlementUpdateBuilder` |
| `validation.test.ts` | ✅ Fixed - uses `CreateExpenseRequestBuilder` with `withMismatchedSplitTotal()`, `withInvalidCurrencyPrecision()` |
| `admin-tenant-crud.test.ts` | ✅ Fixed - uses `AdminTenantRequestBuilder` with `withInvalidTenantId()`, `withInvalidPrimaryColor()` |
| `auth-and-registration.test.ts` | ✅ Fixed - uses `UserRegistrationBuilder` with `withInvalidPassword()` |
| `activity-feed-store.test.ts` | ✅ Fixed - uses `ActivityFeedResponseBuilder`, `ActivityFeedRealtimePayloadBuilder` |
| `group-detail-realtime-coordinator.test.ts` | ✅ Fixed - uses `ActivityFeedItemBuilder`, `ActivityFeedRealtimePayloadBuilder` |

### ⏭️ ACCEPTABLE EXCEPTIONS (No Changes Needed)
| File | Reason |
|------|--------|
| `CommentService.test.ts` | Query parameter validation tests - testing raw query objects is appropriate |
| `check-invalid-data-does-not-break-the-api.integration.test.ts` | Intentionally corrupted data for error handling tests |
| `split-utils.test.ts` | Testing raw numbers to demonstrate floating point issues (why we use strings) |
| `PolicyService.test.ts` | Extracting subset of fields from existing object for assertion |
| `ThemeArtifactStorage.test.ts` | Internal storage service payload, not a DTO |
| `debtSimplifier.test.ts` | Already uses `UserBalanceBuilder` - false positive in audit |

### 🔄 REMAINING (Low Priority)
- `e2e-tests/src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/group-security-pending-members.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/group-detail-comments-pagination.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/settlement-history-locked.test.ts`
- `webapp-v2/src/__tests__/unit/vitest/stores/groups-realtime-coordinator.test.ts`
- `webapp-v2/src/__tests__/integration/playwright/dashboard-archive-groups.test.ts`
- `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-side-effects.test.ts`
- `webapp-v2/src/__tests__/unit/vitest/stores/comments-store.test.ts`

---

## Original Findings

The following files contain violations of the builder pattern requirement. Each entry includes the file path, line number, and the code that violates the rule.

---

### `firebase/functions/src/__tests__/unit/groups/GroupLifecycleSimulator.test.ts`

This file contains numerous violations where user objects are created as raw objects, instead of using the `UserRegistrationBuilder`. A helper function `registerUsers` is defined to take raw objects, which encourages this anti-pattern. The `registerUsers` function should be refactored to accept built objects from the `UserRegistrationBuilder`.

- **Line 52:** `const owner = { id: 'owner-user', displayName: 'Owner' };`
- **Line 53:** `const member = { id: 'member-user', displayName: 'Member' };`
- **Line 107:** `const owner = { id: 'delete-owner', displayName: 'Owner' };`
- **Line 108:** `const member = { id: 'delete-member', displayName: 'Member' };`
- **Line 127:** `const owner = { id: 'secure-owner', displayName: 'Owner' };`
- **Line 128:** `const member = { id: 'secure-member', displayName: 'Member' };`
- **Line 129:** `const outsider = { id: 'secure-outsider', displayName: 'Outsider' };`
- **Line 157:** `const owner = { id: 'member-owner', displayName: 'Owner' };`
- **Line 158:** `const member = { id: 'member-joiner', displayName: 'Joiner' };`
- **Line 184:** `const owner = { id: 'leave-owner', displayName: 'Owner' };`
- **Line 185:** `const member = { id: 'leave-member', displayName: 'Leaver' };`
- **Line 199:** `const owner = { id: 'timestamp-owner', displayName: 'Owner' };`
- **Line 200:** `const member = { id: 'timestamp-member', displayName: 'Member' };`
- **Line 216:** `const owner = { id: 'sequence-owner', displayName: 'Owner' };`
- **Line 217:** `const memberOne = { id: 'sequence-member-1', displayName: 'Member One' };`
- **Line 218:** `const memberTwo = { id: 'sequence-member-2', displayName: 'Member Two' };`
- **Line 231:** `const owner = { id: 'mixed-owner', displayName: 'Owner' };`
- **Line 232:** `const memberOne = { id: 'mixed-member-1', displayName: 'Member One' };`
- **Line 233:** `const memberTwo = { id: 'mixed-member-2', displayName: 'Member Two' };`
- **Line 247:** `const owner = { id: 'full-owner', displayName: 'Owner' };`
- **Line 248:** `const memberA = { id: 'full-member-a', displayName: 'Member A' };`
- **Line 249:** `const memberB = { id: 'full-member-b', displayName: 'Member B' };`
- **Line 293:** `const owner = { id: 'consistent-owner', displayName: 'Owner' };`
- **Line 294:** `const member = { id: 'consistent-member', displayName: 'Member' };`
- **Line 339:** `const owner = { id: 'listing-owner', displayName: 'Listing Owner' };`
- **Line 456:** `const other = { id: 'listing-other', displayName: 'Other User' };`
- **Line 521:** `const owner = { id: 'edge-owner', displayName: 'Owner' };`
- **Line 548:** `const owner = { id: 'edge-multi-owner', displayName: 'Owner' };`
- **Line 584:** `const owner = { id: 'edge-delete-owner', displayName: 'Owner' };`
- **Line 585:** `const member = { id: 'edge-delete-member', displayName: 'Member' };`
- **Line 611:** `const owner = { id: 'edge-split-owner', displayName: 'Owner' };`
- **Line 642:** `const owner = { id: toUserId('edge-update-owner'), displayName: 'Owner' };`
- **Line 643:** `const member = { id: toUserId('edge-update-member'), displayName: 'Member' };`

---

### `firebase/functions/src/__tests__/integration/security-rules.test.ts`

This file contains several violations where test data is created as raw objects.

- **Line 140:** `const updateData = { name: 'Updated Group Name', };`
- **Line 195:** `const updateData = { description: 'Updated Expense', };`
- **Line 240:** `const updateData = { amount: '75', };`
- **Line 432:** `const updateData = { version: '2.0.0', };`
- **Line 472:** `const updateData = { lastUpdated: new Date(), };`
- **Line 543:** `const emptyMembersGroup = { ...new GroupDTOBuilder().withName('Empty Members Group').build(), memberIds: [] as string[], };`

---

### `firebase/functions/src/__tests__/unit/expenses/ExpenseHandlers.test.ts`

This file contains numerous violations where `UpdateExpenseRequest` objects are created as raw objects. It also modifies built objects by casting them to `any`, which is a bad practice. The builders should be updated to allow setting invalid data for testing purposes.

- **Line 88:** `(expenseRequest as any).groupId = '';`
- **Line 98:** `(expenseRequest as any).paidBy = '';`
- **Line 111:** `(expenseRequest as any).amount = 0;`
- **Line 124:** `(expenseRequest as any).amount = -50;`
- **Line 137:** `(expenseRequest as any).description = '';`
- **Line 150:** `(expenseRequest as any).label = 'a'.repeat(51);`
- **Line 163:** `(expenseRequest as any).splitType = 'invalid';`
- **Line 176:** `(expenseRequest as any).participants = [];`
- **Line 241:** `const updateRequest: UpdateExpenseRequest = { description: 'Updated description', };`
- **Line 271:** `const updateRequest: UpdateExpenseRequest = { label: 'Transport', };`
- **Line 283:** `const updateRequest: UpdateExpenseRequest = { amount: '150' };`
- **Line 305:** `const updateRequest: UpdateExpenseRequest = { amount: '100.50', currency: jpy, };`
- **Line 319:** `const updateRequest: UpdateExpenseRequest = { description: '', };`
- **Line 332:** `const updateRequest: UpdateExpenseRequest = { label: 'a'.repeat(51), };`

---

### `firebase/functions/src/__tests__/unit/debtSimplifier.test.ts`

This file creates `UserBalance` objects manually, while a `UserBalanceBuilder` is available and used in the same file.

- **Line 143:** `const balances: Record<string, UserBalance> = { ... }`
- **Line 183:** `const balances: Record<string, UserBalance> = { ... }`

---

### `packages/shared/src/__tests__/unit/split-utils.test.ts`

This file creates request objects manually.

- **Line 718:** `const request = { amount, splits };`
- **Line 850:** `const request: ExpenseRequest = { ... }`

---

### `firebase/functions/src/__tests__/integration/PolicyService.test.ts`

This file creates a raw object to hold policy data.

- **Line 50:** `createResult = { id: existingPolicy.id, currentVersionHash: existingPolicy.currentVersionHash, };`

---

### `firebase/functions/src/__tests__/integration/auth-and-registration.test.ts`
- **Line 211:** `const invalidData = { ...userData, password: toPassword('123') };`

---

### `firebase/functions/src/__tests__/unit/services/CommentService.test.ts`
- **Line 509:** `const query = { limit };`
- **Line 525:** `const query = { limit };`
- **Line 548:** `const query = { cursor: 'cursor-123', limit: 25 };`
- **Line 558:** `const query = { ... };`

---

### `firebase/functions/src/__tests__/unit/services/storage/ThemeArtifactStorage.test.ts`
- **Line 24:** `const payload = { ... };`

---

### `firebase/functions/src/__tests__/integration/check-invalid-data-does-not-break-the-api.integration.test.ts`
- **Line 93:** `const corruptedGroup = { ... };`
- **Line 146:** `const malformedGroup = { ... };`
- **Line 169:** `const corruptedGroup = { ... };`

---

### `firebase/functions/src/__tests__/unit/services/tenant/ThemeArtifactService.test.ts`
- **Line 23:** `const mockTokens: BrandingTokens = { ... };`
- **Line 205:** `const differentTokens: BrandingTokens = { ... };`
- **Line 301:** `const tokensWithNulls = { ... };`
- **Line 333:** `const tokensWithMotion: BrandingTokens = { ... };`
- **Line 361:** `const minimalTokens: BrandingTokens = { ... };`
- **Line 401:** `const tokensWithSkeletonColors: BrandingTokens = { ... };`

---

### `firebase/functions/src/__tests__/integration/tenant/admin-tenant-crud.test.ts`
- **Line 65:** `const payload = { ... };`
- **Line 383:** `const payload = { ... };`

---

### `firebase/functions/src/__tests__/unit/api/validation.test.ts`
- **Line 58:** `const invalidExpense = { ... };`
- **Line 88:** `const invalidExpense = { ... };`

---

### `firebase/functions/src/__tests__/unit/api/authorization.test.ts`
- **Line 339:** `const brandingData = { ... };`
- **Line 380:** `const brandingData = { ... };`
- **Line 408:** `const domainData = { ... };`
- **Line 421:** `const domainData = { ... };`
- **Line 459:** `const invalidData = { ... };`
- **Line 472:** `const invalidData = { ... };`
- **Line 658:** `payload.brandingTokens = { tokens: explicitTokens };`

---

### `firebase/functions/src/__tests__/unit/api/admin.test.ts`
- **Line 48:** `const invalidPayload = { ... };`
- **Line 127:** `const payload = { ... };`
- **Line 281:** `const magicNumbers: Record<string, number[]> = { ... };`
- **Line 521:** `const customFonts = { ... };`
- **Line 549:** `const customFonts = { ... };`
- **Line 626:** `payload.brandingTokens!.tokens.semantics.colors.gradient = {};`
- **Line 651:** `createPayload.brandingTokens!.tokens.semantics.colors.gradient = {};`
- **Line 671:** `updatePayload.brandingTokens!.tokens.semantics.colors.gradient = {};`
- **Line 710:** `const customGlass = { ... };`
- **Line 738:** `const customGlass = { ... };`

---

### `firebase/functions/src/__tests__/unit/groups/GroupHandlers.test.ts`
- **Line 138:** `const invalidRequest = {};`
- **Line 242:** `const updateRequest = {};`

---

### `firebase/functions/src/__tests__/unit/settlements/SettlementHandlers.test.ts`
- **Line 672:** `const updateRequest = { amount: '150' };`
- **Line 683:** `const updateRequest = {};`
- **Line 694:** `const updateRequest = { ... };`
- **Line 718:** `const updateRequest = { amount: '150', currency: USD };`
- **Line 847:** `const updateRequest = { amount: '0' };`
- **Line 858:** `const updateRequest = { amount: '-50' };`
- **Line 870:** `const updateRequest = { note: longNote };`

---

### `firebase/functions/src/__tests__/unit/GroupService.test.ts`
- **Line 308:** `const invalidData = { ... };`
- **Line 350:** `const update = { name: '  Updated Name  ' };`
- **Line 366:** `const update = { description: '...' };`
- **Line 376:** `const update = { description: '  Updated description  ' };`
- **Line 405:** `const update = { ... };`

---

### `e2e-tests/src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts`
- **Line 619:** `const updatedData = { ... };`

---

### `webapp-v2/src/__tests__/integration/playwright/group-security-pending-members.test.ts`
- **Line 127:** `const activeVersion = { ... };`

---

### `webapp-v2/src/__tests__/integration/playwright/policy-acceptance-modal.test.ts`
- **Line 45:** `const pendingResponse = { ... };`
- **Line 51:** `const acceptedResponse = { ... };`

---

### `webapp-v2/src/__tests__/integration/playwright/group-detail-comments-pagination.test.ts`
- **Line 66:** `const initialComments: ListCommentsResponse = { ... };`
- **Line 72:** `const nextPageComments: ListCommentsResponse = { ... };`
- **Line 176:** `const initialComments: ListCommentsResponse = { ... };`
- **Line 182:** `const nextPageComments: ListCommentsResponse = { ... };`

---

### `webapp-v2/src/__tests__/integration/playwright/settlement-history-locked.test.ts`
- **Line 160:** `const lockedSettlement = { ...initialSettlement, isLocked: true };`

---

### `webapp-v2/src/__tests__/unit/vitest/stores/groups-realtime-coordinator.test.ts`
- **Line 107:** `const payload: ActivityFeedRealtimePayload = { ... };`
- **Line 135:** `const payload: ActivityFeedRealtimePayload = { ... };`

---

### `webapp-v2/src/__tests__/integration/playwright/dashboard-archive-groups.test.ts`
- **Line 34:** `const archivedMember = { ...activeMember, memberStatus: MemberStatuses.ARCHIVED };`

---

### `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-side-effects.test.ts`
- **Line 8:** `const permissions = { ... };`
- **Line 13:** `const theme = { ... };`
- **Line 37:** `const group = { id: groupId } as any;`

---

### `webapp-v2/src/__tests__/unit/vitest/stores/comments-store.test.ts`
- **Line 93:** `activityFeedMock = { ... };`

---

### `webapp-v2/src/__tests__/unit/vitest/stores/group-detail-realtime-coordinator.test.ts`
- **Line 91:** `const payload: ActivityFeedRealtimePayload = { ... };`
- **Line 121:** `const payload: ActivityFeedRealtimePayload = { ... };`

---

### `webapp-v2/src/__tests__/unit/vitest/stores/activity-feed-store.test.ts`
- **Line 92:** `const initialResponse: ActivityFeedResponse = { ... };`
- **Line 98:** `const loadMoreResponse: ActivityFeedResponse = { ... };`
- **Line 111:** `const realtimeUpdate: ActivityFeedRealtimePayload = { ... };`
- **Line 128:** `const initialResponse: ActivityFeedResponse = { ... };`
- **Line 138:** `const loadMoreResponse: ActivityFeedResponse = { ... };`
- **Line 315:** `const update: ActivityFeedRealtimePayload = { ... };`