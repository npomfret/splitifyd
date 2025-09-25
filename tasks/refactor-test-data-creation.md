# Task: Refactor Test Data Creation to Use Builders Consistently

## 1. Overview

An analysis of the project's test suites reveals inconsistent practices for creating test data. While the project has a solid foundation of using the builder pattern (e.g., `CreateExpenseRequestBuilder`, `GroupTestDataBuilder`, `UserProfileBuilder`), there are numerous instances where test data is still created using direct object literals (`{...}`).

This inconsistency increases cognitive load for developers, makes tests more brittle, and misses an opportunity to enforce valid-by-construction data objects. This task outlines a plan to refactor the remaining parts of the codebase to use the builder pattern consistently.

## 2. Problem Areas

### Area 1: API Driver Update Payloads

Object literals are frequently used for the `update` payloads in `ApiDriver` calls.

-   **Location**: Integration tests across `firebase/functions/src/__tests__/integration/`.
-   **Example** (`balance-settlement-consolidated.test.ts`):
    ```typescript
    const updateData = {
        amount: 75.25,
        note: 'Updated note',
    };
    await apiDriver.updateSettlement(created.id, updateData, ...);
    ```
-   **Example** (`groups-management-consolidated.test.ts`):
    ```typescript
    const updateData = {
        name: 'Updated Group Name API',
        description: 'Updated via API',
    };
    await apiDriver.updateGroup(testGroup.id, updateData, ...);
    ```
-   **Problem**: This approach doesn't enforce the shape of the update payload and can become verbose for complex updates.

### Area 2: Mock Data for Stubs in Unit Tests

Older or partially refactored unit tests still use object literals to set up mock data for stubs, even when builders for those objects exist.

-   **Location**: `firebase/functions/src/__tests__/unit/services/BalanceCalculationService.test.ts`
-   **Example**:
    ```typescript
    stubFirestoreReader.setDocument('groups', groupId, {
        id: groupId,
        name: 'Test Group',
        members: { /*...*/ },
    });

    stubAuthService.setUser(userId1, { uid: userId1, email: 'user1@test.com', displayName: 'User 1' });
    ```
-   **Problem**: This test file is already using `FirestoreGroupBuilder` and `UserProfileBuilder` elsewhere. The remaining object literals should be replaced for consistency and to ensure the mock data matches the real schema.

### Area 3: E2E Page Object Method Payloads

Page object methods in E2E tests often accept a plain object for form submissions. While this is good encapsulation, the calling test code still constructs the object manually.

-   **Location**: `e2e-tests/src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts`
-   **Example**:
    ```typescript
    await expenseFormPage.submitExpense({
        description: expenseDescription,
        amount: 100,
        paidByDisplayName: user1DisplayName,
        currency: 'EUR',
        splitType: 'equal',
        participants: [user1DisplayName, user2DisplayName],
    });
    ```
-   **Problem**: For complex forms, creating this object can be cumbersome. A builder would make the intent clearer and the construction safer.

### Area 4: Static Test Scenarios

The Playwright test suite relies on `TestScenarios.ts`, which exports static object literals.

-   **Location**: `webapp-v2/src/__tests__/unit/playwright/objects/TestScenarios.ts`
-   **Example** (from usage in `dashboard-page.test.ts`):
    ```typescript
    const testUser = TestScenarios.validUser;
    ```
-   **Problem**: Static objects are inflexible. If a test needs a slight variation of `validUser`, it has to resort to object spreading (`{...TestScenarios.validUser, name: 'New Name'}`), which is what builders are designed to prevent.

## 3. Proposed Refactoring Plan

### Phase 1: Create Missing Builders

1.  **Create `UpdateGroupPayloadBuilder`**: For constructing group update payloads.
2.  **Create `UpdateExpensePayloadBuilder`**: For expense updates.
3.  **Create `UpdateSettlementPayloadBuilder`**: For settlement updates.
4.  **Create `GroupMemberBuilder`**: For creating `GroupMemberDocument` objects, which are currently created manually in `groups-management-consolidated.test.ts`.
5.  **Create `ExpenseFormBuilder` / `SettlementFormBuilder`**: For E2E test form data.

### Phase 2: Refactor Integration Tests

-   Go through all files in `firebase/functions/src/__tests__/integration/`.
-   Replace all `apiDriver.update...` calls that use object literals with the new payload builders.

### Phase 3: Refactor Unit Tests

-   Audit files in `firebase/functions/src/__tests__/unit/`.
-   Focus on `BalanceCalculationService.test.ts` and `groups-management-consolidated.test.ts`.
-   Replace all object literals used with `stubFirestoreReader.setDocument()` with the appropriate `Firestore...Builder`.
-   Replace `groupService.createGroup(..., { name: '...' })` with `CreateGroupRequestBuilder`.

### Phase 4: Refactor E2E and Playwright Tests

1.  **Refactor `TestScenarios.ts`**: Convert the static objects into factory functions that return pre-configured builders.
    -   **Before**: `export const validUser = { ... };`
    -   **After**: `export const validUserBuilder = () => new UserProfileBuilder().withEmail(...);`
2.  **Refactor E2E Tests**: Update the `submitExpense` and `submitSettlement` calls to use the new form builders.

## 4. Benefits

-   **Consistency**: All test data will be created using a single, consistent pattern.
-   **Readability**: Builders make the intent of the test data setup much clearer (e.g., `.withErrorState()`, `.asAdmin()`).
-   **Maintainability**: When a data model changes, only the builder needs to be updated, not every test file that creates that object.
-   **Type Safety**: Builders ensure that the created data objects are always valid according to the defined schema.
