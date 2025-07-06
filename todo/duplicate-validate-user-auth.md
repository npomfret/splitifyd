# Duplicate `validateUserAuth` Function

## Problem
- **Location**:
    - `firebase/functions/src/documents/handlers.ts:22-27`
    - `firebase/functions/src/expenses/handlers.ts:35-40`
- **Description**: The `validateUserAuth` function is duplicated across `documents/handlers.ts` and `expenses/handlers.ts`. This leads to redundant code and makes maintenance harder. If a change is needed in this validation logic, it has to be applied in multiple places, increasing the risk of inconsistencies and bugs.
- **Current vs Expected**: Currently, the same logic for validating user authentication is present in two different files. Expected behavior is to have a single, shared utility function for this common task.

## Solution
- Move the `validateUserAuth` function to a shared utility file, for example, `firebase/functions/src/utils/auth.ts` or `firebase/functions/src/auth/utils.ts`.
- Import this shared utility function into `documents/handlers.ts` and `expenses/handlers.ts`.
- Update all calls to `validateUserAuth` in both files to use the imported function.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (improves code maintainability, reduces duplication, makes future changes easier)

## Implementation Notes
- Create a new file `firebase/functions/src/auth/utils.ts` (or similar).
- Export the `validateUserAuth` function from the new utility file.
- Update imports in `documents/handlers.ts` and `expenses/handlers.ts`.
