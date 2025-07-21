# Bug: Updating an expense fails with a "paidBy" error

**ID:** BUG-002
**Reported by:** User
**Date:** 2025-07-21

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

## Possible Cause

The client-side code is likely sending the `paidBy` field in the update request payload. This field is probably immutable and should not be included when updating an expense. The API is correctly rejecting the request. The fix is likely in `add-expense-init.js` to omit this field during an update operation.
