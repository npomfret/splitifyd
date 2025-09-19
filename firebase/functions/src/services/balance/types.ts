import { UserBalance, SimplifiedDebt } from '@splitifyd/shared';

// Core entity interfaces - properly typed versions of data from Firestore
export interface Expense {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    currency: string;
    paidBy: string;
    splitType: 'equal' | 'exact' | 'percentage';
    participants: string[];
    splits: ExpenseSplit[];
    date: string;
    category: string;
    receiptUrl?: string;
    createdAt?: string;
    deletedAt?: string;
}

export interface Settlement {
    id: string;
    groupId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    currency: string;
    date?: string;
    note?: string;
    createdAt?: string;
}

export interface ExpenseSplit {
    userId: string;
    amount: number;
    percentage?: number;
}

export interface GroupData {
    id: string;
    name: string;
    members: Record<string, GroupMember>;
}

export interface GroupMember {
    memberRole: 'admin' | 'member' | 'viewer';
    memberStatus: 'active' | 'pending';
    joinedAt?: string;
}

// Processing interfaces - intermediate data structures used during calculation
export interface BalanceCalculationInput {
    groupId: string;
    expenses: Expense[];
    settlements: Settlement[];
    groupData: GroupData;
    memberProfiles: Map<string, import('../UserService2').UserProfile>;
}

export interface CurrencyBalances {
    [currency: string]: Record<string, UserBalance>;
}

// Result interface - matches what the service returns
export interface BalanceCalculationResult {
    groupId: string;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdated: string;
    balancesByCurrency: CurrencyBalances;
}
