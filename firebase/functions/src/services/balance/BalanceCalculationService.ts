import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance } from '../../shared/shared-types';
import { BalanceCalculationResult, CurrencyBalances, BalanceCalculationInput } from './types';
import { DataFetcher } from './DataFetcher';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import { DebtSimplificationService } from './DebtSimplificationService';

export class BalanceCalculationService {
    private dataFetcher: DataFetcher;
    private expenseProcessor: ExpenseProcessor;
    private settlementProcessor: SettlementProcessor;
    private debtSimplificationService: DebtSimplificationService;

    constructor() {
        this.dataFetcher = new DataFetcher();
        this.expenseProcessor = new ExpenseProcessor();
        this.settlementProcessor = new SettlementProcessor();
        this.debtSimplificationService = new DebtSimplificationService();
    }

    async calculateGroupBalances(groupId: string): Promise<BalanceCalculationResult> {
        // 1. Fetch all required data
        const input = await this.dataFetcher.fetchBalanceCalculationData(groupId);
        
        return this.calculateGroupBalancesWithData(input);
    }

    /**
     * Calculate group balances using pre-fetched data (optimized for batch operations)
     */
    calculateGroupBalancesWithData(input: BalanceCalculationInput): BalanceCalculationResult {
        // 1. Extract member IDs for initialization
        const memberIds = Object.keys(input.groupData.data.members);
        
        // 2. Process expenses to calculate initial balances by currency
        const balancesByCurrency = this.expenseProcessor.processExpenses(input.expenses, memberIds);
        
        // 3. Apply settlements to modify balances
        this.settlementProcessor.processSettlements(input.settlements, balancesByCurrency);
        
        // 4. Simplify debts for all currencies
        const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(balancesByCurrency);
        
        // 5. Create legacy userBalances field from first currency (for backward compatibility)
        const userBalances = this.createLegacyUserBalances(balancesByCurrency);
        
        // 6. Return consolidated result
        return {
            groupId: input.groupId,
            userBalances,
            simplifiedDebts,
            lastUpdated: Timestamp.now(),
            balancesByCurrency
        };
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