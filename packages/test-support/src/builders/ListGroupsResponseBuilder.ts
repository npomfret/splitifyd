import type { Group, ListGroupsResponse, ChangeMetadata } from '@splitifyd/shared';

/**
 * Builder for creating ListGroupsResponse objects for tests
 * Creates the response format returned by the /api/groups endpoint
 */
export class ListGroupsResponseBuilder {
    private response: ListGroupsResponse;

    constructor() {
        this.response = {
            groups: [],
            count: 0,
            hasMore: false,
            pagination: {
                limit: 20,
                order: 'desc',
            },
        };
    }

    withGroups(groups: Group[]): this {
        this.response.groups = groups;
        this.response.count = groups.length;
        return this;
    }

    withCount(count: number): this {
        this.response.count = count;
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

    withPagination(pagination: { limit: number; order: string }): this {
        this.response.pagination = pagination;
        return this;
    }

    withLimit(limit: number): this {
        this.response.pagination.limit = limit;
        return this;
    }

    withOrder(order: string): this {
        this.response.pagination.order = order;
        return this;
    }

    withMetadata(metadata: ChangeMetadata): this {
        this.response.metadata = metadata;
        return this;
    }

    withServerTime(serverTime: number): this {
        if (!this.response.metadata) {
            this.response.metadata = {
                serverTime,
                lastChangeTimestamp: serverTime,
                changeCount: 0,
                hasRecentChanges: false,
            };
        } else {
            this.response.metadata.serverTime = serverTime;
        }
        return this;
    }

    withLastChangeTimestamp(timestamp: number): this {
        if (!this.response.metadata) {
            this.response.metadata = {
                serverTime: timestamp,
                lastChangeTimestamp: timestamp,
                changeCount: 0,
                hasRecentChanges: false,
            };
        } else {
            this.response.metadata.lastChangeTimestamp = timestamp;
        }
        return this;
    }

    withChangeCount(count: number): this {
        if (!this.response.metadata) {
            this.response.metadata = {
                serverTime: Date.now(),
                lastChangeTimestamp: Date.now(),
                changeCount: count,
                hasRecentChanges: count > 0,
            };
        } else {
            this.response.metadata.changeCount = count;
        }
        return this;
    }

    withHasRecentChanges(hasRecentChanges: boolean): this {
        if (!this.response.metadata) {
            this.response.metadata = {
                serverTime: Date.now(),
                lastChangeTimestamp: Date.now(),
                changeCount: hasRecentChanges ? 1 : 0,
                hasRecentChanges,
            };
        } else {
            this.response.metadata.hasRecentChanges = hasRecentChanges;
        }
        return this;
    }

    build(): ListGroupsResponse {
        return {
            groups: [...this.response.groups],
            count: this.response.count,
            hasMore: this.response.hasMore,
            ...(this.response.nextCursor && { nextCursor: this.response.nextCursor }),
            pagination: { ...this.response.pagination },
            ...(this.response.metadata && { metadata: { ...this.response.metadata } }),
        };
    }

    static emptyResponse(): ListGroupsResponseBuilder {
        return new ListGroupsResponseBuilder()
            .withGroups([])
            .withCount(0)
            .withHasMore(false);
    }

    static singleGroupResponse(group: Group): ListGroupsResponseBuilder {
        return new ListGroupsResponseBuilder()
            .withGroups([group])
            .withCount(1)
            .withHasMore(false);
    }

    static responseWithMetadata(groups: Group[], changeCount: number = 1): ListGroupsResponseBuilder {
        const now = Date.now();
        return new ListGroupsResponseBuilder()
            .withGroups(groups)
            .withServerTime(now)
            .withLastChangeTimestamp(now)
            .withChangeCount(changeCount)
            .withHasRecentChanges(changeCount > 0);
    }

    static paginatedResponse(groups: Group[], hasMore: boolean, nextCursor?: string): ListGroupsResponseBuilder {
        const builder = new ListGroupsResponseBuilder()
            .withGroups(groups)
            .withHasMore(hasMore);

        if (nextCursor) {
            builder.withNextCursor(nextCursor);
        }

        return builder;
    }
}