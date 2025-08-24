# Real-Time Updates Debounce Analysis

**Created**: 2025-08-24  
**Status**: Investigation Required  
**Priority**: P2 (Technical Debt)  
**Related**: [fix-realtime-ui-updates.md](./fix-realtime-ui-updates.md)

## Problem Statement

The real-time update system requires a 300ms debounce to prevent race conditions, but **simple UI actions shouldn't need debouncing**. This indicates an architectural issue where multiple change events are firing for single logical operations.

## Current Implementation

**File**: `webapp-v2/src/app/stores/group-detail-store-enhanced.ts`

The group detail store subscribes to **two separate change detection streams**:
1. `subscribeToExpenseChanges(groupId, callback)`
2. `subscribeToGroupChanges(userId, callback)`

Both trigger `debouncedRefreshAll()` with a 300ms delay.

## Suspected Root Causes

### 1. Multiple Change Events for Single Action
A group name update might trigger:
- Group change event ✅ (expected)
- Expense change event ❌ (unexpected - why?)
- Multiple change collection documents ❌ (over-firing)

### 2. Over-Subscribed Change Detection
```typescript
// Current: Subscribe to BOTH streams
this.expenseChangeListener = this.changeDetector.subscribeToExpenseChanges(...)
this.groupChangeListener = this.changeDetector.subscribeToGroupChanges(...)
```

**Question**: Does group detail page need expense change detection if group changes already trigger full refresh?

### 3. Backend Change Collection Design
The backend might be writing multiple change documents for a single logical operation, causing:
- One change → Multiple Firestore documents → Multiple listener callbacks

## Evidence

### Test Behavior (Before Fix)
```
User edits group name
↓ 
Expected: "Updated Group Name"
Actual: "Original Group NameUpdated Group Name"
```

This text concatenation bug suggested **overlapping refresh operations**.

### Current Working Solution
- ✅ 300ms debounce prevents race conditions
- ✅ Tests pass consistently  
- ❌ But masks the underlying issue

## Investigation Tasks

### Phase 1: Backend Analysis
- [ ] Audit what change collections are written during group name update
- [ ] Check if group updates write to expense change collections
- [ ] Review change collection schema and trigger logic

### Phase 2: Frontend Subscription Analysis  
- [ ] Test if we can remove expense change subscription from group detail page
- [ ] Measure how many change events fire for single group update
- [ ] Add logging to count change callbacks per action

### Phase 3: Simplification
- [ ] Implement single change subscription model if possible
- [ ] Remove debouncing once root cause is fixed
- [ ] Test real-time updates without artificial delays

## Acceptance Criteria

### Ideal End State
- [ ] Group name updates fire **exactly one** change event
- [ ] No debouncing required for simple UI actions
- [ ] Real-time updates remain reliable
- [ ] Sub-100ms update propagation for local actions

### Minimum Viable Fix
- [ ] Understand why multiple events fire
- [ ] Document the architectural decision
- [ ] Keep debouncing if complexity is justified

## Technical Impact

### Current System
- ✅ **Functional**: Real-time updates work reliably
- ✅ **Stable**: Tests pass consistently
- ⚠️ **Performance**: 300ms minimum delay for all updates
- ❌ **Architecture**: Band-aid over underlying issue

### Risk Assessment
- **Low risk** to investigate - system is currently stable
- **Medium value** - could improve user experience with faster updates
- **High learning** - would clarify change detection architecture

## Related Files

### Frontend
- `webapp-v2/src/app/stores/group-detail-store-enhanced.ts` - Debounce implementation
- `webapp-v2/src/utils/change-detector.ts` - Change subscription logic
- `webapp-v2/src/pages/GroupDetailPage.tsx` - UI integration

### Backend (likely)
- Firebase Functions that handle group updates
- Change collection write logic
- Firestore trigger functions

## Next Steps

1. **Document current behavior** - Add logging to count change events
2. **Backend investigation** - Trace group update → change collection writes  
3. **Simplification experiment** - Try single subscription model
4. **Performance testing** - Measure update latency with/without debounce

This is a **quality improvement task** - the system works, but could be architected more elegantly.