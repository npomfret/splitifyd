# Bug: Updating an expense fails with a "paidBy" error

**ID:** BUG-002
**Reported by:** User
**Date:** 2025-07-21
**Status:** ANALYZED - Ready for implementation

## Description

When attempting to edit an existing expense and save the changes, the application throws a JavaScript error and the update fails.

## Steps to Reproduce

1.  Create a new expense.
2.  Go to the expense list or dashboard.
3.  Click on the newly created expense to open the detail view.
4.  Click the "Edit" button.
5.  Make a change to the expense (e.g., change the amount or description).
6.  Click the "Update Expense" button.

## Expected Behavior

The expense should be updated successfully with the new information.

## Actual Behavior

An error occurs, and the expense is not updated. The browser console shows the following error:
`Uncaught (in promise) Error: "paidBy" is not allowed`
`at ApiClient.request (add-expense-init.js:763:17)`

## Environment

-   **Browser:** All
-   **URL:** /expense-detail.html

## Root Cause Analysis

**Issue**: The frontend code in `webapp/src/js/add-expense.ts` (handleSubmit function, lines 680-724) builds an `expenseData` object that includes the `paidBy` field for both creation and update operations. However, the backend validation schema (`firebase/functions/src/expenses/validation.ts`, lines 50-59) does not allow `paidBy` in the `updateExpenseSchema`.

**Root Cause**: 
1. Frontend extracts `paidBy` from form data (line 688)
2. Includes `paidBy` in `expenseData` object (line 701)
3. Passes same object to both `createExpense` and `updateExpense` (lines 724-726)
4. Backend rejects update requests containing `paidBy` field

**Architecture Issue**: The `paidBy` field is immutable after expense creation - it represents who originally paid and should not be changeable during updates.

## Implementation Plan

### Option 1: Conditional Field Exclusion (Recommended)
**Location**: `webapp/src/js/add-expense.ts` lines 697-710

**Changes**:
1. Build base expense data object
2. For updates: Create separate update object omitting immutable fields (`paidBy`, `groupId`, `createdBy`)
3. For creates: Use full expense data object

```typescript
// Build base expense data
const baseExpenseData = {
    description,
    amount,
    category,
    splitType: splitMethod === 'equal' ? 'equal' : (splitMethod === 'exact' ? 'exact' : 'percentage') as 'equal' | 'exact' | 'percentage',
    participants: Array.from(selectedMembers),
    splits: Object.entries(splits).map(([userId, amount]) => ({
        userId,
        amount: parseFloat(amount as any)
    })),
    date: new Date().toISOString()
};

// For updates, omit immutable fields
const updateData = isEdit ? baseExpenseData : {
    ...baseExpenseData,
    paidBy,
    groupId: currentGroupId!
};
```

### Option 2: Backend Schema Fix (Alternative)
**Location**: `firebase/functions/src/expenses/validation.ts` line 50-59

**Changes**: Add `paidBy: Joi.string().optional()` to `updateExpenseSchema`

**Recommendation**: Option 1 is preferred as `paidBy` should remain immutable for data integrity.

### Testing Requirements
1. **Update existing expense**: Verify updates work without paidBy field
2. **Create new expense**: Verify creation still includes paidBy field  
3. **Form validation**: Ensure paidBy validation still works on creation
4. **Integration test**: Update test in `firebase/functions/__tests__/integration/api.test.ts` to verify behavior

### Files to Modify
1. `webapp/src/js/add-expense.ts` - Fix handleSubmit function
2. Update existing integration tests if needed

### Acceptance Criteria
- [✅] Root cause identified and documented
- [ ] Frontend omits `paidBy` field in update requests
- [ ] Expense updates work without errors
- [ ] Expense creation still includes `paidBy` field
- [ ] All existing tests pass
- [ ] Form validation preserved