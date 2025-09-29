# Comments Store Refactoring Plan

## Overview
Refactor `webapp-v2/src/stores/comments-store.ts` to follow the app's pattern of using real-time notifications and API-based data fetching, eliminating direct Firebase dependencies. This will complete the abstraction layer by removing the last direct Firebase interaction in the webapp.

## Current State Analysis
- **Direct Firebase Access**: Comments store directly uses `onSnapshot`, `collection`, `query`, `getDocs` from Firebase
- **Real-time Subscriptions**: Manages its own Firebase listeners instead of using UserNotificationDetector
- **Missing API Integration**: Only uses API for creating comments, not for fetching
- **Pattern Deviation**: Doesn't follow the notification-driven pattern used by other stores

## Implementation Steps

### Phase 1: Backend - Add Comment Notifications & API Endpoints

#### 1.1 Extend UserNotificationDetector (Frontend)
- Add `onCommentChange?: (targetType: 'group' | 'expense', targetId: string) => void` to NotificationCallbacks interface
- Add comment tracking fields to GroupNotificationState:
  - `lastCommentChange: Timestamp | null`
  - `commentChangeCount: number`

#### 1.2 Update Backend Notification Schema
- Modify `user-notifications.ts` schema to include comment change tracking
- Add `lastCommentChange` and `commentChangeCount` fields

#### 1.3 Create Comment Triggers
- Create `firebase/functions/src/triggers/comment-tracker.ts`
- Trigger on comment creation/update/deletion in both group and expense subcollections
- Update all group members' notification documents when comments change

#### 1.4 Add GET Comments API Endpoints
- Add `GET /groups/:groupId/comments` endpoint with pagination support
- Add `GET /expenses/:expenseId/comments` endpoint with pagination support
- Return ListCommentsResponse with cursor-based pagination
- Reuse existing CommentService.listComments method

### Phase 2: Frontend - Refactor Comments Store

#### 2.1 Update API Client
- Add `getGroupComments(groupId, cursor?)` method
- Add `getExpenseComments(expenseId, cursor?)` method
- Add proper Zod validation schemas for responses

#### 2.2 Refactor Comments Store Architecture
- Remove all Firebase imports
- Accept FirebaseService in constructor (for consistency, even if not directly used)
- Replace direct Firebase subscriptions with:
  - API calls to fetch comments
  - UserNotificationDetector subscription for real-time updates
- Follow reference-counting pattern for component registration

#### 2.3 Implement Notification-Driven Updates
- Subscribe to comment change notifications
- Refresh comments via API when notification received
- Maintain pagination state through refreshes

### Phase 3: Testing

#### 3.1 Backend Integration Tests (Critical)
**Comment Notification Triggers**: Test that user notifications are correctly generated
- Test comment creation triggers user notifications for all group members
- Test comment updates trigger notifications
- Test comment deletion triggers notifications
- Test notifications include correct change counts and timestamps
- Test notification batching when multiple comments are added rapidly
- Test notification isolation between different groups/expenses
- Test edge cases: user removed from group, invalid comment data, etc.

**API Endpoints**: Test new GET endpoints with pagination
- Test `GET /groups/:groupId/comments` with cursor-based pagination
- Test `GET /expenses/:expenseId/comments` with cursor-based pagination
- Test authentication and authorization
- Test error handling for invalid group/expense IDs

**Multi-user Notification Scenarios**:
- Test notifications sent to all group members when group comment added
- Test notifications sent to expense participants when expense comment added
- Test user who created comment doesn't receive duplicate notification
- Test user notifications persist correctly across multiple comment operations

#### 3.2 Frontend Unit Tests
- Test store initialization and disposal
- Test notification handling and comment refresh logic
- Test pagination state management with refresh
- Test error handling when API calls fail
- Test reference counting for component registration

#### 3.3 E2E Tests
- Test real-time comment updates across multiple users in browser
- Test comment pagination works with live updates
- Test comment notifications trigger UI updates in group and expense contexts

## Key Architecture Benefits
1. **Complete Abstraction**: Removes last direct Firebase dependency from webapp
2. **Consistent Patterns**: Aligns with notification-driven architecture
3. **Better Testing**: Firebase interactions can be mocked via interface
4. **Performance**: Reduces client-side Firebase operations
5. **Maintainability**: Single pattern for all real-time data

## Migration Strategy
- Backward compatible - existing comments continue to work
- Gradual rollout - can test with feature flag if needed
- No data migration required - uses existing comment collections

## Files to Create/Modify

### Backend (firebase/functions/src/):
1. `triggers/comment-tracker.ts` - NEW
2. `comments/handlers.ts` - ADD list endpoints
3. `schemas/user-notifications.ts` - UPDATE
4. `services/notification-service.ts` - UPDATE
5. `index.ts` - ADD new routes

### Frontend (webapp-v2/src/):
1. `utils/user-notification-detector.ts` - UPDATE
2. `stores/comments-store.ts` - REFACTOR
3. `app/apiClient.ts` - ADD methods
4. `api/apiSchemas.ts` - ADD schemas

### Tests:
1. `firebase/functions/src/__tests__/integration/comment-notifications.test.ts` - **NEW & CRITICAL**
   - Test comment creation/update/delete triggers generate correct user notifications
   - Test all group members receive notifications when group comments change
   - Test notification document structure matches schema
   - Test change counters increment correctly
2. `firebase/functions/src/__tests__/integration/comment-api.test.ts` - NEW
   - Test GET endpoints for listing comments with pagination
   - Test authentication and authorization
3. `webapp-v2/src/__tests__/unit/stores/comments-store.test.ts` - UPDATE
   - Test notification-driven refresh logic

## Success Criteria
- ✅ All Firebase imports removed from comments-store.ts
- ✅ Comments update in real-time via notifications
- ✅ Pagination works with API-based fetching
- ✅ All existing functionality preserved
- ✅ Integration tests pass for new endpoints and triggers
- ✅ E2E tests verify multi-user real-time updates

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