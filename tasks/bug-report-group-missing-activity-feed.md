# Bug Report: Missing Group Activity Feed

## Overview
When viewing the details of a specific group, there is currently no "Activity Feed" tab or section available. This feature is crucial for users to see a chronological log of all actions and events related to the group (e.g., expenses added, settlements made, members joining/leaving). The expected location for this feed is alongside other group-related information, such as the "Expenses" tab.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to any group page (e.g., by clicking on a group from the dashboard).
3. Observe the available tabs or sections within the group detail view.

## Expected Behavior
There should be an "Activity" tab (or similar) present, likely positioned between or adjacent to the "Expenses" and other functional tabs, which, when selected, displays the group's activity feed.

## Actual Behavior
No "Activity" tab or section is visible on the group detail page, preventing users from viewing a real-time log of group events.

## Impact
- **User Experience:** Users are unable to track changes and events within their groups, making it difficult to keep up-to-date with group dynamics and understand recent actions.
- **Auditing/Transparency:** Lack of an activity feed reduces transparency regarding group actions, which is important for shared financial groups.
- **Feature Gap:** A core feature described in the API documentation (`docs/guides/api.md` - "Real-Time Data Refresh via Activity Feed") is not exposed in the UI.

## Possible Cause (Initial Thoughts)
The activity feed functionality is described in the `docs/guides/api.md` under "Real-Time Data Refresh via Activity Feed", indicating that the backend infrastructure for generating activity events exists. The issue likely lies in the frontend (`webapp-v2`) not implementing or rendering the UI component for this feed, or not integrating with the store that provides the activity data.

Specifically, it might involve:
- The `GroupDetailPage` component not having the necessary routing or conditional rendering for an activity tab.
- A missing `ActivityFeed` component for groups, or an existing `ActivityFeed` component not being wired up correctly to display group-specific activity.
- The `group-detail-realtime-coordinator.ts` in `webapp-v2/src/app/stores/helpers/` might be correctly coordinating data refresh, but the UI component that *displays* this data for the group is absent.

## Priority
High - This is a significant missing feature that impacts the core functionality and user understanding of group activities. The backend support for this feature already exists, implying the frontend implementation is a critical next step.

---

## Analysis (Completed)

### Root Cause
The activity feed API is **user-scoped** (`GET /activity-feed`), not group-scoped. It returns activity across ALL groups the user belongs to. There is no endpoint to fetch activity for a specific group.

### Current Architecture
- Activity data stored at `activity-feed/{userId}/items/{itemId}` with `groupId` field
- `ActivityFeedCard` exists but is dashboard-only
- `GroupDetailPage` uses collapsible `SidebarCard` sections (Settlements, Comments) - no tabs

---

## Implementation Plan

### Phase 1: Backend - Add Group Activity Endpoint

| File | Change |
|------|--------|
| `firebase/functions/src/activity/ActivityHandlers.ts` | Add `getGroupActivityFeed` handler |
| `firebase/functions/src/services/firestore/FirestoreReader.ts` | Add `getActivityFeedForGroup(groupId, options)` method |
| `firebase/functions/src/routes/route-config.ts` | Add route: `GET /groups/:groupId/activity-feed` |
| `packages/shared/src/api.ts` | Add to API interface: `getGroupActivityFeed()` |

### Phase 2: Frontend - Store & API Client

| File | Change |
|------|--------|
| `webapp-v2/src/app/apiClient.ts` | Add `getGroupActivityFeed(groupId, options?)` method |
| `webapp-v2/src/app/stores/group-activity-feed-store.ts` | NEW: Group-scoped activity store with private signals |

### Phase 3: Frontend - UI Component

| File | Change |
|------|--------|
| `webapp-v2/src/components/group/GroupActivityFeed.tsx` | NEW: Display activity items with pagination |
| `webapp-v2/src/pages/GroupDetailPage.tsx` | Add `GroupActivityFeed` as collapsible `SidebarCard` (anchor: `#activity`) |

### Phase 4: Tests

| File | Change |
|------|--------|
| `firebase/functions/src/__tests__/unit/api/activity-feed.test.ts` | Add tests for group endpoint |
| `webapp-v2/src/__tests__/integration/playwright/group-activity-feed.test.ts` | NEW: Integration tests |

---

## Reference Files
- `webapp-v2/src/components/dashboard/ActivityFeedCard.tsx` - Existing activity card (reuse patterns)
- `webapp-v2/src/app/stores/activity-feed-store.ts` - Existing store (reference architecture)