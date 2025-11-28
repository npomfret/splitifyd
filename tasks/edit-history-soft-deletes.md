# Edit History via Soft Deletes

**Status:** ✅ COMPLETE

Expense edits (and other entity edits) currently overwrite the previous data. This loses the edit history.

**Problem:** No audit trail of changes - can't see what an expense looked like before it was edited.

**Proposal:** Model edits as soft deletes of the old version + creation of a new version, preserving full history.

**Scope:** Expenses and Settlements. No UI changes.

## Implementation Plan

### Data Model Change

Add one nullable field to both `Expense` and `Settlement` interfaces:

```typescript
supersededBy: ExpenseId | null;  // For expenses
supersededBy: SettlementId | null;  // For settlements
```

- `null` = current/active version
- Non-null = this record was replaced by the referenced ID
- Existing `deletedAt` pattern unchanged (for user-initiated deletions)

### Edit Flow Change

**Current flow:**
1. Update expense document in-place
2. Update balance (old -> new transition)
3. Return 204 No Content

**New flow:**
1. Soft-delete old expense (set `supersededBy` to new ID, set `deletedAt`)
2. Create new expense document with new ID
3. Update balance (same old -> new transition, already supported)
4. Return 200 with `{ id: newExpenseId }` so clients know the new ID

### Delete Flow Change

**New constraint:** Cannot delete an expense/settlement that has `supersededBy` set (it's already been superseded/archived).

- Check `supersededBy` field before allowing deletion
- If `supersededBy !== null`, return 400 with error "Cannot delete a superseded record"
- Only current (non-superseded) versions can be deleted by users

### Files to Modify

1. **Types** (`packages/shared/src/shared-types.ts`)
   - Add `supersededBy` to `Expense` interface (nullable ExpenseId)
   - Add `supersededBy` to `Settlement` interface (nullable SettlementId)

2. **Schemas** (`firebase/functions/src/schemas/`)
   - `expense.ts`: Add `supersededBy` field to ExpenseDocumentSchema
   - `settlement.ts`: Add `supersededBy` field to SettlementDocumentSchema

3. **Services**
   - `ExpenseService.ts`: Modify `updateExpense()` and add guard to `deleteExpense()`
   - `SettlementService.ts`: Modify `updateSettlement()` and add guard to `softDeleteSettlement()`

4. **API Interface** (`packages/shared/src/api.ts`)
   - Change `updateExpense` return type from `void` to `{ id: ExpenseId }`
   - Change `updateSettlement` return type from `void` to `{ id: SettlementId }`

5. **Response Schemas** (`packages/shared/src/schemas/apiSchemas.ts`)
   - Add response schemas for update endpoints

6. **Webapp API Client** (`webapp-v2/src/app/apiClient.ts`)
   - Update `updateExpense()` to handle 200 response with new ID
   - Update `updateSettlement()` to handle 200 response with new ID

7. **Tests**
   - Update existing expense/settlement update tests
   - Add test verifying old expense has `supersededBy` set after edit
   - Add test verifying deletion of superseded record is rejected (400)

### Out of Scope
- UI to view edit history
- API endpoints to fetch history chain
- Migration of existing data

---

## Implementation Summary

All items from the plan above have been implemented:

### Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/shared-types.ts` | Added `supersededBy` to `Expense`, `Settlement`, and `SettlementWithMembers` interfaces |
| `packages/shared/src/api.ts` | Changed `updateExpense` return type to `ExpenseDTO`, `updateSettlement` to `SettlementWithMembers` |
| `packages/shared/src/schemas/apiSchemas.ts` | Added `supersededBy` to schemas, updated PUT response schemas |
| `firebase/functions/src/schemas/expense.ts` | Added `supersededBy` field |
| `firebase/functions/src/schemas/settlement.ts` | Added `supersededBy` field |
| `firebase/functions/src/services/ExpenseService.ts` | Rewrote `updateExpense` to soft-delete + create new; added guard in `_deleteExpense` |
| `firebase/functions/src/services/SettlementService.ts` | Rewrote `updateSettlement` to soft-delete + create new; added guard in `softDeleteSettlement` |
| `firebase/functions/src/services/firestore/FirestoreReader.ts` | Added `includeSoftDeleted` option to `getExpense` and `getSettlement` |
| `firebase/functions/src/services/firestore/IFirestoreReader.ts` | Updated interface signatures |
| `firebase/functions/src/expenses/ExpenseHandlers.ts` | Returns 200 with new expense data |
| `firebase/functions/src/settlements/SettlementHandlers.ts` | Returns 200 with new settlement data |
| `webapp-v2/src/app/apiClient.ts` | Updated return types |
| `packages/test-support/src/ApiDriver.ts` | Updated return types |
| `firebase/functions/src/__tests__/unit/AppDriver.ts` | Updated return types, added `getExpenseById`/`getSettlementById` helpers |
| `packages/test-support/src/builders/*.ts` | Added `supersededBy: null` defaults |

### Tests Added

**Expense tests** (`firebase/functions/src/__tests__/unit/api/expenses.test.ts`):
- `should return new expense with new ID when updating`
- `should set supersededBy on original expense when updated`
- `should prevent deletion of superseded expense`
- `should not return superseded expense in group details`

**Settlement tests** (`firebase/functions/src/__tests__/unit/api/settlements.test.ts`):
- `should return new settlement with new ID when updating`
- `should set supersededBy on original settlement when updated`
- `should prevent deletion of superseded settlement`
