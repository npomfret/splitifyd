import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TenantEditorModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ✅ Protected locators - internal use only (semantic selectors preferred over test IDs)
    protected getModal(): Locator {
        return this.page.getByRole('dialog');
    }

    protected getModalHeading(): Locator {
        return this.page.getByRole('heading', { name: /create new tenant|edit tenant/i });
    }

    protected getTenantIdInput(): Locator {
        return this.page.getByLabel(/tenant id/i);
    }

    protected getAppNameInput(): Locator {
        return this.page.getByLabel(/app name/i);
    }

    protected getLogoUploadField(): Locator {
        return this.page.getByTestId('logo-upload-field');
    }

    protected getFaviconUploadField(): Locator {
        return this.page.getByTestId('favicon-upload-field');
    }

    protected getPrimaryColorInput(): Locator {
        return this.page.getByTestId('primary-color-input');
    }

    protected getSecondaryColorInput(): Locator {
        return this.page.getByTestId('secondary-color-input');
    }

    protected getAccentColorInput(): Locator {
        return this.page.getByTestId('accent-color-input');
    }

    protected getSurfaceColorInput(): Locator {
        return this.page.getByTestId('surface-color-input');
    }

    protected getTextColorInput(): Locator {
        return this.page.getByTestId('text-primary-color-input');
    }

    protected getCustomCssInput(): Locator {
        // Custom CSS was removed from the form
        return this.page.locator('[data-testid="custom-css-input"]');
    }

    protected getShowLandingPageCheckbox(): Locator {
        return this.page.getByLabel(/landing page/i);
    }

    protected getShowMarketingContentCheckbox(): Locator {
        return this.page.getByLabel(/marketing content/i);
    }

    protected getShowPricingPageCheckbox(): Locator {
        return this.page.getByLabel(/pricing page/i);
    }

    // Motion & Effects
    protected getEnableAuroraAnimationCheckbox(): Locator {
        return this.page.getByLabel(/aurora background animation/i);
    }

    protected getEnableGlassmorphismCheckbox(): Locator {
        return this.page.getByLabel(/glassmorphism/i);
    }

    protected getEnableMagneticHoverCheckbox(): Locator {
        return this.page.getByLabel(/magnetic hover/i);
    }

    protected getEnableScrollRevealCheckbox(): Locator {
        return this.page.getByLabel(/scroll reveal/i);
    }

    // Typography Controls
    protected getFontFamilySansInput(): Locator {
        return this.page.locator('#font-family-sans-input');
    }

    protected getFontFamilySerifInput(): Locator {
        return this.page.locator('#font-family-serif-input');
    }

    protected getFontFamilyMonoInput(): Locator {
        return this.page.locator('#font-family-mono-input');
    }

    // Aurora Gradient (4 colors) - using label-based selectors now that labels have proper 'for' attributes
    protected getAuroraGradientSection(): Locator {
        return this.page.getByRole('heading', { name: /aurora gradient/i }).locator('..');
    }

    protected getAuroraGradientColor1Input(): Locator {
        return this.page.locator('#aurora-gradient-color-1-input');
    }

    protected getAuroraGradientColor2Input(): Locator {
        return this.page.locator('#aurora-gradient-color-2-input');
    }

    protected getAuroraGradientColor3Input(): Locator {
        return this.page.locator('#aurora-gradient-color-3-input');
    }

    protected getAuroraGradientColor4Input(): Locator {
        return this.page.locator('#aurora-gradient-color-4-input');
    }

    // Glassmorphism Colors
    protected getGlassColorInput(): Locator {
        return this.page.locator('#glass-color-input');
    }

    protected getGlassBorderColorInput(): Locator {
        return this.page.locator('#glass-border-color-input');
    }

    protected getNewDomainInput(): Locator {
        return this.page.getByPlaceholder(/example\.com|domain/i);
    }

    protected getAddDomainButton(): Locator {
        return this.page.getByTestId('add-domain-button');
    }

    protected getSaveTenantButton(): Locator {
        return this.page.getByRole('button', { name: /(create tenant|update tenant|save changes)/i });
    }

    protected getCancelButton(): Locator {
        return this.page.getByRole('button', { name: /cancel/i });
    }

    protected getCloseModalButton(): Locator {
        return this.page.getByTestId('close-modal-button');
    }

    protected getPublishButton(): Locator {
        return this.page.getByRole('button', { name: /publish theme/i });
    }

    protected getSuccessAlert(): Locator {
        return this.page.locator('[role="alert"]').filter({ hasText: /successfully|published/i });
    }

    protected getErrorAlert(): Locator {
        return this.page.locator('[role="alert"]').filter({ hasText: /error|invalid|required|failed/i });
    }

    protected getCreateTenantButton(): Locator {
        return this.page.getByRole('button', { name: /create tenant|new tenant/i });
    }

    // ✅ Navigation
    async waitForModalToBeVisible(): Promise<void> {
        await this.getModal().waitFor({ state: 'visible' });
        await this.getModalHeading().waitFor({ state: 'visible' });
    }

    async waitForModalToBeHidden(): Promise<void> {
        await this.getModal().waitFor({ state: 'hidden', timeout: 3000 });
    }

    // ✅ Action methods
    async fillTenantId(value: string): Promise<void> {
        await this.getTenantIdInput().fill(value);
    }

    async fillAppName(value: string): Promise<void> {
        const input = this.getAppNameInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async fillLogoUrl(value: string): Promise<void> {
        // The logo field uses ImageUploadField with URL input mode
        const logoField = this.getLogoUploadField();
        await logoField.getByRole('button', { name: 'Or enter URL' }).click();
        const urlInput = this.page.getByTestId('logo-upload-field-url-input');
        await urlInput.fill(value);
        // Click Download button to set the URL
        await logoField.getByRole('button', { name: 'Download' }).click();
        // Wait for the download button to disappear (indicates download completed or URL input closed)
        await expect(logoField.getByRole('button', { name: 'Download' })).not.toBeVisible();
    }

    async fillFaviconUrl(value: string): Promise<void> {
        // The favicon field uses ImageUploadField with URL input mode
        const faviconField = this.getFaviconUploadField();
        await faviconField.getByRole('button', { name: 'Or enter URL' }).click();
        const urlInput = this.page.getByTestId('favicon-upload-field-url-input');
        await urlInput.fill(value);
        // Click Download button to set the URL
        await faviconField.getByRole('button', { name: 'Download' }).click();
        // Wait for the download button to disappear (indicates download completed or URL input closed)
        await expect(faviconField.getByRole('button', { name: 'Download' })).not.toBeVisible();
    }

    async addDomain(domain: string): Promise<void> {
        await this.getNewDomainInput().fill(domain);
        await this.getAddDomainButton().click();
    }

    async removeDomain(index: number): Promise<void> {
        await this.page.getByTestId(`remove-domain-${index}`).click();
    }

    async setPrimaryColor(color: string): Promise<void> {
        await this.getPrimaryColorInput().fill(color);
    }

    async setSecondaryColor(color: string): Promise<void> {
        await this.getSecondaryColorInput().fill(color);
    }

    async setAccentColor(color: string): Promise<void> {
        await this.getAccentColorInput().fill(color);
    }

    async setSurfaceColor(color: string): Promise<void> {
        await this.getSurfaceColorInput().fill(color);
    }

    async setTextColor(color: string): Promise<void> {
        await this.getTextColorInput().fill(color);
    }

    async setCustomCss(css: string): Promise<void> {
        const input = this.getCustomCssInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(css, { delay: 10 });
    }

    async toggleShowLandingPage(checked: boolean): Promise<void> {
        const checkbox = this.getShowLandingPageCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowMarketingContent(checked: boolean): Promise<void> {
        const checkbox = this.getShowMarketingContentCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowPricingPage(checked: boolean): Promise<void> {
        const checkbox = this.getShowPricingPageCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleAuroraAnimation(checked: boolean): Promise<void> {
        const checkbox = this.getEnableAuroraAnimationCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleGlassmorphism(checked: boolean): Promise<void> {
        const checkbox = this.getEnableGlassmorphismCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleMagneticHover(checked: boolean): Promise<void> {
        const checkbox = this.getEnableMagneticHoverCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleScrollReveal(checked: boolean): Promise<void> {
        const checkbox = this.getEnableScrollRevealCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async setFontFamilySans(value: string): Promise<void> {
        const input = this.getFontFamilySansInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setFontFamilySerif(value: string): Promise<void> {
        const input = this.getFontFamilySerifInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setFontFamilyMono(value: string): Promise<void> {
        const input = this.getFontFamilyMonoInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setAuroraGradientColor1(color: string): Promise<void> {
        await this.getAuroraGradientColor1Input().fill(color);
    }

    async setAuroraGradientColor2(color: string): Promise<void> {
        await this.getAuroraGradientColor2Input().fill(color);
    }

    async setAuroraGradientColor3(color: string): Promise<void> {
        await this.getAuroraGradientColor3Input().fill(color);
    }

    async setAuroraGradientColor4(color: string): Promise<void> {
        await this.getAuroraGradientColor4Input().fill(color);
    }

    async setGlassColor(value: string): Promise<void> {
        const input = this.getGlassColorInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setGlassBorderColor(value: string): Promise<void> {
        const input = this.getGlassBorderColorInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async clickSave(): Promise<void> {
        await this.getSaveTenantButton().click();
    }

    async clickCancel(): Promise<void> {
        await this.getCancelButton().click();
    }

    async clickClose(): Promise<void> {
        await this.getCloseModalButton().click();
    }

    async clickPublish(): Promise<void> {
        await this.getPublishButton().click();
    }

    async clickCreateTenant(): Promise<void> {
        await this.getCreateTenantButton().click();
    }

    async clickSaveAndVerifySuccess(): Promise<void> {
        await this.clickSave();
        // Either we see the success message OR the modal closes (both indicate success)
        await Promise.race([
            this.verifySuccessMessage().catch(() => {}),
            this.verifyModalIsClosed().catch(() => {}),
        ]);
        // Give modal time to close if it hasn't yet
        await this.verifyModalIsClosed();
    }

    async clickPublishAndVerifySuccess(): Promise<void> {
        await this.clickPublish();
        await this.verifySuccessMessage('Theme published successfully!');
    }

    async clickPublishAndGetCssUrl(): Promise<string> {
        const [publishResponse] = await Promise.all([
            this.page.waitForResponse(
                response => response.url().includes('/admin/tenants/publish') &&
                           response.status() === 200
            ),
            this.clickPublish(),
        ]);
        await this.verifySuccessMessage('Theme published successfully!');

        const responseBody = await publishResponse.json();
        const cssUrl = responseBody.cssUrl;
        if (!cssUrl) {
            throw new Error('No CSS URL in publish response');
        }
        return cssUrl;
    }

    // ✅ Verification methods - encapsulate all assertions
    async verifyModalIsOpen(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
        await expect(this.getModalHeading()).toBeVisible();
    }

    async verifyModalIsClosed(): Promise<void> {
        // Modal closes after 1.5s delay to show success message
        await this.waitForModalToBeHidden();
    }

    async verifyTenantIdDisabled(): Promise<void> {
        await expect(this.getTenantIdInput()).toBeDisabled();
    }

    async verifyTenantIdEnabled(): Promise<void> {
        await expect(this.getTenantIdInput()).toBeEnabled();
    }

    async verifySuccessMessage(message?: string): Promise<void> {
        const alert = this.getSuccessAlert();
        await expect(alert).toBeVisible();
        if (message) {
            await expect(alert).toContainText(message);
        }
    }

    async verifyErrorMessage(message?: string): Promise<void> {
        const alert = this.getErrorAlert();
        await expect(alert).toBeVisible();
        if (message) {
            await expect(alert).toContainText(message);
        }
    }

    async verifyFieldValue(field: 'tenantId' | 'appName', expectedValue: string): Promise<void> {
        let input: Locator;
        switch (field) {
            case 'tenantId':
                input = this.getTenantIdInput();
                break;
            case 'appName':
                input = this.getAppNameInput();
                break;
        }
        await expect(input).toHaveValue(expectedValue);
    }

    async verifyAllBasicFieldsVisible(): Promise<void> {
        await expect(this.getTenantIdInput()).toBeVisible();
        await expect(this.getAppNameInput()).toBeVisible();
        await expect(this.getLogoUploadField()).toBeVisible();
        await expect(this.getFaviconUploadField()).toBeVisible();
        await expect(this.getNewDomainInput()).toBeVisible();
    }

    async verifyAllColorFieldsVisible(): Promise<void> {
        await expect(this.getPrimaryColorInput()).toBeVisible();
        await expect(this.getSecondaryColorInput()).toBeVisible();
        await expect(this.getAccentColorInput()).toBeVisible();
        await expect(this.getSurfaceColorInput()).toBeVisible();
        await expect(this.getTextColorInput()).toBeVisible();
    }

    async verifyTypographyFieldsVisible(): Promise<void> {
        await expect(this.getFontFamilySansInput()).toBeVisible();
        await expect(this.getFontFamilySerifInput()).toBeVisible();
        await expect(this.getFontFamilyMonoInput()).toBeVisible();
    }

    async verifyMotionEffectsCheckboxesVisible(): Promise<void> {
        await expect(this.getEnableAuroraAnimationCheckbox()).toBeVisible();
        await expect(this.getEnableGlassmorphismCheckbox()).toBeVisible();
        await expect(this.getEnableMagneticHoverCheckbox()).toBeVisible();
        await expect(this.getEnableScrollRevealCheckbox()).toBeVisible();
    }

    async verifyAuroraGradientColorsVisible(): Promise<void> {
        await expect(this.getAuroraGradientColor1Input()).toBeVisible();
        await expect(this.getAuroraGradientColor2Input()).toBeVisible();
        await expect(this.getAuroraGradientColor3Input()).toBeVisible();
        await expect(this.getAuroraGradientColor4Input()).toBeVisible();
    }

    async verifyGlassmorphismColorsVisible(): Promise<void> {
        await expect(this.getGlassColorInput()).toBeVisible();
        await expect(this.getGlassBorderColorInput()).toBeVisible();
    }

    async verifyPublishButtonVisible(): Promise<void> {
        await expect(this.getPublishButton()).toBeVisible();
    }

    async verifyShowLandingPageChecked(expected: boolean): Promise<void> {
        const checkbox = this.getShowLandingPageCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyFontFamilySansValue(expectedValue: string): Promise<void> {
        await expect(this.getFontFamilySansInput()).toHaveValue(expectedValue);
    }

    async verifyFontFamilySerifValue(expectedValue: string): Promise<void> {
        await expect(this.getFontFamilySerifInput()).toHaveValue(expectedValue);
    }

    async verifyFontFamilyMonoValue(expectedValue: string): Promise<void> {
        await expect(this.getFontFamilyMonoInput()).toHaveValue(expectedValue);
    }

    async verifyAuroraAnimationChecked(expected: boolean): Promise<void> {
        const checkbox = this.getEnableAuroraAnimationCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyGlassmorphismChecked(expected: boolean): Promise<void> {
        const checkbox = this.getEnableGlassmorphismCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyAuroraGradientColor1Value(expectedValue: string): Promise<void> {
        await expect(this.getAuroraGradientColor1Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor2Value(expectedValue: string): Promise<void> {
        await expect(this.getAuroraGradientColor2Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor3Value(expectedValue: string): Promise<void> {
        await expect(this.getAuroraGradientColor3Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor4Value(expectedValue: string): Promise<void> {
        await expect(this.getAuroraGradientColor4Input()).toHaveValue(expectedValue);
    }

    async verifyGlassColorValue(expectedValue: string): Promise<void> {
        await expect(this.getGlassColorInput()).toHaveValue(expectedValue);
    }

    async verifyGlassBorderColorValue(expectedValue: string): Promise<void> {
        await expect(this.getGlassBorderColorInput()).toHaveValue(expectedValue);
    }

    async getAppNameValue(): Promise<string> {
        return await this.getAppNameInput().inputValue();
    }

    // Additional verification methods for comprehensive testing
    async verifyAppNameValue(expectedValue: string): Promise<void> {
        await expect(this.getAppNameInput()).toHaveValue(expectedValue);
    }

    // Logo and Favicon URL verification not available - UI uses ImageUploadField with file upload
    // To verify logo/favicon, check the image preview or the currentImageUrl prop

    async verifyPrimaryColorValue(expectedValue: string): Promise<void> {
        await expect(this.getPrimaryColorInput()).toHaveValue(expectedValue);
    }

    async verifySecondaryColorValue(expectedValue: string): Promise<void> {
        await expect(this.getSecondaryColorInput()).toHaveValue(expectedValue);
    }

    async verifyAccentColorValue(expectedValue: string): Promise<void> {
        await expect(this.getAccentColorInput()).toHaveValue(expectedValue);
    }

    async verifySurfaceColorValue(expectedValue: string): Promise<void> {
        await expect(this.getSurfaceColorInput()).toHaveValue(expectedValue);
    }

    async verifyTextColorValue(expectedValue: string): Promise<void> {
        await expect(this.getTextColorInput()).toHaveValue(expectedValue);
    }

    async verifyCustomCssValue(expectedValue: string): Promise<void> {
        await expect(this.getCustomCssInput()).toHaveValue(expectedValue);
    }

    async verifyShowMarketingContentChecked(expected: boolean): Promise<void> {
        const checkbox = this.getShowMarketingContentCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyShowPricingPageChecked(expected: boolean): Promise<void> {
        const checkbox = this.getShowPricingPageCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyMagneticHoverChecked(expected: boolean): Promise<void> {
        const checkbox = this.getEnableMagneticHoverCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyScrollRevealChecked(expected: boolean): Promise<void> {
        const checkbox = this.getEnableScrollRevealCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    // Helper method for filling complete tenant
    async fillBasicTenantInfo(data: {
        tenantId: string;
        appName: string;
        logoUrl?: string;
        domains: string[];
    }): Promise<void> {
        await this.fillTenantId(data.tenantId);
        await this.fillAppName(data.appName);
        if (data.logoUrl) {
            await this.fillLogoUrl(data.logoUrl);
        }
        for (const domain of data.domains) {
            await this.addDomain(domain);
        }
    }

    // Domain verification methods
    protected getDomainItem(domain: string): Locator {
        return this.page.getByText(domain, { exact: true });
    }

    async verifyDomainVisible(domain: string): Promise<void> {
        await expect(this.getDomainItem(domain)).toBeVisible();
    }

    async verifyDomainNotVisible(domain: string): Promise<void> {
        await expect(this.getDomainItem(domain)).not.toBeVisible();
    }

    // Wait for form to be populated (used after opening edit modal)
    async waitForFormPopulated(): Promise<void> {
        // Wait for app name to have a non-empty value indicating form is populated
        await expect(this.getAppNameInput()).not.toHaveValue('');
    }
}
