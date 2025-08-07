# Task: E2E Test Suite Audit and Refactoring (Post-Update)

**Status:** Not Started
**Priority:** High
**Effort:** High

## Executive Summary

Following recent updates to the codebase, a new comprehensive audit of the E2E test suite was conducted against the principles in `e2e-tests/README.md`. While some previous issues have been addressed, several significant violations and inefficiencies remain. The most critical recurring issues are the **misuse of test fixtures** and the **creation of redundant, inefficient tests** that violate the "Atomic & Idempotent Tests" principle.

This document outlines the necessary refactoring to align the entire suite with its guiding principles, which will improve reliability, reduce execution time, and simplify maintenance.

## Key Violations and Required Refactoring

### 1. Violation: Inefficient Test Setup and Lack of Atomicity

Many test files use a `test.beforeEach` hook to create a new group for every single test in the file. This is highly inefficient and violates the principle of writing atomic tests that are self-contained. A single test should represent a complete, linear user journey where possible.

**Affected Files:**
- `e2e-tests/src/tests/normal-flow/advanced-splitting-happy-path.e2e.test.ts`
- `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`

**Action Required:**
- **Remove `test.beforeEach` hooks** from these files.
- **Consolidate tests** into single, more comprehensive user journeys. For example, in `advanced-splitting-happy-path.e2e.test.ts`, a single test should create a group, add an equal split expense, then an exact split, then a percentage split, all within one flow. This is more realistic and efficient.
- Similarly, the tests in `group-display.e2e.test.ts` should be merged into one or two tests that create a group and then perform all the necessary assertions for that state.

### 2. Violation: Incorrect Fixture Usage

Tests that require an authenticated user are not consistently using the correct fixtures (`authenticatedPageTest`, `multiUserTest`, `threeUserTest`). Some tests use the base `pageTest` and then manually create users, which bypasses the user pool and violates the "Fixtures Over Bare Tests" rule.

**Affected Files:**
- `e2e-tests/src/tests/error-testing/duplicate-registration.e2e.test.ts`: Uses `pageTest` but performs registration, which is a user-related activity. While it doesn't require a *pre-authenticated* user, the logic is complex and would be better managed in a more controlled test.
- `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`: This test now uses the `multiUserTest` fixture but still contains manual navigation and setup that could be simplified.

**Action Required:**
- Review all tests using `pageTest` and determine if they should be using an authenticated fixture instead. 
- The `duplicate-registration` test should be re-evaluated. It could potentially be simplified by using an `authenticatedPageTest` to create the first user, logging out, and then attempting to register again with the same credentials.

### 3. Violation: Redundant and Overlapping Tests

There is still significant duplication of effort across the test suite.

**Examples:**
- `form-validation-errors.e2e.test.ts` and `dashboard-validation.e2e.test.ts` both test the validation of the 'Create Group' modal. This logic should be consolidated into the main `form-validation.e2e.test.ts` file.
- `network-errors.e2e.test.ts` contains a duplicate of a form validation test.
- `balance-visualization.e2e.test.ts` has been improved but still contains overly complex helper classes (`BalanceTestScenarios`) that should be removed in favor of direct page object calls to keep tests simple and readable.

**Action Required:**
- **Merge `form-validation-errors.e2e.test.ts` and `dashboard-validation.e2e.test.ts` into `form-validation.e2e.test.ts`.**
- **Remove the redundant validation test** from `network-errors.e2e.test.ts`.
- **Simplify `balance-visualization.e2e.test.ts`** by removing the `BalanceTestScenarios` class and calling page object methods directly within the tests.

### 4. Violation: Unnecessary Complexity and Debugging Artifacts

The `three-user-settlement.e2e.test.ts` file, while functionally important, is filled with `console.log` statements. These are debugging artifacts and are explicitly discouraged. The test is also overly long and contains many manual `reload()` and `waitForLoadState()` calls that should be abstracted into robust page object methods.

**Affected File:**
- `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`

**Action Required:**
- **Remove all `console.log` statements** from the test file.
- Refactor the test to rely on robust, explicit waits within the page objects (e.g., `groupDetailPage.waitForBalanceCalculation()`) rather than manual reloads.
- Break down the monolithic test into smaller, more focused tests if possible, while still using the `threeUserTest` fixture to maintain efficiency.

## General Recommendations

- **Strict Adherence to README**: All developers must treat the `e2e-tests/README.md` as a strict style guide. 
- **Simplify, Simplify, Simplify**: The goal is not just for tests to pass, but for them to be easily understood and maintained. Complex helper classes and workflows inside test files should be avoided.
- **Embrace User Journeys**: Refactor discrete, single-action tests into longer, more realistic user journey tests. This is more efficient and provides higher-quality validation.

## Next Steps

1.  Create sub-tasks for each of the four major violation categories.
2.  Prioritize the consolidation of redundant tests and the removal of `beforeEach` hooks to gain immediate performance improvements.
3.  Refactor the complex multi-user tests to be more streamlined and readable.
4.  Conduct a final review to ensure all tests are using the correct fixtures and adhering to the established patterns.