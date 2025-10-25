# Task: Webapp-v2 Hardening & Cleanup

## Overview
Track the outstanding correctness and maintainability issues surfaced during the recent webapp-v2 deep-dives.

## Issues To Address
- **Move navigation side effects into effects**  
  - `src/App.tsx:55` fires `navigationService.goToLogin` during render when auth is missing. Shift this redirect into a `useEffect` that watches `authStore.initialized`/`authStore.user`.
  - `src/pages/GroupDetailPage.tsx:147-185` pushes users to dashboard/404 inside render branches. Replace with effects keyed on the error signal.

- **Centralize routing through navigation service**  
  - `src/app/hooks/useFormSubmission.ts:55-79` calls `route()` directly. Swap to `navigationService.goTo*` helpers so logging, URL-change waits, and auth redirects stay consistent.

- **Tighten type safety around lazy routes**  
  - `src/App.tsx` defines `LazyRoute`/`ProtectedRoute` with `any`. Replace with accurate `ComponentType`/prop generics to restore type checking.

- **Consolidate duplicate group routes**  
  - Both `/groups/:id` and `/group/:id` map to `GroupDetailPage`. Confirm legacy need; otherwise drop the redundant variant and update links/tests.

- **Abstract Firebase coupling in stores/services**  
  - Several stores depend directly on Firebase service specifics. Introduce interfaces or service-layer abstractions to ease future backend swaps and improve testability (referenced in `docs/UX-report1.md`).

- **Eliminate magic strings for storage and error codes**  
  - Promote keys like `USER_ID_KEY`, `recentCurrencies`, validation codes, etc., into central constants/enums to avoid drift.

- **Review auth registration flow for atomicity and error handling**  
  - Audit `register` paths to ensure partial failures (e.g., user created but profile not updated) roll back cleanly; bolster error messaging as noted in UX report 1.

- **Simplify complex store logic where possible**  
  - `enhancedGroupsStore` and `enhancedGroupDetailStore` have large surface areas. Identify opportunities to split concerns (e.g., pagination, subscriptions) into focused helpers to reduce cognitive load.
