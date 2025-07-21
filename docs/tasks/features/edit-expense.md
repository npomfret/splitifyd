# Edit Expense

**Status:** Partially Implemented

## Description
This feature will allow users to edit an existing expense, provided they have the necessary permissions (e.g., they created the expense).

## Current Implementation Status

### Already Implemented:
- Backend API endpoint for updating expenses (`PUT /expenses`)
- Basic edit flow: clicking edit button on expense detail page redirects to add-expense.html with edit=true parameter
- Form pre-population with existing expense data
- Submit button changes to "Update Expense" when editing
- API call to update expense instead of create when in edit mode

### Missing Items:
1. **Permission Checks**: Edit button is currently hidden by default - needs logic to show it when user has permission to edit
2. **Validation**: Frontend validation for edited data consistency
3. **Activity Log**: No expense history/audit trail
4. **Real-time Updates**: No WebSocket/real-time updates to other users when expense is edited

## Implementation Plan

### Step 1: Fix Edit Button Visibility (Small commit) ✅ COMPLETED
- In `expense-detail.ts`, add logic to show edit button when:
  - Current user created the expense OR
  - Current user is the group admin
- Remove the "hidden" class from the button when conditions are met

**Implementation Details:**
- Updated `setupPermissions` function to check `expense.createdBy` and `currentGroup.createdBy`
- Changed from `style.display` to `classList.remove/add('hidden')` for proper CSS handling
- Added null checks and logging for robustness
- Both edit and delete buttons now respect the same permission rules

### Step 2: Add Frontend Validation (Small commit) ✅ COMPLETED
- In `add-expense.ts`, enhance validation when in edit mode:
  - Ensure split amounts still total the expense amount
  - Validate that at least one participant is selected
  - Prevent removing the payer from participants

**Implementation Details:**
- Added validation to ensure payer is included in participants
- Prevent unchecking the payer in member selection
- Automatically add new payer to participants when payer changes
- Enhanced amount validation to ensure positive values

### Step 3: Add Expense History (Medium commit) ✅ COMPLETED
- Create new Firestore subcollection `expenses/{id}/history` ✅ COMPLETED
- Update backend `updateExpense` handler to: ✅ COMPLETED
  - Store a snapshot of the previous state before updating
  - Include timestamp and userId of who made the change
- Add UI in expense detail page to view history (collapsible section) ✅ COMPLETED

**Implementation Details (Backend - COMPLETED):**
- Modified `updateExpense` handler to create history entries in a transaction
- History entry includes: previous state, modifiedAt, modifiedBy, changeType, and list of changed fields
- Added new `getExpenseHistory` endpoint to retrieve history
- Registered the new endpoint in index.ts

**Implementation Details (Frontend - COMPLETED):**
- Added collapsible "Edit History" section to expense detail page
- Created UI components to display history entries with user, date, and changed fields
- Added toggle functionality with animated chevron icon
- Added CSS styles for history display with proper formatting
- Integrated with API to fetch and display expense history

### Step 4: Real-time Updates (Large commit - optional/future)
- Implement WebSocket connection for real-time updates
- Broadcast expense updates to all group members
- Update UI components to react to real-time expense changes

## Recommended Approach
Start with Steps 1 and 2 as they are small, focused changes that improve the existing functionality. Step 3 can be implemented later as it requires backend changes. Step 4 is a larger architectural change that should be considered for the future.
