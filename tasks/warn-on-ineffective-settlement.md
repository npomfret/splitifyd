# Warn on Ineffective Settlement

## Problem

Currently, the application allows a user to record a settlement payment that does not actually reduce or clear any existing debts between the payer and the recipient. This can happen if the payer has no outstanding debt to the recipient, or if the payment amount is zero.

This is confusing because the system accepts the payment, but it has no effect on the group's balances. The user receives no feedback indicating that their action was meaningless.

## Goal

Warn the user when they are about to record a settlement that will not change the balances between the involved parties.

## Implementation Approach

**Note:** This is a UI-only feature. All settlements are valid from the backend's perspective, even if they create debt in the opposite direction. The warning is informational only and does not block submission.

### 1. Backend Schema Changes

**File: `firebase/functions/src/schemas/settlement.ts:12`**

- Change `amount: z.number().min(0, ...)` to `z.number().positive('Amount must be greater than zero')`
- This prevents zero-amount settlements at the API validation layer
- Note: Expense schema already uses `.positive()` so this brings consistency

**File: `firebase/functions/src/schemas/expense.ts:22`** (verify existing)

- Expense already has `.positive()` validation - no changes needed

### 2. Frontend UI Changes

**File: `webapp-v2/src/components/settlements/SettlementForm.tsx`**

#### Add Warning State (after line 26)

```typescript
const [warningMessage, setWarningMessage] = useState<string | null>(null);
```

#### Add Helper Function (after `getMemberName` function)

```typescript
const getCurrentDebt = (): number => {
    if (!payerId || !payeeId || !currency || !enhancedGroupDetailStore.balances) {
        return 0;
    }

    const balancesByCurrency = enhancedGroupDetailStore.balances.balancesByCurrency;
    const currencyBalances = balancesByCurrency[currency];

    if (!currencyBalances) return 0;

    const payerBalance = currencyBalances[payerId];
    if (!payerBalance) return 0;

    // Find how much payer owes to payee
    const debtToPayee = payerBalance.perPersonBalances?.[payeeId] || 0;

    // Negative balance means payer owes payee (return absolute value)
    return debtToPayee < 0 ? Math.abs(debtToPayee) : 0;
};
```

#### Add Real-time Warning Calculation (new useEffect after line 98)

```typescript
useEffect(() => {
    if (!payerId || !payeeId || !currency || !amount) {
        setWarningMessage(null);
        return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        setWarningMessage(null);
        return;
    }

    const currentDebt = getCurrentDebt();

    // Warning Case 1: Payer doesn't owe payee anything
    if (currentDebt === 0) {
        const payerName = getMemberName(payerId);
        const payeeName = getMemberName(payeeId);
        setWarningMessage(t('settlementForm.warnings.noDebt', { payer: payerName, payee: payeeName, currency }));
        return;
    }

    // Warning Case 2: Overpayment (settlement > current debt)
    if (amountNum > currentDebt) {
        const payerName = getMemberName(payerId);
        const payeeName = getMemberName(payeeId);
        setWarningMessage(
            t('settlementForm.warnings.overpayment', {
                payer: payerName,
                payee: payeeName,
                debt: formatCurrency(currentDebt, currency),
                amount: formatCurrency(amountNum, currency),
            }),
        );
        return;
    }

    // No warning
    setWarningMessage(null);
}, [payerId, payeeId, amount, currency, enhancedGroupDetailStore.balances]);
```

#### Display Warning (after Summary section, before Error Message around line 348)

```tsx
{
    /* Warning Message */
}
{
    warningMessage && (
        <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p class="text-sm text-yellow-800" role="status" data-testid="settlement-warning-message">
                ⚠️ {warningMessage}
            </p>
        </div>
    );
}
```

### 3. Translation Updates

**File: `webapp-v2/src/locales/en/translation.json`**

Add new section under `settlementForm` (after `validation`):

```json
"warnings": {
  "noDebt": "{{payer}} does not owe {{payee}} any money in {{currency}}. This settlement will create a debt in the opposite direction.",
  "overpayment": "{{payer}} only owes {{payee}} {{debt}}, but you're settling {{amount}}. This will create a debt in the opposite direction."
}
```

Update validation message for clarity:

```json
"validAmountRequired": "Please enter an amount greater than 0"
```

## User Experience

### Scenario 1: No Debt

- **User Action:** User tries to record a settlement from Alice to Bob
- **Current State:** Alice owes Bob $0 in USD
- **System Response:** Inline warning appears: "⚠️ Alice does not owe Bob any money in USD. This settlement will create a debt in the opposite direction."
- **Result:** Warning is shown but user can still submit if they want

### Scenario 2: Overpayment

- **User Action:** User tries to settle $100 from Alice to Bob
- **Current State:** Alice owes Bob $50 in USD
- **System Response:** Inline warning appears: "⚠️ Alice only owes Bob $50.00, but you're settling $100.00. This will create a debt in the opposite direction."
- **Result:** Warning is shown but user can still submit if they want

### Scenario 3: Zero Amount

- **User Action:** User enters $0 as amount
- **System Response:** Submit button is disabled (existing validation)
- **Result:** Form cannot be submitted

## Acceptance Criteria

- ✅ Zero-amount settlements are prevented at schema level (backend validation)
- ✅ Zero-amount expenses are prevented at schema level (backend validation)
- ✅ Warning appears inline as user types (real-time validation)
- ✅ Warning shows when payer doesn't owe payee in the selected currency
- ✅ Warning shows when settlement amount exceeds current debt
- ✅ Warning is informational only - does not block submission
- ✅ Only balances in the settlement's currency are considered (no cross-currency logic)
- ✅ Warning uses proper semantic attributes (`role="status"`, `data-testid`)

## Technical Notes

- **UI-only implementation:** Backend always accepts valid settlements; no rejection logic needed
- **Real-time updates:** Warning recalculates on every form field change
- **Single currency:** Uses `balancesByCurrency[currency]` to only check balances in the settlement's currency
- **Non-blocking:** Users can proceed with settlement despite warning (useful for corrections/reversals)
- **Accessibility:** Warning uses `role="status"` for screen readers
