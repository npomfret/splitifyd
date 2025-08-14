import { Timestamp } from 'firebase-admin/firestore';
import { SimplifiedDebt, UserBalance } from '../shared/shared-types';

export interface GroupBalance {
    groupId: string;
    userBalances: Record<string, UserBalance>; // Legacy - kept for compatibility with existing functions
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: Timestamp;
    balancesByCurrency: Record<string, Record<string, UserBalance>>;
}