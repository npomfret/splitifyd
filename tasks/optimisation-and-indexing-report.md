# Optimisation and Indexing Report

## 1. Overview

This report details findings from a review of the `firebase/functions` codebase, focusing on two key areas: Firestore transaction optimizations and Firestore query indexing requirements. The goal is to improve the performance, scalability, and reliability of the backend services.

## 2. Transaction Optimisations

A potential race condition was identified in the `GroupPermissionService`.

### Issue: Missing Transactions in `GroupPermissionService`

-   **Files Affected**: `firebase/functions/src/services/GroupPermissionService.ts`
-   **Methods**: `_applySecurityPreset`, `_updateGroupPermissions`, `_setMemberRole`

**Problem**: These methods currently perform a "read-then-write" operation without wrapping the logic in a Firestore transaction. For example, they fetch a group document, check permissions, and then write updates back to the document. If two users (e.g., two admins) perform one of these actions concurrently, one of the updates could be overwritten and lost.

**Example (`_setMemberRole`):**
1.  Admin A reads the group document.
2.  Admin B reads the same group document.
3.  Admin A updates a member's role and writes the changes.
4.  Admin B, holding the old document state, updates a different member's role and writes the changes, inadvertently overwriting Admin A's update.

**Recommendation**:
Refactor these methods to use Firestore transactions with optimistic locking. This involves:
1.  Wrapping the read and write operations in `firestoreDb.runTransaction()`.
2.  Reading the document's `updatedAt` timestamp at the beginning of the transaction.
3.  Before writing, re-reading the document and comparing the current `updatedAt` timestamp with the original one. If they don't match, the transaction should fail, preventing the overwrite.

This pattern is already successfully implemented in `ExpenseService.ts` and `SettlementService.ts` and should be applied here for consistency and data integrity.

## 3. Firestore Query Indexing

Several complex queries were identified that will require composite indexes in Firestore to function correctly and performantly in a production environment. The Firebase Emulator typically logs warnings for missing indexes, but they are documented here for clarity and action.

### 3.1. CRITICAL: User Group Membership Query

-   **Service**: `UserService2.ts`
-   **Method**: `listGroups`
-   **Query**: `firestoreDb.collection('groups').where('members.<userId>', '!=', null)`
-   **Problem**: This query is a major scalability bottleneck. It requires a unique composite index for every single user in the system. This will quickly exceed Firestore's index limits and is not a viable long-term solution.
-   **Recommendation**: **This requires immediate attention.** The architecture must be migrated to use a `members` subcollection under each group, as detailed in the `tasks/firestore-membership-query-scalability.md` document. This will allow for a single, scalable `collectionGroup` index.

### 3.2. Expense Queries

-   **Service**: `ExpenseService.ts`
-   **Method**: `listGroupExpenses`
-   **Query**: `.where('groupId', '==', ...).where('deletedAt', '==', null).orderBy('date', 'desc').orderBy('createdAt', 'desc')`
-   **Index Required**: A composite index on the `expenses` collection:
    - `groupId` (Ascending)
    - `deletedAt` (Ascending)
    - `date` (Descending)
    - `createdAt` (Descending)

-   **Service**: `ExpenseService.ts`
-   **Method**: `listUserExpenses`
-   **Query**: `.where('participants', 'array-contains', ...).where('deletedAt', '==', null).orderBy('date', 'desc').orderBy('createdAt', 'desc')`
-   **Index Required**: A composite index on the `expenses` collection:
    - `participants` (Array)
    - `deletedAt` (Ascending)
    - `date` (Descending)
    - `createdAt` (Descending)

### 3.3. Settlement Query

-   **Service**: `SettlementService.ts`
-   **Method**: `listSettlements`
-   **Query**: Can combine `groupId`, `participants` (array-contains), and a `date` range with ordering.
-   **Index Required**: A composite index on the `settlements` collection to support the most common filtering combination:
    - `groupId` (Ascending)
    - `participants` (Array)
    - `date` (Descending)

### 3.4. Share Link Query

-   **Service**: `GroupShareService.ts`
-   **Method**: `findShareLinkByToken`
-   **Query**: `collectionGroup('shareLinks').where('token', '==', ...).where('isActive', '==', true)`
-   **Index Required**: A `collectionGroup` index on the `shareLinks` subcollection:
    - `token` (Ascending)
    - `isActive` (Ascending)

## 4. Critical Analysis & Architectural Insights

### 4.1. Transaction Race Condition Analysis

**Current Problem**: The `GroupPermissionService` methods perform "read-then-write" operations without transaction protection, creating potential race conditions where concurrent admin actions could result in lost updates.

**Evidence**: Methods like `_setMemberRole` (lines 201-267), `_applySecurityPreset` (lines 59-117), and `_updateGroupPermissions` (lines 131-185) all follow this pattern:
1. Read group document at line ~72/143/215  
2. Validate permissions/state
3. Update document at line ~103/172/251

**Risk Assessment**: 
- **High** for groups with multiple active admins
- **Medium** impact - could result in permission changes being silently lost
- **Low** frequency - requires exact timing of concurrent admin actions

### 4.2. Membership Query Scalability Crisis

**Current Reality**: Despite previous documentation claiming the scalability issue was resolved, `UserService2.ts:395` still contains the problematic query pattern that requires per-user indexes.

**Technical Debt**: The codebase shows evidence of partial refactoring that addressed API layers but left the underlying storage architecture unchanged, creating a maintenance burden and scalability time bomb.

**Impact Projection**: 
- **Immediate**: Works fine with current user base
- **Short-term** (100-500 users): Query performance degradation  
- **Medium-term** (1000+ users): Firestore index limit concerns
- **Long-term**: Service failure due to index limits

### 4.3. Existing Index Coverage Analysis

**Current State**: `firestore.indexes.json` shows partial index coverage:
- ✅ ShareLinks collectionGroup index already exists (lines 110-122)
- ❌ Missing expense composite indexes for `deletedAt` filtering
- ❌ Missing settlement composite indexes
- ❌ Missing the critical membership collectionGroup index

## 5. Detailed Implementation Plan

### Phase 1: Transaction Safety Implementation (Priority: HIGH, Effort: 2-3 days)

#### 5.1.1. Add Optimistic Locking to GroupPermissionService

**Target Methods**: `_setMemberRole`, `_applySecurityPreset`, `_updateGroupPermissions`

**Implementation Pattern** (following `ExpenseService.ts:326-365`):

```typescript
// Example for _setMemberRole method
private async _setMemberRole(userId: string, groupId: string, targetUserId: string, role: any) {
    const groupDocRef = this.getGroupsCollection().doc(groupId);
    
    // Initial read outside transaction for permission checks
    const groupDoc = await groupDocRef.get();
    if (!groupDoc.exists) throw Errors.NOT_FOUND('Group');
    
    const group = transformGroupDocument(groupDoc);
    const originalUpdatedAt = group.updatedAt; // Store for optimistic locking
    
    // Perform permission validations...
    
    // Use transaction with optimistic locking
    await firestoreDb.runTransaction(async (transaction) => {
        // Re-fetch within transaction
        const groupDocInTx = await transaction.get(groupDocRef);
        if (!groupDocInTx.exists) throw Errors.NOT_FOUND('Group');
        
        const currentData = groupDocInTx.data();
        if (!currentData) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'INVALID_GROUP', 'Group data is missing');
        
        // Optimistic locking check
        const currentTimestamp = currentData.updatedAt;
        if (!currentTimestamp || !originalUpdatedAt || !currentTimestamp.isEqual(originalUpdatedAt)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 
                'Group was modified by another user. Please refresh and try again.');
        }
        
        // Perform the update
        const updateData = {
            [`members.${targetUserId}.role`]: role,
            [`members.${targetUserId}.lastPermissionChange`]: now,
            updatedAt: createServerTimestamp(),
            // ... other fields
        };
        
        transaction.update(groupDocRef, updateData);
    });
}
```

**Files to Modify**:
- `firebase/functions/src/services/GroupPermissionService.ts`

**Testing Requirements**:
- Add concurrent admin action test cases
- Verify conflict detection works correctly
- Ensure no data loss under concurrent load

#### 5.1.2. Consolidate Transaction Retry Logic

**Current Issue**: The codebase has inconsistent transaction handling:
- ✅ 1 service using `runTransactionWithRetry()` (GroupShareService)  
- ❌ 9 services using direct `runTransaction()` calls

**Recommendation**: Consolidate all transaction calls to use `runTransactionWithRetry()` for consistency and improved reliability.

**Services to Update**:
- `ExpenseService.ts` (3 transactions)
- `SettlementService.ts` (2 transactions) 
- `GroupService.ts` (1 transaction)
- `TestUserPoolService.ts` (2 transactions)
- `assign-theme-color.ts` (1 transaction)

**Benefits**:
- Better error context and logging
- Automatic retry with exponential backoff
- Improved reliability in Firebase emulator
- Consistent transaction patterns across codebase

**Implementation**:
```typescript
// REPLACE direct runTransaction calls like this:
await firestoreDb.runTransaction(async (transaction) => {
    // transaction logic
});

// WITH runTransactionWithRetry:
await runTransactionWithRetry(
    async (transaction) => {
        // same transaction logic
    },
    {
        maxAttempts: 3,
        context: {
            operation: 'operationName',
            userId,
            groupId // relevant context
        }
    }
);
```

#### 5.1.3. Add Missing Firestore Indexes

**Action**: Update `firebase/firestore.indexes.json` with missing composite indexes:

```json
{
  "indexes": [
    // ... existing indexes ...
    
    // NEW: Expense queries with deletedAt filtering
    {
      "collectionGroup": "expenses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "expenses", 
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "participants", "arrayConfig": "CONTAINS" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    
    // NEW: Settlement queries
    {
      "collectionGroup": "settlements",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "participants", "arrayConfig": "CONTAINS" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deployment**: Indexes must be deployed before code that uses them.

### Phase 2: Membership Scalability Solution (Priority: CRITICAL, Effort: 8-12 days)

#### ⚠️ IMPORTANT: MIGRATION ALREADY IN PROGRESS

**DO NOT IMPLEMENT**: The migration from embedded member maps to subcollections is **already in progress** by another team/developer. This implementation plan serves as documentation of what needs to be completed, but should not be actively implemented to avoid conflicts.

**Status**: Monitor progress and coordinate with existing migration efforts.

#### 5.2.1. Architecture Decision Analysis

**Key Insight**: Based on analysis of `tasks/firestore-membership-query-scalability.md`, the scalability problem requires a fundamental shift from embedded member maps to subcollections.

**Implementation Strategy**: 
- Use the existing `GroupMemberService` rather than creating parallel services
- Implement dual-write pattern during migration
- Follow the "no backward compatibility" principle for clean cutover

#### 5.2.2. Detailed Migration Plan

**Phase 2A: Infrastructure (2-3 days)**

1. **Add Membership Subcollection Index**
   ```json
   {
     "collectionGroup": "members",
     "queryScope": "COLLECTION_GROUP",
     "fields": [
       { "fieldPath": "userId", "order": "ASCENDING" }
     ]
   }
   ```

2. **Create Migration Utility**
   ```typescript
   // firebase/functions/src/migrations/member-subcollection-migration.ts
   export class MemberSubcollectionMigration {
     async migrateGroupMembers(groupId: string): Promise<void> {
       const groupDoc = await firestoreDb.collection('groups').doc(groupId).get();
       const members = groupDoc.data()?.members || {};
       
       const batch = firestoreDb.batch();
       Object.entries(members).forEach(([userId, memberData]) => {
         const memberRef = firestoreDb
           .collection('groups')
           .doc(groupId) 
           .collection('members')
           .doc(userId);
           
         batch.set(memberRef, {
           userId,
           groupId,
           ...memberData,
           migratedAt: FieldValue.serverTimestamp()
         });
       });
       
       await batch.commit();
     }
   }
   ```

3. **Extend GroupMemberService with Async Methods**
   ```typescript
   // Add to existing GroupMemberService.ts
   export class GroupMemberService {
     // ... existing methods ...
     
     // NEW: Async subcollection-based methods
     async getUserGroupsAsync(userId: string): Promise<Group[]> {
       const membersSnapshot = await firestoreDb
         .collectionGroup('members')
         .where('userId', '==', userId) 
         .get();
         
       const groupIds = membersSnapshot.docs.map(doc => doc.data().groupId);
       // Fetch groups in batch...
     }
     
     async addMemberAsync(groupId: string, userId: string, memberData: GroupMember): Promise<void> {
       await firestoreDb
         .collection('groups')
         .doc(groupId)
         .collection('members') 
         .doc(userId)
         .set({
           userId,
           groupId,
           ...memberData,
           joinedAt: FieldValue.serverTimestamp()
         });
     }
   }
   ```

**Phase 2B: Permission System Updates (2-3 days)**

4. **Make PermissionEngine Async**
   - Convert `PermissionEngine.checkPermission()` to async
   - Update all calling code to await permission checks
   - Modify middleware to handle async permission validation

5. **Update Route Handlers**  
   - Convert all permission checks from sync to async
   - Update error handling for async permission failures

**Phase 2C: Service Migration (3-4 days)**

6. **Fix UserService2 Critical Query**
   ```typescript
   // REPLACE this in UserService2.ts:395
   const groupsSnapshot = await firestoreDb.collection(FirestoreCollections.GROUPS)
     .where(`members.${userId}`, '!=', null)
     .get();
     
   // WITH this scalable version
   const groupMemberService = getGroupMemberService();
   const userGroups = await groupMemberService.getUserGroupsAsync(userId);
   ```

7. **Update All Member Operations**
   - Migrate `GroupShareService` to use async member addition
   - Update group creation to use subcollections
   - Convert member role changes to subcollection operations

**Phase 2D: Testing & Deployment (2-3 days)**

8. **Comprehensive Test Updates**
   - Convert all member operation tests to async
   - Add performance tests for new query patterns
   - Verify no regression in functionality

9. **Staged Deployment**
   - Deploy indexes first
   - Run migration script on test data  
   - Deploy code changes with feature flag
   - Monitor performance and rollback capability

#### 5.2.3. Success Criteria

- ✅ `UserService2.listGroups()` uses single collectionGroup query
- ✅ No Firestore index growth with new users
- ✅ Sub-100ms performance for user group queries
- ✅ All existing tests pass with async member operations
- ✅ No API breaking changes for frontend

### Phase 3: Performance Monitoring & Validation (Priority: MEDIUM, Effort: 1-2 days)

#### 5.3.1. Add Performance Metrics

```typescript
// Add to PerformanceMonitor.ts
export class PerformanceMonitor {
  static monitorMembershipQuery(userId: string): Promise<Group[]> {
    const startTime = Date.now();
    
    return this.monitorServiceCall(
      'GroupMemberService',
      'getUserGroups', 
      async () => {
        const groups = await groupMemberService.getUserGroupsAsync(userId);
        const queryTime = Date.now() - startTime;
        
        if (queryTime > 100) {
          logger.warn('Slow membership query detected', {
            userId, 
            queryTimeMs: queryTime,
            groupCount: groups.length
          });
        }
        
        return groups;
      },
      { userId, expectedMaxTimeMs: 100 }
    );
  }
}
```

#### 5.3.2. Index Usage Monitoring

Add monitoring to detect if queries are using proper indexes and alert on full collection scans.

## 6. Risk Assessment & Mitigation

### 6.1. High-Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss during member migration | High | Low | Thorough backup, gradual migration, rollback plan |
| Breaking changes to frontend | High | Medium | Maintain API compatibility, comprehensive testing |
| Performance regression | Medium | Medium | Performance benchmarking, gradual rollout |
| Transaction conflicts under load | Medium | Low | Implement retry logic, monitor conflict rates |

### 6.2. Migration Safety Measures

1. **Backup Strategy**: Full Firestore export before migration
2. **Rollback Plan**: Ability to revert to embedded member structure
3. **Canary Deployment**: Test with subset of groups first
4. **Monitoring**: Real-time alerts on query performance and error rates

## 7. Implementation Status & Priorities

| Phase | Priority | Status | Notes |
|-------|----------|--------|-------|
| Transaction Safety (GroupPermissionService) | HIGH | ✅ **COMPLETED** | Fixed race conditions with optimistic locking |
| Transaction Consolidation | MEDIUM | ⏳ Ready to implement | Standardize retry logic across all services |
| Index Deployment | HIGH | ⏳ Ready to implement | Required for query performance |
| Membership Migration | CRITICAL | 🚧 **IN PROGRESS** | **DO NOT IMPLEMENT** - Already being handled |
| Performance Validation | MEDIUM | ⏸️ Wait for migration completion | Monitor after migration complete |

**Immediately Actionable Work**:
- ✅ ~~Transaction safety fixes for GroupPermissionService~~ **COMPLETED**
- Transaction consolidation across all services
- Missing Firestore index deployment

**Note**: The membership migration work is already being handled by another team/developer and should not be duplicated.
