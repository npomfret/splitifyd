# Correct Split Iteration in calculateUserBalances

**Problem**: The `calculateUserBalances` function in `webapp/js/group-detail.js` is designed to aggregate user balances based on expenses. It currently iterates over `Object.entries(splits)` within the expense processing loop. However, the `splits` property of an expense object, as defined by the backend, is an array of `ExpenseSplit` objects (e.g., `[{ userId: 'abc', amount: 10.00 }]`), not a plain JavaScript object with user IDs as keys. This fundamental mismatch in data structure will lead to incorrect balance calculations and an inaccurate representation of who owes whom within a group.

**File**: `webapp/js/group-detail.js`

**Suggested Solution**:
1. **Iterate Over Array**: Change the iteration in `calculateUserBalances` to directly iterate over the `expense.splits` array using `expense.splits.forEach(...)` or a `for...of` loop.
2. **Access Properties Correctly**: Within the loop, access `split.userId` and `split.amount` directly from each `split` object (e.g., `split.userId`, `split.amount`) instead of attempting to destructure `[uid, amount]` from `Object.entries`.

**Behavior Change**: This is a behavior change. The user balances will now be calculated correctly, which will significantly improve the accuracy of the group detail page's financial overview. Users will see precise debt and credit figures.

**Risk**: Low. The changes are localized to the `calculateUserBalances` function and involve correcting a data access pattern. As long as the `splits` array structure from the backend is consistent, the risk is minimal.

**Complexity**: Low. This is a straightforward fix that involves correcting the iteration and property access logic.

**Benefit**: High. This change will fix a critical bug in the calculation of user balances, directly improving the accuracy of financial reporting within groups and enhancing user trust in the application.