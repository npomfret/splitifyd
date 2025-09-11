import { GroupMemberWithProfile, MemberRoles } from '@splitifyd/shared';
import type { GroupMemberDocument } from '@splitifyd/shared';

/**
 * Helper functions for working with GroupMemberWithProfile arrays
 * Used to migrate from group.members object structure to array structure
 */

/**
 * Find a member document in the array by user ID
 */
export const getMemberDocFromArray = (members: GroupMemberDocument[], userId: string): GroupMemberDocument | undefined => {
    return members.find((member) => member.userId === userId);
};

/**
 * Check if a user is an admin in the member document array
 */
export const isAdminInDocArray = (members: GroupMemberDocument[], userId: string): boolean => {
    const member = getMemberDocFromArray(members, userId);
    return member?.memberRole === MemberRoles.ADMIN;
};

/**
 * Find a member in the array by user ID (for GroupMemberWithProfile arrays)
 */
export const getMemberFromArray = (members: GroupMemberWithProfile[], userId: string): GroupMemberWithProfile | undefined => {
    return members.find((member) => member.uid === userId);
};
