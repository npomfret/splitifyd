# Bug: "Create your first group" button unresponsive after registration

**ID:** BUG-001
**Reported by:** User
**Date:** 2025-07-21

## Description

After a new user successfully registers and is taken to the dashboard, clicking the "Create your first group" button has no effect. The button appears to be unresponsive, and no action is triggered.

## Steps to Reproduce

1.  Go to the registration page.
2.  Create a new user account.
3.  After successful registration, you are redirected to the dashboard.
4.  Click on the "Create your first group" button.

## Expected Behavior

Clicking the "Create your first group" button should navigate the user to the group creation form or open a modal for creating a new group.

## Actual Behavior

Nothing happens when the button is clicked. No network requests are made, and there are no errors in the browser console.

## Environment

-   **Browser:** All
-   **URL:** /dashboard.html

## Possible Cause

The JavaScript event listener for the button may not be attached correctly after the initial page load and redirection from the registration page.
