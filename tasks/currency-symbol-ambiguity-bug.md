# [High] Currency Symbol Ambiguity and Data Obscurity Bug

## Status
🟢 **Completed** - Ready for Review

## Priority
**High** (was Medium) - The `GroupCard` issue hid critical financial data, which was a more severe problem than simple display ambiguity.

## Summary
Groups with expenses in multiple currencies that share the same symbol (e.g., USD and CAD both use "$") had display problems where users could not distinguish which currency was being shown.

**Critical issue resolved:** The `GroupCard` on the dashboard previously **showed only the first non-zero balance**, completely hiding other currency balances from the user. This is now fixed so every non-zero balance is rendered.

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

🟢 **FIXED: `GroupCard` Now Shows All Balances**
- Dashboard cards now iterate through every non-zero balance and render a badge line for each currency.
- **Example:** A group with balances of `+50 USD` and `-75 CAD` now shows both `You're owed $50.00 USD` **and** `You owe $75.00 CAD`.

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

#### 1. `GroupCard` now displays every balance
- `webapp-v2/src/components/dashboard/GroupCard.tsx` iterates across the per-currency map and renders a badge line per balance.
- Positive balances (money owed to the user) and negative balances (money the user owes) are grouped and ordered so credits appear before debts.
- Zero-balance groups still collapse to the existing "Settled up" badge.

#### 2. `formatCurrency` now renders unambiguous values
- `webapp-v2/src/utils/currency/currencyFormatter.ts` produces `SYMBOLAMOUNT CODE` strings (e.g., `$150.00 CAD`) by combining localized numbers with currency metadata.
- The formatter accepts `includeCurrencyCode?: boolean` for legacy contexts, defaulting to `true` so views are explicit by default.
- Shared-symbol currencies (USD/CAD, GBP/EGP, etc.) now display distinct codes without further call-site changes.

### Part 2: UX Enhancement (Conditional Display)

This remains a follow-up enhancement. With the baseline fix shipped, we can later decide whether to hide codes in single-currency contexts using a view-level heuristic (e.g., a `useCurrencyContext` hook).

## Implementation Notes

- Refactored `GroupCard` (see `webapp-v2/src/components/dashboard/GroupCard.tsx`) to build badge entries per currency and reuse the existing owed/owe copy.
- Updated the currency formatter (see `webapp-v2/src/utils/currency/currencyFormatter.ts`) to always append ISO codes while preserving locale-sensitive formatting and exposing an opt-out flag for legacy contexts.
- Added coverage:
  - Expanded `webapp-v2/src/__tests__/unit/vitest/utils/currency-formatting.test.ts` with explicit shared-symbol scenarios and the new `includeCurrencyCode` option.
  - Introduced `webapp-v2/src/__tests__/unit/vitest/components/GroupCard.test.tsx` exercising zero, positive, and mixed currency states.
  - Improved the currency selector button (see `webapp-v2/src/components/ui/CurrencyAmountInput.tsx`) so the current selection shows both the symbol and the ISO code, preventing ambiguity inside expense and settlement forms.
  - Added Playwright assertions (`webapp-v2/src/__tests__/integration/playwright/expense-form.test.ts`, `settlement-form.test.ts`) ensuring the selector button shows both symbol and code after selecting multi-country currencies.
- Remaining consideration: audit other currency-heavy views (e.g., `BalanceSummary`, settlements) for spacing regressions now that codes are longer.

## Follow-up / Open Questions

- Part 2 UX refinement (conditional code visibility) is still pending product design input.
- Playwright coverage for multi-currency flows is not yet implemented; manual smoke test recommended until automated scenario is added.

## Testing

- `webapp-v2`: `npm run test:unit`

## References

- Currency data: `packages/shared/src/currency-data.ts` (160+ currencies)
- MDN Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Multi-currency data model: `packages/shared/src/shared-types.ts:553-556`
