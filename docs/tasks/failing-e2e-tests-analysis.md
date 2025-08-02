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

### 8. Overlapping and Redundant Tests

- **Issue**: There is significant overlap between E2E tests, particularly in the areas of authentication, group creation, and static page navigation. This leads to a slow, inefficient, and hard-to-maintain test suite.
- **Impact**: Increased test execution time, higher maintenance costs, and a test suite that is difficult to reason about.
- **Recommendation**: Refactor the E2E tests to eliminate redundancy and ensure that each test has a clear, focused purpose.

**Key Areas of Overlap and Recommendations:**

*   **Authentication and Initial State**:
    *   **Overlap**: Most tests repeat the login and group creation process.
    *   **Recommendation**: Use the `authenticatedTest` fixture for all tests that require a logged-in user. Create a `beforeEach` hook within test files to handle repetitive setup like group creation.

*   **Group Creation**:
    *   **Overlap**: `dashboard.e2e.test.ts`, `add-expense.e2e.test.ts`, and others all test group creation.
    *   **Recommendation**: Consolidate all group creation UI tests into `dashboard.e2e.test.ts`. For other tests, create groups via a helper function or API call to speed up setup.

*   **Static Pages and Navigation**:
    *   **Overlap**: `homepage.e2e.test.ts`, `static-pages.e2e.test.ts`, `navigation.e2e.test.ts`, and `seo.e2e.test.ts` all test similar aspects of static content.
    *   **Recommendation**: Create a single `static-content.e2e.test.ts` to handle all static page loading, navigation, and SEO checks. Retire the other redundant test files.

*   **Expense Creation**:
    *   **Overlap**: `add-expense.e2e.test.ts`, `delete-operations.e2e.test.ts`, and `balance-settlement.e2e.test.ts` all create expenses through the UI.
    *   **Recommendation**: Isolate expense form UI testing to `add-expense.e2e.test.ts`. Use a helper function to create expenses in other tests.

*   **Multi-User Scenarios**:
    *   **Overlap**: `multi-user-collaboration.e2e.test.ts`, `multi-user-expenses.e2e.test.ts`, and `complex-unsettled-group.e2e.test.ts` all attempt to test multi-user functionality with significant workarounds.
    *   **Recommendation**: Consolidate these into a single `multi-user.e2e.test.ts` and focus on what is currently testable. Document the rest as pending features.

## IMPLEMENTATION PLAN

### Overview
This task will systematically remove test hacks and workarounds to improve test reliability and uncover hidden bugs. The work will be broken into small, atomic commits that can be tested independently.

### Current Status
- [x] TypeScript compilation errors fixed
- [ ] Phase 1: Fix Critical Issues
- [ ] Phase 2: Improve Test Reliability
- [ ] Phase 3: Address Architectural Issues

### Phase 1: Fix Critical Issues (High Priority)

#### 1.1 Fix Skipped Error Checking (delete-operations.e2e.test.ts:518) - IN PROGRESS
**Work Required:**
- Remove the `skip-error-checking` annotation from line 518
- Investigate the frontend bug that causes error on successful deletion
- Fix the bug (likely in the delete operation's response handling)
- Update test to properly assert success state after deletion

**Commit:** "fix: remove skip-error-checking hack from delete operations test"

#### 1.2 Replace No-Op Assertions  
**Files with expect(true).toBe(true):** Found 67 instances across 12 files
- delete-operations.e2e.test.ts: 10 instances - COMPLETED ✓
- add-expense.e2e.test.ts: 5 instances - COMPLETED ✓
  - No expect(true).toBe(true) found, but had:
    - Non-deterministic comments (L34, L63) - Fixed
    - console.log statements instead of assertions (L172, L266) - Fixed
    - Weak validation testing - Fixed
- balance-settlement.e2e.test.ts: 7 instances - COMPLETED ✓
  - No expect(true).toBe(true) found, but had:
    - Weak assertions: `expect(hasBalanceSection || hasSettledState).toBe(true)` (L127) - Fixed
    - Weak assertions: `expect(hasHistory || page.url().includes('/groups/')).toBe(true)` (L231) - Fixed
    - console.log statements (L188, L229, L271) - Removed
    - test.skip() calls (L87, L191) - Removed
    - Overly flexible selectors with multiple .or() chains - Fixed with specific selectors
- error-handling.e2e.test.ts: 6 instances - IN PROGRESS
  - Analysis shows:
    - No expect(true).toBe(true) found, but has:
    - Weak assertions: `expect(isDisabled || hasValidation || hasLengthError || finalUrl.includes('/groups/')).toBe(true)` (L148)
    - Weak assertions: `expect(hasPermissionError || cannotAccessGroup).toBe(true)` (L206)
    - console.log statements throughout (L51, L59-61, L79, L102, L105, L108, L127, L142, L163, L170, L180, L191, L197, L200, L248, L250, L255, L294, L296, L306, L311, L312, L346, L348, L357, L363)
    - test.skip() calls (L80, L312, L364)
    - skip-error-checking annotations (L15-17, L214-217, L260-263, L318-321)
    - Overly flexible selectors with multiple .or() chains throughout
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

#### error-handling.e2e.test.ts Plan
Issues to fix:
1. **Line 148**: `expect(isDisabled || hasValidation || hasLengthError || finalUrl.includes('/groups/')).toBe(true)`
   - Weak assertion that passes if ANY condition is true
   - Fix: Make specific assertions about what SHOULD happen (e.g., validation errors should appear)

2. **Line 206**: `expect(hasPermissionError || cannotAccessGroup).toBe(true)`
   - Weak assertion allowing either condition
   - Fix: Assert specifically that unauthorized access is blocked

3. **Multiple console.log statements** throughout
   - Replace with proper assertions or remove entirely
   - Only keep if they're replaced with meaningful test assertions

4. **test.skip() calls** (Lines 80, 312, 364)
   - Violates "never skip tests" principle
   - Fix: Either make the tests work or remove them entirely

5. **skip-error-checking annotations** (Lines 15-17, 214-217, 260-263, 318-321)
   - These are for tests that intentionally trigger errors
   - Need to determine if these are legitimate uses or hiding bugs

6. **Overly flexible selectors with multiple .or() chains**
   - Many selectors have 3-4 .or() conditions making tests unreliable
   - Fix: Use specific selectors based on actual error UI implementation

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

### Implementation Notes

#### add-expense.e2e.test.ts Plan
Issues to fix:
1. **Line 34**: "Should navigate to add expense page or open modal" - Make deterministic
   - Check URL change OR modal presence, not both as alternatives
   - Assert specific expected behavior based on current implementation

2. **Line 63**: "Should show the expense in the list or navigate back to group" - Make deterministic
   - Assert that we're on the group page AND expense is visible
   - Remove uncertainty about navigation

3. **Line 96**: "Submit button should be disabled or show validation errors" - Strengthen validation
   - Assert specific validation behavior 
   - Check for specific error messages on required fields
   - Verify form cannot be submitted without required data

4. **Line 172**: console.log for category implementation
   - If categories are implemented, test them properly
   - If not implemented, remove the test entirely (don't test features that don't exist)

5. **Line 266**: console.log for split types
   - If split types are implemented, test them properly
   - If not implemented, remove the test entirely (don't test features that don't exist)

#### Phase 1.1 - Delete Operation Error Analysis
The skipped error checking in delete-operations.e2e.test.ts indicates a frontend bug where the UI shows an error despite successful deletion. Need to:
1. Examine the delete API response handling in the frontend
2. Check if the error is due to navigation timing or state update issues
3. Fix the root cause before removing the skip annotation

#### Phase 1.2 - No-Op Assertion Strategy
For each no-op assertion:
1. Understand what the test intended to verify
2. Implement proper state verification
3. Ensure the assertion would fail if the feature breaks

Example transformations:
- Creation: Verify item exists in list/database
- Deletion: Verify item removed from UI and returns 404
- Navigation: Verify URL change and page content
- Validation: Verify specific error messages and field states

#### balance-settlement.e2e.test.ts Plan
Issues to fix:
1. **Line 23**: "Should show balanced state or zero balances" - Non-deterministic comment
   - The test uses overly flexible selectors with 5 .or() conditions
   - Fix: Assert specifically that the balance section shows "All settled up!" for new groups

2. **Line 87**: `test.skip()` when add expense is not available
   - Violates "never skip tests" principle
   - Fix: Since add expense IS implemented, remove the skip and properly test expense creation

3. **Line 127**: `expect(hasBalanceSection || hasSettledState).toBe(true)`
   - Weak assertion that passes if either condition is true
   - Fix: Assert that balance section exists AND shows settled state for single-member group

4. **Line 188**: `console.log` for settlement functionality
   - Should use proper assertions instead
   - Fix: Test the actual settlement recording feature (appears to be implemented)

5. **Line 191**: `test.skip()` when settlement not available
   - Violates "never skip tests" principle
   - Fix: Remove skip and test the feature properly

6. **Line 229**: `console.log` for settlement history
   - Should use proper assertions
   - Fix: Assert that history/activity section exists, even if empty

7. **Line 231**: `expect(hasHistory || page.url().includes('/groups/')).toBe(true)`
   - Extremely weak assertion (URL check always passes on group page)
   - Fix: Assert specific UI elements for history/activity

8. **Line 271**: `console.log` for balance summary
   - Should use proper assertions
   - Fix: Assert that balance display exists and shows correct format

9. **Multiple overly flexible selectors**
   - Many selectors have 4-5 .or() conditions making tests unreliable
   - Fix: Use specific selectors based on actual UI implementation

Based on examining the actual UI components:
- BalanceSummary component IS implemented and shows "All settled up!" or list of debts
- Settlement recording appears to be implemented (need to verify)
- Group detail page shows balances via the BalanceSummary component
