import { test, expect } from '@playwright/test';
import { setupPolicyPageTest, testPolicyPageError } from '../infra/test-helpers';

test.describe.serial('Privacy Policy Page', () => {
    test.beforeAll(async ({ browser }) => {
        // Create a single page for all tests to reuse
        const context = await browser.newContext();
        const page = await context.newPage();

        await setupPolicyPageTest(
            page,
            '/privacy-policy',
            '**/api/policies/privacy-policy/current',
            {
                id: 'privacy-policy',
                type: 'PRIVACY_POLICY',
                text: 'This is our privacy policy. We collect and use your data responsibly.',
                createdAt: '2025-01-22T00:00:00Z',
            }
        );

        // Store page in global for reuse
        (globalThis as any).sharedPolicyPage = page;
    });

    test.afterAll(async () => {
        // Clean up shared page
        if ((globalThis as any).sharedPolicyPage) {
            await (globalThis as any).sharedPolicyPage.close();
            delete (globalThis as any).sharedPolicyPage;
        }
    });

    test('renders privacy policy content successfully', async () => {
        const page = (globalThis as any).sharedPolicyPage;
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Privacy Policy');
        await expect(page.locator('text=This is our privacy policy')).toBeVisible();
        await expect(page.locator('text=Last updated:')).toBeVisible();
    });

    test('has proper page title', async () => {
        const page = (globalThis as any).sharedPolicyPage;
        await expect(page).toHaveTitle(/Privacy Policy/);
    });

    test('shows error when policy fails to load', async ({ browser }) => {
        // For error testing, create a separate page since we need different mocking
        const context = await browser.newContext();
        const page = await context.newPage();

        await testPolicyPageError(
            page,
            '**/api/policies/privacy-policy/current',
            'Error loading privacy policy'
        );

        await page.close();
    });
});