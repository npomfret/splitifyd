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

### 6. Non-Deterministic Tests

- **Issue**: Many tests contain comments with "or" statements, indicating that the test author was unsure about the application's behavior. This leads to tests that are not reliable and may pass even when the application is in an incorrect state.
- **Impact**: These tests do not provide a reliable signal about the health of the application. They can mask bugs and make it difficult to refactor with confidence.
- **Recommendation**: Each test should have a single, deterministic outcome. The test setup should ensure that the application is in a known state, and the assertions should verify a specific, expected result.

**Examples of Non-Deterministic Tests:**

*   **`add-expense.e2e.test.ts`**
    *   L34: `// Should navigate to add expense page or open modal`
    *   L63: `// Should show the expense in the list or navigate back to group`
    *   L96: `// Submit button should be disabled or show validation errors`
*   **`balance-settlement.e2e.test.ts`**
    *   L23: `// Should show balanced state or zero balances`
*   **`member-management.e2e.test.ts`**
    *   L195: `// Test passes whether or not expense splitting is implemented`
    *   L230: `// Test passes whether or not removal functionality is implemented`

### 7. Weak Error Handling Assertions
- **Issue**: Error handling tests check for very generic error messages.
- **Impact**: This may not catch cases where the wrong error message is displayed or the UI is not in the correct state after an error.
- **Recommendation**: Make assertions more specific to the expected error message and UI state.

## IMPLEMENTATION PLAN

### Overview
This task will systematically remove test hacks and workarounds to improve test reliability and uncover hidden bugs. The work will be broken into small, atomic commits that can be tested independently.

### Phase 1: Fix Critical Issues (High Priority)

#### 1.1 Fix Skipped Error Checking (delete-operations.e2e.test.ts:518)
**Work Required:**
- Remove the `skip-error-checking` annotation from line 518
- Investigate the frontend bug that causes error on successful deletion
- Fix the bug (likely in the delete operation's response handling)
- Update test to properly assert success state after deletion

**Commit:** "fix: remove skip-error-checking hack from delete operations test"

#### 1.2 Replace No-Op Assertions
**Files with expect(true).toBe(true):** Found 67 instances across 12 files
- delete-operations.e2e.test.ts: 10 instances
- add-expense.e2e.test.ts: 5 instances  
- balance-settlement.e2e.test.ts: 7 instances
- error-handling.e2e.test.ts: 6 instances
- multi-user-collaboration.e2e.test.ts: 14 instances
- And others...

**Work Required:**
- For each no-op assertion, analyze what the test SHOULD verify
- Replace with meaningful assertions:
  - For creation tests: Verify the created item exists and has correct properties
  - For deletion tests: Verify the item no longer exists
  - For validation tests: Verify specific error messages appear
  - For permission tests: Verify actions are blocked with appropriate feedback

**Commits:** One commit per file to keep changes reviewable
- "test: replace no-op assertions in delete-operations tests"
- "test: replace no-op assertions in add-expense tests"
- etc.

### Phase 2: Improve Test Reliability (Medium Priority)

#### 2.1 Replace Arbitrary Timeouts
**Stats:** 128 instances of waitForTimeout across 12 files

**Work Required:**
- Replace `waitForTimeout()` with:
  - `waitForLoadState('networkidle')` for page loads
  - `expect(element).toBeVisible()` for element appearance
  - `page.waitForURL()` for navigation
  - `page.waitForResponse()` for API calls
  - `expect(element).toHaveText()` for text updates

**Example transformation:**
```typescript
// Before:
await page.waitForTimeout(2000);
await expect(page.getByText('Expense')).toBeVisible();

// After:
await expect(page.getByText('Expense')).toBeVisible({ timeout: 5000 });
```

**Commits:** Group by test file
- "test: replace arbitrary timeouts in delete operations"
- "test: replace arbitrary timeouts in add expense tests"
- etc.

#### 2.2 Improve Selector Specificity
**Focus on tests with multiple .or() chains**

**Work Required:**
- Replace overly flexible selectors with specific ones
- Use data-testid attributes where appropriate
- Use role-based selectors with specific names
- Remove unnecessary .or() chains

**Example transformation:**
```typescript
// Before:
const deleteButton = page.getByRole('button', { name: /delete/i })
  .or(page.getByRole('button', { name: /remove/i }))
  .or(page.locator('[data-testid*="delete"]'));

// After:
const deleteButton = page.getByRole('button', { name: 'Delete Expense' });
```

**Commits:** Group by component/feature
- "test: improve button selectors in expense tests"
- "test: improve form field selectors"
- etc.

#### 2.3 Strengthen Error Assertions
**Focus on error-handling.e2e.test.ts and validation scenarios**

**Work Required:**
- Replace generic error checks with specific message assertions
- Verify UI state after errors (disabled buttons, highlighted fields)
- Check for proper error clearing on valid input
- Verify error persistence across navigation

**Commits:**
- "test: strengthen error assertions in form validation"
- "test: improve permission error handling tests"

### Phase 3: Address Architectural Issues (Lower Priority)

#### 3.1 Multi-User Scenario Improvements
**Note:** This requires implementing actual invitation/joining functionality
- Document current limitations clearly in test comments
- Create separate issue for implementing proper multi-user support
- Focus current tests on what CAN be tested (single user scenarios)

### Testing Strategy
1. Run full test suite after each commit to ensure no regressions
2. Use `--headed` mode to visually verify changes during development
3. Run with `--workers=3` to avoid resource contention
4. Check for new flaky tests after timeout replacements

### Success Criteria
- All tests pass without skip-error-checking annotations
- No expect(true).toBe(true) assertions remain
- waitForTimeout usage reduced by >90%
- Tests fail appropriately when functionality is broken
- Test execution time reduced (fewer arbitrary waits)
- Tests are more maintainable with clearer selectors
