import type { ActivityFeedItem, ActivityFeedResponse } from '@billsplit-wl/shared';

export class ActivityFeedResponseBuilder {
    private response: ActivityFeedResponse = {
        items: [],
        hasMore: false,
    };

    withItems(items: ActivityFeedItem[]): this {
        this.response.items = items;
        return this;
    }

    withHasMore(hasMore: boolean): this {
        this.response.hasMore = hasMore;
        return this;
    }

    withNextCursor(cursor: string): this {
        this.response.nextCursor = cursor;
        return this;
    }

    withoutNextCursor(): this {
        delete this.response.nextCursor;
        return this;
    }

    build(): ActivityFeedResponse {
        return {
            items: [...this.response.items],
            hasMore: this.response.hasMore,
            ...(this.response.nextCursor && { nextCursor: this.response.nextCursor }),
        };
    }
}
