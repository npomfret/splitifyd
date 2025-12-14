/**
 * Admin Tenant Config Tab Tests
 *
 * Tests that the tenant config tab displays loaded configuration values correctly.
 */

import { AdminTenantConfigPage } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';

test.describe('Admin Tenant Config Tab', () => {
    test('should display tenant configuration values after config loads', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantConfigPage = new AdminTenantConfigPage(page);

        // Navigate to tenant config tab
        await adminTenantConfigPage.navigate();

        // Wait for the page to load with all sections visible
        await adminTenantConfigPage.verifyPageLoaded();
        await adminTenantConfigPage.verifyBrandingTokensCardVisible();

        // Verify tenant ID is loaded (not showing "unknown")
        // Default tenant ID from TenantConfigBuilder is 'test-tenant'
        await adminTenantConfigPage.verifyTenantIdValue('test-tenant');

        // Verify app name shows the mocked value
        // Default app name from TenantConfigBuilder is 'Test App'
        await adminTenantConfigPage.verifyAppNameValue('Test App');
    });
});
