/**
 * Setup file for Playwright unit tests with mocked backend
 * This intercepts API calls and provides mock responses
 */

import { Page } from '@playwright/test';

export const mockFirebaseConfig = {
    firebase: {
        apiKey: "test-api-key",
        authDomain: "test.firebaseapp.com",
        projectId: "test-project",
        storageBucket: "test.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef"
    },
    environment: {},
    formDefaults: {}
};

export async function setupMocks(page: Page) {
    // Mock the config API endpoint
    await page.route('**/api/config', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockFirebaseConfig)
        });
    });

    // Mock Firebase Auth API calls
    await page.route('**/identitytoolkit.googleapis.com/**', async route => {
        const url = route.request().url();
        
        if (url.includes('accounts:signUp')) {
            // Mock successful registration
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idToken: 'mock-token',
                    email: 'newuser@example.com',
                    refreshToken: 'mock-refresh',
                    expiresIn: '3600',
                    localId: 'mock-user-id'
                })
            });
        } else if (url.includes('accounts:signInWithPassword')) {
            // Mock sign in
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idToken: 'mock-token',
                    email: 'user@example.com',
                    refreshToken: 'mock-refresh',
                    expiresIn: '3600',
                    localId: 'mock-user-id'
                })
            });
        } else {
            // Default mock response
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({})
            });
        }
    });

    // Mock Firestore API calls
    await page.route('**/firestore.googleapis.com/**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                documents: [],
                nextPageToken: null
            })
        });
    });

    // Mock the API base URL function that gets injected by post-build
    await page.addInitScript(() => {
        (window as any).getApiBaseUrl = () => 'http://localhost:5173/api';
    });
}

export async function waitForApp(page: Page) {
    // Wait for the app to be ready (React/Preact rendered)
    await page.waitForSelector('[data-testid="app-root"], #app, .app-container, main', { 
        timeout: 10000,
        state: 'visible'
    });
}