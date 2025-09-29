import { z } from 'zod';
import { FirestoreTimestampSchema } from './common';

/**
 * Schema for per-user notification documents
 *
 * This schema validates the structure of user notification documents that replace
 * the high-churn change document system. Each user has one persistent document
 * that tracks all their group notifications.
 *
 * Design:
 * - Single document per user eliminates create/delete churn
 * - Atomic updates using FieldValue.increment() for consistency
 * - Change counters enable clients to detect missed updates
 * - Timestamps provide audit trail and debugging capability
 */

/**
 * Schema for per-group notification tracking within a user's document
 */
export const UserNotificationGroupSchema = z.object({
    // Timestamps of last changes by type
    lastTransactionChange: FirestoreTimestampSchema.nullable(),
    lastBalanceChange: FirestoreTimestampSchema.nullable(),
    lastGroupDetailsChange: FirestoreTimestampSchema.nullable(),
    lastCommentChange: FirestoreTimestampSchema.nullable(),

    // Change counters for detecting missed updates
    transactionChangeCount: z.number().int().nonnegative(),
    balanceChangeCount: z.number().int().nonnegative(),
    groupDetailsChangeCount: z.number().int().nonnegative(),
    commentChangeCount: z.number().int().nonnegative(),
});

/**
 * Schema for recent changes tracking (debugging and audit)
 */
export const RecentChangeSchema = z.object({
    groupId: z.string().min(1, 'Group ID is required'),
    type: z.enum(['transaction', 'balance', 'group', 'comment']),
    timestamp: FirestoreTimestampSchema,
});

/**
 * Complete user notification document schema
 */
export const UserNotificationDocumentSchema = z.object({
    // Global version counter - increments on every change
    changeVersion: z.number().int().nonnegative(),

    // Per-group change tracking
    groups: z.record(z.string().min(1), UserNotificationGroupSchema),

    // Document metadata
    lastModified: FirestoreTimestampSchema,

    // Optional: Recent changes for debugging (kept to last 10)
    recentChanges: z.array(RecentChangeSchema).optional(),
});

/**
 * Type definitions derived from schemas
 */
export type UserNotificationGroup = z.infer<typeof UserNotificationGroupSchema>;
export type UserNotificationDocument = z.infer<typeof UserNotificationDocumentSchema>;

/**
 * Helper type for creating new notification documents
 */
export type CreateUserNotificationDocument = Omit<UserNotificationDocument, 'changeVersion' | 'lastModified'>;
