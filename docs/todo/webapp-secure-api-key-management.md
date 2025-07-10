# Webapp Issue: Secure API Key and Secret Management

## Issue Description

The application has hardcoded API keys and other secrets in the source code (`firebase/functions/src/config.ts`), and insecure fallback values.

## Recommendation

Refactor the configuration to load all secrets from `process.env`. Enforce strict production configuration where the application fails to start if any required environment variables are missing. Use `.env` files for local development and ensure they are git-ignored. For deployed environments, leverage a secure secret management solution like Google Secret Manager, integrated with Firebase Functions.

## Implementation Suggestions

This issue is primarily a backend/Firebase Functions concern, but its impact affects the webapp's configuration. The `environment-config-report.md` (now `webapp-environment-config.md`) already addresses the client-side aspect of loading environment variables.

**Focus for Webapp:** Ensure the webapp correctly consumes the environment variables provided by the `env-loader.js` script (as per `webapp-environment-config.md`) and does not rely on hardcoded values or insecure fallbacks.

**Backend (Firebase Functions) Implementation (for context, not directly webapp code):**

1.  **Use Environment Variables in Functions:**
    *   Modify `firebase/functions/src/config.ts` to read configuration values from `process.env`.
    *   **Example:**
        ```typescript
        // firebase/functions/src/config.ts
        export const config = {
          firebase: {
            projectId: process.env.FIREBASE_PROJECT_ID || '',
            apiKey: process.env.FIREBASE_API_KEY || '',
            authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
            // ... other Firebase config
          },
          apiUrl: process.env.API_URL || '',
          // ... other secrets
        };

        // Add validation to ensure critical variables are present in production
        if (process.env.NODE_ENV === 'production') {
          if (!config.firebase.projectId) {
            throw new Error('FIREBASE_PROJECT_ID environment variable is not set.');
          }
          // ... similar checks for other critical variables
        }
        ```

2.  **`.env` files for Local Development (Functions):**
    *   Create `.env` files in `firebase/functions/` (e.g., `.env.development`, `.env.production`) and ensure they are `.gitignore`d.
    *   Use a library like `dotenv` in local development to load these variables.

3.  **Google Secret Manager (for Production Functions):**
    *   For production deployments, use Google Secret Manager to store sensitive API keys and secrets.
    *   Configure Firebase Functions to access these secrets at runtime.

**Webapp-Specific Action:**

*   **Verify Consumption:** Double-check that `webapp/src/js/firebase-config.ts` and `webapp/src/js/config.ts` are correctly reading their configuration from `window.env` (as outlined in `webapp-environment-config.md`) and are not falling back to hardcoded or insecure defaults.

**Next Steps:**
1.  Implement the backend changes for secure secret management.
2.  Verify the webapp's consumption of these securely managed configurations.
