import { GroupBalance } from '../models/groupBalance';
import { calculateGroupBalances as newCalculateGroupBalances } from './balance';

// Maintain backward compatibility by delegating to new service
export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
    return newCalculateGroupBalances(groupId);
}