import type { GroupId } from '@splitifyd/shared';
import type { ListGroupsResponse, UserPolicyStatusResponse } from '@splitifyd/shared';
import type { HttpMethod, SerializedBodyMatcher, SerializedMswHandler, UrlMatchKind } from './types.ts';

export interface HandlerOptions {
    delayMs?: number;
    once?: boolean;
    status?: number;
    urlKind?: UrlMatchKind;
    query?: Record<string, string>;
    bodyMatcher?: SerializedBodyMatcher;
    headers?: Record<string, string>;
    rawBody?: string;
    contentType?: string;
}

export function createJsonHandler(
    method: HttpMethod,
    url: string,
    body: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    const { delayMs, once, status, urlKind, query, bodyMatcher, headers, rawBody, contentType } = options;

    return {
        method,
        url,
        delayMs,
        once,
        urlKind,
        query,
        bodyMatcher,
        response: {
            status,
            headers,
            body: rawBody === undefined ? body : undefined,
            rawBody,
            contentType,
        },
    };
}

export function policiesStatusHandler(
    response: UserPolicyStatusResponse,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('GET', '/api/user/policies/status', response, options);
}

export function acceptedPoliciesHandler(options: HandlerOptions = {}): SerializedMswHandler {
    return policiesStatusHandler(
        {
            needsAcceptance: false,
            policies: [
                {
                    policyId: 'terms-of-service',
                    currentVersionHash: 'hash123',
                    userAcceptedHash: 'hash123',
                    needsAcceptance: false,
                    policyName: 'Terms of Service',
                },
                {
                    policyId: 'cookie-policy',
                    currentVersionHash: 'hash456',
                    userAcceptedHash: 'hash456',
                    needsAcceptance: false,
                    policyName: 'Cookie Policy',
                },
            ],
            totalPending: 0,
        },
        options,
    );
}

export function groupsMetadataHandler(
    response: ListGroupsResponse,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('GET', '/api/groups', response, {
        ...options,
        urlKind: options.urlKind ?? 'prefix',
        query: {
            ...(options.query ?? {}),
            includeMetadata: 'true',
        },
    });
}

export function groupDetailHandler(
    groupId: GroupId,
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('GET', `/api/groups/${groupId}/full-details`, response, options);
}

export function groupCommentsHandler(
    groupId: GroupId,
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('GET', `/api/groups/${groupId}/comments`, response, options);
}

export function generateShareLinkHandler(
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('POST', '/api/groups/share', response, options);
}

export function groupPreviewHandler(
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('POST', '/api/groups/preview', response, options);
}

export function joinGroupHandler(
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('POST', '/api/groups/join', response, options);
}
