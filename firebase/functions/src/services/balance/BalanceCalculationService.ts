import { Timestamp } from 'firebase-admin/firestore';
import { BalanceCalculationResult, BalanceCalculationInput, CurrencyBalances } from './types';
import type { ExpenseDocument, SettlementDocument, GroupDocument } from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';
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
        const memberIds = validatedInput.memberDocs.map(member => member.uid);

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
        const [expenses, settlements, { groupDoc, memberDocs }] = await Promise.all([this.fetchExpenses(groupId), this.fetchSettlements(groupId), this.fetchGroupData(groupId)]);

        // Fetch member profiles after we have group data
        const memberIds = memberDocs.map(member => member.uid);
        const memberProfiles = await this.userService.getUsers(memberIds);

        return {
            groupId,
            expenses,
            settlements,
            groupDoc,
            memberDocs,
            memberProfiles,
        };
    }

    private async fetchExpenses(groupId: string): Promise<ExpenseDocument[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const expenseDocuments = await this.firestoreReader.getExpensesForGroup(groupId);

        // No transformation needed - use canonical ExpenseDocument directly
        return expenseDocuments;
    }

    private async fetchSettlements(groupId: string): Promise<SettlementDocument[]> {
        // Use FirestoreReader for validated data - it handles the Zod parsing and validation
        const settlementDocuments = await this.firestoreReader.getSettlementsForGroup(groupId);

        // No transformation needed - use canonical SettlementDocument directly
        return settlementDocuments;
    }

    private async fetchGroupData(groupId: string): Promise<{ groupDoc: GroupDocument; memberDocs: GroupMemberDocument[] }> {
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

        return {
            groupDoc,
            memberDocs,
        };
    }
}
