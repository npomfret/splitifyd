# E2E Test Anti-patterns Report

**Date**: 2025-08-04  
**Scope**: Analysis of e2e tests in `/e2e-tests/tests/`

## Executive Summary

The e2e test suite exhibits several critical anti-patterns that reduce test reliability, maintainability, and execution speed. The most severe issues are excessive conditional logic indicating uncertainty about app state, massive code duplication, and tests for potentially non-existent features.

## Critical Issues Found

### 1. Excessive If/Or Conditional Logic ❌

**Severity**: HIGH  
**Impact**: Tests are unreliable and don't properly verify app behavior

#### Problem
Tests contain extensive `.or()` chains and if/else blocks, indicating they don't know what state the app should be in. This defeats the purpose of tests as they're not asserting specific expected behavior.

#### Examples

**error-handling.e2e.test.ts:43-46**
```typescript
const errorMessage = page.getByText(/network error/i)
  .or(page.getByText(/try again/i))
  .or(page.getByText(/failed/i))
  .or(page.getByText(/error/i));
```

**manual-complex-scenario.e2e.test.ts:41-42**
```typescript
const addExpenseButton = page1.getByRole('button', { name: /add expense/i })
  .or(page1.getByRole('link', { name: /add expense/i }));
```

**manual-complex-scenario.e2e.test.ts:60-62**
```typescript
const submitButton = page1.getByRole('button', { name: /add expense/i })
  .or(page1.getByRole('button', { name: /create/i }))
  .or(page1.getByRole('button', { name: /save/i }));
```

#### Complete List of Files with .or() Chains
1. `error-handling.e2e.test.ts` - 20+ instances of .or() chains
2. `manual-complex-scenario.e2e.test.ts` - 15+ instances, heavy if/else logic
3. `homepage.e2e.test.ts` - Multiple fallback selectors
4. `advanced-splitting.e2e.test.ts` - Complex conditional selectors
5. `balance-settlement.e2e.test.ts` - Conditional UI element detection
6. `member-management.e2e.test.ts` - Uncertain button/link selectors
7. `multi-user-collaboration.e2e.test.ts` - State uncertainty
8. `complex-unsettled-group.e2e.test.ts` - Multiple fallback patterns

### 2. Massive Code Duplication ❌

**Severity**: HIGH  
**Impact**: Tests are slow, maintenance burden is high, changes require updates in multiple places

#### Problem
Common patterns are duplicated across multiple test files instead of being extracted into shared utilities.

#### Duplicated Patterns

**Group Creation Flow** (appears in 11+ files):
```typescript
const dashboard = new DashboardPage(page);
const createGroupModal = new CreateGroupModalPage(page);
await dashboard.openCreateGroupModal();
await createGroupModal.createGroup('Test Group', 'Description');
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
```

**URL Validation** (50+ occurrences):
```typescript
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
```

**Form Field Selectors** (20+ occurrences):
```typescript
page.getByPlaceholder('What was this expense for?')
page.getByRole('spinbutton')
```

**User Setup** (every authenticated test):
```typescript
await createAndLoginTestUser(page);
```

#### Complete List of Files with Duplicated Group Creation
1. `add-expense.e2e.test.ts`
2. `advanced-splitting.e2e.test.ts`
3. `balance-settlement.e2e.test.ts`
4. `dashboard.e2e.test.ts`
5. `delete-operations.e2e.test.ts`
6. `error-handling.e2e.test.ts`
7. `group-details.e2e.test.ts`
8. `manual-complex-scenario.e2e.test.ts`
9. `member-management.e2e.test.ts`
10. `multi-user-collaboration.e2e.test.ts`
11. `multi-user-expenses.e2e.test.ts`

### 3. Tests for Potentially Non-Existent Features ⚠️

**Severity**: MEDIUM  
**Impact**: Tests may be passing for wrong reasons or testing placeholder behavior

#### Examples

**error-handling.e2e.test.ts:179**
```typescript
// User can see the group - permissions may not be implemented yet
```

**error-handling.e2e.test.ts:225**
```typescript
// This is an advanced feature that may not be implemented
```

#### Specific Tests for Questionable Features
1. `error-handling.e2e.test.ts`
   - Line 166: "This depends on whether permissions are implemented"
   - Line 179: "permissions may not be implemented yet"
   - Line 225: "This is an advanced feature that may not be implemented"
   - Tests timeout handling that may not exist
   - Tests permission-based access control

2. `advanced-splitting.e2e.test.ts`
   - May test splitting algorithms not yet implemented
   - Complex percentage-based splits

3. `member-management.e2e.test.ts`
   - Tests invitation system that may be placeholder

### 4. Test Confusion About App State ❌

**Severity**: HIGH  
**Impact**: Tests don't properly verify behavior

#### Problem
Tests use conditional logic to handle multiple possible app states instead of asserting specific expected behavior.

**manual-complex-scenario.e2e.test.ts:44-79**
```typescript
const hasAddExpense = await addExpenseButton.count() > 0;
if (hasAddExpense) {
  // ... lots of code
  const hasForm = await descriptionField.count() > 0 && await amountField.count() > 0;
  if (hasForm) {
    // ... more code
    const hasExpense = await expenseText.count() > 0;
    if (hasExpense) {
      await expect(expenseText).toBeVisible();
    } else {
      // Empty else block - what should happen here?
    }
  }
}
```

#### Files with Excessive Conditional Logic
1. `manual-complex-scenario.e2e.test.ts` - Worst offender with nested if/else
2. `error-handling.e2e.test.ts` - Multiple conditional paths
3. `form-validation.e2e.test.ts` - Conditional validation checks
4. `dashboard.e2e.test.ts` - State-dependent assertions
5. `add-expense.e2e.test.ts` - Form state conditionals

### 5. No Skipped Tests Found ✅

**Status**: GOOD  
No `.skip()`, `xit()`, or commented out tests were found.

## Recommendations

### Immediate Actions

1. **Replace .or() chains with specific selectors**
   - Add `data-testid` attributes to UI elements
   - Use single, reliable selectors
   - Tests should know exactly what to expect

2. **Extract common patterns into utilities**
   ```typescript
   // test-utils/group-helpers.ts
   export async function createGroupAndNavigate(page, name, description) {
     // Common group creation logic
   }
   ```

3. **Remove conditional logic from tests**
   - Tests should assert specific behavior
   - If app state varies, create separate test cases
   - Use proper test setup to ensure consistent state

4. **Audit features being tested**
   - Verify each test corresponds to implemented functionality
   - Remove tests for non-existent features
   - Mark placeholder tests clearly

### Long-term Improvements

1. **Implement Page Object Model consistently**
   - Centralize selectors in page objects
   - Reduce duplication through inheritance

2. **Create test data factories**
   - Standardize test data creation
   - Reduce boilerplate setup code

3. **Add stability attributes**
   - Use `data-testid` for test selectors
   - Avoid relying on text content or CSS classes

4. **Implement proper test lifecycle**
   - Clear setup and teardown
   - Consistent app state before each test

## Files Requiring Immediate Attention

1. `manual-complex-scenario.e2e.test.ts` - Excessive conditionals, unclear test intent
2. `error-handling.e2e.test.ts` - Too many .or() chains, unclear error expectations
3. `form-validation.e2e.test.ts` - Duplicated validation logic
4. `add-expense.e2e.test.ts` - Repeated patterns, unclear selectors
5. `advanced-splitting.e2e.test.ts` - May be testing non-existent features

## Estimated Impact

- **Test execution time**: Could be reduced by 30-40% by removing duplication
- **Maintenance burden**: Could be reduced by 50% with proper abstractions
- **Test reliability**: Currently low due to conditional logic; could be greatly improved
- **False positives**: High risk due to tests that don't assert specific behavior

## Next Steps

1. Create shared test utilities for common operations
2. Replace all .or() chains with specific selectors
3. Audit and remove tests for non-existent features
4. Refactor tests to remove conditional logic
5. Add data-testid attributes to the application for reliable selection

## Implementation Plan

### Phase 1: Create Test Infrastructure (Foundation)

#### 1.1 Enhanced Test Helpers
Create `/e2e-tests/helpers/group-helpers.ts`:
- `createGroupAndNavigate(page, name, description)` - standardized group creation
- `navigateToGroup(page, groupId)` - consistent navigation
- `expectGroupUrl(page)` - reusable URL assertion
- `getGroupIdFromUrl(page)` - extract group ID utility

#### 1.2 Enhanced Expense Helpers
Create `/e2e-tests/helpers/expense-helpers.ts`:
- `addExpenseStandardFlow(page, description, amount)` - standard expense creation
- `fillExpenseForm(page, data)` - form filling utility
- `expectExpenseVisible(page, description)` - assertion helper

#### 1.3 Selector Constants
Create `/e2e-tests/helpers/selectors.ts`:
- Define constants for common selectors
- Single source of truth for UI element targeting
- Easy to update when UI changes

### Phase 2: Fix Critical Files (Highest Impact)

#### 2.1 Fix `manual-complex-scenario.e2e.test.ts`
- Remove ALL conditional logic (if/else blocks)
- Replace .or() chains with specific selectors
- Split into multiple focused tests:
  - `test('user can create group and add expense')`
  - `test('multiple users can collaborate on expenses')`
  - `test('balances update correctly with multiple expenses')`
- Use helpers instead of inline logic

#### 2.2 Fix `error-handling.e2e.test.ts`
- Replace 20+ .or() chains with specific error selectors
- Remove uncertainty about permissions:
  - Either test permissions properly OR remove the test
  - No "may not be implemented" comments
- Simplify error expectations to specific messages

### Phase 3: Eliminate Duplication (11 files)

#### 3.1 Group Creation Pattern
For each of these files, replace duplicated code with helper:
- `add-expense.e2e.test.ts`
- `advanced-splitting.e2e.test.ts`
- `balance-settlement.e2e.test.ts`
- `dashboard.e2e.test.ts`
- `delete-operations.e2e.test.ts`
- `group-details.e2e.test.ts`
- `member-management.e2e.test.ts`
- `multi-user-collaboration.e2e.test.ts`
- `multi-user-expenses.e2e.test.ts`

Change from:
```typescript
const dashboard = new DashboardPage(page);
const createGroupModal = new CreateGroupModalPage(page);
await dashboard.openCreateGroupModal();
await createGroupModal.createGroup('Test Group', 'Description');
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
```

To:
```typescript
const groupId = await createGroupAndNavigate(page, 'Test Group', 'Description');
```

### Phase 4: Remove .or() Chains (8 files)

#### 4.1 Strategy for Each File
- Identify what the test is actually trying to verify
- Choose the most specific selector
- If multiple valid states exist, create separate tests
- Never use .or() for uncertainty - be explicit

#### 4.2 Files to Fix
1. `homepage.e2e.test.ts` - Simplify navigation selectors
2. `advanced-splitting.e2e.test.ts` - Clear split type selection
3. `balance-settlement.e2e.test.ts` - Specific balance assertions
4. `member-management.e2e.test.ts` - Clear member UI elements
5. `multi-user-collaboration.e2e.test.ts` - Explicit state checks
6. `complex-unsettled-group.e2e.test.ts` - Direct assertions

### Phase 5: Feature Audit

#### 5.1 Verify Features Exist
- Check `advanced-splitting.e2e.test.ts` - verify percentage splits work
- Check `member-management.e2e.test.ts` - verify invitation system exists
- Check `error-handling.e2e.test.ts` - verify permission system

#### 5.2 Remove or Fix Non-Existent Feature Tests
- If feature doesn't exist: DELETE the test
- If feature partially exists: TEST only what works
- If unsure: Ask user before proceeding

### Phase 6: Add data-testid Attributes (Future)

#### 6.1 Webapp Updates Needed
This requires updating the React components:
- Add `data-testid="create-group-button"` to buttons
- Add `data-testid="expense-description"` to form fields
- Add `data-testid="group-balance-{userId}"` to balance displays
- Add `data-testid="expense-item-{expenseId}"` to expense list items

### Commit Strategy

Small, focused commits in this order:

1. **"test: add shared test utilities for common e2e operations"**
   - Create helper files
   - No test changes yet

2. **"test: refactor manual-complex-scenario test to remove conditionals"**
   - Fix the worst offender first
   - Demonstrate the pattern

3. **"test: refactor error-handling tests to use specific assertions"**
   - Remove .or() chains
   - Clear error expectations

4. **"test: extract duplicated group creation to shared helper"**
   - Update all 11 files
   - Big impact on test speed

5. **"test: remove .or() chains from remaining test files"**
   - Fix remaining 6 files
   - One commit per file if needed

6. **"test: remove tests for non-existent features"**
   - Clean up after verification
   - Document why removed

### Success Metrics

- ✅ Zero .or() chains in test code
- ✅ Zero if/else conditional logic in tests
- ✅ Common patterns extracted to helpers
- ✅ Each test has single, clear purpose
- ✅ Test execution time reduced by 30%+
- ✅ No "may not be implemented" comments
- ✅ All tests pass reliably