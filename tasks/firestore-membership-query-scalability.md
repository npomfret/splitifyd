# ✅ Architectural Deep Dive: The Scalable Firestore Membership Model

**Document Status: Updated & Current as of September 2025.**

This document provides an authoritative overview of the scalable group membership architecture now implemented in Firestore. The original problem of non-scalable membership queries has been **solved**. This document explains the current, production architecture.

---

## Historical Context: Lessons Learned from the Q3 2025 Membership Refactor

Initially, fixing a single non-scalable query (`.where('data.members.${userId}', '!=', null)`) was planned as a small task. However, it evolved into a major refactoring effort. The "lessons learned" from this effort are preserved here as they provide invaluable insight into the complexities of our codebase and serve as a guide for future architectural changes.

### What We Learned (54 files changed, 1,338 insertions, 814 deletions)

The attempt to fix one query cascaded into a full-stack migration due to several underestimated dependencies:

#### 1. **API Contract Cascade**
- Changing the `Group` interface to remove the embedded `members` map was a breaking change.
- This forced the creation of a new `GroupFullDetails` API response to provide the group, the members (now with full profiles), and balances in a single call.
- The frontend, which expected embedded members, had to be updated to work with the new consolidated API structure.

#### 2. **Async Permission Cascade**
- Moving membership checks to a subcollection-based `GroupMemberService` meant the `isGroupMember()` function had to become `async`.
- This seemingly small change propagated through the entire permission system, forcing `PermissionEngine.checkPermission()`, all authorization middleware, and dozens of route handlers to become `async`.
- This was a major source of test failures and required careful refactoring.

#### 3. **Test Infrastructure Collapse**
- Test builders like `CreateGroupRequestBuilder.withMembers()` were built on the assumption of the old data model.
- They had to be completely rewritten to use the new `GroupMemberService` and the "invite-by-link" workflow, causing complex changes in many test files.

#### 4. **Member Profile Merging Complexity**
- The new `GroupMemberWithProfile` type, which combines a user's profile with their group membership role, required new and complex data-merging logic in the `GroupMemberService`.

#### 5. **The "No Backward Compatibility" Rule Held Firm**
- Unlike the hypothetical plan, the final implementation correctly avoided adding legacy fields or re-exports, adhering to our "no backward-compatible code" principle. This made the change cleaner but also required the frontend and backend to be deployed in sync.

---

## 🏛️ The Current Architecture: A Scalable Subcollection Model

The core of the current architecture is the move from embedding members in a map on the group document to storing each member in their own document within a `members` subcollection.

### 1. The Data Model: Groups and Members Subcollections

A `groups` document in Firestore **no longer contains any member information**.

**`groups/{groupId}`:**
```typescript
// packages/shared/src/shared-types.ts
export interface Group extends BaseEntity {
  name: string;
  description: string | null;
  imageUrl: string | null;
  theme: string;
  // No 'members' field!
}
```

Instead, each member is a separate document inside a `members` subcollection.

**`groups/{groupId}/members/{userId}`:**
```typescript
// packages/shared/src/shared-types.ts
export interface GroupMember {
  userId: string;
  groupId: string;
  role: GroupMemberRole;
  // ...other membership details
}
```

### 2. The Scalable Query: `collectionGroup`

The original scalability problem is solved by using a `collectionGroup` query across all `members` subcollections. This allows us to efficiently find all groups for a given user.

This is implemented in `GroupMemberService.getGroupIdsForUser()`:

**`firebase/functions/src/services/GroupMemberService.ts`**
```typescript
async getGroupIdsForUser(userId: string): Promise<string[]> {
  const membersSnapshot = await this.db
    .collectionGroup('members')
    .where('userId', '==', userId)
    .get();

  if (membersSnapshot.empty) {
    return [];
  }

  return membersSnapshot.docs.map((doc) => doc.data().groupId);
}
```

This query is supported by a simple, scalable index:

**`firebase/firestore.indexes.json`**
```json
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" }
  ]
}
```

### 3. The `GroupMemberService`: The Single Source of Truth

All business logic for reading and writing membership data is now centralized in `GroupMemberService.ts`. This service is responsible for:
- Adding and removing members from a group's subcollection.
- Checking if a user is a member of a group (`isGroupMember`).
- Updating a member's role.
- Fetching all members for a group and combining them with user profiles to create the `GroupMemberWithProfile[]` array.

### 4. The API Contract: `GroupFullDetails`

To provide the frontend with all the data it needs in an efficient way, the main group endpoints now return the `GroupFullDetails` object. This object contains the core group data, the array of members with their profiles, and the group balances.

**`packages/shared/src/shared-types.ts`**
```typescript
export interface GroupFullDetails {
  group: Group;
  members: GroupMemberWithProfile[];
  balances: GroupBalances;
}
```
This consolidated response is the result of the API cascade and ensures that while the data is stored in a normalized way (subcollections), it can be presented to the client in a denormalized, easy-to-consume format.

### Summary of Benefits

1.  **Scalability:** The system can now support millions of users and groups without requiring an explosion of indexes.
2.  **Centralized Logic:** All membership logic is in one place (`GroupMemberService`), making it easier to maintain and reason about.
3.  **Improved Data Consistency:** The `GroupFullDetails` API response ensures that the frontend receives a consistent and complete snapshot of the group's state.
4.  **Type Safety:** The new interfaces (`GroupMember`, `GroupMemberWithProfile`) provide strong type safety throughout the application.
