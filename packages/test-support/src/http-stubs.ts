import { UserId } from "@splitifyd/shared";

/**
 * Creates a stub request for testing.
 * Returns any to allow compatibility with different AuthenticatedRequest implementations
 * (e.g., middleware's Express-based version vs shared minimal interface).
 */
export function createStubRequest(userId: UserId, body: any = {}, params: any = {}): any {
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
