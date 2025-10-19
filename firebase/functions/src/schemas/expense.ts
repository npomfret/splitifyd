import { PositiveAmountStringSchema, SplitTypes } from '@splitifyd/shared';
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
        category: z.string().min(1).max(50, 'Category must be 1-50 characters'),
        date: FirestoreTimestampSchema,
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(UserIdSchema).min(1, 'At least one participant required'),
        splits: z.array(FirestoreExpenseSplitSchema),
        receiptUrl: z.string().url().optional().nullable(),
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
