import { Group } from '@splitifyd/shared';
import { ApiDriver } from './ApiDriver';
import { generateShortId } from './test-helpers';
import { UserToken } from '@splitifyd/shared';

interface GroupOptions {
    memberCount?: number;
    fresh?: boolean;
    description?: string;
}

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
        const { memberCount = 2, fresh = false, description } = options;

        if (memberCount > users.length) {
            throw new Error(`Requested ${memberCount} members but only ${users.length} users provided`);
        }

        if (fresh) {
            return this.createFreshGroup(users, memberCount, description);
        }

        const cacheKey = this.createCacheKey(users, memberCount);

        if (!this.groupCache.has(cacheKey)) {
            const groupPromise = this.createFreshGroup(users, memberCount, description);
            this.groupCache.set(cacheKey, groupPromise);
        }

        return this.groupCache.get(cacheKey)!;
    }

    private static async createFreshGroup(users: UserToken[], memberCount: number, description?: string): Promise<Group> {
        const groupMembers = users.slice(0, memberCount);
        const groupName = `Reusable Test Group ${generateShortId()}`;

        return this.apiDriver.createGroupWithMembers(groupName, groupMembers, groupMembers[0].token);
    }

    public static clearCache(): void {
        this.groupCache.clear();
    }

    public static getCacheSize(): number {
        return this.groupCache.size;
    }
}
