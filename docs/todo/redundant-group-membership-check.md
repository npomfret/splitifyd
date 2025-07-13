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

## Implementation Notes
This change will make the authorization logic more concise and easier to understand.