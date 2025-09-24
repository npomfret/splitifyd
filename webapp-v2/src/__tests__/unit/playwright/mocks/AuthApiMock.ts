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

}