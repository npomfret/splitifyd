# BUG: Expenses Disappear When New Users Join Group

## Priority: CRITICAL 🔴

## Summary
Expenses are being deleted or not properly synchronized when new users join a group, causing groups to incorrectly show as "All settled up!" and redirecting users to the dashboard instead of the group page.

## Environment
- **Test**: `three-user-settlement.e2e.test.ts`
- **Location**: Normal flow E2E tests
- **Frequency**: Intermittent (causes test flakiness)
- **First Detected**: August 14, 2025

## Steps to Reproduce
1. User 1 creates a new group
2. User 1 adds an expense (e.g., $120 "Group dinner expense")
3. User 2 joins the group via invite link
4. User 3 joins the group via invite link
5. **BUG**: The expense disappears from the group
6. Group shows "All settled up!" and "No expenses yet. Add one to get started!"
7. User 2 gets redirected to dashboard when trying to access the group

## Expected Behavior
- Expenses should persist when new users join a group
- All users should see the same expenses
- Users should remain on the group page when there are unsettled expenses
- Balances should be recalculated to include new members

## Actual Behavior
- Expenses disappear when new users join
- Group incorrectly shows as "All settled up!"
- Users get redirected to dashboard
- No expense data is visible to any user

## Evidence
### Screenshots from Failed Test Run

1. **Initial State** (User 1 after creating expense):
   - Shows 3 members: u 107e6822, u q7567gg5, u fffe405p
   - Shows $120 "Group dinner expense"
   - Shows correct balances ($40 each owed)
   - Payment history visible

2. **After Users Join** (Bug occurs):
   - Group shows "All settled up!"
   - "No expenses yet. Add one to get started!"
   - 3 members still listed
   - Balances show as "All settled up!"
   - No payment history

3. **User 2's Dashboard View**:
   - Group shows as "Settled up" with "just now" timestamp
   - 3 members count is correct
   - User gets redirected here instead of group page

## Console Logs
- No JavaScript errors reported
- API calls appear successful (200 responses)
- Navigation logs show redirect from group to dashboard

## Impact
- **Data Loss**: User-entered expenses are lost
- **User Experience**: Users cannot track shared expenses
- **Test Stability**: Causes E2E tests to fail intermittently
- **Trust**: Users may lose confidence if their data disappears

## Potential Root Causes
1. **Race Condition**: Expense data might be overwritten when multiple users join simultaneously
2. **State Synchronization**: Real-time updates might be clearing expense data incorrectly
3. **Firebase Rules**: Security rules might be incorrectly filtering or deleting expenses
4. **Client State Management**: Redux/state might be resetting when new members are added
5. **API Issue**: Backend might be incorrectly handling group membership updates

## Related Code Areas to Investigate
- Group membership update handlers
- Expense synchronization logic
- Firebase Realtime Database listeners
- Redux state management for expenses
- API endpoints for adding group members

## Test Details
- **Test File**: `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`
- **Failure Point**: Line 90 - `synchronizeMultiUserState` 
- **Error Message**: "Navigation failed for User 2. Expected URL to contain /groups/[id], but got: http://localhost:9005/dashboard"

## Workaround
None identified. This is a data loss issue that requires a fix.

## Fix Verification
Once fixed, the `three-user-settlement.e2e.test.ts` test should:
1. Pass consistently without flakiness
2. Show expenses persist when users join
3. Keep all users on the group page
4. Display correct balances for all members

## Additional Notes
- Bug was discovered while debugging flaky E2E tests
- User pool was also fixed to use consistent IDs for email and display name for better debugging
- The bug appears to be in the application code, not the test itself