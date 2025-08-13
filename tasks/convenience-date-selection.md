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
