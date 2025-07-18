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

## Analysis & Implementation Plan

### Current State Analysis
1. **Document Handlers** (`documents/handlers.ts`):
   - `fetchUserDocument`: Currently allows any group member to access/modify group documents
   - `updateDocument`: Already prevents modification of group membership fields but allows any member to update other fields
   - `deleteDocument`: Uses same fetchUserDocument logic, so any member can delete

2. **Expense Handlers** (`expenses/handlers.ts`):
   - `updateExpense`: Only allows the expense creator to edit (line 242-244)
   - `deleteExpense`: Only allows the expense creator to delete (line 341-343)
   - Missing: Group owner should also be able to manage all expenses

3. **Data Model Findings**:
   - Groups have an owner (stored as `userId` on the document)
   - Member interface doesn't include role field (though shareHandlers.ts checks for admin role)
   - No consistent admin/role system implemented across the codebase

### Implementation Plan

#### Phase 1: Fix Document Authorization (First Commit)
1. **Update `fetchUserDocument` in `documents/handlers.ts`**:
   - Keep existing logic for read access (owner or member can read)
   - Add a parameter to distinguish between read and write operations
   - For write operations, only allow the document owner

2. **Update handlers to use new authorization**:
   - `updateDocument`: Pass write flag to fetchUserDocument
   - `deleteDocument`: Pass write flag to fetchUserDocument

#### Phase 2: Fix Expense Authorization (Second Commit)
1. **Update expense authorization checks**:
   - Modify `updateExpense` to allow both expense creator AND group owner
   - Modify `deleteExpense` to allow both expense creator AND group owner
   - Keep the existing `fetchExpense` for read operations

2. **Add helper function for group ownership check**:
   - Create `isGroupOwner(groupId, userId)` helper
   - Use in both update and delete expense handlers

### Code Changes Summary
1. Document handlers: Add operation type parameter to fetchUserDocument
2. Expense handlers: Allow group owner to manage all expenses
3. Do NOT implement admin roles (data model doesn't support it)

### Testing Requirements
- Verify group members cannot update/delete group documents
- Verify only document owners can update/delete documents
- Verify group owners can update/delete any expense in their group
- Verify expense creators can still update/delete their own expenses
- Verify non-participants cannot access expenses