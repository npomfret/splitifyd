import { PolicyIdSchema, SystemUserRoles, toEmail, toISOString, VersionHashSchema } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { z } from 'zod';
import { OptionalAuditFieldsSchema, TenantIdSchema, UserIdSchema } from './common';

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
        acceptedPolicies: z
            .record(PolicyIdSchema, z.record(VersionHashSchema, z.string().datetime().transform(toISOString)))
            .optional(),
        signupTenantId: TenantIdSchema.optional(), // Tenant where user registered (for analytics)
    })
    .merge(OptionalAuditFieldsSchema);

/**
 * User-specific document ID schema with strongly-typed UserId
 */
const UserDocumentIdSchema = z.object({
    id: UserIdSchema,
});

/**
 * Create Document schema with strongly-typed ID
 * Apply .strip() to handle legacy fields (like removed 'themeColor' and 'displayName') for backward compatibility
 */
const UserDocumentSchema = BaseUserSchema.merge(UserDocumentIdSchema).strip();

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
