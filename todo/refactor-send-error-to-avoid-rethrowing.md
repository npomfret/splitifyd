# Refactor sendError to Avoid Re-throwing Errors

**Problem**: The `sendError` function in `firebase/functions/src/utils/errors.ts` is intended to send a standardized error response to the client. However, if the provided `error` is not an instance of `ApiError`, it logs the error and then re-throws it (`throw error`). This can lead to unhandled promise rejections or unexpected behavior if the error is not caught further up the call stack. The global error handler in `index.ts` should be the ultimate catcher of unhandled errors, and `sendError` should primarily focus on formatting and sending the response.

**File**: `firebase/functions/src/utils/errors.ts`

**Suggested Solution**:
1. **Handle All Errors Internally**: Modify `sendError` to handle all types of errors internally without re-throwing them. If an `Error` (not an `ApiError`) is passed, it should be treated as an internal server error, and a generic `INTERNAL_ERROR` response should be sent to the client.
2. **Log Full Error Details**: Ensure that the full details of the unexpected error (including stack trace) are logged using the structured `logger` before sending the generic response. This is crucial for debugging production issues.
3. **Return Early**: After sending the response, the function should return to prevent further execution in the current context.

**Behavior Change**: This is a behavior change. The `sendError` function will now handle all errors internally without re-throwing them, which will make the error handling more robust and prevent unhandled exceptions from propagating further than intended. This improves the stability of the backend.

**Risk**: Low. The changes are localized to the `sendError` function and involve modifying its error handling logic. As long as the generic error response is correctly formatted, the risk of side effects is minimal.

**Complexity**: Low. This is a straightforward refactoring that involves modifying the error handling logic within a single function.

**Benefit**: Medium. This change will make the error handling more robust, prevent unhandled promise rejections, and ensure that all errors are consistently logged and handled, improving the overall stability and debuggability of the backend.