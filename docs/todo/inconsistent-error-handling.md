# Inconsistent Error Handling

## Problem
- **Location**: Throughout the webapp codebase, particularly in `webapp/src/js/utils/error-handling.ts` and various components.
- **Description**: The project uses a mix of `try...catch` blocks for handling specific errors and a global error handler for unhandled exceptions and promise rejections. This can lead to inconsistent error handling and make it difficult to track and debug errors.
- **Current vs Expected**: Currently, error handling is fragmented. It should be standardized to use a more centralized and consistent approach.

## Solution
- **Approach**: 
  1. **Centralized API Error Handling**: All API calls should be routed through a single `apiClient` that handles errors consistently. This client should parse the error response from the server and throw a custom `ApiError` with a clear message and status code.
  2. **Component-Level Error Handling**: Components should use `try...catch` blocks to handle specific API errors that they can recover from (e.g., displaying a validation error). Unrecoverable errors should be re-thrown and caught by a higher-level error boundary or the global error handler.
  3. **Global Error Handler**: The global error handler should be responsible for catching any unhandled exceptions and displaying a generic error message to the user. It should also log the full error for debugging purposes.

## Impact
- **Type**: Pure refactoring
- **Risk**: Medium
- **Complexity**: Moderate
- **Benefit**: High value (improves robustness, maintainability, and user experience)

## Implementation Notes
This change will require a significant refactoring of the error handling logic in the webapp. It's a good opportunity to define a clear error handling strategy for the entire application.