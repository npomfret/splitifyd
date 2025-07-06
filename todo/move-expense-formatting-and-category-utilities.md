# Move Expense Formatting and Category Utilities

**Problem**: The `ExpenseService` in `webapp/js/expenses.js` currently contains methods like `formatAmount`, `formatDate`, `getExpenseCategories`, `getCategoryIcon`, and `getCategoryLabel`. These are primarily utility functions related to data formatting and UI presentation, not core expense management logic (e.g., API calls, business rules). Including them in `ExpenseService` makes the service less focused, harder to maintain, and less reusable by other parts of the application that might need similar formatting or category information.

**File**: `webapp/js/expenses.js`

**Suggested Solution**:
1. **Create Dedicated Utility Files**: Create new JavaScript files for these utilities, grouping them logically. For example:
    - `webapp/js/utils/formatters.js` for `formatAmount` and `formatDate`.
    - `webapp/js/utils/expense-categories.js` for `getExpenseCategories`, `getCategoryIcon`, and `getCategoryLabel`.
2. **Move Utility Methods**: Move the respective methods to their new utility files, exporting them for use by other modules.
3. **Import and Use**: Update `webapp/js/expenses.js` (and any other modules that might need these utilities) to import and use these functions from their new shared utility files.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the code will be better organized and more modular.

**Risk**: Low. The changes are localized to the utility functions and their call sites. As long as the functions' behavior remains identical after moving, the risk of introducing bugs is minimal.

**Complexity**: Low. This is a straightforward refactoring that involves moving code to new files and updating import paths.

**Benefit**: Medium. This change will improve the separation of concerns, making `ExpenseService` more focused on its core responsibilities. It also enhances the reusability and testability of the formatting and category logic, as they can now be used independently across the application.