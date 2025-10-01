import { z } from 'zod';
import { SystemUserRoles } from '@splitifyd/shared';
import { FirestoreTimestampSchema, OptionalAuditFieldsSchema, createDocumentSchemas } from './common';

/**
 * Schema for UserThemeColor object (complex theme configuration)
 */
const UserThemeColorSchema = z.object({
    light: z.string(),
    dark: z.string(),
    name: z.string(),
    pattern: z.string(),
    assignedAt: z.string(),
    colorIndex: z.number(),
});

/**
 * Base User schema without document ID
 *
 * User documents can be created incrementally, so most fields are optional.
 * The user document may contain data from Firebase Auth as well as additional
 * application-specific data.
 */
const BaseUserSchema = z
    .object({
        email: z.string().email().optional(), // Email might be in Auth only
        displayName: z.string().optional(), // Display name might be in Auth only
        themeColor: z
            .union([
                z.string(), // Legacy: simple string color
                UserThemeColorSchema, // New: complex theme object
            ])
            .optional(),
        preferredLanguage: z.string().optional(),
        role: z.nativeEnum(SystemUserRoles).optional(),
        acceptedPolicies: z.record(z.string(), z.string()).optional(),
        termsAcceptedAt: FirestoreTimestampSchema.optional(),
        cookiePolicyAcceptedAt: FirestoreTimestampSchema.optional(),
        passwordChangedAt: FirestoreTimestampSchema.optional(),
        photoURL: z.string().nullable().optional(), // Photo URL can be null or undefined
    })
    .merge(OptionalAuditFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: UserDocumentSchema, DataSchema: UserDataSchema } = createDocumentSchemas(BaseUserSchema);

/**
 * Zod schema for User document validation
 *
 * Usage:
 * ```typescript
 * const userData = UserDocumentSchema.parse(doc.data());
 * ```
 */
export { UserDocumentSchema, UserDataSchema };

/**
 * Type definitions derived from schemas
 */
export type UserDocument = z.infer<typeof UserDocumentSchema>;
type UserData = z.infer<typeof UserDataSchema>;
