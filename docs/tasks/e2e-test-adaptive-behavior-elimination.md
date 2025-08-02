# Eliminate Adaptive Test Behavior Anti-Pattern

## Problem
- **Location**: `e2e-tests/tests/multi-user-collaboration.e2e.test.ts:29-31, 40-42, 46-51, 175-177, 259-261, 263-268`
- **Description**: Tests use complex element selection patterns that adapt to whatever UI elements they find, making tests non-deterministic and hiding UI inconsistencies
- **Current vs Expected**: Adaptive selector chains with `.or()` vs specific, explicit element selection

## Solution
Replace adaptive element selection with deterministic assertions:

**BAD: Adaptive Element Selection**
```typescript
// BAD: Tries multiple selectors and adapts to whatever it finds
const shareButton = page1.getByRole('button', { name: /share/i })
  .or(page1.getByRole('button', { name: /invite/i }))
  .or(page1.getByText(/add.*member/i));

const linkInput = page1.locator('input[readonly]')
  .or(page1.locator('input').filter({ hasText: /join|share|invite/i }))
  .or(page1.getByText(/localhost.*join/i));

const joinButton = page2.getByRole('button', { name: /join/i })
  .or(page2.getByRole('button', { name: /accept/i }));
```

**GOOD: Explicit Element Selection**
```typescript
// GOOD: Specific, deterministic element selection
test('should generate share link via share button', async ({ page }) => {
  // Test assumes specific UI implementation
  const shareButton = page.getByRole('button', { name: 'Share Group' });
  await expect(shareButton).toBeVisible();
  await shareButton.click();
  
  const shareModal = page.getByRole('dialog', { name: 'Share Group' });
  await expect(shareModal).toBeVisible();
  
  const shareLink = page.getByLabel('Share Link');
  await expect(shareLink).toHaveValue(/^https?:\/\/.+\/join\/.+$/);
});

test('should join group via join link', async ({ page }) => {
  const joinButton = page.getByRole('button', { name: 'Join Group' });
  await expect(joinButton).toBeVisible();
  await joinButton.click();
  
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
  await expect(page.getByText('Successfully joined group')).toBeVisible();
});
```

**Create Feature-Specific Test Variants**
```typescript
// If UI varies by feature implementation, create separate tests
test.describe('Share Feature - V1 Implementation', () => {
  test('should use "Share" button for sharing', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  });
});

test.describe('Share Feature - V2 Implementation', () => {
  test('should use "Invite Members" button for sharing', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Invite Members' })).toBeVisible();
  });
});
```

**Extract Element Selection Logic**
```typescript
// helpers/share-elements.ts
export class ShareElements {
  constructor(private page: Page) {}
  
  async getShareButton(): Promise<Locator> {
    // Single, specific implementation
    return this.page.getByRole('button', { name: 'Share Group' });
  }
  
  async getShareLinkInput(): Promise<Locator> {
    return this.page.getByLabel('Share Link');
  }
}
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low - Tests become more predictable
- **Complexity**: Simple - Mainly removing `.or()` chains
- **Benefit**: High value - Tests catch UI inconsistencies and regressions

## Implementation Notes
- Replace every `.or()` chain with single, specific selectors
- If multiple UI variants exist, create separate tests for each variant
- Use data-testid attributes for complex elements if needed
- Tests should fail when UI doesn't match expectations, not adapt to whatever they find
- Document UI assumptions clearly in test descriptions
EOF < /dev/null