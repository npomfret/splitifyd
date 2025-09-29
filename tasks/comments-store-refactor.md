# Comments Store Refactoring - Detailed Implementation Plan

## Overview
Refactor `webapp-v2/src/stores/comments-store.ts` to follow the app's pattern of using real-time notifications and API-based data fetching, eliminating direct Firebase dependencies. This will complete the abstraction layer by removing the last direct Firebase interaction in the webapp.

## Current State Analysis
- **Comments store**: Direct Firebase access with `onSnapshot`, `query`, `getDocs`
- **API endpoints**: Comment creation endpoints exist, but GET endpoints are missing
- **Schemas**: Comment schemas already exist in `apiSchemas.ts` with correct structure
- **UserNotificationDetector**: Currently doesn't track comment changes

## Implementation Strategy - Small Incremental Commits

⚠️ **CRITICAL**: Backend changes must be deployed before frontend changes to avoid runtime errors

---

## Phase 1: Backend - Add Comment Change Tracking ✅ COMPLETED

### Commit 1: Extend backend notification schema for comments ✅ DONE
**Files modified:**
- ✅ `firebase/functions/src/schemas/user-notifications.ts`
  - ✅ Added `lastCommentChange: FirestoreTimestampSchema.nullable()`
  - ✅ Added `commentChangeCount: z.number().int().nonnegative()`
  - ✅ Updated RecentChangeSchema to include 'comment' type

---

### Commit 2: Update NotificationService to handle comment changes ✅ DONE
**Files modified:**
- ✅ `firebase/functions/src/services/notification-service.ts`
  - ✅ Added 'comment' to ChangeType union
  - ✅ Updated fieldMap to include comment fields
  - ✅ Existing methods automatically handle the new change type

**Files created:**
- ✅ `firebase/functions/src/__tests__/unit/services/NotificationService-comments.test.ts`
  - ✅ Tests updateUserNotification with 'comment' changeType
  - ✅ Tests batchUpdateNotificationsMultipleTypes with comment changes
  - ✅ Follows patterns from existing NotificationService tests

---

### Commit 3: Create comment change trigger ✅ DONE
**Files created:**
- ✅ `firebase/functions/src/triggers/comment-tracker.ts`
  - ✅ `trackGroupCommentChanges` - Triggers on group comment changes
  - ✅ `trackExpenseCommentChanges` - Triggers on expense comment changes
  - ✅ Both triggers notify all group members when comments are added/changed
  - ✅ Uses existing NotificationService patterns

**Files modified:**
- ✅ `firebase/functions/src/index.ts` - Added imports and exports for new triggers

**Tests created:**
- ✅ Added comprehensive comment notification tests to `notifications-consolidated.test.ts`
- ✅ Tests comment creation triggers notifications for all group members
- ✅ Tests both group and expense comment scenarios
- ✅ Uses NotificationDriver pattern for integration testing

**Additional improvements:**
- ✅ Enhanced test infrastructure with comment testing utilities
- ✅ Updated ApiDriver and NotificationDriver for comment support
- ✅ Added firestore-stubs tracking for better unit test validation

---

### Commit 4: **DEPLOY BACKEND** 🚀 READY FOR DEPLOYMENT
**Status:** ✅ Backend implementation complete, ready for deployment

**What's ready:**
- ✅ Comment notification schema is complete and validated
- ✅ Comment triggers are implemented with comprehensive test coverage
- ✅ All tests pass in emulator environment
- ✅ Integration tests verify real-time comment notifications work end-to-end

**Deployment verification checklist:**
- [ ] Deploy to firebase emulator and run integration tests
- [ ] Verify comment triggers fire correctly when comments are created
- [ ] Verify user notification documents are updated with comment changes
- [ ] Confirm all group members receive comment notifications

**⚠️ CRITICAL**: Backend must be deployed before proceeding to frontend changes

---

## Phase 2: Backend - Add GET Comment Endpoints (2 commits)

### Commit 5: Add list comment handlers
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

### Commit 6: Add integration tests for comment APIs
**Files to create:**
- `firebase/functions/src/__tests__/integration/comment-api.test.ts`
  - Test GET /groups/:groupId/comments with pagination
  - Test GET /expenses/:expenseId/comments with pagination
  - Test authentication/authorization
  - Test cursor-based pagination
  - Use ApiDriver from test-support

---

---

## Phase 3: Frontend - Update Comments Store (5 commits)

### Commit 7: Update frontend notification detector for comments
**Files to modify:**
- `webapp-v2/src/utils/user-notification-detector.ts`
  - Add `onCommentChange?: (targetType: 'group' | 'expense', targetId: string) => void` to NotificationCallbacks
  - Add fields to GroupNotificationState interface
  - Add hasCommentChanged() check method following existing pattern
  - Update baseline setting to include comment fields

**Important:** Backend must be deployed first - this commit depends on backend notification schema

---

### Commit 8: Add API client methods for fetching comments
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

### Commit 9: Refactor comments store - Part 1 (Setup notification listener)
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

### Commit 10: Refactor comments store - Part 2 (Implement API-based fetching)
**Files to modify:**
- `webapp-v2/src/stores/comments-store.ts`
  - Add `#fetchComments()` method using apiClient
  - Add `#refreshComments()` method that preserves pagination state
  - Update `loadMoreComments()` to use API with cursor
  - Keep Firebase code but use feature flag or comment it out

---

### Commit 11: Refactor comments store - Part 3 (Remove Firebase dependencies)
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

### Commit 12: Add e2e tests for comment real-time updates
**Files to create:**
- `e2e-tests/src/__tests__/integration/comments-realtime.e2e.test.ts`
  - Test multi-user comment updates
  - Test comment appears in real-time for all group members
  - Test pagination works with real-time updates
  - Follow patterns from existing e2e tests

---

### Commit 13: Cleanup and documentation
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