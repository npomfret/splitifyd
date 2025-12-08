
# UI Bug: Balances are nested inside collapsible containers

## Problem Description

There is a significant UI/UX issue where the user and group balance information is rendered inside multiple, nested collapsible containers. To see who owes what, a user has to click to expand multiple UI elements.

This makes critical information difficult to access and creates a confusing and frustrating user experience. Balance information should be one of the most prominent and easily accessible data points on the screen.

## Goal

Refactor the relevant UI components to elevate the balance information, removing it from the nested collapsible containers and making it a primary, at-a-glance element on the page.

## Investigation Plan

1.  **Identify Components:**
    *   Locate the primary page component for viewing a group's details (likely in `webapp-v2/src/pages/group/`).
    *   Trace the component hierarchy to find where the balances are being rendered.
    *   Identify the "collapsible container" components that are causing the nesting issue.

2.  **Analyze Layout:**
    *   Understand why the balances were placed inside collapsible containers. Was it an attempt to save space on mobile? Is it a side-effect of another component's structure?

## Proposed Solution

1.  **Component Refactoring:**
    *   Create a dedicated, non-collapsible `GroupBalances` or `BalanceSummary` component if one doesn't exist.
    *   Move the logic and rendering for balances into this new or an existing higher-level component.
    *   Remove the balance rendering from the collapsible sections.

2.  **New Layout:**
    *   Position the `BalanceSummary` component prominently on the group detail page, likely near the top, below the group title.
    -   It should clearly display a summary of debts and credits for the current user.
    -   It should provide an easy way to navigate to the full list of debts between all members.

3.  **Cleanup:**
    *   Remove any now-unused collapsible container components if they are no longer needed.
    *   Ensure the new layout is clean, responsive, and works well on both desktop and mobile views.

## Task Breakdown

- [ ] **Investigation:** Identify the specific page and components in `webapp-v2/src` causing the issue.
- [ ] **Refactoring:** Pull the balance rendering logic out of the nested containers.
- [ ] **UI Implementation:** Create and style a new layout where balances are clearly visible.
- [ ] **Testing:** Manually verify the new UI on different screen sizes and with different group data (e.g., groups with many members, groups with no debts).
- [ ] **Review:** Get feedback on the new design to ensure it meets usability goals.
