import { HeaderPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Header Page Object', () => {
    test('should have all required element getters', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Verify all getter methods exist and return Locators
        expect(headerPage.getUserMenuButton()).toBeTruthy();
        expect(headerPage.getUserDropdownMenu()).toBeTruthy();
        expect(headerPage.getDashboardLink()).toBeTruthy();
    });

    test('should have user menu action methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Verify action methods exist
        expect(typeof headerPage.openUserMenu).toBe('function');
        expect(typeof headerPage.logout).toBe('function');
        expect(typeof headerPage.getCurrentUserDisplayName).toBe('function');
        expect(typeof headerPage.navigateToDashboard).toBe('function');
    });

    test('should be able to get user menu button', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Navigate to dashboard where header is rendered (first navigation may take longer)
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });

        const userMenuButton = headerPage.getUserMenuButton();
        await expect(userMenuButton).toBeVisible();
    });

    test('should be able to get user dropdown menu', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Navigate to dashboard where header is rendered
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Dropdown should not be visible initially
        const dropdown = headerPage.getUserDropdownMenu();
        await expect(dropdown).not.toBeVisible();
    });

    test('should be able to open user menu', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Navigate to dashboard where header is rendered
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Open the menu
        await headerPage.openUserMenu();

        // Verify menu is open
        const dropdown = headerPage.getUserDropdownMenu();
        await expect(dropdown).toBeVisible();
    });

    test('should be able to get current user display name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Navigate to dashboard where header is rendered
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        const displayName = await headerPage.getCurrentUserDisplayName();
        expect(displayName).toBeTruthy();
        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);
    });

    test('should be able to navigate to dashboard', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Start from a different page (settings)
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Navigate to dashboard using header
        await headerPage.navigateToDashboard();

        // Verify we're on dashboard
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should have dashboard link in dropdown menu', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const headerPage = new HeaderPage(page);

        // Navigate to dashboard where header is rendered
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Open menu first
        await headerPage.openUserMenu();

        // Check for dashboard link
        const dashboardLink = headerPage.getDashboardLink();
        await expect(dashboardLink).toBeVisible();
    });
});
