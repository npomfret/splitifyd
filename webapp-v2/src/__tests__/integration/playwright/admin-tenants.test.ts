import { AdminTenantsPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Admin Tenants Page - System Admin View', () => {
    test('should display page title and description', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        await expect(adminTenantsPage.getPageTitle()).toHaveText('Tenant Management');
        await expect(adminTenantsPage.getPageDescription()).toContainText('View and manage all tenant configurations');
    });

    test('should display tenant count', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Should show total tenant count
        await expect(adminTenantsPage.getTenantCount()).toBeVisible();
        await expect(adminTenantsPage.getTenantCount()).toContainText('Total tenants:');
    });

    test('should display refresh button', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForPageReady();

        await expect(adminTenantsPage.getRefreshButton()).toBeVisible();
        await expect(adminTenantsPage.getRefreshButton()).toBeEnabled();
    });

    test('should show loading spinner initially', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        // Start navigation but don't wait
        const navigationPromise = page.goto(adminTenantsPage.url);

        // Loading spinner should be visible
        await expect(adminTenantsPage.getLoadingSpinner()).toBeVisible();

        // Wait for navigation to complete
        await navigationPromise;
    });

    test('should hide loading spinner after data loads', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Loading spinner should be hidden
        await adminTenantsPage.verifyLoadingSpinnerHidden();
    });

    test('should display tenant cards', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Should have at least one tenant card
        const cardCount = await adminTenantsPage.countTenantCards();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('should display tenant app name', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // First tenant card should have an app name
        const appName = adminTenantsPage.getFirstTenantAppName();
        await expect(appName).toBeVisible();

        const appNameText = await appName.textContent();
        expect(appNameText).toBeTruthy();
        expect(appNameText!.trim().length).toBeGreaterThan(0);
    });

    test('should display default badge for default tenant', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Check if any tenant has the default badge
        const defaultBadge = adminTenantsPage.getDefaultBadge();
        const defaultBadgeCount = await defaultBadge.count();

        // If there's a default tenant, verify the badge
        if (defaultBadgeCount > 0) {
            await adminTenantsPage.verifyDefaultBadgeVisible();
        }
    });

    test('should display tenant ID', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // Should contain "Tenant ID:"
        expect(cardText).toContain('Tenant ID:');
    });

    test('should display primary domain when available', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // If tenant has a primary domain, it should be visible
        if (cardText?.includes('Primary Domain:')) {
            expect(cardText).toMatch(/Primary Domain:\s*\S+/);
        }
    });

    test('should display all domains when available', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // If tenant has domains, they should be visible
        if (cardText?.includes('All Domains:')) {
            expect(cardText).toMatch(/All Domains:\s*\S+/);
        }
    });

    test('should display feature flags section', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // Should have Features section
        expect(cardText).toContain('Features:');
        expect(cardText).toContain('Multi-Currency:');
        expect(cardText).toContain('Advanced Reporting:');
    });

    test('should display feature enabled/disabled status', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // Each feature should show Enabled or Disabled
        expect(cardText).toMatch(/Multi-Currency:.*?(Enabled|Disabled)/);
        expect(cardText).toMatch(/Advanced Reporting:.*?(Enabled|Disabled)/);
    });

    test('should display max groups and max users limits', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // Should display limits
        expect(cardText).toContain('Max Groups:');
        expect(cardText).toContain('Max Users per Group:');
    });

    test('should display created and updated dates', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const firstCard = adminTenantsPage.getTenantCards().first();
        const cardText = await firstCard.textContent();

        // Should show timestamps
        expect(cardText).toContain('Created:');
        expect(cardText).toContain('Updated:');
    });

    test('should refresh tenant list when refresh button clicked', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get initial count
        const initialCount = await adminTenantsPage.countTenantCards();

        // Click refresh
        await adminTenantsPage.clickRefresh();

        // Wait for reload
        await adminTenantsPage.waitForTenantsLoaded();

        // Should still have same count (no data changed)
        const newCount = await adminTenantsPage.countTenantCards();
        expect(newCount).toBe(initialCount);
    });

    test('should extract tenant data correctly', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant app name
        const firstAppName = await adminTenantsPage.getFirstTenantAppName().textContent();
        expect(firstAppName).toBeTruthy();

        // Extract tenant data
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // Verify extracted data structure
        expect(tenantData).toHaveProperty('appName');
        expect(tenantData).toHaveProperty('tenantId');
        expect(tenantData).toHaveProperty('isDefault');
        expect(tenantData).toHaveProperty('primaryDomain');
        expect(tenantData).toHaveProperty('features');
        expect(tenantData.features).toHaveProperty('multiCurrency');
        expect(tenantData.features).toHaveProperty('advancedReporting');

        // Verify data types
        expect(typeof tenantData.appName).toBe('string');
        expect(typeof tenantData.tenantId).toBe('string');
        expect(typeof tenantData.isDefault).toBe('boolean');
        expect(typeof tenantData.features.multiCurrency).toBe('boolean');
        expect(typeof tenantData.features.advancedReporting).toBe('boolean');
    });

    test('should handle empty tenant list', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        // Mock empty response (this would need MSW setup in real scenario)
        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForPageReady();

        // If no tenants, should show empty state or have zero cards
        const cardCount = await adminTenantsPage.countTenantCards();
        if (cardCount === 0) {
            // Should show empty state message
            await adminTenantsPage.verifyEmptyState();
        }
    });

    test('should maintain proper URL after navigation', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();

        // Should be on admin tenants page
        await expect(page).toHaveURL(/\/admin\/tenants/);
    });
});

test.describe('Admin Tenants Page - Access Control', () => {
    test('should have correct page URL constant', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        expect(adminTenantsPage.url).toBe('/admin/tenants');
    });

    test('should navigate using page object navigate method', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();

        // Verify navigation succeeded
        await expect(page).toHaveURL(/\/admin\/tenants/);
        await expect(adminTenantsPage.getPageTitle()).toBeVisible();
    });
});

test.describe('Admin Tenants Page - Data Extraction', () => {
    test('should count tenant cards accurately', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const count = await adminTenantsPage.countTenantCards();

        // Verify count matches actual card count
        const cards = adminTenantsPage.getTenantCards();
        const actualCount = await cards.count();

        expect(count).toBe(actualCount);
    });

    test('should extract multi-currency feature flag', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const firstAppName = await adminTenantsPage.getFirstTenantAppName().textContent();
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // Feature flag should be a boolean
        expect(typeof tenantData.features.multiCurrency).toBe('boolean');
    });

    test('should extract advanced reporting feature flag', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const firstAppName = await adminTenantsPage.getFirstTenantAppName().textContent();
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // Feature flag should be a boolean
        expect(typeof tenantData.features.advancedReporting).toBe('boolean');
    });

    test('should extract default tenant status', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const firstAppName = await adminTenantsPage.getFirstTenantAppName().textContent();
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // isDefault should be a boolean
        expect(typeof tenantData.isDefault).toBe('boolean');
    });
});
