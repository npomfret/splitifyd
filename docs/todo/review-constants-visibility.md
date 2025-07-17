# Review Constants Visibility

## Issue
Some exported constants have very limited usage and could potentially be made private.

## Constants with Limited Usage

### From `/webapp/src/js/constants.ts`
- `USER_ID_KEY` - Only used internally by auth.ts
- `MAX_AUTH_ATTEMPTS` - Used in 2 places
- `AUTH_ATTEMPT_INTERVAL_MS` - Used in 2 places

## Action Required
1. Review each constant's usage
2. Make constants private (not exported) if they're only used within their defining module
3. Consider moving constants closer to their usage if they're only used in one place
4. Document why constants are exported if there's a future use case

## Benefits
- Reduces API surface area
- Makes it clearer what's intended for external use
- Prevents accidental dependencies on internal implementation details