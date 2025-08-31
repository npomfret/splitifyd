/**
 * Builder for creating comment query parameters for testing
 * Used for testing comment listing with pagination and filtering
 */
export class CommentQueryBuilder {
    private query: any = {};

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

    build() {
        return { ...this.query };
    }
}