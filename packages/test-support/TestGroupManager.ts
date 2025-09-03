import { AuthenticatedFirebaseUser, Group } from '@splitifyd/shared';
import { ApiDriver } from './ApiDriver';
import { generateShortId } from './test-helpers';

interface GroupOptions {
    memberCount?: number;  
    fresh?: boolean;       
    description?: string;
}

interface GroupCacheKey {
    userIds: string[];
    memberCount: number;
}

export class TestGroupManager {
    private static groupCache: Map<string, Promise<Group>> = new Map();
    private static apiDriver = new ApiDriver();

    private static createCacheKey(users: AuthenticatedFirebaseUser[], memberCount: number): string {
        const sortedUserIds = users.slice(0, memberCount).map(u => u.uid).sort();
        return `${sortedUserIds.join('|')}:${memberCount}`;
    }

    public static async getOrCreateGroup(
        users: AuthenticatedFirebaseUser[], 
        options: GroupOptions = {}
    ): Promise<Group> {
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

    public static async getOrCreateGroupForUser(
        user: AuthenticatedFirebaseUser,
        options: Omit<GroupOptions, 'memberCount'> = {}
    ): Promise<Group> {
        return this.getOrCreateGroup([user], { ...options, memberCount: 1 });
    }

    private static async createFreshGroup(
        users: AuthenticatedFirebaseUser[], 
        memberCount: number,
        description?: string
    ): Promise<Group> {
        const groupMembers = users.slice(0, memberCount);
        const groupName = `Reusable Test Group ${generateShortId()}`;
        const groupDescription = description || `Shared test group for ${memberCount} members (${groupMembers.map(u => u.displayName).join(', ')})`;

        return this.apiDriver.createGroupWithMembers(
            groupName,
            groupMembers,
            groupMembers[0].token
        );
    }

    public static clearCache(): void {
        this.groupCache.clear();
    }

    public static getCacheSize(): number {
        return this.groupCache.size;
    }

    public static getCacheKeys(): string[] {
        return Array.from(this.groupCache.keys());
    }
}