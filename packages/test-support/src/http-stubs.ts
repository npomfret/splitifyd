export interface StubRequestOptions {
    body?: any;
    params?: any;
    headers?: Record<string, string>;
    hostname?: string;
}

/**
 * Creates a stub request for testing.
 * Returns any to allow compatibility with different AuthenticatedRequest implementations
 * (e.g., middleware's Express-based version vs shared minimal interface).
 */
export function createStubRequest(userId: string, body: any = {}, params: any = {}, options: Partial<StubRequestOptions> = {}): any {
    return {
        // these tests skip the auth middlewhere (firebase/functions/src/auth/middleware.ts) which adds a `user` object to the request
        user: {
            // any authenticated request requires user.uid to be there, see validateUserAuth(), it represents the user who is making the request
            uid: userId,

            // not strictly needed, only used in logging
            displayName: `User ${userId}`,
        },
        body,
        params,
        headers: options.headers ?? {},
        hostname: options.hostname ?? 'localhost',
        // Tenant ID set by tenant identification middleware in production
        // For tests, use the default fallback tenant
        tenantId: 'system-fallback-tenant',
    };
}

/**
 * Creates a stub response for testing.
 * Returns any to allow compatibility with Express Response while adding test helper methods.
 */
export function createStubResponse(): any {
    let statusCode: number;
    let jsonData: any;
    let bodyData: any;
    let contentType: string | undefined;

    const res = {
        status: (code: number) => {
            statusCode = code;
            return res;
        },
        json: (data: any) => {
            jsonData = data;
            return res;
        },
        send: (data?: any) => {
            if (data !== undefined) {
                jsonData = data;
                bodyData = data;
            }
            return res;
        },
        type: (type: string) => {
            contentType = type;
            return res;
        },
        getStatus: () => statusCode,
        getJson: () => jsonData,
        getBody: () => bodyData,
        getContentType: () => contentType,
    };

    return res;
}
