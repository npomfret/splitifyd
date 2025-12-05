# Refactor Expense Form and View to Modals

**Problem:** The expense form and expense view currently exist as standalone pages within the application. Most other similar interactive elements or detail views are implemented as modals, leading to an inconsistent user experience and potentially disrupting user flow by navigating away from the current context.

**Proposed Solution:** Refactor the expense form and expense view from standalone pages into modal components. This will align them with the existing UI/UX patterns in the application, providing a more cohesive and less disruptive user experience.

**Technical Notes:**
- Investigate the current routing and component structure for `webapp-v2/src/pages/AddExpensePage.tsx`, `webapp-v2/src/pages/EditExpensePage.tsx` (if applicable), and `webapp-v2/src/pages/ExpenseDetailsPage.tsx` (or equivalent expense view).
- Identify how data is passed to and from these pages and how state is managed.
- Determine the best approach to integrate these as modals, considering:
    - How to trigger the modals (e.g., from a group details page).
    - How to pass necessary `groupId`, `expenseId`, or other relevant data to the modal components.
    - How to handle form submission/cancellation and subsequent data refresh when implemented as modals.
    - Potential impact on deep linking or sharing specific expense views.
- Leverage existing modal components or patterns in `webapp-v2/src/components/ui/` if available.
- Ensure proper state management and cleanup when modals are opened and closed.
