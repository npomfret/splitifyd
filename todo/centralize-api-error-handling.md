# Centralize API Error Handling and Token Management

**Problem**: The `ApiService` in `webapp/js/api.js` contains repetitive error handling logic, particularly for `response.status === 401` (unauthorized). This involves clearing the authentication token from `localStorage` and redirecting the user to `index.html`. This duplication makes the code harder to maintain, prone to inconsistencies, and makes it difficult to implement global error handling strategies.

**File**: `webapp/js/api.js`

**Suggested Solution**:
1. **Create a Centralized Error Handler**: Implement a single, reusable function or method within `ApiService` (or a separate utility, e.g., `api-error-handler.js`) that handles common API error responses. This handler should take the `Response` object and potentially the original `Request` as input.
2. **Implement an Interceptor Pattern**: For a more robust and scalable solution, consider implementing an interceptor pattern for `fetch` requests. This would allow for global handling of responses (e.g., checking `response.ok`, handling `401` errors, logging) before they reach individual API calls. This can be achieved by wrapping the native `fetch` API.
3. **Delegate to AuthManager**: Delegate the token clearing and redirection logic to the `AuthManager` (e.g., `window.authManager.logout()`) to ensure consistency and proper cleanup of authentication state.
4. **Standardize Error Responses**: Ensure that the backend consistently returns standardized error response formats (e.g., `ApiError` objects) to simplify frontend error parsing.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the error handling will be more consistent, maintainable, and easier to extend.

**Risk**: Low. The changes are localized to the error handling logic and are unlikely to have any side effects on application functionality. Thorough testing of various error scenarios is recommended.

**Complexity**: Medium. This change involves refactoring the error handling logic and potentially introducing an interceptor pattern, which requires careful design.

**Benefit**: High. This change will significantly improve the maintainability and consistency of API error handling, reducing code duplication, and making it easier to implement new error-related features (e.g., user notifications, retry mechanisms).