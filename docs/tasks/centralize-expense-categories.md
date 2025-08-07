# Plan to Centralize Expense Categories

## 1. Problem

Expense categories are currently scattered throughout the codebase, leading to inconsistencies and maintenance challenges. We have different lists of categories in the frontend, backend tests, and e2e tests. The backend currently accepts any string as a category, as long as it meets length requirements.

## 2. Goal

The goal is to centralize the management of expense categories to ensure consistency across the application and simplify future updates. We will maintain support for custom, user-defined categories, but the list of predefined suggestions should come from a single source of truth.

## 3. Proposed Solution

### 3.1. Single Source of Truth

-   Create a canonical list of predefined expense categories. This list will reside in a new file: `firebase/functions/src/constants/expense-categories.ts`.
-   This file will export an array of category objects, each with a `name` (user-facing) and a `value` (for internal use, e.g., a slug).

**Example `expense-categories.ts`:**

```typescript
export const PREDEFINED_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', value: 'food' },
  { name: 'Transportation', value: 'transport' },
  { name: 'Utilities', value: 'utilities' },
  { name: 'Entertainment', value: 'entertainment' },
  { name: 'Shopping', value: 'shopping' },
  { name: 'Accommodation', value: 'accommodation' },
  { name: 'Healthcare', value: 'healthcare' },
  { name: 'Education', value: 'education' },
  { name: 'Other', value: 'other' },
];
```

### 3.2. Backend API Endpoint

-   Create a new public API endpoint, `GET /api/v1/expenses/categories`, to serve the predefined category list.
-   This endpoint will be handled by a new handler in `firebase/functions/src/expenses/handlers.ts`.
-   The handler will read the `PREDEFINED_EXPENSE_CATEGORIES` and return them.
-   This endpoint should be cached appropriately.

### 3.3. Frontend Integration

-   Remove the hardcoded `EXPENSE_CATEGORIES` array from `webapp-v2/src/constants.ts`.
-   Create a new store or hook in the frontend (e.g., `useExpenseCategories`) to fetch the categories from the new API endpoint.
-   The `CategorySuggestionInput` component will be updated to use the data from this new store/hook.
-   The `expense-form-store.ts` will be updated to use the new category data structure.

### 3.4. Update Tests

-   Update all tests (unit, integration, and e2e) that use hardcoded category lists to fetch them from the new source of truth or the new API endpoint.
-   Tests for custom/freeform categories should be preserved to ensure that functionality remains intact.

## 4. Implementation Steps

1.  Create `firebase/functions/src/constants/expense-categories.ts` with the canonical list.
2.  Implement the `GET /api/v1/expenses/categories` endpoint in the Firebase backend.
3.  Refactor the frontend to fetch categories from the new endpoint.
4.  Update `CategorySuggestionInput.tsx` and `expense-form-store.ts`.
5.  Update all relevant tests to use the new centralized category data.
6.  Remove the old, scattered category lists.
