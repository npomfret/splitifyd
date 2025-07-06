# Overly Broad `ApiError` Catch in `index.ts`

## Problem
- **Location**: `firebase/functions/src/index.ts:170-190`
- **Description**: The main error handling middleware in `index.ts` catches `ApiError` objects. While it correctly logs and formats the response for `ApiError` instances, the `ApiError` class itself is quite generic. This can lead to a situation where specific error types (e.g., validation errors, not found errors) are all funneled through a single `ApiError` with a generic `code` and `message`, making it harder for clients to programmatically handle different error scenarios.
- **Current vs Expected**: Currently, all custom errors are wrapped in `ApiError`. Expected behavior is to have more granular error types that directly map to specific HTTP status codes and error codes, allowing for more precise error handling on the client-side without relying solely on a generic `ApiError`.

## Solution
- Review the `ApiError` class and its usage. Consider if more specific error classes (e.g., `ValidationError`, `NotFoundError`, `UnauthorizedError`) could be used instead of or in conjunction with `ApiError`.
- If `ApiError` is retained, ensure that the `code` and `details` fields are consistently and meaningfully populated to provide sufficient information for client-side error handling.
- Potentially refactor the `ApiError` to be an abstract base class, with concrete implementations for specific error types.

## Impact
- **Type**: Behavior change (error handling, API contract)
- **Risk**: Medium
- **Complexity**: Moderate
- **Benefit**: High value (improves API clarity, enables more robust client-side error handling, better debugging)

## Implementation Notes
- This might involve changes to how errors are thrown in handler functions and how they are caught and processed by the middleware.
- Ensure backward compatibility if existing clients rely on the current `ApiError` structure.
