# Multi-currency Support

**Status:** Not Implemented

## Description
This feature will allow users to manage expenses in different currencies. The application will not handle foreign exchange (FX) rates; instead, expenses will be grouped and handled on a per-currency basis. A group can have expenses in multiple currencies.

## Missing Items
- Ability to set a default currency for the user.
- Ability to set a **default** currency when creating a new group.
- When adding an expense, the currency field defaults to the last currency the user entered. For the user's first expense in a group, it defaults to the group's default currency.
- Balances and totals on the dashboard and within groups should be displayed per currency (e.g., "$100 USD", "€50 EUR").
- The "simplify debts" feature should operate independently for each currency.
