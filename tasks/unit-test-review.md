# Unit Test Code Review

## 1. Executive Summary

The project has a substantial number of unit tests for both the Firebase backend and the web application. While the coverage is broad, a review has identified several areas where the tests can be improved to better align with the project's own testing guidelines.

The most significant issues are:
- **Over-mocking and testing implementation details**, particularly in the Firebase service tests. This makes them brittle and hard to maintain.
- **Redundant and low-value tests**, especially in validation and simple helper functions.
- **Inconsistent and overly complex test setup**, which could be simplified by using the recommended "Builder" pattern.
- **Webapp store tests that rely on and reinforce an architectural anti-pattern** (global signals), failing to properly test the store's encapsulated behavior.

This report details the specific issues found and provides recommendations for refactoring the tests to be more robust, maintainable, and aligned with the project's standards.

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
