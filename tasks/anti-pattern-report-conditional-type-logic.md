# Anti-Pattern Audit: Conditional Type Logic (Updated)

## 1. Overview

This report details findings from a comprehensive audit of the entire codebase for a specific anti-pattern: **conditional logic based on an object's type property or runtime `typeof` checks.** This pattern often indicates a violation of object-oriented principles and can lead to brittle, hard-to-maintain code. The goal is to replace these structures with more robust, extensible patterns like polymorphism, strategy, or component mapping.

This updated audit verifies the findings of the original report and includes a complete scan of all `.ts` files in the repository.

---

## 2. Audit Findings (September 2025)

The audit confirms that while some of the originally identified files have been refactored, the core anti-pattern remains in several critical backend services and has been found in a key frontend state store.

### Finding 1: Type-Dispatching in Services (Unresolved)

The backend services continue to use `if/else` blocks to change behavior based on an entity's type, rather than encapsulating that behavior within the entities themselves.

*   **Location:** `firebase/functions/src/services/CommentService.ts`
*   **Issue:** The `getCommentsCollection` and `verifyCommentAccess` methods use `if (targetType === ...)` to handle `GROUP` and `EXPENSE` comment types. This creates duplicated logic and makes it difficult to add new commentable entity types in the future.
*   **Recommendation:** Refactor using a Strategy or Factory pattern. Create `GroupCommentStrategy` and `ExpenseCommentStrategy` classes that implement a common interface. The `CommentService` can then use a factory to select the correct strategy, eliminating the conditional logic.

### Finding 2: Inconsistent Data Models & Runtime `typeof` Checks (Unresolved)

This is the most widespread form of the anti-pattern in the codebase. Multiple services and stores handle data that can be one of several types (e.g., `Date` or `string`, `object` or `string`), forcing runtime `typeof` checks to handle the data correctly. This indicates an ambiguous data contract and leads to fragile code.

*   **Location:** `firebase/functions/src/services/GroupService.ts`
*   **Issue:** The `safeDateToISO` and `batchFetchGroupData` methods contain multiple `typeof value === 'string'` checks on date fields. This confirms that services are receiving date/timestamp information in an inconsistent format.
*   **Recommendation:** Enforce a strict data contract for all date/timestamp fields. Data should be stored as Firestore `Timestamp` objects and only converted to ISO strings at the API boundary. This eliminates the need for runtime type checking.

*   **Location:** `webapp-v2/src/app/stores/expense-form-store.ts`
*   **Issue:** This frontend store is a major offender. It is filled with `typeof this.#amountSignal.value === 'string'` checks. The `amount` signal, which represents a monetary value, is clearly being treated as both a `string` and a `number` throughout the store, requiring constant runtime parsing and checking.
*   **Recommendation:** Refactor the `expense-form-store` to treat the amount as a `number` internally. All string parsing should happen at the component boundary (when the user types into the input field), and the store itself should maintain a consistent, numeric type for the amount.

### Finding 3: Type-Based Logic in Triggers & Utilities (Unresolved)

Helper utilities and Firestore triggers also exhibit this anti-pattern.

*   **Location:** `firebase/functions/src/triggers/change-tracker.ts`
*   **Issue:** The `createMinimalChangeDocument` function uses `if (entityType === 'expense' || entityType === 'settlement')` to conditionally add a `groupId`.
*   **Recommendation:** Use a polymorphic approach. Create separate `ExpenseChangeDocumentBuilder` and `GroupChangeDocumentBuilder` classes that encapsulate the logic for creating their specific document structures.

*   **Location:** `firebase/functions/src/utils/change-detection.ts`
*   **Issue:** The `calculatePriority` function uses a dictionary lookup on `documentType` to determine priority.
*   **Recommendation:** This logic should be co-located with the entity's schema or definition. Each entity should be responsible for defining its own field priorities.

### Finding 4: Resolved or Outdated Issues

*   **`webapp-v2/src/components/group/ActivityFeed.tsx`**: This file was removed, so the original finding is no longer applicable. A new search did not reveal a direct replacement with the same `switch`-based anti-pattern.
*   **`firebase/functions/src/services/GroupMemberService.ts`**: The original file was removed. The logic for `themeColor` was moved to `UserService2.ts` and still contains a `typeof` check, which is now covered under Finding 2.
*   **`firebase/functions/src/utils/pagination.ts`**: The `typeof` check in this file is for validating the format of an opaque cursor and is considered a legitimate use of a type guard.

## 3. Conclusion

The anti-pattern of dispatching logic based on type properties or runtime `typeof` checks persists in key areas of the codebase, particularly concerning data models that lack a single, consistent type. While some of the originally identified UI components have been refactored, the core problem remains in the backend services and has a significant presence in the frontend `expense-form-store`.

Adopting more robust, object-oriented patterns (like the Strategy pattern) and enforcing stricter, more consistent data contracts (especially for dates and amounts) will be crucial for improving the long-term maintainability, reliability, and extensibility of the application.
