import { MemberRoles, UserThemeColor, USER_COLORS, COLOR_PATTERNS } from '@splitifyd/shared';
import { ApiError } from './errors';
import { HTTP_STATUS } from '../constants';
import { getGroupMemberService, getFirestoreReader } from '../services/serviceRegistration';

/**
 * @deprecated Removed in Phase 5 cleanup - Use isGroupOwnerAsync instead for scalable subcollection queries
 */

/**
 * @deprecated Removed in Phase 5 cleanup - Use isGroupMemberAsync instead for scalable subcollection queries  
 */

/**
 * Check if a user is the owner of a group (async version)
 * Checks if user has admin role using subcollection lookup
 */
export const isGroupOwnerAsync = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await getGroupMemberService().getMemberFromSubcollection(groupId, userId);
    return member?.memberRole === MemberRoles.ADMIN || false;
};

/**
 * Check if a user is a member of a group (async version)
 * Uses subcollection lookup for scalable membership checks
 */
export const isGroupMemberAsync = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await getGroupMemberService().getMemberFromSubcollection(groupId, userId);
    return member !== null;
};

/**
 * Verify that a user is a member of a group, throwing an error if not
 */
export const verifyGroupMembership = async (groupId: string, userId: string): Promise<void> => {
    const isMember = await getFirestoreReader().verifyGroupMembership(groupId, userId);
    
    if (!isMember) {
        // Check if group exists first
        const group = await getFirestoreReader().getGroup(groupId);
        if (!group) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
    }
};

/**
 * Get theme color for a member based on their index
 */
export const getThemeColorForMember = (memberIndex: number): UserThemeColor => {
    const colorIndex = memberIndex % USER_COLORS.length;
    const patternIndex = Math.floor(memberIndex / USER_COLORS.length) % COLOR_PATTERNS.length;
    const color = USER_COLORS[colorIndex];
    const pattern = COLOR_PATTERNS[patternIndex];

    return {
        light: color.light,
        dark: color.dark,
        name: color.name,
        pattern,
        assignedAt: new Date().toISOString(),
        colorIndex,
    };
};
