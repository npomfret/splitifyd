import { Group, FirestoreCollections, MemberRoles, UserThemeColor, USER_COLORS, COLOR_PATTERNS } from '@splitifyd/shared';
import { ApiError } from './errors';
import { HTTP_STATUS } from '../constants';
import { firestoreDb } from '../firebase';

/**
 * Get the group owner's user ID from the members map
 * Returns the first admin found, prioritizing the creator if they're an admin
 * @throws Error if no admin exists (invalid state)
 */
export const getGroupOwner = (group: Group): string => {
    // First check if the creator is still an admin
    const creator = group.members[group.createdBy];
    if (creator && creator.role === MemberRoles.ADMIN) {
        return group.createdBy;
    }

    // Otherwise, find any admin
    for (const [userId, member] of Object.entries(group.members)) {
        if (member.role === MemberRoles.ADMIN) {
            return userId;
        }
    }

    // Groups must have at least one admin - this is an invalid state
    throw new Error(`Group ${group.id} has no admin - invalid state`);
};

/**
 * Check if a user is the owner of a group
 * Checks if user has admin role
 */
export const isGroupOwner = (group: Group, userId: string): boolean => {
    const member = group.members[userId];
    return member?.role === MemberRoles.ADMIN || false;
};

/**
 * Check if a user is a member of a group (any role)
 */
export const isGroupMember = (group: Group, userId: string): boolean => {
    return userId in group.members;
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

    // Check if this is a group document (has data.members)
    if (!groupData || !groupData.data || !groupData.data.name) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
    }

    // Check if user is a member (including owner)
    if (userId in groupData.data.members) {
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
