# Group Membership Lifecycle Analysis and Recommendations

## 1. Overview

This document analyzes the current lifecycle of group membership in the application, confirms how it works, identifies critical bugs and missing features, and provides recommendations for improvement.

**CRITICAL UPDATE**: A severe security bug has been discovered that allows expenses to be created with invalid user IDs, resulting in "Unknown User" displays.

## 2. Current State of Group Membership

A thorough review of the codebase confirms the following ways a user's membership in a group can change.

### Group Creation

- **Finding:** When a group is created, only the user who creates it is added as a member.
- **Design Consideration:** There are two perspectives on this behavior:
    - **As Intended Design:** Groups are designed to start with only the creator as the sole member, with share links as the sole mechanism for adding members.
    - **As Bug:** The `sanitizeGroupData` function in `firebase/functions/src/groups/validation.ts` fails to copy the `members` array from the incoming request, preventing members from being added during creation.

### Adding New Members

- **Finding:** The only way to add a new member to a group is via a shareable link.
- **Implementation:** The `joinGroupByLink` function in `firebase/functions/src/groups/shareHandlers.ts` handles this functionality. No other methods for adding members (e.g., direct invite, admin adding a user) are currently implemented.

### Leaving or Being Removed from a Group

- **Finding:** This functionality is **not implemented**.
- **Reason:** As confirmed in the `e2e-test-gap-analysis.md` document, there are no backend APIs or frontend UI components that allow a user to leave a group or an admin to remove a member.

## 3. Summary of Issues

### CRITICAL SECURITY BUG: Invalid User IDs in Expenses

**Finding:** Expenses can be created with `paidBy` or `participants` containing user IDs that are NOT members of the group. This results in "Unknown User" being displayed in the UI.

**Root Cause:** The expense creation handler (`firebase/functions/src/expenses/handlers.ts`) does NOT validate that:

- The `paidBy` user ID exists in the group's `memberIds` array
- All user IDs in the `participants` array exist in the group's `memberIds` array

**Impact:**

- Users see "Unknown User" in expense displays when the user ID doesn't match any group member
- This occurs in multiple UI locations:
    - `ExpenseItem.tsx` line 44: Shows "Unknown" for paidBy user
    - `MembersList.tsx`: Shows "Unknown User" for unmatched members
    - `SettlementForm.tsx`: Shows "Unknown User" in settlements
    - `SplitBreakdown.tsx`: Shows "Unknown" in expense split details

**How This Can Happen:**

1. Malicious or buggy API calls could send arbitrary user IDs
2. Old code paths might allow non-member IDs to be submitted
3. Data corruption or migration issues could introduce invalid IDs

### Other Issues

1.  **Group Creation Behavior:** The `sanitizeGroupData` function doesn't copy the `members` array during group creation. This is either:
    - A bug preventing intended functionality of adding multiple members at creation time, OR
    - Intentional design where share links are the sole mechanism for adding members
2.  **Missing Core Feature:** The lack of a "leave group" or "remove member" feature is a significant gap in the application's core functionality.

## 4. Recommendations

### P0 - CRITICAL: Fix Invalid User ID Bug in Expenses

This security bug must be fixed immediately to prevent invalid data from entering the system.

**Required Changes in `firebase/functions/src/expenses/handlers.ts`:**

1. **In `createExpense` function (after line 129):**

    ```typescript
    // Validate that paidBy is a group member
    if (!memberIds.includes(expenseData.paidBy)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group');
    }

    // Validate that all participants are group members
    for (const participantId of expenseData.participants) {
        if (!memberIds.includes(participantId)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${participantId} is not a member of the group`);
        }
    }
    ```

2. **In `updateExpense` function:** Add similar validation before updating

3. **Add tests** to verify:
    - Cannot create expense with non-member as paidBy
    - Cannot create expense with non-members in participants
    - Cannot update expense to use non-member IDs

**Note:** The settlements feature already has proper validation via the `verifyUsersInGroup` function, which correctly validates that both payer and payee are group members. The expense handlers should follow the same pattern.

### P0/P1 - Address Group Creation Member Handling

Depending on the intended design:

**Option A: If members during creation is a desired feature:**
Fix the `sanitizeGroupData` function in `firebase/functions/src/groups/validation.ts`:

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

**Option B: If share links are the sole intended mechanism:**
Remove unused code paths for clarity:

1.  Remove `members` field from `CreateGroupRequest` interface
2.  Remove `members` validation from the create group schema
3.  Document that share links are the only way to add members

### P1 - High Priority: Implement Member Management Features

As outlined in the `e2e-test-gap-analysis.md`, the following features should be implemented to provide a complete group management lifecycle.

1.  **Implement "Leave Group"**: A user should be able to voluntarily leave a group. The system should check for and handle any outstanding debts before allowing the user to leave.
2.  **Implement "Remove Member"**: A group admin should have the ability to remove another member from the group.
