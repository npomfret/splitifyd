# Firebase TypeScript Audit

## Scope
`firebase/functions/src`

---

## Bugs

### 1) Expense list query drops labels (High)

**Location:** `FirestoreReader.ts:1518`

The `.select()` call uses `'label'` (singular) but the schema and DTO use `labels` (plural array). List responses silently lose label data.

**Fix:** Change `'label'` to `'labels'` in the select clause.

**Why tests don't catch this:**
- Existing label tests (`ExpenseService.test.ts:317`, `expenses.test.ts:361`) verify labels via **single-expense retrieval** (`getExpense`), not via list endpoints
- The list test at `ExpenseHandlers.test.ts:578` creates expenses **without labels** and only checks descriptions
- No test exercises the path: create expense with labels → list expenses → assert labels in response

**Test to add:** Create expense with labels, call `listGroupExpenses`, assert `labels` array is populated in the response.

---

### 2) Join-by-link race condition (Medium)

**Location:** `GroupShareService.ts:402-470`

Display name conflict check (`:403-410`) and `MAX_GROUP_MEMBERS` check (`:415-417`) happen before the transaction. The `membershipsSnapshot` fetched inside the transaction (`:453`) is available but not used to re-validate.

**Impact:** Concurrent joins can exceed group capacity or create duplicate display names.

**Fix:**
1. Move `MAX_GROUP_MEMBERS` check inside transaction: `if (membershipsSnapshot.size >= MAX_GROUP_MEMBERS) throw ...`
2. Check display name conflict against `membershipsSnapshot` data instead of a separate pre-read

**Why tests don't catch this:**
- Capacity tests at `GroupShareService.test.ts:252-275` add members **sequentially**, not concurrently
- The concurrent operations integration test (`concurrent-operations.integration.test.ts:80-97`) runs parallel joins but **accepts that some may fail** without asserting the exact count
- No test simulates: group at MAX-1 capacity → two concurrent join requests → assert exactly one succeeds and one gets GROUP_AT_CAPACITY

**Test to add:** Fill group to MAX-1, then fire two concurrent `joinGroupByLink` calls. Assert one succeeds, one fails with GROUP_AT_CAPACITY, and final member count equals MAX.

---

### 3) Leave/remove member balance race (Medium)

**Location:** `GroupMemberService.ts:427-477`

Balance check (`:427-459`) happens before the transaction that deletes membership (`:477+`). A concurrent expense/settlement can change the balance between check and delete.

**Impact:** Users removed with non-zero balance.

**Fix:** Read balance inside the transaction. The balance document should be included in the transaction read set so Firestore's optimistic concurrency catches conflicts.

**Consideration:** Balance is stored in a separate document (`group_balances/{groupId}`). To make this transactional, either:
- Read the balance doc in the transaction (adds the doc to the transaction's read set)
- Or accept the race as low-probability and log an alert if it ever happens

**Why tests don't catch this:**
- Balance check tests (`GroupMemberService.test.ts`, `SettlementManagement.test.ts`) verify balance enforcement **sequentially**
- Concurrent test at `concurrent-operations.integration.test.ts:181-217` accepts partial failures without asserting balance constraints
- No test simulates: member has zero balance → concurrent expense creation + leave request → assert leave fails OR expense creation is aborted

**Test to add:** Create group with two members, ensure zero balance, then concurrently (1) create expense making member owe money and (2) attempt `leaveGroup`. Assert either leave fails with "outstanding balance" or the expense write is aborted by transaction conflict.

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

| Issue | Severity | Effort | Test Gap |
|-------|----------|--------|----------|
| labels typo | High | Low | Tests use single-fetch, not list |
| Join race condition | Medium | Medium | Tests are sequential, not concurrent |
| Leave/remove balance race | Medium | Medium | Tests are sequential, not concurrent |
| Comment N+1 | Low | Medium | — |
| Settlement N+1 | Low | Medium | — |
| Group balance N+1 | Low | Low | — |
