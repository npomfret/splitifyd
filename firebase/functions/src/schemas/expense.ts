import { z } from 'zod';
import { SplitTypes } from '@splitifyd/shared';

/**
 * Zod schemas for expense document validation
 * Separated from ExpenseService to avoid circular import issues
 */
export const ExpenseSplitSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().positive(),
    percentage: z.number().min(0).max(100).optional(),
});

export const ExpenseDocumentSchema = z
    .object({
        id: z.string().min(1),
        groupId: z.string().min(1),
        createdBy: z.string().min(1),
        paidBy: z.string().min(1),
        amount: z.number().positive(),
        currency: z.string().length(3),
        description: z.string().min(1).max(200),
        category: z.string().min(1).max(50),
        date: z.any(), // Firestore Timestamp
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
        participants: z.array(z.string().min(1)).min(1),
        splits: z.array(ExpenseSplitSchema),
        receiptUrl: z.string().url().optional().nullable(),
        createdAt: z.any(), // Firestore Timestamp
        updatedAt: z.any(), // Firestore Timestamp
        deletedAt: z.any().nullable(), // Firestore Timestamp or null
        deletedBy: z.string().nullable(),
    })
    .passthrough(); // Allow additional fields that may exist

export type ExpenseDocument = z.infer<typeof ExpenseDocumentSchema>;