# Task: Remove Hardcoded Ports from Firebase Connection Management

**Status:** To Do

## 1. Problem Statement

Currently, the configuration for connecting to the Firebase Emulator Suite services relies on hardcoded port numbers within the codebase, likely in a file such as `connection-manager.ts` or `firebase.ts`. This practice introduces several issues:

- **Inflexibility:** If a developer has another service running on one of the default Firebase ports (e.g., 8080 for Firestore), they must manually edit the source code to resolve the conflict, which is inefficient and error-prone.
- **Configuration Drift:** The port numbers in the code can easily drift out of sync with the ports defined in `firebase.json`, leading to confusion and connection errors.
- **Difficult Multi-Instance Setups:** It complicates running multiple, separate instances of the application environment on a single machine, a common need for testing or developing different features in parallel.

This is a form of technical debt that complicates the developer onboarding process and adds unnecessary friction to local development.

## 2. Proposed Solution

To address this, all hardcoded emulator ports should be externalized into environment variables. The application should read the port configuration from the environment at runtime, with sensible fallbacks to the default values if the variables are not set.

This will involve:

1.  **Using Environment Variables:** The connection logic will be updated to use `process.env` variables (e.g., `process.env.FIRESTORE_EMULATOR_PORT`) to determine which ports to connect to.
2.  **Providing Default Configuration:** An `.env.example` file will be created in the `firebase/functions` directory to document the available variables and their default values, which should align with the `firebase.json` emulator configuration.
3.  **Leveraging `dotenv`:** The `dotenv` package will be used to automatically load these variables from a `.env` file during local development.

## 3. Implementation Plan

1.  **Identify Connection Logic:** Locate the exact file(s) where the Firebase services (Auth, Firestore, Storage, etc.) are initialized and where the `connect...Emulator` methods are called.

2.  **Add `dotenv` Dependency:**
    - Add the `dotenv` package to the `devDependencies` in `firebase/functions/package.json`.
    - Run `npm install` within the `firebase/functions` directory.

3.  **Create Environment File Template:**
    - Create a new file: `firebase/functions/.env.example`.
    - Populate it with the port variables used by the Firebase Emulator Suite:
      ```
      # Firebase Emulator Ports
      # Copy this file to .env and modify as needed for your local setup.
      AUTH_EMULATOR_HOST=127.0.0.1:9099
      FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
      STORAGE_EMULATOR_HOST=127.0.0.1:9199
      # Add other emulator hosts as needed (e.g., Pub/Sub, Database)
      ```

4.  **Update Connection Code:**
    - At the entry point of the Firebase Functions (e.g., `firebase/functions/src/index.ts`), import and configure `dotenv`: `require('dotenv').config();`.
    - In the connection management file, replace the hardcoded ports with values derived from `process.env`. For example:
      - **Before:** `connectFirestoreEmulator(firestore, 'localhost', 8080);`
      - **After:**
        ```typescript
        const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080').split(':');
        connectFirestoreEmulator(firestore, host, parseInt(port, 10));
        ```
    - Ensure this pattern is applied for all emulator connections (Auth, Storage, etc.).

5.  **Update Documentation:**
    - Add a section to `docs/guides/firebase.md` explaining the new environment variable-based port configuration for local development.
    - Ensure the `.gitignore` file in the `firebase` directory includes `.env` to prevent local configurations from being committed.

## 4. Benefits

- **Flexibility:** Developers can easily resolve local port conflicts by creating a `.env` file, without changing any source code.
- **Improved Developer Experience:** Streamlines the local setup process and reduces a common source of friction.
- **Configuration as Code:** Follows the best practice of separating configuration from application code.
- **Consistency:** Provides a single source of truth for port configuration that can be easily synchronized with `firebase.json`.
