import { Page } from '@playwright/test';
import { MockResponseBuilder } from '../builders/MockResponseBuilder';

/**
 * Mock object for handling Authentication API endpoints in Playwright tests
 * Provides a fluent API for setting up auth-related API responses
 */
export class AuthApiMock {
    constructor(private page: Page) {}

    async mockConfigAPI(config: any): Promise<void> {
        await this.page.route('**/api/config', (route) => {
            const response = MockResponseBuilder.success(config).build();
            route.fulfill(response);
        });
    }

}