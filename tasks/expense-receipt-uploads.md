
# Support uploading of receipts as images to expenses

This task is to allow users to upload an image of a receipt and attach it to an expense.

## Requirements

*   Users should be able to upload an image file (e.g., JPG, PNG) when creating or editing an expense.
*   The uploaded image should be stored securely.
*   The receipt image should be displayed on the expense details page.
*   There should be a way to delete the uploaded receipt image.

## Implementation Plan

### Backend (Firebase)

1.  **Firebase Storage:**
    *   Set up a new Firebase Storage bucket or a new folder within the existing bucket to store receipt images.
    *   Define security rules for the storage path to ensure that only authenticated users can upload and access their own group's receipts.
2.  **API Changes:**
    *   **`createExpense` / `updateExpense`:** Modify these endpoints to handle image uploads. This will likely involve a multi-part form data request.
    *   The backend will need to:
        *   Receive the image file.
        *   Upload it to Firebase Storage.
        *   Get the download URL of the uploaded image.
        *   Save the image URL to the expense document in Firestore.
    *   **`deleteExpense`:** When an expense is deleted, the corresponding receipt image should also be deleted from Firebase Storage.
    *   Add a new endpoint to delete a receipt from an expense without deleting the expense itself.
3.  **Firestore:**
    *   Add a `receiptImageUrl` field to the `Expense` document in Firestore.

### Frontend (Webapp)

1.  **UI Changes:**
    *   **Expense Form (Create/Edit):**
        *   Add a file input field to the expense form to allow users to select an image to upload.
        *   Show a preview of the selected image.
        *   Show a progress indicator during the upload.
    *   **Expense Details Page:**
        *   If an expense has a receipt image, display it.
        *   Clicking on the image should show a larger version in a modal or a new tab.
        *   Add a "Delete Receipt" button if a receipt is present.
2.  **API Client:**
    *   Update the `apiClient` to handle `multipart/form-data` requests for `createExpense` and `updateExpense`.
3.  **State Management:**
    *   Update the `expensesStore` to include the `receiptImageUrl` in the `Expense` type.

## Task Breakdown

-   [ ] **Backend:** Configure Firebase Storage and security rules.
-   [ ] **Backend:** Implement image upload logic in `createExpense` and `updateExpense` endpoints.
-   [ ] **Backend:** Add `receiptImageUrl` to the `Expense` data model.
-   [ ] **Backend:** Implement receipt deletion logic.
-   [ ] **Frontend:** Add file input and image preview to the expense form.
-   [ ] **Frontend:** Update `apiClient` for file uploads.
-   [ ] **Frontend:** Display receipt image on the expense details page.
-   [ ] **Frontend:** Implement receipt deletion UI and functionality.
-   [ ] **Testing:** Add unit and integration tests for the new functionality.
