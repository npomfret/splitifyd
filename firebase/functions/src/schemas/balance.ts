import { z } from 'zod';

// Schema for UserBalance (from @splitifyd/shared)
const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
    netBalance: z.number(),
});

// Schema for CurrencyBalances - record of currency to user balances
const CurrencyBalancesSchema = z.record(
    z.string(), // currency
    z.record(z.string(), UserBalanceSchema), // userId to UserBalance
);

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
