# Currency Symbol Ambiguity Bug

## Status
🔴 **Open** - Not Started

## Priority
Medium

## Summary
Groups with expenses in multiple currencies that share the same symbol (e.g., USD and CAD both use "$") have display problems where users cannot distinguish which currency is being shown.

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
- BalanceSummary groups by currency and shows section headers (when 2+ currencies present)
- Other components have no grouping or currency indicators

🔴 **Critical issue in GroupCard**
- Dashboard cards show only the **first non-zero balance** when multiple currencies exist
- Other currency balances are completely hidden from user
- Example: Group with +$50 USD and -$75 CAD shows only "You are owed $50.00"

📊 **Affected locations: 12 UI components, 30+ usages**

## Problem Description

The application uses `Intl.NumberFormat` to format currency amounts, which displays currency symbols without the currency code. When multiple currencies share the same symbol, it becomes impossible for users to determine which currency a displayed amount represents.

### Currencies Affected

Multiple currencies share the same symbol. Common examples include:

**Dollar sign ($):**
- USD (United States Dollar) - `$`
- CAD (Canadian Dollar) - `$`
- AUD (Australian Dollar) - `$`
- NZD (New Zealand Dollar) - `$`
- MXN (Mexican Peso) - `$`
- SGD (Singapore Dollar) - `S$` (but may show as `$` in some locales)
- HKD (Hong Kong Dollar) - `HK$` (but may show as `$` in some locales)
- ARS (Argentine Peso) - `$`
- BBD (Barbados Dollar) - `$`
- BMD (Bermudian Dollar) - `$`
- BND (Brunei Dollar) - `$`
- BSD (Bahamian Dollar) - `$`
- BZD (Belize Dollar) - `BZ$` (but may show as `$`)
- CLP (Chilean Peso) - `$`
- COP (Colombian Peso) - `$`
- CVE (Cape Verdean Escudo) - `$`
- GYD (Guyanese Dollar) - `$`
- JMD (Jamaican Dollar) - `J$` (but may show as `$`)
- KYD (Cayman Islands Dollar) - `$`
- LRD (Liberian Dollar) - `$`
- NAD (Namibian Dollar) - `$`
- SBD (Solomon Islands Dollar) - `$`
- SRD (Surinamese Dollar) - `$`
- TTD (Trinidad and Tobago Dollar) - `TT$` (but may show as `$`)
- TWD (New Taiwan Dollar) - `NT$` (but may show as `$`)
- UYU (Uruguayan Peso) - `$U` (but may show as `$`)
- XCD (East Caribbean Dollar) - `$`

**Other shared symbols:**
- GBP (British Pound) & EGP (Egyptian Pound) & SHP (Saint Helena Pound) - `£`
- CNY (Chinese Yuan) & JPY (Japanese Yen) - `¥`
- IRR (Iranian Rial), OMR (Omani Rial), QAR (Qatari Riyal), SAR (Saudi Riyal), YER (Yemeni Rial) - `﷼`
- And many more...

## Current Implementation

### Location
`webapp-v2/src/utils/currency/currencyFormatter.ts:8-30`

```typescript
export const formatCurrency = (amount: Amount | number, currencyCode: string, options: FormatOptions = {}): string => {
    const { locale = 'en-US' } = options;

    if (!currencyCode || currencyCode.trim() === '') {
        throw Error('you must supply a currencyCode AND amount');
    }

    const currency = getCurrency(currencyCode);
    const normalizedAmount = normalizeAmount(amount, currencyCode);
    const amountUnits = amountToSmallUnit(normalizedAmount, currencyCode);
    const multiplier = Math.pow(10, currency.decimal_digits);
    const numericAmount = amountUnits / multiplier;

    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: currency.decimal_digits,
        maximumFractionDigits: currency.decimal_digits,
    });

    return formatter.format(numericAmount);
};
```

The formatter uses the default `Intl.NumberFormat` output which only shows the symbol, not the currency code.

## Components Affected

The following UI components display currency amounts and are affected by this bug:

1. **BalanceSummary** (`webapp-v2/src/components/group/BalanceSummary.tsx:103-107`)
   - Displays debts between users
   - Groups by currency but may show multiple "$" sections

2. **ExpenseItem** (`webapp-v2/src/components/group/ExpenseItem.tsx:35`)
   - Shows individual expense amounts
   - No currency code indicator

3. **GroupCard** (`webapp-v2/src/components/dashboard/GroupCard.tsx:59,66`)
   - Shows balance summaries on dashboard
   - Critical for quick overview of multiple groups

4. **SettlementHistory** (`webapp-v2/src/components/settlements/SettlementHistory.tsx:165`)
   - Displays settlement/payment amounts
   - Historical view where currency context is important

5. **SplitBreakdown** (`webapp-v2/src/components/expense/SplitBreakdown.tsx:104`)
   - Shows how expenses are split between users
   - Multiple amounts displayed simultaneously

## User Impact

### Scenario Example

A user creates a group for an international trip with expenses in both USD and CAD:

1. User adds expense: "Hotel in Vancouver - $150 CAD"
2. User adds expense: "Lunch in Seattle - $45 USD"
3. User views group balance

**Current Display:**
```
Balances:
- Alice → Bob: $150.00
- Bob → Alice: $45.00
```

**Problem:** The user cannot tell which debt is in CAD and which is in USD without clicking into each expense.

### Severity

- **Frequency:** Uncommon (requires multi-currency groups with overlapping symbols)
- **Impact:** High when it occurs (could lead to incorrect settlements)
- **Workaround:** Users must click through to individual expenses to verify currency

## Data Model Analysis

### Multi-Currency Support in Groups

The application **fully supports multi-currency groups**. Analysis of the data model confirms:

**GroupDTO structure** (`packages/shared/src/shared-types.ts:553-556`):
```typescript
balance?: {
    balancesByCurrency: Record<string, CurrencyBalance>;
};
```

**CurrencyBalance interface** (`packages/shared/src/shared-types.ts:436-441`):
```typescript
export interface CurrencyBalance {
    currency: string;
    netBalance: Amount;
    totalOwed: Amount;
    totalOwing: Amount;
}
```

This means:
- Groups can have expenses in **multiple currencies simultaneously**
- Balances are **tracked per currency** (e.g., separate USD and CAD balances)
- The `balancesByCurrency` is a map: `{ "USD": {...}, "CAD": {...}, "EUR": {...} }`

### Currency Selection Per Expense

**Each expense has its own currency** (`packages/shared/src/shared-types.ts:664`):
```typescript
export interface ExpenseDTO extends Expense, BaseDTO {
    // ... other fields
    currency: string;
    amount: Amount;
    // ...
}
```

**Each settlement has its own currency** (`packages/shared/src/shared-types.ts:709`):
```typescript
export interface SettlementDTO extends Settlement, BaseDTO {
    // ... other fields
    currency: string;
    amount: Amount;
    // ...
}
```

This confirms that **within a single group**, users can:
1. Add an expense in USD
2. Add another expense in CAD
3. Add a third expense in EUR
4. Have debts calculated per currency

### Current Partial Mitigation

The `BalanceSummary` component groups debts by currency and shows a currency header when multiple currencies exist:

**BalanceSummary.tsx:31-58:**
```typescript
// Group debts by currency for proper display - memoized to avoid recalculation
const groupedDebts = useMemo(() => {
    if (!balances.value?.simplifiedDebts) return [];

    const grouped = balances.value.simplifiedDebts.reduce(
        (acc, debt) => {
            const currency = debt.currency;
            if (!acc[currency]) {
                acc[currency] = [];
            }
            acc[currency].push(debt);
            return acc;
        },
        {} as Record<string, SimplifiedDebt[]>,
    );

    // Sort currencies: USD first, then alphabetically
    const sortedCurrencies = Object.keys(grouped).sort((a, b) => {
        if (a === 'USD') return -1;
        if (b === 'USD') return 1;
        return a.localeCompare(b);
    });

    return sortedCurrencies.map((currency) => ({
        currency,
        debts: grouped[currency],
    }));
}, [balances.value?.simplifiedDebts]);
```

**Display logic** (`BalanceSummary.tsx:69-73`):
```typescript
{groupedDebts.length > 1 && (
    <h3 className='...'>
        <span className='...'>{currency}</span>
    </h3>
)}
```

**What this does:**
- Groups debts by currency code (USD, CAD, EUR, etc.)
- Shows section headers with currency codes **only when there are 2+ currencies**
- Within each section, amounts show only the symbol (e.g., "$150.00")

**The problem:** While BalanceSummary has partial mitigation through section headers, **other components do not**:
- `ExpenseItem` - no currency grouping
- `GroupCard` - shows only the first non-zero balance (arbitrary currency choice)
- `SettlementHistory` - no currency grouping
- `SplitBreakdown` - always single currency (per expense)
- `ExpenseDetailPage` - no currency code shown

### GroupCard Specific Issue

The `GroupCard` component on the dashboard has **additional ambiguity**:

**GroupCard.tsx:26-44:**
```typescript
// Get all currency balances - display the first non-zero balance, or first balance if all zero
const currencies = Object.keys(group.balance.balancesByCurrency);
if (currencies.length === 0) {
    return { text: t('groupCard.settledUp'), ... };
}

// Find first non-zero balance, or use first currency if all are zero
let balance = group.balance.balancesByCurrency[currencies[0]];
for (const currency of currencies) {
    const currencyBalance = group.balance.balancesByCurrency[currency];
    if (amountToSmallestUnit(currencyBalance.netBalance, currencyBalance.currency) !== 0) {
        balance = currencyBalance;
        break;
    }
}
```

**The problem:**
- When a group has balances in **multiple currencies**, the card shows **only one** (the first non-zero)
- Users have no indication that other currency balances exist
- Example: Group has +$50 USD and -$75 CAD → card shows "You are owed $50.00" (hides the CAD debt!)

This is a **critical UX issue** beyond symbol ambiguity.

## Proposed Solutions

### Option 1: Always Show Currency Code (Recommended)
Modify `formatCurrency()` to append or prepend the currency code:
- `$150.00 CAD` or `CAD $150.00`
- Clear and unambiguous
- Slightly more verbose

### Option 2: Show Currency Code Only When Ambiguous
- Detect when a group has multiple currencies with the same symbol
- Only show codes in those cases
- More complex logic, context-dependent display

### Option 3: Use Locale-Aware Formatting
- `Intl.NumberFormat` with different locales can produce different outputs
- CAD with `en-CA` locale might show `CA$150.00`
- Inconsistent across browsers/locales

### Option 4: Currency Code Badge/Pill
- Show a small badge next to amounts: `$150.00` [CAD]
- Visual distinction without cluttering the number
- Requires UI component changes

## Recommended Approach

**Option 1** is recommended for its simplicity and clarity. Implementation:

1. Add a `currencyDisplay` parameter to `Intl.NumberFormat`:
   ```typescript
   const formatter = new Intl.NumberFormat(locale, {
       style: 'currency',
       currency: currencyCode.toUpperCase(),
       currencyDisplay: 'code', // Shows 'USD' instead of '$'
       minimumFractionDigits: currency.decimal_digits,
       maximumFractionDigits: currency.decimal_digits,
   });
   ```

2. Or create a custom format string:
   ```typescript
   return `${formatter.format(numericAmount)} ${currencyCode.toUpperCase()}`;
   ```

## Implementation Notes

- Update `formatCurrency()` in `webapp-v2/src/utils/currency/currencyFormatter.ts`
- Update all tests in `webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts`
- Consider making display format configurable (symbol vs. code vs. both)
- Check if any e2e tests depend on exact currency format strings

## Complete List of Components Using formatCurrency

Research identified **all locations** where `formatCurrency()` is called:

### Core Formatting Function
- **`webapp-v2/src/utils/currency/currencyFormatter.ts:8`** - The main implementation

### UI Components (12 locations)
1. **`webapp-v2/src/components/group/BalanceSummary.tsx:103`** - Debt amounts between users
2. **`webapp-v2/src/components/group/ExpenseItem.tsx:35`** - Individual expense amounts in list
3. **`webapp-v2/src/components/dashboard/GroupCard.tsx:59,66`** - Balance display on dashboard cards
4. **`webapp-v2/src/components/settlements/SettlementHistory.tsx:165,213`** - Settlement amounts and confirmations
5. **`webapp-v2/src/components/settlements/SettlementForm.tsx:182,183,442`** - Settlement form validation messages
6. **`webapp-v2/src/components/expense/SplitBreakdown.tsx:104`** - Split amounts per user
7. **`webapp-v2/src/components/expense-form/ExpenseBasicFields.tsx:94`** - Expense amount preview
8. **`webapp-v2/src/components/expense-form/SplitAmountInputs.tsx:92,95,136,173`** - Split editing totals and individual amounts
9. **`webapp-v2/src/pages/ExpenseDetailPage.tsx:129,196,198,213,246`** - Expense detail view, share text, page title

### Currency Infrastructure
- **`packages/shared/src/currency-data.ts`** - 160+ currency definitions with symbols
- **`webapp-v2/src/app/services/currencyService.ts`** - Currency selection and grouping
- **`webapp-v2/src/app/hooks/useCurrencySelector.ts`** - Currency dropdown hook

### Test Files
- **`webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts`** - 14 test cases

**Total:** 30+ direct usages of `formatCurrency()` across the application.

## Impact Analysis

### Files Requiring Updates

**If implementing Option 1 (always show currency code):**

1. **Core function:**
   - `webapp-v2/src/utils/currency/currencyFormatter.ts` - Modify `formatCurrency()`

2. **Unit tests:**
   - `webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts` - Update all assertions

3. **E2E tests (potential):**
   - Search for hardcoded currency format strings in `e2e-tests/`
   - Update any tests that assert exact text like "$150.00"

4. **UI layouts (review needed):**
   - All 12 component locations may need layout adjustments
   - Some tight layouts may overflow with longer format (e.g., "$150.00 USD" vs "$150.00")

### Related Data Files

- `packages/shared/src/currency-data.ts` - Currency symbol definitions (no changes needed)
- `packages/shared/src/shared-types.ts` - Type definitions for multi-currency support

## Testing Requirements

### Unit Tests
- **`webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts`**
  - Update existing 14 test cases to expect new format
  - Add tests for currencies with shared symbols (USD/CAD, GBP/EGP, CNY/JPY)
  - Test both `currencyDisplay: 'code'` and manual append approaches

### Integration Tests
- Multi-currency group scenario:
  1. Create group
  2. Add expense in USD
  3. Add expense in CAD
  4. Verify both currencies display with codes
  5. Verify BalanceSummary shows distinct currencies

### E2E Tests (potential updates needed)
- Search for hardcoded currency assertions in `e2e-tests/`:
  - Text matchers like `.toContain('$150.00')`
  - Update to `.toContain('150.00 USD')` or use regex
- Test GroupCard display with multi-currency balances

### Visual Regression
- Review all 12 component layouts:
  - Ensure currency codes don't cause text overflow
  - Check mobile layouts (narrower screens)
  - Verify alignment in tables/lists
- Components with tight layouts:
  - `GroupCard` (dashboard cards are compact)
  - `ExpenseItem` (list items with limited width)
  - `SplitAmountInputs` (split editing UI)

### Accessibility
- Screen reader testing:
  - Verify "150 dollars USD" vs "150 dollars" announcement
  - Ensure currency codes are included in accessible labels
- ARIA labels may need updates if currency is decorative

## Next Steps

1. **Decision:** Choose implementation approach (Option 1 recommended)
2. **Prototype:** Modify `formatCurrency()` and test in one component
3. **Review:** Check visual impact on all 12 component locations
4. **Implement:** Roll out changes across all components
5. **Test:** Run full test suite and update assertions
6. **Document:** Update any user-facing documentation

## Additional Considerations

### GroupCard Multi-Currency Fix

Beyond symbol ambiguity, the **GroupCard component needs a separate fix**:

**Current behavior:**
- Shows only the first non-zero balance when multiple currencies exist
- Hides other currency balances entirely

**Proposed fix options:**
1. **Show all currencies** (vertically stacked):
   ```
   You owe $50.00 USD
   You are owed $75.00 CAD
   ```
2. **Show count indicator**:
   ```
   You owe $50.00 USD (+2 more)
   ```
3. **Show net across all currencies** (complex, requires exchange rates):
   - Not recommended without exchange rate API

**Recommendation:** Option 1 (show all currencies) for transparency.

### Internationalization (i18n)

The current implementation uses `en-US` locale by default:

```typescript
const { locale = 'en-US' } = options;
```

**Consider:**
- User's browser locale for number formatting
- Currency code position varies by locale (before vs after)
- RTL language support (Arabic, Hebrew)

**Future enhancement:** Respect user's locale preference from `authStore.user.preferredLanguage`.

## References

- Currency data: `packages/shared/src/currency-data.ts` (160+ currencies)
- MDN Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Multi-currency data model: `packages/shared/src/shared-types.ts:553-556`
