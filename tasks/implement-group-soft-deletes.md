# Task: Implement Group Soft-Deletes

## 1. Overview

Currently, group deletions are "hard deletes," meaning the group document and its associated subcollections are permanently removed from Firestore. This is a destructive action that can lead to data loss and makes it difficult to recover from accidental deletions.

This task proposes converting the group deletion process to a "soft-delete" mechanism. Instead of removing the group document, it will be marked as deleted, preserving the data for potential recovery or archival purposes.

## 2. The Problem with Hard Deletes

-   **Data Loss**: Accidental or malicious deletions are irreversible.
-   **Orphaned Data**: While the current implementation checks for expenses, other related data in the system could be orphaned if not handled carefully.
-   **Auditing**: It's difficult to maintain a complete audit trail for data that has been permanently removed.
-   **Complexity**: The current implementation requires a manual workaround to create a change-tracking document because Firestore triggers cannot access data from a deleted document's subcollections.

## 3. The Solution: Soft-Delete

The soft-delete pattern involves adding a timestamp field to the document to indicate when it was deleted.

### 3.1. Proposed Schema Change

I will add a new field to the `Group` document schema in `@splitifyd/shared`:

```typescript
// In packages/shared/src/shared-types.ts

export const DELETED_AT_FIELD = 'deletedAt';

export interface Group {
    // ... existing fields
    [DELETED_AT_FIELD]: Timestamp | null;
}
```

-   If `deletedAt` is `null`, the group is active.
-   If `deletedAt` contains a `Timestamp`, the group is considered deleted.

### 3.2. Implementation Plan

#### Phase 1: Update the Deletion Logic

1.  **Modify `GroupService.deleteGroup`**:
    -   Instead of running a transaction to delete the group and member documents, this method will be updated to perform a single `update` operation on the group document.
    -   It will set the `deletedAt` field to the current server timestamp.
    -   The check that prevents deleting a group with expenses will remain.
    -   The `members` subcollection will **not** be deleted. This preserves the group's membership history.

    **Example `GroupService.ts` change:**

    ```typescript
    // In firebase/functions/src/services/GroupService.ts

    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // Fetch group with write access check (remains the same)
        const { docRef } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Check for expenses (remains the same)
        const expenses = await this.firestoreReader.getExpensesForGroup(groupId, { limit: 1 });
        if (expenses.length > 0) {
            throw Errors.INVALID_INPUT('Cannot delete group with expenses. Delete all expenses first.');
        }

        // Perform the soft delete
        await docRef.update({
            [DELETED_AT_FIELD]: Timestamp.now()
        });

        // The existing change-tracker trigger on update will handle real-time notifications automatically.
        // The manual change document creation can be removed.

        logger.info('group-soft-deleted', { id: groupId });
        return { message: 'Group deleted successfully' };
    }
    ```

#### Phase 2: Update Data Access Logic

This is the most critical part of the implementation. All queries that fetch groups must be updated to exclude the soft-deleted ones.

1.  **Update `IFirestoreReader` and `FirestoreReader`**:
    -   All methods that fetch group data (`getGroup`, `getGroupsForUser`, etc.) must be modified to include a `where(DELETED_AT_FIELD, '==', null)` clause in their Firestore queries.
    -   This centralizes the soft-delete logic, ensuring that no part of the application can accidentally retrieve a deleted group.

2.  **Update Security Rules**:
    -   The `firestore.rules` (and `firestore.prod.rules`) must be updated to prevent reads, writes, and updates on soft-deleted groups.
    -   **Example Rule:**
        ```
        match /groups/{groupId} {
          // Allow read only if the group is not soft-deleted
          allow read: if request.auth != null && resource.data.deletedAt == null;

          // Allow write only if the group is not soft-deleted
          allow write: if request.auth != null && resource.data.deletedAt == null && /* existing rules */;
        }
        ```

#### Phase 3: UI and User Experience

1.  **Dashboard and Group Lists**: Because the data access layer will filter out soft-deleted groups, the UI should update correctly without needing significant changes. The group will simply disappear from lists.
2.  **Direct Access**: If a user tries to access a soft-deleted group via a direct URL, the API will now return a `404 Not Found` error (because of the `where` clause), which is the correct behavior.

### 3.3. Benefits of This Approach

-   **Reversibility**: Deletions are no longer permanent. An "undelete" feature can be easily added in the future by setting `deletedAt` back to `null`.
-   **Data Integrity**: Preserves the full history of the group and its members.
-   **Simplified Logic**: Removes the complex transaction and manual change-tracking document creation from `GroupService.deleteGroup`. The existing `onUpdate` trigger will handle real-time updates.
-   **Improved Auditing**: A complete record of all groups, including deleted ones, is maintained.

## 4. Future Considerations

-   **Data Archival**: A background function could be created to permanently delete or archive groups that have been soft-deleted for an extended period (e.g., > 90 days).
-   **Undelete Feature**: A UI could be built for group admins to view and restore soft-deleted groups.
-   **Impact on Expenses/Settlements**: We need to consider how soft-deleted groups affect related collections. For now, since deleting a group with expenses is blocked, the impact is minimal. If that rule changes, we would need to decide if expenses within a soft-deleted group should also be considered "deleted".

This task provides a clear path to a more robust and safer group deletion system.
