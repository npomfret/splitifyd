import { Timestamp } from 'firebase-admin/firestore';
import { BalanceCalculationResult, BalanceCalculationInput, Expense, Settlement, GroupData, GroupMember } from './types';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import { DebtSimplificationService } from './DebtSimplificationService';
import { BalanceCalculationResultSchema, BalanceCalculationInputSchema } from '../../schemas';
import { measureDb } from '../../monitoring/measure';
import { logger } from '../../logger';
import { timestampToISO } from '../../utils/dateHelpers';
import type { IFirestoreReader } from '../firestore';
import { UserService } from '../UserService2';
import { DELETED_AT_FIELD } from '@splitifyd/shared';

export class BalanceCalculationService {
    private expenseProcessor: ExpenseProcessor;
    private settlementProcessor: SettlementProcessor;
    private debtSimplificationService: DebtSimplificationService;

    constructor(
        private firestoreReader: IFirestoreReader,
        private userService: UserService,
    ) {
        this.expenseProcessor = new ExpenseProcessor();
        this.settlementProcessor = new SettlementProcessor();
        this.debtSimplificationService = new DebtSimplificationService();
    }

    async calculateGroupBalances(groupId: string): Promise<BalanceCalculationResult> {
        return measureDb('balance-calculation', async () => {
            // Step 1: Fetch all required data
            const input = await this.fetchBalanceCalculationData(groupId);

            // Step 2: Calculate balances with the fetched data
            const result = this.calculateGroupBalancesWithData(input);

            return result;
        });
    }

    /**
     * Calculate group balances using pre-fetched data (optimized for batch operations)
     */
    calculateGroupBalancesWithData(input: BalanceCalculationInput): BalanceCalculationResult {
        // Validate input data for type safety
        const validatedInput = BalanceCalculationInputSchema.parse(input);

        const startTime = Date.now();

        // 1. Extract member IDs for initialization
        const memberIds = Object.keys(validatedInput.groupData.members);

        // 2. Process expenses to calculate initial balances by currency
        const expenseProcessingStart = Date.now();
        const balancesByCurrency = this.expenseProcessor.processExpenses(validatedInput.expenses, memberIds);
        const expenseProcessingTime = Date.now() - expenseProcessingStart;

        // 3. Apply settlements to modify balances
        const settlementProcessingStart = Date.now();
        this.settlementProcessor.processSettlements(validatedInput.settlements, balancesByCurrency);
        const settlementProcessingTime = Date.now() - settlementProcessingStart;

        // 4. Simplify debts for all currencies
        const debtSimplificationStart = Date.now();
        const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(balancesByCurrency);
        const debtSimplificationTime = Date.now() - debtSimplificationStart;

        // 5. Create and validate result
        const result = {
            groupId: validatedInput.groupId,
            simplifiedDebts,
            lastUpdated: timestampToISO(Timestamp.now()),
            balancesByCurrency,
        };

        const totalComputationTime = Date.now() - startTime;

        // Log detailed performance metrics
        if (totalComputationTime > 100) {
            logger.info('Balance calculation performance breakdown', {
                groupId: validatedInput.groupId,
                totalTime_ms: totalComputationTime,
                expenseProcessingTime_ms: expenseProcessingTime,
                settlementProcessingTime_ms: settlementProcessingTime,
                debtSimplificationTime_ms: debtSimplificationTime,
                expenseCount: validatedInput.expenses.length,
                settlementCount: validatedInput.settlements.length,
                memberCount: memberIds.length,
                currencyCount: Object.keys(balancesByCurrency).length,
            });
        }

        // Validate output for type safety
        return BalanceCalculationResultSchema.parse(result);
    }

    async fetchBalanceCalculationData(groupId: string): Promise<BalanceCalculationInput> {
        // Fetch all required data in parallel for better performance
        const [expenses, settlements, groupData] = await Promise.all([this.fetchExpenses(groupId), this.fetchSettlements(groupId), this.fetchGroupData(groupId)]);

        // Fetch member profiles after we have group data
        const memberIds = Object.keys(groupData.members);
        const memberProfiles = await this.userService.getUsers(memberIds);

        return {
            groupId,
            expenses,
            settlements,
            groupData,
            memberProfiles,
        };
    }

    private async fetchExpenses(groupId: string): Promise<Expense[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const expenseDocuments = await this.firestoreReader.getExpensesForGroup(groupId);

        // Transform ExpenseDocument to local Expense interface
        const expenses: Expense[] = expenseDocuments.map((expenseDoc) => {
            // Transform to match local Expense interface - convert Timestamp to ISO string and extract required fields
            return {
                id: expenseDoc.id,
                groupId: expenseDoc.groupId,
                description: expenseDoc.description,
                amount: expenseDoc.amount,
                currency: expenseDoc.currency,
                paidBy: expenseDoc.paidBy,
                splitType: expenseDoc.splitType,
                participants: expenseDoc.participants,
                splits: expenseDoc.splits,
                date: timestampToISO(expenseDoc.date),
                category: expenseDoc.category,
                receiptUrl: expenseDoc.receiptUrl || undefined,
                createdAt: expenseDoc.createdAt ? timestampToISO(expenseDoc.createdAt) : undefined,
                deletedAt: expenseDoc.deletedAt ? timestampToISO(expenseDoc.deletedAt) : undefined,
            } satisfies Expense;
        });

        // Filter out soft-deleted expenses - FirestoreReader already does this filtering
        return expenses.filter((expense) => !expense[DELETED_AT_FIELD as keyof typeof expense]);
    }

    private async fetchSettlements(groupId: string): Promise<Settlement[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const settlementDocuments = await this.firestoreReader.getSettlementsForGroup(groupId);

        // Transform SettlementDocument to local Settlement interface
        const settlements: Settlement[] = settlementDocuments.map((settlementDoc) => {
            // Transform to match local Settlement interface - extract required fields only
            return {
                id: settlementDoc.id,
                groupId: settlementDoc.groupId,
                payerId: settlementDoc.payerId,
                payeeId: settlementDoc.payeeId,
                amount: settlementDoc.amount,
                currency: settlementDoc.currency,
                date: settlementDoc.date ? timestampToISO(settlementDoc.date) : undefined,
                note: settlementDoc.note,
                createdAt: settlementDoc.createdAt ? timestampToISO(settlementDoc.createdAt) : undefined,
            } satisfies Settlement;
        });

        return settlements;
    }

    private async fetchGroupData(groupId: string): Promise<GroupData> {
        // Use FirestoreReader for validated data
        const groupDoc = await this.firestoreReader.getGroup(groupId);

        if (!groupDoc) {
            throw new Error('Group not found');
        }

        // Fetch members from group membership collection
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        if (memberDocs.length === 0) {
            throw new Error(`Group ${groupId} has no members for balance calculation`);
        }

        // Convert GroupMemberDocument[] to Record<string, GroupMember> for compatibility
        const members: Record<string, GroupMember> = {};
        for (const memberDoc of memberDocs) {
            members[memberDoc.uid] = {
                memberRole: memberDoc.memberRole,
                memberStatus: memberDoc.memberStatus,
                joinedAt: memberDoc.joinedAt,
            };
        }

        return {
            id: groupId,
            name: groupDoc.name,
            members,
        };
    }
}
