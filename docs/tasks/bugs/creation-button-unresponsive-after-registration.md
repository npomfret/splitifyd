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

## Root Cause Analysis

The issue is in `webapp/src/js/groups.ts` in the `GroupsList` class:

1. When a new user has no groups, the `renderEmpty()` method (lines 52-70) is called
2. This method creates the "Create Your First Group" button with the correct onClick handler (line 63)
3. However, there are two bugs:
   - The button is appended to the container BEFORE other elements (line 67 before 68)
   - More importantly, `renderEmpty()` doesn't call `attachEventListeners()`

The `attachEventListeners()` method (lines 250-261) is only called from the main `render()` method, but not from `renderEmpty()`.

## Implementation Plan

### Step 1: Fix the event listener attachment
- Ensure `attachEventListeners()` is called after `renderEmpty()` renders the empty state

### Step 2: Fix the DOM order
- Append the button after the other elements for proper visual hierarchy

### Step 3: Test the fix
- Verify the button works when a new user has no groups
- Verify existing functionality still works when user has groups

### Step 4: Add defensive programming
- Ensure the button is properly accessible and has correct attributes

## Files to modify
- `webapp/src/js/groups.ts` - Fix the renderEmpty method and event listener attachment

## Testing approach
- Manual test: Create new user, verify button works
- Check existing functionality: Users with groups should still work
- Browser console: Ensure no JavaScript errors
