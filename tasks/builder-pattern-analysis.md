# Builder Pattern Consolidation - Implementation Plan

## Executive Summary

This document provides a detailed, incremental implementation plan for consolidating and improving the builder pattern across the codebase. Based on analysis of the current state, we have identified significant opportunities to improve test maintainability, reduce code duplication, and enforce consistent patterns.

**Current State:**
- 8 well-designed builders in `packages/test-support/builders`
- 7+ ad-hoc builders scattered across test files
- Manual object creation in critical test files
- E2E tests with hardcoded test data
- No governance to prevent pattern drift

**Target State:**
- All builders consolidated in shared package
- Zero ad-hoc builders in test files
- Complex objects created exclusively via builders
- E2E tests using builders for dynamic test data
- Automated enforcement of builder patterns

---

## Implementation Phases

### Phase 1: Extract and Consolidate Ad-hoc Builders ⭐ **HIGH PRIORITY**
**Timeline: 2-3 hours | Risk: Low**

#### 1.1 Extract from `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts`

**Builders to Extract:**
- `FirestoreExpenseBuilder` (line 36) → extends ExpenseBuilder
- `FirestoreSettlementBuilder` (line 81) → extends SettlementBuilder  
- `MockGroupBuilder` (line 145) → creates mock group objects
- `UserProfileBuilder` (line 196) → creates user profile test data
- `MockFirestoreBuilder` (line 124) → creates mock Firestore instances

**Implementation Steps:**
1. Create new files in `packages/test-support/builders/`:
   - `FirestoreExpenseBuilder.ts`
   - `FirestoreSettlementBuilder.ts` 
   - `MockGroupBuilder.ts`
   - `UserProfileBuilder.ts`
   - `MockFirestoreBuilder.ts`
2. Move class definitions with all methods intact
3. Update imports in `balanceCalculator.test.ts`
4. Add exports to `packages/test-support/builders/index.ts`
5. Run tests to verify functionality

#### 1.2 Extract from `firebase/functions/src/__tests__/unit/comments-validation.test.ts`

**Builders to Extract:**
- `CommentRequestBuilder` (line 6) → creates comment request objects
- `QueryBuilder` (line 78) → creates Firestore query mocks

**Implementation Steps:**
1. Create `packages/test-support/builders/CommentRequestBuilder.ts`
2. Create `packages/test-support/builders/QueryBuilder.ts`
3. Update imports in `comments-validation.test.ts`
4. Add exports to index.ts
5. Run tests to verify functionality

**Success Criteria:**
- ✅ All ad-hoc builders moved to shared package
- ✅ Original test files have zero local builder definitions
- ✅ All existing tests pass without modification
- ✅ New builders are accessible via `@splitifyd/test-support`

---

### Phase 2: Create Essential New Builders ⭐ **HIGH PRIORITY**
**Timeline: 2 hours | Risk: Medium**

#### 2.1 UserBalanceBuilder - Critical for debtSimplifier.test.ts

**Problem:** Manual creation of complex `UserBalance` objects 10+ times
```typescript
// Current problematic pattern:
const balances: Record<string, UserBalance> = {
    user1: {
        userId: 'user1',
        owes: { user2: 50 },
        owedBy: {},
        netBalance: -50
    },
    // ... repeated manually
};
```

**Solution:** Create `packages/test-support/builders/UserBalanceBuilder.ts`
```typescript
export class UserBalanceBuilder {
    private balance: UserBalance;

    constructor(userId: string) {
        this.balance = {
            userId,
            owes: {},
            owedBy: {},
            netBalance: 0
        };
    }

    withOwes(userId: string, amount: number): this {
        this.balance.owes[userId] = amount;
        this.calculateNetBalance();
        return this;
    }

    withOwedBy(userId: string, amount: number): this {
        this.balance.owedBy[userId] = amount;
        this.calculateNetBalance();
        return this;
    }

    build(): UserBalance {
        return { ...this.balance };
    }
}
```

#### 2.2 BalancesBuilder - Composite Builder Pattern

Create `packages/test-support/builders/BalancesBuilder.ts` for building complete balance scenarios:
```typescript
export class BalancesBuilder {
    private balances: Record<string, UserBalance> = {};

    addUser(userId: string, builderFn: (builder: UserBalanceBuilder) => UserBalanceBuilder): this {
        const balance = builderFn(new UserBalanceBuilder(userId)).build();
        this.balances[userId] = balance;
        return this;
    }

    build(): Record<string, UserBalance> {
        return { ...this.balances };
    }
}
```

**Refactoring Target:** Replace all manual balance creation in `debtSimplifier.test.ts`

**Success Criteria:**
- ✅ UserBalanceBuilder handles all balance scenarios
- ✅ BalancesBuilder simplifies complex multi-user scenarios  
- ✅ debtSimplifier.test.ts has zero manual UserBalance objects
- ✅ Test readability significantly improved

---

### Phase 3: E2E Test Data Builders 🔶 **MEDIUM PRIORITY**
**Timeline: 3-4 hours | Risk: Medium**

#### 3.1 Create E2E-Specific Builders

**Current Problem:** Hardcoded test data throughout E2E tests
- Static strings like "Test Group", "Alice", "Bob"
- No data uniqueness for parallel execution
- Difficult to create complex test scenarios

**Solution: Create specialized E2E builders**

**GroupTestDataBuilder:**
```typescript
export class GroupTestDataBuilder {
    private data: GroupTestData;

    constructor() {
        this.data = {
            name: `Test Group ${Date.now()}`,
            description: `Auto-generated test group`,
            currency: 'USD'
        };
    }

    withName(name: string): this {
        this.data.name = name;
        return this;
    }

    forParallelExecution(): this {
        this.data.name += ` - ${Math.random().toString(36).substr(2, 9)}`;
        return this;
    }
}
```

**ExpenseScenarioBuilder:**
```typescript
export class ExpenseScenarioBuilder {
    private scenario: ExpenseScenario;

    static simpleSplit(): ExpenseScenarioBuilder {
        return new ExpenseScenarioBuilder()
            .withAmount(100)
            .withDescription('Test expense')
            .splitEqually();
    }

    static complexSplit(): ExpenseScenarioBuilder {
        return new ExpenseScenarioBuilder()
            .withAmount(150)
            .withCustomSplits();
    }
}
```

#### 3.2 Refactor E2E Tests

**Target Files:**
- `e2e-tests/src/tests/normal-flow/**/*.test.ts`
- `e2e-tests/src/tests/error-testing/**/*.test.ts`

**Implementation Strategy:**
1. Replace hardcoded group names with `GroupTestDataBuilder`
2. Replace hardcoded expense data with `ExpenseScenarioBuilder`
3. Use `UserBuilder` for dynamic user creation
4. Ensure all test data is unique for parallel execution

**Success Criteria:**
- ✅ Zero hardcoded test data strings in E2E tests
- ✅ All test data generated dynamically
- ✅ Tests can run in parallel without conflicts
- ✅ Complex scenarios easier to create and maintain

---

### Phase 4: Establish Governance 🔶 **MEDIUM PRIORITY** 
**Timeline: 1-2 hours | Risk: Low**

#### 4.1 Create Builder Guidelines

**Create `packages/test-support/BUILDER_GUIDELINES.md`:**
```markdown
# Builder Pattern Guidelines

## When to Create a New Builder
- Complex objects with 3+ properties
- Objects used in multiple test files
- Objects with conditional logic or computed properties

## Builder Requirements
- Must be in packages/test-support/builders/
- Must implement fluent interface
- Must provide sensible defaults
- Must have build() method
- Should have reset() method for reuse

## Naming Conventions
- Class: {ObjectType}Builder
- File: {ObjectType}Builder.ts
- Methods: with{PropertyName}(value)
```

#### 4.2 Add Automated Enforcement

**ESLint Custom Rule:**
```javascript
// .eslintrc.js addition
rules: {
  'custom/no-adhoc-builders': 'error'
}
```

**Rule Logic:**
- Detect `class *Builder` outside of `packages/test-support/builders/`
- Suggest moving to shared package
- Block CI/CD if violations found

**Success Criteria:**
- ✅ Clear guidelines documented
- ✅ ESLint rule prevents new ad-hoc builders
- ✅ Pre-commit hook validates builder locations

---

### Phase 5: Clean Up and Optimize 🟡 **LOW PRIORITY**
**Timeline: 1 hour | Risk: Low**

#### 5.1 Remove Deprecated Files
- Delete `e2e-tests/src/constants/selectors.ts` (deprecated)
- Delete `e2e-tests/src/utils/error-proxy.ts` (deprecated)
- Clean up unused imports

#### 5.2 Builder Enhancements

**Add Standard Methods to All Builders:**
```typescript
interface StandardBuilder<T> {
    build(): T;
    reset(): this;           // Reset to defaults for reuse
    buildMany(count: number): T[];  // Batch creation
}
```

**Type Safety Improvements:**
```typescript
class TypedBuilder<T extends Record<string, any>> {
    protected data: Partial<T> = {};
    
    build(): T {
        // Ensure all required fields present
        return this.data as T;
    }
}
```

---

### Phase 6: Documentation and Training 🟡 **LOW PRIORITY**
**Timeline: 1 hour | Risk: Low**

#### 6.1 Update Test Documentation

**Add to `docs/guides/testing.md`:**
```markdown
## Builder Pattern Usage

### Creating Test Data
```typescript
// ✅ Good - Use builders
const user = new UserBuilder()
    .withEmail('test@example.com')
    .withDisplayName('Test User')
    .build();

// ❌ Bad - Manual object creation
const user = {
    email: 'test@example.com',
    displayName: 'Test User',
    // ... many more properties
};
```

#### 6.2 Migration Examples

**Before/After Examples:**
```typescript
// BEFORE: Manual, brittle, duplicated
const balances: Record<string, UserBalance> = {
    user1: { userId: 'user1', owes: { user2: 50 }, owedBy: {}, netBalance: -50 },
    user2: { userId: 'user2', owes: {}, owedBy: { user1: 50 }, netBalance: 50 }
};

// AFTER: Builder, reusable, readable
const balances = new BalancesBuilder()
    .addUser('user1', b => b.withOwes('user2', 50))
    .addUser('user2', b => b.withOwedBy('user1', 50))
    .build();
```

---

## Success Metrics & Verification

### Quantitative Metrics
- ✅ **Zero ad-hoc builders** in test files (currently 7+)
- ✅ **50% reduction** in test setup code lines
- ✅ **100% builder usage** for complex objects
- ✅ **Zero hardcoded test data** in E2E tests
- ✅ **ESLint rule** preventing pattern violations

### Qualitative Improvements
- ✅ **Improved readability** - tests focus on what matters
- ✅ **Better maintainability** - changes in one place
- ✅ **Reduced duplication** - reusable builders
- ✅ **Easier onboarding** - clear patterns to follow
- ✅ **Parallel test safety** - unique test data

### Verification Steps
1. **After Each Phase:** Run full test suite (`npm test`)
2. **Code Review:** Verify builder quality and consistency
3. **ESLint Check:** Ensure no rule violations
4. **Documentation Review:** Confirm guidelines are clear
5. **Team Training:** Walk through new patterns

---

## Risk Mitigation Strategy

### High-Risk Areas
- **Test logic changes** - Keep original test logic intact
- **Import path updates** - Use search/replace carefully
- **Type compatibility** - Ensure builders match expected types

### Mitigation Actions
- **Incremental approach** - One builder at a time
- **Thorough testing** - Run tests after each extraction
- **Rollback plan** - Git branches for each phase
- **Team review** - Code review after Phase 1
- **Documentation** - Clear migration examples

### Rollback Triggers
- Test suite failure rate > 5%
- Build time increase > 20%
- Team feedback indicates reduced productivity
- ESLint rule causes excessive friction

---

## Next Steps

1. **Get team approval** for implementation plan
2. **Create feature branch** for builder consolidation
3. **Start Phase 1** - extract ad-hoc builders
4. **Review after Phase 1** - gather team feedback
5. **Continue phases** based on priority and feedback
6. **Document lessons learned** for future improvements