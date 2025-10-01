import { z } from 'zod';
import { FirestoreTimestampSchema } from './common';
import { ExpenseDocumentSchema } from './expense';
import { SettlementDocumentSchema } from './settlement';
import { GroupDocumentSchema } from './group';

// Schema for UserBalance (from @splitifyd/shared)
const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
    netBalance: z.number(),
});

// Schema for SimplifiedDebt (from @splitifyd/shared)
const SimplifiedDebtSchema = z.object({
    from: z.object({
        uid: z.string(),
    }),
    to: z.object({
        uid: z.string(),
    }),
    amount: z.number(),
    currency: z.string(),
});

// Schema for CurrencyBalances - record of currency to user balances
const CurrencyBalancesSchema = z.record(
    z.string(), // currency
    z.record(z.string(), UserBalanceSchema), // userId to UserBalance
);

// Schema for BalanceCalculationInput
export const BalanceCalculationInputSchema = z.object({
    groupId: z.string(),
    expenses: z.array(ExpenseDocumentSchema),
    settlements: z.array(SettlementDocumentSchema),
    groupDoc: GroupDocumentSchema,
    memberDocs: z.array(z.any()), // GroupMemberDocument[] - skip validation for now as it's from @splitifyd/shared
    memberProfiles: z.any(), // Map<string, UserProfile> - skip validation for now
});

// Schema for BalanceCalculationResult / GroupBalance
export const BalanceCalculationResultSchema = z.object({
    groupId: z.string(),
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
export type ParsedCurrencyBalances = z.infer<typeof CurrencyBalancesSchema>;
export type ParsedBalanceCalculationInput = z.infer<typeof BalanceCalculationInputSchema>;
export type ParsedBalanceCalculationResult = z.infer<typeof BalanceCalculationResultSchema>;
