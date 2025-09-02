import { Group, FirestoreCollections, MemberRoles, UserThemeColor, USER_COLORS, COLOR_PATTERNS } from '@splitifyd/shared';
import { ApiError } from './errors';
import { HTTP_STATUS } from '../constants';
import { firestoreDb } from '../firebase';
import { getGroupMemberService } from '../services/serviceRegistration';

/**
 * Check if a user is the owner of a group
 * Checks if user has admin role
 * @deprecated Use isGroupOwnerAsync instead for scalable subcollection queries
 */
export const isGroupOwner = (group: Group, userId: string): boolean => {
    const member = group.members[userId];
    return member?.role === MemberRoles.ADMIN || false;
};

/**
 * Check if a user is a member of a group (any role)
 * @deprecated Use isGroupMemberAsync instead for scalable subcollection queries
 */
export const isGroupMember = (group: Group, userId: string): boolean => {
    return userId in group.members;
};

/**
 * Check if a user is the owner of a group (async version)
 * Checks if user has admin role using subcollection lookup
 */
export const isGroupOwnerAsync = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await getGroupMemberService().getMemberFromSubcollection(groupId, userId);
    return member?.role === MemberRoles.ADMIN || false;
};

/**
 * Check if a user is a member of a group (async version)
 * Uses subcollection lookup for scalable membership checks
 */
export const isGroupMemberAsync = async (groupId: string, userId: string): Promise<boolean> => {
    const member = await getGroupMemberService().getMemberFromSubcollection(groupId, userId);
    return member !== null;
};

const getGroupsCollection = () => {
    return firestoreDb.collection(FirestoreCollections.GROUPS);
};

/**
 * Verify that a user is a member of a group, throwing an error if not
 */
export const verifyGroupMembership = async (groupId: string, userId: string): Promise<void> => {
    const groupDoc = await getGroupsCollection().doc(groupId).get();

    if (!groupDoc.exists) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data();

    // Check if this is a group document (has members)
    if (!groupData || !groupData.name) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    // Check if user is a member using subcollection
    const isMember = await isGroupMemberAsync(groupId, userId);
    if (isMember) {
        return;
    }

    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
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
