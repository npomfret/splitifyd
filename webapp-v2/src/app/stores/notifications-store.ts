import { createUserScopedStorage, type UserScopedStorage } from '@/utils/userScopedStorage';
import type { UserId } from '@billsplit-wl/shared';
import { computed, type ReadonlySignal, signal } from '@preact/signals';
import { activityFeedStore } from './activity-feed-store';

const LAST_SEEN_KEY = 'activity_feed_last_seen';

interface NotificationsStore {
    readonly hasUnread: boolean;
    readonly hasUnreadSignal: ReadonlySignal<boolean>;

    initialize(userId: UserId): void;
    markAsSeen(): void;
    reset(): void;
}

class NotificationsStoreImpl implements NotificationsStore {
    readonly #lastSeenTimestampSignal = signal<string | null>(null);
    readonly #userIdSignal = signal<UserId | null>(null);

    #storage: UserScopedStorage | null = null;

    readonly #hasUnreadSignal = computed(() => {
        const lastSeen = this.#lastSeenTimestampSignal.value;
        const items = activityFeedStore.itemsSignal.value;

        if (items.length === 0) {
            return false;
        }

        const latestItemTimestamp = items[0]?.createdAt;
        if (!latestItemTimestamp) {
            return false;
        }

        if (!lastSeen) {
            // Never seen before - has unread if there are items
            return true;
        }

        // Compare timestamps - new items are unread if newer than last seen
        return latestItemTimestamp > lastSeen;
    });

    get hasUnread(): boolean {
        return this.#hasUnreadSignal.value;
    }

    get hasUnreadSignal(): ReadonlySignal<boolean> {
        return this.#hasUnreadSignal;
    }

    initialize(userId: UserId): void {
        if (this.#userIdSignal.value === userId) {
            return;
        }

        this.#userIdSignal.value = userId;
        this.#storage = createUserScopedStorage(() => userId);

        // Load last seen timestamp from storage
        const stored = this.#storage.getItem(LAST_SEEN_KEY);
        this.#lastSeenTimestampSignal.value = stored;
    }

    markAsSeen(): void {
        if (!this.#storage) {
            return;
        }

        const items = activityFeedStore.itemsSignal.value;
        if (items.length === 0) {
            return;
        }

        const latestTimestamp = items[0]?.createdAt;
        if (latestTimestamp) {
            this.#storage.setItem(LAST_SEEN_KEY, latestTimestamp);
            this.#lastSeenTimestampSignal.value = latestTimestamp;
        }
    }

    reset(): void {
        this.#userIdSignal.value = null;
        this.#lastSeenTimestampSignal.value = null;
        this.#storage = null;
    }
}

export const notificationsStore = new NotificationsStoreImpl();
