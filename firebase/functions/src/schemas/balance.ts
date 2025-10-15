import {z} from 'zod';

// Schema for UserBalance (from @splitifyd/shared)
const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.string()),
    owedBy: z.record(z.string(), z.string()),
    netBalance: z.string(),
});

// Schema for CurrencyBalances - record of currency to user balances
const CurrencyBalancesSchema = z.record(
    z.string(), // currency
    z.record(z.string(), UserBalanceSchema), // userId to UserBalance
);

// Export inferred types
export type ParsedCurrencyBalances = z.infer<typeof CurrencyBalancesSchema>;
