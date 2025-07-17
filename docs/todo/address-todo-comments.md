# Address TODO Comments

## Issue
TODO comments exist in the codebase that should be addressed or removed.

## TODO Comments Found

### 1. Type Mismatch TODO
**Location:** `/webapp/src/js/groups.ts` (line 229)
**Comment:** "TODO: Fix lastExpense type mismatch"
**Context:** Related to expense type handling in group transformations

### 2. API Availability TODO  
**Location:** `/webapp/src/js/group-detail.ts` (line 692)
**Comment:** "TODO: Uncomment when API is available"
**Context:** Commented out code waiting for API implementation

## Analysis

### Type Mismatch Issue (groups.ts:229)
The commented code is trying to access `group.lastExpense.description` and `group.lastExpense.amount`, but according to the API types:
- `GroupDocument.data.lastExpense` is `string | null` (firebase/functions/src/types/group-types.ts:30)
- `GroupListItem.lastExpense` is `string | null` (firebase/functions/src/types/group-types.ts:43)

The issue is that the code expects `lastExpense` to be an object with `.description` and `.amount` properties, but it's actually just a string description or null.

### API Availability Issue (group-detail.ts:692)
The commented code is for invite functionality success messages. The actual invite functionality shows "Invite functionality not implemented" error message, so this is just the success UI that was left commented.

## Implementation Plan

### Step 1: Fix Type Mismatch in groups.ts
- Since `lastExpense` is just a string description, update the commented code to display it as a simple text field
- Remove the `.description` and `.amount` property access
- Use the existing `lastExpenseTime` and `lastExpense` fields appropriately

### Step 2: Handle API Availability in group-detail.ts
- Since invite functionality shows "not implemented" error, remove the commented success UI code
- The TODO comment indicates this was waiting for API implementation, but the current code path shows it's intentionally not implemented

### Step 3: Clean up
- Remove both TODO comments
- Ensure the lastExpense display works correctly if/when uncommented

## Verification
- Run build to ensure no type errors
- Test the groups page to ensure last expense display works (if uncommented)
- Test group detail invite to ensure it still shows appropriate message