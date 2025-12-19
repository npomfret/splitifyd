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

These are not bugs but will cause performance degradation at scale. Defer until usage warrants.

### 1) Comment listing N+1 (Low)

**Location:** `CommentService.ts:68-76, :103-111`

Each comment fetches user reactions individually. At limit=100, this is 100 reads.

**Mitigation:** Batch lookup by comment IDs, or denormalize user reactions into comment documents.

**Current mitigation:** Default page size is 8.

---

### 2) Settlement listing N+1 (Low)

**Location:** `SettlementService.ts:650-678`

Each settlement makes 3 reads (payer profile, payee profile, user reactions).

**Mitigation:**
- Collect unique user IDs from page, batch-fetch profiles with `getAll()`
- Batch reactions similarly

**Current mitigation:** Reads are parallelized per settlement.

---

### 3) Group list balance reads (Low)

**Location:** `GroupService.ts:275-289`

Each group fetches its balance document separately.

**Mitigation:** Use Firestore `getAll()` to batch-read all balance documents for the page.

**Current mitigation:** Reads are parallelized.

---

## Summary

| Issue | Severity | Effort | Status |
|-------|----------|--------|--------|
| labels typo | High | Low | ✅ Fixed |
| Join race condition | Medium | Medium | ✅ Fixed |
| Leave/remove balance race | Medium | Medium | ✅ Fixed |
| Comment N+1 | Low | Medium | — |
| Settlement N+1 | Low | Medium | — |
| Group balance N+1 | Low | Low | — |
