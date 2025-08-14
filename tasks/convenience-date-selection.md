# Feature: Convenience Dates for Expense Entry

## Overview

To speed up the process of adding and editing expenses, this feature introduces a set of "convenience date" buttons below the date picker. These buttons allow users to quickly select common relative dates like "Today" or "Yesterday" with a single click, reducing the need to manually interact with the calendar widget.

## UI/UX Changes

### Expense Form (Add/Edit Expense)

1.  **New UI Element:**
    -   A new row of buttons or clickable labels will be added directly below the main date input field.

2.  **Button Labels & Functionality:**
    -   The buttons will have clear, concise labels for common relative dates. The exact list can be refined, but a good starting point is:
        -   **"Today"**: Sets the date to the current day.
        -   **"Yesterday"**: Sets the date to the previous day.
        -   **"This Morning"**: Sets the date to today and the time to a morning default (e.g., 9:00 AM). This depends on the "Expense Time of Day" feature.
        -   **"Last Night"**: Sets the date to yesterday and the time to an evening default (e.g., 8:00 PM). This also depends on the "Expense Time of Day" feature.

3.  **Interaction:**
    -   When a user clicks one of these convenience buttons, the main date picker's value is instantly updated to reflect the selected date (and time, if applicable).
    -   The calendar view, if open, should also update to show the selected date.
    -   This does not prevent the user from manually selecting a different date from the calendar if they wish.

## Implementation Details

-   **Client-Side Logic:** The logic for calculating these dates will be handled entirely on the client-side.
-   **Date/Time Library:** A library like `date-fns` or `moment.js` should be used to reliably calculate the relative dates (e.g., `sub(new Date(), { days: 1 })` for "Yesterday").
-   **Dependency:** The functionality of "This Morning" and "Last Night" is enhanced by the "Expense Time of Day" feature. If that feature is not present, these buttons could just set the date and leave the time to its default (noon).

## Benefits

-   **Increased Speed:** Reduces clicks and friction for logging recent expenses.
-   **Improved User Experience:** Provides a more intuitive and efficient workflow for the most common use cases.
-   **Simplicity:** A small UI change that offers significant usability improvement.

## Implementation Plan

### Phase 1: Date Utility Functions
1. Create `webapp-v2/src/utils/dateHelpers.ts` with functions for:
   - `getToday()`: Returns today's date at current time
   - `getYesterday()`: Returns yesterday's date at current time
   - `getThisMorning()`: Returns today at 9:00 AM
   - `getLastNight()`: Returns yesterday at 8:00 PM
   - Use native JavaScript Date API (no external libraries per project guidelines)

### Phase 2: UI Component Updates
1. **Update ExpenseFormPage** (`webapp-v2/src/pages/ExpenseFormPage.tsx`):
   - Add convenience date buttons below the date picker
   - Use existing Button component from `src/components/ui`
   - Buttons: "Today", "Yesterday", "This Morning", "Last Night"
   - Wire click handlers to update the date in expense-form-store

2. **Styling**:
   - Use Tailwind CSS classes consistent with existing UI
   - Button layout: horizontal row with small gap
   - Secondary/ghost button style to not distract from main form

### Phase 3: State Management
1. **Update expense-form-store** (`webapp-v2/src/app/stores/expense-form-store.ts`):
   - Add method `setQuickDate(date: Date)` to update the date signal
   - Ensure proper signal updates trigger UI refresh

### Phase 4: Testing
1. **E2E Tests** (`e2e-tests/src/tests/normal-flow/convenience-dates.e2e.test.ts`):
   - Test "Today" button sets current date
   - Test "Yesterday" button sets previous date
   - Test date picker reflects programmatically set date
   - Verify form submission with convenience dates
   - Follow strict E2E guidelines (1.5s timeouts, fixtures, no conditionals)

### Phase 5: Validation
1. Manual testing across different timezones
2. Verify integration with existing date picker
3. Ensure no regression in expense creation flow

## Implementation Status

- [x] Date utility functions created
- [x] ExpenseFormPage updated with convenience buttons
- [x] State management integrated
- [x] E2E tests written and passing
- [x] Manual testing completed

## Implementation Date

**Completed:** August 14, 2025

## Summary

Successfully implemented convenience date selection buttons below the date picker in the expense form. The feature includes:

- **Four convenience buttons**: Today, Yesterday, This Morning, Last Night
- **Native JavaScript Date API** for calculations (no external libraries)
- **Ghost button styling** using existing Tailwind CSS patterns
- **Integration with existing form state** through expense-form-store
- **Comprehensive E2E tests** following project guidelines
- **Time setting for morning/night buttons** (9:00 AM for morning, 8:00 PM for night)

The implementation provides a significant UX improvement by reducing the number of clicks required to enter recent expenses, which is the most common use case for the application.
