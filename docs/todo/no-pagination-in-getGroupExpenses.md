# No Pagination in `getGroupExpenses`

## Problem
- **Location**: `webapp/src/js/api.ts`
- **Description**: The `getGroupExpenses` function in the `apiService` does not support pagination. It takes a `limit` and `offset` parameter, but the backend API for listing group expenses (`listGroupExpenses` in `firebase/functions/src/expenses/handlers.ts`) uses cursor-based pagination. This means that the frontend is not able to properly paginate through large lists of expenses.
- **Current vs Expected**: Currently, the frontend sends `limit` and `offset` parameters, which are not supported by the backend. The frontend should be updated to use the cursor-based pagination provided by the backend.

## Solution
- **Approach**: 
  1. **Update `getGroupExpenses` in `api.ts`**: Modify the `getGroupExpenses` function to accept a `cursor` parameter instead of `offset`.
  2. **Update Backend Call**: The function should then call the backend with the `cursor` parameter.
  3. **Update UI Components**: The UI components that display expenses (e.g., `expense-list.ts`) should be updated to handle the cursor-based pagination. This will involve storing the `nextCursor` from the API response and using it to fetch the next page of expenses.

## Impact
- **Type**: Behavior change
- **Risk**: Medium
- **Complexity**: Moderate
- **Benefit**: High value (enables proper pagination for large groups, improving performance and user experience)

## Implementation Notes
This change will require modifications to both the frontend and the backend. It's a good opportunity to ensure that all list endpoints in the application use consistent, cursor-based pagination.