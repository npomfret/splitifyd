import { z } from 'zod';
import { FirestoreTimestampSchema, AuditFieldsSchema, SoftDeletionFieldsSchema, UserIdSchema, GroupIdSchema, CurrencyCodeSchema, createDocumentSchemas } from './common';

/**
 * Base Settlement schema without document ID
 */
const BaseSettlementSchema = z
    .object({
        groupId: GroupIdSchema,
        payerId: UserIdSchema,
        payeeId: UserIdSchema,
        amount: z.number().min(0, 'Amount must be non-negative'),
        currency: CurrencyCodeSchema,
        date: FirestoreTimestampSchema,
        createdBy: UserIdSchema,
        note: z.string().optional(),
    })
    .merge(AuditFieldsSchema)
    .merge(SoftDeletionFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: SettlementDocumentSchema } = createDocumentSchemas(BaseSettlementSchema);

/**
 * Zod schema for Settlement document validation
 * Separated from SettlementService to avoid circular import issues
 *
 * Usage:
 * ```typescript
 * const settlement = SettlementDocumentSchema.parse(doc.data());
 * ```
 */
export { SettlementDocumentSchema };
