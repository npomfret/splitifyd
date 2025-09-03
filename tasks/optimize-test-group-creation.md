# Task: Optimize E2E Tests by Reusing Existing Groups

## 1. Overview

To improve the speed and efficiency of the E2E test suite, this task proposes a refactoring to prevent the unnecessary creation of groups. Many tests create a new group as a setup step, even when any existing group would suffice. Since we use a pool of test users, these users often already have groups that can be reused.

The goal is to introduce a new workflow or helper method that checks for the presence of a group and only creates a new one if absolutely necessary.

## 2. Proposed Solution

We will introduce a new helper method, tentatively named `getOrCreateGroup()`, which will be part of the `GroupWorkflow` or a new `GroupHelper` class.

**Workflow of `getOrCreateGroup()`:**

1.  Navigate to the dashboard page.
2.  Check if any groups are listed in the group list/sidebar.
3.  **If a group exists:**
    *   Click on the first available group.
    *   Return the `groupId` and navigate to the group detail page.
4.  **If no group exists:**
    *   Proceed with the existing group creation flow (open modal, fill form, submit).
    *   Return the new `groupId` and navigate to the group detail page.

This approach ensures that a group is created only once per test user, and subsequent tests for that user will reuse the existing group.

## 3. Candidate Tests for Refactoring

The following test files have been identified as high-value candidates for this optimization, as they create groups for setup purposes but do not test the creation logic itself:

-   `e2e-tests/src/__tests__/integration/normal-flow/add-expense-happy-path.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/normal-flow/multi-user-happy-path.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/normal-flow/balance-visualization-single-user.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/normal-flow/expense-operations.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/edge-cases/complex-scenarios.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/error-testing/expense-editing-errors.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/normal-flow/comments-realtime.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/normal-flow/settlement-management.e2e.test.ts`

## 4. Tests to Exclude

The following files are focused on testing the group creation, editing, and lifecycle itself. They should **not** be changed and should continue to create groups explicitly to ensure their functionality is tested directly.

-   `e2e-tests/src/__tests__/integration/normal-flow/group-management.e2e.test.ts`
-   `e2e-tests/src/__tests__/integration/error-testing/group-management-errors.e2e.test.ts`

## 5. Implementation Steps

1.  **Create the Helper:**
    *   Implement the `getOrCreateGroup()` method in an appropriate workflow or helper class.
    *   This helper should encapsulate the logic of checking for an existing group on the dashboard and creating one if needed.

2.  **Refactor Candidate Tests:**
    *   Systematically go through the list of candidate test files.
    *   Replace the explicit group creation steps (e.g., `groupWorkflow.createGroupAndNavigate(...)`) with a call to the new `getOrCreateGroup()` helper.

3.  **Verify Tests:**
    *   Run the refactored tests to ensure they still pass reliably.
    *   Confirm that the tests are indeed faster due to the reduction in group creation operations.

## 6. Benefits

-   **Increased Test Speed:** Reduces the number of slow "create group" operations, leading to faster feedback from the test suite.
-   **Improved Efficiency:** Lowers the load on the backend and emulator during test runs.
-   **More Realistic Scenarios:** Better reflects a real user's experience, who would typically interact with existing groups rather than creating a new one for every action.
