import i18n from '@/i18n';
import { logError } from '@/utils/browser-logger';
import { translateApiError } from '@/utils/error-translation';
import type { ActivityFeedItem, GroupId } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { apiClient } from '../apiClient';
import { normalizeActivityFeedItem } from '../utils/activity-feed-utils';

const PAGE_SIZE = 10;

interface GroupActivityFeedStore {
    readonly items: ActivityFeedItem[];
    readonly loading: boolean;
    readonly error: string | null;
    readonly hasMore: boolean;
    readonly loadingMore: boolean;
    readonly currentGroupId: GroupId | null;

    readonly itemsSignal: ReadonlySignal<ActivityFeedItem[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;
    readonly loadingMoreSignal: ReadonlySignal<boolean>;

    load(groupId: GroupId): Promise<void>;
    loadMore(): Promise<void>;
    reset(): void;
}

class GroupActivityFeedStoreImpl implements GroupActivityFeedStore {
    readonly #itemsSignal = signal<ActivityFeedItem[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreSignal = signal<boolean>(false);
    readonly #loadingMoreSignal = signal<boolean>(false);
    readonly #currentGroupIdSignal = signal<GroupId | null>(null);

    #nextCursor: string | null = null;

    get items() {
        return this.#itemsSignal.value;
    }

    get loading() {
        return this.#loadingSignal.value;
    }

    get error() {
        return this.#errorSignal.value;
    }

    get hasMore() {
        return this.#hasMoreSignal.value;
    }

    get loadingMore() {
        return this.#loadingMoreSignal.value;
    }

    get currentGroupId() {
        return this.#currentGroupIdSignal.value;
    }

    get itemsSignal(): ReadonlySignal<ActivityFeedItem[]> {
        return this.#itemsSignal;
    }

    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }

    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    get hasMoreSignal(): ReadonlySignal<boolean> {
        return this.#hasMoreSignal;
    }

    get loadingMoreSignal(): ReadonlySignal<boolean> {
        return this.#loadingMoreSignal;
    }

    async load(groupId: GroupId): Promise<void> {
        // Reset if different group
        if (this.#currentGroupIdSignal.value !== groupId) {
            this.reset();
            this.#currentGroupIdSignal.value = groupId;
        }

        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const response = await apiClient.getGroupActivityFeed(groupId, { limit: PAGE_SIZE });

            const normalizedItems = response.items.map(normalizeActivityFeedItem);
            this.#itemsSignal.value = normalizedItems;
            this.#hasMoreSignal.value = response.hasMore;
            this.#nextCursor = response.nextCursor ?? null;
        } catch (error) {
            logError('group-activity-feed-load-error', { error, groupId });
            this.#errorSignal.value = translateApiError(error, i18n.t.bind(i18n));
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async loadMore(): Promise<void> {
        const groupId = this.#currentGroupIdSignal.value;
        if (!groupId || !this.#hasMoreSignal.value || this.#loadingMoreSignal.value || !this.#nextCursor) {
            return;
        }

        this.#loadingMoreSignal.value = true;

        try {
            const response = await apiClient.getGroupActivityFeed(groupId, {
                limit: PAGE_SIZE,
                cursor: this.#nextCursor,
            });

            const normalizedItems = response.items.map(normalizeActivityFeedItem);
            this.#itemsSignal.value = [...this.#itemsSignal.value, ...normalizedItems];
            this.#hasMoreSignal.value = response.hasMore;
            this.#nextCursor = response.nextCursor ?? null;
        } catch (error) {
            logError('group-activity-feed-load-more-error', { error, groupId });
            this.#errorSignal.value = translateApiError(error, i18n.t.bind(i18n));
        } finally {
            this.#loadingMoreSignal.value = false;
        }
    }

    reset(): void {
        this.#itemsSignal.value = [];
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;
        this.#hasMoreSignal.value = false;
        this.#loadingMoreSignal.value = false;
        this.#currentGroupIdSignal.value = null;
        this.#nextCursor = null;
    }
}

export const groupActivityFeedStore = new GroupActivityFeedStoreImpl();
