# Feature: Expense Time of Day Selection

## Overview

This feature allows users to specify the exact time of day for an expense. This provides more granular control and accuracy for expense tracking, especially for users in different timezones or for expenses that occur at specific times.

## Key Requirements

-   **Time Input:** Users can select or input a specific time for an expense.
-   **Default Time:** If no time is specified, the expense will default to **12:00 PM (noon)** in the user's local timezone.
-   **Timezone Handling:** All times will be captured in the user's local timezone and converted to **UTC** for storage on the server. This ensures consistency across the application.
-   **Display:** The time will be displayed in the user's local timezone.

## UI/UX Changes

### Expense Form

1.  **Initial Display:**
    -   By default, the time input field will not be a visible text box.
    -   Instead, a clickable text label will be displayed next to the date, showing the currently selected time (e.g., "at 12:00 PM"). The default will be "at 12:00 PM".

2.  **Interaction:**
    -   When the user clicks on the time label (e.g., "at 12:00 PM"), the text will be replaced by a freeform text input field.
    -   The field will be pre-populated with the current time value.

3.  **Time Suggestions:**
    -   As the user starts typing in the input field, a dropdown list of suggested times will appear below it.
    -   The suggestions will be generated at 15-minute intervals (e.g., 8:00 AM, 8:15 AM, 8:30 AM, 8:45 AM).
    -   The list of suggestions will be dynamically filtered based on the user's input.
        -   **Example:** If the user types "8", the suggestions would include "8:00 AM", "8:15 AM", "8:30 AM", "8:45 AM", and also "8:00 PM", "8:15 PM", etc.
        -   **Example:** If the user types "8:3", the suggestions would filter down to "8:30 AM" and "8:30 PM".
    -   The user can click on a suggestion to select it, which will populate the input field and hide the suggestion list.

4.  **Freeform Input:**
    -   Users are not restricted to the suggestions. They can type any valid time (e.g., "8:23 AM"). The input will be parsed to a valid time.

### Expense Display

-   In expense lists and detail views, the time of the expense will be displayed alongside the date when it is not the default time of noon. For example, "Aug 13, 2025 at 3:45 PM".

## Backend & Data Model

### Data Model Changes

-   The `Expense` data structure will need to be updated to store the time. The existing `date` field, which is likely just a date, might need to be changed to a full `timestamp` (or a new field `expenseTimestamp` can be added).

    ```json
    // In firebase/functions/src/types/webapp-shared-types.ts
    // Example update to ExpenseData
    {
      // ... other expense fields
      "date": "timestamp", // This should now store the full UTC timestamp including time
    }
    ```

## API Requirements

-   The `createExpense` and `updateExpense` API endpoints (Firebase Functions) will need to be updated to accept the full timestamp.
-   The backend will be responsible for handling the UTC conversion if the client sends a local time string. However, the best practice is for the client to send the UTC timestamp directly.

## Time Parsing Logic (Client-Side)

-   A robust time-parsing utility will be needed on the client-side to handle the freeform text input. It should be able to understand various formats like:
    -   "8pm"
    -   "20:00"
    -   "8:15a"
    -   "9.30"
-   Libraries like `date-fns` or `moment.js` (if already in the project) can be used for this parsing.
