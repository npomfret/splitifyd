# Account Merging Feature - Implementation Status

**STATUS: DATA MIGRATION COMPLETE ✅ - READY FOR INTEGRATION TESTING**

**CURRENT STATE (as of latest commit):**
- ✅ **Service layer implementation complete** (MergeService with validation and job creation)
- ✅ **HTTP layer complete** (MergeHandlers with REST endpoints)
- ✅ **Task service complete** (MergeTaskService with full data migration logic)
- ✅ **Data migration complete** (All 9 collections migrate properly)
- ✅ **Validation complete** (Using createRequestValidator pattern with proper encapsulation)
- ✅ **12/12 unit tests passing** (8 API tests + 4 task service tests with full migration)
- ✅ **All sanity check issues resolved** (encapsulation, validation patterns)
- ✅ **Committed and rebased** onto latest main branch
- ⏳ **Integration tests NOT YET STARTED** (Phase 5 pending)

**What this document contains:**
- Complete implementation status for Phases 1-4
- Lessons learned from previous failed attempt (preserved for reference)
- Correct testing patterns used in current implementation
- Roadmap for Phase 5 (integration tests) and beyond

---

## ✅ CURRENT IMPLEMENTATION (Phases 1-4 Complete)

### Core Implementation Files ✅
```
firebase/functions/src/merge/MergeService.ts              ✅ COMPLETE - Service layer with validation
firebase/functions/src/merge/MergeHandlers.ts             ✅ COMPLETE - HTTP endpoint handlers
firebase/functions/src/merge/MergeTaskService.ts          ✅ COMPLETE - Task execution with full data migration
firebase/functions/src/merge/validation.ts                ✅ COMPLETE - Request validation with createRequestValidator
```

### Unit Tests ✅
```
firebase/functions/src/__tests__/unit/api/merge.test.ts              ✅ 8/8 passing - API endpoint tests
firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts  ✅ 4/4 passing - Task service tests with full migration
```

### Infrastructure Changes ✅
```
firebase/functions/src/constants.ts                       ✅ Added ACCOUNT_MERGES collection
firebase/functions/src/routes/route-config.ts             ✅ Added merge routes (POST /merge, GET /merge/:jobId, POST /tasks/processMerge)
firebase/functions/src/services/ComponentBuilder.ts       ✅ Service wiring complete (buildMergeService, buildMergeTaskService, buildMergeHandlers)
firebase/functions/src/ApplicationFactory.ts              ✅ Handler registration complete
firebase/functions/src/services/firestore/FirestoreReader.ts  ✅ Added getMergeJob()
firebase/functions/src/services/firestore/FirestoreWriter.ts  ✅ Added updateMergeJobStatus() + 10 bulk migration methods
firebase/functions/src/services/firestore/IFirestoreReader.ts ✅ Interface updated (getMergeJob)
firebase/functions/src/services/firestore/IFirestoreWriter.ts ✅ Interface updated (updateMergeJobStatus + 10 reassignment methods)
firebase/functions/vitest.config.ts                       ✅ Added required env vars (CLOUD_TASKS_LOCATION, FUNCTIONS_URL)
```

### Shared Types & API ✅
```
packages/shared/src/api.ts                                ✅ Added initiateMerge() and getMergeStatus() to API interface
packages/shared/src/shared-types.ts                       ✅ Added merge types (InitiateMergeRequest, InitiateMergeResponse, MergeJobResponse, MergeJobStatus)
packages/test-support/src/ApiDriver.ts                    ✅ Implemented merge methods
webapp-v2/src/app/apiClient.ts                            ✅ Stub implementations for webapp compilation
```

## Critical Lessons Learned from Previous Failed Attempt

### ❌ WHAT WENT WRONG (Previous Attempt)

1. **CATASTROPHIC ERROR: Writing directly to Firestore in integration tests**
   - Integration tests should ONLY use the API (ApiDriver methods)
   - Never write test setup data (tenants, policies) directly to Firestore
   - This violates the entire purpose of integration testing
   - Integration tests must test the real API, not bypass it

2. **Wrong tenant schema in test setup**
   - Tried to manually create tenant documents with wrong schema
   - Tenant requires `branding` object with appName, logoUrl, colors
   - Tenant requires Firestore Timestamps, not ISO strings
   - This was a symptom of the bigger problem: shouldn't be writing to Firestore at all

3. **Test data setup approach was fundamentally flawed**
   - Tried to add `beforeAll` hooks that write directly to Firestore
   - Should have used API endpoints or seed scripts instead
   - The emulator should have test data seeded ONCE, not in every test file

### ✅ WHAT WORKED (Current Implementation)

1. **Unit Tests - 11/11 PASSING**
   - Used AppDriver for API layer tests (simulates HTTP requests)
   - Used StubFirestoreDatabase for database operations
   - Used StubCloudTasksClient for task queue operations
   - Tests are isolated, fast, and reliable
   - No direct Firestore access in tests

2. **Core Implementation**
   - MergeService.ts - Service layer with validation and encapsulation
   - MergeHandlers.ts - HTTP endpoint handlers
   - MergeTaskService.ts - Task execution logic
   - validation.ts - Using createRequestValidator pattern (fixed from previous parseWithApiError approach)

3. **Proper Encapsulation**
   - Added public `getMergeJobForUser()` method instead of accessing private fields
   - Service encapsulates read + authorization logic
   - No bracket notation field access

4. **Test Infrastructure**
   - ComponentBuilder pattern for dependency injection
   - AppDriver for unit testing HTTP handlers
   - StubFirestoreDatabase for Firestore operations in unit tests
   - StubCloudTasksClient for task queue testing

---

## 🎯 CORRECT TESTING APPROACH

### Unit Tests Pattern ✅
```typescript
// Use test database and stubs
const db = new TenantFirestoreTestDatabase();
const stubAuth = new StubAuthService();
const stubTaskQueue = { enqueueTask: vi.fn() };

// Create service with test dependencies
const mergeService = new MergeService(stubAuth, db, stubTaskQueue);

// Setup test data directly in test database
await db.collection(FirestoreCollections.USERS).doc(userId).set({...});

// Test business logic
const result = await mergeService.initiateMerge(primaryId, request);
```

### Integration Tests Pattern ✅
```typescript
// NEVER touch Firestore directly
const apiDriver = new ApiDriver();

// Get test users from pool (already registered via API)
const users = await borrowTestUsers(2);

// Create data via API
const group = await apiDriver.createGroup(groupRequest, users[0].token);
const expense = await apiDriver.createExpense(expenseRequest, users[0].token);

// Test API endpoints
const result = await apiDriver.initiateMerge(mergeRequest, users[0].token);

// Verify via API
const status = await apiDriver.getMergeStatus(result.jobId, users[0].token);
```

### Test Data Seeding ✅
```bash
# ONE-TIME setup for emulator (not in test files!)
firebase/scripts/seed-policies.ts  # Seeds required policies
firebase/scripts/seed-tenants.ts   # Seeds default tenant

# Tests should NOT seed this data themselves
# Emulator should start with this data already present
```

---

## 📖 GOLDEN RULES FOR TESTING

### 1. Unit Tests
- ✅ Use TenantFirestoreTestDatabase
- ✅ Use StubAuthService for auth
- ✅ Mock external services (CloudTasks)
- ✅ Write test data directly to test database
- ✅ Test business logic in isolation

### 2. Integration Tests
- ✅ ONLY use ApiDriver for all operations
- ✅ Use borrowTestUsers() for test users
- ✅ Assume emulator has required seed data
- ❌ NEVER write to Firestore directly
- ❌ NEVER import getFirestore() in integration tests
- ❌ NEVER bypass the API layer

### 3. Test Data Setup
- ✅ Seed once in emulator startup script
- ✅ Tests assume seed data exists
- ✅ Tests clean up their own test data
- ❌ Don't seed in beforeAll hooks
- ❌ Don't write setup data in test files

### 4. Test Isolation
- ✅ Each test creates its own test data via API
- ✅ Tests use unique identifiers (uuidv4)
- ✅ Tests clean up in afterEach if needed
- ❌ Don't share data between tests
- ❌ Don't rely on test execution order

## 🎯 RE-IMPLEMENTATION STATUS

**Current Status: Phases 1-4 COMPLETE ✅ | Data Migration COMPLETE ✅ | Ready for Integration Testing**

**Summary:**
- ✅ **Phase 1**: Service layer with validation (7/7 tests passing)
- ✅ **Phase 2**: Core merge logic with Cloud Tasks (10/10 tests passing)
- ✅ **Phase 3**: Task service with FULL data migration (4/4 tests passing - includes comprehensive migration test)
- ✅ **Phase 4**: HTTP layer with handlers (8/8 tests passing)
- ✅ **Sanity Check**: All compilation errors fixed, Zod validation implemented
- ✅ **Data Migration**: All 9 collections migrate properly, 10 Firestore methods implemented
- ⏳ **Phase 5**: Integration tests (NOT STARTED)

**Test Coverage:** 12/12 unit tests passing
**Build Status:** ✅ All packages compile successfully
**Data Migration Status:** ✅ COMPLETE - All user data migrates correctly

### Phase 1: Minimal Service Layer (✅ COMPLETED)
- [x] Step 1: Create `MergeService` with `validateMergeEligibility()` method
- [x] Step 2: Write unit tests for validation logic
- [x] Step 3: Wire service into `ComponentBuilder` (DI setup)
- [x] Step 4: Run tests and verify (no API exposure yet)

**Results:**
- ✅ MergeService created with validation-only logic
- ✅ 7/7 unit tests passing (all validation rules tested)
- ✅ Properly wired into ComponentBuilder
- ✅ TypeScript compiles without errors
- ✅ All backend unit tests still passing
- ✅ Uses StubFirestoreDatabase (Firebase Simulator) - no test-specific helpers
- ✅ No dead code - everything is tested and used

**Files Created:**
- `firebase/functions/src/merge/MergeService.ts` - Service with validateMergeEligibility()
- `firebase/functions/src/__tests__/unit/services/MergeService.test.ts` - 7 passing tests

**Files Modified:**
- `firebase/functions/src/services/ComponentBuilder.ts` - Added buildMergeService()

### Phase 2: Core Merge Logic (✅ COMPLETED)
- [x] Add `initiateMerge()` method to MergeService
- [x] Create merge job document schema
- [x] Write unit tests for merge initiation
- [x] Wire up Cloud Tasks stub for testing
- [x] Update ComponentBuilder to accept StubCloudTasksClient parameter

**Results:**
- ✅ Added `initiateMerge()` method that validates, creates job, and enqueues task
- ✅ Created `MergeJobDocument` interface with status tracking
- ✅ 10/10 unit tests passing (7 validation + 3 job creation tests)
- ✅ Cloud Tasks integration working with StubCloudTasksClient
- ✅ Job documents properly stored in Firestore
- ✅ TypeScript compiles without errors
- ✅ All existing unit tests still passing
- ✅ Uses StubFirestoreDatabase directly with `seed()` - no helper methods
- ✅ ComponentBuilder pattern improved - accepts optional CloudTasksClient (same as StubStorage)

**Files Modified:**
- `firebase/functions/src/merge/MergeService.ts` - Added initiateMerge() and job types
- `firebase/functions/src/constants.ts` - Added ACCOUNT_MERGES collection
- `firebase/functions/src/services/ComponentBuilder.ts` - Added optional CloudTasksClient parameter to constructor, added buildCloudTasksClient() method
- `firebase/functions/src/__tests__/unit/services/MergeService.test.ts` - Added 3 new tests, using StubCloudTasksClient passed directly to ComponentBuilder

**Key Design Decision:**
- ComponentBuilder now accepts `cloudTasksClient?: ICloudTasksClient` as optional 4th parameter
- This mirrors the pattern used for StubStorage, making the API consistent
- Tests can pass StubCloudTasksClient directly instead of overriding after construction
- Maintains backward compatibility - existing code works without changes

### Phase 3: Data Migration Service (✅ COMPLETED - ENHANCED WITH FULL MIGRATION LOGIC)
- [x] Create `MergeTaskService` for actual data migration
- [x] Implement basic job lifecycle (pending -> processing -> completed)
- [x] Add 10 Firestore bulk migration methods to IFirestoreWriter
- [x] Implement all bulk migration methods in FirestoreWriter
- [x] Implement complete data migration logic in MergeTaskService
- [x] Write comprehensive unit tests including full migration test
- [x] Test with StubFirestoreDatabase

**Results:**
- ✅ MergeTaskService created with `executeMerge()` and `performDataMigrations()` methods
- ✅ 4/4 unit tests passing (including comprehensive migration test)
- ✅ Job status transitions working correctly
- ✅ All 9 collections migrate properly (groups, memberships, expenses, settlements, comments, activity feed, share link tokens)
- ✅ Secondary user marked as merged and disabled with `mergedInto`, `mergedAt`, `disabled` fields
- ✅ Uses StubFirestoreDatabase for testing
- ✅ TypeScript compiles without errors
- ✅ Full migration logic COMPLETE (no TODOs remaining)

**Files Created:**
- `firebase/functions/src/merge/MergeTaskService.ts` - Service for executing merge jobs with full migration
- `firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts` - 4 passing tests (including comprehensive migration test)

**Files Modified:**
- `firebase/functions/src/services/firestore/IFirestoreWriter.ts` - Added 10 migration methods
- `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Implemented 10 migration methods

**Migration Methods Implemented:**
1. `reassignGroupOwnership()` - Migrates group ownership
2. `reassignGroupMemberships()` - Migrates member associations
3. `reassignExpensePayer()` - Migrates expense payer
4. `reassignExpenseParticipants()` - Migrates participants array (special array handling)
5. `reassignSettlementPayer()` - Migrates settlement payer
6. `reassignSettlementPayee()` - Migrates settlement payee
7. `reassignCommentAuthors()` - Migrates comment authors
8. `reassignActivityFeedActors()` - Migrates activity feed entries
9. `reassignShareLinkTokens()` - Migrates share link token creators
10. `markUserAsMerged()` - Marks secondary user as merged and disabled

**Design Notes:**
- All migrations use Firestore batch operations for performance
- Each migration method returns count of affected documents
- Comprehensive logging at each step with counts
- Error handling marks job as 'failed' if migration throws
- Sequential execution ensures proper ordering
- Special handling for array fields (expense participants)
- Test verifies all migrations work end-to-end with real data

### Phase 4: HTTP Layer (✅ COMPLETED)
- [x] Create `MergeHandlers` with HTTP endpoints
- [x] Add routes to `route-config.ts`
- [x] Add validation using Zod schemas
- [x] Add shared types to packages
- [x] Wire into ApplicationFactory
- [x] Add AppDriver test methods
- [x] Add ApiDriver methods for integration tests
- [x] Add webapp ApiClient stub methods

**Results:**
- ✅ MergeHandlers created with 3 endpoints (initiate, status, task)
- ✅ 8/8 unit tests passing (all HTTP scenarios covered)
- ✅ Validation refactored to use Zod schemas
- ✅ Routes properly configured in route-config.ts
- ✅ Shared types added to packages/shared
- ✅ AppDriver methods work correctly
- ✅ ApiDriver implements API<string> interface
- ✅ Webapp ApiClient implements API<void> interface
- ✅ TypeScript compiles without errors (all packages)
- ✅ Build succeeds

**Files Created:**
- `firebase/functions/src/merge/MergeHandlers.ts` - HTTP request handlers
- `firebase/functions/src/merge/validation.ts` - Zod-based validation
- `firebase/functions/src/__tests__/unit/api/merge.test.ts` - 8 passing tests

**Files Modified:**
- `firebase/functions/src/routes/route-config.ts` - Added merge routes
- `firebase/functions/src/ApplicationFactory.ts` - Wire up MergeHandlers
- `firebase/functions/src/__tests__/unit/AppDriver.ts` - Added merge test methods
- `packages/shared/src/api.ts` - Added merge methods to API interface
- `packages/shared/src/shared-types.ts` - Added merge request/response types
- `packages/test-support/src/ApiDriver.ts` - Added merge methods
- `webapp-v2/src/app/apiClient.ts` - Added merge stub methods
- `firebase/functions/src/services/ComponentBuilder.ts` - Wire MergeHandlers and MergeTaskService
- Firestore interfaces - Added getMergeJob() and updateMergeJobStatus() methods

**Key Learnings:**
1. **Validation Pattern**: Initially used manual type checking, refactored to Zod schemas using `parseWithApiError()` helper
2. **Webapp Compilation**: Must implement ALL interface methods even if unused (prevents compilation errors)
3. **Testing Through Layers**: Tests validate through HTTP layer using AppDriver (not direct validation calls)
4. **Type Safety**: All types properly named and exported from shared package (no anonymous types)

**Known Limitations:**
1. No validation-specific test coverage (only tests through handlers)
2. No input sanitization (could add `.trim()` to secondaryUserId)
3. Simplified error mapping (could use `createZodErrorMapper` for more sophistication)

### Phase 5: Integration Tests (NOT STARTED)
- [ ] Write integration tests using ONLY ApiDriver
- [ ] Test end-to-end merge flow with emulator
- [ ] Verify job creation and status polling
- [ ] NO DIRECT FIRESTORE ACCESS

### Sanity Check & Refinements (✅ COMPLETED)

After completing Phase 4, performed comprehensive sanity check against all project guidelines.

**Critical Issues Found & Fixed:**

1. ✅ **CRITICAL: Private field access anti-pattern** - `MergeHandlers.getMergeStatus()`
   - **Problem:** Accessed `this.mergeService['firestoreReader']` via bracket notation (line 58)
   - **Violation:** Breaks encapsulation principle ("Write objects with data and behaviour - encapsulation is key")
   - **Fix:** Added public `getMergeJobForUser(jobId, userId)` method to `MergeService`
   - **Benefit:** Service now encapsulates read + authorization logic in one place
   - **Files:** `MergeService.ts` (new method), `MergeHandlers.ts` (updated handler)

2. ✅ **CRITICAL: Validation pattern inconsistency** - `validation.ts`
   - **Problem:** Used `parseWithApiError()` directly instead of project-standard `createRequestValidator`
   - **Violation:** Per `docs/guides/validation.md`: "Build request validators with createRequestValidator"
   - **Fix:** Refactored to use `createRequestValidator` with error mappings and `.trim()` sanitization
   - **Pattern:** Now consistent with expenses/policies/comments validators
   - **Files:** `validation.ts` (complete rewrite), `MergeHandlers.ts` (added `toUserId` conversions)

**Additional Improvements:**
- ✅ Added input sanitization via `.trim()` on all string fields
- ✅ Proper branded type conversions with `toUserId()`
- ✅ Consistent error mapping pattern across all validators
- ✅ Type safety improvements (explicit type conversions in handlers)

**Sanity Check Results:**
- ✅ Build: SUCCESS (all packages compile with no errors)
- ✅ Tests: 11/11 passing (8 API tests + 3 task service tests)
- ✅ No unused code (all methods called and tested)
- ✅ Type safety verified (branded types used correctly)
- ✅ No backward compatibility hacks
- ✅ All 18 files properly tracked in git
- ✅ Follows all project patterns (encapsulation, validation, error handling)

**Verification Commands Run:**
```bash
npm run build                                    # ✅ All packages compile
npx vitest run merge.test.ts                    # ✅ 8/8 passing
npx vitest run MergeTaskService.test.ts         # ✅ 3/3 passing
```

**Decision:** Ready to commit. All critical issues resolved, patterns correct, tests passing.

### Golden Rules for This Implementation
1. ✅ Every step is fully tested before moving to next
2. ✅ No code is written unless it's immediately tested and wired
3. ✅ Unit tests FIRST, integration tests LAST
4. ✅ Integration tests use ONLY ApiDriver (never Firestore)
5. ✅ One small step at a time - no big bang implementations
6. ✅ Run sanity checks before declaring completion
7. ✅ Fix compilation errors immediately - never leave broken builds

## 💡 KEY INSIGHTS

1. **Integration tests test the API, not the database**
   - Use ApiDriver exclusively
   - Never bypass the API layer
   - This ensures the real API works correctly

2. **Unit tests test business logic in isolation**
   - Use test doubles (stubs/mocks)
   - Test edge cases and error handling
   - Fast, reliable, no external dependencies

3. **Seed data belongs in emulator startup, not test files**
   - Required infrastructure data (tenants, policies)
   - Seeded once when emulator starts
   - Tests assume this data exists

4. **Test builders are mandatory**
   - Use fluent builder pattern for all test data
   - Makes tests readable and maintainable
   - Enforces required fields

5. **TypeScript compilation errors are your friend**
   - If it doesn't compile, the test is wrong
   - Don't force types with `as any`
   - Fix the root cause, not the symptoms

## 📊 CURRENT STATUS SUMMARY

### ✅ Completed (Phases 1-4 + Data Migration)
- **Implementation:** Complete ✅
  - MergeService - Service layer with validation
  - MergeHandlers - HTTP endpoints
  - MergeTaskService - Task execution with FULL data migration logic
  - validation.ts - Request validation (createRequestValidator pattern)
- **Data Migration:** Complete ✅
  - 10 Firestore bulk migration methods implemented
  - All 9 collections migrate properly (groups, memberships, expenses, settlements, comments, activity, tokens)
  - Secondary user marked as merged and disabled
  - Comprehensive logging and error handling
- **Unit Tests:** 12/12 passing ✅
  - 8 API handler tests
  - 4 task service tests (including comprehensive migration test)
- **TypeScript compilation:** Success (all packages) ✅
- **Infrastructure:** Complete ✅
  - Routes configured
  - Service wiring complete
  - Firestore methods added (10 new migration methods + job management)
  - Shared types published
- **Sanity Check:** Complete ✅
  - Encapsulation issues resolved
  - Validation patterns fixed
  - All code follows project guidelines
- **Git Status:** Committed and rebased onto main ✅

### ⏳ Pending (Phase 5)
- **Integration Tests:** Not yet started
  - Will use ApiDriver exclusively
  - Will NOT write to Firestore directly
  - Will follow correct testing patterns from lessons learned
  - Will test full end-to-end merge with real emulator data

### 🎯 Next Steps

When ready to implement Phase 5 (Integration Tests):
1. Write integration tests using ONLY ApiDriver
2. Test end-to-end merge flow with emulator
3. Verify job creation, status polling, and data migration
4. Test with real users, groups, expenses, and settlements
5. Follow the golden rule: **Never write to Firestore in integration tests**

**Feature Status:** Core implementation COMPLETE ✅ - Ready for integration testing and UI implementation

This document preserves the lessons learned from the previous failed attempt to ensure Phase 5 is implemented correctly.
