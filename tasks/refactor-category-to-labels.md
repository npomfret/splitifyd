# Refactor "Category" to "Labels"

This document outlines all the necessary changes to refactor the concept of "category" to "labels" throughout the codebase.

## Current Status (updated November 13, 2025)

- ✅ Mapping confirmed: every domain/API/UI reference to “category/categories” has been migrated to “label/labels”.
- ✅ Shared contracts, schemas, builders, and test-support utilities now expose `ExpenseLabel`, `PREDEFINED_EXPENSE_LABELS`, and `label` fields exclusively.
- ✅ Firebase schemas, services, validation utilities, locales, scripts, and the entire affected unit/integration suite have been updated to use `label` plus the new `INVALID_LABEL` error code.
- ✅ Webapp stores, hooks, pages, UI components (now `LabelSuggestionInput`), and locale strings present “Label” everywhere; the e2e suite targets the renamed input (`typeLabelText`).
- ✅ `npm run build` passes across all workspaces after the refactor.

**Note on nomenclature:** The request was to refactor "category" (singular) to "labels" (plural). This is ambiguous. This document assumes the following mapping:
- "category" (singular) becomes "label" (singular)
- "categories" (plural) becomes "labels" (plural)
- `INVALID_CATEGORY` becomes `INVALID_LABEL`
- `ExpenseCategory` becomes `ExpenseLabel`

This will need to be confirmed before implementation.

## `packages/`

### `packages/shared`

- **`src/schemas/apiSchemas.ts`**:
  - The Zod schema for API requests contains a `category` field that needs to be renamed.
- **`src/schemas/apiRequests.ts`**:
  - The Zod schema for API requests has a `category` field with validation rules that will need to be updated.
- **`src/shared-types.ts`**:
  - The `ExpenseCategory` interface should be renamed.
  - The `PREDEFINED_EXPENSE_CATEGORIES` constant should be renamed.
  - The `category` property in `Expense`, `ExpenseDraft`, and `ExpenseUpdate` interfaces needs to be renamed.

### `packages/test-support`

- **`src/page-objects/ExpenseFormPage.ts`**:
  - Methods and locators related to the category input field need to be renamed (e.g., `getCategoryInput`, `typeCategoryText`).
- **`src/builders/CreateExpenseRequestBuilder.ts`**:
  - The `withCategory` method and `category` property need to be renamed.
  - The `randomCategory` import and usage will need to be updated.
- **`src/builders/ExpenseUpdateBuilder.ts`**:
  - The `withCategory` method and `category` property need to be renamed.
- **`src/builders/ExpenseDTOBuilder.ts`**:
  - The `withCategory` method and `category` property need to be renamed.
- **`src/builders/ExpenseDraftBuilder.ts`**:
  - The `withCategory` method and `category` property need to be renamed.
- **`src/test-helpers.ts`**:
  - The `randomCategory` function should be renamed.

## `firebase/`

### `firebase/functions`

- **`src/services/ExpenseService.ts`**:
  - The `category` property used when creating an expense needs to be updated.
- **`src/services/firestore/FirestoreReader.ts`**:
  - The field name `'category'` needs to be updated in Firestore queries.
- **`src/schemas/expense.ts`**:
  - The Zod schema for expenses has a `category` field that needs to be renamed.
- **`src/__tests__/**/*.ts`**:
  - All test files that reference "category" in descriptions, assertions, and test data will need to be updated. This includes:
    - `unit/validation/InputValidation.test.ts`
    - `unit/validation/string-validation.test.ts`
    - `unit/validation.test.ts`
    - `unit/services/ExpenseService.test.ts`
    - `unit/permission-engine-async.test.ts`
    - `unit/groups/GroupHandlers.test.ts`
    - `unit/expenses/ExpenseConcurrentUpdates.test.ts`
    - `unit/expenses/ExpenseHandlers.test.ts`
    - `unit/app.test.ts`
    - `integration/expense-locking.test.ts`
    - `integration/comments.test.ts`
    - `integration/normal-flow/custom-categories.test.ts`
    - `integration/normal-flow/freeform-categories-api.test.ts`
- **`src/utils/i18n-validation.ts`**:
  - The key `category` used for validation messages needs to be updated.
- **`src/utils/validation.ts`**:
  - The error code `INVALID_CATEGORY` needs to be renamed.
- **`src/expenses/validation.ts`**:
  - The validation logic for `category` needs to be updated, including the error code `INVALID_CATEGORY`.
- **`src/locales/en/translation.json`**:
  - The `categoryTooLong` error message needs to be updated.
- **`scripts/test-data-generator.ts`**:
  - The logic for generating test data with categories needs to be updated.

## `webapp-v2/`

- **`src/pages/AddExpensePage.tsx`**:
  - The `category` prop needs to be renamed.
- **`src/pages/ExpenseDetailPage.tsx`**:
  - The display of the expense `category` needs to be updated.
- **`src/components/expense-form/ExpenseBasicFields.tsx`**:
  - The `CategorySuggestionInput` component usage and related props need to be updated.
- **`src/components/group/ExpenseItem.tsx`**:
  - The display of the expense `category` needs to be updated.
- **`src/components/ui/index.ts`**:
  - The export of `CategorySuggestionInput` needs to be renamed.
- **`src/components/ui/CategorySuggestionInput.tsx`**:
  - The component itself, its props, and internal state and logic need to be renamed.
- **`src/app/hooks/useFormInitialization.ts`**:
  - The logic for initializing the expense form with a `category` needs to be updated.
- **`src/app/hooks/useFormState.ts`**:
  - The `category` property in the form state needs to be renamed.
- **`src/app/hooks/useFormSubmission.ts`**:
  - The `category` property used in the form submission logic needs to be renamed.
- **`src/app/hooks/useExpenseForm.ts`**:
  - The `category` property in the form state needs to be renamed.
- **`src/app/stores/expense-form-store.ts`**:
  - The state, signals, and actions related to `category` in the expense form store need to be renamed.
- **`src/locales/en/translation.json`**:
  - All UI text related to "category" needs to be updated to "label".

## `e2e-tests/`

- **`src/__tests__/integration/error-handling-comprehensive.e2e.test.ts`**:
  - The end-to-end test that interacts with the category field needs to be updated.
