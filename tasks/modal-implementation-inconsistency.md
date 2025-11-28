# Task: Resolve Inconsistent Modal Implementations

## Objective
To improve code consistency and maintainability by refactoring all modal components to use a single, generic `Modal` component.

## Background
An audit of the `tsx` files in `webapp-v2` revealed that while the distinction between "pages" and "modals" is generally consistent, the implementation of modals is not. Several key modal components have their own custom logic for rendering and behavior, rather than using the generic `Modal` component provided in `src/components/ui/Modal.tsx`.

## Current State
- A generic `Modal` component exists at `src/components/ui/Modal.tsx`.
- Components like `PolicyAcceptanceModal` use this generic component correctly.
- Components like `CreateGroupModal` and `ShareGroupModal` re-implement their own modal logic, including backdrops, closing behavior, and animations.

## Problems
- **Code Duplication**: The same modal boilerplate is repeated in multiple files.
- **Inconsistent UX**: Custom implementations can lead to subtle visual and behavioral differences between modals, creating a disjointed user experience.
- **Maintenance Overhead**: Changes to modal behavior or styling must be manually applied to each custom implementation.

## Deliverables

### 1. Refactor `CreateGroupModal`
- [ ] Modify `webapp-v2/src/components/dashboard/CreateGroupModal.tsx` to use the generic `Modal` component.
- [ ] Replace the custom `div` structure with the `<Modal>` component.
- [ ] Pass the `isOpen` prop to `open` and `onClose` to `onClose`.
- [ ] Ensure all modal content, including the header, form, and footer, is correctly nested within the `Modal` component.
- [ ] Verify that all functionality (form submission, validation, closing) remains intact.

### 2. Refactor `ShareGroupModal`
- [ ] Modify `webapp-v2/src/components/group/ShareGroupModal.tsx` to use the generic `Modal` component.
- [ ] Replace the custom `div` structure with the `<Modal>` component.
- [ ] Pass the `isOpen` prop to `open` and `onClose` to `onClose`.
- [ ] Ensure all modal content and functionality (generating link, copying, QR code) remains intact.

### 3. Audit for Other Custom Modals
- [ ] Perform a search for other components that might be implementing modal logic from scratch.
- [ ] Refactor any other instances that are found.

### 4. Testing
- [ ] Manually test the refactored modals to ensure they open, close, and function as expected.
- [ ] Run relevant unit and integration tests to catch any regressions.

## User's Suggestion: Expense Form and Detail View as Modals

The user has also suggested that the expense form (`AddExpensePage`) and the expense detail view (`ExpenseDetailPage`) should be modals.

### `AddExpensePage` to Modal
- **Current**: A full-page form at `/groups/:groupId/add-expense`.
- **Proposed**: A modal for creating a new expense.
- **Analysis**: This is a significant design change. The current form is complex, with logic for selecting participants and splitting amounts. Moving this to a modal could make the UI feel cramped. However, it could also provide a more seamless user experience, as the user would not navigate away from the group page.
- **Implications**:
    - The routing logic in `App.tsx` would need to be changed.
    - The URL structure would need to be re-evaluated. Should opening the modal change the URL?
    - The `useExpenseForm` hook would need to be adapted to work within a modal context.

### `ExpenseDetailPage` to Modal
- **Current**: A full page showing expense details at `/groups/:groupId/expenses/:expenseId`.
- **Proposed**: A modal for viewing expense details.
- **Analysis**: This is also a significant change. A dedicated page allows for a detailed breakdown, including comments and split information. A modal might be too small for this.
- **Implications**:
    - This would also require changes to routing and URL handling.
    - It would change how users navigate to and share specific expenses.

### Recommendation on User's Suggestion
Before proceeding with this refactoring, it is important to have a clear plan for the user experience. I will ask the user for more details on how they envision the navigation and URL handling for these new modals.
