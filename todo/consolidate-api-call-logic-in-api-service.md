# Consolidate API Call Logic in ApiService

**Problem**: The `webapp/js/api.js` file currently contains both a `ApiService` class with individual methods for API calls (e.g., `getGroups`, `createGroup`) and a standalone `apiCall` function. This leads to significant code duplication and an inconsistent approach to making API requests. The `ApiService` methods often replicate logic already present in `apiCall` (e.g., base URL retrieval, authentication headers, common error handling).

**File**: `webapp/js/api.js`

**Suggested Solution**:
1. **Make `apiCall` a Private Method**: Move the `apiCall` function into the `ApiService` class as a private helper method (e.g., `_apiCall`). This encapsulates the core request logic within the service.
2. **Refactor `ApiService` Methods**: Update all existing `ApiService` methods (e.g., `getGroups`, `createGroup`, `getGroup`) to leverage this new `_apiCall` helper method. Each method should primarily focus on constructing the correct endpoint, HTTP method, and request body, then delegating the actual `fetch` call and common error handling to `_apiCall`.
3. **Remove Redundant Logic**: Eliminate the duplicated logic for base URL retrieval, authentication headers, and common error handling from individual `ApiService` methods, as these concerns will now be handled centrally by `_apiCall`.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the API call logic will be more consistent, maintainable, and easier to debug.

**Risk**: Low. The changes are localized to the API call logic within `api.js` and are unlikely to have any side effects. Thorough testing of all API interactions after refactoring is recommended.

**Complexity**: Medium. This change involves refactoring multiple API methods to use a common helper function, requiring careful attention to parameter passing and return values.

**Benefit**: High. This change will significantly reduce code duplication, improve consistency across all API calls, centralize error handling, and make the `ApiService` much more maintainable and easier to extend with new endpoints.