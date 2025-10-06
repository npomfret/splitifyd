# Implementation Plan: Incremental Balance Architecture

## Executive Summary

Replace on-the-fly balance calculations (O(N) where N = transaction count) with pre-computed, incrementally-updated balances stored in Firestore (O(1) reads).

**Current Problem**: Groups with 2000+ transactions trigger 4+ database queries and take 800ms+ to load
**Target Solution**: All groups load in <200ms regardless of transaction count

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Current Architecture (SLOW but CORRECT)                     │
│ ✅ Pagination fix ensures correctness                       │
│ ❌ Every balance read = full recalculation                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ New Architecture (FAST and CORRECT)                         │
│ ✅ Pre-computed balances in Firestore                       │
│ ✅ Incremental atomic updates on every transaction          │
│ ✅ O(1) balance reads                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Schema & Type System

### 1.1. Create GroupBalance Firestore Schema

**File**: `firebase/functions/src/schemas/group-balance.ts`

```typescript
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Schema for the UserBalance map within GroupBalance
 * Tracks per-user balance state across all currencies
 */
export const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.number()), // userId -> amount
    owedBy: z.record(z.string(), z.number()), // userId -> amount
    netBalance: z.number(),
});

/**
 * Schema for CurrencyBalances - record of userId to UserBalance
 */
export const CurrencyBalancesSchema = z.record(
    z.string(), // userId
    UserBalanceSchema
);

/**
 * Firestore Document Schema for GroupBalance
 * Stored at: groups/{groupId}/metadata/balance
 */
export const GroupBalanceDocumentSchema = z.object({
    groupId: z.string(),

    // Balance state by currency
    // balancesByCurrency[currency][userId] = UserBalance
    balancesByCurrency: z.record(z.string(), CurrencyBalancesSchema),

    // Simplified debts for display (computed from balancesByCurrency)
    simplifiedDebts: z.array(z.object({
        from: z.object({ uid: z.string() }),
        to: z.object({ uid: z.string() }),
        amount: z.number(),
        currency: z.string(),
    })),

    // Metadata
    lastUpdatedAt: z.instanceof(Timestamp),
    version: z.number(),
});

/**
 * DTO Schema for GroupBalance (ISO strings for application layer)
 */
export const GroupBalanceDTOSchema = GroupBalanceDocumentSchema.extend({
    lastUpdatedAt: z.string().datetime(),
});

export type GroupBalanceDocument = z.infer<typeof GroupBalanceDocumentSchema>;
export type GroupBalanceDTO = z.infer<typeof GroupBalanceDTOSchema>;
```

**Key Design Decisions**:
- Store at `groups/{groupId}/metadata/balance` for logical grouping
- Use same `balancesByCurrency` structure as current `BalanceCalculationResult` for compatibility
- Include `version` field for future schema evolution
- Include `simplifiedDebts` for efficient API responses

---

## Phase 2: Firestore I/O Layer

### 2.1. Add FirestoreReader Methods

**File**: `firebase/functions/src/services/firestore/IFirestoreReader.ts`

```typescript
/**
 * Get pre-computed balance for a group
 * @param groupId - The group ID
 * @returns GroupBalanceDTO
 * @throws ApiError if balance not found or read fails
 */
getGroupBalance(groupId: string): Promise<GroupBalanceDTO>;
```

**File**: `firebase/functions/src/services/firestore/FirestoreReader.ts`

```typescript
async getGroupBalance(groupId: string): Promise<GroupBalanceDTO> {
    const doc = await this.db
        .collection(FirestoreCollections.GROUPS)
        .doc(groupId)
        .collection('metadata')
        .doc('balance')
        .get();

    if (!doc.exists) {
        throw new ApiError(
            HTTP_STATUS.INTERNAL_ERROR,
            'BALANCE_NOT_FOUND',
            `Balance not found for group ${groupId}`
        );
    }

    const data = doc.data();
    if (!data) {
        throw new ApiError(
            HTTP_STATUS.INTERNAL_ERROR,
            'BALANCE_READ_ERROR',
            'Balance document is empty'
        );
    }

    // Validate with Firestore schema
    const validated = GroupBalanceDocumentSchema.parse(data);

    // Convert to DTO (Timestamps → ISO strings)
    return {
        ...validated,
        lastUpdatedAt: validated.lastUpdatedAt.toDate().toISOString(),
    };
}
```

### 2.2. Add FirestoreWriter Methods

**File**: `firebase/functions/src/services/firestore/IFirestoreWriter.ts`

```typescript
/**
 * Create or replace group balance document
 * Used when creating a new group
 */
setGroupBalance(groupId: string, balance: GroupBalanceDTO): Promise<void>;

/**
 * Atomically update group balance within a transaction
 * Used for incremental updates when expenses/settlements change
 */
updateGroupBalanceInTransaction(
    transaction: Transaction,
    groupId: string,
    updater: (current: GroupBalanceDTO) => GroupBalanceDTO
): Promise<void>;
```

**File**: `firebase/functions/src/services/firestore/FirestoreWriter.ts`

```typescript
async setGroupBalance(groupId: string, balance: GroupBalanceDTO): Promise<void> {
    const balanceRef = this.db
        .collection(FirestoreCollections.GROUPS)
        .doc(groupId)
        .collection('metadata')
        .doc('balance');

    // Convert DTO to Firestore document (ISO strings → Timestamps)
    const docData: GroupBalanceDocument = {
        ...balance,
        lastUpdatedAt: Timestamp.now(),
    };

    await balanceRef.set(docData);
}

async updateGroupBalanceInTransaction(
    transaction: Transaction,
    groupId: string,
    updater: (current: GroupBalanceDTO) => GroupBalanceDTO
): Promise<void> {
    const balanceRef = this.db
        .collection(FirestoreCollections.GROUPS)
        .doc(groupId)
        .collection('metadata')
        .doc('balance');

    const doc = await transaction.get(balanceRef);

    if (!doc.exists) {
        throw new ApiError(
            HTTP_STATUS.INTERNAL_ERROR,
            'BALANCE_NOT_FOUND',
            `Balance not found for group ${groupId}`
        );
    }

    const data = doc.data();
    if (!data) {
        throw new ApiError(
            HTTP_STATUS.INTERNAL_ERROR,
            'BALANCE_READ_ERROR',
            'Balance document is empty'
        );
    }

    const validated = GroupBalanceDocumentSchema.parse(data);
    const currentBalance: GroupBalanceDTO = {
        ...validated,
        lastUpdatedAt: validated.lastUpdatedAt.toDate().toISOString(),
    };

    // Apply update function
    const newBalance = updater(currentBalance);

    // Convert to Firestore document
    const docData: GroupBalanceDocument = {
        ...newBalance,
        lastUpdatedAt: Timestamp.now(),
    };

    transaction.set(balanceRef, docData);
}
```

---

## Phase 3: Incremental Balance Service

### 3.1. Create IncrementalBalanceService

**File**: `firebase/functions/src/services/balance/IncrementalBalanceService.ts`

```typescript
import { GroupBalanceDTO } from '../../schemas/group-balance';
import { ExpenseDTO, SettlementDTO } from '@splitifyd/shared';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import { DebtSimplificationService } from './DebtSimplificationService';

/**
 * Service for incrementally updating group balances
 * All methods work on balance deltas, never full recalculations
 */
export class IncrementalBalanceService {
    private expenseProcessor = new ExpenseProcessor();
    private settlementProcessor = new SettlementProcessor();
    private debtSimplifier = new DebtSimplificationService();

    /**
     * Apply the impact of a newly created expense to existing balance
     */
    applyExpenseCreated(
        currentBalance: GroupBalanceDTO,
        expense: ExpenseDTO,
        memberIds: string[]
    ): GroupBalanceDTO {
        const deltaBalance = this.expenseProcessor.processExpenses(
            [expense],
            memberIds
        );

        return this.mergeBalances(currentBalance, deltaBalance);
    }

    /**
     * Revert the impact of a deleted expense from existing balance
     */
    applyExpenseDeleted(
        currentBalance: GroupBalanceDTO,
        expense: ExpenseDTO,
        memberIds: string[]
    ): GroupBalanceDTO {
        const deltaBalance = this.expenseProcessor.processExpenses(
            [expense],
            memberIds
        );

        return this.mergeBalances(currentBalance, deltaBalance, 'subtract');
    }

    /**
     * Update balance when an expense is edited
     * Two-step atomic operation: revert old, apply new
     */
    applyExpenseUpdated(
        currentBalance: GroupBalanceDTO,
        oldExpense: ExpenseDTO,
        newExpense: ExpenseDTO,
        memberIds: string[]
    ): GroupBalanceDTO {
        let updatedBalance = this.applyExpenseDeleted(
            currentBalance,
            oldExpense,
            memberIds
        );

        updatedBalance = this.applyExpenseCreated(
            updatedBalance,
            newExpense,
            memberIds
        );

        return updatedBalance;
    }

    /**
     * Apply settlement created
     */
    applySettlementCreated(
        currentBalance: GroupBalanceDTO,
        settlement: SettlementDTO
    ): GroupBalanceDTO {
        const { currency } = settlement;
        const currencyBalance = currentBalance.balancesByCurrency[currency] || {};

        this.settlementProcessor.processSettlements(
            [settlement],
            { [currency]: currencyBalance }
        );

        const simplifiedDebts = this.debtSimplifier.simplifyDebtsForAllCurrencies(
            currentBalance.balancesByCurrency
        );

        return {
            ...currentBalance,
            balancesByCurrency: {
                ...currentBalance.balancesByCurrency,
                [currency]: currencyBalance,
            },
            simplifiedDebts,
            lastUpdatedAt: new Date().toISOString(),
        };
    }

    /**
     * Revert settlement deleted
     */
    applySettlementDeleted(
        currentBalance: GroupBalanceDTO,
        settlement: SettlementDTO
    ): GroupBalanceDTO {
        const inverseSettlement: SettlementDTO = {
            ...settlement,
            payerId: settlement.payeeId,
            payeeId: settlement.payerId,
        };

        return this.applySettlementCreated(currentBalance, inverseSettlement);
    }

    /**
     * Update balance when settlement is edited
     */
    applySettlementUpdated(
        currentBalance: GroupBalanceDTO,
        oldSettlement: SettlementDTO,
        newSettlement: SettlementDTO
    ): GroupBalanceDTO {
        let updated = this.applySettlementDeleted(currentBalance, oldSettlement);
        updated = this.applySettlementCreated(updated, newSettlement);
        return updated;
    }

    /**
     * Merge two balance states (add or subtract)
     */
    private mergeBalances(
        base: GroupBalanceDTO,
        delta: Record<string, Record<string, UserBalance>>,
        operation: 'add' | 'subtract' = 'add'
    ): GroupBalanceDTO {
        const merged = { ...base.balancesByCurrency };
        const multiplier = operation === 'add' ? 1 : -1;

        for (const [currency, deltaUsers] of Object.entries(delta)) {
            if (!merged[currency]) {
                merged[currency] = {};
            }

            for (const [userId, deltaBalance] of Object.entries(deltaUsers)) {
                const current = merged[currency][userId] || {
                    uid: userId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };

                // Merge owes
                for (const [ownedUserId, amount] of Object.entries(deltaBalance.owes)) {
                    const currentAmount = current.owes[ownedUserId] || 0;
                    current.owes[ownedUserId] = currentAmount + (amount * multiplier);

                    if (Math.abs(current.owes[ownedUserId]) < 0.01) {
                        delete current.owes[ownedUserId];
                    }
                }

                // Merge owedBy
                for (const [owingUserId, amount] of Object.entries(deltaBalance.owedBy)) {
                    const currentAmount = current.owedBy[owingUserId] || 0;
                    current.owedBy[owingUserId] = currentAmount + (amount * multiplier);

                    if (Math.abs(current.owedBy[owingUserId]) < 0.01) {
                        delete current.owedBy[owingUserId];
                    }
                }

                // Update net balance
                current.netBalance = current.netBalance + (deltaBalance.netBalance * multiplier);

                merged[currency][userId] = current;
            }
        }

        // Recalculate simplified debts
        const simplifiedDebts = this.debtSimplifier.simplifyDebtsForAllCurrencies(merged);

        return {
            groupId: base.groupId,
            balancesByCurrency: merged,
            simplifiedDebts,
            lastUpdatedAt: new Date().toISOString(),
            version: base.version,
        };
    }
}
```

---

## Phase 4: Service Integration

### 4.1. Update ExpenseService

**Changes to**: `firebase/functions/src/services/ExpenseService.ts`

```typescript
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';

export class ExpenseService {
    private incrementalBalanceService = new IncrementalBalanceService();

    async createExpense(
        groupId: string,
        requestData: CreateExpenseRequest,
        userId: string
    ): Promise<ExpenseDTO> {
        // ... existing validation logic ...

        const expense = await this.firestoreWriter.runTransaction(async (transaction) => {
            // 1. Create expense document
            const expenseId = // ... generate ID
            const expenseData = // ... build expense data
            transaction.set(expenseRef, expenseData);

            // 2. Update group balance atomically
            const memberIds = // ... get from group
            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                groupId,
                (currentBalance) => {
                    return this.incrementalBalanceService.applyExpenseCreated(
                        currentBalance,
                        expenseData,
                        memberIds
                    );
                }
            );

            return expenseData;
        });

        return expense;
    }

    async updateExpense(
        expenseId: string,
        updates: UpdateExpenseRequest,
        userId: string
    ): Promise<ExpenseDTO> {
        const oldExpense = await this.fetchExpense(expenseId);

        // ... validation ...

        const updated = await this.firestoreWriter.runTransaction(async (transaction) => {
            // 1. Update expense document
            transaction.update(expenseRef, updateData);

            // 2. Update group balance atomically
            const memberIds = // ... get from group
            const newExpense = { ...oldExpense, ...updateData };

            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                oldExpense.groupId,
                (currentBalance) => {
                    return this.incrementalBalanceService.applyExpenseUpdated(
                        currentBalance,
                        oldExpense,
                        newExpense,
                        memberIds
                    );
                }
            );

            return newExpense;
        });

        return updated;
    }

    async deleteExpense(expenseId: string, userId: string): Promise<void> {
        const expense = await this.fetchExpense(expenseId);

        await this.firestoreWriter.runTransaction(async (transaction) => {
            // 1. Soft-delete expense
            transaction.update(expenseRef, {
                deletedAt: Timestamp.now(),
                deletedBy: userId,
            });

            // 2. Update group balance atomically
            const memberIds = // ... get from group
            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                expense.groupId,
                (currentBalance) => {
                    return this.incrementalBalanceService.applyExpenseDeleted(
                        currentBalance,
                        expense,
                        memberIds
                    );
                }
            );
        });
    }
}
```

### 4.2. Update SettlementService

**Changes to**: `firebase/functions/src/services/SettlementService.ts`

Similar pattern to ExpenseService - wrap create/update/delete in transactions with balance updates.

### 4.3. Update GroupService - Initialize Balance on Group Creation

**Changes to**: `firebase/functions/src/services/GroupService.ts`

```typescript
async createGroup(
    requestData: CreateGroupRequest,
    userId: string
): Promise<GroupDTO> {
    // ... existing validation and group creation logic ...

    // Initialize empty balance document
    const initialBalance: GroupBalanceDTO = {
        groupId: newGroupId,
        balancesByCurrency: {},
        simplifiedDebts: [],
        lastUpdatedAt: new Date().toISOString(),
        version: 1,
    };

    await this.firestoreWriter.setGroupBalance(newGroupId, initialBalance);

    return newGroup;
}
```

---

## Phase 5: Update API Layer

### 5.1. Update GroupService.addComputedFields

**File**: `firebase/functions/src/services/GroupService.ts`

```typescript
private async addComputedFields(group: GroupDTO, userId: string): Promise<GroupDTO> {
    // Read pre-computed balance
    const groupBalances = await this.firestoreReader.getGroupBalance(group.id);

    // ... rest of existing logic using groupBalances ...
    // (calculate balancesByCurrency for user, format lastActivity, etc.)
}
```

**Delete**: Remove `BalanceCalculationService` - no longer needed.

---

## Phase 6: Testing Strategy

### 6.1. Unit Tests

**File**: `firebase/functions/src/__tests__/unit/services/IncrementalBalanceService.test.ts`

```typescript
describe('IncrementalBalanceService', () => {
    describe('applyExpenseCreated', () => {
        it('should add expense impact to empty balance', () => {
            // Test delta application
        });

        it('should merge expense impact into existing balance', () => {
            // Test incremental update
        });

        it('should handle multi-currency balances', () => {
            // Test currency isolation
        });
    });

    describe('applyExpenseUpdated', () => {
        it('should revert old expense and apply new expense atomically', () => {
            // Test two-step update
        });

        it('should handle amount changes correctly', () => {
            // Test edge case
        });

        it('should handle split changes correctly', () => {
            // Test complex scenario
        });
    });

    describe('applySettlementCreated', () => {
        // Similar tests for settlements
    });
});
```

### 6.2. Integration Tests

**File**: `firebase/functions/src/__tests__/integration/incremental-balance.test.ts`

```typescript
describe('Incremental Balance Integration', () => {
    it('should initialize balance on group creation', async () => {
        const groupId = await createTestGroup();
        const balance = await firestoreReader.getGroupBalance(groupId);

        expect(balance).toBeDefined();
        expect(balance.balancesByCurrency).toEqual({});
        expect(balance.simplifiedDebts).toEqual([]);
    });

    it('should maintain balance consistency through expense lifecycle', async () => {
        // 1. Create group with initial balance
        const groupId = await createTestGroup();

        // 2. Create expense - balance should update atomically
        const expense = await expenseService.createExpense(groupId, expenseData, userId);

        // 3. Verify balance updated correctly
        const balance = await firestoreReader.getGroupBalance(groupId);
        expect(balance.balancesByCurrency).toMatchSnapshot();
    });

    it('should handle concurrent expense creates correctly', async () => {
        // Test race condition handling with transactions
    });

    it('should maintain consistency through complex operations', async () => {
        // Create, update, delete expenses
        // Create, update, delete settlements
        // Verify balance consistency at each step
    });
});
```

### 6.3. E2E Test Verification

Run existing e2e tests with new architecture:
```bash
cd e2e-tests
PLAYWRIGHT_HTML_OPEN=never ./run-until-fail.sh 3
```

All tests should pass without modification (API contract unchanged).

---

## Phase 7: Deployment

### 7.1. Deployment Steps

1. **Deploy new code**
   - All groups will automatically get balance initialized on creation
   - Existing groups don't exist (new project)

2. **Monitor performance**
   - Check API latency metrics for `_executeListGroups`
   - Monitor error rates for balance updates
   - Verify incremental updates are atomic

---

## Phase 8: Monitoring & Observability

### 8.1. Metrics to Track

```typescript
// Add to monitoring/measure.ts
export const balanceMetrics = {
    precomputedReads: 0,     // Reads from pre-computed balance
    incrementalUpdates: 0,   // Successful incremental updates
    updateFailures: 0,       // Failed incremental updates
};
```

### 8.2. Alerts

- **Alert**: If `updateFailures` > 0 (critical - balance consistency issue)
- **Alert**: If `_executeListGroups` latency > 500ms (p95)

---

## Success Criteria

- [ ] API latency for `_executeListGroups` < 200ms (p95)
- [ ] Creating/updating/deleting expenses updates balance atomically
- [ ] Creating/updating/deleting settlements updates balance atomically
- [ ] All unit tests pass
- [ ] All e2e tests pass
- [ ] Zero `updateFailures` in monitoring
- [ ] New groups automatically get initialized balance

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Race conditions in concurrent updates** | Use Firestore transactions for atomicity |
| **Incremental logic bugs** | Extensive unit tests + consistency checks |
| **Performance regression** | Monitor latency, rollback if needed |
| **Data corruption** | Firestore transactions prevent partial updates |

---

## Estimated Timeline

| Phase | Effort | Duration |
|-------|--------|----------|
| Schema & Types | Small | 1-2 hours |
| Firestore I/O | Small | 2-3 hours |
| IncrementalBalanceService | Medium | 4-6 hours |
| Service Integration | Medium | 3-4 hours |
| API Layer Updates | Small | 1-2 hours |
| Unit Tests | Medium | 4-5 hours |
| Integration Tests | Medium | 3-4 hours |
| E2E Verification | Small | 1 hour |
| **Total** | **~20-28 hours** | **3-4 days** |

---

## Next Steps

1. Review this plan for accuracy and completeness
2. Confirm architectural approach
3. Begin Phase 1: Schema & Type System
4. Implement incrementally, testing at each phase
5. Deploy and monitor
