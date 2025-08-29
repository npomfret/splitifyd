import { z } from 'zod';
import { 
    FirestoreTimestampSchema, 
    OptionalAuditFieldsSchema,
    UserIdSchema,
    createDocumentSchemas 
} from './common';

/**
 * Zod schema for Policy version validation
 * 
 * Each policy can have multiple versions identified by hash keys.
 */
export const PolicyVersionSchema = z.object({
    text: z.string().min(1, 'Policy text cannot be empty'),
    createdAt: FirestoreTimestampSchema,
    publishedBy: UserIdSchema.optional(), // UID of user who published this version
});

/**
 * Base Policy schema without document ID
 * 
 * Policy documents contain the policy metadata and all versions.
 * The currentVersionHash points to the active version in the versions map.
 */
const BasePolicySchema = z.object({
    policyName: z.string().min(1, 'Policy name cannot be empty'), // e.g., "terms", "privacy"
    currentVersionHash: z.string().min(1, 'Current version hash required'),
    versions: z.record(z.string(), PolicyVersionSchema), // Map of hash -> PolicyVersion
}).merge(OptionalAuditFieldsSchema);

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: PolicyDocumentSchema, DataSchema: PolicyDataSchema } = 
    createDocumentSchemas(BasePolicySchema);

/**
 * Zod schema for Policy document validation
 * 
 * Usage:
 * ```typescript
 * const policyData = PolicyDocumentSchema.parse(doc.data());
 * ```
 */
export { PolicyDocumentSchema, PolicyDataSchema };

/**
 * Type definitions derived from schemas
 */
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;
export type PolicyData = z.infer<typeof PolicyDataSchema>;
export type PolicyVersion = z.infer<typeof PolicyVersionSchema>;