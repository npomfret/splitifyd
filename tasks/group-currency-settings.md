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
| **Currency type** | `CurrencyISOCode` is a branded string type in `shared-types.ts` (line 127) |
| **Currency data** | 164 currencies defined in `packages/shared/src/currency-data.ts` |
| **Expense validation** | `ExpenseService` already fetches group via `getGroupAccessContext()` before expense creation - ideal insertion point |
| **Settings UI** | Tab-based modal with role-based visibility pattern in `GroupSettingsModal.tsx` |
| **Currency dropdown** | Uses `CurrencyService` with `getCurrencies()`, `filterCurrencies()`, `groupCurrencies()` methods |
| **Group creation** | Phase 5 (currency settings during creation) is **required for MVP** |
| **UX decision** | Currency dropdown should be filtered **silently** - no explanatory message needed |

---

## Detailed Codebase Findings

### Current Group Data Model

**Location:** `packages/shared/src/shared-types.ts`

```typescript
// GroupDTO (lines 834-836)
export interface GroupDTO extends Group, BaseDTO<GroupId> {
    deletedAt: ISOString | null;
}

// Base Group interface (lines 808-829)
interface Group {
    name: GroupName;
    description?: string;
    createdBy: UserId;
    permissions: GroupPermissions;
    permissionHistory?: PermissionChangeLog[];
    inviteLinks?: Record<string, InviteLink>;
    balance?: { balancesByCurrency: Record<string, CurrencyBalance> };
    lastActivity?: string;
    // currencySettings will be added here
}
```

### Permission Check Pattern

**Location:** `firebase/functions/src/services/GroupMemberService.ts` (lines 49-65)

```typescript
async ensureActiveGroupAdmin(
    groupId: GroupId,
    userId: UserId | null | undefined,
    options: AdminGuardOptions = {},
): Promise<GroupMembershipDTO> {
    if (!userId) {
        throw options.unauthorizedErrorFactory?.() ?? Errors.authRequired();
    }
    const membership = await this.firestoreReader.getGroupMember(groupId, userId);
    if (!membership ||
        membership.memberRole !== MemberRoles.ADMIN ||
        membership.memberStatus !== MemberStatuses.ACTIVE) {
        throw options.forbiddenErrorFactory?.() ?? Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
    }
    return membership;
}
```

### ExpenseService Validation Points

**Location:** `firebase/functions/src/services/ExpenseService.ts`

**`_createExpense()` method (lines 124-295):**
```typescript
async _createExpense(groupId, userId, requestData) {
    const validatedExpenseData = validateCreateExpense(requestData);  // Line 128

    const { group, membership } = await this.groupMemberService.getGroupAccessContext(
        groupId, userId  // Line 136 - THIS IS WHERE WE GET GROUP DATA
    );

    await this.permissionEngine.checkPermission(...);  // Line 140

    // Currency validation would go HERE (after line 143, before expense creation)
}
```

### CurrencyAmountInput Component

**Location:** `webapp-v2/src/components/ui/CurrencyAmountInput.tsx`

```typescript
interface CurrencyAmountInputProps {
    amount: Amount;
    currency: string;
    onAmountChange: (amount: string) => void;
    onCurrencyChange: (currency: string) => void;
    onAmountBlur?: () => void;
    label?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    recentCurrencies?: string[];  // Already has filtering support
    // Will add: permittedCurrencies?: CurrencyISOCode[];
}
```

### Default Currency Logic

**Location:** `webapp-v2/src/app/hooks/useFormInitialization.ts` (lines 118-141)

```typescript
const setDefaultsForCreateMode = () => {
    const expenses = enhancedGroupDetailStore.expenses;
    let detectedCurrency: CurrencyISOCode = toCurrencyISOCode('USD');

    // Try to get currency from most recent expense
    if (expenses && expenses.length > 0) {
        detectedCurrency = expenses[0].currency;
    }

    expenseFormStore.updateField('currency', detectedCurrency);
    // Will update: Check group.currencySettings.default FIRST
};
```

### GroupSettingsModal Structure

**Location:** `webapp-v2/src/components/group/GroupSettingsModal.tsx`

Tab types: `'identity'`, `'general'`, `'security'`

```typescript
// Tab availability based on permissions
const generalTabAvailable = canManageGeneralSettings;  // Admin only
const identityTabAvailable = true;
const securityTabAvailable = isGroupOwner || canManageMembers || canApproveMembers;

// Tabs rendered conditionally
{activeTab === 'general' && generalTabAvailable && renderGeneralTab()}
```

### Error Code System

**Location:** `firebase/functions/src/errors/ErrorCode.ts`

Two-tier system:
- **ErrorCode** (12 category codes): `FORBIDDEN`, `VALIDATION_ERROR`, etc.
- **ErrorDetail** (100+ specific codes): `NOT_GROUP_ADMIN`, `INVALID_AMOUNT`, etc.

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

---

## Implementation Status

### Phase 1: Shared Types & Schemas
- [x] Add `GroupCurrencySettings` interface to `shared-types.ts`
- [x] Add `currencySettings` to `Group` interface
- [x] Add `currencySettings` to `CreateGroupRequest`
- [x] Add `currencySettings` to `UpdateGroupRequest` (nullable)
- [x] Add `GroupCurrencySettingsSchema` to `apiRequests.ts`
- [x] Update `CreateGroupRequestSchema` with currency settings
- [x] Update `UpdateGroupRequestSchema` with currency settings

### Phase 2: Backend Implementation
- [x] Add `currencySettings` to Firestore `BaseGroupSchema`
- [x] Add currency settings to `groups/validation.ts`
- [x] Add `CURRENCY_NOT_PERMITTED` to `ErrorDetail`
- [x] Add currency validation to `ExpenseService._createExpense()`
- [x] Add currency validation to `ExpenseService._updateExpense()`
- [x] Add currency validation to `SettlementService._createSettlement()`
- [x] Add currency validation to `SettlementService._updateSettlement()`
- [x] Add `currencySettings` pass-through in `GroupService.createGroup()`
- [x] Add `currencySettings` handling in `GroupService.updateGroup()`

### Phase 3: Frontend - Group Settings UI
- [x] Create `GroupCurrencySettings.tsx` component
- [x] Create `useGroupCurrencySettings.ts` hook
- [x] Add currency settings to `GroupGeneralTabContent.tsx`
- [x] Add translations to `translation.json`

### Phase 4: Frontend - Expense Form Integration
- [x] Add `permittedCurrencies` prop to `CurrencyAmountInput.tsx`
- [x] Update `useFormInitialization.ts` for group default currency
- [x] Pass `permittedCurrencies` in `ExpenseFormModal.tsx`

### Phase 5: Frontend - Group Creation Flow
- [x] Add advanced settings section to `CreateGroupModal.tsx`
- [x] Include `currencySettings` in create group request

### Testing
- [x] Backend unit tests for currency settings (24 tests passing)
  - Group creation/update tests (4 + 5)
  - Expense creation/update currency restriction tests (4 + 2)
  - Settlement creation/update currency restriction tests (3 + 2)
  - API response verification tests (2)
  - Existing data readable tests (1)
  - Viewer role rejection test (1)
- [x] Frontend Playwright tests for currency settings UI (12 tests passing)
- [x] Run full build and verify no compilation errors

---

## Progress Summary (December 2025)

### Backend Complete ✅

All backend work is finished. The following files were modified:

| File | Changes |
|------|---------|
| `packages/shared/src/shared-types.ts` | Added `GroupCurrencySettings` interface, updated `Group`, `CreateGroupRequest`, `UpdateGroupRequest` |
| `packages/shared/src/schemas/apiRequests.ts` | Added `GroupCurrencySettingsSchema` with default-in-permitted validation |
| `firebase/functions/src/schemas/group.ts` | Added `currencySettings` to `BaseGroupSchema` (nullable for clearing) |
| `firebase/functions/src/groups/validation.ts` | Added error mappers and transform for `currencySettings` |
| `firebase/functions/src/errors/ErrorCode.ts` | Added `CURRENCY_NOT_PERMITTED` to `ErrorDetail` |
| `firebase/functions/src/services/ExpenseService.ts` | Added currency validation in `_createExpense()` and `_updateExpense()` |
| `firebase/functions/src/services/SettlementService.ts` | Added currency validation in `_createSettlement()` and `_updateSettlement()` |
| `firebase/functions/src/services/GroupService.ts` | Added `currencySettings` handling in `createGroup()` and `updateGroup()` |
| `packages/test-support/src/builders/CreateGroupRequestBuilder.ts` | Added `withCurrencySettings()` and `withCurrencySettingsObject()` |
| `packages/test-support/src/builders/GroupUpdateBuilder.ts` | Added `withCurrencySettings()`, `withCurrencySettingsObject()`, `clearCurrencySettings()` |
| `firebase/functions/src/__tests__/unit/api/group-currency-settings.test.ts` | New test file with 24 comprehensive tests |

### Default Behavior

- Groups are created **without currency restrictions by default**
- When `currencySettings` is absent/undefined, **any currency is allowed**
- Currency restrictions are opt-in via the Group Settings UI (Phase 3)

### Frontend Complete ✅

All frontend work is finished:
- Phase 3: Admin UI for managing currency settings
- Phase 4: Expense form integration (filtering + default currency)
- Phase 5: Optional settings during group creation

**Files modified:**
| File | Changes |
|------|---------|
| `packages/shared/src/schemas/apiSchemas.ts` | Added `currencySettings` to GroupSchema |
| `packages/test-support/src/builders/GroupDTOBuilder.ts` | Added `withCurrencySettings()` method |
| `packages/test-support/src/page-objects/GroupSettingsModalPage.ts` | Added currency settings test helpers |
| `webapp-v2/src/components/group/settings/GroupCurrencySettings.tsx` | New component for currency restrictions UI |
| `webapp-v2/src/app/hooks/useGroupCurrencySettings.ts` | New hook for currency settings state management |
| `webapp-v2/src/components/group/settings/GroupGeneralTabContent.tsx` | Integrated currency settings section |
| `webapp-v2/src/components/group/GroupSettingsModal.tsx` | Wired up currency settings hook |
| `webapp-v2/src/components/ui/CurrencyAmountInput.tsx` | Added `permittedCurrencies` prop |
| `webapp-v2/src/app/hooks/useCurrencySelector.ts` | Added filtering for permitted currencies |
| `webapp-v2/src/app/hooks/useFormInitialization.ts` | Use group default currency |
| `webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx` | Pass permitted currencies to input |
| `webapp-v2/src/components/dashboard/CreateGroupModal.tsx` | Added currency settings during group creation |
| `webapp-v2/src/locales/en/translation.json` | Added currency settings translations |
| `webapp-v2/src/__tests__/integration/playwright/group-currency-settings.test.ts` | New test file with 7 comprehensive tests |
