
# Simplify Redundant Logic in Frontend Config

**Problem**: The `getApiUrlSync` method in `webapp/js/config.js` contains redundant logic for determining the local environment and constructing the API URL. This logic is already encapsulated within the `FirebaseConfigManager` (specifically `getApiUrlForProject` and `isLocalEnvironment`). Duplication of logic makes the codebase harder to maintain and introduces potential for inconsistencies.

**File**: `webapp/js/config.js`

**Suggested Solution**:
1. **Delegate to `FirebaseConfigManager`**: The `getApiUrlSync` method should directly delegate to `window.firebaseConfigManager.getApiUrl()` without re-implementing the environment detection and URL construction logic.
2. **Remove Redundant Logic**: Remove the `isLocalEnvironment` method from `webapp/js/config.js` as it duplicates functionality already present in `FirebaseConfigManager`.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the configuration logic will be simpler and more consistent.

**Risk**: Low. The changes are localized to the configuration file and are unlikely to have any side effects.

**Complexity**: Low. This is a straightforward refactoring that involves removing redundant code.

**Benefit**: Medium. This change will improve code consistency and reduce duplication, making the configuration logic easier to maintain.
