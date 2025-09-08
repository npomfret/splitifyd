# Migration to Top-Level group_memberships Collection

## Problem Statement
Current pagination is broken because:
- Membership documents are in subcollections ordered by `groupId`
- Groups need to be displayed ordered by `updatedAt`
- These orderings are incompatible for pagination
- Can't paginate by date without fetching ALL memberships first

## Solution Overview
Create a top-level `group_memberships` collection that supports proper pagination with Firebase's native `startAfter()`.

## Data Structure

### Current Structure (Subcollection)
```
groups/{groupId}/members/{userId}
  - userId: string
  - role: string
  - joinedAt: Timestamp
  - addedBy: string
```

### New Structure (Top-Level Collection)
```
group_memberships/{membershipId}
  - id: string (auto-generated)
  - userId: string
  - groupId: string
  - groupName: string (denormalized for display)
  - groupUpdatedAt: Timestamp (denormalized for sorting)
  - role: string
  - joinedAt: Timestamp
  - addedBy: string
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

## Required Indexes

### Firestore Composite Indexes
1. **For user's groups listing (most common)**
   - Collection: `group_memberships`
   - Fields: `userId` (ASC) + `groupUpdatedAt` (DESC)
   - Query: List all groups for a user, ordered by most recently updated

2. **For group's members listing**
   - Collection: `group_memberships`
   - Fields: `groupId` (ASC) + `joinedAt` (DESC)
   - Query: List all members of a group, ordered by join date

3. **For checking membership**
   - Collection: `group_memberships`
   - Fields: `userId` (ASC) + `groupId` (ASC)
   - Query: Check if user is member of specific group

## Implementation Steps

### Phase 1: Create New Collection Structure

#### 1.1 Update Firestore Collections Enum
```typescript
// In packages/shared/src/shared-types.ts
export enum FirestoreCollections {
  // ... existing collections
  GROUP_MEMBERSHIPS = 'group_memberships',
}
```

#### 1.2 Create GroupMembership Interface
```typescript
// In packages/shared/src/shared-types.ts
export interface GroupMembershipDocument {
  id: string;
  userId: string;
  groupId: string;
  groupName: string;
  groupUpdatedAt: Timestamp;
  role: 'owner' | 'member' | 'viewer';
  joinedAt: Timestamp;
  addedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Phase 2: Update Write Operations (with Transactions)

#### 2.1 Group Creation
```typescript
// In GroupService.createGroup
await db.runTransaction(async (transaction) => {
  // Create group document
  const groupRef = db.collection('groups').doc();
  transaction.set(groupRef, groupData);
  
  // Create membership document for owner
  const membershipRef = db.collection('group_memberships').doc();
  transaction.set(membershipRef, {
    userId: creatorId,
    groupId: groupRef.id,
    groupName: groupData.name,
    groupUpdatedAt: groupData.updatedAt,
    role: 'owner',
    joinedAt: now,
    addedBy: creatorId,
    createdAt: now,
    updatedAt: now
  });
});
```

#### 2.2 Add Member to Group
```typescript
// In GroupMemberService.addMember
await db.runTransaction(async (transaction) => {
  // Get group data first (for denormalized fields)
  const groupDoc = await transaction.get(groupRef);
  const groupData = groupDoc.data();
  
  // Create membership document
  const membershipRef = db.collection('group_memberships').doc();
  transaction.set(membershipRef, {
    userId: newMemberId,
    groupId: groupId,
    groupName: groupData.name,
    groupUpdatedAt: groupData.updatedAt,
    role: 'member',
    joinedAt: now,
    addedBy: addedById,
    createdAt: now,
    updatedAt: now
  });
  
  // Update group's updatedAt
  transaction.update(groupRef, { updatedAt: now });
  
  // Update ALL memberships' groupUpdatedAt for this group
  const membershipsSnapshot = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .get();
    
  membershipsSnapshot.docs.forEach(doc => {
    transaction.update(doc.ref, { groupUpdatedAt: now });
  });
});
```

#### 2.3 Remove Member from Group
```typescript
// In GroupMemberService.removeMember
await db.runTransaction(async (transaction) => {
  // Find and delete membership document
  const membershipSnapshot = await db
    .collection('group_memberships')
    .where('userId', '==', userId)
    .where('groupId', '==', groupId)
    .get();
    
  if (!membershipSnapshot.empty) {
    transaction.delete(membershipSnapshot.docs[0].ref);
  }
  
  // Update group's updatedAt
  transaction.update(groupRef, { updatedAt: now });
  
  // Update remaining memberships' groupUpdatedAt
  const remainingMemberships = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .get();
    
  remainingMemberships.docs.forEach(doc => {
    if (doc.data().userId !== userId) {
      transaction.update(doc.ref, { groupUpdatedAt: now });
    }
  });
});
```

#### 2.4 Update Group
```typescript
// In GroupService.updateGroup
await db.runTransaction(async (transaction) => {
  // Update group document
  transaction.update(groupRef, {
    ...updateData,
    updatedAt: now
  });
  
  // Update ALL memberships' denormalized fields
  const membershipsSnapshot = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .get();
    
  membershipsSnapshot.docs.forEach(doc => {
    const updates: any = { groupUpdatedAt: now };
    if (updateData.name) {
      updates.groupName = updateData.name;
    }
    transaction.update(doc.ref, updates);
  });
});
```

#### 2.5 Delete Group
```typescript
// In GroupService.deleteGroup
await db.runTransaction(async (transaction) => {
  // Delete all memberships for this group
  const membershipsSnapshot = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .get();
    
  membershipsSnapshot.docs.forEach(doc => {
    transaction.delete(doc.ref);
  });
  
  // Delete all expenses, settlements, etc.
  // ... existing deletion logic
  
  // Finally delete the group
  transaction.delete(groupRef);
});
```

### Phase 3: Update Read Operations

#### 3.1 List Groups for User (with Pagination)
```typescript
// In FirestoreReader.getGroupsForUser
async getGroupsForUser(
  userId: string,
  options?: { limit?: number; cursor?: string; orderBy?: OrderBy }
): Promise<PaginatedResult<GroupDocument>> {
  const limit = options?.limit || 10;
  const effectiveLimit = limit + 1; // +1 to detect hasMore
  
  // Build query
  let query = this.db
    .collection('group_memberships')
    .where('userId', '==', userId)
    .orderBy('groupUpdatedAt', 'desc')
    .limit(effectiveLimit);
  
  // Apply cursor if provided
  if (options?.cursor) {
    const cursorData = this.decodeCursor(options.cursor);
    query = query.startAfter(cursorData.lastGroupUpdatedAt);
  }
  
  // Execute query
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    return { data: [], hasMore: false };
  }
  
  // Extract group IDs
  const groupIds = snapshot.docs.map(doc => doc.data().groupId);
  
  // Fetch actual group documents
  const groups = await this.getGroupsByIds(groupIds, {
    limit: effectiveLimit,
    orderBy: { field: 'updatedAt', direction: 'desc' }
  });
  
  // Detect if more results exist
  const hasMore = groups.length > limit;
  const returnedGroups = hasMore ? groups.slice(0, limit) : groups;
  
  // Generate cursor for next page
  let nextCursor: string | undefined;
  if (hasMore && snapshot.docs.length > limit) {
    const lastDoc = snapshot.docs[limit - 1]; // Use the doc at limit position
    nextCursor = this.encodeCursor({
      lastGroupUpdatedAt: lastDoc.data().groupUpdatedAt
    });
  }
  
  return {
    data: returnedGroups,
    hasMore,
    nextCursor
  };
}
```

#### 3.2 Check User Membership
```typescript
// In GroupPermissionService.isUserMemberOfGroup
async isUserMemberOfGroup(userId: string, groupId: string): Promise<boolean> {
  const snapshot = await this.db
    .collection('group_memberships')
    .where('userId', '==', userId)
    .where('groupId', '==', groupId)
    .limit(1)
    .get();
    
  return !snapshot.empty;
}
```

#### 3.3 Get Group Members
```typescript
// In GroupMemberService.getMembers
async getMembers(groupId: string): Promise<GroupMember[]> {
  const snapshot = await this.db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .orderBy('joinedAt', 'asc')
    .get();
    
  return snapshot.docs.map(doc => ({
    userId: doc.data().userId,
    role: doc.data().role,
    joinedAt: doc.data().joinedAt,
    addedBy: doc.data().addedBy
  }));
}
```

### Phase 4: Migration Script

#### 4.1 One-time Migration Script
```typescript
// scripts/migrate-memberships.ts
async function migrateMemberships() {
  const db = getFirestore();
  const batch = db.batch();
  let batchCount = 0;
  
  // Get all groups
  const groupsSnapshot = await db.collection('groups').get();
  
  for (const groupDoc of groupsSnapshot.docs) {
    const groupData = groupDoc.data();
    
    // Get members subcollection
    const membersSnapshot = await groupDoc.ref.collection('members').get();
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      
      // Create new membership document
      const membershipRef = db.collection('group_memberships').doc();
      batch.set(membershipRef, {
        userId: memberData.userId,
        groupId: groupDoc.id,
        groupName: groupData.name,
        groupUpdatedAt: groupData.updatedAt,
        role: memberData.role || 'member',
        joinedAt: memberData.joinedAt,
        addedBy: memberData.addedBy || groupData.createdBy,
        createdAt: memberData.joinedAt,
        updatedAt: FieldValue.serverTimestamp()
      });
      
      batchCount++;
      
      // Commit batch every 500 documents
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
}
```

### Phase 5: Testing

#### 5.1 Update Integration Tests
- Update `GroupService.integration.test.ts` pagination test
- Add tests for transaction rollback scenarios
- Add tests for concurrent updates
- Test migration script on test data

#### 5.2 Add New Tests
- Test membership consistency after group operations
- Test pagination with various cursor positions
- Test denormalized field updates
- Test transaction failures and rollbacks

### Phase 6: Deployment Strategy

1. **Deploy new code** (that writes to both old and new structures)
2. **Run migration script** to populate `group_memberships` collection
3. **Create Firestore indexes** (may take time to build)
4. **Switch reads** to use new collection
5. **Monitor** for issues
6. **Remove old code** writing to subcollections (after verification)

## Rollback Plan

If issues arise:
1. Switch reads back to subcollection approach
2. Keep writes going to both structures
3. Fix issues and retry migration

## Performance Considerations

### Write Costs
- Each group operation now updates multiple documents (all memberships)
- Use batched writes where possible
- Consider Cloud Functions for background updates

### Read Benefits
- Single query for paginated group lists (no collection group query)
- Natural pagination with Firebase cursors
- Consistent ordering between query and display

### Index Costs
- 3 composite indexes needed (minimal cost)
- Indexes build asynchronously (may take time for large datasets)

## Success Metrics

1. **Pagination works correctly** - no more flaky tests
2. **Query performance** - faster than collection group queries
3. **Data consistency** - no orphaned memberships
4. **Transaction success rate** - >99.9%

## Timeline Estimate

- Phase 1-2: 1 day (create structure, update writes)
- Phase 3: 1 day (update reads, fix pagination)
- Phase 4: 0.5 day (migration script)
- Phase 5: 1 day (testing)
- Phase 6: 0.5 day (deployment)

**Total: ~4 days**