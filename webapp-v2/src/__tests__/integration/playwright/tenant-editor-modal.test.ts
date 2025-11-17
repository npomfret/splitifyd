import { AdminTenantsPage, TenantEditorModalPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Tenant Editor Modal', () => {
    test('should open modal when clicking create button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Click create button
        await page.getByTestId('create-tenant-button').click();

        // Verify modal opens
        await tenantEditorModal.verifyModalIsOpen();
    });

    test('should display all form fields in create mode', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Verify all fields are visible
        await expect(tenantEditorModal.tenantIdInput).toBeVisible();
        await expect(tenantEditorModal.appNameInput).toBeVisible();
        await expect(tenantEditorModal.logoUrlInput).toBeVisible();
        await expect(tenantEditorModal.faviconUrlInput).toBeVisible();
        await expect(tenantEditorModal.primaryColorInput).toBeVisible();
        await expect(tenantEditorModal.secondaryColorInput).toBeVisible();
        await expect(tenantEditorModal.accentColorInput).toBeVisible();
        await expect(tenantEditorModal.primaryDomainInput).toBeVisible();

        // Verify tenant ID is editable in create mode
        await expect(tenantEditorModal.tenantIdInput).toBeEnabled();
    });

    test('should validate required fields', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
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
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Fill with invalid tenant ID (contains uppercase)
        await tenantEditorModal.fillTenantId('Invalid-Tenant-ID');
        await tenantEditorModal.fillAppName('Test Tenant');
        await tenantEditorModal.fillLogoUrl('/logo.png');
        await tenantEditorModal.fillPrimaryDomain('test.example.com');
        await tenantEditorModal.clickSave();

        // Should show validation error about lowercase
        await tenantEditorModal.verifyErrorMessage();
    });

    test('should validate domain format', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Fill with invalid domain
        await tenantEditorModal.fillTenantId('test-tenant');
        await tenantEditorModal.fillAppName('Test Tenant');
        await tenantEditorModal.fillLogoUrl('/logo.png');
        await tenantEditorModal.fillPrimaryDomain('invalid domain with spaces');
        await tenantEditorModal.clickSave();

        // Should show validation error about domain
        await tenantEditorModal.verifyErrorMessage();
    });

    test('should close modal when clicking cancel', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
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
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        await tenantEditorModal.clickClose();

        await tenantEditorModal.verifyModalIsClosed();
    });

    test('should add and remove domain aliases', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Add an alias
        await tenantEditorModal.addDomainAlias('alias1.example.com');

        // Verify alias appears in the list
        await expect(page.locator('text=alias1.example.com')).toBeVisible();

        // Remove the alias
        await tenantEditorModal.removeDomainAlias(0);

        // Verify alias is removed
        await expect(page.locator('text=alias1.example.com')).not.toBeVisible();
    });

    test('should open modal in edit mode with populated fields', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Click edit on first tenant
        const firstEditButton = page.locator('[data-testid^="edit-tenant-"]').first();
        await firstEditButton.click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Wait a bit for the modal to populate fields (useEffect)
        await page.waitForTimeout(500);

        // Verify tenant ID is disabled in edit mode
        await tenantEditorModal.verifyTenantIdDisabled();

        // Verify fields are populated (they shouldn't be empty)
        const appNameValue = await tenantEditorModal.appNameInput.inputValue();
        expect(appNameValue).toBeTruthy();
        expect(appNameValue.length).toBeGreaterThan(0);
    });

    test('should toggle marketing flags', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await page.getByTestId('create-tenant-button').click();
        await tenantEditorModal.waitForModalToBeVisible();

        // Check initial state of landing page checkbox (should be checked by default)
        await expect(tenantEditorModal.showLandingPageCheckbox).toBeChecked();

        // Toggle it off
        await tenantEditorModal.toggleShowLandingPage(false);
        await expect(tenantEditorModal.showLandingPageCheckbox).not.toBeChecked();

        // Toggle it back on
        await tenantEditorModal.toggleShowLandingPage(true);
        await expect(tenantEditorModal.showLandingPageCheckbox).toBeChecked();
    });
});
