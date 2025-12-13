import { FirebaseService } from '@/app/firebase.ts';
import {
    acceptedPoliciesHandler,
    appConfigHandler,
    createJsonHandler,
    firebaseInitConfigHandler,
    generateShareLinkHandler,
    groupCommentsHandler,
    groupDetailHandler,
    groupPreviewHandler,
    groupsMetadataHandler,
    joinGroupHandler,
    loginFailureHandler,
    loginSuccessHandler,
    registerFailureHandler,
    registerSuccessHandler,
    updateExpenseHandler,
} from '@/test/msw/handlers.ts';
import type { SerializedMswHandler } from '@/test/msw/types.ts';
import { type ActivityFeedItem, ApiSerializer, ClientUser, ExpenseId, GroupId, ListGroupsResponse, SystemUserRoles, TenantConfigBuilder, UserId, type UserProfileResponse } from '@billsplit-wl/shared';
import type { Page, Response, Route } from '@playwright/test';

interface AuthError {
    code: string;
    message: string;
}

interface MockFirebaseState {
    currentUser: ClientUser | null;
    loginBehavior: 'success' | 'failure' | 'delayed' | 'unconfigured';
    successUser: ClientUser | null;
    failureError: AuthError | null;
    delayMs?: number;
}

declare global {
    interface Window {
        __TEST_ENV__?: {
            firebase: {
                currentUser: ClientUser | null;
                authCallback: Function | null;
                firestoreListeners: Map<string, Function>;
            };
            cleanup: () => void;
        };
    }
}

/**
 * Fulfills a Playwright route with automatic API response serialization
 * This helper eliminates duplication and fragility from inline test mocks
 * @param route - Playwright route object from route handler
 * @param options - Response options (status, body, optional headers)
 */
export async function fulfillWithSerialization(
    route: Route,
    options: {
        status?: number;
        body: unknown;
        headers?: Record<string, string>;
    },
): Promise<void> {
    await route.fulfill({
        status: options.status ?? 200,
        contentType: 'application/x-serialized-json',
        headers: options.headers,
        body: ApiSerializer.serialize(options.body),
    });
}

async function registerMswHandlers(page: Page, handlers: SerializedMswHandler | SerializedMswHandler[]): Promise<void> {
    const controller = (page as any).__mswController as {
        use(handler: SerializedMswHandler | SerializedMswHandler[]): Promise<void>;
    } | undefined;

    if (!controller) {
        throw new Error('MSW controller is not initialized. Ensure the msw fixture is enabled.');
    }

    await controller.use(handlers);
}

/**
 * Creates a mock Firebase service for Playwright tests
 * @param page - Playwright page instance
 * @param initialUser - User to start authenticated with, or null for logged out
 * @returns MockFirebase instance
 */
export async function createMockFirebase(page: Page, initialUser: ClientUser | null = null): Promise<MockFirebase> {
    const mock = new MockFirebase(page);
    await mock.initialize(initialUser);
    return mock;
}

export class MockFirebase {
    private page: Page;
    private state: MockFirebaseState;
    private initialized = false;

    constructor(page: Page) {
        this.page = page;
        this.state = {
            currentUser: null,
            loginBehavior: 'unconfigured',
            successUser: null,
            failureError: null,
            delayMs: undefined,
        };
    }

    async initialize(initialUser: ClientUser | null): Promise<void> {
        if (this.initialized) {
            throw new Error('MockFirebase already initialized');
        }

        this.state.currentUser = initialUser;
        await this.createBrowserGlobals(initialUser);
        this.initialized = true;
    }

    private async updateAuthState(user: ClientUser | null): Promise<void> {
        this.state.currentUser = user;
        await this.page.evaluate((nextUser) => {
            window.__TEST_ENV__!.firebase.currentUser = nextUser;
            if (window.__TEST_ENV__!.firebase.authCallback) {
                const token = nextUser ? `mock-token-for-${nextUser.uid}` : null;
                window.__TEST_ENV__!.firebase.authCallback(nextUser, token);
            }
        }, user);
    }

    private async createBrowserGlobals(initialUser: ClientUser | null): Promise<void> {
        // Mock Firebase config endpoints to prevent "Failed to fetch config" errors
        await registerMswHandlers(this.page, [firebaseInitConfigHandler(), appConfigHandler()]);

        await this.page.addInitScript((initialUser: any) => {
            const mockService: FirebaseService = {
                connect: () => Promise.resolve(),
                performTokenRefresh: () => Promise.resolve('mock-token'),
                performUserRefresh: () => Promise.resolve(),
                setPersistence: () => Promise.resolve(),
                onAuthStateChanged: (callback) => {
                    // Store callback for future auth state changes
                    window.__TEST_ENV__!.firebase.authCallback = callback;

                    // Immediately trigger with initial state
                    const token = initialUser ? `mock-token-for-${initialUser.uid}` : null;
                    callback(initialUser, token);

                    return () => {
                        window.__TEST_ENV__!.firebase.authCallback = null;
                    };
                },
                signInWithCustomToken: async (customToken) => {
                    return (window as any).__testHarnessMockSignInWithCustomToken(customToken);
                },
                signOut: async () => {
                    return (window as any).__testHarnessMockSignOut();
                },
                onDocumentSnapshot: (collection, documentId, onData, onError) => {
                    const path = `${collection}/${documentId}`;
                    window.__TEST_ENV__!.firebase.firestoreListeners.set(path, onData);
                    return () => {
                        window.__TEST_ENV__!.firebase.firestoreListeners.delete(path);
                    };
                },
                onCollectionSnapshot: (pathSegments, _options, onData, _onError) => {
                    const path = pathSegments.join('/');
                    const key = `collection:${path}`;
                    window.__TEST_ENV__!.firebase.firestoreListeners.set(key, onData);
                    return () => {
                        window.__TEST_ENV__!.firebase.firestoreListeners.delete(key);
                    };
                },
                getCurrentUserId: () => {
                    return window.__TEST_ENV__!.firebase.currentUser?.uid || null;
                },
            };

            // Set up test environment globals
            window.__TEST_ENV__ = {
                firebase: {
                    currentUser: initialUser,
                    authCallback: null,
                    firestoreListeners: new Map(),
                },
                cleanup: () => {
                    delete window.__TEST_ENV__;
                    if (typeof (window as any).__resetFirebaseForTests === 'function') {
                        (window as any).__resetFirebaseForTests();
                    }
                },
            };

            if (typeof (window as any).__provideFirebaseForTests === 'function') {
                (window as any).__provideFirebaseForTests(mockService);
            } else {
                const queue = (window as any).__pendingFirebaseServiceOverrides ?? [];
                queue.push(mockService);
                (window as any).__pendingFirebaseServiceOverrides = queue;
            }
        }, initialUser);

        // Expose sign in/out functions (check if already exposed for browser reuse)
        try {
            await this.page.exposeFunction('__testHarnessMockSignInWithCustomToken', this.handleSignInWithCustomToken.bind(this));
            await this.page.exposeFunction('__testHarnessMockSignOut', this.handleSignOut.bind(this));
        } catch (error) {
            // Functions already exposed (browser reuse) - this is expected and safe to ignore
            if (error instanceof Error && !error.message?.includes('has been already registered')) {
                throw error;
            }
        }
    }

    private async handleSignInWithCustomToken(_customToken: string): Promise<void> {
        // Custom token login uses the same success user as email/password login
        // The token is returned by the API after successful authentication
        if (this.state.loginBehavior === 'failure' && this.state.failureError) {
            throw this.state.failureError;
        }

        if ((this.state.loginBehavior === 'success' || this.state.loginBehavior === 'delayed') && this.state.successUser) {
            if (this.state.loginBehavior === 'delayed' && this.state.delayMs) {
                await new Promise((resolve) => setTimeout(resolve, this.state.delayMs));
            }

            await this.updateAuthState(this.state.successUser);
            return;
        }

        throw new Error('Mock login not configured. Use mockLoginSuccess(), mockLoginWithDelay(), or mockLoginFailure() first.');
    }

    private async handleSignOut(): Promise<void> {
        await this.updateAuthState(null);
    }

    public async mockLoginSuccess(user: ClientUser): Promise<void> {
        this.state.loginBehavior = 'success';
        this.state.successUser = user;
        this.state.failureError = null;

        // Register API handler for /api/login
        await registerMswHandlers(this.page, loginSuccessHandler('mock-custom-token', { once: true }));
    }

    public async mockLoginFailure(error: AuthError): Promise<void> {
        this.state.loginBehavior = 'failure';
        this.state.successUser = null;
        this.state.failureError = error;

        // Register API handler for /api/login failure
        await registerMswHandlers(this.page, loginFailureHandler(error, { once: true }));
    }

    public async mockLoginWithDelay(user: ClientUser, delayMs: number): Promise<void> {
        this.state.loginBehavior = 'delayed';
        this.state.successUser = user;
        this.state.failureError = null;
        this.state.delayMs = delayMs;

        // Register API handler for /api/login with delay
        await registerMswHandlers(this.page, loginSuccessHandler('mock-custom-token', { once: true, delayMs }));
    }

    /**
     * Mock successful registration - sets up /register API endpoint to succeed
     * and automatically triggers authentication after success
     */
    public async mockRegisterSuccess(user: ClientUser): Promise<void> {
        await this.registerSuccessHandler(user, {});
    }

    /**
     * Mock failed registration - sets up /register API endpoint to fail with error
     */
    public async mockRegisterFailure(error: AuthError): Promise<void> {
        await registerMswHandlers(this.page, registerFailureHandler(error, { once: true }));
    }

    /**
     * Mock registration with delay - useful for testing loading states
     */
    public async mockRegisterWithDelay(user: ClientUser, delayMs: number): Promise<void> {
        await this.registerSuccessHandler(user, { delayMs });
    }

    public async emitActivityFeedItems(userId: UserId, items: ActivityFeedItem[]): Promise<void> {
        if (!Array.isArray(items) || items.length === 0) {
            return;
        }

        const docs = items.map((item) => ({
            id: item.id,
            data: {
                userId: item.userId ?? userId,
                groupId: item.groupId,
                groupName: item.groupName,
                eventType: item.eventType,
                action: item.action,
                actorId: item.actorId,
                actorName: item.actorName,
                timestamp: item.timestamp,
                createdAt: item.createdAt ?? item.timestamp,
                details: item.details,
            },
        }));

        await this.emitActivityFeedSnapshot(userId, docs);
    }

    public async emitRawActivityFeedDocuments(
        userId: UserId,
        documents: Array<{ id?: string; data: Record<string, unknown>; }>,
    ): Promise<void> {
        if (!Array.isArray(documents) || documents.length === 0) {
            return;
        }

        const docs = documents.map((doc) => ({
            id: doc.id ?? `mock-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            data: doc.data,
        }));

        await this.emitActivityFeedSnapshot(userId, docs);
    }

    private async emitActivityFeedSnapshot(userId: UserId, items: Array<{ id: string; data: Record<string, unknown>; }>): Promise<void> {
        await this.page.evaluate(
            ({ userId, items }) => {
                const path = `collection:activity-feed/${userId}/items`;
                const listener = window.__TEST_ENV__!.firebase.firestoreListeners.get(path);
                if (!listener) {
                    return;
                }

                const docs = items.map(({ id, data }) => ({
                    id,
                    data: () => data,
                }));

                listener({ docs });
            },
            { userId, items },
        );
    }

    private async registerSuccessHandler(user: ClientUser, options: { delayMs?: number; }): Promise<void> {
        this.state.loginBehavior = 'success';
        this.state.successUser = user;
        this.state.failureError = null;

        await registerMswHandlers(
            this.page,
            registerSuccessHandler(user, {
                once: true,
                delayMs: options.delayMs,
            }),
        );

        // Also set up /api/login handler for post-registration auto-login
        // (signInAfterRegistration now uses apiClient.login instead of direct Firebase SDK)
        await registerMswHandlers(this.page, loginSuccessHandler('mock-custom-token', { once: true }));

        const registerUrl = '/api/register';
        const listener = async (response: Response) => {
            try {
                if (response.url().endsWith(registerUrl) && response.request().method() === 'POST' && response.status() === 200) {
                    await this.updateAuthState(user);
                }
            } finally {
                this.page.off('response', listener);
            }
        };

        this.page.on('response', listener);
    }

    public async dispose(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        // Clean up browser globals
        await this.page.evaluate(() => {
            window.__TEST_ENV__?.cleanup();
        });

        this.initialized = false;
    }
}

/**
 * Get the configured API delay for mocks
 * Can be overridden per-test or globally via PLAYWRIGHT_API_DELAY env var
 */
function getApiDelay(explicitDelay?: number): number {
    if (explicitDelay !== undefined) {
        return explicitDelay;
    }
    return Number(process.env.PLAYWRIGHT_API_DELAY ?? 0);
}

export async function mockFullyAcceptedPoliciesApi(page: Page) {
    await registerMswHandlers(page, acceptedPoliciesHandler());
}

/**
 * Mock groups API endpoint with metadata
 * Handles requests with any query parameters as long as includeMetadata=true is present
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupsApi(
    page: Page,
    response: ListGroupsResponse,
    options: { delayMs?: number; once?: boolean; query?: Record<string, string>; status?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);
    await registerMswHandlers(
        page,
        groupsMetadataHandler(response, {
            delayMs: delay,
            once: options.once,
            status: options.status,
            query: options.query,
        }),
    );
}

/**
 * Mock API failure with specific status code and error message
 * Handles requests with or without query parameters
 * @param url - Can be a path like '/api/groups' or a full URL with query params like '/api/groups?includeMetadata=true'
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockApiFailure(
    page: Page,
    url: string,
    status: number,
    error: { error: { code: string; message: string; details?: unknown; }; },
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);
    const urlObj = new URL(url, 'http://dummy');
    const targetPath = urlObj.pathname;
    const queryParams = Object.fromEntries(urlObj.searchParams.entries());
    const hasQuery = Object.keys(queryParams).length > 0;

    const methods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    const handlers = methods.map((method) =>
        createJsonHandler(method, targetPath, error, {
            status,
            delayMs: delay,
            query: hasQuery ? queryParams : undefined,
        })
    );

    await registerMswHandlers(page, handlers);
}

/**
 * Mock group detail API endpoint (full-details)
 * Handles requests with or without query parameters (e.g., ?includeDeletedSettlements=false)
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupDetailApi(
    page: Page,
    groupId: GroupId | string,
    group: any,
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        groupDetailHandler(groupId, group, {
            delayMs: delay,
            status: options.status,
            once: options.once,
        }),
    );
}

/**
 * Mock group comments API endpoint
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupCommentsApi(
    page: Page,
    groupId: GroupId | string,
    comments: any[] = [],
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        groupCommentsHandler(
            groupId,
            {
                comments,
                hasMore: false,
            },
            {
                delayMs: delay,
            },
        ),
    );
}

export async function mockExpenseDetailApi(
    page: Page,
    expenseId: ExpenseId | string,
    response: any,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('GET', `/api/expenses/${expenseId}/full-details`, response, {
            delayMs: delay,
        }),
    );
}

export async function mockExpenseCommentsApi(
    page: Page,
    expenseId: ExpenseId | string,
    comments: any[] = [],
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler(
            'GET',
            `/api/expenses/${expenseId}/comments`,
            {
                comments,
                hasMore: false,
            },
            {
                delayMs: delay,
            },
        ),
    );
}

/**
 * Mock expense update API endpoint
 * The update endpoint returns the NEW expense (with a new ID due to edit history via soft deletes)
 */
export async function mockUpdateExpenseApi(
    page: Page,
    oldExpenseId: ExpenseId | string,
    newExpenseResponse: any,
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        updateExpenseHandler(String(oldExpenseId), newExpenseResponse, {
            delayMs: delay,
            status: options.status ?? 200,
            once: options.once ?? true,
        }),
    );
}

export async function mockCreateGroupApi(
    page: Page,
    response: any,
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('POST', '/api/groups', response, {
            delayMs: delay,
            status: options.status ?? 200,
            once: options.once ?? true,
        }),
    );
}

/**
 * Mock generate share link API endpoint
 * The endpoint is POST /api/groups/share with body: { groupId }
 * Response format: { shareToken: string, shareablePath: string }
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGenerateShareLinkApi(
    page: Page,
    groupId: GroupId | string,
    shareToken: string = 'test-share-token-123',
    options: { delayMs?: number; expiresAt?: string; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);
    const expiresAt = options.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await registerMswHandlers(
        page,
        generateShareLinkHandler(
            {
                shareToken,
                shareablePath: `/join?shareToken=${shareToken}`,
                expiresAt,
            },
            {
                delayMs: delay,
                bodyMatcher: {
                    type: 'json-subset',
                    subset: { groupId },
                },
            },
        ),
    );
}

export async function mockArchiveGroupApi(
    page: Page,
    groupId: GroupId | string,
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('POST', `/api/groups/${groupId}/archive`, undefined, {
            delayMs: delay,
            status: options.status ?? 204,
            once: options.once,
        }),
    );
}

export async function mockUnarchiveGroupApi(
    page: Page,
    groupId: GroupId | string,
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('POST', `/api/groups/${groupId}/unarchive`, undefined, {
            delayMs: delay,
            status: options.status ?? 204,
            once: options.once,
        }),
    );
}

/**
 * Mock group preview API endpoint (for join group flow)
 * The endpoint is POST /api/groups/preview with body: { linkId }
 * Response format: PreviewGroupResponse
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupPreviewApi(
    page: Page,
    response: any,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        groupPreviewHandler(response, {
            delayMs: delay,
        }),
    );
}

/**
 * Mock join group API endpoint
 * The endpoint is POST /api/groups/join with body: { linkId }
 * Response format: JoinGroupResponse
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockJoinGroupApi(
    page: Page,
    response: any,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        joinGroupHandler(response, {
            delayMs: delay,
        }),
    );
}

export async function mockPendingMembersApi(
    page: Page,
    groupId: GroupId | string,
    members: any[] = [],
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('GET', `/api/groups/${groupId}/members/pending`, members, { delayMs: delay }),
    );
}

export async function mockUpdateGroupPermissionsApi(
    page: Page,
    groupId: GroupId | string,
    response: any = { message: 'Permissions updated.' },
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('PATCH', `/api/groups/${groupId}/security/permissions`, response, { delayMs: delay }),
    );
}

/**
 * Mock group preview API failure
 * @param status - HTTP status code for the failure
 * @param error - Error object to return
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupPreviewFailure(
    page: Page,
    status: number,
    error: { error: { code: string; message: string; details?: unknown; }; },
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        groupPreviewHandler(error, {
            status,
            delayMs: delay,
        }),
    );
}

/**
 * Mock join group API failure
 * @param status - HTTP status code for the failure
 * @param error - Error object to return
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockJoinGroupFailure(
    page: Page,
    status: number,
    error: { error: { code: string; message: string; details?: unknown; }; },
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        joinGroupHandler(error, {
            status,
            delayMs: delay,
        }),
    );
}

/**
 * Mock activity feed API endpoint
 * @param items - Activity feed items to return
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockActivityFeedApi(
    page: Page,
    items: any[] = [],
    options: { delayMs?: number; hasMore?: boolean; nextCursor?: string; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler(
            'GET',
            '/api/activity-feed',
            {
                items,
                hasMore: options.hasMore ?? false,
                nextCursor: options.nextCursor,
            },
            {
                delayMs: delay,
            },
        ),
    );
}

/**
 * Mock group activity feed API endpoint
 * @param groupId - Group ID to mock the activity feed for
 * @param items - Activity feed items to return
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupActivityFeedApi(
    page: Page,
    groupId: GroupId | string,
    items: any[] = [],
    options: { delayMs?: number; hasMore?: boolean; nextCursor?: string; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler(
            'GET',
            `/api/groups/${groupId}/activity-feed`,
            {
                items,
                hasMore: options.hasMore ?? false,
                nextCursor: options.nextCursor,
            },
            {
                delayMs: delay,
            },
        ),
    );
}

/**
 * Mocks the user profile API
 * Used for testing user profile display and updates
 *
 * @param page - Playwright page instance
 * @param profile - UserProfileResponse to return from the API (use UserProfileResponseBuilder)
 * @param options - Optional delay in milliseconds before responding
 */
export async function mockUserProfileApi(
    page: Page,
    profile: UserProfileResponse,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler(
            'GET',
            '/api/user/profile',
            profile,
            {
                delayMs: delay,
            },
        ),
    );
}

/**
 * Mocks the admin tenants listing API
 * Used for testing the admin tenants page
 *
 * @param page - Playwright page instance
 * @param tenants - Optional array of tenant data (defaults to sample tenant)
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockAdminTenantsApi(
    page: Page,
    tenants: any[] = [
        {
            tenant: new TenantConfigBuilder('test-tenant')
                .withAppName('Test Tenant')
                .withPrimaryColor('#3B82F6')
                .withSecondaryColor('#8B5CF6')
                .withMarketingFlags({
                    showMarketingContent: true,
                    showPricingPage: true,
                })
                .build(),
            domains: ['localhost'],
            isDefault: true,
        },
    ],
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler(
            'GET',
            '/api/admin/browser/tenants',
            {
                tenants,
                count: tenants.length,
            },
            {
                delayMs: delay,
            },
        ),
    );
}

/**
 * Mocks the admin tenant upsert API
 * @param page - Playwright page instance
 */
export async function mockAdminUpsertTenantApi(page: Page): Promise<void> {
    await registerMswHandlers(
        page,
        createJsonHandler(
            'POST',
            '/api/admin/tenants',
            {
                tenantId: 'mock-tenant',
                created: true,
            },
        ),
    );
}

/**
 * Mocks the admin tenant theme publish API
 * @param page - Playwright page instance
 */
export async function mockAdminPublishTenantThemeApi(page: Page): Promise<void> {
    await registerMswHandlers(
        page,
        createJsonHandler(
            'POST',
            '/api/admin/tenants/publish',
            {
                artifact: {
                    hash: 'mock-hash-123',
                    cssUrl: 'https://storage.example.com/themes/mock-theme.css',
                    tokensUrl: 'https://storage.example.com/themes/mock-tokens.json',
                    version: 1,
                    generatedAtEpochMs: Date.now(),
                    generatedBy: 'test-admin',
                },
                cssUrl: 'https://storage.example.com/themes/mock-theme.css',
                tokensUrl: 'https://storage.example.com/themes/mock-tokens.json',
            },
        ),
    );
}

/**
 * Creates successful API mocks for authenticated user flows
 * Commonly used pattern for tests that need authenticated users with accepted policies
 *
 * @param page - Playwright page instance
 * @param user - Optional user to mock profile API with
 */
export async function setupSuccessfulApiMocks(page: Page, user?: ClientUser): Promise<void> {
    // Mock policies API: /api/user/policies/status -> all policies accepted
    await mockFullyAcceptedPoliciesApi(page);

    // Mock groups API: /api/groups?includeMetadata=true -> empty groups list
    await mockGroupsApi(page, {
        groups: [],
        count: 0,
        hasMore: false,
        pagination: { limit: 20, order: 'desc' },
        metadata: {
            serverTime: Date.now(),
            lastChangeTimestamp: Date.now(),
            changeCount: 0,
        },
    });

    // Mock activity feed API: /api/activity-feed -> empty activity feed
    await mockActivityFeedApi(page, []);

    // Mock admin tenants API: /api/admin/browser/tenants -> default tenant
    await mockAdminTenantsApi(page);

    // Mock admin tenant upsert API: POST /api/admin/tenants
    await mockAdminUpsertTenantApi(page);

    // Mock admin tenant theme publish API: POST /api/admin/tenants/publish
    await mockAdminPublishTenantThemeApi(page);

    // Mock user profile API if user provided
    if (user) {
        await mockUserProfileApi(page, {
            displayName: user.displayName,
            email: user.email,
            emailVerified: user.emailVerified ?? true,
            role: user.role ?? SystemUserRoles.SYSTEM_USER,
        });
    }
}
