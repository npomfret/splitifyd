# Default all users in expense form "Split between"

**Problem:** When creating a new expense, the "Split between" section of the expense form does not default to selecting all users. This requires the user to manually select each participant every time, which is inefficient for common use cases where all members are involved.

**Proposed Solution:** Modify the expense form initialization logic to automatically select all group members as participants in the "Split between" section when creating a new expense.

**Technical Notes:**
- The relevant logic is likely within `webapp-v2/src/app/hooks/useFormInitialization.ts`, specifically the `setDefaultsForCreateMode` function.
- This function should retrieve the list of all group members (e.g., from `enhancedGroupDetailStore.members`) and then update the form state by calling `expenseFormStore.setParticipants()` with the UIDs of all members.
- Ensure this change only applies to the "create new expense" flow and does not affect "edit expense" or "copy expense" functionality.
