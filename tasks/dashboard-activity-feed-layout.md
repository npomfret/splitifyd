## Problem
The dashboard page looks lopsided on desktop when showing **Groups** alongside the **Activity Feed** (currently rendered as a right sidebar card). The user suggested either:
- Add something to balance the layout, or
- Keep only Groups on the page and move Activity Feed into a notifications-style dropdown.

## Goal
- Improve the desktop dashboard's visual balance and information hierarchy.
- Maintain existing functionality (activity feed still accessible and updates in real-time).
- Keep changes aligned with the webapp style guide (semantic tokens, no hardcoded colors).

## Non-Goals
- No backend/API changes.
- No new activity event types.
- No redesign of the Activity Feed content itself (only placement / presentation).

## Decision: Option B - Notifications Dropdown

Move the Activity Feed into a global notifications dropdown accessible from the header.

**Confirmed requirements:**
- Bell icon in header on **all authenticated pages** (not just dashboard)
- Simple **dot indicator** when new activity exists (client-side "last seen" timestamp)
- **Dropdown everywhere** - mobile AND desktop (remove in-page activity feed entirely)
- Dashboard becomes full-width (Groups only, no sidebar)

---

## Implementation Plan

### 1. Create BellIcon Component
**File:** `webapp-v2/src/components/ui/icons/BellIcon.tsx`

Standard icon component following existing patterns (ClockIcon, etc.). Export from `icons/index.ts`.

### 2. Create Notifications Store
**File:** `webapp-v2/src/app/stores/notifications-store.ts`

Tracks "last seen" timestamp per user:
- Uses `createUserScopedStorage()` from `@/utils/userScopedStorage.ts`
- Storage key: `activity_feed_last_seen`
- Subscribes to `activityFeedStore.itemsSignal` to compute `hasUnread`
- Compares first item's `createdAt` against stored timestamp
- `markAsSeen()` updates timestamp when dropdown opens
- `reset()` clears state on logout

### 3. Create NotificationsDropdown Component
**File:** `webapp-v2/src/components/layout/NotificationsDropdown.tsx`

Follows `UserMenu.tsx` pattern exactly:
- Click-outside handler with `useRef` + `useEffect` + capture phase
- `aria-expanded`, `aria-haspopup`, `aria-controls` for accessibility
- Absolute positioning (`end-0 mt-2`)
- Calls `notificationsStore.markAsSeen()` on open
- Bell button with conditional unread dot (`bg-semantic-error rounded-full`)

### 4. Create ActivityFeedDropdownContent Component
**File:** `webapp-v2/src/components/layout/ActivityFeedDropdownContent.tsx`

Extract content logic from `ActivityFeedCard.tsx`:
- Same loading/error/empty state handling
- Same pagination ("Load more" button)
- Adapted styling for dropdown context (no glass-panel, tighter padding)
- `onItemClick` callback to close dropdown after navigation
- Max-height with overflow scroll

### 5. Update Header Component
**File:** `webapp-v2/src/components/layout/Header.tsx`

Add lazy-loaded NotificationsDropdown next to UserMenu:
```tsx
{isAuthenticated.value && user.value && (
    <div className='flex items-center gap-4'>
        <Suspense fallback={<div className='w-8' />}>
            <NotificationsDropdown userId={user.value.uid} />
        </Suspense>
        <Suspense fallback={<div>...</div>}>
            <UserMenu user={user.value} />
        </Suspense>
    </div>
)}
```

### 6. Update DashboardPage
**File:** `webapp-v2/src/pages/DashboardPage.tsx`

- Remove `ActivityFeedCard` import and all usages
- Remove sidebar from `DashboardGrid` (or replace with full-width layout)
- Remove mobile activity feed section (`lg:hidden`)
- Groups section becomes the only content

### 7. Add Translations
**File:** `webapp-v2/src/locales/en/translation.json` (and other locales)

```json
"notifications": {
    "title": "Notifications",
    "openNotifications": "Open notifications"
}
```

### 8. Update Test Page Objects
**File:** `packages/test-support/src/page-objects/HeaderPage.ts`

Add methods:
- `verifyNotificationsBellVisible()`
- `openNotificationsDropdown()`
- `verifyUnreadIndicatorVisible()` / `NotVisible()`
- `clickNotificationItem(description)`

### 9. Create Playwright Test
**File:** `webapp-v2/src/__tests__/integration/playwright/notifications-dropdown.test.ts`

Test cases:
- Bell icon visible when authenticated
- Dropdown opens and shows activity items
- Unread indicator appears/disappears correctly
- Click item navigates and closes dropdown
- Click outside closes dropdown

### 10. Cleanup
- Remove/update `dashboard-activity-feed.test.ts` (activity feed tests move to notifications test)
- Optionally remove `DashboardGrid.tsx` if unused elsewhere

---

## Files to Create
| File | Purpose |
|------|---------|
| `webapp-v2/src/components/ui/icons/BellIcon.tsx` | Bell icon |
| `webapp-v2/src/app/stores/notifications-store.ts` | Last seen tracking |
| `webapp-v2/src/components/layout/NotificationsDropdown.tsx` | Dropdown wrapper |
| `webapp-v2/src/components/layout/ActivityFeedDropdownContent.tsx` | Feed content |

## Files to Modify
| File | Changes |
|------|---------|
| `webapp-v2/src/components/ui/icons/index.ts` | Export BellIcon |
| `webapp-v2/src/components/layout/Header.tsx` | Add NotificationsDropdown |
| `webapp-v2/src/pages/DashboardPage.tsx` | Remove activity feed, simplify layout |
| `webapp-v2/src/locales/en/translation.json` | Add notifications keys |
| `packages/test-support/src/page-objects/HeaderPage.ts` | Add notifications methods |
| `packages/test-support/src/translations/translation-en.ts` | Add translation keys |

---

## Testing Strategy
Single targeted Playwright test file covering the dropdown behavior. Run via:
```bash
cd webapp-v2
./run-test.sh notifications-dropdown
```

## Verification
- `npm run build` passes
- Notifications dropdown opens on all authenticated pages
- Unread dot appears when new activity exists
- Dashboard shows groups full-width (no sidebar)
- No console errors
