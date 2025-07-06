# Inconsistent Logging in Expense Aggregation Trigger

## Problem
- **Location**:
    - `firebase/functions/src/triggers/expenseAggregation.ts:53`
    - `firebase/functions/src/triggers/expenseAggregation.ts:94`
- **Description**: The `expenseAggregation` trigger uses `console.error` for logging errors. While logging errors is important, directly using `console.error` in production Cloud Functions can lead to unstructured logs and make it harder to integrate with centralized logging and monitoring systems. The project already has a `logger.ts` module (`firebase/functions/src/logger.ts`) which should be used for consistent and structured logging.
- **Current vs Expected**: Currently, errors are logged using `console.error`. Expected behavior is to use the `logger` module for all application-level logging, including errors, to ensure consistency and better observability.

## Solution
- Import the `logger` module into `firebase/functions/src/triggers/expenseAggregation.ts`.
- Replace `console.error` calls with `logger.error`.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (improves log consistency, better integration with monitoring tools, adheres to project conventions)

## Implementation Notes
- Ensure `logger` is properly imported and used.
