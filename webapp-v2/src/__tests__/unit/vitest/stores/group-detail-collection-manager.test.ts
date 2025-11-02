import { GroupDetailCollectionManager } from '@/app/stores/helpers/group-detail-collection-manager';
import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it } from 'vitest';

describe('GroupDetailCollectionManager', () => {
    let itemsSignal = signal<number[]>([]);
    let hasMoreSignal = signal(false);
    let loadingSignal = signal(false);
    let manager: GroupDetailCollectionManager<number>;

    beforeEach(() => {
        itemsSignal = signal<number[]>([]);
        hasMoreSignal = signal(false);
        loadingSignal = signal(false);
        manager = new GroupDetailCollectionManager<number>(itemsSignal, hasMoreSignal, loadingSignal);
    });

    it('replaces items and stores pagination metadata', () => {
        manager.markLoading(true);
        manager.replace([1, 2, 3], { hasMore: true, nextCursor: 'cursor' });

        expect(itemsSignal.value).toEqual([1, 2, 3]);
        expect(hasMoreSignal.value).toBe(true);
        expect(loadingSignal.value).toBe(false);
        expect(manager.nextCursor).toBe('cursor');
    });

    it('appends items to the existing collection', () => {
        manager.replace([1], { hasMore: true, nextCursor: 'cursor-1' });
        manager.append([2, 3], { hasMore: false, nextCursor: null });

        expect(itemsSignal.value).toEqual([1, 2, 3]);
        expect(hasMoreSignal.value).toBe(false);
        expect(manager.nextCursor).toBeNull();
    });

    it('resets internal state', () => {
        manager.replace([1, 2], { hasMore: true, nextCursor: 'cursor' });
        manager.reset();

        expect(itemsSignal.value).toEqual([]);
        expect(hasMoreSignal.value).toBe(false);
        expect(loadingSignal.value).toBe(false);
        expect(manager.nextCursor).toBeNull();
    });
});
