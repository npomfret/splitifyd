import { COLOR_PATTERNS, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { z } from 'zod';
import { FirestoreTimestampSchema, UserIdSchema } from './common';

/**
 * Zod schema for UserThemeColor validation in Firestore documents
 * Note: assignedAt is a Timestamp because this validates Firestore documents (after ISO → Timestamp conversion)
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
 * Zod schema for TopLevelGroupMemberDocument validation
 * Used for top-level group-memberships collection documents
 */
export const TopLevelGroupMemberSchema = z.object({
    uid: UserIdSchema,
    groupId: z.string(),
    memberRole: z.nativeEnum(MemberRoles),
    memberStatus: z.nativeEnum(MemberStatuses),
    joinedAt: FirestoreTimestampSchema,
    theme: UserThemeColorSchema,
    invitedBy: UserIdSchema.optional(),
    groupUpdatedAt: FirestoreTimestampSchema, // Essential denormalized field
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
});
