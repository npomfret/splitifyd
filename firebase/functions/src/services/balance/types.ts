import { UserBalance, SimplifiedDebt, RegisteredUser, GroupMemberDocument } from '@splitifyd/shared';
import type { ExpenseDocument, SettlementDocument, GroupDocument } from '../../schemas';

// Note: Core entity interfaces (Expense, Settlement, GroupData, GroupMember) now come from canonical schemas
// Use ExpenseDocument, SettlementDocument, GroupDocument from ../../schemas and GroupMemberDocument from @splitifyd/shared

// Processing interfaces - intermediate data structures used during calculation
export interface BalanceCalculationInput {
    groupId: string;
    expenses: ExpenseDocument[];
    settlements: SettlementDocument[];
    groupDoc: GroupDocument;
    memberDocs: GroupMemberDocument[];
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
