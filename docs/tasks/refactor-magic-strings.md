
# Refactor Magic Strings to Shared Constants

## Problem

There are numerous "magic strings" (hardcoded string literals) duplicated across the client and server codebases. This practice is problematic because:

-   **It's error-prone:** A typo in one location can lead to subtle bugs that are hard to track down.
-   **It makes changes difficult:** Updating a value requires finding and replacing all instances, which is time-consuming and risky.
-   **It obscures intent:** Shared constants provide a single source of truth and make the code more self-documenting.

## Solution

The plan is to centralize these magic strings into the `firebase/functions/src/types/webapp-shared-types.ts` file. This file is already shared between the client and server, making it the ideal location for these constants.

### Identified Magic Strings and Cleanup Plan

1.  **User Roles (`"user"`, `"admin"`)**
    *   **Locations:**
        *   `firebase/functions/src/auth/handlers.ts`
        *   `firebase/functions/src/auth/middleware.ts`
        *   `webapp-v2/src/api/apiSchemas.ts`
    *   **Plan:** Create a `UserRole` enum or a const object in `webapp-shared-types.ts`.

2.  **Firestore Collection Names (`"documents"`, `"expenses"`, `"settlements"`, `"users"`, `"policies"`)**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/groups/balanceHandlers.ts`
        *   `firebase/functions/src/groups/handlers.ts`
        *   `firebase/functions/src/groups/memberHandlers.ts`
        *   `firebase/functions/src/groups/shareHandlers.ts`
        *   `firebase/functions/src/services/balanceCalculator.ts`
        *   `firebase/functions/src/services/expenseMetadataService.ts`
        *   `firebase/functions/src/settlements/handlers.ts`
        *   `firebase/functions/src/auth/handlers.ts`
        *   `firebase/functions/src/auth/middleware.ts`
        *   `firebase/functions/src/auth/policy-helpers.ts`
        *   `firebase/functions/src/policies/handlers.ts`
        *   `firebase/functions/src/scripts/seed-policies.ts`
    *   **Plan:** Create a `FirestoreCollection` enum or a const object in `webapp-shared-types.ts`.

3.  **Expense Split Types (`"equal"`, `"exact"`, `"percentage"`)**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/expenses/validation.ts`
        *   `webapp-v2/src/api/apiSchemas.ts`
        *   `webapp-v2/src/app/stores/expense-form-store.ts`
    *   **Plan:** This is already defined as a type, but we should create a `SplitType` const object to reference the string values.

4.  **Auth Error Codes (`"auth/email-already-exists"`, `"EMAIL_EXISTS"`)**
    *   **Locations:**
        *   `firebase/functions/src/auth/handlers.ts`
        *   `webapp-v2/src/app/stores/auth-store.ts`
    *   **Plan:** Create an `AuthError` const object in `webapp-shared-types.ts`.

5.  **Policy IDs (`"terms-of-service"`, `"cookie-policy"`, `"privacy-policy"`)**
    *   **Locations:**
        *   `firebase/functions/src/scripts/seed-policies.ts`
        *   `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
        *   `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
        *   `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
    *   **Plan:** Create a `PolicyId` enum or a const object in `webapp-shared-types.ts`.

6.  **`"deletedAt"` Field Name**
    *   **Locations:**
        *   `firebase/functions/src/expenses/handlers.ts`
        *   `firebase/functions/src/expenses/validation.ts`
        *   `webapp-v2/src/components/group/ExpenseItem.tsx`
    *   **Plan:** Add a `DELETED_AT_FIELD` constant to `webapp-shared-types.ts`.

## Implementation Steps

1.  **Modify `webapp-shared-types.ts`:** Add the new enums/const objects.
2.  **Refactor Server Code:** Replace all magic strings in the `firebase/functions` directory with the new shared constants.
3.  **Refactor Client Code:** Replace all magic strings in the `webapp-v2` directory with the new shared constants.
4.  **Run Tests:** Execute the test suite to ensure that the changes haven't introduced any regressions.
5.  **Commit and Push:** Commit the changes with a descriptive message.

This refactoring will significantly improve the codebase's quality and maintainability.
