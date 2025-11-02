import { GroupsPaginationController } from '@/app/stores/helpers/groups-pagination-controller';
import { signal } from '@preact/signals';
import { describe, expect, it } from 'vitest';

const createController = () => {
    const currentPage = signal(1);
    const hasMore = signal(false);
    const pageSize = signal(8);
    const controller = new GroupsPaginationController(currentPage, hasMore, pageSize);
    return { controller, currentPage, hasMore, pageSize };
};

describe('GroupsPaginationController', () => {
    it('applies result metadata and enables next-page navigation', () => {
        const { controller, hasMore } = createController();

        controller.applyResult({ hasMore: true, nextCursor: 'cursor-1' });

        expect(hasMore.value).toBe(true);
        expect(controller.canLoadNext()).toBe(true);
        expect(controller.nextPageCursor).toBe('cursor-1');
    });

    it('advances to the next page and records cursor history', () => {
        const { controller, currentPage } = createController();

        controller.applyResult({ hasMore: true, nextCursor: 'cursor-1' });
        const cursor = controller.prepareNextPageCursor();

        expect(cursor).toBe('cursor-1');
        expect(currentPage.value).toBe(2);
    });

    it('rewinds to the previous page when navigating back', () => {
        const { controller, currentPage } = createController();

        controller.applyResult({ hasMore: true, nextCursor: 'cursor-1' });
        controller.prepareNextPageCursor();
        controller.applyResult({ hasMore: true, nextCursor: 'cursor-2' });
        controller.prepareNextPageCursor();

        const previousCursor = controller.preparePreviousPageCursor();

        expect(currentPage.value).toBe(2);
        expect(previousCursor).toBe('cursor-1');
    });

    it('resets pagination when page size changes', () => {
        const { controller, currentPage, hasMore, pageSize } = createController();

        controller.applyResult({ hasMore: true, nextCursor: 'cursor-1' });
        controller.prepareNextPageCursor();

        controller.setPageSize(12);

        expect(pageSize.value).toBe(12);
        expect(currentPage.value).toBe(1);
        expect(hasMore.value).toBe(false);
        expect(controller.nextPageCursor).toBeNull();
    });
});
