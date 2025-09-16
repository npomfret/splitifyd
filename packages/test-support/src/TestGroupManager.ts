import { Group } from '@splitifyd/shared';
import { ApiDriver } from './ApiDriver';
import { generateShortId } from './test-helpers';
import { UserToken } from '@splitifyd/shared';

interface GroupOptions {
    memberCount?: number;
    fresh?: boolean;
    description?: string;
}

/**
 * @deprecated this is pointless and fragile - if users are added or removed then it will return incorrect groups
 */
export class TestGroupManager {
    private static groupCache: Map<string, Promise<Group>> = new Map();
    private static apiDriver = new ApiDriver();

    private static createCacheKey(users: UserToken[], memberCount: number): string {
        const sortedUserIds = users
            .slice(0, memberCount)
            .map((u) => u.uid)
            .sort();
        return `${sortedUserIds.join('|')}:${memberCount}`;
    }

    public static async getOrCreateGroup(users: UserToken[], options: GroupOptions = {}): Promise<Group> {
        const { memberCount = 2, fresh = false } = options;

        if (memberCount > users.length) {
            throw new Error(`Requested ${memberCount} members but only ${users.length} users provided`);
        }

        if (fresh) {
            return this.createFreshGroup(users, memberCount);
        }

        const cacheKey = this.createCacheKey(users, memberCount);

        if (!this.groupCache.has(cacheKey)) {
            const groupPromise = this.createFreshGroup(users, memberCount);
            this.groupCache.set(cacheKey, groupPromise);
        }

        return this.groupCache.get(cacheKey)!;
    }

    private static async createFreshGroup(users: UserToken[], memberCount: number): Promise<Group> {
        const groupMembers = users.slice(0, memberCount);
        const groupName = `Reusable Test Group ${generateShortId()}`;

        return this.apiDriver.createGroupWithMembers(groupName, groupMembers, groupMembers[0].token);
    }
}
