import { z } from 'zod';
import { FirestoreTimestampSchema } from './common';

// Schema for ExpenseSplit
export const ExpenseSplitSchema = z.object({
    userId: z.string(),
    amount: z.number(),
    percentage: z.number().optional(),
});

// Schema for GroupMember (for balance calculations)
export const GroupMemberBalanceSchema = z.object({
    role: z.enum(['admin', 'member', 'viewer']),
    status: z.enum(['active', 'pending']),
    joinedAt: z.string().optional(),
});

// Schema for GroupData used in balance calculations
export const GroupDataBalanceSchema = z.object({
    id: z.string(),
    name: z.string(),
    members: z.record(z.string(), GroupMemberBalanceSchema),
});

// Schema for Expense entity used in balance calculations
export const ExpenseBalanceSchema = z.object({
    id: z.string(),
    groupId: z.string(),
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    paidBy: z.string(),
    splitType: z.enum(['equal', 'exact', 'percentage']),
    participants: z.array(z.string()),
    splits: z.array(ExpenseSplitSchema),
    date: z.string(),
    category: z.string(),
    receiptUrl: z.string().optional(),
    createdAt: FirestoreTimestampSchema.optional(),
    deletedAt: FirestoreTimestampSchema.optional(),
});

// Schema for Settlement entity used in balance calculations
export const SettlementBalanceSchema = z.object({
    id: z.string(),
    groupId: z.string(),
    payerId: z.string(),
    payeeId: z.string(),
    amount: z.number(),
    currency: z.string(),
    date: z.string().optional(),
    note: z.string().optional(),
    createdAt: FirestoreTimestampSchema.optional(),
});

// Schema for UserBalance (from @splitifyd/shared)
export const UserBalanceSchema = z.object({
    userId: z.string(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
    netBalance: z.number(),
});

// Schema for SimplifiedDebt (from @splitifyd/shared)
export const SimplifiedDebtSchema = z.object({
    from: z.object({
        userId: z.string(),
    }),
    to: z.object({
        userId: z.string(),
    }),
    amount: z.number(),
    currency: z.string(),
});

// Schema for CurrencyBalances - record of currency to user balances
export const CurrencyBalancesSchema = z.record(
    z.string(), // currency
    z.record(z.string(), UserBalanceSchema) // userId to UserBalance
);

// Schema for BalanceCalculationInput
export const BalanceCalculationInputSchema = z.object({
    groupId: z.string(),
    expenses: z.array(ExpenseBalanceSchema),
    settlements: z.array(SettlementBalanceSchema),
    groupData: GroupDataBalanceSchema,
    memberProfiles: z.any(), // Map<string, UserProfile> - skip validation for now
});

// Schema for BalanceCalculationResult / GroupBalance
export const BalanceCalculationResultSchema = z.object({
    groupId: z.string(),
    userBalances: z.record(z.string(), UserBalanceSchema),
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    lastUpdated: FirestoreTimestampSchema,
    balancesByCurrency: CurrencyBalancesSchema,
});

// Schema for the currency-specific balance data used in GroupService.addComputedFields
export const CurrencyBalanceDisplaySchema = z.object({
    currency: z.string(),
    netBalance: z.number(),
    totalOwed: z.number(),
    totalOwing: z.number(),
});

// Schema for the balance display data used in GroupService
export const BalanceDisplaySchema = z.object({
    balancesByCurrency: z.record(z.string(), CurrencyBalanceDisplaySchema),
});

// Export inferred types
export type ParsedExpenseSplit = z.infer<typeof ExpenseSplitSchema>;
export type ParsedGroupMemberBalance = z.infer<typeof GroupMemberBalanceSchema>;
export type ParsedGroupDataBalance = z.infer<typeof GroupDataBalanceSchema>;
export type ParsedExpenseBalance = z.infer<typeof ExpenseBalanceSchema>;
export type ParsedSettlementBalance = z.infer<typeof SettlementBalanceSchema>;
export type ParsedUserBalance = z.infer<typeof UserBalanceSchema>;
export type ParsedSimplifiedDebt = z.infer<typeof SimplifiedDebtSchema>;
export type ParsedCurrencyBalances = z.infer<typeof CurrencyBalancesSchema>;
export type ParsedBalanceCalculationInput = z.infer<typeof BalanceCalculationInputSchema>;
export type ParsedBalanceCalculationResult = z.infer<typeof BalanceCalculationResultSchema>;
export type ParsedCurrencyBalanceDisplay = z.infer<typeof CurrencyBalanceDisplaySchema>;
export type ParsedBalanceDisplay = z.infer<typeof BalanceDisplaySchema>;