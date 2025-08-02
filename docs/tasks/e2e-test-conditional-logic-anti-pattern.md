# Excessive Conditional Logic in E2E Tests Anti-Pattern

## Problem
- **Location**: `e2e-tests/tests/multi-user-collaboration.e2e.test.ts:35-120, 166-228, 250-269, 364-384, 533-602, 648-653, 681-717, 741-751, 792-805, 832-851`
- **Description**: Tests are heavily laden with conditional logic that attempts to adapt to unknown feature implementation status, creating "feature detection" patterns that make tests unreliable and hard to maintain
- **Current vs Expected**: Tests use complex `if (await element.count() > 0)` patterns to probe for features vs tests that assert expected behavior directly

## Solution
Replace conditional feature-detection patterns with explicit test scenarios:

```typescript
// BAD: Feature detection pattern
if (await shareButton.count() > 0) {
  await shareButton.first().click();
  if (await linkInput.count() > 0) {
    if (await linkInput.first().evaluate(el => el.tagName === 'INPUT')) {
      shareLink = await linkInput.first().inputValue();
    } else {
      shareLink = await linkInput.first().textContent();
    }
  }
} else {
  // Share functionality not available - this is expected for now
  expect(await shareButton.count()).toBe(0);
}

// GOOD: Explicit test scenarios
test('should generate share link when share feature is implemented', async ({ page }) => {
  // This test assumes share feature exists
  await expect(shareButton).toBeVisible();
  await shareButton.click();
  await expect(shareLinkInput).toBeVisible();
  const shareLink = await shareLinkInput.inputValue();
  expect(shareLink).toContain('http');
});

test('should show "feature coming soon" when share not implemented', async ({ page }) => {
  // This test documents current state if feature isn't ready
  await expect(page.getByText(/sharing.*coming.*soon/i)).toBeVisible();
});
```

Create separate test files for different implementation states:
- `multi-user-collaboration-core.e2e.test.ts` - Tests for implemented features only
- `multi-user-collaboration-future.e2e.test.ts` - Tests for planned features (skipped until implemented)

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Moderate
- **Benefit**: High value - Tests become reliable and maintainable

## Implementation Notes
- Split the 856-line monster test file into focused, single-responsibility test files
- Use test.skip() for unimplemented features rather than conditional logic
- Each test should have a single, clear expectation about system behavior
- Remove all `.count() > 0` feature detection patterns
EOF < /dev/null