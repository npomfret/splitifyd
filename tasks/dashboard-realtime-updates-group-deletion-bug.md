# Dashboard Real-time Updates Bug - Group Deletion

## Summary
Dashboard does not reliably update in real-time when groups are deleted, requiring manual page refresh to show correct state.

## Bug Details

**Severity:** Medium  
**Component:** Frontend Real-time Updates  
**Affected Area:** Dashboard group list display  

## Description
When a group is deleted successfully on the backend, the dashboard does not automatically remove the deleted group from the UI. The group deletion API call succeeds (confirmed by integration tests), but the real-time subscription system fails to notify the dashboard to update.

## Reproduction Steps
1. Navigate to a group detail page
2. Click "Edit Group" → "Delete Group" → Confirm deletion
3. Redirected to dashboard successfully
4. **BUG:** Deleted group still appears in the "Your Groups" list
5. Manually refresh the page (F5 or browser refresh)
6. **EXPECTED:** Group is no longer visible (correct state from server)

## Expected Behavior
After successful group deletion, the dashboard should immediately remove the deleted group from the UI without requiring a manual refresh.

## Current Workaround
A temporary hack has been added to the e2e test in `group-management-errors.e2e.test.ts`:

```typescript
// WORKAROUND: There's a race condition where real-time updates don't propagate
// The group is deleted on backend but dashboard doesn't update in real-time
// Refresh the page to get the correct state from the server
await page.reload();
```

**This workaround needs to be removed once the real-time update issue is fixed.**

## Technical Analysis

### What Works ✅
- Backend group deletion API (confirmed by passing integration tests)
- Group deletion with soft-deleted expenses handling
- Member subcollection cleanup during deletion
- Page refresh shows correct state

### What's Broken ❌
- Real-time updates for group deletion events
- Dashboard UI synchronization after group deletion
- Frontend subscription system not receiving/processing deletion events

## Root Cause Hypothesis
The issue appears to be in the frontend's real-time subscription system (likely Firebase Firestore real-time listeners or similar). The subscription may not be:
1. Properly listening for group deletion events
2. Correctly updating the dashboard state when deletion events occur
3. Handling the specific case of group deletions vs other group changes

## Impact
- **User Experience:** Poor - users think deletion failed when it actually succeeded
- **Data Integrity:** Good - backend data is correct
- **Test Reliability:** Fixed with workaround, but test should not need refresh

## Investigation Areas
1. **Frontend real-time subscription setup** - Check if dashboard is properly subscribed to group changes
2. **Group deletion event propagation** - Verify deletion events are being emitted and received
3. **State management** - Ensure frontend state is updated when deletion events are processed
4. **Race conditions** - Check if deletion happens faster than subscription can process

## Files Affected
- `e2e-tests/src/__tests__/integration/error-testing/group-management-errors.e2e.test.ts` (contains temporary workaround)
- Dashboard component (likely needs real-time update fix)
- Group real-time subscription logic

## Definition of Done
- [ ] Remove the `page.reload()` workaround from the e2e test
- [ ] Group deletion immediately updates dashboard UI without refresh
- [ ] E2e test `"should successfully delete empty group"` passes without refresh
- [ ] Manual testing confirms real-time deletion updates work consistently

## Priority
Medium - affects user experience but has functional workaround. Should be addressed to improve UX and remove test hack.