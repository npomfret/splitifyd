/**
 * Shared test helpers and utilities for Playwright behavioral tests
 *
 * These utilities provide consistent, reliable test patterns across all page tests.
 */

import { Page, expect } from '@playwright/test';

/**
 * Standard page setup with authentication and storage clearing
 */
export async function setupTestPage(page: Page, url: string): Promise<void> {
    // Clear auth state and storage before each test
    await page.context().clearCookies();

    // Navigate to page first to ensure localStorage is available
    await page.goto(url);

    // Clear storage safely
    await page.evaluate(() => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            // Ignore security errors in test setup
        }
    });
}

/**
 * Type-safe form field filling with validation
 * Note: For whitespace-only values, the browser may trim them to empty string
 */
export async function fillFormField(page: Page, selector: string, value: string): Promise<void> {
    const field = page.locator(selector);
    await field.fill(value);

    // For whitespace-only strings, browsers typically trim to empty
    const expectedValue = value.trim() === '' ? '' : value;
    await expect(field).toHaveValue(expectedValue);
}

/**
 * Consistent button state assertions
 */
export async function expectButtonState(page: Page, selector: string, state: 'enabled' | 'disabled'): Promise<void> {
    const button = page.locator(selector);
    if (state === 'enabled') {
        await expect(button).toBeEnabled();
    } else {
        await expect(button).toBeDisabled();
    }
}

/**
 * Navigation verification with timeout handling
 */
export async function verifyNavigation(page: Page, expectedUrl: string | RegExp, timeout = 5000): Promise<void> {
    if (typeof expectedUrl === 'string') {
        await expect(page).toHaveURL(expectedUrl, { timeout });
    } else {
        await expect(page).toHaveURL(expectedUrl, { timeout });
    }
}

/**
 * Wait for storage to be updated (replaces hardcoded timeouts)
 */
export async function waitForStorageUpdate(page: Page, key: string, expectedValue?: string): Promise<void> {
    await page.waitForFunction(
        ({ key, expectedValue }) => {
            const value = sessionStorage.getItem(key);
            return expectedValue ? value === expectedValue : value !== null;
        },
        { key, expectedValue },
        { timeout: 2000 },
    );
}

/**
 * Check if an element is visible and accessible
 */
export async function expectElementVisible(page: Page, selector: string): Promise<void> {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
}

/**
 * Fill multiple form fields at once
 */
export async function fillMultipleFields(page: Page, fields: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(fields)) {
        await fillFormField(page, selector, value);
    }
}

/**
 * Check multiple checkbox states
 */
export async function expectCheckboxStates(page: Page, checkboxes: Record<string, boolean>): Promise<void> {
    for (const [selector, shouldBeChecked] of Object.entries(checkboxes)) {
        const checkbox = page.locator(selector);
        if (shouldBeChecked) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }
}

/**
 * Verify form accessibility attributes
 */
export async function verifyFormAccessibility(page: Page, fields: { selector: string; type: string; ariaLabel?: string }[]): Promise<void> {
    for (const field of fields) {
        const element = page.locator(field.selector);
        await expect(element).toHaveAttribute('type', field.type);

        if (field.ariaLabel) {
            await expect(element).toHaveAttribute('aria-label', field.ariaLabel);
        }
    }
}

/**
 * Wait for error message to appear
 */
export async function expectErrorMessage(page: Page, expectedMessage?: string, timeout = 5000): Promise<void> {
    const errorElement = page.locator('[data-testid="error-message"]');
    await expect(errorElement).toBeVisible({ timeout });

    if (expectedMessage) {
        await expect(errorElement).toContainText(expectedMessage);
    }
}

/**
 * Mock Firebase authentication state
 */
export async function mockAuthState(page: Page, isAuthenticated: boolean, userId?: string): Promise<void> {
    // First, mock the Firebase config API
    await page.route('**/api/config', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                firebase: {
                    apiKey: 'test-api-key',
                    authDomain: 'test-project.firebaseapp.com',
                    projectId: 'test-project',
                    storageBucket: 'test-project.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
            }),
        });
    });

    if (isAuthenticated && userId) {
        // Mock Firebase Auth state and token verification
        await page.route('**/**', (route) => {
            const url = route.request().url();

            // Mock Firebase token verification
            if (url.includes('identitytoolkit.googleapis.com') && url.includes('lookup')) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        users: [
                            {
                                localId: userId,
                                email: 'test@example.com',
                                displayName: 'Test User',
                                emailVerified: true,
                            },
                        ],
                    }),
                });
                return;
            }

            // Continue with other requests
            route.continue();
        });

        // Set up authenticated state in the browser
        await page.evaluate(
            ({ userId }) => {
                // Mock localStorage
                localStorage.setItem('USER_ID', userId);

                // Mock the auth store with a user
                (window as any).__MOCK_AUTH_STATE__ = {
                    user: {
                        uid: userId,
                        email: 'test@example.com',
                        displayName: 'Test User',
                        emailVerified: true,
                    },
                    isAuthenticated: true,
                    isUpdatingProfile: false,
                    refreshAuthToken: async () => Promise.resolve(),
                    updateUserProfile: async () => Promise.resolve(),
                    logout: async () => Promise.resolve(),
                };
            },
            { userId },
        );
    } else {
        await page.evaluate(() => {
            localStorage.removeItem('USER_ID');
            (window as any).__MOCK_AUTH_STATE__ = {
                user: null,
                isAuthenticated: false,
                isUpdatingProfile: false,
                refreshAuthToken: async () => Promise.resolve(),
                updateUserProfile: async () => Promise.resolve(),
                logout: async () => Promise.resolve(),
            };
        });
    }
}

/**
 * Mock Firebase Auth login flow with network-level API mocking
 * This mimics the actual Firebase Auth REST API calls during login
 */
export async function mockFirebaseAuthLogin(page: Page, email = 'test1@test.com', password = 'rrRR44$', userId = 'Fcriodx25u5dPoeB1krJ1uXQRmDq'): Promise<void> {
    // Mock Firebase config API
    await page.route('**/api/config', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                firebase: {
                    apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
                    authDomain: 'splitifyd.firebaseapp.com',
                    projectId: 'splitifyd',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
                firebaseAuthUrl: 'http://127.0.0.1:6002',
                firebaseFirestoreUrl: 'http://127.0.0.1:6003',
            }),
        });
    });

    // Mock Firebase Auth REST API endpoints
    await page.route('**/**', (route) => {
        const url = route.request().url();
        const requestBody = route.request().postDataJSON();

        // Mock signInWithPassword endpoint
        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')) {
            if (requestBody?.email === email && requestBody?.password === password) {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        kind: 'identitytoolkit#VerifyPasswordResponse',
                        registered: true,
                        localId: userId,
                        email: email,
                        idToken: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoiQmlsbCBTcGxpdHRlciIsImVtYWlsIjoidGVzdDFAdGVzdC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImF1dGhfdGltZSI6MTc1ODA0NTI5MSwidXNlcl9pZCI6IkZjcmlvZHgyNXU1ZFBvZUIxa3JKMXVYUVJtRHEiLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3QxQHRlc3QuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifSwiaWF0IjoxNzU4MDQ1MjkxLCJleHAiOjE3NTgwNDg4OTEsImF1ZCI6InNwbGl0aWZ5ZCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9zcGxpdGlmeWQiLCJzdWIiOiJGY3Jpb2R4MjV1NWRQb2VCMWtySjF1WFFSbURxIn0.',
                        refreshToken: 'eyJfQXV0aEVtdWxhdG9yUmVmcmVzaFRva2VuIjoiRE8gTk9UIE1PRElGWSIsImxvY2FsSWQiOiJGY3Jpb2R4MjV1NWRQb2VCMWtySjF1WFFSbURxIiwicHJvdmlkZXIiOiJwYXNzd29yZCIsImV4dHJhQ2xhaW1zIjp7fSwicHJvamVjdElkIjoic3BsaXRpZnlkIn0=',
                        expiresIn: '3600'
                    }),
                });
                return;
            } else {
                // Mock invalid credentials
                route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 400,
                            message: 'INVALID_PASSWORD',
                            errors: [{
                                message: 'INVALID_PASSWORD',
                                domain: 'global',
                                reason: 'invalid'
                            }]
                        }
                    }),
                });
                return;
            }
        }

        // Mock accounts:lookup endpoint (called after successful login)
        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:lookup')) {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    kind: 'identitytoolkit#GetAccountInfoResponse',
                    users: [{
                        localId: userId,
                        email: email,
                        emailVerified: false,
                        displayName: 'Bill Splitter',
                        providerUserInfo: [{
                            providerId: 'password',
                            email: email,
                            federatedId: email,
                            displayName: 'Bill Splitter',
                            rawId: email
                        }],
                        photoUrl: '',
                        passwordHash: 'redacted',
                        passwordUpdatedAt: 1758045291000,
                        validSince: '1758045291',
                        disabled: false,
                        lastLoginAt: '1758045291000',
                        createdAt: '1758045291000',
                        customAuth: false
                    }]
                }),
            });
            return;
        }

        // Continue with other requests
        route.continue();
    });
}

/**
 * Perform a complete fake login flow by filling the login form
 */
export async function performFakeLogin(page: Page, email = 'test1@test.com', password = 'rrRR44$'): Promise<void> {
    // Set up the auth mocking first
    await mockFirebaseAuthLogin(page, email, password);

    // Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('#email-input', email);
    await page.fill('#password-input', password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for login to complete and redirect (more flexible pattern)
    try {
        await page.waitForURL(/\/(dashboard|groups)/, { timeout: 10000 });
    } catch (error) {
        // If redirect doesn't happen, check if we're still on login page
        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
            throw new Error(`Login flow failed - still on login page: ${currentUrl}`);
        }
        // If we're on a different page, that's acceptable too
    }
}

/**
 * Set up authenticated state by directly calling the Firebase Auth API
 * Using the exact curl commands provided by the user
 */
export async function setupAuthenticatedUser(page: Page, email = 'test@example.com', password = 'password123'): Promise<void> {
    console.log('🔧 Setting up authenticated user with direct API calls...');

    // Navigate to any page first to ensure proper context
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock the Firebase config to point to emulator
    await page.route('**/api/config', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                firebase: {
                    apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
                    authDomain: 'splitifyd.firebaseapp.com',
                    projectId: 'splitifyd',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
                firebaseAuthUrl: 'http://127.0.0.1:6002',
                firebaseFirestoreUrl: 'http://127.0.0.1:6003',
            }),
        });
    });

    // Perform the actual Firebase Auth API calls as shown in the curl examples
    const signInResponse = await page.evaluate(async ({ email, password }) => {
        try {
            // First, try to create the user in case it doesn't exist
            const signUpUrl = 'http://127.0.0.1:6002/identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';

            try {
                const signUpResp = await fetch(signUpUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': '*/*',
                        'Content-Type': 'application/json',
                        'Origin': 'http://localhost:5173'
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        returnSecureToken: true,
                        clientType: 'CLIENT_TYPE_WEB'
                    })
                });

                if (signUpResp.ok) {
                    const signUpData = await signUpResp.json();
                    console.log('✅ User created successfully:', signUpData.localId);
                } else {
                    const errorData = await signUpResp.json();
                    if (errorData.error?.message !== 'EMAIL_EXISTS') {
                        console.log('ℹ️ User creation failed (may already exist):', errorData.error?.message);
                    } else {
                        console.log('ℹ️ User already exists, proceeding with login');
                    }
                }
            } catch (createError) {
                console.log('ℹ️ User creation error, proceeding with login:', createError);
            }

            // Now try to sign in
            const signInUrl = 'http://127.0.0.1:6002/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';

            const signInResp = await fetch(signInUrl, {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:5173'
                },
                body: JSON.stringify({
                    returnSecureToken: true,
                    email: email,
                    password: password,
                    clientType: 'CLIENT_TYPE_WEB'
                })
            });

            if (!signInResp.ok) {
                const errorText = await signInResp.text();
                throw new Error(`SignIn failed: ${signInResp.status} ${errorText}`);
            }

            const signInData = await signInResp.json();
            console.log('✅ SignIn API response:', signInData);

            // Second API call: accounts lookup
            const lookupUrl = 'http://127.0.0.1:6002/identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';

            const lookupResp = await fetch(lookupUrl, {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:5173'
                },
                body: JSON.stringify({
                    idToken: signInData.idToken
                })
            });

            if (!lookupResp.ok) {
                throw new Error(`Lookup failed: ${lookupResp.status} ${await lookupResp.text()}`);
            }

            const lookupData = await lookupResp.json();
            console.log('✅ Lookup API response:', lookupData);

            // Set localStorage to indicate authenticated state
            localStorage.setItem('USER_ID', signInData.localId);

            return { signInData, lookupData };
        } catch (error) {
            console.error('❌ Firebase API calls failed:', error);
            throw error;
        }
    }, { email, password });

    console.log('✅ Authentication API calls completed successfully');

    // Wait a moment for any async operations to complete
    await page.waitForTimeout(1000);

    // Verify authentication worked
    const userId = await page.evaluate(() => localStorage.getItem('USER_ID'));
    if (!userId) {
        throw new Error('Authentication failed - no USER_ID in localStorage');
    }

    console.log('✅ User authenticated with ID:', userId);

    // Now reload the page to trigger Firebase auth initialization with the authenticated state
    console.log('🔄 Reloading page to initialize auth state...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Give auth store time to initialize and recognize the authenticated state
    await page.waitForTimeout(2000);

    // Verify the auth state was picked up by checking if USER_ID is still there
    const userIdAfterReload = await page.evaluate(() => localStorage.getItem('USER_ID'));
    if (!userIdAfterReload) {
        throw new Error('Authentication state lost after page reload');
    }

    console.log('✅ Auth state preserved after reload, user ID:', userIdAfterReload);
}

/**
 * Mock Firebase Auth password reset flow with network-level API mocking
 * This mimics the actual Firebase Auth REST API calls during password reset
 * Based on the exact curl command pattern provided
 */
export async function mockFirebasePasswordReset(page: Page, email = 'test1@test.com', scenario: 'success' | 'user-not-found' | 'network-error' | 'invalid-email' = 'success'): Promise<void> {
    // Mock Firebase config API
    await page.route('**/api/config', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                firebase: {
                    apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
                    authDomain: 'splitifyd.firebaseapp.com',
                    projectId: 'splitifyd',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
                firebaseAuthUrl: 'http://127.0.0.1:6002',
                firebaseFirestoreUrl: 'http://127.0.0.1:6003',
            }),
        });
    });

    // Mock Firebase Auth REST API endpoints
    await page.route('**/**', (route) => {
        const url = route.request().url();
        const requestBody = route.request().postDataJSON();

        // Mock Firebase Auth sendOobCode endpoint (exact match to curl command)
        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:sendOobCode') && url.includes('key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg')) {
            // Validate the request payload matches the curl command structure
            if (requestBody?.requestType === 'PASSWORD_RESET' &&
                requestBody?.email === email &&
                requestBody?.clientType === 'CLIENT_TYPE_WEB') {

                switch (scenario) {
                    case 'success':
                        route.fulfill({
                            status: 200,
                            contentType: 'application/json',
                            body: JSON.stringify({
                                email: email,
                                kind: 'identitytoolkit#GetOobConfirmationCodeResponse'
                            }),
                        });
                        break;
                    case 'user-not-found':
                        route.fulfill({
                            status: 400,
                            contentType: 'application/json',
                            body: JSON.stringify({
                                error: {
                                    code: 400,
                                    message: 'EMAIL_NOT_FOUND',
                                    errors: [
                                        {
                                            message: 'EMAIL_NOT_FOUND',
                                            domain: 'global',
                                            reason: 'invalid',
                                        },
                                    ],
                                },
                            }),
                        });
                        break;
                    case 'network-error':
                        route.abort('failed');
                        break;
                    case 'invalid-email':
                        route.fulfill({
                            status: 400,
                            contentType: 'application/json',
                            body: JSON.stringify({
                                error: {
                                    code: 400,
                                    message: 'INVALID_EMAIL',
                                    errors: [
                                        {
                                            message: 'INVALID_EMAIL',
                                            domain: 'global',
                                            reason: 'invalid',
                                        },
                                    ],
                                },
                            }),
                        });
                        break;
                    default:
                        route.continue();
                }
                return;
            } else {
                // Mock validation error for incorrect payload structure
                route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 400,
                            message: 'INVALID_REQUEST_PAYLOAD',
                            errors: [{
                                message: 'Request payload validation failed',
                                domain: 'global',
                                reason: 'invalid'
                            }]
                        }
                    }),
                });
                return;
            }
        }

        // Continue with other requests
        route.continue();
    });
}

/**
 * Set up network-level Firebase Auth mocking for password reset
 * @deprecated Use mockFirebasePasswordReset instead for better API matching
 */
export async function setupPasswordResetMocking(page: Page, scenario: 'success' | 'user-not-found' | 'network-error' | 'invalid-email'): Promise<void> {
    await mockFirebasePasswordReset(page, 'test@example.com', scenario);
}

/**
 * Set up Firebase auth redirect simulation
 */
export async function setupAuthRedirect(page: Page): Promise<void> {
    await page.addInitScript(() => {
        // Simulate redirect behavior for authenticated users
        if (window.location.pathname === '/login' && localStorage.getItem('USER_ID')) {
            window.location.href = '/dashboard';
        }
    });
}

/**
 * Mock Firebase Auth registration flow with network-level API mocking
 * This mimics the actual registration API call based on the curl command provided
 */
export async function mockFirebaseAuthRegister(page: Page, email = 'email@email.com', password = 'rrRR44$', displayName = 'name', userId = 'Fcriodx25u5dPoeB1krJ1uXQRmDq'): Promise<void> {
    // Mock Firebase config API
    await page.route('**/api/config', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                firebase: {
                    apiKey: 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg',
                    authDomain: 'splitifyd.firebaseapp.com',
                    projectId: 'splitifyd',
                    storageBucket: 'splitifyd.appspot.com',
                    messagingSenderId: '123456789',
                    appId: 'test-app-id',
                },
                firebaseAuthUrl: 'http://127.0.0.1:6002',
                firebaseFirestoreUrl: 'http://127.0.0.1:6003',
            }),
        });
    });

    // Mock the registration API endpoint that matches the curl command
    await page.route('**/api/register', (route) => {
        const requestBody = route.request().postDataJSON();

        // Check if the request matches expected registration data
        if (requestBody?.email === email &&
            requestBody?.password === password &&
            requestBody?.displayName === displayName &&
            requestBody?.termsAccepted === true &&
            requestBody?.cookiePolicyAccepted === true) {

            // Mock successful registration response
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    user: {
                        uid: userId,
                        email: email,
                        displayName: displayName,
                        emailVerified: false,
                    },
                    idToken: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoiQmlsbCBTcGxpdHRlciIsImVtYWlsIjoidGVzdDFAdGVzdC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImF1dGhfdGltZSI6MTc1ODA0NTI5MSwidXNlcl9pZCI6IkZjcmlvZHgyNXU1ZFBvZUIxa3JKMXVYUVJtRHEiLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3QxQHRlc3QuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifSwiaWF0IjoxNzU4MDQ1MjkxLCJleHAiOjE3NTgwNDg4OTEsImF1ZCI6InNwbGl0aWZ5ZCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9zcGxpdGlmeWQiLCJzdWIiOiJGY3Jpb2R4MjV1NWRQb2VCMWtySjF1WFFSbURxIn0.',
                    refreshToken: 'eyJfQXV0aEVtdWxhdG9yUmVmcmVzaFRva2VuIjoiRE8gTk9UIE1PRElGWSIsImxvY2FsSWQiOiJGY3Jpb2R4MjV1NWRQb2VCMWtySjF1WFFSbURxIiwicHJvdmlkZXIiOiJwYXNzd29yZCIsImV4dHJhQ2xhaW1zIjp7fSwicHJvamVjdElkIjoic3BsaXRpZnlkIn0=',
                }),
            });
            return;
        } else {
            // Mock validation error for incorrect data
            route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: {
                        code: 400,
                        message: 'INVALID_REGISTRATION_DATA',
                        errors: [{
                            message: 'Registration data validation failed',
                            domain: 'global',
                            reason: 'invalid'
                        }]
                    }
                }),
            });
            return;
        }
    });

    // Continue mocking other auth-related endpoints if needed
    await page.route('**/**', (route) => {
        const url = route.request().url();

        // Mock Firebase Auth lookup endpoint that might be called after registration
        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:lookup')) {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    kind: 'identitytoolkit#GetAccountInfoResponse',
                    users: [{
                        localId: userId,
                        email: email,
                        emailVerified: false,
                        displayName: displayName,
                        providerUserInfo: [{
                            providerId: 'password',
                            email: email,
                            federatedId: email,
                            displayName: displayName,
                            rawId: email
                        }],
                        photoUrl: '',
                        passwordHash: 'redacted',
                        passwordUpdatedAt: 1758045291000,
                        validSince: '1758045291',
                        disabled: false,
                        lastLoginAt: '1758045291000',
                        createdAt: '1758045291000',
                        customAuth: false
                    }]
                }),
            });
            return;
        }

        // Continue with other requests
        route.continue();
    });
}

/**
 * Common selectors used across tests
 */
export const SELECTORS = {
    // Form inputs
    EMAIL_INPUT: '#email-input',
    PASSWORD_INPUT: '#password-input',
    CONFIRM_PASSWORD_INPUT: '#confirm-password-input',
    FULLNAME_INPUT: '#fullname-input',

    // Buttons
    SUBMIT_BUTTON: 'button[type="submit"]',
    SIGNUP_BUTTON: '[data-testid="loginpage-signup-button"]',
    FORGOT_PASSWORD_BUTTON: 'button:has-text("Forgot")',
    BACK_TO_LOGIN_BUTTON: 'button:has-text("Back to Sign In")',

    // Checkboxes
    REMEMBER_ME_CHECKBOX: '[data-testid="remember-me-checkbox"]',
    TERMS_CHECKBOX: '[data-testid="terms-checkbox"]',
    COOKIES_CHECKBOX: '[data-testid="cookies-checkbox"]',

    // Error states
    ERROR_MESSAGE: '[data-testid="error-message"]',
    REQUIRED_INDICATOR: '[data-testid="required-indicator"]',

    // Warnings
    INVALID_LINK_WARNING: '[data-testid="invalid-link-warning"]',
    UNABLE_JOIN_WARNING: '[data-testid="unable-join-warning"]',

    // Join group specific
    JOIN_GROUP_ERROR: '[data-testid="join-group-error-message"]',

    // Reset password success state
    SUCCESS_ICON: 'svg',
    SUCCESS_TITLE: 'text=Email Sent Successfully',
    SUCCESS_EMAIL_DISPLAY: 'p.font-medium.text-gray-900',
    NEXT_STEPS_SECTION: '.bg-blue-50',
    SEND_TO_DIFFERENT_EMAIL_BUTTON: 'button:has-text("Send to Different Email")',
    BACK_TO_LOGIN_FROM_SUCCESS: 'button:has-text("← Back to Sign In")',
} as const;

/**
 * Common test scenarios for reuse
 */
export const TEST_SCENARIOS = {
    VALID_EMAIL: 'test@example.com',
    VALID_PASSWORD: 'password123',
    VALID_NAME: 'John Doe',

    INVALID_EMAILS: ['invalid-email', 'user@domain', '@example.com', 'user@'],
    WEAK_PASSWORDS: ['weak', '123', 'password'],
    STRONG_PASSWORDS: ['StrongPassword123!', 'MySecureP@ssw0rd', 'Complex!Pass123'],

    EMPTY_VALUES: ['', '   ', '\t\n'],
} as const;

/**
 * Form validation helper for common patterns
 */
export async function testFormValidation(page: Page, requiredFields: string[], submitSelector = SELECTORS.SUBMIT_BUTTON): Promise<void> {
    const submitButton = page.locator(submitSelector);

    // Initially button should be disabled
    await expect(submitButton).toBeDisabled();

    // Fill fields one by one and check button state
    for (let i = 0; i < requiredFields.length - 1; i++) {
        await fillFormField(page, requiredFields[i], 'test-value');
        await expect(submitButton).toBeDisabled();
    }

    // Fill last field - button should be enabled
    await fillFormField(page, requiredFields[requiredFields.length - 1], 'test-value');
    await expect(submitButton).toBeEnabled();
}

/**
 * Session storage persistence test helper
 */
export async function testSessionStoragePersistence(page: Page, testData: Record<string, { selector: string; value: string; storageKey: string }>): Promise<void> {
    // Fill all fields
    for (const [field, data] of Object.entries(testData)) {
        await fillFormField(page, data.selector, data.value);
    }

    // Wait for storage update
    await page.waitForTimeout(100); // TODO: Replace with proper wait condition

    // Verify storage values
    const storedValues = await page.evaluate(
        (keys) => {
            const result: Record<string, string | null> = {};
            keys.forEach((key) => {
                result[key] = sessionStorage.getItem(key);
            });
            return result;
        },
        Object.values(testData).map((d) => d.storageKey),
    );

    // Verify each stored value
    for (const [field, data] of Object.entries(testData)) {
        expect(storedValues[data.storageKey]).toBe(data.value);
    }

    // Refresh and verify restoration
    await page.reload();

    for (const [field, data] of Object.entries(testData)) {
        await expect(page.locator(data.selector)).toHaveValue(data.value);
    }
}
