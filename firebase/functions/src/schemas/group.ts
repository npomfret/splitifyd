import { SecurityPresets } from '@splitifyd/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, FirestoreTimestampSchema, UserIdSchema } from './common';

/**
 * Base Group schema without document ID
 *
 * Groups contain metadata about the expense-sharing group including
 * permissions and security settings. Members are stored in subcollections.
 */
const BaseGroupSchema = z
    .object({
        name: z.string().min(1, 'Group name is required'),
        description: z.string().optional(),
        createdBy: UserIdSchema,
        securityPreset: z.nativeEnum(SecurityPresets).optional(),
        permissions: z
            .object({
                expenseEditing: z.string(),
                expenseDeletion: z.string(),
                memberInvitation: z.string(),
                memberApproval: z.union([z.literal('automatic'), z.literal('admin-required')]),
                settingsManagement: z.string(),
            })
            .strict(),
        presetAppliedAt: FirestoreTimestampSchema.optional(),
        // Phase 3: Deletion state management fields
        deletionStatus: z.enum(['deleting', 'failed']).optional(),
        deletionStartedAt: FirestoreTimestampSchema.optional(),
        deletionAttempts: z.number().optional(),
    })
    .merge(AuditFieldsSchema)
    .strict();

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: GroupDocumentSchema } = createDocumentSchemas(BaseGroupSchema);

/**
 * Zod schemas for group document validation
 *
 * Usage:
 * ```typescript
 * // For reading groups with flat structure
 * const group = GroupDocumentSchema.parse({...doc.data(), id: doc.id});
 * ```
 */
export { GroupDocumentSchema };
