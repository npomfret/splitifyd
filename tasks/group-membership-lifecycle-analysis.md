# Group Membership Lifecycle Analysis and Recommendations

## 1. Overview

This document analyzes the current lifecycle of group membership in the application, confirms how it works, identifies critical bugs and missing features, and provides recommendations for improvement.

## 2. Current State of Group Membership

A thorough review of the codebase confirms the following ways a user's membership in a group can change.

### Group Creation

-   **Finding:** When a group is created, only the user who creates it is added as a member.
-   **Reason:** A critical bug exists in the `sanitizeGroupData` function in `firebase/functions/src/groups/validation.ts`. This function is responsible for cleaning data before it's saved, but it incorrectly fails to copy the `members` array from the incoming request. As a result, any members provided during creation are dropped, and the `memberIds` array is initialized with only the creator's ID.

### Adding New Members

-   **Finding:** The only way to add a new member to a group after it has been created is via a shareable link.
-   **Reason:** The `joinGroupByLink` function in `firebase/functions/src/groups/shareHandlers.ts` correctly adds a user's ID to the `memberIds` array. No other methods for adding members (e.g., direct invite, admin adding a user) are currently implemented.

### Leaving or Being Removed from a Group

-   **Finding:** This functionality is **not implemented**.
-   **Reason:** As confirmed in the `e2e-test-gap-analysis.md` document, there are no backend APIs or frontend UI components that allow a user to leave a group or an admin to remove a member.

## 3. Summary of Issues

1.  **Critical Bug:** The `sanitizeGroupData` bug prevents the intended functionality of adding multiple members at the time of group creation.
2.  **Missing Core Feature:** The lack of a "leave group" or "remove member" feature is a significant gap in the application's core functionality.

## 4. Recommendations

### P0 - Critical: Fix the `sanitizeGroupData` Bug

This bug should be fixed immediately as it breaks a fundamental aspect of group creation.

**File:** `firebase/functions/src/groups/validation.ts`

**Proposed Fix:**
The function must be updated to correctly copy the `members` property from the source data to the sanitized object.

```typescript
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
  const sanitized: any = {};
  
  if ('name' in data && data.name) {
    sanitized.name = sanitizeString(data.name);
  }
  
  if ('description' in data && data.description !== undefined) {
    sanitized.description = sanitizeString(data.description);
  }
  
  // Add this block to preserve the members array
  if ('members' in data && data.members) {
    sanitized.members = data.members;
  }
  
  return sanitized as T;
};
```

### P1 - High Priority: Implement Member Management Features

As outlined in the `e2e-test-gap-analysis.md`, the following features should be implemented to provide a complete group management lifecycle.

1.  **Implement "Leave Group"**: A user should be able to voluntarily leave a group. The system should check for and handle any outstanding debts before allowing the user to leave.
2.  **Implement "Remove Member"**: A group admin should have the ability to remove another member from the group.
