# Inconsistent Error Handling

## Problem
- **Location**: Throughout the webapp codebase, particularly in `webapp/src/js/utils/error-handling.ts` and various components.
- **Description**: The project uses a mix of `try...catch` blocks for handling specific errors and a global error handler for unhandled exceptions and promise rejections. This can lead to inconsistent error handling and make it difficult to track and debug errors.
- **Current vs Expected**: Currently, error handling is fragmented. It should be standardized to use a more centralized and consistent approach.

## Current State Analysis (Completed)
Found the following issues:
1. No custom error classes for different error types
2. Mixed error display methods (showError, showMessage, alert)
3. Inconsistent error messages (technical vs user-friendly)
4. Variable error handling depth across components
5. No error boundaries for UI sections
6. Inconsistent validation patterns
7. Mixed async error patterns (try-catch vs .catch())
8. No error recovery strategies
9. Incomplete error context for debugging
10. Silent failures in non-critical operations

## Solution
- **Approach**: 
  1. **Centralized API Error Handling**: All API calls should be routed through a single `apiClient` that handles errors consistently. This client should parse the error response from the server and throw a custom `ApiError` with a clear message and status code.
  2. **Component-Level Error Handling**: Components should use `try...catch` blocks to handle specific API errors that they can recover from (e.g., displaying a validation error). Unrecoverable errors should be re-thrown and caught by a higher-level error boundary or the global error handler.
  3. **Global Error Handler**: The global error handler should be responsible for catching any unhandled exceptions and displaying a generic error message to the user. It should also log the full error for debugging purposes.

## Detailed Implementation Plan

### Phase 1: Create Error Infrastructure (Small commit)
1. **Create custom error classes** in `webapp/src/js/errors/index.ts`:
   - `ApiError` - For API-related errors with status code and response data
   - `ValidationError` - For client-side validation failures
   - `NetworkError` - For connectivity issues
   - `AuthenticationError` - For auth-specific errors

2. **Create error mapping utility** in `webapp/src/js/errors/error-mapper.ts`:
   - Map server error codes to user-friendly messages
   - Handle Firebase error codes
   - Provide fallback messages for unknown errors

### Phase 2: Standardize API Error Handling (Small commit)
1. **Update api-client.ts**:
   - Throw custom ApiError instances instead of generic Errors
   - Include request context in errors for debugging
   - Ensure all network errors are properly typed

2. **Update api.ts**:
   - Remove redundant try-catch blocks that just re-throw
   - Let ApiErrors bubble up to components
   - Keep auth error redirect logic centralized here

### Phase 3: Standardize Error Display (Small commit)
1. **Create unified error display utility** in `webapp/src/js/utils/error-display.ts`:
   - Single `displayError(error: Error)` function that:
     - Determines error type
     - Maps to user-friendly message
     - Chooses appropriate display method
     - Logs error with context
   - Deprecate direct usage of showError/showMessage for errors

2. **Update all components** to use the new displayError function:
   - Replace alert() calls with proper error display
   - Ensure consistent error presentation

### Phase 4: Add Error Recovery Strategies (Small commit)
1. **Implement retry utilities** in `webapp/src/js/utils/retry.ts`:
   - Configurable retry with exponential backoff
   - Skip retry for non-recoverable errors (4xx)

2. **Add error recovery patterns** to critical operations:
   - Group list loading with retry
   - Expense submission with retry
   - Dashboard initialization with fallback

### Phase 5: Improve Error Context (Small commit)
1. **Add request tracking**:
   - Generate request ID for each API call
   - Include in error logs for correlation
   - Add to error display in development mode

2. **Enhance error logging**:
   - Include component name and action
   - Add user ID and session info
   - Structure logs for easier parsing

### Phase 6: Add Form Validation Standardization (Small commit)
1. **Create validation utility** in `webapp/src/js/utils/validation.ts`:
   - Centralized validation rules
   - Consistent error message format
   - Integration with ValidationError class

2. **Update forms** to use standardized validation:
   - Pre-submit validation to catch errors early
   - Consistent field error display

## Implementation Order
1. Phase 1: Error Infrastructure (foundational)
2. Phase 2: API Error Handling (builds on Phase 1)
3. Phase 3: Error Display (uses Phase 1 & 2)
4. Phase 4: Recovery Strategies (optional enhancement)
5. Phase 5: Error Context (debugging improvement)
6. Phase 6: Form Validation (consistency improvement)

## Impact
- **Type**: Pure refactoring with behavior improvements
- **Risk**: Low per phase (small, incremental changes)
- **Complexity**: Moderate overall, but broken into simple phases
- **Benefit**: High value (improves robustness, maintainability, debugging, and user experience)

## Implementation Notes
- Each phase can be a separate commit
- Phases 1-3 are essential, 4-6 are enhancements
- Follow common-mistakes.md: avoid unnecessary try-catch, let errors bubble up
- The existing api-client already has good retry logic - preserve it
- Don't over-engineer - keep solutions simple and focused