# Payer Selector Autocomplete Enhancement

## Status: ✅ COMPLETE

Build passes. Implementation complete.

---

## Objective

Replace the current grid-based radio button layout in the "Who paid?" section of the expense form with an autocomplete dropdown, similar to the currency selector pattern used in `CurrencyAmountInput`.

## Implementation Summary

### Files Created

| File | Description |
|------|-------------|
| `webapp-v2/src/app/hooks/useDropdownSelector.ts` | Shared base hook for all dropdown/combobox selectors |
| `webapp-v2/src/app/hooks/usePayerSelector.ts` | Thin wrapper for member selection |
| `webapp-v2/src/components/expense-form/types.ts` | Shared `ExpenseFormMember` type |
| `webapp-v2/src/__tests__/unit/vitest/hooks/useDropdownSelector.test.ts` | Unit tests for base hook (22 tests) |
| `webapp-v2/src/__tests__/unit/vitest/hooks/usePayerSelector.test.ts` | Unit tests for payer selector hook (10 tests) |

### Files Modified

| File | Description |
|------|-------------|
| `webapp-v2/src/app/hooks/useCurrencySelector.ts` | Refactored to use base hook (~70 lines removed) |
| `webapp-v2/src/components/expense-form/PayerSelector.tsx` | New dropdown UI replacing radio grid |
| `webapp-v2/src/components/expense-form/ParticipantSelector.tsx` | Use shared `ExpenseFormMember` type |
| `webapp-v2/src/components/expense-form/SplitAmountInputs.tsx` | Use shared `ExpenseFormMember` type |
| `webapp-v2/src/components/expense-form/index.ts` | Export `ExpenseFormMember` type |
| `webapp-v2/src/components/ui/LabelSuggestionInput.tsx` | Refactored to use base hook (~50 lines removed) |
| `webapp-v2/src/locales/en/translation.json` | Added 4 new i18n keys |
| `packages/test-support/src/page-objects/ExpenseFormPage.ts` | Updated `selectPayer()` for dropdown UI |

### Architecture

```
useDropdownSelector (base hook)
    ├── mode: 'dropdown' (button trigger + separate search)
    │   ├── usePayerSelector (new)
    │   └── useCurrencySelector (refactored)
    │
    └── mode: 'combobox' (input IS the trigger and search)
        └── LabelSuggestionInput (refactored)
```

The shared `useDropdownSelector` hook handles:
- Open/close state management
- Search term state with optional debouncing
- Highlighted index for keyboard navigation
- Click-outside detection (`mousedown` listener)
- Keyboard navigation (ArrowUp/Down, Enter, Escape, Tab)
- Auto-focus search input when opening (dropdown mode only)
- Optional `getNavigationItems` for grouped displays
- Two modes: `'dropdown'` and `'combobox'`
- Configurable navigation wrapping (wraps by default in combobox mode)

---

## Original Requirements

### Previous Implementation

The `PayerSelector` component displayed group members as a grid of radio buttons with avatars. While this worked for small groups (2-4 members), it became unwieldy for larger groups.

**Previous behavior:**
- Displayed all members in a responsive grid (1-3 columns)
- Each member shown with avatar and display name
- Radio button selection

### New Implementation ✅

Autocomplete dropdown that:
1. ✅ Shows the currently selected payer (with avatar) in a collapsed state
2. ✅ Opens a searchable dropdown when clicked
3. ✅ Filters members as the user types
4. ✅ Supports keyboard navigation (arrow keys, Enter, Escape)
5. ✅ Shows avatars alongside member names in the dropdown

### Accessibility Requirements ✅

- ✅ `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls` on trigger button
- ✅ `role="listbox"` on the dropdown
- ✅ `role="option"`, `aria-selected` on each member item
- ✅ Keyboard navigation: Arrow Up/Down, Enter, Escape, Tab
- ✅ Focus management when opening/closing
- ✅ Error state with `aria-invalid` and `aria-describedby`

## Visual Design

**Collapsed state:**
```
┌─────────────────────────────────────┐
│ [Avatar] Alice Smith              ▼ │
└─────────────────────────────────────┘
```

**Expanded state:**
```
┌─────────────────────────────────────┐
│ [Avatar] Alice Smith              ▲ │
├─────────────────────────────────────┤
│ 🔍 Search members...                │
├─────────────────────────────────────┤
│ [Avatar] Alice Smith          ✓     │  ← selected
│ [Avatar] Bob Johnson                │  ← highlighted (keyboard)
│ [Avatar] Charlie Brown              │
└─────────────────────────────────────┘
```

## Translation Keys Added

```json
"payerSelector": {
    "label": "Who paid?",
    "requiredIndicator": "*",
    "selectPayer": "Select who paid",
    "searchPlaceholder": "Search members...",
    "membersList": "Group members",
    "noResults": "No members match your search"
}
```

## Considerations Addressed

- **Small groups**: Always use dropdown for consistency across all group sizes
- **Label selector comparison**: Payer selector does NOT allow creating new members - fixed list selection only
- **Mobile UX**: Touch-friendly dropdown with adequate tap targets

## Testing

- ✅ Build passes
- ✅ ExpenseFormPage POM updated for dropdown UI
- ✅ E2E tests verified passing (expense-form.test.ts)
- ✅ Unit tests for `useDropdownSelector` hook (22 tests)
- ✅ Unit tests for `usePayerSelector` hook (10 tests)
- ✅ Keyboard navigation covered in unit tests
