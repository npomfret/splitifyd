# Default all users in expense form "Split between"

**Status:** ✅ COMPLETED

**Problem:** When creating a new expense, the "Split between" section of the expense form does not default to selecting all users. This requires the user to manually select each participant every time, which is inefficient for common use cases where all members are involved.

**Proposed Solution:** Modify the expense form initialization logic to automatically select all group members as participants in the "Split between" section when creating a new expense.

**Technical Notes:**
- The relevant logic is likely within `webapp-v2/src/app/hooks/useFormInitialization.ts`, specifically the `setDefaultsForCreateMode` function.
- This function should retrieve the list of all group members (e.g., from `enhancedGroupDetailStore.members`) and then update the form state by calling `expenseFormStore.setParticipants()` with the UIDs of all members.
- Ensure this change only applies to the "create new expense" flow and does not affect "edit expense" or "copy expense" functionality.

---

## Implementation

**File changed:** `webapp-v2/src/app/hooks/useFormInitialization.ts:136-138`

Added to `setDefaultsForCreateMode()`:
```typescript
// Default to all group members as participants
const allMemberUids = enhancedGroupDetailStore.members.map((m) => m.uid);
expenseFormStore.setParticipants(allMemberUids);
```

**Scope:**
- Only affects create mode - edit and copy modes continue to load participants from the source expense
- No backend changes required
- No test changes required - existing tests use `selectSpecificParticipants()` which toggles checkboxes to match the desired state regardless of initial selection

**Verified:**
- Build passes
- Expense form tests pass
