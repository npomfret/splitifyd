import type { Signal } from '@preact/signals';

interface GroupDetailCollectionMeta {
    hasMore: boolean;
    nextCursor?: string | null;
}

/**
 * Manages cursor-based pagination state for a group-detail collection (expenses, settlements, etc.).
 * Keeps the cursor, hasMore, and loading signals in sync with the backing data array.
 */
export class GroupDetailCollectionManager<T> {
    private cursor: string | null = null;

    constructor(
        private readonly itemsSignal: Signal<T[]>,
        private readonly hasMoreSignal: Signal<boolean>,
        private readonly loadingSignal: Signal<boolean>,
    ) {}

    get items(): T[] {
        return this.itemsSignal.value;
    }

    get hasMore(): boolean {
        return this.hasMoreSignal.value;
    }

    get isLoading(): boolean {
        return this.loadingSignal.value;
    }

    get nextCursor(): string | null {
        return this.cursor;
    }

    markLoading(loading: boolean): void {
        this.loadingSignal.value = loading;
    }

    replace(items: T[], meta: GroupDetailCollectionMeta): void {
        this.itemsSignal.value = items;
        this.hasMoreSignal.value = meta.hasMore;
        this.cursor = meta.nextCursor ?? null;
        this.loadingSignal.value = false;
    }

    append(items: T[], meta: GroupDetailCollectionMeta): void {
        this.itemsSignal.value = [...this.itemsSignal.value, ...items];
        this.hasMoreSignal.value = meta.hasMore;
        this.cursor = meta.nextCursor ?? null;
        this.loadingSignal.value = false;
    }

    reset(): void {
        this.itemsSignal.value = [];
        this.hasMoreSignal.value = false;
        this.loadingSignal.value = false;
        this.cursor = null;
    }

    clearCursor(): void {
        this.cursor = null;
    }
}
