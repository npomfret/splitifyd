# Task: Basic Multi-Currency Support

## Description

To better support users who travel or live in different countries, the application needs to handle expenses in multiple currencies. This task covers the initial implementation of multi-currency support, focusing on tracking and balancing expenses on a per-currency basis without automatic conversion.

## Requirements

### 1. Expense Creation

-   When creating or editing an expense, the user must be able to select a currency for the amount.
-   A predefined list of major world currencies will be supported (e.g., USD, EUR, GBP, JPY, CAD, AUD, etc.). The final list will be provided.

### 2. Default Currency Logic

To make creating expenses faster, the currency field should have a smart default based on the following priority:

1.  **Last Used by User:** Default to the currency that the current user last used for an expense *within the current group*.
2.  **Last Used in Group:** If the current user has not created an expense in this group before, default to the currency that was last used by *any* member in the group.
3.  **Locale-Based Guess:** If it's the very first expense in a group, attempt to guess the user's local currency based on their browser's locale settings (e.g., `navigator.language`). USD should be the ultimate fallback.

### 3. Balance and Debt Calculation

-   All financial calculations must be currency-aware.
-   **No Automatic Conversion:** The application will not perform any foreign exchange (FX) conversions. All balances and debts will be maintained in their original currency.
-   **Per-Currency Balances:** The group balance summary and user balances on the dashboard must be displayed on a per-currency basis. For example, a user's balance might show "Owes $50 USD and is owed €20 EUR".
-   **Per-Currency Debt Simplification:** The "simplify debts" algorithm must operate independently for each currency. A user might owe another user in one currency and be owed by the same user in a different currency.

### 4. UI/UX Considerations

-   Clearly display the currency symbol or code next to all amounts throughout the application (expense lists, detail views, balance summaries).
-   The UI should be able to handle displaying multiple balance lines if a user has debts in more than one currency.
