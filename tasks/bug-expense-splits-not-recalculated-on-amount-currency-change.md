# Bug: Expense Splits Not Recalculated on Amount/Currency Change

**Status:** Open
**Severity:** High
**Priority:** High
**Component:** webapp-v2/expense-form-store.ts
**Discovered:** 2025-10-09
**Related Fix:** Partial fix applied for paidBy field only

## Summary

When a user changes the expense amount or currency in the expense form, the split calculations are not automatically updated for EQUAL and EXACT split types. This causes the splits array to contain stale amounts that don't match the new total or currency precision rules.

## Current Behavior

### Split Recalculation Triggers (Current State)

| Field Change    | Split Recalculation? | Notes |
|----------------|---------------------|-------|
| **participants** | ✅ YES (line 460) | Calls `handleSplitTypeChange()` |
| **splitType**    | ✅ YES (line 419) | Calls `handleSplitTypeChange()` |
| **paidBy**       | ✅ YES (line 412) | **FIXED** - Now calls `handleSplitTypeChange()` |
| **amount** (PERCENTAGE) | ✅ YES (line 374-384) | Recalculates split amounts based on percentages |
| **amount** (EQUAL/EXACT) | ❌ NO | **BUG** - Only revalidates, doesn't recalculate |
| **currency**     | ❌ NO (line 386-398) | **BUG** - Only revalidates amount field |

### Example Bug Scenarios

#### Scenario 1: Amount Change with EQUAL splits
1. User creates expense: Amount = $100, 3 participants, EQUAL split
2. Splits calculated: [33.33, 33.33, 33.34]
3. User changes amount to $150
4. **BUG**: Splits remain [33.33, 33.33, 33.34] instead of [50.00, 50.00, 50.00]
5. Total splits (100) ≠ Amount (150) → Validation error on submission

#### Scenario 2: Currency Change
1. User creates expense: Amount = 100 USD, 2 participants, EQUAL split
2. Splits calculated: [50.00, 50.00] (2 decimal places for USD)
3. User changes currency to JPY (0 decimal places)
4. **BUG**: Splits remain [50.00, 50.00] with improper precision for JPY
5. Should be: [50, 50] (no decimals for JPY)

## Root Cause

In `webapp-v2/src/app/stores/expense-form-store.ts`, the `updateField()` method handles amount and currency changes:

```typescript
// Line 367: Amount change
case 'amount':
    this.#amountSignal.value = value as number;

    // ONLY recalculates for percentage splits
    if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
        // Recalculation logic...
    }
    // ❌ MISSING: Should recalculate for EQUAL and EXACT too!
    break;

// Line 386: Currency change
case 'currency':
    this.#currencySignal.value = value as string;

    // Only revalidates amount field, doesn't recalculate splits
    const amountError = this.validateField('amount');
    // ❌ MISSING: Should recalculate splits with new currency precision!
    break;
```

The calculation functions are currency-aware and take currency as a parameter:

```typescript
// From packages/shared/src/split-utils.ts
export function calculateEqualSplits(
    totalAmount: number,
    currencyCode: string,  // ← Currency parameter exists!
    participantIds: string[]
): ExpenseSplit[]

export function calculateExactSplits(
    totalAmount: number,
    currencyCode: string,  // ← Currency parameter exists!
    participantIds: string[]
): ExpenseSplit[]

export function calculatePercentageSplits(
    totalAmount: number,
    currencyCode: string,  // ← Currency parameter exists!
    participantIds: string[]
): ExpenseSplit[]
```

## Impact Assessment

### User Impact
- **High**: Users will encounter validation errors when submitting expenses after changing amount/currency
- **Confusing UX**: Split amounts don't update visually when amount changes
- **Data Integrity**: Risk of submitting splits with wrong precision for currency

### API Impact
- Backend will reject requests with `INVALID_SPLITS` error
- Error message: "Splits must be provided for all participants"
- May also fail validation: "Split amounts must total the expense amount"

### Workaround
Users must:
1. Change split type to something else (e.g., EQUAL → PERCENTAGE)
2. Change back to original split type (PERCENTAGE → EQUAL)
3. This triggers recalculation via splitType change handler

## Reproduction Steps

### Test Case 1: Amount Change
1. Navigate to Add Expense page
2. Fill form:
   - Amount: 100
   - Currency: USD
   - Payer: User A
   - Participants: User A, User B, User C
   - Split Type: EQUAL
3. Observe splits: [33.33, 33.33, 33.34]
4. Change amount to 150
5. **BUG**: Splits don't update, remain [33.33, 33.33, 33.34]
6. Click Submit
7. **RESULT**: API returns 400 error - splits total (100) ≠ amount (150)

### Test Case 2a: Currency Change (USD → JPY)
1. Navigate to Add Expense page
2. Fill form:
   - Amount: 100
   - Currency: USD
   - Payer: User A
   - Participants: User A, User B
   - Split Type: EQUAL
3. Observe splits: [50.00, 50.00] (2 decimal places)
4. Change currency to JPY
5. **BUG**: Splits don't update, remain [50.00, 50.00]
6. **EXPECTED**: Should recalculate to [50, 50] (JPY has 0 decimals)

### Test Case 2b: Currency Change (JPY → USD)
1. Navigate to Add Expense page
2. Fill form:
   - Amount: 100
   - Currency: JPY
   - Payer: User A
   - Participants: User A, User B, User C
   - Split Type: EQUAL
3. Observe splits: [33, 33, 34] (0 decimal places)
4. Change currency to USD
5. **BUG**: Splits don't update, remain [33, 33, 34]
6. **EXPECTED**: Should recalculate to [33.33, 33.33, 33.34] (USD has 2 decimals)

## Suggested Fix

Add `handleSplitTypeChange()` calls for amount and currency changes:

```typescript
// Fix for amount change (line 367)
case 'amount':
    this.#amountSignal.value = value as number;

    if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
        // Recalculate amounts for percentage splits
        const currentSplits = [...this.#splitsSignal.value];
        const amount = this.#amountSignal.value;
        currentSplits.forEach((split) => {
            if (split.percentage !== undefined) {
                split.amount = (amount * split.percentage) / 100;
            }
        });
        this.#splitsSignal.value = currentSplits;
    }

    // ADD THIS: Recalculate splits for all types when amount changes
    this.handleSplitTypeChange(this.#splitTypeSignal.value);
    break;

// Fix for currency change (line 386)
case 'currency':
    this.#currencySignal.value = value as string;

    // Revalidate amount when currency changes (precision rules depend on currency)
    const currentErrors = { ...this.#validationErrorsSignal.value };
    const amountError = this.validateField('amount');
    if (amountError) {
        currentErrors.amount = amountError;
    } else {
        delete currentErrors.amount;
    }
    this.#validationErrorsSignal.value = currentErrors;

    // ADD THIS: Recalculate splits with new currency precision
    this.handleSplitTypeChange(this.#splitTypeSignal.value);
    break;
```

### Alternative: Unified Approach

Consider refactoring to have a single method that triggers split recalculation:

```typescript
private recalculateSplitsIfNeeded(): void {
    // Only recalculate if we have enough info
    if (this.#participantsSignal.value.length > 0 &&
        this.#amountSignal.value > 0 &&
        this.#currencySignal.value) {
        this.handleSplitTypeChange(this.#splitTypeSignal.value);
    }
}

// Then call from all relevant cases:
case 'amount':
    this.#amountSignal.value = value as number;
    this.recalculateSplitsIfNeeded();
    break;

case 'currency':
    this.#currencySignal.value = value as string;
    this.recalculateSplitsIfNeeded();
    break;

case 'paidBy':
    this.#paidBySignal.value = value as string;
    // Auto-add logic...
    this.recalculateSplitsIfNeeded();
    break;
```

## Testing Requirements

### Unit Tests
- [ ] Test amount change recalculates EQUAL splits
- [ ] Test amount change recalculates EXACT splits (default amounts)
- [ ] Test amount change recalculates PERCENTAGE splits
- [ ] Test currency change recalculates splits with correct precision
- [ ] Test currency change USD → JPY (2 decimals → 0 decimals) - verify rounding
- [ ] Test currency change JPY → USD (0 decimals → 2 decimals) - verify precision added
- [ ] Test currency change with 3 participants (odd division) in both directions
- [ ] Test currency change preserves correct total amount across precision changes

### Integration Tests
- [ ] E2E test: Create expense, change amount, verify splits update
- [ ] E2E test: Create expense, change currency, verify splits update
- [ ] E2E test: Submit expense after amount change, verify success (no validation error)

### Manual Testing Checklist
- [ ] Create expense with EQUAL splits, change amount, verify UI updates immediately
- [ ] Create expense with EXACT splits, change amount, verify UI updates immediately
- [ ] Create expense with PERCENTAGE splits, change amount, verify UI updates immediately
- [ ] Change currency USD → JPY, verify splits recalculate to 0 decimals (e.g., 50.00 → 50)
- [ ] Change currency JPY → USD, verify splits recalculate to 2 decimals (e.g., 50 → 50.00)
- [ ] Change currency USD → JPY with odd division (3 participants), verify rounding (e.g., [33.33, 33.33, 33.34] → [33, 33, 34])
- [ ] Change currency JPY → USD with odd division (3 participants), verify precision added (e.g., [33, 33, 34] → [33.33, 33.33, 33.34])
- [ ] Submit expense after amount change, verify API accepts it without validation errors
- [ ] Submit expense after currency change, verify API accepts it without validation errors

## Related Issues

- **Original Issue**: paidBy field not recalculating splits (FIXED in current commit)
- **Upstream Change**: Architecture changed to require client-calculated splits (commit 23db9069)
- **Backend Validation**: `INVALID_SPLITS` error enforcement in API

## Fix Priority

**HIGH** - This blocks basic expense creation workflow when users adjust amounts or currencies. The user experience is severely impacted.

## Estimated Effort

- **Code Change**: 10 minutes (add 2 lines of code)
- **Testing**: 30 minutes (unit + integration tests)
- **Total**: ~40 minutes

## Notes

- The `handleSplitTypeChange()` method already has proper guards (checks for participants, amount, currency)
- No risk of infinite loops - split recalculation doesn't trigger field updates
- This follows the pattern already established for participants and splitType changes
- Consider whether EXACT splits should recalculate when amount changes (they might preserve user's manual adjustments?)
