# Inconsistent Error Handling and Missing Input Validation in `createUserDocument`

## Problem
- **Location**: `firebase/functions/src/users/handlers.ts`
- **Description**: The `createUserDocument` function directly accesses `req.body.displayName` without explicit validation for its type or content. While `authenticate` middleware ensures `req.user` exists, the `displayName` from the request body is not validated beyond a simple presence check. Additionally, the error handling uses hardcoded HTTP status codes and a custom error format, which is inconsistent with the `ApiError` class used in other parts of the application (e.g., `firebase/functions/src/utils/errors.ts`). This inconsistency makes error handling less predictable and harder to manage.
- **Current vs Expected**:
  - Current:
    ```typescript
    if (!displayName) {
      res.status(400).json({
        error: {
          code: 'MISSING_DISPLAY_NAME',
          message: 'Display name is required'
        }
      });
      return;
    }
    ```
  - Expected: Use the `ApiError` class for consistent error responses and implement more robust validation for `displayName` (e.g., length constraints, character set). Also, consider using a validation function similar to those in `documents/validation.ts` or `expenses/validation.ts`.

## Solution
- Replace the direct `res.status().json()` error handling with `throw new ApiError(...)` for consistency.
- Implement more robust validation for `displayName`, potentially using a dedicated validation function or a validation library.
- Ensure that `displayName` is properly typed and accessed from `req.body`.

## Impact
- **Type**: Code quality improvement, behavior change (consistent error responses).
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Improves API consistency, maintainability, and robustness by providing clearer and standardized error messages.

## Implementation Notes
- Review `firebase/functions/src/utils/errors.ts` for `ApiError` usage examples.
- Consider adding a `validateDisplayName` function in `firebase/functions/src/users/validation.ts` (if it exists, or create one).
