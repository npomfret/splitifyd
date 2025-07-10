# Webapp Issue: Redundant Logic - Authentication and Logout

## Issue Description

`auth.ts` provides a centralized `AuthManager`, but `logout-handler.ts` and `reset-password.ts` bypass this manager by directly interacting with `localStorage` and `window.firebaseAuth`.

## Recommendation

All authentication and logout operations should be routed through the `AuthManager` in `auth.ts` to ensure a single source of truth and consistent behavior.

## Implementation Suggestions

1.  **Modify `webapp/src/js/logout-handler.ts`:**
    Remove direct `localStorage` and `window.firebaseAuth` calls. Instead, import and use `authManager.logout()`.

    ```typescript
    // webapp/src/js/logout-handler.ts
    import { authManager } from './auth.js'; // Add this import
    import { logger } from './utils/logger.js';

    window.addEventListener('DOMContentLoaded', () => {
        const logoutButton = document.getElementById('logoutButton') as HTMLButtonElement | null;
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    authManager.logout(); // Use the centralized logout method
                } catch (error) {
                    logger.error('Logout failed:', error);
                }
            });
        }
    });
    ```

2.  **Modify `webapp/src/js/reset-password.ts`:**
    Remove direct `window.firebaseAuth.sendPasswordResetEmail` calls. Instead, import and use a method from `authManager` (or a new `AuthService` if `authManager` is not intended for direct use in pages).

    ```typescript
    // webapp/src/js/reset-password.ts
    import { logger } from './utils/logger.js';
    import { authManager } from './auth.js'; // Add this import

    // ... (rest of the file)

    const handleResetPassword = async (e: Event): Promise<void> => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const email = emailInput.value.trim();

        try {
            // Use authManager's method for password reset
            await authManager.sendPasswordResetEmail(email); // Assuming authManager has this method
            showSuccess('Reset link sent!');
            emailInput.value = '';
        } catch (error: any) {
            logger.error('Password reset error:', error);

            // ... (error handling)
        }
    };
    ```

3.  **Update `auth.ts` (if necessary):**
    Ensure `AuthManager` in `auth.ts` exposes methods for password reset and logout that can be used by other modules.

    ```typescript
    // webapp/src/js/auth.ts
    // ... (existing code)

    class AuthManager {
        // ... (existing properties and methods)

        async sendPasswordResetEmail(email: string): Promise<void> {
            if (!window.firebaseAuth) {
                throw new Error('Firebase not initialized');
            }
            await window.firebaseAuth.sendPasswordResetEmail(email);
        }

        logout(): void {
            this.clearToken();
            if (window.firebaseAuth && window.firebaseAuth.signOut) {
                window.firebaseAuth.signOut(); // Ensure Firebase signOut is called
            }
            window.location.href = 'index.html';
        }

        // ... (rest of the class)
    }
    ```

4.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
