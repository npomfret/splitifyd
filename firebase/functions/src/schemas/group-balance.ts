import { PositiveAmountStringSchema, toCurrencyISOCode, toISOString } from '@billsplit-wl/shared';
import { z } from 'zod';
import { FirestoreTimestampSchema, UserIdSchema } from './common';

// Currency code schema: 3-letter uppercase ISO code
const CurrencyCodeSchema = z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((val) => val.toUpperCase())
    .transform(toCurrencyISOCode);

const SimplifiedDebtSchema = z.object({
    from: z.object({ uid: UserIdSchema }),
    to: z.object({ uid: UserIdSchema }),
    amount: PositiveAmountStringSchema,
    currency: CurrencyCodeSchema,
});

const UserBalanceSchema = z.object({
    uid: UserIdSchema,
    owes: z.record(z.string(), PositiveAmountStringSchema),
    owedBy: z.record(z.string(), PositiveAmountStringSchema),
    netBalance: z.string(),
});

const CurrencyBalancesSchema = z.record(z.string(), UserBalanceSchema);

// Validate that record keys are valid currency codes
const BalancesByCurrencySchema = z
    .record(z.string(), CurrencyBalancesSchema)
    .transform((obj) => {
        const validated: Record<string, z.infer<typeof CurrencyBalancesSchema>> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Validate each key is a valid 3-letter currency code
            const validatedKey = CurrencyCodeSchema.parse(key);
            validated[validatedKey] = value;
        }
        return validated;
    });

const GroupBalanceBaseSchema = z.object({
    groupId: z.string(),
    balancesByCurrency: BalancesByCurrencySchema,
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    version: z.number(),
});

export const GroupBalanceDocumentSchema = GroupBalanceBaseSchema.extend({
    lastUpdatedAt: FirestoreTimestampSchema,
});

export const GroupBalanceDTOSchema = GroupBalanceBaseSchema.extend({
    lastUpdatedAt: z.string().datetime().transform(toISOString),
});

// Note: GroupBalanceDTO type is exported from @billsplit-wl/shared for consistency
// The schema here is used for runtime validation only
export type GroupBalanceDTO = z.infer<typeof GroupBalanceDTOSchema>;
