import { Page } from '@playwright/test';
import { MockResponseBuilder } from '../builders/MockResponseBuilder';

/**
 * Mock object for handling Authentication API endpoints in Playwright tests
 * Provides a fluent API for setting up auth-related API responses
 */
export class AuthApiMock {
    constructor(private page: Page) {}

    private getMockFirebaseUrls() {
        const baseUrl = new URL(this.page.url()).origin;
        return {
            firebaseAuthUrl: `${baseUrl}/_mock/firebase-auth`,
            firebaseFirestoreUrl: `${baseUrl}/_mock/firebase-firestore`,
        };
    }

    async mockFirebaseConfig(): Promise<void> {
        const mockUrls = this.getMockFirebaseUrls();

        await this.page.route('**/api/config', (route) => {
            const config = {
                firebase: {
                    apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
                    authDomain: 'splitifyd.firebaseapp.com',
                    projectId: 'splitifyd',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
                ...mockUrls,
            };

            const response = MockResponseBuilder.success(config).build();
            route.fulfill(response);
        });
    }

    async mockConfigAPI(config: any): Promise<void> {
        await this.page.route('**/api/config', (route) => {
            const response = MockResponseBuilder.success(config).build();
            route.fulfill(response);
        });
    }

    async mockSuccessfulLogin(email: string, password: string, userId: string = 'test-user-id'): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.route('**/_mock/firebase-auth/**', (route) => {
            const url = route.request().url();
            const requestBody = route.request().postDataJSON();

            if (url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')) {
                if (requestBody?.email === email && requestBody?.password === password) {
                    const loginResponse = {
                        kind: 'identitytoolkit#VerifyPasswordResponse',
                        registered: true,
                        localId: userId,
                        email: email,
                        idToken: 'mock-id-token-' + Date.now(),
                        refreshToken: 'mock-refresh-token-' + Date.now(),
                        expiresIn: '3600'
                    };
                    const response = MockResponseBuilder.success(loginResponse).build();
                    route.fulfill(response);
                    return;
                }
            }

            if (url.includes('identitytoolkit.googleapis.com/v1/accounts:lookup')) {
                const userResponse = {
                    kind: 'identitytoolkit#GetAccountInfoResponse',
                    users: [{
                        localId: userId,
                        email: email,
                        emailVerified: false,
                        displayName: 'Test User',
                        providerUserInfo: [{
                            providerId: 'password',
                            email: email,
                            federatedId: email,
                            displayName: 'Test User',
                            rawId: email
                        }]
                    }]
                };
                const response = MockResponseBuilder.success(userResponse).build();
                route.fulfill(response);
                return;
            }

            route.continue();
        });
    }

    async mockInvalidCredentials(email: string, password: string): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.route('**/_mock/firebase-auth/**', (route) => {
            const url = route.request().url();
            const requestBody = route.request().postDataJSON();

            if (url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')) {
                if (requestBody?.email === email && requestBody?.password === password) {
                    const errorResponse = {
                        error: {
                            code: 400,
                            message: 'INVALID_PASSWORD',
                            errors: [{
                                message: 'INVALID_PASSWORD',
                                domain: 'global',
                                reason: 'invalid'
                            }]
                        }
                    };
                    const response = MockResponseBuilder.error('Invalid credentials', 'INVALID_PASSWORD').build();
                    route.fulfill(response);
                    return;
                }
            }

            route.continue();
        });
    }

    async mockPasswordReset(email: string, scenario: 'success' | 'user-not-found' | 'network-error' | 'invalid-email' = 'success'): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.route('**/**', (route) => {
            const url = route.request().url();
            const requestBody = route.request().postDataJSON();

            if (url.includes('identitytoolkit.googleapis.com/v1/accounts:sendOobCode')) {
                if (requestBody?.requestType === 'PASSWORD_RESET' && requestBody?.email === email) {
                    let response;

                    switch (scenario) {
                        case 'success':
                            response = MockResponseBuilder.success({
                                email: email,
                                kind: 'identitytoolkit#GetOobConfirmationCodeResponse'
                            }).build();
                            break;
                        case 'user-not-found':
                            response = MockResponseBuilder.error('EMAIL_NOT_FOUND', 'EMAIL_NOT_FOUND').build();
                            break;
                        case 'network-error':
                            route.abort('failed');
                            return;
                        case 'invalid-email':
                            response = MockResponseBuilder.error('INVALID_EMAIL', 'INVALID_EMAIL').build();
                            break;
                        default:
                            route.continue();
                            return;
                    }

                    route.fulfill(response);
                    return;
                }
            }

            route.continue();
        });
    }

    async mockRegistration(email: string, password: string, displayName: string, userId: string = 'new-user-id'): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.route('**/api/register', (route) => {
            const requestBody = route.request().postDataJSON();

            if (requestBody?.email === email &&
                requestBody?.password === password &&
                requestBody?.displayName === displayName &&
                requestBody?.termsAccepted === true &&
                requestBody?.cookiePolicyAccepted === true) {

                const registrationResponse = {
                    success: true,
                    user: {
                        uid: userId,
                        email: email,
                        displayName: displayName,
                        emailVerified: false,
                    },
                    idToken: 'mock-id-token-' + Date.now(),
                    refreshToken: 'mock-refresh-token-' + Date.now(),
                };

                const response = MockResponseBuilder.success(registrationResponse).build();
                route.fulfill(response);
                return;
            }

            const response = MockResponseBuilder.validationError('email', 'Registration data validation failed').build();
            route.fulfill(response);
        });
    }

    async mockAuthenticatedUser(authToken: { idToken: string; localId: string; refreshToken: string }, email: string = 'test@example.com', displayName: string = 'Test User'): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.route('**/_mock/firebase-auth/**', (route) => {
            const url = route.request().url();

            if (url.includes('accounts:lookup')) {
                const userResponse = {
                    kind: 'identitytoolkit#GetAccountInfoResponse',
                    users: [{
                        localId: authToken.localId,
                        email: email,
                        emailVerified: true,
                        displayName: displayName
                    }]
                };
                const response = MockResponseBuilder.success(userResponse).build();
                route.fulfill(response);
                return;
            }

            route.continue();
        });

        await this.page.evaluate(
            ({ authToken, email, displayName }) => {
                localStorage.setItem('USER_ID', authToken.localId);
                localStorage.setItem('AUTH_TOKEN', authToken.idToken);
                localStorage.setItem('REFRESH_TOKEN', authToken.refreshToken);

                const mockFirebaseUser = {
                    uid: authToken.localId,
                    email: email,
                    displayName: displayName,
                    emailVerified: true,
                    getIdToken: async () => authToken.idToken,
                    refreshToken: authToken.refreshToken,
                };

                (window as any).__FIREBASE_MOCK__ = {
                    auth: {
                        currentUser: mockFirebaseUser,
                        onAuthStateChanged: (callback: any) => {
                            setTimeout(() => callback(mockFirebaseUser), 0);
                            return () => {};
                        }
                    },
                    initialized: true
                };
            },
            { authToken, email, displayName }
        );
    }

    async mockUnauthenticatedState(): Promise<void> {
        await this.mockFirebaseConfig();

        await this.page.evaluate(() => {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {
                // Ignore storage errors
            }
        });
    }

    static generateAuthToken(): { idToken: string; localId: string; refreshToken: string } {
        const timestamp = Date.now();
        return {
            idToken: `mock-id-token-${timestamp}`,
            localId: `test-user-id-${timestamp}`,
            refreshToken: `mock-refresh-token-${timestamp}`
        };
    }
}