import { z } from 'zod';
import { MemberRoles, MemberStatuses, COLOR_PATTERNS } from '@splitifyd/shared';
import { UserIdSchema } from './common';

/**
 * Zod schema for UserThemeColor validation
 */
const UserThemeColorSchema = z.object({
    light: z.string(),
    dark: z.string(),
    name: z.string(),
    pattern: z.enum(COLOR_PATTERNS),
    assignedAt: z.string(),
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
    joinedAt: z.string(), // ISO string
    theme: UserThemeColorSchema,
    invitedBy: UserIdSchema.optional(),
    lastPermissionChange: z.string().optional(), // ISO string
    groupUpdatedAt: z.string(), // Essential denormalized field
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type ParsedTopLevelGroupMemberDocument = z.infer<typeof TopLevelGroupMemberSchema>;
