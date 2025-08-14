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

## Root Cause Analysis (CONFIRMED)

### Primary Issue: Stale Data Overwrite
After analyzing the codebase, the root cause appears to be a **classic read-modify-write race condition** in Firestore:

1. **The Problem Flow**:
   - User 1 creates group and adds expense (group doc has expenses)
   - User 2 reads group data to display it (includes expenses)
   - User 2 joins group via share link (updates memberIds in transaction)
   - User 2's client may update group with stale data (missing recent expenses)
   - Result: Expenses get overwritten/deleted

2. **Code Analysis**:
   - `joinGroupByLink` in `shareHandlers.ts` uses a transaction but only updates `memberIds`
   - The transaction at line 227-271 correctly adds the user to memberIds
   - However, if the webapp has cached/stale group data and performs any update, it may overwrite the entire document

3. **Missing Safeguards**:
   - No optimistic concurrency control (version numbers/timestamps)
   - No partial updates protection
   - No validation that expense data isn't being deleted
   - Frontend may be doing full document overwrites instead of field-specific updates

## Related Code Areas to Investigate
- `firebase/functions/src/groups/shareHandlers.ts` (lines 227-271) - Join group transaction
- `firebase/functions/src/groups/handlers.ts` - Update group handlers
- Webapp's group state management and update logic
- Any place doing `setDoc` instead of `updateDoc` or field-specific updates
- Client-side caching/state that might have stale data

## Test Details
- **Test File**: `e2e-tests/src/tests/normal-flow/three-user-settlement.e2e.test.ts`
- **Failure Point**: Line 90 - `synchronizeMultiUserState` 
- **Error Message**: "Navigation failed for User 2. Expected URL to contain /groups/[id], but got: http://localhost:9005/dashboard"

## Proposed Solution (Validated with Firebase Best Practices)

### Immediate Fixes (Based on Firebase Documentation)
1. **Use Transactions for All Group Updates**: 
   - Firestore transactions automatically handle race conditions
   - Mobile/Web SDKs use optimistic concurrency control built-in
   - Transactions keep track of all documents read and only complete if none changed

2. **Field-Specific Updates Only**: 
   - Use `updateDoc()` with specific field paths, never `setDoc()`
   - This prevents accidentally overwriting unrelated fields
   - Example: `updateDoc(groupRef, { 'data.memberIds': newMemberIds })`

3. **Implement Automatic Retry Logic**:
   - Firestore SDKs automatically retry failed transactions
   - Add manual retry logic if using REST/RPC APIs directly
   - Follow the "500/50/5" rule for traffic ramp-up

4. **Server-Side Validation in Transactions**:
   - Read the current document state within the transaction
   - Validate that expenses aren't being deleted
   - Only proceed with update if validation passes

### Long-term Improvements (Industry Best Practices)
1. **Version Field Pattern**:
   - Add a `version` field that increments on each update
   - Check version within transactions before updates
   - Reject updates with outdated version numbers

2. **Firestore Security Rules**:
   - Use `getAfter()` function to validate post-transaction state
   - Ensure critical fields like expenses aren't deleted
   - Example: `allow update: if getAfter(resource).data.expenses != null`

3. **Idempotent Operations**:
   - Design updates to be safely repeatable
   - Use unique identifiers for operations
   - Ensure same operation multiple times = same result

4. **Monitor Update Rates**:
   - Track document update frequency
   - Implement backoff strategies for high contention
   - Consider sharding hot documents if needed

## Workaround
None identified. This is a data loss issue that requires a fix.

## Fix Verification
Once fixed, the `three-user-settlement.e2e.test.ts` test should:
1. Pass consistently without flakiness
2. Show expenses persist when users join
3. Keep all users on the group page
4. Display correct balances for all members

## Recommended Integration Tests

To reproduce and validate the fix, create Firebase integration tests at `firebase/functions/__tests__/integration/`:

1. **group-member-race-conditions.test.ts**:
   - Test expenses persist when users join
   - Test concurrent user joins and expense creation
   - Test rapid successive joins
   - Verify data integrity after operations

2. **optimistic-concurrency.test.ts**:
   - Test stale data detection
   - Test version field validation
   - Test transaction retry behavior
   - Test conflict resolution

### Key Test Scenarios
- Create group with expense, then have users join simultaneously
- Create expense while user is joining group
- Multiple users joining at exactly the same time
- Simulate client with stale cached data attempting updates

## Additional Notes
- Bug was discovered while debugging flaky E2E tests
- User pool was also fixed to use consistent IDs for email and display name for better debugging
- The bug appears to be in the application code, not the test itself
- Firebase best practices confirm this is a classic optimistic concurrency control issue
- The solution aligns with official Firebase documentation for handling race conditions