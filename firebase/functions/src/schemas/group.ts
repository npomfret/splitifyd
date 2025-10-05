import { z } from 'zod';
import { SecurityPresets, MemberRoles, MemberStatuses, COLOR_PATTERNS } from '@splitifyd/shared';
import { FirestoreTimestampSchema, AuditFieldsSchema, UserIdSchema, createDocumentSchemas } from './common';

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
const { DocumentSchema: GroupDocumentSchema, DataSchema: GroupDataSchema } = createDocumentSchemas(BaseGroupSchema);

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
 * Type definitions derived from schemas (Internal use only)
 * Note: GroupDocument type removed from exports after DTO migration.
 * Services should use GroupDTO from @splitifyd/shared instead.
 */
type GroupDocument = z.infer<typeof GroupDocumentSchema>;

/**
 * Zod schema for UserThemeColor validation in Firestore documents
 * Note: assignedAt is a Timestamp because this validates Firestore documents (before ISO → DTO conversion)
 */
const UserThemeColorSchema = z.object({
    light: z.string(),
    dark: z.string(),
    name: z.string(),
    pattern: z.enum(COLOR_PATTERNS),
    assignedAt: FirestoreTimestampSchema,
    colorIndex: z.number(),
});

/**
 * Zod schema for GroupMemberDocument validation
 * Used for subcollection member documents with different structure than GroupMember
 */
export const GroupMemberDocumentSchema = z
    .object({
        uid: UserIdSchema,
        groupId: z.string(), // For collectionGroup queries
        memberRole: z.nativeEnum(MemberRoles),
        theme: UserThemeColorSchema,
        joinedAt: FirestoreTimestampSchema,
        memberStatus: z.nativeEnum(MemberStatuses),
        invitedBy: UserIdSchema.optional(), // UID of the user who created the share link that was used to join
    })
    .strict();

/**
 * Internal type for schema validation only.
 * Services should use GroupMembershipDTO from @splitifyd/shared.
 */
type ParsedGroupMemberDocument = z.infer<typeof GroupMemberDocumentSchema>;
