import type { CommentDTO, ListCommentsResponse } from '@billsplit-wl/shared';

export class ListCommentsResponseBuilder {
    private response: ListCommentsResponse = {
        comments: [],
        hasMore: false,
    };

    withComments(comments: CommentDTO[]): this {
        this.response.comments = comments;
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

    build(): ListCommentsResponse {
        return {
            comments: [...this.response.comments],
            hasMore: this.response.hasMore,
            ...(this.response.nextCursor && { nextCursor: this.response.nextCursor }),
        };
    }
}
