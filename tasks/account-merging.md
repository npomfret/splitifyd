# Account Merging Feature - REWRITE

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

## ✅ FILES THAT WORK (Keep These)

### Core Implementation
```
firebase/functions/src/merge/MergeService.ts              ✅ Service layer
firebase/functions/src/merge/MergeHandlers.ts             ✅ HTTP handlers
firebase/functions/src/merge/MergeTaskService.ts          ✅ Data migration
firebase/functions/src/merge/MergeTaskHandler.ts          ✅ Cloud Tasks handler
firebase/functions/src/schemas/merge.ts                   ✅ Zod schemas
```

### Unit Tests
```
firebase/functions/src/__tests__/unit/services/MergeService.test.ts      ✅ 9/9 passing
firebase/functions/src/__tests__/unit/services/MergeTaskService.test.ts  ✅ 5/5 passing
firebase/functions/src/__tests__/unit/mocks/StubAuthService.ts           ✅ Mock for auth
firebase/functions/src/__tests__/unit/mocks/StubTaskQueue.ts             ✅ Mock for tasks
```

### Infrastructure
```
firebase/functions/src/constants.ts                       ✅ Added ACCOUNT_MERGES
firebase/functions/src/routes/route-config.ts             ✅ Added merge routes
firebase/functions/src/index.ts                           ✅ Exported task handler
firebase/functions/src/services/ComponentBuilder.ts       ✅ Wired up services
firebase/functions/src/ApplicationFactory.ts              ✅ Registered handlers
```

### Shared Types & API
```
packages/shared/src/api.ts                                ✅ API types
packages/shared/src/schemas/apiRequests.ts                ✅ Request schemas
packages/shared/src/schemas/apiSchemas.ts                 ✅ Response schemas
packages/test-support/src/ApiDriver.ts                    ✅ Added merge methods
```

## ❌ FILES TO REVERT

### Integration Tests (All Broken)
```
firebase/functions/src/__tests__/integration/account-merge.test.ts       ❌ 11/12 failing - added bad beforeAll
firebase/functions/src/__tests__/integration/firestore-reader.integration.test.ts  ❌ Wrong - wrote to DB
firebase/functions/src/__tests__/integration/groups-management-consolidated.test.ts ❌ Touched but not tested
firebase/functions/src/__tests__/integration/concurrent-operations.integration.test.ts ❌ Touched
```

### Test Infrastructure Changes
```
firebase/functions/run-test.sh                            ❌ Broke mapfile command
firebase/functions/vitest.config.ts                       ⚠️  Review changes
firebase/functions/vitest.setup.ts                        ⚠️  Review changes
firebase/functions/vitest.global-setup.ts                 ⚠️  Review changes
```

### Other Modified Files
```
firebase/functions/src/__tests__/unit/AppDriver.ts        ⚠️  Review - may have good changes
firebase/functions/src/auth/middleware.ts                 ⚠️  Review
firebase/functions/src/utils/middleware.ts                ⚠️  Review
firebase/scripts/seed-policies.ts                         ⚠️  Review
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

## 🎯 NEXT STEPS (In Order)

1. **Revert broken changes** (integration tests, run-test.sh)
2. **Verify unit tests still pass** (should be 14/14)
3. **Create/verify emulator seed script** (tenant + policies)
4. **Fix account-merge integration test** (remove beforeAll database writes)
5. **Run integration test** (should be 12/12 passing)
6. **Commit working code** (merge implementation + tests)
7. **Document the correct testing patterns** (for future reference)

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

## 📊 CURRENT STATUS

### ✅ Working
- Unit Tests: 14/14 passing (9 MergeService + 5 MergeTaskService)
- Core Implementation: Complete
- TypeScript Compilation: Success
- Service Layer: Fully tested
- Schemas: Validated

### ❌ Broken
- Integration Tests: 11/12 failing (bad beforeAll)
- run-test.sh: mapfile command broken
- firestore-reader test: Completely wrong approach
- Other integration tests: Potentially broken

### ⏳ TODO
- Fix emulator seed data setup
- Fix integration tests (remove DB writes)
- Fix run-test.sh script
- Test end-to-end merge flow
- Add MergeTaskService integration tests (actual data migration)
- Frontend implementation

## 🚀 IMPLEMENTATION REMAINS SOLID

Despite the testing disasters, the core implementation is good:

1. **MergeService** - API layer, validation, job creation ✅
2. **MergeHandlers** - HTTP endpoints ✅
3. **MergeTaskService** - Data migration logic ✅
4. **MergeTaskHandler** - Cloud Tasks handler ✅
5. **Schemas** - Zod validation ✅
6. **Unit Tests** - Business logic coverage ✅

The problem was NOT the implementation.
The problem was trying to "help" the integration tests by writing to Firestore.

**Never. Write. To. Firestore. In. Integration. Tests.**

Use the API. Always. That's the entire point of integration testing.
