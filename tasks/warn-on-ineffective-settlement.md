# Warn on Ineffective Settlement

## Problem

Currently, the application allows a user to record a settlement payment that does not actually reduce or clear any existing debts between the payer and the recipient. This can happen if the payer has no outstanding debt to the recipient, or if the payment amount is zero.

This is confusing because the system accepts the payment, but it has no effect on the group's balances. The user receives no feedback indicating that their action was meaningless.

## Goal

Warn the user when they are about to record a settlement that will not change the balances between the involved parties.

## Proposed Solution

1.  **Backend Validation:**
    - In the `recordSettlement` Firebase Function, before processing the settlement, check the current balances between the payer and the recipient.
    - The check should determine if the payer actually owes the recipient money.
    - If the payer's debt to the recipient is zero or less (meaning the recipient owes the payer or they are settled up), the API should reject the request with a specific error code (e.g., `INEFFECTIVE_SETTLEMENT`).

2.  **Frontend Handling:**
    - In the `webapp-v2` frontend, when the user attempts to record a settlement, the `ApiClient` will make the request to the backend.
    - If the API returns the `INEFFECTIVE_SETTLEMENT` error, the client should display a clear and informative warning message to the user in a modal dialog or a toast notification.
    - The message should explain why the settlement is ineffective (e.g., "This payment will not change the balance as [Payer] does not owe [Recipient] any money.").
    - The settlement should not be recorded, and the UI should revert to its previous state.

## User Experience

- **User Action:** User tries to record a settlement from User A to User B.
- **System Check:** The system determines User A owes User B $0.
- **Feedback:** The UI displays a warning: "You cannot record this settlement because there is no outstanding balance to be paid."
- **Result:** The settlement is not created, and the user understands why.

## Acceptance Criteria

- A user cannot record a settlement payment to someone they do not owe money to.
- A user cannot record a settlement for a zero amount.
- When an ineffective settlement is attempted, the user is shown a clear warning message.
- The system prevents the creation of a settlement that has no impact on balances.
