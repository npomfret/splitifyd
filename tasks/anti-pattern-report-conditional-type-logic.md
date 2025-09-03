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

### 4. `webapp-v2/src/components/group/ActivityFeed.tsx`

- **Location:** `webapp-v2/src/components/group/ActivityFeed.tsx`
- **Lines:** 33-45, 50-83
- **Snippet:**
  ```typescript
  const ActivityIcon = ({ type }: { type: string }) => {
      switch (type) {
          case 'expense_added':
              return <CurrencyDollarIcon className="h-5 w-5 text-green-500" />;
          case 'user_joined':
              return <UserPlusIcon className="h-5 w-5 text-blue-500" />;
          case 'expense_updated':
              return <PencilIcon className="h-5 w-5 text-yellow-500" />;
          case 'settlement_added':
              return <ClockIcon className="h-5 w-5 text-purple-500" />;
          default:
              return <ClockIcon className="h-5 w-5 text-gray-500" />;
      }
  };

  const ActivityText = ({ activity }: { activity: (typeof mockActivity)[0] }) => {
      const { t } = useTranslation();
      switch (activity.type) {
          case 'expense_added':
              // ...
          case 'user_joined':
              // ...
          case 'expense_updated':
              // ...
          case 'settlement_added':
              // ...
          default:
              return null;
      }
  };
  ```
- **Analysis:** The `ActivityFeed` component uses two `switch` statements based on the `type` of the activity. This is a classic example of the anti-pattern. This could be refactored into separate components for each activity type, with a parent component that dynamically renders the correct one.

---

## Recommendations

- **Refactor `CommentService`:** Introduce a strategy pattern where each `CommentTargetType` has its own strategy for fetching collections, verifying access, and listing/creating comments.
- **Refactor `change-tracker.ts` and `change-detection.ts`:** While minor, these could be made more robust by using a builder pattern for each document type, which would encapsulate the logic for which fields are required or important.
- **Refactor `ActivityFeed.tsx`:** This is the most significant violation. Create separate components for each activity type (e.g., `ExpenseAddedActivity`, `UserJoinedActivity`). A factory component can then be used to render the correct component based on the activity type.
