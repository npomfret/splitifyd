# Builder Pattern Consolidation - Revised Implementation Plan

## Executive Summary

After failed first attempt, this plan focuses on small, atomic changes with intelligent testing and clear rollback points.

**What Went Wrong:**
- Too many changes at once (8 files modified)
- Fixed unrelated failing tests (scope creep)
- Type mismatches caused cascading failures
- No incremental commits for rollback
- Full test suite runs took too long

**New Approach:**
- One builder at a time with immediate testing
- Commit after each successful extraction
- Test only affected files, not entire suite
- Handle type dependencies first
- Stay focused - no unrelated fixes

**Current State:**
- 9 builders in `packages/test-support/builders`
- 7 ad-hoc builders scattered across test files
- Manual object creation in `debtSimplifier.test.ts`
- Reset to clean state, ready to start

---

## Implementation Strategy

### Key Principles
1. **Atomic changes** - One builder extraction per step
2. **Smart testing** - Run only affected test files
3. **Immediate commits** - Create rollback points after each success
4. **Type safety first** - Resolve interface conflicts before moving code
5. **Stay focused** - Don't fix unrelated test failures

### Testing Strategy
**Critical**: For each step, run ONLY the specific test files affected by that builder:

- **MockGroupBuilder**: `npm test balanceCalculator.test.ts`
- **CommentRequestBuilder**: `npm test comments-validation.test.ts`
- **FirestoreExpenseBuilder**: `npm test balanceCalculator.test.ts`
- **UserBalanceBuilder**: `npm test debtSimplifier.test.ts`

**Never run full test suite** - it takes too long and includes unrelated failures.

---

## Implementation Phases

### Phase 0: Prepare and Reset (15 min)
**Goal**: Clean slate with proper branch setup

1. **Verify clean state**: `git status` should show no changes
2. **Create branch**: `git checkout -b refactor/builder-consolidation-v2`
3. **Document current builders**: Quick scan of existing ad-hoc builders
4. **Choose first target**: Start with simplest (MockGroupBuilder)

---

### Phase 1: Simple Builders (2 hours)
**Goal**: Extract builders with no dependencies

#### Step 1.1: MockGroupBuilder (30 min)
- **Extract from**: `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts` 
- **Why first**: No inheritance, no external types, standalone
- **Test command**: `cd firebase/functions && npm test balanceCalculator.test.ts`
- **Success criteria**: Test passes, builder accessible from test-support
- **Commit message**: "extract MockGroupBuilder from balanceCalculator test"

#### Step 1.2: CommentRequestBuilder (30 min)
- **Extract from**: `firebase/functions/src/__tests__/unit/comments-validation.test.ts`
- **Why next**: Simple fluent interface, no dependencies
- **Test command**: `cd firebase/functions && npm test comments-validation.test.ts`
- **Success criteria**: Test passes, builder accessible from test-support
- **Commit message**: "extract CommentRequestBuilder from comments validation test"

#### Step 1.3: MockFirestoreBuilder (30 min)
- **Extract from**: `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts`
- **Why next**: Utility class, no complex dependencies
- **Test command**: `cd firebase/functions && npm test balanceCalculator.test.ts`
- **Success criteria**: Test passes, builder accessible from test-support
- **Commit message**: "extract MockFirestoreBuilder from balanceCalculator test"

#### Step 1.4: CommentQueryBuilder (30 min)
- **Extract from**: `firebase/functions/src/__tests__/unit/comments-validation.test.ts`
- **Rename from**: QueryBuilder (to avoid conflicts)
- **Test command**: `cd firebase/functions && npm test comments-validation.test.ts`
- **Success criteria**: Test passes, builder accessible from test-support
- **Commit message**: "extract CommentQueryBuilder from comments validation test"

---

### Phase 2: Type-Dependent Builders (1.5 hours)
**Goal**: Handle builders that need type coordination

#### Step 2.1: Resolve UserProfile Interface (45 min)
- **Problem**: UserProfile interface differs between packages
- **Solution**: Import from functions package, don't duplicate
- **Files to check**: 
  - `firebase/functions/src/services/UserService2.ts` (source of truth)
  - `packages/test-support/builders/UserProfileBuilder.ts` (needs to import)
- **Test command**: `cd firebase/functions && npx tsc --noEmit`
- **Success criteria**: TypeScript compiles without errors
- **Commit message**: "align UserProfile interface in test-support with functions"

#### Step 2.2: UserProfileBuilder (45 min)
- **Extract from**: `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts`
- **Dependencies**: Uses UserProfile interface (resolved in 2.1)
- **Test command**: `cd firebase/functions && npm test balanceCalculator.test.ts`
- **Success criteria**: Test passes, no TypeScript errors
- **Commit message**: "extract UserProfileBuilder from balanceCalculator test"

---

### Phase 3: Inheritance Builders (2 hours)
**Goal**: Handle builders that extend existing ones

#### Step 3.1: FirestoreExpenseBuilder (1 hour)
- **Extract from**: `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts`
- **Extends**: ExpenseBuilder from test-support
- **Challenge**: Must verify ExpenseBuilder is available
- **Test command**: `cd firebase/functions && npm test balanceCalculator.test.ts`
- **Success criteria**: Test passes, inheritance works correctly
- **Commit message**: "extract FirestoreExpenseBuilder extending ExpenseBuilder"

#### Step 3.2: FirestoreSettlementBuilder (1 hour)
- **Extract from**: `firebase/functions/src/__tests__/unit/balanceCalculator.test.ts`
- **Extends**: SettlementBuilder from test-support
- **Challenge**: Same as above, verify inheritance
- **Test command**: `cd firebase/functions && npm test balanceCalculator.test.ts`
- **Success criteria**: Test passes, inheritance works correctly
- **Commit message**: "extract FirestoreSettlementBuilder extending SettlementBuilder"

---

### Phase 4: UserBalance Consolidation (2 hours)
**Goal**: Replace manual UserBalance objects with builder pattern

#### Step 4.1: Create UserBalanceBuilder (30 min)
- **Create new**: `packages/test-support/builders/UserBalanceBuilder.ts`
- **No extraction**: This is new functionality
- **Test command**: Create simple test to verify builder works
- **Success criteria**: Builder creates valid UserBalance objects
- **Commit message**: "add UserBalanceBuilder for debt test scenarios"

#### Step 4.2: Create DebtScenarios Factory (30 min)
- **Create new**: Add factory to UserBalanceBuilder.ts
- **Purpose**: Pre-built common debt test scenarios
- **Test command**: Verify factory produces expected objects
- **Success criteria**: All debt scenarios generate valid balances
- **Commit message**: "add DebtScenarios factory with common patterns"

#### Step 4.3: Update debtSimplifier Tests - Phase 1 (30 min)
- **Replace**: First 5 manual UserBalance objects
- **Strategy**: One test at a time, verify each works
- **Test command**: `cd firebase/functions && npm test debtSimplifier.test.ts`
- **Success criteria**: All debt tests still pass
- **Commit message**: "replace first 5 manual UserBalance objects with DebtScenarios"

#### Step 4.4: Update debtSimplifier Tests - Phase 2 (30 min)
- **Replace**: Remaining manual UserBalance objects
- **Strategy**: Continue one test at a time
- **Test command**: `cd firebase/functions && npm test debtSimplifier.test.ts`
- **Success criteria**: All debt tests still pass, zero manual objects
- **Commit message**: "complete UserBalance replacement with builder pattern"

---

### Phase 5: Documentation and Cleanup (30 min)
**Goal**: Document what was accomplished

#### Step 5.1: Update Analysis Document (15 min)
- **Update**: This file with actual results
- **Document**: What worked, what didn't, lessons learned
- **Commit message**: "update builder consolidation documentation"

#### Step 5.2: Create Builder Usage Guide (15 min)
- **Create**: `packages/test-support/BUILDERS.md`
- **Content**: List all builders, usage examples, patterns
- **Commit message**: "add comprehensive builder usage documentation"

---

## Rollback Strategy

### If Any Step Fails:
1. **Check error**: Is it related to the specific builder?
2. **Quick fix**: If obvious (import, typo), fix immediately
3. **If stuck**: `git reset --hard HEAD` and skip this builder
4. **Document**: Add to "skipped items" list for future investigation
5. **Continue**: Move to next builder in sequence

### Emergency Reset:
```bash
git checkout main
git branch -D refactor/builder-consolidation-v2
# Start over with different approach
```

---

## Success Metrics

### Immediate Success (Per Step):
- ✅ Single builder extracted successfully
- ✅ Only affected test passes
- ✅ TypeScript compiles without errors
- ✅ Changes committed to git

### Overall Success (End of Project):
- ✅ 7 ad-hoc builders moved to test-support
- ✅ All original tests still pass
- ✅ UserBalance manual objects eliminated
- ✅ Clear rollback points throughout process

### What We're NOT Doing:
- ❌ Fixing unrelated test failures
- ❌ Running full test suites
- ❌ Modifying webapp-v2 tests
- ❌ Creating TestDataGenerator (separate task)
- ❌ Setting up pre-commit hooks

---

## Time Estimates

**Total: ~8 hours over multiple sessions**
- Phase 0: 15 min (reset/prepare)
- Phase 1: 2 hours (simple builders)
- Phase 2: 1.5 hours (type dependencies)
- Phase 3: 2 hours (inheritance builders)
- Phase 4: 2 hours (UserBalance consolidation)
- Phase 5: 30 min (documentation)

**Can pause after any commit** - each phase is independent and valuable on its own.