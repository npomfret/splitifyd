import { calculateGroupBalances as newCalculateGroupBalances } from './balance';
import type { BalanceCalculationResult } from './balance';

// Maintain backward compatibility by delegating to new service
// Note: GroupBalance and BalanceCalculationResult are identical - using unified type
export async function calculateGroupBalances(groupId: string): Promise<BalanceCalculationResult> {
    return newCalculateGroupBalances(groupId);
}
