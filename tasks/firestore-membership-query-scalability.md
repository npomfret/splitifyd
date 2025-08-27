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

### Phase 1: Update Shared Types (15 min)
1. **Update GroupMember interface** - Add required `userId` field
2. **Update Group interface** - Remove `members` map entirely
3. **Add GroupWithMembers type** - For when we need group + members together
4. **Update/remove groupSize() function** - It's now async via MemberService

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

### Phase 3: Rewrite Core Group Operations (45 min)
1. **Group creation** (`GroupService.createGroup`)
   - Create group doc without members field
   - Use `MemberService.batchAddMembers()` for initial members
   
2. **Group listing** (`GroupService.listGroups`) 
   - Use `MemberService.getUserGroups()` to get group IDs
   - Batch fetch group documents
   - Handle pagination in-memory
   
3. **Group access checks** (`fetchGroupWithAccess`)
   - Use `MemberService.isMember()` instead of checking members map
   
4. **Delete User check** (`UserService2.deleteUser`)
   - Use `MemberService.getUserGroups()` to check if user has groups

### Phase 4: Fix All Member Operations (45 min)
1. **Add member to group** (`groups/handlers.ts`)
   - Use `MemberService.addMember()` 
   
2. **Remove member from group** 
   - Use `MemberService.removeMember()`
   
3. **Update member role** (`permissionHandlers.ts`)
   - Use `MemberService.updateMember()` instead of field path updates
   
4. **Get group members**
   - Use `MemberService.getGroupMembers()`

### Phase 5: Fix Validation & Authorization (1 hour)
1. **Update isGroupMember()** helper
   - Use `MemberService.isMember()` async call
   
2. **Update isGroupOwner()** helper  
   - Check `group.createdBy` or use `MemberService.getMemberRole()`
   
3. **Fix PermissionEngine**
   - Update to work with async member lookups
   
4. **Fix settlement validation**
   - Update membership checks in settlement operations
   
5. **Fix expense validation**
   - Update membership checks in expense operations

### Phase 6: Update Transform Functions (30 min)
1. **transformGroupDocument()**
   - Handle groups without members field
   - Add helper to populate members when needed
   
2. **addComputedFields()**
   - Fetch members from subcollection when needed
   
3. **Update balance calculations**
   - Fetch members for balance computation

### Phase 7: Fix Test Infrastructure (1 hour)
1. **Update test mocking**
   - Mock `.collection().doc().collection()` chain
   - Mock `collectionGroup()` queries
   
2. **Update GroupBuilder**
   - Don't set members on group document
   - Add helper to create member subcollection docs
   
3. **Update GroupMemberBuilder**  
   - Include required userId field
   
4. **Update test fixtures**
   - Use new structure in all test data
   
5. **Fix integration test helpers**
   - Update `createGroupWithMembers()` to use subcollections
   - Update member verification helpers

### Phase 8: Create Index and Deploy (15 min)
1. **Create collection group index**
   ```json
   {
     "collectionGroup": "members",
     "fields": [
       {"fieldPath": "userId", "order": "ASCENDING"}
     ],
     "queryScope": "COLLECTION_GROUP"
   }
   ```
   
2. **Deploy index** via Firebase CLI or console

3. **Run tests** to verify everything works

### Phase 9: Clean Up (30 min)
1. **Remove all TODO comments**
2. **Remove any migration helpers**
3. **Update API documentation**
4. **Verify no remaining dynamic field paths**

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

### Core Files
- `/packages/shared/src/shared-types.ts` - Update types
- `/firebase/functions/src/services/MemberService.ts` - New service
- `/firebase/functions/src/services/GroupService.ts` - Update queries
- `/firebase/functions/src/groups/handlers.ts` - Update member ops
- `/firebase/functions/src/groups/permissionHandlers.ts` - Update role changes
- `/firebase/functions/src/services/UserService2.ts` - Update delete check

### Helper Files  
- `/firebase/functions/src/utils/groupHelpers.ts` - Update helpers
- `/firebase/functions/src/permissions/index.ts` - Update permission checks
- `/firebase/functions/src/services/balance.ts` - Update balance calcs

### Test Files
- `/firebase/functions/src/__tests__/unit/*.test.ts` - Update mocks
- `/firebase/functions/src/__tests__/integration/*.test.ts` - Update fixtures
- `/firebase/functions/src/test-support/builders/*.ts` - Update builders

## Rollback Plan
Since there's no existing data, rollback is simple:
1. Revert all code changes
2. Remove the collection group index
3. No data cleanup needed