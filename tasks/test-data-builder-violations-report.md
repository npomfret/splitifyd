# Audit: Test Data Creation Violations

## 1. Overview

This report details an audit of the test suites to identify violations of the project's rule to exclusively use builders from the `@splitifyd/test-support` package for test data creation. While many tests adhere to this standard, several instances of direct object literal (`{...}`) usage were found, which increases maintenance overhead and reduces type safety.

This document outlines the identified violations and provides a clear plan for refactoring.

## 2. Problem Areas & Violations

### Area 1: E2E Test Form Submissions

Object literals are used to define form data when calling page object submission methods.

-   **Location**: `e2e-tests/src/__tests__/integration/`
-   **Files Affected**:
    -   `core-features.e2e.test.ts`
    -   `expense-and-balance-lifecycle.e2e.test.ts`
-   **Example Violation** (`core-features.e2e.test.ts`):
    ```typescript
    await expenseFormPage.submitExpense({
        description: expenseDescription,
        amount: 100,
        currency: 'JPY',
        paidByDisplayName: ownerDisplayName,
        splitType: 'equal',
        participants: [ownerDisplayName, memberDisplayName],
    });
    ```
-   **Problem**: This is brittle. If the form's data structure changes, this test will fail silently at runtime, not at compile time.
-   **Recommendation**: Replace the object literal with the `ExpenseFormDataBuilder` from `@splitifyd/test-support`.

### Area 2: Unit Test Mock Data (`firebase/functions`)

Several unit tests use object literals to create mock data for stubs like `StubFirestoreReader` and `StubAuthService`, even when builders for these objects exist.

-   **Location**: `firebase/functions/src/__tests__/unit/`
-   **Files Affected**:
    -   `GroupService.test.ts`
    -   `services/BalanceCalculationService.test.ts`
    -   `services/ExpenseService.test.ts`
    -   `services/SettlementService.test.ts`
    -   `services/UserService.test.ts`
-   **Example Violation** (`services/BalanceCalculationService.test.ts`):
    ```typescript
    stubAuthService.setUser(userId1, { uid: userId1, email: 'user1@test.com', displayName: 'User 1' });

    stubFirestoreReader.setDocument('users', userId1, { uid: userId1, email: 'user1@test.com', displayName: 'User 1' });
    ```
-   **Problem**: This creates inconsistent and untyped mock data. The `refactor-test-data-creation-violations.md` task already fixed this in some files, but violations remain.
-   **Recommendation**: Use the `StubDataBuilder` for all stubbed documents (`StubDataBuilder.authUserRecord()`, `StubDataBuilder.userDocument()`, etc.) and other specific builders like `FirestoreGroupBuilder` or `UserProfileBuilder` where appropriate.

### Area 3: Playwright Unit Test Infrastructure (`webapp-v2`)

The Playwright unit tests contain structural issues related to test data creation.

-   **Files Affected**:
    -   `webapp-v2/src/__tests__/unit/playwright/objects/TestScenarios.ts`
    -   `webapp-v2/src/__tests__/unit/playwright/builders/GroupTestDataBuilder.ts`
-   **Violation 1: Static Test Scenarios** (`TestScenarios.ts`):
    ```typescript
    // from usage in dashboard-page.test.ts
    const testUser = TestScenarios.validUser;
    ```
-   **Problem**: The `TestScenarios.ts` file exports static objects, which are inflexible. The `refactor-test-data-creation-violations.md` task correctly identifies this as an anti-pattern and notes it was fixed by converting these to builder factory functions (e.g., `validUserBuilder()`). This violation needs to be addressed.
-   **Recommendation**: Convert all static objects in `TestScenarios.ts` to factory functions that return a pre-configured builder instance (e.g., `TestUserBuilder`).

-   **Violation 2: Legacy Builder** (`GroupTestDataBuilder.ts`):
-   **Problem**: This file defines a local, legacy builder. All builders should be centralized in the `@splitifyd/test-support` package for consistency and reuse across all test suites (Unit, Integration, and E2E).
-   **Recommendation**: Move the logic from `GroupTestDataBuilder.ts` into a suitable builder in `@splitifyd/test-support` and remove the local file.

### Area 4: Integration Test Payloads

-   **Location**: `firebase/functions/src/__tests__/integration/`
-   **Files Affected**:
    -   `concurrent-operations.integration.test.ts`
-   **Example Violation** (`concurrent-operations.integration.test.ts`):
    ```typescript
    expenseService.createExpense(testUser1.uid, {
        groupId: testGroup.id,
        paidBy: testUser1.uid,
        amount: 100,
        // ...
    })
    ```
-   **Problem**: Direct object creation for service-layer calls.
-   **Recommendation**: Use `CreateExpenseRequestBuilder`.

## 3. Refactoring Plan

1.  **Centralize Builders**:
    -   [ ] Move the `GroupTestDataBuilder` from `webapp-v2` to `@splitifyd/test-support`.
    -   [ ] Refactor `TestScenarios.ts` in `webapp-v2` to export builder factory functions instead of static objects.

2.  **Refactor E2E Tests**:
    -   [ ] Go through all files in `e2e-tests/src/__tests__/integration/`.
    -   [ ] Replace all `submitExpense` and `submitSettlement` calls that use object literals with `ExpenseFormDataBuilder` and `SettlementFormDataBuilder`.

3.  **Refactor Unit & Integration Tests**:
    -   [ ] Audit all files in `firebase/functions/src/__tests__/`.
    -   [ ] Replace object literals used with `stubFirestoreReader.setDocument()` and `stubAuthService.setUser()` with the appropriate methods from `StubDataBuilder`.
    -   [ ] Replace object literals in service calls (e.g., `createExpense`, `updateGroup`) with the corresponding request builders.

## 4. Benefits of Refactoring

-   **Consistency**: A single, unified pattern for creating test data across all tests.
-   **Type Safety**: Ensures all test data conforms to the latest schemas, catching errors at compile time.
-   **Maintainability**: Data model changes only require updating a single builder, not dozens of test files.
-   **Readability**: Builder methods like `.asAdmin()` or `.withWeakPassword()` make the intent of test data clear.
