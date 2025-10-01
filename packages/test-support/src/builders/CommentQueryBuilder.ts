import { randomNumber, generateShortId } from '../test-helpers';

interface CommentQuery {
    cursor?: string;
    limit?: string;
}

/**
 * Builder for creating comment query parameters for testing
 * Used for testing comment listing with pagination and filtering
 */
export class CommentQueryBuilder {
    private query: CommentQuery = {
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

    build(): CommentQuery {
        return { ...this.query };
    }
}
