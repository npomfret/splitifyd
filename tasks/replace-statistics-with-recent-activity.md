# Feature: Replace Dashboard Statistics with Recent Activity

## Current State Snapshot
- The dashboard sidebar renders `DashboardStats` (`webapp-v2/src/components/dashboard/DashboardStats.tsx`), which shows a static count of total vs active groups.
- Real-time refresh already exists: `enhancedGroupsStore` listens to the `user-notifications/{userId}` document via `UserNotificationDetector` (`webapp-v2/src/app/stores/groups-store-enhanced.ts`, `webapp-v2/src/utils/user-notification-detector.ts`). Any change in transactions, balances, group details, or comments triggers a dashboard refresh.
- Back end triggers (`firebase/functions/src/triggers/ChangeTrackerHandlers.ts`) call `NotificationService.batchUpdateNotifications*` to bump per-group counters and timestamps inside the notification document. These methods currently keep `recentChanges` as an empty array.
- Tests (`firebase/functions/src/__tests__/unit/services/NotificationService*.test.ts`, `webapp-v2/src/__tests__/integration/playwright/dashboard-realtime-updates.test.ts`) expect the notification pipeline to fire but make no assertions about a feed or actor metadata.

## Updated Feature Definition
- Replace the stats card with a “Recent Activity” feed that highlights the latest changes across groups a user belongs to.
- Each feed item should show: group name, change category (transaction, balance, group settings, comment), relative timestamp, and a CTA that navigates to the group detail page. We will not show per-item actors or deep links to individual expenses because that data is not tracked today.
- Order the feed by most recent change and cap it at ~20 items to avoid an infinite scroll inside the sidebar.
- Show an empty state (“No recent activity yet”) when the user has no items.

## Data Source & Backend Changes
- Continue using the single `user-notifications/{userId}` document as the source of truth. Extend `NotificationService` to maintain a bounded `recentChanges` array for audit and presentation.
    - On every `batchUpdateNotifications` and `batchUpdateNotificationsMultipleTypes` call, push one entry per change type being recorded. Each entry should contain: `id` (string, e.g. `${groupId}:${changeType}:${Date.now()}`), `groupId`, `changeType`, `timestamp`, and optionally `changeVersion` for deduping.
    - Keep the array trimmed to the latest N entries (recommend 25) to avoid document bloat.
    - Ensure multi-type writes in `batchUpdateNotificationsMultipleTypes` add entries for each change type in the order passed.
    - Update `NotificationService` unit tests to assert `recentChanges` is populated, trimmed, and preserves ordering.
- No new collections or endpoints are required. The client already has read access to this document over Firestore. We only need to guarantee the document schema always has `recentChanges` (default to `[]` on initialization).

## Frontend Work
- Build a lightweight activity store (e.g. `webapp-v2/src/app/stores/recent-activity-store.ts`) that listens to `UserNotificationDetector` snapshots.
    - Parse `recentChanges` into domain objects sorted by timestamp.
    - Join group metadata by reusing `enhancedGroupsStore.groupsSignal`. If a group is missing (e.g. user removed), display the groupId as a fallback string.
    - Provide selectors for components to read `activities`, `loading`, and `error` states.
- Update `UserNotificationDetector` (`webapp-v2/src/utils/user-notification-detector.ts`) to surface the parsed `recentChanges` list through either a new callback (`onRecentActivity`) or by exposing the current array via a getter. Keep existing callbacks intact so groups continue refreshing.
- Replace `DashboardStats` usage in `DashboardPage.tsx` with a new `RecentActivityCard` component (`webapp-v2/src/components/dashboard/RecentActivityCard.tsx`). Responsibilities:
    - Subscribe to the recent activity store.
    - Render a skeleton while loading, the empty state when no entries exist, and the list otherwise.
    - For each entry, display group name, localized change description (new translation namespace `recentActivity.*`), relative time (reuse `dateHelpers` or `Intl.RelativeTimeFormat`), and a “View group” button that navigates via `navigationService.goToGroup`.
- Add supporting tests:
    - Store unit tests (Vitest) verifying parsing, trimming, and deduplication when notification snapshots change.
    - Component tests (Vitest + Testing Library) for loading, empty, and populated states.
    - Playwright regression that triggers a mock notification update and asserts the feed updates without breaking the existing dashboard refresh flow.
- Remove the old `DashboardStats` component and translation strings once the new card renders.

## Testing Strategy
- **Backend:** Update `NotificationService` unit tests to cover recentChanges behaviour; add regression coverage for multi-type updates and trim logic.
- **Frontend:** Extend unit/integration coverage noted above. Ensure existing dashboard Playwright suites continue to pass by updating snapshots or selectors where they referenced `dashboardStats`.
- **Manual:** Verify activity feed updates when adding an expense, editing a group, logging a settlement, and posting a comment through the emulator suite.

## Risks & Follow-ups
- Actor information is not available today; attempting to surface it would require new schema fields (`lastModifiedBy`) across expenses, settlements, and groups plus trigger updates. Defer until the feed is in place.
- Existing users may have notification documents without `recentChanges`. Initialization logic in `NotificationService.initializeUserNotifications` must guarantee the field exists, and the trimming logic should tolerate undefined arrays.
- Ensure the feed respects localization: all timestamps and labels need translation keys; avoid hard-coded English strings.

## Implementation Outline (Happy Path)
1. Backend: update `NotificationService` + tests, deploy emulator tests to confirm.
2. Frontend: implement recent activity store + detector wiring + component; swap `DashboardStats` in `DashboardPage`.
3. Update translations and remove unused stats assets.
4. Run lint, unit, and Playwright suites; document any new environment steps in `docs/guides/testing.md` if needed.
