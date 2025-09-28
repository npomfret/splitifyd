# Test Data Builder Violation Report

## 1. Introduction

This report details the findings of an analysis of all test files (`__tests__` directories) within the project. The goal of this analysis was to identify all instances where test data is created using raw object literals (`{...}`) instead of the builder classes provided in the `@splitifyd/test-support` package.

Using builders for test data creation is a project convention that improves test readability, maintainability, and type safety. This report documents all violations of this convention to guide a refactoring effort.

## 2. Summary of Findings

The analysis revealed that while builders are used in many parts of the codebase, there are still numerous instances of direct object literal usage for creating test data. The most common areas for these violations are:

-   **Integration Tests**: Payloads for API driver calls (e.g., `apiDriver.updateGroup`, `apiDriver.createExpense`) are frequently created as object literals.
-   **Unit Test Stubs**: Mock data for `StubFirestoreReader` and `StubAuthService` is often created manually.
-   **E2E Tests**: Form submission payloads in page objects are constructed as object literals.

The consistent use of builders will significantly improve the quality and robustness of the test suite.

## 3. Detailed Violation Report

The following is a file-by-file breakdown of all identified violations.

---

### `firebase/functions/src/__tests__/integration/balance-settlement-consolidated.test.ts`

-   **Line 118: `updateData` for `apiDriver.updateSettlement`**
    -   **Violation**:
        ```typescript
        const updateData = {
            amount: 75.25,
            note: 'Updated note',
        };
        ```
    -   **Recommendation**: Use `SettlementUpdateBuilder` from `@splitifyd/test-support`.

-   **Line 204: `partialSettlement1` for `apiDriver.createSettlement`**
    -   **Violation**:
        ```typescript
        const partialSettlement1 = new SettlementBuilder()
            .withGroupId(group.id)
            // ...
            .build();
        ```
    -   **Note**: This is a good use of the `SettlementBuilder`. However, other parts of the file are inconsistent.

---

### `firebase/functions/src/__tests__/integration/groups-management-consolidated.test.ts`

-   **Line 158: `updateData` for `apiDriver.updateGroup`**
    -   **Violation**:
        ```typescript
        const updateData = {
            name: 'Updated Group Name API',
            description: 'Updated via API',
        };
        ```
    -   **Recommendation**: Use `GroupUpdateBuilder` from `@splitifyd/test-support`.

-   **Line 208: `groupData` for `apiDriver.createGroup`**
    -   **Violation**:
        ```typescript
        const groupData = new CreateGroupRequestBuilder().withName(`Member Test Group ${uuidv4()}`).withDescription('Test group for member operations').build();
        ```
    -   **Note**: Good use of `CreateGroupRequestBuilder`. Inconsistency is the issue.

---

### `firebase/functions/src/__tests__/unit/services/BalanceCalculationService.test.ts`

-   **Line 41: `stubFirestoreReader.setDocument` for group**
    -   **Violation**:
        ```typescript
        stubFirestoreReader.setDocument('groups', groupId, {
            id: groupId,
            name: 'Test Group',
            members: { /*...*/ },
        });
        ```
    -   **Recommendation**: Use `FirestoreGroupBuilder`.

-   **Line 50: `stubAuthService.setUser`**
    -   **Violation**:
        ```typescript
        stubAuthService.setUser(userId1, { uid: userId1, email: 'user1@test.com', displayName: 'User 1' });
        ```
    -   **Recommendation**: Use `UserProfileBuilder`.

---

### `e2e-tests/src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts`

-   **Line 41: `expenseFormPage.submitExpense` payload**
    -   **Violation**:
        ```typescript
        await expenseFormPage.submitExpense({
            description: expenseDescription,
            amount: 100,
            // ...
        });
        ```
    -   **Recommendation**: Create and use an `ExpenseFormDataBuilder` in the E2E test suite.

---

### `webapp-v2/src/__tests__/unit/playwright/objects/TestScenarios.ts`

-   **File-wide issue**: This entire file exports static object literals.
    -   **Violation**:
        ```typescript
        export class TestScenarios {
            static get validUser() {
                if (!this._validUser) {
                    this._validUser = {
                        email: `test-${generateShortId()}@example.com`,
                        password: 'password123',
                        displayName: 'Test User',
                    };
                }
                return this._validUser;
            }
        }
        ```
    -   **Recommendation**: Convert these static objects into factory functions that return pre-configured builders (e.g., `validUserBuilder() { return new UserProfileBuilder().withEmail(...) }`).

---

### `firebase/functions/src/__tests__/integration/check-invalid-data-does-not-break-the-api.integration.test.ts`

-   **Line 45: Corrupted group data**
    -   **Violation**:
        ```typescript
        const corruptedGroup = {
            ...validGroup,
            securityPreset: invalidSecurityPresets[i],
            id: groupRef.id,
        };
        ```
    -   **Recommendation**: While this is intentional for the test, a builder could still be used for the base `validGroup` and then corrupted, which would be a cleaner pattern.

---

### `firebase/functions/src/__tests__/unit/GroupService.test.ts`

-   **Line 60: `membershipDoc`**
    -   **Violation**:
        ```typescript
        const membershipDoc = {
            userId: userId,
            groupId: expectedGroupId,
            memberRole: 'admin',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
        };
        ```
    -   **Recommendation**: Use `GroupMemberDocumentBuilder`.

---

## 4. Recommendations

1.  **Enforce Builder Usage**: All new tests should exclusively use builders for test data creation. This should be part of the code review process.
2.  **Create Missing Builders**: Create the missing builder classes identified in this report, such as `UpdateGroupPayloadBuilder`, `UpdateExpensePayloadBuilder`, and `UpdateSettlementPayloadBuilder`.
3.  **Refactor `TestScenarios.ts`**: Convert the static objects in `webapp-v2/src/__tests__/unit/playwright/objects/TestScenarios.ts` to builder factory functions.
4.  **Gradual Refactoring**: Systematically refactor the files listed in this report to replace object literals with their corresponding builders. This can be done incrementally to avoid a large, disruptive change.
