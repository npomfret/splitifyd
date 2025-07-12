# Webapp Runtime Configuration Re-architecture Plan

## Problem Statement

The current configuration management system for the Splitifyd project, particularly for local development with Firebase Emulators, exhibits several points of brittleness and complexity:

1.  **Distributed Configuration:** Configuration values are scattered across multiple `.env` files, `firebase.json` (template and generated), and TypeScript files (`firebase/functions/src/config.ts`, `webapp/src/js/utils/env-loader.ts`).
2.  **Complex Emulator Port Management:** Switching between different emulator instances (and their respective ports) requires manual copying of `.env.instanceX` files and running a separate script (`generate-firebase-config.js`) to update `firebase.json`. This is prone to errors and makes it difficult to run multiple emulator instances side-by-side without port clashes.
3.  **Inconsistent Client-Side Configuration:** The Firebase client configuration (API Key, Auth Domain, etc.) is duplicated in `.env.instanceX` files and then read by the backend functions. The webapp then relies on a `firebaseConfigManager` to get this config, which is not directly tied to the active emulator instance's ports.
4.  **Dual Webapp Configuration Approach:** The webapp uses both build-time injected environment variables (implied by `declare const` in `env-loader.ts`) and runtime fetching via `firebaseConfigManager`, leading to potential confusion and inconsistencies.
5.  **CORS Configuration Challenges:** Ensuring `CORS_ALLOWED_ORIGINS` aligns with dynamically assigned hosting ports can be tricky.
6.  **Lack of Centralized Source of Truth:** There is no single, authoritative source for all configuration data that can be accessed consistently by both the backend and frontend.

## Proposed Solution: Centralized Configuration via Firebase Function

The core of the proposed solution is to introduce a dedicated Firebase Function that serves as the single source of truth for all runtime configuration. The web application will fetch its configuration from this function on initialization.

### 1. Centralized Configuration Function (`getConfig` Firebase Function)

*   **Purpose:** Create a new HTTP-triggered Firebase Function (e.g., `getConfig`) that dynamically gathers and returns all necessary configuration data as a JSON object.
*   **Dynamic Environment Detection:**
    *   **Emulator Environment:** When running in the Firebase Emulator, the `getConfig` function will read emulator host/port information directly from the `process.env` variables set by the Firebase CLI (e.g., `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_FUNCTIONS_EMULATOR_HOST`, `FIREBASE_HOSTING_EMULATOR_HOST`). This ensures the webapp always gets the correct ports for the currently running emulator instance.
    *   **Production Environment:** In production, the function will return the actual Firebase project configuration (API Key, Auth Domain, etc.) and production API URLs.
*   **Configuration Data:** The JSON response from `getConfig` will include:
    *   Firebase client configuration (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId).
    *   API base URL for other backend functions.
    *   Any other global configuration parameters (e.g., `warningBanner`, `isProduction`, `isDevelopment`).
*   **Implementation Details:**
    *   Modify `firebase/functions/src/config.ts` to export a function that returns the full configuration object, which can then be used by the new `getConfig` Firebase Function.
    *   The `getConfig` function will be a simple HTTP endpoint that calls this configuration function and returns the result.

### 2. Simplified Emulator Port Management

*   **Static `firebase.json`:** The `firebase.json` file will become static and define *default* emulator ports. It will no longer be dynamically generated from a template.
*   **`start-emulators` Script Update:** The `firebase/scripts/start-emulators.js` script will be modified to accept and pass emulator port overrides directly to the `firebase emulators:start` command using `--port` flags.
    *   Example: `firebase emulators:start --port=auth=9099 --port=functions=5001 ...`
*   **`switch-instance.js` Simplification:** The `firebase/scripts/switch-instance.js` script will be simplified. Its primary role will be to:
    *   Copy the relevant `.env.instanceX` file to `firebase/functions/.env`. This `.env` file will now *only* contain the Firebase client configuration and the *desired* emulator ports for that instance.
    *   The script will then output the `firebase emulators:start` command with the appropriate `--port` flags, which the user can then execute.

### 3. Webapp Configuration Simplification

*   **Single API Call for Config:** On webapp initialization (e.g., in `webapp/src/js/app-init.ts` or `webapp/src/js/firebase-init.ts`), a single API call will be made to the new `getConfig` Firebase Function.
*   **Remove Build-Time Injection:** Eliminate `webapp/src/js/utils/env-loader.ts` and any reliance on build-time injected environment variables. All configuration will be fetched at runtime.
*   **Simplified `firebaseConfigManager`:** The `firebaseConfigManager` will be refactored to simply store and provide the configuration object fetched from the `getConfig` function. It will no longer need complex logic to derive API URLs or emulator hosts.
*   **Dynamic API URL:** The webapp's API calls will use the `API_BASE_URL` provided by the `getConfig` function.

### 4. CORS Management

*   The `CORS_ALLOWED_ORIGINS` will continue to be managed via environment variables in the Firebase Functions. The `getConfig` function will ensure that the correct origins (including the dynamically determined hosting emulator port) are included in the configuration returned to the webapp.

### 5. Consolidated Environment Variables

*   The `.env.instanceX` files will be streamlined to primarily contain the Firebase client configuration and the *desired* emulator ports for that specific instance.
*   Backend-specific environment variables (e.g., `LOG_LEVEL`, `MAX_STRING_LENGTH`) will remain in the main `firebase/functions/.env` file (or be moved to Firebase Functions environment configuration directly if appropriate for production).

## Benefits of the Proposed Approach

*   **Centralized Source of Truth:** All configuration is managed and served from a single, authoritative Firebase Function, reducing redundancy and inconsistencies.
*   **Simplified Emulator Setup:** No more dynamic `firebase.json` generation. Emulator ports are passed as direct flags to `firebase emulators:start`, making it easier to manage multiple instances and avoid port clashes.
*   **Reduced Brittleness:** Less reliance on manual file copying and more on dynamic, runtime fetching of configuration.
*   **Improved Scalability:** Easily add new configuration parameters by updating only the `getConfig` function.
*   **Better Multi-instance Support:** Each emulator instance will serve its own configuration via the `getConfig` function, ensuring the webapp always connects to the correct services.
*   **Clearer Separation of Concerns:** Frontend and backend configuration are clearly separated, with the `getConfig` function acting as the bridge.
*   **Enhanced Developer Experience:** Developers will have a simpler and more reliable way to manage and access configuration, especially in multi-emulator environments.

## Next Steps

1.  **Implement `getConfig` Firebase Function:** Create the new Firebase Function in `firebase/functions/src/` that returns the dynamic configuration.
2.  **Refactor `firebase/functions/src/config.ts`:** Adjust it to be the source for the `getConfig` function.
3.  **Update `firebase/scripts/start-emulators.js`:** Modify it to pass emulator ports as flags to `firebase emulators:start`.
4.  **Simplify `firebase/scripts/switch-instance.js`:** Update it to only copy `.env` and output the `firebase emulators:start` command.
5.  **Remove `firebase/firebase.template.json`:** This file will no longer be needed.
6.  **Update `webapp/src/js/firebase-init.ts` and `webapp/src/js/config.ts`:** Modify the webapp to fetch its configuration from the new `getConfig` Firebase Function.
7.  **Remove `webapp/src/js/utils/env-loader.ts`:** This file will become obsolete.
8.  **Update Documentation:** Reflect the new configuration management approach in the project documentation.
