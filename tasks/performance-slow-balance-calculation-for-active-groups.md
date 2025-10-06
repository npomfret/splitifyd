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
    lastUpdatedAt: z.instanceof(Timestamp), // Firestore Timestamp
    version: z.number(), // For migration/schema versioning
});

/**
 * DTO Schema for GroupBalance (ISO strings for application layer)
 */
export const GroupBalanceDTOSchema = GroupBalanceDocumentSchema.extend({
    lastUpdatedAt: z.string().datetime(), // ISO string
});

export type GroupBalanceDocument = z.infer<typeof GroupBalanceDocumentSchema>;
export type GroupBalanceDTO = z.infer<typeof GroupBalanceDTOSchema>;
```

**Key Design Decisions**:
- Store at `groups/{groupId}/metadata/balance` for logical grouping
- Use same `balancesByCurrency` structure as current `BalanceCalculationResult` for compatibility
- Include `version` field for future schema migrations
- Include `simplifiedDebts` for efficient API responses

---

## Phase 2: Firestore I/O Layer

### 2.1. Add FirestoreReader Methods

**File**: `firebase/functions/src/services/firestore/IFirestoreReader.ts`

```typescript
/**
 * Get pre-computed balance for a group
 * @param groupId - The group ID
 * @returns GroupBalanceDTO or null if not yet computed
 */
getGroupBalance(groupId: string): Promise<GroupBalanceDTO | null>;
```

**File**: `firebase/functions/src/services/firestore/FirestoreReader.ts`

```typescript
async getGroupBalance(groupId: string): Promise<GroupBalanceDTO | null> {
    try {
        const doc = await this.db
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('metadata')
            .doc('balance')
            .get();

        if (!doc.exists) {
            return null;
        }

        const data = doc.data();
        if (!data) {
            return null;
        }

        // Validate with Firestore schema
        const validated = GroupBalanceDocumentSchema.parse(data);

        // Convert to DTO (Timestamps → ISO strings)
        return {
            ...validated,
            lastUpdatedAt: validated.lastUpdatedAt.toDate().toISOString(),
        };
    } catch (error) {
        logger.error('Failed to get group balance', error, { groupId });
        throw new ApiError(
            HTTP_STATUS.INTERNAL_ERROR,
            'BALANCE_READ_ERROR',
            'Failed to read group balance'
        );
    }
}
```

### 2.2. Add FirestoreWriter Methods

**File**: `firebase/functions/src/services/firestore/IFirestoreWriter.ts`

```typescript
/**
 * Create or replace group balance document
 * Used for initial backfill and full recalculations
 */
setGroupBalance(groupId: string, balance: GroupBalanceDTO): Promise<void>;

/**
 * Atomically update group balance within a transaction
 * Used for incremental updates when expenses/settlements change
 */
updateGroupBalanceInTransaction(
    transaction: Transaction,
    groupId: string,
    updater: (current: GroupBalanceDTO | null) => GroupBalanceDTO
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
    updater: (current: GroupBalanceDTO | null) => GroupBalanceDTO
): Promise<void> {
    const balanceRef = this.db
        .collection(FirestoreCollections.GROUPS)
        .doc(groupId)
        .collection('metadata')
        .doc('balance');

    const doc = await transaction.get(balanceRef);

    let currentBalance: GroupBalanceDTO | null = null;
    if (doc.exists) {
        const data = doc.data();
        if (data) {
            const validated = GroupBalanceDocumentSchema.parse(data);
            currentBalance = {
                ...validated,
                lastUpdatedAt: validated.lastUpdatedAt.toDate().toISOString(),
            };
        }
    }

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
        // Create delta balance from this single expense
        const deltaBalance = this.expenseProcessor.processExpenses(
            [expense],
            memberIds
        );

        // Merge delta into current balance
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
        // Create delta balance from this expense
        const deltaBalance = this.expenseProcessor.processExpenses(
            [expense],
            memberIds
        );

        // Subtract delta from current balance (revert it)
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
        // Step 1: Revert old expense impact
        let updatedBalance = this.applyExpenseDeleted(
            currentBalance,
            oldExpense,
            memberIds
        );

        // Step 2: Apply new expense impact
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

        // Get or create currency balance
        const currencyBalance = currentBalance.balancesByCurrency[currency] || {};

        // Apply settlement to currency balance
        this.settlementProcessor.processSettlements(
            [settlement],
            { [currency]: currencyBalance }
        );

        // Recalculate simplified debts for this currency
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
        // Create inverse settlement (swap payer/payee)
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

                    // Clean up zero balances
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

        // Perform in transaction for atomicity
        const expense = await this.firestoreWriter.runTransaction(async (transaction) => {
            // 1. Create expense document
            const expenseId = // ... generate ID
            const expenseData = // ... build expense data
            transaction.set(expenseRef, expenseData);

            // 2. Update group balance atomically
            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                groupId,
                (currentBalance) => {
                    if (!currentBalance) {
                        // Balance not initialized yet - skip update
                        // This can happen during migration period
                        logger.warn('Group balance not initialized', { groupId });
                        return null;
                    }

                    const memberIds = // ... get from group
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
            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                oldExpense.groupId,
                (currentBalance) => {
                    if (!currentBalance) return null;

                    const memberIds = // ... get from group
                    const newExpense = { ...oldExpense, ...updateData };

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
            await this.firestoreWriter.updateGroupBalanceInTransaction(
                transaction,
                expense.groupId,
                (currentBalance) => {
                    if (!currentBalance) return null;

                    const memberIds = // ... get from group
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

---

## Phase 5: Backfill Script

### 5.1. Create Backfill Script

**File**: `firebase/functions/scripts/backfill-group-balances.ts`

```typescript
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreReader } from '../src/services/firestore/FirestoreReader';
import { FirestoreWriter } from '../src/services/firestore/FirestoreWriter';
import { BalanceCalculationService } from '../src/services/balance/BalanceCalculationService';
import { UserService } from '../src/services/UserService2';
import { logger } from '../src/logger';

/**
 * Backfill script to populate GroupBalance documents for all existing groups
 *
 * Usage:
 *   npx tsx scripts/backfill-group-balances.ts [--dry-run]
 */
async function backfillGroupBalances(dryRun: boolean = false) {
    const app = initializeApp();
    const db = getFirestore(app);

    const reader = new FirestoreReader(db);
    const writer = new FirestoreWriter(db);
    const userService = new UserService(reader, writer);
    const balanceService = new BalanceCalculationService(reader, userService);

    logger.info('Starting group balance backfill', { dryRun });

    // Get all groups
    const groupsSnapshot = await db.collection('groups').get();
    const totalGroups = groupsSnapshot.size;

    logger.info(`Found ${totalGroups} groups to process`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;
        processed++;

        try {
            // Check if balance already exists
            const existingBalance = await reader.getGroupBalance(groupId);
            if (existingBalance) {
                logger.info(`[${processed}/${totalGroups}] Skipping ${groupId} - balance already exists`);
                skipped++;
                continue;
            }

            // Calculate full balance using current (correct) logic
            logger.info(`[${processed}/${totalGroups}] Calculating balance for ${groupId}`);
            const balance = await balanceService.calculateGroupBalances(groupId);

            if (!dryRun) {
                // Store balance document
                await writer.setGroupBalance(groupId, {
                    ...balance,
                    version: 1,
                });
                logger.info(`[${processed}/${totalGroups}] ✅ Created balance for ${groupId}`);
            } else {
                logger.info(`[${processed}/${totalGroups}] [DRY RUN] Would create balance for ${groupId}`);
            }

        } catch (error) {
            logger.error(`[${processed}/${totalGroups}] ❌ Failed to process ${groupId}`, error);
            errors++;
        }
    }

    logger.info('Backfill complete', {
        total: totalGroups,
        processed,
        skipped,
        errors,
        dryRun,
    });
}

// Parse command line args
const dryRun = process.argv.includes('--dry-run');

backfillGroupBalances(dryRun)
    .then(() => process.exit(0))
    .catch((error) => {
        logger.error('Backfill script failed', error);
        process.exit(1);
    });
```

**Add to package.json**:
```json
{
  "scripts": {
    "backfill:balances": "npx tsx scripts/backfill-group-balances.ts",
    "backfill:balances:dry-run": "npx tsx scripts/backfill-group-balances.ts --dry-run"
  }
}
```

---

## Phase 6: Update API Layer

### 6.1. Update GroupService.addComputedFields

**File**: `firebase/functions/src/services/GroupService.ts`

```typescript
private async addComputedFields(group: GroupDTO, userId: string): Promise<GroupDTO> {
    // TRY to read pre-computed balance first
    let groupBalances = await this.firestoreReader.getGroupBalance(group.id);

    if (!groupBalances) {
        // FALLBACK: Calculate on-the-fly during migration period
        logger.warn('Group balance not pre-computed - falling back to calculation', {
            groupId: group.id,
        });
        groupBalances = await this.balanceService.calculateGroupBalances(group.id);

        // Asynchronously create balance document for next time (fire-and-forget)
        this.firestoreWriter.setGroupBalance(group.id, {
            ...groupBalances,
            version: 1,
        }).catch((error) => {
            logger.error('Failed to cache calculated balance', error, {
                groupId: group.id,
            });
        });
    }

    // ... rest of existing logic using groupBalances ...
    // (calculate balancesByCurrency for user, format lastActivity, etc.)
}
```

**Migration Strategy**:
1. Initially, fall back to calculation if balance missing
2. After backfill completes, all groups will have pre-computed balances
3. In a future release, remove fallback and make it an error

---

## Phase 7: Testing Strategy

### 7.1. Unit Tests

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

### 7.2. Integration Tests

**File**: `firebase/functions/src/__tests__/integration/incremental-balance.test.ts`

```typescript
describe('Incremental Balance Integration', () => {
    it('should maintain balance consistency through expense lifecycle', async () => {
        // 1. Create group
        const groupId = await createTestGroup();

        // 2. Backfill initial balance
        const initialBalance = await balanceService.calculateGroupBalances(groupId);
        await firestoreWriter.setGroupBalance(groupId, initialBalance);

        // 3. Create expense - balance should update atomically
        const expense = await expenseService.createExpense(groupId, expenseData, userId);

        // 4. Verify incremental balance matches full calculation
        const incrementalBalance = await firestoreReader.getGroupBalance(groupId);
        const fullBalance = await balanceService.calculateGroupBalances(groupId);

        expect(incrementalBalance).toMatchObject(fullBalance);
    });

    it('should handle concurrent expense creates correctly', async () => {
        // Test race condition handling with transactions
    });

    it('should maintain consistency through complex operations', async () => {
        // Create, update, delete expenses
        // Create, update, delete settlements
        // Verify incremental always matches full calculation
    });
});
```

### 7.3. E2E Test Verification

Run existing e2e tests with new architecture:
```bash
cd e2e-tests
PLAYWRIGHT_HTML_OPEN=never ./run-until-fail.sh 3
```

All tests should pass without modification (API contract unchanged).

---

## Phase 8: Deployment Strategy

### 8.1. Migration Phases

**Phase A: Deploy Code (Backwards Compatible)**
- Deploy all new code with fallback logic
- GroupService falls back to calculation if balance missing
- ExpenseService/SettlementService update balances if they exist

**Phase B: Run Backfill**
```bash
# Dry run first
npm run backfill:balances:dry-run

# Actual backfill
npm run backfill:balances
```

**Phase C: Monitor Performance**
- Check API latency metrics for `_executeListGroups`
- Verify balance calculations are now rare (only on fallback)
- Monitor error rates for balance updates

**Phase D: Remove Fallback (Future Release)**
- After confirming all groups have balances
- Make missing balance an error instead of fallback
- Delete old on-the-fly calculation code paths

---

## Phase 9: Monitoring & Observability

### 9.1. Metrics to Track

```typescript
// Add to monitoring/measure.ts
export const balanceMetrics = {
    precomputedReads: 0,     // Reads from pre-computed balance
    fallbackCalculations: 0, // Fallback to on-the-fly calculation
    incrementalUpdates: 0,   // Successful incremental updates
    updateFailures: 0,       // Failed incremental updates
};
```

### 9.2. Alerts

- **Alert**: If `fallbackCalculations` > 10/minute after backfill
- **Alert**: If `updateFailures` > 0 (critical - balance consistency issue)
- **Alert**: If `_executeListGroups` latency > 500ms (p95)

---

## Phase 10: Rollback Plan

If issues arise:

1. **Immediate**: Disable incremental updates in ExpenseService/SettlementService
2. **Quick**: Remove balance read logic, fall back to full calculation
3. **Complete**: Revert entire commit, deploy previous version

All operations are non-destructive:
- New balance documents are separate from existing data
- Original calculation logic remains intact during migration
- Firestore transactions ensure atomicity

---

## Success Criteria

- [ ] All groups have `GroupBalance` documents after backfill
- [ ] API latency for `_executeListGroups` < 200ms (p95)
- [ ] Creating/updating/deleting expenses updates balance atomically
- [ ] Creating/updating/deleting settlements updates balance atomically
- [ ] All 487 unit tests pass
- [ ] All e2e tests pass
- [ ] Balance consistency verified: incremental === full calculation
- [ ] Zero `updateFailures` in production monitoring
- [ ] `fallbackCalculations` metric near zero after migration

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Race conditions in concurrent updates** | Use Firestore transactions for atomicity |
| **Incremental logic bugs** | Extensive unit tests + consistency checks |
| **Migration incomplete** | Fallback to calculation if balance missing |
| **Performance regression** | Monitor latency, rollback if needed |
| **Data corruption** | Firestore transactions prevent partial updates |
| **Backfill failures** | Dry-run first, process in batches |

---

## Estimated Timeline

| Phase | Effort | Duration |
|-------|--------|----------|
| Schema & Types | Small | 1-2 hours |
| Firestore I/O | Small | 2-3 hours |
| IncrementalBalanceService | Medium | 4-6 hours |
| Service Integration | Medium | 3-4 hours |
| Backfill Script | Small | 2-3 hours |
| API Layer Updates | Small | 1-2 hours |
| Unit Tests | Medium | 4-5 hours |
| Integration Tests | Medium | 3-4 hours |
| E2E Verification | Small | 1 hour |
| **Total** | **~22-30 hours** | **3-4 days** |

---

## Next Steps

1. Review this plan for accuracy and completeness
2. Confirm architectural approach
3. Begin Phase 1: Schema & Type System
4. Implement incrementally, testing at each phase
5. Deploy with fallback, run backfill, monitor
6. Remove fallback in future release after validation
