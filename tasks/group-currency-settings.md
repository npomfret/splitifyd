# Feature: Group-Specific Currency Settings

## Objective

To provide group administrators with the ability to control which currencies are used within a group, reducing errors and simplifying expense entry for members.

## Background

Currently, the expense form allows users to select any currency supported by the application. For groups that operate exclusively in one or a few currencies (e.g., a trip to one country), this unrestricted list can be cumbersome and lead to users accidentally selecting the wrong currency. This feature will allow group admins to define a list of permitted currencies and a default for their group.

---

## Clarifications from Codebase Research

| Topic | Finding |
|-------|---------|
| **Group roles** | Only `admin`, `member`, `viewer` exist. There is NO `owner` role. |
| **Permission model** | `updateGroup` uses `ensureActiveGroupAdmin()` which requires `memberRole === MemberRoles.ADMIN` |
| **Currency type** | `CurrencyISOCode` is a branded string type in `shared-types.ts` |
| **Currency data** | ~160+ currencies defined in `packages/shared/src/currency-data.ts` |
| **Expense validation** | `ExpenseService` already fetches group via `getGroupAccessContext()` before expense creation - ideal insertion point |
| **Settings UI** | Tab-based modal with role-based visibility pattern in `GroupSettingsModal.tsx` |
| **Currency dropdown** | Uses `CurrencyService` with `getCurrencies()`, `filterCurrencies()`, `groupCurrencies()` methods |
| **Group creation** | Phase 5 (currency settings during creation) is **required for MVP** |
| **UX decision** | Currency dropdown should be filtered **silently** - no explanatory message needed |

---

## High-Level Requirements

1. **Group Configuration:** Group admins should be able to define an optional list of "permitted currencies" for their group.
2. **Default Currency:** Within the list of permitted currencies, one can be designated as the default for new expenses.
3. **Expense Form UI:** The currency dropdown in the expense form should be dynamically filtered based on the group's settings. If permitted currencies are defined, only those are shown (silently). If not, all currencies are shown. The form should also use the group's default currency.
4. **Backend Enforcement:** The API must validate that any new or updated expense uses a currency that is in the group's permitted list (if one is set).

---

## Implementation Plan

### Phase 1: Shared Types & Schemas

**File:** `packages/shared/src/shared-types.ts`

```typescript
export interface GroupCurrencySettings {
  permitted: CurrencyISOCode[];  // Array of permitted ISO currency codes (e.g., ['USD', 'EUR'])
  default: CurrencyISOCode;      // The default currency for the group
}

// Update Group interface (around line 804):
interface Group {
    // ... existing fields
    currencySettings?: GroupCurrencySettings;
}

// Update CreateGroupRequest:
export interface CreateGroupRequest {
    // ... existing fields
    currencySettings?: GroupCurrencySettings;
}

// Update UpdateGroupRequest:
export interface UpdateGroupRequest {
    // ... existing fields
    currencySettings?: GroupCurrencySettings | null; // null to clear
}
```

**File:** `packages/shared/src/schemas/apiRequests.ts`

```typescript
export const GroupCurrencySettingsSchema = z.object({
    permitted: z.array(CurrencyCodeSchema).nonempty('At least one currency required'),
    default: CurrencyCodeSchema,
}).refine(
    data => data.permitted.includes(data.default),
    { message: 'Default currency must be in permitted list', path: ['default'] }
);
```

---

### Phase 2: Backend Implementation

**2.1 Update Group Schema**

**File:** `firebase/functions/src/schemas/group.ts`

Add `currencySettings` to `BaseGroupSchema`:
```typescript
currencySettings: z.object({
    permitted: z.array(z.string().length(3)).nonempty(),
    default: z.string().length(3),
}).refine(data => data.permitted.includes(data.default), {
    message: 'Default currency must be in permitted list',
    path: ['default'],
}).optional(),
```

**2.2 Update Group Validation**

**File:** `firebase/functions/src/groups/validation.ts`

- Add `currencySettings` to `CreateGroupRequestSchema` (optional)
- Add `currencySettings` to `UpdateGroupRequestSchema` (optional, nullable to clear)

**2.3 Permission Check**

**No additional check needed.** The existing `updateGroup` in `GroupService.ts` already uses `ensureActiveGroupAdmin()` at line 146 via `fetchGroupWithAccess(groupId, userId, true)`. Only admins can update groups, including currency settings.

**2.4 Add Currency Validation to Expense Service**

**File:** `firebase/functions/src/services/ExpenseService.ts`

In `_createExpense()` after `getGroupAccessContext()` (around line 136):
```typescript
if (group.currencySettings?.permitted) {
    if (!group.currencySettings.permitted.includes(validatedExpenseData.currency)) {
        throw Errors.forbidden('currency', ErrorDetail.CURRENCY_NOT_PERMITTED);
    }
}
```

In `_updateExpense()` when currency is being changed (around line 322):
```typescript
if (updates.currency && group.currencySettings?.permitted) {
    if (!group.currencySettings.permitted.includes(updates.currency)) {
        throw Errors.forbidden('currency', ErrorDetail.CURRENCY_NOT_PERMITTED);
    }
}
```

**2.5 Add Error Detail Code**

**File:** `firebase/functions/src/errors/ErrorDetail.ts`

```typescript
CURRENCY_NOT_PERMITTED = 'CURRENCY_NOT_PERMITTED',
```

---

### Phase 3: Frontend - Group Settings UI

**3.1 Create Currency Settings Component**

**File:** `webapp-v2/src/components/group/settings/GroupCurrencySettings.tsx` (new)

Presentational component that renders:
- Toggle to enable/disable currency restrictions
- Multi-select for permitted currencies (from full currency list via `CurrencyService`)
- Dropdown for default currency (filtered to selected permitted currencies)

**3.2 Create Hook for Currency Settings State**

**File:** `webapp-v2/src/app/hooks/useGroupCurrencySettings.ts` (new)

Manages:
- Current settings state (from group data)
- Form state for edits
- Validation (default must be in permitted)
- Submit logic (calls `apiClient.updateGroup()`)

**3.3 Add to Group General Settings Tab**

**File:** `webapp-v2/src/components/group/settings/GroupGeneralTabContent.tsx`

Add currency settings section **only for admins**:
```typescript
{isAdmin && (
    <GroupCurrencySettings
        settings={currencySettings}
        onChange={onCurrencySettingsChange}
        onSave={onCurrencySettingsSave}
    />
)}
```

The admin check uses `memberRole === MemberRoles.ADMIN`.

**3.4 Add Translations**

**File:** `webapp-v2/src/locales/en/translation.json`

```json
"groupSettings": {
    "currencySettings": {
        "title": "Currency Settings",
        "description": "Restrict which currencies can be used for expenses in this group",
        "enabled": "Restrict currencies",
        "permittedLabel": "Permitted currencies",
        "defaultLabel": "Default currency",
        "noPermittedCurrencies": "Select at least one currency",
        "defaultNotInPermitted": "Default must be a permitted currency"
    }
}
```

---

### Phase 4: Frontend - Expense Form Integration

**4.1 Pass Group Currency Settings to Expense Form**

**File:** `webapp-v2/src/components/expense-form/ExpenseFormModal.tsx`

The expense form already has access to the group via stores. Pass `group.currencySettings` to `CurrencyAmountInput`.

**4.2 Filter Currency Dropdown**

**File:** `webapp-v2/src/components/ui/CurrencyAmountInput.tsx`

Add optional `permittedCurrencies?: CurrencyISOCode[]` prop:
```typescript
interface CurrencyAmountInputProps {
    // ... existing props
    permittedCurrencies?: CurrencyISOCode[];
}
```

In `useCurrencySelector`, filter before grouping:
```typescript
const availableCurrencies = permittedCurrencies
    ? allCurrencies.filter(c => permittedCurrencies.includes(c.acronym))
    : allCurrencies;
```

**4.3 Use Group Default Currency**

**File:** `webapp-v2/src/app/hooks/expense-form/useFormInitialization.ts`

When initializing a new expense, check for group default:
```typescript
const getDefaultCurrency = (): CurrencyISOCode => {
    // 1. If group has currency settings, use group default
    if (group?.currencySettings?.default) {
        return group.currencySettings.default;
    }
    // 2. Otherwise, use most recent expense currency or fallback (existing logic)
};
```

---

### Phase 5: Frontend - Group Creation Flow (Required)

**File:** `webapp-v2/src/components/dashboard/CreateGroupModal.tsx`

Add a collapsible "Advanced Settings" section:
```typescript
<details className="mt-4">
    <summary className="cursor-pointer text-sm text-text-muted">
        {t('createGroupModal.advancedSettings')}
    </summary>
    <div className="mt-3 space-y-4">
        <GroupCurrencySettingsInline
            settings={currencySettings}
            onChange={setCurrencySettings}
        />
    </div>
</details>
```

Include `currencySettings` in the `createGroup` request payload.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/shared-types.ts` | Add `GroupCurrencySettings`, update `Group`, `CreateGroupRequest`, `UpdateGroupRequest` |
| `packages/shared/src/schemas/apiRequests.ts` | Add `GroupCurrencySettingsSchema` |
| `firebase/functions/src/schemas/group.ts` | Add currency settings to group schema |
| `firebase/functions/src/groups/validation.ts` | Add currency settings validation |
| `firebase/functions/src/services/ExpenseService.ts` | Add currency validation in create/update |
| `firebase/functions/src/errors/ErrorDetail.ts` | Add `CURRENCY_NOT_PERMITTED` |
| `webapp-v2/src/components/group/settings/GroupCurrencySettings.tsx` | New component |
| `webapp-v2/src/components/group/settings/GroupGeneralTabContent.tsx` | Add currency settings section |
| `webapp-v2/src/components/dashboard/CreateGroupModal.tsx` | Add advanced settings section |
| `webapp-v2/src/components/ui/CurrencyAmountInput.tsx` | Add filtering support |
| `webapp-v2/src/app/hooks/expense-form/useFormInitialization.ts` | Use group default currency |
| `webapp-v2/src/locales/en/translation.json` | Add translations |

---

## Testing Plan

### Backend Unit Tests (`firebase/functions/src/__tests__/unit/api/`)

- **Group creation with currency settings** - verify settings are saved
- **Group update with currency settings by admin** - should succeed
- **Group update with currency settings by member** - should fail with FORBIDDEN
- **Expense creation with permitted currency** - should succeed
- **Expense creation with non-permitted currency** - should fail with CURRENCY_NOT_PERMITTED
- **Expense creation when no settings** - any currency allowed
- **Clearing currency settings** - setting to null removes restriction
- **Validation: default not in permitted** - should reject

### Frontend Playwright Tests (`webapp-v2/src/__tests__/integration/playwright/`)

- **Currency settings visibility** - admin sees section, member/viewer does not
- **Adding/removing permitted currencies** - UI updates correctly
- **Default currency selection** - only shows permitted currencies
- **Expense form filtering** - only shows permitted currencies (silently)
- **Expense form default** - uses group default currency
- **Group creation with settings** - advanced settings section works
- **Editing existing expense** - shows expense's original currency

---

## Notes

- **Existing expenses are NOT affected** - no retroactive enforcement
- **No explanatory message** in expense form when currencies are restricted (silent filtering)
- **Admin role only** - member and viewer roles cannot modify currency settings
- **No owner role exists** - all permission references should use `admin`

## Future Considerations

- **Multi-currency Groups:** For groups that frequently use many currencies, this feature might be less useful. The ability to easily enable/disable it is key.
