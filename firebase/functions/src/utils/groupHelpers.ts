import { Group } from '../shared/shared-types';

export const getGroupOwner = (group: Pick<Group, 'members'>): string | null => {
    for (const [userId, member] of Object.entries(group.members)) {
        if (member.role === 'owner') {
            return userId;
        }
    }
    return null;
};

export const isGroupOwner = (group: Pick<Group, 'members'>, userId: string): boolean => {
    const member = group.members[userId];
    return member?.role === 'owner' || false;
};

export const isGroupMember = (group: Pick<Group, 'members'>, userId: string): boolean => {
    return userId in group.members;
};