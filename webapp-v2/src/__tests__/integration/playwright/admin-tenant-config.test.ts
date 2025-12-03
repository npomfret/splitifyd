/**
 * Admin Tenant Config Tab Tests
 *
 * Tests that the tenant config tab displays loaded configuration values correctly.
 */

import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Admin Tenant Config Tab', () => {
    test('should display tenant configuration values after config loads', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        // Navigate to tenant config tab
        await page.goto('/admin?tab=tenant-config');
        await page.waitForLoadState('networkidle');

        // Wait for the tenant overview card to be visible
        const tenantOverviewCard = page.getByTestId('tenant-overview-card');
        await expect(tenantOverviewCard).toBeVisible();

        // Wait for branding tokens card - this only appears when config.tenant.branding is loaded
        // This is the definitive test that config has been loaded and rendered
        const brandingTokensCard = page.getByTestId('branding-tokens-card');
        await expect(brandingTokensCard).toBeVisible({ timeout: 10000 });

        // Now verify tenant ID is loaded (not showing "unknown")
        const tenantIdValue = tenantOverviewCard.locator('p:has-text("Tenant ID")').locator('..').locator('p.font-mono');
        await expect(tenantIdValue).toHaveText('system-fallback-tenant');

        // Verify app name shows the mocked value
        const appNameValue = tenantOverviewCard.locator('p:has-text("App Name")').locator('..').locator('p.font-medium').last();
        await expect(appNameValue).toHaveText('Demo Expenses');
    });
});
