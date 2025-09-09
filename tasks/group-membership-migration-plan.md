# Group Membership Migration Plan: Dual-Write Strategy

**Status**: Planning Phase  
**Priority**: High  
**Risk Level**: Low (Dual-write approach)
**Estimated Timeline**: 5-7 days  
**Created**: 2025-01-09  

## Problem Statement

The current group membership architecture prevents efficient pagination of user groups ordered by activity due to Firestore's limitations with subcollection queries.

### Current Architecture Issues

1. **Pagination Limitation**: Cannot efficiently order user's groups by `group.updatedAt` 
2. **Query Performance**: Must fetch all memberships first, then sort groups in application code
3. **Poor User Experience**: Users cannot see their most recently active groups first
4. **Scalability Issues**: Performance degrades as users join more groups

### Current Problematic Implementation

```typescript
// In FirestoreReader.getGroupsForUser() - current broken approach
let membershipQuery = this.db.collectionGroup('members')
    .where('userId', '==', userId)
    .orderBy('groupId') // ❌ Cannot order by group.updatedAt efficiently
    .limit(effectiveLimit * 2);

// Forces inefficient pattern:
// 1. Get ALL user memberships
// 2. Extract group IDs  
// 3. Fetch group documents separately
// 4. Sort groups by updatedAt in memory
// 5. Apply pagination AFTER sorting (breaks cursors)
```

## Proposed Solution: Top-Level Collection with Minimal Denormalization

### New Data Model (Minimal Essential Denormalization)

```typescript
// Collection: group-memberships
// Document ID: {userId}_{groupId}
interface GroupMembershipDocument {
    // Core membership data (identical to subcollection)
    userId: string;
    groupId: string;
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: string;
    theme: UserThemeColor;
    invitedBy?: string;
    
    // ESSENTIAL denormalized field for database-level sorting
    groupUpdatedAt: string;  // From group.updatedAt - enables proper ordering
    
    // Standard metadata
    createdAt: string;
    updatedAt: string;
}
```

### Why Minimal Denormalization?

1. **Database-Level Sorting**: Essential for scalable pagination with proper ordering
2. **Single Denormalized Field**: Only `groupUpdatedAt` - minimal complexity
3. **Sync Only When Needed**: Update memberships only when groups actually change
4. **Scalable Solution**: Works with thousands of groups per user

### Query Benefits

**Before (Broken):**
```typescript
// Cannot efficiently order by group activity
collectionGroup('members').where('userId', '==', userId).orderBy('groupId')
// Then must fetch all group docs and sort in memory - breaks pagination
```

**After (Fixed):**
```typescript  
// Single query with proper database-level ordering and pagination
const memberships = await db.collection('group-memberships')
    .where('userId', '==', userId)
    .orderBy('groupUpdatedAt', 'desc')
    .limit(10)
    .startAfter(cursor)
    .get();

// Get group documents (already in correct order)
const groupIds = memberships.docs.map(doc => doc.data().groupId);
const groups = await getGroupsByIds(groupIds, { preserveOrder: true });
```

## Database Schema Updates

### Required Firestore Indexes
```json
{
  "indexes": [
    {
      "collectionId": "group-memberships",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "groupUpdatedAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionId": "group-memberships",
      "queryScope": "COLLECTION", 
      "fields": [
        {"fieldPath": "groupId", "order": "ASCENDING"}
      ]
    }
  ]
}
```

### Update Shared Types
```typescript
// In packages/shared/src/shared-types.ts
export const FirestoreCollections = {
    // ... existing collections
    GROUP_MEMBERSHIPS: 'group-memberships',
} as const;

export interface GroupMembershipDocument {
    userId: string;
    groupId: string;
    memberRole: MemberRole;
    memberStatus: MemberStatus;
    joinedAt: string;
    theme: UserThemeColor;
    invitedBy?: string;
    groupUpdatedAt: string;
    createdAt: string;
    updatedAt: string;
}
```

## Implementation Strategy: Direct Migration to New Collection

Since there's no existing data, we can implement the new top-level collection approach directly without any migration complexity.

### Phase 1: Setup (Day 1)

#### Step 1: Schema & Infrastructure
- [ ] Add `GroupMembershipDocument` interface to `@splitifyd/shared`
- [ ] Add `GROUP_MEMBERSHIPS` constant to `FirestoreCollections`
- [ ] Deploy required Firestore indexes
- [ ] Add validation schema in `firebase/functions/src/schemas/`

#### Step 2: Update All Membership Operations (Transactional)
Since there's no existing data, update all operations to use the new collection directly. **All denormalized data must be updated within transactions** to maintain referential integrity.

**GroupService.createGroup():**
```typescript
await transaction.run(async (t) => {
    // Create group document
    t.set(groupRef, groupDoc);
    
    // Create membership document in top-level collection
    const membershipId = `${userId}_${groupId}`;
    const membershipDoc = {
        userId,
        groupId: groupDoc.id,
        memberRole: MemberRoles.ADMIN,
        memberStatus: MemberStatuses.ACTIVE,
        joinedAt: now.toDate().toISOString(),
        theme: getThemeColorForMember(0),
        groupUpdatedAt: groupDoc.updatedAt,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
    };
    t.set(membershipTopLevelRef, membershipDoc);
});
```

**GroupShareService.joinGroupByLink():**
```typescript
await transaction.run(async (t) => {
    // Update group timestamp
    const newUpdatedAt = serverTimestamp();
    t.update(groupRef, { updatedAt: newUpdatedAt });
    
    // Create membership document with denormalized groupUpdatedAt
    const membershipId = `${userId}_${groupId}`;
    const membershipDoc = {
        userId,
        groupId,
        memberRole: MemberRoles.MEMBER,
        memberStatus: MemberStatuses.ACTIVE,
        joinedAt: now.toISOString(),
        theme: getThemeColorForMember(memberIndex),
        invitedBy: shareLink.createdBy,
        groupUpdatedAt: newUpdatedAt, // Consistent with group update
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    t.set(membershipRef, membershipDoc);
});
```

**GroupMemberService Operations:**
- `leaveGroup()`: Delete from top-level collection (no denormalization sync needed)
- `removeGroupMember()`: Delete from top-level collection (no denormalization sync needed)

#### Step 3: Add Group Update Sync (Critical for Referential Integrity)
When groups are updated, we must update the denormalized `groupUpdatedAt` field in all membership documents **within the same transaction**:

```typescript
// In GroupService.updateGroup() - CRITICAL for data consistency
async updateGroup(groupId: string, userId: string, updates: UpdateGroupRequest) {
    await transaction.run(async (t) => {
        const newUpdatedAt = serverTimestamp();
        
        // Update group document
        t.update(groupRef, { 
            ...updates, 
            updatedAt: newUpdatedAt 
        });
        
        // CRITICAL: Update denormalized field in ALL membership documents
        const memberships = await db.collection('group-memberships')
            .where('groupId', '==', groupId)
            .get();
        
        // Update all memberships with new groupUpdatedAt
        for (const membershipDoc of memberships.docs) {
            t.update(membershipDoc.ref, {
                groupUpdatedAt: newUpdatedAt,
                updatedAt: serverTimestamp()
            });
        }
    });
}
```

**Why This is Essential:**
- **Referential Integrity**: Ensures membership ordering matches actual group activity
- **Data Consistency**: Prevents stale denormalized data
- **Transactional Safety**: All updates succeed or fail together
- **Query Correctness**: Group list ordering remains accurate

### Phase 2: Update Read Operations (Day 2)

#### Update FirestoreReader
```typescript
// Replace existing getGroupsForUser method
async getGroupsForUser(
    userId: string, 
    options?: { limit?: number; cursor?: string; orderBy?: OrderBy }
): Promise<PaginatedResult<GroupDocument>> {
    
    const limit = options?.limit || 10;
    
    // Build efficient query with database-level ordering
    let query = this.db.collection('group-memberships')
        .where('userId', '==', userId)
        .orderBy('groupUpdatedAt', 'desc');
    
    // Apply cursor pagination
    if (options?.cursor) {
        const cursorData = this.decodeCursor(options.cursor);
        query = query.startAfter(cursorData.groupUpdatedAt);
    }
    
    query = query.limit(limit + 1); // +1 for hasMore detection
    
    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const memberships = (hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs)
        .map(doc => doc.data());
    
    if (memberships.length === 0) {
        return { data: [], hasMore: false };
    }
    
    // Get group documents (preserving order from membership query)
    const groupIds = memberships.map(m => m.groupId);
    const groups = await this.getGroupsByIds(groupIds, { preserveOrder: true });
    
    return {
        data: groups,
        hasMore,
        nextCursor: hasMore ? this.encodeCursor({
            groupUpdatedAt: memberships[memberships.length - 1].groupUpdatedAt
        }) : undefined
    };
}
```

#### Update Other Read Operations
- [ ] `isGroupMember()` - Check membership in new collection
- [ ] `getGroupMembers()` - List members from new collection  
- [ ] Any other membership queries

### Phase 3: Testing & Validation (Day 3)

#### Update Tests
- [ ] Update all unit tests for new collection structure
- [ ] Update integration tests  
- [ ] Performance testing
- [ ] End-to-end validation

#### Remove Subcollection Code
- [ ] Remove all subcollection-based member operations
- [ ] Clean up unused imports and types
- [ ] Update documentation

## Benefits & Risk Analysis

### Key Benefits

1. **Solves Core Pagination Problem**: Users can finally see groups ordered by activity
2. **Improved Performance**: Direct membership queries instead of complex collectionGroup
3. **Better Scalability**: Top-level collection scales better than nested subcollections  
4. **Zero Complexity**: No denormalization means no sync issues
5. **Zero Downtime**: Dual-write ensures continuous service during migration

### Risk Assessment

#### Low Risk ✅
- **No Data Loss**: No existing data to lose or migrate
- **No Service Disruption**: Direct implementation without migration complexity
- **Breaking Changes**: Can maintain API compatibility

#### Medium Risk ⚠️
- **In-Memory Sorting**: Groups sorted in memory instead of database
- **Code Changes**: Multiple services need updates to use new collection

#### Mitigation Strategies
1. **Comprehensive Testing**: Unit, integration, and end-to-end tests
2. **Performance Testing**: Ensure in-memory sorting performs adequately
3. **Staged Implementation**: Update services incrementally
4. **Monitoring**: Track query performance and error rates

### Success Metrics

#### Primary Success Metric
**✅ Pagination Tests Work Reliably**: The core success criteria is that our pagination tests consistently pass with proper group ordering by activity.

#### Supporting Metrics
- **Query Performance**: Group list queries complete in reasonable time (< 500ms)
- **Ordering Accuracy**: 100% correct activity-based ordering (groups ordered by most recently updated)
- **Pagination Consistency**: Cursor-based pagination works correctly across page boundaries
- **Data Integrity**: No membership data inconsistencies between operations

#### Test Success Criteria
- [ ] **Pagination E2E Tests Pass**: Users can navigate through pages of groups in correct order
- [ ] **Cursor Pagination Works**: `nextCursor` values enable proper page traversal  
- [ ] **Activity Ordering Correct**: Most recently updated groups appear first
- [ ] **No Pagination Gaps**: Groups don't disappear or duplicate across pages
- [ ] **Concurrent Updates Handle Gracefully**: Pagination remains stable during group updates

## Timeline Summary

| Phase | Duration | Key Activities | Risk Level |
|-------|----------|---------------|------------|
| **Setup** | Day 1 | Schema, indexes, update membership operations | Low |
| **Read Updates** | Day 2 | Update query operations, maintain subcollection compatibility | Medium |  
| **Testing** | Day 3 | Comprehensive testing, rollback preparation | Medium |

## Rollback Plan

Since we're completely replacing subcollections with top-level collection, we need a comprehensive rollback strategy:

### Immediate Rollback (During Development)
1. **Keep Subcollection Code**: Maintain existing subcollection operations in separate methods during development
2. **Feature Flag**: Use environment variable to switch between old/new implementations
3. **Dual Write Initially**: Write to both collections during testing phase

### Emergency Rollback (Production Issues)
If issues arise after deployment:

#### Step 1: Code Rollback
```typescript
// Add feature flag to GroupService
async listGroups(userId: string, options: any) {
    if (process.env.USE_LEGACY_MEMBERSHIP_QUERIES === 'true') {
        return this._listGroupsLegacy(userId, options); // Old subcollection method
    }
    return this._listGroupsNew(userId, options); // New top-level collection method
}

// Keep legacy methods available
private async _listGroupsLegacy(userId: string, options: any) {
    // Original subcollection-based implementation
    const membershipQuery = this.db.collectionGroup('members')
        .where('userId', '==', userId);
    // ... existing logic
}
```

#### Step 2: Data Recovery
```typescript
// Emergency function to recreate subcollection data from top-level collection
export const recreateSubcollectionData = functions.https.onCall(async (data, context) => {
    if (!isAdmin(context.auth?.uid)) {
        throw new functions.https.HttpsError('permission-denied', 'Admin required');
    }

    const memberships = await db.collection('group-memberships').get();
    
    for (const membershipDoc of memberships.docs) {
        const membership = membershipDoc.data();
        
        // Recreate subcollection document
        const subcollectionRef = db
            .collection('groups')
            .doc(membership.groupId)
            .collection('members')
            .doc(membership.userId);
            
        await subcollectionRef.set({
            userId: membership.userId,
            groupId: membership.groupId,
            memberRole: membership.memberRole,
            memberStatus: membership.memberStatus,
            joinedAt: membership.joinedAt,
            theme: membership.theme,
            invitedBy: membership.invitedBy,
            createdAt: membership.createdAt,
            updatedAt: membership.updatedAt,
        });
    }
});
```

#### Step 3: Clean Rollback
1. **Deploy Legacy Code**: Revert to subcollection-based operations
2. **Set Environment Flag**: `USE_LEGACY_MEMBERSHIP_QUERIES=true`
3. **Verify Functionality**: Ensure all operations work with subcollections
4. **Data Cleanup**: Remove top-level collection documents after verification

### Rollback Testing
- [ ] Test rollback procedure in staging environment
- [ ] Verify data consistency after rollback
- [ ] Ensure performance matches pre-migration levels
- [ ] Test all membership operations work with legacy code

## Next Steps

1. **Get Approval**: Confirm approach with team
2. **Deploy Indexes**: Add required Firestore indexes 
3. **Implement Changes**: Update membership operations with transactional denormalization
4. **Test Pagination**: Verify pagination tests pass consistently 
5. **Deploy with Rollback Ready**: Keep legacy code available via feature flags

## Success Definition

**The migration is successful when our pagination tests work reliably** - users can consistently navigate through their groups ordered by most recent activity, with proper cursor-based pagination that doesn't skip or duplicate groups.

This solves the core problem: **broken group pagination due to Firestore collectionGroup limitations**. The minimal denormalization approach (just `groupUpdatedAt`) provides the database-level ordering we need while maintaining transactional consistency.