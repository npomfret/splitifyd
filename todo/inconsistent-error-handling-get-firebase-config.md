# Inconsistent Error Handling in `getFirebaseConfigResponse`

## Problem
- **Location**: `firebase/functions/src/utils/config.ts:26`
- **Description**: The `getFirebaseConfigResponse` function uses `sendError(res, Errors.INTERNAL_ERROR());` to handle the case where `clientConfig` is undefined. While `sendError` is a utility function, it's generally preferred to `throw new ApiError(...)` and let the global error handler catch it for consistency across the application. This makes the error handling flow more uniform and easier to debug.
- **Current vs Expected**:
  - Current:
    ```typescript
    sendError(res, Errors.INTERNAL_ERROR());
    return;
    ```
  - Expected:
    ```typescript
    throw Errors.INTERNAL_ERROR();
    ```

## Solution
- Replace the direct call to `sendError` with `throw Errors.INTERNAL_ERROR();` to align with the application's standard error handling pattern.

## Impact
- **Type**: Code quality improvement, behavior change (consistent error responses).
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Improves API consistency and maintainability.

## Implementation Notes
- Ensure that the `getFirebaseConfigResponse` function is always called within an `asyncHandler` or a `try-catch` block that can propagate the thrown `ApiError` to the global error handler.
