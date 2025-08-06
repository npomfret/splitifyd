# Fix Add Expense Page Layout

## Issue
The "add expense" page is missing the standard header and footer components that are present on every other page in the application.

## Solution
Add the standard Header and Footer components to the AddExpensePage component to maintain consistency with the rest of the application.

## Files to Modify
- `webapp-v2/src/pages/AddExpensePage.tsx` - Add Header and Footer components

## Implementation Steps
1. Import Header and Footer components
2. Wrap the existing page content with Header at the top and Footer at the bottom
3. Follow the same layout pattern used in other pages

## Acceptance Criteria
- [ ] Header component is visible at the top of the add expense page
- [ ] Footer component is visible at the bottom of the add expense page
- [ ] Layout matches other pages in the application
- [ ] Navigation and user menu functionality works correctly