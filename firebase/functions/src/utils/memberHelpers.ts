import { GroupMemberWithProfile, GroupMemberDocument, MemberRoles, MemberStatuses } from '@splitifyd/shared';

/**
 * Helper functions for working with GroupMemberWithProfile arrays
 * Used to migrate from group.members object structure to array structure
 */


/**
 * Check if a user is a member of the group
 */
export const isMemberInArray = (members: GroupMemberWithProfile[], userId: string): boolean => {
    return members.some(member => member.uid === userId);
};

/**
 * Get a member's role from the array
 */
export const getMemberRole = (members: GroupMemberWithProfile[], userId: string): string | undefined => {
    const member = getMemberFromArray(members, userId);
    return member?.memberRole;
};

/**
 * Get count of active members in the array
 */
export const getActiveMemberCount = (members: GroupMemberWithProfile[]): number => {
    return members.filter(member => member.memberStatus === MemberStatuses.ACTIVE).length;
};

/**
 * Get all member user IDs from the array
 */
export const getMemberIds = (members: GroupMemberWithProfile[]): string[] => {
    return members.map(member => member.uid);
};


/**
 * Get count of admin members in the array
 */
export const getAdminCount = (members: GroupMemberWithProfile[]): number => {
    return members.filter(member => 
        member.memberRole === MemberRoles.ADMIN && 
        member.memberStatus === MemberStatuses.ACTIVE
    ).length;
};

/**
 * Check if a user is the owner (first admin) of the group
 */
export const isGroupOwnerInArray = (members: GroupMemberWithProfile[], createdBy: string, userId: string): boolean => {
    return createdBy === userId && isAdminInArray(members, userId);
};

/**
 * Helper functions for working with GroupMemberDocument arrays (from FirestoreReader)
 */

/**
 * Find a member document in the array by user ID
 */
export const getMemberDocFromArray = (members: GroupMemberDocument[], userId: string): GroupMemberDocument | undefined => {
    return members.find(member => member.userId === userId);
};

/**
 * Check if a user is an admin in the member document array
 */
export const isAdminInDocArray = (members: GroupMemberDocument[], userId: string): boolean => {
    const member = getMemberDocFromArray(members, userId);
    return member?.role === MemberRoles.ADMIN;
};

/**
 * Find a member in the array by user ID (for GroupMemberWithProfile arrays)
 */
export const getMemberFromArray = (members: GroupMemberWithProfile[], userId: string): GroupMemberWithProfile | undefined => {
    return members.find(member => member.uid === userId);
};

/**
 * Check if a user is an admin in the member array (for GroupMemberWithProfile arrays)
 */
export const isAdminInArray = (members: GroupMemberWithProfile[], userId: string): boolean => {
    const member = getMemberFromArray(members, userId);
    return member?.memberRole === MemberRoles.ADMIN;
};