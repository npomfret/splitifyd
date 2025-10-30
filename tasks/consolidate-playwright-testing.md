## Motivation
- Reduce duplication by retiring `e2e-tests/src/__tests__/integration` and relying on a single Playwright test suite.
- Reuse the richer mock-based fixtures while still validating critical scenarios against real Firebase to maintain confidence.
- Improve overall runtime by limiting the slow emulator-backed runs to a targeted subset of tests.

## Goals & Anti-Goals

### Goals
- Single test suite with ~90% mock coverage, ~10% emulator coverage
- Fast feedback loop: mock suite completes in <5 minutes
- High confidence: critical flows validated against real Firebase
- Easy developer workflow: clear decision tree for which mode to use

### Anti-Goals
- Not aiming for 100% emulator coverage (defeats performance goal)
- Not trying to eliminate all mocks (they're faster and useful for edge cases)
- Not building a general-purpose testing framework (optimize for this codebase only)

## Timeline & Effort Estimates

| Phase | Steps | Estimated Effort | Critical Path? |
|-------|-------|------------------|----------------|
| Phase 0: Analysis | Step 1 | 3-5 days | Yes |
| Phase 1: Infrastructure | Steps 2-4 | 2-3 weeks | Yes |
| Phase 2: Migration | Step 5 | 2-4 weeks | Yes |
| Phase 3: Validation | Steps 6-7 | 1-2 weeks | Yes |

**Total: 6-10 weeks** (assumes 1 developer full-time or 2 developers part-time)

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Emulator tests too flaky | Medium | High | POC 3 critical tests in Phase 0; halt if >5% flake rate |
| Auth porting takes 3x longer | High | Medium | Allocate 2 weeks buffer; consider incremental auth strategy |
| Mock divergence from Firebase | Medium | High | Document mock update process; quarterly sync checks |
| Team slows down during migration | Medium | Medium | Maintain both suites in CI until Step 7; clear dev guide |
| Coverage gaps discovered late | Low | High | Mandate Step 1 signoff before proceeding; stakeholder review |

**Rollback Plan**: If emulator mode proves untenable (flake rate >5% or runtime >15 min), revert to maintaining separate e2e suite with reduced scope.

# Phase 0 · Step 1 — Catalogue & Gap Analysis

Working notes while mapping `e2e-tests/src/__tests__/integration` scenarios onto the Playwright suite in `webapp-v2/src/__tests__/integration/playwright`.

---

## E2E → Playwright Mapping

### core-features.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Owner lacks “Leave Group” button | ✅ `group-detail.test.ts` (mock) | Mock | UI-only check already covered. |
| Non-owner member can leave group | ⚠️ Partial (`group-detail.test.ts` verifies member actions but mocks leave flow) | Emulator | Need real auth + leave mutation to ensure balances/users update correctly. |
| Owner removes member | ❌ None | Emulator | Requires multi-user + real security rules enforcement. |
| Remove last non-owner member | ❌ None | Emulator | Same as above; ensure redirect behaviour + group integrity. |
| Prevent leaving/removing with outstanding balance | ❌ None | Emulator | Depends on server-side validation. |
| Allow leave/remove after settlement clears balance | ❌ None | Emulator | Needs real balances/settlement transactions. |
| Member removal realtime fan-out | ❌ None | Emulator | Multi-client event propagation; mocks insufficient. |
| User leaving during expense operations | ❌ None | Emulator | Tests locking + 404 behaviour; needs backend. |
| Group edit validation | ✅ `group-display-name-settings.test.ts` (mock) | Mock | Validation logic handled client-side. |
| Settings button permission gating | ✅ `group-detail.test.ts` (mock) | Mock | Already asserted via mocks. |
| Approve/reject pending members | ✅ `group-security-pending-members.test.ts` (mock) | Emulator (spot-check) | Flow exists, but add emulator smoke test to ensure Firestore rules honoured. |
| Group deletion scenarios | ❌ None | Emulator | Deletion impacts dashboards + other viewers. |
| Realtime group comments across users | ⚠️ Partial (`group-detail-comments-pagination.test.ts`) | Emulator | File covers pagination, not multi-user realtime. Need emulator coverage. |

### departed-member-locking.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Expense locks when participant leaves | ⚠️ Partial (`expense-detail-locked.test.ts`) | Emulator | UI lock state mocked today; need backend trigger validation. |
| Settlement locks when payer leaves | ❌ None | Emulator | Requires real settlement + membership change flow. |

### error-handling-comprehensive.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Network failure during group creation | ⚠️ Partial (`dashboard-modals.test.ts` via MSW) | Mock | Keep mock-based; ensure emulator run verifies server 5xx handling once. |
| Malformed API response resilience | ⚠️ Partial (`dashboard-groups-display.test.ts` asserts fallback UI) | Mock | Mock adequate; emulator run optional. |
| Server error + timeout handling | ⚠️ Partial (scattered UI tests) | Mock | Consider one emulator smoke test to validate toast/logging integration. |

### expense-and-balance-lifecycle.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Full expense lifecycle + balances | ❌ None | Emulator | Core business flow; requires validation against real data writes. |
| Multi-currency expense & settlement | ❌ None | Emulator | Currency precision best validated end-to-end. |
| Expense creation with custom date/time | ⚠️ Partial (`expense-form.test.ts`) | Emulator | Mock covers UI but not persistence; add emulator case. |
| Complex multi-expense net balance calc | ❌ None | Emulator | Heavy reliance on backend aggregation. |
| Multi-user settlement realtime updates | ❌ None | Emulator | Needs multiple clients + listeners. |
| Date convenience buttons & time input | ✅ `expense-form.test.ts` (mock) | Mock | Pure UI. |
| Real-time expense comments | ⚠️ Partial (`group-detail.test.ts` mocks comment add) | Emulator | Need multi-user + Firestore. |
| Settlement CRUD (create/edit/delete) | ⚠️ Partial (`settlement-form.test.ts`, `settlement-history-locked.test.ts`) | Emulator | Mock covers UI; add backend validation for audit trail + permissions. |
| Copy expense flows | ✅ `expense-detail.test.ts` (mock) | Mock | UI logic only. |
| Copy expense multi-user realtime | ❌ None | Emulator | Requires watchers to receive cloned expense. |

### site-quality.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Accessibility scan | ⚠️ Not in Playwright suite | Mock (separate) | Decide whether to port axe scan or drop (likely marketing site). |
| SEO meta validation | ❌ None | Mock | Consider new lightweight smoke test or rely on unit snapshot. |

### user-and-access.e2e.test.ts

| Scenario | Current Playwright Coverage | Recommended Mode | Notes |
|----------|----------------------------|------------------|-------|
| Profile & password management | ⚠️ Partial (`settings-functionality.test.ts`) | Emulator | Need server confirmation (password, profile writes). |
| Simple new user registration | ✅ `register-authentication.test.ts` (mock) | Emulator (smoke) | Mock handles happy path; add emulator run to ensure real auth/register works. |
| Comprehensive registration flow | ✅ `register-form-validation.test.ts` (mock) | Mock | UI validation only. |
| Policy page navigation | ✅ `policy-acceptance-modal.test.ts` (mock) | Mock | Static content; emulator not needed. |
| Require policy acceptance | ✅ `policy-acceptance-modal.test.ts` (mock) | Emulator (spot-check) | Real auth should enforce policies once. |
| Sequential policy updates | ❌ None | Emulator | Involves multi-version acceptance; backend enforcement. |
| Policy modal structure | ✅ `policy-acceptance-modal.test.ts` (mock) | Mock | UI only. |
| Already-member message on join link | ⚠️ Partial (`join-group.test.ts`) | Emulator | Need real membership state. |
| Redirect non-logged-in user via join | ⚠️ Partial (`join-group.test.ts`) | Emulator | UI mocked; backend lookup required. |
| Register + join via share link | ❌ None | Emulator | Multi-step w/ backend share token. |
| Login + join via share link | ⚠️ Partial (`join-group.test.ts`) | Emulator | Same as above. |
| Handle invalid share links | ✅ `join-group.test.ts` (mock) | Mock | Static error states fine with mocks. |
| Handle malformed share links | ✅ `join-group.test.ts` (mock) | Mock | Same. |
| Regenerate share link + QR update | ⚠️ Partial (`group-detail` + `mockGenerateShareLinkApi`) | Emulator | Need to ensure backend issues new token + invalidates old. |

---

## Emulator Decision Tree (Draft)

| Question | Yes → | No → |
|----------|-------|------|
| Does the scenario depend on Firebase security rules, Cloud Functions, or server-side validation? | Run in emulator mode. | Continue. |
| Does it require multi-client realtime propagation (listeners reacting to writes)? | Emulator. | Continue. |
| Does it mutate durable data where UI mocks could diverge (balances, settlements, share links)? | Emulator (at least one smoke test). | Continue. |
| Is it purely client-side UI/validation/formatting logic? | Mock mode sufficient. | |
| Is the behaviour already unit-tested elsewhere? | Prefer mock; add emulator coverage only if there’s historical regressions. | |

Annotation idea: `test.use({ backendMode: 'emulator' })` or `test.describe.configure({ mode: 'emulator' })` plus tag `@emulator`.

---

## Identified Gaps & Next Data Needed

- Multi-user auth utilities: confirm availability of user pool endpoints outside e2e package and document constraints (rate limits, parallel sessions).
- Accessibility/SEO decision: clarify ownership (marketing vs app team) before migrating or dropping those tests.

---

## Next Suggested Actions

1. Validate mapping with another engineer (sanity check before implementation).
2. Spike on emulator auth workflow reuse (lift `AuthenticationWorkflow` + user pool into shared helper).
3. Draft tagging API (`withBackend('emulator')`) and confirm Playwright config changes needed.

## Plan

### Phase 0: Analysis & Proof of Concept

#### Step 1: Catalogue & Gap Analysis (3-5 days)

Map every existing e2e scenario to an equivalent (or missing) Playwright spec. Identify behaviors that rely on real persistence, multi-user flows, or backend enforcement.

**Deliverables:**
- [ ] Spreadsheet mapping each e2e test → Playwright spec (or "missing")
- [ ] Classification for each test: `mock-only`, `emulator-required`, or `obsolete`
- [ ] Decision tree document: "When to use emulator mode"
- [ ] POC: 3 emulator-mode tests demonstrating isolation strategy

**Decision Tree Criteria (Emulator Mode Required If):**
- ✅ Multi-client real-time synchronization (Firestore listeners)
- ✅ Security rules enforcement
- ✅ Server-side triggers/Cloud Functions interaction
- ✅ Complex transaction behavior
- ❌ UI-only validation
- ❌ Error handling (can mock failures)
- ❌ Form validation (client-side logic)

**Real-Time Testing Strategy:**
- All tests in `realtime-*.e2e.test.ts` → emulator mode (MSW cannot faithfully mock Firestore listeners)
- Single-client real-time updates → can use mock mode with synthetic events

**Exit Criteria:**
- [ ] All e2e tests categorized with rationale
- [ ] ≥2 team members reviewed and approved mapping
- [ ] POC demonstrates test isolation works (see Step 2a)

### Phase 1: Infrastructure

#### Step 2: Dual-Mode Backend Fixture (1 week)

Refactor the current Playwright harness to expose a unified backend fixture able to switch between mock shim and real emulator connection.

**Deliverables:**
- [ ] `backendMode` option registered via `test.use({ backendMode: 'mock' \| 'emulator' })`
- [ ] `firebaseHarness` fixture that exposes a consistent surface in both modes:
  - `auth`: helpers for sign-in/out, token refresh
  - `data`: helpers for seeding Firestore/REST data
  - `cleanup`: per-test teardown hook
- [ ] MSW automatically suspended whenever `backendMode === 'emulator'`
- [ ] Guard rails that throw if a test mixes mock-specific helpers (e.g. `mockFirebase`) while in emulator mode

**Design Outline:**
- Create `webapp-v2/src/__tests__/utils/backend-fixture.ts` that extends the existing `console-logging` base:
  - Register `backendMode` as an option (default `'mock'`); allow override via `test` metadata and CLI env (`BACKEND_MODE`).
  - Expose `firebaseHarness` fixture; in mock mode it wraps the current `MockFirebase` utilities, in emulator mode it forwards to a new `EmulatorHarness`.
  - Ensure the existing `mockFirebase` and `authenticatedPage` fixtures delegate to `firebaseHarness` internally so tests remain backwards-compatible.
- Implement `EmulatorHarness` using pieces from `e2e-tests`:
  - Reuse `AuthenticationWorkflow` (ported to shared helper) for UI-driven login, plus `ApiDriver` for direct setup.
  - Provide per-test user provisioning via the remote pool (`borrowTestUsers`) and accept policies through `ApiDriver`.
  - Offer data helpers that write through REST endpoints or Firestore SDK (e.g. `seedGroup`, `seedExpense`, `waitForBalance`).
- Modify `console-logging-fixture`:
  - Skip MSW controller setup when `backendMode === 'emulator'`; emit warning if a test attempts to register MSW handlers in that mode.
  - Ensure log/screenshot handling remains intact in both modes.
- Add a `withBackend('emulator', callback)` helper for ergonomic opt-in; under the hood it calls `test.skip` when the ambient mode doesn’t match.

**Integration Notes:**
- Update Playwright config to read `PLAYWRIGHT_BACKEND_MODE` and set project-level `use.backendMode`.
- Provide sample spec (`backend-mode.smoke.test.ts`) that demonstrates both mock and emulator usage to prevent regressions.

**Shared Auth/Data Utilities Needed**
- **AuthenticationWorkflow** (currently `e2e-tests/src/workflows/authentication.workflow.ts`) → move to `@splitifyd/test-support/playwright` and make it UI-agnostic.
- **User pool helpers**: `UserPool`, `ApiDriver`, and `borrowTestUsers` already live in `@splitifyd/test-support`; ensure Playwright global setup defines `__registerTestUsers` mirroring `firebase/functions/vitest.setup.ts`.
- **Page objects**: identify which E2E page classes (e.g., `DashboardPage`, `ExpenseFormPage`, `PolicyAcceptanceModalPage`) should be promoted to shared package or re-implemented locally. Minimally, need `DashboardPage` for login assertions in emulator mode.
- **API seeding utilities**: expose thin wrappers around `ApiDriver` for common operations (`acceptPolicies`, `createGroup`, `createExpense`, `settleBalance`) so emulator-mode tests can seed data without verbose plumbing.
- **Async polling helpers**: reuse `PollOptions` / `pollUntil` from `test-support` to wait for backend state changes.

**Outstanding Gaps**
- Playwright environment currently lacks a global hook to auto-return borrowed users; add a teardown hook in `global-setup.ts` (or per-test fixture) to call `ApiDriver.returnTestUser`.
- Need consistent configuration source for emulator host/ports (`getFirebaseEmulatorConfig`) so both ApiDriver and frontend share values; ensure Playwright tests read from same module without bundler issues.
- Determine how to surface emulator authentication tokens to the browser—options: reuse UI login via `AuthenticationWorkflow` or inject ID tokens via localStorage; decision pending spike.

**Exit Criteria:**
- [ ] Both modes work in sample test
- [ ] Clear error message if modes mixed
- [ ] Documentation: architecture decision record

#### Step 2a: Emulator Isolation Strategy (3 days)

Define how tests run concurrently without colliding.

**Selected Strategy:** Database Namespacing
- Each test gets unique group ID prefix: `test-${workerId}-${testId}-`
- No shared data between tests
- Emulator reset only between workers, not between tests

**Alternative Considered:** Sequential execution (rejected: too slow)

**Implementation:**
- [ ] `getTestPrefix(workerInfo)` utility
- [ ] Enforce prefix in all emulator-mode data creation
- [ ] Emulator cleanup script: `npm run test:emulator:reset`

**Exit Criteria:**
- [ ] 10 emulator tests run in parallel without collision
- [ ] Documented in `docs/guides/testing.md`

#### Step 3: Mode Selection & Tagging (2 days)

Provide API for tests to declare mode requirements.

**Selected Approach:** Playwright Projects
```typescript
// playwright.config.ts
export default {
  projects: [
    {
      name: 'chromium-mock',
      use: { backendMode: 'mock' },
    },
    {
      name: 'chromium-emulator',
      use: { backendMode: 'emulator' },
      testMatch: /.*\.emulator\.test\.ts/,
    },
  ],
};
```

**Naming Convention:**
- `foo.test.ts` → runs in mock mode only
- `foo.emulator.test.ts` → runs in emulator mode only
- Dual-mode tests not supported (pick one mode based on most critical assertion)

**Exit Criteria:**
- [ ] Both projects run independently
- [ ] `BACKEND_MODE=emulator npm test` runs only emulator tests
- [ ] `npm test` runs both sequentially

#### Step 4: Data & Auth Utilities (2 weeks)

Port user-pool client, authentication workflow, and helpers from e2e package into shared test support.

**This is the most complex step.** Break down into substeps:

##### Step 4a: User Pool & Basic Auth (5 days)
- [ ] Port `e2e-tests/src/support/user-pool.ts` → `webapp-v2/playwright/support/`
- [ ] Implement `createTestUser()`, `deleteTestUser()`, `loginTestUser()`
- [ ] Handle email verification simulation
- [ ] Token refresh logic

##### Step 4b: Policy Acceptance (3 days)
- [ ] Port policy acceptance workflows
- [ ] Support multiple policy versions
- [ ] Helper: `acceptAllPolicies(page, user)`

##### Step 4c: Data Seeding (4 days)
- [ ] Port group creation helpers
- [ ] Port expense creation helpers
- [ ] Port member management helpers
- [ ] Ensure all helpers use `getTestPrefix()` in emulator mode

##### Step 4d: Validation Utilities (2 days)
- [ ] Port assertion helpers (balance checks, etc.)
- [ ] Firestore query utilities for verification
- [ ] Screenshot/trace helpers

**Exit Criteria:**
- [ ] All e2e helper functions available in `webapp-v2/playwright/support/`
- [ ] 100% TypeScript, no copy-paste without cleanup
- [ ] Documentation: `docs/guides/testing.md` updated with API reference
- [ ] 5 emulator tests written using new utilities

### Phase 2: Migration

#### Step 5: Test Refactors (2-4 weeks)

Update existing Playwright specs to use dual-mode fixture. Migrate backend-sensitive cases to emulator mode.

**Approach:**
- Migrate in priority order (not alphabetically):
  1. Real-time tests → emulator mode (highest risk)
  2. Settlement/balance tests → emulator mode (complex logic)
  3. Auth flows → emulator mode (security rules)
  4. UI-only tests → verify already in mock mode
  5. Gap-fill: scenarios in e2e but missing in Playwright

**During Migration (Transition Period):**
- Both e2e and Playwright suites run in CI
- New features: add Playwright test only (not e2e)
- Bug fixes: update Playwright test only (not e2e)
- Document this workflow in `CONTRIBUTING.md`

**Migration Checklist per Test:**
- [ ] Test migrated to appropriate mode (mock vs emulator)
- [ ] Uses new backend fixture
- [ ] Uses ported auth/data utilities
- [ ] Passes locally 10 times (check for flakiness)
- [ ] Corresponding e2e test marked for deletion

**Exit Criteria:**
- [ ] All e2e scenarios migrated or declared obsolete
- [ ] New Playwright suite passes 20 consecutive CI runs
- [ ] Flake rate <2%
- [ ] Runtime within target (mock <5min, emulator <10min)

#### Step 5.5: Developer Migration Guide (1 day)

Document workflow during transition period.

**Guide Contents:**
- Which suite to update when (Playwright, not e2e)
- How to run tests locally (mock vs emulator)
- How to debug emulator test failures
- Decision tree: which mode for new tests
- Troubleshooting common issues

**Exit Criteria:**
- [ ] Guide reviewed by ≥2 team members
- [ ] Added to `docs/guides/testing.md`

### Phase 3: Validation & Cleanup

#### Step 6: Execution Pipeline (3 days)

Extend local scripts/CI to run Playwright in both modes.

**Local Scripts:**
```bash
npm run test:playwright           # Both modes sequentially
npm run test:playwright:mock      # Fast feedback loop
npm run test:playwright:emulator  # Slower, comprehensive
```

**CI Strategy:**
- Fail fast: Run mock suite first (parallel)
- If mock passes: Run emulator suite (parallel)
- Cache emulator state between runs (if applicable)

**CI Configuration:**
```yaml
# .github/workflows/test.yml
- name: Playwright (Mock Mode)
  run: npm run test:playwright:mock
- name: Playwright (Emulator Mode)
  run: npm run test:playwright:emulator
  if: success()
```

**Exit Criteria:**
- [ ] Scripts work locally
- [ ] CI configuration updated and tested
- [ ] Total CI time ≤ current baseline + 5 minutes
- [ ] Documentation: `docs/guides/testing.md` updated

#### Step 7: Deprecate e2e Suite (1-2 weeks)

After validating coverage parity and stability, remove legacy e2e-tests suite.

**Pre-Deletion Validation:**
- [ ] Run both suites in parallel for 2 weeks minimum
- [ ] Zero regressions detected by Playwright suite
- [ ] Team confirms no workflow blockers

**Deletion Checklist:**
- [ ] Remove `e2e-tests/` directory
- [ ] Remove e2e scripts from `package.json`
- [ ] Update `docs/guides/testing.md` (remove e2e references)
- [ ] Update `CLAUDE.md` and `README.md`
- [ ] Update CI configuration (remove e2e jobs)
- [ ] Archive final e2e test results for reference

**Migration Audit:**
- [ ] All utilities ported (grep for imports from `e2e-tests/`)
- [ ] No broken references in code
- [ ] No broken references in docs

**Exit Criteria:**
- [ ] `e2e-tests/` deleted
- [ ] CI passes without e2e suite
- [ ] Docs updated
- [ ] Post-deletion retrospective completed

## Mock Maintenance Strategy

**Challenge:** Mocks can drift from real Firebase behavior.

**Mitigation:**
1. **Quarterly Sync Checks**: Review Firebase release notes and update MSW handlers
2. **Emulator Cross-Check**: Periodically run mock tests against emulator to detect drift
3. **Ownership**: Assign mock maintenance to same person who updates Firebase configs
4. **Documentation**: Maintain `webapp-v2/playwright/mocks/README.md` explaining handler design

## Documentation Deliverables

- [ ] **Architecture Decision Record**: `docs/adr/playwright-dual-mode.md` (why dual-mode, tradeoffs)
- [ ] **Testing Guide**: `docs/guides/testing.md` updated (local workflow, debugging, decision tree)
- [ ] **CI/CD Documentation**: `docs/ci-cd.md` updated (pipeline stages, runtimes)
- [ ] **Troubleshooting Guide**: `docs/guides/testing-troubleshooting.md` (common failures, solutions)
- [ ] **Migration Log**: `tasks/consolidate-playwright-testing-log.md` (decisions made during execution)

## Decision Log Template

As work progresses, document key decisions:

```markdown
### [Date] - Decision: [Topic]
**Context**: [Why this decision was needed]
**Options Considered**: [A, B, C]
**Decision**: [Chosen option]
**Rationale**: [Why]
**Consequences**: [Tradeoffs accepted]
```
