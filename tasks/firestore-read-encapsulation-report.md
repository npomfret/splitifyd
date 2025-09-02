# Task: Encapsulate Firestore Reads into a Centralized Service

## 1. Analysis & Critique

### 1.1. Merit Assessment

**✅ Strong Benefits:**
- **Testability Revolution**: Eliminates complex Firebase emulator dependency for unit tests
- **Type Safety**: Centralized Zod validation ensures consistent data schemas
- **ServiceRegistry Integration**: Aligns perfectly with existing dependency injection pattern
- **Maintainability**: Single source of truth for all read queries
- **Performance Opportunities**: Centralized caching, query optimization, batching

**✅ Architectural Soundness:**
- Follows dependency inversion principle
- Leverages existing `ServiceRegistry` infrastructure
- Maintains separation of concerns
- Compatible with current Zod schema validation patterns

### 1.2. Critical Analysis & Concerns

**⚠️ Scope Complexity:**
- **29 files** with Firestore reads require refactoring
- **Mixed concerns**: Some files have both read/write operations
- **Real-time listeners**: Complex subscription management patterns
- **Transaction contexts**: Some reads must occur within Firestore transactions

**⚠️ Testing Migration Risk:**
- **All integration tests** rely on emulator setup
- **TestUserPoolService** extensively uses direct Firestore calls
- **Test builders** (`CreateGroupRequestBuilder`, etc.) may need updates
- **Timing/race conditions** in real-time features

**⚠️ Interface Design Challenges:**
- **Query complexity**: Some reads have complex where clauses, pagination
- **Permission contexts**: Many reads require user permission checking
- **Performance patterns**: Existing services optimize specific query patterns
- **Return type consistency**: Services return different shapes (raw docs vs. transformed objects)

## 2. Revised Architecture Design

### 2.1. Core Interface Structure

```typescript
// Core read interface with consistent patterns
interface IFirestoreReader {
    // Document reads - consistent null return for missing docs
    getUser(userId: string): Promise<UserProfile | null>;
    getGroup(groupId: string): Promise<Group | null>;
    getExpense(expenseId: string): Promise<Expense | null>;
    getSettlement(settlementId: string): Promise<Settlement | null>;
    getPolicy(policyId: string): Promise<Policy | null>;

    // Collection reads - consistent array returns
    getUsersForGroup(groupId: string): Promise<UserProfile[]>;
    getGroupsForUser(userId: string): Promise<Group[]>;
    getExpensesForGroup(groupId: string, options?: PaginationOptions): Promise<Expense[]>;
    getSettlementsForGroup(groupId: string): Promise<Settlement[]>;
    
    // Complex queries with options
    getGroupMembers(groupId: string, options?: { 
        includeInactive?: boolean; 
        roles?: MemberRole[] 
    }): Promise<GroupMemberDocument[]>;
    
    // Search and filtering
    getActiveShareLinkByToken(token: string): Promise<ShareLink | null>;
    getCommentsForTarget(targetType: 'group' | 'expense', targetId: string): Promise<Comment[]>;
    
    // Real-time subscriptions - return unsubscribe functions
    subscribeToGroup(groupId: string, callback: (group: Group | null) => void): () => void;
    subscribeToGroupExpenses(groupId: string, callback: (expenses: Expense[]) => void): () => void;
}

// Supporting types for consistency
interface PaginationOptions {
    limit?: number;
    offset?: number;
    cursor?: string;
}
```

### 2.2. Implementation with Validation & Error Handling

```typescript
export class FirestoreReader implements IFirestoreReader {
    constructor(
        private db: FirebaseFirestore.Firestore = firestoreDb,
        private logger: LoggerContext = logger
    ) {}

    public async getUser(userId: string): Promise<UserProfile | null> {
        try {
            const userDoc = await this.db.collection(FirestoreCollections.USERS)
                .doc(userId)
                .get();
                
            if (!userDoc.exists) {
                return null;
            }
            
            // Validate with existing schemas
            const userData = UserDocumentSchema.parse({
                id: userDoc.id,
                ...userDoc.data()
            });
            
            return userData;
        } catch (error) {
            this.logger.error(`Failed to get user ${userId}:`, error);
            throw error;
        }
    }
    
    // Transaction-aware reads for complex operations
    public async getGroupInTransaction(
        transaction: FirebaseFirestore.Transaction,
        groupId: string
    ): Promise<Group | null> {
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
        const groupDoc = await transaction.get(groupRef);
        
        if (!groupDoc.exists) {
            return null;
        }
        
        return GroupDocumentSchema.parse({
            id: groupDoc.id,
            ...groupDoc.data()
        });
    }
}
```

### 2.3. Mock Implementation for Testing

```typescript
export class MockFirestoreReader implements IFirestoreReader {
    // Auto-generated mock functions with proper typing
    public getUser = vi.fn<[string], Promise<UserProfile | null>>();
    public getGroup = vi.fn<[string], Promise<Group | null>>();
    public getExpense = vi.fn<[string], Promise<Expense | null>>();
    // ... all other methods
    
    // Test utilities
    public resetAllMocks(): void {
        vi.resetAllMocks();
    }
    
    // Helper for common test scenarios
    public mockUserExists(userId: string, userData: Partial<UserProfile>): void {
        this.getUser.mockImplementation(async (id) => 
            id === userId ? { uid: userId, ...userData } as UserProfile : null
        );
    }
}

## 3. Comprehensive File Analysis

### 3.1. Files Requiring Refactoring (29 total)

**Core Services (14 files):**
- `services/UserService2.ts` - getUser, getUsers, listGroups
- `services/GroupService.ts` - getGroup, listGroups, member queries  
- `services/ExpenseService.ts` - getExpense, listGroupExpenses
- `services/SettlementService.ts` - getSettlement, group settlements
- `services/CommentService.ts` - getCommentsCollection
- `services/GroupShareService.ts` - findShareLinkByToken
- `services/GroupMemberService.ts` - member management queries
- `services/GroupPermissionService.ts` - permission checks
- `services/balance/DataFetcher.ts` - fetchExpenses, fetchSettlements, fetchGroup
- `services/expenseMetadataService.ts` - metadata calculations
- `services/UserPolicyService.ts` - policy reads
- `services/PolicyService.ts` - policy documents
- `services/balanceCalculator.ts` - balance calculations
- `services/FirestoreValidationService.ts` - document validation

**Infrastructure (5 files):**
- `auth/middleware.ts` - user authentication reads
- `utils/i18n.ts` - user language preferences
- `utils/firestore-helpers.ts` - utility functions
- `utils/groupHelpers.ts` - group utility reads
- `triggers/change-tracker.ts` - change tracking

**Handlers (4 files):**
- `expenses/handlers.ts` - expense endpoint reads
- `auth/handlers.ts` - authentication reads
- `auth/policy-helpers.ts` - policy helper reads
- `index.ts` - main handler reads

**Testing (3 files):**
- `test-pool/TestUserPoolService.ts` - test user management
- `scheduled/cleanup.ts` - cleanup operations
- `user-management/assign-theme-color.ts` - theme assignment

**Integration Tests (3 files):**
- Multiple test files using direct Firestore calls

### 3.2. Query Complexity Analysis

| Complexity Level | Examples | Refactoring Strategy |
|-----------------|----------|---------------------|
| **Simple Document Gets** | `doc(id).get()` | Direct 1:1 interface mapping |
| **Basic Collection Queries** | `.where('field', '==', value)` | Standard collection methods |
| **Complex Filtering** | Multiple where clauses, array operations | Parameterized interface methods |
| **Pagination Queries** | Cursor-based, limit/offset | Options-based interface design |
| **Transaction Reads** | Reads within Firestore transactions | Transaction-aware interface methods |
| **Real-time Listeners** | `onSnapshot()` callbacks | Subscription management methods |

## 4. Detailed Implementation Plan

### Phase 1: Foundation (Days 1-3)

#### Day 1: Interface & Core Implementation

**Step 1.1: Create Core Interface**
```bash
# Create: firebase/functions/src/services/firestore/IFirestoreReader.ts
```

**Tasks:**
- Define complete `IFirestoreReader` interface with all 29+ methods
- Include pagination, filtering, and transaction support interfaces  
- Add TypeScript generics for flexible return types
- Document each method with JSDoc

**Step 1.2: Implement FirestoreReader**
```bash  
# Create: firebase/functions/src/services/firestore/FirestoreReader.ts
```

**Tasks:**
- Implement all interface methods with Zod validation
- Add proper error handling and logging
- Include transaction-aware methods
- Add subscription management for real-time listeners
- Include performance monitoring integration

**Step 1.3: Create Mock Implementation**
```bash
# Create: firebase/functions/src/services/firestore/MockFirestoreReader.ts
```

**Tasks:**
- Implement all interface methods as Vitest mocks
- Add helper methods for common test scenarios
- Include type-safe mock implementations
- Add reset and configuration utilities

#### Day 2: ServiceRegistry Integration

**Step 2.1: Update ServiceRegistry**
- Register `FirestoreReader` in `ServiceRegistry`
- Create factory function for `FirestoreReader` initialization
- Add service registration in `serviceRegistration.ts`

**Step 2.2: Create Type Definitions**
```bash
# Create: firebase/functions/src/types/firestore-reader-types.ts
```

**Tasks:**
- Define all supporting types (PaginationOptions, FilterOptions, etc.)
- Import and re-export from shared types where possible
- Ensure compatibility with existing service interfaces

#### Day 3: Testing Infrastructure

**Step 3.1: Update Test Support**
- Modify `@splitifyd/test-support` to include `MockFirestoreReader`
- Create test utilities for common mock scenarios
- Add builder pattern support for mock data

**Step 3.2: Create Example Test Migration**
- Pick one simple service test file
- Demonstrate full migration pattern
- Document test refactoring approach
- Verify all patterns work correctly

### Phase 2: Service Migration (Days 4-10) 

#### Service Migration Order (Risk-based)

**Day 4: UserService2 (Foundation)**
- **Why first**: Used by authentication, most critical
- **Complexity**: Low - mostly simple document gets
- **Impact**: High - affects all authenticated endpoints
- **Tests**: 5 test files affected

**Day 5: GroupService (Core Business Logic)**
- **Why second**: Central to app functionality
- **Complexity**: Medium - some complex queries with pagination
- **Impact**: High - affects most app features
- **Tests**: 8 test files affected

**Day 6: ExpenseService & SettlementService**
- **Why paired**: Related functionality, similar patterns
- **Complexity**: Medium - transaction reads, filtering
- **Impact**: High - core financial features
- **Tests**: 6 test files affected

**Day 7: GroupMemberService & GroupPermissionService**
- **Why paired**: Related functionality, complex permission logic
- **Complexity**: High - complex filtering, member status queries
- **Impact**: Medium - affects group management
- **Tests**: 4 test files affected

**Day 8: Support Services (CommentService, GroupShareService)**  
- **Complexity**: Low-medium - straightforward collection queries
- **Impact**: Low-medium - secondary features
- **Tests**: 3 test files affected

**Day 9: Balance & Metadata Services**
- **Why later**: Complex calculation logic, performance sensitive
- **Complexity**: High - complex aggregation queries
- **Impact**: High - affects balance displays
- **Tests**: 4 test files affected

**Day 10: Policy & Validation Services**
- **Why last**: Less frequently used, simpler patterns
- **Complexity**: Low - mostly document gets
- **Impact**: Low - configuration/validation features
- **Tests**: 2 test files affected

### Phase 3: Infrastructure & Handlers (Days 11-13)

#### Day 11: Authentication & Middleware
**Files:**
- `auth/middleware.ts` - user authentication reads
- `auth/handlers.ts` - authentication endpoint reads  
- `auth/policy-helpers.ts` - policy helper functions

**Approach:**
- Inject `IFirestoreReader` into middleware functions
- Update authentication pipeline to use reader
- Ensure zero breaking changes to auth flow

#### Day 12: Utilities & Helpers  
**Files:**
- `utils/i18n.ts` - internationalization user reads
- `utils/firestore-helpers.ts` - utility functions
- `utils/groupHelpers.ts` - group utility functions

**Approach:**
- Refactor utility functions to accept reader parameter
- Maintain backward compatibility during transition
- Update all call sites progressively

#### Day 13: Handlers & Endpoints
**Files:**
- `expenses/handlers.ts` - expense endpoint logic
- `triggers/change-tracker.ts` - real-time change tracking
- `index.ts` - main handler file

**Approach:**
- Inject reader through request context/dependency injection  
- Update handler functions to use reader methods
- Ensure API contract remains unchanged

### Phase 4: Testing Migration (Days 14-16)

#### Day 14: Unit Test Migration Strategy

**Test Migration Pattern:**
1. **Identify test file dependencies** on direct Firestore calls
2. **Update test setup** to use `MockFirestoreReader`  
3. **Replace emulator setup** with mock configurations
4. **Verify test coverage** remains the same
5. **Performance test** - ensure faster test execution

**Migration Script Creation:**
```bash
# Create migration script: scripts/migrate-tests.ts
```

#### Day 15: Integration Test Updates

**Integration Test Strategy:**
- **Keep some emulator tests** for full end-to-end validation
- **Convert unit-like integration tests** to use mocks
- **Update test builders** to work with new patterns
- **Maintain real-time test coverage** for critical features

**Files requiring updates:**
- All files in `src/__tests__/integration/`
- `test-pool/TestUserPoolService.ts` modifications
- Test support package updates

#### Day 16: Test Infrastructure Finalization

**Tasks:**
- **Create test data builders** for common mock scenarios
- **Performance benchmarking** - compare old vs new test speeds
- **Documentation** - test migration guide
- **CI/CD updates** - ensure all tests pass in pipeline

### Phase 5: Final Cleanup & Optimization (Days 17-18)

#### Day 17: Codebase Cleanup

**Automated Search & Replace:**
```bash
# Search for remaining direct Firestore calls
grep -r "firestoreDb\." firebase/functions/src/
grep -r "\.get()" firebase/functions/src/
grep -r "\.where(" firebase/functions/src/  
```

**Manual Verification:**
- Review each remaining instance
- Determine if it needs refactoring or can remain
- Update any missed calls

**Dead Code Removal:**
- Remove unused Firestore helper functions
- Clean up redundant import statements
- Remove old collection reference methods

#### Day 18: Performance & Documentation

**Performance Optimization:**
- Add caching layer to FirestoreReader for frequently accessed documents
- Implement request batching for multiple document reads
- Add metrics/monitoring for read operations

**Documentation:**
- Complete API documentation for IFirestoreReader
- Create migration guide for future developers
- Update project README with new architecture notes
- Document testing patterns and best practices

## 5. Risk Mitigation Strategy

### 5.1. Testing Safety Net
- **Parallel Implementation**: Keep old and new implementations side-by-side during migration
- **Feature Flags**: Use environment variables to toggle between implementations  
- **Incremental Rollback**: Ability to revert individual services if issues arise
- **Comprehensive Test Coverage**: Ensure no regression in test coverage

### 5.2. Performance Monitoring
- **Benchmark Current Performance**: Measure existing query performance
- **Monitor During Migration**: Track query performance changes
- **Optimize Problem Areas**: Address any performance degradation immediately
- **Load Testing**: Ensure new implementation handles production load

### 5.3. Real-time Feature Protection
- **Subscription Management**: Carefully handle listener lifecycle
- **Race Condition Testing**: Verify real-time updates work correctly
- **Memory Leak Prevention**: Ensure proper listener cleanup
- **Fallback Mechanisms**: Plan for listener failure scenarios

## 6. Success Metrics

### 6.1. Technical Metrics
- **Test Speed**: 80%+ faster unit test execution
- **Test Reliability**: 99%+ test pass rate consistency  
- **Code Coverage**: Maintain or improve current coverage levels
- **Build Time**: No regression in overall build time

### 6.2. Developer Experience Metrics  
- **Test Setup Time**: 90%+ reduction in test setup complexity
- **Debugging Ease**: Clearer error messages and stack traces
- **New Feature Velocity**: Faster development of database-dependent features
- **Code Maintainability**: Centralized query logic, easier to modify

### 6.3. Production Metrics
- **Performance**: No degradation in API response times  
- **Reliability**: No increase in error rates
- **Memory Usage**: No increase in memory consumption
- **Real-time Features**: Maintain current real-time update performance

## 7. Conclusion

This refactoring represents a significant architectural improvement that will:

1. **Transform Testing**: From slow, complex emulator-based tests to fast, reliable unit tests
2. **Improve Maintainability**: Centralize all read logic in a single, well-tested service
3. **Enhance Type Safety**: Ensure all data returned from Firestore is properly validated
4. **Enable Future Optimizations**: Caching, batching, and performance improvements
5. **Simplify Development**: Clear, consistent interface for all database reads

The 18-day implementation plan balances thorough execution with manageable risk, ensuring each phase can be completed successfully while maintaining system stability.
