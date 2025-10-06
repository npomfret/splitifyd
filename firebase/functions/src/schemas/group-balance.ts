import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Schema for the UserBalance map within GroupBalance
 * Tracks per-user balance state across all currencies
 */
export const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
    netBalance: z.number(),
});

/**
 * Schema for CurrencyBalances - record of userId to UserBalance
 */
export const CurrencyBalancesSchema = z.record(
    z.string(),
    UserBalanceSchema
);

/**
 * Schema for SimplifiedDebt
 */
export const SimplifiedDebtSchema = z.object({
    from: z.object({ uid: z.string() }),
    to: z.object({ uid: z.string() }),
    amount: z.number(),
    currency: z.string(),
});

/**
 * Firestore Document Schema for GroupBalance
 * Stored at: groups/{groupId}/metadata/balance
 */
export const GroupBalanceDocumentSchema = z.object({
    groupId: z.string(),
    balancesByCurrency: z.record(z.string(), CurrencyBalancesSchema),
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    lastUpdatedAt: z.instanceof(Timestamp),
    version: z.number(),
});

/**
 * DTO Schema for GroupBalance (ISO strings for application layer)
 */
export const GroupBalanceDTOSchema = GroupBalanceDocumentSchema.extend({
    lastUpdatedAt: z.string().datetime(),
});

export type GroupBalanceDocument = z.infer<typeof GroupBalanceDocumentSchema>;
export type GroupBalanceDTO = z.infer<typeof GroupBalanceDTOSchema>;
