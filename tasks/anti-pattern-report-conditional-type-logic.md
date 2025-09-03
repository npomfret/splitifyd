# Anti-Pattern Report: Conditional Logic Based on Type

This report details all instances of conditional logic (`if`, `switch`) based on a `type` or `kind` property of an object. This is an anti-pattern that can lead to brittle code that is not easily extensible. Consider using polymorphism or other patterns like the visitor pattern to handle type-specific behavior.

---

## Findings

### 1. `firebase/functions/src/services/CommentService.ts`

- **Location:** `firebase/functions/src/services/CommentService.ts`
- **Lines:** 31-35, 48-51, 68-90
- **Snippet:**
  ```typescript
  private getCommentsCollection(targetType: CommentTargetType, targetId: string) {
      if (targetType === CommentTargetTypes.GROUP) {
          return this.groupsCollection.doc(targetId).collection(FirestoreCollections.COMMENTS);
      } else if (targetType === CommentTargetTypes.EXPENSE) {
          return this.expensesCollection.doc(targetId).collection(FirestoreCollections.COMMENTS);
      } else {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_TYPE', 'Invalid target type');
      }
  }

  private async verifyCommentAccess(targetType: CommentTargetType, targetId: string, userId: string, groupId?: string): Promise<void> {
      if (targetType === CommentTargetTypes.GROUP) {
          // ...
      } else if (targetType === CommentTargetTypes.EXPENSE) {
          // ...
      }
  }

  private async _listComments(
      //...
  ) {
      if (targetType === CommentTargetTypes.EXPENSE) {
          // ...
      }
  }

  private async _createComment(
      //...
  ) {
      if (targetType === CommentTargetTypes.EXPENSE) {
          // ...
      }
  }
  ```
- **Analysis:** The `CommentService` uses `if/else if` blocks to handle different `targetType` values (`GROUP` or `EXPENSE`). This logic is repeated across multiple methods (`getCommentsCollection`, `verifyCommentAccess`, `_listComments`, `_createComment`). This could be refactored to use a strategy pattern or polymorphism to handle different comment targets.

### 2. `firebase/functions/src/triggers/change-tracker.ts`

- **Location:** `firebase/functions/src/triggers/change-tracker.ts`
- **Lines:** 148-153
- **Snippet:**
  ```typescript
  export function createMinimalChangeDocument(entityId: string, entityType: 'group' | 'expense' | 'settlement', changeType: ChangeType, affectedUsers: string[], groupId?: string): Record<string, any> {
      // ...
      if (entityType === 'expense' || entityType === 'settlement') {
          if (!groupId) {
              throw new Error(`${entityType} change document must include groupId`);
          }
          baseDoc.groupId = groupId;
      }
      // ...
  }
  ```
- **Analysis:** The `createMinimalChangeDocument` function checks the `entityType` to decide whether to add a `groupId`. This is a minor violation, but it could be avoided by having separate functions or builders for different entity types.

### 3. `firebase/functions/src/utils/change-detection.ts`

- **Location:** `firebase/functions/src/utils/change-detection.ts`
- **Lines:** 22-39
- **Snippet:**
  ```typescript
  export function calculatePriority(changeType: ChangeType, changedFields: string[], documentType: 'group' | 'expense' | 'settlement'): ChangePriority {
      // ...
      const criticalFields: Record<string, string[]> = {
          group: ['memberIds', 'name', 'deletedAt'],
          expense: ['amount', 'currency', 'paidBy', 'splits', 'participants', 'deletedAt'],
          settlement: ['amount', 'currency', 'payerId', 'payeeId', 'from', 'to'],
      };

      const importantFields: Record<string, string[]> = {
          group: ['description'],
          expense: ['description', 'category', 'date'],
          settlement: ['note', 'date'],
      };

      const critical = criticalFields[documentType] || [];
      const important = importantFields[documentType] || [];
      // ...
  }
  ```
- **Analysis:** The `calculatePriority` function uses a dictionary lookup based on `documentType` to determine which fields are critical or important. While not a direct `if/else` or `switch`, it's still a form of dispatch-on-type that could be refactored.


---

## Implementation Plan

### Priority 1: CommentService Refactoring (CRITICAL - HIGH IMPACT)

**Current Issue:** `CommentService` has repeated conditional logic across multiple methods based on `CommentTargetType`.

**Solution:** Strategy Pattern
- Create `CommentTargetStrategy` interface
- Implement `GroupCommentStrategy` and `ExpenseCommentStrategy`
- Refactor service to use dependency injection of strategies

**Files to Create:**
- `firebase/functions/src/services/comments/CommentTargetStrategy.ts`
- `firebase/functions/src/services/comments/GroupCommentStrategy.ts` 
- `firebase/functions/src/services/comments/ExpenseCommentStrategy.ts`

**Benefits:**
- Eliminates 4 locations of duplicated conditional logic
- Makes adding new comment targets trivial (just add new strategy)
- Each strategy can be unit tested independently
- Follows Single Responsibility and Open/Closed principles

### Priority 2: Change Document Creation (MEDIUM IMPACT)

**Current Issue:** Type-based conditionals in change document creation and priority calculation.

**Solution:** Builder Pattern
- Create abstract `ChangeDocumentBuilder` base class
- Implement type-specific builders with encapsulated field validation rules
- Replace dictionary lookups with polymorphic behavior

**Files to Create:**
- `firebase/functions/src/builders/ChangeDocumentBuilder.ts`
- `firebase/functions/src/builders/GroupChangeBuilder.ts`
- `firebase/functions/src/builders/ExpenseChangeBuilder.ts`
- `firebase/functions/src/builders/SettlementChangeBuilder.ts`

**Benefits:**
- Encapsulates field importance rules per document type
- Type-safe validation of required fields
- Easy to add new document types without modifying existing code

### Priority 3: Testing Updates

**Update Tests for:**
- CommentService strategy pattern behavior
- Change document builder functionality
- Integration tests to ensure no behavioral regressions

## Implementation Order

1. **Phase 1:** CommentService refactoring (highest complexity, highest value)
2. **Phase 2:** Change document builders (medium complexity, good maintainability improvement)
3. **Phase 3:** Comprehensive test updates and validation

## Success Metrics

- Zero `if/else` or `switch` statements dispatching on type properties
- New types can be added by creating new strategy/builder classes only
- All existing functionality preserved (verified by tests)
- Code coverage maintained or improved
