# Anti-Pattern Report: Conditional Logic Based on Type

This report details all instances of conditional logic (`if`, `switch`) based on a `type` or `kind` property of an object. This is an anti-pattern that can lead to brittle code that is not easily extensible. Consider using polymorphism or other patterns like the visitor pattern to handle type-specific behavior.

---

## Findings

### 1. `firebase/functions/src/services/CommentService.ts`

- **Location:** `firebase/functions/src/services/CommentService.ts`
- **Analysis:** The `CommentService` uses `if/else if` blocks to handle different `targetType` values (`GROUP` or `EXPENSE`). This logic is repeated across multiple methods (`getCommentsCollection`, `verifyCommentAccess`, `_listComments`, `_createComment`). This is a strong signal that `GROUP` and `EXPENSE` targets could be represented by polymorphic classes with a common interface for comment-related operations.
- **Recommendation:** Refactor to use a strategy or factory pattern. Create separate classes for `GroupCommentStrategy` and `ExpenseCommentStrategy` that encapsulate the unique logic for each target type. The `CommentService` would then use a factory to select the appropriate strategy based on the `targetType`.

### 2. `firebase/functions/src/triggers/change-tracker.ts`

- **Location:** `firebase/functions/src/triggers/change-tracker.ts`
- **Analysis:** The `createMinimalChangeDocument` function checks the `entityType` to decide whether to add a `groupId`. This is a minor violation, but it adds complexity to the function and makes it harder to maintain as new entity types are added.
- **Recommendation:** Use a builder pattern or separate functions for creating change documents for different entity types. This would encapsulate the logic for each type and make the code more modular.

### 3. `firebase/functions/src/utils/change-detection.ts`

- **Location:** `firebase/functions/src/utils/change-detection.ts`
- **Analysis:** The `calculatePriority` function uses a dictionary lookup based on `documentType` to determine which fields are critical or important. While not a direct `if/else` or `switch`, it's still a form of dispatch-on-type that can be improved.
- **Recommendation:** Co-locate the priority definitions with the entity schemas themselves. Each entity's configuration or class could expose its own critical and important fields, removing the need for a centralized dictionary.

### 4. `webapp-v2/src/components/group/ActivityFeed.tsx`

- **Location:** `webapp-v2/src/components/group/ActivityFeed.tsx`
- **Analysis:** The `ActivityFeed` component uses two `switch` statements based on the `type` of the activity to render different icons and text. This is a classic example of this anti-pattern in UI development. As new activity types are added, this component will become increasingly large and complex.
- **Recommendation:** Refactor this into a more component-based architecture. Create separate components for each activity type (e.g., `ExpenseAddedActivity`, `UserJoinedActivity`). A parent `ActivityFeed` component can then use a mapping from `activity.type` to the corresponding component to dynamically render the correct one. This makes the system much easier to extend.

---

## Conclusion

The codebase contains several instances of conditional logic based on type, particularly in the backend services and frontend components. While the current implementation works, refactoring these areas to use more robust patterns like polymorphism, strategy, or component mapping will significantly improve the code's maintainability, extensibility, and overall architectural quality.
