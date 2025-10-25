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
  - Activity feed store now consumes a dedicated `ActivityFeedGateway`, removing direct `FirebaseService` dependencies.
  - Next: replicate the gateway pattern for other stores that reach into Firebase primitives (see `docs/UX-report1.md`).

- [x] **Eliminate magic strings for storage and error codes**  
  - Centralized storage identifiers (session/local) via `STORAGE_KEYS`; `GroupDetail` now relies on `GROUP_DETAIL_ERROR_CODES` rather than string literals.

- [x] **Review auth registration flow for atomicity and error handling**  
  - `auth-store` now verifies the `/register` response, attempts Firebase sign-in directly, and surfaces a clear fallback message if automatic login fails so users can retry manually.

- [ ] **Simplify complex store logic where possible**  
  - `enhancedGroupsStore` and `enhancedGroupDetailStore` have large surface areas. Identify opportunities to split concerns (e.g., pagination, subscriptions) into focused helpers to reduce cognitive load.
