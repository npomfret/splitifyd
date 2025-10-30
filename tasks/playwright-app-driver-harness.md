## Strategic Context

**This plan should be executed BEFORE the main test consolidation effort** (see `tasks/consolidate-playwright-testing.md`).

### Why AppDriver First?
1. **Natural test flow**: Tests setup data via real API calls instead of manually seeding Firestore or maintaining brittle MSW mocks
2. **Realtime support**: AppDriver's in-memory Firestore can handle multi-client realtime synchronization (validated capability)
3. **Easier dual-mode transition**: Once tests use AppDriver, swapping to emulator becomes trivial (same test code, different backend)
4. **Simplifies e2e migration**: When migrating legacy e2e tests to Playwright, they can immediately use AppDriver instead of rewriting for MSW

### The Path Forward
- **Step 1** (this plan, 5-8 weeks): Migrate Playwright from MSW → AppDriver backend
- **Step 2** (consolidation, simplified): Migrate e2e tests to Playwright (already using real APIs)
- **Step 3** (future): Enable emulator mode for critical validation scenarios (auth, security rules)

## Motivation
- Reduce reliance on brittle MSW mocks by exercising the actual Firebase handler stack in Playwright.
- Reuse the existing `AppDriver` in-memory backend to get realistic business logic without paying emulator startup/runtime costs.
- Provide a middle-ground backend mode that keeps tests fast while boosting confidence ahead of full emulator migration.

## Desired Outcome
- Playwright suite can run in three modes: `mock`, `app-driver`, and (later) `emulator`.
- Majority of specs execute against the `AppDriver` harness, using real request handlers for data setup and assertions.
- Only realtime/security-rule critical flows still need the emulator once it’s available.

## Open Questions

### Critical Blockers (Must Resolve in Phase 0)

1. **Auth Bridging Strategy** (HIGHEST PRIORITY)
   - How do mock auth tokens → AppDriver user context?
   - What user info does AppDriver need? (UID, email, displayName, custom claims?)
   - How is it extracted from requests? (Cookie, Authorization header, query param?)
   - Which tests absolutely require real auth vs. mock auth?

2. **Security Rules Enforcement**
   - Does AppDriver enforce Firestore security rules?
   - If no: All rule-critical tests must use emulator mode
   - If yes: How are rules loaded/validated during tests?

3. **Cloud Functions & Triggers**
   - Can AppDriver handle Cloud Functions triggers (onCreate, onUpdate, etc.)?
   - Which tests rely on server-side triggers?
   - Do we need emulator mode for trigger-dependent tests?

4. **Performance Baseline**
   - AppDriver startup/teardown time vs. MSW
   - Request latency: AppDriver vs. MSW vs. emulator
   - Will this actually speed up the suite or add overhead?

### Design Questions

- Does the in-memory Firestore stub in `AppDriver` cover all scenarios we currently mock (especially realtime fan-out hooks)? **[VALIDATED: Yes, realtime is supported]**
- How do we surface handler-side errors back through Playwright in a developer-friendly way?
- What's the best way to share API route → handler wiring so it stays maintainable as endpoints evolve?

## Auth Strategy Options

**Challenge**: AppDriver bypasses Firebase Authentication. Tests need to establish user context without requiring full auth implementation.

### Option A: Mock Auth Frontend + Stub User Context

```typescript
// Browser: mock Firebase returns fake token
await mockFirebaseAuth.signIn(testUser)
// → page has auth cookie/token

// AppDriver: extract UID from request, use as context
appDriverGateway.handleRequest(req)
  → authenticatedUserId = extractUidFromMockToken(req)
  → handlers run as that user
```

**Pros:**
- Keeps frontend auth flows intact (login UI, redirects, session management)
- Minimal changes to existing Playwright tests
- Fast (no real auth roundtrip)

**Cons:**
- Mock tokens might not match real Firebase claims structure
- Auth logic itself is not validated (login/register handlers untested)
- Potential drift between mock and real auth

**Use Cases:**
- Most tests that just need to be "signed in" (expense CRUD, group management, etc.)

---

### Option B: Add Lightweight Auth to AppDriver

```typescript
// AppDriver exposes real auth endpoints
const token = await appDriver.auth.signInWithEmailAndPassword(email, password)
// → returns real JWT signed by AppDriver

// Playwright: real login flow
await page.fill('[name=email]', testUser.email)
await page.fill('[name=password]', testUser.password)
await page.click('button[type=submit]')
// → backend validates credentials, issues token
```

**Pros:**
- Most realistic: tests actual auth flow end-to-end
- Validates login/register handlers
- Token structure matches real Firebase (if implemented correctly)

**Cons:**
- Significant implementation effort (2-3 weeks to build auth subsystem)
- May slow down tests (password hashing, token generation)
- Still not 100% Firebase-identical (edge cases may differ)

**Use Cases:**
- Auth-critical flows (login, register, password reset)
- Tests validating auth error handling

---

### Option C: Hybrid Approach (RECOMMENDED)

```typescript
// MOST TESTS: Mock auth (fast, minimal setup)
test('create expense', async ({ page, appDriverBackend }) => {
  await mockSignIn(page, testUser) // Fast stub auth
  // ... test expense logic using real AppDriver APIs
})

// AUTH-CRITICAL TESTS: Real emulator
test('password reset flow', async ({ page, emulatorBackend }) => {
  // ... test against real Firebase Auth + emulator
})
```

**Pros:**
- Pragmatic: best of both worlds
- Unblocks 90% of tests immediately (mock auth)
- Auth-critical tests get full validation (emulator)
- Incremental: can add Option B later if needed

**Cons:**
- Two auth approaches to maintain
- Need clear guidelines for which mode to use

**Recommended Decision Tree:**

| Test Type | Auth Mode | Backend Mode |
|-----------|-----------|--------------|
| Expense CRUD, group management, UI flows | Mock auth | AppDriver |
| Login, register, password reset | Real auth | Emulator |
| Policy acceptance enforcement | Real auth | Emulator |
| Security rules validation | Real auth | Emulator |

---

### Recommendation: **Option C (Hybrid)**

**Phase 0 Validation:**
1. Prototype mock auth → AppDriver user context extraction
2. Identify exact list of auth-critical tests (estimate: 5-10 tests)
3. Confirm emulator will handle those tests (already in consolidation plan)
4. Document auth bridging implementation in Phase 1

**Implementation Priority:**
- Phase 1: Mock auth bridge (unblocks 90% of tests)
- Phase 3: Emulator mode for auth-critical tests
- Future: Optionally add Option B if emulator proves too slow

## Timeline & Effort Summary

| Phase | Duration | Focus | Critical Path? |
|-------|----------|-------|----------------|
| Phase 0: Discovery & Auth Strategy | 3-5 days | Resolve auth bridging, validate AppDriver capabilities | Yes |
| Phase 1: Harness Implementation | 1-2 weeks | Build AppDriverGateway, Playwright fixture, auth bridge, helpers | Yes |
| Phase 2: Test Migration | 2-3 weeks | Migrate 60-80% of specs from MSW to AppDriver | Yes |
| Phase 3: Dual-Mode Foundation | 1 week | Add emulator mode, finalize decision tree, CI integration | Yes |

**Total: 5-8 weeks** (assumes 1 developer full-time)

**Key Dependencies:**
- Phase 0 must complete before Phase 1 (auth strategy blocks implementation)
- Phase 1 must complete before Phase 2 (harness required for migration)
- Phase 2 can partially overlap with Phase 3 (emulator work can start once core migration is stable)

**Comparison to Original Estimate:**
- Original: 4-6 weeks
- Updated: 5-8 weeks
- Reason: Auth strategy added significant complexity (2-3 days in Phase 0, 2-3 days in Phase 1)

## Incremental Plan

### Phase 0 — Discovery & Auth Strategy (3-5 days)

**PRIMARY FOCUS: Resolve all "Critical Blockers" from Open Questions section**

#### Step 0.1: Endpoint & Capability Audit (1 day)
1. Catalogue all REST/GraphQL endpoints Playwright hits today (extract from `mock-firebase-service.ts` + MSW handlers)
2. Audit `AppDriver` capabilities:
   - Which endpoints are already implemented?
   - Does it support realtime listeners? ✅ **VALIDATED**
   - Does it enforce Firestore security rules? **TO BE CONFIRMED**
   - Can it handle Cloud Functions triggers? **TO BE CONFIRMED**
3. Document any missing handler coverage or side effects

**Deliverable:**
- [ ] Endpoint + capability matrix spreadsheet
- [ ] List of AppDriver limitations requiring emulator fallback

#### Step 0.2: Auth Bridging Prototype (2 days)
1. **CRITICAL**: Implement proof-of-concept for Option C (Hybrid Auth):
   - Mock auth in browser → extract UID → pass to AppDriver
   - Verify handlers receive correct user context
   - Test one full flow: mock login → create group → verify data
2. Document auth token format and extraction mechanism
3. Identify all auth-critical tests requiring emulator mode (estimate: 5-10 tests)

**Deliverable:**
- [ ] Working POC: mock auth → AppDriver request → response with correct user context
- [ ] Auth bridging implementation guide
- [ ] List of tests requiring real auth (emulator mode)

#### Step 0.3: Adapter Design (1 day)
1. Request routing strategy:
   - Playwright `page.route()` interception vs. MSW
   - How to disable MSW for API routes while keeping it for assets
2. Error propagation design:
   - Handler errors → Playwright logs with stack traces
   - Validation errors → proper HTTP status codes
3. Performance baseline:
   - Measure AppDriver startup/teardown time
   - Compare request latency: AppDriver vs. MSW

**Deliverable:**
- [ ] Technical design document (architecture, data flow, error handling)
- [ ] Performance comparison table

#### Step 0.4: Stakeholder Alignment (0.5 days)
1. Review findings with team
2. Confirm commitment to hybrid auth approach
3. Get approval to proceed with Phase 1

**Deliverable:**
- [ ] Design review meeting notes
- [ ] Go/no-go decision

**Exit Criteria:**
- [ ] All "Critical Blockers" answered
- [ ] Auth bridging POC works end-to-end
- [ ] AppDriver capability gaps documented
- [ ] Performance baseline captured
- [ ] Team approval to proceed

### Phase 1 — Harness Implementation (1-2 weeks)

#### Step 1.1: Backend Gateway (3 days)
1. **AppDriverGateway Module**
   - Extract `AppDriverGateway` class exposing `handleRequest(method, path, body, query, userId)` → `{ status, body, headers }`
   - Wrap `AppDriver` instantiation, startup, and teardown
   - Implement proper error handling: convert handler exceptions → HTTP error responses
   - Add logging: request/response details visible in Playwright output

2. **Request Router**
   - Map HTTP paths → AppDriver handler methods
   - Support REST endpoints (`/api/groups`, `/api/expenses`, etc.)
   - Handle query params, request bodies, headers

**Deliverable:**
- [ ] `AppDriverGateway` class with unit tests
- [ ] Request router with endpoint mapping
- [ ] Error handling verified (try invalid requests, expect proper 4xx/5xx responses)

#### Step 1.2: Playwright Fixture Integration (3 days)
1. **Backend Mode Fixture**
   - Extend existing fixture to support `backend: 'app-driver'` option
   - Implement Playwright `page.route()` interception for API calls
   - Forward intercepted requests to `AppDriverGateway`
   - Return serialized responses to browser

2. **MSW Coordination**
   - Disable MSW handlers for API routes in app-driver mode
   - Keep MSW active for static assets (images, fonts, etc.)
   - Ensure no conflicts between MSW and AppDriver

**Deliverable:**
- [ ] Playwright fixture supports `backend: 'app-driver'`
- [ ] Request interception working (verify with network logs)
- [ ] MSW properly disabled for API routes

#### Step 1.3: Auth Bridge Implementation (2-3 days) **CRITICAL**
1. **Mock Auth Integration**
   - Extract UID from mock Firebase auth token/cookie
   - Pass `userId` to `AppDriverGateway.handleRequest()`
   - Ensure handlers receive correct user context (test with `console.log(userId)` in handler)

2. **User Seeding Helpers**
   - `seedTestUser(userData)` → creates user in AppDriver
   - `mockSignIn(page, testUser)` → authenticates browser session
   - Verify user context flows through entire request chain

3. **Validation**
   - Test: create expense as User A → verify `createdBy` field = User A's UID
   - Test: User B cannot delete User A's expense (authorization check)

**Deliverable:**
- [ ] Auth bridge working: mock token → UID → handler context
- [ ] User seeding helpers implemented
- [ ] Authorization validation test passing

#### Step 1.4: Data Seeding Helpers (2 days)
1. **API-Driven Setup**
   - `seedGroup(page, { name, members })` → creates group via AppDriver API
   - `seedExpense(page, { groupId, amount, description })` → creates expense
   - `seedSettlement(page, { groupId, from, to, amount })` → creates settlement
   - All helpers use real API calls (not direct database manipulation)

2. **Assertion Helpers**
   - `verifyBalance(page, groupId, userId)` → queries AppDriver for balance
   - `verifyGroupMembers(page, groupId)` → checks membership

**Deliverable:**
- [ ] Suite of data seeding helpers
- [ ] All helpers documented with examples
- [ ] Tests use helpers instead of direct DB seeding

**Exit Criteria:**
- [ ] Smoke spec passes: `mockSignIn()` → `seedGroup()` → `seedExpense()` → verify UI shows expense
- [ ] Handler errors propagate to Playwright logs with stack traces
- [ ] Auth context flows correctly (user A's actions attributed to user A)
- [ ] Tests remain headless-friendly and deterministic
- [ ] Performance: test suite runtime ≤ MSW baseline + 20%

### Phase 2 — Test Migration (2-3 weeks)

**Migration Strategy: Prioritize by Risk & Value**

#### Priority 1: Low-Risk Core Flows (Week 1)
**Target: 40% of specs migrated**

1. **Dashboard Tests** (`dashboard-*.test.ts`)
   - Update fixture: `backend: 'app-driver'`
   - Replace MSW mocks with `seedGroup()` calls
   - Verify group display, navigation, empty states

2. **Expense CRUD** (`expense-form.test.ts`, `expense-detail.test.ts`)
   - Use `seedExpense()` for setup
   - Test create, edit, delete flows
   - Verify API responses match UI updates

3. **Group Management** (`group-detail.test.ts`, `group-display-name-settings.test.ts`)
   - Test group creation, editing, member display
   - Remove MSW stubs for group endpoints

**Deliverable:**
- [ ] 40% of specs using AppDriver backend
- [ ] MSW handlers removed for migrated endpoints
- [ ] No regression in migrated tests (run 10x locally, pass rate >95%)

#### Priority 2: Complex Business Logic (Week 2)
**Target: 60% of specs migrated**

1. **Balance & Settlement Tests** (`settlement-*.test.ts`, balance-related tests)
   - High value: validates critical business logic
   - Use AppDriver's real balance calculation
   - Test multi-expense scenarios, settlement creation

2. **Realtime Updates** (if AppDriver supports listeners)
   - Multi-user comment feeds
   - Live expense updates
   - Group membership changes

3. **Form Validation** (UI + server-side)
   - Test both client and server validation
   - Verify error messages match expectations

**Deliverable:**
- [ ] 60% of specs using AppDriver
- [ ] Complex business logic validated against real handlers
- [ ] Flake rate <2% for migrated specs

#### Priority 3: Edge Cases & Auth-Boundary Tests (Week 3)
**Target: 80% of specs migrated, remaining 20% flagged for emulator**

1. **Edge Cases**
   - Empty states, error conditions
   - Permission boundaries (non-owner actions)
   - Data validation edge cases

2. **Identify Emulator-Required Tests**
   - Auth flows (login, register, password reset) → defer to emulator
   - Security rules enforcement (if AppDriver doesn't support)
   - Cloud Functions triggers (if AppDriver doesn't support)

3. **Documentation**
   - Document migration patterns
   - Create troubleshooting guide
   - Update test writing guidelines

**Deliverable:**
- [ ] ≥80% of specs using AppDriver
- [ ] 20% flagged for emulator mode with rationale
- [ ] Migration guide published in `docs/guides/testing.md`

**Exit Criteria:**
- [ ] ≥60% of Playwright specs run green in `app-driver` mode
- [ ] Removed MSW handlers for endpoints now handled by gateway (audit with grep)
- [ ] No dangling imports to removed MSW handlers
- [ ] Runtime: AppDriver suite ≤ MSW baseline + 30%
- [ ] Flake rate: <2% for migrated specs
- [ ] Documented migration checklist for remaining specs

### Phase 3 — Dual-Mode Foundation & CI Integration (1 week)

**Goal: Lay groundwork for running same tests against both AppDriver and emulator**

#### Step 3.1: Emulator Mode Fixture (2 days)
1. Extend backend fixture to support `backend: 'emulator'`
   - Connect to Firebase emulators (Firestore, Auth)
   - Disable both MSW and AppDriver
   - Use real Firebase SDK calls

2. **Proof of Concept: Dual-Mode Test**
   - Pick 3 representative tests (expense CRUD, group management, realtime)
   - Verify they pass with both `backend: 'app-driver'` and `backend: 'emulator'`
   - Document any differences in behavior or setup

**Deliverable:**
- [ ] Emulator backend fixture working
- [ ] 3 tests validated in both modes
- [ ] Gap analysis: where AppDriver vs emulator behave differently

#### Step 3.2: Backend Mode Decision Tree (1 day)
Finalize and document when to use each mode:

| Test Category | Backend Mode | Auth Mode | Rationale |
|--------------|--------------|-----------|-----------|
| **Expense CRUD, Group Management** | AppDriver | Mock | Fast, validates business logic |
| **Balance & Settlement Calculation** | AppDriver | Mock | Real calculation logic without emulator overhead |
| **Realtime Updates (single client)** | AppDriver | Mock | AppDriver supports listeners |
| **Realtime Updates (multi-client)** | AppDriver or Emulator | Mock | AppDriver can simulate; emulator for ultimate validation |
| **UI-only (no backend)** | Mock (MSW) | Mock | Pure client-side, no backend needed |
| **Login, Register, Password Reset** | Emulator | Real auth | Requires real Firebase Auth |
| **Policy Acceptance Enforcement** | Emulator | Real auth | Backend enforces policies |
| **Security Rules Validation** | Emulator | Real auth | AppDriver doesn't enforce rules |
| **Cloud Functions Triggers** | Emulator | Real auth | AppDriver doesn't run triggers |
| **Error Simulation (network, timeout)** | Mock (MSW) | Mock | AppDriver too realistic; need artificial failures |

**Guidelines:**
- **Default: AppDriver** for all tests unless they require auth or rules enforcement
- **Emulator: Only when necessary** (5-10% of tests)
- **Dual-mode validation:** Run critical tests in both modes in CI (nightly)

**Deliverable:**
- [ ] Decision tree published in `docs/guides/testing.md`
- [ ] Updated test-writing guidelines with examples

#### Step 3.3: CI/Local Scripts (2 days)
1. **Local Development Scripts**
   ```bash
   npm run test:playwright              # AppDriver mode (default)
   npm run test:playwright:emulator     # Emulator mode (slower)
   npm run test:playwright:all          # Both modes sequentially
   ```

2. **CI Pipeline Strategy**
   - **PR Builds (fast feedback):**
     - Run AppDriver suite only (~5-10 min)
     - Skip emulator tests (too slow for PR loop)

   - **Main Branch (post-merge):**
     - Run AppDriver suite
     - Run emulator suite in parallel (if time permits)

   - **Nightly (comprehensive validation):**
     - Run AppDriver suite
     - Run emulator suite
     - Run dual-mode tests (same test, both backends)
     - Compare results, flag divergences

3. **CI Configuration**
   ```yaml
   # .github/workflows/playwright.yml
   - name: Playwright (AppDriver)
     run: npm run test:playwright
   - name: Playwright (Emulator - Nightly)
     if: github.event_name == 'schedule'
     run: npm run test:playwright:emulator
   ```

**Deliverable:**
- [ ] Local scripts working
- [ ] CI configuration updated and tested
- [ ] CI runtime ≤ current baseline (AppDriver should be fast enough)

#### Step 3.4: Documentation & Handoff (1 day)
1. **Testing Guide Updates**
   - Document AppDriver architecture
   - Explain auth bridging
   - Provide test migration examples
   - Add troubleshooting section

2. **Consolidation Plan Update**
   - Reflect AppDriver as primary backend (not MSW)
   - Update e2e → Playwright migration strategy
   - Adjust timeline (simplified by AppDriver)

**Deliverable:**
- [ ] `docs/guides/testing.md` updated with AppDriver section
- [ ] `tasks/consolidate-playwright-testing.md` updated to reference AppDriver
- [ ] Team training session scheduled

**Exit Criteria:**
- [ ] Decision tree published and reviewed by team
- [ ] CI strategy defined and approved
- [ ] At least 3 tests validated in dual-mode (AppDriver + emulator)
- [ ] Documentation complete
- [ ] Team agreement on long-term maintenance ownership
- [ ] Consolidation plan updated to reflect AppDriver approach

## Impact on Test Consolidation Plan

**This plan fundamentally changes the consolidation approach:**

### Before AppDriver
**Original consolidation plan** (see `tasks/consolidate-playwright-testing.md`):
- Migrate e2e tests → Playwright with MSW mocks
- MSW mocks = brittle, require maintaining parallel handler logic
- Timeline: 6-10 weeks

**Challenges:**
- Every API endpoint needs manual MSW stub
- Mocks drift from real handler behavior
- Hard to validate business logic (mocks skip calculation)
- Realtime flows impossible with MSW

### After AppDriver
**Updated consolidation approach:**
- Migrate e2e tests → Playwright with AppDriver backend
- AppDriver = real handlers, natural API-driven test flow
- Timeline: potentially reduced by 2-3 weeks

**Benefits:**
1. **No MSW stub maintenance**: Tests call real APIs via AppDriver
2. **Real business logic**: Balances, settlements, validations all computed correctly
3. **Natural migration**: e2e tests already use API calls → easy port to AppDriver-backed Playwright
4. **Realtime support**: AppDriver listeners work (no emulator needed for most realtime tests)

### Updated Consolidation Strategy

**Step 1: Complete AppDriver Harness** (this plan, 5-8 weeks)
- Build AppDriverGateway + Playwright fixture
- Migrate existing Playwright tests from MSW → AppDriver
- Establish dual-mode capability (AppDriver + emulator)

**Step 2: Simplified e2e Migration** (4-6 weeks, down from 6-10 weeks)
- Map e2e scenarios to Playwright (gap analysis already started)
- Port tests to Playwright using AppDriver backend
- Tests setup data via API calls (just like e2e tests do today)
- No need to write MSW mocks for new scenarios

**Step 3: Emulator Validation** (1-2 weeks)
- Identify 5-10% of tests needing emulator (auth, rules, triggers)
- Run critical tests in dual-mode (AppDriver + emulator) nightly
- Ensure AppDriver behavior matches Firebase

**Total Timeline with AppDriver Approach: 10-16 weeks**
- AppDriver harness: 5-8 weeks
- e2e migration: 4-6 weeks
- Emulator validation: 1-2 weeks

**vs. Original Pure MSW Approach: 6-10 weeks**
- But: MSW approach leaves brittle mocks, harder to maintain long-term
- AppDriver: higher upfront cost, much better long-term maintainability

### Key Changes to Consolidation Plan

1. **Primary backend: AppDriver** (not MSW)
   - Update Step 4 (Data & Auth Utilities) → use AppDriver helpers instead of MSW stubs
   - Update Step 5 (Test Refactors) → migrate to AppDriver, not MSW

2. **Emulator for ~5-10% of tests** (not 10%)
   - Only auth-critical, rules-critical, trigger-dependent tests
   - Most realtime tests can use AppDriver

3. **Simplified migration checklist**
   - Old: "Port e2e test → write MSW mocks → port to Playwright"
   - New: "Port e2e test → use AppDriver helpers → verify UI"

4. **Decision tree update**
   - See Phase 3 Step 3.2 table (already includes AppDriver mode)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Auth bridging complexity underestimated** | Medium | High | Phase 0 POC validates feasibility before committing to Phase 1; allocate 2-3 days buffer |
| **AppDriver missing critical features** | Low | High | Phase 0 audit confirms coverage; maintain emulator fallback for gaps |
| **Handler mismatch (AppDriver vs. production)** | Medium | Medium | Reuse same handler factories; dual-mode validation in CI nightly |
| **Auth drift (mock vs. real Firebase)** | Medium | Medium | Keep emulator spot-checks for auth-critical flows; document differences |
| **Performance regression** | Low | Medium | Phase 1 exit criteria includes runtime ≤ MSW + 20%; optimize gateway if needed |
| **Scope creep (trying to cover everything)** | Medium | High | Stick to 60-80% target for AppDriver; preserve dual-mode architecture for fallback |
| **Team resistance to longer timeline** | Medium | Low | Emphasize long-term maintainability gains; show MSW pain points |

**Rollback Plan:**
- If auth bridging proves infeasible in Phase 0 → revert to pure MSW approach with emulator for all backend-dependent tests
- If AppDriver performance is worse than MSW by >50% → reevaluate; may need to optimize or fall back to selective AppDriver usage

## Next Steps After Approval
1. ✅ **Completed**: Design documented in this file
2. **Immediate**: Update `tasks/consolidate-playwright-testing.md` to reference AppDriver as primary backend
3. **Start Phase 0**: Begin discovery and auth strategy work (3-5 days)
4. **Checkpoint**: Review Phase 0 findings with team before proceeding to Phase 1
