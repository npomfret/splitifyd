import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

export class TenantEditorModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ✅ Section expansion helpers
    // For sections with i18n-translated titles, use test-id
    protected getSectionButtonByTestId(testId: string): Locator {
        return this.page.getByTestId(testId);
    }

    // For sections with hardcoded titles, use button name (more semantic)
    protected getSectionButtonByName(title: string): Locator {
        return this.getModal().getByRole('button', { name: title });
    }

    protected async expandSectionByTestId(testId: string): Promise<void> {
        const button = this.getSectionButtonByTestId(testId);
        const isExpanded = await button.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
            await button.click();
            await this.page.waitForTimeout(100);
        }
    }

    protected async expandSectionByName(title: string): Promise<void> {
        const button = this.getSectionButtonByName(title);
        const isExpanded = await button.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
            await button.click();
            await this.page.waitForTimeout(100);
        }
    }

    async expandActionsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.brandColors.title);
    }

    async expandPaletteSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.brandColors.title);
    }

    async expandBrandColorsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.brandColors.title);
    }

    async expandInteractiveSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.interactiveColors.title);
    }

    async expandSurfacesSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.surfaceColors.title);
    }

    async expandTextSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.textColors.title);
    }

    async expandMotionEffectsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.motion.title);
    }

    async expandTypographySection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.typography.title);
    }

    async expandMarketingSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.marketing.title);
    }

    async expandLogoAssetsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.assets.title);
    }

    async expandHeaderDisplaySection(): Promise<void> {
        await this.expandSectionByName('Header Display');
    }

    async expandBordersSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.borderColors.title);
    }

    async expandStatusColorsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.statusColors.title);
    }

    async expandAuroraGradientSection(): Promise<void> {
        // First expand the parent motion-effects section, then aurora-gradient
        await this.expandMotionEffectsSection();
        await this.expandSectionByName('Aurora Gradient');
    }

    async expandGlassmorphismSection(): Promise<void> {
        // Glassmorphism is now a standalone section (no longer nested under motion effects)
        await this.expandSectionByName('Glassmorphism');
    }

    // ✅ Editor mode toggle (using semantic selectors)
    async switchToBasicMode(): Promise<void> {
        const basicButton = this.getModal().getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.basic });
        await basicButton.click();
    }

    async switchToAdvancedMode(): Promise<void> {
        const advancedButton = this.getModal().getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.advanced });
        await advancedButton.click();
    }

    async verifyEditorModeIsBasic(): Promise<void> {
        const basicButton = this.getModal().getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.basic });
        await expect(basicButton).toHaveAttribute('aria-checked', 'true');
    }

    async verifyEditorModeIsAdvanced(): Promise<void> {
        const advancedButton = this.getModal().getByRole('radio', { name: translation.admin.tenantEditor.modeToggle.advanced });
        await expect(advancedButton).toHaveAttribute('aria-checked', 'true');
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

    // Color inputs use test-ids (justified: duplicate labels across sections like "Primary *", "Secondary *")
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
        return this.page.getByTestId('surface-base-color-input');
    }

    protected getTextColorInput(): Locator {
        return this.page.getByTestId('text-primary-color-input');
    }

    protected getCustomCssInput(): Locator {
        // Custom CSS was removed from the form
        return this.page.locator('[data-testid="custom-css-input"]');
    }

    protected getShowMarketingContentCheckbox(): Locator {
        return this.page.getByLabel(/marketing content/i);
    }

    protected getShowPricingPageCheckbox(): Locator {
        return this.page.getByLabel(/pricing page/i);
    }

    // Header Display
    protected getShowAppNameInHeaderCheckbox(): Locator {
        return this.page.getByLabel(/show app name in header/i);
    }

    // Motion & Effects
    protected getEnableAuroraAnimationCheckbox(): Locator {
        return this.page.getByLabel(/aurora background/i);
    }

    protected getEnableMagneticHoverCheckbox(): Locator {
        return this.page.getByLabel(/magnetic hover/i);
    }

    protected getEnableScrollRevealCheckbox(): Locator {
        return this.page.getByLabel(/scroll reveal/i);
    }

    // Typography Controls - use semantic labels
    protected getFontFamilySansInput(): Locator {
        return this.getModal().getByLabel(/^Sans/);
    }

    protected getFontFamilySerifInput(): Locator {
        return this.getModal().getByLabel(/^Serif/);
    }

    protected getFontFamilyMonoInput(): Locator {
        return this.getModal().getByLabel(/^Mono/);
    }

    // Aurora Gradient (4 colors)
    protected getAuroraGradientSection(): Locator {
        return this.page.getByRole('heading', { name: /aurora gradient/i }).locator('..');
    }

    protected getAuroraGradientColor1Input(): Locator {
        return this.page.getByTestId('aurora-gradient-color-1-input');
    }

    protected getAuroraGradientColor2Input(): Locator {
        return this.page.getByTestId('aurora-gradient-color-2-input');
    }

    protected getAuroraGradientColor3Input(): Locator {
        return this.page.getByTestId('aurora-gradient-color-3-input');
    }

    protected getAuroraGradientColor4Input(): Locator {
        return this.page.getByTestId('aurora-gradient-color-4-input');
    }

    // Glassmorphism Colors
    protected getGlassColorInput(): Locator {
        return this.page.getByTestId('glass-color-input');
    }

    protected getGlassBorderColorInput(): Locator {
        return this.page.getByTestId('glass-border-color-input');
    }

    protected getNewDomainInput(): Locator {
        return this.page.getByPlaceholder(/example\.com|domain/i);
    }

    protected getAddDomainButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.admin.tenantEditor.buttons.addDomain });
    }

    protected getSaveTenantButton(): Locator {
        return this.getModal().getByRole('button', { name: /(create tenant|update tenant|save changes)/i });
    }

    protected getCancelButton(): Locator {
        return this.page.getByRole('button', { name: translation.common.cancel });
    }

    protected getCloseModalButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.common.close });
    }

    protected getPublishButton(): Locator {
        return this.page.getByRole('button', { name: translation.admin.tenantEditor.buttons.publish });
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
        await logoField.getByRole('button', { name: translation.common.orEnterUrl }).click();
        const urlInput = this.page.getByTestId('logo-upload-field-url-input');
        await urlInput.fill(value);
        // Click Download button to set the URL
        await logoField.getByRole('button', { name: translation.common.download }).click();
        // Wait for the download button to disappear (indicates download completed or URL input closed)
        await expect(logoField.getByRole('button', { name: translation.common.download })).not.toBeVisible();
    }

    async fillFaviconUrl(value: string): Promise<void> {
        // The favicon field uses ImageUploadField with URL input mode
        const faviconField = this.getFaviconUploadField();
        await faviconField.getByRole('button', { name: translation.common.orEnterUrl }).click();
        const urlInput = this.page.getByTestId('favicon-upload-field-url-input');
        await urlInput.fill(value);
        // Click Download button to set the URL
        await faviconField.getByRole('button', { name: translation.common.download }).click();
        // Wait for the download button to disappear (indicates download completed or URL input closed)
        await expect(faviconField.getByRole('button', { name: translation.common.download })).not.toBeVisible();
    }

    async addDomain(domain: string): Promise<void> {
        await this.getNewDomainInput().fill(domain);
        await this.getAddDomainButton().click();
    }

    async removeDomain(domain: string): Promise<void> {
        // Button has aria-label "Remove {domain}"
        await this.getModal().getByRole('button', { name: `Remove ${domain}` }).click();
    }

    async setPrimaryColor(color: string): Promise<void> {
        await this.expandActionsSection();
        await this.getPrimaryColorInput().fill(color);
    }

    async setSecondaryColor(color: string): Promise<void> {
        await this.expandActionsSection();
        await this.getSecondaryColorInput().fill(color);
    }

    async setAccentColor(color: string): Promise<void> {
        await this.expandActionsSection();
        await this.getAccentColorInput().fill(color);
    }

    async setSurfaceColor(color: string): Promise<void> {
        await this.expandSurfacesSection();
        await this.getSurfaceColorInput().fill(color);
    }

    async setTextColor(color: string): Promise<void> {
        await this.expandTextSection();
        await this.getTextColorInput().fill(color);
    }

    async setCustomCss(css: string): Promise<void> {
        const input = this.getCustomCssInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(css, { delay: 10 });
    }

    async toggleShowMarketingContent(checked: boolean): Promise<void> {
        await this.expandMarketingSection();
        const checkbox = this.getShowMarketingContentCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowPricingPage(checked: boolean): Promise<void> {
        await this.expandMarketingSection();
        const checkbox = this.getShowPricingPageCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleShowAppNameInHeader(checked: boolean): Promise<void> {
        await this.expandHeaderDisplaySection();
        const checkbox = this.getShowAppNameInHeaderCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleAuroraAnimation(checked: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
        const checkbox = this.getEnableAuroraAnimationCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleMagneticHover(checked: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
        const checkbox = this.getEnableMagneticHoverCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async toggleScrollReveal(checked: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
        const checkbox = this.getEnableScrollRevealCheckbox();
        const isCurrentlyChecked = await checkbox.isChecked();
        if (isCurrentlyChecked !== checked) {
            await checkbox.click();
        }
    }

    async setFontFamilySans(value: string): Promise<void> {
        await this.expandTypographySection();
        const input = this.getFontFamilySansInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setFontFamilySerif(value: string): Promise<void> {
        await this.expandTypographySection();
        const input = this.getFontFamilySerifInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setFontFamilyMono(value: string): Promise<void> {
        await this.expandTypographySection();
        const input = this.getFontFamilyMonoInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setAuroraGradientColor1(color: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await this.getAuroraGradientColor1Input().fill(color);
    }

    async setAuroraGradientColor2(color: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await this.getAuroraGradientColor2Input().fill(color);
    }

    async setAuroraGradientColor3(color: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await this.getAuroraGradientColor3Input().fill(color);
    }

    async setAuroraGradientColor4(color: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await this.getAuroraGradientColor4Input().fill(color);
    }

    async setGlassColor(value: string): Promise<void> {
        await this.expandGlassmorphismSection();
        const input = this.getGlassColorInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async setGlassBorderColor(value: string): Promise<void> {
        await this.expandGlassmorphismSection();
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
                response =>
                    response.url().includes('/admin/tenants/publish')
                    && response.status() === 200,
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

    /**
     * Waits for the modal to open AND for the form to be populated with the specified tenant's data.
     * Use this instead of verifyModalIsOpen() when you need to verify form values afterward,
     * as the form data loads asynchronously after the modal becomes visible.
     */
    async verifyModalIsOpenWithTenant(expectedAppName: string): Promise<void> {
        await expect(this.getModal()).toBeVisible();
        await expect(this.getModalHeading()).toBeVisible();
        // Wait for the form to be populated with the tenant's data
        await expect(this.getAppNameInput()).toHaveValue(expectedAppName);
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
        // Logo/favicon are in a separate collapsible section
        await this.expandLogoAssetsSection();
        await expect(this.getLogoUploadField()).toBeVisible();
        await expect(this.getFaviconUploadField()).toBeVisible();
        // Domain input is in basic info section
        await expect(this.getNewDomainInput()).toBeVisible();
    }

    async verifyAllColorFieldsVisible(): Promise<void> {
        await this.expandActionsSection();
        await expect(this.getPrimaryColorInput()).toBeVisible();
        await expect(this.getSecondaryColorInput()).toBeVisible();
        await expect(this.getAccentColorInput()).toBeVisible();
        await this.expandSurfacesSection();
        await expect(this.getSurfaceColorInput()).toBeVisible();
        await this.expandTextSection();
        await expect(this.getTextColorInput()).toBeVisible();
    }

    async verifyTypographyFieldsVisible(): Promise<void> {
        await this.expandTypographySection();
        await expect(this.getFontFamilySansInput()).toBeVisible();
        await expect(this.getFontFamilySerifInput()).toBeVisible();
        await expect(this.getFontFamilyMonoInput()).toBeVisible();
    }

    async verifyMotionEffectsCheckboxesVisible(): Promise<void> {
        await this.expandMotionEffectsSection();
        await expect(this.getEnableAuroraAnimationCheckbox()).toBeVisible();
        await expect(this.getEnableMagneticHoverCheckbox()).toBeVisible();
        await expect(this.getEnableScrollRevealCheckbox()).toBeVisible();
    }

    async verifyAuroraGradientColorsVisible(): Promise<void> {
        await this.expandAuroraGradientSection();
        await expect(this.getAuroraGradientColor1Input()).toBeVisible();
        await expect(this.getAuroraGradientColor2Input()).toBeVisible();
        await expect(this.getAuroraGradientColor3Input()).toBeVisible();
        await expect(this.getAuroraGradientColor4Input()).toBeVisible();
    }

    async verifyGlassmorphismColorsVisible(): Promise<void> {
        await this.expandGlassmorphismSection();
        await expect(this.getGlassColorInput()).toBeVisible();
        await expect(this.getGlassBorderColorInput()).toBeVisible();
    }

    async verifyPublishButtonVisible(): Promise<void> {
        await expect(this.getPublishButton()).toBeVisible();
    }

    async verifyFontFamilySansValue(expectedValue: string): Promise<void> {
        await this.expandTypographySection();
        await expect(this.getFontFamilySansInput()).toHaveValue(expectedValue);
    }

    async verifyFontFamilySerifValue(expectedValue: string): Promise<void> {
        await this.expandTypographySection();
        await expect(this.getFontFamilySerifInput()).toHaveValue(expectedValue);
    }

    async verifyFontFamilyMonoValue(expectedValue: string): Promise<void> {
        await this.expandTypographySection();
        await expect(this.getFontFamilyMonoInput()).toHaveValue(expectedValue);
    }

    async verifyAuroraAnimationChecked(expected: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
        const checkbox = this.getEnableAuroraAnimationCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyAuroraGradientColor1Value(expectedValue: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await expect(this.getAuroraGradientColor1Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor2Value(expectedValue: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await expect(this.getAuroraGradientColor2Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor3Value(expectedValue: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await expect(this.getAuroraGradientColor3Input()).toHaveValue(expectedValue);
    }

    async verifyAuroraGradientColor4Value(expectedValue: string): Promise<void> {
        await this.expandAuroraGradientSection();
        await expect(this.getAuroraGradientColor4Input()).toHaveValue(expectedValue);
    }

    async verifyGlassColorValue(expectedValue: string): Promise<void> {
        await this.expandGlassmorphismSection();
        await expect(this.getGlassColorInput()).toHaveValue(expectedValue);
    }

    async verifyGlassBorderColorValue(expectedValue: string): Promise<void> {
        await this.expandGlassmorphismSection();
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
        await this.expandActionsSection();
        await expect(this.getPrimaryColorInput()).toHaveValue(expectedValue);
    }

    async verifySecondaryColorValue(expectedValue: string): Promise<void> {
        await this.expandActionsSection();
        await expect(this.getSecondaryColorInput()).toHaveValue(expectedValue);
    }

    async verifyAccentColorValue(expectedValue: string): Promise<void> {
        await this.expandActionsSection();
        await expect(this.getAccentColorInput()).toHaveValue(expectedValue);
    }

    async verifySurfaceColorValue(expectedValue: string): Promise<void> {
        await this.expandSurfacesSection();
        await expect(this.getSurfaceColorInput()).toHaveValue(expectedValue);
    }

    async verifyTextColorValue(expectedValue: string): Promise<void> {
        await this.expandTextSection();
        await expect(this.getTextColorInput()).toHaveValue(expectedValue);
    }

    async verifyCustomCssValue(expectedValue: string): Promise<void> {
        await expect(this.getCustomCssInput()).toHaveValue(expectedValue);
    }

    async verifyShowMarketingContentChecked(expected: boolean): Promise<void> {
        await this.expandMarketingSection();
        const checkbox = this.getShowMarketingContentCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyShowPricingPageChecked(expected: boolean): Promise<void> {
        await this.expandMarketingSection();
        const checkbox = this.getShowPricingPageCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyShowAppNameInHeaderChecked(expected: boolean): Promise<void> {
        await this.expandHeaderDisplaySection();
        const checkbox = this.getShowAppNameInHeaderCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyMagneticHoverChecked(expected: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
        const checkbox = this.getEnableMagneticHoverCheckbox();
        if (expected) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }

    async verifyScrollRevealChecked(expected: boolean): Promise<void> {
        await this.expandMotionEffectsSection();
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

    // ========================================
    // Advanced Form Field Methods
    // ========================================

    // Spacing section
    async expandSpacingSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.spacing.title);
    }

    protected getSpacing2xsInput(): Locator {
        return this.page.getByTestId('spacing-2xs-input');
    }

    protected getSpacingXsInput(): Locator {
        return this.page.getByTestId('spacing-xs-input');
    }

    protected getSpacingSmInput(): Locator {
        return this.page.getByTestId('spacing-sm-input');
    }

    protected getSpacingMdInput(): Locator {
        return this.page.getByTestId('spacing-md-input');
    }

    protected getSpacingLgInput(): Locator {
        return this.page.getByTestId('spacing-lg-input');
    }

    async verifySpacingFieldsVisible(): Promise<void> {
        await this.expandSpacingSection();
        await expect(this.getSpacing2xsInput()).toBeVisible();
        await expect(this.getSpacingXsInput()).toBeVisible();
        await expect(this.getSpacingSmInput()).toBeVisible();
    }

    // Radii section
    async expandRadiiSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.radii.title);
    }

    protected getRadiiSmInput(): Locator {
        return this.page.getByTestId('radii-sm-input');
    }

    protected getRadiiMdInput(): Locator {
        return this.page.getByTestId('radii-md-input');
    }

    protected getRadiiLgInput(): Locator {
        return this.page.getByTestId('radii-lg-input');
    }

    async verifyRadiiFieldsVisible(): Promise<void> {
        await this.expandRadiiSection();
        await expect(this.getRadiiSmInput()).toBeVisible();
        await expect(this.getRadiiMdInput()).toBeVisible();
        await expect(this.getRadiiLgInput()).toBeVisible();
    }

    async setRadiiSm(value: string): Promise<void> {
        await this.expandRadiiSection();
        await this.getRadiiSmInput().fill(value);
    }

    async verifyRadiiSmValue(expectedValue: string): Promise<void> {
        await this.expandRadiiSection();
        await expect(this.getRadiiSmInput()).toHaveValue(expectedValue);
    }

    // Shadows section
    async expandShadowsSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.shadows.title);
    }

    protected getShadowSmInput(): Locator {
        return this.page.getByTestId('shadow-sm-input');
    }

    protected getShadowMdInput(): Locator {
        return this.page.getByTestId('shadow-md-input');
    }

    protected getShadowLgInput(): Locator {
        return this.page.getByTestId('shadow-lg-input');
    }

    async verifyShadowFieldsVisible(): Promise<void> {
        await this.expandShadowsSection();
        await expect(this.getShadowSmInput()).toBeVisible();
        await expect(this.getShadowMdInput()).toBeVisible();
        await expect(this.getShadowLgInput()).toBeVisible();
    }

    async setShadowSm(value: string): Promise<void> {
        await this.expandShadowsSection();
        const input = this.getShadowSmInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async verifyShadowSmValue(expectedValue: string): Promise<void> {
        await this.expandShadowsSection();
        await expect(this.getShadowSmInput()).toHaveValue(expectedValue);
    }

    // Legal section
    async expandLegalSection(): Promise<void> {
        await this.expandSectionByName(translation.admin.tenantEditor.sections.legal.title);
    }

    protected getCompanyNameInput(): Locator {
        return this.page.getByTestId('company-name-input');
    }

    protected getSupportEmailInput(): Locator {
        return this.page.getByTestId('support-email-input');
    }

    protected getPrivacyPolicyUrlInput(): Locator {
        return this.page.getByTestId('privacy-policy-url-input');
    }

    protected getTermsOfServiceUrlInput(): Locator {
        return this.page.getByTestId('terms-of-service-url-input');
    }

    async verifyLegalFieldsVisible(): Promise<void> {
        await this.expandLegalSection();
        await expect(this.getCompanyNameInput()).toBeVisible();
        await expect(this.getSupportEmailInput()).toBeVisible();
        await expect(this.getPrivacyPolicyUrlInput()).toBeVisible();
        await expect(this.getTermsOfServiceUrlInput()).toBeVisible();
    }

    async setCompanyName(value: string): Promise<void> {
        await this.expandLegalSection();
        const input = this.getCompanyNameInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async verifyCompanyNameValue(expectedValue: string): Promise<void> {
        await this.expandLegalSection();
        await expect(this.getCompanyNameInput()).toHaveValue(expectedValue);
    }

    async setSupportEmail(value: string): Promise<void> {
        await this.expandLegalSection();
        const input = this.getSupportEmailInput();
        await input.click();
        await input.clear();
        await input.pressSequentially(value, { delay: 10 });
    }

    async verifySupportEmailValue(expectedValue: string): Promise<void> {
        await this.expandLegalSection();
        await expect(this.getSupportEmailInput()).toHaveValue(expectedValue);
    }

    // Interactive colors section (expandInteractiveSection defined above)

    protected getInteractivePrimaryInput(): Locator {
        return this.page.getByTestId('interactive-primary-color-input');
    }

    protected getInteractivePrimaryHoverInput(): Locator {
        return this.page.getByTestId('interactive-primary-hover-color-input');
    }

    protected getInteractiveDestructiveInput(): Locator {
        return this.page.getByTestId('interactive-destructive-color-input');
    }

    async verifyInteractiveFieldsVisible(): Promise<void> {
        await this.expandInteractiveSection();
        await expect(this.getInteractivePrimaryInput()).toBeVisible();
        await expect(this.getInteractivePrimaryHoverInput()).toBeVisible();
        await expect(this.getInteractiveDestructiveInput()).toBeVisible();
    }

    async setInteractivePrimaryColor(color: string): Promise<void> {
        await this.expandInteractiveSection();
        await this.getInteractivePrimaryInput().fill(color);
    }

    async verifyInteractivePrimaryColorValue(expectedValue: string): Promise<void> {
        await this.expandInteractiveSection();
        await expect(this.getInteractivePrimaryInput()).toHaveValue(expectedValue);
    }

    // Helper to count total visible sections
    async countExpandedSections(): Promise<number> {
        const expandedButtons = await this.getModal().locator('[aria-expanded="true"]').count();
        return expandedButtons;
    }

    // Helper to collapse all sections
    async collapseAllSections(): Promise<void> {
        const expandedButtons = this.getModal().locator('[aria-expanded="true"]');
        const count = await expandedButtons.count();
        for (let i = 0; i < count; i++) {
            await expandedButtons.nth(0).click();
            await this.page.waitForTimeout(50);
        }
    }
}
