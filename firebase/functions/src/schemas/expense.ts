import { z } from 'zod';
import { SplitTypes } from '@splitifyd/shared';
import { FirestoreTimestampSchema, AuditFieldsSchema, SoftDeletionFieldsSchema, UserIdSchema, GroupIdSchema, CurrencyCodeSchema, createDocumentSchemas } from './common';

/**
 * Zod schema for expense splits
 */
const ExpenseSplitSchema = z.object({
    uid: UserIdSchema,
    amount: z.number().positive('Split amount must be positive'),
    percentage: z.number().min(0).max(100).optional(),
});

/**
 * Base Expense schema without document ID
 */
const BaseExpenseSchema = z
    .object({
        groupId: GroupIdSchema,
        createdBy: UserIdSchema,
        paidBy: UserIdSchema,
        amount: z.number().positive('Expense amount must be positive'),
        currency: CurrencyCodeSchema,
        description: z.string().min(1).max(200, 'Description must be 1-200 characters'),
        category: z.string().min(1).max(50, 'Category must be 1-50 characters'),
        date: FirestoreTimestampSchema,
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(UserIdSchema).min(1, 'At least one participant required'),
        splits: z.array(ExpenseSplitSchema),
        receiptUrl: z.string().url().optional().nullable(),
    })
    .merge(AuditFieldsSchema)
    .merge(SoftDeletionFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 */
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
