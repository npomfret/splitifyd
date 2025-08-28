# Unit Test Code Review

## 1. Executive Summary

The project has a substantial number of unit tests for both the Firebase backend and the web application. While the coverage is broad, a review has identified several areas where the tests can be improved to better align with the project's own testing guidelines.

The most significant issues are:
- **Over-mocking and testing implementation details**, particularly in the Firebase service tests. This makes them brittle and hard to maintain.
- **Redundant and low-value tests**, especially in validation and simple helper functions.
- **Inconsistent and overly complex test setup**, which could be simplified by using the recommended "Builder" pattern.
- **Webapp store tests that rely on and reinforce an architectural anti-pattern** (global signals), failing to properly test the store's encapsulated behavior.

This report details the specific issues found and provides recommendations for refactoring the tests to be more robust, maintainable, and aligned with the project's standards.

## Progress Update (2025-08-28)

### Completed Tasks:
1. ✅ **Removed contradictory test file**: Deleted `webapp-v2/src/__tests__/unit/integration/enhanced-stores-ui.test.ts` - this was a hybrid test that provided the worst of both unit and integration testing
2. ✅ **Verified webapp store tests**: Both `auth-store.test.ts` and `groups-store-enhanced.test.ts` have already been fixed to properly test the public interface rather than manipulating internal signals
3. ✅ **Identified builder pattern adoption**: Found that `UserService.test.ts` and `validation.test.ts` already implement the builder pattern, though the service tests still over-use mocks

### Additional Improvements (2025-08-28 continued):
4. ✅ **Simplified validation tests**: Reduced `string-validation.test.ts` from 321 lines to 113 lines by removing redundant tests
5. ✅ **Created E2E conversion recommendations**: Documented in `tasks/e2e-conversion-recommendations.md`

### Remaining Issues:
- **Firebase service tests** still rely heavily on mocking implementation details - recommend converting to E2E tests
- Some validation tests remain redundant but are lower priority

## Final Recommendations - Revised Strategy with Playwright

### Key Insight: Playwright Can Be Used for Unit Tests
After further research, we've discovered that **Playwright can effectively replace traditional unit tests** without requiring the Firebase emulator. This opens up a powerful testing strategy that prioritizes test quality over speed.

### Philosophy: Quality Over Speed
**It's OK for tests to be slower if they are:**
- Less brittle and more maintainable
- Easier to read and understand
- Better at testing real user behavior
- More confident in what they verify

A 500ms Playwright test that actually tests behavior is far superior to a 50ms Jest test that only verifies mocks were called.

### Three-Tier Testing Strategy with Playwright

#### 1. Component Tests (No Backend Required)
- Use `@preact/playwright-ct` for isolated component testing
- Tests run in real browser but components mount in isolation
- ~50-200ms per test (still fast!)
- Perfect for: Forms, modals, UI components
- **Benefit**: Real browser, real DOM, real user interactions

#### 2. Mocked Integration Tests (No Emulator Required)
- Use Playwright with `route()` API to mock all backend calls
- Test complete user flows with deterministic data
- ~500ms-1s per test (acceptable trade-off)
- Perfect for: Service layer tests, error handling, edge cases
- **Benefit**: Tests actual UI behavior, not implementation details

#### 3. Full E2E Tests (With Emulator)
- Current approach for critical user journeys
- 2-5s per test (worth it for confidence)
- Perfect for: Critical paths, multi-user scenarios
- **Benefit**: Ultimate confidence in real system behavior

### Immediate Actions - Revised

1. **Stop Writing Mock-Heavy Unit Tests**
   - No more `expect(mockFunction).toHaveBeenCalledWith(...)`
   - No more complex mock setups
   - If you need to test it, test it with Playwright

2. **Convert Service Tests to Mocked Playwright Tests**
   ```typescript
   // Instead of mocking Firestore calls
   // Test the actual UI with mocked API responses
   await context.route('**/api/auth/register', route => {
     route.fulfill({ json: mockResponse });
   });
   await registrationPage.performRegistration();
   await expect(page).toHaveURL('/dashboard');
   ```

3. **Keep Pure Logic as Traditional Unit Tests**
   - Balance calculations
   - Debt simplification algorithms
   - Date utilities
   - These don't need a browser

### Why This Approach is Superior

1. **Less Brittle**: Tests don't break when implementation changes
2. **More Readable**: Tests read like user stories, not technical specifications
3. **Better Coverage**: Tests actual user-facing behavior
4. **Unified Tooling**: One test framework (Playwright) for most needs
5. **Real Browser Testing**: Catches issues Jest would miss
6. **Developer Experience**: Better debugging with Playwright Inspector

### Example Migration

**Before (Brittle Jest Test):**
```typescript
it('registers user', async () => {
  mockAuth.createUser.mockResolvedValue({ uid: 'test' });
  mockFirestore.set.mockResolvedValue({});
  
  await userService.registerUser(data);
  
  expect(mockAuth.createUser).toHaveBeenCalledWith(...);
  expect(mockFirestore.set).toHaveBeenCalledTimes(2);
});
```

**After (Robust Playwright Test):**
```typescript
test('registers user', async ({ page, context }) => {
  // Mock the API, not the implementation
  await context.route('**/api/register', route => {
    route.fulfill({ json: { user: testUser } });
  });
  
  // Test actual behavior
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Verify outcomes users care about
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('.welcome')).toContainText('Welcome');
});
```

### Metrics Update
- Reduced validation test by 65% (321 → 113 lines)
- Removed 1 contradictory hybrid test
- **New Goal**: Convert 60% of mock-heavy unit tests to Playwright
- **Expected Outcome**: 
  - Tests 10x slower (50ms → 500ms) 
  - But 100x more valuable (test real behavior, not mocks)
  - 50% less test maintenance (no mock updates)

### The Bottom Line
**Speed is not the primary metric for test quality.** A slower test that gives confidence in real behavior is infinitely more valuable than a fast test that only verifies implementation details. Playwright enables us to write tests that are slightly slower but dramatically better.

See `tasks/e2e-conversion-recommendations.md` for detailed conversion patterns.

---

## 2. General Issues & Recommendations

These issues were observed across multiple test files.

### 2.1. Over-reliance on Mocks and Testing Implementation

- **Observation:** Many tests, especially in `UserService.test.ts` and `GroupService.test.ts`, use `jest.spyOn` and `jest.mock` extensively to track whether specific functions were called. Tests frequently assert `expect(mockFunction).toHaveBeenCalledWith(...)`.
- **Problem:** This tests the *implementation* rather than the *behavior*. These tests are brittle; a valid refactoring of the underlying code that doesn't change the outcome will still break the test. This violates the guideline to "Focus on behaviour, not implementation details."
- **Recommendation:** Refactor tests to focus on the output and side effects. For example, instead of checking that a Firestore `set` function was called with specific data, create the data and then use a separate `get` call to assert that the data was written correctly.

### 2.2. Complex and Repetitive Test Setup

- **Observation:** Many test suites build up complex objects for mocks and test data within each `test` block. The setup for mocks, especially for Firestore, is often verbose and repeated with minor variations.
- **Problem:** This makes tests hard to read and maintain, violating the guideline to "Factor out complex setup in order to make tests easy to read." The project's testing guide explicitly recommends using the "Builder" pattern to simplify this, but it is not used consistently.
- **Recommendation:** Introduce and use "Builder" classes for core entities like `User`, `Group`, and `Expense`. This will significantly reduce boilerplate, make the "Arrange" step of tests much cleaner, and align with the project's own documented best practices.

### 2.3. Redundant and Low-Value Tests

- **Observation:** Some files contain tests for extremely simple logic or have multiple tests for very similar scenarios. For example, testing every single Joi validation rule that is already covered by the Joi library itself.
- **Problem:** This leads to a bloated test suite that is slow and costly to maintain, violating the guideline to "Remove pointless, outdated, redundant, duplicated, outdated, pedantic or low‑benefit tests."
- **Recommendation:** Consolidate tests that cover similar ground. For validation, instead of testing every possible failure for a single field, focus on one or two key validation rules and trust that the underlying library (Joi/Zod) works.

---

## 3. File-by-File Analysis

### `firebase/functions/src/__tests__/unit/UserService.test.ts`

- **Issue:** Heavy use of mocks to verify implementation. Almost every test checks if a Firestore or Auth function was called.
- **Example:** The `registerUser` tests mock and spy on `createUser`, `set`, `collection`, `doc`, etc., and then assert that they were called.
- **Recommendation:** Instead of checking the calls, the test should create a user and then try to fetch that user to verify they were created correctly with the right data. This tests the actual outcome.

### `firebase/functions/src/__tests__/unit/GroupService.test.ts`

- **Issue:** Similar to `UserService.test.ts`, it's heavily focused on mocking implementation details. The setup is complex and could benefit from builders.
- **Example:** The `createGroup` tests involve mocking the return values for multiple chained Firestore calls (`collection`, `doc`, `set`).
- **Recommendation:** Use a `GroupBuilder` to create test data. Refactor tests to verify the end result (the group is created and can be fetched) rather than the intermediate function calls.

### `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts` & `debtSimplifier.test.ts`

- **Issue:** These files test complex logic, but the test data is constructed manually, making the tests hard to read and understand. It's difficult to see the relationships between the input data and the expected output.
- **Recommendation:** Use builders (`ExpenseBuilder`, `UserBuilder`) to construct the input scenarios. This would make the setup more semantic and easier to follow (e.g., `new ExpenseBuilder().paidBy('userA').splitWith('userB').build()`).

### `webapp-v2/src/__tests__/unit/stores/auth-store.test.ts`

- **Issue:** This test suite directly imports and manipulates the global signals (`loadingSignal`, `errorSignal`, `userSignal`) from the store file.
- **Problem:** This is a major anti-pattern. The test is not testing the public interface of the `AuthStore` class; it's testing its (supposedly private) implementation details. It confirms the architectural flaw mentioned in `webapp-code-review.md` where signals are not properly encapsulated. A test should only call the store's public methods (e.g., `authStore.login()`) and assert on the public getters (e.g., `authStore.user`).
- **Recommendation:** This entire test file needs to be rewritten.
    1. The `auth-store.ts` file must first be refactored to encapsulate its signals as private members.
    2. The test should then be updated to *only* interact with the public methods and properties of the `AuthStore` instance. It should never import or touch the signals directly.

### `webapp-v2/src/__tests__/unit/stores/groups-store-enhanced.test.ts`

- **Issue:** Same as the `auth-store.test.ts`. It directly imports and modifies `groupsSignal` and `loadingSignal`.
- **Recommendation:** The store and the test need to be refactored to enforce encapsulation, as described above.

### `webapp-v2/src/__tests__/unit/integration/enhanced-stores-ui.test.ts`

- **Issue:** The file name itself (`unit/integration`) is a contradiction and suggests confusion about the test's purpose. The test appears to be doing UI-level testing within a unit test runner by checking component outputs.
- **Problem:** This is a high-maintenance, low-benefit test. It's not a true end-to-end test, but it's far more complex than a typical unit test. It's likely to be brittle and slow.
- **Recommendation:** This test should be deleted. Its purpose is better served by either:
    1.  Pure unit tests for the stores themselves (testing their logic, not UI).
    2.  True end-to-end tests using Playwright that verify the actual user-facing behavior.
    This hybrid test provides the worst of both worlds.
