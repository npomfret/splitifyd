# Investigate Concurrency Test

We get this from time to time

__tests__/integration/concurrent-operations.test.ts (19.212 s)
  ● Concurrent Operations and Transaction Integrity › Race Conditions › should prevent duplicate concurrent joins by same user


we need to run the test over and over and try to reproduce and fix the error

__tests__/integration/error-handling-recovery.test.ts (6.278 s)
  ● Error Handling and Recovery Testing › 4.2 Data Integrity › Backup and Recovery › should handle database transaction consistency

## Analysis

### Test 1: "should prevent duplicate concurrent joins by same user"
**Root causes of flakiness:**
- The test allows variable outcomes (some joins may succeed, some may fail)
- Race condition: all 5 concurrent requests might reach the server before duplicate detection
- Weak assertion: only requires `failedJoins.length > 0`, not a specific number
- The comment acknowledges "duplicate detection may not catch all in true concurrent execution"

### Test 2: "should handle database transaction consistency"
**Root causes of flakiness:**
- Long 15-second timeout for balance calculations suggests unreliable timing
- Multiple sequential async operations increase timing sensitivity
- Depends on background balance calculation processes completing
- Race condition: balance might not be fully updated even after the wait

## Implementation Plan

### Phase 1: Reproduce the Issues
1. Create a test runner script that runs each test in isolation 50-100 times
2. Collect failure rates and error messages
3. Log timing information to identify patterns

### Phase 2: Fix Test 1 (Duplicate Joins)
**Option A (Preferred): Make the test deterministic**
- Modify the server-side logic to use proper database transactions/locks
- Ensure duplicate detection is atomic and consistent
- Update test to expect exactly 1 success and 4 failures

**Option B: Improve test reliability**
- Add retry logic with exponential backoff
- Increase the number of concurrent attempts to improve statistical reliability
- Strengthen assertions to check specific error messages

### Phase 3: Fix Test 2 (Database Consistency)
**Option A (Preferred): Make balance updates synchronous in tests**
- Add a test-specific flag to make balance calculations synchronous
- Remove the need for `waitForBalanceUpdate` timeout

**Option B: Improve wait mechanism**
- Replace timeout-based waiting with polling for specific conditions
- Add intermediate checks to fail fast if state is incorrect
- Reduce timeout but add more granular status checks

### Phase 4: Verification
1. Run the fixed tests 100 times each to ensure no failures
2. Run full test suite to ensure no regressions
3. Document any server-side changes made

## Next Steps
This task should be broken into smaller commits:
1. Create and run the test reproduction script
2. Fix the duplicate joins test
3. Fix the database consistency test
4. Add documentation about preventing future flaky tests
