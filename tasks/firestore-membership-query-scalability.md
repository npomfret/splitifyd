# Firestore Membership Query Scalability Issue - Clean Refactor Plan

## Problem Analysis

### Current Issue

The groups listing API (`/api/groups?includeMetadata=true`) fails for new users with a Firestore index error because the current query pattern uses **dynamic field paths** (`data.members.${userId}`) that require individual indexes for each user.

### Key Insight

**There is NO existing data** - we can do a complete, clean refactor without any migration or backwards compatibility concerns.

## Solution: Subcollections with Collection Group Queries

### New Data Structure

```
groups/{groupId}/
├── (document) - group metadata only
│   ├── name: string
│   ├── description: string
│   ├── createdBy: string
│   ├── permissions: {...}
│   ├── createdAt: timestamp
│   └── updatedAt: timestamp
└── members/{userId} - member subcollection
    ├── userId: string (required)
    ├── role: "admin" | "member" | "viewer"
    ├── status: "active" | "inactive"
    ├── theme: { primary: "#color", ... }
    ├── joinedAt: timestamp
    └── invitedBy?: string
```

### Query Pattern Transformation

```javascript
// OLD: Dynamic field path query (BROKEN - requires per-user indexes)
.where(`data.members.${userId}`, '!=', null)

// NEW: Collection group query (SCALABLE - single index for all users)
firestoreDb.collectionGroup('members').where('userId', '==', userId)
```

## Implementation Plan - Clean Refactor

Since there's no existing data, we can do a complete, aggressive refactor without dual-writes, migrations, or feature flags.

### Phase 1: Update Shared Types (10 min)

1. **Update GroupMember interface** - Add required `userId` field
2. **Remove `members` map from Group interface** - Clean break from old structure
3. **Add GroupWithMembers type** - For when we need group + members together
4. **Make groupSize() async** - Will call MemberService for count

### Phase 2: Create MemberService (30 min)

Create `firebase/functions/src/services/MemberService.ts` with clean subcollection operations:

- `addMember(groupId, userId, memberData)` - Add to subcollection
- `removeMember(groupId, userId)` - Remove from subcollection
- `updateMember(groupId, userId, updates)` - Update member data
- `getMember(groupId, userId)` - Get single member
- `getGroupMembers(groupId)` - Get all members of a group
- `getUserGroups(userId)` - **Collection group query** for user's groups
- `isMember(groupId, userId)` - Check membership
- `getMemberRole(groupId, userId)` - Get user's role
- `getGroupMemberCount(groupId)` - Count members
- `batchAddMembers(groupId, members)` - Batch add for group creation

### Phase 3: Update Core Group Operations (45 min)

**GroupService.ts:**
- `createGroup()` - Create group doc without members, use `MemberService.batchAddMembers()`
- `listGroups()` - Replace line 283's problematic query with collection group query via `MemberService.getUserGroups()`
- `fetchGroupWithAccess()` - Use `MemberService.isMember()` for access checks
- `addComputedFields()` - Fetch members when needed

**UserService2.ts:**
- `deleteUser()` - Replace line 358's problematic query with collection group query

### Phase 4: Fix Member Management (45 min)

**GroupMemberService.ts:**
- `leaveGroup()` - Use `MemberService.removeMember()` instead of updating members map
- `removeGroupMember()` - Use `MemberService.removeMember()` instead of updating members map
- `getGroupMembers()` - Use `MemberService.getGroupMembers()` instead of accessing group.members

**GroupShareService.ts:**
- `joinGroupByLink()` - Use `MemberService.addMember()` instead of updating members map
- `previewGroup()` - Use `MemberService.getGroupMemberCount()` instead of Object.keys(members).length

**GroupPermissionService.ts:**
- `setMemberRole()` - Use `MemberService.updateMember()` instead of field path updates to `data.members.${userId}.role`

### Phase 5: Fix Validation & Authorization (1 hour)

- Update `isGroupMember()` helper in `utils/groupHelpers.ts` to use async `MemberService.isMember()`
- Update `isGroupOwner()` helper - can stay synchronous using `group.createdBy`
- Fix `PermissionEngine` to work with async member lookups
- Update settlement/expense validation that checks membership

### Phase 6: Update Transform Functions (30 min)

- `transformGroupDocument()` - Handle groups without members field
- Add helper to populate members when needed for API responses
- Update balance calculations to fetch members from subcollection

### Phase 7: Fix Tests (1 hour)

- Mock subcollection chains: `.collection().doc().collection()`
- Mock `collectionGroup()` queries  
- Update `GroupBuilder` to not set members on group document
- Add `GroupMemberBuilder` with required `userId` field
- Update all test fixtures and integration test helpers
- Fix 15+ test files that reference group.members

### Phase 8: Create Collection Group Index (15 min)

Add to `firebase/firestore.indexes.json`:
```json
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    {"fieldPath": "userId", "order": "ASCENDING"}
  ]
}
```

### Phase 9: Deploy & Verify (15 min)

- Deploy index to Firebase
- Run all tests to ensure no regressions
- Verify new users can list groups without index errors

## Total Time Estimate: ~5-6 hours

## Key Benefits of Clean Refactor

- **No backwards compatibility needed** - No existing data
- **No dual-writes** - Direct switch to new pattern
- **No feature flags** - Single code path
- **No migration scripts** - Start fresh
- **Cleaner code** - Remove all legacy patterns

## Success Criteria

✅ New users can join without index errors  
✅ Groups listing works via collection group query  
✅ All member operations use subcollections  
✅ All tests pass  
✅ Single collection group index serves all users  
✅ No dynamic field path queries remain

## Files to Modify

### Core Services (7 files)
- `/packages/shared/src/shared-types.ts` - Update types, add userId to GroupMember, remove members from Group
- `/firebase/functions/src/services/MemberService.ts` - **NEW FILE** - Subcollection operations
- `/firebase/functions/src/services/GroupService.ts` - Replace line 283 query, update createGroup, fetchGroupWithAccess
- `/firebase/functions/src/services/GroupMemberService.ts` - Replace member map operations with MemberService calls
- `/firebase/functions/src/services/GroupShareService.ts` - Use MemberService for joinGroupByLink, previewGroup
- `/firebase/functions/src/services/GroupPermissionService.ts` - Replace field path updates with MemberService.updateMember
- `/firebase/functions/src/services/UserService2.ts` - Replace line 358 query with collection group query

### Helper Files (3 files)
- `/firebase/functions/src/utils/groupHelpers.ts` - Make isGroupMember() async, update groupSize()
- `/firebase/functions/src/permissions/permission-engine.ts` - Handle async member lookups
- `/firebase/functions/src/groups/handlers.ts` - Update transformGroupDocument, addComputedFields

### Configuration (1 file)
- `/firebase/firestore.indexes.json` - Add collection group index for members

### Test Files (15+ files)
**Unit Tests:**
- `/firebase/functions/src/__tests__/unit/groupHelpers.test.ts` - Update mocks for async helpers
- `/firebase/functions/src/__tests__/unit/permission-engine.test.ts` - Update member access mocks

**Integration Tests:**
- `/firebase/functions/src/__tests__/integration/normal-flow/groups.test.ts` - Update group creation/listing
- `/firebase/functions/src/__tests__/integration/normal-flow/groups-full-details.test.ts` - Update member queries
- `/firebase/functions/src/__tests__/integration/normal-flow/group-members.test.ts` - Update member operations
- `/firebase/functions/src/__tests__/integration/group-permissions.test.ts` - Update role changes
- `/firebase/functions/src/__tests__/integration/real-time/group-membership-sync.test.ts` - Update member sync
- Plus 8+ other integration tests that reference group.members

**Test Support:**
- `/firebase/functions/src/test-support/builders/*` - Update GroupBuilder, create GroupMemberBuilder

## Rollback Plan

Since there's no existing data, rollback is simple:

1. Revert all code changes
2. Remove the collection group index
3. No data cleanup needed
