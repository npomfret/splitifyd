import { Timestamp } from 'firebase-admin/firestore';
import { SimplifiedDebt, UserBalance } from '@splitifyd/shared';

export interface GroupBalance {
    groupId: string;
    userBalances: Record<string, UserBalance>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: Timestamp;
    balancesByCurrency: Record<string, Record<string, UserBalance>>;
}
