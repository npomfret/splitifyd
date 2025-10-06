/**
 * Helper functions for working with GroupMembershipDTO arrays
 * Used to migrate from group.members object structure to array structure
 */

import type { GroupMembershipDTO } from '@splitifyd/shared';

/**
 * Find a member document in the array by user ID
 */
export const getMemberDocFromArray = (members: GroupMembershipDTO[], userId: string): GroupMembershipDTO | undefined => {
    return members.find((member) => member.uid === userId);
};
