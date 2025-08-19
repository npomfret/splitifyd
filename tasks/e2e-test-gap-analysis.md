# E2E Test and Firebase Codebase Gap Analysis

## 1. Overview

This document provides an analysis of the Firebase backend codebase and the corresponding Playwright E2E test suite. The review focused on identifying critical bugs, feature gaps, and areas for improvement in both the application code and the tests.

## 2. Critical Findings and Recommendations

### 2.1. BUG: Members Cannot Be Added at Group Creation

**Finding:**
A critical bug exists in the `sanitizeGroupData` function located in `firebase/functions/src/groups/validation.ts`. This function is responsible for cleaning and preparing the data for a new group before it's saved. However, it fails to copy the `members` array from the incoming request.

As a result, any members provided during group creation are ignored, and the group is created with only the creator as a member.

**Code Snippet (`firebase/functions/src/groups/validation.ts`):**
```typescript
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
    const sanitized: any = {};

    if ('name' in data && data.name) {
        sanitized.name = sanitizeString(data.name);
    }

    if ('description' in data && data.description !== undefined) {
        sanitized.description = sanitizeString(data.description);
    }

    // !!! BUG: The 'members' array is not copied here !!!

    return sanitized as T;
};
```

**Impact:**
This bug prevents the creation of groups with multiple members from the start, forcing all new members to be added via a share link. This contradicts the apparent design indicated by the `createGroupSchema`, which allows for a `members` array.

**Recommendation:**
The `sanitizeGroupData` function should be fixed to correctly handle the `members` array.

**Suggested Fix:**
```typescript
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
    const sanitized: any = {};

    if ('name' in data && data.name) {
        sanitized.name = sanitizeString(data.name);
    }

    if ('description' in data && data.description !== undefined) {
        sanitized.description = sanitizeString(data.description);
    }

    // Add this block to fix the bug
    if ('members' in data && data.members) {
        sanitized.members = data.members;
    }

    return sanitized as T;
};
```

### 2.2. MISSING FEATURE: Leave Group and Remove Member Functionality

**Finding:**
The E2E tests in `e2e-tests/src/tests/normal-flow/member-management.e2e.test.ts` are incomplete and contain placeholder comments indicating that the functionality is not tested. A deeper review of the backend code confirms that the API endpoints for leaving a group or removing a member from a group are **not implemented**.

**Evidence from `member-management.e2e.test.ts`:**
```typescript
// In a real multi-user test, we would:
// 1. Create a second user
// 2. Share the group link
// 3. Have the second user join
// 4. Verify they see the leave button
```
This comment, and others like it, show that the tests are merely skeletons.

**Impact:**
This is a significant gap in the application's core functionality. Users have no way to leave groups, and group admins have no way to manage their members.

**Recommendation:**
Implement the necessary Firebase Functions and corresponding frontend UI to support:
1.  **Leave Group:** A user should be able to voluntarily leave a group. The system should check for and handle any outstanding debts before allowing the user to leave.
2.  **Remove Member:** A group admin should have the ability to remove another member from the group.

Once implemented, the E2E test suite must be updated with comprehensive, multi-user tests to validate this functionality.

### 2.3. INCOMPLETE TESTS: Member Management E2E Tests

**Finding:**
The entire `member-management.e2e.test.ts` file lacks actual tests. The existing "tests" only perform basic checks for the group owner (e.g., verifying the "Leave Group" button is not visible) and do not test the scenarios for non-owner members.

**Impact:**
There is zero test coverage for member management features, which is a high-risk area for a collaborative application.

**Recommendation:**
The `member-management.e2e.test.ts` file needs to be completely rewritten to include proper multi-user tests. These tests should cover:
*   A non-owner member successfully leaving a group.
*   A group owner successfully removing a member.
*   Validation of the confirmation dialogs for these actions.
*   Edge cases, such as trying to remove the last member of a group.

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

### 2.5. INCONSISTENCY: Error Handling in User Handlers

**Finding:**
The error handling in `firebase/functions/src/user/handlers.ts` is inconsistent. Some functions return a JSON error object with a status code, while others throw an error that is presumably caught by a global error handler.

**Example of inconsistent error handling:**
```typescript
// In getUserProfile
res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'User not authenticated' });

// In updateUserProfile
res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Display name must be a string' });
```
This is different from other parts of the application that use `throw Errors.UNAUTHORIZED()` or `throw new ApiError(...)`.

**Impact:**
Inconsistent error handling can lead to unpredictable behavior in the client application and makes the backend code harder to maintain.

**Recommendation:**
Refactor the error handling in `user/handlers.ts` to consistently use the `ApiError` class or the predefined `Errors` from `utils/errors.ts`. This will ensure that all API responses have a standard error format.

## 3. Integration Test Review

### 3.1. Over-testing of Basic Validation

**Finding:**
The integration tests, particularly `data-validation.test.ts`, dedicate a significant number of tests to basic input validation (e.g., future dates, string lengths, empty strings). While important, this level of detail is better suited for faster, more focused unit tests.

**Impact:**
This inflates the runtime of the integration test suite with checks that don't require a full Firebase emulator environment.

**Recommendation:**
*   Move fine-grained validation tests (e.g., specific date formats, character limits, null/undefined checks) to unit tests for the Joi validation schemas.
*   Keep a smaller set of "smoke tests" in the integration suite to ensure the validation middleware is correctly wired up for each endpoint.

### 3.2. Under-testing of Complex Business Logic

**Finding:**
The tests for complex scenarios are underdeveloped. For example, `complex-unsettled-balance.test.ts` only covers one specific scenario. There is insufficient testing for multi-expense, multi-settlement balance calculations, and edge cases in debt simplification.

**Impact:**
Potential bugs in the core financial logic may go undetected. The current tests do not provide enough confidence in the accuracy of balance calculations under varied conditions.

**Recommendation:**
*   Expand `complex-unsettled-balance.test.ts` to include more scenarios:
    *   Circular debts (A owes B, B owes C, C owes A).
    *   Multiple currencies within the same group.
    *   Scenarios where settlements only partially cover a debt.
*   Create new integration tests specifically for the `debtSimplifier` logic with complex inputs.

### 3.3. Inefficient Test Execution

**Finding:**
The `trigger-debug.test.ts` and `change-detection.test.ts` files use fixed `setTimeout` waits (e.g., `new Promise(resolve => setTimeout(resolve, 3000))`). This is an anti-pattern that leads to slow and potentially flaky tests.

**Impact:**
Tests are slower than necessary and can fail if the asynchronous operation takes longer than the fixed wait time, or pass even if the operation fails, as long as it fails after the timeout.

**Recommendation:**
*   Refactor all tests that use `setTimeout` to use a polling mechanism, like the `pollForChange` helper already present in the codebase.
*   The `pollForChange` helper should be made more generic and moved to a shared test utility file so it can be reused across different test suites.

### 3.4. Redundant Test Setup

**Finding:**
Multiple test files (`api.test.ts`, `groups.test.ts`, `edit-expense.test.ts`, etc.) repeat the same setup logic for creating users and groups.

**Impact:**
This leads to code duplication, making the tests harder to maintain.

**Recommendation:**
*   Create a centralized test setup helper or a Jest `beforeAll` / `beforeEach` block in a shared setup file to handle user and group creation.
*   The existing `FirebaseIntegrationTestUserPool` is a good pattern that should be used more consistently across all integration tests.

### 3.5. Overlapping and Unfocused Tests

**Finding:**
There is significant overlap between `api.test.ts` and other, more specific test files like `groups.test.ts` and `user-management.test.ts`. The `api.test.ts` file has become a catch-all suite that re-tests functionality already covered elsewhere.

**Impact:**
This increases the number of tests to run and maintain without providing additional test coverage. It's unclear where the canonical test for a specific feature resides.

**Recommendation:**
*   Refactor `api.test.ts` to be a high-level "smoke test" suite that only verifies that endpoints are wired up and return a successful response.
*   Move the detailed business logic tests from `api.test.ts` into the appropriate feature-specific test files (e.g., move group creation logic tests to `groups.test.ts`).

### 3.6. Missing Tests for Critical User Flows

**Finding:**
There is a lack of integration tests for critical user profile and authentication flows. For instance, there are no tests to verify what happens when a user updates their profile information (like `displayName`) and how that change is reflected in their group memberships. Password change and reset flows are also untested at the integration level.

**Impact:**
Bugs in profile updates or authentication can have a significant impact on user experience and security.

**Recommendation:**
*   Add integration tests to `user-profile.test.ts` that:
    *   Verify a user can change their `displayName` and `photoURL`.
    *   Verify that after a `displayName` change, the new name is correctly retrieved when fetching group members.
*   Add integration tests for the password change endpoint.

### 3.7. Inconsistent Error Assertion

**Finding:**
Error assertions across the test suite are inconsistent. Some tests use `rejects.toThrow(/some string/i)`, while others inspect the error object for specific properties.

**Example from `security.test.ts`:**
```typescript
await expect(driver.listGroups(token)).rejects.toThrow(/401|unauthorized|invalid/i);
```

**Example from `duplicate-user-registration.test.ts`:**
```typescript
expect(error.response.data).toMatchObject({
    error: {
        code: 'EMAIL_EXISTS',
        message: expect.stringContaining('email already exists'),
    },
});
```

**Impact:**
Inconsistent error checking can make tests less precise and harder to read. The application uses a standardized `ApiError` format, and tests should leverage that.

**Recommendation:**
*   Standardize all API error assertions to check for the specific `error.response.data.error.code` and `message`, rather than relying on broad string matching on the error message. This will make the tests more robust and less brittle.