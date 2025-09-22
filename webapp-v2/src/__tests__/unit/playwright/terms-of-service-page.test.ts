import { test, expect } from '@playwright/test';
import { setupPolicyPageTest, testPolicyPageError } from '../infra/test-helpers';

test.describe.serial('Terms of Service Page', () => {
    test.beforeAll(async ({ browser }) => {
        // Create a single page for all tests to reuse
        const context = await browser.newContext();
        const page = await context.newPage();

        await setupPolicyPageTest(
            page,
            '/terms',
            '**/api/policies/terms-of-service/current',
            {
                id: 'terms-of-service',
                type: 'TERMS_OF_SERVICE',
                text: 'These are the terms of service for Splitifyd. By using our service, you agree to these terms.',
                createdAt: '2025-01-22T00:00:00Z',
            }
        );

        // Store page in global for reuse
        (globalThis as any).sharedTermsPage = page;
    });

    test.afterAll(async () => {
        // Clean up shared page
        if ((globalThis as any).sharedTermsPage) {
            await (globalThis as any).sharedTermsPage.close();
            delete (globalThis as any).sharedTermsPage;
        }
    });

    test('renders terms of service content successfully', async () => {
        const page = (globalThis as any).sharedTermsPage;
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Terms of Service');
        await expect(page.locator('text=These are the terms of service')).toBeVisible();
        await expect(page.locator('text=Last updated:')).toBeVisible();
    });

    test('has proper page title', async () => {
        const page = (globalThis as any).sharedTermsPage;
        await expect(page).toHaveTitle(/Terms of Service/);
    });

    test('shows error when terms fail to load', async ({ browser }) => {
        // For error testing, create a separate page since we need different mocking
        const context = await browser.newContext();
        const page = await context.newPage();

        await testPolicyPageError(
            page,
            '**/api/policies/terms-of-service/current',
            'Error loading terms'
        );

        await page.close();
    });
});