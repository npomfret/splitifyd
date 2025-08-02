# E2E Tests Analysis

## MUST REMOVE HACKS

Based on a review of the e2e test suite, the following hacks and workarounds have been identified. These should be addressed to improve test quality and uncover latent bugs.

### 1. Skipped Error Checking in `delete-operations.e2e.test.ts`
- **Issue**: The test for deleting an expense explicitly skips error checking due to a known frontend bug in handling the API response.
- **Impact**: This hides a bug where the application does not behave as expected after a successful deletion.
- **Recommendation**: Fix the frontend bug and remove the `skip-error-checking` annotation.

### 2. Incomplete Multi-User Scenarios
- **Issue**: Tests in `complex-unsettled-group.e2e.test.ts` and `manual-complex-scenario.e2e.test.ts` simulate multi-user interactions but cannot actually invite or add a second user to a group.
- **Impact**: The tests do not accurately reflect real-world multi-user collaboration, potentially missing bugs in this area.
- **Recommendation**: Implement and test the user invitation and group joining functionality.

### 3. "No-Op" Assertions (`expect(true).toBe(true);`)
- **Issue**: Numerous tests across the suite use `expect(true).toBe(true);` as a final assertion, often with a comment that the test passes regardless of whether the feature is implemented.
- **Impact**: This creates a false sense of security. The tests are not actually verifying the functionality they are named for.
- **Recommendation**: Replace these assertions with meaningful checks that validate the expected outcome of the test.

### 4. Use of Arbitrary Timeouts (`waitForTimeout`)
- **Issue**: The tests frequently use fixed-duration `waitForTimeout()` calls to wait for asynchronous operations.
- **Impact**: This leads to flaky and slow tests. They can fail if the operation takes longer than expected and are unnecessarily slow if the operation is fast.
- **Recommendation**: Replace `waitForTimeout` with Playwright's auto-waiting mechanisms, such as waiting for a specific element to be visible or for a network request to complete.

### 5. Overly Flexible Selectors
- **Issue**: Many tests use broad selectors with multiple `or()` conditions, making them resilient to UI changes but also potentially masking unintended changes or bugs.
- **Impact**: The tests may pass even if the UI has changed in a way that negatively affects the user experience.
- **Recommendation**: Use more specific selectors where possible and consider separate tests for different UI states if necessary.

### 6. Weak Error Handling Assertions
- **Issue**: Error handling tests check for very generic error messages.
- **Impact**: This may not catch cases where the wrong error message is displayed or the UI is not in the correct state after an error.
- **Recommendation**: Make assertions more specific to the expected error message and UI state.
