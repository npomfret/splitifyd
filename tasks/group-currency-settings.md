# Feature: Group-Specific Currency Settings

## Objective
To provide group administrators with the ability to control which currencies are used within a group, reducing errors and simplifying expense entry for members.

## Background
Currently, the expense form allows users to select any currency supported by the application. For groups that operate exclusively in one or a few currencies (e.g., a trip to one country), this unrestricted list can be cumbersome and lead to users accidentally selecting the wrong currency. This feature will allow group owners to define a list of permitted currencies and a default for their group.

---

## High-Level Requirements

1.  **Group Configuration:** Group owners should be able to define an optional list of "permitted currencies" for their group.
2.  **Default Currency:** Within the list of permitted currencies, one can be designated as the default for new expenses.
3.  **Expense Form UI:** The currency dropdown in the expense form should be dynamically filtered based on the group's settings. If permitted currencies are defined, only those are shown. If not, all currencies are shown. The form should also use the group's default currency.
4.  **Backend Enforcement:** The API must validate that any new or updated expense uses a currency that is in the group's permitted list (if one is set).

---

## Implementation Plan

### Phase 1: Database and Shared Type Changes

**File:** `packages/shared/src/shared-types.ts`
- Update the `GroupDTO` and `GroupDocument` (implicitly via `GroupDTO`) to include the new currency settings.

```typescript
// In packages/shared/src/shared-types.ts

export interface GroupCurrencySettings {
  permitted: Currency[]; // Array of permitted ISO currency codes (e.g., ['USD', 'EUR'])
  default: Currency;     // The default currency for the group
}

export interface GroupDTO {
  // ... existing fields
  currencySettings?: GroupCurrencySettings; // Make it optional
}

export interface UpdateGroupRequest {
    // ... existing fields
    currencySettings?: GroupCurrencySettings | null; // Allow unsetting
}
```

**File:** `firebase/functions/src/schemas/group.ts`
- Update the Zod schema for group documents to validate the new structure.

```typescript
// In firebase/functions/src/schemas/group.ts

export const GroupCurrencySettingsSchema = z.object({
  permitted: z.array(z.string().length(3)).nonempty(), // Must have at least one
  default: z.string().length(3),
}).refine(data => data.permitted.includes(data.default), {
  message: "Default currency must be in the permitted list",
  path: ["default"],
});

export const GroupDocumentSchema = z.object({
    // ... existing fields
    currencySettings: GroupCurrencySettingsSchema.optional(),
});
```

### Phase 2: Backend Implementation

**1. Update Group Settings API**
**File:** `firebase/functions/src/groups/handlers.ts`
- Modify the `updateGroup` handler to accept and validate the `currencySettings` object.
- The validation middleware for the update endpoint needs to be updated to use the new schema.

**2. Server-Side Expense Validation**
**File:** `firebase/functions/src/expenses/handlers.ts`
- In `createExpense` and `updateExpense` handlers:
    1. Before creating/updating an expense, retrieve the group document.
    2. Check if `group.currencySettings` exists and has a `permitted` list.
    3. If it does, verify that the `currency` of the incoming expense is present in the `permitted` array.
    4. If the check fails, throw an `ApiError` with a `FORBIDDEN` or `INVALID_REQUEST` status and a specific error code like `CURRENCY_NOT_PERMITTED`.

### Phase 3: Frontend - Group Settings UI

**File:** `webapp-v2/src/components/group/settings/GroupGeneralTabContent.tsx` (or a new tab)
- Add a new section in the Group Settings modal for "Currency Settings".
- This section should only be visible to group owners/admins.
- The UI should consist of:
    - A multi-select input or checklist to choose permitted currencies from the master list of all currencies.
    - A dropdown/radio button group to select the default currency *from the list of selected permitted currencies*. This dropdown should be disabled until at least one currency is permitted.
    - A toggle to enable/disable the feature. If disabled, the `currencySettings` field on the group document should be removed.

### Phase 4: Frontend - Expense Form Integration

**File:** `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx`
**Hook:** `webapp-v2/src/app/hooks/useExpenseForm.ts`
- When the expense form is initialized for a group:
    1. Check the `group` object (available in the `enhancedGroupDetailStore`) for `currencySettings`.
    2. **Filter Currency List:**
       - If `group.currencySettings.permitted` exists and is not empty, pass this filtered list to the currency `Select` component in the form.
       - Otherwise, pass the full list of currencies as is currently done.
    3. **Set Default Currency:**
       - When adding a *new* expense, the form's initial currency value should be `group.currencySettings.default`.
       - If `currencySettings` are not defined, it should fall back to the user's last-used currency or a sensible default (current behavior).
       - When editing an expense, the form should show the expense's existing currency, regardless of the default.

---

## Testing Plan

### Backend (Unit/Integration Tests)
- **Group Settings:**
    - Test that `updateGroup` correctly saves valid `currencySettings`.
    - Test that it rejects settings where the `default` is not in the `permitted` list.
    - Test that it allows `currencySettings` to be set to `null` or `undefined` to disable the feature.
- **Expense Creation:**
    - Test that `createExpense` succeeds if the currency is in the permitted list.
    - Test that `createExpense` fails with a specific error if the currency is *not* in the permitted list.
    - Test that `createExpense` succeeds with any currency if the group has no `currencySettings`.

### Frontend (Playwright E2E Tests)
- **Group Settings UI:**
    - As a group owner, navigate to settings and verify the new currency section appears.
    - Test selecting a few currencies and setting one as the default. Save and reopen to ensure settings persist.
    - Test that the default currency dropdown is populated only with the selected permitted currencies.
    - Test unsetting the configuration.
- **Expense Form:**
    - In a group with currency settings, open the "Add Expense" form and verify the currency dropdown contains only the permitted currencies.
    - Verify the default currency is pre-selected.
    - In a group *without* currency settings, verify the currency dropdown shows all currencies.
    - Edit an existing expense and confirm its original currency is selected, even if it's not the group's default.

---

## Future Considerations
- **Multi-currency Groups:** For groups that frequently use many currencies, this feature might be less useful. The ability to easily enable/disable it is key.
- **Initial Group Setup:** Consider adding this as an option during group creation.
