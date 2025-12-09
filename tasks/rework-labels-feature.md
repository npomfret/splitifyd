# Rework Expense Labels to be Freeform and Multi-select

## Problem Description
The current expense label system is based on a predefined, static list of `ExpenseLabel` objects (name, displayName, icon). This is restrictive and doesn't allow users to create their own custom labels tailored to their group's specific spending habits. Furthermore, an expense can only have a single label, which limits categorization.

## Proposed Solution
This task reworks the labels feature to be more flexible and powerful.

1.  **Freeform & Multiple Labels**: The `label` field on an expense will be changed from a single `string` to an array of strings (`string[]`), allowing for up to 3 freeform labels per expense.
2.  **Suggested Labels**: A simple, translated list of `string[]` will be provided as suggestions. These are just starting points and are not restrictive.
3.  **Autocomplete from Recent Labels**:
    *   A new map, `recentlyUsedLabels`, will be added to the `Group` document. The structure will be `Record<string, ISOString>`, where the key is the label and the value is the timestamp of its last use.
    *   When an expense is created or updated, this map will be transactionally updated with the labels used.
    *   The frontend will use this map to provide an autocomplete dropdown, showing the most recently used labels first, sorted by the timestamp.
4.  **Transactional Updates**: All server-side operations that modify the `Group`'s `recentlyUsedLabels` map and the `Expense` document will be performed within a single Firestore transaction to ensure data integrity.

## Data Model Changes

### `ExpenseDTO` (`packages/shared/src/shared-types.ts`)
The `label` property will be changed from `string` to `string[]`.

```typescript
// From
label: string;

// To
labels: string[]; // Renamed for clarity
```

### `GroupDTO` (`packages/shared/src/shared-types.ts`)
A new `recentlyUsedLabels` map will be added.

```typescript
interface Group {
    // ... existing fields
    recentlyUsedLabels?: Record<string, ISOString>;
}
```

### `CreateExpenseRequest` / `UpdateExpenseRequest`
These will be updated to accept `labels: string[]`.

## Implementation Plan

### Phase 1: Backend and Shared Types

1.  **Update Shared Types (`packages/shared/src/shared-types.ts`)**:
    *   In `Expense` and `ExpenseDTO`, change `label: string` to `labels: string[]`.
    *   In `CreateExpenseRequest` and `UpdateExpenseRequest`, change `label: string` to `labels: string[]`.
    *   In the `Group` interface, add `recentlyUsedLabels?: Record<string, ISOString>;`.

2.  **Update Firestore Schemas (`firebase/functions/src/schemas/`)**:
    *   In `expense.ts`, update `ExpenseDocumentSchema` to have `labels: z.array(z.string()).optional()`. Ensure it allows up to 3 items.
    *   In `group.ts`, update `GroupDocumentSchema` to include `recentlyUsedLabels: z.record(z.string()).optional()`.

3.  **Update API Validation (`firebase/functions/src/expenses/validation.ts`)**:
    *   Update the Zod validation schema for creating and updating expenses to accept `labels: z.array(z.string()).max(3)`.

4.  **Update Expense Service (`firebase/functions/src/services/ExpenseService.ts`)**:
    *   Modify `createExpense` and `updateExpense` methods.
    *   These methods must now perform a transaction:
        *   Create/update the expense document with the new `labels` array.
        *   Read the parent `Group` document.
        *   Update the `recentlyUsedLabels` map in the `Group` document with the labels from the expense and the current timestamp.
        *   Commit the transaction.
    *   Ensure error handling is robust.

5.  **Update API Handlers (`firebase/functions/src/expenses/ExpenseHandlers.ts`)**:
    *   Update the handlers to pass the `labels` array to the `ExpenseService`.
    *   Ensure the responses reflect the new data structure.

6.  **Update Group Service (`firebase/functions/src/services/GroupService.ts`)**:
    *   The `getGroupFullDetails` (and similar methods) should now return the `recentlyUsedLabels` map as part of the `GroupDTO`.

### Phase 2: Frontend (webapp-v2)

7.  **Update API Client & Schemas**:
    *   Update Zod schemas in `webapp-v2/src/app/api/apiSchemas.ts` to reflect the `labels: string[]` change in API responses.

8.  **Update Translation Files (`webapp-v2/src/locales/en/translation.json`)**:
    *   Add a new array for suggested labels, e.g., `suggestedLabels: ["Groceries", "Takeout", "Gas", "Entertainment"]`.

9.  **Update Expense Form Components**:
    *   Modify the label input to be a multi-select or tag-style input component.
    *   The component should allow freeform text entry.
    *   It should display two sets of suggestions below the input:
        1.  **Recently Used**: Fetched from `group.recentlyUsedLabels`, sorted with the most recent first.
        2.  **Suggestions**: Fetched from the i18n translation file.
    *   Implement logic to allow adding up to 3 labels.
    *   Provide a clear "Add another label" button after the first one is entered.

10. **Update Expense Display Components**:
    *   Modify components that display expense details to show a list or badge group for the labels instead of a single label.

### Phase 3: Testing

11. **Backend Tests**:
    *   Write unit tests for the `ExpenseService` to verify the transactional update of both the expense and the group's `recentlyUsedLabels` map.
    *   Update integration tests for the `POST /expenses` and `PUT /expenses/:expenseId` endpoints to validate the new `labels` array and the side-effect on the group.

12. **Frontend Tests**:
    *   Write Playwright integration tests for the new expense form UI.
    *   Test adding one, two, and three labels.
    *   Test the autocomplete functionality, ensuring recently used labels appear and are sorted correctly.
    *   Test that the form prevents adding more than 3 labels.

## Transactional Integrity
All server-side writes that touch both the `Expense` and the `Group` document (for updating `recentlyUsedLabels`) **must** be executed within a single Firestore transaction to prevent data inconsistencies. The `ExpenseService` will be the single point of enforcement for this rule.
