# Duplicated Authentication Error Handling in `api.js`

## Problem
- **Location**: `webapp/js/api.js` (multiple locations: `getGroups:40`, `createGroup:139`, `createExpense:300`, `getExpense:339`, `updateExpense:366`)
- **Description**: The logic for handling `401 Unauthorized` responses (removing `splitifyd_auth_token` from `localStorage` and redirecting to `index.html`) is duplicated across multiple methods within the `ApiService` class. This leads to code redundancy and makes maintenance difficult. If the authentication handling logic needs to change, it must be updated in several places.
- **Current vs Expected**:
  - Current: Repeated `if (response.status === 401) { ... }` blocks.
  - Expected: Centralized authentication error handling, possibly within a shared utility function or by leveraging the `apiCall` function more effectively.

## Solution
- Refactor the `ApiService` methods to utilize the `apiCall` function for all API requests. The `apiCall` function already contains the centralized `401 Unauthorized` handling logic.
- Alternatively, create a dedicated private helper method within `ApiService` (e.g., `_handleAuthError`) that encapsulates the 401 logic and can be called by individual methods.

## Impact
- **Type**: Code quality improvement, refactoring.
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Reduces code duplication, improves maintainability, and ensures consistent authentication error handling across the application.

## Implementation Notes
- Ensure that all API calls within `ApiService` are routed through `apiCall`.
- Verify that the `apiCall` function correctly handles different HTTP methods and request bodies.
