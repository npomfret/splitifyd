# Add Optional "Location" Field to Expenses

## Problem Description
Currently, expenses only track basic details like amount, description, and date. There is a need to allow users to optionally specify a location for an expense, which could be useful for tracking where spending occurred (e.g., "Starbucks", "Gas Station", "Paris").

## Proposed Solution
Add an optional `location` field to the `Expense` DTO and its corresponding document schema. This field will be a simple string.

## Implementation Plan

1.  **Update Shared Types**:
    *   Modify `packages/shared/src/shared-types.ts` to add an optional `location: string;` field to `ExpenseDTO` and `CreateExpenseRequest`.
2.  **Update Firestore Schema**:
    *   Modify `firebase/functions/src/schemas/expense.ts` to include an optional `location: z.string().optional()` in the `ExpenseDocumentSchema`.
3.  **Update API Validation**:
    *   Modify `firebase/functions/src/expenses/validation.ts` to include the `location` field in the request validation schema (if applicable).
4.  **Update Firestore Writer/Reader**:
    *   Ensure `FirestoreWriter` and `FirestoreReader` correctly handle the new optional field, especially for timestamp conversions (though `string` fields don't usually need special handling).
5.  **Update Expense Service**:
    *   Modify `firebase/functions/src/services/ExpenseService.ts` to store and retrieve the `location` field.
6.  **Update API Handlers**:
    *   Modify `firebase/functions/src/expenses/ExpenseHandlers.ts` to accept and return the `location` field.
7.  **Frontend (webapp-v2) - Optional**:
    *   Update the `CreateExpense` and `EditExpense` forms to include an optional input field for location.
    *   Update `apiClient.ts` and `apiSchemas.ts` for response validation.
8.  **Tests**:
    *   Add/update unit and integration tests for the backend to cover the new `location` field (creation, retrieval, updates).
    *   Update frontend tests if UI changes are implemented.
