# Task: Remove Permission Restrictions for Expense Operations

## Current State

Currently, the expense management system has restrictive permissions:

**Edit Permissions** (`firebase/functions/src/expenses/handlers.ts:249-252`):
- Only the expense creator OR group owner can edit expenses
- Other group members cannot edit expenses they didn't create

**Delete Permissions** (`firebase/functions/src/expenses/handlers.ts:369-372`):  
- Only the expense creator OR group owner can delete expenses
- Other group members cannot delete expenses they didn't create

## Required Changes

The user has requested that **anyone can delete any expense** and **anyone can edit any expense** within a group.

## Implementation Plan

### Backend Changes

1. **Update `updateExpense` handler** (`firebase/functions/src/expenses/handlers.ts:248-252`):
   - Remove the permission check: `if (expense.createdBy !== userId && !isOwner)`
   - Allow any group member to edit any expense in their group
   - Keep group membership verification to ensure user is part of the group

2. **Update `deleteExpense` handler** (`firebase/functions/src/expenses/handlers.ts:369-372`):
   - Remove the permission check: `if (expense.createdBy !== userId && !isOwner)`
   - Allow any group member to delete any expense in their group  
   - Keep group membership verification to ensure user is part of the group

3. **Preserve audit trail**:
   - Soft delete functionality already tracks `deletedBy` field
   - Update history already tracks `modifiedBy` field
   - No additional changes needed for audit tracking

### Frontend Changes

**No frontend changes required** - the UI will automatically support the new permissions once backend restrictions are removed.

## Files to Modify

- `firebase/functions/src/expenses/handlers.ts` - Remove permission checks in `updateExpense` and `deleteExpense` handlers

## Security Considerations

- Group membership verification remains in place
- Users can only modify expenses within groups they belong to
- All modifications are still tracked with user attribution
- Soft delete preserves data integrity and audit trail

## Risk Assessment

**Low Risk Changes**:
- Only removes restrictive checks, doesn't add new functionality
- Group boundary security remains intact
- Audit trail preservation ensures accountability
- Changes align with collaborative expense splitting workflows

## Testing Requirements

1. Verify any group member can edit any group expense
2. Verify any group member can delete any group expense  
3. Verify non-group members cannot access group expenses
4. Verify audit trail (`createdBy`, `deletedBy`, history) still works correctly
5. Verify group owners retain all existing permissions