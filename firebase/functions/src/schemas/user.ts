import { PolicyIdSchema, VersionHashSchema, SystemUserRoles, toEmail } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { z } from 'zod';
import { createDocumentSchemas, FirestoreTimestampSchema, OptionalAuditFieldsSchema } from './common';

/**
 * Base User schema without document ID
 *
 * User documents can be created incrementally, so most fields are optional.
 * The user document may contain data from Firebase Auth as well as additional
 * application-specific data.
 */
const BaseUserSchema = z
    .object({
        email: z.string().email().transform(toEmail).optional() as z.ZodOptional<z.ZodType<Email>>, // Email might be in Auth only
        preferredLanguage: z.string().optional(),
        role: z.nativeEnum(SystemUserRoles),
        acceptedPolicies: z.record(PolicyIdSchema, VersionHashSchema).optional(),
        termsAcceptedAt: FirestoreTimestampSchema.optional(),
        cookiePolicyAcceptedAt: FirestoreTimestampSchema.optional(),
        privacyPolicyAcceptedAt: FirestoreTimestampSchema.optional(),
        passwordChangedAt: FirestoreTimestampSchema.optional(),
    })
    .merge(OptionalAuditFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 * Apply .strip() to handle legacy fields (like removed 'themeColor' and 'displayName') for backward compatibility
 */
const { DocumentSchema } = createDocumentSchemas(BaseUserSchema);
const UserDocumentSchema = DocumentSchema.strip();

/**
 * Zod schema for User document validation
 *
 * Usage:
 * ```typescript
 * const userData = UserDocumentSchema.parse(doc.data());
 * ```
 */
export type UserDocument = z.infer<typeof UserDocumentSchema>;

export { UserDocumentSchema };
