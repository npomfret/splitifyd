import { Group, FirestoreCollections } from '../shared/shared-types';
import { ApiError } from './errors';
import { HTTP_STATUS } from '../constants';
import { firestoreDb } from '../firebase';

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