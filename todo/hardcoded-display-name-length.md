# Hardcoded Display Name Length

## Problem
- **Location**:
    - `firebase/functions/src/auth/validation.ts:47`
    - `firebase/functions/src/users/validation.ts:8`
- **Description**: The maximum length for display names (50 characters) is hardcoded in `auth/validation.ts` and `users/validation.ts`. This value should be defined as a constant in `firebase/functions/src/constants.ts` to ensure consistency and easier modification if the requirement changes.
- **Current vs Expected**: Currently, the value `50` is directly used. Expected behavior is to use a named constant from `constants.ts`.

## Solution
- Add a new constant, e.g., `MAX_DISPLAY_NAME_LENGTH: 50`, to `firebase/functions/src/constants.ts` within the `VALIDATION_LIMITS` object.
- Replace the hardcoded `50` in `auth/validation.ts` and `users/validation.ts` with `VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH`.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (improves maintainability and consistency)

## Implementation Notes
- Ensure the new constant is clearly named and placed appropriately in `constants.ts`.
