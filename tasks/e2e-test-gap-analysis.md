# E2E Test and Firebase Codebase Gap Analysis

## Implementation Status Summary

| Issue | Status | Description |
|-------|--------|-------------|
| Members Cannot Be Added at Group Creation | ✅ Fixed | Fixed bug in `sanitizeGroupData` function |
| Leave Group/Remove Member Functionality | ✅ Verified | Already implemented in `memberHandlers.ts` |
| Member Management E2E Tests | ✅ Implemented | Comprehensive multi-user tests added |
| Real-Time UI Updates | ❌ Pending | Requires frontend implementation |
| Error Handling in User Handlers | ✅ Fixed | Refactored to use consistent ApiError pattern |
| Request Body Validation Missing | ❌ Pending | User and Policy handlers need Joi validation |

## 1. Overview

This document provides an analysis of the Firebase backend codebase and the corresponding Playwright E2E test suite. The review focused on identifying critical bugs, feature gaps, and areas for improvement in both the application code and the tests.

## Key Discovery

While investigating validation patterns in the codebase, I discovered that several handlers are **not following the project's Joi validation pattern**:
- **User handlers** directly destructure `req.body` without validation schemas
- **Policy handlers** use type assertions without proper validation
- This violates the established pattern and could lead to **security vulnerabilities**

This is a critical issue that should be addressed to ensure consistent and secure input validation across all API endpoints.

## 2. Critical Findings and Recommendations

### 2.1. ✅ FIXED: Members Cannot Be Added at Group Creation

**Status:** ✅ Fixed

**Finding:**
A critical bug existed in the `sanitizeGroupData` function located in `firebase/functions/src/groups/validation.ts`. This function was responsible for cleaning and preparing the data for a new group before it's saved. However, it failed to copy the `members` array from the incoming request.

**Resolution:**
The `sanitizeGroupData` function has been fixed to correctly handle the `members` array. The function now properly copies this field when present in the request data. Additionally, the unused `memberEmails` field has been removed from the validation schema for clarity.

**Fixed Code (`firebase/functions/src/groups/validation.ts`):**
```typescript
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
    const sanitized: any = {};

    if ('name' in data && data.name) {
        sanitized.name = sanitizeString(data.name);
    }

    if ('description' in data && data.description !== undefined) {
        sanitized.description = sanitizeString(data.description);
    }

    // Handle members array if present
    if ('members' in data && data.members) {
        sanitized.members = data.members;
    }

    return sanitized as T;
};
```

### 2.2. ✅ VERIFIED: Leave Group and Remove Member Functionality Already Exists

**Status:** ✅ Already Implemented

**Finding:**
Initial analysis suggested the API endpoints for leaving a group or removing a member were not implemented. However, deeper investigation revealed these features are already fully implemented.

**Verification:**
The following endpoints are already implemented and registered in the API:

1. **Leave Group Endpoint:** 
   - Route: `POST /groups/:id/leave`
   - Handler: `firebase/functions/src/groups/memberHandlers.ts:leaveGroup`
   - Features:
     - Validates user membership
     - Prevents group owner from leaving
     - Checks for outstanding balances before allowing departure
     - Updates group memberIds array

2. **Remove Member Endpoint:**
   - Route: `DELETE /groups/:id/members/:memberId`
   - Handler: `firebase/functions/src/groups/memberHandlers.ts:removeGroupMember`
   - Features:
     - Only allows group owner to remove members
     - Prevents removal of the group owner
     - Checks for outstanding balances before removal
     - Updates group memberIds array

**Note:** The E2E tests still need to be updated to properly test these existing features with multi-user scenarios.

### 2.3. ✅ IMPLEMENTED: Member Management E2E Tests

**Status:** ✅ Implemented

**Finding:**
The `member-management.e2e.test.ts` file originally contained only placeholder tests that didn't actually test multi-user scenarios.

**Resolution:**
The file has been completely rewritten with comprehensive multi-user tests that cover:
*   **Owner restrictions:** Owner cannot see Leave Group button but can see Settings
*   **Non-owner leaving:** Member can successfully leave a group with confirmation dialog
*   **Owner removing member:** Owner can remove a member with confirmation dialog
*   **Balance restrictions:** Members cannot leave/be removed with outstanding balances
*   **Settlement clearing:** After settling balances, leave/remove operations work
*   **Edge cases:** Removing the last non-owner member leaves owner alone in group

All tests follow the project's E2E testing guidelines:
- Use `multiUserTest` fixture for proper multi-user scenarios
- Serialize operations (no parallel user actions)
- Use `waitForUserSynchronization` for proper state sync
- No `page.reload()` - rely on real-time updates
- Detailed error messages for debugging
- 1.5 second action timeout enforced

### 2.4. FEATURE GAP: Lack of Real-Time UI Updates

**Finding:**
A comment in `e2e-tests/src/tests/normal-flow/group-management.e2e.test.ts` explicitly states that real-time updates are not fully implemented and that the page must be reloaded to see changes.

**Evidence from `group-management.e2e.test.ts`:**
```typescript
// NOTE: Real-time updates are not fully implemented yet (see docs/guides/end-to-end_testing.md:438)
// We need to reload to see the updated group name
await page.reload();
```

**Impact:**
This leads to a poor user experience, as users expect to see changes reflected immediately in a modern web application. It also complicates E2E tests, requiring manual reloads.

**Recommendation:**
Implement a real-time data synchronization mechanism (e.g., using Firestore's `onSnapshot` listeners) in the frontend to ensure that UI components automatically update when the underlying data changes. This will improve the user experience and make the E2E tests more robust and realistic.

### 2.5. ✅ FIXED: Error Handling in User Handlers

**Status:** ✅ Fixed

**Finding:**
The error handling in `firebase/functions/src/user/handlers.ts` was inconsistent. Some functions returned a JSON error object with a status code, while others threw an error that was caught by a global error handler.

**Resolution:**
All error handling in `user/handlers.ts` has been refactored to consistently use the `ApiError` class and predefined `Errors` from `utils/errors.ts`. The handlers now:
- Use `throw Errors.UNAUTHORIZED()` for authentication errors
- Use `throw Errors.INVALID_INPUT()` for validation errors
- Use `throw Errors.MISSING_FIELD()` for missing required fields
- Let the global error handler in `index.ts` catch and format all errors consistently

This ensures all API responses have a standard error format and makes the codebase more maintainable.

### 2.6. VALIDATION GAP: Missing Joi Validation in Some Handlers

**Status:** ❌ Pending Fix

**Finding:**
Several API handlers are not following the project's standard pattern of using Joi schemas for request body validation. Instead, they directly destructure `req.body` and perform manual validation.

**Affected Handlers:**

1. **User Handlers** (`user/handlers.ts`):
   - `updateUserProfile` - directly destructures `displayName` and `photoURL`
   - `changePassword` - directly destructures `currentPassword` and `newPassword`
   - `sendPasswordResetEmail` - directly destructures `email`
   - `deleteAccount` - directly destructures `confirmDelete`

2. **Policy Handlers** (`policies/handlers.ts` and `policies/user-handlers.ts`):
   - `createPolicy` - uses type assertion without validation
   - `updatePolicy` - uses type assertion without validation
   - `publishPolicy` - uses type assertion without validation
   - `acceptPolicy` - uses type assertion without validation
   - `acceptMultiplePolicies` - uses type assertion without validation

**Impact:**
- Inconsistent validation patterns across the codebase
- Potential security vulnerabilities from improper input validation
- Manual validation code is harder to maintain and more error-prone
- Violates the project's established pattern

**Recommendation:**
Create proper Joi validation schemas for all affected handlers following the pattern used in groups, expenses, and settlements handlers. This includes:
1. Creating `user/validation.ts` with schemas for user operations
2. Creating `policies/validation.ts` with schemas for policy operations
3. Updating all handlers to use the validation functions before accessing request data
