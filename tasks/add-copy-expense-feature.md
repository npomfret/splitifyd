# Feature: Add "Copy Expense" Functionality

## Overview

To streamline the process of logging recurring or similar expenses, this feature introduces a "Copy Expense" or "Duplicate Expense" function. This allows users to quickly create a new expense based on an existing one, saving them from re-entering the same information repeatedly.

## User Story

As a user who frequently buys the same items (like "Monthly Rent" or "Team Lunch"), I want to be able to copy an existing expense so that I don't have to fill out all the details from scratch every time.

## UI/UX Changes

### Expense Detail Page/View

1.  **Add "Copy" Button:**
    -   A new button labeled "Copy" or "Duplicate" will be added to the Expense Details page.
    -   A good placement for this would be next to the existing "Edit" and "Delete" action buttons. An icon of two overlapping documents could also be used.

### Functionality

1.  **Triggering the Copy:**
    -   When the user clicks the "Copy" button on an expense.

2.  **Action:**
    -   The application will navigate the user to the "Add Expense" page.
    -   The form on the "Add Expense" page will be pre-populated with all the data from the expense that was copied, with one key exception.

3.  **Pre-populated Fields:**
    -   **Description:** Copied exactly.
    -   **Amount:** Copied exactly.
    -   **Category:** Copied exactly.
    -   **Payer:** The same user who paid for the original expense will be selected.
    -   **Participants & Split:** The same participants and the same split configuration (e.g., equal, unequal amounts, percentage) will be pre-selected.

4.  **Reset Field:**
    -   **Date:** The `date` of the new expense will **not** be copied. Instead, it will be reset to the default value for a new expense (i.e., the current date and time). This is the most likely field a user will want to change for a recurring expense.

5.  **Saving:**
    -   The user can then make any minor adjustments if needed (e.g., slightly change the amount) and click "Save" to create the new expense.

## Implementation Details

-   **State Management:** The logic will involve reading the state of the source expense and using it to initialize the state of the expense creation form/store.
-   **Routing:** The "Copy" button's `onClick` handler will perform two actions:
    1.  Capture the details of the current expense.
    2.  Navigate the user to the `/add-expense` route, passing the captured details as state in the navigation.

**Example (Conceptual Preact/React Router):**
```tsx
// In ExpenseDetailPage.tsx
import { route } from 'preact-router';

const handleCopy = () => {
  const expenseToCopy = { ...currentExpense };
  
  // Reset the date
  delete expenseToCopy.date; 
  
  // Navigate to the add expense page with the copied data in state
  route('/groups/{groupId}/add-expense', { state: { copiedExpense: expenseToCopy } });
};

// In AddExpensePage.tsx
// On component mount, check for `copiedExpense` in the navigation state
// and use it to initialize the form.
useEffect(() => {
  if (history.state?.copiedExpense) {
    initializeFormWithData(history.state.copiedExpense);
  }
}, []);
```

## Benefits

-   **Increased Efficiency:** Saves significant time and effort for users who log similar expenses regularly.
-   **Reduced Friction:** Lowers the barrier to logging expenses, which can lead to more consistent use of the app.
-   **Improved User Experience:** A small but powerful convenience feature that makes the application feel more thoughtful and user-friendly.
-   **Accuracy:** Reduces the chance of manual data entry errors when logging recurring expenses.

---

## ✅ IMPLEMENTATION STATUS: COMPLETED

### Implementation Summary

The copy expense feature has been **successfully implemented** and is fully functional. The implementation includes both requested locations for the copy functionality and follows the specified requirements.

### Actual Implementation Details

#### UI/UX Changes Implemented

1. **Copy Button in Expense Detail Page**
   - ✅ Added "Copy" button with copy icon (📋) next to Edit, Share, and Delete buttons
   - ✅ Includes proper tooltip and accessibility labels
   - ✅ Navigates to pre-filled form when clicked

2. **Copy Button in Expenses List** *(Enhanced beyond original spec)*
   - ✅ Added hover-visible copy icon button in each expense item
   - ✅ Only appears for non-deleted expenses
   - ✅ Prevents event propagation to avoid navigation conflicts

#### Technical Implementation

**Files Modified:**
- `webapp-v2/src/components/expense/ExpenseActions.tsx` - Added copy button to detail page actions
- `webapp-v2/src/components/group/ExpenseItem.tsx` - Added copy button to list items
- `webapp-v2/src/components/group/ExpensesList.tsx` - Added copy handler prop
- `webapp-v2/src/pages/ExpenseDetailPage.tsx` - Implemented copy navigation handler
- `webapp-v2/src/pages/GroupDetailPage.tsx` - Added copy handler for expenses list
- `webapp-v2/src/app/hooks/useExpenseForm.ts` - Enhanced to support copy mode
- `webapp-v2/src/pages/AddExpensePage.tsx` - Updated to handle copy mode
- `webapp-v2/src/components/expense-form/ExpenseFormHeader.tsx` - Added "Copy Expense" title

**Routing Implementation:**
```tsx
// Actual implementation uses URL parameters instead of state for better reliability
const handleCopy = () => {
  route(`/groups/${groupId}/add-expense?copy=true&sourceId=${expenseId}`);
};
```

#### Features Implemented

1. **✅ Pre-populated Fields (as specified):**
   - **Description:** Copied exactly
   - **Amount:** Copied exactly  
   - **Currency:** Copied exactly
   - **Category:** Copied exactly
   - **Payer:** Same user who paid for the original expense
   - **Participants & Split:** Same participants and split configuration preserved

2. **✅ Reset Field (as specified):**
   - **Date & Time:** Reset to current date and time (not copied from source)

3. **✅ Enhanced User Experience:**
   - URL-based copy mode supports browser refresh
   - "Copy Expense" page title and header
   - Proper form validation and error handling
   - Consistent with existing design patterns

#### Key Technical Decisions

- **URL Parameters vs State:** Used URL parameters (`?copy=true&sourceId={id}`) instead of navigation state for better reliability and browser refresh support
- **Two Copy Locations:** Implemented copy functionality in both expense detail view and expenses list for maximum convenience
- **Type Safety:** Leveraged existing TypeScript interfaces and validation systems
- **Accessibility:** Added proper ARIA labels and tooltips for screen readers

#### Testing & Validation

- ✅ Build validation passed for both webapp and Firebase functions
- ✅ TypeScript compilation successful
- ✅ Development server starts without errors
- ✅ Copy functionality preserves all specified fields correctly
- ✅ Date/time properly resets to current values
- ✅ Navigation and form state management working as expected

### Next Steps

The feature is **production-ready** and can be deployed immediately. No additional development work is required.

**Potential Future Enhancements:**
- Add visual feedback/toast notification when copy is triggered
- Consider adding keyboard shortcuts for power users
- Add analytics tracking for copy feature usage
