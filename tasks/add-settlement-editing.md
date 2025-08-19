# Feature: Edit and Delete Settlements

## Overview

To provide users with full control over their financial records, this feature introduces the ability to edit or delete previously recorded settlements. This is a critical feature for correcting mistakes (e.g., wrong amount, wrong person) or removing erroneous entries.

## UI/UX Changes

### 1. Settlement History Item Actions

-   In the `SettlementHistory` component (and any other place where a single settlement is displayed), "Edit" and "Delete" buttons will be added to each settlement item.
-   These buttons should be styled subtly (e.g., small icons) and could appear on hover to avoid cluttering the UI.
-   **Permissions**: These actions should only be visible to the user who created the settlement or a group admin. This will require checking the `createdBy` field on the settlement against the current user's ID.

### 2. Edit Settlement Flow

-   Clicking the "Edit" button will open the existing `SettlementForm` modal.
-   The form will be pre-populated with the data from the selected settlement (payer, payee, amount, date, note).
-   The form's title and submit button text will change from "Record Payment" to "Update Payment".
-   Upon successful update, the settlement history view will automatically refresh to show the corrected information.

### 3. Delete Settlement Flow

-   Clicking the "Delete" button will trigger a `ConfirmDialog`.
-   The confirmation dialog will ask the user to confirm the deletion (e.g., "Are you sure you want to delete this payment of $50 from Alice to Bob? This action cannot be undone.").
-   If confirmed, the settlement will be deleted, and the settlement history and group balances will update automatically.

## Backend & API Requirements

-   The backend already provides the necessary API endpoints for updating and deleting settlements:
    -   `PUT /api/settlements/:settlementId`
    -   `DELETE /api/settlements/:settlementId`
-   This task is primarily a frontend implementation effort, involving:
    -   Calling `apiClient.updateSettlement()` from the `SettlementForm` when in edit mode.
    -   Calling `apiClient.deleteSettlement()` from the `SettlementHistory` component after confirmation.

## Implementation Steps

1.  **Modify `SettlementHistory.tsx`**:
    -   Add "Edit" and "Delete" icon buttons to each settlement item.
    -   Implement the permission check to show/hide these buttons.
    -   Wire up the "Delete" button to the confirmation dialog and the `deleteSettlement` API call.
    -   Wire up the "Edit" button to open the `SettlementForm` in an "edit mode".

2.  **Enhance `SettlementForm.tsx`**:
    -   Add a new prop, e.g., `isEditMode: boolean`, and another for the `settlement` object to be edited.
    -   When in edit mode, pre-populate the form fields from the settlement data.
    -   Change the form's title and submit button text based on the mode.
    -   On submit, call `apiClient.updateSettlement` instead of `createSettlement`.

3.  **Update State Management**:
    -   Ensure that after an edit or delete operation, the `enhancedGroupDetailStore` is refreshed (specifically balances and settlements) to reflect the changes across the application in real-time.
