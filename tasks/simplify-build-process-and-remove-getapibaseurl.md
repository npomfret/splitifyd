# Task: Simplify Build Process by Removing `getApiBaseUrl` Shim

## 1. Overview

An investigation into the web application's build and local development process has revealed a significant opportunity for simplification. The current implementation includes a script (`post-build.js`) that injects a `window.getApiBaseUrl()` function into the application. This was likely necessary in a previous version of the development workflow, but our current setup has made it entirely redundant.

This document outlines the findings and a plan to remove this unnecessary complexity, making the architecture cleaner and easier to understand.

## 2. Observations & Learnings

There was a key discrepancy between the perceived local development workflow and the actual implementation defined in the root `package.json`.

-   **The Perceived Workflow**: It was believed that `npm run dev` started a Vite dev server on one port, which then made API calls directly to the Firebase Functions emulator on another port (e.g., 9003), requiring a dynamic `getApiBaseUrl` function to bridge the two.

-   **The Actual Workflow**: The root `dev` command actually runs `vite build --watch`. This is **not a dev server**. It performs a production-like build of the web app and outputs the static files to the `webapp-v2/dist` directory. Concurrently, it starts the Firebase emulator suite. The **Hosting emulator** (on port 9005) is configured to serve the static files from that `dist` directory.

This means our local development environment almost perfectly mirrors the production environment. In both scenarios, the user's browser interacts with Firebase Hosting (the emulator locally, the real service in production), which serves the web app and handles API routing.

## 3. The Core Issue: Redundancy

The `post-build.js` script, which injects `getApiBaseUrl`, is only ever triggered by a `vite build` command. By default, `vite build` sets `NODE_ENV='production'`, meaning the script's development-specific logic is never executed. The function **always** returns the static string `'/api'`.

Since both the local emulator and the production environment use Firebase Hosting's `rewrite` rules to forward any request from `/api/**` to the `api` function, this dynamic function is unnecessary. The application can simply use the static path `/api` in all environments.

## 4. Recommended Simplification Plan

To remove this legacy component and simplify the architecture, the following steps should be taken.

### Step 1: Refactor Application Code

-   Search the `webapp-v2` codebase for all instances of `window.getApiBaseUrl()` or `getApiBaseUrl()`.
-   Replace these function calls with the static string `'/api'`. For example:
    -   **Before:** `const url = window.getApiBaseUrl() + '/config';`
    -   **After:** `const url = '/api/config';`

### Step 2: Remove the Build Script

-   Delete the now-unnecessary script file: `webapp-v2/scripts/post-build.js`.

### Step 3: Update `package.json`

-   In `webapp-v2/package.json`, edit the `build` script to remove the call to the post-build script.
    -   **Before:** `"build": "npm run build:check && vite build && node scripts/post-build.js"`
    -   **After:** `"build": "npm run build:check && vite build"`

### Step 4: Update Documentation

-   Review project documentation for any references to the old development process. The following files may need updates:
    -   `docs/guides/building-and-testing.md`
    -   `docs/guides/webapp-and-style-guide.md`
    -   `README.md`
-   Ensure all documentation reflects that the local dev environment is served via the Firebase Hosting emulator and that API calls use the `/api` path directly.

## 5. Benefits of This Change

-   **Reduced Complexity**: Eliminates a confusing and unnecessary part of the build process.
-   **Improved Clarity**: The development workflow becomes much easier to understand, as it directly mirrors the production setup.
-   **Increased Maintainability**: Fewer moving parts in the build process means less to break and easier onboarding for new developers.
-   **Architectural Soundness**: Removes a legacy shim and relies on a single, consistent API routing mechanism.
