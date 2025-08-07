# Task: Fix Race Condition in E2E Test User Pool

**Status:** Not Started
**Priority:** High
**Effort:** Medium

## Executive Summary

The end-to-end test suite's user pool (`e2e-tests/src/fixtures/user-pool.fixture.ts`) is **not process-safe** and contains a critical race condition when tests are executed in parallel. While designed to support parallel execution, the current implementation for sharing the user pool state across multiple Playwright workers is flawed. This can lead to multiple workers claiming and using the same test user simultaneously, which breaks test isolation and results in flaky, unpredictable test failures.

## Detailed Analysis: The Race Condition

The root cause of the issue is the lack of an atomic operation for claiming and releasing users from the pool. The state of the pool is persisted in a JSON file (`.playwright-user-pool.json`), which is read from and written to by all parallel workers.

The race condition occurs as follows:

1.  **Initialization**: A single `global-setup` process creates a set of users and writes them to the JSON file.
2.  **Workers Launch**: Playwright launches multiple worker processes. Each worker loads the *same initial state* from the JSON file into its own memory. At this moment, all workers believe all users are available.
3.  **The Race**:
    - **Worker A** starts a test, finds an available user in its in-memory pool, marks it as "in-use", and begins to asynchronously write this change back to the shared JSON file.
    - **Before Worker A's write operation completes**, **Worker B** starts its test. It consults its own in-memory pool, which has not yet been updated by Worker A.
    - Worker B sees the **same user** as available, claims it, and also attempts to write the change to the JSON file.
4.  **Result**: Two separate test workers are now operating on the same user account, leading to state collisions. Actions in one test (e.g., logging out, changing data) will directly and unpredictably impact the other, causing failures that are difficult to reproduce.

The current use of an environment variable (`PLAYWRIGHT_USER_POOL`) does not mitigate this, as it's only set once during global setup and is not a mechanism for real-time, inter-process state communication.

## Recommendations

To ensure test stability and reliability, the user pool must be refactored to use a process-safe strategy.

### Option 1: File Locking (Direct Fix)

This approach makes the existing file-based sharing mechanism safe by introducing a locking system.

-   **Mechanism**: Before a worker reads from or writes to the shared JSON file, it must acquire a lock by creating a `.lock` file. If the lock file exists, the worker must wait. After its operation is complete, it removes the lock file.
-   **Pros**: Fixes the race condition directly.
-   **Cons**: Adds complexity (lock management) and can be slower due to serialized file access.

### Option 2: Playwright Worker Index (Recommended)

This is a simpler, more robust, and more performant solution that leverages Playwright's native architecture, eliminating the need for dynamic state sharing entirely.

-   **Mechanism**:
    1.  **Global Setup**: Create a static list of test users, one for each potential worker (e.g., 10 users), and save it to a file.
    2.  **Fixture Logic**: In the `authenticatedTest` fixture, read the complete list of users. Use the `testInfo.workerIndex` provided by Playwright to deterministically assign a unique user to each worker (`const user = allUsers[testInfo.workerIndex];`).
-   **Pros**:
    -   **No Race Conditions**: Eliminates shared state, the root cause of the problem.
    -   **Faster**: No file I/O is needed during test execution after the initial read.
    -   **Simpler Code**: Removes all logic for claiming, releasing, and locking users.
-   **Cons**: Requires creating a number of users sufficient for the maximum number of parallel workers.

## Next Steps

1.  Prioritize the refactoring of the `user-pool.fixture.ts`.
2.  Implement the **Playwright Worker Index** (Option 2) approach, as it is the superior and more idiomatic solution for Playwright.
3.  Update the `authenticatedTest` and `multiUserTest` fixtures to use the new worker-index-based user assignment.
4.  Remove the file-writing logic from the `claimUser` and `releaseUser` methods in the user pool.

---

## Addendum: Misuse of User Creation in Tests

Beyond the race condition, several test files manually create new users for every test run instead of using the `authenticatedPageTest` fixture, which is designed to use the pre-warmed user pool. This practice is inefficient, slows down test execution, and should be refactored.

### Problematic Files and Tests

The following files and workflows instantiate their own users instead of using the pool via fixtures:

1.  **`e2e-tests/src/tests/error-testing/security-errors.e2e.test.ts`**:
    -   **Test**: `verifies group access control behavior`
    -   **Issue**: This test manually creates a second user (`await AuthenticationWorkflow.createTestUser(page2);`) to test access control.
    -   **Recommendation**: This test should be converted to use the `multiUserTest` fixture, which provides two distinct, pool-managed users (`authenticatedPage` and `secondUser`) out of the box.

2.  **`e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts`**:
    -   **Test**: `verifies group access control behavior`
    -   **Issue**: This is a duplicate of the test in `security-errors.e2e.test.ts` and has the same problem of manually creating a second user.
    -   **Recommendation**: This duplicate test should be removed, and the original should be refactored to use the `multiUserTest` fixture.

3.  **`e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`**:
    -   **Issue**: All tests in this file use `GroupWorkflow.createTestGroup(page, ...)` which internally calls `new AuthenticationWorkflow(this.page).createAndLoginTestUser()`. This creates a new user for every single test in the file.
    -   **Recommendation**: These tests should be refactored to use the `authenticatedPageTest` fixture. The group creation can then be done inside the test using `dashboardPage.createGroupAndNavigate(...)`.

4.  **`e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`**:
    -   **Test**: `create group with multiple people and expenses that is NOT settled`
    -   **Issue**: This test correctly uses a `MultiUserWorkflow` but it creates brand new users (`await workflow.addUser();`) instead of drawing from the pool.
    -   **Recommendation**: The `MultiUserWorkflow` itself should be refactored to integrate with the `multiUserTest` fixture, allowing it to orchestrate actions for the two pre-authenticated users provided by the fixture.

### Next Steps (Addendum)

5.  Refactor the tests listed above to use the `authenticatedPageTest` and `multiUserTest` fixtures.
6.  Modify the `GroupWorkflow` and `MultiUserWorkflow` classes to operate on pages and users provided by fixtures, rather than creating new ones.

