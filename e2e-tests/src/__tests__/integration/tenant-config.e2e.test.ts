import { AdminTenantConfigPage, ApiDriver } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';

test.describe('Tenant config tab', () => {
    test('displays tenant configuration values after loading', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = await ApiDriver.create();
        await apiDriver.promoteUserToAdmin(user.uid);

        const tenantConfigPage = new AdminTenantConfigPage(page);
        await tenantConfigPage.navigate();
        await tenantConfigPage.verifyPageLoaded();

        // Wait for branding tokens card to appear - indicates config has fully loaded
        await tenantConfigPage.verifyBrandingTokensCardVisible();

        // Verify tenant ID is loaded (not showing default "unknown")
        await tenantConfigPage.verifyTenantIdNotUnknown();

        // Verify app name is configured (not showing "Not configured")
        await tenantConfigPage.verifyAppNameNotDefault();

        // Verify theme hash is present
        await tenantConfigPage.verifyActiveHashPresent();

        // Verify computed CSS variables section is visible
        await tenantConfigPage.verifyComputedVarsCardVisible();
    });
});
