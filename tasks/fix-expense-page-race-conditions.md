# Fix Race Conditions in Expense Pages

## Problem

The AddExpensePage and ExpenseDetailPage show race conditions where loading spinners can get stuck, similar to the issue we solved in GroupDetailPage.

## Root Cause

Both pages make multiple sequential API calls that can conflict:

### AddExpensePage (via useExpenseForm.ts)
- Line 65-67: `enhancedGroupDetailStore.fetchGroup(groupId)` 
- If group loading fails/delays, expense form shows loading spinner indefinitely
- Complex loading state management across multiple stores

### ExpenseDetailPage  
- Lines 69-72: Separate calls to load group data, then expense fetch
- Two separate loading states can conflict
- No atomic updates between group and expense data

## Solution

### 1. Create Consolidated Expense Detail Endpoint

```typescript
// New endpoint: GET /expenses/:id/full-details
interface ExpenseFullDetailsResponse {
  expense: ExpenseData;
  group: Group;
  members: User[];
}
```

### 2. Update AddExpensePage Pattern

Either:
- **Option A**: Use existing consolidated group endpoint more efficiently
- **Option B**: Create consolidated endpoint for expense form initialization

### 3. Implement Atomic State Updates

Use Preact signals `batch()` pattern like in GroupDetailPage:

```typescript
batch(() => {
  expenseSignal.value = response.expense;
  groupSignal.value = response.group;
  membersSignal.value = response.members;
  loadingSignal.value = false; // CRITICAL: Only after all data loaded
});
```

## Technical Requirements

### Backend Changes
1. Create `_getExpenseFullDetailsData` internal function
2. Add `/expenses/:id/full-details` endpoint to index.ts
3. Reuse existing group member fetching logic
4. Add comprehensive tests

### Frontend Changes  
1. Update ExpenseDetailPage to use consolidated endpoint
2. Modify useExpenseForm loading strategy  
3. Replace sequential API calls with single atomic call
4. Update loading state management

### API Client Updates
```typescript
async getExpenseFullDetails(expenseId: string): Promise<{
  expense: ExpenseData;
  group: Group; 
  members: User[];
}> {
  return this.request({
    endpoint: '/expenses/:id/full-details',
    method: 'GET',
    params: { id: expenseId },
  });
}
```

## Implementation Steps

### Phase 1: ExpenseDetailPage (Higher Impact)
1. Create backend endpoint for expense full details
2. Update ExpenseDetailPage to use consolidated call  
3. Add tests for new endpoint
4. Verify race condition eliminated

### Phase 2: AddExpensePage (Complex)
1. Analyze exact loading flow in useExpenseForm
2. Determine if new endpoint needed or existing can be optimized
3. Implement atomic loading pattern
4. Test expense form initialization thoroughly

## Testing Strategy

### Unit Tests
- Test consolidated endpoint returns complete data
- Test error handling when expense/group not found
- Test pagination if needed

### Integration Tests  
- Add test to existing expense test suite
- Verify atomic loading behavior
- Test permissions (user must be in group)

### E2E Tests
- Test expense detail page loading eliminates spinner issues
- Test expense form initialization is reliable
- Test error cases display properly

## Success Criteria

- [ ] No more stuck loading spinners on expense pages
- [ ] Faster perceived performance (fewer network calls)  
- [ ] Atomic state updates prevent inconsistent UI states
- [ ] All existing functionality preserved
- [ ] Tests verify race condition resolution

## Related Work

- ✅ GroupDetailPage race condition fix (pattern to follow)
- ✅ Internal function extraction pattern established
- ✅ Atomic batch() updates pattern established

## Estimated Effort

- Backend endpoint: 4-6 hours
- Frontend updates: 6-8 hours  
- Testing: 4-6 hours
- **Total: 14-20 hours**

## Priority

**HIGH** - Affects core user workflows when adding/viewing expenses