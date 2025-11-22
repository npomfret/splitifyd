import { type CurrencyISOCode, toCurrencyISOCode, toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';

// Currency code schema: 3-letter uppercase ISO code
const CurrencyCodeSchema = z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((val) => val.toUpperCase())
    .transform(toCurrencyISOCode);

// Schema for UserBalance (from @billsplit-wl/shared)
const UserBalanceSchema = z.object({
    uid: z.string().transform(toUserId),
    owes: z.record(z.string(), z.string()),
    owedBy: z.record(z.string(), z.string()),
    netBalance: z.string(),
});

// Schema for CurrencyBalances - validates currency codes as keys
// Result type will be Record<CurrencyISOCode, Record<string, UserBalance>>
const CurrencyBalancesSchema = z
    .record(z.string(), z.record(z.string(), UserBalanceSchema))
    .transform((obj) => {
        const validated: Record<CurrencyISOCode, Record<string, z.infer<typeof UserBalanceSchema>>> = {} as Record<CurrencyISOCode, Record<string, z.infer<typeof UserBalanceSchema>>>;
        for (const [key, value] of Object.entries(obj)) {
            // Validate each key is a valid 3-letter currency code
            const validatedKey = CurrencyCodeSchema.parse(key);
            validated[validatedKey] = value;
        }
        return validated;
    });

// Export inferred types
export type ParsedCurrencyBalances = z.infer<typeof CurrencyBalancesSchema>;

