# Webapp Runtime Configuration Re-architecture Plan (v2)

## Problem Statement

The current configuration management system for the Splitifyd project, particularly for local development with Firebase Emulators, exhibits several points of brittleness and complexity:

1. **Distributed Configuration:** Configuration values are scattered across multiple `.env` files, `firebase.json` (template and generated), and TypeScript files (`firebase/functions/src/config.ts`, `webapp/src/js/utils/env-loader.ts`).
2. **Complex Emulator Port Management:** Switching between different emulator instances (and their respective ports) requires manual copying of `.env.instanceX` files and running a separate script (`generate-firebase-config.js`) to update `firebase.json`. This is prone to errors and makes it difficult to run multiple emulator instances side-by-side without port clashes.
3. **Inconsistent Client-Side Configuration:** The Firebase client configuration (API Key, Auth Domain, etc.) is duplicated in `.env.instanceX` files and then read by the backend functions. The webapp then relies on a `firebaseConfigManager` to get this config, which is not directly tied to the active emulator instance's ports.
4. **Dual Webapp Configuration Approach:** The webapp uses both build-time injected environment variables (via esbuild) and runtime fetching via `firebaseConfigManager`, leading to potential confusion and inconsistencies.
5. **CORS Configuration Challenges:** Ensuring `CORS_ALLOWED_ORIGINS` aligns with dynamically assigned hosting ports can be tricky.
6. **Lack of Centralized Source of Truth:** There is no single, authoritative source for all configuration data that can be accessed consistently by both the backend and frontend.
7. **Increased Testing Complexity:** Recent changes to `jest.setup.js` (e.g., `jest.useFakeTimers();`) introduce a global change to how tests handle timers. While intended for test reliability, such global test environment configurations can add a layer of complexity to understanding and debugging tests, potentially complicating the overall development and build process.

## Proposed Solution: Centralized Configuration via Firebase Function

The core of the proposed solution is to leverage and enhance the existing `/api/config` endpoint to serve as the single source of truth for all runtime configuration, while maintaining the necessary firebase.json generation for emulator port configuration.

### 1. Enhanced Configuration Function (`/api/config` endpoint)

* **Current State:** Already exists as a public endpoint that returns Firebase client configuration
* **Enhancement:** Expand this endpoint to include all necessary runtime configuration
* **Dynamic Environment Detection:**
  * **Emulator Environment:** The endpoint already detects emulator environment. It will continue to read emulator host/port information from Firebase-set environment variables (`FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, etc.)
  * **Production Environment:** Returns actual Firebase project configuration and production API URLs
* **Configuration Data to Include:**
  * Firebase client configuration (already included)
  * API base URL for backend functions (already included)
  * Emulator connection details when in development
  * Feature flags and environment-specific settings
  * Any other global configuration parameters
* **Security Considerations:**
  * Endpoint remains public (required for webapp initialization)
  * Continue to exclude sensitive configuration
  * Maintain existing rate limiting and CORS protection

### 2. Retain Template-Based Port Management (Corrected Approach)

* **Keep `firebase.json` Generation:** Firebase CLI requires emulator ports to be configured in `firebase.json` - command-line port flags are NOT supported
* **Keep `generate-firebase-config.js`:** This script correctly handles port configuration by replacing placeholders in the template
* **Improve `switch-instance.js`:** 
  * Continue copying `.env.instanceX` to `.env`
  * Continue regenerating `firebase.json` from template
  * Add validation to ensure ports don't conflict
  * Consider adding a status display showing active instance

### 3. Webapp Configuration Simplification

* **Remove Build-Time Injection:** 
  * Eliminate dependency on `webapp/src/js/utils/env-loader.ts`
  * Remove environment variable injection from `webapp/esbuild.config.js`
  * All configuration fetched at runtime from `/api/config`
* **Streamline `firebaseConfigManager`:**
  * Already fetches from `/api/config` endpoint
  * Remove any build-time configuration merging
  * Add better error handling and retry logic
  * Cache configuration for the session
* **Consistent API URL Resolution:**
  * Use only the runtime-fetched `API_BASE_URL`
  * Remove any hardcoded or build-time URLs

### 4. Configuration Data Flow

1. **Development Flow:**
   ```
   .env.instanceX → switch-instance.js → .env → generate-firebase-config.js → firebase.json
                                           ↓
                                    Firebase Functions
                                           ↓
                                    /api/config endpoint
                                           ↓
                                        Webapp
   ```

2. **Production Flow:**
   ```
   Firebase Environment Config → Firebase Functions → /api/config endpoint → Webapp
   ```

### 5. Missing Elements to Address

* **Configuration Validation:** Add schema validation for configuration objects
* **Error Recovery:** Implement fallback behavior if config endpoint fails
* **Caching Strategy:** Define cache duration and invalidation for config data
* **Migration Path:** Step-by-step process to migrate without breaking existing setup
* **Testing Strategy:** How to test configuration in different environments
* **Documentation:** Update setup guides and configuration reference

### 6. Implementation Risks and Mitigations

* **Risk:** Webapp fails to start if config endpoint is down
  * **Mitigation:** Implement retry logic with exponential backoff
  * **Mitigation:** Consider embedded fallback configuration for critical values

* **Risk:** Performance impact of additional API call on startup
  * **Mitigation:** Config endpoint is already called; this consolidates not adds
  * **Mitigation:** Implement proper caching headers

* **Risk:** Developers confused by configuration changes
  * **Mitigation:** Clear migration guide and documentation
  * **Mitigation:** Maintain backward compatibility during transition

## Benefits of the Revised Approach

* **Centralized Runtime Configuration:** Single source of truth for runtime config via `/api/config`
* **Maintained Flexibility:** Keep working emulator port management via templates
* **Reduced Build Complexity:** Remove build-time configuration injection
* **Better Separation of Concerns:** Clear boundary between infrastructure (ports) and application config
* **Improved Security:** No sensitive data in client-side builds
* **Easier Debugging:** All config comes from one endpoint
* **Production Parity:** Same configuration flow in dev and prod

## Implementation Plan

### Phase 1: Preparation (No Breaking Changes)
1. Audit current `/api/config` endpoint usage
2. Document all configuration parameters currently in use
3. Create configuration schema/types
4. Add comprehensive tests for config endpoint

### Phase 2: Enhance Config Endpoint
1. Expand `/api/config` to include all runtime configuration
2. Add configuration validation
3. Improve error handling and logging
4. Test with existing webapp (should be backward compatible)

### Phase 3: Remove Build-Time Configuration
1. Update webapp to use only runtime configuration
2. Remove env-loader.ts and build-time injection
3. Update firebaseConfigManager to be purely runtime
4. Test thoroughly in all environments

### Phase 4: Cleanup and Documentation
1. Remove obsolete configuration code
2. Update all documentation
3. Create migration guide for other developers
4. Update CI/CD pipelines if needed

### Phase 5: Future Enhancements (Optional)
1. Add configuration versioning
2. Implement configuration hot-reload
3. Add admin UI for configuration management
4. Consider using Firebase Remote Config for feature flags

## Success Criteria

* Webapp starts successfully using only runtime configuration
* All emulator instances work with correct ports
* No build-time environment variables in webapp bundle
* Configuration changes don't require webapp rebuild
* Clear documentation and happy developers

## Notes

* The existing `/api/config` endpoint already implements proper security measures
* Firebase emulator port configuration MUST use firebase.json (no CLI flags available)
* The template-based approach for firebase.json is the correct pattern and should be retained
* Focus on simplifying the webapp side while maintaining the working backend infrastructure