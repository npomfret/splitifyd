# Firebase TypeScript Audit

## Scope
`firebase/functions/src`

---

## Bugs

### 1) ~~Expense list query drops labels~~ ✅ FIXED

**Location:** `FirestoreReader.ts:1518`

The `.select()` call used `'label'` (singular) but the schema and DTO use `labels` (plural array).

**Resolution:**
- Changed `'label'` to `'labels'` in the select clause
- Added unit test: `expenses.test.ts` → "should include labels in listed expenses"
- Added integration test: `expense-locking.test.ts` → "should include labels in expense list response"

---

### 2) ~~Join-by-link race condition~~ ✅ FIXED

**Location:** `GroupShareService.ts:456-468`

Display name conflict check and `MAX_GROUP_MEMBERS` check happened before the transaction. The `membershipsSnapshot` fetched inside the transaction was available but not used to re-validate.

**Impact:** Concurrent joins could exceed group capacity or create duplicate display names.

**Resolution:**
- Added capacity re-validation inside transaction: `if (membershipsSnapshot.size >= MAX_GROUP_MEMBERS) throw ...`
- Added display name conflict re-validation inside transaction by scanning `membershipsSnapshot` docs
- Pre-transaction checks retained for fast fail in non-race scenarios
- Added integration test: `concurrent-operations.integration.test.ts` → "should prevent duplicate display names when two users join concurrently with the same name"

---

### 3) ~~Leave/remove member balance race~~ ✅ FIXED

**Location:** `GroupMemberService.ts:507-522`

Balance check happened before the transaction that deletes membership. A concurrent expense/settlement could change the balance between check and delete.

**Impact:** Users could be removed with non-zero balance.

**Resolution:**
- Added balance re-validation inside the transaction using `getGroupBalanceInTransaction()`
- This adds the balance document to the transaction's read set, so Firestore's optimistic concurrency catches conflicts
- Pre-transaction check retained for fast fail in non-race scenarios
- Added integration test: `concurrent-operations.integration.test.ts` → "should prevent member leaving with outstanding balance when expense is created concurrently"

---

## Scaling Risks

Fix via schema denormalization. No existing users or data, so we can restructure freely.

### 1) Comment/Settlement/Expense Reactions N+1 🔧 IN PROGRESS

**Problem:** Each item fetches user reactions from subcollection individually.

**Locations:**
- `CommentService.ts:68-76, :103-111`
- `SettlementService.ts:650-678`

**Solution:** Denormalize `userReactions` into parent documents.

**Schema change:**
```
# Current (N+1 problem):
groups/{groupId}/comments/{commentId}/reactions/{userId}_{emoji}
settlements/{settlementId}/reactions/{userId}_{emoji}

# New (O(1) reads):
Store on parent doc: userReactions: Record<UserId, ReactionEmoji[]>
```

**API change:**
- Old: `userReactions: ReactionEmoji[]` (current user only)
- New: `userReactions: Record<UserId, ReactionEmoji[]>` (all users - more social)

**Files to modify:**
- `packages/shared/src/shared-types.ts` - Change `userReactions` type
- `packages/shared/src/schemas/apiSchemas.ts` - Update response schemas
- `firebase/functions/src/schemas/*.ts` - Update document schemas
- `firebase/functions/src/services/ReactionService.ts` - Write `userReactions` map on toggle
- `firebase/functions/src/services/firestore/FirestoreReader.ts` - Remove `getUserReactionsFor*` methods
- `firebase/functions/src/services/CommentService.ts` - Remove reaction fetching loop
- `firebase/functions/src/services/SettlementService.ts` - Remove reaction fetching loop
- `webapp-v2/src/app/components/` - Update reaction display for new shape

---

### 2) Group list balance reads N+1 🔧 IN PROGRESS

**Problem:** Each group fetches balance from subcollection individually.

**Location:** `GroupService.ts:275-289`

**Solution:** Move balances to top-level collection for batch queries.

**Schema change:**
```
# Current (N+1 problem):
groups/{groupId}/metadata/balance

# New (batch-queryable):
balances/{groupId}
```

**Files to modify:**
- `firebase/functions/src/services/firestore/FirestoreReader.ts` - Add `getBalancesByGroupIds()` using `getAll()`
- `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Update balance write path
- `firebase/functions/src/services/firestore/IFirestoreReader.ts` - Update interface
- `firebase/functions/src/services/GroupService.ts` - Use batch balance fetch
- `firebase/firestore.rules` - Add `balances` collection rules

---

## Summary

| Issue | Severity | Effort | Status |
|-------|----------|--------|--------|
| labels typo | High | Low | ✅ Fixed |
| Join race condition | Medium | Medium | ✅ Fixed |
| Leave/remove balance race | Medium | Medium | ✅ Fixed |
| Reactions N+1 | Low | Medium | 🔧 In Progress |
| Group balance N+1 | Low | Low | 🔧 In Progress |
