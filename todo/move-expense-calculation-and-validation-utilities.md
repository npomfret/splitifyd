# Move Expense Calculation and Validation Utilities

**Problem**: The `ExpenseService` in `webapp/js/expenses.js` currently contains utility methods like `calculateEqualSplit`, `validateSplitAmounts`, and `validateSplitPercentages`. These functions are generic helpers for expense-related calculations and validations and are not directly part of the core `ExpenseService` responsibility of interacting with the API. Placing them within the service class can make the service less focused, harder to test in isolation, and less reusable by other parts of the application that might need similar calculations.

**File**: `webapp/js/expenses.js`

**Suggested Solution**:
1. **Create a Dedicated Utility File**: Create a new JavaScript file (e.g., `webapp/js/utils/expense-calculations.js` or `webapp/js/utils/expense-utils.js`) specifically to house these expense-related calculation and validation utility functions.
2. **Move Utility Methods**: Move `calculateEqualSplit`, `validateSplitAmounts`, and `validateSplitPercentages` to this new utility file, exporting them for use by other modules.
3. **Import and Use**: Update `webapp/js/expenses.js` (and any other modules that might need these calculations) to import and use these functions from the new shared utility file.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the code will be better organized and more modular.

**Risk**: Low. The changes are localized to the utility functions and their call sites. As long as the functions' behavior remains identical after moving, the risk of introducing bugs is minimal.

**Complexity**: Low. This is a straightforward refactoring that involves moving code to a new file and updating import paths.

**Benefit**: Medium. This change will improve the separation of concerns, making `ExpenseService` more focused on API interactions. It also enhances the reusability and testability of the calculation and validation logic, as they can now be tested independently.