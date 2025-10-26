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
    registerFailureHandler,
    registerSuccessHandler,
} from '@/test/msw/handlers.ts';
import type { SerializedBodyMatcher, SerializedMswHandler } from '@/test/msw/types.ts';
import type { Page, Response, Route } from '@playwright/test';
import { ActivityFeedEventTypes, ApiSerializer, ClientUser, ExpenseId, GroupId, ListGroupsResponse, MessageResponse, UserId } from '@splitifyd/shared';

interface AuthError {
    code: string;
    message: string;
}

interface MockApiOptions {
    delayMs?: number;
    status?: number;
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
    private notificationVersions = new Map<string, number>();
    private notificationCounters = new Map<string, { transaction: number; balance: number; group: number; comment: number; }>();
    private userGroupMemberships = new Map<string, Set<string>>(); // Track which groups each user is in

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
                sendPasswordResetEmail: () => Promise.resolve(),
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
                signInWithEmailAndPassword: async (email, password) => {
                    return (window as any).__testHarnessMockSignIn(email, password);
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
            await this.page.exposeFunction('__testHarnessMockSignIn', this.handleSignIn.bind(this));
            await this.page.exposeFunction('__testHarnessMockSignOut', this.handleSignOut.bind(this));
        } catch (error) {
            // Functions already exposed (browser reuse) - this is expected and safe to ignore
            if (error instanceof Error && !error.message?.includes('has been already registered')) {
                throw error;
            }
        }
    }

    private async handleSignIn(_email: string, _password: string): Promise<void> {
        if (this.state.loginBehavior === 'failure' && this.state.failureError) {
            throw this.state.failureError;
        }

        if ((this.state.loginBehavior === 'success' || this.state.loginBehavior === 'delayed') && this.state.successUser) {
            // Add delay if configured
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

    public mockLoginSuccess(user: ClientUser): void {
        this.state.loginBehavior = 'success';
        this.state.successUser = user;
        this.state.failureError = null;
    }

    public mockLoginFailure(error: AuthError): void {
        this.state.loginBehavior = 'failure';
        this.state.successUser = null;
        this.state.failureError = error;
    }

    public mockLoginWithDelay(user: ClientUser, delayMs: number): void {
        this.state.loginBehavior = 'delayed';
        this.state.successUser = user;
        this.state.failureError = null;
        this.state.delayMs = delayMs;
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

    public async triggerNotificationUpdate(userId: UserId, data: any): Promise<void> {
        const changeVersion = typeof data?.changeVersion === 'number' ? data.changeVersion : 0;
        const lastVersion = this.notificationVersions.get(userId) ?? 0;

        // Track group membership BEFORE early returns (so baseline is recorded)
        const previousGroups = this.userGroupMemberships.get(userId) ?? new Set<string>();
        const currentGroups = new Set<string>(Object.keys(data?.groups ?? {}));
        this.userGroupMemberships.set(userId, currentGroups);

        if (lastVersion === 0 && changeVersion <= 1) {
            this.notificationVersions.set(userId, changeVersion);
            return;
        }

        if (changeVersion <= lastVersion) {
            return;
        }

        this.notificationVersions.set(userId, changeVersion);

        // Detect removed groups
        const removedGroups = Array.from(previousGroups).filter(groupId => !currentGroups.has(groupId));

        const events: Array<{ groupId: GroupId | string; type: 'transaction' | 'balance' | 'group' | 'comment' | 'member-left'; }> = [];

        // Generate member-left events for removed groups
        for (const groupId of removedGroups) {
            events.push({ groupId, type: 'member-left' });
        }

        if (Array.isArray(data?.recentChanges) && data.recentChanges.length > 0) {
            for (const change of data.recentChanges) {
                events.push({ groupId: change.groupId, type: change.type });
            }
        } else if (data?.groups) {
            for (const [groupId, groupState] of Object.entries<any>(data.groups)) {
                const state = groupState ?? {};
                const key = `${userId}:${groupId}`;
                const previous = this.notificationCounters.get(key) ?? { transaction: 0, balance: 0, group: 0, comment: 0 };

                const counts: Array<[keyof typeof previous, number]> = [
                    ['transaction', state.transactionChangeCount ?? 0],
                    ['balance', state.balanceChangeCount ?? 0],
                    ['group', state.groupDetailsChangeCount ?? 0],
                    ['comment', state.commentChangeCount ?? 0],
                ];

                for (const [category, count] of counts) {
                    if (count > previous[category]) {
                        events.push({ groupId, type: category });
                    }
                }

                this.notificationCounters.set(key, {
                    transaction: state.transactionChangeCount ?? previous.transaction,
                    balance: state.balanceChangeCount ?? previous.balance,
                    group: state.groupDetailsChangeCount ?? previous.group,
                    comment: state.commentChangeCount ?? previous.comment,
                });
            }
        }

        if (events.length === 0) {
            return;
        }

        const timestamp = new Date().toISOString();
        const items = events.map(({ groupId, type }) => ({
            id: `mock-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            data: {
                userId,
                groupId,
                groupName: data.groups?.[groupId]?.name ?? 'Mock Group',
                eventType: this.mapNotificationCategoryToActivityType(type),
                actorId: 'system',
                actorName: 'System',
                timestamp,
                createdAt: timestamp,
                details: type === 'member-left' ? { targetUserId: userId } : {},
            },
        }));

        await this.emitActivityFeedSnapshot(userId, items);
    }

    public async emitFirestoreSnapshot(collection: string, documentId: string, data: any): Promise<void> {
        await this.page.evaluate(
            ({ collection, documentId, data }) => {
                const path = `${collection}/${documentId}`;
                const listener = window.__TEST_ENV__!.firebase.firestoreListeners.get(path);
                if (listener) {
                    const mockSnapshot = {
                        exists: () => data !== null,
                        data: () => data,
                    };
                    listener(mockSnapshot);
                }
            },
            { collection, documentId, data },
        );
    }

    private async emitActivityFeedSnapshot(userId: UserId, items: Array<{ id: string; data: any; }>): Promise<void> {
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

    private mapNotificationCategoryToActivityType(type: 'transaction' | 'balance' | 'group' | 'comment' | 'member-left'): string {
        switch (type) {
            case 'transaction':
                return ActivityFeedEventTypes.EXPENSE_UPDATED;
            case 'balance':
                return ActivityFeedEventTypes.SETTLEMENT_UPDATED;
            case 'group':
                return ActivityFeedEventTypes.GROUP_UPDATED;
            case 'comment':
                return ActivityFeedEventTypes.COMMENT_ADDED;
            case 'member-left':
                return ActivityFeedEventTypes.MEMBER_LEFT;
            default:
                return ActivityFeedEventTypes.EXPENSE_UPDATED;
        }
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
    error: { error: string; },
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
    expenseId: ExpenseId,
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
    expenseId: ExpenseId,
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

export async function mockUpdateGroupDisplayNameApi(
    page: Page,
    groupId: GroupId | string,
    response: any,
    options: { delayMs?: number; status?: number; once?: boolean; bodyMatcher?: SerializedBodyMatcher; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('PUT', `/api/groups/${groupId}/members/display-name`, response, {
            delayMs: delay,
            status: options.status ?? 200,
            once: options.once,
            bodyMatcher: options.bodyMatcher,
        }),
    );
}

/**
 * Mock generate share link API endpoint
 * The endpoint is POST /api/groups/share with body: { groupId }
 * Response format: { linkId: string, shareablePath: string }
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
                linkId: shareToken,
                shareablePath: `/join/${shareToken}`,
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
    response: MessageResponse = { message: 'Group archived successfully' },
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('POST', `/api/groups/${groupId}/archive`, response, {
            delayMs: delay,
            status: options.status ?? 200,
            once: options.once,
        }),
    );
}

export async function mockUnarchiveGroupApi(
    page: Page,
    groupId: GroupId | string,
    response: MessageResponse = { message: 'Group unarchived successfully' },
    options: { delayMs?: number; status?: number; once?: boolean; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await registerMswHandlers(
        page,
        createJsonHandler('POST', `/api/groups/${groupId}/unarchive`, response, {
            delayMs: delay,
            status: options.status ?? 200,
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
        createJsonHandler('GET', `/api/groups/${groupId}/members/pending`, { members }, { delayMs: delay }),
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
    error: { error: string; },
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
    error: { error: string; },
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
 * Creates successful API mocks for authenticated user flows
 * Commonly used pattern for tests that need authenticated users with accepted policies
 */
export async function setupSuccessfulApiMocks(page: Page): Promise<void> {
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
}
