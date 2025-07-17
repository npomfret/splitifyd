# No Pagination in `getGroupExpenses`

## Problem
- **Location**: `webapp/src/js/api.ts`
- **Description**: The `getGroupExpenses` function in the `apiService` does not support pagination. It takes a `limit` and `offset` parameter, but the backend API for listing group expenses (`listGroupExpenses` in `firebase/functions/src/expenses/handlers.ts`) uses cursor-based pagination. This means that the frontend is not able to properly paginate through large lists of expenses.
- **Current vs Expected**: Currently, the frontend sends `limit` and `offset` parameters, which are not supported by the backend. The frontend should be updated to use the cursor-based pagination provided by the backend.

## Analysis
After examining the codebase, I found:
1. **Backend**: `firebase/functions/src/expenses/handlers.ts` already has a `listGroupExpenses` function that supports cursor-based pagination
2. **Frontend**: There are TWO implementations:
   - `webapp/src/js/api.ts` has `getGroupExpenses` using offset-based pagination (INCORRECT)
   - `webapp/src/js/expenses.ts` has `listGroupExpenses` using cursor-based pagination (CORRECT)
3. **Tests**: The test files show both implementations are being used in different contexts

## Solution
- **Approach**: 
  1. **Update `getGroupExpenses` in `api.ts`**: Modify the `getGroupExpenses` function to use cursor-based pagination instead of offset-based
  2. **Update function signature**: Change from `(groupId, limit, offset)` to `(groupId, limit, cursor)` 
  3. **Update API call**: Change from sending `offset` to sending `cursor` parameter
  4. **Update return type**: Include `nextCursor` in the response to enable pagination
  5. **Update all callers**: Find and update all places that call `getGroupExpenses` to use cursor-based pagination
  6. **Update tests**: Modify test cases to use cursor-based pagination

## Implementation Steps
1. **Update API function signature and implementation** in `webapp/src/js/api.ts`
2. **Update type definitions** to include cursor response data
3. **Find and update all callers** of `getGroupExpenses` throughout the codebase
4. **Update UI components** to handle cursor-based pagination state
5. **Update tests** to reflect the new pagination approach
6. **Test thoroughly** to ensure pagination works correctly

## Impact
- **Type**: Behavior change
- **Risk**: Medium (affects existing pagination logic)
- **Complexity**: Moderate (requires updating multiple components)
- **Benefit**: High value (enables proper pagination for large groups, improving performance and user experience)

## Implementation Notes
This change will require modifications to both the frontend callers and potentially UI components. The backend is already correct. It's a good opportunity to ensure that all list endpoints in the application use consistent, cursor-based pagination.