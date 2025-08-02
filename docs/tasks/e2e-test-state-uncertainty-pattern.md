# Test State Uncertainty Anti-Pattern

## Problem
- **Location**: `e2e-tests/tests/multi-user-collaboration.e2e.test.ts:87-113, 200-225, 317-327, 359-384, 429-444, 486-489, 595-602`
- **Description**: Tests don't know what features are implemented, leading to adaptive behavior that masks real bugs and creates unreliable test results
- **Current vs Expected**: Tests adapt to whatever they find vs tests that verify specific expected behaviors

## Solution
Eliminate uncertainty patterns by creating deterministic test scenarios:

```typescript
// BAD: Uncertain adaptive behavior
const canSeeGroup = await page.getByText('Share Link Test Group').count() > 0;
if (canSeeGroup) {
  await expect(groupNameElement).toBeVisible();
  // Maybe verify user appears...
  if (await user2Element.count() > 0) {
    await expect(user2Element).toBeVisible();
  }
} else {
  // Share functionality not implemented - verify we're still logged in
  await expect(page).toHaveURL(/\/dashboard/);
}

// GOOD: Explicit expectations
test('should add user to group when joining via share link', async ({ page }) => {
  // Prerequisite: Share feature must be implemented for this test
  await joinGroupViaShareLink(groupId, user2);
  
  // Explicit assertions about expected behavior
  await expect(page.getByText('Share Link Test Group')).toBeVisible();
  await expect(page.getByText(user2.displayName)).toBeVisible();
  await expect(page.getByText(/2 members/i)).toBeVisible();
});
```

Create helper functions that encapsulate complex flows and fail fast if prerequisites aren't met:

```typescript
async function joinGroupViaShareLink(groupId: string, user: TestUser) {
  const shareLink = await generateShareLink(groupId);
  if (\!shareLink) {
    throw new Error('Share feature not implemented - cannot run this test');
  }
  // Continue with join flow...
}
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low  
- **Complexity**: Moderate
- **Benefit**: High value - Tests become predictable and catch real regressions

## Implementation Notes
- Replace all "if it works, check it" patterns with explicit feature requirements
- Use test prerequisites to document what features must be implemented
- Fail fast when prerequisites aren't met rather than adapting
- Create focused test helpers that assume specific implementation states

## Analysis & Plan

### Task Validity
✅ **Valid and worthwhile task** - This refactoring addresses a critical anti-pattern in the E2E tests where adaptive behavior masks real bugs. The tests currently check if features exist before testing them, which prevents them from serving as proper regression guards.

### Implementation Plan

#### Phase 1: Create Deterministic Flow Infrastructure
1. **Create feature-flows.ts** in e2e-tests/helpers/
   - Implement ExpenseManagementFlow class with strict assertions
   - Add GroupManagementFlow for group operations
   - Create FeatureRequirements validator class
   - Define FeatureNotImplementedError for clear failure messages

2. **Create test-orchestrators.ts** for multi-user test patterns
   - withMultiUserGroup() helper for deterministic multi-user setup
   - Strict validation of prerequisites before operations

#### Phase 2: Refactor Existing Helpers
3. **Update existing page objects** to add strict validation methods
   - GroupDetailPage: Add validateExpenseManagementAvailable()
   - DashboardPage: Add validateGroupCreationAvailable()
   - Keep existing methods during transition

#### Phase 3: Refactor Tests (Can be split into separate commits)
4. **Refactor "Concurrent Expense Management" tests** (lines 40-245)
   - Remove all if (await button.count() > 0) patterns
   - Use ExpenseManagementFlow for deterministic operations
   - Add explicit prerequisites validation

5. **Refactor "Settlement and Payment Recording" tests** (lines 247-304)
   - Replace conditional settlement checks with strict assertions
   - Fail fast if settlement features not implemented

6. **Refactor "Conflict Resolution" tests** (lines 306-452)
   - Remove adaptive edit/delete patterns
   - Assert conflict handling features exist

7. **Refactor "Real-time Features" tests** (lines 454-588)
   - Replace conditional real-time checks with explicit expectations
   - Document real-time sync as prerequisite

8. **Refactor "Permission Management" tests** (lines 590-655)
   - Assert admin features exist rather than checking conditionally

### Key Patterns to Replace

1. **Conditional Feature Checks**
   ```typescript
   // BAD
   if (await addExpenseButton.count() > 0) { ... }
   
   // GOOD
   await expect(addExpenseButton).toBeVisible();
   ```

2. **Fallback Behaviors**
   ```typescript
   // BAD
   if (await expenseOnUser2.count() === 0) {
     await page2.reload(); // Fallback
   }
   
   // GOOD
   await expect(expenseOnUser2).toBeVisible({ timeout: 2000 });
   ```

3. **Optional Assertions**
   ```typescript
   // BAD
   if (await balanceIndicator.count() > 0) {
     await expect(balanceIndicator).toBeVisible();
   }
   
   // GOOD
   await expect(balanceIndicator).toBeVisible();
   ```

### Benefits
- Tests fail fast when features are incomplete
- Clear error messages indicate what's missing
- Tests serve as living documentation of expected behavior
- Easier to debug failures
- Prevents silent test skipping
EOF < /dev/null