# Missing Authorization Checks

## Problem
- **Location**: `firebase/functions/src/documents/handlers.ts`, `firebase/functions/src/expenses/handlers.ts`
- **Description**: Some of the API handlers are missing proper authorization checks. For example, in `updateDocument`, the code checks if the user owns the document, but it doesn't prevent a user from updating a group document that they are only a member of, not an owner. Similarly, in `updateExpense`, the code only checks if the user is the creator of the expense, but it should also allow group admins to edit expenses.
- **Current vs Expected**: Currently, the authorization logic is incomplete. It should be updated to correctly enforce the application's access control rules.

## Solution
- **Approach**: Review and update the authorization logic in all relevant API handlers. For each handler, ensure that the code checks if the user has the necessary permissions to perform the requested action. This may involve checking for ownership, group membership, and roles (e.g., admin).
- **Code Sample (for `updateDocument`)**:
  ```typescript
  // In updateDocument handler
  const { docRef, document } = await fetchUserDocument(documentId, userId);

  // Only allow the document owner to update it
  if (document.userId !== userId) {
    throw Errors.UNAUTHORIZED();
  }

  // ... proceed with update
  ```

## Impact
- **Type**: Behavior change
- **Risk**: Medium (incorrectly implemented authorization can lead to security vulnerabilities)
- **Complexity**: Moderate
- **Benefit**: High value (improves security and prevents unauthorized access to data)

## Implementation Notes
This is a critical security issue that should be addressed with high priority. It's important to carefully review the access control requirements for each resource and ensure that the implementation correctly enforces them.