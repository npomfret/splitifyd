# [High] Currency Symbol Ambiguity and Data Obscurity Bug

## Status
🔴 **Open** - Not Started

## Priority
**High** (was Medium) - The `GroupCard` issue hides critical financial data, which is a more severe problem than simple display ambiguity.

## Summary
Groups with expenses in multiple currencies that share the same symbol (e.g., USD and CAD both use "$") have display problems where users cannot distinguish which currency is being shown.

**A more critical issue was discovered:** The `GroupCard` on the dashboard **only shows the first non-zero balance**, completely hiding other currency balances from the user. This is a data integrity and trust issue, not just a display bug.

### Key Findings from Code Research

✅ **Multi-currency support is fully implemented**
- Groups track balances per currency (`balancesByCurrency: Record<string, CurrencyBalance>`)
- Each expense/settlement has its own currency field
- Balance calculations work correctly per currency

❌ **Display layer has symbol ambiguity issues**
- All 30+ uses of `formatCurrency()` show only symbols (e.g., "$150.00")
- No currency codes displayed with amounts
- Intl.NumberFormat configured for symbol-only display

⚠️ **Partial mitigation exists**
- `BalanceSummary` groups by currency and shows section headers (when 2+ currencies present)
- Other components have no grouping or currency indicators

🔴 **CRITICAL: `GroupCard` Hides Financial Data**
- Dashboard cards show only the **first non-zero balance** when multiple currencies exist.
- **Example:** A group with balances of `+50 USD` and `-75 CAD` will only show "You are owed $50.00", completely hiding the 75 CAD debt. This is highly misleading.

📊 **Affected locations: 12 UI components, 30+ usages**

## User Impact

### Scenario Example

A user creates a group for an international trip with expenses in both USD and CAD:

1. User adds expense: "Hotel in Vancouver - $150 CAD"
2. User adds expense: "Lunch in Seattle - $45 USD"
3. User views the dashboard.

**Current `GroupCard` Display:**
The card might only show `You owe $45.00`, completely hiding the `$150.00 CAD` debt. The user is unaware of their full financial picture at a glance.

**Problem:** This is not just an ambiguity; it's a data integrity failure in the UI. It erodes user trust by presenting an incomplete and potentially misleading summary of their financial status.

### Severity

- **Frequency:** Uncommon (requires multi-currency groups).
- **Impact:** **Critical**. Hiding balances can lead to significant financial misunderstandings, incorrect settlement assumptions, and a loss of trust in the application.
- **Workaround:** None for the `GroupCard` issue. For other components, users must click through to individual expenses to verify currency.

## Recommended Solution & Action Plan

This will be a two-part fix. Part 1 is critical and must be implemented immediately. Part 2 is a UX enhancement.

### Part 1: Critical Fixes (Clarity and Correctness)

#### 1. Fix `GroupCard` to Display All Balances
The `GroupCard` component must be refactored to show **all** non-zero currency balances.

**Implementation:**
- Modify `webapp-v2/src/components/dashboard/GroupCard.tsx`.
- Instead of finding the *first* non-zero balance, iterate through *all* balances in `group.balance.balancesByCurrency`.
- For each non-zero balance, render a separate line item.

**Example `GroupCard` Display:**
```
House Expenses
--------------------
You are owed $50.00 USD
You owe $75.00 CAD
```

#### 2. Globally Update `formatCurrency` for Unambiguous Display
Modify the `formatCurrency` utility to always include the currency code. The recommended format is `SYMBOLAMOUNT CODE` (e.g., `$150.00 CAD`) for the best combination of readability and clarity.

**Implementation:**
- Modify `webapp-v2/src/utils/currency/currencyFormatter.ts`.
- The goal is to produce a string like **`$150.00 CAD`**.
- The `Intl.NumberFormat` with `currencyDisplay: 'code'` produces `USD 150.00`, which is less intuitive.
- A better approach is to get the symbol and the number separately and combine them with the code.

```typescript
// Proposed new implementation
export const formatCurrency = (amount: Amount | number, currencyCode: string, options: FormatOptions = {}): string => {
    // ... (existing validation and normalization)

    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: currency.decimal_digits,
        maximumFractionDigits: currency.decimal_digits,
    });

    const formattedAmount = formatter.format(numericAmount);

    // In a multi-currency context, always append the code for clarity.
    // We can decide later if we want to hide it in single-currency contexts.
    return `${formattedAmount} ${currencyCode.toUpperCase()}`;
};
```

### Part 2: UX Enhancement (Conditional Display)

After the critical fixes are in place, we can improve the UX by conditionally showing the currency code.

**Logic:**
- Create a new context or hook (e.g., `useCurrencyContext`) that knows about the currencies present in the current view (e.g., a group).
- The `formatCurrency` function (or a new `CurrencyDisplay` component) would use this context.
- **If only one currency is active in the group**, display the amount without the code (e.g., `$150.00`).
- **If multiple currencies are active**, display the amount with the code (e.g., `$150.00 USD`).

This provides a cleaner UI for the common single-currency case while ensuring clarity in the multi-currency case. This should be considered a follow-up enhancement after the critical issues are resolved.

## Implementation Notes

- **Priority 1:** Fix `GroupCard.tsx` and globally update `formatCurrency()`.
- **Priority 2:** Implement the conditional display logic as a UX enhancement.
- All unit and E2E tests that assert currency strings will need to be updated.
- A thorough visual review of all 12+ affected components is required to check for layout issues due to the longer currency string.

## Testing Requirements

### Unit Tests
- **`webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts`**
  - Update all existing test cases to expect the new `$150.00 CAD` format.
  - Add specific tests for shared symbols (USD/CAD, GBP/EGP) to confirm codes are present.

### Component/Integration Tests
- **`GroupCard.test.tsx` (New or Updated):**
  - Test a group with a single currency balance.
  - Test a group with **multiple currency balances** (e.g., USD and CAD) and assert that **both** are rendered correctly with their codes.
  - Test a group with zero balances ("Settled up").
- **`BalanceSummary.test.tsx`:**
  - Verify that even with the new global format, the currency-code headers are still useful and the layout is clean.

### E2E Tests
- Create a new E2E test scenario:
  1. Create a group.
  2. Add an expense in **USD**.
  3. Add a second expense in **CAD**.
  4. Navigate to the dashboard and verify the `GroupCard` shows **both** the USD and CAD balances with their currency codes.
  5. Navigate to the `GroupDetailPage` and verify the `BalanceSummary` and `ExpenseItem` components also display amounts with currency codes.

## References

- Currency data: `packages/shared/src/currency-data.ts` (160+ currencies)
- MDN Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Multi-currency data model: `packages/shared/src/shared-types.ts:553-556`
