# Redundant Correlation ID Generation in `logger.request`

## Problem
- **Location**: `firebase/functions/src/logger.ts:30`
- **Description**: The `logger.request` function includes logic to generate a `correlationId` if `req.headers['x-correlation-id']` is not present (`req.headers['x-correlation-id'] as string || randomUUID()`). However, the `addCorrelationId` middleware, which is applied globally (in `firebase/functions/src/utils/middleware.ts`), is responsible for ensuring that every request has a `correlationId` set in its headers. This makes the `randomUUID()` fallback in `logger.request` redundant and potentially misleading, as it implies a `correlationId` might be missing when it should always be present due to the middleware.
- **Current vs Expected**:
  - Current:
    ```typescript
    const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
    ```
  - Expected:
    ```typescript
    const correlationId = req.headers['x-correlation-id'] as string;
    // Potentially add a check or assertion that correlationId is always present
    ```

## Solution
- Remove the `|| randomUUID()` fallback from the `correlationId` assignment in `logger.request`. The `addCorrelationId` middleware guarantees its presence.
- (Optional but recommended): Add a runtime assertion or a comment to emphasize that `correlationId` is expected to be present due to the middleware chain.

## Impact
- **Type**: Code quality improvement, minor refactoring.
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Improves code clarity, removes redundant logic, and reinforces the intended middleware behavior.

## Implementation Notes
- Verify that `addCorrelationId` middleware is indeed always applied before any calls to `logger.request`.
