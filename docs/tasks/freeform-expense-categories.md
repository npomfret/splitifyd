# Task: Free-form Expense Categories with Suggestions

**Status:** Not Started

## Description

This task is to change the expense category input from a rigid dropdown to a flexible, free-form text field. To maintain usability, the field should display a list of suggested categories when the user focuses on it. The user will be able to select a suggestion or type a custom category.

## Acceptance Criteria

- The "Category" field on the "Add/Edit Expense" form is a text input field, not a `<select>` dropdown.
- When the category input field receives focus, a dropdown appears beneath it.
- The dropdown contains a predefined list of standard categories (e.g., "Food", "Transport", "Utilities", "Entertainment", "Shopping").
- The user can type any text into the input field, even if it's not in the suggestion list.
- The backend API for creating/updating expenses accepts a string for the `category` field (with reasonable length validation, e.g., 1-50 characters).
- Selecting an option from the suggestion dropdown populates the input field with that value.

## Future Enhancements

- The suggestion dropdown will query existing expenses in the current group and display the most frequently used categories at the top of the list.
- The suggestions will be filtered as the user types.
