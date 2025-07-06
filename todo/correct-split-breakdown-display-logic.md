# Correct Split Breakdown Display Logic

**Problem**: The `displaySplitBreakdown` function in `webapp/js/expense-detail.js` is designed to show how an expense is split among participants. It currently attempts to iterate over `Object.entries(splits)`. However, based on the backend's `ExpenseSplit` interface (`firebase/functions/src/expenses/validation.ts`) and the `calculateSplits` function, the `splits` property is an array of objects (e.g., `[{ userId: 'abc', amount: 10.00, percentage?: number }]`), not a plain JavaScript object with user IDs as keys. This fundamental mismatch in data structure will cause the split breakdown to display incorrectly or not at all, leading to a broken UI for expense details.

**File**: `webapp/js/expense-detail.js`

**Suggested Solution**:
1. **Iterate Over Array**: Change the iteration in `displaySplitBreakdown` to directly iterate over the `splits` array using `splits.forEach(...)` or a `for...of` loop.
2. **Access Properties Correctly**: Within the loop, access `split.userId` and `split.amount` directly from each `split` object (e.g., `split.userId`, `split.amount`) instead of attempting to destructure `[userId, amount]` from `Object.entries`.
3. **Update `displayPayerInfo`**: Similarly, ensure `displayPayerInfo` correctly handles the `splits` array if it relies on iterating over it.

**Behavior Change**: This is a behavior change. The split breakdown will now display correctly, which will significantly improve the usability and accuracy of the expense detail page. Users will be able to see the correct distribution of expenses.

**Risk**: Low. The changes are localized to the `displaySplitBreakdown` function and involve correcting a data access pattern. As long as the `splits` array structure from the backend is consistent, the risk is minimal.

**Complexity**: Low. This is a straightforward fix that involves correcting the iteration and property access logic.

**Benefit**: High. This change will fix a critical bug in the display of expense splits, directly improving the user experience and ensuring that financial information is presented accurately.