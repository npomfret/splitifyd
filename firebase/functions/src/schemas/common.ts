import { z } from 'zod';
import { isValidCurrency } from '@splitifyd/shared';

/**
 * Common schema fragments for consistent validation patterns across all schemas
 */

/**
 * Standard Firestore Timestamp schema
 *
 * Note: This uses z.any() for compatibility during the transition to eliminate
 * conditional type logic. The actual validation happens in sanitizeGroupData()
 * which asserts that fields are Timestamps before allowing them through.
 *
 * Data contract: Firestore documents return Timestamp objects from doc.data(),
 * FirestoreReader asserts this and converts to ISO strings at the boundary.
 */
export const FirestoreTimestampSchema = z.any().describe('Firestore Timestamp object');

/**
 * Common audit fields that appear in most documents
 */
export const AuditFieldsSchema = z.object({
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
});

/**
 * Optional audit fields for documents that may not have them yet
 */
export const OptionalAuditFieldsSchema = z.object({
    createdAt: FirestoreTimestampSchema.optional(),
    updatedAt: FirestoreTimestampSchema.optional(),
});

/**
 * Standard soft deletion fields
 */
export const SoftDeletionFieldsSchema = z.object({
    deletedAt: FirestoreTimestampSchema.nullable(),
    deletedBy: z.string().nullable(),
});

/**
 * Document ID field that all Firestore documents have
 */
const DocumentIdSchema = z.object({
    id: z.string().min(1),
});

/**
 * Currency code validation (ISO 4217)
 * Now validates against the actual currency definitions from @splitifyd/shared
 */
export const CurrencyCodeSchema = z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Must be a valid 3-letter currency code')
    .refine((code) => isValidCurrency(code), 'Must be a valid currency code from the supported currency list');

/**
 * User ID validation
 */
export const UserIdSchema = z.string().min(1).describe('Firebase Auth UID');

/**
 * Group ID validation
 */
export const GroupIdSchema = z.string().min(1).describe('Firestore Group document ID');

/**
 * Helper to create Document + Data schema pairs consistently
 *
 * @param baseSchema - The base schema without the id field
 * @returns Object with DocumentSchema (includes id) and DataSchema (excludes id)
 */
export function createDocumentSchemas<T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) {
    const DocumentSchema = baseSchema.merge(DocumentIdSchema).passthrough();
    const DataSchema = baseSchema.passthrough();

    return {
        DocumentSchema,
        DataSchema,
    };
}

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
 * Infrastructure metadata with soft deletion support
 */
const FirestoreAuditMetadataWithDeletionSchema = FirestoreAuditMetadataSchema.extend({
    deletedAt: FirestoreTimestampSchema.nullable(),
    deletedBy: z.string().nullable(), // Note: deletedBy is business logic (who deleted) but paired with deletedAt
});

/**
 * Security-related Firestore fields for documents that need member access control
 */
const FirestoreSecurityFieldsSchema = z.object({
    memberIds: z.array(UserIdSchema).optional(),
});

/**
 * Type definitions for Firestore document metadata
 */
export type FirestoreAuditMetadata = z.infer<typeof FirestoreAuditMetadataSchema>;
export type FirestoreAuditMetadataWithDeletion = z.infer<typeof FirestoreAuditMetadataWithDeletionSchema>;
export type FirestoreSecurityFields = z.infer<typeof FirestoreSecurityFieldsSchema>;

/**
 * Schema configuration options for consistency
 */
const SCHEMA_CONFIG = {
    // Use passthrough() for forward compatibility unless strict validation is required
    defaultMode: 'passthrough' as const,

    // Standard validation modes
    strict: () => ({ strict: true as const }),
    passthrough: () => ({ passthrough: true as const }),
} as const;
