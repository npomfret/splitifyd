# Payer Selector Autocomplete Enhancement

## Objective

Replace the current grid-based radio button layout in the "Who paid?" section of the expense form with an autocomplete dropdown, similar to the currency selector pattern used in `CurrencyAmountInput`.

## Current Implementation

The `PayerSelector` component (`webapp-v2/src/components/expense-form/PayerSelector.tsx`) displays group members as a grid of radio buttons with avatars. While this works well for small groups (2-4 members), it becomes unwieldy for larger groups.

**Current behavior:**
- Displays all members in a responsive grid (1-3 columns)
- Each member shown with avatar and display name
- Radio button selection

## Proposed Implementation

Create an autocomplete dropdown that:
1. Shows the currently selected payer (with avatar) in a collapsed state
2. Opens a searchable dropdown when clicked
3. Filters members as the user types
4. Supports keyboard navigation (arrow keys, Enter, Escape)
5. Shows avatars alongside member names in the dropdown

## Implementation Pattern

Follow the pattern established by `CurrencyAmountInput` and `useCurrencySelector`:

### 1. Create `usePayerSelector` Hook

Location: `webapp-v2/src/app/hooks/usePayerSelector.ts`

Similar to `useCurrencySelector`, this hook should handle:
- Open/close state
- Search term filtering
- Keyboard navigation (highlighted index, arrow keys)
- Click-outside detection
- Selection handling

### 2. Update `PayerSelector` Component

Refactor the component to use the dropdown pattern:
- Collapsed state: Shows selected member with avatar, or placeholder if none selected
- Expanded state: Search input + scrollable list of members
- Each member row: Avatar + display name

### 3. Accessibility Requirements

- `role="combobox"` on the trigger button
- `role="listbox"` on the dropdown
- `role="option"` on each member item
- `aria-expanded`, `aria-haspopup`, `aria-selected` attributes
- Keyboard navigation: Arrow Up/Down, Enter, Escape
- Focus management when opening/closing

## Visual Design

**Collapsed state:**
```
┌─────────────────────────────────────┐
│ 👤 Alice Smith                    ▼ │
└─────────────────────────────────────┘
```

**Expanded state:**
```
┌─────────────────────────────────────┐
│ Search members...                   │
├─────────────────────────────────────┤
│ 👤 Alice Smith           ✓          │
│ 👤 Bob Johnson                      │
│ 👤 Charlie Brown                    │
└─────────────────────────────────────┘
```

## Files to Modify

1. `webapp-v2/src/app/hooks/usePayerSelector.ts` (new)
2. `webapp-v2/src/components/expense-form/PayerSelector.tsx` (refactor)
3. `webapp-v2/src/locales/en/translation.json` (add search placeholder, etc.)
4. Update relevant tests

## Considerations

- **Small groups**: For groups with only 2-3 members, the current grid layout might actually be faster. Consider whether to conditionally show grid vs dropdown based on member count, or always use dropdown for consistency.

- **Label selector comparison**: The label/tag selector mentioned by the user is "free form" (allows creating new labels). The payer selector should NOT allow creating new members - it's a fixed list selection only.

- **Mobile UX**: Ensure the dropdown works well on mobile devices with touch interaction.

## Testing

- Unit tests for `usePayerSelector` hook
- Integration tests for keyboard navigation
- E2E tests for the expense form flow
- Verify existing expense form tests still pass
