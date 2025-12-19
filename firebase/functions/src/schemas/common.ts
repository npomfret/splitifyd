import { isValidCurrency, toCommentId, toExpenseId, toGroupId, toGroupName, toPolicyId, toSettlementId, toTenantId, toUserId } from '@billsplit-wl/shared';
import type { CommentId, ExpenseId, GroupId, GroupName, PolicyId, SettlementId, TenantId, UserId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { FieldValue, Timestamp } from '../firestore-wrapper';

/**
 * Common schema fragments for consistent validation patterns across all schemas
 */

/**
 * Helper to create Document + Data schema pairs consistently
 *
 * @param baseSchema - The base schema without the id field
 * @returns Object with:
 *   - DocumentSchema: Strict schema for writing (rejects extra fields)
 *   - ReadDocumentSchema: Passthrough schema for reading (tolerates extra fields for schema evolution)
 *
 * Note: Write schemas are strict to enforce type safety and catch mistakes.
 * Read schemas use passthrough to tolerate legacy fields during schema evolution.
 */
export function createDocumentSchemas<T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) {
    const DocumentSchema = baseSchema.merge(DocumentIdSchema).strict();
    const ReadDocumentSchema = baseSchema.merge(DocumentIdSchema).passthrough();

    return {
        DocumentSchema,
        ReadDocumentSchema,
    };
}

/**
 * Standard Firestore Timestamp schema
 *
 * Validates that the value is a proper Firestore Timestamp object (from firebase-admin)
 * or a FieldValue.serverTimestamp() sentinel value.
 *
 * Data contract: Firestore documents return Timestamp objects from doc.data(),
 * FirestoreReader asserts this and converts to ISO strings at the boundary.
 */
export const FirestoreTimestampSchema = z.custom<any>((val) => {
    // Accept FieldValue.serverTimestamp() sentinel (used during writes)
    if (val instanceof FieldValue) {
        return true;
    }
    // Accept admin Timestamp objects (have toDate, seconds, nanoseconds)
    if (val instanceof Timestamp) {
        return true;
    }
    return false;
}, 'Must be a Firestore Timestamp or FieldValue.serverTimestamp()');
/**
 * Pure infrastructure metadata - audit fields only
 * These are automatically managed by Firestore/application infrastructure
 */
const FirestoreAuditMetadataSchema = z.object({
    id: z.string().min(1),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
});

/**
 * Type definitions for Firestore document metadata
 */
export type FirestoreAuditMetadata = z.infer<typeof FirestoreAuditMetadataSchema>;
/**
 * Common audit fields that appear in most documents
 */
const DocumentIdSchema = z.object({
    id: z.string().min(1),
});

export const UserIdSchema = z.string().trim().min(1).describe('Firebase Auth UID').transform(toUserId) as z.ZodType<UserId>;

export const GroupIdSchema = z.string().trim().min(1).describe('Firestore Group document ID').transform(toGroupId) as z.ZodType<GroupId>;

export const GroupNameSchema = z.string().trim().min(1).describe('Group name').transform(toGroupName) as z.ZodType<GroupName>;

export const ExpenseIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Firestore Expense document ID')
    .transform(toExpenseId) as z.ZodType<ExpenseId>;

export const SettlementIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Firestore Settlement document ID')
    .transform(toSettlementId) as z.ZodType<SettlementId>;

export const CommentIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Firestore Comment document ID')
    .transform(toCommentId) as z.ZodType<CommentId>;

export const PolicyIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Firestore Policy document ID')
    .transform(toPolicyId) as z.ZodType<PolicyId>;

export const TenantIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Tenant identifier')
    .transform(toTenantId) as z.ZodType<TenantId>;

export const CurrencyCodeSchema = z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Must be a valid 3-letter currency code')
    .refine((code) => isValidCurrency(code), 'Must be a supported currency code');

export const AuditFieldsSchema = z.object({
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
});

export const OptionalAuditFieldsSchema = z.object({
    createdAt: FirestoreTimestampSchema.optional(),
    updatedAt: FirestoreTimestampSchema.optional(),
});

export const SoftDeletionFieldsSchema = z.object({
    deletedAt: FirestoreTimestampSchema.nullable(),
    deletedBy: z.string().nullable(),
});
