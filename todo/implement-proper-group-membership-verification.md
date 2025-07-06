# Implement Proper Group Membership Verification

**Problem**: The `verifyGroupMembership` function in `firebase/functions/src/expenses/handlers.ts` currently only checks if the authenticated user is the *creator* of the group document (`groupData.userId === userId`). This is a temporary and highly restrictive implementation, as indicated by the comment `// In the future, we'd check groupData.data.members array`. This means that only the group creator can add, view, or manage expenses within a group, which fundamentally breaks the collaborative nature of a bill-splitting application.

**File**: `firebase/functions/src/expenses/handlers.ts`

**Suggested Solution**:
1. **Update Group Document Structure**: Ensure the group document in Firestore (`admin.firestore().collection('documents')`) has a `members` array within its `data` field. This `members` array should contain the UIDs (User IDs) of all users who are part of that group.
2. **Modify `verifyGroupMembership`**: Update the `verifyGroupMembership` function to check if the `userId` (of the authenticated user) is present in the `groupData.data.members` array. This will correctly allow any member of the group to add or manage expenses.
3. **Consider Roles/Permissions (Future Enhancement)**: For more granular control, consider adding roles or permissions to group members (e.g., admin, editor, viewer) within the `members` array or a separate subcollection. This would allow for different levels of access within a group.
4. **Migration Strategy**: If existing group documents do not have a `members` array, a data migration strategy will be needed to populate this field for existing groups.

**Behavior Change**: This is a significant behavior change. The application will now correctly allow any member of a group (not just the creator) to add, view, and manage expenses. This aligns with the core functionality of a bill-splitting app.

**Risk**: Medium. This change requires careful modification of the group document structure and the `verifyGroupMembership` function. Incorrect implementation could lead to unauthorized access or prevent legitimate members from interacting with groups. Thorough testing of group creation, membership, and expense management is crucial.

**Complexity**: Medium. This change involves modifying the data model, updating backend logic, and potentially requiring a data migration for existing groups.

**Benefit**: High. This change will significantly improve the usability and functionality of the application by enabling true collaborative expense management within groups, which is a core feature for a bill-splitting app.