# Insufficient Error Handling in api.ts

## Problem
- **Location**: `webapp/src/js/api.ts`
- **Description**: The `apiCall` function has very basic error handling. It catches all errors and redirects to the login page if the error message includes '401'. This is not a robust way to handle API errors. Different types of errors (e.g., network errors, server errors, validation errors) should be handled differently to provide a better user experience.
- **Current vs Expected**: Currently, all errors are treated similarly. The error handling should be improved to inspect the error type and response status code to provide more specific feedback to the user.

## Solution
- **Approach**: Refactor the `apiCall` function to handle different error scenarios more gracefully. This includes checking for network errors, parsing the error response from the server, and providing more specific error messages to the user. It should also avoid redirecting on every 401 error, as some 401s might be expected (e.g., on the login page itself).
- **Code Sample**:
  ```typescript
  // In api.ts
  export async function apiCall<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      // ... (existing code) ...
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error
        showToast('Network error. Please check your connection.', 'error');
      } else if (error instanceof ApiError) {
        // Handle specific API errors
        if (error.statusCode === 401 && window.location.pathname !== '/login.html') {
          authManager.logout();
        }
        showToast(error.message, 'error');
      }
      throw error;
    }
  }
  ```

## Impact
- **Type**: Behavior change
- **Risk**: Medium
- **Complexity**: Moderate
- **Benefit**: High value (improves user experience and robustness)

## Implementation Notes
This change will require creating a custom `ApiError` class that can be thrown from the server and parsed by the client. This will allow for more structured error handling and better communication of errors to the user.