# Firebase Mock Refactor Plan

## Objective
- Replace the Playwright global monkey patch with an explicit dependency injection channel for `firebaseService`.
- Shift per-test HTTP mocks from ad-hoc `page.route` statements to a managed Mock Service Worker (MSW) setup that runs inside the browser context.

## Why change
- Global `window.__MOCK_FIREBASE_SERVICE__` can initialize too late or leak between tests, making failures non-deterministic.
- Route handlers accumulate and override one another (`page.route` has no built-in teardown), so tests silently mask regressions.
- Current Firestore mocking is shallow and difficult to extend (no error/metadata paths).

## Track A — Dependency Injection Entry Point
1. **Add provider API** — ✅ landed  
   - Export `setFirebaseService(mock: FirebaseService)` and `resetFirebaseService()` from `webapp-v2/src/app/firebase.ts`.  
   - Gate setters behind `import.meta.env.DEV` to prevent production usage. Harden with console warnings when called outside tests.
2. **Refactor module state** — ✅ landed  
   - Replace top-level singleton logic with a lazy `getFirebaseService()` that reads from an overridable source.  
   - Ensure invocation sites still receive a stable instance (memoise after first access).
3. **Update Playwright fixtures** — ✅ landed  
   - In `createMockFirebase`, call `page.addInitScript` that runs `window.__provideFirebaseForTests(mock)` which internally invokes `setFirebaseService`.  
   - Expose a teardown hook to call `resetFirebaseService()` during fixture disposal.
4. **Surface richer mock contract**  
   - Extend `MockFirebase` to implement the complete interface (including `connect`, `performTokenRefresh`, Firestore listeners).  
   - Optionally wrap auth state in an event emitter to simplify multi-listener support.

## Track B — MSW Network Mocking
1. **Baseline MSW setup** — ✅ landed  
   - Created `webapp-v2/src/test/msw/handlers.ts` and `types.ts` to describe REST endpoints (policies, groups, join, etc).  
   - Instead of shipping a browser worker we now translate these handler definitions into Playwright `page.route` interceptors so no service-worker registration is required.
2. **Boot worker in tests** — ✅ landed *(replaced by route controller)*  
   - The Playwright fixture wires the handler controller during `test.extend`, exposing `msw` helpers that mirror the MSW API (`start`, `use`, `resetHandlers`, `stop`).  
   - Tests call `await msw.use(...)` to register handlers; the fixture automatically clears them between runs.
3. **Port existing mocks** — ✅ landed  
   - Helpers such as `mockGroupsApi`, `mockJoinGroupFailure`, and the registration flows now feed `SerializedMswHandler`s into the Playwright route controller.  
   - All Playwright suites have been converted to `await msw.use(...)`; there are no lingering direct `page.route` hooks in tests or fixtures.
4. **Firestore simulation** — ✅ landed  
   - Added `MockFirebase.emitFirestoreSnapshot()` and rewired `triggerNotificationUpdate()` to use it, so tests no longer call `page.evaluate` directly when emitting snapshot updates.
5. **Teardown**  
   - Ensure each fixture/test resets MSW handlers (`msw.resetHandlers()`), and stop the worker on fixture disposal to avoid cross-test leakage.

## Migration Strategy
- Pilot with the login Playwright suite using both the DI setter and MSW handlers.
- Once stable, migrate other suites incrementally, converting helper imports from `mock-firebase-service` to MSW handler factories.
- After migration, prune unused `page.route` helpers and collapse `MockFirebase` to only auth/Firestore responsibilities.

## Validation
- ✅ `npm test` (2025-10-20) — passes with the new DI bridge in place.
- ⚠️ `npm run test:unit --workspace webapp-v2` (2025-10-20) — Vite dev server failed to bind to ::1 inside the sandbox (EPERM); rerun locally outside the restricted environment.
- ✅ `npx playwright test src/__tests__/unit/playwright/dashboard-auth-navigation.test.ts --project=chromium --workers=1` (2025-10-20) — green after adopting the MSW-backed route controller.
- ✅ `./run-test.sh src/__tests__/unit/playwright/register-authentication.test.ts` (2025-10-20) — repeated runs green with the MSW-driven registration handlers.
- Continue running the full Playwright suite locally to confirm end-to-end coverage.
- Verify no console warnings about missing provider or duplicate MSW registrations.
- Run `npm run lint` (or `dprint`) to confirm typing and formatting remain intact.

## Open Questions
- Should we expose MSW utilities to non-Playwright tests (e.g., Storybook, component tests)?
- Do we need a lightweight Firestore document store to simulate multiple listeners and metadata?
- What timeline is acceptable for migrating existing tests—single PR or staged rollout?
