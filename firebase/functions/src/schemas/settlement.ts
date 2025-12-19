import { PositiveAmountStringSchema } from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, CurrencyCodeSchema, FirestoreTimestampSchema, GroupIdSchema, SoftDeletionFieldsSchema, UserIdSchema } from './common';
import { ReactionCountsSchema, UserReactionsMapSchema } from './reaction';

const BaseSettlementSchema = z
    .object({
        groupId: GroupIdSchema,
        payerId: UserIdSchema,
        payeeId: UserIdSchema,
        amount: PositiveAmountStringSchema,
        currency: CurrencyCodeSchema,
        date: FirestoreTimestampSchema,
        createdBy: UserIdSchema,
        note: z.string().optional(),
        supersededBy: z.string().nullable(), // SettlementId of newer version, null if current
        reactionCounts: ReactionCountsSchema.nullable().optional(), // Aggregate emoji reaction counts
        userReactions: UserReactionsMapSchema.nullable().optional(), // All users' reactions (denormalized)
    })
    .merge(AuditFieldsSchema)
    .merge(SoftDeletionFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: SettlementDocumentSchema, ReadDocumentSchema: SettlementReadDocumentSchema } = createDocumentSchemas(BaseSettlementSchema);

/**
 * Zod schema for Settlement document validation
 * Separated from SettlementService to avoid circular import issues
 *
 * Usage:
 * ```typescript
 * // For writing (strict validation):
 * const settlement = SettlementDocumentSchema.parse(doc.data());
 *
 * // For reading (tolerates extra fields for schema evolution):
 * const settlement = SettlementReadDocumentSchema.parse(doc.data());
 * ```
 */
export { SettlementDocumentSchema, SettlementReadDocumentSchema };
