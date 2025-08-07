# Task: E2E Test Suite Audit and Refactoring

**Status:** Not Started
**Priority:** Medium
**Effort:** High

## Executive Summary

An audit of the entire E2E test suite was conducted against the best practices and core principles defined in `e2e-tests/README.md`. While the suite has a solid foundation with fixtures and the Page Object Model, there are numerous violations and inconsistencies that compromise test reliability, maintainability, and efficiency. 

This document outlines the required refactoring tasks to bring the test suite into full compliance with its own stated guidelines. The most critical issues are the misuse of fixtures, manual user creation, and redundant or overly complex test logic.

## Key Violations and Required Refactoring

### 1. Manual User and Group Creation (Violation of "Fixtures Over Bare Tests")

Many tests manually create users and groups using `GroupWorkflow.createTestGroup(page, ...)` or `AuthenticationWorkflow.createTestUser(page)`. This is a direct violation of the principle to **always use fixtures for authentication**. This practice bypasses the user pool, creates a new user for every test run, and significantly slows down the suite.

**Affected Files:**
- `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`
- `e2e-tests/src/tests/error-testing/security-errors.e2e.test.ts`
- `e2e-tests/src/tests/error-testing/network-errors.e2e.test.ts`
- `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`

**Action Required:**
- Refactor all tests in these files to use the `authenticatedPageTest` or `multiUserTest` fixtures.
- Remove the static `createTestGroup` and `createTestUser` methods from the workflow classes. Workflows should be instantiated within a test and operate on the pages/users provided by the fixtures.

### 2. Redundant and Overlapping Tests (Violation of "No Code Duplication")

There is significant overlap in what is being tested across different files. This makes the suite larger and slower than necessary and increases the maintenance burden.

**Examples:**
- The test `verifies group access control behavior` is duplicated in `network-errors.e2e.test.ts` and `security-errors.e2e.test.ts`.
- Multiple files test basic form validation (`form-validation.e2e.test.ts`, `form-validation-errors.e2e.test.ts`, `auth-validation.e2e.test.ts`).
- Balance calculation is tested implicitly in `multi-user-happy-path.e2e.test.ts` and explicitly in `balance-display.e2e.test.ts`.

**Action Required:**
- Consolidate duplicated tests. For example, there should be only one access control test, and it should use the `multiUserTest` fixture.
- Merge form validation tests into a single, comprehensive file (`form-validation.e2e.test.ts`).
- Centralize balance-related assertions into `balance-visualization.e2e.test.ts` and the three-user settlement test, removing redundant checks from other files.

### 3. Inefficient Test Setup (Violation of "Test Isolation" and "Atomic Tests")

Some tests use `test.beforeEach` to create a new group for every single test within a `describe` block. While this ensures isolation, it is highly inefficient. A better approach for related tests is to create the necessary state once within a single, more comprehensive test.

**Affected Files:**
- `e2e-tests/src/tests/normal-flow/advanced-splitting-happy-path.e2e.test.ts`
- `e2e-tests/src/tests/normal-flow/group-display.e2e.test.ts`

**Action Required:**
- Remove the `test.beforeEach` hooks. 
- For `advanced-splitting-happy-path.e2e.test.ts`, combine the separate tests for equal, exact, and percentage splits into a single, linear test that performs all actions within the same group. This more accurately reflects a user journey.
- For `group-display.e2e.test.ts`, a single test can create a group and then perform all necessary assertions.

### 4. Overly Complex and Brittle Test Logic

Some tests, particularly the multi-user tests, have become overly complex with manual `page.reload()` calls, `console.log` statements for debugging, and fragile state management. The `balance-visualization.e2e.test.ts` file, for instance, contains a `BalanceTestScenarios` class that, while clever, adds a layer of abstraction that makes the tests harder to read and maintain. The tests should be simple, direct, and rely on the fixtures and page objects.

**Affected Files:**
- `e2e-tests/src/tests/normal-flow/balance-visualization.e2e.test.ts`
- `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`

**Action Required:**
- Simplify the tests by removing the `BalanceTestScenarios` class and other unnecessary abstractions. Tests should directly call page object methods.
- Remove all `console.log` statements. Debugging information should come from Playwright's reporters and trace viewers.
- Rely on robust page object methods like `waitForBalanceCalculation()` and `waitForUserSynchronization()` instead of manual reloads to manage state.

### 5. Inconsistent Use of Fixtures

Some tests use the base `test` from `@playwright/test` or the less-equipped `pageTest` fixture when they perform actions that require an authenticated user. All tests that require a logged-in user MUST use `authenticatedPageTest` or `multiUserTest`.

**Affected Files:**
- `e2e-tests/src/tests/normal-flow/member-display.e2e.test.ts`
- `e2e-tests/src/tests/edge-cases/complex-scenarios.e2e.test.ts`

**Action Required:**
- Change the import from `base-test` or `page-fixtures` to the appropriate authenticated fixture (`authenticated-page-test` or `multi-user-test`).

## General Recommendations

- **Enforce README Guidelines**: All future PRs must be reviewed against the `e2e-tests/README.md`.
- **Prioritize Simplicity**: Tests should be easy to read and understand. Avoid complex conditional logic, helper classes within test files, and other abstractions that obscure the test's intent.
- **Trust the Fixtures**: The fixture hierarchy is well-designed. Trust it to provide the necessary state and objects for the tests.

## Next Steps

1.  Create individual sub-tasks for each of the major violation categories listed above.
2.  Prioritize the refactoring of tests that manually create users, as this provides the biggest performance improvement.
3.  Consolidate and simplify the redundant tests.
4.  Perform a final review of the entire suite after refactoring to ensure 100% compliance with the README.