import { AdminTenantsPage, TenantEditorModalPage } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Tenant Editor Modal', () => {
    test.describe('Core Modal Operations', () => {
        test('should open modal when clicking create button', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();

            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.verifyModalIsOpen();
        });

        test('should close modal when clicking cancel', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            await tenantEditorModal.clickCancel();
            await tenantEditorModal.verifyModalIsClosed();
        });

        test('should close modal when clicking X button', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            await tenantEditorModal.clickClose();
            await tenantEditorModal.verifyModalIsClosed();
        });

        test('should open modal in edit mode with populated fields', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();

            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();
            await tenantEditorModal.waitForFormPopulated();

            // Verify tenant ID is disabled in edit mode
            await tenantEditorModal.verifyTenantIdDisabled();

            // Verify fields are populated
            const appNameValue = await tenantEditorModal.getAppNameValue();
            expect(appNameValue).toBeTruthy();
            expect(appNameValue.length).toBeGreaterThan(0);
        });
    });

    test.describe('Form Fields Display', () => {
        test('should display all basic fields in create mode', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Basic info section is open by default
            await tenantEditorModal.verifyAllBasicFieldsVisible();
            await tenantEditorModal.verifyTenantIdEnabled();
        });

        test('should display typography fields when section expanded', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Typography is an Advanced-only section
            await tenantEditorModal.switchToAdvancedMode();
            await tenantEditorModal.verifyTypographyFieldsVisible();
        });

        test('should display motion effects checkboxes when section expanded', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Motion Effects is an Advanced-only section
            await tenantEditorModal.switchToAdvancedMode();
            await tenantEditorModal.verifyMotionEffectsCheckboxesVisible();
        });
    });

    test.describe('Validation', () => {
        test('should validate required fields', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Try to save without filling fields
            await tenantEditorModal.clickSave();

            // Should show validation error
            await tenantEditorModal.verifyErrorMessage();
        });

        test('should validate tenant ID format', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Fill with invalid tenant ID (contains uppercase)
            await tenantEditorModal.fillTenantId('Invalid-Tenant-ID');
            await tenantEditorModal.fillAppName('Test Tenant');
            await tenantEditorModal.addDomain('test.example.com');
            await tenantEditorModal.clickSave();

            // Should show validation error about lowercase
            await tenantEditorModal.verifyErrorMessage();
        });
    });

    test.describe('Domain Management', () => {
        test('should add and remove domains', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Add a domain
            await tenantEditorModal.addDomain('domain1.example.com');
            await tenantEditorModal.verifyDomainVisible('domain1.example.com');

            // Remove the domain
            await tenantEditorModal.removeDomain('domain1.example.com');
            await tenantEditorModal.verifyDomainNotVisible('domain1.example.com');
        });
    });

    test.describe('Marketing Flags', () => {
        test('should toggle marketing flags', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Check initial state (showPricingPage should be unchecked by default)
            await tenantEditorModal.verifyShowPricingPageChecked(false);

            // Toggle on
            await tenantEditorModal.toggleShowPricingPage(true);
            await tenantEditorModal.verifyShowPricingPageChecked(true);

            // Toggle back off
            await tenantEditorModal.toggleShowPricingPage(false);
            await tenantEditorModal.verifyShowPricingPageChecked(false);
        });
    });

    test.describe('Header Display Options', () => {
        test('should toggle show app name in header option', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Check initial state (should be checked by default - show app name)
            await tenantEditorModal.verifyShowAppNameInHeaderChecked(true);

            // Toggle off (for logos that contain the app name)
            await tenantEditorModal.toggleShowAppNameInHeader(false);
            await tenantEditorModal.verifyShowAppNameInHeaderChecked(false);

            // Toggle back on
            await tenantEditorModal.toggleShowAppNameInHeader(true);
            await tenantEditorModal.verifyShowAppNameInHeaderChecked(true);
        });
    });

    test.describe('Typography', () => {
        test('should allow setting custom font families', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Typography is an Advanced-only section
            await tenantEditorModal.switchToAdvancedMode();

            // Set custom fonts (page object auto-expands section)
            await tenantEditorModal.setFontFamilySans('Roboto, sans-serif');
            await tenantEditorModal.setFontFamilySerif('Georgia, serif');
            await tenantEditorModal.setFontFamilyMono('Fira Code, monospace');

            // Verify values
            await tenantEditorModal.verifyFontFamilySansValue('Roboto, sans-serif');
            await tenantEditorModal.verifyFontFamilySerifValue('Georgia, serif');
            await tenantEditorModal.verifyFontFamilyMonoValue('Fira Code, monospace');
        });
    });

    test.describe('Motion & Effects', () => {
        test('should toggle motion effects on and off', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Motion Effects is an Advanced-only section
            await tenantEditorModal.switchToAdvancedMode();

            // Toggle aurora animation
            await tenantEditorModal.toggleAuroraAnimation(true);
            await tenantEditorModal.verifyAuroraAnimationChecked(true);
            await tenantEditorModal.toggleAuroraAnimation(false);
            await tenantEditorModal.verifyAuroraAnimationChecked(false);

            // Toggle magnetic hover
            await tenantEditorModal.toggleMagneticHover(true);
            await tenantEditorModal.verifyMagneticHoverChecked(true);
            await tenantEditorModal.toggleMagneticHover(false);
            await tenantEditorModal.verifyMagneticHoverChecked(false);
        });
    });

    test.describe('Theme Publishing', () => {
        test('should offer a publish option when editing', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();

            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            await tenantEditorModal.clickPublish();
            await tenantEditorModal.verifySuccessMessage('Theme published successfully!');
        });
    });
});
