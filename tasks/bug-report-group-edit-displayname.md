# Bug Report: UI/UX Issues in Group Settings: Field Label and Default Tab

## Overview
This bug report addresses two separate UI/UX issues within the Group Settings interface:
1.  **Incorrect Field Label:** The input field for setting a user's display name specific to a group has an ambiguous label.
2.  **Incorrect Default Tab:** The Group Settings modal does not default to the "General" tab upon opening.

These issues create user confusion and a suboptimal workflow.

## Steps to Reproduce
1.  Log in to the application.
2.  Navigate to a group.
3.  Open the "Group Settings" modal.
4.  **Issue 1 (Default Tab):** Observe which tab is selected by default.
5.  **Issue 2 (Field Label):** Navigate to the "General" tab and observe the label for the user's display name field.

## Expected Behavior
1.  **Default Tab:** When the "Group Settings" modal is opened, the "General" tab should be selected by default.
2.  **Field Label:** The label for the user-specific display name field on the "General" tab should read: "**Your display name in this group**".

## Actual Behavior
1.  **Default Tab:** The modal defaults to a tab other than "General".
2.  **Field Label:** The label currently reads: "**Display name in this group**". This is ambiguous and could be misinterpreted as the setting for the group's overall name, rather than the user's name within that specific group.

## Impact
-   **User Experience:** The ambiguity of the field label can cause confusion, leading users to believe they are editing the group's name instead of their own alias within it.
-   **Efficiency:** The incorrect default tab requires users to perform an extra click to get to the most common settings, which is inefficient.

## Possible Cause (Initial Thoughts)
-   **Default Tab:** The state management or routing logic for the tabs in the `GroupSettingsModal` component likely has the wrong initial state or is missing logic to default to the "General" tab.
-   **Field Label:** This is likely a hardcoded string in the component rendering the input field on the "General" tab that needs to be updated for clarity.

## Priority
Medium - These are UI/UX polish issues that cause confusion but do not break core functionality.