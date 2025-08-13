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
