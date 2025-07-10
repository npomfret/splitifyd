# Webapp Issue: Direct `localStorage.getItem('userId')` Access

## Issue Description

The `userId` is frequently accessed directly from `localStorage` in multiple files.

## Recommendation

Encapsulate `userId` retrieval and storage within the `AuthManager` or a dedicated `UserService` to centralize user identity management.

## Implementation Suggestions

1.  **Modify `webapp/src/js/auth.ts`:**
    Add methods to `AuthManager` for getting and setting the `userId`.

    ```typescript
    // webapp/src/js/auth.ts
    // ... (existing code)

    const USER_ID_KEY = 'userId'; // Define a constant for the key

    class AuthManager {
        // ... (existing properties and methods)

        getUserId(): string | null {
            return localStorage.getItem(USER_ID_KEY);
        }

        setUserId(userId: string): void {
            localStorage.setItem(USER_ID_KEY, userId);
        }

        clearUserId(): void {
            localStorage.removeItem(USER_ID_KEY);
        }

        // ... (rest of the class)
    }
    ```

2.  **Update Existing Files to Use the New `AuthManager` Methods:**
    *   **`add-expense.ts`:** Replace `localStorage.getItem('userId')` with `authManager.getUserId()` and `localStorage.setItem('userId', 'user1')` with `authManager.setUserId('user1')`.
    *   **`expense-detail.ts`:** Replace `localStorage.getItem('userId')` with `authManager.getUserId()` and `localStorage.setItem('userId', 'user1')` with `authManager.setUserId('user1')`.
    *   **`group-detail.ts`:** Replace `localStorage.getItem('userId')` with `authManager.getUserId()` and `localStorage.setItem('userId', 'user1')` with `authManager.setUserId('user1')`.
    *   **`auth.ts` (within `submitLogin` and `submitRegistration`):** Replace `localStorage.setItem('userId', userCredential.user.uid)` with `this.setUserId(userCredential.user.uid)`.
    *   **`logout-handler.ts`:** Replace `localStorage.removeItem('userId')` with `authManager.clearUserId()`.

3.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
