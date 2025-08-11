import { Timestamp } from 'firebase-admin/firestore';
import { SimplifiedDebt } from '../shared/shared-types';

export interface GroupBalance {
    groupId: string;
    userBalances: Record<string, any>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: Timestamp;
}