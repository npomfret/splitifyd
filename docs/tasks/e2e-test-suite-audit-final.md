# Task: Final E2E Test Suite Audit and Refinement

**Status:** Not Started
**Priority:** Medium
**Effort:** Medium

## Executive Summary

A final audit of the E2E test suite was conducted following significant refactoring. The suite is now in a much better state and largely adheres to the principles in `e2e-tests/README.md`. The previous major issues concerning fixture misuse and widespread test duplication have been resolved.

However, this new audit has identified a new set of violations and areas for refinement. The primary remaining issues are:

1.  **Violation of Test Atomicity**: Several tests still use `test.beforeEach` inefficiently, creating new state for every single test instead of using a single, linear user journey.
2.  **Manual User Creation**: A new test file (`terms-acceptance.e2e.test.ts`) has been introduced that manually creates users, bypassing the fixture system and user pool entirely.
3.  **Overly Complex Tests**: The multi-user tests, while functional, are still overly complex, containing dozens of steps and manual state synchronization that make them brittle and hard to maintain.

This document outlines the final set of refactoring tasks to bring the test suite to a state of full compliance and optimal efficiency.

## Key Violations and Required Refactoring

### 1. Violation: Inefficient Setup in `group-display.e2e.test.ts`

-   **File**: `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`
-   **Issue**: This file uses a `test.beforeEach` hook to create a brand new group before every single test. This is inefficient. All the assertions in this file are checking the state of the same, newly created group.
-   **Violation**: Fails the "Atomic & Idempotent Tests" principle by splitting a single conceptual test (verifying a new group's state) into multiple, inefficiently set up tests.
-   **Action Required**: 
    -   Remove the `test.beforeEach` hook.
    -   Consolidate all 5 tests in this file into a **single test** named `should display correct initial state for a new group`. 
    -   This single test should create one group and then perform all the assertions sequentially.

### 2. Violation: Manual User Creation in `terms-acceptance.e2e.test.ts`

-   **File**: `e2e-tests/src/tests/normal-flow/terms-acceptance.e2e.test.ts`
-   **Issue**: This entire test file uses the base `test` fixture from Playwright and manually interacts with the registration form, including creating new users with `generateTestEmail` and `generateTestUserName`. 
-   **Violation**: This is a major violation of the "Fixtures Over Bare Tests" and "Manual State Management" rules. It completely bypasses the user pool and the `authenticatedPageTest` fixture.
-   **Action Required**:
    -   The tests that check the UI elements (checkboxes, links) can remain as they are, using `pageTest`.
    -   The test `should successfully register when both policies accepted` **must be refactored**. It should use the `pageTest` fixture to fill out the form and click submit, but it should not be responsible for asserting the dashboard state. The core registration success/failure logic is already tested elsewhere. The goal of this test is to ensure the form submission is enabled correctly, not to re-test the entire registration flow.

### 3. Violation: Overly Complex and Brittle Multi-User Tests

-   **Files**:
    -   `e2e-tests/src/tests/normal-flow/balance-visualization.e2e.test.ts`
    -   `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`
-   **Issue**: These tests are extremely long and procedural, containing dozens of steps. The `three-user-settlement` test, in particular, has over 100 lines of code and numerous manual `reload` and `synchronizeMultiUserState` calls. This makes the test very difficult to read and highly susceptible to flaking if any single small step fails.
-   **Violation**: While not a direct violation of a single rule, this level of complexity goes against the spirit of creating simple, maintainable tests.
-   **Action Required**:
    -   **Simplify `balance-visualization.e2e.test.ts`**: Remove the remaining `console.log` statements and any unnecessary `reload` calls. The `waitForBalanceUpdate` and `waitForUserSynchronization` methods should be sufficient.
    -   **Refactor `three-user-settlement.e2e.test.ts`**: This test needs to be significantly simplified. The repeated pattern of `action -> synchronize -> assert` across three different browser contexts should be abstracted. While the `synchronizeMultiUserState` helper is a good start, the test itself is still too procedural. Consider breaking it into smaller, more focused tests if possible, or creating more robust page object methods to encapsulate complex sequences of actions.

### 4. Minor Violation: Inefficient Group Creation in `expense-operations.e2e.test.ts`

-   **File**: `e2e-tests/src/tests/normal-flow/expense-operations.e2e.test.ts`
-   **Issue**: The two tests in this file (`should create and view an expense` and `should delete an expense`) each create a brand new group. 
-   **Violation**: This is inefficient. A single group can be used to test both the creation and deletion of an expense.
-   **Action Required**:
    -   Combine the two tests into a single user journey: `should create, view, and delete an expense`.
    -   The test will create one group, add an expense, view it, delete it, and then assert that it's gone.

## Final Recommendation

The test suite is structurally sound but requires a final pass of refinement to eliminate these remaining inefficiencies and violations. By focusing on creating simple, atomic, and journey-based tests, the suite will be faster, more reliable, and much easier to maintain in the long run. The highest priority should be fixing the incorrect fixture usage and manual user creation.