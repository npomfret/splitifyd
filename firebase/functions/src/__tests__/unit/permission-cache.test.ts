import { describe, expect, beforeEach, afterEach, vi, it } from 'vitest';
import { PermissionCache } from '../../permissions/permission-cache';

describe('PermissionCache', () => {
    let cache: PermissionCache;

    beforeEach(() => {
        cache = new PermissionCache(1000); // 1 second TTL for testing
        vi.clearAllTimers();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('check', () => {
        it('should compute and cache value on first call', () => {
            const computeFn = vi.fn(() => true);
            
            const result = cache.check('test-key', computeFn);
            
            expect(result).toBe(true);
            expect(computeFn).toHaveBeenCalledTimes(1);
        });

        it('should return cached value on subsequent calls', () => {
            const computeFn = vi.fn(() => true);
            
            cache.check('test-key', computeFn);
            const result = cache.check('test-key', computeFn);
            
            expect(result).toBe(true);
            expect(computeFn).toHaveBeenCalledTimes(1);
        });

        it('should recompute after TTL expires', () => {
            const computeFn = vi.fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false);
            
            // First call
            const result1 = cache.check('test-key', computeFn);
            expect(result1).toBe(true);
            
            // Advance time past TTL
            vi.advanceTimersByTime(1001);
            
            // Second call should recompute
            const result2 = cache.check('test-key', computeFn);
            expect(result2).toBe(false);
            expect(computeFn).toHaveBeenCalledTimes(2);
        });

        it('should use custom TTL when provided', () => {
            const computeFn = vi.fn(() => true);
            
            cache.check('test-key', computeFn, 2000); // 2 second TTL
            
            // Advance time by 1.5 seconds (still within custom TTL)
            vi.advanceTimersByTime(1500);
            
            cache.check('test-key', computeFn);
            expect(computeFn).toHaveBeenCalledTimes(1); // Should still be cached
            
            // Advance past custom TTL
            vi.advanceTimersByTime(600);
            cache.check('test-key', computeFn);
            expect(computeFn).toHaveBeenCalledTimes(2); // Should recompute
        });
    });

    describe('invalidate', () => {
        beforeEach(() => {
            // Set up cache with some entries
            cache.check('group:1:action:edit', () => true);
            cache.check('group:1:action:delete', () => false);
            cache.check('group:2:action:edit', () => true);
            cache.check('user:1:profile', () => true);
        });

        it('should clear all cache when no pattern provided', () => {
            expect(cache.size()).toBe(4);
            
            cache.invalidate();
            
            expect(cache.size()).toBe(0);
        });

        it('should clear only matching entries when pattern provided', () => {
            cache.invalidate('group:1');
            
            expect(cache.size()).toBe(2);
            
            // Verify the remaining entries
            const computeFn = vi.fn(() => true);
            cache.check('group:2:action:edit', computeFn);
            cache.check('user:1:profile', computeFn);
            expect(computeFn).toHaveBeenCalledTimes(0); // Should be cached
        });
    });

    describe('invalidateGroup', () => {
        it('should invalidate all entries for a specific group', () => {
            cache.check('group:123:user:1:action:edit', () => true);
            cache.check('group:123:user:2:action:delete', () => false);
            cache.check('group:456:user:1:action:edit', () => true);
            
            cache.invalidateGroup('123');
            
            expect(cache.size()).toBe(1);
        });
    });

    describe('invalidateUser', () => {
        it('should invalidate all entries for a specific user', () => {
            cache.check('group:1:user:123:action:edit', () => true);
            cache.check('group:2:user:123:action:delete', () => false);
            cache.check('group:1:user:456:action:edit', () => true);
            
            cache.invalidateUser('123');
            
            expect(cache.size()).toBe(1);
        });
    });

    describe('generateKey', () => {
        it('should generate consistent keys for same parameters', () => {
            const key1 = PermissionCache.generateKey('group1', 'user1', 'edit');
            const key2 = PermissionCache.generateKey('group1', 'user1', 'edit');
            
            expect(key1).toBe(key2);
            expect(key1).toBe('group:group1:user:user1:action:edit');
        });

        it('should include resource ID when provided', () => {
            const key = PermissionCache.generateKey('group1', 'user1', 'edit', 'expense1');
            
            expect(key).toBe('group:group1:user:user1:action:edit:resource:expense1');
        });

        it('should generate different keys for different parameters', () => {
            const key1 = PermissionCache.generateKey('group1', 'user1', 'edit');
            const key2 = PermissionCache.generateKey('group1', 'user2', 'edit');
            const key3 = PermissionCache.generateKey('group1', 'user1', 'delete');
            
            expect(key1).not.toBe(key2);
            expect(key1).not.toBe(key3);
            expect(key2).not.toBe(key3);
        });
    });

    describe('cleanup', () => {
        it('should remove expired entries', () => {
            const computeFn = vi.fn(() => true);
            
            // Add entries at different times
            cache.check('key1', computeFn);
            
            vi.advanceTimersByTime(500);
            cache.check('key2', computeFn);
            
            vi.advanceTimersByTime(600); // key1 should be expired, key2 still valid
            
            const removed = cache.cleanup();
            
            expect(removed).toBe(1);
            expect(cache.size()).toBe(1);
        });

        it('should return count of removed entries', () => {
            cache.check('key1', () => true);
            cache.check('key2', () => true);
            cache.check('key3', () => true);
            
            // Advance time to expire all entries
            vi.advanceTimersByTime(1001);
            
            const removed = cache.cleanup();
            expect(removed).toBe(3);
            expect(cache.size()).toBe(0);
        });

        it('should not remove non-expired entries', () => {
            cache.check('key1', () => true);
            
            // Advance time but not past TTL
            vi.advanceTimersByTime(500);
            
            const removed = cache.cleanup();
            expect(removed).toBe(0);
            expect(cache.size()).toBe(1);
        });
    });

    describe('size', () => {
        it('should return correct cache size', () => {
            expect(cache.size()).toBe(0);
            
            cache.check('key1', () => true);
            expect(cache.size()).toBe(1);
            
            cache.check('key2', () => false);
            expect(cache.size()).toBe(2);
            
            cache.invalidate();
            expect(cache.size()).toBe(0);
        });
    });
});