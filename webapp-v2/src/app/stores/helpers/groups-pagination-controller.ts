import type { Signal } from '@preact/signals';

interface GroupsPageResultMeta {
    hasMore: boolean;
    nextCursor?: string | null;
}

/**
 * Encapsulates pagination state for the groups dashboard so the primary store
 * can delegate cursor management and paging calculations.
 */
export class GroupsPaginationController {
    private nextCursor: string | null = null;
    private previousCursors: string[] = [];

    constructor(
        private readonly currentPageSignal: Signal<number>,
        private readonly hasMoreSignal: Signal<boolean>,
        private readonly pageSizeSignal: Signal<number>,
    ) {}

    canLoadNext(): boolean {
        return this.hasMoreSignal.value && this.nextCursor !== null;
    }

    canLoadPrevious(): boolean {
        return this.currentPageSignal.value > 1;
    }

    get pageSize(): number {
        return this.pageSizeSignal.value;
    }

    get hasMore(): boolean {
        return this.hasMoreSignal.value;
    }

    get nextPageCursor(): string | null {
        return this.nextCursor;
    }

    applyResult(meta: GroupsPageResultMeta): void {
        this.hasMoreSignal.value = meta.hasMore;
        this.nextCursor = meta.nextCursor ?? null;
    }

    /**
     * Prepare to load the next page by updating cursor history.
     * Returns the cursor that should be passed to the fetcher, or null if paging forward is not possible.
     */
    prepareNextPageCursor(): string | null {
        if (!this.canLoadNext()) {
            return null;
        }

        const cursor = this.nextCursor;
        if (cursor === null) {
            return null;
        }

        this.previousCursors.push(cursor);
        this.currentPageSignal.value += 1;
        return cursor;
    }

    /**
     * Prepare to load the previous page by rewinding cursor history.
     * Returns the cursor that should be passed to the fetcher (undefined for the first page).
     */
    preparePreviousPageCursor(): string | undefined {
        if (!this.canLoadPrevious()) {
            return undefined;
        }

        this.currentPageSignal.value -= 1;
        this.previousCursors.pop();

        if (this.currentPageSignal.value === 1) {
            return undefined;
        }

        return this.previousCursors[this.previousCursors.length - 1];
    }

    /**
     * Returns the cursor that represents the current page so refresh operations
     * can maintain the user's position.
     */
    cursorForCurrentPage(): string | undefined {
        if (this.currentPageSignal.value <= 1) {
            return undefined;
        }

        return this.previousCursors[this.previousCursors.length - 1];
    }

    setPageSize(size: number): void {
        if (size < 1) {
            throw new Error('Page size must be at least 1');
        }

        this.pageSizeSignal.value = size;
        this.reset();
    }

    reset(options?: { pageSize?: number; }): void {
        this.previousCursors = [];
        this.nextCursor = null;
        this.currentPageSignal.value = 1;
        this.hasMoreSignal.value = false;

        if (options?.pageSize !== undefined) {
            if (options.pageSize < 1) {
                throw new Error('Page size must be at least 1');
            }
            this.pageSizeSignal.value = options.pageSize;
        }
    }
}
