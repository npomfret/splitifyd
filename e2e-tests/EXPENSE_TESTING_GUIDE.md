# Expense Testing Guide

This guide explains how to use the standardized helper methods for expense-related tests to avoid common timing and loading issues.

## Problem Statement

All expense tests need to ensure that:
1. Group data is fully loaded before creating expenses
2. Group members are loaded on the group page 
3. Expense form has member data loaded before interacting with split types

Previously, tests had to manually add these wait steps, leading to duplicated code and potential for missed steps.

## Solution: Standardized Helper Methods

The `GroupDetailPage` class now provides comprehensive helper methods that handle all the necessary waiting and loading logic:

### For New Groups + First Expense

```typescript
test('should add expense to new group', async ({ authenticatedPage, groupDetailPage }) => {
  const { page } = authenticatedPage;
  
  // This method handles: group creation, waiting for group data, and preparing for expenses
  const groupId = await groupDetailPage.createGroupAndPrepareForExpenses('Test Group', 'Optional description');

  // This method handles: clicking Add Expense, waiting for form, waiting for members
  await groupDetailPage.navigateToAddExpenseForm();
  
  // Now you can safely interact with the expense form
  await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Test Expense');
  await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '50');
  
  // Split type radio buttons will be available now
  await expect(groupDetailPage.getEqualRadio()).toBeChecked();
  
  await groupDetailPage.getSaveExpenseButton().click();
});
```

### For Additional Expenses (in same test)

```typescript
test('should add multiple expenses', async ({ authenticatedPage, groupDetailPage }) => {
  const { page } = authenticatedPage;
  
  // First expense
  const groupId = await groupDetailPage.createGroupAndPrepareForExpenses('Test Group');
  await groupDetailPage.navigateToAddExpenseForm();
  // ... add first expense

  // Additional expenses - this handles navigation back to expense form with proper waiting
  await groupDetailPage.prepareForNextExpense();
  
  // Now safe to interact with expense form for second expense
  await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Second Expense');
  // ... etc
});
```

### For Existing Groups (using GroupWorkflow)

```typescript
test('should add expense to existing group', async ({ authenticatedPage, groupDetailPage }) => {
  const { page } = authenticatedPage;
  
  // If you create the group using GroupWorkflow directly
  const groupWorkflow = new GroupWorkflow(page);
  const groupId = await groupWorkflow.createGroup('Test Group');
  
  // Use this helper to ensure group page is ready
  await groupDetailPage.ensureGroupPageReady(groupId);
  
  // Then proceed with expense creation
  await groupDetailPage.navigateToAddExpenseForm();
  // ... add expense
});
```

## Method Breakdown

### `createGroupAndPrepareForExpenses(groupName, description?, expectedMemberCount?)`
- Creates a new group using GroupWorkflow
- Waits for group page to load completely
- Waits for at least 1 member (the creator) to appear
- Waits for group balances to load
- Stores expected member count for expense form validation
- Returns the groupId for further use

### `ensureGroupPageReady(groupId)`
- Use this when you've created a group via other means
- Waits for DOM to load
- Waits for member count (at least 1)
- Waits for balances to load

### `navigateToAddExpenseForm(expectedMemberCount?)`
- Clicks "Add Expense" button
- Waits for navigation to expense form URL
- Waits for DOM to load
- Waits for expense description field to be visible
- Waits for all form sections to be visible
- **Validates ALL members appear in "Who paid?" and "Split between" sections**
- Ensures exact number of expected members are present
- After this method completes, split type radio buttons will be available

### `prepareForNextExpense()`
- Use this for adding subsequent expenses in the same test
- Waits for return to group page
- Waits for DOM to load
- Calls `navigateToAddExpenseForm()` with stored member count to prepare the form

### `navigateToEditExpenseForm(expenseDescription, expectedMemberCount?)`
- Clicks on the expense to view details
- Clicks the edit button
- Waits for edit form to load completely
- **Validates ALL members appear in edit form sections**
- Ensures expense editing has full member representation

### `validateAllMembersInExpenseForm(expectedMemberCount)`
- Validates "Who paid?" section has all expected members
- Validates "Split between" section has all expected members
- Provides detailed error messages for debugging
- Returns validation results with errors array

## Migration Guide

### Before (manual waiting)
```typescript
// ❌ Manual, error-prone approach
const groupWorkflow = new GroupWorkflow(page);
const groupId = await groupWorkflow.createGroup('Test Group');

await page.waitForLoadState('domcontentloaded');
await groupDetailPage.waitForMemberCount(1);
await groupDetailPage.waitForBalancesToLoad(groupId);

await groupDetailPage.clickAddExpenseButton();
await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
await groupDetailPage.waitForMembersInExpenseForm();
```

### After (using helpers)
```typescript
// ✅ Clean, reliable approach
const groupId = await groupDetailPage.createGroupAndPrepareForExpenses('Test Group');
await groupDetailPage.navigateToAddExpenseForm();
```

## Testing the Helpers

To verify these helpers work correctly, the `advanced-splitting-happy-path.e2e.test.ts` test demonstrates their usage across multiple expense creation scenarios.

Run this test to confirm the helpers work:
```bash
npx playwright test --workers=1 "src/tests/normal-flow/advanced-splitting-happy-path.e2e.test.ts"
```

## Enhanced Member Validation

### The Problem
In multi-user groups, expense forms sometimes load before all group members are fetched from the server. This leads to:
- Missing members in "Who paid?" dropdown (users can't select who paid)
- Missing members in "Split between" checkboxes (can't split among all members)
- Intermittent test failures due to race conditions
- Inconsistent behavior between new and edit expense forms

### The Solution
The enhanced helper methods now ensure **ALL** group members are represented:

```typescript
// For multi-user scenarios
const groupId = await groupDetailPage.createGroupAndPrepareForExpenses(
  'Multi-User Group', 
  'Description',
  2 // Expect 2 members
);

// After second user joins
await groupDetailPage.shareGroupAndWaitForJoin(page2);
await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);

// Expense form will validate both members are present
await groupDetailPage.navigateToAddExpenseForm(2);

// Edit forms also validate all members
await groupDetailPage.navigateToEditExpenseForm('Expense Name', 2);
```

### Validation Features
- ✅ **Exact count validation**: Ensures expected number of members appear
- ✅ **Both sections checked**: "Who paid?" AND "Split between" validated
- ✅ **Edit form support**: Works for both new and edit expense workflows
- ✅ **Clear error messages**: Shows exactly what's missing for debugging
- ✅ **Auto-detection**: Can detect member count from group page when possible

## Benefits

1. **Eliminates timing issues**: All necessary waits are handled automatically
2. **Ensures complete member representation**: ALL group members appear in expense forms
3. **Reduces code duplication**: One method call replaces 6-8 lines of setup code
4. **Prevents missed steps**: Can't forget to wait for members to load
5. **Improves maintainability**: Changes to loading logic only need to be made in one place
6. **Better test readability**: Test intent is clearer when setup code is abstracted away
7. **Consistent behavior**: New and edit expense forms both validate member presence