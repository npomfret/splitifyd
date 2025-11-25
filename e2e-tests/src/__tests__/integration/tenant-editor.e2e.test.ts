import { AdminTenantRequestBuilder, AdminTenantsPage, ApiDriver } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';

test.describe('Tenant editor', () => {
    test('admin can edit tenant colors and publish theme', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);

        // Create tenant via API with unique name
        const tenantId = `test-theme-${Date.now()}`;
        const appName = `Theme Test ${tenantId.slice(-6)}`;
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName(appName)
                .withDomains([`${tenantId}.example.com`])
                .build(),
            user.token,
        );

        // Navigate directly to admin tenants page
        const adminTenantsPage = new AdminTenantsPage(page);
        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        // Open editor for first tenant (most recently created should be first)
        const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.verifyModalIsOpen();

        // Update colors
        await tenantEditorModal.setAccentColor('#ff00ff');
        await tenantEditorModal.setCustomCss('/* e2e custom css */');

        // Save
        await tenantEditorModal.clickSave();
        await tenantEditorModal.verifyModalIsClosed();

        // Reopen and publish theme
        const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal2.verifyModalIsOpen();
        const cssUrl = await tenantEditorModal2.clickPublishAndGetCssUrl();

        // Verify CSS was published with our color
        const cssResponse = await page.request.get(cssUrl);
        expect(cssResponse.ok()).toBeTruthy();
        expect((await cssResponse.text()).toLowerCase()).toContain('#ff00ff');
    });

    test('admin can update fields and they persist', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);

        // Create tenant with unique name
        const tenantId = `test-persist-${Date.now()}`;
        const initialName = `Persist Test ${tenantId.slice(-6)}`;
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName(initialName)
                .withDomains([`${tenantId}.example.com`])
                .build(),
            user.token,
        );

        // Navigate directly to admin tenants page
        const adminTenantsPage = new AdminTenantsPage(page);
        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        // Open editor for first tenant
        const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.verifyModalIsOpen();

        const updatedName = `Updated ${tenantId.slice(-6)}`;
        await tenantEditorModal.fillAppName(updatedName);
        await tenantEditorModal.fillLogoUrl('/updated-logo.svg');
        await tenantEditorModal.setPrimaryColor('#2563eb');
        await tenantEditorModal.toggleShowLandingPage(false);

        // Save
        await tenantEditorModal.clickSave();
        await tenantEditorModal.verifyModalIsClosed();

        // Refresh and reopen to verify persistence
        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyTenantCardVisible(updatedName);

        const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal2.verifyModalIsOpen();

        // Verify values persisted
        await tenantEditorModal2.verifyAppNameValue(updatedName);
        await tenantEditorModal2.verifyLogoUrlValue('/updated-logo.svg');
        await tenantEditorModal2.verifyPrimaryColorValue('#2563eb');
        await tenantEditorModal2.verifyShowLandingPageChecked(false);

        await tenantEditorModal2.clickClose();
    });

    test('admin can toggle motion features', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);

        // Create tenant with unique name
        const tenantId = `test-motion-${Date.now()}`;
        const appName = `Motion Test ${tenantId.slice(-6)}`;
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName(appName)
                .withDomains([`${tenantId}.example.com`])
                .build(),
            user.token,
        );

        // Navigate directly
        const adminTenantsPage = new AdminTenantsPage(page);
        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        // Open editor for first tenant
        const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.verifyModalIsOpen();

        // Enable motion features
        await tenantEditorModal.toggleGlassmorphism(true);
        await tenantEditorModal.toggleMagneticHover(true);

        // Save
        await tenantEditorModal.clickSave();
        await tenantEditorModal.verifyModalIsClosed();

        // Reopen to verify
        await adminTenantsPage.navigate();
        const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal2.verifyModalIsOpen();

        await tenantEditorModal2.verifyGlassmorphismChecked(true);
        await tenantEditorModal2.verifyMagneticHoverChecked(true);

        await tenantEditorModal2.clickClose();
    });

    test('tenant editor displays all advanced controls', async ({ createLoggedInBrowsers }) => {
        const [{ page, user }] = await createLoggedInBrowsers(1);

        const apiDriver = new ApiDriver();
        await apiDriver.promoteUserToAdmin(user.uid);

        // Create tenant with aurora theme and unique name
        const tenantId = `test-controls-${Date.now()}`;
        const appName = `Controls Test ${tenantId.slice(-6)}`;
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName(appName)
                .withDomains([`${tenantId}.example.com`])
                .withAuroraTheme()
                .build(),
            user.token,
        );

        // Navigate directly
        const adminTenantsPage = new AdminTenantsPage(page);
        await adminTenantsPage.navigate();
        await adminTenantsPage.verifyPageLoaded();

        // Open editor for first tenant
        const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.verifyModalIsOpen();

        // Verify all control sections visible
        await tenantEditorModal.verifyTypographyFieldsVisible();
        await tenantEditorModal.verifyAuroraGradientColorsVisible();
        await tenantEditorModal.verifyGlassmorphismColorsVisible();
        await tenantEditorModal.verifyMotionEffectsCheckboxesVisible();

        await tenantEditorModal.clickClose();
    });
});
