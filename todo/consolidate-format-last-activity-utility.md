# Consolidate _formatLastActivity Utility

**Problem**: The `_formatLastActivity` method, responsible for formatting timestamps into human-readable relative time strings (e.g., "just now", "5m ago"), is duplicated in both `webapp/js/api.js` and `webapp/js/groups.js`. This leads to unnecessary code duplication, increases the maintenance burden (as changes need to be applied in multiple places), and introduces potential for inconsistencies if the logic diverges.

**File**: `webapp/js/groups.js`

**Suggested Solution**:
1. **Create a Shared Utility File**: Create a new JavaScript file (e.g., `webapp/js/utils/formatters.js`) specifically to house common formatting utilities that can be reused across the application.
2. **Move `_formatLastActivity` Function**: Move the `_formatLastActivity` function from both `webapp/js/api.js` and `webapp/js/groups.js` into this new `formatters.js` file.
3. **Import and Use**: Update `webapp/js/api.js` and `webapp/js/groups.js` (and any other files that might need this functionality in the future) to import and use the `_formatLastActivity` function from the new shared utility file.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the code will be better organized and more maintainable.

**Risk**: Low. The changes are localized to the `_formatLastActivity` function and its call sites. As long as the function's behavior remains identical after moving, there should be no side effects.

**Complexity**: Low. This is a straightforward refactoring that involves moving code to a new file and updating import paths.

**Benefit**: Medium. This change will significantly reduce code duplication, improve consistency in date formatting across the application, and make the codebase easier to maintain and extend.