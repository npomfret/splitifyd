# Centralize and Extend Error Message Mapping

**Problem**: The `AppInit.handleError` function in `webapp/js/app-init.js` uses a `switch` statement to map specific Firebase error codes to user-friendly messages. While functional, this approach can become cumbersome to maintain and extend as the number of error codes grows. It also lacks flexibility for custom error messages or internationalization (i18n).

**File**: `webapp/js/app-init.js`

**Suggested Solution**:
1. **Create an Error Message Map**: Define a separate JavaScript object or `Map` (e.g., `webapp/js/utils/error-messages.js`) that maps error codes (e.g., `auth/network-request-failed`, `permission-denied`) to their corresponding user-friendly messages.
2. **Use a Lookup Function**: In `AppInit.handleError`, use a simple lookup function to retrieve the appropriate message from the map. If a code is not found in the map, a generic fallback message should be used.
3. **Support Custom Messages**: Allow for custom messages to be passed to the error handler, overriding the default mapped message for specific scenarios.
4. **Consider i18n**: For future internationalization, this map can be extended to support multiple languages, allowing messages to be dynamically loaded based on the user's locale.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the error message mapping will be more extensible and maintainable.

**Risk**: Low. The changes are localized to the error handling logic and are unlikely to have any side effects. Thorough testing of various error scenarios is recommended.

**Complexity**: Low. This is a straightforward refactoring that involves creating an error message map and using a lookup function.

**Benefit**: Medium. This change will improve the maintainability and extensibility of error message mapping, making it easier to add new error codes, customize messages, and potentially support multiple languages in the future.