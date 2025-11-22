# Account Merging Feature - POST-MORTEM

**STATUS: This feature was implemented, encountered catastrophic testing issues, and was COMPLETELY REVERTED.**

**CURRENT STATE (as of latest commit):**
- ❌ **NO merge implementation exists in the codebase**
- ❌ All merge-related files have been removed
- ✅ Cloud Tasks infrastructure (StubCloudTasksClient) remains as generic infrastructure
- ✅ This document serves as lessons learned for future implementation attempts

**What this document contains:**
- Record of what went wrong during the first implementation attempt
- Correct testing patterns to follow in future attempts
- Documentation of the mistakes that led to the revert

---

## Critical Lessons Learned

### ❌ WHAT WENT WRONG

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

4. **Misunderstood the test isolation pattern**
   - Each integration test should setup its own data via API calls
   - Tests like `account-merge.test.ts` worked because they used borrowTestUsers() and ApiDriver
   - Tests failed when I tried to "help" by adding database setup

### ✅ WHAT WORKED

1. **Unit Tests (MergeService) - 9/9 PASSING**
   - Used StubAuthService and TenantFirestoreTestDatabase
   - No mocks for Firestore - used real test database
   - Mock only for CloudTasksClient (external service)
   - Tests are isolated, fast, and reliable

2. **Core Implementation**
   - MergeService.ts - Service layer with validation
   - MergeHandlers.ts - HTTP endpoint handlers
   - MergeTaskService.ts - Data migration logic
   - Schemas in merge.ts - Zod validation

3. **Integration Test Pattern (when done correctly)**
   - borrowTestUsers() for getting test users with valid tokens
   - ApiDriver for all API calls
   - No direct Firestore access
   - Tests clean up after themselves

4. **Test Infrastructure**
   - ComponentBuilderSingleton pattern for dependency injection
   - StubAuthService for auth operations in unit tests
   - TenantFirestoreTestDatabase for Firestore operations in unit tests

## 📝 WHAT EXISTED DURING THE FAILED ATTEMPT (All Since REVERTED)

**NOTE: None of these files exist in the current codebase. They were all reverted.**

### Core Implementation (REVERTED)
```
firebase/functions/src/merge/MergeService.ts              ❌ REVERTED - Service layer
firebase/functions/src/merge/MergeHandlers.ts             ❌ REVERTED - HTTP handlers
firebase/functions/src/merge/MergeTaskService.ts          ❌ REVERTED - Data migration
firebase/functions/src/merge/MergeTaskHandler.ts          ❌ REVERTED - Cloud Tasks handler
firebase/functions/src/schemas/merge.ts                   ❌ REVERTED - Zod schemas
```

### Unit Tests (REVERTED)
```
firebase/functions/src/__tests__/unit/services/MergeService.test.ts      ❌ REVERTED (was 9/9 passing)
firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts  ❌ REVERTED (was 5/5 passing)
firebase/functions/src/__tests__/unit/mocks/StubTaskQueue.ts             ❌ REVERTED - Mock for tasks
```

**Note:** StubAuthService.ts still exists and is used by other tests - it was not part of the merge feature.

### Infrastructure Changes (REVERTED)
```
firebase/functions/src/constants.ts                       ❌ REVERTED - ACCOUNT_MERGES constant removed
firebase/functions/src/routes/route-config.ts             ❌ REVERTED - Merge routes removed
firebase/functions/src/index.ts                           ❌ REVERTED - Task handler export removed
firebase/functions/src/services/ComponentBuilder.ts       ❌ REVERTED - Service wiring removed
firebase/functions/src/ApplicationFactory.ts              ❌ REVERTED - Handler registration removed
```

### Shared Types & API (REVERTED)
```
packages/shared/src/api.ts                                ❌ REVERTED - Merge API types removed
packages/shared/src/schemas/apiRequests.ts                ❌ REVERTED - Request schemas removed
packages/shared/src/schemas/apiSchemas.ts                 ❌ REVERTED - Response schemas removed
packages/test-support/src/ApiDriver.ts                    ❌ REVERTED - Merge methods removed
```

### Infrastructure That Remains
```
packages/firebase-simulator/src/StubCloudTasksClient.ts   ✅ KEPT - Generic Cloud Tasks testing infrastructure
```

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

## 🔧 WHAT NEEDS TO BE FIXED

### 1. Integration Test Setup (HIGH PRIORITY)

**Problem:** account-merge.test.ts has 11/12 tests failing

**Root Cause:**
- Added beforeAll that writes tenant/policies to Firestore
- This is wrong - emulator should have this data seeded already
- Tests fail because API expects tenant data, but we shouldn't write it in tests

**Solution:**
1. Remove ALL beforeAll database writes from integration tests
2. Ensure emulator starts with tenant/policy seed data
3. Add seed script if it doesn't exist:
   ```typescript
   // firebase/scripts/seed-test-data.ts
   async function seedTestData() {
       const db = admin.firestore();

       // Seed default tenant
       await db.collection('tenants').doc('default-tenant').set({
           id: 'default-tenant',
           domains: ['localhost'],
           branding: {
               appName: 'Test App',
               logoUrl: 'https://example.com/logo.png',
               primaryColor: '#000000',
               secondaryColor: '#FFFFFF',
           },
           createdAt: Timestamp.now(),
           updatedAt: Timestamp.now(),
       });

       // Seed required policies
       for (const policyId of ['terms-of-service', 'cookie-policy', 'privacy-policy']) {
           await db.collection('policies').doc(policyId).set({...});
       }
   }
   ```

4. Call seed script in global test setup or emulator startup
5. Update integration tests to assume data exists

### 2. Remove Direct Firestore Access from Tests

**Files to Fix:**
- `account-merge.test.ts` - Remove beforeAll, assume tenant exists
- `firestore-reader.integration.test.ts` - Revert entirely
- `groups-management-consolidated.test.ts` - Revert any changes
- `concurrent-operations.integration.test.ts` - Revert any changes

**Pattern:**
```typescript
// ❌ WRONG
beforeAll(async () => {
    const db = getFirestore();
    await db.collection('tenants').doc('default').set({...});
});

// ✅ CORRECT
beforeAll(async () => {
    // Assume tenant data exists from emulator seed
    // No database writes!
});
```

### 3. Fix run-test.sh Script

**Problem:** Broke mapfile command

**Solution:**
```bash
# Old (broken)
mapfile -t matches < <(...)

# Fix: Check if mapfile exists, fallback to read loop
if command -v mapfile >/dev/null 2>&1; then
    mapfile -t matches < <(cd "$search_root" && find src -name "*${pattern}*.test.ts" -print)
else
    matches=()
    while IFS= read -r line; do
        matches+=("$line")
    done < <(cd "$search_root" && find src -name "*${pattern}*.test.ts" -print)
fi
```

### 4. Review Vitest Config Changes

**Files to Review:**
- `vitest.config.ts` - Check if SKIP_CLOUD_TASKS addition is correct
- `vitest.setup.ts` - Check GCLOUD_PROJECT setup
- `vitest.global-setup.ts` - Check global setup changes

**Keep if:** Changes support unit tests working correctly
**Revert if:** Changes were trying to fix integration test issues

## 📋 RECOVERY PLAN

### Step 1: Revert Bad Changes
```bash
# Revert integration test changes
git checkout HEAD -- firebase/functions/src/__tests__/integration/

# Revert run-test.sh
git checkout HEAD -- firebase/functions/run-test.sh

# Revert firestore-reader test
git checkout HEAD -- firebase/functions/src/__tests__/integration/firestore-reader.integration.test.ts
```

### Step 2: Keep Good Changes
```bash
# Keep all merge implementation files (already committed)
git add firebase/functions/src/merge/
git add firebase/functions/src/schemas/merge.ts

# Keep unit tests
git add firebase/functions/src/__tests__/unit/services/MergeService.test.ts
git add firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts
git add firebase/functions/src/__tests__/unit/mocks/

# Keep infrastructure changes
git add firebase/functions/src/constants.ts
git add firebase/functions/src/routes/route-config.ts
git add firebase/functions/src/index.ts
git add firebase/functions/src/services/ComponentBuilder.ts
git add firebase/functions/src/ApplicationFactory.ts

# Keep shared packages
git add packages/shared/src/
git add packages/test-support/src/ApiDriver.ts
```

### Step 3: Fix Emulator Seed Data
```bash
# Create seed script if doesn't exist
# firebase/scripts/seed-emulator-test-data.ts

# Update global setup to call seed script
# OR add to emulator startup

# Test that emulator starts with required data
npm run emulators:start
# Verify tenant and policies exist
```

### Step 4: Fix Integration Tests
```bash
# Start with account-merge.test.ts
# Remove beforeAll that writes to Firestore
# Assume tenant/policy data exists
# Run test: ./run-test.sh account-merge

# Fix one test file at a time
# Only use ApiDriver for all operations
# Never touch Firestore directly
```

### Step 5: Verify Everything Works
```bash
# Unit tests should still pass
npm test -- src/__tests__/unit/services/MergeService.test.ts
npm test -- src/__tests__/unit/services/MergeTaskService.test.ts

# Integration tests should pass
npm test -- src/__tests__/integration/account-merge.test.ts

# Build should succeed
npm run build
```

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

## 🎯 RE-IMPLEMENTATION IN PROGRESS

**Status: Second attempt - Phase 1 COMPLETE ✅**

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

### Phase 3: Data Migration Service (NOT STARTED)
- [ ] Create `MergeTaskService` for actual data migration
- [ ] Implement collection-by-collection migration logic
- [ ] Write comprehensive unit tests
- [ ] Test with TenantFirestoreTestDatabase

### Phase 4: HTTP Layer (NOT STARTED)
- [ ] Create `MergeHandlers` with HTTP endpoints
- [ ] Add routes to `route-config.ts`
- [ ] Add shared schemas to packages
- [ ] Export from `index.ts`

### Phase 5: Integration Tests (LAST)
- [ ] Add merge methods to ApiDriver
- [ ] Write integration tests using ONLY ApiDriver
- [ ] Verify end-to-end flow via API
- [ ] NO DIRECT FIRESTORE ACCESS

### Golden Rules for This Implementation
1. ✅ Every step is fully tested before moving to next
2. ✅ No code is written unless it's immediately tested and wired
3. ✅ Unit tests FIRST, integration tests LAST
4. ✅ Integration tests use ONLY ApiDriver (never Firestore)
5. ✅ One small step at a time - no big bang implementations

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

## 📊 ACTUAL CURRENT STATUS (Updated after Research)

### ✅ What's Working
- **All existing unit tests:** 1266/1266 passing ✅
- **TypeScript compilation (backend):** Success ✅
- **Cloud Tasks infrastructure:** StubCloudTasksClient available for testing ✅
- **Existing integration tests:** Passing and using correct patterns ✅

### ⚠️ Current Issues (Unrelated to Account Merging)
- **TypeScript compilation (webapp):** 56 errors - branded type issues (UserId, Email)
  - Files affected: Playwright integration tests
  - Issue: String literals passed where branded types expected
  - Fix needed: Add type assertions or use branded type constructors

### ❌ Account Merging Feature Status
- **Implementation:** Does NOT exist (completely reverted)
- **Unit tests:** Do NOT exist (were reverted)
- **Integration tests:** Do NOT exist (were reverted)
- **Routes:** Do NOT exist (were reverted)
- **Schemas:** Do NOT exist (were reverted)

### 📝 Lessons Learned (Why It Was Reverted)

The implementation itself was solid, but the testing approach was catastrophically wrong:

1. ❌ Integration tests wrote directly to Firestore (bypassing the API)
2. ❌ Tests had beforeAll hooks that seeded tenant/policy data
3. ❌ Integration tests violated the "API-only" rule
4. ✅ Unit tests were correct (using stubs and test database)
5. ✅ Core implementation code was well-structured

**The Golden Rule That Was Violated:**
> Never. Write. To. Firestore. In. Integration. Tests.
> Use the API. Always. That's the entire point of integration testing.

### 🎯 What Remains for Future Implementation

If account merging is re-implemented, use this document as:
1. A guide for correct testing patterns
2. A warning about common pitfalls
3. Reference for the testing infrastructure that worked (StubAuthService, StubCloudTasksClient)
4. Reminder to write unit tests first, integration tests last
