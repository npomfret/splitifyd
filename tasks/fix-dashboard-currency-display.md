# Task: Fix Dashboard Multi-Currency Balance Display

## Overview

This task is to fix a critical bug on the main dashboard where the user's total balances ("You owe" and "You are owed") are not displayed correctly for users with debts in multiple currencies. The balances should be broken down and displayed on a per-currency basis.

## 1. Problem

-   **Incorrect Aggregation:** The dashboard appears to be either aggregating all debts into a single currency (likely the default, USD) or only displaying the balance for one currency, leading to incorrect totals.
-   **Misleading UI:** Users with debts in multiple currencies (e.g., owes $50 USD and is owed €20 EUR) see an inaccurate summary of their financial position.

## 2. Expected Behavior

As defined in the `basic-currency-support.md` specification, the dashboard balance summary must be currency-aware.

-   **Per-Currency Breakdown:** The UI should display a separate line item for each currency in which the user has a balance.
-   **Example:** If a user owes $50 USD and is owed €20 EUR, the dashboard should display something like:
    -   **You owe:**
        -   $50.00 (USD)
    -   **You are owed:**
        -   €20.00 (EUR)

## 3. Root Cause Analysis (Hypothesis)

-   **Component:** The React component responsible for rendering the dashboard's balance summary (likely in `webapp-v2/src/pages/DashboardPage.tsx` or a sub-component) is not correctly processing the multi-currency balance data.
-   **Data Structure:** The API likely returns a balance object grouped by currency. The frontend component might not be iterating over this structure correctly. For example, it might only be accessing the first currency in the list or failing to handle the object format.
-   **API Endpoint:** The API endpoint that provides the data for the dashboard (`/api/users/me/balance-summary` or similar) should be checked to ensure it's providing balances grouped by currency.

## 4. Solution

1.  **Verify API Response:** First, inspect the network request that fetches the user's total balance summary to confirm the data is being returned correctly, grouped by currency.
2.  **Locate UI Component:** Identify the React component responsible for rendering the "You owe" / "You are owed" section on the dashboard.
3.  **Update Rendering Logic:**
    -   Modify the component to iterate through the keys (currency codes) of the balance object received from the API.
    -   For each currency, render a separate line item.
    -   Use the `currencyFormatter` utility to ensure the amount for each currency is displayed with the correct symbol and formatting.
4.  **Handle No Debts:** Ensure the UI gracefully handles the case where a user has no debts or credits in any currency.

## 5. Acceptance Criteria

-   When a user has balances in multiple currencies, the dashboard must display a distinct summary for each currency.
-   Each summary must use the correct currency symbol and formatting.
-   The amounts displayed must be correct for each currency.
-   If a user only has a balance in a single currency, the display should remain clean and show only that currency's balance.

---

## 6. Implementation Status: ✅ **COMPLETED**

### **Issue Analysis - Root Cause Identified:**
The problem was **exactly as hypothesized** - the balance calculator and dashboard display were not handling multi-currency balances correctly:

1. **Backend Issue**: `firebase/functions/src/services/balanceCalculator.ts` line 71 assumed all expenses in a group had the same currency
2. **Frontend Issue**: `webapp-v2/src/components/dashboard/GroupCard.tsx` hardcoded USD symbol and didn't iterate through multiple currencies
3. **API Issue**: `listGroups` handler didn't return currency-specific balance breakdowns

### **Solution Implemented:**

#### **Backend Changes:**
1. **Type Definitions** (`shared-types.ts`):
   - ✅ Added `CurrencyBalance` interface for per-currency tracking
   - ✅ Updated `GroupBalance` and `Group` interfaces with `balancesByCurrency` field

2. **Balance Calculator** (`balanceCalculator.ts`):
   - ✅ **Fixed Line 71**: Removed single-currency assumption
   - ✅ Refactored to track balances separately per currency
   - ✅ Groups expenses and settlements by currency
   - ✅ Returns both legacy format (backward compatibility) and new multi-currency data

3. **API Response** (`groups/handlers.ts`):
   - ✅ Updated `listGroups` handler to calculate currency-specific balances
   - ✅ Filters out negligible balances (< 0.01)
   - ✅ Returns `balancesByCurrency` object with per-currency breakdown

#### **Frontend Changes:**
1. **GroupCard Component** (`GroupCard.tsx`):
   - ✅ **Fixed Display Logic**: Now iterates through all currencies instead of showing single balance
   - ✅ Uses proper `formatCurrency` utility instead of hardcoded USD symbols
   - ✅ Shows multiple balance badges when user has debts in different currencies
   - ✅ Maintains backward compatibility for single-currency scenarios

2. **UI Component** (`Card.tsx`):
   - ✅ Added `data-testid` support for testing

### **Testing Enhancement:**
- ✅ **Enhanced E2E Tests**: Updated `multi-currency-basic.e2e.test.ts` with proper assertions
- ✅ **Added Test**: `should verify dashboard supports multi-currency display`
- ✅ **Validation**: Test confirms multiple balance badges are displayed (`Found 3 balance badge(s)`)
- ✅ **Regression Prevention**: All existing tests pass, no functionality broken

### **Final Result:**
The dashboard now correctly displays:
- **Multiple Currencies**: "You owe $50.00", "You're owed €20.00", "You owe £30.00" as separate badges
- **Proper Formatting**: Each currency uses correct symbol and formatting via `formatCurrency` utility
- **Clean Display**: Single currency scenarios show one clean badge as before
- **Backward Compatible**: Existing single-currency groups continue to work

### **Verification:**
- ✅ Build passes without TypeScript errors
- ✅ All existing dashboard tests pass  
- ✅ Enhanced multi-currency tests pass
- ✅ E2E test confirms multi-currency badges display correctly
- ✅ Manual verification shows proper currency symbols and formatting

**Status**: **COMPLETE** ✅ - Multi-currency dashboard balance display now works correctly per specification.
