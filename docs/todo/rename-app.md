# Renaming the Application

This document outlines the steps required to rename the application from "splitifyd" to a new, parameterized name. The goal is to make future renames easier by centralizing the application name and related configuration.

## Status: IN PROGRESS
- Task selected and analyzed
- Implementation plan created
- Integrating with existing config system
- Phase 1: COMPLETED
  - Created app-config.json
  - Updated firebase deployment to copy config
  - Modified firebase/functions/src/config.ts to load app config
  - Created hardcoded-values.test.ts to track progress (43 files to update)
- Phase 2: COMPLETED
  - Modified webapp/esbuild.config.js to inject app config
  - Created webapp/scripts/replace-app-config.js for HTML replacements
  - Updated webapp build process to replace hardcoded values in HTML
  - Created scripts/validate-app-config.js for config validation
  - All builds tested successfully

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

## 2. Configuration Distribution Strategy

**PREFERRED APPROACH: Runtime Configuration via /api/config**

The existing `/api/config` endpoint will be extended to include app-level configuration (name, display name, URLs) from `app-config.json`. This approach is preferred because:
- Eliminates build-time complexity
- Allows dynamic configuration changes without rebuilds
- Consistent with existing Firebase configuration pattern
- Enables proper caching headers for performance

### 2.1. Firebase Functions

The Firebase functions already read configuration at runtime via `firebase/functions/src/config.ts`. The `getEnhancedConfigResponse()` function will be extended to include app-level metadata from `app-config.json`.

### 2.2. Webapp

The webapp already has a `FirebaseConfigManager` that fetches from `/api/config`. This will be extended to include methods for accessing app name, display name, and URLs. Page initialization scripts will use this to set document titles and other dynamic content.

**Build-time replacements should only be used for:**
- Static content that cannot be dynamically loaded (rare cases)
- Performance-critical scenarios where runtime config fetch is problematic

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

### Phase 1: Configuration Setup (Small commit)
1. Create `app-config.json` in the root directory
2. Update firebase build process to copy app-config.json during deployment
3. Modify `firebase/functions/src/config.ts` to read from `app-config.json`
4. Test that the firebase functions can read the config file in both emulator and production

### Phase 2: Runtime Configuration Updates (Small commit)  
1. Extend `AppConfiguration` interface to include app metadata (name, displayName, URLs)
2. Update `getEnhancedConfigResponse()` to include app-config.json data 
3. Add convenience methods to `FirebaseConfigManager` for app name/display name
4. Create a build-time script to validate app-config.json
5. Test the /api/config endpoint returns app configuration

### Phase 3: Code Updates - Package and Project Files (Small commit)
1. Update root `package.json` name field
2. Update `shared-types/package.json` name to use config value
3. Update tsconfig.json path aliases in both webapp and firebase
4. Run `npm install` to update package-lock.json
5. Test that imports still work correctly

### Phase 4: Code Updates - Firebase Configuration (Small commit)
1. Update `firebase/.firebaserc` with new project ID
2. Update `firebase/package.json` deploy scripts
3. Update `.env.*` files to use config values
4. Test firebase deployment scripts

### Phase 5: Code Updates - Application Code (Small commit)
1. Replace hardcoded "splitifyd" strings in TypeScript/JavaScript files with runtime config calls
2. Update local storage keys to use config values from /api/config
3. Update API URLs and auth domains (already handled by existing config system)
4. Test all functionality in emulator

### Phase 6: Code Updates - User-Facing Content (Small commit)
1. Update page initialization to set document titles from /api/config
2. Update any remaining hardcoded app references to use runtime config
3. Update markdown documentation (simple find/replace sufficient)
4. Final testing of all features

### Phase 7: IDE and Final Cleanup (Small commit)
1. Rename `.idea/splitifyd.iml` and update `.idea/modules.xml`
2. Run all tests
3. Document any manual steps needed for deployment
