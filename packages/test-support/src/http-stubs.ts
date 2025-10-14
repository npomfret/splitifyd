/**
 * Creates a stub request for testing.
 * Returns any to allow compatibility with different AuthenticatedRequest implementations
 * (e.g., middleware's Express-based version vs shared minimal interface).
 */
export function createStubRequest(userId: string, body: any = {}, params: any = {}): any {
    return {
        user: {
            uid: userId,
            displayName: `User ${userId}`,
        },
        body,
        params,
    };
}

/**
 * Creates a stub response for testing.
 * Returns any to allow compatibility with Express Response while adding test helper methods.
 */
export function createStubResponse(): any {
    let statusCode: number;
    let jsonData: any;

    const res = {
        status: (code: number) => {
            statusCode = code;
            return res;
        },
        json: (data: any) => {
            jsonData = data;
            return res;
        },
        getStatus: () => statusCode,
        getJson: () => jsonData,
    };

    return res;
}
