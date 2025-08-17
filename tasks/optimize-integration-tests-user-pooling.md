# Integration Test Optimization: User Pooling Strategy

## Overview
The recent optimization to `group-members.test.ts` reduced execution time from several minutes to 3.62 seconds by implementing a user pool strategy. This document identifies other integration tests that would benefit from the same optimization.

## The Optimization Pattern

### Before (Slow):
```typescript
// Each test creates its own users
it('test 1', async () => {
    const user = await driver.createUser(new UserBuilder().build());
    // ...
});

it('test 2', async () => {
    const user = await driver.createUser(new UserBuilder().build());
    // ...
});
```

### After (Fast):
```typescript
// Create user pool once
let testUsers: User[] = [];

beforeAll(async () => {
    const users: User[] = [];
    for (let i = 0; i < 5; i++) {
        users.push(await driver.createUser(new UserBuilder().build()));
    }
    testUsers = users;
});

// Tests reuse from pool
it('test 1', async () => {
    const users = testUsers.slice(0, 2);
    // ...
});
```

## High-Priority Files for Optimization

### 1. **api.test.ts** - HIGH PRIORITY
- **Current Time**: 8.1 seconds
- **User Creations**: 7+ createUser calls across tests
- **Test Count**: ~30 tests
- **Recommendation**: Create pool of 5-6 users in beforeAll()
- **Estimated Savings**: 3-4 seconds

### 2. **business-logic.test.ts** - HIGH PRIORITY  
- **Current Time**: 4.4 seconds
- **User Creations**: 2 createUser calls (3 users in beforeAll + 1 in isolated test)
- **Test Count**: 26 tests
- **Recommendation**: Expand user pool to 4 users, eliminate isolated user creation
- **Estimated Savings**: 1-2 seconds

### 3. **settlement-api-realtime.test.ts** - MEDIUM PRIORITY
- **Current Time**: Unknown
- **User Creations**: 2 createUser calls in each beforeEach
- **Test Count**: 4 tests
- **Recommendation**: Create pool of 2 users in beforeAll()
- **Estimated Savings**: Significant for 4 tests × 2 users = 8 user creations

### 4. **groups.test.ts** - MEDIUM PRIORITY
- **User Creations**: Multiple createUser calls
- **Recommendation**: Implement user pooling
- **Estimated Savings**: 1-2 seconds

### 5. **user-management.test.ts** - LOW PRIORITY
- **User Creations**: 4 createUser calls
- **Note**: May need individual users for testing user management features
- **Recommendation**: Evaluate if pooling makes sense for user-specific tests

## Files in Other Directories

### Edge Cases Directory
- **optimistic-locking.test.ts**
- **test-expense-locking.test.ts**
- **complex-unsettled-balance.test.ts**

### Error Testing Directory  
- **data-validation.test.ts**
- **duplicate-user-registration.test.ts** (may need unique users)
- **negative-value-validation.test.ts**
- **error-handling-recovery.test.ts**

### Security Directory
- **security.test.ts** - May benefit from user pooling

### Performance Directory
Multiple files that likely create many users for load testing - these may benefit from a different optimization strategy.

## Implementation Strategy

### Phase 1: Quick Wins (Est. 30 min)
1. **api.test.ts** - Highest impact, straightforward conversion
2. **business-logic.test.ts** - Already has partial pooling, easy to complete
3. **settlement-api-realtime.test.ts** - Simple 2-user pool

### Phase 2: Medium Effort (Est. 1 hour)
1. **groups.test.ts** 
2. **Edge case tests** - Review and optimize where applicable
3. **Error testing files** - Careful review needed

### Phase 3: Complex Cases (Est. 2+ hours)
1. **Performance tests** - May need specialized pooling strategies
2. **Security tests** - Ensure pooling doesn't compromise test isolation

## Expected Overall Impact

- **Current total test time**: ~50+ seconds for full suite
- **Expected reduction**: 30-40% (15-20 seconds)
- **Developer productivity**: Faster feedback loop during development

## Implementation Guidelines

1. **Pool Size**: Generally 5-6 users covers most test scenarios
2. **Test Isolation**: Ensure tests still create their own groups/expenses
3. **Clear Naming**: Use descriptive helper functions like `_getTestUsers(count)`
4. **Documentation**: Add comments explaining the pooling strategy
5. **Verification**: Run tests multiple times to ensure no flaky behavior

## Code Template

```typescript
describe('Test Suite', () => {
    const driver = new ApiDriver();
    let testUserPool: User[] = [];
    
    // Helper to get users from pool
    const getTestUsers = (count: number): User[] => {
        if (count > testUserPool.length) {
            throw new Error(`Requested ${count} users but pool only has ${testUserPool.length}`);
        }
        return testUserPool.slice(0, count);
    };
    
    beforeAll(async () => {
        // Create user pool once
        const poolSize = 6; // Adjust based on max users needed in any test
        const users: User[] = [];
        for (let i = 0; i < poolSize; i++) {
            users.push(await driver.createUser(new UserBuilder().build()));
        }
        testUserPool = users;
    });
    
    it('test using 2 users', async () => {
        const [user1, user2] = getTestUsers(2);
        // Test logic...
    });
    
    it('test using 3 users', async () => {
        const users = getTestUsers(3);
        // Test logic...
    });
});
```

## Next Steps

1. Start with Phase 1 files for immediate impact
2. Measure execution time before/after each optimization
3. Document any tests that cannot use pooling and why
4. Consider creating a shared test utility for user pool management
5. Update test documentation with the new pattern

## Notes

- Some tests (like user registration tests) may legitimately need fresh users
- Performance tests may need hundreds of users - consider different strategy
- Always verify test isolation is maintained after optimization
- Consider adding a npm script to run tests with timing information