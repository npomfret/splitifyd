import type { GroupMemberDocument } from '@splitifyd/shared';

/**
 * Helper functions for working with GroupMemberDocument arrays
 * Used to migrate from group.members object structure to array structure
 */

/**
 * Find a member document in the array by user ID
 */
export const getMemberDocFromArray = (members: GroupMemberDocument[], userId: string): GroupMemberDocument | undefined => {
    return members.find((member) => member.uid === userId);
};
