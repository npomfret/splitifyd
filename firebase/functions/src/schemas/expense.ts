import { PositiveAmountStringSchema, SplitTypes, toExpenseLabel } from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, CurrencyCodeSchema, FirestoreTimestampSchema, GroupIdSchema, SoftDeletionFieldsSchema, UserIdSchema } from './common';
import { ReactionCountsSchema, UserReactionsMapSchema } from './reaction';

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
        labels: z.array(z.string().min(1).max(50, 'Label must be 1-50 characters').transform(toExpenseLabel)).max(3).default([]),
        date: FirestoreTimestampSchema,
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(UserIdSchema).min(1, 'At least one participant required'),
        splits: z.array(FirestoreExpenseSplitSchema),
        receiptUrl: z.union([
            z.string().url(),
            z.string().startsWith('/api/'), // Relative API paths for internal attachments
        ]).optional().nullable(),
        location: z
            .object({
                name: z.string().max(200),
                url: z.string().url().optional(),
            })
            .optional(),
        isLocked: z.boolean().optional(), // True if any participant has left the group
        supersededBy: z.string().nullable(), // ExpenseId of newer version, null if current
        reactionCounts: ReactionCountsSchema.nullable().optional(), // Aggregate emoji reaction counts
        userReactions: UserReactionsMapSchema.nullable().optional(), // All users' reactions (denormalized)
        commentCount: z.number().int().min(0).optional(), // Number of comments on this expense
    })
    .merge(AuditFieldsSchema)
    .merge(SoftDeletionFieldsSchema);

const { DocumentSchema: ExpenseDocumentSchema, ReadDocumentSchema: ExpenseReadDocumentSchema } = createDocumentSchemas(BaseExpenseSchema);

/**
 * Zod schemas for expense document validation
 * Separated from ExpenseService to avoid circular import issues
 *
 * Usage:
 * ```typescript
 * // For writing (strict validation):
 * const expense = ExpenseDocumentSchema.parse(doc.data());
 *
 * // For reading (tolerates extra fields for schema evolution):
 * const expense = ExpenseReadDocumentSchema.parse(doc.data());
 * ```
 */
export { ExpenseDocumentSchema, ExpenseReadDocumentSchema };
