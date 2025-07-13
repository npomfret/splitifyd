# Renaming the Application

This document outlines the steps required to rename the application from "splitifyd" to a new, parameterized name. The goal is to make future renames easier by centralizing the application name and related configuration.

## 1. Centralized Configuration

A new configuration file, `app-config.json`, will be created in the root of the project. This file will serve as the single source of truth for the application's name and other key configuration parameters.

```json
{
  "appName": "splitifyd",
  "appDisplayName": "Splitifyd",
  "firebaseProjectId": "splitifyd",
  "productionBaseUrl": "https://splitifyd.web.app",
  "apiBaseUrl": "https://api.splitifyd.com"
}
```

## 2. Build Process Modifications

### 2.1. Webapp

The `webapp/esbuild.config.js` will be modified to read `app-config.json` and make the values available to the application code. This will be achieved by creating a `src/js/config.js` file at build time, which will export the configuration values.

The `webapp/package.json` will have a new script to generate this config file.

### 2.2. Firebase Functions

The Firebase functions will read the `app-config.json` file at runtime. The `firebase/functions/src/config.ts` file will be modified to load the configuration from this file.

## 3. Code Modifications

The following files need to be updated to use the new configuration values:

### 3.1. Project and Package Naming

- **`package.json` (root):** The `name` field should be updated.
- **`package-lock.json`:** Will be updated automatically after running `npm install`.
- **`shared-types/package.json`:** The `name` field for the shared types package will be updated to `@<new-app-name>/shared-types`.
- **`firebase/functions/tsconfig.json` and `webapp/tsconfig.json`:** The path aliases for `@splitifyd/shared-types` will be updated to the new name.
- **`.idea/splitifyd.iml`:** This is an IDE-specific file. It should be renamed manually, and the `.idea/modules.xml` file should be updated to reflect the new name.

### 3.2. Firebase Configuration

- **`firebase/.firebaserc`:** The `default` project needs to be updated. This can be done using the Firebase CLI: `firebase use <new-project-id>`.
- **`firebase/package.json`:** The `deploy:*` and `logs` scripts need to be updated to use the new project ID.
- **`firebase/functions/.env.*`:** The `PROJECT_ID`, `CLIENT_AUTH_DOMAIN`, and `CLIENT_STORAGE_BUCKET` values need to be updated. These should ideally be sourced from the `app-config.json` file during the build process.

### 3.3. Hardcoded Strings in Code

- **`firebase/functions/__tests__/support/ApiDriver.ts`:** The hardcoded base URL should be replaced with a value from the config.
- **`firebase/functions/scripts/*.js`:** Hardcoded project IDs in these scripts should be replaced.
- **`firebase/functions/src/groups/shareHandlers.ts`:** The hardcoded URL should be replaced with a value from the config.
- **`webapp/src/js/api-client.ts`, `webapp/src/js/api.ts`, `webapp/src/js/auth.test.ts`, `webapp/src/js/constants.ts`, `webapp/src/js/store.ts`:** The local storage keys should be prefixed with the app name from the config (e.g., `splitifyd_auth_token` becomes `<appName>_auth_token`).
- **`webapp/src/js/components/page-header.ts`:** The hardcoded API URL should be replaced with a value from the config.
- **`webapp/src/js/dashboard.ts`, `webapp/src/js/login-init.js`, `webapp/src/js/register-init.js`, `webapp/src/js/dashboard-init.js`:** Hardcoded page titles and app titles should be replaced with the `appDisplayName` from the config.

### 3.4. User-Facing Content

- **`README.md`, `docs/**/*.md`:** A simple find-and-replace will be sufficient for these files.
- **`webapp/src/*.html`:** The app name in titles, headers, and body text should be replaced with the `appDisplayName` from the config. This can be done with a script during the build process that injects the values into the HTML.
- **`webapp/src/js/components/auth-card.ts`:** The default title for the auth card should be replaced with the `appDisplayName` from the config.

## 4. Execution Plan

1.  Create `app-config.json` in the root directory.
2.  Modify `webapp/esbuild.config.js` to generate `webapp/src/js/config.js`.
3.  Modify `firebase/functions/src/config.ts` to read from `app-config.json`.
4.  Perform a global search and replace for "splitifyd" and replace with the appropriate config value. This should be done carefully, file by file, to ensure the correct value is used.
5.  Update the `package.json` files and run `npm install`.
6.  Update the `tsconfig.json` files.
7.  Rename the `.idea/splitifyd.iml` file and update `.idea/modules.xml`.
8.  Update the Firebase project using the Firebase CLI.
9.  Update the `.env` files.
10. Run all tests to ensure that the application is still working as expected.
