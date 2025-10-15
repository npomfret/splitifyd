import { PositiveAmountStringSchema } from '@splitifyd/shared';
import { z } from 'zod';
import { FirestoreTimestampSchema, UserIdSchema } from './common';

const SimplifiedDebtSchema = z.object({
    from: z.object({ uid: UserIdSchema }),
    to: z.object({ uid: UserIdSchema }),
    amount: PositiveAmountStringSchema,
    currency: z.string(),
});

const UserBalanceSchema = z.object({
    uid: UserIdSchema,
    owes: z.record(z.string(), PositiveAmountStringSchema),
    owedBy: z.record(z.string(), PositiveAmountStringSchema),
    netBalance: z.string(),
});

const CurrencyBalancesSchema = z.record(z.string(), UserBalanceSchema);

const GroupBalanceBaseSchema = z.object({
    groupId: z.string(),
    balancesByCurrency: z.record(z.string(), CurrencyBalancesSchema),
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    version: z.number(),
});

export const GroupBalanceDocumentSchema = GroupBalanceBaseSchema.extend({
    lastUpdatedAt: FirestoreTimestampSchema,
});

export const GroupBalanceDTOSchema = GroupBalanceBaseSchema.extend({
    lastUpdatedAt: z.string().datetime(),
});

export type GroupBalanceDTO = z.infer<typeof GroupBalanceDTOSchema>;
