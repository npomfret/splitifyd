# Extract Debt Simplification Logic

**Problem**: The `simplifyDebts` function in `webapp/js/group-detail.js` contains complex business logic for simplifying debts between group members. This logic is tightly coupled with the `group-detail.js` script, making it harder to test independently, reuse in other contexts (e.g., if debt simplification is needed on a dashboard or in a different view), or maintain. It also makes the `group-detail.js` file larger and less focused on its primary responsibility of managing the group detail UI.

**File**: `webapp/js/group-detail.js`

**Suggested Solution**:
1. **Create a Dedicated Utility File**: Create a new JavaScript file (e.g., `webapp/js/utils/debt-simplifier.js`) specifically to house the debt simplification algorithm and any related helper functions.
2. **Move `simplifyDebts` Function**: Move the `simplifyDebts` function to this new utility file, exporting it for use by other modules.
3. **Import and Use**: Update `webapp/js/group-detail.js` (and any other modules that might need this functionality in the future) to import and use the `simplifyDebts` function from the new shared utility file.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the code will be better organized and more modular.

**Risk**: Low. The changes are localized to the debt simplification logic and are unlikely to have any side effects, provided the function is moved correctly and its imports are updated.

**Complexity**: Low. This is a straightforward refactoring that involves moving code to a new file and updating import paths.

**Benefit**: Medium. This change will improve the modularity and testability of the debt simplification logic, making it more reusable, easier to understand, and simpler to maintain independently.