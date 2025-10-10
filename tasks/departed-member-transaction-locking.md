# Departed Member Transaction Locking

## Problem Statement

When a user leaves a group, their historical expenses and settlements remain in the database. However, editing these transactions becomes problematic because:

1. **Forms break** - dropdowns/selectors only show current members, making departed member UIDs invalid
2. **Validation fails** - backend validates participants must be current group members
3. **Race conditions** - member could leave between form load and submission

**Current state:**
- ✅ Viewing expenses/settlements with departed members works correctly
- ✅ Backend fetches departed member data from Users collection for display
- ✅ Real user profile data preserved for historical accuracy
- ❌ Editing any transaction with departed members is broken/prevented

## Solution: Server-Enforced Transaction Locking

### Core Principle
**Any expense or settlement involving a departed member becomes read-only (locked).**

### Why This Approach?

1. **Data integrity** - Historical records remain accurate and auditable
2. **Simple UX** - Clear messaging: "Cannot edit - member has left"
3. **Minimal complexity** - No need to show departed members in dropdowns
4. **No workarounds needed** - Create new transaction if correction needed

### Lock Status = Computed, Not Stored

Lock status is **computed on-demand** based on current group membership:
- NOT stored in Firestore (would be stale, require migration)
- Recalculated on every read and write operation
- Small performance cost (one `getAllGroupMemberIds()` call)
- Prevents race conditions

## Implementation Plan

### Phase 1: Type Definitions

**File:** `packages/shared/src/shared-types.ts`

Add `isLocked` field to DTOs:

```typescript
export interface ExpenseDTO extends Expense, BaseDTO {
  isLocked?: boolean; // True if any participant has left the group
}

export interface SettlementDTO extends Settlement, BaseDTO {
  isLocked?: boolean; // True if payer or payee has left the group
}

export interface SettlementWithMembers extends SoftDeletable {
  // ... existing fields ...
  isLocked?: boolean; // True if payer or payee has left the group
}
```

### Phase 2: Backend - ExpenseService

**File:** `firebase/functions/src/services/ExpenseService.ts`

#### 2.1 Add Helper Method

```typescript
/**
 * Check if expense is locked due to departed members
 * An expense is locked if any participant is no longer in the group
 */
private async isExpenseLocked(expense: ExpenseDTO): Promise<boolean> {
  const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(expense.groupId);
  return expense.participants.some(uid => !currentMemberIds.includes(uid));
}
```

#### 2.2 Update getExpense() - Add isLocked to Response

After line 207 (`return this.transformExpenseToResponse(expense)`):

```typescript
private async _getExpense(expenseId: string, userId: string): Promise<any> {
  // ... existing code ...

  const isLocked = await this.isExpenseLocked(expense);

  return {
    ...this.transformExpenseToResponse(expense),
    isLocked
  };
}
```

#### 2.3 Update getExpenseFullDetails() - Add isLocked to Response

After line 688 (`const expenseResponse = this.transformExpenseToResponse(expense)`):

```typescript
async getExpenseFullDetails(expenseId: string, userId: string): Promise<ExpenseFullDetailsDTO> {
  // ... existing code ...

  const isLocked = await this.isExpenseLocked(expense);

  return {
    expense: {
      ...expenseResponse,
      isLocked
    },
    group,
    members: { members: participantData }
  };
}
```

#### 2.4 Update listGroupExpenses() - Add isLocked to Each Expense

After line 526 (`const expenses = result.expenses.map(...)`):

```typescript
private async _listGroupExpenses(...): Promise<...> {
  // ... existing code to fetch expenses ...

  // Get current member IDs once for all expenses
  const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);

  // Transform expenses and compute lock status
  const expenses = result.expenses.map((validatedExpense) => {
    const isLocked = validatedExpense.participants.some(
      uid => !currentMemberIds.includes(uid)
    );

    return {
      id: validatedExpense.id,
      ...this.transformExpenseToResponse(this.normalizeValidatedExpense(validatedExpense)),
      isLocked
    };
  });

  // ... rest of method ...
}
```

#### 2.5 Enforce Lock in createExpense()

After line 253 (participant validation loop):

```typescript
private async _createExpense(userId: string, expenseData: CreateExpenseRequest): Promise<any> {
  // ... existing validation ...

  // Verify all participants are still in the group (race condition protection)
  for (const participantId of validatedExpenseData.participants) {
    if (!memberIds.includes(participantId)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'MEMBER_NOT_IN_GROUP',
        `Cannot create expense - participant ${participantId} is not in the group`
      );
    }
  }

  // ... continue with creation ...
}
```

#### 2.6 Enforce Lock in updateExpense()

At start of `_updateExpense()` method, after fetching expense (around line 349):

```typescript
private async _updateExpense(expenseId: string, userId: string, updateData: UpdateExpenseRequest): Promise<any> {
  // ... fetch expense ...

  // Check if expense is locked (any participant has left)
  const isLocked = await this.isExpenseLocked(expense);
  if (isLocked) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'EXPENSE_LOCKED',
      'Cannot edit expense - one or more participants have left the group'
    );
  }

  // ... continue with existing update logic ...
}
```

### Phase 3: Backend - SettlementService

**File:** `firebase/functions/src/services/SettlementService.ts`

#### 3.1 Add Helper Method

```typescript
/**
 * Check if settlement is locked due to departed members
 * A settlement is locked if payer or payee is no longer in the group
 */
private async isSettlementLocked(settlement: SettlementDTO, groupId: string): Promise<boolean> {
  const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
  return !currentMemberIds.includes(settlement.payerId) ||
         !currentMemberIds.includes(settlement.payeeId);
}
```

#### 3.2 Update listSettlements() - Add isLocked to Each Settlement

In `_getGroupSettlementsData()` around line 601-620:

```typescript
private async _getGroupSettlementsData(...): Promise<...> {
  // ... fetch settlements ...

  // Get current member IDs once for all settlements
  const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);

  const settlements: SettlementWithMembers[] = await Promise.all(
    result.settlements.map(async (settlement) => {
      const [payerData, payeeData] = await Promise.all([
        this.fetchGroupMemberData(groupId, settlement.payerId),
        this.fetchGroupMemberData(groupId, settlement.payeeId)
      ]);

      // Compute lock status
      const isLocked = !currentMemberIds.includes(settlement.payerId) ||
                       !currentMemberIds.includes(settlement.payeeId);

      return {
        id: settlement.id,
        groupId: settlement.groupId,
        payer: payerData,
        payee: payeeData,
        amount: settlement.amount,
        currency: settlement.currency,
        date: dateHelpers.timestampToISO(settlement.date),
        note: settlement.note,
        createdAt: dateHelpers.timestampToISO(settlement.createdAt),
        deletedAt: settlement.deletedAt,
        deletedBy: settlement.deletedBy,
        isLocked
      } as SettlementWithMembers;
    }),
  );

  // ... rest of method ...
}
```

#### 3.3 Update createSettlement() - Improve Error Message

The validation already exists at lines 193-197. Just ensure clear error:

```typescript
private async _createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<SettlementDTO> {
  // ... existing code ...

  // Verify payer and payee are still in the group (race condition protection)
  for (const uid of [settlementData.payerId, settlementData.payeeId]) {
    if (!memberIds.includes(uid)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'MEMBER_NOT_IN_GROUP',
        `Cannot create settlement - user is not in the group`
      );
    }
  }

  // ... continue with creation ...
}
```

#### 3.4 Enforce Lock in updateSettlement()

At start of `_updateSettlement()` method, after fetching settlement (around line 289):

```typescript
private async _updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementWithMembers> {
  // ... fetch settlement ...

  // Check if settlement is locked (payer or payee has left)
  const isLocked = await this.isSettlementLocked(settlement, settlement.groupId);
  if (isLocked) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'SETTLEMENT_LOCKED',
      'Cannot edit settlement - payer or payee has left the group'
    );
  }

  // ... continue with existing update logic ...
}
```

### Phase 4: Frontend - ExpenseDetailPage

**File:** `webapp-v2/src/pages/ExpenseDetailPage.tsx`

#### 4.1 Add Lock Warning Banner

After line 217 (inside content section, before first Card):

```tsx
{/* Content */}
<div className='max-w-3xl mx-auto px-4 py-6'>
  <Stack spacing='md'>
    {/* Lock Warning Banner */}
    {expense.value.isLocked && (
      <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
        <div className='flex items-start gap-3'>
          <span className='text-2xl'>⚠️</span>
          <div>
            <p className='font-semibold text-yellow-900 dark:text-yellow-100'>
              {t('pages.expenseDetailPage.cannotEdit')}
            </p>
            <p className='text-sm text-yellow-800 dark:text-yellow-200 mt-1'>
              {t('pages.expenseDetailPage.containsDepartedMembers')}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Consolidated Top Card - Main Info, Paid By, Actions, and Metadata */}
    <Card>
```

#### 4.2 Disable Edit Button When Locked

Update the `ExpenseActions` component call around line 261:

```tsx
<ExpenseActions
  expense={expense.value}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onShare={handleShare}
  onCopy={handleCopy}
  disabled={expense.value.isLocked}
/>
```

#### 4.3 Update ExpenseActions Component

**File:** `webapp-v2/src/components/expense/ExpenseActions.tsx`

Add `disabled` prop and apply to edit button:

```tsx
interface ExpenseActionsProps {
  expense: any;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onShare: () => void;
  onCopy: () => void;
  disabled?: boolean; // New prop
}

export function ExpenseActions({ expense, onEdit, onDelete, onShare, onCopy, disabled }: ExpenseActionsProps) {
  // ... existing code ...

  return (
    <div className='flex gap-2 flex-wrap'>
      <Button
        variant='secondary'
        size='sm'
        onClick={onEdit}
        disabled={disabled} // Apply disabled state
        title={disabled ? t('expenseActions.cannotEditTooltip') : undefined}
      >
        {t('expenseActions.edit')}
      </Button>
      {/* ... other buttons ... */}
    </div>
  );
}
```

### Phase 5: Frontend - AddExpensePage (Edit Mode Guard)

**File:** `webapp-v2/src/pages/AddExpensePage.tsx`

#### 5.1 Check Lock Status in useExpenseForm Hook

**File:** `webapp-v2/src/app/hooks/useExpenseForm.ts`

In the initialization effect that loads expense data for edit mode:

```typescript
useEffect(() => {
  if (isEditMode && expenseId) {
    const loadExpenseForEdit = async () => {
      try {
        const expenseData = await apiClient.getExpense(expenseId);

        // Check if expense is locked
        if (expenseData.isLocked) {
          setInitError(t('expenseForm.errors.expenseLocked'));
          return;
        }

        // ... continue loading expense data ...
      } catch (error) {
        // ... error handling ...
      }
    };

    loadExpenseForEdit();
  }
}, [isEditMode, expenseId]);
```

The error will be displayed by the existing error UI in AddExpensePage.tsx (lines 68-84).

### Phase 6: Frontend - SettlementForm

**File:** `webapp-v2/src/components/settlements/SettlementForm.tsx`

#### 6.1 Add Lock Check in Edit Mode

After line 44 (in the useEffect that populates form for edit mode):

```typescript
useEffect(() => {
  if (isOpen) {
    if (editMode && settlementToEdit) {
      // Check if settlement is locked
      if (settlementToEdit.isLocked) {
        setValidationError(t('settlementForm.errors.settlementLocked'));
        setIsSubmitting(false);
        return;
      }

      // Pre-populate form with settlement data for editing
      setPayerId(settlementToEdit.payer.uid);
      // ... rest of form population ...
    }
    // ... rest of useEffect ...
  }
}, [isOpen, editMode, settlementToEdit, preselectedDebt, currentUser]);
```

#### 6.2 Disable Form When Locked

Update the form submission button around line 435:

```tsx
<Button
  type='submit'
  variant='primary'
  disabled={!isFormValid || isSubmitting || settlementToEdit?.isLocked}
  loading={isSubmitting}
  className='flex-1'
  data-testid='save-settlement-button'
>
  {/* ... button text ... */}
</Button>
```

### Phase 7: Frontend - SettlementHistory

**File:** `webapp-v2/src/components/settlements/SettlementHistory.tsx`

Disable edit button for locked settlements:

```tsx
<button
  onClick={() => handleEditSettlement(settlement)}
  disabled={settlement.isLocked}
  title={settlement.isLocked ? t('settlementHistory.cannotEditTooltip') : undefined}
  className='text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed'
>
  {t('settlementHistory.edit')}
</button>
```

### Phase 8: Translation Keys

**File:** `webapp-v2/src/locales/en/translation.json`

Add translation keys:

```json
{
  "pages": {
    "expenseDetailPage": {
      "cannotEdit": "This expense cannot be edited",
      "containsDepartedMembers": "One or more participants have left the group. Historical records are preserved as read-only."
    }
  },
  "expenseActions": {
    "cannotEditTooltip": "Cannot edit - participant has left the group"
  },
  "expenseForm": {
    "errors": {
      "expenseLocked": "This expense cannot be edited because one or more participants have left the group."
    }
  },
  "settlementForm": {
    "errors": {
      "settlementLocked": "This settlement cannot be edited because a participant has left the group."
    }
  },
  "settlementHistory": {
    "cannotEditTooltip": "Cannot edit - member has left the group"
  }
}
```

### Phase 9: Backend Integration Tests

**File:** `firebase/functions/src/__tests__/integration/expenses-consolidated.test.ts`

Add new test after line 552 (end of "Full Details API and Complex Data Handling" describe block):

```typescript
describe('Expense Locking for Departed Members', () => {
  test('should mark expense as locked when participant leaves', async () => {
    // Create expense with 3 participants
    const expense = await apiDriver.createExpense(
      new CreateExpenseRequestBuilder()
        .withGroupId(testGroup.id)
        .withAmount(90)
        .withCurrency('USD')
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid, users[2].uid])
        .withSplitType('equal')
        .build(),
      users[0].token
    );

    // Verify expense is not locked initially
    const initialDetails = await apiDriver.getExpense(expense.id, users[0].token);
    expect(initialDetails.isLocked).toBe(false);

    // User 1 settles debt and leaves
    await apiDriver.createSettlement(
      {
        groupId: testGroup.id,
        payerId: users[1].uid,
        payeeId: users[0].uid,
        amount: 30,
        currency: 'USD'
      },
      users[1].token
    );
    await apiDriver.leaveGroup(testGroup.id, users[1].token);

    // Verify expense is now locked
    const lockedDetails = await apiDriver.getExpense(expense.id, users[0].token);
    expect(lockedDetails.isLocked).toBe(true);

    // Verify update is blocked
    await expect(
      apiDriver.updateExpense(
        expense.id,
        { description: 'Updated description' },
        users[0].token
      )
    ).rejects.toThrow(/EXPENSE_LOCKED/);
  });

  test('should prevent creating expense with departed member', async () => {
    // User 2 leaves the group
    await apiDriver.leaveGroup(testGroup.id, users[2].token);

    // Attempt to create expense with departed member
    await expect(
      apiDriver.createExpense(
        new CreateExpenseRequestBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid, users[2].uid])
          .build(),
        users[0].token
      )
    ).rejects.toThrow(/MEMBER_NOT_IN_GROUP/);
  });

  test('should show isLocked in expense list response', async () => {
    // Create expense
    const expense = await apiDriver.createExpense(
      new CreateExpenseRequestBuilder()
        .withGroupId(testGroup.id)
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .withSplitType('equal')
        .build(),
      users[0].token
    );

    // Verify not locked in list initially
    const initialList = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
    const initialExpense = initialList.expenses.find(e => e.id === expense.id);
    expect(initialExpense.isLocked).toBe(false);

    // User 1 leaves
    await apiDriver.leaveGroup(testGroup.id, users[1].token);

    // Verify locked in list
    const updatedList = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
    const lockedExpense = updatedList.expenses.find(e => e.id === expense.id);
    expect(lockedExpense.isLocked).toBe(true);
  });

  test('should show isLocked in getExpenseFullDetails response', async () => {
    // Create expense
    const expense = await apiDriver.createExpense(
      new CreateExpenseRequestBuilder()
        .withGroupId(testGroup.id)
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid, users[2].uid])
        .build(),
      users[0].token
    );

    // Verify not locked initially
    const initialFullDetails = await apiDriver.getExpenseFullDetails(expense.id, users[0].token);
    expect(initialFullDetails.expense.isLocked).toBe(false);

    // User 2 leaves
    await apiDriver.leaveGroup(testGroup.id, users[2].token);

    // Verify locked in full details
    const lockedFullDetails = await apiDriver.getExpenseFullDetails(expense.id, users[0].token);
    expect(lockedFullDetails.expense.isLocked).toBe(true);
  });

  test('should allow deleting locked expenses', async () => {
    // Create expense
    const expense = await apiDriver.createExpense(
      new CreateExpenseRequestBuilder()
        .withGroupId(testGroup.id)
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build(),
      users[0].token
    );

    // User 1 leaves (expense becomes locked)
    await apiDriver.leaveGroup(testGroup.id, users[1].token);

    // Verify expense is locked
    const lockedExpense = await apiDriver.getExpense(expense.id, users[0].token);
    expect(lockedExpense.isLocked).toBe(true);

    // Deletion should still work (soft delete doesn't validate participants)
    await apiDriver.deleteExpense(expense.id, users[0].token);

    // Verify deleted
    await expect(apiDriver.getExpense(expense.id, users[0].token)).rejects.toThrow(/404/);
  });
});
```

**File:** `firebase/functions/src/__tests__/integration/balance-settlement-consolidated.test.ts`

Add tests in the settlements describe block:

```typescript
describe('Settlement Locking for Departed Members', () => {
  test('should mark settlement as locked when payer leaves', async () => {
    // Create settlement
    const settlement = await apiDriver.createSettlement(
      {
        groupId: testGroup.id,
        payerId: users[1].uid,
        payeeId: users[0].uid,
        amount: 50,
        currency: 'USD',
        note: 'Test settlement'
      },
      users[1].token
    );

    // Verify settlement is not locked initially
    const settlements = await apiDriver.getGroupSettlements(testGroup.id, users[0].token);
    const initialSettlement = settlements.settlements.find(s => s.id === settlement.data.id);
    expect(initialSettlement.isLocked).toBe(false);

    // User 1 (payer) leaves the group
    await apiDriver.leaveGroup(testGroup.id, users[1].token);

    // Verify settlement is now locked
    const updatedSettlements = await apiDriver.getGroupSettlements(testGroup.id, users[0].token);
    const lockedSettlement = updatedSettlements.settlements.find(s => s.id === settlement.data.id);
    expect(lockedSettlement.isLocked).toBe(true);

    // Verify update is blocked
    await expect(
      apiDriver.updateSettlement(
        settlement.data.id,
        { amount: 100 },
        users[0].token
      )
    ).rejects.toThrow(/SETTLEMENT_LOCKED/);
  });

  test('should mark settlement as locked when payee leaves', async () => {
    // Create settlement
    const settlement = await apiDriver.createSettlement(
      {
        groupId: testGroup.id,
        payerId: users[0].uid,
        payeeId: users[1].uid,
        amount: 50,
        currency: 'USD'
      },
      users[0].token
    );

    // Verify not locked initially
    const settlements = await apiDriver.getGroupSettlements(testGroup.id, users[0].token);
    const initialSettlement = settlements.settlements.find(s => s.id === settlement.data.id);
    expect(initialSettlement.isLocked).toBe(false);

    // User 1 (payee) leaves
    await apiDriver.leaveGroup(testGroup.id, users[1].token);

    // Verify locked
    const updatedSettlements = await apiDriver.getGroupSettlements(testGroup.id, users[0].token);
    const lockedSettlement = updatedSettlements.settlements.find(s => s.id === settlement.data.id);
    expect(lockedSettlement.isLocked).toBe(true);

    // Verify update blocked
    await expect(
      apiDriver.updateSettlement(
        settlement.data.id,
        { note: 'Updated note' },
        users[0].token
      )
    ).rejects.toThrow(/SETTLEMENT_LOCKED/);
  });

  test('should prevent creating settlement with departed member', async () => {
    // User 2 leaves the group
    await apiDriver.leaveGroup(testGroup.id, users[2].token);

    // Attempt to create settlement with departed member as payer
    await expect(
      apiDriver.createSettlement(
        {
          groupId: testGroup.id,
          payerId: users[2].uid,
          payeeId: users[0].uid,
          amount: 50,
          currency: 'USD'
        },
        users[0].token
      )
    ).rejects.toThrow(/MEMBER_NOT_IN_GROUP/);

    // Attempt to create settlement with departed member as payee
    await expect(
      apiDriver.createSettlement(
        {
          groupId: testGroup.id,
          payerId: users[0].uid,
          payeeId: users[2].uid,
          amount: 50,
          currency: 'USD'
        },
        users[0].token
      )
    ).rejects.toThrow(/MEMBER_NOT_IN_GROUP/);
  });

  test('should show isLocked=false for settlements with current members', async () => {
    // Create settlement with all current members
    const settlement = await apiDriver.createSettlement(
      {
        groupId: testGroup.id,
        payerId: users[0].uid,
        payeeId: users[1].uid,
        amount: 50,
        currency: 'USD'
      },
      users[0].token
    );

    // Verify not locked
    const settlements = await apiDriver.getGroupSettlements(testGroup.id, users[0].token);
    const currentSettlement = settlements.settlements.find(s => s.id === settlement.data.id);
    expect(currentSettlement.isLocked).toBe(false);

    // Should be editable
    const updated = await apiDriver.updateSettlement(
      settlement.data.id,
      { amount: 75 },
      users[0].token
    );
    expect(updated.data.amount).toBe(75);
  });
});
```

### Phase 10: E2E Tests

**File:** `e2e-tests/src/__tests__/integration/departed-member-locking.e2e.test.ts` (NEW FILE)

```typescript
import { authenticatedPageTest } from '../../fixtures/authenticated-page-test';
import { expect } from '@playwright/test';

authenticatedPageTest.describe('Departed Member Transaction Locking', () => {
  authenticatedPageTest('should lock expense when participant leaves', async ({
    authenticatedPage,
    dashboardPage,
    groupDetailPage,
    createGroupModalPage
  }) => {
    // Test implementation
    // 1. Create group with 3 members
    // 2. Create expense with all 3 participants
    // 3. One member settles and leaves
    // 4. Verify expense detail page shows lock warning
    // 5. Verify edit button is disabled
    // 6. Verify attempting to edit via URL redirects with error
  });

  authenticatedPageTest('should lock settlement when member leaves', async ({
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    // Test implementation
    // 1. Create settlement
    // 2. Payer/payee leaves group
    // 3. Verify settlement in history is not editable
    // 4. Verify clicking edit shows error
  });
});
```

## Error Codes

### Backend Error Codes

- `EXPENSE_LOCKED` - Expense cannot be edited (participant departed)
- `SETTLEMENT_LOCKED` - Settlement cannot be edited (payer/payee departed)
- `MEMBER_NOT_IN_GROUP` - Cannot create/update transaction (member not in group)

### HTTP Status Codes

- `400 BAD_REQUEST` - Used for all lock-related errors
- Client should display user-friendly message based on error code

## Performance Considerations

### Lock Status Calculation Cost

Each lock check requires one `getAllGroupMemberIds()` call:
- **Single expense:** 1 call
- **List of 50 expenses:** 1 call (shared for all)
- **Single settlement:** 1 call
- **List of 50 settlements:** 1 call (shared for all)

**Optimization:** In list operations, fetch member IDs once and reuse for all items.

### Caching Strategy

Lock status is NOT cached because:
- Must be accurate at moment of write operation
- Group membership can change between page views
- Stale cache would cause race conditions
- Performance impact is negligible (simple array lookup)

## User Experience

### When User Encounters Locked Transaction

**Viewing:**
- Clear visual indicator (warning banner with ⚠️ icon)
- Explanation: "One or more participants have left the group"
- All other features work normally (view, share, comment, delete)

**Attempting to Edit:**
- Edit button is disabled with tooltip
- If edit attempted via direct URL, redirected with error message
- Message suggests: "To record a correction, create a new transaction"

**Creating New Transaction:**
- If member leaves during form submission, clear error message
- Suggestion to refresh member list

## Migration Notes

**No database migration required:**
- `isLocked` is computed, not stored
- Existing data works immediately
- No backward compatibility concerns

## Implementation Status

### Completed Phases

#### ✅ Phase 1: Type Definitions (COMPLETED)
- Added `isLocked?: boolean` to ExpenseDTO
- Added `isLocked?: boolean` to SettlementDTO
- Added `isLocked?: boolean` to SettlementWithMembers
- Location: `packages/shared/src/shared-types.ts`

#### ✅ Phase 2: Backend - ExpenseService (COMPLETED)
- Added `isExpenseLocked()` helper method
- Updated `_getExpense()` to include isLocked
- Updated `getExpenseFullDetails()` to include isLocked
- Updated `_listGroupExpenses()` to add isLocked to each expense (optimized with single getAllGroupMemberIds call)
- Updated `_createExpense()` to validate participants (MEMBER_NOT_IN_GROUP error)
- Updated `_updateExpense()` to block locked expenses (EXPENSE_LOCKED error)
- Location: `firebase/functions/src/services/ExpenseService.ts`

#### ✅ Phase 3: Backend - SettlementService (COMPLETED)
- Added `isSettlementLocked()` helper method
- Updated `_getGroupSettlementsData()` to add isLocked to each settlement (optimized)
- Updated `_createSettlement()` with improved error messages (MEMBER_NOT_IN_GROUP)
- Updated `_updateSettlement()` to block locked settlements (SETTLEMENT_LOCKED error)
- Location: `firebase/functions/src/services/SettlementService.ts`

#### ✅ Phase 8: Translation Keys (COMPLETED)
- Added `expenseActions.cannotEditTooltip`
- Location: `webapp-v2/src/locales/en/translation.json`
- Note: Only minimal translation keys added. Additional keys may be needed during frontend implementation.

#### ✅ Phase 9: Backend Integration Tests (COMPLETED)
- Created comprehensive integration test suite: `firebase/functions/src/__tests__/integration/departed-member-locking.test.ts`
- **24 test cases** covering all scenarios
- Tests cover:
  - Expense locking read operations (isLocked flag in get, list, and full details) - 4 tests
  - Expense locking write operations (blocking edits, allowing edits when unlocked) - 4 tests
  - Settlement locking read operations (isLocked flag in settlements list) - 3 tests
  - Settlement locking write operations (blocking edits for locked settlements) - 5 tests
  - Edge cases (multiple departed members, dynamic lock computation) - 3 tests
  - Race condition protection (creating with departed members)
- Test patterns follow project conventions (ApiDriver, borrowTestUsers, TestGroupManager)
- **Note:** Unit tests not needed - lock logic is simple (array membership check) and fully covered by integration tests
- **Fixed:** Corrected API calls to use `getGroupFullDetails()` instead of non-existent `getGroupSettlements()` method

#### ✅ Phase 4: Frontend - ExpenseDetailPage (COMPLETED)
- Added lock warning banner with ⚠️ icon in `ExpenseDetailPage.tsx:219-233`
- Banner displays when `expense.isLocked` is true
- Shows "This expense cannot be edited" with explanation about departed members
- Updated `ExpenseActions` component call to pass `disabled={expense.isLocked}` prop
- Location: `webapp-v2/src/pages/ExpenseDetailPage.tsx`

#### ✅ Phase 5: Frontend - AddExpensePage (COMPLETED)
- Added lock check in `loadExpenseForEdit()` function in `useFormInitialization.ts:49-51`
- Throws error if `expense.isLocked` is true
- Error displayed: "This expense cannot be edited because one or more participants have left the group."
- Location: `webapp-v2/src/app/hooks/useFormInitialization.ts`

#### ✅ Phase 6: Frontend - SettlementForm (COMPLETED)
- Added lock check in edit mode in `useEffect` hook at line 45-48
- Shows validation error if `settlementToEdit.isLocked` is true
- Disabled submit button when locked: `disabled={!isFormValid || isSubmitting || (editMode && settlementToEdit?.isLocked)}`
- Error message: "This settlement cannot be edited because a participant has left the group."
- Location: `webapp-v2/src/components/settlements/SettlementForm.tsx`

#### ✅ Phase 7: Frontend - SettlementHistory (COMPLETED)
- Disabled edit button for locked settlements at line 170
- Added conditional tooltip: shows "Cannot edit - member has left the group" when locked
- Visual feedback with disabled styling (opacity-50, cursor-not-allowed)
- Location: `webapp-v2/src/components/settlements/SettlementHistory.tsx`

#### ✅ Phase 4.3: ExpenseActions Component (COMPLETED)
- Added `disabled?: boolean` prop to interface
- Wrapped edit button in div with tooltip
- Applied disabled state: `<Button disabled={disabled}>`
- Conditional tooltip: `title={disabled ? t('expenseComponents.expenseActions.cannotEditTooltip') : undefined}`
- Location: `webapp-v2/src/components/expense/ExpenseActions.tsx`

#### ✅ Phase 8: Translation Keys - Complete Set (COMPLETED)
All translation keys added to `webapp-v2/src/locales/en/translation.json`:
- `pages.expenseDetailPage.cannotEdit`: "This expense cannot be edited"
- `pages.expenseDetailPage.containsDepartedMembers`: "One or more participants have left the group. Historical records are preserved as read-only."
- `expenseForm.errors.expenseLocked`: "This expense cannot be edited because one or more participants have left the group."
- `settlementForm.errors.settlementLocked`: "This settlement cannot be edited because a participant has left the group."
- `settlementHistory.cannotEditTooltip`: "Cannot edit - member has left the group"
- `expenseComponents.expenseActions.cannotEditTooltip`: "Cannot edit - participant has left the group"

#### ✅ Build Verification (COMPLETED)
- Full project build completed successfully via `npm run build`
- All TypeScript compilation passes with no errors
- All workspaces built: @splitifyd/shared, functions, webapp-v2, e2e-tests, test-support
- Vite production build successful (dist files generated)

### Pending Phases

#### ⏳ Phase 10: E2E Tests (PENDING)

**File:** `e2e-tests/src/__tests__/integration/departed-member-locking.e2e.test.ts` (NEW FILE)

**Test Suite Structure:**

##### Test 1: "should lock expense when participant leaves group"
1. Create group with 3 authenticated users (Alice, Bob, Charlie)
2. Alice creates an expense with all 3 participants ($90 split equally)
3. Bob settles his debt ($30) with Alice
4. Verify Bob can leave the group (balance cleared)
5. Bob leaves the group
6. **Verify lock UI on expense detail page:**
   - Navigate to expense detail page
   - Verify yellow warning banner is visible with lock message
   - Verify edit button is disabled
   - Verify tooltip shows "Cannot edit - participant has left"
7. **Verify edit attempt is blocked:**
   - Try to navigate to edit URL directly
   - Verify user sees error/redirect

##### Test 2: "should lock settlement when payer leaves group"
1. Create group with 2 users (Alice, Bob)
2. Alice creates expense ($100, both participants)
3. Bob records settlement payment to Alice ($50)
4. Verify settlement appears in payment history
5. Bob settles remaining debt and leaves group
6. **Verify settlement is locked:**
   - Open payment history
   - Verify edit button is disabled for the settlement
   - Attempt to click edit (if possible)
   - Verify error message or disabled state

##### Test 3: "should lock settlement when payee leaves group"
1. Create group with 2 users (Alice, Bob)
2. Bob creates expense with Alice as participant
3. Alice records settlement payment to Bob
4. Alice settles remaining debt and leaves
5. **Verify settlement is locked for Bob:**
   - Verify edit button disabled
   - Verify appropriate error message

##### Test 4: "should allow creating new expense after member leaves"
1. Create group with 3 users
2. One member leaves
3. **Verify remaining members can still create expenses:**
   - Departed member not in participant dropdown
   - Can create expense with only current members
   - Expense created successfully

**Testing Strategy:**
- Use `simpleTest` fixture with `createLoggedInBrowsers(n)`
- Follow existing e2e patterns from core-features.e2e.test.ts
- Use page objects (GroupDetailPage, ExpenseDetailPage, SettlementFormPage)
- Test each scenario incrementally using `run-until-fail.sh` script
- Add test annotations for expected console errors (404s when removed members try to access group)
- Wait for real-time updates rather than using page.reload()

**Key Page Object Methods:**
- `groupDetailPage.clickAddExpenseButton()` - Add expenses
- `expenseDetailPage.getEditButton()` - Check edit button state
- `groupDetailPage.clickSettleUpButton()` - Record settlements
- `groupDetailPage.clickEditSettlement()` - Edit settlements
- `groupDetailPage.clickLeaveGroupButton()` - Member leaves
- `groupDetailPage.verifyDebtRelationship()` - Verify balances
- `groupDetailPage.verifyAllSettledUp()` - Verify no debts
- `groupDetailPage.waitForMemberCount()` - Wait for member changes

**Iterative Development Process:**
1. Write Test 1 first → Test with `run-until-fail.sh` → Fix issues → Commit
2. Write Test 2 → Test with `run-until-fail.sh` → Fix issues → Commit
3. Write Test 3 → Test with `run-until-fail.sh` → Fix issues → Commit
4. Write Test 4 → Test with `run-until-fail.sh` → Fix issues → Commit
5. Run full suite multiple times to ensure stability

#### ⏳ Phase 11: Playwright Unit Tests (PENDING)
- Create Playwright unit test for lock UI components
- Location: `webapp-v2/src/__tests__/unit/playwright/expense-detail-locked.test.tsx`

## Testing Checklist

### Backend Tests
- ✅ Expense marked as locked when participant leaves
- ✅ Settlement marked as locked when payer/payee leaves
- ✅ Update blocked for locked expense
- ✅ Update blocked for locked settlement
- ✅ Create blocked if member departs mid-submission
- ✅ Lock status computed correctly in list operations
- ✅ Lock flag included in all read endpoints (get, list, full details)
- ✅ Dynamic lock computation (not stale)
- ✅ Multiple departed members handled
- ✅ Optimized with single getAllGroupMemberIds call per operation

### Frontend Tests
- ✅ Lock warning banner displayed (implemented in ExpenseDetailPage)
- ✅ Edit button disabled for locked transactions (implemented in ExpenseActions)
- ✅ Edit form shows error if locked expense loaded (implemented in useFormInitialization)
- ✅ Settlement form shows error if locked settlement loaded (implemented in SettlementForm)
- ✅ Tooltip shows explanation on disabled buttons (implemented for both expenses and settlements)
- ⏳ Playwright unit tests for lock UI components (to be created)

### E2E Tests
- ⏳ Full workflow: create → member leaves → verify locked UI
- ⏳ Attempt to edit locked expense (blocked)
- ⏳ Attempt to edit locked settlement (blocked)
- ⏳ Create new expense after member leaves (member not in list)

## Future Enhancements (Out of Scope)

- **"Correct as New"** - One-click duplicate with current members
- **Departure notifications** - Alert users about affected transactions
- **Archive view** - Separate UI for historical/locked transactions
- **Audit log** - Track who attempted to edit locked transactions
- **Unlock permission** - Allow admins to unlock in special cases
