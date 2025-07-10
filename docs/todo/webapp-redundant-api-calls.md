# Webapp Issue: Redundant Logic - API Call Mechanism

## Issue Description

`auth.ts` contains a private `makeRequest` method and direct `fetch` calls for authentication-related API interactions, while `api.ts` provides a dedicated `apiService` and `apiCall` for general API communication.

## Recommendation

Consolidate all API calls through `api.ts`'s `apiService` to maintain consistency in error handling, authentication header management, and overall API interaction patterns.

## Implementation Suggestions

1.  **Modify `webapp/src/js/auth.ts`:**
    *   Remove the private `makeRequest` method.
    *   Replace direct `fetch` calls within `submitLogin`, `submitRegistration`, and `submitPasswordReset` with calls to `apiService` (or `apiCall` if `apiService` doesn't expose the specific authentication endpoints).

    ```typescript
    // webapp/src/js/auth.ts
    import { logger } from './utils/logger.js';
    import { config } from './config.js';
    import { firebaseConfigManager } from './firebase-config.js';
    import { apiCall } from './api.js'; // Import apiCall
    import type { 
        LoginCredentials, 
        RegistrationData, 
        ValidatorMap, 
        EventListenerInfo,
        UserCredential,
        DebouncedFunction 
    } from './types/auth.js';

    // ... (rest of the file)

    class AuthManager {
        // ... (existing properties and methods)

        // Remove this method
        // private async makeRequest(endpoint: string, data: any): Promise<Response> { ... }

        private async submitLogin(credentials: LoginCredentials, button: HTMLButtonElement): Promise<void> {
            // ... (existing code)
            try {
                // ... (existing code)

                // Replace direct Firebase Auth call with an API call if backend handles login
                // Otherwise, if Firebase Auth is client-side, ensure token is set via apiService
                const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(credentials.email, credentials.password) as UserCredential;
                const idToken = await userCredential.user.getIdToken();
                this.setToken(idToken);
                localStorage.setItem('userId', userCredential.user.uid);

                window.location.href = 'dashboard.html';

            } catch (error) {
                // ... (error handling)
            } finally {
                // ... (existing code)
            }
        }

        private async submitRegistration(userData: RegistrationData, button: HTMLButtonElement): Promise<void> {
            // ... (existing code)
            try {
                // ... (existing code)

                // Replace direct Firebase Auth call with an API call if backend handles registration
                // Otherwise, if Firebase Auth is client-side, ensure token is set via apiService
                const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(userData.email, userData.password) as UserCredential;
                await window.firebaseAuth.updateProfile(userCredential.user, {
                    displayName: userData.displayName
                });
                const idToken = await userCredential.user.getIdToken();
                this.setToken(idToken);
                localStorage.setItem('userId', userCredential.user.uid);

                logger.log('Registration successful, redirecting to dashboard');
                window.location.href = 'dashboard.html';

            } catch (error) {
                // ... (error handling)
            } finally {
                // ... (existing code)
            }
        }

        private async submitPasswordReset(email: string, button: HTMLButtonElement): Promise<void> {
            // ... (existing code)
            try {
                // ... (existing code)

                // Replace direct Firebase Auth call with an API call if backend handles password reset
                await window.firebaseAuth.sendPasswordResetEmail(email);

                this.showSuccessMessage(button.closest('form')!, 'Password reset email sent! Check your inbox.');

            } catch (error) {
                // ... (error handling)
            } finally {
                // ... (existing code)
            }
        }

        // ... (rest of the class)
    }
    ```

2.  **Update `webapp/src/js/api.ts` (if necessary):**
    If the backend exposes specific API endpoints for login, registration, or password reset, ensure `apiService` has methods to call them. For example:

    ```typescript
    // webapp/src/js/api.ts
    // ... (existing imports)
    import type { LoginCredentials, RegistrationData } from './types/auth.js'; // Import auth types

    class ApiService {
        // ... (existing methods)

        async login(credentials: LoginCredentials): Promise<{ token: string, userId: string }> {
            return apiCall<{ token: string, userId: string }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });
        }

        async register(data: RegistrationData): Promise<{ token: string, userId: string }> {
            return apiCall<{ token: string, userId: string }>('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        async sendPasswordResetEmail(email: string): Promise<{ success: boolean }> {
            return apiCall<{ success: boolean }>('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
        }
    }

    export const apiService = new ApiService();
    // ... (apiCall function)
    ```

3.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
