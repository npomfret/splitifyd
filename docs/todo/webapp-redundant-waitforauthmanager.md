# Webapp Issue: Redundant Logic - `waitForAuthManager` Function

## Issue Description

The `waitForAuthManager` function is repeated in `add-expense.ts`, `expense-detail.ts`, and `group-detail.ts`.

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
