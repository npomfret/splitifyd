import { PositiveAmountStringSchema, SplitTypes } from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, CurrencyCodeSchema, FirestoreTimestampSchema, GroupIdSchema, SoftDeletionFieldsSchema, UserIdSchema } from './common';

const FirestoreExpenseSplitSchema = z.object({
    uid: UserIdSchema,
    amount: PositiveAmountStringSchema,
    percentage: z.number().min(0).max(100).optional(),
});

const BaseExpenseSchema = z
    .object({
        groupId: GroupIdSchema,
        createdBy: UserIdSchema,
        paidBy: UserIdSchema,
        amount: PositiveAmountStringSchema,
        currency: CurrencyCodeSchema,
        description: z.string().min(1).max(200, 'Description must be 1-200 characters'),
        label: z.string().min(1).max(50, 'Label must be 1-50 characters'),
        date: FirestoreTimestampSchema,
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(UserIdSchema).min(1, 'At least one participant required'),
        splits: z.array(FirestoreExpenseSplitSchema),
        receiptUrl: z.string().url().optional().nullable(),
        isLocked: z.boolean().optional(), // True if any participant has left the group
        supersededBy: z.string().nullable(), // ExpenseId of newer version, null if current
    })
    .merge(AuditFieldsSchema)
    .merge(SoftDeletionFieldsSchema);

const { DocumentSchema: ExpenseDocumentSchema } = createDocumentSchemas(BaseExpenseSchema);

/**
 * Zod schemas for expense document validation
 * Separated from ExpenseService to avoid circular import issues
 *
 * Usage:
 * ```typescript
 * const expense = ExpenseDocumentSchema.parse(doc.data());
 * ```
 */
export { ExpenseDocumentSchema };
