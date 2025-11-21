import { AdminTenantsPage, AdminTenantRequestBuilder, ApiDriver } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';

const NEW_ACCENT_COLOR = '#ff00ff';

test.describe('Tenant editor publish', () => {
    test('admin can save, publish, and serve new colors', async ({ createLoggedInBrowsers }) => {
        const [{ page, user, dashboardPage }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);

        const tenantId = `test-theme-${Date.now()}`;
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('Test Theme App')
                .withDomains([`${tenantId}.example.com`])
                .build(),
            user.token,
        );

        await page.reload({ waitUntil: 'load' });
        await dashboardPage.header.openUserMenuAndVerifyAdminLinkVisible();
        await dashboardPage.header.closeUserMenu();

        const adminTenantsPage = new AdminTenantsPage(page);
        await Promise.all([
            page.waitForResponse(response =>
                response.url().includes('/user/profile') && response.status() === 200
            ),
            adminTenantsPage.navigate(),
        ]);
        await adminTenantsPage.verifyPageLoaded();

        const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.waitForModalToBeVisible();
        await tenantEditorModal.fillAllRequiredColors({
            primary: '#2563eb',
            secondary: '#7c3aed',
            accent: NEW_ACCENT_COLOR,
            background: '#0d0d1a',
            headerBackground: '#1a1a2b',
        });
        await tenantEditorModal.setThemePalette('e2e-palette');
        await tenantEditorModal.setCustomCss('/* e2e custom css */');
        await tenantEditorModal.clickSave();
        await tenantEditorModal.verifySuccessMessage('Tenant updated successfully!');

        const [publishResponse] = await Promise.all([
            page.waitForResponse(response =>
                response.url().includes('/admin/tenants/publish') && response.status() === 200
            ),
            tenantEditorModal.clickPublish(),
        ]);
        await tenantEditorModal.verifySuccessMessage('Theme published successfully!');

        const { cssUrl } = await publishResponse.json();
        if (!cssUrl) throw new Error('No CSS URL in publish response');

        const cssResponse = await page.request.get(cssUrl);
        expect(cssResponse.ok()).toBeTruthy();
        expect((await cssResponse.text()).toLowerCase()).toContain(NEW_ACCENT_COLOR.toLowerCase());
    });
});
