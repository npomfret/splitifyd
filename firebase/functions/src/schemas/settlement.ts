import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Zod schema for Settlement document validation
 * Separated from SettlementService to avoid circular import issues
 */
export const SettlementDocumentSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    payerId: z.string().min(1),
    payeeId: z.string().min(1),
    amount: z.number().min(0),
    currency: z.string().min(1),
    date: z.instanceof(Timestamp),
    createdBy: z.string().min(1),
    createdAt: z.instanceof(Timestamp),
    updatedAt: z.instanceof(Timestamp),
    note: z.string().optional(),
});

export type SettlementDocument = z.infer<typeof SettlementDocumentSchema>;