# Implement Comprehensive Group `updatedAt` Tracking

## 1. Overview

Currently, the group's `updatedAt` field is only updated when group metadata (name, description, settings) changes. It does NOT update when:
- Expenses are created, updated, or deleted
- Settlements are created, updated, or deleted
- Members are added or removed

This creates an inconsistent "last activity" timestamp. We currently query for the most recent expense to display activity, which is wasteful and incomplete (doesn't account for settlements or member changes).

## 2. The Problem: Incomplete Activity Tracking

### Current Behavior
- `group.updatedAt` only reflects metadata changes
- `lastActivity` display requires a separate database query to find the most recent expense
- Settlement activity and member changes are not reflected in "last activity"
- No single source of truth for "when was this group last touched?"

### Business Impact
- **User Confusion**: Groups with recent settlements or member changes show stale "last activity"
- **Wasted Resources**: Extra database query (even if optimized to `limit: 1`) on every group list
- **Incomplete Information**: Activity timestamp doesn't reflect full group activity

## 3. The Solution: Update Group on Every Change

### 3.1. Core Principle

**Every operation that modifies group-related data must atomically update the group's `updatedAt` timestamp.**

This creates a single source of truth for group activity that includes:
- Expense operations (create, update, delete)
- Settlement operations (create, update, delete)
- Member operations (add, remove)
- Comment operations (create, update, delete)
- Group metadata changes (name, description, settings)

### 3.2. Implementation Strategy

#### Phase 1: Add `touchGroup()` Helper Method

Create a centralized method in `FirestoreWriter` for updating group timestamp:

```typescript
// firebase/functions/src/services/firestore/IFirestoreWriter.ts
interface IFirestoreWriter {
    // ... existing methods

    /**
     * Update a group's updatedAt timestamp to mark activity
     * Use this whenever any group-related operation occurs
     * @param groupId - The group ID
     * @param transaction - Optional transaction to perform update within
     */
    touchGroup(groupId: string, transaction?: Transaction): Promise<void>;
}
```

```typescript
// firebase/functions/src/services/firestore/FirestoreWriter.ts
async touchGroup(groupId: string, transaction?: Transaction): Promise<void> {
    const now = Timestamp.now();

    if (transaction) {
        // Within transaction - use transaction.update
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
        transaction.update(groupRef, { updatedAt: now });
    } else {
        // Standalone update
        await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).update({
            updatedAt: now,
        });
    }
}
```

#### Phase 2: Update All Group-Modifying Operations

##### Expense Operations

**ExpenseService.ts**
```typescript
// createExpense() - After creating expense in transaction
await this.firestoreWriter.touchGroup(expense.groupId, transaction);

// updateExpense() - After updating expense in transaction
await this.firestoreWriter.touchGroup(expense.groupId, transaction);

// deleteExpense() - After soft-deleting expense in transaction
await this.firestoreWriter.touchGroup(expense.groupId, transaction);
```

##### Settlement Operations

**SettlementService.ts**
```typescript
// createSettlement() - After creating settlement
await this.firestoreWriter.touchGroup(settlement.groupId);

// updateSettlement() - After updating settlement
await this.firestoreWriter.touchGroup(settlement.groupId);

// deleteSettlement() - After deleting settlement
await this.firestoreWriter.touchGroup(settlement.groupId);
```

##### Member Operations

**GroupMemberService.ts**
```typescript
// addMember() - After adding member in transaction
await this.firestoreWriter.touchGroup(groupId, transaction);

// removeMember() - After removing member in transaction
await this.firestoreWriter.touchGroup(groupId, transaction);
```

##### Comment Operations

**CommentService.ts**
```typescript
// createComment() - After creating comment
await this.firestoreWriter.touchGroup(groupId);

// updateComment() - After updating comment
await this.firestoreWriter.touchGroup(groupId);

// deleteComment() - After deleting comment
await this.firestoreWriter.touchGroup(groupId);
```

#### Phase 3: Simplify GroupService

Remove the expensive database query for last expense time:

**Before:**
```typescript
// GroupService.ts - addComputedFields()
const lastExpenseTime = await this.expenseMetadataService.getLastExpenseTime(group.id);

return {
    ...group,
    balance: validatedBalanceDisplay,
    lastActivity: lastExpenseTime
        ? `Last expense ${lastExpenseTime.toLocaleDateString()}`
        : 'No recent activity',
};
```

**After:**
```typescript
// GroupService.ts - addComputedFields()
return {
    ...group,
    balance: validatedBalanceDisplay,
    lastActivity: group.updatedAt
        ? `Last activity ${new Date(group.updatedAt).toLocaleDateString()}`
        : 'No recent activity',
};
```

#### Phase 4: Remove ExpenseMetadataService

The entire service becomes unnecessary:

```typescript
// DELETE: firebase/functions/src/services/expenseMetadataService.ts
// DELETE: firebase/functions/src/__tests__/unit/services/ExpenseMetadataService.test.ts
// REMOVE: expenseMetadataService dependency from GroupService constructor
// REMOVE: expenseMetadataService from ApplicationBuilder
```

### 3.3. Transaction Considerations

**Critical**: When operations use transactions, `touchGroup()` must be called within the same transaction:

```typescript
// CORRECT - Within transaction
await this.firestoreWriter.runTransaction(async (transaction) => {
    // Create/update/delete operation
    this.firestoreWriter.createInTransaction(transaction, collection, id, data);

    // Touch group in same transaction
    await this.firestoreWriter.touchGroup(groupId, transaction);
});

// INCORRECT - Outside transaction (race condition!)
await this.firestoreWriter.runTransaction(async (transaction) => {
    this.firestoreWriter.createInTransaction(transaction, collection, id, data);
});
await this.firestoreWriter.touchGroup(groupId); // ❌ Not atomic!
```

### 3.4. Benefits

#### Performance Improvements
- **Eliminate database query**: No more "find most recent expense" query on every group list
- **O(1) timestamp access**: Reading `group.updatedAt` from already-fetched group document
- **Faster group listings**: Especially for users with many groups

#### Correctness Improvements
- **Complete activity tracking**: Settlements and member changes now reflected
- **Single source of truth**: `group.updatedAt` definitively tracks last activity
- **Consistent semantics**: "Last activity" means what users expect

#### Code Quality Improvements
- **Simpler codebase**: Remove entire `ExpenseMetadataService`
- **Clear intent**: `touchGroup()` makes activity tracking explicit
- **Easier maintenance**: Single pattern for all group operations

## 4. Implementation Steps

### Step 1: Add `touchGroup()` Method
- [ ] Add method to `IFirestoreWriter` interface
- [ ] Implement in `FirestoreWriter` with transaction support
- [ ] Write unit tests for `touchGroup()` (standalone and transactional)

### Step 2: Update Expense Operations
- [ ] Add `touchGroup()` call to `createExpense()`
- [ ] Add `touchGroup()` call to `updateExpense()`
- [ ] Add `touchGroup()` call to `deleteExpense()`
- [ ] Verify all calls are within existing transactions

### Step 3: Update Settlement Operations
- [ ] Add `touchGroup()` call to `createSettlement()`
- [ ] Add `touchGroup()` call to `updateSettlement()`
- [ ] Add `touchGroup()` call to `deleteSettlement()`
- [ ] Add transaction support if not already present

### Step 4: Update Member Operations
- [ ] Add `touchGroup()` call to `addMember()`
- [ ] Add `touchGroup()` call to `removeMember()`
- [ ] Verify calls are within existing transactions

### Step 5: Update Comment Operations
- [ ] Add `touchGroup()` call to `createComment()`
- [ ] Add `touchGroup()` call to `updateComment()`
- [ ] Add `touchGroup()` call to `deleteComment()`

### Step 6: Simplify GroupService
- [ ] Update `addComputedFields()` to use `group.updatedAt` directly
- [ ] Remove `expenseMetadataService` dependency from constructor
- [ ] Update tests to not expect expense queries

### Step 7: Remove ExpenseMetadataService
- [ ] Delete `expenseMetadataService.ts`
- [ ] Delete `ExpenseMetadataService.test.ts`
- [ ] Remove from `ApplicationBuilder.ts`
- [ ] Verify no other references exist

### Step 8: Integration Testing
- [ ] Test expense create updates group timestamp
- [ ] Test settlement create updates group timestamp
- [ ] Test member add updates group timestamp
- [ ] Test "last activity" display uses group timestamp
- [ ] Test group listings don't query expenses

## 5. Edge Cases & Considerations

### Race Conditions
**Problem**: Multiple concurrent operations updating the same group's timestamp

**Solution**: Firestore's `update()` is atomic - last write wins. This is acceptable since we only care about "something changed recently", not precise ordering.

### Backfill Existing Groups
**Problem**: Existing groups may have stale `updatedAt` if last activity was expense/settlement

**Solution**: Optional one-time migration script:
```typescript
// For each group, set updatedAt to max of:
// - Current group.updatedAt
// - Most recent expense.createdAt
// - Most recent settlement.createdAt
// - Most recent member.joinedAt
```

### Performance Impact
**Impact**: Every write operation adds one additional `update()` call

**Analysis**:
- **Cost**: ~1 additional write per operation (minimal)
- **Benefit**: Eliminates 1 read per group list (significant for multi-group users)
- **Net**: Positive - writes are rarer than reads

### Failed Operations
**Problem**: What if the primary operation succeeds but `touchGroup()` fails?

**Solution**: Use transactions where possible. For non-transactional operations, `touchGroup()` failure is logged but doesn't block the operation (timestamp staleness is better than operation failure).

## 6. Testing Strategy

### Unit Tests
```typescript
describe('touchGroup', () => {
    it('should update group updatedAt timestamp', async () => {
        const groupId = 'test-group';
        await firestoreWriter.touchGroup(groupId);

        const group = await firestoreReader.getGroup(groupId);
        expect(group.updatedAt).toBeDefined();
        // Verify timestamp is recent (within last second)
    });

    it('should work within transaction', async () => {
        await firestoreWriter.runTransaction(async (transaction) => {
            await firestoreWriter.touchGroup(groupId, transaction);
        });

        // Verify group timestamp updated
    });
});

describe('expense operations update group timestamp', () => {
    it('should update group timestamp when creating expense', async () => {
        const groupBefore = await firestoreReader.getGroup(groupId);

        await expenseService.createExpense(userId, expenseData);

        const groupAfter = await firestoreReader.getGroup(groupId);
        expect(groupAfter.updatedAt).toBeGreaterThan(groupBefore.updatedAt);
    });
});
```

### Integration Tests
```typescript
it('should display last activity based on group.updatedAt', async () => {
    // Create group
    const group = await createTestGroup();

    // Add expense
    await createTestExpense(group.id);

    // Fetch group with computed fields
    const groupWithFields = await groupService.getGroup(group.id, userId);

    // Verify lastActivity uses group.updatedAt (not expense query)
    expect(groupWithFields.lastActivity).toContain('Last activity');
    // Verify no expense query was made (check mock call counts)
});
```

## 7. Migration Plan

### Phase 1: Add Infrastructure (Non-Breaking)
- Implement `touchGroup()` method
- Add to all write operations
- Deploy to production
- **Result**: Groups start tracking activity, old timestamps remain

### Phase 2: Update UI Logic (Non-Breaking)
- Update `GroupService.addComputedFields()` to use `group.updatedAt`
- Deploy to production
- **Result**: UI uses new timestamps for recent changes, falls back gracefully for old data

### Phase 3: Cleanup (Non-Breaking)
- Remove `ExpenseMetadataService`
- Remove unused code
- Deploy to production
- **Result**: Cleaner codebase, better performance

### Phase 4: Backfill (Optional)
- Run migration script to update old group timestamps
- **Result**: Consistent timestamps across all groups

## 8. Acceptance Criteria

- ✅ Creating an expense updates the group's `updatedAt` timestamp
- ✅ Creating a settlement updates the group's `updatedAt` timestamp
- ✅ Adding a member updates the group's `updatedAt` timestamp
- ✅ Updating/deleting any of the above updates the group's `updatedAt` timestamp
- ✅ Group listings no longer query for recent expenses
- ✅ "Last activity" display uses `group.updatedAt` instead of querying expenses
- ✅ All operations within transactions maintain atomicity
- ✅ Performance improves for group listing operations
- ✅ `ExpenseMetadataService` is removed from codebase

## 9. Related Tasks

- **Depends on**: None - can be implemented independently
- **Blocks**: Performance optimizations in group listing
- **Related to**:
  - `bug-incomplete-pagination-in-balance-calculation.md` - This removes one expensive query
  - `performance-slow-balance-calculation-for-active-groups.md` - Reduces overhead in group listings

## 10. Future Enhancements

### More Granular Activity Tracking
Instead of just `updatedAt`, track specific activity types:
```typescript
interface GroupActivityMetadata {
    lastExpenseAt?: Timestamp;
    lastSettlementAt?: Timestamp;
    lastMemberChangeAt?: Timestamp;
    lastCommentAt?: Timestamp;
}
```

This would enable UI features like:
- "3 new expenses since you last checked"
- Filter groups by "has recent settlements"
- Activity timeline

### Activity Events Stream
Instead of just updating timestamps, emit activity events that can be consumed by:
- Real-time notifications
- Activity feeds
- Analytics
- Audit logs

**Note**: These are future enhancements - the current task focuses on the simple, correct solution of tracking `updatedAt` on all operations.
