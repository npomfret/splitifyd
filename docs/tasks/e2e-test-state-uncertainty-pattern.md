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
EOF < /dev/null