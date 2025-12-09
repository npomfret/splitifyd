import { AdminTenantRequestBuilder, AdminTenantsPage, ApiDriver } from '@billsplit-wl/test-support';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';

test.describe('Tenant editor', () => {
    test.describe('Core CRUD Operations', () => {
        test('admin can edit tenant colors and publish theme', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
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

            const apiDriver = await ApiDriver.create();
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
            await tenantEditorModal.setPrimaryColor('#2563eb');

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
            await tenantEditorModal2.verifyPrimaryColorValue('#2563eb');

            await tenantEditorModal2.clickClose();
        });

        test('admin can update multiple color fields at once', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
            await apiDriver.promoteUserToAdmin(user.uid);

            const tenantId = `test-multicolor-${Date.now()}`;
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName(`MultiColor ${tenantId.slice(-6)}`)
                    .withDomains([`${tenantId}.example.com`])
                    .build(),
                user.token,
            );

            const adminTenantsPage = new AdminTenantsPage(page);
            await adminTenantsPage.navigate();
            await adminTenantsPage.verifyPageLoaded();

            const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.verifyModalIsOpen();

            // Update multiple colors
            await tenantEditorModal.setPrimaryColor('#1a2b3c');
            await tenantEditorModal.setSecondaryColor('#4d5e6f');
            await tenantEditorModal.setAccentColor('#789abc');

            await tenantEditorModal.clickSave();
            await tenantEditorModal.verifyModalIsClosed();

            // Verify all persisted
            const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal2.verifyModalIsOpen();

            await tenantEditorModal2.verifyPrimaryColorValue('#1a2b3c');
            await tenantEditorModal2.verifySecondaryColorValue('#4d5e6f');
            await tenantEditorModal2.verifyAccentColorValue('#789abc');

            await tenantEditorModal2.clickClose();
        });
    });

    test.describe('Typography', () => {
        test('admin can update font families', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
            await apiDriver.promoteUserToAdmin(user.uid);

            const tenantId = `test-fonts-${Date.now()}`;
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName(`Fonts ${tenantId.slice(-6)}`)
                    .withDomains([`${tenantId}.example.com`])
                    .build(),
                user.token,
            );

            const adminTenantsPage = new AdminTenantsPage(page);
            await adminTenantsPage.navigate();
            await adminTenantsPage.verifyPageLoaded();

            const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.verifyModalIsOpen();

            // Typography is only available in Advanced mode
            await tenantEditorModal.switchToAdvancedMode();

            // Update font families
            await tenantEditorModal.setFontFamilySans('Roboto, sans-serif');
            await tenantEditorModal.setFontFamilySerif('Merriweather, serif');
            await tenantEditorModal.setFontFamilyMono('Fira Code, monospace');

            await tenantEditorModal.clickSave();
            await tenantEditorModal.verifyModalIsClosed();

            // Verify persisted
            const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal2.verifyModalIsOpen();

            // Switch to Advanced mode to access Typography section
            await tenantEditorModal2.switchToAdvancedMode();

            await tenantEditorModal2.verifyFontFamilySansValue('Roboto, sans-serif');
            await tenantEditorModal2.verifyFontFamilySerifValue('Merriweather, serif');
            await tenantEditorModal2.verifyFontFamilyMonoValue('Fira Code, monospace');

            await tenantEditorModal2.clickClose();
        });
    });

    test.describe('Advanced Controls', () => {
        test('tenant editor displays all advanced controls', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
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

            // Advanced controls are only visible in Advanced mode
            await tenantEditorModal.switchToAdvancedMode();

            // Verify all control sections visible
            await tenantEditorModal.verifyTypographyFieldsVisible();
            await tenantEditorModal.verifyAuroraGradientColorsVisible();
            await tenantEditorModal.verifyGlassmorphismColorsVisible();
            await tenantEditorModal.verifyMotionEffectsCheckboxesVisible();

            await tenantEditorModal.clickClose();
        });
    });

    test.describe('Marketing Flags', () => {
        test('admin can toggle all marketing flags', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
            await apiDriver.promoteUserToAdmin(user.uid);

            const tenantId = `test-marketing-${Date.now()}`;
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName(`Marketing ${tenantId.slice(-6)}`)
                    .withDomains([`${tenantId}.example.com`])
                    .build(),
                user.token,
            );

            const adminTenantsPage = new AdminTenantsPage(page);
            await adminTenantsPage.navigate();
            await adminTenantsPage.verifyPageLoaded();

            const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.verifyModalIsOpen();

            // Toggle all marketing flags off
            await tenantEditorModal.toggleShowMarketingContent(false);
            await tenantEditorModal.toggleShowPricingPage(false);

            await tenantEditorModal.clickSave();
            await tenantEditorModal.verifyModalIsClosed();

            // Verify persisted
            const tenantEditorModal2 = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal2.verifyModalIsOpen();

            await tenantEditorModal2.verifyShowMarketingContentChecked(false);
            await tenantEditorModal2.verifyShowPricingPageChecked(false);

            // Toggle them back on
            await tenantEditorModal2.toggleShowMarketingContent(true);
            await tenantEditorModal2.toggleShowPricingPage(true);

            await tenantEditorModal2.clickSave();
            await tenantEditorModal2.verifyModalIsClosed();

            // Verify again
            const tenantEditorModal3 = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal3.verifyModalIsOpen();

            await tenantEditorModal3.verifyShowMarketingContentChecked(true);
            await tenantEditorModal3.verifyShowPricingPageChecked(true);

            await tenantEditorModal3.clickClose();
        });
    });

    test.describe('Theme Publishing', () => {
        test('published theme CSS contains configured colors', async ({ createLoggedInBrowsers }) => {
            const [{ page, user }] = await createLoggedInBrowsers(1);

            const apiDriver = await ApiDriver.create();
            await apiDriver.promoteUserToAdmin(user.uid);

            const tenantId = `test-publish-${Date.now()}`;
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName(`Publish ${tenantId.slice(-6)}`)
                    .withDomains([`${tenantId}.example.com`])
                    .withPrimaryColor('#abcdef')
                    .withSecondaryColor('#123456')
                    .withAccentColor('#fedcba')
                    .build(),
                user.token,
            );

            const adminTenantsPage = new AdminTenantsPage(page);
            await adminTenantsPage.navigate();
            await adminTenantsPage.verifyPageLoaded();

            const tenantEditorModal = await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.verifyModalIsOpen();

            const cssUrl = await tenantEditorModal.clickPublishAndGetCssUrl();

            // Verify CSS contains all configured colors
            const cssResponse = await page.request.get(cssUrl);
            expect(cssResponse.ok()).toBeTruthy();
            const cssText = (await cssResponse.text()).toLowerCase();

            expect(cssText).toContain('#abcdef');
            expect(cssText).toContain('#123456');
            expect(cssText).toContain('#fedcba');

            await tenantEditorModal.clickClose();
        });
    });
});
