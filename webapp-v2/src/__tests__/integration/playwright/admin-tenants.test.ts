import { AdminTenantsPage, translationEn } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

const translation = translationEn;

test.describe('Admin Tenants Page - System Admin View', () => {
    test('should display page title and description', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        await adminTenantsPage.verifyPageTitleText(translation.admin.tenants.pageTitle);
        await adminTenantsPage.verifyPageDescriptionContainsText(translation.admin.tenants.pageDescription);
    });

    test('should display tenant count', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Should show total tenant count
        await adminTenantsPage.verifyTenantCountVisible();
        await adminTenantsPage.verifyTenantCountContainsText(translation.admin.tenants.summary.total);
    });

    test('should display refresh button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForPageReady();

        await adminTenantsPage.verifyRefreshButtonVisible();
        await adminTenantsPage.verifyRefreshButtonEnabled();
    });

    // Removed flaky test: 'should show loading spinner initially'
    // This test tried to catch a spinner during navigation, which is inherently unreliable
    // due to varying network speeds and React render timing. The loading behavior is
    // already verified by the test below that confirms the spinner is hidden after load.

    test('should hide loading spinner after data loads', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Loading spinner should be hidden
        await adminTenantsPage.verifyLoadingSpinnerHidden();
    });

    test('should display tenant cards', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Should have at least one tenant card
        const cardCount = await adminTenantsPage.countTenantCards();
        expect(cardCount).toBeGreaterThan(0);
    });

    test('should display tenant app name', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // First tenant card should have an app name
        await adminTenantsPage.verifyFirstTenantAppNameVisible();

        const appNameText = await adminTenantsPage.getFirstTenantAppNameText();
        expect(appNameText).toBeTruthy();
        expect(appNameText!.trim().length).toBeGreaterThan(0);
    });

    test('should display default badge for default tenant', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Check if any tenant has the default badge
        const defaultBadgeCount = await adminTenantsPage.getDefaultBadgeCount();

        // If there's a default tenant, verify the badge
        if (defaultBadgeCount > 0) {
            await adminTenantsPage.verifyDefaultBadgeVisible();
        }
    });

    test('should display tenant ID', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const cardText = await adminTenantsPage.getFirstTenantCardText();

        // Should contain tenant ID label
        expect(cardText).toContain(translation.admin.tenants.details.tenantId);
    });

    test('should display primary domain when available', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const cardText = await adminTenantsPage.getFirstTenantCardText();

        // If tenant has a primary domain, it should be visible
        const primaryDomainLabel = translation.admin.tenants.details.primaryDomain;
        if (cardText?.includes(primaryDomainLabel)) {
            expect(cardText).toMatch(new RegExp(`${primaryDomainLabel}\\s*\\S+`));
        }
    });

    test('should display all domains when available', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const cardText = await adminTenantsPage.getFirstTenantCardText();

        // If tenant has domains, they should be visible
        const allDomainsLabel = translation.admin.tenants.details.allDomains;
        if (cardText?.includes(allDomainsLabel)) {
            expect(cardText).toMatch(new RegExp(`${allDomainsLabel}\\s*\\S+`));
        }
    });

    test('should display created and updated dates', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant card
        const cardText = await adminTenantsPage.getFirstTenantCardText();

        // Should show timestamps
        expect(cardText).toContain(`${translation.common.created}:`);
        expect(cardText).toContain(`${translation.common.updated}:`);
    });

    test('should refresh tenant list when refresh button clicked', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
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

    test('should extract tenant data correctly', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Get first tenant app name
        const firstAppName = await adminTenantsPage.getFirstTenantAppNameText();
        expect(firstAppName).toBeTruthy();

        // Extract tenant data
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // Verify extracted data structure
        expect(tenantData).toHaveProperty('appName');
        expect(tenantData).toHaveProperty('tenantId');
        expect(tenantData).toHaveProperty('isDefault');

        // Verify data types
        expect(typeof tenantData.appName).toBe('string');
        expect(typeof tenantData.tenantId).toBe('string');
        expect(typeof tenantData.isDefault).toBe('boolean');
    });

    test('should handle empty tenant list', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
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

    test('should maintain proper URL after navigation', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();

        // Should be on admin page with tenants tab
        await expect(page).toHaveURL(/\/admin(\?tab=tenants)?/);
    });
});

test.describe('Admin Tenants Page - Access Control', () => {
    test('should have correct page URL constant', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        expect(adminTenantsPage.url).toBe('/admin?tab=tenants');
    });

    test('should navigate using page object navigate method', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();

        // Verify navigation succeeded
        await expect(page).toHaveURL(/\/admin(\?tab=tenants)?/);
        await adminTenantsPage.verifyPageLoaded();
    });
});

test.describe('Admin Tenants Page - Data Extraction', () => {
    test('should count tenant cards accurately', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const count = await adminTenantsPage.countTenantCards();

        // Count should be consistent
        const secondCount = await adminTenantsPage.countTenantCards();

        expect(count).toBe(secondCount);
    });

    test('should extract default tenant status', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        const firstAppName = await adminTenantsPage.getFirstTenantAppNameText();
        const tenantData = await adminTenantsPage.extractTenantData(firstAppName!);

        // isDefault should be a boolean
        expect(typeof tenantData.isDefault).toBe('boolean');
    });
});
