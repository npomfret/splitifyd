import { UserBalance, SimplifiedDebt, RegisteredUser } from '@splitifyd/shared';
import type { ExpenseDocument, SettlementDocument } from '../../schemas';

// Note: Core entity interfaces (Expense, Settlement, ExpenseSplit) now come from canonical schemas
// Use ExpenseDocument and SettlementDocument from ../../schemas instead

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
    expenses: ExpenseDocument[];
    settlements: SettlementDocument[];
    groupData: GroupData;
    memberProfiles: Map<string, RegisteredUser>;
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
