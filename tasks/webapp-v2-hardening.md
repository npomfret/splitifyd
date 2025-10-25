# Task: Webapp-v2 Hardening & Cleanup

## Overview
Track the outstanding correctness and maintainability issues surfaced during the recent webapp-v2 deep-dives.

## Issues To Address
- [x] **Move navigation side effects into effects**  
  - `src/App.tsx` redirect now runs from a `useEffect` keyed on auth state, keeping render pure.  
  - `src/pages/GroupDetailPage.tsx` waits for redirects via effects and surfaces inline errors only when actionable.

- [x] **Centralize routing through navigation service**  
  - `src/app/hooks/useFormSubmission.ts` delegates all navigations to `navigationService` to preserve logging and URL-change waits.

- [x] **Tighten type safety around lazy routes**  
  - `src/App.tsx` wraps lazy and protected components with typed helpers, replacing the former `any` usage.

- [x] **Consolidate duplicate group routes**  
  - `/group/:id` alias removed; `/groups/:id` is the single group detail path and 404 detection updated accordingly.

- [ ] **Abstract Firebase coupling in stores/services**  
  - Several stores depend directly on Firebase service specifics. Introduce interfaces or service-layer abstractions to ease future backend swaps and improve testability (referenced in `docs/UX-report1.md`).

- [ ] **Eliminate magic strings for storage and error codes**  
  - Promote keys like `USER_ID_KEY`, `recentCurrencies`, validation codes, etc., into central constants/enums to avoid drift.

- [ ] **Review auth registration flow for atomicity and error handling**  
  - Audit `register` paths to ensure partial failures (e.g., user created but profile not updated) roll back cleanly; bolster error messaging as noted in UX report 1.

- [ ] **Simplify complex store logic where possible**  
  - `enhancedGroupsStore` and `enhancedGroupDetailStore` have large surface areas. Identify opportunities to split concerns (e.g., pagination, subscriptions) into focused helpers to reduce cognitive load.
