# Comments Store Refactoring - Detailed Implementation Plan

## Overview
Refactor `webapp-v2/src/stores/comments-store.ts` to follow the app's pattern of using real-time notifications and API-based data fetching, eliminating direct Firebase dependencies. This will complete the abstraction layer by removing the last direct Firebase interaction in the webapp.

## Current State Analysis
- **Comments store**: Direct Firebase access with `onSnapshot`, `query`, `getDocs`
- **API endpoints**: Comment creation endpoints exist, but GET endpoints are missing
- **Schemas**: Comment schemas already exist in `apiSchemas.ts` with correct structure
- **UserNotificationDetector**: Currently doesn't track comment changes

## Implementation Strategy - Small Incremental Commits

---

## Phase 1: Backend - Add Comment Change Tracking (3 commits)

### Commit 1: Extend notification schema for comments
**Files to modify:**
- `firebase/functions/src/schemas/user-notifications.ts`
  - Add `lastCommentChange: FirestoreTimestampSchema.nullable()`
  - Add `commentChangeCount: z.number().int().nonnegative()`

- `webapp-v2/src/utils/user-notification-detector.ts`
  - Add `onCommentChange?: (targetType: 'group' | 'expense', targetId: string) => void` to NotificationCallbacks
  - Add fields to GroupNotificationState interface
  - Add hasCommentChanged() check method following existing pattern

**Tests:** None needed yet (schema changes only)

---

### Commit 2: Update NotificationService to handle comment changes
**Files to modify:**
- `firebase/functions/src/services/notification-service.ts`
  - Add 'comment' to ChangeType union
  - Update fieldMap to include comment fields
  - No other changes needed (existing methods will handle it)

**Files to create:**
- `firebase/functions/src/__tests__/unit/services/NotificationService-comments.test.ts`
  - Test updateUserNotification with 'comment' changeType
  - Test batchUpdateNotificationsMultipleTypes with comment changes
  - Follow patterns from existing NotificationService tests

---

### Commit 3: Create comment change trigger
**Files to create:**
- `firebase/functions/src/triggers/comment-tracker.ts`
  ```typescript
  // Track group comment changes
  export const trackGroupCommentChanges = onDocumentWritten(
    { document: 'groups/{groupId}/comments/{commentId}' },
    async (event) => {
      // Get groupId, notify all group members
      // Use notificationService.batchUpdateNotifications(userIds, groupId, 'comment')
    }
  );

  // Track expense comment changes
  export const trackExpenseCommentChanges = onDocumentWritten(
    { document: 'expenses/{expenseId}/comments/{commentId}' },
    async (event) => {
      // Get expense, find groupId, notify all group members
      // Use same pattern as trackExpenseChanges trigger
    }
  );
  ```

- `firebase/functions/src/index.ts`
  - Import and export new triggers

**Tests:**
- `firebase/functions/src/__tests__/integration/comment-notifications.test.ts`
  - Test comment creation triggers notifications
  - Test all group members receive notifications
  - Use NotificationDriver pattern from notifications-consolidated.test.ts

---

## Phase 2: Backend - Add GET Comment Endpoints (2 commits)

### Commit 4: Add list comment handlers
**Files to modify:**
- `firebase/functions/src/comments/handlers.ts`
  ```typescript
  export const listGroupComments = async (req, res) => {
    const groupId = req.params.groupId;
    const { cursor, limit = 20 } = req.query;
    const response = await commentService.listComments(
      'group', groupId, userId, { cursor, limit }
    );
    res.json({ success: true, data: response });
  };

  export const listExpenseComments = async (req, res) => {
    // Similar pattern for expenses
  };
  ```

- `firebase/functions/src/index.ts`
  - Add routes:
    - `app.get('/groups/:groupId/comments', authenticate, asyncHandler(listGroupComments))`
    - `app.get('/expenses/:expenseId/comments', authenticate, asyncHandler(listExpenseComments))`

---

### Commit 5: Add integration tests for comment APIs
**Files to create:**
- `firebase/functions/src/__tests__/integration/comment-api.test.ts`
  - Test GET /groups/:groupId/comments with pagination
  - Test GET /expenses/:expenseId/comments with pagination
  - Test authentication/authorization
  - Test cursor-based pagination
  - Use ApiDriver from test-support

---

## Phase 3: Frontend - Update Comments Store (4 commits)

### Commit 6: Add API client methods for fetching comments
**Files to modify:**
- `webapp-v2/src/app/apiClient.ts`
  ```typescript
  async getGroupComments(groupId: string, cursor?: string): Promise<ListCommentsResponse> {
    const response = await this.request<{ success: boolean; data: ListCommentsResponse }>({
      endpoint: '/groups/:groupId/comments',
      method: 'GET',
      params: { groupId },
      query: cursor ? { cursor } : undefined,
    });
    return response.data;
  }

  async getExpenseComments(expenseId: string, cursor?: string): Promise<ListCommentsResponse> {
    // Similar pattern
  }
  ```

**Note:** Schemas already exist in apiSchemas.ts, no changes needed there

---

### Commit 7: Refactor comments store - Part 1 (Setup notification listener)
**Files to modify:**
- `webapp-v2/src/stores/comments-store.ts`
  - Add constructor to accept dependencies:
    ```typescript
    constructor(
      private firebaseService: FirebaseService,
      private userNotificationDetector: UserNotificationDetector
    ) {}
    ```
  - Add notification subscription setup in registerComponent:
    ```typescript
    if (currentCount === 0) {
      // Setup notification listener
      this.#notificationUnsubscribe = this.userNotificationDetector.subscribe(
        userId,
        {
          onCommentChange: (type, id) => {
            if (type === targetType && id === targetId) {
              this.#refreshComments();
            }
          }
        }
      );
      // Fetch initial comments
      this.#fetchComments();
    }
    ```
  - Keep existing Firebase code temporarily (parallel implementation)

---

### Commit 8: Refactor comments store - Part 2 (Implement API-based fetching)
**Files to modify:**
- `webapp-v2/src/stores/comments-store.ts`
  - Add `#fetchComments()` method using apiClient
  - Add `#refreshComments()` method that preserves pagination state
  - Update `loadMoreComments()` to use API with cursor
  - Keep Firebase code but use feature flag or comment it out

---

### Commit 9: Refactor comments store - Part 3 (Remove Firebase dependencies)
**Files to modify:**
- `webapp-v2/src/stores/comments-store.ts`
  - Remove all Firebase imports
  - Remove `getDb()` usage
  - Remove `onSnapshot`, `query`, `getDocs` code
  - Clean up unused variables
  - Update singleton export to inject dependencies:
    ```typescript
    export const commentsStore = new CommentsStoreImpl(
      firebaseService,
      new UserNotificationDetector(firebaseService)
    );
    ```

**Files to update:**
- `webapp-v2/src/__tests__/unit/stores/comments-store.test.ts`
  - Update to mock UserNotificationDetector
  - Test notification-driven refresh
  - Test pagination with API calls

---

## Phase 4: End-to-End Testing (2 commits)

### Commit 10: Add e2e tests for comment real-time updates
**Files to create:**
- `e2e-tests/src/__tests__/integration/comments-realtime.e2e.test.ts`
  - Test multi-user comment updates
  - Test comment appears in real-time for all group members
  - Test pagination works with real-time updates
  - Follow patterns from existing e2e tests

---

### Commit 11: Cleanup and documentation
**Files to modify:**
- Remove any TODO comments
- Update inline documentation
- Run linters and fix any issues
- Ensure all tests pass

**Files to delete (if any temporary files were created)**

---

## Testing Strategy

### Unit Tests
- NotificationService with comment changes
- Comments store with mocked dependencies
- API client methods

### Integration Tests
- Comment trigger creates notifications
- GET endpoints return paginated comments
- Multi-user notification scenarios

### E2E Tests
- Real-time comment updates across users
- Pagination with live updates
- Error handling

---

## Success Metrics
✅ All Firebase imports removed from comments-store.ts
✅ Comments update via notifications, not direct Firebase
✅ Pagination works with API-based fetching
✅ All existing functionality preserved
✅ Zero console errors
✅ Tests demonstrate multi-user real-time updates

---

## Risk Mitigation
- Keep existing Firebase code initially (parallel implementation)
- Test each phase thoroughly before proceeding
- Use feature flags if needed for gradual rollout
- Ensure backward compatibility at each step

---

## Clean Architecture Benefits
1. **Complete abstraction** - Last Firebase dependency removed from webapp
2. **Consistent patterns** - Aligns with notification-driven architecture
3. **Better testing** - Can mock all dependencies
4. **Performance** - Reduces client-side Firebase operations
5. **Maintainability** - Single pattern for all real-time data

## Files to Create/Modify - Complete List

### Backend (firebase/functions/src/):
1. `schemas/user-notifications.ts` - UPDATE (add comment fields)
2. `services/notification-service.ts` - UPDATE (add comment change type)
3. `triggers/comment-tracker.ts` - NEW (comment change triggers)
4. `comments/handlers.ts` - UPDATE (add GET endpoints)
5. `index.ts` - UPDATE (add routes, export triggers)
6. `__tests__/unit/services/NotificationService-comments.test.ts` - NEW
7. `__tests__/integration/comment-notifications.test.ts` - NEW & CRITICAL
8. `__tests__/integration/comment-api.test.ts` - NEW

### Frontend (webapp-v2/src/):
1. `utils/user-notification-detector.ts` - UPDATE (add comment callbacks)
2. `app/apiClient.ts` - UPDATE (add GET comment methods)
3. `stores/comments-store.ts` - REFACTOR (remove Firebase, add notifications)
4. `__tests__/unit/stores/comments-store.test.ts` - UPDATE

### E2E Tests:
1. `e2e-tests/src/__tests__/integration/comments-realtime.e2e.test.ts` - NEW

---

## Technical Details

### Current Comments Store Issues
```typescript
// Current problematic patterns:
import { onSnapshot, collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { getDb } from '../app/firebase';

// Direct Firebase usage - breaks abstraction
const db = getDb();
const commentsQuery = query(collection(db, collectionPath), orderBy('createdAt', 'desc'), limit(20));
this.#unsubscribe = onSnapshot(commentsQuery, callback);
```

### Proposed Architecture
```typescript
// New pattern - matches other stores:
import { UserNotificationDetector } from '@/utils/user-notification-detector';
import { apiClient } from '../app/apiClient';

// Notification-driven with API fetching
this.notificationDetector.subscribe(userId, {
    onCommentChange: (targetType, targetId) => {
        if (this.matchesCurrentTarget(targetType, targetId)) {
            this.refreshComments();
        }
    }
});

async refreshComments() {
    const response = await apiClient.getGroupComments(targetId, cursor);
    this.#commentsSignal.value = response.comments;
}
```

### Notification Flow
1. User creates comment → CommentService.createComment()
2. Comment saved to Firestore subcollection
3. Firestore trigger → comment-tracker.ts
4. NotificationService updates all group members
5. Client UserNotificationDetector receives change
6. Comments store refreshes via API call
7. UI updates with new comments

### API Endpoints to Add
```typescript
// GET /groups/:groupId/comments?cursor=...&limit=20
app.get('/groups/:groupId/comments', authenticate, asyncHandler(listGroupComments));

// GET /expenses/:expenseId/comments?cursor=...&limit=20
app.get('/expenses/:expenseId/comments', authenticate, asyncHandler(listExpenseComments));
```