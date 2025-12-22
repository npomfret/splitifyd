import type { ClientAppConfiguration, ClientUser, GroupId, ListGroupsResponse, UserPolicyStatusResponse } from '@billsplit-wl/shared';
import { AppConfigurationBuilder, UserPolicyStatusResponseBuilder } from '@billsplit-wl/test-support';
import type { HttpMethod, SerializedBodyMatcher, SerializedMswHandler, UrlMatchKind } from './types.ts';

interface HandlerOptions {
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
    return policiesStatusHandler(new UserPolicyStatusResponseBuilder().build(), options);
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
    groupId: GroupId | string,
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('GET', `/api/groups/${groupId}/full-details`, response, options);
}

export function groupCommentsHandler(
    groupId: GroupId | string,
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

export function registerSuccessHandler(
    user: ClientUser,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler(
        'POST',
        '/api/register',
        {
            success: true,
            message: 'Registration successful',
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
            },
        },
        options,
    );
}

export function registerFailureHandler(
    error: { code: string; message: string; },
    options: HandlerOptions = {},
): SerializedMswHandler {
    const { status = 400, ...rest } = options;
    return createJsonHandler(
        'POST',
        '/api/register',
        {
            error: {
                code: error.code,
                message: error.message,
            },
        },
        {
            status,
            ...rest,
        },
    );
}

export function firebaseInitConfigHandler(options: HandlerOptions = {}): SerializedMswHandler {
    return createJsonHandler('GET', '/__/firebase/init.json', new AppConfigurationBuilder().build().firebase, options);
}

export function updateExpenseHandler(
    expenseId: string,
    response: unknown,
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler('PUT', `/api/expenses`, response, {
        ...options,
        urlKind: options.urlKind ?? 'prefix',
        query: {
            ...(options.query ?? {}),
            id: expenseId,
        },
    });
}

export function appConfigHandler(options: HandlerOptions = {}): SerializedMswHandler {
    return createJsonHandler('GET', '/api/config', new AppConfigurationBuilder().build(), options);
}

export function customAppConfigHandler(config: ClientAppConfiguration, options: HandlerOptions = {}): SerializedMswHandler {
    return createJsonHandler('GET', '/api/config', config, options);
}

export function loginSuccessHandler(
    customToken: string = 'mock-custom-token',
    options: HandlerOptions = {},
): SerializedMswHandler {
    return createJsonHandler(
        'POST',
        '/api/login',
        {
            success: true,
            customToken,
        },
        options,
    );
}

export function loginFailureHandler(
    error: { code: string; message: string; },
    options: HandlerOptions = {},
): SerializedMswHandler {
    const { status = 401, ...rest } = options;
    return createJsonHandler(
        'POST',
        '/api/login',
        {
            error: {
                code: error.code,
                message: error.message,
            },
        },
        {
            status,
            ...rest,
        },
    );
}

