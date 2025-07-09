# Duplicated Modal Creation Logic

## Problem
- **Location**: `webapp/js/groups.js`
- **Description**: The `openCreateGroupModal` and `showShareGroupModal` functions both contain logic for dynamically creating and injecting modal HTML into the DOM. This is a duplication of concerns. The `ModalComponent` in `webapp/js/components/modal.js` should be the single source of truth for creating and managing modals.
- **Current vs Expected**:
  - **Current**: Modal HTML is manually created and managed in the `groups.js` file.
  - **Expected**: The `groups.js` file should use the `ModalComponent` to render and manage modals, separating the group logic from the modal presentation logic.

## Solution
1.  **Refactor `openCreateGroupModal`**:
    -   Import `ModalComponent`.
    -   Use `ModalComponent.render()` to generate the modal HTML.
    -   Use `ModalComponent.show()` to display the modal.
    -   Attach event listeners to the buttons within the modal, calling `ModalComponent.hide()` when done.

2.  **Refactor `showShareGroupModal`**:
    -   Follow the same pattern as above, using `ModalComponent` to handle all modal-related DOM manipulation.

Example refactoring for `showShareGroupModal`:

```javascript
// In webapp/js/groups.js
import { ModalComponent } from './components/modal.js';

// ...

async function showShareGroupModal() {
  try {
    const response = await api.generateShareableLink(currentGroupId);
    const shareUrl = response.data.shareableUrl;

    const modalId = 'shareGroupModal';
    const modalHtml = ModalComponent.render({
      id: modalId,
      title: 'Share Group',
      body: `
        <p>Share this link with others to invite them to join the group:</p>
        <div class="share-link-container">
            <input type="text" id="shareLink" class="form-control" value="${shareUrl}" readonly>
            <button class="button button--primary" id="copyShareLinkBtn">
                <i class="fas fa-copy"></i> Copy
            </button>
        </div>
      `,
      footer: `<button class="button button--secondary" id="shareModalCloseBtn">Close</button>`
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    ModalComponent.show(modalId);

    document.getElementById('shareModalCloseBtn').addEventListener('click', () => ModalComponent.hide(modalId));
    document.getElementById('copyShareLinkBtn').addEventListener('click', copyShareLink);

  } catch (error) {
    // ...
  }
}
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves code organization, reduces duplication, and adheres to the component-based structure).

## Implementation Notes
- This change will make the code in `groups.js` cleaner and more focused on business logic rather than DOM manipulation.
- It reinforces the role of `ModalComponent` as the single authority on how modals are created and managed.
