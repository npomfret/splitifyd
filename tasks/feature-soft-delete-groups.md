# Feature: Soft-Delete for Groups

## 1. Summary

This document outlines the plan to change the group deletion mechanism from a hard delete to a soft delete. Currently, deleting a group removes the document and all its sub-collections from Firestore. For large groups, this operation is at risk of timing out or exceeding memory limits in the Firebase Function.

### Current Status

- ✅ Schema and service changes are implemented; group deletion now sets `deletedAt`.
- ✅ Firestore reader/writer updates, shared DTOs, builders, and security/index definitions all reflect the new field.
- ✅ Backend/shared/frontend unit tests pass with the soft-delete behaviour.
- 🔄 Full integration suite still needs to be rerun once the functions emulator is reachable (current attempts from CI env time out).

The proposed solution is to introduce a `deletedAt` timestamp to the group document. When a user "deletes" a group, we will set this timestamp instead of permanently removing the data. All queries will be updated to filter out these soft-deleted groups, making the change transparent to the end-user.

## 2. Problem

- **Performance and Reliability:** Deleting a large group and its associated sub-collections (expenses, members, comments, etc.) is a long-running and memory-intensive operation. This can cause the Firebase Function to fail, leaving the data in an inconsistent state.
- **Data Recovery:** Hard deletion is irreversible. If a group is deleted by mistake, there is no way to recover the data without restoring from a backup, which can be a complex and slow process.
- **Auditing:** Hard-deleted data is lost, making it impossible to audit past activities or group memberships.

## 3. Proposed Solution

The solution is to implement a soft-delete pattern.

- **`deletedAt` field:** A new field, `deletedAt`, of type `Timestamp | null` will be added to the `Group` document schema. A `null` value indicates the group is active.
- **Soft-Delete Logic:** The "delete group" operation will be modified to update the group document, setting the `deletedAt` field to the current server timestamp.
- **Query Filtering:** All queries that fetch groups will be updated to exclude documents where `deletedAt` is not `null`.
- **Firestore Index:** A new Firestore index will be required to efficiently query groups while filtering on the `deletedAt` field.

## 4. Implementation Plan

### Phase 1: Schema and Backend Logic

1.  **Update Group Schema:**
    - In `firebase/functions/src/schemas/group.ts`, add `deletedAt: z.date().nullable()` to the `GroupDocumentSchema`.
    - In `packages/shared/src/shared-types.ts`, add `deletedAt: string | null` to the `GroupDTO`.

2.  **Modify `GroupService`:**
    - Locate the `deleteGroup` method in `firebase/functions/src/services/GroupService.ts`.
    - Change its implementation from calling `firestoreWriter.deleteGroup` to `firestoreWriter.updateGroup`.
    - The update operation will set `deletedAt: new Date()`.

3.  **Modify `FirestoreWriter`:**
    - The `deleteGroup` method in `firebase/functions/src/services/firestore/FirestoreWriter.ts` will likely involve a recursive deletion. This logic will be deprecated or repurposed for a future hard-delete/cleanup mechanism.
    - The `updateGroup` method will be used to set the `deletedAt` field.

4.  **Modify `FirestoreReader`:**
    - All methods in `firebase/functions/src/services/firestore/FirestoreReader.ts` that fetch groups must be updated.
    - For example, `getGroup`, `getGroupsForUser`, `getGroupAndMembers` etc. must be modified to include a `.where('deletedAt', '==', null)` clause in their Firestore queries.

### Phase 2: Firestore Indexing

1.  **Update `firestore.indexes.json`:**
    - A new composite index will be needed for queries that filter by `deletedAt` and order by another field (e.g., `createdAt` or `name`).
    - For example, a query like `db.collection('groups').where('members', 'array-contains', userId).where('deletedAt', '==', null)` will require a new index.
    - The exact index definition will depend on the final query patterns. It will look something like this:

    ```json
    {
      "collectionGroup": "groups",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "members", "arrayConfig": "CONTAINS" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" }
      ]
    }
    ```

### Phase 3: Security Rules

1.  **Update `firestore.rules`:**
    - Review and update Firestore security rules to account for the `deletedAt` field.
    - Reads should be denied for documents where `deletedAt` is not null, unless the user has a specific admin/owner role that allows viewing soft-deleted content (though this is out of scope for the initial implementation).
    - Writes to soft-deleted documents should be denied to prevent modification.

    ```
    // Example rule for reading groups
    match /groups/{groupId} {
      allow read: if resource.data.deletedAt == null && request.auth.uid in resource.data.members;
    }
    ```

### Phase 4: Client-Side (Verification)

- No direct changes should be needed on the client-side (`webapp-v2`).
- The change is backend-focused. The client should continue to call the same `deleteGroup` API endpoint.
- After deletion, the group should disappear from the user's dashboard and lists, as the updated backend queries will filter it out.

## 5. Future Considerations

- **Hard Deletion:** A separate, secure mechanism (e.g., a scheduled Cloud Function) could be created to permanently delete groups that have been soft-deleted for a certain period (e.g., 30 days). This would be for data lifecycle management and would not be exposed to users.
- **Data Restoration:** A new internal tool or admin-only API endpoint could be created to "un-delete" a group by setting `deletedAt` back to `null`.

## 6. Research Findings (Code locations)

- **Group Deletion Endpoint:** The API route for deleting a group is defined in `firebase/functions/src/index.ts`. This will point to a handler in `firebase/functions/src/groups/handlers.ts`.
- **Group Service:** The core logic for group deletion resides in `firebase/functions/src/services/GroupService.ts`.
- **Firestore Interaction:** The `GroupService` will call methods on `FirestoreWriter` (`firebase/functions/src/services/firestore/FirestoreWriter.ts`) to perform the deletion and `FirestoreReader` (`firebase/functions/src/services/firestore/FirestoreReader.ts`) for queries.
- **Group Queries:** I will need to audit all methods in `FirestoreReader` that query the `groups` collection to ensure the `deletedAt == null` filter is applied. This includes methods for fetching single groups, lists of groups, and groups with members.
