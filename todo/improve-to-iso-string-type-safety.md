# Improve Type Safety and Utility of `toISOString`

## Problem
- **Location**: `firebase/functions/src/expenses/handlers.ts:24-31`
- **Description**: The `toISOString` utility function in `expenses/handlers.ts` uses the `any` type for its `value` parameter, which reduces type safety. Additionally, the check `value && typeof value.toDate === 'function'` is redundant for `Timestamp` instances, as `Timestamp` objects are known to have a `toDate()` method. This function could be more robust and type-safe.
- **Current vs Expected**: Currently, the function accepts `any` and has a redundant check. Expected behavior is to have a more precise type for the input and a cleaner implementation.

## Solution
- Refine the type of the `value` parameter to `Timestamp | Date` or a more specific union type if other known types are handled.
- Remove the redundant `typeof value.toDate === 'function'` check if the input types are guaranteed to have a `toDate()` method (e.g., `Timestamp`).
- Consider moving this utility function to a more general `utils` directory if it's used elsewhere or could be beneficial for other modules.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (improves type safety, code clarity, and maintainability)

## Implementation Notes
- Ensure all call sites of `toISOString` are compatible with the new type signature.
