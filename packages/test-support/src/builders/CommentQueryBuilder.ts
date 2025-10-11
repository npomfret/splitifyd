import type { CommentQuery } from '@splitifyd/shared';
import { generateShortId, randomNumber } from '../test-helpers';

/**
 * Builder for creating comment query parameters for testing
 * Used for testing comment listing with pagination and filtering
 */
export class CommentQueryBuilder {
    private query: Partial<CommentQuery> = {
        cursor: `cursor-${generateShortId()}`,
        limit: randomNumber(1, 50).toString(),
    };

    withCursor(cursor: string): this {
        this.query.cursor = cursor;
        return this;
    }

    withLimit(limit: string | number): this {
        this.query.limit = typeof limit === 'number' ? limit.toString() : limit;
        return this;
    }

    withInvalidLimit(invalidValue: string): this {
        this.query.limit = invalidValue;
        return this;
    }

    withEmptyQuery(): this {
        this.query = {};
        return this;
    }

    build(): Partial<CommentQuery> {
        return { ...this.query };
    }
}
