import { test, expect } from '@playwright/test';
import { setupPolicyPageTest, testPolicyPageError } from '../infra/test-helpers';

test.describe.serial('Cookie Policy Page', () => {
    test.beforeAll(async ({ browser }) => {
        // Create a single page for all tests to reuse
        const context = await browser.newContext();
        const page = await context.newPage();

        await setupPolicyPageTest(
            page,
            '/cookies',
            '**/api/policies/cookie-policy/current',
            {
                id: 'cookie-policy',
                type: 'COOKIE_POLICY',
                text: 'This is our cookie policy. We use cookies to improve your experience.',
                createdAt: '2025-01-22T00:00:00Z',
            }
        );

        // Store page in global for reuse
        (globalThis as any).sharedCookiePage = page;
    });

    test.afterAll(async () => {
        // Clean up shared page
        if ((globalThis as any).sharedCookiePage) {
            await (globalThis as any).sharedCookiePage.close();
            delete (globalThis as any).sharedCookiePage;
        }
    });

    test('renders cookie policy content successfully', async () => {
        const page = (globalThis as any).sharedCookiePage;
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Cookie Policy');
        await expect(page.locator('text=This is our cookie policy')).toBeVisible();
        await expect(page.locator('text=Last updated:')).toBeVisible();
    });

    test('has proper page title', async () => {
        const page = (globalThis as any).sharedCookiePage;
        await expect(page).toHaveTitle(/Cookie Policy/);
    });

    test('shows error when cookie policy fails to load', async ({ browser }) => {
        // For error testing, create a separate page since we need different mocking
        const context = await browser.newContext();
        const page = await context.newPage();

        await testPolicyPageError(
            page,
            '**/api/policies/cookie-policy/current',
            'Error loading cookie policy'
        );

        await page.close();
    });
});