/**
 * Builder for creating consistent mock API responses for Playwright tests
 * Provides a fluent API for constructing HTTP responses with proper structure
 */
export class MockResponseBuilder {
    private response: {
        status: number;
        contentType: string;
        body: string;
        headers?: Record<string, string>;
    };

    constructor() {
        this.response = {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
        };
    }

    withStatus(status: number): this {
        this.response.status = status;
        return this;
    }

    withData(data: any): this {
        this.response.body = JSON.stringify(data);
        return this;
    }

    withError(message: string, code?: string): this {
        this.response.status = 400;
        this.response.body = JSON.stringify({
            error: message,
            code: code || 'GENERIC_ERROR'
        });
        return this;
    }

    withServerError(message: string = 'Internal server error'): this {
        this.response.status = 500;
        this.response.body = JSON.stringify({
            error: message,
            code: 'SERVER_ERROR'
        });
        return this;
    }

    withNotFound(message: string = 'Resource not found'): this {
        this.response.status = 404;
        this.response.body = JSON.stringify({
            error: message,
            code: 'NOT_FOUND'
        });
        return this;
    }

    withUnauthorized(message: string = 'Unauthorized'): this {
        this.response.status = 401;
        this.response.body = JSON.stringify({
            error: message,
            code: 'UNAUTHORIZED'
        });
        return this;
    }

    withForbidden(message: string = 'Forbidden'): this {
        this.response.status = 403;
        this.response.body = JSON.stringify({
            error: message,
            code: 'FORBIDDEN'
        });
        return this;
    }

    withValidationError(field: string, message: string): this {
        this.response.status = 400;
        this.response.body = JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: {
                [field]: message
            }
        });
        return this;
    }

    withContentType(contentType: string): this {
        this.response.contentType = contentType;
        return this;
    }

    withHeaders(headers: Record<string, string>): this {
        this.response.headers = { ...this.response.headers, ...headers };
        return this;
    }

    withDelay(ms: number): this {
        // Note: Delay is handled in the mock object, not the response builder
        // This method exists for API consistency but stores delay metadata
        (this.response as any)._delay = ms;
        return this;
    }

    asHtml(): this {
        this.response.contentType = 'text/html';
        return this;
    }

    asText(): this {
        this.response.contentType = 'text/plain';
        return this;
    }

    build(): any {
        return {
            status: this.response.status,
            contentType: this.response.contentType,
            body: this.response.body,
            ...(this.response.headers && { headers: this.response.headers })
        };
    }

    // Static factory methods for common response types
    static success(data?: any): MockResponseBuilder {
        const builder = new MockResponseBuilder();
        if (data !== undefined) {
            builder.withData(data);
        }
        return builder;
    }

    static created(data?: any): MockResponseBuilder {
        const builder = new MockResponseBuilder().withStatus(201);
        if (data !== undefined) {
            builder.withData(data);
        }
        return builder;
    }

    static error(message: string, code?: string): MockResponseBuilder {
        return new MockResponseBuilder().withError(message, code);
    }

    static notFound(message?: string): MockResponseBuilder {
        return new MockResponseBuilder().withNotFound(message);
    }

    static serverError(message?: string): MockResponseBuilder {
        return new MockResponseBuilder().withServerError(message);
    }

    static unauthorized(message?: string): MockResponseBuilder {
        return new MockResponseBuilder().withUnauthorized(message);
    }

    static forbidden(message?: string): MockResponseBuilder {
        return new MockResponseBuilder().withForbidden(message);
    }

    static validationError(field: string, message: string): MockResponseBuilder {
        return new MockResponseBuilder().withValidationError(field, message);
    }
}