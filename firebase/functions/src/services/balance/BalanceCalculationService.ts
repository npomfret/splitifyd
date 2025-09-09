import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance } from '@splitifyd/shared';
import { BalanceCalculationResult, CurrencyBalances, BalanceCalculationInput } from './types';
import { DataFetcher } from './DataFetcher';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import { DebtSimplificationService } from './DebtSimplificationService';
import { BalanceCalculationResultSchema, BalanceCalculationInputSchema } from '../../schemas/balance';
import { measureDb } from '../../monitoring/measure';
import { logger } from '../../logger';
import { timestampToISO } from '../../utils/dateHelpers';
import type { IFirestoreReader } from '../firestore/IFirestoreReader';

export class BalanceCalculationService {
    private dataFetcher: DataFetcher;
    private expenseProcessor: ExpenseProcessor;
    private settlementProcessor: SettlementProcessor;
    private debtSimplificationService: DebtSimplificationService;

    constructor(firestoreReader: IFirestoreReader) {
        this.dataFetcher = new DataFetcher(firestoreReader);
        this.expenseProcessor = new ExpenseProcessor();
        this.settlementProcessor = new SettlementProcessor();
        this.debtSimplificationService = new DebtSimplificationService();
    }

    async calculateGroupBalances(groupId: string): Promise<BalanceCalculationResult> {
        return measureDb(
            'balance-calculation',
            async () => {
                // Step 1: Fetch all required data
                const input = await this.dataFetcher.fetchBalanceCalculationData(groupId);

                // Step 2: Calculate balances with the fetched data
                const result = this.calculateGroupBalancesWithData(input);

                return result;
            }
        );
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

        // 5. Create legacy userBalances field from first currency (for backward compatibility)
        const userBalances = this.createLegacyUserBalances(balancesByCurrency);

        // 6. Create and validate result
        const result = {
            groupId: validatedInput.groupId,
            userBalances,
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
                currencyCount: Object.keys(balancesByCurrency).length
            });
        }

        // Validate output for type safety
        return BalanceCalculationResultSchema.parse(result);
    }

    private createLegacyUserBalances(balancesByCurrency: CurrencyBalances): Record<string, UserBalance> {
        // For backward compatibility, populate userBalances with the first currency's data
        // This maintains the existing API contract while supporting multi-currency
        const currencies = Object.keys(balancesByCurrency);

        if (currencies.length === 0) {
            return {};
        }

        // Use the first currency found for the legacy field
        const firstCurrency = currencies[0];
        return balancesByCurrency[firstCurrency] || {};
    }
}
