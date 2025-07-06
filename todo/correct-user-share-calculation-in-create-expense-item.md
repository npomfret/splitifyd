# Correct User Share Calculation in createExpenseItem

**Problem**: The `createExpenseItem` function in `webapp/js/group-detail.js` is responsible for rendering individual expense items in a group's expense list. It attempts to retrieve the current user's share of an expense using `expense.splits[currentUserId]`. However, the `splits` property is an array of `ExpenseSplit` objects (e.g., `[{ userId: 'abc', amount: 10.00 }]`), not a plain JavaScript object with user IDs as keys. This fundamental mismatch in data structure will result in an incorrect or missing display of the user's share for each expense, leading to a confusing and inaccurate financial overview.

**File**: `webapp/js/group-detail.js`

**Suggested Solution**:
1. **Find User's Split**: Instead of direct object access, iterate through the `expense.splits` array to find the `ExpenseSplit` object corresponding to the `currentUserId`. A `find` method can be used for this purpose (e.g., `expense.splits.find(s => s.userId === currentUserId)`).
2. **Access Amount Property**: Once the correct `ExpenseSplit` object is found, access its `amount` property to get the user's share.
3. **Handle Missing Split**: Implement a fallback (e.g., `0`) if the current user is not found in the `splits` array for a particular expense.

**Behavior Change**: This is a behavior change. The user's share will now be calculated and displayed correctly for each expense item, which will significantly improve the accuracy and clarity of the group's expense list.

**Risk**: Low. The changes are localized to the `createExpenseItem` function and involve correcting a data access pattern. As long as the `splits` array structure from the backend is consistent, the risk is minimal.

**Complexity**: Low. This is a straightforward fix that involves correcting the logic for retrieving the user's share from an array of objects.

**Benefit**: High. This change will fix a critical bug in the display of user shares, directly improving the accuracy of financial reporting within groups and enhancing user understanding of their individual contributions.