# Task: Record Manual Payments (Settlements)

## Description

To allow users to clear their debts, we need a feature to record payments made outside the application, such as cash, Venmo, or bank transfers. This will create a settlement transaction that adjusts the balances between users.

## Requirements

### 1. Record Payment Functionality

-   Users must be able to record a payment made to another member of a group.
-   The payment record should include:
    -   Payer (the user recording the payment)
    -   Payee (the user who received the money)
    -   Amount
    -   Currency (must be handled on a per-currency basis)
    -   Date of payment (defaults to today)
    -   An optional note/memo field.

### 2. UI/UX Flow

-   A "Settle Up" or "Record Payment" button should be prominently available, likely on the group detail page and next to balance summaries.
-   Clicking this button should present the user with a list of their simplified debts (e.g., "You owe User X $50").
-   The user can select a debt to settle, which pre-fills the payment form.
-   Alternatively, they can initiate a manual payment to any group member.
-   The form should be simple: select user, enter amount, confirm currency and date.

### 3. Impact on Balances

-   Recording a payment from User A to User B for a certain amount should decrease the amount User A owes User B (or increase the amount User B owes User A) by that amount in that specific currency.
-   This action will trigger a recalculation of the group's simplified debts.

### 4. Activity History

-   Recorded payments should appear in the group's main activity feed or a separate "Settlements" history.
-   The activity should clearly state "User A paid User B $XX.XX".

### 5. Backend Implementation

-   Create a new data model for `Settlement` transactions. It should be linked to a group and the two users involved.
-   Create a new API endpoint to handle the creation of these settlement records.
-   Update the `balanceCalculator` service to incorporate settlement transactions when calculating user balances. A payment can be treated as a special type of expense where the payee is the "payer" and the payer is the sole participant who owes the full amount.
