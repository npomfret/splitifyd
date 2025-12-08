# Use SVG Currency Symbols Instead of ASCII Characters

**Status**: To Do

## Description

Currently, in various places of the application, such as the dashboard, amounts are displayed with ASCII currency symbols (e.g., "£33.31", "$10.00").

We have a set of pre-existing TSX components that render SVG icons for different currency symbols.

The goal of this task is to replace all instances of hardcoded ASCII currency symbols with their corresponding SVG icon components to ensure visual consistency and a more polished look across the application.

## Acceptance Criteria

- All currency symbols displayed next to amounts should be rendered using the appropriate SVG component.
- The changes should be applied at least on the dashboard page, and any other pages where monetary values are shown.
- The application should continue to display the correct currency symbol for the user's group/locale.
