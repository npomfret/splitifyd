# Migrate Page Objects to Translation Imports

## Overview

Page objects currently use hardcoded strings and regex patterns for button/text selectors. This creates maintenance burden when translations change and causes test failures like the one fixed in commit after `e20a5a8d` where `/confirm/i` didn't match the actual "Delete" button text.

## Current State

Page objects in `packages/test-support/src/page-objects/` use mixed approaches:

```typescript
// Hardcoded regex (current approach)
const confirmButton = confirmDialog.getByRole('button', { name: /delete/i });

// Hardcoded strings
await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
```

## Target State

Import translation files and use exact text from translations:

```typescript
import { translationEn } from '../translations/translation-en';

// Use translation value directly
const confirmButton = confirmDialog.getByRole('button', {
    name: translationEn.expenseComponents.expenseActions.deleteButton
});
```

## Benefits

- **Single source of truth** - button text defined once in translation file
- **Auto-updating tests** - when translations change, tests automatically use new text
- **No drift** - eliminates bugs where selector doesn't match actual UI text
- **i18n ready** - pattern supports future multi-language testing

## Scope

### Files to Update

All page objects in `packages/test-support/src/page-objects/`:
- `BasePage.ts`
- `CreateExpenseFormPage.ts`
- `CreateGroupModalPage.ts`
- `DashboardPage.ts`
- `ExpenseDetailPage.ts`
- `GroupDetailPage.ts`
- `LoginPage.ts`
- `SettlementDetailPage.ts`
- And others...

### Translation File Setup

The translation file is already exported for tests at:
`packages/test-support/src/translations/translation-en.ts`

## Implementation Steps

1. **Audit** - List all hardcoded strings/regex in page objects
2. **Map** - Match each to corresponding translation key
3. **Refactor** - Replace hardcoded values with translation imports
4. **Verify** - Run full test suite to confirm no regressions

## Priority

Medium - improves maintainability but existing tests work. Should be done before any major UI text changes.

## Estimated Effort

~2-3 hours to audit and refactor all page objects systematically.
