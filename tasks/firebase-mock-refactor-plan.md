# Firebase Mock Refactor Plan

## Objective
- Replace the Playwright global monkey patch with an explicit dependency injection channel for `firebaseService`.
- Shift per-test HTTP mocks from ad-hoc `page.route` statements to a managed Mock Service Worker (MSW) setup that runs inside the browser context.

## Why change
- Global `window.__MOCK_FIREBASE_SERVICE__` can initialize too late or leak between tests, making failures non-deterministic.
- Route handlers accumulate and override one another (`page.route` has no built-in teardown), so tests silently mask regressions.
- Current Firestore mocking is shallow and difficult to extend (no error/metadata paths).

## Track A — Dependency Injection Entry Point
1. **Add provider API**  
   - Export `setFirebaseService(mock: FirebaseService)` and `resetFirebaseService()` from `webapp-v2/src/app/firebase.ts`.  
   - Gate setters behind `import.meta.env.DEV` to prevent production usage. Harden with console warnings when called outside tests.
2. **Refactor module state**  
   - Replace top-level singleton logic with a lazy `getFirebaseService()` that reads from an overridable source.  
   - Ensure invocation sites still receive a stable instance (memoise after first access).
3. **Update Playwright fixtures**  
   - In `createMockFirebase`, call `page.addInitScript` that runs `window.__splitifydProvideFirebase(mock)` which internally invokes `setFirebaseService`.  
   - Expose a teardown hook to call `resetFirebaseService()` during fixture disposal.
4. **Surface richer mock contract**  
   - Extend `MockFirebase` to implement the complete interface (including `connect`, `performTokenRefresh`, Firestore listeners).  
   - Optionally wrap auth state in an event emitter to simplify multi-listener support.

## Track B — MSW Network Mocking
1. **Baseline MSW setup**  
   - Install MSW browser bundle and create `webapp-v2/src/test/msw/handlers.ts` describing REST endpoints (policies, groups, join, etc).  
   - Generate the worker script during `npm run test:playwright` (e.g. via `msw init public --save`).
2. **Boot worker in tests**  
   - In Playwright’s `page.addInitScript`, register the worker before navigation, then enable it within fixtures (`await window.msw.start({ quiet: true })`).  
   - Provide helper utilities for overriding handlers per test (`msw.use(...)`).
3. **Port existing mocks**  
   - Translate helpers like `mockGroupsApi`, `mockJoinGroupFailure` into MSW handler factories that return `rest.get/rest.post` handlers.  
   - Replace direct `page.route` usage with `await msw.use(handler)` calls in tests.
4. **Firestore simulation**  
   - Keep Firestore stubs within `MockFirebase` but emit snapshots via dedicated helper (`mockFirestoreSnapshot(collection, docId, payload)`) to reduce manual `page.evaluate` calls.
5. **Teardown**  
   - Ensure each fixture/test resets MSW handlers (`msw.resetHandlers()`), and stop the worker on fixture disposal to avoid cross-test leakage.

## Migration Strategy
- Pilot with the login Playwright suite using both the DI setter and MSW handlers.
- Once stable, migrate other suites incrementally, converting helper imports from `mock-firebase-service` to MSW handler factories.
- After migration, prune unused `page.route` helpers and collapse `MockFirebase` to only auth/Firestore responsibilities.

## Validation
- Playwright suites pass locally with `npm test`.
- Verify no console warnings about missing provider or duplicate MSW registrations.
- Run `npm run lint` (or `dprint`) to confirm typing and formatting remain intact.

## Open Questions
- Should we expose MSW utilities to non-Playwright tests (e.g., Storybook, component tests)?
- Do we need a lightweight Firestore document store to simulate multiple listeners and metadata?
- What timeline is acceptable for migrating existing tests—single PR or staged rollout?
