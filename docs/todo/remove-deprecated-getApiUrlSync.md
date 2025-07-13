# Remove Deprecated `getApiUrlSync` Method

## Problem
- **Location**: `webapp/src/js/config.ts`
- **Description**: The `getApiUrlSync` method is marked as deprecated and throws an error when called. It should be removed to clean up the codebase and prevent confusion.
- **Current vs Expected**: Currently, the method exists but is not usable. It should be removed entirely.

## Solution
- **Approach**: Delete the `getApiUrlSync` method from the `Config` class in `webapp/src/js/config.ts`. Ensure that there are no remaining calls to this method in the codebase.

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (removes dead code and improves code quality)

## Implementation Notes
This is a straightforward code cleanup task. A global search for `getApiUrlSync` should be performed to ensure it's not being used anywhere.