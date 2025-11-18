import { isValidCurrency, toGroupId, toGroupName } from '@billsplit-wl/shared';
import type { GroupId, GroupName } from '@billsplit-wl/shared';
import { z } from 'zod';
import { FieldValue, Timestamp } from '../firestore-wrapper';

/**
 * Common schema fragments for consistent validation patterns across all schemas
 */

/**
 * Helper to create Document + Data schema pairs consistently
 *
 * @param baseSchema - The base schema without the id field
 * @returns Object with DocumentSchema (includes id) and DataSchema (excludes id)
 *
 * Note: Schemas are strict by default (no .passthrough()) to enforce type safety.
 * All fields must be explicitly defined in the schema.
 */
export function createDocumentSchemas<T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) {
    const DocumentSchema = baseSchema.merge(DocumentIdSchema).strict();

    return {
        DocumentSchema,
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

export const UserIdSchema = z.string().min(1).describe('Firebase Auth UID');

export const GroupIdSchema = z.string().min(1).describe('Firestore Group document ID').transform(toGroupId) as z.ZodType<GroupId>;

export const GroupNameSchema = z.string().min(1).describe('Group name').transform(toGroupName) as z.ZodType<GroupName>;

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
