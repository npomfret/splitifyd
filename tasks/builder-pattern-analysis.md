# Builder Pattern Consolidation - Implementation Plan

## Executive Summary

After analyzing the codebase, the original plan has critical gaps. This revision provides a realistic, actionable approach.

**Current State (VERIFIED):**
- 9 builders in `packages/test-support/builders` (not 8 as originally stated)
- 7 ad-hoc builders scattered across test files
- Manual object creation in `debtSimplifier.test.ts` (10+ manual UserBalance objects)
- E2E tests use workflows/page objects pattern, not builders
- No governance to prevent pattern drift

**Target State:**
- Extract ad-hoc builders to shared package
- Create UserBalanceBuilder for debt test scenarios
- Enhance E2E test data generation (not direct builders)
- Implement governance to prevent regression

---

## Implementation Phases

### Phase 1: Extract Ad-hoc Builders ⭐ **HIGH PRIORITY**
**Timeline: 4-5 hours | Risk: Medium**

#### 1.1 Extract from `balanceCalculator.test.ts`

**Critical Finding**: These builders extend existing builders, need careful handling:
- `FirestoreExpenseBuilder` (line 36) → extends ExpenseBuilder, adds Firestore fields
- `FirestoreSettlementBuilder` (line 81) → extends SettlementBuilder, adds Firestore fields
- `MockGroupBuilder` (line 145) → standalone, direct extraction
- `UserProfileBuilder` (line 196) → standalone, direct extraction  
- `MockFirestoreBuilder` (line 124) → utility class for mocking

**Implementation Steps:**
1. Create files in `packages/test-support/builders/`:
   - `FirestoreExpenseBuilder.ts`
   - `FirestoreSettlementBuilder.ts` 
   - `MockGroupBuilder.ts`
   - `UserProfileBuilder.ts`
   - `MockFirestoreBuilder.ts`
2. Move class definitions with all methods intact
3. Update imports in `balanceCalculator.test.ts`
4. Add exports to `packages/test-support/builders/index.ts`
5. Run tests to verify functionality

#### 1.2 Extract from `comments-validation.test.ts`

**Builders to Extract:**
- `CommentRequestBuilder` (line 6) → fluent interface for comment requests
- `QueryBuilder` (line 78) → creates Firestore query mocks (rename to avoid conflicts)

**Implementation Steps:**
1. Create `CommentRequestBuilder.ts` and `CommentQueryBuilder.ts`
2. Update imports and test references
3. Add to index.ts exports

**Success Criteria:**
- ✅ All ad-hoc builders moved to shared package
- ✅ Original test files have zero local builder definitions
- ✅ All existing tests pass without modification
- ✅ New builders are accessible via `@splitifyd/test-support`

---

### Phase 2: UserBalanceBuilder for Debt Tests ⭐ **HIGH PRIORITY**  
**Timeline: 3 hours | Risk: Medium**

#### 2.1 The Problem
`debtSimplifier.test.ts` has 10+ manually created `UserBalance` objects:
```typescript
const balances: Record<string, UserBalance> = {
    user1: { userId: 'user1', owes: { user2: 50 }, owedBy: {}, netBalance: 0 },
    user2: { userId: 'user2', owes: {}, owedBy: { user1: 50 }, netBalance: 0 }
};
```

#### 2.2 UserBalanceBuilder Implementation
```typescript
export class UserBalanceBuilder {
    private balance: UserBalance;

    constructor(userId: string) {
        this.balance = { userId, owes: {}, owedBy: {}, netBalance: 0 };
    }

    owes(userId: string, amount: number): this {
        this.balance.owes[userId] = amount;
        return this;
    }

    owedBy(userId: string, amount: number): this {
        this.balance.owedBy[userId] = amount;
        return this;
    }

    build(): UserBalance {
        return { ...this.balance };
    }
}
```

#### 2.3 Test Data Factory Pattern
Create common debt scenarios:
```typescript
export const DebtScenarios = {
    simpleDebt: () => ({
        user1: new UserBalanceBuilder('user1').owes('user2', 50).build(),
        user2: new UserBalanceBuilder('user2').owedBy('user1', 50).build()
    }),
    
    triangularDebt: () => ({
        user1: new UserBalanceBuilder('user1').owes('user2', 30).owedBy('user3', 30).build(),
        user2: new UserBalanceBuilder('user2').owes('user3', 30).owedBy('user1', 30).build(),
        user3: new UserBalanceBuilder('user3').owes('user1', 30).owedBy('user2', 30).build()
    })
};
```

**Success Criteria:**
- ✅ UserBalanceBuilder handles all balance scenarios
- ✅ BalancesBuilder simplifies complex multi-user scenarios  
- ✅ debtSimplifier.test.ts has zero manual UserBalance objects
- ✅ Test readability significantly improved

---

### Phase 3: E2E Test Data Generation 🔶 **MEDIUM PRIORITY**
**Timeline: 8-10 hours | Risk: High**

#### 3.1 Architecture Reality Check
E2E tests use **workflows and page objects**, not direct builders. Examples:
- `GroupWorkflow.createGroup()` 
- `generateTestGroupName()` from test-support
- Page objects handle UI interactions

#### 3.2 Actual Solution: Enhance Test Data Generation
Instead of builders, improve existing patterns:

**Enhance `generateTestGroupName()`:**
```typescript
export const TestDataGenerator = {
  uniqueGroupName: (prefix: string = 'Test') => 
    `${prefix} Group ${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    
  uniqueEmail: () => 
    `test-${Date.now()}@example.com`,
    
  expenseData: (type: 'simple' | 'complex') => ({
    description: `${type} expense ${Date.now()}`,
    amount: type === 'simple' ? '25' : '150.50',
    category: type === 'simple' ? 'Food' : 'Bills & Utilities'
  })
}
```

#### 3.3 Focus Areas
1. **Parallel Test Safety**: Ensure all test data is unique
2. **Workflow Enhancement**: Add data generation to existing workflows  
3. **Leave Page Objects**: They work well as-is

**Success Criteria:**
- ✅ All test data guaranteed unique for parallel execution
- ✅ Enhanced workflows for common scenarios
- ✅ Zero changes to working page object pattern

---

### Phase 4: Prevent Regression 🔶 **MEDIUM PRIORITY**
**Timeline: 2 hours | Risk: Low**

#### 4.1 Pre-commit Hook (More Practical than ESLint)
```bash
#!/bin/bash
# Check for new Builder classes outside test-support
if grep -r "class.*Builder" --include="*.ts" --exclude-dir="node_modules" --exclude-dir="packages/test-support" .; then
    echo "ERROR: Found Builder class outside packages/test-support/"
    echo "Move to packages/test-support/builders/ or use existing builders"
    exit 1
fi
```

#### 4.2 Builder Validation Tests
Create test to ensure all builders follow pattern:
```typescript
describe('Builder Pattern Validation', () => {
  it('should have build() method', () => {
    // Test all exported builders have build() method
  });
  
  it('should return new instance on build()', () => {
    // Ensure immutability
  });
});
```

**Success Criteria:**
- ✅ Pre-commit hook prevents new ad-hoc builders
- ✅ Validation tests ensure consistent patterns

---

## REMOVED PHASES

**Phase 5 & 6 were theoretical fluff. Focus on Phases 1-4.**

---

## Success Metrics

### Quantitative Targets  
- ✅ Zero ad-hoc builders in test files (currently 7)
- ✅ Replace 10+ manual UserBalance objects in debtSimplifier.test.ts
- ✅ Pre-commit hook preventing regression

### Verification
1. **After Each Phase:** Run full test suite
2. **Phase 1:** Check imports work correctly  
3. **Phase 2:** All debt scenarios use builders
4. **Phase 4:** Pre-commit hook catches violations

---

## Risk Mitigation

### High-Risk Areas
- **Test breakage** during extraction
- **Import path issues** after moves
- **Inheritance breakage** (FirestoreExpenseBuilder extends ExpenseBuilder)

### Mitigation
- One builder extraction at a time  
- Run tests after EACH extraction
- Git branch per phase
- Keep original test logic unchanged

## Immediate Next Steps

1. Create branch `refactor/builder-consolidation`
2. Start with Phase 1.1 - extract MockGroupBuilder (simplest)
3. Verify tests pass before continuing  
4. Get team review after Phase 1 complete