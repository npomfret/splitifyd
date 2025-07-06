# Move Middleware from Logger to Middleware File

**Problem**: The `addCorrelationId` and `logRequest` middleware functions are currently defined in `firebase/functions/src/logger.ts`. However, they are fundamentally middleware components that are applied to the Express application, and are then imported and used in `firebase/functions/src/utils/middleware.ts`. This creates a logical inconsistency, makes the `logger.ts` file contain non-logging related code, and can potentially lead to circular dependencies or confusion about where middleware logic resides.

**File**: `firebase/functions/src/logger.ts`

**Suggested Solution**:
1. **Move Middleware Definitions**: Move the complete definitions of `addCorrelationId` and `logRequest` directly into `firebase/functions/src/utils/middleware.ts`. This consolidates all core Express middleware logic into a single, appropriate location.
2. **Remove Imports from logger.ts**: After moving the definitions, remove the now redundant imports of these functions from `firebase/functions/src/logger.ts`.
3. **Update References**: Ensure all existing references to these middleware functions throughout the codebase (e.g., in `firebase/functions/src/index.ts`) are updated to import them from their new location within `firebase/functions/src/utils/middleware.ts`.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain identical, but the internal code organization will be significantly improved.

**Risk**: Low. The changes involve moving code between files and updating import paths. As long as the code itself remains unchanged, the risk of introducing bugs is minimal.

**Complexity**: Low. This is a straightforward refactoring task that primarily involves cut-pasting code and updating import statements.

**Benefit**: Medium. This change will improve code organization, reduce logical inconsistencies, eliminate potential circular dependencies, and make the codebase easier to navigate and understand for future development and maintenance.