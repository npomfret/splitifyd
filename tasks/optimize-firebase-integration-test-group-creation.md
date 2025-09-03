# Task: Optimize Firebase Integration Tests by Reusing Groups

## 1. Overview

Similar to the E2E tests, the Firebase integration tests frequently create new groups as part of the test setup (`beforeEach` block). This is often unnecessary, as many tests simply need *any* group to exist to test other functionality (like expenses, settlements, or comments). 

This redundant group creation slows down the entire integration test suite. By creating a group once and reusing it across multiple test files for a given test user, we can significantly improve test execution speed and efficiency.

## 2. Proposed Solution

We will introduce a test helper utility, for example, within `@splitifyd/test-support`, that provides a shared, lazily-initialized group for a given test user.

**Proposed Helper: `TestGroupManager`**

A static class or singleton could manage test groups:

```typescript
// In a test-support helper file
class TestGroupManager {
    private static userGroups: Map<string, Promise<Group>> = new Map();

    public static async getOrCreateGroup(user: AuthenticatedFirebaseUser): Promise<Group> {
        if (!this.userGroups.has(user.uid)) {
            const apiDriver = new ApiDriver();
            const groupPromise = apiDriver.createGroup({
                name: `Reusable Test Group for ${user.displayName}`,
            }, user.token);
            this.userGroups.set(user.uid, groupPromise);
        }
        return this.userGroups.get(user.uid)!;
    }
}
```

Test files would then replace their `beforeEach` group creation logic with a single call:

```typescript
// In a test file
let testGroup: any;
let user: AuthenticatedFirebaseUser;

beforeEach(async () => {
    [user] = await borrowTestUsers(1);
    testGroup = await TestGroupManager.getOrCreateGroup(user);
});
```

This ensures the `createGroup` API call is only made once per user across the entire test run.

## 3. Candidate Tests for Refactoring

The following integration test files are excellent candidates for this optimization. They create groups for setup but their primary focus is not on group functionality itself.

-   `firebase/functions/src/__tests__/integration/normal-flow/api/expense-management.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/api/settlement-management.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/comments.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/balance-calculation.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/edit-expense.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/group-members.test.ts`
-   `firebase/functions/src/__tests__/integration/edge-cases/permission-edge-cases.test.ts`

## 4. Tests to Exclude

These files test the group lifecycle itself (creation, updates, deletion, etc.) and should continue to create their own groups to ensure the functionality is tested in isolation.

-   `firebase/functions/src/__tests__/integration/normal-flow/groups/group-crud.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/business-logic/group-lifecycle.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/groups/group-invites.test.ts`
-   `firebase/functions/src/__tests__/integration/normal-flow/permission-system.test.ts`

## 5. Implementation Steps

1.  **Create `TestGroupManager`:**
    *   Implement the static helper class in a shared test support file (e.g., in `packages/test-support/`).
    *   Ensure it correctly handles lazy initialization and caches the group promise per user ID.

2.  **Refactor Candidate Tests:**
    *   Go through the list of candidate files.
    *   Remove the `beforeEach` block that creates a group.
    *   Add a call to `TestGroupManager.getOrCreateGroup(user)` to get a shared group for the test's context.

3.  **Run and Verify:**
    *   Execute the entire Firebase integration test suite.
    *   Confirm that all tests pass and that the overall execution time is reduced.

## 6. Benefits

-   **Faster Integration Tests:** A significant reduction in test runtime by minimizing redundant API calls.
-   **Reduced Emulator Load:** Less work for the Firebase emulator, leading to more stable test runs.
-   **Cleaner Test Code:** Simplifies the `beforeEach` setup block in many test files.
