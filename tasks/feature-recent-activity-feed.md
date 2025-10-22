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
} as const;

export interface ActivityFeedItem {
    id: string;
    groupId: string;
    groupName: string;
    eventType: (typeof ActivityFeedEventTypes)[keyof typeof ActivityFeedEventTypes];
    actorId: string; // The user who performed the action
    actorName: string;
    timestamp: string; // ISO 8601 string
    details: {
        // Details specific to the event type
        expenseId?: string;
        expenseDescription?: string;
        commentId?: string;
        settlementId?: string;
        targetUserId?: string; // For member-joined/left events
        targetUserName?: string;
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
