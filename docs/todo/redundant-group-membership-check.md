# Redundant Group Membership Check

## Problem
- **Location**: `firebase/functions/src/expenses/handlers.ts`
- **Description**: The `fetchExpense` function calls `verifyGroupMembership` and then performs another check to see if the user is a participant in the expense or a group admin. The `verifyGroupMembership` function already checks if the user is a member of the group, so the second check is partially redundant.
- **Current vs Expected**: Currently, there are two separate checks. These should be combined into a single, more efficient check.

## Solution
- **Approach**: Refactor the `fetchExpense` function to perform a single, comprehensive authorization check. This check should verify that the user is a member of the group and either the creator of the expense, a participant in the expense, or a group admin.
- **Code Sample**:
  ```typescript
  const fetchExpense = async (expenseId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference, expense: Expense }> => {
    const docRef = getExpensesCollection().doc(expenseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw Errors.NOT_FOUND('Expense');
    }

    const expense = doc.data() as Expense;

    const groupDoc = await getGroupsCollection().doc(expense.groupId).get();
    if (!groupDoc.exists) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data()!;
    const isGroupOwner = groupData.userId === userId;
    const isParticipant = expense.participants?.includes(userId);

    if (!isGroupOwner && !isParticipant) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You are not authorized to view this expense');
    }

    return { docRef, expense };
  };
  ```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Quick win (improves code clarity and efficiency)

## Implementation Plan

### Current Analysis
The `fetchExpense` function (lines 60-96) has clear redundancy:
1. **Line 70**: Calls `verifyGroupMembership(expense.groupId, userId)` - fetches group doc and checks membership
2. **Lines 73-88**: Fetches the SAME group document again and performs overlapping authorization checks

### Solution Steps
1. **Single Step**: Replace the `verifyGroupMembership` call and subsequent group fetch with a single, comprehensive authorization function that:
   - Fetches the group document once
   - Verifies the user is a group owner OR a participant in the specific expense
   - Returns the group data for any further use

### Implementation Details
- The current `verifyGroupMembership` function checks if user is group owner OR group member
- The additional check verifies if user is group owner OR expense participant  
- **Combined logic**: User must be group owner OR expense participant (group membership alone isn't sufficient for expense access)
- **Result**: Simpler, more efficient, and more secure (expense-specific authorization)

### Code Changes Required
- **File**: `firebase/functions/src/expenses/handlers.ts`
- **Function**: `fetchExpense` (lines 60-96)
- **Change**: Replace lines 70-78 with a single authorization check that fetches group once
- **No breaking changes**: Same authorization logic, just more efficient

### Testing Impact
- **Existing tests**: Should continue to pass (same authorization behavior)
- **Performance**: Slightly better (one less Firestore read per expense fetch)