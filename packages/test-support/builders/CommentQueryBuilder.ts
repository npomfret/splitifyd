import { randomNumber, generateShortId } from '../test-helpers';

/**
 * Builder for creating comment query parameters for testing
 * Used for testing comment listing with pagination and filtering
 */
export class CommentQueryBuilder {
    private query: any = {
        cursor: `cursor-${generateShortId()}`,
        limit: randomNumber(1, 50).toString(),
    };

    withCursor(cursor: string) {
        this.query.cursor = cursor;
        return this;
    }

    withLimit(limit: string | number) {
        this.query.limit = typeof limit === 'number' ? limit.toString() : limit;
        return this;
    }

    withInvalidLimit(invalidValue: string) {
        this.query.limit = invalidValue;
        return this;
    }

    withEmptyQuery() {
        this.query = {};
        return this;
    }

    build() {
        return { ...this.query };
    }
}
