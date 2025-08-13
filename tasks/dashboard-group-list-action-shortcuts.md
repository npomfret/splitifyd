# Feature: Add Action Shortcuts to Dashboard Group List

## Overview

To streamline common user workflows, this feature adds quick-action icon buttons directly to each group listed on the main dashboard. This allows users to perform key actions like inviting members or adding expenses without first navigating to the group's detail page.

## UI/UX Changes

### "Your Groups" List on Dashboard

-   For each group card or list item in the "Your Groups" section, two new icon buttons will be added.
-   These buttons should be placed on the right side of the group card, ensuring they don't clutter the main group information (name, balance).
-   The buttons should be styled subtly, perhaps appearing more prominently on hover, to avoid a visually busy interface.

### 1. "Invite" Shortcut

-   **Icon:** A "user with a plus sign" (`user+`) icon.
-   **Functionality:** Clicking this icon will open the "Invite Others" modal directly for that specific group. This saves the user from having to click into the group first.
-   **Tooltip:** On hover, a tooltip should appear that says "Invite to [Group Name]".

### 2. "Add Expense" Shortcut

-   **Icon:** A "plus" (`+`) or "plus-circle" icon.
-   **Functionality:** Clicking this icon will navigate the user directly to the "Add Expense" page for that specific group. The group context will be pre-selected.
-   **Tooltip:** On hover, a tooltip should appear that says "Add expense to [Group Name]".

## Example Layout

```
+--------------------------------------------------------+
|                                                        |
|  [Group Icon/Avatar]  My Awesome Group                 |
|                       You owe: $25.00                    |
|                                                        |
|                                     [+] [user+] [>]    |  <-- New icons on the right
|                                                        |
+--------------------------------------------------------+
```
*(Where `[>]` is the existing navigation arrow/link)*

## Implementation Details

-   **Component to Modify:** The changes will be made to the component that renders the list of groups on the dashboard (e.g., `GroupList.tsx` or a `GroupCard.tsx` component within `DashboardPage.tsx`).
-   **Data:** The component already has the `groupId` for each group, which is all that's needed to trigger the correct modal or navigate to the correct "Add Expense" page.
-   **State Management:**
    -   The "Invite" icon will need to trigger a global modal state, passing the `groupId` to it.
    -   The "Add Expense" icon will use the router to navigate to a URL like `/groups/{groupId}/add-expense`.

## Benefits

-   **Increased Efficiency:** Reduces the number of clicks required for the two most common actions (adding expenses and inviting members).
-   **Improved Workflow:** Allows users to perform key actions directly from the dashboard overview.
-   **Enhanced User Experience:** Makes the dashboard more interactive and functional, rather than just a list of links.
