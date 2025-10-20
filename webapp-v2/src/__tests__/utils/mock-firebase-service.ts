import { FirebaseService } from '@/app/firebase.ts';
import type { Page, Route } from '@playwright/test';
import { ApiSerializer, ClientUser, ListGroupsResponse, UserPolicyStatusResponse } from '@splitifyd/shared';
import {GroupId} from "@splitifyd/shared";

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

    private async createBrowserGlobals(initialUser: ClientUser | null): Promise<void> {
        // Mock Firebase config endpoint to prevent "Failed to fetch config" errors
        await this.page.route('**/__/firebase/init.json*', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize({
                    apiKey: 'mock-api-key',
                    authDomain: 'mock-project.firebaseapp.com',
                    projectId: 'mock-project',
                    storageBucket: 'mock-project.appspot.com',
                    messagingSenderId: '123456789',
                    appId: '1:123456789:web:abcdef',
                }),
            });
        });

        await this.page.addInitScript((initialUser: any) => {
            const mockService: FirebaseService = {
                connect: () => Promise.resolve(),
                performTokenRefresh: () => Promise.resolve('mock-token'),
                performUserRefresh: () => Promise.resolve(),
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
                    return (window as any).__splitifydMockSignIn(email, password);
                },
                signOut: async () => {
                    return (window as any).__splitifydMockSignOut();
                },
                onDocumentSnapshot: (collection, documentId, onData, onError) => {
                    const path = `${collection}/${documentId}`;
                    window.__TEST_ENV__!.firebase.firestoreListeners.set(path, onData);
                    return () => {
                        window.__TEST_ENV__!.firebase.firestoreListeners.delete(path);
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
                    delete (window as any).__MOCK_FIREBASE_SERVICE__;
                },
            };

            // Global that firebase.ts checks to use mock instead of real Firebase
            (window as any).__MOCK_FIREBASE_SERVICE__ = mockService;
        }, initialUser);

        // Expose sign in/out functions (check if already exposed for browser reuse)
        try {
            await this.page.exposeFunction('__splitifydMockSignIn', this.handleSignIn.bind(this));
            await this.page.exposeFunction('__splitifydMockSignOut', this.handleSignOut.bind(this));
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

            this.state.currentUser = this.state.successUser;

            // Trigger auth state change with the logged-in user
            await this.page.evaluate((user) => {
                window.__TEST_ENV__!.firebase.currentUser = user;
                if (window.__TEST_ENV__!.firebase.authCallback) {
                    const token = user ? `mock-token-for-${user.uid}` : null;
                    window.__TEST_ENV__!.firebase.authCallback(user, token);
                }
            }, this.state.currentUser);
            return;
        }

        throw new Error('Mock login not configured. Use mockLoginSuccess(), mockLoginWithDelay(), or mockLoginFailure() first.');
    }

    private async handleSignOut(): Promise<void> {
        this.state.currentUser = null;
        await this.page.evaluate(() => {
            window.__TEST_ENV__!.firebase.currentUser = null;
            if (window.__TEST_ENV__!.firebase.authCallback) {
                window.__TEST_ENV__!.firebase.authCallback(null, null);
            }
        });
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
    public mockRegisterSuccess(user: ClientUser): void {
        this.page.route('/api/register', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize({
                    success: true,
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                    },
                }),
            });

            // After successful registration, trigger auth state change
            this.state.currentUser = user;
            await this.page.evaluate((user) => {
                window.__TEST_ENV__!.firebase.currentUser = user;
                if (window.__TEST_ENV__!.firebase.authCallback) {
                    const token = user ? `mock-token-for-${user.uid}` : null;
                    window.__TEST_ENV__!.firebase.authCallback(user, token);
                }
            }, user);
        });
    }

    /**
     * Mock failed registration - sets up /register API endpoint to fail with error
     */
    public mockRegisterFailure(error: AuthError): void {
        this.page.route('/api/register', (route) => {
            route.fulfill({
                status: 400,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize({
                    error: error.message,
                    code: error.code,
                }),
            });
        });
    }

    /**
     * Mock registration with delay - useful for testing loading states
     */
    public mockRegisterWithDelay(user: ClientUser, delayMs: number): void {
        this.page.route('/api/register', async (route) => {
            // Wait for specified delay
            await this.page.waitForTimeout(delayMs);

            await route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize({
                    success: true,
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                    },
                }),
            });

            // After successful registration, trigger auth state change
            this.state.currentUser = user;
            await this.page.evaluate((user) => {
                window.__TEST_ENV__!.firebase.currentUser = user;
                if (window.__TEST_ENV__!.firebase.authCallback) {
                    const token = user ? `mock-token-for-${user.uid}` : null;
                    window.__TEST_ENV__!.firebase.authCallback(user, token);
                }
            }, user);
        });
    }

    public async triggerNotificationUpdate(userId: string, data: any): Promise<void> {
        await this.page.evaluate(
            ({ userId, data }) => {
                const path = `user-notifications/${userId}`;
                const listener = window.__TEST_ENV__!.firebase.firestoreListeners.get(path);
                if (listener) {
                    // Create a mock snapshot with the notification data
                    const mockSnapshot = {
                        exists: () => data !== null,
                        data: () => data,
                    };
                    listener(mockSnapshot);
                }
            },
            { userId, data },
        );
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

/**
 * Mock a single API endpoint with explicit request/response mapping
 * @param delayMs - Optional delay in milliseconds before responding (defaults to env PLAYWRIGHT_API_DELAY or 0)
 */
export async function mockApiRoute(
    page: Page,
    url: string,
    response: any,
    options: MockApiOptions = {},
): Promise<void> {
    const { status = 200, delayMs } = options;
    const delay = getApiDelay(delayMs);

    await page.route(url, async (route: any) => {
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        route.fulfill({
            status,
            contentType: 'application/x-serialized-json',
            body: ApiSerializer.serialize(response),
        });
    });
}

/**
 * Mock policies API endpoint
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockPoliciesApi(
    page: Page,
    response: UserPolicyStatusResponse,
    options: { delayMs?: number; } = {},
): Promise<void> {
    await mockApiRoute(page, '/api/user/policies/status', response, options);
}

export async function mockFullyAcceptedPoliciesApi(page: Page) {
    await mockPoliciesApi(page, {
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
    });
}

/**
 * Mock groups API endpoint with metadata
 * Handles requests with any query parameters as long as includeMetadata=true is present
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupsApi(
    page: Page,
    response: ListGroupsResponse,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await page.route(
        (routeUrl) => {
            if (routeUrl.pathname !== '/api/groups') {
                return false;
            }
            // Match if includeMetadata=true is present in query params
            const searchParams = new URL(routeUrl.href).searchParams;
            return searchParams.get('includeMetadata') === 'true';
        },
        async (route: any) => {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(response),
            });
        },
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

    // Parse the URL to separate path and query params
    const urlObj = new URL(url, 'http://dummy'); // Use dummy base for parsing
    const targetPath = urlObj.pathname;
    const targetSearchParams = urlObj.searchParams;

    await page.route(
        (routeUrl) => {
            // Check if pathname matches
            if (routeUrl.pathname !== targetPath) {
                return false;
            }

            // If the mock URL has query params, they must match exactly
            if (targetSearchParams.toString()) {
                const routeSearchParams = new URL(routeUrl.href).searchParams;
                return targetSearchParams.toString() === routeSearchParams.toString();
            }

            // If mock URL has no query params, match any request to that path
            return true;
        },
        async (route: any) => {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            route.fulfill({
                status,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(error),
            });
        },
    );
}

/**
 * Mock group detail API endpoint (full-details)
 * Handles requests with or without query parameters (e.g., ?includeDeletedSettlements=false)
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupDetailApi(
    page: Page,
    groupId: GroupId,
    group: any,
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await page.route(new RegExp(`/api/groups/${groupId}/full-details(\\?.*)?$`), async (route: any) => {
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        route.fulfill({
            status: 200,
            contentType: 'application/x-serialized-json',
            body: ApiSerializer.serialize(group),
        });
    });
}

/**
 * Mock group comments API endpoint
 * @param delayMs - Optional delay in milliseconds before responding
 */
export async function mockGroupCommentsApi(
    page: Page,
    groupId: GroupId,
    comments: any[] = [],
    options: { delayMs?: number; } = {},
): Promise<void> {
    await mockApiRoute(
        page,
        `/api/groups/${groupId}/comments`,
        {
            success: true,
            data: {
                comments,
                count: comments.length,
                hasMore: false,
            },
        },
        options,
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
    groupId: GroupId,
    shareToken: string = 'test-share-token-123',
    options: { delayMs?: number; } = {},
): Promise<void> {
    const delay = getApiDelay(options.delayMs);

    await page.route('/api/groups/share', async (route) => {
        const request = route.request();
        const postData = request.postDataJSON();

        // Only respond if the groupId matches
        if (postData?.groupId === groupId) {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize({
                    linkId: shareToken,
                    shareablePath: `/join/${shareToken}`,
                }),
            });
        } else {
            await route.continue();
        }
    });
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

    await page.route('/api/groups/preview', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(response),
            });
        } else {
            await route.continue();
        }
    });
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

    await page.route('/api/groups/join', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(response),
            });
        } else {
            await route.continue();
        }
    });
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

    await page.route('/api/groups/preview', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            await route.fulfill({
                status,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(error),
            });
        } else {
            await route.continue();
        }
    });
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

    await page.route('/api/groups/join', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            await route.fulfill({
                status,
                contentType: 'application/x-serialized-json',
                body: ApiSerializer.serialize(error),
            });
        } else {
            await route.continue();
        }
    });
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
}
