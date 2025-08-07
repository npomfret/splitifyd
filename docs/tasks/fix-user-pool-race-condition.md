# Task: Fix Race Condition in E2E Test User Pool

**Status:** In Progress
**Priority:** High
**Effort:** Medium
**Updated:** 2025-08-07

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

## Implementation Plan

### Phase 1: Core User Pool Refactoring
1. **Modify `user-pool.fixture.ts`**:
   - Remove all file I/O operations in `claimUser()` and `releaseUser()` methods
   - Implement deterministic user assignment using `testInfo.workerIndex`
   - Keep pre-warming logic but eliminate complex state management
   - Increase default `preWarmCount` from 3 to 10 users

2. **Update `authenticated-test.ts`**:
   - Replace `claimUser(testId)` with `getUserByIndex(workerIndex)`
   - Remove `releaseUser()` calls since assignment is now deterministic
   - Add validation to ensure worker index doesn't exceed pool size

3. **Update `multi-user-test.ts`**:
   - Assign first user using `workerIndex * 2`
   - Assign second user using `(workerIndex * 2) + 1`
   - Ensure no overlap between workers' user assignments

4. **Simplify `global-setup.ts`**:
   - Keep user creation logic
   - Remove complex persistence mechanisms
   - Store users in simple JSON format for worker consumption

### Phase 2: Test Refactoring
5. **Fix tests that manually create users**:
   - Convert `security-errors.e2e.test.ts` to use `multiUserTest` fixture
   - Remove duplicate test in `network-errors.e2e.test.ts`
   - Refactor all tests in `member-display.e2e.test.ts` to use `authenticatedPageTest`
   - Update `complex-scenarios.e2e.test.ts` to use fixture-provided users

6. **Update workflow classes**:
   - Modify `GroupWorkflow` to accept authenticated pages/users from fixtures
   - Update `MultiUserWorkflow` to work with fixture-provided users

### Phase 3: Validation
7. **Testing**:
   - Run full test suite with 4 parallel workers
   - Verify no user collision errors
   - Monitor for any flaky test behavior
   - Validate all refactored tests pass consistently

## Next Steps

1. Begin implementation of Phase 1 immediately (highest priority)
2. Phase 2 can proceed in parallel once Phase 1 is complete
3. Phase 3 validation should run continuously during development

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

---

## Technical Implementation Details

### Worker Index User Assignment Strategy

For a pool of 10 users with up to 4 parallel workers:

**Single User Tests (`authenticatedPageTest`)**:
- Worker 0: Uses User[0]
- Worker 1: Uses User[1]
- Worker 2: Uses User[2]
- Worker 3: Uses User[3]

**Multi-User Tests (`multiUserTest`)**:
- Worker 0: Uses User[0] and User[4]
- Worker 1: Uses User[1] and User[5]
- Worker 2: Uses User[2] and User[6]
- Worker 3: Uses User[3] and User[7]

This ensures no collision between workers and supports both single and multi-user test scenarios.

### Code Example for New Implementation

```typescript
// user-pool.fixture.ts
class UserPool {
  private users: BaseUser[] = [];
  
  async initialize(): Promise<void> {
    // Load users from JSON created during global setup
    const poolData = JSON.parse(fs.readFileSync('.playwright-users.json', 'utf8'));
    this.users = poolData.users;
  }
  
  getUserByIndex(workerIndex: number): BaseUser {
    if (workerIndex >= this.users.length) {
      throw new Error(`Worker index ${workerIndex} exceeds pool size ${this.users.length}`);
    }
    return this.users[workerIndex];
  }
  
  getSecondUserByIndex(workerIndex: number): BaseUser {
    const secondUserIndex = workerIndex + Math.ceil(this.users.length / 2);
    if (secondUserIndex >= this.users.length) {
      throw new Error(`Second user index ${secondUserIndex} exceeds pool size`);
    }
    return this.users[secondUserIndex];
  }
}
```

### Validation Criteria

The implementation will be considered successful when:
1. No race condition errors occur during parallel test execution
2. All tests pass consistently with 4 parallel workers
3. Test execution time improves due to elimination of file I/O
4. No tests manually create users outside of fixtures
5. Code complexity is reduced by ~30% in user pool management

