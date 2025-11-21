import { AdminTenantsPage, ApiDriver, HeaderPage, TenantEditorModalPage } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';

const NEW_ACCENT_COLOR = '#ff00ff';

test.describe('Tenant editor publish', () => {
    test('admin can save, publish, and serve new colors', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);
        await page.reload({ waitUntil: 'load' });

        const headerPage = new HeaderPage(page);
        await headerPage.openUserMenuAndVerifyAdminLinkVisible();
        await headerPage.closeUserMenu();

        const adminTenantsPage = new AdminTenantsPage(page);
        const profileResponsePromise = page.waitForResponse(response =>
            response.url().includes('/user/profile') && response.status() === 200
        );
        await adminTenantsPage.navigate();
        await profileResponsePromise;
        await adminTenantsPage.verifyPageLoaded();

        await adminTenantsPage.clickEditButtonForFirstTenant();

        const tenantEditorModal = new TenantEditorModalPage(page);
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

        const publishResponsePromise = page.waitForResponse(response =>
            response.url().includes('/admin/tenants/publish') && response.status() === 200
        );
        await tenantEditorModal.clickPublish();
        const publishResponse = await publishResponsePromise;
        await tenantEditorModal.verifySuccessMessage('Theme published successfully!');

        const publishResult = await publishResponse.json();
        const cssUrl = publishResult.cssUrl;
        if (!cssUrl) {
            throw new Error('No CSS URL in publish response');
        }

        const cssResponse = await page.request.get(cssUrl);
        expect(cssResponse.ok()).toBeTruthy();
        const cssContents = await cssResponse.text();
        expect(cssContents.toLowerCase()).toContain(NEW_ACCENT_COLOR.toLowerCase());
    });
});
