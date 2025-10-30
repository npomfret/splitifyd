## Motivation
- Reduce reliance on brittle MSW mocks by exercising the actual Firebase handler stack in Playwright.
- Reuse the existing `AppDriver` in-memory backend to get realistic business logic without paying emulator startup/runtime costs.
- Provide a middle-ground backend mode that keeps tests fast while boosting confidence ahead of full emulator migration.

## Desired Outcome
- Playwright suite can run in three modes: `mock`, `app-driver`, and (later) `emulator`.
- Majority of specs execute against the `AppDriver` harness, using real request handlers for data setup and assertions.
- Only realtime/security-rule critical flows still need the emulator once it’s available.

## Open Questions
- Does the in-memory Firestore stub in `AppDriver` cover all scenarios we currently mock (especially realtime fan-out hooks)?
- How do we surface handler-side errors back through Playwright in a developer-friendly way?
- Do we need a lightweight auth token format, or can we keep delegating to the existing mock Firebase shim?
- What’s the best way to share API route → handler wiring so it stays maintainable as endpoints evolve?

## Incremental Plan

### Phase 0 — Discovery & Design (2-3 days)
1. Catalogue the REST/GraphQL endpoints the Playwright suite hits today (can pull from `mock-firebase-service.ts` + MSW handlers).
2. Audit `AppDriver` capabilities and document any missing handler coverage or side effects (e.g., webhook triggers, realtime broadcasts).
3. Draft an adapter design:
   - Request routing strategy (`page.route` vs. ServiceWorker/MSW).
   - Auth bridging (`mockFirebase` token → AppDriver user context).
   - Error propagation & logging.
4. Align design with stakeholders; confirm appetite for three backend modes (`mock`, `app-driver`, `emulator`).

**Deliverables**
- Short design brief hosted in `tasks/consolidate-playwright-testing.md` referencing this plan.
- Endpoint + capability matrix (which ones are supported out-of-the-box vs. require follow-up work).

### Phase 1 — Harness Implementation (1 week)
1. **Backend Harness**
   - Extract an `AppDriverGateway` module that exposes `handleRequest(method, path, body, query)` → `{ status, body }`.
   - Wrap `AppDriver` instantiation, user seeding, and teardown in a reusable class.
2. **Playwright Fixture**
   - Introduce new backend mode `app-driver` in `console-logging-fixture.ts` harness (sibling to `mock`).
   - Implement Playwright route interception that forwards `fetch` calls to the gateway and returns serialized responses.
   - Preserve existing MSW controller for non-API assets, but disable it for API calls in this mode.
3. **Auth Bridge**
   - Reuse the current mock Firebase auth shim to keep UI flows unchanged.
   - When the browser signs in, register the active UID with the gateway so handler calls run under that user.
   - Expose helpers on the harness to seed accounts/groups without manual MSW stubs.

**Exit Criteria**
- Smoke spec runs end-to-end using `AppDriver` for basic flows (login→create group→add expense).
- Handler errors show up in Playwright logs with stack traces.
- Tests remain headless-friendly and deterministic.

### Phase 2 — Test Migration (1-2 weeks)
1. Identify low-risk specs to switch (`dashboard-*`, basic expense CRUD).
2. Update fixtures in those specs to opt into `app-driver` backend mode; remove bespoke MSW mocks now redundant.
3. Add shared helpers for common setup (e.g., `seedGroupWithMembers`, `seedExpense`) backed by the gateway to keep specs concise.
4. Monitor runtime/flakiness; compare against current mock baseline.

**Exit Criteria**
- ≥60% of Playwright specs run green in `app-driver` mode.
- Removed MSW handlers for endpoints now handled by the gateway (ensure no dangling imports).
- Documented migration checklist for the remaining specs.

### Phase 3 — Hard Cases & Parity (1 week)
1. Address flows that rely on features the gateway lacks (multi-user realtime, commented threads, share links).
2. Extend the gateway or leave targeted tests on mock/emulator as warranted; document the rationale per scenario.
3. Finalize decision tree:
   - `mock`: purely client-side UI or custom error simulations.
   - `app-driver`: default for server-backed flows.
   - `emulator`: security rules, multi-client realtime, Cloud Function side-effects.
4. Update CI/local scripts to run `app-driver` suite (in addition to mock/emulator as needed).

**Exit Criteria**
- Decision tree published in `docs/guides/testing.md`.
- CI strategy defined (e.g., `mock` quick pass, `app-driver` smoke, optional `emulator` nightly).
- Agreement from team on long-term maintenance ownership.

## Risks & Mitigations
- **Handler mismatch**: Express middleware differences could cause parity issues. Mitigate by reusing the same handler factories (as AppDriver already does) and writing regression smoke tests.
- **Auth drift**: Stub auth may diverge from real Firebase behaviour. Keep emulator spot-checks for auth-heavy flows; ensure gateway user registration mimics Firebase claims used by the handlers.
- **Scope creep**: Some specs might still demand emulator behaviour (listeners, security rules). Preserve the dual-mode architecture so we can fall back where needed rather than forcing full migration.

## Next Steps After Approval
1. Fold the design brief into `tasks/consolidate-playwright-testing.md` and align with the broader dual-mode roadmap.
2. Start Phase 0 discovery, focusing on endpoint inventory and adapter design spikes.
