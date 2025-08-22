# Fix Integration Test Guideline Violations

## Overview

Deep analysis of `firebase/functions/src/__tests__/integration` revealed multiple violations of our testing guidelines. While the foundation is solid, several anti-patterns need addressing to maintain test reliability and performance. The `change-detection.test.ts` file should be used as the gold standard for our testing patterns.

## 🔴 Critical Violations

### 1. Fixed Timeout Anti-Patterns (`setTimeout`)

Using `setTimeout` for polling is strictly forbidden as it leads to flaky and slow tests. All async operations must be polled using `ApiDriver` helpers like `pollForChange()` or `waitFor...` methods.

**Files affected:**
- `settlement-edit-delete.test.ts:119,265`: Uses `new Promise(resolve => setTimeout(resolve, 500))` for waiting.
- `group-membership-sync.test.ts:92,110,182`: Uses `Promise.race` with a `setTimeout` as a timeout mechanism, which is an anti-pattern.

**Guidelines violated:**
- "Arbitrary sleep delays" are prohibited.
- "Use condition-based polling instead."

**Solution:**
Replace all `setTimeout` calls with proper, condition-based polling using existing `ApiDriver` helpers.

### 2. Excessive Test Timeouts

Long timeouts mask performance issues and slow down the entire test suite. Timeouts should be reasonable, typically under 10 seconds.

**Files affected:**
- `optimistic-locking.test.ts`: `jest.setTimeout(25000)` (25 seconds!)
- `api.test.ts`: `jest.setTimeout(30000)` (30 seconds!)
- `group-membership-sync.test.ts`: `jest.setTimeout(15000)` (15 seconds)
- `trigger-debug.test.ts`: `it('...', ..., 15000)`
- `freeform-categories-api.test.ts`: `jest.setTimeout(15000)`

**Guidelines violated:**
- "Set reasonable timeouts: Start with 1-5 seconds."
- Long timeouts mask performance issues.

**Solution:**
Reduce all test timeouts to a maximum of 10 seconds and investigate the underlying cause of any tests that fail with the shorter timeout.

## 🟡 Major Violations

### 3. Missing Builder Pattern Usage

The builder pattern is essential for creating test data, as it makes tests more readable and focuses them on the relevant parameters. It is being used inconsistently.

**Files affected:**
- `groups-full-details.test.ts:44-199`: Numerous large, inline objects for creating expenses and settlements.
- `expenses-full-details.test.ts:44-122`: Inline object creation for expenses.
- `security.test.ts:123,278-285`: Inline objects for creating expenses and groups.
- `data-validation.test.ts:106-120`: Uses a spread operator with a builder (`{...new ExpenseBuilder().build(), ...}`), which is an anti-pattern. The builder should be used to set the invalid property directly.
- `optimistic-locking.test.ts`: Multiple instances of inline object creation for groups, expenses, and settlements.
- `api.test.ts`: Widespread use of inline objects instead of builders throughout the file.
- `edit-expense.test.ts`: Uses inline objects for updates instead of an `ExpenseUpdateBuilder`.

**Guidelines violated:**
- "Use builder pattern to reduce setup complexity."
- "Focus tests on what's important."

**Solution:**
- Refactor all instances of inline object creation to use the appropriate builder (`ExpenseBuilder`, `GroupBuilder`, etc.).
- Create and use `ExpenseUpdateBuilder`, `SettlementUpdateBuilder`, and `GroupUpdateBuilder` for update operations.
- Fix the builder spread anti-pattern in `data-validation.test.ts`.

### 4. Large Inline Objects in Loops

Creating data in loops with large inline objects makes tests difficult to read and maintain.

**Files affected:**
- `groups-full-details.test.ts:148-199`: Creates 25 expenses in a loop using a large inline object.
- `business-logic.test.ts:458-461`: Creates 15 expenses in a loop with an inline object.

**Solution:**
Refactor these loops to use builders, which will make the code cleaner and more maintainable.
```typescript
// GOOD: Use builders in loops
const expenses = Array.from({length: 15}, (_, i) => 
    new ExpenseBuilder()
        .withGroupId(groupId)
        .withDescription(`Test expense ${i}`)
        .withAmount(10)
        .build()
);
```

## 🟢 Excellent Examples to Follow

### Reference Implementation: `change-detection.test.ts`

This file demonstrates perfect async testing patterns and should be used as the gold standard.

```typescript
// ✅ EXCELLENT: Proper polling with specific conditions
const settlementChange = await pollForChange<SettlementChangeDocument>(
    FirestoreCollections.TRANSACTION_CHANGES,
    (doc) => doc.id === settlement.id && doc.action === 'created' && doc.type === 'settlement',
    {timeout: 2000, groupId}
);

// ✅ EXCELLENT: Uses builders consistently
const settlement = await apiDriver.createSettlement(
    new SettlementBuilder()
        .withGroupId(groupId)
        .withPayer(user1.uid)
        .withPayee(user2.uid)
        .build(),
    user1.token
);

// ✅ EXCELLENT: Uses ApiDriver for all operations - no raw waits
await apiDriver.waitForGroupCreationEvent(group.id, user1);
```

**Why this is excellent:**
- No arbitrary timeouts or sleeps.
- All polling is done through `ApiDriver` helpers.
- Builders are used consistently for data setup.
- Tests focus on behavior, not setup noise.
- Timeouts are reasonable (2000ms).

## 📋 Implementation Tasks

### Phase 1: Fix Critical Anti-Patterns
- [ ] Replace all `setTimeout` calls in `settlement-edit-delete.test.ts` and `group-membership-sync.test.ts`.
- [ ] Reduce excessive timeouts in all affected files to a maximum of 10 seconds.
- [ ] Investigate why any tests fail with shorter timeouts.

### Phase 2: Create Missing Builders
- [ ] Create `ExpenseUpdateBuilder` class.
- [ ] Create `SettlementUpdateBuilder` class.
- [ ] Create `GroupUpdateBuilder` class.
- [ ] Update existing tests to use the new builders for update operations.

### Phase 3: Refactor Builder Violations
- [ ] Fix spread operator anti-patterns in `data-validation.test.ts`.
- [ ] Replace all inline object creation with builders in all affected files.
- [ ] Refactor loop-generated test data to use builders.

### Phase 4: Standardize Patterns
- [ ] Create a code review checklist based on `change-detection.test.ts` patterns.
- [ ] Add pre-commit hooks to detect `setTimeout` and large inline objects in tests.
- [ ] Document the "no `setTimeout`" and "always use builders" rules more prominently in the testing guide.

## 📊 Current Scores

| Category | Score | Notes |
|----------|--------|-------|
| Builder Pattern | 5/10 | Good in main flows, but very poor in validation and edge case tests. |
| Async Testing | 4/10 | Good helpers exist but are inconsistently used. `setTimeout` is still present. |
| Test Timeouts | 2/10 | Many excessive timeouts are masking potential performance issues. |
| Test Structure | 8/10 | Generally well-organized with clear descriptions. |
| Mock Usage | 10/10 | Excellent. No complex mocks are used. |

**Target Score:** 9/10 across all categories.

## 🎯 Success Criteria

- Zero `setTimeout` or arbitrary waits in tests.
- All test timeouts are ≤ 10 seconds.
- All entity creation and updates use appropriate builders.
- All async operations use proper polling via `ApiDriver`.
- The entire integration test suite runs in under 5 minutes.
- All tests follow the patterns established in `change-detection.test.ts`.
