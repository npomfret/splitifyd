# Webapp Issue: Redundant Logic - `waitForAuthManager` Function - COMPLETED

## Issue Description

The `waitForAuthManager` function is repeated in `add-expense.ts`, `expense-detail.ts`, and `group-detail.ts`.

## ✅ IMPLEMENTATION COMPLETED

The refactoring has been successfully implemented:

1. **Created `webapp/src/js/utils/auth-utils.ts`** - Centralized utility file with the shared `waitForAuthManager` function
2. **Updated all files** to use the centralized function:
   - `add-expense.ts` - Updated to import and use shared `waitForAuthManager`
   - `expense-detail.ts` - Updated to import and use shared `waitForAuthManager`
   - `group-detail.ts` - Updated to import and use shared `waitForAuthManager`
3. **Removed duplicate functions** - All redundant function implementations were removed from individual files
4. **Build and tests successful** - The webapp builds without errors and all tests pass (34/34)

The refactoring successfully eliminated duplicate code while maintaining all existing functionality and improving code maintainability.

## Recommendation

Extract `waitForAuthManager` into a shared utility function or a base class if applicable to reduce duplication.

## Implementation Suggestions

1.  **Create `webapp/src/js/utils/auth-utils.ts`:**

    ```typescript
    // webapp/src/js/utils/auth-utils.ts
    import { authManager } from '../auth.js';

    /**
     * Waits for the authentication manager to be initialized and the user to be authenticated.
     * Throws an error if authentication fails after multiple attempts.
     */
    export async function waitForAuthManager(): Promise<void> {
        const maxAttempts = 50;
        let attempts = 0;

        while ((!authManager || !authManager.isAuthenticated()) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication manager failed to initialize or user not authenticated');
        }
    }
    ```

2.  **Update Existing Files to Use the New Utility:**
    *   **`add-expense.ts`:** Remove the local `waitForAuthManager` function and import it from `auth-utils.ts`.
    *   **`expense-detail.ts`:** Remove the local `waitForAuthManager` function and import it from `auth-utils.ts`.
    *   **`group-detail.ts`:** Remove the local `waitForAuthManager` function and import it from `auth-utils.ts`.

3.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
