import { PositiveAmountStringSchema } from '@splitifyd/shared';
import { z } from 'zod';
import {
    AuditFieldsSchema,
    createDocumentSchemas,
    CurrencyCodeSchema,
    FirestoreTimestampSchema,
    GroupIdSchema,
    SoftDeletionFieldsSchema,
    UserIdSchema,
} from './common';

export const BaseSettlementSchema = z
    .object({
        groupId: GroupIdSchema,
        payerId: UserIdSchema,
        payeeId: UserIdSchema,
        amount: PositiveAmountStringSchema,
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
