// Public API for the balance calculation service
export { BalanceCalculationService } from './BalanceCalculationService';
export type { BalanceCalculationResult, BalanceCalculationInput, Expense, Settlement, GroupData, CurrencyBalances } from './types';

// Create singleton instance for backward compatibility
import { BalanceCalculationService } from './BalanceCalculationService';
import { BalanceCalculationResult, BalanceCalculationInput } from './types';

const balanceService = new BalanceCalculationService();

// Export function that matches the original API for easy migration
export async function calculateGroupBalances(groupId: string): Promise<BalanceCalculationResult> {
    return balanceService.calculateGroupBalances(groupId);
}

// Export optimized function for batch operations (used by listGroups)
export function calculateGroupBalancesWithData(input: BalanceCalculationInput): BalanceCalculationResult {
    return balanceService.calculateGroupBalancesWithData(input);
}
