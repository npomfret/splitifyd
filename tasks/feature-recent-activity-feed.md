# Feature: Recent Activity Feed

## 1. Overview

To provide users with a real-time overview of what's happening across their groups, this feature introduces a "Recent Activity" feed to the main dashboard. This feed will act as a centralized log of important events, making it easy for users to stay up-to-date without having to navigate into each group individually.

## 2. The Problem: Lack of a Centralized Overview

- Users currently have no single place to see recent activity. To check for new expenses, comments, or member changes, they must manually enter each group.
- This can be inefficient, especially for users who are members of many active groups.
- Important events, such as a new member joining or a large expense being added, can be easily missed.

## 3. The Solution: A Real-Time Activity Feed

The solution is to create a new, real-time "Recent Activity" feed on the dashboard that aggregates key events from all of the user's groups.

### 3.1. Proposed Data Structure

A new top-level collection, `activity-feed`, will be created in Firestore. Each document in this collection will represent a single activity item.

```typescript
// In packages/shared/src/shared-types.ts

export const ActivityFeedEventTypes = {
    EXPENSE_CREATED: 'expense-created',
    EXPENSE_UPDATED: 'expense-updated',
    EXPENSE_DELETED: 'expense-deleted',
    MEMBER_JOINED: 'member-joined',
    MEMBER_LEFT: 'member-left',
    COMMENT_ADDED: 'comment-added',
    SETTLEMENT_CREATED: 'settlement-created',
    SETTLEMENT_UPDATED: 'settlement-updated',
    GROUP_UPDATED: 'group-updated',
} as const;

export const ActivityFeedActions = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    COMMENT: 'comment',
    JOIN: 'join',
    LEAVE: 'leave',
} as const;

export interface ActivityFeedItem {
    id: string;
    groupId: string;
    groupName: string;
    eventType: (typeof ActivityFeedEventTypes)[keyof typeof ActivityFeedEventTypes];
    action: (typeof ActivityFeedActions)[keyof typeof ActivityFeedActions];
    actorId: string; // The user who performed the action
    actorName: string;
    timestamp: string; // ISO 8601 string
    details: {
        // Details specific to the event type
        expenseId?: string;
        expenseDescription?: string;
        commentId?: string;
        commentPreview?: string;
        settlementId?: string;
        settlementDescription?: string;
        targetUserId?: string; // For member-joined/left events
        targetUserName?: string;
        previousGroupName?: string;
    };
}
```

### 3.2. Implementation Plan

#### Phase 1: Backend - Activity Item Creation

1.  **Create `ActivityFeedService`**:
    - A new service responsible for creating and managing activity feed items.
    - It will have a method like `createActivityItem(item: Omit<ActivityFeedItem, 'id'>)`.

2.  **Integrate with Existing Services**:
    - The `ActivityFeedService` will be injected into the core services (`ExpenseService`, `GroupService`, `CommentService`, `SettlementService`).
    - After a relevant action is performed (e.g., an expense is created), the core service will call the `ActivityFeedService` to create a corresponding activity item.
    - This will be done asynchronously to avoid blocking the main operation.

    **Example in `ExpenseService.createExpense`:**
    ```typescript
    // After successfully creating the expense...
    await activityFeedService.createActivityItem({
        groupId: expense.groupId,
        groupName: group.name,
        eventType: 'expense-created',
        actorId: userId,
        actorName: user.displayName,
        timestamp: new Date().toISOString(),
        details: {
            expenseId: expense.id,
            expenseDescription: expense.description,
        },
    });
    ```

#### Phase 2: Backend - API Endpoint

1.  **Create New API Endpoint**:
    - `GET /api/activity-feed`: Fetches the recent activity for the authenticated user.
    - The handler for this endpoint will query the `activity-feed` collection.
    - The query will need to be smart: it should only return items for groups that the user is a member of. This will require getting a list of the user's groups first, and then performing a `where('groupId', 'in', [...userGroupIds])` query on the `activity-feed` collection.
    - The endpoint will support pagination (`limit` and `cursor`).

#### Phase 3: Frontend - UI/UX

1.  **Create "Recent Activity" Component**:
    - A new component will be created on the dashboard page to display the activity feed.
    - It will call the new `GET /api/activity-feed` endpoint to fetch the data.

2.  **Real-Time Updates**:
    - The component will use a real-time listener (e.g., a WebSocket connection, or a Firestore `onSnapshot` listener if we want to keep it simple for now) to listen for new activity items.
    - When a new item arrives, it will be prepended to the top of the feed.

3.  **Displaying Activity Items**:
    - Each item in the feed will be rendered in a human-readable format.
    - For example:
        - "**John Doe** added a new expense **"Lunch"** to the **"Trip to Bali"** group."
        - "**Jane Smith** joined the **"Apartment"** group."
        - "**You** added a comment to the **"Groceries"** expense."

4.  **Filtering and Pagination**:
    - A dropdown will allow users to filter the feed by a specific group.
    - A "Load More" button will be used to fetch the next page of activity items.

## 4. Security Considerations

- When fetching activity feed items, the backend must ensure that the user is a member of the groups for which activity is being returned. A user should never see activity for a group they are not a part of.
- All user-generated content displayed in the feed (e.g., expense descriptions, comments) must be properly sanitized to prevent XSS attacks.

## 5. Benefits

- **Improved User Engagement**: Provides a centralized and engaging way for users to keep up with what's happening.
- **Increased Transparency**: Makes group activities more visible to all members.
- **Saves Time**: Users can get a quick overview of all their groups without having to navigate to each one.

## 6. Phase 4: Deprecating the User Notification System

Once the real-time activity feed is implemented, it will completely replace the existing `user-notifications` system, which is complex and inefficient. This change will simplify the architecture and reduce Firestore costs.

### 6.1. Current System Overview

The current notification system is an over-engineered signaling mechanism with two main parts:

1.  **Backend (Fan-out on Write):** Firestore triggers (e.g., `trackGroupChanges`, `trackExpenseChanges`) monitor database changes. When a change occurs in a group, a Cloud Function writes a notification document for *every single member* of that group into the `user-notifications` collection. This results in a high number of write operations (N writes for N members) for a single logical change.

2.  **Frontend (Stateful Detector):** The `UserNotificationDetector` class in the webapp establishes a real-time listener on the current user's specific notification document (`user-notifications/{userId}`). It maintains a local state of change counters and versions. By comparing the incoming document with its last known state, it detects what has changed (e.g., transactions, balances) and fires corresponding callbacks (e.g., `onTransactionChange(groupId)`). These callbacks act as signals for the application's data stores to refetch data from the API.

This system is inefficient and adds significant complexity and cost.

### 6.2. The New Strategy: A Single, Unified Real-Time Stream

The new real-time activity feed will serve a dual purpose:

1.  **UI Feed:** Displaying human-readable events in the "Recent Activity" component.
2.  **Signaling Mechanism:** Acting as the primary real-time signal for triggering client-side data refreshes, completely replacing the `user-notifications` system.

When the frontend's real-time service receives an `ActivityFeedItem`, it will dispatch it to two places:
- The UI component for rendering.
- A new dispatcher that checks the `eventType` and `groupId`. If the event is relevant to the data currently being viewed by the user, it will trigger a targeted refresh in the appropriate data store (e.g., `expenseStore.fetchExpenses(groupId)`).

### 6.3. Refactoring and Removal Plan

#### Backend Refactoring

- **Delete Firestore Triggers:** The Cloud Functions responsible for listening to database changes and fanning out notifications will be deleted. This includes files like `change-tracker.ts` and `comment-tracker.ts`.
- **Delete `NotificationService`:** The `NotificationService` and any related helpers responsible for creating the `user-notifications` documents will be removed.
- **Remove `user-notifications` Collection:** All code that reads from or writes to the `user-notifications` collection will be deleted from services like `FirestoreWriter` and `FirestoreReader`.
- **Update Firestore Rules:** The security rules for the `user-notifications` collection will be removed.

#### Frontend Refactoring

- **Delete `UserNotificationDetector`:** The entire `webapp-v2/src/utils/user-notification-detector.ts` file and all its usages will be removed.
- **Enhance `RealtimeService`:** The new `RealtimeService` (proposed in Phase 3) will be enhanced. In addition to managing the WebSocket connection, it will include a dispatcher or event emitter.
- **Update Data Stores and Pages:** Components and stores that currently subscribe to the `UserNotificationDetector` will be updated to subscribe to the new `RealtimeService` instead. The logic will be more direct.

**Example of New Logic in a Component:**
```typescript
// In a component like GroupDetailPage.tsx

useEffect(() => {
    const handleActivityEvent = (event: ActivityFeedItem) => {
        // Check if the event is relevant to the current view
        if (event.eventType === 'EXPENSE_UPDATED' || event.eventType === 'EXPENSE_CREATED') {
            // Trigger a targeted data refresh
            expensesStore.fetchExpenses(groupId);
            balanceStore.recalculateBalances(groupId);
        } else if (event.eventType === 'MEMBER_LEFT') {
            membersStore.fetchMembers(groupId);
        }
    };

    // Subscribe to events for the current group
    const unsubscribe = realtimeService.subscribe(groupId, handleActivityEvent);

    // Unsubscribe on cleanup
    return () => unsubscribe();
}, [groupId]);
```

#### Testing Impact

- **Backend Tests:** All unit and integration tests for the old notification triggers and services will be deleted.
- **Frontend Tests:** Unit tests relying on mocking the `UserNotificationDetector` will be rewritten to mock the new `RealtimeService` and simulate incoming `ActivityFeedItem` events.
- **E2E Tests:** End-to-end tests may require updates to their waiting logic. Instead of waiting for the old notification mechanism, they will need to wait for UI changes triggered by the new real-time activity events.

## 7. Clarifications & Decisions (2025-02-14)

- Activity feed writes will happen inside the same Firestore transaction as the originating mutation. We will write one activity document per relevant user and immediately prune that user's feed back to a maximum of 10 items before the transaction completes.
- The REST API will default to returning 10 items per call, matching the stored maximum.
- Frontend real-time updates will use Firestore listeners (no WebSockets) to take advantage of the existing infrastructure and test mocks.
- The legacy `user-notifications` triggers and related code can be removed outright once the new feed ships; no dual-running period is required.

## 7.1. Implementation Design Decisions (2025-10-24)

### Store Architecture
**Decision**: Use private class fields (`#signal`) for all signals in `ActivityFeedStoreImpl`
**Rationale**: Enforces proper encapsulation per `docs/guides/code.md`, preventing external mutation of state. Only actions can modify state.
**Pattern**:
```typescript
class ActivityFeedStoreImpl {
    readonly #itemsSignal = signal<ActivityFeedItem[]>([]);
    get itemsSignal(): ReadonlySignal<ActivityFeedItem[]> {
        return this.#itemsSignal;
    }
}
```

### Subscription Lifecycle Management
**Decision**: Component/listener registration system with reference counting
**Rationale**: Avoids subscription churn documented in `docs/guides/webapp-and-style-guide.md`. Multiple components can share a single Firestore subscription.
**Implementation**:
- `registerComponent(id, userId)` - UI components register for data
- `registerListener(id, userId, callback)` - External listeners subscribe to new events
- Subscription created only once when first component/listener registers
- Subscription torn down only when all components/listeners deregister
- `useEffect` dependencies only include `userId`, not `initialized` state

### Pagination + Real-time Merge Strategy
**Decision**: Real-time snapshot updates first page (10 items), preserves paginated items below
**Rationale**: Balances real-time updates with pagination UX. Users see new events immediately without losing their scroll position.
**Algorithm**:
1. REST API loads initial 10 items + pagination cursor
2. Real-time listener monitors same 10-item window
3. When snapshot updates: merge with existing paginated items
4. Preserve items beyond first page that user loaded via "load more"
5. Update `hasMore` flag based on snapshot size (>10 means more available)

### Error Handling Strategy
**Decision**: No try-catch in store methods; errors bubble to component level
**Rationale**: Follows `docs/guides/code.md` principle: "Let it break, centralized error handling"
**Implementation**:
- Store methods throw errors naturally
- Component catches in async handlers: `void store.loadMore().catch(error => logError(...))`
- Error state stored in signal for UI display
- Retry mechanism provided via `refresh()` method

### i18n Integration
**Decision**: Event descriptions rendered with react-i18next, translation keys per event type
**Rationale**: Supports future internationalization, centralizes all user-facing text
**Pattern**:
```typescript
t('activityFeed.events.expense-created', { actor, expense, group })
```
Translation keys cover:
- 9+ event types (expense/member/comment/group/settlement events)
- Actor/target name resolution ("You" vs actual name)
- Error messages, loading states, empty states

### Type Safety
**Decision**: `ActivityFeedItem` uses ISO 8601 strings for timestamps (not Firestore Timestamp)
**Rationale**: Follows DTO-everywhere architecture from `docs/guides/types.md`
**Pattern**:
- Backend `ActivityFeedService` stores Firestore `Timestamp` objects
- Frontend store converts to ISO strings via `toISOString()` in `convertDocSnapshot()`
- Application logic works exclusively with ISO strings

### Component Decomposition
**Decision**: Single `ActivityFeedCard` component handles all rendering logic
**Rationale**: Simple feature with limited complexity doesn't justify multiple components
**Trade-off**: Acknowledged that `renderEventDescription()` function (50 lines) could be extracted if event types expand significantly

## 8. Implementation Plan (Agent)

1. Introduce shared activity feed types and integrate them across backend and frontend packages.
2. Build an `ActivityFeedService` that participates in existing transactions, including pruning logic, and inject it into expense, group, comment, and settlement flows.
3. Expose `GET /api/activity-feed` with membership filtering, cursor support, and a fixed page size of 10 items.
4. Create the dashboard activity feed UI, Firestore listener plumbing, and dispatcher that also signals domain stores.
5. Remove the legacy `user-notifications` backend triggers/services, frontend detector, and update associated tests.

## 9. Progress Log

### Phase 1-3: Backend & Frontend Implementation ✅ COMPLETE

- ✅ Shared activity-feed DTOs and response schemas added in `@splitifyd/shared`, including API validation for `GET /activity-feed`.
- ✅ Backend `ActivityFeedService` implemented with transactional write + prune helpers; Firestore reader/writer extended for user-scoped feeds.
- ✅ Expense, settlement, and comment services now emit activity entries within their existing transactions.
- ✅ New authenticated `/activity-feed` endpoint wired through Express/Firebase Functions with cursor pagination (limit 10).
- ✅ Member join/leave events now emit activity feed entries, with transactional pruning + unit tests covering approvals, leave/remove flows, and share-link joins.
- ✅ **Frontend activity feed store implemented** (`webapp-v2/src/app/stores/activity-feed-store.ts`)
- ✅ **ActivityFeedCard component created** with i18n support for all event types
- ✅ **Dashboard integration complete** - activity feed displayed on main dashboard
- ✅ **Real-time Firestore listener** implemented with pagination preservation logic
- ✅ **Action metadata + resource identifiers** persisted with every event (enables deep linking from feed entries)

### Phase 4: Legacy Notification System Removal ✅ COMPLETE

- ✅ **Deleted NotificationService** and all notification-related backend code (~600 lines)
- ✅ **Removed Firestore triggers**: `trackExpenseChanges`, `trackGroupChanges`, `trackExpenseCommentChanges`, `trackGroupCommentChanges`, `trackSettlementChanges`
- ✅ **Deleted ChangeTracker infrastructure**: `ChangeTrackerHandlers.ts`, `ChangeTrackerTriggerRegistry.ts`, `change-tracker.ts`
- ✅ **Removed user-notifications collection** from Firestore rules
- ✅ **Deleted UserNotificationDetector** (`webapp-v2/src/utils/user-notification-detector.ts` - 499 lines)
- ✅ **Cleaned up FirestoreWriter**: Removed `createUserNotification`, `removeGroupFromUserNotifications` methods (~220 lines)
- ✅ **Updated all services**: GroupService, GroupMemberService, ExpenseService, SettlementService now use ActivityFeedService
- ✅ **Test cleanup**: Removed obsolete notification tests (8 test files, ~1,600 lines)
- ✅ **E2E test updates**: Updated dashboard tests to work with new activity feed

### Net Impact
- **Deleted**: ~3,600 lines (notification system, triggers, detector, tests)
- **Added**: ~1,600 lines (activity feed service, store, UI, tests)
- **Net reduction**: ~2,000 lines of code
- **Architecture**: Simpler, more maintainable, better UX

## 10. Testing Status & Follow-ups

### Current Coverage
- ✅ **ActivityFeedStore unit suite** expanded (error handling, listener notifications, lifecycle) in `webapp-v2/src/__tests__/unit/vitest/stores/activity-feed-store.test.ts`.
- ✅ **ActivityFeedCard component tests** validating event rendering, actor/target resolution, empty/error/loading states, previews, and pagination controls in `webapp-v2/src/__tests__/unit/vitest/components/ActivityFeedCard.test.tsx`.
- ✅ **Playwright dashboard activity feed tests** (`webapp-v2/src/__tests__/integration/playwright/dashboard-activity-feed.test.ts`) exercise all event types, retries, pagination, and “You” actor logic.
- ✅ **Core end-to-end flows** now assert feed updates during expense, settlement, and comment scenarios (`e2e-tests/src/__tests__/integration/core-features.e2e.test.ts`).

### Remaining Follow-ups
- 🔄 Add targeted Playwright coverage for settlement update events once UI supports them (tracked separately).
- 🔄 Consider adding a regression hook to verify pruning behaviour beyond 10 items using emulator data snapshots.

The feed is now exercised from unit through e2e layers; new work should keep tests in sync and extend as additional event types ship.
