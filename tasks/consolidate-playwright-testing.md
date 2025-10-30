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

## Success Metrics

### Baseline (Capture Before Starting)
- [ ] Current e2e suite runtime: `______` seconds
- [ ] Current e2e flake rate: `______`%
- [ ] Number of e2e scenarios: `______`
- [ ] Playwright suite runtime: `______` seconds
- [ ] Playwright scenario count: `______`

### Target (Measure at Completion)
- [ ] Scenario coverage: ≥95% of e2e scenarios migrated or declared obsolete
- [ ] Mock suite runtime: <300 seconds (5 minutes)
- [ ] Emulator suite runtime: <600 seconds (10 minutes)
- [ ] Combined flake rate: <2%
- [ ] Developer satisfaction: no complaints about workflow confusion for 2 weeks

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
- [ ] `createBackendFixture({ mode: 'mock' | 'emulator' })` API
- [ ] MSW disabled automatically in emulator mode
- [ ] Firebase SDK initialization per mode
- [ ] Error if test tries to mix modes

**Architecture:**
```typescript
// playwright/fixtures/backend.ts
export const backend = base.extend({
  backendMode: ['mock', { option: true }],
  backend: async ({ backendMode, page }, use) => {
    if (backendMode === 'emulator') {
      // Connect to real emulator, no MSW
      const firebase = initializeEmulatorFirebase();
      await use(firebase);
    } else {
      // Setup MSW handlers
      await setupMSW(page);
      await use(mockBackend);
    }
  }
});
```

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
