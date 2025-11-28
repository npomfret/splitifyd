import type { ActivityFeedItem } from '@billsplit-wl/shared';

export interface ActivityFeedRealtimePayload {
    items: ActivityFeedItem[];
    newItems: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor: string | null;
}

export class ActivityFeedRealtimePayloadBuilder {
    private payload: ActivityFeedRealtimePayload = {
        items: [],
        newItems: [],
        hasMore: false,
        nextCursor: null,
    };

    withItems(items: ActivityFeedItem[]): this {
        this.payload.items = items;
        return this;
    }

    withNewItems(newItems: ActivityFeedItem[]): this {
        this.payload.newItems = newItems;
        return this;
    }

    withHasMore(hasMore: boolean): this {
        this.payload.hasMore = hasMore;
        return this;
    }

    withNextCursor(cursor: string | null): this {
        this.payload.nextCursor = cursor;
        return this;
    }

    /** Sets nextCursor to null (use when there are no more pages) */
    withNullCursor(): this {
        this.payload.nextCursor = null;
        return this;
    }

    /** Alias for withNullCursor() - reads more naturally in some contexts */
    withoutNextCursor(): this {
        return this.withNullCursor();
    }

    build(): ActivityFeedRealtimePayload {
        return {
            items: [...this.payload.items],
            newItems: [...this.payload.newItems],
            hasMore: this.payload.hasMore,
            nextCursor: this.payload.nextCursor,
        };
    }
}
