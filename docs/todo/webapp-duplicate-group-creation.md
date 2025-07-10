# Webapp Issue: Duplicate Group Creation

## Issue Description

When a user attempts to create a new group, cancels the process, and then attempts to create a group again, two identical groups are created simultaneously.

## Root Cause Analysis

The bug is located in the `webapp/src/js/groups.js` file, specifically within the `openCreateGroupModal` function and its interaction with the modal's lifecycle.

The sequence of events leading to the bug is as follows:

1.  **Initial Modal Opening:** The user clicks the "Create Group" button, which triggers the `openCreateGroupModal` function. This function programmatically creates the HTML for a modal dialog and appends it to the document's body. Crucially, it also attaches a `'click'` event listener to the modal's submit button (`#createGroupSubmit`).

2.  **Modal Cancellation:** The user decides to cancel the operation and clicks the "Cancel" button. The associated event listener for the cancel button correctly hides the modal by changing its CSS display property. However, it **fails to remove the modal element itself from the DOM**.

3.  **Lingering State:** At this point, the invisible modal, along with its active `'click'` listener on the submit button, remains in the DOM.

4.  **Second Modal Opening:** The user clicks the main "Create Group" button again. The `openCreateGroupModal` function is executed for a second time. It proceeds to create and append a **brand new, second modal** to the DOM. It also attaches a **new** `'click'` listener to the submit button of this second modal.

5.  **Duplicate Event Firing:** The user fills out the form in the newly visible modal and clicks "Create Group". This single click action is captured by **both** event listeners:
    *   The listener from the first, cancelled (but still present) modal.
    *   The listener from the second, visible modal.

As a result, the `apiService.createGroup()` function is called twice in rapid succession, leading to the creation of two groups on the backend.

## Recommended Solution

To fix this bug, the `openCreateGroupModal` function must be refactored to ensure that only one instance of the create group modal exists and has active listeners at any given time.

1.  **Ensure Cleanup:** Before creating a new modal, the function should check for and completely remove any existing modal element with the ID `createGroupModal` from the DOM.

2.  **Modify Cancel Logic:** The "Cancel" button's listener should also be updated to completely remove the modal from the DOM, not just hide it.

### Example Implementation:

```javascript
// In webapp/src/js/groups.js

async function openCreateGroupModal() {
    await ensureModalComponent();

    // **SOLUTION:** Remove any existing modal before creating a new one.
    const existingModal = document.getElementById('createGroupModal');
    if (existingModal) {
        existingModal.remove();
    }

    // ... (rest of the function to create and show the modal)

    // **SOLUTION:** The cancel button should also remove the modal.
    const cancelCreateGroupButton = document.getElementById('cancelCreateGroupButton');
    if (cancelCreateGroupButton) {
        cancelCreateGroupButton.addEventListener('click', () => {
            window.ModalComponent.hide('createGroupModal');
            // Also remove it from the DOM
            document.getElementById('createGroupModal').remove();
        });
    }

    // ...
}
```

By implementing this cleanup logic, we can guarantee that only one event listener is active, thus preventing the duplicate API calls.
