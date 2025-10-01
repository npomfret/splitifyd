import { Page } from '@playwright/test';
import type { ClientUser, ListGroupsResponse, UserPolicyStatusResponse, UserNotificationDocument } from '@splitifyd/shared';
import { FirebaseService } from '@/app/firebase.ts';

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
        __SPLITIFYD_MOCK__?: {
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
        await this.page.addInitScript((initialUser: any) => {
            const mockService: FirebaseService = {
                connect: () => Promise.resolve(),
                performTokenRefresh: () => Promise.resolve('mock-token'),
                performUserRefresh: () => Promise.resolve(),
                sendPasswordResetEmail: () => Promise.resolve(),
                onAuthStateChanged: (callback) => {
                    // Store callback for future auth state changes
                    if (window.__SPLITIFYD_MOCK__) {
                        window.__SPLITIFYD_MOCK__.firebase.authCallback = callback;
                    }

                    // Immediately trigger with initial state
                    const token = initialUser ? `mock-token-for-${initialUser.uid}` : null;
                    try {
                        callback(initialUser, token);
                    } catch (error) {
                        console.error('MockFirebase: Error in auth callback:', error);
                    }

                    return () => {
                        if (window.__SPLITIFYD_MOCK__) {
                            window.__SPLITIFYD_MOCK__.firebase.authCallback = null;
                        }
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
                    if (window.__SPLITIFYD_MOCK__) {
                        window.__SPLITIFYD_MOCK__.firebase.firestoreListeners.set(path, onData);
                    }
                    return () => {
                        if (window.__SPLITIFYD_MOCK__) {
                            window.__SPLITIFYD_MOCK__.firebase.firestoreListeners.delete(path);
                        }
                    };
                },
                getCurrentUserId: () => {
                    const mock = window.__SPLITIFYD_MOCK__;
                    return mock?.firebase?.currentUser?.uid || null;
                },
            };

            // Set up mock globals
            window.__SPLITIFYD_MOCK__ = {
                firebase: {
                    currentUser: initialUser,
                    authCallback: null,
                    firestoreListeners: new Map(),
                },
                cleanup: () => {
                    delete window.__SPLITIFYD_MOCK__;
                    delete (window as any).__MOCK_FIREBASE_SERVICE__;
                },
            };

            // Global that firebase.ts checks to use mock instead of real Firebase
            (window as any).__MOCK_FIREBASE_SERVICE__ = mockService;
        }, initialUser);

        // Expose sign in/out functions
        await this.page.exposeFunction('__splitifydMockSignIn', this.handleSignIn.bind(this));
        await this.page.exposeFunction('__splitifydMockSignOut', this.handleSignOut.bind(this));
    }


    private async handleSignIn(email: string, password: string): Promise<void> {
        if (this.state.loginBehavior === 'failure' && this.state.failureError) {
            throw this.state.failureError;
        }

        if ((this.state.loginBehavior === 'success' || this.state.loginBehavior === 'delayed') && this.state.successUser) {
            // Add delay if configured
            if (this.state.loginBehavior === 'delayed' && this.state.delayMs) {
                await new Promise(resolve => setTimeout(resolve, this.state.delayMs));
            }

            this.state.currentUser = this.state.successUser;

            // Trigger auth state change with the logged-in user
            await this.page.evaluate((user) => {
                const mock = window.__SPLITIFYD_MOCK__;
                if (mock) {
                    mock.firebase.currentUser = user;
                    if (mock.firebase.authCallback) {
                        const token = user ? `mock-token-for-${user.uid}` : null;
                        mock.firebase.authCallback(user, token);
                    }
                }
            }, this.state.currentUser);
            return;
        }

        throw new Error('Mock login not configured. Use mockLoginSuccess(), mockLoginWithDelay(), or mockLoginFailure() first.');
    }

    private async handleSignOut(): Promise<void> {
        this.state.currentUser = null;
        await this.page.evaluate(() => {
            const mock = window.__SPLITIFYD_MOCK__;
            if (mock) {
                mock.firebase.currentUser = null;
                if (mock.firebase.authCallback) {
                    mock.firebase.authCallback(null, null);
                }
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

    public async triggerNotificationUpdate(userId: string, data: UserNotificationDocument): Promise<void> {
        await this.page.evaluate(({ userId, data }) => {
            const mock = window.__SPLITIFYD_MOCK__;
            if (mock) {
                const path = `user-notifications/${userId}`;
                const listener = mock.firebase.firestoreListeners.get(path);
                if (listener) {
                    // Create a mock snapshot with the notification data
                    const mockSnapshot = {
                        exists: () => data !== null,
                        data: () => data,
                    };
                    listener(mockSnapshot);
                }
            }
        }, { userId, data });
    }

    public getCurrentUser(): ClientUser | null {
        return this.state.currentUser;
    }

    public async dispose(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        // Clean up browser globals
        await this.page.evaluate(() => {
            window.__SPLITIFYD_MOCK__?.cleanup();
        });

        this.initialized = false;
    }
}

/**
 * Mock a single API endpoint with explicit request/response mapping
 */
export async function mockApiRoute(page: Page, url: string, response: any, status: number = 200): Promise<void> {
    await page.route(url, (route: any) => {
        route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}


/**
 * Mock policies API endpoint
 */
export async function mockPoliciesApi(page: Page, response: UserPolicyStatusResponse): Promise<void> {
    await mockApiRoute(page, '/api/user/policies/status', response);
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
 */
export async function mockGroupsApi(page: Page, response: ListGroupsResponse): Promise<void> {
    await mockApiRoute(page, '/api/groups?includeMetadata=true', response);
}


/**
 * Mock API failure with specific status code and error message
 */
export async function mockApiFailure(page: Page, url: string, status: number, error: { error: string }): Promise<void> {
    await mockApiRoute(page, url, error, status);
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