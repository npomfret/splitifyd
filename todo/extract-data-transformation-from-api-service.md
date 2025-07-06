# Extract Data Transformation Logic from ApiService

**Problem**: The `_transformGroupsData` and `_formatLastActivity` methods in `webapp/js/api.js` are currently responsible for transforming raw API response data into a format suitable for the UI. While this is a necessary step, it mixes data transformation concerns with API interaction concerns within the `ApiService`. This violates the Single Responsibility Principle, making the `ApiService` less focused on its primary role of handling API requests and responses, and making the transformation logic harder to reuse or test independently.

**File**: `webapp/js/api.js`

**Suggested Solution**:
1. **Create a Dedicated Data Transformation Utility**: Create a new JavaScript file (e.g., `webapp/js/utils/data-transformers.js`) specifically to house all data transformation logic related to API responses.
2. **Move Transformation Methods**: Move `_transformGroupsData` and `_formatLastActivity` (and any other similar transformation methods that convert raw API data into UI-friendly formats) into this new utility file.
3. **Import and Use**: Update `webapp/js/api.js` to import the transformation functions from the new utility file and use them as needed within the `ApiService` methods. The `ApiService` should then return the already transformed data.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the `ApiService` will be more focused on API interactions, and the data transformation logic will be more modular and reusable.

**Risk**: Low. The changes are localized to the data transformation logic and are unlikely to have any side effects, provided the transformation functions are moved correctly and their imports are updated.

**Complexity**: Low. This is a straightforward refactoring that involves moving code to a new file and updating import paths.

**Benefit**: Medium. This change will improve the separation of concerns, making the `ApiService` more focused, and the data transformation logic more reusable, testable, and easier to maintain independently.