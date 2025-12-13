# Audit: data-testid Usage in webapp-v2

**Status:** ✅ Complete

## Summary

Audited `data-testid` attributes in webapp-v2 and converted ~14 unnecessary test-ids to semantic selectors. Updated documentation to prevent future misuse.

## What Was Done

### Conversions (14 test-ids removed)

| Component | Test-ids Removed | Now Uses |
|-----------|------------------|----------|
| `ModeToggle.tsx` | `mode-toggle-basic`, `mode-toggle-advanced` | `getByRole('radio', { name })` |
| `UserMenu.tsx` | 7 test-ids (button, menu, menuitems) | `getByRole('button/menu/menuitem')` |
| `PayerSelector.tsx` | `payer-selector-trigger`, `payer-selector-search`, `payer-option-*` | `getByRole('button')`, `getByPlaceholder()`, `getByRole('option')` |
| `ParticipantSelector.tsx` | `participant-selector-grid`, `validation-error-participants` | Section scoping, `role='alert'` |
| `ExpenseBasicFields.tsx` | `validation-error-description`, `validation-error-date` | `getByRole('alert').filter()` |
| `ExpenseFormModal.tsx` | `validation-error-splits` | `getByRole('alert').filter()` |

### Page Objects Updated

- `TenantEditorModalPage.ts`
- `AdminTenantsPage.ts`
- `ExpenseFormPage.ts`
- `HeaderPage.ts`
- `error-proxy.ts`

### Documentation Added

- **testing.md**: Expanded "Selector Priority" section with guidance on when `data-testid` is/isn't appropriate
- **webapp-and-style-guide.md**: Added anti-pattern entry as a reminder

## Remaining Test-ids

~100+ test-ids remain in the codebase. These are legitimate last-resort cases:

- Container divs without visible text
- List items needing unique identification
- Dynamic IDs in loops
- Structural elements without semantic meaning

Future conversions can be done incrementally when touching those components.
