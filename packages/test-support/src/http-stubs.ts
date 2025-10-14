import type { AuthenticatedUser } from '@splitifyd/shared';
import type { Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

export function createStubRequest(userId: string, body: any = {}, params: any = {}): AuthenticatedRequest {
    return {
        user: {
            uid: userId,
            displayName: `User ${userId}`,
        },
        body,
        params,
    } as AuthenticatedRequest;
}

export function createStubResponse(): Response & {
    getStatus: () => number;
    getJson: () => any;
} {
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
    } as any;

    return res;
}
