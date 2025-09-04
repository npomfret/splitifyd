# Task: Implement Comprehensive Hard Deletes for Groups

## 1. Overview

This document outlines the strategy for implementing a "hard delete" for groups. This operation will be permanent and irreversible. When a user deletes a group, the group document itself and **all** of its associated data—including expenses, settlements, members, and other sub-collections—will be transactionally deleted from Firestore.

This approach ensures that no orphaned data is left behind and that the deletion is complete and final.

## 2. The Requirement: Atomic and Complete Deletion

The core requirements for this task are:

1.  **Completeness**: The deletion must cascade to all related data across all collections.
2.  **Atomicity**: The operation should be atomic. While a single transaction for a large group is not feasible, the process must be robust enough to be safely retried if it fails.
3.  **Real-Time UI Updates**: The user interface must react instantly to the deletion.
    -   The deleted group must automatically disappear from the dashboard.
    -   A user currently viewing the page of a group that gets deleted must be immediately redirected to a 404 or "Not Found" page.

## 3. The Solution: A Comprehensive Hard-Delete Strategy

### 3.1. Data Discovery

A hard delete requires us to identify and remove all data tied to a `groupId`. This includes:

-   The primary group document (`/groups/{groupId}`).
-   The members sub-collection (`/groups/{groupId}/members/...`).
-   All associated expenses (`/expenses` where `groupId == {groupId}`).
-   All associated settlements (`/settlements` where `groupId == {groupId}`).
-   All associated comments (e.g., on expenses or the group itself).
-   All change-tracking documents (`/group-changes` where `groupId == {groupId}`).
-   Any other related data, such as share links.

### 3.2. Backend Implementation (`GroupService.deleteGroup`)

Given that a group could have thousands of associated documents, a single Firestore transaction (which is limited to 500 operations) is not a viable solution. A more robust, high-throughput approach is required.

1.  **Use a Bulk Writer**: The implementation will use Firestore's `bulkWriter()` utility. This is the recommended tool for performing a large number of write/delete operations, as it handles batching, retries, and error handling automatically.

2.  **Update `GroupService.deleteGroup` Logic**:
    -   **Permission Check**: First, verify the user has the authority to perform this destructive action (e.g., is a group owner or admin).
    -   **Gather Documents**: Before deleting, the function will query all relevant collections to gather the `DocumentReference` for every piece of data associated with the `groupId`.
    -   **Manually Create Change Document**: Crucially, just as the current implementation does, the service will fetch the list of group members *before* starting the deletion. After the deletion is complete, it will use this list to manually create a `GroupChangeDocument` with a `type: 'deleted'`. This is the key to enabling real-time UI updates.
    -   **Execute Bulk Delete**: The service will initialize a `BulkWriter` and queue a `delete()` operation for every identified document.
    -   **Finalize**: After the bulk operation is complete, the primary group document will be deleted.

    **Example `GroupService.ts` change:**

    ```typescript
    // In firebase/functions/src/services/GroupService.ts

    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // 1. Permission checks remain the same.
        await this.fetchGroupWithAccess(groupId, userId, true);

        // 2. Get member list BEFORE deletion for the change document.
        const memberDocs = await this.firestoreReader.getMembersFromSubcollection(groupId);
        const memberIds = memberDocs.map(doc => doc.userId);

        // 3. Gather all associated documents for deletion.
        const expenses = await firestoreDb.collection('expenses').where('groupId', '==', groupId).get();
        const settlements = await firestoreDb.collection('settlements').where('groupId', '==', groupId).get();
        // ... (gather other related data)

        // 4. Use a BulkWriter for robust deletion.
        const bulkWriter = firestoreDb.bulkWriter();
        expenses.docs.forEach(doc => bulkWriter.delete(doc.ref));
        settlements.docs.forEach(doc => bulkWriter.delete(doc.ref));
        memberDocs.forEach(doc => bulkWriter.delete(doc.ref)); // Assuming memberDocs are full snapshots
        // ... (queue other deletes)

        // Add the main group document to the bulk operation.
        bulkWriter.delete(this.getGroupsCollection().doc(groupId));

        // Finalize the bulk operation.
        await bulkWriter.close();

        // 5. Manually create the change document to notify clients.
        const changeDoc = createMinimalChangeDocument(groupId, 'group', 'deleted', memberIds);
        await firestoreDb.collection(FirestoreCollections.GROUP_CHANGES).add(changeDoc);

        logger.info('group-hard-deleted', { id: groupId });
        return { message: 'Group and all associated data deleted successfully' };
    }
    ```

### 3.3. Real-Time UI Updates

The manual creation of the `GroupChangeDocument` is what makes the required real-time UI updates possible.

1.  **Dashboard View**: The frontend's real-time store (`groups-store-enhanced.ts`) will receive the `type: 'deleted'` event. It will then remove the group from its state. The dashboard, being reactive to this store, will automatically remove the group's card from the display.

2.  **Group Detail View (404 Redirect)**: A user on the page of a group that is being deleted will be subscribed to real-time updates for that specific group. When the document is deleted, the Firestore listener will fire with a "document does not exist" event. The frontend store (`group-detail-store-enhanced.ts`) must be designed to handle this state by clearing the current group data and setting an error flag (e.g., `error: 'NOT_FOUND'`). The `GroupDetailPage.tsx` component will observe this state change and programmatically navigate the user to a 404 page.

## 4. Risks and Considerations

-   **Irreversibility**: This is a permanent action. The UI must include a very clear confirmation dialog (e.g., typing the group's name to confirm) before proceeding.
-   **Performance**: Deleting thousands of documents can take time. The operation should be handled asynchronously, and the UI should provide immediate feedback that the deletion is in progress.
-   **Cost**: Firestore bills for each delete operation. While typically inexpensive, deleting a very large group with extensive history could incur a noticeable cost.
-   **Error Handling**: The `bulkWriter` handles retries, but the entire process should be idempotent. If the function fails midway, it should be safe to run it again to complete the cleanup.
