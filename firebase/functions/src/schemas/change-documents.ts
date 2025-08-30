import { z } from 'zod';
import { FirestoreTimestampSchema } from './common';

/**
 * Change document schemas for Firestore triggers
 * 
 * These schemas validate change documents created by triggers for real-time 
 * notifications. They ensure consistent structure for client-side change tracking.
 */

/**
 * Schema for group change documents
 * 
 * Used when groups are created, updated, or deleted to notify members
 * of changes that might affect their view of the group.
 */
export const GroupChangeDocumentSchema = z.object({
    id: z.string().min(1, 'Group ID is required'),
    type: z.literal('group'),
    action: z.enum(['created', 'updated', 'deleted']),
    timestamp: FirestoreTimestampSchema,
    users: z.array(z.string().min(1)),
});

/**
 * Schema for transaction change documents (expenses and settlements)
 * 
 * Used when expenses or settlements are created, updated, or deleted
 * to notify affected users of changes that impact balances.
 */
export const TransactionChangeDocumentSchema = z.object({
    id: z.string().min(1, 'Transaction ID is required'),
    type: z.enum(['expense', 'settlement']),
    action: z.enum(['created', 'updated', 'deleted']),
    timestamp: FirestoreTimestampSchema,
    users: z.array(z.string().min(1)),
    groupId: z.string().min(1, 'Group ID is required for transactions'),
});

/**
 * Schema for balance change documents
 * 
 * Created whenever expenses or settlements change to signal that
 * group balances need to be recalculated on the client side.
 */
export const BalanceChangeDocumentSchema = z.object({
    groupId: z.string().min(1, 'Group ID is required'),
    type: z.literal('balance'),
    action: z.literal('recalculated'),
    timestamp: FirestoreTimestampSchema,
    users: z.array(z.string().min(1)),
});

/**
 * Type definitions derived from schemas
 */
export type GroupChangeDocument = z.infer<typeof GroupChangeDocumentSchema>;
export type TransactionChangeDocument = z.infer<typeof TransactionChangeDocumentSchema>;
export type BalanceChangeDocument = z.infer<typeof BalanceChangeDocumentSchema>;