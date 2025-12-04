# Bug Report: Group Edit Form Populates with User Display Name

## Overview
When a user attempts to edit a group's details, specifically the group's display name, the input field is incorrectly pre-populated with the *current user's display name* instead of the *group's current display name*. This leads to user confusion and requires manual correction of the field.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to a group that you own or have permission to edit.
3. Access the group's settings or edit interface (e.g., via a "Group Settings" modal or page).
4. Observe the input field intended for editing the group's display name.

## Expected Behavior
The input field for the group's display name should be pre-populated with the *current display name of the group*.

## Actual Behavior
The input field for the group's display name is pre-populated with the *current logged-in user's display name*.

## Impact
- **User Experience:** Confusing for users, as the form does not reflect the actual group data.
- **Data Integrity:** Users may inadvertently save their own display name as the group name if they do not notice the pre-population error and proceed to save changes.
- **Efficiency:** Requires an extra step for users to delete the incorrect pre-filled data and manually enter the correct group name.

## Possible Cause (Initial Thoughts)
It appears there might be an incorrect variable binding or data fetching logic within the group edit form. Instead of fetching the `group.displayName`, it seems to be retrieving `user.displayName` (or a similar user-related property) for pre-population. This could be due to:
- An incorrect prop being passed to the input component.
- A wrong state variable being used to initialize the form field.
- An issue in the data mapping layer when preparing the form data.

## Priority
Medium - Affects user experience and data accuracy, but has a simple workaround (manual correction).