# ✅ COMPLETED: Activity Feed → Notifications Dropdown

## Problem (Resolved)
The dashboard page looked lopsided on desktop when showing **Groups** alongside the **Activity Feed** (rendered as a right sidebar card).

## Solution Implemented
Moved the Activity Feed into a global notifications dropdown accessible from the header on all authenticated pages.

**Key features:**
- Bell icon in header on **all authenticated pages**
- Simple **dot indicator** when new activity exists (client-side "last seen" timestamp in localStorage)
- **Dropdown everywhere** - mobile AND desktop
- Dashboard is now full-width (Groups only, no sidebar)

---

## Files Created

| File | Purpose |
|------|---------|
| `webapp-v2/src/components/ui/icons/BellIcon.tsx` | Bell icon component |
| `webapp-v2/src/app/stores/notifications-store.ts` | Last seen tracking with user-scoped localStorage |
| `webapp-v2/src/components/layout/NotificationsDropdown.tsx` | Dropdown wrapper with click-outside handling |
| `webapp-v2/src/components/layout/ActivityFeedDropdownContent.tsx` | Feed content extracted from ActivityFeedCard |

## Files Modified

| File | Changes |
|------|---------|
| `webapp-v2/src/components/ui/icons/index.ts` | Export BellIcon |
| `webapp-v2/src/components/layout/Header.tsx` | Added lazy-loaded NotificationsDropdown |
| `webapp-v2/src/components/layout/DashboardGrid.tsx` | Full-width support when no sidebar |
| `webapp-v2/src/pages/DashboardPage.tsx` | Removed activity feed, simplified layout |
| `webapp-v2/src/locales/*/translation.json` | Added notifications keys (all 13 locales) |
| `packages/test-support/src/page-objects/HeaderPage.ts` | Added notifications dropdown methods |
| `packages/test-support/src/page-objects/DashboardPage.ts` | Updated to use header dropdown |
| `webapp-v2/src/components/ui/Skeleton.tsx` | Updated comment reference |

## Files Deleted

| File | Reason |
|------|--------|
| `webapp-v2/src/components/dashboard/ActivityFeedCard.tsx` | Replaced by ActivityFeedDropdownContent |
| `webapp-v2/src/__tests__/unit/vitest/components/ActivityFeedCard.test.tsx` | Test for deleted component |

---

## Verification Completed

- ✅ `npm run build` passes
- ✅ Translation keys test passes
- ✅ Existing activity feed tests pass (delegated to header dropdown)
- ✅ All 13 locale files updated with expert-verified translations
- ✅ E2E tests pass: group comments, settlements, group locking activity feed
