# Feature: Archive and Hide Groups

## 1. Overview

Users often belong to groups that are no longer active (e.g., a completed trip or a past project) but which they don't want to permanently delete. Currently, the only option is to leave or delete the group, which can be a destructive action.

This feature introduces the ability for a user to "archive" a group. Archiving a group will hide it from their primary dashboard view, reducing clutter while preserving the group's data and their membership in it. This is a user-specific action and does not affect how other members see the group.

## 2. The Problem: A Cluttered Dashboard

- As users participate in more groups, their dashboard can become cluttered with groups that are no longer relevant to them on a day-to-day basis.
- There is no way to temporarily hide a group without leaving it, which would cause the user to lose access to the historical data.
- Deleting a group is a permanent, global action that affects all members and is often not the desired outcome.

## 3. The Solution: User-Specific Archiving

The solution is to store the archived state on a per-user, per-group basis. This will be achieved by modifying the document that represents a user's membership within a group.

### 3.1. Proposed Schema Change

I will update the `GroupMemberDocument` schema to include a `status` field. This keeps the user's view preference tied directly to their membership in that specific group.

```typescript
// In packages/shared/src/shared-types.ts

export const MemberStatuses = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    PENDING: 'pending',
} as const;

export interface GroupMemberDocument {
    // ... existing fields like userId, groupId, memberRole
    memberStatus: (typeof MemberStatuses)[keyof typeof MemberStatuses]; // 'active', 'archived', or 'pending'
}
```

- **`active`**: The default state. The group appears on the main dashboard.
- **`archived`**: The user has hidden the group. It will not appear on the main dashboard.
- **`pending`**: (For future use) The user is awaiting approval to join the group.

### 3.2. Implementation Plan

#### Phase 1: API and Backend Logic

1.  **Create New API Endpoints**:
    - `POST /api/groups/{groupId}/archive`: Sets the user's membership status for that group to `archived`.
    - `POST /api/groups/{groupId}/unarchive`: Sets the user's membership status for that group back to `active`.

2.  **Create New `GroupMemberService` Methods**:
    - The API handlers will call new methods in the `GroupMemberService` (or a similar service).
    - These methods (`archiveGroupForUser`, `unarchiveGroupForUser`) will locate the specific `groups/{groupId}/members/{userId}` document and update its `memberStatus` field.
    - Permissions will be checked to ensure the user is actually a member of the group before allowing the operation.

#### Phase 2: Update Data Access Logic

1.  **Modify `GroupService.listGroups`**:
    - The `listGroups` API endpoint will be updated to accept a new optional query parameter, such as `statusFilter` (e.g., `?statusFilter=archived`).
    - By default, if the parameter is omitted, the underlying Firestore query will be modified to only return groups where the requesting user's `memberStatus` is `active`.
    - This ensures that archived groups are hidden from the main dashboard view by default.

    **Example Query Logic in `FirestoreReader`:**

    ```typescript
    // When fetching a user's group memberships
    let query = firestoreDb.collectionGroup('members').where('userId', '==', userId);

    if (statusFilter) {
        query = query.where('memberStatus', '==', statusFilter);
    } else {
        // Default to only showing active groups
        query = query.where('memberStatus', '==', 'active');
    }
    ```

#### Phase 3: Frontend UI/UX Changes

1.  **Add "Archive" Option**:
    - On the group dashboard, each group card will have a menu with an "Archive" option.
    - Clicking this will call the new `POST /api/groups/{groupId}/archive` endpoint and the group will disappear from the main list in real-time.

2.  **Create "Archived Groups" View**:
    - A new section or page (e.g., in Settings or as a filter on the dashboard) will be created to display archived groups.
    - This view will call the `listGroups` endpoint with the `?statusFilter=archived` parameter.

3.  **Add "Unarchive" Option**:
    - In the "Archived Groups" view, each group card will have an "Unarchive" option.
    - Clicking this will call the `POST /api/groups/{groupId}/unarchive` endpoint, moving the group back to the main dashboard view.

### 3.3. Benefits of This Approach

- **User-Centric**: Allows each user to customize their own view without affecting others.
- **Non-Destructive**: Preserves all group data and membership history.
- **Scalable**: The `memberStatus` field is on the `GroupMember` document, which is a scalable approach that avoids bloating the main `User` document.
- **Clean UI**: Helps users focus on currently relevant groups, improving the user experience.
- **Flexible**: The `memberStatus` field can be extended in the future to support other states (e.g., `pending`, `invited`).

## 4. Comparison with Soft-Delete

It is important to distinguish this feature from group soft-deletion:

- **Archiving (This Feature)**: A **user-specific** action that hides a group from that user's view. The group remains fully active for all other members.
- **Soft-Deletion**: A **global** action that marks the entire group as deleted for everyone. The group is effectively disabled, though its data is preserved in the database.

This archiving feature provides a much-needed middle ground between keeping a group active and deleting it entirely.
