import type { ClientUser, GroupId, ListGroupsResponse, UserPolicyStatusResponse } from '@splitifyd/shared';
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
            error: error.message,
            code: error.code,
        },
        {
            status,
            ...rest,
        },
    );
}

export function firebaseInitConfigHandler(options: HandlerOptions = {}): SerializedMswHandler {
    return createJsonHandler(
        'GET',
        '/__/firebase/init.json',
        {
            apiKey: 'mock-api-key',
            authDomain: 'mock-project.firebaseapp.com',
            projectId: 'mock-project',
            storageBucket: 'mock-project.appspot.com',
            messagingSenderId: '123456789',
            appId: '1:123456789:web:abcdef',
        },
        options,
    );
}

export function appConfigHandler(options: HandlerOptions = {}): SerializedMswHandler {
    return createJsonHandler(
        'GET',
        '/api/config',
        {
            firebase: {
                apiKey: 'mock-api-key',
                authDomain: 'mock-project.firebaseapp.com',
                projectId: 'mock-project',
                storageBucket: 'mock-project.appspot.com',
                messagingSenderId: '123456789',
                appId: '1:123456789:web:abcdef',
            },
            environment: {
                name: 'test',
                apiUrl: 'http://localhost:5001',
            },
            formDefaults: {
                currency: 'USD',
                splitType: 'equal',
            },
            tenant: {
                tenantId: 'system-fallback-tenant',
                branding: {
                    appName: 'Splitifyd',
                    logoUrl: '/logo.svg',
                    faviconUrl: '/favicon.ico',
                    primaryColor: '#1a73e8',
                    secondaryColor: '#34a853',
                    marketingFlags: {
                        showLandingPage: true,
                        showMarketingContent: true,
                        showPricingPage: true,
                        showBlogPage: false,
                    },
                },
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-01T00:00:00.000Z',
            },
        },
        options,
    );
}
