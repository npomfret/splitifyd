import { z } from 'zod';
import { SecurityPresets, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { 
    FirestoreTimestampSchema, 
    AuditFieldsSchema,
    UserIdSchema,
    createDocumentSchemas 
} from './common';

/**
 * Zod schema for Group member validation
 * 
 * Each group member has a role, status, and optional theme color assignment.
 */
export const GroupMemberSchema = z
    .object({
        role: z.nativeEnum(MemberRoles),
        status: z.nativeEnum(MemberStatuses),
        joinedAt: FirestoreTimestampSchema,
        invitedBy: UserIdSchema.optional(),
        invitedAt: FirestoreTimestampSchema.optional(),
        color: z
            .object({
                light: z.string(),
                dark: z.string(),
                name: z.string(),
                pattern: z.string(),
                assignedAt: z.string(),
                colorIndex: z.number(),
            })
            .optional(),
    })
    .passthrough();

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
            .passthrough() // Allow extra fields like settlementCreation, memberManagement, groupManagement
            .optional(),
        presetAppliedAt: FirestoreTimestampSchema.optional(),
    })
    .merge(AuditFieldsSchema)
    .passthrough();

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: GroupDocumentSchema, DataSchema: GroupDataSchema } = 
    createDocumentSchemas(BaseGroupSchema);


/**
 * Zod schemas for group document validation
 * 
 * Usage:
 * ```typescript
 * // For reading groups with flat structure
 * const group = GroupDocumentSchema.parse({...doc.data(), id: doc.id});
 * 
 * // For validating data before writing
 * const validData = GroupDataSchema.parse(groupData);
 * ```
 */
export { GroupDocumentSchema, GroupDataSchema };

/**
 * Type definitions derived from schemas
 */
export type GroupDocument = z.infer<typeof GroupDocumentSchema>;
export type GroupData = z.infer<typeof GroupDataSchema>;
export type GroupMember = z.infer<typeof GroupMemberSchema>;