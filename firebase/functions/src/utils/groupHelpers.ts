import { Group } from '../shared/shared-types';

/**
 * Get the group owner's user ID from the members map
 */
export const getGroupOwner = (group: Group): string | null => {
    for (const [userId, member] of Object.entries(group.members)) {
        if (member.role === 'owner') {
            return userId;
        }
    }
    return null;
};

/**
 * Check if a user is the owner of a group
 */
export const isGroupOwner = (group: Group, userId: string): boolean => {
    const member = group.members[userId];
    return member?.role === 'owner' || false;
};

/**
 * Check if a user is a member of a group (any role)
 */
export const isGroupMember = (group: Group, userId: string): boolean => {
    return userId in group.members;
};