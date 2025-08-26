/**
 * Permission cache with TTL-based invalidation
 * Prevents repeated permission calculations for the same user/group/action combinations
 */
export class PermissionCache {
    private cache = new Map<string, { value: boolean; expires: number }>();
    private readonly defaultTtl: number;

    constructor(ttlMs: number = 60000) { // Default 1 minute TTL
        this.defaultTtl = ttlMs;
    }

    /**
     * Check cache or compute permission if not cached/expired
     */
    check(key: string, compute: () => boolean, ttlMs?: number): boolean {
        const cached = this.cache.get(key);
        const now = Date.now();
        
        if (cached && cached.expires > now) {
            return cached.value;
        }

        const value = compute();
        const ttl = ttlMs ?? this.defaultTtl;
        
        this.cache.set(key, { 
            value, 
            expires: now + ttl 
        });
        
        return value;
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Invalidate all permissions for a specific group
     */
    invalidateGroup(groupId: string): void {
        this.invalidate(`group:${groupId}`);
    }

    /**
     * Invalidate all permissions for a specific user
     */
    invalidateUser(userId: string): void {
        this.invalidate(`user:${userId}`);
    }

    /**
     * Generate cache key for permission check
     */
    static generateKey(
        groupId: string, 
        userId: string, 
        action: string, 
        resourceId?: string
    ): string {
        const parts = ['group', groupId, 'user', userId, 'action', action];
        if (resourceId) {
            parts.push('resource', resourceId);
        }
        return parts.join(':');
    }

    /**
     * Get current cache size for monitoring
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Clean up expired entries
     */
    cleanup(): number {
        const now = Date.now();
        let removed = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires <= now) {
                this.cache.delete(key);
                removed++;
            }
        }
        
        return removed;
    }
}

// Global cache instance
export const permissionCache = new PermissionCache();