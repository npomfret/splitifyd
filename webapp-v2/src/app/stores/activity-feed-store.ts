import { logError, logWarning } from '@/utils/browser-logger.ts';
import { ReadonlySignal, signal } from '@preact/signals';
import type { ActivityFeedItem, ActivityFeedResponse, UserId } from '@splitifyd/shared';
import { apiClient } from '../apiClient';
import { FirebaseActivityFeedGateway, type ActivityFeedGateway, type ActivityFeedRealtimeUpdate } from '../gateways/activity-feed-gateway';
import { normalizeActivityFeedItem } from '../utils/activity-feed-utils';
import { getFirebaseService } from '../firebase';

const ACTIVITY_FEED_PAGE_SIZE = 10;

type ActivityFeedEventListener = (event: ActivityFeedItem) => void;

export interface ActivityFeedStore {
    readonly items: ActivityFeedItem[];
    readonly loading: boolean;
    readonly initialized: boolean;
    readonly error: string | null;
    readonly hasMore: boolean;
    readonly loadingMore: boolean;

    readonly itemsSignal: ReadonlySignal<ActivityFeedItem[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly initializedSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;
    readonly loadingMoreSignal: ReadonlySignal<boolean>;

    registerComponent(componentId: string, userId: UserId): Promise<void>;
    deregisterComponent(componentId: string): void;
    registerListener(listenerId: string, userId: UserId | null, callback: ActivityFeedEventListener): Promise<void>;
    deregisterListener(listenerId: string): void;
    loadMore(): Promise<void>;
    refresh(): Promise<void>;
    reset(): void;
}

interface ListenerEntry {
    userId: UserId | null;
    callback: ActivityFeedEventListener;
}

export class ActivityFeedStoreImpl implements ActivityFeedStore {
    readonly #itemsSignal = signal<ActivityFeedItem[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #initializedSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreSignal = signal<boolean>(false);
    readonly #loadingMoreSignal = signal<boolean>(false);

    private readonly gateway: ActivityFeedGateway;
    private readonly componentSubscribers = new Map<string, string>();
    private readonly listeners = new Map<string, ListenerEntry>();
    private currentUserId: string | null = null;
    private realtimeUnsubscribe: (() => void) | null = null;
    private initializationPromise: Promise<void> | null = null;
    private nextCursor: string | null = null;
    private seenItemIds = new Set<string>();

    constructor(activityFeedGateway: ActivityFeedGateway) {
        this.gateway = activityFeedGateway;
    }

    get items() {
        return this.#itemsSignal.value;
    }

    get loading() {
        return this.#loadingSignal.value;
    }

    get initialized() {
        return this.#initializedSignal.value;
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

    get itemsSignal(): ReadonlySignal<ActivityFeedItem[]> {
        return this.#itemsSignal;
    }

    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }

    get initializedSignal(): ReadonlySignal<boolean> {
        return this.#initializedSignal;
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

    async registerComponent(componentId: string, userId: UserId): Promise<void> {
        this.componentSubscribers.set(componentId, userId);
        await this.ensureConnection(userId);
    }

    deregisterComponent(componentId: string): void {
        this.componentSubscribers.delete(componentId);
        this.evaluateTeardown();
    }

    async registerListener(listenerId: string, userId: UserId | null, callback: ActivityFeedEventListener): Promise<void> {
        const effectiveUserId = userId ?? this.currentUserId;

        this.listeners.set(listenerId, { userId: userId ?? null, callback });

        if (!effectiveUserId) {
            throw new Error('Cannot register activity feed listener without a known user id');
        }

        await this.ensureConnection(effectiveUserId);
    }

    deregisterListener(listenerId: string): void {
        this.listeners.delete(listenerId);
        this.evaluateTeardown();
    }

    async loadMore(): Promise<void> {
        if (this.#loadingMoreSignal.value || !this.hasMore || !this.nextCursor) {
            return;
        }

        this.#loadingMoreSignal.value = true;

        try {
            const response = await apiClient.getActivityFeed({
                cursor: this.nextCursor,
                limit: ACTIVITY_FEED_PAGE_SIZE,
            });

            this.applyLoadMoreResponse(response);
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'We could not load your recent activity right now. Please try again.';
            this.#errorSignal.value = message;
            logError('ActivityFeedStore.loadMore failed', error);
        } finally {
            this.#loadingMoreSignal.value = false;
        }
    }

    async refresh(): Promise<void> {
        if (!this.currentUserId) {
            return;
        }

        await this.fetchInitialFeed(false);
    }

    reset(): void {
        this.teardownRealtime();
        this.componentSubscribers.clear();
        this.listeners.clear();
        this.currentUserId = null;
        this.initializationPromise = null;
        this.nextCursor = null;
        this.seenItemIds.clear();
        this.#itemsSignal.value = [];
        this.#loadingSignal.value = false;
        this.#initializedSignal.value = false;
        this.#errorSignal.value = null;
        this.#hasMoreSignal.value = false;
        this.#loadingMoreSignal.value = false;
    }

    private async ensureConnection(userId: UserId): Promise<void> {
        if (!userId) {
            throw new Error('Cannot initialize activity feed without a user id');
        }

        if (!this.currentUserId) {
            this.currentUserId = userId;
        } else if (this.currentUserId !== userId) {
            logWarning('ActivityFeedStore: userId mismatch during initialization', {
                currentUserId: this.currentUserId,
                requestedUserId: userId,
            });
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize(userId);
            this.initializationPromise.catch((error) => {
                // Reset promise so future attempts can retry
                this.initializationPromise = null;
                logError('ActivityFeedStore: initialization failed', error);
            });
        }

        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    private async initialize(userId: UserId): Promise<void> {
        await this.gateway.connect();
        await this.fetchInitialFeed(true);
        this.setupRealtimeListener(userId);
    }

    private async fetchInitialFeed(markInitialized: boolean): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const response = await apiClient.getActivityFeed({
                limit: ACTIVITY_FEED_PAGE_SIZE,
            });

            this.applyInitialResponse(response, markInitialized);
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'We could not load your recent activity right now. Please try again.';
            this.#errorSignal.value = message;
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    private applyInitialResponse(response: ActivityFeedResponse, markInitialized: boolean): void {
        const items = (response.items ?? []).map(normalizeActivityFeedItem);

        this.#itemsSignal.value = items;
        this.#hasMoreSignal.value = Boolean(response.hasMore);
        this.nextCursor = response.nextCursor ?? null;
        this.seenItemIds = new Set(items.map((item) => item.id));

        if (markInitialized) {
            this.#initializedSignal.value = true;
        }
    }

    private applyLoadMoreResponse(response: ActivityFeedResponse): void {
        const existing = this.#itemsSignal.value;
        const existingIds = new Set(existing.map((item) => item.id));
        const mergedItems = [...existing];
        const newItems = (response.items ?? []).map(normalizeActivityFeedItem);

        for (const item of newItems) {
            if (!existingIds.has(item.id)) {
                mergedItems.push(item);
            }
        }

        this.#itemsSignal.value = mergedItems;
        this.#hasMoreSignal.value = Boolean(response.hasMore);
        this.nextCursor = response.nextCursor ?? null;

        for (const item of newItems) {
            this.seenItemIds.add(item.id);
        }
    }

    private setupRealtimeListener(userId: UserId): void {
        this.teardownRealtime();

        this.realtimeUnsubscribe = this.gateway.subscribeToFeed(
            userId,
            ACTIVITY_FEED_PAGE_SIZE,
            (update) => this.handleRealtimeUpdate(update),
            (error) => this.handleRealtimeError(error),
        );
    }

    private handleRealtimeUpdate(update: ActivityFeedRealtimeUpdate): void {
        const { items, hasMore, nextCursor } = update;
        const normalizedItems = items.map(normalizeActivityFeedItem);

        const previousItems = this.#itemsSignal.value;
        const previousIds = new Set(previousItems.map((item) => item.id));
        const trimmedIds = new Set(normalizedItems.map((item) => item.id));
        const newItems = normalizedItems.filter((item) => !previousIds.has(item.id));

        const mergedItems: ActivityFeedItem[] = [...normalizedItems];

        for (const item of previousItems) {
            if (!trimmedIds.has(item.id)) {
                mergedItems.push(item);
            }
        }

        const listChanged = mergedItems.length !== previousItems.length
            || mergedItems.some((item, index) => previousItems[index]?.id !== item.id);

        if (listChanged) {
            this.#itemsSignal.value = mergedItems;
        }

        if (hasMore !== this.#hasMoreSignal.value) {
            this.#hasMoreSignal.value = hasMore;
        }

        this.nextCursor = hasMore
            ? nextCursor ?? (normalizedItems.length > 0 ? normalizedItems[normalizedItems.length - 1]!.id : null)
            : null;

        if (!this.#initializedSignal.value) {
            this.#initializedSignal.value = true;
        }

        if (newItems.length > 0) {
            for (const item of newItems) {
                this.seenItemIds.add(item.id);
            }
            this.notifyListeners(newItems);
        }
    }

    private handleRealtimeError(error: Error): void {
        logError('ActivityFeedStore: realtime listener error', error);
        this.#errorSignal.value = error.message || 'Failed to subscribe to activity feed';
    }

    private notifyListeners(newItems: ActivityFeedItem[]): void {
        if (this.listeners.size === 0) {
            return;
        }

        for (const listener of this.listeners.values()) {
            for (const item of newItems) {
                try {
                    listener.callback(item);
                } catch (error) {
                    logError('ActivityFeedStore: listener callback failed', error);
                }
            }
        }
    }

    private evaluateTeardown(): void {
        if (this.componentSubscribers.size === 0 && this.listeners.size === 0) {
            this.teardownRealtime();
            this.initializationPromise = null;
        }
    }

    private teardownRealtime(): void {
        if (this.realtimeUnsubscribe) {
            this.realtimeUnsubscribe();
            this.realtimeUnsubscribe = null;
        }
    }
}

const defaultActivityFeedGateway = new FirebaseActivityFeedGateway(getFirebaseService());
export const activityFeedStore = new ActivityFeedStoreImpl(defaultActivityFeedGateway);
